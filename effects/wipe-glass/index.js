// rain-on-glass -- https://github.com/Hixly/rain-on-glass
//
// MIT License
// Copyright (c) 2026 Matthew Hixon
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
//
// wipe-glass: a port of Hixly/rain-on-glass at commit
// 4d7bf1f058264af5a28d4c2788a0c1f088ffd930, index.html. A fogged window onto a
// rainy street at night that the visitor clears with a drag, and that steams
// back up behind them.
//
// Three surfaces stacked in one fragment pass, which is what separates this
// from a rain shader. OUTSIDE the pane, every bead is a plano-convex lens
// sampling the street inverted, with a dark refractive rim, a bottom caustic
// and a specular highlight; beads stay pinned by contact-angle hysteresis
// until they outgrow a critical radius, then slide in jerky stop/start runs,
// swallow the smaller beads in their path and shed a trail of new ones behind
// them. INSIDE it, the condensation is a coarse clear-map the pointer stamps
// into: water pushed to the rim of a stroke gathers into drips that run down
// and cut channels, and the fog re-nucleates in fbm patches rather than fading
// evenly. BEHIND both, the street is painted once into a canvas at three blur
// depths -- sharp, mid, heavy -- and the fog picks which one you are looking
// through, so clearing the glass is what brings the city into focus. Cars,
// rainfall and lightning are drawn in the shader over those plates.
//
// Upstream lines 150-503 and 594-762 -- the utilities, the painted street, the
// blur fallback, the drop sprite, the water simulation, the clear-map, the two
// shaders and the GL setup -- sit inside inicia() below verbatim, at upstream's
// own indentation so a diff against the pinned file reads clean. The lines
// inside that block that differ are the three constants that became options
// (RATE, DECAY, BRUSH) and the query-string test hook in NATIVE_BLUR.
// Everything after "paw-fx seams" replaces upstream's lines 505-591 and
// 764-855, which bound input, resize and a custom cursor to the window, wired
// a Web Audio bed, and carried a test harness on window.__rain.
// meta.json.deviations lists each change.

const DEFAULTS = { rain: 1.2958, refog: 0.15, brush: 36 };
// A zero or negative rate divides by zero in the bead cap, and a zero brush
// gives stampClear a zero radius to normalise by, so a bad value falls back to
// upstream's.
const pos = (v, d) => (v > 0 ? +v : d);

