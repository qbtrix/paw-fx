// tinseltown -- https://github.com/thevangelist/tinseltown
//
// MIT License
// Copyright (c) 2026 Esa Lahikainen
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
// gobo-light: a port of thevangelist/tinseltown at commit
// e31bfc89f22001aa5766eb4032a6d6134b46541b. A film crew puts a cut-out -- a
// cucoloris, a cookie, a gobo -- in front of the lamp, and flat light gets
// pattern and texture. This traces that: an area lamp, one to three cut-out
// planes between it and the wall, soft shadows from sampling the lamp's own
// area, and optional haze the beam scatters through.
//
// It spans five upstream files, all of them inlined below in dependency order
// and all five cited in meta.json.origin.path, because this repo's build emits
// one index.js per effect and a shared module has nowhere to live inside a
// generated site:
//
//   src/shader.js      the GLSL -- the trace pass and the tone-map resolve pass
//   src/optics.js      the rig: lamp placement, cookie planes, Kelvin, motion
//   src/options.js     the option schema, its bounds and its coercion
//   src/cookies.js     19 presets, each a procedurally generated SVG cut-out
//   src/tinseltown.js  the element: WebGL2 setup, accumulation, the governor
//
// Every preset is drawn in code as an SVG string and rasterised in-process, so
// the effect fetches nothing: no image, no font, no CDN. The `src` option is
// upstream's escape hatch for using your own picture as the cookie and is left
// in place, but nothing in this section sets it.
//
// The tracing, the penumbra probe, the haze march, the refinement mean and the
// quality governor are upstream's, constant for constant. The seams are in
// meta.json.deviations: the element no longer registers itself at import, the
// two media queries and the battery probe no longer run at import, the context
// is requested with failIfMajorPerformanceCaveat, and two read-only getters let
// mount() tell a live shader from a dead one.
// ----- upstream src/shader.js -----
const MAX_LAYERS = 3

const VERT = `#version 300 es
void main() {
  gl_Position = vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4.0 - 1.0, 0.0, 1.0);
}`

const COMMON = `#version 300 es
precision highp float;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// Filmic tone map, gamma, and a dither that keeps dark gradients from banding.
vec3 finish(vec3 c, vec2 pixel) {
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(c, vec3(1.0 / 2.2)) + (ign(pixel) - 0.5) / 255.0;
}`

// Tone-maps the accumulated linear light onto the canvas.
const RESOLVE = `${COMMON}
uniform sampler2D uAccum;
out vec4 outColor;
void main() {
  outColor = vec4(finish(texelFetch(uAccum, ivec2(gl_FragCoord.xy), 0).rgb, gl_FragCoord.xy), 1.0);
}`

const FRAG = `${COMMON}
uniform vec2 uRes, uView;
uniform float uTime, uFrame;
uniform vec3 uLight, uLightU, uLightV, uAxis;
uniform vec2 uCone;
uniform float uWallNorm, uDistance2;
uniform int uLayers, uEdge, uSamples, uShape, uDirect, uInvert;
uniform vec3 uC[${MAX_LAYERS}], uN[${MAX_LAYERS}], uU[${MAX_LAYERS}], uV[${MAX_LAYERS}];
uniform sampler2D uCookie;
uniform vec3 uWall, uLightColor;
uniform float uAmbient, uHaze, uHazeDepth, uThreshold, uBlur;
out vec4 outColor;

const float GOLDEN_ANGLE = 2.39996323;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const int HAZE_STEPS = 16;
const int PROBES = 12;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 e = vec2(0.0, 1.0);
  return mix(
    mix(mix(hash(i + e.xxx), hash(i + e.yxx), f.x), mix(hash(i + e.xyx), hash(i + e.yyx), f.x), f.y),
    mix(mix(hash(i + e.xxy), hash(i + e.yxy), f.x), mix(hash(i + e.xyy), hash(i + e.yyy), f.x), f.y), f.z);
}

float smoke(vec3 p) { return 0.57 * noise(p) + 0.29 * noise(p * 2.1) + 0.14 * noise(p * 4.3); }

// Premultiplied texels make 1 - a + rgb equal to 1 - a * (1 - straight rgb), and keep it filterable.
// Per channel, so a colour slide tints the light the way a gel or stained glass does.
vec3 through(vec3 p, vec3 d) {
  vec3 t = vec3(1.0);
  for (int i = 0; i < uLayers; i++) {
    float k = dot(uC[i] - p, uN[i]) / dot(d, uN[i]);
    if (k >= 1.0) continue;
    // Behind the cookie plane: the wall a window sits in goes on, a free-standing cookie does not.
    if (k <= 0.0) {
      t *= uEdge == 0 ? 0.0 : 1.0;
      continue;
    }
    vec3 hit = p + d * k - uC[i];
    vec2 uv = vec2(dot(hit, uU[i]), dot(hit, uV[i])) * 0.5 + 0.5;
    if (uEdge < 2 && (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0))))) {
      t *= float(uEdge);
      continue;
    }
    vec4 c = textureLod(uCookie, uv, uBlur);
    vec3 pass = clamp(1.0 - c.a + c.rgb, 0.0, 1.0);
    if (uInvert == 1) pass = 1.0 - pass;
    // A threshold turns the picture into a hard mask, which has no colour left.
    t *= uThreshold > 0.0 ? vec3(smoothstep(uThreshold - 0.02, uThreshold + 0.02, dot(pass, LUMA))) : pass;
  }
  return t;
}

// A point on the lamp: 0 disc, 1 square, 2 ring. j shifts the whole pattern per pixel and per frame, in both axes.
vec3 lightSample(float i, float n, vec2 j) {
  vec2 s;
  if (uShape == 1) {
    s = fract(vec2(0.7548776662, 0.5698402910) * (i + 1.0) + j) * 2.0 - 1.0;
  } else {
    float r = uShape == 2 ? mix(0.8, 1.0, fract(i * 0.618034 + j.y)) : sqrt((i + j.y) / n);
    float a = i * GOLDEN_ANGLE + j.x * 6.2831853;
    s = r * vec2(cos(a), sin(a));
  }
  return uLight + uLightU * s.x + uLightV * s.y;
}

// Radiant intensity arriving at p from one point of the lamp, before the receiver's own cosine.
// t reports how much of that point the cookie lets through, per channel.
float beam(vec3 p, vec3 s, out vec3 l, out vec3 t) {
  vec3 d = s - p;
  float r2 = dot(d, d);
  l = d * inversesqrt(r2);
  float c = dot(-l, uAxis);
  float cone = smoothstep(uCone.x, uCone.y, c);
  t = cone > 0.0 ? through(p, d) : vec3(0.0);
  return cone * c / r2;
}

void main() {
  vec2 q = (gl_FragCoord.xy / uRes * 2.0 - 1.0) * uView;
  vec2 seed = gl_FragCoord.xy + 5.588238 * uFrame;
  vec2 j = vec2(ign(seed), ign(seed.yx + 17.0));
  float n = float(uSamples);
  vec3 l;

  // Most pixels see all of the lamp or none of it. A few probes spread over the lamp find those, and only the
  // penumbra pays for every sample.
  vec3 wall = vec3(0.0), t, lo = vec3(1.0), hi = vec3(0.0);
  for (int i = 0; i < PROBES; i++) {
    float b = beam(vec3(q, 0.0), lightSample((float(i) + 0.5) * n / float(PROBES), n, j), l, t);
    wall += t * b * max(l.z, 0.0);
    lo = min(lo, t);
    hi = max(hi, t);
  }
  vec3 spread = hi - lo;
  if (max(spread.r, max(spread.g, spread.b)) < 0.01 || uSamples <= PROBES) {
    wall *= uWallNorm / float(PROBES);
  } else {
    wall = vec3(0.0);
    for (int i = 0; i < uSamples; i++) {
      float b = beam(vec3(q, 0.0), lightSample(float(i), n, j), l, t);
      wall += t * b * max(l.z, 0.0);
    }
    wall *= uWallNorm / n;
  }

  vec3 scatter = vec3(0.0);
  if (uHaze > 0.0) {
    vec3 wind = uTime * vec3(0.05, 0.02, 0.03);
    for (int i = 0; i < HAZE_STEPS; i++) {
      vec3 p = vec3(q, uHazeDepth * (float(i) + j.x) / float(HAZE_STEPS));
      float b = beam(p, lightSample(float(i), float(HAZE_STEPS), j), l, t);
      scatter += t * b * (0.3 + 1.4 * smoke(p * 1.3 + wind));
    }
    scatter *= 0.1 * uHaze * uDistance2 * uHazeDepth / float(HAZE_STEPS);
  }

  vec3 c = uWall * (uAmbient + uLightColor * wall) + uLightColor * scatter;
  outColor = vec4(uDirect == 1 ? finish(c, gl_FragCoord.xy) : c, 1.0);
}`

