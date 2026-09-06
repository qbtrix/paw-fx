// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-lull: a port of shader-gallery/shaders' `lull`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, lull/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off lull/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-lull",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#3a63a8","#87c2e8","#1b3350","#a9dced"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    rockSpeed: { type: "number", default: 0.08, description: "Rate of the whole-field rock; slow even at maximum." },
    sway: { type: "number", default: 18, description: "Amplitude of the coupled sway and heave, in CSS pixels." },
    tiltDepth: { type: "number", default: 0.45, description: "Strength of the rocking brightness tilt across the frame." },
  },
};

// upstream lull/meta.json params
const UPSTREAM = { rockSpeed: 0.08, sway: 18, tiltDepth: 0.45 };
// ours: a midnight set held cold and dim on purpose: the shader desaturates the bands 45% toward grey and floors them near black, so saturated colours would only be thrown away. See meta.json deviations.
const COLORS = ["#3a63a8","#87c2e8","#1b3350","#a9dced"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_rockSpeed: num(s.rockSpeed, UPSTREAM.rockSpeed),
  u_sway: num(s.sway, UPSTREAM.sway),
  u_tiltDepth: num(s.tiltDepth, UPSTREAM.tiltDepth),
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
