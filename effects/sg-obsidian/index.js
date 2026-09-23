// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-obsidian: a port of shader-gallery/shaders' `obsidian`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, obsidian/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off obsidian/meta.json at
// the same commit; here meta.json and the shader's inline comments agree on all
// six, so there was nothing to arbitrate.
//
// The palette is NOT upstream's. obsidian/meta.json names `"defaultPalette":
// "nocturne"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same situation sg-gloam,
// sg-bask and sg-nebula-drift are in, and it is declared the same way, as an
// `ours` deviation in meta.json. (This is the opposite case to sg-suminagashi,
// whose meta declares `palette: null` and whose own fallback colours were
// therefore recoverable.) The shader's zero-branch is unreachable from here:
// paletteFor never produces zeros.
//
// What the palette actually moves is narrow, and worth knowing before
// restyling: the stone itself is always near-black. The four colours tint the
// reflected studio -- the soft-box, the two circling strip lights -- and the
// smoky flow banding frozen inside the glass. Push them and you change what the
// glass is standing in, not what the glass is made of. `tint` at 0 drops them
// out entirely and leaves pure silver-on-black.
//
// The poster post chain (grain, vignette, saturation, contrast) we cannot
// supply, and it is declared in meta.json `deviations`.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-obsidian",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#5d6a85", "#9aa8c6", "#2f3a55", "#513a69"], description: "Four poles tinting the reflected studio and the smoke inside the glass. The stone stays black in every theme; only what it reflects changes. Falls back to --fx-c1..--fx-c4." },
    scale: { type: "number", default: 0.6, description: "Size of the fracture shells against the frame. Low is a wide face of many small scars, high is a close-up of one or two big shells." },
    ripple: { type: "number", default: 1, description: "Height of the conchoidal ripple ribs and the fine radial hackle. 0 is smooth polished planes, high is a deeply rippled break." },
    sweep: { type: "number", default: 0.25, description: "How fast the key light and the reflected strip lights circle the stone. 0 holds them still." },
    gloss: { type: "number", default: 1, description: "Strength of the reflections, speculars and razor edge glints. Low is a dull weathered face, high is wet glass." },
    tint: { type: "number", default: 0.6, description: "How much palette colour enters the reflected studio and the smoke. 0 is pure silver-on-black." },
    mouseInfluence: { type: "number", default: 0, description: "How far the pointer pulls the soft-box across the glass. 0 ignores the mouse, and the shared runtime holds u_mouse at (0,0) regardless." },
  },
};

// upstream obsidian/meta.json params
const UPSTREAM = { scale: 0.6, ripple: 1.0, sweep: 0.25, gloss: 1.0, tint: 0.6, mouseInfluence: 0.0 };
// ours, not upstream's `nocturne`. See the header. Also what the CSS sheet holds.
const COLORS = ["#5d6a85", "#9aa8c6", "#2f3a55", "#513a69"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_scale: num(s.scale, UPSTREAM.scale),
  u_ripple: num(s.ripple, UPSTREAM.ripple),
  u_sweep: num(s.sweep, UPSTREAM.sweep),
  u_gloss: num(s.gloss, UPSTREAM.gloss),
  u_tint: num(s.tint, UPSTREAM.tint),
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
