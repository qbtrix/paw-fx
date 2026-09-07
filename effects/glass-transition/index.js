// [threejs/gsap] Liquid Morphology Slideshow
// MIT License
// Copyright (c) 2026 by Filip Zrnzevic (https://codepen.io/filipz/pen/JoGNQzm)
//
// glass-transition: a port of the glass/liquid-refraction mode of Filip
// Zrnzevic's "Liquid Morphology Slideshow", pinned by snapshot rather than by
// commit -- a pen has no revision history, so the copy this was ported from is
// committed at tests/fixtures/upstream-snapshots/filipz-JoGNQzm.snapshot.txt and
// the gate hashes it.
//
// THE MECHANISM. One full-screen quad carries both the outgoing and the incoming
// picture as textures. A lens expands from the centre -- its radius is uProgress
// times 0.85 of the frame diagonal -- and inside it the incoming image is
// sampled through a refraction: the UV is pushed along the flow direction by a
// distance-weighted offset, three interfering sine waves ripple across it, a
// liquid surface of value noise jitters it, and the red, green and blue channels
// are sampled at three different offsets so the rim separates into colour. The
// outgoing image stays exactly where it is; `inside` is the mask that mixes
// between them, so the effect reads as a bubble of liquid glass swelling over
// the frame rather than as a crossfade.
//
// ONE MODE OF FOUR. Upstream's fragment shader branches on uEffectType across
// glass, frost, ripple, plasma and a timeshift block -- five effects sharing one
// demo, and 43 of its 64 KB. Only glass ships here, hard-wired: it is what the
// pen is named for and it is the shelf's actual gap. getCoverUV, noise and
// smoothNoise come with it because glassEffect calls them; rand does not,
// because only the other modes do.
//
// GSAP WAS ONE CALL IN 1904 LINES. A single gsap.fromTo on the uProgress uniform
// at line 1613, 2.5s, power2.inOut. GSAP's powerN is degree N+1, so power2.inOut
// is inOutCubic. Seconds become milliseconds against MS. No plugin was involved;
// the whole library was loaded for one tween.
//
// TWEAKPANE IS DEBUG FURNITURE and does not ship. Its five glass bindings become
// meta.json options on the same uniforms with the same ranges; setupPane,
// setupEffectFolders, updateEffectFolderVisibility, the presets and the
// randomiser go with it, as do the dot-grid preloader, the H-key panel toggle
// and the effect switcher.
//
// NO PHOTOGRAPH SHIPS. Upstream loads six portraits off assets.codepen.io. The
// textures here are read from the section's own <img> elements and the snippet
// points those at generated SVG plates. The slot has to stay a real <img>: its
// pixels ARE the texture, so it cannot be a CSS background.
import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "../../vendor/three.module.js";
import { animate } from "../../vendor/anime.esm.js";

export const meta = {
  name: "glass-transition",
  version: "1.0.0",
  category: "transition",
  needs: ["three", "anime"],
  license: "MIT",
  options: {
    transitionDuration: { type: "number", default: 2500, description: "Milliseconds the lens takes to cross the frame. Upstream's transitionDuration of 2.5s." },
    autoSlideSpeed: { type: "number", default: 5000, description: "Milliseconds a slide holds before the next one starts. Upstream's autoSlideSpeed. Set 0 to advance only on click." },
    refraction: { type: "number", default: 1, description: "uGlassRefractionStrength. How hard the lens bends the incoming image. Upstream's pane range is 0 to 3." },
    chromatic: { type: "number", default: 1, description: "uGlassChromaticAberration. How far apart the red, green and blue samples sit at the rim. Upstream's pane range is 0 to 3." },
    clarity: { type: "number", default: 1, description: "uGlassBubbleClarity. Size of the undistorted centre of the lens. Upstream's pane range is 0 to 3." },
    edgeGlow: { type: "number", default: 1, description: "uGlassEdgeGlow. Brightness of the rim light and the glass edge. Upstream's pane range is 0 to 3." },
    liquidFlow: { type: "number", default: 1, description: "uGlassLiquidFlow. How much the lens drifts as it travels. Upstream's pane range is 0 to 3." },
  },
};

// SLIDER_CONFIG.settings. Seconds upstream for the duration, milliseconds here.
const MS = 1000;
const UPSTREAM = {
  transitionDuration: 2.5 * MS,
  autoSlideSpeed: 5000,
  globalIntensity: 1.0,
  speedMultiplier: 1.0,
  distortionStrength: 1.0,
  colorEnhancement: 1.0,
  refraction: 1.0,
  chromatic: 1.0,
  clarity: 1.0,
  edgeGlow: 1.0,
  liquidFlow: 1.0,
};

