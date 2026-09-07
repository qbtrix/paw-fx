// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-torus: a port of metaory's ascii-lab torus, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/torus.js plus the grid
// seam that replaces src/main.js.
//
// The spinning donut. The torus is sampled over two angles -- theta round the
// tube in steps of 0.05, phi round the ring in steps of 0.015 -- rotated by a
// about one axis and b about another, and projected with 1 / (z + 5). A z
// buffer keeps the nearest sample per cell, and the shade comes from the
// surface normal's dot with the light, mapped onto ".,-~:;=!*#$@". That is the
// whole of it: no geometry, no camera, no 3D library. All upstream's,
// untouched, including the separate x and y scale factors that account for a
// character cell being about twice as tall as it is wide.
//
// Two numbers are exposed rather than moved: a += 0.07 as `spinA` and
// b += 0.03 as `spinB`, both with upstream's value as the default.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns. The declared grid matters more here than anywhere else
// in the family: this effect scales x by w and y by h independently, with no
// aspect term, so a grid measured from the viewport would stretch the donut
// into an ellipse at some widths and not others.
//
// The resting state is an authored frame of this same effect in the markup, so
// a blocked script, a pruned bundle or reduced motion leaves a donut on the
// panel rather than an empty box. destroy() puts that frame back.
import { mountGrid } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-torus",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 72, description: "Characters across the panel. style.css scales the type to fit, so this is the donut's resolution, not its size." },
    rows: { type: "number", default: 30, description: "Character rows. Sets the panel's height, and with cols it fixes the donut's proportions." },
    spinA: { type: "number", default: 0.07, description: "Radians added to the first rotation each frame. Upstream's a += 0.07." },
    spinB: { type: "number", default: 0.03, description: "Radians added to the second rotation each frame. Upstream's b += 0.03." },
  },
};

const UPSTREAM = { cols: 72, rows: 30, spinA: 0.07, spinB: 0.03 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // torus.js start(), verbatim below the first line but for settings.spinA /
    // settings.spinB in place of the 0.07 and 0.03.
    make(w, h, settings) {
      let a = 0, b = 0;

      return () => {
        a += settings.spinA;
        b += settings.spinB;
        const out = Array.from({ length: h }, () => Array(w).fill(' '));
        const z = Array(w * h).fill(0);
        const chars = ".,-~:;=!*#$@";

        for (let theta = 0; theta < Math.PI * 2; theta += 0.05) {
          for (let phi = 0; phi < Math.PI * 2; phi += 0.015) {
            const ct = Math.cos(theta), st = Math.sin(theta);
            const cp = Math.cos(phi), sp = Math.sin(phi);
            const h1 = ct + 2;
            const D = 1 / (sp * h1 * Math.sin(a) + st * Math.cos(a) + 5);
            const t = sp * h1 * Math.cos(a) - st * Math.sin(a);
            const x = Math.floor((w / 2) + 2 * D * (cp * h1 * Math.cos(b) - t * Math.sin(b)) * ((w / 14) * 4));
            const y = Math.floor((h / 2) + 1 * D * (cp * h1 * Math.sin(b) + t * Math.cos(b)) * ((h / 9) * 4));
            const o = Math.floor((cp * h1 * Math.sin(a) + st * Math.cos(a)) * 8);
            const idx = (y | 0) * w + (x | 0);
            if (x >= 0 && x < w && y >= 0 && y < h && D > z[idx]) {
              z[idx] = D;
              out[y][x] = chars[Math.max(0, Math.min(chars.length - 1, o + 5))];
            }
          }
        }
        return out.map(r => r.join('')).join('\n');
      };
    },
  });
}
