// Horizontal Parallax Gallery
// MIT License
// Copyright (c) 2009 - 2025 Codrops (https://codrops.com)
// https://github.com/davidfaure/horizontal-parallax-gallery-codrops
//
// parallax-gallery-horizontal: a port of David Faure's Horizontal Parallax
// Gallery for Codrops, commit 49c3ead7b70bf9acfee9d73664c26971b2381a19. The
// 2D/DOM variant (index.html), not index2.html's WebGL twin. Four upstream
// files carry the whole effect: src/main.ts is the scroll model,
// src/gallery/index.ts the strip transform and the per-image counter-motion,
// src/gallery/gallery.css the 125%-wide image inside a clipped frame, and
// src/utils/math.ts the two maths helpers.
//
// THE MECHANISM, all upstream. A wheel adds deltaY to a target; the target is
// clamped to scrollWidth - clientWidth so the strip never runs past its own
// end; current lerps toward target at 0.07 a frame; the strip is written as
// translateX(-current). Each image then counter-translates inside its own
// frame by -t * 10 percent, where t is how far the frame's centre sits from
// the centre of the viewport, -1 at the left edge and 1 at the right. The
// frame is clipped and the image is 125% wide at left: -12.5%, which is the
// headroom those 10 percent ride in.
//
// GSAP IS BANNED HERE and this port carries none. It supplied exactly two
// things -- GSAP.utils.interpolate and GSAP.utils.clamp, both in
// src/utils/math.ts -- so lerp() and clamp() below are written out. (Worth
// recording: the source assessment said GSAP was imported nowhere under src/.
// It is imported in math.ts. Nothing else changes, because those two helpers
// are one line each, but the manifest is not what settled it -- the file is.)
//
// The resting state is a real native scroll box: the wrapper is overflow-x:
// auto until mount() sets data-fx-live, so a blocked script, a pruned bundle
// or prefers-reduced-motion still gets every frame and can still reach the
// last one. What the reader loses is the lerp and the parallax, which is the
// effect and not the content.
export const meta = {
  name: "parallax-gallery-horizontal",
  version: "1.0.0",
  category: "gallery",
  needs: [],
  license: "MIT",
  options: {
    ease: { type: "number", default: 0.07, description: "How much of the remaining distance the strip closes each frame. Upstream's scroll.ease in src/main.ts." },
    shift: { type: "number", default: 10, description: "Percent of its own width an image counter-translates inside its frame at the edge of the viewport. Upstream's maxShift in src/gallery/index.ts." },
  },
};

const UPSTREAM = { ease: 0.07, shift: 10 };

// src/utils/math.ts, written out. GSAP.utils.interpolate on two numbers is the
// linear one, and GSAP.utils.clamp takes min and max ahead of the value --
// upstream's argument order, kept so the call sites still read like upstream's.
const lerp = (p1, p2, t) => p1 + (p2 - p1) * t;
const clamp = (min, max, value) => Math.max(min, Math.min(max, value));

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// A knob a site sets to 0 or to a string would park the strip at frame one
// while the stylesheet has already been switched to overflow: hidden, which
// puts the rest of the gallery behind a dead box. Upstream never reads a knob
// from outside, so this guard is ours.
const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? clamp(min, max, n) : fallback;
};

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const wrapper = el.querySelector(".fx-hpgal__wrapper");
  const strip = el.querySelector(".fx-hpgal__strip");
  if (!wrapper || !strip) return resting;

  // Reduced motion leaves the native scroll box exactly as the stylesheet drew
  // it. Every frame stays reachable; nothing is trapped behind an animation.
  if (reducedMotion()) return resting;

  const images = Array.from(el.querySelectorAll(".fx-hpgal__image"));
  const settings = {
    ease: num(opts.ease, UPSTREAM.ease, 0.01, 1),
    shift: num(opts.shift, UPSTREAM.shift, 0, 100),
  };

  // src/main.ts Scroll, minus the WebGL half of the union.
  const scroll = { current: 0, target: 0, limit: 0 };
  let raf = null;
  let torn = false;

  // setLimit(). Upstream measures container.scrollWidth against
  // wrapper.clientWidth; a strip narrower than its wrapper has no travel and
  // the max() keeps that at rest rather than at a negative limit.
  const setLimit = () => {
    scroll.limit = Math.max(0, strip.scrollWidth - wrapper.clientWidth);
  };

  // onWheel(). Upstream's page cannot scroll -- css/base.css pins the body to
  // 100dvh with overflow: hidden -- so its passive wheel listener owns the
  // wheel outright. A section on a page that does scroll cannot own it
  // outright, so the default is prevented only while the strip still has
  // travel in the direction asked for, and released at either end so the page
  // carries on. The listener is on the section, never on window: two of these
  // on one page would otherwise both answer the same wheel.
  const onWheel = (e) => {
    const next = scroll.target + e.deltaY;
    if (next > 0 && next < scroll.limit) e.preventDefault();
    scroll.target += e.deltaY;
  };

  // Gallery.applyParallaxEffect(). Upstream measures against window.innerWidth
  // because its gallery is the page; here the centre is the wrapper's own, so
  // a gallery inside a narrower column still reads -1 at its left edge and 1
  // at its right.
  const applyParallaxEffect = () => {
    const box = wrapper.getBoundingClientRect();
    const viewportCenter = box.left + box.width * 0.5;
    const half = box.width * 0.5 || 1;

    for (const image of images) {
      const parent = image.parentElement;
      if (!parent) continue;

      const rect = parent.getBoundingClientRect();
      const elementCenter = rect.left + rect.width * 0.5;

      // -1 (left) .. 0 (center) .. 1 (right)
      const t = clamp(-1, 1, (elementCenter - viewportCenter) / half);

      // For CSS: image width 125% (extra 25% => 12.5% each side)
      // translateX(%) is relative to image width (125%), so safe max ~= 10%
      const shift = -t * settings.shift; // counter-motion
      image.style.transform = `translate3d(${shift}%, 0, 0)`;
    }
  };

  // App.render(), with Gallery.render() folded in: upstream's render() clamps,
  // lerps, writes the strip and then calls the gallery's, which writes the
  // transform and the parallax.
  const render = () => {
    scroll.target = clamp(0, scroll.limit, scroll.target);
    scroll.current = lerp(scroll.current, scroll.target, settings.ease);
    strip.style.transform = `translateX(${scroll.current < 0.01 ? 0 : -scroll.current}px)`;
    applyParallaxEffect();
    raf = requestAnimationFrame(render);
  };

  // The native scroll box has to be back at its start before the transform
  // takes over, or a reader who scrolled it before the script arrived would
  // see the strip jump.
  wrapper.scrollLeft = 0;
  setLimit();

  wrapper.addEventListener("wheel", onWheel, { passive: false });

  // Upstream listens for window resize. A section is resized by things a
  // window resize never reports -- a sibling collapsing, a font landing, a
  // container query -- so this watches the box itself.
  const ro = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => { if (!torn) setLimit(); })
    : null;
  ro?.observe(wrapper);

  el.setAttribute("data-fx-live", "");
  render();

  return {
    update(next = {}) {
      if ("ease" in next) settings.ease = num(next.ease, UPSTREAM.ease, 0.01, 1);
      if ("shift" in next) settings.shift = num(next.shift, UPSTREAM.shift, 0, 100);
      setLimit();
    },
    destroy() {
      torn = true;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      wrapper.removeEventListener("wheel", onWheel);
      ro?.disconnect();
      strip.style.transform = "";
      for (const image of images) image.style.transform = "";
      el.removeAttribute("data-fx-live");
    },
  };
}
