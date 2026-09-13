// paw-avatar's engine, tested the way upstream tests its own: the sampler is
// a pure function of time, so every assertion here is about what sample(t)
// returns and none of it needs a DOM.
//
// The three that matter: determinism (the property the whole design buys),
// the mid-fade frame differing from both endpoints (the fade is real, not a
// swap at the halfway mark), and nothing leaving the viewBox (an ear swung
// out is the only geometry that can, and the margin is hand-set).
import { test, expect } from "bun:test";
import { PawEngine, STATE_IDS, restingPath, restingMarkup } from "../effects/paw-avatar/index.js";

const HALF_BOX = 197;
const numbers = (d) => d.match(/-?\d+(?:\.\d+)?/g).map(Number);

test("15 states, each with a drawable outline", () => {
  expect(STATE_IDS).toHaveLength(15);
  for (const id of STATE_IDS) {
    const f = new PawEngine(id).sample(0, false);
    for (const d of [f.bodyPath, f.earLPath, f.earRPath]) {
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      expect(numbers(d).every(Number.isFinite)).toBe(true);
    }
  }
});

test("sample(t) is a pure function of time", () => {
  const e = new PawEngine("idle");
  e.setState("thinking", 1);
  const a = e.sample(1.9);
  const b = e.sample(1.9);
  expect(a.bodyPath).toBe(b.bodyPath);
  expect(a.eyes[0].matrix).toBe(b.eyes[0].matrix);
  // and re-reading a past date after reading a later one gives it back
  e.sample(40);
  expect(e.sample(1.9).bodyPath).toBe(a.bodyPath);
});

test("a mid-fade frame is neither endpoint", () => {
  const e = new PawEngine("idle");
  const from = e.sample(1, false).bodyPath;
  e.setState("sad", 1);
  const mid = e.sample(1.27, false).bodyPath;
  const to = e.sample(9, false).bodyPath;
  expect(mid).not.toBe(from);
  expect(mid).not.toBe(to);
});

test("glyphs cross in opacity rather than appearing whole", () => {
  const e = new PawEngine("idle");
  e.setState("sleeping", 0);
  const mid = e.sample(0.2, false).glyphs.zzz;
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
  expect(e.sample(5, false).glyphs.zzz).toBe(1);
});

test("a state change landing mid-fade starts from what is on screen", () => {
  // Without the frozen departure pose the engine's single history slot makes
  // this jump back to the full previous state. Measured as a distance between
  // the frame before the change and the frame just after it.
  const first = (d) => numbers(d).slice(0, 2);
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const e = new PawEngine("idle");
  e.setState("celebrating", 0);
  const before = first(e.sample(0.1, false).bodyPath);
  e.setState("idle", 0.1);
  const after = first(e.sample(0.1, false).bodyPath);
  expect(gap(before, after)).toBeLessThan(1);
});

test("nothing leaves the viewBox, ears included", () => {
  for (const id of STATE_IDS) {
    const e = new PawEngine(id);
    for (const t of [0, 0.3, 1, 4]) {
      const f = e.sample(t);
      for (const d of [f.bodyPath, f.earLPath, f.earRPath]) {
        for (const n of numbers(d)) expect(Math.abs(n)).toBeLessThan(HALF_BOX);
      }
    }
  }
});

test("the resting markup carries the resting frame", () => {
  // snippet.html is built from this, and lint requires the section to look
  // finished with CSS only -- which is only true if the geometry is baked.
  const svg = restingMarkup("idle", "t");
  expect(svg).toContain(restingPath("idle"));
  expect(svg).not.toContain('d=""');
});

test("the gaze follows a look target and releases back", () => {
  const e = new PawEngine("idle");
  const rest = e.sample(2, false).eyes[0].matrix;
  e.setLook({ yaw: 27, pitch: -12, mix: 1, wander: 0.15 }, 2);
  const held = e.sample(3, false).eyes[0].matrix;
  expect(held).not.toBe(rest);
  // catching up, so a frame inside the morph is neither end
  const mid = e.sample(2.1, false).eyes[0].matrix;
  expect(mid).not.toBe(rest);
  expect(mid).not.toBe(held);
  e.setLook(null, 3);
  expect(e.sample(6, false).eyes[0].matrix).toBe(rest);
});

test("a non-finite look target is refused, not propagated", () => {
  // A getBoundingClientRect on a zero-sized box gives 0/0. One NaN reaching
  // the engine would poison every later frame.
  const e = new PawEngine("idle");
  e.setLook({ yaw: 20, pitch: 0, mix: 1, wander: 0.2 }, 0);
  const good = e.sample(2, false).eyes[0].matrix;
  e.setLook({ yaw: NaN, pitch: 0, mix: 1, wander: 0.2 }, 2);
  expect(e.sample(4, false).eyes[0].matrix).toBe(good);
});
