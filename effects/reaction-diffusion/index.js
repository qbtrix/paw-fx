// Reaction-Diffusion by Olivier Giulieri — MIT License
// https://github.com/evoluteur/reaction-diffusion
//
// MIT License
// Copyright (c) 2026 Olivier Giulieri
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
// reaction-diffusion: a port of evoluteur/reaction-diffusion at commit
// 2620644993f13042847f21bf7e29c26538b8f57d (js/rd.js, index.html, css/rd.css).
// The Gray-Scott model on the GPU (WebGL2): two chemicals, A and B, spread and
// react (A + 2B -> 3B), A is fed in, B is removed; the feed and kill rates grow
// spots, stripes, coral, worms or waves on a 512 x 512 wrapping dish. Upstream's
// rd.js is kept in order (shaders, presets, palettes, seed, step, brush, draw,
// the settle probe, the pointer trail); the seams are the section box for the
// stage (the square dish is CSS-covered, centre-cropped, cells stay square),
// pointer events on the section with the crop accounted for, the preset,
// palette, speed, brush and relief controls as options applied by configure()
// (the panel, feed/kill map, sliders, hash, PNG download, keys and step label
// are dropped), a resting handle instead of a no-gl message, reduced motion as
// a dish grown once, an off-screen pause, and a teardown. See meta.json.

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === 'undefined' || typeof matchMedia !== 'function') return resting;
  const opt = Object.assign({}, opts);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const SIM = 512; // simulation grid (SIM x SIM cells, wrapping at the edges)

  // feed (f) and kill (k) rates for the patterns named in the literature
  // (Pearson 1993, Munafo's xmorphia, Karl Sims' tutorial)
  const presets = [
    { id: "coral", name: "Coral", f: 0.0545, k: 0.062 },
    { id: "mitosis", name: "Mitosis", f: 0.0367, k: 0.0649 },
    { id: "spots", name: "Spots", f: 0.03, k: 0.062 },
    { id: "stripes", name: "Labyrinth", f: 0.029, k: 0.057 },
    { id: "fingerprint", name: "Fingerprint", f: 0.037, k: 0.06 },
    { id: "worms", name: "Worms", f: 0.078, k: 0.061 },
    { id: "holes", name: "Holes", f: 0.039, k: 0.058 },
    { id: "waves", name: "Waves", f: 0.014, k: 0.054 },
    { id: "chaos", name: "Chaos", f: 0.026, k: 0.051 },
    { id: "uskate", name: "U-skate", f: 0.062, k: 0.0609 },
  ];

  const palettes = [
    { id: "ink", name: "Ink on paper", stops: ["#f4eddd", "#d9cdb4", "#7a6f5c", "#2a2621", "#0e0d0c"] },
    { id: "coral", name: "Coral reef", stops: ["#06223a", "#0d5c75", "#f2a65a", "#ff6f59", "#fff1d6"] },
    { id: "ember", name: "Ember", stops: ["#050203", "#3b0a0a", "#c1272d", "#f7931e", "#fff3b0"] },
    { id: "ocean", name: "Ocean", stops: ["#001219", "#005f73", "#0a9396", "#94d2bd", "#e9d8a6"] },
    { id: "moss", name: "Moss", stops: ["#0f160e", "#2d4a22", "#6a8d3a", "#c9d27c", "#f6f2d4"] },
    { id: "mono", name: "Black & white", stops: ["#000000", "#2b2b2b", "#808080", "#d4d4d4", "#ffffff"] },
  ];

  // limits of the feed / kill sliders and of the map (the map is off; the shader keeps its branch)
  const F_MIN = 0.01, F_MAX = 0.1, K_MIN = 0.045, K_MAX = 0.07;

  const state = {
    f: 0.0545,
    k: 0.062,
    preset: "coral",
    palette: "coral",
    speed: 12, // simulation steps per frame
    brush: 10,
    relief: true,
    map: false, // parameter map: f varies along y and k along x (never on here)
    paused: false,
    steps: 0,
    settled: false, // nothing has moved for a while: stop computing
    faded: false, // and nothing is left
  };

  let gl, canvas, progSim, progDraw, progBrush, progProbe;
  let probeTex, probeFbo;
  const PROBE = 64; // the dish is sampled on a 64 x 64 grid to tell if it still moves
  const CHECK_EVERY = 600; // steps between two looks
  const STILL = 0.1; // largest change of the shown color level between two looks, for "nothing moves visibly"
  const STILL_LOOKS = 3; // looks in a row
  let lastProbe = null, lastCheck = 0, stillCount = 0;
  let tex = [], fbo = [], cur = 0, quad;
  let strokeSeed = 0; // changes with each stroke, so the speckles differ
  let pointer = null; // {x, y, erase} in simulation cells while painting

  // ------------------------------------------------------------ shaders

  const VS = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() {
  uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

  const FS_SIM = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D state;
uniform vec2 px;
uniform float f;
uniform float k;
uniform bool map;
void main() {
  vec2 c = texture(state, uv).rg;
  // 3x3 Laplacian: 0.2 to the sides, 0.05 to the corners, -1 at the center
  vec2 lap = -c
    + 0.2 * (texture(state, uv + vec2(px.x, 0.0)).rg + texture(state, uv - vec2(px.x, 0.0)).rg
           + texture(state, uv + vec2(0.0, px.y)).rg + texture(state, uv - vec2(0.0, px.y)).rg)
    + 0.05 * (texture(state, uv + px).rg + texture(state, uv - px).rg
            + texture(state, uv + vec2(px.x, -px.y)).rg + texture(state, uv + vec2(-px.x, px.y)).rg);
  float F = f, K = k;
  if (map) {
    K = mix(${K_MIN.toFixed(3)}, ${K_MAX.toFixed(3)}, uv.x);
    F = mix(${F_MIN.toFixed(3)}, ${F_MAX.toFixed(3)}, uv.y);
  }
  float a = c.r, b = c.g;
  float abb = a * b * b;
  // Gray-Scott, with Da = 1, Db = 0.5, dt = 1
  float na = a + (1.0 * lap.r - abb + F * (1.0 - a));
  float nb = b + (0.5 * lap.g + abb - (K + F) * b);
  outColor = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), 0.0, 1.0);
}`;

  const FS_BRUSH = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D state;
uniform vec2 center;
uniform float radius;
uniform bool erase;
uniform float size;
uniform float seed;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453);
}
void main() {
  vec2 c = texture(state, uv).rg;
  vec2 d = uv * size - center;
  d = d - size * floor(d / size + 0.5); // wrap around the edges
  float r = length(d);
  float m = 1.0 - smoothstep(radius * 0.7, radius, r);
  if (erase) {
    c = mix(c, vec2(1.0, 0.0), m);
  } else {
    // speckles of B (3x3 cells, 15% of them) rather than a solid blot:
    // big uniform patches die out in the spot regimes, small seeds grow
    float speck = step(hash(floor(uv * size / 3.0)), 0.15);
    c = mix(c, vec2(0.5, 0.5), m * speck);
  }
  outColor = vec4(c, 0.0, 1.0);
}`;

  const FS_DRAW = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D state;
