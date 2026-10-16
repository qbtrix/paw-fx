// chladni-sand, from blvgor/resona-lab — MIT License
// https://github.com/blvgor/resona-lab
//
// MIT License
//
// Copyright (c) 2026 Egor Belyakov (blvgor)
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
// chladni-sand: a port of the sand engine in blvgor/resona-lab at commit
// 31895f122ad6ee60e01139b364e23a4b0664f10c. Sand on a vibrating square plate:
// the plate's modes come from Kirchhoff-Love thin-plate theory (physics.js),
// and 40,000 WebGL points walk down the displacement gradient until they
// gather on the nodal lines, the parts of the plate that stand still
// (renderer.js). The lab around it (app.js: gallery, sound, PNG export,
// settings panels) is not ported; only its field build, resize and frame loop
// are, inside mount(). Option steps are its index.html sliders.
//
// physics.js and renderer.js follow verbatim with three kinds of change, each
// marked "seam": `export` is dropped from every upstream declaration (the
// module's API is mount()), renderer.js's import of physics.js is dropped
// because both are inlined here, and the WebGL getContext passes
// failIfMajorPerformanceCaveat so a software-rendered browser keeps the CSS
// rest instead of upstream's Canvas 2D fallback. mount() at the bottom is ours.

export const meta = {
  name: "chladni-sand",
  version: "1.0.0",
  category: "particles",
  needs: [],
  license: "MIT",
  options: {
    preset: { type: "number", default: 26, min: 0, max: 47, step: 1, description: "Which of upstream's 48 patterns the sand settles into. Tapping the plate moves to the next one." },
    count: { type: "number", default: 40000, min: 10000, max: 80000, step: 5000, description: "Grains of sand." },
    grain: { type: "number", default: 1.2, min: 0.5, max: 2.8, step: 0.1, description: "Grain size." },
    spread: { type: "number", default: 1.2, min: 0.3, max: 3, step: 0.1, description: "How much the grains jitter, so how soft the settled lines are." },
    exposure: { type: "number", default: 1, min: 0.4, max: 1.8, step: 0.1, description: "Brightness of the sand." },
    color: { type: "string", default: "#e7d7b1", description: "Sand colour. Set --fx-sand to match so the CSS rest agrees." },
    background: { type: "string", default: "#090a09", description: "Plate colour. Set --fx-bg to match." },
  },
};

// ---------------------------------------------------------------- physics.js (upstream)
// Kirchhoff–Love thin plate, simply supported on all four edges.
// Exact modal frequencies; truncated modal forced response.
const MATERIALS = { // seam: not exported
  aluminum: { name: 'Алюминий', E: 69e9, rho: 2700, nu: 0.33 },
  steel: { name: 'Сталь', E: 200e9, rho: 7850, nu: 0.30 },
  brass: { name: 'Латунь', E: 100e9, rho: 8500, nu: 0.34 },
  titanium: { name: 'Титан', E: 116e9, rho: 4500, nu: 0.34 }
};

function naturalFrequency(m, n, plate) { // seam: not exported
  const mat = MATERIALS[plate.material] || MATERIALS.aluminum;
  const h = plate.thickness / 1000;
  const a = plate.length / 100, b = a / plate.aspect;
  const D = mat.E * h ** 3 / (12 * (1 - mat.nu ** 2));
  return Math.PI / 2 * Math.sqrt(D / (mat.rho * h)) * ((m / a) ** 2 + (n / b) ** 2);
}

function basis(m, n, x, y) { // seam: not exported
  return Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * y);
}

function responseCoefficients(preset, plate, frequency, damping = 0.015, mix = preset.mix) { // seam: not exported
  const frequencies = [naturalFrequency(preset.m, preset.n, plate), naturalFrequency(preset.n, preset.m, plate)];
  const terms = frequencies.map((fn, i) => {
    const ratio = frequency / fn;
    const re = 1 - ratio ** 2, im = 2 * damping * ratio;
    const denominator = re ** 2 + im ** 2;
    const drive = i === 0 ? 1 : preset.m === preset.n ? 0 : mix;
    const dimensional = (2 * Math.PI * fn) ** 2;
    return { re: drive * re / (denominator * dimensional), im: -drive * im / (denominator * dimensional) };
  });
  const norm = Math.max(1e-30, Math.hypot(terms[0].re, terms[0].im) + Math.hypot(terms[1].re, terms[1].im));
  return { terms: terms.map(t => ({ re: t.re / norm, im: t.im / norm })), gain: norm, frequencies };
}

