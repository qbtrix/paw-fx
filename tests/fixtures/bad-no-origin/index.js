// Copyright (c) upstream authors. MIT License.
// aurora-css: CSS-only aurora hero. mount() marks the element live and
// exposes the speed option; the animation itself lives in style.css and
// already respects prefers-reduced-motion, so there is nothing to bail from.
export const meta = {
  name: "aurora-css",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: { speed: { type: "number", default: 1, description: "Drift speed multiplier; 1 = 28s per cycle." } },
};

export function mount(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  const apply = (o) => { if (o.speed != null) el.style.setProperty("--fx-speed", String(o.speed)); };
  apply(opts);
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) { apply(next); },
    destroy() { el.removeAttribute("data-fx-live"); el.style.removeProperty("--fx-speed"); },
  };
}