// ----- upstream src/optics.js -----
const { sin, cos, PI } = Math
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = a => mul(a, 1 / Math.hypot(...a))
const rad = deg => (deg * PI) / 180

// Half extents of the wall area every preset is composed for.
const FRAME = [1.6, 1]

// Framing works like background-size: cover. The element shows the largest part of the frame that has its aspect,
// so a wide or huge screen never runs out of lit wall.
function viewExtent(aspect) {
  const k = Math.min(1, FRAME[0] / aspect)
  return [aspect * k, k]
}

// Straight-alpha rule per channel: black/opaque blocks, white/transparent passes, a colour tints the light.
const transmission = (r, g, b, a) => [r, g, b].map(c => 1 - a * (1 - c))

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function kelvinToRgb(kelvin) {
  const t = kelvin / 100
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [r, g, b].map(c => srgbToLinear(Math.min(255, Math.max(0, c)) / 255))
}

function motionAt(t, motions, layer = 0) {
  const p = t + layer * 1.7
  const m = { roll: 0, x: 0, y: 0, azimuth: 0, elevation: 0, gain: 1 }
  if (motions.includes('sway')) {
    m.roll = 1.1 * sin(p * 0.5) + 0.5 * sin(p * 0.93 + 1)
    m.x = 0.015 * sin(p * 0.41)
    m.y = 0.008 * sin(p * 0.67 + 2)
  }
  if (motions.includes('drift')) m.x += t * 0.02
  if (motions.includes('spin')) m.roll += t * 16
  if (motions.includes('breathe')) {
    m.azimuth = 2 * sin(t * 0.19)
    m.elevation = 1.5 * sin(t * 0.26 + 1)
  }
  if (motions.includes('flicker')) m.gain = 1 + 0.05 * sin(t * 11) + 0.035 * sin(t * 19.7 + 1) + 0.025 * sin(t * 33.3 + 2)
  return m
}

// Wall is the plane z=0, y spans [-1, 1]. Cookies face the light, extra layers sit closer to it.
function rig(o, t = 0) {
  const time = t * o.speed
  const motions = o.motion.split(/\s+/)
  const lightMotion = motionAt(time, motions)
  const az = rad(o.azimuth + lightMotion.azimuth)
  const el = rad(o.elevation + lightMotion.elevation)
  const aim = [o.aimX, o.aimY, 0]
  const n = [cos(el) * cos(az), cos(el) * sin(az), sin(el)]
  const u0 = unit(cross(Math.abs(n[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0], n))
  const v0 = cross(n, u0)

  const layers = Array.from({ length: o.layers }, (_, i) => {
    const m = motionAt(time, motions, i)
    const roll = rad(o.cookieRoll + m.roll + 97 * i)
    const u = add(mul(u0, cos(roll)), mul(v0, sin(roll)))
    const v = sub(mul(v0, cos(roll)), mul(u0, sin(roll)))
    const half = (o.cookieScale * (1 + 0.3 * i)) / 2
    const distance = Math.min(o.cookieDistance * (1 + 0.35 * i), o.lightDistance * 0.9)
    const c = add(add(aim, mul(n, distance)), add(mul(u, m.x), mul(v, m.y)))
    return { c, n, u: mul(u, 1 / (half * o.cookieAspect)), v: mul(v, 1 / half) }
  })

  return {
    light: add(aim, mul(n, o.lightDistance)),
    axis: mul(n, -1),
    lightU: mul(u0, o.lightSize),
    lightV: mul(v0, o.lightSize),
    distance2: o.lightDistance ** 2,
    wallNorm: o.lightDistance ** 2 / n[2],
    cone: [cos(rad(o.spread)), cos(rad(o.spread * 0.7))],
    gain: lightMotion.gain,
    layers,
  }
}

// Mirror of the shader's ray/plane step: where the ray from wall point p to light sample s crosses a cookie.
function project(p, s, { c, n, u, v }) {
  const d = sub(s, p)
  const k = dot(sub(c, p), n) / dot(d, n)
  if (!(k > 0 && k < 1)) return null
  const hit = sub(add(p, mul(d, k)), c)
  return [dot(hit, u) * 0.5 + 0.5, dot(hit, v) * 0.5 + 0.5]
}

// ----- upstream src/options.js -----
// Bounds keep hostile or mistyped attributes from dividing by zero or stalling the GPU.
const SCHEMA = {
  azimuth: { default: 140 },
  elevation: { default: 42, min: 5, max: 90 },
  lightDistance: { default: 6, min: 0.5, max: 100 },
  lightSize: { default: 0.15, min: 0, max: 5 },
  // The index of each value is the uShape code in the shader.
  lightShape: { default: 'disc', values: ['disc', 'square', 'ring'] },
  spread: { default: 32, min: 1, max: 89 },
  aimX: { default: 0, min: -10, max: 10 },
  aimY: { default: 0, min: -10, max: 10 },
  cookieDistance: { default: 1.5, min: 0.01, max: 90 },
  cookieScale: { default: 3, min: 0.05, max: 50 },
  cookieRoll: { default: 0 },
  cookieBlur: { default: 0, min: 0, max: 12 },
  threshold: { default: 0, min: 0, max: 1 },
  // A bare attribute counts as true, like any HTML boolean.
  invert: { default: false },
  layers: { default: 1, min: 1, max: MAX_LAYERS, integer: true },
  // The index of each value is the uEdge code in the shader.
  edge: { default: 'repeat', values: ['block', 'pass', 'repeat'] },
  colorTemp: { default: 3200, min: 1000, max: 40000 },
  // A gel: any CSS colour. Empty means the lamp burns at colorTemp.
  lightColor: { default: '' },
  intensity: { default: 2.2, min: 0, max: 100 },
  ambient: { default: 0.1, min: 0, max: 10 },
  wall: { default: '#3a3835' },
  haze: { default: 0, min: 0, max: 4 },
  motion: { default: '', tokens: ['sway', 'drift', 'spin', 'breathe', 'flicker'] },
  speed: { default: 1, min: 0, max: 20 },
  samples: { default: 48, min: 1, max: 256, integer: true },
  resolution: { default: 1, min: 0.1, max: 2 },
}

function coerce(spec, raw) {
  if (raw === undefined || raw === null) return spec.default
  if (typeof spec.default === 'boolean') return raw === true || raw === '' || raw === 'true'
  if (typeof spec.default === 'number') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
    if (!Number.isFinite(n)) return spec.default
    const clamped = Math.min(Math.max(n, spec.min ?? -Infinity), spec.max ?? Infinity)
    return spec.integer ? Math.round(clamped) : clamped
  }
  if (spec.values) return spec.values.includes(raw) ? raw : spec.default
  if (spec.tokens) return String(raw).split(/\s+/).filter(token => spec.tokens.includes(token)).join(' ')
  return String(raw)
}

