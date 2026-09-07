# paw-fx

Vanilla animated-section library for Paw Sites. Every effect is a port of a named upstream (see `meta.json.origin`), served to site-building agents over MCP.

## Layout

```
effects/<name>/   index.js  style.css  snippet.html  meta.json  preview.png
                  shader.frag, when the port's GLSL is a standalone upstream file
                  demo/*.html, when one page cannot show the effect (page-fade)
effects/_shared/  paw-fx code shared between effects (glsl-mount.js, ascii-grid.js)
vendor/           manifest.json plus the files it lists (anime, three, paper, tsparticles, lenis)
schema/           meta.schema.json
scripts/          lint.mjs  build-registry.mjs  validate.mjs  smoke.mjs
                  build-gallery.mjs  build-demos.mjs  plus gallery/
                  (gallery.css, gallery.js, demo.css, all copied verbatim)
tests/            bun test (fixtures under tests/fixtures/)
dist/registry/    build output (gitignored), including previews/ and gallery/
                  (gallery/demo/<name>.html is the live demo per effect)
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

Port, never invent. Find the upstream, record `repo`, `commit` and `path` in `meta.json.origin`, keep the upstream licence header as a comment in the first 20 lines of `index.js` (a comment, not the `license` field in `meta` -- that field is required on every effect, so counting it would make the rule a no-op), and change only the seams: the `mount/update/destroy` wrapper, vendor import paths, `--fx-` variables. The visual logic stays upstream's. Add the effect to LICENSES.md. Run `bun run check`, then `bun run verify` to prove the port against the pinned upstream (see Port fidelity). If the port spans several upstream files, list them all in `origin.path`, or the shared code reads as invention.

Lint enforces: schema, licence allow-list and origin, every `needs` key present in `vendor/manifest.json`, snippet rules, self-contained references (every module specifier in index.js, every `@import` and `url()` in style.css), no vendor global read at module scope, own code (index.js + style.css + snippet.html) at most 60 KB gzipped, licence header comment on ported code. A generated site has no build step, so a specifier that is not a path is a hard failure in the browser and this lint is the only thing standing in front of it.

## Registry

`bun run build` writes `dist/registry/registry.json` (index: name, category, tags, summary, needs, license), `dist/registry/items/<name>.json` (meta plus `deviations`, `files[{path, content}]`, `snippet`, `usage`) and `dist/registry/previews/<name>.png`, copied from the effect. Those last two exist because `dist/registry/` is the whole of what a consumer sees -- the MCP server serves it and the gallery reads it and nothing else -- so the two questions a human asks before trusting an effect, what does it look like and where does it depart from upstream, have to be answerable from the registry. An effect with no `preview.png` is skipped rather than failing the build; a preview is a presentation asset, not part of the contract lint gates. Files are the effect's `index.js` and `style.css`, its `shader.frag` when it has one, every `../_shared/<file>` its index.js imports (emitted as `_fx/effects/_shared/<filename>`), and, for each `needs` key, every file and licence file `vendor/manifest.json` lists for it, emitted as `_fx/vendor/<filename>`; the build fails if one is missing from `vendor/`. `usage` is three lines: link the css, place the snippet, mount it. An item also carries `demo`: the hand-written pages under `effects/<name>/demo/`, emitted at `_fx/effects/<name>/demo/<file>` and kept out of `files[]` on purpose (see Live demos). It is an empty list on an effect that ships none, never absent.

Paths in `usage` and in `snippet.html` are root-absolute (`/_fx/...`), not page-relative. An html Paw Site is served by an assets-only Worker with `assets.directory: "."` and the sites code has no base-path concept, so a site always sits at the origin root: `./_fx/...` would resolve wrong on any nested page such as `/blog/post.html`. `usage` mounts with `querySelectorAll` and a loop, because the scroll, text and cursor categories routinely appear several times on one page.

## Gallery

`bun run gallery` builds the registry and then writes `dist/registry/gallery/`: one page carrying every effect, its preview, what it needs, which engines take it, the licence and the upstream file at the pinned commit, the deviations it declares, its options, and the `get_effect` call that fetches it. The audience is someone picking an effect for a client site.

Its only input is `dist/registry/` -- the index, the items, the previews. Never the `effects/` tree. The registry is what the MCP server serves, so a gallery built from it shows what a consumer gets, and an effect added to `effects/` reaches the page through the same command with no edit to the generator. `tests/gallery.test.js` counts the registry against the page so a dropped effect fails `bun run check` rather than going unnoticed.

The gallery is itself a Paw Site made of paw-fx, and its chrome is taken from the registry the way a site-building agent takes it: each item's `files[]` written at its own `path`, each item's `usage` lines as the stylesheet link and the mount script. `sg-nebula-drift` is the hero, `marquee-css` the ticker of upstreams (generated from `origin.repo`, so it stays true), `cursor-spotlight` the cards. All three are dependency-free, so the page ships no vendor code. Those usage lines are root-absolute, so serve the directory at a root (`python3 -m http.server --directory dist/registry/gallery`) rather than opening `index.html` over `file://`.

