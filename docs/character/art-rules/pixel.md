# Art rules: pixel rendering and craft

How to turn a constructed drawing of Rosace into finished pixels at about 144 px tall: ramps,
tones per material, clusters, lines, outline, anti-aliasing, dithering, and how to keep a sprite
from looking like a downscaled 3D render. Each rule comes from a published pixel-art teacher,
from a measurement of the finish-bar refs (07, 08, 09, plus 01 for white cloth), or is marked as
our own inference.

This file covers **rendering and craft only**. Head, face and figure construction, gesture and
appeal belong to their own files in `docs/character/art-rules/`, indexed by
`docs/character/ART-RULES.md`.
Companions: `REF-BREAKDOWN.md` (what the refs measure), `QUALITY-RUBRIC.md` (dimensions 4, 5,
6, 7 and 12 are the ones this file serves), `CRITIQUE-PARAMS.md` 14–16.

The refs are other people's art. They stay in the git-ignored `review/refs/character/` and are
named here by filename only. Study crops and measurement output are in the git-ignored
`review/rosace/construct/research/`.

Tags:

- **[M]** measured by script on the native-grid image (tool and command in section 7).
- **[S]** sourced: said by the named tutorial or talk (URL in section 8). Paraphrased, not
  quoted, unless marked.
- **[I]** inference: our reading or proposal. A claim to test, not a fact.
- **[visible]** seen on a zoomed image, not counted.

Units: **H = 144 px** (skull top to sole), head about **24 px** (ref 07 is 137 px with a 24 px
head, 09 is 158 px with 25 [M, REF-BREAKDOWN]). "L" is relative luminance, 0 (black) to 1
(white), and "a:b" contrast is the WCAG ratio `(L_hi + 0.05) / (L_lo + 0.05)` used in
`PIPELINE.md` 3.4. As a feel for it: 1.0 is identical, 1.3 is barely separable at 1x, 2 is a
clear step, 4.5 is text-on-background contrast.

---

## The short version

1. **Our palette is fine; how we place it is not.** Rosace's ramps are properly hue-shifted
   (white goes warm to lavender, skin goes toward rose, gold toward brown). What loses to the refs
   is placement: 3D-style parallel bands, pillow-shaded hands, and three light materials that sit
   on the same brightness rungs. [M]
2. **Banding is measurable, and we have about three times the refs' rate.** Counting places
   where a run of one colour exactly hugs a run of another (Pixel Logic's definition of
   banding), the refs score 2.0–3.4 per 1,000 figure pixels and our round-4 stills score
   6.2–10.0. [M]
3. **White-on-white is structural, not a lighting accident.** The stocking uses the very same
   W1–W4 ramp as the tabard (`art/rosace/palette.json`), and white, skin and gold sit on nearly
   the same luminance ladder: W2 against S2 is 1.02:1, W3 against S3 1.04:1, gold G1 against W2
   1.13:1. In greyscale, the middle of her body is a single material. About 45% of the pixel
   pairs where gold meets white are under 1.5:1. [M]
4. **Rule of thumb from the refs:** 3 shading tones per material plus an optional 1–3 px
   highlight; 1 px tinted near-black silhouette line, lighter lines inside; brightest tone on
   under ~3% of the figure unless the costume is white, in which case the first shadow step must
   be big (at least 1.7:1, as ref 01 does). [M, S]
5. **Pros avoid the 3D look by overriding the light.** Arc System Works hand-tuned where shadows
   fall on Guilty Gear Xrd's models, and the team deliberately gave up 3D accuracy for
   expressiveness. The render tells us where the forms are; the artist decides where the shadow
   shapes go. [S, Motomura GDC 2015]
6. **No dithering on her.** Animated character sprites are the textbook case where dithering
   turns into shimmer and noise. [S, Pixel Parmesan]

---

## 1. Sourced principles

Grouped by topic. Each bullet names the teacher and the source number from section 8.

### 1.1 Light and form

- **Pick one light and commit before shading.** Schlitter establishes the light source at the
  start of any piece and puts the key light above and to one side [S1]. Jansson prefers a
  front-side-top light because it describes form well, and insists every shadow and highlight
  agrees with it [S2]. Medeiros: choose the light, then shade in big clusters that imitate how the
  light behaves [S3].
- **Flat planes get one colour, curved forms get a ramp.** A flat face of an object stays mostly
  uniform; only rounded shapes carry a gradient, and the colour changes only along the direction
  of the ramp [S3]. Jansson says the same: ramps for curved forms, flat colour for planes [S2].
- **Sharp terminators beat smooth gradients.** Medeiros favours sharp light-to-shadow transitions
  specifically to avoid banding [S3]. Jansson suggests building value up and then ending it
  abruptly against the shade of another gradient [S2].
- **Pillow shading is the named failure.** That means darkening around the outline with no real
  light direction. Yu says it almost never happens in real life and makes objects look blurry
  [S4]. Medeiros defines it the same way [S3], and Pixel Parmesan ties it to banding: a band
  that runs all the way round a contour turns into pillow shading and kills the sense of
  direction [S5].
- **Remove unneeded detail.** Medeiros says good pixel art eliminates it [S3]. Jansson: every
  pixel has to justify itself, and in animation every detail gets copied into every frame [S2].

### 1.2 Ramps, hue shift, saturation

