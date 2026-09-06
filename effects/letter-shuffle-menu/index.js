// Letter Shuffle Menu
// MIT License
// Copyright (c) 2009 - 2022 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/LetterShuffleMenu
//
// letter-shuffle-menu: a port of Codrops' Letter Shuffle Menu, commit
// 32cf37157f32f6e3f323de63d872319704429cc7, src/js/menuItem.js (layout),
// src/js/menu.js (the open timeline), src/js/menuConfig.js (the two defaults)
// and the .menu__item / .letter-wrap block of src/css/base.css.
//
// The idea is one word spelled down the left edge. Every item's FIRST letter
// is not a letter at all but a column of eight: the item's own initial, six
// random ones, and last the nth character of a shared vertical title. The
// column sits flush to the bottom of a one-letter-tall window, so at rest the
// only thing showing is the title -- H, A, P, U, K, U reading down the menu.
// Opening slides every column down by 100/8*(8-1) = 87.5% of its own height,
// seven letters, which lands each item's real initial in the window, while the
// remaining characters swing in from x 100% and rotation 10 with a 0.04s
// stagger. 1.7s, expo.inOut, columns staggered 0.03s. All upstream's.
//
// WHAT IS INVERTED, AND WHY. Upstream is an overlay menu behind a hamburger:
// closed is the resting state, and with no script the button does nothing and
// the menu never opens. A section cannot rest like that -- a menu whose items
// are unreadable until an animation runs is a broken menu. So the stylesheet
// draws the END state (plain, legible links) and index.js builds the column
// structure, sets the closed state and runs the open timeline once when the
// section first scrolls into view. That is the same inversion pin-progress
// makes, and it is what makes the script-blocked, bundle-pruned and
// reduced-motion paths all correct: they are the finished menu.
//
// The close timeline, the hamburger button, the sliding .menu__bg panel and
// the vertical tagline are dropped with it. A section menu does not close.
import { createTimeline, stagger, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "letter-shuffle-menu",
  version: "1.0.0",
  category: "menu",
  needs: ["anime"],
  license: "MIT",
  options: {
    verticalTitle: { type: "string", default: "HAPUKU", description: "The word spelled down the menu's left edge before it resolves; its nth character is the nth item's resting letter. Upstream's menuConfig.displayVerticalTitle." },
    totalLetters: { type: "number", default: 8, description: "How many letters each slot-machine column holds: the item's initial, then random ones, then the title's letter. Upstream's menuConfig.slotMachineTotalLetters." },
    duration: { type: "number", default: 1.7, description: "Seconds the open runs for. Upstream's timeline defaults duration." },
    columnStagger: { type: "number", default: 0.03, description: "Seconds between each column starting to slide. Upstream's slot machine stagger." },
    letterStagger: { type: "number", default: 0.04, description: "Seconds between each letter of an item swinging in. Upstream's per-item chars stagger." },
  },
};

// menuConfig.js and menu.js open(), verbatim.
const UPSTREAM = {
  verticalTitle: "HAPUKU",
  totalLetters: 8,
  duration: 1.7,
  columnStagger: 0.03,
  letterStagger: 0.04,
};

// GSAP counts in seconds, anime.js counts in milliseconds.
const MS = 1000;

// menu.js open(), the chars tween's startAt.
const START_ROTATION = 10;
const START_X = "100%";

