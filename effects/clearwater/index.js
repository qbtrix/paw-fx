// clearwater -- https://github.com/Aureliengmz/clearwater
//
// MIT License
// Copyright (c) 2026 Lumaris
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
// clearwater: a port of Aureliengmz/clearwater at commit
// 4bc826134321043a25df3c2b6fed16fb7b9241e8, index.html. Photoreal shallow
// water over a pebble bed on a sunny day, looked down into from the shore.
//
// Everything is computed, nothing is a clip: a 256x256 FFT ocean spectrum
// (Tessendorf) animates the surface; its normals refract a 256x256 grid of sun
// rays onto the bed in three passes, one per wavelength, so the caustic web
// carries dispersion fringes; the water shader does Fresnel, absorption and
// scattering through the depth; and the sun's glints are convolved with a lens
// aperture's diffraction pattern by FFT every frame, so each one wears a faint
// rainbow star. A tap drops a ring into a local wave-equation ripple field; a
// drag turns the camera.
//
// Upstream lines 59-60, 64-342, 349-790 and 792-916 sit inside inicia() below
// verbatim, at upstream's own column, so a diff against the pinned file reads
// clean. Inside that block exactly six lines differ, each a seam listed in
// meta.json.deviations: the context request, the pebble texture's size and
// source, the canvas size in alloc(), the drag sensitivity, the tap's screen
// position, and the frame counter of the frozen-time path. Everything after
// "paw-fx seams" replaces upstream's error overlay, the window resize
// listener, the hint pill, the debug readout and the unconditional start.

const DEFAULTS = { yaw: 0, pitch: -0.72 };
const fin = (v, d) => (Number.isFinite(+v) ? +v : d);

