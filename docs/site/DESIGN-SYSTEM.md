# dex.place website: design system

This is how the website under the world looks and moves, and where each piece lives in the
code. Since 2026-09-29 the site is a **dark pixel site**: a near-black page, square blocks
with thin hard edges, hard pixel shadows that make things pop out, one loud yellow with
magenta, mint and cyan in small doses, and pixel type for headings. It is calm on purpose:
nothing is tilted, everything sits on one grid, and the background moves slowly or not at
all. The home page is **one continuous scroll** through every section.

Dex's brief, in his words: "lets go full on with the pixel theme, however i want a dark
theme ... no round borders, full blocks and sharp edges with like a 1 or 2 px border, stuff
pops out, readjust the assets too, i also dont want it too chaotic we should tone that down
with the angles and whatnot. It should be a full scroll too like u dont have to click the
tabs, they can take u where u need but not the only way. For the art gallery i want the
stuff to be arranged more close in a grid like a collage with adjustment for different
aspect ratios, stuff shrink and grow as u hover. Same for other buttons, shrink, hover,
popout."

Sources: measurements and references in `VISUAL-RESEARCH.md` (written for the earlier light
"candy-blocks" look; its Endfield palette notes still apply), architecture in
`TECH-PLAN.md`, content rules in `CANON.md`. When Dex says something newer, that wins.

Section numbers are cited from code comments (`§2` to `§7`); keep them stable.

## 1. What the look is made of

Five rules carry the whole look. If a new piece follows these, it will fit.

1. **Dark, not black.** The page is `#0f1015`. Pure black is only ever a shadow.
2. **Square.** No border radius anywhere: blocks, keys, inputs, the slider thumb, focus
   rings, images, the QR frame. `base.css` sets `border-radius: 0` on everything. The one
   curve on the site is the world's distant ring, which is scenery, not UI.
3. **Thin hard edges, hard shadows.** Edges are 2px (1px for hairlines). Shadows are solid
   offsets in whole pixels with no blur (`4px 4px 0 #000`), and never a gradient.
4. **Things pop out.** Anything you can press lifts up-left, grows a little and throws a
   brighter shadow when you point at it or tab to it; it shrinks and sinks when pressed
   (§3, "the pop").
5. **Calm.** Nothing is rotated. One bright block per section (its tone). Background shapes
   are few, small, slow, and stay out of the reading column (§6).

What changed from the light "candy-blocks" site, and why:

| Before | Now | Why |
|---|---|---|
| White page, ink text | `#0f1015` page, off-white text | Dex: dark theme |
| Rounded chunky blocks, 3px ink outlines | Square blocks, 2px edges | "no round borders, full blocks and sharp edges" |
| Tilted slab, tilted word band, tilted stickers, tilted gallery frames | Nothing tilted | "tone that down with the angles" |
| Anybody (wide sans) titles | Jersey 15 (pixel) titles | "full on with the pixel theme" |
| Outlined sticker icons | Solid pixel glyphs with holes (§5) | readable on dark, less busy |
| Separate pages you reach through the nav | One scroll with every section; pages kept for deep links (§7) | "full scroll ... not the only way" |
| Masonry collage with mats, tape and tilt | Justified rows, 3px gaps, 2px frames (§7.1) | "more close in a grid like a collage" |
| Floats with parallax and cursor lean | A few slow step-drifting shapes, no parallax (§6) | calmer |

Content rules are unchanged: no taglines, no filler labels, no invented numbers (counters
show real counts only, "03 items", "09 pieces"). Dex's art appears only in the gallery (the
home section and its own pages). Placeholder imagery is drawn in code and tagged
"Placeholder art".

## 2. Tokens

All in `src/site/styles/tokens.css`. Use the variables; don't hard-code values in
components.

### Colour

The page is near-black; text is warm off-white. The four accents are bright enough to be
text on every dark surface, and near-black text (`--on-accent`) reads on each of them as a
fill. The table below is what makes that true: every text pairing clears WCAG AA (4.5:1),
and control edges clear the 3:1 needed for UI boundaries.

| Token | Value | Use |
|---|---|---|
| `--bg` | #0f1015 | page |
| `--bg-2` | #14151c | alternate section band on the home page |
| `--panel` | #1a1b23 | cards, blocks |
| `--panel-2` | #22242e | raised: keys, value chips, hover fills |
| `--sunk` | #0a0b0f | wells: code, hashes, the world stage, the footer |
| `--line` | #2e3040 | hairlines and card edges (decorative) |
| `--line-2` | #676b84 | edges of controls you press or type in |
| `--shadow` | #000 | hard shadows only |
| `--fg` / `--fg-2` / `--muted` | #f2efe6 / #c4c2cc / #9795a3 | text, secondary text, the lightest text allowed |
| `--on-accent` | #0f1015 | text and glyphs on accent fills |
| `--yellow` | #fffa00 | lead accent: the mark, current nav item, focus ring, links |
| `--mint` | #00ffa2 | downloads |
| `--magenta` | #ff1aac | donate |
| `--cyan` | #32fee3 | docs and blog |
| `--yellow-t` `--mint-t` `--magenta-t` `--cyan-t` | deep tints | tone-washed panels (hover rows, callouts, the checksum panel) |

Contrast (text or edge colour on the surface, WCAG ratio):

| On | `--bg` | `--bg-2` | `--panel` | `--panel-2` | `--sunk` |
|---|---|---|---|---|---|
| `--fg` | 16.53 | 15.83 | 14.91 | 13.43 | 17.11 |
| `--fg-2` | 10.80 | 10.34 | 9.74 | 8.78 | 11.18 |
| `--muted` | 6.46 | 6.19 | 5.83 | 5.25 | 6.69 |
| `--yellow` | 17.12 | 16.40 | 15.45 | 13.92 | 17.73 |
| `--mint` | 14.32 | 13.72 | 12.92 | 11.64 | 14.82 |
| `--cyan` | 14.86 | 14.23 | 13.41 | 12.08 | 15.38 |
| `--magenta` | 5.42 | 5.20 | 4.89 | **4.41** | 5.62 |
| `--line-2` (edges, 3:1 needed) | 3.63 | 3.48 | 3.28 | 2.95 | 3.76 |