// Attributes win over the preset rig, which wins over the defaults. Unknown keys are dropped.
function resolveOptions(presetRig = {}, attributes = {}) {
  const options = {}
  for (const [key, spec] of Object.entries(SCHEMA)) options[key] = coerce(spec, attributes[key] ?? presetRig[key])
  return options
}

// ----- upstream src/cookies.js -----
// Presets are K+A SVGs: black blocks light, white or transparent passes it.
const SIZE = 1000

const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const svg = body =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`

const board = holes => `<rect width="${SIZE}" height="${SIZE}"/><g fill="#fff">${holes}</g>`

// Repeats the body across the 8 neighbouring tiles so shapes crossing an edge wrap seamlessly.
const tiled = body => {
  const copies = [-SIZE, 0, SIZE].flatMap(x => [-SIZE, 0, SIZE].map(y => (x || y ? `<use href="#t" x="${x}" y="${y}"/>` : '')))
  return `<g id="t">${body}</g>${copies.join('')}`
}

const leaf = (x, y, angle, length, width) =>
  `<path transform="translate(${x} ${y}) rotate(${angle})" d="M0 0Q${length / 2} ${-width} ${length} 0Q${length / 2} ${width} 0 0"/>`

function blob(cx, cy, radius, rand) {
  const count = 5 + Math.floor(rand() * 4)
  const points = Array.from({ length: count }, (_, i) => {
    const a = ((i + rand() * 0.6) / count) * Math.PI * 2, r = radius * (0.3 + 0.9 * rand())
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points.at(-1), points[0])
  const curves = points.map((p, i) => `Q${p} ${mid(p, points[(i + 1) % points.length])}`)
  return `<path d="M${start}${curves.join('')}Z"/>`
}

function panes(cols, rows, bar = 28, frame = 70) {
  const w = (SIZE - 2 * frame - (cols - 1) * bar) / cols, h = (SIZE - 2 * frame - (rows - 1) * bar) / rows
  let holes = ''
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      holes += `<rect x="${frame + c * (w + bar)}" y="${frame + r * (h + bar)}" width="${w}" height="${h}"/>`
  return holes
}

function blinds(slats = 16, frame = 60) {
  const pitch = (SIZE - 2 * frame) / slats
  let gaps = ''
  for (let i = 0; i < slats; i++)
    gaps += `<rect x="${frame}" y="${frame + i * pitch}" width="${SIZE - 2 * frame}" height="${pitch * 0.4}"/>`
  const cords = [0.22, 0.78].map(x => `<rect x="${SIZE * x}" y="${frame}" width="5" height="${SIZE - 2 * frame}" fill="#000"/>`)
  return board(gaps) + cords.join('')
}

function breakup() {
  const rand = rng(7), cells = 6, cell = SIZE / cells
  let holes = ''
  for (let c = 0; c < cells; c++)
    for (let r = 0; r < cells; r++)
      holes += blob((c + 0.5 + (rand() - 0.5) * 0.5) * cell, (r + 0.5 + (rand() - 0.5) * 0.5) * cell, cell * 0.42, rand)
  return `<rect width="${SIZE}" height="${SIZE}"/><g fill="#fff">${tiled(holes)}</g>`
}

function halftone(rows = 30) {
  const pitch = SIZE / rows
  let holes = ''
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < rows; col++) {
      const x = (col + (row % 2 ? 1 : 0.5)) * pitch, y = (row + 0.5) * pitch
      const level = 1 - Math.hypot(x - SIZE / 2, y - SIZE / 2) / (SIZE / 2)
      if (level > 0.03) holes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(pitch * 0.5 * Math.sqrt(level)).toFixed(1)}"/>`
    }
  return board(holes)
}

function leaves() {
  const rand = rng(11)
  let body = ''
  for (let twig = 0; twig < 12; twig++) {
    const x = rand() * SIZE, y = rand() * SIZE, angle = rand() * 360, length = 180 + rand() * 160
    let sprigs = `<rect width="${length}" height="5" y="-2.5"/>`
    for (let i = 0; i < 8; i++)
      sprigs += leaf(20 + (i / 8) * length, 0, (i % 2 ? 1 : -1) * (35 + rand() * 30), 70 + rand() * 60, 18 + rand() * 12)
    body += `<g transform="translate(${x} ${y}) rotate(${angle})">${sprigs}</g>`
  }
  return tiled(body)
}

