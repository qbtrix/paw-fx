// Compile gate for the generated `svelte` target. Proves the claim the targets
// shape rests on: that mount(el, opts) -> {update, destroy} really does port to
// a build-step engine, and that the 98 generated components are valid Svelte 5
// rather than plausible-looking text.
//
// WHY THIS IS NOT IN `bun run check`. paw-fx ships zero dependencies, and the
// effects themselves must keep shipping zero, so the Svelte compiler is not a
// devDependency here. It is resolved from a sibling checkout that already has
// one (paw-enterprise, ripple) or from PAW_FX_SVELTE_ROOT. That makes this an
// on-demand gate a human or CI runs with a compiler available, not part of the
// dependency-free default. If no compiler is found this EXITS 1 and says so --
// it never reports green by skipping, because a gate that passes when it did
// not run is worse than no gate.
//
// It compiles only. It does not render, so it proves the component is valid and
// its lifecycle wiring parses -- not that the effect looks right in Svelte.
// Rendering needs a real Svelte app and belongs with the smoke gate, not here.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const WS = join(ROOT, "..");

const CANDIDATES = [
  process.env.PAW_FX_SVELTE_ROOT,
  join(WS, "paw-enterprise"),
  join(WS, "ripple"),
  join(WS, "..", "paw-enterprise"),
  join(WS, "..", "ripple"),
].filter(Boolean);

function findCompiler() {
  for (const root of CANDIDATES) {
    for (const rel of ["node_modules/svelte/compiler/index.js", "node_modules/svelte/src/compiler/index.js"]) {
      const p = join(root, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const compilerPath = findCompiler();
if (!compilerPath) {
  console.error("verify:svelte needs a Svelte compiler and found none.");
  console.error("Set PAW_FX_SVELTE_ROOT to a checkout whose node_modules has svelte, or install one in a sibling repo.");
  console.error(`Looked in:\n  ${CANDIDATES.join("\n  ")}`);
  process.exit(1);
}

const mod = await import(pathToFileURL(compilerPath).href);
const compile = mod.compile ?? mod.default?.compile;
const VERSION = mod.VERSION ?? mod.default?.VERSION ?? "unknown";
if (typeof compile !== "function") {
  console.error(`verify:svelte: ${compilerPath} exposes no compile()`);
  process.exit(1);
}

const itemsDir = join(ROOT, "dist/registry/items");
if (!existsSync(itemsDir)) {
  console.error("verify:svelte: dist/registry/items missing -- run `bun run build` first");
  process.exit(1);
}

const fails = [];
let compiled = 0;
let warned = 0;
const byCode = new Map();

for (const f of readdirSync(itemsDir).filter((f) => f.endsWith(".json")).sort()) {
  const item = JSON.parse(readFileSync(join(itemsDir, f), "utf8"));
  const target = item.targets?.svelte;
  if (!target) continue;
  for (const file of target.files) {
    try {
      const res = compile(file.content, { filename: file.path, generate: "client" });
      compiled++;
      // A warning here is a real signal: the generator emits one shape for all
      // 98, so a warning on one is a warning on the template itself.
      for (const w of res.warnings ?? []) {
        warned++;
        byCode.set(w.code ?? "unknown", (byCode.get(w.code ?? "unknown") ?? 0) + 1);
      }
    } catch (e) {
      fails.push(`${item.name} (${file.path}): ${e.message?.split("\n")[0] ?? e}`);
    }
  }
}

if (fails.length) {
  console.error(`svelte: ${fails.length} of ${compiled + fails.length} component(s) FAILED to compile`);
  for (const m of fails) console.error(`  ${m}`);
  process.exit(1);
}
// Warnings are grouped, not listed: the generator emits ONE shape for all 98,
// so a code appearing 98 times is one fact about the template, not 98 facts.
// a11y_invalid_attribute comes from the snippets' own placeholder href="#"
// CTAs, which is a property of the markup the html target already ships, not
// of the Svelte wrapper.
if (byCode.size) {
  console.log(`  warnings by code: ${[...byCode].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} x${n}`).join(", ")}`);
}
console.log(`svelte ok: ${compiled} component(s) compile against svelte ${VERSION}${warned ? ` (${warned} warning(s))` : ""}`);
