// Lints every effect under effects/ (or the dirs passed as argv) against the
// paw-fx effect contract: meta.json schema, licence allow-list + origin,
// snippet.html resting-state rules, no bare-specifier imports in index.js,
// gzipped own-code size <= 60 KB, upstream licence header for ported code.
// Prints "<effect>: <reason>" per failure and exits 1 if any.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { gzipSync } from "node:zlib";
import { validate } from "./validate.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(ROOT, "schema/meta.schema.json"), "utf8"));
const SIZE_LIMIT = 60 * 1024;

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
    for (const [, spec] of js.matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)) {
      if (!spec.startsWith(".") && !spec.startsWith("/")) errs.push(`${name}: bare-specifier import "${spec}" in index.js`);
    }
    if (ported && !/Copyright|License/i.test(js.split("\n").slice(0, 20).join("\n"))) {
      errs.push(`${name}: ported effect needs an upstream licence header in the first 20 lines of index.js`);
    }
  }

  if (read("style.css") === null) errs.push(`${name}: style.css missing`);
  if (!existsSync(join(dir, "preview.png"))) errs.push(`${name}: preview.png missing`);

  const own = ["index.js", "style.css", "snippet.html"].map((f) => read(f) ?? "").join("\n");
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
