// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-suffuse: a port of shader-gallery/shaders' `suffuse`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, suffuse/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off suffuse/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-suffuse",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#a8c8ff","#d3b9ff","#ffc3d8","#b5f0dc"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    driftSpeed: { type: "number", default: 0.12, description: "Drift rate of the poles; the field is slow enough to read as still." },
    shimmer: { type: "number", default: 0.5, description: "Soap-bubble iridescence sweeping through the wash." },
    softness: { type: "number", default: 1.35, description: "Bleed radius of the poles; high is one suffused field, low separates them into pools." },
  },
};

// upstream suffuse/meta.json params
const UPSTREAM = { driftSpeed: 0.12, softness: 1.35, shimmer: 0.5, warp: 0.6, mouseInfluence: 0 };
// ours: an opal set: the shader is high-key by construction (it lifts its output to a 0.07 floor), so these stay pale and the section carries dark ink instead of light. See meta.json deviations.
const COLORS = ["#a8c8ff","#d3b9ff","#ffc3d8","#b5f0dc"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_driftSpeed: num(s.driftSpeed, UPSTREAM.driftSpeed),
  u_softness: num(s.softness, UPSTREAM.softness),
  u_shimmer: num(s.shimmer, UPSTREAM.shimmer),
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
