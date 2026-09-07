// 3d-wave-grid
// MIT License
// Copyright (c) 2026 franky-adl
// https://github.com/franky-adl/3d-wave-grid
//
// wave-grid: a port of franky-adl's 3d-wave-grid, commit
// f1fe51434c294008b7e40d51579711b522f1e27f -- src/ThreeJS/Stage.js (the
// instanced field, the injected vertex and fragment chunks, the lighting),
// src/ThreeJS/Effects/MouseTrail.js (the trail texture and the idle points),
// src/ThreeJS/Camera.js (the orbit and the pointer lerp),
// src/ThreeJS/Renderer.js (tone mapping and shadows) and src/script.js (the
// staggered copy fade-in).
//
// THE MECHANISM IS A TRAIL TEXTURE, NOT A NOISE FIELD. Every pointer move that
// travels far enough drops a point into a ring buffer of at most 128, and the
// whole buffer is uploaded each frame as a 128x1 RGBA float DataTexture whose
// texels are (worldX, worldZ, age, distDelta). The vertex shader, injected into
// MeshPhongMaterial through onBeforeCompile, walks that texture for every top
// vertex of every cube and sums a Gaussian window centred on an expanding
// wavefront -- speed times age -- times a cosine oscillation about it, an
// exponential time fade and a 1/(1+dist) attenuation. Weights are averaged
// rather than stacked, which is what stops overlapping ripples from turning
// into noise. The same chunk is injected into a MeshDepthMaterial so the
// shadows follow the wave instead of the flat grid.
//
// THE POST-PROCESSING PASS IS DROPPED, deliberately, and this is the one visible
// difference from upstream. Its Renderer.js builds an EffectComposer with a
// RenderPass, a ShaderPass carrying VignetteRGBShiftShader and an OutputPass,
// all four imported from three/addons -- and paw-fx vendors core three only,
// with no addons and no effect in the library touching them. Hand-rolling a
// composer to recover an edge vignette with a 0.005 colour fringe would be
// forty lines of our own code standing in for a file we are not allowed to
// import, which is the shape of invention this library's gate exists to catch.
// The field, the trail, the shadows and the lighting are what make it look
// expensive; the fringe is the frame around them. Tone mapping and exposure are
// kept, because those are renderer properties and still apply when drawing
// straight to the screen without an OutputPass.
//
// GSAP WAS ONE STAGGERED FADE in src/script.js -- opacity 0 to 1 and y 20 to 0
// across eight copy selectors, 1s, power3.out, 0.1s stagger, 0.5s delay. GSAP's
// powerN is degree N+1, so power3.out is outQuart. Seconds become milliseconds
// against MS. lil-gui, stats.js and mitt are debug and plumbing: the panel and
// the FPS meter do not ship, and the resize emitter is a plain listener.
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  FloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhongMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RGBAFormat,
  Scene,
  Timer,
  Vector2,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from "../../vendor/three.module.js";
import { animate, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "wave-grid",
  version: "1.0.0",
  category: "3d-hero",
  needs: ["three", "anime"],
  license: "MIT",
  options: {
    gridSize: { type: "number", default: 40, description: "Cubes per side. Upstream's gridSize, which is 1600 instances at 40." },
    waveSpeed: { type: "number", default: 6, description: "How fast a wavefront travels outward, in world units per second. Upstream's waveSpeed." },
    waveAmplitude: { type: "number", default: 0.4, description: "How far a crest lifts a cube before the clamp. Upstream's waveAmplitude." },
    colorHigh: { type: "string", default: "#0055ff", description: "Colour a cube reaches at full crest height. Upstream's colorHigh." },
    colorBase: { type: "string", default: "#ffffff", description: "Colour of a cube at rest. Upstream's colorBase; the scene background is half of it." },
    distance: { type: "number", default: 12, description: "How far the camera sits above the field, in world units. Upstream's Camera radius, which its own panel exposes over 10 to 20; higher shows more of the field at once." },
  },
};

