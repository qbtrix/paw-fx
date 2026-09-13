// The agent-facing surface. It is generated from the registry rather than
// written, so what these check is that the generation cannot quietly drop
// something: an effect missing from the index, a shelf with no heading, a
// page without the markup someone would actually paste.
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build } from "../scripts/build-registry.mjs";
import { buildDocs, effectPage } from "../scripts/build-docs.mjs";
import { buildGallery } from "../scripts/build-gallery.mjs";
import { buildSite } from "../scripts/build-site.mjs";
import { artFromSvg, artBlock } from "../scripts/art-from-svg.mjs";
import { restingMarkup } from "../effects/paw-avatar/index.js";
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

test("the deployed surface serves text as text, and lets a browser read it", () => {
  // Cloudflare serves .md and .txt as octet-stream by default, which makes a
  // browser download llms.txt rather than show it. CORS is open because a
  // browser-side tool has no other way in.
  const headers = readFileSync(join(out, "_headers"), "utf8");
  expect(headers).toContain("Access-Control-Allow-Origin: *");
  expect(headers).toContain("text/markdown");
  expect(headers).toContain("text/plain");
});

test("every generated link is absolute", () => {
  // A relative link is useless to an agent reading this in a chat window.
  const index = readFileSync(join(out, "llms.txt"), "utf8");
  for (const [, href] of index.matchAll(/\]\(([^)]+)\)/g)) {
    expect(href.startsWith("http")).toBe(true);
  }
});

test("llms-full carries every page, for one fetch instead of ninety-nine", () => {
  const full = readFileSync(join(out, "llms-full.txt"), "utf8");
  for (const it of registry.items) expect(full).toContain(`# ${it.name}\n`);
});

test("the served site puts the gallery where its own links expect it", () => {
  // The gallery links /_fx/... root-absolute, as a real site does. Served
  // under a prefix every one of those misses, which is why the site is
  // assembled rather than the gallery being rewritten.
  const site = mkdtempSync(join(tmpdir(), "paw-fx-site-"));
  buildGallery(out);
  buildSite(out, site);
  expect(existsSync(join(site, "index.html"))).toBe(true);
  expect(existsSync(join(site, "_fx"))).toBe(true);
  // and the machine surface is beside it, not under it
  for (const f of ["llms.txt", "registry.json", "_headers", "items", "e"]) {
    expect(existsSync(join(site, f))).toBe(true);
  }
});

test("the generator returns the shape it prints", () => {
  // These were two shapes for a while: artFromSvg kept FILL and RIM inside
  // defs while artBlock split them out, so a drawing the CLI handled fine
  // could not be mounted by the page that ran the same derivation.
  const svg = readFileSync(join(import.meta.dir, "fixtures/art/blip-bot.svg"), "utf8");
  const { art } = artFromSvg(svg, "blip-bot");
  expect(Object.keys(art.glass).sort()).toEqual(["defs", "fill", "ground", "rim", "sheen"]);
  expect(art.glass.fill).toContain('id="FILL"');
  expect(art.glass.rim).toContain('id="RIM"');
  expect(art.glass.defs).not.toContain('id="FILL"');
  // and what it prints parses back to the same thing
  expect(artBlock(art, "X")).toContain(JSON.stringify(art.glass.fill));
});

test("a drawing the CLI reads is one the engine can mount", () => {
  const svg = readFileSync(join(import.meta.dir, "fixtures/art/blip-bot.svg"), "utf8");
  const { art } = artFromSvg(svg, "blip-bot");
  const markup = restingMarkup("idle", "x", art);
  expect(markup).toContain("fx-paw-fill-x");
  expect(markup).not.toContain("%M%");
  expect(markup).not.toMatch(/id="(FILL|RIM|D\d+)"/);
});
