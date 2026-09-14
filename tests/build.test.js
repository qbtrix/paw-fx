// Build contract: registry.json + items/aurora-css.json with the documented
// shape, previews/<name>.png copied beside them, the vendor check reading
// index.js through lint's scanner so a specifier form lint catches cannot slip
// past the build into a shipped item, and a `needs` key expanding to every file
// the manifest lists for it.
//
// `deviations` and the copied preview are asserted here because dist/registry/
// is the whole of what a consumer sees: the MCP server and the gallery both
// read it and never the effects/ tree, so anything missing from an item is
// missing from the product.
//
// `demo` is asserted for the same reason and kept OUT of `files` on purpose:
// files[] is what a site-building agent writes into a client site, and a sample
// page about a fictional company does not belong there. The gallery's demo
// builder is the one consumer that wants it. tests/gallery.test.js covers the
// populated case (page-fade); the empty-list case is here, because every other
// effect has to carry the key rather than omit it.
//
// The vendor cases build against tests/fixtures/vendor/ rather than the real
// vendor/, which is now populated: the stub dir is missing the tsparticles
// bundle on purpose, so the missing-file case below stays a real assertion
// instead of one that passes only while a directory happens to be empty. The
// manifest they resolve through is always the shipped one, so a filename that
// drifts breaks these tests rather than a generated site.
//
// vendor/ having contents is covered separately, in tests/vendor.test.js.
//
// The last three tests cover the two paths the shader.gallery ports added: a
// `shader.frag` emitted beside index.js, and `../_shared/<file>` -- paw-fx's own
// code shared between effects, with no manifest key behind it. Both have to
// reach a site at the path their relative reference resolves to, and a shared
// file that imports something else is refused rather than emitted half-built.
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { build, buildItem, svelteComponent } from "../scripts/build-registry.mjs";
import { effectDirs } from "../scripts/lint.mjs";

const out = new URL("../dist/registry", import.meta.url).pathname;
const fx = (p) => new URL(`../${p}`, import.meta.url).pathname;
const stubVendor = fx("tests/fixtures/vendor");

test("build emits registry and aurora-css item", () => {
  const reg = build(out);
  expect(reg.items.map((i) => i.name)).toContain("aurora-css");
  expect(typeof reg.version).toBe("string");
  expect(reg.generatedAt).toMatch(/^\d{4}-/);
  const p = `${out}/items/aurora-css.json`;
  expect(existsSync(p)).toBe(true);
  const item = JSON.parse(readFileSync(p, "utf8"));
  for (const k of ["name", "kind", "version", "category", "summary", "needs", "license", "origin", "options", "deviations", "files", "engines", "targets"]) {
    expect(item).toHaveProperty(k);
  }
  // An effect with no deviations still carries the key, so a consumer (the
  // gallery, the MCP server) reads a list either way rather than branching.
  expect(Array.isArray(item.deviations)).toBe(true);
  // Same for `demo`: aurora-css has no hand-written demo pages, so the key is
  // an empty list, never absent.
  expect(item.targets.html.demo).toEqual([]);
  expect(existsSync(`${out}/previews/aurora-css.png`)).toBe(true);
  expect(item.files.map((f) => f.path)).toEqual([
    "_fx/effects/aurora-css/index.js",
    "_fx/effects/aurora-css/style.css",
  ]);
  expect(item.targets.html.usage.split("\n")).toHaveLength(3);
});

// Root-absolute, because a site always sits at the origin root and "./_fx/..."
// breaks on a nested page; querySelectorAll, because scroll, text and cursor
// effects routinely appear several times on one page.
test("usage is root-absolute and mounts every matching section", () => {
  const item = buildItem(fx("effects/aurora-css"));
  expect(item.targets.html.usage).toContain('href="/_fx/effects/aurora-css/style.css"');
  expect(item.targets.html.usage).toContain("from '/_fx/effects/aurora-css/index.js'");
  expect(item.targets.html.usage).toContain("document.querySelectorAll('[data-fx=\"aurora-css\"]').forEach((el) => mount(el))");
  expect(item.targets.html.usage).not.toContain("./_fx/");
  expect(item.targets.html.usage).not.toContain("querySelector(");
});

