// anime.js
// The MIT License
// Copyright (c) 2025 Julian Garnier
// https://github.com/juliangarnier/anime
//
// reveal-stagger: a port of anime.js' onscroll-responsive-scope example,
// commit 01b81be1df6843ccfe0a71c0699a746bf740dd77,
// examples/onscroll-responsive-scope/index.js. Every timing, easing and
// stagger value below is that file's, both branches: out(3) at 500ms as the
// scope default, the landscape fan (transformOrigin 50% 150%, y from
// stagger(['-40vh','40vh'], {from:'center'}), rotate to stagger([-30,30]) on
// inOut(3) with delay stagger([0,950], {from:'last', start:200}), x from
// '-60vw' to stagger(['-20%','20%']), delay stagger(60, {from:'last'}) at
// 750ms) and the portrait one (y from '150vh', rotate from alternating
// ±20deg on inOut(3), delay stagger(50, {from:'last'})), scroll-linked with
// enter 'top', leave 'bottom' and sync .1.
//
// The resting state is the animation's END state, drawn in style.css, and the
// two are held together by the same media query upstream branches on. That
// ordering is the whole point: with the script blocked or pruned the deck is
// already the finished fan, and this file's job is to pull it off screen and
// hand it back as you scroll. A reveal that hides its own content and then
// waits for an observer that may never run is the bug this inverts.
import { animate, createScope, onScroll, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "reveal-stagger",
  version: "1.0.0",
  category: "scroll",
  needs: ["anime"],
  license: "MIT",
  options: {
    sync: { type: "number", default: 0.1, description: "How closely the animation tracks the scrollbar. Upstream's onScroll sync." },
    enter: { type: "string", default: "top", description: "Where the scroll range starts. Upstream's onScroll enter." },
    leave: { type: "string", default: "bottom", description: "Where the scroll range ends. Upstream's onScroll leave." },
  },
};

const UPSTREAM = { sync: 0.1, enter: "top", leave: "bottom" };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the finished deck, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const cards = el.querySelectorAll(".fx-reveal__card");
  const track = el.querySelector(".fx-reveal__track") || el;
  if (!cards.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let scope;

  const build = () => {
    // Upstream's scope: the media query is what picks the branch, and it
    // re-runs the constructor when the orientation changes.
    scope = createScope({
      root: el,
      mediaQueries: { landscape: "(orientation: landscape)" },
      defaults: { ease: "out(3)", duration: 500 },
    }).add((s) => {
      let cardsAnimation;

      if (s.matches.landscape) {
        cardsAnimation = animate(cards, {
          transformOrigin: "50% 150%",
          y: {
            from: stagger(["-40vh", "40vh"], { from: "center" }),
          },
          rotate: {
            to: stagger([-30, 30]),
            delay: stagger([0, 950], { from: "last", start: 200 }),
            ease: "inOut(3)",
          },
          x: ["-60vw", stagger(["-20%", "20%"])],
          delay: stagger(60, { from: "last" }),
          duration: 750,
        });
      } else {
        cardsAnimation = animate(cards, {
          y: ["150vh", stagger(["20%", "-20%"])],
          rotate: {
            from: (_, i) => (i % 2 ? "-20deg" : "20deg"),
            ease: "inOut(3)",
          },
          delay: stagger(50, { from: "last" }),
        });
      }

      onScroll({
        target: track,
        enter: settings.enter,
        leave: settings.leave,
        sync: settings.sync,
      }).link(cardsAnimation);
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // revert() cancels the animation, strips the inline transforms anime wrote
    // and disconnects the scroll observer, because both registered themselves
    // with the scope when they were constructed. That returns the deck to the
    // CSS fan rather than freezing it wherever the scrollbar happened to be.
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