// gsap 'power2.inOut'. GSAP's powerN is degree N+1.
const EASE = "inOutCubic";
// safeStartTimer(100) after a transition, safeStartTimer(500) on first load.
const RESTART_DELAY = 100;
const FIRST_DELAY = 500;
// handleSwipe(): minimum swipe distance.
const SWIPE_MIN = 50;

const VERTEX = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
`;

// Upstream's fragment shader, restricted to the glass branch: the uniform block
// it reads, getCoverUV, noise, smoothNoise and glassEffect verbatim, and a main
// that calls glassEffect instead of switching on uEffectType.
const FRAGMENT = `
      uniform sampler2D uTexture1;
      uniform sampler2D uTexture2;
      uniform float uProgress;
      uniform vec2 uResolution;
      uniform vec2 uTexture1Size;
      uniform vec2 uTexture2Size;

      // Global settings uniforms
      uniform float uGlobalIntensity;
      uniform float uSpeedMultiplier;
      uniform float uDistortionStrength;
      uniform float uColorEnhancement;

      // Glass uniforms
      uniform float uGlassRefractionStrength;
      uniform float uGlassChromaticAberration;
      uniform float uGlassBubbleClarity;
      uniform float uGlassEdgeGlow;
      uniform float uGlassLiquidFlow;

      varying vec2 vUv;

      vec2 getCoverUV(vec2 uv, vec2 textureSize) {
        vec2 s = uResolution / textureSize;
        float scale = max(s.x, s.y);
        vec2 scaledSize = textureSize * scale;
        vec2 offset = (uResolution - scaledSize) * 0.5;
        return (uv * uResolution - offset) / scaledSize;
      }

      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
          mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      vec4 glassEffect(vec2 uv, float progress) {
        float glassStrength = 0.08 * uGlassRefractionStrength * uDistortionStrength * uGlobalIntensity;
        float chromaticAberration = 0.02 * uGlassChromaticAberration * uGlobalIntensity;
        float waveDistortion = 0.025 * uDistortionStrength;
        float clearCenterSize = 0.3 * uGlassBubbleClarity;
        float surfaceRipples = 0.004 * uDistortionStrength;
        float liquidFlow = 0.015 * uGlassLiquidFlow * uSpeedMultiplier;
        float rimLightWidth = 0.05;
        float glassEdgeWidth = 0.025;

        float brightnessPhase = smoothstep(0.8, 1.0, progress);
        float rimLightIntensity = 0.08 * (1.0 - brightnessPhase) * uGlassEdgeGlow * uGlobalIntensity;
        float glassEdgeOpacity = 0.06 * (1.0 - brightnessPhase) * uGlassEdgeGlow;

        vec2 center = vec2(0.5, 0.5);
        vec2 p = uv * uResolution;

        vec2 uv1 = getCoverUV(uv, uTexture1Size);
        vec2 uv2_base = getCoverUV(uv, uTexture2Size);

        float maxRadius = length(uResolution) * 0.85;
        // FIX: Start completely off-screen at progress 0
        float bubbleRadius = progress * maxRadius;
        vec2 sphereCenter = center * uResolution;

        float dist = length(p - sphereCenter);
        float normalizedDist = dist / max(bubbleRadius, 0.001);
        vec2 direction = (dist > 0.0) ? (p - sphereCenter) / dist : vec2(0.0);
        float inside = smoothstep(bubbleRadius + 3.0, bubbleRadius - 3.0, dist);

        float distanceFactor = smoothstep(clearCenterSize, 1.0, normalizedDist);
        float time = progress * 5.0 * uSpeedMultiplier;

        vec2 liquidSurface = vec2(
          smoothNoise(uv * 100.0 + time * 0.3),
          smoothNoise(uv * 100.0 + time * 0.2 + 50.0)
        ) - 0.5;
        liquidSurface *= surfaceRipples * distanceFactor;

        vec2 distortedUV = uv2_base;
        if (inside > 0.0) {
          float refractionOffset = glassStrength * pow(distanceFactor, 1.5);
          vec2 flowDirection = normalize(direction + vec2(sin(time), cos(time * 0.7)) * 0.3);
          distortedUV -= flowDirection * refractionOffset;

          float wave1 = sin(normalizedDist * 22.0 - time * 3.5);
          float wave2 = sin(normalizedDist * 35.0 + time * 2.8) * 0.7;
          float wave3 = sin(normalizedDist * 50.0 - time * 4.2) * 0.5;
          float combinedWave = (wave1 + wave2 + wave3) / 3.0;

          float waveOffset = combinedWave * waveDistortion * distanceFactor;
          distortedUV -= direction * waveOffset + liquidSurface;

          vec2 flowOffset = vec2(
            sin(time + normalizedDist * 10.0),
            cos(time * 0.8 + normalizedDist * 8.0)
          ) * liquidFlow * distanceFactor * inside;
          distortedUV += flowOffset;
        }

        vec4 newImg;
        if (inside > 0.0) {
          float aberrationOffset = chromaticAberration * pow(distanceFactor, 1.2);

          vec2 uv_r = distortedUV + direction * aberrationOffset * 1.2;
          vec2 uv_g = distortedUV + direction * aberrationOffset * 0.2;
          vec2 uv_b = distortedUV - direction * aberrationOffset * 0.8;

          float r = texture2D(uTexture2, uv_r).r;
          float g = texture2D(uTexture2, uv_g).g;
          float b = texture2D(uTexture2, uv_b).b;
          newImg = vec4(r, g, b, 1.0);
        } else {
          newImg = texture2D(uTexture2, uv2_base);
        }

        if (inside > 0.0 && rimLightIntensity > 0.0) {
          float rim = smoothstep(1.0 - rimLightWidth, 1.0, normalizedDist) *
                      (1.0 - smoothstep(1.0, 1.01, normalizedDist));
          newImg.rgb += rim * rimLightIntensity;

          float edge = smoothstep(1.0 - glassEdgeWidth, 1.0, normalizedDist) *
                       (1.0 - smoothstep(1.0, 1.01, normalizedDist));
          newImg.rgb = mix(newImg.rgb, vec3(1.0), edge * glassEdgeOpacity);
        }

        // Apply color enhancement
        newImg.rgb = mix(newImg.rgb, newImg.rgb * 1.2, (uColorEnhancement - 1.0) * 0.5);

        vec4 currentImg = texture2D(uTexture1, uv1);

        if (progress > 0.95) {
          vec4 pureNewImg = texture2D(uTexture2, uv2_base);
          float endTransition = (progress - 0.95) / 0.05;
          newImg = mix(newImg, pureNewImg, endTransition);
        }

        return mix(currentImg, newImg, inside);
      }

      void main() {
        gl_FragColor = glassEffect(vUv, uProgress);
      }
