// Animating Shaders with GSAP
// MIT License
// Copyright (c) 2025 Andrea Biason
// https://github.com/biazo/codrops-animate-shaders-with-gsap
//
// shader-ripple-tiles: a port of demo 1 of Andrea Biason's "Animating Shaders
// with GSAP" for Codrops, commit bdd17aa4cf4b1464f4bcf526a863ed8dd46d394d.
// Four upstream files carry the effect -- src/js/demo1/Effect.js (the click,
// the raycast and the two timelines), Stage.js (the renderer, the orthographic
// camera and one plane per <img>), PlanesMaterial.js (the uniforms) and
// src/js/utils.js (getWorldPositionFromDOM) -- plus base.vert and base.frag,
// both carried byte for byte below.
//
// THE MECHANISM. A WebGL plane is parked exactly over each <img> in the grid:
// the camera is orthographic in pixel units, so a plane scaled to the image's
// box and placed at the image's centre lines up with it to the pixel, and the
// DOM image itself is hidden once the canvas is live. At rest every tile
// renders greyscale, which is what uGrayscaleProgress 0 means in base.frag.
// Click one and the raycast finds its plane: the colour then floods in as a
// circle expanding from the click point, normalised by the distance to the
// furthest corner so the wipe finishes at the same moment wherever it started,
// while the vertex shader rides a decaying sine ripple out from that same
// point over the same 1.5s. Click it again and the same pass runs with
// uDirection flipped, which takes the colour back out. Clicking a different
// tile resets the previous one to greyscale first.
//
// src/js/demo*/main.js IS DELIBERATELY NOT PORTED, and its exclusion is the
// reason this port is possible at all. It is a Draggable + InertiaPlugin +
// ScrollTrigger carousel shell -- InertiaPlugin is Club GreenSock, paid -- and
// nothing in it is the effect. Demo 1 is the one that can lose it for free:
// its own index.html mounts the tiles on .content__carousel-inner-static, a
// plain four-column CSS grid, so the shell is already inert there.
//
// GSAP IS BANNED HERE. What it did, and what does it now:
//   gsap.timeline({defaults:{duration:1.5, ease:'power3.inOut'}})
//                             -> createTimeline, 1500ms, ease 'inOutQuart'.
//                                GSAP's powerN is degree N+1, so power3 is a
//                                QUARTIC. power2.out on the reset timeline is
//                                'outCubic' for the same reason.
//   .set(uniform, {value}, 0)  -> a direct write before the timeline starts.
//   .fromTo(u, {value:0}, {value:1})
//                             -> .add(u, { value: [0, 1] }), which is anime's
//                                from-to shape for a plain number pair.
//   .to(u, {keyframes:{value:[0,1,0]}})
//                             -> .add(u, { value: [{to:1},{to:0}] }). A plain
//                                array in anime is from-to, NOT a keyframe
//                                list, so [0,1,0] here would silently animate
//                                0 -> 1 and stop with the ripple stuck out.
//   gsap.ticker.add(render)    -> a requestAnimationFrame loop this mount owns
//                                and cancels on destroy.
//   Observer.create({type:'touch,pointer', onClick}) -> a pointerdown listener
//                                on the section. Observer is a free plugin and
//                                it is only a pointer abstraction here.
//
// NO PHOTOGRAPHY SHIPS. Upstream carries 6.5 MB of generated imagery across 79
// files, licensed separately from its MIT code. The shader works on whatever
// texture it is handed, so the tiles here point at generated SVG plates and a
// site swaps the <img src> for its own picture. The image slot has to stay a
// real <img>: the plate is the texture, so it cannot be a CSS background.
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "../../vendor/three.module.js";
import { createTimeline } from "../../vendor/anime.esm.js";

