// Lenis
// The MIT License
// Copyright (c) 2024 darkroom.engineering
// https://github.com/darkroomengineering/lenis
//
// smooth-scroll: a wrapper over Lenis, tag v1.3.26 =
// eea71595f5ae595f49b21ed87520822d3624098a, packages/core/src/lenis.ts (the
// ESM entry, vendored built as vendor/lenis.js).
//
// Keeping this honest: it really is `new Lenis()` and nothing else. Lenis
// 1.3.26 takes `autoRaf`, so it owns the requestAnimationFrame loop itself and
// destroy() cancels it -- the rAF loop every Lenis README writes out by hand is
// a constructor flag at this version, and writing our own would be a second
// copy of upstream's to drift. So the only code here that is not `new Lenis`
// is the part upstream cannot do for us: scoping a page-wide singleton to a
// contract whose unit is a section.
//
// That is what the refcount is. Smooth scroll is a property of the document,
// not of a section, and a page may legitimately carry the section twice. Two
// Lenis instances on one document fight over the same scroll position, so the
// second mount shares the first's instance and destroy() only tears it down
// when the last handle lets go.
import Lenis from "../../vendor/lenis.js";

export const meta = {
  name: "smooth-scroll",
  version: "1.0.0",
  category: "scroll",
  needs: ["lenis"],
  license: "MIT",
  options: {
    lerp: { type: "number", default: 0.1, description: "Linear interpolation per frame. Lower is heavier. Upstream default." },
    wheelMultiplier: { type: "number", default: 1, description: "Scale applied to wheel deltas. Upstream default." },
    touchMultiplier: { type: "number", default: 1, description: "Scale applied to touch deltas. Upstream default." },
  },
};

// packages/core/src/lenis.ts constructor defaults at the pinned tag.
const UPSTREAM = { lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1 };

// The document-wide instance and the number of sections holding it.
let instance = null;
let holders = 0;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // Lenis needs a real document. Under reduced motion it is never constructed
  // at all: its own respectReducedMotion would stop the smoothing but leave
  // the wheel and touch listeners installed, and "stay at rest" means native
  // scroll, untouched.
  if (!el || typeof document === "undefined" || reducedMotion()) return resting;

  if (!instance) {
    try {
      // autoRaf is upstream's own frame loop; destroy() cancels it.
      instance = new Lenis({ ...UPSTREAM, ...opts, autoRaf: true });
    } catch {
      return resting; // no window, no Lenis: native scroll is the resting state
    }
  }
  holders++;
  el.setAttribute("data-fx-live", "");

  let released = false;
  const release = () => {
    if (released) return; // a second destroy() must not steal someone else's hold
    released = true;
    el.removeAttribute("data-fx-live");
    if (--holders > 0) return;
    instance?.destroy(); // cancels the rAF loop, removes every listener, drops the lenis-* classes
    instance = null;
  };

  return {
    // Lenis has no live option setter, so a changed option is a rebuild. The
    // scroll position survives it because the page never moved.
    update(next = {}) {
      if (released || !instance) return;
      const options = { ...instance.options, ...next, autoRaf: true };
      instance.destroy();
      instance = new Lenis(options);
    },
    destroy: release,
  };
}
