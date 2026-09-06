// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-bask: a port of shader-gallery/shaders' `bask`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, bask/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off bask/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (grain, vignette, exposure, saturation). Both are declared
// in meta.json `deviations`.
//
// The one light-ground hero in the shader.gallery set: the shader lifts its
// shadows (`col * 0.95 + 0.05`) and pools a dawn glow into the lower third, so
// the section runs dark ink on a bright field rather than the other way round.
// That inverts the scrim -- it is a white wash here, not the near-black one the
// dark ports use.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-bask",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#ffcf8a", "#ff8a5c", "#fff4e6", "#f2b3c2"], description: "Four poles, quadrant order: lower left, lower right, upper right, upper left. Index 1 also lights the dawn glow. Falls back to --fx-c1..--fx-c4." },
    driftSpeed: { type: "number", default: 0.16, description: "How fast the colour poles wander. 0 holds the morning still." },
    softness: { type: "number", default: 1.4, description: "Pole influence radius. Low keeps tight pools, high spreads broad banks." },
    dawn: { type: "number", default: 0.6, description: "Warm glow rising out of the lower third." },
    warp: { type: "number", default: 0.55, description: "Organic warp on the colour edges, so the poles are not clean circles." },
  },
};

// upstream bask/meta.json params
const UPSTREAM = { driftSpeed: 0.16, softness: 1.4, dawn: 0.6, warp: 0.55, mouseInfluence: 0.0 };
// ours: a warm daybreak the CSS resting state can hold too. See meta.json deviations.
const COLORS = ["#ffcf8a", "#ff8a5c", "#fff4e6", "#f2b3c2"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_driftSpeed: num(s.driftSpeed, UPSTREAM.driftSpeed),
  u_softness: num(s.softness, UPSTREAM.softness),
  u_dawn: num(s.dawn, UPSTREAM.dawn),
  u_warp: num(s.warp, UPSTREAM.warp),
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
