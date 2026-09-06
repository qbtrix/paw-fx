// CSS-only Marquee Menu Effect
// MIT License
// Copyright (c) 2009 - 2020 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/CSSMarqueeMenu
//
// marquee-menu-css: a port of Codrops' CSS-only Marquee Menu, commit
// e7cea3a6762261e1e196d893bc2f5a1e50720dc1, css/base.css (the
// --marquee-width / --offset / --move-initial / --move-final block, the
// .menu / .marquee rules and @keyframes marquee) plus index.html for the
// markup shape.
//
// There is no upstream JavaScript. The whole effect is one pair of sibling
// selectors: hovering .menu__item-link fades the outlined word to nothing
// (opacity 0 over 0.1s) and, through `:hover ~ .marquee .marquee__inner`,
// flips a paused 5s linear infinite translate from --move-initial
// (calc(-25% + var(--offset))) to --move-final (calc(-50% + var(--offset)))
// to running, at opacity 1 over 0.4s. The thumbnail rides along on
// `:hover + .menu__item-img`, rotating 4deg.
//
// So mount() has nothing to animate. It publishes the two knobs upstream
// exposes as custom properties and marks the section live; style.css owns
// the motion and stops it under prefers-reduced-motion, which is the same
// division of labour aurora-css and marquee-css use.
//
// Both options are validated as CSS lengths because both are read inside a
// calc(): --fx-offset lands in calc(-25% + var(--fx-offset)) and a unitless
// value makes that declaration invalid, which parks the band instead of
// scrolling it. Same failure the marquee-css gap guard exists for.
export const meta = {
  name: "marquee-menu-css",
  version: "1.0.0",
  category: "menu",
  needs: [],
  license: "MIT",
  options: {
    duration: { type: "string", default: "5s", description: "One full traverse of the marquee band. Upstream's `animation: marquee 5s linear infinite`." },
    offset: { type: "string", default: "20vw", description: "How far the band is shifted before it starts. Upstream's --offset, which both --move-initial and --move-final add." },
  },
};

// base.css, verbatim: `animation: marquee 5s linear infinite` and
// `--offset: 20vw`.
const UPSTREAM = { duration: "5s", offset: "20vw" };

const LENGTH = /^-?(?:\d+\.?\d*|\.\d+)(?:s|ms|px|r?em|v[wh]|%|ch|ex|pt|cm|mm|in|pc|q)$|^0$/i;
const lengthOr = (v, fallback) => (typeof v === "string" && LENGTH.test(v.trim()) ? v.trim() : fallback);

export function mount(el, opts = {}) {
  if (!el || typeof el.style?.setProperty !== "function") return { update() {}, destroy() {} };
  const apply = (o) => {
    if (o.duration != null) el.style.setProperty("--fx-duration", lengthOr(o.duration, UPSTREAM.duration));
    if (o.offset != null) el.style.setProperty("--fx-offset", lengthOr(o.offset, UPSTREAM.offset));
  };
  apply(opts);
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) { apply(next); },
    destroy() {
      el.removeAttribute("data-fx-live");
      el.style.removeProperty("--fx-duration");
      el.style.removeProperty("--fx-offset");
    },
  };
}
