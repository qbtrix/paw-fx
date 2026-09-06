// Magic UI
// MIT License
// Copyright (c) Magic UI
// https://github.com/magicuidesign/magicui
//
// marquee-css: a port of Magic UI's Marquee, commit
// 1246d6d404c556f03867fc6d447f2867eee8a42b, apps/www/registry/magicui/
// marquee.tsx plus the keyframes it animates with, apps/www/styles/globals.css
// (`@keyframes marquee` / `marquee-vertical` and the `--animate-marquee*`
// theme variables).
//
// The port is mostly deletion, which is what a React component becomes when it
// lands in a vanilla library. Upstream's component is Tailwind utility classes
// plus `Array(repeat).fill(0).map(...)`; the classes compile to CSS we can
// write directly, and the repeat is four copies of the row in snippet.html.
// What survives is the part that was never React: the keyframes, the duration
// and gap variables, and the reverse / pause-on-hover switches.
//
// So this file has almost nothing to do. The section is finished with CSS
// alone, exactly like aurora-css, and mount() only publishes the options.
// Nothing here starts a timer or touches the marquee's motion, so there is no
// reduced-motion branch to write either: style.css stops the animation.
export const meta = {
  name: "marquee-css",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    duration: { type: "string", default: "40s", description: "One full traverse of a row. Upstream's [--duration:40s]." },
    gap: { type: "string", default: "1rem", description: "Space between items and between the repeated rows. Upstream's [--gap:1rem]. The keyframes subtract it, so it has to be a length." },
    pauseOnHover: { type: "boolean", default: false, description: "Pause every row while the pointer is over the band. Upstream's group-hover:[animation-play-state:paused]." },
  },
};

// Upstream's own defaults, from the Tailwind classes on the outer div.
const UPSTREAM = { duration: "40s", gap: "1rem", pauseOnHover: false };

// A length, not a bare number: the keyframes read --fx-gap inside
// calc(-100% - var(--fx-gap)), which is invalid with a unitless value and
// leaves the row parked. Rejecting it here keeps a bad option from silently
// freezing the band.
const LENGTH = /^-?(?:\d+\.?\d*|\.\d+)(?:s|ms|px|r?em|v[wh]|%|ch|ex|pt|cm|mm|in|pc|q)$|^0$/i;
const lengthOr = (v, fallback) => (typeof v === "string" && LENGTH.test(v.trim()) ? v.trim() : fallback);

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  const apply = (o) => {
    if (o.duration != null) el.style.setProperty("--fx-duration", lengthOr(o.duration, UPSTREAM.duration));
    if (o.gap != null) el.style.setProperty("--fx-gap", lengthOr(o.gap, UPSTREAM.gap));
    if (o.pauseOnHover != null) el.toggleAttribute("data-fx-pause-on-hover", !!o.pauseOnHover);
  };
  apply(opts);
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) { apply(next); },
    destroy() {
      el.removeAttribute("data-fx-live");
      el.removeAttribute("data-fx-pause-on-hover");
      el.style.removeProperty("--fx-duration");
      el.style.removeProperty("--fx-gap");
    },
  };
}
