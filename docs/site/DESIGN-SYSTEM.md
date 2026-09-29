# dex.place website: design system

This is how the website under the world looks and moves, and where each piece lives in the
code. The site is a white page with one loud yellow, chunky rounded blocks with hard black
shadows that press like keys, and pixel stickers drawn in code drifting in the margins. It
is cute and colourful but ordered: one big coloured block per screen, text in a calm column.

Sources: measurements and references in `VISUAL-RESEARCH.md`, architecture in
`TECH-PLAN.md`, content rules in `CANON.md`. When Dex says something newer, that wins.

Section numbers are cited from code comments (`§4`, `§5`, `§6`); keep them stable.

## 1. What the look is made of

The base comes from the "candy-blocks" direction, which the judges ranked first. It supplies
the rounded chunky shapes, sticker icons, spring easing, the tilted yellow slab carrying the
mark, and the white sheet rising over the world. Pieces grafted from the other two directions:

| From | What | Where |
|---|---|---|
| industrial-pop | Endfield palette discipline: white field, faint grid, yellow as the lead block colour, mint and magenta as small accents, tiny spaced labels | `tokens.css`, `base.css` |
| industrial-pop | Sliding yellow nav indicator, separate black World button | `shell.css`, `motion/nav.ts` |
| industrial-pop | Downloads spec chips (version, size, platform) and the SHA-256 panel with copy | `render/downloads.ts` |
| industrial-pop | Gallery collage with one leading piece; the cursor grows one and shrinks its neighbours | `render/gallery.ts`, `collage.ts`, `gallery.css` |
| industrial-pop | Donate QR panel: corner brackets, amount tag, copy buttons | `render/donate.ts`, `styles/donate.css` |
| industrial-pop | One full-width yellow word band as a breather, used once | landing only |
| night-glyph | Pixel mascots (blob, sleepy Z, sparkles) as floating stickers | `pixels.ts`, `render/floats.ts` |
| night-glyph | Thin three-colour strip on cards and headers | `glyphs.ts` `strip` |

Dropped on purpose: candy's ghost words behind titles (noise), candy's five-tile hub (it
repeated the nav), and industrial's yellow slab on every section (monotonous). The landing
uses the slab once; inner pages use a tone panel header (`pageHead`) instead.

Rules that keep it from tipping into chaos:

- About one big saturated block per viewport. Everything else is white, ink or a pale tint.
- Decoration never sits in the reading column. Floats live in the gutters (§6).
- No taglines, no filler labels, no invented numbers. Counters show real counts only
  ("03 items", "09 pieces").
- Dex's art appears only in the gallery. Placeholder imagery is drawn in code and tagged
  "Placeholder art".

## 2. Tokens

All in `src/site/styles/tokens.css`. Use the variables; don't hard-code values in
components.

### Colour

