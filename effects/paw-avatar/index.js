/*!
 * paw-avatar — a mascot head whose pose is a pure function of time.
 *
 * Engine ported from bloub, MIT License, Copyright (c) 2026 Jérémy Perret.
 * https://github.com/jeremy-prt/bloub @ b4bb3c1
 *
 * Ported from upstream: src/bot/math.ts whole (easings, loopNoise, mulberry32,
 * r2), src/bot/shape.ts (unionOfCirclesProfile, toPoints, closedPath,
 * capsulePath, radiusAtAngle), src/bot/face.ts (the sphere eye frame, the
 * pre-drawn blink schedule, liveliness, blinkScale), src/bot/engine.ts (the
 * clock-free sample(t), the dated setState and its frozen-departure pose).
 *
 * NOT ported, and not copyable: upstream's PROFILES arrays and its 14 states
 * are measurements of the x.ai bot. The Paw head, its ear rig and all 15
 * states here are ours, authored as circle sets rather than traced radii.
 */

/* ------------------------------------------------------------------ math */
/* Ported verbatim in behaviour from bloub src/bot/math.ts. */

const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const r2 = (v) => Math.round(v * 100) / 100;

const easeOutQuint = (t) => 1 - (1 - t) ** 5;

/** 1D periodic noise: loops seamlessly on `period`. Used for gaze drift. */
function loopNoise(t, period, seed = 0) {
  const p = (t / period) * TAU;
  return (
    0.55 * Math.sin(p + seed) +
    0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
    0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
  );
}

/** mulberry32: the same sequence on every read, so the blink calendar is fixed. */
function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ear settle: one damped overshoot, normalised so f(0) = 0 and f(1) = 1.
 *
 * Ours, and the one place the Paw disagrees with upstream on purpose. Bloub
 * measured its bot and found NO overshoot on the body -- correct for a
 * floating blob, wrong for something with ears. Ears have mass: they leave
 * late, swing past, and settle. Without this every state change moved the
 * head and the ears in the same instant, which is what made the character
 * read as rigid however good the silhouette was.
 *
 * Exactly 1 at the end matters: the engine drops back to the raw pose once
 * the morph window closes, so anything short of 1 would snap.
 */
const EAR_SETTLE_NORM = 1 / (1 - Math.exp(-5) * Math.cos(7));
const earSettle = (k) => (1 - Math.exp(-5 * k) * Math.cos(7 * k)) * EAR_SETTLE_NORM;

/** How far behind the head the ears start, as a fraction of the state's morph. */
const EAR_LAG = 0.25;

/* --------------------------------------------------------------- frame of
 * reference. RADIUS is the head radius in viewBox units and every number
 * below is a fraction of it. HALF_BOX is not free: a raised ear reaches
 * ~1.79 head radii and the glyphs sit outside the head too. Nothing bounds
 * either at runtime -- it is the hand-set ear swings in STATES that keep the
 * geometry inside, and tests/paw-avatar.test.js locks that down. */
const RADIUS = 100;
const HALF_BOX = 162;

/** Angular samples of the silhouette. A thin ear tip needs more than 64. */
const SAMPLES = 96;
const ANGLES = Array.from({ length: SAMPLES }, (_, i) => (i / SAMPLES) * TAU);
const COS = ANGLES.map(Math.cos);
const SIN = ANGLES.map(Math.sin);

/* ----------------------------------------------------------------- shape */

/**
 * Radial profile of a UNION of disks: r(theta) is the farthest ray/circle
 * intersection. Exact while the origin sits inside the union, which is what
 * lets a head and two ears be one closed outline with no path booleans.
 * Ported from bloub src/bot/shape.ts.
 */
function unionOfCirclesProfile(circles, out = new Array(SAMPLES)) {
  for (let i = 0; i < SAMPLES; i++) {
    const dx = COS[i];
    const dy = SIN[i];
    let best = 0;
    for (const c of circles) {
      const b = dx * c.x + dy * c.y;
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
      if (disc < 0) continue;
      const t = b + Math.sqrt(disc);
      if (t > best) best = t;
    }
    out[i] = best;
  }
  return out;
}

/**
 * Polygon -> radial profile, by casting a ray from `center` at every sample
 * angle and keeping the farthest edge hit. Ported from bloub
 * src/bot/shape.ts, where it exists for the shapes that do not fall out of
 * r(theta) naturally. Here it is how the authored art becomes morphable:
 * once a drawn silhouette is a profile, it squashes, tilts and interpolates
 * exactly like a generated one. Computed once at load, never per frame.
 */
function profileFromPolygon(poly, cx, cy) {
  const radii = new Array(SAMPLES).fill(0);
  const n = poly.length;
  for (let k = 0; k < SAMPLES; k++) {
    const dx = COS[k];
    const dy = SIN[k];
    let best = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const px = a.x - cx;
      const py = a.y - cy;
      const t = (px * ey - py * ex) / den; // distance along the ray
      const u = (px * dy - py * dx) / den; // position along the edge
      if (t > best && u >= 0 && u <= 1) best = t;
    }
    radii[k] = best;
  }
  return radii;
}

/**
 * An `M x y C ... Z` path to a polygon. Ours: upstream traced video frames
 * and had no path to read. Only absolute M/C/Z, which is what the art file
 * uses; anything else would need more parser than this effect can justify.
 */
function flattenPath(d, steps = 24) {
  const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [];
  let i = 0;
  let x = n[i++];
  let y = n[i++];
  pts.push({ x, y });
  while (i + 6 <= n.length) {
    const x1 = n[i++], y1 = n[i++], x2 = n[i++], y2 = n[i++], x3 = n[i++], y3 = n[i++];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const v = 1 - t;
      pts.push({
        x: v * v * v * x + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t * t * t * x3,
        y: v * v * v * y + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t * y3
      });
    }
    x = x3;
    y = y3;
  }
  return pts;
}

/** Profile -> screen points. `scale` = head radius in viewBox units. */
function toPoints(radii, pose, scale, out = []) {
  const cr = Math.cos(pose.rot);
  const sr = Math.sin(pose.rot);
  for (let i = 0; i < SAMPLES; i++) {
    const r = radii[i];
    const x = r * COS[i];
    const y = r * SIN[i];
    const rx = x * cr - y * sr;
    const ry = x * sr + y * cr;
    const p = out[i] ?? { x: 0, y: 0 };
    p.x = (rx * pose.sx + pose.cx) * scale;
    p.y = (ry * pose.sy + pose.cy) * scale;
    out[i] = p;
  }
  out.length = SAMPLES;
  return out;
}

/**
 * Closed polyline -> Catmull-Rom cubics. At this sample count centred
 * tangents are smooth to the pixel and the `d` string stays short.
 * Ported from bloub src/bot/shape.ts.
 */
function closedPath(pts, tension = 1 / 6) {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${r2(p1.x + (p2.x - p0.x) * tension)} ${r2(p1.y + (p2.y - p0.y) * tension)}`;
    d += ` ${r2(p2.x - (p3.x - p1.x) * tension)} ${r2(p2.y - (p3.y - p1.y) * tension)}`;
    d += ` ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return `${d}Z`;
}

