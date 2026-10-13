// sunset-sea, from keensense/sunset-sea — MIT License
// https://github.com/keensense/sunset-sea
//
// MIT License
//
// Copyright (c) 2026 keensense
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
// sunset-sea: a port of src/sunset.js from keensense/sunset-sea at commit
// 3a2982c19cea56959e5d10be8b0d7a7c576ac9e9. A physically based sunset over
// the sea in one WebGL fragment shader, behind a hero's copy: the sky is single
// scattering through a spherical atmosphere, the sea mirrors it with Fresnel,
// and the glitter path under the sun follows the Cox-Munk slope distribution.
//
// Everything from the VERT const to the end of the Sunset class is upstream's
// file, verbatim, apart from three lines marked "seam": the class is not
// exported, and both getContext calls pass failIfMajorPerformanceCaveat so a
// software-rendered browser keeps the CSS rest. Upstream's own ResizeObserver,
// IntersectionObserver, reduced-motion and context-loss handling all stay.
// mount() at the bottom is ours: it makes the canvas, sets data-fx-live once a
// frame is drawn, and leaves the rest alone under reduced motion or when no
// WebGL context is available. Option ranges are upstream's index.html sliders.

export const meta = {
  name: "sunset-sea",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    elevation: { type: "number", default: 2.4, min: -5, max: 25, step: 0.1, description: "Sun height above the horizon in degrees. 0-6 is a sunset, below about -4 is dusk, 10 and up is a golden afternoon." },
    clouds: { type: "number", default: 0.45, min: 0, max: 1, step: 0.01, description: "Cloud cover of the one thin layer lit from below, 0 to 1." },
    wind: { type: "number", default: 3.5, min: 0, max: 14, step: 0.1, description: "Wind speed in m/s. Sets the wave size and how wide the glitter path under the sun is." },
    turbidity: { type: "number", default: 1.25, min: 0.3, max: 4, step: 0.05, description: "Haze. 1 is clear air; 2 to 3 is hazier and redder." },
    exposure: { type: "number", default: 0.30, min: 0.1, max: 1.2, step: 0.01, description: "Overall brightness of the sky and sea." },
    horizon: { type: "number", default: 0.38, min: 0.15, max: 0.85, step: 0.01, description: "Where the horizon sits, from the bottom of the section (0) to the top (1)." },
  },
};

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uSun;        // direction to the sun
uniform vec3  uSunTrans;   // sunlight transmittance at the camera (RGB)
uniform vec3  uCloudSun;   // sunlight transmittance at cloud height (RGB)
uniform float uCamH;       // camera height above the sea [m]
uniform float uTanHalf;    // tan(half field of view) of the shorter screen side
uniform float uPitch;      // camera pitch [rad]
uniform float uPix;        // angle of one pixel [rad]
uniform float uWind;       // wind speed [m/s]
uniform float uTurb;       // aerosol (haze) multiplier
uniform float uCloud;      // cloud cover 0..1
uniform float uCoast;      // 1 = draw the coast
uniform float uCoastAz;    // azimuth of the coast [rad]
uniform float uExposure;
uniform float uSunSize;    // apparent size multiplier of the sun disc
uniform float uGlitter;    // brightness of the sun glitter

const float PI   = 3.14159265;
const float R    = 6360e3;      // planet radius [m]
const float RT   = 6420e3;      // top of the atmosphere [m]
const float HR   = 8000.0;      // Rayleigh scale height [m]
const float HM   = 1200.0;      // Mie scale height [m]
const vec3  BR   = vec3(5.8e-6, 13.5e-6, 33.1e-6);   // Rayleigh scattering [1/m]
const float BM   = 21e-6;                            // Mie scattering [1/m]
const vec3  BO   = vec3(0.650e-6, 1.881e-6, 0.085e-6);  // ozone absorption [1/m] (the reason the high sky is blue)
const float ISUN = 22.0;

float ozone(float h) { return max(0.0, 1.0 - abs(h - 25000.0) / 15000.0); }

const int NV = 12;   // samples along the view ray
const int NL = 4;    // samples along the light ray

// ---------------------------------------------------------------- noise
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    a *= 0.5;
  }
  return s;
}