export function mount(el, opts = {}) {
  var resting = { update: function () {}, destroy: function () {} };
  if (!el || typeof document === 'undefined') return resting;
  if (!el.clientWidth || !el.clientHeight) return resting;

  var o = Object.assign({}, DEFAULTS, opts);
  // Upstream's own screenshot mode, ?t=5, freezes time, stops the camera sway
  // and draws four frames. Reduced motion takes that path instead of a CSS
  // fallback, so the still a visitor gets is a real frame of the water.
  var still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Upstream reads its settings off location.search. A section must not
  // change because of its host page's URL, so the same two calls read the
  // mount options instead; every key upstream asks for that is not listed
  // here answers "absent", which is upstream's default.
  var Q = {
    has: function (k) { return k === 'yaw' || k === 'pitch' || (k === 't' && still); },
    get: function (k) { return k === 'yaw' ? fin(o.yaw, DEFAULTS.yaw) : k === 'pitch' ? fin(o.pitch, DEFAULTS.pitch) : k === 't' ? '5' : null; },
  };
  var canvas = document.createElement('canvas');
  canvas.className = 'fx-clearwater__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  function fail(msg) { throw new Error(typeof msg === 'string' ? msg : String(msg)); }

  var gl0 = null;
  try {
    return inicia();
  } catch (e) {
    var perda = gl0 && gl0.getExtension('WEBGL_lose_context');
    if (perda) perda.loseContext();
    canvas.remove();
    return resting;
  }

  function inicia() {
var raf = 0, visible = true, live = false, stillFrames = 0;
const FIXED_T = Q.has('t') ? parseFloat(Q.get('t')) : null;
const DEBUG = Q.has('debug');

const gl = canvas.getContext('webgl2', { antialias:false, alpha:false, depth:false, stencil:false, powerPreference:'high-performance', preserveDrawingBuffer: FIXED_T!==null, failIfMajorPerformanceCaveat: true });
gl0 = gl;
if (!gl) { fail("WebGL2 is not available in this browser."); throw 0; }
const extF32 = gl.getExtension('EXT_color_buffer_float');
const extF16 = gl.getExtension('EXT_color_buffer_half_float');
const extAniso = gl.getExtension('EXT_texture_filter_anisotropic');
if (!extF32 && !extF16) { fail("This GPU cannot render to floating-point textures (EXT_color_buffer_float / EXT_color_buffer_half_float missing)."); throw 0; }
const FFT_FMT = extF32 ? gl.RGBA32F : gl.RGBA16F;

/* ---------------- GL helpers ---------------- */
function sh(type, src, name){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l,i)=>`${String(i+1).padStart(3)}  ${l}`);
    const m = /ERROR: \d+:(\d+)/.exec(log); const ln = m? +m[1] : 0;
    fail(`Shader "${name}":\n${log}\n` + (ln? lines.slice(Math.max(0,ln-4), ln+2).join('\n') : ''));
    throw new Error('shader '+name);
  }
  return s;
}
function prog(vs, fs, name){
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs, name+'.vs'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs, name+'.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { fail(`Link "${name}": ${gl.getProgramInfoLog(p)}`); throw 0; }
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i=0;i<n;i++){ const info = gl.getActiveUniform(p,i); u[info.name.replace(/\[0\]$/,'')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function tex(w, h, fmt, { filter=gl.LINEAR, wrap=gl.CLAMP_TO_EDGE, mip=false, aniso=0 } = {}){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  const levels = mip ? Math.floor(Math.log2(Math.max(w,h)))+1 : 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, fmt, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (aniso && extAniso) gl.texParameterf(gl.TEXTURE_2D, extAniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(aniso, gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}
function rt(w, h, fmt, opts){
  const t = tex(w,h,fmt,opts); const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) fail('Incomplete framebuffer ('+st+') '+w+'x'+h);
  return { t, fb, w, h };
}
function bindT(unit, t){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D, t); }
function target(r){ gl.bindFramebuffer(gl.FRAMEBUFFER, r? r.fb : null); gl.viewport(0,0, r? r.w : canvas.width, r? r.h : canvas.height); }

const triVAO = gl.createVertexArray(); gl.bindVertexArray(triVAO);
{ const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); }
function fullscreen(){ gl.bindVertexArray(triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }

const VS = `#version 300 es
layout(location=0) in vec2 p; out vec2 vUv;
void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
const HEAD = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec2 vUv; out vec4 o;
`;

/* ---------------- Ocean spectrum (FFT) ---------------- */
const N = 256, LOGN = 8;
const L = 4.6;               // patch size (m)
const DEPTH = 1.6;          // mean depth (m)
const TARGET_SLOPE = 0.078;  // RMS slope

function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rnd = mulberry(7);
function gauss(){ let u=0,v=0; while(!u) u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

function buildH0(){
  const kp = 2*Math.PI/0.62, kcut = 2*Math.PI/0.045;
  const wd = [0.8, 0.6];
  const re = new Float32Array(N*N), im = new Float32Array(N*N);
  let s2 = 0;
  for (let m=0;m<N;m++) for (let n=0;n<N;n++){
    const nx = n<N/2? n : n-N, nz = m<N/2? m : m-N;
    const kx = 2*Math.PI*nx/L, kz = 2*Math.PI*nz/L, k = Math.hypot(kx,kz);
    let P = 0;
    if (k>1e-6){
      const lk = Math.log(k/kp);
      const bump = Math.exp(-0.5*(lk/0.36)**2);
      const tail = 0.035*Math.exp(-((kp/k)**2))*Math.exp(-((k/kcut)**2));
      const swell = 0.35*Math.exp(-0.5*(Math.log(k/(2*Math.PI/1.6))/0.3)**2);
      const c = (kx*wd[0]+kz*wd[1])/k;
      const spread = (0.3 + 0.7*c*c) * (c<0? 0.35 : 1);
      P = (bump + tail + swell) * spread / (k*k*k*k);
    }
    const a = Math.sqrt(P/2);
    const i = m*N+n; re[i] = gauss()*a; im[i] = gauss()*a;
    s2 += 2*k*k*(re[i]*re[i]+im[i]*im[i]);
  }
  const sc = TARGET_SLOPE/Math.sqrt(s2);
  const data = new Float32Array(N*N*4);
  for (let m=0;m<N;m++) for (let n=0;n<N;n++){
    const i=m*N+n, j=((N-m)%N)*N + ((N-n)%N);
    data[i*4]=re[i]*sc; data[i*4+1]=im[i]*sc; data[i*4+2]=re[j]*sc; data[i*4+3]=-im[j]*sc;
  }
  const t = tex(N,N,gl.RGBA32F,{filter:gl.NEAREST, wrap:gl.REPEAT});
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,N,N,gl.RGBA,gl.FLOAT,data);
  return t;
}
const h0Tex = buildH0();
const fftA = rt(N,N,FFT_FMT,{filter:gl.NEAREST, wrap:gl.REPEAT});
const fftB = rt(N,N,FFT_FMT,{filter:gl.NEAREST, wrap:gl.REPEAT});
const surfRT = rt(N,N,gl.RGBA16F,{wrap:gl.REPEAT, mip:true, aniso:8});

const pSpec = prog(VS, HEAD+`
uniform sampler2D uH0; uniform float uT, uL;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uH0, id, 0);
  vec2 n = vec2(id); n -= step(${N/2}.0, n) * ${N}.0;
  vec2 k = 6.28318530718*n/uL; float kl = length(k);
  float w = sqrt(9.81*kl + 7.4e-5*kl*kl*kl);
  // gentle dispersion quantisation keeps the loop seamless over 60 s
  float w0 = 6.28318530718/60.0; w = floor(w/w0)*w0;
  float c = cos(w*uT), sn = sin(w*uT);
  vec2 H = cmul(s.xy, vec2(c,sn)) + cmul(s.zw, vec2(c,-sn));
  vec2 C1 = H - k.x*H;                    // h + i*dh/dx
  vec2 C2 = vec2(-k.y*H.y, k.y*H.x);      // dh/dz
  o = vec4(C1, C2);
}`, 'spectrum');

const pFFT = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform int uP, uHoriz;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int j = uHoriz==1 ? id.x : id.y;
  int k = j & (uP-1);
  int i = ((j - (j & (2*uP-1))) >> 1) + k;
  bool y1 = (j & uP) != 0;
  ivec2 a = uHoriz==1 ? ivec2(i, id.y) : ivec2(id.x, i);
  ivec2 b = uHoriz==1 ? ivec2(i+${N/2}, id.y) : ivec2(id.x, i+${N/2});
  vec4 x0 = texelFetch(uSrc, a, 0), x1 = texelFetch(uSrc, b, 0);
  float ang = 3.14159265359*float(k)/float(uP);
  vec2 w = vec2(cos(ang), sin(ang));
  vec4 wx = vec4(cmul(w,x1.xy), cmul(w,x1.zw));
  o = y1 ? x0-wx : x0+wx;
}`, 'fft');

const pResolve = prog(VS, HEAD+`
uniform sampler2D uSrc;
void main(){
  vec4 s = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  vec2 sl = vec2(s.y, s.z);
  o = vec4(s.x, sl, dot(sl,sl));
}`, 'resolve');

function runFFT(t){
  gl.disable(gl.BLEND);
  target(fftA); gl.useProgram(pSpec.p); bindT(0,h0Tex); gl.uniform1i(pSpec.u.uH0,0); gl.uniform1f(pSpec.u.uT,t); gl.uniform1f(pSpec.u.uL,L); fullscreen();
  gl.useProgram(pFFT.p); gl.uniform1i(pFFT.u.uSrc,0);
  let src=fftA, dst=fftB;
  for (let horiz=1; horiz>=0; horiz--) for (let s=0;s<LOGN;s++){
    target(dst); bindT(0,src.t); gl.uniform1i(pFFT.u.uP, 1<<s); gl.uniform1i(pFFT.u.uHoriz, horiz); fullscreen();
    [src,dst]=[dst,src];
  }
  target(surfRT); gl.useProgram(pResolve.p); bindT(0,src.t); gl.uniform1i(pResolve.u.uSrc,0); fullscreen();
  gl.bindTexture(gl.TEXTURE_2D, surfRT.t); gl.generateMipmap(gl.TEXTURE_2D);
}

/* ---------------- Interactive ripples (wave equation) ---------------- */
const RN = 256, RSIZE = 7.0;   // local simulation, metres
const rip = [0,1].map(()=>rt(RN,RN,gl.RGBA16F,{wrap:gl.CLAMP_TO_EDGE}));
let ripIdx = 0, ripCenter = [0,0];
const pRipple = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uShift; uniform vec4 uDrop; // xy uv, z radius(uv), w strength
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec2 uv = vUv + uShift;
  vec4 c = texture(uSrc, uv);
  float avg = 0.25*(texture(uSrc, uv+vec2(px.x,0)).r + texture(uSrc, uv-vec2(px.x,0)).r + texture(uSrc, uv+vec2(0,px.y)).r + texture(uSrc, uv-vec2(0,px.y)).r);
  float v = c.g + (avg - c.r)*0.9;
  v *= 0.9955;
  float h = c.r + v;
  h *= 0.9985;
  if (uDrop.w != 0.0){ float d = length((vUv - uDrop.xy)); float r = uDrop.z; if (d < r){ float f = 0.5+0.5*cos(3.14159*d/r); h -= uDrop.w*f; } }
  // fade out near borders so the local field blends into open water
  vec2 e = min(vUv, 1.0-vUv); float edge = smoothstep(0.0, 0.06, min(e.x,e.y));
  h *= mix(0.9, 1.0, edge); v *= mix(0.9, 1.0, edge);
  if (uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) { h=0.; v=0.; }
  o = vec4(h, v, 0, 1);
}`, 'ripple');
const pRipN = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uTexel;  // metres per texel
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  float hx = texture(uSrc, vUv+vec2(px.x,0)).r - texture(uSrc, vUv-vec2(px.x,0)).r;
  float hz = texture(uSrc, vUv+vec2(0,px.y)).r - texture(uSrc, vUv-vec2(0,px.y)).r;
  float h = texture(uSrc,vUv).r;
  float lap = (texture(uSrc, vUv+vec2(px.x,0)).r + texture(uSrc, vUv-vec2(px.x,0)).r + texture(uSrc, vUv+vec2(0,px.y)).r + texture(uSrc, vUv-vec2(0,px.y)).r - 4.0*h)/(uTexel*uTexel);
  o = vec4(h, hx/(2.0*uTexel), hz/(2.0*uTexel), lap);
}`, 'rippleNormals');
const ripN = rt(RN,RN,gl.RGBA16F,{wrap:gl.CLAMP_TO_EDGE});
gl.bindFramebuffer(gl.FRAMEBUFFER, rip[0].fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindFramebuffer(gl.FRAMEBUFFER, rip[1].fb); gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindFramebuffer(gl.FRAMEBUFFER, ripN.fb); gl.clear(gl.COLOR_BUFFER_BIT);
const drops = [];
let ripActive = 0; // frames since last disturbance, to skip work when calm

function stepRipples(shiftUV){
  gl.disable(gl.BLEND); gl.useProgram(pRipple.p); gl.uniform1i(pRipple.u.uSrc,0);
  for (let s=0;s<1;s++){
    const src = rip[ripIdx], dst = rip[1-ripIdx];
    target(dst); bindT(0, src.t);
    gl.uniform2f(pRipple.u.uShift, s===0? shiftUV[0]:0, s===0? shiftUV[1]:0);
    const d = drops.shift();
    gl.uniform4f(pRipple.u.uDrop, d? d[0]:0, d? d[1]:0, d? d[2]:0, d? d[3]:0);
    fullscreen(); ripIdx = 1-ripIdx;
  }
  target(ripN); gl.useProgram(pRipN.p); bindT(0, rip[ripIdx].t); gl.uniform1i(pRipN.u.uSrc,0); gl.uniform1f(pRipN.u.uTexel, RSIZE/RN); fullscreen();
}

/* ---------------- Caustics ---------------- */
const G = 256, C = 1024;
const causRT = rt(C,C,gl.RGBA16F,{wrap:gl.REPEAT, mip:true, aniso:8});
const gridVAO = gl.createVertexArray(); gl.bindVertexArray(gridVAO);
{
  const v = new Float32Array((G+1)*(G+1)*2); let o=0;
  for (let j=0;j<=G;j++) for (let i=0;i<=G;i++){ v[o++]=i/G; v[o++]=j/G; }
  const idx = new Uint32Array(G*G*6); o=0;
  for (let j=0;j<G;j++) for (let i=0;i<G;i++){ const a=j*(G+1)+i, b=a+1, c=a+G+1, d=c+1; idx[o++]=a; idx[o++]=b; idx[o++]=c; idx[o++]=b; idx[o++]=d; idx[o++]=c; }
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
}
gl.bindVertexArray(null);
const pCaus = prog(`#version 300 es
precision highp float; precision highp sampler2D;
layout(location=0) in vec2 aUV;
uniform sampler2D uSurf; uniform float uL, uDepth, uIor; uniform vec3 uSun; uniform vec2 uShift;
out vec2 vSrc;
void main(){
  ivec2 off = ivec2(gl_InstanceID % 3 - 1, gl_InstanceID / 3 - 1);
  vec4 s = textureLod(uSurf, aUV, 0.0);
  vec3 n = normalize(vec3(-s.y, 1.0, -s.z));
  vec3 r = refract(-uSun, n, 1.0/uIor);
  vec3 P = vec3(aUV.x*uL, s.x, aUV.y*uL);
  vec3 F = P + r*((-uDepth - s.x)/r.y);
  vSrc = aUV*uL;
  vec2 c = (F.xz - uShift)/uL + vec2(off);
  gl_Position = vec4(c*2.0-1.0, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
in vec2 vSrc; out vec4 o; uniform float uNorm;
void main(){
  vec2 a = dFdx(vSrc), b = dFdy(vSrc);
  float area = abs(a.x*b.y - a.y*b.x);
  float I = min(area*uNorm, 40.0);
  o = vec4(I);
}`, 'caustics');

const IORS = [1.3315, 1.3335, 1.3365];
let causShift = [0,0];
function renderCaustics(sun){
  target(causRT); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(pCaus.p); bindT(0, surfRT.t); gl.uniform1i(pCaus.u.uSurf,0);
  gl.uniform1f(pCaus.u.uL, L); gl.uniform1f(pCaus.u.uDepth, DEPTH); gl.uniform3fv(pCaus.u.uSun, sun);
  gl.uniform1f(pCaus.u.uNorm, (C/L)*(C/L));
  // flat-surface refraction shift (green) keeps the pattern registered; per-channel residual = dispersion fringes
  const sy = sun[1], sinI = Math.sqrt(1-sy*sy), sinT = sinI/IORS[1], cosT = Math.sqrt(1-sinT*sinT);
  const hd = Math.hypot(sun[0],sun[2]) || 1, tanT = sinT/cosT;
  causShift = [-sun[0]/hd*DEPTH*tanT, -sun[2]/hd*DEPTH*tanT];
  gl.uniform2fv(pCaus.u.uShift, causShift);
  gl.bindVertexArray(gridVAO);
  const masks = [[1,0,0,0],[0,1,0,0],[0,0,1,0]];
  for (let c=0;c<3;c++){ gl.colorMask(...masks[c]); gl.uniform1f(pCaus.u.uIor, IORS[c]); gl.drawElementsInstanced(gl.TRIANGLES, G*G*6, gl.UNSIGNED_INT, 0, 9); }
  gl.colorMask(true,true,true,true); gl.disable(gl.BLEND);
  gl.bindTexture(gl.TEXTURE_2D, causRT.t); gl.generateMipmap(gl.TEXTURE_2D);
}

/* ---------------- Pebbles ---------------- */
const pebTex = tex(256, 256, gl.SRGB8_ALPHA8, { wrap:gl.REPEAT, mip:true, aniso:16 });
let pebReady = false;
{ const img = new Image(); img.onload = () => { gl.bindTexture(gl.TEXTURE_2D, pebTex); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,img); gl.generateMipmap(gl.TEXTURE_2D); pebReady = true; };
  img.onerror = () => fail('Could not decode the pebble texture.');
  // the texture is embedded as base64 at the very end of this file (keeps it a single self-contained file that also works from file://)
  img.src = 'data:image/jpeg;base64,' + PEBBLES; }

/* ---------------- Main water shader ---------------- */
const pMain = prog(VS, HEAD+`
uniform sampler2D uSurf, uCaus, uPeb, uRip;
uniform vec3 uCam, uR, uU, uF, uSun;
uniform float uTanF, uAspect, uL, uDepth, uTime, uRipSize;
uniform vec2 uCausShift, uRipCenter;

const float IOR = 1.3335;
const vec3 SIG_A = vec3(0.40, 0.074, 0.088);
const vec3 SIG_S = vec3(0.028, 0.052, 0.068);
const vec3 SIG_T = SIG_A + SIG_S;
const vec3 SUN = vec3(1.0, 0.90, 0.74) * 6.0;
const float PI = 3.14159265359;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }

float ridge(float a){ // periodic headland silhouette, elevation in radians (~1.5-4 deg)
  return 0.040 + 0.016*sin(a*2.0+0.7) + 0.011*sin(a*5.0+2.1) + 0.006*sin(a*11.0+0.3) + 0.003*sin(a*23.0+1.7);
}
float fbm2(vec2 p){ float v=0., a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p=p*2.03+17.1; a*=0.5; } return v; }
vec3 sky(vec3 d){
  float e = d.y;
  float mu = dot(d, uSun);
  vec3 zen = vec3(0.11, 0.27, 0.62), hor = vec3(0.66, 0.78, 0.90);
  vec3 c = mix(hor, zen, pow(clamp(e,0.,1.), 0.42));
  c += vec3(1.0, 0.86, 0.66) * (0.22*pow(max(mu,0.),6.) + 0.30*pow(max(mu,0.),64.) + 1.6*pow(max(mu,0.),2400.));
  // distant headland: pine canopy over pale limestone, softened by ~2 km of air
  float a = atan(d.z, d.x);
  float r = ridge(a) + 0.0045*(vnoise(vec2(a*260.0, 0.0))-0.5) + 0.002*(vnoise(vec2(a*900.0, 3.0))-0.5);
  float back = smoothstep(-0.3, 0.95, dot(normalize(vec2(d.x,d.z)+1e-5), normalize(vec2(uSun.x,uSun.z))));
  float u = clamp(e / max(r, 1e-3), 0.0, 1.0);
  vec2 q = vec2(a*420.0, e*420.0);
  float tex = fbm2(q);
  vec3 pine = vec3(0.045, 0.070, 0.042) * (0.6 + 0.8*tex);
  vec3 rock = vec3(0.30, 0.28, 0.23) * (0.55 + 0.7*fbm2(q*1.7+5.0));
  float cliff = smoothstep(0.42, 0.18, u + 0.25*(tex-0.5)) * smoothstep(0.35, 0.75, vnoise(vec2(a*18.0, 1.0)));
  vec3 land = mix(pine, rock, cliff);
  land *= mix(1.0, 0.45, back);                         // backlit toward the sun
  land = mix(land, hor*0.92, 0.38 + 0.25*back);          // aerial perspective
  float w = fwidth(e)*1.2 + 2e-4;
  c = mix(c, land, smoothstep(r+w, r-w, e) * step(-0.3, e));
  return c;
}

