// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-sheen: a port of shader-gallery/shaders' `sheen`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, sheen/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off sheen/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (bloom, saturation, contrast, dither, backdrop). Both are
// declared in meta.json `deviations`.
//
// Worth knowing before changing u_weave: it does not scale the way it reads.
// The shader squares the ratio of thread spacing to its reference so the moiré
// band period comes out inversely proportional to it, which means a FINER weave
// (smaller value) gives BROADER, smoother fringes and a coarser one gives tight
// busy ones. The default is the calm end of that.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-sheen",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#24d3c4", "#8b6cf0", "#ffcf6b", "#1a3a6b"], description: "Four tints, one per fringe order, so successive interference bands read as different hues. Falls back to --fx-c1..--fx-c4." },
    weave: { type: "number", default: 6, description: "Thread spacing in CSS pixels. Lower is a finer weave and, counter-intuitively, broader and smoother fringes." },
    shimmerSpeed: { type: "number", default: 0.35, description: "Rate the upper gauze rotates and drifts against the lower. 0 freezes the interference." },
    fringeGlow: { type: "number", default: 0.8, description: "Brightness of the luminous fringes over the dark field." },
  },
};

// upstream sheen/meta.json params
const UPSTREAM = { weave: 6, shimmerSpeed: 0.35, fringeGlow: 0.8 };
// ours: a peacock set, one hue per fringe order. See meta.json deviations.
const COLORS = ["#24d3c4", "#8b6cf0", "#ffcf6b", "#1a3a6b"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_weave: num(s.weave, UPSTREAM.weave),
  u_shimmerSpeed: num(s.shimmerSpeed, UPSTREAM.shimmerSpeed),
  u_fringeGlow: num(s.fringeGlow, UPSTREAM.fringeGlow),
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
