// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-circuit: a port of shader-gallery/shaders' `circuit`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, circuit/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off circuit/meta.json at
// the same commit; meta.json and the shader's inline comments agree on all
// five, so there was nothing to arbitrate.
//
// The palette is NOT upstream's. circuit/meta.json names `"defaultPalette":
// "verdigris"`, a preset that lives in @shader-gallery/runtime and is not in
// the pinned repo, so the port cannot resolve it -- the same call sg-obsidian,
// sg-gloam and sg-bask made, declared the same way, as an `ours` deviation in
// meta.json. The four below were picked off the upstream poster by eye (a
// teal-green solder mask, sea-green copper, pale tinned pads). The shader's own
// zero-branch fallback is blue and violet and would read as a different board;
// paletteFor never reaches it anyway.
//
// What the palette moves: c0 is the solder mask, c1 tints the copper under it,
// c2 is the tinned pads, the silkscreen tint and the travelling pulses. c3 is
// not read by this shader at all; it is kept so the four-pole contract every
// shader hero here shares still holds, and the CSS rest uses it as the copper
// accent.
//
// u_mouse is declared upstream as "(unused)" and there is no mouse param, so
// nothing about the pointer is lost. The poster post chain (grain, vignette,
// saturation, contrast) we cannot supply; it is declared in meta.json.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-circuit",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#2f9c80", "#5cc7a8", "#d8efe2", "#c98a4b"], description: "Four poles. Index 0 is the solder mask, 1 tints the copper, 2 is the tinned pads and the travelling pulses. Index 3 is not read by the shader. Falls back to --fx-c1..--fx-c4." },
    pitch: { type: "number", default: 8, description: "Trace pitch in CSS pixels; low is a dense fine-pitch board, high is a chunky hobby board. Upstream range 4 to 16." },
    speed: { type: "number", default: 1, description: "How fast the light pulses travel along the traces; 0 freezes them in place. Upstream range 0 to 3." },
    density: { type: "number", default: 0.8, description: "Fraction of lanes that carry a trace bundle; the rest hold SMD footprints or bare mask. Upstream range 0.2 to 1." },
    glow: { type: "number", default: 1, description: "Brightness of the travelling pulses and their halo on the mask; 0 is an unpowered board. Upstream range 0 to 2.5." },
    weave: { type: "number", default: 1, description: "Visibility of the fibreglass weave and mask mottle in the ground; 0 is a flat matte mask. Upstream range 0 to 2." },
  },
};

// upstream circuit/meta.json params
const UPSTREAM = { pitch: 8.0, speed: 1.0, density: 0.8, glow: 1.0, weave: 1.0 };
// ours, not upstream's `verdigris`. See the header. Also what the CSS sheet holds.
const COLORS = ["#2f9c80", "#5cc7a8", "#d8efe2", "#c98a4b"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_pitch: num(s.pitch, UPSTREAM.pitch),
  u_speed: num(s.speed, UPSTREAM.speed),
  u_density: num(s.density, UPSTREAM.density),
  u_glow: num(s.glow, UPSTREAM.glow),
  u_weave: num(s.weave, UPSTREAM.weave),
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