- **Hue-shift every ramp.** Schlitter builds ramps with a hue shift between swatches, at most
  about 20° per step, and warns that "straight" ramps (value only) look dull and don't harmonise
  with other ramps [S6]. Medeiros: shadows cooler and less saturated, lights warmer and more
  saturated [S7]. Jansson: shadows take the cool sky ambience, lights take warm sunlight; skin
  runs grey-purple → orange → yellowish [S2].
- **Saturation peaks mid-ramp or climbs into the darks**, but very dark and very saturated
  colours get heavy [S6].
- **Big low-saturation areas, small high-saturation accents** [S7].
- **Few, distinct colours.** Yu's first common mistake is too many similar colours: pixels blend
  together and get lost [S4]. Medeiros: do as much as you can with as little as possible [S7].

### 1.3 Clusters and noise

- **A cluster is a connected group of one exact colour.** Keep the number of clusters low; start
  with big, messy blobs and refine [S8].
- **Orphan pixels are noise.** A single pixel not part of a bigger same-colour group should be
  avoided, except for anti-aliasing, texture or a strong detail such as an eye [S8]. Schlitter
  and Jansson both call single stray pixels distracting noise [S9, S2].
- **Clusters set the look.** Schlitter treats cluster shape as the main focus: angular clusters
  read sharp, organic ones read soft [S1].
- **Chunky-pixel rule:** anything that must be shaded (arm, leg, strap you want to read as
  gold) needs at least 2 px of thickness, because a 1 px part can't carry light and shadow [S4].

### 1.4 Lines, jaggies, doubles

- **Jaggies** are steps that break a line's rhythm. You can't remove them all, only minimise them
  [S4]. Step lengths should grow or shrink steadily along a curve; a sudden size change is a
  misstep [S8]. Jansson uses even patterns like 1-1-2-3 or 2-1-2 [S2].
- **Doubles** are L-shaped corners that make a 1 px line locally 2 px thick. They're useful only
  as deliberate emphasis. Aseprite's "pixel perfect" pencil removes the middle pixel of an L
  [S10, MortMort video S11].
- **Lines inside the shape stay lighter than the silhouette line.** Jansson warns that black
  lines flatten figures and make neighbouring colours look muddy, and recommends separating by
  colour contrast or "lost lines" where possible [S2].

### 1.5 Outline and selective outline (sel-out)

- **Sel-out** replaces much of the dark outline with lighter colours: light colours where the
  light hits, shadow colours for texture [S4]. Pixel Parmesan treats sel-out as anti-aliasing
  applied to the outline to show form and light [S5].
- **Keep the dark line where the sprite meets the ground and the shadow side**, and use a
  lighter top line under an overhead light [S2].
- **Outline last, and only as much as the background needs.** Schlitter starts from a
  one-colour outline and then blends it lighter or darker against the colours inside it [S12].

### 1.6 Anti-aliasing (AA)

- **Manual only, and only where a step is longer than 1 px.** Don't AA 45° lines (1:1 steps) or
  straight lines. A long step gets a proportionally long halftone strip, and the halftone's value
  must bridge the two colours [S13]. Overdone AA looks blurry; use fewer halftones and fewer
  steps [S13].
- **Don't AA the outer silhouette** when the background isn't known. Interior AA is the safe
  kind [S5, S4]. Jansson: pixel art is about being graphical, not about making circles smooth
  [S2].

### 1.7 Dithering

- **Not on animated character sprites.** Pixel Parmesan says most character sprites are too
  small for dithering and doesn't recommend it for them, especially animated ones; extra
  dithering creates noise and false texture [S14]. Yu: use it sparingly, on large flat areas or
  rough textures [S4]. Jansson keeps it off smooth surfaces [S2].

### 1.8 Materials

- **Skin:** hue-varied, never a one-hue gradient, and at least 3 values for readable form [S2].
  Clip Studio's pixel tutorial keeps shadows to 1–3 colours per area and adds a coloured rim
  around shadows to suggest subsurface scattering [S15].
- **White cloth:** in the refs it's shaded lavender or rose, never neutral grey [M, REF-BREAKDOWN].
  Flat planes stay one colour [S3].
- **Metal and gold:** shiny metal is almost a mirror that reflects light more than colour, so
  its highlights are sharp and high-contrast; dull metal gets softer ones [S16]. Metals get
  longer highlight ramps, while dull materials get small or no highlights, and a shiny material
  needs only a few highlight pixels, not a built-up ramp [S2]. Parallel light bands on faces
  that point different ways look wrong [S17].
- **Hair:** too small for strands, so draw it as ribbon-like clumps that follow the skull and fall
  with gravity; darker sends a clump back, lighter brings it forward [S18]. Schlitter draws the
  flow lines of the main locks first, fills blobs with one colour, then adds shadow and highlight
  [S19]. Brighter, tighter highlights read glossier [S15].

### 1.9 Readability

- **Check values in greyscale and squint.** Hue can hide missing value contrast; a sprite that
  turns into one blob in greyscale or when you squint needs more contrast [S20]. This is how you
  catch white-on-white.
- **Differentiate materials by value and hue, not just by black lines** [S2].
- **Check at real size.** Banding is hard to see zoomed in and obvious at 1x–2x [S21, via
  secondary summaries of Pixel Logic].

### 1.10 Not looking like a 3D render

