// Page Transitions with WebGPU and Vanilla JavaScript
// MIT License
// Copyright (c) 2009 - 2025 Codrops (https://tympanus.net/codrops)
// https://github.com/bnpne/page-transitions-with-webgpu-vanilla-js
//
// plane-morph: a port of bnpne's persistent page transitions, commit
// 70e5c0eafb14cd1fdf02aef0799ba486dead46dc -- src/gpu.js (the plane pool, the
// camera FOV math, syncMesh, the rounded-box mask), src/transitions/
// constants.js, mainToInner.js and innerToMain.js (the choreography), the
// getMainTargets / getInnerTargets rect providers out of src/pages/home.js and
// src/pages/inner.js, and the tracking attach/detach out of src/controller.js.
//
// THE MECHANISM IS THAT THE PICTURES ARE NOT IN THE DOM. Every slot in this
// section is an empty box with a real layout rect and no pixels of its own; a
// GPU plane is parked over each one and reads its rect every frame. So changing
// view is not a crossfade between two pictures -- the SAME plane stays on the
// GPU and its bounds tween from the rect it had in the grid to the rect it has
// in the detail view, which is why the image appears to fly and rescale rather
// than to unload and reload. That technique, driving a GPU plane from a DOM
// element's position, is what this port is for.
//
// WEBGPU IS NOT A REQUIREMENT AND THE AUTHOR SAYS SO: "this works the same with
// WebGL, I have been using WebGPU as a modern alternative." No compute shader,
// no storage buffer, no indirect draw -- the scene is textured quads on a
// PerspectiveCamera. But upstream's src/gpu.js imports `three/webgpu` and
// `three/tsl`, a different three build from the classic three.module.js vendored
// here, so the file cannot run unchanged: WebGPURenderer becomes WebGLRenderer,
// and MeshBasicNodeMaterial + opacityNode becomes a ShaderMaterial whose
// fragment stage multiplies alpha by the same rounded-box SDF. That mask is the
// one new-API construct in the file and it is an ordinary fragment mask
// everywhere else. Everything after it -- the FOV matched to CAMERA_DISTANCE so
// the z=0 plane maps 1:1 to CSS pixels, getBoundingClientRect reads, the
// scale/position sync, renderOrder -- is plain three.js and survives untouched.
//
// GSAP IS BANNED HERE on licence grounds, and it was never the mechanism: every
// transition upstream tweens fields on ordinary JS objects (plane.bounds x/y/w/h
// and plane.opacity), which anime.js does natively. GSAP's powerN is degree N+1,
// so power3.inOut is inOutQuart, power2.out is outCubic and power2.in is
// inCubic. Seconds become milliseconds against MS. SplitText drove decorative
// heading reveals in controller.js and is not ported; the router, the preloader,
// the cursor, the carousel and the index page are not ported either.
//
// NO PHOTOGRAPH SHIPS. Upstream carries six Unsplash images, which are content
// under separate rights. The plane textures are read from each slot's own <img>,
// and the snippet points those at generated SVG plates. The slot has to stay a
// real <img>: its pixels ARE the texture, so it cannot be a CSS background.
import {
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "../../vendor/three.module.js";
import { animate } from "../../vendor/anime.esm.js";

export const meta = {
  name: "plane-morph",
  version: "1.0.0",
  category: "transition",
  needs: ["three", "anime"],
  license: "MIT",
  options: {
    morphDuration: { type: "number", default: 900, description: "Milliseconds a plane takes to fly and rescale between layouts. Upstream's DUR_MORPH of 0.9s." },
    fadeDuration: { type: "number", default: 500, description: "Milliseconds an opacity tween takes. Upstream's DUR_FADE of 0.5s." },
    cornerRadius: { type: "number", default: 8, description: "Corner radius of the rounded-box mask, in CSS pixels. Upstream's CORNER_RADIUS." },
  },
};

// src/transitions/constants.js. Seconds upstream, milliseconds here.
const MS = 1000;
const DUR_MORPH = 0.9 * MS;
const DUR_FADE = 0.5 * MS;
// gsap 'power3.inOut', 'power2.out', 'power2.in'. powerN is degree N+1.
const EASE_MORPH = "inOutQuart";
const EASE_FADE = "outCubic";
const EASE_FADE_OUT = "inCubic";

// src/gpu.js.
const CORNER_RADIUS = 8;
const CAMERA_DISTANCE = 1000;
const SATELLITES_PER_IMAGE = 4;

// mainToInner.in(): delay 0.25 + j * 0.08.
const SAT_IN_DELAY = 0.25 * MS;
const SAT_IN_STAGGER = 0.08 * MS;
// innerToMain.out(): duration DUR_FADE * 0.7, reversedDelay (n - 1 - j) * 0.05.
const SAT_OUT_SCALE = 0.7;
const SAT_OUT_STAGGER = 0.05 * MS;
// innerToMain.in(): delay 0.25.
const MAIN_IN_DELAY = 0.25 * MS;

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// roundedRectOpacityNode from src/gpu.js, written as GLSL. TSL's
// `dist.smoothstep(-1.0, 1.0).oneMinus()` is `1.0 - smoothstep(-1.0, 1.0, dist)`
// -- the same ~2px feather, 1 inside and 0 outside. uSize is the plane's pixel
// size, so the radius stays a constant number of pixels whatever the plane's
// dimensions, which is the whole reason upstream passes it in.
const FRAGMENT = `
uniform sampler2D uMap;
uniform vec2 uSize;
uniform float uRadius;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec2 half_ = uSize * 0.5;
  float r = min(min(uRadius, half_.x), half_.y);
  vec2 p = (vUv - 0.5) * uSize;
  vec2 q = abs(p) - half_ + r;
  float dist = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
  float mask = 1.0 - smoothstep(-1.0, 1.0, dist);

  vec4 texel = texture2D(uMap, vUv);
  gl_FragColor = vec4(texel.rgb, texel.a * mask * uOpacity);
  #include <colorspace_fragment>
}
`;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// getMainTargets / getInnerTargets: a rect list read off a NodeList of slots,
// measured against the section rather than the viewport because the scene is
// the section's box.
const rectsOf = (nodes, box) =>
  nodes.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  });

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const stage = el.querySelector(".fx-morph__stage");
  const gridSlots = [...el.querySelectorAll('[data-view="grid"] .fx-morph__slot')];
  const detailSlots = [...el.querySelectorAll('[data-view="detail"] .fx-morph__slot')];
  const back = el.querySelector(".fx-morph__back");
  if (!stage || !back || gridSlots.length < 2) return resting;
  if (detailSlots.length !== SATELLITES_PER_IMAGE + 1) return resting;

  const images = gridSlots.map((slot) => slot.querySelector(".fx-morph__img")).filter(Boolean);
  if (images.length !== gridSlots.length) return resting;

  const MAIN_COUNT = gridSlots.length;
  const mainIdx = (image) => image;
  const satIdx = (image, j) => MAIN_COUNT + image * SATELLITES_PER_IMAGE + j;

  const settings = {
    morphDuration: num(opts.morphDuration, DUR_MORPH, 1, 60000),
    fadeDuration: num(opts.fadeDuration, DUR_FADE, 1, 60000),
    cornerRadius: num(opts.cornerRadius, CORNER_RADIUS, 0, 200),
  };

  // View state lives in the DOM so the CSS-only resting state and the live one
  // agree about which view is showing. An empty id is not nullish, so the view
  // is a data attribute rather than an id lookup.
  const gridView = el.querySelector('[data-view="grid"]');
  const detailView = el.querySelector('[data-view="detail"]');
  const setView = (view, image) => {
    el.setAttribute("data-fx-view", view);
    if (image != null) el.setAttribute("data-fx-image", String(image));
    back.hidden = view !== "detail";
    // Neither view is display:none -- the incoming one has to have real rects
    // for the tween to fly to. inert is what keeps a keyboard out of the view
    // nobody can see, which opacity alone does not.
    if (gridView) gridView.inert = view !== "grid";
    if (detailView) detailView.inert = view !== "detail";
    for (const [i, slot] of gridSlots.entries()) {
      slot.setAttribute("aria-expanded", String(view === "detail" && i === image));
    }
  };

  // Reduced motion still swaps the views, instantly and with no GPU at all.
  // Stillness means no travel, not a second view nobody can reach -- the detail
  // view carries copy of its own, so hiding it outright would trap content
  // behind an animation the reader has asked not to see.
  if (reducedMotion()) {
    const detailImgs = detailSlots.map((s) => s.querySelector(".fx-morph__img")).filter(Boolean);
    // Every plane in the detail view carries the clicked picture's texture when
    // the GPU is driving it. With no GPU the DOM copies have to do the same, or
    // the detail view is five empty boxes.
    const openStill = (i) => {
      const src = images[i].currentSrc || images[i].src;
      for (const img of detailImgs) img.src = src;
      setView("detail", i);
    };
    const closeStill = () => setView("grid", null);
    const handlers = gridSlots.map((slot, i) => {
      const h = () => openStill(i);
      slot.addEventListener("click", h);
      return h;
    });
    back.addEventListener("click", closeStill);
    setView("grid", null);
    return {
      update() {},
      destroy() {
        gridSlots.forEach((slot, i) => slot.removeEventListener("click", handlers[i]));
        back.removeEventListener("click", closeStill);
        el.removeAttribute("data-fx-view");
        el.removeAttribute("data-fx-image");
      },
    };
  }

  let renderer = null;
  let canvas = null;
  let scene = null;
  let camera = null;
  let geometry = null;
  const textures = [];
  const planes = [];
  let raf = null;
  let ro = null;
  let torn = false;
  let mutating = false;
  let current = { view: "grid", image: null };
  const running = new Set();

  const bail = () => {
    for (const a of running) { try { a.pause(); } catch { /* already done */ } }
    running.clear();
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
    try { renderer?.dispose(); } catch { /* nothing to dispose */ }
    renderer?.domElement?.remove();
    renderer = null;
    el.removeAttribute("data-fx-live");
    return resting;
  };

  // GPU.setupCamera: the FOV is matched to the camera distance so the z=0 plane
  // maps 1:1 to CSS pixels, which is what lets a plane be scaled to a DOM rect
  // in pixels and land on it.
  const setupCamera = (w, h) => {
    const fov = 2 * Math.atan(h / 2 / CAMERA_DISTANCE) * (180 / Math.PI);
    camera = new PerspectiveCamera(fov, w / h, 0.1, CAMERA_DISTANCE * 2);
    camera.position.z = CAMERA_DISTANCE;
  };

  try {
    const box = stage.getBoundingClientRect();
    renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      failIfMajorPerformanceCaveat: true,
    });
    canvas = renderer.domElement;
    canvas.classList.add("fx-morph__canvas");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(1, box.width), Math.max(1, box.height));
    stage.appendChild(canvas);

    scene = new Scene();
    geometry = new PlaneGeometry(1, 1);
    setupCamera(Math.max(1, box.width), Math.max(1, box.height));
  } catch {
    return bail();
  }

  // GPU._createPlaneMaterial.
  const makePlane = (texture, kind, image, j) => {
    const material = new ShaderMaterial({
      transparent: true,
      uniforms: {
        uMap: { value: texture },
        uSize: { value: new Vector2(1, 1) },
        uRadius: { value: settings.cornerRadius },
        uOpacity: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    const plane = {
      mesh,
      material,
      bounds: { x: 0, y: 0, w: 0, h: 0, z: 0 },
      opacity: 0,
      trackedEl: null,
      kind,
      image,
      j,
    };
    planes.push(plane);
    return plane;
  };

  // GPU.loadTextures + createPlanes. One texture per picture; the five main
  // planes and the twenty satellites share them, exactly as upstream does.
  const loader = new TextureLoader();
  for (const img of images) {
    const tex = loader.load(img.currentSrc || img.src);
    tex.colorSpace = SRGBColorSpace;
    textures.push(tex);
  }
  for (let i = 0; i < MAIN_COUNT; i++) makePlane(textures[i], "main", i);
  for (let i = 0; i < MAIN_COUNT; i++) {
    for (let j = 0; j < SATELLITES_PER_IMAGE; j++) makePlane(textures[i], "satellite", i, j);
  }

  // GPU.syncMesh, measured in the section's pixel space rather than the
  // window's.
  const syncMesh = (plane, w, h) => {
    const { mesh, bounds, opacity } = plane;
    const pw = Math.max(bounds.w, 0.001);
    const ph = Math.max(bounds.h, 0.001);
    mesh.scale.set(pw, ph, 1);
    mesh.position.x = bounds.x + bounds.w / 2 - w / 2;
    mesh.position.y = -(bounds.y + bounds.h / 2 - h / 2);
    mesh.renderOrder = -(bounds.z ?? 0);
    plane.material.uniforms.uSize.value.set(pw, ph);
    plane.material.uniforms.uOpacity.value = opacity;
    mesh.visible = opacity > 0.001 && bounds.w > 0;
  };

  // Controller._syncPlaneToEl.
  const syncPlaneToEl = (plane, node, box) => {
    plane.trackedEl = node;
    const r = node.getBoundingClientRect();
    plane.bounds.x = r.left - box.left;
    plane.bounds.y = r.top - box.top;
    plane.bounds.w = r.width;
    plane.bounds.h = r.height;
  };

  // constants.js tweenBounds / tweenOpacity, on anime.
  const track = (a) => { running.add(a); a.then?.(() => running.delete(a)); return a; };
  const tweenBounds = (plane, target, o = {}) =>
    track(animate(plane.bounds, {
      x: target.x,
      y: target.y,
      w: target.w,
      h: target.h,
      z: target.z ?? 0,
      duration: o.duration ?? settings.morphDuration,
      ease: o.ease ?? EASE_MORPH,
      delay: o.delay ?? 0,
    }));
  const tweenOpacity = (plane, to, o = {}) =>
    track(animate(plane, {
      opacity: to,
      duration: o.duration ?? settings.fadeDuration,
      ease: o.ease ?? EASE_FADE,
      delay: o.delay ?? 0,
    }));

  // GPU.applyMainLayout / applyInnerLayout.
  const applyMainLayout = () => {
    for (let i = 0; i < MAIN_COUNT; i++) {
      planes[mainIdx(i)].opacity = 1;
      for (let j = 0; j < SATELLITES_PER_IMAGE; j++) planes[satIdx(i, j)].opacity = 0;
    }
  };
  const applyInnerLayout = (image) => {
    for (let i = 0; i < MAIN_COUNT; i++) {
      planes[mainIdx(i)].opacity = i === image ? 1 : 0;
      for (let j = 0; j < SATELLITES_PER_IMAGE; j++) {
        planes[satIdx(i, j)].opacity = i === image ? 1 : 0;
      }
    }
  };

  // Controller._enterPage, for the two views a section has.
  const attachGrid = () => {
    const box = stage.getBoundingClientRect();
    for (let i = 0; i < MAIN_COUNT; i++) syncPlaneToEl(planes[mainIdx(i)], gridSlots[i], box);
  };
  const attachDetail = (image) => {
    const box = stage.getBoundingClientRect();
    syncPlaneToEl(planes[mainIdx(image)], detailSlots[0], box);
    for (let j = 0; j < SATELLITES_PER_IMAGE; j++) {
      syncPlaneToEl(planes[satIdx(image, j)], detailSlots[j + 1], box);
    }
  };
  // Controller._leavePage: every plane stops tracking, so a tween owns its own
  // bounds for the length of the transition instead of fighting a rect read.
  const detachAll = () => { for (const p of planes) p.trackedEl = null; };

  // MainToInnerTransition. out() flies the clicked plane to the hero slot and
  // fades the other four away; in() drops the satellites at their own rects and
  // fades them up, 0.25s in and 0.08s apart.
  const mainToInner = async (image) => {
    const box = stage.getBoundingClientRect();
    const innerRects = rectsOf(detailSlots, box);
    const target = innerRects[0];
    const tweens = [];
    for (let i = 0; i < MAIN_COUNT; i++) {
      const plane = planes[mainIdx(i)];
      if (i === image) { tweens.push(tweenBounds(plane, target)); continue; }
      tweens.push(tweenOpacity(plane, 0));
    }
    await Promise.all(tweens);
    if (torn) return;

    const fades = [];
    for (let j = 0; j < SATELLITES_PER_IMAGE; j++) {
      const sat = planes[satIdx(image, j)];
      sat.bounds = { ...innerRects[j + 1] };
      sat.opacity = 0;
      fades.push(tweenOpacity(sat, 1, { delay: SAT_IN_DELAY + j * SAT_IN_STAGGER }));
    }
    await Promise.all(fades);
  };

  // InnerToMainTransition. out() flies the hero back to its grid rect while the
  // satellites fade away in reverse order; in() drops the other four mains at
  // their grid rects and fades them up.
  const innerToMain = async (image) => {
    const box = stage.getBoundingClientRect();
    const mainRects = rectsOf(gridSlots, box);
    const tweens = [tweenBounds(planes[mainIdx(image)], mainRects[image])];
    for (let j = 0; j < SATELLITES_PER_IMAGE; j++) {
      const sat = planes[satIdx(image, j)];
      const reversedDelay = (SATELLITES_PER_IMAGE - 1 - j) * SAT_OUT_STAGGER;
      tweens.push(tweenOpacity(sat, 0, {
        duration: settings.fadeDuration * SAT_OUT_SCALE,
        ease: EASE_FADE_OUT,
        delay: reversedDelay,
      }));
    }
    await Promise.all(tweens);
    if (torn) return;

    const fades = [];
    for (let i = 0; i < MAIN_COUNT; i++) {
      if (i === image) continue;
      const main = planes[mainIdx(i)];
      main.bounds = { ...mainRects[i] };
      main.opacity = 0;
      fades.push(tweenOpacity(main, 1, { delay: MAIN_IN_DELAY }));
    }
    await Promise.all(fades);
  };

  const go = async (view, image) => {
    if (mutating || torn) return;
    mutating = true;
    detachAll();
    // The DOM swaps first, so the incoming view has real rects for the tween to
    // read. Both views keep their boxes; only visibility changes.
    setView(view, image ?? current.image);
    if (view === "detail") {
      await mainToInner(image);
      if (torn) return;
      applyInnerLayout(image);
      attachDetail(image);
      current = { view, image };
    } else {
      const from = current.image ?? 0;
      await innerToMain(from);
      if (torn) return;
      applyMainLayout();
      attachGrid();
      current = { view: "grid", image: null };
    }
    mutating = false;
  };

  // GPU.update: every tracking plane re-reads its rect, then the whole scene is
  // drawn. A plane mid-tween is not tracking, so the tween's bounds win.
  const render = () => {
    if (torn || !renderer) return;
    const box = stage.getBoundingClientRect();
    for (const p of planes) {
      if (p.trackedEl) {
        const r = p.trackedEl.getBoundingClientRect();
        p.bounds.x = r.left - box.left;
        p.bounds.y = r.top - box.top;
        p.bounds.w = r.width;
        p.bounds.h = r.height;
      }
      syncMesh(p, box.width, box.height);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  };

  // GPU.onResize plus Controller._reapplyLayout.
  const resize = () => {
    if (torn || !renderer) return;
    const box = stage.getBoundingClientRect();
    const w = Math.max(1, box.width);
    const h = Math.max(1, box.height);
    camera.fov = 2 * Math.atan(h / 2 / CAMERA_DISTANCE) * (180 / Math.PI);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (mutating) return;
    if (current.view === "grid") attachGrid();
    else attachDetail(current.image);
  };

  const onSlotClick = (i) => (e) => {
    e.preventDefault();
    if (current.view === "grid") go("detail", i);
  };
  const slotHandlers = gridSlots.map((slot, i) => {
    const h = onSlotClick(i);
    slot.addEventListener("click", h);
    return h;
  });
  const onBack = (e) => { e.preventDefault(); if (current.view === "detail") go("grid"); };
  back.addEventListener("click", onBack);

  const onContextLost = (e) => { e.preventDefault(); bail(); };
  canvas.addEventListener("webglcontextlost", onContextLost);

  ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
  ro?.observe(stage);

  setView("grid", null);
  applyMainLayout();
  attachGrid();
  // data-fx-live is what empties the slots of their own pixels. It is set only
  // once the renderer exists and the planes are placed, so a refused context
  // leaves five real pictures on screen instead of five empty boxes.
  el.setAttribute("data-fx-live", "");
  render();

  return {
    update(next = {}) {
      if ("morphDuration" in next) settings.morphDuration = num(next.morphDuration, DUR_MORPH, 1, 60000);
      if ("fadeDuration" in next) settings.fadeDuration = num(next.fadeDuration, DUR_FADE, 1, 60000);
      if ("cornerRadius" in next) {
        settings.cornerRadius = num(next.cornerRadius, CORNER_RADIUS, 0, 200);
        for (const p of planes) p.material.uniforms.uRadius.value = settings.cornerRadius;
      }
    },
    destroy() {
      torn = true;
      for (const a of running) { try { a.pause(); } catch { /* already done */ } }
      running.clear();
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      gridSlots.forEach((slot, i) => slot.removeEventListener("click", slotHandlers[i]));
      back.removeEventListener("click", onBack);
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      ro?.disconnect();
      ro = null;
      for (const p of planes) p.material.dispose();
      planes.length = 0;
      geometry?.dispose();
      for (const t of textures) t.dispose();
      textures.length = 0;
      try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
      try { renderer?.dispose(); } catch { /* already gone */ }
      renderer?.domElement?.remove();
      renderer = null;
      scene = null;
      el.removeAttribute("data-fx-live");
      el.removeAttribute("data-fx-view");
      el.removeAttribute("data-fx-image");
    },
  };
}
