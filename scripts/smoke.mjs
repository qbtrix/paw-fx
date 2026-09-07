// Proves every effect's CSS-only resting state is not a blank rectangle.
// Materialises each built registry item into one temp site, serves it, loads
// the snippet in a real Chrome with every script request aborted, and fails
// the effect if its section is undersized, visually empty, or collapsed at
// phone width.
//
// Why this gate exists: a generated site may run the effect with JS pruned,
// blocked or refused (no WebGL context, a stripped bundle, a reader with
// scripting off). The contract says the section still has to look finished on
// CSS alone. Nobody on the team ever sees that path, because every machine
// here runs the script fine, so only a gate catches a beautiful effect that is
// an empty box for everyone else.
//
// HOW THE SCRIPT IS TAKEN AWAY, AND WHAT THAT PROVES.
// The page loads with `network route "**" --abort --resource-type script`, so
// every script the document fetches is aborted at the network layer: the
// module in <script src>, its transitive imports, dynamic import(), worker
// scripts. Nothing of the effect's index.js ever reaches the parser.
//
// This is the markup-and-stylesheet-only equivalent the contract cares about,
// not a browser-wide scripting switch, and the difference is worth stating.
// The first build DID disable scripting outright with
// `--blink-settings=scriptEnabled=false`, and it worked -- the page's module
// never ran and CDP Runtime.evaluate still measured fine -- but every
// screenshot then took 30.4s instead of 0.2s, because Playwright's own
// screenshot path evaluates script in the page and sat out its 30s timeout on
// every capture. Measured both ways on the same static page: 197ms with
// scripting on, 31.4s with it off. A 30s-per-effect gate is a gate nobody
// runs, so the block moved to the network layer.
//
// What the two differ on is inline script, and for this repo that gap is
// narrow: lint tests snippet.html's <script> OPENING TAG for `type="module"`
// and for `index.js`, so every script it accepts is meant to be an external
// module fetch, and every one of those is aborted. An inline module that
// imported index.js would be neutered anyway, since a module whose import
// fails never runs its body. The residue is an inline module hand-crafted to
// put the substring `index.js` in an attribute; that would run here, and the
// marker below would not notice, because the marker proves the route is live
// and nothing more. Closing it is lint's job, not this file's.
//
// The harness proves the block is live rather than assuming it: the wrapper
// page pulls an EXTERNAL /_marker.js that sets a flag, and the flag being set
// means the route was not applied and the whole run throws. A silently
// weakened gate is worse than no gate, so that is an abort, not a per-effect
// failure. Reduced motion is asserted the same way, so the capture is the
// resting frame rather than a lucky mid-animation one.
//
// It proves: with no effect script at all, the section paints something at
// 1440x900 and still has height at 375. It does NOT prove the section looks
// good, and it does not separately simulate a refused WebGL context or a
// pruned bundle; those collapse to this same no-script path by construction,
// since the resting state is the one fallback for all of them.
//
// The pixel check reads real pixels without a PNG decoder: Chrome screenshots
// the viewport, the file is written into the site root, and the page decodes
// it back through createImageBitmap + OffscreenCanvas and counts distinct
// sampled colours inside the section's box. Measured: aurora-css ~9000
// distinct colours, a blank section exactly 1.
//
// ponytail: MIN_COLOURS is the one named knob. 8 sits far above "uniform" (1)
// and far below anything carrying antialiased text, so it discriminates the
// case this gate is about without ruling on taste. A cursor or transition
// effect whose section is legitimately a flat plate may need it revisited --
// change the constant, do not delete the check.

import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { effectDirs } from "./lint.mjs";
import { buildItem } from "./build-registry.mjs";

// One session name per checkout. Several worktrees of this repo run smoke at the
// same time during a curation wave, and a fixed name means each run's `close`
// kills a sibling's browser mid-measurement, which surfaces as effect failures
// that are really collisions. The suffix is derived from the checkout path so it
// is stable across runs in the same worktree and distinct between worktrees.
const SESSION = `paw-fx-smoke-${createHash("sha1").update(new URL("..", import.meta.url).pathname).digest("hex").slice(0, 8)}`;
const DESKTOP = [1440, 900];
const MOBILE = [375, 812];
const MIN_W = 200;
const MIN_H = 100;
const MIN_COLOURS = 8;
const STRIDE = 97; // prime, so the sample never lands on one column of the image

/** Runs agent-browser, never through a shell. */
async function ab(args) {
  let proc;
  try {
    proc = Bun.spawn(["agent-browser", ...args], { stdout: "pipe", stderr: "pipe" });
  } catch (e) {
    throw new Error(`smoke needs the agent-browser CLI on PATH (${e.message}). brew install agent-browser && agent-browser install`);
  }
  // Drain both pipes before awaiting exit, or a chatty command deadlocks on a full pipe.
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out, err };
}


