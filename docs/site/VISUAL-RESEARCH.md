# dex.place website: visual research

What the website layer (the part under the world) should look and move like, and where each
decision comes from. Research date: 2026-09-29. `CANON.md` and Dex's newest words win over
anything here. Technical support tables and budgets live in `TECH-PLAN.md`; this file only
covers look, type and motion.

## The short version

Dex asked for "cute and colorful, hyperpop, but not chaotic", with the colours of the
Arknights: Endfield website. After measuring that site and nine praised sites, the recipe is:

1. **A white page with black ink, and colour that arrives in solid blocks.** Endfield is
   mostly white (#FFFFFF) and near-black (#191919). Its signature is one acid yellow
   (#FFFA00), used as big flat blocks, bands and tabs, never as text. Hot magenta (#FF1AAC)
   and mint (#00FFA2) appear only in small doses, most famously as a three-colour strip.
   That restraint is why it feels loud and calm at the same time.
2. **Blocky means square corners, hard offset shadows and flat fills.** No gradients, no
   glass, no blur. The "pop" comes from shapes that scale in with a small overshoot, and
   buttons that press down like physical keys.
3. **Cute comes from pixel glyphs, not from rounded everything.** Small pixel icons drawn in
   code, tinted per section, with stepped (frame-by-frame) idle animations. Cozy Eating
   Village and Cyd Stumpel's portfolio both do this and stay tidy.
4. **Floating layers stay in the background and stay few.** At most about a dozen shapes per
   screen, in three depths, drifting slowly on periods that never line up. Text never sits
   on top of them.
5. **Motion is quick for interface, slow for atmosphere.** Hovers 150 to 200 ms. Reveals
   600 to 800 ms with a 60 to 80 ms stagger. Background drifts 5 to 11 s. Everything off
   or reduced to opacity under `prefers-reduced-motion`.
6. **Type:** Daniel for the `dex` mark only, a wide chunky grotesk (Anybody) for section
   titles, Space Grotesk for everything readable, Silkscreen for tiny pixel labels. All OFL
   except Daniel, all self-hosted.

The rest of this file is the evidence and the exact numbers.

## How this was gathered

- Pages were captured in headless Microsoft Edge driven by `playwright-core` 1.63.0 from a
  scratch folder outside the repo (`D:\Dex\Temp\dexplace-visual-research`). Desktop captures
  are 1440 x 900 at 1x. The Endfield mobile capture is 390 x 844 at 2x with a Samsung
  Internet user-agent string: **that is emulation, not a real device.**
- Hex values marked "measured" were read from screenshot pixels with Pillow (most-common
  colour inside a cropped region). Values marked "CSS" were counted in the site's own
  stylesheets. Easing curves and durations come from computed styles and stylesheet text.
- Cookie banners were never accepted. Some screenshots show them.
- Award claims were checked on each site's Awwwards page on 2026-09-29.
- Screenshots (third-party imagery, never to be committed) are in the git-ignored
  `review/` tree:
  - Endfield: `review/site/endfield/home/` (8 scroll positions, `extract.json`, the
    stylesheet text, `zoom-glyphs.png`), `review/site/endfield/motion/` (load sequence at
    250 ms steps, three section entrances at 150 ms steps, contact sheets),
    `review/site/endfield/mobile/`, `review/site/endfield/news/`.
  - Other references: `review/site/refs/<site>/` with a `sheet.png` contact sheet each.

## 1. Arknights: Endfield

Official site: https://endfield.gryphline.com/en-us (Next.js build "official-v4"; page title
"Arknights: Endfield - Over the Frontier, Into the Front"). Captured on the live
"Dreamscape of Wind and Snow" version, so hero art and some accent colours are
version-specific. The system around them is stable.

### Palette (measured)

These are the colours the site is actually made of, largest share first. The "role" column
says how Endfield uses each one, which matters more than the hex.

| Hex | Where it was measured | Role |
|---|---|---|
| `#FFFFFF` | page background of every content section (100% of a 900 x 180 crop) | the canvas |
| `#FAFAFA`, `#F2F2F2`, `#E6E6E6` | CSS backgrounds (15, 4 and 6 uses), chips, panels | quiet surfaces |
| `#D9D9D9` | CSS (22), grey rule under headers, pager tracks | lines |
| `#191919` | CSS (85 uses, the top colour), loader background, body text | ink |
| `#35373C` | CSS (15), dark icon chips | secondary ink |
| `#0A0B0F` / `#08090D` | Lore/Media section background | night sections |
| `#101010` | footer | footer |
| **`#FFFA00`** | CSS (57), the Lore band (79,136 of 80,000 px), Gameplay side tab, loader wipe, progress line, active pager segment | **the signature**: flat blocks only |
| `#FDFD1F` | "play" button fill | yellow for small controls |
| `#FFFDBD` / `#FFFEBF` | faded edges of yellow blocks | yellow tint |
| **`#FF1AAC`** | three-colour strip, vertical accent bars | magenta accent |
| `#FF00F0` | first third of the name underline | magenta variant |
| **`#00FFA2`** | three-colour strip, name underline, vertical bars | mint accent |
| `#32FEE3` | date chips on the version calendar | cyan, version accent |
| `#3B5BD0` | version calendar banner | periwinkle, version accent |
| `#E4327E` | "Chartered Headhunting" tag | event pink, version accent |

The **three-colour strip** is the most recognisable glyph: a 3 to 6 px bar split into equal
thirds of magenta, yellow and mint (both `#FF1AAC | #00FFA2 | #FFFA00` and
`#FF00F0 | #FFFA00 | #00FFA2` orders appear). It underlines names, caps section corners, and
stands vertically beside section headers.

### Typography

What they load (all commercial or proprietary, so none of these can be self-hosted here):

- **HarmonyOS Sans** (Regular/Medium/Bold/Black) for body and UI. The CSS calls these
  `SansRegular`/`SansMedium`/`SansBold`. We infer that mapping from the loaded
  `HarmonyOS_Sans_*.woff2` files. These aliases are the most-used family, on 54 of 101
  visible text elements.
- **Novecento Sans Wide** (Medium/DemiBold/Bold) for uppercase section names: LORE, MEDIA,
  GAMEPLAY, NEWS.
- **Gilroy** (Light/Medium) for numbers and small labels.
- **Space Grotesk** is also loaded (OFL; we can use it).
- Sizes are set in `rem` on an 18 px root at 1440 px wide (10.125, 11.25, 27, 54 px are all
  multiples of 1.125). That suggests a root that scales with the viewport (about 1.25vw).
  This is an inference from the numbers, not a read of their code.
- The giant background word `// ENDFIELD` is 274.5 px with -21.96 px letter spacing
  (-0.08em). Headings use normal tracking, caps.

### Layout and grid

- **A fixed left rail** (about 68 px, white) with one pixel-style icon per section. The
  active one gets a black bar on its left edge and a grey block behind it. On mobile it
  becomes a top bar: logo, sound toggle, a black "Go to Game" pill, a menu button.
- **Tall, full-viewport sections on normal scrolling.** A 100 px wheel step moved the page
  exactly 100 px, and there is no scroll snap, so scrolling is native. Each section plays
  its entrance once it comes into view, and the left rail highlights the current section.
- **The section header kit**, repeated for every section (see `zoom-glyphs.png`):
  1. a micro label, for example "▽ ARKNIGHTS: ENDFIELD", at about 6 px in grey;
  2. a grey tab with a `↘` arrow glyph;
  3. the section name in wide caps (27 px) or a big bold name (54 px);
  4. a boxed `+`, a two-line micro spec text, a 2 x 6 grid of small grey squares, and a
     short vertical bar in magenta/mint over grey.
- **Bands and tabs.** Content sections alternate with full-width yellow bands (the Lore
  band) and tall yellow side tabs carrying a vertically set title (GAMEPLAY, AIC).
- **Label chips.** A black chip with white text for the key ("Faction", "Race") next to a
  pale grey chip for the value; a yellow chip holds an icon.
- **Pager.** Segmented track (active segment yellow, rest grey), a `1 / 6` counter in
  yellow, and round white arrow buttons sitting in a dark capsule with a 45 degree hatch
  (`repeating-linear-gradient(-45deg, #1f1f22 0 3px, transparent 3px 6px)`).
- **Corners.** Square almost everywhere. The only common radius is 50% (circular arrow
  buttons, 45 uses). Other radii are 2 to 4 px.
- **Texture at micro scale.** Faint topographic contour lines, thin `+` crosshairs at grid
  points, a faint square grid on yellow blocks, and thin-line isometric technical drawings
  (a bolt and nut assembly, a "460ML" canister) with yellow fill on some parts.
- **News page** (`/en-us/news`): a yellow band header whose title ("News:") sits on a white
  strip, a black square icon tile, filter tabs as chips (Latest / Notices / Events / News),
  a three-column card grid, and under each card a grey category chip, a date and a one-line
  title cut off with an ellipsis. This is the closest Endfield pattern to a docs/blog index.

### UI glyphs

`//` as a prefix ("// Notices", "// ENDFIELD"), `[ ]` brackets around names, `▽` bullets,
`↘` and `‹ ›` arrows, fraction counters (`1 / 6`, `01 / 33`, `010 / 010 LAST`, `NEXT 02 / 010`),
`REC`, boxed `+`, dot matrices, the three-colour strip, star rows for rarity, and small
square icon tiles (black tile with a white glyph, lime tile with a dark glyph).

### Motion (measured)

- **Hovers are fast and plain.** Computed transitions: `color .2s ease` (28 elements),
  `background-color .2s ease` (19), `transform .3s ease / ease-in-out` (24), `opacity .3s`.
  The "More Videos" button only shifts its background from `#383838` to `#484848` and its
  text from `#EEE` to `#FFF`. No scale, no bounce.
- **Loader exit, a yellow wipe.** The loader is `#191919` with a faint grid. An 11 px
  yellow bar on the left edge grows downward as a yellow percentage counts up. At 100% a yellow panel wipes across from the
  left: `transform: scaleX(0 → 1)`, `transform-origin: left`, **0.6 s
  `cubic-bezier(1, 0, .7, 1)` after a 0.5 s delay**. Then the loader fades out:
  `opacity 1s` after `1.4s`. Frames `load-07` to `load-10` show it.
- **Section entrance** (frames `sec0-*`, 150 ms apart):
  1. a yellow block fades up behind where the art will be;
  2. the three-colour rule draws in, with a brief RGB-split line;
  3. the character art slides in with a colour-offset flash;
  4. text columns slide in from the left, clipped, and chips and the star row appear.
  The whole thing settles in roughly a second. That's approximate: each screenshot added
  its own delay on top of the 150 ms spacing.
- **Flicker-in.** `flashing`, 1 s `ease-out`, used by Gameplay, AIC and the final page:
  opacity steps `0 → .5 (10%) → 0 (11%) → .5 (20%) → 0 (21%) → .5 (40%) → 0 (41%) → 1`.
  It reads like a hologram or CRT switching on.
- **Other loops.** Scroll hint: moves down 1.5 rem and fades, 1.6 s, infinite. Breathing
  scale 1 → 1.2 → 1. Download panel background breathes between 42% and 62% black. A
  rolling carousel slides -50% over 80% of its cycle, then holds.
- **Lore section.** A three.js point cloud assembles from scattered points into a building
  over about 1 s (frames `sec1-*`). The script bundles also contain Lottie and Swiper
  (string matches, so an inference). The home page has two `<video>` elements and fetched
  three MP4 files during the capture.

### Why it feels the way it does

- **White first, one loud colour second.** The yellow is saturated to the limit, but it is
  almost always a big flat block on white or a tiny signal (progress line, active segment).
  Magenta and mint never cover large areas.
- **Density at micro scale only.** The micro labels, crosshairs and dot grids make the page
  feel engineered and busy, but they are tiny and grey, so the page still reads as calm.
- **Rigid frame, organic content.** The character art is the only soft, colourful,
  painterly thing. The interface around it is square, black and mechanical. That contrast
  makes the art pop.
- **Mechanical motion.** Wipes, flickers and slides, with no springy bounces. Short hover
  times make it feel responsive rather than playful.

### What to take, what to leave

Take: the white/ink/yellow ratio, the magenta and mint accents in small doses, the
three-colour strip, square corners with round icon buttons, the section header kit (with
real text), black-key and grey-value chips, the segmented pager and counters, yellow bands
and vertical side tabs, the yellow wipe as a section transition, the flicker-in for small
glyphs, the news-page card pattern for the blog.

Leave:
- the 6 px micro text: it is unreadable and fails WCAG, so our labels are 12 px minimum
  and never the only carrier of information;
- `#999999` grey text (2.85:1 on white, fails AA);
- the fake loading hold (canon: honest loading);
- background videos and the 3D point cloud on the website layer (budget);
- **pseudo-technical filler** such as "MISSION-DEPENDENT PAYLOAD SYSTEM INTERFACES". Canon
  forbids invented copy. Our micro labels carry real facts: version, file size, date,
  piece count, a short SHA-256.

## 2. Reference sites

Endfield supplies the colour and structure. It isn't cute, and it isn't the "pop" Dex
described. These sites fill that gap. Each entry lists why it fits, its award status, and
the techniques measured from its own CSS.

### Dropbox Brand Guidelines: blocky colour tiles that pop

https://brand.dropbox.com/ · Awwwards Site of the Day, Feb 12, 2025 (7.67), Developer
Award, and Site of the Month for Feb 2025; CSS Design Awards Website of the Month. By
Daybreak Studio.

- **Look:** a white page with a faint square grid. Big flat colour tiles (blue `#0061FE`,
  cyan `#3DD3EE`, orange `#FF8C19`, yellow `#FAD24B`, plum `#892055`, lime `#B4DC19`,
  lilac `#C8AFF0`) slide in as the grid scrolls. The nav is a bento of coloured tiles, one
  per topic.
- **Tone-on-tone labels** keep all that colour calm: each tile's text is a dark shade of
  its own fill (lime `#B4DC19` with green `#175641`, orange with brown `#6D2E09`, plum with
  pink `#FFAFA5`, lilac with purple `#682760`). On hover the tile swaps to ink `#1A1918`
  with white text: `background-color .35s cubic-bezier(.4, 0, .2, 1)`.
- **Named easing tokens** in `:root`: `--tile-transition: .35s cubic-bezier(.4,0,.2,1)`,
  `--nav-easing-swoop: cubic-bezier(.6,0,0,1)`, and a `--highest-tile-yeet` offset that
  throws tiles off screen when the menu opens. The line-drawing animation is `drawIn 1.25s
  cubic-bezier(.4,0,.3,1)`. Uses `@starting-style` once and `prefers-reduced-motion` four
  times.
- **Borrow:** tone-on-tone text on accent tiles; the tile nav for the landing's project
  grid; the swoop curve for panels.

### Cyd Stumpel, Portfolio 2025: pixel cursors, stickers, native page transitions

https://cydstumpel.nl/ · Awwwards Site of the Day, Mar 9, 2025 (7.22), Developer Award
7.74. Built mostly with CSS View Transitions and scroll-driven animations.

- **Look:** seashell paper `#FFF5EE`, one red-orange accent `#D9533F` (measured), lime
  `#E2FC91` and yellow `#FC0` in the CSS, and periwinkle `#8082F8` (Awwwards' listed
  colour) on stickers and cards. Tilted service cards carry **big pixel-art cursor
  and hand icons**. Rotated sticker badges sit on headings. Huge condensed marquee type.
- **Buttons press like keys:** at rest `box-shadow: -3px 3px 0 #D9533F`; on hover
  `translate(-2px, 2px)` and the shadow shrinks to `-1px 1px 0`, over 0.3 s. This is the
  blocky "pop" in two properties.
- **Easing tokens** (a full Penner set in `:root`). The default is ease-out-quart
  `cubic-bezier(.25, 1, .5, 1)`. Pops use ease-out-back `cubic-bezier(.34, 1.56, .64, 1)`;
  exits use ease-in-back `cubic-bezier(.36, 0, .66, -.56)`. Thumbnails scale in from `.7`
  over `.6s`. Cards "breathe" by `translate: 0 -0.15em` over 5 s. The "from folder" entrance
  is 2 s `cubic-bezier(.36, .66, .04, 1.44)`.
- **Page transitions:** cross-document view transitions with named groups (`header`,
  `page-title`, `main`, `selected-work`). The old view fades out in 0.3 s, the new one
  settles in 0.5 s, and the title leaves with ease-in-back and enters with ease-out-back.
- **Scroll-driven:** `animation-timeline: view()` with `animation-range: entry 100lvh
  entry 150lvh`, all wrapped in `@supports` and `prefers-reduced-motion: no-preference`.
  That feature query appears 61 times in the stylesheet.
- **Borrow:** the key-press button, pixel icons as big friendly shapes, sticker tilt, the
  view transition split (out 0.3 s, in 0.5 s).

### Cozy Eating Village: pixel icons and stepped motion

https://www.cozyeating.app/ · Awwwards Honorable Mention, Aug 30, 2026 (7.63). A cosy pixel
cooking game with a recipe index.

- **Look:** cream cards `#FDF7E6` on a sky blue `#9FD5DE` with drifting pixel clouds.
  Photos are framed like polaroids. Each card has a row of tiny grey pixel ingredient icons
  and category chips with hard outlines. All type is **Silkscreen** (OFL).
- **Motion is stepped, like sprites:** `transform .16s steps(3)`, `opacity .18s steps(2)`,
  a bob of `1.6s steps(4)`, a glint of `5.4s steps(4)`, a puff of `2.8s steps(6)`, clouds
  `90s linear`, photos in `.38s ease-out`, and hover lifts `.26s cubic-bezier(.22,.61,.36,1)`.
- **Borrow:** `steps()` timing for anything pixel (icons, glints, counters), so pixel
  things move like pixel art while the layout moves smoothly; polaroid-style framing.

### Design Bomb Festival: the hyperpop dose

https://www.designbomb.it/ · Awwwards Nominee, Sep 11, 2026 (7.40). By The Wave, built in
Framer.

- **Look:** near-black `#141414` and warm white `#F7F6EB` carry the page. Hyperpop colour
  lives in pill chips and stickers: hot pink `#FF3EBA`, acid lime `#CEFF00`, electric blue
  `#4A60FF`, green `#31A362` (measured). Also starbursts, a googly-eyed mascot, a sticker
  pile in the footer, and a heavy italic display face.
- **Why it isn't chaotic:** the loud part is concentrated in two places (a scrolling chip
  marquee and the footer sticker pile). Speaker lists and forms are plain.
- **Borrow:** the sticker and starburst vocabulary for the floating layer, and
  concentrating the loudness in one strip per page. **Don't borrow** the all-caps italic
  everywhere.

### Playdate: cute hardware energy, pixel icons in the UI

https://play.date/ · not an award winner that could be verified. Widely praised (One Page
Love feature for the original teaser). Included for the pixel-icon UI.

