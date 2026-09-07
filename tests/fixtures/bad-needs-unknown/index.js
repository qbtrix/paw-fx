// fixture: meta.needs names a vendor key that no longer exists. swup is dropped
// from the project -- every ES module build it publishes carries unresolvable
// bare specifiers -- so page transitions use the native View Transitions API
// instead. Fails twice on purpose: the schema enum and the vendor manifest.
export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  return { update() {}, destroy() {} };
}
