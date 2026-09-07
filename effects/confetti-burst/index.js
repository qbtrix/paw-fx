// tsParticles presets
// MIT License
// Copyright (c) 2020 Matteo Bruni
// https://github.com/tsparticles/presets
//
// confetti-burst: a port of the tsParticles "confettiExplosions" preset,
// commit ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7,
// presets/confettiExplosions/src/options.ts. Every number below is that file's:
// squares and circles at 3-5px, opacity animating from max to min at speed 3
// and destroying there, launch angle 45 with no offset, gravity 9.81, speed
// 15-25, decay 0.1, random on, out mode destroy with the top edge exempt, and
// rotation 0-360 in a random direction animating at speed 60.
//
// THE ONE STRUCTURAL CHANGE, AND WHY. Upstream spawns the burst with an
// `emitters` block, and the emitters plugin is NOT in the vendored
// @tsparticles/slim 4.3.2 bundle -- so the preset as written loads and paints
// nothing. What replaces it is the substitution the sourcing pass proved:
// start at zero particles and push a batch in on an event. The lifetime that
// the emitter's `life` gave each piece comes from the opacity animation
// instead: it starts at max, runs down to min at speed 3, and `destroy: "min"`
// removes the particle when it gets there.
//
// This is the only effect in the library that responds to an event rather than
// running on its own, so the section is built around a real button.
//
// The vendored slim bundle publishes its engine on globalThis instead of
// exporting it, which is the one globals exception the contract allows -- so
// the two reads happen inside mount(), never at import time. The torn flag,
// the generation counter and the per-mount id are taken from
// effects/starfield/index.js, where each fixes a bug its comments record.
import "../../vendor/tsparticles.slim.bundle.min.js";

export const meta = {
  name: "confetti-burst",
  version: "1.0.0",
  category: "particles",
  needs: ["tsparticles"],
  license: "MIT",
  options: {
    quantity: { type: "number", default: 50, description: "Pieces per burst. Upstream's emitters.rate.quantity, which is what the push replaces." },
    colors: { type: "string", default: "#ffd166,#ef476f,#06d6a0,#118ab2,#f8f9fa", description: "Comma-separated piece colours. Stands in for the preset's palette key, which a vendored bundle has no registry for." },
    trigger: { type: "string", default: "[data-fx-burst]", description: "Selector for the elements inside the section whose click fires a burst. Empty string makes the whole section a trigger." },
  },
};

// presets/confettiExplosions/src/options.ts, verbatim apart from the seams
// meta.json's deviations name: no emitters, no tilt/roll/wobble, no
// fullScreen, no background, no motion.disable, and the palette replaced by an
// explicit colour list.
const optionsFor = ({ colors }) => ({
  fullScreen: {
    enable: false,
  },
  particles: {
    number: {
      value: 0,
      density: {
        enable: true,
      },
    },
    shape: {
      type: ["square", "circle"],
    },
    size: {
      value: {
        min: 3,
        max: 5,
      },
    },
    paint: {
      fill: {
        color: {
          value: colors.split(",").map((c) => c.trim()).filter(Boolean),
        },
      },
    },
    opacity: {
      value: { min: 0, max: 1 },
      animation: {
        enable: true,
        startValue: "max",
        destroy: "min",
        speed: 3,
      },
    },
    move: {
      angle: {
        value: 45,
        offset: 0,
      },
      drift: 0,
      enable: true,
      gravity: {
        enable: true,
        acceleration: 9.81,
      },
      speed: {
        min: 15,
        max: 25,
      },
      decay: 0.1,
      random: true,
      straight: false,
      outModes: {
        default: "destroy",
        top: "none",
      },
    },
    rotate: {
      value: {
        min: 0,
        max: 360,
      },
      direction: "random",
      move: true,
      animation: {
        enable: true,
        speed: 60,
      },
    },
  },
});

const UPSTREAM = {
  quantity: 50,
  colors: "#ffd166,#ef476f,#06d6a0,#118ab2,#f8f9fa",
  trigger: "[data-fx-burst]",
};

// One id per mounted section. The engine derives a container id from
// `options.id ?? element.id ?? a random one`, and a host div with no id
// attribute yields "" -- which is not nullish, so every section on the page
// asked for the SAME container and each new mount replaced the last.
let seq = 0;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No element, no DOM, or a reader who asked for stillness. Nothing is lost
  // here: the section is a card with a working button, and the burst is the
  // decoration on top of it.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;
  const host = el.querySelector("[data-fx-canvas]") || el;

  const settings = { ...UPSTREAM, ...opts };
  let container = null;
  let torn = false;
  let generation = 0;

  const burstAt = (clientX, clientY) => {
    if (!container) return;
    const r = host.getBoundingClientRect();
    container.particles.push(settings.quantity, { x: clientX - r.left, y: clientY - r.top });
  };

  const onClick = (e) => {
    if (torn || !container) return;
    const t = settings.trigger ? e.target.closest(settings.trigger) : el;
    if (!t || !el.contains(t)) return;
    // A keyboard activation of a button arrives as a click with detail 0 and
    // no useful coordinates, so the burst comes off the control itself.
    if (e.detail === 0) {
      const b = t.getBoundingClientRect();
      burstAt(b.left + b.width / 2, b.top + b.height / 2);
      return;
    }
    burstAt(e.clientX, e.clientY);
  };

  const load = () => {
    const gen = ++generation;
    const engine = globalThis.tsParticles;
    const loadSlim = globalThis.loadSlim;
    if (!engine || !loadSlim) return; // bundle pruned or blocked
    (async () => {
      try {
        await loadSlim(engine);
        if (torn || gen !== generation) return;
        const c = await engine.load({ id: `fx-confetti-burst-${++seq}`, element: host, options: optionsFor(settings) });
        if (torn || gen !== generation) { c?.destroy(); return; }
        container = c;
        el.setAttribute("data-fx-live", "");
      } catch {
        // A refused canvas leaves the CSS resting state exactly as it was.
      }
    })();
  };
  load();
  el.addEventListener("click", onClick);

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
      el.removeEventListener("click", onClick);
      container?.destroy();
      container = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