// ---------------------------------------------------------------- atmosphere
float raySphereFar(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float d = b * b - c;
  return d < 0.0 ? -1.0 : -b + sqrt(d);
}

vec3 atmos(vec3 rd) {
  vec3 ro = vec3(0.0, R + uCamH, 0.0);
  float L = raySphereFar(ro, rd, RT);
  float mu = dot(rd, uSun);
  float phR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  const float g = 0.76;
  float phM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu))
            / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  float bm = BM * uTurb;
  float odR = 0.0, odM = 0.0, odO = 0.0;
  vec3 sR = vec3(0.0), sM = vec3(0.0);
  for (int i = 0; i < NV; i++) {
    // samples are packed near the camera, where almost all the scattering happens
    float f0 = float(i) / float(NV), f1 = float(i + 1) / float(NV);
    float t0 = L * f0 * f0, t1 = L * f1 * f1;
    float ds = t1 - t0;
    vec3 p = ro + rd * (0.5 * (t0 + t1));
    float h = length(p) - R;
    float dR = exp(-h / HR) * ds;
    float dM = exp(-h / HM) * ds;
    odR += dR;
    odM += dM;
    odO += ozone(h) * ds;
    // is the sun's ray to this point blocked by the planet?
    float b = dot(p, uSun);
    float c = dot(p, p) - R * R;
    if (b < 0.0 && b * b - c > 0.0) continue;
    float Ls = raySphereFar(p, uSun, RT);
    float dl = Ls / float(NL);
    float lR = 0.0, lM = 0.0, lO = 0.0;
    for (int j = 0; j < NL; j++) {
      vec3 q = p + uSun * (dl * (float(j) + 0.5));
      float hq = length(q) - R;
      lR += exp(-hq / HR) * dl;
      lM += exp(-hq / HM) * dl;
      lO += ozone(hq) * dl;
    }
    vec3 att = exp(-(BR * (odR + lR) + bm * 1.1 * (odM + lM) + BO * (odO + lO)));
    sR += dR * att;
    sM += dM * att;
  }
  return ISUN * (sR * BR * phR + sM * bm * phM);
}

// ---------------------------------------------------------------- sky
float ridgeHeight(float a, float seed, float size, float amp) {
  float env = smoothstep(size, 0.0, abs(a)) ;                 // a bump around the coast azimuth
  float n = fbm(vec2(a * 5.0 + seed, seed * 1.7));
  return env * (0.35 + 0.65 * n) * amp;
}

vec3 skyColor(vec3 rd, bool withSun) {
  vec3 col = atmos(rd);

  // the sun disc, dimmed by the air in front of it
  if (withSun) {
    float cs = dot(rd, uSun);
    if (cs > 0.9985) {
      float r = acos(clamp(cs, -1.0, 1.0)) / (0.00465 * uSunSize);
      float limb = 1.0 - 0.55 * (1.0 - sqrt(max(1.0 - r * r, 0.0)));
      float rad = 0.00465 * uSunSize;
      col += uSunTrans * limb * (ISUN / (PI * rad * rad)) * 0.0012 * smoothstep(1.0, 0.9, r);
    }
  }

  // one thin layer of cloud, lit from below by the low sun
  if (uCloud > 0.0 && rd.y > 0.004) {
    float Hc = 3500.0;
    float t = (Hc - uCamH) / rd.y;
    vec2 p = rd.xz * t + vec2(uTime * 6.0, uTime * 1.5);
    vec2 q = p * vec2(0.00020, 0.00046);
    float cov = mix(0.80, 0.38, uCloud);
    float d = fbm(q);
    float dens = smoothstep(cov, cov + 0.26, d);
    if (dens > 0.0) {
      vec2 toSun = normalize(uSun.xz + 1e-4) * vec2(0.00020, 0.00046) * 700.0;
      float d2 = smoothstep(cov, cov + 0.26, fbm(q + toSun));
      float lit = clamp(1.0 - 0.9 * max(d2 - dens * 0.5, 0.0), 0.15, 1.0);
      vec3 cloudCol = uCloudSun * (1.7 * lit) + col * 0.55;
      float fade = smoothstep(0.004, 0.10, rd.y);
      col = mix(col, cloudCol, dens * 0.88 * fade);
    }
  }

  // hazy headlands on the horizon
  if (uCoast > 0.5 && rd.y > -0.002) {
    float az = atan(rd.x, rd.z) - uCoastAz;
    az = mod(az + PI, 2.0 * PI) - PI;
    float far  = ridgeHeight(az, 3.1, 0.95, 0.050);
    float near = ridgeHeight(az, 8.7, 0.60, 0.028);
    float mFar  = 1.0 - smoothstep(far  - uPix * 1.5, far  + uPix * 1.5, rd.y);
    float mNear = 1.0 - smoothstep(near - uPix * 1.5, near + uPix * 1.5, rd.y);
    col = mix(col, mix(col * vec3(0.30, 0.27, 0.33), col, 0.62), mFar);   // far: mostly haze
    col = mix(col, mix(col * vec3(0.17, 0.15, 0.19), col, 0.34), mNear);  // near: darker
  }
  return col;
}

