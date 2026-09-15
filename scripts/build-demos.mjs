// Builds dist/registry/gallery/demo/, one full-page live demo per effect, plus
// the _fx/ tree every demo and the gallery itself load from.
//
// A still preview.png is not the thing. Someone picking an effect for a client
// site needs to watch it move, scroll it and put a cursor on it, so each demo
// is the effect as a visitor meets it: the item's own `snippet` markup on an
// otherwise empty page, its `usage` stylesheet link and mount script verbatim,
// and nothing else competing for the viewport.
//
// THESE PAGES ARE ALSO THE GALLERY'S RIGHT PANE. build-gallery.mjs frames one
// of them per pick rather than growing a second rendering path, so a demo is
// now read in two places and only one of them owns the whole tab. The only
// thing that changes between them is the bar's way out: `target="_top"` on the
// back link, so "All effects" leaves the gallery in the tab it is in instead of
// loading the whole gallery inside a 600px frame. Every other control in the
// bar stays frame-local on purpose -- the reduced-motion switch belongs to the
// preview, and reloading only the frame is the point of it.
//
// Input is the built items and nothing else, the same rule build-gallery.mjs
// follows, so an effect added to effects/ gets a demo through `bun run gallery`
// with no edit here.
//
// ONE _fx TREE, NOT ONE PER DEMO. Items are standalone by design -- each one
// carries its own copy of three.module.js -- but they are written here at the
// path they declare, so 29 items collapse to one shared tree at the gallery
// root. That is also why the demos live at demo/<name>.html rather than in
// per-effect directories: `usage` is ROOT-ABSOLUTE (/_fx/...), so every page
// under this root resolves it, at any depth, with no rewriting. Written
// content is asserted identical on collision rather than last-write-wins: two
// items disagreeing about /_fx/vendor/three.module.js is a build defect, and
// silently keeping whichever came last is how a demo loads the wrong vendor.
//
// THE BAR is fixed to the BOTTOM edge. A bar in normal flow would add its own
// height of scroll to all 21 sections that fill the viewport, which reads as a
// broken page and blurs the one thing these demos have to show. Bottom rather
// than top because page-fade's snippet ships its own top nav, and because no
// snippet puts its subject in the bottom strip.
//
// REDUCED MOTION is a real toggle, not a claim. A page cannot change the
// browser's prefers-reduced-motion, so ?reduced=1 reproduces it on both paths
// the effects actually use:
//   - JS: every effect gates motion on matchMedia("(prefers-reduced-motion:
//     reduce)").matches, the 8 shader.gallery ports through _shared/glsl-mount.js
//     and the other 21 in their own index.js. The shim redefines `matches` on
//     the real MediaQueryList, so an effect that listens for "change" still has
//     a live object to listen to.
//   - CSS: motion is declared inside `@media (prefers-reduced-motion:
//     no-preference)` blocks, so not applying them IS the resting state, and
//     `animation: none` under the flag is the same thing reached from the other
//     side. marquee-css, which declares its animation outside a query, spells
//     its own reduce branch `animation: none` too.
// The shim is a parser-blocking classic script in the head, so it runs before
// the deferred module that mounts, which is the only ordering that matters.
//
// FILLER for `category === "scroll"`. Those four sections need somewhere to
// scroll: scroll-parallax drives a view-timeline that only advances as the
// section crosses the viewport, and smooth-scroll smooths the whole document,
// so a one-screen page shows neither. Keyed on the category, not on a list of
// names, so a new scroll effect gets its runway automatically. The blocks are
// siblings in the document flow with no wrapper: lenis drives the document
// scroller and scroll-parallax's timeline is pinned to it, and an overflow
// container between them would take that scroller away.

import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ASSETS = new URL("gallery", import.meta.url).pathname;

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Redefines `matches` on the object matchMedia already returned, rather than
// handing back a stub: addEventListener, media and dispatchEvent stay real.
// The no-preference form has to flip the other way, or an effect that asks the
// positive question gets told motion is fine.
const SHIM = `(function () {
  var on = /(^|[?&])reduced=1(&|$)/.test(location.search);
  if (on) document.documentElement.setAttribute("data-fx-reduced", "");
  if (!on || typeof matchMedia !== "function") return;
  var real = window.matchMedia.bind(window);
  window.matchMedia = function (q) {
    var mql = real(q);
    if (/prefers-reduced-motion/.test(String(q))) {
      try {
        Object.defineProperty(mql, "matches", { value: !/no-preference/.test(String(q)), configurable: true });
      } catch (e) {}
    }
    return mql;
  };
})();`;

