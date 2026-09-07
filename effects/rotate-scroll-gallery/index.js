// Rotating on Scroll Animations
// MIT License
// Copyright (c) 2009 - 2026 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/RotatingOnScrollAnimations
//
// rotate-scroll-gallery: a port of Codrops' RotatingOnScrollAnimations, commit
// ebbe2c9bd80237d05c709475e47aad171030e21f. Its five variants sit at one sha as
// js/index.js through js/index5.js over one css/base.css; the default here is
// index5, with index, index3 and index4 behind the `variant` option.
//
// WHY index5 IS THE DEFAULT, AND WHY THIS EARNS A SLOT NEXT TO THE TWO SCROLL-
// DRIVEN 3D GALLERIES ALREADY HERE. scroll-3d-grid sweeps a whole wall sideways
// past a fixed camera; grid-3d-stagger tips cells in from their own side and
// back out. Both run their transform straight off scroll progress, so a picture
// is never still. index5 is the only variant that does something neither does:
// its holdAtMiddle() remaps progress so the middle 25% of the range returns a
// constant 0.5, and the picture stops. It flips in on X, squashes and stretches
// its own box on the way -- scaleX widening to 1.6 while scaleY collapses to 0.5
// -- brightens out of black, holds flat and legible while the reader passes it,
// then flips away again. The hold IS the effect: it is a card presenting itself,
// not a wall going by.
//
// THE LAYOUT IS THE OTHER HALF. The wrappers are offset sideways by a sine of
// their index, so a single column serpentines down the page instead of running
// straight, and a marquee scrubs across the whole section at the same time.
// Neither neighbour has either.
//
// GSAP IS BANNED HERE and ScrollTrigger goes with it. Every variant is
// ScrollTrigger.create({trigger: item, start: 'top bottom+=20%',
// end: 'bottom top-=20%', scrub: true, onUpdate}) with the maths in onUpdate;
// that becomes anime's onScroll with sync and an onUpdate reading e.progress.
// THE THRESHOLD SPELLING IS REVERSED between the two: GSAP writes
// `start: '<target> <container>'` and anime writes `enter: '<container>
// <target>'`, so 'top bottom+=20%' is enter 'bottom+=20% top' and
// 'bottom top-=20%' is leave 'top-=20% bottom'. Getting that round the wrong way
// does not throw -- it pins progress and leaves every card frozen at its start
// transform for the whole section.
//
// gsap.utils.interpolate and gsap.utils.mapRange are two lines of arithmetic and
// are written out. gsap.quickSetter is a style write. imagesLoaded only gated
// the reveal on photographs that do not ship here.
//
// LENIS IS NOT A DEPENDENCY. Upstream's initSmoothScrolling exists to drive
// ScrollTrigger.update off Lenis' own raf; anime's onScroll listens to the real
// scroll container, so nothing is needed. Smooth scrolling already ships
// separately as smooth-scroll and composes with this.
//
// NO PHOTOGRAPH SHIPS. Upstream carries 40 .webp files, 3.2 MB, licensed
// separately from its MIT code. Each cell paints a CSS gradient until a site
// sets --fx-img on it; see snippet.html.
import { createScope, onScroll, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "rotate-scroll-gallery",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    variant: { type: "string", default: "hold", description: "hold is upstream index5 (flip, squash, hold flat at the middle, flip away). tumble is index (a plain three-axis tumble). fold is index3 (a cosine fold with a saturate and brightness pass). spin is index4 (a Y-axis spin through the frame)." },
    amplitude: { type: "number", default: 0.05, description: "How far a row is offset sideways, as a fraction of the viewport width. Upstream's index5 amplitude of innerWidth * 0.05; the other variants use 0.2." },
    marquee: { type: "boolean", default: true, description: "Scrub the marquee strip across the section as it passes. Upstream's animateMarquee, x from 100vw to -100%." },
  },
};

// GSAP's ScrollTrigger start/end, in anime's spelling: container edge first,
// target edge second, which is the reverse of GSAP's order.
const ENTER = "bottom+=20% top";
const LEAVE = "top-=20% bottom";

// gsap.utils.interpolate(a, b, t) and gsap.utils.mapRange(inMin, inMax, outMin,
// outMax, v), both one line.
const interpolate = (a, b, t) => a + (b - a) * t;
const mapRange = (inMin, inMax, outMin, outMax, v) =>
  outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

// index5's holdAtMiddle: the middle `hold` of the range returns a flat 0.5, so
// the card stops and presents itself.
const holdAtMiddle = (progress, hold = 0.2) => {
  const half = hold * 0.5;
  if (progress < 0.5 - half) return mapRange(0, 0.5 - half, 0, 0.5, progress);
  if (progress > 0.5 + half) return mapRange(0.5 + half, 1, 0.5, 1, progress);
  return 0.5;
};

