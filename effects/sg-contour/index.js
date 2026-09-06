// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-contour: a port of shader-gallery/shaders' `contour`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, contour/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off contour/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, a package we do not vendor) and
// the poster post chain (bloom 0.4). Both are declared in meta.json
// `deviations`.
//
// Like sg-haze, the palette is a RAMP and not four poles: each isoline is
// coloured by the elevation of its own level through c0 -> c1 -> c2 -> c3, so
// the four want to read low ground to high ground. u_lineWidth is in CSS px and
// the shader scales it by u_pixelRatio itself, so nothing here compensates for
// the display.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-contour",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#2f4bd8", "#16b8c8", "#4ade9b", "#ffd166"], description: "A four-stop elevation ramp, low ground first: every isoline takes the colour of its own level. Falls back to --fx-c1..--fx-c4." },
    morphSpeed: { type: "number", default: 0.3, description: "How fast the terrain deforms under the lines. 0 freezes the land, though the levels still creep." },
    density: { type: "number", default: 12, description: "Contour levels across the height range. Higher packs the lines tighter." },
    lineWidth: { type: "number", default: 1.2, description: "Ordinary isoline width in CSS pixels. Every fifth index contour is drawn at twice this." },
  },
};

// upstream contour/meta.json params
const UPSTREAM = { morphSpeed: 0.3, density: 12, lineWidth: 1.2 };
// ours: a survey ramp, low ground to high. See meta.json deviations.
const COLORS = ["#2f4bd8", "#16b8c8", "#4ade9b", "#ffd166"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_morphSpeed: num(s.morphSpeed, UPSTREAM.morphSpeed),
  u_density: num(s.density, UPSTREAM.density),
  u_lineWidth: num(s.lineWidth, UPSTREAM.lineWidth),
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
