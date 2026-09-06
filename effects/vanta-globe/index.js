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
// vanta-globe: a port of tengbao/vanta's GLOBE effect, commit
// f8b351906688b56f0fc744e53bde81fc3c56f150. It spans three upstream files --
// src/vanta.globe.js is the effect, src/_base.js is the class it extends (the
// renderer, the resize, the mouse plumbing and the 60fps-normalised animation
// loop all live there), and src/helpers.js supplies rn / getBrightness /
// clearThree plus the Number.prototype.clamp the effect leans on. A Vanta
// effect does not run without _base, so all three are cited in
// meta.json.origin.path and all three are inlined here: this repo's build
// emits only index.js and style.css per effect, so a shared base module has
// nowhere to live inside a generated site.
//
// Four objects make the picture and all four are upstream's, constant for
// constant: a rolling field of wired nodes off to one side, a wireframe
// sphere, a shell of 80 randomly-placed radial spokes around it, and the axis
// spindle. What changed is declared in meta.json.deviations, and the ones that
// matter are forced by three.js -- upstream pins r134, this repo vendors
// 0.185.1, where THREE.VertexColors no longer exists (it reads back undefined,
// which silently disables per-vertex colour on the node web instead of
// throwing), lights are no longer scaled by PI, and punctual lights fall off
// with the inverse square of distance.
//
// The guards are ours: failIfMajorPerformanceCaveat, one bail() every failure
// path lands in, and a resting state in style.css that is a finished hero.
import * as THREE from "../../vendor/three.module.js";

export const meta = {
  name: "vanta-globe",
  version: "1.0.0",
  category: "3d-hero",
  needs: ["three"],
  license: "MIT",
  options: {
    color: { type: "string", default: "#ff3f81", description: "Globe wireframe, node web and dot colour. Upstream default 0xff3f81." },
    color2: { type: "string", default: "#ffffff", description: "Orbital spokes and axis spindle. Upstream default 0xffffff." },
    backgroundColor: { type: "string", default: "#23153c", description: "Cleared behind the scene. Upstream default 0x23153c." },
    size: { type: "number", default: 1, description: "Globe radius multiplier; the sphere is 18 * size. Upstream default 1." },
    points: { type: "number", default: 10, description: "Node-field resolution; the field is (points+1)^2 nodes. Upstream default 10." },
    maxDistance: { type: "number", default: 20, description: "Node separation beyond which no line is drawn. Upstream default 20." },
    spacing: { type: "number", default: 15, description: "World-space gap between node-field columns. Upstream default 15." },
    showDots: { type: "boolean", default: true, description: "Draw a lit sphere at every node. Upstream default true." },
  },
};

// vanta.globe.js defaultOptions, plus the _base.js defaults this port keeps.
const DEFAULTS = {
  color: 0xff3f81,
  color2: 0xffffff,
  size: 1,
  backgroundColor: 0x23153c,
  points: 10,
  maxDistance: 20,
  spacing: 15,
  showDots: true,
  backgroundAlpha: 1,
  mouseControls: true,
  touchControls: true,
  minHeight: 200,
  minWidth: 200,
  scale: 1,
  scaleMobile: 1,
  mouseCoeffX: 1,
  mouseCoeffY: 1,
};

