// Builds dist/registry/gallery/, the public paw-fx gallery: a documentation
// site showing every effect in the registry, what it costs, where it came from,
// and the exact MCP call that fetches it.
//
// The input is dist/registry/ and nothing else -- registry.json, items/*.json,
// previews/*.png. Never the effects/ tree. The registry is what the MCP server
// serves, so a gallery built from it shows what a consumer actually gets, and
// an effect added to effects/ reaches the page through `bun run gallery` with
// no edit here. The sidebar's groups, counts and per-effect links are all
// derived from the items, so a tenth category would appear on its own.
//
// THE SHAPE IS A DOCUMENTATION SITE, not a landing page. A library of 77 is
// something you browse, and one long scroll is not browsing:
//
//   top bar   the name, the count, and a search field with a "/" shortcut
//   sidebar   nine collapsible category groups, each with a live count and the
//             effects inside it, plus a group of cross-cutting filters. It is
//             a drawer under 900px rather than nothing.
//   main      a compact banner, then the card grid, four across on a laptop
//
// The banner and the sources band are the same two chrome effects the old page
// gave a full screen each; here they are a masthead and a strip, because the
// previews are the product and the chrome is not.
//
// The page is a Paw Site built out of paw-fx, so its own chrome is three
// effects taken from the registry the same way a site-building agent takes
// them: every entry of the item's `files[]` is written at its `path` verbatim,
// and the item's `usage` lines are the stylesheet link and the mount script.
// CHROME lists them. All three are dependency-free, so the gallery ships no
// vendor code.
//
//   sg-nebula-drift   the banner at the top of the content column
//   marquee-css       the ticker of upstreams, generated from origin.repo
//   cursor-spotlight  the effect cards, which light their border ring
//
// Those usage lines are ROOT-ABSOLUTE (/_fx/...), because that is what a site
// at the origin root needs and the gallery does not get to rewrite them. So the
// gallery is served from its own directory root, not opened over file://.
//
// Previews ride inside index.html as data: URIs rather than as sibling .png
// files, because an html Paw Site is created from a {path: contents} map whose
// values must be STRINGS -- binary has no way in. sips re-encodes each 640x360
// PNG to JPEG first: the PNGs total ~9MB, which is well past the platform's 4MB
// deploy-input cap. QUALITY IS THE KNOB THAT KEEPS THE PAGE PUBLISHABLE, and it
// is not set once and forgotten: base64 costs a third on top of whatever the
// JPEGs weigh. It was 75 while the library held 73 effects and crossed the cap
// at 77 (4.18MB), which is what moved it to 65. Measured at 65 on these 77:
// each preview is 37KB of the page, the whole shell of markup around them is
// 718KB, and the doc-site chrome added 27KB of that when it replaced the
// one-page layout. index.html is 3.66MB, so the headroom is ~340KB, which is
// about nine more effects. When that runs out, move the previews to sibling
// files rather than dropping the quality again -- there is already a demo/
// tree beside index.html -- but that trades away the single string map this
// note describes, so check the publish path before taking it.
//
// Card, sidebar and dialog markup is rendered here rather than by the browser,
// so the page is complete with scripting off and every effect is in the HTML
// for a test to count. gallery.js only filters, counts, opens and copies;
// gallery.css and gallery.js are copied verbatim from scripts/gallery/ because
// neither carries effect data.
//
// No live previews ON THIS PAGE. 29 WebGL contexts at once is past what a
// browser keeps (roughly 8 to 16 before it evicts the oldest), and a grid of
// dead canvases is worse than a grid of images. The banner is the one live
// shader here. Every card and every panel instead links to demo/<name>.html,
// one full-page live demo per effect, built by scripts/build-demos.mjs: one
// page, one effect, one context, which is the only arrangement that scales.
// Those demos are the point of the page now, so the link is a button and not
// a footnote.
//
// build-demos.mjs also writes the shared _fx/ tree, every item's files at the
// path the item declares. That covers the three chrome effects this page runs
// on, so the CHROME loop below only reads their `usage` lines.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { buildDemos } from "./build-demos.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSETS = join(ROOT, "scripts/gallery");

