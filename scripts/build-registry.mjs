// Builds dist/registry/ from effects/: registry.json (index) plus one
// items/<name>.json per effect carrying the files a site needs under _fx/.
// Layout inside a site mirrors the repo (_fx/effects/<name>/, _fx/vendor/), so
// the "../../vendor/<file>" imports in index.js resolve unchanged.
//
// A `needs` key maps to a LIST of files, not one file, via vendor/manifest.json.
// three ships two files and hard-codes the sibling path "./three.core.js", so
// neither may be renamed; paper is Apache-2.0 and its NOTICE has to travel with
// it (section 4(d)). So every entry's `files` and `licenseFiles` are emitted as
// _fx/vendor/<filename>. Errors if a manifest file is missing from vendor/, or
// if index.js imports anything but a vendor file belonging to a `needs` key.
// Dedup is per item, keyed by emitted path: items are standalone, so two
// effects sharing "three" each carry their own copy and there is no
// cross-item pass to look for.
//
// The import check reads index.js through lint's jsSpecifiers so build and lint
// see the same set of specifiers. They must not diverge: a form only one of
// them recognises is a shipped-broken item. Sharing it closes a live hole --
// `import "../../vendor/anime.esm.js"` with an empty `needs` used to pass lint
// (relative) and pass build (a side-effect import the from-only scan never
// saw), emitting an item whose vendor file was never written.
//
// vendorDir is a parameter so tests can build against stub vendor files while
// the real vendor/ is still empty. The manifest always comes from the repo, so
// tests exercise the shipped one rather than a copy that can drift.

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { effectDirs, jsSpecifiers } from "./lint.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(ROOT, "vendor/manifest.json"), "utf8"));
const OWNER = new Map(Object.entries(manifest).flatMap(([key, e]) => e.files.map((f) => [f, key])));

function version() {
  try { return execSync("git describe --tags --always", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return "0.0.0"; }
}

export function buildItem(dir, vendorDir = join(ROOT, "vendor")) {
  const name = basename(dir);
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  const read = (f) => readFileSync(join(dir, f), "utf8");
  const js = read("index.js");
  const files = new Map([
    [`_fx/effects/${name}/index.js`, js],
    [`_fx/effects/${name}/style.css`, read("style.css")],
  ]);
  const needs = meta.needs ?? [];
  for (const key of needs) {
    const entry = manifest[key];
    if (!entry) throw new Error(`${name}: needs "${key}", which vendor/manifest.json does not list`);
    for (const f of [...entry.files, ...entry.licenseFiles]) {
      const src = join(vendorDir, f);
      if (!existsSync(src)) throw new Error(`${name}: needs "${key}" but vendor/${f} is missing`);
      files.set(`_fx/vendor/${f}`, readFileSync(src, "utf8"));
    }
  }
  for (const spec of jsSpecifiers(js)) {
    const m = spec.match(/^\.\.\/\.\.\/vendor\/(.+)$/);
    if (!m) throw new Error(`${name}: import "${spec}" must be ../../vendor/<file> from vendor/manifest.json`);
    const key = OWNER.get(m[1]);
    if (!key) throw new Error(`${name}: imports vendor file "${m[1]}", which vendor/manifest.json does not list`);
    if (!needs.includes(key)) throw new Error(`${name}: imports vendor "${key}" not listed in needs`);
  }
  // Root-absolute, not "./": a site always sits at the origin root (an html Paw
  // Site is an assets-only Worker with assets.directory "."), and "./_fx/..."
  // breaks on any nested page such as /blog/post.html.
  const usage = [
    `<link rel="stylesheet" href="/_fx/effects/${name}/style.css">`,
    `<!-- place snippet.html markup where the section goes -->`,
    `<script type="module">import {mount} from '/_fx/effects/${name}/index.js'; document.querySelectorAll('[data-fx="${name}"]').forEach((el) => mount(el))</script>`,
  ].join("\n");
  const { version, category, summary, license, origin, options, tags } = meta;
  return {
    name, version, category, tags, summary, needs, license, origin, options,
    files: [...files].map(([path, content]) => ({ path, content })),
    snippet: read("snippet.html"),
    usage,
  };
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