// ---------------------------------------------------------------- sea
// Travelling waves. Returns the slope (dh/dx, dh/dz) of the water surface.
// Waves shorter than a few pixels are faded out so the far sea stays calm instead of shimmering.
vec2 seaSlope(vec2 p, float t, float footprint) {
  vec2 slope = vec2(0.0);
  float steep = 0.006 + 0.0021 * uWind;
  for (int i = 0; i < 8; i++) {
    float a = float(i);
    float L = 46.0 * pow(0.66, a);                         // wavelengths 46 m ... 2.4 m
    float k = 2.0 * PI / L;
    float w = sqrt(9.81 * k);                              // deep-water dispersion
    float ang = (fract(sin(a * 12.9898) * 43758.5453) - 0.5) * 1.15;
    vec2 dir = vec2(sin(ang), cos(ang));                   // mostly towards the shore
    float s = steep * (0.35 + 0.65 * a / 7.0);             // short waves are steeper
    float fade = 1.0 - smoothstep(L * 0.10, L * 0.40, footprint);
    slope += dir * (s * cos(dot(dir, p) * k - w * t + a * 1.7) * fade);
  }
  return slope;
}

vec3 seaColor(vec3 rd) {
  float t = uCamH / -rd.y;
  vec2 p = rd.xz * t;
  float footprint = t * uPix / max(-rd.y, 0.004);

  vec2 sl = seaSlope(p, uTime, footprint);
  vec3 n = normalize(vec3(-sl.x, 1.0, -sl.y));
  vec3 v = -rd;
  vec3 refl = reflect(rd, n);
  refl.y = max(refl.y, 0.002);                    // a reflection never points into the water
  vec3 sky = skyColor(normalize(refl), false);

  float cosT = max(dot(n, v), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);   // Fresnel (Schlick), water n = 1.33

  // light that enters the water and comes back: dark, a little teal, and only as bright as the sky
  float amb = 0.10 + 0.90 * smoothstep(-0.08, 0.30, uSun.y);
  vec3 body = vec3(0.010, 0.040, 0.050) * amb + uSunTrans * (0.012 * max(uSun.y, 0.0));

  // sun glitter from the Cox-Munk distribution of wave slopes (the bright path under the sun)
  vec3 h = normalize(uSun + v);
  float nh = max(h.y, 1e-3);
  float s2 = 0.003 + 0.00512 * uWind;
  float t2 = (1.0 - nh * nh) / (nh * nh);
  float D = exp(-t2 / s2) / (PI * s2 * nh * nh * nh * nh);
  float vh = max(dot(v, h), 1e-3);
  float nv = max(v.y, 0.03), nl = max(uSun.y, 0.03);
  float G = min(1.0, min(2.0 * nh * nv / vh, 2.0 * nh * nl / vh));
  float Fh = 0.02 + 0.98 * pow(1.0 - vh, 5.0);
  // a shimmer on top, fading out with distance so it never aliases
  float sh = vnoise(vec2(p.x * 0.9, p.y * 0.30) + vec2(uTime * 0.20, uTime * 0.55));
  sh *= vnoise(vec2(p.x * 2.4, p.y * 0.80) - vec2(uTime * 0.35, uTime * 0.90));
  float shimmer = mix(1.0, 0.25 + 3.2 * sh * 1.6, 1.0 - smoothstep(0.4, 3.0, footprint));
  vec3 glitter = uSunTrans * ISUN * Fh * D * G / (4.0 * nv) * shimmer * 0.045 * uGlitter;

  return sky * F + body * (1.0 - F) + glitter;
}

