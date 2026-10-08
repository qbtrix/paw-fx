// ebru by Jiayi Fan — MIT License
// https://github.com/fushanbobfan/ebru
//
// MIT License
// Copyright (c) 2026 Jiayi Fan
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
// paper-marbling: a port of fushanbobfan/ebru at commit
// 01b83abde140c342ea835da6b81bfb0847b12b98 (src/marble.js, src/pack.js,
// src/patterns.js, src/replay.js, src/gpu.js, src/tools.js, parseColor from
// src/render.js, src/main.js, index.html). Ebru, paper marbling, in the
// browser: drops of ink on a bath of size, pulled by a stylus, comb, swirl or
// wave. Every stroke is an exact area-preserving map of the tray onto itself
// and the picture is drawn on the GPU by walking the inverse maps backwards
// from every pixel. Upstream's pure modules are kept verbatim below, in
// dependency order, with only their import and export lines removed. The
// seams are the mount/update/destroy wrapper lifted from main.js (the 2D tray,
// overlay, controls, keys, share hash, undo, print and CPU fallback dropped),
// the square tray CSS-covered over a wide section with the pointer mapped
// through the crop, failIfMajorPerformanceCaveat with a resting fallback,
// reduced motion, an off-screen start and a teardown. See meta.json.deviations.

// ---- src/marble.js -----------------------------------------------------

// Marbling operations as exact maps of the tray onto itself.
//
// Every operation is a bijection that preserves area, the way the thin
// layer of ink on a size bath does. Each one has a forward map (where a
// point of ink ends up) and a closed-form inverse (where the ink now at a
// point came from). Rendering runs the inverses backwards from the newest
// operation, so the picture is exact at any resolution.
//
// Units are tray units; the tray is TRAY units on a side.

const TRAY = 1000;

const TAU = Math.PI * 2;

// Strength of a tine at normal distance d: z at the tine, halving every
// `half` units away from it. This is Jaffer's u^d falloff with
// u = 2^(-1/half).
function falloff(d, half) {
  return Math.pow(2, -Math.abs(d) / half);
}

function unit(angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)];
}

// Offsets of the tines of a rake across its line, centred on the line.
function tineOffsets(count, spacing) {
  const out = [];
  for (let i = 0; i < count; i++) out.push((i - (count - 1) / 2) * spacing);
  return out;
}

// Displacement profile of a rake at signed normal coordinate n.
function rakeShift(op, n) {
  let s = 0;
  const first = -((op.tines - 1) / 2) * op.spacing;
  for (let i = 0; i < op.tines; i++) s += falloff(n - first - i * op.spacing, op.half);
  return op.z * s;
}

// Drop: new ink of radius r at (x, y) pushes the old ink radially outward
// so that the ring between |P-C| and its image holds exactly the drop's
// area: |P'-C|^2 = |P-C|^2 + r^2.
function dropForward(op, x, y) {
  const dx = x - op.x;
  const dy = y - op.y;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0) return [op.x + op.r, op.y];
  const k = Math.sqrt(1 + (op.r * op.r) / d2);
  return [op.x + dx * k, op.y + dy * k];
}

// Inverse of a drop, or null for a point inside the drop itself.
function dropInverse(op, x, y) {
  const dx = x - op.x;
  const dy = y - op.y;
  const d2 = dx * dx + dy * dy;
  const r2 = op.r * op.r;
  if (d2 <= r2) return null;
  const k = Math.sqrt(1 - r2 / d2);
  return [op.x + dx * k, op.y + dy * k];
}

// Rake: tines pulled along direction `angle`. Each point slides parallel
// to the stroke by an amount that depends only on its distance across
// the stroke, so the map is a shear and keeps area exactly.
function rakeMove(op, x, y, sign) {
  const [mx, my] = unit(op.angle);
  const n = -(x - op.x) * my + (y - op.y) * mx;
  const s = sign * rakeShift(op, n);
  return [x + s * mx, y + s * my];
}

// Swirl: a stylus drawn once around a circle of radius R. A point at
// distance rho from the centre moves along its own circle by an arc of
// z * falloff(rho - R), so the stroke is strongest on the circle and
// fades either side of it. Rotating each circle rigidly keeps area.
function swirlMove(op, x, y, sign) {
  const dx = x - op.x;
  const dy = y - op.y;
  const rho = Math.hypot(dx, dy);
  if (rho === 0) return [x, y];
  const a = (sign * op.z * falloff(rho - op.R, op.half)) / rho;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [op.x + dx * c - dy * s, op.y + dx * s + dy * c];
}