function palm() {
  const rand = rng(3)
  let body = ''
  for (const [angle, length] of [[-62, 1150], [-38, 1250], [-14, 1100]]) {
    let frond = `<path d="M0 0Q${length / 2} -120 ${length} 60" fill="none" stroke="#000" stroke-width="9"/>`
    for (let i = 4; i < 60; i++) {
      const t = i / 60, x = t * length, y = -240 * t * (1 - t) + 60 * t * t
      const slope = (Math.atan2(-240 * (1 - 2 * t) + 120 * t, length) * 180) / Math.PI
      const reach = 260 * Math.sin(Math.PI * Math.min(1, t + 0.12)) + 40
      for (const side of [-1, 1]) frond += leaf(x, y, slope + side * (58 - 25 * t + rand() * 8), reach, 11)
    }
    body += `<g transform="translate(-60 1060) rotate(${angle})">${frond}</g>`
  }
  return body
}

function palmTree() {
  const rand = rng(5), crown = [560, 330]
  let body = `<path d="M352 1000Q470 640 ${crown[0] - 9} ${crown[1]}L${crown[0] + 9} ${crown[1]}Q520 650 410 1000Z"/>`
  for (let i = 0; i < 13; i++) {
    const heading = ((-205 + i * 19 + rand() * 8) * Math.PI) / 180
    const length = 330 + rand() * 110, droop = 170 + rand() * 120
    const at = t => [crown[0] + length * t * Math.cos(heading), crown[1] + length * t * Math.sin(heading) + droop * t * t]
    body += `<path d="M${crown}Q${at(0.5).map((v, k) => v - (k ? droop / 4 : 0))} ${at(1)}" fill="none" stroke="#000" stroke-width="6"/>`
    for (let t = 0.1; t < 1; t += 0.03) {
      const tangent = (Math.atan2(length * Math.sin(heading) + 2 * droop * t, length * Math.cos(heading)) * 180) / Math.PI
      const reach = 95 * Math.sin(Math.PI * t ** 0.7) + 18
      for (const side of [-1, 1]) body += leaf(...at(t), tangent + side * (62 - 28 * t) + (90 - tangent) * 0.25, reach, 7)
    }
  }
  for (const [x, y] of [[-14, 8], [12, 14], [0, 26]]) body += `<circle cx="${crown[0] + x}" cy="${crown[1] + y}" r="15"/>`
  return body
}

function fence(pickets = 20) {
  const pitch = SIZE / pickets, w = pitch * 0.62
  let body = `<rect y="520" width="${SIZE}" height="38"/><rect y="820" width="${SIZE}" height="38"/>`
  for (let i = 0; i < pickets; i++) {
    const x = i * pitch + (pitch - w) / 2
    body += `<path d="M${x} 1000V440L${x + w / 2} 380L${x + w} 440V1000Z"/>`
  }
  return body
}

function staircase(steps = 9) {
  const run = SIZE / steps, rise = 78
  let body = `<path d="M0 ${SIZE - steps * rise - 330}L${SIZE} ${SIZE - 330}" fill="none" stroke="#000" stroke-width="34"/>`
  for (let i = 0; i < steps; i++) {
    const x = i * run, tread = SIZE - (steps - i) * rise
    body += `<rect x="${x}" y="${tread}" width="${run + 1}" height="${SIZE - tread}"/>`
    for (const offset of [0.3, 0.75]) {
      const bx = x + run * offset, top = SIZE - steps * rise - 330 + (bx / SIZE) * steps * rise
      body += `<rect x="${bx - 7}" y="${top}" width="14" height="${tread - top}"/>`
    }
  }
  return body
}

function bricks(rows = 20, columns = 8, mortar = 10) {
  const w = SIZE / columns, h = SIZE / rows
  let holes = ''
  for (let row = 0; row < rows; row++)
    for (let col = -1; col < columns; col++)
      holes += `<rect x="${(col + (row % 2) / 2) * w + mortar / 2}" y="${row * h + mortar / 2}" width="${w - mortar}" height="${h - mortar}"/>`
  return board(holes)
}

function bars(count = 9) {
  let body = `<rect y="120" width="${SIZE}" height="46"/><rect y="840" width="${SIZE}" height="46"/>`
  for (let i = 0; i < count; i++) body += `<rect x="${(i + 0.5) * (SIZE / count) - 17}" width="34" height="${SIZE}"/>`
  return body
}

function archedWindow() {
  let holes = ''
  for (const [x, w] of [[150, 320], [530, 320]]) {
    holes += `<path d="M${x} 470V${300}A${w / 2} 200 0 0 1 ${x + w} 300V470Z"/>`
    for (const y of [510, 730]) holes += `<rect x="${x}" y="${y}" width="${w}" height="180"/>`
  }
  return board(holes)
}

function fan(blades = 4) {
  let body = '<circle cx="500" cy="500" r="70"/>'
  for (let i = 0; i < blades; i++)
    body += `<path transform="rotate(${(i * 360) / blades} 500 500)" d="M500 470Q760 380 960 450Q990 500 960 550Q760 620 500 530Z"/>`
  return body
}

function chainLink(cells = 12) {
  const pitch = SIZE / cells
  let body = ''
  for (let i = -cells; i <= cells * 2; i++)
    for (const sign of [1, -1]) body += `<path d="M${i * pitch} 0L${i * pitch + sign * SIZE} ${SIZE}" fill="none" stroke="#000" stroke-width="9"/>`
  return body
}

function train(windows = 4) {
  const pitch = SIZE / windows
  let holes = ''
  for (let i = 0; i < windows; i++) holes += `<rect x="${i * pitch + pitch * 0.14}" y="300" width="${pitch * 0.72}" height="400" rx="26"/>`
  return board(holes)
}

// Soft noise as alpha on black. stitchTiles keeps it seamless under edge repeat.
const clouds = () => `<filter id="c" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="4" seed="4" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.4 0 0 0 -1.3"/></filter>
<rect width="${SIZE}" height="${SIZE}" filter="url(#c)"/>`

const FREE_RIG = { edge: 'pass', cookieDistance: 1.7, cookieScale: 2.5, lightSize: 0.04 }
const WINDOW_RIG = { edge: 'block', cookieDistance: 1.6, cookieScale: 1.6, lightSize: 0.085, elevation: 38 }
const BLINDS_RIG = { ...WINDOW_RIG, cookieScale: 2.2, colorTemp: 3400 }

