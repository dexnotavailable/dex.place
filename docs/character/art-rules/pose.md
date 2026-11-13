# Art rules: pose appeal, stance and bust (the figure-pose lane)

**The short answer.** Every source below agrees on how a standing woman reads as elegant and
attractive rather than stiff or crude: the weight goes on one straight leg, the hip on that side
is pushed out, the shoulders tip the other way and the head tips back against them, so the body
makes one long S. The torso turns about 45° from the viewer and the face turns back toward
them, so the bust and hip curves stand out against the background instead of sitting inside the
outline. The free leg is soft, pointed and turned out, and its knee comes *in* while its foot
goes *out*. The hands have something to do and touch lightly. The appeal comes from line,
turn and posture, not from exposure. The pin-up painters said so outright: pin-ups are "more
SUGGESTIVE than EXPLICIT" [S lazypencil].

Three findings matter most for Rosace:

1. **Size alone barely moves the pixels.** Her bust already sticks out 9.2 px past the underbust
   in a side view at 144 [M]. A 25% volume increase, spread evenly, adds only about 0.7 px of
   that at 144 and 0.4 px at 80 [arithmetic]. What hides it now is the pose: the chest faces the
   camera almost square-on, the sleeve and arm sit over the far side, and there is no underbust
   shadow. So **turn, posture and the read (shadow and highlight) come first; the size change is
   the smaller lever.** Both get A/B'd, as DESIGN revision 3.5 asks.
2. **Dex's wider stance is right for her, with one condition:** the feet go wide but the free
   knee comes in. Wide feet with wide knees reads as splayed. Wide feet with the knee turned in
   reads as the λ shape DESIGN 3.5 asks for. The glamour refs (04) actually stand *narrower*
   (0.2–0.8 shoulder-widths); the combat refs (07, 08) stand wider (1.7–1.8). Section 5 records
   this conflict.
3. **The tilts DESIGN 3.5 asks for (8–14°) are beyond the existing FG-P08/FG-P09 band (4–10°).**
   The tutorials give directions, not degrees, and all of them say to exaggerate. So for appeal
   poses PS-P01 replaces FG-P08/FG-P09's range, and nothing else changes.

This file turns that into measurable rules at **144 px** (close-up) and **80 px** (world),
positive rules **PS-P01…**, negative rules **PS-N01…**, and a self-check. It sits on top of
`figure.md`: that file's contrapposto, balance, negative-space and grip rules (FG, HD, GR) all
still apply. This file adds what makes a pose *appealing*, not just alive.

Companions: `../DESIGN.md` (revision 3.5 sets the direction), `figure.md`, `../ART-RULES.md`
(rule IDs, learning log), `checklist.json` (how each PS rule is checked),
`../CRITIQUE-PARAMS.md` parts 5, 9, 10, 12, 19, `../QUALITY-RUBRIC.md`. References are named
by filename, never embedded. Study crops and measurements for this file are in
`review/rosace/art/figure-pose/research/` (git-ignored).

## Tags and units

Tags as in `figure.md`:

- **[M]** measured by me. "By eye" means read off a gridded crop in
  `review/rosace/art/figure-pose/research/*_grid_*.png` to about ±2 px (refs are soft WebP).
  "Mesh" means measured on the canonical `rosace.blend` body with
  `research/measure_bust.py` (read-only, rest pose, exact cross-sections, arm vertices dropped).
- **[S key]** sourced; the keys are in section 1 and in `ART-RULES.md` section 12. A short quote
  is in quotation marks; everything else is my paraphrase. **secondary** means I read a summary,
  not the source.
- **[visible]** seen on an image, not measured.
- **[Dex]** DESIGN revision 3.5.
- **[I]** my inference or proposal: **a starting value to A/B, not a fact.**

Units:

- **H** = her height, skull top to sole = **144 px** (close-up) or **80 px** (world).
- **h** = one head = 24 px at 144, 13 px at 80.
- **sw** = one shoulder width = **27 px at 144, 15 px at 80** (DESIGN 2's three-quarter value;
  the adopted base measures 26.6 / 14.8 front-on, PIPELINE 3.6e).
- Angles are degrees on the pixel grid unless it says "3D". A tilt in degrees is converted to a
  drop in px across the part: `drop = width × tan(angle)`.
- **At 80 px a 1 px error is about 4° across the shoulders.** So at 80 the checks use px, not
  degrees.

"Appeal poses" are the ones DESIGN 3.5 item 2 names: the idle hero, the back view and the 80 px
world idle. In files they are `art/rosace/poses/idle_appeal*.json` and `back_appeal*.json`,
with `"appeal": true`. PS rules apply to those only. Attacks keep the FG and GR rules.

---

## 1. Sources

Read for this file, accessed 2026-09-29. Keys already in `ART-RULES.md` 12 are marked (existing).