// The leading block is deliberately the short one (.fxd-filler--lead, 45svh
// against 80). It has to exist, or scroll-parallax opens with its view-timeline
// already at the start of its travel and nothing above to rewind into. But a
// full screen of it means the demo's FIRST PAINT is an empty page with one
// sentence on it, which is the exact complaint a still preview.png draws. Half
// a screen leaves the effect on screen at load and still leaves room to scroll
// back above it.
const FILLER_BEFORE = [
  ["Scroll on", "The effect is the section below, and this block is here to give it somewhere to travel from."],
];
const FILLER_AFTER = [
  ["Past it", "Scroll back up to run it again. Nothing on this block is part of the effect."],
  ["End of the demo", "The filler above and below is written by the demo builder. The effect is the one section between them."],
];

const filler = (blocks, cls = "") =>
  blocks
    .map(
      ([tag, text]) => `<section class="fxd-filler${cls}" aria-hidden="true">
  <div class="fxd-filler__in">
    <p class="fxd-filler__tag">${esc(tag)}</p>
    <p class="fxd-filler__p">${esc(text)}</p>
  </div>
</section>`,
    )
    .join("\n");

// Both toggle states ship in the markup and CSS shows one, so the control needs
// no script of its own and works on the first paint.
/**
 * Live knobs, built from the item's own `options` metadata.
 *
 * The registry has always DOCUMENTED its options in a table. A table tells you
 * `swirl` defaults to 0.8; it does not tell you what 0.8 looks like, and the
 * only honest way to pick a number for a shader is to drag it. So every demo
 * with options gets the panel, generated from the same metadata the docs table
 * reads -- nothing per-effect to write, and an effect added to effects/ gets
 * knobs through `bun run gallery` with no edit here.
 *
 * Ranges: an option may declare `min`/`max`/`step` and they win. Almost none
 * do, so an undeclared number is inferred from its default -- 0 to four times
 * it, which covers "turn it off" through "far too much" for every option in
 * the registry, and is symmetric around zero for the ones that go negative.
 * The place to fix a bad range is `min`/`max` in that effect's meta.json.
 */
const NUM = (v) => typeof v === "number" && Number.isFinite(v);

function range(o) {
  const d = NUM(o.default) ? o.default : 0;
  const lo = NUM(o.min) ? o.min : d < 0 ? d * 4 : 0;
  const hi = NUM(o.max) ? o.max : d === 0 ? 1 : Math.abs(d) * 4;
  // ~200 stops, rounded to something a reader recognises as a number.
  const raw = NUM(o.step) ? o.step : (hi - lo) / 200;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  let step = NUM(o.step) ? o.step : Math.max(mag, Math.round(raw / mag) * mag);
  // A count is a count. `rows` defaulting to 15 is fifteen rows, and a slider
  // offering 59.7 of them is asking for a number the effect cannot draw --
  // so a whole-number default in the tens gets whole-number stops.
  if (!NUM(o.step) && Number.isInteger(o.default) && Math.abs(o.default) >= 8) {
    step = Math.max(1, Math.round(step));
  }
  return { lo, hi, step };
}

const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v);

function control(name, o) {
  const id = `k-${name}`;
  const label = `<label class="fxd-k__name" for="${esc(id)}">${esc(name)}</label>`;
  if (o.type === "boolean") {
    return `<div class="fxd-k" data-k="${esc(name)}" data-kind="boolean">${label}
      <input class="fxd-k__box" id="${esc(id)}" type="checkbox"${o.default ? " checked" : ""}></div>`;
  }
  if (o.type === "string[]" && Array.isArray(o.default) && o.default.every(isHex)) {
    const swatches = o.default
      .map((c, i) => `<input class="fxd-k__hex" type="color" value="${esc(c)}" data-i="${i}" aria-label="${esc(name)} stop ${i + 1}">`)
      .join("");
    return `<div class="fxd-k fxd-k--wide" data-k="${esc(name)}" data-kind="colors"><span class="fxd-k__name">${esc(name)}</span>
      <div class="fxd-k__hexes">${swatches}</div></div>`;
  }
  if (o.type === "string" && isHex(o.default)) {
    return `<div class="fxd-k" data-k="${esc(name)}" data-kind="color">${label}
      <input class="fxd-k__hex" id="${esc(id)}" type="color" value="${esc(o.default)}"></div>`;
  }
  if (o.type === "number" && NUM(o.default)) {
    const { lo, hi, step } = range(o);
    return `<div class="fxd-k" data-k="${esc(name)}" data-kind="number">${label}
      <input class="fxd-k__slider" id="${esc(id)}" type="range" min="${lo}" max="${hi}" step="${step}" value="${o.default}">
      <output class="fxd-k__out">${o.default}</output></div>`;
  }
  return `<div class="fxd-k" data-k="${esc(name)}" data-kind="string">${label}
    <input class="fxd-k__text" id="${esc(id)}" type="text" value="${esc(String(o.default ?? ""))}"></div>`;
}

