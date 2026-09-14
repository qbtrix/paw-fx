// The agent-facing face of the registry: llms.txt, one page per effect, and
// one file with everything in it.
//
// paw-fx already emits what a consumer needs -- dist/registry/items/<name>.json
// carries the summary, the options, the snippet, the usage and the file
// contents. What it did not have was a shape a person or an agent can READ
// without parsing JSON. This writes that shape from the same build, so the
// docs cannot drift from the registry: there is nothing to keep in sync.
//
// Three outputs, three readers:
//
//   llms.txt        the llmstxt.org convention: a short index an agent fetches
//                   first, one line per effect, grouped by shelf. Small on
//                   purpose -- it is the map, not the territory.
//   e/<name>.md     one effect, everything needed to use it: what it is, its
//                   options, the markup, the install line. This is also the
//                   "copy for an agent" block the gallery hands out, which is
//                   why it is a file and not a string built in the browser.
//   llms-full.txt   every effect page concatenated, for an agent that would
//                   rather spend one fetch than ninety-nine.
//
// BASE URL. Links have to be absolute, because an agent reading llms.txt from
// a chat window has no page to resolve against. The default points at the
// repo's raw files, which works the moment the repo is public and needs no
// hosting decision; pass --base to point at a CDN or a custom domain.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DEFAULT_BASE = "https://paw-fx.workers.dev";

/** The shelves, in the order a reader should meet them. */
const SHELF = {
  backgrounds: "Backgrounds",
  "3d-hero": "3D heroes",
  particles: "Particles",
  text: "Text",
  scroll: "Scroll",
  transition: "Transitions",
  menu: "Menus and navigation",
  gallery: "Galleries",
  cursor: "Cursor",
  character: "Characters"
};

const esc = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** One effect, as everything a reader needs and nothing they do not. */
export function effectPage(item, base) {
  const deps = item.needs.length ? item.needs.join(", ") : "none";
  const opts = Object.entries(item.options ?? {});
  const lines = [
    `# ${item.name}`,
    "",
    `> ${esc(item.summary)}`,
    "",
    `**Shelf** ${item.category} · **Licence** ${item.license} · **Dependencies** ${deps}`,
    ""
  ];

  if (item.origin?.repo && item.origin.repo !== "paw-fx") {
    lines.push(
      `Ported from [${item.origin.repo}](https://github.com/${item.origin.repo}) at \`${String(item.origin.commit).slice(0, 7)}\`.`,
      ""
    );
  } else if (item.origin?.url) {
    lines.push(`Ported from ${item.origin.url}, retrieved ${item.origin.retrieved}.`, "");
  }

  if (opts.length) {
    lines.push("## Options", "", "| option | type | default | what it does |", "| --- | --- | --- | --- |");
    for (const [k, v] of opts) {
      lines.push(`| \`${k}\` | ${v.type} | \`${JSON.stringify(v.default)}\` | ${esc(v.description)} |`);
    }
    lines.push("");
  }

  lines.push(
    "## Add it to a page",
    "",
    "```html",
    item.targets.html.usage,
    "```",
    "",
    "The section markup, which looks finished with CSS alone before the module loads:",
    "",
    "```html",
    item.targets.html.snippet.trim(),
    "```",
    "",
    "## Files it needs",
    "",
    ...item.files.map((f) => `- \`${f.path}\``),
    "",
    "## Install",
    "",
    "```bash",
    `npx shadcn@latest add ${base}/items/${item.name}.json`,
    "```",
    "",
    `Or copy the files above out of [\`items/${item.name}.json\`](${base}/items/${item.name}.json). They are plain ES modules and plain CSS: no build step, no bundler, nothing to install.`,
    ""
  );
  return lines.join("\n");
}

export function buildDocs(out = join(ROOT, "dist/registry"), base = DEFAULT_BASE) {
  const registry = JSON.parse(readFileSync(join(out, "registry.json"), "utf8"));
  const items = registry.items.map((i) =>
    JSON.parse(readFileSync(join(out, "items", `${i.name}.json`), "utf8"))
  );

  rmSync(join(out, "e"), { recursive: true, force: true });
  mkdirSync(join(out, "e"), { recursive: true });

  const pages = new Map();
  for (const item of items) {
    const page = effectPage(item, base);
    pages.set(item.name, page);
    writeFileSync(join(out, "e", `${item.name}.md`), page);
  }

  const byShelf = new Map();
  for (const item of items) {
    if (!byShelf.has(item.category)) byShelf.set(item.category, []);
    byShelf.get(item.category).push(item);
  }

  const index = [
    "# paw-fx",
    "",
    "> Animated sections for the web, as files you copy rather than a package you install. Every effect is one folder: an ES module exporting `mount(el, opts)`, a stylesheet, and markup that already looks finished with CSS alone. No build step, no bundler, and nothing fetched off-site at runtime.",
    "",
    "Each effect below links to a page with its options, its markup and its install line. Effects that need a library carry their own vendored copy, listed under Dependencies; most need nothing.",
    "",
    `Everything at once: [llms-full.txt](${base}/llms-full.txt). Machine-readable index: [registry.json](${base}/registry.json).`,
    ""
  ];
  for (const [key, label] of Object.entries(SHELF)) {
    const shelf = byShelf.get(key);
    if (!shelf) continue;
    index.push(`## ${label}`, "");
    for (const it of shelf.sort((a, b) => a.name.localeCompare(b.name))) {
      index.push(`- [${it.name}](${base}/e/${it.name}.md): ${esc(it.summary)}`);
    }
    index.push("");
  }
  // A shelf added to meta.schema.json but not to SHELF would otherwise vanish
  // from the index silently, which is the kind of omission nobody notices.
  for (const [key, shelf] of byShelf) {
    if (SHELF[key]) continue;
    index.push(`## ${key}`, "");
    for (const it of shelf) index.push(`- [${it.name}](${base}/e/${it.name}.md): ${esc(it.summary)}`);
    index.push("");
  }

  // Cloudflare serves .md and .txt as octet-stream by default, which makes a
  // browser download llms.txt instead of showing it. CORS is open because the
  // registry is public data and a browser-side tool has no other way in;
  // `npx shadcn add` fetches from node and would not need it.
  writeFileSync(
    join(out, "_headers"),
    [
      "/*",
      "  Access-Control-Allow-Origin: *",
      "/*.md",
      "  Content-Type: text/markdown; charset=utf-8",
      "/*.txt",
      "  Content-Type: text/plain; charset=utf-8",
      ""
    ].join("\n")
  );
  writeFileSync(join(out, "llms.txt"), index.join("\n"));
  writeFileSync(
    join(out, "llms-full.txt"),
    [index.join("\n"), "", "---", "", ...[...pages.values()].flatMap((p) => [p, "---", ""])].join("\n")
  );
  return { effects: items.length, shelves: byShelf.size, base };
}

if (import.meta.main) {
  const i = process.argv.indexOf("--base");
  const base = i > 0 ? process.argv[i + 1] : DEFAULT_BASE;
  const r = buildDocs(undefined, base);
  console.log(`docs: llms.txt + ${r.effects} effect page(s) across ${r.shelves} shelves -> dist/registry (base ${r.base})`);
}
