// Text Block Transitions
// MIT License
// Copyright (c) 2009 - 2023 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/TextBlockTransitions
//
// text-block-swap: a port of Codrops' TextBlockTransitions, commit
// f26255f089e20df46a4844ab1205e3b07565889a, js/demo1/index.js,
// js/demo2/index.js and js/demo6/index.js plus css/base.css.
//
// One paragraph leaves and the next arrives, word by word, under three rules:
//
//   rise      demo1. The outgoing words blink out in 50ms; the incoming ones
//             rise 30% and untwist from +/-3deg over 800ms, staggered 20ms
//             from the centre outwards, each half pivoting on its inner
//             bottom corner so the line opens like a book.
//   dissolve  demo2. The outgoing block is gone in 10ms and the incoming
//             words appear in random order, 9ms apart. No movement at all.
//   roll      demo6. The outgoing words roll up and out to -125% with a 3deg
//             tilt on power1.in over 150ms; the incoming ones roll in from
//             +125% and -3deg on a back curve over 600ms, both staggered 20ms
//             from the start, with each word clipped to its own box so the
//             lines never bleed into each other.
//
// Every duration, easing, stagger, rotation and percentage above is upstream's.
// Nine of the twelve demos are not here; see meta.json deviations.
//
// The resting state is the first block, drawn by style.css from the
// --current class in the markup. Nothing is hidden behind a script: with the
// script blocked, the bundle pruned or reduced motion on, the section is that
// paragraph, and the swap control is not drawn at all rather than sitting
// there dead.
import { createTimeline, splitText, stagger, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "text-block-swap",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    variant: { type: "string", default: "rise", description: "Which of the ported transitions to run: rise (upstream demo1), dissolve (demo2) or roll (demo6)." },
    interval: { type: "number", default: 0, description: "Milliseconds between automatic swaps. 0, the default, means the block only changes when the control is used -- upstream has no timer." },
  },
};

const UPSTREAM = { variant: "rise", interval: 0 };

// GSAP counts durations in seconds and anime.js in milliseconds.
const SECOND = 1000;

const CURRENT = "fx-swap__text--current";

// demo1. Both halves of the line pivot on their inner bottom corner, which is
// what makes the words fan rather than simply rise.
const rise = (tl, current, upcoming, show, hide) => {
  const upcomingWordsTotal = upcoming.length;
  utils.set(upcoming, {
    transformOrigin: (_, pos) => pos <= upcomingWordsTotal / 2 ? "100% 100%" : "0% 100%",
  });
  tl.add(current, {
    opacity: 0,
    onComplete: hide,
  }, 0)
    .add(upcoming, {
      opacity: [0, 1],
      y: ["30%", "0%"],
      rotate: [(_, pos) => pos <= upcomingWordsTotal / 2 ? -3 : 3, 0],
      duration: 0.8 * SECOND,
      delay: stagger(0.02 * SECOND, { from: "center" }),
      onBegin: show,
    }, 0);
};

// demo2. No transform anywhere: the block is replaced one word at a time in
// random order, which reads as a dissolve.
const dissolve = (tl, current, upcoming, show, hide) => {
  tl.add(current, {
    duration: 0.01 * SECOND,
    opacity: 0,
    onComplete: hide,
  }, 0)
    .add(upcoming, {
      opacity: [0, 1],
      delay: stagger(0.009 * SECOND, { from: "random" }),
      onBegin: show,
    });
};

