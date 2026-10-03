// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-rainglass: a port of shader-gallery/shaders' `rainglass`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, rainglass/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off rainglass/meta.json at
// the same commit. Where that file and the shader's own inline comment disagree
// -- meta.json says `speed` 0.3, the comment beside `uniform float u_speed`
// says 0.5 -- meta.json wins, because meta.json `params` is the block
// upstream's runtime actually feeds. That is the same arbitration
// sg-suminagashi made on `draw`, and it is declared the same way.
//
// The palette is NOT upstream's. rainglass/meta.json names `"defaultPalette":
// "peacock"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same situation sg-gloam,
// sg-bask and sg-nebula-drift are in, declared the same way as an `ours`
// deviation in meta.json. The shader's zero-branch is unreachable from here:
// paletteFor never produces zeros.
//
// The four colours are the lights on the street behind the pane, and that is
// the whole composition: everything the effect shows is either one of those
// lights defocused into a bokeh disc, or one of them bent back into focus
// through a drop. So a palette of four near-identical colours gives a flat
// night; the shipped set is deliberately spread -- teal, sodium amber, deep
// blue, tail-light red -- because separation between the poles is what makes
// the bokeh field read as a street rather than as a wash.
//
// One thing to watch when restyling: this is the first effect in the library
// whose bright pixels move UNDER the copy rather than around it. A bokeh disc
// is small, hard-edged and can land anywhere, so the scrim here is doing more
// work than it does on the gradient heroes. The measured worst case is in the
// PR that landed this; re-measure before lowering --fx-scrim.
//
// The poster post chain (grain, bloom, vignette, saturation, contrast) we
// cannot supply, and it is declared in meta.json `deviations`. Bloom matters
// more here than on the other ports: upstream's poster blooms the lights at
// radius 3.5, and ours does not, so our discs have harder edges than the
// poster's.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-rainglass",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#1d7a94", "#c98a3c", "#0c2a45", "#a3455a"], description: "Four poles. These are the street lights behind the pane: every bokeh disc and every drop-lens is one of them, so spread them apart to get a street and cluster them to get a wash. Falls back to --fx-c1..--fx-c4." },
    rain: { type: "number", default: 1, description: "How much water is on the glass. Low is a few stray drops, high is a pane streaming with runners." },
    speed: { type: "number", default: 0.3, description: "Fall speed of the runners and the swell of the beads. 0 freezes the rain." },
    smear: { type: "number", default: 0.6, description: "How far each drop draws its tail out behind it as it runs. 0 keeps every drop round, high turns a darting drop into a long streak." },
    fog: { type: "number", default: 0.7, description: "Condensation on the pane. 0 is clear glass with the lights in focus, 1 is heavily fogged and only the wiped streaks see through." },
    refract: { type: "number", default: 1, description: "How strongly each drop bends the field behind it. 0 makes the drops flat, high turns each into a strong inverted lens." },
    lights: { type: "number", default: 1, description: "Density of the lights behind the glass. Low is a sparse dark street, high is a dense city." },
  },
};

// upstream rainglass/meta.json params. `speed` is 0.3 there and 0.5 in the
// shader's own comment; meta.json is the block upstream's runtime feeds.
const UPSTREAM = { rain: 1.0, speed: 0.3, smear: 0.6, fog: 0.7, refract: 1.0, lights: 1.0 };
// ours, not upstream's `peacock`. See the header. Also what the CSS sheet holds.
const COLORS = ["#1d7a94", "#c98a3c", "#0c2a45", "#a3455a"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_rain: num(s.rain, UPSTREAM.rain),
  u_speed: num(s.speed, UPSTREAM.speed),
  u_smear: num(s.smear, UPSTREAM.smear),
  u_fog: num(s.fog, UPSTREAM.fog),
  u_refract: num(s.refract, UPSTREAM.refract),
  u_lights: num(s.lights, UPSTREAM.lights),
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