- **Look:** a yellow body `#FFC500` (measured; `--brand-yellow: #ffc833` in CSS), deep
  violet `#7700FF`, charcoal `#212223`. Every nav label has a **tiny chunky one-colour
  icon** before it, some of them pixel-stepped (the Dev grid, the Sign In stamp). The spec
  table uses flat yellow icons (battery, CPU chip, wifi, speaker) at label size.
- **Motion:** decorative blobs float with `blobble` at 3.5 s, 4.5 s and 5 s
  `ease-in-out`: three different periods, so they never sync. Buttons use `transform .15s`
  and `.3s ease-in-out`.
- **Borrow:** icons as label prefixes (nav, chips, spec rows), in our case pixel ones;
  co-prime float periods.

### Messenger (abeto): calm cute

https://messenger.abeto.co/ · Awwwards Site of the Day, Nov 10, 2025 (7.92), Dev Award
8.21.

- **Look:** one soft teal field `#65C1BC` (measured; Awwwards lists `#81BFBC`, `#C9D5C3`),
  a tiny planet, a blocky stencil logotype, and one small yellow "BEGIN" plate. Almost
  nothing else on screen.
- **Borrow:** the proof that one field colour, lots of empty space and one small warm
  button reads as cute and calm. It fits the canon's stillness for the world too.

