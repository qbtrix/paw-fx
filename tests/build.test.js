// Build contract: registry.json + items/aurora-css.json with the documented
// shape, the vendor check reading index.js through lint's scanner so a
// specifier form lint catches cannot slip past the build into a shipped item,
// and a `needs` key expanding to every file the manifest lists for it.
//
// The vendor cases build against tests/fixtures/vendor/ because the real
// vendor/ is still empty; the manifest they resolve through is the shipped one,
// so a filename that drifts breaks these tests rather than a generated site.
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { build, buildItem } from "../scripts/build-registry.mjs";

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
  for (const k of ["name", "version", "category", "summary", "needs", "license", "origin", "options", "files", "snippet", "usage"]) {
    expect(item).toHaveProperty(k);
  }
  expect(item.files.map((f) => f.path)).toEqual([
    "_fx/effects/aurora-css/index.js",
    "_fx/effects/aurora-css/style.css",
  ]);
  expect(item.usage.split("\n")).toHaveLength(3);
});

// Root-absolute, because a site always sits at the origin root and "./_fx/..."
// breaks on a nested page; querySelectorAll, because scroll, text and cursor
// effects routinely appear several times on one page.
test("usage is root-absolute and mounts every matching section", () => {
  const item = buildItem(fx("effects/aurora-css"));
  expect(item.usage).toContain('href="/_fx/effects/aurora-css/style.css"');
  expect(item.usage).toContain("from '/_fx/effects/aurora-css/index.js'");
  expect(item.usage).toContain("document.querySelectorAll('[data-fx=\"aurora-css\"]').forEach((el) => mount(el))");
  expect(item.usage).not.toContain("./_fx/");
  expect(item.usage).not.toContain("querySelector(");
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
