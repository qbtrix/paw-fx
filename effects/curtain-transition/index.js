// Codrops Sketches
// MIT License
// Copyright (c) 2022 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/codrops-sketches
//
// curtain-transition: a port of sketches 021 and 022 from codrops-sketches,
// commit bbf47ca34766fd2ca5f97d8b376d2eca148bf48f. A coloured curtain sweeps
// over the section with a curved leading edge that bulges and then flattens,
// swaps the view underneath at the moment it covers everything, and peels away
// again from the far side.
//
// THE MECHANISM IS ONE SVG PATH AND NOTHING ELSE. Upstream steps a single
// <path>'s `d` attribute through four hand-written states per direction --
// unfilled, a bulged in-between, filled, then the mirror on the way out --
// and every state in a pair shares an identical command sequence, so the
// numbers interpolate straight. The survey flagged that as an assumption; it
// was measured before this file was written, on the vendored anime build:
// tweening 'M 0 100 V 100 Q 50 100 100 100 V 100 z' to
// 'M 0 100 V 50 Q 50 0 100 50 V 100 z' reads
// 'M 0 100 V 75 Q 50 50 100 75 V 100 z' at the half way point, which is the
// exact midpoint of every number. No morph plugin, no svg.morphTo, no
// approximation -- the same numeric interpolation GSAP's attr plugin does.
//
// Both axes ship from the one sha: `vertical` is sketch 021, whose two
// directions use different in-between curves (curve1 out, curve2 back), and
// `horizontal` is sketch 022, which uses one in-between for both. Every path
// string, duration and easing below is copied from those two files.
//
// GSAP's powerN is degree N+1, so power4.in is inQuint, power3.in is inQuart,
// power1 (its .out default) is outQuad, power4 is outQuint and sine.in is
// inSine. Seconds become milliseconds against MS.
//
// The resting state is the first view, complete, with a working heading and
// copy. The curtain is an SVG that starts and ends collapsed to a line, so
// with the script blocked, the bundle pruned or reduced motion on it covers
// nothing. Under reduced motion the buttons still swap the views, instantly:
// stillness means no travel, not an unreachable second view.
import { createTimeline } from "../../vendor/anime.esm.js";

export const meta = {
  name: "curtain-transition",
  version: "1.0.0",
  category: "transition",
  needs: ["anime"],
  license: "MIT",
  options: {
    axis: { type: "string", default: "vertical", description: "vertical is upstream sketch 021, horizontal is sketch 022." },
  },
};

// Seconds upstream, milliseconds here.
const MS = 1000;

// 021 and 022, verbatim. `into` is the curve on the way in and `back` the one
// on the way out; 022 uses one in-between for both directions, so its two
// entries are the same string, which is upstream's own single `inBetween`.
const AXES = {
  // 021-svg-path-page-transition-vertical
  vertical: {
    viewBox: "0 0 100 100",
    rest: "M 0 100 V 100 Q 50 100 100 100 V 100 z",
    step1: {
      unfilled: "M 0 100 V 100 Q 50 100 100 100 V 100 z",
      into: "M 0 100 V 50 Q 50 0 100 50 V 100 z",
      back: "M 0 100 V 50 Q 50 100 100 50 V 100 z",
      filled: "M 0 100 V 0 Q 50 0 100 0 V 100 z",
    },
    step2: {
      filled: "M 0 0 V 100 Q 50 100 100 100 V 0 z",
      into: "M 0 0 V 50 Q 50 0 100 50 V 0 z",
      back: "M 0 0 V 50 Q 50 100 100 50 V 0 z",
      unfilled: "M 0 0 V 0 Q 50 0 100 0 V 0 z",
    },
    // durations in seconds, as upstream writes them
    timing: [0.8, 0.2, 0.2, 1],
    // power4.in, power1, sine.in, power4
    eases: ["inQuint", "outQuad", "inSine", "outQuint"],
  },
  // 022-svg-path-page-transition-horizontal
  horizontal: {
    viewBox: "0 0 100 100",
    rest: "M 0 0 h 0 c 0 50 0 50 0 100 H 0 V 0 Z",
    step1: {
      unfilled: "M 0 0 h 0 c 0 50 0 50 0 100 H 0 V 0 Z",
      into: "M 0 0 h 33 c -30 54 113 65 0 100 H 0 V 0 Z",
      back: "M 0 0 h 33 c -30 54 113 65 0 100 H 0 V 0 Z",
      filled: "M 0 0 h 100 c 0 50 0 50 0 100 H 0 V 0 Z",
    },
    step2: {
      filled: "M 100 0 H 0 c 0 50 0 50 0 100 h 100 V 50 Z",
      into: "M 100 0 H 50 c 28 43 4 81 0 100 h 50 V 0 Z",
      back: "M 100 0 H 50 c 28 43 4 81 0 100 h 50 V 0 Z",
      unfilled: "M 100 0 H 100 c 0 50 0 50 0 100 h 0 V 0 Z",
    },
    // power3.in, power1, sine.in, power4
    timing: [0.8, 0.2, 0.15, 1],
    eases: ["inQuart", "outQuad", "inSine", "outQuint"],
  },
};

