// Paper Shaders
// Copyright 2026 Paper
// Licensed under the Apache License, Version 2.0. The full licence and the
// NOTICE that Apache-2.0 section 4(d) requires ship beside this file as
// _fx/vendor/paper.LICENSE and _fx/vendor/paper.NOTICE.
// Powered by Paper Shaders: https://shaders.paper.design
//
// water: a port of paper-design/shaders' water, commit
// 7002061d8389781a45e479584deeca0cf538474e, packages/shaders/src/shaders/
// water.ts. The GLSL is not copied into this file -- it is imported from
// vendor/paper.js as `waterFragmentShader`, the same export the upstream React
// component feeds to the same ShaderMount, so there is no second copy to
// drift. Default uniform values are upstream's `abstractPreset` from
// packages/shaders-react/src/shaders/water.tsx at that commit; see meta.json
// deviations for why that preset and not `defaultPreset`.
//
// Of the five paper-design ports, this is the one whose vendored GLSL is NOT
// line-for-line the pinned commit: the published 0.0.80 bundle drops an
// `if (u_layering > 0.)` guard and a `* u_colorHighlight.a` factor. Neither is
// reachable at these defaults, and both are declared in meta.json deviations.
//
// THE IMAGE. This shader refracts a source image: `vec4 image =
// texture(u_image, imageUV)` and the colour is mixed toward it by image.a, so
// with no texture bound the sampler reads (0,0,0,1) and the whole hero renders
// flat black. It genuinely needs an input. A generated site has to be
// self-contained, so rather than fetching a photograph the section paints its
// own: four soft blooms in the --fx-c* palette on a canvas, handed over as a
// data: URI. What the visitor sees is that gradient under moving water, and
// because it is drawn from the same custom properties as the CSS resting
// state, the two states agree.
import {
  ShaderMount,
  waterFragmentShader,
  getShaderColorFromString,
  ShaderFitOptions,
  defaultObjectSizing,
} from "../../vendor/paper.js";

export const meta = {
  name: "water",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["paper"],
  license: "Apache-2.0",
  options: {
    colors: { type: "string[]", default: ["#0d1a45", "#1f6f92", "#57cbbc", "#1a1038"], description: "Four blooms painted into the source gradient the water refracts. Falls back to --fx-c1..--fx-c4." },
    speed: { type: "number", default: 1, description: "Rate the surface moves. 0 renders a single static frame." },
    waves: { type: "number", default: 1, description: "Depth of the wave distortion." },
    caustic: { type: "number", default: 0.4, description: "Strength of the caustic light banding." },
  },
};

// upstream abstractPreset, shaders-react/src/shaders/water.tsx
const UPSTREAM = {
  speed: 1,
  colorBack: "#909090",
  colorHighlight: "#ffffff",
  highlights: 0,
  layering: 0,
  edges: 1,
  waves: 1,
  caustic: 0.4,
  size: 0.15,
};
// ours: the gradient the water refracts. See meta.json deviations.
const COLORS = ["#0d1a45", "#1f6f92", "#57cbbc", "#1a1038"];

// defaultObjectSizing with the preset's own fit and scale. A uniform
// ShaderMount was not handed never gets a location looked up and the vertex
// shader reads 0, which for u_fit is a different fit mode than the preset asks
// for, so all nine travel together.
const SIZING = {
  u_fit: ShaderFitOptions.cover,
  u_scale: 3,
  u_rotation: defaultObjectSizing.rotation,
  u_offsetX: defaultObjectSizing.offsetX,
  u_offsetY: defaultObjectSizing.offsetY,
  u_originX: defaultObjectSizing.originX,
  u_originY: defaultObjectSizing.originY,
  u_worldWidth: defaultObjectSizing.worldWidth,
  u_worldHeight: defaultObjectSizing.worldHeight,
};

const CSS_COLOR_VARS = ["--fx-c1", "--fx-c2", "--fx-c3", "--fx-c4"];

function paletteFor(el, colors) {
  if (Array.isArray(colors) && colors.length === 4) return colors;
  const style = getComputedStyle(el);
  const fromCss = CSS_COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
  return fromCss.length === 4 ? fromCss : COLORS;
}

// The source image, painted rather than fetched. Deliberately soft and
// low-frequency: the shader distorts and re-samples it, and any detail finer
// than the wave amplitude turns to mud. 16:9 so u_imageAspectRatio matches the
// hero and `cover` has nothing to crop.
function gradientImage(colors) {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const blooms = [
    [0.18, 0.24, 0.62, colors[3]],
    [0.78, 0.3, 0.58, colors[1]],
    [0.62, 0.86, 0.55, colors[2]],
    [0.08, 0.82, 0.5, colors[1]],
  ];
  for (const [x, y, r, color] of blooms) {
    const g = ctx.createRadialGradient(
      x * canvas.width, y * canvas.height, 0,
      x * canvas.width, y * canvas.height, r * canvas.width,
    );
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  return img;
}

const uniformsFor = (s, image) => ({
  u_image: image,
  u_colorBack: getShaderColorFromString(s.colorBack),
  u_colorHighlight: getShaderColorFromString(s.colorHighlight),
  u_highlights: s.highlights,
  u_layering: s.layering,
  u_waves: s.waves,
  u_edges: s.edges,
  u_caustic: s.caustic,
  u_size: s.size,
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

  // ShaderMount throws on an image that is not complete, and a data: URI still
  // decodes asynchronously. A destroy() during the decode wins, via `torn`.
  const image = gradientImage(paletteFor(el, settings.colors));
  const decoded = image?.decode ? image.decode().catch(() => {}) : Promise.resolve();
  decoded.then(() => {
    if (torn) return;
    if (!image?.complete || !image.naturalWidth) return bail();
    try {
      shader = new ShaderMount(
        el,
        waterFragmentShader,
        uniformsFor(settings, image),
        // A context the browser will only serve off a software rasteriser is
        // refused: a hero that scrolls at 4fps is worse than the CSS one
        // underneath it.
        { failIfMajorPerformanceCaveat: true, antialias: true, alpha: true },
        speedFor(settings),
        0,
        2,
        8294400,
        ["u_image"], // mipmaps, as upstream's component asks for
      );
    } catch {
      return bail(); // no WebGL2, or a caveated context
    }
    gl = shader.gl; // captured before dispose() drops the program
    canvas = shader.canvasElement;
    canvas.addEventListener("webglcontextlost", bail);
    // initProgram swallows a compile or link failure and leaves program null.
    // Without this the canvas sits transparent while data-fx-live has already
    // faded the resting gradient out: the blank rectangle the guards exist for.
    if (shader.program === null) return bail();
    el.setAttribute("data-fx-live", "");
  });

  return {
    update(next = {}) {
      Object.assign(settings, next);
      if (torn || shader === null) return;
      shader.setUniforms(uniformsFor(settings, image));
      if ("speed" in next) shader.setSpeed(speedFor(settings));
    },
    destroy: bail,
  };
}
