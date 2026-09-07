// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-glitch: a port of metaory's ascii-lab glitch, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/glitch.js plus the
// grid seam that replaces src/main.js.
//
// Corruption rather than a field. A buffer of rows is kept between frames, and
// each frame every row either gets rewritten with fresh random glyphs (0.6),
// or slid sideways by up to four columns (0.85), or left as it was; then, on
// the way out, a row is occasionally drawn from the far end of the buffer
// instead of its own position (0.96), which is the horizontal tear. The
// alphabet mixes the four block shades with bracket and punctuation noise, so
// the field has both weight and grain. All upstream's, untouched.
//
// One number is exposed rather than moved: the 0.6 the row rewrite is
// thresholded against, as `scrambleChance`, with upstream's value as default.
//
// UPSTREAM'S SLIDE LEAVES RAGGED ROWS AND THAT IS KEPT. `slice(max(0, off))`
// with a positive offset drops characters off the front and pads nothing, so
// the row comes out short; with a negative one it pads and comes out long.
// Neither is corrected, because the ragged edge IS what makes a slid row read
// as a torn scanline instead of a tidy translation. What the port adds is
// `overflow: hidden` on the <pre>, so a long row clips rather than widening
// the panel. See deviations.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns.
//
// The resting state is an authored frame of this same effect in the markup, so
// a blocked script, a pruned bundle or reduced motion leaves a corrupted field
// on the panel rather than an empty box. destroy() puts that frame back.
import { mountGrid } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-glitch",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 76, description: "Characters across the panel. style.css scales the type to fit, so this is the field's resolution, not its size." },
    rows: { type: "number", default: 26, description: "Character rows. Sets the panel's height, since the type is scaled to the width." },
    scrambleChance: { type: "number", default: 0.6, description: "A row is rewritten with fresh random glyphs when Math.random() clears this. Upstream's 0.6; raise it and the field settles." },
  },
};

const UPSTREAM = { cols: 76, rows: 26, scrambleChance: 0.6 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // glitch.js start(), verbatim below the first line but for
    // settings.scrambleChance in place of the 0.6.
    make(w, h, settings) {
      const chars = '█▓▒░<>[]{}()/\\|~^*=-+_:;.,';
      let buf = Array.from({ length: h }, () => chars[Math.random() * chars.length | 0].repeat(w));

      return () => {
        for (let y = 0; y < h; y++) {
          if (Math.random() > settings.scrambleChance) buf[y] = Array.from({ length: w }, () => chars[Math.random() * chars.length | 0]).join('');
          else if (Math.random() > 0.85) {
            const off = (Math.random() * 8 | 0) - 4;
            buf[y] = buf[y].slice(Math.max(0, off)) + ' '.repeat(Math.max(0, -off));
          }
        }
        let out = '';
        for (let y = 0; y < h; y++) {
          if (Math.random() > 0.96) out += buf[h - 1 - y];
          else out += buf[y];
          if (y < h - 1) out += '\n';
        }
        return out;
      };
    },
  });
}