`--on-accent` on the fills: yellow 17.12, mint 14.32, cyan 14.86, magenta 5.42, `--fg`
16.53. On the deep tints `--muted` is 5.29 or better.

Two limits follow from the table: **magenta text never sits on `--panel-2`** (4.41), and a
`--line-2` edge on `--panel-2` is decorative, not the control's only boundary (the key's
edge against the page is 3.63). axe-core (WCAG 2.2 A/AA) reports no violations on any route
at 1440 and 390 wide.

Section tones: projects yellow, downloads mint, gallery yellow (neutral, so the art leads),
docs and blog cyan, donate magenta. They live in `data/nav.ts`.

### Type

Every font is self-hosted. The OFL fonts come from `@fontsource`, are bundled by Vite, and
each licence sits in `public/fonts/OFL-*.txt`. There are no runtime network requests.

| Role | Font | Where |
|---|---|---|
| The mark "dex" only | Daniel (`public/fonts/Daniel-Regular.otf`, licence beside it) | header key, intro block, footer |
| Headings | **Jersey 15**, one weight (it is already heavy), `--f-px` | section and page titles, card titles, prose `h2`, header nav items (20px) |
| Tiny labels | Silkscreen, `--f-label` | kickers, chips, counters, tags (short caps only) |
| Body | Space Grotesk Variable, 17px, line height 1.6, measure 66ch | everything you read |
| Code, hashes | system monospace | SHA-256, commands, account number |

Why Jersey 15: it was compared at size with Pixelify Sans, Jersey 10, Tiny5, VT323,
DotGothic16, Silkscreen and Micro 5 (`review/site/dark/system/fonts-compare.png`). Pixelify
Sans turned "C" into something close to "D" and "fi" into "A" at heading weight; Jersey 15
kept every word in the site's vocabulary readable.

Readability beats theme for long text: docs, posts, bank details, forms and accessibility
text are always Space Grotesk. The pixel faces have no Vietnamese glyphs, so they never
carry names or bank details. Ligatures are off site-wide (`font-variant-ligatures: none`).
Sizes: `--fs-h1` 52-100px, `--fs-h2` 44-76px, `--fs-h3` 26-34px, fluid with `clamp()`.
The latin files of Jersey 15 and Space Grotesk are preloaded on every page.

### Space and layout

8px grid with 4px half steps: `--s-1` 4px to `--s-10` 128px. `--wrap` 1200px column,
`--pad` 18-48px side padding, `--section` 64-96px above and below each home section (so
192px at most between two section heads' content; the last section's bottom padding is
also the space above the footer, no footer margin on top of it), `--hdr-h` 64px sticky
header. `--gut` is the empty width beside the column.

### Edges and shadows

- Edges: `--bw` 2px (every block and control), `--bw-1` 1px (hairlines, chips).
- Accent stripes: `--stripe` 4px, the one exception to the 1-2px edge rule. It is a mark in
  a section colour on one side only (the "Check the file" callout, each docs group's cell),
  never a block's outline.
- Shadow offsets: `--off-s` 3px, `--off` 4px (resting), `--off-l` 6px. Ready-made:
  `--sh-s`, `--sh`, `--sh-l`, all `x x 0 #000`.
- Big feature blocks (the intro mark, the download block, scenes) rest on an 8px shadow.

## 3. Motion

Motion is quick and crisp: a short spring for pops, a fast press, calm reveals. Small moves
land on whole pixels, and idle loops step (`steps()`) rather than glide, so they read as
pixel animation.

| Token | Value | Use |
|---|---|---|
| `--ease-spring` | `linear()` spring with a ~10% overshoot; falls back to `--ease-pop` cubic-bezier(.3,1.5,.5,1) | pops, lifts, reveals of blocks |
| `--ease-out` | cubic-bezier(.25,1,.5,1) | reveals, presses returning |
| `--ease-move` | cubic-bezier(.65,0,.35,1) | view transitions, contents indicator |
| `--ease-in` | cubic-bezier(.4,0,1,1) | old page leaving |

Durations: press 70ms, hover 160ms, pop 240ms, spring 420ms, reveal 560ms. The stagger
between siblings is 60ms, for at most 6 items (`--i` 0-5).

### The pop (one interaction language)

Keys, cards, chips, nav items, the slider thumb and gallery pieces all behave the same way
(`components.css`, classes `.btn` and `.pop`, plus a few hand-tuned cards):

| State | What happens |
|---|---|
| Rest | a hard shadow `--pop-off` px down-right in `--pop-sh` (black) |
| Hover, and keyboard focus | lifts 2px up-left, grows by `--pop-grow`, and the shadow steps out 2px in `--pop-hi`: off-white under accent keys, the section tone under dark ones |
| Press | sinks 2px into its shadow (the shadow collapses to 0) and shrinks by `--pop-press`, in 70ms |

It is transform and box-shadow only, so nothing around it moves. **Keys and other small
controls stay on whole pixels:** `--pop-grow` and `--pop-press` default to 1, because a
fractional scale softens their pixel glyphs and 2px edges (and let an accent fill peek past
the edge mid-press). Their pop is the lift, the shadow stepping out and the sink. Big
surfaces really grow and shrink: cards and rows 1.01-1.02 / 0.97-0.985, the Ko-fi card
1.015 / 0.98, gallery pieces 1.06 with their neighbours shrinking. To make something pop,
add `class="pop"` and set `--pop-hi` (and `--pop-off`, `--pop-grow`, `--pop-press` if
needed). Section-head links are paper keys (`.btn--s`) whose pop is the section tone.

### Other primitives (`src/site/motion/` and `styles/motion.css`)

- **Reveal on scroll** (`reveal.ts`): add `data-reveal` (or `="pop"`, `"pop-block"`,
  `"strip"`) and optionally `style="--i:N"`. Rises are 16px, blocks step in from 6px down
  and right into place. Content is visible in the HTML; only `html.js` hides it before its
  reveal, and only when motion is welcome.
- **Scene depth** (`magnet.ts` `initScenes`, `data-tilt-scene`): the placeholder scenes'
  layers shift a little by depth under a fine pointer. Their idle loops (caret, orb bob,
  progress fill) step in whole pixels and rest off screen.
- **Nav indicator and scroll-spy** (`nav.ts`, §4).
- **Page transitions** (`shell.css`): a cross-document `@view-transition` that fades the
  old page out in 180ms and the new one in over 320ms; the header stays put; a gallery tile
  flies into its piece page (`view-transition-name: art-<id>`). CSS only: there are no
  JS-driven (`startViewTransition`) transitions. Two things keep it error-free
  (2026-09-29): every page's stylesheet sits ahead of every `<head>` script
  (`build/plugin.ts stylesheetsFirst`; with the sheet after the cached module script,
  Chromium could style the new page before the sheet was in, read the opt-in as off and
  abort the transition with an uncaught "ViewTransition opt-in disabled"), and a small
  head script (`render/layout.ts VT_GUARD`) catches the transition's promises on both
  sides, skips it on the way out to pages that don't opt in (`/lab/`, `/scenes/`, plain
  files), and marks any browser-aborted transition's rejection handled. Nothing waits on
  a transition, so navigation is never blocked.