| Key | Author, title | URL | Used for |
|---|---|---|---|
| loomis-fdaiw | Andrew Loomis, *Figure Drawing for All It's Worth* (1943): "Ideal Proportion, Female" (p. 20), "The Standing Figure" (ch. V), "Balance, Rhythm" (ch. VIII) | https://en.wikisource.org/wiki/Page:Andrew_Loomis,_Figure_Drawing_for_All_It's_Worth.pdf/20 ; https://archive.org/stream/loomis_FIGURE_draw/loomis_FIGURE_draw_djvu.txt | female landmarks; relieving the static pose; head not square on the shoulders; balance as a triangle; the Hogarth S line |
| hampton-fddi | Michael Hampton, *Figure Drawing: Design and Invention* (2009), gesture chapter and "Pectoralis Major – Volume" (secondary: read via a summary of the book) | https://www.scribd.com/document/791038105/Michael-Hampton-Figure-Drawing-Design-and-Invention-1 | pinch and stretch; "T" overlaps; the breast built as a form over the pectoral box, which moves with the rib cage |
| hampton-gesture (existing) | Steven Michael Hampton, "What You Need To Know About Gesture" (Proko) | https://www.proko.com/course-lesson/what-you-need-to-know-about-gesture | offset apexes; no parallel forms |
| proko-soul | Stan Prokopenko, "'Soul Sketching' and How to Draw with More Energy" (Proko) | https://www.proko.com/course-lesson/soul-sketching-and-how-to-draw-with-more-energy | the three-tilt contrapposto recipe; push the supporting hip out; overdo it |
| proko-gesture (existing) | Stan Prokopenko, "How to Draw Gesture" | https://www.proko.com/course-lesson/how-to-draw-gesture | line of action; exaggerate |
| vilppu-manual | Glenn Vilppu, *The Vilppu Drawing Manual* (full text on archive.org) | https://archive.org/stream/Vilppu_Drawing_Manual.pdf/Vilppu_Drawing_Manual_djvu.txt | gesture first; the weight shift that curves the torso and turns the head back |
| gurney-elvgren | James Gurney, "Elvgren's Pin-up Reference" (Gurney Journey, 2012) | http://gurneyjourney.blogspot.com/2012/12/elvgrens-pin-up-reference.html | what Elvgren changed from his photos: thinner waist, more back tilt, legs moved |
| kearns-elvgren | Stapleton Kearns, "A Gil Elvgren dissected a little" (2010) | http://stapletonkearns.blogspot.com/2010/01/heres-our-gil-elvgren-painting-again.html | the springy line; edges that steer the eye; opposed curves |
| lazypencil | The Lazy Pencil Pin-up School, "How to Draw Your First Pin-Up, Part 1" | https://www.thelazypencil.com/blog-1/how-to-draw-your-first-pin-up | pointed feet lengthen the leg; "bowling pin" legs; suggestive, not explicit |
| pinup-studio | Pinup Art Studio, "How to Pose for a Pin Up Portrait: The Complete Guide" | https://pinupartstudio.com/blogs/news/how-to-pose-for-a-pin-up-portrait-the-complete-guide | the Elvgren profile pose; gaze on the viewer; hands with a job; half-closed eyes read drowsy |
| modelscamp | Models.camp, "Model Poses: 12 Foundational Poses" | https://models.camp/guides/model-poses/ | body 45° away, face back; side of the hand; feet at different depths; never a fist |
| durand-1x | Lourens Durand, "Contrapposto in Art and Photography" (1x.com magazine) | https://1x.com/magazine/permalink/9518 | elbows off the waist; asymmetric arms; weight back = softer; raised near shoulder = flirt; chin forward and down |
| aam-contrapposto (existing) | Anime Art Academy, "Using contrapposto to create beautiful standing poses for women" | https://animeartmagazine.com/using-contrapposto-to-create-beautiful-standing-poses-for-women/ | the S line; hand on the raised hip; the free hip lowered |
| csp-cheishiru-legs | Cheishiru (Clip Studio Tips), "Mastering Leg and Foot" | https://tips.clip-studio.com/en-us/articles/6735 | pelvis, knees and ankles never on one line; knees one way, ankles the other; female knees face a bit inward |
| csp-cheishiru-dyn | Cheishiru (Clip Studio Tips), "Drawing Dynamic Poses" | https://tips.clip-studio.com/en-us/articles/7852 | diagonals are dynamic; a pose can tick every box and still look static |
| aam-breasts-1 | Anime Art Academy, "Tips for drawing women: how to draw breasts, Part 1" | https://animeartmagazine.com/tips-for-drawing-women-how-to-draw-breasts-part1/ | the anchor and teardrop; start at the armpit; not under the collarbone; the "totally round and hard" mistake |
| aam-breasts-2 | Anime Art Academy, "Tips for drawing women: how to draw breasts, Part 2" | https://animeartmagazine.com/tips-for-drawing-women-how-to-draw-breasts-part-2/ | the 3/4 view (top scoops, bottom fuller); cleavage only when pushed together |
| csp-jozlix | jozlixart (Clip Studio Tips), "Drawing clothes and fabrics" | https://tips.clip-studio.com/en-us/articles/6809 | tension points; the "fabric bridge" between two of them |
| hampton-folds (existing) | Steven Michael Hampton, "Intro to Pipe Folds and Diaper Folds" (Proko) | https://www.proko.com/course-lesson/intro-to-pipe-folds-and-diaper-folds | folds from tension points |
| slynyrd-49 | Raymond Schlitter (Slynyrd), "Pixelblog 49 – Realistic Human Anatomy" | https://www.slynyrd.com/blog/2024/3/25/pixelblog-49-realistic-human-anatomy | form-fitting clothes so the anatomy reads; posture and clothing distort proportion |
| slynyrd-17, slynyrd-52, slynyrd-57 (existing) | Raymond Schlitter (Slynyrd), Pixelblogs 17, 52, 57 | see ART-RULES 12 | 6-head pixel figure; idle offsets; few prominent clusters |
| saint11-idle (existing) | Pedro Medeiros (Saint11), "Character Idle", "Silhouette" (animated tutorials; secondary) | https://saint11.art/blog/pixel-art-tutorials/ | idles move under a pixel; silhouette first |
| azzi-pixel-logic (existing) | Michael Azzi, *Pixel Logic*, ch. 4 "Readability" (secondary) | https://michafrar.gumroad.com/l/pixel-logic | silhouette first; separate overlaps with value |
| motomura-ggxrd (existing) | Junya C. Motomura (Arc System Works), "GuiltyGearXrd's Art Style" (GDC 2015 handout, pp. 28–29) | https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf | posing a 3D model for a 2D read: scale bones, pose for the camera, "3D accuracy is not a priority" |
| thegamer-idles | TheGamer, "The Best Idle Animations In Genshin Impact" (secondary: search excerpt) | https://www.thegamer.com/genshin-impact-best-idle-animations/ | gacha idles carry personality and lore |
| hoyolab-phainon | HoYoLAB community, "Phainon Splash Art: A Complete In-Depth Analysis" (fan analysis, secondary) | https://www.hoyolab.com/article/38645786 | centred splash framing |
| blevins-tangents (existing) | Neil Blevins, "Composition: Tangents" | https://artofsoulburn.com/art_lessons/composition_tangents/composition_tangents.htm | tangents |

**Gacha games** (Genshin Impact, Honkai: Star Rail, Wuthering Waves, Arknights: Endfield, Zenless
Zone Zero). I found no published pose guide from any of these studios. Section 2.7 describes
conventions visible across their public character art and menus. Those lines are tagged **[I,
observed]**: my reading of the conventions, not measured, and no asset is copied or traced.

Looked at and left out: generic "sexy pose" listicles (they repeat the above with less care) and
biomechanics papers. The only number there is a normal walking gait's ≤ 5° per-segment tilt,
which is a floor, not a target.

---

## 2. Principles, with sources

### 2.1 The S: three tilts, and the supporting hip pushed out

