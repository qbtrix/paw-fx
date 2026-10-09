// Pixel Trail
// MIT License
// Copyright (c) 2026 Miguel Clavel
// https://github.com/miguelclavel/pixel-trail
//
// pixel-trail: a port of miguelclavel/pixel-trail at commit
// 8c36e4d3e1d4cf9a6fa73423ae6cf7ee57004561, index.html (one inline script).
// A canvas behind the hero is split into a grid of small squares. The pointer
// charges every square within RADIUS of it, each square keeps the brightest
// it has ever been, and the charge fades slowly, twice as fast once the
// pointer has been still for half a second. Bright squares paint in the ink
// colour, dim ones scatter into accents, and nothing is drawn over the copy.
//
// The grid, the charge curve, the fade, the colour bands and the ?demo loop
// are upstream's lines. Changed are only the seams: the three ids become
// elements inside the section, the ink colour is read off the section's
// --fx-ink instead of the root's --ink, the URL-param switches become options,
// and every listener and frame is torn down in destroy().
export const meta = {
  name: "pixel-trail",
  version: "1.0.0",
  category: "cursor",
  needs: [],
  license: "MIT",
  // Knob ranges live in meta.json; this mirrors names and defaults.
  options: {
    cols: { type: "number", default: 102, description: "Grid width in squares." },
    radius: { type: "number", default: 60, description: "How far from the pointer a square gets charged, in px." },
    accents: { type: "string[]", default: ["#FFD84D", "#FF4D6D", "#5BE85B", "#33D6FF"], description: "Colours the dimmer squares scatter into." },
    demo: { type: "boolean", default: false, description: "Charge upstream's loop around the copy in one go and hold it." },
  },
  origin: {
    repo: "miguelclavel/pixel-trail",
    commit: "8c36e4d3e1d4cf9a6fa73423ae6cf7ee57004561",
    path: "index.html",
  },
};

const DEFAULTS = { cols: 102, radius: 60, accents: ["#FFD84D", "#FF4D6D", "#5BE85B", "#33D6FF"], demo: false };

