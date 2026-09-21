# Licences

paw-fx itself is MIT; the notice is in `LICENSE` at the repo root. Every
ported effect keeps its upstream licence; the
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
| parallax-gallery-horizontal | MIT | [davidfaure/horizontal-parallax-gallery-codrops](https://github.com/davidfaure/horizontal-parallax-gallery-codrops) `49c3ead`, `src/main.ts` + `src/gallery/index.ts` + `src/gallery/gallery.css` + `src/utils/math.ts` + `index.html` |
| dual-wave-text | MIT | [ValentinDBS/codrops-tutorial-text-animation](https://github.com/ValentinDBS/codrops-tutorial-text-animation) `90dfeb2`, `src/dual-wave/DualWaveAnimation.js` + `src/dual-wave/style.css` + `src/main.js` + `index.html` |
| shader-ripple-tiles | MIT | [biazo/codrops-animate-shaders-with-gsap](https://github.com/biazo/codrops-animate-shaders-with-gsap) `bdd17aa`, `src/js/demo1/Effect.js` + `Stage.js` + `PlanesMaterial.js` + `base.vert` + `base.frag` + `src/js/utils.js` + `src/css/base.css` + `index.html` |
| gradient-carousel | MIT | [clementgrellier/gradientslider](https://github.com/clementgrellier/gradientslider) `6773280`, `script.js` + `styles.css` + `index.html` |

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
| **Codrops wave, ranks 21-36 (fx-cd-d)** | | |
| text-repetition | MIT | [codrops/TextRepetitionEffect](https://github.com/codrops/TextRepetitionEffect) `fabaafe`, `src/js/demo1/repeatTextScrollFx.js` + `src/js/utils.js` + `src/css/base.css` |
| sliced-text | MIT | [codrops/SlicedTextEffect](https://github.com/codrops/SlicedTextEffect) `45bbcfd`, `js/item.js` + `js/index.js` + `css/base.css` |
| circular-text | MIT | [codrops/CircularTextEffect](https://github.com/codrops/CircularTextEffect) `fcd9aaa`, `src/js/demo1/intro.js` + `src/index.html` + `src/css/base.css` |
| terminal-hover | MIT | [codrops/LineTextHoverAnimations](https://github.com/codrops/LineTextHoverAnimations) `00fdd50`, `js/effect-1/text-animator.js` + `js/effect-1/index.js` + `js/textSplitter.js` + `css/base.css` |
| image-trail | MIT | [codrops/codrops-sketches](https://github.com/codrops/codrops-sketches) `bbf47ca`, `005-image-motion-trail-opaque/js/index.js` + `005-image-motion-trail-opaque/css/base.css` |
| pixel-tooltip | MIT | [codrops/PixelGooeyTooltip](https://github.com/codrops/PixelGooeyTooltip) `60ade47`, `js/tooltip.js` + `js/index.js` + `css/tooltip.css` + `index.html` |
| clip-hover | MIT | [codrops/ClipHoverEffect](https://github.com/codrops/ClipHoverEffect) `57b5cc1`, `js/card.js` + `js/utils.js` + `css/base.css` |
| grid-3d-stagger | MIT | [codrops/Staggered3DGridAnimations](https://github.com/codrops/Staggered3DGridAnimations) `7c2703d`, `js/index.js` + `index.html` + `css/base.css` |
| expanding-menu | MIT | [codrops/ExpandingRoundedMenu](https://github.com/codrops/ExpandingRoundedMenu) `9f8174a`, `src/js/index.js` + `src/index.html` + `src/css/base.css` |
| card-stack-scroll | MIT | [codrops/3DStackMotion](https://github.com/codrops/3DStackMotion) `75cbda9`, `js/effect-1/stackMotionEffect.js` + `js/utils.js` + `index.html` + `css/base.css` |


The ten Codrops ports at ranks 21-36 all copy upstream code rather than calling
a library for it, so each carries the upstream MIT header in `index.js` and each
`origin.path` lists every upstream file the port spans -- the effect class, the
`utils.js` the class imports from, the `index.html` when the markup carries part
of the mechanism (the four `<textPath>` rings, the tooltip's cell grid), and the
`base.css` when the layout does (the stacked grid cell that makes
`text-repetition` read as one word, the overflow window each `sliced-text` band
looks through). Nine of the ten call the vendored anime.js for the motion GSAP
used to drive, so their runtime obligation is the `anime.LICENSE` the build
already emits; `image-trail` needs nothing at all, because its upstream sketch
is a `requestAnimationFrame` loop with no library under it.

**None of them ships a photograph or a typeface.** Codrops licenses the demo
imagery separately from the code, so every image-led port here paints a CSS
gradient instead and documents the slot a site author fills: `--fx-image` on
`image-trail` and `clip-hover`, `--fx-cover-image` on `expanding-menu`,
`--fx-card-image` and `--fx-cell-image` per card and per cell on
`card-stack-scroll` and `grid-3d-stagger`. Each records that swap in
`meta.json.deviations` under `kind: "ours"`. The Typekit stylesheets 23 of the
surveyed repos pull in through a `<link>` or a `WebFont.load` call are dropped
the same way; every effect here declares a system stack.

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
| plane-morph | MIT | [bnpne/page-transitions-with-webgpu-vanilla-js](https://github.com/bnpne/page-transitions-with-webgpu-vanilla-js) `70e5c0e`, `src/gpu.js`, `src/controller.js`, `src/transitions/*`, `src/pages/*`, `src/global.css` |
| wave-grid | MIT | [franky-adl/3d-wave-grid](https://github.com/franky-adl/3d-wave-grid) `f1fe514`, `src/ThreeJS/{Stage,Camera,Renderer,Orchestrator}.js`, `src/ThreeJS/Effects/MouseTrail.js`, `src/script.js` |
| rotate-scroll-gallery | MIT | [codrops/RotatingOnScrollAnimations](https://github.com/codrops/RotatingOnScrollAnimations) `ebbe2c9`, `js/index5.js` + `js/{index,index3,index4}.js`, `css/base.css`, `index.html` |
| dither-relief | MIT | [codepen.io/damarberlari/pen/pvgKamj](https://codepen.io/damarberlari/pen/pvgKamj), snapshot `774ee937`, retrieved 2026-09-07 |
| glass-transition | MIT | [codepen.io/filipz/pen/JoGNQzm](https://codepen.io/filipz/pen/JoGNQzm), snapshot `504e2901`, retrieved 2026-09-07 |

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
| sg-hologram | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `4e8d4cb`, `hologram/shader.frag` |
| sg-suminagashi | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `4e8d4cb`, `suminagashi/shader.frag` |
| sg-obsidian | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `4e8d4cb`, `obsidian/shader.frag` |
| sg-rainglass | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `4e8d4cb`, `rainglass/shader.frag` |
| sg-lightleak | MIT | [shader-gallery/shaders](https://github.com/shader-gallery/shaders) `4e8d4cb`, `lightleak/shader.frag` |
| gobo-light | MIT | [thevangelist/tinseltown](https://github.com/thevangelist/tinseltown) `e31bfc8`, `src/tinseltown.js` + `src/shader.js` + `src/optics.js` + `src/options.js` + `src/cookies.js` |
| bioluminescent-sea | MIT | [Raflael/ardentia](https://github.com/Raflael/ardentia) `7e1a155`, `index.html` |
| grain-gradient | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/grain-gradient.ts` |
| neuro-noise | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/neuro-noise.ts` |
| static-mesh-gradient | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/static-mesh-gradient.ts` |
| smoke-ring | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/smoke-ring.ts` |
| warp | Apache-2.0 | [paper-design/shaders](https://github.com/paper-design/shaders) `7002061`, `packages/shaders/src/shaders/warp.ts` |
| ascii-plasma | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/plasma.js` + `src/util.js` + `src/main.js` |
| ascii-matrix | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/matrix.js` + `src/util.js` + `src/main.js` |
| ascii-tunnel | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/tunnel.js` + `src/main.js` |
| ascii-smoke | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/smoke.js` + `src/main.js` |
| ascii-torus | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/torus.js` + `src/main.js` |
| ascii-life | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/life.js` + `src/main.js` |
| ascii-wave | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/wave.js` + `src/util.js` + `src/main.js` |
| ascii-glitch | MIT | [metaory/ascii-lab](https://github.com/metaory/ascii-lab) `639584c`, `src/effects/glitch.js` + `src/main.js` |
| snow-fall | MIT | [tsparticles/presets](https://github.com/tsparticles/presets) `ae866a5`, `presets/snow/src/options.ts` |
| bokeh-drift | MIT | [tsparticles/presets](https://github.com/tsparticles/presets) `ae866a5`, `presets/ambient/src/options.ts` |
| confetti-burst | MIT | [tsparticles/presets](https://github.com/tsparticles/presets) `ae866a5`, `presets/confettiExplosions/src/options.ts` |
| points-waves | MIT | [mrdoob/three.js](https://github.com/mrdoob/three.js) `2431a09`, `examples/webgl_points_waves.html` |
| firefly-swarm | MIT | [juliangarnier/anime](https://github.com/juliangarnier/anime) `01b81be`, `examples/additive-fireflies/index.js` + `examples/additive-fireflies/index.html` |
| canvas-trails | MIT | [juliangarnier/anime](https://github.com/juliangarnier/anime) `01b81be`, `examples/canvas-2d/index.js` + `examples/canvas-2d/index.html` |
| morph-nav | MIT | [juliangarnier/anime](https://github.com/juliangarnier/anime) `01b81be`, `examples/auto-layout/nav/index.js` + `examples/auto-layout/nav/index.html` |
| dock-magnify | MIT | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) `1246d6d`, `apps/www/registry/magicui/dock.tsx` |
| paw-avatar | MIT | [jeremy-prt/bloub](https://github.com/jeremy-prt/bloub) `b4bb3c1`, `src/bot/math.ts` + `src/bot/shape.ts` + `src/bot/face.ts` + `src/bot/engine.ts` |

## The two shader families carry their licences differently

The eleven paper-design ports import their GLSL from `vendor/paper.js` rather than
carrying a copy, so the Apache-2.0 obligation they create is the vendored one:
`paper.LICENSE` and `paper.NOTICE` are emitted into every site that uses one,
which the build does automatically from the `paper` key's `licenseFiles`. Each
`index.js` still carries the Apache-2.0 header comment and the "Powered by Paper
Shaders" attribution the upstream project asks for.

The twenty-two shader.gallery ports vendor nothing. Their GLSL ships as
`effects/sg-<name>/shader.frag`, byte-identical to the upstream file, SPDX header
and all, and that header travels into every site because the whole file does.
`index.js` repeats the same SPDX lines, so the MIT notice is present whether a
reader opens the module or the shader. Seventeen are pinned at `cd06eee`; the
five added since, `sg-hologram` and `sg-suminagashi` from the 2026-09-14 survey,
`sg-obsidian` and `sg-rainglass` from 2026-09-18, and `sg-lightleak` from
2026-09-20, are pinned at
`4e8d4cb`, the head after the 59-shader expansion of 2026-09-08/09. Nothing was
re-pinned: a commit is a coordinate, not a version, and the seventeen still
resolve at theirs.

Both families' `meta.json` carries a `deviations` list. For the shader.gallery
twenty-two it is load-bearing rather than bookkeeping: their palettes and their poster
post chain (bloom, grain, vignette, dither) live in `@shader-gallery/runtime`, a
package paw-fx does not vendor, so the palettes here are ours and the output does
not match the upstream posters. Both are declared per effect, with `kind: "ours"`.
`sg-louver` is the one exception to the second half: its upstream meta.json
declares no post chain at all, so it declares only the palette. The two newest are
an exception to the first half and in the other direction: their upstream
meta.json declares `palette: null`, so the shader's own built-in four are what
upstream renders with, and the port passes exactly those — declared as `kind:
"seam"` rather than `"ours"`, because the colours are upstream's and only the
route to them is paw-fx's.

`paw-avatar` is the one port where the upstream licence and the upstream LOOK
come apart, and the split is upstream's own: bloub's README says its MIT licence
covers the code, not the x.ai avatar design it recreates. So the engine is
ported -- the radial silhouette machinery, the sphere the eyes sit on, the blink
calendar, the clock-free `sample(t)` and the frozen-departure pose that keeps a
mid-fade state change continuous -- and none of the geometry is. Upstream's
`PROFILES` arrays and its fourteen states are frame-by-frame measurements of
that avatar and appear nowhere here. The Paw is our own drawing, committed
alongside the effect at `effects/paw-avatar/art/paw-os-glass-puppy.svg`: its
three paths and its glass are what `index.js` carries, cast to radial profiles
at load. `meta.json` declares the whole split under `deviations`, with
`kind: "ours"`.

That drawing -- the Paw character itself -- carries its own licence, the same
code/design split upstream draws for its own situation: the effect's CODE is
MIT, and the CHARACTER (the three paths in `PAW_ART`, the committed SVG, and
every render of them) is Creative Commons Attribution 4.0. Use the character
wherever you like, commercially included, with visible credit -- "Paw
character by qbtrix", linked to <https://github.com/qbtrix/paw-mascot>, where
the art licence lives as `LICENSE-ART.md`. The registry's `license` field
stays `MIT` because it describes the code, exactly as bloub's does. The Paw
name, and the character used as the identity of a product, stay the
project's; credit says where the art came from, it does not make something an
official Paw.

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

Four more ports land from a second survey, and three of the four repeat the
pattern above. `parallax-gallery-horizontal` needed the least work of any port
here: GSAP appears in it only as `utils.interpolate` and `utils.clamp` inside
`src/utils/math.ts`, one line each, written out rather than replaced.
`dual-wave-text` swaps `gsap.quickTo` for anime's `createAnimatable` and
ScrollTrigger for `onScroll`, and drops ScrollSmoother rather than replacing it,
because page-level smooth scrolling is `smooth-scroll`'s job.
`shader-ripple-tiles` is the one that had to leave code behind: its upstream
carousel shell is built on Draggable, ScrollTrigger and **InertiaPlugin**, which
is Club GreenSock and paid, so `src/js/demo*/main.js` is deliberately outside
`origin.path` and the tiles mount on a plain CSS grid instead. Its two shaders
are carried byte for byte. `gradient-carousel` had two GSAP call sites in 971
lines and both tween a plain object.

Two obligations beyond the code are worth naming separately.
`dual-wave-text`'s upstream ships **24 real company names and 24 company logo
files**. An MIT grant covers the author's own code and cannot grant rights in a
third party's trade marks, so none of them ship: both of its columns carry
invented words and the logos are gone. And none of the four redistributes an
image: `parallax-gallery-horizontal` paints CSS gradients behind `--fx-img`,
while `shader-ripple-tiles` and `gradient-carousel` carry generated SVG plates
in a real `<img src>` -- those two sample or texture from the picture's actual
pixels, so unlike every other image slot here theirs cannot be a CSS background.

GSAP does not ship in any of them. Its licence bars use in a tool that lets
people build animations without writing code, which is what a site-building
agent is, so the four ports with motion are rebuilt on the vendored anime.js
v4: `animate()` for its tweens, `onScroll()` for ScrollTrigger's scrub,
`createTimeline()` for its timelines. Two translations are mechanical and easy
to get silently wrong, so both are named in every affected `meta.json`:
GSAP's `powerN` is degree N+1 (`power4` is a quintic, not a quartic), and
ScrollTrigger's `start: 'target container'` is anime's
`enter: 'container target'` -- the halves are the other way round.

## The five ports of 2026-09-07, and the two sources with no commit

Three of the five pin the ordinary way. `bnpne/page-transitions-with-webgpu-
vanilla-js` and `codrops/RotatingOnScrollAnimations` both carry a real MIT
`LICENSE` in the `codrops` house form; `franky-adl/3d-wave-grid` carries its
own, opening `MIT License / Copyright (c) 2026 franky-adl`. All three are
verified at the pinned commit by `bun run verify`'s licence rule, from the
licence text itself rather than from GitHub's guess.

**The other two are CodePens, and a pen has no commit.** `origin` therefore
takes its second shape -- `url`, `retrieved`, `sha256` and `snapshot` -- and the
gate hashes a committed copy of the source under
`tests/fixtures/upstream-snapshots/` instead of re-fetching a revision. That is
weaker than a commit in one specific way and it is worth being plain about it:
it proves we still ship what we ported from, not that upstream still says the
same thing. It is stronger in another, because the bytes cannot vanish -- one
external script the dither pen loads had already 404'd inside ten months.

**What is pinned is the author's three panels, not the host's page.** CodePen's
`cdpn.io/<user>/fullpage/<slug>` wrapper carries content-hashed asset URLs, a
referer warning, CodePen's own stylesheets and a `stopExecutionOnTimeout` guard,
and its bytes move whenever CodePen redeploys -- measured, not assumed: the
filipz wrapper hashed `8b7bfd1c` in a survey on 2026-09-07 at 05:34Z and
`2e85b1ec` when it was fetched again half an hour later, 76 203 bytes against
76 081. Hashing that would false-fail on CodePen's churn and diff against code
the author never wrote. `scripts/extract-panels.py` instead pulls the HTML, CSS
and JS panels out of the `srcdoc` document the wrapper embeds and concatenates
them in that fixed order behind labelled delimiters, under a header carrying the
MIT notice as CodePen prints it at `codepen.io/<user>/details/<slug>`, the
retrieval date, and the wrapper's own bytes and hash as a receipt.

Three transformations are applied, all mechanical and all declared in each
snapshot's own header: CodePen's injected loop guards
(`window.CP.shouldStopExecution` / `exitedLoop`) and its `window.console` shim
are removed, because CodePen's compiler adds them and the author did not write
them; base64 image data URIs are replaced by the token `PHOTOGRAPH-REMOVED`; and
CodePen's own `<style>`/`<script>` tags are dropped. That second one is a
licence obligation as much as a size one -- 114 758 of the dither pen's 126 092
characters are an embedded portrait, which is content under separate rights, and
committing it inside a fixture would be redistributing someone's photograph
under a code licence.

**No photograph and no typeface ships in any of the five.** `plane-morph`,
`glass-transition` and `dither-relief` all sample the picture's actual pixels,
so their slots have to stay real `<img>` elements rather than CSS backgrounds --
the same call `shader-ripple-tiles` and `gradient-carousel` made -- and each
carries a generated SVG plate a site swaps for its own picture in one attribute.
`rotate-scroll-gallery` paints a gradient behind `--fx-img` like the rest of the
gallery shelf. `glass-transition` additionally drops upstream's `@import` of PP
Neue Montreal and its `@font-face` for PP Supply Mono off `assets.codepen.io`:
both are commercially licensed, neither is ours to redistribute or to hotlink,
and paw-fx fetches nothing off-site in any case.

GSAP ships in none of them. It was the tween runner in four of the five and
never the mechanism -- one `fromTo` in `glass-transition`'s 1 904 lines, one
staggered fade in `wave-grid`, plain `bounds` and `opacity` tweens in
`plane-morph`, and `ScrollTrigger.create` with the maths in `onUpdate` in
`rotate-scroll-gallery`. `dither-relief`'s upstream was already on anime.js v4,
which is the version vendored here, so its durations, easings and sync offsets
are carried unchanged and only the import path moved.

Two ports leave code behind on purpose. `plane-morph`'s upstream is a
single-page app: the router, preloader, cursor, carousel and the whole `/index`
page are outside `origin.path`, and its `src/gpu.js` imports `three/webgpu` and
`three/tsl` -- a different three build from the classic one vendored here -- so
the material layer is rewritten as a `ShaderMaterial` carrying the rounded-box
SDF the TSL `opacityNode` built. That is an `api-migration`, not a redesign: no
compute shader, no storage buffer and no indirect draw is involved, and the
author writes in the Codrops article that the technique works the same on WebGL.
`wave-grid` drops the post-processing pass entirely, because its `EffectComposer`,
`RenderPass`, `ShaderPass` and `OutputPass` all come from `three/addons` and
paw-fx vendors core three only. Hand-rolling a composer to recover an edge
vignette would be forty lines of our own code standing in for a file we cannot
import, which is the shape of invention this library's gate exists to catch;
dropping it and saying so in `deviations` is the honest trade.

## The ascii-lab family

The eight `ascii-*` effects are one upstream, `metaory/ascii-lab` at
`639584cb2eb48e71aae36a547a6565e942d1ff1a`, MIT, "Copyright (c) 2025 metaory".
They are the first character-grid effects on the shelf, and they share
`effects/_shared/ascii-grid.js`, which carries three helpers from upstream's
`src/util.js` verbatim plus the seam that replaces `src/main.js` -- so that file
carries the upstream header comment too, even though lint only reads `index.js`.

`src/main.js` is listed in every one of the eight `origin.path` lists rather
than only where its code was copied, because the grid seam is derived from its
`colsRows()` and leaving it out would make that derivation read as invention.

Upstream ships **no static fallback**: its `<pre>` is empty until the script
runs. Every one of the eight therefore carries an authored resting frame in
`snippet.html` -- a real frame of that effect, dumped from its own `index.js` at
the grid it declares, chosen rather than taken from frame one. `ascii-life`'s is
a settled generation instead of the random seed, because a seed reads as static
where a settled board reads as a paused automaton.

Nine of the seventeen effects upstream exports were not taken. `vortex` and
`ripple` are the same per-cell-field-onto-a-density-ramp mechanism as `plasma`
and `tunnel`; `radar` is that too, with noise over it that swamps its sweep at
section size; `snow`, `sparks` and `rain` set their particle counts from
`w * h * 0.02` or less, which is a few dozen glyphs in a panel; `fractal` is a
Julia set whose interior is empty at these dimensions; `lightning` draws its
bolts as single cells with a glow, which reads as dotted vertical lines rather
than as lightning; and `bubbles` is a third rising-particle effect next to
`smoke` and a second circle-rasteriser next to `torus`. `galaxy.js` exists on
disk upstream but is not exported from `src/effects/index.js`, and a `fire`
effect was removed before this commit.

