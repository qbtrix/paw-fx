<!-- The pinned upstream source of every ported effect. Written 2026-09-06 by the
     research pass that preceded the curation wave. `scripts/verify-ports.mjs`
     fetches these same (repo, commit, path) triples and fails a mismatch, so this
     file is the record behind the gate rather than a note beside it. Add a row
     when you add an effect, and never replace a commit sha with a branch name. -->

# paw-fx — pinned upstream sources

Research output for the `port, never invent` gate. Every row below was resolved
against the GitHub API on **2026-09-06**; SHAs are the head of the named default
branch at that moment, not branch names. Licences were read from the repo's
actual LICENSE file, not from the API's guess, except where noted.

**Read the per-effect notes before porting.** Several origins are multi-file, one
carries a non-MIT transitive dependency, and one has no LICENSE file at all.

**Fetch check:** every `(repo, sha, path)` triple in the table below was fetched
back through `GET repos/{repo}/contents/{path}?ref={sha}` as a final pass —
**35/35 resolved**, byte sizes recorded. That is the same operation the
verification gate will perform, so no row here is a plausible-looking guess.

---

## Master table

| Effect | Upstream repo | Commit sha | File path | Licence | Verified how |
|---|---|---|---|---|---|
| bg / liquid-metal | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/liquid-metal.ts` | Apache-2.0 | `gh api repos/.../contents/LICENSE` → Apache 2.0 text; `/license` → `Apache-2.0` |
| bg / god-rays | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/god-rays.ts` | Apache-2.0 | same |
| bg / water | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/water.ts` | Apache-2.0 | same |
| bg / metaballs | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/metaballs.ts` | Apache-2.0 | same |
| bg / dithering | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/dithering.ts` | Apache-2.0 | same |
| bg / **shared GLSL** (all 5) | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shader-utils.ts`, `packages/shaders/src/shader-sizing.ts`, `packages/shaders/src/vertex-shader.ts` | Apache-2.0 | read imports + `${...}` splice sites in all 5 files |
| bg / sg-gloam | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `gloam/shader.frag` (+ `gloam/meta.json`) | MIT | LICENSE file read: MIT, © 2026 E. T. Carter |
| bg / sg-suffuse | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `suffuse/shader.frag` (+ `meta.json`) | MIT | same |
| bg / sg-nebula-drift | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `nebula-drift/shader.frag` (+ `meta.json`) | MIT | same |
| bg / sg-bough | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `bough/shader.frag` (+ `meta.json`) | MIT | same |
| bg / sg-laminar | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `laminar/shader.frag` (+ `meta.json`) | MIT | same |
| bg / sg-isobar | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `isobar/shader.frag` (+ `meta.json`) | MIT | same |
| bg / sg-lull | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `lull/shader.frag` (+ `meta.json`) | MIT | same |
| bg / sg-brume | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `brume/shader.frag` (+ `meta.json`) | MIT | same |
| 3d / vanta-net | github.com/tengbao/vanta | `f8b351906688b56f0fc744e53bde81fc3c56f150` | `src/vanta.net.js` **+ `src/_base.js`** | MIT | `LICENSE.md` read: full MIT text, © 2020 Teng Bao |
| 3d / vanta-waves | github.com/tengbao/vanta | `f8b351906688b56f0fc744e53bde81fc3c56f150` | `src/vanta.waves.js` **+ `src/_base.js`** | MIT | same |
| 3d / vanta-globe | github.com/tengbao/vanta | `f8b351906688b56f0fc744e53bde81fc3c56f150` | `src/vanta.globe.js` **+ `src/_base.js`** | MIT | same |
| particles / starfield | github.com/tsparticles/presets | `ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7` | `presets/stars/src/options.ts` | MIT | root `LICENSE` + per-package `presets/stars/LICENSE`, both MIT © 2020 Matteo Bruni |
| particles / links-network | github.com/tsparticles/presets | `ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7` | `presets/links/src/options.ts` | MIT | same |
| scroll / stagger reveal | github.com/juliangarnier/anime | `01b81be1df6843ccfe0a71c0699a746bf740dd77` | `examples/onscroll-responsive-scope/index.js` | MIT | `LICENSE.md` read: MIT © 2025 Julian Garnier |
| scroll / pin + progress | github.com/juliangarnier/anime | `01b81be1df6843ccfe0a71c0699a746bf740dd77` | `examples/onscroll-sticky/index.js` | MIT | same |
| text / split reveal | github.com/juliangarnier/anime | `01b81be1df6843ccfe0a71c0699a746bf740dd77` | `examples/text/split-effects/index.js` | MIT | same |
| scroll / anime engine ref | github.com/juliangarnier/anime | `01b81be1df6843ccfe0a71c0699a746bf740dd77` | `src/events/scroll.js`, `src/text/split.js` | MIT | same |
| scroll / parallax | github.com/codrops/ElasticGridScroll | `96fd9927cd5d0486f64a89801917c0088fe42e42` | `js/demo1/index.js` (+ `js/utils.js`) | MIT | LICENSE file present (1103 B, MIT © 2009-2024 Codrops); README says `## License [MIT](LICENSE)`, **no** restrictive clause |
| text / scramble | github.com/codrops/TypeShuffleAnimation | `8f171f1f58d4ac8e1ede46109674f5c71005f166` | `src/js/typeShuffle.js` (+ `src/js/utils.js`) | MIT | LICENSE file present (1103 B, MIT © 2009-2022 Codrops); README `## License [MIT](LICENSE)`, **no** restrictive clause |
| marquee / component | github.com/magicuidesign/magicui | `1246d6d404c556f03867fc6d447f2867eee8a42b` | `apps/www/registry/magicui/marquee.tsx` | MIT | `LICENSE.md` read: MIT © Magic UI |
| marquee / **keyframes** | github.com/magicuidesign/magicui | `1246d6d404c556f03867fc6d447f2867eee8a42b` | `apps/www/styles/globals.css` **L261-268** (`@keyframes marquee`), **L270-277** (`marquee-vertical`), **L155-156** (`--animate-marquee*` theme vars) | MIT | grepped the file at that sha |
| cursor / spotlight | github.com/magicuidesign/magicui | `1246d6d404c556f03867fc6d447f2867eee8a42b` | `apps/www/registry/magicui/magic-card.tsx` | MIT | same — **React only, see notes** |
| cursor / trail | github.com/tholman/cursor-effects | `182a33839ad3ef63b14ad296e18bc1bb24a45bd6` | `src/trailingCursor.js` | MIT **claimed, no LICENSE file** | `contents/LICENSE` → 404, `/license` API → 404; only evidence is `package.json` + README |

