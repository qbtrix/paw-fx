// TypeShuffle
// MIT License
// Copyright (c) 2009 - 2022 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/TypeShuffleAnimation
//
// scramble: a port of Codrops' TypeShuffle, commit
// 8f171f1f58d4ac8e1ede46109674f5c71005f166, src/js/typeShuffle.js plus the
// randomNumber helper in src/js/utils.js. Of the six effects upstream ships,
// this is fx1 -- the one trigger() runs by default: every cell is blanked,
// then each line starts 200ms after the one above it and each character
// changes 45 times at 15ms. The first character of a line rolls a random glyph
// (one of * - ' " for the first nine iterations, then anything from
// lettersAndSymbols); every other character copies whatever its left-hand
// neighbour showed a moment ago, which is what makes the text look like it is
// sliding in from the left. A blank cell does not count towards its 45.
//
// The Line and Cell classes, the letter table, MAX_CELL_ITERATIONS, both
// timeouts and the neighbour-cache trick are upstream's. What is not is the
// splitter: upstream uses Splitting.js, which is a second dependency for a job
// the vendored anime.js already does, so anime's splitText provides the lines
// and the per-line characters that Line and Cell are built from.
//
// The resting state is the finished headline. Nothing here hides text until an
// observer fires: the section reads correctly with the script blocked, with
// the bundle pruned, and under reduced motion -- and if the run is torn down
// halfway, revert() puts the original markup back rather than leaving the
// blanked cells the animation starts from.
import { splitText } from "../../vendor/anime.esm.js";

export const meta = {
  name: "scramble",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    iterations: { type: "number", default: 45, description: "How many times each character changes before it settles. Upstream's MAX_CELL_ITERATIONS in fx1." },
    tick: { type: "number", default: 15, description: "Milliseconds between a character's changes. Upstream's fx1 setTimeout." },
    lineDelay: { type: "number", default: 200, description: "Milliseconds each line waits behind the one above it. Upstream's (line.position + 1) * 200." },
  },
};

const UPSTREAM = { iterations: 45, tick: 15, lineDelay: 200 };

// typeShuffle.js, verbatim.
const LETTERS_AND_SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '!', '@', '#', '$', '&', '*', '(', ')', '-', '_', '+', '=', '/', '[', ']', '{', '}', ';', ':', '<', '>', ',', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const getRandomChar = () => LETTERS_AND_SYMBOLS[Math.floor(Math.random() * LETTERS_AND_SYMBOLS.length)];

// Upstream's Cell, minus the colour fields: those exist for fx5 and fx6, which
// this port does not carry, and fx1 never reads them.
class Cell {
  constructor(el, { position, previousCellPosition } = {}) {
    this.el = el;
    this.original = el.innerHTML;
    this.state = this.original;
    this.position = position;
    this.previousCellPosition = previousCellPosition;
    this.cache = undefined;
  }
  set(value) {
    this.state = value;
    this.el.innerHTML = this.state;
  }
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the headline is already the
  // finished content and splitting it would only make it worse to read.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const target = el.querySelector(".fx-scramble__copy");
  if (!target || typeof IntersectionObserver !== "function") return resting;

  const settings = { ...UPSTREAM, ...opts };
  let split = null;
  let observer = null;
  // Every pending timeout, so a destroy mid-run cannot leave a cell mid-roll.
  // Upstream keeps none of these, because its page never tears the effect down.
  const timers = new Set();
  let stopped = false;
  // Upstream's isAnimating, which its trigger() checks so a second click
  // cannot start a second run over a run already in flight.
  let isAnimating = false;
  // Not upstream: the run plays once per mount. A character split does not
  // re-run its effects on an ordinary resize, but a cache-clearing refresh
  // would, and a headline that re-scrambles whenever the window is dragged is
  // noise rather than an effect.
  let played = false;

