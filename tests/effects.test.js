// Effect behaviour, as opposed to the repo contract the other two files cover.
// Runs mount() against a stub element rather than a DOM: a CSS-only effect
// touches setProperty/removeProperty/setAttribute/removeAttribute and nothing
// else at this level, so a stub keeps the suite dependency-free and honest
// about what the effect actually writes.
//
// A WebGL effect cannot be exercised the same way, and the useful thing to
// assert about one here is the opposite: that running it somewhere with no
// DOM and no WebGL is a quiet fall back to the CSS resting state rather than a
// throw. Bun has neither, which makes this suite a free harness for the guard.
import { test, expect } from "bun:test";
import { mount } from "../effects/aurora-css/index.js";
import { mount as mountMesh } from "../effects/mesh-gradient/index.js";

const stubEl = () => ({
  attrs: {},
  style: {
    props: {},
    setProperty(k, v) { this.props[k] = v; },
    removeProperty(k) { delete this.props[k]; },
  },
  setAttribute(k, v) { this.attrs[k] = v; },
  removeAttribute(k) { delete this.attrs[k]; },
});

const speedFor = (speed) => {
  const el = stubEl();
  mount(el, { speed });
  return el.style.props["--fx-speed"];
};

// style.css divides by --fx-speed, so 0 yields a 1.79769e+308s duration that
// silently freezes the drift and a negative yields 0s. This effect is the
// template 29 ports copy, which is why the clamp lives here.
test.each([
  ["zero", 0, "0.1"],
  ["negative", -1, "0.1"],
  ["absurdly large", 1e9, "10"],
  ["not a number", "fast", "1"],
  ["in range", 2.5, "2.5"],
])("aurora-css clamps a %s speed", (_case, input, expected) => {
  expect(speedFor(input)).toBe(expected);
});

test("update() clamps too, and destroy() clears the property", () => {
  const el = stubEl();
  const handle = mount(el, { speed: 1 });
  handle.update({ speed: 0 });
  expect(el.style.props["--fx-speed"]).toBe("0.1");
  handle.destroy();
  expect(el.style.props["--fx-speed"]).toBeUndefined();
  expect(el.attrs["data-fx-live"]).toBeUndefined();
});

// Every WebGL failure path in mesh-gradient lands in the same catch: no
// WebGL2, a context refused for a major performance caveat, or a parent that
// is not an element. All three have to leave the section exactly as the
// stylesheet drew it, which means a handle whose methods are safe to call and
// no data-fx-live for the CSS to react to. A throw here is a hero section
// replaced by an unhandled error in a site nobody is watching.
test.each([
  ["a stub with no nodeType", () => stubEl()],
  ["null", () => null],
  ["undefined", () => undefined],
])("mesh-gradient falls back to the resting state given %s", (_case, make) => {
  const el = make();
  let handle;
  expect(() => { handle = mountMesh(el, { speed: 1 }); }).not.toThrow();
  expect(typeof handle.update).toBe("function");
  expect(typeof handle.destroy).toBe("function");
  expect(() => { handle.update({ speed: 2 }); handle.destroy(); handle.destroy(); }).not.toThrow();
  if (el) expect(el.attrs["data-fx-live"]).toBeUndefined();
});

// The port's defaults have to be upstream's, not ones that drifted while the
// wrapper was written. These are defaultPreset.params in
// packages/shaders-react/src/shaders/mesh-gradient.tsx at the pinned commit.
test("mesh-gradient meta carries upstream's default preset values", async () => {
  const { meta } = await import("../effects/mesh-gradient/index.js");
  const defaults = Object.fromEntries(Object.entries(meta.options).map(([k, v]) => [k, v.default]));
  expect(defaults).toEqual({
    colors: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"],
    speed: 1,
    distortion: 0.8,
    swirl: 0.1,
    grainMixer: 0,
    grainOverlay: 0,
  });
});
