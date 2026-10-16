/*!
 * liquid-tab-bar — a gooey bottom navigation bar.
 * A membrane that sags under a finger-following ball, like a mattress under a
 * bowling ball. Zero dependencies. ~6KB gzipped. MIT licensed.
 *
 * The sag is a computed SVG path (a Gaussian dip), NOT a goo blur filter — a
 * blur can only bulge a shape outward, never dent it inward.
 *
 *   <nav class="liquid-tab-bar" data-liquid-tab-bar>
 *     <a href="#home"     data-icon="home">Home</a>
 *     <a href="#projects" data-icon="grid">Projects</a>
 *     <a href="#about"    data-icon="user">About</a>
 *     <a href="#contact"  data-icon="mail">Contact</a>
 *   </nav>
 *   <script src="liquid-tab-bar.js"></script>
 *
 * Elements with [data-liquid-tab-bar] auto-initialise on DOMContentLoaded.
 * Or call LiquidTabBar.mount(navEl, options) yourself.
 */
// MIT License, Copyright (c) 2026 Everyone Needs a Samwise
// https://github.com/everyoneneedsasamwise/liquid-tab-bar
//
// liquid-tab-bar: a port of everyoneneedsasamwise/liquid-tab-bar, commit
// fd3ebda76a9a12f967d294cd0c23858a392a45e3, liquid-tab-bar.js with
// liquid-tab-bar.css. A bottom nav whose SVG surface is redrawn every frame
// as a Gaussian dip under a ball that eases toward the pointer and settles
// on the tab you release over.
//
// Seams, and nothing else: the IIFE, the DOMContentLoaded auto-init and the
// LiquidTabBar global are gone in favour of mount/update/destroy; the one
// setProperty of --ltb-accent is --fx-ltb-accent. mount() passes its options
// straight to the constructor, so upstream's tabs / icons / onNavigate /
// onActiveChange / reducedMotion still work from JS. The snippet carries the
// DOM the constructor builds, so the bar is finished before this runs.

export const meta = {
  name: "liquid-tab-bar",
  version: "1.0.0",
  category: "menu",
  needs: [],
  license: "MIT",
  options: {
    active: { type: "number", default: 0, description: "Index of the tab the ball starts on. Upstream's options.active; with no value the tab is read from location.hash or location.pathname." },
  },
};

const resting = { update() {}, destroy() {} };

// ---- geometry (SVG user units == px) ------------------------------------
var R = 25;          // ball radius
var TOP_ROOM = 30;   // headroom above the bar for the ball to rise into
var BAR_H = 64;      // bar height
var H = BAR_H + TOP_ROOM;
var TOPLINE = TOP_ROOM; // resting y of the flat bar surface
var DIP = 20;        // how deep the ball presses the surface down
var SIG = 24;        // width of the dent
var LIP = 4;         // slight rebound (mattress shoulders) rising above the line
var LIP_SIG = 52;
var LERP = 0.26;     // follow stiffness — higher snaps faster, lower lags more

function edgeY(x, cx) {
  var a = x - cx;
  var dip = DIP * Math.exp(-(a * a) / (2 * SIG * SIG));
  var lip = LIP * Math.exp(-(a * a) / (2 * LIP_SIG * LIP_SIG));
  return TOPLINE + dip - lip;
}

function barPath(cx, W) {
  var step = 5, r = 12, x;
  var d = "M 0 " + TOPLINE.toFixed(1);
  for (x = 0; x <= W; x += step) d += " L " + x.toFixed(1) + " " + edgeY(x, cx).toFixed(2);
  d += " L " + W + " " + edgeY(W, cx).toFixed(2);
  d += " L " + W + " " + (H - r);
  d += " Q " + W + " " + H + " " + (W - r) + " " + H;
  d += " L " + r + " " + H;
  d += " Q 0 " + H + " 0 " + (H - r);
  d += " Z";
  return d;
}

