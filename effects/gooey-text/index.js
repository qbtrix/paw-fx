// Gooey Text Hover Effect
// MIT License
// Copyright (c) 2009 - 2020 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/GooeyTextHoverEffect
//
// gooey-text: a port of Codrops' Gooey Text Hover Effect, demo 1, commit
// 6db15b76e7425c2bca6f746da367bd927641fa48, src/js/demo1/menuItem.js and
// src/css/base.css, with the SVG filter markup from src/index.html.
//
// Almost all of this effect is declarative and ports verbatim: an SVG filter
// of feGaussianBlur -> feColorMatrix (`0 0 0 15 -8` on the alpha row, which is
// the contrast crush that makes separate letters melt together) -> feComposite
// atop. What upstream's JavaScript adds is four linear tweens on one paused
// timeline:
//
//   0.0 -> 0.8s  stdDeviation 0 -> 1     (the blur swells)
//   0.8 -> 1.6s  stdDeviation 1 -> 0     (and settles)
//   0.0 -> 1.6s  first text opacity 1 -> 0
//   0.0 -> 1.6s  second text opacity 0 -> 1
//
// with `ease: "none"` on every one of them, so the two words cross-fade at a
// constant rate while the goo peaks halfway through. Entering plays it,
// leaving reverses it, and both ends drop `filter` back to `none` so four idle
// items are not each running an SVG filter for nothing. Every duration and
// every value above is upstream's.
//
// The filter is applied to the <g>, not the item, and is switched on only for
// the length of the animation -- that is upstream's design and the reason this
// is cheap enough to put four of on a page.
//
// The resting state is the first word. CSS hides the second one
// (`text:nth-child(2) { opacity: 0 }`) and nothing hides the first, so a
// blocked script, a pruned bundle or reduced motion leaves a legible menu.
import { createTimeline } from "../../vendor/anime.esm.js";

export const meta = {
  name: "gooey-text",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    blurDuration: { type: "number", default: 0.8, description: "Seconds each half of the blur takes: 0 to peak, then peak back to 0. Upstream's stdDeviation tween duration." },
    swapDuration: { type: "number", default: 1.6, description: "Seconds the two words take to cross-fade. Upstream's opacity tween duration." },
    blur: { type: "number", default: 1, description: "Peak feGaussianBlur stdDeviation. Upstream's stdDeviation target." },
  },
};

// menuItem.js createTimeline(), verbatim.
const UPSTREAM = { blurDuration: 0.8, swapDuration: 1.6, blur: 1 };

// GSAP counts in seconds, anime.js counts in milliseconds.
const MS = 1000;

// An SVG url(#id) reference resolves document-wide against the first matching
// id, so two of these sections on one page would both point at the first
// section's filter. Upstream never has to think about it: its ids are
// hand-numbered goo-1 to goo-4 across one page.
let uid = 0;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelectorAll !== "function") return resting;

  const items = [...el.querySelectorAll(".fx-gooey__item")];
  if (!items.length) return resting;
  // A reader who asked for stillness keeps the first word, which is the
  // finished content. Nothing is hidden behind the animation.
  if (reducedMotion()) return resting;

  const settings = { ...UPSTREAM, ...opts };
  const scopeId = ++uid;

  // MenuItem, one per link.
  const built = items.map((itemEl, i) => {
    const textsGroupEl = itemEl.querySelector("svg > g");
    const filterEl = itemEl.querySelector("svg filter");
    const feBlur = filterEl?.querySelector("feGaussianBlur");
    const [text_1, text_2] = textsGroupEl ? textsGroupEl.querySelectorAll("text") : [];
    if (!textsGroupEl || !feBlur || !text_1 || !text_2) return null;

    // Make the id unique to this mount before anything references it.
    const filterId = `fx-gooey-${scopeId}-${i}`;
    filterEl.id = filterId;

    const primitiveValues = { stdDeviation: 0 };

    // menuItem.js createTimeline(). onComplete covers both of upstream's
    // onComplete and onReverseComplete: anime's alternate() flips the
    // direction and seeks, so the playhead reaches the end of the timeline
    // whichever way it is running.
    const tl = createTimeline({
      autoplay: false,
      onComplete: () => { textsGroupEl.style.filter = "none"; },
      onUpdate: () => { feBlur.setAttribute("stdDeviation", primitiveValues.stdDeviation); },
    })
      .add(primitiveValues, {
        duration: settings.blurDuration * MS,
        ease: "linear",
        stdDeviation: [0, settings.blur],
      }, 0)
      .add(primitiveValues, {
        duration: settings.blurDuration * MS,
        ease: "linear",
        stdDeviation: 0,
      }, settings.blurDuration * MS)
      .add(text_1, {
        duration: settings.swapDuration * MS,
        ease: "linear",
        opacity: 0,
      }, 0)
      .add(text_2, {
        duration: settings.swapDuration * MS,
        ease: "linear",
        opacity: 1,
      }, 0);

    // menuItem.js initEvents()
    const onMouseEnterFn = () => {
      textsGroupEl.style.filter = `url(#${filterId})`;
      tl.play();
    };
    const onMouseLeaveFn = () => {
      textsGroupEl.style.filter = `url(#${filterId})`;
      tl.reverse();
    };
    itemEl.addEventListener("mouseenter", onMouseEnterFn);
    itemEl.addEventListener("mouseleave", onMouseLeaveFn);
    // A keyboard reader gets the same thing: focus is the pointer's equivalent
    // here, and without it the second word is unreachable without a mouse.
    itemEl.addEventListener("focus", onMouseEnterFn);
    itemEl.addEventListener("blur", onMouseLeaveFn);

    return { itemEl, textsGroupEl, text_1, text_2, tl, onMouseEnterFn, onMouseLeaveFn };
  }).filter(Boolean);

  if (!built.length) return resting;
  el.setAttribute("data-fx-live", "");

  return {
    // The timelines are built once, so a changed duration applies on the next
    // mount rather than mid-hover.
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      for (const b of built) {
        b.tl.pause();
        b.tl.revert();
        b.itemEl.removeEventListener("mouseenter", b.onMouseEnterFn);
        b.itemEl.removeEventListener("mouseleave", b.onMouseLeaveFn);
        b.itemEl.removeEventListener("focus", b.onMouseEnterFn);
        b.itemEl.removeEventListener("blur", b.onMouseLeaveFn);
        b.textsGroupEl.style.removeProperty("filter");
        // revert() restores the inline styles anime wrote; the two words go
        // back to the stylesheet's resting state rather than wherever a
        // half-finished hover left them.
        b.text_1.style.removeProperty("opacity");
        b.text_2.style.removeProperty("opacity");
      }
      el.removeAttribute("data-fx-live");
    },
  };
}
