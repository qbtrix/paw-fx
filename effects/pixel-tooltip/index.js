// PixelGooeyTooltip
// The MIT License
// Copyright (c) 2009 - 2023 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/PixelGooeyTooltip
//
// pixel-tooltip: a port of Codrops' PixelGooeyTooltip effect 1, commit
// 60ade47c343adbe40bdfa1bb0210a898e03ca536, js/tooltip.js and js/index.js with
// css/tooltip.css for the cell grid. A tooltip does not fade in: its
// background is a grid of rows x cols cells, and each cell's delay is its own
// distance from the pointer divided by the page diagonal, times 1.8 seconds.
// The panel therefore assembles outward from wherever the pointer is, one
// 0.1s expo fade per cell, and takes itself apart the same way in reverse.
// The title and the description come in behind it at 0.4s, 0.2s each, 0.2s
// apart.
//
// The layout, the distance-to-delay formula, maximumDelay, both durations,
// the expo ease, the content stagger and the 40ms show / hide debounce are
// upstream's. What is not: the pairing (see deviations), the coordinate frame,
// and two decorations the pinned commit does not actually use.
//
// The resting state is the prose. Every tooltip is a plain element in the
// markup that style.css keeps at opacity 0 and pointer-events none, so with
// the script blocked, the bundle pruned or reduced motion on, the reader gets
// the paragraph with its terms marked -- and destroy() puts the cells back.
import { createTimeline, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "pixel-tooltip",
  version: "1.0.0",
  category: "cursor",
  needs: ["anime"],
  license: "MIT",
  options: {
    maximumDelay: { type: "number", default: 1.8, description: "Seconds the furthest cell waits before it appears. Upstream's maximumDelay." },
    duration: { type: "number", default: 0.1, description: "Seconds one cell takes to fade. Upstream's createDefaultTimeline duration." },
  },
};

const UPSTREAM = { maximumDelay: 1.8, duration: 0.1 };

