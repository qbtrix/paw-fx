// fixture: a ported effect carrying no upstream header comment at all. Its
// `export const meta` block still has the allow-list field every effect is
// required to declare, and the old rule matched that field's own line, so a
// port with no header passed lint with exit 0. Deliberately has a top-of-file
// comment: the rule has to want a header, not merely any comment.
export const meta = {
  name: "bad-no-header",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {},
};

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  el.setAttribute("data-fx-live", "");
  return { update() {}, destroy() { el.removeAttribute("data-fx-live"); } };
}
