// ExpandingRoundedMenu
// The MIT License
// Copyright (c) 2009 - 2022 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/ExpandingRoundedMenu
//
// expanding-menu: a port of Codrops' ExpandingRoundedMenu, commit
// 9f8174aaca176a0e4b31e1330f9049b45fd02758, src/js/index.js with
// src/css/base.css for the two-layer cover and the clipped panel it slides
// through. One timeline, played forward to open and reversed to close, with
// upstream's 1.2s power4.inOut defaults:
//
//   start (0)    the cover wrap eases from scale 1.1 back to 1 over 1.6s on
//                power3.inOut, while the cover comes down from -100% and its
//                inner rises from +100% -- two halves closing on each other,
//                which is what makes the panel read as unrolling rather than
//                sliding. The content behind it splits: panels to -20% or
//                +20% by index, titles the other way.
//   menu (0.5)   the menu panel drops from -100% over 1s inside its clip.
//   extra (1.1)  the tagline and the byline, parked at 400% since time zero,
//                rise to 0 over 0.5s on power4.
//
// Every label, offset, duration, easing and percentage above is upstream's.
// What is not: the panels are CSS custom properties instead of photographs,
// GSAP's timeline is anime.js', and the isAnimating latch is gone.
//
// The resting state is the section with its bar and its content showing and
// the cover parked off the top, which is what style.css draws. Nothing is
// hidden that the reader needs: the menu panel is a menu, and under reduced
// motion it still opens -- instantly, by seeking the timeline rather than
// playing it, so the links inside are never trapped behind an animation the
// visitor asked not to see.
import { createTimeline } from "../../vendor/anime.esm.js";

export const meta = {
  name: "expanding-menu",
  version: "1.0.0",
  category: "menu",
  needs: ["anime"],
  license: "MIT",
  options: {
    duration: { type: "number", default: 1.2, description: "Seconds the open takes. Upstream's timeline defaults.duration." },
    coverDuration: { type: "number", default: 1.6, description: "Seconds the cover wrap takes to settle from 1.1 to 1. Upstream's cover.wrap duration." },
    parallax: { type: "number", default: 20, description: "Percent the content behind the cover splits by. Upstream's content img / title offsets." },
  },
};

const UPSTREAM = { duration: 1.2, coverDuration: 1.6, parallax: 20 };

// GSAP counts in seconds, anime.js in milliseconds. Every upstream duration,
// label and offset below is written as upstream's own number times this.
const SEC = 1000;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const q = (sel) => el.querySelector(sel);
  const qa = (sel) => [...el.querySelectorAll(sel)];
  const dom = {
    menuLinks: qa(".fx-emenu__top .fx-emenu__link"),
    cover: { wrap: q(".fx-emenu__cover-wrap"), outer: q(".fx-emenu__cover"), inner: q(".fx-emenu__cover-inner") },
    content: { imgs: qa(".fx-emenu__content > .fx-emenu__img"), titles: qa(".fx-emenu__content > .fx-emenu__title") },
    menu: q(".fx-emenu__menu"),
    menuContent: q(".fx-emenu__panel"),
    closeCtrl: q(".fx-emenu__back"),
    extra: qa(".fx-emenu__tagline, .fx-emenu__author"),
  };
  if (!dom.menu || !dom.menuContent || !dom.closeCtrl || !dom.cover.wrap) return resting;

  const settings = { ...UPSTREAM, ...opts };
  const still = reducedMotion();
  let isOpen = false;
  let timeline = null;

  const build = () => {
    // Upstream's labels, as milliseconds: 'menu' at 0.5s and 'extra' at
    // menu + 0.6s. anime positions a child by time, so the arithmetic that
    // GSAP writes as 'menu+=0.6' is written out here.
    const START = 0;
    const MENU = 0.5 * SEC;
    const EXTRA = MENU + 0.6 * SEC;

    timeline = createTimeline({
      autoplay: false,
      defaults: { duration: settings.duration * SEC, ease: "inOutQuint" },
    })
      .call(() => {
        // Pointer events on or off, so a closed menu never eats a click.
        dom.menu.classList[isOpen ? "add" : "remove"]("fx-emenu__menu--open");
      }, START)
      .add(dom.cover.wrap, { duration: settings.coverDuration * SEC, ease: "inOutQuart", scale: [1.1, 1] }, START)
      .add(dom.cover.outer, { y: ["-100%", "0%"] }, START)
      .add(dom.cover.inner, { y: ["100%", "0%"] }, START)
      .add(dom.content.imgs, { y: (_, i) => `${i % 2 === 0 ? -settings.parallax : settings.parallax}%` }, START)
      .add(dom.content.titles, { y: (_, i) => `${i % 2 === 0 ? settings.parallax : -settings.parallax}%` }, START)
      .add(dom.menuContent, { duration: 1 * SEC, y: ["-100%", "0%"] }, MENU)
      .set(dom.extra, { y: "400%", opacity: 0 }, START)
      .add(dom.extra, { duration: 0.5 * SEC, ease: "outQuint", opacity: [1, 1], y: "0%" }, EXTRA);
  };

  const expandMenu = () => {
    if (isOpen) return;
    isOpen = true;
    // Reduced motion still opens the menu -- it is navigation, not decoration
    // -- it just arrives rather than travelling.
    if (still) { timeline.seek(timeline.duration); dom.menu.classList.add("fx-emenu__menu--open"); return; }
    timeline.play();
  };

  const collapseMenu = () => {
    if (!isOpen) return;
    isOpen = false;
    if (still) { timeline.seek(0); dom.menu.classList.remove("fx-emenu__menu--open"); return; }
    timeline.reverse();
  };

  const onLink = (ev) => { ev.preventDefault(); expandMenu(); };
  const onClose = (ev) => { ev.preventDefault(); collapseMenu(); };

  build();
  // Upstream opens from any link in the top bar: the bar is the nav, and the
  // panel underneath is the rest of it.
  for (const link of dom.menuLinks) link.addEventListener("click", onLink);
  dom.closeCtrl.addEventListener("click", onClose);
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      const wasOpen = isOpen;
      timeline?.revert();
      build();
      if (wasOpen) timeline.seek(timeline.duration);
    },
    destroy() {
      for (const link of dom.menuLinks) link.removeEventListener("click", onLink);
      dom.closeCtrl.removeEventListener("click", onClose);
      // revert() strips every inline transform and opacity the timeline wrote,
      // which hands the section back at its resting composition rather than
      // leaving it frozen wherever the open had reached.
      timeline?.revert();
      timeline = null;
      dom.menu.classList.remove("fx-emenu__menu--open");
      el.removeAttribute("data-fx-live");
    },
  };
}