vec4 texBS(sampler2D t, vec2 uv){ // cubic B-spline filtering in 4 bilinear taps: smooth slopes -> smooth highlights
  vec2 ts = vec2(textureSize(t,0)); vec2 p = uv*ts - 0.5; vec2 f = fract(p); p = floor(p);
  vec2 f2 = f*f, f3 = f2*f;
  vec2 w0 = (-f3 + 3.0*f2 - 3.0*f + 1.0)/6.0, w1 = (3.0*f3 - 6.0*f2 + 4.0)/6.0;
  vec2 w2 = (-3.0*f3 + 3.0*f2 + 3.0*f + 1.0)/6.0, w3 = f3/6.0;
  vec2 g0 = w0+w1, g1 = w2+w3; vec2 h0 = (w1/g0 - 0.5 + p)/ts, h1 = (w3/g1 + 1.5 + p)/ts;
  return (texture(t, vec2(h0.x,h0.y))*g0.x + texture(t, vec2(h1.x,h0.y))*g1.x)*g0.y
       + (texture(t, vec2(h0.x,h1.y))*g0.x + texture(t, vec2(h1.x,h1.y))*g1.x)*g1.y;
}
float floorDepth(vec2 xz){
  // shelving bottom: shallow near the shore behind the viewer, deeper toward open water
  float shelf = 0.95 + 0.17*clamp(-xz.y + 1.5, 0.0, 14.0);
  return shelf + 0.30*(vnoise(xz*0.22)-0.5) + 0.10*(vnoise(xz*0.9+7.0)-0.5);
}
vec3 pebbles(vec2 x, float sc, out float hgt){
  vec2 uv = x / (vec2(0.78, 0.78)*sc);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  float k = vnoise(x*0.85);
  float l = k*8.0; float ia = floor(l), f = fract(l);
  vec2 oa = sin(vec2(3.0,7.0)*ia), ob = sin(vec2(3.0,7.0)*(ia+1.0));
  vec3 a = textureGrad(uPeb, uv+oa, dx, dy).rgb, b = textureGrad(uPeb, uv+ob, dx, dy).rgb;
  float s = dot(a-b, vec3(1));
  float m = smoothstep(0.2, 0.8, f - 0.1*s);
  // coarse luminance as pseudo-height (pale stone tops, dark gaps)
  vec3 ca = textureGrad(uPeb, uv+oa, dx*6.0, dy*6.0).rgb, cb = textureGrad(uPeb, uv+ob, dx*6.0, dy*6.0).rgb;
  hgt = dot(mix(ca,cb,m), vec3(0.3,0.55,0.15));
  return mix(a, b, m);
}
float fresnel(float ci, float n){
  ci = clamp(ci, 0.0, 1.0);
  float st2 = (1.0-ci*ci)/(n*n); if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0-st2);
  float rs = (ci - n*ct)/(ci + n*ct), rp = (n*ci - ct)/(n*ci + ct);
  return 0.5*(rs*rs + rp*rp);
}

