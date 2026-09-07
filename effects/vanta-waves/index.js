// Vanta.js -- https://github.com/tengbao/vanta
//
// MIT License
// Copyright 2020 Teng Bao
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
// vanta-waves: a port of tengbao/vanta's WAVES effect, commit
// f8b351906688b56f0fc744e53bde81fc3c56f150. It spans three upstream files --
// src/vanta.waves.js is the effect, src/_base.js is the class it extends (the
// renderer, the resize, the mouse plumbing and the 60fps-normalised animation
// loop all live there), and src/helpers.js supplies rn / ri / mobileCheck /
// clearThree. A Vanta effect does not run without _base, so all three are
// cited in meta.json.origin.path and all three are inlined here: this repo's
// build emits only index.js and style.css per effect, so a shared base module
// has nowhere to live inside a generated site.
//
// The 101x81 vertex sheet, the randomised triangulation, the trochoidal wave
// displacement and the camera easing are upstream's, constant for constant.
// What changed is declared in meta.json.deviations, and the ones that matter
// are forced by three.js: upstream pins r134, this repo vendors 0.185.1, where
// lights are no longer scaled by PI and punctual lights fall off with the
// inverse square of distance. Left alone, the one point light 300 units above
// the sheet arrives roughly 1/90000 as strong and the sea renders as a flat
// ambient-lit plate with no specular at all -- the wrong-not-broken failure
// this port exists to avoid.
//
// The guards are ours: failIfMajorPerformanceCaveat, one bail() every failure
// path lands in, and a resting state in style.css that is a finished hero.
import * as THREE from "../../vendor/three.module.js";

export const meta = {
  name: "vanta-waves",
  version: "1.0.0",
  category: "3d-hero",
  needs: ["three"],
  license: "MIT",
  options: {
    color: { type: "string", default: "#005588", description: "Water colour. Upstream default 0x005588." },
    shininess: { type: "number", default: 30, description: "Phong specular exponent; higher is a tighter, harder highlight. Upstream default 30." },
    waveHeight: { type: "number", default: 15, description: "Peak-to-trough displacement in world units. Upstream default 15." },
    waveSpeed: { type: "number", default: 1, description: "Swell rate. Upstream default 1." },
    zoom: { type: "number", default: 1, description: "Camera distance divisor; above 1 pulls in. Upstream default 1." },
  },
};

// vanta.waves.js defaultOptions, plus the _base.js defaults this port keeps.
// backgroundColor is the one addition: upstream leaves it undefined, which
// three resolves to opaque black behind the sheet.
const DEFAULTS = {
  color: 0x005588,
  shininess: 30,
  waveHeight: 15,
  waveSpeed: 1,
  zoom: 1,
  backgroundColor: 0x0b1a2a,
  backgroundAlpha: 1,
  mouseControls: true,
  touchControls: true,
  minHeight: 200,
  minWidth: 200,
  scale: 1,
  scaleMobile: 1,
};

// Waves.prototype constants from initClass()
const WW = 100;
const HH = 80;
const WAVE_NOISE = 4; // choppiness of water
const CELLSIZE = 18;

// helpers.js, minus the Number.prototype patch. Upstream defines
// Number.prototype.clamp; a library that ships into someone else's page does
// not get to extend a builtin, so the same maths is a local function.
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const rn = (a = 0, b = 1) => a + Math.random() * (b - a);
const ri = (a = 0, b = 1) => Math.floor(a + Math.random() * (b - a + 1));
const mobileCheck = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth < 600;

