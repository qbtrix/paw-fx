// Button Hover Styles
// MIT License
// Copyright (c) 2009 - 2022 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/ButtonHoverStyles
//
// button-hovers: a port of Codrops' ButtonHoverStyles, commit
// 3976fa1b65dced5d330db43c51081787c3e7b46e, css/base.css plus the markup shape
// in index.html. The effect is entirely CSS -- upstream ships no JavaScript at
// all, and neither does this -- so everything worth reading is in style.css:
// three of upstream's twenty-one treatments (mimas, hyperion and pallene,
// renamed sweep, swap and morph), transform for transform, keyframe for
// keyframe and cubic-bezier for cubic-bezier.
//
// mount() therefore has one job: write the chosen variant onto the section so
// the stylesheet's [data-fx-variant] rules select. The snippet already carries
// the default, so a page that never runs this module still gets working
// buttons, which is the point of porting a CSS-only upstream in the first
// place. There is no animation loop to cancel and no listener to remove; the
// browser owns the hover state, the focus state and prefers-reduced-motion.
export const meta = {
  name: "button-hovers",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    variant: { type: "string", default: "sweep", description: "Which upstream treatment to use: sweep (.button--mimas), swap (.button--hyperion) or morph (.button--pallene)." },
  },
};

const VARIANTS = ["sweep", "swap", "morph"];
const variantOf = (v) => (VARIANTS.includes(v) ? v : "sweep");

export function mount(el, opts = {}) {
  if (!el || typeof el.setAttribute !== "function") return { update() {}, destroy() {} };
  // The snippet ships with the default already on the element, so this only
  // ever changes it -- it never turns the effect on.
  const restore = el.getAttribute("data-fx-variant") ?? "sweep";
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