The page is white with ink text. The neon colours are **fills only**: ink text on them
passes WCAG AA, but they fail as text on white. When an accent has to be text, use the
`-text` variant. Contrast ratios below are against the colour each one is meant to sit with.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--paper` | #FFFFFF | page | |
| `--ink` | #191919 | text, outlines, shadows | 17.6 on white |
| `--muted` | #6E6E6E | lightest allowed text on white | 5.10 |
| `--grid-line` / `--line` | #F0F0F0 / #D9D9D9 | background grid, rules | decorative |
| `--night` | #0A0B0F | world stage, footer | |
| `--yellow` | #FFFA00 | lead block colour | ink on it 15.85 |
| `--mint` | #00FFA2 | downloads accent | ink on it 13.25 |
| `--magenta` | #FF1AAC | donate accent | ink on it 5.02 |
| `--cyan` | #32FEE3 | rare fourth accent (blog) | ink on it 13.75 |
| `--magenta-text` / `--mint-text` | #C8007F / #007A4D | accent as text on white | 5.58 / 5.40 |
| `--periwinkle` | #3B5BD0 | links in prose | 5.84 |
| `--yellow-t` `--magenta-t` `--mint-t` `--cyan-t` | pale tints | far background shapes | decorative |

Section tones (`Tone` in `data/projects.ts`): downloads mint, gallery paper (neutral, so the
art leads), docs yellow, blog cyan, donate magenta. They are easy to change in
`data/nav.ts`.

### Type

Every font is self-hosted. The OFL fonts come from `@fontsource`; they are bundled by Vite,
and each file's licence sits in `public/fonts/OFL-*.txt`. There are no runtime network
requests.

| Role | Font | Where |
|---|---|---|
| The mark "dex" only | Daniel (`public/fonts/Daniel-Regular.otf`, licence beside it) | nav mark, landing slab |
| Titles | Anybody Variable, width 140%, weight 820 | section and page titles |
| Body | Space Grotesk Variable, 17px, line height 1.6, measure 66ch | everything readable |
| Pixel labels | Silkscreen | kickers, chips, counters (short labels only) |
| Code, hashes | system monospace | SHA-256, account number |

Silkscreen has no Vietnamese glyphs, so it never carries long text, names or bank details
(CANON: pixel fonts for headings only). Sizes: `--fs-h1` 44-96px, `--fs-h2` 36-64px and
`--fs-h3` 22-30px, each fluid with `clamp()`. The latin files of Anybody and Space Grotesk are
preloaded on every page.

### Space and layout

4px base: `--s-1` 4px to `--s-10` 128px. `--wrap` 1200px column, `--pad` 18-48px side
padding, `--section` 64-128px between sections. `--gut` is the empty width beside the
column, where floats live.

### Shape

Chunky rounded blocks with ink outlines and hard offset shadows (no blur, ever).

- Radii: `--r-xs` 6, `--r-s` 10, `--r` 16, `--r-l` 24, `--r-xl` 32, `--r-pill`.
- Borders: `--bw` 2px, `--bw-l` 3px, always `--ink`.
- Shadows: `--sh-s` 3px, `--sh` 5px, `--sh-l` 8px, `--sh-lift` 7px (hover),
  `--sh-press` 1px (pressed), all `x x 0 var(--ink)`.

## 3. Motion

Most motion uses one house curve. Pops use a real spring that overshoots and settles. There
is no bounce on anything the reader is trying to read.

| Token | Value | Use |
|---|---|---|
| `--ease-out` | cubic-bezier(.25,1,.5,1) | default: reveals, hovers |
| `--ease-spring` | `linear()` spring, 760ms; falls back to `--ease-pop` (.34,1.56,.64,1), 520ms | pops, stickers, blocks |
| `--ease-wipe` | cubic-bezier(1,0,.7,1) | yellow slab wipe (Endfield loader curve) |
| `--ease-move` | cubic-bezier(.65,0,.35,1) | page transitions, nav indicator |
| `--ease-in-back` | cubic-bezier(.36,0,.66,-.56) | old page leaving |
| `--ease-float` | cubic-bezier(.37,0,.63,1) | background drift |

Durations: press 80ms, hover 200ms, pop 420ms, strip 500ms, wipe 600ms, reveal 700ms. The
stagger between siblings is 70ms, for at most 6 items (`--i` 0-5).

Primitives (all in `src/site/motion/` + `styles/motion.css`):

- **Reveal on scroll** (`reveal.ts`): add `data-reveal` (or `="pop"`, `"pop-block"`,
  `"slab"`, `"wipe"`, `"strip"`, `"flicker"`) and optionally `style="--i:N"`. Content is
  visible in the HTML. Only `html.js` hides it before its reveal, and only when motion is
  welcome, so no-JS and reduced-motion readers see everything at once.
- **Button pop** (`.btn`, `components.css`): on hover the button lifts 2px up-left and its
  shadow grows. On press it drops into its shadow in 80ms, like a key, and its pixel icon
  nudges one step.
- **Magnet** (`magnet.ts`, `data-magnet`): primary buttons lean a few px toward the cursor.
  This only runs with a fine pointer, never on touch and never under reduced motion.
- **Scene tilt** (`data-tilt-scene`, `render/art.ts`): the code-drawn placeholder scenes are
  16:10 size containers (pieces sized in `cqi`). Each `.sc-it` piece has a depth `--d` 1-4:
  it shifts with the cursor by depth, pops in on reveal far-first, and near pieces grow a
  little while the row is hovered. Idle loops (caret, orb bob, progress fill) step in whole
  pixels and stop under reduced motion. Scene classes are `sc-` prefixed; the shell already
  owns `.sheet`.
- **Nav indicator** (`nav.ts`): a yellow block slides behind the hovered or focused link and
  returns to the current page's link. Without JS the current link has a static highlight.
- **Headroom** (`nav.ts`): the sticky header tucks away on scroll down and returns on
  scroll up.
- **Page transitions** (`shell.css`): a cross-document `@view-transition`. The old page
  leaves in 240ms and the new one arrives in 460ms. The header morphs in place, and a gallery
  thumbnail flies into its full view (`view-transition-name: art-<id>`). Where browsers
  don't support it, links are ordinary page loads.

**Reduced motion:** every animation and transition is cut to 0.01ms. There is no drift, no
parallax, no magnet, no world scaling and no view-transition animation. State changes stay
visible.

## 4. The shell

`src/site/render/layout.ts` builds every page's head and body. `styles/shell.css` styles it.

- **Header:** the Daniel "dex" mark in a white key block on the left (it links home), then
  a pill nav: Downloads, Gallery, Docs, Blog, Donate, each with a pixel icon. After it comes a
  black **World** button, which links to `/#world`. Below 940px the nav becomes a Menu button
  that opens a full-screen menu (a native `popover`, so it opens and Esc closes it without
  JS). `initMenu` in `motion/nav.ts` makes it a modal sheet: focus moves to its Close key
  (also `autofocus`), everything behind it is `inert`, Tab and Shift+Tab wrap inside it, and
  closing returns focus to the Menu button. The nav order follows Dex's brief; CANON's
  wayfinding priority (downloads, donate, illustrations, documentation) is still open, so to
  change it, reorder `data/nav.ts`.
