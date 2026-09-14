// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-hologram: a port of shader-gallery/shaders' `hologram`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, hologram/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off hologram/meta.json at
// the same commit. The palette is upstream's too, and that is worth saying:
// hologram/meta.json declares `"palette": null`, so the runtime feeds zeros and
// the shader falls through to the four colours it carries itself (line 216 of
// shader.frag). Those four are what its poster is rendered with, so the port
// passes them explicitly rather than passing zeros through a paw-fx runtime
// that never produces them. The one thing upstream supplies that we cannot is
// the poster post chain (grain, vignette, saturation, contrast); it is declared
// in meta.json `deviations`.
//
// u_mouseInfluence stays at upstream's 0.0 and is not offered as an option:
// glsl-mount.js holds u_mouse at (0,0) by design, so a pointer knob would be a
// control that moves nothing.
//
// The HUD hero in the shader.gallery set: three geometric layers -- a far
// measurement grid, a lattice of dialled rings, near scrolling readout bars --
// thrown into a hazy dark room and split into cyan and magenta ghosts by the
// projector. It is the darkest field here, so the copy runs white and the scrim
// is a near-black wash.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-hologram",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#3b82f6", "#a855f7", "#22d3ee", "#f43f5e"], description: "Four poles. Index 2 is the hologram itself (core, cyan ghost, motes); index 3 is the warm ghost fringe; 0 and 1 light the dark room. Falls back to --fx-c1..--fx-c4." },
    speed: { type: "number", default: 0.35, description: "Camera drift, gauge rotation, bar scrolling and interference. 0 freezes the projection." },
    split: { type: "number", default: 3, description: "Chroma ghost offset in CSS pixels. 0 is a clean single image." },
    scan: { type: "number", default: 0.6, description: "Depth of the scanlines combing the projection. 0 removes them." },
    flicker: { type: "number", default: 0.6, description: "Brightness flicker, dropouts and horizontal tears. 0 is a steady projector." },
    haze: { type: "number", default: 0.8, description: "How much the projector lights the room: floor glow, drifting dust, motes in the beam." },
  },
};

// upstream hologram/meta.json params
const UPSTREAM = { speed: 0.35, split: 3.0, scan: 0.6, flicker: 0.6, haze: 0.8, mouseInfluence: 0.0 };
// upstream's own fallback palette, the one hologram/shader.frag uses when the
// runtime feeds no preset. See the header. Also what the CSS resting state holds.
const COLORS = ["#3b82f6", "#a855f7", "#22d3ee", "#f43f5e"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_speed: num(s.speed, UPSTREAM.speed),
  u_split: num(s.split, UPSTREAM.split),
  u_scan: num(s.scan, UPSTREAM.scan),
  u_flicker: num(s.flicker, UPSTREAM.flicker),
  u_haze: num(s.haze, UPSTREAM.haze),
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