void main(){
  vec2 ndc = vUv*2.0-1.0;
  vec3 rd = normalize(uF + ndc.x*uAspect*uTanF*uR + ndc.y*uTanF*uU);
  vec3 wd = rd; wd.y = min(wd.y, -0.0015); wd = normalize(wd);

  // ---- surface intersection (height field, fixed-point) ----
  float t = -uCam.y / wd.y;
  vec2 xz; vec4 A; vec4 B; vec4 R;
  const mat2 M = mat2(0.8, -0.6, 0.6, 0.8);
  const float SC = 0.41, WB = 0.10;
  float hsum = 0.0;
  for (int i=0;i<3;i++){
    xz = uCam.xz + wd.xz*t;
    A = texture(uSurf, xz/uL);
    B = texture(uSurf, (M*xz)/(uL*SC) + 0.37);
    vec2 ruv = (xz - uRipCenter)/uRipSize + 0.5;
    R = texture(uRip, ruv);
    hsum = A.x + WB*SC*B.x + R.x;
    t = (hsum - uCam.y) / wd.y;
  }
  vec3 P = uCam + wd*t;
  A = texBS(uSurf, P.xz/uL);
  B = texBS(uSurf, (M*P.xz)/(uL*SC) + 0.37);
  vec2 slope = A.yz + WB*(transpose(M)*B.yz) + R.yz;
  const mat2 M2 = mat2(0.28, 0.96, -0.96, 0.28);
  vec4 Cm = texture(uSurf, (M2*P.xz)/(uL*0.13) + 0.71);
  slope += 0.13*exp(-t*0.18)*(transpose(M2)*Cm.yz);
  float var = max(A.w - dot(A.yz,A.yz), 0.0) + WB*WB*max(B.w - dot(B.yz,B.yz), 0.0);
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  float dist = t;

  vec3 v = -wd;
  float nv = dot(n, v);
  if (nv < 0.02) { n = normalize(n + v*(0.02-nv)); nv = dot(n,v); }
  float F = fresnel(nv, IOR);

  // ---- reflection ----
  vec3 rr = reflect(wd, n); rr.y = abs(rr.y);
  vec3 refl = sky(rr) * 1.25;

  // sun glints: GGX with slope-variance widening (LEAN-style)
  float a2 = 0.00012 + 1.2*var;
  vec3 h = normalize(v + uSun);
  float nh = max(dot(n,h),0.0), nl = max(dot(n,uSun),0.0);
  float c2 = max(nh*nh, 1e-4); float tan2 = (1.0-c2)/c2;
  float D = exp(-tan2/a2)/(PI*a2*c2*c2);             // Beckmann: no long GGX tail, crisp glints
  float Vis = 0.5/(nl*sqrt(nv*nv*(1.0-a2)+a2) + nv*sqrt(nl*nl*(1.0-a2)+a2) + 1e-5);
  float Fh = fresnel(max(dot(h,v),0.0), IOR);
  vec3 spec = SUN * min(D*Vis*Fh*nl, 12000.0);

  // ---- refraction / underwater ----
  vec3 tr = refract(wd, n, 1.0/IOR);
  float fy = -floorDepth(P.xz);
  float s = (fy - P.y)/tr.y; vec3 FP = P + tr*s;
  for (int i=0;i<2;i++){ fy = -floorDepth(FP.xz); s = (fy - P.y)/tr.y; FP = P + tr*s; }
  s = max(s, 0.0);

  // bottom made of zones: fine pebbles, coarse cobbles, and sand that fills the gaps first
  float hgt, hgt2;
  vec3 pf = pebbles(FP.xz, 1.0, hgt);
  vec3 pc = pebbles(FP.xz.yx*vec2(-1.0,1.0) + 5.3, 1.7, hgt2);
  float coarse = smoothstep(0.45, 0.62, fbm2(FP.xz*0.21 + 40.0));
  vec3 alb = mix(pf, pc, coarse); hgt = mix(hgt, hgt2, coarse);
  float zone = fbm2(FP.xz*0.16 + 3.0) + 0.10*(vnoise(FP.xz*2.5)-0.5);
  float sandM = smoothstep(hgt + 0.02, hgt + 0.16, (zone - 0.46)*1.6);
  float marks = 0.5 + 0.5*sin(dot(FP.xz, vec2(0.93, 0.37))*16.0 + 3.0*vnoise(FP.xz*0.8));
  vec3 sand = vec3(0.60, 0.55, 0.44) * (0.82 + 0.22*vnoise(FP.xz*40.0) + 0.10*marks);
  sand = sand*sand*1.4; // to linear-ish, matching the texture
  alb = mix(alb, sand, sandM); hgt = mix(hgt, 0.42 + 0.05*marks, sandM);
  alb = mix(vec3(dot(alb,vec3(0.3,0.55,0.15))), alb, 0.8) * vec3(1.10, 1.0, 0.86);
  // large-scale variation: sun-bleached patches, darker weedy hollows, a hint of olive film
  float big = vnoise(FP.xz*0.45) * 0.65 + vnoise(FP.xz*1.3+3.1) * 0.35;
  float weed = smoothstep(0.55, 0.85, vnoise(FP.xz*0.32 + 11.0));
  alb *= mix(0.62, 1.22, big);
  alb = mix(alb, alb*vec3(0.55, 0.62, 0.40), weed*0.7); alb = mix(vec3(0.30,0.29,0.27), pow(alb, vec3(1.2)), 0.72) * 0.6;

  vec3 sunT = refract(-uSun, vec3(0,1,0), 1.0/IOR);
  float Ts = 1.0 - fresnel(uSun.y, IOR);
  float depthHere = max(P.y - FP.y, 0.0);
  // relief: nudge caustic lookup by pseudo height along the sun path; darken gaps a little
  vec2 cuv = (FP.xz - uCausShift + sunT.xz/(-sunT.y)*(hgt-0.35)*0.05)/uL;
  vec3 caus = texture(uCaus, cuv, 1.0).rgb;
  // touch ripples focus light too: first-order lensing from the local curvature where the sun ray entered
  vec2 S = FP.xz - sunT.xz*depthHere/(-sunT.y);
  float lap = texture(uRip, (S - uRipCenter)/uRipSize + 0.5).a;
  caus *= clamp(1.0/(1.0 + 0.12*depthHere*lap), 0.45, 3.0);
  float ao = mix(0.55, 1.0, smoothstep(0.08, 0.42, hgt));
  vec3 Esun = SUN * Ts * exp(-SIG_T*depthHere/(-sunT.y)) * caus * (-sunT.y) * mix(0.75, 1.0, ao);
  vec3 skyIrr = vec3(0.62, 0.70, 0.78) * PI * 0.22;
  vec3 Esky = skyIrr * exp(-(SIG_A + 0.4*SIG_S)*depthHere*1.25) * ao;
  vec3 Lfloor = alb/PI * (Esun + Esky);

  vec3 Tv = exp(-SIG_T*s);
  float cosS = dot(sunT, -tr);
  float g = 0.8; float ph = (1.0-g*g)/(4.0*PI*pow(1.0+g*g-2.0*g*cosS, 1.5));
  vec3 Lmid = SUN*Ts*exp(-SIG_T*depthHere*0.5/(-sunT.y))*(ph+0.02) + skyIrr*exp(-SIG_A*depthHere*0.6)/(4.0*PI);
  vec3 Lin = SIG_S/SIG_T * Lmid * (1.0 - Tv) * 3.2;
  vec3 under = Lfloor*Tv + Lin;
  // suspended specks at three depths: tiny sunlit particles that give the water column volume
  for (int k=0;k<3;k++){
    float dz = 0.22 + 0.38*float(k);
    float tt = dz / max(-tr.y, 0.05);
    vec2 q = (P.xz + tr.xz*tt)*48.0 + vec2(uTime*(0.05+0.03*float(k)), uTime*0.02) + float(k)*17.0;
    vec2 id = floor(q), f = fract(q) - 0.5;
    float r = hash12(id + float(k)*13.1);
    vec2 of = vec2(hash12(id+3.1), hash12(id+7.7)) - 0.5;
    float fw = fwidth(q.x) + fwidth(q.y);
    float dot_ = smoothstep(0.10 + fw, 0.0, length(f - of*0.6)) * step(0.988, r) * step(tt, s);
    float fade = exp(-SIG_T.g*tt*2.0) * smoothstep(1.2, 0.3, fw);
    under += dot_ * fade * SUN * Ts * 0.022 * mix(vec3(0.9,1.0,0.95), vec3(0.4,0.35,0.3), step(0.992, r));
  }

  vec3 col = F*refl + (1.0-F)*under + spec;

  // distant haze over the water
  float haze = 1.0 - exp(-dist*0.004);
  float muh = max(dot(normalize(vec3(wd.x,0.0,wd.z)), uSun), 0.0);
  vec3 hazeC = vec3(0.60, 0.71, 0.82) + vec3(1.0,0.86,0.66)*(0.22*pow(muh,6.0)+0.3*pow(muh,64.0));
  col = mix(col, hazeC*0.95, haze*0.8);

  // sky above horizon
  vec3 skyc = sky(rd);
  float mu = dot(rd, uSun);
  skyc += SUN*18.0*smoothstep(0.99996, 0.999985, mu);
  float hz = smoothstep(-0.0005, 0.0015, rd.y);
  col = mix(col, skyc, hz);

  o = vec4(max(col, 0.0), 1.0);
}`, 'water');

/* ---------------- Post: glare streaks + bloom + tonemap ---------------- */
const pBright = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uThr;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec3 c = vec3(0);
  for (int y=-1;y<=2;y++) for (int x=-1;x<=2;x++) c += texture(uSrc, vUv + (vec2(x,y)-0.5)*px*1.0).rgb;
  c /= 16.0;
  float l = max(max(c.r,c.g),c.b);
  float k = max(l - uThr, 0.0) / max(l, 1e-4);
  o = vec4(min(c*k, vec3(160.0)), 1);
}`, 'bright');
const pStreak = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uDir; uniform float uStep, uAtt;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec3 c = vec3(0); float ws = 0.0;
  for (int s=0;s<4;s++){ float w = pow(uAtt, uStep*float(s)); c += w*texture(uSrc, vUv + uDir*px*uStep*float(s)).rgb; ws += w; }
  o = vec4(c/ws, 1);
}`, 'streak');
const pBlur = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uDir;
void main(){
  vec2 px = uDir/vec2(textureSize(uSrc,0));
  vec3 c = texture(uSrc, vUv).rgb*0.2270270270;
  c += (texture(uSrc, vUv+px*1.3846153846).rgb + texture(uSrc, vUv-px*1.3846153846).rgb)*0.3162162162;
  c += (texture(uSrc, vUv+px*3.2307692308).rgb + texture(uSrc, vUv-px*3.2307692308).rgb)*0.0702702703;
  o = vec4(c,1);
}`, 'blur');
const pCopy = prog(VS, HEAD+`uniform sampler2D uSrc; uniform float uK; void main(){ o = vec4(texture(uSrc,vUv).rgb*uK,1); }`, 'copy');
const pRaw = prog(VS, HEAD+`uniform sampler2D uSrc; void main(){ o = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }`, 'raw');
const pFinal = prog(VS, HEAD+`
uniform sampler2D uHdr, uStreak, uB1, uB2; uniform float uExp, uTime, uNoPost; uniform vec2 uRes;
vec3 bicubic(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t,0)); vec2 p = uv*ts - 0.5; vec2 f = fract(p); p = floor(p);
  vec2 w0 = f*(-0.5+f*(1.0-0.5*f)), w1 = 1.0+f*f*(-2.5+1.5*f), w2 = f*(0.5+f*(2.0-1.5*f)), w3 = f*f*(-0.5+0.5*f);
  vec2 g0 = w0+w1, g1 = w2+w3; vec2 h0 = (w1/g0 - 0.5 + p)/ts, h1 = (w3/g1 + 1.5 + p)/ts;
  return (texture(t, vec2(h0.x,h0.y)).rgb*g0.x + texture(t, vec2(h1.x,h0.y)).rgb*g1.x)*g0.y + (texture(t, vec2(h0.x,h1.y)).rgb*g0.x + texture(t, vec2(h1.x,h1.y)).rgb*g1.x)*g1.y;
}
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv = vUv;
  // faint lateral chromatic aberration, like a phone lens
  vec2 cc = uv-0.5; float ca = 0.0012*dot(cc,cc)*4.0;
  vec3 c;
  c.r = texture(uHdr, uv + cc*ca).r; c.g = texture(uHdr, uv).g; c.b = texture(uHdr, uv - cc*ca).b;
  if (uNoPost < 0.5) c += texture(uStreak, uv).rgb * 0.9;
  if (uNoPost < 0.5) c += texture(uB1, uv).rgb * 0.035 + bicubic(uB2, uv) * 0.035;
  if (uNoPost > 1.5) c = texture(uStreak, uv).rgb * 0.55 * 20.0;
  c *= uExp;
  float vig = 1.0 - 0.22*dot(cc*vec2(1.0,0.8), cc*vec2(1.0,0.8))*2.2;
  c *= vig;
  c = aces(c);
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(lum), c, 0.90);
  c = mix(c, c*vec3(0.96,1.0,1.05), 1.0 - smoothstep(0.0, 0.35, lum));
  c = pow(c, vec3(1.0/2.2));
  float g = hash(gl_FragCoord.xy + fract(uTime*7.13)*917.0) - 0.5;
  c += g * 0.018 * (1.0 - c*0.6);
  o = vec4(c, 1);
}`, 'final');


