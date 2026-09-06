// Image Grid Motion Effect
// MIT License
// Copyright (c) 2009 - 2021 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/ImageGridMotionEffect
//
// grid-motion: a port of Codrops' ImageGridMotionEffect, commit
// 210f9703661b0547d8c16c91fee5df942f816846, src/js/demo1/grid.js plus the map /
// lerp / getRandomNumber helpers in src/js/utils.js and the .grid rules and
// ten pos-N placements in src/css/base.css.
//
// A scattered wall of images behind the copy, drifting against the pointer.
// Every cell draws its own random range once -- getRandomNumber(15, 60) on each
// axis -- so moving the pointer from one edge of the section to the other
// slides that cell anywhere between -60px and +60px, and no two cells travel
// at the same rate. The motion is lerped at 0.07 per frame, which is what
// makes the wall feel heavy rather than glued to the cursor.
//
// The arrival is Grid.showItems: cells scale 0.7 -> 1 over two seconds on
// expo, and fade 0 -> 0.4 over three, both staggered 0.6s across the grid from
// the centre outwards.
//
// 0.4 is where the fade STOPS, so it is also the resting opacity in style.css.
// That ordering is the contract: with the script blocked, the bundle pruned or
// reduced motion on, the wall is already the finished backdrop at full scale,
// and this file only gives it the arrival and the drift.
//
// No image ships with this effect. Codrops' demo photographs are theirs, so
// every cell paints a CSS gradient until a site sets --fx-img on it; see
// snippet.html.
import { createTimeline, stagger, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "grid-motion",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    minShift: { type: "number", default: 15, description: "Smallest per-cell travel in px from centre to edge. Upstream's getRandomNumber(15,60) lower bound." },
    maxShift: { type: "number", default: 60, description: "Largest per-cell travel in px from centre to edge. Upstream's getRandomNumber(15,60) upper bound." },
    ease: { type: "number", default: 0.07, description: "Lerp amount per frame, 0 to 1. Lower is heavier. Upstream's 0.07." },
    opacity: { type: "number", default: 0.4, description: "Opacity the wall settles at, which is also its resting value in style.css. Upstream's showItems target." },
  },
};

const UPSTREAM = { minShift: 15, maxShift: 60, ease: 0.07, opacity: 0.4 };

// GSAP counts durations in seconds and anime.js in milliseconds.
const SECOND = 1000;

// utils.js, verbatim.
// Map number x from range [a, b] to [c, d]
const map = (x, a, b, c, d) => (x - a) * (d - c) / (b - a) + c;
// Linear interpolation
const lerp = (a, b, n) => (1 - n) * a + n * b;
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the wall at its settled opacity and full scale.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const items = [...el.querySelectorAll(".fx-gridmotion__item")];
  if (!items.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let frame = 0;
  let tl = null;
  // Upstream's module-scope mousepos, seeded at the middle so a pointer that
  // never arrives leaves every cell exactly where the stylesheet put it.
  let mousepos = { x: 0.5, y: 0.5 };

  // GridItem.move, one state object per cell instead of one closure and one
  // requestAnimationFrame loop per cell.
  const cells = items.map((item) => ({
    el: item,
    translationVals: { tx: 0, ty: 0 },
    xstart: getRandomNumber(settings.minShift, settings.maxShift),
    ystart: getRandomNumber(settings.minShift, settings.maxShift),
  }));

  const render = () => {
    for (const cell of cells) {
      // Translation values will be in the range of [-start, start] for a
      // pointer movement from 0 to the section's width/height.
      cell.translationVals.tx = lerp(cell.translationVals.tx, map(mousepos.x, 0, 1, -cell.xstart, cell.xstart), settings.ease);
      cell.translationVals.ty = lerp(cell.translationVals.ty, map(mousepos.y, 0, 1, -cell.ystart, cell.ystart), settings.ease);
      cell.el.style.translate = `${cell.translationVals.tx}px ${cell.translationVals.ty}px`;
    }
    frame = requestAnimationFrame(render);
  };

  // Upstream reads clientX/clientY against window.innerWidth/innerHeight,
  // because its grid is the whole viewport. Here it is a section, so the
  // pointer is normalised to the section's own box and the map() call above
  // runs over 0..1 rather than 0..width.
  const onMouseMove = (ev) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mousepos = { x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height };
  };
  // Not upstream, which has nowhere for the pointer to go. A section does:
  // letting go returns the wall to centre instead of freezing it off-axis.
  const onMouseLeave = () => { mousepos = { x: 0.5, y: 0.5 }; };

  // Grid.showItems. The stagger is upstream's 0.6s spread across the grid from
  // the centre; anime takes a per-step delay rather than a total, so the
  // spread is divided by the gaps between cells.
  //
  // Upstream's two tweens stay two tweens on purpose: the scale runs 2s on
  // expo and the fade 3s on power1, from the same .set() and the same stagger,
  // both at position 0. Folding the fade into the scale tween would put it on
  // the wrong curve over the wrong second, and every literal would still trace.
  const spread = cells.length > 1 ? (0.6 * SECOND) / (cells.length - 1) : 0;
  utils.set(items, { scale: 0.7, opacity: 0 });
  tl = createTimeline()
    .add(items, {
      scale: 1,
      duration: 2 * SECOND,
      ease: "outExpo",
      delay: stagger(spread, { grid: true, from: "center" }),
    }, 0)
    .add(items, {
      opacity: settings.opacity,
      duration: 3 * SECOND,
      ease: "outQuad",
      delay: stagger(spread, { grid: true, from: "center" }),
    }, 0);

  el.addEventListener("mousemove", onMouseMove);
  el.addEventListener("mouseleave", onMouseLeave);
  frame = requestAnimationFrame(render);
  el.setAttribute("data-fx-live", "");

  const tear = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    tl?.revert();
    tl = null;
    // The drift's translate and the pre-run utils.set are both outside the
    // timeline, so revert() does not own them; without this a destroy would
    // leave the wall parked at scale 0.7 and opacity 0.
    for (const cell of cells) {
      cell.el.style.translate = "";
      cell.el.style.transform = "";
      cell.el.style.opacity = "";
    }
  };

  return {
    update(next = {}) {
      Object.assign(settings, next);
      // A changed travel range is only visible once the cells redraw theirs.
      for (const cell of cells) {
        cell.xstart = getRandomNumber(settings.minShift, settings.maxShift);
        cell.ystart = getRandomNumber(settings.minShift, settings.maxShift);
      }
      el.style.setProperty("--fx-opacity", String(settings.opacity));
    },
    destroy() {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      tear();
      el.style.removeProperty("--fx-opacity");
      el.removeAttribute("data-fx-live");
    },
  };
}
