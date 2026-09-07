// ascii-lab
// MIT License
// Copyright (c) 2025 metaory
// https://github.com/metaory/ascii-lab
//
// ascii-grid: the character-grid runtime the eight ascii-lab ports share,
// commit 639584cb2eb48e71aae36a547a6565e942d1ff1a. Carries three helpers from
// src/util.js verbatim (makeRowBuffers, buildText, ensureArray) plus the seam
// that replaces src/main.js.
//
// Not an effect -- effects/_shared/ is skipped by effectDirs(), and
// build-registry copies this file into every item whose index.js imports it.
//
// WHY IT EXISTS. Upstream is a full-screen demo: one <pre> pinned to the
// viewport, a fixed effect object per module carrying its own `this.loopId`,
// and a colsRows() that measures the viewport and re-runs the whole effect on
// every resize. Each of those is a shell decision rather than the effect, and
// each is wrong for a section:
//
//   - `this.loopId` lives on the module's single exported object, so two
//     mounts of the same effect share one rAF id and the second stop() orphans
//     the first loop. Here the id is a closure per mount, which is what makes
//     several panels on one page independent.
//   - colsRows() derives cols and rows from the viewport against an 8x12
//     character guess. A section does not own the viewport, and a measured
//     grid cannot match an authored resting frame: the frame is written at
//     fixed dimensions, so a live grid of different dimensions reflows the
//     moment the script takes over. So the grid is DECLARED (--fx-cols /
//     --fx-rows) and style.css scales the type to fit with a container query.
//     The resting frame is then the live grid at every viewport width, and
//     torus keeps its aspect instead of stretching to an ellipse.
//   - visibilityPause() re-activates on tab focus because upstream re-measures
//     the viewport. Nothing here needs re-measuring and rAF already stops in a
//     hidden tab, so it is dropped. What replaces it is an IntersectionObserver
//     that idles a panel scrolled off screen, which upstream cannot want (its
//     <pre> is always on screen) and a page with three panels does.
//
// The port shape follows from that: upstream's `start(pre, colsRows)` body is
// an effect's make(w, h, settings), upstream's `step()` is the closure make
// returns, and `pre.textContent = out; requestAnimationFrame(step)` is
// `return out`. The visual logic in between is untouched.

/** util.js, verbatim. */
export function makeRowBuffers(w, h) {
  const rows = new Array(h);
  for (let y = 0; y < h; y++) rows[y] = new Array(w);
  return rows;
}

/** util.js, verbatim. */
export function buildText(rows, lines) {
  const out = lines && lines.length === rows.length ? lines : new Array(rows.length);
  for (let y = 0; y < rows.length; y++) out[y] = rows[y].join('');
  return out.join('\n');
}

/** util.js, verbatim. */
export function ensureArray(len, fill = 0, arr) {
  if (!arr || arr.length !== len) return new Array(len).fill(fill);
  return arr;
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// A grid dimension an option supplied. The ceilings are not upstream's
// (makeDims caps at 120x60 because that is what fits a 1080p viewport at 8x12);
// they are here so a mistyped option cannot ask for a million-cell grid every
// frame. Anything outside the range falls back to the effect's own default
// rather than clamping, because a silently halved grid is harder to notice
// than one that simply did not change.
const gridInt = (value, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 8 && n <= 400 ? n : fallback;
};

/**
 * Mounts one ascii-lab effect onto a section.
 *
 * @param el       the section. Must contain a [data-fx-grid] <pre> holding the
 *                 authored resting frame.
 * @param defaults the effect's own settings, upstream's constants as written.
 *                 `cols` and `rows` are required and must match what
 *                 style.css declares, or the script's first frame reflows.
 * @param opts     the caller's overrides.
 * @param make     (w, h, settings) => () => string. Upstream's start() body,
 *                 returning upstream's step() with the textContent write and
 *                 the rAF call taken out.
 */
export function mountGrid(el, { defaults = {}, opts = {}, make }) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  // Queried inside the section, never by id: two panels on one page each find
  // their own <pre>, and there is no shared handle for the second mount to
  // steal. (An id would also collapse them -- an empty id is not nullish.)
  const pre = el.querySelector("[data-fx-grid]");
  if (!pre) return resting;

  // Effect contract: stay at rest. The authored frame in the markup is already
  // the finished picture, so there is nothing to do and nothing to undo.
  if (reducedMotion()) return resting;

  const original = pre.textContent;
  const settings = { ...defaults, ...opts };
  let id = 0;
  let step = null;
  let observer = null;

  const build = () => {
    const cols = gridInt(settings.cols, defaults.cols);
    const rows = gridInt(settings.rows, defaults.rows);
    // Published back so style.css scales the type to the grid the script is
    // actually drawing, rather than to the one the markup was authored at.
    el.style.setProperty("--fx-cols", String(cols));
    el.style.setProperty("--fx-rows", String(rows));
    step = make(cols, rows, settings);
  };

  const frame = () => {
    pre.textContent = step();
    id = requestAnimationFrame(frame);
  };
  const start = () => {
    if (id) return;
    el.setAttribute("data-fx-live", "");
    id = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (!id) return;
    cancelAnimationFrame(id);
    id = 0;
  };

  build();

  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) start();
      else stop();
    });
    observer.observe(el);
  } else {
    start();
  }

  return {
    update(next = {}) {
      Object.assign(settings, next);
      build();
    },
    destroy() {
      stop();
      observer?.disconnect();
      observer = null;
      // The authored frame goes back. A destroy mid-run otherwise leaves
      // whichever frame happened to be on screen, and a page transition would
      // leave a half-drawn one.
      pre.textContent = original;
      el.removeAttribute("data-fx-live");
      el.style.removeProperty("--fx-cols");
      el.style.removeProperty("--fx-rows");
    },
  };
}
