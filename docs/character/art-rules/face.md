# Face rules: building an anime face by hand, then at pixel scale

How to construct Rosace's face the way an artist would, from guidelines instead of from the 3D
render, and how to judge it before calling it done. It covers head construction, anime
proportions, the three-quarter view, eyes, expressions, hair around the face and appeal, then
turns all of that into pixel numbers for our 144 px sprite (a head of about 25 px from skull to
chin, 27-29 px from the top of the hair).

Companions: `../DESIGN.md` section 5 (the face spec this doc corrects), `../PIPELINE.md` 3.2
(eye budget by head size) and 3.10 (stamp format), `../REF-BREAKDOWN.md`, `../QUALITY-RUBRIC.md`
3, `../CRITIQUE-PARAMS.md` 2-4. References are named by filename and never embedded. Study crops
are in `review/rosace/construct/research/face/` (git-ignored, local only).

Tags, the same as the other character docs:

- **[M]** measured by us, with the file and pixel coordinates given. Ref measurements are read
  off WebP-compressed art and are ±1 px unless said otherwise. Rosace measurements are exact
  (lossless renders, palette-mapped).
- **[S]** sourced: from the tutorial or book named next to it (full list in section 1.10).
- **[visible]** seen on an image, not measured.
- **[I]** our inference or proposal. Treat it as a claim to test.

---

## The short version

1. **Why her face reads as blank.** It isn't one thing: several small construction errors stack
   up. Her eyes point in different directions (the whites sit on the nose side of both eyes, so
   the irises splay outward). Her idle face has no eyebrows. Her mouth is a flat 2 px dash with
   no upturned corner. Both eyes are mirror copies of each other. The face below the lash line
   is 2-3 px too short, so the face is a wide, squat rectangle. The head is perfectly level and
   the gaze doesn't meet the viewer. Section 5 lists each one with coordinates. [M]
2. **The single biggest proportion error.** From the top of the lash to the chin, her face is
   **11 px**. On refs 07, 08 and 09 it's **13-14.5 px**, while the part above the lash (hair
   top to lash) is the same as hers (15-16 px). Face height over face width is 0.69 on her
   against 0.87-0.91 on the refs. [M, table 2.1]
3. **What makes an anime face read as alive, in pixels.** Both irises aim the same way; the
   highlight sits on the same side in both eyes; brows are visible and angled; the mouth has a
   bent corner; the near and far eye differ in width; the chin comes to a point that sits off
   centre in three-quarter view; and the head tilts a little. Each of these costs 1-3 pixels.
   [S, section 1; M, section 2]
4. **Construction order.** Head ball, then side plane and centre line, then eye line, nose and
   chin marks, then the eye boxes, and only then the pixels. Every face is tried in at least
   3 variants and chosen side by side with a ref at the same scale, the way a pixel artist
   iterates (Saint11: low-res work is "like a puzzle"). [S, I]