- **Footer:** dark. It repeats the nav, the Ko-fi link and the World link, and credits the fonts
  with links to their licences. There is no tagline and nothing under the mark.
- **Skip links:** "Skip to site" is the first focusable element on `/` (inside the world);
  every other page has "Skip to content".

### World mount and the scroll handoff (root page only)

The root page starts with `<section id="world" data-world-mount>`, one viewport tall, then
the site sheet (`#site`). The world itself is built by another workflow. The mount works like
this:

- Until a world module exists, the stage shows a still frame drawn in CSS: night, faint
  stars, a distant ring arc and a floor line. It uses no art.
- Black cinematic bars sit at the top and bottom of the world. As the reader scrolls,
  `motion/world.ts` sets `--world-progress` (0 to 1) on `<html>`. The bars shrink to
  nothing, the world dims and scales down slightly, and the white site sheet, with rounded
  top corners, slides up over it. At progress 1 the world is marked `data-covered`: it is
  paused and hidden from paint.
- **Contract for the world workflow:** create `src/world/mount.ts` exporting
  `mount(el: HTMLElement): { pause(): void; resume(): void; destroy(): void }`. It is found
  with `import.meta.glob`, code-split, and loaded only on `/`. When the sheet covers the world
  the site calls `pause()`, and `resume()` when it uncovers. The module must honour
  `prefers-reduced-motion` itself (no autoplay). If it is missing or throws, the website still
  works.
- The "Site" cue at the bottom of the world is a plain anchor to `#site`.

## 5. Coloured glyphs and pixel icons

### Pixel icons (`src/site/pixels.ts`)

Every icon is a text grid in code, one character per pixel. That fits CANON's rule that
assets are drawn, never generated.

```text
.  empty        k  ink outline      w  white highlight
a  accent (--px-a, default yellow)   b  second accent (--px-b, default magenta)
y  yellow   p  magenta   m  mint   c  cyan   g  light grey
```

`pixelSvg(name, { scale })` turns each colour into one SVG path, with one rectangle per
horizontal run of pixels. It renders at build time into the HTML with a fixed width and
height, so there is no layout shift, and edges stay crisp at whole-number scales. An icon can
have several frames; CSS steps through them (`steps()`), so sprites blink or bob in whole
pixels.

The current set: download, arrow, arrow-left, arrow-down, arrow-se, up, close, menu,
window, book, page, frame, heart, coin, bank, qr, copy, check, external, sparkle, star, plus,
cross, cursor, grid, rss, info, warn, blob (mascot, animated), sleepy (Z sprite, animated).

To add one: add a grid to `ICONS`. `validateIcon` (run by `src/site/pixels.test.mjs`) checks
that rows are equal width, frames are equal size and characters are known.

### Glyph components (`src/site/render/glyphs.ts`, `styles/components.css`)

