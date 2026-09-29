# Art rules: figure, gesture, posing, hands and weapon grip

**The short answer.** Round 4 fails as a *figure* before it fails as a render. She stands like a
shop-window mannequin because her shoulder and hip lines are both level and her knees are both
locked. Her arms leave no gap against her body. The glaive stands almost vertical beside her like
a flagpole. Each hand is a solid block with no thumb. Every tutorial below agrees on the fix:
build the pose from one curved line of action, tilt the shoulders and hips in opposite
directions, put the weight over one foot, then design the empty shapes between the limbs as
carefully as the limbs. The hands and the weapon come last, and they follow the body.

This file turns that into rules we can check: measured numbers at our size, "never do this"
rules, a checklist to run before calling a drawing done, and a list of what round 4 breaks.
It covers the body, not the face (the face is a separate research area with its own rules file). Everything
here applies whether or not the 3D base is good. The 3D render gives perspective, proportion and
timing. It never decides the pose's attitude.

Companions: `../DESIGN.md` (the canonical design), `../QUALITY-RUBRIC.md` (the A/B bar),
`../CRITIQUE-PARAMS.md` (parts 5–10, 13 and 19 are what this file serves),
`../REF-BREAKDOWN.md` (ref measurements). References are named by filename, never embedded.
Study crops made for this file are in `review/rosace/construct/research/` (git-ignored).

## Tags and units

- **[M]** measured by me on the files named. Unless it says otherwise, "by eye" means read off a
  gridded crop (`review/rosace/construct/research/*_grid_*.png`) to about ±2 px, and "script"
  means counted by a script on the native-grid panel.