uniform vec2 px;
uniform vec3 stops[5];
uniform bool relief;
float level(vec2 p) {
  return clamp(texture(state, p).g * 2.6, 0.0, 1.0);
}
vec3 ramp(float t) {
  float s = t * 4.0;
  if (s < 1.0) return mix(stops[0], stops[1], s);
  if (s < 2.0) return mix(stops[1], stops[2], s - 1.0);
  if (s < 3.0) return mix(stops[2], stops[3], s - 2.0);
  return mix(stops[3], stops[4], clamp(s - 3.0, 0.0, 1.0));
}
void main() {
  float t = level(uv);
  vec3 col = ramp(smoothstep(0.02, 0.98, t));
  if (relief) {
    float dx = level(uv + vec2(px.x, 0.0)) - level(uv - vec2(px.x, 0.0));
    float dy = level(uv + vec2(0.0, px.y)) - level(uv - vec2(0.0, px.y));
    vec3 n = normalize(vec3(-dx * 3.0, -dy * 3.0, 1.0));
    vec3 l = normalize(vec3(-0.5, 0.6, 0.65));
    float diff = dot(n, l);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
    col = col * (0.62 + 0.42 * diff) + spec * 0.22;
  }
  outColor = vec4(col, 1.0);
}`;

  // B at the center of each probe cell (the dish is read at 64 x 64 points),
  // as the color level it is drawn with (see level() in FS_DRAW)
  const FS_PROBE = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D state;
void main() {
  float b = texture(state, uv).g;
  outColor = vec4(clamp(b * 2.6, 0.0, 1.0), b, 0.0, 1.0);
}`;

  // ------------------------------------------------------------ WebGL setup

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  };

  const program = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    p.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace("[0]", "");
      p.u[name] = gl.getUniformLocation(p, name);
    }
    return p;
  };

  const makeTexture = (data) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SIM, SIM, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  };

  // The stage: a canvas of our own, inserted as the section's first child; CSS
  // covers the section with it (object-fit: cover), so the square dish is
  // centre-cropped and its cells stay square.
  const initGL = () => {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-rd__gl';
    canvas.setAttribute('aria-hidden', 'true');
    gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, failIfMajorPerformanceCaveat: true });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      return false;
    }
    canvas.width = SIM;
    canvas.height = SIM;
    try {
      progSim = program(FS_SIM);
      progDraw = program(FS_DRAW);
      progBrush = program(FS_BRUSH);
      progProbe = program(FS_PROBE);
    } catch (err) {
      return false; // a refused shader leaves the CSS rest in place
    }
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < 2; i++) {
      tex[i] = makeTexture(null);
      fbo[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[i], 0);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      return false;
    }
    probeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, probeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, PROBE, PROBE, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    probeFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, probeFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, probeTex, 0);
    return true;
  };

  // read B at the probe points
  const probe = () => {
    gl.useProgram(progProbe);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probeFbo);
    gl.viewport(0, 0, PROBE, PROBE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(progProbe.u.state, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const out = new Float32Array(PROBE * PROBE * 4);
    gl.readPixels(0, 0, PROBE, PROBE, gl.RGBA, gl.FLOAT, out);
    const level = new Float32Array(PROBE * PROBE);
    let most = 0; // the most B anywhere, to tell when it has died out
    for (let i = 0; i < level.length; i++) {
      level[i] = out[i * 4];
      most = Math.max(most, out[i * 4 + 1]);
    }
    return { level, most };
  };

  // has the dish stopped changing, as far as the eye can tell? Holes, spots and
  // mitosis go still; coral and labyrinths mostly do, though a stray defect may
  // still creep; waves, chaos and worms never do; and a dish where B died out is
  // still too
  const checkSettled = () => {
    lastCheck = state.steps;
    const p = probe();
    if (lastProbe) {
      let change = 0;
      for (let i = 0; i < p.level.length; i++) change = Math.max(change, Math.abs(p.level[i] - lastProbe.level[i]));
      stillCount = change < STILL ? stillCount + 1 : 0;
      if (stillCount >= STILL_LOOKS) {
        state.settled = true;
        state.faded = p.most < 0.02;
      }
    }
    lastProbe = p;
  };

  // something changed: compute again
  const wake = () => {
    state.settled = false;
    state.faded = false;
    lastProbe = null;
    stillCount = 0;
    lastCheck = state.steps;
  };

  // one pass of a full-screen shader, reading the current state, writing the other buffer
  const pass = (prog, setUniforms) => {
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
    gl.viewport(0, 0, SIM, SIM);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(prog.u.state, 0);
    setUniforms(prog.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cur = 1 - cur;
  };

  const step = () => {
    pass(progSim, (u) => {
      gl.uniform2f(u.px, 1 / SIM, 1 / SIM);
      gl.uniform1f(u.f, state.f);
      gl.uniform1f(u.k, state.k);
      gl.uniform1i(u.map, state.map ? 1 : 0);
    });
    state.steps++;
  };

  const brush = (x, y, erase) => {
    pass(progBrush, (u) => {
      gl.uniform2f(u.center, x, y);
      gl.uniform1f(u.radius, state.brush);
      gl.uniform1i(u.erase, erase ? 1 : 0);
      gl.uniform1f(u.size, SIM);
      gl.uniform1f(u.seed, strokeSeed);
    });
  };

  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

  let live = false;
  const draw = () => {
    gl.useProgram(progDraw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
    gl.uniform1i(progDraw.u.state, 0);
    gl.uniform2f(progDraw.u.px, 1 / SIM, 1 / SIM);
    gl.uniform1i(progDraw.u.relief, state.relief ? 1 : 0);
    const pal = palettes.find((p) => p.id === state.palette) || palettes[0];
    gl.uniform3fv(progDraw.u.stops, new Float32Array(pal.stops.flatMap(hexToRgb)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!live) { live = true; el.setAttribute('data-fx-live', ''); }
  };

  // ------------------------------------------------------------ seeding

  // a fresh dish: all A, with a few drops of B to start the reaction
  const seed = (how = "drops") => {
    const data = new Float32Array(SIM * SIM * 4);
    for (let i = 0; i < SIM * SIM; i++) {
      data[i * 4] = 1;
      data[i * 4 + 3] = 1;
    }
    const dot = (cx, cy, r) => {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const px = (Math.round(cx + x) + SIM) % SIM;
          const py = (Math.round(cy + y) + SIM) % SIM;
          const i = (py * SIM + px) * 4;
          data[i] = 0.5;
          data[i + 1] = 0.25 + Math.random() * 0.25;
        }
      }
    };
    if (how === "noise") {
      for (let n = 0; n < 900; n++) dot(Math.random() * SIM, Math.random() * SIM, 2);
    } else if (how !== "none") {
      // patches of small speckles (3 x 3 cells, 15% of them): a large solid
      // blot can die out in some regimes (waves, spots), small seeds always grow
      const cell = 3;
      const cells = Math.ceil(SIM / cell);
      const speck = new Uint8Array(cells * cells).map(() => (Math.random() < 0.15 ? 1 : 0));
      const n = 8 + Math.floor(Math.random() * 6);
      for (let d = 0; d < n; d++) {
        const cx = Math.random() * SIM, cy = Math.random() * SIM;
        const r = 20 + Math.random() * 40;
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            if (x * x + y * y > r * r) continue;
            const px = (Math.round(cx + x) + SIM) % SIM;
            const py = (Math.round(cy + y) + SIM) % SIM;
            if (!speck[Math.floor(py / cell) * cells + Math.floor(px / cell)]) continue;
            const i = (py * SIM + px) * 4;
            data[i] = 0.5;
            data[i + 1] = 0.5;
          }
        }
      }
    }
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SIM, SIM, 0, gl.RGBA, gl.FLOAT, data);
    }
    state.steps = 0;
    wake();
  };

  // ------------------------------------------------------------ the loop

  // the dabs along the pointer's path since the last frame, so fast strokes stay continuous
  const paint = () => {
    if (!pointer) return;
    const pts = pointer.trail.length ? pointer.trail : [{ x: pointer.x, y: pointer.y }];
    pts.slice(-60).forEach((p) => brush(p.x, p.y, pointer.erase));
    pointer.trail = [];
  };

  let raf = 0, dead = false, visible = true;
  const loop = () => {
    raf = 0;
    if (dead || !visible) return;
    raf = requestAnimationFrame(loop);
    paint();
    if (!state.paused && !state.settled) {
      for (let i = 0; i < state.speed; i++) step();
      if (state.steps - lastCheck >= CHECK_EVERY) checkSettled();
    }
    draw();
  };

  // Reduced motion: the dish is grown once (STILL_STEPS steps, ours), then it
  // only moves under a stroke: one frame's worth of steps per pointer event.
  const STILL_STEPS = 1500;
  const still = (k) => {
    for (let i = 0; i < k; i++) step();
    draw();
  };

  // ------------------------------------------------------------ painting

  // The canvas covers the section (object-fit: cover): the SIM square is scaled
  // by max(w, h) / SIM and centre-cropped, so section coordinates map to the
  // visible window of the dish.
  const toCell = (e) => {
    const r = canvas.getBoundingClientRect();
    const s = Math.max(r.width, r.height) / SIM;
    return {
      x: (e.clientX - r.left) / s + (SIM - r.width / s) / 2,
      y: SIM - ((e.clientY - r.top) / s + (SIM - r.height / s) / 2), // textures have y up
    };
  };

  // The copy's links and buttons keep their own pointer and context menu
  const onCopy = (e) => !!(e.target.closest && e.target.closest('a, button, input, select, textarea'));
  const onDown = (e) => {
    if (onCopy(e)) return;
    el.setPointerCapture(e.pointerId);
    const c = toCell(e);
    strokeSeed = Math.random() * 1000;
    pointer = { ...c, trail: [c], erase: e.button === 2 || e.shiftKey };
    wake();
    e.preventDefault();
    if (reduced) { paint(); still(state.speed); }
  };
  const onMenu = (e) => { if (!onCopy(e)) e.preventDefault(); };
  const onMove = (e) => {
    if (!pointer) return;
    const c = toCell(e);
    const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
    const n = Math.min(40, Math.ceil(d / Math.max(1, state.brush * 0.4)));
    for (let i = 1; i <= n; i++) {
      pointer.trail.push({
        x: pointer.x + ((c.x - pointer.x) * i) / n,
        y: pointer.y + ((c.y - pointer.y) * i) / n,
      });
    }
    pointer.x = c.x;
    pointer.y = c.y;
    if (reduced) { paint(); still(state.speed); }
  };
  const onUp = () => (pointer = null);

  // ------------------------------------------------------------ options

  const setPreset = (id, reseed = true) => {
    const p = presets.find((p) => p.id === id) || presets[0];
    wake();
    state.preset = p.id;
    state.f = p.f;
    state.k = p.k;
    if (reseed) seed("drops");
  };

  // Upstream's select, palette, speed, brush and relief controls become options.
  // A preset change through update() reseeds, as upstream's select does.
  const configure = (initial) => {
    const id = String(opt.preset || 'coral');
    if (initial || id !== state.preset) setPreset(id, !initial);
    state.palette = palettes.some((p) => p.id === opt.palette) ? opt.palette : 'coral';
    state.speed = clamp(Math.round(Number(opt.speed) || 12), 1, 40);
    state.brush = clamp(Math.round(Number(opt.brush) || 10), 2, 40);
    state.relief = opt.relief === undefined ? true : !!opt.relief;
  };

  // ------------------------------------------------------------ init

  if (!initGL()) return resting;
  configure(true);
  el.insertBefore(canvas, el.firstChild);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('contextmenu', onMenu);
  const io = new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible && !reduced && !raf && !dead) raf = requestAnimationFrame(loop);
  });
  seed("drops");
  if (reduced) still(STILL_STEPS); else raf = requestAnimationFrame(loop);
  io.observe(el);

  return {
    update(next) {
      Object.assign(opt, next || {});
      if (dead) return;
      configure(false);
      wake();
      if (reduced) draw();
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('contextmenu', onMenu);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      canvas.remove();
      el.removeAttribute('data-fx-live');
    },
  };
}

export const meta = {
  name: 'reaction-diffusion',
  version: '1.0.0',
  category: 'backgrounds',
  needs: [],
  license: 'MIT',
  options: {
    preset: { type: 'string', default: 'coral', description: "Feed and kill rates by name (upstream's preset select): coral, mitosis, spots, stripes, fingerprint, worms, holes, waves, chaos or uskate. A change through update() reseeds the dish with fresh drops, as upstream's select does." },
    palette: { type: 'string', default: 'coral', description: "Five-stop colour ramp from no B to all B (upstream's palette select): ink, coral, ember, ocean, moss or mono." },
    speed: { type: 'number', default: 12, min: 1, max: 40, step: 1, description: "Simulation steps per frame (upstream's speed slider). More is faster growth and more GPU work." },
    brush: { type: 'number', default: 10, min: 2, max: 40, step: 1, description: "Radius of the pointer's brush in cells of the 512-cell dish (upstream's brush slider). Press and drag to seed B; shift or the right button erases." },
    relief: { type: 'boolean', default: true, description: "Lights the pattern as a bumped surface (upstream's relief checkbox); off is the flat colour ramp." },
  },
};
