// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-slotlight: a port of shader-gallery/shaders' `slotlight` (Narrows family),
// commit 6701714b9b1bfada43e6807f03685a2d0d28427d, slotlight/shader.frag. The GLSL is not copied into this
// file -- it sits beside it as shader.frag, byte for byte the upstream file,
// and is fetched at mount.
//
// The param defaults below are upstream's own, read off slotlight/meta.json at
// the same commit. The palette is not: upstream names its `coral` preset,
// and the table that resolves it lives in @shader-gallery/runtime, which paw-fx
// does not vendor. The four here are a coral set picked off the poster: wine shade, coral mid-wall, a hot pale bounce and a near-white slit, declared `ours` in
// meta.json along with the missing post chain.
//
// Palette roles, as the shader reads them: Index 3 is the wine of the deep walls, 0 the coral mid-wall, 1 the hot bounce near the rim and 2 the pale slit of sky. The shafts and the pool of light on the sand mix 1 and 2.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-slotlight",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#a04e52", "#d98a78", "#f3d6c6", "#5c2233"], description: "Four poles: 3 wine shade, 0 coral mid-wall, 1 hot bounce, 2 the pale sky slit. Falls back to --fx-c1..--fx-c4." },
    speed: { type: "number", default: 0.35, description: "How fast the view creeps up the canyon and the shafts swing; 0 holds the view still." },
    strata: { type: "number", default: 1, description: "Density of the sandstone beds and ledges on the walls." },
    haze: { type: "number", default: 0.8, description: "How much dust lights up inside the sun shafts." },
    bounce: { type: "number", default: 1, description: "How far the bounced sunlight reaches down the walls before cold shade takes over." },
  },
};

// upstream slotlight/meta.json params
const UPSTREAM = { speed: 0.35, strata: 1, haze: 0.8, bounce: 1 };
// ours, not upstream's `coral` preset. See the header. Also what the CSS resting state holds.
const COLORS = ["#a04e52", "#d98a78", "#f3d6c6", "#5c2233"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_speed: num(s.speed, UPSTREAM.speed),
  u_strata: num(s.strata, UPSTREAM.strata),
  u_haze: num(s.haze, UPSTREAM.haze),
  u_bounce: num(s.bounce, UPSTREAM.bounce),
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
