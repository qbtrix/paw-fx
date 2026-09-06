// On Scroll Typography Animations
// MIT License
// Copyright (c) 2009 - 2023 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/OnScrollTypographyAnimations
//
// scroll-type-set: a port of Codrops' OnScrollTypographyAnimations, commit
// af28d61d1f8d3d117f5d1e9b09d5209e20a1a212, src/js/index.js plus the
// per-character CSS in src/css/base.css. Upstream ships fifteen scrubbed
// headline reveals on one page; three are carried here as one effect with a
// `variant` option, because fifteen near-identical ports would be a worse
// library than three that read differently:
//
//   rise    = upstream fx2   opacity 0, yPercent 120, scaleY 2.3, scaleX 0.7
//                            from transform-origin 50% 0%, back.inOut(2),
//                            stagger 0.03, duration 1
//   scatter = upstream fx5   opacity 0, xPercent random(-200,200),
//                            yPercent random(-150,150), power1.inOut,
//                            stagger each 0.05 from random, scrub 0.9
//   flip    = upstream fx13  opacity 0, rotationY 180, xPercent -40,
//                            yPercent 100 over a 2000 perspective,
//                            power4.inOut, stagger each -0.03 from 0, scrub 0.9
//
// Every number, easing and threshold above is upstream's. Three mechanical
// translations were forced by dropping GSAP (its licence bars use in a tool
// that lets people build animations without writing code, which is what a site
// agent is) and they are the only ones:
//
//   1. GSAP's powerN is degree N+1, so power1.inOut is inOutQuad, power4.inOut
//      is inOutQuint, and back.inOut(2) is inOutBack(2) at the same overshoot.
//   2. ScrollTrigger writes "start: 'target container'"; anime's onScroll
//      writes enter as "container target" -- the halves are the other way
//      round (ScrollObserver splits enter[0] into enterContainer). Every
//      threshold below is therefore upstream's pair, reversed, and nothing
//      else. Verified against the vendored build, not assumed.
//   3. GSAP counts seconds, anime counts milliseconds, so upstream's literals
//      are kept verbatim and multiplied by MS at the call site.
//
// The resting state is the finished headline drawn by style.css. Nothing here
// hides the copy until an observer fires: with the script blocked, the bundle
// pruned or reduced motion on, the section reads exactly as it does at the end
// of the animation. That inversion is the whole point -- upstream is a demo
// page that owns its own loader, this is one section on someone else's site.
import { animate, onScroll, random, splitText, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "scroll-type-set",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    variant: { type: "string", default: "rise", description: "Which upstream reveal to run: rise (fx2), scatter (fx5) or flip (fx13)." },
    sync: { type: "number", default: 0, description: "How closely the reveal tracks the scrollbar; 0 keeps the variant's own upstream scrub value. Upstream's scrollTrigger.scrub." },
  },
};

// Seconds upstream, milliseconds here.
const MS = 1000;

// One entry per ported upstream effect. `enter` / `leave` are upstream's
// scrollTrigger start / end with the two halves swapped, per note 2 above.
const VARIANTS = {
  // fx2
  rise: {
    sync: true,
    enter: "bottom+=50% center",
    leave: "top+=40% bottom",
    build: (chars) => animate(chars, {
      opacity: [0, 1],
      y: ["120%", "0%"],
      scaleY: [2.3, 1],
      scaleX: [0.7, 1],
      duration: 1 * MS,
      ease: "inOutBack(2)",
      delay: stagger(0.03 * MS),
      autoplay: false,
    }),
  },
  // fx5
  scatter: {
    sync: 0.9,
    enter: "bottom+=10% center",
    leave: "center bottom",
    build: (chars) => animate(chars, {
      opacity: [0, 1],
      x: { from: () => `${random(-200, 200)}%`, to: "0%" },
      y: { from: () => `${random(-150, 150)}%`, to: "0%" },
      duration: 0.5 * MS,
      ease: "inOutQuad",
      delay: stagger(0.05 * MS, { from: "random" }),
      autoplay: false,
    }),
  },
  // fx13
  flip: {
    sync: 0.9,
    enter: "bottom center",
    leave: "center-=30% bottom",
    build: (chars) => animate(chars, {
      opacity: [0, 1],
      rotateY: [180, 0],
      x: ["-40%", "0%"],
      y: ["100%", "0%"],
      duration: 0.5 * MS,
      ease: "inOutQuint",
      // Upstream is `{ each: -0.03, from: 0 }`: a negative each counted from
      // the first character, which GSAP normalises into the last character
      // leading. anime spells the same order `from: "last"`.
      delay: stagger(0.03 * MS, { from: "last" }),
      autoplay: false,
    }),
  },
};

const variantOf = (v) => (typeof v === "string" && v in VARIANTS ? v : "rise");

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the finished headline, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const target = el.querySelector(".fx-typeset__title");
  if (!target) return resting;

  const settings = { variant: "rise", sync: 0, ...opts };
  let split = null;

  const build = () => {
    const key = variantOf(settings.variant);
    const spec = VARIANTS[key];
    // style.css keys the per-character transform-origin and the word
    // perspective off this attribute, so it goes on before the split measures.
    el.setAttribute("data-fx-variant", key);
    // Elements, never selector strings: a page may legitimately carry this
    // section twice, and passing the nodes this section actually holds is what
    // stops the second mount animating the first one's characters.
    split = splitText(target, { chars: true });
    split.addEffect((sp) => {
      const chars = sp.chars;
      if (!chars.length) return () => {};
      const animation = spec.build(chars);
      const observer = onScroll({
        target,
        enter: spec.enter,
        leave: spec.leave,
        sync: Number(settings.sync) > 0 ? Number(settings.sync) : spec.sync,
      });
      observer.link(animation);
      return () => {
        observer.revert();
        animation.revert();
      };
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // revert() runs the split effect's cleanup -- which disconnects the scroll
    // observer and cancels the animation -- then strips the character spans
    // and puts the original markup back. That is what makes a destroy
    // mid-scroll hand the headline back rather than freezing it wherever the
    // scrollbar happened to be.
    split?.revert();
    split = null;
  };

  return {
    update(next = {}) {
      Object.assign(settings, next);
      tear();
      build();
    },
    destroy() {
      tear();
      el.removeAttribute("data-fx-live");
      el.removeAttribute("data-fx-variant");
    },
  };
}