/* ---------------- Lens diffraction glare ----------------
   The star around each sun glint is the lens aperture's diffraction pattern (its Fourier transform),
   integrated over wavelengths so the spikes carry faint rainbow tints. The bright image is convolved
   with it by FFT every frame, so the cost does not depend on how many glints there are. */
const GLARE_ON = !!extF32 && !Q.has('noglare');
const pFFTg = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform int uP, uHoriz, uHalf; uniform float uSign;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int j = uHoriz==1 ? id.x : id.y;
  int k = j & (uP-1);
  int i = ((j - (j & (2*uP-1))) >> 1) + k;
  bool y1 = (j & uP) != 0;
  ivec2 a = uHoriz==1 ? ivec2(i, id.y) : ivec2(id.x, i);
  ivec2 b = uHoriz==1 ? ivec2(i+uHalf, id.y) : ivec2(id.x, i+uHalf);
  vec4 x0 = texelFetch(uSrc, a, 0), x1 = texelFetch(uSrc, b, 0);
  float ang = uSign*3.14159265359*float(k)/float(uP);
  vec2 w = vec2(cos(ang), sin(ang));
  vec4 wx = vec4(cmul(w,x1.xy), cmul(w,x1.zw));
  o = y1 ? x0-wx : x0+wx;
}`, 'fftGlare');
const pGSrc = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uThr, uWhich;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec2 st = 1.0/vec2(textureSize(uSrc,0)) * vec2(textureSize(uSrc,0)) / vec2(textureSize(uSrc,0));
  vec3 c = vec3(0);
  // 4 bilinear taps = 16 texels, enough for the ~4-5x downscale
  for (int y=0;y<2;y++) for (int x=0;x<2;x++) c += texture(uSrc, vUv + (vec2(x,y)-0.5)*px*2.0).rgb;
  c *= 0.25;
  float l = max(max(c.r,c.g),c.b);
  c *= max(l - uThr, 0.0)/max(l, 1e-4);
  c = min(c, vec3(80000.0)) * 1e-3;
  o = uWhich < 0.5 ? vec4(c.r, 0.0, c.g, 0.0) : vec4(c.b, 0.0, 0.0, 0.0);
}`, 'glareSrc');
const pGMul = prog(VS, HEAD+`
uniform sampler2D uSrc, uK;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){ ivec2 id = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uSrc,id,0), k = texelFetch(uK,id,0); o = vec4(cmul(a.xy,k.xy), cmul(a.zw,k.zw)); }`, 'glareMul');
const pGOut = prog(VS, HEAD+`
uniform sampler2D uA, uB; uniform vec2 uScale;
void main(){ ivec2 id = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uA,id,0), b = texelFetch(uB,id,0);
  o = vec4(max(vec3(a.x, a.z, b.x), 0.0)*1e3, 1); }`, 'glareOut');