// ---- built-in icons (24x24, stroked) ------------------------------------
// Supply your own by putting an inline <svg> inside the <a>, or extend this
// map via options.icons. Values are inner SVG markup drawn in a 0 0 24 24 box.
var ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>',
  work: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>',
  about: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>',
  mail: '<path d="M4 6.5h16v11H4z"/><path d="m5 7.5 7 5 7-5"/>',
  contact: '<path d="M4 6.5h16v11H4z"/><path d="m5 7.5 7 5 7-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7-.3C19 15.6 12 20 12 20Z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  play: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l6-3.5-6-3.5Z"/>',
  star: '<path d="m12 4 2.3 5 5.5.5-4.1 3.6 1.2 5.4L12 15.9 7.1 18.5l1.2-5.4L4.2 9.5l5.5-.5L12 4Z"/>',
  chat: '<path d="M4 5h16v11H9l-4 3.5V16H4z"/>'
};

// default accent palette, cycled across tabs that set no data-color
var PALETTE = ["#e09f5c", "#8aa0e8", "#6ee7b7", "#f3c17a", "#f0929b", "#b89cf0"];

var SVGNS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs) {
  var el = document.createElementNS(SVGNS, name);
  if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
  return el;
}

function prefersReducedMotion() {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isHash(href) { return typeof href === "string" && href.charAt(0) === "#"; }

// ---- the component ------------------------------------------------------
function LiquidTabBar(nav, options) {
  options = options || {};
  var self = this;
  this.nav = nav;
  this.options = options;

  // Read tabs from the markup (progressive enhancement) unless passed in.
  var anchors = [].slice.call(nav.querySelectorAll("a, button"));
  var tabs = options.tabs || anchors.map(function (a, i) {
    var customSvg = a.querySelector("svg");
    return {
      href: a.getAttribute("href") || "",
      label: (a.getAttribute("aria-label") || a.textContent || "").trim(),
      icon: a.getAttribute("data-icon") || "",
      customIcon: customSvg ? customSvg.innerHTML : "",
      color: a.getAttribute("data-color") || PALETTE[i % PALETTE.length],
      el: a
    };
  });
  if (!tabs.length) return;
  this.tabs = tabs;

  var icons = options.icons ? assign(assign({}, ICONS), options.icons) : ICONS;
  this.reduce = options.reducedMotion != null ? options.reducedMotion : prefersReducedMotion();

  // animation state
  this.W = 320;
  this.curX = 0;
  this.targetX = 0;
  this.raf = null;
  this.dragging = false;
  this.active = 0;
  this.visual = 0;

  // ---- build DOM ----
  nav.classList.add("liquid-tab-bar");
  nav.setAttribute("role", "navigation");
  nav.innerHTML = "";
  nav.style.touchAction = "none";

  var glow = document.createElement("div");
  glow.className = "ltb__glow";
  glow.setAttribute("aria-hidden", "true");
  nav.appendChild(glow);

  var svg = svgEl("svg", { "class": "ltb__membrane", "aria-hidden": "true" });
  var defs = svgEl("defs");
  var grad = svgEl("radialGradient", { id: ltbUid("shadow"), cx: "50%", cy: "38%", r: "60%" });
  grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "rgba(0,0,0,0.55)" }));
  grad.appendChild(svgEl("stop", { offset: "60%", "stop-color": "rgba(0,0,0,0.18)" }));
  grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "rgba(0,0,0,0)" }));
  defs.appendChild(grad);
  svg.appendChild(defs);
  var bar = svgEl("path", { "class": "ltb__bar", d: "" });
  var contact = svgEl("ellipse", { fill: "url(#" + grad.id + ")" });
  var ball = svgEl("circle", { "class": "ltb__ball" });
  var ballHi = svgEl("circle", { "class": "ltb__ballHi" });
  svg.appendChild(bar);
  svg.appendChild(contact);
  svg.appendChild(ball);
  svg.appendChild(ballHi);
  nav.appendChild(svg);

  var tabsWrap = document.createElement("div");
  tabsWrap.className = "ltb__tabs";
  tabs.forEach(function (t, i) {
    var a = document.createElement("a");
    a.className = "ltb__tab";
    a.href = t.href || "#";
    if (t.label) a.setAttribute("aria-label", t.label);
    var ico = svgEl("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" });
    ico.innerHTML = t.customIcon || icons[t.icon] || icons.grid;
    var lbl = document.createElement("span");
    lbl.className = "ltb__lbl";
    lbl.textContent = t.label;
    a.appendChild(ico);
    a.appendChild(lbl);
    a.addEventListener("click", function (e) {
      if (self.dragging) { e.preventDefault(); return; }
      var allow = self._navigate(i);
      if (!allow) e.preventDefault();
    });
    t.node = a;
    tabsWrap.appendChild(a);
  });
  nav.appendChild(tabsWrap);

  // refs
  this._svg = svg; this._bar = bar; this._ball = ball; this._ballHi = ballHi;
  this._contact = contact; this._glow = glow;

  // ---- pointer drag ----
  this._onDown = function (e) {
    self.dragging = true;
    try { nav.setPointerCapture(e.pointerId); } catch (_) {}
    self._animateTo(self._pointerToX(e));
  };
  this._onMove = function (e) { if (self.dragging) self.targetX = self._pointerToX(e); };
  this._onUp = function () {
    if (!self.dragging) return;
    self.dragging = false;
    var i = self._nearest(self.targetX);
    self._animateTo(self._centerOf(i));
    if (i !== self.active) self._navigate(i, true);
  };
  nav.addEventListener("pointerdown", this._onDown);
  nav.addEventListener("pointermove", this._onMove);
  nav.addEventListener("pointerup", this._onUp);
  nav.addEventListener("pointercancel", this._onUp);

  this._onResize = function () { self._layout(); };
  window.addEventListener("resize", this._onResize);

  this._onHash = function () {
    var i = self._indexForLocation();
    if (i >= 0 && i !== self.active) self.setActive(i);
  };
  window.addEventListener("hashchange", this._onHash);

  // ---- first paint ----
  var start = options.active != null ? options.active : this._indexForLocation();
  this.active = this.visual = start < 0 ? 0 : start;
  this._layout();
  this._paintTabs();
}