- **The recipe, in order:** "Tilt the hips." "Tilt the upper body in the opposite direction."
  "Tilt the head in the opposite direction of the shoulders." [S proko-soul]. Vilppu describes
  the same chain: shifting the weight to one leg "automatically create[s] a curve in the torso",
  and the shift "extends to the neck and head, going up, which tends to move in the opposite
  direction again" [S vilppu-manual].
- **Push the hip.** "I really push the hip of the supporting leg out. This exaggerates the
  gesture and adds energy" [S proko-soul]. The free hip drops: "The side of the hips that the
  weight is not placed on, is lowered for balance" [S aam-contrapposto].
- **Overdo it, don't underplay it.** "It's often better to overdo the gesture than to underplay
  it" [S proko-soul]. Elvgren did it to his own photos: Gurney finds "a thinner waist and more
  tilt to the back" in the painting than in the photo [S gurney-elvgren].
- **The Hogarth line.** Loomis calls rhythm "a 'flow' of continuous line resulting in a sense of
  unity and grace". The first line of rhythm is the "Hogarth" line of beauty, which "gracefully
  curves in one direction and then reverses itself". It is found "in the line of the spine … the
  waist and hips, and down the side of the leg to the ankle" [S loomis-fdaiw].
- **A springy line, not a straight one.** "If that line had been straight our teacher would have
  been stiff"; the curve "implies a compressed energy that wants to uncoil" [S kearns-elvgren].
- **Which leg carries the weight changes the mood.** More weight on the back leg reads "softer,
  more feminine"; on the front leg, "more aggressive, dramatic and powerful" [S durand-1x].
  For Rosace's appeal idle: the weight goes on the leg farther from the camera, and the free leg
  comes forward.

### 2.2 The turn: body away, face back

- "Turn your body about 45 degrees away from the camera, then bring your face back to the lens."
  "Turn your face about 30 degrees off the lens so both eyes stay visible" [S modelscamp].
- Square-on shows the body at its widest and flattest [S modelscamp, secondary for that
  sentence]. A three-quarter turn narrows the waist on screen and lets **one breast and one hip
  make the outline**, which is exactly DESIGN 3.5's "the bust curve and the hip curve each break
  the silhouette".
- The pin-up extreme is the Elvgren profile: "Stand in true profile … Arch your back slightly,
  push your chest forward, and extend one leg. Chin up" [S pinup-studio]. The profile shows the
  most curve and the least body. For Rosace the idle stays three-quarter (the face and the
  costume front must read). The profile's two moves, **arch the back and lift the chest**, come
  with her into the three-quarter pose.

### 2.3 Legs: the λ, knees in and feet out

- **Never line up the joints.** "Try making the pelvis, the knees and the ankles cannot be
  connected into one straight line." "Tilt the knees to one side while the ankles positioned on
  the opposite side." "Female knees also face a bit inward compared to the male ones"
  [S csp-cheishiru-legs].
- **Pointed feet lengthen the leg.** "My pin-ups always seem to be in high heels or standing on
  tiptoes with their feet pointed, to make their legs look longer" [S lazypencil]. A model's
  version: "put your weight on your back foot and extend the front leg with a pointed toe", or
  "Cross the outside ankle over the inside one and let that foot rest on the toe"
  [S modelscamp].
- **Feet at different depths.** "Feet at different depths, one knee soft, so the outline has
  holes in it rather than being one solid mass" [S modelscamp].
- **Legs shaped like bowling pins, not tubes.** There is "SO LITTLE space between a leg that has
  the desired sexy bowling pin shape and one that's just a boring tube" [S lazypencil,
  secondary for the exact phrasing].
- Put together [I]: the weight leg is one straight line from hip to heel. The free leg leaves
  the hip at an angle, its knee turns in toward the weight knee, and its foot points out and
  forward on the toe. On screen that is a λ: the two legs meet high, near the knees, and spread
  low, at the feet. **Knee gap small, heel gap large.** The same wide heel gap with the knees
  as far apart as the feet is the splayed stance DESIGN 3.5 bans.

### 2.4 Arms and hands: a job, a gap, a light touch

- **Every hand has a job.** Loomis: "Any sort of gesture is a relief from hands hanging
  motionless at the sides" [S loomis-fdaiw]. Pin-up: resting on a hip, touching the hair,
  holding a prop; arms hanging straight down read rigid [S pinup-studio].
- **Asymmetric arms.** "One hand on the hip, the other stroking the hair" [S durand-1x]. The
  classic S-line version has the hand "placed on that raised side of the hip"
  [S aam-contrapposto].
- **A gap at the waist.** The elbows "slightly bent so that there is a gap between them and the
  waist", or the hourglass is lost [S durand-1x]. "Move the elbow out two inches and daylight
  appears between arm and waist" [S modelscamp].
- **Soft wrist, side of the hand, no fist.** "Keep the fingers slightly separated and the wrist
  soft, and show the side of the hand rather than the back of it." "Never make a fist" [S
  modelscamp]. A hand pressed flat on the body "looks stuck" [S modelscamp, secondary].
- At pixel scale this becomes figure.md's mitten with at most two finger groups (HD rules). A
  relaxed elegant hand is a mitten with one separated finger (index or little finger) and a
  bent wrist [I].

### 2.5 Head, chin and gaze

- **Not square on the shoulders.** Loomis's "fairly good rule is never to have face and eyes
  looking straight ahead and set squarely on the shoulders" unless the point is defiance [S
  loomis-fdaiw].
- **Chin forward and a little down.** "The tilt of the head, the chin slightly forward and down"
  [S durand-1x]; "drop your chin an inch" [S modelscamp]. Pin-up guides say "Chin up" for the
  profile pose [S pinup-studio]. The difference is the view: in three-quarter, down; in profile,
  up.
- **Eyes on the viewer.** Classic pin-up eyes "Make direct contact with the viewer"; "Half-closed
  eyes" read "drowsy rather than seductive" [S pinup-studio]. That matches DESIGN revision 3's
  bright default face (the half-lid is kept only for prayer).
- **The raised near shoulder.** "Raising the near shoulder can imply flirting, whilst dropping it
  can suggest sternness" [S durand-1x].

### 2.6 The bust: a form on the rib cage, read by turn, shadow and tension

- **Build it on the chest, not stuck on.** Hampton builds the breast as a form overlapping the
  pectoral box, so it moves with the rib cage in a pinch or stretch [S hampton-fddi,
  secondary]. The anchor runs from the armpit: breasts "originate from up by the armpits and
  bend down and around to lie on the chest", and "Don't just draw the breasts immediately under
  the collarbones – we want some space here" [S aam-breasts-1].
