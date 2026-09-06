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

`mesh-gradient` imports its GLSL from `vendor/paper.js` rather than carrying a
copy, so the Apache-2.0 obligation it creates is the vendored one: `paper.LICENSE`
and `paper.NOTICE` are emitted into every site that uses the effect, which the
build does automatically from the `paper` key's `licenseFiles`.
