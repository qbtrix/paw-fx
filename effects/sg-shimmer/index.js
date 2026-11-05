// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-shimmer: a port of shader-gallery/shaders' `shimmer` (Byway family),
// commit 6701714b9b1bfada43e6807f03685a2d0d28427d, shimmer/shader.frag. The GLSL is not copied into this
// file -- it sits beside it as shader.frag, byte for byte the upstream file,
// and is fetched at mount.
//
// The param defaults below are upstream's own, read off shimmer/meta.json at
// the same commit. The palette is not: upstream names its `mint` preset,
// and the table that resolves it lives in @shader-gallery/runtime, which paw-fx
// does not vendor. The four here are a mint set picked off the poster: deep teal ground, mint lamp pools, a paler mint for the paint and near-white lamp heads, declared `ours` in
// meta.json along with the missing post chain.
//
// Palette roles, as the shader reads them: Index 3 is the base tone of the sky, the asphalt and the desert floor, 0 the lamp pools on the road, 1 the reflector posts and road paint, and 2 the lamp heads and stars.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-shimmer",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#5fcfa6", "#8fdcc4", "#e4fff4", "#2e8a74"], description: "Four poles: 3 base of sky and ground, 0 lamp pools, 1 reflectors and paint, 2 lamp heads and stars. Falls back to --fx-c1..--fx-c4." },
    heat: { type: "number", default: 1, description: "How hard rising heat bends the air over the horizon and how bright the road mirage reads." },
    speed: { type: "number", default: 0.5, description: "How fast the lamps and road paint slide past; 0 parks the view." },
    lamps: { type: "number", default: 1, description: "Brightness of the lamp heads and the pools they throw on the road." },
    haze: { type: "number", default: 1, description: "Distance haze and the town glow sitting on the horizon." },
  },
};

// upstream shimmer/meta.json params
const UPSTREAM = { heat: 1, speed: 0.5, lamps: 1, haze: 1 };
// ours, not upstream's `mint` preset. See the header. Also what the CSS resting state holds.
const COLORS = ["#5fcfa6", "#8fdcc4", "#e4fff4", "#2e8a74"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_heat: num(s.heat, UPSTREAM.heat),
  u_speed: num(s.speed, UPSTREAM.speed),
  u_lamps: num(s.lamps, UPSTREAM.lamps),
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
