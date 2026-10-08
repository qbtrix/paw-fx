// ephemera -- https://github.com/majiayu000/ephemera
//
// MIT License
// Copyright (c) 2026 majiayu000
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
// stardust: a port of majiayu000/ephemera at commit
// 8322873e1b94245debaa39bf9448a5187c434a97, stardust.html (百万星尘, "a
// million grains of stardust") and the shared/glkit.js runtime it loads.
// A million GPU points with no vertex attributes: each point hashes its own
// gl_VertexID into a place on two shapes (a four-arm spiral galaxy, a banded
// sphere, a trefoil knot, a line of text) and bursts and regathers between
// them on a staggered clock. The pointer pushes points aside, a tap morphs to
// the next shape, a drag turns the whole thing.
//
// Upstream's VS and FS strings and textTexture() are verbatim. glkit.js's
// methods sit inside inicia() as a local `glkit` object, so every call site
// in the page script stays as upstream wrote it; the seams (sized from the
// section, pointer normalised by the section, fail() throws, N and TEXT from
// options) are listed in meta.json.deviations.

const DEFAULTS = { count: 1 << 20, text: '炫酷' };
// The text texture is 1024 wide (textTexture's W), so a count must fill whole
// rows of it; upstream's own N is the ceiling.
const count0 = (v) => {
  const n = Math.round(+v / 1024) * 1024;
  return n >= 1 << 16 && n <= 1 << 20 ? n : DEFAULTS.count;
};
const text0 = (v) => (typeof v === 'string' && v.trim() ? v : DEFAULTS.text);

