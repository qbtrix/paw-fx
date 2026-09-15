// Solace
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Harshit Sharma
//
// solace-field: a port of HARSHITSHARMA18/shaders' field shader, commit
// 2604f67a53a850c7ffc10ff9eaf4d593e2c459d7,
// registry/default/field-shaders/solace-field-shader.tsx. The GLSL is not
// copied into this file -- it sits beside it as shader.frag, byte for byte
// upstream's FRAGMENT literal, and is fetched at mount. Nothing here can drift
// from upstream because nothing here restates it.
//
// SIX LOOKS, ONE SHADER. Upstream's catalogue lists these as six separate
// effects -- viscous cursor dye, reaction bloom, cellular contagion, repulsion
// lattice, magnetic pixels, chromatic refraction -- but they are one fragment
// shader branching on `u_variant`, so they are one port with a variant knob
// rather than six directories sharing a file. The gallery's live knobs make
// that a slider you can drag through all six.
//
// It is a POINTER effect, which the rest of the background shelf is not: the
// dye, the wakes and the lattice are all driven by where the cursor is and how
// fast it is moving, so on a page nobody touches it settles into a slow field.
// That is upstream's behaviour, not a deviation -- but it is worth knowing
// before picking it for a hero nobody will mouse over.
//
// The palettes are upstream's own five, read off FIELD_PALETTES at the same
// commit. What upstream has that we do not is its React settings object; the
// options below are the same numbers by another route.
import { mountGlsl2, rgb } from "../_shared/glsl2-mount.js";

export const meta = {
  name: "solace-field",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    variant: { type: "number", default: 0, min: 0, max: 5, step: 1, description: "Which of the six fields: 0 viscous dye, 1 reaction bloom, 2 cellular contagion, 3 repulsion lattice, 4 magnetic pixels, 5 chromatic refraction. One shader, six branches." },
    palette: { type: "string", default: "signal", description: "One of signal, acid, ember, glacier, mono. Upstream's own five. Ignored when `colors` is given." },
    colors: { type: "string[]", default: [], description: "Four hex stops in place of a named palette: background, primary, secondary, highlight. Empty uses `palette`." },
    scale: { type: "number", default: 1, description: "Field zoom. Low is a few broad cells, high is a fine weave." },
    intensity: { type: "number", default: 1, description: "How hard the field is pushed into the colours. 0 leaves the background bare." },
    speed: { type: "number", default: 0.7, description: "Rate the field evolves on its own, with no pointer. 0 holds a single still frame." },
    distortion: { type: "number", default: 0.7, description: "How far the field is bent out of shape before it is coloured." },
    trail: { type: "number", default: 0.45, description: "How much of the pointer's velocity the field keeps behind the cursor." },
  },
};

// upstream's component defaults
const UPSTREAM = { variant: 0, palette: "signal", scale: 1, intensity: 1, speed: 0.7, distortion: 0.7, trail: 0.45 };

// upstream FIELD_PALETTES, verbatim: background, primary, secondary, highlight
const PALETTES = {
  signal: ["#090b0a", "#1236ff", "#f0432f", "#d8ff2f"],
  acid: ["#0e0d17", "#7638fa", "#ff4c91", "#eaff38"],
  ember: ["#120b08", "#6f1d12", "#f26a1b", "#ffd166"],
  glacier: ["#071519", "#155e75", "#67e8f9", "#ecfeff"],
  mono: ["#0d0f0e", "#3f4541", "#9ba39d", "#f4f6f2"],
};

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** The four stops: an explicit `colors`, else a named palette, else signal. */
const stopsFor = (s) =>
  Array.isArray(s.colors) && s.colors.length === 4 ? s.colors : PALETTES[s.palette] ?? PALETTES.signal;

const uniformsFor = (s) => {
  const [bg, a, b, c] = stopsFor(s).map((hex) => rgb(hex));
  return {
    u_scale: num(s.scale, UPSTREAM.scale),
    u_intensity: num(s.intensity, UPSTREAM.intensity),
    u_speed: num(s.speed, UPSTREAM.speed),
    u_distortion: num(s.distortion, UPSTREAM.distortion),
    u_trail: num(s.trail, UPSTREAM.trail),
    u_background: bg,
    u_colorA: a,
    u_colorB: b,
    u_colorC: c,
  };
};

// Clamped, not trusted: u_variant indexes a chain of branches and anything
// outside 0..5 falls through all of them to an unwritten colour.
const variantOf = (s) => Math.min(5, Math.max(0, Math.round(num(s.variant, UPSTREAM.variant))));

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  const s = { ...UPSTREAM, ...opts };
  const handle = mountGlsl2(el, new URL("./shader.frag", import.meta.url), {
    uniforms: uniformsFor(s),
    ints: { u_variant: variantOf(s) },
    pointer: true,
  });
  return {
    update(next = {}) {
      Object.assign(s, next);
      handle.update({ uniforms: uniformsFor(s), ints: { u_variant: variantOf(s) } });
    },
    destroy: handle.destroy,
  };
}