// ---------------------------------------------------------------- tone map
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float basis = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / basis;
  vec3 rd = normalize(vec3(uv * 2.0 * uTanHalf, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  rd = vec3(rd.x, rd.y * cp + rd.z * sp, -rd.y * sp + rd.z * cp);

  vec3 col = rd.y >= 0.0 ? skyColor(rd, true) : seaColor(rd);

  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  // soft vignette, then a little noise so the slow gradients do not band
  vec2 vu = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - 0.28 * dot(vu, vu) * 2.0;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DEFAULTS = {
  /** Sun height above the horizon in degrees. Around 0–6 is a sunset; below about −4 it is dusk. */
  elevation: 2.4,
  /** Direction of the sun, degrees to the right of the view centre. */
  azimuth: 9,
  /** The sun drifts up and down by this many degrees so it "never finishes setting". 0 = still. */
  drift: 0.35,
  /** Seconds for one drift cycle. */
  driftPeriod: 480,
  /** Wind speed in m/s. Sets the size of the waves and how wide the glitter path is. */
  wind: 3.5,
  /** Haze. 1 = clear Mediterranean air, 2–3 = hazy and redder. */
  turbidity: 1.25,
  /** Cloud cover from 0 (none) to 1. */
  clouds: 0.45,
  /** Draw hazy headlands on the horizon. */
  coast: true,
  /** Where the coast is, degrees from the view centre (negative = left). */
  coastAzimuth: -38,
  /** Overall brightness. */
  exposure: 0.30,
  /** Brightness of the sun glitter on the water. */
  glitter: 1.0,
  /** Size of the sun disc relative to real life (1 = real, about 2 looks like a photograph). */
  sunSize: 2.0,
  /** Field of view in degrees across the shorter side of the canvas. */
  fov: 58,
  /** Where the horizon sits, from the bottom of the canvas (0) to the top (1). */
  horizon: 0.38,
  /** Camera height above the water in metres. */
  cameraHeight: 2.0,
  /** Animation speed multiplier. 0 freezes the sea. */
  speed: 1,
  /** Render scale. 'auto' lowers the resolution if the GPU cannot keep up. Or a number from 0.25 to 1. */
  quality: 'auto',
  /** Highest device pixel ratio to render at. */
  maxPixelRatio: 2,
  /** Draw one still frame (no animation) if the visitor asked for reduced motion. */
  respectReducedMotion: true,
  /** Start animating as soon as the object is created. */
  autoStart: true,
};

const BR = [5.8e-6, 13.5e-6, 33.1e-6];
const BM = 21e-6;
const BO = [0.650e-6, 1.881e-6, 0.085e-6];
const R_EARTH = 6360e3;
const R_TOP = 6420e3;

/**
 * Sunlight that reaches a point at `height` metres, as RGB transmittance (0..1).
 * Same atmosphere as the shader. Returns [0,0,0] when the planet itself blocks the sun.
 */
function sunTransmittance(height, elevationRad, turbidity) {
  const ox = 0, oy = R_EARTH + height;
  const dx = Math.cos(elevationRad), dy = Math.sin(elevationRad);
  const b = ox * dx + oy * dy;
  const c = ox * ox + oy * oy - R_EARTH * R_EARTH;
  if (b < 0 && b * b - c > 0) return [0, 0, 0];
  const cTop = ox * ox + oy * oy - R_TOP * R_TOP;
  const L = -b + Math.sqrt(b * b - cTop);
  const N = 48, ds = L / N;
  let odR = 0, odM = 0, odO = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) * ds;
    const px = ox + dx * t, py = oy + dy * t;
    const h = Math.sqrt(px * px + py * py) - R_EARTH;
    odR += Math.exp(-h / 8000) * ds;
    odM += Math.exp(-h / 1200) * ds;
    odO += Math.max(0, 1 - Math.abs(h - 25000) / 15000) * ds;
  }
  return BR.map((br, i) => Math.exp(-(br * odR + BM * turbidity * 1.1 * odM + BO[i] * odO)));
}

