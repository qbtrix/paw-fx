// Builds dist/registry/ from effects/: registry.json (index), one
// items/<name>.json per effect carrying the files a site needs under _fx/, and
// previews/<name>.png beside them.
// Layout inside a site mirrors the repo (_fx/effects/<name>/, _fx/vendor/), so
// the "../../vendor/<file>" imports in index.js resolve unchanged.
//
// An item carries `deviations` and the build copies `preview.png` because
// dist/registry/ is the whole of what a consumer sees: the MCP server serves it,
// and scripts/build-gallery.mjs reads it and nothing else. Both were in
// effects/ only, which meant the two questions a human asks before trusting an
// effect -- what does it look like, and where does it depart from upstream --
// could not be answered from the registry at all. An effect with no preview.png
// is copied over silently rather than failing the build: previews are a
// presentation asset, not part of the contract lint gates.
//
// Two things travel beside index.js and style.css when they exist:
//   - effects/<name>/shader.frag, the upstream GLSL kept as its own file so a
//     port-fidelity gate can diff it against upstream byte for byte.
//   - effects/_shared/<file>, paw-fx's own code shared between effects
//     (the WebGL runtime the shader.gallery ports share). It has no manifest
//     key, must be self-contained, and is copied into every item that imports
//     it, because items are standalone.
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
// vendorDir is a parameter so tests can build against stub vendor files rather
// than the populated vendor/. The manifest always comes from the repo, so tests
// exercise the shipped one rather than a copy that can drift. Because it is an
// optional second parameter, build() must call buildItem through an arrow and
// never pass it straight to .map(), which supplies the index as arg two.
//
// An item also carries `demo`: the hand-written pages under effects/<name>/demo/,
// for an effect that one page cannot show. It is a SEPARATE key from `files`,
// not another entry in it, and the split is the whole point -- `files` is what a
// site-building agent writes into a client site, and a sample page about a
// fictional company does not belong there, while the gallery's demo builder does
// want it. The emitted path mirrors the repo (_fx/effects/<name>/demo/<file>),
// so the "../style.css" those pages already use resolves with no rewriting.

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
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
  // The eight shader.gallery ports keep their GLSL as the upstream file itself,
  // byte for byte, and fetch it beside index.js rather than pasting it into a
  // template literal. One of them (lull) has a backtick in a comment, and more
  // to the point a standalone .frag is what a port-fidelity gate can diff
  // against upstream directly instead of extracting a literal out of JS.
  if (existsSync(join(dir, "shader.frag"))) {
    files.set(`_fx/effects/${name}/shader.frag`, read("shader.frag"));
  }
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
    // effects/_shared/<file> is paw-fx's own code shared between effects, not a
    // vendored library, so it has no manifest key. Items stay standalone: each
    // one carries its own copy of the shared file.
    const shared = spec.match(/^\.\.\/_shared\/([\w.-]+)$/);
    if (shared) {
      const src = join(dir, "..", "_shared", shared[1]);
      if (!existsSync(src)) throw new Error(`${name}: imports "${spec}", which does not exist`);
      const sharedJs = readFileSync(src, "utf8");
      // One level deep only. A shared file that imports something else would
      // need a graph walk here, and nothing needs that yet.
      for (const s of jsSpecifiers(sharedJs)) {
        throw new Error(`${name}: _shared/${shared[1]} imports "${s}"; shared files must be self-contained`);
      }
      files.set(`_fx/effects/_shared/${shared[1]}`, sharedJs);
      continue;
    }
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
  // page-fade's fade is a NAVIGATION between two documents, so no single page
  // can show it and the effect ships the pair by hand. Any effect may.
  const demoDir = join(dir, "demo");
  const demo = existsSync(demoDir)
    ? readdirSync(demoDir)
        .filter((f) => f.endsWith(".html"))
        .sort()
        .map((f) => ({ path: `_fx/effects/${name}/demo/${f}`, content: readFileSync(join(demoDir, f), "utf8") }))
    : [];
  const { version, category, summary, license, origin, options, tags, deviations } = meta;
  // `$schema`, `type`, `title`, `description` and the per-file `type`/`target`
  // are what make this same file installable with `npx shadcn add <url>`.
  // They are additive: the fields paw-fx's own consumers read are untouched,
  // and one item serves both rather than there being two registries to keep
  // honest. `target` puts the files under public/, because they are assets a
  // page links at /_fx/..., not modules anything imports.
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name, type: "registry:item", title: name, description: summary,
    version, category, tags, summary, needs, license, origin, options,
    deviations: deviations ?? [],
    files: [...files].map(([path, content]) => ({
      path, content, type: "registry:file", target: `public/${path}`
    })),
    demo,
    snippet: read("snippet.html"),
    usage,
  };
}

export function build(out = join(ROOT, "dist/registry")) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "items"), { recursive: true });
  mkdirSync(join(out, "previews"), { recursive: true });
  // Not `.map(buildItem)`: map passes (element, index, array), so the index
  // lands in vendorDir and every vendor path resolves against a number. That
  // was invisible while every effect had `needs: []` -- vendorDir is only read
  // when a key has files to emit -- and fired on the first effect with a
  // dependency. The arrow is what keeps the default parameter reachable.
  const dirs = effectDirs();
  const items = dirs.map((dir) => buildItem(dir));
  for (const it of items) writeFileSync(join(out, "items", `${it.name}.json`), JSON.stringify(it, null, 2));
  for (const dir of dirs) {
    const png = join(dir, "preview.png");
    if (existsSync(png)) copyFileSync(png, join(out, "previews", `${basename(dir)}.png`));
  }
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