export function mount(el, opts = {}) {
  var resting = { update: function () {}, destroy: function () {} };
  if (!el || typeof document === 'undefined') return resting;
  // Upstream has no reduced-motion path. Rain running down glass is the whole
  // effect and a frozen pane is not an honest still of it, so under reduced
  // motion the section keeps its CSS resting state and nothing starts.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return resting;

  var o = Object.assign({}, DEFAULTS, opts);
  var cv = document.createElement('canvas');
  cv.className = 'fx-wipe__canvas';
  cv.setAttribute('aria-hidden', 'true');
  var gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true });
  if (!gl) return resting;

  // Every GL resource is built before the first listener is attached, so a
  // shader that will not compile throws here with nothing to undo but the
  // context, and the section stays at rest.
  try {
    return inicia();
  } catch (e) {
    var perda = gl.getExtension('WEBGL_lose_context');
    if (perda) perda.loseContext();
    return resting;
  }

  function inicia() {

// ---------- utilities ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = Math.random;

// ---------- sizes ----------
let VW, VH, DPR, WS, ww, wh, CELL = 3, gw, gh;
// Rain amounts scale with the real glass area in CSS px (not canvas px), so every screen, phone or
// desktop, gets the same density per inch. Calibrated to the reference 1608x926 desktop view.
const AREA = () => VW * VH / (1608 * 926);
let RATE = pos(o.rain, DEFAULTS.rain);   // spawn/cap multiplier that reproduces the reference view exactly

// ---------- the street outside (painted once, then blurred into focus layers) ----------
function paintScene(x, w, h, p) {
  const s = h / 1000, rnd = mulberry32(20260922);
  const horizon = h * .665, street = h * .755;

  let g = x.createLinearGradient(0, -p, 0, h + p);
  g.addColorStop(0, '#04060c'); g.addColorStop(.3, '#0b1020'); g.addColorStop(.52, '#1d1c2c');
  g.addColorStop(.63, '#43302f'); g.addColorStop(.69, '#1a1213'); g.addColorStop(1, '#060608');
  x.fillStyle = g; x.fillRect(-p, -p, w + 2 * p, h + 2 * p);

  // low cloud deck lit orange from below by the city
  for (let i = 0; i < 26; i++) {
    const cx = rnd() * (w + 2 * p) - p, cy = h * (.2 + rnd() * .38), r = (140 + rnd() * 320) * s;
    const cg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const warm = cy / h;
    cg.addColorStop(0, `rgba(${90 + warm * 90 | 0},${60 + warm * 30 | 0},${70},${.05 + warm * .07})`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = cg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g = x.createRadialGradient(w * .5, horizon, 0, w * .5, horizon, w * .75);
  g.addColorStop(0, 'rgba(255,140,70,.22)'); g.addColorStop(.5, 'rgba(160,80,70,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(-p, -p, w + 2 * p, h + 2 * p);

  const winColors = ['#ffcf86', '#ffdca8', '#ffe9c4', '#ffc070', '#cfe6ff', '#9dbbff', '#fff1d8'];
  function skyline(top, minW, maxW, minH, maxH, body, winP, winS, winGap, alpha) {
    for (let bx = -p; bx < w + p;) {
      const bw = (minW + rnd() * (maxW - minW)) * s, bh = (minH + rnd() * (maxH - minH)) * s;
      const y0 = top - bh;
      x.fillStyle = body; x.fillRect(bx, y0, bw + 1, h + p - y0);
      if (rnd() < .25) { x.fillRect(bx + bw * .4, y0 - 30 * s, 3 * s, 30 * s); } // antenna
      const cols = Math.floor((bw - winGap * s) / (winS * s + winGap * s)), rows = Math.floor((bh - 10 * s) / (winS * 1.35 * s + winGap * s));
      const bias = rnd();
      for (let r = 0; r < rows; r++) {
        const rowOn = rnd() < .85;
        for (let c = 0; c < cols; c++) {
          if (!rowOn || rnd() > winP * (.6 + bias * .8)) continue;
          const wx = bx + winGap * s + c * (winS * s + winGap * s), wy = y0 + 8 * s + r * (winS * 1.35 * s + winGap * s);
          x.globalAlpha = alpha * (.45 + rnd() * .55);
          x.fillStyle = winColors[(rnd() * winColors.length) | 0];
          x.fillRect(wx, wy, winS * s, winS * 1.35 * s);
        }
      }
      x.globalAlpha = 1;
      bx += bw + (rnd() < .2 ? rnd() * 30 * s : 0);
    }
  }
  skyline(horizon, 26, 70, 60, 230, '#0c0e17', .22, 3, 4, .55);          // far towers
  skyline(horizon + 20 * s, 70, 190, 120, 470, '#07080d', .34, 7, 7, .95); // mid blocks

  // neon signs
  function neon(cx, cy, wN, hN, col) {
    x.save(); x.shadowColor = col; x.shadowBlur = 24 * s; x.strokeStyle = col; x.lineWidth = 4 * s;
    x.strokeRect(cx, cy, wN * s, hN * s); x.shadowBlur = 50 * s; x.strokeRect(cx, cy, wN * s, hN * s);
    x.fillStyle = col; x.globalAlpha = .9;
    for (let i = 0; i < 5; i++) x.fillRect(cx + (10 + i * (wN - 20) / 5) * s, cy + hN * .35 * s, (wN - 30) / 7 * s, hN * .3 * s);
    x.restore();
  }
  const signs = [[w * .18, h * .5, 120, 34, '255,61,154'], [w * .7, h * .455, 90, 30, '55,224,255'], [w * .9, h * .56, 60, 70, '255,154,60']];
  // signs light the wall they hang on
  x.globalCompositeOperation = 'lighter';
  for (const [sx, sy, sw, shh, rgb] of signs) {
    const cx = sx + sw * s / 2, cy = sy + shh * s / 2, r = sw * s * 1.3;
    const sg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    sg.addColorStop(0, `rgba(${rgb},.22)`); sg.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = sg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  x.globalCompositeOperation = 'source-over';
  for (const [sx, sy, sw, shh, rgb] of signs) neon(sx, sy, sw, shh, `rgb(${rgb})`);

  // street + wet asphalt
  g = x.createLinearGradient(0, street - 20 * s, 0, h + p);
  g.addColorStop(0, '#0d0b0d'); g.addColorStop(.3, '#0a090b'); g.addColorStop(1, '#050506');
  x.fillStyle = g; x.fillRect(-p, street - 20 * s, w + 2 * p, h + p - street + 20 * s);
  x.fillStyle = 'rgba(255,200,140,.05)'; x.fillRect(-p, street - 20 * s, w + 2 * p, 2 * s); // curb

  // street lamps with wet road reflections
  for (let i = -1; i < 6; i++) {
    const lx = w * (.08 + i * .21) + rnd() * 30 * s, top = h * .48, base = h * .79;
    const hx = lx + 28 * s, hy = top + 6 * s;
    // light spill: cone down through the rain, pool on the pavement, wash on the facade behind
    x.globalCompositeOperation = 'lighter';
    let fg = x.createRadialGradient(hx, hy, 0, hx, hy, 160 * s);
    fg.addColorStop(0, 'rgba(255,170,90,.16)'); fg.addColorStop(1, 'rgba(255,150,70,0)');
    x.fillStyle = fg; x.fillRect(hx - 160 * s, hy - 160 * s, 320 * s, 320 * s);
    x.save(); x.beginPath(); x.moveTo(hx - 6 * s, hy); x.lineTo(hx + 6 * s, hy); x.lineTo(hx + 70 * s, base); x.lineTo(hx - 70 * s, base); x.closePath();
    const cg2 = x.createLinearGradient(0, hy, 0, base); cg2.addColorStop(0, 'rgba(255,190,110,.13)'); cg2.addColorStop(1, 'rgba(255,170,90,.03)');
    x.fillStyle = cg2; x.fill(); x.restore();
    x.save(); x.translate(hx, base + 4 * s); x.scale(1, .16);
    const pg = x.createRadialGradient(0, 0, 0, 0, 0, 110 * s); pg.addColorStop(0, 'rgba(255,175,95,.5)'); pg.addColorStop(.5, 'rgba(255,150,70,.16)'); pg.addColorStop(1, 'rgba(255,140,60,0)');
    x.fillStyle = pg; x.fillRect(-110 * s, -110 * s, 220 * s, 220 * s); x.restore();
    x.globalCompositeOperation = 'source-over';
    // pole and arm, with a warm edge where the lamp catches them
    x.fillStyle = '#060607'; x.fillRect(lx - 2 * s, top, 4 * s, base - top); x.fillRect(lx, top, 28 * s, 4 * s);
    const eg = x.createLinearGradient(0, top, 0, base); eg.addColorStop(0, 'rgba(255,180,100,.55)'); eg.addColorStop(1, 'rgba(255,180,100,.05)');
    x.fillStyle = eg; x.fillRect(lx + 1 * s, top, 1.2 * s, base - top); x.fillRect(lx, top + 3 * s, 28 * s, 1 * s);
    x.fillStyle = '#0d0c0c'; x.fillRect(hx - 9 * s, top - 1 * s, 18 * s, 6 * s); // lamp housing
    let lg = x.createRadialGradient(hx, hy, 0, hx, hy, 70 * s);
    lg.addColorStop(0, 'rgba(255,214,150,1)'); lg.addColorStop(.08, 'rgba(255,180,90,.9)'); lg.addColorStop(.35, 'rgba(255,140,60,.18)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = lg; x.fillRect(hx - 70 * s, hy - 70 * s, 140 * s, 140 * s);
    const rg = x.createLinearGradient(0, base - 30 * s, 0, h + p);
    rg.addColorStop(0, 'rgba(255,170,80,.0)'); rg.addColorStop(.15, 'rgba(255,170,80,.32)'); rg.addColorStop(1, 'rgba(255,150,60,0)');
    x.fillStyle = rg;
    for (let k = 0; k < 6; k++) x.fillRect(hx - (5 - k) * s + (rnd() - .5) * 6 * s, base - 30 * s, (10 - k * 1.4) * s, h + p - base);
  }
  // traffic light
  x.fillStyle = '#050506'; x.fillRect(w * .58, h * .6, 3 * s, h * .2);
  x.fillRect(w * .58 - 8 * s, h * .6, 18 * s, 44 * s);
  const tl = x.createRadialGradient(w * .58 + 1 * s, h * .6 + 34 * s, 0, w * .58 + 1 * s, h * .6 + 34 * s, 26 * s);
  tl.addColorStop(0, 'rgba(120,255,170,1)'); tl.addColorStop(.25, 'rgba(60,220,140,.5)'); tl.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = tl; x.fillRect(w * .58 - 30 * s, h * .6, 60 * s, 70 * s);
  x.fillStyle = 'rgba(60,220,140,.22)'; x.fillRect(w * .58 - 3 * s, h * .8, 8 * s, h * .2 + p);

  // neon colours smeared down the wet street
  x.globalCompositeOperation = 'lighter';
  for (const [sx, , sw, , rgb] of signs) {
    const rg = x.createLinearGradient(0, street, 0, h);
    rg.addColorStop(0, `rgba(${rgb},.16)`); rg.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = rg;
    for (let k = 0; k < 4; k++) x.fillRect(sx + (sw * s) * (.15 + k * .22) + (rnd() - .5) * 4 * s, street, 5 * s, h - street + p);
  }
  x.globalCompositeOperation = 'source-over';
  // general reflected city glow on the wet street
  g = x.createLinearGradient(0, street, 0, h);
  g.addColorStop(0, 'rgba(255,150,90,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(-p, street, w + 2 * p, h - street + p);
}

// Safari (all iPhones) ignores ctx.filter, which left the fog layers unblurred and the fog thin.
// Detect real support by blurring one white pixel; fall back to a matching gaussian done by hand.
const NATIVE_BLUR = (() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 9;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 9, 9);
    const d = document.createElement('canvas'); d.width = d.height = 9;
    const y = d.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(4, 4, 1, 1);
    x.filter = 'blur(2px)'; x.drawImage(d, 0, 0);
    return x.getImageData(2, 4, 1, 1).data[0] > 0;          // light spread 2px sideways = blur works
  } catch (e) { return false; }
})();

// Gaussian blur of `src` (padded by p on every side) into ctx, equal to ctx.filter = blur(sigma px).
// Three box blurs approximate a gaussian (W3C/Kovesi method); big radii run at reduced resolution.
function softBlur(ctx, src, p, sigma) {
  const f = Math.max(1, Math.floor(sigma / 4));   // big radii blur at reduced resolution
  const W = Math.ceil(src.width / f), H = Math.ceil(src.height / f), s = sigma / f;
  const sm = document.createElement('canvas'); sm.width = W; sm.height = H;
  const sx = sm.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(src, 0, 0, W, H);
  const img = sx.getImageData(0, 0, W, H), a = img.data, b = new Uint8ClampedArray(a.length);
  const wl0 = Math.floor(Math.sqrt(12 * s * s / 3 + 1)), wl = wl0 % 2 ? wl0 : wl0 - 1, wu = wl + 2;
  const m = Math.round((12 * s * s - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  const box = (from, to, r, horiz) => {          // running-sum box blur, edges clamped
    const n = horiz ? W : H, lines = horiz ? H : W, step = horiz ? 4 : W * 4, k = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const base = horiz ? l * W * 4 : l * 4;
      for (let ch = 0; ch < 3; ch++) {
        const o = base + ch, f0 = from[o], fl = from[o + (n - 1) * step];
        let acc = (r + 1) * f0;
        for (let j = 0; j < r; j++) acc += j < n ? from[o + j * step] : fl;
        for (let i = 0; i < n; i++) {
          const ai = i + r, bi = i - r - 1;
          acc += (ai < n ? from[o + ai * step] : fl) - (bi >= 0 ? from[o + bi * step] : f0);
          to[o + i * step] = acc * k;
        }
      }
    }
  };
  for (let i = 0; i < 3; i++) { const r = ((i < m ? wl : wu) - 1) / 2; box(a, b, r, true); box(b, a, r, false); }
  for (let i = 3; i < a.length; i += 4) a[i] = 255;
  sx.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sm, 0, 0, W, H, -p, -p, W * f, H * f);
}

let CROP = 1;   // visible fraction of the painted street's width (below 1 on portrait screens)
function makeLayers(w, h) {
  const p = Math.round(h * .08);
  const sw = Math.max(w, Math.round(h * 1.25)), off = Math.round((sw - w) / 2);
  CROP = w / sw;
  const big = document.createElement('canvas'); big.width = sw + 2 * p; big.height = h + 2 * p;
  const bx = big.getContext('2d'); bx.translate(p - off, p); paintScene(bx, sw, h, p + off);
  const out = (blur) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (!blur) { x.drawImage(big, -p, -p); return c; }
    if (NATIVE_BLUR) { x.filter = `blur(${blur}px)`; x.drawImage(big, -p, -p); return c; }
    softBlur(x, big, p, blur); return c;
  };
  const k = h / 1000;
  return { sharp: out(1.1 * k), mid: out(5 * k), heavy: out(34 * k) };
}

// ---------- drop sprite: RG = surface normal, B = height, A = coverage ----------
function makeSprite(S) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (i + .5) / S * 2 - 1, dy0 = (j + .5) / S * 2 - 1;
    const dy = dy0 < 0 ? dy0 * 1.06 : dy0 * .96; // gravity: slightly heavier bottom
    const r = Math.hypot(dx, dy), k = (j * S + i) * 4;
    if (r >= 1) continue;
    const hgt = Math.sqrt(1 - r * r);
    d[k] = (dx * .5 + .5) * 255; d[k + 1] = (dy * .5 + .5) * 255; d[k + 2] = hgt * 255;
    d[k + 3] = clamp((1 - r) / .14, 0, 1) * 255;
  }
  x.putImageData(img, 0, 0); return c;
}
const sprite = makeSprite(96);

// ---------- water simulation (outside rain + inside drips) ----------
let water, wctx, mist, mctx, drops = [], drips = [], clearF, clearU8;
function setupSim() {
  water = document.createElement('canvas'); water.width = ww; water.height = wh; wctx = water.getContext('2d');
  mist = document.createElement('canvas'); mist.width = ww; mist.height = wh; mctx = mist.getContext('2d');
  drops = []; drips = [];
  gw = Math.ceil(VW / CELL); gh = Math.ceil(VH / CELL);
  clearF = new Float32Array(gw * gh); clearU8 = new Uint8Array(gw * gh);
  // pre-soak the glass so it looks like it has been raining for a while
  for (let i = 0; i < 2600 * AREA(); i++) spawnMist(); for (let i = 0; i < 420 * AREA(); i++) spawnDrop(true);
}
function spawnMist() {
  const r = (Math.pow(R(), 2.2) * 1.9 + .55) * WS, x = R() * ww, y = R() * wh;
  mctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
}
function spawnDrop(quiet) {
  const r = (1.7 + Math.pow(R(), 3.2) * 7.5) * WS, x = R() * ww, y = R() * wh * 1.02 - wh * .02;
  // an impact onto an existing bead merges into it
  for (const d of drops) {
    const dx = d.x - x, dy = d.y - y;
    if (dx * dx + dy * dy < (d.r + r * .6) ** 2) { d.r = Math.min(Math.hypot(d.r, r), 11 * WS); if (!quiet) tap(.012 + r / WS * .004); return; }
  }
  drops.push({ x, y, r, vy: 0, vx: 0, slide: false, trail: 0, pin: 0, seed: R() });
  if (!quiet && r > 4 * WS) tap(.008 + r / WS * .003);
}
const SLIDE_R = 5.4, STOP_R = 3.1;

function simulate(dt, intensity) {
  // new rain
  let n = intensity * 22 * RATE * dt * AREA();
  while (n > 0) { if (R() < n) spawnDrop(false); n -= 1; }
  let m = intensity * 260 * RATE * dt * AREA();
  while (m > 0) { if (R() < m) spawnMist(); m -= 1; }

  const G = 520 * WS;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (!d.slide) {
      if (d.r > SLIDE_R * WS && R() < dt * (d.r / WS - SLIDE_R + .4) * .9) { d.slide = true; d.vy = 8 * WS; }
      continue;
    }
    // pinning: the contact line catches and releases, giving stop/start motion
    if (d.pin > 0) { d.pin -= dt; } else {
      d.vy += G * (d.r / WS - 3.8) / 5 * dt;
      d.vy *= 1 - 1.8 * dt;
      d.vy = Math.min(d.vy, 620 * WS);
      if (R() < dt * (2.4 - d.r / WS * .18)) { d.pin = R() * .35; d.vy *= .2; }
    }
    if (R() < dt * 3) d.vx = (R() - .5) * d.vy * .22;
    const oy = d.y;
    d.y += d.vy * dt; d.x += d.vx * dt;
    // clear the mist it runs through
    mctx.globalCompositeOperation = 'destination-out';
    mctx.beginPath(); mctx.ellipse(d.x, (d.y + oy) / 2 - d.r * .2, d.r * .92, d.r * .92 + (d.y - oy) / 2, 0, 0, 7); mctx.fill();
    mctx.globalCompositeOperation = 'source-over';
    // leave a trail of tiny beads, losing mass
    d.trail += d.y - oy;
    if (d.trail > d.r * (1.1 + R() * 1.6)) {
      d.trail = 0;
      const tr = d.r * (.14 + R() * .2);
      drops.push({ x: d.x + (R() - .5) * d.r * .5, y: d.y - d.r * (1 + R() * .4), r: tr, vy: 0, vx: 0, slide: false, trail: 0, pin: 0, seed: R() });
      d.r = Math.sqrt(Math.max(0, d.r * d.r - tr * tr * 1.4));
    }
    // swallow beads in its path
    for (let j = drops.length - 1; j >= 0; j--) {
      const o = drops[j]; if (o === d) continue;
      const dx = o.x - d.x, dy = o.y - d.y, rr = (d.r + o.r) * .82;
      if (dy > -d.r * 2 && dx * dx + dy * dy < rr * rr) {
        if (o.r > d.r && o.slide) continue;
        d.r = Math.min(Math.hypot(d.r, o.r), 12 * WS); d.vy += o.r / WS * 10 * WS;
        drops.splice(j, 1); if (j < i) i--;
      }
    }
    if (d.r < STOP_R * WS) { d.slide = false; d.vy = 0; }
    if (d.y - d.r * 3 > wh) drops.splice(i, 1);
  }
  // keep the bead count bounded: evaporate the oldest small static ones
  const MAX = 1100 * RATE * AREA();
  if (drops.length > MAX) { let cut = drops.length - MAX; for (let i = 0; i < drops.length && cut > 0; i++) if (!drops[i].slide) { drops.splice(i, 1); i--; cut--; } }

  // slow evaporation of the mist layer so it never saturates
  mistFade += dt;
  if (mistFade > 1.4) { mistFade = 0; mctx.globalCompositeOperation = 'destination-out'; mctx.fillStyle = 'rgba(0,0,0,.035)'; mctx.fillRect(0, 0, ww, wh); mctx.globalCompositeOperation = 'source-over'; }

  // inside drips from wiped condensation: run down and cut channels through the fog
  for (let i = drips.length - 1; i >= 0; i--) {
    const d = drips[i];
    d.life -= dt;
    if (d.pin > 0) d.pin -= dt; else { d.vy = Math.min(d.vy + 60 * dt, d.max); if (R() < dt * 1.2) d.pin = R() * .6; }
    const py0 = d.y;
    d.y += d.vy * dt * WS; d.x += Math.sin(d.y * .05 + d.seed * 6) * .15 * WS;
    d.r -= dt * .09 * WS;
    for (let yy = py0; yy <= d.y; yy += CELL * WS * .5) stampClear(d.x / WS, yy / WS, d.r / WS * .8, 1.35, 0, 1, false);
    stampClear(d.x / WS, d.y / WS, d.r / WS * .8, 1.35, 0, 1, false);
    if (d.r < .8 * WS || d.life < 0 || d.y > wh + 10) drips.splice(i, 1);
  }
}
let mistFade = 0;