- **[S#]** sourced: the number points to the source list in section 1. A short quote is in
  quotation marks; everything else is my paraphrase.
- **[S#, secondary]** the claim came from a summary of that source, not from reading the source
  itself. Treat it as weaker.
- **[visible]** seen on an image, not measured.
- **[I]** my inference or proposal. **Any number tagged [I] is a starting value to A/B, not a
  fact.**

Units: **H** = her height, skull top to sole, weapon excluded = **144 px**. **h** = one head,
skull top to chin = **24 px** (so 6 heads tall; refs 07/08/09 run 5.7–6.3 heads with 24–25 px
heads [M, REF-BREAKDOWN]). The degrees in this file are measured on the pixel grid.
"Sagitta" means how far a curve bows away from the straight line joining its two ends.

---

## 1. Sources

Teaching sources I read (or, where marked, only saw summarised). All accessed 2026-09-29.

| # | Author, title | URL | Used for |
|---|---|---|---|
| S1 | Stan Prokopenko, "How to Draw Gesture" (Proko) | https://www.proko.com/course-lesson/how-to-draw-gesture | line of action, C/S/I curves, symmetry makes a "snowman", exaggerate |
| S2 | Steven Michael Hampton, "What You Need To Know About Gesture" (Proko); his book *Figure Drawing: Design and Invention* (2009) | https://www.proko.com/course-lesson/what-you-need-to-know-about-gesture | straights against curves, offset apexes, avoid parallel forms |
| S3 | Stan Prokopenko, "How to Simplify the Motion of the Torso – The Bean" (Proko) | https://www.proko.com/course-lesson/how-to-simplify-the-motion-of-the-torso-the-bean/ | rib cage and pelvis as two masses; pinch and stretch; twist makes an S |
| S4 | Stan Prokopenko, "How to Draw Structure in the Body – Robo Bean" (Proko) | https://www.proko.com/course-lesson/how-to-draw-structure-in-the-body-robo-bean/ | female rib cage narrower, pelvis wider; planes show tilt, lean, twist |
| S5 | Vladimir London, "Contrapposto" (Life Drawing Academy) | https://lifedrawing.academy/drawing-lessons/contrapposto | shoulders oppose pelvis; supporting leg is vertical; knee level; torso pinch |
| S6 | Anime Art Academy, "Using contrapposto to create beautiful standing poses for women" (Anime Art Magazine) | https://animeartmagazine.com/using-contrapposto-to-create-beautiful-standing-poses-for-women/ | centre of gravity behind the navel, over the weight foot; S-line appeal |
| S7 | Anime Art Academy, "Head to body ratio" (Anime Art Magazine) | https://animeartmagazine.com/head-to-body-ratio-this-simple-anime-illustration-technique-will-give-you-perfect-proportions-every-time/ | crotch and wrists at half height; thigh = calf; elbow at waist; torso thirds |
| S8 | Stan Prokopenko, "How to Draw Accurate Proportions" (Proko) | https://www.proko.com/course-lesson/how-to-draw-accurate-proportions | negative shapes, the hole between arm and body |
| S9 | Peter Han, "How to Draw Wide-Angle Poses" (Proko) | https://www.proko.com/course-lesson/how-to-draw-wide-angle-poses-with-peter-han | foreshortening: near part bigger, overlap |
| S10 | Stan Prokopenko, "How to Draw Hands from Imagination – Step by Step" (Proko) | https://www.proko.com/course-lesson/how-to-draw-hands-from-imagination-step-by-step | palm box, mitten, thumb wedge, wrist step |
| S11 | Stan Prokopenko, "How to Draw Hand Bones" (Proko) | https://www.proko.com/course-lesson/how-to-draw-hand-bones-anatomy-for-artists/ | hand length = face length; knuckles at half; curved knuckle line |
| S12 | Frank Thomas and Ollie Johnston, *The Illusion of Life* (1981), via Wikipedia's "Twelve basic principles of animation" | https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation | "twins" look lifeless; appeal = charisma; exaggeration; staging |
| S13 | Jason Mitchell, Moby Francke, Dhabih Eng (Valve), "Illustrative Rendering in Team Fortress 2", NPAR 2007 | https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf | characters readable in pure silhouette [secondary] |
| S14 | Michael Azzi, *Pixel Logic: A Guide to Pixel Art*, ch. 4 "Readability" (silhouette section with Glauber Kotaki) | https://michafrar.gumroad.com/l/pixel-logic | rough silhouette first; avoid overlaps, or separate them with colour [secondary] |
| S15 | Raymond Schlitter (Slynyrd), "Pixelblog 52 – Idle Fighting Stance" | https://www.slynyrd.com/blog/2024/9/26/pixelblog-52-idle-fighting-stance | idle loop pixel offsets and timing |
| S16 | Raymond Schlitter (Slynyrd), "Pixelblog 17 – Human Anatomy" | https://www.slynyrd.com/blog/2019/5/21/pixelblog-17-human-anatomy | wireframe → rough shapes → final form; 6-head model for pixel art |
| S17 | Pedro Medeiros (Saint11), "Character Idle" and "<1 pixel movement" | https://lospec.com/pixel-art-tutorials/character-idle-by-pedro-medeiros | idles move less than a pixel per frame, so fake sub-pixel motion [secondary: the tutorial is an animated image I could not read] |
| S18 | Game Developer staff roundup, "What makes a great idle animation? Devs share their favorites" (21 May 2018) | https://www.gamedeveloper.com/art/what-makes-a-great-idle-animation-devs-share-their-favorites | idles show personality (Darkstalkers 3); Dudley's three-pose readiness loop |
| S19 | Katarina Svarc, "Drawing Gun Holding Poses" (PoseMy.Art blog) | https://posemy.art/blog/drawing-gun-holding-poses/ | body first, hands last; the weapon's weight changes the spine; mistakes |
| S20 | Giacomo di Grassi, *Ragione di adoprar sicuramente l'Arme* (1570), via Wikipedia | https://en.wikipedia.org/wiki/Ragione_di_adoprar_sicuramente_l%27Arme,_si_da_offesa_come_da_difesa | two-hand spear grip: rear hand near the butt at the belly or hip, front hand about a foot up |
| S21 | Wikipedia, "Chūdan-no-kamae" (naginata section) | https://en.wikipedia.org/wiki/Ch%C5%ABdan-no-kamae | polearm mid-guard: hands shoulder-width apart, rear hand at the hip crease |
| S22 | Ryu, Cooney, Askew, An and Chao, "Functional ranges of motion of the wrist joint", *J. Hand Surgery* 1991 | https://pure.johnshopkins.edu/en/publications/functional-ranges-of-motion-of-the-wrist-joint/ | how far a working wrist actually bends |
| S23 | Steven Michael Hampton, "Intro to Pipe Folds and Diaper Folds" (Proko, *Drapery Fundamentals*) | https://www.proko.com/course-lesson/intro-to-pipe-folds-and-diaper-folds | tension points; pipe and diaper folds; folds wrap the form |
| S24 | Neil Blevins, "Composition: Tangents" (Soulburn Studios art lessons) | https://artofsoulburn.com/art_lessons/composition_tangents/composition_tangents.htm | tangent definition and fixes |

Sources I looked at and left out: generic "how to draw anime girls" blogs (they repeat S7 with
less rigour), and pose-reference galleries (reference, not teaching). No brief-listed
pixel source (Brandon James Greer, AdamCYounis, MortMort, Lospec) turned up a *hands* or
*posing* lesson I could read as text, so the pixel-scale hand numbers below come from our refs
[M], not from a tutorial.

---

## 2. Principles, with sources

### 2.1 Gesture first: one line of action, curves against straights

- **Find one line that runs head to toe.** "Try to find a curve that could connect the head to
  the toes" [S1]. Not every pose has one unbroken line, but every pose has one main direction.
- **Use only three kinds of line: straight, C, and S.** "Don't use anything more complicated than
  a C curve, S curve, or straight" [S1]. Hampton uses the same three and saves the straight for
  weight and bone [S2].
- **Asymmetry is the whole point.** Mirrored curves stiffen a figure "and makes the figure look
  like a snowman" [S1]. Hampton: "By offsetting curves and apexes in the body, I create a natural
  interest and movement" [S2].
- **No parallel forms.** "I avoid parallel forms, as they create closure and reduce the sense of
  movement" [S2]. For us that includes a haft parallel to a leg, and an arm parallel to the haft.
- **Push it.** "It's a good idea to exaggerate the pose to tell a better story" [S1]; a perfect
  copy of reality "can look static and dull" [S12].
- **Pixel artists do the same, in the same order.** Slynyrd works "wireframe, rough shapes, final
  form", and his first mark can be a single stroke for the spine's gesture [S16]. Azzi: rough
  silhouette first, detail after [S14, secondary].

### 2.2 Contrapposto, balance and weight

- **Shoulders tilt against the hips.** "In contrapposto, the tilt of the shoulders opposes the
  tilt of the pelvis" [S5]. "Ribs and pelvis are tilted in opposite directions" [S6].
- **The weight leg is vertical.** Its axis runs straight "from the hip joint to the footprint"
  [S5]. The other leg relaxes.
- **The torso pinches on one side and stretches on the other.** The rib cage comes "very close to
  the pelvis at the compressed side" [S5]; in any tilt "there will always be a compressed side
  and a stretched side" [S3].
- **Balance check.** The centre of gravity sits "behind the belly button" and has to line up with
  the weight foot [S6]. The usual studio check is a plumb line dropped from the pit of the neck
  onto the weight foot. I found that phrasing only in summaries, so it is [S5/S6, secondary],
  but it follows from the two quotes above.
- **Why it's attractive.** The S curve of opposed tilts gives a "flexible, dynamic, attractive
  pose" that "shows off the curves of the body" [S6]. That's rubric part 12 (appeal) for free.

### 2.3 Masses, twist and foreshortening

- **Three masses on one spine: head, rib cage and pelvis** [S3]. They tilt, lean and twist
  independently. In a twist "the centerline is now an S shape rather than a C" [S3].
- **Female torso: the rib cage is narrower and the pelvis wider** [S4]. That's the hourglass,
  built into the construction rather than painted on as a contour.
- **Planes show the motion:** corners show tilt, top and bottom planes show lean, side planes
  show twist [S4]. At pixel scale these become 1 px value changes. For example, a twisted rib
  cage shows more of one side plane in the shadow tone.
- **Foreshortening:** "the closer part of a form appears larger", and overlap sells depth: "When
  the shapes partially hide one another, the depth is more convincing" [S9]. For a thrust toward
  the camera, the near fist and the near end of the haft get bigger and overlap the arm.

### 2.4 Silhouette and negative space

- **A character should read in pure silhouette.** Valve designed the TF2 classes so that "even
  when viewed only in silhouette … the characters are readily identifiable" [S13, secondary].
  Our rubric's silhouette test says the same (QUALITY-RUBRIC section 1).
- **Negative shapes are designed, not leftover.** "If I put my fist up on my hips this hole
  between my arm and my body is a negative shape!" and "even if you're drawing from imagination
  you should still consider those negative shapes and design them to look good" [S8].
- **Don't stack things on top of each other.** If you must overlap, separate the parts with
  colour contrast [S14, secondary]. On a white costume that means value: see 3.6.

### 2.5 Tangents

- A tangent is "an area where two things in an image are nearly touching or actually touching,
  and in doing so create a visual mistake" [S24]. The fix is to **separate them clearly or
  overlap them clearly** (or, last resort, lower the contrast between them) [S24].
- Figure tangents that matter for us [I]: haft edge running along a leg edge; sleeve edge touching
  the haft; hair edge touching the shoulder line; the blade tip touching the head outline; a
  hand edge flush with the hip contour; feet touching the ground shadow edge exactly.

### 2.6 Proportions: anime and gacha

- **Midpoint rule.** Split the height in half: "the character's crotch and wrists should sit
  directly on this middle line" [S7]. Thigh and calf are the same length [S7]. The elbow sits at
  the waist [S7]. The torso splits into equal thirds: chest, abdomen, pelvis [S7].
- **Knee height.** Halve the distance from the top of the foot to the middle of the figure: that
  is the knee [S5].
- **Head count.** S7 gives 7–8 heads for adults and 6–6.5 for teens. Slynyrd argues a
  6-head model suits pixel art better than 8 because a bigger head carries expression in few
  pixels [S16]. Our refs are 5.7–6.3 [M, REF-BREAKDOWN]. **Keep 6.0**: the long legs come from
  the midpoint rule, not from shrinking the head [I].
- **Neck.** Slynyrd's realistic neck is 1/2–2/3 of a head wide [S16]. Anime women run slimmer;
  see the table.

### 2.7 Appeal, twins and attitude

- **"Twins" look lifeless.** Johnston and Thomas warned against characters "whose left and right
  sides mirrored each other, and looked lifeless and dull" [S12]. For poses that covers both arms
  doing the same thing, both legs straight, and level shoulders over level hips.
- **Appeal is charisma.** "Appeal in a cartoon character corresponds to what would be called
  charisma in an actor" [S12]. A pose shows charisma through attitude: a head tilt, a
  cocked hip, an arm doing something with intent.
- **Staging** is making the idea "completely and unmistakably clear" [S12]. An idle has one
  idea (for Rosace: serene, ceremonial, completely sure of herself); every limb should say it.

### 2.8 Cloth that shows the body and the motion

- **Folds come from tension points** where cloth anchors, tugs or meets resistance [S23].
  - *Pipe folds* hang from a line of tension points (a curtain from its hooks).
  - *Diaper folds* hang between exactly two points (a hammock) [S23].
- **Folds wrap the form.** "They wrap around the form underneath" [S23]. A tabard lies over the
  thigh and breaks at the knee. It is not a flat strip hanging in front of the legs.
- For us [I]:
  - Her tension points are the collar, the shoulder armbands, the hip band, the garter ring and
    the knees.
  - The detached sleeve is a diaper fold between the armband and the wrist.
  - The tabard is a pipe fold from the hip band that clings to the weight-leg thigh and swings
    off the free-leg knee.
  - The tilted pelvis tilts the hip band, so the tabard hangs off-centre toward the low hip.

### 2.9 Hands

- **Construction, in order:** the palm is a box about as wide as it is tall. The fingers can be
  grouped as a mitten, and any finger that separates gets drawn on its own. The thumb base is
  "the triangular box", which can be "stretched, squished, and rotated". At the wrist there is
  "a little step down from the forearm to the hand" [S10].
- **Sizes:** "The length of the whole hand is about equal to the length of the face." The
  knuckles sit halfway from the wrist to the middle fingertip, and the knuckle line curves,
  because "the knuckles don't line up horizontally" [S11].
- At pixel scale the mitten is the whole trick [I]:
  - a fist is one mass plus one thumb wedge;
  - an open hand is one mitten plus at most one or two separated fingers;
  - an equal row of four finger bumps reads as a comb or a crown, not a hand.

### 2.10 Holding a long polearm with two hands

- **Body first, hands last.** "Build the pose from the entire body: establish the line of action,
  find the balance, decide where the weight lives", then "let the weapon influence the spine, the
  shoulders, the hips" [S19].
- **Common mistakes** [S19]:
  - soft hands with no tension;
  - wrists bending unnaturally;
  - a weapon that looks weightless;
  - hands, weapon and body drawn as separate pieces.
- **Where the hands go, from people who actually fight with polearms:**
  - di Grassi: the rear hand near the butt and the front hand "about one foot up". The rear hand
    sits "squarely in front of the lower belly, or … closer to the left hip, depending on how
    long the weapon is" [S20].
  - Naginata mid-guard: "Hands should be shoulder width apart", and the trailing hand holds the
    shaft "where the upper leg meets the groin", at waist height [S21].
- **Wrists have limits.** Everyday tasks need up to 60° extension, 54° flexion, 40° ulnar
  deviation (bending toward the little finger) and 17° radial deviation (toward the thumb).
  Most tasks fit in about 40° each way [S22]. A drawn wrist bent further than that reads as
  broken unless the pose is extreme on purpose.

### 2.11 Idle and hero poses that feel alive

- **An idle is a personality test.** In Darkstalkers 3, "every idle animation would tell us a
  little about the character we were using, instead of just being your typical breathing,
  foot-tapping animations" [S18].
  - Dudley (Street Fighter III) does "little alternating steps in his pose to imply readiness",
    and "mixing up the timing of just three poses makes it seem a lot more elaborate than it
    really is" [S18].
  - Slynyrd: an idle loop is "one of the most effective means of displaying personality" [S15,
    secondary for that sentence].
- **How a pixel idle moves** (Slynyrd, a 48×92 px sprite, 8-frame loop) [S15]:
  - "Everything is anchored to the steady motion of the torso."
  - Head and torso rise 1 px; shoulders, elbows and the outer fist rise 2 px; the inner fist
    rises 4 px.
  - The knees take the dip: at the low point "knees drop 1px, fists drop 2px".
  - Frames 1–4 play at 100 ms and frames 5–8 at 50 ms.
  - Cloth "conforms to the figure, while making small sub movements in the wrinkles".
- **Motion under a pixel.** Idles move so little that you often need movement "smaller than one
  pixel", done by shifting colour along an edge rather than moving the whole shape [S17,
  secondary].

---

## 3. Measurable parameters at 144 px

What these tables are for: they turn the sources into pixel numbers a construction script (or a
critic) can check on a single frame. Where a source gives a ratio, I've done the arithmetic for
H = 144 and h = 24. Where no source gives a number, the value is my proposal [I] and should be
A/B'd.

### 3.1 Body landmarks (standing, weight on one leg)

Heights are measured up from the sole; y is from the skull top (y = 0) down.

| Landmark | Rule | At 144 px | Tag |
|---|---|---|---|
| Skull top to chin (h) | 6 heads | 24 px; chin at y 24 | [M, refs] |
| Pit of the neck | 1/3 h below the chin [S5: pit-to-chin fits three times in the head] | y ≈ 32 | [S5] + arithmetic |
| Chest / abdomen / pelvis thirds | equal thirds from the pit of the neck to the crotch [S7] | chest ends y ≈ 45, waist y ≈ 58, crotch y 72 | [S7] + arithmetic |
| Crotch | half of H [S7] | y = 72 (72 px above the sole) | [S7] |
| Wrists, arm hanging | on the midpoint line [S7] | y ≈ 72 | [S7] |
| Elbow, arm hanging | at the waist [S7] | y ≈ 58 | [S7] |
| Knee centre | thigh = calf [S7]; or half-way from the top of the foot to mid-figure [S5] | 38–40 px above the sole (y ≈ 104–106) | [S5, S7] + arithmetic |
| Shoulders / waist / hips, three-quarter view | DESIGN's 128 px values × 1.125 | 27 / 15 / 24 px | [from DESIGN, arithmetic] |
| Neck width | realistic 1/2–2/3 h [S16]; slim for an anime woman | 8–10 px (0.33–0.42 h) | [I] |
| Hand length, wrist to fingertip | = face length ≈ 3/4 h in life [S11] | 18 px is too big at pixel scale; use **10–12 px** | [S11] life value; pixel value [I], sized to the refs below |
| Fist | about a palm-box square plus a thumb wedge [S10] | 7–9 px wide × 6–8 px tall, thumb wedge 2–3 px | [I]; refs' hands by eye are 8–10 px across at h 24–25 [M, by eye, `hands_refs_x10.png`; the refs are soft webp, so ±2 px] |

### 3.2 Pose parameters: idle and hero stills

"Refs" are the idle crops the round-4 sheets use: `07-…_bonus-originalsize_1x.png`
[64,14,178,196], `08-…_bonus-originalsize_1x.png` [180,40,340,222], and
`09-anim-amberowl-katana-cats_1x.png` [60,32,205,215]. "Ours" is the round-4-fix idle at 144
(`review/rosace/round-4-fix/ab_idle_vs_ref07_144_x3.png`, panel A, taken back to its native grid
as `review/rosace/construct/research/r4fix_idle_native.png`).

The refs' numbers set the targets; ours shows how far off round 4 is.

| Parameter | 07 | 08 | 09 | Ours (r4-fix) | Target at 144 | Tag |
|---|---|---|---|---|---|---|
| Feet apart, centre to centre | ≈ 55 px (2.3 h) | ≈ 44 px (1.8 h) | ≈ 57 px (2.3 h) | ≈ 28 px (1.2 h) | combat idle 40–56 px (1.7–2.3 h); demure processional stance 20–30 px, but only with a bent free knee | refs and ours [M, by eye]; target [I] |
| Widest body without the weapon ÷ H | ≈ 0.55 | ≈ 0.38 (0.5 with tail) | ≈ 0.49 (0.7 with coat) | torso + legs + free arm 0.28; the near sleeve adds a spur along the haft | ≥ 0.40 from the body and arms alone | [M, by eye ±0.04]; target [I] |
| Weapon angle at rest, from vertical | ≈ 50° (on the shoulder) | ≈ 56° (held low) | ≈ 16° (low, curved blade) | ≈ 6.5° | 15–35° for a planted processional stance; 40–60° for a carry | [M, by eye ±5°]; target [I] |
| Shoulder axis | tilted [visible] | tilted [visible] | tilted [visible] | level (0 ± 1 px) | 4–10°: a 2–5 px drop across 27 px | direction [S5, S6]; size [I] |
| Hip axis | – | tilted [visible] | – | level: the hip band sits at y ≈ 116 on both sides | opposite to the shoulders, 4–10°: a 2–4 px drop across 24 px | direction [S5, S6]; size [I] |
| Weight leg, hip joint to heel | – | one leg near vertical [visible] | – | one leg vertical, the other straight at about 8° out: both locked | weight leg within 5° of vertical; free knee bent 10–30°, knee 1–3 px lower than the weight knee | [S5]; numbers [I] |
| Plumb line from the pit of the neck | – | – | – | lands on the near foot (x 52 over foot x 45–56) | lands inside the weight foot's footprint, ±2 px | [S5/S6 secondary]; ours [M] |
| Line of action, sagitta | – | – | – | about 6–8 px, all of it from the pelvis shifting sideways; the head is upright over the foot | idle 6–12 px as one C or S from crown to weight heel; strike 15–30 px | ours [M, by eye]; target [I] |
| Head tilt off the neck axis | tilted [visible] | tilted [visible] | tilted [visible] | ≈ 0° | 5–15°, chin 1 px down or turned toward the camera or the target | [I], from S12 |
| Arm–torso gaps in a solid fill | yes (fist arm) [visible] | yes (hand on hip) [visible] | yes (raised open hand) [visible] | **0** | at least 1 in an idle, at least 2 in a hero or strike pose; each ≥ 3 px wide at its narrowest and ≥ 30 px² | ours [M, script: holes 749 px² haft-to-leg and 362 px² leg-to-leg, none at the arms]; target [I] |
| Arm asymmetry | – | – | – | the two arms do different jobs | elbow angles differ by ≥ 30°; hand heights differ by ≥ 8 px | [I], from S12 |
| Weapon-to-body gap, off the grip | – | – | – | ≈ 11 px at hip level, but the sleeve fills it from y 100 to 128 | 4–8 px of clear background (DESIGN section 1), or a clear overlap of ≥ 3 px: never 1–2 px | [S24]; numbers from DESIGN and [I] |

### 3.3 Two-hand grip on the glaive (haft 3 px thick)

| Parameter | Value at 144 | Tag |
|---|---|---|
| Hand spacing, ready or thrust grip | 24–30 px: shoulder width [S21], or "about one foot" [S20], which is 0.185 H at 165 cm = 27 px | [S20, S21] + arithmetic (assumes she is 165 cm) |
| Hand spacing, wide sweep (N5) | up to 40 px (1.5 × shoulders) | [I] |
| Hand spacing, twirl (N3, Q) | both hands within 8–14 px of the haft's middle | [I] |
| Rear hand position | in front of the lower belly, at the hip, or at the hip crease | [S20, S21] |
| Haft through the fists | both fists' centres on the haft line ±1 px; the haft disappears behind the fingers and comes out collinear on the other side | [I] |
| Fist on a 3 px haft | ≥ 7 px tall, so 2 px of knuckles show above the haft and 2 px of fingers below it; the thumb wedge crosses the haft on the near side | [I] |
| Knuckle rows, both hands forward | face the same way | [I] |
| Wrist bend, forearm axis to hand axis | ≤ 40° ulnar, ≤ 17° radial, ≤ 60° extension, ≤ 54° flexion; stay near 40° for anything that has to read as natural | [S22] |
| The weapon's weight in the body | shoulder-carry: that shoulder rises 1–2 px. Low hold: that shoulder drops 1–3 px and the torso leans 3–8° away to counterweight | direction [S19]; numbers [I] |

### 3.4 Hands at pixel scale (144)

| Hand | Construction | Pixels | Tag |
|---|---|---|---|
| Fist on the haft | palm box + mitten of the fingers wrapped around the haft + thumb wedge | 7–9 × 6–8 px, 2–3 px thumb; 1 px darker line (S3 or S4) under the knuckle row, curved, middle knuckle highest | [S10, S11]; pixels [I] |
| Open, relaxed | mitten, fingers slightly curled, thumb apart | 10–12 px long; at most 2 visible finger separations; the fingertip line curves, middle longest | [S10, S11]; pixels [I] |
| Hand on hip | the back of the hand shows; mitten bent at the knuckles, thumb forward or hidden | 8–10 px; the wrist stays in line with the forearm within 30° | [S10, S22]; pixels [I] |
| Tones | 3 skin tones + a 1 px outline; the shadow on the palm side, light on the knuckle plane | 3 + 1 | [I], within DESIGN's S1–S4 ramp |
| Wrist | the forearm steps down 1 px into the hand, on the side the hand bends toward | 1 px | [S10] |

### 3.5 Idle motion (scaled from Slynyrd's 92 px sprite to 144, ×1.57)

| Part | Slynyrd at 92 px [S15] | At 144 [arithmetic, rounded] |
|---|---|---|
| Head, torso | 1 px | 1–2 px |
| Shoulders, elbows, outer hand | 2 px | 3 px |
| Inner or free hand | 4 px | 6 px |
| Knees at the low point | 1 px | 1–2 px |
| Loop | 8 frames; frames 1–4 at 100 ms, 5–8 at 50 ms | same structure; for a serene character slow the second half too (5–8 at 75 ms) [I] |
| Hair and cloth | sub-movements in the wrinkles | lag 1–2 drawings behind the torso (DESIGN section 8) plus colour shifts smaller than a pixel [S17] |

**Signature beat** [I, from S18]: a serene idle still needs one "tell" of who she is. DESIGN's
staff turn every 6 s is it. Give it three held poses with uneven timing (Dudley's trick) rather
than an even rotation.

### 3.6 Value separation for overlapping parts (the white-on-white legs)

Why this is here: S14 says overlapping parts need colour contrast to read. On a mostly white
costume that has to come from value. The numbers below are WCAG contrast ratios between
DESIGN's palette entries [M, computed from the hex values].

| Pair | Contrast | Reads as a separate shape at 1 px? |
|---|---|---|
| W1 against W2 | 1.30:1 | no |
| W1 against W3 | 1.94:1 | only as a broad shape |
| W1 against W4 | 3.37:1 | yes |
| W2 against S2 (stocking shadow against skin) | 1.02:1 | no: hue only |
| W1 against I2 | 6.84:1 | yes |

Rule [I]: wherever one white part overlaps another (tabard over thigh-high, sleeve over tabard):
- the back part steps down at least two ramp steps (W1 → W3), **or**
- a 1 px W4 contact line sits where they meet (DESIGN section 11 already allows W4 selective
  lines on white), **or**
- a dark accent (I2–I4 lining, OL) runs between them.

The gap between her legs gets a dark value (W4 inner-thigh shadow or the tabard's inner edge),
never W2 next to W2.

---

## 4. Negative rules: never, and avoid

Each rule says why. "Never" breaks the read at game size. "Avoid" is allowed only on purpose
and should be flagged in the pose's notes.

**Never**

1. **Never level shoulders over level hips in a standing pose.** Parallel axes are the textbook
   stiff pose [S5, S6], and a matched pair of level lines is a "twin" [S12].
2. **Never lock both knees in an idle.** With both legs straight, the weight looks even and the
   pose goes static. Contrapposto needs one relaxed leg [S5].
3. **Never mirror the arms or the legs.** No two arms doing the same thing, and no two straight,
   equally angled legs [S12].
4. **Never close the arm against the body in a key pose.** With no hole between arm and torso,
   the arm vanishes into the silhouette. Design that negative shape [S8]; rubric 1 fails
   "limbs … across the torso".
5. **Never run the haft parallel to the torso, a leg, or an arm within 10°**, unless it overlaps
   them clearly. Parallels "create closure" [S2], and a near-vertical staff beside a vertical
   body is the "flagpole".
6. **Never let the weapon float.** At least one hand wraps the haft, and the haft is hidden
   behind the fingers and comes out collinear [S19; DESIGN section 7].
7. **Never draw a fist as a rectangle with no thumb or knuckle direction.** It's a block [S10].
8. **Never bend a wrist past the S22 limits** (40° ulnar, 17° radial, 60° extension, 54°
   flexion) unless the drawing is a smear or impact frame where the break is the point.
9. **Never put a pose's plumb line outside the supporting foot** unless she is falling, leaping,
   or pushing off on purpose [S5, S6].
10. **Never leave a 1–2 px sliver of background between two parts** (haft and leg, sleeve and
    haft, hair and shoulder). That's a tangent: separate them by at least 4 px or overlap them
    by at least 3 px [S24].
11. **Never let one white part overlap another with less than a two-step value difference** and
    no contact line (section 3.6).
12. **Never let cloth hang straight through a tilted pelvis.** The hip band follows the pelvis,
    and the tabard hangs from it off-centre and wraps the thigh [S23].

**Avoid**

13. **Avoid a head held perfectly upright and facing straight out** in hero and idle poses. Tilt
    it 5–15° or turn the chin. Attitude lives in the head–neck angle [I, from S12].
14. **Avoid the weapon crossing the torso's centre band** (±3 px either side of the centreline,
    from chest to crotch) in an idle. Crossing it hides the costume's key read (the collar cross,
    chest window and tabard) and flattens the silhouette [I, rubric 1].
15. **Avoid hair masses that fill the neck and shoulder gap on both sides.** Keep at least 2 px of
    neck or shoulder visible on one side, so the head sits on the body instead of on a column
    [I].
16. **Avoid a straight line from the blade tip through the arm to the far shoulder** (the "coat
    hanger"). Break it at the elbow or the wrist so the weapon reads as held, not grown from the
    arm [I, S2 on straights].
17. **Avoid an even row of four finger bumps** on an open hand [I, S10: mitten plus separated
    fingers].
18. **Avoid a torso that stays upright while the legs lunge.** The spine should lean into the
    thrust along the line of action [S1, S19].

---

## 5. Self-check before calling a drawing done

Run these in order. Each one is quick and pass/fail. If one fails, go back to the step it
belongs to. Don't patch it in the pixels. The order follows the sources' order
(gesture → masses → silhouette → hands and weapon → cloth → detail) [S1, S16, S19].

**A. Gesture (on the wireframe, before any shapes)**
1. Can I draw one C or S from the crown to the weight heel? Is its sagitta inside section 3.2's
   range?
2. Do the shoulder and hip axes tilt opposite ways, each by 2 px or more?
3. Does the plumb line from the pit of the neck land on the weight foot?
4. Is one leg vertical from hip to heel and the other bent?
5. Is the head tilted or turned off the neck axis?

**B. Masses and proportion**
6. Is the head 24 px? Crotch at y 72 and the knees at 38–40 px above the sole?
7. Does the rib cage read narrower than the pelvis, with a waist about 15 px wide?
8. In a twist, does the centreline change from a C to an S [S3]?

**C. Silhouette (fill her solid, view at 1x and 3x)**
9. Does she read as the action and facing without any interior detail?
10. Is there at least one arm–torso gap (two in a hero or strike pose), each ≥ 3 px wide?
11. Is there a gap between the legs somewhere below the knee?
12. Is the weapon clear of the body by 4–8 px, or overlapping it by 3 px or more? Never 1–2 px.
13. Flip it horizontally. Does anything look lopsided that I stopped seeing? (A studio habit, [I].)

**D. Hands and weapon**
14. Does each gripping hand wrap the haft, with a visible thumb wedge and a curved knuckle row?
15. Are both fists on one straight haft line, ±1 px?
16. Is the grip spacing right for the move (section 3.3)?
17. Is every wrist bend inside the S22 limits?
18. Does the weapon's weight show in the shoulders or the lean?

**E. Cloth**
19. Does every fold start at a tension point: collar, armband, hip band, garter, knee?
20. Does the tabard follow the pelvis tilt and wrap the weight thigh?
21. Is every white-on-white overlap separated by value (section 3.6)?

**F. Attitude and appeal (at 3x, next to 07/08/09)**
22. Cover the face. Does the body alone say "serene, certain, ceremonial"?
23. Is there any twin left (a matched pair of limbs or lines)?
24. Would a critic call it stiff? If there's any doubt, push the tilts and the line of action one
    step further and A/B both versions [S1: exaggerate].

---

## 6. What round 4 breaks

This section checks the round-4 and round-4-fix stills against the rules above.

**Files checked:**
- `review/rosace/round-4/` and `review/rosace/round-4-fix/`: the idle, attack, skill and back
  sheets at 144, plus `hand_library_x10.png`.
- The native panels I pulled out of them: `review/rosace/construct/research/r4fix_*_native.png`.
- The solid fills: `r4fix_silhouettes_idle_attack_back_x3.png`.

The round-4 idle (before the fix) has the same stance, so everything below applies to both
unless noted. The one difference is worse: in round 4 the free arm hangs straight down against
the body, and the glaive stands even closer to her and more upright
(`review/rosace/construct/research/r4_vs_r4fix_idle_x3.png`) [visible].

### Idle (`ab_idle_vs_ref07_144`, `ab_idle_vs_ref09_144`)

| # | Violation | Evidence | Rules |
|---|---|---|---|
| 1 | Shoulders and hips both level: the mannequin read | shoulder line at y ≈ 92 on both sides; hip band at y ≈ 116 on both sides [M, by eye] | 4.1, 3.2 |
| 2 | Both knees locked; the free leg only angles about 8° outward | legs straight from the thigh to the boot [M, by eye] | 4.2, 4.3 |
| 3 | Glaive at about 6.5° from vertical, standing apart from her: the flagpole | butt at about (38, 200), disc at about (22, 60) [M, by eye]; refs are 16–56° | 4.5, 3.2 |
| 4 | Silhouette is a column: no arm–torso gap at all | solid fill shows 0 arm holes; only haft-to-leg (749 px²) and leg-to-leg (362 px²) [M, script]; the hand-on-hip arm is sealed by the sleeve [visible] | 4.4, 3.2 |
| 5 | Body width 0.28 H against the refs' 0.38–0.55 | [M, by eye] | 3.2 |
| 6 | The near sleeve hangs along the haft like a spur and fills the staff-to-body gap from y 100 to 128 | [visible, `r4fix_idle_grid_x6.png`] | 4.10, 2.5 |
| 7 | Head upright, facing straight out, no tilt | [visible] | 4.13 |
| 8 | Hair mass fills both sides of the neck down to the shoulders, so the head sits on a column | [visible, silhouette] | 4.15 |
| 9 | White-on-white legs: thigh-highs (W2/W3) beside a W1 tabard, with the tabard filling the gap between the legs down to y ≈ 176 | [visible, `r4fix_idle_lower_grid_x6.png`]; W1/W2 is 1.30:1 [M] | 4.11, 3.6 |
| 10 | The free hand is on the hip, but DESIGN section 1 puts it at the collar cross. The collar cross itself doesn't read (a gold blob at the throat, y 84–90) | [visible] | DESIGN §1, §3 row 1 |
| 11 | Tabard hangs straight and flat down the middle; it doesn't wrap the thigh or react to the pelvis | [visible] | 4.12 |

### Attack (N1 contact, `ab_attack_vs_ref08_144`)

| # | Violation | Evidence | Rules |
|---|---|---|---|
| 12 | Haft horizontal (0°) and running across the pelvis: the weapon cuts the body in half | haft at y ≈ 64–70 across the hips [M, `r4fix_attack_grip_grid_x8.png`] | 4.14, 4.5 |
| 13 | Torso upright while the legs lunge: no lean into the thrust, so no line of action through the spine | [visible] | 4.18 |
| 14 | The forward arm lies along the haft: parallel lines and no clear fist, which reads as a flagpole grip | [visible] | 4.5, 4.6, 4.16 |
| 15 | Hands can't be told apart at 3x; the grip spacing can't be read | [visible] | 3.3, 3.4 |
| 16 | Silhouette: arms, head and haft merge into one mass; the only hole is 63 px² | [M, script] | 4.4 |

### Back and three-quarter-away (`ab_back_vs_ref09_144`)

| # | Violation | Evidence | Rules |
|---|---|---|---|
| 17 | One straight line from the blade tip through both arms (the coat hanger); no hand shows at the grip, so the weapon looks grown from the sleeve | [visible; silhouette] | 4.16, 4.6 |
| 18 | Body a vertical column with the legs scissored under it; no weight shift, no twist between rib cage and pelvis, though the pose turns away | [visible] | 4.1, 2.3 |

### Skill (`ab_skill_vs_ref08_144`)

| # | Violation | Evidence | Rules |
|---|---|---|---|
| 19 | Glaive planted vertical and the body floating beside it; the hand contact is weak, so the weapon reads as standing on its own | [visible] | 4.6 |
| 20 | Legs and sleeve flare go opposite ways with no shared curve; no single line of action | [visible] | 2.1 |

### Hand library (`round-4/hand_library_x10.png`)

| # | Violation | Evidence | Rules |
|---|---|---|---|
| 21 | `fist_h` and `fist_v` are rounded rectangles: no thumb wedge, no curved knuckle row, no wrist step | [visible] | 4.7, 3.4 |
| 22 | `palm_open` is four equal finger bumps: a comb, not a mitten | [visible] | 4.17 |
| 23 | Sizes are fine: the 144 px fist is about 9 × 7 px, in the 7–9 × 6–8 target. The problem is construction, not budget | [M, by eye] | 3.4 |

---

## 7. How to use this in `tools/art-construct` (an artist's trial loop)

Dex asked for a workflow that works like an artist: try things, keep what works, and have
"negative parts" that say where things must not be as well as where they must. This is the
figure side of that loop. [I] throughout, built from S1, S14, S16 and S19's ordering.

1. **Thumbnails first.** Author 4–6 gesture wireframes per pose as data:
   - a line of action (a C or S as three control points);
   - shoulder, hip and head axes as angles;
   - the weight foot, and the positions of the other foot and the hands.
   Render each as a solid silhouette at 1x and 3x, and score it with section 5's C checks (holes,
   width ratio, plumb line, tilts, no parallels). Keep the best two. This is where trial and
   error happens, and it's cheap.
2. **Use the 3D as a reference layer, not the answer.** Pose the rig to the chosen wireframe for
   perspective, foreshortening and overlap order [S9]. Where the render disagrees with the
   wireframe's attitude (level shoulders, locked knees), the wireframe wins, and the render gets
   re-posed or overridden.
3. **Masses and proportion.** Place head, rib cage and pelvis to section 3.1. Tilt them per the
   wireframe. Check B.
4. **Keep-out zones** (the "negative parts"). Each pose file lists regions that must stay
   background, checked by script on the filled silhouette:
   - **arm gap:** a region between elbow and waist on at least one side, ≥ 3 × 6 px;
   - **leg gap:** a region between the legs below the knee, ≥ 3 px wide;
   - **weapon clearance:** a band 4 px wide along the haft off the grip, except where it
     deliberately overlaps;
   - **centre band:** ±3 px either side of the torso centreline from chest to crotch must
     contain no weapon pixels in an idle;
   - **tangent scan:** no 1–2 px background sliver running more than 4 px between two parts.
5. **Must-be zones.** Regions that must contain a specific thing:
   - a fist cluster (skin + outline) at each grip point, with the haft interrupted behind it
     and collinear on both sides;
   - the collar cross at the throat (DESIGN section 3, row 1);
   - a dark value between the legs;
   - the weight heel under the pit of the neck.
6. **Hands last.** Stamp hands from a construction (palm box, mitten, thumb wedge; section 3.4),
   posed per grip, not from a fixed library of three blocks. Check D.
7. **Cloth after the body.** Hang tabard, sleeves and veil from their tension points on the
   *tilted* hip band and armbands. Check E.
8. **A/B next to 07, 08 and 09 at 3x.** Record which checks failed and fix at the step that owns
   them.

## 8. Design fixes this implies (for the DESIGN.md owner)

DESIGN.md is design-fix territory, so I've written these here as proposals rather than editing
it. Each follows from sections 2–4. [I]

1. **Rest pose (DESIGN section 1).** "Glaive upright, held 4–8 px from the hip" produces the
   flagpole. Proposal: lean the glaive **15–35° across her**, butt planted outside the free foot
   and the blade rising behind her head on the weight-leg side. Her near hand grips at chest
   height with the elbow out, which opens an arm gap. Alternative to A/B: glaive resting in the
   crook of the arm against the shoulder, blade up and back, at 40–50°.
2. **Free hand.** Keep DESIGN's "hand at the collar cross", but lift the elbow out and away from
   the ribs so it makes a clear gap, and turn the fingers into a relaxed mitten, not a fist. The
   hand then frames the collar cross, which also fixes the missing-cross read. If the collar
   cross still doesn't read at 144, enlarge it from 3×3 to 5×5 (with its 1 px gold rim) at this
   height.
3. **Weight.** Weight on the back leg (as DESIGN says) needs the pelvis tilted with the
   weight-side hip up and out 3–5 px, shoulders tilted the other way, and the free knee bent
   with its heel lifted or toe pointed.
4. **Legs.** Give the thigh-highs a W3-dominant shade on the far leg and a W4 contact line where
   the tabard crosses them. Or change the tabard's inner edge to show the indigo lining, so a
   dark value always sits between the legs.
5. **Attack keys.** The N1 contact pose leans the spine into the thrust along the haft's
   direction. The haft passes in front of the body *above or below* the pelvis, never through
   it. The front hand is 24–30 px up the haft from the rear hand, and the rear hand is at the hip.
