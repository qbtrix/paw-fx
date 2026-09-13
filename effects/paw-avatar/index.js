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

/* --------------------------------------------------------------- frame of
 * reference. RADIUS is the head radius in viewBox units and every number
 * below is a fraction of it. HALF_BOX is not free: a raised ear reaches
 * ~1.79 head radii and the glyphs sit outside the head too. Nothing bounds
 * either at runtime -- it is the hand-set ear swings in STATES that keep the
 * geometry inside, and tests/paw-avatar.test.js locks that down. */
const RADIUS = 100;
const HALF_BOX = 179;

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
 * Superellipse |x/sx|^n + |y/sy|^n = 1 as a profile. n = 2 is an ellipse,
 * n ~ 3 the squircle that gives the Paw its rounded base corners.
 * Ported from bloub src/bot/shape.ts.
 */
function superellipseProfile(n, sx = 1, sy = 1) {
  return ANGLES.map((_, i) => {
    const c = Math.abs(COS[i] / sx) ** n;
    const s = Math.abs(SIN[i] / sy) ** n;
    return (c + s) ** (-1 / n);
  });
}

/** Union of two star-shaped profiles about the same origin: the farther edge wins. */
const maxProfile = (a, b) => a.map((r, i) => Math.max(r, b[i]));

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
 * Ours. A head of three overlapping disks with a flat bottom, and one ear
 * per side built as a three-disk lobe that swings about a root on the skull.
 * Every state is a handful of numbers on this rig, so poses interpolate as
 * a real ear rotation instead of a crossfade between two traced outlines. */

/**
 * The head is a mound: a squircle for the base (flat-ish bottom, rounded
 * corners, wider than tall) under a disk for the crown. Two star-shaped
 * profiles about the same origin union as a per-sample max.
 */
const HEAD_BASE = { n: 3.0, sx: 1.02, sy: 0.76 };
const HEAD_CROWN = [{ x: 0, y: -0.14, r: 0.84 }];

/**
 * One ear, in its OWN space, with the origin at the root it swings about.
 * Three disks tapering downward; the origin sits inside the first, which is
 * what keeps the lobe star-shaped and so expressible as r(theta) at all.
 *
 * The Paw is three silhouettes, not one. Upstream's bot is a single blob and
 * needs only one profile; giving the ears their own means they can pass
 * BEHIND the head, which is what reads as a separate part rather than as a
 * bump on a cloud. Each one is still the same radial machinery.
 */
const EAR_SWEEP = { n: 9, top: 0.14, len: 0.88, bow: 0.14, r0: 0.37, r1: 0.26 };

/**
 * The lobe as a swept disk: centres walk a slightly bowed line while the
 * radius tapers. Closely spaced disks make the union smooth, where three
 * far-apart ones scallop the outline.
 */
const earDisks = () =>
  Array.from({ length: EAR_SWEEP.n }, (_, i) => {
    const u = i / (EAR_SWEEP.n - 1);
    return {
      x: EAR_SWEEP.bow * u * u,
      y: EAR_SWEEP.top + EAR_SWEEP.len * u,
      r: lerp(EAR_SWEEP.r0, EAR_SWEEP.r1, u * u)
    };
  });

const EAR_LOBE = earDisks();
/** Where each ear roots on the skull, before any head tilt. */
const EAR_ROOT = { x: 0.56, y: -0.64 };
/** Outward tilt of a resting ear, radians (negative swings out). A state's `angle` is relative to this. */
const EAR_TILT = -0.42;

const mirrored = (circles) => circles.map((c) => ({ ...c, x: -c.x }));

/** Constant: the ear never changes shape, only where it hangs and how far out. */
const EAR_PROFILE = {
  l: unionOfCirclesProfile(mirrored(EAR_LOBE)),
  r: unionOfCirclesProfile(EAR_LOBE)
};
const HEAD_PROFILE = maxProfile(
  superellipseProfile(HEAD_BASE.n, HEAD_BASE.sx, HEAD_BASE.sy),
  unionOfCirclesProfile(HEAD_CROWN)
);

