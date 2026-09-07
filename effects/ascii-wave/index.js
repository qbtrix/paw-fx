// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-wave: a port of metaory's ascii-lab wave, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/wave.js plus the
// makeRowBuffers / buildText helpers in src/util.js and the grid seam that
// replaces src/main.js.
//
// The one effect in this family that is not a density ramp. Its alphabet is a
// run of glyphs with direction in them -- ~ ` - . _ / \ | = + * o O 0 -- and
// the picture comes from indexing into it twice rather than from measuring
// brightness. Each row gets an amplitude and a phase from its own y, which
// shift how far along the alphabet the row starts; a second sine across x then
// scales that index down towards the tildes. The result reads as flowing
// ribbons or a contour map rather than as shading, which is why it sits beside
// the ramp effects instead of duplicating one. All upstream's, untouched.
//
// One number is exposed rather than moved: t += 0.25 as `speed`, with
// upstream's value as its default.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns.
//
// The resting state is an authored frame of this same effect in the markup, so
// a blocked script, a pruned bundle or reduced motion leaves the ribbons on
// the panel rather than an empty box. destroy() puts that frame back.
import { mountGrid, makeRowBuffers, buildText } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-wave",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 88, description: "Characters across the panel. style.css scales the type to fit, so this is the picture's resolution, not its size." },
    rows: { type: "number", default: 28, description: "Character rows. Sets the panel's height, since the type is scaled to the width." },
    speed: { type: "number", default: 0.25, description: "Time added per frame. Upstream's t += 0.25." },
  },
};

const UPSTREAM = { cols: 88, rows: 28, speed: 0.25 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // wave.js start(), verbatim below the first line but for settings.speed in
    // place of the 0.25.
    make(w, h, settings) {
      const chars = '~`-._/\\|=+*oO0';
      let t = 0;
      const rows = makeRowBuffers(w, h);
      let lines = new Array(h);

      return () => {
        t += settings.speed;
        for (let y = 0; y < h; y++) {
          const amp = 2 + Math.sin(y * 0.22 + t * 0.7) * 3;
          const phase = Math.sin(t * 1.2 + y * 0.8);
          const shift = ((phase + 1) * amp) | 0;
          const row = rows[y];
          for (let x = 0; x < w; x++) {
            const k = (x + shift) % chars.length;
            const p = (Math.sin((x + y * 0.3 + t) * 0.1) + 1) * 0.5;
            const idx = (k * p) | 0;
            row[x] = chars[idx];
          }
        }
        return buildText(rows, lines);
      };
    },
  });
}