// Each variant is upstream's own onUpdate body, returning the transform and
// filter for one item at one progress. `r` carries the per-item random draws the
// variant makes once at setup.
const VARIANTS = {
  // js/index5.js
  hold: {
    amplitude: 0.05,
    angle: 0.9,
    draw: () => ({ rotationX: utils.random(130, 220), rotationZ: -50 }),
    at(p, r) {
      const t = holdAtMiddle(p, 0.25);
      return {
        transform: {
          scaleX: 1 + Math.pow(Math.cos(t * Math.PI), 2) * 0.6,
          scaleY: 0.5 + Math.pow(Math.sin(t * Math.PI), 2) * 0.5,
          rotateX: `${interpolate(-r.rotationX, r.rotationX, t)}deg`,
          rotateZ: `${interpolate(-r.rotationZ, r.rotationZ, t)}deg`,
          z: `${Math.sin(t * Math.PI) * -750}px`,
        },
        filter: `blur(${Math.pow(Math.cos(t * Math.PI), 2) * 12}px) brightness(${Math.pow(Math.sin(t * Math.PI), 6)})`,
      };
    },
  },
  // js/index.js
  tumble: {
    amplitude: 0.2,
    angle: 0.45,
    draw: () => ({
      rotationX: utils.random(70, 120),
      rotationY: utils.random(-20, 20),
      rotationZ: utils.random(-20, 20),
    }),
    at(p, r) {
      return {
        transform: {
          rotateX: `${interpolate(r.rotationX, -r.rotationX, p)}deg`,
          rotateY: `${interpolate(r.rotationY, -r.rotationY, p)}deg`,
          rotateZ: `${interpolate(r.rotationZ, -r.rotationZ, p)}deg`,
          z: `${Math.sin(p * Math.PI) * -50}px`,
        },
        filter: "none",
      };
    },
  },
  // js/index3.js
  fold: {
    amplitude: 0.2,
    angle: 0.45,
    draw: () => ({}),
    at(p) {
      return {
        transform: {
          rotateX: `${Math.sign(Math.cos(p * Math.PI)) * Math.pow(Math.abs(Math.cos(p * Math.PI)), 0.6) * 90}deg`,
          z: `${Math.pow(Math.sin(p * Math.PI), 8) * -800}px`,
          y: `${1 + Math.pow(Math.cos(p * Math.PI), 2) * -40}%`,
        },
        filter: `saturate(${Math.pow(Math.sin(p * Math.PI), 3)}) brightness(${Math.pow(Math.sin(p * Math.PI), 3)})`,
      };
    },
  },
  // js/index4.js
  spin: {
    amplitude: 0.2,
    angle: 1,
    draw: () => ({
      rotationX: utils.random(-10, 10),
      rotationY: utils.random(200, 290),
      rotationZ: utils.random(-10, 10),
    }),
    at(p, r) {
      return {
        transform: {
          rotateX: `${interpolate(r.rotationX, -r.rotationX, p)}deg`,
          rotateY: `${interpolate(r.rotationY, -r.rotationY, p)}deg`,
          rotateZ: `${interpolate(r.rotationZ, -r.rotationZ, p)}deg`,
          z: `${Math.sin(p * Math.PI) * -150}px`,
        },
        filter: "none",
      };
    },
  },
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const gallery = el.querySelector(".fx-rot__gallery");
  const wraps = [...el.querySelectorAll(".fx-rot__wrap")];
  const marqueeInner = el.querySelector(".fx-rot__marquee-inner");
  if (!gallery || !wraps.length) return resting;

  const items = wraps.map((w) => w.querySelector(".fx-rot__item")).filter(Boolean);
  if (items.length !== wraps.length) return resting;

  // Stillness at rest: the stylesheet already lays the gallery out flat and
  // legible, with every picture at full brightness and no rotation. That IS the
  // middle of this effect's range, so nothing is lost by skipping the flight.
  if (reducedMotion()) return resting;

  const settings = {
    variant: VARIANTS[opts.variant] ? opts.variant : "hold",
    marquee: opts.marquee !== false,
    amplitude: undefined,
  };
  settings.amplitude = num(opts.amplitude, VARIANTS[settings.variant].amplitude, 0, 1);

  let scope = null;
  const observers = [];

  const build = () => {
    const spec = VARIANTS[settings.variant];
    scope = createScope({ root: el }).add(() => {
      // positionGalleryItems(): each wrapper is offset sideways by the sine of
      // its index, which is what serpentines the column.
      const amplitude = window.innerWidth * settings.amplitude;
      wraps.forEach((wrap, i) => {
        utils.set(wrap, { x: Math.sin(i * spec.angle) * amplitude });
      });

      // initGalleryAnimation(): one scroll observer per item, over the item's
      // own range, writing upstream's transform and filter at every progress.
      for (const item of items) {
        const r = spec.draw();
        const write = (p) => {
          const { transform, filter } = spec.at(p, r);
          utils.set(item, transform);
          if (filter !== "none") utils.set(item, { filter });
        };
        write(0);
        observers.push(
          onScroll({
            target: item,
            enter: ENTER,
            leave: LEAVE,
            sync: true,
            onUpdate: (e) => write(e.progress),
          }),
        );
      }

      // animateMarquee(): x from 100vw to -100% across the whole gallery's
      // range, linear, scrubbed.
      if (settings.marquee && marqueeInner) {
        const writeMarquee = (p) => {
          utils.set(marqueeInner, { x: `${interpolate(100, -100, p)}%` });
        };
        writeMarquee(0.5);
        observers.push(
          onScroll({
            target: gallery,
            enter: "bottom top",
            leave: "top bottom",
            sync: true,
            onUpdate: (e) => writeMarquee(e.progress),
          }),
        );
      }
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    for (const o of observers) o.revert?.();
    observers.length = 0;
    // The scope owns the observers, the sideways offsets and every inline
    // transform, because each registered itself when it was constructed.
    // revert() strips them, which puts the gallery back flat rather than
    // freezing it wherever the scrollbar was.
    scope?.revert();
    scope = null;
  };

  return {
    update(next = {}) {
      if (!scope) return;
      if ("variant" in next && VARIANTS[next.variant]) settings.variant = next.variant;
      if ("marquee" in next) settings.marquee = next.marquee !== false;
      settings.amplitude = "amplitude" in next
        ? num(next.amplitude, VARIANTS[settings.variant].amplitude, 0, 1)
        : VARIANTS[settings.variant].amplitude;
      tear();
      build();
    },
    destroy() {
      tear();
      el.removeAttribute("data-fx-live");
    },
  };
}
