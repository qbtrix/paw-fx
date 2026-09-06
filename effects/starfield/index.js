// tsParticles presets
// MIT License
// Copyright (c) 2020 Matteo Bruni
// https://github.com/tsparticles/presets
//
// starfield: a port of the tsParticles "stars" preset, commit
// ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7, presets/stars/src/options.ts.
// Every number below is that file's: 100 particles, speed 0.1, no direction,
// out mode "out", random and not straight, white fill, opacity animating at
// speed 1 unsynced across 0-1, size 1-3.
//
// The vendored slim bundle publishes its engine on globalThis instead of
// exporting it, which is the one globals exception the contract allows -- so
// the two reads happen inside mount(), never at import time.
//
// mount() returns synchronously while the engine loads in the background,
// because the contract's handle is not a promise. The `torn` flag is what
// makes destroy() safe during that window: a destroy before load resolves
// still tears the container down on the other side of the await, rather than
// leaving an orphan canvas painting forever.
import "../../vendor/tsparticles.slim.bundle.min.js";

export const meta = {
  name: "starfield",
  version: "1.0.0",
  category: "particles",
  needs: ["tsparticles"],
  license: "MIT",
  options: {
    count: { type: "number", default: 100, description: "Particle count. Upstream's particles.number.value." },
    color: { type: "string", default: "#ffffff", description: "Star fill colour. Upstream's particles.paint.fill.color.value." },
    speed: { type: "number", default: 0.1, description: "Drift speed. Upstream's particles.move.speed." },
  },
};

// presets/stars/src/options.ts, verbatim apart from the three seams the
// deviations in meta.json name: no `background` (the section's CSS owns it),
// and the two enum members written as the strings they are, since the preset
// imports them from @tsparticles/engine and a vendored bundle exports nothing.
const optionsFor = ({ count, color, speed }) => ({
  particles: {
    number: {
      value: count,
    },
    move: {
      direction: "none", // MoveDirection.none
      enable: true,
      outModes: {
        default: "out", // OutMode.out
      },
      random: true,
      speed: speed,
      straight: false,
    },
    paint: {
      fill: {
        color: {
          value: color,
        },
      },
    },
    opacity: {
      animation: {
        enable: true,
        speed: 1,
        sync: false,
      },
      value: { min: 0, max: 1 },
    },
    size: {
      value: { min: 1, max: 3 },
    },
  },
});

const UPSTREAM = { count: 100, color: "#ffffff", speed: 0.1 };

// One id per mounted section. The engine derives a container id from
// `options.id ?? element.id ?? a random one`, and a host div with no id
// attribute yields "" -- which is not nullish, so every section on the page
// asked for the SAME container and each new mount replaced the last. Measured:
// four particle sections on one page left exactly one live canvas.
let seq = 0;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No element, no DOM, or a reader who asked for stillness: the CSS star
  // field in style.css is already the finished section, so leaving it alone is
  // the correct outcome, not a degraded one.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;
  const host = el.querySelector("[data-fx-canvas]") || el;

  const settings = { ...UPSTREAM, ...opts };
  let container = null;
  let torn = false;
  // Which load is the current one. An update() called before the first load
  // resolves would otherwise leave two containers running: `container` is
  // still null, so nothing gets destroyed, and both awaits come back.
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
        const c = await engine.load({ id: `fx-starfield-${++seq}`, element: host, options: optionsFor(settings) });
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
    // Reloading beats patching the live options: tsParticles' own refresh()
    // is a stop-and-start anyway, and this keeps one code path for building a
    // container instead of two that can disagree.
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