### Nala Kun: an artist's gallery that moves

https://nalakun.com/ · Awwwards Nominee, Sep 22, 2026 (7.42). An artist portfolio, built
with GSAP and Webflow.

- **Look:** lavender field (`#D1C9FB` to `#BFB2FB`, `#622AEB` in CSS variables), paintings
  shown hanging in gallery-room scenes, an "infinite canvas" gallery, and small thumbnails
  floating around a huge name in the footer.
- **Motion:** reveals use `opacity, filter, transform .8s ease` (a blur-up). The arrow
  floats 1.35 s `cubic-bezier(.45,0,.55,1)`. A "Coming soon" badge spins in 12 s.
- **Borrow:** framing art as objects in a space rather than as grid cells, and scattered
  thumbnails around big type. **Skip** the blur on large layers (expensive on mid-range
  Android).

### Warm & Fuzzy: one curve for everything

https://warmnfuzzy.tv/ · Awwwards Site of the Day, Sep 12, 2026 (7.26), Dev Award 7.52. By
Neutral Studio.

- **Look:** full-bleed colourful video; not our layout.
- **Motion system worth copying:** almost everything uses **one curve,
  `cubic-bezier(.26, 1, .48, 1)` at `.5s`** (17 declarations). Opacity is a separate, much
  faster `75ms linear`, so elements appear immediately and then settle. Reveals are
  CSS scroll-driven (`scroll-reveal`, `animation-timeline`), and `prefers-reduced-motion`
  appears 29 times.
