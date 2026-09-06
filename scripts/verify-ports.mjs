// Port-fidelity gate. Lint proves an effect DECLARES an origin; this proves the
// code came from it. Every check is mechanical: fetch the pinned upstream bytes
// and compare. Nothing here asks a model whether code "looks ported", because
// that is the unreliable judgement the gate exists to replace.
//
// Six checks, in descending order of what they catch:
//   1. pin resolves     FAIL  commit exists upstream, and every origin.path
//                             resolves at that exact commit
//   2. paper import     FAIL  a paper-design port carries no GLSL of its own;
//                             it imports the shader string from vendor/paper.js
//   3. copied GLSL      FAIL  a shader-gallery port's embedded GLSL is
//                             byte-identical to the upstream .frag
//   4. numeric trace    WARN  every numeric literal in our index.js also
//                             appears in some upstream file
//   5. licence          FAIL  meta.license equals the SPDX id detected in the
//                             upstream repo's own LICENSE file
//   6. deviations real  WARN  each declared deviation describes something
//                             observable, and heavy divergence is declared
//
// Check 1 short-circuits: if the pin does not resolve, nothing downstream is
// meaningful, so the effect reports that one reason and stops.
//
// WHY 4 IS A WARN AND NOT A FAIL. A port legitimately carries numbers that are
// ours: a clamp range, a fade duration, a guard threshold. There is no
// mechanical way to tell those from an invented easing curve, so the check
// lists every literal with no upstream counterpart and leaves the judgement to
// a reviewer. Failing on it would fire on good code, and a gate that cries wolf
// gets switched off. The value is that the reviewer reads one list instead of
// hunting the file.
//
// FETCHING AND THE CACHE. Upstream reads go through `gh api`, which is
// authenticated here and so has the 5000/hour limit rather than 60. Results
// land under `.cache/upstream/<repo>/<commit>/<path>` (gitignored). Those three
// coordinates are immutable, so a hit is never stale and a second run does no
// network at all. Only successes are cached, never a miss, or a fixture pinned
// to an invented sha would cache its own 404 and stop being caught. Two
// non-path keys share that directory: `.commit.json` records that the commit
// resolved, `.root.json` the repo root's file names (which is how the LICENSE
// is found in one call instead of probing six filenames).
//
// `offline: true` turns a cache miss into a not-found instead of a fetch, which
// is what lets tests/verify.test.js run the real checks against a committed
// corpus under tests/fixtures/upstream/ with no network. `bun run check` must
// stay network-free, so `verify` is deliberately not part of it.
//
// KNOWN CEILINGS, all measured or reasoned, none assumed:
//   - gh exits non-zero for a missing path (404), a bad sha (422), a rate
//     limit (403) and a dead network alike. Only 404/422 are read as
//     "not found"; anything else is an ERROR row that exits non-zero but says
//     "could not verify" rather than accusing the effect of invention.
//   - The contents endpoint returns empty content above ~1 MB. No upstream file
//     we pin is close, and the effect is a visible empty-string mismatch, not a
//     silent pass.
//   - Comment stripping is regex, not a parser, so a `//` inside a string
//     literal truncates that line. It can only remove text from the GLSL scan,
//     and GLSL sitting after a `//` on the same line is not a shape a real
//     paste takes.
//   - Check 4's seam exclusion is a line-class heuristic (see SEAM_LINE), not
//     dataflow. It errs toward reporting: a wrongly reported line is one WARN
//     to read, a wrongly excluded one is a hole.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { jsSpecifiers } from "./lint.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
export const DEFAULT_CACHE = join(ROOT, ".cache/upstream");

// ---------------------------------------------------------------- fetching

const NOT_FOUND = new Set(["404", "422"]); // missing path / no commit for sha

function ghJson(endpoint) {
  const r = spawnSync("gh", ["api", endpoint], { encoding: "utf8" });
  if (r.error) return { ok: false, reason: "error", message: r.error.message };
  if (r.status === 0) return { ok: true, body: JSON.parse(r.stdout) };
  let status = "";
  try { status = String(JSON.parse(r.stdout).status ?? ""); } catch { /* non-JSON stderr path */ }
  if (NOT_FOUND.has(status)) return { ok: false, reason: "not-found" };
  return { ok: false, reason: "error", message: (r.stderr || r.stdout || "").trim().split("\n")[0] };
}

