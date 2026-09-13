// Serve dist/site the way the Worker will, so a local look is the real
// thing and not an approximation.
//
// Cloudflare applies the generated _headers; a plain static server does not,
// and the difference is not cosmetic: without them .md and .txt go out as
// octet-stream and a browser downloads llms.txt instead of showing it. That
// is exactly the class of thing you want to find locally, so this reads the
// same _headers file rather than hardcoding a second copy of the rules.
//
//   bun scripts/serve-registry.mjs [--port 8788]
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = join(ROOT, "dist/site");
const i = process.argv.indexOf("--port");
const port = i > 0 ? Number(process.argv[i + 1]) : 8788;

if (!existsSync(DIR)) {
  console.error("dist/site is missing. Run `bun run site` first.");
  process.exit(1);
}

/** _headers, as rules in file order: [glob, {header: value}]. */
function rules() {
  const file = join(DIR, "_headers");
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ") && !line.startsWith("\t")) out.push([line.trim(), {}]);
    else if (out.length) {
      const [k, ...v] = line.trim().split(":");
      out[out.length - 1][1][k.trim()] = v.join(":").trim();
    }
  }
  return out;
}
const RULES = rules();
const matches = (glob, path) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(path);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".frag": "text/plain; charset=utf-8"
};

Bun.serve({
  port,
  fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    let file = join(DIR, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!file.startsWith(DIR) || !existsSync(file)) return new Response("not found", { status: 404 });
    const headers = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" };
    for (const [glob, h] of RULES) if (matches(glob, path)) Object.assign(headers, h);
    return new Response(readFileSync(file), { headers });
  }
});

console.log(`registry on http://localhost:${port}`);
console.log(`  /llms.txt          the agent index`);
console.log(`  /                  the browsable gallery`);
console.log(`  /e/paw-avatar.md   one effect, as an agent reads it`);
