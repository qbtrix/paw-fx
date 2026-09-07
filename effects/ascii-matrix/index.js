// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-matrix: a port of metaory's ascii-lab matrix, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/matrix.js plus the
// ensureArray / makeRowBuffers / buildText helpers in src/util.js and the grid
// seam that replaces src/main.js.
//
// Glyph rain. Every column carries a head at row `drops[x]` drawn as a full
// block and a trail of `trail[x]` random glyphs behind it, measured with the
// wrap-around distance (head - y + h) % h so a trail crossing the bottom edge
// continues at the top. Each frame a column either resets to the top (0.985)
// or advances 1-2 rows and random-walks its trail length by one, clamped to
// 2..h. All of that is upstream's, untouched.
//
// ONE CHARACTER IS CHANGED. Upstream's alphabet opens with U+3000 IDEOGRAPHIC
// SPACE, not U+0020. In a <pre> set in a Latin monospace stack that codepoint
// is not in the font, so the browser falls back to a CJK face and renders it
// at double advance width -- every row that draws one shears out of alignment
// from that column on, and the grid stops being a grid. It is invisible in
// upstream's own screenshot because it is a space, and only the columns give
// it away. Replaced with U+0020, which is what it is for. See deviations.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns.
//
// The resting state is an authored frame of this same effect in the markup, so
// a blocked script, a pruned bundle or reduced motion leaves rain on the panel
// rather than an empty box. destroy() puts that frame back.
import { mountGrid, makeRowBuffers, buildText, ensureArray } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-matrix",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 80, description: "Characters across the panel. style.css scales the type to fit, so this is the rain's resolution, not its size." },
    rows: { type: "number", default: 34, description: "Character rows. Sets the panel's height, since the type is scaled to the width." },
    resetChance: { type: "number", default: 0.985, description: "A column restarts at the top when Math.random() clears this. Upstream's 0.985; lower it and the rain restarts more often." },
  },
};

const UPSTREAM = { cols: 80, rows: 34, resetChance: 0.985 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // matrix.js start(), verbatim below the first line but for the leading
    // space in `chars` (U+3000 upstream) and resetChance in place of 0.985.
    make(w, h, settings) {
      let drops = ensureArray(w, 0);
      let trail = ensureArray(w, 0);
      const chars = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=-'.split('');
      const rows = makeRowBuffers(w, h);
      let lines = new Array(h);

      return () => {
        for (let y = 0; y < h; y++) {
          const row = rows[y];
          for (let x = 0; x < w; x++) {
            const head = drops[x];
            const dt = (head - y + h) % h;
            row[x] = y === head
              ? '█'
              : (dt > 0 && dt <= trail[x])
                ? chars[Math.random() * chars.length | 0]
                : ' ';
          }
        }
        const out = buildText(rows, lines);
        for (let i = 0; i < w; i++) {
          if (Math.random() > settings.resetChance) { drops[i] = 0; trail[i] = 0; }
          else {
            const speed = 1 + (Math.random() * 2 | 0);
            drops[i] = (drops[i] + speed) % h;
            trail[i] = Math.min(h, Math.max(2, trail[i] + (Math.random() > 0.7 ? 1 : -1)));
          }
        }
        return out;
      };
    },
  });
}