// The cache path is built from meta.json, which an agent writes, and a fetched
// file is written to it. A ".." segment in origin.repo or origin.path would put
// that write outside the cache, so the coordinates are checked before they are
// ever joined to a directory.
const SAFE_COORD = (s) => typeof s === "string" && s.length > 0 && !s.split("/").includes("..") && !s.startsWith("/");
export const safeOrigin = (o) =>
  SAFE_COORD(o.repo) && SAFE_COORD(o.commit) && [o.path].flat().every(SAFE_COORD);

const cachePath = (cacheDir, repo, commit, key) => join(cacheDir, repo, commit, key);

function readCache(cacheDir, repo, commit, key) {
  const p = cachePath(cacheDir, repo, commit, key);
  return existsSync(p) && statSync(p).isFile() ? readFileSync(p, "utf8") : null;
}

function writeCache(cacheDir, repo, commit, key, text) {
  const p = cachePath(cacheDir, repo, commit, key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

/** Upstream file at an exact commit. { ok, text } | { ok:false, reason }. */
export function fetchFile(repo, commit, path, opts = {}) {
  const { cacheDir = DEFAULT_CACHE, offline = false } = opts;
  const hit = readCache(cacheDir, repo, commit, path);
  if (hit !== null) return { ok: true, text: hit };
  if (offline) return { ok: false, reason: "not-found" };
  const r = ghJson(`repos/${repo}/contents/${path}?ref=${commit}`);
  if (!r.ok) return r;
  const text = Buffer.from(r.body.content ?? "", r.body.encoding ?? "base64").toString("utf8");
  writeCache(cacheDir, repo, commit, path, text);
  return { ok: true, text };
}

/** Does the commit itself resolve? A branch or an invented sha does not. */
export function fetchCommit(repo, commit, opts = {}) {
  const { cacheDir = DEFAULT_CACHE, offline = false } = opts;
  if (readCache(cacheDir, repo, commit, ".commit.json") !== null) return { ok: true };
  if (offline) return { ok: false, reason: "not-found" };
  const r = ghJson(`repos/${repo}/commits/${commit}`);
  if (!r.ok) return r;
  writeCache(cacheDir, repo, commit, ".commit.json", JSON.stringify({ sha: r.body.sha }));
  return { ok: true };
}

/** File names at the repo root, so the LICENSE is found without probing. */
export function fetchRootNames(repo, commit, opts = {}) {
  const { cacheDir = DEFAULT_CACHE, offline = false } = opts;
  const hit = readCache(cacheDir, repo, commit, ".root.json");
  if (hit !== null) return { ok: true, names: JSON.parse(hit) };
  if (offline) return { ok: false, reason: "not-found" };
  const r = ghJson(`repos/${repo}/contents?ref=${commit}`);
  if (!r.ok) return r;
  const names = r.body.filter((e) => e.type === "file").map((e) => e.name);
  writeCache(cacheDir, repo, commit, ".root.json", JSON.stringify(names));
  return { ok: true, names };
}

// ---------------------------------------------------------------- helpers

const asPaths = (p) => (Array.isArray(p) ? p : [p]);

// Whole-line and inline comments. See the ceiling note in the header.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/gm, "$1");

// The things that only appear in shader source. `uniform` and `varying` are
// qualified by a GLSL type on purpose: bare /uniform /  matches
// `shader.setUniforms(` one refactor away, and a gate with a false FAIL in it
// is a gate someone deletes.
const GLSL_MARKERS = [
  /\bgl_FragColor\b/,
  /\bgl_Position\b/,
  /\bgl_FragCoord\b/,
  /\bvoid\s+main\s*\(/,
  /\buniform\s+(?:float|int|bool|vec[234]|ivec[234]|bvec[234]|mat[234]|sampler2D|samplerCube)\b/,
  /\bvarying\s+(?:float|int|vec[234]|mat[234])\b/,
  /\bprecision\s+(?:low|medium|high)p\b/,
  /^\s*#version\s/m,
];

export const looksLikeGlsl = (src) => GLSL_MARKERS.some((re) => re.test(src));

/** Which markers hit, for a FAIL message that names what was found. */
const glslHits = (src) => GLSL_MARKERS.filter((re) => re.test(src)).map((re) => src.match(re)[0].trim());

/**
 * Every backtick template literal in the source, in order. Hand-scanned rather
 * than regexed because a shader body routinely contains a lone backslash and a
 * `${}` splice, and the naive /`...`/s both over- and under-matches on those.
 */
export function templateLiterals(src) {
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "`") continue;
    let j = i + 1;
    while (j < src.length && src[j] !== "`") j += src[j] === "\\" ? 2 : 1;
    out.push(src.slice(i + 1, j));
    i = j;
  }
  return out;
}

// Normalisation for check 3, and nothing beyond it: CRLF to LF, trailing
// whitespace off each line, and the blank lines a template literal's own
// delimiters add (`const F = \`\n...\n\`;` gains one at each end). No
// reindentation, no whitespace collapsing, no comment stripping: those would
// hide exactly the single-character edit this check exists to catch.
const normaliseGlsl = (s) =>
  s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/^\n+|\n+$/g, "");

