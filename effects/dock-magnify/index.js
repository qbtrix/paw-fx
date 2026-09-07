// Magic UI
// MIT License
// Copyright (c) Magic UI
// https://github.com/magicuidesign/magicui
//
// dock-magnify: a port of Magic UI's Dock component, commit
// 1246d6d404c556f03867fc6d447f2867eee8a42b,
// apps/www/registry/magicui/dock.tsx -- the same commit this repo already
// cites for marquee-css and cursor-spotlight.
//
// THE MECHANISM. The bar tracks one number: the pointer's x. Each icon maps
// its own distance from that x onto a size, linearly, from `magnification` at
// zero distance down to `size` at `distance` pixels away and no further --
// which is upstream's useTransform([-distance, 0, distance], [size,
// magnification, size]). The result is fed through a spring, so the icons
// settle rather than snap. Leaving the bar sets the pointer to Infinity, which
// collapses every icon back to its base size through the same path.
//
// Every number is upstream's: size 40, magnification 60, distance 140, padding
// max(6, size * 0.2), and the spring's mass 0.1 / stiffness 150 / damping 12.
//
// WHAT REPLACES REACT. framer-motion's useMotionValue / useSpring / useTransform
// become one anime createAnimatable per icon with a spring ease, driven from a
// pointermove listener; class-variance-authority and the Tailwind class
// strings become the rules in style.css. The precedent is in this repo already:
// marquee-css and cursor-spotlight are both React-source ports.
import { createAnimatable, spring, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "dock-magnify",
  version: "1.0.0",
  category: "menu",
  needs: ["anime"],
  license: "MIT",
  options: {
    size: { type: "number", default: 40, description: "Resting icon size in pixels. Upstream's DEFAULT_SIZE. Set --fx-dock-size to match." },
    magnification: { type: "number", default: 60, description: "Size in pixels of the icon directly under the pointer. Upstream's DEFAULT_MAGNIFICATION." },
    distance: { type: "number", default: 140, description: "How far along x the pointer's influence reaches, in pixels. Upstream's DEFAULT_DISTANCE." },
  },
};

const UPSTREAM = { size: 40, magnification: 60, distance: 140 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const bar = el.querySelector(".fx-dock__bar");
  const icons = [...el.querySelectorAll(".fx-dock__item")];
  if (!bar || !icons.length) return resting;
  // A reader who asked for stillness gets upstream's own disableMagnification
  // mode: the bar is a finished row of links at their resting size, which is a
  // complete piece of navigation rather than a downgraded one.
  if (reducedMotion()) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let torn = false;
  let animatables = [];

  const build = () => {
    animatables = icons.map((icon) => createAnimatable(icon, {
      // useSpring({ mass: 0.1, stiffness: 150, damping: 12 }) -- anime's spring
      // takes the same three names, so the numbers travel unchanged.
      width: { ease: spring({ mass: 0.1, stiffness: 150, damping: 12 }), unit: "px" },
      height: { ease: spring({ mass: 0.1, stiffness: 150, damping: 12 }), unit: "px" },
    }));
    el.setAttribute("data-fx-live", "");
  };

  // useTransform(distanceCalc, [-distance, 0, distance], [size, target, size]):
  // a clamped linear ramp, which is what this is.
  const sizeFor = (icon, pointerX) => {
    const { size, magnification, distance } = settings;
    if (!Number.isFinite(pointerX)) return size;
    const b = icon.getBoundingClientRect();
    const d = pointerX - b.x - b.width / 2;
    const t = Math.min(1, Math.abs(d) / distance);
    return magnification + (size - magnification) * t;
  };

  const apply = (pointerX) => {
    if (torn) return;
    for (let i = 0; i < icons.length; i++) {
      const next = sizeFor(icons[i], pointerX);
      animatables[i].width(next);
      animatables[i].height(next);
    }
  };

  // Upstream reads e.pageX and compares it against getBoundingClientRect().x,
  // which is a viewport coordinate -- the two disagree by the scroll offset.
  // It never shows on the docs page because that page does not scroll
  // sideways, but a bar inside a horizontally scrolled page would magnify the
  // wrong icon. clientX is the coordinate the rect is in.
  const onMove = (e) => apply(e.clientX);
  const onLeave = () => apply(Infinity);

  build();
  bar.addEventListener("pointermove", onMove);
  bar.addEventListener("pointerleave", onLeave);

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      apply(Infinity);
    },
    destroy() {
      torn = true;
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerleave", onLeave);
      for (const a of animatables) a.revert();
      animatables = [];
      // revert() restores the animatable's own writes; this clears the inline
      // width and height so the icons go back to the stylesheet's size.
      utils.set(icons, { width: "", height: "" });
      el.removeAttribute("data-fx-live");
    },
  };
}