- **Borrow:** one house curve plus a fast opacity; that consistency is most of the polish.

### Caffè Design: springy pops that feel friendly

https://www.caffe.design/ · Awwwards Site of the Day, Jun 18, 2025 (7.57); its Dev Award
scored Animations/Transitions 9.20.

- **Look:** a 3D studio in pink `#FFB3D4` and electric blue `#3F18FF`, a sticker mascot,
  sparkle markers you click, and a pixel font (Argent Pixel CF, commercial) next to a clean
  grotesk.
- **Motion:** the pop curve is `cubic-bezier(.34, 1.6, .4, 1)` over `.3s`, a stronger
  overshoot than Cyd's.
- **Borrow:** the sparkle marker as a "you can click this" glyph; the pixel font plus
  grotesk pairing.

### Checked and set aside

Each of these was captured and rejected for this brief. PX PUSH (SOTD Aug 2026) is retro
CRT corporate, not cute. basement.studio (SOTD Apr 25, 2025) is dark and dense.
KidSuper World (SOTD Jan 9, 2024) is painterly 3D. The Tie-break (SOTD Sep 25, 2026) is a
WebGL game. Gallery Play, VIZZ, loehx and Bou are dark or corporate.

## 3. Palette for dex.place

The Endfield base with its accents, plus three pale tints for the floating layers (the
cute part), each checked for WCAG AA. Ratios are WCAG contrast ratios: 4.5 or more is
needed for body text, 3 or more for large text (24 px, or 18.66 px bold) and UI outlines.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `paper` | `#FFFFFF` | page | |
| `paper-2` | `#FAFAFA` | alternate sections | ink 16.84 |
| `panel` | `#F2F2F2` | cards, value chips | ink 15.71, muted 4.55 |
| `chip` | `#E6E6E6` | category chips | ink 14.09 |
| `line` | `#D9D9D9` | rules, pager track (decorative; 1.41 on white, so never the only boundary of a control) | |
| `ink` | `#191919` | text, outlines, hard shadows | 17.58 on white |
| `ink-2` | `#35373C` | secondary headings, icon tiles | 11.91 |
| `muted` | `#6E6E6E` | the lightest allowed text on white or `paper-2` | 5.10 / 4.89 |
| `night` | `#0A0B0F` | one dark band per page at most | white 19.67, yellow 17.73, mint 14.82, magenta 5.62 |
| `yellow` | `#FFFA00` | signature blocks, bands, active states. **Fill only** | ink on it 15.85; as text on white 1.11 (never) |
| `yellow-tint` | `#FFFDBD` | far background blocks | ink 16.7 |
| `magenta` | `#FF1AAC` | strip, stickers, donate accent. **Fill** | ink on it 5.02; white on it 3.50 (large text only) |
| `magenta-text` | `#C8007F` | magenta as text or link on white | 5.58 |
| `magenta-tint` | `#FFD6EE` | far background blocks | ink 13.48 |
| `mint` | `#00FFA2` | strip, success, downloads accent. **Fill only** | ink on it 13.25; as text on white 1.33 (never) |
| `mint-text` | `#007A4D` | mint as text on white | 5.40 |
| `mint-tint` | `#C9FFE8` | far background blocks | ink 15.87 |
| `cyan` | `#32FEE3` | rare fourth accent (dates, "new") | ink on it 13.75 |
| `periwinkle` | `#3B5BD0` | optional text-safe cool accent (links on white) | 5.84 on white; ink on it only 3.01 |

