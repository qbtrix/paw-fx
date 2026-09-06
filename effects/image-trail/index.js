// codrops-sketches / 005-image-motion-trail-opaque
// The MIT License
// Copyright (c) 2022 Codrops (https://tympanus.net/codrops)
// https://github.com/codrops/codrops-sketches
//
// image-trail: a port of Codrops' sketch 005, commit
// bbf47ca34766fd2ca5f97d8b376d2eca148bf48f,
// 005-image-motion-trail-opaque/js/index.js plus its css/base.css. Five copies
// of one panel sit in the same grid cell. Every frame each copy lerps toward
// the pointer's position mapped into a -90..90px range, with its own
// interpolation amount 0.02*pos + 0.05, so the topmost copy is the fastest and
// the ones behind it lag further and further -- which is what smears the panel
// into a trail while the pointer is moving and closes it back to a single
// panel when it stops.
//
// lerp, map, the render loop, totalTrailElements, valuesFromTo, the amt curve
// and the transform string are upstream's, unchanged. There is no animation
// library here and there was none upstream: the sketch is a requestAnimationFrame
// loop and nothing else.
//
// Three things are ours. The trail elements are divs painted from --fx-image,
// not <img> tags read out of the host element's background-image, because a
// section library ships no photography and the effect has to look deliberate
// with the placeholder gradient in style.css. The pointer is tracked on the
// section rather than on the window, so two trails on one page do not drive
// each other. And the loop stops on destroy, where upstream's recurses forever.
//
// The resting state is the panel stack sitting still at the identity
// transform, which is exactly what style.css draws: with the script blocked,
// the bundle pruned, or reduced motion on, the section is a single centred
// panel and the copy beside it.
export const meta = {
  name: "image-trail",
  version: "1.0.0",
  category: "cursor",
  needs: [],
  license: "MIT",
  options: {
    total: { type: "number", default: 5, description: "How many copies make up the trail. Upstream's totalTrailElements." },
    travel: { type: "number", default: 90, description: "Pixels the trail swings either side of centre across the section. Upstream's valuesFromTo x/y bound." },
  },
};

const UPSTREAM = { total: 5, travel: 90 };

// index.js, verbatim.
const lerp = (a, b, n) => (1 - n) * a + n * b;
const map = (x, a, b, c, d) => (x - a) * (d - c) / (b - a) + c;
// The interpolation amount for the copy at `pos`: the higher the value the
// faster that copy catches up, so the stack fans by lag rather than by offset.
const amt = (pos) => 0.02 * pos + 0.05;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the panel at rest, and a trail that follows a pointer is the definition of
  // motion this visitor asked not to have.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const host = el.querySelector(".fx-trail__stack");
  if (!host || typeof requestAnimationFrame !== "function") return resting;

  const settings = { ...UPSTREAM, ...opts };
  const original = host.innerHTML;
  let frame = 0;
  let els = [];
  let transforms = [];
  // Upstream reads a window-sized cursor; here the section is the frame, so
  // the pointer is measured against the section's own box and starts centred.
  let box = { width: 1, height: 1, left: 0, top: 0 };
  let cursor = { x: 0.5, y: 0.5 };

  const measure = () => {
    // Upstream maps the pointer across the whole visual frame (the window);
    // here the section IS that frame, so the swing is measured across it
    // rather than across the panel the copies sit in.
    const r = el.getBoundingClientRect();
    box = { width: r.width || 1, height: r.height || 1, left: r.left, top: r.top };
  };

  const onMove = (ev) => {
    measure();
    cursor = { x: (ev.clientX - box.left) / box.width, y: (ev.clientY - box.top) / box.height };
  };

  // layout(): one element per trail copy, all in the same grid cell.
  const build = () => {
    let innerHTML = "";
    for (let i = 0; i <= settings.total - 1; ++i) {
      innerHTML += `<div class="fx-trail__img" aria-hidden="true"></div>`;
    }
    host.innerHTML = innerHTML;
    els = [...host.querySelectorAll(".fx-trail__img")];
    transforms = [...new Array(settings.total)].map(() => ({ x: 0, y: 0 }));
  };

  // render(): upstream's loop. Each copy interpolates toward the mapped
  // pointer position by its own amount, so the lag is what draws the trail.
  const render = () => {
    for (let i = 0; i <= settings.total - 1; ++i) {
      const a = amt(i);
      transforms[i].x = lerp(transforms[i].x, map(cursor.x, 0, 1, -settings.travel, settings.travel), a);
      transforms[i].y = lerp(transforms[i].y, map(cursor.y, 0, 1, -settings.travel, settings.travel), a);
      els[i].style.transform = `translateX(${transforms[i].x}px) translateY(${transforms[i].y}px)`;
    }
    frame = requestAnimationFrame(render);
  };

  build();
  measure();
  el.addEventListener("mousemove", onMove);
  window.addEventListener("resize", measure);
  frame = requestAnimationFrame(render);
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      Object.assign(settings, next);
      build();
    },
    destroy() {
      // Upstream's loop recurses forever, because its page never tears the
      // sketch down. Here it has to stop, or a page transition leaves a
      // requestAnimationFrame writing transforms into detached nodes.
      cancelAnimationFrame(frame);
      el.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", measure);
      host.innerHTML = original;
      el.removeAttribute("data-fx-live");
    },
  };
}
