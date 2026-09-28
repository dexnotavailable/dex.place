# Character reference breakdown

What each reference image is for, what it measures at its real pixel size, and what it tells us
to build. Companions: `QUALITY-RUBRIC.md` (the ref-level bar for each A/B dimension) and
`CRITIQUE-PARAMS.md` (the full critique checklist).

The references are other people's art. They live only on Dex's machine in
`review/refs/character/` (git-ignored) and are never committed. This file names them by
filename and never embeds them.

Tags used below:

- **[M]** measured: by script or with a pixel ruler on the native-size image.
- **[S]** sourced: text printed on the image itself, or an outside source.
- **[I]** inference: our reading, opinion or proposal. Treat as a claim to test.

## The short version

1. **Only one reference is drawn at our target size.** The fighter in
   `05-anim-sailormars-sheet.webp` stands about 95 native px tall, almost exactly our 96 px
   working target. At that size her head is 14–15 px, each eye is about 2 px and the mouth is
   1 px. [M]
2. **The refs with the faces and finish Dex is pointing at (07, 08, 09) are much bigger:** 137–158
   px tall with 24–25 px heads. At 96 px we get roughly 16 px of head at the same body
   proportions, so we can't copy their face detail pixel for pixel. Either the character grows
   toward about 128 px, or the in-game face is simplified the way 05 does it and a hi-res
   portrait carries expression. This is the biggest open decision the refs raise. [M, I]
3. **Body proportion for the "AAA gacha" look is 5.5–6.5 heads tall** (04, 07, 08, 09, 10).
   01 (about 4 heads) is chibi and 06 (about 3) is tiny; neither is the body target. [M]
4. **Outlines:** the cleanest refs use a full 1 px outline in a tinted near-black (dark plum in
   01, blue-black in 07/08) with lighter coloured lines inside the shape. 05 uses coloured
   outlines (purple on hair, brown on skin). No character ref uses pure black lines except 13,
   whose whole palette is black/white/red by design. [M, visible]
5. **Shading is 3–4 bands per material, with hue-shifted shadows.** White cloth is shaded with
   cool lavender-grey (01, 05), never neutral grey. That matters because our outfit is mostly
   white. [M]
6. **Palettes are small.** In 01, 18 colours cover 95% of the figure; in 06, 12 colours cover
   95% of the whole scene. [M]
7. **The effects Dex prefers (11, 12) are 3–4 times the character's height wide.** The pixel
   attack refs (06–10) only reach 0.8–1.75 times. So our effects need to be about 2–3 times
   wider than the pixel refs while keeping their pixel craft. [M]
8. **No pixel ref has a real rim light.** Rim light is Dex's requirement beyond the refs. 11 and
   12 show the nearest thing: the effect acting as the light source. [visible, I]
9. **None of the refs carry timing.** They are sheets and stills, not videos. We can read frame
   counts, key poses and how long a smear lasts in drawings, but durations have to come from
   somewhere else (MMD motion or mocap timing, then tuned by A/B at real speed). [M]

## How the measurements were made

**Pixel grid.** "Pitch" means how many image pixels make up one art pixel. Three checks:

1. *Run lengths.* Lengths of horizontal and vertical runs of the same colour (with a small
   tolerance for compression noise). For an upscale of 4, runs cluster on 4, 8, 12...
2. *Comb spectrum.* Where the colour changes, column by column and row by row. We test every
   candidate period from 1.2 to 30 px in 0.005 px steps and score how strongly the changes line
   up on that period (1.0 = every change on the grid, 0 = no grid). This finds non-integer
   pitches too.
3. *Reconstruction.* Downscale by the pitch (nearest neighbour, centre of each cell), scale back
   up, and compare with the original. The number is the mean difference per channel on a 0–255
   scale. As a control the same test runs with a deliberately wrong pitch (x1.07), which has to
   come out clearly worse.

**Character height.** Read by eye on the native image with a 5/10 px ruler overlay, from the top
of the skull (not ears, buns, horns or hats) to the sole, ±2 px. Head = skull top to chin.
Heads tall = height ÷ head.

**Palette size.** Colours are grouped when every channel is within 16 of the group's seed
colour, most common colours first; background is excluded. We report how many groups cover 95%
of the figure's pixels. Lossy WebP and resampling inflate this count, so it's only really
meaningful for 01, 02, 03 and 06.

**Colour ramps.** Saturated pixels sampled from the effect area and sorted dark to light.

**Scripts** (local, git-ignored with the refs): `review/refs/character/native/_pitch.py`,
`_runs.py`, `_downscale.py`, `_palette.py`, `_bbox.py`, `_ruler.py`. Running
`python native/_downscale.py` from `review/refs/character/` rebuilds every native file below.

## Native-grid copies

All in `review/refs/character/native/`. The originals are untouched. Use these for A/B sheets so
refs and our work share one pixel size.

