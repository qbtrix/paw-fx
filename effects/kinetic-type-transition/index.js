// Kinetic Typography Page Transition
// MIT License
// Copyright (c) 2009 - 2021 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/KineticTypePageTransition
//
// kinetic-type-transition: a port of Codrops' KineticTypePageTransition,
// commit ebe926e2f1de42950c36ff8a678321155280c1af, src/js/typeTransition.js
// plus the .type / .type__line rules in src/css/base.css.
//
// A wall of oversized repeated words sits behind the copy at almost nothing.
// The section arrives and it wakes: the whole wall turns 90 degrees
// anticlockwise while blowing up to 2.7x over 1.4s, and every row slides right
// to 20% then hard left to -200%, brightening to full and going out, each row
// 40ms behind the one above. Then it comes back -- the wall unwinds to 1 and 0
// on the same curve, the rows return to 0% on a back curve over 2.3s from the
// bottom up, and the opacity settles at the faint value it started from.
//
// Every duration, curve, percentage, stagger and offset above is upstream's
// in() and out(), unchanged. What CANDIDATES.md flagged as needing a check
// before this was dispatched -- an import of gsap/CustomEase, a Club GreenSock
// plugin -- is not present at this commit: typeTransition.js imports `gsap`
// and nothing else, src/js/index.js the same, and package.json lists only gsap
// and imagesloaded. There is no custom curve here to transcribe. Every ease is
// stock: power2.inOut, power1.inOut, power1.in and back.
//
// The resting state is out()'s END state, drawn in style.css: scale 1, no
// rotation, rows at 0% and at --fx-line-opacity. That ordering is the point.
// With the script blocked, the bundle pruned or reduced motion on the section
// is already the finished composition, and this file's job is to take it away
// and give it back.
import { createTimeline, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "kinetic-type-transition",
  version: "1.0.0",
  category: "transition",
  needs: ["anime"],
  license: "MIT",
  options: {
    scale: { type: "number", default: 2.7, description: "How far the wall blows up at the peak of the sweep. Upstream's in() scale." },
    rotate: { type: "number", default: -90, description: "Degrees the wall turns at the peak, anticlockwise. Upstream's in() rotate." },
    stagger: { type: "number", default: 40, description: "Milliseconds each row waits behind the one above it. Upstream's 0.04 stagger, in ms." },
  },
};

const UPSTREAM = { scale: 2.7, rotate: -90, stagger: 40 };

// GSAP counts durations in seconds and anime.js in milliseconds.
const SECOND = 1000;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the settled wall, which is exactly where this sequence would have left it.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const wall = el.querySelector(".fx-kinetic__type");
  const lines = [...el.querySelectorAll(".fx-kinetic__line")];
  if (!wall || !lines.length || typeof IntersectionObserver !== "function") return resting;

  // Upstream reads this from document.body at module scope, which runs at
  // import time and would make the whole file unloadable without a DOM. The
  // value is the section's own, read when the section is mounted.
  const lineOpacity = getComputedStyle(el).getPropertyValue("--fx-line-opacity").trim() || "0.05";

  const settings = { ...UPSTREAM, ...opts };
  let inTl = null;
  let outTl = null;
  let observer = null;
  let played = false;

  // TypeTransition.in(), "in" transition (total time: 2.5s)
  const buildIn = () => createTimeline({ autoplay: false, onComplete: () => outTl?.play() })
    .add(wall, {
      duration: 1.4 * SECOND,
      ease: "inOutCubic",
      scale: settings.scale,
      rotate: settings.rotate,
    }, 0)
    .add(lines, {
      x: [
        { to: "20%", duration: 1 * SECOND, ease: "inOutQuad" },
        { to: "-200%", duration: 1.5 * SECOND, ease: "inQuad" },
      ],
      delay: stagger(settings.stagger),
    }, 0)
    .add(lines, {
      opacity: [
        { to: 1, duration: 1 * SECOND, ease: "inQuad" },
        { to: 0, duration: 1.5 * SECOND, ease: "inQuad" },
      ],
    }, 0);

  // TypeTransition.out()
  const buildOut = () => createTimeline({ autoplay: false })
    .add(wall, {
      duration: 1.4 * SECOND,
      ease: "inOutCubic",
      scale: 1,
      rotate: 0,
    }, 1.2 * SECOND)
    .add(lines, {
      duration: 2.3 * SECOND,
      ease: "outBack",
      x: "0%",
      // Upstream's stagger: -0.04, which is GSAP for "same spacing, last
      // element first". anime spells that from: 'last'.
      delay: stagger(settings.stagger, { from: "last" }),
    }, 0)
    .add(lines, {
      opacity: [
        { to: 1, duration: 1 * SECOND, ease: "inQuad" },
        { to: lineOpacity, duration: 1.5 * SECOND, ease: "inQuad" },
      ],
    }, 0);

  const build = () => {
    outTl = buildOut();
    inTl = buildIn();
  };
  build();

  // Upstream fires the pair from a click on one of its grid items. A section
  // has no item to click, so the sweep runs the first time the section is on
  // screen and the observer disconnects itself immediately. Once per mount: a
  // wall that re-sweeps every time it scrolls past is noise, not an effect.
  observer = new IntersectionObserver((entries, obs) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    obs.disconnect();
    observer = null;
    played = true;
    inTl.play();
  });
  observer.observe(el);
  el.setAttribute("data-fx-live", "");

  const tear = () => {
    observer?.disconnect();
    observer = null;
    // revert() cancels both timelines and strips the inline transforms and
    // opacities they wrote, which is what puts the wall back at the CSS
    // resting state instead of freezing it mid-sweep.
    inTl?.revert();
    outTl?.revert();
    inTl = null;
    outTl = null;
  };

  return {
    // A changed knob applies to the next run, which for a one-shot means the
    // next mount unless the sweep has not fired yet.
    update(next = {}) {
      Object.assign(settings, next);
      if (played) return;
      inTl?.revert();
      outTl?.revert();
      build();
    },
    destroy() {
      tear();
      el.removeAttribute("data-fx-live");
    },
  };
}
