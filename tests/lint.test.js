// Lint contract: aurora-css passes; fixtures fail for exactly the documented
// reasons. Every module specifier form index.js can carry and every non-local
// reference style.css can carry gets a case of its own, alongside the local
// controls -- relative path, "#frag", data: URI -- that must stay unflagged.
//
// The single-purpose fixtures assert an exact error list rather than "some
// error mentions X". A fixture that fails for a second, accidental reason
// proves nothing about the rule it is named for, which is how the header rule
// stayed a no-op: bad-no-origin happens to carry a real header comment.
//
// good-shared-frag is the positive control for the shader.gallery port shape:
// GLSL as its own file plus a "../_shared/<file>" import. Neither rule changed
// to admit it -- the import is relative, and SPDX lines are a licence header --
// so the test is here to pin that it stays true.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { lintEffect } from "../scripts/lint.mjs";
import { validate } from "../scripts/validate.mjs";

const fx = (p) => new URL(`../${p}`, import.meta.url).pathname;
const schema = JSON.parse(readFileSync(fx("schema/meta.schema.json"), "utf8"));

test("aurora-css passes lint", () => {
  expect(lintEffect(fx("effects/aurora-css"))).toEqual([]);
});

test("ported effect without origin fails", () => {
  const errs = lintEffect(fx("tests/fixtures/bad-no-origin"));
  expect(errs.some((e) => e.includes('missing required "origin"'))).toBe(true);
});

// The header rule used to pass any ported effect, because every effect must
// declare `license` in its meta block and the scan matched that line.
test("ported effect with no header comment fails", () => {
  expect(lintEffect(fx("tests/fixtures/bad-no-header"))).toEqual([
    "bad-no-header: ported effect needs an upstream licence header comment in the first 20 lines of index.js",
  ]);
});

test("the header shape ports carry passes, vendor import and all", () => {
  expect(lintEffect(fx("tests/fixtures/good-ported-header"))).toEqual([]);
});

// Control: bad-no-origin carries a real header comment, so the header rule
// must stay quiet on it. Without this, "fails" above could just mean "always".
test("a real header comment is not flagged", () => {
  const errs = lintEffect(fx("tests/fixtures/bad-no-origin"));
  expect(errs.some((e) => e.includes("licence header"))).toBe(false);
});

test("a vendor global read at module scope fails", () => {
  expect(lintEffect(fx("tests/fixtures/bad-global-module-scope"))).toEqual([
    "bad-global-module-scope: index.js reads a vendor global at module scope (`const engine = globalThis.tsParticles;`); read it inside mount()",
  ]);
});

test("the same global read inside mount() passes", () => {
  expect(lintEffect(fx("tests/fixtures/good-vendor-global"))).toEqual([]);
});

// swup is dropped from the project, so it is gone from both gates at once.
test("a needs key the enum and the manifest dropped fails twice", () => {
  expect(lintEffect(fx("tests/fixtures/bad-needs-unknown"))).toEqual([
    "bad-needs-unknown: meta.json $.needs[0]: must be one of anime, three, paper, tsparticles, lenis",
    'bad-needs-unknown: needs "swup", which vendor/manifest.json does not list',
  ]);
});

// The origin carve-out. Listing repo/commit/path under properties.origin made
// the paw-fx branch dead, so originals shipped a placeholder "commit": "".
const meta = (origin) => ({
  name: "probe", version: "1.0.0", category: "backgrounds", tags: [],
  summary: "s", needs: [], options: {}, license: "MIT", origin,
});

test("a paw-fx original needs no commit or path", () => {
  expect(validate(schema, meta({ repo: "paw-fx" }))).toEqual([]);
});

test("a ported effect still needs commit and path", () => {
  expect(validate(schema, meta({ repo: "mrdoob/three.js" }))).toEqual([
    '$.origin: missing required "commit"',
    '$.origin: missing required "path"',
  ]);
});

test("an empty origin is ported, not an original", () => {
  expect(validate(schema, meta({}))).toEqual([
    '$.origin: missing required "repo"',
    '$.origin: missing required "commit"',
    '$.origin: missing required "path"',
  ]);
});

test("bare-specifier import fails", () => {
  const errs = lintEffect(fx("tests/fixtures/bad-bare-import"));
  expect(errs.some((e) => e.includes('bare-specifier import "animejs"'))).toBe(true);
});

