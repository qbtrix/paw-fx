// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-engraving: a port of shader-gallery/shaders' `engraving`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, engraving/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount.
//
// The param defaults below are upstream's own, read off engraving/meta.json at
// the same commit. The palette is not: upstream names its `nocturne` preset,
// and the table that resolves it lives in @shader-gallery/runtime, which
// paw-fx does not vendor. The four here are a blue-black nocturne picked off
// the poster, declared `ours` in meta.json along with the post chain.
//
// The shader reads the poles by role, not by order: index 2 tints the paper
// stock, index 1 tints the plate-tone film in the shadows, and indices 3 and 0
// mix the ink. A light hero: the copy is near-black on a white wash.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-engraving",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#2b3a67", "#4a5578", "#c9d2e3", "#141a33"], description: "Four poles. Index 2 tints the paper; index 1 tints the shadow film; 3 and 0 mix the ink. Falls back to --fx-c1..--fx-c4." },
    pitch: { type: "number", default: 9, description: "Line spacing in CSS pixels. Low is a fine dense plate, high a coarse open ruling." },
    wrap: { type: "number", default: 1, description: "How far the lines bend around the folds. 0 is a flat straight ruling." },
    relief: { type: "number", default: 1, description: "Depth of the drapery and its tonal range." },
    ink: { type: "number", default: 0.95, description: "Ink density. Low is a pale worn-plate pull, 1 a fresh dense print." },
    drift: { type: "number", default: 0.25, description: "How fast the drapery breathes and the light precesses. 0 holds the plate still." },
  },
};

// upstream engraving/meta.json params
const UPSTREAM = { pitch: 9.0, wrap: 1.0, relief: 1.0, ink: 0.95, drift: 0.25 };
// ours, not upstream's `nocturne` preset. See the header. Also what the CSS resting state holds.
const COLORS = ["#2b3a67", "#4a5578", "#c9d2e3", "#141a33"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_pitch: num(s.pitch, UPSTREAM.pitch),
  u_wrap: num(s.wrap, UPSTREAM.wrap),
  u_relief: num(s.relief, UPSTREAM.relief),
  u_ink: num(s.ink, UPSTREAM.ink),
  u_drift: num(s.drift, UPSTREAM.drift),
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
