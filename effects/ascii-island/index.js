// Noxe ASCII Engine -- https://github.com/danieljan-design/noxe-ascii-engine
//
// MIT License
//
// Copyright (c) 2026 Daniel Jankulovski
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
// ascii-island: a port of danieljan-design/noxe-ascii-engine at commit
// 16e6bb9482ee41a722be0f0f51d9182a4d733eda -- engine/shaders.js, engine/atlas.js,
// engine/ascii-engine.js, scenes/kit.js and scenes/island.js inlined in that
// order with their import lines removed, then the loop from app.js cut down to
// a section. Visual logic is upstream's; the seams are listed in meta.json.
import * as THREE from '../../vendor/three.module.js';

// ==== engine/shaders.js ====
// All GLSL for the ASCII pipeline.
//
//  1. scene colour   (three.js, HDR, + depth texture)
//  2. aux            (view normal xyz + glyph set id in alpha)
//  3. EDGE   per scene pixel: silhouette (laplacian of 1/z) + crease (normal structure tensor) -> strength + orientation
//  4. CELL   per character cell: average colour, tone map, pick glyph (ramp / orientation / edge vote)
//  5. COMPOSE per screen pixel: draw the cell's glyph from the atlas in the cell's colour
//  6. blur chains (tilt-shift + bloom) and FINAL (views, vignette, grain)

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */`
const float PI_ = 3.14159265359;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 acesFilm(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
`;

const EDGE_FRAG = /* glsl */`
#include <packing>
${COMMON}
uniform sampler2D tDepth;
uniform sampler2D tAux;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uDepthThresh;
uniform float uNormalThresh;
varying vec2 vUv;

float invZ(vec2 uv) { return -1.0 / perspectiveDepthToViewZ(texture(tDepth, uv).x, uNear, uFar); }
vec3 nrm(vec2 uv) { return texture(tAux, uv).xyz * 2.0 - 1.0; }

void main() {
  float z[9];
  vec3 n[9];
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 uv = vUv + vec2(float(i - 1), float(j - 1)) * uTexel;
      z[j * 3 + i] = invZ(uv);
      n[j * 3 + i] = nrm(uv);
    }
  }
  // Silhouettes: 1/z is linear across any plane in screen space, so its laplacian is ~0
  // on surfaces and spikes at depth breaks. Divide by 1/z to make it scale free.
  float c = z[4];
  float lap = abs(z[0] + z[1] + z[2] + z[3] + z[5] + z[6] + z[7] + z[8] - 8.0 * c) / max(c, 1e-6);
  float gxz = (z[2] + 2.0 * z[5] + z[8]) - (z[0] + 2.0 * z[3] + z[6]);
  float gyz = (z[6] + 2.0 * z[7] + z[8]) - (z[0] + 2.0 * z[1] + z[2]);

  // Creases: Sobel on each normal channel, combined in a structure tensor.
  vec3 gxn = (n[2] + 2.0 * n[5] + n[8]) - (n[0] + 2.0 * n[3] + n[6]);
  vec3 gyn = (n[6] + 2.0 * n[7] + n[8]) - (n[0] + 2.0 * n[1] + n[2]);
  float jxx = dot(gxn, gxn), jyy = dot(gyn, gyn), jxy = dot(gxn, gyn);
  float nMag = 0.25 * sqrt(max(0.0, 0.5 * (jxx + jyy + sqrt((jxx - jyy) * (jxx - jyy) + 4.0 * jxy * jxy))));

  float eD = smoothstep(uDepthThresh, uDepthThresh * 1.6, lap);
  float eN = smoothstep(uNormalThresh, uNormalThresh * 1.3, nMag);
  float theta = eD >= eN ? atan(gyz, gxz + 1e-9) : 0.5 * atan(2.0 * jxy, jxx - jyy + 1e-9);
  // r: edge strength, g: gradient orientation (mod PI, 0..1), b/a: debug
  gl_FragColor = vec4(max(eD, eN), fract(theta / PI_ + 1.0), eD, eN);
}
`;

const CELL_FRAG = /* glsl */`
#include <packing>
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform sampler2D tEdge;
uniform sampler2D tDepth;
uniform vec2 uSceneSize;
uniform vec2 uCellScene;
uniform float uExposure;
uniform float uGamma;
uniform float uBlack;
uniform float uWhite;
uniform float uSaturation;
uniform float uPosterize;
uniform float uDither;
uniform float uEdges;
uniform float uEdgeCoverage;
uniform float uEdgeGain;
uniform vec3 uEdgeTint;
uniform float uEdgeTintMix;
uniform float uRampLen[MAX_SETS];
uniform float uOrient[MAX_SETS];
uniform float uOrientMin;
uniform float uOrientRot;
uniform float uEdgeRow;
uniform float uParticleRow;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform float uCellAspect;
uniform float uWeather;
uniform float uWDensity;
uniform float uWSpeed;
uniform float uWWind;
uniform float uWSway;
uniform float uWBright;
uniform vec3 uWColor;
uniform vec3 uWDepth;
uniform vec2 uCursor;
uniform float uWRepel;
uniform float uWRepelR;
uniform sampler2D tParticles;
uniform float uParticlesOn;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 origin = cell * uCellScene;
  vec2 S = clamp(floor(uCellScene), vec2(2.0), vec2(12.0));
  vec2 stp = uCellScene / S;

  // 1. Gather: average colour + vote edge orientations over the cell.
  vec3 col = vec3(0.0);
  vec4 bins = vec4(0.0);
  for (int j = 0; j < 12; j++) {
    if (float(j) >= S.y) break;
    for (int i = 0; i < 12; i++) {
      if (float(i) >= S.x) break;
      vec2 uv = (origin + (vec2(float(i), float(j)) + 0.5) * stp) / uSceneSize;
      col += texture(tColor, uv).rgb;
      vec4 e = texture(tEdge, uv);
      if (e.r > 0.5) {
        // line orientation = gradient + 90deg; buckets: 0 -, 1 /, 2 |, 3 backslash
        float b = floor(fract(e.g + 0.625) * 4.0);
        bins += vec4(equal(vec4(b), vec4(0.0, 1.0, 2.0, 3.0)));
      }
    }
  }
  float total = S.x * S.y;
  col /= total;

  vec2 cuv = (origin + 0.5 * uCellScene) / uSceneSize;
  vec4 aux = texture(tAux, cuv);
  float depth = texture(tDepth, cuv).x;
  float set = floor(aux.a * 32.0 + 0.5); // background clears to the sky set
  int si = int(clamp(set, 0.0, float(MAX_SETS - 1)));

  // 2. Tone: exposure -> filmic -> sRGB -> saturation / posterize.
  vec3 c = toSRGB(acesFilm(col * uExposure));
  float l = dot(c, LUMA);
  c = clamp(mix(vec3(l), c, uSaturation), 0.0, 1.0);
  if (uPosterize >= 2.0) c = floor(c * (uPosterize - 1.0) + 0.5) / (uPosterize - 1.0);

  // 3. Glyph by brightness inside this set's ramp (Bayer-dithered between steps).
  float t = pow(clamp((l - uBlack) / max(uWhite - uBlack, 1e-3), 0.0, 1.0), uGamma);
  float len = uRampLen[si];
  float idx = clamp(floor(t * len + (bayer4(cell) - 0.5) * uDither), 0.0, len - 1.0);
  float row = float(si);
  float colI = idx;

  // 4. Orientation sets (grass etc.): strokes follow the way the surface leans on screen.
  if (uOrient[si] > 0.5 && idx >= 2.0) {
    vec3 n = aux.xyz * 2.0 - 1.0;
    if (length(n.xy) > uOrientMin) {
      float f = fract(atan(n.y, n.x) / PI_ + uOrientRot + 1.125);
      row = uEdgeRow;
      colI = floor(f * 4.0);
    }
  }

  // 5. Edges win when enough of the cell votes for one direction.
  float mx = max(max(bins.x, bins.y), max(bins.z, bins.w));
  if (uEdges > 0.5 && mx >= max(uEdgeCoverage * total, 1.0)) {
    row = uEdgeRow;
    colI = mx == bins.x ? 0.0 : (mx == bins.y ? 1.0 : (mx == bins.z ? 2.0 : 3.0));
    c = mix(c * uEdgeGain, uEdgeTint, uEdgeTintMix);
  }

  // 6. Weather: three layers of falling glyphs in cell space, hidden behind anything nearer than the layer.
  //    The cursor pushes flakes aside.
  if (uWeather > 0.5) {
    float sceneZ = -perspectiveDepthToViewZ(depth, uNear, uFar);
    vec2 dc = (cell - uCursor) * vec2(1.0, uCellAspect);
    float dd = length(dc);
    vec2 push = (dc / max(dd, 1e-3)) * vec2(1.0, 1.0 / uCellAspect) * uWRepel * exp(-dd * dd / max(uWRepelR * uWRepelR, 1e-3));
    for (int L = 0; L < 3; L++) {
      float fl = float(L);
      float layerZ = L == 0 ? uWDepth.x : (L == 1 ? uWDepth.y : uWDepth.z);
      if (layerZ > sceneZ) continue;
      float spd = uWSpeed * (1.0 - fl * 0.3);
      vec2 q = cell + push * (1.0 - fl * 0.35);
      q.y += uTime * spd;
      q.x += -uWWind * uTime * spd + sin(q.y * 0.23 + fl * 2.1 + uTime * 0.7) * uWSway;
      bool rain = uWeather > 1.5 && uWeather < 2.5;
      bool motes = uWeather > 2.5;
      vec2 iq = rain ? floor(vec2(q.x, q.y / 3.0)) : floor(q);
      float h = hash12(iq + fl * 37.17);
      float dens = uWDensity * (0.55 + fl * 0.45);
      if (h < dens) {
        if (rain) {
          row = uEdgeRow;
          colI = uWWind > 0.25 ? 3.0 : (uWWind < -0.25 ? 1.0 : 2.0);
        } else {
          row = uParticleRow;
          colI = clamp(4.0 - fl - floor(h / dens * 1.6), 1.0, uRampLen[int(uParticleRow)] - 1.0);
        }
        // Motes (pollen, dust, plankton) twinkle as they drift.
        float tw = motes ? 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.5 + h * 9.0) + h * 61.0)) : 1.0;
        if (motes && tw < 0.45) colI = 1.0;
        c = mix(c, uWColor, uWBright * (1.0 - fl * 0.22) * tw);
        break;
      }
    }
  }

  // 7. 3D particles that landed in this cell, unless something in the scene is in front of them.
  if (uParticlesOn > 0.5) {
    vec4 pp = texelFetch(tParticles, ivec2(cell), 0);
    // Only where the particle is brighter than what's behind it (snow on snow stays snow, not a dark speck).
    if (pp.a > 0.5 && pp.r < -perspectiveDepthToViewZ(depth, uNear, uFar) + 0.05 && pp.b > l * 1.1) {
      float plen = uRampLen[int(uParticleRow)];
      row = uParticleRow;
      colI = clamp(floor(pp.g * (plen - 1.0) + 0.5), 1.0, plen - 1.0);
      c = mix(c, uWColor, clamp(pp.b, 0.0, 1.0));
    }
  }

  // alpha packs the cell's glyph set (for per-set fill) and the atlas glyph: set * 512 + row * 16 + col
  gl_FragColor = vec4(c, float(si) * 512.0 + row * 16.0 + colI);
}
`;

