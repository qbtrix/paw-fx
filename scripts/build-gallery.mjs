// Builds dist/registry/gallery/, the public paw-fx gallery: one page showing
// every effect in the registry, what it costs, where it came from, and the
// exact MCP call that fetches it.
//
// The input is dist/registry/ and nothing else -- registry.json, items/*.json,
// previews/*.png. Never the effects/ tree. The registry is what the MCP server
// serves, so a gallery built from it shows what a consumer actually gets, and
// an effect added to effects/ reaches the page through `bun run gallery` with
// no edit here.
//
// The page is a Paw Site built out of paw-fx, so its own chrome is three
// effects taken from the registry the same way a site-building agent takes
// them: every entry of the item's `files[]` is written at its `path` verbatim,
// and the item's `usage` lines are the stylesheet link and the mount script.
// CHROME lists them. All three are dependency-free, so the gallery ships no
// vendor code.
//
//   sg-nebula-drift   the hero background
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
// JPEGs weigh, so every effect added pushes the page up by ~45KB at q75. It was
// 75 while the library held 73 effects and crossed the cap at 77 (4.18MB), which
// is what moved it to 65 -- 3.63MB, about 370KB of headroom, and no visible
// difference at the size a card actually paints. 65 then crossed the cap again
// at 85 (4.04MB), which is what moved it to 56 -- 3.58MB, about 420KB back, or
// room for roughly nine more effects. A dense particle field is the expensive
// kind of preview: canvas-trails is close to noise and costs about three times
// what a flat gradient does. Measure before raising it.
//
// Card and dialog markup is rendered here rather than by the browser, so the
// page is complete with scripting off and every effect is in the HTML for a
// test to count. gallery.js only filters, opens and copies; gallery.css and
// gallery.js are copied verbatim from scripts/gallery/ because neither carries
// effect data.
//
// No live previews ON THIS PAGE. 29 WebGL contexts at once is past what a
// browser keeps (roughly 8 to 16 before it evicts the oldest), and a grid of
// dead canvases is worse than a grid of images. The hero is the one live
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
const JPEG_QUALITY = 56;

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
const liveLink = (item, cls) =>
  `<a class="${cls}" href="${demoHref(item)}">See it live<span aria-hidden="true"> &rarr;</span></a>`;

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
        <table class="fxg-opts">
          <thead><tr><th>Option</th><th>Type</th><th>Default</th><th>What it does</th></tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
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
  return `      <article class="fx-spot__card fxg-card" data-fx="${CHROME.card}"
        data-name="${esc(item.name)}" data-cat="${esc(item.category)}" data-deps="${needs.length}"
        data-tags="${esc((item.tags || []).join(" ").toLowerCase())}" data-search="${esc(search)}">
        <div class="fx-spot__glow" aria-hidden="true"></div>
        <div class="fx-spot__body">
          <img class="fxg-shot" width="640" height="360" loading="lazy" alt="${esc(item.name)} at rest" src="${uri}">
          <h3 class="fxg-name"><a class="fxg-link" href="#${esc(item.name)}">${esc(item.name)}</a></h3>
          <p class="fxg-sum">${esc(item.summary)}</p>
          <p class="fxg-foot">
            ${chip(item.category, "fxg-cat")}
            ${needs.length ? chip(`needs ${needs.join(" + ")}`, "fxg-needs") : chip("no dependencies", "fxg-free")}
          </p>
          ${liveLink(item, "fxg-live")}
        </div>
      </article>`;
}

function heroCopy(reg, free) {
  const cats = new Set(reg.items.map((i) => i.category)).size;
  return `<section class="fx-nebula" data-fx="${CHROME.hero}">
  <div class="fx-nebula__rest" aria-hidden="true"></div>
  <div class="fx-nebula__scrim" aria-hidden="true"></div>
  <div class="fx-nebula__grain" aria-hidden="true"></div>
  <div class="fx-nebula__inner">
    <p class="fx-nebula__eyebrow">paw-fx registry ${esc(reg.version)}</p>
    <h1 class="fx-nebula__title">${reg.items.length} sections you can drop on a client site today.</h1>
    <p class="fx-nebula__lede">Backgrounds, particles, 3D heroes, scroll and text work. Each one is a port of a named upstream, pinned to a commit and checked against it, and each one still looks finished with its script blocked. The background behind this line is one of them, and every card below opens the effect running on a page of its own.</p>
    <div class="fx-nebula__actions">
      <a class="fx-nebula__cta fx-nebula__cta--primary" href="#grid">See all ${reg.items.length} live</a>
      <a class="fx-nebula__cta fx-nebula__cta--ghost" href="#grid" data-filter-free>${free} that need nothing</a>
    </div>
  </div>
</section>`;
}