function createField(preset, plate, frequency, damping, mix, size = 192, manual = false) { // seam: not exported
  const response = responseCoefficients(preset, plate, frequency, damping, mix);
  let modes = [{ m: preset.m, n: preset.n, ...response.terms[0] }, { m: preset.n, n: preset.m, ...response.terms[1] }];
  if (manual) {
    modes = [];
    for (let m = 1; m <= 9; m++) for (let n = 1; n <= 9; n++) {
      const fn = naturalFrequency(m, n, plate), w = 2 * Math.PI * fn, drive = 2 * Math.PI * frequency;
      const re = w * w - drive * drive, im = 2 * damping * w * drive;
      const f = basis(m, n, .37, .43), den = re * re + im * im;
      modes.push({ m, n, re: f * re / den, im: -f * im / den, fn });
    }
    modes.sort((a,b) => Math.hypot(b.re,b.im) - Math.hypot(a.re,a.im));
    // Keep the strongest 16 modal responses; the full 81-mode basis sets their weights.
    const norm = modes.slice(0,16).reduce((sum,t) => sum + Math.hypot(t.re,t.im),0);
    response.dominantMode = { m: modes[0].m, n: modes[0].n, frequency: modes[0].fn };
    modes = modes.slice(0,16).map(t => ({ ...t, re: t.re / norm, im: t.im / norm }));
  }
  const values = new Float32Array(size * size), signed = new Float32Array(size * size);
  const gx = new Float32Array(size * size), gy = new Float32Array(size * size);
  const real = new Float32Array(size * size), imaginary = new Float32Array(size * size);
  const realX = new Float32Array(size * size), realY = new Float32Array(size * size);
  const imaginaryX = new Float32Array(size * size), imaginaryY = new Float32Array(size * size);
  // Choose a display phase from the dominant modal coefficient, not from arbitrary time.
  const dominant = modes.reduce((a,b) => Math.hypot(a.re,a.im) >= Math.hypot(b.re,b.im) ? a : b);
  const phase = Math.atan2(dominant.im, dominant.re);
  const table = Array.from({length:10}, (_,m) => Float32Array.from({length:size}, (_,i) => Math.sin(m * Math.PI * i / (size - 1))));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const j = y * size + x;
    let re = 0, im = 0;
    for (const mode of modes) {
      const p = table[mode.m][x] * table[mode.n][y];
      re += mode.re * p; im += mode.im * p;
    }
    values[j] = re * re + im * im;
    real[j] = re; imaginary[j] = im;
    signed[j] = re * Math.cos(phase) + im * Math.sin(phase);
  }
  const maximum = Math.max(...values);
  if (manual && maximum > 0) for (let i=0;i<values.length;i++) { values[i] /= maximum; signed[i] /= Math.sqrt(maximum); real[i] /= Math.sqrt(maximum); imaginary[i] /= Math.sqrt(maximum); }
  // Recompute gradients after response normalization.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const j = y * size + x;
    gx[j] = (values[y * size + Math.min(size - 1, x + 1)] - values[y * size + Math.max(0, x - 1)]) * (size - 1) / 2;
    gy[j] = (values[Math.min(size - 1, y + 1) * size + x] - values[Math.max(0, y - 1) * size + x]) * (size - 1) / 2;
    const left=y*size+Math.max(0,x-1),right=y*size+Math.min(size-1,x+1),top=Math.max(0,y-1)*size+x,bottom=Math.min(size-1,y+1)*size+x;
    realX[j]=(real[right]-real[left])*(size-1)/2;realY[j]=(real[bottom]-real[top])*(size-1)/2;
    imaginaryX[j]=(imaginary[right]-imaginary[left])*(size-1)/2;imaginaryY[j]=(imaginary[bottom]-imaginary[top])*(size-1)/2;
  }
  return { size, values, signed, gx, gy, real, imaginary, realX, realY, imaginaryX, imaginaryY, response, maximum };
}

function sampleGrid(grid, size, x, y) { // seam: not exported
  const tx = Math.min(size - 1.001, Math.max(0, x * (size - 1)));
  const ty = Math.min(size - 1.001, Math.max(0, y * (size - 1)));
  const ix = Math.floor(tx), iy = Math.floor(ty), fx = tx - ix, fy = ty - iy, j = iy * size + ix;
  return (grid[j] * (1 - fx) + grid[j + 1] * fx) * (1 - fy) + (grid[j + size] * (1 - fx) + grid[j + size + 1] * fx) * fy;
}

