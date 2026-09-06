// fixture: the tsParticles slim bundle publishes globalThis.tsParticles rather
// than exporting it. Reading it here, at module scope, runs at import time and
// is the failure this rule exists for. These comment lines name the same
// identifiers on purpose: comment lines must not trip the scan.
import "../../vendor/tsparticles.slim.bundle.min.js";

const engine = globalThis.tsParticles;

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  return { update() {}, destroy() { void engine; } };
}
