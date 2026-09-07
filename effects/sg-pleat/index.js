// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-pleat: a port of shader-gallery/shaders' `pleat`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, pleat/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off pleat/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (bloom, saturation, contrast, dither, backdrop). Both are
// declared in meta.json `deviations`.
//
// The palette is read through a four-way colour wheel indexed by panel, so all
// four turn up across the frame rather than one owning a corner. u_pleatWidth
// is in CSS px and the shader normalises it against the frame itself, so a
// panel keeps its share of the width at any size and nothing here compensates.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-pleat",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#7fd8e8", "#3f8fbf", "#cfeef5", "#2a5f7a"], description: "Four tints cycled panel to panel through a colour wheel. Falls back to --fx-c1..--fx-c4." },
    pleatWidth: { type: "number", default: 110, description: "Width of one accordion panel in CSS pixels, normalised against the frame by the shader." },
    rollSpeed: { type: "number", default: 0.4, description: "Rate the band of light sweeps across the cloth. 0 leaves it parked." },
    sway: { type: "number", default: 0.45, description: "How far the creases bow and lean. 0 gives a rigid vertical accordion." },
  },
};

// upstream pleat/meta.json params
const UPSTREAM = { pleatWidth: 110, rollSpeed: 0.4, sway: 0.45 };
// ours: a glacier set, cool and pale. See meta.json deviations.
const COLORS = ["#7fd8e8", "#3f8fbf", "#cfeef5", "#2a5f7a"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_pleatWidth: num(s.pleatWidth, UPSTREAM.pleatWidth),
  u_rollSpeed: num(s.rollSpeed, UPSTREAM.rollSpeed),
  u_sway: num(s.sway, UPSTREAM.sway),
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