**Reduced motion:** every animation and transition is cut to 0.01ms. No drift, no scene
depth, no gallery field, no viewer flight, no smooth scrolling, no world scaling. State
changes stay visible.

## 4. The shell

`src/site/render/layout.ts` builds every page's head and body. `styles/shell.css` styles it.

- **Header:** a full-width sticky bar (64px) on the page colour. It gets a hairline bottom
  edge once it is stuck over content. Left: the Daniel "dex" mark on a yellow key. On the
  home page that key stays hidden (its space kept) until the big intro mark has scrolled
  under the header, so "dex" never shows twice in one view. Right: the section nav
  (Projects, Downloads, Gallery, Docs, Blog, Donate, each with a pixel icon) and the black
  **World** key, which goes back up to the world.
- **Nav links are jumps.** On the home page they are `#projects`, `#downloads`, ... anchors;
  on every other page they are `/#projects`, ... so the nav always leads into the one
  scroll. Smooth scrolling is the browser's own (`scroll-behavior: smooth` unless reduced
  motion), switched on only after the page has loaded (`main.ts` sets `html[data-smooth]`),
  so a deep link or a nav click from another page lands on its section instead of riding
  the whole page down from the world. `scroll-padding-top` and each section's
  `scroll-margin-top` land the section's head just under the header. The header and
  everything in it carry a negative `scroll-margin-top` that cancels the padding: the
  sticky bar is always in view, so focusing Menu, the mark or a nav link never scrolls the
  page (without it Chromium jumped ~450px up to "reveal" the header).
- **Scroll-spy** (`motion/nav.ts initNav`): on the home page the section being read (the
  last one whose top has passed a third of the screen) gets `aria-current="true"` on its
  bar and menu links, and the yellow indicator block glides behind it. Hovering or focusing
  another link slides the block there and back. Inner pages mark the section they belong to
  (a post marks Blog, a project page marks Projects) without JS.
- **Mobile menu** (below 1100px): a Menu key opens a full-screen sheet (a native
  `popover`, so it opens and Esc closes it without JS). `initMenu` makes it a modal sheet:
  focus moves to its Close key (also `autofocus`), everything behind it is `inert`, Tab and
  Shift+Tab wrap inside it, and closing returns focus to the Menu key. Picking a section
  closes the sheet first, waits for its `toggle` (closed) event, then jumps and moves focus
  to the section's heading (`tabindex="-1"`), so the next Tab continues there. A link
  inside a closing top-layer sheet does not reliably scroll the page behind it. **Every
  focus move here uses `preventScroll`:** focusing the sticky Menu key lets Chromium scroll
  the page toward it, which cancelled mid-page jumps on phones and tablets (round-1 review).
- **Footer:** the `--sunk` well with the four-colour strip on top, the big yellow mark, the
  nav, Ko-fi and the font credits (Daniel, Jersey 15, Space Grotesk, Silkscreen).
- **Skip links:** "Skip to site" is the first focusable element on `/` (inside the world);
  every other page has "Skip to content".

### World mount and the scroll handoff (root page only)

The authored bars and scroll handoff remain; the mount now loads the playable runtime.

- The root page starts with the world mount, one viewport tall, then the site sheet
  (`#site`). `src/world/mount.ts` now reuses the authored `/world/` runtime in one
  same-origin frame. Its viewport sits inside the existing bars, so the sound and touch
  controls remain usable. The CSS still frame stays until real backdrop/loading/fade
  readiness; the direct World link remains a fallback. Without scripts the page says the
  world needs JavaScript and links straight to the site.
- Black cinematic bars sit at the top and bottom of the world. As the reader scrolls,
  `motion/world.ts` sets `--world-progress` (0 to 1) on the world element. The bars shrink
  to nothing, the world dims and scales down slightly, and the dark site sheet, with its
  four-colour top edge, slides up over it. At progress 1 the world is marked
  `data-covered`: paused and hidden from paint.
