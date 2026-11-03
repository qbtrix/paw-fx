// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-nave: a port of shader-gallery/shaders' `nave`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, nave/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off nave/meta.json at the
// same commit.
//
// The palette is NOT upstream's. nave/meta.json names `"defaultPalette":
// "clay"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same call sg-gloam and
// sg-bask made, declared the same way, as an `ours` deviation
// in meta.json. The four below were picked off the upstream poster by eye.
//
// What the palette moves: c1 and c2 mix into the sunlight, and c1 is the lit
// window glass; c2 and c0 are the dusty shafts; c3 squared is the warm glow at
// the far end of the nave and c0 the haze around it. The blue-black stone and
// the cool ambient are the shader's own constants, not palette.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-nave",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#a87588", "#f2dcc0", "#e9a77c", "#ff8a3d"], description: "Four warm tones. 1 and 2 mix into the sunlight and 1 is the window glass; 0 and 2 the dusty shafts; 3 the glow at the far end of the nave. Falls back to --fx-c1..--fx-c4." },
    sun: { type: "number", default: 1.1, description: "Strength of the sun through the windows, from overcast gloom to blazing shafts. Upstream range 0.3 to 1.8." },
    cloud: { type: "number", default: 0.6, description: "How fast clouds pass the windows, dimming one shaft after another. Upstream range 0 to 1.5." },
    dust: { type: "number", default: 0.8, description: "How much dust hangs in the air, from faint shafts to thick beams full of motes. Upstream range 0 to 2." },
    glide: { type: "number", default: 0.35, description: "Speed of the slow walk down the nave. Upstream range 0 to 1." },
  },
};

// upstream nave/meta.json params
const UPSTREAM = { sun: 1.1, cloud: 0.6, dust: 0.8, glide: 0.35 };
// ours, not upstream's `clay`. See the header. Also what the CSS sheet holds.
const COLORS = ["#a87588", "#f2dcc0", "#e9a77c", "#ff8a3d"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_sun: num(s.sun, UPSTREAM.sun),
  u_cloud: num(s.cloud, UPSTREAM.cloud),
  u_dust: num(s.dust, UPSTREAM.dust),
  u_glide: num(s.glide, UPSTREAM.glide),
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