// Wave: lines along `angle` are bent into sine waves. Each point moves
// across the direction by A sin(2 pi t / L + phase), where t is its
// position along it, which is again a shear.
function waveMove(op, x, y, sign) {
  const [mx, my] = unit(op.angle);
  const t = (x - op.x) * mx + (y - op.y) * my;
  const s = sign * op.A * Math.sin((TAU * t) / op.L + (op.phase * Math.PI) / 180);
  return [x - s * my, y + s * mx];
}

function forward(op, x, y) {
  switch (op.type) {
    case 'drop': return dropForward(op, x, y);
    case 'rake': return rakeMove(op, x, y, 1);
    case 'swirl': return swirlMove(op, x, y, 1);
    case 'wave': return waveMove(op, x, y, 1);
    default: throw new Error(`unknown operation ${op.type}`);
  }
}

// Where the ink now at (x, y) was before `op`; null if `op` is a drop
// that covers (x, y).
function inverse(op, x, y) {
  switch (op.type) {
    case 'drop': return dropInverse(op, x, y);
    case 'rake': return rakeMove(op, x, y, -1);
    case 'swirl': return swirlMove(op, x, y, -1);
    case 'wave': return waveMove(op, x, y, -1);
    default: throw new Error(`unknown operation ${op.type}`);
  }
}

// Index of the drop whose ink lies at (x, y) after all `ops`, or -1 for
// the bare bath.
function sourceAt(ops, x, y) {
  let px = x;
  let py = y;
  for (let i = ops.length - 1; i >= 0; i--) {
    const p = inverse(ops[i], px, py);
    if (p === null) return i;
    px = p[0];
    py = p[1];
  }
  return -1;
}

// Apply every operation from `start` on to a point of ink.
function carry(ops, x, y, start = 0) {
  let p = [x, y];
  for (let i = start; i < ops.length; i++) p = forward(ops[i], p[0], p[1]);
  return p;
}


// ---- src/render.js, parseColor only --------------------------------------
function parseColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}


// ---- src/pack.js -------------------------------------------------------------
// Pack marbling operations into a float texture for the GPU renderer.
//
// Each operation takes TEXELS_PER_OP RGBA texels (12 floats), laid out
// OPS_PER_ROW operations to a row:
//
//   texel 0: kind, x, y, a
//   texel 1: b, c, d, e
//   texel 2: f, g, h, unused
//
// drop   a = r^2                     b, c, d = colour (0..1)
// rake   a = mx  b = my  c = z  d = k  e = first offset  f = spacing  g = tines
// swirl  a = R   b = z   c = k
// wave   a = mx  b = my  c = A  d = w  e = phase
//
// k is the falloff exponent -ln 2 / half, so a stroke's weight at distance
// d is exp(k |d|).


const TEXELS_PER_OP = 3;
const OPS_PER_ROW = 64;
const KIND = { drop: 0, rake: 1, swirl: 2, wave: 3 };

const DEG = Math.PI / 180;

function packOps(ops) {
  const rows = Math.max(1, Math.ceil(ops.length / OPS_PER_ROW));
  const width = OPS_PER_ROW * TEXELS_PER_OP;
  const data = new Float32Array(width * rows * 4);
  ops.forEach((op, i) => {
    const o = i * TEXELS_PER_OP * 4;
    const v = new Array(12).fill(0);
    v[0] = KIND[op.type];
    v[1] = op.x;
    v[2] = op.y;
    switch (op.type) {
      case 'drop': {
        const [r, g, b] = parseColor(op.color);
        v[3] = op.r * op.r;
        v[4] = r / 255;
        v[5] = g / 255;
        v[6] = b / 255;
        break;
      }
      case 'rake':
        v[3] = Math.cos(op.angle * DEG);
        v[4] = Math.sin(op.angle * DEG);
        v[5] = op.z;
        v[6] = -Math.LN2 / op.half;
        v[7] = -((op.tines - 1) / 2) * op.spacing;
        v[8] = op.spacing;
        v[9] = op.tines;
        break;
      case 'swirl':
        v[3] = op.R;
        v[4] = op.z;
        v[5] = -Math.LN2 / op.half;
        break;
      case 'wave':
        v[3] = Math.cos(op.angle * DEG);
        v[4] = Math.sin(op.angle * DEG);
        v[5] = op.A;
        v[6] = (2 * Math.PI) / op.L;
        v[7] = op.phase * DEG;
        break;
      default:
        throw new Error(`unknown operation ${op.type}`);
    }
    data.set(v, o);
  });
  return { data, width, rows, count: ops.length };
}