// A PNG ends with a fixed 12-byte IEND chunk, so a complete file is cheap to
// recognise. The screenshot is written by a separate process and then fetched
// back into the page to be decoded, and nothing between those two steps
// guarantees the write has landed: a partial file reaches createImageBitmap and
// throws "The source image could not be decoded". That surfaced as a smoke
// failure on an effect with nothing wrong with it, twice, which is the worst
// kind of gate because the fix looks like re-running until it passes. Waiting
// for the trailer removes the race instead of the symptom.
const PNG_END = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

async function awaitCompletePng(path, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const buf = readFileSync(path);
      if (buf.length > PNG_END.length && buf.subarray(-PNG_END.length).equals(PNG_END)) return;
    } catch {
      // Not written yet at all; the same wait covers it.
    }
    if (Date.now() > deadline) {
      throw new Error(`smoke: ${basename(path)} never finished writing within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Evaluates an expression that returns (or resolves to) a JSON string. */
async function ev(expr) {
  const { out, err } = await ab(["--session", SESSION, "eval", expr, "--json"]);
  let res;
  try { res = JSON.parse(out); } catch { throw new Error(`smoke: agent-browser eval returned no JSON (${err.trim() || out.trim()})`); }
  if (!res.success) throw new Error(`smoke: eval failed (${JSON.stringify(res.error)})`);
  return JSON.parse(res.data.result);
}

// Box, plus the two harness assertions. `jsRan` comes from the external
// /_marker.js: if it is true the abort route was not applied and every
// measurement after it was taken with the effect's own script running, which
// would let a script-dependent section pass a gate that only means anything
// without one.
const probeExpr = (name) => `(() => {
  const el = document.querySelector('[data-fx="${name}"]');
  const r = el && el.getBoundingClientRect();
  return JSON.stringify({
    found: !!el,
    w: r ? Math.round(r.width) : 0,
    h: r ? Math.round(r.height) : 0,
    jsRan: document.documentElement.dataset.jsRan === "1",
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
})()`;

// Decodes the screenshot back to pixels inside the page, because Bun has no
// image decoder and a hand-rolled PNG reader would be more code than the gate.
// The sample is clipped to the part of the section that is actually on screen,
// scaled by the image's own pixel ratio rather than an assumed 1.
const pixelExpr = (name, url) => `fetch(${JSON.stringify(url)})
  .then((r) => r.blob())
  .then(createImageBitmap)
  .then((bmp) => {
    const q = document.querySelector('[data-fx="${name}"]').getBoundingClientRect();
    const k = bmp.width / innerWidth;
    const sx = Math.max(0, Math.round(q.left * k));
    const sy = Math.max(0, Math.round(q.top * k));
    const sw = Math.max(1, Math.min(Math.round(q.right * k), bmp.width) - sx);
    const sh = Math.max(1, Math.min(Math.round(q.bottom * k), bmp.height) - sy);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(sx, sy, sw, sh).data;
    const seen = new Map();
    for (let i = 0; i < d.length; i += 4 * ${STRIDE}) {
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    let top = 0, hot = 0, total = 0;
    for (const [key, n] of seen) { total += n; if (n > top) { top = n; hot = key; } }
    return JSON.stringify({
      sampled: [sw, sh],
      colours: seen.size,
      dominant: "#" + hot.toString(16).padStart(6, "0"),
      dominantShare: total ? top / total : 1,
    });
  })`;

/**
 * The whole verdict, as a pure function of the measurements, so a test can
 * re-run it weakened against the same numbers and show the gate is load-bearing.
 */
export function checkMeasurements(name, m, opts = {}) {
  const { minW = MIN_W, minH = MIN_H, minColours = MIN_COLOURS } = opts;
  if (!m.found) return [`${name}: snippet.html has no [data-fx="${name}"] section to check`];
  const errs = [];
  const [dw, dh] = DESKTOP;
  if (m.w < minW || m.h < minH) {
    errs.push(`${name}: section box is ${m.w}x${m.h} at ${dw}x${dh}, under the ${minW}x${minH} floor`);
  } else if (m.colours < minColours) {
    const pct = Math.round(m.dominantShare * 100);
    errs.push(`${name}: section is visually empty at ${dw}x${dh} (${m.colours} distinct colour(s) sampled, ${pct}% ${m.dominant})`);
  }
  if (m.mobileH < minH) {
    errs.push(`${name}: section box is ${m.mobileW}x${m.mobileH} at ${MOBILE[0]} wide; a hero that collapses on a phone is the same bug`);
  }
  return errs;
}

// External on purpose: an inline script would run whatever the route does, and
// then it would be measuring nothing.
const MARKER_JS = 'document.documentElement.dataset.jsRan = "1";\n';

const page = (item) => `<!doctype html>
<meta charset="utf-8">
<title>${item.name}</title>
<style>html,body{margin:0;padding:0}</style>
<script src="/_marker.js"></script>
${item.snippet}
`;

function materialise(items) {
  const root = mkdtempSync(join(tmpdir(), "paw-fx-smoke-"));
  writeFileSync(join(root, "_marker.js"), MARKER_JS);
  for (const item of items) {
    // Item file paths are site-relative (_fx/effects/<name>/...), so the whole
    // set shares one root and the root-absolute hrefs in the snippet resolve.
    for (const f of item.files) {
      const dest = join(root, f.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, f.content);
    }
    writeFileSync(join(root, `${item.name}.html`), page(item));
  }
  return root;
}

async function measureOne(item, base, root) {
  const name = item.name;
  // Reset the viewport every time: the previous effect left it at phone width.
  await ab(["--session", SESSION, "set", "viewport", String(DESKTOP[0]), String(DESKTOP[1])]);
  await ab(["--session", SESSION, "open", `${base}/${name}.html`]);
  const m = await ev(probeExpr(name));
  if (m.jsRan) {
    throw new Error("smoke: /_marker.js executed, so script requests are NOT being aborted and the gate measured a page with its script running. Check the `network route ** --abort --resource-type script` step.");
  }
  if (!m.reducedMotion) {
    throw new Error("smoke: prefers-reduced-motion is not in effect, so the capture is a mid-animation frame rather than the resting state.");
  }
  // Screenshot only once the box is known good: capturing a zero-size or
  // absent section throws something opaque instead of reporting the box we
  // already measured.
  if (m.found && m.w >= MIN_W && m.h >= MIN_H) {
    const file = `_shot-${name}.png`;
    // The exit code of this one is checked, and the others are not, which is
    // why a screenshot that never happened surfaced three separate ways before
    // anyone saw the actual message: first as an undecodable image, then as a
    // file that never appeared, then as a hang. An ignored subprocess failure
    // does not stay quiet, it just reappears somewhere less honest.
    const shot = await ab(["--session", SESSION, "screenshot", join(root, file)]);
    if (shot.code !== 0) {
      throw new Error(`smoke: screenshot failed for ${name} (exit ${shot.code}): ${(shot.err || shot.out).trim()}`);
    }
    await awaitCompletePng(join(root, file));
    Object.assign(m, await ev(pixelExpr(name, `/${file}?t=${Date.now()}`)));
  }
  await ab(["--session", SESSION, "set", "viewport", String(MOBILE[0]), String(MOBILE[1])]);
  const mob = await ev(probeExpr(name));
  m.mobileW = mob.w;
  m.mobileH = mob.h;
  return { name, measurements: m, errors: checkMeasurements(name, m) };
}

/** Serves the temp site. Async on this loop, which is why every ab() is awaited. */
const serve = (root) =>
  Bun.serve({
    port: 0,
    async fetch(req) {
      const f = Bun.file(join(root, decodeURIComponent(new URL(req.url).pathname)));
      return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 });
    },
  });

/** Runs the gate over effect dirs; returns one result per effect. */
export async function smoke(dirs = effectDirs()) {
  const items = dirs.map((d) => buildItem(d));
  const root = materialise(items);
  const server = serve(root);
  const base = `http://127.0.0.1:${server.port}`;
  try {
    // Own session only, so a browser the captain left open is untouched. The
    // route has to be registered before the first navigation.
    await ab(["--session", SESSION, "close"]);
    await ab(["--session", SESSION, "open"]);
    await ab(["--session", SESSION, "network", "route", "**", "--abort", "--resource-type", "script"]);
    // light is pinned as well as reduced motion: the UA canvas colour behind a
    // transparent section is what a blank one reads as, and it has to be the
    // same on a machine running a dark desktop.
    await ab(["--session", SESSION, "set", "media", "light", "reduced-motion"]);
    const results = [];
    for (const item of items) results.push(await measureOne(item, base, root));
    return results;
  } finally {
    await ab(["--session", SESSION, "close"]).catch(() => {});
    server.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : effectDirs();
  const results = await smoke(dirs);
  const errs = results.flatMap((r) => r.errors);
  if (errs.length) {
    console.error(errs.join("\n"));
    process.exit(1);
  }
  console.log(`smoke ok: ${results.length} effect(s) render at rest with no effect script`);
}
