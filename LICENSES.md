# Licences

paw-fx itself is MIT. Every ported effect keeps its upstream licence; the
allow-list is MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, Unlicense, CC0-1.0.
Ported files carry the upstream copyright header, as a comment, in `index.js`,
and cite `repo`, `commit` and `path` in `meta.json.origin`.

Vendored libraries are declared in `vendor/manifest.json`: each key records its
licence and the `licenseFiles` that have to travel with the code into every
generated site. `paper` is Apache-2.0, so it ships a NOTICE as well as the
licence (section 4(d)). All five keys are landed; `vendor/PROVENANCE.md` records
where each file came from and `tests/vendor.test.js` holds the manifest and the
directory to each other. `swup` was staged and dropped, so it appears in neither.

## Vendored libraries

| Vendor key | Licence | Package | Version | Files shipped |
|---|---|---|---|---|
| anime | MIT | `animejs` | 4.5.0 | `anime.esm.js`, `anime.LICENSE` |
| three | MIT | `three` | 0.185.1 | `three.module.js`, `three.core.js`, `three.LICENSE` |
| paper | Apache-2.0 | `@paper-design/shaders` | 0.0.80 | `paper.js`, `paper.LICENSE`, `paper.NOTICE` |
| tsparticles | MIT | `@tsparticles/slim` | 4.3.2 | `tsparticles.slim.bundle.min.js`, `tsparticles.LICENSE` |
| lenis | MIT | `lenis` | 1.3.26 | `lenis.js`, `lenis.LICENSE` |

## Effects

