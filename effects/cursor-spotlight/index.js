// Magic UI -- https://github.com/magicuidesign/magicui
//
// MIT License
// Copyright (c) Magic UI
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
//
// cursor-spotlight: a port of magicuidesign/magicui's MagicCard, commit
// 1246d6d404c556f03867fc6d447f2867eee8a42b,
// apps/www/registry/magicui/magic-card.tsx.
//
// Almost all of the port is deletion. Upstream is 222 lines of React: a
// discriminated union of two prop shapes, useTheme from next-themes, three
// motion/react springs, five refs kept in sync by five useEffects, and
// useMotionTemplate to interpolate the gradients. None of that is the effect.
// The effect is four numbers -- pointer x, pointer y, a radius, an opacity --
// and two radial gradients that read them, and the browser has a way to hand
// four numbers to CSS without any of the above: custom properties.
//
// What is kept is exactly the part that makes the picture, unchanged:
//   - the two-layer background, `linear-gradient(surface) padding-box` under a
//     `radial-gradient(...) border-box`, which is what lights the 1px border
//     ring under the cursor and leaves it flat everywhere else;
//   - both gradient stop lists, from/to/border on the ring and colour/
//     transparent on the wash, at upstream's 200px radius;
//   - the reset, which parks the gradient at -gradientSize rather than fading
//     it, on pointer leave, on a pointerout with no relatedTarget, on window
//     blur and on the tab going hidden.
//
// Two upstream details worth recording because they look like bugs and are
// not. The wash's opacity is CONSTANT: the Tailwind classes say `opacity-0
// ... group-hover:opacity-100` but the inline style sets `opacity:
// gradientOpacity`, and an inline style beats a class, so the hover rules
// never fire. Hiding is done entirely by parking the gradient off the card.
// And gradient mode uses the raw motion values, not the springs -- the springs
// are wired only to the orb mode this port drops -- so the wash tracks the
// pointer exactly, with no easing to reproduce.
export const meta = {
  name: "cursor-spotlight",
  version: "1.0.0",
  category: "cursor",
  needs: [],
  license: "MIT",
  options: {
    gradientSize: { type: "number", default: 200, description: "Radius in px of both the border ring and the wash. Upstream default 200." },
    gradientColor: { type: "string", default: "#262626", description: "The wash under the cursor. Upstream default #262626." },
    gradientOpacity: { type: "number", default: 0.8, description: "Constant opacity of the wash. Upstream default 0.8." },
    gradientFrom: { type: "string", default: "#9E7AFF", description: "Inner stop of the border ring. Upstream default #9E7AFF." },
    gradientTo: { type: "string", default: "#FE8BBB", description: "Outer stop of the border ring. Upstream default #FE8BBB." },
  },
};

// upstream default props, magic-card.tsx
const DEFAULTS = {
  gradientSize: 200,
  gradientColor: "#262626",
  gradientOpacity: 0.8,
  gradientFrom: "#9E7AFF",
  gradientTo: "#FE8BBB",
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  if (!el || typeof el.style?.setProperty !== "function") return { update() {}, destroy() {} };
  const options = { ...DEFAULTS, ...opts };

  const applyStatic = () => {
    el.style.setProperty("--fx-size", `${options.gradientSize}px`);
    el.style.setProperty("--fx-from", options.gradientFrom);
    el.style.setProperty("--fx-to", options.gradientTo);
    el.style.setProperty("--fx-glow", options.gradientColor);
    el.style.setProperty("--fx-glow-opacity", String(options.gradientOpacity));
  };

  // upstream `reset`: park the gradient a full radius outside the card rather
  // than fade it out, which is why nothing here animates opacity.
  const reset = () => {
    const off = `${-options.gradientSize}px`;
    el.style.setProperty("--fx-x", off);
    el.style.setProperty("--fx-y", off);
  };

  const onPointerMove = (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--fx-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--fx-y", `${e.clientY - rect.top}px`);
  };
  const onPointerLeave = reset;
  // Leaving the window entirely fires pointerout with no relatedTarget and no
  // pointerleave on the card, so without this the wash would freeze wherever
  // the pointer crossed the edge.
  const onGlobalPointerOut = (e) => { if (!e.relatedTarget) reset(); };
  const onBlur = reset;
  const onVisibility = () => { if (document.visibilityState !== "visible") reset(); };

  applyStatic();
  reset();

  // The wash is a pointer response rather than an animation, but the contract
  // for this library is that a reduced-motion visitor gets the resting state,
  // and the resting state here is a finished card. No listeners, no movement.
  //
  // canListen is separate from that, and it is a guard rather than a policy:
  // the custom properties above are worth writing anywhere, but the listeners
  // need a real element and a real window, and mount() must never throw at a
  // caller who has neither.
  const canListen =
    typeof el.addEventListener === "function" &&
    typeof window !== "undefined" &&
    typeof document !== "undefined";
  const live = canListen && !reducedMotion();
  if (live) {
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("pointerenter", onPointerMove);
    window.addEventListener("pointerout", onGlobalPointerOut);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    el.setAttribute("data-fx-live", "");
  }

  return {
    update(next = {}) {
      Object.assign(options, next);
      applyStatic();
      if (next.gradientSize != null) reset();
    },
    destroy() {
      if (live) {
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerleave", onPointerLeave);
        el.removeEventListener("pointerenter", onPointerMove);
        window.removeEventListener("pointerout", onGlobalPointerOut);
        window.removeEventListener("blur", onBlur);
        document.removeEventListener("visibilitychange", onVisibility);
      }
      el.removeAttribute("data-fx-live");
      for (const p of ["--fx-size", "--fx-from", "--fx-to", "--fx-glow", "--fx-glow-opacity", "--fx-x", "--fx-y"]) {
        el.style.removeProperty(p);
      }
    },
  };
}