const pairs = [[1,3],[2,3],[1,2],[1,4],[2,4],[1,5],[3,4],[2,5],[3,5],[1,6],[2,6],[4,5],[3,6],[1,7],[4,6],[2,7],[3,7],[5,6],[4,7],[5,7],[6,7]];
const names = [['Орбита','Пересечение'],['Лепестки','Паруса'],['Прилив','Развилка'],['Крылья','Меридиан'],['Четырёхлистник','Решётка'],['Двойное кольцо','Компас'],['Ирис','Контрапункт'],['Бутон','Каскад'],['Мандала','Переплетение'],['Волна','Горизонты'],['Розетка','Ступени'],['Созвездие','Лабиринт'],['Венок','Мозаика'],['Три орбиты','Калейдоскоп'],['Лотос','Кружево'],['Соцветие','Ритм'],['Звёздный сад','Паутинка'],['Корона','Ткань'],['Георгин','Плетение'],['Хризантема','Соты'],['Микрокосм','Гобелен']];
const PRESETS = pairs.flatMap(([m,n], i) => [1,-1].map((mix,j) => ({ id: i * 2 + j, m, n, mix, name: names[i][j], category: m + n >= 9 ? 'intricate' : j === 0 ? 'curves' : 'geometric' }))); // seam: not exported
for (let m = 2; m <= 7; m++) PRESETS.push({ id: PRESETS.length, m, n: m, mix: 0, name: ['Окна','Квадранты','Плитка','Колоннада','Шахматная доска','Архитектура'][m - 2], category: m >= 5 ? 'intricate' : 'geometric' });

const DEFAULT_STATE = { // seam: not exported
  preset: 0, material: 'aluminum', thickness: 1.5, length: 30, aspect: 1, damping: 0.015,
  frequency: 0, mix: 1, tuning: 'patterns', count: 40000, grain: 1.2, spread: 1.2,
  color: '#e7d7b1', background: '#090a09', exposure: 1, view: 'sand', running: true,
  exportSize: 3840, transparent: false, margins: true
};