// GSAP counts in seconds, anime.js in milliseconds. Every upstream duration
// and delay below is written as upstream's own number times this.
const SEC = 1000;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the prose is the content and
  // a panel assembling out of the pointer is the motion this visitor declined.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const triggers = [...el.querySelectorAll(".fx-tip__trigger")];
  const tips = [...el.querySelectorAll(".fx-tip__tip")];
  if (!triggers.length || triggers.length !== tips.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  const bound = [];

  // #layout(): rows x cols cells, and the two custom properties the grid reads.
  const layout = (tip) => {
    const rows = parseInt(tip.el.dataset.rows, 10) || 4;
    const cols = parseInt(tip.el.dataset.cols, 10) || 4;
    let strHTML = "";
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) strHTML += "<span></span>";
    }
    tip.bg.innerHTML = strHTML;
    tip.el.style.setProperty("--fx-tt-columns", cols);
    tip.el.style.setProperty("--fx-tt-rows", rows);
    tip.cells = [...tip.bg.querySelectorAll("span")];
  };

  // calculateTooltipPosition(): the pointer, clamped so the panel stays inside
  // its frame. Upstream's frame is the document; here it is the section, so
  // the same four corrections are applied against the section's box.
  const updatePosition = (tip, event) => {
    const frame = el.getBoundingClientRect();
    const width = tip.el.offsetWidth;
    const height = tip.el.offsetHeight;
    let left = event.clientX - frame.left;
    let top = event.clientY - frame.top;
    if (left + width > frame.width) left = left - width;
    if (top + height > frame.height) top = top - height;
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    tip.el.style.left = `${left}px`;
    tip.el.style.top = `${top}px`;
  };

  // animateEffect1(): every cell's delay is its distance from the pointer over
  // the frame's diagonal, times maximumDelay.
  const animateEffect1 = (tip, event) => {
    tip.tl?.cancel();
    const isOpen = tip.isOpen;
    const mousePosition = { x: event.clientX, y: event.clientY };
    const frame = el.getBoundingClientRect();
    const maximumDistance = Math.sqrt(frame.width * frame.width + frame.height * frame.height);

    if (isOpen) tip.el.classList.add("fx-tip__tip--show");

    tip.tl = createTimeline({
      defaults: { duration: settings.duration * SEC, ease: "outExpo" },
      onComplete: () => { if (!tip.isOpen) tip.el.classList.remove("fx-tip__tip--show"); },
    });

    for (const cell of tip.cells) {
      const cellRect = cell.getBoundingClientRect();
      const cellPosition = { x: cellRect.left, y: cellRect.top };
      const distance = Math.sqrt(
        Math.pow(cellPosition.x - mousePosition.x, 2) + Math.pow(cellPosition.y - mousePosition.y, 2),
      );
      const delay = (distance / maximumDistance) * settings.maximumDelay * SEC;
      tip.tl.add(cell, isOpen ? { opacity: [0, 1], delay } : { opacity: 0, delay }, 0);
    }

    // animateTooltipContent(): the title and the description behind the panel.
    tip.tl.add([tip.title, tip.desc], {
      duration: 0.2 * SEC,
      opacity: isOpen ? [0, 1] : [1, 0],
      delay: isOpen ? stagger(0.2 * SEC) : 0,
    }, isOpen ? 0.4 * SEC : 0);
  };

  const toggle = (tip, event) => {
    tip.isOpen = !tip.isOpen;
    animateEffect1(tip, event);
  };

  triggers.forEach((triggerEl, i) => {
    const tipEl = tips[i];
    const tip = {
      el: tipEl,
      bg: tipEl.querySelector(".fx-tip__bg"),
      title: tipEl.querySelector(".fx-tip__title"),
      desc: tipEl.querySelector(".fx-tip__desc"),
      isOpen: false,
      tl: null,
    };
    if (!tip.bg || !tip.title || !tip.desc) return;
    layout(tip);

    let showTimeout;
    let hideTimeout;
    // Upstream's 40ms debounce on both edges: a pointer crossing a term on its
    // way somewhere else should not fire the whole assembly.
    const onEnter = (event) => {
      clearTimeout(hideTimeout);
      showTimeout = setTimeout(() => {
        if (tip.isOpen) return;
        updatePosition(tip, event);
        toggle(tip, event);
      }, 40);
    };
    const onMove = (event) => { if (tip.isOpen) updatePosition(tip, event); };
    const onLeave = (event) => {
      clearTimeout(showTimeout);
      hideTimeout = setTimeout(() => { if (tip.isOpen) toggle(tip, event); }, 40);
    };

    triggerEl.addEventListener("mouseenter", onEnter);
    triggerEl.addEventListener("mousemove", onMove);
    triggerEl.addEventListener("mouseleave", onLeave);
    bound.push({ triggerEl, tip, onEnter, onMove, onLeave, clear: () => { clearTimeout(showTimeout); clearTimeout(hideTimeout); } });
  });

  if (!bound.length) return resting;
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      for (const b of bound) {
        b.clear();
        b.triggerEl.removeEventListener("mouseenter", b.onEnter);
        b.triggerEl.removeEventListener("mousemove", b.onMove);
        b.triggerEl.removeEventListener("mouseleave", b.onLeave);
        b.tip.tl?.revert();
        b.tip.el.classList.remove("fx-tip__tip--show");
        b.tip.el.style.removeProperty("left");
        b.tip.el.style.removeProperty("top");
        b.tip.el.style.removeProperty("--fx-tt-columns");
        b.tip.el.style.removeProperty("--fx-tt-rows");
        b.tip.bg.innerHTML = "";
        // removeProperty, not a set to "": anime parses an empty value as zero
        // and writes `opacity: 0` back onto the title and the description,
        // which is the one piece of residue a destroy must not leave.
        b.tip.title.style.removeProperty("opacity");
        b.tip.desc.style.removeProperty("opacity");
      }
      bound.length = 0;
      el.removeAttribute("data-fx-live");
    },
  };
}
