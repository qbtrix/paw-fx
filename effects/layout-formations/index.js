// On Scroll Layout Formations
// MIT License
// Copyright (c) 2009 - 2024 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/OnScrollLayoutFormations
//
// layout-formations: a port of Codrops' OnScrollLayoutFormations, commit
// 68910ecf85275bdd7e4d0e47013ba4bf9ec94bde, the fourth formation in
// js/index.js -- animateFourthGrid plus the calculateInitialTransform helper
// it depends on -- and the .grid rules in css/base.css.
//
// Thirty-six panels scattered through depth converge into a flat grid as the
// section is scrolled. calculateInitialTransform is upstream's, unchanged: for
// each panel it takes the angle from the centre of the viewport, pushes the
// panel 250px out along it, rotates it up to 300 degrees and drops it up to
// 2000px back in z -- all three scaled by how far from the centre the panel
// sits, so the middle of the grid barely moves and the corners come from a
// long way away. rotateX is halved on the way in, which is upstream's *.5, and
// the whole thing arrives staggered 0.2s from the centre outwards across a 4
// by 9 stagger grid.
//
// Only the fourth formation is ported; see meta.json deviations for the other
// eight and why.
//
// The pin is not GSAP's. ScrollTrigger's `pin` is replaced by the sticky stage
// paw-fx already uses in pin-progress -- a tall track with a sticky child --
// so the scroll range is CSS and anime's onScroll only has to read it. That is
// also why the section clips with overflow-x: clip and never overflow: hidden:
// hidden computes overflow-y to auto, makes the section a scroll container,
// and a sticky stage inside one never sticks.
//
// The resting state is the animation's END state, drawn in style.css: a flat,
// finished grid at full opacity and scale. With the script blocked, the bundle
// pruned or reduced motion on, that grid is what the reader gets, and this
// file's job is to scatter it and let the scrollbar put it back. A grid whose
// cells are invisible until a scroll animation runs is a broken grid.
//
// No image ships with this effect. Codrops' 42 demo photographs are theirs, so
// every panel paints a CSS gradient until a site sets --fx-img on it; see
// snippet.html.
import { createScope, createTimeline, onScroll, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "layout-formations",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    offsetDistance: { type: "number", default: 250, description: "How far each panel starts from where it lands, in px along the angle from centre. Upstream's calculateInitialTransform offsetDistance." },
    maxRotation: { type: "number", default: 300, description: "Degrees of rotation for the panels furthest from centre. Upstream's maxRotation." },
    maxZTranslation: { type: "number", default: 2000, description: "How far back in z the furthest panels start, in px. Upstream's maxZTranslation." },
    sync: { type: "number", default: 0.2, description: "How closely the formation tracks the scrollbar. Upstream's ScrollTrigger scrub." },
  },
};

const UPSTREAM = { offsetDistance: 250, maxRotation: 300, maxZTranslation: 2000, sync: 0.2 };

// GSAP counts stagger spread in seconds and anime.js in milliseconds.
const SECOND = 1000;

/**
 * Calculates the initial translation and 3D rotation of an element, moving and rotating it further away from the center of the screen.
 * The rotation and Z-axis translation are proportional to the distance from the center, with elements near the center rotating less and moving less in Z.
 *
 * Upstream's, with one substitution: the centre is the pinned stage's box
 * rather than window.innerWidth / innerHeight. While the stage is stuck those
 * are the same rectangle, and offsetLeft / offsetTop are measured against the
 * stage anyway, so reading the stage is the version that stays correct at any
 * width and before the stage has been stuck.
 *
 * @param {Element} element - The DOM element to calculate the translation and rotation for
 * @param {{width: Number, height: Number}} stage - the pinned stage's box
 * @param {Number} offsetDistance - The distance by which the element will be moved away from the center (default: 250px)
 * @param {Number} maxRotation - The maximum rotation in degrees for farthest elements (default: 300 degrees)
 * @param {Number} maxZTranslation - The maximum Z-axis translation in pixels for farthest elements (default: 2000px)
 * @returns {Object} The x, y, z translation and rotateX, rotateY values as {x, y, z, rotateX, rotateY}
 */