// A number, guarded on both sides so "1.0.0" and "#241d9a" tokenise to nothing.
// The leading-dot form matters: upstream writes `scale: [.98, 1.04]` where a port
// writes `0.98`, which is the same value and used to read as an untraced constant
// because `.98` matched nothing on the upstream side. Both sides run through this
// same tokeniser, so allowing it here fixes the comparison symmetrically.
const NUMERIC = /(?<![\w.$])-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?(?![\w.])/g;
const numbersIn = (s) => (s.match(NUMERIC) ?? []).map(Number).filter(Number.isFinite);

// Noise the brief names explicitly. Array indices are handled positionally.
const TRIVIAL = new Set([0, 1, 2, -1]);
const ARRAY_INDEX = /\[\s*-?\d{1,2}\s*\]/;

// Lines that are our seam by construction, not ported logic: the plumbing
// wrapper, the CSS custom properties, the guards, the meta block. Excluding
// them is what keeps check 4's output short enough to actually read.
const SEAM_LINE =
  /--fx-|\bmount\s*\(|\bdestroy\b|\b(?:set|remove|get)Attribute\b|\bmatchMedia\b|\bgetComputedStyle\b|\bquerySelector|\baddEventListener\b|\bremoveEventListener\b|\bsetProperty\b|\bremoveProperty\b/;

/**
 * Numeric literals in our index.js that appear in no upstream file, with the
 * line they sit on. Skips comments, the exported meta block, seam lines and
 * the trivial set.
 */
export function untracedNumbers(js, upstreamSources) {
  const upstream = new Set(upstreamSources.flatMap(numbersIn));
  const out = [];
  const lines = js.split("\n");
  let metaDepth = 0;
  let inMeta = false;
  lines.forEach((raw, i) => {
    if (/\bexport\s+const\s+meta\s*=/.test(raw)) { inMeta = true; metaDepth = 0; }
    if (inMeta) {
      for (const c of raw) { if (c === "{") metaDepth++; else if (c === "}") metaDepth--; }
      if (metaDepth <= 0 && /[}]/.test(raw)) inMeta = false;
      return;
    }
    const line = stripComments(raw);
    if (/^\s*(?:\/\/|\*|\/\*)/.test(raw) || !line.trim()) return;
    if (SEAM_LINE.test(line)) return;
    for (const n of numbersIn(line)) {
      if (TRIVIAL.has(n)) continue;
      if (Number.isInteger(n) && Math.abs(n) < 100 && ARRAY_INDEX.test(line)) continue;
      if (upstream.has(n)) continue;
      out.push({ line: i + 1, value: n, text: raw.trim() });
    }
  });
  return out;
}

