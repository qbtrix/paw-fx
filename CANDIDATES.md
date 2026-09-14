# Codrops candidates for paw-fx

Survey date **2026-09-14**. The body of this file is the 2026-09-06 org survey
and is unchanged; the dated log at the bottom carries everything screened since.
Every sha below is the head of the named repo's
default branch at that moment, resolved through
`gh api repos/codrops/<name>/branches/<default>` — a real 40-hex commit, never a
branch name.

---

## What I actually did, and what I did not

- **Enumerated the whole org**, not a search: 345 repos via
  `gh api orgs/codrops/repos --paginate`. Raw metadata in `codrops-fresh.tsv`
  (name, spdx, stars, pushed, created, default branch, size, description).
- **Ran the licence gate on all 126** repos the API flags MIT — four calls each:
  `contents/LICENSE` (size + decoded head), `readme` (decoded, grepped for the
  restrictive clause), `branches/<default>` for the sha, and
  `git/trees/<sha>?recursive=1` for the file list. Per-repo evidence is on disk
  under `cd/<repo>/` (`lic.size`, `lic.head`, `README`, `sha`, `tree`).
- **Fetched `package.json`** for all 68 repos that have one, and **fetched the
  actual source** (JS/CSS/HTML, non-minified, <60 KB) for 66 shortlisted repos —
  6.0 MB of real code — then read it. The GSAP-weight calls below come from
  counting `gsap.timeline` / `gsap.to` / `gsap.fromTo` / `scrub` / `Flip.` /
  `Observer.create` in that source, not from guessing at titles.
- **Fetch-checked every triple I cite**: all **76** `(repo, sha, path)` pairs in
  the candidate table were re-fetched through
  `GET repos/codrops/{repo}/contents/{path}?ref={sha}` and returned a byte size.
  **76/76 resolved, 0 failures.** That is the same operation the verification
  gate performs, so no path below is a plausible-looking guess. Log:
  `fetchcheck.txt`.

