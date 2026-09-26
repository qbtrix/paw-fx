// moyun -- https://github.com/axtonliu/moyun
//
// MIT License
//
// Copyright (c) 2026 Axton Liu
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
// ink-wash: a port of axtonliu/moyun at commit
// eb488acf811122bb9a574d87fb148ffa42ed4c23, index.html. A sheet of rice paper
// that an invisible hand paints a Chinese landscape onto, stroke by stroke,
// and that the visitor can paint on too.
//
// The ink is not drawn, it is simulated. An incompressible Navier-Stokes solver
// runs in WebGL2 fragment shaders (curl, vorticity confinement, divergence, 24
// Jacobi pressure iterations, gradient subtraction, semi-Lagrangian advection)
// and carries a dye texture whose four channels are free ink, cinnabar, water
// and settled ink. Water bleeds anisotropically along procedural paper fibres
// and evaporates; ink that dries settles and only moves again when re-wetted.
// Brush strokes are gaussian stamps along the path: slow is wet and heavy, fast
// is thin and dry, and each stroke is one dip of ink that runs out into
// flying-white streaks. The landscape is seeded and generated in the classical
// order -- far hills, main peak outline, texture strokes, washes, moss dots,
// pines, water, a boat, birds, a cinnabar sun.
//
// Upstream lines 167-170, 179-448, 451-547, 656-840, 862-884, 889, 894 and
// 901-965 sit inside inicia() below verbatim, at upstream's own indentation so
// a diff against the pinned file reads clean. Inside those ranges the lines
// that differ are: the theme reader, which looks at the section and at --fx-
// names instead of the document root; the seed, which an option can fix; the
// tool, which is an option instead of a toolbar. Upstream's Web Audio guqin,
// poem-and-seal overlay, toolbar, about sheet and window listeners are gone;
// the audio and poem functions stay as empty stubs so every call to them inside
// the verbatim block is left exactly as upstream wrote it.
// meta.json.deviations lists each change.

const DEFAULTS = { autopaint: true, tool: 'ink', seed: 0 };
const TOOL = t => (t === 'ink' || t === 'cinnabar' || t === 'water') ? t : 'ink';