- **Guilty Gear Xrd** (Arc System Works, GDC 2015) built 3D characters to look hand-drawn. The
  talk says every tiny bump in a cel-shaded surface turns into a distracting blotch, so the team
  took direct control of the shading: vertex colours shift the shadow threshold, some areas are
  set to always be in shadow, each character has its own light vector, and lines are drawn with
  controlled width. They also sacrificed 3D accuracy for composition. In their words:
  "Expressiveness over accuracy." [S22]
- **Dead Cells** (Motion Twin, Thomas Vasseur, 2018) rendered small toon-shaded 3D models without
  anti-aliasing to get pixels quickly, and accepted a lower level of detail in exchange for
  animation throughput [S23]. That's the route we already took; it plateaued for a
  close-up-quality character, which is consistent with Vasseur's own trade-off.
- **[I] What follows for us:** the render is a reference layer. We keep what it gets right
  (perspective, proportion, which side of a form faces the light) and then hand-author the
  shadow **shapes**: one clean terminator per form, cast shadows placed where they make the best
  graphic shape, bands merged wherever a ramp would run parallel to the outline.

---

## 2. What the refs actually do (measured)

The numbers below come from `tools/art-construct/pixel_metrics.py` and `patch_tones.py`
(section 7). Refs 07, 08 and 09 are lossy WebP: compression adds 1 px specks and in-between
colours. For those refs I fold 1 px specks into their neighbours (`--despeckle`) and group
colours within 24 per channel, so their counts are approximate. Ours is lossless and exact.
The figure crops are the idle poses from the A/B key (`review/rosace/round-4-fix/key.json`),
cut off just above the ground shadow. Rosace is the r4fix `idle_hero` still at 144 px.

### 2.1 Value structure: how much of the figure is dark, mid and light

Why it matters: this is the greyscale read. It shows whether the figure has a light accent or a
light mass.

| Figure | Dark (L < 0.06) | Mid | Light (L > 0.40) | Brightest (L > 0.80) |
|---|---|---|---|---|
| ref 07 idle | 58% | 33% | 9% | 0.4% |
| ref 08 idle | 51% | 28% | 21% | 1.1% |
| ref 09 idle | 41% | 45% | 14% | 2.2% |
| ref 01 (white shrine outfit) | 15% | 34% | 51% | 13.5% |
| Rosace r4fix idle | 25% | 30% | 45% | 13.7% |
| Rosace r4fix N1 / Q | 26% / 27% | 31% / 34% | 43% / 39% | 6.5% / 8.9% |

[M] So the Amber Owl refs are low-key figures with small light accents. Rosace's value spread is
close to ref 01's, the other white-costume ref, which is fine. **The difference from 01 is in
the steps, not the amount** (2.3).

### 2.2 Outline

| Figure | Silhouette ring pixels that are near-black (L < 0.03) | Main ring colours |
|---|---|---|
| ref 07 | 69% | `#000000`, `#282836`, `#15141b` (blue-black) |
| ref 08 | 46% | `#240200`, `#3a3633`, `#2d1e1a` (warm red-brown) |
| ref 09 | 53% | `#250d13` (wine) on 43% of the ring |
| Rosace r4fix | 53% | OL `#181032` 53%, then G4, W4, I1, **G0 6%, A5 6%** |