5. **The 3D render keeps one job:** where the head is and which way it turns (perspective and
   timing). It does not supply the face. Faces, eyes and the face contour are drawn by hand in
   data on the construction grid below. [I, per Dex's direction]

---

## 1. Sourced principles

Each rule is quoted or paraphrased from the source named, then followed by what it means for us.
Where sources disagree, both are given.

### 1.1 Head construction (Loomis, as taught by Proko)

- The head is two masses: "a ball for the cranium and a boxy shape for the jaw". The sides of the
  ball are sliced flat; that side-plane oval is "⅔ of the height of the circle". [S, Proko]
- "The face can be broken down into nearly perfect thirds, chin, nose, brow, and hair": hairline
  to brow, brow to nose bottom, nose bottom to chin are equal. The head is about 3.5 of those
  units tall, the extra half being hairline to crown. [S, Proko, after Loomis]
- The brow line runs through the middle of the side-plane oval, and the angle from ear to brow
  gives the head's tilt. In an up or down tilt the thirds shrink as they recede. [S, Proko]
- **For us:** Loomis gives realistic thirds. Anime keeps the construction but compresses the
  lower face and enlarges the eyes (1.2). We keep the ball, side plane, centre line and brow line
  as the construction layer, and we get the turn and tilt from the 3D head. [I]

### 1.2 Anime proportions, front view

- Eye line: "a horizontal line in the middle of the head. This is where the top of the eyes will
  be" (Mary Li). AnimeOutline puts the eyes "below the horizontal halfway point of the head". So
  the top of the eye sits at or just under half the head's height. [S]
- Eye spacing: "roughly one eye apart … you can place them slightly closer if you want" (Mary
  Li); "far enough apart that you can fit another eye in between them" (AnimeOutline). [S]
- Nose: "in the middle between the bottom of the chin and the middle of the eyes" (Mary Li);
  "halfway between the top of the eyes and the bottom of the chin" (AnimeOutline). [S]
- Mouth: "slightly above the middle between the bottom of the chin and nose" (Mary Li,
  AnimeOutline agree). [S]
- Top of the ears lines up with the top of the brows; bottom of the ears with the nose. [S, Mary Li]
- Slynyrd on anime pixel faces: "Big eyes, little pouty lips, and an almost non existent nose";
  eyes are exaggerated, the mouth subdued, but features still follow accurate anatomy, seen as
  if through "a subtle fisheye lens". [S, Slynyrd Pixelblog 29]
- **For us:** the eye top at about half the head, the nose halfway from the eyes to the chin,
  and the mouth a bit above halfway from the nose to the chin. Section 2 checks these against
  refs 07-09 at pixel scale. [I]

### 1.3 Three-quarter view

- The centre line becomes a curve set about ¾ of the way across the ball; a second curve marks
  the ear and the end of the jaw. The cheek has "a slight dip" from the eye socket. [S, Mary Li]
- **Far eye:** narrower. Mary Li: "the height of the eyes should still be the same, just the
  width will be smaller", and "don't make it too small". AnimeOutline: the far eye, brow and side
  of the lips are "drawn vertically shorter", more so the further the head turns. The sources
  disagree on height; both agree on width. [S]
- **Near eye:** sits farther from the curved centre line than the far eye does, because the eyes
  are set into the ball and the far one is carried round toward the edge. [I, from the Loomis
  ball in 1.1 and Mary Li's ¾ centre curve; not stated in these words by a source we read]
- **Far brow:** shorter and shifted toward the outer side, because the brow ridge sticks out
  further than the eye. [S, Mary Li]
- **Nose:** "should not be right down the middle of the eyes. It should be more towards the eyes
  that are further away." **Mouth:** "slightly more towards the middle of the eyes compared to
  the nose". [S, Mary Li]
- **Iris turning:** the iris "will get thinner as it approaches a side view". [S, Konart]
- **For us:** in three-quarter view the far eye loses 1-2 px of width (and at most 1 px of
  height), the nose moves to just inside the far eye's inner corner, the mouth sits 0-1 px nearer
  the middle than the nose, and the far cheek and chin make the face contour on the far side
  (the near side is usually covered by hair). [I]

### 1.4 Eyes

- **Both eyes look the same way:** "Point your pupil/iris at the same side/direction."
  [S, make.art.alive]
- **Iris tones:** dark on top (the lid's shadow), light at the bottom: "dark color for the upper
  and the light color for the lower". [S, make.art.alive]
- **Highlights:** "The cornea creates as many highlights as sources of light in the scene"; at
  least one highlight should sit between the iris and the white so the shine reads as on top of
  the eye; "the cornea gets no shadows, only the highlights, and the iris gets no highlights,
  only shadows". [S, Konart] Both eyes see the same light, so the highlight goes on the same
  side of both eyes. None of the sources we read states that directly. [I]
- **Mirroring trap:** make.art.alive shows how to flip one eye to copy it to the other side. The
  shape may be flipped, but the highlight and iris direction must not be flipped with it, or the
  light and the gaze point opposite ways. [S for the flip technique; I for the warning]
- **Lash angle carries mood:** the outer ends of the lids angled down read as "strong emotions
  like anger", up as "weak or soft expressions such as sad worry scare", flat as "boring,
  tired". [S, make.art.alive]
- **Pupils** shrink for shock or madness; keep them normal size for calm and confident.
  [S, make.art.alive]

### 1.5 Expressions

- Faigin splits expression into three zones: brows and forehead, the eyes, and the mouth and
  chin. The most expressive area of the upper face is the lower middle of the brow plus the
  lids. He stresses that the change needed for an expression to read "can be very slight".
  [S, Faigin, via the book description and reviews; we haven't read the full book]
- **A real smile moves the eyes too:** the lower lid rises and the cheeks lift, and the mouth
  curves up at the corners. A smile with neutral eyes and a boxy mouth reads as fake.
  [S, Faigin, via reviews and summaries of the book]
- **Anger:** the brows come down *and together*; the upper lids lift into a stare and the lower
  lids rise; the lips press thin, or in stronger anger open to show teeth. [S, general
  facial-expression literature summarised in search; not Faigin's own text]
- **For us:** every expression has to change at least two of the three zones (brows, lids,
  mouth). An expression that changes only the mouth, or only the lids, reads as the same blank
  face with a different mouth. [I, from Faigin's three zones]

### 1.6 Hair around the face

- Build the skull first, mark the hairline, then the hair as a few big clumps that stand off the
  skull. The splits between clumps "should not really go up past the hairline". [S, AnimeOutline
  hair 3/4]
- In three-quarter view the middle clumps point down and the side clumps swing toward their own
  side. The back hair follows the head's shape a little way off it. [S, AnimeOutline hair 3/4]
- Slynyrd's pixel method: imagine the "flow lines of the main locks, which usually stem from a
  cowlick towards the back", then "blob in the hair with a single color", then shadows and
  highlights. "Hair is one of the top defining characteristics to an anime personality."
  [S, Slynyrd Pixelblog 29]
- **For us:** the bangs are 3-5 clumps that start at a parting or crown point, not a helmet
  edge. Where bangs cross the eyes (refs 07-09 do this), the gaps between clumps show forehead
  skin, and the brows and lashes stay readable through or over them. [I, visible on 07-09]

### 1.7 Appeal

- **Don't twin.** Thomas and Johnston (Disney) warn against "twins": the left and right of a
  pose mirroring each other, which looks wooden. The UNM course notes: "nothing in reality is
  perfectly symmetrical (and even so it sure isn't as visually interesting as asymmetry)".
  [S, The Illusion of Life via Swardson/UNM] J.K. Riki: a perfectly symmetrical pose "lacks a
  lot of dimension, depth, and life", with the exception of deliberate power moves. [S]
- **Appeal** is principle 12: easy-to-read design, clear drawing and a personality that holds
  the audience. [S, The Illusion of Life, via the same course material]
- **Cuteness cues** (Lorenz's baby schema, tested by Glocker et al. 2009): a round face, high
  forehead, large eyes, a small nose and mouth raise perceived cuteness; enlarged eyes and lips
  have the same effect on adult faces. [S] Our finish refs are adult gacha heroines, so we use
  these as dials (big eyes, small nose and mouth) but keep an adult jaw length (section 2).
  Pushing every dial reads as a child, which is wrong for her. [I]
- **For us, on the face:** asymmetry is where the life comes from: a head tilt, one brow a pixel
  higher, a smirk bent on one side, a near eye different from the far eye. [I, from twinning;
  visible on the 07 and 08 portraits, where every expression is asymmetric]

### 1.8 Pixel craft

- **Orphan pixels:** remove isolated single pixels unless they're deliberate texture; at small
  sizes "each pixel you place is a big choice". Draw the same subject many times; treat low-res
  work "like a puzzle". [S, Saint11, article 1]
- **Pillow shading** ("shading from the outline inward") almost never happens in real life and
  looks blurry; shade from a light direction instead. **Too many similar colours** blend and get
  lost. [S, Derek Yu]
- **Banding:** "lines of the same length … placed parallel to each other" reinforce the grid
  instead of the form. Anti-aliasing is optional, and on very small sprites it can read as noise.
  [S, Lux, Pixel Parmesan]
- **Jaggies and 1x checks:** imagine the pixel line as a smooth HD line to spot jaggies; shading
  edges are lines too and shouldn't have jaggies either; keep a permanent 1x preview and blur
  the work to catch banding. [S, Azzi, Pixel Logic; read through a search excerpt of the book's
  text, not the full book]

### 1.9 Sources we couldn't use

- st0ven's "Fighter Sprite Faces (female)" (listed on Lospec's face tag) is exactly our genre, but
  the archive page couldn't be fetched from here. Read it by hand before round 6. [unknown]
- No face-specific tutorial was found from Brandon James Greer, MortMort or AdamCYounis in this
  pass, so none of their material is cited here.

### 1.10 Source list

| Tag in text | Title | Author | URL |
|---|---|---|---|
| Proko | How to Draw the Head from Any Angle | Stan Prokopenko (after Andrew Loomis, *Drawing the Head and Hands*, 1956) | https://www.proko.com/course-lesson/how-to-draw-the-head-from-any-angle |
| Mary Li | How to draw the head and face – anime-style guideline, front view | Mary Li | https://maryliart.com/how-to-draw-the-head-anime-style-guideline-front-view-tutorial |
| Mary Li | How to draw the head and face in 3/4 view – anime style | Mary Li | https://maryliart.com/how-to-draw-the-head-and-face-in-3-4-view-anime-style |
| AnimeOutline | How to Draw an Anime Face (Structure & Proportions) | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-face-structure/ |
| AnimeOutline | How to Draw an Anime Female Face 3/4 View | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-female-face-3-4-view/ |
| AnimeOutline hair 3/4 | How to Draw Anime Hair in 3/4 View | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-hair-in-3-4-view-step-by-step/ |
| make.art.alive | Everything about drawing anime eyes | make.art.alive (Clip Studio Tips) | https://tips.clip-studio.com/en-us/articles/10216 |
| Konart | How to draw eyes in ANY style | Konart (Clip Studio Tips) | https://tips.clip-studio.com/en-us/articles/2623 |
| Faigin | *The Artist's Complete Guide to Facial Expression* (1990) | Gary Faigin | https://archive.org/details/artistscompleteg0000faig |
| The Illusion of Life | *Disney Animation: The Illusion of Life* (1981), taught in "Module 8 – Solid Drawing" | Frank Thomas and Ollie Johnston; course by Prof. Swardson, UNM | https://swardson.com/unm/animation1/mod08-solidDrawing.php |
| J.K. Riki | Defining the Art: Twinning | J.K. Riki (Animator Island) | https://www.animatorisland.com/defining-the-art-twinning/ |
| Glocker et al. 2009 | Baby Schema in Infant Faces Induces Cuteness Perception and Motivation for Caretaking in Adults, *Ethology* 115:257-263 | M. L. Glocker, D. D. Langleben, K. Ruparel, J. W. Loughead, R. C. Gur, N. Sachser | https://pubmed.ncbi.nlm.nih.gov/22267884/ |
| Slynyrd Pixelblog 29 | Anime Faces and Hair | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2020/7/28/pixelblog-29-anime-faces-and-hair |
| Saint11 | An Absolute Beginner's Guide (pixel art article 1) | Pedro Medeiros (Saint11) | https://saint11.art/pixel_art_articles/article1/ |
| Derek Yu | Pixel Art: Common Mistakes | Derek Yu | https://www.derekyu.com/makegames/pixelart2.html |
| Lux | Anti-Aliasing Fundamentals for Pixel Artists | Lux (Pixel Parmesan) | https://pixelparmesan.com/blog/anti-aliasing-fundamentals-for-pixel-artists |
| Azzi | *Pixel Logic: A Guide to Pixel Art* (2017) | Michael Azzi | https://gumroad.com/michafrar (official; free edition covers line art) |
| st0ven (unread) | Fighter Sprite Faces (female) | st0ven | listed at https://lospec.com/pixel-art-tutorials/tags/face |

---

## 2. What the finish refs measure at pixel scale

The refs Dex points at (07, 08, 09) have heads of about the size of ours, so their faces are the
pixel budget. Rows are image y coordinates on each file; "lash top" is the first dark lash row
of the near eye.

### 2.1 Vertical layout and face shape

Files: 07 and 08 from the `*_top_native-p2.png` copies (idle figure), 09 from
`09-anim-amberowl-katana-cats_1x.png` (red colourway, frame 1). Rosace from
`dex-place-art/rosace/build/renders/r4fix/idle_hero/px144/still.png`. Crops:
`research/face/ref07_face_grid_x20.png`, `ref08_face_grid_x20.png`,
`ref09_idle_face_red_grid_x20.png`, `rosace_r4fix_idle144_face_grid_x18.png`.

The rows below show where each feature sits. The derived lines are what matter: the refs agree
with each other closely, and Rosace differs in one place, the face under the eyes.

| Row (y) | 07 | 08 | 09 | Rosace r4fix, 144 |
|---|---|---|---|---|
| Hair top (skull plus volume) | 43 | 64 | 40 | 52 |
| Lash top | 58 | 80-81 | 56-57 | 68 |
| Eye bottom | 61-62 | 85 | 60 | 71 (lower-lash dot at 72) |
| Nose mark | 65-66 | not readable | not readable | 74 |
| Mouth | 70 | 91 | about 67 | 76 |
| Chin | 72-73 | 93-94 | 69-70 | 79 |
| **Hair top to chin** | 29.5 | 29.5 | 29.5 | **27** |
| **Hair top to lash top** | 15 | 16.5 | 16.5 | 16 |
| **Lash top to chin** | 14.5 | 13 | 13.5 | **11** |
| **Eye bottom to chin** | 11 | 8.5 | 9.5 | **8** |
| Face width at the eye row | 16 | 15 | 15 | 16 |
| **(Lash top to chin) ÷ width** | 0.91 | 0.87 | 0.90 | **0.69** |

[M, ±1 px on refs, exact on Rosace]

What it means: the top half of her head (hair and forehead) is built to the refs' size. The face
under the lashes is 2-3.5 px shorter than theirs at the same width, so her face reads as a wide,
squat window. That's the "mask" or "moon face" the critics saw. [M, I]

### 2.2 Features

| Feature | Refs 07-09 | Rosace r4fix 144 |
|---|---|---|
| Near eye, w × h | 5-7 × 4-5 [M, 07 x116-122 / 08 x116-121 / 09 x154-159] | 6 × 4 [M] |
| Far eye, w × h | 5-6 × 4 [M] | 5 × 4 [M] |
| Gap between the eyes (3/4) | 3-4 px [M, 07 x123-125, 08 x112-115] | 4 px [M, x45-48] |
| Upper lash thickness | 2 rows [M, 07 y58-59, 08 y81-82] | 1 row plus 1 px ends [M, y68] |
| Iris | 2-3 px wide, 2-3 tones, 1 px highlight [M, REF-BREAKDOWN] | 3 px wide, 3 tones + highlight [M] |
| Eye line tilt across the face | 1 px in all three (about 6°) [M, low confidence at ±1 px] | 0 [M] |
| Brows | 1 px angled strokes over or between the bangs [REF-BREAKDOWN, visible] | none on the idle face [M] |
| Mouth | 2-3 px, often a smirk bent on one side [REF-BREAKDOWN; 07 y70 x121-126 visible] | 2 px flat [M, x48-49 y76] |
| Nose | 1 px shadow [REF-BREAKDOWN] | 1 px S3 [M, x49 y74] |
| Face-to-hair edge | no outline; the hair's dark tone is the edge [visible] | S3 contour line, straight for 7 rows on the near side [M, x38 y69-75] |
| Chin bottom row | narrows to 2-4 px [visible, 07 x121-124 y72] | 7 px wide [M, x44-50 y79] |

Portrait sheets (bigger than the sprite, same artist): every expression on the 07 and 08 sheets
is asymmetric (head tilted, one side of the mouth higher, brows at different heights), and even
the "Normal" face is a confident smirk, not a neutral mouth [visible,
`research/face/ref07_portraits_x5.png`, `ref08_portraits_x6.png`].

---

## 3. Parameters for Rosace at 144 px

These are the construction numbers. Counted in rows **up from the chin** (row 0), because the
chin sits on the collar and is the fixed point. They come from section 2's ref table, adjusted
by the sourced ratios in 1.2. [I, derived from M and S]

### 3.1 The construction grid (three-quarter view, facing screen-right)

| Line | Rows above the chin | Why |
|---|---|---|
| Chin | 0 | fixed on the collar |
| Mouth | 2-3 | refs 2.5-3; "slightly above the middle" of nose to chin |
| Nose mark | 6-7 | refs 07: 7; halfway from eye to chin (1.2) |
| Eye bottom (iris bottom) | 9-11, target 10 | refs 8.5-11 |
| Lash top | 13-15, target 14 | refs 13-14.5; the eye top at about half of hair top to chin |
| Brow | lash top + 2 to + 3 | refs 07: 2-3 |
| Hair top | 29-30 | refs 29.5 |

Face width at the eye row stays **15-16 px**, so (lash top to chin) ÷ width lands at **0.85-0.95**.

Consequence for the current model: keep the eye row where it is and move the chin down 2-3 px
(or raise the eye row 1 px and drop the chin 2 px). Either way the head grows from 27 to 29-30 px,
the size of the refs' heads at 137-158 px height. [I] This is a head-and-neck change on the 3D
side too, not a stamp tweak, and it goes to whoever owns the model (the figure lane).

Horizontal, three-quarter view (screen-right facing, near eye on the left):

| Part | Rule |
|---|---|
| Centre line | a curve about ¾ across the face window toward the far side (1.3); at eye level it sits 1 px inside the far eye's inner corner |
| Near eye | 6 px wide, its inner corner 2-3 px from the centre line |
| Far eye | 4-5 px wide (1-2 px narrower than the near eye), inner corner 1 px from the centre line, 0-1 px shorter |
| Gap between the eyes | 3-4 px (less than one eye width in 3/4, because it foreshortens); 5-6 px (one eye width) in front view |
| Nose mark | on the centre line, 1 px toward the far side |
| Mouth | centred 0-1 px nearer the middle than the nose; its far half 1 px shorter |
| Chin point | 2-4 px wide, 1-2 px toward the far side of the face window's middle |
| Far cheek | the far contour bulges 1 px outward over rows 8-10 (the cheekbone), then angles in to the chin |
| Jaw taper | starts at the eye bottom row; no straight vertical contour longer than 3 rows under the eye |

### 3.2 The eye at 144 (near eye; the far eye is the same minus 1-2 columns)

Drawn as a box 6 wide × 5 tall, rows counted from the top:

| Row | Content |
|---|---|
| 1 | Upper lash, OL, 4-5 px, starting 1 px in from the inner corner |
| 2 | Upper lash second row, OL, across the outer ⅔; the outer end flicks 1 px up and out past the box (resolute: flat; soft: down) |
| 3 | Iris top: dark tone (I4 or A2-dark), with the **highlight** (A5, 1 px) on the lit side, touching the white or the lash, never floating mid-iris |
| 4 | Iris mid, A2; the white (W1/W2, 1-2 px) on the side **opposite** the gaze |
| 5 | Iris bottom, the light tone (A3/A4); the lower lash is 1 px (S4 or I3) at the outer lower corner, never a full row |

- **Iris width** 3 px (near) and 2-3 px (far). The iris always touches the upper lash: an iris
  floating with white above it reads as shocked or crazy (1.4). [S, I]
- **Both irises shift the same direction by the same amount.** For a gaze at the viewer from a
  3/4 head turned screen-right, both irises move 1 px toward screen-left in their boxes, so both
  whites end up on the screen-right side (the near eye's white on its nose side, the far eye's on
  its outer side, toward the face edge). For a gaze where she faces, both irises move toward
  screen-right and both whites sit on the screen-left side. The whites are never on the nose
  side of both eyes at once. [S, make.art.alive; I for the pixel rule]
- **Highlight on the same side in both eyes**, the side of the key light (upper front, on the
  side she faces: DESIGN section 9). Never mirrored. [S, Konart; I]
- **Tones:** 3 iris tones plus 1 highlight, plus 1 white and optionally 1 shaded white. 5-6
  colours per eye, all already in the palette. [I, within REF-BREAKDOWN's 2-3 iris tones]
- **Pupil:** optional. If used, 1 px of the darkest iris tone in row 3-4, in the gaze direction.
  Never on the calm face if it would make the iris look pinned. [S, make.art.alive; I]

### 3.3 Brows, nose, mouth, blush, skin

| Part | Rule | Colour |
|---|---|---|
| Brows | 3-4 px, 1 px thick, 2-3 rows over the lash top; neutral has a 1 px arch with the peak over the outer third; far brow 1 px shorter and shifted outward. Always present: drawn over the bangs where the bangs cover the brow line (refs 07-09 do this) | OL over hair, I3 on skin |
| Nose | 1 px (front) or a 1 × 2 vertical mark (3/4), 3-4 rows under the eye bottom | S3 |
| Mouth, calm | 2-3 px with one corner raised 1 px, on the near side for a confident smirk | S4, the raised corner in S3 |
| Mouth, open | 2 × 2 or 3 × 2, with SB for the tongue | S4 + SB |
| Blush | a 2-3 px diagonal hatch (not a solid bar), 1-2 rows under the eye bottom, under the outer half of each eye; the far one 1 px shorter | SB |
| Skin | flat S2 under the lash line; S1 only on the lit cheek (2-4 px cluster); one S3 cluster under the far cheekbone and one S3 row under the jaw; S4 under the chin on the neck | S1-S4 |
| Face outline | no dark line inside the face. The face edge against the background uses the silhouette OL; against hair, the hair's own dark tone is the edge. A far-jaw line, if needed, is S3, never S4 (S4 belongs to the mouth) | – |

Contrast checks [M, WCAG contrast ratio on our palette]: S4 on S2 = 2.50 (the mouth reads),
S3 on S2 = 1.42 (the nose and cheek stay quiet, as they should), SB on S2 = 1.46 (blush is a
tint, not a mark), OL on I4 = **1.25** (a lash touching the darkest hair tone disappears into
it: that's why the lash needs a skin pixel or an I2/I1 pixel between it and the fringe).

### 3.4 Hair around the face

| Part | Rule |
|---|---|
| Hair top | 2-3 px of volume above the skull ball; not a cap on the skull line [S, hair tutorials; I px] |
| Bangs | 3-5 clumps, 3-5 px wide at the root, tapering to 1-2 px tips; they start from a parting or the crown, not from a straight helmet edge [S, 1.6; I px] |
| Bang tips | end on the lash row or 1-2 rows into it; never cover the iris; at least one 1-2 px skin gap between clumps above each eye, so the brow and the lash read [I, visible 07-09] |
| Between the eyes | no hair pixel below the lash top in the 3-4 px gap between the eyes, unless it's a deliberate lock that stops at the lash row |
| Sidelocks | cover the near jaw edge if they like, but leave the far cheek and chin contour visible in 3/4 [S, 1.3; I] |
| Separators | clump splits one step darker than the clump's shadow, not OL [REF-BREAKDOWN 01, visible] |

### 3.5 Expressions: what changes, in pixels

Every expression changes at least two of brows, lids and mouth (1.5). [I]

| Expression | Brows | Lids and eyes | Mouth | Head |
|---|---|---|---|---|
| **Confident (idle hero)** | near brow 1 px higher than the far brow; slight arch | open; outer flick up; irises at the viewer | smirk: 2-3 px, near corner up 1 px | tilted 1 px across the eye line, chin slightly down |
| **Focused / attacking** | inner ends 1-2 px lower than the outer ends, 1 px closer together | upper lash flattened to a straight 2-row bar sitting 1 px lower on the iris; lower lid up 1 px (iris shows 2 rows) | pressed 2 px line, or 2 × 2 open with teeth (a W1 pixel) for a shout | chin down 1 px, eyes toward the target |
| **Smiling (radiant, wins)** | raised 1 px, relaxed | closed arcs curving **up** in the middle (∩), or open with the lower lid pushed up 1 px so the eye is a crescent | corners up: a 3-4 px U, or open with SB | tilt 1-2 px |
| **Hurt** | inner ends up 1-2 px (worry angle) | squeezed to a 1 px line, the outer end turned down | 2 px, one corner down, or a small open oval | pushed back |

---

## 4. Negative rules

Each rule says what goes wrong and why.

### Eyes

- **Never let the whites sit on the nose side of both eyes.** The irises then splay outward and
  the face looks at nothing: that's what "dead stare" means in practice. [S, make.art.alive]
- **Never flip a finished eye to make the other one.** Flip the shape if you like, then redo the
  highlight and the iris offset, because both must point the same way in both eyes. [S; I]
- **Never make the far eye the same width as the near eye in 3/4.** It flattens the head into a
  front view pasted on a turned skull. [S, 1.3]
- **Avoid a white row above the iris** on calm and confident faces: it reads as shock. [S, 1.4]
- **Never put the highlight in the middle of the iris or on the lash**, and never in opposite
  corners of the two eyes. [S, Konart]
- **Avoid a 1-px upper lash.** At 144 it reads as a thin eyebrow-like line; the refs use 2 rows.
  [M, 2.2]
- **Never let the lash touch the darkest hair tone without a break.** OL on I4 is 1.25:1, so the
  eye merges into the fringe. [M, 3.3]
- **Avoid a symmetric ∩ lash** (a round arch with both ends equal). Anime eyes are almond-shaped:
  heavy and flicked at the outer end, lighter at the inner end. The round arch makes an owl or
  surprised eye. [I, visible 07-09]

### Placement

- **Eyes too high:** the forehead shrinks and the face reads older and heavier; **eyes too low
  and a short chin:** the face reads childish or squashed. Keep the lash top at about half of
  hair top to chin, and lash top to chin at 0.85-0.95 of the face width. [S, 1.2; M, 2.1]
- **Never centre the nose between the eyes in 3/4**; it goes toward the far eye. [S, Mary Li]
- **Mouths too wide** (over 4 px at 144 when closed) read as a grimace or a cartoon; the mouth
  is the subdued feature in anime. [S, Slynyrd; I on the px number]
- **Noses too drawn** (more than 2 px, or in S4/OL) pull the face toward realism and make it
  look older or dirty. [S, Slynyrd "almost non existent nose"; I on the px]
- **No straight vertical cheek contour** longer than 3 rows below the eyes, and **no flat chin
  row over 4 px wide**: the face becomes a box. [I, M 2.2]

### Shading and pixels

- **No pillow shading:** no S3 ring just inside the face edge. Shade from the key light: one
  side, one cluster. [S, Derek Yu]
- **No 3D banding on the face or fringe:** no parallel equal-length runs of the same tone.
  [S, Lux]
- **No stray pixels inside the face:** every face pixel is either part of a feature (eye, brow,
  nose, mouth, blush) or part of a shading cluster of at least 2 px. [S, Saint11]
- **Never use the mouth colour (S4) for contours** on the face interior: a jaw line in S4 reads
  as a second mouth or a beard shadow. [I, seen on n1_contact, section 5]
- **No hair lock across the eye or down the middle of the face.** A 1 px vertical lock through
  the face reads as a scar or a tear streak, and one through the eye deletes the iris. [I, seen
  on n1_contact]

### Appeal

- **No twinning:** no perfectly mirrored face on a hero drawing. At least one of these must be
  asymmetric: brow height, mouth corner, head tilt, eye width (3/4). [S, Thomas and Johnston]
- **Never change only the mouth** between expressions. [I, from Faigin's zones]
- **Never pair a big smile with neutral eyes**: it reads as fake. [S, Faigin]
- **Never ship a face whose gaze has no target.** In every still, name what she's looking at
  (the viewer, the enemy, the blade) and point both irises there. [I]

---

## 5. The artist's workflow for a face (trial and error)

This is the loop a pixel artist runs, written as steps the construction tools follow.

1. **Put the head on the 3D reference.** Use the render only for the head's position, turn (yaw)
   and tilt (pitch and roll) at sprite size. [I]
2. **Draw the construction layer:** the ball, the side-plane oval, the curved centre line, the
   brow line, and the chin, nose, mouth and eye rows from table 3.1, as a separate guide layer
   that never ships. [S, Proko; I]
3. **Block the negative space:** mark the keep-out zones (no hair between the eyes below the
   lash, no dark pixels in the cheek zone except blush, the iris box can't be covered) and the
   must-have zones (brow, both whites on the same side, highlight, mouth corner, chin point, far
   cheek bump). [I, from section 4]
4. **Place features, then try 3 variants** of each expression that differ on one axis only (eye
   height ±1, iris offset, brow angle, mouth corner). [S, Saint11 "draw the same subject many
   times"; I]
5. **Judge side by side at 1x, 3x and 6x** next to the 07/08/09 face crops at the same scale,
   and blurred. [S, Azzi]
6. **Flip test:** mirror the whole head and look again. Wonky construction jumps out when
   flipped. [I, common artist practice; no source read for it]
7. **Keep the winner, write down why** in the stamp's `_doc`, and record the loser too.

---

## 6. Self-check before a face is done

Run every line on the face at 6x and again at 1x. A "no" anywhere means it isn't done.

- [ ] Lash top to chin ÷ face width is 0.85-0.95. Lash top is 13-15 rows above the chin.
- [ ] Both irises are offset the same way; I can say what she's looking at.
- [ ] The highlight is on the same side in both eyes, on the key light's side.
- [ ] Upper lash is 2 rows on the outer ⅔ with a flick; the lower lash is 1 px, not a row.
- [ ] In 3/4 the far eye is 1-2 px narrower than the near one; the far brow is shorter.
- [ ] Brows are visible (over the bangs if necessary) and their angle fits the expression.
- [ ] The nose is 1-2 px of S3, placed toward the far eye in 3/4.
- [ ] The mouth is 2-4 px, with a bent corner or a curve; nothing else on the face is S4 except
      the lower-lash dot and the under-chin shadow.
- [ ] The chin narrows to 2-4 px and sits toward the far side in 3/4; no straight cheek run over
      3 rows.
- [ ] No hair pixel between the eyes below the lash top; no lock crosses an eye.
- [ ] At least one skin gap between bang clumps above each eye.
- [ ] No orphan pixels, no pillow ring, no banded parallel runs on the face or fringe.
- [ ] The expression changes at least two of brows, lids and mouth compared with the idle face.
- [ ] At least one asymmetry (tilt, brow height, mouth corner) on hero drawings.
- [ ] Next to 07/08/09 at 3x, a stranger would call hers the same kind of face, not a mask.

---

## 7. What the round-4 Rosace violates

Evidence is from the round-4-fix renders at 144 (`dex-place-art/rosace/build/renders/r4fix/*/px144/still.png`,
read with `tools/art-construct/face_map.py … --palette art/rosace/palette.json`) and the stamp
files in `art/rosace/faces/`. Sheets: `review/rosace/round-4/face_library_144_x10.png`,
`review/rosace/round-4-fix/ab_idle_vs_ref07_144_x6.png`.

Ranked by how much each one contributes to "blank stare, no charisma". [I on the ranking]

1. **Divergent gaze.** Idle (`q34_serene_144`): the near eye's iris is at x41-43 with the white
   at x44 (nose side); the far eye's white is at x49 (nose side) with the iris at x50-51. Both
   whites face the nose, so the eyes splay outward. The near eye alone is right for a gaze at
   the viewer; the far eye is the one pointing away (its white belongs at x52, its iris at
   x49-51). The front stamp repeats the split on both sides (`front_serene_144`, stamp row
   `OOaaaw..waaaOO`). [M] Breaks 3.2 and section 4's first eye rule.
2. **No brows on the idle face.** The serene stamps have no `R`/`r` pixels; only the resolute
   ones do. PIPELINE 3.2's own spec asks for brows at 144. [M] Breaks 3.3.
3. **Flat mouths.** Serene is `mm` (2 px flat, x48-49 y76); radiant's smile is `mmm` flat with a
   tongue pixel under it, which reads as a line, not a smile. PIPELINE 3.2 asks for "an upturned
   corner". [M] Breaks 3.3, 3.5 and "never pair a big smile with neutral eyes".
4. **Squat face.** Lash top to chin is 11 px against 13-14.5 on the refs; the ratio to face width
   is 0.69 against 0.87-0.91. [M, 2.1] Breaks 3.1.
5. **Boxed contour.** The near-side contour is a straight S3 column at x38 for 7 rows (y69-75),
   and the chin's bottom row is 7 px wide (x44-50, y79). No cheek bump on the far side. [M]
   Breaks 3.1 "jaw taper" and 4 "no straight cheek contour".
6. **Twinned eyes.** Near 6 × 4, far 5 × 4, same lash shape mirrored, same height, level eye
   line (both lash tops at y68). The refs tilt the eye line by 1 px [M, low confidence]; their
   near/far width difference is also only about 1 px at this size, so the larger gain here is
   the tilt and a non-mirrored lash, not a smaller far eye. [M] Breaks 1.7 and 3.1.
7. **Thin, round lash.** The upper lash is 1 row (`OOO` over `O…O`), an even arch with no
   flick. It reads as surprised or owl-like, and where it meets the fringe it merges (OL on I4 =
   1.25:1; at x40-41 y68-69 the lash runs straight into I-tone hair). [M] Breaks 3.2 and two
   eye rules in section 4.
8. **Hair in the face.** Idle: a bang tip in I0-I2 runs down between the eyes to y70 (x47,
   y68-70), the eye-row level, so it reads as a mark on the nose bridge. Attack
   (`n1_contact`, `q34_resolute_144`): a 1 px lock in I1/I2 runs down x87-88 from the fringe to
   y29, through the near eye (the iris is replaced by hair pixels at y26) and down the cheek like
   a scar. [M] Breaks 3.4 and "no hair lock across the eye".
9. **S4 used as contour.** Attack face: S4 pixels at x96 y27-30 and x83 y29-30 make the jaw
   edges the same colour as the mouth (x91-92 y30), so the face has three "mouth" marks. [M]
   Breaks 3.3 "face outline".
10. **Expressions change one zone.** Serene to resolute changes brows and lids but keeps the
    same 2 px mouth; serene to radiant changes the eyes and mouth but has no brows at all. The
    idle has no asymmetry anywhere. [M on the stamps] Breaks 3.5 and "no twinning".
11. **Helmet fringe.** The bangs come down to the lash row as one mass from x32 to x53, with 1 px
    S3 notches as the only breaks (y66-68). No clump reads with a root and a tip, and there's no
    forehead window above either eye. [M] Breaks 3.4.

What's already right, and should be kept: 3 iris tones plus a highlight; the highlight on the
same side in both eyes (x43 and x51, both on the right); the nose placed toward the far eye (x49);
the 4 px gap between the eyes; the flat S2 skin under the lashes; the colours themselves. [M]

---

## 8. Open questions

- Chin down or eye row up? Both fix 2.1. Chin down keeps the forehead and fringe the critics
  already accept; eye row up keeps the body untouched. Recommend chin down 2 px plus eye row up
  1 px, then A/B. [I]
- The eye-line tilt on the refs (1 px) is at the edge of what WebP noise lets us measure. Confirm
  it on the 07/08 portrait sheets, which are larger, before making it a lock. [unknown]
- st0ven's fighter-face tutorial should be read by hand (1.9) and folded in if it adds anything.
