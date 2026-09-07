// Sticky Sections
// MIT License
// Copyright (c) 2009 - 2024 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/StickySections
//
// sticky-sections: a port of Codrops' Sticky Sections, demo 1, commit
// 69c788898216d94a796a21c87adc475f3a3f73f5, js/demo1/index.js and the
// .content--sticky / .content--grid block of css/base.css.
//
// The structure is CSS: consecutive `position: sticky; top: 0; height: 100vh`
// siblings pin in turn, so each one holds the viewport while the next scrolls
// up over it. The script only adds the exit treatment, scrubbed by the
// scrollbar over exactly one viewport of travel per panel:
//
//   the panel   filter brightness(100%) contrast(100%)
//                   -> brightness(60%) contrast(135%),  yPercent -15, linear
//   its image   yPercent -40, rotation -20,             power1.in
//
// so a panel dims, cools and drifts up as its successor covers it, while the
// image inside it slides further and tips over. Every one of those numbers is
// upstream's, as is the last-panel exception: the final section neither dims
// nor moves, because there is nothing arriving to cover it.
//
// GSAP's ScrollTrigger `start: 'top top'`, `end: '+=100%'`, `scrub: true`
// becomes anime's onScroll `enter: 'top top'`, `leave: 'top bottom'`,
// `sync: true`. The mapping is exact for a 100svh panel: the panel's bottom
// reaching the container's top is one viewport of scroll after its top
// reached it, and anime's sync of 1 applies no smoothing lerp, which is what
// scrub: true means. anime's ScrollObserver measures
// a sticky target by setting it to `static` for the measurement and reverting,
// so the pinned element still reports its position in the flow -- the same
// thing ScrollTrigger does, and the reason the panel can be its own trigger.
//
// Upstream also boots Lenis for smooth scrolling and drives ScrollTrigger from
// its scroll event. That is not part of this effect: paw-fx ships smooth-scroll
// as its own effect, and a section that hijacks the page's scrolling because it
// happens to be on the page is a bad neighbour. onScroll reads native scroll.
//
// The resting state is every panel at full brightness with its image square:
// the stack still stacks, because that is CSS, and all the copy is readable.
// Nothing here is hidden behind the scrub.
import { createTimeline, onScroll } from "../../vendor/anime.esm.js";

export const meta = {
  name: "sticky-sections",
  version: "1.0.0",
  category: "scroll",
  needs: ["anime"],
  license: "MIT",
  options: {
    brightness: { type: "number", default: 60, description: "Percent brightness a panel dims to as the next one covers it. Upstream's brightness(60%)." },
    contrast: { type: "number", default: 135, description: "Percent contrast a panel is pushed to as it dims. Upstream's contrast(135%)." },
    lift: { type: "number", default: -15, description: "Percent of its own height a panel drifts up by. Upstream's yPercent: -15." },
    imageLift: { type: "number", default: -40, description: "Percent of its own height the image inside a panel drifts up by. Upstream's yPercent: -40." },
    imageRotate: { type: "number", default: -20, description: "Degrees the image tips over by. Upstream's rotation: -20." },
  },
};

// demo1/index.js scroll(), verbatim.
const UPSTREAM = { brightness: 60, contrast: 135, lift: -15, imageLift: -40, imageRotate: -20 };

// A scrubbed timeline's own duration is never played, only seeked: the scroll
// range maps onto progress 0..1 whatever it is. GSAP's scrub has no equivalent
// number to carry over, so this is a nominal length both tweens share.
const SCRUB_DURATION = 100;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelectorAll !== "function") return resting;

  const contentElements = [...el.querySelectorAll(".fx-sticky__panel")];
  const totalContentElements = contentElements.length;
  if (!totalContentElements) return resting;
  // A reader who asked for stillness gets the stack the stylesheet already
  // builds: every panel at full brightness, every image square, all the copy
  // readable. The scrub is a treatment on top of a layout that already works.
  if (reducedMotion() || typeof window === "undefined") return resting;

  const settings = { ...UPSTREAM, ...opts };
  const timelines = [];

  // demo1/index.js scroll()
  contentElements.forEach((panel, position) => {
    const isLast = position === totalContentElements - 1;

    const tl = createTimeline({
      defaults: { duration: SCRUB_DURATION },
      autoplay: onScroll({
        target: panel,
        // Each threshold reads "<container edge> <target edge>", which is the
        // reverse of how it scans: "top bottom" is the TARGET's bottom
        // reaching the CONTAINER's top. Writing it the other way round makes
        // offsetEnd land before offsetStart, anime clamps the distance to 0,
        // and the whole thing silently never moves.
        enter: "top top",
        leave: "top bottom",
        sync: true,
      }),
    });

    // Upstream writes `filter: isLast ? 'none' : '...'` and `yPercent: isLast ? 0 : -15`,
    // which for the last panel is a tween from a value to itself -- and 'none'
    // is not a filter list, so it has no interpolation at all. Leaving the
    // panel alone is the same outcome without asking anime to animate to a
    // keyword.
    if (!isLast) {
      tl.add(panel, {
        ease: "linear",
        filter: [
          "brightness(100%) contrast(100%)",
          `brightness(${settings.brightness}%) contrast(${settings.contrast}%)`,
        ],
        y: `${settings.lift}%`,
      }, 0);
    }

    const img = panel.querySelector(".fx-sticky__img");
    if (img) {
      tl.add(img, {
        // GSAP's power scale is power1=Quad, power2=Cubic, power3=Quart, so
        // power1.in is inQuad.
        ease: "inQuad",
        y: `${settings.imageLift}%`,
        rotate: settings.imageRotate,
      }, 0);
    }

    tl.init();
    timelines.push(tl);
  });

  el.setAttribute("data-fx-live", "");

  return {
    // The timelines are bound to a scroll range at build time, so a changed
    // value applies on the next mount.
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      for (const tl of timelines) {
        // revert() removes the inline styles anime wrote and disposes the
        // ScrollObserver with them, which is what stops a destroyed section
        // from keeping a scroll listener alive.
        tl.revert();
      }
      timelines.length = 0;
      el.removeAttribute("data-fx-live");
    },
  };
}
