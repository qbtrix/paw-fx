// Codrops Sketches -- 013 Custom Cursor (two circles with filter effect)
// MIT License
// Copyright (c) 2022 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/codrops-sketches
//
// cursor-gooey: a port of sketch 013, commit
// bbf47ca34766fd2ca5f97d8b376d2eca148bf48f,
// 013-custom-cursor-filter/js/index.js plus the inline <svg><filter> block in
// its index.html, which is half the effect and ports verbatim into
// snippet.html.
//
// Two stroked rings chase the pointer at different lerp rates -- 0.15 and the
// 0.1 the second element asks for through data-amt -- so the trailing one is
// always a beat behind. Cross a link and both swell from r 20 to r 50 while an
// feTurbulence warps them: baseFrequency runs 0.35 -> 0 over a second on an
// expo curve, which reads as the ring shaking itself apart and re-forming.
// Leave the link and the warp is completed rather than cancelled, because its
// onComplete is what puts filter: none back.
//
// The lerp, the two amounts, both radii, the turbulence range and the curve
// are upstream's. What is not: the effect is scoped to its section instead of
// the window, the filter gets a unique id per mount so two of these on one
// page cannot warp each other, and the opacity channel upstream lerps but
// never uses now carries the show/hide as the pointer crosses the section
// edge.
//
// The resting state is the menu. The rings are the pointer's decoration, not
// the content: with the script blocked, on a coarse pointer or under
// prefers-reduced-motion the section is a finished list of links and the
// visitor keeps their own cursor, which stays visible here exactly as it does
// upstream.
import { animate } from "../../vendor/anime.esm.js";

export const meta = {
  name: "cursor-gooey",
  version: "1.0.0",
  category: "cursor",
  needs: ["anime"],
  license: "MIT",
  options: {
    amt: { type: "number", default: 0.15, description: "How closely the ring follows the pointer, 0 to 1. Upstream's renderedStyles amt; the second ring overrides it to 0.1 with data-amt." },
    radiusOnEnter: { type: "number", default: 50, description: "Ring radius while the pointer is over a link. Upstream's radiusOnEnter." },
    turbulence: { type: "number", default: 0.35, description: "Peak feTurbulence baseFrequency the warp starts from. Upstream's startAt turbulence." },
  },
};

const UPSTREAM = { amt: 0.15, radiusOnEnter: 50, turbulence: 0.35 };

// GSAP counts durations in seconds and anime.js in milliseconds.
const SECOND = 1000;

// Unique per mount, so two sections on one page do not share one filter id.
let seq = 0;

/**
 * Linear interpolation
 * @param {Number} a - first value to interpolate
 * @param {Number} b - second value to interpolate
 * @param {Number} n - amount to interpolate
 */