const COMPOSE_FRAG = /* glsl */`
uniform sampler2D tCells;
uniform sampler2D tAtlas;
uniform vec2 uCellPx;
uniform float uAtlasRows;
uniform vec3 uBg;
uniform float uCellFill;
uniform float uGlyphGain;
uniform float uLift;
uniform float uSetFill[MAX_SETS];

void main() {
  vec2 cf = gl_FragCoord.xy / uCellPx;
  vec2 cell = floor(cf);
  vec2 local = clamp(cf - cell, 0.015, 0.985);
  vec4 d = texelFetch(tCells, ivec2(cell), 0);
  float set = floor(d.a / 512.0 + 0.0001);
  float code = d.a - set * 512.0;
  float row = floor(code / 16.0 + 0.001);
  float col = code - row * 16.0;
  float fill = uSetFill[int(clamp(set, 0.0, float(MAX_SETS - 1)))];
  vec2 auv = vec2((col + local.x) / 16.0, 1.0 - (row + 1.0 - local.y) / uAtlasRows);
  // Gradients from the continuous screen position, so mips don't seam at cell borders.
  float cov = textureGrad(tAtlas, auv, vec2(1.0 / (uCellPx.x * 16.0), 0.0), vec2(0.0, 1.0 / (uCellPx.y * uAtlasRows))).r;
  vec3 c = d.rgb;
  float m = max(c.r, max(c.g, c.b));
  vec3 g = m > 1e-4 ? c * (mix(m, 1.0, uLift) / m) : c;
  vec3 o = uBg + c * uCellFill * fill;
  gl_FragColor = vec4(mix(o, g * uGlyphGain, cov), 1.0);
}
`;

