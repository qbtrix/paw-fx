// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-uptime: a port of shader-gallery/shaders' `uptime`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, uptime/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off uptime/meta.json at the
// same commit.
//
// The palette is NOT upstream's. uptime/meta.json names `"defaultPalette":
// "glacier"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same call sg-obsidian,
// sg-gloam and sg-bask made, declared the same way, as an `ours` deviation in
// meta.json. The four below were picked off the upstream poster by eye.
//
// What the palette moves: c1 and c2 are most of the status lights and c2 the
// scan band; c0 is the rarer lights and the ceiling strips; c3 is the cold
// ambient wash on rack fronts and floor. The amber lights and the warm ember
// glow at the far end are the shader's own constants, not palette.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-uptime",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#8fdcff", "#4fb6ff", "#dff6ff", "#25507f"], description: "Four cold tones. 1 and 2 are most of the status lights and 2 the scan band; 0 the rarer lights and the ceiling strips; 3 the ambient wash on racks and floor. Falls back to --fx-c1..--fx-c4." },
    scan: { type: "number", default: 1, description: "Brightness of the band of cold light scanning down the aisle. Upstream range 0 to 2." },
    scanSpeed: { type: "number", default: 1, description: "How fast the scan band travels away down the aisle. Upstream range 0 to 2." },
    haze: { type: "number", default: 1, description: "Density of the cold haze that swallows the far end of the hall. Upstream range 0.2 to 2." },
    activity: { type: "number", default: 1, description: "How many status lights are lit and how fast they blink. Upstream range 0 to 2." },
  },
};

// upstream uptime/meta.json params
const UPSTREAM = { scan: 1, scanSpeed: 1, haze: 1, activity: 1 };
// ours, not upstream's `glacier`. See the header. Also what the CSS sheet holds.
const COLORS = ["#8fdcff", "#4fb6ff", "#dff6ff", "#25507f"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_scan: num(s.scan, UPSTREAM.scan),
  u_scanSpeed: num(s.scanSpeed, UPSTREAM.scanSpeed),
  u_haze: num(s.haze, UPSTREAM.haze),
  u_activity: num(s.activity, UPSTREAM.activity),
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
