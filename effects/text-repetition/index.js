// TextRepetitionEffect
// The MIT License
// Copyright (c) 2009 - 2021 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/TextRepetitionEffect
//
// text-repetition: a port of Codrops' TextRepetitionEffect, commit
// fabaafe0124e7bdf66906c6214f00800f5575c4c, src/js/demo1/repeatTextScrollFx.js
// plus the getHeight helper in src/js/utils.js. The word is stamped nine
// times into the same grid cell so the copies sit exactly on top of one
// another; each copy carries an opaque background, so at rest the stack reads
// as a single word. Scrolling fans them apart: copy i moves to
// halfWords*12 - 12*i percent above the centre and the mirrored amount below
// it, each one delayed 0.1s further from the middle, over a 1s tween on
// power1. The last copy is the centred original and never moves.
//
// layout(), the ty/delay arithmetic, totalWords, tyIncrement, delayIncrement,
// the 1s power1 tween and the marginTop/paddingBottom reservation are
// upstream's. What is not is the scroll driver: upstream hand-rolls one from
// an IntersectionObserver plus gsap.ticker, computing progress as
// (scrollY + innerHeight - offsetTop) / (innerHeight + offsetHeight) and
// writing it into a paused timeline. anime.js' onScroll defaults describe
// exactly that range -- enter 'end start' is the target's top reaching the
// container's bottom, leave 'start end' is its bottom reaching the top -- so
// the driver is one linked observer rather than a ticker callback.
//
// The resting state is the plain heading in the markup. This file only ever
// adds copies of text that is already there, so a blocked script, a pruned
// bundle or prefers-reduced-motion leaves the word exactly as it reads in
// snippet.html, and destroy() puts the original heading back.
import { animate, onScroll, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "text-repetition",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    totalWords: { type: "number", default: 9, description: "How many copies of the word are stacked. Upstream's totalWords." },
    tyIncrement: { type: "number", default: 12, description: "Percent of the word's own height between one copy and the next when fanned. Upstream's tyIncrement." },
    delayIncrement: { type: "number", default: 0.1, description: "Seconds each copy waits behind the copy nearer the centre. Upstream's delayIncrement." },
  },
};

const UPSTREAM = { totalWords: 9, tyIncrement: 12, delayIncrement: 0.1 };

// GSAP counts in seconds, anime.js in milliseconds. Every upstream duration
// and delay below is written as upstream's own number times this.
const SEC = 1000;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// utils.js getHeight: the element's height with its padding taken back off.
const getHeight = (el) => {
  const computed = getComputedStyle(el);
  return el.clientHeight - (parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom));
};

// layout(): totalWords copies of the word, each stamped with the offset it
// fans to and the delay it waits. The last copy is the centred one -- ty and
// delay both zero -- and is the one the port leaves alone.
function layout(word, settings) {
  const halfWordsCount = Math.floor(settings.totalWords / 2);
  let innerHTML = "";
  for (let i = 0; i < settings.totalWords; ++i) {
    let ty;
    let delay;
    if (i === settings.totalWords - 1) {
      ty = 0;
      delay = 0;
    } else if (i < halfWordsCount) {
      ty = halfWordsCount * settings.tyIncrement - settings.tyIncrement * i;
      delay = settings.delayIncrement * (halfWordsCount - i) - settings.delayIncrement;
    } else {
      ty = -1 * (halfWordsCount * settings.tyIncrement - (i - halfWordsCount) * settings.tyIncrement);
      delay = settings.delayIncrement * (halfWordsCount - (i - halfWordsCount)) - settings.delayIncrement;
    }
    innerHTML += `<span data-delay="${delay}" data-ty="${ty}">${word.original}</span>`;
  }
  word.el.innerHTML = innerHTML;
  word.el.classList.add("fx-textrep--split");
  return [...word.el.querySelectorAll("span")].slice(0, -1);
}

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the heading in the markup is
  // already the finished word, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const targets = [...el.querySelectorAll("[data-fx-rep]")];
  if (!targets.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let words = [];

  const build = () => {
    words = targets.map((node) => {
      const word = { el: node, original: node.innerHTML };
      const spans = layout(word, settings);
      word.spans = spans;
      // setBoundaries(): the copies fan half a stack up and half down, so the
      // heading reserves that much room above and below itself.
      const room = getHeight(node) * Math.floor(settings.totalWords / 2) * settings.tyIncrement / 100;
      utils.set(node, { marginTop: room, paddingBottom: room });
      word.animation = animate(spans, {
        duration: 1 * SEC,
        ease: "outQuad",
        y: (target) => `${target.dataset.ty}%`,
        delay: (target) => Number(target.dataset.delay) * SEC,
        autoplay: false,
      });
      // Upstream's own range, expressed as anime's defaults rather than as a
      // ticker: progress 0 when the heading's top meets the viewport bottom,
      // 1 when its bottom leaves the viewport top.
      word.observer = onScroll({ target: node, sync: true }).link(word.animation);
      return word;
    });
  };

  const tear = () => {
    for (const word of words) {
      word.observer?.revert();
      word.animation?.revert();
      word.el.classList.remove("fx-textrep--split");
      word.el.style.removeProperty("margin-top");
      word.el.style.removeProperty("padding-bottom");
      word.el.innerHTML = word.original;
    }
    words = [];
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
    },
  };
}