  const later = (fn, ms) => {
    if (stopped) return;
    const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms);
    timers.add(id);
  };

  // typeShuffle.js fx1, with `this.lines` / `this.totalChars` as locals.
  const run = (lines, totalChars) => {
    if (isAnimating) return;
    isAnimating = true;
    played = true;
    const MAX_CELL_ITERATIONS = settings.iterations;
    let finished = 0;

    for (const line of lines) {
      for (const cell of line.cells) cell.set("&nbsp;"); // clearCells()
    }

    const loop = (line, cell, iteration = 0) => {
      cell.cache = cell.state;

      if (iteration === MAX_CELL_ITERATIONS - 1) {
        cell.set(cell.original);
        ++finished;
        if (finished === totalChars) {
          isAnimating = false;
        }
      } else if (cell.position === 0) {
        cell.set(iteration < 9
          ? ['*', '-', '\u0027', '\u0022'][Math.floor(Math.random() * 4)]
          : getRandomChar());
      } else {
        cell.set(line.cells[cell.previousCellPosition].cache);
      }

      if (cell.cache != '&nbsp;') {
        ++iteration;
      }

      if (iteration < MAX_CELL_ITERATIONS) {
        later(() => loop(line, cell, iteration), settings.tick);
      }
    };

    for (const line of lines) {
      for (const cell of line.cells) {
        later(() => loop(line, cell), (line.position + 1) * settings.lineDelay);
      }
    }
  };

  // Split into words and characters, NOT into line elements, even though what
  // the port needs is a per-line grouping. Asking for lines makes the split
  // asynchronous behind document.fonts and makes every re-split rebuild the
  // character spans from a cached string -- new nodes, while the cells still
  // hold the old ones. The grouping is available without any of that: the
  // splitter stamps data-line on each word as it measures which visual line it
  // landed on, so the characters can be bucketed by their word's stamp. This
  // split is synchronous, and a later re-split recomputes attributes on the
  // same elements the cells already point at.
  //
  // splitText also inserts a visually-hidden span holding the original markup,
  // so the sentence stays intact for a screen reader while the visible cells
  // are rolling.
  split = splitText(target, { chars: true });
  split.addEffect((s) => {
    // Upstream's Line/Cell construction: characters grouped per line, with
    // each cell's position counted from the start of its own line.
    const byLine = new Map();
    for (const charEl of s.chars) {
      const key = Number(charEl.closest("[data-word]")?.getAttribute("data-line") ?? 0);
      if (!byLine.has(key)) byLine.set(key, []);
      byLine.get(key).push(charEl);
    }
    let totalChars = 0;
    const lines = [...byLine.keys()].sort((a, b) => a - b).map((key, position) => {
      const cells = byLine.get(key).map((charEl, i) =>
        new Cell(charEl, { position: i, previousCellPosition: i === 0 ? -1 : i - 1 }));
      totalChars += cells.length;
      return { position, cells };
    });

    // Upstream triggers from a button on its demo page. A section has no
    // button, so the run starts the first time it is actually on screen and
    // the observer disconnects itself immediately after. Once per mount: a
    // re-split from a window resize rebuilds the cells but does not replay.
    observer?.disconnect();
    observer = null;
    if (played) return () => {};
    observer = new IntersectionObserver((entries, obs) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      observer = null;
      run(lines, totalChars);
    });
    observer.observe(el);

    return () => {
      observer?.disconnect();
      observer = null;
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };
  });

  el.setAttribute("data-fx-live", "");

  return {
    // Only the three timing knobs are live; a changed value applies to the
    // next run, which for a one-shot means the next mount.
    update(next = {}) { Object.assign(settings, next); },
    destroy() {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      observer?.disconnect();
      observer = null;
      // revert() runs the effect cleanup, disconnects the splitter's own
      // ResizeObserver and restores the original innerHTML -- which is what
      // makes a destroy mid-run give the headline back instead of leaving the
      // blanked cells the run starts from.
      split?.revert();
      split = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
