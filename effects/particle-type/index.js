// Particle Type by jackthecoder17 — MIT License
// https://github.com/jackthecoder17/particle-type
//
// MIT License
// Copyright (c) 2026 jackthecoder17
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
// particle-type: a port of jackthecoder17/particle-type at commit
// 474de3f7e46dedc823792e49c9624efe249ec3a9 (index.html). Thousands of Canvas 2D
// particles spring into the lit pixels of a word, glow in additive palette
// colour with short trails, swirl away from the cursor and shatter on a click.
// Upstream's script is kept in order and verbatim apart from the seams: the
// stage is the section's box instead of the window, the word comes from the
// section's own heading (or opts.text) instead of an input dock, and the page
// chrome (dock, swatches, stats line, Space key) is left behind. Every seam is
// listed in meta.json.deviations.

const PALETTES = {
  ember:  ["#ff3d7f", "#ff5e3a", "#ff9a3c", "#ffd166", "#fff1c9"],
  aurora: ["#5eead4", "#60a5fa", "#a78bfa", "#f0abfc", "#e0e7ff"],
  tide:   ["#0ea5e9", "#38bdf8", "#2dd4bf", "#a7f3d0", "#f0fdff"],
  candy:  ["#ff6bcb", "#9d7bff", "#6bcbff", "#ffd93d", "#ffffff"],
};

