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
