// page-fade: the page transition is style.css. This file exists because the
// library contract is mount(el, opts) -> { update, destroy }, and because the
// three knobs the keyframes read have to land on :root rather than on the
// section -- the ::view-transition pseudo-elements hang off the root element's
// pseudo tree, so a custom property set on the section never reaches them.
//
// There is no loop to cancel, no observer to disconnect and no library to
// load. `@view-transition { navigation: auto }` opts both documents into a
// cross-document transition and the browser runs it; a browser without support
// ignores the at-rule and navigates normally, which is the correct fallback
// and is why there is no feature test guarding anything here.
//
// This is NOT a port. swup was staged for this slot and dropped: every ES
// module build it publishes carries unresolvable bare specifiers and a
// generated site has no build step to rewrite them. meta.json.origin says
// paw-fx and meta.json.deviations records the choice.
export const meta = {
  name: "page-fade",
  version: "1.0.0",
  category: "transition",
  needs: [],
  license: "MIT",
  options: {
    duration: { type: "string", default: "420ms", description: "Length of the cross-document fade." },
    easing: { type: "string", default: "cubic-bezier(0.32, 0.72, 0, 1)", description: "Timing function for both halves." },
    shift: { type: "string", default: "10px", description: "How far the incoming page settles upward." },
  },
};

const KNOBS = { duration: "--fx-duration", easing: "--fx-ease", shift: "--fx-shift" };

export function mount(el, opts = {}) {
  if (!el || typeof document === "undefined") return { update() {}, destroy() {} };

  // The knobs go on the document element, not on the section, because that is
  // the only place the view-transition pseudo tree inherits from.
  const root = document.documentElement;
  const written = new Set();
  const apply = (o) => {
    for (const [key, prop] of Object.entries(KNOBS)) {
      if (o[key] == null) continue;
      root.style.setProperty(prop, String(o[key]));
      written.add(prop);
    }
  };
  apply(opts);

  // Reported rather than acted on: the fallback for a browser without support
  // is an ordinary navigation, which needs no help from us. A site that wants
  // to style around it can hang CSS off the attribute.
  if (typeof document.startViewTransition === "function") {
    el.setAttribute("data-fx-live", "");
  }

  return {
    update(next = {}) { apply(next); },
    destroy() {
      el.removeAttribute("data-fx-live");
      for (const prop of written) root.style.removeProperty(prop);
      written.clear();
    },
  };
}
