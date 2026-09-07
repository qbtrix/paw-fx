// Gallery contract: dist/registry/gallery/ shows the WHOLE registry and shows
// it truthfully, and every effect on it has a live demo page behind its button.
// Built into a temp dir from a temp registry, so the assertions hold for
// whatever effects/ contains rather than for a checked-in page.
//
// The demo assertions are in their own block at the bottom, with their own note
// on what a string can and cannot prove about a running effect.
//
// Five things are worth a test on the grid page, and they are the five that rot
// silently:
//   - every effect in registry.json reaches the page, counted rather than
//     eyeballed, as both a card and a panel. A generator that quietly drops one
//     is a gallery that lies about what the registry serves.
//   - the sidebar covers the same registry: every category is a group with its
//     own count, and every effect is a link inside its group. The sidebar is
//     the second full listing of the library, so it can fall behind the grid
//     without a single card going missing.
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

// The sidebar is generated from the same items, so the point of this is that it
// STAYS generated: a category hard-coded into the nav, or a count typed in by
// hand, would pass every other test on this page and be wrong the day an effect
// lands.
test("the sidebar lists every category with its count, and every effect under it", () => {
  const counts = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;

  const groups = html.match(/class="fxg-pick" href="#cat=/g) || [];
  expect(groups).toHaveLength(Object.keys(counts).length);

  for (const [cat, n] of Object.entries(counts)) {
    expect(html).toContain(`href="#cat=${encodeURIComponent(cat)}" data-role="cat" data-cat="${cat}"`);
    expect(html).toContain(`<span class="fxg-n" data-n="${cat}">${n}</span>`);
    expect(html).toContain(`<ul class="fxg-sub" id="grp-${cat}" hidden>`);
  }

  for (const item of items) {
    expect(html).toContain(`<a class="fxg-open" href="#${item.name}">${item.name}</a>`);
  }
  const subLinks = html.match(/<a class="fxg-open" href="#/g) || [];
  expect(subLinks).toHaveLength(items.length);

  // The two cross-cutting filters, with the dependency-free count the cards
  // also claim one by one.
  const free = items.filter((i) => !i.needs.length).length;
  expect(html).toContain(`<span class="fxg-n" data-n="*">${items.length}</span>`);
  expect(html).toContain(`<span class="fxg-n" data-n="+free">${free}</span>`);
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

// ---------- live demos ----------
//
// The demos are the point of the gallery: a still preview says what colour an
// effect is and nothing else. What can rot here without anyone noticing is an
// effect that reaches the grid but has no page behind its button, or a page
// whose mount line drifts from the item's own `usage` -- either one is a demo
// that renders the resting state forever and looks like a broken effect.
// Whether it actually MOVES is not testable from a string; that is smoke's job
// on the no-script side, and a browser pass on the live side.

test("every effect has a demo page carrying its snippet and its own mount line", () => {
  for (const item of items) {
    const page = readFileSync(join(dir, "gallery", "demo", `${item.name}.html`), "utf8");
    expect(page).toContain(`data-fx="${item.name}"`);
    // Verbatim, not paraphrased: the demo mounts the way the registry says to.
    const [link, , mount] = item.usage.split("\n");
    expect(page).toContain(mount);
    expect(page).toContain(link);
    expect(page).toContain('href="../index.html"');
    expect(page).toContain("?reduced=1");
  }
});

test("every card and every panel links to its demo", () => {
  for (const item of items) {
    expect(html).toContain(`href="demo/${item.name}.html"`);
  }
  expect((html.match(/class="fxg-live"/g) || []).length).toBe(items.length);
  expect((html.match(/class="fxg-live fxg-live--wide"/g) || []).length).toBe(items.length);
});

// Every file an item declares has to be on disk under the gallery root, because
// `usage` is root-absolute and that root is what a demo resolves against.
test("the shared _fx tree carries every item's files, byte for byte", () => {
  for (const item of items) {
    for (const f of item.files) {
      expect(readFileSync(join(dir, "gallery", f.path), "utf8")).toBe(f.content);
    }
  }
});

test("a demo fetches nothing off-site", () => {
  for (const item of items) {
    const page = readFileSync(join(dir, "gallery", "demo", `${item.name}.html`), "utf8");
    for (const m of page.matchAll(/(?:src|href)="([^"]+)"/g)) {
      expect(m[1].startsWith("http")).toBe(false);
    }
  }
});

// scroll-parallax drives a view-timeline that only advances as the section
// crosses the viewport, and smooth-scroll smooths the whole document. On a
// one-screen page neither does anything visible, which reads as broken.
test("scroll effects get filler to scroll, and nothing else does", () => {
  for (const item of items) {
    const page = readFileSync(join(dir, "gallery", "demo", `${item.name}.html`), "utf8");
    // Open-ended on purpose: the leading block carries a second class.
    const blocks = (page.match(/class="fxd-filler[ "]/g) || []).length;
    if (item.category === "scroll") {
      expect(blocks).toBeGreaterThan(1);
      // One of them has to be the short leading block, or the effect opens with
      // its scroll travel already spent and nothing above it to rewind into.
      expect(page).toContain("fxd-filler--lead");
    } else {
      expect(blocks).toBe(0);
    }
  }
  expect(items.filter((i) => i.category === "scroll").length).toBeGreaterThan(0);
});

// page-fade's fade is a navigation, so one page cannot show it. Its hand-written
// pair ships at the path its own relative "../style.css" resolves against, and
// the demo page points at it rather than a copy.
test("an effect with hand-written demo pages ships them, and its demo links to them", () => {
  const fade = items.find((i) => i.name === "page-fade");
  expect(fade.demo.map((f) => f.path)).toEqual([
    "_fx/effects/page-fade/demo/a.html",
    "_fx/effects/page-fade/demo/b.html",
  ]);
  for (const f of fade.demo) {
    expect(readFileSync(join(dir, "gallery", f.path), "utf8")).toBe(f.content);
  }
  const page = readFileSync(join(dir, "gallery", "demo", "page-fade.html"), "utf8");
  expect(page).toContain('href="/_fx/effects/page-fade/demo/a.html"');
  // Every other effect declares none, so the key is not dead weight on 28 items.
  expect(items.filter((i) => i.demo.length).map((i) => i.name)).toEqual(["page-fade"]);
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
