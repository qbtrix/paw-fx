// Sunset Flow Field by uahz — MIT License
// https://github.com/uahz/perlin-flow-field
//
// MIT License
// Copyright (c) 2026 uahz
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// perlin-flow-field: a port of uahz/perlin-flow-field at commit
// 9dd05d821bfb4682cb9746519c7ccd24e66fe13a (index.html). Thousands of particles
// trace a seeded Perlin-noise flow field in a sunset ramp, their trails decaying
// under destination-out, with a warm glow, vignette and grain layer on top.
// Upstream's script is kept in order and verbatim apart from the seams: the
// stage is the section's box instead of the window, the seed is an option
// (update({ seed }) cross-fades to a new field the way upstream's Regenerate
// button does), and the page chrome (brand, stats panel, buttons, R/S keys,
// PNG export) is left behind. Every seam is listed in meta.json.deviations.

const TAU = Math.PI * 2;
const B = 16;              // palette buckets (stroke in colour batches, fewer stroke calls)
const MAXN = 12000;

/* ---------- seeded random & Perlin noise ---------- */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makePerlin(seed){
  const rand = mulberry32(seed);
  const p = new Uint8Array(512), perm = new Uint8Array(256);
  for(let i = 0; i < 256; i++) perm[i] = i;
  for(let i = 255; i > 0; i--){
    const j = (rand() * (i + 1)) | 0;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for(let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  function grad(h, x, y, z){
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  return function(x, y, z){
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const Bq = p[X + 1] + Y, BA = p[Bq] + Z, BB = p[Bq + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z),     grad(p[BA], x - 1, y, z), u),
           lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1),     grad(p[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  };
}

/* ---------- sunset palette: indigo → magenta → coral → amber ---------- */
const RAMP = ['#38296f','#5c49cf','#9c4bd0','#e0509e','#ff6e62','#ff9450','#ffc45e','#ffe8b0'];
const bucketStyle = new Array(B);
(function buildRamp(){
  const stops = RAMP.map(h => [
    parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)
  ]);
  for(let b = 0; b < B; b++){
    const t = b / (B - 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
    const r = Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f);
    const g = Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f);
    const c = Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f);
    bucketStyle[b] = 'rgb(' + r + ',' + g + ',' + c + ')';
  }
})();

/* ---------- trig lookup tables (instead of per-particle Math.cos/sin) ---------- */
const TRIG_N = 4096, TRIG_MASK = 4095, TRIG_SCALE = TRIG_N / TAU;
const SIN_T = new Float32Array(TRIG_N), COS_T = new Float32Array(TRIG_N);
for(let i = 0; i < TRIG_N; i++){
  const a = i / TRIG_N * TAU;
  SIN_T[i] = Math.sin(a);
  COS_T[i] = Math.cos(a);
}

const DEFAULTS = { seed: "" };
// "" or anything that is not 1-8 hex digits means a random seed, as upstream.
const parseSeed = (s) => /^#?[0-9a-f]{1,8}$/i.test(String(s).trim())
  ? parseInt(String(s).trim().replace("#", ""), 16) >>> 0
  : null;