- **A teardrop, not a ball.** The anchor "makes a kind of teardrop shape". The classic mistake is
  being "too focused on the swell of the breasts, making them totally round and hard looking"
  [S aam-breasts-1]. In three-quarter view "the top of the breast kind of scoops in a curve on
  the top … The bottom of the breast is fuller" [S aam-breasts-2].
- **Cleavage is caused, not default.** Unsupported, breasts sit apart. A "Y" cleavage appears
  "only … when the breasts are being pushed up and together" [S aam-breasts-2]. Rosace's bodice
  is a supportive garment, so a lifted, slightly pushed-together shape is in theme [I].
- **Stylised, not realistic.** DESIGN 3.5 asks for lifted and projecting, and bans realistic sag.
  The tutorials describe weight pulling the mass down. Our reconciliation [I]: keep the
  *teardrop proportion* (a longer, scooped upper slope, a fuller lower curve), but keep the
  apex high (section 3.4) and let the bodice carry the weight.
- **Clothing makes the form readable.** Folds start at tension points, and between two of them
  cloth makes a "fabric bridge" [S csp-jozlix, hampton-folds]. On a fitted bodice the apexes are
  tension points: the cloth bridges between them and pulls toward the shoulders and armpits,
  and a cast shadow sits under the bust [I, from those sources]. Slynyrd keeps pixel outfits
  "fairly tight, form fitting … to not overshadow the fundamental anatomy" [S slynyrd-49].

### 2.7 Gacha idle and splash conventions (described, not copied)

Sourced:

- Idle animations are where the personality lives; they "give you a little insight into the
  character and their lore" [S thegamer-idles, secondary]. figure.md 2.11 says the same about
  fighting-game idles.
- Diagonals are dynamic, straight and boxed shapes are static [S csp-cheishiru-dyn]. Splash art
  either centres the character for a big moment or runs on strong diagonals
  [S hoyolab-phainon, secondary].

Observed conventions [I, observed]:

1. **Three-quarter body, face to the player.** Female idles and showcase poses turn the body
   away and bring the face and eyes back to the camera, with a small head tilt.
2. **The weapon frames the figure.** It is held to the side, planted at an angle, or swept
   behind, making a diagonal or an arc around her. It almost never crosses the chest or the hip
   in the rest pose. The weapon's head sits above or beside the head, not against it.
3. **One hand works, one hand performs.** One hand holds the weapon; the other rests on the hip,
   touches the hair or the collar, or gestures. Both hands are never idle, and both never do
   the same thing.
