// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-agate: a port of shader-gallery/shaders' `agate`, commit
// bb534385e7a36241942da872f7a93c8c785103dd, agate/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount.
//
// The param defaults below are upstream's own, read off agate/meta.json at the
// same commit. The palette is not: upstream names its `mercury` preset, and the
// table that resolves it lives in @shader-gallery/runtime, which paw-fx does
// not vendor. The four here are a cool silver set picked off the poster,
// declared `ours` in meta.json along with the post chain.
//
// The shader reads the poles by role: index 2 tints the milky chalcedony,
// index 0 the iron bands and the host rock, index 1 the saturated dyed band,
// index 3 the warm secondary and the deposition lines. The slice runs from
// near-white bands to near-black lines, so the copy is white on a dark wash.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-agate",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#8c939c", "#5f6670", "#eef2f6", "#3b3f45"], description: "Four poles. Index 2 tints the milky bands; 0 the iron bands and rind; 1 the dyed band; 3 the warm band and deposition lines. Falls back to --fx-c1..--fx-c4." },
    bands: { type: "number", default: 12, description: "Layers per unit of depth. Low is a few broad zones, high a dense fortification." },
    wander: { type: "number", default: 1, description: "Irregularity of the outline the bands follow. 0 is smooth concentric rings." },
    glow: { type: "number", default: 1, description: "Backlight through the thin bands. 0 is an opaque stone." },
    druzy: { type: "number", default: 0.3, description: "Radius of the crystalline quartz heart." },
    drift: { type: "number", default: 0.3, description: "Backlight drift, sheen sweep and the slow turn of the slice. 0 holds it still but for the glints." },
  },
};

// upstream agate/meta.json params
const UPSTREAM = { bands: 12.0, wander: 1.0, glow: 1.0, druzy: 0.3, drift: 0.3 };
// ours, not upstream's `mercury` preset. See the header. Also what the CSS resting state holds.
const COLORS = ["#8c939c", "#5f6670", "#eef2f6", "#3b3f45"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_bands: num(s.bands, UPSTREAM.bands),
  u_wander: num(s.wander, UPSTREAM.wander),
  u_glow: num(s.glow, UPSTREAM.glow),
  u_druzy: num(s.druzy, UPSTREAM.druzy),
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
