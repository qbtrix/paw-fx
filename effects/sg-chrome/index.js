// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-chrome: a port of shader-gallery/shaders' `chrome`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, chrome/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off chrome/meta.json at the
// same commit; all five agree with the shader's inline comments.
//
// The palette is NOT upstream's. chrome/meta.json names `"defaultPalette":
// "nocturne"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port ships four of its own and declares them as an `ours`
// deviation in meta.json, the same call every sg-* port on 4e8d4cb made.
//
// What each colour does, so a restyle is deliberate: c1 (--fx-c1) is the sky
// just above the horizon, one rim light and the faint body tint of the metal;
// c2 is the middle strip light and the other rim; c3 is the two big strip
// lights; c4 is the floor and the deep sky overhead. Keep c4 dark -- it is what
// the valleys reflect, and a light one erases the horizon that makes the sheet
// read as chrome rather than as grey satin.
//
// u_mouse stays at (0,0) in the shared runtime, so mouseInfluence is carried
// for parity and changes nothing on its own. The poster post chain we cannot
// supply; both are declared in meta.json `deviations`.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-chrome",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#8fb2e8", "#ff9a62", "#d6e6ff", "#141a2c"], description: "Four poles: sky and body tint, middle strip and warm rim, the two big strip lights, floor. Keep the fourth dark or the horizon goes. Falls back to --fx-c1..--fx-c4." },
    flow: { type: "number", default: 0.3, description: "How fast the metal rolls and folds. 0 freezes the surface." },
    relief: { type: "number", default: 1.1, description: "Height of the swells. Low is a near-flat sheet showing the horizon, high tilts the reflections hard into the strip lights." },
    ripple: { type: "number", default: 1, description: "Domain-warp folding. Low is broad rolling swells, high is tight ferrofluid ridges." },
    gloss: { type: "number", default: 0.85, description: "Sharpness of the reflected light bands and speculars. Low is satin, high is a hard mirror." },
    mouseInfluence: { type: "number", default: 0, description: "How strongly the pointer pushes a bulge into the metal. 0 ignores the mouse, and the shared runtime holds u_mouse at (0,0) regardless." },
  },
};

// upstream chrome/meta.json params
const UPSTREAM = { flow: 0.3, relief: 1.1, ripple: 1.0, gloss: 0.85, mouseInfluence: 0.0 };
// ours, not upstream's `nocturne`. See the header. Also what the CSS sheet holds.
const COLORS = ["#8fb2e8", "#ff9a62", "#d6e6ff", "#141a2c"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_flow: num(s.flow, UPSTREAM.flow),
  u_relief: num(s.relief, UPSTREAM.relief),
  u_ripple: num(s.ripple, UPSTREAM.ripple),
  u_gloss: num(s.gloss, UPSTREAM.gloss),
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
