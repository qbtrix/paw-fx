// Infinite Gradient 3D Carousel
// MIT License
// Copyright (c) 2009 - 2025 Clement Grellier (https://clementgrellier.fr/)
// https://github.com/clementgrellier/gradientslider
//
// gradient-carousel: a port of Clement Grellier's Infinite Gradient 3D
// Carousel for Codrops, commit 6773280ae28e9902d9073f9e5e3ce7dfd4cdc2cd --
// script.js is the whole effect, styles.css the stage, the card and the
// blurred background canvas, and index.html the markup skeleton.
//
// THE GRADIENT IS THE EFFECT, not the carousel. Every card's picture is drawn
// once into a 48px offscreen canvas and its pixels binned into a 36x5
// hue-by-saturation histogram, weighted by saturation squared and by how close
// each pixel is to mid-lightness, with near-white, near-black and washed-out
// pixels thrown away. The heaviest bin is the card's primary colour; the
// heaviest bin at least 25 degrees away on the wheel, if it carries at least
// 60% of the primary's weight, is its second. Those two colours are what the
// page behind the carousel then paints, as two slowly orbiting radial
// gradients under a 24px blur, and they cross-fade over 0.45s whenever a
// different card reaches the middle. Change the pictures and the whole
// section changes colour.
//
// The carousel itself is hand-written vanilla physics: wheel and drag add to a
// velocity, friction decays it at 0.9 per 60th of a second, positions wrap
// around a track so there is no end, and each card's rotateY, translateZ,
// scale and blur are read straight off how far it sits from the middle.
//
// GSAP IS BANNED HERE. It had two call sites in 971 lines and both tween a
// plain object:
//   gsap.to(gradCurrent, {...to, duration: 0.45, ease: 'power2.out'})
//                        -> animate(gradCurrent, {..., 450, ease: 'outCubic'}).
//                           GSAP's powerN is degree N+1, so power2 is a CUBIC.
//                           Upstream already ships a no-GSAP fallback on this
//                           one (Object.assign), which is dropped: with anime
//                           always present the branch is dead.
//   gsap.timeline() in animateEntry(), tweening {p: 0} to {p: 1} per card at
//   0.6s / 'power3.out', offset idx * 0.05
//                        -> createTimeline() with the same per-card tween at
//                           600ms / 'outQuart' (power3 is a QUARTIC) starting
//                           at idx * 50ms. This one has no upstream guard, so
//                           the file as published throws without GSAP; the
//                           port fixes that by not needing it.
//
// FOR THE RECORD, ON WHETHER UPSTREAM WORKS. The source assessment could not
// get the hosted demo past its loading spinner and, correctly, declined to
// guess why. It does run. Served from a clean checkout of this commit and at
// tympanus.net/Tutorials/3DGradientCarousel/ both, the loader hides, ten cards
// mount and the background samples the centred card. Nothing here is a
// workaround for an upstream defect, because there is not one.
//
// NO PHOTOGRAPHY SHIPS. The ten .webp files are content, and upstream's own
// README names the IMAGES array as the swap point. Here the cards are in the
// markup instead, carrying generated SVG plates, and the sampler runs on
// whatever a site puts in their src -- which is the whole point, since the
// gradient is derived from the picture rather than configured.
import { animate, createTimeline } from "../../vendor/anime.esm.js";

export const meta = {
  name: "gradient-carousel",
  version: "1.0.0",
  category: "gallery",
  needs: ["anime"],
  license: "MIT",
  options: {
    friction: { type: "number", default: 0.9, description: "Velocity left after a sixtieth of a second. Upstream's FRICTION." },
    wheelSensitivity: { type: "number", default: 0.6, description: "How hard a wheel notch pushes the carousel. Upstream's WHEEL_SENS." },
    maxRotation: { type: "number", default: 28, description: "Degrees a card at the edge of the stage is turned by. Upstream's MAX_ROTATION." },
    maxDepth: { type: "number", default: 140, description: "Pixels the centred card is pushed toward the reader. Upstream's MAX_DEPTH." },
    gap: { type: "number", default: 28, description: "Pixels between card centres, over the card's own width. Upstream's GAP." },
  },
};

