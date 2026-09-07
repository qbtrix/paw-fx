// Port-fidelity contract: mesh-gradient verifies against its real upstream,
// each fixture is caught for exactly one reason, and every rule in the gate is
// proved load-bearing by switching it off and watching its fixture go quiet.
//
// OFFLINE BY CONSTRUCTION. `bun run check` runs this file, and check must not
// touch the network, so every case here passes `{ offline: true, cacheDir:
// tests/fixtures/upstream }`. That directory is not a mock: it is the gate's
// own cache, seeded by running the gate live against these same fixtures, so
// the bytes compared here are the bytes GitHub served for those (repo, commit,
// path) triples. A cache miss in offline mode reads as not-found, which is what
// gives bad-pin-commit and bad-pin-path something to fail on without a fetch.
//
// EXACT FAIL LISTS, not "some error mentions X". lint.test.js learned this the
// hard way: a fixture that fails for a second accidental reason proves nothing
// about the rule it is named for. Each fixture below is a correct port with one
// thing wrong.
//
// THE MUTATION TABLE is the point of the file. A gate nobody has watched fail
// is a gate nobody knows works, and a check that never fires alone is a check
// another one is silently covering for. So for every rule: with it on, its
// fixture is caught; with it off, that fixture goes quiet; and with it off,
// every other rule still catches its own. The table prints on every run.
import { test, expect } from "bun:test";
import { verifyEffect, CHECK_NAMES, detectSpdx, untracedNumbers, templateLiterals, looksLikeGlsl, safeOrigin } from "../scripts/verify-ports.mjs";

const fx = (p) => new URL(`../${p}`, import.meta.url).pathname;
const OFFLINE = { offline: true, cacheDir: fx("tests/fixtures/upstream") };

const verify = (name, skip = []) => verifyEffect(fx(name), { ...OFFLINE, skip });
const findings = (r) => [...r.fails, ...r.warns];

// ---------------------------------------------------------------- controls

// The gate has to be able to say yes, or "it caught everything" means nothing.
test("mesh-gradient verifies against its pinned upstream", () => {
  const r = verify("effects/mesh-gradient");
  expect(r.fails).toEqual([]);
  expect(r.warns).toEqual([]);
  expect(r.status).toBe("PASS");
});

test("a paw-fx original is skipped, not failed", () => {
  expect(verify("effects/aurora-css").status).toBe("SKIP");
});

// ---------------------------------------------------------------- fixtures

test("an invented commit sha fails", () => {
  expect(verify("tests/fixtures/bad-pin-commit").fails).toEqual([
    "origin.commit deadbeefdeadbeefdeadbeefdeadbeefdeadbeef does not resolve in paper-design/shaders",
  ]);
});

// The commit here is real, so only fetching the path at it catches this one.
test("a real commit with an invented path fails", () => {
  expect(verify("tests/fixtures/bad-pin-path").fails).toEqual([
    'origin.path "packages/shaders/src/shaders/twilight-drape.ts" does not exist in paper-design/shaders at 6046740',
  ]);
});

// One character, in the middle of 84 lines of shader nobody reads by eye.
test("copied GLSL with one altered constant fails", () => {
  const r = verify("tests/fixtures/bad-glsl-altered");
  expect(r.fails.length).toBe(1);
  expect(r.fails[0]).toContain("copied GLSL differs from upstream gloam/shader.frag at 1 line(s)");
  expect(r.fails[0]).toContain("shader L34 upstream:     p = rot * p * 2.03 + vec2(11.3, 7.1);");
  expect(r.fails[0]).toContain("ours:     p = rot * p * 2.07 + vec2(11.3, 7.1);");
});

test("a paper-design port that pastes GLSL instead of importing it fails", () => {
  const r = verify("tests/fixtures/bad-glsl-pasted");
  expect(r.fails.length).toBe(1);
  expect(r.fails[0]).toContain("paper-design port carries GLSL in index.js");
  expect(r.fails[0]).toContain("gl_FragColor");
});

test("declaring MIT over an Apache-2.0 upstream fails", () => {
  expect(verify("tests/fixtures/bad-licence-mismatch").fails).toEqual([
    'declares "MIT" but paper-design/shaders/LICENSE is Apache-2.0',
  ]);
});

// WARN, not FAIL: prose can be right and share no token with the code, so this
// one asks a human to look rather than blocking the port.
test("a deviation that describes nothing warns and does not fail", () => {
  const r = verify("tests/fixtures/bad-deviation-phantom");
  expect(r.fails).toEqual([]);
  expect(r.warns.length).toBe(1);
  expect(r.warns[0]).toContain("matches nothing in the code");
  expect(r.status).toBe("WARN");
});

// ---------------------------------------------------------------- mutation

