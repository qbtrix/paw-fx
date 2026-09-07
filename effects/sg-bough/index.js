// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-bough: a port of shader-gallery/shaders' `bough`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, bough/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off bough/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-bough",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#f6dcae","#d59a58","#4a3a2c","#8a6a4a"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    swaySpeed: { type: "number", default: 0.25, description: "Rate the cluster pivots in the draft; every leaf nods on its own phase." },
    leafSize: { type: "number", default: 80, description: "Leaf size in CSS pixels." },
    penumbra: { type: "number", default: 1, description: "Edge softness; near leaves bite crisp, far ones swell into grey breaths." },
  },
};

// upstream bough/meta.json params
const UPSTREAM = { swaySpeed: 0.25, leafSize: 80, penumbra: 1, poolDepth: 0.65 };
// ours: a lamplight set rather than the upstream midnight one: the shader draws pure occlusion of a warm wall glow, and a cold palette reads as a mistake rather than a choice. See meta.json deviations.
const COLORS = ["#f6dcae","#d59a58","#4a3a2c","#8a6a4a"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_swaySpeed: num(s.swaySpeed, UPSTREAM.swaySpeed),
  u_leafSize: num(s.leafSize, UPSTREAM.leafSize),
  u_penumbra: num(s.penumbra, UPSTREAM.penumbra),
  u_poolDepth: num(s.poolDepth, UPSTREAM.poolDepth),
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
