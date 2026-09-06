// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// liquid-metal: a port of paper-design/shaders' liquid metal, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// liquid-metal.ts. The GLSL is not copied into this file -- it is imported from
// vendor/paper.js as `liquidMetalFragmentShader`, the same export the upstream
// React component feeds to the same ShaderMount, so there is no second copy to
// drift. Default uniform values are upstream's `noirPreset` from
// packages/shaders-react/src/shaders/liquid-metal.tsx at that commit; see
// meta.json deviations for why that preset and not `defaultPreset`.
//
// The shader takes an optional image as its mask: with one it plates a logo,
// without one it falls to its own generated shape, which is the u_isImage
// false branch upstream ships and what `shape: 'none'` selects. paw-fx passes
// no image -- a generated site has to be self-contained, and a shape the
// shader draws itself is exactly that.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the two colours off --fx-*.
import {
  ShaderMount,
  liquidMetalFragmentShader,
  LiquidMetalShapes,
  getShaderColorFromString,
  ShaderFitOptions,
  defaultObjectSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "liquid-metal",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#000000", "#606060"], description: "Ground then metal tint. Falls back to --fx-c1 and --fx-c2 on the section." },
    speed: { type: "number", default: 1, description: "Rate the sheen travels. 0 renders a single static frame." },
    repetition: { type: "number", default: 1.5, description: "How many bands the sheen folds into." },
    softness: { type: "number", default: 0.45, description: "Blur on the band edges. Low is polished chrome, high is brushed; the noir preset sits in between." },
  },
};

// upstream noirPreset, shaders-react/src/shaders/liquid-metal.tsx
const UPSTREAM = {
  speed: 1,
  colorBack: "#000000",
  colorTint: "#606060",
  softness: 0.45,
  repetition: 1.5,
  shiftRed: 0,
  shiftBlue: 0,
  distortion: 0,
  contour: 0,
  angle: 90,
  shape: "diamond",
};
const UPSTREAM_COLORS = ["#000000", "#606060"];

// defaultObjectSizing with the preset's own scale. A uniform ShaderMount was
// not handed never gets a location looked up and the vertex shader reads 0,
// which for u_fit is a different fit mode than the preset asks for, so all nine
// travel together. u_imageAspectRatio rides along at 1 because the vertex
// shader divides by it even on the no-image path.
const SIZING = {
  u_fit: ShaderFitOptions[defaultObjectSizing.fit],
  u_scale: 0.6,
  u_rotation: defaultObjectSizing.rotation,
  u_offsetX: 0.3,
  u_offsetY: defaultObjectSizing.offsetY,
  u_originX: defaultObjectSizing.originX,
  u_originY: defaultObjectSizing.originY,
  u_worldWidth: defaultObjectSizing.worldWidth,
  u_worldHeight: defaultObjectSizing.worldHeight,
  u_imageAspectRatio: 1,
};

const CSS_COLOR_VARS = ["--fx-c1", "--fx-c2"];

// Three sources, most explicit first: the caller's option, the section's own
// --fx-c* properties, then upstream's preset.
function paletteFor(el, colors) {
  if (Array.isArray(colors) && colors.length === 2) return colors;
  const style = getComputedStyle(el);
  const fromCss = CSS_COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
  return fromCss.length === 2 ? fromCss : UPSTREAM_COLORS;
}

const uniformsFor = (el, s) => {
  const [back, tint] = paletteFor(el, s.colors);
  return {
    u_colorBack: getShaderColorFromString(back),
    u_colorTint: getShaderColorFromString(tint),
    u_contour: s.contour,
    u_distortion: s.distortion,
    u_softness: s.softness,
    u_repetition: s.repetition,
    u_shiftRed: s.shiftRed,
    u_shiftBlue: s.shiftBlue,
    u_angle: s.angle,
    // No image, so the shader takes its own generated-shape branch. The
    // sampler is left unbound on purpose: nothing on that branch reads it.
    u_isImage: false,
    u_shape: LiquidMetalShapes[s.shape] ?? LiquidMetalShapes.none,
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
      liquidMetalFragmentShader,
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
  // faded the resting sheen out: the blank rectangle the guards exist for.
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