// A side-effect import of a vendor file is relative, so lint passes it; only
// the build can catch the missing `needs` entry, and only now that it scans
// the same forms lint does. The old from-only scan never saw this specifier
// and emitted an item whose vendor file was never written.
test("build catches a vendor import that needs omits", () => {
  expect(() => buildItem(fx("tests/fixtures/bad-vendor-unlisted"))).toThrow(
    'imports vendor "anime" not listed in needs',
  );
});

// A3: the header shape the incoming port wave will carry. The build must read
// the import on the next line and not the "three.js" inside the comment.
// B1: "three" is one key over two files, plus the licence file that has to
// travel with them.
test("a ported effect with a header comment builds and emits every vendor file", () => {
  const item = buildItem(fx("tests/fixtures/good-ported-header"), stubVendor);
  expect(item.files.map((f) => f.path)).toEqual([
    "_fx/effects/good-ported-header/index.js",
    "_fx/effects/good-ported-header/style.css",
    "_fx/vendor/three.module.js",
    "_fx/vendor/three.core.js",
    "_fx/vendor/three.LICENSE",
  ]);
  expect(item.files.find((f) => f.path === "_fx/vendor/three.core.js").content).toContain("Scene");
});

// Deliberately built against the stub dir, which has no tsparticles file, so
// this stays true once the real vendor/ is populated. Pointing it at the real
// vendor/ instead would pass only while that directory is empty and would go
// red on the vendoring task's first commit.
test("a manifest file missing from vendor/ is a clear error", () => {
  expect(() => buildItem(fx("tests/fixtures/good-vendor-global"), stubVendor)).toThrow(
    'needs "tsparticles" but vendor/tsparticles.slim.bundle.min.js is missing',
  );
});

// The shape the shader.gallery ports carry: GLSL as its own file beside
// index.js, and one runtime shared out of effects/_shared/. Both have to reach
// a site, at the paths the relative references resolve to inside it -- the
// import is "../_shared/<file>" from _fx/effects/<name>/, and the .frag is
// fetched from "./shader.frag" -- or the item ships broken with no build step
// to catch it.
test("an effect with shader.frag and a shared import emits both", () => {
  const item = buildItem(fx("tests/fixtures/good-shared-frag"));
  expect(item.files.map((f) => f.path)).toEqual([
    "_fx/effects/good-shared-frag/index.js",
    "_fx/effects/good-shared-frag/style.css",
    "_fx/effects/good-shared-frag/shader.frag",
    "_fx/effects/_shared/stub-mount.js",
  ]);
  expect(item.files.find((f) => f.path.endsWith("shader.frag")).content).toContain("gl_FragColor");
});

// One level deep only. A shared file that imports something else would need a
// graph walk to emit, and refusing it is better than emitting an item whose
// transitive file is missing -- which is the same hole the vendor scan closed.
test("a shared file that is not self-contained is refused", () => {
  expect(() => buildItem(fx("tests/fixtures/bad-shared-chain"))).toThrow(
    "shared files must be self-contained",
  );
});

// effects/_shared/ is code, not an effect: it has no meta.json, snippet or
// preview, so walking it would fail lint, build and smoke at once.
test("effectDirs skips underscore-prefixed directories", () => {
  const dirs = effectDirs().map((d) => d.split("/").pop());
  expect(dirs).toContain("mesh-gradient");
  expect(dirs.some((d) => d.startsWith("_"))).toBe(false);
});

// ---------------------------------------------------------------- targets
// The engine-agnostic shape. Identity (name, kind, licence, origin, options)
// and `files` are neutral; `targets.<engine>` carries only delivery. These
// assert the split holds, because the whole point of the shape is that a
// consumer can ask for an engine and a second engine can be added without
// touching the effects tree.
test("an item splits neutral identity from per-engine delivery", () => {
  const item = buildItem(fx("effects/aurora-css"));
  expect(item.kind).toBe("effect");                      // defaulted, not in meta.json
  expect(item.engines).toEqual(Object.keys(item.targets));
  expect(item.engines).toEqual(["html", "svelte"]);
  // Delivery lives under a target, never at the top level, or a consumer
  // cannot tell which engine it is holding.
  for (const k of ["snippet", "usage", "demo"]) expect(item).not.toHaveProperty(k);
  expect(item.targets.html.snippet).toContain('data-fx="aurora-css"');
  expect(item.targets.svelte.files[0].path).toBe("_fx/effects/aurora-css/AuroraCss.svelte");
});