// demo6. Upstream inserts a .word-wrap around every word for the clip; here
// the splitter is asked for the same thing with wrap: 'hidden'.
const roll = (tl, current, upcoming, show, hide) => {
  utils.set(current, { transformOrigin: "100% 50%" });
  utils.set(upcoming, { transformOrigin: "0% 50%" });
  const outDuration = 0.15 * SECOND;
  const outStagger = 0.02 * SECOND;
  tl.add(current, {
    y: ["0%", "-125%"],
    rotate: [0, 3],
    duration: outDuration,
    ease: "inQuad",
    delay: stagger(outStagger, { from: "first" }),
    onComplete: hide,
  }, 0)
    // Upstream's '>-=0.6': start six tenths of a second before the outgoing
    // run finishes, which for a short line is before it starts at all.
    .add(upcoming, {
      y: ["125%", "0%"],
      rotate: [-3, 0],
      duration: 0.6 * SECOND,
      ease: "outBack",
      delay: stagger(outStagger, { from: "first" }),
      onBegin: show,
    }, Math.max(0, outDuration + outStagger * (current.length - 1) - 0.6 * SECOND));
};

const VARIANTS = { rise, dissolve, roll };
// Only demo6 clips its words; demo1's 30% rise and demo2's fade do not.
const CLIPPED = new Set(["roll"]);

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the current block and the control is not painted, so there is nothing to
  // reach that the script would have to supply.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const blocks = [...el.querySelectorAll(".fx-swap__text")];
  const trigger = el.querySelector(".fx-swap__trigger");
  if (blocks.length < 2) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let splits = [];
  let words = [];
  let tl = null;
  let timer = 0;
  // Upstream's currentTextPos and isAnimating.
  let currentTextPos = Math.max(0, blocks.findIndex((b) => b.classList.contains(CURRENT)));
  // Which block the markup shipped as current, so destroy() gives that one
  // back rather than whichever the reader happened to stop on.
  const shipped = currentTextPos;
  let isAnimating = false;

  const build = () => {
    // splitText also leaves a visually-hidden copy of the original markup, so
    // the paragraph stays one sentence for a screen reader while the visible
    // words are moving.
    const clip = CLIPPED.has(settings.variant);
    splits = blocks.map((block) => splitText(block, { words: clip ? { wrap: "hidden" } : true }));
    words = splits.map((split) => split.words);
    blocks.forEach((block, i) => block.classList.toggle(CURRENT, i === currentTextPos));
  };

  // Upstream's switchTexts, generalised past two blocks.
  const switchTexts = () => {
    if (isAnimating) return false;
    isAnimating = true;

    const upcomingTextPos = (currentTextPos + 1) % blocks.length;
    const currentWords = words[currentTextPos];
    const upcomingWords = words[upcomingTextPos];
    const from = currentTextPos;

    // The previous run's timeline is finished by now (isAnimating guards
    // that), but it still holds tweens on nodes this one is about to move.
    tl?.revert();
    tl = createTimeline({
      defaults: {
        duration: 0.05 * SECOND,
        ease: "outExpo",
      },
      onComplete: () => {
        currentTextPos = upcomingTextPos;
        isAnimating = false;
      },
    });
    (VARIANTS[settings.variant] ?? rise)(
      tl,
      currentWords,
      upcomingWords,
      () => blocks[upcomingTextPos].classList.add(CURRENT),
      () => blocks[from].classList.remove(CURRENT),
    );
    return true;
  };

  const tick = () => {
    if (!settings.interval) return;
    timer = setTimeout(() => { switchTexts(); tick(); }, settings.interval);
  };

  build();
  trigger?.addEventListener("click", switchTexts);
  tick();
  el.setAttribute("data-fx-live", "");

  const tear = () => {
    clearTimeout(timer);
    timer = 0;
    tl?.revert();
    tl = null;
    // revert() restores each block's original markup, which takes every word
    // span and every inline style the run wrote with it.
    for (const split of splits) split.revert();
    splits = [];
    words = [];
    isAnimating = false;
  };

  return {
    // A variant change needs different markup from the splitter (only roll
    // clips), so the whole thing is rebuilt rather than patched.
    update(next = {}) {
      Object.assign(settings, next);
      tear();
      build();
      tick();
    },
    destroy() {
      trigger?.removeEventListener("click", switchTexts);
      tear();
      blocks.forEach((block, i) => block.classList.toggle(CURRENT, i === shipped));
      el.removeAttribute("data-fx-live");
    },
  };
}
