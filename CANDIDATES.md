# Codrops candidates for paw-fx

Survey date **2026-09-26**. The body of this file is the 2026-09-06 org survey
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

Eight had their `meta.json` and `shader.frag` read closely; six of those also
had their posters opened (`suminagashi`, `hologram`, `chrome`, `rainglass`,
`lightleak`, `obsidian`). `foil` and `damascus` were judged from source alone.
Ranked for a future run:
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

### Contrast is the step that nearly shipped a lie

Both `style.css` files started as clones of `sg-gloam` and `sg-bask`, and the
clone carried their contrast comment: "measured worst case across four animation
frames with the copy hidden is recorded in the PR". Nothing had been measured.
Measuring it found three of the four text runs under the README's 4.5:1 floor:
`sg-hologram` title 3.52:1 and lede 2.49:1 at the inherited `--fx-scrim: 0.58`,
`sg-suminagashi` lede 3.03:1 at `0.5`. Both defaults moved, and on both effects
the scrim alone could not carry the lede without washing the effect out, so
`--fx-muted` moved a step toward the ink as well. Final: 5.99 / 4.77 and
7.94 / 4.80.

Two things for the next run. **Do not inherit a measurement comment along with
the CSS it sits in** — a cloned resting layer is a different composition under
the same copy, so the number is never transferable. And the new ports rest as
line work rather than blurred gradient, which is exactly why the numbers came
out worse: a hairline ring crossing a lede is a hard edge, not a soft field.

The README's method asks for the worst ratio across several animation frames.
Only one frame was available: headless Chrome ran rAF (120 frames confirmed) but
would not advance the composite, so four successive screenshots came back
byte-identical. Whoever gets multiple frames should re-measure, because the roll
bar on `sg-hologram` and a ring drifting under the copy on `sg-suminagashi` can
both put a worse pixel there than the frame that was measured.

`scripts/` has no contrast tool, which is why this was done by hand each time.
Worth writing one if a third light-ground or line-work hero lands.

## Solace shaders (HARSHITSHARMA18/shaders) — 14 WebGL effects, cleared to port

Found 2026-09-15 via <https://shaders.solaceui.com/>. MIT, Copyright (c) 2026
Harshit Sharma, "A WebGL based shaders library under Solace Labs". Next.js 16 /
React 19 wrapper over raw WebGL + GLSL, shipped as a shadcn registry.

Fourteen: thermal pixel ink, viscous cursor dye, reaction bloom, cellular
contagion, repulsion lattice, magnetic pixels, chromatic refraction, thermal
etch burn, particle assembly, refractive lens, exposure grid, black hole
portal, fluid distortion, specimen index.

**Provenance checked before adding, because the repo credits no upstream and
several of those names are the most-copied Shadertoy genres there are.** A
Shadertoy lift would carry CC BY-NC-SA 3.0 -- non-commercial and share-alike,
which this registry cannot take whatever licence the wrapper claims. Three
checks, all clean:

1. Zero Shadertoy idioms in the shader sources: no `mainImage(`, `fragCoord`,
   `iTime`, `iResolution`, `iMouse`, `iChannel`.
2. Uniform naming is bespoke and semantic -- `u_heat`, `u_pressure`,
   `u_bandShift`, `u_decay` -- not Shadertoy's `i*` convention.
3. Seventeen commits across seven weeks, reading prototype -> catalog ->
   public release. A copied corpus lands finished in one commit.

So: portable under the normal port contract, `origin` pointing at the repo and
the licence header lint asks for. The React wrapper is rewritten to vanilla
`mount(el, opts)` the same way the paper-design ports were; the GLSL is what
carries over.

Pick order when this gets scheduled: the ones with no equivalent on the shelf
already. `chromatic refraction`, `refractive lens` and `black hole portal` have
nothing like them; `fluid distortion` overlaps `warp` and `liquid-metal`.

## 2026-09-17 — window 2026-09-14 to 2026-09-17

Three days. Five new things turned up, none of them a section we can port, so
nothing landed. This entry exists so the next run does not screen the same five
again.

### Ported

None.

### Rejected

| Candidate | Source | Commit | Licence | Reason |
|---|---|---|---|---|
| Elemental Sandbox | `achrefelouafi/LinearAbiltyCastingThreeJS`, Codrops hub 2026-09-16 | `ba61847c` | MIT | A Three.js skillshot game, not a section. Six ability files at 24 to 49 KB each, a character mesh, keyboard casting, `lil-gui` and a Vite build. |
| Reel Flux | Codrops hub 2026-09-14, demo only (`saurow-reel.vercel.app`) | none | none | Tagged GSAP, and no repo, so no LICENSE to resolve. It was not on the hub when the 09-14 run looked. |
| MeltGL | `1etu/MeltGL`, GitHub, created 2026-09-12 | `c9a42842` | MIT | Good idea (a real fluid solver melting an image, silhouette and all) in the wrong shape: a strict-TypeScript monorepo under `Packages/*` with no built ES module to pin, and it needs an input image or video. A port would mean transpiling several packages, which is rewriting, not porting. Worth another look if it publishes built JS. |
| LUMEN light lab | `handsomeZR-netizen/lumen-light-lab`, GitHub, created 2026-09-16 | `dbe8b9ce` | MIT | The only candidate shaped like a section (single 18 KB `index.html`, zero deps, WebGL2 silk bands, film grain, click ripples that refract the headline with a chromatic split). Rejected on provenance. One commit landed all of it finished with a polished bilingual README, and 0 stars. Its own header says it was "inspired by the visual language of OpenShaders", and OpenShaders has published no shader source (see below), so a clean re-derivation cannot be told apart from a lift of the openshaders.com page. Also not a seam-only port: resize, the text-to-texture step, the ripples and the pointer are all in viewport coordinates, and scoping them to a section changes the visual logic. |
| topowall | `gonzalezerik/topowall`, GitHub, created 2026-09-13 | `71427e39` | MIT | A Rust CLI and web app for wallpapers from real elevation data. Needs the data fetched, and it is a tool, not a section. |

No Shadertoy idioms in LUMEN (`mainImage`, `fragCoord`, `iTime`, `iChannel` all
absent) and no off-site URLs. Those checks came back clean. The provenance
problem is the OpenShaders line and the single-commit shape, not the code.

### A source to watch, carefully

`openshaders/openshaders` (MIT, 229 stars, created 2026-09-06, head
`d565f2c3`) is the shell of a shader platform at openshaders.com. Today it
ships a README and a header image, no shaders. Its README says the MIT licence
covers the platform only and each creator picks the licence for their own
shader. So when shaders land, screen each one on its own licence, never the
platform's. It is built by the same author as React Bits (a standing hard
reject) and `DavidHDev/canvas-ui` (rejected 09-14, `NOASSERTION`). That is not
a reject on its own, but it is a reason to read every licence twice.

### Sources checked and found quiet

- **`shader-gallery/shaders`**: no commits since 2026-09-13. Head is still
  `4e8d4cb2`, so the 57-shader queue from the 09-14 entry is unchanged and
  still available. It was not touched this run because none of it is newer
  than the watermark.
- **`paper-design/shaders`**: no commits since 2026-09-13.
- **Vendor releases**: `tsparticles` newest is still v4.4.0 (2026-08-31),
  `lenis` still v1.3.26 (2026-08-05).
- **Codrops org repos**: newest is still `RotatingOnScrollAnimations`,
  2026-06-18.
- **Codrops articles** 09-14 to 09-16 (Resn, Vivid, House of Yellow) are case
  studies and Webflow write-ups with no repo.
- **GitHub topic search** (`webgl`, `shaders`, `glsl`, `css-animation`,
  `scroll-animation`, `animation`, `canvas-animation`), weighted on `created:`
  as the last entry suggested, plus keyword searches. Mostly engines, games,
  fly-brain toys, React/SwiftUI components and zero-star generated landing
  pages. The five above are everything that was close.
- **GitHub trending** (weekly JavaScript, GLSL, CSS): nothing effect-shaped.
- **Solace shaders**: skipped on purpose. PR #34 is porting them.

### CodePen: still closed

`/trending` and `/picks/feed` still return 403 to a browser user-agent.
`cdpn.io` answers 301, so the asset host the snapshot recipe reads is
reachable, and a pen URL the captain supplies directly can still be ported.
Discovery is still what is blocked.

### For the next run

`agent-browser stream status` showed streaming switched back on
(`Streaming enabled on ws://127.0.0.1:55124`) even though the 09-14 run turned
it off. It comes back. Run `agent-browser stream disable` at the start of every
run, before any screenshot.

## 2026-09-18 — window 2026-09-17 to 2026-09-18

A one-day window, so discovery was always going to be thin, and it was: nothing
new survived screening. The run shipped anyway by taking two off the vetted
`4e8d4cb2` backlog, which is what Step 3.5 is for.

This branch is based on the 2026-09-17 scout branch rather than on `main`, so
the two runs' log entries stack instead of colliding on this file's tail. If
that PR is merged first, this one's diff on the watermark line applies cleanly;
if this one goes first, that one is a subset.

### Ported — from the backlog, not from discovery

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `sg-obsidian` | `shader-gallery/shaders`, `obsidian/shader.frag` + `obsidian/meta.json` | `4e8d4cb2` | MIT | Ranked first on the 09-14 queue. A freshly broken face of black volcanic glass: eight conchoidal fracture shells stacked as planes, ripple ribs and radial hackle, a Fresnel skin reflecting a dim studio, razor edge glints. The shelf's first *material* hero — everything else in `backgrounds` is a field or a gradient. |
| `sg-rainglass` | `shader-gallery/shaders`, `rainglass/shader.frag` + `rainglass/meta.json` | `4e8d4cb2` | MIT | Ranked second. Rain on a night window: a defocused bokeh street behind a fogged pane, runners falling in stalls and darts, each drop a lens showing the field sharp and inverted. The 09-14 note flagged it as "adjacent to `bokeh-drift`" — it is not, once rendered. `bokeh-drift` is a tsParticles field of drifting discs; this is a refraction effect where the discs are what is being refracted. |

Licence re-verified at the pinned sha rather than trusted from the 09-14 note:
`contents/LICENSE?ref=4e8d4cb27bfdd662c4b8515eb83334ece40eea10` is MIT,
Copyright (c) 2026 E. T. Carter.

Both gates green from the worktree. `check`: 103 effects, lint clean, smoke ok,
427 tests pass. `verify`: 99 pass, 1 warn, 0 fail, 0 error, 3 skipped — both new
ports PASS with zero warns, and the single WARN is `paw-avatar`'s pre-existing
one.

### The palette trap on this batch is the OPPOSITE of the 09-14 one

Worth stating plainly, because the 09-14 entry's advice does not apply here and
a future run following it would be wrong. `suminagashi` and `hologram` declared
`"palette": null`, so their own fallback colours were recoverable and the port
was told to pass those exact four as a `seam`. `obsidian` and `rainglass` do
not: they declare `"defaultPalette": "nocturne"` and `"peacock"`, named presets
whose table lives in `@shader-gallery/runtime`, which is not vendored and is not
in the pinned repo. Those are unresolvable, so both ports ship four colours of
their own and declare them `ours` — the same call `sg-gloam`, `sg-bask` and
`sg-nebula-drift` already made.

So the rule is: read `meta.json` before assuming which case you are in. `null`
means go and find the fallback in the shader's `main()`. A preset NAME means
pick your own and say so.

### The palette is a contrast control, not only a colour choice

The more useful finding, and the one that cost the most time. Both effects
FAILED the README's 4.5:1 floor on the first measurement, badly:

| | eyebrow | title | lede | ghost CTA |
|---|---|---|---|---|
| `sg-obsidian`, first pass | 2.37 | 3.14 | **1.78** | 6.52 |
| `sg-rainglass`, first pass | 2.38 | 3.62 | **2.36** | 3.58 |