function renderWater() {
  wctx.clearRect(0, 0, ww, wh);
  wctx.drawImage(mist, 0, 0);
  for (const d of drops) {
    let sx = 1, sy = 1;
    if (d.slide) { const k = Math.min(d.vy / (380 * WS), 1); sx = 1 - k * .14; sy = 1 + k * .55; }
    wctx.drawImage(sprite, d.x - d.r * sx, d.y - d.r * (2 * sy - 1), d.r * sx * 2, d.r * sy * 2);
  }
  for (const d of drips) wctx.drawImage(sprite, d.x - d.r * .9, d.y - d.r * 1.3, d.r * 1.8, d.r * 2.3);
}

// ---------- condensation (clear-map) ----------
let BRUSH = pos(o.brush, DEFAULTS.brush);
const HOLD = 1.9;
let DECAY = pos(o.refog, DEFAULTS.refog);
let stripe = 0;
function stampClear(px, py, rad, val, dx, dy, streaks) {
  const gx = px / CELL, gy = py / CELL, gr = rad / CELL;
  const x0 = Math.max(0, Math.floor(gx - gr)), x1 = Math.min(gw - 1, Math.ceil(gx + gr));
  const y0 = Math.max(0, Math.floor(gy - gr)), y1 = Math.min(gh - 1, Math.ceil(gy + gr));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const ox = i + .5 - gx, oy = j + .5 - gy, dd = Math.hypot(ox, oy) / gr;
    if (dd >= 1) continue;
    let s = 1 - smooth(.3, 1, dd);
    if (streaks) { const perp = (ox * -dy + oy * dx) * CELL; s *= .97 + .03 * Math.sin(perp * .6 + stripe); }
    const k = j * gw + i; if (clearF[k] < s * val) clearF[k] = s * val;
  }
}
function decayClear(dt) {
  const f = clearF, u = clearU8;
  for (let k = 0; k < f.length; k++) {
    let v = f[k]; if (v > 0) { v -= dt * DECAY; f[k] = v > 0 ? v : 0; }
    u[k] = v >= 1.2 ? 255 : v <= 0 ? 0 : (v / 1.2 * 255) | 0;
  }
}