export function mount(el, opts = {}) {
  var resting = { update: function () {}, destroy: function () {} };
  if (!el || typeof document === 'undefined') return resting;
  // Upstream's reduced-motion path paints five times faster, which is still
  // several seconds of ink moving across the page. The contract is rest, so
  // under reduced motion the section keeps its CSS resting sheet.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return resting;

  var o = Object.assign({}, DEFAULTS, opts);
  var canvas = document.createElement('canvas');
  canvas.className = 'fx-ink__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl2', {alpha:false, depth:false, stencil:false, antialias:false, premultipliedAlpha:false, failIfMajorPerformanceCaveat:true});
  if (!gl) return resting;

  // Upstream's brush-position ring, kept as a real element inside the section.
  var ghostDom = document.createElement('div');
  ghostDom.className = 'fx-ink__ghost';
  ghostDom.setAttribute('aria-hidden', 'true');

  el.insertBefore(ghostDom, el.firstChild);
  el.insertBefore(canvas, el.firstChild);
  try {
    return inicia();
  } catch (e) {
    var perda = gl.getExtension('WEBGL_lose_context');
    if (perda) perda.loseContext();
    canvas.remove(); ghostDom.remove();
    return resting;
  }

  function inicia() {

// Upstream looks its chrome up by id on its own page. The ring is real; every
// other element (poem, hint, toolbar, about sheet, fps readout) is a detached
// node, so the writes the verbatim block makes to them land nowhere.
const $ = id => id === 'ghost' ? ghostDom : document.createElement('div');

const poemEl = $('poem'), ghostEl = $('ghost'), hintEl = $('hint');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;


function fallback(){ throw new Error('ink-wash: rest'); }


if (!gl) { fallback(); return; }
gl.getExtension('EXT_color_buffer_float');
gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');

/* ───────── shaders ───────── */
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform vec2 texel;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main(){
  vUv=aPos*.5+.5;
  vL=vUv-vec2(texel.x,0.); vR=vUv+vec2(texel.x,0.);
  vT=vUv+vec2(0.,texel.y); vB=vUv-vec2(0.,texel.y);
  gl_Position=vec4(aPos,0.,1.);
}`;
const HEAD = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 o;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return (w>>22u)^w;}
float hash2(vec2 p){ivec2 i=ivec2(floor(p));return float(pcg(uint(i.x)+pcg(uint(i.y)+7919u)))*(1./4294967295.);}
float h1(float x){return float(pcg(uint(int(floor(x))+65536)))*(1./4294967295.);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y);}
float vn1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h1(i),h1(i+1.),f);}
float fbm(vec2 p){float s=0.,a=.5;for(int k=0;k<5;k++){s+=a*vnoise(p);p=p*2.02+vec2(17.3,9.1);a*=.5;}return s;}
`;
const FS = {
splat: `
uniform sampler2D uTarget; uniform float aspect; uniform int count; uniform vec2 res; uniform float lim;
uniform vec4 uPos[32]; uniform vec4 uVal[32]; uniform vec4 uDir[32];
void main(){
  vec4 base=texture(uTarget,vUv); vec3 add=vec3(0.);
  for(int i=0;i<32;i++){
    if(i>=count) break;
    vec2 p=vUv-uPos[i].xy; p.x*=aspect;
    float q=dot(p,p)/uPos[i].z;
    if(q>40.) continue;
    float g=exp(-pow(q,1.+uPos[i].w*3.));
    float dry=uVal[i].w;
    if(dry>.001){
      vec2 n=vec2(-uDir[i].y,uDir[i].x);
      float s=dot(p,n)*res.y*.5+uDir[i].z;
      float br=vn1(s)*.65+vn1(s*2.3+11.)*.35;
      float cut=dry*.8;
      g*=mix(1.,smoothstep(cut,cut+.2,br),min(1.,dry*1.4));
    }
    add.xy+=g*uVal[i].xy;
    add.z+=exp(-q*.35)*uVal[i].z;
  }
  o=vec4(clamp(base.xyz+add,-lim,lim),base.w);
}`,
advect: `
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 vtexel; uniform float dt; uniform float diss; uniform float keepW;
void main(){
  vec2 c=vUv-dt*texture(uVelocity,vUv).xy*vtexel;
  vec4 a=texture(uSource,c);
  if(keepW>.5) a.w=texture(uSource,vUv).w;
  o=diss*a;
}`,
curl: `
uniform sampler2D uVelocity;
void main(){
  float L=texture(uVelocity,vL).y, R=texture(uVelocity,vR).y, T=texture(uVelocity,vT).x, B=texture(uVelocity,vB).x;
  o=vec4(.5*(R-L-T+B),0.,0.,1.);
}`,
vort: `
uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
void main(){
  float L=texture(uCurl,vL).x, R=texture(uCurl,vR).x, T=texture(uCurl,vT).x, B=texture(uCurl,vB).x, C=texture(uCurl,vUv).x;
  vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));
  f/=length(f)+1e-4; f*=curl*C; f.y*=-1.;
  vec2 v=texture(uVelocity,vUv).xy+f*dt;
  o=vec4(clamp(v,-1000.,1000.),0.,1.);
}`,
div: `
uniform sampler2D uVelocity;
void main(){
  float L=texture(uVelocity,vL).x, R=texture(uVelocity,vR).x, T=texture(uVelocity,vT).y, B=texture(uVelocity,vB).y;
  vec2 C=texture(uVelocity,vUv).xy;
  if(vL.x<0.) L=-C.x; if(vR.x>1.) R=-C.x; if(vT.y>1.) T=-C.y; if(vB.y<0.) B=-C.y;
  o=vec4(.5*(R-L+T-B),0.,0.,1.);
}`,
clear: `
uniform sampler2D uTexture; uniform float value;
void main(){ o=value*texture(uTexture,vUv); }`,
copy: `
uniform sampler2D uTexture;
void main(){ o=texture(uTexture,vUv); }`,
press: `
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main(){
  float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
  float d=texture(uDivergence,vUv).x;
  o=vec4((L+R+B+T-d)*.25,0.,0.,1.);
}`,
grad: `
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main(){
  float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
  vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B);
  o=vec4(v,0.,1.);
}`,
bleed: `
uniform sampler2D uDye; uniform float rate; uniform float evap; uniform float fixRate; uniform vec2 res;
void main(){
  vec4 c=texture(uDye,vUv), l=texture(uDye,vL), r=texture(uDye,vR), t=texture(uDye,vT), b=texture(uDye,vB);
  vec4 avg=(l+r+t+b)*.25;
  float wet=clamp(max(c.z,avg.z),0.,1.);
  vec2 px=vUv*res;
  float fib=vnoise(px*.45)*.55+vnoise(px*vec2(.05,.3))*.45;
  float k=clamp(rate*wet*mix(.1,1.,fib),0.,1.);
  vec4 n=c;
  n.xy+=(avg.xy-c.xy)*k*.45;
  n.z+=(avg.z-c.z)*clamp(k*1.3,0.,1.);
  n.z*=evap;
  float fx=n.x*(1.-clamp(wet*1.6,0.,1.))*fixRate;
  float rw=n.w*clamp((c.z-.2)*2.,0.,1.)*.06;
  n.x+=rw-fx; n.w+=fx-rw;
  o=max(n,vec4(0.));
}`,
paper: `
uniform vec2 res; uniform vec3 paper; uniform vec3 paper2; uniform float seed;
float fibers(vec2 px){
  mat2 r1=mat2(.8,.6,-.6,.8), r2=mat2(.28,-.96,.96,.28), r3=mat2(-.5,.87,-.87,-.5);
  float f=smoothstep(.66,.95,vnoise(r1*px*vec2(.018,.42)+seed));
  f+=.8*smoothstep(.68,.96,vnoise(r2*px*vec2(.014,.5)+seed*1.7));
  f+=.6*smoothstep(.7,.97,vnoise(r3*px*vec2(.025,.6)+seed*.3));
  return f;
}
void main(){
  vec2 px=vUv*res;
  float cloud=fbm(px*.0035+seed);
  float fib=fibers(px);
  float spec=hash2(px*.5+seed);
  vec3 c=mix(paper,paper2,clamp(cloud*.55-.08,0.,1.));
  c=mix(c,paper2,clamp(fib*.22,0.,1.));
  c=mix(c,paper2,step(.996,spec)*.6);
  float gran=vnoise(px*.55)*.6+vnoise(px*.13)*.4;
  o=vec4(c,gran);
}`,
disp: `
uniform sampler2D uDye; uniform sampler2D uPaper; uniform vec2 dtex; uniform vec3 ink; uniform vec3 cin; uniform float dark;
void main(){
  vec4 pp=texture(uPaper,vUv); vec4 d=texture(uDye,vUv);
  vec4 l=texture(uDye,vUv-vec2(dtex.x,0.)), r=texture(uDye,vUv+vec2(dtex.x,0.));
  vec4 t=texture(uDye,vUv+vec2(0.,dtex.y)), b=texture(uDye,vUv-vec2(0.,dtex.y));
  float grad=length(vec2((r.x+r.w)-(l.x+l.w),(t.x+t.w)-(b.x+b.w)));
  float gran=.8+.4*pp.a;
  float k=max(d.x+d.w,0.)*gran;
  float dens=1.-exp(-k*2.3);
  dens=clamp(dens+min(grad*.8,.25)*(1.-dens)*smoothstep(.02,.2,k),0.,1.);
  vec3 col=mix(pp.rgb,ink,dens);
  float v=1.-exp(-max(d.y,0.)*2.6*gran);
  col=mix(col,mix(cin,ink,dens*.35),v*.93);
  col*=1.-.045*clamp(d.z*.6,0.,1.)*(1.-dark);
  vec2 q=vUv-.5; col*=1.-.09*dot(q,q);
  o=vec4(col,1.);
}`
};

function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
let P;
try {
  const vs = compile(gl.VERTEX_SHADER, VS);
  const mk = fs => {
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, name); }
    return { use(){ gl.useProgram(p); return u; } };
  };
  P = {}; for (const k in FS) P[k] = mk(FS[k]);
} catch (e) { console.error(e); fallback('着色器编译失败：' + e.message); return; }