// The three registry effects the gallery itself runs on.
const CHROME = { hero: "sg-nebula-drift", ticker: "marquee-css", card: "cursor-spotlight" };

const ENGINES = ["html", "svelte", "react"];

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// See the header note: this number is what keeps index.html under the 4MB
// publish cap, so it moves down as the library grows rather than staying put.
const JPEG_QUALITY = 65;

// Drawn here rather than fetched: the page is allowed no network requests at
// all, and two 200-byte paths are cheaper than an icon font either way.
const CHEVRON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BURGER = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

// ponytail: sips is macOS-only. Without it the PNG ships as-is -- the same page,
// about five times the bytes, and past the 4MB cap an html Paw Site publish
// captures. Swap in cwebp or sharp here if the gallery ever builds on Linux CI.
function previewDataUri(png) {
  const out = join(tmpdir(), `fxg-${basename(png, ".png")}-${process.pid}.jpg`);
  try {
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(JPEG_QUALITY), png, "--out", out], { stdio: "ignore" });
    const jpg = readFileSync(out);
    rmSync(out, { force: true });
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    rmSync(out, { force: true });
    return `data:image/png;base64,${readFileSync(png).toString("base64")}`;
  }
}

// origin.path is a string or a list: a port that spans several upstream files
// declares them all, and a reader checking the port needs every one.
const paths = (origin) => (Array.isArray(origin?.path) ? origin.path : origin?.path ? [origin.path] : []);
const isPort = (origin) => Boolean(origin?.repo) && origin.repo !== "paw-fx";
const blobUrl = (origin, path) => `https://github.com/${origin.repo}/blob/${origin.commit}/${path}`;

const chip = (text, cls = "") => `<span class="fxg-chip ${cls}">${esc(text)}</span>`;

// Relative, not root-absolute: the gallery and its demos ship as one directory,
// and this is the one link on the page that still resolves if that directory is
// served from somewhere other than the origin root.
const demoHref = (item) => `demo/${esc(item.name)}.html`;
// The effect name rides along for a screen reader, because 77 links all called
// "See it live" is a link list with no information in it.
const liveLink = (item, cls) =>
  `<a class="${cls}" href="${demoHref(item)}">See it live<span class="fxg-sr"> ${esc(item.name)}</span><span aria-hidden="true"> &rarr;</span></a>`;

function engineBadges(needs) {
  // Mirrors fx.py's rule exactly: svelte and react take dependency-free effects
  // only, so an item with a non-empty `needs` is html and nothing else.
  return ENGINES.map((e) => {
    const on = e === "html" || needs.length === 0;
    return `<span class="fxg-engine ${on ? "is-on" : "is-off"}">${e}</span>`;
  }).join("");
}

function optionRows(options = {}) {
  const rows = Object.entries(options);
  if (!rows.length) return "";
  const body = rows
    .map(
      ([name, o]) => `<tr>
              <th scope="row"><code>${esc(name)}</code></th>
              <td class="fxg-type">${esc(o.type)}</td>
              <td class="fxg-default"><code>${esc(JSON.stringify(o.default))}</code></td>
              <td>${esc(o.description)}</td>
            </tr>`,
    )
    .join("\n");
  return `<section class="fxg-block">
        <h3 class="fxg-h">Knobs</h3>
        <div class="fxg-optwrap">
          <table class="fxg-opts">
            <thead><tr><th>Option</th><th>Type</th><th>Default</th><th>What it does</th></tr></thead>
            <tbody>
${body}
            </tbody>
          </table>
        </div>
      </section>`;
}

