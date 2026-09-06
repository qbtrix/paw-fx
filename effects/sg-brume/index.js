// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-brume: a port of shader-gallery/shaders' `brume`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, brume/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off brume/meta.json at
// the same commit. Two things upstream supplies that we cannot: the palette
// table (it lives in @shader-gallery/runtime, which paw-fx does not vendor, so
// ours are declared in meta.json `deviations`) and the poster post chain.
// Both are declared there.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-brume",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#9db6e8","#c3cdf0","#7f93c8","#25324f"], description: "Four palette colours; falls back to --fx-c1..--fx-c4." },
    spacing: { type: "number", default: 200, description: "Spacing between column centres, in CSS pixels." },
    flowSpeed: { type: "number", default: 0.4, description: "Speed of the streaming fog." },
    glow: { type: "number", default: 0.8, description: "Brightness of the fog behind the columns." },
  },
};

// upstream brume/meta.json params
const UPSTREAM = { spacing: 200, flowSpeed: 0.4, glow: 0.8 };
// ours: a tight cold moon set, narrow in hue on purpose (see meta.json). See meta.json deviations.
const COLORS = ["#9db6e8","#c3cdf0","#7f93c8","#25324f"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_spacing: num(s.spacing, UPSTREAM.spacing),
  u_flowSpeed: num(s.flowSpeed, UPSTREAM.flowSpeed),
  u_glow: num(s.glow, UPSTREAM.glow),
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
