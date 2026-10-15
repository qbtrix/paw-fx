// scroll-reveal-css: the reveal is style.css. Each element carrying a
// `data-mogp-motion` attribute is driven by the browser's own scroll-driven
// animations (`animation-timeline: view()`), so there is no scroll listener
// here, no IntersectionObserver, no requestAnimationFrame loop, and nothing to
// tear down but the live marker. mount() has no options: upstream's knobs are
// per-element attributes, which belong in the markup, not in a mount call.
//
// Ported from withmehmet/mogp-motion (mogp-motion.css, with the section
// derived from index.html's demo cards) at e2db8dd2.
// MIT License. Copyright (c) 2026 withmehmet.
export const meta = {
  name: "scroll-reveal-css",
  version: "1.0.0",
  category: "scroll",
  needs: [],
  license: "MIT",
  options: {},
};

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  el.setAttribute("data-fx-live", "");
  return {
    update() {},
    destroy() { el.removeAttribute("data-fx-live"); },
  };
}
