// anime.js
// The MIT License
// Copyright (c) 2025 Julian Garnier
// https://github.com/juliangarnier/anime
//
// morph-nav: a port of anime.js' auto-layout/nav example, commit
// 01b81be1df6843ccfe0a71c0699a746bf740dd77, examples/auto-layout/nav/index.js
// plus examples/auto-layout/nav/index.html, which carries the design -- the
// nav bar, the absolutely-positioned .button-bg pill inside the active button,
// and the display:none / display:block panel switch are that file's rules.
//
// THE MECHANISM. There is exactly ONE pill element on the page. Clicking a tab
// physically appends it into that tab, and an anime createLayout on the list
// measures every child before and after the move and springs it across --
// FLIP, in the library we already vendor. GSAP ships the same capability only
// in its paid Flip plugin, which is the whole reason this port exists here. A
// second createLayout on the content region records the panels, the swap
// changes which one is display:block, and animate() crossfades the pair and
// tweens the region's height to the new panel's.
//
// Every number is upstream's: spring bounce 0.2 over 350ms on the pill, and
// opacity 0 in / out at 500ms with enter delayed 200ms, eases inOut(3) and
// out(3), on the panel.
//
// REDUCED MOTION IS NOT "DO NOTHING" HERE. A particle field is decoration and
// a mount that returns early leaves the section finished. This is a tab
// control: the switching IS the function and only the spring is decoration. So
// the click handler is wired either way, and the preference only decides
// whether the two layouts exist to animate the swap.
import { createLayout, spring } from "../../vendor/anime.esm.js";

export const meta = {
  name: "morph-nav",
  version: "1.0.0",
  category: "menu",
  needs: ["anime"],
  license: "MIT",
  options: {
    bounce: { type: "number", default: 0.2, description: "Overshoot on the pill's spring. Upstream's spring({ bounce })." },
    duration: { type: "number", default: 350, description: "Milliseconds the pill takes to reach the new tab. Upstream's spring({ duration })." },
    fade: { type: "number", default: 500, description: "Milliseconds of the panel crossfade. Upstream's enterFrom/leaveTo duration." },
    enterDelay: { type: "number", default: 200, description: "Milliseconds the incoming panel waits before fading up. Upstream's enterFrom delay." },
  },
};

const UPSTREAM = { bounce: 0.2, duration: 350, fade: 500, enterDelay: 200 };

// Two of these sections on one page ship the same aria-controls / id pairs
// twice, and a duplicate id resolves to the first one in the document -- so
// the second bar's tabs would point at the first bar's panels. One suffix per
// mount fixes it for every instance after the first.
let seq = 0;


const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const list = el.querySelector(".fx-morphnav__list");
  const content = el.querySelector(".fx-morphnav__content");
  const pill = el.querySelector(".fx-morphnav__pill");
  const tabs = [...el.querySelectorAll(".fx-morphnav__tab")];
  const panels = [...el.querySelectorAll(".fx-morphnav__panel")];
  if (!list || !content || !pill || !tabs.length || !panels.length) return resting;

  const suffix = ++seq > 1 ? `-${seq}` : "";
  if (suffix) {
    for (const node of [...tabs, ...panels]) {
      if (node.id) node.id += suffix;
      for (const attr of ["aria-controls", "aria-labelledby"]) {
        const v = node.getAttribute(attr);
        if (v) node.setAttribute(attr, v + suffix);
      }
    }
  }

  const settings = { ...UPSTREAM, ...opts };
  let navLayout = null;
  let contentLayout = null;
  let torn = false;

  // Upstream's two createLayout calls. Both take a selector there, which finds
  // the first match in the whole document -- so two sections on one page would
  // both drive the first one's nav. Scoped to this mount's own elements here.
  const buildLayouts = () => {
    if (reducedMotion()) return;
    navLayout = createLayout(list, {
      ease: spring({ bounce: settings.bounce, duration: settings.duration }),
    });
    contentLayout = createLayout(content, {
      enterFrom: { opacity: 0, duration: settings.fade, delay: settings.enterDelay, ease: "inOut(3)" },
      leaveTo: { opacity: 0, duration: settings.fade, ease: "out(3)" },
    });
    el.setAttribute("data-fx-live", "");
  };
  buildLayouts();

  // The swap itself: move the one pill into the clicked tab, then flip which
  // panel is displayed. Upstream does exactly this inside nav.update()'s
  // callback, between content.record() and content.animate().
  const swap = (tab) => {
    tab.appendChild(pill);
    for (const t of tabs) t.setAttribute("aria-selected", String(t === tab));
    const key = tab.dataset.panel;
    for (const p of panels) p.classList.toggle("is-active", p.dataset.panel === key);
  };

  const onClick = (e) => {
    if (torn) return;
    const tab = e.target.closest(".fx-morphnav__tab");
    // closest() walks out of the section too, so a click on a tab belonging to
    // a SECOND morph-nav further up the page would otherwise drive this one.
    if (!tab || !tabs.includes(tab)) return;
    if (tab.getAttribute("aria-selected") === "true") return;
    if (!navLayout || !contentLayout) { swap(tab); return; } // reduced motion
    navLayout.update(() => {
      contentLayout.record();
      swap(tab);
      contentLayout.animate();
    });
  };
  el.addEventListener("click", onClick);

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      navLayout?.revert();
      contentLayout?.revert();
      navLayout = contentLayout = null;
      el.removeAttribute("data-fx-live");
      buildLayouts();
    },
    destroy() {
      torn = true;
      el.removeEventListener("click", onClick);
      // revert() completes any running timeline and restores the inline styles
      // the FLIP wrote, so the section is left as its stylesheet describes it.
      navLayout?.revert();
      contentLayout?.revert();
      navLayout = contentLayout = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
