// koi-pond, from Shell:B Screensavers (Koi Pond by Evie & Shell:B) — MIT License
// https://github.com/ShellB-App/Shell-B-Screensavers
//
// MIT License
//
// Copyright (c) 2026 Evangeline Minet and contributors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// koi-pond: a port of screensavers/koi-pond/index.html from
// ShellB-App/Shell-B-Screensavers at commit
// 34a9630de6e433d7513145e22e8e334f477202fa. A night koi pond seen from above,
// on one 2D canvas behind a hero's copy: schools of koi wander and hold
// together, each one leaves rings on the water, lily pads drift and turn,
// caustic light slides across the bottom, and the moon lays a shimmering
// path on the surface.
//
// Upstream's whole inline script sits inside build() below, indented but
// otherwise verbatim from the CFG block to the main loop. Every changed line
// carries a "seam" comment: W and H are the section's clientWidth and
// clientHeight, the options are merged into CFG, and the frame loop's handle
// belongs to mount so it can pause and restart. Four upstream lines are gone:
// the getElementById('c') lookup (mount makes the canvas) and the three-line
// resize handler, whose location.reload() became a ResizeObserver that calls build()
// again after the same 400 ms debounce. Under reduced motion nothing mounts
// and style.css's resting pond stays.

// ---- paw-fx seams: mount / update / destroy ---------------------------------

export const meta = {
  name: "koi-pond",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    numSchools: { type: "number", default: 4, min: 1, max: 8, step: 1, description: "How many schools of koi share the pond; each holds 6 to 9 fish. Upstream's CFG.numSchools." },
    lilyCount: { type: "number", default: 10, min: 0, max: 20, step: 1, description: "How many lily pads drift on the surface, drawn over the koi. Upstream's CFG.lilyCount." },
    koiSpeed: { type: "number", default: 0.4, min: 0.1, max: 1, step: 0.05, description: "Base swimming speed in pixels per frame; each fish gets half to all of it. Upstream's CFG.koiSpeed." },
    causticAlpha: { type: "number", default: 0.065, min: 0, max: 0.2, step: 0.005, description: "Strength of the caustic light patches that slide across the pond floor. Upstream's CFG.causticAlpha." },
  },
};

const DEFAULTS = { numSchools: 4, lilyCount: 10, koiSpeed: 0.4, causticAlpha: 0.065 };