/** Capsule (stadium) centred on the origin: the eye shape. Ported from bloub. */
function capsulePath(w, h) {
  const hw = Math.max(w, 0.01) / 2;
  const hh = Math.max(h, 0.01) / 2;
  const r = Math.min(hw, hh);
  return (
    `M${r2(-hw)} ${r2(-hh + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` +
    `L${r2(hw - r)} ${r2(-hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` +
    `L${r2(hw)} ${r2(hh - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` +
    `L${r2(-hw + r)} ${r2(hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`
  );
}

/* ------------------------------------------------------------- the Paw rig
 *
 * The character is drawn, not generated: art/paw-os-glass-puppy.svg holds
 * the three silhouettes and the glass that goes on them, and the `d`
 * strings below are that file verbatim. They are cast to radial profiles at
 * load, which is the whole point of the engine -- a drawn outline and a
 * generated one behave identically once both are r(theta), so the art
 * squashes, tilts, interpolates and tracks with no extra machinery.
 *
 * ART_* are in the art file's own 256 viewBox. Everything after is in head
 * half-widths, the unit the rest of this file speaks.
 */
const ART = {
  head:
    "M160 29 C119 28 84 46 68 78 C54 107 54 149 66 181 " +
    "C76 208 107 225 160 226 C213 225 244 208 254 181 " +
    "C266 149 266 107 252 78 C236 46 201 28 160 29Z",
  earL:
    "M76 74 C51 77 35 95 31 119 C27 141 35 161 51 168 " +
    "C67 175 83 160 88 138 C93 116 95 91 88 80 C85 75 81 73 76 74Z",
  earR:
    "M244 74 C269 77 285 95 289 119 C293 141 285 161 269 168 " +
    "C253 175 237 160 232 138 C227 116 225 91 232 80 C235 75 239 73 244 74Z",
  /** Head bbox centre and half-width, measured off the flattened head path. */
  cx: 160,
  cy: 127.48,
  unit: 102.764,
  /** Where each ear meets the skull in the drawing: the point it swings about. */
  pivotL: { x: 76, y: 74 },
  pivotR: { x: 244, y: 74 },
  /** Eye capsule from the drawing, and the little glass catch inside it. */
  eye: { cx: 117.5, cy: 116.5, w: 25, h: 51 },
  catch: { dx: -4.5, dy: -13.5, r: 2.4 }
};

/** Art coordinates -> head half-widths, origin at the head's centre. */
const toUnits = (px, py) => ({ x: (px - ART.cx) / ART.unit, y: (py - ART.cy) / ART.unit });
const pathInUnits = (d) => flattenPath(d).map((p) => toUnits(p.x, p.y));
const centreOf = (pts) => ({
  x: (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2,
  y: (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2
});

const HEAD_PROFILE = profileFromPolygon(pathInUnits(ART.head), 0, 0);

/**
 * An ear is sampled about its own bbox centre, not its pivot: the pivot sits
 * ON the drawn outline, where half the rays would leave at radius zero. The
 * offset between the two is carried in `earPose` instead.
 */
const EAR = ["l", "r"].reduce((acc, side) => {
  const pts = pathInUnits(side === "l" ? ART.earL : ART.earR);
  const pivot = toUnits(
    side === "l" ? ART.pivotL.x : ART.pivotR.x,
    side === "l" ? ART.pivotL.y : ART.pivotR.y
  );
  const origin = centreOf(pts);
  acc[side] = {
    profile: profileFromPolygon(pts, origin.x, origin.y),
    pivot,
    /** profile origin measured from the pivot, so a swing rotates about the pivot */
    arm: { x: origin.x - pivot.x, y: origin.y - pivot.y }
  };
  return acc;
}, {});

/** Scratch buffers: nothing is reallocated per frame. */
function makeBody() {
  return { head: [], earL: [], earR: [] };
}

/**
 * Screen placement of one ear. `side` is -1 left, +1 right; a negative
 * `angle` swings the lobe outward on both sides, `lift` raises the root, and
 * the head's own tilt carries the whole ear around with it.
 *
 * Two rotations compose: the ear swings about its pivot, then the head tilt
 * turns that result about the head's centre.
 */
function earPose(side, ear, headRot) {
  const e = side < 0 ? EAR.l : EAR.r;
  const a = ear.angle * side;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // profile origin after the swing, still in head space
  const ox = e.pivot.x + (e.arm.x * ca - e.arm.y * sa);
  const oy = e.pivot.y - ear.lift + (e.arm.x * sa + e.arm.y * ca);
  const ch = Math.cos(headRot);
  const sh = Math.sin(headRot);
  return {
    rot: headRot + a,
    sx: 1,
    sy: 1,
    cx: ox * ch - oy * sh,
    cy: ox * sh + oy * ch
  };
}

/* ------------------------------------------------------------------ face
 * Ported from bloub src/bot/face.ts. The eyes live on a sphere, not flat on
 * the page: each one takes the tangent frame of the head at its own angle,
 * projected orthographically, so turning the gaze compresses and tilts them
 * on its own. That is where the volume comes from. */

const deg = (d) => (d * Math.PI) / 180;

/** Half-separation of the eyes on the sphere, degrees. */
const EYE_SPLIT = 24.43;
/** Eye size at rest, in head half-widths. Measured off the art ellipse. */
const EYE_W = 0.2433;
const EYE_H = 0.4963;
/**
 * The drawing's glass catch, in the eye's own space: it rides the eye matrix,
 * so it stays put on a gaze that is tracking and squashes with a blink.
 */
const CATCH = {
  x: (ART.catch.dx / ART.unit) * RADIUS,
  y: (ART.catch.dy / ART.unit) * RADIUS,
  r: (ART.catch.r / ART.unit) * RADIUS
};

/** The Paw looks at you: unlike bloub's 3/4 bot, rest gaze is square on. */
const REST_GAZE = { yaw: 0, pitch: -2, roll: 0 };
/** The face sits high on the head. */
const FACE_Y = -0.1069;

/** Rotate two vectors of an orthonormal frame within their common plane. */
function spin(u, v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ];
}

/** Head frame then both eye frames. Screen axes: x right, y down, z at you. */
function eyePoses(gaze, split = EYE_SPLIT) {
  let f = [0, 0, 1];
  let right = [1, 0, 0];
  let down = [0, 1, 0];
  [f, right] = spin(f, right, deg(gaze.yaw));
  [down, f] = spin(down, f, deg(gaze.pitch));
  [right, down] = spin(right, down, deg(gaze.roll));
  const build = (side) => {
    const [ef, er] = spin(f, right, deg(split * side));
    return { x: ef[0], y: ef[1], a: er[0], b: er[1], c: down[0], d: down[1], depth: ef[2] };
  };
  return [build(-1), build(1)];
}

const BLINK_RNG = createRng(0x5eed);
/** Pre-drawn blink calendar: deterministic and stateless. Ported from bloub. */
const BLINKS = (() => {
  const out = [];
  let t = 1.4;
  while (t < 900) {
    out.push(t);
    t += 1.9 + BLINK_RNG() * 2.7;
    if (BLINK_RNG() < 0.18) {
      out.push(t);
      t += 0.24;
    }
  }
  return out;
})();

const BLINK_DUR = 0.18;

function blinkLid(t) {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i];
    if (t < start) break;
    const k = (t - start) / BLINK_DUR;
    if (k >= 0 && k <= 1) return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
  }
  return 1;
}