function fft1(re, im, n, inv){
  for (let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit;
    if(i<j){ let t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; } }
  for (let len=2; len<=n; len<<=1){
    const ang=2*Math.PI/len*(inv?1:-1), wr=Math.cos(ang), wi=Math.sin(ang), h=len>>1;
    for (let i=0;i<n;i+=len){ let cr=1, ci=0;
      for (let k=0;k<h;k++){ const a=i+k, b=a+h; const xr=re[b]*cr-im[b]*ci, xi=re[b]*ci+im[b]*cr;
        re[b]=re[a]-xr; im[b]=im[a]-xi; re[a]+=xr; im[a]+=xi; const t=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=t; } } }
}
function fft2(re, im, w, h, inv){
  const rr=new Float32Array(w), ri=new Float32Array(w);
  for (let y=0;y<h;y++){ const o=y*w; rr.set(re.subarray(o,o+w)); ri.set(im.subarray(o,o+w)); fft1(rr,ri,w,inv); re.set(rr,o); im.set(ri,o); }
  const cr=new Float32Array(h), ci=new Float32Array(h);
  for (let x=0;x<w;x++){ for (let y=0;y<h;y++){ cr[y]=re[y*w+x]; ci[y]=im[y*w+x]; } fft1(cr,ci,h,inv); for (let y=0;y<h;y++){ re[y*w+x]=cr[y]; im[y*w+x]=ci[y]; } }
}
// Aperture: round lens with slightly flattened hexagonal edge, two hairline scratches and a few dust specks.
let PSF = null;
function buildPSF(){
  const n = 512, R = n*0.11, SS = 3, D = Math.PI/180;
  const re = new Float32Array(n*n), im = new Float32Array(n*n);
  const flats = [0,1,2,3,4,5].map(k => (15 + k*60)*D);
  const scratches = [ {a:21*D, o:0.12*R, w:2.2}, {a:22.5*D, o:-0.38*R, w:1.6}, {a:19*D, o:0.55*R, w:1.2}, {a:152*D, o:0.25*R, w:1.0}, {a:84*D, o:-0.2*R, w:0.8} ];
  const r2 = mulberry(3); const dust = Array.from({length:7}, () => ({x:(r2()-0.5)*1.4*R, y:(r2()-0.5)*1.4*R, r:(0.015+0.03*r2())*R}));
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){
    let acc = 0;
    for (let sy=0; sy<SS; sy++) for (let sx=0; sx<SS; sx++){
      const dx = x - n/2 + (sx+0.5)/SS - 0.5, dy = y - n/2 + (sy+0.5)/SS - 0.5;
      if (dx*dx+dy*dy > R*R) continue;
      let ok = true;
      for (const f of flats) if (dx*Math.cos(f)+dy*Math.sin(f) > R*0.955) { ok=false; break; }
      if (ok) for (const sc of scratches) if (Math.abs(dx*Math.cos(sc.a)+dy*Math.sin(sc.a) - sc.o) < sc.w*0.5) { ok=false; break; }
      if (ok) for (const d of dust) if ((dx-d.x)**2+(dy-d.y)**2 < d.r*d.r) { ok=false; break; }
      if (ok) acc++;
    }
    re[y*n+x] = acc/(SS*SS);
  }
  fft2(re, im, n, n, false);
  const P = new Float32Array(n*n);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const i=((y+n/2)%n)*n + ((x+n/2)%n); P[y*n+x] = re[i]*re[i]+im[i]*im[i]; }
  // integrate over the visible spectrum: the pattern scales with wavelength
  const bands = [[440,[0.10,0.00,0.85]],[470,[0.00,0.15,1.00]],[500,[0.00,0.60,0.55]],[530,[0.05,1.00,0.15]],[560,[0.45,0.95,0.00]],[590,[0.95,0.55,0.00]],[620,[1.00,0.20,0.00]],[650,[0.70,0.05,0.00]]];
  const out = new Float32Array(n*n*3), sum=[0,0,0];
  const samp = (u,v) => { if (u<0||v<0||u>=n-1||v>=n-1) return 0; const x0=u|0, y0=v|0, fx=u-x0, fy=v-y0, i=y0*n+x0;
    return (P[i]*(1-fx)+P[i+1]*fx)*(1-fy) + (P[i+n]*(1-fx)+P[i+n+1]*fx)*fy; };
  for (const [lam, w] of bands){ const s = lam/550;
    for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const v = samp(n/2+(x-n/2)/s, n/2+(y-n/2)/s)/(s*s); const o=(y*n+x)*3;
      out[o]+=v*w[0]; out[o+1]+=v*w[1]; out[o+2]+=v*w[2]; } }
  // phone lenses flare harder than an ideal aperture: lift the far field relative to the core
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const r = Math.hypot(x-n/2, y-n/2); const w = 1 + 7*Math.min(1, Math.max(0, (r-3)/30)); const o=(y*n+x)*3; out[o]*=w; out[o+1]*=w; out[o+2]*=w; }
  for (let i=0;i<n*n;i++) for (let c=0;c<3;c++) sum[c]+=out[i*3+c];
  for (let i=0;i<n*n;i++) for (let c=0;c<3;c++) out[i*3+c]/=sum[c];
  PSF = { n, rgb: out };
}
let glareTick = 0, gX=0, gY=0, gSW=0, gSH=0, gA=[], gB=[], gK1=null, gK2=null;
function allocGlare(){
  for (const r of [...gA, ...gB]) { gl.deleteTexture(r.t); gl.deleteFramebuffer(r.fb); }
  if (gK1) { gl.deleteTexture(gK1); gl.deleteTexture(gK2); }
  gX = W>=H ? 512 : 256; gY = W>=H ? 256 : 512;
  // fit the frame inside ~75% of the grid so the spikes have room to fade before wrapping around
  const f = Math.min(gX*0.75/W, gY*0.75/H); gSW = Math.max(1, Math.round(W*f)); gSH = Math.max(1, Math.round(H*f));
  gA = [0,1].map(()=>rt(gX,gY,FFT_FMT,{filter:gl.NEAREST})); gB = [0,1].map(()=>rt(gX,gY,FFT_FMT,{filter:gl.NEAREST}));
  if (!PSF) buildPSF();
  // resample the PSF onto the grid: its full width spans ~1.15x the frame height
  const n = PSF.n, KH = 1.15*gSH, sc = n/KH;
  const kr = [0,1,2].map(()=>({re:new Float32Array(gX*gY), im:new Float32Array(gX*gY)}));
  const tot=[0,0,0];
  for (let gy=-gY/2; gy<gY/2; gy++) for (let gx=-gX/2; gx<gX/2; gx++){
    const u = n/2 + gx*sc, v = n/2 + gy*sc; if (u<0||v<0||u>=n-1||v>=n-1) continue;
    const x0=u|0, y0=v|0, fx=u-x0, fy=v-y0, i=((gy+gY)%gY)*gX + ((gx+gX)%gX);
    for (let c=0;c<3;c++){ const P = PSF.rgb, a=(y0*n+x0)*3+c;
      const val = (P[a]*(1-fx)+P[a+3]*fx)*(1-fy) + (P[a+n*3]*(1-fx)+P[a+n*3+3]*fx)*fy;
      kr[c].re[i] = val; tot[c] += val; } }
  const norm = 1/(gX*gY);
  for (let c=0;c<3;c++){ for (let i=0;i<gX*gY;i++) kr[c].re[i] *= norm/tot[c]; fft2(kr[c].re, kr[c].im, gX, gY, false); }
  const d1 = new Float32Array(gX*gY*4), d2 = new Float32Array(gX*gY*4);
  for (let i=0;i<gX*gY;i++){ d1[i*4]=kr[0].re[i]; d1[i*4+1]=kr[0].im[i]; d1[i*4+2]=kr[1].re[i]; d1[i*4+3]=kr[1].im[i]; d2[i*4]=kr[2].re[i]; d2[i*4+1]=kr[2].im[i]; }
  gK1 = tex(gX,gY,gl.RGBA32F,{filter:gl.NEAREST}); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gX,gY,gl.RGBA,gl.FLOAT,d1);
  gK2 = tex(gX,gY,gl.RGBA32F,{filter:gl.NEAREST}); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gX,gY,gl.RGBA,gl.FLOAT,d2);
}
function fftGrid(pair, sign){
  gl.useProgram(pFFTg.p); gl.uniform1i(pFFTg.u.uSrc,0); gl.uniform1f(pFFTg.u.uSign, sign);
  let src = 0;
  for (const [horiz, len] of [[1,gX],[0,gY]]){
    gl.uniform1i(pFFTg.u.uHoriz, horiz); gl.uniform1i(pFFTg.u.uHalf, len/2);
    for (let p=1; p<len; p<<=1){ target(pair[1-src]); bindT(0, pair[src].t); gl.uniform1i(pFFTg.u.uP, p); fullscreen(); src = 1-src; }
  }
  return src;
}
function renderGlare(){
  gl.disable(gl.BLEND);
  gl.useProgram(pGSrc.p); bindT(0, hdrRT.t); gl.uniform1i(pGSrc.u.uSrc,0); gl.uniform1f(pGSrc.u.uThr, 14.0);
  for (const [pair, which] of [[gA,0],[gB,1]]){
    gl.bindFramebuffer(gl.FRAMEBUFFER, pair[0].fb); gl.viewport(0,0,gX,gY); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0,0,gSW,gSH); gl.uniform1f(pGSrc.u.uWhich, which); fullscreen();
  }
  const res = [];
  for (const [pair, K] of [[gA,gK1],[gB,gK2]]){
    let s = fftGrid(pair, -1);
    target(pair[1-s]); gl.useProgram(pGMul.p); bindT(0, pair[s].t); bindT(1, K); gl.uniform1i(pGMul.u.uSrc,0); gl.uniform1i(pGMul.u.uK,1); fullscreen(); s = 1-s;
    if (s !== 0) { /* fftGrid always starts from index 0: copy back */ target(pair[0]); gl.useProgram(pRaw.p); bindT(0,pair[1].t); gl.uniform1i(pRaw.u.uSrc,0); fullscreen(); }
    res.push(pair[fftGrid(pair, 1)]);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.viewport(0,0,streakRT.w,streakRT.h);
  gl.useProgram(pGOut.p); bindT(0,res[0].t); bindT(1,res[1].t); gl.uniform1i(pGOut.u.uA,0); gl.uniform1i(pGOut.u.uB,1); fullscreen();
}
let W=0, H=0, scale = 1.0, hdrRT, qA, qS, qB, qC, streakRT, b1, b2, b2t;
const DPR = Math.min(window.devicePixelRatio||1, 2);
let quality = FIXED_T!==null ? 1.0 : (DPR > 1.5 ? 0.72 : 0.95);
function alloc(){
  const cw = Math.max(1, Math.round(el.clientWidth*DPR*quality)), ch = Math.max(1, Math.round(el.clientHeight*DPR*quality));
  if (cw===W && ch===H) return;
  W=cw; H=ch; canvas.width=W; canvas.height=H;
  for (const r of [hdrRT,qA,qS,qB,qC,streakRT,b1,b2,b2t]) if (r){ gl.deleteTexture(r.t); gl.deleteFramebuffer(r.fb); }
  hdrRT = rt(W,H,gl.RGBA16F);
  const qw = Math.max(1,W>>1), qh = Math.max(1,H>>1);
  qA = rt(qw,qh,gl.RGBA16F); qS = rt(qw,qh,gl.RGBA16F); qB = rt(qw,qh,gl.RGBA16F); qC = rt(qw,qh,gl.RGBA16F);
  if (GLARE_ON) { allocGlare(); streakRT = rt(gSW,gSH,gl.RGBA16F); } else { streakRT = rt(4,4,gl.RGBA16F); gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
  b1 = rt(qw,qh,gl.RGBA16F);
  b2 = rt(Math.max(1,qw>>2),Math.max(1,qh>>2),gl.RGBA16F,{}); b2t = rt(b2.w,b2.h,gl.RGBA16F);
}

function post(t){
  gl.disable(gl.BLEND);
  gl.useProgram(pBright.p); bindT(0,hdrRT.t); gl.uniform1i(pBright.u.uSrc,0);
  target(qA); gl.uniform1f(pBright.u.uThr, 2.5); fullscreen();
  // the glare is the heaviest post step: on phones refresh it every other frame (every third when struggling)
  const every = FIXED_T!==null ? 1 : (quality < 0.55 ? 3 : (DPR > 1.5 ? 2 : 1));
  if (GLARE_ON && (glareTick++ % every === 0)) renderGlare();
  // bloom
  gl.useProgram(pBlur.p); gl.uniform1i(pBlur.u.uSrc,0);
  target(qB); bindT(0,qA.t); gl.uniform2f(pBlur.u.uDir,1,0); fullscreen();
  target(b1); bindT(0,qB.t); gl.uniform2f(pBlur.u.uDir,0,1); fullscreen();
  gl.useProgram(pCopy.p); target(b2); bindT(0,b1.t); gl.uniform1i(pCopy.u.uSrc,0); gl.uniform1f(pCopy.u.uK,1.0); fullscreen();
  gl.useProgram(pBlur.p);
  for (let i=0;i<2;i++){ target(b2t); bindT(0,b2.t); gl.uniform2f(pBlur.u.uDir,1.5,0); fullscreen(); target(b2); bindT(0,b2t.t); gl.uniform2f(pBlur.u.uDir,0,1.5); fullscreen(); }
  // final
  if (Q.get('view')==='caus'){ target(null); gl.useProgram(pCopy.p); bindT(0,causRT.t); gl.uniform1i(pCopy.u.uSrc,0); gl.uniform1f(pCopy.u.uK,0.25); fullscreen(); return; }
  target(null); gl.useProgram(pFinal.p);
  bindT(0,hdrRT.t); bindT(1,streakRT.t); bindT(2,b1.t); bindT(3,b2.t);
  gl.uniform1i(pFinal.u.uHdr,0); gl.uniform1i(pFinal.u.uStreak,1); gl.uniform1i(pFinal.u.uB1,2); gl.uniform1i(pFinal.u.uB2,3);
  gl.uniform1f(pFinal.u.uExp, 0.63); gl.uniform1f(pFinal.u.uNoPost, Q.get('view')==='nopost'?1:(Q.get('view')==='glare'?2:0)); gl.uniform1f(pFinal.u.uTime, t); gl.uniform2f(pFinal.u.uRes, W, H);
  fullscreen();
}

/* ---------------- Camera & input ---------------- */
const SUN_EL = 31*Math.PI/180, SUN_AZ = 6*Math.PI/180;
const SUNV = [Math.sin(SUN_AZ)*Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ)*Math.cos(SUN_EL)];
const cam = { yaw: Q.has('yaw')? parseFloat(Q.get('yaw')) : 0, pitch: Q.has('pitch')? parseFloat(Q.get('pitch')) : -0.72, vy:0, vp:0, h:1.55 };
let drag = null, lastTap = null;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); drag = {x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t:performance.now()}; });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const k = 1.2/Math.min(el.clientWidth, el.clientHeight);
  const dx = (e.clientX-drag.x)*k, dy = (e.clientY-drag.y)*k;
  cam.yaw -= dx; cam.pitch += dy; cam.vy = -dx; cam.vp = dy;
  cam.pitch = Math.max(-1.45, Math.min(0.35, cam.pitch));
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', e => {
  if (drag && Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) < 8 && performance.now()-drag.t < 350) lastTap = [e.clientX, e.clientY];
  drag = null; hideHint();
});
canvas.addEventListener('pointercancel', () => drag = null);
function hideHint(){}

