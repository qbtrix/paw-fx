// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-laminar: a port of shader-gallery/shaders' `laminar`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, laminar/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off laminar/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-laminar",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#8ceaff","#4f8cff","#c2f7ea","#3348b8"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    flow: { type: "number", default: 0.5, description: "Speed of the packets riding the lines downstream." },
    density: { type: "number", default: 22, description: "Number of streamlines across the field." },
    radius: { type: "number", default: 0.22, description: "Size of the invisible body the flow parts around." },
  },
};

// upstream laminar/meta.json params
const UPSTREAM = { density: 22, radius: 0.22, flow: 0.5, spin: 0, posY: 0, line: 1.6, glow: 1, hueSpread: 0.9, depth: 0.8 };
// ours: a glacier set: cold blues with one near-white crest, which is what makes the crowding over the shoulders read as speed. See meta.json deviations.
const COLORS = ["#8ceaff","#4f8cff","#c2f7ea","#3348b8"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_density: num(s.density, UPSTREAM.density),
  u_radius: num(s.radius, UPSTREAM.radius),
  u_flow: num(s.flow, UPSTREAM.flow),
  u_spin: num(s.spin, UPSTREAM.spin),
  u_posY: num(s.posY, UPSTREAM.posY),
  u_line: num(s.line, UPSTREAM.line),
  u_glow: num(s.glow, UPSTREAM.glow),
  u_hueSpread: num(s.hueSpread, UPSTREAM.hueSpread),
  u_depth: num(s.depth, UPSTREAM.depth),
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
