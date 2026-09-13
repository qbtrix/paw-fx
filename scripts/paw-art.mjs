// paw-art: a drawing on disk -> the art block, printed.
//
// The work is in ./art-from-svg.mjs, which is pure so the bring-your-own
// -mascot page can run the identical derivation on a file someone drops into
// a browser. This is the part that needs a filesystem and a terminal.
//
//   bun scripts/paw-art.mjs mascot.svg            print the art block
//   bun scripts/paw-art.mjs mascot.svg --json     print it as JSON
import { readFileSync } from "node:fs";
import { artFromSvg, artBlock, SAMPLES } from "./art-from-svg.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: bun scripts/paw-art.mjs <mascot.svg> [--json]");
  process.exit(2);
}

const { art, reports, warn, reach } = artFromSvg(readFileSync(file, "utf8"), file);

for (const r of reports) {
  if (r.rays === 0) console.error(`  ok    ${r.name}: star-shaped, every ray leaves once`);
  else
    console.error(
      `  LOST  ${r.name}: ${r.rays}/${SAMPLES} rays cross the outline twice, ` +
        `up to ${r.pct.toFixed(1)}% of that ray flattened. The engine will draw over the dent.`
    );
}
for (const w of warn) console.error(`  warn  ${w}`);
console.error(`  info  widest point is ${reach.toFixed(2)} head half-widths`);
console.error("");

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(art, null, 2));
} else {
  console.log(artBlock(art));
}
