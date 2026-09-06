// Build contract: registry.json + items/aurora-css.json with the documented
// shape, and the vendor check reading index.js through lint's scanner, so a
// specifier form lint catches cannot slip past the build into a shipped item.
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { build, buildItem } from "../scripts/build-registry.mjs";

const out = new URL("../dist/registry", import.meta.url).pathname;
const fx = (p) => new URL(`../${p}`, import.meta.url).pathname;

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
  expect(item.usage).toContain("mount(document.querySelector('[data-fx=\"aurora-css\"]'))");
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
