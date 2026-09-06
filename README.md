# paw-fx

Vanilla animated-section library for Paw Sites. Every effect is a port of a named upstream (see `meta.json.origin`), served to site-building agents over MCP.

## Layout

```
effects/<name>/   index.js  style.css  snippet.html  meta.json  preview.png
                  shader.frag, when the port's GLSL is a standalone upstream file
effects/_shared/  paw-fx code shared between effects (glsl-mount.js)
vendor/           manifest.json plus the files it lists (anime, three, paper, tsparticles, lenis)
schema/           meta.schema.json
scripts/          lint.mjs  build-registry.mjs  validate.mjs  smoke.mjs
tests/            bun test (fixtures under tests/fixtures/)
dist/registry/    build output (gitignored)
```

A directory under `effects/` whose name starts with `_` is shared code, not an
effect: `effectDirs()` skips it, so lint, build and smoke never walk it.

## Effect contract

- `index.js` is an ES module exporting `mount(el, opts = {})` which returns `{ update(next), destroy() }`, plus `export const meta` mirroring meta.json. Nothing touches globals at import time (see Vendor). No bare-specifier imports in any form: side-effect `import "x"`, binding imports, `export ... from "x"`, dynamic `import("x")` all count, and dependencies are `../../vendor/<file>` where the file is one `vendor/manifest.json` lists for a key in `needs`. Inside a site the files land at `_fx/effects/<name>/` and `_fx/vendor/`, the same two-level shape, so the relative import resolves unchanged.
- `style.css` is plain CSS. Custom properties are prefixed `--fx-`. It fetches nothing off-site: `@import` and `url()` take a relative path, a `data:` URI, or a `#frag` reference. Write the leading `./` — a relative URL without one is indistinguishable from a bare specifier and lint flags it.
- `snippet.html` is the section markup. Its resting state must look finished with CSS only. It links `style.css` (or inlines a `<style>`). A `<script>` is allowed only as `type="module"` importing `index.js`.
- `mount()` honours `prefers-reduced-motion` (stay at rest). WebGL effects pass `failIfMajorPerformanceCaveat: true` and fall back to the resting state on failure.
- `../_shared/<file>` is the one other specifier the build accepts: paw-fx's own code shared between effects, with no manifest key, and it must import nothing itself (one level, no graph walk). Items stay standalone, so each one carries its own copy at `_fx/effects/_shared/<file>`.
- `shader.frag`, when present, is emitted beside `index.js` and fetched at mount from `new URL("./shader.frag", import.meta.url)`. It exists for ports whose upstream *is* a bare GLSL file: keeping it as a file means a port-fidelity gate can diff it against upstream byte for byte, instead of extracting a template literal out of JS and hoping the escaping is faithful.

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

`bun run build` writes `dist/registry/registry.json` (index: name, category, tags, summary, needs, license) and `dist/registry/items/<name>.json` (meta plus `files[{path, content}]`, `snippet`, `usage`). Files are the effect's `index.js` and `style.css`, its `shader.frag` when it has one, every `../_shared/<file>` its index.js imports (emitted as `_fx/effects/_shared/<filename>`), and, for each `needs` key, every file and licence file `vendor/manifest.json` lists for it, emitted as `_fx/vendor/<filename>`; the build fails if one is missing from `vendor/`. `usage` is three lines: link the css, place the snippet, mount it.

Paths in `usage` and in `snippet.html` are root-absolute (`/_fx/...`), not page-relative. An html Paw Site is served by an assets-only Worker with `assets.directory: "."` and the sites code has no base-path concept, so a site always sits at the origin root: `./_fx/...` would resolve wrong on any nested page such as `/blog/post.html`. `usage` mounts with `querySelectorAll` and a loop, because the scroll, text and cursor categories routinely appear several times on one page.

## Resting-state smoke

`bun run smoke` is the gate on the CSS-only promise. For every effect it
materialises the built registry item into a temp site, serves it, loads
`snippet.html` in a real Chrome with **every script request aborted**, and
fails the effect if the section's box is under 200x100 at 1440x900, if the
pixels inside that box are effectively one colour, or if the section has no
height at 375 wide. Errors read `<effect>: <reason>` and exit 1, same as lint.

Aborting script requests at the network layer is the markup-and-stylesheet-only
equivalent of a browser with scripting off, and here the gap between the two is
narrow: lint tests the `<script>` opening tag for `type="module"` and for
`index.js`, so every script it accepts is meant to be an external module fetch,
and every one of those is aborted. The residue is an inline module hand-crafted
to put `index.js` in an attribute, which would still run; closing that is
lint's job rather than smoke's. A wrapper page
loads an external `/_marker.js`; if that marker ever runs, the block is not
working and the whole run throws rather than reporting green. Reduced motion
and a light colour scheme are pinned, so the capture is the resting frame.

Disabling scripting outright (`--blink-settings=scriptEnabled=false`) also
works and was the first build, but Playwright's screenshot path evaluates
script in the page and then waits out its 30s timeout on every capture:
measured 197ms with scripting on against 31.4s with it off, on the same page.

What it proves is that the section paints something without the effect's
script and does not collapse on a phone. It does not judge whether the section
looks good, and it does not separately simulate a refused WebGL context or a
pruned bundle -- both fall back to this same no-script path.

`tests/fixtures/bad-blank-section/` is the proof the gate can fail: a section
that reserves a full-height box and paints only from `index.js`. It clears
every box check and fails on pixels. `tests/smoke.test.js` asserts that, and
then re-runs the same measurements with the pixel rule relaxed to show the
fixture passing, because a gate that cannot fail is worse than no gate.

Needs the `agent-browser` CLI on PATH (`brew install agent-browser &&
agent-browser install`). Smoke uses its own browser session and closes it
afterwards, so a session you have open elsewhere is left alone.

## Commands

```
bun run lint    # contract checks, exits 1 with effect + reason
bun run build   # dist/registry
bun run smoke   # resting state renders with no effect script (needs agent-browser)
bun test
bun run check   # lint + build + smoke + test
```

Preview images are 640x360 PNGs. Every shader effect's is a real capture of the mounted shader; `aurora-css/preview.png` is still a generated gradient placeholder. Capture one by materialising the built item into a directory, serving it, and screenshotting at 1280x720. Hide `.fx-*__grain` first and scale down to 640: the grain and the shaders' own dithering are close to random noise, and a full-resolution capture with both lands at ~500 KB against ~100-250 KB without them.

Assert `[data-fx-live]` on the section before capturing. It is set only once the
shader has a context and a linked program, so without that check a "real
capture" is silently the CSS resting state on any machine whose browser refuses
the context -- which is the exact failure the preview is meant to rule out.

## Contrast

A hero that passes at rest and fails mid-animation is a failure, so contrast is
measured against the **live** shader across several animation frames, not
against the resting state. Method: mount with scripts on, hide the copy, capture
at four times, and take the worst ratio between each text run's computed ink and
the pixels under its box, skipping any run that paints its own opaque plate (a
filled CTA sits on its own background, not on the shader). Read the ink by
painting it to a canvas -- `getComputedStyle` serialises a `color-mix()` as
`oklab(...)`, and scraping the first three numbers out of that reads lightness
as red. Every effect here clears 4.5:1 on every text run; the per-effect worst
case is in the PR that landed it, and `--fx-scrim` is the knob to raise if a
restyle brings one down.
