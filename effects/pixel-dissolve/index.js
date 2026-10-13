// Pixel Dissolve
// MIT License
// Copyright (c) 2026 Miguel Clavel
// https://github.com/miguelclavel/pixel-dissolve
//
// pixel-dissolve: a port of miguelclavel/pixel-dissolve at commit
// 12e6605cb4a403b70296bf19d058d3b2ea8407ec, index.html (one inline script).
// Scroll from a light panel into a dark one and the light one comes apart in
// squares. A fixed canvas covers the screen in the colour being left, over a
// grid of STEP-pixel squares; each square's threshold is two thirds its row
// (bottom first) and one third noise, and every square under the scroll
// progress is repainted in the arriving colour, the just-flipped ones
// sometimes in an accent first. Progress is driven by the arriving panel, so
// the sweep finishes while you can still see it, and runs back in reverse.
//
// The grid, the thresholds, the accent band and the progress curve are
// upstream's lines. Changed are only the seams: #from, #to and #wipe become
// elements inside the section, the colours are read off each panel's
// --fx-page, ?at becomes an option, and the listeners go in destroy().
export const meta = {
  name: "pixel-dissolve",
  version: "1.0.0",
  category: "scroll",
  needs: [],
  license: "MIT",
  // Knob ranges live in meta.json; this mirrors names and defaults.
  options: {
    step: { type: "number", default: 24, description: "Square size in pixels." },
    noise: { type: "number", default: 1 / 3, description: "How much of each threshold is random; 0.5 turns it into static." },
    accents: { type: "string[]", default: ["#FFD84D", "#FF4D6D", "#5BE85B", "#33D6FF"], description: "Colours a just-flipped square can flash first." },
    at: { type: "number", default: 0, description: "Freeze the sweep at this progress, 0 to 1. 0 follows the scroll." },
  },
  origin: {
    repo: "miguelclavel/pixel-dissolve",
    commit: "12e6605cb4a403b70296bf19d058d3b2ea8407ec",
    path: "index.html",
  },
};

const DEFAULTS = { step: 24, noise: 1 / 3, accents: ["#FFD84D", "#FF4D6D", "#5BE85B", "#33D6FF"], at: 0 };

export function mount(el, opts = {}) {
  const from = el?.querySelector?.("[data-fx-from]");
  const to = el?.querySelector?.("[data-fx-to]");
  const cv = el?.querySelector?.("[data-fx-wipe]");
  if (!from || !to || !cv || typeof cv.getContext !== "function") return { update() {}, destroy() {} };
  const box = cv.parentElement;
  const o = { ...DEFAULTS, ...opts };

  let STEP = Number(o.step) || DEFAULTS.step;            // square size in pixels
  let NOISE = Number.isFinite(Number(o.noise)) ? Number(o.noise) : DEFAULTS.noise;   // how much of each threshold is random; try 0.5 for static
  const ACCENT_SHARE = 0.06;  // chance a just flipped square paints an accent first
  const BAND = 0.16;          // how long "just flipped" lasts, as a share of the sweep
  let ACCENTS = Array.isArray(o.accents) && o.accents.length ? o.accents : DEFAULTS.accents;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A fixed hash per square, so the pattern is the same every time you scroll past.
  const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function draw(prog) {
    if (prog <= 0 || prog >= 0.999) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Read the colours from the sections themselves, not the root, so this
    // works in whatever theme each section is in.
    const leaving = getComputedStyle(from).getPropertyValue('--fx-page').trim();
    const arriving = getComputedStyle(to).getPropertyValue('--fx-page').trim();
    ctx.fillStyle = leaving; ctx.fillRect(0, 0, w, h);
    const cols = Math.ceil(w / STEP), rows = Math.ceil(h / STEP);
    const fade = Math.min(1, (1 - prog) / 0.12);
    for (let r = 0; r < rows; r++) {
      const d = rows > 1 ? 1 - r / (rows - 1) : 0;          // bottom rows open first
      for (let c = 0; c < cols; c++) {
        const th = d * (1 - NOISE) + hash(c, r, 1) * NOISE;
        if (prog < th) continue;
        let fill = arriving;
        if (prog - th < BAND && hash(c, r, 7) < ACCENT_SHARE * fade) fill = ACCENTS[Math.floor(hash(c, r, 13) * ACCENTS.length) % ACCENTS.length];
        ctx.fillStyle = fill; ctx.fillRect(c * STEP, r * STEP, STEP, STEP);
      }
    }
  }

  // 0 as the dark section touches the bottom of the screen, 1 once it has risen
  // 55% of the way: driven by the section arriving, with its own listener.
  let req = null;
  // at freezes the sweep part way, for the README picture.
  let forced = parseFloat(o.at);
  function run() {
    req = null;
    if (forced > 0) return draw(forced);
    if (reduce) return draw(0);
    const top = to.getBoundingClientRect().top, h = innerHeight;
    draw(clamp((h - top) / (h * 0.55), 0, 1));
  }
  const onScroll = () => { if (!req) req = requestAnimationFrame(run); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  run();

  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) {
      if (next.step != null) STEP = Number(next.step) || DEFAULTS.step;
      if (next.noise != null && Number.isFinite(Number(next.noise))) NOISE = Number(next.noise);
      if (Array.isArray(next.accents) && next.accents.length) ACCENTS = next.accents;
      if (next.at != null) forced = parseFloat(next.at);
      onScroll();
    },
    destroy() {
      cancelAnimationFrame(req); req = null;
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      box.style.display = '';
      el.removeAttribute("data-fx-live");
    },
  };
}