function originBlock(item) {
  const o = item.origin || {};
  if (!isPort(o)) {
    return `<section class="fxg-block">
        <h3 class="fxg-h">Licence and source</h3>
        <p class="fxg-p">${esc(item.license)}. Written for paw-fx, so there is no upstream to check it against.</p>
      </section>`;
  }
  const links = paths(o)
    .map((p) => `<li><a class="fxg-src" href="${esc(blobUrl(o, p))}" target="_blank" rel="noreferrer noopener"><code>${esc(p)}</code></a></li>`)
    .join("\n          ");
  return `<section class="fxg-block">
        <h3 class="fxg-h">Licence and source</h3>
        <p class="fxg-p">${esc(item.license)}, ported from <strong>${esc(o.repo)}</strong> at <code>${esc(String(o.commit).slice(0, 10))}</code>. Every link below opens the file at that exact commit.</p>
        <ul class="fxg-srcs">
          ${links}
        </ul>
      </section>`;
}

function deviationBlock(deviations = []) {
  if (!deviations.length) {
    return `<section class="fxg-block">
        <h3 class="fxg-h">Deviations</h3>
        <p class="fxg-p">None declared. The port matches upstream.</p>
      </section>`;
  }
  const items = deviations
    .map(
      (d) => `<li class="fxg-dev">
            <p class="fxg-dev-what">${esc(d.what)} ${chip(d.kind, "fxg-kind")}</p>
            <p class="fxg-dev-why">${esc(d.why)}</p>
          </li>`,
    )
    .join("\n          ");
  return `<section class="fxg-block">
        <h3 class="fxg-h">Deviations from upstream</h3>
        <ul class="fxg-devs">
          ${items}
        </ul>
      </section>`;
}

function dialog(item) {
  const needs = item.needs || [];
  const dep = needs.length
    ? `Ships <strong>${esc(needs.join(", "))}</strong> beside it. That is why svelte and react turn it down.`
    : "Nothing. It runs anywhere the registry does.";
  const call = `mcp__pocketpaw_fx__get_effect({"name": "${item.name}", "engine": "html"})`;
  return `  <dialog id="${esc(item.name)}" class="fxg-dialog" aria-labelledby="t-${esc(item.name)}">
    <div class="fxg-sheet">
      <header class="fxg-dhead">
        <div>
          <h2 class="fxg-dtitle" id="t-${esc(item.name)}">${esc(item.name)}</h2>
          <p class="fxg-dmeta">${esc(item.category)} &middot; v${esc(item.version)} &middot; ${esc(item.license)}</p>
        </div>
        <form method="dialog"><button class="fxg-x" aria-label="Close">Close</button></form>
      </header>
      <div class="fxg-shot fxg-dshot" data-shot="${esc(item.name)}"></div>
      <p class="fxg-lede">${esc(item.summary)}</p>
      <p class="fxg-dlive">${liveLink(item, "fxg-live fxg-live--wide")}<span class="fxg-dlive-note">Full page, running, with a reduced-motion switch.</span></p>
      <div class="fxg-tags">${(item.tags || []).map((t) => chip(t)).join("")}</div>
      <section class="fxg-block">
        <h3 class="fxg-h">Engines</h3>
        <div class="fxg-engines">${engineBadges(needs)}</div>
        <p class="fxg-p">Depends on: ${dep}</p>
      </section>
      ${originBlock(item)}
      ${deviationBlock(item.deviations)}
      ${optionRows(item.options)}
      <section class="fxg-block">
        <h3 class="fxg-h">Fetch it</h3>
        <p class="fxg-p">One call. The reply carries the files, the snippet and the mount line.</p>
        <div class="fxg-call">
          <code id="call-${esc(item.name)}">${esc(call)}</code>
          <button class="fxg-copy" type="button" data-copy="call-${esc(item.name)}">Copy</button>
        </div>
      </section>
    </div>
  </dialog>`;
}

