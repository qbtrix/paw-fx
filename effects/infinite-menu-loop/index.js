// Scroll Loop Menu
// MIT License
// Copyright (c) 2009 - 2020 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/ScrollLoopMenu
//
// infinite-menu-loop: a port of Codrops' ScrollLoopMenu, commit
// 38257822c0bf1579ded7a17e6800acfd808014d3, src/js/infinitemenu.js plus the
// .menu rules in src/css/base.css.
//
// The whole mechanism is upstream's and it uses no animation library at all.
// The menu is its own scroll container; enough items to fill it are cloned and
// appended, and a rAF loop watches scrollTop: land within a clone-block of the
// bottom and it snaps to 1, hit the top and it snaps to scrollHeight -
// clonesHeight. Because the two ends are the same picture, the seam is
// invisible and the list reads as endless. The 1px offsets are upstream's and
// they matter -- parking at exactly 0 leaves nothing to scroll upwards into.
//
// NOT ported: the user-agent regex upstream opens with, which skips the effect
// on anything matching a 2013-era device table. The modern statement of the
// same intent is a media query, and the reason it exists is not "mobile" but
// momentum scrolling: writing scrollTop under a touch fling fights the
// compositor. So the gate is (pointer: coarse), and a coarse pointer gets the
// plain scrollable list -- which is exactly what upstream's mobile branch
// showed too.
//
// The resting state is that list. style.css draws a finished menu with no
// clones and no loop, so a blocked script, a pruned bundle or a reduced-motion
// reader still gets every item, in order, scrollable.
export const meta = {
  name: "infinite-menu-loop",
  version: "1.0.0",
  category: "menu",
  needs: [],
  license: "MIT",
  options: {},
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// Upstream's isMobile, restated. See the header: the thing that actually
// breaks is a programmatic scrollTop landing in the middle of a touch fling.
const coarsePointer = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, a coarse pointer, or a reader who asked for stillness: style.css
  // has already drawn the finished menu, so leaving it alone is correct.
  if (!el || typeof el.querySelector !== "function") return resting;
  if (reducedMotion() || coarsePointer()) return resting;

  const menu = el.querySelector(".fx-loopmenu__menu");
  const items = menu ? [...menu.querySelectorAll(".fx-loopmenu__item")] : [];
  if (!menu || !items.length) return resting;

  let clonesHeight = 0;
  let scrollHeight = 0;
  let scrollPos = 0;
  let frame = 0;

  // InfiniteMenu.getScrollPos / setScrollPos. The scroll container here is the
  // menu rather than the window, so pageYOffset is never the branch taken.
  const getScrollPos = () => (menu.pageYOffset || menu.scrollTop) - (menu.clientTop || 0);
  const setScrollPos = (pos) => { menu.scrollTop = pos; };

  // InfiniteMenu.cloneItems: clone as many items from the head of the list as
  // fit in one screenful, and append them. Upstream measures against
  // window.innerHeight because its menu IS the window; here the menu is a
  // section-sized scroll container, so it measures against its own box.
  const cloneItems = () => {
    const itemHeight = items[0].offsetHeight;
    if (!itemHeight) return false;
    const fitIn = Math.ceil(menu.clientHeight / itemHeight);

    menu.querySelectorAll(".fx-loopmenu__clone").forEach((clone) => menu.removeChild(clone));

    let totalClones = 0;
    items.filter((_, index) => (index < fitIn)).map((target) => {
      const clone = target.cloneNode(true);
      clone.classList.add("fx-loopmenu__clone");
      // Not upstream. A clone is the same link twice in the accessibility tree
      // and a second tab stop that goes nowhere, so it is hidden from both.
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("a").forEach((a) => a.setAttribute("tabindex", "-1"));
      menu.appendChild(clone);
      ++totalClones;
    });

    clonesHeight = totalClones * itemHeight;
    scrollHeight = menu.scrollHeight;
    return clonesHeight > 0 && scrollHeight > clonesHeight;
  };

  // InfiniteMenu.initScroll: park one pixel down so there is somewhere to
  // scroll up into.
  const initScroll = () => {
    scrollPos = getScrollPos();
    if (scrollPos <= 0) setScrollPos(1);
  };

  // InfiniteMenu.scrollUpdate, with one fix.
  //
  // Upstream's upward wrap lands on `scrollHeight - clonesHeight`, and its
  // downward test fires at `clonesHeight + scrollPos >= scrollHeight` -- the
  // same number. Because fitIn is a ceil, clonesHeight is always at least a
  // screenful, so the two are exactly equal on every layout rather than only
  // on unlucky ones: scrolling up off the top bounces straight back to 1 and
  // the loop only ever works downwards. Measured here: 8 clones at 2155 /
  // 772, upward wrap target 1355, downward trigger 1355.
  //
  // The fix is upstream's own idiom at the other end -- park one pixel inside
  // the boundary, exactly as initScroll parks at 1 rather than at 0.
  const scrollUpdate = () => {
    scrollPos = getScrollPos();

    if (clonesHeight + scrollPos >= scrollHeight) {
      setScrollPos(1);
    } else if (scrollPos <= 0) {
      setScrollPos(scrollHeight - clonesHeight - 1);
    }
  };

  // InfiniteMenu.render, with the handle kept so destroy() can stop it.
  const render = () => {
    scrollUpdate();
    frame = requestAnimationFrame(render);
  };

  const onResize = () => {
    if (cloneItems()) initScroll();
  };

  if (!cloneItems()) return resting;
  initScroll();
  window.addEventListener("resize", onResize);
  frame = requestAnimationFrame(render);
  el.setAttribute("data-fx-live", "");

  return {
    // Nothing to tune: upstream carries no options and the clone count is
    // measured, not configured. A relayout is the one thing worth re-running.
    update() { onResize(); },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener("resize", onResize);
      menu.querySelectorAll(".fx-loopmenu__clone").forEach((clone) => menu.removeChild(clone));
      menu.scrollTop = 0;
      el.removeAttribute("data-fx-live");
    },
  };
}