// SPDX detection from the licence text itself. GitHub's /license endpoint is a
// guess by licensee and PINNED-SOURCES.md distrusts it on purpose, so the
// signatures below read the words the licence actually opens with. Order
// matters: BSD-3 is BSD-2 plus the "Neither the name" clause.
const SPDX_SIGNATURES = [
  ["Apache-2.0", /Apache License\s*\n?\s*Version 2\.0/i],
  ["CC0-1.0", /CC0 1\.0 Universal/i],
  ["Unlicense", /This is free and unencumbered software released into the public domain/i],
  ["BSD-3-Clause", /Redistribution and use in source and binary forms[\s\S]{0,4000}?Neither the name/i],
  ["BSD-2-Clause", /Redistribution and use in source and binary forms/i],
  ["MIT", /Permission is hereby granted, free of charge/i],
];

export const detectSpdx = (text) => SPDX_SIGNATURES.find(([, re]) => re.test(text))?.[0] ?? null;

const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:\.(?:md|txt|rst))?$/i;

// A deviation is "observable" if any word or number it names turns up in our
// own code or in what the other checks flagged. Deliberately loose: the check
// is here to catch a deviations entry that describes nothing at all, not to
// grade prose.
const deviationTokens = (what) =>
  (what.toLowerCase().match(/[a-z_][\w-]{2,}|\d+(?:\.\d+)?/g) ?? []).filter((t) => !STOPWORDS.has(t));

const STOPWORDS = new Set([
  "the", "and", "for", "with", "our", "its", "into", "from", "not", "but", "that", "this",
  "are", "was", "were", "has", "have", "than", "then", "out", "off", "own", "use", "used",
]);

// ---------------------------------------------------------------- the checks

// Each check reads {meta, js, upstream, diffLines} and pushes onto fails/warns.
// Named and exported as a list so tests/verify.test.js can switch one off and
// prove the matching fixture stops being caught: a gate nobody has watched fail
// is a gate nobody knows works.

const checkPaperImport = (ctx) => {
  if (ctx.meta.origin.repo !== "paper-design/shaders") return;
  const imports = [...jsSpecifiers(ctx.js)].some((s) => /vendor\/paper\.js$/.test(s));
  if (!imports) ctx.fails.push("paper-design port must import the shader from ../../vendor/paper.js");
  const stripped = stripComments(ctx.js);
  if (looksLikeGlsl(stripped)) {
    ctx.fails.push(`paper-design port carries GLSL in index.js (found ${glslHits(stripped).join(", ")}); import it from ../../vendor/paper.js instead`);
  }
};

const checkCopiedGlsl = (ctx) => {
  const fragPaths = Object.keys(ctx.upstream).filter((p) => /\.(?:frag|glsl|vert)$/i.test(p));
  if (!fragPaths.length) return;
  const ours = templateLiterals(ctx.js).filter(looksLikeGlsl).map(normaliseGlsl);
  if (!ours.length) {
    ctx.fails.push(`no GLSL found in index.js to compare with upstream ${fragPaths.join(", ")}`);
    return;
  }
  for (const path of fragPaths) {
    const want = normaliseGlsl(ctx.upstream[path]);
    if (ours.includes(want)) continue;
    const got = ours.reduce((a, b) => (b.length > a.length ? b : a));
    const diff = diffLines(want, got);
    ctx.diffLines.push(...diff.map((d) => d.text));
    const excused = diff.filter((d) => isExcused(d.text, ctx.meta.deviations));
    if (excused.length === diff.length) continue;
    const shown = diff.filter((d) => !excused.includes(d)).slice(0, 12);
    ctx.fails.push(
      `copied GLSL differs from upstream ${path} at ${diff.length - excused.length} line(s):\n` +
        shown.map((d) => `      shader L${d.line} upstream: ${d.want}\n                      ours: ${d.got}`).join("\n"),
    );
  }
};

/** Line-for-line, which is what "byte-identical" means to a reviewer. */
function diffLines(want, got) {
  const a = want.split("\n");
  const b = got.split("\n");
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    out.push({ line: i + 1, want: a[i] ?? "(end of file)", got: b[i] ?? "(end of file)", text: `${a[i] ?? ""} ${b[i] ?? ""}` });
  }
  return out;
}