- **Mount contract:** `src/world/mount.ts` exports
  `mount(el: HTMLElement): { pause(): void; resume(): void; destroy(): void }`. It is found
  with `import.meta.glob`, code-split, and loaded only on `/`. The site calls `pause()` when
  the sheet covers the world and `resume()` when it uncovers. The module must honour
  `prefers-reduced-motion` itself. If it is missing or throws, the website still works.
- **Implemented adapter:** calls the existing runtime's `__world.game.setAway`, with
  separate construction/readiness, focus and cleanup. It preserves gameplay, saves,
  assets, the Enter gate and saved sound choice. Root room/spawn links work; `fresh`,
  `go`, `manual`, `mute` and debug flags never propagate. It loads only when the world
  is visible after the outer page's fragment landing, so `/#gallery` does not boot it.
  Covered worlds hand keyboard focus to `#main`; returning reuses the same frame.
  This proves simulation/audio-state pause, not rendering or GPU suspension.
- **World panels:** framed `?embed=world` pages hide header/menu/footer/outer strip and
  keep their authored content. Internal page and gallery-history links retain embed;
  files/full-size artwork stay direct. Copied embed URLs opened standalone retain the
  normal site. Framed root pages omit the world to avoid nested runtimes. The world
  owner supplies iframe Escape handling; a child gallery widget consumes its own first
  Escape, then an unhandled Escape returns to the world.
- The "Site" cue at the bottom of the world is a plain anchor to `#site`.

## 5. Pixel icons and glyphs

### Pixel icons (`src/site/pixels.ts`)

Every icon is a text grid in code, one character per pixel (CANON: assets are drawn, never
generated). They were redrawn for the dark site as **solid glyphs with holes** rather than
outlined stickers: on a dark page an ink outline disappears, while a solid shape with
knocked-out details reads at any size.

```text
.  empty: the surface shows through (the "holes")
a  the glyph: --px-a, defaults to currentColor, so icons follow the text colour
b  second accent (--px-b, magenta)      w  highlight (--px-w, off-white)
k  dark detail (--px-k, near-black): eyes and marks on a lit body
y  yellow   p  magenta   m  mint   c  cyan   g  mid grey
```

Because `a` is `currentColor`, the same icon is off-white in the nav, yellow when hovered,
and near-black on an accent tile or key, with no per-icon CSS.

`pixelSvg(name, { scale })` turns each colour into one SVG path, one rectangle per
horizontal run. It renders at build time with a fixed width and height (no layout shift)
and `shape-rendering="crispEdges"` plus `image-rendering: pixelated`, so edges stay crisp
at whole-number scales. An icon can have frames; CSS steps through them (`steps()`).

The set: download, arrow, arrow-left, arrow-down, arrow-se, up, close, menu, window, book,
page, frame, heart, coin, bank, qr, copy, check, external, sparkle, star, plus, cross,
cursor, grid, rss, info, warn, and two mascots: blob (blinks) and sleepy (a Z drifts). The
sheet `review/site/dark/system/icons.png` shows each on the page, on a panel and on yellow.
To add one: add a grid to `ICONS`; `validateIcon` (run by `pixels.test.mjs`) checks rows,
frames and keys.

### Glyph components (`src/site/render/glyphs.ts`, `styles/components.css`)

| Function | What it draws |
|---|---|
| `icon(name, scale)` | a bare pixel icon |
| `tile(name, tone, size)` | square block: the icon on a tone fill, 2px black edge, hard shadow |
| `sticker(name, { tone })` | a mascot or sparkle in a tone with a 3px hard pixel shadow; never tilted |
| `strip()` | yellow / magenta / mint / cyan in equal quarters, 4px tall |
| `chip(text, "key" / "value" / "tone")` | light key chip, dark value chip |
| `counter(n, total)` | `03 / 09`, read as "3 of 9" |
| `button({ href, label, icon, tone, size })` | the key (§3 the pop) |
| `copyButton(value, what)` | copy with a live-region confirmation; hidden without JS |
| `sectionHead({ id, kicker, title, tone, icon, aside, level, more })` | tone tile, `// kicker`, rule, real count, the Jersey title with a tone bar under it, and optionally a small key to the section's own page |
| `pageHead({ kicker, title, tone, icon, aside })` | the same kit at `h1` for inner pages |
| `placeholderTag()` | visible, quiet (grey-edged) "Placeholder" tag for content Dex will replace |

All decorative glyphs are `aria-hidden`. Anything carrying meaning has text.

### Placeholder project art (`src/site/render/art.ts`, `styles/landing.css`)

Each project has a code-drawn scene that is **real pixel art on one grid**: an 80 x 50 cell
canvas (16:10), drawn cell by cell with a tiny `Canvas` (`rect`, `block` with a 1-cell edge
and 1-cell hard shadow, `blit` for sprites, `ring` for a pixel circle) and turned into SVG
paths, one rectangle per horizontal run and one path per colour. One SVG unit is one cell,
so every edge, shadow and idle move is a whole cell; `shape-rendering="crispEdges"`,
nothing rotated, no gradients. Colours are the site tokens (`SCENE_FILL`), and `t` is the
project's tone, so the tone block is the one bright thing in each scene.