const PRESETS = {
  'blinds-horizontal': { svg: () => svg(blinds()), rig: BLINDS_RIG },
  'blinds-vertical': { svg: () => svg(`<g transform="rotate(90 500 500)">${blinds()}</g>`), rig: BLINDS_RIG },
  window: { svg: () => svg(board(panes(2, 2))), rig: { ...WINDOW_RIG, colorTemp: 4800 } },
  'french-doors': { svg: () => svg(board(panes(4, 5, 24))), rig: { ...WINDOW_RIG, cookieScale: 1.9, colorTemp: 4300 } },
  halftone: { svg: () => svg(halftone()), rig: { edge: 'block', cookieDistance: 1.6, cookieScale: 2.8, lightSize: 0.03, colorTemp: 3000 } },
  breakup: { svg: () => svg(breakup()), rig: { cookieDistance: 1.5, cookieScale: 2.6, lightSize: 0.2 } },
  leaves: { svg: () => svg(leaves()), rig: { layers: 2, motion: 'sway', cookieDistance: 1.6, cookieScale: 2.2, lightSize: 0.035, colorTemp: 5200 } },
  'palm-tree': { svg: () => svg(palmTree()), rig: { ...FREE_RIG, cookieScale: 1.7, elevation: 55, motion: 'sway', colorTemp: 3600 } },
  fence: { svg: () => svg(fence()), rig: { ...FREE_RIG, elevation: 30, colorTemp: 3800 } },
  staircase: { svg: () => svg(staircase()), rig: { ...FREE_RIG, colorTemp: 3400 } },
  bricks: { svg: () => svg(bricks()), rig: { cookieDistance: 1.6, cookieScale: 2.6, lightSize: 0.04 } },
  clouds: { svg: () => svg(clouds()), rig: { motion: 'drift', cookieDistance: 2.2, cookieScale: 4, lightSize: 0.3, colorTemp: 5600 } },
  bars: { svg: () => svg(bars()), rig: { ...FREE_RIG, cookieScale: 3, colorTemp: 5200 } },
  'arched-window': { svg: () => svg(archedWindow()), rig: { ...WINDOW_RIG, cookieScale: 2, colorTemp: 4400 } },
  'ceiling-fan': { svg: () => svg(fan()), rig: { ...FREE_RIG, cookieScale: 2.2, elevation: 70, lightSize: 0.1, motion: 'spin', colorTemp: 3000 } },
  'chain-link': { svg: () => svg(chainLink()), rig: { cookieDistance: 1.6, cookieScale: 2.4, lightSize: 0.03, colorTemp: 4800 } },
  iris: { svg: () => svg(board('<circle cx="500" cy="500" r="330"/>')), rig: { ...WINDOW_RIG, cookieScale: 1.5, elevation: 80, lightSize: 0.12, colorTemp: 4000 } },
  train: { svg: () => svg(train()), rig: { motion: 'drift', speed: 10, cookieDistance: 1.7, cookieScale: 2.6, elevation: 35, lightSize: 0.12, colorTemp: 3000 } },
  palm: { svg: () => svg(palm()), rig: { edge: 'pass', motion: 'sway', cookieDistance: 1.6, cookieScale: 2.4, lightSize: 0.04, colorTemp: 4000 } },
}

// ----- upstream src/tinseltown.js -----
const TAG = 'tinseltown-backdrop'
const TEXTURE_SIZE = 2048
const MAX_CANVAS_SIZE = 4096
// A still rig keeps refining for this many frames, then stops. 48 samples become about a thousand.
const REFINE_FRAMES = 24
// The governor: this many slow frames in a row and the render scale drops a step, down to the floor.
const SLOW_FRAME_MS = 24
const SLOW_FRAMES = 6
const QUALITY_STEP = 0.25
const QUALITY_FLOOR = 0.5
// After a change the old picture fades into the new one over a few frames, so the grain of a single frame never pops.
const FADE_FRAMES = 6
const FADE_ALPHA = 0.4
// On a draining battery the rig goes quiet: a small, still picture from few samples. A laptop has died of less.
const ECO_BATTERY_LEVEL = 0.3
const ECO_SAMPLES = 16
const ECO_REFINE_FRAMES = 6
const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
const kebab = key => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)
// SEAM: upstream read both queries at module scope. paw-fx forbids touching a
// global at import time, so they resolve on the first mount instead. NO_MQ keeps
// the class's .matches / .addEventListener calls total where matchMedia is absent.
const NO_MQ = { matches: false, addEventListener() {}, removeEventListener() {} }
let reducedMotion = NO_MQ
let coarsePointer = NO_MQ

let eco = false
// SEAM: upstream started this promise chain at module scope. Same rule as the
// media queries -- it now runs once, on the first mount. The body is upstream's.
let wired = false
function wireOnce() {
  if (wired) return
  wired = true
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? NO_MQ
  coarsePointer = globalThis.matchMedia?.('(pointer: coarse)') ?? NO_MQ
  globalThis.navigator?.getBattery?.().then(battery => {
    const update = () => (eco = !battery.charging && battery.level <= ECO_BATTERY_LEVEL)
    update()
    battery.addEventListener('levelchange', update)
    battery.addEventListener('chargingchange', update)
  }).catch(() => {})
}

const STYLE = `<style>
:host { position: absolute; inset: 0; z-index: -1; display: block; pointer-events: none; background: #1c1a17; }
canvas { display: block; width: 100%; height: 100%; }
</style>`

const sizeOf = source => [
  source.videoWidth || source.naturalWidth || source.width || 0,
  source.videoHeight || source.naturalHeight || source.height || 0,
]