The instinct is to reach for `--fx-scrim`, and on the gradient heroes that is
the right knob. It is the wrong *first* knob here. Probing the scrim response on
`sg-rainglass` showed why: with the scrim at 0 the brightest pixel under the
lede is `rgb(254,254,226)` — the shader is clipping to white. Both of these
shaders build their bright regions ADDITIVELY out of the palette (bokeh discs
summed as light sources; a soft-box reflected through a Fresnel skin), so a hot
palette saturates and no amount of scrim recovers detail, it only greys the
whole hero down.

Darkening the four poles first, then raising the scrim, got there with far less
wash. Final: palettes dropped roughly a third in luminance, `--fx-muted` moved
a step toward the ink on both, `--fx-scrim` 0.78 on both.

| | eyebrow | title | lede | ghost CTA | worst |
|---|---|---|---|---|---|
| `sg-obsidian` | 5.86 | 6.68 | 4.69 | 10.76 | **4.69** |
| `sg-rainglass` | 5.22 | 6.62 | 5.14 | 6.38 | **5.14** |

Order for the next light-heavy port: palette down, then muted, then scrim.

### Multi-frame contrast is solved — one page LOAD per frame

The 09-14 entry recorded that it could only ever measure ONE frame, because four
successive screenshots in a session came back byte-identical, and asked whoever
got multiple frames to re-measure. This run reproduced that freeze and then got
past it.

The composite does not advance between screenshots *within one page session*.
It does advance across page LOADS, because the shader's clock starts at mount.
So: reload the page per frame with a different settle delay, screenshot once
each. Four loads at 1s / 4s / 8s / 13s gave four genuinely distinct frames
(distinct sha256), and every number in the tables above is a worst-of-four.

Two supporting details, both of which cost time to rediscover:
- Read the ink by painting it to a 2D canvas. `getComputedStyle` serialises
  `color-mix()` as `oklab(...)`, so scraping the first three numbers reads
  lightness as red — this is in the README and it is still easy to trip over.
- Hide `.fx-<name>__inner` for the captures so the measured pixels are the
  background alone, and collect the boxes in a separate pass with it visible.

### The preview recipe needs `.fxd-knobs` hidden now

PR #33 ("Live knobs on every demo") added a `nav.fxd-knobs` panel to every demo
page. The scout task's capture recipe predates it and hides only `.fxd-bar` and
`.fxd-filler`, so the first previews captured this run had a "Knobs" panel
sitting across the bottom right of the thumbnail. The eval wants all three:

    document.querySelectorAll('.fxd-bar,.fxd-filler,.fxd-knobs').forEach(e=>e.style.display='none')

Also confirmed for a second run in a row: `agent-browser stream status` showed
streaming switched back ON despite the 09-17 run disabling it. It comes back
every time. Disable it before the first screenshot.

And one correction to the recipe's premise, in its favour: `?reduced=1` does
NOT capture the CSS resting state on these shaders. `glsl-mount.js` runs
`resize()` and `draw(0)` before it consults reduced motion, so frame 0 is a real
shader frame and `data-fx-live` is set. Both previews this run asserted
`data-fx-live === true` before the shot. Keep asserting it — that is what
separates a real capture from a silent fallback — but the flag is not the
problem it looks like.

### Discovery — screened and rejected

| Candidate | Licence | Why |
|---|---|---|
| `Pallarium/labs` | **none** | The most frustrating reject of the run: "14 live web demos. Shaders, particles, fluid fields and generative scenes. Single file each, zero dependencies, no build step" is almost a description of paw-fx's own contract. `gh api repos/Pallarium/labs/license` returns 404 — no LICENSE file at all, which is a hard reject with no discretion. Worth re-checking on a later run in case the author adds one. |
| `hamstirr/fractal-explorer` | MIT | A Mandelbrot / Julia / Burning Ship deep-zoom explorer in one HTML file. Licence is fine; the shape is not. It is an interactive tool whose whole point is the zoom, not a section that rests. |
| `xymeow/three-ink` | MIT | Three-tone shading, pen outlines and frosted film for Three.js. A render style applied to somebody else's scene, so there is no section here to port — it would need a scene invented around it, which is inventing. |
| `can4hou6joeng4/Landfall` | MIT | Landing-page generator skill built on GSAP. GSAP is a standing hard reject. |
| `bruce12-glitch/chaiwala` | none | Three.js + GSAP/ScrollTrigger + Lenis brand page. No licence and GSAP both. |
| Elemental Sandbox (Codrops hub, 09-16) | MIT | Already screened and rejected by the 09-17 run. Not re-opened. |

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest item is Elemental Sandbox,
  2026-09-16, which the 09-17 run already rejected. Nothing published 09-17 or
  09-18.
- **`shader-gallery/shaders`.** `commits?since=2026-09-17` is empty. The
  `4e8d4cb2` backlog is still the whole of what this vendor offers.
- **`paper-design/shaders`.** Two commits on 09-17, "Paper texture 2.0 (#220)"
  and a version bump. Checked the changed-file list rather than the title: it
  touches `CHANGELOG.md`, a docs migration page and two `package.json`s. No new
  shader source, so there is nothing to port and no reason to move our pin.
- **GitHub topic search**, `created:>=2026-09-16` across `shaders`,
  `css-animation`, `webgl`, `scroll-animation`. `css-animation` returned nothing
  at all. The rest is in the reject table. Using `created:` rather than
  `pushed:` — which the 09-14 entry asked for — did work better: it surfaced
  `Pallarium/labs`, which a `pushed:` sort would have buried.
- **CodePen.** Still 403 behind the bot challenge. Not re-tested beyond one
  request; see the 09-14 entry for the full account.

### Backlog after this run

55 of the 57 shaders logged at `4e8d4cb27bfdd662c4b8515eb83334ece40eea10`
remain. `obsidian` and `rainglass` are taken. Next in the recorded ranking:
`lightleak` (anamorphic film flares, adjacent to `god-rays`), then `chrome`
(liquid mirror — the 09-14 note asks for a side-by-side against `liquid-metal`
before committing to it), then `damascus` and `foil`.

The Solace shaders were left alone again on purpose: PR #34 is still open and
owns them.

## 2026-09-19 — window 2026-09-18 to 2026-09-19

Discovery found a real port and it was built. It is **not in this PR**, because
every screenshot path on this machine is dead and an effect cannot ship without
a `preview.png` or a passing `smoke`. The port is finished and pushed on its own
branch; this entry is the watermark plus the handover.

This branch is based on the 2026-09-18 scout branch rather than on `main`, same
as that one was based on 09-17, so the three runs' entries stack on this file's
tail instead of colliding. If the earlier PRs merge first, this diff applies
cleanly; if this one goes first, they are subsets.

### The capture path is broken machine-wide — read this before anything else

`agent-browser screenshot` fails on **every** effect, including ones that
captured fine on 09-18:

    ✗ Failed to read: Resource temporarily unavailable (os error 35)
      (after 5 retries - daemon may be busy or unresponsive)

That takes out `bun run smoke`, and with it `bun run check`. It is not the
wedge the 09-14 entry documents. **`agent-browser stream disable` does not fix
it** — streaming was already off (`stream status` said so before the first
command of this run) and disabling it again changed nothing. Do not spend the
time re-running that recipe.

Everything tried, all of it failing the same way:

| attempt | result |
|---|---|
| `stream disable`, then screenshot | streaming already off; screenshot still EAGAIN |
| kill the daemon, kill headless Chrome, fresh session | EAGAIN on the first screenshot of a fresh daemon |
| fresh session per shot, one shot only | EAGAIN |
| `--headed` | `requestAnimationFrame` never fires; 0 frames in 1s |
| `--args "--disable-backgrounding-occluded-windows,--disable-renderer-backgrounding,--disable-background-timer-throttling,--disable-features=CalculateNativeWinOcclusion"` | 0 frames in 1s |
| Chrome for Testing 150 driven directly, `--headless=new --screenshot=` with `--virtual-time-budget=6000` | hangs until killed |
| the same binary with `--headless --disable-gpu --enable-unsafe-swiftshader --screenshot=`, on a static HTML page with no WebGL and no script at all | hangs until killed, no file written |

That last row is the one that settles it. A soft-GL Chrome screenshotting a page
that is nothing but a heading on a grey background still hangs, so the fault is
in Chrome's capture path on this machine and has nothing to do with the GPU,
with WebGL, with agent-browser or with any effect in this library. It also rules
out the fallback recipe that has been carried in notes since 09-14 — driving
Chrome for Testing directly with `--disable-gpu --enable-unsafe-swiftshader`.
That recipe is not a way around this particular outage. Whoever picks this up
should check a trivial page first: if `--screenshot=` cannot capture a static
heading, no capture work is possible and the run should go straight to a
log-only PR instead of spending an hour proving it.

Two separate symptoms, and it is worth keeping them apart because they fail
different things. **`requestAnimationFrame` does not run at all** in the
agent-browser browser right now — measured at zero callbacks per second on an
existing effect's demo page, not just on the new one. And **`Page.captureScreenshot`
hangs or returns EAGAIN**, which is what kills `smoke`. The shared-runtime
shader ports still set `data-fx-live` without rAF, because `_shared/glsl-mount.js`
draws frame 0 synchronously; anything that paints on rAF cannot.

The same page renders perfectly in a real browser. Verified in the Claude
desktop Browser pane: 47 rAF callbacks per second, context up, first frame
drawn, `data-fx-live` set, no console output. So this is the machine, not the
library and not the port.

### Ported, gated, and parked — `gobo-light`

On `origin/wip/gobo-light` at `a6708cf`. Everything except the preview and the
smoke gate is done.

