// SPDX-License-Identifier: MIT
// Copyright (c) 2026 shader-gallery
// Rainglass shader ported from shader-gallery/shaders
// https://github.com/shader-gallery/shaders
// Commit: 4e8d4cb27bfdd662c4b8515eb83334ece40eea10

import { mountGlsl, paletteFor } from '../_shared/glsl-mount.js';

export const meta = {
  name: 'sg-rainglass',
  version: '1.0.0',
  category: '3d-hero',
  tags: ['rain', 'glass', 'droplets', 'bokeh', 'night', 'window', 'shader'],
  summary: 'Rain on a window at night with bokeh lights and lens-like refraction drops.',
  needs: [],
  license: 'MIT',
  options: {
    u_speed: { type: 'number', default: 1.0, description: 'Speed of rain and bokeh motion' },
  },
  origin: {
    repo: 'shader-gallery/shaders',
    commit: '4e8d4cb27bfdd662c4b8515eb83334ece40eea10',
    path: 'rainglass/shader.frag',
  },
};

const DEFAULTS = { u_speed: 1.0 };

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

const uniformsFor = (s) => ({
  u_speed: num(s.u_speed, DEFAULTS.u_speed),
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
