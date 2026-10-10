// Meduse by Ronan Camus — MIT License
// https://github.com/RonanCamus/meduse
//
// MIT License
// Copyright (c) 2026 Ronan Camus
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
// meduse: a port of RonanCamus/meduse at commit
// 9c0c1c8f782943fceadd846e3c1fc827b892bcbd (meduse.js, index.html). A school of
// jellyfish in raw WebGL2: one bell mesh that beats and fourteen strands that
// follow, drawn additively on black. Upstream's script is kept in order; the
// seams are the section box for the stage (canvas inserted into the section,
// ResizeObserver for the window resize), pointer events on the section in
// section coordinates, the school size as an option instead of keys 1 to 9,
// and an off-screen pause plus a teardown. Every seam is in meta.json.deviations.

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof document === 'undefined' || typeof matchMedia !== 'function') return resting;
  const o = Object.assign({}, opts);
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-meduse__gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  if (!gl) return resting;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lin = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const TINTS = ['#7fe3ff', '#8c1aff', '#6bdbc5', '#ee1548', '#e8d6b3', '#ffdb01', '#ef6c12', '#9fb4c8', '#c9d6df'].map(lin);

  const HEAD = '#version 300 es\nprecision highp float;\n';
  const TOOLS = `
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-.055, step(.0031308,c)); }
`;
  const SHADERS = {
    bell: {
      vs: `${HEAD}
layout(location=0) in vec2 aP;       // 0 at the apex, 1 at the rim; angle around the axis
uniform mat4 uVP;
uniform vec4 uBody;      // x, y, z, radius
uniform vec4 uLife;      // phase, beat rate, presence, glow
uniform vec3 uVel;
uniform float uTime;
out vec3 vWorld; out vec3 vN; out float vU; out float vTh;
vec3 lean(vec3 v){       // the bell leans into its motion
  float a = clamp(uVel.x * .5, -.5, .5), b = clamp(-uVel.z * .35, -.5, .5);
  v = vec3(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a), v.z);
  return vec3(v.x, v.y * cos(b) - v.z * sin(b), v.y * sin(b) + v.z * cos(b));
}
void main(){
  float u = aP.x, th = aP.y;
  float beat = uTime * uLife.y + uLife.x;
  float c = sin(beat - u * 2.4);                       // the contraction travels from the apex to the rim
  float phi = u * 1.8;
  float R = uBody.w * uLife.z;
  vec3 l = vec3(R * sin(phi) * (1. + .2 * c * u) * cos(th), R * .85 * cos(phi) * (1. - .08 * c), R * sin(phi) * (1. + .2 * c * u) * sin(th));
  l.y += R * .05 * sin(th * 8. + beat * 1.5) * smoothstep(.75, 1., u);      // the rim ripples
  vWorld = uBody.xyz + lean(l);
  vN = lean(normalize(vec3(sin(phi) * cos(th), cos(phi) * 1.2, sin(phi) * sin(th))));
  vU = u; vTh = th;
  gl_Position = uVP * vec4(vWorld, 1.);
}`,
      fs: `${HEAD}${TOOLS}
in vec3 vWorld; in vec3 vN; in float vU; in float vTh;
out vec4 o;
uniform vec3 uTint;
uniform vec4 uLife;
uniform float uTime;
void main(){
  float dist = length(vWorld);
  float fr = pow(1. - abs(dot(normalize(vN), -vWorld / dist)), 2.2);
  float ribs = pow(abs(sin(vTh * 8.)), 14.) * smoothstep(.1, .9, vU);
  float rim = smoothstep(.86, 1., vU);
  vec3 irid = mix(uTint, uTint.gbr * .8 + vec3(.1, .18, .4), fr * .6);       // iridescence: the hue turns on the edge
  vec3 c = irid * (.07 + fr * 1.05 + ribs * .32 + rim * .7) + vec3(1.) * pow(1. - vU, 6.) * .22;
  c *= .5 + .25 * sin(uTime * uLife.y + uLife.x - vU * 2.4);                 // it brightens as it contracts
  o = vec4(srgb(max(c, 0.) * (1. + uLife.w * 1.6) * uLife.z * smoothstep(.4, 2.4, dist)), 1.);      // fades out when the eye gets too close
}`,
      uniforms: ['uVP', 'uBody', 'uLife', 'uVel', 'uTime', 'uTint'],
    },
    tentacle: {
      vs: `${HEAD}
layout(location=0) in vec4 aP;       // attach angle, position along the strand, side, length
layout(location=1) in vec2 aQ;       // attach radius, thickness in pixels
uniform mat4 uVP;
uniform vec4 uBody, uLife;
uniform vec3 uVel;
uniform vec2 uRes;
uniform float uTime;
out float vV; out float vK; out float vSide;
void main(){
  float beat = uTime * uLife.y + uLife.x, v = aP.y;
  float R = uBody.w * uLife.z;
  float c = sin(beat - 2.4 * aQ.x);
  float rad = R * sin(1.8 * aQ.x) * (1. + .2 * c * aQ.x);
  vec3 a = vec3(rad * cos(aP.x), R * .85 * cos(1.8 * aQ.x) * (1. - .08 * c), rad * sin(aP.x));
  float w = beat * .9 - v * 5. + aP.x * 3.;
  vec3 out1 = vec3(cos(aP.x), 0., sin(aP.x)), tan1 = vec3(-sin(aP.x), 0., cos(aP.x));
  vec3 sway = (out1 * sin(w) * .22 + tan1 * cos(w * .8) * .16) * R * v * (1. + v);
  float L = R * (2.0 + aP.w * 2.6) * (1. - .12 * sin(beat - 1.));
  vec3 p = uBody.xyz + a + vec3(0., -L * v, 0.) + sway - uVel * v * v * 1.6;   // the trail lags behind
  vec4 cl = uVP * vec4(p, 1.);
  cl.x += aP.z * aQ.y * mix(1., .3, v) / uRes.x * 2. * cl.w;
  gl_Position = cl;
  vV = v; vSide = aP.z;
  vK = uLife.z * smoothstep(.4, 2.4, length(p));
}`,
      fs: `${HEAD}${TOOLS}
in float vV; in float vK; in float vSide;
out vec4 o;
uniform vec3 uTint;
uniform vec4 uLife;
uniform float uTime;
void main(){
  float beads = pow(.5 + .5 * sin(vV * 46. - (uTime * uLife.y + uLife.x) * 2.), 6.);      // beads run down the strand
  float body = 1. - smoothstep(.4, 1., abs(vSide));
  vec3 c = mix(uTint, vec3(1.), .2 + beads * .5) * (pow(1. - vV, 1.3) * .5 + beads * .35 * (1. - vV)) * body;
  o = vec4(srgb(c * vK * (1. + uLife.w * 1.2)), 1.);
}`,
      uniforms: ['uVP', 'uBody', 'uLife', 'uVel', 'uRes', 'uTime', 'uTint'],
    }
  };
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const PRG = {};
  try {
    for (const [name, def] of Object.entries(SHADERS)) {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, def.vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, def.fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
      const u = {}; for (const n of def.uniforms) u[n] = gl.getUniformLocation(p, n);
      PRG[name] = { p, u };
    }
  } catch (err) {
    return resting;   // a refused program leaves the CSS rest in place
  }
  const vao = (data, layout, index) => {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const stride = layout.reduce((a, b) => a + b, 0) * 4; let off = 0;
    layout.forEach((n, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off); off += n * 4; });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return v;
  };
  // One bell mesh and one set of strands, shared by every jellyfish: only the uniforms change
  const BR = 28, BS = 72, bv = [], bi = [];
  for (let i = 0; i <= BR; i++) for (let j = 0; j <= BS; j++) bv.push(i / BR, (j / BS) * Math.PI * 2);
  for (let i = 0; i < BR; i++) for (let j = 0; j < BS; j++) { const a = i * (BS + 1) + j, b = a + 1, c = a + BS + 1, d = c + 1; bi.push(a, c, b, b, c, d); }
  const TM = 26, tv = [], ti = [];
  const draw01 = (k) => { const x = Math.sin(k * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
  const strand = (angle, length, attach, thick) => {
    const base = tv.length / 6;
    for (let k = 0; k <= TM; k++) for (const side of [-1, 1]) tv.push(angle, k / TM, side, length, attach, thick);
    for (let k = 0; k < TM; k++) { const a = base + k * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  for (let k = 0; k < 10; k++) strand((k / 10) * Math.PI * 2 + 0.2, 0.35 + draw01(k) * 0.65, 1, 1.6);
  for (let k = 0; k < 4; k++) strand((k / 4) * Math.PI * 2 + 0.9, 0.15 + draw01(k + 20) * 0.3, 0.28, 3.2);
  const vaoBell = vao(bv, [2], bi), vaoStrand = vao(tv, [4, 2], ti);

  // ---------------------------------------------------------------- the school
  const FOV = 40 * Math.PI / 180;
  const VP = new Float32Array(16);
  const perspective = (aspect) => { const f = 1 / Math.tan(FOV / 2), near = 0.05, far = 80; VP.fill(0); VP[0] = f / aspect; VP[5] = f; VP[10] = (far + near) / (near - far); VP[11] = -1; VP[14] = 2 * far * near / (near - far); };
  const school = [];
  const spawn = (n) => {
    while (school.length > n) school.pop();
    while (school.length < n) {
      const k = school.length, far = k === 0 ? 10 : 11 + draw01(k * 3.1) * 14;
      school.push({ k, far, tint: TINTS[k % TINTS.length], radius: k === 0 ? 1 : 0.55 + draw01(k * 7.7) * 0.6, phase: draw01(k * 1.3) * 6.28, rate: 1.05 + draw01(k * 2.9) * 0.6,
        hx: (draw01(k * 4.4) - 0.5) * 1.4, hy: (draw01(k * 5.5) - 0.5) * 0.9, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, vz: 0, glow: 0, size: 1, startle: 0, born: k === 0 ? 1 : 0 });
    }
  };
  // Keys 1 to 9 become the count option; unset keeps upstream's pick (3 on touch, 5 otherwise)
  const schoolSize = () => (o.count == null ? (coarse ? 3 : 5) : clamp(Math.round(Number(o.count)) || 1, 1, 9));
  spawn(schoolSize());
  const state = { w: 0, h: 0, px: 0, py: 0, pointer: 0, hit: 0, hitX: 0, hitY: 0, time: 0 };
  function measure() {
    const w = el.clientWidth, h = el.clientHeight;
    if (w === state.w && h === state.h) return;     // the observer's first callback must not re-measure for nothing
    const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
    state.w = w; state.h = h;
    canvas.width = Math.round(state.w * dpr); canvas.height = Math.round(state.h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function render(t, dt) {
    const aspect = state.w / state.h, tan = Math.tan(FOV / 2);
    perspective(aspect);
    gl.clearColor(0.0196, 0.0196, 0.0196, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
    for (const j of school) {
      // Where it floats: its home, a slow drift, and a pull toward the pointer (strongest for the lead)
      const pull = (j.k === 0 ? 0.55 : 0.18) * state.pointer;
      const tx = (j.hx + 0.25 * Math.sin(t * 0.11 + j.k) + (state.px * aspect * tan - j.hx) * pull) * j.far;
      const ty = (j.hy + 0.16 * Math.sin(t * 0.17 + j.k * 2.1) + 0.045 * Math.sin(t * j.rate + j.phase - 1.2) + (state.py * tan - j.hy) * pull) * j.far;
      const k = dt > 0 ? 1 - Math.exp(-1.6 * dt) : 1;
      j.x += (tx - j.x) * k; j.y += (ty - j.y) * k;
      if (dt > 0) { const q = 1 - Math.exp(-3 * dt); j.vx += ((j.x - j.px) / dt / j.far * 10 - j.vx) * q; j.vy += ((j.y - j.py) / dt / j.far * 10 - j.vy) * q; }
      j.px = j.x; j.py = j.y;
      j.born += (1 - j.born) * (1 - Math.exp(-1.2 * dt));
      // Startled: a quick squeeze and a flash, that fades
      j.startle = Math.max(0, j.startle - dt * 1.4);
      const squeeze = Math.sin(Math.min(1, j.startle * 1.6) * Math.PI) * j.startle;
      const near = Math.hypot(state.hitX - j.x / j.far, state.hitY - j.y / j.far) < 0.12 * j.radius * (10 / j.far) * 2.2 ? 1 : 0;
      j.glow += ((near * 0.35 + squeeze * 2.2) - j.glow) * (1 - Math.exp(-8 * dt));
      j.size = 1 + 0.08 * near - 0.22 * squeeze;
      for (const [prg, v, count] of [[PRG.bell, vaoBell, bi.length], [PRG.tentacle, vaoStrand, ti.length]]) {
        gl.useProgram(prg.p); gl.bindVertexArray(v);
        gl.uniformMatrix4fv(prg.u.uVP, false, VP); gl.uniform3fv(prg.u.uTint, j.tint); gl.uniform1f(prg.u.uTime, t);
        gl.uniform4f(prg.u.uBody, j.x, j.y, -j.far, j.radius * j.size * 1.1); gl.uniform4f(prg.u.uLife, j.phase, j.rate, j.born, j.glow); gl.uniform3f(prg.u.uVel, j.vx, j.vy, j.vz);
        if (prg.u.uRes) gl.uniform2f(prg.u.uRes, canvas.width, canvas.height);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      }
    }
    gl.disable(gl.BLEND);
  }
  // The pointer, as a direction from the eye (so a jellyfish knows if it is under it, whatever its distance)
  const point = (e) => { const r = el.getBoundingClientRect(); state.px = ((e.clientX - r.left) / state.w) * 2 - 1; state.py = 1 - ((e.clientY - r.top) / state.h) * 2; state.pointer = 1; state.hitX = state.px * (state.w / state.h) * Math.tan(FOV / 2); state.hitY = state.py * Math.tan(FOV / 2); };
  const timers = new Set();
  const onDown = (e) => { point(e); for (const j of school) { const id = setTimeout(() => { timers.delete(id); j.startle = 1; }, 90 * j.k); timers.add(id); } };
  const onLeave = () => { state.pointer = 0; };
  el.addEventListener('pointermove', point);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerleave', onLeave);

  el.insertBefore(canvas, el.firstChild);
  measure();
  let dead = false, visible = true, raf = 0, live = false;
  let last = performance.now(), t0 = last;
  const step = (now) => {
    raf = 0;
    if (dead) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now; state.time = (now - t0) / 1000; render(state.time, dt);
    if (!live) { live = true; el.setAttribute('data-fx-live', ''); }
    if (!reduced && visible) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  const ro = new ResizeObserver(() => { measure(); if (reduced && live && !raf) raf = requestAnimationFrame(step); });
  const io = new IntersectionObserver((es) => {
    visible = es[es.length - 1].isIntersecting;
    if (visible && !reduced && !raf && !dead) { last = performance.now(); raf = requestAnimationFrame(step); }
  });
  ro.observe(el);
  io.observe(el);

  return {
    update(next) {
      Object.assign(o, next || {});
      if (next && 'count' in next) spawn(schoolSize());
      if (reduced && !raf && !dead) raf = requestAnimationFrame(step);
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      ro.disconnect(); io.disconnect();
      el.removeEventListener('pointermove', point);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerleave', onLeave);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      canvas.remove();
      el.removeAttribute('data-fx-live');
    },
  };
}

export const meta = {
  name: 'meduse',
  version: '1.0.0',
  category: '3d-hero',
  needs: [],
  license: 'MIT',
  options: {
    count: { type: 'number', default: 5, min: 1, max: 9, step: 1, description: "How many jellyfish in the school (upstream's keys 1 to 9). Left unset it is upstream's own pick: 5, or 3 on a touch screen. The first one is the lead: biggest, nearest, and the one that follows the pointer hardest. Changing it through update() adds or drops jellyfish from the back of the school." },
  },
};
