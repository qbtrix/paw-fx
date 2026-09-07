// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-life: a port of metaory's ascii-lab life, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/life.js plus the grid
// seam that replaces src/main.js.
//
// Conway's Game of Life, stepped once a frame and drawn in full blocks. The
// rule is the classic one: a live cell with two or three live neighbours
// survives, a dead cell with exactly three is born, everything else is empty.
// The grid wraps on both axes -- (y + yy + h) % h -- so a glider leaving the
// right edge comes back on the left instead of dying at a wall, which is what
// keeps the field alive indefinitely rather than settling into a corner. The
// seed is random at about 18% density. All upstream's, untouched.
//
// One number is exposed rather than moved: the 0.82 the seed is thresholded
// against, as `seedThreshold`, with upstream's value as its default.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns.
//
// The resting state is an authored frame of this same effect in the markup --
// a settled generation with its gliders, blocks and blinkers in it, not the
// random seed, which reads as static rather than as a paused automaton. So a
// blocked script, a pruned bundle or reduced motion leaves a real board on the
// panel. destroy() puts that frame back.
import { mountGrid } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-life",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 96, description: "Cells across the panel. style.css scales the type to fit, so this is the board's resolution, not its size." },
    rows: { type: "number", default: 34, description: "Cell rows. Sets the panel's height, since the type is scaled to the width." },
    seedThreshold: { type: "number", default: 0.82, description: "A cell starts alive when Math.random() clears this, so the default seeds about 18%. Upstream's 0.82." },
  },
};

const UPSTREAM = { cols: 96, rows: 34, seedThreshold: 0.82 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // life.js start(), verbatim below the first line but for
    // settings.seedThreshold in place of the 0.82.
    make(w, h, settings) {
      let grid = Array.from({ length: h }, () => Array.from({ length: w }, () => Math.random() > settings.seedThreshold ? 1 : 0));

      const count = (y, x) => {
        let c = 0;
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -1; xx <= 1; xx++) {
            if (yy === 0 && xx === 0) continue;
            const yi = (y + yy + h) % h;
            const xi = (x + xx + w) % w;
            c += grid[yi][xi];
          }
        }
        return c;
      };

      return () => {
        const next = Array.from({ length: h }, () => Array(w).fill(0));
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const n = count(y, x);
            const alive = grid[y][x] === 1;
            next[y][x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          }
        }
        grid = next;
        return grid.map(r => r.map(v => v ? '█' : ' ').join('')).join('\n');
      };
    },
  });
}