const isExcused = (text, deviations = []) => {
  const hay = text.toLowerCase();
  return deviations.some((d) => deviationTokens(d.what).some((t) => hay.includes(t)));
};

const checkNumericTrace = (ctx) => {
  const untraced = untracedNumbers(ctx.js, Object.values(ctx.upstream));
  ctx.untraced = untraced;
  for (const u of untraced) {
    if (isExcused(u.text, ctx.meta.deviations)) continue;
    ctx.warns.push(`L${u.line} ${u.value} appears in no pinned upstream file: ${u.text}`);
  }
};

const checkLicence = (ctx) => {
  const { repo, commit } = ctx.meta.origin;
  const root = fetchRootNames(repo, commit, ctx.opts);
  if (!root.ok) {
    if (root.reason === "error") ctx.errors.push(`could not list ${repo} root: ${root.message}`);
    else ctx.fails.push(`cannot read ${repo} root at ${commit.slice(0, 7)} to find its LICENSE`);
    return;
  }
  const name = root.names.find((n) => LICENSE_FILE.test(n));
  if (!name) {
    ctx.fails.push(`${repo} has no LICENSE file at ${commit.slice(0, 7)}, so the declared "${ctx.meta.license}" cannot be evidenced`);
    return;
  }
  const file = fetchFile(repo, commit, name, ctx.opts);
  if (!file.ok) {
    if (file.reason === "error") ctx.errors.push(`could not fetch ${repo}/${name}: ${file.message}`);
    else ctx.fails.push(`${repo}/${name} does not resolve at ${commit.slice(0, 7)}`);
    return;
  }
  const spdx = detectSpdx(file.text);
  if (!spdx) ctx.fails.push(`${repo}/${name} matches no known licence text, so "${ctx.meta.license}" cannot be evidenced`);
  else if (spdx !== ctx.meta.license) ctx.fails.push(`declares "${ctx.meta.license}" but ${repo}/${name} is ${spdx}`);
};

const checkDeviationsReal = (ctx) => {
  const deviations = ctx.meta.deviations ?? [];
  // Comments are stripped on purpose. A deviation restated in the header
  // comment is prose agreeing with prose; what makes it real is code, a GLSL
  // line that actually differs, or a constant the numeric check could not
  // trace. Those three are the haystack.
  const observable = [stripComments(ctx.js), ...ctx.diffLines, ...ctx.untraced.map((u) => u.text)]
    .join("\n")
    .toLowerCase();
  for (const d of deviations) {
    const tokens = deviationTokens(d.what);
    if (!tokens.length || !tokens.some((t) => observable.includes(t))) {
      ctx.warns.push(`declared deviation matches nothing in the code, the GLSL diff or the untraced constants: "${d.what}"`);
    }
  }
  if (!deviations.length && ctx.untraced.length > UNDECLARED_LIMIT) {
    ctx.warns.push(`${ctx.untraced.length} untraced constants and an empty deviations list; declare what is deliberately ours`);
  }
};

const UNDECLARED_LIMIT = 5;

export const CHECKS = [
  { name: "paper-import", run: checkPaperImport },
  { name: "copied-glsl", run: checkCopiedGlsl },
  { name: "numeric-trace", run: checkNumericTrace },
  { name: "licence", run: checkLicence },
  { name: "deviations-real", run: checkDeviationsReal },
];

// The two pin rules live inline in verifyEffect because they gate everything
// after them, but they are named here so `opts.skip` and the mutation table
// cover all seven rules and not just the five that happen to be in the list.
export const PIN_CHECKS = ["pin-commit", "pin-path"];
export const CHECK_NAMES = [...PIN_CHECKS, ...CHECKS.map((c) => c.name)];

// ---------------------------------------------------------------- per effect

/**
 * One effect. `opts.skip` names checks to switch off, which is how the
 * mutation test proves each one is load-bearing; `opts.offline` and
 * `opts.cacheDir` steer the fetcher. "pin-commit" and "pin-path" are skippable
 * the same way even though they run inline here rather than out of CHECKS,
 * because they are the two highest-value rules in the file and a rule nobody
 * has watched fail is a rule nobody knows works.
 */
