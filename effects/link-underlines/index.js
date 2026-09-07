// Line Hover Styles
// MIT License
// Copyright (c) 2009 - 2021 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/LineHoverStyles
//
// link-underlines: a port of Codrops' LineHoverStyles, commit
// 5ff7fb48e2d415fb217dda5942e0cd08bc4ed768, css/base.css plus the markup shape
// in index.html. The effect is entirely CSS -- upstream ships no JavaScript at
// all, and neither does this -- so everything worth reading is in style.css:
// three of upstream's twelve link treatments (metis, io and leda, renamed
// wipe, dual and swap), transform for transform and cubic-bezier for
// cubic-bezier.
//
// mount() therefore has one job: write the chosen variant onto the section so
// the stylesheet's [data-fx-variant] rules select. The snippet already carries
// the default, so a page that never runs this module still gets a working
// effect, which is the point of porting a CSS-only upstream in the first
// place. There is no animation loop to cancel and no listener to remove; the
// browser owns both the hover state and prefers-reduced-motion.
export const meta = {
  name: "link-underlines",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    variant: { type: "string", default: "wipe", description: "Which upstream treatment to use: wipe (.link--metis), dual (.link--io) or swap (.link--leda)." },
  },
};

const VARIANTS = ["wipe", "dual", "swap"];
const variantOf = (v) => (VARIANTS.includes(v) ? v : "wipe");

export function mount(el, opts = {}) {
  if (!el || typeof el.setAttribute !== "function") return { update() {}, destroy() {} };
  // The snippet ships with the default already on the element, so this only
  // ever changes it -- it never turns the effect on.
  const restore = el.getAttribute("data-fx-variant") ?? "wipe";
  const apply = (o) => { if (o.variant != null) el.setAttribute("data-fx-variant", variantOf(o.variant)); };
  apply(opts);
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) { apply(next); },
    destroy() {
      el.setAttribute("data-fx-variant", restore);
      el.removeAttribute("data-fx-live");
    },
  };
}
