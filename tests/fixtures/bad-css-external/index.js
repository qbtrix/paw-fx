// fixture: clean index.js, so style.css is the only thing failing lint here.
export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  el.setAttribute("data-fx-live", "");
  return { update() {}, destroy() { el.removeAttribute("data-fx-live"); } };
}