// Stage.js params and Camera.js fields, verbatim.
const UPSTREAM = {
  gridSize: 40,
  cubeWidth: 0.8,
  cubeHeight: 3,
  gap: 0.01,
  waveAmplitude: 0.4,
  waveSpeed: 6.0,
  waveFrequency: 1.2,
  waveWidth: 3.0,
  waveJitter: 0.2,
  waveMaxHeight: 0.4,
  colorBase: "#ffffff",
  colorHigh: "#0055ff",
  radius: 12,
  alphaRange: Math.PI * 0.03,
  betaRange: Math.PI * 0.05,
  mouseLerp: 0.04,
  fov: 40,
  near: 0.1,
  far: 200,
  exposure: 1.95,
};

// MouseTrail.js. MAX_TRAIL must stay 128: the vertex shader divides by it.
const MAX_TRAIL = 128;
const FADE_TIME = 2.0;
const TRAIL_SPACING = 0.1;
const IDLE_AFTER = 3.0;
const IDLE_EVERY = 1.5;
const IDLE_STRENGTH = 0.8;

// script.js's gsap.fromTo. Seconds upstream, milliseconds here; power3.out is
// outQuart because GSAP's powerN is degree N+1.
const MS = 1000;
const COPY_DURATION = 1 * MS;
const COPY_STAGGER = 0.1 * MS;
const COPY_DELAY = 0.5 * MS;
const COPY_EASE = "outQuart";
const COPY_Y = 20;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Stage.overrideVertexShader, shared by the lit material and the depth material
// so both passes deform identically. Upstream's chunk, unchanged.
const overrideVertexShader = (vertexShader) =>
  vertexShader
    .replace(
      "#include <common>",
      `#include <common>
                varying float vHeight;
                attribute vec2 aOffset;
                uniform sampler2D uTrailTexture;
                uniform int       uTrailCount;
                uniform float     uWaveSpeed;
                uniform float     uWaveFreq;
                uniform float     uWaveWidth;
                uniform float     uFadeTime;
                uniform float     uAmplitude;
                uniform float     uJitter;
                uniform float     uMaxHeight;

                // Deterministic per-instance hash → two values in [-0.5, 0.5].
                // Stable across frames; depends only on world position.
                vec2 hash2( vec2 p ) {
                    p = vec2(
                        dot( p, vec2( 127.1, 311.7 ) ),
                        dot( p, vec2( 269.5, 183.3 ) )
                    );
                    return fract( sin( p ) * 43758.5453123 ) - 0.5;
                }`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>

                vHeight = 0.0;

                if ( position.y > 0.0 ) {
                    vec2 jitter  = hash2( aOffset ) * uJitter;
                    vec2 worldXZ = aOffset + jitter;
                    float waveHeight  = 0.0;
                    float totalWeight = 0.0;

                    for ( int i = 0; i < uTrailCount; i++ ) {
                        // texel layout: (worldX, worldZ, age, distDelta)
                        vec4 td = texture2D(
                            uTrailTexture,
                            vec2( ( float(i) + 0.5 ) / 128.0, 0.5 )
                        );
                        float dist      = length( worldXZ - td.rg );
                        float wavefront = uWaveSpeed * td.b;
                        float relDist   = dist - wavefront;

                        // Gaussian envelope centred on the expanding wavefront
                        float window = exp( -( relDist * relDist ) / ( uWaveWidth * uWaveWidth ) );
                        // Exponential time-fade + distance attenuation
                        float fade   = exp( -td.b / uFadeTime );
                        float atten  = 1.0 / ( 1.0 + dist * 0.1 );
                        float weight = fade * window * atten * td.a; // td.a is distDelta, used to weaken waves from closely spaced trail points

                        waveHeight  += weight * cos( uWaveFreq * relDist );
                        totalWeight += weight;
                    }

                    // Weighted average: overlapping waves average rather than stack,
                    // cancelling chaotic superposition while preserving single-wave peaks.
                    waveHeight /= max( totalWeight, 1.0 );

                    float displacement = clamp( waveHeight * uAmplitude, -uMaxHeight, uMaxHeight );
                    transformed.y += displacement;
                    vHeight = displacement;
                }`,
    );

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const stage = el.querySelector(".fx-wave__stage");
  if (!stage) return resting;

  const copy = [...el.querySelectorAll(".fx-wave__fade")];

  // Stillness at rest: the stylesheet already draws the cube field and the copy
  // is already at full opacity, so nothing here has to run for the section to
  // read. Only the field and the fade are dropped.
  if (reducedMotion()) return resting;

  const settings = {
    gridSize: Math.round(num(opts.gridSize, UPSTREAM.gridSize, 4, 120)),
    waveSpeed: num(opts.waveSpeed, UPSTREAM.waveSpeed, 0.1, 40),
    waveAmplitude: num(opts.waveAmplitude, UPSTREAM.waveAmplitude, 0, 10),
    colorHigh: typeof opts.colorHigh === "string" ? opts.colorHigh : UPSTREAM.colorHigh,
    colorBase: typeof opts.colorBase === "string" ? opts.colorBase : UPSTREAM.colorBase,
    distance: num(opts.distance, UPSTREAM.radius, 4, 60),
  };

  let renderer = null;
  let canvas = null;
  let scene = null;
  let camera = null;
  let timer = null;
  let mesh = null;
  let geometry = null;
  let material = null;
  let depthMaterial = null;
  let trailTexture = null;
  let rayPlane = null;
  let shaderRef = null;
  let ro = null;
  let fade = null;
  let torn = false;

  const bail = () => {
    try { fade?.pause(); } catch { /* never started */ }
    fade = null;
    renderer?.setAnimationLoop?.(null);
    try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
    try { renderer?.dispose(); } catch { /* nothing to dispose */ }
    renderer?.domElement?.remove();
    renderer = null;
    el.removeAttribute("data-fx-live");
    return resting;
  };

  const size = () => {
    const b = stage.getBoundingClientRect();
    return { width: Math.max(1, b.width), height: Math.max(1, b.height), rect: b };
  };

  try {
    // Renderer.setInstance, plus failIfMajorPerformanceCaveat: 1600 shadow-
    // casting solids on a software rasteriser is a slideshow, and the CSS
    // resting state is the better answer.
    renderer = new WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: true });
    canvas = renderer.domElement;
    canvas.classList.add("fx-wave__canvas");
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = UPSTREAM.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setClearColor("#808080");
    stage.appendChild(canvas);
  } catch {
    return bail();
  }

  const { width, height } = size();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new Scene();
  scene.background = new Color(settings.colorBase).multiplyScalar(0.5); // half of uColorBase for a more subtle background

  // Camera.setInstance / _updatePosition. The camera orbits above the field and
  // the pointer nudges it, lerped.
  camera = new PerspectiveCamera(UPSTREAM.fov, width / height, UPSTREAM.near, UPSTREAM.far);
  const mouse = new Vector2(0, 0);
  const lerpedMouse = new Vector2(0, 0);
  const updateCameraPosition = (mx, my) => {
    const alpha = my * UPSTREAM.alphaRange;
    const beta = mx * UPSTREAM.betaRange;
    camera.position.set(
      -settings.distance * Math.cos(alpha) * Math.sin(beta),
      settings.distance * Math.cos(alpha) * Math.cos(beta),
      settings.distance * Math.sin(alpha),
    );
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
  };
  updateCameraPosition(0, 0);
  scene.add(camera);

  // Stage.setLighting, minus the CameraHelper, which is a debug gizmo.
  const ambient = new AmbientLight("#ffffff", 0.5);
  scene.add(ambient);
  const key = new DirectionalLight("#ffffff", 4.0);
  key.position.set(-20, 10, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.bias = 0.0001;
  scene.add(key);
  const fill = new DirectionalLight("#ffffff", 1.0);
  fill.position.set(10, 5, -3);
  fill.castShadow = false;
  scene.add(fill);

  // MouseTrail state, held here rather than in its own class because the class
  // only existed to reach the Orchestrator singleton.
  const bounds = settings.gridSize * (UPSTREAM.cubeWidth + UPSTREAM.gap);
  const trail = [];
  let lastPoint = null;
  let timeSinceLastMove = 0;
  let idleTimer = 0;
  let placingIdlePoints = true; // Start with random points immediately
  const trailData = new Float32Array(MAX_TRAIL * 4);
  trailTexture = new DataTexture(trailData, MAX_TRAIL, 1, RGBAFormat, FloatType);
  trailTexture.needsUpdate = true;
  const trailUniforms = {
    uTrailTexture: { value: trailTexture },
    uTrailCount: { value: 0 },
    uFadeTime: { value: FADE_TIME },
  };

  // Invisible horizontal plane for pointer -> world-space raycasting.
  rayPlane = new Mesh(
    new PlaneGeometry(bounds, bounds),
    new MeshBasicMaterial({ side: DoubleSide, visible: false }),
  );
  rayPlane.rotation.x = -Math.PI / 2;
  rayPlane.updateMatrixWorld(true);
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const addTrailPoint = (x, z, distDelta) => {
    if (trail.length >= MAX_TRAIL) trail.shift();
    trail.push({ x, z, age: 0, distDelta });
  };
  const addRandomPoint = () => {
    addTrailPoint(
      (Math.random() * 0.5 - 0.25) * bounds,
      (Math.random() * 0.5 - 0.25) * bounds,
      IDLE_STRENGTH + Math.random() * 0.2,
    );
  };

  let rect = size().rect;
  const onPointerMove = (e) => {
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(rayPlane);
    if (hits.length === 0) return;
    const { x, z } = hits[0].point;
    let distDelta = 0;
    if (lastPoint) {
      const dx = x - lastPoint.x;
      const dz = z - lastPoint.z;
      distDelta = Math.sqrt(dx * dx + dz * dz);
      if (distDelta < TRAIL_SPACING) return;
    }
    addTrailPoint(x, z, distDelta);
    lastPoint = { x, z };
    timeSinceLastMove = 0;
    placingIdlePoints = false;
    idleTimer = 0;
  };

  const updateTrail = (delta) => {
    // Points survive for fadeTime * 4 seconds; at that age the shader fade
    // factor exp(-4) is negligible.
    const expiry = FADE_TIME * 4;
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].age += delta;
      if (trail[i].age > expiry) trail.splice(i, 1);
    }
    timeSinceLastMove += delta;
    if (timeSinceLastMove >= IDLE_AFTER && !placingIdlePoints) {
      placingIdlePoints = true;
      idleTimer = 0;
    }
    if (placingIdlePoints) {
      idleTimer += delta;
      if (idleTimer >= IDLE_EVERY) { addRandomPoint(); idleTimer = 0; }
    }
    const count = Math.min(trail.length, MAX_TRAIL);
    if (count > 0 || trailUniforms.uTrailCount.value > 0) {
      for (let i = 0; i < count; i++) {
        const ti = i * 4;
        trailData[ti] = trail[i].x;
        trailData[ti + 1] = trail[i].z;
        trailData[ti + 2] = trail[i].age;
        trailData[ti + 3] = trail[i].distDelta;
      }
      trailTexture.needsUpdate = true;
      trailUniforms.uTrailCount.value = count;
    }
  };

  // Stage.setGrid.
  const count = settings.gridSize * settings.gridSize;
  geometry = new BoxGeometry(UPSTREAM.cubeWidth, UPSTREAM.cubeHeight, UPSTREAM.cubeWidth);
  const offsets = new InstancedBufferAttribute(new Float32Array(count * 2), 2);
  geometry.setAttribute("aOffset", offsets);

  const waveUniforms = () => ({
    uTrailTexture: trailUniforms.uTrailTexture,
    uTrailCount: trailUniforms.uTrailCount,
    uFadeTime: trailUniforms.uFadeTime,
    uWaveSpeed: { value: settings.waveSpeed },
    uWaveFreq: { value: UPSTREAM.waveFrequency },
    uWaveWidth: { value: UPSTREAM.waveWidth },
    uAmplitude: { value: settings.waveAmplitude },
    uJitter: { value: UPSTREAM.waveJitter },
    uMaxHeight: { value: UPSTREAM.waveMaxHeight },
  });

  material = new MeshPhongMaterial({ color: 0xffffff });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveUniforms());
    shader.uniforms.uColorBase = { value: new Color(settings.colorBase) };
    shader.uniforms.uColorHigh = { value: new Color(settings.colorHigh) };
    shader.vertexShader = overrideVertexShader(shader.vertexShader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
                    varying float vHeight;
                    uniform vec3  uColorBase;
                    uniform vec3  uColorHigh;
                    uniform float uMaxHeight;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
                    float t = clamp( vHeight / uMaxHeight, 0.0, 1.0 );
                    diffuseColor.rgb = mix( uColorBase, uColorHigh, t );`,
      );
    shaderRef = shader;
  };

  depthMaterial = new MeshDepthMaterial();
  depthMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveUniforms());
    shader.vertexShader = overrideVertexShader(shader.vertexShader);
  };

  mesh = new InstancedMesh(geometry, material, count);
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Stage.updateGrid.
  const dummy = new Object3D();
  const spacing = UPSTREAM.cubeWidth + UPSTREAM.gap;
  const offset = ((settings.gridSize - 1) * spacing) / 2;
  for (let i = 0; i < settings.gridSize; i++) {
    for (let j = 0; j < settings.gridSize; j++) {
      const index = i * settings.gridSize + j;
      const x = i * spacing - offset;
      const z = j * spacing - offset;
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      offsets.setXY(index, x, z);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  offsets.needsUpdate = true;

  // Orchestrator.animate / update. Timer is core three and connects to the Page
  // Visibility API, which is what keeps a backgrounded tab from returning a
  // huge delta and firing every trail point at once.
  timer = new Timer();
  timer.connect(document);
  const frame = () => {
    if (torn || !renderer) return;
    timer.update();
    const delta = timer.getDelta();
    // Camera.update.
    lerpedMouse.x += (mouse.x - lerpedMouse.x) * UPSTREAM.mouseLerp;
    lerpedMouse.y += (mouse.y - lerpedMouse.y) * UPSTREAM.mouseLerp;
    updateCameraPosition(lerpedMouse.x, lerpedMouse.y);
    updateTrail(delta);
    renderer.render(scene, camera);
  };

  const onMouseMove = (e) => {
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  // Sizes' resize emitter, as a plain observer. setSize clears the drawing
  // buffer, so the next animation-loop frame repaints it; the loop never stops
  // while the effect is mounted.
  const resize = () => {
    if (torn || !renderer) return;
    const s = size();
    rect = s.rect;
    camera.aspect = s.width / s.height;
    camera.updateProjectionMatrix();
    renderer.setSize(s.width, s.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  const onContextLost = (e) => { e.preventDefault(); bail(); };

  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("webglcontextlost", onContextLost);
  ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
  ro?.observe(stage);

  el.setAttribute("data-fx-live", "");
  renderer.setAnimationLoop(frame);

  // script.js's gsap.fromTo across the eight copy selectors, as one anime call.
  if (copy.length) {
    fade = animate(copy, {
      opacity: [0, 1],
      y: [COPY_Y, 0],
      duration: COPY_DURATION,
      delay: stagger(COPY_STAGGER, { start: COPY_DELAY }),
      ease: COPY_EASE,
    });
  }

  return {
    update(next = {}) {
      if ("waveSpeed" in next) {
        settings.waveSpeed = num(next.waveSpeed, UPSTREAM.waveSpeed, 0.1, 40);
        if (shaderRef) shaderRef.uniforms.uWaveSpeed.value = settings.waveSpeed;
      }
      if ("waveAmplitude" in next) {
        settings.waveAmplitude = num(next.waveAmplitude, UPSTREAM.waveAmplitude, 0, 10);
        if (shaderRef) shaderRef.uniforms.uAmplitude.value = settings.waveAmplitude;
      }
      if ("colorHigh" in next && typeof next.colorHigh === "string") {
        settings.colorHigh = next.colorHigh;
        if (shaderRef) shaderRef.uniforms.uColorHigh.value.set(settings.colorHigh);
      }
      if ("distance" in next) settings.distance = num(next.distance, UPSTREAM.radius, 4, 60);
      if ("colorBase" in next && typeof next.colorBase === "string") {
        settings.colorBase = next.colorBase;
        if (shaderRef) shaderRef.uniforms.uColorBase.value.set(settings.colorBase);
        if (scene) scene.background = new Color(settings.colorBase).multiplyScalar(0.5);
      }
      // gridSize rebuilds the whole instanced field, so it is a mount-time
      // choice rather than an update.
    },
    destroy() {
      torn = true;
      try { fade?.pause(); } catch { /* never started */ }
      fade = null;
      renderer?.setAnimationLoop(null);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("mousemove", onMouseMove);
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      ro?.disconnect();
      ro = null;
      timer?.disconnect();
      timer?.dispose?.();
      timer = null;
      trailTexture?.dispose();
      rayPlane?.geometry?.dispose();
      rayPlane?.material?.dispose();
      geometry?.dispose();
      material?.dispose();
      depthMaterial?.dispose();
      try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
      try { renderer?.dispose(); } catch { /* already gone */ }
      renderer?.domElement?.remove();
      renderer = null;
      scene = null;
      shaderRef = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
