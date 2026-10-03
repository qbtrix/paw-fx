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
// event-horizon: a port of majiayu000/ephemera at commit
// 8322873e1b94245debaa39bf9448a5187c434a97, black-hole.html (Event Horizon)
// and the shared/glkit.js runtime it loads. A Schwarzschild black hole, ray
// traced per pixel: every ray is bent by the photon-geodesic approximation
// a = -1.5·h²·r/|r|⁵ (units of the Schwarzschild radius), and each time it
// crosses the equatorial plane it picks up light from an accretion disk that
// turns at Keplerian speed, is Doppler-beamed and blue-shifted on the side
// coming toward you, and runs hot inside and cool outside. Behind it, a
// starfield and a faint nebula are lensed into an Einstein ring. Drag orbits.
//
// Upstream's fragment shader (black-hole.html lines 20-79) is the FS string
// below, verbatim. glkit.js's methods sit inside inicia() as a local `glkit`
// object, so every glkit.context / program / uniforms / drag call site in the
// page script stays as upstream wrote it; the three seams inside glkit (sized
// from the section, drag normalised by the section, fail() throws instead of
// writing into document.body) are listed in meta.json.deviations. The wheel
// zoom (line 87) is dropped: in a section the wheel scrolls the page, so the
// distance is an option instead, defaulting to upstream's 26.

const DEFAULTS = { distance: 26 };
// Upstream's own wheel clamp (black-hole.html line 87): closer than 9 the
// camera sits inside the disk, further than 60 the hole is a speck.
const dist0 = (v) => (v >= 9 && v <= 60 ? +v : DEFAULTS.distance);

export function mount(el, opts = {}) {
  var resting = { update: function () {}, destroy: function () {} };
  if (!el || typeof document === 'undefined') return resting;
  // Upstream has no reduced-motion path, and the disk only reads as a disk
  // while it turns, so under reduced motion the section keeps its CSS rest.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return resting;

  var o = Object.assign({}, DEFAULTS, opts);
  var cv = document.createElement('canvas');
  cv.className = 'fx-horizon__canvas';
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
  FULLSCREEN_VS: `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,

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

// ---- black-hole.html, page script --------------------------------------
// 光线追踪史瓦西黑洞：每条光线按光子测地线近似积分 a = -1.5·h²·r/|r|⁵（单位：史瓦西半径 = 1）
// 穿过赤道面时累加吸积盘辐射：开普勒转速、多普勒增亮与蓝移、内热外冷
const FS = `#version 300 es
precision highp float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float D;
out vec4 o;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}

vec3 sky(vec3 d){
  vec3 c=vec3(0);
  for(float s=0.;s<3.;s++){
    vec3 q=d*(90.+s*70.), id=floor(q), f=fract(q)-.5;
    float h=fract(sin(dot(id,vec3(12.9,78.2,37.7)))*43758.5);
    if(h>.975) c+=smoothstep(.2,0.,length(f))*mix(vec3(1.,.75,.55),vec3(.6,.8,1.),fract(h*37.))*(h-.975)*70.;
  }
  float n=fbm(d.xy*2.2+d.z*1.3);
  c+=vec3(.35,.12,.5)*pow(n,3.5)*.9+vec3(.05,.15,.3)*pow(fbm(d.yz*3.+4.),4.)*1.2;
  return c;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  float yaw=T*.03+M.x*3.14, pit=clamp(.12-M.y*2.,-1.45,1.45);
  vec3 ro=D*vec3(cos(pit)*sin(yaw),sin(pit),cos(pit)*cos(yaw));
  vec3 fw=normalize(-ro), rt=normalize(cross(vec3(0,1,0),fw)), up=cross(fw,rt);
  vec3 p=ro, v=normalize(fw*1.5+uv.x*rt+uv.y*up);
  vec3 hv=cross(p,v); float h2=dot(hv,hv);
  vec3 col=vec3(0); float tr=1.; bool hole=false;
  for(int i=0;i<320;i++){
    float r=length(p);
    if(r<1.){hole=true;break;}
    if(r>D*1.6) break;
    float dt=clamp(.07*r,.015,1.);
    vec3 pp=p;
    v+=-1.5*h2*p/pow(r,5.)*dt;
    p+=v*dt;
    if(pp.y*p.y<0.){
      vec3 c=mix(pp,p,pp.y/(pp.y-p.y));
      float rr=length(c.xz);
      if(rr>2.6&&rr<14.){
        float w=pow(rr,-1.5), a=atan(c.z,c.x)+T*w*3.;
        float den=fbm(vec2(a*2.5,rr*1.3-T*.1))*smoothstep(2.6,3.4,rr)*smoothstep(14.,8.,rr);
        den=pow(den,1.8)*2.6;
        vec3 vel=normalize(vec3(-c.z,0,c.x))*min(.6,sqrt(.5/(rr-1.)));
        float dop=1./(1.-dot(vel,-normalize(v)));
        float heat=smoothstep(10.,2.8,rr);
        vec3 tint=mix(vec3(1.,.32,.06),vec3(1.,.85,.6),heat);
        tint=mix(tint,vec3(.55,.7,1.),clamp(dop-1.,0.,1.)*.6);
        col+=tr*den*tint*pow(dop,3.)*(4./rr)*1.6;
        tr*=1.-clamp(den*.8,0.,.92);
      }
    }
  }
  if(!hole) col+=tr*sky(normalize(v));
  col=1.-exp(-col*1.15);
  col=pow(col,vec3(.4545));
  col*=1.-.35*dot(uv,uv);
  o=vec4(col,1);
}`;

const gl = glkit.context(cv, .75);
const prog = glkit.program(gl, glkit.FULLSCREEN_VS, FS);
const U = glkit.uniforms(gl, prog, ['R', 'T', 'M', 'D']);
const drag = glkit.drag(cv);
let dist = dist0(o.distance), distT = dist;

// paw-fx: shadows the global so upstream's frame() runs unchanged through
// pulso(), which pauses off screen and holds a cancellable handle.
function requestAnimationFrame(cb) { loop = cb; }

function frame(now) {
  requestAnimationFrame(frame);
  drag.step();
  dist += (distT - dist) * .08;
  gl.uniform2f(U.R, cv.width, cv.height);
  gl.uniform1f(U.T, now / 1000);
  gl.uniform2f(U.M, drag.x, drag.y);
  gl.uniform1f(U.D, dist);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
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
  update(next) {
    Object.assign(o, next || {});
    distT = dist0(o.distance);
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
  name: "event-horizon",
  version: "1.0.0",
  category: "3d-hero",
  needs: [],
  license: "MIT",
  options: {
    distance: { type: "number", default: 26, min: 9, max: 60, description: "Camera distance from the hole, in Schwarzschild radii (upstream's wheel zoom, clamped to its own 9..60). Closer fills the section with the disk and its lensed far side; further leaves a small hole in a wide lensed starfield. Changes glide, as upstream's zoom did." },
  },
};
