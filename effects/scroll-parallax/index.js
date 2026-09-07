// scroll-parallax: the parallax is style.css. Four depth layers plus the copy
// are driven by the browser's own scroll-driven animations
// (`animation-timeline: view()`), so there is no scroll listener here, no
// requestAnimationFrame loop, and nothing to tear down but one custom
// property.
//
// This is NOT a port, and that is a deliberate finding rather than a shortcut.
// Every parallax in the Codrops corpus -- all 345 repositories -- is built on
// GSAP ScrollSmoother, Lenis or Locomotive Scroll. GSAP is the licence this
// library rejected and ScrollSmoother is a paid plugin on top of it, so there
// is no vanilla upstream to port and claiming one would put a false origin in
// front of the fidelity gate. meta.json.origin says paw-fx and
// meta.json.deviations records the reasoning.
//
// mount() exposes one knob. --fx-travel scales all five keyframe ranges
// together, so a section can be made shallower or deeper without touching the
// stylesheet, and the keyframes stay symmetric around zero either way -- which
// is what keeps the un-animated frame, the one a reduced-motion visitor and a
// browser without scroll-driven animations both see, at the midpoint of the
// travel rather than at one end of it.
export const meta = {
  name: "scroll-parallax",
  version: "1.0.0",
  category: "scroll",
  needs: [],
  license: "MIT",
  options: {
    travel: { type: "number", default: 1, description: "Scales how far every layer moves. 0 pins the section to its static composition. Clamped to 0-3." },
  },
};

const TRAVEL_MIN = 0;
const TRAVEL_MAX = 3;
const travelOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(TRAVEL_MAX, Math.max(TRAVEL_MIN, n)) : 1;
};

export function mount(el, opts = {}) {
  if (!el || typeof el.style?.setProperty !== "function") return { update() {}, destroy() {} };
  // Clamped because the keyframes multiply by it: a large value throws the
  // layers clean out of the section and a negative one inverts the depth
  // order, so the near ridge would move slower than the sky.
  const apply = (o) => { if (o.travel != null) el.style.setProperty("--fx-travel", String(travelOf(o.travel))); };
  apply(opts);
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) { apply(next); },
    destroy() {
      el.removeAttribute("data-fx-live");
      el.style.removeProperty("--fx-travel");
    },
  };
}