export function mount(el, opts = {}) {
  var resting = { update: function () {}, destroy: function () {} };
  if (!el || typeof document === 'undefined') return resting;
  // Upstream has no reduced-motion path, and every shape is always either
  // spinning or mid-burst, so under reduced motion the section keeps its CSS
  // rest.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return resting;

  var o = Object.assign({}, DEFAULTS, opts);
  var cv = document.createElement('canvas');
  cv.className = 'fx-stardust__canvas';
  cv.setAttribute('aria-hidden', 'true');
  var undo = [];
  var raf = 0;

  try {
    return inicia();
  } catch (err) {
    teardown();
    return resting;
  }

  function teardown() {
    cancelAnimationFrame(raf); raf = 0;
    undo.forEach(function (f) { f(); });
    undo = [];
    var gl = cv.getContext('webgl2');
    var perda = gl && gl.getExtension('WEBGL_lose_context');
    if (perda) perda.loseContext();
    cv.remove();
    el.removeAttribute('data-fx-live');
  }

  function inicia() {
// ---- shared/glkit.js, as a local object ----------------------------------
const glkit = {
  // paw-fx: throws, so every failure lands in mount()'s catch and the
  // section returns to its CSS rest; upstream painted a <pre> over the page.
  fail(msg) {
    throw new Error(msg);
  },

  // scale：相对设备像素比的渲染倍率，重着色器可调低
  context(canvas, scale = 1) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, failIfMajorPerformanceCaveat: true });
    if (!gl) this.fail('当前浏览器不支持 WebGL2');
    const resize = () => {
      const d = Math.min(2, devicePixelRatio || 1) * scale;
      canvas.width = Math.max(1, el.clientWidth * d | 0);
      canvas.height = Math.max(1, el.clientHeight * d | 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    undo.push(() => ro.disconnect());
    resize();
    return gl;
  },

  program(gl, vsSrc, fsSrc) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) this.fail(`着色器编译失败：\n${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) this.fail(`着色器链接失败：\n${gl.getProgramInfoLog(p)}`);
    gl.useProgram(p);
    return p;
  },

  uniforms(gl, prog, names) {
    return Object.fromEntries(names.map(n => [n, gl.getUniformLocation(prog, n)]));
  },

  // 拖拽累计偏移（x、y 以屏幕宽高归一化），带惯性衰减
  // paw-fx: normalised by the section, listeners removable on destroy.
  drag(el2) {
    const s = { x: 0, y: 0, vx: 0, vy: 0, down: false, px: 0, py: 0 };
    const down = e => { s.down = true; s.px = e.clientX; s.py = e.clientY; };
    const up = () => { s.down = false; };
    const move = e => {
      if (!s.down) return;
      s.vx = (e.clientX - s.px) / el.clientWidth;
      s.vy = (e.clientY - s.py) / el.clientHeight;
      s.x += s.vx; s.y += s.vy;
      s.px = e.clientX; s.py = e.clientY;
    };
    el2.addEventListener('pointerdown', down);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    addEventListener('pointermove', move);
    undo.push(() => {
      el2.removeEventListener('pointerdown', down);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      removeEventListener('pointermove', move);
    });
    s.step = () => { if (!s.down) { s.x += s.vx; s.y += s.vy; s.vx *= .94; s.vy *= .94; } };
    return s;
  },
};

// ---- stardust.html, page script -----------------------------------------
// 无顶点属性：每颗粒子用 gl_VertexID 在着色器里算出两种形状的位置，再按各自的错峰进度爆散、重聚
// paw-fx: N and TEXT come from the count and text options (upstream's
// constants are the defaults); let, so update() can rebuild the text shape.
let N = count0(o.count), TEXT = text0(o.text);
const SHAPES = 4, HOLD = 6.5, MORPH = 3.2;

const VS = `#version 300 es
precision highp float;
uniform float T, K, SA, SB, ASP; uniform vec2 M, ROT; uniform sampler2D TX;
out vec3 vc; out float va;
float h(uint x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;x^=x>>16;return float(x)/4294967295.;}
vec3 pal(float t){return .55+.45*cos(6.2832*(t+vec3(0.,.33,.67)));}
vec3 shape(float s,int id,float u,float v,float w,float z){
  if(s<.5){                       // 四臂旋涡星系 + 明亮星系核
    if(z<.16){float r=.38*pow(w,1.6), a=u*6.2832; return vec3(cos(a)*r,(v-.5)*.28*(.4-r),sin(a)*r);}
    float r=pow(u,.55)*1.5, a=floor(w*4.)*1.5708+r*3.4+(v-.5)*.7/(r+.25);
    return vec3(cos(a)*r,(z-.5)*.1*(1.6-r),sin(a)*r);
  }
  if(s<1.5){                      // 带经纬光带的球
    float y=u*2.-1., a=v*6.2832, rr=sqrt(1.-y*y), band=.03*sin(y*40.+a*3.);
    return vec3(cos(a)*rr,y,sin(a)*rr)*(1.05+band);
  }
  if(s<2.5){                      // 三叶结
    float t=u*6.2832, r=.62+.28*cos(3.*t), a=v*6.2832;
    return vec3(r*cos(2.*t),.35*sin(3.*t),r*sin(2.*t))+.07*sqrt(w)*vec3(cos(a),sin(a),cos(a+2.1));
  }
  ivec2 ts=textureSize(TX,0);   // 文字
  return texelFetch(TX,ivec2(id%ts.x,id/ts.x),0).xyz;
}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
void main(){
  int id=gl_VertexID; uint k=uint(id)*8u;
  float u=h(k), v=h(k+1u), w=h(k+2u), z=h(k+3u);
  float e=smoothstep(0.,1.,clamp(K*1.7-w*.7,0.,1.));
  vec3 a=shape(SA,id,u,v,w,z), b=shape(SB,id,u,v,w,z);
  vec3 dir=normalize(vec3(h(k+4u),h(k+5u),h(k+6u))-.5);
  float sw=sin(3.1416*e);
  vec3 p=rotY(sw*(2.5+w*3.))*mix(a,b,e)*(1.+sw*.35)+dir*sw*(.12+w*.3);
  p+=.015*vec3(sin(T*1.3+u*60.),cos(T*1.1+v*60.),sin(T*.9+w*60.));
  float spin=(SB>2.5&&e>.5)?.25*sin(T*.4):T*.12;
  p=rotX(ROT.y+.35*(1.-step(2.5,SB)*e))*rotY(spin+ROT.x)*p;
  vec3 q=p; q.z-=3.2;
  vec4 clip=vec4(q.x*1.9/ASP,q.y*1.9,0.,-q.z);
  vec2 sp=clip.xy/clip.w, d=sp-M; float md=length(d*vec2(ASP,1.));
  sp+=normalize(d+1e-5)*.12*exp(-md*md*40.);
  gl_Position=vec4(sp*clip.w,0.,clip.w);
  gl_PointSize=clamp(3.6/-q.z,1.,3.);
  vec3 m=mix(a,b,e);
  vc=mix(pal(u*.35+T*.03+(SB+e)*.17),vec3(1.,.82,.55),exp(-dot(m,m)*9.))*(1.+.8*exp(-md*md*30.));
  va=.4+.3*sin(3.1416*e);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vc; in float va; out vec4 o;
void main(){
  float d=length(gl_PointCoord-.5), a=va*smoothstep(.5,0.,d);
  o=vec4(vc*a,1.);
}`;

// 把文字画进 2D 画布，采样出像素位置，作为每颗粒子的“文字形状”坐标
function textTexture(gl) {
  const cw = 900, ch = 360, c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.font = `900 ${ch * .78}px "PingFang SC","Heiti SC",sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(TEXT, cw / 2, ch / 2);
  const img = x.getImageData(0, 0, cw, ch).data, pts = [];
  for (let py = 0; py < ch; py += 2) for (let px = 0; px < cw; px += 2) if (img[(py * cw + px) * 4 + 3] > 128) pts.push(px, py);
  if (!pts.length) glkit.fail('文字采样为空：系统缺少可用字体');
  const W = 1024, data = new Float32Array(N * 4), s = 2.6 / cw;
  for (let i = 0; i < N; i++) {
    const k = (Math.random() * pts.length / 2 | 0) * 2;
    data[i * 4] = (pts[k] + Math.random() * 2 - cw / 2) * s;
    data[i * 4 + 1] = -(pts[k + 1] + Math.random() * 2 - ch / 2) * s;
    data[i * 4 + 2] = (Math.random() - .5) * .06;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, N / W, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return tex;
}

const gl = glkit.context(cv, 1);
const prog = glkit.program(gl, VS, FS);
const U = glkit.uniforms(gl, prog, ['T', 'K', 'SA', 'SB', 'ASP', 'M', 'ROT', 'TX']);
let tex = textTexture(gl);
gl.uniform1i(U.TX, 0);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE);
const drag = glkit.drag(cv);
let from = 0, to = 0, t0 = -MORPH, mouse = [9, 9], moved = 0, downAt = null;

const next = now => { from = to; to = (to + 1) % SHAPES; t0 = now; };
const press = e => { downAt = [e.clientX, e.clientY]; };
const release = e => {
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) next(performance.now() / 1000);
  downAt = null;
};
// paw-fx: normalised by the section's box, not the window.
const hover = e => { const b = el.getBoundingClientRect(); mouse = [(e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2]; moved = performance.now(); };
cv.addEventListener('pointerdown', press);
cv.addEventListener('pointerup', release);
addEventListener('pointermove', hover);
undo.push(() => {
  cv.removeEventListener('pointerdown', press);
  cv.removeEventListener('pointerup', release);
  removeEventListener('pointermove', hover);
});

// paw-fx: shadows the global so upstream's frame() runs unchanged through
// pulso(), which pauses off screen and holds a cancellable handle.
function requestAnimationFrame(cb) { loop = cb; }

function frame(ms) {
  requestAnimationFrame(frame);
  const now = ms / 1000;
  if (now - t0 > MORPH + HOLD) next(now);
  drag.step();
  const m = ms - moved < 2500 ? mouse : [9, 9];
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(U.T, now);
  gl.uniform1f(U.K, Math.min(1, (now - t0) / MORPH));
  gl.uniform1f(U.SA, from);
  gl.uniform1f(U.SB, to);
  gl.uniform1f(U.ASP, cv.width / cv.height);
  gl.uniform2f(U.M, m[0], m[1]);
  gl.uniform2f(U.ROT, drag.x * 4, drag.y * 3);
  gl.drawArrays(gl.POINTS, 0, N);
}

// ---- paw-fx seams: visibility, the loop, the handle ---------------------
let loop = frame, visible = true, live = false;
const pulso = (now) => {
  raf = 0;
  if (!visible) return;
  loop(now);
  if (!live) { live = true; el.setAttribute('data-fx-live', ''); }
  raf = window.requestAnimationFrame(pulso);
};
const io = new IntersectionObserver((es) => {
  visible = es[es.length - 1].isIntersecting;
  if (visible && !raf) raf = window.requestAnimationFrame(pulso);
});
io.observe(el);
undo.push(() => io.disconnect());
const lost = (e) => { e.preventDefault(); teardown(); };
cv.addEventListener('webglcontextlost', lost);

el.insertBefore(cv, el.firstChild);
raf = window.requestAnimationFrame(pulso);

return {
  update(nextOpts) {
    Object.assign(o, nextOpts || {});
    const n = count0(o.count), t = text0(o.text);
    if (n === N && t === TEXT) return;
    // A new count or word means a new text shape. Swap it in only once it
    // samples; a word the fonts cannot draw keeps the shape already there.
    const was = [N, TEXT];
    N = n; TEXT = t;
    try {
      const fresh = textTexture(gl);
      gl.deleteTexture(tex);
      tex = fresh;
    } catch (err) {
      [N, TEXT] = was;
    }
  },
  destroy() {
    visible = false;
    cv.removeEventListener('webglcontextlost', lost);
    teardown();
  },
};
  }
}

export const meta = {
  name: "stardust",
  version: "1.0.0",
  category: "particles",
  needs: [],
  license: "MIT",
  options: {
    count: { type: "number", default: 1048576, min: 65536, max: 1048576, step: 65536, description: "How many points are drawn (upstream's N, 1 << 20). Rounded to whole rows of the 1024-wide text texture and clamped to 65536..1048576. Lower it for phones: every point is a vertex-shader run and an additive blend, every frame." },
    text: { type: "string", default: "炫酷", description: "The word the fourth shape spells (upstream's TEXT, 炫酷, \"dazzling\"). Drawn in \"PingFang SC\", \"Heiti SC\", then the system sans-serif, so a machine with no CJK font draws boxes for the default; pass a Latin word for a site without one. A word no font can draw keeps the previous shape." },
  },
};