/** A blink is a vertical squash on screen, not a shrink along the capsule axis. */
const blinkScale = (lid) => 0.06 + 0.94 * clamp(lid);

/**
 * Life at rest: slow gaze drift, blinks, breathing. A pure function of time,
 * so pausing, scrubbing and re-reading a past date all give the same image.
 * Periods are mutually prime so the drift never visibly repeats.
 */
function liveliness(t, wander = 1, blink = true) {
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    driftX: loopNoise(t, 7.9, 1.9) * 0.008,
    driftY: loopNoise(t, 5.3, 0.3) * 0.009,
    breath: 1 + Math.sin((t / 3.4) * TAU) * 0.012
  };
}

/* ----------------------------------------------------------------- glyphs
 * The small marks around the head. Ours. A "!!" cannot be reached by
 * morphing a capsule and neither can a heart, so like bloub's decor these
 * cross in OPACITY, never in geometry. The three face glyphs replace the
 * eyes (eyeAlpha 0) rather than sitting beside them.
 *
 * Each also carries a MOTION: a loop of its own, authored once here rather
 * than per state, because drifting upward is a property of a "zzz" and not
 * of being asleep. A state still only says how much of the glyph is showing.
 * The motion reads absolute time, so a held state keeps moving, and it is
 * frozen at 0 for a resting frame so the baked snippet is stable.
 *
 * `at` is where the glyph sits; anything that scales or rotates is authored
 * around its own origin so it does not swing away from the head when it does.
 */

const zed = (x, y, s) => `M${x} ${y}h${s}l${-s} ${s}h${s}`;
/** Four-point star: the arms pinch at the centre, which is what reads as a spark. */
const spark4 = (s) =>
  `M0 ${-s}Q${s * 0.12} ${-s * 0.12} ${s} 0` +
  `Q${s * 0.12} ${s * 0.12} 0 ${s}` +
  `Q${-s * 0.12} ${s * 0.12} ${-s} 0` +
  `Q${-s * 0.12} ${-s * 0.12} 0 ${-s}z`;
const heart = (x, y, s) =>
  `M${x} ${y + s * 0.9}c${-s * 1.3} ${-s * 0.9} ${-s * 0.8} ${-s * 1.9} 0 ${-s * 1.1}` +
  `c${s * 0.8} ${-s * 0.8} ${s * 1.3} ${s * 0.2} 0 ${s * 1.1}z`;

/** A loop that fades in and out once per cycle, starting part-way in so a
 *  frozen frame shows something rather than the invisible moment at u = 0. */
const cycle = (t, rate) => (t * rate + 0.25) % 1;
const arch = (u) => Math.sin(u * Math.PI);
/** Twinkle: never fully out, never twice at the same moment. */
const twinkle = (t, rate, phase) => 0.5 + 0.5 * Math.sin(t * rate + phase);

const GLYPHS = {
  spark: {
    at: [94, -118],
    html: `<path d="M-16 14L-2 -4M10 22L30 14M-30 -2L-24 -24"/>`,
    stroke: true,
    motion: (t) => ({ s: 1 + 0.16 * Math.sin(t * 7) })
  },
  think: {
    at: [123, -123],
    html: `<circle cx="-11" cy="11" r="9"/><circle cx="11" cy="-11" r="6"/>`,
    motion: (t) => ({ dy: -4 * Math.sin(t * 1.2) })
  },
  zzz: {
    at: [0, 0],
    html: `<path d="${zed(96, -120, 16)}${zed(120, -140, 12)}${zed(138, -154, 9)}"/>`,
    stroke: true,
    motion: (t) => {
      const u = cycle(t, 0.3);
      return { dy: -30 * u, o: arch(u) };
    }
  },
  question: {
    at: [105, -114],
    html: `<path d="M-9 -18a15 15 0 1 1 15 15v9"/><circle cx="6" cy="18" r="5"/>`,
    stroke: true,
    motion: (t) => ({ r: Math.sin(t * 2.2) * 7 })
  },
  hearts: {
    at: [0, 0],
    html: `<path class="fx-paw-warm" d="${heart(-16, -122, 13)}${heart(30, -140, 9)}"/>`,
    motion: (t) => {
      const u = cycle(t, 0.35);
      return { dx: 6 * Math.sin(u * TAU), dy: -26 * u, o: arch(u) };
    }
  },
  waves: {
    at: [100, -40],
    html: `<path d="M4 -56a26 26 0 0 1 20 -24M12 -34a44 44 0 0 1 34 -40M20 -12a62 62 0 0 1 48 -56"/>`,
    stroke: true,
    motion: (t) => {
      const u = cycle(t, 0.9);
      return { s: 0.86 + 0.28 * u, o: arch(u) };
    }
  },
  speed: {
    at: [0, 0],
    html: `<path d="M-118 -30h-42M-126 -6h-54M-118 18h-38"/>`,
    stroke: true,
    motion: (t) => {
      const u = cycle(t, 1.6);
      return { dx: -26 * u, o: arch(u) };
    }
  },
  // Three separate sparks rather than one group: staggered phases are what
  // make it read as twinkling instead of pulsing.
  sparkA: {
    at: [104, -108],
    html: `<path d="${spark4(20)}"/>`,
    motion: (t) => {
      const k = twinkle(t, 2.1, 0);
      return { s: 0.6 + 0.55 * k, r: 12 * k, o: 0.45 + 0.55 * k };
    }
  },
  sparkB: {
    at: [140, -76],
    html: `<path d="${spark4(12)}"/>`,
    motion: (t) => {
      const k = twinkle(t, 2.7, 2.1);
      return { s: 0.5 + 0.6 * k, r: -16 * k, o: 0.35 + 0.65 * k };
    }
  },
  sparkC: {
    at: [76, -134],
    html: `<path d="${spark4(9)}"/>`,
    motion: (t) => {
      const k = twinkle(t, 3.4, 4.3);
      return { s: 0.45 + 0.7 * k, r: 20 * k, o: 0.3 + 0.7 * k };
    }
  },
  faceHappy: {
    at: [0, 0],
    html: `<path d="M-51 0q18 -22 36 0M15 0q18 -22 36 0"/>`,
    stroke: true
  },
  faceX: {
    at: [0, 0],
    html: `<path d="M-42 -16l16 16l-16 16M42 -16l-16 16l16 16"/>`,
    stroke: true
  },
  faceLove: {
    at: [0, 0],
    html: `<path class="fx-paw-warm" d="${heart(-33, -10, 15)}${heart(33, -10, 15)}"/>`
  }
};

const GLYPH_IDS = Object.keys(GLYPHS);