export const meta = {
  name: "shader-ripple-tiles",
  version: "1.0.0",
  category: "3d-hero",
  needs: ["three", "anime"],
  license: "MIT",
  options: {
    duration: { type: "number", default: 1500, description: "Milliseconds the wipe and the ripple take. Upstream's 1.5s timeline default in Effect.js animate()." },
    resetDuration: { type: "number", default: 1000, description: "Milliseconds the previous tile takes to fall back to colour when another is clicked. Upstream's 1s in Effect.js resetMaterial()." },
    timeStep: { type: "number", default: 0.1, description: "How much uTime advances each frame of a run, which is what makes the ripple travel. Upstream's uTime.value += 0.1." },
  },
};

const UPSTREAM = { duration: 1500, resetDuration: 1000, timeStep: 0.1 };

// gsap 'power3.inOut' and 'power2.out'. GSAP's powerN is degree N+1.
const EASE = "inOutQuart";
const RESET_EASE = "outCubic";

// src/js/demo1/base.vert, byte for byte.
const BASE_VERT = `
#define AMP 0.1
#define FREQ 8.0
#define PI 3.14159265359

varying vec2 vUv;
varying float vRipple;

uniform float uRippleProgress;
uniform float uTime;
uniform vec2 uMouse;

void main() {
  vec3 pos = position;

  float dist = distance(uv, uMouse);
  float decay = clamp(dist, 8.0, 10.0);
  float ripple = sin(-PI * FREQ * dist + uTime) * (AMP / decay);

  ripple *= uRippleProgress;
  pos.y += ripple;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  vUv = uv;
  vRipple = ripple;
}
`;

