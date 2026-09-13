// One directory to serve: the gallery at the root, the machine surface beside it.
//
// These two want different roots and neither is wrong. The gallery is a Paw
// Site built out of paw-fx, so its sections link `/_fx/effects/<name>/...`
// root-absolute, exactly as a real site does -- served from a /gallery/ prefix
// those all miss. The registry (registry.json, items/, e/, llms.txt) is a set
// of files an agent fetches by name and has no such assumption.
//
// So the gallery becomes the root and the registry is laid beside it, rather
// than either one being rewritten to suit the other. `previews/` appears in
// both and merges without collision: the gallery writes .jpg, the registry
// copies .png.
//
// Doing this as an explicit assemble, and not as a rewrite rule in the Worker,
// is deliberate: a redirect would have to behave identically in `wrangler dev`,
// in the local server and on the edge, and this behaves identically everywhere
// because there is nothing to behave.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

export function buildSite(registryDir = join(ROOT, "dist/registry"), out = join(ROOT, "dist/site")) {
  const gallery = join(registryDir, "gallery");
  if (!existsSync(gallery)) throw new Error("dist/registry/gallery is missing; run `bun run gallery` first");

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(gallery, out, { recursive: true });

  // Everything the registry build wrote, minus the gallery it already copied.
  for (const entry of ["registry.json", "llms.txt", "llms-full.txt", "_headers", "items", "e", "previews"]) {
    const src = join(registryDir, entry);
    if (existsSync(src)) cpSync(src, join(out, entry), { recursive: true });
  }
  return out;
}

if (import.meta.main) {
  const out = buildSite();
  console.log(`site -> ${out} (gallery at /, registry beside it)`);
}
