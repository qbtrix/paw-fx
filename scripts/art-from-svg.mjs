// SVG -> the art block the avatar engine consumes, with the one check that
// matters. Pure: text in, description out, no filesystem and no DOM, because
// both callers need it and neither can have the other's -- `scripts/paw-art.mjs`
// runs it over a file on disk, and the bring-your-own-mascot page runs it over
// a file someone just dropped into a browser.
//
// THE CONTRACT. Give the drawing these ids:
//
//   #paw-head    the skull outline, one closed M/C path
//   #paw-ear-l   left ear, closed, and STARTING at the point it hangs from
//   #paw-ear-r   right ear, same
//   #paw-eye-l   a <rect> (rx = a capsule) or <ellipse>, the resting eye
//   #paw-catch   optional <circle>, a glass catch inside that eye
//   #paw-ground  optional, drawn behind everything and never clipped
//   #paw-sheen   optional, clipped to the head
//   <defs>       gradients and filters; the head's own fill and stroke are
//                found from its url(#...) and renamed, so name them freely
//
// Starting an ear path at its pivot is the one convention that cannot be
// derived: an ear's attachment is a fact about the character, not about the
// outline. Both of the Paw's own drawings already did it by instinct.
//
// WHY THE STAR-SHAPE CHECK IS THE POINT. Each part becomes r(theta) about one
// origin, which is what buys the morphing: two silhouettes sampled at the same
// angles interpolate by lerping radii, with no path-morph library. The cost is
// that every ray must leave the outline exactly once. A dome, a blob, a lobe
// ear: fine. A tail, an antenna, a notch deep enough for a ray to cross twice:
// quietly flattened. Quietly is the problem, so this reports it and names the
// angle rather than letting a drawing ship looking almost right.

export const SAMPLES = 96;
const TAU = Math.PI * 2;
const ANGLES = Array.from({ length: SAMPLES }, (_, i) => (i / SAMPLES) * TAU);

/** `M x y C ... Z` -> polygon. Absolute M/C/Z only, which is the contract. */
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

const bbox = (pts) => ({
  x0: Math.min(...pts.map((p) => p.x)),
  x1: Math.max(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)),
  y1: Math.max(...pts.map((p) => p.y))
});
const centreOf = (pts) => {
  const b = bbox(pts);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
};

/**
 * Every ray/edge hit from `c`, per sample angle. One hit per ray is what the
 * engine needs; more means a concavity it will flatten.
 */
function crossings(poly, c) {
  return ANGLES.map((a) => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const hits = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const px = p.x - c.x;
      const py = p.y - c.y;
      const t = (px * ey - py * ex) / den;
      const u = (px * dy - py * dx) / den;
      if (t > 1e-6 && u >= 0 && u <= 1) hits.push(t);
    }
    return { a, hits };
  });
}

/** What the engine would lose on this part, in the drawing's own units. */
function starReport(name, poly, c) {
  const rows = crossings(poly, c);
  const bad = rows.filter((r) => r.hits.length > 1);
  const gap = bad.reduce((m, r) => Math.max(m, Math.max(...r.hits) - Math.min(...r.hits)), 0);
  const span = Math.max(...rows.map((r) => (r.hits.length ? Math.max(...r.hits) : 0)));
  return { name, rays: bad.length, gap, pct: span ? (gap / span) * 100 : 0 };
}

const el = (svg, id) => {
  const m = svg.match(new RegExp(`<([a-zA-Z]+)([^>]*\\bid="${id}"[^>]*)/?>`));
  return m ? { tag: m[1], attrs: m[2], raw: m[0] } : null;
};
const attr = (attrs, k) => {
  const m = attrs.match(new RegExp(`\\b${k}="([^"]*)"`));
  return m ? m[1] : null;
};
const num = (attrs, k, dflt = 0) => {
  const v = attr(attrs, k);
  return v == null ? dflt : Number(v);
};
/** The content of a container by id, which needs balanced-tag scanning. */
function group(svg, id) {
  const open = svg.search(new RegExp(`<g[^>]*\\bid="${id}"`));
  if (open < 0) return null;
  let i = svg.indexOf(">", open) + 1;
  let depth = 1;
  const start = i;
  while (depth > 0 && i < svg.length) {
    const next = svg.slice(i).search(/<\/?g[\s>]/);
    if (next < 0) break;
    i += next;
    depth += svg.slice(i, i + 3).startsWith("</g") ? -1 : 1;
    i += 3;
  }
  return svg.slice(start, i - 3).trim();
}

