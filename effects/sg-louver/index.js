// shader.gallery
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>
//
// sg-louver: a port of shader-gallery/shaders' `louver`, commit
// cd06eee100810a9682fb2fe49d7d43c81bee52c8, louver/shader.frag. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte the
// upstream file, and is fetched at mount. Nothing here can drift from upstream
// because nothing here restates it.
//
// The param defaults below are upstream's own, read off louver/meta.json at the
// same commit. One thing upstream supplies that we cannot: the palette table
// (it lives in @shader-gallery/runtime, a package we do not vendor). It is
// declared in meta.json `deviations`. This is one of the few shader.gallery
// effects whose meta.json declares no post chain at all, so the usual second
// deviation does not apply.
//
// The four colours are not poles and not a ramp here, they are four separate
// jobs: c0 is the lamp's hot core, c1 the wide wash and the ambient that keeps
// the top bands breathing, c2 the cool limb bleeding into the penumbra, c3 the
// hairline leaking along each slat. u_slatGap is in CSS px and the shader scales
// it itself, so nothing here compensates for the display.
import { mountGlsl, paletteFor } from "../_shared/glsl-mount.js";

export const meta = {
  name: "sg-louver",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    colors: { type: "string[]", default: ["#ffb45c", "#e07a5f", "#6bb6c9", "#ffe9c9"], description: "Lamp core, wide wash, cool penumbra limb, slat hairline. Falls back to --fx-c1..--fx-c4." },
    slatGap: { type: "number", default: 56, description: "Distance between successive shadow bars, in CSS pixels." },
    tiltRange: { type: "number", default: 0.55, description: "How far the slats swing over one breath, which is how wide the dark bars get." },
    penumbra: { type: "number", default: 0.9, description: "How fast the edge blur grows up the wall. 0 keeps every bar knife-sharp." },
    driftSpeed: { type: "number", default: 0.3, description: "Lateral lamp drift, which shears the diagonal. 0 pins the light." },
  },
};

// upstream louver/meta.json params
const UPSTREAM = { slatGap: 56, tiltRange: 0.55, penumbra: 0.9, driftSpeed: 0.3 };
// ours: warm lamplight on plaster, with a cool limb. See meta.json deviations.
const COLORS = ["#ffb45c", "#e07a5f", "#6bb6c9", "#ffe9c9"];

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_slatGap: num(s.slatGap, UPSTREAM.slatGap),
  u_tiltRange: num(s.tiltRange, UPSTREAM.tiltRange),
  u_penumbra: num(s.penumbra, UPSTREAM.penumbra),
  u_driftSpeed: num(s.driftSpeed, UPSTREAM.driftSpeed),
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