const DOWN_FRAG = /* glsl */`
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uOffset;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * uOffset;
  vec3 c = 0.25 * (texture(tInput, vUv - o).rgb + texture(tInput, vUv + o).rgb
                 + texture(tInput, vUv + vec2(o.x, -o.y)).rgb + texture(tInput, vUv + vec2(-o.x, o.y)).rgb);
  if (uThreshold >= 0.0) c *= smoothstep(uThreshold, uThreshold + 0.25, max(c.r, max(c.g, c.b)));
  gl_FragColor = vec4(c, 1.0);
}
`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tInput;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture(tInput, vUv).rgb * 0.2270270270;
  c += texture(tInput, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tInput, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tInput, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(tInput, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const FINAL_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tSharp;
uniform sampler2D tSoft;
uniform sampler2D tGlow;
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform sampler2D tEdge;
uniform int uView;
uniform vec2 uRes;
uniform float uSplit;
uniform float uExposure;
uniform float uTilt;
uniform float uTiltCenter;
uniform float uTiltWidth;
uniform float uTiltFeather;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uGrainPx;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main() {
  vec3 ascii = texture(tSharp, vUv).rgb;
  if (uTilt > 0.0) {
    float d = abs(vUv.y - uTiltCenter) - uTiltWidth * 0.5;
    ascii = mix(ascii, texture(tSoft, vUv).rgb, smoothstep(0.0, max(uTiltFeather, 1e-3), d) * uTilt);
  }
  if (uBloom > 0.0) ascii += texture(tGlow, vUv).rgb * uBloom;

  vec3 c = ascii;
  if (uView == 1 || uView == 2) {
    vec3 src = toSRGB(acesFilm(texture(tColor, vUv).rgb * uExposure));
    c = (uView == 1 || vUv.x < uSplit) ? src : ascii;
    if (uView == 2 && abs(gl_FragCoord.x - uSplit * uRes.x) < 1.0) c = vec3(0.69, 0.55, 1.0);
  } else if (uView == 3) {
    c = texture(tAux, vUv).rgb;
  } else if (uView == 4) {
    vec4 e = texture(tEdge, vUv);
    c = e.r * hue(fract(e.g + 0.5));
  } else if (uView == 5) {
    vec4 a = texture(tAux, vUv);
    c = hue(floor(a.a * 32.0 + 0.5) / 24.0) * (0.35 + 0.65 * a.z);
  }

  vec2 q = vUv - 0.5;
  c *= mix(1.0, smoothstep(1.15, 0.35, length(q) * 1.4142), uVignette);
  // grain specks are uGrainPx pixels wide (1 on screen), so renders at a higher pixel ratio keep the same grain
  c += (hash(floor(gl_FragCoord.xy / uGrainPx) + fract(uTime * 7.31) * 97.0) - 0.5) * uGrain;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}
`;

// ==== engine/atlas.js ====
// Glyph atlas: one row per glyph set, plus a last row for the 4 edge glyphs.
// Each row holds up to 16 characters, darkest (index 0) to densest.

async function buildAtlas({ rows, cols = 16, font, weight, aspect, scale = 1, cellH = 96 }) {
  const spec = (px) => `${weight} ${px}px "${font}", ui-monospace, Menlo, monospace`;
  try { await document.fonts.load(spec(64), rows.join('')); } catch (e) { /* fall back silently */ }

  const gh = cellH;
  const gw = Math.max(8, Math.round(cellH / aspect));
  const canvas = document.createElement('canvas');
  canvas.width = gw * cols;
  canvas.height = gh * rows.length;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Size the font so one advance fills the cell width (glyphs like - = _ join up into bars).
  ctx.font = spec(100);
  const adv = ctx.measureText('M').width / 100;
  const size = Math.min(gw / adv, gh * 0.95) * scale;
  ctx.font = spec(size);
  const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.7;

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  rows.forEach((str, r) => {
    Array.from(str).slice(0, cols).forEach((ch, i) => {
      if (ch === ' ') return;
      ctx.fillText(ch, i * gw + gw / 2, r * gh + gh / 2 + cap / 2);
    });
  });
  return canvas;
}

// ==== engine/ascii-engine.js ====
const MAX_SETS = 24;
const SET_DIV = 32; // set id is stored in the aux alpha as id / SET_DIV
const ATLAS_COLS = 16;
const EDGE_ROW = MAX_SETS;
const SKY_SET = 9;
const PARTICLE_SET = 15;

// Tag any object or material with userData.glyph = '<set name>' to pick its characters.
// Children inherit from parents; a material tag beats an object tag.
const DEFAULT_SETS = [
  { name: 'default', ramp: ' .:-=+*#%@', orient: false },
  { name: 'grass', ramp: ' .,:;i!|', orient: true },
  { name: 'water', ramp: ' .-~=≈#', orient: false },
  { name: 'foliage', ramp: ' .:o*O0@', orient: false },
  { name: 'stone', ramp: ' .:sS$#', orient: false },
  { name: 'wood', ramp: ' .-=#%', orient: false },
  { name: 'glow', ramp: ' .+*#@', orient: false },
  { name: 'sand', ramp: ' .:;+*', orient: false },
  { name: 'soft', ramp: ' .:-~o', orient: false },
  { name: 'sky', ramp: ' .·:+*', orient: false },
  { name: 'snow', ramp: ' .·:;+*#', orient: false },
  { name: 'ice', ramp: ' .-=≡#', orient: false },
  { name: 'fire', ramp: ' .,^*&#@', orient: false },
  { name: 'smoke', ramp: ' .:~-=', orient: false },
  { name: 'aurora', ramp: ' .:¦|║', orient: false },
  { name: 'particles', ramp: ' .·+*', orient: false },
  { name: 'wheat', ramp: ' .,:;|', orient: true },
  { name: 'cloud', ramp: ' .:-=+*', orient: false },
  { name: 'birds', ramp: 'vvVV', orient: false },
  { name: 'metal', ramp: ' .:+=#', orient: false },
  { name: 'neon', ramp: ' .:+*#@', orient: false },
  { name: 'brick', ramp: ' .:=#▓', orient: false },
  { name: 'dust', ramp: ' .,:;', orient: false },
  { name: 'spare', ramp: ' .:+', orient: false },
];

const VIEWS = { ASCII: 0, Source: 1, Split: 2, Normals: 3, Edges: 4, 'Glyph sets': 5 };

function defaultParams() {
  return {
    cellSize: 8, cellAspect: 1.7, detail: 1, font: 'IBM Plex Mono', fontWeight: 600, glyphScale: 1,
    exposure: 1.35, gamma: 1, black: 0.03, white: 0.85, saturation: 1.15, lift: 0.35, posterize: 0, dither: 0.6,
    edges: true, depthThresh: 0.08, normalThresh: 0.8, edgeCoverage: 0.16, edgeGain: 1.3,
    edgeGlyphs: '-/|\\', edgeTint: '#b08cff', edgeTintMix: 0,
    orientMin: 0.3, orientRot: 0,
    bg: '#07080c', cellFill: 0.16, glyphGain: 1.25,
    bloom: 0.5, bloomThreshold: 0.5, bloomRadius: 1.5,
    tilt: 0.8, tiltCenter: 0.45, tiltWidth: 0.35, tiltFeather: 0.3, tiltBlurX: 2.5, tiltBlurY: 1,
    vignette: 0.35, grain: 0.035,
    weather: 'none', wDensity: 0.06, wSpeed: 4, wWind: 0.3, wSway: 0.6, wBright: 0.85, wColor: '#e6efff',
    wRepel: 6, wRepelR: 7,
    view: 'ASCII', split: 0.5,
    sets: DEFAULT_SETS.map((s) => ({ fill: 1, ...s })),
  };
}

const hexToVec3 = (hex, v) => {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  return v.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

class AsciiEngine {
  constructor(renderer, params) {
    this.renderer = renderer;
    this.p = params;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const rt = (o = {}) => new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...o,
    });
    const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.rtColor = rt({ depthBuffer: true });
    this.rtColor.depthTexture = new THREE.DepthTexture(1, 1);
    this.rtAux = rt({ depthBuffer: true, ...nearest });
    this.rtEdge = rt(nearest);
    this.rtCells = rt({ ...nearest, type: THREE.FloatType }); // float: alpha packs set + glyph exactly
    // 3D particles (snow, embers...) drawn straight into the character grid: one point = one cell, nearest wins.
    this.rtParticles = rt({ ...nearest, depthBuffer: true });
    this.rtCompose = rt();
    this.rtBase = rt(); // exports only: the characters drawn at screen resolution, for tilt-shift and glow
    this.rtHalf = [rt(), rt()];
    this.rtQuarter = [rt(), rt()];

    const V2 = () => ({ value: new THREE.Vector2() });
    const V3 = () => ({ value: new THREE.Vector3() });
    const F = (v = 0) => ({ value: v });
    const mk = (frag, uniforms, defines = {}) => new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false,
    });

    this.mEdge = mk(EDGE_FRAG, {
      tDepth: F(this.rtColor.depthTexture), tAux: F(this.rtAux.texture), uTexel: V2(),
      uNear: F(0.1), uFar: F(100), uDepthThresh: F(), uNormalThresh: F(),
    });
    this.mCell = mk(CELL_FRAG, {
      tColor: F(this.rtColor.texture), tAux: F(this.rtAux.texture), tEdge: F(this.rtEdge.texture),
      tDepth: F(this.rtColor.depthTexture), uSceneSize: V2(), uCellScene: V2(),
      uExposure: F(), uGamma: F(), uBlack: F(), uWhite: F(), uSaturation: F(), uPosterize: F(), uDither: F(),
      uEdges: F(), uEdgeCoverage: F(), uEdgeGain: F(), uEdgeTint: V3(), uEdgeTintMix: F(),
      uRampLen: { value: new Array(MAX_SETS).fill(1) }, uOrient: { value: new Array(MAX_SETS).fill(0) },
      uOrientMin: F(), uOrientRot: F(), uEdgeRow: F(EDGE_ROW), uParticleRow: F(PARTICLE_SET),
      uNear: F(0.1), uFar: F(100), uTime: F(), uCellAspect: F(1.7),
      uWeather: F(), uWDensity: F(), uWSpeed: F(), uWWind: F(), uWSway: F(), uWBright: F(), uWColor: V3(),
      uWDepth: V3(), uCursor: V2(), uWRepel: F(), uWRepelR: F(),
      tParticles: F(this.rtParticles.texture), uParticlesOn: F(0),
    }, { MAX_SETS });
    this.mCompose = mk(COMPOSE_FRAG, {
      tCells: F(this.rtCells.texture), tAtlas: F(null), uCellPx: V2(), uAtlasRows: F(MAX_SETS + 1),
      uBg: V3(), uCellFill: F(), uGlyphGain: F(), uLift: F(), uSetFill: { value: new Array(MAX_SETS).fill(1) },
    }, { MAX_SETS });
    this.mDown = mk(DOWN_FRAG, { tInput: F(null), uTexel: V2(), uOffset: F(), uThreshold: F(-1) });
    this.mBlur = mk(BLUR_FRAG, { tInput: F(null), uDir: V2() });
    this.mFinal = mk(FINAL_FRAG, {
      tSharp: F(this.rtCompose.texture), tSoft: F(this.rtHalf[0].texture), tGlow: F(this.rtQuarter[0].texture),
      tColor: F(this.rtColor.texture), tAux: F(this.rtAux.texture), tEdge: F(this.rtEdge.texture),
      uView: { value: 0 }, uRes: V2(), uSplit: F(), uExposure: F(),
      uTilt: F(), uTiltCenter: F(), uTiltWidth: F(), uTiltFeather: F(), uBloom: F(),
      uVignette: F(), uGrain: F(), uGrainPx: { value: 1 }, uTime: F(),
    });

    this.auxCache = new Map();
    this.cursor = new THREE.Vector2(-1e4, -1e4); // CSS px, set by the app
    this.windBoost = 0;                          // runtime gusts added to the weather wind
    this.focusDistance = 20;                     // camera to target, used to place snow layers in depth
    this.override = {};                          // temporary param overrides (e.g. recording: { cellSize, grain })
    // Whole number k when an export draws the screen's pixels k times over (1 on screen). Glow and tilt-shift
    // are then worked out from a screen-resolution copy of the characters, and grain specks are k pixels,
    // so the export looks like the screen, just with k×k pixels per screen pixel.
    this.exportScale = 1;
    this._hooks = [];
    this._swapped = [];
    this._hidden = [];
    this._auxClear = new THREE.Color().setRGB(0.5, 0.5, 1.0, THREE.LinearSRGBColorSpace);
    this._cc = new THREE.Color();
    this._black = new THREE.Color(0, 0, 0);
    this._v2 = new THREE.Vector2();
    this._layoutKey = '';
    this._atlasToken = 0;
    this.size = { W: 1, H: 1, cols: 1, rows: 1, sw: 1, sh: 1, cw: 1, ch: 1 };
  }

  get setIndex() {
    const m = {};
    this.p.sets.forEach((s, i) => { m[s.name] = i; });
    return m;
  }

  // Rebuild the glyph atlas (font, aspect, ramps, edge glyphs). Async because of font loading.
  async rebuildAtlas() {
    const token = ++this._atlasToken;
    const p = this.p;
    const rows = [];
    for (let i = 0; i < MAX_SETS; i++) rows.push(p.sets[i]?.ramp || ' ');
    rows.push(p.edgeGlyphs || '-/|\\');
    const canvas = await buildAtlas({
      rows, cols: ATLAS_COLS, font: p.font, weight: p.fontWeight, aspect: p.cellAspect, scale: p.glyphScale,
    });
    if (token !== this._atlasToken) return;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    this.atlasTex?.dispose();
    this.atlasTex = tex;
    this.mCompose.uniforms.tAtlas.value = tex;
    this.atlasCanvas = canvas;
    const u = this.mCell.uniforms;
    for (let i = 0; i < MAX_SETS; i++) {
      u.uRampLen.value[i] = Math.max(1, Math.min(ATLAS_COLS, Array.from(p.sets[i]?.ramp || ' ').length));
      u.uOrient.value[i] = p.sets[i]?.orient ? 1 : 0;
    }
  }

  _layout() {
    const r = this.renderer, p = this.p;
    r.getDrawingBufferSize(this._v2);
    const W = this._v2.x, H = this._v2.y;
    const dpr = r.getPixelRatio();
    // Whole-pixel cells: every glyph renders identically, which looks crisper and compresses far better.
    const cellCss = this.override.cellSize ?? p.cellSize;
    const aspect = this.override.cellAspect ?? p.cellAspect;
    const cw = Math.max(2, Math.round(cellCss * dpr)), ch = Math.max(3, Math.round(cellCss * aspect * dpr));
    const cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
    const sw = Math.max(16, Math.round((W / dpr) * p.detail));
    const sh = Math.max(16, Math.round((H / dpr) * p.detail));
    const k = Math.max(1, Math.round(this.exportScale));
    const Wb = Math.floor(W / k), Hb = Math.floor(H / k); // screen-resolution size of the frame
    const key = `${W}x${H}|${cols}x${rows}|${sw}x${sh}|${k}`;
    if (key !== this._layoutKey) {
      this._layoutKey = key;
      for (const t of [this.rtColor, this.rtAux, this.rtEdge]) t.setSize(sw, sh);
      this.rtCells.setSize(cols, rows);
      this.rtParticles.setSize(cols, rows);
      this.rtCompose.setSize(W, H);
      this.rtBase.setSize(k > 1 ? Wb : 1, k > 1 ? Hb : 1);
      for (const t of this.rtHalf) t.setSize(Math.ceil(Wb / 2), Math.ceil(Hb / 2));
      for (const t of this.rtQuarter) t.setSize(Math.ceil(Wb / 4), Math.ceil(Hb / 4));
    }
    Object.assign(this.size, { W, H, cols, rows, sw, sh, cw, ch, cellCss: cw / dpr, k, Wb, Hb });
    // Map the camera's full view onto exactly the cells that cover the screen.
    this.rtParticles.viewport.set(0, 0, Math.round(W / cw), Math.round(H / ch));
  }

  _resolveSet(g) {
    if (g == null) return 0;
    if (typeof g === 'number') return Math.max(0, Math.min(MAX_SETS - 1, g | 0));
    return this.setIndex[g] ?? 0;
  }

  _auxMat(src, inherited) {
    const set = this._resolveSet(src.userData?.glyph ?? inherited);
    const side = src.side ?? THREE.FrontSide;
    const flat = !!src.flatShading;
    // A material can carry userData.auxPatch(shader) so the aux pass gets the same vertex animation
    // (wind, waves...) and, if it wants, its own normals for the orientation glyphs.
    const patch = src.userData?.auxPatch;
    const patchKey = patch ? (src.userData.auxPatchKey || src.uuid) : '';
    const key = `${set}|${side}|${flat}|${patchKey}`;
    let m = this.auxCache.get(key);
    if (!m) {
      m = new THREE.MeshNormalMaterial({ side, flatShading: flat });
      m.blending = THREE.NoBlending;
      const uSet = { value: set };
      m.onBeforeCompile = (sh) => {
        if (patch) patch(sh);
        sh.uniforms.uGlyphSet = uSet;
        sh.fragmentShader = 'uniform float uGlyphSet;\n' + sh.fragmentShader.replace(
          // paw-fx: three 0.185's MeshNormalMaterial no longer includes <packing>, so
          // packNormalToRGB( normal ) is written out as its own body.
          /}\s*$/, `  gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, uGlyphSet / ${SET_DIV}.0 );\n}`);
      };
      m.customProgramCacheKey = () => `ascii-aux|${patchKey}`;
      this.auxCache.set(key, m);
    }
    return m;
  }

  _swapIn(scene) {
    const sw = this._swapped, hd = this._hidden, hk = this._hooks;
    sw.length = 0; hd.length = 0; hk.length = 0;
    const walk = (o, inh) => {
      if (!o.visible) return;
      if (o.userData.aux === false && !o.isScene) { o.visible = false; hd.push(o); return; }
      const g = o.userData.glyph ?? inh;
      if (o.isMesh) {
        const m = o.material;
        const single = !Array.isArray(m);
        // Faint transparent stuff (light beams, halos) stays out unless it is tagged with a glyph set.
        const tagged = o.userData.glyph !== undefined || (single && m.userData.glyph !== undefined);
        const ghost = (single && m.colorWrite === false)
          || (!tagged && single && m.transparent && (m.blending === THREE.AdditiveBlending || m.opacity < 0.35));
        if (ghost) { o.visible = false; hd.push(o); return; }
        // Mirrors render the whole scene again in onBeforeRender; not needed for the aux pass.
        if (o.isReflector || o.isRefractor || o.isWater) { hk.push(o, o.onBeforeRender); o.onBeforeRender = () => {}; }
        sw.push(o, m);
        o.material = Array.isArray(m) ? m.map((x) => this._auxMat(x, g)) : this._auxMat(m, g);
      } else if (o.isPoints || o.isLine || o.isSprite) {
        o.visible = false; hd.push(o); return;
      }
      for (const c of o.children) walk(c, g);
    };
    walk(scene, undefined);
  }

  _swapOut() {
    const sw = this._swapped;
    for (let i = 0; i < sw.length; i += 2) sw[i].material = sw[i + 1];
    for (const o of this._hidden) o.visible = true;
    const hk = this._hooks;
    for (let i = 0; i < hk.length; i += 2) hk[i].onBeforeRender = hk[i + 1];
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.quadCam);
  }

  _blur(pair, rx, ry, iters) {
    const [a, b] = pair;
    const u = this.mBlur.uniforms;
    for (let i = 0; i < iters; i++) {
      u.tInput.value = a.texture; u.uDir.value.set(rx / a.width, 0); this._pass(this.mBlur, b);
      u.tInput.value = b.texture; u.uDir.value.set(0, ry / a.height); this._pass(this.mBlur, a);
    }
  }

  render(scene, camera, time = 0) {
    const r = this.renderer, p = this.p;
    if (!this.atlasTex) return;
    this._layout();
    const s = this.size;

    // Objects listed in scene.userData.cellParticles only draw in the particle pass.
    const parts = (scene.userData.cellParticles || []).filter((o) => o.userData.enabled !== false);
    for (const o of parts) o.visible = false;

    // 1. Scene colour + depth.
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.rtColor);
    r.render(scene, camera);

    // 2. Normals + glyph set id.
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    r.getClearColor(this._cc);
    const ca = r.getClearAlpha();
    r.setClearColor(this._auxClear, SKY_SET / SET_DIV);
    this._swapIn(scene);
    r.setRenderTarget(this.rtAux);
    r.render(scene, camera);
    this._swapOut();
    scene.background = bg; scene.fog = fog;

    // 2b. Particles into the cell grid (R = view depth, G = glyph level 0..1, B = brightness).
    this.mCell.uniforms.uParticlesOn.value = parts.length ? 1 : 0;
    if (parts.length) {
      r.setRenderTarget(this.rtParticles);
      r.setClearColor(this._black, 0);
      r.clear();
      const ac = r.autoClear;
      r.autoClear = false;
      for (const o of parts) { o.visible = true; r.render(o, camera); }
      r.autoClear = ac;
    }
    r.setClearColor(this._cc, ca);

    // 3. Edges.
    const e = this.mEdge.uniforms;
    e.uTexel.value.set(1 / s.sw, 1 / s.sh);
    e.uNear.value = camera.near; e.uFar.value = camera.far;
    e.uDepthThresh.value = p.depthThresh; e.uNormalThresh.value = p.normalThresh;
    this._pass(this.mEdge, this.rtEdge);

    // 4. Cells.
    const c = this.mCell.uniforms;
    c.uSceneSize.value.set(s.sw, s.sh);
    c.uCellScene.value.set((s.cw * s.sw) / s.W, (s.ch * s.sh) / s.H);
    c.uExposure.value = p.exposure; c.uGamma.value = p.gamma; c.uBlack.value = p.black; c.uWhite.value = p.white;
    c.uSaturation.value = p.saturation; c.uPosterize.value = p.posterize; c.uDither.value = p.dither;
    c.uEdges.value = p.edges ? 1 : 0; c.uEdgeCoverage.value = p.edgeCoverage; c.uEdgeGain.value = p.edgeGain;
    hexToVec3(p.edgeTint, c.uEdgeTint.value); c.uEdgeTintMix.value = p.edgeTintMix;
    c.uOrientMin.value = p.orientMin; c.uOrientRot.value = p.orientRot;
    c.uNear.value = camera.near; c.uFar.value = camera.far; c.uTime.value = time; c.uCellAspect.value = this.override.cellAspect ?? p.cellAspect;
    c.uWeather.value = { snow: 1, rain: 2, motes: 3 }[p.weather] ?? 0;
    c.uWDensity.value = p.wDensity; c.uWSpeed.value = p.wSpeed; c.uWWind.value = p.wWind + this.windBoost;
    c.uWSway.value = p.wSway; c.uWBright.value = p.wBright; hexToVec3(p.wColor, c.uWColor.value);
    c.uWDepth.value.set(0.35, 0.8, 1.4).multiplyScalar(this.focusDistance);
    const dpr = r.getPixelRatio();
    c.uCursor.value.set((this.cursor.x * dpr) / s.cw, (s.H - this.cursor.y * dpr) / s.ch);
    c.uWRepel.value = p.wRepel; c.uWRepelR.value = p.wRepelR;
    this._pass(this.mCell, this.rtCells);

    // 5. Glyphs.
    const k = this.mCompose.uniforms;
    k.uCellPx.value.set(s.cw, s.ch);
    hexToVec3(p.bg, k.uBg.value);
    k.uCellFill.value = p.cellFill; k.uGlyphGain.value = p.glyphGain; k.uLift.value = p.lift;
    for (let i = 0; i < MAX_SETS; i++) k.uSetFill.value[i] = p.sets[i]?.fill ?? 1;
    let src = this.rtCompose, srcW = s.W, srcH = s.H;
    if (s.k > 1 && (p.tilt > 0 || p.bloom > 0)) {
      // Export drawn k times over: also draw the characters exactly as the screen does (screen-size cells,
      // screen resolution). Tilt-shift and glow are worked out from that, so they match the screen exactly.
      k.uCellPx.value.set(s.cw / s.k, s.ch / s.k);
      this._pass(this.mCompose, this.rtBase);
      k.uCellPx.value.set(s.cw, s.ch);
      src = this.rtBase; srcW = s.Wb; srcH = s.Hb;
    }
    this._pass(this.mCompose, this.rtCompose);

    // 6. Tilt-shift (half res) and bloom (quarter res), always at screen resolution.
    const d = this.mDown.uniforms;
    if (p.tilt > 0) {
      d.tInput.value = src.texture; d.uTexel.value.set(1 / srcW, 1 / srcH);
      d.uOffset.value = 0; d.uThreshold.value = -1;
      this._pass(this.mDown, this.rtHalf[0]);
      this._blur(this.rtHalf, p.tiltBlurX, p.tiltBlurY, 2);
    }
    if (p.bloom > 0) {
      d.tInput.value = src.texture; d.uTexel.value.set(1 / srcW, 1 / srcH);
      d.uOffset.value = 1; d.uThreshold.value = p.bloomThreshold;
      this._pass(this.mDown, this.rtQuarter[0]);
      this._blur(this.rtQuarter, p.bloomRadius, p.bloomRadius, 2);
    }

    // 7. Final.
    const f = this.mFinal.uniforms;
    f.uView.value = VIEWS[p.view] ?? 0;
    f.uRes.value.set(s.W, s.H); f.uSplit.value = p.split; f.uExposure.value = p.exposure;
    f.uTilt.value = p.tilt; f.uTiltCenter.value = p.tiltCenter; f.uTiltWidth.value = p.tiltWidth;
    f.uTiltFeather.value = p.tiltFeather; f.uBloom.value = p.bloom;
    f.uVignette.value = p.vignette; f.uGrain.value = this.override.grain ?? p.grain; f.uTime.value = time;
    f.uGrainPx.value = Math.max(1, this.exportScale);
    this._pass(this.mFinal, null);
  }
}

// ==== scenes/kit.js ====
// Small helpers shared by scenes.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeNoise(seed = 1) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rnd() * 2 - 1;
  const h = (x, y) => vals[p[(p[x & 255] + y) & 255]];
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  return { noise, fbm };
}

// Standard low-poly material with an optional glyph set tag.
function std(color, glyph, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  if (glyph) m.userData.glyph = glyph;
  return m;
}

function addLights(scene, { sun = '#ffe1b8', sunI = 2.6, sky = '#a9c8ff', ground = '#4b3d2c', hemiI = 0.9, pos = [8, 11, 5], extent = 11 } = {}) {
  const hemi = new THREE.HemisphereLight(sky, ground, hemiI);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(sun, sunI);
  dir.position.set(...pos);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const c = dir.shadow.camera;
  c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1; c.far = 50;
  dir.shadow.bias = -0.0004;
  dir.shadow.normalBias = 0.03;
  scene.add(dir, dir.target);
  return { hemi, dir };
}

function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

// ==== scenes/island.js ====
// Low-poly island diorama: terrain, water, trees, rocks, lighthouse with sweeping beams,
// cottage, dock, a sailboat and drifting clouds.

const C = (hex) => new THREE.Color(hex);
const wave = (x, z, t) =>
  0.055 * Math.sin(x * 0.85 + t * 1.1) + 0.045 * Math.sin(z * 1.2 - t * 0.9 + x * 0.35) + 0.025 * Math.sin((x + z) * 2.3 + t * 1.9);

const Island = {
  name: 'Island',
  frame: { target: [0, 0.5, 0], radius: 4.6, elevation: 30, azimuth: 40, fov: 28 },
  look: {},

  create() {
    const scene = new THREE.Scene();
    scene.background = C('#1a2433');
    scene.fog = new THREE.Fog('#1f2c40', 26, 56);
    addLights(scene);

    const N = makeNoise(11);
    const rnd = mulberry32(7);
    const height = (x, z) => {
      const warp = N.fbm(x * 0.22 + 4.1, z * 0.22 - 2.3, 3) * 1.6;
      const r = Math.hypot(x, z * 1.15) + warp;
      const land = smooth(6.0, 2.0, r);
      let h = land * (0.9 + N.fbm(x * 0.32, z * 0.32, 4) * 0.9);
      h += land * land * Math.max(0, N.fbm(x * 0.45 + 7.7, z * 0.45 + 1.3, 3)) * 2.6;
      return h - 0.55 - (1 - land) * 1.2;
    };
    const slope = (x, z) =>
      Math.abs(height(x + 0.25, z) - height(x - 0.25, z)) + Math.abs(height(x, z + 0.25) - height(x, z - 0.25));

    scene.add(buildTerrain(height, N));
    const water = buildWater(height);
    scene.add(water.mesh);

    // Lighthouse on the high ground at the back of the island.
    let best = null;
    for (let a = 0; a < 64; a++) {
      const ang = Math.PI * (0.85 + (a / 64) * 0.8);
      for (let r = 2.2; r < 5; r += 0.2) {
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r, h = height(x, z);
        const score = h * 0.6 + r * 0.4 - slope(x, z) * 4;
        if (h > 0.6 && (!best || score > best.score)) best = { x, z, h, score, ang };
      }
    }
    const lh = buildLighthouse();
    lh.group.position.set(best.x, best.h - 0.08, best.z);
    scene.add(lh.group);

    // Cottage beside it, towards the middle.
    const hx = best.x - Math.cos(best.ang) * 0.85, hz = best.z - Math.sin(best.ang) * 0.85;
    const house = buildHouse();
    house.position.set(hx, height(hx, hz) - 0.06, hz);
    house.rotation.y = -best.ang + 0.4;
    scene.add(house);

    // Dock on the near shore.
    const dAng = -0.3;
    const dir = new THREE.Vector3(Math.cos(dAng), 0, Math.sin(dAng));
    let shore = 1;
    while (shore < 8 && height(dir.x * shore, dir.z * shore) > 0.1) shore += 0.05;
    const dock = buildDock();
    dock.position.set(dir.x * shore, 0, dir.z * shore);
    dock.rotation.y = -dAng;
    scene.add(dock);

    const avoid = [[best.x, best.z, 0.9], [hx, hz, 0.8], [dir.x * shore, dir.z * shore, 0.7]];
    scene.add(buildTrees(height, slope, rnd, avoid));
    scene.add(buildRocks(height, slope, rnd, avoid));

    const boat = buildBoat();
    scene.add(boat);
    const clouds = buildClouds(rnd);
    clouds.forEach((c) => scene.add(c.group));

    return {
      scene,
      update(t, dt) {
        water.update(t);
        lh.spin.rotation.y = t * 0.9;
        const a = t * 0.07 + 1.2, R = 7.2;
        const bx = Math.cos(a) * R, bz = Math.sin(a) * R;
        boat.position.set(bx, wave(bx, bz, t) + 0.02, bz);
        boat.rotation.set(Math.sin(t * 1.3) * 0.05, -(a + Math.PI / 2), Math.sin(t * 1.7 + 1) * 0.04);
        for (const c of clouds) {
          c.ang += c.speed * dt;
          c.group.position.set(Math.cos(c.ang) * c.r, c.y, Math.sin(c.ang) * c.r);
        }
      },
    };
  },
};

function buildTerrain(height, N) {
  const SIZE = 15, SEG = 120;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setY(i, height(pa.getX(i), pa.getZ(i)));
  const P = g.toNonIndexed().attributes.position.array;

  const out = [[], [], []], cols = [[], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  const sand = C('#d8bd84'), grassA = C('#64a347'), grassB = C('#386a33'), rockA = C('#8b857a'), rockB = C('#5c5852');
  for (let i = 0; i < P.length; i += 9) {
    a.fromArray(P, i); b.fromArray(P, i + 3); c.fromArray(P, i + 6);
    if (Math.max(a.y, b.y, c.y) < -0.5) continue;
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const cy = (a.y + b.y + c.y) / 3;
    const v = N.noise((a.x + b.x + c.x) * 0.6, (a.z + b.z + c.z) * 0.6) * 0.5 + 0.5;
    let k;
    if (cy < 0.2 + v * 0.12) { k = 0; col.copy(sand).offsetHSL(0, 0, (v - 0.5) * 0.08); }
    else if (Math.abs(n.y) < 0.78 || cy > 2.4) { k = 2; col.lerpColors(rockA, rockB, v); }
    else { k = 1; col.lerpColors(grassA, grassB, v * 0.8 + Math.min(1, cy / 3) * 0.2); }
    for (let j = 0; j < 9; j++) out[k].push(P[i + j]);
    for (let j = 0; j < 3; j++) cols[k].push(col.r, col.g, col.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([].concat(...out), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute([].concat(...cols), 3));
  let start = 0;
  out.forEach((arr, k) => { const cnt = arr.length / 3; geo.addGroup(start, cnt, k); start += cnt; });
  geo.computeVertexNormals();
  const mat = (glyph) => std('#ffffff', glyph, { vertexColors: true, roughness: 0.95 });
  return shadows(new THREE.Mesh(geo, [mat('sand'), mat('grass'), mat('stone')]));
}

function buildWater(height) {
  const SIZE = 90, SEG = 150;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position;
  const base = Float32Array.from(pa.array);
  const colors = new Float32Array(pa.count * 3);
  const deep = C('#154a70'), mid = C('#1f7f99'), shallow = C('#53c4c8'), foam = C('#eef6f2'), col = new THREE.Color();
  for (let i = 0; i < pa.count; i++) {
    const h = height(base[i * 3], base[i * 3 + 2]);
    col.lerpColors(deep, mid, smooth(-1.75, -1.0, h));
    col.lerp(shallow, smooth(-0.9, -0.25, h));
    col.lerp(foam, smooth(-0.22, -0.02, h) * 0.85);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(g, std('#ffffff', 'water', { vertexColors: true, roughness: 0.3, metalness: 0.05 }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(t) {
      const arr = pa.array;
      for (let i = 0; i < pa.count; i++) arr[i * 3 + 1] = wave(base[i * 3], base[i * 3 + 2], t);
      pa.needsUpdate = true;
    },
  };
}

function buildLighthouse() {
  const group = new THREE.Group();
  const white = std('#ece6d8'), red = std('#c4432f'), dark = std('#2b2e36', 'stone'), roof = std('#8f2f24');
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 8), std('#8a847a', 'stone'));
  plinth.position.y = 0.05;
  group.add(plinth);
  let y = 0.2;
  const bands = 6, H = 1.5;
  for (let i = 0; i < bands; i++) {
    const r0 = 0.3 - i * 0.022, r1 = 0.3 - (i + 1) * 0.022;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, H / bands, 12), i % 2 ? red : white);
    seg.position.y = y + H / bands / 2;
    y += H / bands;
    group.add(seg);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14), dark);
  gallery.position.y = y + 0.025; y += 0.05;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 10),
    std('#fff3c4', 'glow', { emissive: '#ffcf6a', emissiveIntensity: 3 }));
  lantern.position.y = y + 0.12;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.24, 10), roof);
  cap.position.y = y + 0.36;
  group.add(gallery, lantern, cap);

  const spin = new THREE.Group();
  spin.position.y = y + 0.12;
  const beamG = new THREE.ConeGeometry(0.5, 5, 20, 1, true);
  beamG.rotateZ(Math.PI / 2);
  beamG.translate(2.5, 0, 0);
  const beamM = new THREE.MeshBasicMaterial({
    color: '#ffe7ad', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  for (const r of [0, Math.PI]) {
    const tilt = new THREE.Group();
    tilt.rotation.y = r;
    const beam = new THREE.Mesh(beamG, beamM);
    beam.rotation.z = -0.1;
    beam.userData.aux = false;
    tilt.add(beam);
    spin.add(tilt);
  }
  group.add(spin);
  shadows(group);
  spin.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return { group, spin };
}

function buildHouse() {
  const g = new THREE.Group();
  g.userData.glyph = 'wood';
  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.44), std('#e7dcc6', 'default'));
  walls.position.y = 0.18;
  const roofG = new THREE.CylinderGeometry(0.34, 0.34, 0.72, 3, 1, false, Math.PI / 2);
  roofG.rotateZ(Math.PI / 2);
  const roof = new THREE.Mesh(roofG, std('#3d4c63'));
  roof.position.y = 0.36 + 0.17;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), std('#7a4a3a', 'stone'));
  chimney.position.set(0.18, 0.62, 0.08);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.02), std('#5a3b28'));
  door.position.set(0, 0.09, 0.225);
  g.add(walls, roof, chimney, door);
  return shadows(g);
}

function buildDock() {
  const g = new THREE.Group();
  g.userData.glyph = 'wood';
  const plank = new THREE.BoxGeometry(0.18, 0.05, 0.38);
  const pm = std('#8b6a48');
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(plank, pm);
    p.position.set(-0.3 + i * 0.21, 0.22, 0);
    p.rotation.y = (i % 3 - 1) * 0.02;
    g.add(p);
  }
  const post = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5);
  const postM = std('#5b4330');
  for (const x of [-0.2, 0.7, 1.6]) for (const z of [-0.17, 0.17]) {
    const p = new THREE.Mesh(post, postM);
    p.position.set(x, -0.2, z);
    g.add(p);
  }
  return shadows(g);
}

function buildTrees(height, slope, rnd, avoid) {
  const pts = [];
  for (let tries = 0; tries < 1200 && pts.length < 48; tries++) {
    const x = (rnd() * 2 - 1) * 5.5, z = (rnd() * 2 - 1) * 5.5, h = height(x, z);
    if (h < 0.4 || h > 2.4 || slope(x, z) > 0.5) continue;
    if (avoid.some((a) => Math.hypot(a[0] - x, a[1] - z) < a[2])) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.42)) continue;
    pts.push({ x, z, y: h - 0.04, s: 0.75 + rnd() * 0.6, pine: rnd() < 0.6, c: rnd(), yaw: rnd() * 6.28 });
  }
  const trunkG = new THREE.CylinderGeometry(0.035, 0.055, 0.34, 5).translate(0, 0.17, 0);
  const pineG = mergeGeometries([
    new THREE.ConeGeometry(0.27, 0.62, 6).translate(0, 0.55, 0),
    new THREE.ConeGeometry(0.2, 0.48, 6).translate(0, 0.86, 0),
  ]);
  const roundG = new THREE.IcosahedronGeometry(0.3, 0).translate(0, 0.56, 0);
  const pines = pts.filter((p) => p.pine), rounds = pts.filter((p) => !p.pine);
  const trunks = new THREE.InstancedMesh(trunkG, std('#6b4a30', 'wood'), pts.length);
  const pineM = new THREE.InstancedMesh(pineG, std('#ffffff', 'foliage'), pines.length);
  const roundM = new THREE.InstancedMesh(roundG, std('#ffffff', 'foliage'), rounds.length);
  const pinePal = ['#2f6a3c', '#3c7a41', '#285738'].map(C);
  const roundPal = ['#5b9a45', '#7aa84a', '#d08a2e', '#e0b23e', '#6f9d3f'].map(C);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const place = (p) => { q.setFromEuler(e.set(0, p.yaw, 0)); s.setScalar(p.s); return m.compose(v.set(p.x, p.y, p.z), q, s); };
  pts.forEach((p, i) => trunks.setMatrixAt(i, place(p)));
  pines.forEach((p, i) => { pineM.setMatrixAt(i, place(p)); pineM.setColorAt(i, pinePal[Math.floor(p.c * pinePal.length)]); });
  rounds.forEach((p, i) => { roundM.setMatrixAt(i, place(p)); roundM.setColorAt(i, roundPal[Math.floor(p.c * roundPal.length)]); });
  const g = new THREE.Group();
  g.add(trunks, pineM, roundM);
  return shadows(g);
}

function buildRocks(height, slope, rnd, avoid) {
  const pts = [];
  for (let tries = 0; tries < 2000 && pts.length < 34; tries++) {
    const x = (rnd() * 2 - 1) * 6.5, z = (rnd() * 2 - 1) * 6.5, h = height(x, z);
    const shore = h > -0.4 && h < 0.25;
    const cliff = h > 0.5 && slope(x, z) > 0.6 && rnd() < 0.3;
    if (!shore && !cliff) continue;
    if (avoid.some((a) => Math.hypot(a[0] - x, a[1] - z) < a[2])) continue;
    pts.push({ x, y: Math.max(h, -0.15), z });
  }
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.22, 0), std('#ffffff', 'stone'), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const col = new THREE.Color();
  pts.forEach((p, i) => {
    q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
    s.set(0.6 + rnd(), 0.5 + rnd() * 0.5, 0.6 + rnd() * 0.9);
    rocks.setMatrixAt(i, m.compose(v.set(p.x, p.y, p.z), q, s));
    rocks.setColorAt(i, col.setHSL(0.09, 0.06, 0.38 + rnd() * 0.18));
  });
  return shadows(rocks);
}

function buildBoat() {
  const g = new THREE.Group();
  g.userData.glyph = 'wood';
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 0.24), std('#7a3826'));
  hull.position.y = 0.04;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.55, 1), std('#7a3826'));
  bow.position.set(0.4, 0.04, 0);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.16), std('#e9e2d0', 'default'));
  cabin.position.set(-0.12, 0.16, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), std('#3b2a1e'));
  mast.position.set(0.08, 0.45, 0);
  const sailG = new THREE.BufferGeometry();
  sailG.setAttribute('position', new THREE.Float32BufferAttribute([0.09, 0.15, 0, 0.09, 0.78, 0, 0.42, 0.17, 0], 3));
  sailG.computeVertexNormals();
  const sail = new THREE.Mesh(sailG, std('#f2efe6', 'default', { side: THREE.DoubleSide }));
  g.add(hull, bow, cabin, mast, sail);
  return shadows(g);
}

// Shadow-only clouds: invisible to the camera (no colour/depth write, skipped in the aux pass)
// but they still cast soft moving shadows across the island.
function buildClouds(rnd) {
  const mat = std('#f4f1ea', 'soft', { roughness: 1, colorWrite: false, depthWrite: false });
  const list = [];
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group();
    group.userData.aux = false;
    group.scale.setScalar(1.0);
    const puffs = 4 + Math.floor(rnd() * 3);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + rnd() * 0.35, 1), mat);
      p.position.set((rnd() * 2 - 1) * 0.8, (rnd() * 2 - 1) * 0.12, (rnd() * 2 - 1) * 0.35);
      p.scale.y = 0.65;
      p.castShadow = true;
      p.userData.aux = false;
      group.add(p);
    }
    list.push({ group, r: 1 + rnd() * 5, ang: (i / 4) * 6.28 + rnd(), y: 6 + rnd(), speed: 0.03 + rnd() * 0.03 });
  }
  return list;
}

// ---- paw-fx: mergeGeometries stand-in -----------------------------------
// island.js imports mergeGeometries from three/addons/utils/BufferGeometryUtils.js
// (three.js, MIT). The vendored three build ships no addons, and that addon
// carries its own bare 'three' import, so this is the smallest stand-in for
// the one call island.js makes: two indexed cones whose attributes are
// concatenated after de-indexing.
function mergeGeometries(geometries) {
  const parts = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(parts[0].attributes)) {
    const arrays = parts.map((g) => g.attributes[name].array);
    const merged = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let at = 0;
    for (const a of arrays) { merged.set(a, at); at += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(merged, parts[0].attributes[name].itemSize));
  }
  return out;
}

// ---- app.js, cut down to the section ------------------------------------
// The renderer setup, frameCamera(), resize() and the step/draw loop follow
// app.js. Its lil-gui panel, scene switcher, exports, localStorage, keyboard
// shortcuts and OrbitControls are not carried; the auto camera that
// OrbitControls.autoRotate gave the Island scene is reproduced directly.

const DEFAULTS = { cellSize: 8, rotateSpeed: 0.6 };

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === 'undefined') return resting;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return resting;

  const o = Object.assign({}, DEFAULTS, opts);
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-ascii-island__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer = null, engine = null, world = null, raf = 0, dead = false, onScreen = true;
  const undo = [];

  function teardown() {
    dead = true;
    cancelAnimationFrame(raf); raf = 0;
    undo.forEach((f) => f());
    undo.length = 0;
    if (world) disposeScene(world.scene);
    if (engine) {
      for (const v of Object.values(engine)) {
        if (v?.isWebGLRenderTarget || v?.isMaterial) v.dispose();
        if (Array.isArray(v)) v.forEach((x) => x?.isWebGLRenderTarget && x.dispose());
      }
      engine.quad.geometry.dispose();
      engine.atlasTex?.dispose();
    }
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    canvas.remove();
    el.removeAttribute('data-fx-live');
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  } catch (err) {
    return resting;
  }

  try {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;

    const camera = new THREE.PerspectiveCamera(28, 1, 0.3, 150);
    const target = new THREE.Vector3();
    const params = defaultParams();
    params.cellSize = o.cellSize;
    engine = new AsciiEngine(renderer, params);
    // Island's look is {}, so app.js's applyLook() leaves every look key at defaultParams().
    world = Island.create({ params, engine, renderer, camera });
    el.prepend(canvas);

    const effectiveFrame = (frame) => (camera.aspect < 1 && frame.portrait ? { ...frame, ...frame.portrait } : frame);
    function frameCamera(frame, resetAngles) {
      const f = effectiveFrame(frame);
      camera.fov = f.fov ?? 28;
      camera.updateProjectionMatrix();
      camera.far = f.far ?? 150;
      camera.updateProjectionMatrix();
      const vf = THREE.MathUtils.degToRad(camera.fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const dist = f.radius / Math.tan((f.fit === 'height' ? vf : Math.min(vf, hf)) / 2);
      const dir = resetAngles
        ? new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - f.elevation), THREE.MathUtils.degToRad(f.azimuth))
        : camera.position.clone().sub(target).normalize();
      target.fromArray(f.target);
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
    }

    let framed = false;
    function resize() {
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      const wasPortrait = camera.aspect < 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameCamera(Island.frame, !framed || wasPortrait !== camera.aspect < 1);
      framed = true;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    undo.push(() => ro.disconnect());

    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => { onScreen = entries[entries.length - 1].isIntersecting; });
      io.observe(el);
      undo.push(() => io.disconnect());
    }
    const lost = (e) => { e.preventDefault(); teardown(); };
    canvas.addEventListener('webglcontextlost', lost);
    undo.push(() => canvas.removeEventListener('webglcontextlost', lost));

    const Y = new THREE.Vector3(0, 1, 0);
    const offset = new THREE.Vector3();
    let t = 0, last = performance.now();
    function step(dt) {
      t += dt;
      // OrbitControls.autoRotate: (2 * PI / 60 * autoRotateSpeed) * deltaTime per update, about the target.
      offset.subVectors(camera.position, target).applyAxisAngle(Y, -((2 * Math.PI) / 60) * o.rotateSpeed * dt);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      engine.focusDistance = camera.position.distanceTo(target);
      world.update?.(t, dt);
    }
    function tick() {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!onScreen) return;
      step(dt);
      engine.render(world.scene, camera, t);
      if (!el.hasAttribute('data-fx-live')) el.setAttribute('data-fx-live', '');
    }
    engine.rebuildAtlas().then(() => { if (!dead) { last = performance.now(); tick(); } }, () => teardown());

    return {
      update(next = {}) {
        Object.assign(o, next);
        if (next.cellSize != null) params.cellSize = o.cellSize;
      },
      destroy() { if (!dead) teardown(); },
    };
  } catch (err) {
    teardown();
    return resting;
  }
}

export const meta = {
  name: "ascii-island",
  version: "1.0.0",
  category: "3d-hero",
  needs: ["three"],
  license: "MIT",
  options: {
    cellSize: { type: "number", default: 8, min: 3, max: 32, description: "Character cell width in CSS pixels; the height is cellSize * 1.7. Smaller cells draw more detail with more, finer glyphs. Upstream's cell size slider (3 to 32)." },
    rotateSpeed: { type: "number", default: 0.6, min: -3, max: 3, description: "How fast the camera circles the island, in OrbitControls autoRotateSpeed units (2 = one turn a minute at 60 fps). Negative turns the other way, 0 holds the framed shot. Upstream's camera speed slider." },
  },
};