export function mount(el, opts = {}) {
  const cv = el?.querySelector?.("[data-fx-grid]");
  const copy = el?.querySelector?.("[data-fx-copy]");
  if (!cv || !copy || typeof cv.getContext !== "function") return { update() {}, destroy() {} };
  const hero = el;
  const o = { ...DEFAULTS, ...opts };

  const HOLD = !!o.demo;   // the README picture keeps its trail instead of fading
  let COLS = Number(o.cols) || DEFAULTS.cols;          // grid width in squares
  let RADIUS = Number(o.radius) || DEFAULTS.radius;    // how far from the pointer a square gets charged, in px
  let ACCENTS = Array.isArray(o.accents) && o.accents.length ? o.accents : DEFAULTS.accents;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const seed = Math.random() * 1000;
  const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7 + seed) * 43758.5453; return n - Math.floor(n); };
  const pick = (c, r, k) => ACCENTS[Math.floor(hash(c, r, k) * ACCENTS.length) % ACCENTS.length];
  const P = { x: -1, y: -1, tx: -1, ty: -1, on: false, moved: 0, last: 0, grid: null, rows: 0, req: null, w: 0, h: 0, dpr: 1 };

  function size() {
    const b = hero.getBoundingClientRect();
    P.dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(b.width * P.dpr); cv.height = Math.round(b.height * P.dpr);
    P.w = b.width; P.h = b.height;
    // Resizing a canvas clears it, so paint the current trail again.
    if (P.grid && !P.req) P.req = requestAnimationFrame(draw);
  }

  function draw() {
    P.req = null;
    const ctx = cv.getContext('2d');
    const cell = P.w / COLS, rows = Math.ceil(P.h / cell);
    if (!P.grid || P.rows !== rows) {
      // Keep the trail when the height changes: copy the rows that still fit.
      const next = new Float32Array(COLS * rows);
      if (P.grid) next.set(P.grid.subarray(0, Math.min(P.grid.length, next.length)));
      P.grid = next; P.rows = rows;
    }
    const E = P.grid, now = performance.now();
    const dt = Math.min(50, now - (P.last || now)) / 1000;
    P.last = now;
    // Ease the drawing point toward the real pointer so fast moves still leave a solid trail.
    if (P.tx >= 0) { if (P.x < 0) { P.x = P.tx; P.y = P.ty; } P.x += (P.tx - P.x) * 0.22; P.y += (P.ty - P.y) * 0.22; }
    // Fade slowly, twice as fast once the pointer has been still for half a second.
    const idle = now - P.moved > 500;
    const decay = HOLD ? 0 : 0.64 * dt * (idle ? 2.2 : 1);
    const rc = RADIUS / cell, cx = P.x / cell, cy = P.y / cell;
    const ink = getComputedStyle(el).getPropertyValue('--fx-ink').trim();

    // Never draw over the text. Blocking the charge is not enough: the radius
    // reaches in from outside, so the squares under the copy are skipped outright.
    const hb = hero.getBoundingClientRect(), q = copy.getBoundingClientRect(), pad = 18;
    const keep = { l: q.left - hb.left - pad, r: q.right - hb.left + pad, t: q.top - hb.top - pad, b: q.bottom - hb.top + pad };

    ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    ctx.clearRect(0, 0, P.w, P.h);
    let any = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        let e = Math.max(0, E[i] - decay);
        if (P.on && !idle && P.x >= 0) {
          const dx = c + 0.5 - cx, dy = r + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
          if (d < rc) {
            const charge = 1 - d / rc, target = charge * charge * (0.55 + 0.45 * charge);
            // Each square keeps the brightest it has been, so the trail holds its shape.
            if (target > e) e = target;
          }
        }
        E[i] = e;
        if (e <= 0.06) continue;
        any = true;
        let fill;
        if (e > 0.55) fill = ink;
        else if (e > 0.40) fill = hash(c, r, 17) < 0.3 ? pick(c, r, 19) : ink;
        else if (e > 0.24) fill = pick(c, r, 23);
        else if (hash(c, r, 31) < 0.3) fill = pick(c, r, 29);
        else continue;
        const px = c * cell, py = r * cell;
        if (px + cell > keep.l && px < keep.r && py + cell > keep.t && py < keep.b) continue;
        ctx.fillStyle = fill;
        ctx.fillRect(px, py, cell + 1, cell + 1);
      }
    }
    if (any) P.req = requestAnimationFrame(draw);
  }

  function point(x, y) {
    const b = hero.getBoundingClientRect();
    P.tx = x - b.left; P.ty = y - b.top; P.on = true; P.moved = performance.now();
    if (!P.req) P.req = requestAnimationFrame(draw);
  }

  const onMove = e => point(e.clientX, e.clientY);
  const onLeave = () => { P.on = false; };
  size();
  addEventListener('resize', size, { passive: true });
  if (!reduce) {
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave, { passive: true });
  }

  // demo charges a loop around the name in one go and holds it, for the README picture.
  const demoTimer = HOLD ? setTimeout(() => {
    size();
    const b = hero.getBoundingClientRect(), cell = b.width / COLS, rows = Math.ceil(b.height / cell);
    P.grid = new Float32Array(COLS * rows); P.rows = rows;
    for (let k = 0; k <= 900; k++) {
      const a = (k / 900) * Math.PI * 2.15 - 0.6;
      const x = b.width * (0.5 + 0.4 * Math.cos(a)), y = b.height * (0.5 + 0.34 * Math.sin(a));
      const fade = 0.35 + 0.65 * (k / 900);   // older parts of the loop are dimmer
      for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
        const d = Math.hypot(c + 0.5 - x / cell, r + 0.5 - y / cell), rc = RADIUS / cell;
        if (d < rc) { const ch = 1 - d / rc, t = ch * ch * (0.55 + 0.45 * ch) * fade; if (t > P.grid[r * COLS + c]) P.grid[r * COLS + c] = t; }
      }
    }
    P.last = performance.now(); P.moved = P.last;
    draw();
    cancelAnimationFrame(P.req); P.req = null;
  }, 300) : 0;

  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) {
      if (next.cols != null && Number(next.cols) !== COLS) { COLS = Number(next.cols) || DEFAULTS.cols; P.grid = null; }
      if (next.radius != null) RADIUS = Number(next.radius) || DEFAULTS.radius;
      if (Array.isArray(next.accents) && next.accents.length) ACCENTS = next.accents;
    },
    destroy() {
      clearTimeout(demoTimer);
      cancelAnimationFrame(P.req); P.req = null;
      removeEventListener('resize', size);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
      el.removeAttribute("data-fx-live");
    },
  };
}
