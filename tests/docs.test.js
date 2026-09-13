// The agent-facing surface. It is generated from the registry rather than
// written, so what these check is that the generation cannot quietly drop
// something: an effect missing from the index, a shelf with no heading, a
// page without the markup someone would actually paste.
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build } from "../scripts/build-registry.mjs";
import { buildDocs, effectPage } from "../scripts/build-docs.mjs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const out = mkdtempSync(join(tmpdir(), "paw-fx-docs-"));
const registry = build(out);
const BASE = "https://example.test/registry";
const result = buildDocs(out, BASE);

test("every effect reaches the index and has a page", () => {
  const index = readFileSync(join(out, "llms.txt"), "utf8");
  expect(result.effects).toBe(registry.items.length);
  for (const it of registry.items) {
    expect(index).toContain(`[${it.name}](${BASE}/e/${it.name}.md)`);
    expect(existsSync(join(out, "e", `${it.name}.md`))).toBe(true);
  }
});

test("a shelf with no heading would still list its effects", () => {
  // The index groups by a hand-written label map. A category added to
  // meta.schema.json and not to that map used to vanish from the index with
  // no error, which is the kind of omission nobody notices for months.
  const index = readFileSync(join(out, "llms.txt"), "utf8");
  const shelves = new Set(registry.items.map((i) => i.category));
  expect(result.shelves).toBe(shelves.size);
  const listed = [...index.matchAll(/^- \[([a-z0-9-]+)\]/gm)].map((m) => m[1]);
  expect(new Set(listed).size).toBe(registry.items.length);
});

test("a page carries what someone would actually paste", () => {
  const item = JSON.parse(readFileSync(join(out, "items", "paw-avatar.json"), "utf8"));
  const page = effectPage(item, BASE);
  expect(page).toContain("# paw-avatar");
  expect(page).toContain(item.usage);
  expect(page).toContain(item.snippet.trim());
  for (const f of item.files) expect(page).toContain(f.path);
  expect(page).toContain(`npx shadcn@latest add ${BASE}/items/paw-avatar.json`);
  // a ported effect says where it came from, on the page and not only in JSON
  expect(page).toContain("jeremy-prt/bloub");
});

test("items are installable by a shadcn client", () => {
  const item = JSON.parse(readFileSync(join(out, "items", "paw-avatar.json"), "utf8"));
  expect(item.$schema).toContain("registry-item.json");
  expect(item.type).toBe("registry:item");
  expect(item.description).toBe(item.summary);
  for (const f of item.files) {
    expect(f.type).toBe("registry:file");
    // assets a page links at /_fx/..., so they belong under public/
    expect(f.target).toBe(`public/${f.path}`);
  }
});

test("llms-full carries every page, for one fetch instead of ninety-nine", () => {
  const full = readFileSync(join(out, "llms-full.txt"), "utf8");
  for (const it of registry.items) expect(full).toContain(`# ${it.name}\n`);
});
