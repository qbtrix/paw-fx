// Effect behaviour, as opposed to the repo contract the other two files cover.
// Runs mount() against a stub element rather than a DOM: an effect only ever
// touches setProperty/removeProperty/setAttribute/removeAttribute at this
// level, so a stub keeps the suite dependency-free and honest about what the
// effect actually writes.
import { test, expect } from "bun:test";
import { mount } from "../effects/aurora-css/index.js";

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
