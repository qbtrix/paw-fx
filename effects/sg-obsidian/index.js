// SPDX-License-Identifier: MIT
// Copyright (c) 2026 shader-gallery
// Obsidian shader ported from shader-gallery/shaders
// https://github.com/shader-gallery/shaders
// Commit: 4e8d4cb27bfdd662c4b8515eb83334ece40eea10

import { mountGlsl, paletteFor } from '../_shared/glsl-mount.js';

export const meta = {
  name: 'sg-obsidian',
  version: '1.0.0',
  category: '3d-hero',
  tags: ['obsidian', 'glass', 'fracture', 'dark', 'shader'],
  summary: 'A freshly broken face of black volcanic glass with conchoidal fracture scars.',
  needs: [],
  license: 'MIT',
  options: {
    u_scale: { type: 'number', default: 0.8, description: 'Scale of the fracture pattern' },
  },
  origin: {
    repo: 'shader-gallery/shaders',
    commit: '4e8d4cb27bfdd662c4b8515eb83334ece40eea10',
    path: 'obsidian/shader.frag',
  },
};

const DEFAULTS = { u_scale: 0.8 };

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_scale: num(s.u_scale, DEFAULTS.u_scale),
});

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  const s = { ...DEFAULTS, ...opts };
  const handle = mountGlsl(el, new URL('./shader.frag', import.meta.url), {
    uniforms: uniformsFor(s),
  });
  return {
    update(next = {}) {
      Object.assign(s, next);
      handle.update({ uniforms: uniformsFor(s) });
    },
    destroy: handle.destroy,
  };
}
