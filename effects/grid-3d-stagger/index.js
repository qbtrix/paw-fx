// Staggered3DGridAnimations
// The MIT License
// Copyright (c) 2009 - 2024 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/Staggered3DGridAnimations
//
// grid-3d-stagger: a port of Codrops' Staggered3DGridAnimations, commit
// 7c2703d41f55005c2758e1031b593d2493d392f8, the animateScrollGrid() function
// in js/index.js with css/base.css and index.html for the grid it drives.
// Every cell is its own scrubbed timeline in two halves, and which half of the
// viewport the cell sits in decides the sign of every asymmetric value:
//
//   arriving  z 300 -> 0, rotateX 70 -> 0, rotateZ +/-5 -> 0,
//             x -/+40% -> 0, skewX -/+20 -> 0, y 100% -> 0, and the picture
//             unblurs from blur(7px) brightness(0%) contrast(400%) while its
//             inner layer relaxes from scaleY 1.8. Ease sine.
//   leaving   z 0 -> 300, rotateX 0 -> -50, rotateZ -/+1, x -/+20%,
//             skewX +/-10, back out to blur(4px) contrast(500%), inner layer
//             back to scaleY 1.8. Ease sine.in.
//
// isLeftSide, every one of those numbers, both easings, the two-part shape and
// the scroll range are upstream's. What is not: the driver is anime.js'
// onScroll instead of ScrollTrigger, and the demo's three other timelines --
// the marquee, the split-character heading and the second full-bleed grid --
// are not part of this section.
//
// The resting state is the grid itself, laid out and legible in style.css.
// index.js only writes transforms and a filter onto cells that are already
// there, so with the script blocked, the bundle pruned or reduced motion on,
// the section is a finished gallery.
import { createTimeline, onScroll } from "../../vendor/anime.esm.js";

export const meta = {
  name: "grid-3d-stagger",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    depth: { type: "number", default: 300, description: "How far each cell travels on z, in pixels. Upstream's z." },
    tilt: { type: "number", default: 70, description: "Degrees a cell is tipped on x when it arrives. Upstream's rotateX." },
    stretch: { type: "number", default: 1.8, description: "How far the inner layer is stretched on y at each end. Upstream's scaleY." },
  },
};

const UPSTREAM = { depth: 300, tilt: 70, stretch: 1.8 };

// GSAP counts in seconds, anime.js in milliseconds.
const SEC = 1000;
// GSAP's own default tween duration, which upstream never overrides. Only the
// ratio between the two halves matters once the timeline is scrubbed, but
// writing it out is what keeps them equal.
const HALF = 0.5 * SEC;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// isLeftSide(): which half of the viewport the cell's own centre sits in.
const isLeftSide = (element) => {
  const elementCenter = element.getBoundingClientRect().left + element.offsetWidth / 2;
  const viewportCenter = window.innerWidth / 2;
  return elementCenter < viewportCenter;
};

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already laid
  // the grid out, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const wraps = [...el.querySelectorAll(".fx-grid3d__imgwrap")];
  if (!wraps.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let cells = [];

  const build = () => {
    cells = wraps.map((imageWrap) => {
      const imgEl = imageWrap.querySelector(".fx-grid3d__img");
      const leftSide = isLeftSide(imageWrap);

      const timeline = createTimeline({ defaults: { duration: HALF }, autoplay: false })
        .add(imageWrap, {
          ease: "outSine",
          z: [settings.depth, 0],
          rotateX: [settings.tilt, 0],
          rotateZ: [leftSide ? 5 : -5, 0],
          x: [leftSide ? "-40%" : "40%", "0%"],
          skewX: [leftSide ? -20 : 20, 0],
          y: ["100%", "0%"],
          filter: ["blur(7px) brightness(0%) contrast(400%)", "blur(0px) brightness(100%) contrast(100%)"],
        }, 0)
        .add(imgEl, { ease: "outSine", scaleY: [settings.stretch, 1] }, 0)
        .add(imageWrap, {
          ease: "inSine",
          z: settings.depth,
          rotateX: -50,
          rotateZ: leftSide ? -1 : 1,
          x: leftSide ? "-20%" : "20%",
          skewX: leftSide ? 10 : -10,
          filter: "blur(4px) brightness(0%) contrast(500%)",
        }, HALF)
        .add(imgEl, { ease: "inSine", scaleY: settings.stretch }, HALF);

      // ScrollTrigger start 'top bottom+=10%' / end 'bottom top-=25%' is
      // anime's enter '110% top' / leave '-25% bottom': the container position
      // comes first and an offset past an edge is written as a percentage of
      // the container rather than as an arithmetic suffix.
      const observer = onScroll({
        target: imageWrap,
        enter: `${100 + 10}% top`,
        leave: `${0 - 25}% bottom`,
        sync: true,
      }).link(timeline);

      return { timeline, observer };
    });
  };

  const tear = () => {
    for (const cell of cells) {
      cell.observer?.revert();
      cell.timeline?.revert();
    }
    cells = [];
  };

  build();
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      tear();
      build();
    },
    destroy() {
      // revert() strips the inline transforms and the filter, which hands the
      // grid back flat rather than leaving a cell tipped at 70 degrees.
      tear();
      el.removeAttribute("data-fx-live");
    },
  };
}