const DEFAULTS = { text: "", words: "", palette: "ember", trails: true, interval: 3600 };

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === "undefined") return resting;
  // Upstream's reduced-motion path still flies every particle into place, so
  // under reduced motion the section keeps its CSS rest: the word as text.
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return resting;

  const o = Object.assign({}, DEFAULTS, opts);
  const word = el.querySelector(".fx-particle-type__word");
  const canvas = document.createElement("canvas");
  canvas.className = "fx-particle-type__canvas";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return resting;
  const reduced = false; // the early return above owns reduced motion

  let W = 0, H = 0, DPR = 1;
  let palette = PALETTES[o.palette] ? o.palette : "ember";
  let trails = o.trails !== false;
  let demoIndex = 0, demoTimer = null;
  const wordsOf = () => {
    const list = String(o.words || "").split("|").map((s) => s.trim()).filter(Boolean);
    const first = String(o.text || "").trim() || (word ? word.textContent.trim() : "") || " ";
    return list.length ? list : [first];
  };
  let DEMO = wordsOf();
  let currentText = DEMO[0];
  const mouse = { x: -9999, y: -9999, active: false };
  const display = () => getComputedStyle(el).getPropertyValue("--fx-display");

  // Particle store as typed arrays for speed
  let N = 0, px, py, vx, vy, tx, ty, ph, col;

  function targetCount() {
    const area = W * H;
    return Math.round(Math.min(9000, Math.max(2500, area / 140)));
  }

  function alloc(n) {
    const old = { px, py, N };
    N = n;
    px = new Float32Array(n); py = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    tx = new Float32Array(n); ty = new Float32Array(n);
    ph = new Float32Array(n); col = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (old.N && i < old.N) { px[i] = old.px[i]; py[i] = old.py[i]; }
      else { px[i] = Math.random() * W; py[i] = Math.random() * H; }
      ph[i] = Math.random() * Math.PI * 2;
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth; H = el.clientHeight;
    if (!W || !H) return;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = getComputedStyle(el).getPropertyValue("--fx-bg");
    ctx.fillRect(0, 0, W, H);
    alloc(targetCount());
    setText(currentText);
  }

  // The word is laid out in the band above the copy panel, not the whole
  // section, so the panel never sits on it. Shadowing H keeps upstream's two
  // layout functions below byte for byte.
  const inner = el.querySelector(".fx-particle-type__inner");
  const textH = () => (inner && inner.offsetTop > 0 ? Math.min(H, inner.offsetTop) : H);

  // Wrap text into lines that fit the stage, then sample lit pixels as targets.
  function layoutLines(text, off) {
    const H = textH();
    const maxW = W * 0.88, maxH = H * 0.62;
    const words = text.trim().split(/\s+/);
    let best = null;
    for (let lines = 1; lines <= Math.min(3, words.length); lines++) {
      const per = Math.ceil(words.length / lines);
      const rows = [];
      for (let i = 0; i < words.length; i += per) rows.push(words.slice(i, i + per).join(" "));
      off.font = `800 100px ${display()}`;
      const widest = Math.max(...rows.map(r => off.measureText(r).width));
      const size = Math.min(maxW / widest * 100, maxH / (rows.length * 1.1), H * 0.36);
      if (!best || size > best.size * 1.15) best = { rows, size };
    }
    return best;
  }

  function sampleTargets(text) {
    const H = textH();
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d", { willReadFrequently: true });
    const { rows, size } = layoutLines(text || " ", o);
    o.fillStyle = "#fff";
    o.textAlign = "center"; o.textBaseline = "middle";
    o.font = `800 ${size}px ${display()}`;
    const lh = size * 1.08;
    const top = H * 0.46 - (rows.length - 1) * lh / 2;
    rows.forEach((r, i) => o.fillText(r, W / 2, top + i * lh));

    const data = o.getImageData(0, 0, W, H).data;
    // Pick a grid step that yields roughly N lit points.
    let lit = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 128) lit++;
    lit *= 4;
    const step = Math.max(1.5, Math.sqrt(lit / N));
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const jx = x + Math.random() * step, jy = y + Math.random() * step;
        const idx = ((jy | 0) * W + (jx | 0)) * 4 + 3;
        if (data[idx] > 128) pts.push(jx, jy);
      }
    }
    return pts;
  }

  function setText(text) {
    currentText = text;
    if (!N) return;
    const pts = sampleTargets(text);
    const count = pts.length / 2;
    // Shuffle particle order so every morph takes a new route.
    const order = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    const pal = PALETTES[palette].length;
    for (let k = 0; k < N; k++) {
      const i = order[k];
      if (count === 0) {
        tx[i] = Math.random() * W; ty[i] = Math.random() * H;
      } else {
        const p = (k % count) * 2;
        tx[i] = pts[p] + (k >= count ? (Math.random() - 0.5) * 3 : 0);
        ty[i] = pts[p + 1] + (k >= count ? (Math.random() - 0.5) * 3 : 0);
      }
      // Colour by a diagonal sweep across the word, with a little noise.
      const t = (tx[i] / W) * 0.75 + (ty[i] / H) * 0.25 + (Math.random() - 0.5) * 0.18;
      col[i] = Math.max(0, Math.min(pal - 1, Math.floor(t * pal)));
    }
  }

  function burst(cx, cy, power) {
    for (let i = 0; i < N; i++) {
      const dx = px[i] - cx, dy = py[i] - cy;
      const d = Math.hypot(dx, dy) + 0.01;
      const f = power * Math.max(0.15, 1 - d / Math.max(W, H)) * (0.6 + Math.random() * 0.8);
      vx[i] += dx / d * f; vy[i] += dy / d * f;
    }
  }

  const buckets = [];
  let t = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(2, (now - last) / 16.67); last = now;
    t += 0.016 * dt;

    const spring = reduced ? 0.02 : 0.045;
    const damp = Math.pow(0.86, dt);
    const R = Math.max(70, Math.min(W, H) * 0.12), R2 = R * R;
    const mx = mouse.x, my = mouse.y;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = trails ? "rgba(10,12,28,0.26)" : "rgb(10,12,28)";
    ctx.fillRect(0, 0, W, H);

    const pal = PALETTES[palette];
    for (let c = 0; c < pal.length; c++) buckets[c] = [];

    for (let i = 0; i < N; i++) {
      const wob = reduced ? 0 : 0.9;
      const gx = tx[i] + Math.sin(t * 1.3 + ph[i]) * wob;
      const gy = ty[i] + Math.cos(t * 1.1 + ph[i]) * wob;
      vx[i] += (gx - px[i]) * spring * dt;
      vy[i] += (gy - py[i]) * spring * dt;

      const dx = px[i] - mx, dy = py[i] - my, d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const d = Math.sqrt(d2) + 0.001;
        const f = (1 - d / R) * 6 * dt;
        // Push outward plus a slight swirl so the cursor stirs rather than punches.
        vx[i] += (dx / d) * f - (dy / d) * f * 0.35;
        vy[i] += (dy / d) * f + (dx / d) * f * 0.35;
      }
      vx[i] *= damp; vy[i] *= damp;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      buckets[col[i]].push(i);
    }

    ctx.globalCompositeOperation = "lighter";
    for (let c = 0; c < pal.length; c++) {
      const b = buckets[c];
      ctx.fillStyle = pal[c];
      ctx.globalAlpha = 0.85;
      for (let k = 0; k < b.length; k++) {
        const i = b[k];
        const sp = Math.abs(vx[i]) + Math.abs(vy[i]);
        const s = 1.6 + Math.min(2.2, sp * 0.12);
        ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Demo cycle: upstream's timer, walking opts.words when there is more than one.
  function scheduleDemo() {
    clearInterval(demoTimer);
    if (DEMO.length < 2) return;
    demoTimer = setInterval(() => {
      demoIndex = (demoIndex + 1) % DEMO.length;
      setText(DEMO[demoIndex]);
    }, Math.max(1200, +o.interval || 3600));
  }

  // ---- paw-fx seams: pointer, size, visibility, the loop, the handle -----
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onMove = (e) => { [mouse.x, mouse.y] = local(e); };
  const onLeave = () => { mouse.x = mouse.y = -9999; };
  const onDown = (e) => { [mouse.x, mouse.y] = local(e); burst(mouse.x, mouse.y, 34); };
  const onUp = (e) => { if (e.pointerType !== "mouse") mouse.x = mouse.y = -9999; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  let resizeTimer, raf = 0, visible = true, live = false, dead = false;
  const ro = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });

  const pulso = (now) => {
    raf = 0;
    if (!visible || dead) return;
    frame(now);
    if (!live) { live = true; el.setAttribute("data-fx-live", ""); }
    raf = requestAnimationFrame(pulso);
  };
  const io = new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible && !raf && N) { last = performance.now(); raf = requestAnimationFrame(pulso); }
  });

  el.insertBefore(canvas, el.firstChild);
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load(`800 100px ${display()}`), new Promise(r => setTimeout(r, 1500))])
    : Promise.resolve();
  fontReady.catch(() => {}).then(() => {
    if (dead) return;
    resize();
    ro.observe(el);
    io.observe(el);
    scheduleDemo();
  });

  return {
    update(next) {
      Object.assign(o, next || {});
      if (PALETTES[o.palette]) palette = o.palette;
      trails = o.trails !== false;
      DEMO = wordsOf();
      demoIndex = 0;
      setText(DEMO[0]);
      scheduleDemo();
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      clearInterval(demoTimer); clearTimeout(resizeTimer);
      ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.remove();
      el.removeAttribute("data-fx-live");
    },
  };
}

export const meta = {
  name: "particle-type",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    text: { type: "string", default: "", description: "The word the particles spell. Empty reads the section's own .fx-particle-type__word heading, which stays in the page for screen readers." },
    words: { type: "string", default: "", description: "Optional |-separated list to cycle through, as upstream's demo does (for example \"hello | build in public\"). One word or none holds the heading's word." },
    interval: { type: "number", default: 3600, min: 1200, max: 10000, step: 100, description: "Milliseconds between words when words cycles (upstream's 3600)." },
    palette: { type: "string", default: "ember", description: "One of upstream's four palettes: ember, aurora, tide, candy." },
    trails: { type: "boolean", default: true, description: "Short motion trails (upstream's Trails toggle). Off clears every frame." },
  },
};