function ticker(reg, items) {
  // The row is the set of upstreams the registry actually cites, so it stays
  // true as effects land. Four copies is upstream's repeat = 4, which is what
  // makes the translateX loop seamless.
  const repos = [...new Set(items.map((i) => i.origin?.repo).filter((r) => r && r !== "paw-fx"))].sort();
  const row = `<div class="fx-marquee__row">
      ${repos.map((r) => `<div class="fx-marquee__item"><span class="fx-marquee__dot" aria-hidden="true"></span>${esc(r)}</div>`).join("\n      ")}
    </div>`;
  return `<section class="fx-marquee" data-fx="${CHROME.ticker}">
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

function toolbar(reg, free) {
  const counts = {};
  for (const i of reg.items) counts[i.category] = (counts[i.category] || 0) + 1;
  const chips = [`<button class="fxg-tab is-on" type="button" data-cat="">All ${reg.items.length}</button>`]
    .concat(
      Object.keys(counts)
        .sort()
        .map((c) => `<button class="fxg-tab" type="button" data-cat="${esc(c)}">${esc(c)} ${counts[c]}</button>`),
    )
    .join("\n        ");
  return `  <div class="fxg-bar" id="grid">
    <div class="fxg-bar-in">
      <label class="fxg-search">
        <span class="fxg-sr">Search effects</span>
        <input id="fxg-q" type="search" placeholder="Search a name, a tag, a mood" autocomplete="off">
      </label>
      <div class="fxg-tabs" role="group" aria-label="Filter by category">
        ${chips}
      </div>
      <label class="fxg-toggle">
        <input id="fxg-free" type="checkbox">
        <span>Runs on svelte and react (${free})</span>
      </label>
      <p class="fxg-count" id="fxg-count" aria-live="polite">${reg.items.length} effects</p>
    </div>
  </div>`;
}

export function buildGallery(registryDir, out = join(registryDir, "gallery")) {
  const reg = JSON.parse(readFileSync(join(registryDir, "registry.json"), "utf8"));
  const items = reg.items.map((i) => JSON.parse(readFileSync(join(registryDir, "items", `${i.name}.json`), "utf8")));
  const free = items.filter((i) => !(i.needs || []).length).length;

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
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>paw-fx: ${reg.items.length} animated sections for Paw Sites</title>
<meta name="description" content="Every effect in the paw-fx registry: what it looks like, what it needs, where it was ported from, and the call that fetches it.">
${links.join("\n")}
<link rel="stylesheet" href="gallery.css">
<body class="fxg">
${heroCopy(reg, free)}
${ticker(reg, items)}
<main class="fxg-main fx-spot">
${toolbar(reg, free)}
  <div class="fx-spot__grid fxg-grid" id="fxg-grid">
${cards}
  </div>
  <p class="fxg-empty" id="fxg-empty" hidden>Nothing matches. Clear the search or pick another category.</p>
</main>
${items.map(dialog).join("\n")}
<footer class="fxg-foot-bar">
  <p>Registry ${esc(reg.version)}, built ${esc(reg.generatedAt.slice(0, 10))}. ${reg.items.length} effects, ${free} of them dependency-free.</p>
  <p>This page is generated by <code>bun run gallery</code> from the same registry the MCP server reads, and its own hero, ticker and cards are three effects out of it. Every effect also gets a full-page live demo under <code>demo/</code>, generated the same way.</p>
</footer>
${mounts.join("\n")}
<script src="gallery.js"></script>
</body>
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