// helpers.js, minus the Number.prototype patch. Upstream defines
// Number.prototype.clamp; a library that ships into someone else's page does
// not get to extend a builtin, so the same maths is a local function.
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const rn = (a = 0, b = 1) => a + Math.random() * (b - a);
const getBrightness = (c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
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
  if (opts.color2 == null) options.color2 = cssVar(el, "--fx-color2", DEFAULTS.color2);
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
  canvas.className = "fx-globe__canvas";
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

  // ---- vanta.globe.js onInit --------------------------------------------
  const cont = new THREE.Group();
  cont.position.set(-50, -20, 0);
  scene.add(cont);

  const n = options.points;
  const spacing = options.spacing;
  const numPoints = n * n * 2;
  const linePositions = new Float32Array(numPoints * numPoints * 3);
  const lineColors = new Float32Array(numPoints * numPoints * 3);

  const colorB = getBrightness(new THREE.Color(options.color));
  const bgB = getBrightness(new THREE.Color(options.backgroundColor));
  const blending = colorB > bgB ? "additive" : "subtractive";

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.computeBoundingSphere();
  lineGeometry.setDrawRange(0, 0);
  const lineMaterial = new THREE.LineBasicMaterial({
    // Upstream writes `vertexColors: THREE.VertexColors`. That constant was
    // removed from three years ago; on 0.185.1 it reads back undefined, which
    // is falsy, so per-vertex colour switches OFF with no error and the whole
    // node web renders in the material's default white. `true` is the modern
    // spelling of the same instruction.
    vertexColors: true,
    // Upstream writes `null` on the non-additive branch. three has never
    // accepted null here -- it throws "Invalid blending" on r134 too -- so
    // this is upstream's own bug rather than a version break.
    blending: blending === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending,
    transparent: true,
  });
  const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
  cont.add(linesMesh);

  const points = [];
  // Upstream builds a geometry AND a material per node. One of each, shared,
  // renders the same picture; update() still recolours every dot by writing
  // the single material.
  const dotGeometry = options.showDots ? new THREE.SphereGeometry(0.25, 12, 12) : null;
  const dotMaterial = options.showDots ? new THREE.MeshLambertMaterial({ color: options.color }) : null;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const sphere = options.showDots ? new THREE.Mesh(dotGeometry, dotMaterial) : new THREE.Object3D();
      cont.add(sphere);
      sphere.position.set((i - n / 2) * spacing, 0, (j - n / 2) * spacing);
      points.push(sphere);
    }
  }

  const camera = new THREE.PerspectiveCamera(20, width / height, 0.01, 10000);
  camera.position.set(50, 100, 150);
  scene.add(camera);

  // Upstream: AmbientLight(0xffffff, 0.75) and SpotLight(0xffffff, 1) at
  // y=200, distance 400. Both intensities are multiplied by PI here and the
  // spot's decay pinned to 0. r134 ran three's legacy lighting path, which
  // scaled every light by PI and applied no inverse-square term; 0.185.1
  // removed useLegacyLights and defaults decay to 2, so left alone the spot
  // reaches the node field ~1/40000 as strong and every dot reads as unlit
  // black.
  const ambience = new THREE.AmbientLight(0xffffff, 0.75 * Math.PI);
  scene.add(ambience);

  const spot = new THREE.SpotLight(0xffffff, 1 * Math.PI);
  spot.position.set(0, 200, 0);
  spot.distance = 400;
  spot.decay = 0;
  spot.target = cont;
  scene.add(spot);

  // LINES BALL -- 80 radial spokes, each starting somewhere on a sphere of
  // radius 18-24 and running outward by another 1-6. The z/theta pair is the
  // standard trick for a uniform point on a sphere; a naive lat/long pair
  // would bunch the spokes at the poles.
  const cont2 = new THREE.Group();
  cont2.position.set(0, 15, 0);
  scene.add(cont2);

  const material2 = new THREE.LineBasicMaterial({ color: new THREE.Color(options.color2) });
  const linePoints = [];
  for (let i = 0; i < 80; i++) {
    const f1 = rn(18, 24);
    const f2 = f1 + rn(1, 6);
    const z = rn(-1, 1);
    const r = Math.sqrt(1 - z * z);
    const theta = rn(0, Math.PI * 2);
    const y = Math.sin(theta) * r;
    const x = Math.cos(theta) * r;
    linePoints.push(new THREE.Vector3(x * f1, y * f1, z * f1));
    linePoints.push(new THREE.Vector3(x * f2, y * f2, z * f2));
  }
  const linesMesh2 = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints), material2);
  linesMesh2.position.set(0, 0, 0);
  cont2.add(linesMesh2);

  // Poles -- the axis spindle, a stack of shortening rungs that reads as a
  // spun cylinder once it is rotating.
  const material3 = new THREE.LineBasicMaterial({ color: new THREE.Color(options.color2), linewidth: 2 });
  const linePoints3 = [new THREE.Vector3(0, 30, 0), new THREE.Vector3(0, -30, 0)];
  const num = 4;
  const heights = [17.9, 12, 8, 5, 3, 2, 1.5, 1.1, 0.8, 0.6, 0.45, 0.3, 0.2, 0.1, 0.05, 0.03, 0.02, 0.01];
  for (let i = 0; i < num; i++) {
    const x = 0.15 * Math.cos((i / num) * Math.PI * 2);
    const z = 0.15 * Math.sin((i / num) * Math.PI * 2);
    for (let j = 0; j < heights.length; j++) {
      const h = heights[j];
      const r = 6 * (j + 1);
      linePoints3.push(new THREE.Vector3(x * r, h, z * r));
      linePoints3.push(new THREE.Vector3(x * r, -h, z * r));
    }
  }
  const linesMesh3 = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints3), material3);
  linesMesh3.position.set(0, 0, 0);
  cont2.add(linesMesh3);

  // GLOBE -- edges of a low-band sphere, so it reads as a wireframe globe
  // rather than as every triangle of the tessellation.
  const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(options.color) });
  const sphereGeom = new THREE.SphereGeometry(18 * options.size, 18, 14);
  const sphere = new THREE.LineSegments(new THREE.EdgesGeometry(sphereGeom), wireMat);
  sphereGeom.dispose(); // EdgesGeometry has copied what it needs
  sphere.position.set(0, 0, 0);
  cont2.add(sphere);

  cont2.rotation.x = -0.25;
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

  // ---- vanta.globe.js onMouseMove ---------------------------------------
  const onMouseMove = (x, y) => {
    const c = camera;
    if (!c.oy) {
      c.oy = c.position.y;
      c.ox = c.position.x;
      c.oz = c.position.z;
    }
    const ang = Math.atan2(c.oz, c.ox);
    const dist = Math.sqrt(c.oz * c.oz + c.ox * c.ox);
    const tAng = ang + (x - 0.5) * 1.5 * (options.mouseCoeffX || 1);
    c.tz = dist * Math.sin(tAng);
    c.tx = dist * Math.cos(tAng);
    c.ty = c.oy + (y - 0.5) * 80 * (options.mouseCoeffY || 1);
  };

  // ---- vanta.globe.js onUpdate ------------------------------------------
  // Upstream's raycaster branch went with the raycaster: `this.rayCaster` is
  // only ever assigned on a commented-out line at the pinned commit, so
  // distToMouse is always 1000, distClamp always 15 and every node's scale
  // computes to exactly 1. Dead code, not a behaviour change.
  const bgColor = new THREE.Color();
  const color = new THREE.Color();
  const color2 = new THREE.Color();
  const diffColor = new THREE.Color();
  const lineColor = new THREE.Color();
  const lookTarget = new THREE.Vector3();
  const onUpdate = () => {
    let diff;
    const c = camera;
    if (Math.abs(c.tx - c.position.x) > 0.01) {
      diff = c.tx - c.position.x;
      c.position.x += diff * 0.02;
    }
    if (Math.abs(c.ty - c.position.y) > 0.01) {
      diff = c.ty - c.position.y;
      c.position.y += diff * 0.02;
    }
    // The globe sits right of centre on a wide screen and drifts back toward
    // the middle as the viewport narrows, which is what keeps it clear of the
    // copy column instead of sitting behind the headline on a phone.
    const lookX = window.innerWidth < 480 ? -10 : window.innerWidth < 720 ? -20 : -40;
    c.lookAt(lookTarget.set(lookX, 0, 0));

    let vertexpos = 0;
    let colorpos = 0;
    let numConnected = 0;

    bgColor.set(options.backgroundColor);
    color.set(options.color);
    color2.set(options.color2);
    diffColor.copy(color).sub(bgColor);

    linesMesh2.rotation.z += 0.002;
    linesMesh2.rotation.x += 0.0008;
    linesMesh2.rotation.y += 0.0005;
    sphere.rotation.y += 0.002;
    linesMesh3.rotation.y -= 0.004;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.position.y = 2 * Math.sin(p.position.x / 10 + t * 0.01 + (p.position.z / 10) * 0.5);

      for (let j = i; j < points.length; j++) {
        const p2 = points[j];
        const dx = p.position.x - p2.position.x;
        const dy = p.position.y - p2.position.y;
        const dz = p.position.z - p2.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < options.maxDistance) {
          const alpha = clamp((1.0 - dist / options.maxDistance) * 2, 0, 1);
          if (blending === "additive") lineColor.setRGB(0, 0, 0).lerp(diffColor, alpha);
          else lineColor.copy(bgColor).lerp(color, alpha);

          linePositions[vertexpos++] = p.position.x;
          linePositions[vertexpos++] = p.position.y;
          linePositions[vertexpos++] = p.position.z;
          linePositions[vertexpos++] = p2.position.x;
          linePositions[vertexpos++] = p2.position.y;
          linePositions[vertexpos++] = p2.position.z;

          lineColors[colorpos++] = lineColor.r;
          lineColors[colorpos++] = lineColor.g;
          lineColors[colorpos++] = lineColor.b;
          lineColors[colorpos++] = lineColor.r;
          lineColors[colorpos++] = lineColor.g;
          lineColors[colorpos++] = lineColor.b;

          numConnected++;
        }
      }
    }
    linesMesh.geometry.setDrawRange(0, numConnected * 2);
    linesMesh.geometry.attributes.position.needsUpdate = true;
    linesMesh.geometry.attributes.color.needsUpdate = true;

    sphere.material.color.set(color);
    linesMesh2.material.color.set(color2);
    linesMesh3.material.color.set(color2);
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
  // it normalises elapsed time to 60fps so the globe turns at one rate on a
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
  // pointer parallax, the real globe as a still image rather than a downgrade.
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
      if (next.color != null && dotMaterial) dotMaterial.color.set(options.color);
      if (next.backgroundColor != null || next.backgroundAlpha != null) applyClear();
    },
    destroy: bail,
  };
}
