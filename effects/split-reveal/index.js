// anime.js
// The MIT License
// Copyright (c) 2025 Julian Garnier
// https://github.com/juliangarnier/anime
//
// split-reveal: a port of anime.js' text split-effects example, commit
// 01b81be1df6843ccfe0a71c0699a746bf740dd77,
// examples/text/split-effects/index.js. splitText splits the paragraph into
// lines and words, and one addEffect drives both: the lines pick up a colour
// from the accent and drift y -10 at scale 1.1, staggered 100ms; the words
// breathe scale .98 -> 1.04, staggered 100ms grouped by data-line. Timeline
// defaults are upstream's -- alternate, loop, loopDelay 75, duration 1500,
// ease inOutQuad -- so it is a slow perpetual wave rather than a one-shot.
//
// Naming it "reveal" is the library's category, not a claim that upstream
// reveals anything: every value here plays over text that is already visible,
// which is also why this port cannot hide the copy at rest. Nothing is
// animated from a hidden state, so with the script blocked, the bundle pruned
// or reduced motion on, the paragraph is simply the paragraph.
//
// The split has to be undone on destroy: splitText replaces the element's
// innerHTML with wrappers, and a section torn down mid-wave would otherwise
// leave a page transition holding spans full of half-animated inline styles.
import { createTimeline, splitText, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "split-reveal",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    duration: { type: "number", default: 1500, description: "Length of one half of the wave, in ms. Upstream's timeline default." },
    loopDelay: { type: "number", default: 75, description: "Pause between wave repetitions, in ms. Upstream's timeline default." },
    stagger: { type: "number", default: 100, description: "Delay added per line, and per word within a line, in ms. Upstream's stagger." },
  },
};

const UPSTREAM = { duration: 1500, loopDelay: 75, stagger: 100 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the paragraph is already the
  // finished content, so not splitting it is the correct outcome. It also
  // keeps the copy as one selectable, screen-reader-plain block.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const target = el.querySelector(".fx-split__copy");
  if (!target) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let split;

  const build = () => {
    split = splitText(target, { lines: true });
    split.addEffect((s) =>
      createTimeline({
        defaults: {
          alternate: true,
          loop: true,
          loopDelay: settings.loopDelay,
          duration: settings.duration,
          ease: "inOutQuad",
        },
      })
        .add(s.lines, {
          color: { from: "var(--fx-accent)" },
          y: -10,
          scale: 1.1,
        }, stagger(settings.stagger, { start: 0 }))
        .add(s.words, {
          scale: [0.98, 1.04],
        }, stagger(settings.stagger, { use: "data-line", start: 0 }))
        .init(),
    );
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // revert() runs the effect cleanups, cancels the timeline, disconnects the
    // splitter's ResizeObserver and puts the original innerHTML back.
    split?.revert();
    split = null;
  };

  return {
    update(next = {}) {
      if (!split) return;
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
