// ClipHoverEffect
// The MIT License
// Copyright (c) 2009 - 2023 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/ClipHoverEffect
//
// clip-hover: a port of Codrops' ClipHoverEffect, commit
// 57b5cc1b6cc375e69dd915bdd307f2645e1dabb7, js/card.js plus the
// lettersAndSymbols table in js/utils.js and the card rules in css/base.css.
// Each card's panel is cut into five vertical slices -- five copies of the
// same picture, each clipped to `polygon(a% 0%, b% 0%, b% 100%, a% 100%)` for
// its own band and nudged one pixel left per position so the seams close.
// Hovering the card runs three tweens at once on power3.inOut over 0.5s: the
// panel rises from yPercent 100 while it fades in, the wrap comes down from
// -100, and every slice arrives from its own random offset between 25 and 75
// percent, alternating sign. The date, title and link shuffle at the same
// moment -- each character flashes four random glyphs 0.05s apart before its
// own letter returns.
//
// layout(), setClipPath(), the slice arithmetic, slicesTotal, the 0.5s
// power3.inOut defaults, every yPercent, the random ranges and the shuffle
// timings are upstream's. What is not: the picture is a CSS custom property
// rather than a background-image URL parsed out of an inline style, the
// splitter is anime.js' rather than Splitting.js, and the effect is torn down
// on destroy.
//
// The resting state is the card with its panel showing, which is what
// style.css draws. Upstream does the same thing through its `.js` class: the
// script hides the panel only once it has taken over, so with the script
// blocked, the bundle pruned or reduced motion on, the card is a finished
// card rather than an empty box waiting for a hover that can never come.
import { animate, splitText, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "clip-hover",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    slices: { type: "number", default: 5, description: "How many vertical bands the panel is cut into. Upstream's slicesTotal." },
    duration: { type: "number", default: 0.5, description: "Seconds the reveal takes. Upstream's animation.duration." },
  },
};

const UPSTREAM = { slices: 5, duration: 0.5 };

// GSAP counts in seconds, anime.js in milliseconds. Every upstream duration
// and delay below is written as upstream's own number times this.
const SEC = 1000;
// GSAP's power3.inOut is anime's inOutQuart: the same quartic curve.
const EASE = "inOutQuart";

// utils.js, verbatim.
const lettersAndSymbols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '!', '@', '#', '$', '%', '^', '&', '*', '-', '_', '+', '=', ';', ':', '<', '>', ','];

const randomGlyph = () => lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the cards with their panels showing, so leaving them alone is right.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const cardEls = [...el.querySelectorAll(".fx-clip__card")];
  if (!cardEls.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  const splits = [];
  const timers = new Set();
  let cards = [];
  let stopped = false;

  const later = (fn, ms) => {
    if (stopped) return;
    const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms);
    timers.add(id);
  };

  // shuffleChars(): each character flashes four random glyphs, then its own
  // letter comes back 0.03s after the last one. Upstream kills only this
  // card's char tweens before restarting them, so a hover on one card never
  // disturbs the card beside it.
  const shuffleChars = (card) => {
    for (const anim of card.running) anim.cancel();
    card.running = [];
    for (const char of card.chars) {
      card.running.push(animate(char.el, {
        opacity: [0, 1],
        duration: 0.03 * SEC,
        loop: 3,
        loopDelay: 0.05 * SEC,
        onBegin: () => { char.el.innerHTML = randomGlyph(); },
        onLoop: () => { char.el.innerHTML = randomGlyph(); },
        onComplete: () => later(() => { char.el.innerHTML = char.original; }, 0.03 * SEC),
      }));
    }
  };

  // layout(): slicesTotal copies of the panel inside one wrap, each clipped to
  // its own vertical band and pulled one pixel left per position so the bands
  // meet without a hairline between them.
  const layout = (card) => {
    const wrap = document.createElement("div");
    wrap.className = "fx-clip__img-wrap";
    let slicesStr = "";
    for (let i = 0; i < settings.slices; ++i) slicesStr += `<div class="fx-clip__img-inner"></div>`;
    wrap.innerHTML = slicesStr;
    card.img.appendChild(wrap);
    card.wrap = wrap;
    card.slices = [...wrap.querySelectorAll(".fx-clip__img-inner")];
    card.img.style.setProperty("--fx-columns", settings.slices);
    card.slices.forEach((slice, position) => {
      const a1 = position * 100 / settings.slices;
      const b1 = position * 100 / settings.slices + 100 / settings.slices;
      utils.set(slice, {
        clipPath: `polygon(${a1}% 0%, ${b1}% 0%, ${b1}% 100%, ${a1}% 100%)`,
        left: position * -1,
      });
    });
  };

  // Upstream's mouseEnter timeline: three tweens at label 'start', so the
  // panel, its wrap and the five slices all travel together. anime's default
  // composition replaces an overlapping tween on the same property, so a
  // re-entered card picks the reveal up from wherever the exit had reached
  // rather than jumping.
  const enter = (card) => {
    shuffleChars(card);
    const d = { duration: settings.duration * SEC, ease: EASE };
    card.running.push(animate(card.img, { ...d, y: ["100%", "0%"], opacity: [0, 1] }));
    card.running.push(animate(card.wrap, { ...d, y: ["-100%", "0%"] }));
    card.running.push(animate(card.slices, {
      ...d,
      y: [(_, pos) => `${pos % 2 ? utils.random(-75, -25) : utils.random(25, 75)}%`, "0%"],
    }));
  };

  const leave = (card) => {
    const d = { duration: settings.duration * SEC, ease: EASE };
    card.running.push(animate(card.img, { ...d, y: "100%", opacity: 0 }));
    card.running.push(animate(card.wrap, { ...d, y: "-100%" }));
    card.running.push(animate(card.slices, {
      ...d,
      y: (_, pos) => `${pos % 2 ? utils.random(-75, 25) : utils.random(25, 75)}%`,
    }));
  };

  cards = cardEls.map((node) => {
    const card = { el: node, img: node.querySelector(".fx-clip__img"), running: [] };
    const chars = [];
    for (const text of node.querySelectorAll(".fx-clip__date, .fx-clip__title, .fx-clip__link")) {
      const split = splitText(text, { chars: true });
      splits.push(split);
      for (const c of text.querySelectorAll("[data-char]")) chars.push({ el: c, original: c.innerHTML });
    }
    card.chars = chars;
    layout(card);
    card.onEnter = () => enter(card);
    card.onLeave = () => leave(card);
    node.addEventListener("mouseenter", card.onEnter);
    node.addEventListener("mouseleave", card.onLeave);
    return card;
  });

  // Upstream's `.js` class does this: the panel is only hidden once the script
  // is in charge of showing it again.
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const card of cards) {
        for (const anim of card.running) anim.revert();
        card.running = [];
        card.el.removeEventListener("mouseenter", card.onEnter);
        card.el.removeEventListener("mouseleave", card.onLeave);
        card.wrap?.remove();
        card.img.style.removeProperty("--fx-columns");
      }
      cards = [];
      for (const split of splits) split.revert();
      splits.length = 0;
      el.removeAttribute("data-fx-live");
    },
  };
}
