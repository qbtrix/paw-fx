// Codrops Sketches
// MIT License
// Copyright (c) 2022 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/codrops-sketches
//
// loop-scroll-gallery: a port of sketches 024 and 025 from codrops-sketches,
// commit bbf47ca34766fd2ca5f97d8b376d2eca148bf48f. The whole trick upstream is
// two things and no more:
//
//   const lenis = new Lenis({ smooth: true, infinite: true });
//   repeatItems(document.querySelector('.grid'), 6);   // 4 in the horizontal
//
// repeatItems below is upstream's function, unchanged apart from marking each
// clone so destroy() can take exactly its own back out. `infinite` is Lenis'
// own flag -- it wraps the scroll position with modulo(animatedScroll, limit) --
// so nothing here re-implements the loop.
//
// WHAT MAKES THE SEAM INVISIBLE, because it is arithmetic and not taste.
// Lenis wraps from scrollTop = limit straight to 0, so the last viewport-worth
// of content has to be pixel-identical to the first. That holds exactly when
// the cloned block measures the same as the scroll viewport. Upstream's
// vertical demo clones six items into a three-column grid -- two rows -- and
// sizes each row so the pair comes to one screen: item height 47.5vh with a
// 5vh gap, which is its own comment's "for an item height of 50vh, remove half
// the gap". The horizontal demo clones four columns at 23.5vw with a 2vw gap,
// which is the same sum sideways. style.css keeps that relationship as a
// calc() against the viewport box rather than as two magic numbers, so a site
// that changes the gap or the box height keeps a seamless loop.
//
// The one structural departure, and it is deliberate: upstream makes the whole
// PAGE infinite. Here Lenis is given the section's own scroll box through
// `wrapper` and `content`, because a section is not entitled to take over the
// document -- paw-fx already ships smooth-scroll for that, and two Lenis
// instances fighting over one scroll position is the bug that follows.
//
// The resting state is a plain native scroll box holding the gallery. With the
// script blocked, the bundle pruned or reduced motion on, the reader still
// gets every item and can still scroll through them; what they lose is the
// wrap at the end, which is the effect and not the content.
import Lenis from "../../vendor/lenis.js";

export const meta = {
  name: "loop-scroll-gallery",
  version: "1.0.0",
  category: "gallery",
  needs: ["lenis"],
  license: "MIT",
  options: {
    orientation: { type: "string", default: "vertical", description: "vertical is sketch 024, horizontal is sketch 025." },
    lerp: { type: "number", default: 0.1, description: "Linear interpolation per frame. Lower is heavier. Lenis' own default." },
  },
};

// Upstream clones six items in the vertical demo and four in the horizontal
// one. Both numbers are the count that makes the cloned block one viewport.
const CLONES = { vertical: 6, horizontal: 4 };
const orientationOf = (v) => (v === "horizontal" ? "horizontal" : "vertical");

// codrops-sketches 024/025, verbatim, plus the clone marker.
const repeatItems = (parentEl, total = 0) => {
  const items = [...parentEl.children];
  for (let i = 0; i <= total - 1; ++i) {
    if (!items[i]) break;
    var cln = items[i].cloneNode(true);
    // Not upstream: a clone is the same picture again, so it is hidden from
    // assistive technology, and the attribute is how destroy() finds it.
    cln.setAttribute("data-fx-clone", "");
    cln.setAttribute("aria-hidden", "true");
    parentEl.appendChild(cln);
  }
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the scroll box in style.css
  // is already a working gallery, so leaving it alone is the correct outcome.
  // Lenis is never constructed rather than constructed and stopped, because a
  // stopped instance still holds its wheel and touch listeners.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const viewport = el.querySelector(".fx-loopgal__viewport");
  const grid = el.querySelector(".fx-loopgal__grid");
  if (!viewport || !grid) return resting;

  const settings = { orientation: "vertical", lerp: 0.1, ...opts };
  let lenis = null;

  const build = () => {
    const orientation = orientationOf(settings.orientation);
    // style.css sizes the cells off this, and the sizing is what makes the
    // wrap seamless, so it goes on before anything is cloned or measured.
    el.setAttribute("data-fx-orientation", orientation);
    repeatItems(grid, CLONES[orientation]);
    try {
      lenis = new Lenis({
        wrapper: viewport,
        content: grid,
        infinite: true,
        orientation,
        // Upstream's horizontal demo passes gestureDirection: 'both' so a
        // vertical wheel still drives it. Lenis derives exactly that from the
        // orientation now, but it is named here because it is upstream's.
        gestureOrientation: orientation === "horizontal" ? "both" : "vertical",
        lerp: settings.lerp,
        autoRaf: true,
      });
    } catch {
      // A Lenis that will not construct leaves a native scroll box behind,
      // which is the resting state and still a working gallery.
      lenis = null;
    }
  };

  const tear = () => {
    lenis?.destroy();
    lenis = null;
    for (const clone of grid.querySelectorAll("[data-fx-clone]")) clone.remove();
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
      tear();
      el.removeAttribute("data-fx-live");
      el.removeAttribute("data-fx-orientation");
    },
  };
}
