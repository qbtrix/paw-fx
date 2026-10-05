/*!
 * glass-navbar.js
 * MIT License
 * Copyright (c) 2026 glass-navbar contributors
 * https://github.com/ningqi24/deepseek-style-floating-navbar
 */
// capsule-nav: a port of ningqi24/deepseek-style-floating-navbar, commit
// bac85cfbdf3c80bcdb94417a4aeeb92522e69634, glass-navbar.js with
// glass-navbar.css. A floating capsule header: at scroll 0 it is edge to
// edge, full container width and transparent; past `threshold` it springs
// (stiffness 180, damping 28, mass 1, integrated per rAF frame, not a CSS
// transition) to a narrower, thinner pill while the frosted glass fades in
// through a CSS transition on `.is-scrolled`. Every size the spring drives is
// a custom property read once in _readTokens.
//
// Seams, and nothing else: the UMD wrapper, auto-init and initAll are gone
// in favour of mount/update/destroy; the two throws become the resting
// handle; `--gnav-*` is `--fx-*` and `gnav` classes are `fx-cnav`; the
// data-gnav-* attribute overrides are replaced by mount options. The scroll
// source stays `window`, as upstream: this is a page-level nav. Under
// prefers-reduced-motion upstream already settles instead of animating.

export const meta = {
  name: "capsule-nav",
  version: "1.0.0",
  category: "menu",
  needs: [],
  license: "MIT",
  options: {
    threshold: { type: "number", default: 80, description: "Scroll distance in px past which the capsule narrows and the glass fades in. Upstream's DEFAULTS.threshold." },
    stiffness: { type: "number", default: 180, description: "Spring constant k. Upstream's DEFAULTS.stiffness." },
    damping: { type: "number", default: 28, description: "Damping c, about critical at 2*sqrt(k*m). Upstream's DEFAULTS.damping." },
    mass: { type: "number", default: 1, description: "Spring mass m. Upstream's DEFAULTS.mass." },
  },
};