LiquidTabBar.prototype._centerOf = function (i) {
  return (i + 0.5) * (this.W / this.tabs.length);
};
LiquidTabBar.prototype._nearest = function (x) {
  var best = 0, bd = Infinity;
  for (var i = 0; i < this.tabs.length; i++) {
    var d = Math.abs(x - this._centerOf(i));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};
LiquidTabBar.prototype._pointerToX = function (e) {
  var rect = this._svg.getBoundingClientRect();
  return Math.max(16, Math.min(this.W - 16, e.clientX - rect.left));
};

LiquidTabBar.prototype._draw = function (x) {
  var surface = edgeY(x, x);
  var cy = surface - R * 0.46;
  this._bar.setAttribute("d", barPath(x, this.W));
  this._ball.setAttribute("cx", x); this._ball.setAttribute("cy", cy); this._ball.setAttribute("r", R);
  this._ballHi.setAttribute("cx", x - 7); this._ballHi.setAttribute("cy", cy - 8);
  this._ballHi.setAttribute("r", R * 0.42);
  this._contact.setAttribute("cx", x); this._contact.setAttribute("cy", surface + 3);
  this._contact.setAttribute("rx", R * 0.95); this._contact.setAttribute("ry", 7);
  this._glow.style.left = x + "px";
};

LiquidTabBar.prototype._tick = function () {
  var self = this;
  var nx = this.reduce ? this.targetX : this.curX + (this.targetX - this.curX) * LERP;
  if (Math.abs(this.targetX - this.curX) < 0.3) nx = this.targetX;
  this.curX = nx;
  this._draw(this.curX);
  var v = this._nearest(this.curX);
  if (v !== this.visual) { this.visual = v; this._paintTabs(); }
  if (this.dragging || Math.abs(this.targetX - this.curX) > 0.3) {
    this.raf = requestAnimationFrame(function () { self._tick(); });
  } else {
    this.raf = null;
  }
};

LiquidTabBar.prototype._animateTo = function (x) {
  var self = this;
  this.targetX = x;
  if (!this.raf) this.raf = requestAnimationFrame(function () { self._tick(); });
};

LiquidTabBar.prototype._layout = function () {
  this.W = this._svg.clientWidth || 320;
  this._svg.setAttribute("viewBox", "0 0 " + this.W + " " + H);
  this._svg.setAttribute("preserveAspectRatio", "none");
  if (!this.dragging) {
    this.curX = this.targetX = this._centerOf(this.active);
    this._draw(this.curX);
  }
};

// paint active/visual classes + the live accent colour
LiquidTabBar.prototype._paintTabs = function () {
  for (var i = 0; i < this.tabs.length; i++) {
    var on = i === this.visual;
    this.tabs[i].node.classList.toggle("is-active", on);
    if (on) this.tabs[i].node.setAttribute("aria-current", "page");
    else this.tabs[i].node.removeAttribute("aria-current");
  }
  this.nav.style.setProperty("--fx-ltb-accent", this.tabs[this.visual].color);
};

LiquidTabBar.prototype._indexForLocation = function () {
  var tabs = this.tabs, i;
  var anyHash = tabs.some(function (t) { return isHash(t.href); });
  if (anyHash) {
    var h = location.hash || (tabs[0] && tabs[0].href) || "";
    for (i = 0; i < tabs.length; i++) if (tabs[i].href === h) return i;
    return location.hash ? -1 : 0;
  }
  var path = location.pathname.replace(/\/+$/, "") || "/";
  var best = -1, bestLen = -1;
  for (i = 0; i < tabs.length; i++) {
    var hp = tabs[i].href.replace(/\/+$/, "") || "/";
    if (path === hp || (hp !== "/" && path.indexOf(hp + "/") === 0) || (hp !== "/" && path === hp)) {
      if (hp.length > bestLen) { bestLen = hp.length; best = i; }
    }
  }
  return best;
};

// returns true if the caller should let the browser navigate, false if handled
LiquidTabBar.prototype._navigate = function (i, viaDrag) {
  var tab = this.tabs[i];
  if (this.options.onNavigate) {
    var r = this.options.onNavigate(i, tab, { viaDrag: !!viaDrag });
    if (r === false) { this.setActive(i); return false; }
  }
  if (isHash(tab.href)) {
    if (location.hash !== tab.href) location.hash = tab.href; // fires hashchange -> setActive
    else this.setActive(i);
    return false;
  }
  if (viaDrag && tab.href) { location.href = tab.href; return false; }
  return true; // a plain click on a real link: let the browser do it
};

// ---- public API ----
LiquidTabBar.prototype.setActive = function (i) {
  if (i < 0 || i >= this.tabs.length) return;
  this.active = i;
  this._animateTo(this._centerOf(i));
  if (this.options.onActiveChange) this.options.onActiveChange(i, this.tabs[i]);
};
LiquidTabBar.prototype.destroy = function () {
  if (this.raf) cancelAnimationFrame(this.raf);
  this.nav.removeEventListener("pointerdown", this._onDown);
  this.nav.removeEventListener("pointermove", this._onMove);
  this.nav.removeEventListener("pointerup", this._onUp);
  this.nav.removeEventListener("pointercancel", this._onUp);
  window.removeEventListener("resize", this._onResize);
  window.removeEventListener("hashchange", this._onHash);
};

// ---- helpers ----
var uidN = 0;
function ltbUid(p) { uidN += 1; return "ltb-" + p + "-" + uidN; }
function assign(t, s) { for (var k in s) if (s.hasOwnProperty(k)) t[k] = s[k]; return t; }


export function mount(el, opts = {}) {
  if (!el || typeof document === "undefined") return resting;
  var nav = el.querySelector(".liquid-tab-bar");
  if (!nav) return resting;
  var bar = new LiquidTabBar(nav, opts);
  if (!bar.tabs) return resting;
  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) {
      if (next.active != null) bar.setActive(next.active);
    },
    destroy() {
      bar.destroy();
      el.removeAttribute("data-fx-live");
    },
  };
}
