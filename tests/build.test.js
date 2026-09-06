// Build contract: registry.json + items/aurora-css.json with the documented shape.
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { build } from "../scripts/build-registry.mjs";

const out = new URL("../dist/registry", import.meta.url).pathname;

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