export function artFromSvg(svg, label = "svg") {
  const warn = [];
  const need = (id) => {
    const e = el(svg, id);
    if (!e) throw new Error(`${label}: no element with id="${id}"`);
    return e;
  };

  const dOf = (id) => {
    const d = attr(need(id).attrs, "d");
    if (!d) throw new Error(`${label}: #${id} has no d attribute`);
    if (/[a-z]/.test(d.replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? "" : c)))) {
      warn.push(`#${id} uses relative path commands; only absolute M/C/Z are read`);
    }
    return d.replace(/\s+/g, " ").trim();
  };

  const head = dOf("paw-head");
  const earL = dOf("paw-ear-l");
  const earR = dOf("paw-ear-r");

  const hp = flattenPath(head);
  const hb = bbox(hp);
  const cx = (hb.x0 + hb.x1) / 2;
  const cy = (hb.y0 + hb.y1) / 2;
  const unit = (hb.x1 - hb.x0) / 2;

  const first = (d) => {
    const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    return { x: n[0], y: n[1] };
  };

  // eye: a rect (rx makes it a capsule) or an ellipse
  const eyeEl = need("paw-eye-l");
  const eye =
    eyeEl.tag === "ellipse"
      ? { cx: num(eyeEl.attrs, "cx"), cy: num(eyeEl.attrs, "cy"), w: num(eyeEl.attrs, "rx") * 2, h: num(eyeEl.attrs, "ry") * 2 }
      : {
          cx: num(eyeEl.attrs, "x") + num(eyeEl.attrs, "width") / 2,
          cy: num(eyeEl.attrs, "y") + num(eyeEl.attrs, "height") / 2,
          w: num(eyeEl.attrs, "width"),
          h: num(eyeEl.attrs, "height")
        };
  if (eye.cx > cx) warn.push("#paw-eye-l sits right of centre; the engine mirrors it, so give it the LEFT eye");

  const catchEl = el(svg, "paw-catch");
  const glassCatch = catchEl
    ? { dx: +(num(catchEl.attrs, "cx") - eye.cx).toFixed(2), dy: +(num(catchEl.attrs, "cy") - eye.cy).toFixed(2), r: num(catchEl.attrs, "r") }
    : { dx: 0, dy: 0, r: 0 };

  // star-shape: the head about the origin, each ear about its own bbox centre
  const reports = [
    starReport("head", hp, { x: cx, y: cy }),
    starReport("ear-l", flattenPath(earL), centreOf(flattenPath(earL))),
    starReport("ear-r", flattenPath(earR), centreOf(flattenPath(earR)))
  ];

  // material: the head's own fill and stroke become FILL and RIM, every other
  // def keeps a name of its own so two avatars never share an id
  const headAttrs = need("paw-head").attrs;
  const ref = (v) => (v || "").match(/url\(#([^)]+)\)/)?.[1] ?? null;
  const rename = new Map();
  if (ref(attr(headAttrs, "fill"))) rename.set(ref(attr(headAttrs, "fill")), "FILL");
  if (ref(attr(headAttrs, "stroke"))) rename.set(ref(attr(headAttrs, "stroke")), "RIM");
  const defs = svg.match(/<defs>([\s\S]*?)<\/defs>/)?.[1] ?? "";
  let n = 0;
  for (const m of defs.matchAll(/\bid="([^"]+)"/g)) {
    if (!rename.has(m[1])) rename.set(m[1], `D${n++}`);
  }
  /** Comments and pretty-printing are for the drawing, not for the bundle. */
  const tidy = (str) => str.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
  const localise = (str) => {
    let out = tidy(str);
    for (const [from, to] of rename) out = out.split(`"${from}"`).join(`"${to}"`).split(`url(#${from})`).join(`url(#${to})`);
    // a userSpaceOnUse def is in the drawing's coordinates and has to be mapped
    return out.replace(/gradientTransform="(?!%M%)/g, 'gradientTransform="%M% ').replace(/%M% "/g, '%M%"');
  };
  const withMap = (str) =>
    str.replace(/(<(?:linear|radial)Gradient[^>]*gradientUnits="userSpaceOnUse")(?![^>]*gradientTransform)/g, '$1 gradientTransform="%M%"');

  // fill and rim come out of defs as their own fields rather than staying
  // inside it. The engine needs them separately -- they are what a part is
  // painted and stroked with -- and returning the shape that gets printed
  // means there is one glass object, not one for the page and one for the
  // file. (There were two, briefly, and the page could not mount a drawing
  // the command line handled fine.)
  const allDefs = localise(withMap(defs)).trim();
  const grad = (id) =>
    allDefs.match(new RegExp(`<(?:linear|radial)Gradient[^>]*id="${id}"[\\s\\S]*?<\\/(?:linear|radial)Gradient>`))?.[0] ?? "";
  const glass = {
    fill: grad("FILL"),
    rim: grad("RIM"),
    defs: allDefs.replace(/<(?:linear|radial)Gradient[^>]*id="(?:FILL|RIM)"[\s\S]*?<\/(?:linear|radial)Gradient>/g, "").trim(),
    ground: localise(group(svg, "paw-ground") ?? ""),
    sheen: localise(group(svg, "paw-sheen") ?? "")
  };
  if (!glass.fill) warn.push("#paw-head has no url(#…) fill; the mascot will have no body colour");
  if (!glass.rim) warn.push("#paw-head has no url(#…) stroke; the mascot will have no rim");
  if (!glass.ground) warn.push("no #paw-ground: the mascot will have no light pooling under it");
  if (!glass.sheen) warn.push("no #paw-sheen: the glass will have no highlight");

  return {
    art: {
      head,
      earL,
      earR,
      cx: +cx.toFixed(2),
      cy: +cy.toFixed(2),
      unit: +unit.toFixed(3),
      pivotL: first(earL),
      pivotR: first(earR),
      eye: { cx: +eye.cx.toFixed(2), cy: +eye.cy.toFixed(2), w: eye.w, h: eye.h },
      catch: glassCatch,
      glass
    },
    reports,
    warn,
    reach: Math.max(
      ...[...flattenPath(earL), ...flattenPath(earR), ...hp].map((p) => Math.hypot((p.x - cx) / unit, (p.y - cy) / unit))
    )
  };
}

/** The art block, as it appears in index.js. */
export function artBlock(art, name = "ART") {
  const q = (s) => JSON.stringify(s);
  return `export const ${name} = {
  head: ${q(art.head)},
  earL: ${q(art.earL)},
  earR: ${q(art.earR)},
  cx: ${art.cx},
  cy: ${art.cy},
  unit: ${art.unit},
  pivotL: { x: ${art.pivotL.x}, y: ${art.pivotL.y} },
  pivotR: { x: ${art.pivotR.x}, y: ${art.pivotR.y} },
  eye: { cx: ${art.eye.cx}, cy: ${art.eye.cy}, w: ${art.eye.w}, h: ${art.eye.h} },
  catch: { dx: ${art.catch.dx}, dy: ${art.catch.dy}, r: ${art.catch.r} },
  glass: {
    fill: ${q(art.glass.fill)},
    rim: ${q(art.glass.rim)},
    defs: ${q(art.glass.defs)},
    ground: ${q(art.glass.ground)},
    sheen: ${q(art.glass.sheen)}
  }
};`;
}