const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);

function blit(t){
  if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}
function fbo(w, h, internal, format, type, filter){
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fb, w, h, ok, bind(unit){ gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; } };
}
function dbl(w, h, ...a){
  let r = fbo(w, h, ...a), wr = fbo(w, h, ...a);
  return { w, h, get read(){ return r; }, get write(){ return wr; }, swap(){ const t = r; r = wr; wr = t; }, get ok(){ return r.ok && wr.ok; } };
}
function free(f){ if (!f) return; if (f.read) { free(f.read); free(f.write); return; } gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); }

/* ───────── state ───────── */
const SIM = coarse ? 144 : 176, DYE = coarse ? 640 : 900, ITER = 24;
let velocity, dye, divergence, curlF, pressure, paperF, dpr = 1, glOK = true;
const theme = {};

function gridRes(n){
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  let a = W / H; if (a < 1) a = 1 / a;
  const mn = Math.round(n), mx = Math.round(n * a);
  return W > H ? [mx, mn] : [mn, mx];
}
function initFBOs(){
  const HF = gl.RGBA16F, F = gl.RGBA, T = gl.HALF_FLOAT, L = gl.LINEAR, N = gl.NEAREST;
  const [sw, sh] = gridRes(SIM), [dw, dh] = gridRes(DYE);
  const nd = dbl(dw, dh, HF, F, T, L);
  if (!nd.ok) { glOK = false; return; }
  if (dye) { const u = P.copy.use(); gl.uniform1i(u.uTexture, dye.read.bind(0)); blit(nd.read); free(dye); }
  dye = nd;
  free(velocity); free(divergence); free(curlF); free(pressure); free(paperF);
  velocity = dbl(sw, sh, HF, F, T, L);
  divergence = fbo(sw, sh, HF, F, T, N);
  curlF = fbo(sw, sh, HF, F, T, N);
  pressure = dbl(sw, sh, HF, F, T, N);
  paperF = fbo(canvas.width, canvas.height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, L);
  bakePaper();
}
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
  if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; initFBOs(); }
}
const aspect = () => canvas.width / canvas.height;

function cssColor(name){
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
const paperSeed = Math.random() * 50;
function readTheme(){
  theme.paper = cssColor('--fx-paper'); theme.paper2 = cssColor('--fx-paper-2');
  theme.ink = cssColor('--fx-ink'); theme.cin = cssColor('--fx-cinnabar');
  const L = theme.paper[0] * .3 + theme.paper[1] * .59 + theme.paper[2] * .11;
  theme.dark = L < .4 ? 1 : 0;
  if (paperF) bakePaper();
}
function bakePaper(){
  const u = P.paper.use();
  gl.uniform2f(u.res, canvas.width / dpr, canvas.height / dpr);
  gl.uniform3fv(u.paper, theme.paper); gl.uniform3fv(u.paper2, theme.paper2);
  gl.uniform1f(u.seed, paperSeed);
  blit(paperF);
}
readTheme();

/* ───────── splats ───────── */
const MAXS = 32, posA = new Float32Array(MAXS * 4), valA = new Float32Array(MAXS * 4), dirA = new Float32Array(MAXS * 4);
const dyeQ = [], velQ = [];
let hasInk = false;
const dab = (x, y, r, ink, cin, water, dry, hard = 0, dx = 1, dy = 0, seed = 0) =>
  ({ x, y, r2: r * r, hard, a: ink, c: cin, w: water, dry, dx, dy, seed });
const vsplat = (x, y, r2, fx, fy) => ({ x, y, r2, hard: 0, a: fx, c: fy, w: 0, dry: 0, dx: 1, dy: 0, seed: 0 });

function flush(q, target, lim){
  let i = 0;
  while (i < q.length) {
    const n = Math.min(MAXS, q.length - i);
    posA.fill(0); valA.fill(0); dirA.fill(0);
    for (let k = 0; k < n; k++) {
      const s = q[i + k], o = k * 4;
      posA[o] = s.x; posA[o+1] = s.y; posA[o+2] = Math.max(s.r2, 1e-7); posA[o+3] = s.hard;
      valA[o] = s.a; valA[o+1] = s.c; valA[o+2] = s.w; valA[o+3] = s.dry;
      dirA[o] = s.dx; dirA[o+1] = s.dy; dirA[o+2] = s.seed;
    }
    const u = P.splat.use();
    gl.uniform1i(u.uTarget, target.read.bind(0));
    gl.uniform1f(u.aspect, aspect()); gl.uniform1i(u.count, n);
    gl.uniform2f(u.res, target.w, target.h); gl.uniform1f(u.lim, lim);
    gl.uniform4fv(u.uPos, posA); gl.uniform4fv(u.uVal, valA); gl.uniform4fv(u.uDir, dirA);
    blit(target.write); target.swap();
    i += n;
  }
  q.length = 0;
}

/* One brush segment: gaussian stamps at even spacing, ink normalised by spacing. */
function brushSeg(x0, y0, x1, y1, st){
  const A = aspect();
  const dxh = (x1 - x0) * A, dyh = y1 - y0, len = Math.hypot(dxh, dyh);
  const rAvg = (st.r0 + st.r1) / 2, spacing = Math.max(rAvg * .45, .0012);
  const n = Math.max(1, Math.ceil(len / spacing)), step = len / n;
  const dx = len > 0 ? dxh / len : 1, dy = len > 0 ? dyh / len : 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n, r = st.r0 + (st.r1 - st.r0) * t;
    const amt = Math.min(1, Math.max(step, r * .3) / (r * 1.77));
    dyeQ.push(dab(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, st.ink * amt, st.cin * amt, st.water * amt, st.dry, st.hard || 0, dx, dy, st.seed));
  }
  if (st.force) velQ.push(vsplat(x1, y1, Math.pow(Math.max(rAvg * 3, .02), 2), dx * st.force, dy * st.force));
  if (st.ink > 0 || st.cin > 0) hasInk = true;
}

