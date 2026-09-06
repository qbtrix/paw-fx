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
| vanta-net | MIT | [tengbao/vanta](https://github.com/tengbao/vanta) `f8b3519`, `src/vanta.net.js` + `src/_base.js` + `src/helpers.js` |
| vanta-waves | MIT | [tengbao/vanta](https://github.com/tengbao/vanta) `f8b3519`, `src/vanta.waves.js` + `src/_base.js` + `src/helpers.js` |
| vanta-globe | MIT | [tengbao/vanta](https://github.com/tengbao/vanta) `f8b3519`, `src/vanta.globe.js` + `src/_base.js` + `src/helpers.js` |
| cursor-spotlight | MIT | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) `1246d6d`, `apps/www/registry/magicui/magic-card.tsx` |
| page-fade | MIT | paw-fx (original; native View Transitions) |
| scroll-parallax | MIT | paw-fx (original; native scroll-driven animations) |

`mesh-gradient` imports its GLSL from `vendor/paper.js` rather than carrying a
copy, so the Apache-2.0 obligation it creates is the vendored one: `paper.LICENSE`
and `paper.NOTICE` are emitted into every site that uses the effect, which the
build does automatically from the `paper` key's `licenseFiles`.

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