// script.js CONFIGURATION.
const UPSTREAM = { friction: 0.9, wheelSensitivity: 0.6, maxRotation: 28, maxDepth: 140, gap: 28 };
const DRAG_SENS = 1.0;
const MIN_SCALE = 0.92;
const SCALE_RANGE = 0.1;

// The two GSAP call sites, in anime's units and under anime's names for the
// curves. GSAP's powerN is degree N+1: power2 is a cubic, power3 a quartic.
const GRADIENT_DURATION = 450;
const GRADIENT_EASE = "outCubic";
const ENTRY_DURATION = 600;
const ENTRY_EASE = "outQuart";
const ENTRY_STAGGER = 50;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// script.js mod(): a modulo that handles negatives, which is what makes the
// track wrap in both directions.
function mod(n, m) {
  return ((n % m) + m) % m;
}

// script.js rgbToHsl().
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0; // Achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

// script.js hslToRgb().
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// script.js fallbackFromIndex(): what a card gets when its picture cannot be
// sampled at all, which is a cross-origin image or a decode that never landed.
function fallbackFromIndex(idx) {
  const h = (idx * 37) % 360; // Spread hues across spectrum
  const s = 0.65;
  const c1 = hslToRgb(h, s, 0.52);
  const c2 = hslToRgb(h, s, 0.72);
  return { c1, c2 };
}