| File | Made from | Pitch used | Size |
|---|---|---|---|
| `01-style-catgirl-shrine_native-p4.png` | whole image | 4 | 170×170 |
| `02-style-bunny_native-p8.png` | whole image | 8 | 72×128 |
| `03-style-blonde_native-p8.png` | whole image | 8 | 72×128 |
| `04-style-grid9_native-p2.158.png` | whole image | 2.158 (resampled source, approximate) | 341×500 |
| `05-anim-sailormars-sheet_1x.png` | lossless copy | 1 (already native) | 942×1467 |
| `06-anim-domesticfox-slash_native-p7.5.png` | whole image | 7.5 | 160×90 |
| `07-anim-amberowl-wrench_top_native-p2.png` | top panel (y 0–560) | 2 | 400×280 |
| `07-anim-amberowl-wrench_bonus-originalsize_1x.png` | bottom "original size" panel | 1 | 800×240 |
| `08-anim-amberowl-lys-lightning_top_native-p2.png` | top panel (y 0–560) | 2 | 400×280 |
| `08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png` | bottom "original size" panel | 1 | 800×240 |
| `09-anim-amberowl-katana-cats_1x.png` | lossless copy | 1 (already native) | 880×440 |
| `10-anim-sword-smear-sheet_1x.png` | lossless copy | 1 (already native) | 900×640 |
| `13-enemies-red-black-white_approx1x-resampled.png` | lossless copy | grid not recoverable; roughly 1x | 736×414 |

11, 12 and 14 are painted, not pixel art, so they have no native grid.

## Summary table

The pitch column says how confident we are that the grid is right. The palette column is the
number of colour groups covering 95% of the figure. A dash means it can't be measured.

| Ref | Job | Pitch (confidence) | Height, native px | Head px / heads tall | Outline | Palette (95%) |
|---|---|---|---|---|---|---|
| 01 | pixel style, cleanest craft | 4 (high) | ~118 | ~30 / ~4 | full, dark plum | 18 |
| 02 | style mood | 8 (high) | ~72 | ~14 / ~5 | dark, uneven | 27 |
| 03 | style, hue-shifted ramps | 8 (high) | ~115 | ~22 / ~5.2 | dark + warm coloured | 33 |
| 04 | style: HD gacha finish and proportion | 2.158 (medium) | 142–164 incl. hair/hats | ~21–23 / ~6–6.5 | full dark | – |
| 05 | animation phases, our exact size | 1 (high) | ~95 | ~14–15 / ~6.5 | coloured | – |
| 06 | attack feel, effect layering | 7.5 (high) | ~36–40 (action poses) | ~12–13 / ~3 | selective, no black | 12 (whole scene) |
| 07 | attack key pose, finish bar | 2 top, 1 bonus (high) | ~137 | ~24 / ~5.7 | full, blue-black | ~36* |
| 08 | skill key pose, called strike | 2 top, 1 bonus (high) | ~150 | ~25 / ~6 | full, blue-black | ~31* |
| 09 | 4-frame attack, themed trail | 1 (medium-high) | ~158 | ~25 / ~6.3 | dark, light on white hair | ~40* |
| 10 | smear shapes and decay | 1 (medium-high) | ~120 | ~22 / ~5.5 | dark | – |
| 11 | wide AOE arcs | painted | ~80 (silhouettes) | – | none (silhouettes) | – |
| 12 | skill escalation, ground work | painted | ~60 | – | – | – |
| 13 | enemy style | not recoverable (low) | ~113–136 incl. crowns | – | none; black mass | 23* |
| 14 | outfit | painted | – | – | – | 4 chips |

\* inflated by compression; the real palette is smaller.

---

## 01-style-catgirl-shrine.png

**Job:** pixel **style**, and the cleanest pixel craft in the set. Clean colour clusters, a
readable face with expression portraits, and a white-and-pink shrine outfit with detached flared
sleeves. That makes it the closest costume cousin to 14.

- **Grid [M]:** pitch 4.000 on both axes. Comb score 0.99 / 0.98, runs cluster on multiples of 4,
  reconstruction 1.41 against 10.06 for the wrong-pitch control. High confidence. Native canvas
  170×170.
- **Size [M]:** about 118 px from skull to sole (about 130 to the ear tips). Head about 30 px, so
  about 4 heads tall. Chibi.
