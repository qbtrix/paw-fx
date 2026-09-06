// LineTextHoverAnimations
// The MIT License
// Copyright (c) 2009 - 2024 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/LineTextHoverAnimations
//
// terminal-hover: a port of Codrops' LineTextHoverAnimations effect 1, commit
// 00fdd50a5daa48a9fcb400d19d17b1dac5935e68, js/effect-1/text-animator.js and
// js/effect-1/index.js, with js/textSplitter.js and css/base.css for the split
// and the cursor block. Hovering a row runs every cell in it: each character
// plays a 0.03s opacity fade four times over, 0.04s apart, starting
// (position + 1) * 0.07s behind the character to its left, showing a different
// glyph from lettersAndSymbols on each pass before the original comes back
// 0.03s after the last one. A solid block the width of one character sits over
// the letter for the first pass only -- --opa goes to 1 when the run starts
// and back to 0 on the first repeat -- which is the terminal cursor the effect
// is named for.
//
// The letter table, all four timings, the repeat count, the per-character
// delay ramp, the --opa handover and the row-wide trigger that fires every
// cell at once are upstream's. What is not: the splitter (SplitType becomes
// anime.js' splitText, which is already vendored), the repeat mechanism
// (GSAP's repeatRefresh re-evaluates a function-valued innerHTML per pass;
// anime re-randomises the glyph from onLoop), and the teardown.
//
// The resting state is the list exactly as it is written. Nothing is hidden
// before a hover: with the script blocked, the bundle pruned or reduced motion
// on, the reader gets the full manifest, and destroy() puts the unsplit markup
// back.
import { animate, splitText, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "terminal-hover",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    tick: { type: "number", default: 0.03, description: "Seconds one pass of a character takes. Upstream's duration." },
    gap: { type: "number", default: 0.04, description: "Seconds between one pass and the next. Upstream's repeatDelay." },
    lag: { type: "number", default: 0.07, description: "Seconds each character waits behind the one to its left. Upstream's (position + 1) * 0.07." },
  },
};

const UPSTREAM = { tick: 0.03, gap: 0.04, lag: 0.07 };

// GSAP counts in seconds, anime.js in milliseconds. Every upstream duration
// and delay below is written as upstream's own number times this.
const SEC = 1000;

// text-animator.js, verbatim.
const lettersAndSymbols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '!', '@', '#', '$', '%', '^', '&', '*', '-', '_', '+', '=', ';', ':', '<', '>', ','];

const randomGlyph = () => lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the list is already the
  // finished content and rolling every letter of it is the motion this
  // visitor asked not to have.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const rows = [...el.querySelectorAll(".fx-terminal__row")];
  if (!rows.length) return resting;

  const settings = { ...UPSTREAM, ...opts };
  const splits = [];
  const bound = [];
  const timers = new Set();
  let stopped = false;

  const later = (fn, ms) => {
    if (stopped) return;
    const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms);
    timers.add(id);
  };

  // reset(): kill anything this row has mid-roll and put its characters back,
  // so a second hover over a row still animating does not settle on a random
  // glyph. Scoped to the row, exactly like upstream's per-animator reset: a
  // hover on one line must not snap the line above it back mid-roll.
  const reset = (row) => {
    for (const anim of row.running) anim.cancel();
    row.running = [];
    for (const cell of row.cells) {
      for (const char of cell.chars) {
        char.el.innerHTML = char.original;
        char.el.style.removeProperty("--fx-opa");
      }
    }
  };

  // animate(): upstream's per-character run.
  const run = (row) => {
    reset(row);
    for (const cell of row.cells) {
      cell.chars.forEach((char, position) => {
        let repeatCount = 0;
        row.running.push(animate(char.el, {
          opacity: [0, 1],
          duration: settings.tick * SEC,
          delay: (position + 1) * settings.lag * SEC,
          loop: 3,
          loopDelay: settings.gap * SEC,
          onBegin: () => {
            // --opa to 1 at the start of the animation.
            utils.set(char.el, { "--fx-opa": 1 });
            char.el.innerHTML = randomGlyph();
          },
          onLoop: () => {
            repeatCount++;
            // --opa to 0 after the first repeat.
            if (repeatCount === 1) utils.set(char.el, { "--fx-opa": 0 });
            char.el.innerHTML = randomGlyph();
          },
          onComplete: () => later(() => { char.el.innerHTML = char.original; }, settings.tick * SEC),
        }));
      });
    }
  };

  for (const node of rows) {
    const cells = [];
    for (const cell of node.querySelectorAll(".fx-terminal__cell")) {
      const split = splitText(cell, { chars: true });
      splits.push(split);
      cells.push({ chars: [...cell.querySelectorAll("[data-char]")].map((c) => ({ el: c, original: c.innerHTML })) });
    }
    if (!cells.length) continue;
    // Upstream binds the row, not the cell: entering the line runs every
    // column in it at once, which is what makes the row read as one event.
    const row = { el: node, cells, running: [] };
    row.onEnter = () => run(row);
    node.addEventListener("mouseenter", row.onEnter);
    bound.push(row);
  }

  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const row of bound) {
        for (const anim of row.running) anim.revert();
        row.running = [];
        row.el.removeEventListener("mouseenter", row.onEnter);
      }
      bound.length = 0;
      // revert() restores each cell's original markup and disconnects the
      // splitter's own ResizeObserver, so a destroy mid-roll gives the row
      // back rather than leaving it on whatever glyph it had reached.
      for (const split of splits) split.revert();
      splits.length = 0;
      el.removeAttribute("data-fx-live");
    },
  };
}
