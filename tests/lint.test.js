// Lint contract: aurora-css passes; fixtures fail for exactly the documented reasons.
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