| Function | What it draws |
|---|---|
| `icon(name, scale)` | a bare pixel icon |
| `tile(name, tone, size)` | square block: pixel icon on a tone fill, ink outline, hard shadow |
| `sticker(name, { tilt, tone })` | die-cut sticker: white outline, offset shadow, tilted, pops in |
| `strip()` | magenta / yellow / mint in equal thirds; draws in on reveal |
| `chip(text, "key" / "value" / "ph" / "tone")` | black key chip, grey value chip, placeholder chip |
| `counter(n, total)` | `03 / 09`, readable as "3 of 9" |
| `button({ href, label, icon, tone, size, magnet })` | the blocky key (§3) |
| `copyButton(value, what)` | copy with a live-region confirmation; hidden without JS |
| `sectionHead({ variant: "slab" / "line" })` | `// kicker`, rule, real count, wide title on a tilted slab or underline block |
| `pageHead({ tone, stickers })` | inner-page header: a big tone panel with faint grid, wide title, stickers |
| `placeholderTag()` | visible "Placeholder" tag for content Dex will replace |

All decorative glyphs are `aria-hidden`. Anything carrying meaning has text.

## 6. Floating layered background

`src/site/render/floats.ts` (markup), `styles/floats.css` (drift), `motion/floats.ts`
(parallax).

- There are three depths, placed only in the gutters beside the reading column:
  - **far:** 2 large pale tint blocks, steps and pills that hang off the page edge.
  - **mid:** up to 3 ink-outlined blocks, crosshairs, dot grids and strip fragments.
  - **near:** up to 3 pixel stickers and mascots.
- Layout comes from a seeded random generator (`floats(seed, options)`), so it is identical
  on every build. There is no runtime randomness and no layout shift.
- Each shape drifts on its own loop period (5.3, 7.1, 9.7 or 11.3s, with random start
  offsets), so they never line up.
- Scroll parallax moves far, mid and near by 0.04, 0.08 and 0.14 of the layer's distance
  from the viewport centre. With a fine pointer the layers also lean toward the cursor.
  Layers off screen pause their drift.
- Below 1180px, where the gutters vanish, the mid and near layers are hidden and only the
  pale far tints stay at the edges (fainter below 700px). The stickers you still see on
  small screens belong to headers, not to this layer.
- Reduced motion: shapes stay, but nothing moves.

## 7. Pages, content and data

Pages are prerendered HTML at real URLs, built by one Vite plugin
(`src/site/build/plugin.ts`). The same routes render in the dev server. `index.html` is the
root page; every other page is cloned from `src/site/pages/page.html`, which Vite processes
so the hashed CSS and JS get linked, and the plugin then drops it from `dist/`. Other
workflows' pages (`/lab/`, `/scenes/`) have no markers and pass through untouched.

