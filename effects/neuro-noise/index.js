// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// neuro-noise: a port of paper-design/shaders' neuro noise, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// neuro-noise.ts. The GLSL is not copied into this file -- it is imported from
// vendor/paper.js as `neuroNoiseFragmentShader`, the same export the upstream
// React component feeds to the same ShaderMount, so there is no second copy to
// drift. Default uniform values are upstream's `defaultPreset` from
// packages/shaders-react/src/shaders/neuro-noise.tsx at that commit.
//
// Two things about this one differ from the other paper ports here. It takes
// three NAMED colours rather than a colors array, so the section reads
// --fx-c1..--fx-c3 as front, mid and back rather than as a palette. And its
// preset spreads `defaultPatternSizing`, not `defaultObjectSizing`: fit `none`,
// which keeps the filaments at a fixed scale as the section grows instead of
// zooming them. Using the object sizing here would silently change the density.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the colours off --fx-*.
import {
  ShaderMount,
  neuroNoiseFragmentShader,
  getShaderColorFromString,
  ShaderFitOptions,
  defaultPatternSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "neuro-noise",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colorFront: { type: "string", default: "#ffffff", description: "The filament highlight. Falls back to --fx-c1 on the section." },
    colorMid: { type: "string", default: "#47a6ff", description: "The body of the filaments. Falls back to --fx-c2." },
    colorBack: { type: "string", default: "#000000", description: "The field behind them. Falls back to --fx-c3." },
    speed: { type: "number", default: 1, description: "Rate the filaments travel. 0 renders a single static frame." },
    brightness: { type: "number", default: 0.05, description: "Floor the whole field is lifted to, so it never reads as dead black." },
    contrast: { type: "number", default: 0.3, description: "How hard the filaments separate from the field." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/neuro-noise.tsx
const UPSTREAM = {
  speed: 1,
  brightness: 0.05,
  contrast: 0.3,
  colorFront: "#ffffff",
  colorMid: "#47a6ff",
  colorBack: "#000000",
};

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

// Three sources, most explicit first: the caller's option, then the section's
// own --fx-c* property, then upstream's preset. The middle one is the point:
// style.css declares the colours once and both the resting layer and the shader
// read them, so restyling a site cannot leave the two states clashing.
function colourFor(el, given, cssVar, fallback) {
  if (given) return given;
  const fromCss = getComputedStyle(el).getPropertyValue(cssVar).trim();
  return fromCss || fallback;
}

const uniformsFor = (el, s) => ({
  u_colorFront: getShaderColorFromString(colourFor(el, s.colorFront, "--fx-c1", UPSTREAM.colorFront)),
  u_colorMid: getShaderColorFromString(colourFor(el, s.colorMid, "--fx-c2", UPSTREAM.colorMid)),
  u_colorBack: getShaderColorFromString(colourFor(el, s.colorBack, "--fx-c3", UPSTREAM.colorBack)),
  u_brightness: s.brightness,
  u_contrast: s.contrast,
  ...SIZING,
});

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
  // The section's own colours are the default, so an explicit option is the
  // only thing that should win over them. Blanking these lets colourFor read
  // the custom properties.
  if (!opts.colorFront) settings.colorFront = "";
  if (!opts.colorMid) settings.colorMid = "";
  if (!opts.colorBack) settings.colorBack = "";

  let shader;
  try {
    shader = new ShaderMount(
      el,
      neuroNoiseFragmentShader,
      uniformsFor(el, settings),
      // A context the browser will only serve off a software rasteriser is
      // refused: a hero that scrolls at 4fps is worse than the CSS one
      // underneath it.
      { failIfMajorPerformanceCaveat: true, antialias: true, alpha: true },
      speedFor(settings),
    );
  } catch {
    return resting; // no WebGL2, a caveated context, or not an element
  }

  const gl = shader.gl; // captured before dispose() drops the program
  const canvas = shader.canvasElement;

  // One teardown for every exit: the failed link below, an explicit destroy(),
  // and a context lost later all run this. It is idempotent because
  // loseContext() itself fires webglcontextlost, which would otherwise
  // re-enter through the listener.
  let torn = false;
  const bail = () => {
    if (torn) return;
    torn = true;
    canvas.removeEventListener("webglcontextlost", bail);
    shader.dispose(); // program + textures, observers, and the canvas itself
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    el.removeAttribute("data-fx-live");
    el.removeAttribute("data-paper-shader"); // dispose() leaves this behind
  };
  canvas.addEventListener("webglcontextlost", bail);

  // initProgram is synchronous and swallows a compile or link failure, leaving
  // program null. Without this the canvas would sit there transparent while
  // data-fx-live had already faded the resting layer out: the blank rectangle
  // the guards exist to prevent.
  if (shader.program === null) {
    bail();
    return resting;
  }

  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      shader.setUniforms(uniformsFor(el, settings));
      if ("speed" in next) shader.setSpeed(speedFor(settings));
    },
    destroy: bail,
  };
}
