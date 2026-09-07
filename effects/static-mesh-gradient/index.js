// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// static-mesh-gradient: a port of paper-design/shaders' static mesh gradient,
// commit 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/
// shaders/static-mesh-gradient.ts. The GLSL is not copied into this file -- it
// is imported from vendor/paper.js as `staticMeshGradientFragmentShader`, the
// same export the upstream React component feeds to the same ShaderMount, so
// there is no second copy to drift. Default uniform values are upstream's
// `defaultPreset` from packages/shaders-react/src/shaders/
// static-mesh-gradient.tsx at that commit.
//
// The one background here that does not move, and that is upstream's own
// choice: its defaultPreset ships `speed: 0`, so ShaderMount never asks for an
// animation frame and the section is a single painted still. Reduced motion
// therefore changes nothing, which is the point of having one of these in the
// set -- a hero that is finished rather than performing.
//
// Ours are only the seams: the vendor import path, the mount/update/destroy
// wrapper, the WebGL guards, and reading the colours off --fx-*.
import {
  ShaderMount,
  staticMeshGradientFragmentShader,
  staticMeshGradientMeta,
  getShaderColorFromString,
  ShaderFitOptions,
  defaultObjectSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "static-mesh-gradient",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#ffad0a", "#6200ff", "#e2a3ff", "#ff99fd"], description: "Up to seven colour points. Falls back to --fx-c1..--fx-c4 on the section." },
    speed: { type: "number", default: 0, description: "Upstream ships 0 and the section is a still. Raise it to let the mesh drift." },
    positions: { type: "number", default: 2, description: "How the colour points are laid out before the waves displace them." },
    mixing: { type: "number", default: 0.93, description: "How far the points bleed into one another. Low leaves visible seams." },
  },
};

// upstream defaultPreset, shaders-react/src/shaders/static-mesh-gradient.tsx
const UPSTREAM = {
  speed: 0,
  positions: 2,
  waveX: 1.0,
  waveXShift: 0.6,
  waveY: 1.0,
  waveYShift: 0.21,
  mixing: 0.93,
  grainMixer: 0.0,
  grainOverlay: 0.0,
};
const UPSTREAM_COLORS = ["#ffad0a", "#6200ff", "#e2a3ff", "#ff99fd"];

// The sizing half of the uniform set, from upstream's defaultObjectSizing plus
// the preset's own rotation. ShaderMount only looks up a uniform location for a
// key it was handed, so an omitted one is not "left at its default" -- it never
// gets set at all and the vertex shader reads 0, which for u_rotation would
// turn the whole composition a quarter turn from what upstream ships. All nine
// travel together for that reason.
const SIZING = {
  u_fit: ShaderFitOptions[defaultObjectSizing.fit],
  u_scale: defaultObjectSizing.scale,
  u_rotation: 270,
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
  const colors = paletteFor(el, s.colors).slice(0, staticMeshGradientMeta.maxColorCount);
  return {
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_positions: s.positions,
    u_waveX: s.waveX,
    u_waveXShift: s.waveXShift,
    u_waveY: s.waveY,
    u_waveYShift: s.waveYShift,
    u_mixing: s.mixing,
    u_grainMixer: s.grainMixer,
    u_grainOverlay: s.grainOverlay,
    ...SIZING,
  };
};

const numberOr = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// The preset is already 0, so this only matters when a caller raises the speed:
// reduced motion pins it back down and the section paints one frame off the
// ResizeObserver rather than being downgraded to the CSS layer.
const speedFor = (s) => (reducedMotion() ? 0 : numberOr(s.speed, UPSTREAM.speed));

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el) return resting;
  const settings = { ...UPSTREAM, ...opts };

  let shader;
  try {
    shader = new ShaderMount(
      el,
      staticMeshGradientFragmentShader,
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