// Rule -> the fixture it owns, and the finding that is unmistakably its work.
const OWNED = {
  "pin-commit": ["tests/fixtures/bad-pin-commit", /does not resolve in/],
  "pin-path": ["tests/fixtures/bad-pin-path", /does not exist in/],
  "paper-import": ["tests/fixtures/bad-glsl-pasted", /carries GLSL in index\.js/],
  "copied-glsl": ["tests/fixtures/bad-glsl-altered", /copied GLSL differs/],
  "numeric-trace": ["tests/fixtures/bad-glsl-altered", /2\.07 appears in no pinned upstream file/],
  "licence": ["tests/fixtures/bad-licence-mismatch", /LICENSE is Apache-2\.0/],
  "deviations-real": ["tests/fixtures/bad-deviation-phantom", /matches nothing in the code/],
};

const caughtBy = (rule, skip = []) => {
  const [dir, re] = OWNED[rule];
  return findings(verify(dir, skip)).some((f) => re.test(f));
};

test("every rule in the gate is named in the mutation table", () => {
  expect(Object.keys(OWNED).sort()).toEqual([...CHECK_NAMES].sort());
});

test.each(CHECK_NAMES)("%s is load-bearing: weakening it loses its fixture", (rule) => {
  expect(caughtBy(rule)).toBe(true);
  expect(caughtBy(rule, [rule])).toBe(false);
});

// Without this, one over-broad rule could be catching everything and the row
// above would still pass for the wrong reason.
test.each(CHECK_NAMES)("%s off leaves every other rule still catching its own", (rule) => {
  for (const other of CHECK_NAMES) {
    if (other === rule) continue;
    expect(`${other}: ${caughtBy(other, [rule])}`).toBe(`${other}: true`);
  }
});

test("the mutation table", () => {
  const rows = CHECK_NAMES.map((rule) => {
    const [dir] = OWNED[rule];
    const others = CHECK_NAMES.filter((o) => o !== rule).every((o) => caughtBy(o, [rule]));
    return { rule, fixture: dir.replace("tests/fixtures/", ""), on: caughtBy(rule), off: caughtBy(rule, [rule]), others };
  });
  const w = (k, min) => Math.max(min, ...rows.map((r) => String(r[k]).length));
  const [a, b] = [w("rule", 4), w("fixture", 7)];
  const line = (r) =>
    `  ${String(r.rule).padEnd(a)}  ${String(r.fixture).padEnd(b)}  ${(r.on ? "caught" : "MISSED").padEnd(7)}  ${(r.off ? "STILL CAUGHT" : "not caught").padEnd(13)}  ${r.others ? "yes" : "NO"}`;
  console.log(
    [
      "",
      `  ${"rule".padEnd(a)}  ${"fixture".padEnd(b)}  rule on  rule weakened  others still catch`,
      `  ${"-".repeat(a)}  ${"-".repeat(b)}  -------  -------------  -------------------`,
      ...rows.map(line),
      "",
    ].join("\n"),
  );
  expect(rows.every((r) => r.on && !r.off && r.others)).toBe(true);
});

// ---------------------------------------------------------------- helpers

// The cheap direction to be wrong in is a WARN nobody needed; the expensive one
// is a FAIL on good code. These pin the second direction shut.
test.each([
  ['a semver string does not tokenise', 'version: "1.0.0",', []],
  ["a hex colour does not tokenise", 'const c = "#241d9a";', []],
  ["a --fx- seam line is skipped", 'el.style.setProperty("--fx-speed", 0.375);', []],
  ["a whole-line comment is skipped", "// upstream used 0.618 here", []],
  ["an untraced constant is reported", "const ease = 0.618;", [0.618]],
])("%s", (_case, src, want) => {
  expect(untracedNumbers(src, ["nothing upstream"]).map((u) => u.value)).toEqual(want);
});

test("a constant present upstream is not reported", () => {
  expect(untracedNumbers("const a = 0.55;", ["float a = 0.55;"])).toEqual([]);
});

test.each([
  ["Apache", "Apache License\nVersion 2.0, January 2004", "Apache-2.0"],
  ["MIT", "MIT License\n\nPermission is hereby granted, free of charge, to any person", "MIT"],
  ["nothing recognisable", "do what you want", null],
])("detectSpdx reads %s", (_case, text, want) => {
  expect(detectSpdx(text)).toBe(want);
});

// `setUniforms(` is one refactor from a bare /uniform / scan, and a false FAIL
// is how a gate gets switched off.
test("shader plumbing is not mistaken for shader source", () => {
  expect(looksLikeGlsl("shader.setUniforms(uniformsFor(el, settings));")).toBe(false);
  expect(looksLikeGlsl("uniform float u_time;")).toBe(true);
});

