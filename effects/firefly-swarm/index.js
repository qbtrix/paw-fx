// anime.js
// The MIT License
// Copyright (c) 2025 Julian Garnier
// https://github.com/juliangarnier/anime
//
// firefly-swarm: a port of anime.js' additive-fireflies example, commit
// 01b81be1df6843ccfe0a71c0699a746bf740dd77, examples/additive-fireflies/index.js
// plus examples/additive-fireflies/index.html, which carries the design -- the
// #circle glow with its two pseudo-element shadows and the .particle rule with
// mix-blend-mode: plus-lighter are that file's.
//
// THE MECHANISM. 15 x 15 = 225 absolutely-positioned divs sit at the centre of
// the field. Each one owns a timer running at 4 frames a second; every tick it
// picks a random angle and tweens itself to that point on a circle of the
// current radius around the pointer, over 1000-2000ms. Because the tweens are
// longer than the interval between them and `composition: 'blend'` lets a new
// one blend into the one still running rather than cancelling it, the 225 dots
// never arrive together -- which is what reads as a swarm rather than a ring.
// Holding the pointer down swaps the base radius for the wide one and the
// whole swarm blooms outward.
//
// Every number is upstream's: rows 15, base radius offsetWidth/1.85, active
// radius offsetWidth/.75, the 150ms radius timeout, frameRate 4, durations
// random(1000,2000) and random(1000,1500), scale .5 + random(.1,1,2), ease
// inOut(random(1,5)), the 1.25 radius nudge on move, and the down/up states
// (scale .5 / 1, opacity 1 / .3, saturate 1.25 / 1).
import { animate, createTimer, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "firefly-swarm",
  version: "1.0.0",
  category: "particles",
  needs: ["anime"],
  license: "MIT",
  options: {
    rows: { type: "number", default: 15, description: "Square root of the swarm size; the field holds rows squared particles. Upstream's rows." },
    frameRate: { type: "number", default: 4, description: "How many times a second each particle picks a new target. Upstream's createTimer frameRate." },
  },
};

const UPSTREAM = { rows: 15, frameRate: 4 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn a
  // static warm cluster, so leaving it alone is the finished section.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const wrapper = el.querySelector("[data-fx-canvas]");
  const circle = el.querySelector(".fx-fly__circle");
  if (!wrapper || !circle) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let torn = false;
  // Every timer this mount owns, so destroy() can stop all of them. Upstream
  // leaks them by design -- a demo page never unmounts.
  let timers = [];
  let particles = [];

  const baseRadius = () => circle.offsetWidth / 1.85;
  const activeRadius = () => circle.offsetWidth / 0.75;
  const pointer = { x: 0, y: 0, isDown: false, radius: baseRadius() };

  // Lives for the whole mount rather than per rebuild, so it is cancelled in
  // destroy() and not in teardown().
  const radiusTimeOut = createTimer({
    duration: 150,
    onComplete: () => { pointer.radius = baseRadius(); },
  });

  function animateParticule($el) {
    const t = createTimer({
      frameRate: settings.frameRate,
      onUpdate: () => {
        if (torn) return;
        const angle = Math.random() * Math.PI * 2;
        const radius = pointer.isDown ? activeRadius() : baseRadius();
        animate($el, {
          x: { to: (Math.cos(angle) * radius) + pointer.x, duration: () => utils.random(1000, 2000) },
          y: { to: (Math.sin(angle) * radius) + pointer.y, duration: () => utils.random(1000, 2000) },
          backgroundColor: "#FF0000",
          scale: 0.5 + utils.random(0.1, 1, 2),
          duration: () => utils.random(1000, 1500),
          ease: `inOut(${utils.random(1, 5)})`,
          composition: "blend",
        });
      },
    });
    timers.push(t);
  }

  // Upstream reads the pointer against the window's half-size, because its
  // wrapper is the window. Here it is the section's own centre.
  const centre = () => {
    const r = wrapper.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const onMove = (e) => {
    if (torn) return;
    const c = centre();
    pointer.x = e.clientX - c.x;
    pointer.y = e.clientY - c.y;
    pointer.radius = (pointer.isDown ? activeRadius() : baseRadius() * 1.25);
    radiusTimeOut.restart();
    utils.set(circle, { translateX: pointer.x, translateY: pointer.y });
  };

  const onDown = () => {
    if (torn) return;
    pointer.isDown = true;
    animate(circle, { scale: 0.5, opacity: 1, filter: "saturate(1.25)" });
  };

  // Released outside the section is still a release, so this one is on window
  // while the press is on the section.
  const onUp = () => {
    if (torn || !pointer.isDown) return;
    pointer.isDown = false;
    animate(circle, { scale: 1, opacity: 0.3, filter: "saturate(1)" });
  };

  const build = () => {
    for (let i = 0; i < (settings.rows * settings.rows); i++) {
      const $particle = document.createElement("div");
      $particle.classList.add("fx-fly__particle");
      wrapper.appendChild($particle);
      // Upstream picks from three CSS custom properties; these are this
      // section's, since the example's palette lives in a stylesheet that is
      // not part of the port. It runs AFTER the append, not before as upstream
      // does: a custom property is resolved against the computed style, and a
      // detached element has none, so setting it first writes nothing.
      utils.set($particle, { color: `var(--fx-fly-${utils.random(1, 3)})` });
      particles.push($particle);
      animateParticule($particle);
    }
    el.setAttribute("data-fx-live", "");
  };

  const teardown = () => {
    for (const t of timers) t.cancel();
    timers = [];
    // Kills every tween still in flight on these targets. Necessary rather
    // than tidy: composition 'blend' means a running tween is not cancelled by
    // the next one, so several can be live per particle when destroy lands.
    utils.remove(particles);
    utils.remove(circle);
    for (const p of particles) p.remove();
    particles = [];
    utils.set(circle, { translateX: 0, translateY: 0, scale: 1, opacity: "", filter: "" });
    el.removeAttribute("data-fx-live");
  };

  build();
  el.addEventListener("mousemove", onMove);
  el.addEventListener("mousedown", onDown);
  window.addEventListener("mouseup", onUp);

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      teardown();
      build();
    },
    destroy() {
      torn = true;
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      teardown();
      radiusTimeOut.cancel();
    },
  };
}
