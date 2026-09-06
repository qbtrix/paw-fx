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
//
// The last test in the file is the cheapest one here and covers every effect:
// `export const meta` in index.js and meta.json describe the same effect, so
// they have to agree. Importing an effect module under Bun is also, by itself,
// the check that nothing in it touches the DOM at import time.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { mount } from "../effects/aurora-css/index.js";
import { mount as mountMesh } from "../effects/mesh-gradient/index.js";
import { effectDirs } from "../scripts/lint.mjs";

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

const EFFECTS = join(import.meta.dir, "../effects");
// Underscore-prefixed entries are shared machinery, not effects: effects/_shared/
// holds the WebGL runtime the shader-gallery ports have in common and has no
// index.js to import. Same rule the lint, build and smoke walks use.
const NAMES = readdirSync(EFFECTS).filter((d) => !d.startsWith("_"));

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

// index.js carries `export const meta` and meta.json carries the same thing; the
// registry serves the JSON while the browser runs the module, so a value that
// drifts between them is documentation the effect does not obey. Three of the
// ports drifted exactly this way while their uniforms were being tuned -- the
// module said one preset, the JSON still described the one before it -- and
// nothing caught it, because every other check reads one file or the other.
test.each(effectDirs().map((d) => [basename(d), d]))("%s: index.js meta agrees with meta.json", async (name, dir) => {
  const { meta } = await import(join(dir, "index.js"));
  const json = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  expect(meta.name).toBe(json.name);
  expect(meta.version).toBe(json.version);
  expect(meta.category).toBe(json.category);
  expect(meta.license).toBe(json.license);
  expect(meta.needs).toEqual(json.needs);
  expect(Object.keys(meta.options).sort()).toEqual(Object.keys(json.options).sort());
  for (const [key, opt] of Object.entries(meta.options)) {
    expect([name, key, opt.default]).toEqual([name, key, json.options[key].default]);
    expect([name, key, opt.type]).toEqual([name, key, json.options[key].type]);
  }
});
// fx-5c: three Vanta ports, a Magic UI cursor port, and two natives.
// ---------------------------------------------------------------------------

// Same guard mesh-gradient has, for the same reason: Bun has neither a DOM nor
// WebGL, which makes this suite a free harness for the failure path nobody on
// the team ever sees. It also proves `import * as THREE from
// "../../vendor/three.module.js"` is safe at import time -- three is 2 MB of
// module-scope work and a port that threw on import would take the whole page
// down, not just the hero.
test.each(["vanta-net", "vanta-waves", "vanta-globe"])(
  "%s falls back to the resting state with no DOM and no WebGL",
  async (name) => {
    const { mount: m } = await import(`../effects/${name}/index.js`);
    for (const el of [stubEl(), null, undefined]) {
      let handle;
      expect(() => { handle = m(el, {}); }).not.toThrow();
      expect(typeof handle.update).toBe("function");
      expect(() => { handle.update({ color: "#fff" }); handle.destroy(); handle.destroy(); }).not.toThrow();
      if (el) expect(el.attrs["data-fx-live"]).toBeUndefined();
    }
  },
);

// The three.js migrations, pinned as text, because every one of them fails
// SILENTLY if it is ever "restored" to upstream's spelling:
//   - THREE.VertexColors reads back undefined on 0.185.1, which switches
//     per-vertex colour off without throwing. Measured in the browser, the
//     mean of vanta-net's brightest 1% of pixels goes from #dd4193 (the
//     effect's own pink, R/G 3.40) to #e4e2e6 (white, R/G 1.01).
//   - Without the PI scale and decay 0, vanta-waves renders exactly ONE
//     distinct colour: a flat, ambient-only plate with no specular at all.
//   - blending: null raises "Invalid blending" at upstream's own pinned
//     commit, so it is a bug there rather than a version break.
test.each([
  ["vanta-net", true],
  ["vanta-waves", false],
  ["vanta-globe", true],
])("%s keeps the three.js migrations that fail silently", (name, hasVertexColors) => {
  const src = readFileSync(new URL(`../effects/${name}/index.js`, import.meta.url), "utf8");
  // Comments stripped first. Both files quote the old spelling verbatim while
  // explaining why it cannot be used, so a raw scan matches the explanation.
  const code = src.replace(/^\s*\/\/.*$/gm, "");
  expect(code).not.toMatch(/vertexColors:\s*THREE\.VertexColors/);
  expect(code).not.toMatch(/blending:\s*null/);
  expect(code).toMatch(/(?:Ambient|Point|Spot)Light\(0xffffff, [\d.]+ \* Math\.PI\)/);
  expect(code).toMatch(/\.decay = 0;/);
  if (hasVertexColors) expect(code).toContain("vertexColors: true");
  const meta = JSON.parse(readFileSync(new URL(`../effects/${name}/meta.json`, import.meta.url), "utf8"));
  expect(meta.deviations.filter((d) => d.kind === "api-migration").length).toBeGreaterThanOrEqual(3);
  expect(meta.origin.path).toContain("src/_base.js");
});

// Upstream hides the spotlight by parking it a full radius outside the card,
// never by fading it -- the wash's opacity is constant, because magic-card.tsx
// sets it inline and an inline style beats the Tailwind hover classes. Losing
// that would leave the gradient frozen wherever the pointer last was.
test("cursor-spotlight parks the gradient off the card at rest and after a resize", async () => {
  const { mount: mSpot } = await import("../effects/cursor-spotlight/index.js");
  const el = stubEl();
  const handle = mSpot(el, {});
  expect(el.style.props["--fx-x"]).toBe("-200px");
  expect(el.style.props["--fx-y"]).toBe("-200px");
  expect(el.style.props["--fx-size"]).toBe("200px");
  handle.update({ gradientSize: 340 });
  expect(el.style.props["--fx-size"]).toBe("340px");
  expect(el.style.props["--fx-x"]).toBe("-340px");
  handle.destroy();
  expect(el.style.props["--fx-x"]).toBeUndefined();
});

// style.css multiplies every keyframe offset by --fx-travel, so an unclamped
// value throws the layers clean out of the section and a negative one inverts
// the depth order: the near ridge would move slower than the sky.
test.each([
  ["negative", -2, "0"],
  ["absurdly large", 99, "3"],
  ["not a number", "deep", "1"],
  ["in range", 0.4, "0.4"],
])("scroll-parallax clamps a %s travel", async (_case, input, expected) => {
  const { mount: mPara } = await import("../effects/scroll-parallax/index.js");
  const el = stubEl();
  mPara(el, { travel: input });
  expect(el.style.props["--fx-travel"]).toBe(expected);
});

// page-fade writes its knobs to document.documentElement, because the
// ::view-transition pseudo tree inherits from :root and never from the
// section. With no document at all it has to be a quiet no-op.
test("page-fade is a no-op where there is no document", async () => {
  const { mount: mFade } = await import("../effects/page-fade/index.js");
  const el = stubEl();
  let handle;
  expect(() => { handle = mFade(el, { duration: "1s" }); }).not.toThrow();
  expect(() => { handle.update({ duration: "2s" }); handle.destroy(); }).not.toThrow();
  expect(el.attrs["data-fx-live"]).toBeUndefined();
});
