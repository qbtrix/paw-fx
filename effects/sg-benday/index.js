// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-benday: a port of shader-gallery/shaders' `benday`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, benday/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off benday/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (grain, vignette, contrast, saturation). Both are declared
// in meta.json `deviations`.
//
// A light-ground hero, and the ground is not ours to move: the shader mixes it
// as `mix(vec3(0.93, 0.92, 0.88), c3 * 0.10, u_ink)` and u_ink defaults to 0, so
// newsprint cream is a constant in the GLSL whatever the palette says. Only the
// dots take the palette. style.css hard-codes the same cream as --fx-bg for
// that reason, and the copy runs near-black over it.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-benday",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#ff7a63", "#8fbaff", "#ffd45e", "#79dbcb"], description: "Four dot tones the drifting colour field blends between. Falls back to --fx-c1..--fx-c4. The cream ground is fixed in the shader." },
    dots: { type: "number", default: 30, description: "Dots across the frame. Lower is a coarser, bolder screen." },
    flow: { type: "number", default: 0.3, description: "Drift rate of the colour field under the screen. 0 freezes the blocks." },
    size: { type: "number", default: 0.62, description: "Dot radius as a fraction of the cell, so how much ink the screen lays down." },
  },
};

// upstream benday/meta.json params
const UPSTREAM = { dots: 30, flow: 0.3, size: 0.62, ink: 0.0, mouseInfluence: 0.0 };
// ours: a high-key pop set every one of which carries near-black copy. See
// meta.json deviations.
const COLORS = ["#ff7a63", "#8fbaff", "#ffd45e", "#79dbcb"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_dots: num(s.dots, UPSTREAM.dots),
  u_flow: num(s.flow, UPSTREAM.flow),
  u_size: num(s.size, UPSTREAM.size),
  u_ink: num(s.ink, UPSTREAM.ink),
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
