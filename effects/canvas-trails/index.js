// anime.js
// The MIT License
// Copyright (c) 2025 Julian Garnier
// https://github.com/juliangarnier/anime
//
// canvas-trails: a port of anime.js' canvas-2d example, commit
// 01b81be1df6843ccfe0a71c0699a746bf740dd77, examples/canvas-2d/index.js plus
// examples/canvas-2d/index.html, which carries the black canvas the trails are
// drawn over.
//
// THE MECHANISM. Every dot is a plain object, not a DOM node, and anime tweens
// its x, y and radius. Each one is re-targeted to a random point in the
// section the moment it arrives, with a duration proportional to the distance
// it has to travel -- which is what keeps a field of thousands from pulsing in
// step. One timer draws them all: a 10% black rectangle over the whole canvas
// first, so the previous frame decays instead of being cleared, then every dot
// composited with 'screen'. That decay IS the trail, and it is the only route
// to this look in this repo -- the tsParticles trail plugin is not in the
// vendored slim bundle.
//
// Every number is upstream's: 4000 particles, the four warm colours, the
// device ratio of 2, radius 1 at birth then random(2, 6), duration |diff * 20|
// per axis, ease 'out(1)', the 0.1 fade alpha, and squarePi = 2 * 2 * Math.PI
// as the arc's end angle.
import { animate, createTimer, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "canvas-trails",
  version: "1.0.0",
  category: "particles",
  needs: ["anime"],
  license: "MIT",
  options: {
    count: { type: "number", default: 4000, description: "Dots in the field at a full-size section. Upstream's maxParticules, which it reads off the query string." },
    fade: { type: "number", default: 0.1, description: "Alpha of the black rectangle laid over each frame. Upstream's ctx.globalAlpha before the fill; lower it for longer trails." },
  },
};

// examples/canvas-2d/index.js
const COLORS = ["#FF4B4B", "#FF8F42", "#FFC730", "#F6FF56"];
const UPSTREAM = { count: 4000, fade: 0.1 };
const squarePi = 2 * 2 * Math.PI;

// The section a full count is sized for. A phone runs the same number of live
// tweens as a desktop unless something scales it, and the tween count is the
// cost here, not the pixel count.
const FULL_AREA = 1440 * 900;
const MIN_COUNT = 500;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn a
  // still warm field, so leaving it alone is the finished section.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const canvasEl = el.querySelector("canvas[data-fx-canvas]");
  if (!canvasEl || typeof canvasEl.getContext !== "function") return resting;
  const ctx = canvasEl.getContext("2d", { alpha: false });
  if (!ctx) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let torn = false;
  let particules = [];
  let drawTimer = null;
  let observer = null;
  const viewport = { width: 0, height: 0 };

  // Upstream measures the window; a section is measured from its own box.
  function setCanvasSize() {
    const width = Math.max(1, el.clientWidth);
    const height = Math.max(1, el.clientHeight);
    const ratio = 2;
    canvasEl.width = width * ratio;
    canvasEl.height = height * ratio;
    canvasEl.style.width = width + "px";
    canvasEl.style.height = height + "px";
    // Assigning width resets the transform, so this does not accumulate.
    ctx.scale(ratio, ratio);
    viewport.width = width;
    viewport.height = height;
  }

  function createParticule(x, y) {
    return {
      x,
      y,
      color: utils.randomPick(COLORS),
      radius: 1,
    };
  }

  function drawParticule(p) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.radius, 0, squarePi, true);
    ctx.fill();
  }

  function animateParticule(p) {
    // The guard is what stops the chain: onComplete re-arms this, so without
    // it a destroyed section keeps spawning tweens forever.
    if (torn) return;
    const newX = utils.random(0, viewport.width);
    const diffX = newX - p.x;
    const durX = Math.abs(diffX * 20);
    const newY = utils.random(0, viewport.height);
    const diffY = newY - p.y;
    const durY = Math.abs(diffY * 20);
    animate(p, {
      x: { to: newX, duration: durX },
      y: { to: newY, duration: durY },
      radius: utils.random(2, 6),
      ease: "out(1)",
      onComplete: () => { animateParticule(p); },
    });
  }

  const build = () => {
    setCanvasSize();
    const area = viewport.width * viewport.height;
    const n = Math.max(MIN_COUNT, Math.round(settings.count * Math.min(1, area / FULL_AREA)));
    for (let i = 0; i < n; i++) {
      // Upstream seeds every dot at the centre. A dot moves at 20ms per pixel,
      // so from there the field takes half a minute to reach the edges -- fine
      // on a demo page you sit and watch, wrong for a section a visitor
      // scrolls to and reads. Seeding across the box is the same field, from
      // its steady state rather than from a point.
      const p = createParticule(utils.random(0, viewport.width), utils.random(0, viewport.height));
      particules.push(p);
      animateParticule(p);
    }

    drawTimer = createTimer({
      onUpdate: () => {
        if (torn) return;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = settings.fade;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < particules.length; i++) {
          drawParticule(particules[i]);
        }
      },
    });

    observer = new ResizeObserver(setCanvasSize);
    observer.observe(el);
    el.setAttribute("data-fx-live", "");
  };

  const teardown = () => {
    drawTimer?.cancel();
    drawTimer = null;
    observer?.disconnect();
    observer = null;
    // Every dot is a plain object, and utils.remove() takes those as targets.
    utils.remove(particules);
    particules = [];
    el.removeAttribute("data-fx-live");
  };

  build();

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      teardown();
      build();
    },
    destroy() {
      torn = true;
      teardown();
    },
  };
}