// script.js extractColors(), verbatim.
function extractColors(img, idx) {
  try {
    // Downscale image for faster processing
    const MAX = 48;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
    const tw = ratio >= 1 ? MAX : Math.max(16, Math.round(MAX * ratio));
    const th = ratio >= 1 ? Math.max(16, Math.round(MAX / ratio)) : MAX;

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, tw, th);
    const data = ctx.getImageData(0, 0, tw, th).data;

    // Create 2D histogram bins (hue x saturation)
    const H_BINS = 36; // 10deg hue increments
    const S_BINS = 5;  // 20% saturation increments
    const SIZE = H_BINS * S_BINS;
    const wSum = new Float32Array(SIZE);
    const rSum = new Float32Array(SIZE);
    const gSum = new Float32Array(SIZE);
    const bSum = new Float32Array(SIZE);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      if (a < 0.05) continue; // Skip transparent pixels

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);

      // Skip near-white, near-black, and desaturated colors
      if (l < 0.1 || l > 0.92 || s < 0.08) continue;

      // Weight by saturation and mid-tone preference
      const w = a * (s * s) * (1 - Math.abs(l - 0.5) * 0.6);

      const hi = Math.max(0, Math.min(H_BINS - 1, Math.floor((h / 360) * H_BINS)));
      const si = Math.max(0, Math.min(S_BINS - 1, Math.floor(s * S_BINS)));
      const bidx = hi * S_BINS + si;

      wSum[bidx] += w;
      rSum[bidx] += r * w;
      gSum[bidx] += g * w;
      bSum[bidx] += b * w;
    }

    // Find primary color (bin with highest weight)
    let pIdx = -1;
    let pW = 0;
    for (let i = 0; i < SIZE; i++) {
      if (wSum[i] > pW) {
        pW = wSum[i];
        pIdx = i;
      }
    }

    if (pIdx < 0 || pW <= 0) return fallbackFromIndex(idx);

    const pHue = Math.floor(pIdx / S_BINS) * (360 / H_BINS);

    // Find secondary color (sufficiently different hue)
    let sIdx = -1;
    let sW = 0;
    for (let i = 0; i < SIZE; i++) {
      const w = wSum[i];
      if (w <= 0) continue;

      const h = Math.floor(i / S_BINS) * (360 / H_BINS);
      let dh = Math.abs(h - pHue);
      dh = Math.min(dh, 360 - dh); // Shortest distance on color wheel

      if (dh >= 25 && w > sW) { // At least 25deg different
        sW = w;
        sIdx = i;
      }
    }

    const avgRGB = (bin) => {
      const w = wSum[bin] || 1e-6;
      return [
        Math.round(rSum[bin] / w),
        Math.round(gSum[bin] / w),
        Math.round(bSum[bin] / w),
      ];
    };

    const [pr, pg, pb] = avgRGB(pIdx);
    let [h1, s1] = rgbToHsl(pr, pg, pb);
    s1 = Math.max(0.45, Math.min(1, s1 * 1.15)); // Boost saturation
    const c1 = hslToRgb(h1, s1, 0.5);

    let c2;
    if (sIdx >= 0 && sW >= pW * 0.6) {
      const [sr, sg, sb] = avgRGB(sIdx);
      let [h2, s2] = rgbToHsl(sr, sg, sb);
      s2 = Math.max(0.45, Math.min(1, s2 * 1.05));
      c2 = hslToRgb(h2, s2, 0.72);
    } else {
      c2 = hslToRgb(h1, s1, 0.72);
    }

    return { c1, c2 };
  } catch {
    return fallbackFromIndex(idx);
  }
}

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  // script.js DOM REFERENCES, scoped to this section rather than to document
  // ids, so two of these on one page do not collapse into one.
  const stage = el.querySelector(".fx-gcar__stage");
  const cardsRoot = el.querySelector(".fx-gcar__cards");
  const bgCanvas = el.querySelector(".fx-gcar__bg");
  if (!stage || !cardsRoot || !bgCanvas || typeof bgCanvas.getContext !== "function") return resting;

  const cardEls = Array.from(cardsRoot.querySelectorAll(".fx-gcar__card"));
  if (!cardEls.length) return resting;

  // Reduced motion leaves the native scroll row exactly as the stylesheet drew
  // it: every card is there and every card is reachable.
  if (reducedMotion()) return resting;

  const bgCtx = bgCanvas.getContext("2d", { alpha: false });
  if (!bgCtx) return resting;

  const settings = {
    friction: num(opts.friction, UPSTREAM.friction, 0.01, 0.999),
    wheelSensitivity: num(opts.wheelSensitivity, UPSTREAM.wheelSensitivity, 0, 10),
    maxRotation: num(opts.maxRotation, UPSTREAM.maxRotation, 0, 90),
    maxDepth: num(opts.maxDepth, UPSTREAM.maxDepth, 0, 1000),
    gap: num(opts.gap, UPSTREAM.gap, 0, 400),
  };

  // script.js STATE MANAGEMENT, all per mount.
  let items = [];
  let positions = [];
  let activeIndex = -1;
  let isEntering = true;

  let CARD_W = 300;
  let CARD_H = 400;
  let STEP = CARD_W + settings.gap;
  let TRACK = 0;
  let SCROLL_X = 0;
  let VW_HALF = stage.clientWidth * 0.5;

  let vX = 0;

  let rafId = null;
  let bgRAF = null;
  let lastTime = 0;
  let lastBgDraw = 0;

  let gradPalette = [];
  const gradCurrent = {
    r1: 240, g1: 240, b1: 240,
    r2: 235, g2: 235, b2: 235,
  };
  let bgFastUntil = 0;
  let torn = false;

  // script.js createCards(), inverted: the cards are already in the markup,
  // because a section has to be finished with CSS alone before any script
  // runs. What is left of it is recording each card's place on the track.
  const readCards = () => {
    items = cardEls.map((card, i) => {
      card.style.willChange = "transform"; // Force GPU compositing
      return { el: card, x: i * STEP };
    });
  };

  // script.js measure().
  const measure = () => {
    const sample = items[0]?.el;
    if (!sample) return;

    const r = sample.getBoundingClientRect();
    CARD_W = r.width || CARD_W;
    CARD_H = r.height || CARD_H;
    STEP = CARD_W + settings.gap;
    TRACK = items.length * STEP;

    items.forEach((it, i) => {
      it.x = i * STEP;
    });

    positions = new Float32Array(items.length);
  };

  // script.js computeTransformComponents().
  const computeTransformComponents = (screenX) => {
    const norm = Math.max(-1, Math.min(1, screenX / VW_HALF));
    const absNorm = Math.abs(norm);
    const invNorm = 1 - absNorm;

    const ry = -norm * settings.maxRotation;
    const tz = invNorm * settings.maxDepth;
    const scale = MIN_SCALE + invNorm * SCALE_RANGE;

    return { norm, absNorm, invNorm, ry, tz, scale };
  };

  // script.js transformForScreenX().
  const transformForScreenX = (screenX) => {
    const { ry, tz, scale } = computeTransformComponents(screenX);

    return {
      transform: `translate3d(${screenX}px,-50%,${tz}px) rotateY(${ry}deg) scale(${scale})`,
      z: tz,
    };
  };

  // script.js updateCarouselTransforms().
  const updateCarouselTransforms = () => {
    const half = TRACK / 2;
    let closestIdx = -1;
    let closestDist = Infinity;

    for (let i = 0; i < items.length; i++) {
      let pos = items[i].x - SCROLL_X;

      if (pos < -half) pos += TRACK;
      if (pos > half) pos -= TRACK;

      positions[i] = pos;

      const dist = Math.abs(pos);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    const prevIdx = (closestIdx - 1 + items.length) % items.length;
    const nextIdx = (closestIdx + 1) % items.length;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pos = positions[i];
      const norm = Math.max(-1, Math.min(1, pos / VW_HALF));
      const { transform, z } = transformForScreenX(pos);

      it.el.style.transform = transform;
      it.el.style.zIndex = String(1000 + Math.round(z));

      // Apply subtle blur to non-core cards
      const isCore = i === closestIdx || i === prevIdx || i === nextIdx;
      const blur = isCore ? 0 : 2 * Math.pow(Math.abs(norm), 1.1);
      it.el.style.filter = `blur(${blur.toFixed(2)}px)`;
    }

    if (closestIdx !== activeIndex) {
      setActiveGradient(closestIdx);
    }
  };

  // script.js tick().
  const tick = (t) => {
    const dt = lastTime ? (t - lastTime) / 1000 : 0;
    lastTime = t;

    SCROLL_X = mod(SCROLL_X + vX * dt, TRACK);

    const decay = Math.pow(settings.friction, dt * 60);
    vX *= decay;
    if (Math.abs(vX) < 0.02) vX = 0;

    updateCarouselTransforms();
    rafId = requestAnimationFrame(tick);
  };

  const startCarousel = () => {
    cancelCarousel();
    lastTime = 0;
    rafId = requestAnimationFrame((t) => {
      updateCarouselTransforms();
      tick(t);
    });
  };

  const cancelCarousel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  };

  // script.js buildPalette().
  const buildPalette = () => {
    gradPalette = items.map((it, i) => extractColors(it.el.querySelector("img"), i));
  };

  // script.js setActiveGradient(). Upstream branches on window.gsap and falls
  // back to an instant Object.assign; anime is always here, so the branch is
  // gone and the tween always runs.
  function setActiveGradient(idx) {
    if (idx < 0 || idx >= items.length || idx === activeIndex) return;

    activeIndex = idx;
    const pal = gradPalette[idx] || { c1: [240, 240, 240], c2: [235, 235, 235] };
    const to = {
      r1: pal.c1[0], g1: pal.c1[1], b1: pal.c1[2],
      r2: pal.c2[0], g2: pal.c2[1], b2: pal.c2[2],
    };

    bgFastUntil = performance.now() + 800; // High FPS for smooth transition
    animate(gradCurrent, { ...to, duration: GRADIENT_DURATION, ease: GRADIENT_EASE });
  }

  // script.js resizeBG().
  const resizeBG = () => {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = bgCanvas.clientWidth || stage.clientWidth;
    const h = bgCanvas.clientHeight || stage.clientHeight;
    const tw = Math.floor(w * dpr);
    const th = Math.floor(h * dpr);

    if (bgCanvas.width !== tw || bgCanvas.height !== th) {
      bgCanvas.width = tw;
      bgCanvas.height = th;
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  // script.js drawBackground().
  const drawBackground = () => {
    if (torn) return;
    const now = performance.now();
    const minInterval = now < bgFastUntil ? 16 : 33; // 60fps or 30fps

    if (now - lastBgDraw < minInterval) {
      bgRAF = requestAnimationFrame(drawBackground);
      return;
    }

    lastBgDraw = now;
    resizeBG();

    const w = bgCanvas.clientWidth || stage.clientWidth;
    const h = bgCanvas.clientHeight || stage.clientHeight;

    bgCtx.fillStyle = "#f6f7f9";
    bgCtx.fillRect(0, 0, w, h);

    // Animate gradient centers
    const time = now * 0.0002;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const a1 = Math.min(w, h) * 0.35;
    const a2 = Math.min(w, h) * 0.28;

    const x1 = cx + Math.cos(time) * a1;
    const y1 = cy + Math.sin(time * 0.8) * a1 * 0.4;
    const x2 = cx + Math.cos(-time * 0.9 + 1.2) * a2;
    const y2 = cy + Math.sin(-time * 0.7 + 0.7) * a2 * 0.5;

    const r1 = Math.max(w, h) * 0.75;
    const r2 = Math.max(w, h) * 0.65;

    const g1 = bgCtx.createRadialGradient(x1, y1, 0, x1, y1, r1);
    g1.addColorStop(0, `rgba(${gradCurrent.r1},${gradCurrent.g1},${gradCurrent.b1},0.85)`);
    g1.addColorStop(1, "rgba(255,255,255,0)");
    bgCtx.fillStyle = g1;
    bgCtx.fillRect(0, 0, w, h);

    const g2 = bgCtx.createRadialGradient(x2, y2, 0, x2, y2, r2);
    g2.addColorStop(0, `rgba(${gradCurrent.r2},${gradCurrent.g2},${gradCurrent.b2},0.70)`);
    g2.addColorStop(1, "rgba(255,255,255,0)");
    bgCtx.fillStyle = g2;
    bgCtx.fillRect(0, 0, w, h);

    bgRAF = requestAnimationFrame(drawBackground);
  };

  const startBG = () => {
    cancelBG();
    bgRAF = requestAnimationFrame(drawBackground);
  };

  const cancelBG = () => {
    if (bgRAF) cancelAnimationFrame(bgRAF);
    bgRAF = null;
  };

  // script.js onResize(), driven by a ResizeObserver on the stage rather than
  // a debounced window resize: a section is resized by things a window resize
  // never reports.
  const onResize = () => {
    if (torn) return;
    const prevStep = STEP || 1;
    const ratio = SCROLL_X / (items.length * prevStep);
    measure();
    VW_HALF = stage.clientWidth * 0.5;
    SCROLL_X = mod(ratio * TRACK, TRACK);
    updateCarouselTransforms();
    resizeBG();
  };

  // script.js EVENT HANDLERS, on the stage rather than on window or document.
  const onWheel = (e) => {
    if (isEntering) return;
    e.preventDefault();

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    vX += delta * settings.wheelSensitivity * 20;
  };

  const onDragStart = (e) => e.preventDefault();

  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  let lastDelta = 0;

  const onPointerDown = (e) => {
    if (isEntering) return;

    dragging = true;
    lastX = e.clientX;
    lastT = performance.now();
    lastDelta = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
  };

  const onPointerMove = (e) => {
    if (!dragging) return;

    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT) / 1000;

    SCROLL_X = mod(SCROLL_X - dx * DRAG_SENS, TRACK);
    lastDelta = dx / dt; // Track velocity for momentum
    lastX = e.clientX;
    lastT = now;
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.releasePointerCapture(e.pointerId);
    vX = -lastDelta * DRAG_SENS; // Apply final velocity
    stage.classList.remove("is-dragging");
  };

  // script.js visibilitychange: the two loops stop while the tab is hidden.
  const onVisibility = () => {
    if (torn) return;
    if (document.hidden) {
      cancelCarousel();
      cancelBG();
    } else {
      startCarousel();
      startBG();
    }
  };

  // script.js animateEntry(), on a timeline anime drives instead of GSAP.
  const animateEntry = (visibleCards) => {
    const tl = createTimeline();

    visibleCards.forEach(({ item, screenX }, idx) => {
      const state = { p: 0 }; // 0 -> 1
      const { ry, tz, scale: baseScale } = computeTransformComponents(screenX);

      const START_SCALE = 0.92;
      const START_Y = 40;

      item.el.style.opacity = "0";
      item.el.style.transform =
        `translate3d(${screenX}px,-50%,${tz}px) ` +
        `rotateY(${ry}deg) ` +
        `scale(${START_SCALE}) ` +
        `translateY(${START_Y}px)`;

      tl.add(
        state,
        {
          p: 1,
          duration: ENTRY_DURATION,
          ease: ENTRY_EASE,
          onUpdate: () => {
            const t = state.p;

            const currentScale = START_SCALE + (baseScale - START_SCALE) * t;
            const currentY = START_Y * (1 - t);

            item.el.style.opacity = t.toFixed(3);

            if (t >= 0.999) {
              const { transform } = transformForScreenX(screenX);
              item.el.style.transform = transform;
            } else {
              item.el.style.transform =
                `translate3d(${screenX}px,-50%,${tz}px) ` +
                `rotateY(${ry}deg) ` +
                `scale(${currentScale}) ` +
                `translateY(${currentY}px)`;
            }
          },
        },
        idx * ENTRY_STAGGER,
      );
    });

    return tl;
  };

  // script.js init(), minus the loader, the <link rel=preload> injection and
  // warmupCompositing(). See meta.json: all three exist to hide work behind a
  // full-screen spinner this section does not have.
  readCards();
  measure();
  updateCarouselTransforms();
  el.setAttribute("data-fx-live", "");

  buildPalette();

  const half = TRACK / 2;
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < items.length; i++) {
    let pos = items[i].x - SCROLL_X;
    if (pos < -half) pos += TRACK;
    if (pos > half) pos -= TRACK;
    const d = Math.abs(pos);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  setActiveGradient(closestIdx);

  resizeBG();
  startBG();

  // The picture a card carries may still be decoding when mount runs, and a
  // sampled colour is only as good as the pixels behind it, so the palette is
  // taken again once they have all landed. Upstream waits for exactly this
  // behind its loader before sampling once.
  const decoded = cardEls.map((card) => {
    const img = card.querySelector("img");
    if (!img || img.complete) return Promise.resolve();
    return new Promise((r) => {
      img.addEventListener("load", r, { once: true });
      img.addEventListener("error", r, { once: true });
    });
  });
  Promise.all(decoded).then(() => {
    if (torn) return;
    buildPalette();
    activeIndex = -1;
    updateCarouselTransforms();
  });

  const viewportWidth = stage.clientWidth;
  const visibleCards = [];
  for (let i = 0; i < items.length; i++) {
    let pos = items[i].x - SCROLL_X;
    if (pos < -half) pos += TRACK;
    if (pos > half) pos -= TRACK;

    const screenX = pos;
    if (Math.abs(screenX) < viewportWidth * 0.6) {
      visibleCards.push({ item: items[i], screenX, index: i });
    }
  }
  visibleCards.sort((a, b) => a.screenX - b.screenX);

  const released = () => {
    if (torn) return;
    isEntering = false;
    startCarousel();
  };
  // A stage too narrow to hold a single card leaves visibleCards empty, and an
  // entry timeline with nothing on it would never hand the carousel over.
  const entry = visibleCards.length ? animateEntry(visibleCards) : null;
  if (entry) entry.then(released);
  else released();

  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("dragstart", onDragStart);
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  document.addEventListener("visibilitychange", onVisibility);

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
  ro?.observe(stage);

  return {
    update(next = {}) {
      for (const key of Object.keys(UPSTREAM)) {
        if (!(key in next)) continue;
        const range = key === "friction" ? [0.01, 0.999]
          : key === "wheelSensitivity" ? [0, 10]
          : key === "maxRotation" ? [0, 90]
          : key === "maxDepth" ? [0, 1000]
          : [0, 400];
        settings[key] = num(next[key], UPSTREAM[key], range[0], range[1]);
      }
      onResize();
    },
    destroy() {
      torn = true;
      cancelCarousel();
      cancelBG();
      entry?.revert();
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("dragstart", onDragStart);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
      stage.classList.remove("is-dragging");
      for (const card of cardEls) {
        card.style.transform = "";
        card.style.filter = "";
        card.style.opacity = "";
        card.style.zIndex = "";
        card.style.willChange = "";
      }
      el.removeAttribute("data-fx-live");
    },
  };
}