| URL | Built from | State |
|---|---|---|
| `/` | `data/projects.ts`, `render/landing.ts`, `render/art.ts`, `styles/landing.css` | world mount; dex slab beside the Projects head and a jump key per project; one alternating showcase row per project (dexCode, dexClient, dex.place): a big layered pixel scene drawn in code, tagged "Placeholder art", then name, one line, state chips from `data/downloads.ts`, the one action that matters (dexClient: the file; dexCode: download status; dex.place: World) and Details; yellow word band; doors to each section. Tests: `src/site/landing.test.mjs` |
| `/projects/`, `/projects/<id>/` | same | index: the same showcase rows. Project page: the scene large, name on a tone slab, line, chips, actions (primary + the project's doc), "What it does" facts cited from each project's own docs, a Download panel from `data/downloads.ts` (none for dex.place), other projects |
| `/downloads/` | `data/downloads.ts`, `render/downloads.ts`, `styles/downloads.css` | dexClient 0.4.6: one mint block with a code-drawn setup file, the Download key (one click, straight to the file), file name, size and specs. dexCode: dashed "Not yet" card, "No standalone download yet. dexClient installs it.", and a Get dexClient link to `#dexclient`. Then four install steps and a "Check the file" panel (full SHA-256 and the `Get-FileHash` command, both with copy, and the `.sha256` link), all from dexClient's README and docs/TESTERS.md. Tests: `build/downloads.test.mjs` (also checks size and hash against the host folder when it exists) |
| `/gallery/` | `content/gallery/manifest.json` | collage of 9 pieces, no titles, alt text kept; cursor field and click-in viewer (see §7.1) |
| `/gallery/01/` to `/gallery/09/` | same | one piece per page, prev/next in the collage's reading order, thumbnail strip, arrow keys, Esc back to the collage |
| `/docs/`, `/docs/<slug>/` | `content/docs/*.md`, groups in `data/docs.ts` | index: one card per project group (dexCode, dexClient, dex.place). Doc page: sidebar of all docs, article, sticky "On this page" with a scroll-spy block; below 1180px / 900px both fold into disclosures. 4 placeholder entries, tagged, `noindex` |
| `/blog/`, `/blog/<slug>/`, `/blog/feed.xml` | `content/blog/*.md` | index: newest first, grouped by year, undated posts under Drafts, RSS button. Post page: one 760px column, date block, reading time, newer/older. 2 placeholder posts, tagged, kept out of the feed |
| `/donate/` | `donate.ts`, `vietqr.ts`, `qr.ts` | Ko-fi card; MB Bank card with a prerendered account-only QR (no amount), bank, account, recipient and note as selectable text with copy. With JS (`motion/donate.ts`, its own ~5.7 kB gz chunk) an amount slider (100,000 to 10,000,000 VND: 50k steps to 1M, 250k to 5M, 500k to 10M) and quick picks redraw the QR live; "Any amount" returns to the no-amount code |
| `/404.html` | | links to every section |

### 7.1 The gallery

- **Layout** (`src/site/collage.ts`, build time): pieces are packed into the lowest open gap
  (masonry with flexible widths, so nothing is cropped), searched over 1,500 seeded orders and
  scored for few holes, a flat bottom and no same-width stacks, then loosened: some pieces
  shrink a little, nudge inside their slot and tilt up to 2 degrees. Three compositions (wide
  from 1000px, mid from 600px, narrow) are written as CSS variables in container units
  (`cqw`) and picked with container queries, so there is no JS layout and no layout shift.
  New manifest items are placed automatically. Tests: `src/site/collage.test.mjs`.
- **Frame:** white mat, 3px ink outline, hard shadow, and a strip of tone tape (yellow,
  magenta, mint, cyan in reading order). Hover and focus swap the shadow to the tone and pop
  an ink-outlined "+" key out of the corner.
- **Cursor field** (`motion/gallery.ts`, fine pointer, motion welcome): the piece under the
  cursor grows to 1.07 and tilts toward it; neighbours within 300px shrink up to 7% and lean
  away up to 16px. Values are smoothed per frame and stop when settled. Keyboard focus gets
  the same lift. Without JS, CSS hover does a simpler grow/settle.
- **Viewer:** a modal `<dialog>` in the page. Clicking a piece flies its frame (FLIP, with a
  spring built as a `linear()` easing) from its spot to a large frame; the tile's image shows at
  once and the copy that fits the frame (its `srcset`, sized to the frame) fades in when
  decoded. The URL becomes the piece page
  (`/gallery/<id>/`), so it can be shared and reloaded; back, Esc, the close key, a click
  outside, or a swipe down close it and fly the piece back. Arrow keys, the side keys and
  horizontal swipes step through pieces in reading order. Tone blocks slide in from the
  corners. Reduced motion: no flight, no sliding, instant state changes.
- **Loading** (`render/gallery.ts`, `motion/defer.ts`):
  - Every piece has lossless smaller copies at 160, 384, 512, 640, 960 and 1280 px wide
    (below its own width), made by `npm run gallery:derive` (`src/site/build/derive-gallery.mjs`,
    ImageMagick). They are the same picture resampled: no crop, no recolour, ICC profile kept,
    each checked before the manifest lists it in `widths`. The build fails if a listed copy
    is missing. Never lossy: a lossy export would be a new treatment of Dex's art.
  - `sizes` is the width each image is really drawn at, per collage layout (derived from
    `--wrap`, `--pad`, the container breakpoints and the mat; see the comment in
    `render/gallery.ts`). Browsers take the smallest copy at or above the screen's density.
  - Phones are capped, because a 3x phone would otherwise pull 1 MB lossless files for
    340px tiles. Below 660px the collage stops at the copy nearest 2x of the tile on a 390px
    phone (640 for full-width tiles, 384 for half-width ones). Below 700px a piece page stops
    at the sharpest copy between 1.5x and 2x that is at most 200 KB (the image a Slow 4G phone
    can show by 2.5 s), or the 1.5x copy when none is. The viewer is not capped.
  - Only the lead piece (top left in every layout, the LCP image) loads at once, with
    `fetchpriority="high"`. The other tiles, and the film strip on piece pages, keep their
    sources in `data-srcset`/`data-src` until the lead image has landed and they are within
    half a screen of view; native lazy loading reaches ~1250px ahead, which on a phone is the
    whole wall. `<noscript>` copies cover no-JS, and the head script releases them if the
    main script never runs.
  - A piece page paints its 160px copy as the image's background first, so a slow line shows
    the piece blurred before it is sharp.
  - Measured (phone 390x844 @3x, Slow 4G + 4x CPU, text compressed like the edge): `/gallery/`
    LCP 1.9 s with 0.83 MB of images on first load; `/gallery/05/` LCP 2.4 s. The grainiest
    piece, `/gallery/09/`, lands at 3.1 s: its 1.5x copy is 296 KB.
  - The gallery script is its own chunk (about 3.9 kB gzipped), loaded only on `/gallery/`.

Content rules are in `content/README.md`: frontmatter, `placeholder: true`, file name as the
URL, and neutral two-digit gallery ids. Project one-liners come only from each project's own
docs (sources are cited in `data/projects.ts`). Downloads list only files that really are in
the host's downloads folder.

`/downloads/` is a page because `ops/server.mjs` now serves a file from the downloads folder
when one exists and otherwise hands the request to the build (tests in
`ops/test/ops.test.mjs`).

### Docs and blog (`render/docs.ts`, `styles/docs.css`, `build/highlight.ts`, `motion/toc.ts`)

- Markdown extras, all at build time: code fences get a label bar (language, optional
  `title="..."`), a copy key that skips `$ ` / `PS> ` prompts, and colours for shell,
  PowerShell, JS/TS and JSON; `> [!NOTE]`-style callouts in the section tones; tables scroll
  in their own focusable region; links to other sites get `rel="noopener"` and a
  screen-reader "(another site)".
- Headings `##` and `###` get anchors: a small `#` key in the gutter on hover that also
  copies the link, and a yellow flash when a deep link lands.
- A three-colour reading-progress strip at the top of doc and post pages uses a CSS scroll
  timeline (no JS; hidden where unsupported).
- `motion/toc.ts` is its own chunk (about 0.8 kB gzipped), loaded only on pages with prose.
- Placeholder rules: `content/README.md`. `content/docs/writing-docs.md` shows every element.

## 8. Quality bars

- **No JS:** every page is complete. Copy buttons and the slider slot are hidden; the QR,
  bank details, links and art are all there.
- **Reduced motion:** see §3.
- **Accessibility:** WCAG AA contrast (§2). Visible focus rings, skip links, real headings,
  `aria-current` on the nav, `aria-live` for copy results, and alt text on every artwork.
  The piece pages have an `sr` heading.
- **Performance:** the shared JS is about 2.3 kB gzipped and the CSS about 18 kB gzipped.
  Fonts are woff2, split by unicode range, with the two latin text fonts preloaded. Icons and
  the QR are inline SVG. Images carry width and height, so layout shift measured 0 on every
  checked page.
- **Devices:** Samsung Internet (Android) and iPad Safari are the targets. So far they have
  only been checked with an Edge Samsung-UA emulation and Playwright WebKit (iPad size), not on
  real devices.

## 9. Extending

- New section accent: add a `Tone`, its fill and tint in `tokens.css`, and `--tone-*`
  mappings in `components.css`.
- New page: add a route in `render/routes.ts` and a renderer in `render/pages.ts`. Use
  `pageHead`, `floats(seed)` and `data-reveal`; the build emits it.
- New icon: add a grid to `ICONS` in `pixels.ts` (§5).
- New doc or post: drop a markdown file in `content/` (see `content/README.md`).

## 10. Open, for Dex

- Title font: Anybody (in use); the fallbacks are Krona One or Archivo at width 125.
- Nav order and naming ("Gallery" vs CANON's "Illustrations"; CANON's four destinations vs
  the brief's added Blog and projects landing). CANON.md needs updating to match whichever
  wins.
- Section tones are suggestions.
- Real-device checks on Samsung Internet and iPad Safari, including scanning the 0 VND QR in
  the MB Bank app.
