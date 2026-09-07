// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-smoke: a port of metaory's ascii-lab smoke, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/smoke.js plus the grid
// seam that replaces src/main.js.
//
// A density field rather than particles, which is why the plumes hold together
// instead of reading as a spray of dots. Three sources along the bottom edge
// inject density every frame; each cell then mixes 82% of itself with 6% of
// each neighbour, moves one row up, and slides sideways by a wind made of two
// slow sines plus a per-column ripple. Density is raised to the 0.65 power on
// the way to the ramp " .,:;~=+*#%@", which is what gives the plumes their
// soft shoulders instead of hard bands. All upstream's, untouched.
//
// One number is exposed rather than moved: the 0.98 the field is multiplied by
// each frame, as `decay`, with upstream's value as its default.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns.
//
// The resting state is an authored frame of this same effect in the markup, so
// a blocked script, a pruned bundle or reduced motion leaves plumes on the
// panel rather than an empty box. destroy() puts that frame back.
import { mountGrid } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-smoke",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 84, description: "Characters across the panel. style.css scales the type to fit, so this is the field's resolution, not its size." },
    rows: { type: "number", default: 32, description: "Character rows. Sets the panel's height, since the type is scaled to the width." },
    decay: { type: "number", default: 0.98, description: "How much density survives each frame. Upstream's field[i] = next[i] * 0.98; lower it and the plumes are shorter." },
  },
};

const UPSTREAM = { cols: 84, rows: 32, decay: 0.98 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // smoke.js start(), verbatim below the first line but for settings.decay
    // in place of the 0.98.
    make(w, h, settings) {
      const field = new Float32Array(w * h);
      const next = new Float32Array(w * h);
      const chars = ' .,:;~=+*#%@';
      let t = 0;

      const sources = [
        { x: w * 0.25, power: 1.3 },
        { x: w * 0.75, power: 1.1 },
        { x: w * 0.5, power: 1.6 }
      ];

      const at = (x, y) => y * w + x;

      return () => {
        t++;

        // Spawn smoke particles
        for (const src of sources) {
          for (let s = 0; s < src.power * 6 | 0; s++) {
            const x = Math.max(0, Math.min(w - 1, (src.x + (Math.random() - 0.5) * 5) | 0));
            const y = h - 1 - (Math.random() * 2 | 0);
            field[at(x, y)] = Math.min(1.2, field[at(x, y)] + src.power * (0.8 + Math.random() * 0.4));
          }
        }

        // Simulate fluid dynamics
        const wind = Math.sin(t * 0.01) * 2 + Math.cos(t * 0.013) * 0.7;

        for (let y = 1; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const v = field[at(x, y)];
            if (v <= 0.01) continue;

            // Diffusion
            const l = x > 0 ? field[at(x - 1, y)] : 0;
            const r = x < w - 1 ? field[at(x + 1, y)] : 0;
            const u = field[at(x, y - 1)];
            const diffused = v * 0.82 + (l + r + u) * 0.06;

            // Advection with wind
            const drift = (wind + Math.sin(x * 0.12 + t * 0.025) * 0.4) | 0;
            const nx = Math.max(0, Math.min(w - 1, x + drift));
            next[at(nx, y - 1)] = Math.max(next[at(nx, y - 1)], diffused);
          }
        }

        // Render
        let out = '';
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = at(x, y);
            field[i] = next[i] * settings.decay;
            next[i] = 0;

            const v = field[i];
            if (v <= 0.02) {
              out += ' ';
            } else {
              const ci = Math.min(chars.length - 1, Math.max(1, ((v ** 0.65) * (chars.length - 1)) | 0));
              out += chars[ci];
            }
          }
          if (y < h - 1) out += '\n';
        }

        return out;
      };
    },
  });
}