export function verifyEffect(dir, opts = {}) {
  const name = basename(dir);
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  const out = { name, status: "PASS", fails: [], warns: [], errors: [] };
  if (!meta.origin || meta.origin.repo === "paw-fx") return { ...out, status: "SKIP" };

  if (!safeOrigin(meta.origin)) {
    return { ...out, status: "FAIL", fails: ["origin.repo, origin.commit and origin.path must be plain relative coordinates"] };
  }

  const skip = new Set(opts.skip ?? []);
  const { repo, commit } = meta.origin;
  const paths = asPaths(meta.origin.path);

  // Check 1 is fatal on its own: with an unresolved pin there is nothing to
  // compare against, so every downstream check would be measuring air.
  const head = skip.has("pin-commit") ? { ok: true } : fetchCommit(repo, commit, opts);
  if (!head.ok) {
    if (head.reason === "error") return { ...out, status: "ERROR", errors: [`could not reach ${repo}: ${head.message}`] };
    return { ...out, status: "FAIL", fails: [`origin.commit ${commit} does not resolve in ${repo}`] };
  }
  const upstream = {};
  for (const p of paths) {
    const r = fetchFile(repo, commit, p, opts);
    if (r.ok) upstream[p] = r.text;
    else if (skip.has("pin-path")) continue;
    else if (r.reason === "error") out.errors.push(`could not fetch ${repo}/${p}: ${r.message}`);
    else out.fails.push(`origin.path "${p}" does not exist in ${repo} at ${commit.slice(0, 7)}`);
  }
  if (out.fails.length || out.errors.length) {
    return { ...out, status: out.fails.length ? "FAIL" : "ERROR" };
  }

  const ctx = {
    meta, upstream, opts,
    js: readFileSync(join(dir, "index.js"), "utf8"),
    fails: out.fails, warns: out.warns, errors: out.errors,
    diffLines: [], untraced: [],
  };
  for (const c of CHECKS) if (!skip.has(c.name)) c.run(ctx);

  out.status = out.errors.length ? "ERROR" : out.fails.length ? "FAIL" : out.warns.length ? "WARN" : "PASS";
  return out;
}

export function effectDirs(root = join(ROOT, "effects")) {
  return readdirSync(root).map((d) => join(root, d)).filter((d) => statSync(d).isDirectory());
}

// ---------------------------------------------------------------- reporting

const MARK = { PASS: "PASS", WARN: "WARN", FAIL: "FAIL", SKIP: "SKIP", ERROR: "ERR " };

export function report(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${MARK[r.status]}  ${r.name}`);
    for (const f of r.fails) lines.push(`  FAIL  ${f}`);
    for (const e of r.errors) lines.push(`  ERR   ${e}`);
    for (const w of r.warns) lines.push(`  warn  ${w}`);
  }
  const width = Math.max(6, ...results.map((r) => r.name.length));
  lines.push("");
  lines.push(`  ${"effect".padEnd(width)}  status  fails  warns`);
  lines.push(`  ${"-".repeat(width)}  ------  -----  -----`);
  for (const r of results) {
    lines.push(`  ${r.name.padEnd(width)}  ${r.status.padEnd(6)}  ${String(r.fails.length).padStart(5)}  ${String(r.warns.length).padStart(5)}`);
  }
  const n = (s) => results.filter((r) => r.status === s).length;
  lines.push("");
  lines.push(`  ${results.length} effect(s): ${n("PASS")} pass, ${n("WARN")} warn, ${n("FAIL")} fail, ${n("ERROR")} error, ${n("SKIP")} skipped (paw-fx original)`);
  if (n("WARN")) lines.push("  WARNs do not fail the gate. A wave of them is the signal to read the port by hand.");
  return lines.join("\n");
}

if (import.meta.main) {
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : effectDirs();
  const results = dirs.map((d) => verifyEffect(d));
  console.log(report(results));
  const bad = results.filter((r) => r.status === "FAIL" || r.status === "ERROR").length;
  process.exit(bad ? 1 : 0);
}
