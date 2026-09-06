// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// dithering: a port of paper-design/shaders' dithering, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// dithering.ts. The GLSL is not copied into this file -- it is imported from
// vendor/paper.js as `ditheringFragmentShader`, the same export the upstream
// React component feeds to the same ShaderMount, so there is no second copy to
// drift. Default uniform values are upstream's `defaultPreset` from
// packages/shaders-react/src/shaders/dithering.tsx at that commit, which is
// also where the sizing comes from: this shader takes defaultPatternSizing,
// not the object sizing the other ports use, because it tiles rather than
// fitting a subject to the box.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the two colours off --fx-* so the
// shader and the CSS resting state cannot disagree.
import {
  ShaderMount,
  ditheringFragmentShader,
  DitheringShapes,
  DitheringTypes,
  getShaderColorFromString,
  ShaderFitOptions,
  defaultPatternSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "dithering",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#000000", "#00b2ff"], description: "Back colour then front colour. Falls back to --fx-c1 and --fx-c2 on the section." },
    speed: { type: "number", default: 1, description: "Rate the sphere turns. 0 renders a single static frame." },
    shape: { type: "string", default: "sphere", description: "simplex, warp, dots, wave, ripple, swirl or sphere." },
    type: { type: "string", default: "4x4", description: "Dither matrix: random, 2x2, 4x4 or 8x8." },
    size: { type: "number", default: 2, description: "Dot size in pixels." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/dithering.tsx
const UPSTREAM = { speed: 1, shape: "sphere", type: "4x4", size: 2, scale: 0.6 };
const UPSTREAM_COLORS = ["#000000", "#00b2ff"];

// defaultPatternSizing with the preset's own scale. A uniform ShaderMount was
// not handed never gets a location looked up and the vertex shader reads 0,
// which for u_fit is a different fit mode than the preset asks for, so all nine
// travel together.
const SIZING = {
  u_fit: ShaderFitOptions[defaultPatternSizing.fit],
  u_scale: 0.6,
  u_rotation: defaultPatternSizing.rotation,
  u_offsetX: -0.34,
  u_offsetY: defaultPatternSizing.offsetY,
  u_originX: defaultPatternSizing.originX,
  u_originY: defaultPatternSizing.originY,
  u_worldWidth: defaultPatternSizing.worldWidth,
  u_worldHeight: defaultPatternSizing.worldHeight,
};

const CSS_COLOR_VARS = ["--fx-c1", "--fx-c2"];

// Three sources, most explicit first: the caller's option, the section's own
// --fx-c* properties, then upstream's preset. The middle one is what keeps the
// resting halftone and the shader on one pair of colours.
function paletteFor(el, colors) {
  if (Array.isArray(colors) && colors.length === 2) return colors;
  const style = getComputedStyle(el);
  const fromCss = CSS_COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
  return fromCss.length === 2 ? fromCss : UPSTREAM_COLORS;
}

const uniformsFor = (el, s) => {
  const [back, front] = paletteFor(el, s.colors);
  return {
    u_colorBack: getShaderColorFromString(back),
    u_colorFront: getShaderColorFromString(front),
    u_shape: DitheringShapes[s.shape] ?? DitheringShapes.sphere,
    u_type: DitheringTypes[s.type] ?? DitheringTypes["4x4"],
    u_pxSize: s.size,
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

  let shader;
  try {
    shader = new ShaderMount(
      el,
      ditheringFragmentShader,
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
  // and a context lost later all run this. Idempotent, because loseContext()
  // itself fires webglcontextlost and would re-enter through the listener.
  let torn = false;
  const bail = () => {
    if (torn) return;
    torn = true;
    canvas.removeEventListener("webglcontextlost", bail);
    shader.dispose();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    el.removeAttribute("data-fx-live");
    el.removeAttribute("data-paper-shader"); // dispose() leaves this behind
  };
  canvas.addEventListener("webglcontextlost", bail);

  // initProgram swallows a compile or link failure and leaves program null.
  // Without this the canvas sits transparent while data-fx-live has already
  // faded the resting halftone out: the blank rectangle the guards exist for.
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
