// Repeating Image Transition
// MIT License
// Copyright (c) 2009 - 2025 [Codrops] (https://tympanus.net/codrops)
// https://github.com/codrops/RepeatingImageTransition
//
// image-repeat-reveal: a port of Codrops' Repeating Image Transition, commit
// 354c58487ad6a8b728e35b34d6666fca72e9b4eb, js/index.js and css/base.css.
//
// Clicking a grid item spawns a run of repeated copies of it -- "movers" --
// that step across the screen along a straight line from the thumbnail's box
// to the panel's, each one wiping in and back out through a clip-path, and
// lands as the full-bleed image of a detail panel. The whole thing is plain
// tweens with no timeline scrubbing and no plugin: generateMotionPath lerps
// eight boxes between the two rects and drops the first and last, each mover
// gets `index * stepInterval` of delay, and the panel's own reveal is timed
// off the same `steps * stepInterval`. All of that arithmetic, every duration
// and every easing name is upstream's.
//
// The four clip-path direction tables, the distance-based stagger on the grid
// items, the optional sine path and per-mover wobble, and the automatic
// left/right flip of a horizontal wipe based on which half of the window was
// clicked, are upstream's too and all of them are here.
//
// GSAP's eases map by name rather than by number: its power scale is
// power1=Quad, power2=Cubic, power3=Quart, and `sine` / `expo` without a
// suffix mean the `.out` variant. So sine -> outSine, sine.in -> inSine,
// sine.inOut -> inOutSine, expo -> outExpo.
//
// IMAGERY. Upstream ships 33 photographs. None of them is ours to
// redistribute, and none of them is the effect: the mover copies whatever
// `background-image` the thumbnail carries, so a CSS gradient written inline
// on the thumbnail travels through the whole transition exactly as a
// photograph would. That is the image slot -- a site author replaces the
// inline `background-image` with `url(...)` and changes nothing else.
//
// The resting state is the grid: thumbnails, captions, headings. The panel is
// `opacity: 0; pointer-events: none` in the stylesheet, so a blocked script, a
// pruned bundle or reduced motion leaves a gallery that reads correctly and
// simply does not open.
import { animate, utils } from "../../vendor/anime.esm.js";

export const meta = {
  name: "image-repeat-reveal",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    steps: { type: "number", default: 6, description: "How many repeated copies step between the thumbnail and the panel. Upstream's config.steps." },
    stepDuration: { type: "number", default: 0.35, description: "Seconds each copy takes to wipe in, and again to wipe out. Upstream's config.stepDuration." },
    stepInterval: { type: "number", default: 0.05, description: "Seconds between one copy starting and the next. Upstream's config.stepInterval." },
    moverPauseBeforeExit: { type: "number", default: 0.14, description: "Seconds a copy holds at full size before it wipes back out. Upstream's config.moverPauseBeforeExit." },
    clipPathDirection: { type: "string", default: "top-bottom", description: "Which way every wipe runs: top-bottom, bottom-top, left-right or right-left. Upstream's config.clipPathDirection." },
    pathMotion: { type: "string", default: "linear", description: "Straight line between the two boxes, or 'sine' to bow the path. Upstream's config.pathMotion." },
    rotationRange: { type: "number", default: 0, description: "Maximum random tilt in degrees applied to each copy. Upstream's config.rotationRange." },
  },
};

// js/index.js `config`, verbatim and complete: the four keys above the options
// list are here too, because dropping them would drop the behaviour they
// switch on.
const UPSTREAM = {
  clipPathDirection: 'top-bottom',
  autoAdjustHorizontalClipPath: true,
  steps: 6,
  stepDuration: 0.35,
  stepInterval: 0.05,
  moverPauseBeforeExit: 0.14,
  rotationRange: 0,
  wobbleStrength: 0,
  panelRevealEase: 'inOutSine',
  gridItemEase: 'outSine',
  moverEnterEase: 'inSine',
  moverExitEase: 'outSine',
  panelRevealDurationFactor: 2,
  clickedItemDurationFactor: 2,
  gridItemStaggerFactor: 0.3,
  moverBlendMode: false,
  pathMotion: 'linear',
  sineAmplitude: 50,
  sineFrequency: Math.PI,
};

// GSAP counts in seconds, anime.js counts in milliseconds.
const MS = 1000;

// index.js, verbatim.
const lerp = (a, b, t) => a + (b - a) * t;