function card(item, uri) {
  const needs = item.needs || [];
  const search = [item.name, item.category, ...(item.tags || []), item.summary].join(" ").toLowerCase();
  // The name's anchor stretches over the whole card through .fxg-link::after,
  // so the tile is one hit area; the demo link comes later in the DOM and is
  // positioned, which is what keeps it clickable on top of that overlay.
  return `      <article class="fx-spot__card fxg-card" data-fx="${CHROME.card}"
        data-name="${esc(item.name)}" data-cat="${esc(item.category)}" data-deps="${needs.length}"
        data-tags="${esc((item.tags || []).join(" ").toLowerCase())}" data-search="${esc(search)}">
        <div class="fx-spot__glow" aria-hidden="true"></div>
        <div class="fx-spot__body">
          <img class="fxg-shot" width="640" height="360" loading="lazy" alt="${esc(item.name)} at rest" src="${uri}">
          <h3 class="fxg-name"><a class="fxg-link fxg-open" href="#${esc(item.name)}">${esc(item.name)}</a></h3>
          <p class="fxg-sum">${esc(item.summary)}</p>
          <p class="fxg-foot">
            ${chip(item.category, "fxg-cat")}
            ${needs.length ? chip(`needs ${needs.join(" + ")}`, "fxg-needs") : chip("no dependencies", "fxg-free")}
          </p>
          ${liveLink(item, "fxg-live")}
        </div>
      </article>`;
}

function topbar(reg) {
  return `<header class="fxg-top">
  <button class="fxg-burger" id="fxg-burger" type="button" aria-expanded="false" aria-controls="fxg-nav" aria-label="Open the category menu">${BURGER}</button>
  <a class="fxg-brand" href="#"><b>paw-fx</b><span>${reg.items.length} effects</span></a>
  <div class="fxg-find">
    <label class="fxg-sr" for="fxg-q">Search effects</label>
    <input id="fxg-q" type="search" placeholder="Search a name, a tag, a mood" autocomplete="off" aria-keyshortcuts="/">
    <kbd class="fxg-kbd" aria-hidden="true">/</kbd>
  </div>
</header>`;
}

/**
 * The sidebar: one collapsible group per category, holding that category's
 * effects, plus a group of the filters that cut across all of them. Counts are
 * rendered here from the registry so the page is truthful with scripting off,
 * and gallery.js rewrites them as facets of whatever is in the search box.
 *
 * Ordered by size, largest first: the sidebar is a map of the library, and a
 * map is more use ordered by how much is down each road than alphabetically.
 */
function sidebar(items, free) {
  const counts = {};
  const byCat = {};
  for (const i of items) {
    counts[i.category] = (counts[i.category] || 0) + 1;
    (byCat[i.category] ||= []).push(i.name);
  }
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

  const groups = cats
    .map(
      (c) => `      <li class="fxg-group">
        <div class="fxg-row">
          <a class="fxg-pick" href="#cat=${encodeURIComponent(c)}" data-role="cat" data-cat="${esc(c)}">${esc(c)}<span class="fxg-n" data-n="${esc(c)}">${counts[c]}</span></a>
          <button class="fxg-twist" type="button" aria-expanded="false" aria-controls="grp-${esc(c)}" aria-label="Show the ${esc(c)} effects">${CHEVRON}</button>
        </div>
        <ul class="fxg-sub" id="grp-${esc(c)}" hidden>
${byCat[c].map((n) => `          <li><a class="fxg-open" href="#${esc(n)}">${esc(n)}</a></li>`).join("\n")}
        </ul>
      </li>`,
    )
    .join("\n");

  return `  <nav class="fxg-nav" id="fxg-nav" aria-label="Effects" tabindex="-1">
    <button class="fxg-nav-close" id="fxg-nav-close" type="button">Close the menu</button>
    <h2 class="fxg-nav-h" id="fxg-h-views">Views</h2>
    <ul class="fxg-list" aria-labelledby="fxg-h-views">
      <li class="fxg-row"><a class="fxg-pick" href="#" data-role="all">All effects<span class="fxg-n" data-n="*">${items.length}</span></a></li>
      <li class="fxg-row"><a class="fxg-pick" href="#free" data-role="free">Runs on every engine<span class="fxg-n" data-n="+free">${free}</span></a></li>
    </ul>
    <h2 class="fxg-nav-h" id="fxg-h-cats">Categories</h2>
    <ul class="fxg-list" aria-labelledby="fxg-h-cats">
${groups}
    </ul>
  </nav>`;
}