function camBasis(t){
  const hy = FIXED_T!==null ? 0 : 1;
  const yaw = cam.yaw + hy*(0.010*Math.sin(t*0.31) + 0.005*Math.sin(t*0.83+1.3));
  const pit = cam.pitch + hy*(0.007*Math.sin(t*0.47+2.0) + 0.003*Math.sin(t*1.13));
  const roll = hy*(0.006*Math.sin(t*0.39+0.4));
  const f = [Math.sin(yaw)*Math.cos(pit), Math.sin(pit), -Math.cos(yaw)*Math.cos(pit)];
  let r = [Math.cos(yaw), 0, Math.sin(yaw)];
  let u = [r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  const cr=Math.cos(roll), sr=Math.sin(roll);
  const r2 = r.map((x,i)=>x*cr + u[i]*sr), u2 = u.map((x,i)=>u[i]*cr - r[i]*sr);
  const pos = [hy*0.03*Math.sin(t*0.21), cam.h + hy*0.015*Math.sin(t*0.57), hy*0.03*Math.cos(t*0.17)];
  return { f, r:r2, u:u2, pos };
}
const VFOV = 64*Math.PI/180;

// screen tap -> point on water plane -> drop in ripple sim
function tapToDrop(sx, sy, B){
  const bx = canvas.getBoundingClientRect(), nx = ((sx-bx.left)/bx.width)*2-1, ny = 1-((sy-bx.top)/bx.height)*2;
  const tf = Math.tan(VFOV/2), asp = W/H;
  const d = [0,1,2].map(i => B.f[i] + nx*asp*tf*B.r[i] + ny*tf*B.u[i]);
  if (d[1] >= -0.01) return;
  const t = -B.pos[1]/d[1]; const px = B.pos[0]+d[0]*t, pz = B.pos[2]+d[2]*t;
  const u = (px - ripCenter[0])/RSIZE + 0.5, v = (pz - ripCenter[1])/RSIZE + 0.5;
  if (u<0.05||u>0.95||v<0.05||v>0.95) return;
  drops.push([u, v, 0.022, 0.07]);
  ripActive = 0;
}

/* ---------------- Loop ---------------- */
alloc();
const $dbg = null;
let t0 = performance.now(), last = t0, acc = 0, frames = 0, ftAvg = 16, tSim = 0;
function frame(now){
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  tSim += dt;
  const t = FIXED_T!==null ? FIXED_T : tSim;
  if (!drag){ cam.yaw += cam.vy*0.9; cam.pitch += cam.vp*0.9; cam.vy*=0.9; cam.vp*=0.9; cam.pitch = Math.max(-1.45, Math.min(0.35, cam.pitch)); }
  if (!pebReady){ requestAnimationFrame(frame); return; }
  const B = camBasis(t);

  runFFT(t*0.9);
  // keep the ripple window centred under the view, snapped to whole texels
  const look = -B.pos[1]/Math.min(B.f[1],-0.2);
  const want = [B.pos[0]+B.f[0]*look*0.9, B.pos[2]+B.f[2]*look*0.9];
  const tx = RSIZE/RN;
  const dxT = Math.round((want[0]-ripCenter[0])/tx), dzT = Math.round((want[1]-ripCenter[1])/tx);
  if (Q.has('tap') && !window.__tapped){ window.__tapped=1; const [x,y]=Q.get('tap').split(',').map(Number); lastTap=[x,y]; }
  if (lastTap){ tapToDrop(lastTap[0], lastTap[1], B); lastTap = null; }
  if (drag){ /* stir while dragging lightly? keep camera only */ }
  if (ripActive < 900){
    stepRipples([dxT/RN, dzT/RN]); ripCenter = [ripCenter[0]+dxT*tx, ripCenter[1]+dzT*tx]; ripActive++;
  } else { ripCenter = [ripCenter[0]+dxT*tx, ripCenter[1]+dzT*tx]; }

  renderCaustics(SUNV);

  target(hdrRT); gl.disable(gl.BLEND); gl.useProgram(pMain.p);
  bindT(0,surfRT.t); bindT(1,causRT.t); bindT(2,pebTex); bindT(3,ripN.t);
  const u = pMain.u;
  gl.uniform1i(u.uSurf,0); gl.uniform1i(u.uCaus,1); gl.uniform1i(u.uPeb,2); gl.uniform1i(u.uRip,3);
  gl.uniform3fv(u.uCam, B.pos); gl.uniform3fv(u.uR, B.r); gl.uniform3fv(u.uU, B.u); gl.uniform3fv(u.uF, B.f); gl.uniform3fv(u.uSun, SUNV);
  gl.uniform1f(u.uTanF, Math.tan(VFOV/2)); gl.uniform1f(u.uAspect, W/H); gl.uniform1f(u.uL, L); gl.uniform1f(u.uDepth, DEPTH); gl.uniform1f(u.uTime, t);
  gl.uniform1f(u.uRipSize, RSIZE); gl.uniform2fv(u.uRipCenter, ripCenter); gl.uniform2fv(u.uCausShift, causShift);
  fullscreen();
  post(t);

  // adaptive resolution
  if (FIXED_T===null){
    ftAvg = ftAvg*0.95 + (dt*1000)*0.05; frames++;
    if (frames > 90){
      if (ftAvg > 21 && quality > 0.42){ quality = Math.max(0.42, quality*0.87); alloc(); frames = 0; }
      else if (ftAvg < 14.5 && quality < 1.0){ quality = Math.min(1.0, quality*1.06); alloc(); frames = 0; }
    }
    if (DEBUG && frames%15===0) $dbg.textContent = `${(1000/ftAvg).toFixed(0)} fps · ${W}×${H} · q ${quality.toFixed(2)}`;
  }
  if (FIXED_T!==null){ stillFrames++; if (stillFrames < (Q.has('frames')? +Q.get('frames') : 4)) requestAnimationFrame(frame); return; }
  requestAnimationFrame(frame);
}

  // ---------- paw-fx seams ----------
  // Upstream's frame loop calls requestAnimationFrame(frame) from three
  // places. Shadowing the name here routes every one of them through tick(),
  // which is where the section's own concerns live -- pausing off screen,
  // marking data-fx-live, and a handle destroy() can cancel -- so the loop
  // body above stays exactly as upstream wrote it.
  function requestAnimationFrame() { if (!raf) raf = window.requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!visible) return;
    frame(now);
    // only once the pebble bed has loaded and a real frame is on the canvas,
    // so the CSS rest never fades out from under an empty one
    if (pebReady && !live) { live = true; el.setAttribute('data-fx-live', ''); }
  }

  // Starts true, so a browser that never delivers a callback still runs.
  var io = new IntersectionObserver(function (es) {
    visible = es[es.length - 1].isIntersecting;
    if (visible && !raf) { last = performance.now(); requestAnimationFrame(frame); }
  });
  var ro = new ResizeObserver(function () {
    if (!el.clientWidth || !el.clientHeight) return;
    alloc();
    // the frozen path stops after four frames; a resize clears the canvas, so
    // it draws them again
    if (FIXED_T !== null) { stillFrames = 0; requestAnimationFrame(frame); }
  });

  el.insertBefore(canvas, el.firstChild);
  ro.observe(el);
  io.observe(el);
  requestAnimationFrame(frame);

  return {
    update: function (next) {
      Object.assign(o, next || {});
      cam.yaw = fin(o.yaw, DEFAULTS.yaw);
      cam.pitch = Math.max(-1.45, Math.min(0.35, fin(o.pitch, DEFAULTS.pitch)));
      if (FIXED_T !== null) { stillFrames = 0; requestAnimationFrame(frame); }
    },
    destroy: function () {
      visible = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect(); io.disconnect();
      var perda = gl.getExtension('WEBGL_lose_context');
      if (perda) perda.loseContext();
      canvas.remove();
      el.removeAttribute('data-fx-live');
    }
  };
  }
}

// Upstream's seabed: tools/make_pebbles.py's seamless pebble bed, embedded in
// upstream as a 1024x1024 JPEG. Here it is the same image re-encoded at
// 256x256, because the 1024 original is 253 KB gzipped against the library's
// 60 KB own-code cap. It is sampled with trilinear filtering and 16x
// anisotropy and blended across two offset tilings, so the loss shows only in
// the nearest pebbles.
const PEBBLES = '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';

export const meta = {
  name: "clearwater",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    yaw: { type: "number", default: 0, min: -3.14, max: 3.14, step: 0.0314, description: "Which way the camera faces across the water, in radians (upstream's ?yaw). 0 looks out along the shore with the sun just off to the right; the scene is a periodic patch, so every heading is water. The visitor can still drag the view away from it." },
    pitch: { type: "number", default: -0.72, min: -1.44, max: 0.36, step: 0.009, description: "How far the camera looks down, in radians (upstream's ?pitch, clamped to its -1.45..0.35). The default looks down into the shallows at the caustics on the bed; toward 0 the view flattens out over the glare to the headland on the horizon." },
  },
};