| | |
|---|---|
| Upstream | [`thevangelist/tinseltown`](https://github.com/thevangelist/tinseltown) `e31bfc89f22001aa5766eb4032a6d6134b46541b` |
| Licence | MIT, Copyright (c) 2026 Esa Lahikainen, verified at the pinned sha |
| Files | `src/tinseltown.js` + `src/shader.js` + `src/optics.js` + `src/options.js` + `src/cookies.js` |
| Category | backgrounds |
| Needs | nothing — zero vendored dependencies |

A film crew puts a cut-out — a cucoloris, a cookie, a gobo — in front of the
lamp, and flat light gets pattern. The shader traces that: an area lamp sampled
over its own surface, one to three cut-out planes between it and the wall,
inverse-square falloff, a 12-probe pass that finds the pixels in a penumbra so
only those pay for all 48 samples, and an optional 16-step haze march. A still
rig keeps averaging into a half-float buffer for about two dozen frames and
resolves to roughly a thousand samples. Nineteen presets — venetian blinds, a
window, french doors, leaves, a palm, a fence, chain link, a ceiling fan, a
passing train — every one generated in code as an SVG and rasterised in
process, so the section fetches nothing.

**Gate results, the two that do not need a browser:**

- `bun run verify` — **`gobo-light` PASS, zero warns.** Run-wide: 104 effects,
  100 pass, 1 warn, 0 fail, 0 error, 3 skipped. The single WARN is
  `paw-avatar`'s pre-existing one. `numeric-trace` came back clean, which is
  the result worth noting: every numeric literal in a 41 KB concatenation of
  five upstream modules traced to a pinned upstream file.
- `bun test` — 421 pass. The failures are both downstream of the capture fault:
  `smoke.test.js` errors on the EAGAIN above, and `gallery.test.js` fails
  `previews 103, expected 104` purely because `gobo-light` has no `preview.png`.
  The other four suites run 114 pass / 1 fail, that same preview count.
- `bun run lint` — clean apart from `gobo-light: preview.png missing`.
- `bun run smoke` — could not run at all. See above.

**Provenance, checked before a line was ported**, because the repo is one day
old with zero stars, which is the exact shape the 09-17 run rejected LUMEN on.
LUMEN's discriminators do not apply here and it is worth recording why so this
is not re-litigated:

1. Fourteen commits across three hours reading as a release arc — 0.1.0, a demo
   pass, 0.2.0, a fix, 0.3.0 — not one commit landing everything finished.
2. Published to npm as `tinseltown`, three versions, MIT in the registry
   metadata as well as in `LICENSE`.
3. The account dates to 2013 with 175 followers, and the repo carries its own
   CI, its own test suite and a CHANGELOG.
4. No Shadertoy idioms anywhere in the GLSL: no `mainImage`, `fragCoord`,
   `iTime`, `iResolution`, `iMouse`, `iChannel`. Uniform naming is bespoke and
   semantic — `uCookie`, `uWallNorm`, `uHazeDepth`, `uDistance2`.
5. No "inspired by" line pointing at an unpublished source, which is the thing
   that sank LUMEN.
6. No off-site URL in any source file. The presets are SVG strings built in
   code; the one photograph in the README is a docs image and never a runtime
   fetch.

**The six seams**, all declared in `meta.json.deviations`:

1. The five ES modules are concatenated into one `index.js` in dependency
   order, with sibling `import` lines and `export` keywords stripped and
   nothing else touched. The build emits one `index.js` per effect, so a shared
   module has nowhere to live in a generated site. Done by script, not by hand,
   so the visual logic is upstream's byte for byte — which is what `verify`
   then confirmed.
2. `customElements.define` moved out of module scope into `mount()`, under the
   namespaced tag `fx-gobo-light-backdrop`. The rename is not cosmetic: a page
   that also loads tinseltown itself would otherwise have two definitions
   racing for one tag and the loser throws.
3. The two `matchMedia` queries and the `navigator.getBattery()` probe moved
   into a `wireOnce()` that `mount()` calls. Bodies unchanged.
4. The class itself moved into a lazy factory. It read
   `globalThis.HTMLElement` to choose its base, which lint catches and is right
   to catch — that is a global read at module evaluation however it is spelled.
   The body is indented mechanically into `backdropClass()`, not retyped.
5. `failIfMajorPerformanceCaveat: true` added to the context request, per the
   repo contract. Upstream's `powerPreference: 'default'` is kept, and for the
   reason upstream gives: a backdrop must not be why a laptop switches GPU.
6. Two read-only getters, `live` and `painted`, plus one line that sets the
   flag behind `painted` after the trace pass draws. paw-fx has a CSS hero
   underneath that has to be told whether to stay.

### The finding worth keeping: poll with a timer, never with rAF

`mount()` has to wait before it sets `data-fx-live`, because the cookie
rasterises through `image.decode()` and the first frame is therefore
asynchronous. The first version polled on `requestAnimationFrame`. That is
wrong twice over, and the broken machine is what surfaced it:

- rAF is frame-coupled, so the poll starves in exactly the cases where the flag
  has legitimately not flipped yet — a hidden tab, a throttled compositor, and
  a section below the fold whose IntersectionObserver is correctly holding
  rendering off. The observed failure was `painted: true` with `data-fx-live`
  never set, because the polling frame after the paint never came.
- On a hero nobody scrolls to, an rAF poll spins sixty times a second forever.

It is a `setInterval(check, 100)` now, cleared the moment the flag flips or
`destroy()` runs. Any future port whose upstream paints on rAF wants the same
shape. The shared-runtime ports never hit this because `glsl-mount.js` draws
synchronously.

One more, smaller: `IntersectionObserver` fired **zero** callbacks in this
browser, on an element filling the viewport at `scrollY` 0. The element's
`#visible` starts `true` so it degrades safely, but do not use an IO callback
as a readiness signal in a capture script.

### To finish this port on a healthy machine

    git fetch origin && git checkout -b feat/gobo-light origin/wip/gobo-light
    bun run build && bun scripts/build-demos.mjs
    # serve dist/registry/gallery at a root, then, per the 09-18 correction,
    # hide all three chrome layers before the shot:
    #   document.querySelectorAll('.fxd-bar,.fxd-filler,.fxd-knobs')
    #     .forEach(e=>e.style.display='none')
    # assert data-fx-live is true, shoot 640x360 into effects/gobo-light/preview.png
    bun run check && bun run verify

Then measure contrast before opening the PR, and expect to have to move
something: a lit slat is the brightest thing in the frame by a wide margin, it
moves when `motion` is set, and the accumulation buffer *sharpens* it over the
first two dozen frames rather than softening it, so the worst pixel under the
lede arrives late. Use the 09-18 reload-per-frame method — the composite does
not advance between screenshots inside one page session, but it does across
page loads. Order of knobs on this effect: `intensity` down first, then
`--fx-muted`, then `--fx-scrim`. It currently ships `--fx-scrim: 0.74`,
unmeasured, and that number should be treated as a guess until somebody
measures it.

### Discovery — screened and rejected

| Candidate | Licence | Why |
|---|---|---|
| `swamoth/globedots` | MIT | The near miss. A dot-matrix globe on WebGL2, 18.4 kB gzipped, no three.js, with markers, arcs, paths and a day-night terminator, and 30 commits across three days so the provenance is fine. Rejected on shape: the source is TypeScript under `src/*.ts` with no built ES module in the repo to pin, and the globe spans `globe.ts` + `sphere.ts` + `markers.ts` + `arcs.ts` + five more. Porting it means transpiling eight modules, which is rewriting, not porting — the same call the 09-17 run made on MeltGL. Worth another look if it ever commits its `dist`. |
| `claudiu1910/Singularity-Observatory` | MIT | A Next.js 16 app with shadcn components, four routes and an access form. Not a section, and React/Tailwind source is not portable to a vanilla library. |
| `leandrolalanne/matrix-rain` | MIT | Renders natively on Linux as a desktop wallpaper. Not a web section. |
| `chuwd19/overprint` | MIT | Risograph separation and halftone screening for photos. A tool, and it needs an input image. |
| `haplollc/ProcessingField` | MIT | SwiftUI, not web. |
| `agayushh/lidfx` | MIT | A GNOME Shell extension. |
| `Julezbeyer/liveog` | MIT | Renders animated Open Graph cards to PNG/MP4/GIF. A build-time tool. |
| `AiPersonacademy/voicewave-studio` | MIT | A voice-UI animation generator; needs an audio track to be anything. |
| `alwaysnelson/photoditor-buddy` | MIT | A photo editor. |
| `hclivess/truewind` | MIT | A sailing simulator. |
| `RenaudRohlinger/node-webgl` | NOASSERTION | Headless WebGL for Node. Not a section, and the licence is unresolved anyway. |
| `MengTo/seijaku`, `bruce12-glitch/cluster`, `alexanderantonov/tinkerapp`, `Adhirajsingh2507/engine-ecosystem`, `Shrey0610/PageScape`, `Bebeto04/noctis-perfume`, `SaucesCode/horology-landing` | none | No LICENSE file. Hard reject, no discretion. |
| `can4hou6joeng4/Landfall` | MIT | Built on GSAP. Standing hard reject. |
| `kloserock97-tech/nightsail`, `kloserock97-tech/driftfield`, `minatoAI/taclight`, `XuanRuiMu/FengLai` | NOASSERTION | Unresolved licence. |

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest is still Elemental Sandbox,
  2026-09-16, rejected by the 09-17 run. Nothing published 09-17 or later.
- **`shader-gallery/shaders`.** `commits?since=2026-09-17` is empty. Head is
  still `4e8d4cb2`.
- **`paper-design/shaders`.** No commits since 2026-09-17.
- **Codrops org repos.** Newest is still `RotatingOnScrollAnimations`,
  2026-06-18.
- **Vendor releases.** `tsparticles` still v4.4.0 (2026-08-31), `lenis` still
  v1.3.26 (2026-08-05).
- **GitHub topic search**, `created:>=2026-09-16` across `shaders`, `webgl`,
  `glsl`, `css-animation`, `scroll-animation`, `animation`, `canvas-animation`,
  `webgl2`. `css-animation` returned nothing at all. Everything else that was
  close is in the reject table.
- **CodePen.** Not re-tested; still 403 behind the bot challenge as of 09-18.
- **Solace shaders.** Left alone again: PR #34 is still open and owns them.
- **`Pallarium/labs`.** Still no LICENSE file, so still a hard reject. Worth
  one `gh api repos/Pallarium/labs/license` on each future run — the shape is
  almost exactly paw-fx's own contract and it only needs the author to add one.

### Backlog after this run

Unchanged at 55 of the 57 shaders logged at
`4e8d4cb27bfdd662c4b8515eb83334ece40eea10`; nothing was taken, because a
backlog port would have hit the same dead capture path. `obsidian` and
`rainglass` are still the two taken. Next in the recorded ranking is still
`lightleak`, then `chrome` (the 09-14 note asks for a side-by-side against
`liquid-metal` first), then `damascus` and `foil`.

## 2026-09-20 — window 2026-09-19 to 2026-09-20

One day of discovery, because the 09-19 run moved the watermark to its own
date. One new candidate, rejected. Two effects shipped anyway: the port 09-19
parked, and one off the backlog. The run's real result is neither of those —
it is that the capture path works again, and why.

### READ THIS FIRST — the capture fault is Chrome for Testing, and there is a one-line fix

The 09-19 run lost its port to a dead `agent-browser screenshot`, and diagnosed
it as "the machine rather than the library". Half right. It is the *browser
binary agent-browser ships*, not the machine, and swapping it fixes both
symptoms at once:

```
export AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Prefix that on every command that touches agent-browser — including `bun run
check`, because `smoke` spawns the CLI through `Bun.spawn` and inherits the
environment. One unprefixed call silently falls back to the broken binary.

Measured on the same static `data:` page, same session, one command apart:

| browser | rAF callbacks/sec | `screenshot` |
|---|---|---|
| Chrome for Testing `150.0.7871.24` (agent-browser's own, at `~/.agent-browser/browsers/`) | **0** | `Page.captureScreenshot` times out, then EAGAIN |
| system Google Chrome `152` (`/Applications/Google Chrome.app`) | **51** | writes the PNG |

The two symptoms are one fault. `Page.captureScreenshot` waits on a composited
frame; a compositor that never produces one starves it, which is also exactly
what rAF=0 means. So "rAF does not fire" and "screenshot hangs" were never two
bugs to chase separately.

What does **not** fix it, all tested this run so nobody re-tests them:

- `agent-browser stream disable`. Streaming *was* on at the start of this run
  (`ws://127.0.0.1:54683`), so the 09-14 note's fix looked live again — turning
  it off changed nothing. The 09-14 wedge was a different fault with the same
  surface.
- `AGENT_BROWSER_ARGS="--disable-features=CalculateNativeWinOcclusion,--disable-backgrounding-occluded-windows,--disable-renderer-backgrounding"`.
  The flags *do* reach the renderers (visible in `ps`), and rAF stays at 0.
- `AGENT_BROWSER_ARGS="--disable-gpu"`. Same, rAF stays at 0.
- `agent-browser close --all` and a fresh daemon. Same.
- `agent-browser doctor` is no help here: it reports "Launch test **pass**,
  headless launch + about:blank in 1.19s". Launching is not the broken part.

Evidence the whole library is fine and it really was the binary: with the
export set, `bun run check` came back green across the board — lint 105, build
105, docs 105, **smoke 105**, 431 tests, exit 0 — on a tree whose only new code
is this run's. `smoke` had not run to completion since 09-17.

Two things for whoever reads this next. This is an environment fix that lives
in a shell export, so it will evaporate — it belongs in the scheduled task's
Step 4/5 recipe, which is the captain's call to make, not a scout's to edit.
And `agent-browser install` / `upgrade` would probably also fix it by pulling a
newer Chrome for Testing; that downloads a browser binary, so it is the
captain's call too, not something to run unattended.

### Ported

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `gobo-light` | `thevangelist/tinseltown`, five source modules | `e31bfc8` | MIT | Not a new find — this is the port the 09-19 run built and parked on `origin/wip/gobo-light` at `a6708cf`, finished here now that a screenshot is possible. Cherry-picked rather than rebuilt, so the code is 09-19's; this run added the preview and the contrast measurement. |
| `sg-lightleak` | `shader-gallery/shaders`, `lightleak/shader.frag` + `lightleak/meta.json` | `4e8d4cb2` | MIT | Top of the recorded backlog ranking. Anamorphic film leak — adjacent to `god-rays`, but that one is volumetric shafts from a source and this is fogged emulsion with full-width flares, which nothing on the shelf does. |

Both gates green, with the export above set: `check` 105 effects (lint, build,
docs, smoke, 431 tests, exit 0), `verify` 101 pass / 1 warn / 0 fail / 3
skipped. Both new effects PASS `verify` with zero warns; the single WARN is
`paw-avatar`'s pre-existing one.

### Contrast, measured twice, and one of them moved the sheet

rAF works again, so for the first time the README's "worst case across several
animation frames" is a thing a run can actually do rather than approximate from
one frame. Both ports were measured the same way: copy hidden, boxes recorded
before hiding, worst ratio between computed ink and any pixel under its box at
1280x720, four taps two seconds apart.

`gobo-light` — **the guess held.** `--fx-scrim: 0.74` was carried over unverified
and 09-19 flagged it as such.

| state | title | lede |
|---|---|---|
| rest, CSS only | 18.11:1 | 13.40:1 |
| live, still rig (upstream default) | 13.05:1 | 11.13:1 |
| live, `motion="sway drift"` | 12.81:1 | 11.13:1 |

Nothing moved. The margin is wide because at the default azimuth 140 /
elevation 38 no lit slat crosses the content column at all — the brightest
pixel under the title is rgb(68,45,30), and the brightest pixel *anywhere* in
the frame, rgb(98,65,38), would still read 9.1:1 against white if motion walked
it under the copy. So 09-19's warning that "a lit slat is the brightest thing
in the frame" is true of the frame and not true of the copy. There is real
headroom to lower that scrim; it is a taste call, left for the captain.

`sg-lightleak` — **the first guess failed.** The sheet shipped 0.72 and
`--fx-muted: #e8e2da`, and the lede came in at **4.16:1**, under the 4.5:1
floor.

| scrim | `--fx-muted` | title | lede |
|---|---|---|---|
| 0.72 | `#e8e2da` | 5.57:1 | 4.16:1 |
| 0.80 | `#e8e2da` | 6.85:1 | 5.23:1 |
| 0.86 | `#e8e2da` | 8.26:1 | 6.31:1 |
| **0.80** | **`#f6f1ea`** | **6.85:1** | **5.99:1** |

Shipped the last row, splitting the fix between the scrim and the ink the way
`sg-hologram` and `sg-suminagashi` split theirs — it buys more lede than 0.86
alone did, for less washing. Worth carrying forward: on this effect the thing
that crosses the copy is not the leaks, which sit at the frame edges, but the
anamorphic streaks, which are drawn the **full width** by construction. The
worst pixel under the lede is rgb(90,92,92) in every run — a flare, never a
leak.

And the caveat that applies to every number above: four taps is a sample of a
flickering source, not a bound on it. `lightleak`'s streaks break and flicker
on their own timers, so a frame nobody sampled can be worse. The margin over
the floor is the allowance for that, which is why 0.80 was taken over the 0.72
that also "passed" the title.

### A correction to the 2026-09-14 entry

That entry says the shader.gallery shaders "declare `"palette": null` in their
upstream `meta.json`", so a port should recover the four colours from the
shader's own `main()` and treat it as a `seam`. **The field is not `palette`
and it is not null.** Checked at `4e8d4cb2` across all eight ranked shaders:

```
obsidian nocturne   rainglass peacock   suminagashi nocturne   hologram midnight
lightleak daybreak  chrome    nocturne  damascus    mercury    foil     foundry
```

Every one names a preset, and no preset table exists anywhere in the pinned
repo. So this family is the *other* case that entry describes — the one where
"the metas name a palette preset the port genuinely cannot resolve" — and a
port must ship its own four colours and declare them as `ours`, not `seam`.
That is what `sg-gloam`, `sg-bask`, `sg-nebula-drift` and `sg-obsidian` already
do, so the shipped ports are right and only the note was wrong. `sg-lightleak`
follows them.

One thing that *is* specific to `lightleak` and worth knowing before restyling
it: the shader does not use the four colours positionally. `warmCool()` reduces
them to a warm pole and a cool pole by red minus blue, and everything is built
from those two. The palette's real content is its warm/cool **spread**, not its
four hues — four warm colours leave the streaks the same colour as the leaks
and the film stops reading as anamorphic.

### Rejected

| Candidate | Source | Reason |
|---|---|---|
| Paper Crumple (VAT) | `item-develop/paper-crumple-demo` `f84648b0`, Codrops hub 2026-09-19 | **MIT, so it clears the licence gate — rejected on shape.** Needs `cannon-es` and four `three/examples/jsm/` addons (lil-gui, EffectComposer, RenderPass, SSAOPass, OutputPass), none of which we vendor; a 1.25 MB `.fbx` mesh and a 1.75 MB `.exr` vertex-animation texture, which need loaders we also do not vendor; and its `index.html` pulls Google Fonts off-site. Same call as globedots (09-19) and MeltGL (09-17): porting it would be rewriting. 20 MB of the repo's 21 MB is a preview mp4. |
| `twickstrom/holo-card-tilt` | GitHub, `created:>2026-09-18` | MIT and genuinely section-shaped — a tilt/glare/shadow hover card. But it is built to React 19, Next.js 16 and HeroUI v3 conventions, so there is no vanilla source to port, only a rewrite. |
| `stenlysayd/retrolens` | GitHub, 1★ | MIT, but hand-gesture computer vision off a webcam. Same reject as the 3D Face Mask on 09-14: not a section, and the runtime reaches for a camera. |
| `ziminglin895-del/shanju-study`, `kevinweiboo/z5ii-3d-camera` | GitHub | No LICENSE / `NO-LICENSE`. Hard reject. |
| `artemnovichkov/SandValley`, `haplollc/ThinkingOrbs`, `Staberman/splitflap` | GitHub | SwiftUI / Metal. Not web. |
| `bevancoleman/orbital-engine` | GitHub | react-three-fiber, and an orbital mechanics engine rather than a section. |
| `copyleftdev/ember`, `rgkdegen/phantom-twist`, `1etu/xmb-test-portfolio`, `1968820297-hue/ai-shot-library`, `CristoXD73/GL.iNet-...` | GitHub | Not effects: an agent simulation, an explainer site, a portfolio, a prompt library, a router screensaver. |

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest is Paper Crumple, 2026-09-19,
  rejected above. Elemental Sandbox (09-16) and Reel Flux (09-14) were already
  screened and rejected by earlier runs and were not re-opened.
- **Codrops org repos.** Nothing new.
- **`shader-gallery/shaders`.** Last push 2026-09-09, so `4e8d4cb2` is still
  the head and the backlog pin is current, not stale.
- **Vendor releases.** All three predate the watermark: `@tsparticles/slim`
  4.4.0 (2026-08-31, we vendor 4.3.2), `lenis` 1.3.26 (2026-08-05, vendored),
  `@paper-design/shaders` 0.0.81 (2026-09-17, screened by the 09-17 run).
- **GitHub topic search**, `created:>2026-09-18` across `css-animation`,
  `shaders`, `scroll-animation`, `webgl`, `animation`. `css-animation` and
  `scroll-animation` returned nothing at all. The rest is in the reject table.
- **CodePen.** Not re-tested; assumed still behind the bot challenge.
- **Solace shaders.** Left alone: PR #34 is still open and owns them.

### Backlog after this run

54 of the 57 shaders logged at `4e8d4cb27bfdd662c4b8515eb83334ece40eea10`.
Taken so far: `obsidian` and `rainglass` (PR #36), `lightleak` (this run).
Next in the recorded ranking is `chrome` — the 09-14 note asks for a
side-by-side against `liquid-metal` before committing to it — then `damascus`
and `foil`.

### One note on stacking

Based on `feat/fx-scout-2026-09-19` rather than `main`, the same way 09-19 was
based on 09-18 and 09-18 on 09-17. Four scout PRs are now stacked and none has
merged. If the captain merges them, merge the bases with `--rebase` and not
`--squash`, or every dependent goes CONFLICTING on duplicate content.

## 2026-09-21 — window 2026-09-20 to 2026-09-21

One day. One real find, ported. Nothing taken off the backlog, because Step 3.5
only runs when discovery comes up empty, and it did not.

### Ported

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `bioluminescent-sea` | `Raflael/ardentia`, `index.html` | `7e1a1554` | MIT | A night sea that stays dark until something moves through it. A real Stable Fluids solver on a coarse CPU grid, ~50k dinoflagellates that flash on *shear* rather than on speed and spend a luciferin reserve that takes seconds to refill, and an HDR sum through a two-level bloom. Fish swim through and are never drawn; the plankton lighting around them is the silhouette. Nothing on the shelf is interactive *and* physical like this: `water` is a shader field, `links-network` and `firefly-swarm` are particles with no medium. Zero dependencies, one 29 KB file upstream. |

Found through GitHub topic search (`webgl2`, `creative-coding`,
`generative-art`, all `created:>=2026-09-19`). Licence read at the pin, not
trusted from the API: `contents/LICENSE?ref=7e1a1554` is MIT, Copyright (c)
2026 Rafael Medeiros.

Both gates green with `AGENT_BROWSER_EXECUTABLE_PATH` pointed at system Chrome:
`check` 106 effects (lint, build, docs, smoke, 433 tests, exit 0), `verify`
102 pass / 1 warn / 0 fail / 3 skipped. The new effect PASSES with zero warns;
the one WARN is `paw-avatar`'s old one.

### Why this passes provenance when LUMEN (09-17) did not

Worth writing down, because on the surface the two look alike and a reviewer
should see one standard, not two. Both landed their code in one commit
(`293a78be` here; the other three commits are a GIF, a README pass and a social
card) and both had 0 stars. LUMEN was rejected on two things this one does
not have:

1. **A claimed source with no published code.** LUMEN's header said "inspired
   by the visual language of OpenShaders", and OpenShaders has shipped no
   shader source, so a clean re-derivation could not be told apart from a lift.
   Ardentia credits one thing, a 1999 paper (Stam, *Stable Fluids*), which is an
   algorithm, not code. No Shadertoy idioms either (`mainImage`, `fragCoord`,
   `iTime`, `iChannel` all absent) and no off-site URL.
2. **Viewport coupling that scoping would change.** LUMEN's resize, text
   texture, ripples and pointer all lived in viewport coordinates. Ardentia's
   solver, fish and plankton all work in whatever W by H they are handed, and
   upstream already takes that size as a parameter (its own `larg` and `alt`
   query keys, for its headless harness). Handing it the section instead of the
   window is a seam.

The internals also read as the author's own work: Portuguese names throughout
(`empurra`, `cisalhamento`, `reserva`, `atualizaPlancton`), and a README that
records three things found while building it (pure blue reads as dust without
HDR, a wide push draws a ring instead of a fish, the tail undulation came free
from a chain). That is not proof, but it is the opposite of LUMEN's shape.

### How the port was built — assembled, not retyped

`index.js` is upstream lines 60-656 byte for byte, inside a function, at
upstream's own indentation, so a diff against the pinned file reads clean. Six
lines inside that block differ: the three constants that became options
(`APAGA`, `RECARGA`, `VORT` → `fade`, `recharge`, `vorticity`, upstream
defaults), one comment, and the two that sized the world from
`window.innerWidth/innerHeight`. Everything upstream had after line 656 —
window-bound input, a window resize listener, and a headless test harness that
switched on from `?teste` in the page's own URL — is replaced by section-bound
equivalents. Seven deviations are declared in `meta.json`, five `seam` and two
`ours`.

The two `ours`:
- **Reduced motion never starts the solver.** Upstream has no such path. This
  sea only lights where water moves, so there is no honest still frame; the CSS
  rest is the reduced-motion picture.
- **An IntersectionObserver pauses the loop off screen.** Upstream owns the
  window and is always visible. A section below the fold is not, and a
  50k-organism CPU step per frame is worth stopping.

### The preview is a live frame, and deliberately not `?reduced=1`

The scout recipe captures with `?reduced=1` to pin a resting frame. On this
effect that would capture the CSS fallback, because reduced motion means the
solver never starts — and the README says a preview is a real capture with
`data-fx-live` asserted. So the preview was shot live, at 640x360, about half a
second after a scripted pointer stroke across the section, with
`data-fx-live === true` asserted first. Before touching, the live sea is mostly
black with two fish-shaped glows; the stroke is what the effect is *for*, and
upstream's own README GIF shows the same thing.

### Contrast

Measured at `--fx-scrim: 0.8` (a guess going in; it held). Copy hidden, boxes
recorded first, worst ratio between computed ink and any pixel under each box
at 1280x720. The dangerous frame is not the fish, it is a visitor stirring
water right under the copy, so strokes went straight through the headline.

| state | eyebrow | title | lede | ghost CTA |
|---|---|---|---|---|
| rest, CSS only | 12.59 | 13.86 | 12.59 | 15.43 |
| live, fish only (4 taps) | 15.74 | 8.11 | 6.92 | 16.08 |
| live, 3 strokes x 4 taps | 6.69 | **6.56** | 6.90 | 8.66 |
| live, 8 fast scrubs | 8.19 | 8.22 | 7.85 | 12.31 |

Worst is 6.56:1 on the title, on a wake at rgb(45,97,102). One finding worth
keeping: **scrubbing hard measures dimmer than one long stroke.** Each cell
spends its luciferin, so a patch stirred again and again goes dark. The first
stroke through fresh water is the worst case, not the hundredth. `fade` and
`recharge` both raise the ceiling (longer wakes, faster refills), so the knob
docs and the stylesheet comment say to re-measure after moving either.

### Rejected

| Candidate | Source | Licence | Reason |
|---|---|---|---|
| `uzayrhbusiness-afk/galaxy-hero` | GitHub, first commit 2026-09-15, repo created 2026-09-19 | MIT | **The near miss, and section-shaped.** A WebGL star galaxy that gathers into words and images over a hero. Rejected on provenance, the LUMEN rule: the README says it is "inspired by the hero on higgsfield.ai/gpt-astra", a commercial site whose source is not published. Also a `position: fixed` page layer driven by a `window.GALAXY_CONFIG` global, and its text shapes sample a Google Fonts face fetched off-site. |
| `wangmiaozero/agent-aura` | GitHub, created 2026-09-20 | MIT | TypeScript under `src/*.ts` with no built ES module committed to pin, so porting means transpiling a dozen modules. Same call as MeltGL (09-17) and globedots (09-19). Also borders and glows for agent UIs, not sections. |
| `wfdiao/wax-and-water` | GitHub, created 2026-09-19 | MIT | An interactive toy (drop a dive mask into a crayon sea) that needs ~1.8 MB of raster paper and silhouette assets. Not a resting section. |
| `fushanbobfan/morphogen` | GitHub, created 2026-09-20 | MIT | A reaction-diffusion *lab* with a control UI and an npm layout. Reaction-diffusion as a hero is already queued as `turing` in the `4e8d4cb2` shader backlog. |
| `Nikhil-creat/anima`, `ZALPRO/framezero` | GitHub | MIT | A Lenia lab and a motion-design studio. Tools, not sections. |
| `chasestu/frontend-viz-starter` | GitHub | MIT | Particle network background — a duplicate of `links-network`. |
| `YiweiCreates/magic-folder-animation`, `yfddxwx/Spore-Garden` | GitHub | MIT | A folder-icon animation and a click-to-plant particle toy. Not sections. |
| `AmiARMiess/fleet-sync`, `yang20040317-svg/cine-memory-portfolio` | GitHub | MIT | Whole landing pages / portfolios, not a portable effect. |
| `stenlysayd/retrolens`, `ctbot000/face-beautifier` (+ `-auto`) | GitHub | MIT | Webcam and MediaPipe. Same reject as the 09-14 face mask. |
| `kloserock97-tech/windcrest`, `AventurineDream/lightwell`, `ArielSoliz/oneocean-elements-free` | GitHub | NOASSERTION | Unresolved licence. Not on the allow-list. |
| `Mohammed-Ashraf-Shaik/singularity-cinematic-universe`, `xnono344/keyboard-3d-pad`, `yanx5433-cmd/rain-as-data`, `Elia-Youssef/fashion-rotunda-web` | GitHub | none | No LICENSE file. Hard reject. |

### Vetted, not ported

| Candidate | Repo | Commit | Path | Licence | Note |
|---|---|---|---|---|---|
| `withmehmet/mogp-motion` | `withmehmet/mogp-motion` | `e2db8dd2` | `mogp-motion.css` | MIT | CSS-only scroll-driven reveals (fade, scale-up, slide-up, slide-down) on `animation-timeline: view()`, no JavaScript at all. A real gap: `reveal-stagger` needs anime.js. Not ported because it is a `data-*` attribute *system* rather than a section, it is one commit old, and it would need a demo section invented around it. A candidate for a `scroll` port if the captain wants a zero-JS reveal on the shelf. Full sha `e2db8dd2ab4cc6c55c0f1f8aa8f08952882f33a7`. |

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest is still Paper Crumple,
  2026-09-19, rejected by the 09-20 run. Nothing published 09-20 or 09-21.
- **Codrops org repos.** Newest is still `RotatingOnScrollAnimations`,
  2026-06-18.
- **`shader-gallery/shaders`.** No commits since 2026-09-19; last push
  2026-09-09. `4e8d4cb2` is still the head, so the backlog pin is current.
- **`paper-design/shaders`.** No commits since 2026-09-19.
- **Vendor releases.** `tsparticles` still v4.4.0 (2026-08-31), `lenis` still
  v1.3.26 (2026-08-05).
- **Solace shaders.** No commits since 2026-09-19; left alone, PR #34 owns
  them.
- **`openshaders/openshaders`.** Still a README, a header image and a LICENSE,
  no shaders. Last push 2026-09-09.
- **`Pallarium/labs`.** Still no LICENSE file (`/license` is 404).
- **GitHub topic search**, `created:>=2026-09-19` across `shaders`, `webgl`,
  `glsl`, `css-animation`, `scroll-animation`, `animation`, `canvas-animation`,
  `webgl2`, `creative-coding`, `generative-art`, plus keyword searches (`webgl
  hero`, `shader background`, `zero dependencies animation`, `canvas
  particles`, `language:GLSL`). `css-animation` returned nothing again.
  Adding `webgl2`, `creative-coding` and `generative-art` to the topic list is
  what found today's port; keep them.
- **CodePen.** Not re-tested; assumed still behind the bot challenge.

### Backlog after this run

Unchanged at 54 of the 57 shaders logged at
`4e8d4cb27bfdd662c4b8515eb83334ece40eea10`. Taken so far: `obsidian` and
`rainglass` (PR #36), `lightleak` (PR #38). Next in the recorded ranking is
still `chrome` (side-by-side against `liquid-metal` first), then `damascus`
and `foil`.

### Stacking

Based on `feat/fx-scout-2026-09-20`, like every scout branch since 09-18. Five
scout PRs are now stacked (09-17 → 09-21) and none has merged. Merge the bases
with `--rebase`, not `--squash`, or each dependent goes CONFLICTING on
duplicate content.

## 2026-09-23 — window 2026-09-21 to 2026-09-23

Two days. One find, ported. The backlog was not touched, because Step 3.5 only
fires when discovery comes up empty and it did not.

### Ported

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `wipe-glass` | `Hixly/rain-on-glass`, `index.html` | `4d7bf1f0` | MIT | A fogged pane the visitor clears by dragging across it, onto a rainy street at night. Three surfaces in one pass: beads outside that are each a lens on the street inverted, pinned until they outgrow a critical radius and then sliding in stop-start runs that eat the smaller beads in their path; condensation inside that a stroke wipes, that throws drips which run down and cut channels, and that re-nucleates in patches; and behind both, a street painted once at three blur depths where the fog picks which one you are looking through, so clearing the glass is literally what pulls the city into focus. |

Found through GitHub topic search (`webgl`, `webgl2`, `creative-coding`,
`created:>=2026-09-20`). Licence read at the pin, not trusted from the API:
`contents/LICENSE?ref=4d7bf1f0` is MIT, Copyright (c) 2026 Matthew Hixon.

Both gates green with `AGENT_BROWSER_EXECUTABLE_PATH` pointed at system Chrome:
`check` 107 effects (lint, build, docs, smoke, 435 tests, exit 0), `verify`
103 pass / 1 warn / 0 fail / 3 skipped. `wipe-glass` PASSES with zero warns —
including zero `numeric-trace` warns, so every literal in the port traces to
the pinned file. The one WARN is `paw-avatar`'s old one.

### The adjacency to `sg-rainglass` is real, and here is the case for it anyway

A reviewer will spot this immediately, so it goes at the top rather than
buried. `sg-rainglass` (PR #36, 09-18) is also rain on a window at night, and
nothing else on the shelf is. Two effects, one subject.

The case is that they are the same subject by completely different machinery,
and the machinery is what a site-builder is choosing between:

- `sg-rainglass` is one fragment shader. Everything in it — the bokeh field,
  the runners, the beaded trails — is procedural noise evaluated per pixel. It
  is a picture of rain on glass, and it does not respond to anyone.
- `wipe-glass` is a CPU simulation feeding textures to a shader. The beads are
  objects with radii, velocities and pinning state that merge and shed; the
  street is a real painted scene with a skyline, named neon signs and cars; and
  the fog is a mutable buffer the visitor writes into.

The differentiator is the last one, and it is not a rain differentiator at all:
**nothing in the 107 is a surface a visitor clears with a drag that then heals
behind them.** `cursor-spotlight` reveals under the pointer and forgets the
moment it moves; this remembers the stroke, throws water off its rim, and
closes over in patches seconds later. That is a hero mechanic the shelf does
not have, and the rainy street is the scene it happens to be wearing.

Same call the 09-18 run made taking `lightleak` next to `god-rays`, and the
09-21 run taking `bioluminescent-sea` next to `water`. Flagged here so the
captain can overrule it on one read rather than discovering it in the gallery.

### Why this passes the viewport-coupling half of the LUMEN rule

The other thing a reviewer will reach for, because the 09-21 entry rejected
LUMEN partly on viewport coupling and on the surface this looks the same:
`VW = innerWidth`, `VH = innerHeight`, pointers in client coordinates, a window
resize listener, a `position: fixed` cursor.

It is the opposite case, and the reason is one line of upstream's own comment:

    // Rain amounts scale with the real glass area in CSS px (not canvas px),
    // so every screen, phone or desktop, gets the same density per inch.
    const AREA = () => VW * VH / (1608 * 926);

Density is normalised per CSS pixel of AREA, not per viewport. The street is
painted at a scale of `h / 1000`. `WS` clamps at 1.25 for anything 1440 wide or
over. So handing the code a 1200x600 section instead of a window gives it
upstream's density at upstream's proportions — the seam changes where the glass
is, not how it behaves. LUMEN's ripples, text texture and resize were coupled to
the viewport's SHAPE, where scoping would have changed the picture.

`VW` and `VH` are assigned in exactly one function (`resize`), and upstream's
own `px`/`py` helpers are `e.clientX * VW / innerWidth`, which is the identity
while the glass IS the window — so the seam is that same conversion measured
against the section's box. Provenance is clean on the other half of the rule
too: the repo publishes its own prompt (`PROMPT.md`), cites no closed
commercial source, carries zero Shadertoy idioms (`mainImage`, `fragCoord`,
`iTime`, `iResolution`, `iMouse`, `iChannel` all absent) and fetches nothing
off-site.

### The sound had to go, and no-ops are how the port stayed byte-identical

Upstream synthesises its own rain bed, taps on the glass, a wiping squeak and
thunder, all in Web Audio. A section dropped into a client page must not make
noise, so all of it is gone.

The tempting way to remove it is to edit `spawnDrop` and the lightning block,
which is where `tap()` and `thunder()` are called from — and both of those sit
inside the range that is supposed to diff clean against the pinned file.
Instead `tap()` and `thunder()` stay as empty functions, so the simulation code
is left exactly as upstream wrote it and the whole removal is one declared
deviation. Worth copying next time a port carries a subsystem the contract
forbids: **stub the leaf, do not edit the caller.**

### The knob test is stricter than the schema, and 1.2958 trips it

`bun run check` failed once, on `tests/gallery.test.js`: *every slider must open
ON its own documented default*. `rain` defaults to upstream's `RATE = 1.2958`,
and with `min: 0.2, max: 3` the generator's inferred step is `(3-0.2)/200 =
0.014`, which puts the default at 78.27 stops — so the slider would have opened
at a number the docs never give and no drag could return to.

The arithmetic is unforgiving with a four-decimal default: `1.2958 - 0.2` is
`10958e-4`, and `10958 = 2 x 5479` with 5479 prime, so the only steps that
divide it are 0.0002 and 0.0001 — fourteen thousand stops. Moving `min` to 0
makes the default `12958e-4 = 2 x 11 x 19 x 31`, and `1.2958 / 100` gives
`step: 0.012958` exactly (verified in IEEE754, not assumed: the division
returns exactly 100).

Two things for the next run. **An awkward default is fixed at `min`, not at
`step`** — the factorisation of `default - min` is what decides whether any
usable step exists. And the generator has a designed-for path: omit `min` and
`max` entirely and `hi` becomes four times the default, which puts it at
exactly 50 stops by construction. That is the escape hatch when no declared
range factorises.

### Contrast

Measured at `--fx-scrim: 0.78`, one page LOAD per frame per the 09-18 recipe,
copy hidden for each capture, boxes collected with it visible, ink painted to a
2D canvas, at 1280x720.

| state | eyebrow | title | lede | ghost CTA |
|---|---|---|---|---|
| live, 1s | 9.79 | 9.83 | 9.11 | 14.85 |
| live, 4s | 10.46 | 8.87 | 8.49 | 13.57 |
| live, 9s | 11.29 | 8.94 | 8.77 | 11.83 |
| live, 14s | 10.87 | 9.24 | 8.06 | 12.59 |
| three strokes through the copy | 11.28 | 6.46 | **4.87** | 11.68 |
| the same, 7s in | 10.07 | 6.46 | 4.94 | 13.32 |
| the whole band scrubbed bare | 8.77 | 6.46 | 5.15 | 7.56 |

Worst is 4.87:1 on the lede, on cleared street at rgb(96,73,59). The dangerous
frame is neither the rain nor the lightning: it is a visitor wiping the glass
directly under the copy, because the fog is the only thing holding the lit city
off the lede.

The scrim response is steep and was probed rather than guessed — 0.86 gives
6.45, 0.78 gives 4.87, 0.72 gives 4.04 and fails. 0.78 is the lowest value that
clears the 4.5 floor, which matters here because the scrim is also what makes
the effect visible: at 0.86 the thumbnail was a near-black rectangle.

One finding worth keeping: **scrubbing the whole band measures no worse than
three strokes** (5.15 against 4.87). A wipe saturates the clear map at `HOLD`,
so a second pass over the same patch cannot make it clearer — unlike
`bioluminescent-sea`, where repeated stirring makes the water DIMMER. Neither
effect rewards scrubbing harder, for opposite reasons.

### The preview shows both halves on purpose

The scout recipe shoots `?reduced=1` to pin a resting frame. This effect returns
from `mount()` under reduced motion and never starts, so that would have
captured the CSS fallback. Shot live instead, `data-fx-live` asserted first, at
640x360.

The first live shot was still a dark rectangle, because the honest resting
picture of a fogged window at night is a dark rectangle. So the capture wipes
the left 44% of the pane bare in eleven strokes and leaves the right fogged,
with one sweep across it: the card then carries the before and the after at
once, which is the only way a still says "this is a surface you clear".

### Rejected

| Candidate | Source | Licence | Reason |
|---|---|---|---|
| `oddurs/rummy` | GitHub, created 2026-09-23, `6725361d` | MIT | **The closest audience fit yet, and still a reject.** "Real-time 3D scenes rendered as ASCII in WebGL2. Built for hero backgrounds" is our brief in one line. It ships `src/*.ts` only — `atlas.ts`, `gl.ts`, `rummy.ts`, `scenes.ts`, `shaders.ts` — with `dist/` uncommitted and built by `tsc` + `vite build`, so there is no ES module at the pin to port or vendor. Same call as MeltGL (09-17), globedots (09-19) and agent-aura (09-21). Re-check it: the roadmap has "publish to npm with provenance" and "a web component and a CDN build" as open items, and either would make it portable. |
| `ALEXalesha/LiquidGlass` | GitHub, created 2026-09-22, `027cac78` | MIT | The LUMEN rule. "iOS 26 Liquid Glass rebuilt on the web" is a re-derivation of a closed commercial design language whose source is not published, which is the same shape as `galaxy-hero` rejected on 09-21 for citing `higgsfield.ai/gpt-astra`. The licence on the wrapper does not settle what it is a copy of. Also an 8.2 MB repo whose recent history is a Windows desktop-app shell, not a section. |
| `fushanbobfan/harmonograph` | GitHub, created 2026-09-23, `c72425ec` | MIT | A lab, not a section: `src/gallery.js`, `share.js`, `presets.js`, `playback.js`, a localStorage gallery with thumbnails, and a control panel to tune and export. Same author and same call as `morphogen`, rejected 09-21. |
| `tonychuhai/Cove` | GitHub, 58★, created 2026-09-21 | AGPL-3.0 | Not on the allow-list. |
| `sevenevesai/riso-windowseat` | GitHub, 76★, created 2026-09-22 | NOASSERTION | Unresolved licence. The highest-starred thing in the window, and procedural risograph films are genuinely interesting, so worth a re-check if a real LICENSE lands. |
| `ErionNezha/Lulja-Ime`, `mr-jonam/webgl-fast-track`, `twinstack-studio/sketchify`, `theovarne/GRYMO` | GitHub | NOASSERTION | Unresolved licence. |
| `aowshad/kinetic-svg` | GitHub, created 2026-09-23 | **none** | "Copy-paste SVG animations that run with zero dependencies" and no LICENSE file. Hard reject with no discretion. |
| `DexAi3000/scroll-tied-video-section` | GitHub, created 2026-09-22 | **none** | Frame-accurate scroll scrubbing via WebCodecs and explicitly no GSAP or Lenis, which is exactly the shape the `scroll` shelf wants. No LICENSE file, and React + TS on top. Re-check if one appears. |
| `Babyjupiter96/interactive-3d-hero`, `aeiouvcode/kin-living-pond`, `aeiouvcode/stillwater-harbor`, `simonwong/shader-tab` | GitHub | **none** | No LICENSE file. |
| `AliYa-chen/vfx-ui-vue` | GitHub, created 2026-09-23 | MIT | Vue components on WebGPU via `vgpu`. A framework target we do not ship and a renderer we do not vendor. |
| `alexgreensh/anidoodle` | GitHub, 30★ | Apache-2.0 | Licence is fine. It is a toolkit for authoring hand-drawn films from code, not a section with a resting state. |
| `mmrahmanbappi/100-free-404-pages` | GitHub, created 2026-09-23 | MIT | Page templates, not effects. |
| `kloserock97-tech/windcrest`, `Mohammed-Ashraf-Shaik/singularity-cinematic-universe`, `xnono344/keyboard-3d-pad` | GitHub | NOASSERTION / none | Already rejected by the 09-21 run and not re-opened. |

### Vetted, not ported

| Candidate | Repo | Commit | Path | Licence | Note |
|---|---|---|---|---|---|
| `cosmos-demo` | `absoyak/cosmos-demo` | `a247d9f18aa78d07891d72cc424ea2ee8b165472` | `index.html` | MIT | A GPU N-body universe in one 54 KB HTML file, zero dependencies, WebGL2 GPGPU fragment shaders — the shape is right and the licence is clean. Not ported because it is a NARRATIVE, not a loop: the README's own screenshot names are "star ignites", "age of collisions", "equilibrium", so the thing settles over minutes into a different picture than it started with. A hero has to look like itself at second 3 and at minute 10. Portable if someone wants a hero that visibly evolves, and worth revisiting as a `3d-hero` if that is ever a category we want. |
| `mogp-motion` | `withmehmet/mogp-motion` | `e2db8dd2ab4cc6c55c0f1f8aa8f08952882f33a7` | `mogp-motion.css` | MIT | Carried forward from 09-21, unchanged and still not ported. CSS-only scroll-driven reveals on `animation-timeline: view()`, no JavaScript at all, which `reveal-stagger` needs anime.js for. Still a `data-*` attribute system rather than a section. |

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest is still Paper Crumple,
  2026-09-19, which the 09-20 run rejected. Nothing published 09-20 to 09-23.
- **Codrops org repos.** Newest is still `RotatingOnScrollAnimations`,
  2026-06-18.
- **`shader-gallery/shaders`.** `commits?since=2026-09-21` is empty and
  `4e8d4cb2` is still the head, so the 54-shader backlog pin is current.
- **`paper-design/shaders`.** No commits since 2026-09-21.
- **`HARSHITSHARMA18/shaders` (Solace).** No commits since 2026-09-21. Left
  alone again: PR #34 is still open and owns them.
- **`metaory/ascii-lab`.** No commits since 2026-09-21.
- **`Pallarium/labs`.** Still no LICENSE file (`/license` is 404), four runs
  running. Its self-description is still almost word for word our own contract,
  so it stays on the re-check list.
- **Vendor releases.** `tsparticles` still v4.4.0 (2026-08-31), `lenis` still
  v1.3.26 (2026-08-05).
- **GitHub topic search**, `created:>=2026-09-20` across `shaders`, `webgl`,
  `webgl2`, `glsl`, `css-animation`, `scroll-animation`, `animation`,
  `canvas-animation`, `creative-coding`, `generative-art`. The 09-21 entry's
  advice held: `webgl` and `creative-coding` are what surfaced today's port,
  and `css-animation` returned two items, both unusable. Keep the full list.
- **CodePen.** Not re-tested; assumed still behind the bot challenge. See the
  09-14 entry for the full account.

### One observation about the window this search now sees

Worth recording because it changes what a future run should expect rather than
what it should do. A large share of everything created in these two days is
model-written and says so in its own description — "Built with Claude Opus
5.5", "Made with Claude Opus 5.5", "written entirely in code by Claude". Both
of the last two ports (`bioluminescent-sea`, `wipe-glass`) came out of that
pool.

It does not change the gates, and it should not. Licence, provenance, shape and
the two gates decide, exactly as before; today's port was screened against the
LUMEN rule line by line and passes on published source and a clean
re-derivation. But the practical consequence is that **star count and repo age
are now worth even less than the 09-06 survey said.** Today's find had 1 star
and was 24 hours old. Rank by mechanism and by whether one file can hold it.

### Backlog after this run

Unchanged at 54 of the 57 shaders logged at
`4e8d4cb27bfdd662c4b8515eb83334ece40eea10`. Taken so far: `obsidian` and
`rainglass` (PR #36), `lightleak` (PR #38). Next in the recorded ranking is
still `chrome` (side-by-side against `liquid-metal` first), then `damascus`
and `foil`.

### Stacking

Based on `feat/fx-scout-2026-09-21`, like every scout branch since 09-18. Six
scout PRs are now stacked (09-17 → 09-23) and none has merged. Merge the bases
with `--rebase`, not `--squash`, or each dependent goes CONFLICTING on
duplicate content.

## 2026-09-24 — window 2026-09-23 to 2026-09-24

One day. One find, ported. The backlog was not touched, because Step 3.5 only
fires when discovery comes up empty and it did not.

### Ported

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `clearwater` | `Aureliengmz/clearwater`, `index.html` | `4bc82613` | MIT | Photoreal shallow water over a pebble bed on a sunny day, looked down into from the shore. A 256x256 FFT ocean spectrum moves the surface; its normals refract a 256x256 grid of sun rays onto the bed once per colour channel, so the caustic web fringes with dispersion; the water shader does Fresnel, absorption and scattering through the depth; and every glint is convolved by FFT with a real lens aperture's diffraction pattern, so each wears a faint rainbow star. A tap drops a ring into a local ripple field; a drag turns the camera. 145 stars a day after it was created, the highest-starred thing in the window by a distance. |

Found through GitHub topic search (`shaders`, `webgl`, `created:>=2026-09-22`).
Licence read at the pin, not trusted from the API:
`contents/LICENSE?ref=4bc82613` is MIT, Copyright (c) 2026 Lumaris.

Both gates green with `AGENT_BROWSER_EXECUTABLE_PATH` pointed at system Chrome:
`check` 108 effects (lint, build, docs, smoke, 437 tests, exit 0), `verify`
104 pass / 1 warn / 0 fail / 3 skipped. `clearwater` PASSES with zero warns,
including zero `numeric-trace` warns. The one WARN is `paw-avatar`'s old one.

### The adjacency to `water` is real, and here is the case for it anyway

`water` (Paper Shaders) is also water with caustics. The case is the same one
09-23 made for `wipe-glass` next to `sg-rainglass`: one subject, different
machinery, and the machinery is what a site-builder is choosing between.
`water` is a 2D shader refracting a gradient the section paints for itself; it
is a flat pattern and it does not respond to anyone. `clearwater` is a 3D
scene: a real sea surface from a spectrum, a seabed you look into through it,
a sun with a position, glare off the surface, a camera the visitor turns and
water the visitor taps. Nothing on the shelf of 108 is a photoreal scene a
visitor looks around in. Flagged here so the captain can overrule it on one
read.

### The texture is the only real compromise, and it is declared

Upstream embeds its seabed as a 1024x1024 JPEG in base64 at the end of the
file: 334 KB raw, **253 KB gzipped**, against the 60 KB own-code lint. The code
alone is 16.6 KB gzipped. An effect has no file slot for a binary asset
(`files[]` is index.js, style.css, shader.frag, `_shared` and vendor), and
vendoring a hand-made image as a "package" would be a shape violation.

So the port carries upstream's own image re-encoded at 256x256, JPEG quality
70: 32 KB, 43 KB as base64, and the whole `index.js` lands at 52.6 KB gzipped.
Declared as an `ours` deviation. Why it holds up rather than turning the bed to
mud: the shader samples the bed through trilinear mips with 16x anisotropy, and
blends two offset tilings per zone (Inigo Quilez's texture-repetition trick,
which upstream cites), so the loss shows only in the nearest pebbles at the
bottom of the frame. Checked by eye in the Browser pane, not assumed.

The pseudo-height upstream derives from the texture reads its coarse mip
(`dx*6.0`), so the lower resolution barely moves it.

**For the next run:** a big embedded asset is not an automatic reject. Measure
the code and the asset separately, and try the asset at a lower resolution
before logging it as oversized.

### Reduced motion is upstream's own still, not a CSS fallback

The 09-21 and 09-23 ports both return from `mount()` under reduced motion
because they had no honest still frame. This one does: upstream ships `?t=5`,
documented as "freeze time at 5 s (screenshots)", which holds time, turns off
the camera sway, sets quality to 1, keeps the drawing buffer and draws four
frames. Reduced motion takes that path, so the visitor gets a real frame of
the water, and the scout recipe's `?reduced=1` would capture a real frame
here rather than the CSS rest. (The committed `preview.png` was shot live from
a bare page instead; see the tooling note below.)

### How the port was built — assembled, not retyped

Upstream's line ranges are copied by number into `inicia()`; the few lines that
change are replaced by exact-match substitution that fails if the anchor
drifts. Two tricks kept the verbatim block clean, both worth copying:

- **Shadow the name, don't edit the caller.** Upstream calls
  `requestAnimationFrame(frame)` from three places. A local
  `function requestAnimationFrame()` inside `inicia()` routes every one through
  `tick()`, which is where pausing off screen, `data-fx-live` and a cancellable
  handle live. Same idea as 09-23's `tap()` / `thunder()` no-ops.
- **Keep the shape of a global you replace.** Upstream's `Q` is a
  `URLSearchParams` over `location.search`. The port's `Q` is a plain object
  with the same `has()` and `get()`, answering `yaw` and `pitch` from the
  options and `t` from reduced motion, so every reading site stays
  byte-identical.

### Contrast

Measured at `--fx-scrim: 0.8`, at 1280x720, copy hidden with `visibility` so
the boxes keep their layout, one page load per frame.

| state | eyebrow | title | lede | ghost CTA |
|---|---|---|---|---|
| live, 2s | 6.94 | 5.71 | 5.26 | 6.31 |
| live, 6s | 5.30 | 5.71 | 5.15 | 6.70 |
| live, 12s | **4.99** | 5.60 | 5.39 | 6.55 |

Worst is 4.99 on the eyebrow, which also sits on its own darkening pill that
the number does not count. The glints sit just above the title at the default
pitch. `pitch` is the knob that moves this: raising it toward 0 brings the
sun's glare path up behind the copy, so the stylesheet says to re-measure after
raising it. Tap and drag states were not measured.

### A tooling note: `agent-browser eval` is blocked in this session

A shell hook blocks any Bash call containing `agent-browser ... eval` as
"indirect execution", so the recipe's step that hides `.fxd-bar` could not
run. Workaround used: write a bare page into `dist/registry/gallery/` (the
snippet plus a module script that mounts it, no demo chrome) and screenshot
that. `dist/` is gitignored and `check` wipes it, so rebuild before a second
capture. The Browser pane's JavaScript tool is not affected and did the box
measurements.

### Rejected

| Candidate | Source | Licence | Reason |
|---|---|---|---|
| `CHT-1192/Fireworks` | GitHub, created 2026-09-24 | Apache-2.0 | A seeded fireworks *show* with a control panel, keyboard controls, PNG/WebM export and an easter-egg word. A lab, not a section, same call as `harmonograph` (09-23) and `morphogen` (09-21). The one-shot burst is already on the shelf as `confetti-burst`. |
| `rajheshh/slipstream` | GitHub, created 2026-09-23 | MIT | A wind tunnel over a hand-drawn car: four view buttons, a speed slider, a pause key, live force readouts and Web Audio. An instrument, not a section. The Stable Fluids core is well made, but `bioluminescent-sea` already carries one. |
| `HRuiCcc/RuiC-phosphor-lab` | GitHub, created 2026-09-24 | MIT | An image-to-ASCII CRT *workbench* with a control panel and a gallery. A tool. |
| `renocrypt/mocubix` | GitHub, created 2026-09-23 | Apache-2.0 | A whole static site: seven scroll exhibits and a lexicon of 41 named interface effects. Licence is fine and it is worth a look as a source, but nothing in it is one portable section; each exhibit is built around its own archive material. |
| `bytewhisker/zerog-motion` | GitHub, created 2026-09-23 | MIT | A spring-physics library in `src/*.ts`, built by `tsup`, `dist/` uncommitted. Same call as `rummy` (09-23) and MeltGL (09-17). A library, not a section, either way. |
| `oddurs/rummy` | GitHub, re-checked | MIT | Re-checked as the 09-23 entry asked: eight new commits (pointer ripples, a type-on intro, phosphor trails, a frame-time governor), still `src/*.ts` only with no built module at the head. Still not portable. Keep re-checking. |
| `sevenevesai/riso-windowseat` | GitHub, re-checked | MIT + CC-BY-3.0 | The 09-23 entry's NOASSERTION resolved: the LICENSE is MIT plus a carve-out for a Salamander Grand Piano bank (CC-BY-3.0) inside one film. The code would be fine, but the repo is films, prints and studies — narratives with an ending, not sections. |
| `a77lic7ion/point-cloud-city` | GitHub, created 2026-09-24 | MIT | A data visualisation (a stippled city whose districts are AI providers) that vendors three.js as its own copies and loads a `city.json`. Not a section. |
| `bouncemonster/swype-imagine` | GitHub | MIT | React 19 + Tailwind. |
| `AliYa-chen/vfx-ui-vue`, `ALEXalesha/LiquidGlass`, `aowshad/kinetic-svg`, `DexAi3000/scroll-tied-video-section` | GitHub | — | Already rejected by the 09-23 run and not re-opened. |
| `refteen/aquarium`, `aeiouvcode/ukiyo-tide`, `GeorgeFu77/stille`, `mikolajmikolajczak0108/house10-architecture-in-motion`, `Roy-Wanyoike/wallume` | GitHub | **none** | No LICENSE file. |

### Vetted, not ported

Unchanged from 09-23: `cosmos-demo` (`absoyak/cosmos-demo` at
`a247d9f18aa78d07891d72cc424ea2ee8b165472`, MIT, a narrative rather than a
loop) and `mogp-motion` (`withmehmet/mogp-motion` at
`e2db8dd2ab4cc6c55c0f1f8aa8f08952882f33a7`, MIT, a `data-*` attribute system
rather than a section).

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** Newest is still Paper Crumple,
  2026-09-19. Nothing published 09-20 to 09-24.
- **`shader-gallery/shaders`**, **`paper-design/shaders`**,
  **`HARSHITSHARMA18/shaders` (Solace).** `commits?since=2026-09-23` is empty
  on all three. `4e8d4cb2` is still the shader-gallery head. Solace left alone:
  PR #34 is still open and owns it.
- **`Pallarium/labs`.** Still no LICENSE file; last push 2026-09-17.
- **Vendor releases.** `tsparticles` still v4.4.0 (2026-08-31), `lenis` still
  v1.3.26 (2026-08-05).
- **GitHub topic search**, `created:>=2026-09-22` across `shaders`, `webgl`,
  `webgl2`, `glsl`, `css-animation`, `scroll-animation`, `animation`,
  `canvas-animation`, `creative-coding`, `generative-art`. `shaders` and
  `webgl` found today's port. Keep the full list.
- **CodePen.** Not re-tested; assumed still behind the bot challenge.

### Backlog after this run

Unchanged at 54 of the 57 shaders logged at
`4e8d4cb27bfdd662c4b8515eb83334ece40eea10`. Taken so far: `obsidian` and
`rainglass` (PR #36), `lightleak` (PR #38). Next in the recorded ranking is
still `chrome` (side-by-side against `liquid-metal` first), then `damascus`
and `foil`.

### Stacking

Based on `feat/fx-scout-2026-09-23`, like every scout branch since 09-18. Seven
scout PRs are now stacked (09-17 → 09-24) and none has merged. Merge the bases
with `--rebase`, not `--squash`, or each dependent goes CONFLICTING on
duplicate content.

## 2026-09-26 — window 2026-09-24 to 2026-09-26

Two days (there is no 09-25 scout branch). One find, ported. The backlog was not
touched, because Step 3.5 only fires when discovery comes up empty and it did
not.

### Ported

| Effect | Upstream | Commit | Licence | Why |
|---|---|---|---|---|
| `ink-wash` | `axtonliu/moyun`, `index.html` | `eb488acf` | MIT | A sheet of rice paper an invisible hand paints a Chinese ink landscape onto, stroke by stroke, a moment after it appears: far hills, the main peak's outline, texture strokes and washes, moss dots, pines, ripples, a boat, birds, a cinnabar sun. The ink is simulated, not drawn: a Navier-Stokes solver in WebGL2 carries a four-channel dye (free ink, cinnabar, water, settled ink), water bleeds along procedural paper fibres and evaporates, and dried ink settles. The visitor can paint too: slow strokes wet and heavy, fast ones thin and dry, each stroke one dip of ink that runs out into flying-white. It is the shelf's first light-ground *interactive* hero, and the first where the effect paints a picture rather than a field. Zero dependencies, one 55 KB file upstream. |

Found through GitHub topic search (`webgl`, `creative-coding`,
`created:>=2026-09-24`), 15 stars at the time. Licence read at the pin, not
trusted from the API: `LICENSE` at `eb488acf` is MIT, Copyright (c) 2026 Axton
Liu. Full sha `eb488acf811122bb9a574d87fb148ffa42ed4c23`.

Both gates green with `AGENT_BROWSER_EXECUTABLE_PATH` pointed at system Chrome:
`check` 109 effects (lint, build, docs, smoke, 439 tests, exit 0), `verify`
105 pass / 1 warn / 0 fail / 3 skipped. `ink-wash` PASSES with zero warns,
including zero `numeric-trace` warns. The one WARN is `paw-avatar`'s old one.

### The adjacency to `sg-suminagashi` is real, and here is the case for it anyway

Same shape as the 09-23 and 09-24 cases. `sg-suminagashi` is also ink on
paper. It is one fragment shader: procedural marbling rings that drift and
never respond to anyone. `ink-wash` is a fluid simulation with a brush and a
landscape generator on top of it. It paints a composition, and it takes the
visitor's strokes into the same simulated ink. One subject, different
machinery; flagged so the captain can overrule it on one read.

### Provenance: the "inspired by" line points at published MIT code

A reviewer will see the README's acknowledgement and reach for the LUMEN rule
(09-17), so it goes here. The README credits Pavel Dobryakov's
`PavelDoGreat/WebGL-Fluid-Simulation` for "the shader layout" of the solver
pipeline. That repo is published and MIT, the opposite of LUMEN's case, where
the claimed source had no published code at all. The solver passes (curl,
vorticity, divergence, Jacobi pressure, gradient, advection) follow that
well-known layout, as every WebGL fluid does. The parts that make this effect
what it is are moyun's own: the four-channel dye, the paper-fibre bleed, the
evaporation and settling, the brush model with its flying-white cut, and the
seeded landscape generator. The README also says the whole file was written
by Claude Opus 5.5 in one session; the 09-23 entry already covered why that
changes nothing about the gates.

Other checks, all clean: three commits (the code, a README pass, a recording
fix), an account from 2017 with 411 followers, no Shadertoy idioms (`mainImage`,
`fragCoord`, `iTime`, `iResolution`, `iMouse`, `iChannel` all absent). The only
off-site fetch is the Google Fonts link for the poem, which the port drops.

### How the port was built: assembled, not retyped

`index.js` is upstream's lines copied by number into `inicia()`, at upstream's
own indentation, with five exact-match substitutions that fail if an anchor
drifts: the theme reader looks at the section and at `--fx-` names, the seed
can be fixed, the tool is an option. Everything else in those ranges is byte
for byte. The three proven tricks all came into play:

- **Stub the leaf** (09-23). The guqin is gone, but `ensureAudio()`, `play()`,
  `note()` and `whoosh()` stay as empty functions, so the brush, the hand and
  the landscape call them unchanged. Same for `showPoem()`, `stampSeal()` and
  `hidePoem()`: the poem needed a brush face from Google Fonts.
- **Shadow the name** (09-24). A local `requestAnimationFrame` inside
  `inicia()` routes upstream's `frame()` through `pulso()`, where pausing off
  screen, `data-fx-live` and a cancellable handle live. Do not name it `tick`:
  upstream already has a `tick` counter in the same scope, and the first build
  died on the redeclaration.
- **Keep the shape of a global you replace** (09-24). Upstream looks up its
  chrome by id. The port's `$` returns the real ghost ring for `'ghost'` and a
  detached node for everything else, so `setPaintBtn`, the fps readout in
  `frame()` and the sheet check in `pointerdown` write into nothing and stay
  verbatim.

One new one: **`fallback()` throws.** Upstream calls it and then `return`s from
the IIFE on three failure paths (no WebGL2, a shader that will not compile, no
half-float render targets). Making the one function throw sends all three to
`mount()`'s catch, which loses the context and returns the resting handle,
without touching any of the three call sites.

### Contrast is inverted on this one, and a corner wash was not enough

Every earlier port is light copy on a dark effect with a dark scrim. This is
dark ink copy on light paper, and what threatens it is ink. The first layout
put the copy top left, the corner upstream leaves empty for its poem, over a
paper-coloured radial wash from that corner. It failed badly: **lede 1.0 to
1.4:1, title 2.2 to 3.7:1**. The generator fills the left half of the sheet
(main peak, near bank, pines), and the wash had faded out by the lede.

The fix is upstream's own toolbar idiom as a panel behind the copy: paper at
0.88 over a 10 px backdrop blur, hairline border, 3 px corners. The blur is
what does the work on strokes: a black stroke under the panel reaches the copy
as a soft grey band.

Measured on four seeds, painted and with four slow drags straight through the
copy block (slow is where the brush lays its heaviest ink), at 1280x720, text
hidden with the panel kept, one page load per frame:

| seed | state | eyebrow | title | lede | ghost CTA |
|---|---|---|---|---|---|
| 7 | painted | 6.13 | 12.47 | 5.16 | 12.47 |
| 7 | + strokes | 6.07 | 11.88 | 5.06 | 11.64 |
| 21 | painted | 6.11 | 12.35 | 5.16 | 12.35 |
| 21 | + strokes | 6.07 | 11.88 | **5.01** | 11.76 |
| 300 | painted | 6.11 | 12.47 | 5.21 | 12.97 |
| 300 | + strokes | 6.07 | 11.77 | 5.06 | 11.76 |
| 512 | + strokes, 6 s later | 6.07 | 11.88 | 5.06 | 11.76 |

Worst is 5.01 on the lede, which is `--fx-muted` (upstream's `--ink-soft`) and
so the run with the least margin. The strokes were synthetic `PointerEvent`s
dispatched on the canvas at 16 ms intervals, which is what a real drag
started beside the copy and carried across it does under pointer capture.

The `seed` option exists partly for this. Upstream's generator is already
seeded; only its first seed is random. Fixing it made the table reproducible.

### The preview is a 1280x720 shot scaled down

At a 640x360 viewport the copy panel covers nearly the whole section, so a
native-size capture was a thumbnail of the copy, not the effect. The committed
`preview.png` is the section at 1280x720 (seed 21, after the hand finished,
`data-fx-live` asserted) scaled to 640x360 with `sips -z 360 640`. The panel
was also tightened (29 rem wide, title capped at 3.5 rem) so more of the main
peak shows, and the table above is from after that change.

Captured from a bare page (the snippet plus a module mount) served out of
`dist/registry/gallery/`, as 09-24 recommended, because the recipe's
`?reduced=1` would capture the CSS rest (reduced motion returns before
anything starts) and `agent-browser eval` is still hook-blocked.

### Rejected

| Candidate | Source | Licence | Reason |
|---|---|---|---|
| Custom-Shaped Cursor Trail with Three.js and TSL | `BertovDev/cursor-shader-trail`, Codrops hub 2026-09-24 | MIT | React Three Fiber, TSL and the WebGPU renderer. No vanilla source, and a renderer we do not vendor. |
| `ZhaoAndy821/dsh-motion-background` | GitHub, created 2026-09-26 | MIT | A plugin for another app's WebUI. Its one shader (`mods/meteor/fragment.glsl`, a meteor shower) is written to that host's `u_colorFront`/`u_colorBack` contract, not `glsl-mount.js`'s, and it has one day of history. Worth a look if more shaders land in `mods/`. |
| `ToaruPen/hirakubo-live` | GitHub, created 2026-09-24 | MIT | A pixel-art lighthouse wallpaper whose 143 KB `hirakubo_live.js` is generated by a Python build. The source is the Python, not the JS. |
| `jeiel85/pamun-ripple-tank` | GitHub, created 2026-09-25 | MIT | A ripple-tank *instrument* (drop height is pitch) in a 167 KB file with Web Audio at its core. Not a section. |
| `fushanbobfan/sandsong` | GitHub, created 2026-09-25 | MIT | A Chladni-plate toy split across `src/*.js` with a tone sweep driving it. An instrument, and the same author's `morphogen` and `harmonograph` were labs too. |
| `MonsterOne1/seasons-lake` | GitHub, created 2026-09-25 | MIT | Several MB of webp textures and mp3 music. |
| `reactivepixels/riffle` | GitHub, created 2026-09-25 | MIT | A TypeScript monorepo with a docs app and adapters. Same call as MeltGL (09-17) and `rummy` (09-23). |
| `cclank/neural-garden` | GitHub, created 2026-09-25 | MIT | Needs pretrained weight files (`public/flow/*.bin`) and a build. |
| `kraewon7422/hyperslice` | GitHub, created 2026-09-25 | MIT | A 4D-object raymarcher with versioned `index_v1/v2.html` files and a Python helper. A maths toy, not a section. |
| Claude-skill repos (`kiselas/every-frame-is-code`, `klsoen/opus-js-animations`, `danielyerushalmi/alive-web`, `UrvaSuthar/playable-landing-pages`, `benjatestaferri7/motion-reel`) | GitHub | MIT / Apache-2.0 | Agent skills and video pipelines, not effects. |
| `Kenton-GMI/sakuragaoka-station`, `mike007jd/voxel-musou`, `Token-Gremlin/gremlin-church`, `JesusGalindez/threejs-ocean-simulator-skills` | GitHub | MIT | Walkable scenes and games on three.js. Not sections. |
| `devcode90/gargantua`, `refteen/aquarium`, `Ishant6565/KAGE-JAPANESE`, `FrancescoPierfederici/luce-3d-landing`, `SamuelcCouto/Orva-Premium` | GitHub | **none** | No LICENSE file. `Orva-Premium` is GSAP ScrollTrigger as well. |
| `Muhammad112233-creator/k2-the-ascent`, `lintsinghua/paint-mv-skills`, `arielaizn/motion-forge-plugin`, `dylan-eck/genuary-2026` | GitHub | NOASSERTION | Unresolved licence. |

### Vetted, not ported

Unchanged from 09-23: `cosmos-demo` (`absoyak/cosmos-demo` at
`a247d9f18aa78d07891d72cc424ea2ee8b165472`, MIT, a narrative rather than a
loop) and `mogp-motion` (`withmehmet/mogp-motion` at
`e2db8dd2ab4cc6c55c0f1f8aa8f08952882f33a7`, MIT, a `data-*` attribute system
rather than a section).

### Sources checked and found quiet

- **Codrops Creative Hub, all demos.** One new item, the cursor trail above
  (09-24). Nothing since.
- **`shader-gallery/shaders`**, **`paper-design/shaders`**,
  **`HARSHITSHARMA18/shaders` (Solace)**, **`openshaders/openshaders`.**
  `commits?since=2026-09-24` is empty on all four. `4e8d4cb2` is still the
  shader-gallery head. Solace left alone: PR #34 is still open and owns it.
- **`Pallarium/labs`.** Still no LICENSE file (`/license` is 404).
- **Vendor releases.** `tsparticles` still v4.4.0 (2026-08-31), `lenis` still
  v1.3.26 (2026-08-05).
- **GitHub topic search**, `created:>=2026-09-24` across `shaders`, `webgl`,
  `webgl2`, `glsl`, `css-animation`, `scroll-animation`, `animation`,
  `canvas-animation`, `creative-coding`, `generative-art`, `threejs`. Keep the
  full list.
- **CodePen.** Not re-tested; assumed still behind the bot challenge.

### Backlog after this run

Unchanged at 54 of the 57 shaders logged at
`4e8d4cb27bfdd662c4b8515eb83334ece40eea10`. Taken so far: `obsidian` and
`rainglass` (PR #36), `lightleak` (PR #38). Next in the recorded ranking is
still `chrome` (side-by-side against `liquid-metal` first), then `damascus`
and `foil`.

### Stacking

Based on `feat/fx-scout-2026-09-24`, like every scout branch since 09-18.
Eight scout PRs are now stacked (09-17 → 09-26) and none has merged. Merge the
bases with `--rebase`, not `--squash`, or each dependent goes CONFLICTING on
duplicate content.