// Read operation i back out of a packed texture as the 12 raw floats.
function packedSlot(packed, i) {
  const o = i * TEXELS_PER_OP * 4;
  return Array.from(packed.data.subarray(o, o + 12));
}


// ---- src/patterns.js ---------------------------------------------------------
// Palettes and starting patterns, each built from a seed so a pattern
// can be shared as a name and a number.


const PALETTES = {
  istanbul: {
    label: 'Istanbul',
    bath: '#efe6d2',
    inks: ['#1f3a68', '#b5302b', '#e0a526', '#2e6b4f', '#f4efe3'],
  },
  indigo: {
    label: 'Indigo',
    bath: '#f3f0e8',
    inks: ['#1b2a4a', '#3d5a8c', '#8aa6cf', '#d8e2f0', '#c96a3a'],
  },
  ember: {
    label: 'Ember',
    bath: '#1d1612',
    inks: ['#e85d2a', '#f2b33d', '#8c1c13', '#f6e7c8', '#3b2a22'],
  },
  lagoon: {
    label: 'Lagoon',
    bath: '#e9f2ef',
    inks: ['#0f5c63', '#21a29a', '#f2c14e', '#f78154', '#1d2d44'],
  },
  ink: {
    label: 'Sumi ink',
    bath: '#f5f1e8',
    inks: ['#141414', '#5a5a5a', '#f5f1e8', '#9b2d20'],
  },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A rake whose tines span the whole tray at the given spacing.
function fullRake(angle, spacing, z, half, shift = 0) {
  const span = TRAY * Math.SQRT2;
  const tines = Math.ceil(span / spacing) + 1;
  const a = (angle * Math.PI) / 180;
  // move the rake line across its own direction by `shift`
  return {
    type: 'rake',
    x: TRAY / 2 - Math.sin(a) * shift,
    y: TRAY / 2 + Math.cos(a) * shift,
    angle, z, half, tines, spacing,
  };
}

const round = (v) => Math.round(v * 10) / 10;

// Stones: drops scattered over the whole bath, big ones first.
function stones(rand, inks, count, rMax, rMin) {
  const ops = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    ops.push({
      type: 'drop',
      x: round(rand() * TRAY),
      y: round(rand() * TRAY),
      r: round(rMax + (rMin - rMax) * t * (0.7 + 0.6 * rand())),
      color: inks[i % inks.length],
    });
  }
  return ops;
}

// Concentric drops at one centre: each new drop pushes the others into rings.
function bullseye(inks, x, y, rings, r) {
  const ops = [];
  for (let i = 0; i < rings; i++) ops.push({ type: 'drop', x, y, r, color: inks[i % inks.length] });
  return ops;
}

// Back-and-forth combing: one pass, then a pass the other way between the
// first pass's tines.
function gelgit(angle, spacing, z, half) {
  return [
    fullRake(angle, spacing, z, half),
    fullRake(angle + 180, spacing, z, half, spacing / 2),
  ];
}

