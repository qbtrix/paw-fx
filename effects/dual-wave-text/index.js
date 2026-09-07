// Dual Wave Text Animation
// MIT License
// Copyright (c) 2009 - 2025 Codrops (https://codrops.com)
// https://github.com/ValentinDBS/codrops-tutorial-text-animation
//
// dual-wave-text: a port of Valentin Dubois' Dual Wave Text Animation for
// Codrops, commit 90dfeb2eec89dd6879cabf2e76f4e7096e515a8a --
// src/dual-wave/DualWaveAnimation.js is the whole effect, src/dual-wave/
// style.css the two-column layout, and index.html the markup pattern and the
// data-wave-number / data-wave-speed the demo actually runs at.
//
// THE MECHANISM IS A SINE, and it is upstream's. Each line's horizontal
// position is sin(waveNumber * index + waveSpeed * progress * 2PI - PI/2),
// remapped from -1..1 onto 0..1 and then onto the slack in its column --
// column width minus the widest line -- so no line can ever leave its column.
// The left column takes that offset as written and the right takes it
// negated, which is what puts the two columns in counter-phase. progress is
// how far the section has crossed the viewport. The line nearest the middle
// of the viewport is marked focused and drives the plate between the columns.
//
// GSAP IS BANNED HERE and this is where the real work went:
//   gsap.utils.toArray(...)        -> Array.from(querySelectorAll(...))
//   gsap.quickTo(el, "x", {0.6, power4.out})
//                                  -> createAnimatable(el, { x: { duration:
//                                     600, ease: "outQuint" } }), which is the
//                                     same shape: a smoothed per-property
//                                     setter. GSAP's powerN is degree N+1, so
//                                     power4 is a QUINTIC -- outQuint, not
//                                     outQuart.
//   gsap.set(el, { x })            -> the same animatable setter with a
//                                     duration of 0, so the initial write and
//                                     every later write go through one owner
//                                     of the transform rather than two.
//   ScrollTrigger.create({ trigger, start: "top bottom", end: "bottom top",
//                          onUpdate: self => self.progress })
//                                  -> onScroll({ target, enter: "bottom top",
//                                     leave: "top bottom", onUpdate }).
//                                     ScrollTrigger reads "<target edge>
//                                     <container edge>" and anime reads them
//                                     the other way round, so both strings are
//                                     reversed rather than copied. Written the
//                                     wrong way round the two offsets cross,
//                                     the range collapses and progress silently
//                                     pins at 0.
//   ScrollSmoother.create({ smooth: 1.5 }) in src/main.js -> dropped, not
//                                     replaced. Page-level smooth scrolling is
//                                     its own decision and paw-fx ships it as
//                                     its own effect (smooth-scroll); a section
//                                     that seizes the page's scrolling because
//                                     it happens to be on the page is a bad
//                                     neighbour, and two would fight.
//
// NO BRAND NAMES SHIP. Upstream's right column is 24 real companies and its
// left column pairs each one with a logo file. An MIT grant covers the
// author's code and cannot grant rights in anyone's trade marks, so both
// columns here are invented words and the logos are gone. The effect never
// needed them: it moves text, and the plate is a slot.
//
// The resting state is the two columns as they read in the markup, so a
// blocked script, a pruned bundle or prefers-reduced-motion leaves every line
// legible and in place.
import { createAnimatable, onScroll } from "../../vendor/anime.esm.js";

export const meta = {
  name: "dual-wave-text",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    waveNumber: { type: "number", default: 12, description: "Radians of phase between one line and the next. Upstream's data-wave-number on the demo's wrapper." },
    waveSpeed: { type: "number", default: 1, description: "Whole sine cycles the wave travels over one full crossing of the viewport. Upstream's data-wave-speed." },
  },
};

const UPSTREAM = { waveNumber: 12, waveSpeed: 1 };

