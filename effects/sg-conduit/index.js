// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-conduit: a port of shader-gallery/shaders' `conduit`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, conduit/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off conduit/meta.json at
// the same commit.
//
// The palette is NOT upstream's. conduit/meta.json names `"defaultPalette":
// "mint"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same call sg-gloam and
// sg-bask made, declared the same way, as an `ours` deviation
// in meta.json. The four below were picked off the upstream poster by eye.
//
// What the palette moves: c3 and c0 mix into the melt in the seams and the
// light it throws on the walls; c1 and c2 are the white-hot core of each seam
// and the cool rim on the basalt. The ember-dark crust is the shader's own
// constant, not palette.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-conduit",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#4fe3c4", "#c9fff0", "#f1fffa", "#1d8676"], description: "Four mint tones. 3 and 0 mix into the melt and the light it throws on the walls; 1 and 2 the white-hot seam cores and the rim on the rock. Falls back to --fx-c1..--fx-c4." },
    flow: { type: "number", default: 0.5, description: "How fast the crust drifts and the walk moves down the tube. Upstream range 0 to 1.5." },
    heat: { type: "number", default: 1, description: "Brightness of the molten seams and the light they throw onto the walls. Upstream range 0.2 to 2." },
    sparks: { type: "number", default: 1, description: "How many sparks lift off the flow and how bright they are. Upstream range 0 to 2.5." },
    haze: { type: "number", default: 1, description: "Density of the lit fume that fills the tube and hides the far bend. Upstream range 0 to 2." },
  },
};

// upstream conduit/meta.json params
const UPSTREAM = { flow: 0.5, heat: 1, sparks: 1, haze: 1 };
// ours, not upstream's `mint`. See the header. Also what the CSS sheet holds.
const COLORS = ["#4fe3c4", "#c9fff0", "#f1fffa", "#1d8676"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_flow: num(s.flow, UPSTREAM.flow),
  u_heat: num(s.heat, UPSTREAM.heat),
  u_sparks: num(s.sparks, UPSTREAM.sparks),
  u_haze: num(s.haze, UPSTREAM.haze),
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