Previews ride inside `index.html` as `data:` URIs. An html Paw Site is created from a `{path: contents}` map whose values must be strings, so binary has no way in, and the page has to be one publishable map. `sips` re-encodes each 640x360 PNG to JPEG first: the PNGs total about 9 MB, which is well past the 4 MB deploy-input cap a publish captures. The quality is the knob that keeps the page publishable and it moves down as the library grows -- base64 adds a third on top of the JPEGs, so each effect costs about 45 KB at quality 75. It sat at 75 through 73 effects, crossed the cap at 77, sat at 65 through 82 (3.88 MB) and crossed again at 90 (4.47 MB); `JPEG_QUALITY` in `scripts/build-gallery.mjs` is 52 now, which is 3.68 MB at 90. Measured at 90 effects, the previews alone are 3.45 MB of base64 at q65 against 2.70 MB at q52, so the page is roughly a megabyte of markup plus whatever the images cost -- which is why the knob is the images and not the prose. `tests/gallery.test.js` asserts the cap, so this fails the build rather than failing a publish. Without `sips` (a Linux CI, say) the PNG ships as-is: the same page, five times the bytes, and too big to publish.

Cards and panels are rendered into the HTML rather than by the browser, so the page reads with scripting off and every effect is there for a test to count. `gallery.js` only filters, ranks (the same order `search_effects` returns), opens and copies. A `#<name>` hash opens that effect's panel, which is the `preview_url` contract the MCP server hands agents.

No live previews **on the grid page**. A document holds roughly 8 to 16 WebGL contexts before it starts evicting the oldest, and 29 of them would leave a grid of dead canvases, which is worse than a grid of images. The hero is the one live shader there. Every card and every panel instead links to that effect's own demo page, which is where the live version lives.

## Live demos

`scripts/build-demos.mjs`, called by `build-gallery.mjs`, writes `dist/registry/gallery/demo/<name>.html`: one full page per effect, showing the effect and nothing else. A still `preview.png` answers what colour an effect is and stops there; someone picking one for a client site needs to watch it move, scroll it and put a cursor on it. One demo is one page is one WebGL context, which is the only arrangement that scales to 29.

Each page is the item's own `snippet` markup, its `usage` stylesheet link and mount script verbatim, and a bar. Input is the built items and nothing else, so a new effect gets a demo through `bun run gallery` with no edit to the generator.

Every item's `files[]` are written once at the gallery root, so the 29 standalone items collapse to one shared `_fx/` tree and `three.module.js` ships once rather than three times. Two items disagreeing about a shared path throws rather than letting the last write win. Because `usage` is root-absolute, serve the gallery directory at a root; a demo at any depth under it resolves.

The bar is fixed to the bottom edge, carries the effect name, a link back to the grid and a reduced-motion toggle, and takes no space in the flow: 21 of the 29 sections fill the viewport, so a bar in flow would add its own height of scroll to a page that should have none.

`?reduced=1` is a real toggle, not a claim. A page cannot change the browser's `prefers-reduced-motion`, so the demo reproduces it on both paths the effects use. A head script redefines `matches` on the `MediaQueryList` that `matchMedia` returns, which is what every effect gates its motion on (the shader.gallery ports through `_shared/glsl-mount.js`, the ascii-lab ports through `_shared/ascii-grid.js`, the rest in their own `index.js`); and `animation: none` under `html[data-fx-reduced]` covers the CSS side, where motion is declared inside `@media (prefers-reduced-motion: no-preference)` blocks and not applying them is the resting state.

An effect in the `scroll` category also gets generated filler above and below, because `scroll-parallax` drives a view-timeline that only advances as the section crosses the viewport and `smooth-scroll` smooths the whole document, so a one-screen page shows neither. Keyed on the category, not on a list of names. The leading block is half a screen rather than a full one, so the effect is on screen at load instead of below a page of filler.