Rules that keep it calm:

- **Proportions per screen:** roughly 60 to 70% white or pale surfaces, 15 to 25% ink, and
  one accent at about 10%. The second and third accents together stay under about 3%,
  except inside the three-colour strip. This matches Endfield's measured sections and
  lands close to Dex's own white/black/accent profile (`aesthetic-profile.json`).
- **One lead accent per section**, reversible, for example: projects yellow, downloads
  mint, docs/blog yellow header band, donate magenta, gallery **neutral** (white mats and
  ink frames, so Dex's art is the only colour there).
- **Text on an accent is always ink.** Accents are never text on white; use the `-text`
  variants.
- **The three-colour strip** (magenta, yellow, mint, equal thirds, 4 to 6 px tall) is the
  one place all three appear together.

## 4. Type

The `dex` mark in Daniel is a thin, tall, handwritten stroke. It needs a sturdy geometric
partner with the opposite qualities: wide, heavy and machine-made. A pairing sheet rendered
in Edge on 2026-09-29 compared Archivo (wdth 125), Anybody (wdth 140), Mona Sans (wdth
125), Krona One and Unbounded against the mark, with Silkscreen and Pixelify for pixel
labels and Space Grotesk versus Plus Jakarta Sans for body text.

| Role | Font | Why | Latin woff2 (Fontsource 5.3.0) |
|---|---|---|---|
| Mark | **Daniel** (`public/fonts/Daniel-Regular.otf`) | canon; the word `dex` only, nothing under it | 64.6 kB OTF (license forbids modified copies; see TECH-PLAN) |
| Section titles, big background words | **Anybody Variable**, `font-stretch` 130 to 150%, weight 750 to 850, caps | the closest OFL match to Novecento Wide's chunky wide caps, and rounder (cuter) than Archivo or Mona Sans; has a Vietnamese subset | 55.6 kB (wdth + wght); Vietnamese 15.1 kB via `unicode-range` |
| Body, UI, docs, forms, bank details | **Space Grotesk Variable** 400 to 700 | Endfield itself loads it; the old site used it; techy but readable at 17 px / 1.6; tabular figures for amounts | 21.8 kB; Vietnamese 6.6 kB |
| Pixel micro labels, counters, chips | **Silkscreen** 400 | proven on Cozy Eating; tiny; set at 12 or 16 px (its native grid is 8 px) with 0.06em tracking | 8.2 kB |
| Pixel headings (optional) | **Pixelify Sans Variable** | if a heading should be pixel rather than wide; canon allows pixel fonts for headings | 11.7 kB |
| Code, SHA-256 | system monospace stack | 0 kB; add JetBrains Mono (39.5 kB) only if docs need ligature-free code at size | 0 kB |

All of these except Daniel are OFL-1.1 and install from npm (`@fontsource-variable/anybody`,
`@fontsource-variable/space-grotesk`, `@fontsource/silkscreen`,
`@fontsource-variable/pixelify-sans`). Vite fingerprints and self-hosts them, so there are
no runtime requests. `TECH-PLAN.md` currently proposes the system UI stack for body text
(0 kB). Space Grotesk costs 21.8 kB and buys the Endfield feel. Either works; this file
recommends Space Grotesk.

Alternatives if Dex reacts against Anybody: **Krona One** (10.2 kB, a single weight, wide
and calmer, closest to Endfield's lighter caps) or **Archivo** (wdth 125, 88 kB, more
neutral).

Type scale: headings step in multiples of 1.125 like Endfield's (for example 12, 14, 16/17
body, 20, 27, 36, 54, 72, and a background word of clamp 120 to 280 px). Section titles use
caps with +0.01em tracking; huge background words go down to -0.06em. Body is 17 to 18 px,
1.6 to 1.65 line height, 60 to 70 characters per line.