| Effect | Licence | Upstream |
|---|---|---|
| aurora-css | MIT | paw-fx (original) |
| mesh-gradient | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `6046740`, `packages/shaders/src/shaders/mesh-gradient.ts` |
| starfield | MIT | [tsparticles/presets](https://github.com/tsparticles/presets) `ae866a5`, `presets/stars/src/options.ts` |
| links-network | MIT | [tsparticles/presets](https://github.com/tsparticles/presets) `ae866a5`, `presets/links/src/options.ts` |
| reveal-stagger | MIT | [juliangarnier/anime](https://github.com/juliangarnier/anime) `01b81be`, `examples/onscroll-responsive-scope/index.js` |
| pin-progress | MIT | [juliangarnier/anime](https://github.com/juliangarnier/anime) `01b81be`, `examples/onscroll-sticky/index.js` |
| split-reveal | MIT | [juliangarnier/anime](https://github.com/juliangarnier/anime) `01b81be`, `examples/text/split-effects/index.js` |
| scramble | MIT | [codrops/TypeShuffleAnimation](https://github.com/codrops/TypeShuffleAnimation) `8f171f1`, `src/js/typeShuffle.js` + `src/js/utils.js` |
| smooth-scroll | MIT | [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) `eea7159` (v1.3.26), `packages/core/src/lenis.ts` + `packages/core/lenis.css` |
| marquee-css | MIT | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) `1246d6d`, `apps/www/registry/magicui/marquee.tsx` + `apps/www/styles/globals.css` |
| vanta-net | MIT | [tengbao/vanta](https://github.com/tengbao/vanta) `f8b3519`, `src/vanta.net.js` + `src/_base.js` + `src/helpers.js` |
| vanta-waves | MIT | [tengbao/vanta](https://github.com/tengbao/vanta) `f8b3519`, `src/vanta.waves.js` + `src/_base.js` + `src/helpers.js` |
| vanta-globe | MIT | [tengbao/vanta](https://github.com/tengbao/vanta) `f8b3519`, `src/vanta.globe.js` + `src/_base.js` + `src/helpers.js` |
| cursor-spotlight | MIT | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) `1246d6d`, `apps/www/registry/magicui/magic-card.tsx` |
| page-fade | MIT | paw-fx (original; native View Transitions) |
| scroll-parallax | MIT | paw-fx (original; native scroll-driven animations) |
| scroll-type-set | MIT | [codrops/OnScrollTypographyAnimations](https://github.com/codrops/OnScrollTypographyAnimations) `af28d61`, `src/js/index.js` + `src/css/base.css` |
| link-underlines | MIT | [codrops/LineHoverStyles](https://github.com/codrops/LineHoverStyles) `5ff7fb4`, `css/base.css` + `index.html` |
| scroll-blur-text | MIT | [codrops/ScrollBlurTypography](https://github.com/codrops/ScrollBlurTypography) `3e64d4b`, `js/effect-1/blurScrollEffect.js` + `js/textSplitter.js` + `css/base.css` |
| loop-scroll-gallery | MIT | [codrops/codrops-sketches](https://github.com/codrops/codrops-sketches) `bbf47ca`, `024-infinite-loop-scrolling/js/index.js` + `024-.../css/base.css` + `025-infinite-loop-scrolling-horizontal/js/index.js` + `025-.../css/base.css` |
| curtain-transition | MIT | [codrops/codrops-sketches](https://github.com/codrops/codrops-sketches) `bbf47ca`, `021-svg-path-page-transition-vertical/js/index.js` + `021-.../css/base.css` + `022-svg-path-page-transition-horizontal/js/index.js` |
| button-hovers | MIT | [codrops/ButtonHoverStyles](https://github.com/codrops/ButtonHoverStyles) `3976fa1`, `css/base.css` + `index.html` |
| infinite-menu-loop | MIT | [codrops/ScrollLoopMenu](https://github.com/codrops/ScrollLoopMenu) `3825782`, `src/js/infinitemenu.js` + `src/css/base.css` |
| cursor-gooey | MIT | [codrops/codrops-sketches](https://github.com/codrops/codrops-sketches) `bbf47ca`, `013-custom-cursor-filter/js/index.js` + `013-custom-cursor-filter/index.html` + `013-custom-cursor-filter/css/base.css` |
| text-block-swap | MIT | [codrops/TextBlockTransitions](https://github.com/codrops/TextBlockTransitions) `f26255f`, `js/demo1/index.js` + `js/demo2/index.js` + `js/demo6/index.js` + `css/base.css` |
| grid-motion | MIT | [codrops/ImageGridMotionEffect](https://github.com/codrops/ImageGridMotionEffect) `210f970`, `src/js/demo1/grid.js` + `src/js/utils.js` + `src/css/base.css` |
| kinetic-type-transition | MIT | [codrops/KineticTypePageTransition](https://github.com/codrops/KineticTypePageTransition) `ebe926e`, `src/js/typeTransition.js` + `src/css/base.css` |
| layout-formations | MIT | [codrops/OnScrollLayoutFormations](https://github.com/codrops/OnScrollLayoutFormations) `68910ec`, `js/index.js` + `css/base.css` |
| scroll-3d-grid | MIT | [codrops/Scroll3DGrid](https://github.com/codrops/Scroll3DGrid) `69718a2`, `js/index.js` + `css/base.css` |

Six of the seven Codrops ports above replace GSAP with the vendored anime.js
(`infinite-menu-loop` uses no animation library at all upstream). That
is a licence requirement rather than a preference: GreenSock's standard "No
Charge" licence forbids use in a product that lets people build animations
without writing code, which is exactly what paw-fx is. Every timing, easing
curve, stagger, rotation and percentage is upstream's; only the spelling moved,
and each effect's `deviations` records the mapping. Their obligation is the
upstream MIT header in `index.js` plus the vendored `anime.LICENSE` the build
already emits.

None of the seven redistributes an image or a font. Codrops' demos ship
photographs under terms separate from the code and several of these effects are
image-led, so `grid-motion`, `layout-formations` and `scroll-3d-grid` paint CSS
gradients into every cell and document an `--fx-img` slot for a site's own
pictures; `infinite-menu-loop`, `text-block-swap` and `kinetic-type-transition`
drop the demos' Adobe Typekit `<link>` and `preloadFonts` call for a system
stack.

`mesh-gradient` imports its GLSL from `vendor/paper.js` rather than carrying a
copy, so the Apache-2.0 obligation it creates is the vendored one: `paper.LICENSE`
and `paper.NOTICE` are emitted into every site that uses the effect, which the
build does automatically from the `paper` key's `licenseFiles`.

Three ports copy upstream code rather than importing it, so each carries the
upstream header in `index.js`: `scramble` reimplements TypeShuffle's `fx1`
including its letter table and timing constants, `marquee-css` writes out Magic
UI's keyframes and Tailwind classes as plain CSS, and `smooth-scroll` carries
`packages/core/lenis.css` inside its `style.css` because a registry item emits
one stylesheet per effect. The two tsParticles ports and the three anime ones
copy only configuration -- options objects, timings, easings and staggers --
and call the vendored library for everything else, so their obligation is the
vendored `tsparticles.LICENSE` / `anime.LICENSE` the build already emits.

`origin.path` is a list wherever a port genuinely spans several upstream files:
`scramble` (typeShuffle.js plus the utils it imports), `smooth-scroll` (the ESM
entry plus its stylesheet) and `marquee-css` (the component plus the globals.css
that defines its keyframes). Every one of those effects also carries a
`deviations` array recording what was changed and why, which is what keeps a
necessary departure from reading as invention.
| god-rays | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/god-rays.ts` |
| metaballs | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/metaballs.ts` |
| dithering | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/dithering.ts` |
| liquid-metal | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/liquid-metal.ts` |
| water | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/water.ts` |
| sg-gloam | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `gloam/shader.frag` |
| sg-suffuse | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `suffuse/shader.frag` |
| sg-nebula-drift | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `nebula-drift/shader.frag` |
| sg-bough | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `bough/shader.frag` |
| sg-laminar | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `laminar/shader.frag` |
| sg-isobar | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `isobar/shader.frag` |
| sg-lull | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `lull/shader.frag` |
| sg-brume | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `brume/shader.frag` |
| marquee-menu-css | MIT | [codrops/CSSMarqueeMenu](https://github.com/codrops/CSSMarqueeMenu) `e7cea3a`, `css/base.css`, `index.html` |
| code-reveal-grid | MIT | [codrops/AnimatedCodeBackground](https://github.com/codrops/AnimatedCodeBackground) `4aa37f6`, `js/item.js`, `js/utils.js`, `css/base.css` |
| cursor-follow | MIT | [codrops/codrops-sketches](https://github.com/codrops/codrops-sketches) `bbf47ca`, `011-custom-cursor-filled-circle/{js/index.js,css/base.css,index.html}` |
| gooey-text | MIT | [codrops/GooeyTextHoverEffect](https://github.com/codrops/GooeyTextHoverEffect) `6db15b7`, `src/js/demo1/menuItem.js`, `src/css/base.css`, `src/index.html` |
| letter-shuffle-menu | MIT | [codrops/LetterShuffleMenu](https://github.com/codrops/LetterShuffleMenu) `32cf371`, `src/js/{menuItem,menu,menuConfig}.js`, `src/css/base.css`, `src/index.html` |
| sticky-sections | MIT | [codrops/StickySections](https://github.com/codrops/StickySections) `69c7888`, `js/demo1/index.js`, `css/base.css`, `index.html` |
| image-repeat-reveal | MIT | [codrops/RepeatingImageTransition](https://github.com/codrops/RepeatingImageTransition) `354c584`, `js/index.js`, `css/base.css`, `index.html` |

## The seven Codrops ports

Every one is MIT with a real LICENSE file in its own repo, verified at the
pinned commit by `bun run verify`'s licence rule rather than by GitHub's
`/license` guess. None of them ships a font file; the ones that reach for a
face pull a hosted Adobe Typekit stylesheet, which a generated site cannot
fetch offline, so each port declares a system stack and records the drop under
`deviations`.

None of their demo photographs travel with the code. `marquee-menu-css`,
`sticky-sections` and `image-repeat-reveal` are all image-led upstream and all
three ship CSS-gradient placeholders instead, with the slot documented in
`snippet.html` -- `image-repeat-reveal`'s is the interesting one, because the
transition copies whatever `background-image` string the thumbnail holds, so a
gradient written inline travels through the whole run exactly as a photograph
would and an author swaps in `url(...)` with nothing else to change.

GSAP appears in five of the seven upstreams and is not vendored here: its
licence forbids use in tools that let people build animations without code,
which is what paw-fx is. Every tween is rewritten onto the vendored anime.js,
with upstream's durations, staggers and easing curves carried over verbatim.
The easing map is by NAME, not by exponent -- GSAP's power scale runs
power1=Quad, power2=Cubic, power3=Quart, power4=Quint, and a bare `power3` or
`sine` means the `.out` variant -- so `power3` is `outQuart` and `sine.in` is
`inSine`. Each port declares the migration under `deviations` with
`kind: "api-migration"`.
| sg-bask | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `bask/shader.frag` |
| sg-benday | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `benday/shader.frag` |
| sg-haze | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `haze/shader.frag` |
| sg-contour | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `contour/shader.frag` |
| sg-cubit | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `cubit/shader.frag` |
| sg-louver | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `louver/shader.frag` |
| sg-pleat | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `pleat/shader.frag` |
| sg-sheen | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `sheen/shader.frag` |
| sg-weft | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `cd06eee`, `weft/shader.frag` |
| grain-gradient | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/grain-gradient.ts` |
| neuro-noise | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/neuro-noise.ts` |
| static-mesh-gradient | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/static-mesh-gradient.ts` |
| smoke-ring | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/smoke-ring.ts` |
| warp | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/warp.ts` |

## The two shader families carry their licences differently

The eleven paper-design ports import their GLSL from `vendor/paper.js` rather than
carrying a copy, so the Apache-2.0 obligation they create is the vendored one:
`paper.LICENSE` and `paper.NOTICE` are emitted into every site that uses one,
which the build does automatically from the `paper` key's `licenseFiles`. Each
`index.js` still carries the Apache-2.0 header comment and the "Powered by Paper
Shaders" attribution the upstream project asks for.

The seventeen shader.gallery ports vendor nothing. Their GLSL ships as
`effects/sg-<name>/shader.frag`, byte-identical to the upstream file at commit
`cd06eee`, SPDX header and all, and that header travels into every site because
the whole file does. `index.js` repeats the same SPDX lines, so the MIT notice is
present whether a reader opens the module or the shader.

Both families' `meta.json` carries a `deviations` list. For the shader.gallery
seventeen it is load-bearing rather than bookkeeping: their palettes and their poster
post chain (bloom, grain, vignette, dither) live in `@shader-gallery/runtime`, a
package paw-fx does not vendor, so the palettes here are ours and the output does
not match the upstream posters. Both are declared per effect, with `kind: "ours"`.
`sg-louver` is the one exception to the second half: its upstream meta.json
declares no post chain at all, so it declares only the palette.

The three Vanta ports DO carry upstream code, inlined -- a Vanta effect extends
`src/_base.js` and this repo's build emits only `index.js` and `style.css` per
effect, so a shared base module has nowhere to live in a generated site. Each
`index.js` therefore opens with Vanta's full MIT notice, which is what the
licence's "included in all copies" clause asks for, and each `meta.json.origin.path`
lists all three upstream files the port spans. `cursor-spotlight` keeps Magic UI's
notice on the same terms even though most of that port is deletion.

`page-fade` and `scroll-parallax` are ours and say so. Neither is a port and
neither claims an origin: page transitions are the browser's own cross-document
View Transitions API (swup was staged for that slot and dropped -- every ES
module build it publishes carries unresolvable bare specifiers), and every
parallax in the Codrops corpus is built on GSAP ScrollSmoother, Lenis or
Locomotive Scroll, so there is no vanilla upstream to port. Both are built on
native CSS instead, and both record the reasoning in `meta.json.deviations`
under `kind: "ours"`.

## The six Codrops ports of 2026-09

`scroll-type-set`, `link-underlines`, `scroll-blur-text`, `loop-scroll-gallery`,
`curtain-transition` and `button-hovers` all come from repos in the `codrops`
org that carry a real `LICENSE` file with full MIT text -- not the older
"don't republish, redistribute or sell as-is" READMEs that cover the pre-2020
catalogue, which has no LICENSE file at all and is excluded from this library
entirely. `CANDIDATES.md` records the licence gate that separated the two.

None of the six ships a byte of Codrops' imagery or type. Every one of those
repos pulls its display faces from a hosted Adobe Typekit kit rather than
bundling font files, so the port drops the `<link>` or the `WebFont.load` call
and declares a system stack. `loop-scroll-gallery` is the only one whose
upstream carries photographs -- credited to a named photographer and licensed
separately from the code -- so its cells paint CSS gradients behind a
`--fx-img` custom property a site fills with its own picture.

GSAP does not ship in any of them. Its licence bars use in a tool that lets
people build animations without writing code, which is what a site-building
agent is, so the four ports with motion are rebuilt on the vendored anime.js
v4: `animate()` for its tweens, `onScroll()` for ScrollTrigger's scrub,
`createTimeline()` for its timelines. Two translations are mechanical and easy
to get silently wrong, so both are named in every affected `meta.json`:
GSAP's `powerN` is degree N+1 (`power4` is a quintic, not a quartic), and
ScrollTrigger's `start: 'target container'` is anime's
`enter: 'container target'` -- the halves are the other way round.