`;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const stage = el.querySelector(".fx-glass__stage");
  const slides = [...el.querySelectorAll(".fx-glass__img")];
  const nav = el.querySelector(".fx-glass__nav");
  const counter = el.querySelector(".fx-glass__index");
  if (!stage || slides.length < 2) return resting;

  const settings = {
    transitionDuration: num(opts.transitionDuration, UPSTREAM.transitionDuration, 1, 60000),
    autoSlideSpeed: num(opts.autoSlideSpeed, UPSTREAM.autoSlideSpeed, 0, 600000),
    refraction: num(opts.refraction, UPSTREAM.refraction, 0, 3),
    chromatic: num(opts.chromatic, UPSTREAM.chromatic, 0, 3),
    clarity: num(opts.clarity, UPSTREAM.clarity, 0, 3),
    edgeGlow: num(opts.edgeGlow, UPSTREAM.edgeGlow, 0, 3),
    liquidFlow: num(opts.liquidFlow, UPSTREAM.liquidFlow, 0, 3),
  };

  let index = 0;
  const dots = nav ? [...nav.querySelectorAll(".fx-glass__dot")] : [];

  // updateCounter + updateNavigationState. Also the reduced-motion swap: the
  // DOM <img> elements are the resting picture, so marking the active one is
  // what a click does when nothing is on the GPU.
  const markSlide = (i) => {
    index = i;
    stage.setAttribute("data-fx-slide", String(i));
    slides.forEach((img, n) => img.classList.toggle("is-active", n === i));
    dots.forEach((dot, n) => {
      dot.classList.toggle("is-active", n === i);
      dot.setAttribute("aria-current", String(n === i));
    });
    if (counter) counter.textContent = String(i + 1).padStart(2, "0");
  };

  // Reduced motion: the slideshow still works, with no shader and no timer. The
  // reader changes picture; nothing travels and nothing advances on its own.
  if (reducedMotion()) {
    const onDot = dots.map((dot, i) => {
      const h = (e) => { e.preventDefault(); markSlide(i); };
      dot.addEventListener("click", h);
      return h;
    });
    const onStage = (e) => { if (e.target.closest(".fx-glass__nav")) return; markSlide((index + 1) % slides.length); };
    stage.addEventListener("click", onStage);
    markSlide(0);
    return {
      update() {},
      destroy() {
        dots.forEach((dot, i) => dot.removeEventListener("click", onDot[i]));
        stage.removeEventListener("click", onStage);
        stage.removeAttribute("data-fx-slide");
        slides.forEach((img) => img.classList.remove("is-active"));
      },
    };
  }

  let renderer = null;
  let canvas = null;
  let scene = null;
  let camera = null;
  let geometry = null;
  let material = null;
  let raf = null;
  let ro = null;
  let timer = null;
  let tween = null;
  let torn = false;
  let transitioning = false;
  const textures = [];

  const stopTimer = () => { if (timer) clearTimeout(timer); timer = null; };

  const bail = () => {
    stopTimer();
    try { tween?.pause(); } catch { /* never started */ }
    tween = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
    try { renderer?.dispose(); } catch { /* nothing to dispose */ }
    renderer?.domElement?.remove();
    renderer = null;
    el.removeAttribute("data-fx-live");
    return resting;
  };

  try {
    // initializeRenderer(). failIfMajorPerformanceCaveat is ours: the picture
    // underneath is a better answer than a two-frames-a-second refraction.
    renderer = new WebGLRenderer({ antialias: false, alpha: false, failIfMajorPerformanceCaveat: true });
    canvas = renderer.domElement;
    canvas.classList.add("fx-glass__canvas");
    stage.appendChild(canvas);
    scene = new Scene();
    camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  } catch {
    return bail();
  }

  const box = stage.getBoundingClientRect();
  material = new ShaderMaterial({
    uniforms: {
      uTexture1: { value: null },
      uTexture2: { value: null },
      uProgress: { value: 0.0 },
      uResolution: { value: new Vector2(Math.max(1, box.width), Math.max(1, box.height)) },
      uTexture1Size: { value: new Vector2(1, 1) },
      uTexture2Size: { value: new Vector2(1, 1) },
      uGlobalIntensity: { value: UPSTREAM.globalIntensity },
      uSpeedMultiplier: { value: UPSTREAM.speedMultiplier },
      uDistortionStrength: { value: UPSTREAM.distortionStrength },
      uColorEnhancement: { value: UPSTREAM.colorEnhancement },
      uGlassRefractionStrength: { value: settings.refraction },
      uGlassChromaticAberration: { value: settings.chromatic },
      uGlassBubbleClarity: { value: settings.clarity },
      uGlassEdgeGlow: { value: settings.edgeGlow },
      uGlassLiquidFlow: { value: settings.liquidFlow },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  geometry = new PlaneGeometry(2, 2);
  scene.add(new Mesh(geometry, material));

  // loadImageTexture, reading each slide off its own <img> rather than a URL
  // baked into this file. userData.size is what getCoverUV needs to cover-fit.
  const loader = new TextureLoader();
  let ready = 0;
  slides.forEach((img, i) => {
    const tex = loader.load(img.currentSrc || img.src, (t) => {
      t.minFilter = t.magFilter = LinearFilter;
      t.userData = { size: new Vector2(t.image.width, t.image.height) };
      ready++;
      if (ready === 2 && !torn) start();
    });
    textures[i] = tex;
  });

  const sizeOf = (t) => t?.userData?.size ?? new Vector2(1, 1);

  // navigateToSlide(). The one gsap.fromTo in 1904 lines, on anime.
  const navigateTo = (target) => {
    if (torn || transitioning || target === index) return;
    stopTimer();
    const from = textures[index];
    const to = textures[target];
    if (!from || !to || !to.userData) return;
    transitioning = true;
    material.uniforms.uTexture1.value = from;
    material.uniforms.uTexture2.value = to;
    material.uniforms.uTexture1Size.value.copy(sizeOf(from));
    material.uniforms.uTexture2Size.value.copy(sizeOf(to));
    markSlide(target);
    material.uniforms.uProgress.value = 0;
    tween = animate(material.uniforms.uProgress, {
      value: 1,
      duration: settings.transitionDuration,
      ease: EASE,
      onComplete: () => {
        material.uniforms.uProgress.value = 0;
        material.uniforms.uTexture1.value = to;
        material.uniforms.uTexture1Size.value.copy(sizeOf(to));
        transitioning = false;
        safeStartTimer(RESTART_DELAY);
      },
    });
  };

  // startAutoSlideTimer / safeStartTimer, as a plain timeout: upstream's own
  // interval only existed to drive a progress bar this section does not carry.
  function safeStartTimer(delay) {
    stopTimer();
    if (torn || settings.autoSlideSpeed <= 0) return;
    timer = setTimeout(() => navigateTo((index + 1) % slides.length), settings.autoSlideSpeed + delay);
  }

  const render = () => {
    if (torn || !renderer) return;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  };

  function start() {
    if (torn) return;
    material.uniforms.uTexture1.value = textures[0];
    material.uniforms.uTexture2.value = textures[1];
    material.uniforms.uTexture1Size.value.copy(sizeOf(textures[0]));
    material.uniforms.uTexture2Size.value.copy(sizeOf(textures[1]));
    el.setAttribute("data-fx-live", "");
    safeStartTimer(FIRST_DELAY);
  }

  // Upstream's resize. setSize clears the drawing buffer, so it re-renders --
  // harmless here because the rAF loop runs anyway, and correct if it ever
  // stops.
  const resize = () => {
    if (torn || !renderer) return;
    const b = stage.getBoundingClientRect();
    const w = Math.max(1, b.width);
    const h = Math.max(1, b.height);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    material.uniforms.uResolution.value.set(w, h);
    renderer.render(scene, camera);
  };

  const onStageClick = (e) => {
    if (e.target.closest(".fx-glass__nav")) return;
    if (transitioning) return;
    stopTimer();
    navigateTo((index + 1) % slides.length);
  };
  const dotHandlers = dots.map((dot, i) => {
    const h = (e) => { e.preventDefault(); e.stopPropagation(); navigateTo(i); };
    dot.addEventListener("click", h);
    return h;
  });

  // handleSwipe(), scoped to the section rather than the document.
  let touchStartX = 0;
  const onTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) < SWIPE_MIN || transitioning) return;
    navigateTo(dx < 0 ? (index + 1) % slides.length : (index - 1 + slides.length) % slides.length);
  };

  const onContextLost = (e) => { e.preventDefault(); bail(); };

  stage.addEventListener("click", onStageClick);
  stage.addEventListener("touchstart", onTouchStart, { passive: true });
  stage.addEventListener("touchend", onTouchEnd, { passive: true });
  canvas.addEventListener("webglcontextlost", onContextLost);
  ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
  ro?.observe(stage);

  markSlide(0);
  resize();
  render();

  return {
    update(next = {}) {
      if (!material) return;
      const map = {
        refraction: "uGlassRefractionStrength",
        chromatic: "uGlassChromaticAberration",
        clarity: "uGlassBubbleClarity",
        edgeGlow: "uGlassEdgeGlow",
        liquidFlow: "uGlassLiquidFlow",
      };
      for (const [key, uniform] of Object.entries(map)) {
        if (key in next) {
          settings[key] = num(next[key], UPSTREAM[key], 0, 3);
          material.uniforms[uniform].value = settings[key];
        }
      }
      if ("transitionDuration" in next) settings.transitionDuration = num(next.transitionDuration, UPSTREAM.transitionDuration, 1, 60000);
      if ("autoSlideSpeed" in next) {
        settings.autoSlideSpeed = num(next.autoSlideSpeed, UPSTREAM.autoSlideSpeed, 0, 600000);
        safeStartTimer(0);
      }
    },
    destroy() {
      torn = true;
      stopTimer();
      try { tween?.pause(); } catch { /* never started */ }
      tween = null;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      stage.removeEventListener("click", onStageClick);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchend", onTouchEnd);
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      dots.forEach((dot, i) => dot.removeEventListener("click", dotHandlers[i]));
      ro?.disconnect();
      ro = null;
      for (const t of textures) t?.dispose();
      textures.length = 0;
      geometry?.dispose();
      material?.dispose();
      try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
      try { renderer?.dispose(); } catch { /* already gone */ }
      renderer?.domElement?.remove();
      renderer = null;
      scene = null;
      stage.removeAttribute("data-fx-slide");
      slides.forEach((img) => img.classList.remove("is-active"));
      el.removeAttribute("data-fx-live");
    },
  };
}