const axisOf = (v) => (v === "horizontal" ? "horizontal" : "vertical");

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  // Everything is looked up inside the section, never through document, so a
  // page carrying this section twice gets two independent curtains.
  const path = el.querySelector(".fx-curtain__path");
  const second = el.querySelector(".fx-curtain__view--2");
  const openCtrl = el.querySelector(".fx-curtain__open");
  const closeCtrl = el.querySelector(".fx-curtain__close");
  if (!path || !second || !openCtrl || !closeCtrl) return resting;

  const settings = { axis: "vertical", ...opts };
  let spec = AXES[axisOf(settings.axis)];
  let timeline = null;
  // Upstream's two module-level flags.
  let isAnimating = false;
  let page = 1;

  // Upstream's switchPages(), minus the .frame class it also toggles: that is
  // its demo page's own header, which a section does not have.
  const switchPages = () => {
    second.classList.toggle("fx-curtain__view--open", page === 2);
    openCtrl.setAttribute("aria-expanded", page === 2 ? "true" : "false");
    // Not upstream: the view that is off is out of the tab order and out of
    // the accessibility tree, so a keyboard cannot land on invisible copy.
    second.toggleAttribute("inert", page !== 2);
  };

  // Upstream's reveal() and unreveal() are the same six steps with the two
  // steps swapped and the other in-between curve, so they are one function
  // here. Nothing else differs between them.
  const run = (to) => {
    if (isAnimating) return;
    isAnimating = true;
    page = to;
    const forward = to === 2;
    const from = forward ? spec.step1 : spec.step2;
    const dest = forward ? spec.step2 : spec.step1;
    const curve = forward ? "into" : "back";
    const [d1, d2, d3, d4] = spec.timing;
    const [e1, e2, e3, e4] = spec.eases;

    timeline?.revert();
    timeline = createTimeline({ onComplete: () => { isAnimating = false; } })
      .set(path, { d: from.unfilled })
      .add(path, { d: from[curve], duration: d1 * MS, ease: e1 }, 0)
      .add(path, { d: from.filled, duration: d2 * MS, ease: e2, onComplete: () => switchPages() })
      .set(path, { d: dest.filled })
      .add(path, { d: dest[curve], duration: d3 * MS, ease: e3 })
      .add(path, { d: dest.unfilled, duration: d4 * MS, ease: e4 });
  };

  // Stillness means no travel, not an unreachable second view: the swap still
  // happens, the curtain simply never moves.
  const still = (to) => { page = to; switchPages(); };

  const onOpen = () => (reducedMotion() ? still(2) : run(2));
  const onClose = () => (reducedMotion() ? still(1) : run(1));

  const build = () => {
    spec = AXES[axisOf(settings.axis)];
    el.setAttribute("data-fx-axis", axisOf(settings.axis));
    path.setAttribute("d", spec.rest);
  };
  build();
  switchPages();

  openCtrl.addEventListener("click", onOpen);
  closeCtrl.addEventListener("click", onClose);
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      timeline?.revert();
      timeline = null;
      isAnimating = false;
      build();
    },
    destroy() {
      openCtrl.removeEventListener("click", onOpen);
      closeCtrl.removeEventListener("click", onClose);
      // revert() cancels the timeline and puts the path attribute back, so a
      // destroy mid-sweep leaves the curtain collapsed rather than frozen
      // half way across the section.
      timeline?.revert();
      timeline = null;
      path.setAttribute("d", spec.rest);
      // The section is handed back in its resting state: first view, second
      // view closed and inert, no live marker.
      page = 1;
      switchPages();
      el.removeAttribute("data-fx-live");
      el.removeAttribute("data-fx-axis");
    },
  };
}
