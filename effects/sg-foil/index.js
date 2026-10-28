// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-gloam: a port of shader-gallery/shaders' `gloam`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, gloam/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off gloam/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor, so ours are
// declared in meta.json `deviations`) and the poster post chain (duotone,
// grain, vignette), which we do not have at all. Both are declared.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-gloam",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#232c6b", "#7d6bff", "#16404f", "#2b1642"], description: "Four poles; index 1 is the luminous one. Falls back to --fx-c1..--fx-c4." },
    driftSpeed: { type: "number", default: 0.14, description: "Drift rate of the twilight poles. 0 holds the dusk still." },
    glow: { type: "number", default: 0.7, description: "Brightness of the pole blooming through the dark." },
    warp: { type: "number", default: 0.6, description: "Organic distortion of the colour edges." },
  },
};

// upstream gloam/meta.json params
const UPSTREAM = { driftSpeed: 0.14, softness: 1.0, glow: 0.7, warp: 0.6, mouseInfluence: 0.0 };
// ours: a nocturne the CSS resting state can hold too. See meta.json deviations.
const COLORS = ["#232c6b", "#7d6bff", "#16404f", "#2b1642"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_driftSpeed: num(s.driftSpeed, UPSTREAM.driftSpeed),
  u_softness: num(s.softness, UPSTREAM.softness),
  u_glow: num(s.glow, UPSTREAM.glow),
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
