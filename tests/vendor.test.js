// Vendor directory contract: vendor/manifest.json and the files in vendor/
// must agree in both directions. Every declared file exists and is non-empty,
// and nothing sits in vendor/ that the manifest does not claim.
//
// The two directions catch different failures, which is why both are here.
// A dangling key (declared, not present) reaches a site as a build error at
// best and a 404 inside a generated site at worst; the build already throws on
// it, but only for a `needs` key some effect actually uses, so a vendor bump
// that drops a file no shipped effect needs yet passes the whole suite. An
// orphan file (present, not declared) is the reverse: dead weight nobody can
// import, and the shape a half-finished bump leaves behind.
//
// swup is deliberately absent, not missing: every ES module build it publishes
// carries unresolvable bare specifiers, so it was dropped from the manifest and
// from vendor/, and page transitions use the native View Transitions API.
// The orphan half of this test is what keeps a stray Swup.modern.js from
// drifting back in unnoticed.
import { test, expect } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const VENDOR = join(ROOT, "vendor");
const manifest = await Bun.file(join(VENDOR, "manifest.json")).json();

// manifest.json describes the directory; PROVENANCE.md records where the bytes
// came from. Neither is vendored code, so neither is declared by a key.
const NOT_VENDORED_CODE = new Set(["manifest.json", "PROVENANCE.md"]);

const declared = Object.entries(manifest).flatMap(([key, entry]) =>
  [...entry.files, ...entry.licenseFiles].map((file) => [key, file]),
);

test.each(declared)("vendor/manifest.json key %s declares %s, which is present and non-empty", (_key, file) => {
  const path = join(VENDOR, file);
  expect(statSync(path).size).toBeGreaterThan(0);
});

test("every file in vendor/ is declared by a manifest key", () => {
  const orphans = readdirSync(VENDOR).filter(
    (f) => !NOT_VENDORED_CODE.has(f) && !declared.some(([, file]) => file === f),
  );
  expect(orphans).toEqual([]);
});

// Not a filename check for its own sake: three.module.js re-exports from the
// sibling path "./three.core.js" and a generated site has no build step to
// rewrite it, so renaming either file breaks three at runtime and nowhere else.
test("three.module.js still hard-codes the ./three.core.js sibling path", async () => {
  const src = await Bun.file(join(VENDOR, "three.module.js")).text();
  expect(src).toContain("./three.core.js");
  expect(manifest.three.files).toContain("three.core.js");
});

// The exports each vendored file is carried for. A bump that silently renames
// or drops one of these is a broken effect, not a broken build.
test.each([
  ["paper.js", ["ShaderMount", "meshGradientFragmentShader"]],
  ["anime.esm.js", ["animate", "onScroll"]],
])("%s exports %s", async (file, names) => {
  const mod = await import(join(VENDOR, file));
  for (const name of names) expect(typeof mod[name]).not.toBe("undefined");
});