**I could not see the demos render.** No browser was opened. Every visual
description below is reconstructed from three sources: the demo's own source and
CSS, the repo description (which is Codrops' own article blurb), and the markup
of `index.html`. Where a description says "looks like X", read it as "the code
does X", not "I watched it". One WebFetch of `tympanus.net/codrops/demos/` was
made to check the recent-demo hub (see *The hub pages* below).

**Prior work reused, not redone.** `port-sources.md` in this same scratchpad
already resolved `codrops/TypeShuffleAnimation` (shipped as `scramble`) and
already judged `codrops/ElasticGridScroll` as ScrollSmoother-dependent. Neither
is re-examined here.

---

## The licence finding, up front

The brief's worry is real and I confirmed the discriminator, but the split is
cleaner than expected and it is **not** the 126/74 mix the earlier pass sampled:

| | count |
|---|---|
| Repos in the `codrops` org | 345 |
| With a real `LICENSE` file containing full MIT text | **126** |
| With no `LICENSE` file at all | **219** |
| Of the 126, carrying a restrictive README clause | **0** |

Every one of the 126 carries genuine MIT text (1064–1103 bytes; the variance is
only the copyright line — `2009-2020` through `2009-2026 [Codrops]`, plus nine
under `Manoela Ilic` or plain `Codrops`). **None of them** matches
`as-is|pluginized|republish|redistribute` anywhere in its README. So on this org
there is no repo where the LICENSE file and the README conflict — the "real
LICENSE *and* the clause" case the check was designed to catch does not occur.

The check is not vacuous. Control run on 13 attractive `LICENSE`-less repos:
all 13 return 404 on `contents/LICENSE`, and 9 of the 13 carry the clause
verbatim. Two wordings are in circulation:

> "It is not allowed to take the resource "as-is" and sell it, redistribute,
> re-publish it, or sell "pluginized" versions of it."
> — `codrops/StackMotionHoverEffects` README

> "Don't republish, redistribute or sell "as-is"."
> — `codrops/HoverEffectIdeas`, `PageLoadingEffects`, `BlockRevealers`,
> `SegmentEffect`, `OffCanvasMenuEffects`, `FullscreenOverlayStyles`,
> `LineMenuStyles` READMEs

The other four (`PageTransitions`, `GridLoadingEffects`, `ModalWindowEffects`,
`CreativeLinkEffects`) carry no clause text but also no LICENSE file — their
README ends at a bare link to `tympanus.net/codrops/licensing/`. That is the
"MIT if not otherwise mentioned" page, which is a claim on a web page and not a
licence grant in the repo. **Excluded on rule 1 anyway: no LICENSE file, no
evidence.**

The practical consequence: **the org splits almost perfectly by age.** Repos
pushed 2020 and later carry MIT files; the 2013–2018 jQuery-era classics
(`PageTransitions` 2311★, `SidebarTransitions` 1655★, `HoverEffectIdeas` 1643★)
carry none. The high-star head of the catalogue is exactly the part we cannot
use, and star count is close to an inverse quality signal for our purposes.

### One licence nuance that is not a blocker

**23 of the 31 repos below reach for Adobe Typekit**, by two different
mechanisms that are easy to conflate: **16** via a
`<link href="https://use.typekit.net/…">` in `index.html`, and **7 more** via a
`WebFont.load({typekit: {id: '…'}})` call inside their own `utils.js`
(`OnScrollTypographyAnimations`, `TextRepetitionEffect`, `LetterShuffleMenu`,
`CircularTextEffect`, `GooeyTextHoverEffect`, `BackgroundScaleHoverEffect`,
`TypographyMotion`). Only 8 use no Typekit at all. Grepping the HTML alone
undercounts this — check `utils.js` too.

Either way it is a hosted stylesheet, not a bundled font file: **no repo in the
final list ships a single `.woff`, `.woff2`, `.ttf` or `.otf`**, so there is
nothing font-shaped to redistribute. The port drops the `<link>` or the
`preloadFonts` call and declares a system stack or a self-hosted open face.
Worth one line per port's `deviations`, not a reason to exclude anything. The
three repos that *do* bundle font files — `TextClipScroll` (8),
`AnimatedCustomCursor` (4), `OnScrollShapeMorph` and `MotionTrailAnimations` (2
each) — are excluded below.

---

## Imagery: slot vs asset

Per the brief's rule 3, I separated two different things:

- **Image slots** — the effect is a grid, gallery, menu or trail that animates
  *whatever images it is given*. The demo's photos are placeholders; a
  site-building agent fills them. Marked **slots**. Not a penalty.
- **Bundled asset is the effect** — a specific photograph or illustration is
  what the demo is *about*, so without it there is nothing to look at. Marked
  **asset-bound**. This is a real penalty.

Nothing in the final list is asset-bound. The heavy-imagery repos here
(`OnScrollLayoutFormations` 42 images, `Scroll3DGrid` 49, `MarqueeMenu` 30) are
all slot cases — the images are grid cells.

---

## Candidates

36 candidates. 31 dedicated repos plus 5 sketches from the `codrops-sketches`
collection, which is one MIT repo at one sha holding 29 small self-contained
demos.

Categories: `backgrounds, particles, 3d-hero, scroll, text, cursor, transition`
are the current schema enum. Codrops' two great strengths — **menus** and
**grids/galleries** — have no home in it. Proposed mapping is in CONCERNS at the
bottom; where I write `menu` or `gallery` below, that is a proposed new enum
value, not an existing one.

---

### A. No JavaScript library at all — port cost is near zero

#### A1. `LineHoverStyles` → **link-underlines** (`text`)
- **Repo** https://github.com/codrops/LineHoverStyles — 372★, pushed 2021-02-19
- **Commit** `5ff7fb48e2d415fb217dda5942e0cd08bc4ed768`
- **Paths** `css/base.css` (16.4 KB), `index.html` (5.2 KB, for the markup shape)
- **Licence** LICENSE present, 1103 B, full MIT text, `Copyright (c) 2009 - 2021 [Codrops]`. README has a `## License` heading pointing at `[MIT](LICENSE)`. No restrictive clause.
- **Dependencies** none. Zero JS files in the repo. Typekit `<link>` for display faces.
- **GSAP weight** n/a — no GSAP, no JS.
- **Imagery** none.
- **Looks like** A stack of oversized links where each one's underline arrives differently on hover: wipes from one side and leaves from the other, doubles into two rules travelling opposite ways, thickens, or splits into a top and bottom rule.
- **Why it earns a slot** Twelve reusable link treatments for the price of one CSS file, with no runtime, no dependency and no licence tail. A generated site uses links on every page; this is the cheapest visible upgrade in the entire catalogue.

#### A2. `ButtonHoverStyles` → **button-hovers** (`text`)
- **Repo** https://github.com/codrops/ButtonHoverStyles — 294★, pushed 2023-02-20
- **Commit** `3976fa1b65dced5d330db43c51081787c3e7b46e`
- **Paths** `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2022 [Codrops]`. No clause.
- **Dependencies** none. Typekit `<link>`.
- **GSAP weight** n/a.
- **Imagery** none.
- **Looks like** A row of CTA buttons whose fills sweep, split, invert or push a duplicate label up from below on hover, all on pseudo-elements and transforms.
- **Why** Same argument as A1 applied to the one element every landing page has to get right. Pairs with A1 as a single "interactive type" pass.

#### A3. `CSSMarqueeMenu` → **marquee-menu-css** (`menu`)
- **Repo** https://github.com/codrops/CSSMarqueeMenu — 169★, pushed 2020-04-02
- **Commit** `e7cea3a6762261e1e196d893bc2f5a1e50720dc1`
- **Paths** `css/base.css` (the `--marquee-width` / `--offset` / `--move-initial` / `--move-final` custom-property block and its two keyframes), `index.html`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2020 [Codrops]`. No clause.
- **Dependencies** none. 6 images (5 menu thumbs + a noise PNG) — **slots**.
- **GSAP weight** n/a.
- **Imagery** slots. The thumbnails are decorative; the marquee is text.
- **Looks like** Giant outlined menu items. Hovering one fades the outline to nothing and runs an infinite marquee band of the same word across the row behind it, with a thumbnail riding along.
- **Why** The single most-recognised "agency site" navigation of the last five years, and it is pure CSS. Our `marquee-css` port covers a horizontal logo strip; this is the navigation form of the same idea and reads completely differently.

#### A4. `ScrollLoopMenu` → **infinite-menu-loop** (`menu`)
- **Repo** https://github.com/codrops/ScrollLoopMenu — 74★, pushed 2020-05-23
- **Commit** `38257822c0bf1579ded7a17e6800acfd808014d3`
- **Paths** `src/js/infinitemenu.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2020 [Codrops]`. No clause.
- **Dependencies** **none at runtime.** `package.json` lists only `parcel-bundler` (a build tool). No GSAP anywhere in the source — the loop is hand-rolled `requestAnimationFrame` plus a lerp, with `scrollTop` clamping and cloned items.
- **GSAP weight** none.
- **Imagery** none.
- **Looks like** A tall vertical menu that never ends: scroll past the last item and the first reappears seamlessly, with items easing toward their positions rather than snapping.
- **Why** No GSAP, no images, no library — a rare combination in this catalogue. **Caveat:** it opens with a UA-sniffing `isMobile` regex and skips the whole effect on mobile; the port should replace that with a `pointer: coarse` / `prefers-reduced-motion` gate and record it as a deviation.

#### A5. `codrops-sketches` / `011-custom-cursor-filled-circle` → **cursor-follow** (`cursor`)
- **Repo** https://github.com/codrops/codrops-sketches — 203★, pushed 2024-02-17
- **Commit** `bbf47ca34766fd2ca5f97d8b376d2eca148bf48f`
- **Paths** `011-custom-cursor-filled-circle/js/index.js`, `011-custom-cursor-filled-circle/css/base.css`
- **Licence** LICENSE present, 1064 B, full MIT text, `Copyright (c) 2022 Codrops`. No clause in README.
- **Dependencies** **none.** `index.html` loads only its own `index.js` — no GSAP tag, no library.
- **GSAP weight** none.
- **Imagery** none.
- **Looks like** A filled circle trailing the pointer with lerped easing, swelling and inverting when it crosses a link.
- **Why** The `cursor` category currently holds one effect. This is the canonical custom cursor and it has literally zero dependencies.

---

### B. Light GSAP — a tween or two, straight `animate()` calls in anime.js v4

#### B1. `OnScrollTypographyAnimations` → **scroll-type-set** (`text` / `scroll`)
- **Repo** https://github.com/codrops/OnScrollTypographyAnimations — 343★, pushed 2023-12-05
- **Commit** `af28d61d1f8d3d117f5d1e9b09d5209e20a1a212`
- **Paths** `src/js/index.js`, `src/css/base.css` (`src/js/index2.js` holds effects 8–15)
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies as shipped** `gsap`, `gsap/ScrollTrigger`, `@studio-freight/lenis`, `splitting`. **All four replaceable**: ScrollTrigger → anime v4 `onScroll`; Lenis → our vendored `lenis`; Splitting → anime v4 `splitText`; gsap → `animate()`.
- **GSAP weight** **light.** 27 `gsap.fromTo` calls, 29 `scrub` configs, only 3 timelines across 15 effects. Every effect is one `fromTo` on `.char` elements with a `scrollTrigger: {scrub: true}` — the exact shape of `animate(chars, {…, autoplay: onScroll({sync: 0.1})})`. Structurally identical to the `reveal-stagger` port we already shipped.
- **Imagery** **none. Zero image files in the repo.**
- **Looks like** Fifteen headline reveals scrubbed to scroll — characters rise and rotate in from random angles, fan out from a centre, drop with per-letter lag, skew, or unblur.
- **Why** The richest single source in the catalogue for our thinnest category. Fifteen effects at one sha, no imagery to license, and a mechanism that maps 1:1 onto the vendored anime.js. **Build this first.**

#### B2. `ScrollBlurTypography` → **scroll-blur-text** (`text` / `scroll`)
- **Repo** https://github.com/codrops/ScrollBlurTypography — 148★, pushed 2024-04-23
- **Commit** `3e64d4bdae65b1f291e21a9a9c4b2ac6258c45c1`
- **Paths** `js/effect-1/blurScrollEffect.js` (48 lines), `js/textSplitter.js`, `css/base.css`. Effects 2–4 are three more files of the same shape.
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger (CDN `<script>` tags), Lenis, `split-type` via its own `textSplitter.js` wrapper.
- **GSAP weight** **light.** The entire effect is one `gsap.fromTo(chars, {filter:'blur(10px) brightness(0%)'}, {filter:'blur(0px) brightness(100%)', stagger:0.05, scrollTrigger:{scrub:true}})`. I read the whole file; that tween is all of it.
- **Imagery** one 25 KB image, incidental.
- **Looks like** A headline that arrives out of focus and black, each character sharpening and brightening as the section scrolls through the viewport.
- **Why** Smallest port in the list relative to how expensive the result looks, and it is the effect clients ask for by name. Four variants at one sha.

#### B3. `AnimatedCodeBackground` → **code-reveal-grid** (`backgrounds`)
- **Repo** https://github.com/codrops/AnimatedCodeBackground — 83★, pushed 2023-05-17
- **Commit** `4aa37f6d011b3c36bb9c18f77ecd91de5a08f6d0`
- **Paths** `js/item.js` (150 lines), `js/utils.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies** gsap via CDN tag, used for 3 `gsap.set`/`gsap.to` calls only. Motion is a hand-rolled lerp loop.
- **GSAP weight** **light.**
- **Imagery** **none.**
- **Looks like** A grid of tiles; moving the pointer over one reveals a wall of randomly generated characters underneath it through a soft mask that follows the cursor. (Codrops' own note: a recreation of the customer-grid hover on Evervault.)
- **Why** Fills a genuine hole — our `backgrounds` category is 14 shaders and gradients with no *interactive* background. Zero images, zero text content, works behind any hero.

#### B4. `codrops-sketches` / `013-custom-cursor-filter` → **cursor-gooey** (`cursor`)
- **Repo/commit** `codrops-sketches` @ `bbf47ca34766fd2ca5f97d8b376d2eca148bf48f`
- **Paths** `013-custom-cursor-filter/js/index.js`, `013-custom-cursor-filter/index.html` (the inline `<svg><filter>` block *is* half the effect)
- **Licence** as A5 — MIT, 1064 B, `2022 Codrops`.
- **Dependencies** gsap CDN tag only; the rest is lerp + an inline SVG `feGaussianBlur`/`feColorMatrix` gooey filter.
- **GSAP weight** **light.**
- **Imagery** none.
- **Looks like** A cursor blob that stretches and merges gooily with a second lagging blob, splitting apart again when it settles.
- **Why** Second cursor treatment with a completely different character to A5, and the SVG filter is declarative markup that ports verbatim. Sketches 014–018 are four more variants at the same sha if the first lands well.

#### B5. `PixelGooeyTooltip` → **pixel-tooltip** (`cursor`)
- **Repo** https://github.com/codrops/PixelGooeyTooltip — 69★, pushed 2023-11-08
- **Commit** `60ade47c343adbe40bdfa1bb0210a898e03ca536`
- **Paths** `js/tooltip.js`, `css/tooltip.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies** gsap CDN tag; 1 timeline + 2 tweens; SVG filter for the gooey merge.
- **GSAP weight** **light.**
- **Imagery** **none.**
- **Looks like** A tooltip that does not fade in — it assembles from a scatter of small fragments that fly together and fuse.
- **Why** Small, self-contained, no imagery, and useful on any pricing table or feature grid, which is exactly the section shape a site agent generates.

#### B6. `GooeyTextHoverEffect` → **gooey-text** (`text`)
- **Repo** https://github.com/codrops/GooeyTextHoverEffect — 156★, pushed 2024-08-06
- **Commit** `6db15b76e7425c2bca6f746da367bd927641fa48`
- **Paths** `src/js/demo1/menuItem.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2020 [Codrops]`. No clause.
- **Dependencies** `gsap` (npm), parcel. 3 timelines across 3 demos. SVG filter does the visual work.
- **GSAP weight** **light.**
- **Imagery** **none.** (It does pull Typekit, via `WebFont.load` in `src/js/utils.js` rather than a `<link>` — droppable like all the others.)
- **Looks like** Menu words that go liquid on hover — the letters swell, merge into each other and separate again through a gooey SVG filter.
- **Why** Zero assets, zero external stylesheet, three variants at one sha, and it works as either a menu or a headline treatment.

#### B7. `RepeatingImageTransition` → **image-repeat-reveal** (`transition` / `gallery`)
- **Repo** https://github.com/codrops/RepeatingImageTransition — 27★, created 2025-04-28, pushed 2025-05-01
- **Commit** `354c58487ad6a8b728e35b34d6666fca72e9b4eb`
- **Paths** `js/index.js`, `css/base.css`
- **Licence** LICENSE present, 1094 B, MIT `2009 - 2025 [Codrops]`. No clause. (README description field is empty in the API — this is a recent demo, not an abandoned one.)
- **Dependencies** gsap + Lenis via CDN tags. 6 `gsap.to` calls, **no timeline, no ScrollTrigger, no Flip**.
- **GSAP weight** **light.**
- **Imagery** 33 images, 1.1 MB — **slots** (grid thumbnails).
- **Looks like** Clicking a grid thumbnail spawns a run of repeated copies of it that step across the screen and land as the full-bleed hero of the detail view.
- **Why** The most-shared Codrops demo of 2025 and, unusually for a transition of this weight, it is six plain tweens. Low star count only because the repo is 16 months old.

#### B8. `LineTextHoverAnimations` → **terminal-hover** (`text`)
- **Repo** https://github.com/codrops/LineTextHoverAnimations — 154★, pushed 2024-06-19
- **Commit** `00fdd50a5daa48a9fcb400d19d17b1dac5935e68`
- **Paths** `js/effect-1/text-animator.js`, `js/textSplitter.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap CDN, split-type wrapper. 11 `gsap.to` + 5 `fromTo`, no timelines.
- **GSAP weight** **light.**
- **Imagery** 2 images, 65 KB — incidental.
- **Looks like** Monospace list items that, on hover, roll each character through a run of substitutes before settling — a terminal decoding to the real word.
- **Why** Adjacent to our shipped `scramble` but hover-triggered and line-scoped rather than a one-shot headline, so it reads as a different effect rather than a duplicate.

#### B9. `ImageGridMotionEffect` → **grid-motion** (`backgrounds` / `gallery`)
- **Repo** https://github.com/codrops/ImageGridMotionEffect — 153★, pushed 2021-08-23
- **Commit** `210f9703661b0547d8c16c91fee5df942f816846`
- **Paths** `src/js/demo1/grid.js`, `src/js/cursor.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2021 [Codrops]`. No clause.
- **Dependencies** gsap (npm), imagesloaded (droppable — replace with a `decode()` promise). 5 `gsap.to`, no timelines.
- **GSAP weight** **light.**
- **Imagery** 20 images, 644 KB — **slots**.
- **Looks like** A tilted wall of thumbnails filling the viewport behind the copy; the whole grid drifts against the pointer, rows counter-sliding at different rates.
- **Why** A hero background made of the client's own images rather than a shader. Nothing in our 14 background effects does that.

#### B10. `HoverGrid` → **grid-hover-reveal** (`gallery`)
- **Repo** https://github.com/codrops/HoverGrid — 39★, pushed 2024-03-13
- **Commit** `0a59474715182c0d0bc2219c48f9cdd4f570cf9b`
- **Paths** `js/index.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap CDN, imagesloaded. 2 timelines + 4 tweens.
- **GSAP weight** **light**.
- **Imagery** 21 images, 6.4 MB — **slots**, but the demo's assets are unusually heavy; the port ships none of them.
- **Looks like** A tight grid of cards; hovering one expands it while its neighbours compress and its caption slides up from under the edge. (Codrops: inspired by Metalab.)
- **Why** Portfolio and case-study grids are one of the most common generated sections and we currently have no motion for them.

#### B11. `ClipHoverEffect` → **clip-hover** (`gallery`)
- **Repo** https://github.com/codrops/ClipHoverEffect — 89★, pushed 2023-06-21
- **Commit** `57b5cc1b6cc375e69dd915bdd307f2645e1dabb7`
- **Paths** `js/card.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies** gsap CDN, splitting, imagesloaded. 3 `gsap.to` + 1 `fromTo`.
- **GSAP weight** **light.**
- **Imagery** 9 images — **slots**.
- **Looks like** A card whose image is revealed through an animated `clip-path` wedge that opens from a corner while the caption's characters stagger in behind it.
- **Why** `clip-path` reveals are the house style of half the agency web; this is the cleanest small implementation in the org.

#### B12. `BackgroundScaleHoverEffect` → **bg-scale-hover** (`gallery` / `menu`)
- **Repo** https://github.com/codrops/BackgroundScaleHoverEffect — 123★, pushed 2020-03-11
- **Commit** `5ec048fcd4d43d7ec80260c2037065e6f77d6011`
- **Paths** `src/js/screen.js`, `src/js/navigation.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2020 [Codrops]`. No clause.
- **Dependencies** gsap (npm), imagesloaded. 2 timelines.
- **GSAP weight** **light.**
- **Imagery** 16 images, 2.1 MB — **slots**.
- **Looks like** Hovering a nav item scales a full-bleed background image up behind the layout, revealed through an expanding clip window rather than a fade. (Codrops: a recreation of the DDD Hotel site.)
- **Why** A navigation *and* a hero background in one section, which is exactly the composite a generated landing page wants.

---

### C. Moderate — a real timeline, or several coordinated tweens

#### C1. `codrops-sketches` / `021` + `022-svg-path-page-transition` → **curtain-transition** (`transition`)
- **Repo/commit** `codrops-sketches` @ `bbf47ca34766fd2ca5f97d8b376d2eca148bf48f`
- **Paths** `021-svg-path-page-transition-vertical/js/index.js`, `021-…/css/base.css`; the horizontal variant is `022-svg-path-page-transition-horizontal/js/index.js`
- **Licence** as A5 — MIT, 1064 B, `2022 Codrops`.
- **Dependencies** gsap CDN only. No images, no Lenis, no splitter.
- **GSAP weight** **moderate.** It is one `gsap.timeline()` that `.set`s and `.to`s the `d` attribute of a single SVG path through four hand-written states (`unfilled → curve1 → curve2 → filled`). Anime v4 animates attributes, and because all four `d` strings share an identical command sequence (`M … V … Q … V … z`) they interpolate numerically without needing a morph plugin — but this is the one candidate where I would want the porting agent to verify that empirically before committing.
- **Imagery** **none.**
- **Looks like** A coloured curtain sweeps up over the page with a curved leading edge that bulges and then flattens, then peels away to reveal the next view.
- **Why** **The `transition` category holds exactly one effect** (`page-fade`, our own native View Transitions original). This is the classic agency page transition, it is dependency-free apart from GSAP, and two axes ship from one sha.

#### C2. `codrops-sketches` / `024` + `025-infinite-loop-scrolling` → **loop-scroll-gallery** (`gallery` / `scroll`)
- **Repo/commit** `codrops-sketches` @ `bbf47ca34766fd2ca5f97d8b376d2eca148bf48f`
- **Paths** `024-infinite-loop-scrolling/js/index.js`, `024-…/css/base.css`; horizontal variant `025-infinite-loop-scrolling-horizontal/js/index.js`
- **Licence** as A5.
- **Dependencies** **Lenis only** — the whole trick is `new Lenis({smooth:true, infinite:true})` plus a six-item clone loop. No GSAP at all in `024`/`025`. `imagesloaded` is used once for a loading class and is droppable.
- **GSAP weight** **none.**
- **Imagery** 6 / 4 images — **slots**.
- **Looks like** A gallery that scrolls forever: reach the bottom and you are seamlessly back at the top, with no jump.
- **Why** We already vendor Lenis and already ship `smooth-scroll`; this is 25 lines of additional code on top of a dependency that is paid for. Best effort-to-effect ratio in the whole survey. (Sketches `026`–`029` add scroll-driven animation on top and do pull in GSAP + ScrollTrigger — treat those as separate, heavier candidates.)

#### C3. `codrops-sketches` / `005-image-motion-trail-opaque` → **image-trail** (`cursor` / `gallery`)
- **Repo/commit** `codrops-sketches` @ `bbf47ca34766fd2ca5f97d8b376d2eca148bf48f`
- **Paths** `005-image-motion-trail-opaque/js/index.js`, `005-…/css/base.css`
- **Licence** as A5.
- **Dependencies** gsap CDN only.
- **GSAP weight** **moderate** (a per-image timeline, spawned on a distance threshold).
- **Imagery** 2 images — **slots**.
- **Looks like** Images fling out along the pointer's path and fade back, leaving a trail of the client's photography behind the cursor.
- **Why** Signature "creative studio" hero interaction. Five more variants (`006`–`010`: semitransparent, rotating, circular, two perspectives) sit at the same sha, so one port yields an option matrix.

#### C4. `TextRepetitionEffect` → **text-repetition** (`text` / `scroll`)
- **Repo** https://github.com/codrops/TextRepetitionEffect — 114★, pushed 2022-04-13
- **Commit** `fabaafe0124e7bdf66906c6214f00800f5575c4c`
- **Paths** `src/js/demo1/repeatTextScrollFx.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2021 [Codrops]`. No clause.
- **Dependencies** gsap (npm) only. 10 timelines across 5 demos — 2 per demo.
- **GSAP weight** **moderate.**
- **Imagery** 2 images, 322 KB — incidental.
- **Looks like** A word repeated nine times in a vertical stack, offset and delayed so scrolling fans the copies apart and snaps them back into register on the centred original. (Codrops: after Dr. Dabber's site.)
- **Why** Kinetic typography with no assets and a self-contained class. The layout is generated in JS from `innerHTML`, so it adapts to whatever copy the site agent writes.

#### C5. `CircularTextEffect` → **circular-text** (`text`)
- **Repo** https://github.com/codrops/CircularTextEffect — 176★, pushed 2021-03-03
- **Commit** `fcd9aaa5d55d0d6ce5f9d1b6795e4c3d45dd93b2`
- **Paths** `src/js/demo1/intro.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2021 [Codrops]`. No clause.
- **Dependencies** gsap (npm), splitting. 6 timelines + 29 tweens across 3 demos.
- **GSAP weight** **moderate.**
- **Imagery** **none.**
- **Looks like** Type set around a circular SVG path that rotates continuously while individual letters lift off the ring and settle back.
- **Why** No assets at all, and a rotating type ring is the one badge-shaped element every "studio" template wants. Anime v4's splitter plus a rotation tween covers it.

#### C6. `TextBlockTransitions` → **text-block-swap** (`text`)
- **Repo** https://github.com/codrops/TextBlockTransitions — 94★, pushed 2023-07-13
- **Commit** `f26255f089e20df46a4844ab1205e3b07565889a`
- **Paths** `js/demo1/index.js`, `css/base.css` (12 demos, `demo1`–`demo12`, all the same shape)
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies** gsap CDN, splitting. 15 timelines.
- **GSAP weight** **moderate.**
- **Imagery** **none.**
- **Looks like** One paragraph swapping for another with the words leaving and arriving under different rules — sliding, blurring, cascading per word, or dissolving in place.
- **Why** Twelve variants, zero assets, and a section shape (rotating testimonial or value proposition) that a site agent generates constantly.

#### C7. `SlicedTextEffect` → **sliced-text** (`text` / `scroll`)
- **Repo** https://github.com/codrops/SlicedTextEffect — 63★, pushed 2023-12-05
- **Commit** `45bbcfd96b0c87a5a5299cb4bacc583dd3b71bf8`
- **Paths** `js/item.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN tags. 5 timelines, 8 `scrub` configs.
- **GSAP weight** **moderate.**
- **Imagery** 9 images, 661 KB — decorative background, droppable.
- **Looks like** A headline cut into four or six horizontal bands that slide apart in alternating directions as the section scrolls, then re-register into legible type.
- **Why** Reads as expensive, and the cells are pure CSS clones — the whole mechanism is `totalCells` copies of the same text with different `clip-path` insets.

#### C8. `TypographyMotion` → **letter-stagger** (`text`)
- **Repo** https://github.com/codrops/TypographyMotion — 85★, pushed 2020-11-11
- **Commit** `800c4b530783565b69619b8a9033e0ca069207ec`
- **Paths** `src/js/index.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2020 [Codrops]`. No clause.
- **Dependencies** gsap (npm), splitting. 2 timelines.
- **GSAP weight** **moderate.**
- **Imagery** 2 images, 172 KB — incidental.
- **Looks like** A display headline whose letters arrive on a heavy stagger from alternating directions, overshooting slightly before settling. (Codrops: a recreation of a Thibaud Allie animation.)
- **Why** The plainest, most reusable hero-headline entrance in the list — the one that goes on a page where nothing else should compete.

#### C9. `LetterShuffleMenu` → **letter-shuffle-menu** (`menu` / `text`)
- **Repo** https://github.com/codrops/LetterShuffleMenu — 50★, pushed 2022-03-23
- **Commit** `32cf37157f32f6e3f323de63d872319704429cc7`
- **Paths** `src/js/menuItem.js`, `src/js/menu.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2022 [Codrops]`. No clause.
- **Dependencies** gsap (npm), splitting. 2 timelines.
- **GSAP weight** **moderate.**
- **Imagery** **none.**
- **Looks like** A fullscreen overlay menu where a single large word's letters shuffle and re-sort so that each letter becomes the initial of a menu entry.
- **Why** The most memorable idea in the org's menu set, and it has no assets whatsoever. Its `menuConfig.js` already parameterises the word-to-item mapping, so the port has a natural options surface.

#### C10. `MarqueeMenu` → **marquee-menu** (`menu`)
- **Repo** https://github.com/codrops/MarqueeMenu — 87★, pushed 2021-06-30
- **Commit** `26c33b17f79f7c36f33aec9dbd5f6de17b11c326`
- **Paths** `src/js/menuItem.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2021 [Codrops]`. No clause.
- **Dependencies** gsap (npm). 2 timelines.
- **GSAP weight** **moderate.**
- **Imagery** 30 images, 522 KB — **slots** (the marquee band carries thumbnails).
- **Looks like** Hovering a menu item runs a horizontal band of repeated label-plus-thumbnail across the row, accelerating in and decelerating out. (Codrops: a recreation of Locomotive's K72 site.)
- **Why** The JS sibling of A3: same family, but the band carries images and eases rather than looping at constant rate, so both can ship without reading as duplicates.

#### C11. `ExpandingRoundedMenu` → **expanding-menu** (`menu` / `transition`)
- **Repo** https://github.com/codrops/ExpandingRoundedMenu — 60★, pushed 2022-03-16
- **Commit** `9f8174aaca176a0e4b31e1330f9049b45fd02758`
- **Paths** `src/js/index.js` (the whole effect is one file), `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2022 [Codrops]`. No clause.
- **Dependencies** `gsap` (npm) only. One paused, reversible timeline with `power4.inOut` defaults.
- **GSAP weight** **moderate.** A single timeline played forward on open and reversed on close — anime v4's `createTimeline()` with `.reverse()` is a direct equivalent.
- **Imagery** 8 images, 585 KB — **slots**.
- **Looks like** A rounded cover panel that grows from a corner to fill the screen while the page content scales back behind it and the menu links stagger in.
- **Why** The one candidate that is a *complete* nav pattern — open state, close state, content parallax — in a single readable file, and it doubles as a section transition.

#### C12. `KineticTypePageTransition` → **kinetic-type-transition** (`transition` / `text`)
- **Repo** https://github.com/codrops/KineticTypePageTransition — 125★, created 2021-09-29, pushed 2025-05-30
- **Commit** `ebe926e2f1de42950c36ff8a678321155280c1af`
- **Paths** `src/js/typeTransition.js`, `src/css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2021 [Codrops]`. No clause.
- **Dependencies** `gsap` + `gsap/CustomEase`, imagesloaded, parcel. **`CustomEase` is a Club GreenSock plugin** — but it is used only to define an easing curve, and anime v4 accepts a `cubic-bezier()` string or a custom easing function, so the curve is transcribable rather than reimplementable.
- **GSAP weight** **moderate.** 8 timelines. The CustomEase dependency is a curve definition, not a mechanism.
- **Imagery** 16 images, 630 KB — **slots**.
- **Looks like** Navigating fires a full-screen wall of repeated oversized words that sweeps across in opposing rows before the destination page settles behind it.
- **Why** The most striking page transition in the org, and `transition` is our emptiest category. Ranked below C1 only because of the CustomEase indirection.

#### C13. `StickySections` → **sticky-sections** (`scroll`)
- **Repo** https://github.com/codrops/StickySections — 132★, pushed 2024-02-04
- **Commit** `69c788898216d94a796a21c87adc475f3a3f73f5`
- **Paths** `js/demo1/index.js`, `css/base.css` (15 demos, `demo1`–`demo15`)
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN tags, imagesloaded. 13 timelines, 14 `scrub` configs.
- **GSAP weight** **moderate.**
- **Imagery** 12 images, 801 KB — **slots**.
- **Looks like** A section that pins while the next one scrolls up over it, the pinned one shrinking, rotating away or blurring out as it goes.
- **Why** Fifteen exit treatments for the same structural pattern, and the pattern itself (stacked sticky sections) is the backbone of most modern one-page sites. Complements our `pin-progress` rather than duplicating it.

#### C14. `Scroll3DGrid` → **scroll-3d-grid** (`scroll` / `gallery`)
- **Repo** https://github.com/codrops/Scroll3DGrid — 181★, pushed 2023-08-03
- **Commit** `69718a2eff87b32ab19764b3a6d7b3773dab6af3`
- **Paths** `js/index.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2023 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN tags, imagesloaded.
- **GSAP weight** **moderate** (1 timeline, 1 scrub, but the CSS carries a `perspective`/`rotate3d` composition the port has to reproduce faithfully).
- **Imagery** 49 images, 1.1 MB — **slots**.
- **Looks like** A grid of thumbnails set on a receding 3D plane that rotates toward flat as the section scrolls, cells arriving from depth.
- **Why** Highest-star scroll grid in the org and the resting state is a legitimate static composition, which matters for our "must look finished on CSS alone" contract.

#### C15. `Staggered3DGridAnimations` → **grid-3d-stagger** (`scroll` / `gallery`)
- **Repo** https://github.com/codrops/Staggered3DGridAnimations — 98★, pushed 2024-10-27
- **Commit** `7c2703d41f55005c2758e1031b593d2493d392f8`
- **Paths** `js/index.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN tags, imagesloaded. 5 timelines, 10 scrubs.
- **GSAP weight** **moderate.**
- **Imagery** 21 images, 1.9 MB — **slots**.
- **Looks like** Grid cells arriving in a staggered 3D cascade — rotating in from the edges of a perspective box rather than fading up.
- **Why** More playful sibling to C14; the two cover the conservative and the loud version of the same section.

#### C16. `OnScrollLayoutFormations` → **layout-formations** (`scroll` / `gallery`)
- **Repo** https://github.com/codrops/OnScrollLayoutFormations — 116★, pushed 2024-09-19
- **Commit** `68910ecf85275bdd7e4d0e47013ba4bf9ec94bde`
- **Paths** `js/index.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN, imagesloaded. **11 timelines, 11 scrubs, no Flip** — I checked specifically, because "layout formation" reads like a Flip demo and it is not.
- **GSAP weight** **moderate.**
- **Imagery** 42 images, 2.7 MB — **slots**.
- **Looks like** Scattered images that converge into an ordered formation — a row, an arc, a column — as the section is scrolled through, then disperse again.
- **Why** Reads as the most "designed" scroll section in the catalogue while being ordinary scrubbed transforms underneath. The absence of Flip is what makes it portable.

#### C17. `3DStackMotion` → **card-stack-scroll** (`scroll`)
- **Repo** https://github.com/codrops/3DStackMotion — 116★, pushed 2024-03-06
- **Commit** `75cbda91ed26d31aeeb5a5b9887848e5a7005c7f`
- **Paths** `js/effect-1/stackMotionEffect.js`, `css/base.css` (effects 2 and 3 are siblings)
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN, imagesloaded. 3 timelines, 4 scrubs.
- **GSAP weight** **moderate.**
- **Imagery** 11 images, 404 KB — **slots**. No Typekit.
- **Looks like** A deck of cards stacked in 3D that spreads, fans and re-stacks as the section scrolls.
- **Why** Three variants at one sha, light asset weight, and it is the card-deck idiom our `reveal-stagger` gestures at but does not scroll-drive.

#### C18. `RotatingOnScrollAnimations` → **rotate-scroll-images** (`scroll` / `gallery`)
- **Repo** https://github.com/codrops/RotatingOnScrollAnimations — 34★, created **2026-06-18**
- **Commit** `ebbe2c9bd80237d05c709475e47aad171030e21f`
- **Paths** `js/index.js`, `css/base.css` (`index2.js`–`index5.js` are four more variants)
- **Licence** LICENSE present, 1094 B, MIT `2009 - 2026 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN, imagesloaded. 4 `gsap.to` + 2 `fromTo`, 10 scrubs, **no timelines**.
- **GSAP weight** **light-to-moderate.**
- **Imagery** 40 images, 3.2 MB — **slots**.
- **Looks like** Images tumbling in 3D as they pass through the viewport — rotating on the Y axis, tipping on X, or spinning flat.
- **Why** The newest usable demo in the org (three months old) and five variants at one sha. Low stars is age, not quality.

#### C19. `ContextAwareLogoAnimationScroll` → **sticky-logo-scroll** (`scroll`)
- **Repo** https://github.com/codrops/ContextAwareLogoAnimationScroll — 58★, pushed 2024-10-09
- **Commit** `2c717fbf374d5751ae0c2ba2d0b0bb533520e427`
- **Paths** `js/index.js`, `js/textSplitter.js`, `css/base.css`
- **Licence** LICENSE present, 1103 B, MIT `2009 - 2024 [Codrops]`. No clause.
- **Dependencies** gsap + ScrollTrigger + Lenis CDN. 18 `gsap.to`, 1 timeline, no scrub.
- **GSAP weight** **moderate.**
- **Imagery** 1 image, 298 KB.
- **Looks like** A fixed wordmark that hides, collapses to a monogram, or inverts its colour as it passes over different sections, then restores itself.
- **Why** Site furniture rather than a section, which makes it unusually reusable — it applies once per generated site and improves every page.

---

## Ranked shortlist — top 20

Ranking weighs visual payoff and reusability against porting cost and any
licence tail. Ties broken toward "no imagery, no dependency".

| # | Candidate | Repo | Weight | Assets | Build note |
|---|---|---|---|---|---|
| 1 | **scroll-type-set** | OnScrollTypographyAnimations | light | none | **Build first.** 15 effects, one sha, no images, `fromTo`+scrub maps straight to anime `onScroll`. |
| 2 | **link-underlines** | LineHoverStyles | none | none | **Build first.** One CSS file, twelve effects, no runtime. |
| 3 | **scroll-blur-text** | ScrollBlurTypography | light | none | **Build first.** 48-line effect class, four variants. |
| 4 | **loop-scroll-gallery** | codrops-sketches `024`/`025` | none | slots | **Build first.** Lenis `infinite:true` + a clone loop; the dependency is already vendored. |
| 5 | **curtain-transition** | codrops-sketches `021`/`022` | moderate | none | **Build first.** Fills the emptiest category; verify the `d`-attribute interpolation early. |
| 6 | **button-hovers** | ButtonHoverStyles | none | none | Ships alongside #2 as one "interactive type" pass. |
| 7 | **marquee-menu-css** | CSSMarqueeMenu | none | slots | Pure CSS; the most-recognised agency nav of the era. |
| 8 | **code-reveal-grid** | AnimatedCodeBackground | light | none | First *interactive* background we would own. |
| 9 | **cursor-follow** | codrops-sketches `011` | none | none | Zero dependencies. Doubles the `cursor` category. |
| 10 | **image-repeat-reveal** | RepeatingImageTransition | light | slots | Six plain tweens for the most-shared 2025 demo. |
| 11 | **gooey-text** | GooeyTextHoverEffect | light | none | No assets, no Typekit, three variants. |
| 12 | **letter-shuffle-menu** | LetterShuffleMenu | moderate | none | Best idea in the menu set, zero assets. |
| 13 | **sticky-sections** | StickySections | moderate | slots | 15 exit treatments for the backbone one-page pattern. |
| 14 | **infinite-menu-loop** | ScrollLoopMenu | none | none | No GSAP at all; replace the UA sniff with a media query. |
| 15 | **text-block-swap** | TextBlockTransitions | moderate | none | 12 variants, no assets. |
| 16 | **cursor-gooey** | codrops-sketches `013` | light | none | SVG filter ports verbatim; 4 more variants at the same sha. |
| 17 | **layout-formations** | OnScrollLayoutFormations | moderate | slots | Confirmed Flip-free, which is what makes it portable. |
| 18 | **grid-motion** | ImageGridMotionEffect | light | slots | A hero background made of the client's own images. |
| 19 | **kinetic-type-transition** | KineticTypePageTransition | moderate | slots | Second page transition; CustomEase is a curve, not a mechanism. |
| 20 | **scroll-3d-grid** | Scroll3DGrid | moderate | slots | Highest-star scroll grid; resting state is already a composition. |

Ranks 21–36, in rough order: `image-trail` (sketches `005`), `expanding-menu`,
`marquee-menu`, `text-repetition`, `circular-text`, `letter-stagger`,
`pixel-tooltip`, `terminal-hover`, `card-stack-scroll`, `grid-3d-stagger`,
`rotate-scroll-images`, `sliced-text`, `bg-scale-hover`, `clip-hover`,
`grid-hover-reveal`, `sticky-logo-scroll`.

---

## Excluded, with the reason

### Excluded as a class: the 219 repos with no LICENSE file

Rule 1 says the licence must be evidenced from an actual LICENSE file. 219 of
the org's 345 repos have none — `gh api repos/codrops/<name>/contents/LICENSE`
returns 404. Their README either carries the restrictive clause or links to
`tympanus.net/codrops/licensing/` and nothing else. **All 219 are out.** This is
the entire pre-2020 catalogue, including everything above 500 stars.

Individually checked and recorded so nobody re-opens them:

| Repo | ★ | LICENSE | README |
|---|---|---|---|
| `PageTransitions` | 2311 | 404 | no clause, but no licence either — links only to the licensing page |
| `RainEffect` | 1773 | 404 | — |
| `SidebarTransitions` | 1655 | 404 | licensing-page link only |
| `HoverEffectIdeas` | 1643 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `Animocons` | 1548 | 404 | — (also depends on mo.js) |
| `ParticleEffectsButtons` | 1261 | 404 | — |
| `ModalWindowEffects` | 1013 | 404 | licensing-page link only |
| `TextInputEffects` | 953 | 404 | — |
| `LineMenuStyles` | 744 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `CreativeLinkEffects` | 723 | 404 | licensing-page link only |
| `CSSGlitchEffect` | 700 | 404 | full "as-is"/"pluginized" clause |
| `OffCanvasMenuEffects` | 696 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `PageLoadingEffects` | 641 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `GridLoadingEffects` | 513 | 404 | licensing-page link only |
| `StackMotionHoverEffects` | 501 | 404 | full "as-is"/"pluginized" clause |
| `FullscreenOverlayStyles` | 500 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `BlockRevealers` | 555 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `SegmentEffect` | 540 | 404 | "Don't republish, redistribute or sell "as-is"" |
| `ImageTiltEffect` | 567 | 404 | full clause (control from the prior pass) |
| `SmoothScrollingImageEffects` | — | 404 | full clause (control from the prior pass) |

### Excluded on GSAP weight: the plugin *is* the mechanism (heavy)

These have clean MIT licences. They are out because the effect cannot survive
losing the plugin — reimplementing `Flip`'s FLIP solver, `ScrollSmoother`'s lag
integrator or `Observer`'s normalised input is original work, so a "port" claim
would not be true.

**Evidence strength differs and is marked.** *Source-read* means I fetched and
read the JS. *Bundled* means the repo's tree contains `Flip.min.js` /
`ScrollSmoother.min.js` — real evidence that the plugin is loaded, but I did not
read the call sites, so the judgement rests on the bundle plus the repo's own
description.

| Repo | ★ | Plugin | Evidence |
|---|---|---|---|
| `ScrollBasedLayoutAnimations` | 335 | Flip + ScrollTrigger | **source-read**: `Flip.getState`/`Flip.from`; the demo is layout-switch morphing end to end |
| `SlideshowAnimations` | 306 | Observer | **source-read**: 7 × `Observer.create`; the plugin normalises wheel/touch/pointer into the slide state machine |
| `OnScrollTextHighlight` | 96 | Flip + ScrollTrigger | **source-read**: 1 Flip call inside the highlight timeline |
| `UnrevealEffects` | 74 | Flip | **source-read**: `gsap.registerPlugin(Flip)`, 4 Flip calls across 12 timelines |
| `OnScrollFilter` | 100 | Flip + ScrollTrigger | bundles `Flip.min.js`; **description names Flip** ("Combining GSAP's Scroll Trigger and Flip…") |
| `OneElementScroll` | 73 | Flip + ScrollTrigger | bundles `Flip.min.js`; **description names Flip** — "one element across waypoints" *is* the Flip idiom |
| `GridToSlider` | 50 | Flip | bundles `Flip.min.js`; **description names Flip** ("…using GSAP's Flip plugin") |
| `GridLayoutAnimation` | 44 | Flip + Draggable + Inertia + MotionPath + CustomEase + Observer | bundles `Flip.js` **and** `Flip.min.js`; **description names Flip**. The whole plugin suite is vendored |
| `IntroGridMotionTransition` | 66 | Flip | bundles `Flip.min.js` |
| `ImageExpansionTypography` | 47 | Flip + ScrollTrigger | bundles `Flip.min.js` |
| `GridFlowEffect` | 40 | Flip | bundles `Flip.min.js` |
| `PushGridItems` | 39 | Flip | bundles `Flip.min.js` |
| `ImageTilesMenu` | 31 | Flip | bundles `Flip.min.js` |
| `GridViewSwitch` | 31 | Flip | bundles `Flip.min.js` |
| `ElasticGridScroll` | 58 | ScrollSmoother | Already source-read and judged in `port-sources.md`; not re-opened here |
| `3DCarousel` | 58 | ScrollSmoother + SplitText | bundles both minified plugins |
| `ScrollTextMotion` | 42 | ScrollSmoother + Flip | bundles both. The org's newest text demo (2025-12) and unusable for exactly that reason |

If any one of the eight "bundled" rows is wanted badly enough, reading its
source is a ten-minute check — the bundle proves the plugin is loaded, not that
it carries the mechanism. I would spend that check on `GridToSlider` or
`GridFlowEffect` first, since grid-to-gallery motion is a category we have
nothing in.

### Excluded on dependency

| Repo | ★ | Reason |
|---|---|---|
| `TileScroll` | 230 | `locomotive-scroll` **and** GSAP. Lenis substitutes for the first; the second is still in the path |
| `ColumnScroll` | 212 | locomotive-scroll + gsap + 129 images / 9.5 MB |
| `HorizontalSmoothScrollLayout` | 164 | locomotive-scroll + gsap |
| `RapidImageHoverMenu` | 171 | locomotive-scroll + gsap |
| `RapidImageHoverMenuEffects` | 117 | locomotive-scroll + gsap, and it bundles 300 images / 7.0 MB |
| `ThumbFullTransition`, `ImageStackGrid`, `OnScrollLetterAnimations`, `BackgroundShift`, `InlineMenuLayout`, `codrops2020` | — | locomotive-scroll |
| `GlitchyGrid` | 41 | `@ashthornton/asscroll` — another smooth-scroll runtime we do not vendor |
| `MagneticButtons` | **485** | `mo.js` (motion-graphics runtime) alongside GSAP. Highest-star MIT repo in the org and the one I most regret dropping — the magnetic pull itself is trivial, but the burst is all mo.js, so a port would be invention. **Worth revisiting as an original if the burst is dropped.** |
| `WebGLBlobs` | 94 | `glslify-bundle`, `glsl-noise`, `glsl-rotate`, `dat.gui` — a build-step GLSL toolchain, and our shader slots are already filled by paper-design and shader.gallery |
| `astro-shop-view-transitions` | 117 | An Astro application, not a section. Its actual subject (View Transitions) is already our `page-fade` |

### Excluded on assets, dependency or reusability — source was read

These 21 were in the 66-repo shortlist, so their source, mechanism counts and
asset profile are all on disk. One line each.

| Repo | ★ | Reason |
|---|---|---|
| `TextClipScroll` | 70 | **Bundles 8 font files** plus 5.8 MB of imagery, and the clipped type depends on that specific display face. Rule 3 |
| `MotionTrailAnimations` | 75 | **Bundles 2 font files**; also superseded by sketches `005`–`010`, which are the same idea in ~60 lines each at one sha |
| `OnScrollShapeMorph` | 76 | **Bundles 2 font files**; 7 timelines driving a morph our anime.js has no direct equivalent for |
| `GlitchPerspective` | 52 | Its only JS is a vendored copy of **`vanilla-tilt.js`**, a third-party library we do not vendor. Zero GSAP, but the tilt engine *is* the effect |
| `DistortedLinkEffects` / `DistortedMenuLinkEffects` | 143 / 86 | 21 `feTurbulence`/`feDisplacementMap` primitives each. MIT and legitimate, but the effect is an SVG filter graph rather than an animation, and these render inconsistently across engines |
| `OnScrollSVGFilterText` | 57 | Same, at 91 filter primitives — transcription, not porting |
| `CrosshairDistortion` | 47 | Fullscreen crosshair cursor with a displacement filter. Real, but a niche full-page treatment rather than a section |
| `ThumbHoverSVGFilter` | 73 | 9 filter primitives on a thumbnail hover. Kept out to cap the filter cluster; a fine reserve |
| `GooeyCursor` | 100 | **Strongest reserve in the whole excluded list.** Out only to cap the cursor cluster at two (A5, B4). Promote it if a third cursor is wanted |
| `PixelTransition` | 95 | 29 tweens + 19 `fromTo` spread over 13 demo files with no shared module — a page-transition *collection*, not one effect. Revisit once `curtain-transition` (C1) proves the category |
| `LayersAnimation` / `RapidLayersAnimation` / `CoverPageTransition` | 75 / 85 / 77 | Three more clip-path page transitions, 2–6 timelines each. All three overlap C1 and C12; pick from here only if a *third* transition is wanted |
| `RepetitionHoverEffect` | 46 | Superseded by sketches `001`–`004`, the tidier version of the same idea at one sha |
| `LoopScrolling` | 39 | Superseded by C2 (sketches `024`/`025`), which does the same infinite loop with **no GSAP at all** |
| `OnScrollTypoAnimations` | 14 | A four-effect subset of B1 (`OnScrollTypographyAnimations`, 15 effects, no images). Strictly dominated |
| `OnScrollColumnsRows` | 120 | 13 scrubs, 40 images. Good, but C16 `layout-formations` is the same column/row scroll idea done better |
| `ScrollPanels` | 54 | 11 scrubs over 53 images; the panel-scroll pattern C13 `sticky-sections` already covers with 15 variants |
| `ConnectedGrid` | 62 | 4 scrubs and 5.0 MB of imagery for SVG connector lines between grid cells — thin payoff for the asset weight |
| `ReflectionScroll` | 31 | Simulates a mirrored copy of the *whole page* scrolling below the fold. A page-level trick, not a section |
| `ImagePixelLoading` | 96 | One timeline, one scrub, built around progressively decoding a single specific photograph. Closest thing here to asset-bound |
| `DoubleImageHoverEffects` | 81 | 22 timelines across 13 demo files for a hover B11 `clip-hover` covers in one 3-tween class |
| `GridItemHoverEffect` | 109 | Three near-identical card classes (`card.js`, `card2.js`, `card3.js`) each coupled to its own demo markup — no single portable unit |
| `FullscreenClipEffect` | 58 | A fullscreen image morphing into a row of thumbnails: needs both layouts present in the markup, so it is a page template |
| `LettersAnimationLayout` | 48 | Same problem — the letter animation only makes sense inside its triple-panel layout |
| `SuperfluidLayout` | 112 | Same — a layout switch dressed as a typography effect |
| `Theodore` | 97 | A menu with an SVG overlay and a looping background. Small and pleasant, but too tied to its own single-page demo to generalise |
| `3DLettersMenuHover` | 82 | 5 timelines for a 3D-letter menu hover; overlaps C9 `letter-shuffle-menu` without adding a distinct idea |
| `LineTypeEffect` | 13 | 8 timelines, no assets — genuinely fine, just strictly weaker than C6 `text-block-swap`, which does 12 variants of the same job |

### Excluded — MIT and plausible, but never source-fetched

Named here so nobody assumes they were missed. Each was passed over from its
description and tree alone, so the reason is a judgement rather than a reading:
all are *layout switches* (a menu or list morphing into a grid, which needs both
layouts in the markup and is therefore a page template, not a drop-in section),
slideshows tied to a specific multi-page demo, or duplicates of a candidate.

`3DGridContentPreview`, `GridZoom`, `MakeWayGridEffect`, `MenuToGrid`,
`MenuFullGrid`, `MenuThumbStackAnimation`, `InlineToMenuLink`, `LinesToLayout`,
`InlineLayoutSwitch`, `ContentLayoutTransition`, `ImageToGridTransition`,
`OnScrollViewSwitch`, `HoverPreviewMiniMap`, `IntroTrailEffect`,
`ParanoiaSlideshow`, `DiagonalThumbnails`, `ShapesSlideshow`, `DoubleSlideshow`,
`ZoomSlideshow`, `FullscreenScroll`, `PreviewContentTransition`, `ImageToContent`,
`TooltipTransition`, `RepetitiveTypography`, `AnimateSVGTextPath`,
`ScrollAnimationsGrid`, `EaseReverseClipMenu` (8★, 2026-04 — gsap plus 3.2 MB of
imagery for a single clip menu), `OnScrollPathAnimations` (102★, Lenis + GSAP
animating SVG paths on scroll — **the best of this group and the one to fetch
first if more are wanted**).

### Excluded on bundled fonts

| Repo | ★ | Reason |
|---|---|---|
| `AnimatedCustomCursor` | 159 | **Bundles 4 font files.** Otherwise a strong cursor candidate (gsap + SVG filters, 4 images) — but rule 3, and A5/B4 already cover the category |

### Already shipped

| Repo | ★ | Note |
|---|---|---|
| `TypeShuffleAnimation` | 339 | Already ported as our `scramble` effect, at commit `8f171f1f`. Not re-examined |

### Not demos

`CodropsTemplate` (boilerplate), `coding-challenge-planner` (a Bolt.new app),
`CodropsBranding` (brand assets). `codrops2020` is listed under dependency above
— it is both a yearly roundup and locomotive-scroll-based.

---

## CONCERNS

**1. Two of our best sections have no category.** The schema enum is
`backgrounds, particles, 3d-hero, scroll, text, cursor, transition`. Fourteen of
the 36 candidates are menus or grids/galleries and neither has a home.
Shoehorning a menu reveal into `text` would make the registry lie to the site
agent that queries it. **Proposal: add `menu` and `gallery` to
`schema/meta.schema.json`.** The alternative — folding menus into `transition`
and galleries into `scroll` — keeps the enum frozen but produces a `scroll`
category holding 12 unlike things. This is a plan-level decision, not something
a porting agent should decide file by file.

**2. GSAP is everywhere, but rarely load-bearing.** 104 of the 126 MIT repos
touch GSAP (counted across `package.json` dependencies and bundled files). What matters is *which part*: 17 repos use `Flip`, `ScrollSmoother`
or `Observer` as the actual mechanism and are excluded; the rest use core tweens
and `ScrollTrigger`, and `ScrollTrigger` + `scrub: true` is a direct match for
anime v4's `onScroll({sync})` — the shape we already shipped in `reveal-stagger`
and `pin-progress`. Do not let a `gsap.min.js` script tag alone disqualify a
candidate; read for the plugin.

**3. `KineticTypePageTransition` needs one check before it is dispatched.** It
imports `gsap/CustomEase`, a Club GreenSock plugin. I judged it portable because
CustomEase is used to *define a curve* and anime v4 accepts an easing function —
but the porting agent should confirm the curve transcribes before treating this
as a port rather than an approximation.

**4. `curtain-transition` (sketches 021/022) has one unverified assumption.** It
animates an SVG path's `d` attribute through four states. I believe they
interpolate numerically because all four share an identical command sequence,
but I did not run it. If that turns out false, anime v4's `svg.morphTo()` is the
fallback, and if that also fails the effect stops being light-moderate. Worth
being the first thing tested in that port.

**5. `codrops-sketches` is a better source than its star count implies.** One
MIT repo at one sha (`bbf47ca3…`) holds 29 self-contained demos: 8 custom
cursors, 6 infinite-loop scrollers, 2 SVG-path page transitions, 6 image motion
trails, 4 repetition hovers. Several have **zero** dependencies. Five candidates
above come from it and roughly ten more are available at the same sha if the
first batch lands — meaning ten more effects for one licence check and one sha.

**6. The recent Codrops hub is drifting away from us.** I fetched
`tympanus.net/codrops/demos/`; of the eight most recent entries, six are Three.js
experiments (Eiffel Tower catapult, face-mask webcam tracking, datamosh
post-processing, physics footballs, icosahedron cluster, Blender pinball) and
one is a Webflow tutorial. Only "Infinite Scroll Gallery with Page Transitions
using GSAP" (2026-07-30) is section-shaped, and it does not appear in the org —
recent guest-authored demos publish under the author's own GitHub, so their
licence is the author's and would need checking case by case. **The org is the
right source for section work; the hub's 2026 output mostly is not.** Nobody
should re-run this survey expecting the recent hub to yield more.

**7. Star count is close to useless here, and inverted at the top.** The five
highest-star repos in the org (2311★ down to 1261★) are all unlicensed
jQuery-era demos. Everything usable sits between 27★ and 372★, and two of the
best candidates (`RepeatingImageTransition` 27★, `RotatingOnScrollAnimations`
34★) are low only because they are recent. Rank by mechanism and assets, not by
stars.

**8. Nothing here was seen rendering.** Repeating the honesty line because it
bounds every visual claim above: 36 candidates judged from source, trees,
`index.html` markup and Codrops' own article blurbs. Before a port ships, someone
should open the demo. That is a review step, not a research step, but it is not
optional.

---

# Scout log

One section per run. The `Survey date` line at the top of this file is the
watermark the next run reads; everything below is what a run actually looked at,
so nobody re-opens a source that was already closed.

## 2026-09-14 — window 2026-09-06 to 2026-09-14

Eight days. Four sources open, one shut in our face, two effects landed.

### Ported

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `sg-suminagashi` | `shader-gallery/shaders`, `suminagashi/shader.frag` + `suminagashi/meta.json` | `4e8d4cb2` | MIT | Japanese floating-ink marbling on warm washi. Light ground and line work rather than a gradient, which nothing else in the library is — `sg-bask` was the only light-ground hero and it is a gradient. |
| `sg-hologram` | `shader-gallery/shaders`, `hologram/shader.frag` + `hologram/meta.json` | `4e8d4cb2` | MIT | Scanline HUD projection with chroma ghosts, dialled ring gauges and a hazy room. No sci-fi/telemetry hero existed; `code-reveal-grid` is the nearest and it is a code background. |

Both gates green: `check` 101 effects (lint, build, smoke, 388 tests),
`verify` 97 pass / 1 warn / 0 fail, and the warn is `paw-avatar`'s pre-existing
one. Neither new port raises even a `numeric-trace` warn.

### Vetted, not ported — 57 more shaders at the same sha

`shader-gallery/shaders` added 59 shaders across `ea23b47d` (2026-09-08) and
`39feb27d` (2026-09-09), then promoted six out of its workshop in `4e8d4cb2`.
All 59 are listed in `manifest.json` at that head, all MIT, all written to the
same uniform contract `effects/_shared/glsl-mount.js` already supplies
(`u_time`, `u_resolution`, `u_mouse`, `u_pixelRatio`, `u_palette[4]` plus float
params), all GLSL ES 1.00. That makes each one roughly an hour of porting with
no new dependency and no new runtime. The 57 not taken this run, at
`4e8d4cb27bfdd662c4b8515eb83334ece40eea10`:

`acidsquares` `agate` `ballpit` `beacon` `beams` `blinds` `boids` `brick`
`bulge` `carbon` `chalk` `chrome` `circuit` `condensation` `confetti` `conic`
`crystal` `damascus` `datamosh` `deckle` `dendrite` `dunes` `engraving`
`erosion` `felt` `filings` `flowfield` `fluted` `foil` `gabor` `grainient`
`griddistort` `hyperspeed` `inkflow` `lightleak` `lightshow` `marquee`
`mirrorplane` `mycelium` `newton` `obsidian` `opart` `pillar` `pixelsort`
`plaque` `plasma` `plumage` `rainglass` `scales` `scratches` `shatter`
`spotlight` `thermal` `turing` `waxseal` `wireframe` `woodgrain`

Eight were read closely and their posters opened. Ranked for a future run:
`obsidian` (fractured volcanic glass, dark material), `rainglass` (rain on a
night window, bokeh behind it — richer than `bokeh-drift` but adjacent to it),
`lightleak` (anamorphic film flares — adjacent to `god-rays`), `chrome` (liquid
mirror — close enough to `liquid-metal` to want a side-by-side first),
`damascus`, `foil`. Skip as duplicates of something already shipped: `marquee`,
`confetti`, `plasma`, `grainient`, `ascii`-adjacent names, `bokeh`.

One trap worth carrying forward: these shaders declare `"palette": null` in
their upstream `meta.json`, which means upstream's runtime feeds zeros and the
shader falls through to four colours it carries in its own `main()`. Those four
are what the poster is rendered with, so a port should pass them explicitly
rather than invent a palette — and it is a `seam`, not an `ours` deviation. That
is the opposite of the `cd06eee` seventeen, whose metas name a palette preset
the port genuinely cannot resolve.

### Rejected

| Candidate | Source | Reason |
|---|---|---|
| 3D Face Mask with Three.js | `kaltwrk/experiment-001`, Codrops hub 2026-09-06 | Needs a webcam and MediaPipe, which fetches its models off-site. Not a section, and it would break the "style.css fetches nothing off-site" rule at the runtime level. |
| Building Depth: a 3D Renderer Inside Figma | Codrops 2026-09-13 | No repo published with the article, so no LICENSE to resolve. Also a Figma plugin, not a web section. |
| Yestalgia (Decathlon) | Codrops 2026-09-12 | Case study. No code. |
| Inside the First Three.js Conference | Codrops 2026-09-10 | Editorial. No code. |
| Turning Names Into Digital Architecture | Codrops 2026-09-09 | No repo link; the demo is a Webflow site. No LICENSE to resolve. |
| Still: a Generative Garden in WebGPU | Codrops 2026-09-09 | No repo link. |
| Infinite Liquid Glass Grid | Codrops 2026-09-08 | No repo link, and the stack is React Three Fiber v10 + Next.js + WebGPU + `pmndrs/glyph`. Not vanilla-portable even with a licence. |
| Drawing With Light: Lit GPU Tubes | Codrops 2026-09-07 | No repo link. TSL on the WebGPU renderer, which we do not vendor. |
| `DavidHDev/canvas-ui` | GitHub, 4572★, pushed 2026-09-13 | `LICENSE.md` resolves to `NOASSERTION` — GitHub cannot identify it, so it is not on the allow-list. Same author as React Bits, which is a standing hard reject. |

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest item is 2026-09-06 (the face mask
  above). Nothing published 09-07 to 09-14. Confirms CONCERN 6 above from
  another angle: the hub's recent output is Three.js conference experiments,
  not sections.
- **Codrops org repos.** Newest push is `RotatingOnScrollAnimations`,
  2026-06-18. Nothing new.
- **Vendor releases.** `tsparticles` v4.4.0 shipped 2026-08-31, before the
  watermark, and it is a library bump rather than an effect — we vendor 4.3.2
  and nothing in the release asks us to move. `lenis` newest is v1.3.26
  (2026-08-05), already the vendored version. `paper-design/shaders` has cut no
  GitHub releases at all.
- **GitHub topic search** (`css-animation`, `shaders`, `scroll-animation`,
  `webgl`, `animation`, pushed since 2026-09-06). Everything above the noise
  floor is an engine, an editor or a game — `bgfx`, `Graphite`, `Pixelorama`,
  `rust-gpu`. Nothing section-shaped. `pushed:` is a poor proxy for "new", so a
  future run should weight `created:` instead.

### CodePen is closed to us right now

Worth its own heading because it costs a future run half an hour to rediscover.
`codepen.io` sits behind a Cloudflare bot challenge that neither route gets
past: `curl` with a browser user-agent returns **403** on `/trending`, `/picks`
and every RSS feed (`/picks/feed`, `/popular/pens/feed`, `/spark/feed`), and
headless Chrome through `agent-browser` loads the interstitial and stays on
"Just a moment…". `WebFetch` gets the same 403. So there is no way to browse
trending pens or to read a pen's details page — and the details page is the only
place the MIT notice is evidenced, which is what Step 3 requires before the
snapshot recipe may run.

This does **not** retire CodePen as a source. `dither-relief` and
`glass-transition` are still valid ports and `cdpn.io` (the asset host the
snapshot recipe reads from) is a different host and was not tested as blocked.
If a future run has a way to see a details page — a signed-in browser profile, a
pen URL the captain supplies directly — the recipe still works. Discovery is
what is blocked, not porting.

### A note the next run should read first

`agent-browser screenshot` hung on every call for the first half of this run:
`CDP command timed out: Page.captureScreenshot`, then `Failed to read: Resource
temporarily unavailable (os error 35)`. It survived closing the session, killing
the daemon and killing Chrome. `open` and `eval` worked the whole time; only
screenshot was dead, which takes out both the preview capture and the entire
`smoke` gate.

The fix is one command: **`agent-browser stream disable`**. Runtime streaming
was enabled (`ws://127.0.0.1:49969`, `Connected: false`), and a screencast
holding the capture pipeline starves `Page.captureScreenshot`. Check
`agent-browser stream status` before concluding the tool is broken.
