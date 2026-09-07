// Smoke contract: the resting-state gate passes aurora-css, fails a section
// that paints only from script, and is load-bearing while it does it.
//
// The third test is the one that matters. A gate that cannot fail is worse
// than no gate, so the same measurements taken from the blank fixture are run
// back through checkMeasurements with the pixel rule relaxed, and the fixture
// then passes. That is the proof the verdict comes from the pixels and not
// from the box, which the fixture is built to satisfy: it reserves a full
// 1440x900 at desktop and 375x812 at phone width and paints nothing into
// either.
//
// One browser session covers both effects, so the whole file costs about the
// same as a single `bun run smoke`. Measurements are taken once at module
// scope, the way lint.test.js hoists its fixture run, rather than per test.
import { test, expect } from "bun:test";
import { smoke, checkMeasurements } from "../scripts/smoke.mjs";

const fx = (p) => new URL(`../${p}`, import.meta.url).pathname;

const results = await smoke([fx("effects/aurora-css"), fx("tests/fixtures/bad-blank-section")]);
const byName = Object.fromEntries(results.map((r) => [r.name, r]));
const blank = byName["bad-blank-section"];

test("aurora-css passes smoke", () => {
  expect(byName["aurora-css"].errors).toEqual([]);
});

// The exact list, not "some error mentions empty": a fixture that also failed
// its box or its mobile height would prove nothing about the pixel rule.
test("a section that paints only from script fails smoke", () => {
  expect(blank.errors).toEqual([
    "bad-blank-section: section is visually empty at 1440x900 (1 distinct colour(s) sampled, 100% #ffffff)",
  ]);
});

// Controls for that exactness: the blank fixture clears every check except the
// one it is named for.
test("the blank fixture's box and mobile height are the ones that pass", () => {
  expect(blank.measurements.w).toBeGreaterThanOrEqual(200);
  expect(blank.measurements.h).toBeGreaterThanOrEqual(100);
  expect(blank.measurements.mobileH).toBeGreaterThanOrEqual(100);
  expect(blank.measurements.colours).toBe(1);
});

// Mutation test. Weaken the check to "any non-zero bounding box, whatever the
// pixels" and the blank fixture sails through, which is what makes the strict
// version worth having.
test("weakening the pixel rule lets the blank fixture pass", () => {
  expect(checkMeasurements("bad-blank-section", blank.measurements, { minColours: 0 })).toEqual([]);
});

// The harness has to actually be blocking script, or every measurement above
// was taken from a page that mounted itself. The fixture paints a gradient
// from index.js, so this flag being false is what makes its blankness mean
// anything.
test("no page script ran during the capture", () => {
  for (const r of results) expect(r.measurements.jsRan).toBe(false);
});

// The other two branches, against measurements rather than a browser: no live
// effect collapses on a phone or drops its data-fx hook today, and a rule with
// no way to fire is the same false confidence the blank fixture exists to rule
// out.
const painted = { found: true, w: 1440, h: 900, colours: 9000, dominant: "#07070b", dominantShare: 0.2 };

test("a section that collapses at 375 fails even though desktop is fine", () => {
  expect(checkMeasurements("hero", { ...painted, mobileW: 375, mobileH: 0 })).toEqual([
    "hero: section box is 375x0 at 375 wide; a hero that collapses on a phone is the same bug",
  ]);
});

test("a snippet with no data-fx hook fails before anything is measured", () => {
  expect(checkMeasurements("hero", { found: false })).toEqual([
    'hero: snippet.html has no [data-fx="hero"] section to check',
  ]);
});
