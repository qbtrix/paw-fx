// Codrops Sketches -- 011 Custom Cursor (filled circle)
// MIT License
// Copyright (c) 2022 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/codrops-sketches
//
// cursor-follow: a port of sketch 011, commit
// bbf47ca34766fd2ca5f97d8b376d2eca148bf48f,
// 011-custom-cursor-filled-circle/js/index.js and css/base.css, with the
// data-scale-enter / data-opacity-enter defaults read off index.html.
//
// Upstream has no dependency at all. The mechanism is four lerped channels --
// tx, ty, scale, opacity, all at amt 0.2 -- driven by a rAF loop, written out
// as one transform string plus an opacity. Crossing a link sets the scale and
// opacity targets to the data-attribute values (2 and .8 in the demo) and
// leaving resets both to 1; the lerp does the easing, so there is no tween
// library here to replace. lerp(), the CursorElement channel table, the
// centring by half the element's bounds and the transform string are
// upstream's, unchanged.
//
// What changed is scope. Upstream is a page: one cursor, a window mousemove
// listener that never stops, a rAF loop that runs for the life of the tab, and
// enter/leave bound to every <a> in the document. A paw-fx effect is a section
// that may appear twice on one page, so the cursor lives inside its own
// section, the triggers are that section's links, and the loop runs only while
// the pointer is actually over the section. Two of these on one page each
// answer their own hover and neither leaves a rAF running behind it.
//
// The resting state is the menu itself. With the script blocked the section is
// a readable list of links and the reader keeps the native pointer; the SVG is
// opacity 0 in the stylesheet, which is where upstream's `el.style.opacity = 0`
// has to move to so a no-script page does not park a circle in the corner.
export const meta = {
  name: "cursor-follow",
  version: "1.0.0",
  category: "cursor",
  needs: [],
  license: "MIT",
  options: {
    scaleOnEnter: { type: "number", default: 2, description: "Scale the circle grows to over a link. Upstream's data-scale-enter on the demo's .cursor svg." },
    opacityOnEnter: { type: "number", default: 0.8, description: "Opacity the circle fades to over a link. Upstream's data-opacity-enter." },
    amt: { type: "number", default: 0.2, description: "Lerp amount for all four channels. The lower it is, the slower the circle follows. Upstream's renderedStyles amt." },
  },
};

// index.html's .cursor attributes, and the renderedStyles amt in index.js.
const UPSTREAM = { scaleOnEnter: 2, opacityOnEnter: 0.8, amt: 0.2 };

// utils, verbatim.
const lerp = (a, b, n) => (1 - n) * a + n * b;
const getCursorPos = (ev) => ({ x: ev.clientX, y: ev.clientY });

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// base.css gates the whole cursor behind @media (any-pointer: fine). Checking
// it here too keeps the listeners off a touch device rather than running a
// loop that paints a hidden element.
const finePointer = () =>
  typeof matchMedia !== "function" || matchMedia("(any-pointer: fine)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const $cursor = el.querySelector(".fx-cursor-follow__cursor");
  if (!$cursor || typeof window === "undefined") return resting;
  // The reader asked for stillness, or there is no pointer to follow: the
  // section is already a finished menu and the native cursor is the right
  // answer.
  if (reducedMotion() || !finePointer()) return resting;

  const settings = { ...UPSTREAM, ...opts };

  // Upstream's `cursor` module-level position object, scoped to this instance.
  let cursor = { x: 0, y: 0 };

  // CursorElement.renderedStyles, verbatim apart from taking its amt from the
  // options rather than a data attribute.
  const renderedStyles = {
    tx: { previous: 0, current: 0, amt: settings.amt },
    ty: { previous: 0, current: 0, amt: settings.amt },
    scale: { previous: 1, current: 1, amt: settings.amt },
    opacity: { previous: 1, current: 1, amt: settings.amt },
  };

  let bounds = $cursor.getBoundingClientRect();
  let requestId = null;
  let started = false;

  const render = () => {
    requestId = null;
    renderedStyles.tx.current = cursor.x - bounds.width / 2;
    renderedStyles.ty.current = cursor.y - bounds.height / 2;

    for (const key in renderedStyles) {
      renderedStyles[key].previous = lerp(renderedStyles[key].previous, renderedStyles[key].current, renderedStyles[key].amt);
    }

    $cursor.style.transform = `translateX(${renderedStyles.tx.previous}px) translateY(${renderedStyles.ty.previous}px) scale(${renderedStyles.scale.previous})`;
    $cursor.style.opacity = renderedStyles.opacity.previous;

    requestId = requestAnimationFrame(render);
  };

  // Upstream starts on the first window mousemove and never stops. Here the
  // loop belongs to the section: it starts when the pointer arrives and stops
  // when it leaves, which is also what makes destroy() able to stop it.
  const start = () => {
    bounds = $cursor.getBoundingClientRect();
    // CursorElement's onMouseMoveEv: seed previous and current together so the
    // circle appears where the pointer is rather than lerping in from 0,0.
    // Upstream writes `ty.previous = ty.previous` on the second line, which
    // leaves ty.current at 0 for exactly one frame.
    renderedStyles.tx.previous = renderedStyles.tx.current = cursor.x - bounds.width / 2;
    renderedStyles.ty.previous = renderedStyles.ty.current = cursor.y - bounds.height / 2;
    if (!started) {
      started = true;
      $cursor.style.opacity = renderedStyles.opacity.previous;
    }
    if (requestId === null) requestId = requestAnimationFrame(render);
  };

  const stop = () => {
    if (requestId !== null) cancelAnimationFrame(requestId);
    requestId = null;
    started = false;
    $cursor.style.opacity = 0;
  };

  const onPointerMove = (ev) => {
    cursor = getCursorPos(ev);
    if (requestId === null) start();
  };
  const onPointerLeave = () => stop();

  // Cursor.enter / Cursor.leave, scoped to this section's links.
  const enter = () => {
    renderedStyles.scale.current = settings.scaleOnEnter;
    renderedStyles.opacity.current = settings.opacityOnEnter;
  };
  const leave = () => {
    renderedStyles.scale.current = 1;
    renderedStyles.opacity.current = 1;
  };

  const links = [...el.querySelectorAll("a")];
  for (const link of links) {
    link.addEventListener("mouseenter", enter);
    link.addEventListener("mouseleave", leave);
  }
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerleave", onPointerLeave);
  // Leaving the window entirely fires neither on the section, so the circle
  // would freeze wherever the pointer crossed the edge.
  const onGlobalPointerOut = (ev) => { if (!ev.relatedTarget) stop(); };
  window.addEventListener("pointerout", onGlobalPointerOut);
  window.addEventListener("blur", stop);

  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      if (next.amt != null) for (const key in renderedStyles) renderedStyles[key].amt = settings.amt;
    },
    destroy() {
      stop();
      for (const link of links) {
        link.removeEventListener("mouseenter", enter);
        link.removeEventListener("mouseleave", leave);
      }
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerout", onGlobalPointerOut);
      window.removeEventListener("blur", stop);
      $cursor.style.removeProperty("transform");
      $cursor.style.removeProperty("opacity");
      el.removeAttribute("data-fx-live");
    },
  };
}
