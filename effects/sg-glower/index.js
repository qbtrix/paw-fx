// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-glower: a port of shader-gallery/shaders' `glower`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, glower/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off glower/meta.json at the
// same commit.
//
// The palette is NOT upstream's. glower/meta.json names `"defaultPalette":
// "umbra"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same call sg-obsidian,
// sg-gloam and sg-bask made, declared the same way, as an `ours` deviation in
// meta.json. The four below were picked off the upstream poster by eye.
//
// What the palette moves: c1 is the strongest glow inside the clouds and c2
// the pale ones; c0 tints the cloud crowns and the flood's reflection; c3 is
// the deep sky behind. The orange town light is the shader's own constant.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-glower",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#6b5bd6", "#8a4fe0", "#c9b8ff", "#2a1f6b"], description: "Four storm tones. 1 is the strongest glow inside the clouds, 2 the pale ones; 0 tints the cloud crowns and the flood; 3 is the deep sky. Falls back to --fx-c1..--fx-c4." },
    glow: { type: "number", default: 1, description: "How strongly the glows inside the clouds light the billows around them. Upstream range 0.2 to 2." },
    churn: { type: "number", default: 1, description: "How fast the towers boil and the glows wander and swell. Upstream range 0 to 2.5." },
    town: { type: "number", default: 1, description: "Warm sodium light of the town on the plain and on the cloud bases. Upstream range 0 to 2." },
  },
};

// upstream glower/meta.json params
const UPSTREAM = { glow: 1, churn: 1, town: 1 };
// ours, not upstream's `umbra`. See the header. Also what the CSS sheet holds.
const COLORS = ["#6b5bd6", "#8a4fe0", "#c9b8ff", "#2a1f6b"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_glow: num(s.glow, UPSTREAM.glow),
  u_churn: num(s.churn, UPSTREAM.churn),
  u_town: num(s.town, UPSTREAM.town),
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