// The svelte target is generated from mount(), so the wrapper must actually
// wire the three lifecycle points. A component that renders markup but never
// mounts would still compile and would be silently dead.
test("the generated svelte component wires mount, update and destroy", () => {
  const c = svelteComponent("aurora-css", '<link rel="stylesheet" href="/x.css">\n<section data-fx="aurora-css">hi</section>');
  expect(c).toContain('import { mount } from "./index.js"');
  expect(c).toContain('import "./style.css"');
  expect(c).toContain('root.querySelectorAll(\'[data-fx="aurora-css"]\')');
  expect(c).toContain("h?.destroy?.()");
  expect(c).toContain("h?.update?.");
  expect(c).toContain("bind:this={root}");
  // The stylesheet link is html delivery; a component imports the css instead.
  expect(c).not.toContain("<link");
  expect(c).toContain("<section data-fx=\"aurora-css\">hi</section>");
});

// REGRESSION. Svelte reads { } in a template as an expression delimiter, and
// ten of the 98 snippets carry literal braces inside ASCII-art grids. Raw
// embedding fails to compile on exactly those ten, which is the kind of bug
// that ships green because the other 88 are fine.
test("literal braces in snippet markup are escaped, not left to the parser", () => {
  const c = svelteComponent("ascii", '<link rel="stylesheet" href="/x.css">\n<pre data-fx="ascii">{a}|}{b</pre>');
  expect(c).toContain("&#123;a&#125;|&#125;&#123;b");
  // The only braces left in the markup half are the ones we wrote (bind:this).
  const markup = c.slice(c.indexOf("</scr" + "ipt>"));
  expect(markup).not.toContain("{a}");
});

// engines[] is a PROMISE, not a label. This is the invariant behind it, keyed
// off the manifest rather than a hardcoded list of names, so adding another
// globals-publishing vendor key cannot quietly ship five more dead targets.
//
// FOUND BY RENDERING, NOT BY COMPILING. The five tsParticles effects compiled
// clean, mounted clean, rendered a correctly sized section and reported no
// error, and did nothing at all: the vendored bundle executes under Vite but
// never publishes `tsParticles`/`loadSlim` onto globalThis, so each effect hits
// its own `if (!engine || !loadSlim) return` guard and no-ops.
test("svelte is claimed only where a bundler can actually run it", () => {
  const manifest = JSON.parse(readFileSync(fx("vendor/manifest.json"), "utf8"));
  const globalKeys = Object.entries(manifest).filter(([, v]) => v.publishesGlobals).map(([k]) => k);
  expect(globalKeys).toEqual(["tsparticles"]);

  const htmlOnly = [];
  for (const dir of effectDirs()) {
    const item = buildItem(dir);
    // html is universal: every effect ships it.
    expect(item.engines[0]).toBe("html");
    expect(item.targets.html.snippet.length).toBeGreaterThan(0);

    const usesGlobals = item.needs.some((k) => globalKeys.includes(k));
    expect(item.engines.includes("svelte")).toBe(!usesGlobals);
    if (usesGlobals) {
      htmlOnly.push(item.name);
      // Absent, not empty: a consumer asking for an engine gets nothing back
      // rather than an object that looks usable.
      expect(item.targets.svelte).toBeUndefined();
    } else {
      expect(item.targets.svelte.files).toHaveLength(1);
    }
  }
  expect(htmlOnly.sort()).toEqual(["bokeh-drift", "confetti-burst", "links-network", "snow-fall", "starfield"]);
});

// REGRESSION. cursor-spotlight ships THREE data-fx cards under one snippet and
// the html usage mounts every one of them. The first svelte wrapper used
// querySelector and mounted only the first, leaving two cards dead -- a
// divergence that compiles, renders, and passes a "did it mount" check.
test("the svelte wrapper mounts every matching section, not just the first", () => {
  const item = buildItem(fx("effects/cursor-spotlight"));
  const c = item.targets.svelte.files[0].content;
  expect(c).toContain('querySelectorAll(\'[data-fx="cursor-spotlight"]\')');
  expect(c).not.toContain("querySelector('[data-fx");
  // The html target really does mount all of them, which is what we match.
  expect(item.targets.html.usage).toContain("querySelectorAll");
  expect((item.targets.html.snippet.match(/data-fx="cursor-spotlight"/g) ?? []).length).toBe(3);
});