const calculateInitialTransform = (element, stage, offsetDistance = 250, maxRotation = 300, maxZTranslation = 2000) => {
  const viewportCenter = { width: stage.width / 2, height: stage.height / 2 };
  const elementCenter = {
    x: element.offsetLeft + element.offsetWidth / 2,
    y: element.offsetTop + element.offsetHeight / 2,
  };

  // Calculate the angle between the center of the element and the center of the viewport
  const angle = Math.atan2(Math.abs(viewportCenter.height - elementCenter.y), Math.abs(viewportCenter.width - elementCenter.x));

  // Calculate the x and y translation based on the angle and distance
  const translateX = Math.abs(Math.cos(angle) * offsetDistance);
  const translateY = Math.abs(Math.sin(angle) * offsetDistance);

  // Calculate the maximum possible distance from the center (diagonal of the viewport)
  const maxDistance = Math.sqrt(Math.pow(viewportCenter.width, 2) + Math.pow(viewportCenter.height, 2));

  // Calculate the current distance from the center
  const currentDistance = Math.sqrt(Math.pow(viewportCenter.width - elementCenter.x, 2) + Math.pow(viewportCenter.height - elementCenter.y, 2));

  // Scale rotation and Z-translation based on distance from the center (closer elements rotate/translate less, farther ones rotate/translate more)
  const distanceFactor = currentDistance / maxDistance;

  // Calculate the rotation values based on the position relative to the center
  const rotationX = ((elementCenter.y < viewportCenter.height ? -1 : 1) * (translateY / offsetDistance) * maxRotation * distanceFactor);
  const rotationY = ((elementCenter.x < viewportCenter.width ? 1 : -1) * (translateX / offsetDistance) * maxRotation * distanceFactor);

  // Calculate the Z-axis translation (depth) based on the distance from the center
  const translateZ = maxZTranslation * distanceFactor;

  // Determine direction based on position relative to the viewport center
  return {
    x: elementCenter.x < viewportCenter.width ? -translateX : translateX,
    y: elementCenter.y < viewportCenter.height ? -translateY : translateY,
    z: translateZ,
    rotateX: rotationX,
    rotateY: rotationY,
  };
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the finished formation, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const track = el.querySelector(".fx-formations__track");
  const stage = el.querySelector(".fx-formations__stage");
  const panels = [...el.querySelectorAll(".fx-formations__panel")];
  if (!track || !stage || !panels.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let scope = null;

  const build = () => {
    scope = createScope({ root: el }).add(() => {
      const box = { width: stage.clientWidth, height: stage.clientHeight };
      // Measured once per build rather than four times per panel: upstream
      // calls calculateInitialTransform separately for x, y, z, rotateX and
      // rotateY, which recomputes the same five numbers five times.
      const start = panels.map((panel) =>
        calculateInitialTransform(panel, box, settings.offsetDistance, settings.maxRotation, settings.maxZTranslation));

      // animateFourthGrid. The stagger amount is a total spread in GSAP and a
      // per-step delay in anime, so 0.2s is divided by the gaps between the
      // thirty-six panels.
      createTimeline({
        defaults: { ease: "outExpo" },
        autoplay: onScroll({
          target: track,
          enter: "top top",
          leave: "bottom bottom",
          sync: settings.sync,
        }),
      }).add(panels, {
        x: { from: (_, i) => start[i].x, to: 0 },
        y: { from: (_, i) => start[i].y, to: 0 },
        z: { from: (_, i) => start[i].z, to: 0 },
        rotateX: { from: (_, i) => start[i].rotateX * 0.5, to: 0 },
        rotateY: { from: (_, i) => start[i].rotateY, to: 0 },
        opacity: [0, 1],
        scale: [0.7, 1],
        delay: stagger((0.2 * SECOND) / Math.max(1, panels.length - 1), {
          from: "center",
          grid: [4, 9],
        }),
      }).init();
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // The scope owns the timeline and the scroll observer, because both
    // registered themselves when they were constructed. revert() cancels them
    // and strips the inline transforms, dropping the panels back to the flat
    // CSS grid rather than freezing them wherever the scrollbar happened to be.
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
