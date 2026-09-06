// Lint contract: aurora-css passes; fixtures fail for exactly the documented
// reasons. Every module specifier form index.js can carry and every non-local
// reference style.css can carry gets a case of its own, alongside the local
// controls -- relative path, "#frag", data: URI -- that must stay unflagged.
import { test, expect } from "bun:test";
import { lintEffect } from "../scripts/lint.mjs";

const fx = (p) => new URL(`../${p}`, import.meta.url).pathname;

test("aurora-css passes lint", () => {
  expect(lintEffect(fx("effects/aurora-css"))).toEqual([]);
});

test("ported effect without origin fails", () => {
  const errs = lintEffect(fx("tests/fixtures/bad-no-origin"));
  expect(errs.some((e) => e.includes('missing required "origin"'))).toBe(true);
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