/* ───────── simulation ───────── */
let washing = false, washT = 0, washThen = null;
function step(dt){
  const vt = [1 / velocity.w, 1 / velocity.h];
  let u = P.curl.use(); gl.uniform2fv(u.texel, vt);
  gl.uniform1i(u.uVelocity, velocity.read.bind(0)); blit(curlF);

  u = P.vort.use(); gl.uniform2fv(u.texel, vt);
  gl.uniform1i(u.uVelocity, velocity.read.bind(0)); gl.uniform1i(u.uCurl, curlF.bind(1));
  gl.uniform1f(u.curl, 6); gl.uniform1f(u.dt, dt);
  blit(velocity.write); velocity.swap();

  u = P.div.use(); gl.uniform2fv(u.texel, vt);
  gl.uniform1i(u.uVelocity, velocity.read.bind(0)); blit(divergence);

  u = P.clear.use(); gl.uniform1i(u.uTexture, pressure.read.bind(0)); gl.uniform1f(u.value, .8);
  blit(pressure.write); pressure.swap();

  u = P.press.use(); gl.uniform2fv(u.texel, vt); gl.uniform1i(u.uDivergence, divergence.bind(0));
  for (let i = 0; i < ITER; i++) { gl.uniform1i(u.uPressure, pressure.read.bind(1)); blit(pressure.write); pressure.swap(); }

  u = P.grad.use(); gl.uniform2fv(u.texel, vt);
  gl.uniform1i(u.uPressure, pressure.read.bind(0)); gl.uniform1i(u.uVelocity, velocity.read.bind(1));
  blit(velocity.write); velocity.swap();

  u = P.advect.use(); gl.uniform2fv(u.vtexel, vt); gl.uniform1f(u.dt, dt);
  gl.uniform1i(u.uVelocity, velocity.read.bind(0)); gl.uniform1i(u.uSource, velocity.read.bind(0));
  gl.uniform1f(u.diss, Math.exp(-(washing ? .4 : 1.6) * dt)); gl.uniform1f(u.keepW, 0);
  blit(velocity.write); velocity.swap();

  gl.uniform1i(u.uVelocity, velocity.read.bind(0)); gl.uniform1i(u.uSource, dye.read.bind(1));
  gl.uniform1f(u.diss, washing ? Math.exp(-2.6 * dt) : 1); gl.uniform1f(u.keepW, washing ? 0 : 1);
  blit(dye.write); dye.swap();

  u = P.bleed.use(); gl.uniform2f(u.texel, 1 / dye.w, 1 / dye.h); gl.uniform2f(u.res, dye.w, dye.h);
  gl.uniform1f(u.rate, .75); gl.uniform1f(u.evap, .99); gl.uniform1f(u.fixRate, .05);
  for (let i = 0; i < 3; i++) { gl.uniform1i(u.uDye, dye.read.bind(0)); blit(dye.write); dye.swap(); }
}
function render(){
  const u = P.disp.use();
  gl.uniform1i(u.uDye, dye.read.bind(0)); gl.uniform1i(u.uPaper, paperF.bind(1));
  gl.uniform2f(u.dtex, 1 / dye.w, 1 / dye.h);
  gl.uniform3fv(u.ink, theme.ink); gl.uniform3fv(u.cin, theme.cin); gl.uniform1f(u.dark, theme.dark);
  blit(null);
}
function clearDye(){
  const u = P.clear.use(); gl.uniform1f(u.value, 0);
  gl.uniform1i(u.uTexture, dye.read.bind(0)); blit(dye.write); dye.swap();
}

/* Upstream's Karplus-Strong guqin (lines 548-655) is gone: a section dropped
   into someone's page must not make sound. The four entry points stay as
   no-ops so the brush, the ghost and the landscape call them unchanged. */
function ensureAudio(){}
function play(){}
function note(){}
function whoosh(){}

