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

## The two shader families carry their licences differently

The six paper-design ports import their GLSL from `vendor/paper.js` rather than
carrying a copy, so the Apache-2.0 obligation they create is the vendored one:
`paper.LICENSE` and `paper.NOTICE` are emitted into every site that uses one,
which the build does automatically from the `paper` key's `licenseFiles`. Each
`index.js` still carries the Apache-2.0 header comment and the "Powered by Paper
Shaders" attribution the upstream project asks for.

The eight shader.gallery ports vendor nothing. Their GLSL ships as
`effects/sg-<name>/shader.frag`, byte-identical to the upstream file at commit
`cd06eee`, SPDX header and all, and that header travels into every site because
the whole file does. `index.js` repeats the same SPDX lines, so the MIT notice is
present whether a reader opens the module or the shader.

Both families' `meta.json` carries a `deviations` list. For the shader.gallery
eight it is load-bearing rather than bookkeeping: their palettes and their poster
post chain (bloom, grain, vignette, dither) live in `@shader-gallery/runtime`, a
package paw-fx does not vendor, so the palettes here are ours and the output does
not match the upstream posters. Both are declared per effect, with `kind: "ours"`.
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