4. **Weight is visibly on one leg,** with the free foot pointed or lifted and turned out. Legs
   are rarely parallel. Elegant designs (Endfield and Genshin's formal characters) run
   restrained: a small hip shift, legs close. Attitude designs (ZZZ) run pushed: a big hip, a
   wide free leg.
5. **Idles loop small.** The breathing lift is a few pixels at most, the hair and cloth lag, and
   there is a periodic "signature" beat (a weapon twirl, a hair touch). That matches
   figure.md 3.5.
6. **Appeal is shaped, not exposed.** The costume shows skin where the design puts it; the pose
   shows the silhouette. No stock idle is crotch-forward.

### 2.8 Posing a 3D model for a 2D read

- Arc System Works animated scale on the bones "a LOT", for "Exaggerations of actions, let things
  hide or appear". "3D accuracy is not a priority in this workflow"; "Limbs, hands, and feet get
  a lot of scale animation to exaggerate the perspective" [S motomura-ggxrd, pp. 28–29].
- So [I]: `figure_pose.py` may cheat per pose, for the camera (push a hip past anatomy, lift
  and turn the chest, scale a near foot). `figure_shape.py` owns the bust and hip shape, and
  that shape must be the same in every pose (CRITIQUE-PARAMS 25): **shape is global, pose
  cheats are per pose.**

### 2.9 Pixel scale

- Silhouette first; overlaps need value separation [S azzi-pixel-logic, saint11-idle, both
  secondary].
- Light with "simple, prominent clusters"; avoid "too many small scattered clusters"
  [S slynyrd-57]. A bust at 80 px gets at most one shadow shape and one highlight [I].
- Posture and clothing distort proportions, so check proportions in the pose, not only on the
  T-pose [S slynyrd-49].

---

## 3. Measurable parameters

Why these tables exist: they turn sections 2 and DESIGN 3.5 into numbers a script or a critic
can check on one still at each size. "Now" is the canonical idle
(`dex-place-art/rosace/build/renders/final_v2/idle_hero`, `review/rosace/art/figure-pose/research/rosace_idle{144,80}_grid_*.png`).

### 3.1 Where she stands now (the baseline)

| Measure | 144 | 80 | Tag |
|---|---|---|---|
| Heel centres apart | ≈ 29 px = 1.07 sw | ≈ 15 px = 1.0 sw | [M, by eye] |
| Legs | two near-vertical columns; both boots upright; feet at the same depth | same; the near knee bows in (PIPELINE 3.6e "not done") | [visible] |
| Bust, side projection (apex ahead of the underbust fold, rest pose) | **9.2 px** | 5.1 px | [M, mesh] |
| Bust, silhouette break past the underbust at camera yaw 30 / 45 / 90 (profile side) | **7.5 / 8.7 / 9.2 px** | 4.2 / 4.8 / 5.1 px | [M, mesh] |
| Same, the other side at yaw 30 | 2.0 px | 1.1 px | [M, mesh] |
| Bust apex below the shoulder joint | 9.1 px = **0.49** of the upper arm (18.5 px) | – | [M, mesh] |
| Upper slope : lower curve (rows) | 13 : 4–5 (a long scooped top, a short full bottom, then a 6 px step into the crease) | – | [M, mesh side profile] |
| Cleavage set-back at the apex row | 2.4 px | – | [M, mesh] |
| Bust at the idle's camera | reads weakly: the chest faces the camera nearly square-on, the far bell sleeve and hip hand sit on the profile side, and the bodice is white on white with no underbust shadow | the bust is 2–3 px of white inside the outline | [visible] |

Mesh numbers are `review/rosace/art/figure-pose/research/bust_measure_canonical.json`.

**What that means.** At yaw 45 the body already makes an 8.7 px bust break at 144. In ref 04 the
bust clearly breaks the torso outline on most of the nine figures at a similar height [visible,
not measured: the refs are soft WebP and a 1–2 px contour step can't be read reliably]. The idle
loses the break through the view and the covering, not through the size.

### 3.2 S-curve and turn

| ID | Parameter | 144 | 80 | Tag |
|---|---|---|---|---|
| PS-P01 | Shoulder line tilt | 8–14°: a 3.8–6.7 px drop across 27 px | 2–4 px drop across 15 px | [Dex]; direction [S proko-soul, aam-contrapposto] |
| PS-P01 | Hip line tilt (ASIS or hip joints), opposite to the shoulders | 8–14°: 3.4–6.0 px across 24 px | 2–3 px across 13 px | [Dex]; [S aam-contrapposto] |
| PS-P02 | Weight hip pushed out: weight-side hip contour past the rib-cage contour on that side | 3–6 px | 2–3 px | [S proko-soul]; px [I] |
| PS-P03 | Chest lift and back arch: rib cage pitched back against the pelvis (3D) | 5–12° | same pose | [S pinup-studio, gurney-elvgren]; ° [I] |
| PS-P03 | Lower-back curve in the 3/4 silhouette (sagitta of the back contour, waist to shoulder blade) | 2–4 px | 1–2 px | [I] |
| PS-P04 | Turn chain, from the camera (3D yaw): pelvis / chest / head | 35–60° / 30–50° / 10–30°, each turning less than the one below | same | [S modelscamp: body 45, face 30] |
| PS-P04 | Eyes | on the viewer (both irises toward the camera side) | same | [S pinup-studio]; face lane draws it |
| PS-P05 | Head tilt off the neck axis | 5–10° (crown 2–4 px off over 24 px), **rotating the opposite way to the shoulder line** | crown 1–2 px off | [Dex]; direction [S proko-soul, vilppu-manual] |
| PS-P05 | Chin | 1 px down from neutral | 0–1 px | [S durand-1x, modelscamp] |
| PS-P05 | Near shoulder | raised 0–2 px toward the chin when she glances (back view); never shrugged | 0–1 px | [S durand-1x]; px [I] |

### 3.3 Stance and legs

| ID | Parameter | 144 | 80 | Tag |
|---|---|---|---|---|
| PS-P06 | Heel centres apart, on screen | **1.3–1.6 sw = 35–43 px** | 20–24 px | [Dex] |
| PS-P06 | Knee gap (knee centres) ÷ heel gap | **≤ 0.6** (the λ) | ≤ 0.6 | [S csp-cheishiru-legs]; ratio [I] |
| PS-P07 | Weight leg | within 5° of vertical, hip joint to ankle; knee bend ≤ 5° | same | [S london-contrapposto via FG-P10; Dex "weight leg straight"] |
| PS-P07 | Weight ankle under the pit of the neck | ±2 px | ±1 px | [Dex; S loomis-fdaiw on balance] |
| PS-P08 | Free knee bend | 10–30° | same | [FG-P10; S modelscamp "one knee soft"] |
| PS-P08 | Free foot pointed | heel lifted 3–8 px off the weight sole row; foot pitched 20–45° down (3D) | heel 2–4 px up | [S lazypencil, modelscamp]; px [I] |
| PS-P08 | Free foot turned out, from the weight foot's axis on screen | 15–40° | same | [Dex "turned out"]; ° [I] |
| PS-P08 | Feet at different depths | the free foot forward (toward the camera) of the weight foot; its toe row differs ≥ 2 px | ≥ 1 px | [S modelscamp] |
| PS-P09 | Thigh splay: the angle between the two thigh axes (hip→knee) on screen | ≤ 20° | same | [I, from S csp-cheishiru-legs; the anti-splay limit] |

### 3.4 Bust (shape owned by `figure_shape.py`, read by the outfit and shading lanes)

| ID | Parameter | 144 | 80 | Tag |
|---|---|---|---|---|
| PS-P10 | Silhouette break in the pose's own view: bust contour past the underbust contour on the profile side | **7–12 px** | **4–7 px** | now 7.5 at yaw 30 [M]; floor = what yaw 45 gives today; ceiling [I] (past 12 the bust outweighs the 27 px shoulders) |
| PS-P10 | Side projection (rest pose, mesh) after any size change | 9–12 px | 5–7 px | now 9.2 [M]; DESIGN's +20–30 % volume, if spread evenly, is about +6–9 % linear, so ≈ 9.8–10.0 px [arithmetic] |
| PS-P11 | Apex height, below the shoulder joint, as a share of the upper arm | 0.40–0.55 (lifted); sag starts past 0.60 | same | now 0.49 [M]; [S loomis-fdaiw: female nipples "slightly lower than in the male"]; band [I] |
| PS-P11 | Upper slope rows ÷ lower curve rows (side profile) | ≥ 1.5 (a teardrop) | – | now ≈ 2.6–3 [M]; [S aam-breasts-1, aam-breasts-2] |
| PS-P11 | Flat upper chest between the collarbone and where the slope starts | ≥ 3 px | ≥ 1 px | [S aam-breasts-1 "some space here"]; px [I] |
| PS-P12 | Underbust shadow (a cast shape under the form, curved like a smile, darkest at the crease) | 1–2 px tall, running ≥ 60 % of the bust's width | 1 px | [S slynyrd-57 clusters; DESIGN 3.5 item 4]; px [I]; the shading lane paints it |
| PS-P12 | One designed highlight on the form's upper-outer quarter, facing the key light | one cluster of 2–5 px | 1–2 px or none | [DESIGN 3.5; S slynyrd-57]; px [I] |
| PS-P12 | Tension lines on the bodice | 1–3 lines of 1 px, 4–8 px long, from an apex toward the shoulder or armpit, or bridging between apexes | 0–1 line | [S csp-jozlix, hampton-folds]; px [I]; the outfit lane draws them |
| PS-P13 | Bust shape the same in every pose | apex position relative to the rib cage within ±1 px between poses at 144 | ±1 px | [CRITIQUE-PARAMS 25; I] |

### 3.5 Hands, glaive and framing

| ID | Parameter | 144 | 80 | Tag |
|---|---|---|---|---|
| PS-P14 | Free hand placement | on the weight-side (raised) hip, at the collar, or at the hair; never hanging | same | [Dex; S aam-contrapposto, durand-1x, loomis-fdaiw] |
| PS-P14 | Free wrist bend | 15–40° (soft; inside HD-P06 and the S22 limits) | – | [S modelscamp "wrist soft"; S ryu1991 via figure.md]; ° [I] |
| PS-P14 | Free hand read | side of the hand to the camera; 1–2 finger groups; contact by fingertips or the heel of the hand, not a flat palm | a 2–3 px mitten | [S modelscamp]; px [I]; the glaive-hands lane draws it |
| PS-P14 | Free elbow gap to the waist | ≥ 3 px wide, ≥ 30 px² (FG-P13) | ≥ 2 px | [S durand-1x, modelscamp; FG-P13] |
| PS-P15 | Glaive hand height | the grip between the bust-apex row and 1 h above the shoulder line | same, scaled | [Dex "high on the haft"]; band [I] |
| PS-P15 | Glaive angle | 15–35° from vertical, leaning away (GR-P09) | same | [Dex; GR-P09] |
| PS-P16 | The glaive and hands clear of the curves | no weapon, hand, sleeve or hair pixels inside the bust-break band or the hip-break band (keep-out zones, section 4.4); the haft stands on the side away from the bust's profile | same | [Dex item 6]; zone definition [I] |
| PS-P16 | Blade head vs her head | ≥ 4 px clear of the head outline, or overlapping it by ≥ 3 px (FG-N06) | ≥ 2 px clear | [S blevins-tangents] |
| PS-P17 | Negative space | ≥ 2 windows: one arm window and one leg window (inside the λ), each ≥ 30 px² | ≥ 1 of each, ≥ 8 px² | [S modelscamp "holes in it"; FG-P13]; 80 value [I] |

### 3.6 Back view (`back_appeal*`)

| ID | Parameter | 144 | 80 | Tag |
|---|---|---|---|---|
| PS-P18 | Glance | head turned toward the camera over the near shoulder so the near eye and the cheek line show; eyes on the viewer | the near eye shows | [Dex; I] |
| PS-P18 | Hip shift | the weight hip 3–6 px past the rib-cage contour; weight leg straight (PS-P07) | 2–3 px | [Dex; S proko-soul] |
| PS-P18 | Spine | the spine groove reads as one curve, sagitta 2–5 px, from the neck to the thong line | 1–2 px | [Dex; S loomis-fdaiw (Hogarth line in the spine)] |
| PS-P18 | Open back visible | ≥ 60 % of the thong-cut back's skin area uncovered (the hair tail moved off it); the back strap reads as one 1 px black line | ≥ 50 %; the strap one line or merged into the harness | [Dex items 2 and 5]; % [I]; the tail patch is O-24 (outfit lane's proposal, the hair lane's and this lane's call) |

### 3.7 80 px world idle

The 80 px pose is the same pose as the 144 idle, rendered small. It is not a separate design.
All the px values above have an 80 column. Where a read can't survive at 80, the order of
sacrifice is [I, from S azzi-pixel-logic: sacrifice detail for readability]:

1. Tension lines go first.
2. Then the highlight.
3. Then finger separation.
4. **Never** the silhouette reads: the stance λ, the bust break, the hip break and the two
   windows.

---

## 4. Rules

Severity as in `ART-RULES.md`: **block**, **major**, **minor**. Every rule has a
`checklist.json` entry. "Auto" and "semi" rules need `figure_pose.py`'s landmark export
(section 7). Until it exists they print SKIP.

### 4.1 Positive rules (PS-P)

| ID | Rule | Sev |
|---|---|---|
| PS-P01 | S-curve tilts in appeal poses: shoulders 8–14° and hips 8–14° the opposite way (144); drops of 2–4 px and 2–3 px at 80. **Replaces FG-P08/FG-P09's 4–10° band for appeal poses only.** | block |
| PS-P02 | The weight hip is pushed out 3–6 px past the rib-cage contour (2–3 px at 80) | major |
| PS-P03 | Chest lifted and back arched: rib cage pitched back 5–12° against the pelvis; a 2–4 px lower-back curve in the 3/4 silhouette | major |
| PS-P04 | Turn chain: pelvis 35–60°, chest 30–50°, head 10–30° from the camera, each less than the one below; eyes on the viewer | major |
| PS-P05 | Head tilted 5–10° off the neck, opposite to the shoulder line; chin 1 px down | major |
| PS-P06 | Stance: heels 1.3–1.6 sw apart (35–43 px at 144, 20–24 at 80); knee gap ≤ 0.6 × heel gap | block |
| PS-P07 | Weight leg straight (≤ 5° off vertical, knee ≤ 5°) with its ankle under the pit of the neck (±2 px at 144, ±1 at 80) | block |
| PS-P08 | Free leg: knee 10–30°, heel lifted 3–8 px (2–4 at 80), foot turned out 15–40°, forward of the weight foot | major |
| PS-P09 | Thigh splay ≤ 20° on screen | block |
| PS-P10 | Bust break 7–12 px past the underbust on the profile side (4–7 at 80), in the pose's own view | major |
| PS-P11 | Bust shape: apex at 0.40–0.55 of the upper arm below the shoulder; upper slope ≥ 1.5 × the lower curve; ≥ 3 px flat chest under the collarbone | major |
| PS-P12 | Bust read: 1–2 px underbust shadow over ≥ 60 % of its width, one 2–5 px highlight, 1–3 tension lines (at 80: 1 px shadow, ≤ 1 highlight cluster, ≤ 1 line) | major |
| PS-P13 | Bust shape consistent across poses (apex ±1 px against the rib cage) | major |
| PS-P14 | Free hand on the weight hip, collar or hair; wrist 15–40°; side of the hand; fingertip contact; elbow window ≥ 3 px | major |
| PS-P15 | Glaive hand high (between the apex row and 1 h over the shoulder line); glaive 15–35° leaning away | major |
| PS-P16 | Curves kept clear: nothing inside the bust-break or hip-break bands; the haft on the side away from the bust profile; the blade head ≥ 4 px clear of the head | major |
| PS-P17 | ≥ 2 negative windows (an arm window, a leg window inside the λ), each ≥ 30 px² at 144 | major |
| PS-P18 | Back view: a glance over the shoulder, the hip shifted 3–6 px, the weight leg straight, a 2–5 px spine curve, ≥ 60 % of the open back visible, the strap one 1 px line | major |
| PS-P19 | Try, then keep what the critics pick: every appeal pose is built as 3–6 one-axis variants (stance, tilts, turn, bust size against bust prominence) and chosen blind beside 07/08/09/04 at 3x and 1x (WF-P04, WF-P11) | block |
| PS-P20 | 3D cheats are allowed per pose (a hip pushed past anatomy, chest lift, a near-foot scale), but body shape changes only in `figure_shape.py` and applies to every pose | minor |

### 4.2 Negative rules (PS-N): where things must never be

| ID | Never / avoid | Why | Sev |
|---|---|---|---|
| PS-N01 | **Never** a crotch-forward or splayed stance: pelvis square to the camera (yaw < 20°) with heels > 1.2 sw apart and knees as far apart as the feet (knee ÷ heel gap > 0.8), or the thighs splayed > 25° | vulgar, not elegant; DESIGN 3.5 item 6 | block |
| PS-N02 | **Never** a symmetric stance: both feet at the same depth and angle, both soles on the same row, both knees straight | a twin; the mannequin | block |
| PS-N03 | **Never** parallel feet: foot axes within 10° of each other on screen | "a boring tube" stance; kills the λ | major |
| PS-N04 | **Never** both knees locked (FG-N02, restated for appeal poses) | static | block |
| PS-N05 | **Never** hunched or shrugged shoulders: ≥ 4 px of neck visible on at least one side at 144 (≥ 2 at 80); the rib cage never pitched forward | reads timid or cold, the opposite of lifted and confident | major |
| PS-N06 | **Never** a fist on a hand at rest (any hand not gripping the haft) | tension where there should be grace [S modelscamp] | major |
| PS-N07 | **Never** hide the curves: no hand, sleeve, hair or glaive pixel in the bust-break or hip-break keep-out bands | the appeal is in those two contours [Dex] | major |
| PS-N08 | **Never** realistic sag: apex lower than 0.60 of the upper arm below the shoulder, or the lower curve longer than the upper slope | DESIGN 3.5 bans it | major |
| PS-N09 | **Never** a sphere stuck on: an upper slope and lower curve of equal length (ratio 0.8–1.25) together with a notch or crease at the top, or a bust contour that starts right under the collarbone | "totally round and hard looking" [S aam-breasts-1] | major |
| PS-N10 | **Never** a tangent between a curve and a part: the bust or hip contour within 1–2 px of an arm, sleeve, hand or the haft (separate ≥ 4 px or overlap ≥ 3 px) | a visual mistake (FG-N06) exactly where the eye should rest | major |
| PS-N11 | **Never** both knees turned in (knock-kneed) or both feet turned in | timid or childish; only the free knee turns in, and the weight knee faces front | major |
| PS-N12 | **Never** an arm hanging straight with nothing to do, and never a hand pressed flat on the body | "hands hanging motionless" [S loomis-fdaiw]; flat hands "look stuck" [S modelscamp] | major |
| PS-N13 | **Never** the chest square-on to the camera (chest yaw < 20°) in an appeal pose | the widest, flattest view; the bust break disappears [S modelscamp] | major |
| PS-N14 | **Avoid** the chin lifted in three-quarter view (nostrils or the jaw underside showing) | reads haughty, not knowing [S modelscamp] | minor |
| PS-N15 | **Avoid** a pose whose edges steer the eye to the crotch: the haft, arms, tabard edge and leg lines must not converge there. Their lines lead to the face and the bust–waist curve | "eye control" [S kearns-elvgren]; elegant first [Dex] | major (critic) |
| PS-N16 | **Avoid** more skin as the lever: no change to the camera or the pose whose only effect is showing more of the thong or crotch front | "more SUGGESTIVE than EXPLICIT" [S lazypencil]; DESIGN 3.5 | major (critic) |
| PS-N17 | **Never** a bust detail at 80 beyond one shadow shape, one highlight cluster and one line | noise at 80 [S slynyrd-57] | minor |
| PS-N18 | **Never** change the bust's size between poses (shape drift) | it reads as a model swap (CRITIQUE-PARAMS 25) | major |
| PS-N19 | **Avoid** a stance where no glaive angle can clear both thighs by 10° (GR-N02, O-23). With the λ, the free thigh leans 15–30° out, so the haft goes on the weight-leg side at 15–20°, or outside the free foot at ≥ its thigh angle + 10° | a conflict the pose creates, not the grip | major |

### 4.3 Keep-out and must-be zones for appeal poses

Following figure.md section 7, on the solid fill with the id map [I]:

- **Bust-break band (keep-out for hand, sleeve, hair, haft, blade and glass ids).** Between the
  bust apex row −3 px and the underbust row +2 px, from the underbust contour outward to 2 px
  past the bust contour, on the profile side.
- **Hip-break band (same keep-out).** From the waist row to the crotch row, from the rib-cage
  contour line (extended down) out to 2 px past the hip contour, on the weight side.
- **Must-be: the leg window.** A background region inside the λ, below the knees, ≥ 30 px² at
  144 (≥ 8 px² at 80).
- **Must-be: the arm window.** As in FG-P13.
- **Must-be: the weight ankle under the pit of the neck** (PS-P07).
- **Back view, must-be: open back skin.** ≥ 60 % of the thong-cut region's skin shows, and no
  hair id falls on the spine groove between the shoulder blades and the thong line.

---

## 5. Reconciling with DESIGN revision 3.5

DESIGN.md is not edited here. Where the tutorials or the refs argue for something different,
here is what and why. **DESIGN 3.5 stays the working direction**; these are notes for the
critics' picks and for Dex.

| DESIGN 3.5 says | The sources and refs say | This file's call |
|---|---|---|
| Heels 1.3–1.6 sw apart (item 3) | Glamour sources and ref 04 stand **narrow**: the model's crossed ankle on the toe [S modelscamp]; ref 04's standing figures measure about 0.2–0.8 sw heel to heel, knees together, often one foot crossing [M, by eye ±3 px, `ref04_row*_grid_x3.png`]. The combat refs stand **wide**: 07 ≈ 1.8 sw, 08 ≈ 1.7 sw; ref 09's idle ≈ 0.75 sw under the coat [M, by eye] | Dex's 1.3–1.6 is between the two, and fits a warrior-priestess: power and elegance. PS-P06 uses it, and adds the knee rule (knee gap ≤ 0.6 × heel gap), which is what the glamour sources really insist on. **Proposed A/B arm** for the critics: a "catwalk" variant at 0.4–0.7 sw with the free foot crossing in front of the weight foot on its toe. If the critics pick it, the result goes to Dex (O-27 below) |
| Tilts about 8–14° each (item 2) | No source gives degrees. Normal gait keeps each segment within about 5°. Proko, Elvgren (via Gurney) and Loomis all say to exaggerate past nature | Agreed: 8–14° is a deliberate exaggeration. FG-P08/FG-P09's 4–10° predates 3.5, so for appeal poses PS-P01 replaces it. At 80 the check is in px (2–4 and 2–3) |
| Head tilted 5–10°, chin a little down (item 2) | Chin down in three-quarter [S durand-1x, modelscamp]; **chin up** in the pin-up profile [S pinup-studio]. The head tilts against the shoulders [S proko-soul] | Agreed for the idle (three-quarter). The back-view glance is nearer profile: there the chin may sit level. Direction: opposite the shoulder line |
| Free hand on the hip, or at the collar or hair (item 2) | The S-line classic puts the hand on the **raised** hip, the weight side [S aam-contrapposto] | Put the hip hand on the weight-side hip. Note: in the current idle the glaive is on the weight side, so the hip hand would have to be the glaive hand. So in practice the free hand goes to the collar or the hair, or the weight leg changes sides. A/B both |
| Bust +20–30 % volume, or more prominence (item 4) | Tutorials: the teardrop shape, the anchor at the armpit, "not immediately under the collarbones" [S aam-breasts-1]. Measured: the base already projects 9.2 px at 144; evenly spread, +25 % volume adds only about 0.7 px [M + arithmetic] | Prominence first (PS-P03 chest lift, PS-P04 turn, PS-P10 break, PS-P12 read), then size. Both go to the critics as DESIGN asks. Any size change is measured against PS-P10 and PS-P11 so it can't drift into sag or sphere |
| Thong string 1 px black (item 5) | Nothing in the pose sources | Owned by the outfit lane. This file only needs the strap to show in the back view (PS-P18) |
| Glaive planted 15–35° away, framing her (item 2) | The gacha convention is weapon as a frame [I, observed]; GR-N02 and O-23 show no 17–35° lean clears both thighs in the R3 stance | PS-N19: the λ stance fixes one thigh vertical and one at 15–30°, so the haft goes on the weight-leg side at 15–20°, or outside the free foot at ≥ its thigh angle + 10° |

**O-27 (in ART-RULES 11): the catwalk stance.** If the blind picks prefer a narrow,
crossed stance to DESIGN's 1.3–1.6 sw, the stance number is a call for Dex, not for this lane.

---

## 6. Self-check before calling an appeal pose done

Run in order. A failure goes back to the step that owns it (figure.md 5's order).

**A. Gesture**

1. One S from the crown through the weight hip to the weight heel? Do the three tilts alternate
   (hips one way, shoulders the other, head back again)? (PS-P01, PS-P05)
2. Is the weight hip pushed out past the rib cage by 3–6 px (2–3 at 80)? (PS-P02)
3. Is the weight ankle under the pit of the neck, and the weight leg straight? (PS-P07)
4. Is the chest lifted, with the back arched? (PS-P03)

**B. Turn and stance**

5. Pelvis 35–60°, chest 30–50°, head 10–30° from the camera, with the eyes on the viewer?
   (PS-P04, PS-N13)
6. Heels 35–43 px apart (20–24 at 80), with the knees closer together than the feet (≤ 0.6)?
   (PS-P06, PS-P09, PS-N01)
7. Free knee soft, heel up, toe pointed and turned out, foot forward? Feet not parallel?
   (PS-P08, PS-N03, PS-N02)

**C. Silhouette (solid fill at 3x and 1x, both sizes)**

8. Does the bust break the outline by 7–12 px (4–7 at 80) on its profile side? Does the hip
   break it on the weight side? (PS-P10, PS-P02)
9. Are both keep-out bands empty of hands, sleeves, hair and weapon? (PS-P16, PS-N07)
10. Is there an arm window and a leg window? (PS-P17)
11. Any tangent (1–2 px sliver) along the bust, the hip, the head, or the blade? (PS-N10)

**D. Bust shape and read**

12. Is the apex high (0.40–0.55 upper arm)? Is the upper slope longer than the lower curve? Is
    there flat chest under the collarbone? (PS-P11, PS-N08, PS-N09)
13. Underbust shadow, one highlight, tension lines to the shoulder or bridging, and no more at 80?
    (PS-P12, PS-N17)
14. Is the bust the same shape as in the other poses? (PS-P13, PS-N18)

**E. Hands and weapon**

15. Free hand on the hip, collar or hair; side of the hand showing; soft wrist; no fist; not flat?
    (PS-P14, PS-N06, PS-N12)
16. Glaive hand high, glaive 15–35° away, on the side away from the bust profile, clear of both
    thighs by 10° and of the head by 4 px? (PS-P15, PS-P16, PS-N19)

**F. Appeal (at 3x and 1x, next to 07/08/09/04, blind)**

17. Where does the eye go first? The face, then the bust–waist–hip curve. Not the crotch.
    (PS-N15)
18. Cover the face. Does the body alone read "confident, elegant, knowing"?
19. Does anything read as more skin rather than more line? (PS-N16)
20. Would a critic still call it stiff, or ever call it vulgar? If stiff, push the tilts one
    step; if vulgar, close the knees and turn the pelvis away. A/B both (PS-P19).

---

## 7. How the checks run (`figure_pose.py`)

`figure_pose.py` runs after `posing.py` (built in round FP2; the JSON format and commands are
in PIPELINE 3.7b). `figure_pose.py -- check --pose <name>` needs no render and no GPU. It writes
**landmarks.json**, and `render` writes one per still. The file holds the screen px at 144 and 80
of the rig joints the tables name:

- the pit of the neck (the jugular notch, 3.5 cm in front of the neck bone), the shoulder joints
  and acromions, the ASIS pair and hip joints, knees, ankles, heels, balls and toes, and the
  centre of mass;
- the crown, head joint and neck base (the head and neck axes);
- the pelvis, chest and head yaw against the camera, the rib-cage pitch against the pelvis, the
  knee and elbow bends, foot pitch and IK misses;
- the bust apex per side, **approximate** (the tail of the bust bone). The apex, underbust and
  collarbone rows from posed mesh cross-sections are **still to build**.

From these it passes or fails PS-P01, P04–P09, N01–N04, N13 and N14, and part of P03 and N05
(the chest-pitch halves). The fill-based rules (PS-P02, P10, P16, P17, N07, N10) need the id map
and the solid fill and still print SKIP. The critic-only rules (PS-N15, PS-N16, parts of PS-P19)
stay with the blind A/B (WF-P11).

To meet PS-P07 by construction, a pose can ask for `figure.weight {leg, knee, over}`: the applier
moves the hips so the pit of the neck sits over the weight ankle and the weight knee has the
asked angle.