class Sunset { // seam: not exported, mount() below is the module's API
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Partial<typeof DEFAULTS>} [options]
   */
  constructor(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Sunset: first argument must be a <canvas> element');
    this.canvas = canvas;
    this.options = { ...DEFAULTS, ...options };
    this._running = false;
    this._raf = 0;
    this._clock = 0;            // seconds of animation so far
    this._last = 0;
    this._scale = 1;            // adaptive render scale
    this._frameTimes = [];
    this._cool = 0;
    this._visible = true;
    this._destroyed = false;
    this._reduced = false;
    this._onLost = (e) => { e.preventDefault(); this._stopLoop(); };
    this._onRestored = () => { this._init(); if (this._wantRunning) this.start(); };
    this._tick = this._tick.bind(this);

    canvas.addEventListener('webglcontextlost', this._onLost);
    canvas.addEventListener('webglcontextrestored', this._onRestored);

    if (typeof matchMedia === 'function') {
      this._mq = matchMedia('(prefers-reduced-motion: reduce)');
      this._onMq = () => { this._reduced = this.options.respectReducedMotion && this._mq.matches; this._reduced ? (this._stopLoop(), this.render()) : (this._wantRunning && this.start()); };
      this._reduced = this.options.respectReducedMotion && this._mq.matches;
      if (this._mq.addEventListener) this._mq.addEventListener('change', this._onMq);
    }
    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => { this.resize(); if (!this._running) this.render(); });
      this._ro.observe(canvas);
    }
    if (typeof IntersectionObserver === 'function') {
      this._io = new IntersectionObserver((entries) => {
        this._visible = entries[entries.length - 1].isIntersecting;
        if (this._visible && this._wantRunning && !this._running) this.start();
        if (!this._visible) this._stopLoop();
      });
      this._io.observe(canvas);
    }

    this._init();
    this.resize();
    this._wantRunning = false;
    if (this.options.autoStart) this.start(); else this.render();
  }

  /** True if this browser can run the effect. */
  static isSupported() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { return false; }
  }

  _init() {
    const gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true }) // seam
      || this.canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true }); // seam
    if (!gl) throw new Error('Sunset: WebGL is not available');
    this.gl = gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Sunset shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Sunset link: ' + gl.getProgramInfoLog(prog));
    this.prog = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one big triangle
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uRes', 'uTime', 'uSun', 'uSunTrans', 'uCloudSun', 'uCamH', 'uTanHalf', 'uPitch', 'uPix', 'uWind', 'uTurb',
      'uCloud', 'uCoast', 'uCoastAz', 'uExposure', 'uSunSize', 'uGlitter']) this.u[n] = gl.getUniformLocation(prog, n);
    this._w = 0; this._h = 0;
  }

  /** Change options at any time. Takes effect on the next frame. */
  setOptions(next) {
    Object.assign(this.options, next);
    if ('respectReducedMotion' in next && this._mq) this._reduced = next.respectReducedMotion && this._mq.matches;
    if ('quality' in next || 'maxPixelRatio' in next) this.resize();
    if (!this._running) this.render();
  }

  /** Re-read the canvas size. Called automatically when the canvas is resized. */
  resize() {
    const o = this.options;
    const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, o.maxPixelRatio);
    const q = o.quality === 'auto' ? this._scale : Math.min(1, Math.max(0.25, Number(o.quality) || 1));
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * q));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * q));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  /** Start (or resume) the animation. */
  start() {
    this._wantRunning = true;
    if (this._running || this._destroyed) return;
    if (this._reduced) { this.render(); return; }
    this._running = true;
    this._last = 0;
    this._raf = requestAnimationFrame(this._tick);
  }

  /** Pause the animation. The last frame stays on screen. */
  stop() { this._wantRunning = false; this._stopLoop(); }

  _stopLoop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  get running() { return this._running; }

  _tick(now) {
    if (!this._running) return;
    const dt = this._last ? Math.min((now - this._last) / 1000, 0.1) : 0;
    this._last = now;
    this._clock += dt * this.options.speed;
    this._adapt(dt * 1000);
    this.render();
    this._raf = requestAnimationFrame(this._tick);
  }

  // Lowers the render scale when frames take too long, and slowly raises it again when there is room.
  _adapt(ms) {
    if (this.options.quality !== 'auto' || ms <= 0) return;
    const ft = this._frameTimes;
    ft.push(ms);
    if (ft.length < 24) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    if (this._cool > 0) { this._cool--; return; }
    if (avg > 22 && this._scale > 0.4) { this._scale = Math.max(0.4, this._scale * 0.85); this.resize(); this._cool = 2; }
    else if (avg < 12 && this._scale < 1) { this._scale = Math.min(1, this._scale * 1.08); this.resize(); this._cool = 6; }
  }

  /** Draw one frame now. Called for you while the animation runs. */
  render() {
    if (this._destroyed || !this.gl || this.gl.isContextLost()) return;
    const gl = this.gl, o = this.options, u = this.u;
    const w = this.canvas.width, h = this.canvas.height;

    const drift = o.driftPeriod > 0 ? Math.sin((this._clock / o.driftPeriod) * 2 * Math.PI) * o.drift : 0;
    const elev = (o.elevation + drift) * Math.PI / 180;
    const az = o.azimuth * Math.PI / 180;
    const sun = [Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)];
    const trans = sunTransmittance(o.cameraHeight, elev, o.turbidity);
    const cloudTrans = sunTransmittance(3500, elev, o.turbidity);

    const tanHalf = Math.tan(o.fov * Math.PI / 360);
    const basis = Math.min(w, h);
    const horizonUv = (o.horizon - 0.5) * h / basis;       // where the horizon should sit on screen
    const pitch = Math.atan(-2 * tanHalf * horizonUv);

    gl.useProgram(this.prog);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uTime, this._clock % 3600);
    gl.uniform3fv(u.uSun, sun);
    gl.uniform3fv(u.uSunTrans, trans);
    gl.uniform3fv(u.uCloudSun, cloudTrans);
    gl.uniform1f(u.uCamH, o.cameraHeight);
    gl.uniform1f(u.uTanHalf, tanHalf);
    gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uPix, 2 * tanHalf / basis);
    gl.uniform1f(u.uWind, o.wind);
    gl.uniform1f(u.uTurb, o.turbidity);
    gl.uniform1f(u.uCloud, o.clouds);
    gl.uniform1f(u.uCoast, o.coast ? 1 : 0);
    gl.uniform1f(u.uCoastAz, o.coastAzimuth * Math.PI / 180);
    gl.uniform1f(u.uExposure, o.exposure);
    gl.uniform1f(u.uSunSize, o.sunSize);
    gl.uniform1f(u.uGlitter, o.glitter);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Stop and release everything. */
  destroy() {
    this._destroyed = true;
    this._stopLoop();
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener('change', this._onMq);
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    if (this.gl && this.prog) this.gl.deleteProgram(this.prog);
    this.gl = null;
  }
}


