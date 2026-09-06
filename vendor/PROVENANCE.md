<!-- PROVENANCE.md - written 2026-09-06 alongside the staged vendor files, landed in
     vendor/ unchanged except for this header and the swup note below. Records exactly
     where each file came from so the copies shipped inside generated websites can be
     re-derived and audited. One row per file that was staged, which is one row more
     than vendor/ holds: swup was dropped before landing and its row is history, not
     inventory. Everything else here describes a file that is present. -->

# paw-fx vendor provenance

Fetched **2026-09-06**. Every version below is at least 7 days old, per the workspace
supply-chain floor. No flag was used to bypass that check; where the newest release was
too fresh the next-oldest release was taken instead (see *Version step-downs*).

| key | npm package | version | staged file | dist path in tarball | sha256 | bytes | gzip | SPDX | source |
|-----|-------------|---------|-------------|----------------------|--------|-------|------|------|--------|
| `anime` | `animejs` | 4.5.0 | `anime.esm.js` | `package/dist/bundles/anime.esm.js` | `a88ebfb5bd290f25215692edce71a74c0fc37bdb9e0ff70bd17135c5c3ef33b6` | 408,414 | 93,271 | MIT | https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz |
| `three` | `three` | 0.185.1 | `three.module.js` | `package/build/three.module.js` | `bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7` | 650,153 | 128,924 | MIT | https://registry.npmjs.org/three/-/three-0.185.1.tgz |
| `three` | `three` | 0.185.1 | `three.core.js` | `package/build/three.core.js` | `3718df126d69c125362a03340913204470d8c50238605150e57f808840fb7759` | 1,443,056 | 283,484 | MIT | https://registry.npmjs.org/three/-/three-0.185.1.tgz |
| `paper` | `@paper-design/shaders` | 0.0.80 | `paper.js` | `(none - see note A)` | `a83c4fa34543232b72053dbda245250b77531425c2665984fc672dd619995118` | 203,890 | 61,323 | Apache-2.0 | https://cdn.jsdelivr.net/npm/@paper-design/shaders@0.0.80/+esm |
| `tsparticles` | `@tsparticles/slim` | 4.3.2 | `tsparticles.slim.bundle.min.js` | `package/tsparticles.slim.bundle.min.js` | `a41ac21df23b08b79ddcd1f18a5de300a45c8df2b865759a2aa76db4581bdfd9` | 154,648 | 43,078 | MIT | https://registry.npmjs.org/@tsparticles/slim/-/slim-4.3.2.tgz |
| `lenis` | `lenis` | 1.3.26 | `lenis.js` | `package/dist/lenis.mjs` | `b7a2f6896b9ce086d8192ff17c91aad457447976764971fe5011c42169602e9e` | 33,166 | 8,226 | MIT | https://registry.npmjs.org/lenis/-/lenis-1.3.26.tgz |
| `swup` | `swup` | 4.9.2 | `Swup.modern.js` | `package/dist/Swup.modern.js` | `4611710f6335fe9894a8b9e3723d6cd93e8a529545cbefd422bddfe6795ba784` | 21,488 | 7,212 | MIT | https://registry.npmjs.org/swup/-/swup-4.9.2.tgz |

Gzip sizes are level 9. Licence text for each key sits beside it as `<key>.LICENSE`;
`paper.NOTICE` is here too because Apache-2.0 requires the NOTICE file to travel with
redistributed copies.

## The swup row is historical

`Swup.modern.js` and `swup.LICENSE` were staged and then **not** landed, so neither is in
`vendor/` and neither appears in `vendor/manifest.json`. Every ES module build swup
publishes externalises `delegate-it` and `path-to-regexp` as bare specifiers, and a
generated site has no build step or import map to resolve them, so the file 404s at
runtime in production and nowhere else. Page transitions use the native View Transitions
API instead, which costs no vendored bytes at all. The row stays in the table because it
records a fetch that happened and the reasoning that followed from it; `tests/vendor.test.js`
asserts both directions of the manifest, so a stray copy drifting back into `vendor/`
fails the suite rather than shipping.

## Version step-downs (supply-chain floor)

| package | latest on 2026-09-06 | published | taken instead | why |
|---------|----------------------|-----------|---------------|-----|
| `@tsparticles/slim` | 4.4.0 | 2026-08-31 | **4.3.2** (2026-07-10) | 6 days old, under the 7-day floor |
| `@tsparticles/engine` | 4.4.0 | 2026-08-31 | **4.3.2** (2026-07-10) | same; version-locked to slim |
| `swup` | 4.10.0 | 2026-09-03 | **4.9.2** (2026-06-12) | 3 days old, under the 7-day floor |

`animejs` 4.5.0, `three` 0.185.1, `@paper-design/shaders` 0.0.80 and `lenis` 1.3.26 were
already the latest stable release *and* comfortably past the floor, so no step-down applied.
For `@paper-design/shaders` the newer `0.0.0-canary.*` tags were ignored: canary, not stable.

## Note A - `paper.js` is a transform, not a published file

`@paper-design/shaders` ships no single-file build. Its tarball `dist/` is 40 ES modules
wired together with relative imports (`dist/index.js` is a 5 KB re-export barrel). The
staged `paper.js` is jsDelivr's `+esm` build of that pinned version - esbuild-flattened by
jsDelivr, self-contained, zero imports. It is **not** a byte-for-byte artifact the
publisher signed.

The file carries jsDelivr's own banner, which is the real provenance record for this row:

```
/**
 * Bundled by jsDelivr using Rollup v4.62.2 and esbuild v0.28.1.
 * Original file: /npm/@paper-design/shaders@0.0.80/dist/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
```

**Read that last line carefully.** jsDelivr is telling us it does not guarantee byte-stable
output for `+esm` URLs: the bytes are a function of whatever Rollup and esbuild versions its
builder happens to be on. Two fetches during this run returned identical bytes
(`a83c4fa34543232b72053dbda245250b77531425c2665984fc672dd619995118`), so it is stable *right
now*, and the file is staged and vendored so the bytes we ship are frozen regardless. But the
sha256 in the table above is **not** reproducible from the URL indefinitely - re-fetching
after a jsDelivr toolchain bump can legitimately produce a different hash for the same
package version. Treat the staged file as the artifact of record, not the URL.

The alternative is staging all 40 files under a `paper/` subdirectory and importing
`paper/index.js`. That keeps publisher-exact bytes, is reproducible from the tarball forever,
and costs 40 files and 260 KB instead of 1 file and 204 KB.

## Note B - `three` is intentionally two files

Recent three.js releases split the module build, 0.185.1 included: `three.module.js`
re-exports from `./three.core.js` and pulls the bulk of the library from that sibling.
(The exact release that introduced the split was not verified and is not asserted here.)
**Neither file may be renamed** - the string `./three.core.js` inside `three.module.js`
pins the sibling's filename. Both must sit in the same directory.

The minified pair is available at the same tarball path and is roughly half the size
(`three.module.min.js` 365,552 B + `three.core.min.js` 385,386 B, importing
`./three.core.min.js`). Swap both together if size matters more than readable stack traces.

## Note C - dependencies that would be pulled in by bundling

Not staged, listed so the licence surface is known if `swup` is later bundled:

| package | resolved | SPDX |
|---------|----------|------|
| `delegate-it` | 6.4.0 | MIT |
| `path-to-regexp` | 6.3.0 | MIT |

