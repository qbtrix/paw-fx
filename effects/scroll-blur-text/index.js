// Scroll Blur Typography
// MIT License
// Copyright (c) 2009 - 2024 [Codrops](https://tympanus.net/codrops)
// https://github.com/codrops/ScrollBlurTypography
//
// scroll-blur-text: a port of Codrops' ScrollBlurTypography, commit
// 3e64d4bdae65b1f291e21a9a9c4b2ac6258c45c1, js/effect-1/blurScrollEffect.js
// plus js/textSplitter.js and css/base.css. The whole effect upstream is one
// tween -- I read the file, that really is all of it:
//
//   gsap.fromTo(chars,
//     { filter: 'blur(10px) brightness(0%)', willChange: 'filter' },
//     { ease: 'none', filter: 'blur(0px) brightness(100%)', stagger: 0.05,
//       scrollTrigger: { trigger: textElement, start: 'top bottom-=15%',
//                        end: 'bottom center+=15%', scrub: true } });
//
// Every value there is carried below unchanged. The three mechanical
// translations forced by dropping GSAP (its licence bars use in a tool that
// lets people build animations without writing code, which is what a site
// agent is):
//
//   1. ease 'none' is anime's 'linear'.
//   2. ScrollTrigger writes "start: 'target container'"; anime's onScroll
//      writes enter as "container target" -- the halves are the other way
//      round. So 'top bottom-=15%' becomes 'bottom-=15% top' and
//      'bottom center+=15%' becomes 'center+=15% bottom'. Verified against
//      the vendored build rather than assumed.
//   3. GSAP counts seconds, anime milliseconds, so upstream's 0.05 stagger
//      and its 0.5 default fromTo duration are kept verbatim and multiplied
//      by MS at the call site.
//
// anime interpolates a two-function filter string numerically -- measured, at
// half way through the tween the computed style is `blur(5px) brightness(0.5)`
// -- so this is the same mechanism upstream uses and not a re-implementation.
//
// The resting state is the finished headline, sharp and at full brightness.
// The blur is written only when the reveal is linked to the scrollbar, so with
// the script blocked, the bundle pruned or reduced motion on the section reads
// as ordinary type. Upstream inverts that: its page hides everything behind a
// loading class until its fonts resolve, which a section on someone else's
// site cannot do.
import { animate, onScroll, splitText, stagger } from "../../vendor/anime.esm.js";

export const meta = {
  name: "scroll-blur-text",
  version: "1.0.0",
  category: "text",
  needs: ["anime"],
  license: "MIT",
  options: {
    blur: { type: "number", default: 10, description: "Pixels of blur each character starts at. Upstream's filter: blur(10px)." },
    stagger: { type: "number", default: 0.05, description: "Seconds between one character sharpening and the next. Upstream's stagger." },
    sync: { type: "number", default: 0, description: "How closely the reveal tracks the scrollbar; 0 keeps upstream's scrub: true." },
  },
};

// Seconds upstream, milliseconds here.
const MS = 1000;
const UPSTREAM = { blur: 10, stagger: 0.05, sync: 0 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn
  // the finished headline, so leaving it alone is the correct outcome.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;

  const target = el.querySelector(".fx-blurtext__copy");
  if (!target) return resting;

  const settings = { ...UPSTREAM, ...opts };
  let split = null;

  const build = () => {
    // Elements, never selector strings: a page may legitimately carry this
    // section twice, and passing the nodes this section actually holds is what
    // stops the second mount animating the first one's characters.
    split = splitText(target, { chars: true });
    split.addEffect((sp) => {
      const chars = sp.chars;
      if (!chars.length) return () => {};
      const animation = animate(chars, {
        filter: [`blur(${settings.blur}px) brightness(0%)`, "blur(0px) brightness(100%)"],
        duration: 0.5 * MS,
        ease: "linear",
        delay: stagger(settings.stagger * MS),
        autoplay: false,
      });
      const observer = onScroll({
        target,
        enter: "bottom-=15% top",
        leave: "center+=15% bottom",
        sync: Number(settings.sync) > 0 ? Number(settings.sync) : true,
      });
      observer.link(animation);
      return () => {
        observer.revert();
        animation.revert();
      };
    });
  };
  build();

  el.setAttribute("data-fx-live", "");

  const tear = () => {
    // revert() runs the split effect's cleanup -- disconnecting the scroll
    // observer and cancelling the tween -- then strips the character spans and
    // restores the original markup, so a destroy part-way through the range
    // hands the headline back sharp rather than leaving it blurred.
    split?.revert();
    split = null;
  };

  return {
    update(next = {}) {
      Object.assign(settings, next);
      tear();
      build();
    },
    destroy() {
      tear();
      el.removeAttribute("data-fx-live");
    },
  };
}