// ---------- WebGL ----------
const VS = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0,1); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSharp, uMid, uHeavy, uWater, uClear;
uniform vec2 uRes; uniform float uTime, uFlash, uAspect, uRain, uCrop; uniform vec2 uCss;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+17.1; a*=.5; } return v; }

float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
// street-lamp light falling on things at street level (lamps repeat every .21 of the width)
float lampAt(float x){ return pow(.5 + .5*cos((x - .095)*6.2832/.21), 8.); }
float glow(vec2 d, float r){ return exp(-dot(d,d)/(r*r)); }

// cars seen side-on from the window: body + cabin + wheels, lit by the street lamps,
// white headlight in front with a beam on the wet road, red tail light behind,
// and long vertical reflections of both lights in the asphalt
void cars(vec2 uv, float blur, out vec3 add, out vec3 body, out float mask){
  add = vec3(0); body = vec3(0); mask = 0.;
  for(int i=0;i<6;i++){
    float fi = float(i);
    bool farLane = mod(fi,2.) < 1.;
    float dir = farLane ? -1. : 1.;
    float sc = farLane ? 1.15 : 1.5;
    float spd = (.035 + .03*hash(vec2(fi,3.1))) * (farLane ? .85 : 1.);
    float xc = fract(uTime*spd + hash(vec2(fi,7.7)))*1.9 - .45;
    if(dir < 0.) xc = 1. - xc;
    float gy = farLane ? .79 : .83;                       // wheel contact line
    vec2 q = (uv - vec2(xc, gy)) * vec2(uAspect, 1.) / sc;
    q.x *= dir;                                             // +x = front of the car
    float hs = hash(vec2(fi, 11.3));
    float lower = sdBox(q - vec2(0., -.0125), vec2(.036, .0062), .0035);
    float cabin = sdBox(q - vec2(-.004 + (hs-.5)*.004, -.0215), vec2(.018 - hs*.003, .0048), .0045);
    float wheels = min(length(q - vec2(.023, -.0055)), length(q - vec2(-.024, -.0055))) - .0052;
    float d = min(min(lower, cabin), wheels);
    float e = .0009 + blur*.6;
    float m = smoothstep(e, -e, d);
    if(m > .001){
      vec3 paint = mix(vec3(.05,.052,.06), vec3(.16,.02,.02), step(.6,hs)) ; paint = mix(paint, vec3(.09,.1,.12), step(.85,hs));
      float lamp = lampAt((uv.x - .5) * uCrop + .5);
      float top = smoothstep(-.006, -.018, q.y) * (1. - smoothstep(-.018, -.0265, q.y));
      vec3 bc = paint * (.35 + lamp*.9);
      bc += vec3(1.,.72,.42) * lamp * .22 * smoothstep(.0015, -.001, abs(lower + .0012)) * step(q.y, -.012);   // roofline / beltline sheen
      bc += vec3(1.,.72,.42) * lamp * .12 * smoothstep(.0012, -.0005, abs(cabin + .001)) * step(q.y, -.021);
      float glass = smoothstep(.0008, -.0008, cabin + .0018) * step(q.y, -.0172);
      bc = mix(bc, vec3(.03,.035,.05) + vec3(.35,.3,.25)*lamp*.25 + vec3(.2,.25,.35)*.12*smoothstep(-.03,-.015,q.y+q.x*.3), glass);
      bc = mix(bc, vec3(.008), smoothstep(.001, -.001, wheels));
      bc *= 1. - top*0.;
      body = mix(body, bc, m); mask = max(mask, m);
    }
    float r = .0026 + blur;
    float fall = pow(.0026/r, 1.1);
    // headlight + beam on the road ahead
    vec2 hp = q - vec2(.037, -.0125);
    add += vec3(1.,.93,.8) * 1.7 * glow(hp, r) * fall;
    add += vec3(1.,.9,.75) * .35 * exp(-pow(max(hp.x,0.)/.07,2.)) * step(0.,hp.x) * exp(-pow((q.y-.0015)/(.003+blur),2.)) * smoothstep(0.,.01,hp.x);
    // tail light (brakes now and then)
    float brake = .55 + .45*step(.8, fract(uTime*.13 + hs*5.));
    vec2 tp = q - vec2(-.0375, -.0135);
    add += vec3(1.,.07,.04) * 1.2 * brake * glow(tp*vec2(1.,.8), r) * fall;
    // wet-road reflections under both lights
    float below = step(0., q.y);
    add += vec3(1.,.9,.75) * .28 * exp(-hp.x*hp.x/(r*r*1.5)) * below * exp(-q.y*55./sc) * pow(.0026/r,.8);
    add += vec3(1.,.08,.04) * .22 * brake * exp(-tp.x*tp.x/(r*r*1.5)) * below * exp(-q.y*55./sc) * pow(.0026/r,.8);
  }
}

