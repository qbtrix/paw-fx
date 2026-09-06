// fixture: a self-contained shared runtime, the shape effects/_shared/ carries.
// Imports nothing, which is the rule the build enforces on shared files.
export const mountStub = (el) => ({ update() {}, destroy() { el.removeAttribute("data-fx-live"); } });
