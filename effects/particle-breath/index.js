// Particle Breath by Limot — https://limot.dev — MIT License
// https://github.com/bimohxh/limot-particle-breath
//
// MIT License
// Copyright (c) 2026 Limot (https://limot.dev)
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
// particle-breath: a port of bimohxh/limot-particle-breath at commit
// a979ee861763c4abc3c33d8a20db3b8e8dc03c5b. A soft, folded volume of 8500
// Canvas 2D particles that breathes in place: the points are fixed samples on
// a sphere (they never re-scatter), deformed every frame by a slow ripple, a
// saddle fold and a twist, depth-sorted into twelve alpha buckets, with a few
// strays orbiting just off the surface.
//
// src/geometry.js is pasted first and src/index.js follows it, both verbatim
// apart from the import/export lines (one module, no sibling file to import).
// mount() drives upstream's own mountParticleBreath() with a config provider,
// which is upstream's live-controls API; the seams are listed in
// meta.json.deviations.

// ---- src/geometry.js ----------------------------------------------------
// Stable surface samples: animation deforms the same particles without re-scattering them.
function createBreathParticles(count) {
  const points = [];
  const random = (i) => {
    const x = Math.sin(i * 127.1 + 43.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const rows = Math.max(16, Math.round(Math.sqrt(count / 2)));
  for (let row = 0; row < rows; row++) {
    const latitude = -Math.PI / 2 + ((row + 0.5) / rows) * Math.PI;
    const columns = Math.max(
      6,
      Math.round(((count / rows) * Math.cos(latitude) * Math.PI) / 2),
    );
    for (let col = 0; col < columns; col++) {
      const id = points.length;
      points.push({
        u: latitude + (random(id + 1) - 0.5) * 0.012,
        v:
          ((col + row * 0.34) / columns) * Math.PI * 2 +
          (random(id + 7) - 0.5) * 0.009,
        r: 0.6 + random(id + 31) * 0.65,
        a: 0.55 + random(id + 57) * 0.45,
      });
    }
  }
  return points;
}
function breathPoint(p, time, amplitude) {
  const u = p.u,
    v = p.v,
    cu = Math.cos(u),
    su = Math.sin(u);
  const b = time * 0.78;
  const ripple =
    amplitude *
    (0.1 * Math.sin(b + v * 1.4 + u * 2) +
      0.055 * Math.sin(v * 3 - u * 2 - b * 0.8));
  const radius =
    1 +
    0.22 * Math.cos(v * 3 + 0.45) * cu * cu +
    0.1 * Math.sin(u * 3 + v * 2) +
    ripple;
  let x = cu * Math.cos(v) * radius * 1.18;
  let y = su * radius * 0.87;
  let z = cu * Math.sin(v) * radius * 0.68;
  // A diagonal saddle fold and asymmetric lobes create the selected soft silhouette.
  y += 0.25 * Math.sin(x * 2.4 + v * 0.4) * cu;
  const twist = 0.62 * x + 0.14 * Math.sin(b * 0.7 + u) * amplitude;
  const yy = y * Math.cos(twist) - z * Math.sin(twist);
  const zz = y * Math.sin(twist) + z * Math.cos(twist);
  y = yy;
  z = zz;
  return { x: x + 0.15 * z, y: y + 0.19 * z, z };
}
function renderParticles(ctx, w, h, time, c, points) {
  ctx.globalAlpha = 1;
  const size = (Math.min(w * 0.205, h * 0.32) * (c.scale ?? 100)) / 100;
  const t = time * (c.speed ?? 1),
    amplitude = (c.breathStrength ?? 75) / 75;
  const buckets = Array.from({ length: 12 }, () => []);
  for (const p of points) {
    const q = breathPoint(p, t, amplitude);
    const depth = Math.max(
      0,
      Math.min(11, Math.floor(((q.z + 1.25) / 2.5) * 12)),
    );
    buckets[depth].push({
      x: w / 2 + q.x * size,
      y: h / 2 + q.y * size,
      r: p.r,
      a: p.a,
    });
  }
  ctx.fillStyle = c.dotColor ?? "#e0dfd8";
  const radius = (c.particleSize ?? 1) * Math.max(0.5, size / 230);
  for (let i = 0; i < 12; i++) {
    ctx.globalAlpha = 0.2 + (i / 11) * 0.65;
    ctx.beginPath();
    for (const p of buckets[i]) {
      const r = radius * p.r;
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  // Just a few persistent strays drift close to the breathing surface.
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.39996,
      orbit = 1.34 + 0.12 * Math.sin(t * 0.24 + i);
    const x = w / 2 + Math.cos(angle) * size * orbit * 1.08,
      y = h / 2 + Math.sin(angle) * size * orbit * 0.85;
    ctx.globalAlpha = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.5 + i));
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- src/index.js -------------------------------------------------------
const defaultConfig = Object.freeze({
  backgroundColor: "#111111",
  dotColor: "#e0dfd8",
  scale: 100,
  particleSize: 1,
  particleCount: 8500,
  opacity: 1,
  speed: 1,
  breathStrength: 75,
});

const states = new WeakMap();
const bounds = {
  scale: [40, 125],
  particleSize: [0.5, 2],
  particleCount: [1500, 16000],
  opacity: [0, 1],
  speed: [0, 3],
  breathStrength: [0, 150],
};

function resolveConfig(options = {}) {
  const config = { ...defaultConfig, ...options };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = config[key];
    config[key] = Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : defaultConfig[key];
  }
  config.backgroundColor ||= defaultConfig.backgroundColor;
  config.dotColor ||= defaultConfig.dotColor;
  return config;
}

/** Render one deterministic frame. Width/height are logical pixels; time is seconds. */
function drawParticleBreath(ctx, width, height, time = 0, options = {}) {
  if (!(width > 0 && height > 0) || !Number.isFinite(time)) return;
  const config = resolveConfig(options);
  let state = states.get(ctx);
  if (!state) {
    state = {};
    states.set(ctx, state);
  }
  if (state.count !== config.particleCount) {
    state.points = createBreathParticles(config.particleCount);
    state.count = config.particleCount;
  }
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    if (config.opacity === 0) return;
    if (config.opacity === 1) {
      renderParticles(ctx, width, height, time, config, state.points);
      return;
    }
    // Composite the complete graphic once, preserving overlap and the opaque background.
    if (!state.layer) {
      state.layer =
        ctx.canvas.ownerDocument?.createElement("canvas") ??
        new OffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
      state.layerContext = state.layer.getContext("2d");
    }
    const layer = state.layer;
    if (layer.width !== ctx.canvas.width) layer.width = ctx.canvas.width;
    if (layer.height !== ctx.canvas.height) layer.height = ctx.canvas.height;
    const layerContext = state.layerContext;
    layerContext.setTransform(1, 0, 0, 1, 0, 0);
    layerContext.clearRect(0, 0, layer.width, layer.height);
    layerContext.setTransform(ctx.getTransform());
    renderParticles(layerContext, width, height, time, config, state.points);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = config.opacity;
    ctx.drawImage(layer, 0, 0);
  } finally {
    ctx.restore();
  }
}

/** Mount a responsive animation; call the returned function to release all resources. */
function mountParticleBreath(canvas, configOrProvider = {}) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  if (!ctx || !host)
    throw new Error(
      "Particle Breath needs a 2D canvas inside a sized container.",
    );
  const view = canvas.ownerDocument.defaultView;
  const getConfig =
    typeof configOrProvider === "function"
      ? configOrProvider
      : () => configOrProvider;
  let width = 1,
    height = 1,
    dpr = 1,
    frame = 0,
    disposed = false;
  const start = view.performance.now();
  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(view.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  };
  const observer = new view.ResizeObserver(resize);
  observer.observe(host);
  resize();
  const render = (now) => {
    if (disposed) return;
    if (dpr !== Math.min(view.devicePixelRatio || 1, 2)) resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawParticleBreath(ctx, width, height, (now - start) / 1000, getConfig());
    frame = view.requestAnimationFrame(render);
  };
  frame = view.requestAnimationFrame(render);
  return () => {
    if (disposed) return;
    disposed = true;
    view.cancelAnimationFrame(frame);
    observer.disconnect();
    states.delete(ctx);
  };
}