- dexCode (yellow): a terminal with a prompt and code lines that type in, a thinking
  bubble, an abstract orb (not Yuki's art), a small sparkle.
- dexClient (mint): an installer window with a taped box, a 9-segment progress bar that
  fills a segment at a time, a download arrow dropping in, a pointer, a magenta check tile.
- dex.place (magenta): the world stage (night, a distant ring, a cropped tower, the red floor
  line, a lit door, a tiny traveller, the black bars) with the dark site sheet and its
  four-colour edge rising over it.

Each scene is three depth layers (`.sc-it`, `--d` 0.3 / 0.7 / 1.2) that shift slightly under a
fine pointer (`motion/magnet.ts`). On hover or keyboard focus of its card the bars recede
3 cells, the sheet rises 2 and the traveller steps right, all with `steps()`. Idle loops
(`.sc-loop`: caret, bubble dots, orb bob, bar fill, arrow drop, pointer tap, cloud, sparkle)
move whole cells, rest off screen (`.is-vis`), and are off under reduced motion, where the
bar shows a fixed part-fill. Sprites are grids in `SPRITES`; `validateSprite` and the scene
tests in `landing.test.mjs` check keys, sizes, the 80 x 50 bounds and the palette. Tagged
"Placeholder art", never Dex's art.

### Project cards (`render/landing.ts` `card()`, `styles/landing.css` `.pcard*`)

One card per project, used on the home section, `/projects/` and "Other projects" on each
project page, so they can't drift apart. Top to bottom: the scene (a pointer shortcut to the
project page, hidden from keyboard and screen readers), the number chip in the tone, the
Jersey name (the real link to the page), the one factual line, chips from
`data/downloads.ts`, then three keys:

| Project | Main key | Then |
|---|---|---|
| dexCode | Get dexClient (to `#dexclient`; no standalone file) | Details, Docs |
| dexClient | Download (the 0.4.21 file itself, one click) in mint | Details, Docs |
| dex.place | World (up to `#world`), black key | Details, Docs |

