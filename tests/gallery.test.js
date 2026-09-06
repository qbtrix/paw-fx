// Gallery contract: dist/registry/gallery/ shows the WHOLE registry and shows
// it truthfully. Built into a temp dir from a temp registry, so the assertions
// hold for whatever effects/ contains rather than for a checked-in page.
//
// Four things are worth a test here, and they are the four that rot silently:
//   - every effect in registry.json reaches the page, counted rather than
//     eyeballed, as both a card and a panel. A generator that quietly drops one
//     is a gallery that lies about what the registry serves.
//   - the engine badges match fx.py's rule (svelte and react take dependency-
//     free effects only). This page is where a reader learns that, so it has to
//     agree with the server that enforces it.
//   - every upstream link is the pinned-commit blob URL for the paths the
//     item declares, and a paw-fx original links nowhere.
//   - nothing on the page fetches off-site. The only absolute URLs allowed are
//     github.com links a reader clicks.
import { test, expect } from "bun:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../scripts/build-registry.mjs";
import { buildGallery } from "../scripts/build-gallery.mjs";

const dir = mkdtempSync(join(tmpdir(), "fx-gallery-"));
const registryDir = join(dir, "registry");
const reg = build(registryDir);
const result = buildGallery(registryDir, join(dir, "gallery"));
const html = readFileSync(join(dir, "gallery", "index.html"), "utf8");
const items = reg.items.map((i) => JSON.parse(readFileSync(join(registryDir, "items", `${i.name}.json`), "utf8")));

test("every effect in the registry is on the page, once", () => {
  expect(result.count).toBe(reg.items.length);
  for (const item of reg.items) {
    expect(html).toContain(`data-name="${item.name}"`);
    expect(html).toContain(`<dialog id="${item.name}"`);
  }
  const cards = html.match(/class="fx-spot__card fxg-card"/g) || [];
  const panels = html.match(/<dialog id="/g) || [];
  expect(cards).toHaveLength(reg.items.length);
  expect(panels).toHaveLength(reg.items.length);
});

test("each panel carries the summary, the needs and the get_effect call", () => {
  for (const item of items) {
    expect(html).toContain(`mcp__pocketpaw_fx__get_effect({&quot;name&quot;: &quot;${item.name}&quot;, &quot;engine&quot;: &quot;html&quot;}`);
    expect(html).toContain(item.summary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    if (item.needs.length) expect(html).toContain(`needs ${item.needs.join(" + ")}`);
  }
});

// fx.py refuses a non-empty `needs` on svelte and react, so a card that claims
// otherwise sends a reader to a call that errors.
test("engine badges follow the dependency rule", () => {
  const panels = html.split("<dialog id=").slice(1);
  expect(panels).toHaveLength(items.length);
  for (const panel of panels) {
    const name = panel.slice(1, panel.indexOf('"', 1));
    const item = items.find((i) => i.name === name);
    const on = (panel.match(/fxg-engine is-on/g) || []).length;
    expect(on).toBe(item.needs.length ? 1 : 3);
  }
});

test("upstream links resolve to the pinned commit, and originals link nowhere", () => {
  for (const item of items) {
    const o = item.origin;
    if (!o.repo || o.repo === "paw-fx") {
      expect(html).not.toContain(`github.com/${o.repo}/blob/`);
      continue;
    }
    for (const p of Array.isArray(o.path) ? o.path : [o.path]) {
      expect(html).toContain(`https://github.com/${o.repo}/blob/${o.commit}/${p}`);
    }
  }
});

test("the page fetches nothing off-site", () => {
  // src= and stylesheet/script href= are the fetching attributes; anchors are
  // not, and the upstream links are anchors.
  const fetches = [...html.matchAll(/(?:src|rel="stylesheet"\s+href)="([^"]+)"/g)].map((m) => m[1]);
  expect(fetches.length).toBeGreaterThan(0);
  for (const url of fetches) expect(url.startsWith("http")).toBe(false);
  for (const url of [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1])) {
    expect(url.startsWith("https://github.com/")).toBe(true);
  }
});

// The gallery is a Paw Site made of paw-fx: its hero, ticker and cards are
// registry items written at their own paths, not a copy taken from effects/.
test("the chrome effects ship with the page", () => {
  for (const name of ["sg-nebula-drift", "marquee-css", "cursor-spotlight"]) {
    const item = items.find((i) => i.name === name);
    expect(item.needs).toHaveLength(0);
    for (const f of item.files) {
      expect(readFileSync(join(dir, "gallery", f.path), "utf8")).toBe(f.content);
    }
    expect(html).toContain(`data-fx="${name}"`);
    expect(html).toContain(item.usage.split("\n")[0]);
  }
});

test("the page publishes as an html Paw Site source map", () => {
  // create_html_site takes {path: contents} with STRING values and requires
  // index.html, which is why previews are data: URIs rather than sibling PNGs.
  expect(html).toContain('src="data:image/');
  // The cap is only claimed for the JPEG path. sips is macOS-only, and the PNG
  // fallback is a working page that is too big to publish, so asserting the cap
  // unconditionally would fail a Linux run for a reason that is not a defect.
  expect(["jpeg", "png"]).toContain(result.encoded);
  if (result.encoded === "jpeg") expect(result.bytes).toBeLessThan(4_000_000);
  rmSync(dir, { recursive: true, force: true });
});
