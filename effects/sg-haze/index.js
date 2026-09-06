// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-haze: a port of shader-gallery/shaders' `haze`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, haze/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off haze/meta.json at the
// same commit. Two things upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor) and the
// poster post chain (grain, vignette, saturation). Both are declared in
// meta.json `deviations`.
//
// The palette is a RAMP here, not four independent poles: the shader quantises
// one scalar field into u_steps bands and reads the ramp c0 -> c1 -> c2 -> c3
// with it, so the four colours want to be ordered dark to light. The CSS
// resting state uses the same four as hard gradient stops for the same reason.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-haze",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#2b3350", "#4d6a8e", "#93a8ac", "#d8b8a4"], description: "A four-stop ramp, darkest first: the field is quantised into bands and read through it. Falls back to --fx-c1..--fx-c4." },
    driftSpeed: { type: "number", default: 0.13, description: "How fast the haze drifts. 0 holds the bands still." },
    steps: { type: "number", default: 7, description: "How many colour bands the field is quantised into. Low is a bold poster, high approaches a smooth ramp." },
    softness: { type: "number", default: 1.1, description: "Scale of the underlying field. Low gives big banks, high gives more of them." },
    dither: { type: "number", default: 0.5, description: "Ordered stipple that breaks the band edges up instead of leaving hard contours." },
  },
};

// upstream haze/meta.json params
const UPSTREAM = { driftSpeed: 0.13, steps: 7.0, softness: 1.1, dither: 0.5, mouseInfluence: 0.0 };
// ours: a dusk ramp ordered dark to light. See meta.json deviations.
const COLORS = ["#2b3350", "#4d6a8e", "#93a8ac", "#d8b8a4"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_driftSpeed: num(s.driftSpeed, UPSTREAM.driftSpeed),
  u_steps: num(s.steps, UPSTREAM.steps),
  u_softness: num(s.softness, UPSTREAM.softness),
  u_dither: num(s.dither, UPSTREAM.dither),
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
