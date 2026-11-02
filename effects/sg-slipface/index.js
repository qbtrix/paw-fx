// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-slipface: a port of shader-gallery/shaders' `slipface`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, slipface/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off slipface/meta.json at
// the same commit.
//
// The palette is NOT upstream's. slipface/meta.json names `"defaultPalette":
// "foundry"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same call sg-obsidian,
// sg-gloam and sg-bask made, declared the same way, as an `ours` deviation in
// meta.json. The four below were picked off the upstream poster by eye.
//
// What the palette moves: the sand ramps c3 (shade) -> c0 -> c1 -> c2 as the
// moonlight on a slope rises; c2 also tints the moon, the glints and the
// stars, and c1/c2 the sand blowing off the crests.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-slipface",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#8a5a24", "#e0a040", "#ffe0a0", "#1c2340"], description: "Four sand tones, the ramp a slope climbs as the moon lights it: 3 (shade) to 0 to 1 to 2. 2 also tints the moon, glints and stars. Falls back to --fx-c1..--fx-c4." },
    wind: { type: "number", default: 1, description: "How much sand streams off the crests and how fast it blows. Upstream range 0 to 2." },
    moon: { type: "number", default: 0.08, description: "Raises the moon, shortening the shadows and lighting more of the slopes. Upstream range 0.03 to 0.2." },
    ripple: { type: "number", default: 1, description: "Depth of the interfering ripple marks on the windward slopes. Upstream range 0 to 2.5." },
    haze: { type: "number", default: 0.8, description: "Night haze that softens the distant dunes into the horizon. Upstream range 0 to 2." },
  },
};

// upstream slipface/meta.json params
const UPSTREAM = { wind: 1, moon: 0.08, ripple: 1, haze: 0.8 };
// ours, not upstream's `foundry`. See the header. Also what the CSS sheet holds.
const COLORS = ["#8a5a24", "#e0a040", "#ffe0a0", "#1c2340"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_wind: num(s.wind, UPSTREAM.wind),
  u_moon: num(s.moon, UPSTREAM.moon),
  u_ripple: num(s.ripple, UPSTREAM.ripple),
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
