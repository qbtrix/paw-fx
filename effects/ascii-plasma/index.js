// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-plasma: a port of metaory's ascii-lab plasma, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/plasma.js plus the
// makeRowBuffers / buildText helpers in src/util.js and the grid seam that
// replaces src/main.js.
//
// The demoscene plasma, drawn in characters: three sine terms summed per cell
// -- one along x, one along y counter-running, one along x+y whose phase is
// itself a sine of time -- mapped onto the ten-step ramp " .:-=+*#%@". The
// three frequencies (0.14, 0.1, 0.08), the (v + 3) / 6 normalisation and the
// ramp are upstream's, untouched. The only number that moved is t += 0.1,
// which is exposed as `speed` with upstream's value as its default.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns. See that file for why the grid is declared rather than
// measured.
//
// The resting state is an authored frame of this same effect, sitting in the
// markup. With the script blocked, the bundle pruned or reduced motion on, the
// panel shows a real plasma field rather than an empty box -- and destroy()
// puts that frame back rather than freezing on whichever frame was in flight.
import { mountGrid, makeRowBuffers, buildText } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-plasma",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 88, description: "Characters across the panel. style.css scales the type to fit, so this is the picture's resolution, not its size." },
    rows: { type: "number", default: 30, description: "Character rows. Sets the panel's height, since the type is scaled to the width." },
    speed: { type: "number", default: 0.1, description: "Time added per frame. Upstream's t += 0.1." },
  },
};

const UPSTREAM = { cols: 88, rows: 30, speed: 0.1 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // plasma.js start(), verbatim below the first line.
    make(w, h, settings) {
      const chars = ' .:-=+*#%@';
      let t = 0;
      const rows = makeRowBuffers(w, h);
      let lines = new Array(h);

      return () => {
        t += settings.speed;
        for (let y = 0; y < h; y++) {
          const row = rows[y];
          for (let x = 0; x < w; x++) {
            const v = Math.sin(x * 0.14 + t) + Math.sin(y * 0.1 - t) + Math.sin((x + y) * 0.08 + Math.sin(t));
            const idx = Math.floor(((v + 3) / 6) * (chars.length - 1));
            row[x] = chars[idx];
          }
        }
        return buildText(rows, lines);
      };
    },
  });
}
