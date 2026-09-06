// Smoke fixture. Everything visible is painted here, from script, which is the
// whole point: with the script blocked nothing runs and style.css leaves an
// empty rectangle behind. The self-mount at the bottom is what lets the
// snippet reference this file with a plain <script type="module" src>, the one
// script shape lint allows, so the fixture is blocked by the same mechanism a
// real effect would be. Never ship an effect shaped like this.
export const meta = { name: "bad-blank-section", version: "1.0.0", category: "backgrounds", needs: [], license: "MIT", options: {} };

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  el.style.setProperty("background", "linear-gradient(120deg, #5b3df5, #14b8a6)");
  return {
    update() {},
    destroy() { el.style.removeProperty("background"); },
  };
}

document.querySelectorAll('[data-fx="bad-blank-section"]').forEach((el) => mount(el));