// rain falling through the street light, three depth layers
float rainfall(vec2 uv){
  float s = 0.;
  for(int i=0;i<3;i++){
    float fi = float(i), sc = 55. + fi*60.;
    vec2 p = vec2((uv.x + uv.y*.09)*uAspect*sc, uv.y*sc*.16 - uTime*(2.4 + fi*1.1));
    vec2 id = floor(p), f = fract(p);
    float h = hash(id + fi*19.);
    if(h > .9){
      float xo = .15 + .7*hash(id + 3.7);
      s += smoothstep(.06 + fi*.02, 0., abs(f.x - xo)) * smoothstep(0.,.4,f.y) * smoothstep(1.,.55,f.y) * (.3 + fi*.3);
    }
  }
  return s;
}

vec3 scene(vec2 uv, float fog){
  vec3 s = texture(uSharp, uv).rgb, m = texture(uMid, uv).rgb, h = texture(uHeavy, uv).rgb;
  vec3 col = mix(mix(s, m, .62), h, smoothstep(0., .9, fog));
  vec3 ca, cb; float cm;
  cars(uv, mix(0., .03, fog), ca, cb, cm);
  col = mix(col, cb, cm * (1. - fog*.6)) + ca;
  // lightning lights everything: the sky blazes, buildings and street pick up a cold wash
  float sky = smoothstep(.72, .1, uv.y);
  float lumC = dot(col, vec3(.33));
  col += uFlash * (vec3(.5,.55,.75)*sky*(.55+.45*fbm(uv*3. + uTime*.2)) + vec3(.07,.08,.11) + col*.9 + (1.-sky)*vec3(.05,.06,.08)*(1.-lumC));
  float lum = dot(m, vec3(.3,.55,.15));
  col += rainfall(uv) * uRain * (lum*1.7 + .035 + uFlash*.5) * (1. - fog*.9) * vec3(.82,.86,.95);
  return col;
}

