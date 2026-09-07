// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// warp: a port of paper-design/shaders' warp, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// warp.ts. The GLSL is not copied into this file -- it is imported from
// vendor/paper.js as `warpFragmentShader`, the same export the upstream React
// component feeds to the same ShaderMount, so there is no second copy to drift.
// Default uniform values are upstream's `defaultPreset` from
// packages/shaders-react/src/shaders/warp.tsx at that commit.
//
// Two details worth keeping straight. The preset's colour list alternates --
// near-black, violet, near-black, violet -- which is what makes the output read
// as lit ridges in a dark liquid rather than as a four-way blend; recolouring it
// with four bright stops loses the whole look. And it spreads
// `defaultPatternSizing`, not `defaultObjectSizing`, so fit is `none` and the
// pattern keeps its scale as the section grows instead of zooming.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the colours off --fx-*.
import {
  ShaderMount,
  warpFragmentShader,
  warpMeta,
  getShaderColorFromString,
  getShaderNoiseTexture,
  WarpPatterns,
  ShaderFitOptions,
  defaultPatternSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "warp",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#121212", "#9470ff", "#121212", "#8838ff"], description: "Up to ten stops, alternating dark and lit in the upstream preset. Falls back to --fx-c1..--fx-c4 on the section." },
    speed: { type: "number", default: 1, description: "Rate the liquid turns over. 0 renders a single static frame." },
    distortion: { type: "number", default: 0.25, description: "How far the underlying pattern is pushed out of shape." },
    swirl: { type: "number", default: 0.8, description: "How hard the field is twisted around itself." },
    softness: { type: "number", default: 1, description: "Edge softness between stops. 0 gives hard-edged shapes." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/warp.tsx
const UPSTREAM = {
  speed: 1,
  proportion: 0.45,
  softness: 1,
  distortion: 0.25,
  swirl: 0.8,
  swirlIterations: 10,
  shapeScale: 0.1,
  shape: "checks",
};
const UPSTREAM_COLORS = ["#121212", "#9470ff", "#121212", "#8838ff"];

// The sizing half of the uniform set, from upstream's defaultPatternSizing.
// ShaderMount only looks up a uniform location for a key it was handed, so an
// omitted one is not "left at its default" -- it never gets set at all and the
// vertex shader reads 0. All nine travel together for that reason.
const SIZING = {
  u_fit: ShaderFitOptions[defaultPatternSizing.fit],
  u_scale: defaultPatternSizing.scale,
  u_rotation: defaultPatternSizing.rotation,
  u_offsetX: defaultPatternSizing.offsetX,
  u_offsetY: defaultPatternSizing.offsetY,
  u_originX: defaultPatternSizing.originX,
  u_originY: defaultPatternSizing.originY,
  u_worldWidth: defaultPatternSizing.worldWidth,
  u_worldHeight: defaultPatternSizing.worldHeight,
};

const CSS_COLOR_VARS = ["--fx-c1", "--fx-c2", "--fx-c3", "--fx-c4"];

// Three sources, most explicit first: the caller's option, then the section's
// own --fx-c* properties, then upstream's preset. The middle one is the point:
// style.css declares the stops once and both the resting gradient and the
// shader read them, so restyling a site cannot leave the two states clashing.
function paletteFor(el, colors) {
  if (Array.isArray(colors) && colors.length) return colors;
  const style = getComputedStyle(el);
  const fromCss = CSS_COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
  return fromCss.length ? fromCss : UPSTREAM_COLORS;
}

const uniformsFor = (el, s, noise) => {
  const colors = paletteFor(el, s.colors).slice(0, warpMeta.maxColorCount);
  return {
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_proportion: s.proportion,
    u_softness: s.softness,
    u_distortion: s.distortion,
    u_swirl: s.swirl,
    u_swirlIterations: s.swirlIterations,
    u_shapeScale: s.shapeScale,
    u_shape: WarpPatterns[s.shape],
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
        warpFragmentShader,
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