/** Where a glyph sits this frame, as one transform. */
function glyphTransform(id, t) {
  const g = GLYPHS[id];
  const m = g.motion ? g.motion(t) : {};
  const x = r2(g.at[0] + (m.dx ?? 0));
  const y = r2(g.at[1] + (m.dy ?? 0));
  const rot = m.r ? ` rotate(${r2(m.r)})` : "";
  const sc = m.s != null ? ` scale(${r2(m.s)})` : "";
  return `translate(${x} ${y})${rot}${sc}`;
}

/* ------------------------------------------------------------------ poses */

const ear = (angle = 0, lift = 0) => ({ angle, lift });
const eye = (w = EYE_W, h = EYE_H, open = 1, tilt = 0) => ({ w, h, open, tilt });

function basePose(over = {}) {
  return {
    rot: 0,
    sx: 1,
    sy: 1,
    cx: 0,
    cy: 0,
    ears: { l: ear(), r: ear() },
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: [eye(), eye()],
    eyeAlpha: 1,
    wander: 1,
    /** bloom strength 0..1; states pulse it, sample() adds a slow breath */
    glow: 0.5,
    /** how much of the rim is spectrum rather than the art's own 0..1 */
    rainbow: 0,
    glyphs: {},
    ...over
  };
}

const lerpEar = (a, b, t) => ({ angle: lerp(a.angle, b.angle, t), lift: lerp(a.lift, b.lift, t) });
const lerpEye = (a, b, t) => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  open: lerp(a.open, b.open, t),
  tilt: lerp(a.tilt, b.tilt, t)
});

/**
 * Interpolate two poses. Everything on the rig is a number and lerps; the
 * glyphs cross in opacity, so a glyph present on one side only fades
 * against nothing rather than morphing into the wrong mark.
 */
function blendPose(a, b, t) {
  const glyphs = {};
  for (const k in a.glyphs) glyphs[k] = a.glyphs[k] * (1 - t);
  for (const k in b.glyphs) glyphs[k] = (glyphs[k] ?? 0) + b.glyphs[k] * t;
  return {
    rot: lerp(a.rot, b.rot, t),
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    ears: { l: lerpEar(a.ears.l, b.ears.l, t), r: lerpEar(a.ears.r, b.ears.r, t) },
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
    wander: lerp(a.wander, b.wander, t),
    glow: lerp(a.glow, b.glow, t),
    rainbow: lerp(a.rainbow, b.rainbow, t),
    glyphs
  };
}

/* ------------------------------------------------------------ the 16 states
 * Each is a function of `t`, the seconds elapsed IN that state, so a state
 * can animate on its own (the working shake, the excited bounce) while the
 * engine separately crossfades it against whatever it replaced. */

const STATES = {
  idle: { morph: 0.45, pose: () => basePose() },

  happy: {
    morph: 0.35,
    blinkIn: true,
    pose: () => basePose({
      ears: { l: ear(-0.10), r: ear(-0.10) },
      sy: 0.98,
      eyeAlpha: 0,
      glyphs: { faceHappy: 1 }
    })
  },

  excited: {
    morph: 0.3,
    pose: (t) => {
      const b = Math.sin(t * 9) * 0.035 * Math.exp(-t * 0.35);
      return basePose({
        cy: -Math.abs(b) * 1.4,
        sy: 1 + b,
        sx: 1 - b * 0.6,
        ears: { l: ear(-0.30, 0.04), r: ear(-0.34, 0.05) },
        eyes: [eye(EYE_W * 1.1, EYE_H * 1.05), eye(EYE_W * 1.1, EYE_H * 1.05)],
        glow: 0.75 + Math.sin(t * 6) * 0.22,
        glyphs: { spark: 1 }
      });
    }
  },

  curious: {
    morph: 0.5,
    pose: () => basePose({
      rot: -0.13,
      gaze: { yaw: 9, pitch: 4, roll: -4 },
      ears: { l: ear(-0.42, 0.05), r: ear(0.10) },
      eyes: [eye(EYE_W * 1.05, EYE_H), eye(EYE_W * 0.95, EYE_H * 0.95)]
    })
  },

  thinking: {
    morph: 0.5,
    pose: (t) => basePose({
      rot: 0.06,
      gaze: { yaw: -16 + Math.sin(t * 0.9) * 3, pitch: 13, roll: 3 },
      wander: 0.35,
      ears: { l: ear(0.10), r: ear(-0.14, 0.03) },
      eyes: [eye(EYE_W, EYE_H * 0.9), eye(EYE_W, EYE_H * 0.9)],
      glyphs: { think: 1 }
    })
  },

  working: {
    morph: 0.3,
    pose: (t) => basePose({
      cx: Math.sin(t * 16) * 0.012,
      ears: { l: ear(0.26), r: ear(0.22) },
      wander: 0.2,
      // narrowed and mirrored: the tilt is what reads as effort rather than anger
      eyes: [eye(EYE_W * 0.9, EYE_H * 0.62, 1, 13), eye(EYE_W * 0.9, EYE_H * 0.62, 1, -13)],
      glow: 0.55 + Math.sin(t * 4) * 0.1,
      glyphs: { speed: 1 }
    })
  },

  focused: {
    morph: 0.4,
    pose: () => basePose({
      wander: 0.15,
      ears: { l: ear(0.06), r: ear(0.06) },
      eyes: [eye(EYE_W * 0.92, EYE_H * 0.58, 1, 11), eye(EYE_W * 0.92, EYE_H * 0.58, 1, -11)]
    })
  },

  surprised: {
    morph: 0.18,
    blinkIn: true,
    pose: (t) => basePose({
      sy: 1 + 0.03 * Math.exp(-t * 4),
      ears: { l: ear(-0.38, 0.05), r: ear(-0.35, 0.05) },
      split: EYE_SPLIT * 1.05,
      eyes: [eye(EYE_W * 1.25, EYE_H * 0.72), eye(EYE_W * 1.25, EYE_H * 0.72)],
      glow: 0.5 + 0.5 * Math.exp(-t * 2),
      glyphs: { spark: 1 }
    })
  },

  sleeping: {
    morph: 0.7,
    pose: (t) => basePose({
      cy: 0.02 + Math.sin(t * 0.8) * 0.012,
      sy: 1 + Math.sin(t * 0.8) * 0.02,
      ears: { l: ear(0.30), r: ear(0.30) },
      gaze: { yaw: 0, pitch: -8, roll: 0 },
      wander: 0,
      glow: 0.18,
      eyes: [eye(EYE_W, EYE_H * 0.5, 0.04), eye(EYE_W, EYE_H * 0.5, 0.04)],
      glyphs: { zzz: 1 }
    })
  },

  wink: {
    morph: 0.2,
    pose: () => basePose({
      rot: 0.05,
      ears: { l: ear(-0.12), r: ear(-0.28, 0.04) },
      eyes: [eye(EYE_W, EYE_H), eye(EYE_W * 1.15, EYE_H * 0.45, 0.02)],
      glyphs: { spark: 0.7 }
    })
  },

  confused: {
    morph: 0.45,
    pose: () => basePose({
      rot: 0.12,
      gaze: { yaw: 6, pitch: -4, roll: 7 },
      ears: { l: ear(0.34), r: ear(-0.32, 0.04) },
      eyes: [eye(EYE_W * 1.1, EYE_H * 0.95), eye(EYE_W * 0.8, EYE_H * 0.7)],
      glyphs: { question: 1 }
    })
  },

  sad: {
    morph: 0.55,
    pose: () => basePose({
      cy: 0.035,
      sy: 0.965,
      gaze: { yaw: 0, pitch: -13, roll: 0 },
      wander: 0.4,
      glow: 0.3,
      ears: { l: ear(0.5, -0.06), r: ear(0.5, -0.06) },
      eyes: [eye(EYE_W * 0.85, EYE_H * 0.52, 1, -9), eye(EYE_W * 0.85, EYE_H * 0.52, 1, 9)]
    })
  },

  love: {
    morph: 0.4,
    blinkIn: true,
    pose: (t) => basePose({
      cy: Math.sin(t * 2.4) * 0.012,
      ears: { l: ear(-0.18), r: ear(-0.18) },
      eyeAlpha: 0,
      glow: 0.7 + Math.sin(t * 2.4) * 0.2,
      glyphs: { faceLove: 1, hearts: 1 }
    })
  },

  celebrating: {
    morph: 0.28,
    pose: (t) => {
      const b = Math.sin(t * 7) * 0.03 * Math.exp(-t * 0.5);
      return basePose({
        cy: -Math.abs(b) * 1.6,
        sy: 1 + b,
        ears: { l: ear(-0.42, 0.05), r: ear(-0.38, 0.05) },
        eyeAlpha: 0,
        glow: 0.8 + Math.sin(t * 7) * 0.2,
        glyphs: { faceX: 1, spark: 1 }
      });
    }
  },

  /**
   * The one state with a spectrum rim. The hue travels because the engine
   * hands the renderer an angle, not because CSS keyframes run: a second
   * clock would break pause, scrub and the resting frame the snippet bakes.
   */
  creative: {
    morph: 0.55,
    pose: (t) => {
      // An idea landing, every few seconds: a fast rise and a slow fall, not
      // a sine. A constant shimmer reads as decoration; a beat reads as
      // something happening.
      const p = t % 4.2;
      const beat = p < 0.12 ? p / 0.12 : Math.exp(-(p - 0.12) * 3.2);
      const w = 1.06 + beat * 0.1;
      return basePose({
        rot: Math.sin(t * 0.7) * 0.04,
        cy: Math.sin(t * 1.1) * 0.014 - beat * 0.02,
        ears: { l: ear(-0.26 - beat * 0.12, 0.04), r: ear(-0.34 - beat * 0.14, 0.05) },
        gaze: { yaw: Math.sin(t * 0.5) * 9, pitch: 6, roll: 0 },
        wander: 0.5,
        eyes: [eye(EYE_W * w, EYE_H * w), eye(EYE_W * w, EYE_H * w)],
        glow: 0.68 + Math.sin(t * 1.6) * 0.14 + beat * 0.28,
        rainbow: 1,
        glyphs: { sparkA: 1, sparkB: 1, sparkC: 1 }
      });
    }
  },

  listening: {
    morph: 0.4,
    pose: (t) => basePose({
      rot: -0.05,
      ears: { l: ear(-0.2), r: ear(-0.45 + Math.sin(t * 2.2) * 0.05, 0.05) },
      gaze: { yaw: 7, pitch: 2, roll: -2 },
      eyes: [eye(EYE_W, EYE_H * 1.02), eye(EYE_W, EYE_H * 1.02)],
      glow: 0.6 + Math.sin(t * 2.2) * 0.15,
      glyphs: { waves: 1 }
    })
  }
};

