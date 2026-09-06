# paw-fx

Vanilla animated-section library for Paw Sites. Every effect is a port of a named upstream (see `meta.json.origin`), served to site-building agents over MCP.

## Layout

```
effects/<name>/   index.js  style.css  snippet.html  meta.json  preview.png
vendor/           manifest.json plus the files it lists (anime, three, paper, tsparticles, lenis)
schema/           meta.schema.json
scripts/          lint.mjs  build-registry.mjs  validate.mjs
tests/            bun test (fixtures under tests/fixtures/)
dist/registry/    build output (gitignored)
```

## Effect contract

- `index.js` is an ES module exporting `mount(el, opts = {})` which returns `{ update(next), destroy() }`, plus `export const meta` mirroring meta.json. Nothing touches globals at import time (see Vendor). No bare-specifier imports in any form: side-effect `import "x"`, binding imports, `export ... from "x"`, dynamic `import("x")` all count, and dependencies are `../../vendor/<file>` where the file is one `vendor/manifest.json` lists for a key in `needs`. Inside a site the files land at `_fx/effects/<name>/` and `_fx/vendor/`, the same two-level shape, so the relative import resolves unchanged.
- `style.css` is plain CSS. Custom properties are prefixed `--fx-`. It fetches nothing off-site: `@import` and `url()` take a relative path, a `data:` URI, or a `#frag` reference. Write the leading `./` — a relative URL without one is indistinguishable from a bare specifier and lint flags it.
- `snippet.html` is the section markup. Its resting state must look finished with CSS only. It links `style.css` (or inlines a `<style>`). A `<script>` is allowed only as `type="module"` importing `index.js`.
- `mount()` honours `prefers-reduced-motion` (stay at rest). WebGL effects pass `failIfMajorPerformanceCaveat: true` and fall back to the resting state on failure.

## Vendor

`vendor/manifest.json` is the source of truth for what a `needs` key means. A key maps to a **list** of files, not one file: `three` ships `three.module.js` and `three.core.js` and the module hard-codes the sibling path `./three.core.js`, so neither may be renamed. Each entry also names its `licenseFiles`, which the build emits alongside the code; `paper` is Apache-2.0, so its NOTICE ships too (section 4(d)). Import a vendored file by its real filename, `../../vendor/three.module.js`, never by the key.

Vendored files are the one exception to the no-globals rule. The tsParticles slim bundle assigns `tsParticles` and `loadSlim` to `globalThis` rather than exporting them; the vendored file is allowed to do that, and the effect must read the global **inside** `mount()`. Reading one at module scope runs at import time and fails lint.

`swup` is dropped. Every ES module build it publishes carries unresolvable bare specifiers, which a generated site has no build step to rewrite, so page transitions use the native View Transitions API instead as a dependency-free effect.

## meta.json

Validated against `schema/meta.schema.json`: `name` (kebab), `version`, `category` (backgrounds, particles, 3d-hero, scroll, text, cursor, transition), `tags[]`, `summary`, `needs[]` (vendor keys), `options{}` (name to `{type, default, description}`), `license` (allow-list in LICENSES.md), `origin`. `origin` itself is always required, because lint treats a missing one as ported and fails safe; `repo`, `commit` and `path` inside it are required only when `origin.repo` is not `paw-fx`. An original writes `"origin": { "repo": "paw-fx" }` and nothing else.

## Adding an effect

Port, never invent. Find the upstream, record `repo`, `commit` and `path` in `meta.json.origin`, keep the upstream licence header as a comment in the first 20 lines of `index.js` (a comment, not the `license` field in `meta` -- that field is required on every effect, so counting it would make the rule a no-op), and change only the seams: the `mount/update/destroy` wrapper, vendor import paths, `--fx-` variables. The visual logic stays upstream's. Add the effect to LICENSES.md. Run `bun run check`.

Lint enforces: schema, licence allow-list and origin, every `needs` key present in `vendor/manifest.json`, snippet rules, self-contained references (every module specifier in index.js, every `@import` and `url()` in style.css), no vendor global read at module scope, own code (index.js + style.css + snippet.html) at most 60 KB gzipped, licence header comment on ported code. A generated site has no build step, so a specifier that is not a path is a hard failure in the browser and this lint is the only thing standing in front of it.

## Registry

`bun run build` writes `dist/registry/registry.json` (index: name, category, tags, summary, needs, license) and `dist/registry/items/<name>.json` (meta plus `files[{path, content}]`, `snippet`, `usage`). Files are the effect's `index.js` and `style.css` plus, for each `needs` key, every file and licence file `vendor/manifest.json` lists for it, emitted as `_fx/vendor/<filename>`; the build fails if one is missing from `vendor/`. `usage` is three lines: link the css, place the snippet, mount it.

Paths in `usage` and in `snippet.html` are root-absolute (`/_fx/...`), not page-relative. An html Paw Site is served by an assets-only Worker with `assets.directory: "."` and the sites code has no base-path concept, so a site always sits at the origin root: `./_fx/...` would resolve wrong on any nested page such as `/blog/post.html`. `usage` mounts with `querySelectorAll` and a loop, because the scroll, text and cursor categories routinely appear several times on one page.

## Commands

```
bun run lint    # contract checks, exits 1 with effect + reason
bun run build   # dist/registry
bun test
bun run check   # lint + build + test
```

Preview images are 640x360 PNGs. `mesh-gradient/preview.png` is a real capture of the mounted shader; `aurora-css/preview.png` is still a generated gradient placeholder. Capture one by materialising the built item into a directory, serving it, and screenshotting at 1280x720. Hide `.fx-*__grain` first and box-average down to 640: the grain and the shader's own dithering are close to random noise, and a full-resolution capture with both lands at ~500 KB against ~100 KB without them.
