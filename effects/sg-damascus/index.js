// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-damascus: a port of shader-gallery/shaders' `damascus`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, damascus/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off damascus/meta.json at
// the same commit; all five agree with the shader's inline comments. `layers`
// is an integer count, so it carries upstream's own 12..96 range and step of 1
// rather than a slider that offers 36.4 layers.
//
// The palette is NOT upstream's. damascus/meta.json names `"defaultPalette":
// "mercury"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port ships four of its own and declares them as an
// `ours` deviation in meta.json, the same call every sg-* port on 4e8d4cb made.
//
// What each colour does: the shader builds the steel as greys and only tints
// them. c1 (--fx-c1) is the temper fringe on the satin sheen, c3 tints the
// bright nickel layers, c4 bleeds into the dark carbon layers and the edge
// vignette. c2 only reaches the all-zero palette check in main() and nothing
// downstream reads it, so it changes nothing; ours is a neutral
// steel grey so the CSS rest has a mid-tone to work with.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-damascus",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#c08a52", "#7d8896", "#cdd6df", "#1b2230"], description: "Four poles: temper fringe on the sheen, unused by the shader, bright nickel tint, dark carbon tint. The shader only tints greys, so these move the steel's cast, not its value. Falls back to --fx-c1..--fx-c4." },
    layers: { type: "number", default: 36, min: 12, max: 96, step: 1, description: "How many steel layers the billet holds. Low is a few broad bands, high is a fine dense contour map." },
    ladder: { type: "number", default: 0.7, description: "Depth of the pressed cross-grooves. 0 is plain random grain, high bunches the bands into hard ladder rungs." },
    raindrop: { type: "number", default: 0.6, description: "Depth of the drilled dimples. 0 removes the concentric rings, high makes them deep bullseyes." },
    sheen: { type: "number", default: 1, description: "Strength of the sweeping satin highlight. 0 is a flat matte etch." },
    drift: { type: "number", default: 0.3, description: "Speed of the light sweep and the contour crawl. 0 freezes the slab." },
  },
};

// upstream damascus/meta.json params
const UPSTREAM = { layers: 36, ladder: 0.7, raindrop: 0.6, sheen: 1.0, drift: 0.3 };
// ours, not upstream's `mercury`. See the header. Also what the CSS sheet holds.
const COLORS = ["#c08a52", "#7d8896", "#cdd6df", "#1b2230"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_layers: num(s.layers, UPSTREAM.layers),
  u_ladder: num(s.ladder, UPSTREAM.ladder),
  u_raindrop: num(s.raindrop, UPSTREAM.raindrop),
  u_sheen: num(s.sheen, UPSTREAM.sheen),
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
