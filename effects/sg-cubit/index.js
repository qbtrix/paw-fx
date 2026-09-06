// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-cubit: a port of shader-gallery/shaders' `cubit`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, cubit/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off cubit/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (grain, vignette, contrast, saturation). Both are declared
// in meta.json `deviations`.
//
// Worth knowing before recolouring: the shader builds each cube as
// `mix(c3, c0, rnd)` pushed toward c2, so u_palette[1] is never read. It stays
// in the set because glsl-mount always sends four and because style.css uses it
// on the resting layer, but changing --fx-c2 alone moves the CSS state and not
// the shader.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-cubit",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#4d7ce8", "#3f5aa6", "#7de3ff", "#1d2440"], description: "Cube tones. The shader mixes index 3 to index 0 per cube and lifts toward index 2; index 1 is used by the CSS resting state only. Falls back to --fx-c1..--fx-c4." },
    cells: { type: "number", default: 8, description: "Cubes across the frame. Lower is a bolder, blockier grid." },
    rise: { type: "number", default: 0.6, description: "How far each cube rises and falls, which reads as brightness because taller blocks catch more light." },
    speed: { type: "number", default: 0.5, description: "Rate the cubes rise and fall. 0 holds the grid still." },
    contrast: { type: "number", default: 0.7, description: "Shading spread between the three visible faces. 0 flattens the cubes into hexagons." },
  },
};

// upstream cubit/meta.json params
const UPSTREAM = { cells: 8, rise: 0.6, speed: 0.5, contrast: 0.7, mouseInfluence: 0.0 };
// ours: a night-city blue with a cyan lift. See meta.json deviations.
const COLORS = ["#4d7ce8", "#3f5aa6", "#7de3ff", "#1d2440"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_cells: num(s.cells, UPSTREAM.cells),
  u_rise: num(s.rise, UPSTREAM.rise),
  u_speed: num(s.speed, UPSTREAM.speed),
  u_contrast: num(s.contrast, UPSTREAM.contrast),
  u_mouseInfluence: num(s.mouseInfluence, UPSTREAM.mouseInfluence),
});

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  const s = { ...UPSTREAM, ...opts };
  const handle = mountGlsl(el, new URL("./shader.frag", import.meta.url), {
    palette: paletteFor(el, s.colors, COLORS),
    uniforms: uniformsFor(s),
  });
  return {
    update(next = {}) {
      Object.assign(s, next);
      handle.update({ palette: paletteFor(el, s.colors, COLORS), uniforms: uniformsFor(s) });
    },
    destroy: handle.destroy,
  };
}