const PATTERNS = {
  battal: {
    label: 'Battal (stones)',
    note: 'The plainest marbling: drops of each colour scattered on the bath. Every new drop shoulders the older ink aside, so early drops end up as thin veins between later ones.',
    build: (rand, inks) => stones(rand, inks, 140, 110, 28),
  },
  gelgit: {
    label: 'Gelgit (come and go)',
    note: 'Stones combed one way and then back the other way between the first strokes, which drags every stone into long alternating tongues.',
    build: (rand, inks) => [...stones(rand, inks, 110, 95, 30), ...gelgit(90, 90, 70, 14)],
  },
  nonpareil: {
    label: 'Nonpareil',
    note: 'Gelgit followed by a fine comb across it. The tight tines pull the tongues into rows of small arches.',
    build: (rand, inks) => [
      ...stones(rand, inks, 110, 95, 30),
      ...gelgit(90, 80, 60, 12),
      fullRake(0, 26, 18, 5),
    ],
  },
  hearts: {
    label: 'Hearts',
    note: 'Rows of concentric drops, then a single stylus pulled straight through the middle of each row. Every target is dented into a heart.',
    build: (rand, inks) => {
      const ops = [];
      const n = 4;
      const step = TRAY / n;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * step + (j % 2 ? step / 2 : 0);
          const k = (i + j) % inks.length;
          const turned = [...inks.slice(k), ...inks.slice(0, k)];
          ops.push(...bullseye(turned, round(x % TRAY), (j + 0.5) * step, 5, round(26 + rand() * 6)));
        }
      }
      for (let j = 0; j < n; j++) {
        ops.push({ type: 'rake', x: 0, y: (j + 0.5) * step, angle: 0, z: 70, half: 10, tines: 1, spacing: 0 });
      }
      return ops;
    },
  },
  spiral: {
    label: 'Spiral',
    note: 'One big target of rings, combed once so it is no longer round, then a swirl that turns the inside much faster than the outside, winding the rings into a spiral.',
    build: (rand, inks) => [
      ...bullseye(inks, 500, 500, 16, 46),
      { type: 'rake', x: 500, y: 500, angle: 90, z: 140, half: 18, tines: 3, spacing: 120 },
      { type: 'swirl', x: 500, y: 500, R: 0, z: 380, half: 160 },
    ],
  },
  serpentine: {
    label: 'Serpentine',
    note: 'Nonpareil rows bent by a wave across the tray, so the straight combing snakes from side to side.',
    build: (rand, inks) => [
      ...stones(rand, inks, 110, 95, 30),
      ...gelgit(90, 80, 60, 12),
      fullRake(0, 26, 18, 5),
      { type: 'wave', x: 0, y: 0, angle: 90, A: 45, L: 260, phase: 0 },
    ],
  },
};

function buildPattern(name, seed, paletteName) {
  const pattern = PATTERNS[name] || PATTERNS.battal;
  const palette = PALETTES[paletteName] || PALETTES.istanbul;
  return pattern.build(rng(seed), palette.inks);
}


// ---- src/replay.js -----------------------------------------------------------
// Replaying a marbling: every stroke can be shown part way done, and a
// timeline gives each stroke a share of the playback time.

// The stroke `op` a fraction t (0..1) of the way through. A drop grows
// with its area proportional to t; strokes slide t of their full length.
function partialOp(op, t) {
  const f = Math.min(1, Math.max(0, t));
  switch (op.type) {
    case 'drop': return { ...op, r: op.r * Math.sqrt(f) };
    case 'rake': return { ...op, z: op.z * f };
    case 'swirl': return { ...op, z: op.z * f };
    case 'wave': return { ...op, A: op.A * f };
    default: throw new Error(`unknown operation ${op.type}`);
  }
}

// Seconds of playback per stroke: drops land quickly, strokes are drawn
// slowly enough to follow.
const DURATION = { drop: 0.05, rake: 0.9, swirl: 1.2, wave: 0.9 };

function timeline(ops, maxSeconds = 20) {
  const raw = ops.map((op) => DURATION[op.type]);
  const total = raw.reduce((a, b) => a + b, 0);
  const k = total > maxSeconds ? maxSeconds / total : 1;
  const starts = [];
  let t = 0;
  for (const d of raw) {
    starts.push(t);
    t += d * k;
  }
  return { starts, durations: raw.map((d) => d * k), total: t };
}

// Strokes on the tray at playback time `seconds`: the finished ones and
// the one under way.
function frameAt(ops, line, seconds) {
  if (seconds >= line.total) return ops.slice();
  const out = [];
  for (let i = 0; i < ops.length; i++) {
    const start = line.starts[i];
    if (seconds <= start) break;
    const t = (seconds - start) / line.durations[i];
    if (t >= 1) {
      out.push(ops[i]);
    } else {
      out.push(partialOp(ops[i], t));
      break;
    }
  }
  return out;
}


// ---- src/gpu.js --------------------------------------------------------------
// WebGL2 renderer: the same inverse walk as render.js, one fragment per
// sample, with the strokes read from a float texture (see pack.js).


