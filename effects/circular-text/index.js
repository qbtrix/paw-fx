// CircularTextEffect
// The MIT License
// Copyright (c) 2009 - 2021 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/CircularTextEffect
//
// circular-text: a port of Codrops' CircularTextEffect demo 1, commit
// fcd9aaa5d55d0d6ce5f9d1b6795e4c3d45dd93b2, src/js/demo1/intro.js with
// src/index.html for the four concentric textPath rings and src/css/base.css
// for the 700px transform origin they turn around. Two runs, both upstream's:
// start() scales the rings up from 0.3 and fades them in over 2.5s on expo
// with the whole stagger spread across 0.5s, and hovering the centre control
// swells its disc to 1.2 over 0.8s on power4 while every ring turns a further
// 180 degrees over 4s, that stagger spread across 0.3s from the outside in.
//
// The ring geometry (four circles at radius 450.5, 318.5, 213.5 and 133 around
// 700,700, each with the textLength that makes any string fit the ring), the
// two durations, both easings, both stagger amounts and the +=180 turn are
// upstream's. What is not: enter(), the second half of intro.js, is dropped
// with the whole page-intro apparatus it drives -- it scales the rings away and
// reveals a .content and .frame that belong to the demo page, not to a section.
//
// The resting state is the badge as style.css draws it: rings at full size and
// full opacity, control in place, legible with the script blocked, the bundle
// pruned or reduced motion on. Upstream inverts that with a `.js` class that
// hides everything at load; here the script only hides the rings at the moment
// it starts the run that brings them back, and only when the badge is actually
// on screen.
import { animate, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "circular-text",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    introDuration: { type: "number", default: 2.5, description: "Seconds the rings take to scale in. Upstream's start() duration." },
    turn: { type: "number", default: 180, description: "Degrees each ring turns on hover. Upstream's rotate '+=180'." },
    turnDuration: { type: "number", default: 4, description: "Seconds that turn takes. Upstream's hover duration." },
  },
};

const UPSTREAM = { introDuration: 2.5, turn: 180, turnDuration: 4 };

// GSAP counts in seconds, anime.js in milliseconds. Every upstream duration
// below is written as upstream's own number times this.
const SEC = 1000;

// GSAP's stagger `amount` spreads the WHOLE stagger across that many seconds;
// anime's stagger takes the gap between one target and the next. A negative
// amount is GSAP's way of running the set backwards, which anime spells with
// from: 'last'.
const spread = (amount, total) => stagger(Math.abs(amount) * SEC / Math.max(total - 1, 1), amount < 0 ? { from: "last" } : {});

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the badge at full size, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const rings = [...el.querySelectorAll(".fx-circles__text")];
  const enterCtrl = el.querySelector(".fx-circles__enter");
  const enterBackground = el.querySelector(".fx-circles__enter-bg");
  if (!rings.length || !enterCtrl || !enterBackground || typeof IntersectionObserver !== "function") return resting;

  const settings = { ...UPSTREAM, ...opts };
  let observer = null;
  let running = [];
  let played = false;

  // start(): the rings and the control scale up from 0.3 and fade in.
  const start = () => {
    played = true;
    running.push(animate([...rings, enterCtrl], {
      duration: settings.introDuration * SEC,
      ease: "outExpo",
      scale: [0.3, 1],
      opacity: [0, 1],
      delay: spread(0.5, rings.length + 1),
    }));
  };

  // The hover pair: the disc swells while every ring turns another half turn.
  const onEnter = () => {
    for (const anim of running) anim.cancel();
    running = [];
    running.push(animate(enterBackground, {
      duration: 0.8 * SEC,
      ease: "outQuint",
      scale: 1.2,
      opacity: 1,
    }));
    running.push(animate(rings, {
      duration: settings.turnDuration * SEC,
      ease: "outQuint",
      rotate: `+=${settings.turn}`,
      delay: spread(-0.3, rings.length),
    }));
  };

  const onLeave = () => {
    running.push(animate(enterBackground, {
      duration: 0.8 * SEC,
      ease: "outQuint",
      scale: 1,
    }));
  };

  enterCtrl.addEventListener("mouseenter", onEnter);
  enterCtrl.addEventListener("mouseleave", onLeave);

  // Upstream runs start() on page load, because the badge IS its page. A
  // section can sit anywhere down the document, so the run waits until it is
  // actually on screen and plays once.
  observer = new IntersectionObserver((entries, obs) => {
    if (played || !entries.some((e) => e.isIntersecting)) return;
    obs.disconnect();
    observer = null;
    start();
  });
  observer.observe(el);

  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      observer?.disconnect();
      observer = null;
      enterCtrl.removeEventListener("mouseenter", onEnter);
      enterCtrl.removeEventListener("mouseleave", onLeave);
      // revert() strips the inline transform and opacity anime wrote, which
      // is what hands the badge back at full size rather than leaving it
      // frozen at 0.3 if the tear-down lands mid-run.
      for (const anim of running) anim.revert();
      running = [];
      el.removeAttribute("data-fx-live");
    },
  };
}
