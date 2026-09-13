// paw-avatar's engine, tested the way upstream tests its own: the sampler is
// a pure function of time, so every assertion here is about what sample(t)
// returns and none of it needs a DOM.
//
// The three that matter: determinism (the property the whole design buys),
// the mid-fade frame differing from both endpoints (the fade is real, not a
// swap at the halfway mark), and nothing leaving the viewBox (an ear swung
// out is the only geometry that can, and the margin is hand-set).
import { test, expect } from "bun:test";
import { PawEngine, STATE_IDS, restingPath, restingMarkup, compileArt, PAW_ART, moodPose, MOOD_PRESETS } from "../effects/paw-avatar/index.js";
import { BLIP_ART } from "./fixtures/art/blip-bot.js";
const numbers = (d) => d.match(/-?\d+(?:\.\d+)?/g).map(Number);

test("16 states, each with a drawable outline", () => {
  expect(STATE_IDS).toHaveLength(16);
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
  const mid = e.sample(0.2, false).glyphs.zzz.o;
  const settled = e.sample(5, false).glyphs.zzz.o;
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(settled);
  // a glyph no state asks for is absent, not drawn at zero
  expect(e.sample(5, false).glyphs.hearts).toBeUndefined();
});

test("a glyph carries its own motion, frozen for a resting frame", () => {
  // Drifting upward belongs to a "zzz", not to being asleep, so the loop is
  // authored on the glyph and reads absolute time.
  const e = new PawEngine("sleeping");
  expect(e.sample(1).glyphs.zzz.m).not.toBe(e.sample(2.4).glyphs.zzz.m);
  expect(e.sample(1).glyphs.zzz.m).toBe(e.sample(1).glyphs.zzz.m);
  // alive: false holds the loop at its starting phase, which is what the
  // snippet bakes -- a moving glyph would bake a different frame every build
  expect(e.sample(3, false).glyphs.zzz.m).toBe(e.sample(9, false).glyphs.zzz.m);
});

test("the ears leave late and swing past", () => {
  // Upstream measured no overshoot on its body, correctly for a blob. Ears
  // have mass: without the lag every state change moved head and ears in the
  // same instant and the character read as rigid.
  //
  // idle -> focused is the pair that isolates it: focused changes the ears
  // and the eyes and nothing else, so the ear outline cannot move for any
  // other reason (a state that also tilts the head carries the ears with it).
  const reach = (d) => Math.max(...numbers(d).filter((_, i) => i % 2 === 0));

  const e = new PawEngine("idle");
  const rest = e.sample(0, false).earRPath;
  e.setState("focused", 0);

  // the head is already moving while the ear has not left yet
  expect(e.sample(0.02, false).earRPath).toBe(rest);
  expect(e.sample(0.02, false).eyes[0].d).not.toBe(new PawEngine("idle").sample(0, false).eyes[0].d);

  const settled = e.sample(9, false).earRPath;
  expect(settled).not.toBe(rest);
  // and somewhere in the middle it goes further than where it ends up
  const past = [0.22, 0.26, 0.3, 0.34].map((t) => reach(e.sample(t, false).earRPath));
  expect(Math.min(...past)).toBeLessThan(reach(settled));
});

test.each([
  ["the Paw", PAW_ART],
  ["another mascot entirely", BLIP_ART]
])("nothing leaves the viewBox for %s, ears included", (_name, art) => {
  // The box is derived from the drawing and the swings the state table asks
  // for, so a mascot with longer ears gets a wider one rather than clipping.
  const box = compileArt(art).box;
  for (const id of STATE_IDS) {
    const e = new PawEngine(id, art);
    for (const t of [0, 0.3, 1, 4]) {
      const f = e.sample(t);
      for (const d of [f.bodyPath, f.earLPath, f.earRPath]) {
        for (const n of numbers(d)) expect(Math.abs(n)).toBeLessThan(box);
      }
    }
  }
});

