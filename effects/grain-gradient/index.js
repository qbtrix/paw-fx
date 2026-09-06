// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// grain-gradient: a port of paper-design/shaders' grain gradient, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// grain-gradient.ts. The GLSL is not copied into this file -- it is imported
// from vendor/paper.js as `grainGradientFragmentShader`, the same export the
// upstream React component feeds to the same ShaderMount, so there is no second
// copy to drift. Default uniform values are upstream's `defaultPreset` from
// packages/shaders-react/src/shaders/grain-gradient.tsx at that commit.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the colours off --fx-* so the shader
// and the CSS resting state cannot disagree.
import {
  ShaderMount,
  grainGradientFragmentShader,
  grainGradientMeta,
  getShaderColorFromString,
  getShaderNoiseTexture,
  GrainGradientShapes,
  ShaderFitOptions,
  defaultObjectSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "grain-gradient",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"], description: "Up to seven colour stops. Falls back to --fx-c1..--fx-c4 on the section." },
    speed: { type: "number", default: 1, description: "Rate the field moves. 0 renders a single static frame." },
    softness: { type: "number", default: 0.5, description: "How far each colour bleeds into its neighbour." },
    intensity: { type: "number", default: 0.5, description: "Size of the grain speckle that breaks the blend up." },
    noise: { type: "number", default: 0.25, description: "How much grain is mixed over the finished blend." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/grain-gradient.tsx
const UPSTREAM = { speed: 1, softness: 0.5, intensity: 0.5, noise: 0.25, shape: "corners", colorBack: "#000000" };
const UPSTREAM_COLORS = ["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"];

// The sizing half of the uniform set, from upstream's defaultObjectSizing.
// ShaderMount only looks up a uniform location for a key it was handed, so an
// omitted one is not "left at its default" -- it never gets set at all and the
// vertex shader reads 0, which for u_fit means a different fit mode than the
// preset asks for. All nine travel together for that reason.
const SIZING = {
  u_fit: ShaderFitOptions[defaultObjectSizing.fit],
  u_scale: defaultObjectSizing.scale,
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
// own --fx-c* properties, then upstream's preset. The middle one is the point:
// style.css declares the palette once and both the resting gradient and the
// shader read it, so restyling a site cannot leave the two states clashing.
function paletteFor(el, colors) {
  if (Array.isArray(colors) && colors.length) return colors;
  const style = getComputedStyle(el);
  const fromCss = CSS_COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
  return fromCss.length ? fromCss : UPSTREAM_COLORS;
}

const uniformsFor = (el, s, noise) => {
  const colors = paletteFor(el, s.colors).slice(0, grainGradientMeta.maxColorCount);
  return {
    u_colorBack: getShaderColorFromString(s.colorBack),
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_softness: s.softness,
    u_intensity: s.intensity,
    u_noise: s.noise,
    u_shape: GrainGradientShapes[s.shape],
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
        grainGradientFragmentShader,
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
    // had already faded the resting gradient out: the blank rectangle the
    // guards exist to prevent.
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
