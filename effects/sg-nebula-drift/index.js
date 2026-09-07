// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-nebula-drift: a port of shader-gallery/shaders' `nebula-drift`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, nebula-drift/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off nebula-drift/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-nebula-drift",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#3b2a8f","#8b4cff","#2f7fd4","#ff6aa6"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    drift: { type: "number", default: 0.3, description: "Rate the gas drifts past; 0 holds the field still." },
    dust: { type: "number", default: 0.6, description: "Weight of the dark dust lanes silhouetted against the backlight." },
    filament: { type: "number", default: 0.7, description: "Brightness of the thin ionization filaments lacing the gas." },
  },
};

// upstream nebula-drift/meta.json params
const UPSTREAM = { drift: 0.3, dust: 0.6, filament: 0.7, scale: 1 };
// ours: a midnight set: indigo and violet gas, a cold blue mid, and one warm filament accent. See meta.json deviations.
const COLORS = ["#3b2a8f","#8b4cff","#2f7fd4","#ff6aa6"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_drift: num(s.drift, UPSTREAM.drift),
  u_dust: num(s.dust, UPSTREAM.dust),
  u_filament: num(s.filament, UPSTREAM.filament),
  u_scale: num(s.scale, UPSTREAM.scale),
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