test("the engine holds no opinion about the character", () => {
  // Every state, on a mascot with a square skull and upright blade ears.
  // If this passes, the drawing really is an input and not a decoration.
  for (const id of STATE_IDS) {
    const f = new PawEngine(id, BLIP_ART).sample(0, false);
    for (const d of [f.bodyPath, f.earLPath, f.earRPath]) {
      expect(d.startsWith("M")).toBe(true);
      expect(numbers(d).every(Number.isFinite)).toBe(true);
    }
  }
  const blip = new PawEngine("idle", BLIP_ART).sample(0, false);
  const paw = new PawEngine("idle", PAW_ART).sample(0, false);
  expect(blip.bodyPath).not.toBe(paw.bodyPath);
  // its eye is a different size, and the states ask in multiples, not units
  expect(blip.eyes[0].d).not.toBe(paw.eyes[0].d);
  // and it brings its own material, not the Paw's
  const markup = restingMarkup("idle", "b", BLIP_ART);
  expect(markup).toContain("#3a2410");
  expect(markup).not.toContain("#152033");
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

test("the spectrum rim travels, and only where a state asks for it", () => {
  // The hue travels on the engine's clock, not on CSS keyframes: a second
  // clock would drift out of step with pause, scrub and the baked frame.
  const e = new PawEngine("creative");
  expect(e.sample(1).rainbow).toBe(1);
  expect(e.sample(1).spectrum).not.toBe(e.sample(2).spectrum);
  // and it is a function of time like everything else
  expect(e.sample(1).spectrum).toBe(e.sample(1).spectrum);
  expect(new PawEngine("idle").sample(1).rainbow).toBe(0);
  // resting frames hold still, so the snippet bakes one angle
  expect(e.sample(3, false).spectrum).toBe(0);
});

test("lifted decoration inherits the root the drawing was written against", () => {
  // An SVG root is conventionally `<svg fill="none">`, so a highlight that is
  // stroked and never filled carries no fill of its own. Lift it out of its
  // file without that context and it fills black, painting a dark shape
  // exactly where the shine was. This is how the Paw lost its sheen once.
  const svg = restingMarkup("idle", "s");
  const sheen = svg.slice(svg.indexOf("fx-paw-clip-body-s"));
  expect(sheen).toMatch(/<g fill="none" transform=/);
  expect(svg).toMatch(/class="fx-paw-ground" fill="none"/);
});

test("every corner of the mood space is a drawable face", () => {
  for (const valence of [-1, 1]) {
    for (const arousal of [0, 1]) {
      for (const attention of [0, 1]) {
        const e = new PawEngine("idle");
        e.setMood({ valence, arousal, attention }, 0);
        const f = e.sample(5, false);
        for (const d of [f.bodyPath, f.earLPath, f.earRPath]) {
          expect(numbers(d).every(Number.isFinite)).toBe(true);
        }
        expect(f.eyes.length).toBe(2);
      }
    }
  }
});

test("each axis moves the thing it is supposed to, and not the others", () => {
  // An axis that quietly nudges everything is impossible to tune and
  // impossible to read back, so the mapping gives each one a job.
  const at = (m) => moodPose(m, 0);
  const base = { valence: 0, arousal: 0.5, attention: 0.5 };

  // arousal owns eye height
  expect(at({ ...base, arousal: 0.9 }).eyes[0].h).toBeGreaterThan(at({ ...base, arousal: 0.1 }).eyes[0].h);
  // attention owns eye width, and leaves height alone
  const wide = at({ ...base, attention: 1 });
  const narrow = at({ ...base, attention: 0 });
  expect(wide.eyes[0].w).toBeGreaterThan(narrow.eyes[0].w);
  expect(wide.eyes[0].h).toBe(narrow.eyes[0].h);
  // attention is also how much the gaze stays put
  expect(wide.wander).toBeLessThan(narrow.wander);
  // valence tips the ears: up when it is going well, down when it is not
  expect(at({ ...base, valence: 1 }).ears.l.angle).toBeLessThan(at({ ...base, valence: -1 }).ears.l.angle);
  // and mirrors the eye tilt, which is what separates an expression from a head roll
  const sad = at({ ...base, valence: -1 });
  expect(sad.eyes[0].tilt).toBe(-sad.eyes[1].tilt);
  expect(sad.eyes[0].tilt).toBeLessThan(0);
});

test("low arousal closes the lids rather than shortening the eye", () => {
  // Modelling drowsiness as a very short eye looked like a squint, which
  // reads as effort -- the opposite of what it should say.
  expect(moodPose({ valence: 0, arousal: 0, attention: 0.5 }).eyes[0].open).toBeLessThan(0.1);
  expect(moodPose({ valence: 0, arousal: 0.5, attention: 0.5 }).eyes[0].open).toBe(1);
});

test("a mood fades in like a state, and a state can take over again", () => {
  const e = new PawEngine("idle");
  const idle = e.sample(2, false).earLPath;
  e.setMood({ valence: -0.9, arousal: 0.1, attention: 0.2 }, 2);
  const settled = e.sample(9, false).earLPath;
  expect(settled).not.toBe(idle);
  const mid = e.sample(2.3, false).earLPath;
  expect(mid).not.toBe(idle);
  expect(mid).not.toBe(settled);
  // and it is still a pure function of time
  expect(e.sample(2.3, false).earLPath).toBe(mid);
  e.setState("excited", 10);
  expect(e.state).toBe("excited");
  expect(e.sample(14, false).earLPath).not.toBe(settled);
});
