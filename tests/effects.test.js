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

// ---------------------------------------------------------------------------
// The ported effects. Two things are worth a mechanical check across all of
// them, and neither is covered by lint (which reads files, not behaviour):
//
//   1. mount() has to survive being handed nothing. A site generator loops
//      querySelectorAll and mounts what it finds, and one throw there takes the
//      rest of the page's effects with it. Bun has no DOM, so importing the
//      module and calling mount(null) here is a free harness for every guard at
//      once -- and it also proves no module touches the document at import
//      time, which the vendored bundles make easy to get wrong.
//
//   2. `export const meta` has to mirror meta.json. The registry ships
//      meta.json and the browser sees the module's copy, so a drift between
//      them is an effect documented as one thing and behaving as another.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EFFECTS = join(import.meta.dir, "../effects");
const NAMES = readdirSync(EFFECTS);

test.each(NAMES)("%s survives mount(null) and mirrors meta.json", async (name) => {
  const mod = await import(join(EFFECTS, name, "index.js"));
  let handle;
  expect(() => { handle = mod.mount(null); }).not.toThrow();
  expect(typeof handle.update).toBe("function");
  expect(typeof handle.destroy).toBe("function");
  expect(() => { handle.update({}); handle.destroy(); handle.destroy(); }).not.toThrow();

  const json = JSON.parse(readFileSync(join(EFFECTS, name, "meta.json"), "utf8"));
  expect(mod.meta.name).toBe(name);
  for (const key of ["name", "version", "category", "license"]) expect(mod.meta[key]).toEqual(json[key]);
  expect(mod.meta.needs).toEqual(json.needs);
  const defaults = (m) => Object.fromEntries(Object.entries(m.options).map(([k, v]) => [k, v.default]));
  expect(defaults(mod.meta)).toEqual(defaults(json));
});

// The values the port-fidelity gate cares about, read off the upstream files at
// the pinned commits. A wrapper is easy to rewrite and easy to rewrite wrongly;
// this is the table that says which numbers are not ours to change.
test.each([
  // presets/stars/src/options.ts @ ae866a5
  ["starfield", { count: 100, color: "#ffffff", speed: 0.1 }],
  // presets/links/src/options.ts @ ae866a5
  ["links-network", { count: 100, color: "#ffffff", linkDistance: 150 }],
  // examples/onscroll-responsive-scope/index.js @ 01b81be
  ["reveal-stagger", { sync: 0.1, enter: "top", leave: "bottom" }],
  // examples/onscroll-sticky/index.js @ 01b81be
  ["pin-progress", { sync: 0.5, enter: "top top", leave: "bottom bottom" }],
  // examples/text/split-effects/index.js @ 01b81be
  ["split-reveal", { duration: 1500, loopDelay: 75, stagger: 100 }],
  // src/js/typeShuffle.js fx1 @ 8f171f1
  ["scramble", { iterations: 45, tick: 15, lineDelay: 200 }],
  // packages/core/src/lenis.ts constructor @ eea7159
  ["smooth-scroll", { lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1 }],
  // apps/www/registry/magicui/marquee.tsx @ 1246d6d
  ["marquee-css", { duration: "40s", gap: "1rem", pauseOnHover: false }],
])("%s carries upstream's values", async (name, upstream) => {
  const { meta } = await import(join(EFFECTS, name, "index.js"));
  expect(Object.fromEntries(Object.entries(meta.options).map(([k, v]) => [k, v.default]))).toEqual(upstream);
});

// marquee-css is the one port with a guard worth its own test. Its keyframes
// translate by calc(-100% - var(--fx-gap)), which a unitless gap makes an
// invalid declaration -- the row silently parks instead of scrolling. Same for
// a duration without a unit.
test.each([
  ["a bare number", { gap: "16", duration: "40" }, { "--fx-gap": "1rem", "--fx-duration": "40s" }],
  ["a nonsense string", { gap: "wide", duration: "slow" }, { "--fx-gap": "1rem", "--fx-duration": "40s" }],
  ["an injected value", { gap: "1rem);color:red", duration: "40s" }, { "--fx-gap": "1rem", "--fx-duration": "40s" }],
  ["real lengths", { gap: "2.5rem", duration: "12s" }, { "--fx-gap": "2.5rem", "--fx-duration": "12s" }],
  ["zero", { gap: "0", duration: "40s" }, { "--fx-gap": "0", "--fx-duration": "40s" }],
])("marquee-css rejects %s", async (_case, opts, expected) => {
  const { mount: mountMarquee } = await import("../effects/marquee-css/index.js");
  const el = { ...stubEl(), toggleAttribute(k, on) { if (on) this.attrs[k] = ""; else delete this.attrs[k]; } };
  const handle = mountMarquee(el, opts);
  expect(el.style.props).toEqual(expected);
  handle.destroy();
  expect(el.style.props).toEqual({});
  expect(el.attrs["data-fx-live"]).toBeUndefined();
});