## 5. Motion spec

The numbers to build with. Each row says where the value was measured.

### Easing tokens

| Token | Value | Source | Use |
|---|---|---|---|
| `--ease-out` | `cubic-bezier(.25, 1, .5, 1)` | Cyd (ease-out-quart; Warm & Fuzzy's `.26,1,.48,1` is nearly the same) | the house curve: reveals, settles, most transitions |
| `--ease-pop` | `cubic-bezier(.34, 1.56, .64, 1)` | Cyd ease-out-back (Caffè uses a stronger `.34,1.6,.4,1`) | things that pop in: buttons, tiles, stickers, glyphs |
| `--ease-in-back` | `cubic-bezier(.36, 0, .66, -.56)` | Cyd | exits that wind up first (leaving page title) |
| `--ease-move` | `cubic-bezier(.65, 0, .35, 1)` | Cyd (ease-in-out-cubic) | moving an object between two places: gallery FLIP, lightbox |
| `--ease-swoop` | `cubic-bezier(.6, 0, 0, 1)` | Dropbox nav | panels, menus, the mobile sheet |
| `--ease-wipe` | `cubic-bezier(1, 0, .7, 1)` | Endfield loader | colour-block wipes only |
| `--ease-std` | `cubic-bezier(.4, 0, .2, 1)` | Dropbox tiles | colour swaps on hover |
| `--ease-float` | `cubic-bezier(.37, 0, .63, 1)` | Cyd (ease-in-out-sine) | idle drifting, alternating |
| pixel steps | `steps(2)` to `steps(6)` | Cozy Eating | anything drawn in pixels |

### Durations and choreography

| Motion | Numbers | Source |
|---|---|---|
| Hover colour or background swap | 150 to 200 ms, `--ease-std` | Endfield 0.2 s; Dropbox 0.35 s |
| **Button pop (the blocky key)** | rest: 2 px ink border, `box-shadow: 4px 4px 0 ink`. Hover (fine pointers): `translate(-2px, -2px)`, shadow `6px 6px 0`, 200 ms `--ease-pop`. Press: `translate(3px, 3px)`, shadow `1px 1px 0`, 80 ms `--ease-out`. The inner pixel glyph nudges 2 px right with `steps(2)` over 120 ms | Cyd's offset-shadow press (0.3 s); Caffè's overshoot |
| First appearance of buttons, chips, stickers | `scale(.6) → 1` plus opacity, 420 ms `--ease-pop`, 50 ms stagger | Cyd scale-in from .7 over .6 s |
| Scroll reveal of text and cards | `translateY(24px) → 0` over 700 ms `--ease-out`; opacity 0 → 1 in 120 ms linear (appear fast, settle slow); stagger 60 to 80 ms, at most 6 items (about 450 ms total) | Warm & Fuzzy's 75 ms opacity plus 0.5 s transform; Nala Kun 0.8 s |
| Section colour-block wipe | `scaleX(0 → 1)` from the left, 600 ms `--ease-wipe`; content follows 250 ms later | Endfield loader: 0.6 s, but after a 0.5 s delay, compressed here |
| Three-colour strip draw-in | each third `scaleX(0 → 1)` over 500 ms `--ease-out`, 80 ms apart | Endfield section entrance |
| Glyph flicker-in (small glyphs only, once) | 480 ms: opacity `0 → .5 (20%) → 0 (22%) → .5 (40%) → 0 (42%) → 1` | Endfield `flashing`, 1 s, compressed |
| Page transition (cross-document view transition) | old out 200 to 300 ms `--ease-in-back`/fade; new in 400 to 500 ms `--ease-out`; total no more than 600 ms | Cyd: 0.3 s out, 0.5 s in |
| Gallery open/close (FLIP or view transition) | 450 to 550 ms `--ease-move`; backdrop fade 250 ms; close 400 ms; next/prev slide 300 ms | FLIP convention; Cyd's thumb group |
| Idle float (background layers) | translate plus or minus 6 to 14 px and rotate plus or minus 2 to 4 degrees, alternating, `--ease-float`, periods 5.3, 7.1, 9.7 and 11.3 s (co-prime so shapes never line up) | Playdate `blobble` 3.5/4.5/5 s; Cyd `breathe` 5 s |
| Pixel idle (glint, bob) | bob 1.6 s `steps(4)`, 2 px per step; glint every 5.4 s `steps(4)` | Cozy Eating |
| Marquee (if any) | 20 to 40 s linear; pauses on hover and focus | Design Bomb, Cyd |

### Floating layers

- **Three depths.**
  - Far: 2 to 4 large pale tint blocks, 120 to 320 px, square or stepped shapes.
  - Mid: up to 6 ink-outlined blocks, `+` crosshairs, dot grids and strip fragments.
  - Near: up to 6 pixel stickers of 24 to 48 px (stars, sparkles, cursors, small section
    icons).
  - That's roughly a dozen shapes per viewport, fewer on phones.
- **Depth response:**
  - Scroll parallax factors: far 0.04, mid 0.08, near 0.14.
  - Cursor parallax on fine pointers: at most 4, 8 and 14 px, smoothed with a lerp of 0.1
    per frame.
  - Transform only, `pointer-events: none`, paused off screen and when the tab is hidden.
- **Entrance:** blocks pop from `scale(0) → 1.08 → 1` over 500 ms `--ease-pop` when their
  section enters, staggered 90 ms.
- **Never behind text.** Floating shapes sit in the margins and gutters around the content
  column, not under it.

### Gallery interaction ("stuff transforms, shrinks and grows")

- **Collage:** a dense CSS grid (6 to 12 columns). Pieces span 2 to 5 columns and are tilted
  -2 to +2 degrees. Each piece sits in a white mat (8 to 12 px) with a 2 px ink border and
  a hard offset shadow block. There are no titles; alt text stays.
- **Proximity:**
  - On fine pointers, the piece under the cursor grows to 1.06 to 1.08 and its neighbours
    shrink to 0.96 to 0.97, over 350 ms `--ease-out`.
  - A proximity falloff (for example over 300 px) makes nearby pieces lean slightly
    toward the cursor.
  - `:has()` can do the basic grow/shrink in CSS alone.
- **Open:** the piece travels from its collage slot to a centred focused view (FLIP or a
  same-document view transition, 500 ms `--ease-move`). The rest of the collage recedes
  (scale 0.94, opacity 0.35).
  - A Silkscreen counter reads `03 / 09`.
  - Arrow keys go next and previous. Esc and the back button close it and return the piece
    to its slot.
  - Each piece also has its own shareable URL (see TECH-PLAN).
- **Touch:** tap opens; no hover effects.
- **Reduced motion:** instant swap or a 120 ms crossfade.

### Reduced motion and support

- Under `prefers-reduced-motion: reduce`, remove translation, scale, flicker, parallax,
  floats and marquees. Keep opacity fades of 150 ms or less, or none. Turn page view
  transitions off or make them a plain crossfade.
- Content is visible by default. Reveal classes only apply when JS runs (TECH-PLAN's
  `html.js` rule).
- Browser support for view transitions and scroll-driven animation is in TECH-PLAN's table.
  Sources disagree on when Samsung Internet shipped cross-document view transitions. Treat
  them strictly as progressive enhancement and confirm on Dex's phone. Safari has had
  scroll-driven animation since 26.0 and runs it off the main thread since 26.4, per
  WebKit's release notes. Firefox still lacks it, so gate it with `@supports`.

## 6. Pixel icons and coloured glyphs

- **Grid:** 12 x 12 for inline icons (drawn at 24 px, 2x) and 16 x 16 for feature icons
  (32 or 48 px). Always integer scaling and `shape-rendering="crispEdges"` (TECH-PLAN's
  `pixels.ts`: grid data to one SVG path per colour).
- **Palette per icon:** ink outline plus one accent fill plus one white highlight pixel.
  That keeps them cute and consistent. Tint the fill by section (yellow, mint, magenta).
- **Set to author first:** download arrow, window/app, book (docs), quill or page (blog),
  frame (gallery), heart or coin (donate), QR, copy, external link, sparkle, star, cursor
  hand, `+` crosshair, `↘` arrow, a "new" burst.
- **Glyph vocabulary from Endfield, with real content:**
  - `//` before section names;
  - `[ ]` around the current item;
  - `▽` bullets;
  - counters like `03 / 09` and versions like `v0.1.0`;
  - file facts like `634.7 MiB` and `sha256 3f2a…`;
  - the three-colour strip and dot grids as pure decoration.
- **Coloured glyphs:** a glyph can sit in a small square tile. Use an ink tile with a white
  glyph, a yellow tile with an ink glyph, or a mint tile with an ink glyph (Endfield's
  icon tiles).

## 7. Do and don't: cute and colourful, not chaotic

Do:

- Keep one lead accent per section and let white dominate.
- Put all saturated colour in flat blocks with ink text on top.
- Use square corners, 2 px ink outlines and hard offset shadows; the only circles are icon
  buttons.
- Use pixel icons for personality, drawn in code and animated with `steps()`.
- Keep the loud stuff in one place per page (a strip, a sticker cluster, a band).
- Use one house curve, fast opacity and a small, consistent overshoot for pops.
- Make micro labels real information, 12 px or larger, and at least `#6E6E6E` on white.
- Give floating layers slow, co-prime periods, keep them out of the reading column, and cap
  them at about a dozen per screen.
- Give every animated state a static equivalent (reduced motion, no JS).
- Frame Dex's art in neutral mats so it's the only colour in the gallery.

Don't:

- Don't set neon (yellow, mint, cyan) text on white, or white text on yellow.
- Don't use gradients, glassmorphism, big blurs, drop shadows with blur radius, or glow
  everywhere. One exception: a single soft glow on dark bands, as Endfield uses sparingly.
- Don't hijack scrolling, snap full screens, or fake loading delays.
- Don't use pseudo-technical filler, taglines, "solo dev" or sales copy (canon).
- Don't put more than two accents in a component, or all three outside the strip.
- Don't use bouncy springs on reading content. Overshoot is for buttons, chips and
  stickers only.
- Don't run infinite animations inside the reading column.
- Don't play autoplay video or 3D on the website layer.
- Don't use Dex's art as a decoration, background or texture anywhere outside the gallery
  (canon).
- Don't embed third-party reference images in this repo. They live in `review/`.

## Sources

Arknights: Endfield
- https://endfield.gryphline.com/en-us (captured 2026-09-29; home, `/en-us/news`, mobile)

Reference sites and their award pages
- https://brand.dropbox.com/ · https://www.awwwards.com/sites/dropbox-brand ·
  https://www.cssdesignawards.com/wotm/dropbox-brand/46960/ ·
  https://www.awwwards.com/websites/sites_of_the_month/
- https://cydstumpel.nl/ · https://www.awwwards.com/sites/cyd-stumpel-portfolio-2025
- https://www.cozyeating.app/ · https://www.awwwards.com/sites/cozy-eating-village
- https://www.designbomb.it/ · https://www.awwwards.com/sites/design-bomb-festival
- https://play.date/ · https://onepagelove.com/playdate
- https://messenger.abeto.co/ · https://www.awwwards.com/sites/messenger
- https://nalakun.com/ · https://www.awwwards.com/sites/nala-kun
- https://warmnfuzzy.tv/ · https://www.awwwards.com/sites/warm-fuzzy
- https://www.caffe.design/ · https://www.awwwards.com/sites/caffe-design
- Set aside: https://www.awwwards.com/sites/px-push ·
  https://www.awwwards.com/sites/basement-studio-3 ·
  https://www.awwwards.com/sites/kidsuper-world ·
  https://www.awwwards.com/sites/the-tie-break
- Awwwards lists used to find them: https://www.awwwards.com/websites/sites_of_the_day/ ·
  https://www.awwwards.com/websites/colorful/ ·
  https://www.awwwards.com/inspiration_search/pixel/

Fonts and platform support
- Fontsource API and packages (licence, subsets, axes, file sizes):
  https://api.fontsource.org/v1/fonts/anybody and the `@fontsource(-variable)` packages
  listed in section 4
- WebKit, Safari 26.0 and 26.4 feature notes (scroll-driven animations):
  https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ ·
  https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- Cross-document view transitions support: https://caniuse.com/cross-document-view-transitions