[M] The refs' outline is near-black tinted toward the costume's key hue (09's wine matches its
red robe; 08's is warm brown). The remaining ring pixels are sel-out in the material's own dark
or mid tone. Rosace's split is in the same range. The odd part is that 12% of our silhouette
ring is our two brightest colours (G0 specular gold and A5 glass-white). Those are rim and
specular pixels sitting on the outer edge, which vanish against a light background.

### 2.3 Tones per material and step size

Patches cut from inside one material, grouped, counting tones that cover at least 5% of the patch
(`review/rosace/construct/research/patch_tones*.json`). A dark group in a ref patch is usually
line work, not shading.

| Material | Tones (lit → shadow, excluding line) | Lit : first shadow |
|---|---|---|
| ref 01 white cloth [lossless-ish] | `#ffffff` → `#c5c1d0` → `#a69eb5` (3) | 1.75:1 |
| ref 08 white top | `#e4dbd9` → `#d1c9c5` → `#b7abab` → `#989395` (4) | 1.2 per step, 2.2 across |
| ref 09 white hair | `#ede3eb` → `#ddd6d9` → `#c6bfc1` → `#b5b0b4` → `#857e7c` (4–5) | 3.2 across |
| ref 07 skin | `#ffdbc5` → `#d2b2b1` → `#b58890` (3) + `#563732` line | 2.4:1 lit to shadow |
| ref 08 skin (thigh) | `#f2c2c4` → `#b9898b` (2) + line | 1.9:1 |
| ref 07 tan pad (leather/metal-ish) | `#edd3ae` → `#c39f70` → `#897253` (3) + dark | 3.2:1 lit to deep |
| ref 09 red robe | `#ca3440` → `#b93544` → `#9e293c` → `#783249` → `#542636` (4–5) | 1.8 lit to deep |
| **Rosace white (W)** | W1 `#f8f5f0` → W2 `#dcd7e6` → W3 `#b7aecb` → W4 `#8b80a6` | **1.30:1**, 1.5, 1.7 |
| **Rosace skin (S)** | S1 → S2 `#f3d2b2` → S3 `#e2a996` → S4 `#b8766f` | S2 : S3 **1.42:1** |
| **Rosace stocking** | **the same W ramp as the tabard** | – |

[M] The refs use 3–5 tones per material, the same count as ours. What differs is the size of
the first step. Ref 01 drops from white to its first lavender at 1.75:1, and 07's skin drops
2.4:1. Our W1 → W2 step is 1.30:1 and our main skin step S2 → S3 is 1.42:1, both too small to
read as a shadow shape at 1x.

### 2.4 Material ladder: do different materials land on different values?

| Pair (same ramp position) | Contrast |
|---|---|
| W2 white vs S2 skin | 1.02 |
| W3 white vs S3 skin | 1.04 |
| W1 white vs S1 skin | 1.13 |
| G1 gold vs W2 white | 1.13 |
| G2 gold vs W3 white | 1.09 |
| G1 gold vs S2 skin | 1.12 |
| SB blush vs S3 skin | 1.03 |
| I4 hair dark vs OL | 1.25 |
| I3 vs I4 | 1.22 |

[M, `palette.json`] Each rung of the white, skin and gold ramps has almost the same luminance
as the matching rung of the others. At a border between two of them, only hue separates them.
Measured on the idle still with the material-id map: **45%** of the pixel pairs across gold |
white borders are under 1.5:1, **36%** of gold | skin and **22%** of skin | white. The refs keep
their light materials apart by value: 07's skin (L 0.3–0.76) sits against navy (L 0.01–0.05), 08's
white top against a black jacket and stockings (L ≈ 0.03–0.04), and 09's white hair against a
dark kimono and a red robe (L 0.04–0.15).

### 2.5 Banding

"Hugging runs": a horizontal or vertical run of 3 px or more of one colour lying directly
against a run of another colour with exactly the same start and end. This is the Pixel Logic
definition of banding [S21], turned into a count.

| Figure | Hugging run pairs per 1,000 figure px |
|---|---|
| ref 01 (nearly lossless) | 1.96 |
| ref 07 / 08 / 09 (despeckled; tolerance 16, 24 or 32) | 2.2–3.4 |
| Rosace r4 idle | 10.0 |
| Rosace r4fix idle / N1 / Q | 8.2 / 6.2 / 7.8 |

[M] Lossy noise can break runs and lower the refs' count, but the refs stay within 2.2–3.4
across three colour tolerances, and the lossless ref 01 agrees at 1.96. So the gap (about 3x) is
real. It's the parallel-band look critics keep calling "flat 3D banding".

### 2.6 Palette size and clusters

| Figure | Colour groups covering 95% | Pixels in 1 px clusters | Pixels in clusters of 3 px or less |
|---|---|---|---|
| ref 07 / 08 / 09 (tolerance 24, despeckled) | 13 / 13 / 18 | 10% / 11% / 9% | 24% / 26% / 23% |
| Rosace r4fix idle | 19 of 26 | 7.7% | 21.6% |

[M] The palette size and the amount of tiny clusters are in the refs' range. The problem isn't
how many specks we have overall; it's where they sit (gold trim and the hair crown, [visible])
and the value ladder above. Because the ref numbers depend on how compression is removed, use
these only as a sanity range, never as a pass/fail gate.

### 2.7 Face pixels at a 24–25 px head [M/visible, REF-BREAKDOWN 07/08]

The eye is 4–5 px wide and 3 px tall: a 1–2 px lash that flicks outward, a 2 px iris in 2–3
tones and a 1 px highlight. Brows are 1 px angled strokes, the nose is one shadow pixel, the
mouth 2–3 px. Bangs cross the eyes with dark separating lines. The face files in this folder own
construction; the rendering rules for these pixels are in 3.8.

---

## 3. Measurable parameters at 144 px

These are what an artist (or a script) checks. **Target** is the rule; **Basis** says where it
comes from. Every [I] target is a first candidate to A/B, not a proven value.

### 3.1 Light

| Parameter | Target | Basis |
|---|---|---|
| Key light | One per sprite, top-front, from the same screen side in every frame of a move. The render's `light_cam` (≈ +x, +y, +z = from upper right, toward the camera) defines it | [S1, S2]; `meta.json` [M] |
| Terminator | One clean light-to-shadow edge per form, no transition band wider than 1 px on forms under 12 px across | [S3, S2]; [I] width |
| Cast shadows | Under the bangs on the forehead, under the chin on the neck, under the bust, where the tabard meets the thigh, under the sleeve cuff. Each is a designed shape at least 2 px thick at its widest | [S22] (shadows as authored shapes); [I] list |

### 3.2 Ramps and tones

| Parameter | Target | Basis |
|---|---|---|
| Shading tones per material | 3 (light, shadow, deep/occlusion); plus a highlight only on glossy materials (hair, gold, steel, boots) | [M] refs 3–5; [S3] |
| Hue shift per ramp step | 5–20° toward the cool side in shadow, warm side in light | [S6] (≤ 20°), [S7] |
| Lit → first shadow on light materials (white, skin, gold) | **≥ 1.6:1** | [M] ref 01 white 1.75, 07 skin 2.4, 08 skin 1.9; ours 1.30 / 1.42 fail |
| Any two tones that must separate at 1x | ≥ 1.3:1 | [I] from the PIPELINE 3.4 table |
| Different materials meeting with no line between | ≥ 1.5:1 at the border, or put a line or a shadow tone there | [M] 2.4; [S2] |
| Greyscale value groups | At least 3 clearly separated groups (dark, mid, light), each covering at least 15% of the figure | [S20]; [M] 2.1 |
| Brightest tone share | ≤ 3% of the figure on mid or dark costumes (refs 0.4–2.2%). On white costumes up to ~14% only if the next step down is ≥ 1.7:1 (ref 01) | [M] |
| Specular highlights | 1–3 px clusters, ≤ 1% of the material, one per form, on the lit side | [S2, S16] |

### 3.3 Clusters

| Parameter | Target | Basis |
|---|---|---|
| Orphans | None inside any flat area of 12 px or more, except AA, the eye, a highlight or a deliberate texture pixel | [S8, S2, S9] |
| Shade-shape thickness | Every shadow shape on a limb or cloth panel is at least 2 px thick somewhere; no 1 px shadow strip running along an outline | [S4] chunky rule; [S5] |
| Banding | ≤ 3.5 hugging run pairs per 1,000 px (refs 2.0–3.4) | [M] 2.5 |
| Colour count | Sprite ≤ 32 colours; 95% of pixels in ≤ 20 of them | [M]; RUBRIC 6 |
| Local density | No more than 4 distinct tones in any 6×6 px window except the face and weapon ornaments | [I] from [S4] "too many similar colours"; ours has 8 in a 14×18 chest patch [M] |

### 3.4 Lines and outline

| Parameter | Target | Basis |
|---|---|---|
| Silhouette line | 1 px, tinted near-black (L < 0.03) on at least 50% of the ring (refs 46–69%) | [M] 2.2 |
| Line tint | Toward the costume's key hue. Rosace: OL `#181032` (plum-navy) is fine | [M] refs; DESIGN 4 |
| Sel-out | On the lit side only, in the material's own darkest tone; never where the sprite meets the ground | [S4, S2, S5] |
| Brightest colours on the ring | ≤ 3% of ring pixels (rim and spec go one pixel inside the line, except in the rim-light lab where the outline itself is lit) | [I] from [M] 2.2 |
| Interior lines | Lighter than the silhouette; in the material's deep tone; hair clump lines one step darker than the hair shadow | RUBRIC 5 [M]; [S2] |
| Step rhythm | Line segments repeat a fixed ratio (1:1, 1:2, 1:3) or change steadily along curves (1-1-2-3); never 2-3-2-1 | [S8, S2, S10] |
| Doubles | None on 1 px lines except deliberate weight at a joint or under a cast shadow | [S10, S11] |

### 3.5 Anti-aliasing

| Parameter | Target | Basis |
|---|---|---|
| Where | Interior curves only (cheek, thigh, skirt hem inside the silhouette); never the outer silhouette | [S5, S4] |
| Which steps | Only steps of 2 px or more; never 1:1 or straight lines | [S13] |
| How much | One halftone; strip length about half the step (step 2 → 1 px, step 4 → 2 px), max 2 px | [S13] proportional; [I] exact numbers |
| Halftone value | Between the two colours it bridges | [S13] |

### 3.6 Dithering

| Parameter | Target | Basis |
|---|---|---|
| On the character | **0 dithered pixels** | [S14, S4, S2] |
| On effects and backgrounds | Allowed; not covered here | – |

### 3.7 Materials (Rosace)

| Material | Tones | Specific rule |
|---|---|---|
| Skin | S1 highlight (small), S2 lit, S3 shadow, S4 deep and cast shadow | Shadow step must be ≥ 1.6:1: either darken S3 or use S4 as the main cast-shadow tone. Blush SB must differ in value from the skin under it or read as a flat patch [M 2.4] |
| White cloth (tabard, bodice, sleeves) | W1 lit (small), W2 main, W3 shadow, W4 deep | **W1 is a highlight, not a base.** Big flat panels sit in W2, so W1 can show form. Folds are a W3/W4 shape with a sharp top edge |
| Stockings | **Own ramp**, not W | [I] Shift it one full step darker and a little more saturated than the tabard (base ≈ W3's value, lavender/azure tint), so the leg reads against the tabard at 1x the way 01's robe back panel reads against its legs |
| Gold trim | G1 lit, G2 mid, G3 shade, G0 specular (1 px) | A trim you want to read as gold is **2 px wide** (lit over shade), or a single 1 px line in G2 with the line tone next to it. Never a 1 px run that flips between G1, G2, G3 and G0. It's metal: sharp, high-contrast highlight [S16, S2] |
| Hair (indigo) | I1 lit, I2 mid, I3 shadow, I0 highlight band | I4 only as clump lines and deep undersides: it merges with OL (1.25:1). Highlight is one band across the crown, broken into one dash per clump, each dash tapering in the flow direction [S18, S19; I] |
| Boots, haft | I1–I4 + I0 spec | Glossy: one sharp I0 streak along the long axis |
| Steel blade | T2–T4 + A5 edge | 1 px A5 edge line on the cutting edge (ref 08) [visible] |

### 3.8 Face pixels (rendering side only)

| Parameter | Target | Basis |
|---|---|---|
| Iris | 2 px wide, 2–3 tones (A2 over A3), 1 px A5 catch-light | [M, REF-BREAKDOWN 07] |
| Lash | 1–2 px thick OL, flicking out 1 px at the outer corner | [M, 07] |
| Face shading | One cast-shadow shape under the bangs and one on the neck under the chin, both S3 or S4 with sharp edges. The front of the face stays one flat S2 | [I] from anime cel practice and [S22]; refs [visible] |
| Mouth, nose | Mouth 2–3 px in S4; nose 1 px S3 shadow; no outline | [M, 07] |
| Blush | ≤ 2 px per cheek, and it must differ in value from the skin under it | [I]; SB vs S3 is 1.03 [M] |

---

## 4. Negative rules

"Never" means reject the frame. "Avoid" means allowed only with a stated reason in the
override file.

| # | Rule | Why | Basis |
|---|---|---|---|
| N1 | **Never pillow-shade**: no shadow ring that follows the outline all round a shape (hands, thighs, sleeves, face) | Kills the light direction and makes the form blurry and puffy | [S4, S3, S5] |
| N2 | **Never let two tones band**: no run of one colour hugging an equal run of another along a contour | Reinforces the grid, thickens lines, reads as 3D toon steps | [S5, S21]; [M] 2.5 |
| N3 | **Never put a stray pixel in a flat area** unless it's AA, a highlight, the eye or a texture pixel | Noise; the viewer can't tell it's intentional | [S8, S2, S9] |
| N4 | **Never dither on the character** | Shimmers in animation and reads as noise at this size | [S14] |
| N5 | **Never AA the outer silhouette**, 1:1 lines or straight lines | Unknown background; blur | [S13, S5] |
| N6 | **Never shade white with neutral grey** or leave it flat | White then reads as paper, not cloth | RUBRIC 4 [M]; [S6, S7] |
| N7 | **Never put two light materials next to each other at the same value** (white on white, gold on white, skin on white) without a line or a shadow tone between them | They merge at 1x; this is our measured white-on-white | [S2, S20]; [M] 2.4 |
| N8 | **Never use pure `#000000`** on her (it's the enemy's black) | Palette ownership | DESIGN 4 |
| N9 | **Avoid doubles and irregular jaggies** on 1 px lines | Lines look bold and wobbly | [S10, S8, S2] |
| N10 | **Avoid muddy darks**: shadows that are only a darker, greyer version of the base, or a dark tone within 1.3:1 of the outline | Muddy, and it merges into the line (I4 vs OL 1.25) | [S7, S2]; [M] |
| N11 | **Avoid many similar colours packed together** (5 or more tones within L ± 0.25 in a 6×6 window) | Pixels blur together and get lost | [S4]; [M] chest patch |
| N12 | **Avoid 1 px parts that need shading** (1 px gold strap with a ramp, 1 px fingers with shadow) | Can't carry light and shadow; turns into specks | [S4] |
| N13 | **Avoid rendered detail the eye can't use**: tiny folds, secondary creases, extra trim | Every detail gets copied into every frame | [S3, S2] |
| N14 | **Avoid parallel light bands on planes facing different ways** (e.g. the same W1 stripe down the tabard and both stockings) | Reads as one flat surface | [S17] |
| N15 | **Avoid taking the render's shadow boundary as-is** | Surface noise in cel shading becomes blotches; the terminator must be a designed shape | [S22] |

---

## 5. Self-check before calling a drawing done

Run in order. Anything that fails goes back one step, not to the end of the list.

1. **1x and 2x, on the game background.** Does she read as a figure with a face, two hands and a
   weapon, and does the midsection split into bodice, skin, tabard and legs? (Banding and merges
   show up here first [S21].)
2. **Greyscale and squint.** Are there at least 3 separate value groups? Do the stockings
   separate from the tabard and the skin from the white cloth? [S20]
3. **Light audit.** Point to the light. Does every shadow shape on the head, torso, arms, legs and
   weapon agree with it? Is there exactly one terminator per form?
4. **Pillow and band hunt.** Trace each outline. Is there a shadow strip that follows it all the
   way round? Any two colours running side by side with equal lengths? Run
   `pixel_metrics.py` and check banding ≤ 3.5 per 1,000 px.
5. **Material test.** Can you name each material from its shading alone: skin soft, white cloth
   broad folds with lavender shadow, gold sharp and high-contrast, hair in clumps with a band,
   boots glossy?
6. **Step sizes.** Is the lit → first shadow step at least 1.6:1 on white, skin and gold? Is W1
   a highlight and not a base colour?
7. **Cluster pass at 6x.** Any orphans in flat areas? Any shadow shape thinner than 2 px? Any
   6×6 window with more than 4 tones outside the face?
8. **Line pass at 6x.** 1 px everywhere, steady step rhythm, no doubles, interior lines lighter
   than the silhouette, sel-out only on the lit side, no bright rim or spec pixels on the outer
   ring.
9. **AA pass.** Only interior curves, only steps of 2 px or more, one halftone, strips no longer
   than half the step. No dithering anywhere on her.
10. **Face at 10x and at 1x.** Iris tones, catch-light, lash flick, cast shadow under the bangs;
    does the expression still read at 1x?
11. **Frame-to-frame (for motion).** Flip between neighbouring frames. Do tones on surfaces that
    aren't moving stay put (no boiling), and do cast shadows move with the form?
12. **Against the ref, same size.** Put the frame beside 07/08/09 at the same pixel size in the
    A/B sheet format. Name one thing theirs does better and fix it before submitting.

---

## 6. What round-4 Rosace violates

Looked at `review/rosace/round-4/` and `round-4-fix/` (the idle, attack, skill and back sheets,
the face and hand libraries, the in-context lineups) and measured the r4 and r4fix stills. Most
severe first.

1. **Banding (N2, N15).** 6.2–10.0 hugging run pairs per 1,000 px against the refs' 2.0–3.4 [M].
   On the idle, the tabard runs as W1/W2/W3 vertical stripes following its contour, the stockings
   the same, and the sleeves as parallel white and lavender strips [visible,
   `construct/research/rosace_r4fix_torso_legs_x6.png`]. This is the "flat 3D banding" the
   critics name every round.
2. **White-on-white and the shared value ladder (N7).** The stocking uses the tabard's W ramp
   (`palette.json`, material `stocking`). White, skin and gold rungs are 1.02–1.13:1 apart.
   45% of gold | white border pairs and 36% of gold | skin pairs are under 1.5:1 [M]. At 1x
   (`incontext_640x360_lineup_px144.png`) bodice, skin, tabard and legs merge into one light mass
   [visible].
3. **Shadow steps too small (3.2).** W1 → W2 is 1.30:1 and S2 → S3 is 1.42:1, against ref 01's
   white 1.75 and 07's skin 2.4 [M]. W1 is used as a base: 37% of the white-cloth pixels and 35%
   of the sleeve [M], so the brightest tone covers 13.7% of the figure and there's no room left
   for a highlight.
4. **Pillow-shaded hands (N1, N12).** Every stamp in `hand_library_x10.png` is a light centre with
   a darker ring and a full OL outline. The horizontal fist has specks inside it and no knuckle
   row or thumb shape [visible]. That's the "block hands" note.
5. **Hair has no clumps and a speckled highlight (3.7, N3).** Half the hair pixels are I4 (48%),
   which is 1.25:1 from the outline, so the dark half melts into the line. The crown highlight is
   scattered I0/I1 pixels instead of one band broken per clump [M, visible,
   `rosace_r4fix_face_x10.png`].
6. **Face rendering is flat (3.8).** The face is one S2 field. There's no cast shadow under the
   bangs or on the neck, the blush is 1.03:1 from S3 so it's only a hue patch, and the mouth is a
   2 px S4 blob. The right cheek edge merges into the white veil and hair highlight [M, visible].
   That's part of why the face reads as a blank stare. The construction side belongs to the face
   rules.
7. **Gold reads as a brown line with specks (3.7, N12, N11).** The most common gold tone is G3
   (29%, L 0.20). 1 px trims cycle through G1/G2/G3 with G0 specks, and a 14×18 px chest patch
   carries 8 tones between L 0.20 and 0.69 [M]. The collar cross doesn't survive at this density
   (design fix, DESIGN 3).
8. **Bright pixels on the silhouette ring (3.4).** 12% of ring pixels are G0 or A5 [M]. On light
   backgrounds that edge drops out; on dark ones it looks like a halo rather than form.
9. **Not violated, for the record:** palette size (26 colours, 19 cover 95%), hue shifting in
   every ramp, the outline's tinted near-black (53% of the ring), and no dithering [M]. Keep these.

---

## 7. How it was measured (reproducible)

All outputs are in the git-ignored `review/rosace/construct/research/`.

- `tools/art-construct/pixel_metrics.py IMAGE [--box x0 y0 x1 y1] [--tol N] [--despeckle]
  [--ids ID.png --ss 4] [--json OUT]` reports the figure's height, palette coverage, cluster
  sizes, banding (hugging run pairs), outline ring, value distribution, hue families and (with
  `--ids`) tones per material plus the contrast across material borders. For a flat or
  checkerboard background it flood-fills from the crop border; alpha is used when present.
- `tools/art-construct/patch_tones.py PATCHES.json` reports tones per material on hand-picked
  patches (`patches.json`, `patches_r01.json`, `patches_metal.json` in the research folder).
- Ref crops: 07 idle `(64,14,178,177)` in `07-…_bonus-originalsize_1x.png`, 08 idle
  `(180,40,340,203)` in `08-…_bonus-originalsize_1x.png`, 09 idle `(60,32,205,194)` in
  `09-…_1x.png`, i.e. the A/B key's crops cut just above the ground shadow.
  Example: `python tools/art-construct/pixel_metrics.py
  review/refs/character/native/09-anim-amberowl-katana-cats_1x.png --box 60 32 205 194 --tol 24
  --despeckle`.
- Rosace: `D:\Dex\Projects\dex-place-art\rosace\build\renders\r4fix\<still>\px144\still.png` with
  `id.png` (4x supersampled material ids), read-only.
- **Caveats.** Refs 07/08/09 are lossy. Their colour counts and singleton shares depend on the
  tolerance and despeckle settings, so section 2.6 is a sanity range. The banding count is
  stable across tolerances (2.2–3.4) and agrees with the nearly lossless ref 01 (1.96). Patch
  tone counts include line work and occasional background pixels; read the ramps, not the exact
  counts. An in-family "hard step" count is also in the JSON, but it isn't used here: its hue
  families mix gold with skin, so it doesn't separate materials.

---

## 8. Sources

Text sources were read for this file. Video sources are listed where a teacher the brief names
covers the topic; their content was **not** transcribed here, so no rule above rests on a video
alone.

| # | Source | Author / publisher | URL |
|---|---|---|---|
| S1 | Pixelblog 6: Light and Shadow (2018); Pixelblog 5: Back to the Basics (2018) | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow ; https://www.slynyrd.com/blog/2018/5/16/pixelblog-5-back-to-basics |
| S2 | Pixel Art Tutorial | Arne Niklas Jansson (androidarts.com) | https://androidarts.com/pixtut/pixelart.htm |
| S3 | 4: Basic Shading (2021) | Pedro Medeiros (Saint11) | https://saint11.art/pixel_art_articles/article4/ |
| S4 | Pixel Art Tutorial: Basics; Pixel Art: Common Mistakes (updated 2020) | Derek Yu | https://www.derekyu.com/makegames/pixelart.html ; https://www.derekyu.com/makegames/pixelart2.html |
| S5 | Anti-Aliasing Fundamentals for Pixel Artists (2020) | Pixel Parmesan | https://pixelparmesan.com/blog/anti-aliasing-fundamentals-for-pixel-artists |
| S6 | Pixelblog 1: Color Palettes (2018) | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes |
| S7 | 6: Basic Color Theory | Pedro Medeiros (Saint11) | https://saint11.art/pixel_art_articles/article6/ |
| S8 | 2: Cluster Sketching and Painting (2021) | Pedro Medeiros (Saint11) | https://saint11.art/pixel_art_articles/article2/ |
| S9 | Pixelblog 2: Texture (2018) | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2018/2/15/pixelblog-2-texture |
| S10 | Pixel-perfect line cleanup (the L-corner rule), as implemented in Aseprite; explained in "Pixel Art Algorithm: Pixel Perfect" | Ricky Han | https://rickyhan.com/jekyll/update/2018/11/22/pixel-art-algorithm-pixel-perfect.html |
| S11 | 3 PixelArt Techniques/Common Mistakes (Doubles, Jaggies & Outline) (video, 2017; Lospec listing) | MortMort | https://www.youtube.com/watch?v=gW1G_FLsuEs ; https://lospec.com/pixel-art-tutorials/3-pixelart-techniques-common-mistakes-doubles-jaggies-outline-by-mortmort |
| S12 | Pixelblog 57: Knights, Monsters, & Castles (2025) (outline method) | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2025/7/28/pixelblog-57-knights-monsters-amp-castles |
| S13 | 5: Anti-Alias and Banding | Pedro Medeiros (Saint11) | https://saint11.art/pixel_art_articles/article5/ |
| S14 | Dithering for Pixel Artists (2021) | Pixel Parmesan | https://pixelparmesan.com/blog/dithering-for-pixel-artists |
| S15 | Creating Pixel Character Art: from Sketch to Sprite (Clip Studio Tips, 2025) | Livresquare | https://tips.clip-studio.com/en-us/articles/11408 |
| S16 | Pixel Tutorial: Metal Surfaces (itch.io forum) | imonk | https://itch.io/t/2176027/pixel-tutorial-metal-surfaces |
| S17 | Tutorial: How to draw Shiny Materials | Onimille | https://onimille.tumblr.com/post/149902736668/tutorial-how-to-draw-shiny-materials |
| S18 | Shading & Lighting (hair as ribbons); page returned 403 on direct fetch, claim taken from its search excerpt | KawaiiHannah | https://kawaiihannah.com/pixelart/tutorials/shading-lighting/ |
| S19 | Pixelblog 29: Anime Faces and Hair (2020) | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2020/7/28/pixelblog-29-anime-faces-and-hair |
| S20 | Checking Image Values in Grayscale (Steam guide; claim taken from its search excerpt), plus the squint test as commonly taught | Steam Community guide | https://steamcommunity.com/sharedfiles/filedetails/?id=3014911194 |
| S21 | Pixel Logic: A Guide to Pixel Art (banding and clean-up chapters). Read through secondary summaries, not the book itself; the definition matches S5 | Michael Azzi | https://pixellogicbook.com/ |
| S22 | GuiltyGearXrd's Art Style: The X Factor Between 2D and 3D (GDC 2015; handout read directly) | Junya Christopher Motomura, Arc System Works | https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf ; https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The |
| S23 | Art Design Deep Dive: Using a 3D pipeline for 2D animation in Dead Cells (2018) | Thomas Vasseur, Motion Twin (Game Developer) | https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i- |

Further viewing on the same topics (not transcribed; use to watch the method in motion):

- AdamCYounis, "Pixel Art Class: Lighting & Shading Basics" (2020),
  https://www.youtube.com/watch?v=u7v4uEDwW9o, and the Pixel Art Class playlist,
  https://www.youtube.com/playlist?list=PLLdxW--S_0h4dlWUpl-TzBp-ulqK3NiM_
- Brandon James Greer, "3 shading and coloring tips for clean pixel art!" (2021),
  https://www.youtube.com/watch?v=ihmH5jFn_a4, and "How to draw pixel art from 3D reference!"
  (2022), https://www.youtube.com/watch?v=dc2QgpVmEOk. The second is the closest published
  match to our route: 3D as reference, pixels inked and shaded by hand.
- Pedro Medeiros (Saint11), the 512×512 tutorial GIFs (Metal, Fabric, Outlines, Shading),
  https://saint11.art/blog/pixel-art-tutorials/
- Lospec tutorial index by tag (antialiasing, dithering, hair, metal),
  https://lospec.com/pixel-art-tutorials
