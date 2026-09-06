# paw-fx

Vanilla animated-section library for Paw Sites. Every effect is a port of a named upstream (see `meta.json.origin`), served to site-building agents over MCP.

## Layout

```
effects/<name>/   index.js  style.css  snippet.html  meta.json  preview.png
vendor/           <key>.js for each meta.needs key (anime, three, paper, tsparticles, lenis, swup)
schema/           meta.schema.json
scripts/          lint.mjs  build-registry.mjs  validate.mjs
tests/            bun test (fixtures under tests/fixtures/)
dist/registry/    build output (gitignored)
```

## Effect contract

- `index.js` is an ES module exporting `mount(el, opts = {})` which returns `{ update(next), destroy() }`, plus `export const meta` mirroring meta.json. Nothing touches globals at import time. No bare-specifier imports: dependencies are `../../vendor/<key>.js`. Inside a site the files land at `_fx/effects/<name>/` and `_fx/vendor/`, the same two-level shape, so the relative import resolves unchanged.
- `style.css` is plain CSS. Custom properties are prefixed `--fx-`.
- `snippet.html` is the section markup. Its resting state must look finished with CSS only. It links `style.css` (or inlines a `<style>`). A `<script>` is allowed only as `type="module"` importing `index.js`.
- `mount()` honours `prefers-reduced-motion` (stay at rest). WebGL effects pass `failIfMajorPerformanceCaveat: true` and fall back to the resting state on failure.

## meta.json

Validated against `schema/meta.schema.json`: `name` (kebab), `version`, `category` (backgrounds, particles, 3d-hero, scroll, text, cursor, transition), `tags[]`, `summary`, `needs[]` (vendor keys), `options{}` (name to `{type, default, description}`), `license` (allow-list in LICENSES.md), `origin {repo, commit, path}` required unless `origin.repo` is `paw-fx`.

## Adding an effect

Port, never invent. Find the upstream, record `repo`, `commit` and `path` in `meta.json.origin`, keep the upstream licence header in the first 20 lines of `index.js`, and change only the seams: the `mount/update/destroy` wrapper, vendor import paths, `--fx-` variables. The visual logic stays upstream's. Add the effect to LICENSES.md. Run `bun run check`.

Lint enforces: schema, licence allow-list and origin, snippet rules, no bare imports, own code (index.js + style.css + snippet.html) at most 60 KB gzipped, licence header on ported code.

## Registry

`bun run build` writes `dist/registry/registry.json` (index: name, category, tags, summary, needs, license) and `dist/registry/items/<name>.json` (meta plus `files[{path, content}]`, `snippet`, `usage`). Files are the effect's `index.js` and `style.css` plus one `_fx/vendor/<key>.js` per `needs` entry; the build fails if a needed vendor file is missing. `usage` is three lines: link the css, place the snippet, mount it.

## Commands

```
bun run lint    # contract checks, exits 1 with effect + reason
bun run build   # dist/registry
bun test
bun run check   # lint + build + test
```

Preview images are 16:9 PNGs. `aurora-css/preview.png` is a generated gradient placeholder until a real capture lands.
