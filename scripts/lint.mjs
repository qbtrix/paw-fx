// Lints every effect under effects/ (or the dirs passed as argv) against the
// paw-fx effect contract: meta.json schema, licence allow-list + origin,
// every `needs` key present in vendor/manifest.json, snippet.html
// resting-state rules, self-contained references in index.js and style.css,
// no vendor global read at module scope, gzipped own-code size <= 60 KB,
// upstream licence header on ported code. Prints "<effect>: <reason>" per
// failure and exits 1 if any.
//
// The self-contained check carries the weight. A generated site has no build
// step and no import map, so anything that is not a path fetched from the site
// itself is a hard failure in the browser and this lint is the only gate. So
// index.js is scanned for EVERY module specifier -- side-effect `import "x"`,
// all binding forms, `export ... from "x"`, and dynamic `import("x")` -- and
// style.css for `@import` and `url()` targets.
//
// Regexes, not a parser (three for JS, two for CSS), with two deliberate costs:
//   1. Comments and strings are not stripped, so a commented-out or quoted
//      `from "three"` is a false positive. That is the cheap direction to be
//      wrong in: it is one visible line to fix, whereas mis-detecting a comment
//      boundary would silently punch a hole in the gate.
//   2. A CSS relative URL written without a leading "./" (`url(img/x.png)`,
//      `@import "reset.css"`) is not distinguishable from a bare specifier and
//      is flagged. Write it `./img/x.png`.
//
// Two rules here are worth their own note, because both were holes:
//   - The licence-header rule matches only on a COMMENT line. Every effect is
//     required to carry `license: "MIT"` inside its `export const meta`, and a
//     bare /Copyright|License/i scan of the first 20 lines matched that field,
//     so the rule passed any ported effect that had no header at all.
//   - The module-scope global rule covers the effect side of the one allowed
//     globals exception. A vendored bundle may publish globals (the tsParticles
//     slim bundle assigns `tsParticles` and `loadSlim` rather than exporting
//     them); effect code may read them only inside a function body, never at
//     import time.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { gzipSync } from "node:zlib";
import { validate } from "./validate.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(ROOT, "schema/meta.schema.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "vendor/manifest.json"), "utf8"));
const SIZE_LIMIT = 60 * 1024;

// `[^;()=]*?` holds the binding scan inside one statement -- an import's
// binding list contains none of those four characters, and a statement after
// it hits one almost immediately -- which is what lets these stay off the line
// anchor and still match multi-line import lists. The cost is one known blind
// spot: a `(`, `)` or `=` inside a comment *within* a binding list blocks the
// scan (`import {\n a, // helper()\n b\n} from "three"` goes uncaught).
// Dropping `()` from the exclusion would trade that for false positives on
// ordinary code, which is the worse trade.
const JS_SPECIFIERS = [
  /\b(?:import|export)\b[^;()=]*?\bfrom\s*["']([^"']+)["']/g, // import d / {n} / * as ns / d, {n} from "s"; export * / {n} from "s"
  /\bimport\b\s*["']([^"']+)["']/g,                           // side-effect: import "s"
  /\bimport\s*\(\s*["']([^"']+)["']/g,                        // dynamic: import("s"), await import("s")
];

// `@import url(...)` and every asset reference fall to the second pattern.
// Its quoted alternatives come first so a data: URI is consumed whole -- the
// SVG grain texture in aurora-css nests a `url(%23n)` inside one.
const CSS_SPECIFIERS = [
  /@import\s+["']([^"']+)["']/gi,                        // @import "s"
  /\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))/gi,       // url("s") / url('s') / url(s)
];

const specifiers = (src, patterns) => {
  const found = new Set();
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const spec = m.slice(1).find((g) => g != null)?.trim();
      if (spec) found.add(spec);
    }
  }
  return found;
};

/** Every static and dynamic module specifier in an effect's index.js. */
export const jsSpecifiers = (src) => specifiers(src, JS_SPECIFIERS);

// The marker has to come before the word on the line, so `license: "MIT"` in
// the required meta block does not read as a header. Only the first 20 lines
// are considered -- a header lower down is not a header.
const LICENCE_HEADER = /(?:\/\/|\/\*|\*)[^\n]*?(?:Copyright|Licen[cs]e)/i;
const hasLicenceHeader = (js) => js.split("\n", 20).some((l) => LICENCE_HEADER.test(l));

// Globals a vendored bundle publishes instead of exporting. Only tsParticles
// does today; add the identifier here when another vendored file does it.
const VENDOR_GLOBAL = /\bglobalThis\b|\btsParticles\b|\bloadSlim\b/;