const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uOps;
uniform int uCount;
uniform vec3 uBath;
uniform float uScale;   // tray units per pixel
uniform float uHeight;  // canvas height in pixels
uniform int uSS;
out vec4 outColor;

vec4 slot(int i, int t) {
  int row = i / ${OPS_PER_ROW};
  int col = (i - row * ${OPS_PER_ROW}) * ${TEXELS_PER_OP} + t;
  return texelFetch(uOps, ivec2(col, row), 0);
}

vec3 inkAt(vec2 p) {
  for (int i = uCount - 1; i >= 0; i--) {
    vec4 a = slot(i, 0);
    int kind = int(a.x + 0.5);
    vec2 c = a.yz;
    if (kind == 0) {
      vec2 d = p - c;
      float d2 = dot(d, d);
      if (d2 <= a.w) return slot(i, 1).xyz;
      p = c + d * sqrt(1.0 - a.w / d2);
    } else if (kind == 1) {
      vec4 b = slot(i, 1);
      vec4 e = slot(i, 2);
      vec2 m = vec2(a.w, b.x);
      float n = -(p.x - c.x) * m.y + (p.y - c.y) * m.x;
      int tines = int(e.y + 0.5);
      float s = 0.0;
      for (int j = 0; j < tines; j++) s += exp(abs(n - b.w - float(j) * e.x) * b.z);
      p -= s * b.y * m;
    } else if (kind == 2) {
      vec4 b = slot(i, 1);
      vec2 d = p - c;
      float rho = length(d);
      if (rho > 0.0) {
        float ang = -b.x * exp(abs(rho - a.w) * b.y) / rho;
        float ca = cos(ang);
        float sa = sin(ang);
        p = c + vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);
      }
    } else {
      vec4 b = slot(i, 1);
      vec2 m = vec2(a.w, b.x);
      float t = dot(p - c, m);
      float s = -b.y * sin(b.z * t + b.w);
      p += s * vec2(-m.y, m.x);
    }
  }
  return uBath;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x - 0.5, uHeight - gl_FragCoord.y - 0.5);
  vec3 sum = vec3(0.0);
  float ss = float(uSS);
  for (int j = 0; j < uSS; j++) {
    for (int i = 0; i < uSS; i++) {
      vec2 q = px + (vec2(float(i), float(j)) + 0.5) / ss;
      sum += inkAt(q * uScale);
    }
  }
  outColor = vec4(sum / (ss * ss), 1.0);
}`;

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || 'shader failed to compile');
  }
  return s;
}

// A renderer on its own canvas, or null where WebGL2 is unavailable.
function createGpuRenderer() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch {
    return null;
  }
  const u = {};
  for (const name of ['uOps', 'uCount', 'uBath', 'uScale', 'uHeight', 'uSS']) u[name] = gl.getUniformLocation(program, name);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const vao = gl.createVertexArray();
  const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  let count = 0;

  return {
    canvas,
    maxSize,
    isLost: () => gl.isContextLost(),

    setOps(ops) {
      const packed = packOps(ops);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, packed.width, packed.rows, 0, gl.RGBA, gl.FLOAT, packed.data);
      count = packed.count;
    },

    // Draw the whole tray at size x size pixels, in horizontal bands of
    // `band` rows so one long frame does not stall the graphics driver.
    draw(size, bath, ss = 1, band = size) {
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      gl.viewport(0, 0, size, size);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(u.uOps, 0);
      gl.uniform1i(u.uCount, count);
      gl.uniform3fv(u.uBath, parseColor(bath).map((v) => v / 255));
      gl.uniform1f(u.uScale, TRAY / size);
      gl.uniform1f(u.uHeight, size);
      gl.uniform1i(u.uSS, ss);
      gl.enable(gl.SCISSOR_TEST);
      for (let y = 0; y < size; y += band) {
        gl.scissor(0, y, size, Math.min(band, size - y));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (band < size) gl.flush();
      }
      gl.disable(gl.SCISSOR_TEST);
    },

    // Block until drawing is done; returns RGBA of one pixel (for timing).
    finish() {
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },

    // RGBA rows top to bottom, for checks against the CPU renderer.
    read() {
      const w = canvas.width;
      const raw = new Uint8Array(w * w * 4);
      gl.readPixels(0, 0, w, w, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      const out = new Uint8ClampedArray(raw.length);
      for (let y = 0; y < w; y++) out.set(raw.subarray((w - 1 - y) * w * 4, (w - y) * w * 4), y * w * 4);
      return out;
    },
  };
}


// ---- src/tools.js ------------------------------------------------------------
// Turn pointer gestures and key presses into marbling operations.


const TOOLS = {
  drop: 'Click to float a drop of ink; drag outward to size it by hand. A new drop pushes the ink around it aside.',
  stylus: 'Drag a single tine through the ink. The ink right under it moves as far as you drag; ink further away moves less.',
  comb: 'Drag to pull a comb of evenly spaced tines across the whole tray, through the point where you start.',
  swirl: 'Press where the centre should be, move out to the circle you want, then circle round. The ink turns along with you.',
  wave: 'Drag to set the direction and the length of one wave. Lines across that direction are bent into waves.',
};

const MIN_DRAG = 4;
// round is shared with patterns.js above (same definition); one module now.
const degrees = (dx, dy) => round((Math.atan2(dy, dx) * 180) / Math.PI);

// Operation for a straight drag from a to b, or null if it is too short
// to mean anything (a click with the drop tool still drops ink).
function opFromDrag(tool, a, b, s) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  switch (tool) {
    case 'drop':
      return {
        type: 'drop', x: round(a[0]), y: round(a[1]),
        r: round(len >= MIN_DRAG ? len : s.size), color: s.color,
      };
    case 'stylus':
      if (len < MIN_DRAG) return null;
      return {
        type: 'rake', x: round(a[0]), y: round(a[1]), angle: degrees(dx, dy),
        z: round(len), half: s.sharp, tines: 1, spacing: 0,
      };
    case 'comb': {
      if (len < MIN_DRAG) return null;
      const op = fullRake(degrees(dx, dy), s.spacing, round(len), s.sharp);
      // pass the comb through the start point rather than the tray centre
      return { ...op, x: round(a[0]), y: round(a[1]) };
    }
    case 'wave':
      if (len < MIN_DRAG) return null;
      return {
        type: 'wave', x: round(a[0]), y: round(a[1]), angle: degrees(dx, dy),
        A: s.amp, L: round(Math.max(len, 10)), phase: 0,
      };
    default:
      return null;
  }
}

// Swirl gesture: a centre and the path of the pointer. The circle is the
// mean distance of the path from the centre, the stroke is the arc swept
// along it (signed: counter-clockwise on screen is negative because the
// y axis points down).
function swirlFromPath(centre, path, s) {
  const pts = path.filter((p) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) >= MIN_DRAG);
  if (pts.length < 2) return null;
  let swept = 0;
  let dist = 0;
  let prev = Math.atan2(pts[0][1] - centre[1], pts[0][0] - centre[0]);
  for (const p of pts) {
    const a = Math.atan2(p[1] - centre[1], p[0] - centre[0]);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    swept += d;
    prev = a;
    dist += Math.hypot(p[0] - centre[0], p[1] - centre[1]);
  }
  const R = dist / pts.length;
  if (Math.abs(swept) < 0.02) return null;
  return {
    type: 'swirl', x: round(centre[0]), y: round(centre[1]),
    R: round(R), z: round(R * swept), half: s.sharp * 3,
  };
}

// Operation for the keyboard: the current tool at the cursor, stroking in
// the chosen direction.
function opFromKey(tool, cursor, s) {
  const a = (s.dir * Math.PI) / 180;
  const reach = 120;
  const end = [cursor[0] + Math.cos(a) * reach, cursor[1] + Math.sin(a) * reach];
  if (tool === 'swirl') {
    return { type: 'swirl', x: round(cursor[0]), y: round(cursor[1]), R: 150, z: round(150 * 1.5), half: s.sharp * 3 };
  }
  if (tool === 'wave') {
    return { type: 'wave', x: round(cursor[0]), y: round(cursor[1]), angle: s.dir, A: s.amp, L: 240, phase: 0 };
  }
  return opFromDrag(tool, cursor, tool === 'drop' ? cursor : end, s);
}

function clampToTray(p) {
  return [Math.min(TRAY, Math.max(0, p[0])), Math.min(TRAY, Math.max(0, p[1]))];
}


// ---- src/main.js, the parts a hero needs ---------------------------------
// Lifted from main.js: MAX_BACKING, rebuildBase(), sizeCanvases() (one square
// canvas, the GPU's own), drawGpu(), redraw(), play() with replay.js's
// timeline, addOp(), trayPoint(), the pointer gestures and startOver().
// Everything upstream hung on element ids (controls, overlay, status, undo,
// share hash, print, keys, CPU fallback) is gone; the pattern, palette, seed
// and stylus sharpness are options instead.

const MAX_BACKING = { cpu: 900, gpu: 2048 };
const DEFAULT_STATE = { pattern: 'gelgit', seed: 1, palette: 'istanbul', added: [] };

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === 'undefined' || typeof matchMedia !== 'function') return resting;
  try {
    return start(el, opts, resting);
  } catch {
    return resting;
  }
}

function start(el, opts, resting) {
  const gpu = createGpuRenderer();
  if (!gpu) return resting;
  const tray = gpu.canvas;
  tray.className = 'fx-marbling__gl';
  tray.setAttribute('aria-hidden', 'true');
  el.insertBefore(tray, el.firstChild);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { ...DEFAULT_STATE, added: [] };
  let sharp = 14;
  let autoplay = true;
  let base = [];
  let gesture = null;
  let playback = null;
  let pendingPlay = false;
  let live = false;
  let size = 0;

  // Options are normalised the way share.js's decodeState() does it.
  const configure = (next) => {
    if (next.pattern !== undefined) state.pattern = PATTERNS[next.pattern] ? next.pattern : DEFAULT_STATE.pattern;
    if (next.palette !== undefined) state.palette = PALETTES[next.palette] ? next.palette : DEFAULT_STATE.palette;
    if (next.seed !== undefined) {
      const v = Number.parseInt(next.seed, 10);
      state.seed = Number.isFinite(v) ? Math.abs(v) % 1000000 : DEFAULT_STATE.seed;
    }
    if (next.sharp !== undefined) {
      const v = Number(next.sharp);
      if (Number.isFinite(v)) sharp = Math.min(80, Math.max(2, v));
    }
    if (next.play !== undefined) autoplay = Boolean(next.play);
  };
  configure(opts);

  const settings = () => ({ sharp });
  const allOps = () => base.concat(state.added);
  const bath = () => PALETTES[state.palette].bath;

  function rebuildBase() {
    base = buildPattern(state.pattern, state.seed, state.palette);
  }

  // ---- rendering -------------------------------------------------------

  // Seam: the tray is one square backing the size of the section's longer
  // side, CSS-covered over the section.
  function sizeCanvases() {
    const side = Math.max(el.clientWidth, el.clientHeight);
    size = Math.max(1, Math.min(MAX_BACKING.gpu, gpu.maxSize, Math.round(side * (window.devicePixelRatio || 1))));
  }

  // Draw on the graphics card; false once the context is gone.
  function drawGpu(ops) {
    if (gpu.isLost()) return false;
    gpu.setOps(ops);
    gpu.draw(size, bath(), 2, 256);
    if (!live) {
      live = true;
      el.setAttribute('data-fx-live', '');
    }
    return true;
  }

  function redraw() {
    drawGpu(allOps());
  }

  // ---- history ---------------------------------------------------------

  function stopPlayback() {
    pendingPlay = false;
    if (!playback) return;
    cancelAnimationFrame(playback.raf);
    playback = null;
  }

  // Replay the marbling from a clean bath: drops grow in with their area
  // rising steadily, strokes slide in to their full length. Under reduced
  // motion the finished marbling is drawn once instead.
  function play() {
    const ops = allOps();
    if (!ops.length || reduceMotion.matches) {
      redraw();
      return;
    }
    const line = timeline(ops);
    const t0 = performance.now();
    playback = { count: 0, raf: 0 };
    const frame = () => {
      if (!playback) return;
      const seconds = (performance.now() - t0) / 1000;
      if (seconds >= line.total) {
        playback = null;
        redraw();
        return;
      }
      const ops2 = frameAt(ops, line, seconds);
      playback.count = ops2.length;
      drawGpu(ops2);
      playback.raf = requestAnimationFrame(frame);
    };
    playback.raf = requestAnimationFrame(frame);
  }

  // ---- editing ---------------------------------------------------------

  function addOp(op) {
    if (!op) return;
    stopPlayback();
    state.added.push(op);
    redraw();
  }

  function startOver() {
    stopPlayback();
    state.added = [];
    rebuildBase();
    redraw();
  }

  // ---- pointer ---------------------------------------------------------

  // Seam: the square tray is CSS-covered over the section, so the visible
  // square is M = max(width, height) px on a side, centred. A section point
  // maps to tray units through that crop; the backing size cancels out.
  function trayPoint(e) {
    const rect = el.getBoundingClientRect();
    const M = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - (rect.width - M) / 2;
    const y = e.clientY - rect.top - (rect.height - M) / 2;
    return clampToTray([(x / M) * TRAY, (y / M) * TRAY]);
  }

  let pending = false;
  function previewGesture() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!gesture) return;
      drawGpu(gesture.op ? allOps().concat([gesture.op]) : allOps());
    });
  }

  const gestureOp = (g) => opFromDrag('stylus', g.start, g.end, settings());

  const onDown = (e) => {
    if (e.button !== 0) return;
    // Seam: a press on the copy panel is a click on the copy, not a stroke;
    // capturing it would steal the CTAs' click.
    if (e.target.closest && e.target.closest('.fx-marbling__inner')) return;
    el.setPointerCapture(e.pointerId);
    const p = trayPoint(e);
    stopPlayback();
    gesture = { start: p, end: p, op: null };
    previewGesture();
  };
  const onMove = (e) => {
    if (!gesture) return;
    gesture.end = trayPoint(e);
    gesture.op = gestureOp(gesture);
    previewGesture();
  };
  function finishGesture(commit) {
    if (!gesture) return;
    const op = commit ? gestureOp(gesture) : null;
    gesture = null;
    if (op) addOp(op);
    else redraw();
  }
  const onUp = () => finishGesture(true);
  const onCancel = () => finishGesture(false);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);

  // ---- start -----------------------------------------------------------

  // The first picture waits for the section to be on screen; a resize before
  // that only sets the backing so the reveal is not spoiled.
  const ro = new ResizeObserver(() => {
    const before = size;
    sizeCanvases();
    if (size !== before && live && !playback && !pendingPlay) redraw();
  });
  const io = new IntersectionObserver((entries) => {
    if (!pendingPlay || !entries.some((en) => en.isIntersecting)) return;
    pendingPlay = false;
    play();
  });

  rebuildBase();
  sizeCanvases();
  ro.observe(el);
  if (autoplay && !reduceMotion.matches) {
    pendingPlay = true;
    io.observe(el);
  } else {
    redraw();
  }

  return {
    update(next) {
      if (!next) return;
      const was = { pattern: state.pattern, seed: state.seed, palette: state.palette };
      configure(next);
      if (state.pattern !== was.pattern || state.seed !== was.seed) startOver();
      else if (state.palette !== was.palette) {
        stopPlayback();
        rebuildBase();
        redraw();
      }
    },
    destroy() {
      stopPlayback();
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      const gl = tray.getContext('webgl2');
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      tray.remove();
      el.removeAttribute('data-fx-live');
    },
  };
}

export const meta = {
  name: 'paper-marbling',
  version: '1.0.0',
  category: 'backgrounds',
  needs: [],
  license: 'MIT',
  options: {
    pattern: { type: 'string', default: 'gelgit', description: "Starting pattern, built from the seed: battal (stones), gelgit (come and go), nonpareil, hearts, spiral or serpentine. Upstream's default. Changing it through update() clears the visitor's strokes and redraws without replaying." },
    palette: { type: 'string', default: 'istanbul', description: 'Bath and inks: istanbul, indigo, ember, lagoon or ink. Changing it through update() recolours the pattern and keeps the strokes.' },
    seed: { type: 'number', default: 1, min: 1, max: 9999, step: 1, description: 'Seed for the pattern generator. The same pattern, palette and seed always give the same marbling.' },
    sharp: { type: 'number', default: 14, min: 2, max: 80, step: 1, description: "Stylus sharpness, upstream's sharp slider: the distance in tray units (the tray is 1000 across) over which a stroke's pull halves. Small is a thin tine, large a broad push." },
    play: { type: 'boolean', default: true, description: 'Grow the pattern in when the section first comes on screen: drops swell at a steady area rate, strokes slide in. Off, or under reduced motion, the finished marbling is drawn once.' },
  },
};
