// anime.js
// The MIT License
// Copyright (c) 2025 Julian Garnier
// https://github.com/juliangarnier/anime
//
// pin-progress: a port of anime.js' onscroll-sticky example, commit
// 01b81be1df6843ccfe0a71c0699a746bf740dd77, examples/onscroll-sticky/index.js.
// The section pins while you scroll and the scrollbar drives a card stack
// through a flip: the stack turns rotateY -180 -> 0 on in(2), each spinner
// unwinds rotateZ to stagger([0,-360], {from:'last'}) on inOut(2) with its
// transformOrigin moving 50% 100% -> 50% 50%, and every card rises to y -60%
// over 400ms. Timeline defaults are upstream's: linear, 500ms, composition
// 'blend', scroll range enter 'top top' to leave 'bottom bottom' at sync .5.
// The per-spinner start scatter -- utils.random(-1, 1, 2) on rotate and
// rotateZ, z: i, and the -.5 * (n - 1 - i) card offset -- is upstream's too,
// as are the two brightness staggers on the faces and the -70% / -60% hover.
//
// The resting state is the timeline's END state, drawn in style.css: fronts
// facing the reader, cards at -60%, spinners unwound. That ordering is the
// point. With the script blocked the deck is already the finished card; this
// file scatters it and lets the scrollbar put it back.
import { animate, createScope, createTimeline, onScroll, stagger, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "pin-progress",
  version: "1.0.0",
  category: "scroll",
  needs: ["anime"],
  license: "MIT",
  options: {
    sync: { type: "number", default: 0.5, description: "How closely the timeline tracks the scrollbar. Upstream's onScroll sync." },
    enter: { type: "string", default: "top top", description: "Where the pinned range starts. Upstream's onScroll enter." },
    leave: { type: "string", default: "bottom bottom", description: "Where the pinned range ends. Upstream's onScroll leave." },
  },
};

const UPSTREAM = { sync: 0.5, enter: "top top", leave: "bottom bottom" };

const brightness = (v) => `brightness(${v})`;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the landed stack, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const $cards = [...el.querySelectorAll(".fx-pin__card")];
  const $spinners = [...el.querySelectorAll(".fx-pin__spinner")];
  const track = el.querySelector(".fx-pin__track") || el;
  if (!$cards.length || $cards.length !== $spinners.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let scope;

  const build = () => {
    scope = createScope({ root: el }).add(() => {
      // Upstream's per-spinner scatter, verbatim. This is the START state, so
      // it is written here rather than in the stylesheet.
      $spinners.forEach(($spinner, i) => {
        const rotate = utils.random(-1, 1, 2);
        const rotateZ = utils.random(-1, 1, 2);
        const yOffset = -0.5 * ($spinners.length - 1 - i);
        utils.set($spinner, { rotate, rotateZ, z: i });
        utils.set($cards[i], { translateY: yOffset });
      });

      utils.set(el.querySelectorAll(".fx-pin__face--front"), { filter: stagger([0.75, 1], { modifier: brightness }) });
      utils.set(el.querySelectorAll(".fx-pin__face--back"), { filter: stagger([1, 0.75], { modifier: brightness }) });

      createTimeline({
        defaults: {
          ease: "linear",
          duration: 500,
          composition: "blend",
        },
        autoplay: onScroll({
          target: track,
          enter: settings.enter,
          leave: settings.leave,
          sync: settings.sync,
        }),
      })
        .add(el.querySelector(".fx-pin__stack"), {
          rotateY: [-180, 0],
          ease: "in(2)",
        }, 0)
        .add($spinners, {
          rotate: 0,
          rotateZ: { to: stagger([0, -360], { from: "last" }), ease: "inOut(2)" },
          transformOrigin: ["50% 100%", "50% 50%"],
          delay: stagger(1, { from: "first" }),
        }, 0)
        .add($cards, {
          y: { to: "-60%", duration: 400 },
          delay: stagger(1, { from: "first" }),
        }, 0)
        .init();

      $cards.forEach(($card) => {
        $card.onmouseenter = () => animate($card, {
          y: "-70%", duration: 350, composition: "blend",
        });
        $card.onmouseleave = () => animate($card, {
          y: "-60%", duration: 750, composition: "blend", delay: 75,
        });
      });
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // The scope owns the timeline, the scroll observer and every utils.set,
    // because each registers itself on construction; revert() cancels them and
    // strips the inline styles, dropping the stack back to the CSS end state.
    // The two handlers are assigned properties rather than listeners, so they
    // are not in the scope and have to be nulled by hand -- otherwise a
    // destroyed section still animates cards under the pointer.
    $cards.forEach(($card) => { $card.onmouseenter = null; $card.onmouseleave = null; });
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
