// fixture: a side-effect import of a vendor file that meta.needs omits. The
// path is relative, so lint is right to pass it; only the registry build can
// catch this, and only if it scans side-effect imports. Guards the shared
// jsSpecifiers seam between lint.mjs and build-registry.mjs. The filename is
// anime's real one from vendor/manifest.json, because the build now resolves a
// vendor import through the manifest rather than assuming <key>.js.
import "../../vendor/anime.esm.js";

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  return { update() {}, destroy() {} };
}