/** Scratch buffers: nothing is reallocated per frame. */
function makeBody() {
  return { head: [], earL: [], earR: [] };
}

/**
 * Screen placement of one ear. `side` is -1 left, +1 right; a positive
 * `angle` swings the lobe outward on both sides, `lift` raises the root, and
 * the head's own tilt carries the root around with it.
 */
function earPose(side, ear, headRot) {
  const rx = EAR_ROOT.x * side;
  const ry = EAR_ROOT.y - ear.lift;
  const c = Math.cos(headRot);
  const s = Math.sin(headRot);
  return {
    rot: headRot + (EAR_TILT + ear.angle) * side,
    sx: 1,
    sy: 1,
    cx: rx * c - ry * s,
    cy: rx * s + ry * c
  };
}

/* ------------------------------------------------------------------ face
 * Ported from bloub src/bot/face.ts. The eyes live on a sphere, not flat on
 * the page: each one takes the tangent frame of the head at its own angle,
 * projected orthographically, so turning the gaze compresses and tilts them
 * on its own. That is where the volume comes from. */

const deg = (d) => (d * Math.PI) / 180;

/** Half-separation of the eyes on the sphere, degrees. */
const EYE_SPLIT = 19;
/** Eye size at rest, in head radii. */
const EYE_W = 0.30;
const EYE_H = 0.54;
/** The Paw looks at you: unlike bloub's 3/4 bot, rest gaze is square on. */
const REST_GAZE = { yaw: 0, pitch: -2, roll: 0 };
/** The face sits high on the head. */
const FACE_Y = -0.08;

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
 * cross in OPACITY, never in geometry: each one is a static <g> drawn once
 * and faded. The three face glyphs replace the eyes (eyeAlpha 0) rather
 * than sitting beside them. */

const zed = (x, y, s) => `M${x} ${y}h${s}l${-s} ${s}h${s}`;
const heart = (x, y, s) =>
  `M${x} ${y + s * 0.9}c${-s * 1.3} ${-s * 0.9} ${-s * 0.8} ${-s * 1.9} 0 ${-s * 1.1}` +
  `c${s * 0.8} ${-s * 0.8} ${s * 1.3} ${s * 0.2} 0 ${s * 1.1}z`;

const GLYPHS = {
  spark: `<path d="M78 -104L92 -122M104 -96L124 -104M64 -120L70 -142"/>`,
  think: `<circle cx="112" cy="-112" r="9"/><circle cx="134" cy="-134" r="6"/>`,
  zzz: `<path d="${zed(96, -120, 16)}${zed(120, -140, 12)}${zed(138, -154, 9)}"/>`,
  question: `<path d="M96 -132a15 15 0 1 1 15 15v9"/><circle cx="111" cy="-96" r="5"/>`,
  hearts: `<path class="fx-paw-warm" d="${heart(-16, -122, 13)}${heart(30, -140, 9)}"/>`,
  waves: `<path d="M104 -96a26 26 0 0 1 20 -24M112 -74a44 44 0 0 1 34 -40M120 -52a62 62 0 0 1 48 -56"/>`,
  speed: `<path d="M-118 -30h-42M-126 -6h-54M-118 18h-38"/>`,
  faceHappy: `<path d="M-51 0q18 -22 36 0M15 0q18 -22 36 0"/>`,
  faceX: `<path d="M-42 -16l16 16l-16 16M42 -16l-16 16l16 16"/>`,
  faceLove: `<path class="fx-paw-warm" d="${heart(-33, -10, 15)}${heart(33, -10, 15)}"/>`
};

/** Glyphs drawn with a stroke rather than a fill. */
const STROKED = new Set(["spark", "zzz", "question", "waves", "speed", "faceHappy", "faceX"]);

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
    glyphs
  };
}

