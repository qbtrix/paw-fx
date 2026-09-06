// aurora-css: CSS-only aurora hero. mount() marks the element live and
// exposes the speed option; the animation itself lives in style.css and
// already respects prefers-reduced-motion, so there is nothing to bail from.
// speed is clamped because style.css divides by it: 0 yields a 1.79769e+308s
// duration that silently freezes the effect, and a negative yields 0s. This
// effect is the template every port copies, so the clamp belongs here.
export const meta = {
  name: "aurora-css",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: { speed: { type: "number", default: 1, description: "Drift speed multiplier; 1 = 28s per cycle. Clamped to 0.1-10." } },
};

const SPEED_MIN = 0.1;
const SPEED_MAX = 10;
const speedOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(SPEED_MAX, Math.max(SPEED_MIN, n)) : 1;
};

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  const apply = (o) => { if (o.speed != null) el.style.setProperty("--fx-speed", String(speedOf(o.speed))); };
  apply(opts);
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) { apply(next); },
    destroy() { el.removeAttribute("data-fx-live"); el.style.removeProperty("--fx-speed"); },
  };
}