The card pops as a whole (lift 2px, grow 1.01, a 2px-deeper shadow and edge in its tone);
its keys pop on their own; pressing the scene sinks the card. Layout: three across from
1000px (two for "Other projects"); in between, a card wider than 600px (a container query on
the card) becomes a row with the scene on the left in a `--sunk` column; stacked on phones.
The intro above the cards is the 2:1 yellow "dex" block (the page's `h1`) beside the section
head.

## 6. The background layer

`src/site/render/floats.ts` (markup), `styles/floats.css` (drift), `motion/floats.ts`
(pauses off-screen layers).

- **Two to four small shapes per section**, only in the gutters beside the reading column:
  one pixel glyph (sparkle, plus, star, cross or the section's own), hollow squares with a
  one-pixel "shadow" dot, and dot clusters, in a dimmed accent (35-50% opacity).
- They drift a few pixels up or down in four steps on long, unrelated periods (13-24s),
  so nothing moves fast and nothing lines up. No parallax, no cursor tracking, no rotation.
- Layout comes from a seeded generator (`floats(seed, options)`): identical on every build,
  no layout shift.
- Below 1240px, where the gutters get narrow, the layer is not drawn at all, so it can never
  sit behind text.
- The sheet itself has a faint 32px dot grid; cards are solid and cover it.
- Reduced motion: shapes stay, nothing moves.

## 7. Pages, content and data

### The one scroll (home, `/`)

`render/landing.ts` `landing()` composes the sections in Dex's order. Each is a
`<section class="sec" id="...">` with a `sectionHead` at `h2`, fully usable in place, and a
small key to its own page:

| Anchor | Section | Built by | In place |
|---|---|---|---|
| `#projects` | the "dex" mark on a square yellow block (the page's `h1`) beside the head, then one card per project (§5) | `landing.ts`, `art.ts` | scenes, chips from `data/downloads.ts`, the one action that matters, Details, Docs |
| `#downloads` | dexClient 0.4.21 block (the direct Download key, file name and size beside it, a Version / Platform / SHA-256 spec stack whose SHA row pops and jumps to "Check the file"), dexCode "Not yet", the four install steps and "Check the file". Below 700px the drawn file gives way to a small mint tile and a full-width key, so the key sits in the first screen after a jump | `downloadsSection()` in `downloads.ts` | the file downloads in one click; SHA-256 and command copy |
| `#gallery` | the justified collage and its viewer | `gallerySection()` in `gallery.ts` | hover field, click-in viewer, every tile deferred until near |
| `#docs`, `#blog` | the docs catalogue (one row per project group), then the latest four posts as index rows, older posts folded underneath, RSS | `docsSection()` in `docs.ts` | links into every doc and post |
| `#donate` | Ko-fi and the MB Bank card with the VietQR and slider | `donateSection()` in `donate.ts` | QR, slider, copy |

Alternate sections sit on a `--bg-2` band with hairline edges, so the page reads as stacked
blocks. The world handoff sits above all of it.

### Every URL still works

Section pages stay as **full prerendered pages** (not redirects), so deep links, no-JS
readers and search keep working, and their nav links lead back into the scroll. They reuse
the same renderers one heading level up (`downloadsBody(2)`, `donateBody(2)`,
`collageBlock(content, true)`, ...), so the two can never drift apart.

| URL | Built from | Notes |
|---|---|---|
| `/` | all of the above | the one scroll |
| `/projects/`, `/projects/<id>/` | `data/projects.ts`, `landing.ts` | the cards; project page: scene, name, chips, actions, "What it does", Download panel, the other projects as cards |
| `/downloads/` | `data/downloads.ts`, `downloads.ts` | tests: `build/downloads.test.mjs` |
| `/gallery/`, `/gallery/01/` to `/gallery/09/` | `content/gallery/manifest.json` | the collage leads with its first piece (LCP); piece pages have prev/next in reading order, a film strip that opens with the current piece in view (it scrolls sideways on phones), arrow keys, Esc back |
| `/docs/`, `/docs/<slug>/` | `content/docs/*.md`, `data/docs.ts` | doc page: sidebar, article, sticky "On this page" with a scroll-spy block |
| `/blog/`, `/blog/<slug>/`, `/blog/feed.xml` | `content/blog/*.md` | newest first, by year |
| `/donate/` | `donate.ts`, `vietqr.ts`, `qr.ts` | slider 100,000-10,000,000 VND, "Any amount" returns to the no-amount code |
| `/404.html` | `pages.ts` | links to home and every section page |
| `/lab/`, `/scenes/` | other workflows | untouched; they still build |

### 7.1 The gallery

- **Layout** (`src/site/collage.ts`, build time): a justified collage. Pieces sit in rows
  that fill the full width; every piece in a row is the same height, and its width follows
  its own aspect ratio, so nothing is cropped. Gaps are 3px, frames 2px, no mats, no tape,
  no tilt. Row breaks come from a small dynamic programme per layout (wide from 1000px of
  container, mid from 600px, narrow below) that keeps rows near a target height (25%, 34%
  and 52% of the width) and never leaves a lone portrait on a wide row. The reading order is
  searched (every order up to 9 pieces, a seeded search beyond) so all three layouts end on
  full rows; the first piece always leads. Each tile gets its share of its row per layout
  as CSS variables (`--fww`, `--gnw`, ...), picked with container queries: no JS layout, no
  layout shift. The share is of the row's *picture* width, after the gaps and every piece's
  2px frame edges, and each tile adds its own edges back; so every picture in a row is
  exactly one height whatever its shape (measured in Edge at 1440, 1180, 800 and 390 wide:
  within 0.08px, each row flush with the column). New manifest items are placed automatically. Today: wide rows 01+02 |
  03+07+04 | 06+08+09+05. Tests: `src/site/collage.test.mjs`.
- **Hover field** (`motion/gallery.ts`, fine pointer, motion welcome): the piece under the
  cursor pops like every other block (§3): it grows to 1.06 and lifts 2px up-left, its edge
  turns off-white and a hard 5px yellow shadow steps out under it (the same frame as the
  viewer and piece page; a black shadow would vanish on the dark page), and a small "+" key
  pops into its corner. Only the pieces touching it step back (reach 40px edge to edge, so
  the row mates and the pieces directly above and below): they shrink by at most 8px or 3%,
  whichever is less, and lean up to 3px away. The rest of the wall stays still. Distance is
  measured edge to edge from the lifted piece, not from the cursor, so the pieces beside a
  big tile react the same wherever the cursor sits on it. Crossing a 3px gap keeps the lift
  until the cursor reaches the next piece. Transform only, spring-smoothed, stops when
  settled; `.collage` is `position: relative` because the field reads tile positions
  against it. **Keyboard focus does exactly the same** (focus ring on top). Without JS the
  CSS does a simpler version (hovered 1.05 and lifted, others 0.97). A press shrinks the
  piece a step and it sinks into its shadow in 70ms.
- **Viewer:** a modal `<dialog>`. Clicking a piece flies its frame (FLIP, spring `linear()`
  easing) into a large square frame with a yellow hard shadow; the tile's image shows at
  once and the sharper copy fades in when decoded. The URL becomes the piece page
  (`/gallery/<id>/`), so it can be shared and reloaded; back, Esc, the close key, a click
  outside or a swipe down close it, fly it back, and return the URL to where it was opened
  (`/`, `/#gallery` or `/gallery/`). Closing via `history.back()` into `/#gallery` would
  let the browser scroll to the anchor mid-flight, so while the viewer is up
  `history.scrollRestoration` is `manual`, and the close puts the page back at the scroll
  position it opened from before the flight home is measured. Focus returns to the tile
  without re-lifting it, and is re-applied a frame later if the browser's fragment step
  for `/#gallery` dropped it to `<body>` (reduced motion closes synchronously inside that
  popstate). Arrow keys, the side keys and horizontal swipes step through
  pieces in reading order. **The counter is the piece's place on the wall** (`04 / 09`),
  the same on the viewer, the piece page's counter, its `h1` and `<title>`; the URL keeps
  the catalogue id (`/gallery/07/`), so shared links never move. Reduced motion: no
  flight, instant state changes.
- **Full size:** a small existing-style key below each piece frame and in the viewer's
  control bar opens that piece's complete lossless display file in a new tab. The piece
  page's link works without JavaScript. The viewer updates it when stepping to another
  piece. This keeps the framed composition and lets visitors request detail even when
  the connection keeps the initial image capped. `/gallery/05/` stays the final tile,
  `09 / 09`; catalogue IDs and wall order intentionally differ.
- **Loading** (`render/gallery.ts`, `motion/defer.ts`):
  - Every piece has lossless smaller copies at 160-1280px (`npm run gallery:derive`). Never
    lossy: a lossy export would be a new treatment of Dex's art.
  - `sizes` is the width each image is really drawn at in each layout: its row share of
    the wrap after the gaps, less the 2px frame (`collage.ts imageWidth`, formulas in
    `render/gallery.ts`).
  - Phones are capped near 2x of the tile on a 390px phone (640px for full-width tiles);
    piece pages keep the 200 KB Slow 4G budget, and so do the lead tiles together (below).
    The viewer is not capped.
  - Piece pages also cap tablet and desktop initial loads to the sharpest available
    copy within the 200 KB image budget, with a floor at half the reference drawn width.
    On a sufficiently fast measured connection, `motion/piece.ts` decodes a sharper copy
    before swapping only the active screen source. Save-Data, late loads and unknown
    throughput retain the cap. A cached preview alone is not evidence of bandwidth.
    The Full size key bypasses these automatic-loading limits by explicit choice.
  - The added 560px lossless copies let a 1x desktop's leading pair use 560px rather
    than 640px. Tablet lead caps split at 850px: the smaller tablet class can use
    560px, while larger tablets retain 640px so a later tile does not take over LCP.
    The matching home-gallery arrival preloads use the same media and copies.
  - Tablets are capped at about 1.5x: in the mid layout (660-1095px) on a screen of
    1.5 dppx or more (`TABLET_COLLAGE`), each tile's srcset stops at the largest copy
    within 1.5x of its width on an 820px tablet, never under 1x there (`tabletCap`; today
    512 for the first-row pair, 640 for the big landscapes, 384 for the portraits). A 2x
    tablet used to pull the 960/1280 copies. A 1x window at those widths (a narrow
    desktop browser) sits outside that query and keeps every copy, as before.
  - The picture box holds the aspect ratio and the image fills it, so a tile is its final
    size before its image arrives (an `<img>` with alt and no `src` lays out as alt text).
  - On `/gallery/` only the lead tiles load at once, with `fetchpriority="high"`, and
    which tiles lead depends on the layout. Each tile's `<picture>` has a `<source>` per
    layout (phone, tablet, and where needed mid-1x and wide), and only the sources of the
    layouts a tile leads in are live; the rest wait in `data-srcset` like any deferred
    tile, so the phone's lead pair costs a tablet nothing on its first load and the other
    way round (`render/gallery.ts tileSources`).
    - Phone: the first piece and its twin (`leadTiles`: any piece in the phone layout's
      first two rows as large as the lead, within 3%; today 02, full width under 01).
      Largest Contentful Paint takes the last of the largest images to paint, and two
      tiles of one size measure a pixel apart depending on where their edges snap, so a
      twin left to load later became the page's LCP when it landed (6.0 s). The pair
      shares the 200 KB budget (`leadPhoneCaps`: the sharpest copies between 1.5x and 2x
      that fit together; today 512px each, 191 KB).
    - Tablet: the largest picture in the mid layout's first two rows, and any within 3%
      (`tabletLeadTiles`; today 03, the big second-row piece). A 1x window in the mid
      layout leads with the same tiles, from every copy. On a tablet its copies share the same
      200 KB budget (`leadTabletCaps`: between 1x and the tablet cap), but never drop
      under 1x of the tile on an 820px tablet: Chromium scores an upscaled image by its
      own pixels for LCP, so 03 at 512px (0.92x there) scored under 04 at 640px, and 04
      took the largest paint when it landed (5.6-7.2 s at 820x1180). Today that floor
      holds 03 at 640px (262 KB, 1.14-1.22x), above the budget.
    - Desktop: the phone's pair, as before (the first row there).
    The budgeted copies are the same on `/gallery/` and in the home section. On the home
    page every tile waits. Deferred tiles release within half a screen of view;
    `<noscript>` copies cover no-JS.
  - The first screen, wherever a page with deferred tiles opens (`/gallery/` at the top,
    `/#gallery` from any Gallery link, any `#anchor`): an inline script at the end of
    `<body>` (`render/layout.ts ARRIVAL`) works out which images will be on screen once
    the page has come to rest. The largest, and any within 3% of it (counting a lead
    already in the markup), load at once, eager, with `fetchpriority="high"`; the others in
    view are queued as `data-defer="lead"` and load the moment every high-priority image has
    landed, then the rest of the wall (`motion/defer.ts`). Nothing in view (the home page
    opens on the world): nothing extra.
  - Arriving at `/#gallery` gets a head start. ARRIVAL can only run once the whole home
    page is parsed and laid out, over a second into a slow line, which a tablet's 262 KB
    lead cannot afford. So the home page's `<head>` ends with a small script
    (`render/gallery.ts galleryArrival`) that, only when the address ends in `#gallery`,
    adds an image preload for each layout's first-screen lead: the first tile on phones,
    the tablet lead tiles on tablets, the first row's pair on desktop, none for a 1x window
    in the mid layout. Each preload carries its tile's `<source>` media, srcset and sizes,
    so the browser picks the very copy the tile will pick, and the tile takes it from the
    preload. It sits after the stylesheet (it runs once the sheet is in): put ahead of the
    sheet it won a tablet nothing, the line being full from the start either way, and made
    every first paint later.
  - Measured (phone 390x844 @3x, Slow 4G + 4x CPU, text gzipped like the edge): `/` LCP
    1.4 s, 164 KB total with 1 KB of images; `/gallery/` LCP 1.7 s with 309 KB of images;
    `/gallery/05/` LCP 2.2 s. CLS 0 on every measured page. Re-measured after the
    frame-aware shares (2026-09-29): `/gallery/` 1.72 s and 309 KB of images, `/gallery/05/`
    2.2 s, `/` 1.64-1.69 s, CLS 0. Gallery review shots and the interaction GIFs:
    `review/site/dark/gallery/`. Section arrivals (2026-09-29, Edge, same throttling, 3
    runs, median): `/#gallery` 2.05 s (was 5.3 s), Gallery link from `/docs/` or `/blog/`
    1.56-1.61 s (was 4.5 s), `/#donate` 1.94 s, `/` 1.43 s; CLS 0. Lead twins (2026-09-29,
    Edge, same throttling, LCP read 12-15 s after load so a late paint cannot hide):
    `/gallery/` 2.05-2.09 s at 390x844, 393x852 and 412x915 (was 6.0 s; LCP is 02 at
    ~2.07 s, its first screen done by ~3.2 s instead of ~6.2 s), `/#gallery` 2.14-2.34 s,
    Gallery links from inner pages 1.68-1.96 s, `/` 1.33-1.45 s; CLS 0. Evidence:
    `review/site/dark/fix-tech-r5/`.
  - Tablets (2026-09-29, Edge, same throttling, LCP read 13 s after load, 2 runs each,
    interleaved with the build before the tablet caps): `/gallery/` 2.44-2.47 s at 768x1024,
    820x1180 and 1024x1366 @2x (was 15.2-15.6 s, and 22.9 s at 1024 on the 2048px display
    file); `/#gallery` 2.49-2.50 s at 768x1024, 2.48-2.49 s at 820x1180, 2.49-2.50 s at
    1024x1366 (was 13.1-13.4 s and 23.4 s). In the same runs phones held on `/gallery/`
    (1.87-2.08 s at 360-430px) and got faster on `/#gallery` (1.49-1.63 s, was 2.29-2.57 s);
    1440x900 held on `/gallery/` (2.54-2.56 s) and got faster on `/#gallery` (2.56-2.58 s,
    was 3.10-3.15 s). CLS 0, no page errors. The tablet numbers sit on the line's floor: on
    an 820px tablet 03 needs its 640 copy (262 KB) to stay the largest paint, and the fonts,
    sheet and page fill the rest of the first 2.4 s. A 560px copy (207 KB, 1.0x there)
    measured 2.17 s on `/gallery/`, but it would be a new copy of every piece
    (`gallery:derive`), so it is not made. At 1024x1366 the capped big landscapes draw at
    0.91-0.96x (a touch soft at 2x); anything sharper there would be the largest paint
    (03's 960 copy, 514 KB). Tile shots at 2x (`tablet-*-tile-*.png`) and logs:
    `review/site/dark/fix-tablet/`.

### Docs and blog (`render/docs.ts`, `styles/docs.css`, `build/highlight.ts`, `motion/toc.ts`)

- **Indexes.** The docs catalogue (home section and `/docs/`) is one panel with a row per
  project group: the group's cell (`--stripe` tone edge, tile, name, real page count) on the left,
  its docs as full-width index lines on the right (title, summary, Placeholder tag, arrow).
  A group with one page never leaves an empty box. Lines pop in the group's tone on hover
  and focus and sink on press. Posts are index rows: date block (or a dashed Draft block),
  title and summary, facts on the right (tag, date, reading time), arrow; the whole row is
  the link and pops cyan. The home section shows the latest `HOME_POSTS` (4); any older
  posts sit in a folded "Older posts" list, so every post stays reachable in place and the
  landing test holds. On phones rows stack (date block beside title and facts).
  `/blog/` groups rows by year with a sticky pixel year label.
- **Headers.** Doc and post pages have one bright mark: a block of the group tone (cyan
  for posts) under the Jersey title. No extra four-colour strip in the header; the strip
  is the reading-progress bar and the end-of-post rule.
- Long text is Space Grotesk at 17px on a 66ch measure; only prose `h2` uses the pixel face.
  Each `h2` (except a first one) has a 1px hairline across the measure above it, so long
  pages scan in blocks.
  Links are yellow with a translucent underline.
- Markdown extras, all at build time: code fences get a label bar (language, optional
  `title="..."`), a copy key, and colours for shell, PowerShell, JS/TS and JSON;
  `> [!NOTE]`-style callouts with a tone edge on a deep tint; tables scroll in their own
  focusable region; links to other sites get `rel="noopener"` and a screen-reader "(another
  site)".
- `##` and `###` get anchors: a small square key in the gutter on hover that also copies the
  link, and a stepped yellow flash when a deep link lands.
- A four-colour reading-progress strip at the top of doc and post pages uses a CSS scroll
  timeline (no JS).
- Placeholder rules: `content/README.md`. `content/docs/writing-docs.md` shows every element.

## 8. Quality bars

- **No JS:** every page is complete, the home page included. Copy keys and the slider are
  hidden; the QR, bank details, links and art are all there.
- **Reduced motion:** see §3.
- **Accessibility:** WCAG AA contrast (§2 table). A square 2px yellow focus ring with a dark
  gap on everything, plus the pop lift on keys and cards. Skip links, real headings (one
  `h1` per page), `aria-current` on the nav, `aria-live` for copy results and the viewer
  counter, alt text on every artwork. axe-core clean on every route at 1440 and 390.
- **Performance:** shared JS 3.7 kB gzipped (`main`), the gallery chunk 3.7 kB, donate
  5.7 kB, toc 0.8 kB, each loaded only where needed. CSS 23.8 kB gzipped (smaller than the
  light version's sources). Fonts are woff2, split by unicode range, with Jersey 15 and
  Space Grotesk latin preloaded. Icons and the QR are inline SVG. Zero external requests.
- **Devices:** Samsung Internet (Android) and iPad Safari are the targets. This version has
  been checked with Edge at 1440x900 and with a Samsung-UA 390x844 emulation, not on real
  devices.
- **Review shots:** `review/site/dark/system/` (git-ignored), with the scripts that make
  them in `tools/` (`shots.mjs`, `interact.mjs`, `perf.mjs`, `axe.mjs`).

## 9. Extending

- New section on the home page: add a `NavItem` in `data/nav.ts` (anchor, page, icon,
  tone), a `<section class="sec" id="...">` renderer that uses `sectionHead`, and put it in
  `landing()` in order. The scroll-spy picks it up from the nav.
- New section accent: add the colour and its deep tint in `tokens.css`, check both against
  the §2 table, and add `.sh--<tone>` / `.tile--<tone>` / `.btn--<tone>` rules.
- New page: add a route in `render/routes.ts` and a renderer. Use `pageHead`,
  `floats(seed)` and `data-reveal`; the build emits it.
- New pressable thing: give it `class="pop"` and a `--pop-hi` (§3).
- New icon: add a grid to `ICONS` in `pixels.ts` (§5).
- New doc or post: drop a markdown file in `content/` (see `content/README.md`).

## 10. Open, for Dex

- Heading face: Jersey 15 in use; Jersey 10 (narrower) or Silkscreen (caps only) are the
  fallbacks from the comparison sheet.
- Nav order and naming ("Gallery" vs CANON's "Illustrations"; CANON's four destinations vs
  the brief's added Projects and Blog). CANON.md needs updating to match whichever wins.
- Section tones are suggestions.
- Real-device checks on Samsung Internet and iPad Safari, including scanning the 0 VND QR
  in the MB Bank app.
