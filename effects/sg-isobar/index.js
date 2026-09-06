// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-isobar: a port of shader-gallery/shaders' `isobar`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, isobar/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off isobar/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-isobar",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#3f7bff","#9a6cff","#48e6d2","#ff7a97"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    spin: { type: "number", default: 0.25, description: "Rate each pinwheel revolves about its own eye." },
    drift: { type: "number", default: 0.3, description: "Rate the systems drift bodily across the chart." },
    winding: { type: "number", default: 5, description: "How tightly the rain bands wind in." },
  },
};

// upstream isobar/meta.json params
const UPSTREAM = { spin: 0.25, drift: 0.3, winding: 5, eye: 60 };
// ours: a midnight set: the hue blends by radius, so these run cold at the eye and warm at the outer arms. See meta.json deviations.
const COLORS = ["#3f7bff","#9a6cff","#48e6d2","#ff7a97"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_spin: num(s.spin, UPSTREAM.spin),
  u_drift: num(s.drift, UPSTREAM.drift),
  u_winding: num(s.winding, UPSTREAM.winding),
  u_eye: num(s.eye, UPSTREAM.eye),
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
