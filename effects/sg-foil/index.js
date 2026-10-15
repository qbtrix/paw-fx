// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-foil: a port of shader-gallery/shaders' `foil`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, foil/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off foil/meta.json at the
// same commit; all six agree with the shader's inline comments.
//
// The palette is NOT upstream's. foil/meta.json names `"defaultPalette":
// "foundry"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port ships four of its own and declares them as an `ours`
// deviation in meta.json, the same call every sg-* port on 4e8d4cb made.
//
// What each colour does: the shader mixes the foil tint as 38% c1 + 62% c3
// (`mix(c0, c2, 0.62)`), then normalises its luminance, so c1 and c3 set the
// metal's CAST and the shader pins its brightness. c4 is the card stock, pulled
// most of the way to grey and pinned dark the same way, so it reads as coloured
// board, not a colour field. c2 only reaches the all-zero palette check in
// main() and nothing downstream reads it; ours is a neutral grey the CSS rest
// uses for its wall-shadow mid-tone.
//
// The emblem is pressed at 22% x / 50% y of the frame and the right two thirds
// are left quiet for a wordmark, so the copy sits in those two thirds,
// left-aligned, not centred. u_mouse stays at (0,0) in the shared runtime, so
// mouseInfluence is carried for parity and changes nothing on its own.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-foil",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#d9a25a", "#8a8f99", "#efe0c2", "#1b1714"], description: "Four poles: 38% of the foil tint, unused by the shader, 62% of the foil tint, the card stock. The shader pins the foil bright and the card dark, so these set cast, not value. Falls back to --fx-c1..--fx-c4." },
    lightSweep: { type: "number", default: 0.5, min: 0, max: 2, step: 0.05, description: "How fast the lamp swings and the light sweep crosses the sheet. 0 freezes it and the foil holds one flash." },
    depth: { type: "number", default: 5, min: 0, max: 12, step: 0.5, description: "Depth of the stamp in CSS pixels. 0 is flat printed foil, high is a deep die impression with strong rim and wall shadow." },
    markSize: { type: "number", default: 0.27, min: 0.12, max: 0.45, step: 0.01, description: "Radius of the emblem as a fraction of frame height, from a small seal to a mark that dominates the left half." },
    shine: { type: "number", default: 1, min: 0, max: 2, step: 0.05, description: "Strength of the specular streak on the foil. Low is brushed satin foil, high is mirror-bright." },
    grain: { type: "number", default: 0.6, min: 0, max: 1, step: 0.01, description: "Visibility of the fibre texture, tooth and laid lines in the card stock. 0 is smooth coated board." },
    mouseInfluence: { type: "number", default: 0, min: 0, max: 1, step: 0.01, description: "How strongly the pointer adds a second highlight on the foil. 0 ignores the mouse, and the shared runtime holds u_mouse at (0,0) regardless." },
  },
};

// upstream foil/meta.json params
const UPSTREAM = { lightSweep: 0.5, depth: 5.0, markSize: 0.27, shine: 1.0, grain: 0.6, mouseInfluence: 0.0 };
// ours, not upstream's `foundry`. See the header. Also what the CSS sheet holds.
const COLORS = ["#d9a25a", "#8a8f99", "#efe0c2", "#1b1714"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_lightSweep: num(s.lightSweep, UPSTREAM.lightSweep),
  u_depth: num(s.depth, UPSTREAM.depth),
  u_markSize: num(s.markSize, UPSTREAM.markSize),
  u_shine: num(s.shine, UPSTREAM.shine),
  u_grain: num(s.grain, UPSTREAM.grain),
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