export const STATE_IDS = Object.keys(STATES);

/* ------------------------------------------------------------------- look
 * Where the Paw looks when something outside drives it: the pointer.
 * Ported from bloub src/bot/engine.ts, minus its `spin`.
 *
 * `yaw` and `pitch` are ABSOLUTE directions that REPLACE the pose's as `mix`
 * rises, and the ENGINE does that blend, not the caller: only the engine
 * knows the pose at this instant, so a caller compensating for it would read
 * the arriving value while the morph is still running and the eyes would
 * jump on every mood change. Absolute on both axes for the same reason --
 * relative, the eye height would follow each state's own gaze and drop the
 * moment the state changed. What carries an expression during tracking is
 * the SHAPE of its eyes, not where it looks; the pointer decides that.
 *
 * `wander` is separate from `mix`. When the pointer moves the idle drift has
 * to die down, or the Paw looks like it is hunting the cursor without ever
 * holding it. Left as one value, the gaze froze the moment tracking started.
 */
const NO_LOOK = { yaw: 0, pitch: 0, mix: 0, wander: 1 };

const lerpLook = (a, b, t) => ({
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  mix: lerp(a.mix, b.mix, t),
  wander: lerp(a.wander, b.wander, t)
});

/* ----------------------------------------------------------------- engine
 * Ported from bloub src/bot/engine.ts. Two things matter here and both are
 * upstream's: sample(now) is a pure function of time, so pause, scrub and
 * re-reading a past date give byte-identical output; and setState is a DATED
 * setter that, when a change lands mid-fade, freezes the composite pose
 * currently on screen and fades from THAT. Without the freeze, the one slot
 * of history means a second change snaps back to the full previous pose.
 */
export class PawEngine {
  /**
   * Catch-up time for the gaze, seconds. Shorter than a state morph: a gaze
   * that follows should look attentive, not viscous. Because the target is
   * reset on every pointer move, this is also what gives tracking its
   * inertia -- the gaze never quite reaches a cursor that keeps moving.
   */
  static LOOK_MORPH = 0.24;

  constructor(initial = "idle") {
    this.cur = STATES[initial] ? initial : "idle";
    this.prev = null;
    this.frozen = null;
    this.tCur = 0;
    this.tPrev = 0;
    this.blinkAt = -10;
    this.look = NO_LOOK;
    this.lookPrev = NO_LOOK;
    this.lookAt = -10;
    this.lookMorph = PawEngine.LOOK_MORPH;
    this.body = makeBody();
  }

  get state() {
    return this.cur;
  }

  /** Composite pose at `now`, fade included. Extracted so setState can freeze it. */
  composed(now) {
    const def = STATES[this.cur];
    const pose = def.pose(Math.max(0, now - this.tCur));
    const since = now - this.tCur;
    // The ears finish after the head, so the window they share is longer.
    if (since >= def.morph * (1 + EAR_LAG)) return pose;
    const origin = this.frozen ?? (this.prev
      ? STATES[this.prev].pose(Math.max(0, now - this.tPrev))
      : null);
    if (!origin) return pose;
    // Ease-out, and the ratio is CLAMPED: reading a date before the change
    // would give a negative ratio that the ease extrapolates far past the pose.
    const out = blendPose(origin, pose, easeOutQuint(clamp(since / def.morph)));
    const ke = clamp((since - def.morph * EAR_LAG) / def.morph);
    const te = earSettle(ke);
    out.ears = {
      l: lerpEar(origin.ears.l, pose.ears.l, te),
      r: lerpEar(origin.ears.r, pose.ears.r, te)
    };
    return out;
  }