/* ───────── the invisible hand ───────── */
const ghost = { q: [], cur: null, wait: 0, on: false, speed: reduced ? 5 : 1 };
const paintBtn = $('paint');
function moveGhost(x, y, r){
  const s = Math.max(.5, (r || .005) * canvas.clientHeight * 2.2 / 14);
  ghostEl.style.transform = `translate(${x * canvas.clientWidth}px,${(1 - y) * canvas.clientHeight}px) scale(${s})`;
}
function prep(it){
  const A = aspect(), cum = [0];
  for (let i = 1; i < it.pts.length; i++) { const a = it.pts[i-1], b = it.pts[i]; cum.push(cum[i-1] + Math.hypot((b[0] - a[0]) * A, b[1] - a[1])); }
  return Object.assign({}, it, { cum, total: cum[cum.length - 1], s: 0, k: 0, acc: 0, prev: null });
}
function posAt(c, s){
  while (c.k < c.cum.length - 2 && c.cum[c.k + 1] < s) c.k++;
  const a = c.pts[c.k], b = c.pts[c.k + 1] || a, L = c.cum[c.k + 1] - c.cum[c.k];
  const t = L > 0 ? Math.min(1, (s - c.cum[c.k]) / L) : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
const taper = t => .3 + .7 * Math.min(1, t / .1) * Math.min(1, (1 - t) / .2 + .25);
function emitAlong(c, s0, s1){
  let s = s0, p = c.prev || posAt(c, s0);
  while (s < s1 - 1e-9) {
    const s2 = Math.min(s1, s + .008), q = posAt(c, s2), t0 = s / c.total, t1 = s2 / c.total;
    brushSeg(p[0], p[1], q[0], q[1], {
      r0: c.r * taper(t0), r1: c.r * taper(t1), ink: c.ink * (1 - c.fade * t1), cin: c.cin,
      water: c.water, dry: Math.min(.95, c.dry + c.dryGrow * t1), seed: c.seed, force: c.force, hard: c.hard
    });
    c.acc += s2 - s;
    if (c.acc >= c.note) { c.acc = 0; note(q[1], c.vel, q[0] * 2 - 1, c.kind); }
    p = q; s = s2;
  }
  c.prev = p; moveGhost(p[0], p[1], c.r);
}
function ghostTick(dt){
  if (!ghost.on) return;
  let budget = dt * ghost.speed, guard = 0;
  while (budget > 0 && guard++ < 400) {
    if (!ghost.cur) {
      if (ghost.wait > 0) { const w = Math.min(ghost.wait, budget); ghost.wait -= w; budget -= w; continue; }
      const it = ghost.q.shift();
      if (!it) { ghost.on = false; ghostEl.classList.remove('on'); setPaintBtn(false); return; }
      if (it.fn) { it.fn(); ghost.wait = it.after || 0; continue; }
      if (it.dot) {
        dyeQ.push(dab(it.x, it.y, it.r, it.ink, it.cin, it.water, 0, it.hard));
        hasInk = true; moveGhost(it.x, it.y, it.r);
        if (it.chime) { play(9, .7, .4, 'harm', true); setTimeout(() => play(11, .55, .5, 'harm', true), 420); }
        else if (Math.random() < .4) note(it.y, .35, it.x * 2 - 1);
        ghost.wait = it.after; continue;
      }
      ghost.cur = prep(it);
      if (ghost.cur.total <= 0) { ghost.cur = null; continue; }
    }
    const c = ghost.cur, need = (c.total - c.s) / c.speed, use = Math.min(need, budget);
    const s1 = Math.min(c.total, c.s + use * c.speed);
    emitAlong(c, c.s, s1); c.s = s1; budget -= use;
    if (c.s >= c.total - 1e-6) { ghost.cur = null; ghost.wait = c.after; }
  }
}

function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const POEMS = [
  ['一笔落空山', '云从墨里还', '无人知此意', '流水自潺潺'],
  ['青山不说话', '白水自东西', '一棹归何处', '云深鸟亦迷'],
  ['千峰藏一色', '万壑写无声', '偶落朱砂点', '人间日又生']
];

function buildLandscape(seed){
  const R = rng(seed), rr = (a, b) => a + (b - a) * R();
  const A = aspect(), portrait = A < .85;
  const yb = portrait ? .1 : .085, ys = portrait ? .88 : .9, M = y => yb + y * ys;
  const wx = A < 1 ? Math.min(1.6, .75 / A) : 1;
  const W = d => d / A;
  const Q = [];
  const S = (pts, o) => Q.push(Object.assign({ pts: pts.map(p => [p[0], M(p[1])]), speed: 1, r: .005, ink: 1, cin: 0, water: .3, dry: 0, dryGrow: 0, fade: 0, hard: 0, seed: rr(0, 900), force: 0, after: .08, note: .09, vel: .45, kind: 'pluck' }, o));
  const D = (x, y, o) => Q.push(Object.assign({ dot: true, x, y: M(y), r: .005, ink: 1, cin: 0, water: .4, hard: 0, after: .03 }, o));
  const F = (fn, after = 0) => Q.push({ fn, after });
  const wave = () => { const k = [rr(0, 6.28), rr(0, 6.28), rr(0, 6.28)]; return x => Math.sin(x * 23 + k[0]) * .5 + Math.sin(x * 57 + k[1]) * .3 + Math.sin(x * 131 + k[2]) * .2; };
  const range = (peaks, base, nAmp) => { const n = wave(); return x => { let h = 0; for (const p of peaks) { const u = Math.abs(x - p.c) / (p.w * wx); h = Math.max(h, p.h * Math.exp(-Math.pow(u, 1.5))); } return base + h + nAmp * n(x) * Math.min(1, h / .05); }; };
  const runs = (f, base, x0, x1, dx, th) => {
    const out = []; let cur = null;
    for (let x = x0; x <= x1 + 1e-9; x += dx) { const y = f(x); if (y - base > th) { if (!cur) { cur = []; out.push(cur); } cur.push([x, y]); } else cur = null; }
    return out.filter(r => r.length > 2);
  };
  const pick = a => a[Math.floor(R() * a.length)];

  function mountain(f, base, o){
    const rs = runs(f, base, o.x0, o.x1, .006, .012); if (!rs.length) return;
    for (const run of rs) S(run, { r: .0042 * o.s, ink: 1.05 * o.ink, water: .25, dry: .05, dryGrow: .5, fade: .35, speed: .5, note: .085, vel: .5 });
    const pk = [];
    for (const run of rs) for (let i = 2; i < run.length - 2; i++) if (run[i][1] > run[i-1][1] && run[i][1] >= run[i+1][1] && run[i][1] - base > .06) pk.push(run[i]);
    for (const p of pk.slice(0, o.folds)) {
      const side = R() < .5 ? -1 : 1, len = (p[1] - base) * rr(.45, .75), pts = [];
      let x = p[0], y = p[1] - .004;
      for (let i = 0; i <= 8; i++) { pts.push([x, y]); y -= len / 8; x += W(side * rr(.002, .009)); }
      S(pts, { r: .0036 * o.s, ink: .8 * o.ink, water: .2, dry: .25, dryGrow: .5, fade: .5, speed: .7, note: .1, after: .05 });
    }
    for (let i = 0; i < o.cun; i++) {
      const run = pick(rs), q = run[Math.floor(rr(.05, .95) * run.length)], top = q[1];
      const y = top - rr(.008, Math.max(.012, (top - base) * .6)), x = q[0];
      const slope = (f(x + .005) - f(x - .005)) / .01, side = slope > 0 ? -1 : 1, L = rr(.02, .045);
      const pts = [[x, y]];
      for (let k = 1; k <= 3; k++) pts.push([x + W(side * L * k / 3 * .55 + rr(-.002, .002)), y - L * k / 3]);
      S(pts, { r: .0026 * o.s, ink: .6 * o.ink, water: .12, dry: .45, dryGrow: .3, speed: 1.3, note: .06, after: .015, vel: .35 });
    }
    for (let j = 0; j < 7; j++) {
      const off = .008 + j * .018, ij = .2 * o.ink * (1 - j / 7.5);
      for (const run of runs(x => f(x) - off, base, o.x0, o.x1, .02, .006))
        S(run.map(p => [p[0], p[1]]), { r: .02, ink: ij, water: .8, speed: 2.8, note: .3, after: .02, vel: .25 });
    }
    for (let i = 0; i < o.moss; i++) {
      const run = pick(rs), q = run[Math.floor(rr(.1, .9) * run.length)];
      D(q[0] + W(rr(-.004, .004)), q[1] + rr(-.002, .006), { r: rr(.003, .0055) * o.s, ink: rr(.9, 1.4) * o.ink, water: .3, after: .05 });
    }
  }
  function tree(x, y, h, ink){
    const ph = rr(0, 6.28), sw = rr(.004, .01), trunk = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; trunk.push([x + W(Math.sin(t * 3 + ph) * sw * t), y + h * t]); }
    S(trunk, { r: .0048, ink: 1.1 * ink, water: .2, dry: .2, dryGrow: .5, fade: .3, speed: .55, note: .07, vel: .5 });
    const tips = [trunk[12]], nb = Math.floor(rr(3, 6));
    for (let b = 0; b < nb; b++) {
      const t = rr(.45, .92), p = trunk[Math.round(t * 12)], side = b % 2 ? 1 : -1, L = rr(.03, .06) * (1.2 - t), pts = [[p[0], p[1]]];
      for (let s = 1; s <= 4; s++) pts.push([p[0] + W(side * L * s / 4), p[1] + L * s / 4 * rr(.1, .45)]);
      S(pts, { r: .0024, ink: ink, water: .15, dry: .2, speed: .7, note: .06, after: .03 });
      tips.push(pts[4]);
    }
    for (const tp of tips) {
      const n = Math.floor(rr(6, 10));
      for (let d = 0; d < n; d++) { const a = rr(0, 6.28), rad = rr(.004, .02); D(tp[0] + W(Math.cos(a) * rad * 1.3), tp[1] + Math.sin(a) * rad * .7, { r: rr(.004, .0068), ink: rr(.6, 1.2) * ink, water: .55, after: .025 }); }
    }
  }

  // 远山 far range, pale ink
  const farBase = rr(.36, .4), farPeaks = [];
  for (let i = 0; i < 5; i++) farPeaks.push({ c: rr(-.05, 1.05), h: rr(.06, .15), w: rr(.07, .14) });
  const far = range(farPeaks, farBase, .006);
  for (const run of runs(far, farBase, 0, 1, .008, .008)) S(run, { r: .0045, ink: .22, water: .8, speed: .9, note: .14, vel: .35 });
  for (let j = 0; j < 5; j++) {
    const off = .01 + j * .02, ij = .12 * (1 - j / 5.5);
    for (const run of runs(x => far(x) - off, farBase, 0, 1, .02, .004)) S(run, { r: .022, ink: ij, water: .75, speed: 3, note: .3, after: .02, vel: .22 });
  }
  // 主峰 main peak
  const c0 = rr(.3, .4), mBase = rr(.29, .32);
  const main = range([{ c: c0, h: rr(.38, .44), w: rr(.09, .12) }, { c: c0 + rr(.08, .12) * wx, h: rr(.2, .27), w: rr(.06, .08) }, { c: c0 - rr(.09, .13) * wx, h: rr(.15, .22), w: rr(.06, .09) }], mBase, .012);
  mountain(main, mBase, { ink: 1, s: 1, cun: 26, moss: 14, folds: 5, x0: 0, x1: .78 });
  // 次峰 second peak
  const c1 = rr(.68, .78), sBase = .27;
  const second = range([{ c: c1, h: rr(.2, .26), w: rr(.07, .09) }, { c: c1 + rr(.07, .1) * wx, h: rr(.1, .14), w: .06 }], sBase, .01);
  mountain(second, sBase, { ink: .7, s: .9, cun: 14, moss: 8, folds: 3, x0: .45, x1: 1 });
  // 近岸 near bank
  const bank = range([{ c: rr(.08, .16), h: rr(.07, .1), w: rr(.12, .18) }, { c: rr(.28, .34), h: rr(.03, .05), w: .06 }], .08, .006);
  mountain(bank, .08, { ink: 1, s: 1.1, cun: 10, moss: 6, folds: 2, x0: 0, x1: .46 });
  // 树 trees
  const tx0 = rr(.05, .08), gap = rr(.055, .075) * Math.min(wx, 1.3);
  for (let i = 0; i < 3; i++) { const tx = tx0 + i * gap + rr(-.01, .01); tree(tx, bank(tx) - .004, rr(.15, .24), i === 1 ? .55 : 1); }
  // 水 ripples
  for (let i = 0; i < 6; i++) {
    const y = rr(.09, .25), xa = rr(.38, .55), xb = Math.min(xa + rr(.15, .4), .98), ph = rr(0, 6), pts = [];
    for (let x = xa; x <= xb; x += .01) pts.push([x, y + Math.sin(x * 60 + ph) * .002]);
    S(pts, { r: .0019, ink: .5, water: .1, dry: .5, dryGrow: .3, fade: .6, speed: 1.4, note: .11, after: .05, vel: .35 });
  }
  // 舟 boat and fisherman
  const bx = rr(.55, .64), by = rr(.16, .2);
  S([[bx - W(.04), by + .009], [bx - W(.022), by + .001], [bx, by - .001], [bx + W(.022), by + .001], [bx + W(.045), by + .011]], { r: .0034, ink: 1.2, water: .2, speed: .3, note: .05 });
  D(bx + W(.004), by + .016, { r: .0045, ink: 1.3, water: .2, after: .15 });
  S([[bx - W(.008), by + .023], [bx + W(.004), by + .029], [bx + W(.016), by + .023]], { r: .002, ink: 1.1, speed: .3 });
  S([[bx + W(.014), by + .045], [bx + W(.05), by - .022]], { r: .0016, ink: .9, dry: .3, speed: .5 });
  S([[bx - W(.055), by - .007], [bx + W(.06), by - .008]], { r: .0015, ink: .35, dry: .4, speed: 1 });
  // 鸟 birds
  const sunX = portrait ? rr(.55, .64) : rr(.66, .8), sunY = portrait ? rr(.78, .82) : rr(.76, .84);
  const bbx = portrait ? rr(.66, .7) : rr(.5, .6), bby = portrait ? rr(.64, .68) : rr(.8, .86);
  for (let i = 0; i < 3; i++) {
    const x = bbx + W(i * .03 + rr(-.006, .006)), y = bby + (i % 2) * .012 + rr(-.004, .004), s = rr(.8, 1.2);
    S([[x - W(.014 * s), y + .005 * s], [x - W(.007 * s), y + .004 * s], [x, y - .002 * s], [x + W(.006 * s), y + .004 * s], [x + W(.013 * s), y + .007 * s]], { r: .0017, ink: 1.2, water: .1, speed: .35, note: .03, after: .12, vel: .3, kind: 'harm' });
  }
  // 日 a dot of cinnabar
  D(sunX, sunY, { r: .042, ink: 0, cin: 1.25, water: .15, hard: 1, after: .9, chime: true });
  // 题诗 and 钤印
  const pi = Math.floor(R() * POEMS.length);
  F(() => showPoem(pi), 3.6);
  F(() => stampSeal(), .4);
  return Q;
}