<!-- 2026-09-07, the second wave off the two already-cleared shader upstreams.
     Same two commits as the rows above, so the pins were already fetch-checked;
     each row below was re-fetched through `gh api repos/{repo}/contents/{path}?ref={sha}`
     by `bun run verify`, which is the same call the gate makes. 14/14 resolved. -->
| bg / sg-bask | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `bask/shader.frag` (+ `bask/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-benday | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `benday/shader.frag` (+ `benday/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-haze | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `haze/shader.frag` (+ `haze/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-contour | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `contour/shader.frag` (+ `contour/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-cubit | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `cubit/shader.frag` (+ `cubit/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-louver | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `louver/shader.frag` (+ `louver/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-pleat | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `pleat/shader.frag` (+ `pleat/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-sheen | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `sheen/shader.frag` (+ `sheen/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / sg-weft | github.com/shader-gallery/shaders | `cd06eee100810a9682fb2fe49d7d43c81bee52c8` | `weft/shader.frag` (+ `weft/meta.json`) | MIT | same LICENSE file as the eight above: MIT, © 2026 E. T. Carter |
| bg / grain-gradient | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/grain-gradient.ts` (+ the three shared GLSL files above, + `packages/shaders-react/src/shaders/grain-gradient.tsx` for the preset) | Apache-2.0 | same |
| bg / neuro-noise | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/neuro-noise.ts` (+ the three shared GLSL files above, + `packages/shaders-react/src/shaders/neuro-noise.tsx` for the preset) | Apache-2.0 | same |
| bg / static-mesh-gradient | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/static-mesh-gradient.ts` (+ the three shared GLSL files above, + `packages/shaders-react/src/shaders/static-mesh-gradient.tsx` for the preset) | Apache-2.0 | same |
| bg / smoke-ring | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/smoke-ring.ts` (+ the three shared GLSL files above, + `packages/shaders-react/src/shaders/smoke-ring.tsx` for the preset) | Apache-2.0 | same |
| bg / warp | github.com/paper-design/shaders | `7002061d8389781a45e479584deeca0cf538474e` | `packages/shaders/src/shaders/warp.ts` (+ the three shared GLSL files above, + `packages/shaders-react/src/shaders/warp.tsx` for the preset) | Apache-2.0 | same |

---

## Per-effect notes

### paper-design/shaders (Apache-2.0) — origin is 2-4 files per shader, not one

Repo default branch `main`, head `7002061d8389781a45e479584deeca0cf538474e`
(2026-08-14, "Shader props audit (#287)"). The five requested shaders all exist
under `packages/shaders/src/shaders/`, as expected.

What each file contains, from its own JSDoc header at this sha:

| file | contents |
|---|---|
| `liquid-metal.ts` | "Futuristic liquid metal material applied to uploaded logo or abstract shape" — fluid-motion imitation over a user image, with an animated stripe pattern distorted along the shape edges |
| `god-rays.ts` | "Animated rays of light radiating from the center, blended with up to 5 colors" |
| `water.ts` | "Water-like surface distortion with natural caustic realism" — works as an image filter or as a standalone animated texture |
| `metaballs.ts` | "Up to 20 colored gooey balls moving around the center and merging into smooth organic shapes" |
| `dithering.ts` | "Animated 2-color dithering over multiple pattern sources (noise, warp, dots, waves, ripple, swirl, sphere)"; its header also warns that it does sizing in the fragment shader rather than the vertex shader, to keep `u_pxSize` in real pixels |
| `shader-utils.ts` | 10 exported GLSL string chunks: `declarePI`, `rotation2`, `proceduralHash11/21/22`, `textureRandomizerR/GB`, `colorBandingFix`, `simplexNoise`, `fiberNoise` |
| `shader-sizing.ts` | sizing uniform types and the shared GLSL sizing/UV preamble |
| `vertex-shader.ts` | the one vertex shader every effect in the package shares |

**The GLSL is assembled at module load, not written inline.** Every one of the
five splices helper chunks from `../shader-utils.js` via template literals, so
the fragment source you actually ship comes from more than one upstream file.
Measured splice sites:

| shader | lines | helpers spliced from `shader-utils.ts` |
|---|---|---|
| `liquid-metal.ts` | 841 | `declarePI`, `rotation2`, `simplexNoise`, `colorBandingFix` |
| `god-rays.ts` | 191 | `declarePI`, `rotation2`, `textureRandomizerR`, `proceduralHash11`, `colorBandingFix` |
| `water.ts` | 175 | `declarePI`, `rotation2`, `simplexNoise` |
| `metaballs.ts` | 152 | `declarePI`, `textureRandomizerR`, `colorBandingFix` |
| `dithering.ts` | 316 | `simplexNoise`, `declarePI`, `proceduralHash11`, `proceduralHash21` |

All five also import sizing types from `../shader-sizing.js`, and the shared
vertex shader lives in `../vertex-shader.ts`. `god-rays` and `metaballs` further
interpolate `${meta.maxColorCount}` / `${meta.maxBallsCount}` into loop bounds,
so the array sizes are build-time constants from the same file.

`liquid-metal.ts` is an outlier at 841 lines: past the shader string it carries a
large TypeScript image-processing block (Poisson solve, mask building, timing
`console.log`s) for the image-masked variant. If paw-fx only wants the animated
background and not the image masking, most of that file is legitimately
out-of-scope and the diff will show a very large deletion.

### shader-gallery/shaders (MIT) — the 8 picks

Repo `shader-gallery/shaders`, default branch `main`, head
`cd06eee100810a9682fb2fe49d7d43c81bee52c8` (2026-06-26). This is the right repo
for the org/repo pair in the brief: description "shader.gallery catalog — curated
WebGL/GLSL background shaders". It now holds **259** `.frag` files, not ~150 —
the catalogue grew. Layout is `<slug>/shader.frag` + `<slug>/meta.json` +
`<slug>/poster.webp`, with a root `manifest.json` listing slugs and 36 family
names. LICENSE is a real MIT file, © 2026 E. T. Carter, and the README repeats
it and explicitly permits commercial use.

**Licence evidence is unusually strong here, and I checked it hard** — a
two-month-old repo with no stars, one author and 259 claimed-original shaders
deserves scepticism. Findings:

- **259 of 259** `shader.frag` files carry, as line 1 and 2,
  `// SPDX-License-Identifier: MIT` and
  `// SPDX-FileCopyrightText: 2026 E. T. Carter <support@shader.gallery>`. That
  is per-file provenance, not just a repo-root LICENSE.
- Grepping all 259 for `shadertoy|glslsandbox|adapted from|based on …by|iq|
  inigo|quilez` returns exactly **two** hits, both ordinary technique credits in
  a comment, and **neither is one of our eight**: `festoon/shader.frag:40`
  ("signed distance to a triangle with corners a,b,c (Inigo Quilez)") and
  `slick/shader.frag:59` ("iq domain warp"). Those are standard,
  freely-published graphics techniques being credited, not lifted shader bodies.

**Hidden runtime dependency — the palette is not in this repo.** Every one of
the eight declares the same host-supplied uniform block —
`u_time`, `u_resolution`, `u_mouse`, `u_pixelRatio`, `u_palette[4]` — plus its
own tunables. `u_palette[4]` is *four theme colours passed in by the host*, and
`meta.json` names a palette by string (`"defaultPalette": "midnight"`) without
defining it. That table lives in `@shader-gallery/runtime`, a separate npm
package that is **not** pinned here, as do the `post` blocks (bloom, grain,
vignette, saturation, dither). So the `.frag` + `meta.json` pair is a complete
*shader*, but not a complete *look*: paw-fx has to supply its own four-colour
palettes and decide whether to implement the post chain. Budget for that, and
expect our output to differ from the poster until it is done.

Per-shader uniform tunables (beyond the shared five), for the porting agent:

```
gloam        u_driftSpeed u_softness u_glow u_warp u_mouseInfluence
suffuse      u_driftSpeed u_softness u_shimmer u_warp u_mouseInfluence
nebula-drift u_drift u_dust u_filament u_scale
bough        u_swaySpeed u_leafSize u_penumbra u_poolDepth
laminar      u_density u_radius u_flow u_spin u_posY u_line u_glow u_hueSpread u_depth
isobar       u_spin u_drift u_winding u_eye
lull         u_rockSpeed u_sway u_tiltDepth
brume        u_spacing u_flowSpeed u_glow
```

**I did see these rendered.** Each shader ships a 1280×800 `poster.webp` still.
I pulled the repo tarball at the pinned sha, converted the candidate posters with
`dwebp`, and viewed them as contact sheets. So the visual judgements below are
from the upstream poster frames, not from names. Caveat: a poster is one frame —
I have not seen the motion, and `meta.json` `post` blocks (bloom, grain,
vignette) are applied by the shader-gallery runtime, so a naive port that skips
post-processing will look flatter than the poster.

Selection ran in two passes: score `meta.json` tags for calm/premium and against
busy/typographic, drop anything raymarched or with a high loop bound, then eye
the posters of ~40 finalists.

| slug | family | cost (per pixel) | what it looks like / why it earns a slot |
|---|---|---|---|
| `gloam` | Aura | 1 loop × 4 iter, 84 lines, 0 texture reads | Deep indigo-to-near-black twilight mesh gradient with one off-centre luminous bloom. The cheapest thing in the set and the dark-mode workhorse — no structure at all to compete with a headline. |
| `suffuse` | Aura | 1 × 4, 86 lines | High-key pastel wash (opal blue, lilac, rose, mint) with a faint soap-film shimmer. The light-mode counterpart to `gloam`; the only bright pick, and the one that makes dark type work. |
| `nebula-drift` | Abyss | 2 loops, max 6 iter, 178 lines | Soft volumetric gas with dark dust lanes. Adds depth and organic texture without any hard edge or repeating motif. |
| `bough` | Umbra | 1 loop × 14 (`LEAVES = 14`), 202 lines | Blurred leaf shadows thrown on a wall by an unseen lamp — dappled, very low contrast, all penumbra. The organic/photographic register nothing else in the set covers. |
| `laminar` | Current | **no loops**, 153 lines | Fine teal streamlines parting around an invisible body and rejoining. Line-art elegance, near-black field, calm in the far corners where text goes. |
| `isobar` | Strata | **no loops**, 164 lines | Two or three soft luminous log-spiral storm bands on a near-black chart. The boldest of the eight — best with offset rather than centred text. |
| `lull` | Aether\* | 1 × 5, 167 lines | Dim horizontal water bands toward a barely-visible horizon with sparse glints. Cinematic, almost static by design (`tags: minimal, ambient, slow`). |
| `brume` | Veil | 1 × 5, 147 lines | Moonlit mist streaming sideways past near-black vertical columns, each gap glowing a slightly different hue. Atmospheric depth without a focal object. |

Family spread is 7 of 36 across 8 picks; the one doubled family is Aura, and
that pair is deliberate — `gloam` and `suffuse` are the dark and light versions
of the same premium mesh-gradient look, and a section library needs both.

\* `lull` is upstream-inconsistent about its own family: `meta.json` says
`"family": "Aether"` but the header comment in `lull/shader.frag` says
`lull (Wake)`. I have gone with `meta.json`, since that is the machine-readable
field the catalogue indexes. Cosmetic, but flagging it so nobody thinks we
mislabelled it.

**Rejected, with the reason, so the choices are auditable:**

- `cairn` (Plinth) — was in my first eight and cut on measurement. `meta.json`
  does not tag it `raymarch`, but the description says "Raymarched as true 3D
  solids" and the source confirms `const int STEPS = 115` with a nested
  `gx/gz ∈ [-1,1]` grid lookup inside the march loop. That is ~1035 SDF
  evaluations per pixel. Beautiful, not full-bleed hero material.
- `slick`, `hatch`, `marble`, `crackle`, `dichroic`, `froth`, `emboss` — visually
  premium but far too high-contrast or high-frequency to sit behind text.
- `medusa`, `nacre`, `eclipse`, `banner`, `halo`, `comet` — figurative. A
  jellyfish, a soap bubble, a moon, a flag. Focal objects fight a headline.
- Everything in the `Mercury` family (`amalgam`, `syzygy`, `gather`, `mitosis`,
  `circlet`) — good shaders, but they are liquid-metal metaballs and would
  duplicate the paper-design `liquid-metal` and `metaballs` ports.
- `ascii`, `glyphic`, `cipher`, `sigil`, `matrix`, `sampler`, `tally` — filtered
  out early as typographic; they render glyph forms.

### tengbao/vanta (MIT) — highest risk, as briefed

Default branch is **`master`**, not `main`. Head
`f8b351906688b56f0fc744e53bde81fc3c56f150` (2023-01-12, "add pixelated option").
The repo has had no source commit since 2023. `LICENSE.md` carries the full MIT
text, © 2020 Teng Bao.

**The three effect files do not stand alone.** `vanta.net.js` (303 lines),
`vanta.waves.js` (202) and `vanta.globe.js` (392) each `extends VantaBase` from
`src/_base.js` (420 lines), which owns the renderer, camera, resize, RAF loop,
mouse handling and teardown. Every `THREE.WebGLRenderer` / `THREE.Scene` call
lives in `_base.js`, not in the effect files. A port of `vanta.net.js` alone will
not run, and every line of base-class logic in our version will read as
invention. Origin must name both files.

**Three.js version vanta pins: r134.** Not declared as an npm dependency —
`package.json` has no `three` entry at all, because vanta reads `window.THREE`.
The pin is evidenced three ways at this sha: the repo vendors
`vendor/three.r134.min.js`; `index.html` loads
`cdnjs…/three.js/r134/three.min.js`; and `README.md` line 25 does the same.

**Seam changes for three 0.185.** Verified three ways: the official migration
guide (`github.com/mrdoob/three.js/wiki/Migration-Guide`) for the revision
numbers, plus grep against **both** builds — the vendored `three.r134.min.js` at
this sha and `three@0.185.0/build/three.module.js` pulled from jsDelivr. Counts
in 0.185.0: `VertexColors` **0**, `useLegacyLights` **0**, `outputEncoding`
**0**, `outputColorSpace` **18**. So the removals below are observed in the
target build, not inferred from the changelog.

1. **`THREE.VertexColors` — silent visual break, the sharpest one.**
   `vanta.net.js:94` and `vanta.globe.js:95` both do
   `vertexColors: THREE.VertexColors`. `Material.vertexColors` became a boolean
   in r114, but the legacy numeric constant survived: the vendored
   `three.r134.min.js` still exports `t.VertexColors=2`, so the code works at
   r134. In 0.185.0 the string does not occur at all, so the expression
   evaluates to `undefined` → falsy → **per-vertex colours silently switch off**
   and the lines render flat. No error, no warning. Seam: `vertexColors: true`.
2. **`blending: … : null` — a pre-existing vanta bug, NOT a version seam.**
   `vanta.net.js:95` and `vanta.globe.js:96` pass `blending: null` on the
   non-additive branch. I checked this against both builds and the
   `Invalid blending` error path is present in **r134 as well as 0.185**, so
   vanta is already hitting it today at its own pinned version. Fix it in the
   port (`THREE.NormalBlending`), but classify the change as a bug fix rather
   than a 0.185 migration, or the gate will be told the wrong story about why
   the line changed.
3. **Lighting model flip — biggest rendering delta.** `useLegacyLights` defaulted
   to `false` from r155/r156 and was removed in r165 (confirmed: 0 occurrences
   in 0.185.0). All three effects use
   `AmbientLight` / `PointLight` / `SpotLight` / `HemisphereLight`; `waves.js`
   uses `AmbientLight(0xffffff, 0.9)` + `PointLight(0xffffff, 0.9)` with a
   `MeshPhongMaterial`. Under physically-correct lighting those intensities are
   candela-based with inverse-square falloff, so the scenes will render very
   dark. Expect an intensity retune — a real seam change, and one the gate should
   be told to expect rather than flag as invention.
4. **Colour management.** r152 turned `ColorManagement.enabled` on by default and
   replaced `outputEncoding` with `outputColorSpace` (`SRGBColorSpace` default).
   Vanta builds every colour from hex ints via `new THREE.Color(...)`, so hues
   shift. Decision needed at port time: set `ColorManagement.enabled = false` for
   a byte-faithful match to the original look, or accept the shift and retune.
5. **Dead references, not live risks.** `THREE.Geometry`, `THREE.OrbitControls`
   and `THREE.AxisHelper` all appear in these files but **only inside commented-out
   code** (`vanta.net.js:204-206`, `vanta.globe.js:276-278`, `_base.js:363-366`).
   All three are removed from modern three. Don't uncomment them.

Nothing else in the live API surface is removed: `BufferGeometry`,
`BufferAttribute`, `DynamicDrawUsage`, `setDrawRange`, `setFromPoints`,
`EdgesGeometry`, `SphereGeometry`, `BoxGeometry`, `LineSegments`,
`MeshLambertMaterial`, `MeshPhongMaterial`, `Raycaster` and `THREE.MOUSE` all
still exist in 0.185.

### tsparticles — better than expected, these are source files

The brief anticipated docs-only. There is a real, MIT-licensed monorepo:
`tsparticles/presets`, head `ae866a538fa40b4b06f8a2b8d4b168d134bf6ba7`
(2026-04-11). Both requested presets exist as committed TypeScript:

- starfield → `presets/stars/src/options.ts` (~40 lines: 100 particles, no
  directional move, speed 0.1, animated opacity 0-1, size 1-3, black background)
- links-network → `presets/links/src/options.ts` (~30 lines: 100 particles,
  `links.distance: 150`, size 1, circle shape, black background)

Package version at that sha is **`4.0.0-beta.0`** for both, licence MIT — root
`LICENSE` and a per-package `LICENSE` in each preset directory, © 2020 Matteo
Bruni. So this is a genuine source origin, not a documented preset. Only caveat:
it is a beta tag. The config shape is stable across the 3.x→4.x line, but if the
gate prefers a released version, pin the stable `@tsparticles/preset-stars`
release commit instead — the trade is a source pin against a released version
number.

### anime.js v4 — real example files in-repo, so pin files not docs

Default branch `master`, head `01b81be1df6843ccfe0a71c0699a746bf740dd77`.
`package.json` says **`animejs` v4.5.0**, MIT © 2025 Julian Garnier. The repo
ships an `examples/` tree, so all three asks resolve to real files rather than
doc pages:

- **scroll-triggered stagger reveal** → `examples/onscroll-responsive-scope/index.js`.
  Imports `animate, onScroll, stagger, createScope`. This is the closest single
  file to the ask, but be honest about it: it is a *composition* of `onScroll` +
  `stagger` inside a responsive scope, not a file whose sole purpose is the
  reveal.
- **scroll-linked pin / progress** → `examples/onscroll-sticky/index.js`.
  Imports `utils, stagger, onScroll, createTimeline, animate`; builds a stacked
  card pin driven by scroll. Clean match.
- **text split reveal** → `examples/text/split-effects/index.js`. Imports
  `splitText` plus `stagger` and `createTimeline`. Two other split examples exist
  (`examples/text/split-playground/`, `examples/text/hover-effects/`).
  **Strip the `import { GUI } from 'tweaks/gui'` line** — it is a dev-only tweak
  panel and is not part of the effect.

Engine sources worth pinning alongside, since a vanilla port will reimplement
their behaviour: `src/events/scroll.js` (the `onScroll` observer) and
`src/text/split.js` (the splitter). All example files import from
`../../dist/modules/index.js`, so the import path is a guaranteed seam change.

Bonus: `src/text/scramble.js` and `examples/text/scramble/index.js` exist. anime
has a first-party text scramble. See the Codrops note below.

**On the doc URLs — deliberately not pinned.** The brief allowed docs-only
origins here, but since all three asks resolve to real files at a real sha, the
repo is the origin and docs would only be decoration. I did try
`https://animejs.com/documentation/scroll`; the fetch resolved to landing-page
content rather than a scroll-specific document, and the site header showed
`4.0.0` against `package.json`'s `4.5.0` at this commit. Rather than pin a URL I
could not confirm renders the API reference, I am leaving the docs out and
letting the example files plus `src/events/scroll.js` carry the origin. If a doc
URL is wanted in metadata, someone should open it in a browser first.

### Codrops — both picks have real LICENSE files; the clause check worked

I enumerated **all 345** repos in the `codrops` org rather than trusting search,
then grepped. Findings:

- There is **no** repo in the Codrops org with "parallax" in its name or
  description. The closest true scroll-parallax is `ElasticGridScroll`
  ("each column of a grid moves at a slightly different speed").
- There is **no** repo with "scramble" in its name either. The scramble effect
  ships as `TypeShuffleAnimation`.

Both picks were then verified per the brief:

| repo | LICENSE file | README licence text | restrictive clause? |
|---|---|---|---|
| `codrops/ElasticGridScroll` | present, 1103 B, MIT © 2009-2024 Codrops | `## License` → `[MIT](LICENSE)` | **no** |
| `codrops/TypeShuffleAnimation` | present, 1103 B, MIT © 2009-2022 Codrops | `## License` → `[MIT](LICENSE)` | **no** |

The check is not vacuous — I ran a control on three `license: null` Codrops repos
(`CSSGlitchEffect`, `ImageTiltEffect`, `SmoothScrollingImageEffects`) and all
three carry exactly the clause the brief warned about: *"It is not allowed to take
the resource 'as-is' and sell it, redistribute, re-publish it, or sell
'pluginized' versions of it."* So the discriminator is real and both picks pass
it. Other clean MIT alternatives if either pick is rejected on other grounds:
`ColumnScroll` (212★), `ScrollBasedLayoutAnimations` (335★), `LetterShuffleMenu`
(50★).

**Two dependency problems the licence check does not catch:**

1. **`ElasticGridScroll` is GSAP-driven, and GSAP is not MIT.** `js/demo1/index.js`
   opens with `gsap.registerPlugin(ScrollTrigger, ScrollSmoother)` and the whole
   parallax is `ScrollSmoother`'s per-element `lag` — the Codrops code just
   computes a lag value per column from distance to centre. The repo bundles
   `js/gsap.min.js`, `js/ScrollTrigger.min.js` and `js/ScrollSmoother.min.js`;
   the Codrops MIT covers their ~120 lines, not GreenSock's, and ScrollSmoother
   is a Club GreenSock plugin. We must not vendor those files. A vanilla port
   keeps the *idea* (column bucketing + distance-from-centre lag curve) but has
   to reimplement the lag integrator, which the gate will read as largely
   invention. Flagging this as a plan-level decision, not something I can fix in
   a source list.
2. **`TypeShuffleAnimation` depends on `Splitting`** (`import Splitting from
   'splitting'`, plus two of its CSS files). Splitting is itself MIT and small,
   and `typeShuffle.js`'s own `Line` / `Cell` / `TypeShuffle` classes are
   self-contained, so this is a much lighter problem than the GSAP one — swap
   Splitting for our own splitter or for anime's `src/text/split.js`.

Given (1), consider **anime.js `src/text/scramble.js` +
`examples/text/scramble/index.js`** as the scramble origin instead: same MIT,
same commit we are already pinning, zero third-party deps. Not substituting it
silently — the brief asked for a Codrops repo and `TypeShuffleAnimation` is a
clean one — but it is the lower-risk option if the porting agent wants it.

### Magic UI marquee — the brief's premise is stale, pin both real locations

Head `1246d6d404c556f03867fc6d447f2867eee8a42b` (2026-09-05), MIT © Magic UI
(`LICENSE.md`).

The brief says the keyframes live in a Tailwind **config**. That was true under
Tailwind v3; at this sha Magic UI is on **Tailwind v4** and there is no
`tailwind.config.*` in the tree at all. The keyframes are now CSS-native in
`apps/www/styles/globals.css`:

- **L261-268** — `@keyframes marquee` (`translateX(0)` → `translateX(calc(-100% - var(--gap)))`)
- **L270-277** — `@keyframes marquee-vertical` (same on Y)
- **L155-156** — the `@theme` variables `--animate-marquee` and
  `--animate-marquee-vertical`, which bind those keyframes to
  `var(--duration)` and the `animate-marquee` utility class

The component, `apps/www/registry/magicui/marquee.tsx` (~75 lines), contributes
the other half of the mechanism: `[--duration:40s] [--gap:1rem]`, the
`repeat`-times duplicated track, `group-hover:[animation-play-state:paused]` and
`[animation-direction:reverse]`. A vanilla port needs both files.

**Gate warning:** `globals.css` is 632 lines and we want ~18 of them. Diffing our
snippet against the whole file makes every other line read as a deletion. The
origin needs a line range, not just a path.

### Cursor spotlight — React only, and the thinnest option is not thin

Nothing vanilla and MIT turned up for "radial gradient tracking pointer via CSS
custom properties":

- **Magic UI** has no `spotlight.tsx`. The pattern lives in
  `apps/www/registry/magicui/magic-card.tsx`, which is React
  (`motion/react` motion values + springs, `next-themes`) and has grown to **222
  lines** with two modes (`gradient` and `orb`), a global pointer-out/blur/
  visibilitychange reset, and theme-dependent blend modes. The genuinely portable
  core is about 15 lines: `handlePointerMove` reads
  `e.clientX - rect.left` / `e.clientY - rect.top`, and a
  `radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, …)`
  template consumes them.
- Other Magic UI candidates are not the effect: `backlight.tsx` (33 lines) is a
  static SVG `feGaussianBlur` filter with no pointer tracking at all;
  `pointer.tsx` (119) is a custom cursor; `glare-hover.tsx` (153) is a sweep, not
  a spotlight.
- **Cult UI** (`nolly-studio/cult-ui`, MIT, head
  `3b855612fb524cb042cc91b65f0cd575057471cc`) has no spotlight component either.
  `glow-button.tsx` tracks the pointer but only along one axis inside a button;
  `grid-beam.tsx` is 771 lines of palette machinery.
- **Codrops** has no spotlight/flashlight demo. Its cursor repos
  (`GooeyCursor`, `CrosshairDistortion`, `AnimatedCustomCursor`, all MIT) are
  vanilla but are cursor *decorations*, not radial spotlights.

**So: pin `magic-card.tsx`, and expect a deletion-heavy diff.** It is the
thinnest correct-mechanism source available, but ~200 of its 222 lines are React
plumbing that a vanilla `element.style.setProperty('--x', …)` version does not
need. The gate should be told in advance that this port is mostly subtraction,
or the deletion ratio will look like a rewrite.

### tholman/cursor-effects — licence cannot be evidenced from a LICENSE file

Default branch `master`, head `182a33839ad3ef63b14ad296e18bc1bb24a45bd6`
(2026-02-26, a dependabot merge — no source change). Target file
`src/trailingCursor.js`, 159 lines, plain vanilla canvas, no imports.

Licence status, exactly as found:

- `GET repos/tholman/cursor-effects/contents/LICENSE` → **404**
- `GET repos/tholman/cursor-effects/license` → **404**
- GitHub's repo API reports `license: null`
- `package.json` (v1.0.18) declares `"license": "MIT"`
- `readme.md` has a `# License` heading whose entire body is:
  *"MIT af, but if you're using the scripts a GitHub sponsorship or shouting me
  a coffee would always be appreciated"*
- no SPDX header in `src/trailingCursor.js`

So MIT is asserted twice by the author but there is no licence text and no
copyright line anywhere in the repo. That is a call for the project owner, not
for me. One further wrinkle: `trailingCursor.js` opens with a comment crediting
`codepen.io/jakedeakin/full/MWKQVxX` for the easing, so part of the file is
third-party under CodePen's terms rather than under tholman's declaration.

---

## Could not pin

Short by design. Everything the brief asked for resolved to a real commit; these
are the qualifications, not padding.

1. **Scroll parallax with a clean vanilla origin — not found.** `ElasticGridScroll`
   is pinned and its licence is clean, but the effect itself is
   GSAP ScrollSmoother `lag`, and GSAP is not MIT. There is no MIT Codrops repo
   that does scroll parallax without GSAP, Lenis or Locomotive Scroll — I checked
   all 345. A vanilla port will be substantially original work no matter which
   repo we pin. **This is the one item that should change the plan.**
2. **Cursor spotlight with a vanilla origin — does not exist** in any of the
   sources named in the brief (Magic UI, Cult UI, Codrops). Pinned the React
   `magic-card.tsx` as instructed, with the deletion-ratio warning above.
3. **`cursor-effects` licence evidence — incomplete.** File pinned, licence
   asserted only in `package.json` and the README. No LICENSE file exists to
   fetch, so a gate that verifies licences by fetching LICENSE will fail this
   one, correctly.
4. **shader-gallery look is not fully pinned by these files.** The `.frag` files
   are pinned and licence-clean, but the four-colour palettes (`u_palette[4]`,
   named by string in `meta.json`) and the `post` chain (bloom/grain/vignette/
   dither) both live in `@shader-gallery/runtime`, a package outside the pinned
   repo. We supply our own or the output will not match the poster. Separately,
   I judged these from poster stills, not from motion.
5. **tsparticles version is a beta** (`4.0.0-beta.0` at the pinned commit). Real
   source, real MIT, but flagging the tag.
6. **anime.js documentation URLs — not pinned**, on purpose; see the anime.js
   note. The example files carry the origin instead.

## Things the gate design should absorb before porting starts

- **`origin.path` must accept multiple paths.** Three sets of pins are inherently
  multi-file: every paper-design shader (+ `shader-utils.ts`, `shader-sizing.ts`,
  `vertex-shader.ts`), every vanta effect (+ `_base.js`), and the Magic UI
  marquee (component + `globals.css`). With a single-path origin, the shared code
  reads as invention in every case.
- **`origin.path` should accept a line range** (`path#L261-L277`). The marquee
  keyframes are 18 lines inside a 632-line file.
- **Some ports are deletion-heavy by nature** — `magic-card.tsx` (222 React lines
  → ~20 vanilla), `liquid-metal.ts` (841 lines, most of it image-masking
  TypeScript). A hunk classifier that treats large deletions as suspicious will
  produce false invention flags on both.
- **Vanta needs a declared lighting/colour policy** before porting, not after.
  Items 3 and 4 in the vanta notes are not mechanical renames; they change how
  the scene looks and demand retuned constants that the gate will see as new
  numbers with no upstream counterpart.
- **Some hunks are bug fixes, not seams or inventions.** `blending: null` is
  broken at vanta's own pinned r134, so the port fixes a defect rather than
  migrating an API. If the classifier only knows "seam" and "invention", it has
  nowhere to put this and will call it invention. A third bucket, or a
  per-hunk justification field, would cover it.
- **paw-fx supplies palettes and post-processing for every shader-gallery
  background.** Those are not in the pinned repo, so they are original work by
  construction and should be excluded from the diff rather than flagged.