// menuItem.js layout(), verbatim.
const ALL_CHARS = 'ABCDEFGHIJKLMNOPRSTUVWXYZ';

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelectorAll !== "function") return resting;

  const $items = [...el.querySelectorAll(".fx-shuffle__item")];
  if (!$items.length || typeof IntersectionObserver !== "function") return resting;
  // A reader who asked for stillness gets the menu the stylesheet already
  // draws: plain, legible links. Splitting them into per-character columns
  // would only make the same words harder to read.
  if (reducedMotion()) return resting;

  const settings = { ...UPSTREAM, ...opts };
  const original = $items.map((item) => item.innerHTML);
  let observer = null;
  let tl = null;

  // Splitting.js's job, done by hand. Upstream reaches for the library to turn
  // "ABOUT" into span.char per letter; that is eight lines here, and doing it
  // by hand keeps ownership of the subtree that layout() then rebuilds --
  // anime's own splitText holds a ResizeObserver and re-splits from a cached
  // string, which would silently throw away every letter-wrap underneath it.
  const splitItem = (item) => {
    const text = item.textContent.trim();
    item.setAttribute("aria-label", text);
    const holder = document.createElement("span");
    holder.className = "fx-shuffle__chars";
    holder.setAttribute("aria-hidden", "true");
    const chars = [...text].map((ch) => {
      const span = document.createElement("span");
      span.className = "fx-shuffle__char";
      // A space would collapse inside a flex row of fixed-width cells.
      span.textContent = ch === " " ? " " : ch;
      holder.appendChild(span);
      return span;
    });
    item.textContent = "";
    item.appendChild(holder);
    return chars;
  };

  // menuItem.js layout(), verbatim apart from the class names and the
  // fallback when the vertical title runs out of characters.
  const layout = (item, chars, itemPosition) => {
    const totalRandomChars = settings.totalLetters - 2;
    let slotMachine = null;

    chars.forEach((char, charPosition) => {
      const wrapEl = document.createElement('span');
      wrapEl.classList = 'fx-shuffle__letter';
      char.parentNode.appendChild(wrapEl);
      wrapEl.appendChild(char);

      // First char needs a vertical structure (slot machine)
      if (charPosition === 0) {
        slotMachine = document.createElement('span');
        slotMachine.classList = 'fx-shuffle__inner';
        wrapEl.appendChild(slotMachine);

        const randomCharsArray = Array.from({ length: totalRandomChars }, _ => ALL_CHARS.charAt(Math.floor(Math.random() * ALL_CHARS.length)));
        // Upstream indexes displayVerticalTitle by the item's position and
        // gets an empty string past its end, which leaves that column blank.
        // Falling back to the item's own initial keeps a seventh item legible.
        const titleChar = settings.verticalTitle.charAt(itemPosition) || char.innerHTML;
        let htmlStr = `<span>${char.innerHTML}</span>`;
        for (let i = 0; i <= totalRandomChars - 1; ++i) {
          htmlStr += i === totalRandomChars - 1 ? `<span>${randomCharsArray[i]}</span><span>${titleChar}</span>` : `<span>${randomCharsArray[i]}</span>`;
        }
        slotMachine.innerHTML = htmlStr;
        wrapEl.removeChild(char);
      }
    });

    return { slotMachine, chars: chars.filter((_, i) => i !== 0) };
  };

  const built = $items.map((item, i) => {
    const chars = splitItem(item);
    return layout(item, chars, i);
  });
  const slotMachines = built.map((b) => b.slotMachine).filter(Boolean);

  // menu.js open(): the two tweens that are the effect. The bg panel, the
  // gradient crossfade, the tagline and the hamburger paths are dropped with
  // the overlay they belong to.
  const play = () => {
    const y = `${100 / settings.totalLetters * (settings.totalLetters - 1)}%`;
    tl = createTimeline({
      defaults: { duration: settings.duration * MS, ease: "inOutExpo" },
      autoplay: false,
    }).add(slotMachines, {
      y,
      delay: stagger(settings.columnStagger * MS),
    }, 0);

    for (const b of built) {
      if (!b.chars.length) continue;
      // Upstream's startAt {x: '100%', rotation: 10, opacity: 1}. The opacity
      // pair looks redundant and is not: style.css rests these letters at 0,
      // which is the never-opened state, and the tween is what turns them on.
      tl.add(b.chars, {
        x: [START_X, '0%'],
        rotate: [START_ROTATION, 0],
        opacity: [1, 1],
        delay: stagger(settings.letterStagger * MS),
      }, 0);
    }

    tl.play();
  };

  // The closed state, written before anything is visible: every column parked
  // on the vertical title, every other letter off to the right.
  utils.set(slotMachines, { y: '0%' });
  for (const b of built) {
    if (b.chars.length) utils.set(b.chars, { x: START_X, rotate: START_ROTATION, opacity: 1 });
  }

  // Upstream opens from a button click. A section has no button, so the run
  // starts the first time the menu is actually on screen and plays once.
  observer = new IntersectionObserver((entries, obs) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    obs.disconnect();
    observer = null;
    play();
  });
  observer.observe(el);

  el.setAttribute("data-fx-live", "");

  return {
    // The columns are built at mount and the run plays once, so a changed
    // value applies on the next mount.
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      observer?.disconnect();
      observer = null;
      tl?.pause();
      tl?.revert();
      tl = null;
      // Put the markup back rather than leaving the columns wherever the run
      // reached: the original text is the finished menu.
      $items.forEach((item, i) => {
        item.innerHTML = original[i];
        item.removeAttribute("aria-label");
      });
      el.removeAttribute("data-fx-live");
    },
  };
}
