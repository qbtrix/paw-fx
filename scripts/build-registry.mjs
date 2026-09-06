// Builds dist/registry/ from effects/: registry.json (index) plus one
// items/<name>.json per effect carrying the files a site needs under _fx/.
// Layout inside a site mirrors the repo (_fx/effects/<name>/, _fx/vendor/), so
// the "../../vendor/<key>.js" imports in index.js resolve unchanged.
// Errors if an effect's `needs` names a vendor file that is not in vendor/, or
// if index.js imports anything but ../../vendor/<key>.js.
//
// That last check reads index.js through lint's jsSpecifiers so build and lint
// see the same set of specifiers. They must not diverge: a form only one of
// them recognises is a shipped-broken item. Sharing it closes a live hole --
// `import "../../vendor/anime.js"` with an empty `needs` used to pass lint
// (relative) and pass build (a side-effect import the from-only scan never
// saw), emitting an item whose vendor file was never written.

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { effectDirs, jsSpecifiers } from "./lint.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

function version() {
  try { return execSync("git describe --tags --always", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return "0.0.0"; }
}

export function buildItem(dir) {
  const name = basename(dir);
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  const read = (f) => readFileSync(join(dir, f), "utf8");
  const files = [
    { path: `_fx/effects/${name}/index.js`, content: read("index.js") },
    { path: `_fx/effects/${name}/style.css`, content: read("style.css") },
  ];
  for (const key of meta.needs ?? []) {
    const src = join(ROOT, "vendor", `${key}.js`);
    if (!existsSync(src)) throw new Error(`${name}: needs "${key}" but vendor/${key}.js is missing`);
    files.push({ path: `_fx/vendor/${key}.js`, content: readFileSync(src, "utf8") });
  }
  for (const spec of jsSpecifiers(files[0].content)) {
    const m = spec.match(/^\.\.\/\.\.\/vendor\/([^/]+)\.js$/);
    if (!m) throw new Error(`${name}: import "${spec}" must be ../../vendor/<key>.js`);
    if (!(meta.needs ?? []).includes(m[1])) throw new Error(`${name}: imports vendor "${m[1]}" not listed in needs`);
  }
  const usage = [
    `<link rel="stylesheet" href="./_fx/effects/${name}/style.css">`,
    `<!-- place snippet.html markup where the section goes -->`,
    `<script type="module">import {mount} from './_fx/effects/${name}/index.js'; mount(document.querySelector('[data-fx="${name}"]'))</script>`,
  ].join("\n");
  const { version, category, summary, needs, license, origin, options, tags } = meta;
  return { name, version, category, tags, summary, needs, license, origin, options, files, snippet: read("snippet.html"), usage };
}

export function build(out = join(ROOT, "dist/registry")) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "items"), { recursive: true });
  const items = effectDirs().map(buildItem);
  for (const it of items) writeFileSync(join(out, "items", `${it.name}.json`), JSON.stringify(it, null, 2));
  const registry = {
    version: version(),
    generatedAt: new Date().toISOString(),
    items: items.map(({ name, category, tags, summary, needs, license }) => ({ name, category, tags, summary, needs, license })),
  };
  writeFileSync(join(out, "registry.json"), JSON.stringify(registry, null, 2));
  return registry;
}

if (import.meta.main) {
  const r = build();
  console.log(`built ${r.items.length} item(s) -> dist/registry (${r.version})`);
}