// Undefined for anything that is not a CSS colour, so callers choose their own fallback.
const colors = new Map()
function cssColorToLinear(color) {
  if (!CSS.supports('color', color)) return undefined
  if (!colors.has(color)) {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    if (colors.size > 64) colors.clear()
    colors.set(color, [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map(c => srgbToLinear(c / 255)))
  }
  return colors.get(color)
}

// Also caps oversized sources below the GPU texture limit. An SVG without intrinsic size gets a square.
function rasterize(source) {
  const [w, h] = sizeOf(source).map(v => v || TEXTURE_SIZE)
  const scale = TEXTURE_SIZE / Math.max(w, h)
  const canvas = new OffscreenCanvas(Math.round(w * scale), Math.round(h * scale))
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function releaseVideo(video) {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

// The empty base keeps the module importable where there is no DOM, such as a server render.
// SEAM: upstream declared this class at module scope, which reads
// globalThis.HTMLElement the moment the module is evaluated -- in a bundler, in
// a server render, in any page that merely imports it. paw-fx forbids that, so
// the body below is upstream's, unchanged, moved into a factory mount() calls.
// Upstream's `?? class {}` fallback existed for exactly the no-DOM case this
// laziness now covers outright, so it is gone with it.
let TinseltownBackdrop
function backdropClass() {
  TinseltownBackdrop ??= class TinseltownBackdrop extends HTMLElement {

    static observedAttributes = ['preset', 'src', ...Object.keys(SCHEMA).map(kebab)]

    #canvas
    #gl
    #trace
    #resolve
    #locations = new Map()
    #accum = {}
    #refined = 0
    #history = false
    #fading = false
    #quality = 1
    #slow = 0
    #last = 0
    #chained = false
    #cookie
    #seamless = false
    #ownedVideo
    #live = false
    #aspect = 1
    #visible = true
    #frame = 0
    #loads = 0
    #observers = []

    // SEAM: paw-fx falls the section back to its CSS resting state when the shader
    // does not come up, so it has to be able to ask. `live` is false once the context
    // or either program failed (connectedCallback nulls #gl on both paths), and
    // `painted` turns true only after a frame has actually reached the canvas.
    #painted = false
    get live() { return !!this.#gl }
    get painted() { return this.#painted }

    get options() {
      const attributes = {}
      for (const key of Object.keys(SCHEMA)) attributes[key] = this.getAttribute(kebab(key))
      return resolveOptions(PRESETS[this.getAttribute('preset')]?.rig, attributes)
    }

    connectedCallback() {
      // Decoration only: keep it out of the accessibility tree unless the author says otherwise.
      if (!this.hasAttribute('aria-hidden')) this.setAttribute('aria-hidden', 'true')
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
      root.innerHTML = `${STYLE}<canvas></canvas>`
      this.#canvas = root.querySelector('canvas')
      this.#canvas.addEventListener('webglcontextlost', this.#onContextLost)
      this.#canvas.addEventListener('webglcontextrestored', this.#onContextRestored)
      // The default GPU, never a forced discrete one: a backdrop must not be the reason a laptop switches graphics.
      // SEAM: failIfMajorPerformanceCaveat is the paw-fx contract -- a hero running on a
  // software rasteriser is worse than the CSS resting state underneath it.
      this.#gl = this.#canvas.getContext('webgl2', { antialias: false, powerPreference: 'default', failIfMajorPerformanceCaveat: true })
      if (!this.#gl || !this.#setup()) {
        this.#gl = null
        return
      }

      const resize = new ResizeObserver(this.#invalidate)
      const intersect = new IntersectionObserver(([entry]) => {
        this.#visible = entry.isIntersecting
        this.#invalidate()
      })
      resize.observe(this)
      intersect.observe(this)
      this.#observers = [resize, intersect]
      reducedMotion.addEventListener('change', this.#invalidate)
      // Phones start a step down. The governor takes it further if frames still run long.
      this.#quality = coarsePointer.matches ? 1 - QUALITY_STEP : 1
      this.#ownedVideo?.play().catch(() => {})
      if (this.#cookie) this.setCookie(this.#cookie, { live: this.#live })
      else this.#loadCookie()
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.#frame)
      this.#frame = 0
      this.#ownedVideo?.pause()
      this.#observers.forEach(o => o.disconnect())
      reducedMotion.removeEventListener('change', this.#invalidate)
      this.#gl?.getExtension('WEBGL_lose_context')?.loseContext()
      this.#gl = null
    }

    attributeChangedCallback(name, previous, value) {
      if (!this.#gl || previous === value) return
      if (name === 'preset' || name === 'src') this.#loadCookie()
      else this.#invalidate()
    }

    // Any black and alpha image, video or canvas. Pass { live: true } for a canvas that keeps animating.
    setCookie(source, { live = source instanceof HTMLVideoElement, seamless = false } = {}) {
      const [w, h] = sizeOf(source)
      if (!w || !h) throw new TypeError(`${TAG}: setCookie needs an image, video or canvas that has a size`)
      if (!live && Math.max(w, h) > TEXTURE_SIZE) source = rasterize(source)

      this.#loads++
      if (this.#ownedVideo && this.#ownedVideo !== source) {
        releaseVideo(this.#ownedVideo)
        this.#ownedVideo = null
      }
      this.#cookie = source
      this.#live = live
      this.#aspect = w / h
      this.#upload(seamless)
      this.#invalidate()
    }

    async #loadCookie() {
      const load = ++this.#loads
      const src = this.getAttribute('src')
      const preset = PRESETS[this.getAttribute('preset')] ?? PRESETS.breakup
      let video
      try {
        if (src && VIDEO.test(src)) {
          video = Object.assign(document.createElement('video'), { src, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous' })
          await video.play()
          if (load !== this.#loads || !this.#gl) return releaseVideo(video)
          this.setCookie(video)
          this.#ownedVideo = video
          return
        }
        const image = Object.assign(new Image(), { crossOrigin: 'anonymous' })
        image.src = src ?? URL.createObjectURL(new Blob([preset.svg()], { type: 'image/svg+xml' }))
        await image.decode().finally(() => src || URL.revokeObjectURL(image.src))
        if (load === this.#loads && this.#gl) this.setCookie(rasterize(image), { live: false, seamless: !src })
      } catch (error) {
        if (video) releaseVideo(video)
        if (load === this.#loads) console.warn(`${TAG}: could not load the cookie`, src ?? preset, error)
      }
    }

    #program(fragment) {
      const gl = this.#gl
      const program = gl.createProgram()
      const shaders = [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fragment]].map(([type, code]) => {
        const shader = gl.createShader(type)
        gl.shaderSource(shader, code)
        gl.compileShader(shader)
        gl.attachShader(program, shader)
        return shader
      })
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
        console.warn(`${TAG}: shader failed`, gl.getProgramInfoLog(program), ...shaders.map(s => gl.getShaderInfoLog(s)))
        return null
      }
      shaders.forEach(shader => gl.deleteShader(shader))
      return program
    }

    #setup() {
      const gl = this.#gl
      this.#locations = new Map()
      this.#trace = this.#program(FRAG)
      this.#resolve = this.#program(RESOLVE)
      if (!this.#trace || !this.#resolve) return false
      // Refinement averages frames in a float target. Without one the trace draws straight to the canvas.
      const float = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
      this.#accum = float ? { texture: gl.createTexture(), target: gl.createFramebuffer() } : {}

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      return true
    }

    // Presets tile seamlessly. Anything else repeats mirrored, so a photo shows no seam either.
    #upload(seamless = this.#seamless) {
      const gl = this.#gl
      this.#seamless = seamless
      if (!gl || gl.isContextLost() || (this.#cookie.readyState ?? 4) < 2) return
      const wrap = seamless ? gl.REPEAT : gl.MIRRORED_REPEAT
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#cookie)
      gl.generateMipmap(gl.TEXTURE_2D)
    }

    #uniform(name, program = this.#trace) {
      const key = `${program === this.#trace}:${name}`
      if (!this.#locations.has(key)) this.#locations.set(key, this.#gl.getUniformLocation(program, name))
      return this.#locations.get(key)
    }

    // Sizes the float target. False when the GPU refuses it, which drops the element to direct drawing.
    #sizeAccum(width, height) {
      const gl = this.#gl, accum = this.#accum
      if (!accum.target) return false
      if (accum.width === width && accum.height === height) return true
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, accum.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, accum.target)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accum.texture, 0)
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      if (!complete) this.#accum = {}
      Object.assign(accum, { width, height })
      return complete
    }

    #onContextLost = event => {
      event.preventDefault()
      cancelAnimationFrame(this.#frame)
      this.#frame = 0
    }

    #onContextRestored = () => {
      if (!this.#gl || !this.#setup()) return
      if (this.#cookie) this.#upload()
      this.#invalidate()
    }

    // Something changed: start refining from scratch.
    #invalidate = () => {
      this.#refined = 0
      this.#schedule()
    }

    #schedule() {
      if (!this.#frame && this.#gl) this.#frame = requestAnimationFrame(this.#render)
    }

    #render = now => {
      this.#frame = 0
      const gl = this.#gl
      if (!gl || gl.isContextLost() || !this.#cookie || !this.#visible) return

      // Only back-to-back frames say anything about speed. A frame after idle time does not.
      if (this.#chained && now - this.#last > SLOW_FRAME_MS) this.#slow++
      else this.#slow = Math.max(0, this.#slow - 1)
      if (this.#slow >= SLOW_FRAMES && this.#quality > QUALITY_FLOOR) {
        this.#quality -= QUALITY_STEP
        this.#slow = 0
      }
      this.#last = now
      this.#chained = false

      const o = this.options
      const still = reducedMotion.matches || eco
      const time = still ? 0 : now / 1000
      const scale = Math.min(devicePixelRatio, 1.5) * o.resolution * (eco ? QUALITY_FLOOR : this.#quality)
      const width = Math.min(Math.round(this.clientWidth * scale), MAX_CANVAS_SIZE)
      const height = Math.min(Math.round(this.clientHeight * scale), MAX_CANVAS_SIZE)
      if (!width || !height) return
      if (this.#canvas.width !== width || this.#canvas.height !== height) Object.assign(this.#canvas, { width, height })
      gl.viewport(0, 0, width, height)
      if (this.#live) this.#upload()

      const animated = !still && (this.#live || o.motion || o.haze > 0)
      const resized = this.#canvas.width !== this.#accum.width || this.#canvas.height !== this.#accum.height
      if (animated || resized) this.#refined = 0
      if (animated || resized) this.#history = false
      const accumulate = this.#sizeAccum(width, height)
      gl.useProgram(this.#trace)
      gl.bindFramebuffer(gl.FRAMEBUFFER, accumulate ? this.#accum.target : null)
      if (accumulate) {
        gl.enable(gl.BLEND)
        // A running mean, except right after a change: then the old picture is history to fade out, not to keep.
        // The fade leaves about four frames' worth of the new picture, so the mean carries on from there.
        if (this.#refined === 0) this.#fading = this.#history
        const k = this.#refined
        gl.blendColor(0, 0, 0, !this.#fading ? 1 / (k + 1) : k < FADE_FRAMES ? FADE_ALPHA : 1 / (k - 2))
        gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA)
      }

      const r = rig({ ...o, cookieAspect: this.#aspect }, time)
      const flat = key => r.layers.flatMap(layer => layer[key])
      gl.uniform2f(this.#uniform('uRes'), width, height)
      gl.uniform2fv(this.#uniform('uView'), viewExtent(width / height))
      gl.uniform1f(this.#uniform('uTime'), time)
      gl.uniform1f(this.#uniform('uFrame'), this.#refined)
      gl.uniform1i(this.#uniform('uDirect'), accumulate ? 0 : 1)
      gl.uniform1i(this.#uniform('uShape'), SCHEMA.lightShape.values.indexOf(o.lightShape))
      gl.uniform1i(this.#uniform('uInvert'), o.invert ? 1 : 0)
      gl.uniform3fv(this.#uniform('uLight'), r.light)
      gl.uniform3fv(this.#uniform('uLightU'), r.lightU)
      gl.uniform3fv(this.#uniform('uLightV'), r.lightV)
      gl.uniform3fv(this.#uniform('uAxis'), r.axis)
      gl.uniform2fv(this.#uniform('uCone'), r.cone)
      gl.uniform1f(this.#uniform('uWallNorm'), r.wallNorm)
      gl.uniform1f(this.#uniform('uDistance2'), r.distance2)
      gl.uniform1i(this.#uniform('uLayers'), o.layers)
      gl.uniform1i(this.#uniform('uEdge'), SCHEMA.edge.values.indexOf(o.edge))
      gl.uniform1i(this.#uniform('uSamples'), eco ? Math.min(o.samples, ECO_SAMPLES) : o.samples)
      gl.uniform3fv(this.#uniform('uC'), flat('c'))
      gl.uniform3fv(this.#uniform('uN'), flat('n'))
      gl.uniform3fv(this.#uniform('uU'), flat('u'))
      gl.uniform3fv(this.#uniform('uV'), flat('v'))
      gl.uniform3fv(this.#uniform('uWall'), cssColorToLinear(o.wall) ?? cssColorToLinear(SCHEMA.wall.default))
      const lamp = cssColorToLinear(o.lightColor) ?? kelvinToRgb(o.colorTemp)
      gl.uniform3fv(this.#uniform('uLightColor'), lamp.map(c => c * o.intensity * r.gain))
      gl.uniform1f(this.#uniform('uAmbient'), o.ambient)
      gl.uniform1f(this.#uniform('uThreshold'), o.threshold)
      gl.uniform1f(this.#uniform('uBlur'), o.cookieBlur)
      gl.uniform1f(this.#uniform('uHaze'), o.haze)
      gl.uniform1f(this.#uniform('uHazeDepth'), o.cookieDistance * Math.sin((o.elevation * Math.PI) / 180) * 0.9)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      this.#painted = true

      if (accumulate) {
        gl.disable(gl.BLEND)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.useProgram(this.#resolve)
        gl.uniform1i(this.#uniform('uAccum', this.#resolve), 1)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        this.#refined++
        this.#history = true
      }
      if (animated || (accumulate && this.#refined < (eco ? ECO_REFINE_FRAMES : REFINE_FRAMES))) {
        this.#chained = true
        this.#schedule()
      }
    }
  }
  return TinseltownBackdrop
}

// ----- paw-fx seam -----

const FX_TAG = "fx-gobo-light-backdrop";

// Upstream's own option names and upstream's own bounds. Every key here exists
// in SCHEMA (or is `preset`, the element's own attribute), so nothing new is
// invented: these are the subset a section author has a reason to reach for, and
// the rest of SCHEMA still resolves to its upstream default underneath.
const DEFAULTS = {
  preset: "blinds-horizontal",
  wall: "",
  lightColor: "",
  colorTemp: 3400,
  intensity: 2.2,
  ambient: 0.1,
  haze: 0,
  azimuth: 140,
  elevation: 38,
  cookieScale: 2.2,
  cookieDistance: 1.6,
  lightSize: 0.085,
  motion: "",
  speed: 1,
  samples: 48,
  resolution: 1,
};

// Reads --fx-wall off the section so the traced wall and the CSS resting state
// under it stay on one colour. Unset leaves upstream's own default in place.
function wallFrom(el, given) {
  if (given) return given;
  const value = getComputedStyle(el).getPropertyValue("--fx-wall").trim();
  return value || undefined;
}

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === "undefined" || !globalThis.customElements) return resting;

  const options = { ...DEFAULTS, ...opts };
  wireOnce();
  // Upstream registers TinseltownBackdrop at import time. Registering inside
  // mount keeps the module side-effect free, and the tag is namespaced so a page
  // that also loads tinseltown itself is not fighting us for its name.
  if (!customElements.get(FX_TAG)) customElements.define(FX_TAG, backdropClass());

  const node = document.createElement(FX_TAG);
  // `kebab` is upstream's, and `preset` survives it unchanged.
  const write = (key, value) => {
    const name = kebab(key);
    if (value === undefined || value === null || value === "") node.removeAttribute(name);
    else node.setAttribute(name, String(value));
  };
  for (const [key, value] of Object.entries(options)) write(key, key === "wall" ? wallFrom(el, value) : value);

  let torn = false;
  let timer = 0;
  const bail = () => {
    torn = true;
    clearInterval(timer);
    el.removeAttribute("data-fx-live");
    node.remove();
  };

  el.appendChild(node);

  // The context and both programs come up synchronously inside connectedCallback,
  // so a refused GPU or a shader that will not link is known right here and the
  // section keeps its CSS resting state. The first frame is NOT synchronous: the
  // cookie is rasterised through image.decode(), a promise. So data-fx-live waits
  // for a frame to have actually reached the canvas. Without that wait the
  // resting state fades out from under a canvas that is still empty, which is the
  // blank rectangle this guard exists to prevent.
  if (!node.live) {
    node.remove();
    return resting;
  }
  // A timer rather than requestAnimationFrame, deliberately. The element paints
  // on rAF, and rAF stops in a hidden tab, under a throttled compositor, and
  // while the section sits below the fold and its IntersectionObserver holds
  // rendering off -- every case where the flag has legitimately not flipped yet.
  // An rAF poll starves in exactly those cases and would also spin sixty times a
  // second, forever, on a hero nobody scrolls to. This observes the flag whenever
  // it flips and stops the moment it does.
  const check = () => {
    if (torn) return;
    if (!node.live) return bail();
    if (!node.painted) return;
    clearInterval(timer);
    el.setAttribute("data-fx-live", "");
  };
  timer = setInterval(check, 100);
  check();

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(options, next);
      for (const [key, value] of Object.entries(next)) write(key, key === "wall" ? wallFrom(el, value) : value);
    },
    destroy: bail,
  };
}

export const meta = {
  name: "gobo-light",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    preset: { type: "string", default: "blinds-horizontal", description: "Which cut-out sits in front of the lamp. One of blinds-horizontal, blinds-vertical, window, french-doors, halftone, breakup, leaves, palm-tree, fence, staircase, bricks, clouds, bars, arched-window, ceiling-fan, chain-link, iris, train, palm. Each is drawn in code as an SVG, so none of them fetches anything." },
    wall: { type: "string", default: "", description: "The surface the light lands on, as any CSS colour. Empty reads --fx-wall off the section, which is what keeps the shader and the CSS resting state on one colour; upstream's own default is #3a3835." },
    lightColor: { type: "string", default: "", description: "A gel on the lamp, as any CSS colour. Empty means the lamp burns at colorTemp instead, which is the more natural of the two." },
    colorTemp: { type: "number", default: 3400, description: "Lamp colour in Kelvin when no gel is set: 3000 is a warm tungsten interior, 5600 is daylight. Upstream default 3200, range 1000 to 40000." },
    intensity: { type: "number", default: 2.2, description: "Lamp output. Upstream default 2.2, range 0 to 100. Raising it past the point where the lit bands clip to white is what puts copy under 4.5:1, so move this before you reach for the scrim." },
    ambient: { type: "number", default: 0.1, description: "Flat fill on the wall everywhere the beam does not reach; 0 is a pitch-black shadow. Upstream default 0.1, range 0 to 10." },
    haze: { type: "number", default: 0, description: "Smoke in the air for the beam to scatter through, which is what turns a pattern on a wall into visible shafts. Costs a 16-step march per pixel. Upstream default 0, range 0 to 4." },
    azimuth: { type: "number", default: 140, description: "Compass bearing of the lamp in degrees, so which side of the frame the light comes from. Upstream default 140." },
    elevation: { type: "number", default: 38, description: "How high the lamp sits in degrees; low rakes long shadows across the wall, high drops them short. Upstream default 42, range 5 to 90." },
    cookieScale: { type: "number", default: 2.2, description: "Size of the cut-out against the frame, so how large the cast pattern reads. Upstream default 3, range 0.05 to 50." },
    cookieDistance: { type: "number", default: 1.6, description: "Gap between the cut-out and the wall. Near is a crisp edge, far is a soft one. Upstream default 1.5, range 0.01 to 90." },
    lightSize: { type: "number", default: 0.085, description: "Radius of the lamp itself, which is the real softness control: a point source gives hard edges, a wide source a broad penumbra. Upstream default 0.15, range 0 to 5." },
    motion: { type: "string", default: "", description: "Space-separated tokens from sway, drift, spin, breathe, flicker; empty is a still rig, which is also what refines to the cleanest picture. Reduced motion pins this off." },
    speed: { type: "number", default: 1, description: "Multiplier on whatever motion is running. Upstream default 1, range 0 to 20." },
    samples: { type: "number", default: 48, description: "Lamp samples per pixel per frame, so how smooth the penumbra is. A still rig keeps averaging frames on top of this and reaches about a thousand. Upstream default 48, range 1 to 256." },
    resolution: { type: "number", default: 1, description: "Render scale before the device pixel ratio. Below 1 trades sharpness for frame time; the governor lowers it on its own when frames run long. Upstream default 1, range 0.1 to 2." },
  },
};
