// Builds dist/registry/ from effects/: registry.json (index), one
// items/<name>.json per effect carrying the files a site needs under _fx/, and
// previews/<name>.png beside them.
//
// 2026-09-08: an item is now ENGINE-AGNOSTIC. Identity (name, kind, licence,
// origin, options) and `files` stay top level because the effect's own code is
// the same on every engine; delivery moved under `targets.<engine>`, and the
// svelte target is generated from mount(). See "targets" below and the
// "Targets and engines" section of README.md.
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

// ---------------------------------------------------------------- targets
// ENGINE-AGNOSTIC SHAPE. An item's IDENTITY is engine-neutral -- name, kind,
// licence, origin, options, preview, and the `files` that make up the effect
// itself -- while DELIVERY differs per engine. So `files` stays top level (the
// mount() core is the same code on every engine) and `targets.<engine>` carries
// only what that engine needs to USE it: html gets the section markup, svelte
// gets a component. One entry, several formats, which is what keeps one product
// from becoming three listings once the registry carries other people's work.
//
// THE SVELTE TARGET IS GENERATED, NOT HAND-WRITTEN. mount(el, opts) ->
// {update, destroy} is already the portable core, so the wrapper is the same
// shape for all 98: mount on mount, update when props change, destroy on
// teardown. Nothing about the effect is rewritten -- the component imports the
// very same index.js and style.css the html target ships.
//
// WHAT IS DELIBERATELY NOT DONE: `needs` is not resolved to npm packages for
// build-step engines. It could be (vendor/manifest.json already records
// `package` and `version` for every key), but tsparticles assigns its exports
// to globalThis rather than exporting them, so the rewrite is not mechanical
// for all five keys. The svelte target therefore ships the same self-contained
// vendor files the html target does. Correct everywhere, heavier than it needs
// to be on a bundler; revisit when a real Svelte site consumes this.
const pascal = (name) => name.split(/[^a-z0-9]+/i).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

// Svelte parses { and } in a template as an expression delimiter, and ten of the
// snippets carry literal braces inside ASCII-art grids. The entities render
// identically and never reach the expression parser.
const svelteEscape = (html) => html.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

// The stylesheet <link> is html-engine delivery: a Svelte component imports the
// css instead. Every snippet carries exactly one, on its own line.
const stripStylesheetLink = (html) => html.replace(/^[ \t]*<link\b[^>]*>[ \t]*\r?\n?/m, "");

export function svelteComponent(name, snippet) {
  const markup = svelteEscape(stripStylesheetLink(snippet).trim())
    .split("\n").map((l) => (l.trim() ? "  " + l : l)).join("\n");
  const tag = pascal(name);
  return `<!-- ${tag}.svelte -- GENERATED from effects/${name}/snippet.html by
     scripts/build-registry.mjs. Do not edit by hand; it is rewritten on every
     \`bun run build\`. The effect's own index.js and style.css are imported
     unchanged, so this wrapper adds a Svelte lifecycle and nothing else. The
     markup below is the same resting section the html target ships, so the
     component is finished at rest before mount() ever runs. -->
<script>
  import { onMount } from "svelte";
  import { mount } from "./index.js";
  import "./style.css";

  const opts = $props();

  let root;
  let handles = [];

  onMount(() => {
    // querySelectorAll, NOT querySelector: the html target's usage mounts EVERY
    // matching section, and cursor-spotlight ships three cards under one
    // snippet. Mounting only the first left two of its three cards dead in
    // Svelte while the html target ran all three, which is a divergence the
    // component still renders and still compiles through.
    const found = root.querySelectorAll('[data-fx="${name}"]');
    const els = found.length ? [...found] : [root];
    handles = els.map((el) => mount(el, opts));
    return () => { for (const h of handles) h?.destroy?.(); handles = []; };
  });

  // Props changing is the engine-native equivalent of calling update().
  $effect(() => { const next = { ...opts }; for (const h of handles) h?.update?.(next); });
</script>

<!-- display:contents so the wrapper carries the ref without entering layout. -->
<div bind:this={root} style="display:contents">
${markup}
</div>
`;
}

function svelteTarget(name, snippet) {
  const tag = pascal(name);
  return {
    files: [{ path: `_fx/effects/${name}/${tag}.svelte`, content: svelteComponent(name, snippet) }],
    usage: [
      `<script>`,
      `  import ${tag} from "$lib/_fx/effects/${name}/${tag}.svelte";`,
      `</` + `script>`,
      ``,
      `<${tag} />`,
    ].join("\n"),
  };
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
  const { version, category, summary, license, origin, options, tags, deviations, kind } = meta;
  const snippet = read("snippet.html");
  // Two audiences, one item. The shadcn fields ($schema, type, title,
  // description, per-file type/target) make this same file installable with
  // `npx shadcn add <url>`; `target` puts the files under public/ because they
  // are assets a page links at /_fx/..., not modules anything imports. The
  // engine split (kind, engines, targets) keeps identity and files[] neutral
  // and puts per-engine delivery under targets.<engine>. Nothing about
  // delivery lives at the top level any more; readers go through targets.
  // html carries the section markup and the hand-written demo pages; svelte
  // carries a component. Both drive the SAME files[] above.
  // A vendor key that publishes onto globalThis instead of exporting cannot
  // survive a bundler: measured, not assumed. The vendored tsParticles bundle
  // DOES execute under Vite (globalThis.__tsParticlesInternals is set) but
  // never publishes `tsParticles`/`loadSlim`, because its UMD branch resolves
  // to the module exports rather than the browser global. The effects then hit
  // their own `if (!engine || !loadSlim) return` guard and silently do nothing:
  // the section still renders at rest, still throws no error, still passes a
  // "did it mount" check, and is dead. So those effects do not CLAIM svelte.
  // That is the point of engines[] -- it is a promise, and a target that
  // cannot run is worse than an absent one.
  const bundlerSafe = needs.every((k) => !manifest[k]?.publishesGlobals);
  const targets = {
    html: { files: [], snippet, usage, demo },
    ...(bundlerSafe ? { svelte: svelteTarget(name, snippet) } : {}),
  };
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name, type: "registry:item", title: name, description: summary,
    // `kind` defaults to "effect" so no existing meta.json had to change.
    version, kind: kind ?? "effect", category, tags, summary, needs, license, origin, options,
    deviations: deviations ?? [],
    files: [...files].map(([path, content]) => ({
      path, content, type: "registry:file", target: `public/${path}`
    })),
    engines: Object.keys(targets),
    targets,
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
    items: items.map(({ name, kind, category, tags, summary, needs, license, engines }) => ({ name, kind, category, tags, summary, needs, license, engines })),
  };
  writeFileSync(join(out, "registry.json"), JSON.stringify(registry, null, 2));
  return registry;
}

if (import.meta.main) {
  const r = build();
  console.log(`built ${r.items.length} item(s) -> dist/registry (${r.version})`);
}