// gsap.quickTo(el, "x", { duration: 0.6, ease: "power4.out" }), in anime's
// units and under anime's name for the curve.
const DURATION = 600;
const EASE = "outQuint";

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const wrapper = el.querySelector(".fx-dwave__wrapper");
  if (!wrapper) return resting;

  // Upstream's init(): the two columns are the effect, and it warns and stops
  // without them.
  const leftColumn = wrapper.querySelector(".fx-dwave__column--left");
  const rightColumn = wrapper.querySelector(".fx-dwave__column--right");
  if (!leftColumn || !rightColumn) return resting;

  // Every line is already where it should be at rest, so stillness is the
  // finished state and not a half-drawn one.
  if (reducedMotion()) return resting;

  // The constructor's data-attribute read, with opts taking precedence the way
  // upstream's `options` argument does.
  const config = {
    waveNumber: num(opts.waveNumber, num(wrapper.dataset.waveNumber, UPSTREAM.waveNumber)),
    waveSpeed: num(opts.waveSpeed, num(wrapper.dataset.waveSpeed, UPSTREAM.waveSpeed)),
  };

  const leftTexts = Array.from(leftColumn.querySelectorAll(".fx-dwave__item"));
  const rightTexts = Array.from(rightColumn.querySelectorAll(".fx-dwave__item"));
  const thumbnail = wrapper.querySelector(".fx-dwave__plate");
  if (leftTexts.length === 0 || rightTexts.length === 0) return resting;

  let currentImage = null;
  let leftRange = { minX: 0, maxX: 0 };
  let rightRange = { minX: 0, maxX: 0 };
  let observer = null;
  let ro = null;

  // Upstream's quickTo setters. Each one owns its element's x for the life of
  // the mount, which is what keeps a per-frame write from fighting the tween
  // already running on the same property. gsap.quickTo hands back the setter
  // itself; anime hangs it off the animatable as .x, so the objects are kept
  // for revert() and the setters read off them.
  const makeAnimatable = (text) => createAnimatable(text, { x: { duration: DURATION, ease: EASE } });
  const animatables = [...leftTexts, ...rightTexts].map(makeAnimatable);
  const leftQuickSetters = animatables.slice(0, leftTexts.length).map((a) => a.x);
  const rightQuickSetters = animatables.slice(leftTexts.length).map((a) => a.x);

  // calculateRanges(). The slack in a column is its width minus its widest
  // line, so the widest line is the one that can only just reach the far edge.
  // The max(0) is ours: on a column narrower than its own widest line the
  // slack goes negative, and upstream then drives every line the wrong way,
  // out through the side of the section. Parked is the right answer there.
  const calculateRanges = () => {
    const maxLeftTextWidth = Math.max(...leftTexts.map((t) => t.offsetWidth));
    const maxRightTextWidth = Math.max(...rightTexts.map((t) => t.offsetWidth));

    leftRange = { minX: 0, maxX: Math.max(0, leftColumn.offsetWidth - maxLeftTextWidth) };
    rightRange = { minX: 0, maxX: Math.max(0, rightColumn.offsetWidth - maxRightTextWidth) };
  };

  // calculateWavePosition().
  const calculateWavePosition = (index, globalProgress, minX, range) => {
    const phase =
      config.waveNumber * index +
      config.waveSpeed * globalProgress * Math.PI * 2 -
      Math.PI / 2;
    const wave = Math.sin(phase);
    const cycleProgress = (wave + 1) / 2;
    return minX + cycleProgress * range;
  };

  // setInitialPositions(). Upstream writes these with gsap.set; here the same
  // animatable that will tween the value writes it, with a duration of 0.
  const setInitialPositions = (texts, setters, range, multiplier) => {
    const rangeSize = range.maxX - range.minX;

    texts.forEach((text, index) => {
      const initialPhase = config.waveNumber * index - Math.PI / 2;
      const initialWave = Math.sin(initialPhase);
      const initialProgress = (initialWave + 1) / 2;
      const startX = (range.minX + initialProgress * rangeSize) * multiplier;

      setters[index](startX, 0);
    });
  };

  // findClosestToViewportCenter(). The two columns are always aligned row for
  // row, so one column decides the index for both.
  const findClosestToViewportCenter = () => {
    const viewportCenter = window.innerHeight / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    leftTexts.forEach((text, index) => {
      const rect = text.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenter - viewportCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  // updateColumn().
  const updateColumn = (texts, setters, range, progress, focusedIndex, multiplier) => {
    const rangeSize = range.maxX - range.minX;

    texts.forEach((text, index) => {
      const finalX =
        calculateWavePosition(index, progress, range.minX, rangeSize) * multiplier;

      setters[index](finalX);

      if (index === focusedIndex) {
        text.classList.add("is-focused");
      } else {
        text.classList.remove("is-focused");
      }
    });
  };

  // updateThumbnail(). Upstream swaps an <img>'s src between 24 logo files;
  // here data-image is a CSS image value written to --fx-img, so a site fills
  // the slot with url(/img/x.jpg) and the placeholder plates keep the swap
  // visible with nothing bundled.
  const updateThumbnail = (thumb, focusedText) => {
    if (!thumb || !focusedText) return;

    let newImage = focusedText.dataset.image;

    if (!newImage) {
      const focusedIndex = rightTexts.indexOf(focusedText);
      if (focusedIndex !== -1 && leftTexts[focusedIndex]) {
        newImage = leftTexts[focusedIndex].dataset.image;
      }
    }

    if (newImage && currentImage !== newImage) {
      currentImage = newImage;
      thumb.style.setProperty("--fx-img", newImage);
    }

    // Keep the plate centred in the viewport, clamped so it can still centre
    // on the first and last line.
    const wrapperRect = wrapper.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const thumbnailHeight = thumb.offsetHeight;
    const wrapperHeight = wrapper.offsetHeight;

    const idealY = viewportCenter - wrapperRect.top - thumbnailHeight / 2;

    const minY = -thumbnailHeight / 2;
    const maxY = wrapperHeight - thumbnailHeight / 2;
    const clampedY = Math.max(minY, Math.min(maxY, idealY));

    // Applied directly rather than tweened, for perfect scroll sync.
    thumb.style.transform = `translateY(${clampedY}px)`;
  };

  // handleScroll().
  const handleScroll = (globalProgress) => {
    const closestIndex = findClosestToViewportCenter();

    updateColumn(leftTexts, leftQuickSetters, leftRange, globalProgress, closestIndex, 1);
    updateColumn(rightTexts, rightQuickSetters, rightRange, globalProgress, closestIndex, -1);

    updateThumbnail(thumbnail, leftTexts[closestIndex]);
  };

  calculateRanges();
  setInitialPositions(leftTexts, leftQuickSetters, leftRange, 1);
  setInitialPositions(rightTexts, rightQuickSetters, rightRange, -1);

  // setupScrollTrigger(), with the two thresholds reversed for anime.
  observer = onScroll({
    target: wrapper,
    enter: "bottom top",
    leave: "top bottom",
    onUpdate: (self) => handleScroll(self.progress),
  });

  // Upstream recalculates the ranges on window resize. A section is also
  // resized by things a window resize never reports, so this watches the box.
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => calculateRanges());
    ro.observe(wrapper);
  }

  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      if ("waveNumber" in next) config.waveNumber = num(next.waveNumber, UPSTREAM.waveNumber);
      if ("waveSpeed" in next) config.waveSpeed = num(next.waveSpeed, UPSTREAM.waveSpeed);
      calculateRanges();
    },
    // Upstream's destroy() kills the ScrollTrigger and drops the resize
    // handler. It leaves the transforms and the focused class where they are,
    // because its page never tears the effect down; here they are cleared, so
    // a destroy mid-scroll gives the columns back as the markup reads.
    destroy() {
      observer?.revert();
      observer = null;
      ro?.disconnect();
      ro = null;
      for (const a of animatables) a.revert();
      for (const text of [...leftTexts, ...rightTexts]) {
        text.classList.remove("is-focused");
        text.style.transform = "";
      }
      if (thumbnail) {
        thumbnail.style.transform = "";
        thumbnail.style.removeProperty("--fx-img");
      }
      el.removeAttribute("data-fx-live");
    },
  };
}