  /**
   * New look target, `null` to fall back to the state's own gaze.
   *
   * It departs from the CURRENT look, not from the previous target the way a
   * state change does: this is called on every pointer move, and departing
   * from the old target would rewind the gaze a notch before each catch-up,
   * so the tracking would shiver instead of gliding.
   *
   * A non-finite target is refused and the last one kept. One NaN, from a
   * getBoundingClientRect on a zero-sized box, would otherwise propagate to
   * every later frame and the Paw would never come to rest again.
   */
  setLook(look, now, morph = PawEngine.LOOK_MORPH) {
    if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.wander)) return;
    this.lookPrev = this.lookAtTime(now);
    this.look = look ?? NO_LOOK;
    this.lookAt = now;
    this.lookMorph = morph;
  }

  /** Look in force at `now`, catch-up included. */
  lookAtTime(now) {
    const k = (now - this.lookAt) / this.lookMorph;
    if (k >= 1) return this.look;
    return lerpLook(this.lookPrev, this.look, easeOutQuint(clamp(k)));
  }

  setState(id, now) {
    if (!STATES[id] || id === this.cur) return;
    const midFade = this.prev !== null && now - this.tCur < STATES[this.cur].morph;
    this.frozen = midFade ? this.composed(now) : null;
    this.prev = this.cur;
    this.tPrev = this.tCur;
    this.cur = id;
    this.tCur = now;
    if (STATES[id].blinkIn) this.blinkAt = now;
  }

  /** Restart on `id` with no history, as if the engine were new. */
  reset(id, now) {
    this.cur = STATES[id] ? id : "idle";
    this.prev = null;
    this.frozen = null;
    this.tCur = now;
    this.tPrev = now;
    this.blinkAt = -10;
    this.look = NO_LOOK;
    this.lookPrev = NO_LOOK;
    this.lookAt = -10;
  }

  sample(now, alive = true) {
    const pose = this.composed(now);
    const faceOn = pose.eyeAlpha > 0.01;
    const look = this.lookAtTime(now);
    const life = alive
      ? liveliness(now, pose.wander * look.wander, faceOn)
      : { dYaw: 0, dPitch: 0, dRoll: 0, lid: 1, driftX: 0, driftY: 0, breath: 1 };

    // The two aims REPLACE the pose's as `mix` rises; the drift is added
    // AFTER, so a head held toward the pointer still lives.
    const gaze = {
      yaw: lerp(pose.gaze.yaw, look.yaw, look.mix) + life.dYaw,
      pitch: lerp(pose.gaze.pitch, look.pitch, look.mix) + life.dPitch,
      // Roll follows nothing: it is the state's own head tilt.
      roll: pose.gaze.roll + life.dRoll
    };

    // A state change blinks, on top of the calendar: upstream's trick for
    // hiding the instant a silhouette swaps.
    const forced = clamp((now - this.blinkAt) / 0.2);
    const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1;
    const lid = Math.min(life.lid, forcedLid);

    const cx = pose.cx + life.driftX;
    const cy = pose.cy + life.driftY;

    const head = { rot: pose.rot, sx: pose.sx, sy: pose.sy * life.breath, cx, cy };
    const bodyPath = closedPath(toPoints(HEAD_PROFILE, head, RADIUS, this.body.head));
    const shift = (p) => ({ ...p, cx: p.cx + cx, cy: p.cy + cy });
    const earLPath = closedPath(
      toPoints(EAR.l.profile, shift(earPose(-1, pose.ears.l, pose.rot)), RADIUS, this.body.earL)
    );
    const earRPath = closedPath(
      toPoints(EAR.r.profile, shift(earPose(1, pose.ears.r, pose.rot)), RADIUS, this.body.earR)
    );

    const eyes = [];
    if (faceOn) {
      const poses = eyePoses(gaze, pose.split);
      for (let i = 0; i < 2; i++) {
        const e = poses[i];
        if (e.depth <= 0.02) continue;
        const cfg = pose.eyes[i];
        // The eye's own tilt composes with the sphere's tangent frame, which
        // is what allows the two eyes to lean in mirror.
        const phi = deg(cfg.tilt);
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const ax = e.a * cp + e.c * sp;
        const ay = e.b * cp + e.d * sp;
        const bx = -e.a * sp + e.c * cp;
        const by = -e.b * sp + e.d * cp;
        // The blink is applied LAST: a vertical squash on screen, not along
        // the capsule's tilted axis.
        const k = blinkScale(Math.min(lid, cfg.open));
        eyes.push({
          d: capsulePath(cfg.w * RADIUS, cfg.h * RADIUS),
          matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(bx)},${r2(by * k)},` +
            `${r2((e.x + cx) * RADIUS)},${r2((e.y + cy + FACE_Y) * RADIUS)})`,
          alpha: pose.eyeAlpha * clamp(e.depth / 0.12)
        });
      }
    }

    return {
      glow: clamp(pose.glow + (alive ? Math.sin((now / 3.4) * TAU) * 0.08 : 0)),
      rainbow: clamp(pose.rainbow),
      /** Degrees. One turn every 9 s, and a function of `now` like everything else. */
      spectrum: alive ? ((now * 40) % 360) : 0,
      bodyPath,
      earLPath,
      earRPath,
      eyes,
      glyphs: glyphFrame(pose.glyphs, alive ? now : 0),
      // The face glyphs ride the body drift; the outer marks stay put.
      faceShift: `translate(${r2(cx * RADIUS)} ${r2((cy + FACE_Y) * RADIUS)})`
    };
  }
}

/**
 * The glyphs this frame: how much of each is showing, and where it is.
 * A glyph the pose never mentions is left out rather than emitted at zero.
 */
function glyphFrame(amounts, t) {
  const out = {};
  for (const id in amounts) {
    const a = amounts[id];
    if (a <= 0.001) continue;
    const m = GLYPHS[id].motion ? GLYPHS[id].motion(t) : {};
    out[id] = { o: clamp(a * (m.o ?? 1)), m: glyphTransform(id, t) };
  }
  return out;
}

/** The resting frame, for baking a CSS-only snippet or a static export. */
export const restingPath = (state = "idle") => new PawEngine(state).sample(0, false).bodyPath;

/* -------------------------------------------------------------------- DOM */

let uid = 0;

/**
 * The SVG skeleton. With a `frame` it bakes that frame's geometry into the
 * markup, which is how snippet.html looks finished before any JS runs --
 * possible only because sample() is deterministic.
 *
 * The defs, the sheen, the glints and the ground glow are the art file's,
 * kept in its own 256-viewBox coordinates and mapped into this one by ART_M
 * on a gradientTransform or a wrapping <g>. Keeping the authored numbers
 * rather than converting them means the drawing stays the reference: edit
 * the SVG, paste the new numbers back, done.
 */
const ART_M = `scale(${r2(RADIUS / ART.unit)}) translate(${-ART.cx} ${-ART.cy})`;

function template(id, frame) {
  const at = (i, k, dflt) => (frame ? (frame.eyes[i] ? frame.eyes[i][k] : dflt) : dflt);
  const glyph = (k) => {
    const g = GLYPHS[k];
    const f = frame ? frame.glyphs[k] : null;
    return `<g class="fx-paw-glyph${g.stroke ? " fx-paw-stroke" : ""}" data-g="${k}"` +
      ` opacity="${f ? r2(f.o) : 0}" transform="${f ? f.m : glyphTransform(k, 0)}">${g.html}</g>`;
  };
  const marks = GLYPH_IDS.filter((k) => !k.startsWith("face")).map(glyph).join("");
  const faces = GLYPH_IDS.filter((k) => k.startsWith("face")).map(glyph).join("");
  const d = frame ? frame.bodyPath : "";
  const eL = frame ? frame.earLPath : "";
  const eR = frame ? frame.earRPath : "";
  const shift = frame ? frame.faceShift : "";
  const eye = (i) =>
    `<g class="fx-paw-eye" transform="${at(i, "matrix", "")}" opacity="${at(i, "alpha", 0)}">` +
    `<path d="${at(i, "d", "")}"/>` +
    `<circle class="fx-paw-catch" cx="${r2(CATCH.x)}" cy="${r2(CATCH.y)}" r="${r2(CATCH.r)}"/></g>`;

  // One glass part = the drawn fill, then the drawn rim on top. The body
  // additionally clips the art's own sheen and glints to its outline, so
  // they never spill when a state squashes or tilts it.
  const part = (key, dd, extra = "") => `
  <g class="fx-paw-part">
    <clipPath id="fx-paw-clip-${key}-${id}"><path data-part="${key}" d="${dd}"/></clipPath>
    <path class="fx-paw-fill" data-part="${key}" d="${dd}" fill="url(#fx-paw-glass-${id})"/>${extra ? `
    <g clip-path="url(#fx-paw-clip-${key}-${id})">${extra}</g>` : ""}
    <path class="fx-paw-rim" data-part="${key}" d="${dd}" fill="none" stroke="url(#fx-paw-rim-${id})"/>
    <path class="fx-paw-rim fx-paw-rim-spectrum" data-part="${key}" d="${dd}" fill="none" stroke="url(#fx-paw-spectrum-${id})"/>
  </g>`;

  const sheen = `
      <g transform="${ART_M}">
        <path class="fx-paw-sheen" d="M92 63 C111 41 135 34 160 35 C183 36 204 43 220 56 C202 54 181 55 159 60 C134 66 112 74 87 88 C87 78 89 69 92 63Z" fill="url(#fx-paw-sheen-${id})"/>
        <path class="fx-paw-glint" d="M63 96 C69 72 83 56 103 47" stroke="var(--fx-paw-glint, #FFFFFF)" stroke-width="3.8" opacity="0.33"/>
        <path class="fx-paw-glint" d="M255 96 C249 72 237 57 219 48" stroke="var(--fx-paw-glint, #FFFFFF)" stroke-width="3.4" opacity="0.21"/>
      </g>`;

  return `<div class="fx-paw"><svg class="fx-paw-svg" viewBox="${-HALF_BOX} ${-HALF_BOX} ${HALF_BOX * 2} ${HALF_BOX * 2}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="fx-paw-glass-${id}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="${ART_M} translate(140 65) rotate(90) scale(205 205)">
      <stop offset="0" stop-color="var(--fx-paw-glass-0, #152033)" stop-opacity="0.92"/>
      <stop offset="0.52" stop-color="var(--fx-paw-glass-1, #0A0E17)" stop-opacity="0.98"/>
      <stop offset="1" stop-color="var(--fx-paw-glass-2, #02040A)"/>
    </radialGradient>
    <linearGradient id="fx-paw-rim-${id}" x1="52" y1="30" x2="270" y2="235" gradientUnits="userSpaceOnUse" gradientTransform="${ART_M}">
      <stop offset="0" stop-color="var(--fx-paw-rim-a, #F8FCFF)"/>
      <stop offset="0.28" stop-color="var(--fx-paw-rim-b, #D6E7FF)"/>
      <stop offset="0.62" stop-color="var(--fx-paw-rim-c, #8CAFFF)"/>
      <stop offset="0.84" stop-color="var(--fx-paw-rim-d, #A98CFF)"/>
      <stop offset="1" stop-color="var(--fx-paw-rim-e, #83A2FF)"/>
    </linearGradient>
    <linearGradient id="fx-paw-sheen-${id}" x1="73" y1="40" x2="180" y2="132" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="0.30" stop-color="#DCEAFF" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="fx-paw-floor-${id}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="${ART_M} translate(160 224) rotate(90) scale(34 118)">
      <stop offset="0" stop-color="var(--fx-paw-floor-a, #AFC4FF)" stop-opacity="0.36"/>
      <stop offset="0.40" stop-color="var(--fx-paw-floor-b, #7E9FFF)" stop-opacity="0.20"/>
      <stop offset="0.72" stop-color="var(--fx-paw-floor-c, #7D62FF)" stop-opacity="0.10"/>
      <stop offset="1" stop-color="var(--fx-paw-floor-c, #7D62FF)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fx-paw-spectrum-${id}" class="fx-paw-spectrum-def" x1="-110" y1="0" x2="110" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff5d7a"/>
      <stop offset="0.17" stop-color="#ffb03a"/>
      <stop offset="0.34" stop-color="#8bff7a"/>
      <stop offset="0.5" stop-color="#48e5ff"/>
      <stop offset="0.67" stop-color="#7f8cff"/>
      <stop offset="0.84" stop-color="#e070ff"/>
      <stop offset="1" stop-color="#ff5d7a"/>
    </linearGradient>
    <filter id="fx-paw-blur-${id}" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="fx-paw-soft-${id}" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>
  <g class="fx-paw-ground" transform="${ART_M}">
    <ellipse cx="160" cy="218" rx="104" ry="34" fill="var(--fx-paw-halo, #6D8DFF)" opacity="0.16" filter="url(#fx-paw-blur-${id})"/>
    <ellipse cx="160" cy="226" rx="92" ry="17" fill="url(#fx-paw-floor-${id})" filter="url(#fx-paw-soft-${id})"/>
    <ellipse cx="160" cy="226" rx="69" ry="7" fill="var(--fx-paw-floor-a, #B7CAFF)" opacity="0.22" filter="url(#fx-paw-soft-${id})"/>
  </g>
  ${part("earL", eL)}
  ${part("earR", eR)}
  ${part("body", d, sheen)}
  <g class="fx-paw-face" transform="${shift}">
    ${eye(0)}
    ${eye(1)}
    ${faces}
  </g>
  <g class="fx-paw-marks">${marks}</g>
</svg></div>`;
}

/**
 * Render one avatar into `el`.
 *
 * opts.state   one of STATE_IDS (default "idle")
 * opts.speed   time multiplier, 0.1-10
 * opts.cycle   seconds per state when walking every state; 0 = hold one state
 */
export function mount(el, opts = {}) {
  // A site generator loops querySelectorAll and mounts what it finds; one
  // throw here takes the rest of the page's effects with it.
  if (!el) return { update() {}, destroy() {} };
  // The host mounts from snippet.html with no options, so the data-* on the
  // element is the only configuration channel a generated site has.
  const ds = el.dataset ?? {};
  const o = {
    state: ds.fxState ?? "idle",
    speed: ds.fxSpeed ?? 1,
    track: ds.fxTrack !== "false",
    // An explicit state wins over the showcase carousel: a site that asks for
    // "thinking" means it, and the snippet ships with both attributes.
    cycle: ds.fxState ? 0 : ds.fxCycle ?? 0,
    ...opts
  };
  const still = typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The wrapper carries the sizing, so mount() works on any host element --
  // the snippet's section, or a bare <span> in a chat bubble.
  const restore = el.innerHTML;
  el.innerHTML = template(++uid);

  const svg = el.querySelector(".fx-paw-svg");
  const wrap = svg.parentElement;
  const parts = {
    body: svg.querySelectorAll('[data-part="body"]'),
    earL: svg.querySelectorAll('[data-part="earL"]'),
    earR: svg.querySelectorAll('[data-part="earR"]')
  };
  const eyeEls = svg.querySelectorAll(".fx-paw-eye");
  const glyphEls = {};
  for (const g of svg.querySelectorAll(".fx-paw-glyph")) glyphEls[g.dataset.g] = g;
  const face = svg.querySelector(".fx-paw-face");
  const spectrum = svg.querySelector(".fx-paw-spectrum-def");

  const engine = new PawEngine(o.state);
  let raf = 0;
  // Seeded here, not on the first frame: update() can be called before rAF has
  // run, and a t0 of 0 would date that change hundreds of seconds in the
  // future, leaving the avatar stuck on its initial state until wall clock
  // caught up. rAF timestamps share performance.now()'s origin.
  let t0 = typeof performance === "object" ? performance.now() : 0;
  let cycleAt = 0;
  let cycleAt0 = 0;
  /* Last sampled time, so a pointer move dates its look without reading a
   * second clock. A frame old at most, which is below the catch-up time. */
  let clock = 0;

  const speed = () => clamp(Number(o.speed) || 1, 0.1, 10);

  function draw(now) {
    const f = engine.sample(now, !still);
    wrap.style.setProperty("--fx-paw-pulse", r2(f.glow));
    wrap.style.setProperty("--fx-paw-rainbow", r2(f.rainbow));
    // Rotating the gradient rather than recolouring the stops: the travel is
    // one attribute, and the stops loop so the seam never shows.
    if (f.rainbow > 0.01) spectrum.setAttribute("gradientTransform", `rotate(${r2(f.spectrum)})`);
    for (const p of parts.body) p.setAttribute("d", f.bodyPath);
    for (const p of parts.earL) p.setAttribute("d", f.earLPath);
    for (const p of parts.earR) p.setAttribute("d", f.earRPath);
    face.setAttribute("transform", f.faceShift);
    for (let i = 0; i < eyeEls.length; i++) {
      const e = f.eyes[i];
      if (!e) {
        eyeEls[i].setAttribute("opacity", "0");
        continue;
      }
      eyeEls[i].firstChild.setAttribute("d", e.d);
      eyeEls[i].setAttribute("transform", e.matrix);
      eyeEls[i].setAttribute("opacity", r2(e.alpha));
    }
    for (const k in glyphEls) {
      const g = f.glyphs[k];
      glyphEls[k].setAttribute("opacity", g ? r2(g.o) : 0);
      if (g) glyphEls[k].setAttribute("transform", g.m);
    }
  }

  function frame(ts) {
    const now = ((ts - t0) / 1000) * speed();
    clock = now;
    const every = Number(o.cycle) || 0;
    if (every > 0 && now - cycleAt0 >= every) {
      cycleAt0 = now;
      cycleAt = (cycleAt + 1) % STATE_IDS.length;
      engine.setState(STATE_IDS[cycleAt], now);
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ tracking
   * How far the gaze travels at the edge of its reach, degrees. Past that
   * the tanh saturates, so a pointer on the far side of the page and one
   * just outside the avatar ask for nearly the same look. */
  const MAX_YAW = 27;
  const MAX_PITCH = 17;
  /* Reach, in avatar widths from its centre. */
  const REACH = 1.8;

  let released = true;

  const onMove = (e) => {
    // Touch has no hovering pointer: a tap would yank the gaze and leave it.
    if (e.pointerType && e.pointerType !== "mouse") return;
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width * REACH);
    const ny = (e.clientY - (r.top + r.height / 2)) / (r.height * REACH);
    engine.setLook(
      {
        yaw: MAX_YAW * Math.tanh(nx * 2),
        // screen y grows downward, pitch grows upward
        pitch: -MAX_PITCH * Math.tanh(ny * 2),
        mix: 1,
        wander: 0.15
      },
      clock
    );
    released = false;
  };

  const onRelease = () => {
    if (released) return;
    engine.setLook(null, clock, 0.6);
    released = true;
  };

  const tracking = o.track && !still && typeof window !== "undefined";
  if (tracking) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", onRelease);
    document.addEventListener("pointerleave", onRelease);
  }

  if (still) draw(0);
  else raf = requestAnimationFrame(frame);

  return {
    update(next = {}) {
      Object.assign(o, next);
      if (next.state && next.state !== engine.state) {
        // Reduced motion holds no clock, so a change there lands whole.
        const now = still ? 0 : (performance.now() - t0) / 1000 * speed();
        if (still) engine.reset(next.state, 0);
        else engine.setState(next.state, now);
        cycleAt = Math.max(0, STATE_IDS.indexOf(engine.state));
        cycleAt0 = now;
        if (still) draw(0);
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      if (tracking) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("blur", onRelease);
        document.removeEventListener("pointerleave", onRelease);
      }
      el.innerHTML = restore;
    }
  };
}

/** Static markup for one state: snippet.html, and any still export. */
export const restingMarkup = (state = "idle", id = "s") =>
  template(id, new PawEngine(state).sample(0, false));

export const meta = {
  name: "paw-avatar",
  version: "1.0.0",
  category: "character",
  needs: [],
  license: "MIT",
  options: {
    state: { type: "string", default: "idle", description: "Which state to hold. One of idle, happy, excited, curious, thinking, working, focused, surprised, sleeping, wink, confused, sad, love, celebrating, creative, listening." },
    speed: { type: "number", default: 1, description: "Time multiplier for the whole engine. Clamped to 0.1-10." },
    cycle: { type: "number", default: 0, description: "Seconds per state when walking every state in turn; 0 holds the chosen state." },
    track: { type: "boolean", default: true, description: "Follow the mouse pointer with the gaze. Set data-fx-track=\"false\" to hold the state's own gaze." }
  }
};