An effect may ship hand-written demo pages under `effects/<name>/demo/`, for a case one page cannot show. `page-fade` does: its fade is a navigation between two documents. Those pages ride on the item under a `demo` key, separate from `files[]` because `files[]` is what a site-building agent writes into a client site and a sample page about a fictional company does not belong there. They are emitted at `_fx/effects/<name>/demo/<file>`, which is the path their own `../style.css` already resolves against, so nothing is rewritten. The demo page links to them.

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

## Port fidelity

`bun run verify` is the gate on `port, never invent`. Lint proves an effect
**declares** an origin; verify proves the code **came** from it, by fetching the
pinned upstream bytes and comparing. That gap is where a convincing shader gets
written from scratch and labelled Vanta, so nothing in the gate asks a model
whether code looks ported. Seven mechanical rules, five hard and two advisory:

| rule | verdict | what it proves |
|---|---|---|
| `pin-commit` | FAIL | `origin.commit` resolves in `origin.repo`. An invented sha dies here, and this is the likeliest fabrication. |
| `pin-path` | FAIL | every `origin.path` exists at that exact commit, not on the branch tip |
| `paper-import` | FAIL | a `paper-design/shaders` port imports the shader string from `../../vendor/paper.js` and carries no GLSL of its own, so there is no second copy to drift |
| `copied-glsl` | FAIL | a `shader-gallery/shaders` port copies the `.frag` (no module exists upstream to import), so the embedded GLSL must be byte-identical: line endings and trailing whitespace are normalised, nothing else |
| `licence` | FAIL | `meta.license` equals the SPDX id detected in the upstream repo's own LICENSE file at that commit. GitHub's `/license` guess is not consulted. |
| `numeric-trace` | WARN | every numeric literal in `index.js` appears in some pinned upstream file |
| `deviations-real` | WARN | each declared deviation matches something in the code, the GLSL diff or the untraced constants |

A FAIL exits 1. WARNs alone exit 0 and print anyway, because a wave of them is
the signal to read the port by hand.

`numeric-trace` is advisory on purpose. A port legitimately carries numbers that
are ours (a clamp range, a guard threshold) and nothing mechanical separates
those from an invented easing curve, so the check lists every literal with no
upstream counterpart and leaves the call to a reviewer. It already earned its
keep: mesh-gradient's `distortion: 0.8` and `swirl: 0.1` traced to nothing,
because `origin.path` named the shader file and not the
`shaders-react/.../mesh-gradient.tsx` its own header comment cites as the source
of every default. The fix was declaring the second path, which is why
`origin.path` takes a list.

A deviation excuses a `copied-glsl` line whose text shares a token with the
deviation's `what`, which is how a necessary change ships without turning the
rule off.

`verify` is **not** part of `bun run check`: it makes network calls, and check
has to run in a worktree with no `gh` and no connection. Upstream reads go
through `gh api` (authenticated, so 5000/hour) and cache under `.cache/upstream/
<repo>/<commit>/<path>`, which is gitignored and never stale because those three
coordinates are immutable. Only successes cache, or an effect pinned to an
invented sha would cache its own 404 and stop being caught.

`tests/verify.test.js` runs the same code offline against
`tests/fixtures/upstream/`, a committed copy of that cache holding the real
upstream bytes. Six fixtures prove the gate can fail, covering all seven rules
(`bad-glsl-altered` is the fixture for `copied-glsl` and `numeric-trace` both).
Each is a correct port with exactly one thing wrong: an invented sha, a path that
does not exist at a real sha, a copied shader with one constant moved from `2.03`
to `2.07`, a paper-design port that pastes GLSL, an effect declaring MIT over an
Apache-2.0 upstream, and a deviation that describes nothing. The suite then
mutation-tests itself: it weakens each rule in turn, asserts that rule's fixture
goes quiet, and asserts every other rule still catches its own. That last column
is what stops one over-broad rule covering for a dead one. The table prints on
every `bun test`.

## Commands

```
bun run lint    # contract checks, exits 1 with effect + reason
bun run build   # dist/registry
bun run gallery # build, then dist/registry/gallery (the public page)
bun run smoke   # resting state renders with no effect script (needs agent-browser)
bun run verify  # port fidelity against the pinned upstream (network, needs gh)
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