/* ------------------------------------------------------------ the 15 states
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

/* ----------------------------------------------------------------- engine
 * Ported from bloub src/bot/engine.ts. Two things matter here and both are
 * upstream's: sample(now) is a pure function of time, so pause, scrub and
 * re-reading a past date give byte-identical output; and setState is a DATED
 * setter that, when a change lands mid-fade, freezes the composite pose
 * currently on screen and fades from THAT. Without the freeze, the one slot
 * of history means a second change snaps back to the full previous pose.
 */
export class PawEngine {
  constructor(initial = "idle") {
    this.cur = STATES[initial] ? initial : "idle";
    this.prev = null;
    this.frozen = null;
    this.tCur = 0;
    this.tPrev = 0;
    this.blinkAt = -10;
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
    if (since >= def.morph) return pose;
    const origin = this.frozen ?? (this.prev
      ? STATES[this.prev].pose(Math.max(0, now - this.tPrev))
      : null);
    if (!origin) return pose;
    // Ease-out, and the ratio is CLAMPED: reading a date before the change
    // would give a negative ratio that the ease extrapolates far past the pose.
    return blendPose(origin, pose, easeOutQuint(clamp(since / def.morph)));
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
  }

  sample(now, alive = true) {
    const pose = this.composed(now);
    const faceOn = pose.eyeAlpha > 0.01;
    const life = alive
      ? liveliness(now, pose.wander, faceOn)
      : { dYaw: 0, dPitch: 0, dRoll: 0, lid: 1, driftX: 0, driftY: 0, breath: 1 };

    const gaze = {
      yaw: pose.gaze.yaw + life.dYaw,
      pitch: pose.gaze.pitch + life.dPitch,
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
      toPoints(EAR_PROFILE.l, shift(earPose(-1, pose.ears.l, pose.rot)), RADIUS, this.body.earL)
    );
    const earRPath = closedPath(
      toPoints(EAR_PROFILE.r, shift(earPose(1, pose.ears.r, pose.rot)), RADIUS, this.body.earR)
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
      bodyPath,
      earLPath,
      earRPath,
      eyes,
      glyphs: pose.glyphs,
      // The face glyphs ride the body drift; the outer marks stay put.
      faceShift: `translate(${r2(cx * RADIUS)} ${r2((cy + FACE_Y) * RADIUS)})`
    };
  }
}

/** The resting frame, for baking a CSS-only snippet or a static export. */
export const restingPath = (state = "idle") => new PawEngine(state).sample(0, false).bodyPath;

/* -------------------------------------------------------------------- DOM */

let uid = 0;

/**
 * The SVG skeleton. With a `frame` it bakes that frame's geometry into the
 * markup, which is how snippet.html looks finished before any JS runs --
 * possible only because sample() is deterministic.
 */