// src/js/demo1/base.frag, byte for byte.
const BASE_FRAG = `
varying vec2 vUv;
varying float vRipple;

uniform float uGrayscaleProgress;
uniform vec2 uMouse;
uniform float uDirection;
uniform sampler2D uTexture;

vec3 toGrayscale(vec3 color) {
  float gray = dot(color, vec3(0.299, 0.587, 0.114));

  return vec3(gray);
}

// Calculates the maximum distance from the given point to the 4 corners of the plane (in UV coordinates)
float getMaxDistFromCorners(vec2 coords) {
  float dist_bl = distance(coords, vec2(0.0, 0.0)); // Bottom-Left
  float dist_br = distance(coords, vec2(1.0, 0.0)); // Bottom-Right
  float dist_tl = distance(coords, vec2(0.0, 1.0)); // Top-Left
  float dist_tr = distance(coords, vec2(1.0, 1.0)); // Top-Right

  // Returns the largest of the four distances
  return max(dist_tl, max(dist_bl, max(dist_tr, dist_br)));
}

void main() {
  vec4 diffuse = texture2D(uTexture, vUv);
  vec3 grayscale = toGrayscale(diffuse.rgb);

  float dist = distance(vUv, uMouse);
  // Calculates the maximum possible distance from the mouse point to one of the 4 corners
  float maxDist = getMaxDistFromCorners(uMouse);
  float mask = smoothstep(uGrayscaleProgress - 0.1, uGrayscaleProgress, dist / maxDist);

  vec3 color1 = uDirection > 0.0 ? diffuse.rgb : grayscale;
  vec3 color2 = uDirection > 0.0 ? grayscale : diffuse.rgb;

  // The mask always expands from the center outward
  vec3 color = mix(color1, color2, mask);

  color += vRipple * 2.;

  gl_FragColor = vec4(color, diffuse.a);
}
`;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// gsap's tl.isActive(), in anime's vocabulary.
const isActive = (tl) => !!tl && !tl.completed && !tl.paused && !tl.cancelled;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const container = el.querySelector(".fx-tiles__stage");
  if (!container) return resting;

  const DOMElements = Array.from(container.querySelectorAll(".fx-tiles__img"));
  if (!DOMElements.length) return resting;

  // Reduced motion leaves the grid as the stylesheet drew it: the images are
  // the content, and they are already on screen.
  if (reducedMotion()) return resting;

  const settings = {
    duration: num(opts.duration, UPSTREAM.duration, 1, 60000),
    resetDuration: num(opts.resetDuration, UPSTREAM.resetDuration, 1, 60000),
    timeStep: num(opts.timeStep, UPSTREAM.timeStep, 0, 10),
  };

  let renderer = null;
  let raf = null;
  let torn = false;

  // Every WebGL failure -- no context, a context refused for a major
  // performance caveat, a browser without the API at all -- lands here and
  // leaves the section exactly as the stylesheet drew it.
  const bail = () => {
    try { renderer?.dispose(); } catch { /* nothing to dispose */ }
    renderer?.domElement?.remove();
    renderer = null;
    el.removeAttribute("data-fx-live");
    return resting;
  };

  let scene;
  let camera;
  let raycaster;
  try {
    // Stage's constructor. failIfMajorPerformanceCaveat is ours: a software
    // rasteriser would paint this at a few frames a second, and the CSS
    // resting state is the better answer.
    renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      antialias: true,
      alpha: true,
      failIfMajorPerformanceCaveat: true,
    });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));

    renderer.domElement.classList.add("fx-tiles__canvas");
    container.appendChild(renderer.domElement);

    scene = new Scene();

    // Upstream frames the camera on the window, because its stage is the
    // window. Here it is the section's own box, in the same pixel units.
    const { width, height } = container.getBoundingClientRect();
    camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, -1000, 1000);
    camera.position.z = 10;
    renderer.setSize(width, height);

    raycaster = new Raycaster();
  } catch {
    return bail();
  }

  // PlanesMaterial.
  const planesMaterial = (texture) =>
    new ShaderMaterial({
      vertexShader: BASE_VERT,
      fragmentShader: BASE_FRAG,
      uniforms: {
        uGrayscaleProgress: { value: 0 },
        uRippleProgress: { value: 0 },
        uTime: { value: 0 },
        uDirection: { value: 1 },
        uMouse: { value: new Vector2(0.5, 0.5) },
        uTexture: { value: texture },
      },
    });

  // Stage.generatePlane / setUpPlanes.
  const loader = new TextureLoader();
  const textures = [];
  for (const image of DOMElements) {
    const texture = loader.load(image.currentSrc || image.src);
    texture.colorSpace = SRGBColorSpace;
    textures.push(texture);
    scene.add(new Mesh(new PlaneGeometry(1, 1, 50, 50), planesMaterial(texture)));
  }

  // utils.js getWorldPositionFromDOM, measured against the section's box
  // rather than the window's, which is the same number when the section is the
  // page and the right one when it is not.
  const getWorldPositionFromDOM = (element, box) => {
    const rect = element.getBoundingClientRect();

    const xNDC = (rect.left - box.left + rect.width / 2) / box.width * 2 - 1;
    const yNDC = -((rect.top - box.top + rect.height / 2) / box.height * 2 - 1);

    const xWorld = xNDC * (camera.right - camera.left) / 2;
    const yWorld = yNDC * (camera.top - camera.bottom) / 2;

    return new Vector3(xWorld, yWorld, 0);
  };

  // Effect.animate(). The three .set() calls upstream folds into the timeline
  // at position 0 are direct writes: a uniform holding a Vector2 is not a
  // tween target, and writing them before the timeline starts is what upstream
  // means by putting them at 0.
  const animate = (material, userData, mouseCoords) => {
    material.uniforms.uMouse.value = mouseCoords;
    material.uniforms.uDirection.value = userData.isBw ? 1.0 : -1.0;
    material.uniforms.uRippleProgress.value = 0;

    return createTimeline({
      defaults: { duration: settings.duration, ease: EASE },
      // Update the uTime uniform continuously during the animation
      onUpdate: () => { material.uniforms.uTime.value += settings.timeStep; },
    })
      // Animate grayscale progress from 0 to 1
      .add(material.uniforms.uGrayscaleProgress, { value: [0, 1] }, 0)
      // Animate a ripple effect using a keyframe sequence [0 -> 1 -> 0]
      .add(material.uniforms.uRippleProgress, { value: [{ to: 1 }, { to: 0 }] }, 0);
  };

  // Effect.resetMaterial().
  const resetMaterial = (object) => {
    const u = object.material.uniforms;
    u.uMouse.value = { x: 0.5, y: 0.5 };
    u.uDirection.value = 1.0;
    u.uRippleProgress.value = 0;

    createTimeline({
      defaults: { duration: settings.resetDuration, ease: RESET_EASE },
      onUpdate: () => { u.uTime.value += settings.timeStep; },
      onComplete: () => { object.userData.isBw = false; },
    })
      .add(u.uGrayscaleProgress, { value: [1, 0] }, 0)
      .add(u.uRippleProgress, { value: [{ to: 1 }, { to: 0 }] }, 0);
  };

  // Effect.onClick(). Upstream reads e.x against the window; the pointer is
  // normalised against the section's box for the same reason the camera is.
  let activeObject = null;
  const onPointerDown = (e) => {
    const box = container.getBoundingClientRect();
    const normCoords = {
      x: (e.clientX - box.left) / box.width * 2 - 1,
      y: -((e.clientY - box.top) / box.height) * 2 + 1,
    };

    raycaster.setFromCamera(normCoords, camera);

    const [intersection] = raycaster.intersectObjects(scene.children);

    if (intersection) {
      const { material, userData } = intersection.object;

      if (activeObject && intersection.object !== activeObject && activeObject.userData.isBw) {
        resetMaterial(activeObject);

        // Stops timeline if active
        if (isActive(activeObject.userData.tl)) activeObject.userData.tl.cancel();

        // Cleans timeline
        activeObject.userData.tl = null;
      }

      activeObject = intersection.object;

      // Only trigger animation if one is not already active
      if (!isActive(userData.tl)) {
        // Toggle isBw state (black and white mode)
        intersection.object.userData.isBw = !userData.isBw;

        // Store the animation timeline on the object to avoid overlapping animations
        userData.tl = animate(material, userData, intersection.uv);
      }
    }
  };

  // Stage.resize().
  const resize = () => {
    if (torn || !renderer) return;
    const box = container.getBoundingClientRect();
    if (!box.width || !box.height) return;

    camera.left = -box.width / 2;
    camera.right = box.width / 2;
    camera.top = box.height / 2;
    camera.bottom = -box.height / 2;
    camera.updateProjectionMatrix();

    DOMElements.forEach((image, index) => {
      const { width: imageWidth, height: imageHeight } = image.getBoundingClientRect();
      scene.children[index].scale.set(imageWidth, imageHeight, 1);
    });

    renderer.setSize(box.width, box.height);
  };

  // Stage.render(), driven by a frame loop this mount owns rather than by
  // gsap.ticker.
  const render = () => {
    if (torn || !renderer) return;
    renderer.render(scene, camera);

    const box = container.getBoundingClientRect();
    DOMElements.forEach((image, index) => {
      scene.children[index].position.copy(getWorldPositionFromDOM(image, box));
    });

    raf = requestAnimationFrame(render);
  };

  container.addEventListener("pointerdown", onPointerDown);

  const ro = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => resize())
    : null;
  ro?.observe(container);

  resize();
  // data-fx-live is what fades the DOM images out. It is set only once the
  // renderer exists and the planes are placed, so a refused context leaves the
  // grid of real images on screen instead of an empty box.
  el.setAttribute("data-fx-live", "");
  render();

  return {
    update(next = {}) {
      if ("duration" in next) settings.duration = num(next.duration, UPSTREAM.duration, 1, 60000);
      if ("resetDuration" in next) settings.resetDuration = num(next.resetDuration, UPSTREAM.resetDuration, 1, 60000);
      if ("timeStep" in next) settings.timeStep = num(next.timeStep, UPSTREAM.timeStep, 0, 10);
    },
    destroy() {
      torn = true;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      container.removeEventListener("pointerdown", onPointerDown);
      ro?.disconnect();
      for (const child of scene?.children ?? []) {
        if (isActive(child.userData.tl)) child.userData.tl.cancel();
        child.userData.tl = null;
        child.geometry?.dispose();
        child.material?.dispose();
      }
      for (const texture of textures) texture.dispose();
      try { renderer?.dispose(); } catch { /* already gone */ }
      renderer?.domElement?.remove();
      renderer = null;
      activeObject = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