function banner(reg, free) {
  return `      <section class="fx-nebula fxg-hero" data-fx="${CHROME.hero}">
        <div class="fx-nebula__rest" aria-hidden="true"></div>
        <div class="fx-nebula__scrim" aria-hidden="true"></div>
        <div class="fx-nebula__grain" aria-hidden="true"></div>
        <div class="fx-nebula__inner">
          <p class="fx-nebula__eyebrow">paw-fx registry ${esc(reg.version)}</p>
          <h1 class="fx-nebula__title">${reg.items.length} sections you can drop on a client site today.</h1>
          <p class="fx-nebula__lede">Each one is a port of a named upstream, pinned to a commit and checked against it, and each one still looks finished with its script blocked. This banner is one of them, running.</p>
          <div class="fx-nebula__actions">
            <a class="fx-nebula__cta fx-nebula__cta--primary" href="demo/${esc(CHROME.hero)}.html">Open this one full page</a>
            <a class="fx-nebula__cta fx-nebula__cta--ghost" href="#free">${free} that need nothing</a>
          </div>
        </div>
      </section>`;
}

function head(reg) {
  return `      <div class="fxg-head">
        <h2 class="fxg-title" id="fxg-title">All effects</h2>
        <p class="fxg-count" id="fxg-count" aria-live="polite">${reg.items.length} effects</p>
        <a class="fxg-clear" id="fxg-clear" href="#" hidden>Clear the filters</a>
      </div>`;
}

function band(items) {
  // The row is the set of upstreams the registry actually cites, so it stays
  // true as effects land. Four copies is upstream's repeat = 4, which is what
  // makes the translateX loop seamless.
  const repos = [...new Set(items.map((i) => i.origin?.repo).filter((r) => r && r !== "paw-fx"))].sort();
  const row = `<div class="fx-marquee__row">
${repos.map((r) => `          <div class="fx-marquee__item"><span class="fx-marquee__dot" aria-hidden="true"></span>${esc(r)}</div>`).join("\n")}
        </div>`;
  return `      <section class="fx-marquee fxg-band" data-fx="${CHROME.ticker}">
        <div class="fx-marquee__head">
          <p class="fx-marquee__eyebrow">Ported, never invented</p>
          <h2 class="fx-marquee__title">Every effect here traces to someone else's file.</h2>
        </div>
        <div class="fx-marquee__band">
        ${row}
        ${row}
        ${row}
        ${row}
        </div>
      </section>`;
}