function template(id, frame) {
  const at = (i, k, dflt) => (frame ? (frame.eyes[i] ? frame.eyes[i][k] : dflt) : dflt);
  const marks = Object.keys(GLYPHS)
    .filter((k) => !k.startsWith("face"))
    .map((k) => `<g class="fx-paw-glyph${STROKED.has(k) ? " fx-paw-stroke" : ""}" data-g="${k}" opacity="${frame ? r2(frame.glyphs[k] ?? 0) : 0}">${GLYPHS[k]}</g>`)
    .join("");
  const faces = Object.keys(GLYPHS)
    .filter((k) => k.startsWith("face"))
    .map((k) => `<g class="fx-paw-glyph${STROKED.has(k) ? " fx-paw-stroke" : ""}" data-g="${k}" opacity="${frame ? r2(frame.glyphs[k] ?? 0) : 0}">${GLYPHS[k]}</g>`)
    .join("");
  const d = frame ? frame.bodyPath : "";
  const eL = frame ? frame.earLPath : "";
  const eR = frame ? frame.earRPath : "";
  const shift = frame ? frame.faceShift : "";
  const eye = (i) =>
    `<path class="fx-paw-eye" d="${at(i, "d", "")}" transform="${at(i, "matrix", "")}" opacity="${at(i, "alpha", 0)}"/>`;
  // One glass part = fill, a wide blurred stroke clipped INSIDE it (the
  // fresnel edge glow that reads as thick glass), then a crisp rim on top.
  const part = (key, d, extra = "") => `
  <g class="fx-paw-part">
    <clipPath id="fx-paw-clip-${key}-${id}"><path data-part="${key}" d="${d}"/></clipPath>
    <path class="fx-paw-fill" data-part="${key}" d="${d}" fill="url(#fx-paw-skin-${id})"/>
    <g clip-path="url(#fx-paw-clip-${key}-${id})">
      <path class="fx-paw-inner" data-part="${key}" d="${d}" fill="none" stroke="url(#fx-paw-rim-${id})" filter="url(#fx-paw-soft-${id})"/>${extra}
    </g>
    <path class="fx-paw-rim" data-part="${key}" d="${d}" fill="none" stroke="url(#fx-paw-rim-${id})"/>
  </g>`;
  const shine = `
      <ellipse class="fx-paw-shine" cx="-30" cy="-74" rx="52" ry="22" transform="rotate(-18 -30 -74)" filter="url(#fx-paw-soft-${id})"/>
      <ellipse class="fx-paw-shine fx-paw-shine-b" cx="46" cy="-40" rx="14" ry="36" transform="rotate(18 46 -40)" filter="url(#fx-paw-soft-${id})"/>`;
  return `<div class="fx-paw"><svg class="fx-paw-svg" viewBox="${-HALF_BOX} ${-HALF_BOX} ${HALF_BOX * 2} ${HALF_BOX * 2}" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="fx-paw-skin-${id}" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="var(--fx-paw-top)"/>
      <stop offset="0.5" stop-color="var(--fx-paw-mid)"/>
      <stop offset="1" stop-color="var(--fx-paw-bottom)"/>
    </linearGradient>
    <linearGradient id="fx-paw-rim-${id}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="var(--fx-paw-rim-a)"/>
      <stop offset="0.55" stop-color="var(--fx-paw-rim-b)"/>
      <stop offset="1" stop-color="var(--fx-paw-rim-c)"/>
    </linearGradient>
    <filter id="fx-paw-soft-${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  ${part("earL", eL)}
  ${part("earR", eR)}
  ${part("body", d, shine)}
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

  const engine = new PawEngine(o.state);
  let raf = 0;
  // Seeded here, not on the first frame: update() can be called before rAF has
  // run, and a t0 of 0 would date that change hundreds of seconds in the
  // future, leaving the avatar stuck on its initial state until wall clock
  // caught up. rAF timestamps share performance.now()'s origin.
  let t0 = typeof performance === "object" ? performance.now() : 0;
  let cycleAt = 0;
  let cycleAt0 = 0;

  const speed = () => clamp(Number(o.speed) || 1, 0.1, 10);

  function draw(now) {
    const f = engine.sample(now, !still);
    wrap.style.setProperty("--fx-paw-pulse", r2(f.glow));
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
      eyeEls[i].setAttribute("d", e.d);
      eyeEls[i].setAttribute("transform", e.matrix);
      eyeEls[i].setAttribute("opacity", r2(e.alpha));
    }
    for (const k in glyphEls) glyphEls[k].setAttribute("opacity", r2(f.glyphs[k] ?? 0));
  }

  function frame(ts) {
    const now = ((ts - t0) / 1000) * speed();
    const every = Number(o.cycle) || 0;
    if (every > 0 && now - cycleAt0 >= every) {
      cycleAt0 = now;
      cycleAt = (cycleAt + 1) % STATE_IDS.length;
      engine.setState(STATE_IDS[cycleAt], now);
    }
    draw(now);
    raf = requestAnimationFrame(frame);
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
    state: { type: "string", default: "idle", description: "Which state to hold. One of idle, happy, excited, curious, thinking, working, focused, surprised, sleeping, wink, confused, sad, love, celebrating, listening." },
    speed: { type: "number", default: 1, description: "Time multiplier for the whole engine. Clamped to 0.1-10." },
    cycle: { type: "number", default: 0, description: "Seconds per state when walking every state in turn; 0 holds the chosen state." }
  }
};
