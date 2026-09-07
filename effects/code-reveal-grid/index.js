// Gradient Mask Hover Effect from Evervault
// MIT License
// Copyright (c) 2009 - 2023 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/AnimatedCodeBackground
//
// code-reveal-grid: a port of Codrops' AnimatedCodeBackground, commit
// 4aa37f6d011b3c36bb9c18f77ecd91de5a08f6d0, js/item.js and js/utils.js, with
// the mask and the tile block from css/base.css.
//
// The mechanism is not a tween. Each tile holds a full-size layer of 2000
// random characters at opacity 0, masked by
// `radial-gradient(300px circle at var(--x) var(--y), black 20%, rgba(0,0,0,.25), transparent)`.
// A rAF loop lerps --x and --y toward the pointer at amt 0.1, so the readable
// window drags behind the hand, and every pointer move rerolls the whole
// 2000-character string underneath it. All of that -- the Item.renderedStyles
// table, the scrollDiff correction, getRandomString and its character set --
// is upstream's and unchanged.
//
// GSAP appears in three calls and none of them is the effect: two `gsap.to`
// fades on the layer's opacity and one `gsap.set` writing the two custom
// properties. The fades become anime `animate()` at the same 0.5s with
// `outQuart`, which is what GSAP's `power3` resolves to (its power scale is
// power1=Quad, power2=Cubic, power3=Quart, and a bare name means .out). The
// `gsap.set` becomes two setProperty calls, which is all it ever was --
// upstream only reaches for it because GSAP infers the `px` unit from the
// declared `--x: 0px`.
//
// The resting state is the grid itself: six tiles, each painting the
// radial-gradient plate base.css gives it, with its label and tag. Nothing is
// hidden waiting for the script -- the character layer is opacity 0 until a
// pointer arrives and it is decoration, not content.
import { animate } from "../../vendor/anime.esm.js";

export const meta = {
  name: "code-reveal-grid",
  version: "1.0.0",
  category: "backgrounds",
  needs: ["anime"],
  license: "MIT",
  options: {
    amt: { type: "number", default: 0.1, description: "Lerp amount for the mask position. The lower it is, the further the window lags behind the pointer. Upstream's renderedStyles amt." },
    chars: { type: "number", default: 2000, description: "How many random characters each tile holds. Upstream's getRandomString(2000)." },
    fade: { type: "number", default: 0.5, description: "Seconds the character layer takes to fade in and out. Upstream's gsap.to duration." },
  },
};

// item.js: renderedStyles amt, getRandomString(2000), gsap.to duration .5.
const UPSTREAM = { amt: 0.1, chars: 2000, fade: 0.5 };

// GSAP durations are seconds and anime's are milliseconds. Upstream's numbers
// stay written as upstream wrote them and this is the only conversion.
const MS = 1000;

