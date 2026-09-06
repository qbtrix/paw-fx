// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// mesh-gradient: a port of paper-design/shaders' mesh gradient, commit
// 60467401863c1917dd02016d0c1ff2f791d0b3c8, packages/shaders/src/shaders/
// mesh-gradient.ts. The GLSL is not copied into this file -- it is imported
// from vendor/paper.js as `meshGradientFragmentShader`, the same export the
// upstream React component feeds to the same ShaderMount. So the shader here
// cannot drift from upstream's: there is no second copy to drift. The default
// uniform values below are upstream's `defaultPreset` from
// packages/shaders-react/src/shaders/mesh-gradient.tsx at that commit.
//
// meta.json's origin.path lists BOTH of those files, because the port really
// does span both: the shader comes from one and every default below comes from
// the other. Pinning only the shader made `distortion: 0.8` and `swirl: 0.1`
// look like numbers with no upstream counterpart, which is what `bun run
// verify` reported before the second path was declared.
//
// Only the seams are ours: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the palette off --fx-* so the shader
// and the CSS resting state cannot disagree about their colours.
//
// The guards are the reason this file is longer than a thin wrapper. A hero
// section that fails to a blank rectangle is worse than one that never tried,
// so every failure path -- no WebGL2, a context refused for a major
// performance caveat, a shader that will not link, a context lost later --
// lands in the same bail(), which tears the shader down and returns the
// section to the CSS resting state it was already showing.
import {
  ShaderMount,
  meshGradientFragmentShader,
  meshGradientMeta,
  getShaderColorFromString,
  ShaderFitOptions,
  defaultObjectSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "mesh-gradient",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"], description: "Two to ten colour points; falls back to --fx-c1..--fx-c4 on the section." },
    speed: { type: "number", default: 1, description: "Drift rate. 0 renders a single static frame." },
    distortion: { type: "number", default: 0.8, description: "Warp applied to the UV before the colour points are sampled." },
    swirl: { type: "number", default: 0.1, description: "Rotation applied with distance from the centre." },
    grainMixer: { type: "number", default: 0, description: "Noise added to the colour point positions." },
    grainOverlay: { type: "number", default: 0, description: "Film grain composited over the finished blend." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/mesh-gradient.tsx
const UPSTREAM = { speed: 1, distortion: 0.8, swirl: 0.1, grainMixer: 0, grainOverlay: 0 };
const UPSTREAM_COLORS = ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"];

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

const uniformsFor = (el, s) => {
  const colors = paletteFor(el, s.colors).slice(0, meshGradientMeta.maxColorCount);
  return {
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_distortion: s.distortion,
    u_swirl: s.swirl,
    u_grainMixer: s.grainMixer,
    u_grainOverlay: s.grainOverlay,
    ...SIZING,
  };
};

const numberOr = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

// Reduced motion pins the speed to 0, which stops ShaderMount ever asking for
// an animation frame. It still paints once, off the ResizeObserver, so the
// section gets the real shader as a still image rather than being downgraded.
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const speedFor = (s) => (reducedMotion() ? 0 : numberOr(s.speed, UPSTREAM.speed));

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el) return resting;
  const settings = { ...UPSTREAM, ...opts };

  let shader;
  try {
    shader = new ShaderMount(
      el,
      meshGradientFragmentShader,
      uniformsFor(el, settings),
      // A context the browser will only serve off a software rasteriser is
      // refused rather than accepted: a hero that scrolls at 4fps is worse
      // than the CSS one underneath it.
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
    shader.dispose(); // deletes program + textures, disconnects observers, removes the canvas
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    el.removeAttribute("data-fx-live");
    el.removeAttribute("data-paper-shader"); // dispose() leaves this behind
  };
  canvas.addEventListener("webglcontextlost", bail);

  // initProgram is synchronous and swallows a compile or link failure, leaving
  // program null. Without this the canvas would sit there transparent while
  // data-fx-live had already faded the resting gradient out: the blank
  // rectangle the guards exist to prevent.
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