const getElementCenter = (el) => {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const getClipPathsForDirection = (direction) => {
  switch (direction) {
    case 'bottom-top':
      return { from: 'inset(0% 0% 100% 0%)', reveal: 'inset(0% 0% 0% 0%)', hide: 'inset(100% 0% 0% 0%)' };
    case 'left-right':
      return { from: 'inset(0% 100% 0% 0%)', reveal: 'inset(0% 0% 0% 0%)', hide: 'inset(0% 0% 0% 100%)' };
    case 'right-left':
      return { from: 'inset(0% 0% 0% 100%)', reveal: 'inset(0% 0% 0% 0%)', hide: 'inset(0% 100% 0% 0%)' };
    case 'top-bottom':
    default:
      return { from: 'inset(100% 0% 0% 0%)', reveal: 'inset(0% 0% 0% 0%)', hide: 'inset(0% 0% 100% 0%)' };
  }
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  // Upstream caches these off `document`. Everything here is scoped to the
  // section instead, so two galleries on one page do not open each other's
  // panel or sweep each other's grid.
  const grid = el.querySelector(".fx-repeat__grid");
  const frame = [...el.querySelectorAll(".fx-repeat__frame, .fx-repeat__heading")];
  const panel = el.querySelector(".fx-repeat__panel");
  const panelContent = panel?.querySelector(".fx-repeat__panel-content");
  const panelImg = panel?.querySelector(".fx-repeat__panel-img");
  if (!grid || !panel || !panelContent || !panelImg) return resting;

  const items = [...el.querySelectorAll(".fx-repeat__item")];
  if (!items.length || typeof document === "undefined") return resting;
  // A reader who asked for stillness gets the grid the stylesheet already
  // draws. Every caption is in the markup, so nothing is behind the panel that
  // is not also on the page.
  if (reducedMotion()) return resting;

  const config = { ...UPSTREAM, ...opts };
  const originalConfig = { ...config };

  let isAnimating = false;
  let isPanelOpen = false;
  let currentItem = null;
  const timers = new Set();
  const running = new Set();

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };
  const track = (a) => { running.add(a); return a; };

  // hideFrame / showFrame. GSAP writes a non-numeric property such as
  // pointerEvents straight away rather than interpolating it; utils.set is
  // the same instruction without pretending it is a tween.
  const fadeFrame = (opacity, pointerEvents) => {
    if (!frame.length) return;
    utils.set(frame, { pointerEvents });
    track(animate(frame, { opacity, duration: 0.5 * MS, ease: 'inOutSine' }));
  };
  const hideFrame = () => fadeFrame(0, 'none');
  const showFrame = () => fadeFrame(1, 'auto');

  const positionPanelBasedOnClick = (clickedItem) => {
    const centerX = getElementCenter(clickedItem).x;
    const windowHalf = window.innerWidth / 2;
    const isLeftSide = centerX < windowHalf;

    if (isLeftSide) panel.classList.add('fx-repeat__panel--right');
    else panel.classList.remove('fx-repeat__panel--right');

    if (config.autoAdjustHorizontalClipPath) {
      if (config.clipPathDirection === 'left-right' || config.clipPathDirection === 'right-left') {
        config.clipPathDirection = isLeftSide ? 'left-right' : 'right-left';
      }
    }
  };

  const extractItemData = (item) => {
    const imgDiv = item.querySelector('.fx-repeat__image');
    const caption = item.querySelector('figcaption');
    return {
      imgURL: imgDiv.style.backgroundImage,
      title: caption.querySelector('h3').textContent,
      desc: caption.querySelector('p').textContent,
    };
  };

  const setPanelContent = ({ imgURL, title, desc }) => {
    panelImg.style.backgroundImage = imgURL;
    panelContent.querySelector('h3').textContent = title;
    panelContent.querySelector('p').textContent = desc;
  };

  const computeStaggerDelays = (clickedItem, all) => {
    const baseCenter = getElementCenter(clickedItem);
    const distances = Array.from(all).map((element) => {
      const center = getElementCenter(element);
      return Math.hypot(center.x - baseCenter.x, center.y - baseCenter.y);
    });
    const max = Math.max(...distances);
    return distances.map((d) => (d / max) * config.gridItemStaggerFactor);
  };

  // animateGridItems. Upstream is one gsap.to whose scale, duration and
  // clipPath are per-element functions; the clicked item is the only one that
  // gets a clip-path, and every other one is handed the literal 'none', which
  // is not an inset() and has nothing to interpolate towards. Splitting the
  // call in two says the same thing without asking anime to tween a keyword.
  const animateGridItems = (all, clickedItem, delays) => {
    const clipPaths = getClipPathsForDirection(config.clipPathDirection);
    const clickedIndex = all.indexOf(clickedItem);
    const others = all.filter((element) => element !== clickedItem);
    const otherDelays = all.flatMap((element, i) => (element === clickedItem ? [] : [delays[i]]));

    track(animate(clickedItem, {
      opacity: 0,
      scale: 1,
      duration: config.stepDuration * config.clickedItemDurationFactor * MS,
      ease: config.gridItemEase,
      clipPath: clipPaths.from,
      delay: delays[clickedIndex] * MS,
    }));

    if (others.length) {
      track(animate(others, {
        opacity: 0,
        scale: 0.8,
        duration: 0.3 * MS,
        ease: config.gridItemEase,
        delay: (_t, i) => otherDelays[i] * MS,
      }));
    }
  };

  // generateMotionPath, verbatim.
  const generateMotionPath = (startRect, endRect, steps) => {
    const path = [];
    const fullSteps = steps + 2;
    const startCenter = { x: startRect.left + startRect.width / 2, y: startRect.top + startRect.height / 2 };
    const endCenter = { x: endRect.left + endRect.width / 2, y: endRect.top + endRect.height / 2 };

    for (let i = 0; i < fullSteps; i++) {
      const t = i / (fullSteps - 1);
      const width = lerp(startRect.width, endRect.width, t);
      const height = lerp(startRect.height, endRect.height, t);
      const centerX = lerp(startCenter.x, endCenter.x, t);
      const centerY = lerp(startCenter.y, endCenter.y, t);

      const sineOffset = config.pathMotion === 'sine'
        ? Math.sin(t * config.sineFrequency) * config.sineAmplitude
        : 0;

      const wobbleX = (Math.random() - 0.5) * config.wobbleStrength;
      const wobbleY = (Math.random() - 0.5) * config.wobbleStrength;

      path.push({
        left: centerX - width / 2 + wobbleX,
        top: centerY - height / 2 + sineOffset + wobbleY,
        width,
        height,
      });
    }

    return path.slice(1, -1);
  };

  // createMoverStyle. GSAP appends px to a bare number on left/top/width/
  // height and calls a Z rotation `rotationZ`; both are written out here.
  const applyMoverStyle = (mover, step, index, imgURL) => {
    mover.style.backgroundImage = imgURL;
    mover.style.position = 'fixed';
    mover.style.left = `${step.left}px`;
    mover.style.top = `${step.top}px`;
    mover.style.width = `${step.width}px`;
    mover.style.height = `${step.height}px`;
    mover.style.clipPath = getClipPathsForDirection(config.clipPathDirection).from;
    mover.style.zIndex = String(1000 + index);
    mover.style.backgroundPosition = '50% 50%';
    mover.style.transform = `rotate(${utils.random(-config.rotationRange, config.rotationRange, 2)}deg)`;
    if (config.moverBlendMode) mover.style.mixBlendMode = config.moverBlendMode;
  };

  const scheduleCleanup = (movers) => {
    const cleanupDelay = config.steps * config.stepInterval + config.stepDuration * 2 + config.moverPauseBeforeExit;
    later(() => movers.forEach((m) => m.remove()), cleanupDelay * MS);
  };

  const revealPanel = (endImg) => {
    const clipPaths = getClipPathsForDirection(config.clipPathDirection);

    utils.set(panelContent, { opacity: 0 });
    utils.set(panel, { opacity: 1, pointerEvents: 'auto' });
    utils.set(endImg, { pointerEvents: 'auto' });

    const duration = config.stepDuration * config.panelRevealDurationFactor * MS;
    const delay = config.steps * config.stepInterval * MS;

    track(animate(endImg, {
      clipPath: [clipPaths.hide, clipPaths.reveal],
      duration,
      ease: config.panelRevealEase,
      delay,
    }));

    // Ours, not upstream's: the panel's own opaque ground, brought in on
    // exactly the image's schedule so the stepping copies stay visible over
    // the grid until the panel has something to show.
    track(animate(panel, {
      '--fx-panel-ground': [0, 1],
      duration,
      ease: config.panelRevealEase,
      delay,
    }));

    // Upstream places this one at '<-=.2', which in GSAP is the start of the
    // previous tween (delay included) minus 0.2s, and then adds its own delay
    // on top. anime's '<' and '<<' are the other way round from GSAP's '<'
    // and '>': '<' is the previous END and '<<' the previous START, so the
    // transcription of '<-=.2' is '<<-=200'. Here there is no timeline to
    // position within, so the same arithmetic is written out.
    track(animate(panelContent, {
      y: [25, 0],
      opacity: 1,
      duration: 1 * MS,
      ease: 'outExpo',
      delay: delay - 0.2 * MS + delay,
      onComplete: () => { isAnimating = false; isPanelOpen = true; },
    }));
  };

  const animateTransition = (startEl, endEl, imgURL) => {
    hideFrame();

    const path = generateMotionPath(startEl.getBoundingClientRect(), endEl.getBoundingClientRect(), config.steps);
    const fragment = document.createDocumentFragment();
    const clipPaths = getClipPathsForDirection(config.clipPathDirection);
    const movers = [];

    path.forEach((step, index) => {
      const mover = document.createElement('div');
      mover.className = 'fx-repeat__mover';
      applyMoverStyle(mover, step, index, imgURL);
      fragment.appendChild(mover);
      movers.push(mover);

      const delay = index * config.stepInterval * MS;
      track(animate(mover, {
        opacity: [0.4, 1],
        clipPath: [clipPaths.hide, clipPaths.reveal],
        duration: config.stepDuration * MS,
        ease: config.moverEnterEase,
        delay,
      }));
      // Upstream chains the exit onto the same timeline at
      // `+=moverPauseBeforeExit`, which is the enter's end plus the pause.
      track(animate(mover, {
        clipPath: clipPaths.from,
        duration: config.stepDuration * MS,
        ease: config.moverExitEase,
        delay: delay + config.stepDuration * MS + config.moverPauseBeforeExit * MS,
      }));
    });

    grid.parentNode.insertBefore(fragment, grid.nextSibling);

    scheduleCleanup(movers);
    revealPanel(endEl);
  };

  const onGridItemClick = (item) => {
    if (isAnimating || isPanelOpen) return;
    isAnimating = true;
    // The previous run's handles are finished; keeping them would grow the set
    // for the life of the page, and destroy() only ever needs the live ones.
    running.clear();
    currentItem = item;

    positionPanelBasedOnClick(item);

    const { imgURL, title, desc } = extractItemData(item);
    setPanelContent({ imgURL, title, desc });

    const delays = computeStaggerDelays(item, items);
    animateGridItems(items, item, delays);
    animateTransition(item.querySelector('.fx-repeat__image'), panelImg, imgURL);
  };

  const resetView = () => {
    if (isAnimating || !currentItem) return;
    isAnimating = true;
    running.clear();

    const delays = computeStaggerDelays(currentItem, items);
    const duration = config.stepDuration * MS;

    showFrame();
    track(animate(panel, {
      opacity: 0,
      duration,
      ease: 'outExpo',
      onComplete: () => {
        utils.set(panel, { opacity: 0, pointerEvents: 'none' });
        utils.set(panelImg, { clipPath: 'inset(0% 0% 100% 0%)' });
        utils.set(items, { clipPath: 'none', opacity: 0, scale: 0.8 });
        track(animate(items, {
          opacity: 1,
          scale: 1,
          duration,
          ease: 'outExpo',
          delay: (_t, i) => delays[i] * MS,
          onComplete: () => {
            panel.classList.remove('fx-repeat__panel--right');
            isAnimating = false;
            isPanelOpen = false;
          },
        }));
      },
    }));

    Object.assign(config, originalConfig);
  };

  // init()
  const bound = items.map((item) => {
    const onClick = () => onGridItemClick(item);
    // Upstream binds click to a <figure> and leaves the grid unreachable from
    // a keyboard. The markup gives each item a button role, so it also has to
    // answer the keys a button answers.
    const onKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onGridItemClick(item); }
    };
    item.addEventListener('click', onClick);
    item.addEventListener('keydown', onKeyDown);
    return { item, onClick, onKeyDown };
  });

  const closeBtn = panelContent.querySelector('.fx-repeat__panel-close');
  const onClose = (e) => { e.preventDefault(); resetView(); };
  closeBtn?.addEventListener('click', onClose);

  const onKeyUp = (e) => {
    if (e.key === 'Escape' && isPanelOpen && !isAnimating) resetView();
  };
  document.addEventListener('keydown', onKeyUp);

  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) { Object.assign(config, next); Object.assign(originalConfig, next); },
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      // pause(), not revert(). revert() restores the inline styles that were
      // in place before each animation started, and the last animations to run
      // are the ones that put the grid BACK -- so reverting them would leave a
      // closed gallery at opacity 0. The resting state is no inline styles at
      // all, so the properties this effect writes are simply removed.
      for (const a of running) a.pause();
      running.clear();
      for (const m of el.querySelectorAll('.fx-repeat__mover')) m.remove();
      const clear = (node, props) => { for (const p of props) node?.style.removeProperty(p); };
      for (const item of items) clear(item, ['opacity', 'transform', 'scale', 'clip-path']);
      for (const f of frame) clear(f, ['opacity', 'pointer-events']);
      clear(panel, ['opacity', 'pointer-events', '--fx-panel-ground']);
      clear(panelContent, ['opacity', 'transform']);
      clear(panelImg, ['clip-path', 'pointer-events', 'background-image']);
      for (const { item, onClick, onKeyDown } of bound) {
        item.removeEventListener('click', onClick);
        item.removeEventListener('keydown', onKeyDown);
      }
      closeBtn?.removeEventListener('click', onClose);
      document.removeEventListener('keydown', onKeyUp);
      panel.classList.remove('fx-repeat__panel--right');
      el.removeAttribute("data-fx-live");
    },
  };
}