// utils.js, verbatim.
const lerp = (a, b, n) => (1 - n) * a + n * b;
const getMousePos = (e) => ({ x: e.clientX, y: e.clientY });
const getRandomString = (length) => {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelectorAll !== "function") return resting;

  const tiles = [...el.querySelectorAll(".fx-code-grid__tile")];
  if (!tiles.length || typeof window === "undefined") return resting;
  // A reader who asked for stillness gets the grid the stylesheet already
  // drew. Nothing here is content, so there is nothing to reveal.
  if (reducedMotion()) return resting;

  const settings = { ...UPSTREAM, ...opts };

  // Upstream keeps `mousepos` at module scope behind one window listener.
  // Scoped here so two of these on one page do not share a position, and so
  // destroy() has something to remove.
  let mousepos = { x: 0, y: 0 };
  const onWindowMove = (ev) => { mousepos = getMousePos(ev); };
  window.addEventListener("mousemove", onWindowMove);

  // Item, one per tile.
  const items = tiles.map((tileEl) => {
    const deco = tileEl.querySelector(".fx-code-grid__deco");
    const item = {
      el: tileEl,
      deco,
      renderedStyles: {
        x: { previous: 0, current: 0, amt: settings.amt },
        y: { previous: 0, current: 0, amt: settings.amt },
      },
      randomString: getRandomString(settings.chars),
      scrollVal: { x: window.scrollX, y: window.scrollY },
      rect: tileEl.getBoundingClientRect(),
      requestId: undefined,
      fade: null,
    };

    // Item.calculateSizePosition
    item.recalc = () => {
      item.scrollVal = { x: window.scrollX, y: window.scrollY };
      item.rect = tileEl.getBoundingClientRect();
    };

    // Item.render
    item.render = (isFirstTick) => {
      item.requestId = undefined;
      const scrollDiff = {
        x: item.scrollVal.x - window.scrollX,
        y: item.scrollVal.y - window.scrollY,
      };
      item.renderedStyles.x.current = (mousepos.x - (scrollDiff.x + item.rect.left));
      item.renderedStyles.y.current = (mousepos.y - (scrollDiff.y + item.rect.top));

      if (isFirstTick) {
        item.renderedStyles.x.previous = item.renderedStyles.x.current;
        item.renderedStyles.y.previous = item.renderedStyles.y.current;
      }

      for (const key in item.renderedStyles) {
        item.renderedStyles[key].previous = lerp(item.renderedStyles[key].previous, item.renderedStyles[key].current, item.renderedStyles[key].amt);
      }

      // gsap.set(el, {'--x', '--y'}), which appends px because base.css
      // declares `--x: 0px` on the tile.
      tileEl.style.setProperty("--fx-x", `${item.renderedStyles.x.previous}px`);
      tileEl.style.setProperty("--fx-y", `${item.renderedStyles.y.previous}px`);

      if (deco) deco.innerHTML = item.randomString;

      item.loopRender();
    };

    // Item.loopRender
    item.loopRender = (isFirstTick = false) => {
      if (!item.requestId) item.requestId = requestAnimationFrame(() => item.render(isFirstTick));
    };

    // Item.stopRendering
    item.stopRendering = () => {
      if (item.requestId) {
        window.cancelAnimationFrame(item.requestId);
        item.requestId = undefined;
      }
    };

    return item;
  });

  const onResize = () => { for (const item of items) item.recalc(); };
  window.addEventListener("resize", onResize);

  // Item.initEvents, one closure per tile so destroy() can unbind them.
  const bound = items.map((item) => {
    const onMove = () => { item.randomString = getRandomString(settings.chars); };
    const onEnter = () => {
      item.fade?.pause();
      item.fade = animate(item.deco, {
        duration: settings.fade * MS,
        ease: "outQuart",
        opacity: 1,
      });
      const isFirstTick = true;
      item.loopRender(isFirstTick);
    };
    const onLeave = () => {
      item.stopRendering();
      item.fade?.pause();
      item.fade = animate(item.deco, {
        duration: settings.fade * MS,
        ease: "outQuart",
        opacity: 0,
      });
    };
    item.el.addEventListener("mousemove", onMove);
    item.el.addEventListener("mouseenter", onEnter);
    item.el.addEventListener("mouseleave", onLeave);
    return { item, onMove, onEnter, onLeave };
  });

  el.setAttribute("data-fx-live", "");

  return {
    // amt applies straight away; chars applies to the next reroll, which is
    // the next pointer move.
    update(next = {}) {
      Object.assign(settings, next);
      if (next.amt != null) {
        for (const item of items) for (const key in item.renderedStyles) item.renderedStyles[key].amt = settings.amt;
      }
    },
    destroy() {
      window.removeEventListener("mousemove", onWindowMove);
      window.removeEventListener("resize", onResize);
      for (const { item, onMove, onEnter, onLeave } of bound) {
        item.stopRendering();
        item.fade?.pause();
        item.el.removeEventListener("mousemove", onMove);
        item.el.removeEventListener("mouseenter", onEnter);
        item.el.removeEventListener("mouseleave", onLeave);
        item.el.style.removeProperty("--fx-x");
        item.el.style.removeProperty("--fx-y");
        if (item.deco) { item.deco.innerHTML = ""; item.deco.style.removeProperty("opacity"); }
      }
      el.removeAttribute("data-fx-live");
    },
  };
}
