// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-lightleak: a port of shader-gallery/shaders' `lightleak`, commit
// 4e8d4cb27bfdd662c4b8515eb83334ece40eea10, lightleak/shader.frag. The GLSL is
// not copied into this file -- it sits beside it as shader.frag, byte for byte
// the upstream file, and is fetched at mount. Nothing here can drift from
// upstream because nothing here restates it.
//
// The param defaults below are upstream's own, read off lightleak/meta.json at
// the same commit. All five agree with the shader's own inline comments, so
// there was nothing to arbitrate.
//
// The palette is NOT upstream's. lightleak/meta.json names `"defaultPalette":
// "daybreak"`, a preset that lives in @shader-gallery/runtime and is not in the
// pinned repo, so the port cannot resolve it -- the same situation sg-gloam,
// sg-bask, sg-nebula-drift and sg-obsidian are in, and it is declared the same
// way, as an `ours` deviation in meta.json. The shader's zero-branch (the
// blue/purple/cyan/rose set at the top of main) is unreachable from here:
// paletteFor never produces zeros.
//
// What the palette actually moves, and it is more than usual, so read this
// before restyling: the shader does not use the four colours positionally. It
// runs `warmCool()` over all four and picks the warmest and coolest by red
// minus blue, then builds everything from those two poles -- the leaks run
// hot-white at the lip, through the WARM pole, into the COOL pole as they
// feather; the anamorphic streaks are the COOL pole lifted 30% toward white;
// the emulsion base is near-black plus a whisper of cool. The two middle
// colours only reach the frame through `mid`, which is barely used. So the
// palette's real content is its warm/cool SPREAD, not its four hues: four
// colours that are all warm leave the streaks the same colour as the leaks and
// the film stops reading as anamorphic. Ours is amber -> pale gold -> teal ->
// indigo, which puts a wide spread between the poles on purpose.
//
// The poster post chain (grain, vignette, saturation, contrast, bloom) we
// cannot supply, and it is declared in meta.json `deviations`.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-lightleak",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#ff8a3d", "#ffcf9b", "#3fb8c4", "#4a63b5"], description: "Four poles. The shader picks the warmest and coolest of them by red minus blue: leaks run through the warm one, streaks are the cool one lifted toward white. The SPREAD between warm and cool is what matters, not the order. Falls back to --fx-c1..--fx-c4." },
    leak: { type: "number", default: 1, description: "Strength of the light bleeding in from the frame edges. 0 leaves only the streaks on dark film." },
    streak: { type: "number", default: 0.9, description: "Brightness of the anamorphic horizontal flares and their sources. 0 removes them and leaves a plain fogged frame." },
    warmth: { type: "number", default: 0.6, description: "How far the hottest part of each leak burns toward white. Low keeps it saturated colour instead of blowing out." },
    spread: { type: "number", default: 1, description: "How deep the leaks reach into the frame. High floods most of it with light, which is also what takes copy under the contrast floor." },
    speed: { type: "number", default: 0.3, description: "Pace of the sweep, breathing and flicker. 0 holds one frame of film." },
  },
};

// upstream lightleak/meta.json params
const UPSTREAM = { leak: 1.0, streak: 0.9, warmth: 0.6, spread: 1.0, speed: 0.3 };
// ours, not upstream's `daybreak`. See the header. Also what the CSS sheet holds.
const COLORS = ["#ff8a3d", "#ffcf9b", "#3fb8c4", "#4a63b5"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_leak: num(s.leak, UPSTREAM.leak),
  u_streak: num(s.streak, UPSTREAM.streak),
  u_warmth: num(s.warmth, UPSTREAM.warmth),
  u_spread: num(s.spread, UPSTREAM.spread),
  u_speed: num(s.speed, UPSTREAM.speed),
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
