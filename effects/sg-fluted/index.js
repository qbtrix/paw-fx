// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-fluted: a port of shader-gallery/shaders' `fluted`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, fluted/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off fluted/meta.json at the
// same commit; meta.json and the shader's inline comments agree on all five, so
// there was nothing to arbitrate.
//
// The palette is NOT upstream's. fluted/meta.json names `"defaultPalette":
// "witchlight"`, a preset that lives in @shader-gallery/runtime and is not in
// the pinned repo, so the port cannot resolve it -- the same call sg-obsidian,
// sg-gloam and sg-bask made, declared the same way, as an `ours` deviation in
// meta.json. The four below were picked off the upstream poster by eye (pink,
// amber, lavender, a teal ground); they are not the shader's zero-branch
// fallback, which paletteFor never reaches anyway.
//
// u_mouseInfluence stays at upstream's 0.0 and is not offered as an option:
// glsl-mount.js holds u_mouse at (0,0) by design, so a pointer knob would be a
// control that moves nothing. The poster post chain (grain, aberration,
// vignette, saturation, contrast) we cannot supply either; both are declared.
//
// What the palette moves: c0..c3 are the four drifting glows behind the glass,
// c3 also sets the dark ground and the room the rib edges reflect, and c2/c1
// tint the specular lines. The glass itself -- ribs, seams, grooves -- is
// geometry, not colour.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-fluted",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#ff5fa2", "#ffb04a", "#b79bff", "#3fb8c8"], description: "Four glows behind the glass. Index 3 also sets the dark ground and the room the rib edges reflect; 2 and 1 tint the specular lines. Falls back to --fx-c1..--fx-c4." },
    ribs: { type: "number", default: 26, description: "How many ribs span the frame; low is a few fat reeds, high is fine tight fluting. Upstream range 6 to 60." },
    refraction: { type: "number", default: 0.85, description: "How far each rib bends and shifts the backdrop; 0 is flat glass. Upstream range 0 to 2." },
    dispersion: { type: "number", default: 0.7, description: "Chromatic split at the rib edges; 0 is achromatic glass. Upstream range 0 to 1.5." },
    drift: { type: "number", default: 0.3, description: "How fast the glows and pillars drift behind the glass; 0 holds the backdrop still. Upstream range 0 to 1." },
  },
};

// upstream fluted/meta.json params
const UPSTREAM = { ribs: 26, refraction: 0.85, dispersion: 0.7, drift: 0.3, mouseInfluence: 0.0 };
// ours, not upstream's `witchlight`. See the header. Also what the CSS sheet holds.
const COLORS = ["#ff5fa2", "#ffb04a", "#b79bff", "#3fb8c8"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_ribs: num(s.ribs, UPSTREAM.ribs),
  u_refraction: num(s.refraction, UPSTREAM.refraction),
  u_dispersion: num(s.dispersion, UPSTREAM.dispersion),
  u_drift: num(s.drift, UPSTREAM.drift),
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