const lerp = (a, b, n) => (1 - n) * a + n * b;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// There is no pointer to decorate on a touch screen, and upstream hides the
// rings outright below its own breakpoint for the same reason.
const coarsePointer = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, no pointer, or a reader who asked for stillness: style.css has
  // already drawn the finished menu and the visitor keeps their own cursor.
  if (!el || typeof el.querySelector !== "function") return resting;
  if (reducedMotion() || coarsePointer()) return resting;

  const cursors = [...el.querySelectorAll(".fx-gooey__cursor")];
  const filter = el.querySelector(".fx-gooey__filter");
  const feTurbulence = filter?.querySelector("feTurbulence");
  if (!cursors.length || !feTurbulence) return resting;

  const settings = { ...UPSTREAM, ...opts };

  // Upstream reads a document-wide #cursor-filter. A registry item can appear
  // more than once on a page, and two <filter> elements with one id is a
  // silent cross-wire, so the id is minted here and both rings are pointed at
  // the new one.
  const filterId = `fx-gooey-filter-${++seq}`;
  filter.id = filterId;

  // Upstream tracks window mousemove into a module-scope object. Here the
  // pointer is measured against the section, because the rings are absolutely
  // positioned inside it.
  let cursor = { x: 0, y: 0 };
  let started = false;
  let frame = 0;
  const elements = [];

  // createFilterTimeline: baseFrequency 0.35 -> 0 over one second on expo,
  // with the filter switched on for the run and off at the end. Built per ring
  // rather than once, because each ring runs its own warp, and rebuildable so
  // update() can change the peak.
  const filterTimeline = (item) => animate(item.primitiveValues, {
    turbulence: [settings.turbulence, 0],
    duration: 1 * SECOND,
    ease: "outExpo",
    autoplay: false,
    onBegin: () => { item.inner.style.filter = `url(#${filterId})`; },
    onUpdate: () => { feTurbulence.setAttribute("baseFrequency", item.primitiveValues.turbulence); },
    onComplete: () => { item.inner.style.filter = "none"; },
  });

  // CursorElement, with the DOM/bounds/renderedStyles shape upstream uses.
  for (const node of cursors) {
    const inner = node.querySelector(".fx-gooey__ring");
    if (!inner) continue;
    const radius = Number(inner.getAttribute("r"));
    const amt = Number(node.dataset.amt || settings.amt);
    const item = {
      el: node,
      inner,
      radius,
      radiusOnEnter: Number(node.dataset.radiusEnter || settings.radiusOnEnter),
      bounds: node.getBoundingClientRect(),
      renderedStyles: {
        tx: { previous: 0, current: 0, amt },
        ty: { previous: 0, current: 0, amt },
        radius: { previous: radius, current: radius, amt },
        opacity: { previous: 0, current: 0, amt },
      },
      primitiveValues: { turbulence: 0 },
      warp: null,
    };
    item.warp = filterTimeline(item);
    elements.push(item);
  }
  if (!elements.length) return resting;

  // Cursor.enter / Cursor.leave, fanned out over every ring.
  const enter = () => {
    for (const item of elements) {
      item.renderedStyles.radius.current = item.radiusOnEnter;
      item.renderedStyles.opacity.current = 1;
      item.warp.restart();
    }
  };
  const leave = () => {
    for (const item of elements) {
      item.renderedStyles.radius.current = item.radius;
      item.renderedStyles.opacity.current = 1;
      // GSAP's progress(1).kill(): run the warp to its end so onComplete puts
      // filter: none back, rather than freezing it mid-warp.
      item.warp.complete();
    }
  };

  // CursorElement.render, verbatim apart from the frame handle.
  const render = () => {
    for (const item of elements) {
      item.renderedStyles.tx.current = cursor.x - item.bounds.width / 2;
      item.renderedStyles.ty.current = cursor.y - item.bounds.height / 2;

      for (const key in item.renderedStyles) {
        item.renderedStyles[key].previous = lerp(item.renderedStyles[key].previous, item.renderedStyles[key].current, item.renderedStyles[key].amt);
      }

      item.el.style.transform = `translateX(${(item.renderedStyles.tx.previous)}px) translateY(${item.renderedStyles.ty.previous}px)`;
      item.inner.setAttribute("r", item.renderedStyles.radius.previous);
      item.el.style.opacity = item.renderedStyles.opacity.previous;
    }
    frame = requestAnimationFrame(render);
  };

  const onMouseMove = (ev) => {
    const rect = el.getBoundingClientRect();
    cursor = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    if (started) return;
    started = true;
    // Upstream's onMouseMoveEv: seed previous with current so the ring appears
    // where the pointer already is instead of flying in from the origin.
    for (const item of elements) {
      item.bounds = item.el.getBoundingClientRect();
      item.renderedStyles.tx.previous = item.renderedStyles.tx.current = cursor.x - item.bounds.width / 2;
      item.renderedStyles.ty.previous = item.renderedStyles.ty.current = cursor.y - item.bounds.height / 2;
      item.renderedStyles.opacity.current = 1;
    }
    frame = requestAnimationFrame(render);
  };
  // The opacity channel upstream lerps but never varies is what fades the
  // rings out when the pointer leaves the section.
  const onSectionLeave = () => {
    for (const item of elements) item.renderedStyles.opacity.current = 0;
  };

  // Upstream binds every <a> in the document; a section binds its own.
  const triggers = [...el.querySelectorAll(".fx-gooey__link")];
  for (const link of triggers) {
    link.addEventListener("mouseenter", enter);
    link.addEventListener("mouseleave", leave);
  }
  el.addEventListener("mousemove", onMouseMove);
  el.addEventListener("mouseleave", onSectionLeave);
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      for (const item of elements) {
        item.radiusOnEnter = Number(item.el.dataset.radiusEnter || settings.radiusOnEnter);
        for (const key in item.renderedStyles) {
          item.renderedStyles[key].amt = Number(item.el.dataset.amt || settings.amt);
        }
        // The peak is baked into the warp's tween, so a changed turbulence
        // needs a new one rather than a new field.
        item.warp.revert();
        item.warp = filterTimeline(item);
      }
    },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onSectionLeave);
      for (const link of triggers) {
        link.removeEventListener("mouseenter", enter);
        link.removeEventListener("mouseleave", leave);
      }
      for (const item of elements) {
        item.warp.revert();
        item.el.style.transform = "";
        item.el.style.opacity = "";
        item.inner.style.filter = "";
        item.inner.setAttribute("r", item.radius);
      }
      el.removeAttribute("data-fx-live");
    },
  };
}
