// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-weft: a port of shader-gallery/shaders' `weft`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, weft/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off weft/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (bloom, vignette, saturation, dither). Both are declared in
// meta.json `deviations`.
//
// Note the two defaults that disagree with the header comments in the upstream
// .frag itself: it annotates u_thick as 3 and the meta.json ships 1.8. The
// meta.json is what the runtime actually feeds, so that is what is used here,
// and the comment in the GLSL is left exactly as upstream wrote it because the
// fidelity gate compares those bytes.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-weft",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#c9622f", "#f0a15e", "#ffd9a8", "#8a4b2a"], description: "A four-stop ramp: warp threads take their tint across the frame, weft threads down it. Falls back to --fx-c1..--fx-c4." },
    spacing: { type: "number", default: 22, description: "Distance between threads in CSS pixels, the same for warp and weft." },
    thick: { type: "number", default: 1.8, description: "Thread half-width in CSS pixels." },
    ripple: { type: "number", default: 0.4, description: "Amplitude of the slow cloth ripple. 0 leaves the grid dead straight." },
    sheenSpeed: { type: "number", default: 0.4, description: "Rate the diagonal band of light travels across the cloth. 0 parks it." },
  },
};

// upstream weft/meta.json params
const UPSTREAM = { spacing: 22, thick: 1.8, ripple: 0.4, sheen: 1.0, sheenSpeed: 0.4, glow: 1.0, relief: 0.8 };
// ours: a copper cloth, ordered so the warp warms across the frame. See
// meta.json deviations.
const COLORS = ["#c9622f", "#f0a15e", "#ffd9a8", "#8a4b2a"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_spacing: num(s.spacing, UPSTREAM.spacing),
  u_thick: num(s.thick, UPSTREAM.thick),
  u_ripple: num(s.ripple, UPSTREAM.ripple),
  u_sheen: num(s.sheen, UPSTREAM.sheen),
  u_sheenSpeed: num(s.sheenSpeed, UPSTREAM.sheenSpeed),
  u_glow: num(s.glow, UPSTREAM.glow),
  u_relief: num(s.relief, UPSTREAM.relief),
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