// ---- paw-fx seams: the section, visibility, the handle -------------------
export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === "undefined") return resting;

  const cfg = { ...opts };
  const reduced =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  let calls = 0;
  // Upstream's own live-controls provider. Its demo page (examples/index.html)
  // answers reduced motion with speed 0, a still frame, and so does this. The
  // second call means the first frame has drawn, so the CSS rest can go.
  const provider = () => {
    if (++calls === 2) el.setAttribute("data-fx-live", "");
    return reduced && reduced.matches ? { ...cfg, speed: 0 } : cfg;
  };

  const canvas = document.createElement("canvas");
  canvas.className = "fx-breath__canvas";
  canvas.setAttribute("aria-hidden", "true");
  el.insertBefore(canvas, el.firstChild);

  let stop = null;
  const run = (on) => {
    if (on && !stop) stop = mountParticleBreath(canvas, provider);
    if (!on && stop) { stop(); stop = null; }
  };
  try {
    run(true);
  } catch {
    canvas.remove();
    return resting;
  }
  // Upstream's loop never pauses; a section off screen does not need 8500
  // particles a frame, so the loop is stopped and restarted with visibility.
  const io = new IntersectionObserver((es) => run(es[es.length - 1].isIntersecting));
  io.observe(el);

  return {
    update(next) {
      Object.assign(cfg, next || {});
    },
    destroy() {
      io.disconnect();
      run(false);
      canvas.remove();
      el.removeAttribute("data-fx-live");
    },
  };
}

export const meta = {
  name: "particle-breath",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    backgroundColor: { type: "string", default: "#111111", description: "Canvas ground. Set --fx-bg to match so the CSS resting state agrees." },
    dotColor: { type: "string", default: "#e0dfd8", description: "Particle colour. Set --fx-dot to match." },
    scale: { type: "number", default: 100, min: 40, max: 125, step: 1, description: "Size of the volume, in percent of upstream's default." },
    particleSize: { type: "number", default: 1, min: 0.5, max: 2, step: 0.05, description: "Dot radius multiplier." },
    particleCount: { type: "number", default: 8500, min: 1500, max: 16000, step: 500, description: "How many particles sample the surface. Changing it re-samples them." },
    opacity: { type: "number", default: 1, min: 0, max: 1, step: 0.01, description: "Opacity of the whole graphic over the ground, composited once so overlaps do not double up." },
    speed: { type: "number", default: 1, min: 0, max: 3, step: 0.05, description: "Breathing speed. 0 holds a still frame." },
    breathStrength: { type: "number", default: 75, min: 0, max: 150, step: 1, description: "How far the surface ripples and twists as it breathes." },
  },
};
