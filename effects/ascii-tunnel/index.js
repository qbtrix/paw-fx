// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-tunnel: a port of metaory's ascii-lab tunnel, commit
// 639584cb2eb48e71aae36a547a6565e942d1ff1a, src/effects/tunnel.js plus the
// grid seam that replaces src/main.js.
//
// A perspective tunnel with no 3D at all. Every cell takes its distance and
// angle from the centre, inverts the distance into a depth, and reads two
// patterns off it: rings from sin(depth * 20 * 0.5 + t), which march towards
// the viewer because near cells have a much larger depth than far ones, and
// eight rotating stripes from sin(angle * 8 + t * 2). They mix 70/30 and fade
// out with radius. All of that is upstream's, untouched; dx is divided by the
// grid's own aspect there and here, which is what keeps the rings round rather
// than oval in a wide panel.
//
// Two numbers are exposed rather than moved: t += 0.1 as `speed` and the 8 in
// angle * 8 as `arms`, both with upstream's value as the default.
//
// The loop, the teardown and the grid live in ../_shared/ascii-grid.js: this
// file is upstream's start() body as make(), and upstream's step() as the
// closure it returns.
//
// The resting state is an authored frame of this same effect in the markup, so
// a blocked script, a pruned bundle or reduced motion leaves the tunnel on the
// panel rather than an empty box. destroy() puts that frame back.
import { mountGrid } from "../_shared/ascii-grid.js";

export const meta = {
  name: "ascii-tunnel",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    cols: { type: "number", default: 88, description: "Characters across the panel. style.css scales the type to fit, so this is the tunnel's resolution, not its size." },
    rows: { type: "number", default: 32, description: "Character rows. Sets the panel's height, since the type is scaled to the width." },
    speed: { type: "number", default: 0.1, description: "Time added per frame, which is how fast the rings come at you. Upstream's t += 0.1." },
    arms: { type: "number", default: 8, description: "Rotating stripes around the tunnel. Upstream's angle * 8." },
  },
};

const UPSTREAM = { cols: 88, rows: 32, speed: 0.1, arms: 8 };

export function mount(el, opts = {}) {
  return mountGrid(el, {
    defaults: UPSTREAM,
    opts,
    // tunnel.js start(), verbatim below the first line but for settings.speed
    // in place of 0.1 and settings.arms in place of the 8.
    make(w, h, settings) {
      const cx = w / 2, cy = h / 2;
      const aspect = w / Math.max(1, h);
      const chars = ' .:-=+*#%@';
      let t = 0;

      return () => {
        t += settings.speed;
        let out = '';

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dx = (x - cx) / aspect;
            const dy = y - cy;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            // Create tunnel depth
            const depth = dist > 0.01 ? 1 / dist : 100;
            const z = depth * 20 + t;

            // Circular patterns moving toward viewer
            const ring = Math.sin(z * 0.5) * 0.5 + 0.5;

            // Rotating stripes
            const stripes = Math.sin(angle * settings.arms + t * 2) * 0.5 + 0.5;

            // Combine patterns with depth falloff
            const intensity = ring * 0.7 + stripes * 0.3;
            const fade = Math.min(1, dist / Math.max(w, h) * 4);
            const final = intensity * (1 - fade);

            const idx = Math.max(0, Math.min(chars.length - 1, Math.floor(final * chars.length)));
            out += chars[idx];
          }
          if (y < h - 1) out += '\n';
        }

        return out;
      };
    },
  });
}