void main(){
  vec2 uv = vUv;
  vec2 a2 = uv*vec2(uAspect,1.);

  // --- condensation (inside) ---
  float c = texture(uClear, uv).r;
  float nuc = fbm(a2*7.);                 // re-fogging nucleates in patches
  float grain = noise(uv*uCss/1.8);       // micro droplet grain, sized in CSS px
  float clearV = smoothstep(.06, .72, c*1.15 - (nuc-.5)*.6 - (grain-.5)*.12);
  float density = clamp(.8 + .28*(fbm(a2*1.6 + 4.)-.5) + .2*smoothstep(.5, 1., uv.y) + .08*smoothstep(193.,0.,min(uv.x,1.-uv.x)*uCss.x), 0., 1.);
  float fog = (1. - clearV) * density;
  vec3 hv = texture(uHeavy, uv).rgb;
  vec3 milk = vec3(.07,.075,.085) + hv*.42 + uFlash*vec3(.16,.17,.21);   // fog scatters the flash

  // --- rain (outside) ---
  vec4 w = texture(uWater, uv);
  float cover = smoothstep(.3, .7, w.a);
  vec2 n = (w.rg - .5) * 2.;
  float ht = w.b;

  vec3 col = scene(uv, fog);
  col = mix(col, col*.72 + milk, fog*.88);
  col += (grain - .5) * .03 * fog;

  if(cover > .001){
    // a bead is a lens: it shows an inverted miniature of the scene behind it
    vec2 ruv = clamp(uv - n*vec2(.075/uAspect, .075)*(.6 + ht*.6), .001, .999);
    vec3 dc = scene(ruv, fog*.85 + .05) * 1.1;
    float rim = pow(1. - ht, 2.6);
    dc *= 1. - rim*.82;                                          // dark refractive edge
    dc += smoothstep(.25, .95, n.y) * ht * (.06 + dot(texture(uMid, uv).rgb, vec3(.33))*.35); // bottom caustic
    vec3 N = normalize(vec3(n*1.4, max(ht, .04)));
    float sp = pow(max(dot(N, normalize(vec3(-.35,-.62,.7))), 0.), 70.) * 1.1
             + pow(max(dot(N, normalize(vec3(.5,-.2,.84))), 0.), 180.) * .35;
    dc += sp * vec3(1.,.95,.88) * (1. - fog*.75);
    dc = mix(dc, dc*.72 + milk*1.05, fog*.8);                    // beads are seen through the fog
    col = mix(col, dc, cover);
  }

  // faint reflection of the warm room on the glass
  col += vec3(1.,.78,.5) * .03 * exp(-length((uv - vec2(.12,.16))*vec2(uAspect,1.))*2.6) * (1. - fog*.5);
  col += vec3(1.,.8,.6) * .012 * smoothstep(.6, 1., uv.y);

  vec2 q = uv - .5; col *= 1. - dot(q*vec2(1.1,1.), q)*.6;
  col += (hash(uv*uRes + fract(uTime)*91.) - .5) * .014;
  o = vec4(clamp(col, 0., 1.), 1.);
}`;

function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = {}; for (const n of ['uSharp', 'uMid', 'uHeavy', 'uWater', 'uClear', 'uRes', 'uTime', 'uFlash', 'uAspect', 'uRain', 'uCrop', 'uCss']) U[n] = gl.getUniformLocation(prog, n);
function mkTex(unit) { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
const T = { sharp: mkTex(0), mid: mkTex(1), heavy: mkTex(2), water: mkTex(3), clear: mkTex(4) };
['uSharp', 'uMid', 'uHeavy', 'uWater', 'uClear'].forEach((n, i) => gl.uniform1i(U[n], i));
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
function upload(unit, t, src) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }

  /* ------------------------------------------------------------------
   * paw-fx seams: input, resize, visibility and the loop. Upstream's
   * lines 505-591 and 764-855 bind these to the window, drive a custom
   * cursor and a Web Audio bed off them, and expose a test harness on
   * window.__rain; here they are bound to the section and the sound is
   * gone. tap() and thunder() stay as no-ops so the calls to them inside
   * the verbatim block above are left exactly as upstream wrote them.
   * ------------------------------------------------------------------ */

  function tap() {}
  function thunder() {}

  function resize() {
    VW = el.clientWidth; VH = el.clientHeight; DPR = Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
    if (!(VW > 0) || !(VH > 0)) return false;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    gl.viewport(0, 0, cv.width, cv.height);
    WS = Math.min(1.25, 1800 / VW) * Math.min(DPR, 1.25); ww = Math.round(VW * WS); wh = Math.round(VH * WS);
    const bw = Math.min(Math.round(VW * DPR), 2400), bh = Math.round(bw * VH / VW);
    const L = makeLayers(bw, bh);
    upload(0, T.sharp, L.sharp); upload(1, T.mid, L.mid); upload(2, T.heavy, L.heavy);
    setupSim();
    return true;
  }

  // Upstream reads the pointer in client coordinates and scales by the window,
  // which is the identity while the glass IS the window. The section's own box
  // is what that scale has to be against here.
  var down = false, lx = 0, ly = 0;
  function glassX(e) { return e.clientX - el.getBoundingClientRect().left; }
  function glassY(e) { return e.clientY - el.getBoundingClientRect().top; }
  function move(e) {
    if (!down) return;
    const nx = glassX(e), ny = glassY(e);
    const dx = nx - lx, dy = ny - ly, len = Math.hypot(dx, dy);
    if (len < .5) return;
    const ux = dx / len, uy = dy / len, step = BRUSH * .22;
    for (let t = step; t <= len; t += step) wipeAt(lx + ux * t, ly + uy * t, ux, uy);
    lx = nx; ly = ny;
  }
  function desce(e) {
    down = true;
    lx = glassX(e); ly = glassY(e); stripe = Math.random() * 6.28;
    wipeAt(lx, ly, 1, 0);
  }
  function sobe() { down = false; }
  function wipeAt(x, y, ux, uy) {
    stampClear(x, y, BRUSH, HOLD, ux, uy, true);
    // condensation pushed to the rim of the stroke gathers and sometimes runs
    if (Math.random() < .018 && drips.length < 40) {
      const a = Math.random() * Math.PI, ex = x + Math.cos(a) * BRUSH * .85, ey = y + Math.sin(a) * BRUSH * .85;
      drips.push({ x: ex * WS, y: ey * WS, r: (2.2 + Math.random() * 1.8) * WS, vy: 0, max: 22 + Math.random() * 38, pin: .3 + Math.random(), life: 5 + Math.random() * 6, seed: Math.random() });
    }
  }
  el.addEventListener('pointerdown', desce);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', sobe);
  el.addEventListener('pointerleave', sobe);
  window.addEventListener('blur', sobe);

  var rt = null;
  var ro = new ResizeObserver(function () {
    if (el.clientWidth === VW && Math.abs(el.clientHeight - VH) < VH * .3) return;
    clearTimeout(rt);
    rt = setTimeout(resize, 200);
  });

  // Repainting the street and re-soaking the glass every frame is the cheap
  // part; the bead step and the clear-map sweep are not, so they stop while
  // nobody can see them. Starts true, so a browser that never delivers a
  // callback still runs.
  var visivel = true, raf = 0, vivo = false;
  var io = new IntersectionObserver(function (es) {
    visivel = es[es.length - 1].isIntersecting;
    if (visivel && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  var last = performance.now(), time = 0, flash = 0, nextBolt = 4 + Math.random() * 4, bolt = null;
  function frame(now) {
    if (!visivel) { raf = 0; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
    const intensity = clamp(.8 + .3 * Math.sin(time * .06) + .18 * Math.sin(time * .21 + 1.3), .45, 1.25);

    simulate(dt, intensity);
    decayClear(dt);
    renderWater();

    // lightning: mostly faint far-off flickers, sometimes a close strike
    nextBolt -= dt;
    if (nextBolt < 0 && !bolt) {
      const near = Math.random() < .3;
      nextBolt = near ? 16 + Math.random() * 18 : 6 + Math.random() * 10;
      const pw = near ? .8 + Math.random() * .4 : .18 + Math.random() * .25;
      const pulses = []; let pt = 0; const np = 1 + (Math.random() * (near ? 4 : 3) | 0);
      for (let k = 0; k < np; k++) { pulses.push([pt, pw * (k ? .35 + Math.random() * .6 : 1), .03 + Math.random() * .05]); pt += .06 + Math.random() * .2; }
      bolt = { t: 0, pulses, end: pt + .6 };
      thunder();
    }
    if (bolt) {
      bolt.t += dt; flash = 0;
      for (const [pt, a, wd] of bolt.pulses) { const x = bolt.t - pt; if (x > -.02) flash += a * Math.exp(-x * x / (wd * wd * .5)) + (x > 0 ? a * .12 * Math.exp(-x * 3) : 0); }
      if (bolt.t > bolt.end) { bolt = null; flash = 0; }
    }

    upload(3, T.water, water);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, T.clear);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gw, gh, 0, gl.RED, gl.UNSIGNED_BYTE, clearU8);
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uFlash, flash);
    gl.uniform1f(U.uAspect, VW / VH); gl.uniform1f(U.uRain, intensity); gl.uniform1f(U.uCrop, CROP); gl.uniform2f(U.uCss, VW, VH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // only once a frame is on the canvas, so the CSS rest never fades out
    // from under an empty one
    if (!vivo) { vivo = true; el.setAttribute('data-fx-live', ''); }
    raf = requestAnimationFrame(frame);
  }

  el.insertBefore(cv, el.firstChild);
  if (!resize()) return resting;
  ro.observe(el);
  io.observe(el);
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    update: function (next) {
      Object.assign(o, next || {});
      RATE = pos(o.rain, DEFAULTS.rain);
      DECAY = pos(o.refog, DEFAULTS.refog);
      BRUSH = pos(o.brush, DEFAULTS.brush);
    },
    destroy: function () {
      visivel = false;
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(rt);
      ro.disconnect(); io.disconnect();
      el.removeEventListener('pointerdown', desce);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', sobe);
      el.removeEventListener('pointerleave', sobe);
      window.removeEventListener('blur', sobe);
      var perda = gl.getExtension('WEBGL_lose_context');
      if (perda) perda.loseContext();
      cv.remove();
      el.removeAttribute('data-fx-live');
    }
  };
  }
}

export const meta = {
  name: "wipe-glass",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    rain: { type: "number", default: 1.2958, min: 0.2, max: 3, description: "Spawn and cap multiplier for the rain on the outside of the pane (upstream RATE, calibrated so the reference 1608x926 view reproduces exactly). Higher is a heavier storm: more beads, more runners, more of the street hidden." },
    refog: { type: "number", default: 0.15, min: 0.02, max: 1, description: "How fast a wiped patch steams back up, in clear-map units per second (upstream DECAY). At the default a stroke stays readable for several seconds; at 1 it closes almost as fast as you draw it." },
    brush: { type: "number", default: 36, min: 8, max: 120, description: "Radius of the wipe, in CSS pixels (upstream BRUSH). This is the size of the hand on the glass, so it also sets how far out the drips are thrown from a stroke." },
  },
};