test("template literals are found whole, backslashes and splices included", () => {
  expect(templateLiterals("const a = `x${y}z`; const b = `p\\`q`;")).toEqual(["x${y}z", "p\\`q"]);
});

// origin.* is agent-written and the fetched bytes are written to a path built
// from it, so a ".." segment would put that write outside the cache.
test("a traversal in origin.path is refused before anything is fetched", () => {
  expect(safeOrigin({ repo: "a/b", commit: "c", path: "x/y.ts" })).toBe(true);
  expect(safeOrigin({ repo: "a/b", commit: "c", path: ["ok.ts", "../../../etc/passwd"] })).toBe(false);
  expect(safeOrigin({ repo: "../../..", commit: "c", path: "x.ts" })).toBe(false);
  expect(safeOrigin({ repo: "a/b", commit: "c", path: "/etc/passwd" })).toBe(false);
});

// Upstream writes `scale: [.98, 1.04]`; a port writes `0.98`. Same value, and the
// leading-dot form used to tokenise to nothing on the upstream side, so a
// faithful line was reported as an untraced constant. A gate that cries wolf on
// good code gets switched off, which is why this is worth a test of its own.
test("a leading-dot upstream literal traces to its zero-prefixed port", () => {
  expect(untracedNumbers("  scale: [0.98, 1.04],", ["      scale: [.98, 1.04],"])).toEqual([]);
});

test("the leading-dot allowance does not swallow real invention", () => {
  const found = untracedNumbers("  scale: [0.77, 1.04],", ["      scale: [.98, 1.04],"]);
  expect(found.map((u) => u.value)).toEqual([0.77]);
});

test("a dotted version string still tokenises to nothing", () => {
  expect(untracedNumbers('const v = "1.0.0";', [""])).toEqual([]);
});

// Copied GLSL ships two ways and both are legitimate: embedded in a template
// literal in index.js, or as a sibling .frag next to the effect. The sibling
// layout is the better one, because the file IS the upstream bytes rather than a
// reconstruction of them. Reading only index.js failed all eight shader-gallery
// ports whose .frag files matched upstream's sha256 exactly, so the gate now
// reads siblings first. This fixture alters one constant in a sibling and must
// still be caught, or the wider search has quietly disarmed the rule.
test("an altered constant in a sibling .frag is still caught", () => {
  const r = verify("tests/fixtures/bad-frag-sibling-altered");
  expect(r.fails.join("\n")).toContain("copied GLSL differs from upstream");
});

// The deviations-real haystack was index.js, the GLSL diff and the untraced
// constants. A CSS-only port has almost nothing in index.js, so a deviation
// describing a stylesheet change could never be evidenced and warned forever.
// It surfaced on a wave of hover ports: one declared a focus-visible deviation
// and warned, while its sibling declared the same thing and passed only because
// the word "hover" happened to appear in its effect name. That is a coin toss,
// not a check. style.css is in the haystack now.
test("a deviation evidenced only in style.css is accepted", () => {
  const r = verify("tests/fixtures/good-css-deviation");
  expect(r.warns.join("\n")).not.toContain("declared deviation matches nothing");
});

// And the rule still bites: the phantom fixture has no style.css at all, so
// widening the haystack must not have quietly disarmed it.
test("a deviation evidenced nowhere is still caught", () => {
  const r = verify("tests/fixtures/bad-deviation-phantom");
  expect(r.warns.join("\n")).toContain("declared deviation matches nothing");
});

// Not every usable source is a git repository. A public CodePen carries a real
// MIT grant, but it has no commit: the author can edit it at any moment and
// there is no history to fall back on. One pen dependency in the survey batch
// 404'd inside ten months, which is the drift risk made concrete.
//
// So a snapshot origin pins the bytes instead of a revision: we commit the copy
// we ported from and the gate checks its hash. It proves we still ship what we
// ported from, not that upstream still agrees, and that difference is stated in
// the schema rather than glossed.
test("a snapshot pin whose hash matches passes", () => {
  expect(verify("tests/fixtures/good-snapshot-pin").status).toBe("PASS");
});

test("a snapshot pin whose hash has drifted fails", () => {
  const r = verify("tests/fixtures/bad-snapshot-hash");
  expect(r.status).toBe("FAIL");
  expect(r.fails.join("\n")).toContain("but origin.sha256 declares");
});

// The failure that would otherwise be silent: declaring a snapshot and never
// committing the file. The pin would look present and reference nothing.
test("a snapshot pin with no committed file fails", () => {
  const r = verify("tests/fixtures/bad-snapshot-missing");
  expect(r.status).toBe("FAIL");
  expect(r.fails.join("\n")).toContain("pins nothing");
});
