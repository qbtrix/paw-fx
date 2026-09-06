// Lints every effect under effects/ (or the dirs passed as argv) against the
// paw-fx effect contract: meta.json schema, licence allow-list + origin,
// snippet.html resting-state rules, self-contained references in index.js and
// style.css, gzipped own-code size <= 60 KB, upstream licence header for
// ported code. Prints "<effect>: <reason>" per failure and exits 1 if any.
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

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { gzipSync } from "node:zlib";
import { validate } from "./validate.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(ROOT, "schema/meta.schema.json"), "utf8"));
const SIZE_LIMIT = 60 * 1024;

// `[^;()=]*?` holds the binding scan inside one statement -- an import's
// binding list contains none of those three characters, a statement after it
// hits one almost immediately -- which is what lets these stay off the line
// anchor and still match multi-line import lists.
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
    if (ported && !/Copyright|License/i.test(js.split("\n").slice(0, 20).join("\n"))) {
      errs.push(`${name}: ported effect needs an upstream licence header in the first 20 lines of index.js`);
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

export function effectDirs(root = join(ROOT, "effects")) {
  return readdirSync(root).map((d) => join(root, d)).filter((d) => statSync(d).isDirectory());
}

if (import.meta.main) {
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : effectDirs();
  const errs = dirs.flatMap(lintEffect);
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
  console.log(`lint ok: ${dirs.length} effect(s)`);
}