function validateState(candidate = {}) { // seam: not exported
  const s = { ...DEFAULT_STATE };
  for (const key of Object.keys(s)) if (typeof candidate[key] === typeof s[key]) s[key] = candidate[key];
  const clamp = (key, min, max) => s[key] = Math.max(min, Math.min(max, Number.isFinite(s[key]) ? s[key] : DEFAULT_STATE[key]));
  clamp('preset', 0, PRESETS.length - 1); s.preset = Math.round(s.preset);
  clamp('thickness', .5, 4); clamp('length', 15, 60); clamp('aspect', 1, 2);
  clamp('damping', .005, .08); clamp('frequency', 20, 16000); clamp('mix', -1, 1);
  clamp('count', 10000, 80000); s.count = Math.round(s.count);
  clamp('grain', .5, 2.8); clamp('spread', .3, 3); clamp('exposure', .4, 1.8);
  if (!MATERIALS[s.material]) s.material = DEFAULT_STATE.material;
  if (!['sand','contours','field'].includes(s.view)) s.view = 'sand';
  if (!['patterns','manual'].includes(s.tuning)) s.tuning = 'patterns';
  if (![1080,2160,3840].includes(s.exportSize)) s.exportSize = 3840;
  for (const key of ['color','background']) if (!/^#[0-9a-f]{6}$/i.test(s[key])) s[key] = DEFAULT_STATE[key];
  return s;
}

// ---------------------------------------------------------------- renderer.js (upstream)
// seam: upstream's import of sampleGrid from physics.js is dropped, physics.js is inlined above

function rgb(hex) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); } // seam: not exported
function random(seed = 713) { // seam: not exported
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15,1 | seed); t ^= t + Math.imul(t ^ t >>> 7,61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function advanceParticles(p,f,spread,rng,dt=1) { // seam: not exported
  const rate=Math.min(dt,2);
  for(let i=0;i<p.length;i+=4){
    const x=p[i],y=p[i+1];
    const re=sampleGrid(f.real,f.size,x,y),im=sampleGrid(f.imaginary,f.size,x,y),u=re*re+im*im;
    if(p[i+3]<.065){p[i]+=(rng()-.5)*.0006;p[i+1]+=(rng()-.5)*.0006;}
    else{
      // Interpolate displacement BEFORE squaring. Interpolating squared samples creates
      // grid-dependent false minima and causes sand to drift into isolated clumps.
      const gx=2*(re*sampleGrid(f.realX,f.size,x,y)+im*sampleGrid(f.imaginaryX,f.size,x,y));
      const gy=2*(re*sampleGrid(f.realY,f.size,x,y)+im*sampleGrid(f.imaginaryY,f.size,x,y));
      const den=gx*gx+gy*gy+.0002,scale=Math.min(.7*rate,u/den*1.1*rate);
      const jitter=(.0012*spread+Math.min(.002,Math.sqrt(u)*.002))*Math.sqrt(rate);
      p[i]+=Math.max(-.018,Math.min(.018,-gx*scale))+(rng()-.5)*jitter;
      p[i+1]+=Math.max(-.018,Math.min(.018,-gy*scale))+(rng()-.5)*jitter;
    }
    if(p[i]<.025||p[i]>.975||p[i+1]<.025||p[i+1]>.975){p[i]=.07+rng()*.86;p[i+1]=.07+rng()*.86;}
  }
}

class SandRenderer { // seam: not exported
  constructor(canvas, fieldCanvas, onError) {
    this.canvas = canvas; this.fieldCanvas = fieldCanvas; this.rng = random(); this.onError = onError;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: true }); // seam
    if (this.gl) this.initGL(); else this.ctx = canvas.getContext('2d');
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; onError('Графика приостановлена. Ожидаем восстановления.'); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.initGL(); onError('Графика восстановлена.'); this.draw(); });
  }
  initGL() {
    const gl = this.gl;
    const shader = (type,source) => { const s = gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    this.program = gl.createProgram();
    gl.attachShader(this.program,shader(gl.VERTEX_SHADER,'attribute vec4 aParticle; uniform float uSize; varying float vLight; void main(){gl_Position=vec4(aParticle.x*2.0-1.0,1.0-aParticle.y*2.0,0.0,1.0);gl_PointSize=uSize*(0.65+aParticle.w*0.7);vLight=aParticle.z;}'));
    gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform vec3 uColor;uniform float uExposure;varying float vLight;void main(){vec2 p=gl_PointCoord-0.5;float a=1.0-smoothstep(0.12,0.5,length(p));gl_FragColor=vec4(uColor*vLight*uExposure,a*0.48);}'));
    gl.linkProgram(this.program); if (!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program); this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    const attr = gl.getAttribLocation(this.program,'aParticle'); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr,4,gl.FLOAT,false,16,0);
    this.uniforms = Object.fromEntries(['uSize','uColor','uExposure'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }
  configure(state, field) {
    this.state = state; this.field = field;
    if (!this.particles || this.particles.length !== state.count * 4) {
      const previous = this.particles; this.particles = new Float32Array(state.count * 4);
      for (let i=0;i<state.count;i++) {
        const j=i*4;
        if (previous && j<previous.length) this.particles.set(previous.subarray(j,j+4),j);
        else { this.particles[j]=.025+this.rng()*.95;this.particles[j+1]=.025+this.rng()*.95;this.particles[j+2]=.3+this.rng()*.7;this.particles[j+3]=this.rng(); }
      }
      if (!previous) for (let i=0;i<35;i++) this.update(1);
    }
    this.drawField(); this.draw();
  }
  resize(width,height) {
    const dpr = Math.min(window.devicePixelRatio || 1,2);
    this.dpr=dpr; this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
    this.fieldCanvas.width=this.canvas.width;this.fieldCanvas.height=this.canvas.height;
    if (this.gl) this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
    if(this.state) {this.drawField();this.draw();}
  }
  reset() {
    for(let i=0;i<this.particles.length;i+=4){this.particles[i]=.025+this.rng()*.95;this.particles[i+1]=.025+this.rng()*.95;}
    this.draw();
  }
  update(dt=1) {
    if (!this.field || this.lost) return;
    advanceParticles(this.particles,this.field,this.state.spread,this.rng,dt);
  }
  draw() {
    if(!this.state||this.lost)return;
    const s=this.state;
    this.canvas.style.visibility=s.view==='sand'?'visible':'hidden';
    this.fieldCanvas.style.visibility=s.view==='sand'?'hidden':'visible';
    if(s.view!=='sand')return;
    if(this.gl) {
      const gl=this.gl,bg=rgb(s.background),c=rgb(s.color);
      gl.clearColor(bg[0]/255,bg[1]/255,bg[2]/255,1);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.particles,gl.DYNAMIC_DRAW);
      gl.uniform1f(this.uniforms.uSize,s.grain*(this.dpr||1)*1.35);gl.uniform3f(this.uniforms.uColor,c[0]/255,c[1]/255,c[2]/255);gl.uniform1f(this.uniforms.uExposure,s.exposure);
      gl.drawArrays(gl.POINTS,0,this.particles.length/4);
    } else this.paintSand(this.ctx,this.canvas.width,this.canvas.height,false,0);
  }
  paintSand(ctx,w,h,transparent=false,pad=0) {
    ctx.clearRect(0,0,w,h);const s=this.state,p=this.particles,c=rgb(s.color);
    if(!transparent){ctx.fillStyle=s.background;ctx.fillRect(0,0,w,h);}
    const innerW=w-pad*2,innerH=h-pad*2,scale=innerW/(this.canvas.clientWidth||600),r=Math.max(.45,s.grain*scale*.42);
    // Native pixels on a separate canvas; export never stretches a screen capture.
    for(let band=0;band<4;band++){
      ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${Math.min(1,(.19+band*.13)*s.exposure)})`;ctx.beginPath();
      for(let i=0;i<p.length;i+=4)if(Math.min(3,Math.floor(p[i+2]*4))===band){const x=pad+p[i]*innerW,y=pad+p[i+1]*innerH;ctx.moveTo(x+r,y);ctx.arc(x,y,r*(.65+p[i+3]*.7),0,Math.PI*2);}
      ctx.fill();
    }
  }
  drawField() {
    if(!this.state||!this.field||!this.fieldCanvas.width)return;
    this.paintField(this.fieldCanvas.getContext('2d'),this.fieldCanvas.width,this.fieldCanvas.height,false,0);
  }
  paintField(ctx,w,h,transparent=false,pad=0) {
    const s=this.state,f=this.field,iw=w-2*pad,ih=h-2*pad;
    ctx.clearRect(0,0,w,h);if(!transparent){ctx.fillStyle=s.background;ctx.fillRect(0,0,w,h);}
    if(s.view==='field'){
      const tile=document.createElement('canvas');tile.width=f.size;tile.height=f.size;const tc=tile.getContext('2d'),im=tc.createImageData(f.size,f.size);
      for(let i=0;i<f.signed.length;i++){const v=Math.max(-1,Math.min(1,f.signed[i])),mag=Math.pow(Math.abs(v),.55),color=v>0?[221,162,94]:[75,130,173];for(let k=0;k<3;k++)im.data[i*4+k]=color[k];im.data[i*4+3]=Math.round(mag*235);}
      tc.putImageData(im,0,0);ctx.drawImage(tile,pad,pad,iw,ih);
    }
    const levels=s.view==='contours'?[0,-.25,.25,-.5,.5]:[0];
    for(const level of levels){ctx.strokeStyle=s.color;ctx.globalAlpha=level===0?.9:.2;ctx.lineWidth=(level===0?1.2:.6)*w/(this.canvas.clientWidth||600);ctx.beginPath();
      for(let y=1;y<f.size-2;y++)for(let x=1;x<f.size-2;x++){
        const j=y*f.size+x,v=[f.signed[j]-level,f.signed[j+1]-level,f.signed[j+f.size+1]-level,f.signed[j+f.size]-level];
        const points=[];for(let edge=0;edge<4;edge++){const next=(edge+1)%4;if((v[edge]<0)===(v[next]<0))continue;const t=v[edge]/(v[edge]-v[next]),corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],a=corners[edge],b=corners[next];points.push([pad+(a[0]+(b[0]-a[0])*t)*iw/(f.size-1),pad+(a[1]+(b[1]-a[1])*t)*ih/(f.size-1)]);}
        for(let k=0;k+1<points.length;k+=2){ctx.moveTo(...points[k]);ctx.lineTo(...points[k+1]);}
      }ctx.stroke();ctx.globalAlpha=1;
    }
  }
  exportCanvas() {
    const s=this.state,out=document.createElement('canvas');out.width=s.exportSize;out.height=Math.round(s.exportSize/s.aspect);
    const pad=s.margins?Math.round(out.height*.06):0;
    if(s.view==='sand')this.paintSand(out.getContext('2d'),out.width,out.height,s.transparent,pad);
    else this.paintField(out.getContext('2d'),out.width,out.height,s.transparent,pad);
    return out;
  }
}

function paintPreview(canvas,field,color='#e7d7b1') { // seam: not exported
  const ctx=canvas.getContext('2d'),size=canvas.width,c=rgb(color),rnd=random(73),image=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx=.025+x/size*.95,sy=.025+y/size*.95,value=sampleGrid(field.values,field.size,sx,sy);
    const gradient=Math.hypot(sampleGrid(field.gx,field.size,sx,sy),sampleGrid(field.gy,field.size,sx,sy));
    const distance=2*value/(gradient+.000001),prob=Math.exp(-distance*distance*18000),r=rnd(),j=(y*size+x)*4;
    const intensity=Math.min(1,prob*(.45+r*.75)+(r>.993?.12:0));
    for(let k=0;k<3;k++)image.data[j+k]=Math.round(9*(1-intensity)+c[k]*intensity);image.data[j+3]=255;
  }ctx.putImageData(image,0,0);
}

// ---------------------------------------------------------------- paw-fx mount
// One square plate beside the copy. mount() is app.js's studio reduced to the
// sand view: rebuildField() picks the preset's own natural frequency and builds
// the field, resize() sizes the canvas from the plate's box, and the frame
// loop advances and draws the sand with upstream's dt clamp. Tapping the plate
// is upstream's "next" button followed by its "scatter the sand" button, so
// the grains fly apart and settle into the next pattern.
export function mount(el, opts = {}) {
  const noop = { update() {}, destroy() {} };
  if (!el || typeof document === "undefined") return noop;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return noop;

  const plate = el.querySelector(".fx-chladni-sand__plate") || el;
  const sand = document.createElement("canvas");
  sand.className = "fx-chladni-sand__canvas";
  sand.setAttribute("aria-hidden", "true");
  plate.appendChild(sand);

  let renderer;
  try {
    // The field canvas only draws the lab's contour and field views; the sand
    // view hides it, so it never joins the document.
    renderer = new SandRenderer(sand, document.createElement("canvas"), () => {});
  } catch {
    renderer = null;
  }
  if (!renderer || !renderer.gl) {
    sand.remove();
    return noop;
  }
  const draw = renderer.draw.bind(renderer);
  renderer.draw = () => {
    draw();
    if (!renderer.lost && !renderer.gl.isContextLost() && !el.hasAttribute("data-fx-live")) el.setAttribute("data-fx-live", "");
  };

  const pin = { view: "sand", tuning: "patterns", running: true };
  let state = validateState({ ...DEFAULT_STATE, preset: meta.options.preset.default, ...opts, ...pin });
  state.mix = PRESETS[state.preset].mix;
  const rebuildField = () => {
    const p = PRESETS[state.preset];
    state.frequency = naturalFrequency(p.m, p.n, state);
    renderer.configure(state, createField(p, state, state.frequency, state.damping, state.mix, 192, false));
  };
  const resize = () => {
    const rect = plate.getBoundingClientRect();
    if (rect.width === 0) return;
    renderer.resize(rect.width, rect.height);
  };
  resize();
  rebuildField();

  const next = () => {
    state.preset = (state.preset + 1 + PRESETS.length) % PRESETS.length;
    state.mix = PRESETS[state.preset].mix;
    rebuildField();
    renderer.reset();
  };
  const onKey = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    next();
  };
  plate.addEventListener("click", next);
  plate.addEventListener("keydown", onKey);
  plate.setAttribute("role", "button");
  plate.setAttribute("tabindex", "0");
  plate.setAttribute("aria-label", "Scatter the sand into the next pattern");

  const ro = new ResizeObserver(resize);
  ro.observe(plate);

  // Off screen the loop stops; nothing else about the sand changes.
  let visible = true;
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; })
    : null;
  if (io) io.observe(el);

  let last = 0, raf = 0;
  const animate = (time) => {
    const dt = last ? Math.min(2, (time - last) / 16.667) : 1;
    last = time;
    if (!document.hidden && visible) {
      renderer.update(dt);
      renderer.draw();
    }
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);

  let stopped = false;
  return {
    update(nextOpts = {}) {
      if (stopped) return;
      const before = state.preset;
      state = validateState({ ...state, ...nextOpts, ...pin });
      state.mix = state.preset === before ? state.mix : PRESETS[state.preset].mix;
      rebuildField();
    },
    destroy() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (io) io.disconnect();
      plate.removeEventListener("click", next);
      plate.removeEventListener("keydown", onKey);
      for (const a of ["role", "tabindex", "aria-label"]) plate.removeAttribute(a);
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
      sand.remove();
      el.removeAttribute("data-fx-live");
    },
  };
}
