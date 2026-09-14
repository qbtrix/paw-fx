// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-suminagashi: a port of shader-gallery/shaders' `suminagashi`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, suminagashi/shader.frag. The GLSL
// is not copied into this file -- it sits beside it as shader.frag, byte for
// byte the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off suminagashi/meta.json
// at the same commit. Where that file and the shader's own inline comment
// disagree -- meta.json says `draw` 0.5, the comment beside `uniform float
// u_draw` says 1.0 -- meta.json wins, because meta.json `params` is the block
// upstream's runtime actually feeds. The palette is upstream's too:
// suminagashi/meta.json declares `"palette": null`, so the runtime feeds zeros
// and the shader falls through to the four colours it carries itself (line 171
// of shader.frag), which is what its poster is rendered with. The port passes
// those four explicitly rather than passing zeros through a paw-fx runtime that
// never produces them. The poster post chain (grain, vignette, saturation,
// contrast) we cannot supply, and it is declared in meta.json `deviations`.
//
// The second light-ground hero in this library, and the only one that is not a
// gradient: floating ink on warm washi. Three nests of thin concentric rings
// grow, flatten each other where they meet, and are drawn out by a stylus into
// feathered tongues. So the copy runs dark on a bright field and the scrim is a
// warm white wash, not the near-black one the dark ports use.
//
// One thing to know before restyling: the shader does not read the four poles
// by index. It picks the PALEST of them to tint the paper stock and the DEEPEST
// to warm the sumi black, by luma; index 0 is the second, coloured ink and
// index 1 tints it. Swapping two colours for a lighter pair therefore moves the
// paper, not just the ink.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-suminagashi",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#3b82f6", "#a855f7", "#22d3ee", "#f43f5e"], description: "Four poles. Index 0 is the coloured ink and index 1 tints it; the palest of the four tints the paper and the deepest warms the sumi black, by luma rather than by position. Falls back to --fx-c1..--fx-c4." },
    rings: { type: "number", default: 21, description: "Drops per nest. Low is a few bold rings with paper between, high packs each nest with hairlines." },
    size: { type: "number", default: 0.052, description: "Ring spacing, frame-relative. Low is a dense nest, high spreads a few wide rings across the sheet." },
    draw: { type: "number", default: 0.5, description: "How far the stylus pulls the rings into drawn-out tongues. 0 leaves the nests round." },
    fan: { type: "number", default: 1, description: "Amplitude of the fanned waves feathering every line. 0 is calm concentric rings." },
    drift: { type: "number", default: 0.3, description: "Speed of the water: the breath ripple, the drifting fan and the wandering drop points. 0 stills the surface." },
  },
};

// upstream suminagashi/meta.json params
const UPSTREAM = { rings: 21, size: 0.052, draw: 0.5, fan: 1.0, drift: 0.3 };
// upstream's own fallback palette, the one suminagashi/shader.frag uses when
// the runtime feeds no preset. See the header. Also what the CSS sheet holds.
const COLORS = ["#3b82f6", "#a855f7", "#22d3ee", "#f43f5e"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_rings: num(s.rings, UPSTREAM.rings),
  u_size: num(s.size, UPSTREAM.size),
  u_draw: num(s.draw, UPSTREAM.draw),
  u_fan: num(s.fan, UPSTREAM.fan),
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