// ---------------------------------------------------------------- paw-fx mount
// One canvas behind the copy. Upstream sizes the drawing buffer from the
// canvas's CSS box and follows it on resize, so the canvas only needs to fill
// the section. The instance is built with autoStart off so its render() can be
// wrapped first: data-fx-live goes on the section only after a real frame.
export function mount(el, opts = {}) {
  const noop = { update() {}, destroy() {} };
  if (!el || typeof document === "undefined") return noop;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return noop;

  const cv = document.createElement("canvas");
  cv.className = "fx-sunset-sea__canvas";
  cv.setAttribute("aria-hidden", "true");
  el.insertBefore(cv, el.firstChild);

  let sunset;
  try {
    sunset = new Sunset(cv, { ...opts, autoStart: false });
  } catch {
    cv.remove();
    return noop;
  }
  const draw = sunset.render.bind(sunset);
  sunset.render = () => {
    draw();
    if (sunset.gl && !sunset.gl.isContextLost() && !el.hasAttribute("data-fx-live")) el.setAttribute("data-fx-live", "");
  };
  sunset.start();

  let stopped = false;
  return {
    update(next = {}) {
      if (!stopped) sunset.setOptions(next);
    },
    destroy() {
      if (stopped) return;
      stopped = true;
      sunset.destroy();
      cv.remove();
      el.removeAttribute("data-fx-live");
    },
  };
}