export function mount(el, opts = {}){
  const resting = { update() {}, destroy() {} };
  if(!el || typeof document === "undefined") return resting;
  // Upstream's reduced path still animates (a slower timeScale); the contract
  // is to stay at rest, so the CSS glow is the section under reduced motion.
  if(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return resting;

  const o = Object.assign({}, DEFAULTS, opts);
  const art = document.createElement("canvas"), fx = document.createElement("canvas");
  art.className = "fx-perlin-flow-field__art";
  fx.className = "fx-perlin-flow-field__fx";
  art.setAttribute("aria-hidden", "true");
  fx.setAttribute("aria-hidden", "true");
  const actx = art.getContext('2d'), fctx = fx.getContext('2d');
  if(!actx || !fctx) return resting;
  const reduced = false; // the early return above owns reduced motion

  /* ---------- state ---------- */
  const px = new Float32Array(MAXN), py = new Float32Array(MAXN);
  const ox = new Float32Array(MAXN), oy = new Float32Array(MAXN);
  const life = new Float32Array(MAXN);
  const col = new Uint8Array(MAXN);
  const counts = new Int32Array(B), starts = new Int32Array(B + 1), cursor = new Int32Array(B), order = new Int32Array(MAXN);

  let W = 0, H = 0, dpr = 1, N = 0;
  let noise = null, ns = 0, swirl = 0, speed = 0, fadeRate = 0, timeScale = 0, zTime = 0;
  let noise2 = null, ns2 = 0, transT = 1, transDur = 1;   // old field cross-fade state
  let seed = 0;
  let rnd = Math.random;

  function newSeed(fixed){
    // Seamless regen: the old noise field is kept for 1.2 s to cross-fade; no
    // clear, no particle reset, no synchronous prewarm.
    if(noise){
      noise2 = noise; ns2 = ns;
      transT = 0; transDur = 1.2;
    }
    seed = fixed != null ? fixed : (Math.random() * 4294967296) >>> 0;
    const R = mulberry32(seed);
    rnd = R;
    noise = makePerlin((R() * 4294967296) >>> 0);
    ns = 1 / (340 + R() * 420);              // noise frequency → eddy size
    swirl = TAU * (1.05 + R() * 1.35);       // noise value → flow angle gain
    speed = 90 + R() * 80;                   // base flow speed px/s
    fadeRate = -Math.log(1 - (0.022 + R() * 0.02)) * 60;   // trail decay per second → trail length
    timeScale = (0.045 + R() * 0.075) * (reduced ? 0.35 : 1);
  }

  function respawn(i){
    px[i] = rnd() * W; py[i] = rnd() * H;
    ox[i] = px[i]; oy[i] = py[i];
    life[i] = 2 + rnd() * 5;
    // colour from low-frequency noise at the spawn point (large colour regions), plus jitter
    const c = (noise(px[i] * 0.0016 + 7.31, py[i] * 0.0016 + 3.17, zTime * 0.5) + 1) * 0.5;
    const m = Math.max(0, Math.min(1, c * 0.62 + (rnd() + rnd()) * 0.19));
    col[i] = Math.min(B - 1, (m * B) | 0);
  }
  function respawnAll(){ if(noise) for(let i = 0; i < N; i++) respawn(i); }

  /* ---------- canvas size & static fx layer (warm glow + vignette + grain) ---------- */
  function drawFX(){
    fctx.clearRect(0, 0, W, H);
    let g = fctx.createRadialGradient(W * 0.5, H * 0.44, 0, W * 0.5, H * 0.44, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(255,122,72,0.10)');
    g.addColorStop(0.45, 'rgba(232,80,158,0.045)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = g; fctx.fillRect(0, 0, W, H);

    g = fctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.38, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(6,3,12,0)');
    g.addColorStop(0.75, 'rgba(6,3,12,0.26)');
    g.addColorStop(1, 'rgba(4,2,10,0.66)');
    fctx.fillStyle = g; fctx.fillRect(0, 0, W, H);

    const grain = Math.min(4200, Math.round(W * H / 450));
    for(let i = 0; i < grain; i++){
      fctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.05)';
      fctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
  }

  function resize(){
    // The observer's initial callback must not wipe the prewarmed trails.
    if(N && el.clientWidth === W && el.clientHeight === H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth; H = el.clientHeight;
    art.width = Math.round(W * dpr); art.height = Math.round(H * dpr);
    fx.width = art.width; fx.height = art.height;
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.lineCap = 'round';
    N = Math.max(5000, Math.min(9000, Math.round(W * H / 260)));
    drawFX();
    actx.clearRect(0, 0, W, H);
    respawnAll();
  }

  /* ---------- per frame: decay old trails → bucket by colour → advance and batch-stroke ---------- */
  function stepAndDraw(dt){
    // old/new field cross-fade progress (smoothstep): u=1 means fully the new field
    let u = 1;
    if(noise2 !== null){
      transT += dt;
      const r = transT / transDur;
      if(r >= 1){ noise2 = null; }
      else u = r * r * (3 - 2 * r);
    }
    // decay and stroke alpha both scale with dt: same trail length at any refresh rate
    actx.globalCompositeOperation = 'destination-out';
    actx.globalAlpha = 1 - Math.exp(-fadeRate * dt);
    actx.fillStyle = '#000';
    actx.fillRect(0, 0, W, H);

    counts.fill(0);
    for(let i = 0; i < N; i++) counts[col[i]]++;
    starts[0] = 0;
    for(let b = 0; b < B; b++){ starts[b + 1] = starts[b] + counts[b]; cursor[b] = starts[b]; }
    for(let i = 0; i < N; i++) order[cursor[col[i]]++] = i;

    actx.globalCompositeOperation = 'lighter';
    actx.globalAlpha = Math.min(0.85, 0.30 * dt * 60);
    actx.lineWidth = 1.1;
    for(let b = 0; b < B; b++){
      actx.strokeStyle = bucketStyle[b];
      actx.beginPath();
      for(let k = starts[b]; k < starts[b + 1]; k++){
        const i = order[k];
        let n;
        if(u === 1){
          n = noise(px[i] * ns, py[i] * ns, zTime);
        }else{
          n = noise2(px[i] * ns2, py[i] * ns2, zTime) * (1 - u)
            + noise(px[i] * ns, py[i] * ns, zTime) * u;
        }
        const ti = (n * swirl * TRIG_SCALE) & TRIG_MASK;
        const sp = speed * (0.7 + 0.6 * (n < 0 ? -n : n));
        const nx = px[i] + COS_T[ti] * sp * dt;
        const ny = py[i] + SIN_T[ti] * sp * dt;
        ox[i] = px[i]; oy[i] = py[i];
        px[i] = nx; py[i] = ny;
        life[i] -= dt;
        if(life[i] <= 0 || nx < -24 || nx > W + 24 || ny < -24 || ny > H + 24){ respawn(i); continue; }
        actx.moveTo(ox[i], oy[i]);
        actx.lineTo(nx, ny);
      }
      actx.stroke();
    }
  }

  function prewarm(){
    for(let k = 0; k < 80; k++){
      zTime += timeScale / 60;
      stepAndDraw(1 / 60);
    }
  }

  /* ---------- main loop: particle density follows measured FPS, 60 FPS first ---------- */
  let lastT = performance.now();
  let wStart = performance.now(), wFrames = 0, fpsWin = 0, fpsOkPrev = false;
  const N_MIN = 2000, N_MAX = 11000;
  function adapt(){
    if(fpsWin <= 0 || noise2 !== null) return;   // no frame data / cross-fading: hold
    const f = fpsWin;
    let delta = 0;
    if(f < 55 && N > N_MIN){
      // below 60 FPS → shed particles to stay smooth; faster the further it drops
      delta = -Math.max(300, (N * (f < 40 ? 0.2 : 0.12)) | 0);
      fpsOkPrev = false;
    }else if(f >= 58 && fpsOkPrev && N < N_MAX){
      // a full second at the 60 FPS tier → densify step by step
      delta = Math.max(150, (N * 0.04) | 0);
    }
    fpsOkPrev = f >= 58;
    if(delta){
      const oldN = N;
      N = Math.max(N_MIN, Math.min(N_MAX, N + delta));
      for(let i = oldN; i < N; i++) respawn(i);
    }
  }

  let raf = 0, visible = true, live = false, dead = false, rzT;
  function frame(now){
    raf = 0;
    if(dead || !visible) return;
    raf = requestAnimationFrame(frame);
    let dtRaw = (now - lastT) / 1000;
    lastT = now;
    if(!(dtRaw > 0) || dtRaw > 1) dtRaw = 0.016;   // guard for a tab switched back
    const dt = Math.min(dtRaw, 0.033);
    wFrames++;
    if(now - wStart >= 1000){                      // real frame rate once a second
      fpsWin = wFrames * 1000 / (now - wStart);
      wFrames = 0; wStart = now;
      adapt();
    }
    zTime += dt * timeScale;
    stepAndDraw(dt);
    if(!live){ live = true; el.setAttribute("data-fx-live", ""); }
  }

  const ro = new ResizeObserver(function(){ clearTimeout(rzT); rzT = setTimeout(resize, 150); });
  const io = new IntersectionObserver(function(es){
    visible = es[es.length - 1].isIntersecting;
    if(visible && !raf && !dead){ lastT = performance.now(); wStart = lastT; wFrames = 0; raf = requestAnimationFrame(frame); }
  });

  el.insertBefore(fx, el.firstChild);
  el.insertBefore(art, fx);
  resize();
  newSeed(parseSeed(o.seed));
  respawnAll();
  prewarm();
  ro.observe(el);
  io.observe(el);

  return {
    update(next){
      Object.assign(o, next || {});
      if(next && "seed" in next) newSeed(parseSeed(o.seed));
    },
    destroy(){
      dead = true;
      if(raf) cancelAnimationFrame(raf);
      clearTimeout(rzT);
      ro.disconnect(); io.disconnect();
      art.remove(); fx.remove();
      el.removeAttribute("data-fx-live");
    },
  };
}

export const meta = {
  name: "perlin-flow-field",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    seed: { type: "string", default: "", description: "Field seed as 1-8 hex digits (upstream shows it as #3FA2C91E). Empty picks a random field on every mount, as upstream does. Changing it through update() cross-fades to the new field over 1.2 s, like upstream's Regenerate button." },
  },
};