// The options that may override upstream's CFG. A value that is not a finite,
// non-negative number keeps upstream's; koiSpeed must stay above 0, because
// drawKoi divides by it.
function knobs(settings) {
  const out = {};
  for (const key of Object.keys(DEFAULTS)) {
    const v = Number(settings[key]);
    if (Number.isFinite(v) && (key === "koiSpeed" ? v > 0 : v >= 0)) out[key] = v;
  }
  return out;
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css's pond is the
  // finished picture. (Upstream slows to CFG.reducedMotion instead.)
  if (!el || typeof document === "undefined" || reducedMotion()) return resting;

  // Upstream's <canvas id="c">, made here and kept behind the copy.
  const cv = document.createElement("canvas");
  cv.className = "fx-koi-pond__canvas";
  cv.setAttribute("aria-hidden", "true");
  if (!cv.getContext("2d")) return resting;
  el.insertBefore(cv, el.firstChild);

  let settings = { ...DEFAULTS, ...opts };
  let raf = 0;
  let step = null; // the current pond's frame(now)
  let builtW = 0;
  let builtH = 0;
  let visible = true;
  let stopped = false;
  let resizeTimer = 0;

  // Upstream's inline script, from the CFG block to the first frame. Each call
  // lays out a fresh pond for the section's current size and returns frame.
  function build() {
    // ═══════════════════════════════════════════════════════
    // KOI POND NIGHT — SCREENSAVER
    // Tuning constants
    // ═══════════════════════════════════════════════════════
    const CFG = {
      reducedMotion: 0.25,
      // Water colors [R, G, B]
      waterLight:   [16, 34, 58],
      waterDark:    [8, 18, 36],
      causticAlpha: 0.065,
      // Moon
      moonX:        0.72,
      moonY:        0.2,
      moonRadiusF:  0.2,       // fraction of min(W,H)
      moonColor:    [195, 218, 240],
      moonGlowBase: 0.18,
      // Koi schools
      numSchools:   4,
      fishMin:      6,
      fishMax:      10,
      koiLenMin:    36,
      koiLenMax:    58,
      koiSpeed:     0.4,
      wanderRate:   0.35,
      cohesionStr:  0.0006,
      separationDist: 38,
      boundaryMargin: 130,
      rippleIntervalMin: 4,
      rippleIntervalMax: 9,
      // Lily pads
      lilyCount:    10,
      lilyRMin:     50,
      lilyRMax:     85,
      driftSpeed:   0.025,
      // Ripples
      rippleMaxR:   65,
      rippleAlpha:  0.18,
      rippleExpRate: 35,       // px per second
      // Moonlight shimmer
      shimmerLayers: 3,
    };
    Object.assign(CFG, knobs(settings)); // seam: options override upstream's CFG

    // ═══════════════════════════════════════════════════════
    // SETUP — immediate, no event dependencies
    // ═══════════════════════════════════════════════════════
    const g = cv.getContext('2d');

    const isReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const slow = isReduced ? CFG.reducedMotion : 1;

    const W = el.clientWidth || 1920; // seam: the section's box, not the window
    const H = el.clientHeight || 1080; // seam
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ═══════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
    function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
    function angleDiff(a, b) {
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    }

    // ═══════════════════════════════════════════════════════
    // KOI TYPES
    // ═══════════════════════════════════════════════════════
    const KOI_TYPES = [
      { name: 'orange', head: '#f07840', body: '#d4652a', tail: '#b85520', patch: null },
      { name: 'white',  head: '#f2e8d6', body: '#e6d8c4', tail: '#d8ccb8', patch: null },
      { name: 'black',  head: '#3a3a50', body: '#222238', tail: '#1a1a2e', patch: null },
      { name: 'calico', head: '#f0d8c0', body: '#d4652a', tail: '#b85520', patch: '#1a1a2e' },
      { name: 'shiro',  head: '#f5ece0', body: '#f0e6d4', tail: '#e0d4c0', patch: '#d4652a' },
    ];

    // ═══════════════════════════════════════════════════════
    // SCENE STATE
    // ═══════════════════════════════════════════════════════
    let koi = [];
    let lilyPads = [];
    const MAX_RIPPLES = 80;
    let ripples = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      ripples.push({ x: 0, y: 0, r: 0, a: 0, alive: false });
    }
    let nextRippleIdx = 0;

    // ═══════════════════════════════════════════════════════
    // OBJECT CREATORS
    // ═══════════════════════════════════════════════════════
    function makeKoi(schoolId) {
      const len = rand(CFG.koiLenMin, CFG.koiLenMax);
      const type = KOI_TYPES[Math.floor(Math.random() * KOI_TYPES.length)];
      return {
        x: rand(100, W - 100),
        y: rand(100, H - 100),
        angle: rand(0, Math.PI * 2),
        speed: rand(0.5, 1.0) * CFG.koiSpeed,
        targetAngle: rand(0, Math.PI * 2),
        len, type, schoolId,
        tailPhase: rand(0, Math.PI * 2),
        rippleTimer: rand(CFG.rippleIntervalMin, CFG.rippleIntervalMax),
      };
    }

    function makeLilyPad() {
      const r = rand(CFG.lilyRMin, CFG.lilyRMax);
      return {
        x: rand(r + 40, W - r - 40),
        y: rand(r + 40, H - r - 40),
        angle: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.004, 0.004) * slow,
        dx: rand(-1, 1) * CFG.driftSpeed * slow,
        dy: rand(-1, 1) * CFG.driftSpeed * slow,
        radius: r,
        notchAngle: rand(0, Math.PI * 2),
        shade: rand(0.75, 1.0),
      };
    }

    // ═══════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════
    koi = [];
    for (let s = 0; s < CFG.numSchools; s++) {
      const count = Math.floor(rand(CFG.fishMin, CFG.fishMax));
      const cx = W * rand(0.25, 0.75);
      const cy = H * rand(0.25, 0.75);
      for (let i = 0; i < count; i++) {
        const k = makeKoi(s);
        k.x = cx + rand(-100, 100);
        k.y = cy + rand(-80, 80);
        koi.push(k);
      }
    }

    lilyPads = [];
    for (let i = 0; i < CFG.lilyCount; i++) {
      lilyPads.push(makeLilyPad());
    }

    // ═══════════════════════════════════════════════════════
    // UPDATE FUNCTIONS
    // ═══════════════════════════════════════════════════════
    function updateKoi(dt) {
      const s = slow;
      for (let i = 0; i < koi.length; i++) {
        const k = koi[i];

        // Wander: drift target angle
        k.targetAngle += rand(-1, 1) * CFG.wanderRate * dt * s;

        // Cohesion: steer toward nearby schoolmates
        let cx = 0, cy = 0, cn = 0;
        for (let j = 0; j < koi.length; j++) {
          if (i === j || koi[j].schoolId !== k.schoolId) continue;
          const d = dist(k.x, k.y, koi[j].x, koi[j].y);
          if (d < 220) { cx += koi[j].x; cy += koi[j].y; cn++; }
        }
        if (cn > 0) {
          const ca = Math.atan2(cy / cn - k.y, cx / cn - k.x);
          k.targetAngle += angleDiff(k.targetAngle, ca) * CFG.cohesionStr * s;
        }

        // Separation: avoid crowding
        for (let j = 0; j < koi.length; j++) {
          if (i === j) continue;
          const d = dist(k.x, k.y, koi[j].x, koi[j].y);
          if (d < CFG.separationDist && d > 1) {
            const repelAngle = Math.atan2(k.y - koi[j].y, k.x - koi[j].x);
            k.targetAngle += angleDiff(k.angle, repelAngle) * 0.015 / d;
          }
        }

        // Boundary avoidance (soft turn-away)
        const bm = CFG.boundaryMargin;
        if (k.x < bm) k.targetAngle += 0.8;
        if (k.x > W - bm) k.targetAngle -= 0.8;
        if (k.y < bm) k.targetAngle += 1.2;
        if (k.y > H - bm) k.targetAngle -= 1.2;

        // Smooth steering
        const ad = angleDiff(k.angle, k.targetAngle);
        k.angle += clamp(ad, -0.035 * s, 0.035 * s);

        // Speed variation
        k.speed += rand(-0.008, 0.008) * s;
        k.speed = clamp(k.speed, 0.12, CFG.koiSpeed * 2.5);

        // Move
        k.x += Math.cos(k.angle) * k.speed * s;
        k.y += Math.sin(k.angle) * k.speed * s;

        // Ripple spawning
        k.rippleTimer -= dt;
        if (k.rippleTimer <= 0) {
          spawnRipple(k.x, k.y);
          k.rippleTimer = rand(CFG.rippleIntervalMin, CFG.rippleIntervalMax);
        }
        k.tailPhase += k.speed * 0.35 * s;
      }
    }

    function spawnRipple(x, y) {
      for (let ring = 0; ring < 3; ring++) {
        const rp = ripples[nextRippleIdx % MAX_RIPPLES];
        nextRippleIdx++;
        rp.x = x + rand(-6, 6);
        rp.y = y + rand(-6, 6);
        rp.r = 3 + ring * 5;
        rp.a = CFG.rippleAlpha - ring * 0.025;
        rp.alive = true;
      }
    }

    function updateRipples(dt) {
      for (let i = 0; i < MAX_RIPPLES; i++) {
        const r = ripples[i];
        if (!r.alive) continue;
        r.r += CFG.rippleExpRate * dt * slow;
        r.a *= 0.996;
        if (r.r > CFG.rippleMaxR || r.a < 0.001) r.alive = false;
      }
    }

    function updateLilyPads(dt) {
      for (const lp of lilyPads) {
        lp.x += lp.dx * slow;
        lp.y += lp.dy * slow;
        lp.angle += lp.rotSpeed * slow;
        const m = lp.radius + 20;
        if (lp.x < -m) lp.x = W + m;
        if (lp.x > W + m) lp.x = -m;
        if (lp.y < -m) lp.y = H + m;
        if (lp.y > H + m) lp.y = -m;
      }
    }

    // ═══════════════════════════════════════════════════════
    // DRAW: WATER BACKGROUND
    // ═══════════════════════════════════════════════════════
    function drawWater(time) {
      const wl = CFG.waterLight, wd = CFG.waterDark;
      const grd = g.createLinearGradient(0, 0, W * 0.3, H);
      grd.addColorStop(0, `rgb(${wd[0]},${wd[1]},${wd[2]})`);
      grd.addColorStop(0.5, `rgb(${lerp(wd[0],wl[0],0.3)|0},${lerp(wd[1],wl[1],0.3)|0},${lerp(wd[2],wl[2],0.3)|0})`);
      grd.addColorStop(1, `rgb(${wl[0]},${wl[1]},${wl[2]})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);

      // Caustic light patches
      g.globalAlpha = CFG.causticAlpha;
      for (let i = 0; i < 8; i++) {
        const cx = W * ((Math.sin(time * 0.012 + i * 1.3) + 1) / 2);
        const cy = H * ((Math.cos(time * 0.009 + i * 1.7) + 1) / 2);
        const cr = Math.min(W, H) * rand(0.08, 0.22);
        const cg = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
        cg.addColorStop(0, 'rgba(45, 90, 120, 0.7)');
        cg.addColorStop(0.6, 'rgba(35, 70, 100, 0.2)');
        cg.addColorStop(1, 'rgba(15, 30, 50, 0)');
        g.fillStyle = cg;
        g.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      }

      // Subtle surface noise highlights
      g.globalAlpha = 0.015;
      for (let i = 0; i < 25; i++) {
        const nx = W * ((Math.sin(time * 0.007 + i * 7.3) + 1) / 2);
        const ny = H * ((Math.cos(time * 0.005 + i * 5.1) + 1) / 2);
        const nr = rand(50, 140);
        const ng = g.createRadialGradient(nx, ny, 0, nx, ny, nr);
        ng.addColorStop(0, 'rgba(70, 120, 145, 0.3)');
        ng.addColorStop(1, 'rgba(20, 40, 60, 0)');
        g.fillStyle = ng;
        g.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      }
      g.globalAlpha = 1;
    }

    // ═══════════════════════════════════════════════════════
    // DRAW: KOI FISH
    // ═══════════════════════════════════════════════════════
    function drawKoi(k, time) {
      g.save();
      g.translate(k.x, k.y);
      g.rotate(k.angle);

      const len = k.len;
      const bw = len * 0.38;
      const tw = Math.sin(k.tailPhase) * 5 * (k.speed / CFG.koiSpeed);

      // Shadow on water
      g.globalAlpha = 0.1;
      g.fillStyle = '#000';
      g.beginPath();
      g.ellipse(2, 3, len * 0.52, bw * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;

      // Tail fin (fan-shaped, wagging)
      g.fillStyle = k.type.tail;
      g.beginPath();
      g.moveTo(-len * 0.38, 0);
      const tSpread = bw * 1.2 + tw;
      g.quadraticCurveTo(-len * 0.52, -tSpread * 0.65, -len * 0.7, -tSpread);
      g.quadraticCurveTo(-len * 0.6, -tw * 0.15, -len * 0.66, -tSpread * 0.35);
      g.lineTo(-len * 0.48, 0);
      g.lineTo(-len * 0.66, tSpread * 0.35);
      g.quadraticCurveTo(-len * 0.6, tw * 0.15, -len * 0.7, tSpread);
      g.quadraticCurveTo(-len * 0.52, tSpread * 0.65, -len * 0.38, 0);
      g.fill();

      // Dorsal fin
      g.globalAlpha = 0.15;
      g.fillStyle = k.type.body;
      g.beginPath();
      g.moveTo(len * 0.12, -bw * 0.48);
      g.quadraticCurveTo(-len * 0.02, -bw * 0.9 + tw * 0.25, -len * 0.22, -bw * 0.52);
      g.lineTo(-len * 0.16, -bw * 0.42);
      g.quadraticCurveTo(-len * 0.02, -bw * 0.65, len * 0.12, -bw * 0.48);
      g.fill();
      g.globalAlpha = 1;

      // Body gradient (rich, saturated)
      const bg = g.createLinearGradient(0, -bw / 2, 0, bw / 2);
      bg.addColorStop(0, k.type.head);
      bg.addColorStop(0.35, k.type.body);
      bg.addColorStop(1, k.type.tail);

      // Body shape (teardrop: wider behind head, tapering to tail)
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(len * 0.46, 0);
      g.quadraticCurveTo(len * 0.38, -bw * 0.36, len * 0.08, -bw * 0.52);
      g.quadraticCurveTo(-len * 0.12, -bw * 0.54, -len * 0.32, -bw * 0.36);
      g.quadraticCurveTo(-len * 0.44, -bw * 0.18, -len * 0.5, 0);
      g.quadraticCurveTo(-len * 0.44, bw * 0.18, -len * 0.32, bw * 0.36);
      g.quadraticCurveTo(-len * 0.12, bw * 0.54, len * 0.08, bw * 0.52);
      g.quadraticCurveTo(len * 0.38, bw * 0.36, len * 0.46, 0);
      g.fill();

      // Dorsal ridge highlight (subtle light on back)
      g.globalAlpha = 0.08;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(-len * 0.02, -bw * 0.22, len * 0.24, bw * 0.19, -0.15, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;

      // Patches (calico/shiro types)
      if (k.type.patch) {
        g.fillStyle = k.type.patch;
        const seed = k.type.name.charCodeAt(0) * 100 + k.type.name.charCodeAt(2);
        for (let p = 0; p < 4; p++) {
          const px = ((seed * (p + 1) * 7) % 80 - 35) / 100 * len;
          const py = ((seed * (p + 1) * 13) % 60 - 25) / 100 * bw;
          const pr = rand(5, 14);
          g.beginPath();
          for (let pt = 0; pt < 8; pt++) {
            const pa = (pt / 8) * Math.PI * 2;
            const rr = pr * (0.6 + 0.4 * Math.sin(pa * 3 + p));
            g.lineTo(px + Math.cos(pa) * rr, py + Math.sin(pa) * rr);
          }
          g.closePath();
          g.fill();
        }
      }

      // Head
      g.fillStyle = k.type.head;
      g.beginPath();
      g.ellipse(len * 0.38, 0, len * 0.13, bw * 0.46, 0, 0, Math.PI * 2);
      g.fill();

      // Eye (koi have big eyes)
      g.fillStyle = '#080812';
      g.beginPath();
      g.arc(len * 0.44, -bw * 0.19, 2.6, 0, Math.PI * 2);
      g.fill();
      // Catchlight
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.arc(len * 0.45, -bw * 0.21, 1.3, 0, Math.PI * 2);
      g.fill();

      // Barbels (whiskers — koi are famous for these)
      g.strokeStyle = 'rgba(200, 190, 170, 0.25)';
      g.lineWidth = 0.6;
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath();
        g.moveTo(len * 0.48, s * bw * 0.12);
        g.quadraticCurveTo(
          len * 0.56, s * bw * 0.22 + Math.sin(time * 0.3) * 2,
          len * 0.62, s * bw * 0.32 + Math.sin(time * 0.3 + 1) * 3
        );
        g.stroke();
      }

      // Pectoral fins (subtle, on sides near head)
      g.globalAlpha = 0.18;
      g.fillStyle = k.type.body;
      for (let s = -1; s <= 1; s += 2) {
        const fx = len * 0.14, fy = s * bw * 0.48;
        const fl = len * 0.22;
        const fa = s * 0.7 + Math.sin(time * 0.6 + k.tailPhase) * 0.2;
        g.beginPath();
        g.moveTo(fx, fy);
        g.quadraticCurveTo(fx - fl * 0.3, fy + s * fl * 0.5, fx - fl * 0.85, fy + Math.sin(fa) * fl * 0.4);
        g.quadraticCurveTo(fx - fl * 0.45, fy + s * fl * 0.16, fx, fy);
        g.fill();
      }
      g.globalAlpha = 1;

      g.restore();
    }

    // ═══════════════════════════════════════════════════════
    // DRAW: RIPPLES
    // ═══════════════════════════════════════════════════════
    function drawRipples() {
      for (const r of ripples) {
        if (!r.alive) continue;
        const fade = 1 - r.r / CFG.rippleMaxR;
        g.globalAlpha = r.a * Math.max(0, fade);
        const lw = Math.max(1.0, 2.0 * fade);
        g.strokeStyle = 'rgba(150, 200, 220, 0.9)';
        g.lineWidth = lw;
        g.beginPath();
        g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        g.stroke();
        // Inner ring
        if (r.r > 10) {
          g.globalAlpha = r.a * 0.3 * fade;
          g.lineWidth = 0.5;
          g.beginPath();
          g.arc(r.x, r.y, r.r * 0.55, 0, Math.PI * 2);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
    }

    // ═══════════════════════════════════════════════════════
    // DRAW: LILY PADS
    // ═══════════════════════════════════════════════════════
    function drawLilyPadPath(r, notch) {
      const sa = notch + 0.12;
      const ea = notch + Math.PI * 2 - 0.12;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r, sa, ea);
      g.closePath();
    }

    function drawLilyPad(lp) {
      g.save();
      g.translate(lp.x, lp.y);
      g.rotate(lp.angle);

      const r = lp.radius;
      const s = lp.shade;
      const notch = lp.notchAngle;

      // Shadow on water
      g.globalAlpha = 0.1;
      g.fillStyle = '#000';
      drawLilyPadPath(r, notch);
      g.fill();
      g.globalAlpha = 1;

      // Pad gradient (radial)
      const pg = g.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.08, 0, 0, r);
      pg.addColorStop(0, `rgba(${48*s|0},${86*s|0},${56*s|0},1)`);
      pg.addColorStop(0.55, `rgba(${34*s|0},${64*s|0},${42*s|0},1)`);
      pg.addColorStop(1, `rgba(${22*s|0},${46*s|0},${30*s|0},1)`);
      g.fillStyle = pg;
      drawLilyPadPath(r, notch);
      g.fill();

      // Rim highlight
      g.strokeStyle = 'rgba(55, 95, 65, 0.25)';
      g.lineWidth = 1.2;
      drawLilyPadPath(r, notch);
      g.stroke();

      // Veins (radiating from center)
      g.globalAlpha = 0.12;
      g.strokeStyle = 'rgba(70, 130, 85, 0.5)';
      g.lineWidth = 0.5;
      for (let v = 0; v < 14; v++) {
        const va = (v / 14) * Math.PI * 2 + notch * 0.3;
        if (Math.abs(angleDiff(va, notch)) < 0.35) continue;
        g.beginPath();
        g.moveTo(0, 0);
        const vr = r * rand(0.55, 0.92);
        g.lineTo(Math.cos(va) * vr, Math.sin(va) * vr);
        g.stroke();
      }

      // Center highlight
      g.globalAlpha = 0.03;
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      g.fill();

      g.globalAlpha = 1;
      g.restore();
    }

    // ═══════════════════════════════════════════════════════
    // DRAW: MOONLIGHT SHIMMER (single call)
    // ═══════════════════════════════════════════════════════
    function drawMoonlight(time) {
      const mx = W * CFG.moonX;
      const my = H * CFG.moonY;
      const mr = Math.min(W, H) * CFG.moonRadiusF;

      // Glow patch
      g.globalAlpha = CFG.moonGlowBase + 0.015 * Math.sin(time * 0.3);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, `rgba(${CFG.moonColor[0]},${CFG.moonColor[1]},${CFG.moonColor[2]},0.6)`);
      mg.addColorStop(0.3, `rgba(${CFG.moonColor[0]},${CFG.moonColor[1]},${CFG.moonColor[2]},0.18)`);
      mg.addColorStop(0.65, 'rgba(50, 80, 110, 0.06)');
      mg.addColorStop(1, 'rgba(10, 20, 30, 0)');
      g.fillStyle = mg;
      g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);

      // Shimmer streaks (horizontal light ripples)
      g.globalAlpha = 0.06;
      for (let layer = 0; layer < CFG.shimmerLayers; layer++) {
        const ly = my + layer * mr * 0.35 + Math.sin(time * 0.2 + layer) * mr * 0.12;
        const lx = mx + Math.sin(time * 0.14 + layer * 2) * mr * 0.2;
        const lw = mr * (1.3 + layer * 0.35);
        const lh = 6 + layer * 5;
        const sg = g.createLinearGradient(lx - lw, ly, lx + lw, ly);
        sg.addColorStop(0, 'rgba(180, 210, 230, 0)');
        sg.addColorStop(0.35, `rgba(200, 225, 240, ${0.25 + layer * 0.08})`);
        sg.addColorStop(0.5, `rgba(215, 238, 252, ${0.45 + Math.sin(time * 0.4 + layer) * 0.12})`);
        sg.addColorStop(0.65, `rgba(200, 225, 240, ${0.25 + layer * 0.08})`);
        sg.addColorStop(1, 'rgba(180, 210, 230, 0)');
        g.fillStyle = sg;
        g.fillRect(lx - lw, ly - lh / 2, lw * 2, lh);
      }

      // Sparkles
      g.globalAlpha = 0.055;
      for (let i = 0; i < 18; i++) {
        const sx = mx + Math.sin(time * 0.09 + i * 3.7) * mr * 1.1;
        const sy = my + Math.cos(time * 0.07 + i * 2.3) * mr * 0.5;
        const sr = rand(1, 3) * (0.5 + 0.5 * Math.sin(time * 0.6 + i));
        g.fillStyle = `rgba(215, 238, 255, ${0.25 + 0.3 * Math.sin(time * 0.7 + i * 1.5)})`;
        g.beginPath();
        g.arc(sx, sy, sr, 0, Math.PI * 2);
        g.fill();
      }

      // Moonlight path on water (vertical shimmer column)
      g.globalAlpha = 0.025 + 0.01 * Math.sin(time * 0.45);
      for (let row = 0; row < 22; row++) {
        const ry = my + row * mr * 0.1;
        const rw = mr * 0.25 * (1 - row / 28) * (0.6 + 0.4 * Math.sin(time * 0.35 + row * 0.7));
        if (rw < 3) continue;
        g.fillStyle = `rgba(175, 205, 225, ${0.12 * (1 - row / 22)})`;
        g.fillRect(mx - rw + Math.sin(time * 0.25 + row) * 4, ry, rw * 2, 2);
      }

      g.globalAlpha = 1;
    }

    // ═══════════════════════════════════════════════════════
    // DRAW: VIGNETTE
    // ═══════════════════════════════════════════════════════
    function drawVignette() {
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.4)');
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    }

    // ═══════════════════════════════════════════════════════
    // MAIN LOOP
    // ═══════════════════════════════════════════════════════
    let t = 3.5; // Start at 3.5s so ripples are already active on first frame
    let last = performance.now();

    // Spawn some initial ripples so the scene isn't empty on first frame
    for (let i = 0; i < koi.length; i += 2) {
      const rp = ripples[nextRippleIdx % MAX_RIPPLES];
      nextRippleIdx++;
      rp.x = koi[i].x + rand(-6, 6);
      rp.y = koi[i].y + rand(-6, 6);
      rp.r = 20; // Moderate initial radius
      rp.a = 0.5; // Moderate alpha — expands naturally as screensaver runs
      rp.alive = true;
    }

    // Fill background immediately for first frame
    drawWater(0);

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      // Update
      updateKoi(dt);
      updateRipples(dt);
      updateLilyPads(dt);

      // Draw layers (koi first, then lily pads on top for correct overlap)
      drawWater(t);
      drawMoonlight(t);

      for (const k of koi) drawKoi(k, t);
      for (const lp of lilyPads) drawLilyPad(lp);
      drawRipples();

      drawVignette();

      if (!el.hasAttribute('data-fx-live')) el.setAttribute('data-fx-live', ''); // seam
      raf = requestAnimationFrame(frame); // seam: mount owns the handle
    }

    return frame; // seam: mount starts and stops the loop
  }

  const start = () => {
    if (raf || stopped || !visible || !step) return;
    raf = requestAnimationFrame(step);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const rebuild = () => {
    stop();
    builtW = el.clientWidth;
    builtH = el.clientHeight;
    step = build();
    start();
  };

  // Upstream reloads the page 400 ms after the window stops resizing, because
  // the pond is laid out for one size. A section can resize without the window,
  // so a ResizeObserver lays the pond out again after the same debounce. Its
  // first callback reports the size build() already used, and is skipped.
  let resizer = null;
  if (typeof ResizeObserver === "function") {
    resizer = new ResizeObserver(() => {
      if (el.clientWidth === builtW && el.clientHeight === builtH) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 400);
    });
    resizer.observe(el);
  }
  // Off screen the pond stops. frame() clamps dt to 0.05 s, so it resumes
  // where it was; a hidden tab gets no animation frames and the same clamp.
  let watcher = null;
  if (typeof IntersectionObserver === "function") {
    watcher = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: 0 });
    watcher.observe(el);
  }
  rebuild();

  return {
    // koiSpeed and the counts are read when the fish and pads are made, so a
    // change lays out a fresh pond rather than editing the running one.
    update(next = {}) {
      if (stopped) return;
      const before = JSON.stringify(knobs(settings));
      settings = { ...settings, ...next };
      if (JSON.stringify(knobs(settings)) !== before) rebuild();
    },
    destroy() {
      if (stopped) return;
      stopped = true;
      stop();
      clearTimeout(resizeTimer);
      resizer?.disconnect();
      watcher?.disconnect();
      cv.remove();
      el.removeAttribute("data-fx-live");
    },
  };
}