export function buildGallery(registryDir, out = join(registryDir, "gallery")) {
  const reg = JSON.parse(readFileSync(join(registryDir, "registry.json"), "utf8"));
  const items = reg.items.map((i) => JSON.parse(readFileSync(join(registryDir, "items", `${i.name}.json`), "utf8")));
  const free = items.filter((i) => !(i.needs || []).length).length;

  // The fragment grammar reads a bare token as an effect id and `k=v` as a
  // filter, which keeps the two apart for every name the registry can hold
  // except this one. Asserted rather than assumed: an effect actually called
  // "free" would make #free ambiguous, and the failure would be a filter link
  // that silently opens a panel.
  if (items.some((i) => i.name === "free")) {
    throw new Error('an effect named "free" collides with the #free filter in the gallery hash');
  }

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // The demos first: they write the shared _fx/ tree this page also loads from.
  const demos = buildDemos(items, out);

  // Dogfood: take the chrome effects out of the registry exactly as a
  // site-building agent takes them. Their files are already on disk at their
  // own `path`; `usage` line 0 is the stylesheet link and line 2 is the mount
  // script, verbatim.
  const links = [];
  const mounts = [];
  for (const name of Object.values(CHROME)) {
    const item = items.find((i) => i.name === name);
    if (!item) throw new Error(`gallery chrome wants "${name}", which the registry does not have`);
    if ((item.needs || []).length) throw new Error(`gallery chrome "${name}" needs ${item.needs.join(", ")}; chrome must be dependency-free`);
    const [link, , mount] = item.usage.split("\n");
    links.push(link);
    mounts.push(mount);
  }

  const previewsDir = join(registryDir, "previews");
  // Which encoding actually came out, so a caller can tell a publishable page
  // from the sips-less fallback rather than assuming the machine had sips.
  let encoded = "none";
  const cards = items
    .map((i) => {
      const png = join(previewsDir, `${i.name}.png`);
      const uri = existsSync(png) ? previewDataUri(png) : "";
      if (uri) encoded = uri.startsWith("data:image/jpeg") ? "jpeg" : "png";
      return card(i, uri);
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>paw-fx: ${reg.items.length} animated sections for Paw Sites</title>
<meta name="description" content="Every effect in the paw-fx registry: what it looks like, what it needs, where it was ported from, and the call that fetches it.">
${links.join("\n")}
<link rel="stylesheet" href="gallery.css">
<body class="fxg">
<a class="fxg-skip" href="#fxg-grid">Skip to the effects</a>
${topbar(reg)}
<div class="fxg-shell">
${sidebar(items, free)}
  <main class="fxg-main fx-spot" id="fxg-main">
    <div class="fxg-wrap">
${banner(reg, free)}
${head(reg)}
      <div class="fx-spot__grid fxg-grid" id="fxg-grid">
${cards}
      </div>
      <p class="fxg-empty" id="fxg-empty" hidden>No effect matches<b id="fxg-empty-q"></b>. Clear the search, or pick another category on the left.</p>
${band(items)}
      <footer class="fxg-foot-bar">
        <p>Registry ${esc(reg.version)}, built ${esc(reg.generatedAt.slice(0, 10))}. ${reg.items.length} effects, ${free} of them dependency-free.</p>
        <p>This page is generated by <code>bun run gallery</code> from the same registry the MCP server reads, and its own banner, sources band and cards are three effects out of it. Every effect also gets a full-page live demo under <code>demo/</code>, generated the same way.</p>
      </footer>
    </div>
  </main>
</div>
<div class="fxg-scrim" id="fxg-scrim" hidden></div>
${items.map(dialog).join("\n")}
${mounts.join("\n")}
<script src="gallery.js"></script>
</body>
</html>
`;

  writeFileSync(join(out, "index.html"), html);
  for (const f of ["gallery.css", "gallery.js"]) copyFileSync(join(ASSETS, f), join(out, f));
  return { out, count: items.length, free, encoded, bytes: Buffer.byteLength(html), demos };
}

if (import.meta.main) {
  const registryDir = join(ROOT, "dist/registry");
  if (!existsSync(join(registryDir, "registry.json"))) throw new Error("no dist/registry; run bun run build first");
  const r = buildGallery(registryDir);
  const files = readdirSync(r.out);
  console.log(`gallery: ${r.count} effects (${r.free} dependency-free), ${(r.bytes / 1e6).toFixed(2)} MB index.html, previews ${r.encoded}${r.encoded === "png" ? " (no sips: too big to publish)" : ""}`);
  console.log(`demos: ${r.demos.count} live pages, ${r.demos.files} files under _fx/ and demo/, ${(r.demos.bytes / 1e6).toFixed(2)} MB`);
  console.log(`-> ${r.out} (${files.join(", ")})`);
}
