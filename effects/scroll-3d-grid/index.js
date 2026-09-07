// Scroll 3D Grid
// MIT License
// Copyright (c) 2009 - 2023 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/Scroll3DGrid
//
// scroll-3d-grid: a port of Codrops' Scroll3DGrid, commit
// 69718a2eff87b32ab19764b3a6d7b3773dab6af3, the type1 branch of applyAnimation
// in js/index.js plus the .grid / .grid-wrap / .grid__item rules in
// css/base.css.
//
// A wall of thumbnails set on a plane turned 25 degrees away from the reader,
// each one parked at its own random depth between -1600 and 200. Scroll and
// the whole wall sweeps sideways through that perspective: every panel travels
// from somewhere between -1000% and -500% to somewhere between 500% and 1000%,
// so they pass the reader at different times and different distances, while
// each panel's image un-zooms from 2 to 0.5 inside its own crop. Linear, and
// tied to the scrollbar rather than to a clock, which is what makes it read as
// a camera move rather than as an animation.
//
// Every number above is upstream's type1 branch, unchanged, including the
// perspective of 1000px and the inner scale of 0.5 that branch sets on the
// grid before it starts.
//
// The scroll range is upstream's too: it runs from the moment the wall enters
// the viewport to the moment it leaves, so the wall is centred and legible
// exactly when the section is centred. That is why nothing here waits for an
// observer -- the composition IS the middle of the range.
//
// The resting state is the wall standing still on its turned plane at x 0,
// drawn in style.css. With the script blocked, the bundle pruned or reduced
// motion on, the reader gets that composition; this file scatters the depths
// and hands the sweep to the scrollbar.
//
// No image ships with this effect. Codrops' 49 demo photographs are theirs, so
// every panel paints a CSS gradient until a site sets --fx-img on it; see
// snippet.html.
import { createScope, createTimeline, onScroll, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "scroll-3d-grid",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    depth: { type: "number", default: -1600, description: "Furthest z a panel can be parked at, in px. Upstream's random(-1600, 200) lower bound." },
    sweep: { type: "number", default: 1000, description: "How far a panel travels, as a percentage of its own width. Upstream sweeps from random(-1000,-500) to random(500,1000)." },
    innerScale: { type: "number", default: 2, description: "Zoom each panel's image starts at before it un-zooms to the resting 0.5. Upstream's gridItemsInner scale." },
  },
};

const UPSTREAM = { depth: -1600, sweep: 1000, innerScale: 2 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the wall on its turned plane, which is the composition this sweep passes
  // through rather than something it builds.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const wrap = el.querySelector(".fx-grid3d__wrap");
  const items = [...el.querySelectorAll(".fx-grid3d__item")];
  const inners = items.map((item) => item.querySelector(".fx-grid3d__inner")).filter(Boolean);
  if (!wrap || !items.length || inners.length !== items.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let scope = null;

  const build = () => {
    scope = createScope({ root: el }).add(() => {
      // applyAnimation type1's `.set(gridItems, {z: () => random(-1600,200)})`.
      // This is the START state and it is per-element random, so it belongs
      // here rather than in the stylesheet.
      utils.set(items, { z: () => utils.random(settings.depth, 200) });

      createTimeline({
        defaults: { ease: "linear" },
        // enter and leave are left at anime's defaults, 'end start' and
        // 'start end', because in its own spelling -- container first, target
        // second -- those ARE upstream's range: the run opens when the wall's
        // top reaches the bottom of the viewport and closes when its bottom
        // reaches the top. Naming them here in GSAP's order instead reverses
        // the range, and a reversed range does not error: it pins progress and
        // leaves every panel frozen at its start transform through the whole
        // section. Measured that way before it was fixed.
        autoplay: onScroll({
          target: wrap,
          sync: true,
        }),
      })
        .add(items, {
          x: {
            from: () => `${utils.random(-settings.sweep, -(settings.sweep / 2))}%`,
            to: () => `${utils.random(settings.sweep / 2, settings.sweep)}%`,
          },
        }, 0)
        .add(inners, {
          scale: [settings.innerScale, 0.5],
        }, 0)
        .init();
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // The scope owns the timeline, the scroll observer and the depth scatter,
    // because each registered itself when it was constructed. revert() cancels
    // them and strips the inline transforms, which puts the wall back on its
    // plane at x 0 rather than freezing it wherever the scrollbar was.
    scope?.revert();
    scope = null;
  };

  return {
    update(next = {}) {
      if (!scope) return;
      Object.assign(settings, next);
      tear();
      build();
    },
    destroy() {
      tear();
      el.removeAttribute("data-fx-live");
    },
  };
}