// helpers.js clearThree: depth-first dispose of every geometry, material and
// material map under a node.
function clearThree(obj) {
  while (obj.children && obj.children.length > 0) {
    clearThree(obj.children[0]);
    obj.remove(obj.children[0]);
  }
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    for (const prop of Object.keys(obj.material)) {
      const v = obj.material[prop];
      if (v && typeof v.dispose === "function") v.dispose();
    }
    obj.material.dispose();
  }
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const cssVar = (el, name, fallback) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.appendChild !== "function" || typeof document === "undefined") return resting;

  const options = { ...DEFAULTS, ...opts };
  if (opts.color == null) options.color = cssVar(el, "--fx-color", DEFAULTS.color);
  if (opts.backgroundColor == null) options.backgroundColor = cssVar(el, "--fx-bg", DEFAULTS.backgroundColor);

  let renderer;
  try {
    // A context the browser will only serve off a software rasteriser is
    // refused rather than accepted: a hero that scrolls at 4fps is worse than
    // the CSS one underneath it. Upstream asks for alpha + antialias only.
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, failIfMajorPerformanceCaveat: true });
  } catch {
    return resting; // no WebGL, or a context refused for a performance caveat
  }

  const gl = renderer.getContext(); // captured before teardown drops the renderer
  const canvas = renderer.domElement;
  canvas.className = "fx-waves__canvas";
  canvas.setAttribute("aria-hidden", "true");
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  let width = 0;
  let height = 0;
  let scale = 1;
  let t = 0;
  let prevNow = 0;
  let req = 0;
  let torn = false;
  let still = false; // true once mount() decides not to run the loop

  // _base.js setSize
  const setSize = () => {
    scale = mobileCheck() && options.scaleMobile ? options.scaleMobile : options.scale || 1;
    width = Math.max(el.offsetWidth, options.minWidth);
    height = Math.max(el.offsetHeight, options.minHeight);
  };
  setSize();

  // ---- vanta.waves.js onInit --------------------------------------------
  const material = new THREE.MeshPhongMaterial({
    color: new THREE.Color(options.color),
    shininess: options.shininess,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.BufferGeometry();

  const gg = [];
  const pts = [];
  for (let i = 0; i <= WW; i++) {
    gg[i] = [];
    for (let j = 0; j <= HH; j++) {
      gg[i][j] = pts.length;
      pts.push(
        new THREE.Vector3(
          (i - WW * 0.5) * CELLSIZE,
          rn(0, WAVE_NOISE) - 10,
          (HH * 0.5 - j) * CELLSIZE,
        ),
      );
    }
  }
  geometry.setFromPoints(pts);

  // Faces. a b / c d, looking from the bottom right point. The coin flip per
  // quad is what stops the sheet reading as a regular diagonal weave.
  const indices = [];
  for (let i = 1; i <= WW; i++) {
    for (let j = 1; j <= HH; j++) {
      const d = gg[i][j];
      const b = gg[i][j - 1];
      const c = gg[i - 1][j];
      const a = gg[i - 1][j - 1];
      if (ri(0, 1)) indices.push(a, b, c, b, c, d);
      else indices.push(a, b, d, a, c, d);
    }
  }
  geometry.setIndex(indices);
  const position = geometry.attributes.position;
  position.setUsage(THREE.DynamicDrawUsage);
  // Upstream lazily records each vertex's rest height into a this.oy map on
  // the first frame, guarded by `if (!v.oy)`. A snapshot taken here is the
  // same set of numbers one frame earlier, and it does not carry upstream's
  // latent hole where a rest height of exactly 0 would never be recorded and
  // that vertex would stay flat for the life of the effect.
  const restY = Float32Array.from({ length: position.count }, (_, i) => position.getY(i));

  const plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  // Upstream: AmbientLight(0xffffff, 0.9) and PointLight(0xffffff, 0.9) at
  // (-100, 250, -100). Both intensities are multiplied by PI here and the
  // point light's decay pinned to 0. r134 ran three's legacy lighting path,
  // which scaled every light by PI and, for a light with distance 0, applied
  // no attenuation at all. 0.185.1 removed useLegacyLights and defaults decay
  // to 2, so the same light 300 units above the sheet arrives ~1/90000 as
  // strong: the sea renders ambient-only, flat, with no specular anywhere.
  const ambience = new THREE.AmbientLight(0xffffff, 0.9 * Math.PI);
  scene.add(ambience);

  const pointLight = new THREE.PointLight(0xffffff, 0.9 * Math.PI);
  pointLight.decay = 0;
  pointLight.position.set(-100, 250, -100);
  scene.add(pointLight);

  const camera = new THREE.PerspectiveCamera(35, width / height, 50, 10000);
  const xOffset = -10;
  const zOffset = -10;
  const cameraPosition = new THREE.Vector3(250 + xOffset, 200, 400 + zOffset);
  const cameraTarget = new THREE.Vector3(150 + xOffset, -30, 200 + zOffset);
  camera.position.copy(cameraPosition);
  scene.add(camera);
  // ---- end onInit --------------------------------------------------------

  const applyClear = () => renderer.setClearColor(new THREE.Color(options.backgroundColor), options.backgroundAlpha);
  applyClear();

  // _base.js resize
  const resize = () => {
    setSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio / scale);
    // renderer.setSize() reassigns canvas.width/height, and assigning either
    // resets the WebGL drawing buffer to transparent. With the loop running
    // the next frame repaints it. Under reduced motion there IS no next frame,
    // so the one held frame has to be re-rendered here or the section becomes
    // the blank rectangle every other guard in this file exists to prevent --
    // and data-fx-live has already faded the CSS resting state out behind it.
    // Measured, not assumed: exactly 1 distinct colour across the canvas after
    // a viewport change, on all three ports. The scene is not stepped, so this
    // redraws the held frame rather than advancing it.
    if (still && !torn) renderer.render(scene, camera);
  };

  // ---- vanta.waves.js onMouseMove ---------------------------------------
  const onMouseMove = (x, y) => {
    const c = camera;
    if (!c.oy) {
      c.oy = c.position.y;
      c.ox = c.position.x;
      c.oz = c.position.z;
    }
    c.tx = c.ox + ((x - 0.5) * 100) / options.zoom;
    c.ty = c.oy + ((y - 0.5) * -100) / options.zoom;
    c.tz = c.oz + ((x - 0.5) * -50) / options.zoom;
  };

  // ---- vanta.waves.js onUpdate ------------------------------------------
  const arr = position.array;
  const onUpdate = () => {
    let diff;
    material.color.set(options.color);
    material.shininess = options.shininess;
    const c = camera;
    c.ox = cameraPosition.x / options.zoom;
    c.oy = cameraPosition.y / options.zoom;
    c.oz = cameraPosition.z / options.zoom;

    if (Math.abs(c.tx - c.position.x) > 0.01) {
      diff = c.tx - c.position.x;
      c.position.x += diff * 0.02;
    }
    if (Math.abs(c.ty - c.position.y) > 0.01) {
      diff = c.ty - c.position.y;
      c.position.y += diff * 0.02;
    }
    if (Math.abs(c.tz - c.position.z) > 0.01) {
      diff = c.tz - c.position.z;
      c.position.z += diff * 0.02;
    }
    c.lookAt(cameraTarget);

    // WAVES. A trochoid rather than a sine: squaring (delta + 1) sharpens the
    // crests and flattens the troughs, which is the whole difference between
    // this and a rippling bedsheet.
    const s = options.waveSpeed;
    const h = options.waveHeight;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i];
      const z = arr[i + 2];
      const crossChop = Math.sqrt(s) * Math.cos(-x - z * 0.7);
      const delta = Math.sin(s * t * 0.02 - s * x * 0.025 + s * z * 0.015 + crossChop);
      arr[i + 1] = restY[i / 3] + (Math.pow(delta + 1, 2) / 4) * h;
    }
    geometry.computeVertexNormals();
    position.needsUpdate = true;
  };

  // ---- _base.js mouse plumbing ------------------------------------------
  // Listeners go on window rather than the section, because the section
  // usually sits below the copy and would never see the move itself. Gyro
  // controls are dropped: upstream defaults them off and they ask for a
  // permission a background hero has no business requesting.
  const windowMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) onMouseMove(x / width, y / height);
  };
  const windowTouch = (e) => {
    if (e.touches.length !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) onMouseMove(x / width, y / height);
  };

  // _base.js drives resize off a window listener plus a forced rAF after the
  // first frame, because a section can finish laying out after mount. A
  // ResizeObserver is that same intent without the hack.
  const ro = new ResizeObserver(() => { if (!torn) resize(); });

  // ---- teardown ----------------------------------------------------------
  // One exit for every failure: a context lost later, an explicit destroy(),
  // and the first-frame check below all run this. Idempotent, because
  // loseContext() itself fires webglcontextlost and would otherwise re-enter.
  const bail = () => {
    if (torn) return;
    torn = true;
    cancelAnimationFrame(req);
    canvas.removeEventListener("webglcontextlost", bail);
    ro.disconnect();
    window.removeEventListener("mousemove", windowMouseMove);
    window.removeEventListener("scroll", windowMouseMove);
    window.removeEventListener("touchstart", windowTouch);
    window.removeEventListener("touchmove", windowTouch);
    clearThree(scene);
    renderer.dispose();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    el.removeAttribute("data-fx-live");
  };
  canvas.addEventListener("webglcontextlost", bail);

  // ---- _base.js animationLoop -------------------------------------------
  // Upstream animates only while the section is on screen, which is the whole
  // reason a viewport-height hero costs nothing once it is scrolled past, and
  // it normalises elapsed time to 60fps so the swell runs at one rate on a
  // 144Hz display and a struggling laptop alike.
  const isOnScreen = () => {
    const elHeight = el.offsetHeight;
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    const offsetTop = rect.top + scrollTop;
    return offsetTop - window.innerHeight <= scrollTop && scrollTop <= offsetTop + elHeight;
  };

  const step = (force) => {
    const now = performance.now();
    if (prevNow) t += clamp((now - prevNow) / (1000 / 60), 0.2, 5);
    prevNow = now;
    if (force || isOnScreen()) {
      onUpdate();
      renderer.render(scene, camera);
    }
  };

  const loop = () => {
    step(false);
    req = requestAnimationFrame(loop);
  };

  ro.observe(el);
  resize();
  // _base.js initMouse: centre the camera targets so the easing has somewhere
  // to ease to before the pointer has ever moved.
  onMouseMove(0.5, 0.5);

  // A program that fails to link leaves the canvas transparent while
  // data-fx-live has already faded the resting state out -- exactly the blank
  // rectangle these guards exist to prevent. Render one frame and check.
  try {
    step(true);
  } catch {
    bail();
    return resting;
  }
  if (gl.isContextLost()) {
    bail();
    return resting;
  }

  el.setAttribute("data-fx-live", "");
  // Reduced motion keeps the frame just rendered and stops there: no loop, no
  // pointer parallax, the real sea as a still image rather than a downgrade.
  if (reducedMotion()) {
    still = true;
  } else {
    if (options.mouseControls) {
      window.addEventListener("mousemove", windowMouseMove);
      window.addEventListener("scroll", windowMouseMove);
    }
    if (options.touchControls) {
      window.addEventListener("touchstart", windowTouch);
      window.addEventListener("touchmove", windowTouch);
    }
    req = requestAnimationFrame(loop);
  }

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(options, next);
      if (next.backgroundColor != null || next.backgroundAlpha != null) applyClear();
    },
    destroy: bail,
  };
}
