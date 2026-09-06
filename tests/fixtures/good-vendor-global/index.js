// fixture: the allowed shape of the globals exception. The vendored bundle may
// publish globalThis.tsParticles; the effect reads it inside mount(), never at
// module scope, so importing this file touches nothing. Must lint clean.
import "../../vendor/tsparticles.slim.bundle.min.js";

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const engine = globalThis.tsParticles;
  const loaded = engine && globalThis.loadSlim(engine);
  el.setAttribute("data-fx-live", "");
  return { update() {}, destroy() { void loaded; el.removeAttribute("data-fx-live"); } };
}