function knobs(item) {
  const rows = Object.entries(item.options ?? {});
  if (!rows.length) return "";
  return `<details class="fxd-knobs">
  <summary class="fxd-knobs__sum">Knobs<span class="fxd-knobs__n">${rows.length}</span></summary>
  <div class="fxd-knobs__body">
${rows.map(([n, o]) => "    " + control(n, o)).join("\n")}
    <div class="fxd-knobs__foot">
      <code class="fxd-knobs__line" id="fxd-line">mount(el)</code>
      <button class="fxd-knobs__copy" type="button" id="fxd-copy">Copy</button>
      <button class="fxd-knobs__reset" type="button" id="fxd-reset">Reset</button>
    </div>
  </div>
</details>`;
}

/**
 * The mount, with the knobs wired to it.
 *
 * Only options the reader has actually TOUCHED are passed, so an untouched
 * demo mounts exactly the way the verbatim usage line does -- the panel adds
 * a way to tune, it does not quietly re-specify the effect. That is also what
 * makes the copy line honest: it shows your overrides and nothing else.
 *
 * Two paths on a change, because `mount` returns `{update, destroy}` and only
 * some effects implement a real `update`: call it immediately for the ones
 * that do, and remount 150ms after the drag settles for the ones that do not.
 * The debounce is not cosmetic -- a remount per input event on a WebGL effect
 * is a new GL context per event, and browsers keep about sixteen.
 */
function knobMount(item) {
  const n = item.name;
  return `<script type="module">
import { mount } from '/_fx/effects/${n}/index.js';
const els = [...document.querySelectorAll('[data-fx="${n}"]')];
const opts = {};
let handles = els.map((el) => mount(el, opts));
const line = document.getElementById('fxd-line');
const show = () => {
  const keys = Object.keys(opts);
  line.textContent = keys.length
    ? 'mount(el, ' + JSON.stringify(opts) + ')'
    : 'mount(el)';
};
let timer;
const remount = () => {
  for (const h of handles) h?.destroy?.();
  handles = els.map((el) => mount(el, { ...opts }));
};
const changed = () => {
  for (const h of handles) h?.update?.({ ...opts });
  clearTimeout(timer);
  timer = setTimeout(remount, 150);
  show();
};
for (const k of document.querySelectorAll('.fxd-k')) {
  const name = k.dataset.k;
  const kind = k.dataset.kind;
  k.addEventListener('input', () => {
    if (kind === 'number') {
      opts[name] = Number(k.querySelector('input').value);
      k.querySelector('output').textContent = opts[name];
    } else if (kind === 'boolean') {
      opts[name] = k.querySelector('input').checked;
    } else if (kind === 'colors') {
      opts[name] = [...k.querySelectorAll('input')].map((i) => i.value);
    } else {
      opts[name] = k.querySelector('input').value;
    }
    changed();
  });
}
document.getElementById('fxd-copy')?.addEventListener('click', async (e) => {
  await navigator.clipboard.writeText(line.textContent);
  e.target.textContent = 'Copied';
  setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
});
document.getElementById('fxd-reset')?.addEventListener('click', () => {
  for (const k of Object.keys(opts)) delete opts[k];
  for (const el of document.querySelectorAll('.fxd-knobs input')) {
    if (el.type === 'checkbox') el.checked = el.defaultChecked;
    else el.value = el.defaultValue ?? el.getAttribute('value');
    el.closest('.fxd-k')?.querySelector('output')?.replaceChildren(el.value);
  }
  remount();
  show();
});
</` + `script>`;
}

