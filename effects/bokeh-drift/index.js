// tsParticles presets
// MIT License
// Copyright (c) 2020 Matteo Bruni
// https://github.com/tsparticles/presets
//
// bokeh-drift: a port of the tsParticles "ambient" preset, commit
// ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7, presets/ambient/src/options.ts.
// Every number below is that file's: fpsLimit 120, 200 particles with density
// on, three per-shape tiers (a 3-5px stroked ring at opacity 0-0.8, a 5-7px
// fill at 0-0.6, a 10-20px fill at 0-0.4, each animating opacity at speed
// 0.1), move speed 0.1-0.5 with direction none and outModes bounce, and
// detectRetina true.
//
// WHAT MAKES IT DIFFERENT FROM THE OTHER FIELDS HERE. The size tiers are the
// effect: three populations at different scales, the smallest drawn as a
// hairline ring rather than a disc, which is what reads as lens bokeh instead
// of dust. It is also the only contained field in the library -- outModes
// bounce keeps every particle inside the section, where starfield and snow-fall
// both let theirs leave.
//
// The vendored slim bundle publishes its engine on globalThis instead of
// exporting it, which is the one globals exception the contract allows -- so
// the two reads happen inside mount(), never at import time. The torn flag,
// the generation counter and the per-mount id are taken from
// effects/starfield/index.js, where each fixes a bug its comments record.
import "../../vendor/tsparticles.slim.bundle.min.js";

export const meta = {
  name: "bokeh-drift",
  version: "1.0.0",
  category: "particles",
  needs: ["tsparticles"],
  license: "MIT",
  options: {
    count: { type: "number", default: 200, description: "Total particles across the three tiers. Upstream's particles.number.value." },
    ring: { type: "string", default: "#0cdbf3", description: "Stroke of the small hairline tier. Upstream's first circle tier stroke colour." },
    mid: { type: "string", default: "#6fd2f3", description: "Fill of the mid tier. Upstream's second circle tier fill colour." },
    soft: { type: "string", default: "#93e9f3", description: "Fill of the large soft tier. Upstream's third circle tier fill colour." },
  },
};

// presets/ambient/src/options.ts, verbatim apart from the seams meta.json's
// deviations name: no `background` (the section's CSS owns it) and the two
// enum members written as the strings they are.
const optionsFor = ({ count, ring, mid, soft }) => ({
  fpsLimit: 120,
  particles: {
    number: {
      value: count,
      density: {
        enable: true,
      },
    },
    shape: {
      type: "circle",
      options: {
        circle: [
          {
            particles: {
              paint: {
                fill: {
                  enable: false,
                },
                stroke: {
                  width: 1,
                  color: {
                    value: ring,
                  },
                },
              },
              opacity: {
                value: { min: 0, max: 0.8 },
                animation: {
                  enable: true,
                  speed: 0.1,
                },
              },
              size: {
                value: { min: 3, max: 5 },
              },
            },
          },
          {
            particles: {
              paint: {
                fill: {
                  color: {
                    value: mid,
                  },
                  enable: true,
                },
              },
              opacity: {
                value: { min: 0, max: 0.6 },
                animation: {
                  enable: true,
                  speed: 0.1,
                },
              },
              size: {
                value: { min: 5, max: 7 },
              },
            },
          },
          {
            particles: {
              paint: {
                fill: {
                  color: {
                    value: soft,
                  },
                  enable: true,
                },
              },
              opacity: {
                value: { min: 0, max: 0.4 },
                animation: {
                  enable: true,
                  speed: 0.1,
                },
              },
              size: {
                value: { min: 10, max: 20 },
              },
            },
          },
        ],
      },
    },
    move: {
      enable: true,
      speed: {
        min: 0.1,
        max: 0.5,
      },
      direction: "none", // MoveDirection.none
      outModes: "bounce", // OutMode.bounce
    },
  },
  detectRetina: true,
});

const UPSTREAM = { count: 200, ring: "#0cdbf3", mid: "#6fd2f3", soft: "#93e9f3" };

// One id per mounted section. The engine derives a container id from
// `options.id ?? element.id ?? a random one`, and a host div with no id
// attribute yields "" -- which is not nullish, so every section on the page
// asked for the SAME container and each new mount replaced the last.
let seq = 0;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No element, no DOM, or a reader who asked for stillness: the CSS bokeh
  // field in style.css is already the finished section.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;
  const host = el.querySelector("[data-fx-canvas]") || el;

  const settings = { ...UPSTREAM, ...opts };
  let container = null;
  let torn = false;
  let generation = 0;

  const load = () => {
    const gen = ++generation;
    const engine = globalThis.tsParticles;
    const loadSlim = globalThis.loadSlim;
    if (!engine || !loadSlim) return; // bundle pruned or blocked
    (async () => {
      try {
        await loadSlim(engine);
        if (torn || gen !== generation) return;
        const c = await engine.load({ id: `fx-bokeh-drift-${++seq}`, element: host, options: optionsFor(settings) });
        if (torn || gen !== generation) { c?.destroy(); return; }
        container = c;
        el.setAttribute("data-fx-live", "");
      } catch {
        // A refused canvas leaves the CSS resting state exactly as it was.
      }
    })();
  };
  load();

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      container?.destroy();
      container = null;
      el.removeAttribute("data-fx-live");
      load();
    },
    destroy() {
      torn = true;
      container?.destroy();
      container = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
