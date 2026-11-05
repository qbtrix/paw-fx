// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-teeming: a port of shader-gallery/shaders' `teeming` (Smithy family),
// commit 6701714b9b1bfada43e6807f03685a2d0d28427d, teeming/shader.frag. The GLSL is not copied into this
// file -- it sits beside it as shader.frag, byte for byte the upstream file,
// and is fetched at mount.
//
// The param defaults below are upstream's own, read off teeming/meta.json at
// the same commit. The palette is not: upstream names its `foundry` preset,
// and the table that resolves it lives in @shader-gallery/runtime, which paw-fx
// does not vendor. The four here are a foundry set picked off the poster: crust red, runner orange, amber and a white-hot core, declared `ours` in
// meta.json along with the missing post chain.
//
// Palette roles, as the shader reads them: The metal's heat ramp runs 3, 0, 1, 2: index 3 is the dull red of cooling crust, 0 the orange of the runners, 1 the amber of the stream and 2 the white-hot core. The furnace mouth, the smoke and the bounce on the walls mix 0 and 3.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-teeming",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#d4621a", "#f2a531", "#fff1c4", "#8a2a0c"], description: "Four poles: heat ramp 3 crust red, 0 runner orange, 1 amber stream, 2 white-hot core. Falls back to --fx-c1..--fx-c4." },
    flow: { type: "number", default: 1, description: "How fast metal streams down the runners and the fill wave rolls out through the moulds; 0 holds the pour." },
    heat: { type: "number", default: 1, description: "Brightness of the molten metal and the bounce light it throws on the sand and walls." },
    sparks: { type: "number", default: 1, description: "How many sparks fan up from the pour." },
    smoke: { type: "number", default: 1, description: "Density of the hot haze glowing over the casting floor." },
  },
};

// upstream teeming/meta.json params
const UPSTREAM = { flow: 1, heat: 1, sparks: 1, smoke: 1 };
// ours, not upstream's `foundry` preset. See the header. Also what the CSS resting state holds.
const COLORS = ["#d4621a", "#f2a531", "#fff1c4", "#8a2a0c"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_flow: num(s.flow, UPSTREAM.flow),
  u_heat: num(s.heat, UPSTREAM.heat),
  u_sparks: num(s.sparks, UPSTREAM.sparks),
  u_smoke: num(s.smoke, UPSTREAM.smoke),
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