// ponytail: brace counting, not a parser. Each open brace is pushed with a flag
// saying whether its line looked like a function, and a global read is an error
// only while no function flag is on the stack, which is what catches the
// multi-line `export const cfg = { engine: globalThis.tsParticles }` shape that
// a plain depth counter would miss. Ceilings, all measured, not assumed:
//   - Object-literal method and getter shorthand (`start() {`, `get engine() {`)
//     is not read as a function opener, so a global read inside one is flagged
//     even though it does sit in a function body. False positive, one line to
//     rewrite, and the cheap direction to be wrong in.
//   - An unbalanced "{" inside a string skews the stack. Harmless on its own,
//     but on a line that also reads as a function (`const t = "=> {";`) it
//     leaves a function flag on the stack and silences the rule for the rest of
//     the file. That is the one silent direction here; a real effect file has no
//     reason to carry it.
//   - A global named in a block comment sharing a line with code survives the
//     strip. Whole-line comments do not, which is what lets a header comment
//     explain the exception in prose.
function moduleScopeGlobals(js) {
  const hits = [];
  const opens = [];
  for (const raw of js.split("\n")) {
    const line = raw.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
    const isFn = /\bfunction\b|=>/.test(line);
    const isComment = /^\s*(?:\/\/|\/\*|\*)/.test(raw);
    if (!isFn && !isComment && !opens.some(Boolean) && VENDOR_GLOBAL.test(line)) hits.push(line.trim());
    for (const c of line) {
      if (c === "{") opens.push(isFn);
      else if (c === "}") opens.pop();
    }
  }
  return hits;
}

// Relative or root-absolute only. "//host/x" is a network fetch, not a path.
const isLocalPath = (s) => s.startsWith(".") || (s.startsWith("/") && !s.startsWith("//"));
// CSS also allows inline data: URIs and same-document refs (filter: url(#n)).
const isLocalRef = (s) => isLocalPath(s) || s.startsWith("data:") || s.startsWith("#");

export function lintEffect(dir) {
  const name = basename(dir);
  const errs = [];
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);

  const metaRaw = read("meta.json");
  if (metaRaw === null) return [`${name}: meta.json missing`];
  let meta;
  try { meta = JSON.parse(metaRaw); } catch (e) { return [`${name}: meta.json invalid JSON (${e.message})`]; }
  errs.push(...validate(schema, meta).map((e) => `${name}: meta.json ${e}`));
  if (meta.name !== name) errs.push(`${name}: meta.name "${meta.name}" != directory name`);
  for (const key of meta.needs ?? []) {
    if (!(key in manifest)) errs.push(`${name}: needs "${key}", which vendor/manifest.json does not list`);
  }
  const ported = meta.origin?.repo !== "paw-fx";

  const snippet = read("snippet.html");
  if (snippet === null) errs.push(`${name}: snippet.html missing`);
  else {
    if (!/<style[\s>]/i.test(snippet) && !/<link[^>]*style\.css/i.test(snippet)) {
      errs.push(`${name}: snippet.html must contain <style> or <link ... style.css>`);
    }
    for (const [tag] of snippet.matchAll(/<script\b[^>]*>/gi)) {
      if (!/type\s*=\s*["']module["']/i.test(tag) || !/index\.js/.test(tag)) {
        errs.push(`${name}: snippet.html <script> must be type="module" importing index.js (resting state is CSS-only)`);
      }
    }
  }

  const js = read("index.js");
  if (js === null) errs.push(`${name}: index.js missing`);
  else {
    for (const spec of jsSpecifiers(js)) {
      if (!isLocalPath(spec)) errs.push(`${name}: bare-specifier import "${spec}" in index.js`);
    }
    for (const hit of moduleScopeGlobals(js)) {
      errs.push(`${name}: index.js reads a vendor global at module scope (\`${hit}\`); read it inside mount()`);
    }
    if (ported && !hasLicenceHeader(js)) {
      errs.push(`${name}: ported effect needs an upstream licence header comment in the first 20 lines of index.js`);
    }
  }

  const css = read("style.css");
  if (css === null) errs.push(`${name}: style.css missing`);
  else {
    for (const spec of specifiers(css, CSS_SPECIFIERS)) {
      if (!isLocalRef(spec)) errs.push(`${name}: non-local reference "${spec}" in style.css (a generated site fetches nothing off-site)`);
    }
  }
  if (!existsSync(join(dir, "preview.png"))) errs.push(`${name}: preview.png missing`);

  const own = [js, css, snippet].map((s) => s ?? "").join("\n");
  const gz = gzipSync(own).length;
  if (gz > SIZE_LIMIT) errs.push(`${name}: own code ${gz} B gzipped exceeds ${SIZE_LIMIT} B`);
  return errs;
}

// An underscore-prefixed directory is shared code, not an effect: effects/_shared/
// holds the one WebGL runtime the eight shader.gallery ports share, and it has no
// meta.json, snippet or preview to lint. Skipping it here also keeps it out of
// build() and smoke(), which both walk this list.
export function effectDirs(root = join(ROOT, "effects")) {
  return readdirSync(root)
    .filter((d) => !d.startsWith("_"))
    .map((d) => join(root, d))
    .filter((d) => statSync(d).isDirectory());
}

if (import.meta.main) {
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : effectDirs();
  const errs = dirs.flatMap(lintEffect);
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
  console.log(`lint ok: ${dirs.length} effect(s)`);
}