- **Outline [M]:** a full 1 px outline in dark plum (#200d23), not black. Lines inside the shape
  use darker local colours: hair in dark brown (#4b2e33, #8a5c5c), pink cloth in #792e42.
- **Shading [M]:** flat light from the front-left. Skin has 3 bands (#ffe2cd, #ffc9bd, #ffb5ac)
  plus blush. Hair has 4 (#dfc7ad, #c9af98, #ad8579, #8a5c5c). White cloth has 3 (#ffffff,
  #c5c1d0, #a69eb5), with the shadows going lavender. Pink cloth has 4 (#fdbdbe, #dd919e,
  #b86883, #792e42).
- **Palette [M]:** 18 groups cover 95% of the figure and 31 cover 99%, so about 24–32 working
  colours. [I]
- **Rim / back light:** none. The ground shadow is a flat single-colour ellipse (#a69eb5).
- **Face [visible]:** each eye is about 4 px wide and 5 px tall. It has a 2-row dark lash on
  top, a two-tone iris (mid blue above bright cyan, #36d8ef / #49dcee) and a 1 px white highlight
  at the top of the iris. No lower lash. The open mouth is 3×2 px dark red with a pinker tongue,
  there are 2–3 pink blush pixels under each eye, and there's no nose. The three portraits (wink,
  pout, sleepy) are at the same scale.
- **Hair [visible]:** long wavy hair drawn as 5–7 big ribbon-shaped clumps with S-curves; the tips
  taper to 1 px. The lines between clumps are one step darker than the shadow colour, not the
  outline colour. A flower ornament breaks the silhouette at the crown.
- **Take:** clean clusters, white shaded with lavender, the logic of how the face is built, the
  sleeve shape. **Avoid:** the 4-head body.

## 02-style-bunny.png

**Job:** style **mood**: white hair, red eyes, a black bodysuit, dark costume against skin.

- **Grid [M]:** pitch 8. Comb score 0.86, reconstruction 1.76 against 8.97. The grid itself is
  certain. Native 72×128.
- **Size [M]:** about 72 px from skull to sole (86 with the ears). Head about 14, so about 5 heads.
- **Outline [visible]:** near-black (#06050a) on the costume and a reddish brown on skin edges,
  applied unevenly.
- **Shading:** 2–3 bands, with uneven skin clusters. **Palette [M]:** 27 groups for 95% on a
  72 px figure, which is high for its size.
- **Rim:** none. **Face:** red eyes 2–3 px wide with a dark lash, a 1 px mouth, pink blush.
  **Hair:** short jagged spikes in 2 tones plus white.
- **Cleanliness [visible]:** stray red pixels float around the legs, and there's 1 px noise in
  the hair.
- **[I]** Stray pixels, uneven clusters and near-duplicate colours are typical of generated or
  auto-converted pixel images. We haven't verified where this one came from. Use it for mood and
  proportion only, not as the bar for cleanliness.

## 03-style-blonde.png

**Job:** style reference for **hue-shifted ramps**. The blonde hair runs yellow → orange → red →
purple at the tips, and the cape runs fire-orange to yellow. Also long legs and a black leotard.

- **Grid [M]:** pitch 8. Comb score 0.93 / 0.92, reconstruction 2.24 against 11.67. Native 72×128.
- **Size [M]:** about 115 px. Head about 22, so about 5.2 heads.
- **Outline [visible]:** black on the costume, dark maroon-brown on skin, and lighter warm
  red-brown lines inside the legs (selective).
- **Shading [M]:** skin in 3–4 steps from #ffe2ca to #df6244; hair in 4–5 steps across the hue
  shift. **Palette [M]:** 33 groups for 95%, 63 for 99%, so it's noisy.
- **Face:** blue two-tone iris with a highlight, dark lash, tiny mouth. **Hair:** long straight
  clumps with bright horizontal bands near the crown.
- **Take:** the hue shift. **Same caveat as 02 [I]:** some noise, so it isn't a cleanliness bar.

## 04-style-grid9.webp

**Job:** style target for **finish and proportion at rest**: nine HD-pixel gacha-style
characters with dense costume detail, weapons and full-body proportions. It's the closest ref to
"AAA gacha in 2D" standing still.

- **Grid [M]:** pitch about 2.158, which isn't a whole number. The same period (2.158–2.1595)
  shows up in three separate regions with comb scores of 0.26–0.29. Reconstruction is 4.01
  against 6.74. Medium confidence. The image was resized for the web after being upscaled, so its
  edges are soft and the native copy is an approximation. Native about 341×500.
- **Size [M]:** figure bounding boxes are 142–164 px including hair and hats, and 111–129 in the
  bottom row. Heads are about 21–23 px, so roughly 6–6.5 heads.
- **Outline [visible]:** full dark outline. Some white-haired figures use a lighter selective
  outline on the hair.
- **Shading [visible]:** 3–5 bands per material. Stockings have a vertical sheen band, and black
  materials are glossy. **Palette:** can't be measured because of the resampling; visibly 40+.
  [I]
- **Rim [visible]:** occasional coloured edges on coat linings, but no systematic rim light.
- **Face [visible]:** with ~22 px heads, eyes are 3–4 px with a strong lash, a two-tone iris
  and blush.
- **Hair [visible]:** long hair in big S-curves with white-to-lavender ramps, twin tails with
  large curls.
- **Weapons [visible]:** big guns and a greatsword held at the hip, about as long as the body is
  tall.
- **Take:** body proportion, costume density, how stockings and gloss are treated, weapon scale.

## 05-anim-sailormars-sheet.webp

**Job:** **animation phases.** A complete ripped fighting-game move set, and the only ref drawn
at our target height. The sheet credits "ripping by roket" and thanks "Makron". [S] We haven't
identified the source game here.

- **Grid [M]:** already native (1x). There's no periodic structure (comb score 0.04 or less), and
  runs of length 1 account for 55% / 47% of pixels. Heavy lossy compression adds noise.
- **Size [M]:** about 95 px from skull to sole. Head about 14–15 px, so about 6.5 heads. Standing
  sprite cells are 31–40 px wide.
- **Outline [M, visible]:** coloured outlines: dark purple on hair (#200724 / #371434), warm
  brown on skin (#724534), dark red on the skirt. No black line.
- **Shading [visible]:** skin in 4–5 warm tones from peach to brown; hair in 4–5 purples with
  highlights running along the strands; the white top shaded in lavender-purple; the red skirt
  in 3–4. **Palette:** can't be measured (compression inflates it past 60).
- **Face [visible]:** with a ~14 px head, each eye is a 2 px dark lash with 1 px of light under
  it, the mouth is 1 px and there's no nose. The face reads through the hair around it and the
  two eye marks. **This is what a face at 96 px looks like unless we deliberately cheat the head
  size.**
- **Hair:** the hair takes up roughly 40–50% of the idle sprite's pixels [M: a purple-hue count
  that also catches some dark outline], and it carries most of the motion [visible]. It trails
  1–2 drawings behind the body and fans into 5–8 spikes on jumps and spins.
- **Rim:** none. **Effects:** there are no smears or effect sprites on this sheet. [I] In the
  game they were probably separate sprites.

**Drawings per row** [M: counted by column gaps, ±1 where hair overlaps; the move names are our
reading]:

| Row | Drawings | What it is |
|---|---|---|
| 1 | 17 | 13-drawing idle loop (breathing, hair sway), 2 stance variants, 2 poses in a school uniform (intro/win) |
| 2 | 15 | 7-drawing walk/turn, 3-drawing forward reach/jab, 5 hit reactions ending in a forward stagger |
| 3 | 9 | 6-drawing run cycle, 3-drawing dash into a thrust kick |
| 4 | 11 | 8-drawing knockdown (stagger, arch, airborne, floor, rise to kneel), 3 air-recovery drawings |
| 5 | 10 | standing high kick (2 wind-up, 2 at full extension, 1 retract), then 5 low lunge/turn drawings |
| 6 | 12 | jump kick (crouch, rise, tuck, 2 full-extension drawings in the air, 2 landing), 5 turn/idle |
| 7 | 13 | rising spin with the hair whipping up around the body (~10), 3 landing poses |
| 8 | 11 | air attacks: flying kicks, a tucked spin, a diving kick |
| 9 | 11 | 4 drawings knocked back through the air; 7 casting drawings (two arm thrusts, one with dust at the feet) |
| 10 | 12 | 7 hop/back-step drawings, 5-drawing walk |
| 11 | 13 | special poses: arm raised then pointing forward, two 4-drawing variants |
| 12 | 13 | taunts and win poses, 3 wind-blown bracing drawings, a defeated kneel |

That's about 147 drawings for one full character. [M]

**Key-pose patterns [visible]:**

- **Standing high kick (row 5):** 2 wind-up drawings (step, knee chamber), then 2 at full
  extension (the strike is held), then 1 retract. Anticipation is short, and the held extension
  is the contact.
- **Jump kick (row 6):** the floor shadow stays put and shrinks, which is what sells the height.
- **Rising spin (row 7):** the hair is the spectacle. Secondary motion is treated as the main
  event.
- **Casting (rows 9, 11):** arm thrusts with a single dust-puff drawing at the feet.

**Take:** the pixel budget at 96 px; how many drawings go to anticipation, contact and recovery;
hair lag; the shadow showing airtime. **Avoid:** its flat, dated facial detail and the lack of
smears.

## 06-anim-domesticfox-slash.png

**Job:** **attack feel**. One contact frame of a duel that shows how a slash, a trail and a spark
stack up, in a limited-palette scene. The watermark reads "DOMESTICFOX..." (partly legible). [S]

- **Grid [M]:** pitch 7.5 exactly (a non-integer upscale). Comb score 0.93 / 0.94, reconstruction
  1.82 against 4.75. Native 160×90, which is a 16:9 canvas a quarter the size of our 640×360.
- **Size [M]:** the characters are about 36–40 px in their action poses, with 12–13 px heads, so
  about 3 heads. Chibi.
- **Outline [M, visible]:** no black. Dark local colours (#484c6f, #5a4d5e) appear only on the
  shadow side, which is a selective outline.
- **Shading:** 2–3 bands per material. **Palette [M]:** 12 groups cover 95% of the whole scene,
  and 20 cover 99%.
- **Face:** the eyes are 1–2 px red dots, and the face relies on the hair shape.
- **Frames:** it's a single still, so there's nothing to count.
- **Effects** [M on the native grid, colours sampled]:
  - *Main slash:* a thin crescent 2–4 px wide with a white core and a cyan ramp at the tip
    (#729abd → #8ec1e0 → #9ceeea). It runs about 60 px, roughly 1.5–1.6 times the character's
    height, from the blade up and around the opponent.
  - *Trail:* pink ribbons (#f8b1ff) behind the lunging attacker with a white swirl inside, about
    70 px long (≈1.75x character height).
  - *Contact spark:* short radial white and lavender lines, 5–8 px, where the blades cross.
  - *Scene:* diagonal speed streaks behind, and a sloped floor.
- **Draw order [visible]:** trail behind the body, slash in front, spark on top.
- **Take:** that draw order, speed lines, how far a tiny palette can go.

## 07-anim-amberowl-wrench.webp

**Job:** **attack key pose and the finish bar** for HD pixel art. It shows idle against attack,
an oversized weapon, a smear crescent, ground scratches, a face sheet (normal, angry, happy) and
a palette swap. The watermark reads Amber Owl; the labels read "Melody Horizon" and
"BONUS: OriginalSize & ColorChange". [S]

- **Grid [M]:** the top panel has pitch 2 (comb 0.75 / 0.72, reconstruction 4.01 against 7.18),
  and the bonus panel is 1x. The downscaled top panel matches the bonus figures at the same size,
  which confirms both. Native top panel 400×280.
- **Size [M]:** the idle pose is about 137 px from skull to sole, with a ~24 px head, so about
  5.7 heads. The wrench is about 128 px long, roughly 0.93 times her height.
- **Outline [M]:** a full, consistent 1 px outline in blue-black (#100d0e, #1e1e2a), with dark
  lines inside the shape too.
- **Shading [M]:** 3–4 bands per material. The navy clothing runs #1e1e2a → #343442 → #444550 →
  #5f6067; the metal has 4 greys plus a white specular; the tan pads have 3.
- **Palette [M]:** 36 groups for 95%, inflated by WebP; realistically about 32–48. [I]
- **Rim:** none systematic. The smear is bright; the body isn't lit by it.
- **Face [visible]:** with a 24 px head, each eye is 4–5 px wide and 3 px tall: a 1–2 px lash
  that flicks outward, a 2 px iris in 2–3 amber tones and a 1 px highlight. Brows are 1 px angled
  strokes, the nose is a single shadow pixel and the mouth is 2–3 px. Bangs cross the eyes with
  dark separating lines.
- **Hair [visible]:** messy blue-black clumps 2–4 px wide in 3–4 tones with blue-grey highlights.
- **Attack frame [M sizes, sampled colours]:** her body is upside down over the wrench in an
  overhead vault-slam, an extreme pose. The smear is a crescent about 170 px tall (≈1.25x her
  height) and 25–30 px thick at its widest, with a white core, a pale blue edge and grey speed
  lines inside. Magenta ground scratches (#bb577d, #d03a7d) are X-shaped strokes 1–3 px wide in
  two clusters about 115 px across (≈0.85x). There's also a flat ellipse shadow.
- **Palette swap [visible]:** the bonus shows a green/white recolour in which the smear turns
  gold and the scratches cyan. The effects recolour along with the character.
- **Take:** the craft level to match on a big character, a pushed key pose, a smear with speed
  lines inside it, the ground-scratch decal.

## 08-anim-amberowl-lys-lightning.webp

**Job:** **skill key pose with a strike called down from the sky**: flash, bolt and ground burst,
plus a big spiked greatsword and a tail. The labels read "Lys", "Red Lightning",
"BONUS: OriginalSize" and "To Atelier951". [S]

- **Grid [M]:** the top panel has pitch 2 (comb 0.68 / 0.66, reconstruction 3.94 against 8.54),
  and the bonus panel is 1x. Native 400×280.
- **Size [M]:** about 150 px from skull to sole (the bun adds about 7). Head about 25, so about 6
  heads. The sword is about 168 px long, roughly 1.1 times her height.
- **Outline [visible]:** the same full blue-black outline. A 1 px white highlight runs along the
  blade edge, which makes the metal read as sharp.
- **Face [visible]:** eyes 4–5 px wide, an amber-yellow iris in 2–3 tones, a heavy lash and a
  highlight, a smirking mouth. Red and black strands cross the face.
- **Hair [visible]:** two-tone red and black strands, a ponytail, clumps 2–4 px with dark
  separators.
- **Effect layers** [visible; sizes and colours measured]:
  1. *Sky flash:* a white-hot core with red rays spreading about 130 px.
  2. *Bolt:* a jagged red column about 175 px long (≈1.15x her height), with a bright red core
     (#dc1315) inside crimson (#a41427).
  3. *Side shards:* jagged triangles in dark maroon (#721134) and violet-black (#2f1a44) on both
     sides.
  4. *Ground burst:* near-black radial spikes (debris) and a dark splash about 70 px wide at the
     impact point.
  5. *Hottest core:* peach-white (#f1b998).
- **Colour ramp [M]:** #030003 → #2f1a44 → #721134 → #a41427 → #dc1315 → #f1b998.
- **Take:** a dark-to-hot ramp, and dark shards framing the bright core so the effect still reads
  on a light background.

## 09-anim-amberowl-katana-cats.webp

**Job:** **an attack in 4 key frames**, plus a palette swap, a themed trail (a thorny ribbon and
petals), and a flowing robe and sleeves as secondary motion. The label reads
"おまけ：原寸・カラチェン" (roughly: bonus, original size, colour change), with a dedication. [S]

- **Grid [M]:** 1x. No periodic structure; runs of length 1 account for 47% / 40% of pixels. The
  edges are slightly soft, so it was probably resampled once. [I] Medium-high confidence.
- **Size [M]:** about 158 px from skull to sole (the ears add 8). Head about 25, so about 6.3
  heads.
- **Outline [visible]:** dark on the dark clothing; the white hair is edged in light grey instead
  (selective outline).
- **Shading [M]:** the red robe has 4–5 bands (#90374a, #a83548, #ca3440) with pink highlights
  (#ff9eb1) along the fold ridges, which is the closest thing to an edge light in the pixel refs.
- **Frames [M]:** 4 per colourway.
  1. *Idle:* sword held low.
  2. *Wind-up:* sword raised overhead and behind, body coiled, back half turned.
  3. *Strike:* the blade itself is drawn as one long bent red curve (the blade is smeared). A red
     ribbon 3–4 px wide traces the tip's path in a loop, with small thorn barbs; a dozen or so
     pink petals scatter; the hair whips sideways into long straight streaks; the sleeves and
     robe tails flare out.
  4. *Recovery:* sheathing the sword while the cloth settles.
- **Trail size [M]:** about 110×130 px (≈0.8x her height).
- **Colour ramp [M]:** #1f0007 → #48101a → #95242f → #a12836, with petals in #e195a7 / #ff9eb1.
  In the blue colourway the ribbon turns blue and the petals turn white.
- **Take:** the wind-up / strike / recovery poses; the bent-blade smear; particles that carry the
  character's own motif; sleeves and robe tails that make a pose wider. That last one maps
  straight onto the flared sleeves and tabard in 14.

## 10-anim-sword-smear-sheet.webp

**Job:** **smear shapes and how they decay** over frames, with origin markers. Two characters,
eight sequences.

- **Grid [M]:** 1x. No periodic structure; runs of length 1 account for 41% / 44%. WebP
  compression.
- **Size [M]:** the pink character's idle is about 120 px, with a ~22 px head, so about 5.5 heads.
- **Outline [visible]:** near-black outline, dark brown on skin edges. The green crosshairs and
  "+" marks are registration marks (origin and pivot points).
- **Drawings per sequence** [M counts; the labels are our reading]:

  | Sequence | Drawings | Content |
  |---|---|---|
  | left A | 4 | hop and leap wind-up with the sword overhead |
  | left B | 3 | lunge / kick, landing |
  | left C | 3 | stance → swing with the smear just starting at the tip → full C-shaped crescent around the crouched body |
  | left D | 3 | stance → full horizontal wedge smear → thinner, broken decay |
  | right A | 4 | running step, sword spin |
  | right B | 3 | full C-crescent → striped fragment → thin sliver |
  | right C | 4 | low stance → striped rising fragment → sliver → bowl-shaped low sweep |
  | right D | 4 | big crescent from above → sliver → sliver → recovery |

- **How a smear is built [visible]:** flat mint green in 2–3 tones: almost white at the leading
  edge where the blade is, mid mint in the body, darker at the tail. The leading edge is thick and
  crisp; the trailing edge tapers to a point. The C-shapes are hollow and wrap around the body.
- **How long a smear lasts [M counts]:** 1 drawing at full size, then 1–2 drawings where it
  splits into parallel stripes, then a 1–2 px sliver, then gone.
- **Size [M]:** C-crescents are about 150×120 px and horizontal wedges about 150 px wide, so
  1.3–1.5 times the character's height.
- **Take:** smear shape, the decay sequence, and marking an origin on every frame.

## 11-vfx-wide-arcs.png

**Job:** **wide area effects.** This is the width Dex wants. It's a painted concept, not pixel
art: nine silhouette poses with glowing arcs, plus one colour model.

- **Grid [M]:** none (no structure, comb score 0.07 or less).
- **Scale [M]:** the standing silhouettes are about 80 px tall.
- **Widths [M]:**

  | Effect | Size | Relative to character height |
  |---|---|---|
  | long horizontal slash (4th row) | ~340 px wide | ~4.2x |
  | rising crescent, top right | ~280×150 px | ~3.5x wide, ~1.9x tall |
  | crescent, bottom right | ~250×165 px | ~3x wide, ~2x tall |
  | middle rows | 190–240 px wide | ~2.4–3x |

- **Shape language [visible]:** crescents with a thick leading edge and a knife-thin tail. 2–4
  thin parallel arcs ride alongside the main one. Underneath, a ground layer of broken brushstroke
  dust in neutral grey spreads even wider than the arc. There are small flecks too.
- **Colour ramp [M]:** a violet tail (#a690ff) → periwinkle (#a1aae1) → pale cyan (#b1dff6) →
  near-white (#d6fcff) at the leading edge, with a soft bloom where the arc is densest. The dust
  runs #7c7c7e → #acacae on a #5c5c5c background.
- **Light [visible]:** the characters are pure dark silhouettes, so the effect is the only light
  in the image.
- **Take for pixel art [I]:** build each effect on a 4–5 step ramp; draw the glow as a stepped
  1–2 tone halo band rather than a soft gradient; always add the ground dust layer.

## 12-vfx-lol-skills.png

**Job:** **how a skill escalates** in stages (Q, W, E, R), and how effects meet the ground. It's
a League of Legends "Skills Exploration" sheet [S], painted, not pixel art.

- **Scale [M]:** the character is about 60 px tall.
- **Stages** [M counts, sizes and colours]:

  | Skill | Stages | What happens | Size |
  |---|---|---|---|
  | Q | 3 | neutral → single thrust with a red streak → triple thrust | streaks reach ~130 px past the body; ~2.2–3x overall |
  | W | 3 | neutral → red crescents rising around the body → a full spiked ring | ring ~85 px, ~1.4x |
  | E | 5 | spear pose → tall crescent from above → spin with a white swirl and ground splash → crescent wave with red spikes erupting from the ground → final crescent plus a field of ground spikes | final ~255 px wide, ~4x |
  | R | 6 | kneel → red eruption around a darkened target → ... → spiked red sphere with light pillars and a white ground splash | sphere ~110 px, ~1.8x |

- **Colour ramp [M]:** #640d15 → #8d0f1a → #c01d16 → #e8180e, plus neutral white splashes. The
  character stays a desaturated white-grey so the effects own the colour.
- **Shape language [visible]:** crescents, spiked rings (sun or thorn), vertical light pillars,
  ground splashes.
- **Take:** each stage adds one layer; ground splashes anchor an area effect to the floor. [I] A
  ring or halo shape suits a priest, especially for Q or R.

## 13-enemies-red-black-white.webp

**Job:** **enemy style.** This is what the player fights, and the player has to contrast with it.

- **Grid [M]:** can't be recovered. No region shows a periodic structure (comb 0.08 or less), and
  features are 1–3 image px wide, so it looks downsampled from a larger capture. Treat it as
  roughly 1x, with low confidence.
- **Size [M]:** figure bounding boxes are 113–136 px including crowns and halos. The scale is
  uncertain.
- **Palette rule [M]:** a single grey ramp from black to white in about 7–11 steps (#000000,
  #131313, #262626, #373737, #4b4b4b, #5f5f5f, #777777, #939393, #acacac, #d0d0d0, #ffffff) plus
  a single red ramp of about 5 steps (#240000, #370000, #6f0000, #99180f, #c12a20). No other hue
  appears. 23 groups cover 95% of the sprite row.
- **Silhouettes [visible]:** tall, upright, facing front, close to symmetrical. Each has a
  distinct head shape: spiked crown, halo ring, hood, horns, antler-like branches, bandages. Red
  goes on capes, halos, emblems and eyes; white on bone and armour highlights; black carries the
  mass. They use heavy vertical striping.
- **Other [S]:** the cards carry names ("THE MONARCH", "THE HARVEST"...) and stat lines.
- **Rules for our player [I]:** don't make red a main colour and don't build her from pure black
  masses. White, gold and one cool accent keep her apart from the enemies. Keep the player's
  effects out of the enemy red, so a red flash always means "enemy".

## 14-outfit-priest-sister.png

**Job:** the **outfit.** A costume design sheet with front, side and back views, detail
call-outs and a palette.

- **Header [S, our translation]:** "otherworld female priest (sister) costume design". The design
  notes, paraphrased: a holy sister theme combined with bold exposure and a structured silhouette;
  a noble white-and-gold scheme; cross motifs placed throughout.
- **Palette chips [M, sampled]:** white #f8f5f0, gold #d1a452, light beige #e4d2ba, skin #f3d2b2.
  Painted, so there's no grid.

**Components** [visible]:

1. **High stand collar:** white with gold edging, a gold cross at the front of the throat, and a
   small flared yoke over the shoulders (detail view).
2. **Front panel / bodice:** one white panel runs from the collar down into the tabard. It has a
   diamond-shaped chest window outlined in gold, with small ornaments at the four points, and
   gold piping down both edges.
3. **Open sides:** the side view shows skin from armpit to hip. The dress is a front panel plus
   back straps.
4. **Gold armbands** on both upper arms. The shoulders and upper arms are bare.
5. **Detached sleeves:** they start just below the armband and widen into big trumpet sleeves
   with pointed hanging corners. White with a gold border and gold fleur-cross motifs at the
   corners.
6. **Front tabard:** a long narrow panel hanging from the hips to mid-shin, with a V-notch at the
   top and a V-point at the bottom, a gold border, a large gold fleur-cross near the bottom and
   small ring studs at the corners.
7. **Hip ornament:** a gold band with a central oval medallion bearing a cross, plus O-rings.
   Small gold cross charms hang from the rings.
8. **Garter straps:** gold straps down each thigh to a gold thigh band, with more cross charms
   hanging from it.
9. **Back:** an open back. Halter straps from the collar form a pentagon yoke with a cross on the
   upper back, a horizontal gold strap crosses mid-back, and the bottom is a gold-trimmed thong
   cut.
10. **Not shown:** legs and footwear. The mannequin has no legs.

**Sizes at our scale [I, scaled from the sheet's proportions; front / three-quarter view at
96 px tall]:**

| Part | Approx. size at 96 px | How to draw it |
|---|---|---|
| collar | ~5–6 px tall | white block with a 1 px gold rim; the cross is a 3×3 plus sign |
| chest window | ~5–8 px wide, ~8–12 px tall (narrower in three-quarter view) | 1 px gold line around 2-tone skin |
| armbands | 1–2 px | a single gold line with one highlight pixel |
| sleeves | ~25–30 px long, mouth ~14–20 px when hanging | white with a 1 px gold hem; the corner cross is a 3×5 glyph |
| tabard | ~6–8 px wide, ~30–35 px long | white strip with a 1 px gold edge; the cross is about 5×7 px |
| hip band and medallion | 1–2 px band, 3×3 medallion | gold, one dark, one light step |
| garters and charms | 1 px straps, 1×2 or 2×3 charms | gold; the charms swing as secondary motion |

**"Decently revealing but still in theme" at pixel scale [I, proposal]:**

- **Keep what reads as design:** bare shoulders and upper arms, the chest window, the bare sides,
  the open back with its gold straps, thigh skin between the tabard and the garters. At 96 px each
  of these is a small, bounded patch of skin framed by gold lines, and that's what reads as
  "costume" rather than "nude".
- **Add** white thigh-highs, which the garter straps need anyway (and CRITIQUE-PARAMS already
  lists them), and white-and-gold boots. They cut down on uninterrupted skin and carry the white
  and gold down to the ground.
- **Swap the thong back for a short back tabard** that mirrors the front one. Spins, turns and
  ultimates show the back. At 96 px a thong is a 1–2 px line in a skin-coloured blob, which reads
  as nothing, or as nude. A back tabard reads as costume and gives the motion another flag.
- **Treat the sleeves and tabard as motion amplifiers,** the way 05 uses hair and 09 uses robe
  tails. Their flare is how a pose gets wide without the body getting any bigger.
- **Shade the white like 01 and 05,** with lavender-grey shadows in 3–4 bands and pure white only
  for highlights, and keep it clearly apart from the white cores of the effects (see the
  rubric's readability section).

---

## What the refs say together

### The effect layer stack

Which ref shows each layer best. A full-quality move should have most of these; a light M1 may
use only three or four.

| Layer | What it is | Best refs |
|---|---|---|
| core flash | a white-hot burst lasting a drawing or two at contact or spawn | 08 (sky flash), 06 (contact spark) |
| main arc / body | the smear or the skill's main shape | 10 (smear anatomy), 07 (crescent), 11 (wide arcs) |
| secondary slivers | thin parallel arcs, decay stripes, speed lines inside the arc | 11, 10 (decay), 07 (speed lines inside) |
| particles | small pieces carrying the character's motif | 09 (petals), 06 (sparkle pixels), 11 (flecks) |
| debris | dark shards thrown from the impact | 08 (ground burst) |
| ground decal / crack | marks left on the floor | 07 (magenta scratches), 12 (ground spikes, white splash), 11 (grey dust) |
| glow | a stepped halo band around bright cores; light cast onto the floor | 11 (bloom), 12 R (red floor glow) |
| screen layer | speed lines, background streaks | 06 |

### Attack structure, counted in drawings

From 05, 09 and 10 [M counts; durations unknown]:

| Phase | Drawings in the refs | Example |
|---|---|---|
| anticipation / wind-up | 1–2 | 05 kick: 2; 09: 1; 10: 1 |
| strike | 1, drawn as the smear, in place of in-betweens | 10 |
| contact / hold | 1–2, pose held | 05 kick: 2 held at full extension |
| follow-through / decay | 1–2 (stripes, then a sliver) | 10 |
| recovery | 1–3 | 05: 1; 09: 1 (sheathing) |

Secondary motion (hair, sleeves, robe tails) runs 1–2 drawings behind the body and overshoots
before it settles (05, 09). [visible]

### Effect width compared with character height

| Ref | Effect | Width relative to character height |
|---|---|---|
| 09 | thorn-ribbon trail | ~0.8x |
| 08 | lightning bolt | ~1.15x long |
| 07 | wrench smear crescent | ~1.25x tall |
| 10 | C-crescents and wedges | ~1.3–1.5x |
| 06 | slash and trail | ~1.5–1.75x |
| 12 | Q / W / E / R finals | ~2.2–3x / 1.4x / 4x / 1.8x |
| 11 | wide arcs | ~2.4–4.2x |

[I, proposal to test] For a 96 px character: M1 arcs of at least 1.5x (≥150 px), an M2 trail of
at least 2x, Q at 3x or more (≥290 px, close to half of the 640 px view), and R at 4x or more, up
to the full view width.

### What the 3D-to-pixel route has to add by hand

[I] These qualities show up in the refs and a straight render of a rigged model won't produce
them:

- **Smears (10, 09, 07).** A render of fast motion gives either a clean single pose or motion
  blur, and neither one is a smear. Smears need either smear geometry in Blender or a hand-drawn
  2D layer, following the shape and decay rules from 10.
- **Exaggerated flare in hair, sleeves and tabard (05, 09).** Physics sims tend to
  under-exaggerate, so the flare on key frames should be keyed by hand.
- **The face (01, 07, 08).** Eye, brow and mouth pixels drawn per facing angle; 3D toon eyes
  downsampled to 2–5 px turn to mush.
- **Line quality (01, 07, 05).** A 1 px tinted outline, lighter coloured lines inside, and
  selective lightening on bright materials. Renderer lines (Freestyle or an inverted hull) need
  post-processing to reach this.
- **Banded, hue-shifted shading (01, 03, 05).** A toon ramp per material with 3–4 steps and
  hue-shifted shadows, then a snap to a fixed palette.
- **Temporal stability.** None of the refs has pixels that shimmer or "boil" from frame to frame;
  3D-to-pixel pipelines often do. This has to be checked in motion.
- **Held key poses (05).** Strikes held on the contact drawing, not interpolated evenly.

### Move-by-move pointers

[I, proposal: this is where each move can borrow from; the design itself is still open.]

- **M1 string:** smear shapes and decay from 10; draw order and contact spark from 06; the
  overhead slam with ground scratches from 07; anticipation, contact and recovery counts from 05.
- **M2 dash:** 05's dash into a thrust kick (row 3); 06's trail behind the lunge; 11's horizontal
  dash-slash with ground dust.
- **Q skill:** 08's strike from above (flash, bolt, ground burst); 12's Q (multi-streak thrust)
  and E (crescent wave with ground spikes); 11's rising crescent.
- **R ultimate:** 12's R (ring, pillars, ground eruption) and W (spiked halo, which fits a
  priest); the widest arcs from 11; everything stacked from the layer table above.

## Open questions for Dex

1. **Height.** Keep 96 px (face detail like 05's), or go to about 128 px (closer to 07/08/09
   faces)? At 96 px, every half-head taken off the body gives the head about 1.5–3 px more
   (96/6 = 16 px, 96/5.5 ≈ 17.5, 96/5 ≈ 19).
2. **Weapon.** Glaive or sword? The weapons in the refs run 0.93–1.1 times the character's height
   (07, 08, 12). A glaive around 1.2–1.4 times would fit the wide arcs naturally. [I]
3. **The back of the outfit.** Is a short back tabard in place of the thong acceptable (see 14
   above)?
4. **Effect colour identity.** Gold and white fit the costume. Which second colour? It shouldn't
   be the enemies' red, and it shouldn't be a white that blends into the costume. [I]