const resting = { update() {}, destroy() {} };

  var DEFAULTS = {
    threshold: 80,
    stiffness: 180,
    damping: 28,
    mass: 1,
  };

  var REST_VALUE = 0.05;
  var REST_VELOCITY = 0.05;
  var MAX_STEP = 1 / 30;

  function num(value, fallback) {
    var v = parseFloat(value);
    return isFinite(v) ? v : fallback;
  }

  function GlassNavbar(element, options) {
    if (!(this instanceof GlassNavbar)) return new GlassNavbar(element, options);
    var el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return resting;
    var bar = el.querySelector('.fx-cnav__bar');
    var inner = el.querySelector('.fx-cnav__inner');
    if (!bar || !inner) return resting;

    var opts = {};
    for (var k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) opts[k] = DEFAULTS[k];
    for (var o in options) if (Object.prototype.hasOwnProperty.call(options, o)) opts[o] = options[o];

    this.el = el;
    this.bar = bar;
    this.inner = inner;
    this.options = opts;

    this._spec = [
      { key: 'maxWidth', apply: function (v) { bar.style.maxWidth = v + 'px'; } },
      { key: 'padL', apply: function (v) { bar.style.paddingLeft = v + 'px'; } },
      { key: 'padR', apply: function (v) { bar.style.paddingRight = v + 'px'; } },
      { key: 'padY', apply: function (v) { bar.style.paddingTop = v + 'px'; bar.style.paddingBottom = v + 'px'; } },
      { key: 'innerH', apply: function (v) { inner.style.height = v + 'px'; } },
      { key: 'topPad', apply: function (v) { el.style.paddingTop = v + 'px'; } },
    ];

    this._current = {};
    this._target = {};
    this._velocity = {};
    this._tokens = null;
    this._raf = 0;
    this._lastTime = 0;
    this._resizeTimer = 0;
    this._destroyed = false;

    var self = this;
    this._onScroll = function () { self.update(); };
    this._onResize = function () {
      clearTimeout(self._resizeTimer);
      self._resizeTimer = setTimeout(function () {
        self._tokens = null;
        self.update();
        self.settle();
      }, 120);
    };
    this._onReduceChange = function () { self.update(); };
    this._reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });
    if (this._reduceQuery.addEventListener) {
      this._reduceQuery.addEventListener('change', this._onReduceChange);
    }

    this.update();
    this.settle();
  }

  GlassNavbar.prototype._readTokens = function () {
    var cs = getComputedStyle(this.el);
    var get = function (name, fallback) { return num(cs.getPropertyValue(name), fallback); };
    return {
      top: get('--fx-top', 8),
      topOn: get('--fx-top-on', 5),
      padY: get('--fx-pad-y', 4),
      padYOn: get('--fx-pad-y-on', 2),
      innerH: get('--fx-inner-h', 48),
      innerHOn: get('--fx-inner-h-on', 42),
      inset: get('--fx-inset', 80),
      insetMin: get('--fx-inset-min', 720),
      padLOn: get('--fx-pad-l-on', 18),
      padROn: get('--fx-pad-r-on', 12),
    };
  };

  GlassNavbar.prototype.update = function () {
    if (this._destroyed) return;
    if (!this._tokens) this._tokens = this._readTokens();
    var t = this._tokens;

    var scrolled = window.pageYOffset > this.options.threshold;
    if (scrolled !== this.isScrolled) {
      this.isScrolled = scrolled;
      if (scrolled) this.el.classList.add('is-scrolled');
      else this.el.classList.remove('is-scrolled');
    }

    var avail = this.el.clientWidth;
    var inset = t.inset > 0 && avail > t.insetMin ? t.inset : 0;

    this._target.maxWidth = scrolled ? avail - inset : avail;
    this._target.padL = scrolled ? t.padLOn : 0;
    this._target.padR = scrolled ? t.padROn : 0;
    this._target.padY = scrolled ? t.padYOn : t.padY;
    this._target.innerH = scrolled ? t.innerHOn : t.innerH;
    this._target.topPad = scrolled ? t.topOn : t.top;

    this._start();
  };

  GlassNavbar.prototype._paint = function () {
    for (var i = 0; i < this._spec.length; i++) {
      this._spec[i].apply(this._current[this._spec[i].key]);
    }
  };

  GlassNavbar.prototype.settle = function () {
    for (var i = 0; i < this._spec.length; i++) {
      var k = this._spec[i].key;
      this._current[k] = this._target[k];
      this._velocity[k] = 0;
    }
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._paint();
  };

  GlassNavbar.prototype._start = function () {
    if (this._reduceQuery.matches) { this.settle(); return; }
    if (this._raf || this._destroyed) return;
    this._lastTime = performance.now();
    var self = this;
    this._raf = requestAnimationFrame(function (now) { self._tick(now); });
  };

  GlassNavbar.prototype._tick = function (now) {
    var dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > MAX_STEP) dt = MAX_STEP;

    var k = this.options.stiffness;
    var c = this.options.damping;
    var m = this.options.mass;
    var settled = true;

    for (var i = 0; i < this._spec.length; i++) {
      var key = this._spec[i].key;
      var x = this._current[key];
      var v = this._velocity[key];
      var goal = this._target[key];
      var a = (-k * (x - goal) - c * v) / m;
      v += a * dt;
      x += v * dt;
      if (Math.abs(x - goal) < REST_VALUE && Math.abs(v) < REST_VELOCITY) { x = goal; v = 0; }
      else settled = false;
      this._current[key] = x;
      this._velocity[key] = v;
    }

    this._paint();

    if (settled) { this._raf = 0; return; }
    var self = this;
    this._raf = requestAnimationFrame(function (n) { self._tick(n); });
  };

  GlassNavbar.prototype.destroy = function () {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    clearTimeout(this._resizeTimer);
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    if (this._reduceQuery.removeEventListener) {
      this._reduceQuery.removeEventListener('change', this._onReduceChange);
    }
    for (var i = 0; i < this._spec.length; i++) {
      var key = this._spec[i].key;
      if (key === 'maxWidth') this.bar.style.maxWidth = '';
      else if (key === 'padL') this.bar.style.paddingLeft = '';
      else if (key === 'padR') this.bar.style.paddingRight = '';
      else if (key === 'padY') { this.bar.style.paddingTop = ''; this.bar.style.paddingBottom = ''; }
      else if (key === 'innerH') this.inner.style.height = '';
      else if (key === 'topPad') this.el.style.paddingTop = '';
    }
    this.el.classList.remove('is-scrolled');
  };

// mount() is handed the section; the header lives inside it. The structure is
// checked here, before construction, so the handle below never holds a
// resting stand-in whose `options` it would then try to assign into.
export function mount(el, opts = {}) {
  if (!el || typeof document === 'undefined' || typeof matchMedia !== 'function') return resting;
  if (typeof el.querySelector !== 'function') return resting;
  var nav = el.querySelector('.fx-cnav');
  if (!nav || !nav.querySelector('.fx-cnav__bar') || !nav.querySelector('.fx-cnav__inner')) return resting;

  // opts carries threshold, stiffness, damping, mass; the constructor's own
  // merge lays them over DEFAULTS exactly as upstream's options argument did.
  var instance = new GlassNavbar(nav, opts);
  if (!instance.options) return resting;
  el.setAttribute('data-fx-live', '');

  return {
    update(next = {}) { Object.assign(instance.options, next); instance.update(); },
    destroy() { instance.destroy(); el.removeAttribute('data-fx-live'); },
  };
}