const importForms = lintEffect(fx("tests/fixtures/bad-import-forms"));

// The first three rows are the review probe. All three passed the old scan,
// which only ever matched `import ... from "spec"` at the start of a line.
test.each([
  ["side-effect import", "animejs"],
  ["export * re-export", "three"],
  ["dynamic import", "lenis"],
  ["default import", "fx-default"],
  ["named import", "fx-named"],
  ["namespace import", "fx-namespace"],
  ["default + named import", "fx-mixed"],
  ["named re-export", "fx-reexport-named"],
  ["multi-line named import", "fx-multiline"],
])("%s fails lint", (_form, spec) => {
  expect(importForms).toContain(`bad-import-forms: bare-specifier import "${spec}" in index.js`);
});

test("a relative import is not flagged", () => {
  expect(importForms.some((e) => e.includes("./local.js"))).toBe(false);
});

const cssRefs = lintEffect(fx("tests/fixtures/bad-css-external"));

test.each([
  ["@import of a bare specifier", "tailwindcss"],
  ["@import url() over https", "https://fonts.googleapis.com/css2?family=Inter"],
  ["url() over https", "https://cdn.example.com/bg.png"],
  ["url() of a bare specifier", "three/logo.svg"],
  ["protocol-relative url()", "//cdn.example.com/pointer.cur"],
])("%s fails lint", (_form, spec) => {
  expect(cssRefs).toContain(
    `bad-css-external: non-local reference "${spec}" in style.css (a generated site fetches nothing off-site)`,
  );
});

// "%23n" is the url() nested inside the data: URI. A url() scan that stops at
// the first ")" reads it as a second, bare reference and reds aurora-css.
test.each([
  ["relative path", "./mask.svg"],
  ["fragment reference", "#fx-noise"],
  ["data: URI", "data:image"],
  ["url() nested inside a data: URI", "%23n"],
])("a %s in style.css is not flagged", (_form, spec) => {
  expect(cssRefs.some((e) => e.includes(spec))).toBe(false);
});

// A port often spans several upstream files: every paper-design shader splices
// in shader-utils.ts, every vanta effect extends src/_base.js, the marquee needs
// its component plus the globals.css holding its keyframes. Pinning only the
// main file makes the port-fidelity gate read that shared upstream code as
// invention, so origin.path takes a list.
const ported = (over = {}) => ({
  ...meta({ repo: "tengbao/vanta", commit: "a".repeat(40), path: "src/vanta.net.js" }),
  ...over,
});

test("origin.path takes a single file or a list", () => {
  expect(validate(schema, ported())).toEqual([]);
  const many = ported();
  many.origin = { ...many.origin, path: ["src/vanta.net.js", "src/_base.js"] };
  expect(validate(schema, many)).toEqual([]);
});

test("an empty path list is rejected", () => {
  const m = ported();
  m.origin = { ...m.origin, path: [] };
  expect(validate(schema, m).length).toBeGreaterThan(0);
});

// The gate fetches origin.commit verbatim. A branch name resolves to whatever
// upstream moved to since, which is exactly the drift the pin exists to stop.
test("a branch name is not a commit", () => {
  const m = ported();
  m.origin = { ...m.origin, commit: "main" };
  expect(validate(schema, m).length).toBeGreaterThan(0);
});

// An undeclared change to shader source or timing constants is invention and
// fails the gate. Declaring it with a reason is how a necessary change passes.
test("deviations must carry what, why and a known kind", () => {
  const ok = ported();
  ok.deviations = [{ what: "blending: null dropped", why: "already broken at the pinned commit", kind: "upstream-bug" }];
  expect(validate(schema, ok)).toEqual([]);

  const badKind = ported();
  badKind.deviations = [{ what: "x", why: "y", kind: "because-i-said-so" }];
  expect(validate(schema, badKind).length).toBeGreaterThan(0);

  const noWhy = ported();
  noWhy.deviations = [{ what: "x", kind: "ours" }];
  expect(validate(schema, noWhy).length).toBeGreaterThan(0);
});

// The shader.gallery port shape has to pass every rule as written: a shared
// import is relative so the self-contained check accepts it, and the SPDX
// header counts as an upstream licence header.
test("an effect with shader.frag and a shared import passes lint", () => {
  expect(lintEffect(fx("tests/fixtures/good-shared-frag"))).toEqual([]);
});
