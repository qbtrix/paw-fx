// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// smoke-ring: a port of paper-design/shaders' smoke ring, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// smoke-ring.ts. The GLSL is not copied into this file -- it is imported from
// vendor/paper.js as `smokeRingFragmentShader`, the same export the upstream
// React component feeds to the same ShaderMount, so there is no second copy to
// drift. Default uniform values are upstream's `defaultPreset` from
// packages/shaders-react/src/shaders/smoke-ring.tsx at that commit.
//
// The preset ships ONE colour, `['#ffffff']`, not a palette, and the ring reads
// better for it: the smoke is white and everything else is the black behind.
// style.css therefore declares only --fx-c1, because paletteFor drops empty
// custom properties and declaring four would silently turn u_colorsCount up and
// band the smoke through a gradient upstream never intended.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the smoke colour off --fx-c1.
import {
  ShaderMount,
  smokeRingFragmentShader,
  smokeRingMeta,
  getShaderColorFromString,
  getShaderNoiseTexture,
  ShaderFitOptions,
  defaultObjectSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "smoke-ring",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#ffffff"], description: "The smoke colour. Upstream ships one; falls back to --fx-c1 on the section." },
    speed: { type: "number", default: 0.5, description: "Rate the smoke turns over. 0 renders a single static frame." },
    radius: { type: "number", default: 0.25, description: "Radius of the clear centre the ring is drawn around." },
    thickness: { type: "number", default: 0.65, description: "How far the smoke reaches outward from that radius." },
    noiseScale: { type: "number", default: 3, description: "Size of the turbulence in the smoke. Higher is finer, wispier detail." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/smoke-ring.tsx
const UPSTREAM = {
  speed: 0.5,
  noiseScale: 3,
  noiseIterations: 8,
  radius: 0.25,
  thickness: 0.65,
  innerShape: 0.7,
  colorBack: "#000000",
};
const UPSTREAM_COLORS = ["#ffffff"];

// The sizing half of the uniform set, from upstream's defaultObjectSizing plus
// the preset's own scale. ShaderMount only looks up a uniform location for a
// key it was handed, so an omitted one is not "left at its default" -- it never
// gets set at all and the vertex shader reads 0, which for u_scale would
// collapse the ring. All nine travel together for that reason.
const SIZING = {
  u_fit: ShaderFitOptions[defaultObjectSizing.fit],
  u_scale: 0.8,
  u_rotation: defaultObjectSizing.rotation,
  u_offsetX: defaultObjectSizing.offsetX,
  u_offsetY: defaultObjectSizing.offsetY,
  u_originX: defaultObjectSizing.originX,
  u_originY: defaultObjectSizing.originY,
  u_worldWidth: defaultObjectSizing.worldWidth,
  u_worldHeight: defaultObjectSizing.worldHeight,
};

const CSS_COLOR_VARS = ["--fx-c1", "--fx-c2", "--fx-c3", "--fx-c4"];

// Three sources, most explicit first: the caller's option, then the section's
// own --fx-c* properties, then upstream's preset. Empty ones are dropped, which
// is what lets style.css declare a single colour here and four elsewhere.
function paletteFor(el, colors) {
  if (Array.isArray(colors) && colors.length) return colors;
  const style = getComputedStyle(el);
  const fromCss = CSS_COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
  return fromCss.length ? fromCss : UPSTREAM_COLORS;
}

const uniformsFor = (el, s, noise) => {
  const colors = paletteFor(el, s.colors).slice(0, smokeRingMeta.maxColorCount);
  return {
    u_colorBack: getShaderColorFromString(s.colorBack),
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_noiseScale: s.noiseScale,
    u_thickness: s.thickness,
    u_radius: s.radius,
    u_innerShape: s.innerShape,
    u_noiseIterations: s.noiseIterations,
    u_noiseTexture: noise,
    ...SIZING,
  };
};

const numberOr = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// Speed 0 stops ShaderMount ever asking for an animation frame; it still paints
// once off the ResizeObserver, so reduced motion gets the real shader as a
// still image rather than a downgrade to the CSS layer.
const speedFor = (s) => (reducedMotion() ? 0 : numberOr(s.speed, UPSTREAM.speed));

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el) return resting;
  const settings = { ...UPSTREAM, ...opts };

  let torn = false;
  let shader = null;
  let gl = null;
  let canvas = null;

  // One teardown for every exit: a refused context, a shader that will not
  // link, an explicit destroy(), a context lost later. Idempotent, because
  // loseContext() itself fires webglcontextlost and would re-enter.
  const bail = () => {
    if (torn) return;
    torn = true;
    canvas?.removeEventListener("webglcontextlost", bail);
    shader?.dispose(); // program + textures, observers, and the canvas itself
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    el.removeAttribute("data-fx-live");
    el.removeAttribute("data-paper-shader"); // dispose() leaves this behind
  };

  // The shader samples u_noiseTexture, so the image has to be decoded before
  // ShaderMount touches it -- it throws on an image that is not complete.
  // Nothing is fetched: getShaderNoiseTexture() returns an <img> on a data:
  // URI, which is what keeps a generated site self-contained. destroy() during
  // the decode wins, via `torn`.
  const noise = getShaderNoiseTexture();
  const decoded = noise?.decode ? noise.decode().catch(() => {}) : Promise.resolve();
  decoded.then(() => {
    if (torn) return;
    if (!noise?.complete || !noise.naturalWidth) return bail();
    try {
      shader = new ShaderMount(
        el,
        smokeRingFragmentShader,
        uniformsFor(el, settings, noise),
        // A context the browser will only serve off a software rasteriser is
        // refused: a hero that scrolls at 4fps is worse than the CSS one
        // underneath it.
        { failIfMajorPerformanceCaveat: true, antialias: true, alpha: true },
        speedFor(settings),
      );
    } catch {
      return bail(); // no WebGL2, or a caveated context
    }
    gl = shader.gl; // captured before dispose() drops the program
    canvas = shader.canvasElement;
    canvas.addEventListener("webglcontextlost", bail);
    // initProgram swallows a compile or link failure and leaves program null.
    // Without this the canvas would sit there transparent while data-fx-live
    // had already faded the resting layer out: the blank rectangle the guards
    // exist to prevent.
    if (shader.program === null) return bail();
    el.setAttribute("data-fx-live", "");
  });

  return {
    update(next = {}) {
      if (torn || !shader) return;
      Object.assign(settings, next);
      shader.setUniforms(uniformsFor(el, settings, noise));
      if ("speed" in next) shader.setSpeed(speedFor(settings));
    },
    destroy: bail,
  };
}