/* ───────── poem & seal ───────── */
/* Upstream's poem and seal (lines 841-861) set four lines of verse in a
   brush face fetched from Google Fonts and stamp a seal over the painting. The
   section carries its own copy instead, so both are no-ops. */
function hidePoem(){}
function showPoem(){}
function stampSeal(){}

/* ───────── controls ───────── */
let seedCounter = o.seed > 0 ? Math.floor(o.seed) : (Math.random() * 1e9) | 0;
function setPaintBtn(on){ paintBtn.textContent = on ? '停笔' : '落笔山水'; }
function stopPainting(){ ghost.on = false; ghost.q = []; ghost.cur = null; ghostEl.classList.remove('on'); setPaintBtn(false); }
function startPainting(){
  const go = () => { ghost.q = buildLandscape(seedCounter++); ghost.cur = null; ghost.wait = .2; ghost.on = true; ghostEl.classList.add('on'); setPaintBtn(true); };
  if (hasInk) wash(go); else { hidePoem(); go(); }
}
function wash(then){
  stopPainting(); hidePoem();
  washing = true; washT = 0; washThen = then || null; whoosh();
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * 6.28;
    velQ.push(vsplat(Math.random(), Math.random(), .02, Math.cos(a) * 600, Math.sin(a) * 600));
    dyeQ.push(dab(Math.random(), Math.random(), .15, 0, 0, .8, 0));
  }
}
function washTick(dt){
  washT += dt;
  if (washT < .9 && Math.random() < .35) { const a = Math.random() * 6.28; velQ.push(vsplat(Math.random(), Math.random(), .012, Math.cos(a) * 400, Math.sin(a) * 400)); }
  if (washT > 1.9) { clearDye(); washing = false; hasInk = false; const t = washThen; washThen = null; if (t) t(); }
}

