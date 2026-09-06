// 3DStackMotion
// The MIT License
// Copyright (c) 2009 - 2024 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/3DStackMotion
//
// card-stack-scroll: a port of Codrops' 3DStackMotion effect 1, commit
// 75cbda91ed26d31aeeb5a5b9887848e5a7005c7f, js/effect-1/stackMotionEffect.js
// with index.html and css/base.css for the deck it drives. Every card sits in
// the same grid cell inside a preserve-3d box tipped
// rotate3d(1,0,0,-25deg) rotate3d(0,1,0,50deg) rotate3d(0,0,1,25deg), and the
// scrollbar flies the whole deck through the camera: z from
// -2.65 * viewport width, minus another 3 percent of it per card, out to
// 1.4 * viewport width plus 3 percent per card counted from the back, while
// rotateZ turns -220 to 120 and rotateY settles at -30, each card 0.005s
// behind the one before it, all on power1 across a scroll range one and a half
// screens long.
//
// The rotate3d composition, both z expressions, the -220 / 120 / -30 turn, the
// 0.005 stagger, the power1 ease and the 'top center' + 150% range are
// upstream's. What is not: the driver is anime.js' onScroll instead of
// ScrollTrigger, imagesTotal counts the cards rather than the one-element
// array upstream accidentally measures, the opacity gate is gone and the deck
// is pinned while it flies.
//
// The resting state is the deck itself: cards stacked in the tipped box, drawn
// entirely by style.css. With the script blocked, the bundle pruned or reduced
// motion on, the section is a 3D stack of cards sitting still, which is a
// finished composition rather than an empty box.
import { createTimeline, onScroll, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "card-stack-scroll",
  version: "1.0.0",
  category: "scroll",
  needs: ["anime"],
  license: "MIT",
  options: {
    near: { type: "number", default: 1.4, description: "How far past the camera the deck ends, in viewport widths. Upstream's z end factor." },
    far: { type: "number", default: 2.65, description: "How far behind the camera the deck starts, in viewport widths. Upstream's z start factor." },
    stagger: { type: "number", default: 0.005, description: "Seconds each card trails the one before it. Upstream's stagger." },
  },
};

const UPSTREAM = { near: 1.4, far: 2.65, stagger: 0.005 };

// GSAP counts in seconds, anime.js in milliseconds. Upstream's stagger is
// written as its own number times this.
const SEC = 1000;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the tipped deck, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const wrapElement = el.querySelector(".fx-stack__wrap");
  const contentElement = el.querySelector(".fx-stack__content");
  const cards = contentElement ? [...contentElement.querySelectorAll(".fx-stack__card")] : [];
  if (!wrapElement || !cards.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  // Upstream's `this.imagesTotal`, counted properly. Its own line reads
  // `[this.contentElement.querySelectorAll('.card')].length`, an array holding
  // one NodeList, so the count is 1 whatever the deck holds and the per-card
  // term of the end position collapses.
  const imagesTotal = cards.length;
  let winsize = { width: window.innerWidth, height: window.innerHeight };
  let timeline = null;
  let observer = null;

  const scroll = () => {
    timeline?.revert();
    observer?.revert();

    timeline = createTimeline({ defaults: { ease: "outQuad" }, autoplay: false })
      .add(cards, {
        z: [
          (_, pos) => -settings.far * winsize.width - pos * 0.03 * winsize.width,
          (_, pos) => settings.near * winsize.width + (imagesTotal - pos - 1) * 0.03 * winsize.width,
        ],
      }, 0)
      .add(cards, {
        rotateY: -30,
        rotateZ: [-220, 120],
        delay: stagger(settings.stagger * SEC),
      }, 0);

    // ScrollTrigger start 'top center' with end '+=150%' is anime's enter
    // 'center top' with leave '-100% top': the range still opens when the
    // deck's top reaches the middle of the viewport, and it still runs for one
    // and a half screens, because centre minus 150 percent is minus 100.
    observer = onScroll({ target: wrapElement, enter: "center top", leave: "-100% top", sync: true }).link(timeline);
  };

  scroll();

  // Upstream throttles this at 100ms and rebuilds the timeline, because every
  // z value is measured in viewport widths.
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      winsize = { width: window.innerWidth, height: window.innerHeight };
      scroll();
    }, 100);
  };
  window.addEventListener("resize", onResize);
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      scroll();
    },
    destroy() {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      observer?.revert();
      observer = null;
      // revert() strips the inline transforms, which hands the deck back as
      // the stack style.css draws rather than leaving it frozen wherever the
      // scrollbar happened to be.
      timeline?.revert();
      timeline = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
