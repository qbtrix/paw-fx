// tsParticles presets
// MIT License
// Copyright (c) 2020 Matteo Bruni
// https://github.com/tsparticles/presets
//
// links-network: a port of the tsParticles "links" preset, commit
// ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7, presets/links/src/options.ts.
// Every value below is that file's: 100 particles, links enabled at distance
// 150, movement enabled, white circles of size 1.
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
  name: "links-network",
  version: "1.0.0",
  category: "particles",
  needs: ["tsparticles"],
  license: "MIT",
  options: {
    count: { type: "number", default: 100, description: "Node count. Upstream's particles.number.value." },
    color: { type: "string", default: "#ffffff", description: "Node and link colour. Upstream's particles.paint.fill.color.value." },
    linkDistance: { type: "number", default: 150, description: "Pixels within which two nodes are joined. Upstream's particles.links.distance." },
  },
};

// presets/links/src/options.ts, verbatim apart from the dropped `background`
// that the deviations in meta.json name; the section's CSS owns that.
const optionsFor = ({ count, color, linkDistance }) => ({
  particles: {
    number: {
      value: count,
    },
    links: {
      distance: linkDistance,
      enable: true,
    },
    move: {
      enable: true,
    },
    paint: {
      fill: {
        color: {
          value: color,
        },
      },
    },
    size: {
      value: 1,
    },
    shape: {
      type: "circle",
    },
  },
});

const UPSTREAM = { count: 100, color: "#ffffff", linkDistance: 150 };

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
  // No element, no DOM, or a reader who asked for stillness: the SVG
  // constellation in snippet.html is already the finished section.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;
  const host = el.querySelector("[data-fx-canvas]") || el;

  const settings = { ...UPSTREAM, ...opts };
  let container = null;
  let torn = false;

  const load = () => {
    const engine = globalThis.tsParticles;
    const loadSlim = globalThis.loadSlim;
    if (!engine || !loadSlim) return; // bundle pruned or blocked
    (async () => {
      try {
        await loadSlim(engine);
        if (torn) return;
        const c = await engine.load({ id: `fx-links-network-${++seq}`, element: host, options: optionsFor(settings) });
        if (torn) { c?.destroy(); return; }
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