let tool = TOOL(o.tool);
const sheet = $('sheet'), aboutBtn = $('about');

/* ───────── pointer brush ───────── */
const pointers = new Map();
let hinted = false;
function toUV(e){ const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; }
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  ensureAudio();
  if (!hinted) { hinted = true; hintEl.classList.add('gone'); }
  if (!sheet.hidden) { sheet.hidden = true; aboutBtn.setAttribute('aria-expanded', 'false'); }
  const [x, y] = toUV(e);
  const s = { x, y, t: e.timeStamp || performance.now(), v: 0, load: 1, acc: 0, seed: Math.random() * 900, pen: e.pointerType === 'pen', r: null };
  pointers.set(e.pointerId, s);
  if (tool === 'water') { dyeQ.push(dab(x, y, .03, 0, 0, .5, 0)); }
  else { dyeQ.push(dab(x, y, .014, tool === 'ink' ? .55 : 0, tool === 'cinnabar' ? .6 : 0, .9, 0)); hasInk = true; }
  note(y, .45, x * 2 - 1, tool === 'ink' ? 'pluck' : 'harm');
});
function moveTo(s, ev){
  const [x, y] = toUV(ev), A = aspect();
  const len = Math.hypot((x - s.x) * A, y - s.y); if (len < .0008) return;
  const now = ev.timeStamp || performance.now(), dtm = Math.max(4, now - s.t) / 1000; s.t = now;
  s.v = s.v * .75 + (len / dtm) * .25;
  if (tool === 'water') {
    brushSeg(s.x, s.y, x, y, { r0: .03, r1: .03, ink: 0, cin: 0, water: .7, dry: 0, seed: s.seed, force: Math.min(s.v * velocity.h * 1.2, 1200) });
    s.acc += len; if (s.acc > .16) { s.acc = 0; note(y, .25, x * 2 - 1, 'harm'); }
  } else {
    const k = Math.min(1, s.v / 2.2), pr = s.pen ? (ev.pressure || .5) : .5;
    const r = .013 * (1 - .62 * k) * (s.pen ? .4 + pr * 1.3 : 1);
    s.load = Math.max(0, s.load - len * .75);
    const dry = Math.min(.95, Math.max(0, (.5 - s.load) / .5) * .8 + k * .35), amt = .35 + .75 * s.load;
    brushSeg(s.x, s.y, x, y, { r0: s.r ?? r, r1: r, ink: tool === 'ink' ? amt : 0, cin: tool === 'cinnabar' ? amt * .9 : 0, water: .3 + .4 * s.load * (1 - k), dry, seed: s.seed, force: Math.min(s.v, 3) * 3 });
    s.r = r;
    s.acc += len; if (s.acc > .075) { s.acc = 0; note(y, .3 + .45 * k, x * 2 - 1, tool === 'cinnabar' ? 'harm' : 'pluck'); }
  }
  s.x = x; s.y = y;
}
canvas.addEventListener('pointermove', e => {
  const s = pointers.get(e.pointerId); if (!s) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for (const ev of (evs.length ? evs : [e])) moveTo(s, ev);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => canvas.addEventListener(t, e => pointers.delete(e.pointerId)));

  /* ------------------------------------------------------------------
   * paw-fx seams: visibility and the loop. Upstream's frame() and its
   * three requestAnimationFrame calls are kept below verbatim; the local
   * requestAnimationFrame here shadows the global so every one of them
   * routes through pulso(), which is where pausing off screen,
   * data-fx-live and a cancellable handle live.
   * ------------------------------------------------------------------ */
  var visivel = true, raf = 0, vivo = false, loopFn = null;
  function requestAnimationFrame(fn) {
    loopFn = fn;
    if (visivel && !raf) raf = window.requestAnimationFrame(pulso);
    return raf;
  }
  function pulso(now) {
    raf = 0;
    var fn = loopFn; loopFn = null;
    if (fn) fn(now);
    // only once a frame is on the canvas, so the CSS rest never fades out
    // from under an empty one
    if (!vivo) { vivo = true; el.setAttribute('data-fx-live', ''); }
  }
  // The solver runs 30-odd full-screen passes a frame, so it stops while
  // nobody can see it. Starts true, so a browser that never delivers a
  // callback still runs.
  var io = new IntersectionObserver(function (es) {
    visivel = es[es.length - 1].isIntersecting;
    if (visivel && loopFn && !raf) raf = window.requestAnimationFrame(pulso);
  });
  io.observe(el);

/* ───────── loop ───────── */
const readout = $('readout'), corner = $('corner');
let last = performance.now(), fps = 60, tick = 0;
resize();
if (!glOK) { fallback('这台设备的显卡不支持半精度浮点渲染，墨化不开。换用新版 Chrome、Safari 或 Edge 打开即可。'); return; }
function frame(now){
  const raw = Math.max(1e-3, (now - last) / 1000), dt = Math.min(raw, 1 / 30); last = now;
  fps = fps * .95 + (1 / raw) * .05;
  resize();
  ghostTick(dt);
  if (washing) washTick(dt);
  if (velQ.length) flush(velQ, velocity, 3000);
  if (dyeQ.length) flush(dyeQ, dye, 4);
  step(dt); render();
  if (++tick % 20 === 0) {
    const txt = `Navier–Stokes ${velocity.w}×${velocity.h} · 墨层 ${dye.w}×${dye.h} · Jacobi ×${ITER} · ${Math.round(fps)} fps`;
    corner.textContent = txt; if (!sheet.hidden) readout.textContent = txt;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
var t0 = o.autopaint === false ? 0 : setTimeout(startPainting, 700);

  return {
    update: function (next) {
      next = next || {};
      Object.assign(o, next);
      tool = TOOL(o.tool);
      if ('seed' in next && o.seed > 0) { seedCounter = Math.floor(o.seed); startPainting(); }
      else if ('autopaint' in next) { if (o.autopaint === false) stopPainting(); else if (!ghost.on) startPainting(); }
    },
    destroy: function () {
      visivel = false;
      window.cancelAnimationFrame(raf); raf = 0; loopFn = null;
      clearTimeout(t0);
      io.disconnect();
      var perda = gl.getExtension('WEBGL_lose_context');
      if (perda) perda.loseContext();
      canvas.remove(); ghostDom.remove();
      el.removeAttribute('data-fx-live');
    }
  };
  }
}

export const meta = {
  name: "ink-wash",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    autopaint: { type: "boolean", default: true, description: "Whether the invisible hand starts painting a landscape 700 ms after mount (upstream's own delay). Off leaves a blank sheet for the visitor to paint on. Switching it on live starts a painting; switching it off stops the hand mid-stroke and leaves what it has painted." },
    tool: { type: "string", default: "ink", description: "What the visitor's brush carries: ink (upstream's default), cinnabar (the red of the sun and seal) or water, a clear brush that stirs the ink already on the sheet. Upstream's three-button toolbar, as one option. Anything else reads as ink." },
    seed: { type: "number", default: 0, min: 0, max: 900, step: 1, description: "Which landscape the hand paints. 0 is a fresh random painting on every mount, as upstream does; any positive whole number paints that same landscape every time. Changing it live washes the sheet and paints the new one." },
  },
};
