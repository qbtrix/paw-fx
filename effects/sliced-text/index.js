// SlicedTextEffect
// The MIT License
// Copyright (c) 2009 - 2023 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/SlicedTextEffect
//
// sliced-text: a port of Codrops' SlicedTextEffect, effect 1, commit
// 45bbcfd96b0c87a5a5299cb4bacc583dd3b71bf8, js/item.js and the fx1Timeline in
// js/index.js, with css/base.css for the grid. The heading is rebuilt as four
// equal columns, each an overflow-hidden window holding a whole copy of the
// word pushed left by one column width per position -- so column 0 shows the
// first quarter of the word, column 1 the second, and together they read as
// the word itself. Scrolling slides those copies sideways: the left half
// starts at -13, -26, -39 percent and the right half at +13, +26, +39, all
// arriving at zero on power1 as the heading reaches the top of the viewport,
// which is what makes the bands cut apart and snap back into register.
//
// layout(), setCSSValues(), the --text-width / --gsplits / --offset grid, the
// one-pixel-per-position left nudge that closes the seams, the 13 percent
// increment, the power1 ease and the scroll range are upstream's. What is not:
// the scroll driver is anime.js' onScroll rather than ScrollTrigger plus
// Lenis, and the six sibling effects (fx2 to fx6) are not carried.
//
// The resting state is the plain heading in the markup, and the animation's
// end state is the same word in register, so the two agree. With the script
// blocked, the bundle pruned or reduced motion on, the reader gets the word.
import { animate, onScroll, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "sliced-text",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    cells: { type: "number", default: 4, description: "How many vertical bands the word is cut into. Upstream's totalCells for effect 1." },
    offset: { type: "number", default: 13, description: "Percent each band starts away from register, multiplied by its distance from the centre. Upstream's fx1 initialValues.x." },
  },
};

const UPSTREAM = { cells: 4, offset: 13 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the heading in the markup is
  // already the finished word, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const targets = [...el.querySelectorAll(".fx-sliced__word")];
  if (!targets.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let items = [];
  let onResize = null;

  // layout(): totalCells windows, each holding a whole copy of the word.
  const layout = (item) => {
    let newHTML = "";
    for (let i = 0; i < settings.cells; ++i) {
      newHTML += `<span class="fx-sliced__box"><span class="fx-sliced__box-inner">${item.text}</span></span>`;
    }
    item.el.innerHTML = newHTML;
    item.innerWrap = [...item.el.querySelectorAll(".fx-sliced__box")];
    item.inner = [...item.el.querySelectorAll(".fx-sliced__box-inner")];
  };

  // setCSSValues(): the measured width of one whole copy drives the column
  // width, and each copy is pushed left by one column so its window shows the
  // band that belongs to it.
  const setCSSValues = (item) => {
    const computedWidth = getComputedStyle(item.inner[0]).width;
    item.el.style.setProperty("--fx-text-width", computedWidth);
    item.el.style.setProperty("--fx-splits", settings.cells);
    const offset = parseFloat(computedWidth) / settings.cells;
    item.inner.forEach((inner, pos) => {
      utils.set(inner, { left: offset * -pos });
    });
  };

  const build = () => {
    items = targets.map((node) => {
      const item = { el: node, text: node.dataset.fxText || node.textContent.trim(), original: node.innerHTML };
      layout(item);
      setCSSValues(item);
      // fx1Timeline: the left half of the bands starts further left the
      // nearer it is to the centre, the right half further right, and every
      // one of them lands on zero.
      item.animation = animate(item.inner, {
        ease: "outQuad",
        x: [
          (_, pos, arr) => `${pos < arr.length / 2
            ? -settings.offset * pos - settings.offset
            : settings.offset * (pos - arr.length / 2) + settings.offset}%`,
          "0%",
        ],
        autoplay: false,
      });
      // ScrollTrigger start 'top bottom' / end 'top top+=10%' is anime's
      // enter 'bottom top' / leave '10% top': the same two thresholds with
      // the container position written first instead of second.
      item.observer = onScroll({ target: node, enter: "bottom top", leave: "10% top", sync: true }).link(item.animation);
      return item;
    });
  };

  const tear = () => {
    for (const item of items) {
      item.observer?.revert();
      item.animation?.revert();
      item.el.style.removeProperty("--fx-text-width");
      item.el.style.removeProperty("--fx-splits");
      item.el.innerHTML = item.original;
    }
    items = [];
  };

  build();
  // Upstream re-measures on resize, because the column width is a measured
  // pixel value and a narrower window changes it.
  onResize = () => { for (const item of items) setCSSValues(item); };
  window.addEventListener("resize", onResize);
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      tear();
      build();
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      tear();
      el.removeAttribute("data-fx-live");
    },
  };
}