function bar(item, rewired = false) {
  const two = item.targets.html.demo?.length
    ? `\n  <a class="fxd-bar__extra" href="/${esc(item.targets.html.demo[0].path)}">Two-page demo</a>`
    : "";
  // Said out loud on the page, because a visitor who clicks a link here should
  // know the destination is a demo convenience and not part of the section.
  const note = rewired
    ? `\n  <span class="fxd-bar__note">Links point at the two-page demo, the section ships its own routes</span>`
    : "";
  return `<nav class="fxd-bar" aria-label="Demo controls">
  <a class="fxd-bar__back" href="../index.html" target="_top">All effects</a>
  <span class="fxd-bar__name">${esc(item.name)}</span>
  <span class="fxd-bar__cat">${esc(item.category)}</span>${two}${note}
  <a class="fxd-bar__rm fxd-bar__rm--go" href="?reduced=1">Reduced motion</a>
  <a class="fxd-bar__rm fxd-bar__rm--back" href="./${esc(item.name)}.html">Motion on</a>
</nav>`;
}

/**
 * A section may carry links to site routes that do not exist inside the gallery.
 * page-fade is the only one today, and it is the case that matters most: on a
 * page transition, clicking a link IS the effect, so leaving those links to 404
 * means the one demo whose whole point is navigation cannot be demonstrated.
 *
 * The shipped snippet is not touched. It stays exactly what get_effect returns,
 * and the gallery panel still shows it verbatim. Only the demo copy is rewired,
 * to the effect's own two-page demo, and the bar says so on the page so nobody
 * mistakes a demo convenience for the section's real markup.
 */
const rewireDemoLinks = (item) => {
  const dest = (item.targets.html.demo ?? []).find((f) => /\/(a|index)\.html$/.test(f.path))?.path;
  if (!dest) return { snippet: item.targets.html.snippet, rewired: false };
  const snippet = item.targets.html.snippet.replace(
    /href="\/(?!_fx\/)[^"]*"/g,
    `href="/${dest.replace(/^\//, "")}"`,
  );
  return { snippet, rewired: snippet !== item.targets.html.snippet };
};

export function demoPage(item) {
  const [link, , mount] = item.targets.html.usage.split("\n");
  const scroll = item.category === "scroll";
  const { snippet, rewired } = rewireDemoLinks(item);
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(item.name)} live demo, paw-fx</title>
<meta name="description" content="${esc(item.summary)}">
<script>${SHIM}</script>
<link rel="stylesheet" href="/demo/demo.css">
${link}
<body class="fxd">
${scroll ? `${filler(FILLER_BEFORE, " fxd-filler--lead")}\n` : ""}${snippet}
${scroll ? `${filler(FILLER_AFTER)}\n` : ""}${bar(item, rewired)}
${knobs(item)}
${Object.keys(item.options ?? {}).length ? knobMount(item) : mount}
</body>
`;
}

/**
 * Writes the shared _fx/ tree and one demo page per item under `out`.
 * `out` is the gallery root, because `usage` is root-absolute and the whole
 * gallery is served from there.
 */
export function buildDemos(items, out) {
  const written = new Map();
  const put = (path, content) => {
    const prior = written.get(path);
    if (prior !== undefined) {
      if (prior !== content) throw new Error(`demos: two items disagree about ${path}`);
      return;
    }
    written.set(path, content);
    const dest = join(out, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  };

  mkdirSync(join(out, "demo"), { recursive: true });
  for (const item of items) {
    for (const f of [...item.files, ...(item.targets.html.demo ?? [])]) put(f.path, f.content);
    put(`demo/${item.name}.html`, demoPage(item));
  }
  copyFileSync(join(ASSETS, "demo.css"), join(out, "demo", "demo.css"));

  const bytes = [...written.values()].reduce((n, c) => n + Buffer.byteLength(c), 0);
  return { count: items.length, files: written.size, bytes };
}

if (import.meta.main) {
  const registryDir = new URL("../dist/registry", import.meta.url).pathname;
  const reg = JSON.parse(readFileSync(join(registryDir, "registry.json"), "utf8"));
  const items = reg.items.map((i) => JSON.parse(readFileSync(join(registryDir, "items", `${i.name}.json`), "utf8")));
  const r = buildDemos(items, join(registryDir, "gallery"));
  console.log(`demos: ${r.count} pages, ${r.files} files, ${(r.bytes / 1e6).toFixed(2)} MB`);
}
