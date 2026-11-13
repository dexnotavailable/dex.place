# Player character design: "Rosace", the stained-glass priestess

The canonical design of the player character at pixel scale: her silhouette, proportions,
outfit, palette, face, weapon, and what must stay the same in every frame. The moves are in
`MOVESET.md`. This is the design to build and A/B, not a finished decision: every number here
is a first candidate, and Dex has the open calls listed at the end.

**Base concept:** `concepts/liturgy.md` (the judges' top pick), with ideas grafted in from
`concepts/halo.md` and `concepts/judgment.md`. `MOVESET.md` opens with the list of what came from
where. The three concept files stay as they are, as the record.

Companions: `REF-BREAKDOWN.md` (what the refs measure), `QUALITY-RUBRIC.md` (the A/B bar),
`CRITIQUE-PARAMS.md`, `RESEARCH.md` (timing and staging numbers), `MOTION-SOURCES.md`,
`RUNTIME-CONTRACT.md` (the export format). References are named by filename and never embedded.

Tags, the same as the companion docs:

- **[M]** measured, here or in the companion doc named next to it.
- **[S]** sourced from an outside source, usually through a companion doc.
- **[visible]** seen on an image, not measured.
- **[I]** inference or design proposal. **Everything in this file is [I] unless it carries
  another tag.**

Units: **H = her height**, skull top to sole, weapon excluded. The working value is **96 px**
at native resolution in a 640x360 view. Sizes are given in px at 96 and, where it matters, at
128 (see "Height" below).

**Revision 2** (after the critique round on revision 1): the rim on white cloth now lives on the
outline pixel, because the old white-to-RW "temperature rim" measured 1.03:1 and was invisible
(section 9). RW is dropped, so the sprite has 29 colours. Effects, the face stamps and the cut-in
now have a stated build route that uses no procedural contour drawing and no image generation
(section 12). The move changes are in `MOVESET.md`'s revision log.

**Revision 3** (2026-09-29, Dex-approved design fixes after critic round 4): a bright, confident
default face (the half-lid becomes one expression), dark indigo thigh-highs, the collar cross
restored and enlarged at 144, constructed hands with a real two-hand grip, and an idle with
attitude (contrapposto, a weight leg, the glaive angled away with negative space). How to *draw*
all of it now lives in `ART-RULES.md`, whose rule IDs are quoted below. Every change is listed
in the revision log at the end of this file.

**Revision 3.1** (2026-09-29, construct round R1): the part sizes at 144 px (section 2), and two
open calls for Dex (section 13, decisions 7 and 8). No change to how she looks.

**Revision 3.2** (2026-09-29, construct round R2, after the round-1 critique): the face's details
that read tired or sad are respecified (the iris top, the lash shape, the brows, the smirk, the
blush), the fringe becomes unequal clumps from a parting, and the idle leans a little toward her
staff. The list is in the revision log; the rule IDs are in `ART-RULES.md`.

**Revision 3.3** (2026-09-29, construct round R3, after the round-2 critique, 6.2/10): the face's details
that read sullen are respecified again (the near eye's lash and size, matched catchlights, brows in
clean windows under a fringe shadow, a 4 px smile, a curved jaw, the Ignited shout), the hair's
highlight follows the skull, the back hair falls in clumps, the front view parts off-centre, and the
idle's free foot steps toward the staff. Each was a trial variant kept by rule check and by eye; the
list is in the revision log.

**Revision 3.4** (2026-09-29, 3D base adopted): the SiroinoSotai + MMD用女性素体 base won the
blind A/B and is now the model `rosace.blend` is built from, with a bigger bust, a narrower waist,
slimmer thighs and longer legs than the base that was judged. Measured numbers are in section 2;
the list is in the revision log.

**Revision 3.5** (2026-09-29, Dex's appeal direction, after she lost every artist-lane A/B). **This
block overrides anything below that conflicts with it.** Numbers are first candidates [I]; the
critics' picks settle them.

1. **Target: 9/10**, which means matching the finish-bar refs (07, 08, 09, 04). Every lens aims
   for 9, and blind critics should prefer her, or be unable to choose, in at least half the picks.
   Scoring 7.5 no longer counts as done.
2. **Pose: seductive and elegant, with more appeal.** Applies to the idle hero, the back view and
   the 80 px world idle.
   - **S-curve:** the shoulder and hip tilts oppose each other and are pushed past revision 3,
     roughly 8–14° each at 144. The hip is cocked over the weight leg, the chest is lifted and the
     back is slightly arched.
   - **Turn:** the torso is turned three-quarters, so the bust curve and the hip curve each break
     the silhouette.
   - **Head:** tilted 5–10°, chin a little down, eyes on the viewer with a knowing look and a soft
     smile.
   - **Hands:** relaxed and elegant, with the fingers in groups and the wrist bent. The free hand
     rests on the hip or at the collar or hair. The glaive hand sits high on the haft, and the
     glaive is planted 15–35° away so it frames her instead of covering her.
   - **Back view:** she glances over her shoulder, her hip is shifted and the weight leg is
     straight. The spine curve and the thong-cut back are visible, with the hair tail moved off the
     open back.
3. **A wider starting stance.** The heels are about 1.3–1.6 shoulder-widths apart, with the
   weight-leg ankle under the pit of the neck. The free leg is extended out and forward, with a
   soft knee and the toe pointed and turned out. The legs make a long A or λ shape, not two
   parallel columns.
4. **Bust bigger or more prominent.** Stylised anime/gacha: start at about +20–30% volume over the
   adopted base, lifted and projecting, so it breaks the torso outline in the three-quarter and
   side views at 144 and still reads at 80. Read it with an underbust shadow, one designed
   highlight, and bodice tension lines that follow the form. Try more size and try more
   prominence (lift, projection, chest-up posture), and keep what the critics pick. Keep the
   narrow waist.
5. **Thinner thong string.** The back strap and side strings are 1 px at 144 and black. At 80 they
   stay a single line, or merge into the harness line. The gold harness and garters stay.
6. **Never:**
   - a crotch-forward or splayed stance;
   - a symmetric stance, parallel feet, or both knees locked;
   - hunched shoulders or fists at rest;
   - hands, sleeves or the glaive hiding the bust or hip curve;
   - realistic sag, or a bust that looks like spheres stuck on.

   Elegant first. The appeal comes from line and curve, not from showing more skin.
7. **Who owns what.**
   - The new **figure-pose** lane owns stance, pose and bust shape. It works from
     `tools/pixel-pipeline/rosace_v2/figure_shape.py`, `figure_pose.py`, `art/rosace/figure/` and
     new files in `art/rosace/poses/`. It builds to `lanes/figure-pose.blend`, and its report is at
     `review/rosace/art/figure-pose/REPORT.md`.
   - The **outfit** lane owns the thong string, and from its next round it fits the bodice to
     `art/rosace/figure/shape.json` once that file exists.
   - The **glaive-hands** lane owns how the hands are drawn and the grip.
   - The **integration** step merges the figure-pose lane as well, if its report says it's done.
     If the outfit lane stopped before it thinned the string, integration makes that change.

**Credits** (the 3D base, canonical since 2026-09-29; licences in `tools/pixel-pipeline/THIRD_PARTY.md`):
Base body: SiroinoSotai by しろいの (CC0) · Head base: MMD用女性素体 by 射当ユウキ

## The short version

1. **Who she is.** A priestess whose fighting is a church service: every input is the next step
   of one continuous dance, and her effects are made of stained glass. Working name
   **Rosace** (French for "rose window"); Dex names her.
2. **What she looks like.** Ref 14's white-and-gold priest costume **including its thong-cut
   back** (Dex's call, 2026-09-28: keep it for appeal), dark indigo thigh-highs, indigo boots, a short white veil and an indigo sleeve
   lining. Long indigo hime-cut hair with azure tips, bright azure eyes, a confident,
   charismatic face that looks at something (the half-lidded look is kept only as her prayer
   expression).
3. **Her weapon.** A glaive, "Lancet", 1.35 H long, that is also a processional cross: a dark
   indigo haft, a small rose-window disc with gold cross arms, and a lancet-shaped blade.
4. **Her colours.** 29 colours on the sprite. Effects are "Chartres azure" glass with gold
   leading; amethyst appears only in the ultimate. **No red and no neutral grey anywhere on her**:
   the enemies (ref 13) own exactly those.
5. **Her signature.** Every slash dies as stained glass: full smear, then leaded glass cells,
   then falling shards. The motif shows on every basic hit, not only in the ultimate.
6. **The status is on her body, not in a HUD.** The glaive's rose disc fills as the ultimate
   charges, the blade's glass spine relights as Q cools down, and a small floating rose counts
   down the post-ultimate state.

---

## Height: 96 px working, 128 px on the table

The refs split on this [M, REF-BREAKDOWN]:

- Only ref 05 is drawn at 96 px (about 95 px tall, 14–15 px head, about 2 px eyes).
- The refs with the faces and finish Dex points at (07, 08, 09) are 137–158 px with 24–25 px
  heads.

The 3D-to-pixel spike already renders a stand-in at both sizes
(`review/spike-3d-pixel/ab_sheet_x3.png`, git-ignored). On that sheet the 96 px render's face
doesn't read as a face at 3x, while the 176 px render sits much closer to 07 and 09 [visible].
The stand-in is a quick primitive build, not this design, so it only shows what the pixel budget
allows, not how good she can look.

**Decision rule for this doc:** every size is written in H, so the design scales. Pixel sizes
are given at 96; the face and the smallest parts also get a 128 px column. The first real model
should be rendered at 96, 112 and 128 and put through one blind A/B round on the Face and
Proportion dimensions before anything else is authored. [I]

**Update (revision 3):** the height is decided: **144 px** ships (PIPELINE 2.1; all five
critics picked it). The face, hand and grip specs below are written at 144, and `ART-RULES.md`
holds every 144 px construction number. The 96 and 128 px columns elsewhere in this file are not
converted yet; where they conflict with a 144 value, 144 wins.

Two knock-on effects of going to 128 px:

- The 640 px view is then only 5 H wide, so any width over 5 H runs off screen. The Q and R
  widths in `MOVESET.md` are written in H and would be capped by the view (Q's base shatter
  would drop from 5.6 H to about 4.5 H so it still leaves room at the edges). [I, arithmetic]
- Every drawing is about 1.8 times the pixels (128² / 96²), which is more work per frame and
  more pixels that can shimmer. [M, arithmetic]
- The M1 widths hold up: a 2.5 H hit is 320 px at 128, half the view. N5's 5.0 H spike row
  would fill the whole 640 px view. [M, arithmetic]

---

## 1. Silhouette

In a solid black fill at real size (3x) she should read as **a slim figure with two bell-shaped
sleeves, standing beside a tall cross-staff**. The glaive is the tallest shape on screen, so it
identifies her before any detail does.

- **Rest pose (the processional stance, revision 3).** An idle with attitude, not a mannequin
  beside a flagpole. Numbers at 144 px; the rule IDs are in `ART-RULES.md`.
  - **Weight:** on the back leg, which stands vertical from hip to heel (FG-P10). That hip rides
    up and out 2–4 px, and the shoulders tilt the other way by 2–5 px (FG-P08, FG-P09). The
    free (near) knee bends 10–30° with the heel lifted or the toe pointed. Feet 20–30 px apart,
    which is only allowed with that bent knee (FG-P15). A plumb line from the pit of the neck
    lands on the weight foot (FG-P11).
  - **Glaive angled away:** the butt is planted just outside the near foot and the haft leans
    **away from her body, 15–35° from vertical** (GR-P09), blade up and outward. That opens a
    wedge of background between the staff and her body that widens toward the top, and it
    widens her silhouette past 0.40 H (FG-P14). The near hand grips at chest height with the
    arm reaching out and the elbow slightly bent, which opens the first arm–body gap (FG-P13).
    Revision 3.2: her chest and head lean about 2 px toward the staff, so the grip arm bends
    instead of reaching out level at full length (the thumbnail round in ART-RULES 10, round R2).
    Revision 3.3: the free foot steps about 5 px out toward the staff with its heel lifted (feet about
    29 px apart, still inside the 20–30 px stance), so the knee bends and the legs stop reading as
    two columns; the glaive butt moves out with it only 5 px, so the grip arm keeps its bend
    (ART-RULES 10, round R3). A cocked head was tried too and dropped: the chin covered the collar
    cross.
    The haft is never within 10° of parallel to her legs or torso (GR-N02) and never crosses
    her centre band (GR-N03). A/B alternatives, from `art-rules/figure.md` section 8: the haft
    leaning across behind her, and the glaive resting in the crook of the arm against the
    shoulder at 40–50°.
  - **Free hand at the collar cross,** with the elbow lifted away from the ribs so it makes the
    second arm gap. The hand is a relaxed mitten that frames the cross and never covers it
    (CL-P05, HD-P04).
    *Revision 3.1 note:* at the 144 px sleeve size this pose drapes the far bell across the chest
    (ART-RULES CL-N03); the construct's round R1 hero puts the hand on the far hip instead. That
    choice is decision 7 in section 13 and is not made here.
  - **Head:** tilted 5–15°, chin slightly down, eyes at the viewer in the Confident expression
    (FG-P12, section 5).
- **Head shape.** Long dark hair, a short white veil behind it, a small gold rose pin at the
  crown. Each ref 13 enemy has a distinct crown, halo ring, hood or horns [M, REF-BREAKDOWN]; a
  dark head with a white veil point is unlike all of them. **No halo on her head**, because one
  ref 13 enemy wears a full red ring [visible].
- **Value structure** (from judgment.md): dark at the top (hair), light in the middle (white and
  gold costume, skin), dark from mid-thigh to the ground (indigo thigh-highs and boots, revision
  3) and in the weapon (indigo haft). That stops a white costume reading as one pale blob, puts
  a dark value between the legs so they separate from the white tabard, and gives the rim light
  dark edges to sit on.
- **Personality in the pose:** serene and completely sure of herself. The violence belongs to
  the ritual, so she never looks strained, but serene is an attitude, not stillness: the tilted
  hips, the cocked head and the angled glaive say it. That matches CANON's quiet, still arrival.
- **Idle flourish:** about every 6 s she turns the staff once in her hand (24 f), and the rose
  disc glints.

**Silhouette test** (rubric 1): fill her with one colour at 3x. A critic who hasn't seen the
animation should name the action and facing of every key pose. In strike poses the glaive and
the arms must clear the torso.

## 2. Proportions at 96 px

About 6 heads tall, inside the rubric's 5.5–6.5 band [M, rubric 2]. Sizes are proposals, sized
from REF-BREAKDOWN's estimates for ref 14 at 96 px.

| Part | At 96 px | At 128 px | At 144 px (revision 3.1) | Note |
|---|---|---|---|---|
| Height | 96 | 128 | 144 | skull top to sole, boots included |
| Head (skull top to chin) | 16 | 21 | 24 (the face grid runs to 26 with the hair volume: ART-RULES O-1) | |
| Chin to crotch | 30 | 40 | 45; collar 7–8 | collar 5 px (7 at 128) |
| Crotch to sole | 50 | 67 | 75 | 52% of height: long gacha legs (04, 08) |
| Shoulders / waist / hips, three-quarter view | 18 / 10 / 16 | 24 / 13 / 21 | 27 / 15 / 24 | a clear hourglass |
| Arm, shoulder to wrist | 30 | 40 | 45 | hands 4–5 px (5–6). At 144 (revision 3): a fist is 7–9 × 6–8 px with a 2–3 px thumb wedge; an open hand is 10–12 px long (ART-RULES HD-P02, HD-P03) |
| Knee height | 26 | 35 | 39 | |
| Detached sleeve | 28 long; mouth 18 hanging, up to 32 flared | 37; 24 / 42 | **42 long; mouth 27 hanging, up to 48 flared** | flare keyed per drawing. The bell is the biggest mass after the hair (ART-RULES CL-P06) |
| Front tabard | 7 × 34 | 9 × 45 | 11 × 51 | hip to mid-shin |
| Thong-cut back | 1 px gold edge lines | 1–2 px gold edge lines | 1–2 px gold edge lines | ref 14's cut, kept (Dex's call) |
| Hair | tail ends at mid-thigh, about 55 px from the crown | about 73 | about 82 | gathered by a ring near the end |
| Veil | 12 × 16 | 16 × 21 | 18 × 24 | back of the head to the shoulder blades |
| Glaive | 130 (1.35 H) | 173 | 194 | the refs' weapons run 0.93–1.1 H [M, REF-BREAKDOWN]; a glaive goes longer on purpose |

**Why the 144 column (revision 3.1).** 144 px shipped in revision 3 but this table stayed at 96
and 128. Round C1 of the construct route drew the sleeves with a 13 px drop, a third of the size
the 96 px row implies at 144, and the figure read thin next to refs 07, 08 and 09 [M, ART-RULES
10 round R1]. The 3D reference layer (r4fix idle, px144) measures the near bell at about 20 × 27
px [M]. The column is the 96 values × 1.5, rounded; the design itself is unchanged.

**Measured on the 3D base (revision 3.4).** The table above holds the design targets. The base
that `rosace.blend` is built from since 2026-09-29 (SiroinoSotai body + MMD用女性素体 head,
`PIPELINE.md` 3.6e) measures as follows, bare, in front view, on the rest pose. The three-quarter
row of the table can't be compared one-to-one, because a front view is wider at the shoulders
and hips than a three-quarter view. [M, `base_search.py`]

| Measure (front view) | At 144 px | At 80 px | Retired v1 base at 144 |
|---|---|---|---|
| Heads tall | 6.1 (head 23.6 px) | 6.1 (13.1 px) | 5.92 |
| Crotch to sole | 77.3 (53.7% of height) | 42.9 | 77.7 (53.9%) |
| Shoulders / bust / waist / hips | 26.6 / 20.9 / 10.0 / 24.1 | 14.8 / 11.6 / 5.6 / 13.4 | 30.6 / 19.2 / 10.9 / 25.5 |
| Bust depth (side view) | 18.1 | 10.0 | 15.6 |
| Waist / hips | 0.417 | | 0.429 |
| Thigh top, one leg | 10.8 | 6.0 | 10.4 |

## 3. Outfit, adapted from `14-outfit-priest-sister.png`

The costume keeps ref 14's parts and places and adds the legs, feet and back cover the sheet
doesn't design. Every patch of skin it shows is small and framed by gold lines, which is what
reads as "designed costume" rather than bare skin at 96 px [I, REF-BREAKDOWN under 14].

| # | Part | From 14? | Shown or covered | At 96 px | Motion job |
|---|---|---|---|---|---|
| 1 | High stand collar, gold edge, gold cross at the throat, small shoulder yoke | yes | covers the neck | white block 5 px tall, 1 px gold rim, 3×3 gold cross. **At 144 (revision 3): a 5×5 cross (G1 lit arms, G3 shade side) on a 1 px dark backing (G4 or I3), because gold on white is only 1.13:1 and the round-4 cross read as a gold blob.** Must be visible in every front and three-quarter key pose: no hand, hair lock or haft covers it (ART-RULES CL-P05) | rigid |
| 2 | Front panel with a diamond chest window in gold | yes | window shown | window 5×9 front, 3×9 three-quarter; 1 px gold frame around 2 skin tones | rigid |
| 3 | Open sides, armpit to hip | yes; front panel 1 px wider each side | shown | 3–4 px strip in side view, crossed by gold lines; this is her most visible designed skin in a side-view game | none |
| 4 | Bare shoulders, gold armbands | yes | shown | armband 1–2 px gold line, 1 highlight pixel | none |
| 5 | Detached trumpet sleeves, gold hem, fleur-cross at the corners | yes, **plus an indigo lining** | cover the forearms | white outside, indigo inside, 1 px gold hem, 3×5 corner cross. A flare flips the sleeve from light to dark, which reads at real size and gives the rim light a dark surface | main flag |
| 6 | Long front tabard, V-notch, gold border, big fleur-cross | yes | covers the front | 7 px strip, 1 px gold edge, 5×7 cross | main flag; shows facing |
| 7 | Hip band with oval medallion, O-rings, cross charms | yes; the medallion becomes a tiny rose (3×3 gold with 1 azure pixel) | band on skin | 1–2 px band; 1×2 charms | charms flick |
| 8 | Garter straps to a gold thigh band, cross charms | yes | about 16 px of bare thigh shown | 1 px gold straps | charms |
| 9 | Open back: pentagon halter yoke, cross on the upper back, mid-back strap | yes | back shown | 3×5 yoke cross, 1 px gold straps | shows in N2's pivot, the dash pirouette and R |
| 10 | Thong-cut back | **yes, kept as ref 14 designs it** (Dex's call) | seat shown, framed | thong (white, or black if white doesn't read — see below) with a 1 px gold edge meeting the hip band and garter harness; the glutes are shaded as form with the skin ramp (lit, shadow, deep crease) so they read as body, never a flat skin blob | none; the sleeves, veil and hair carry motion from behind |
| 11 | Legs (not on the sheet) | **added**: **dark indigo thigh-highs** (revision 3; were white), 1 px gold top band | covered below mid-thigh | the outfit's dark tone, the indigo ramp: I2 core, I1 sheen, I3 shadow side, I4 deep. Against the white tabard that's 6.8:1 (W1/I2) where white-on-white was 1.30:1, so the legs always separate from the tabard and a dark value sits between them (ART-RULES CL-P04, PX-P26) | none |
| 12 | Feet (not on the sheet) | **added**: indigo mid-calf boots, gold toe and heel caps, **and a 1 px gold cuff line at the boot top** (revision 3) | covered | 9 px tall. The boot runs one step darker than the stocking (I3 core, I4 shadow, one I0 gloss streak) and meets it at the gold cuff, because I2 against I4 is only 1.95:1 | ground her on light floors, take rim light |
| 13 | Head (not on the sheet) | **added**: short white veil with a beige lace hem, gold rose hairpin | covered | 12×16 | light flag |

**The thong stays** (Dex, 2026-09-28: "keep the thong to keep the appeal"). An earlier revision
swapped it for a back tabard because at 96 px a thong can collapse into a 1–2 px line on a
skin-coloured blob. The fix is craft, not cover: the thong and harness get a gold edge that always
reads as costume, the glutes and hips get real form shading (a hue-shifted skin ramp and a deep
crease band), and the working height is expected to rise above 96 px, where the refs show this
detail reads cleanly. Critics judge the back view specifically (CRITIQUE-PARAMS 12 and 16).

**Thong colour: white or black** (Dex, 2026-09-28: "switch the thong to black if needed"). White
matches ref 14 but sits close in value to light skin and the white costume. Black (use the outfit's
darkest outline-family tone, not pure #000) gives a strong value break against skin, ties to the
dark accents (boots, sleeve lining, hair) and reads as costume at any height. Every back-view still
renders both variants side by side; keep whichever the critics find more readable and attractive
at game size, and record the pick here.

**Pick (round 1, 2026-09-29): black.** All three critics who judged the back view chose it: it gives the seat a dark value anchor and keeps the thong cut and garter geometry readable, while white merged with the gold trim and the skin highlight. The `--thong white` render stays available for comparison.

**Net read:** bare shoulders, chest window, sides, open back, thong-cut seat and a band of thigh,
all framed in gold. Revealing and attractive in exactly the places ref 14 chose, and plainly a
priest. In any pose where the front tabard lifts high (the vault, the ultimate's float) it's keyed
so the flip shows its lining and the white base underneath (CRITIQUE-PARAMS 12).

**Iconography rule** (from judgment.md): every cross is ref 14's fleur-cross; never a crucifix
figure, never an inverted cross. When the blade bites the floor (N4), the haft leans back toward
her so it never stands as an upside-down cross.

## 4. Palette

**Sprite: 29 colours including the weapon**, inside the rubric's target of 32 or fewer
[S, rubric 6]. Materials share darks, and one indigo ramp serves hair, sleeve lining, boots and
haft. Ramps are listed light to dark.

| Code | Material | Ramp (light → dark) | Notes |
|---|---|---|---|
| OL | Outline | `#181032` | tinted plum-navy near-black; never `#000000`, which is enemy black (rubric 5) |
| W1–W4 | White cloth | `#f8f5f0` `#dcd7e6` `#b7aecb` `#8b80a6` | W1 is ref 14's white chip [M]. Lavender shadows like ref 01's `#ffffff → #c5c1d0 → #a69eb5` [M]. Her whitest white is warm. |
| G0–G4 | Gold | `#fff3c4` `#ecc96f` `#d1a452` `#a2722f` `#6a4520` | G2 is ref 14's gold chip [M]. G0 is the 1 px specular only. |
| S1–S4, SB | Skin, blush | `#fbe4cf` `#f3d2b2` `#e2a996` `#b8766f`; blush `#ee9ea0` | S2 is ref 14's skin chip [M]. S4 doubles as the mouth. |
| B1–B2 | Beige | `#e4d2ba` `#c4ab93` | ref 14's beige chip [M]. Veil lace, the back of the stole, so a ribbon twist shows as a colour flip |
| I0–I4 | Indigo | `#a9b8f2` `#6c72d0` `#4a4aa6` `#322c78` `#271f5e` | hair, sleeve lining, boots, haft, and the thigh-highs (revision 3). I4 lifted from `#211a4e` in round 2: it merged with OL `#181032`, so hair and boot interiors clumped into the outline |
| T2–T4 | Steel | `#bccae2` `#8290b4` `#505a84` | blade; the cutting edge uses A5, like ref 08's white edge line [visible] |
| A2–A5 | Azure (shared with the effects) | `#2a62d0` `#4aa8f0` `#a0e6ff` `#f0fcff` | eyes, hair tips, the weapon's glass, and the cool rim (section 9) |

That's 1 + 4 + 5 + 5 + 2 + 5 + 3 + 4 = 29. [M, count] Revision 1 had a 30th colour, RW
`#e6f4ff`, as the rim target on white. It measured 1.03:1 against W1 and is gone (section 9).

Revision 3 adds no colour: the thigh-highs move onto the indigo ramp, and the collar cross's dark
backing reuses G4 or I3. `art/rosace/palette.json` still maps the `stocking` material to the W
ramp; moving it to the indigo ramp (deep I4, shadow I3, lit I2, sheen I1) is an edit for that
file's owner (ART-RULES open question O-6).

**No A1 on the sprite** (revision 3.2). The round-1 critique proposed an A1 iris top at 2:1 against
the outline; A1 on OL measures 1.58:1, so it would read as lid. The iris top is A2 (3.24:1) and the
sprite stays at 29 colours.

**The indigo is deliberately light.** At least a third of the hair's pixels should sit in I1 and
I2, so the hair mass never reads as black next to the ref 13 enemies. Check with
`review/refs/character/native/_palette.py`. The spike currently renders hair with a darker ramp
(`#0c0a16 … #6b6aa0` in `tools/pixel-pipeline/blender_spike.py` [M]), and on the spike sheet that
hair reads close to black [visible]. The spike's palettes should be switched to this table
before the next A/B round.

**Effect ramps**, each dark to hot, with white-hot only at the brightest point (rubric 9):

| Code | Ramp | Colours (dark → hot) | Used for |
|---|---|---|---|
| A0–A5 | Chartres azure | `#0d1240` `#1a2f8c` `#2a62d0` `#4aa8f0` `#a0e6ff` `#f0fcff` | every smear, pane, lancet, spike, flash and halo; the glass saint. A0 is the "leading" between glass cells. |
| gold light | Gold light | G3 `#a2722f` → G2 → G1 → G0 → `#fffbe8` | slivers, tracery, cadence glints, R's second flash, the warm rim |
| V1–V3 | Amethyst | `#3a1a68` `#6a3cb0` `#a47ae6` | the rose's petal hearts in R and the darkest cell of a gilded pane. Nowhere else, so it means "ultimate". |
| dust | Dust | W3, W4 | ground dust in the costume's lavender shadow: ref 11's grey dust layer [M, REF-BREAKDOWN], moved onto our palette |
| impact | Impact frame | world A0 `#0d1240`; her and her effects A5 `#f0fcff` | two-tone frames in R |

**Readability rules:**

1. **No red, no orange-red, no neutral grey** on her or in her effects. Ref 13 uses one grey ramp
   plus one red ramp and no other hue [M, REF-BREAKDOWN], so red always means "enemy".
2. **Warm costume, cool effects.** Her whitest white `#f8f5f0` is warm; effect cores `#f0fcff`
   are cool, always wrapped in an A4 band, and never outlined. She keeps her outline during every
   effect, so she doesn't dissolve into her own slash (rubric 12).
3. **Enemies she hits flash A4 for 2 f**, so a hit is marked in her colour, not theirs.
4. **The lab already agrees.** The world rim colour in `src/lab/data/lighting.json` is
   `[0.6, 0.84, 1.0]`, about `#99d6ff` [M], one step off A4. Her idle rim and her attack rim
   stay in the same hue family.

## 5. Face

The face is **hand-authored per facing** (three-quarter, profile, back) and stamped over the
rendered head. It is never a downsampled 3D face: 3D toon eyes at 2–5 px turn to mush
[S, REF-BREAKDOWN "what the route has to add by hand"].

**Revision 3: who she is in the face.** Bright, confident and charismatic: open azure eyes that
look at something, visible brows, a mouth with a bent corner, and a little asymmetry. The
critics' repeated note was "a blank half-lidded stare, no charisma", and Dex's call is that her
resting face is the confident one; the half-lid survives only as the Serene expression for
prayer beats. The face is **constructed** on the grid in `ART-RULES.md` section 6 (head ball,
side plane, centre line, eye line, then pixels), whether or not the 3D head is good; the 3D
head only says where the face sits and which way it turns (ART-RULES WF-P02).

**At 144 px** (the shipped height; rule IDs from `ART-RULES.md`):

| Feature | Spec | Colour |
|---|---|---|
| Layout | rows above the chin: mouth 2–3, nose 6–7, eye bottom 9–11, lash top 13–15, brows 2–3 rows over the lash; face 15–16 px wide at the eye row, (lash top to chin) ÷ width 0.85–0.95 (FC-P01, FC-P02). The round-4 face was 0.69: too short below the eyes | – |
| Eye, near | 5–6 wide × 5–6 tall, **the bigger and brighter eye** in three-quarter view (one more iris row and a column more iris and white than the far eye, FC-P26; revision 3.3); the upper lash is the 2 px flick up and out plus **one** row across the eye, its inner corner dipping 1 px (revision 3.3: a third lash row had squeezed the top iris row to 1 px and made the near eye the smaller one), never down at the outer end (FC-N25); the iris touches the lash with an **A2 top** (A2 against the lash is 3.24:1; I3 and A1 are 1.5–1.6:1 and read as more lid), an I3 pupil on the gaze side, a 2 px **A4 crescent** at the bottom; the white on the side opposite the gaze, one column; a lower-lash mark at the outer corner that rises into the eye on the smirk side (FC-P22, FC-P24) *(revision 3.2)* | OL; A2, A3, A4, A5; I3 pupil; W2 |
| Eye, far (three-quarter) | 1–2 px narrower, 0–1 px shorter (FC-P04) | same |
| Gaze | both irises offset the same way by the same amount, at a named target (the viewer at idle). Never both whites on the nose side (FC-P11, FC-N01) | – |
| Highlight | 1 px A5 on the same side in both eyes, the key light's side, **on the top iris row and at the same offset from each pupil**, so both eyes focus on one point (FC-P12; revision 3.3) | A5 |
| Openness | at least 3 iris rows show on the default face; the half-lid is Serene only (FC-P13) | – |
| Brows | always present: 1 px thick, 2–3 rows over the lash, in forehead windows where the fringe arches, with no hair within 1 px (FC-P27); the fringe's cast shadow sits above them as a solid band, never a speckle (FC-N27). Confident: the near brow 3 px with its outer end a step up (the cocked brow), the far brow 2 px and level; never the worry slope (FC-P15, FC-N26) *(revision 3.2; lengths and windows revision 3.3: 4/3 px brows filled the windows and read stern)* | I3 on skin, OL where they cross hair |
| Nose | 1 × 2 px mark toward the far eye (FC-P06) | S3 |
| Mouth | the Confident mouth: **a 4 px S4 smile, both corners up (a shallow U), with an S3 dimple at the near corner** (revision 3.3: the 3 px smirk read as a pout; the U beat a 4 px smirk in the whole-face pick beside ref 08); an S3 corner alone vanishes (1.42:1); open 2 × 2 or 3 × 2; in profile a 2–3 px mark whose back corner rises (FC-P07, FC-P23) | S4, SB, S3 dimple |
| Blush | a solid 2 px (3 on Radiant) on one row under the outer half of each eye, on S2 only; never diagonal or vertical (with the nose mark it read as tear tracks) (FC-P17, FC-N24) *(revision 3.2)* | SB |
| Contour | chin point 2–4 px wide toward the far side, a 1 px far-cheek bump, no straight cheek run over 3 rows on either side, and no neck skin beside the chin row (the hair or the jaw's shadow sits there), so the chin reads as a point (FC-P08, FC-N13). Revision 3.3: the jaws are curves whose runs shorten toward the chin (the far jaw 4, 3, 2, 1, 1 into a 3 px chin under a 5 px row), never a staircase of equal steps (FC-N28); the far lock backs the far jaw with a dark value | silhouette OL; S3 far-cheek cluster |

**Expressions** (ART-RULES 6.5; each changes at least two of brows, lids and mouth):

- **Confident** (default: idle, walk, menus): open eyes at the viewer, the near one the bigger, the
  lash the flick plus one row; the smile side's lower lid lifted; the near brow cocked, the far brow
  level; a 4 px smile with both corners up and a dimple at the near corner; head tilted 1 px across
  the eye line (revision 3.2; eye, brows and mouth revision 3.3).
- **Focused** (attacks): brows down and together; the lash flattened and lowered 1 px on the
  iris; lower lid up 1 px; eyes on the target; mouth pressed or open in a shout.
- **Radiant** (happy, wins): brows up; eyes closed into upward arcs or crescent-open with the
  lower lid pushed up; a U-shaped mouth.
- **Serene** (prayer beats only: the staff-turn flourish, Sanctuary, R's cut-in wind-up): the
  half-lid, with 1–2 iris rows showing and a soft flick; a small closed smile.
- **Ignited** (R and Illumination): Focused with a dark A2 iris core inside an A4 rim (revision 3.2:
  an all-pale iris reads blind) and a 1 px A4 glow beside the eye; the brows pulled in; a battle cry:
  the teeth as one W1 row on the mouth line over a dark open mouth and the lower lip (revision 3.3:
  one W1 pixel over SB read as buck teeth).
- **Hurt:** brows up at the inner ends; eyes squeezed into > < shapes pointing at the nose (revision
  3.2: a flat line read as asleep); one mouth corner down.

The 96 and 128 px tables below are the revision-2 spec, kept for the record. They are
**superseded** by the 144 spec above: in particular, "Brows: none" and the half-lidded Serene
default no longer apply. The round-4 face stamps in `art/rosace/faces/` were built to them and
are superseded too (not deleted).

**At 96 px** (16 px head, superseded): ref 05's size built with ref 01's logic (rubric 3).

| Feature | Pixels | Colour |
|---|---|---|
| Eye | 3 wide × 2 tall. Top row: the lash, 3 px, the outer end flicking up 1 px in three-quarter view. Bottom row: 2-tone iris (A2 inner, A3 outer) and 1 skin pixel. | OL; A2, A3 |
| Far eye (three-quarter) | 2 px wide | same |
| Highlight | only in the cut-in and close-ups | – |
| Brows | none; the bangs cover them | – |
| Nose | none in three-quarter; 1 px S3 in profile | S3 |
| Mouth | 1 px; 2 px open | S4 |
| Blush | 1 px under each eye | SB |

**At 128 px** (21 px head, superseded), closer to 07 and 08:

| Feature | Pixels |
|---|---|
| Eye | 4 wide × 3 tall: lash row 4 px with a 1 px outward flick; iris 2×2 (A2 over A3); 1 px A5 highlight at the top inner corner of the iris |
| Brows | 1 px angled strokes seen through the gaps in the bangs, in I2 |
| Nose | 1 px S3 shadow in three-quarter view |
| Mouth | 2 px; 2×2 open |
| Blush | 2 px under each eye |

**Expressions, revision 2** (superseded by the list above; kept for the record):

- ~~**Serene** (default)~~: half-lidded, the lash row lowered 1 px so only 1 iris pixel shows.
  Now an occasional expression, not the default.
- **Resolute** (attacks): the inner lash end drops 1 px. Now **Focused**, which also moves the
  brows and the mouth.
- **Radiant** (happy, wins): eyes closed into 3 px arcs, mouth open 2 px.
- **Ignited** (R and Illumination): the iris turns A4, with a 1 px A4 glow beside the eye.
- **Hurt:** eyes squeezed into a 1 px arc, mouth 2 px.

**The cut-in bust** (R): the same character at about 3 times the sprite's head size (a head of
about 48 px), on the same pixel grid. This is where the detailed face lives, built with ref 01's
and 07's construction (lash with flick, 3-tone iris, highlight, brows, blush, a nose shadow).
It's a render of the same model with a pixel paint-over on the face (section 12), never
generated (CANON: no image generation).

## 6. Hair

- **Cut:** a long hime cut. **Revision 3.2:** the fringe is 4 clumps of unequal width from a parting
  (in three-quarter view about 4 / 6 / 5 / 3 px), their tips on different rows, one lock sweeping
  across the parting, and windows over the brows; the near clumps swing to the near side and the far
  ones to the far side. (Revision 3 had "straight bangs broken into 3 clumps by 1 px separators",
  which the round-1 critique read as a comb.) Clump lines bend at least every 3 rows, and the deepest
  indigo sits behind the sidelocks so they separate from the back mass (ART-RULES HR-P11, HR-P12,
  HR-N04). **Revision 3.3:** the highlight is an angel ring broken into one tapering dash per crown
  clump, the dashes on different rows as the skull curves (a straight row read as a halo band); the
  back hair falls as 2–3 big clumps with one lit ridge, the deepest indigo only under the overlaps and
  behind the sidelocks (parallel strands read as a striped wig); the head's silhouette breaks with a
  lit clump tip on the light side, never a dark strand (a crown cowlick and two dark flyaways were
  tried and read as an antenna, a twig and a horn); in front view the hair parts off-centre (a mirrored
  dome read as a wig) (ART-RULES HR-P08, HR-P13, HR-N05). Sidelocks
  to the collarbone, held by small gold cross clasps that swing like the garter charms. Back hair
  to mid-thigh, gathered loosely near the end by a 2×2 gold ring so the lower half moves as one
  clean ribbon, not a spray.
- **Clumps:** 5–7 big clumps with S-curves and tips that taper to 1 px; the lines between clumps
  are one step darker than the shadow, not the outline colour (ref 01's clump logic [M]).
- **Colour:** indigo I1–I4 with the tips shifting to A3 then A4 over the last 2–4 px, the
  hue-shifted tips ref 03 uses [M, REF-BREAKDOWN]. In Q and R the tips step up one tone, so the
  hair gives off light.
- **Weightless behaviour** (from halo.md): on float beats (N4's hang, Q's raise, R's rise) the
  hair rises and fans upward instead of trailing. Keyed by hand, never simulated.

## 7. Weapon: the processional glaive "Lancet"

**Why a glaive over a sword** [I]:

1. **Width.** At 1.35 H held near the butt with the arms out, a full swing sweeps a circle
   roughly 3 H across before any effect is added; a 1 H sword sweeps roughly 2.2 H.
2. **The dance.** Spins, baton twirls, passing it behind the back, planting it and vaulting over
   it all come from staff work; a short lever can't circle the body the same way.
3. **The theme.** Held blade-up it is a processional cross, so she's "in costume" even at rest.
4. **Two ends.** Blade and butt give two trails and a pivot to vault from.

CANON's interaction line currently says "Click / J / slash: the sword" [S, `CANON.md`]. The
glaive's blade slashes and cuts cords the same way; if Dex keeps the glaive, that line changes.

**Parts, butt to tip** (at 96 px; 130 px in total):

| Part | Size | Look |
|---|---|---|
| Butt | 3 × 6 | gold spike and knop, for planting and the Q stamp |
| Haft | 87 long, 3 thick | **dark indigo lacquer** (I2 core, OL sides) with three 2 px gold bands at the grip points. Dark on purpose, so the weapon never vanishes against her white body or a pale floor (rubric 1). |
| Rose disc | 9 across | gold ring, **8 glass cells** (A2 and A3 alternating), 1 px A5 centre. Glows A4 while a move is active. It is the rim's light source, the cadence cue, the seed of the ultimate, and **the R meter** (section 10). |
| Cross arms | 17 across in total | gold, ending in 1 px trefoil nubs; with haft and blade they make the cross |
| Blade | 28 long, 8 at the widest | half a lancet window split down the middle: straight spine, convex cutting edge curving into the point. A 1 px gold fuller holding **3 azure glass pixels** (the "glass spine", **the Q cooldown**, section 10). A 4×4 fleur-de-lis barb on the spine near the base. Steel T2–T4, cutting edge A5. |
| Stole | 2 tails, 26 × 3 each | white front, beige back, a 3×5 gold cross at each end, tied under the disc. The weapon's built-in motion trail. Shortened from liturgy.md's 34 px to cut noise (section 8). |

**Carry and grip:**

- Rest (revision 3): in the near hand (her right hand, toward the camera; the spike's convention
  [M, `blender_spike.py`]), butt planted just outside the near foot, the haft **leaning away
  from her body 15–35° from vertical** with negative space between staff and body (section 1).
  Revision 2 had it upright beside the rear foot; at 144 that measured about 6.5° and read as a
  flagpole (the refs hold theirs at 16–56° [M, `art-rules/figure.md` 3.2]).
- Walk: upright, swinging slightly. Run: angled forward, blade leading low, stole streaming.
- **Hands are constructed, not stamped** (revision 3). Every hand is built per pose from a palm
  box, a mitten of fingers, a thumb wedge and a 1 px wrist step (ART-RULES HD-P01). At 144 a fist
  on the haft is 7–9 × 6–8 px with a 2–3 px thumb wedge crossing the haft on the near side and a
  curved knuckle line; an open hand is a mitten with at most two separated fingers, never four
  equal bumps (HD-P02, HD-P03, HD-N02). The round-4 hand library (`art/rosace/hands/`: rounded
  rectangles, a four-bump palm) is superseded, not deleted.
- **A real two-hand grip** on every attack (revision 3). The rear hand sits at the hip or in
  front of the lower belly; the front hand is 24–30 px up the haft on ready and thrust grips
  (di Grassi's "about one foot", the naginata mid-guard's shoulder width; ART-RULES GR-P01,
  GR-P04). Both fists sit on the haft line within 1 px, the haft disappears behind the fingers
  and comes out collinear on the other side (GR-P05), and the wrists stay inside the functional
  limits (HD-P06). The grip slides to the middle of the haft for twirls (N3, Q: both hands
  within 8–14 px of the middle) and spreads to 40 px toward the butt for the widest sweeps (N5).
  The haft passes above or below the pelvis, never through it, and the spine leans into the
  thrust (GR-N05, FG-P18).
- The weapon never floats: in every drawing at least one hand is on the haft, except N4's vault
  (she's on it) and the moment Q plants it.

## 8. Cloth and secondary motion

Eight trailing pieces at 96 px is the judges' biggest noise risk for this concept. Two rules keep
it readable: a fixed lag order, and one lead flag per move. Everything is hand-keyed per
drawing, with no physics simulation (Guilty Gear Xrd's rule [S, RESEARCH 4.2]).

**Lag order** (how many drawings each piece trails the body):

| Piece | Lags by | Overshoot | Settles in |
|---|---|---|---|
| Veil | 1 | small | 2 drawings |
| Sidelocks and clasps | 1 | small | 2 |
| Garter and hip charms (1×2) | 1 | a flick | 2 |
| Sleeves | 1 | flare up to 32 px on contact drawings | 3 |
| Front tabard | 2 | yes | 3 |
| Hair tail | 2 | fans into 5–8 strands on spins (ref 05 row 7 [visible]) | 4 |
| Stole tails | 2–3 (the tip of the whip) | most | 4 |

**One lead flag per move** (from halo.md). The lead piece gets the big flare; everything else
stays within 2 px of rest shape and just lags.

| Move | Lead flag |
|---|---|
| N1 Kyrie | sleeves |
| N2 Gloria | both tabards (the pivot shows the back) |
| N3 Sanctus | hair (fans on each twirl) |
| N4 Credo | **everything floats** at the hang: one of two exceptions |
| N5 Agnus Dei | all wound in the coil, then the sleeves fling out on contact |
| M2 Procession | hair and veil |
| Aspersion | stole |
| Q Nave | sleeves (slide to the elbows, then drift up) |
| R Te Deum | **everything**: the other exception |

**The trailing-side rule:** on every contact drawing, all cloth and hair are swept to the side the
blade came *from*. The side it's travelling *toward* stays clear, so the weapon and the smear
keep their negative space (rubric 1).

**Per-drawing exaggeration:** on contact and smear drawings only, sleeves flare 15% bigger and
the stole lengthens 20%, done with shape keys on those drawings (Guilty Gear deforms the mesh
per key [S, RESEARCH 4.2]).

## 9. Light and rim

The rubric's rim bar is our own: 1 px (2 on broad shapes), lit side only, in the light's colour,
timed with the effect, on palette, never a full outline (rubric 11).

- **Baked key light:** upper front, from the side she faces, fixed for the character (Guilty
  Gear gives each character its own light direction [S, RESEARCH 2.9]). The atlas is exported
  with `shading: "baked"` (RUNTIME-CONTRACT).
- **Default rim:** from upper back, in the world rim colour. The lab's `rimDir` of
  `[-0.62, -0.78]` [M] already points up and behind a right-facing character.
- **During moves the rim comes from her own glass:** the active effect and the nearest two
  hanging panes are point lights (the contract's `light` event, up to 16 at once [M]). The rim
  shows on the edges facing them.
- **The rim lives on the outline** (the "lit outline"). On the lit side, the silhouette's own
  OL pixel is recoloured to the light's colour. On broad shapes (hair mass, sleeves and lining,
  tabards, thighs, back) the pixel just inside it can step as well, which makes the rubric's
  "2 px on broad shapes". Revision 1 put the rim on white cloth as a colour shift from W1 to RW
  instead. That doesn't work, for the reasons below.

**Why the white needed a different rim** [M, arithmetic; WCAG contrast ratios computed from the
hex values]:

- W1 `#f8f5f0` against the old RW `#e6f4ff` measures **1.03:1**. The eye can't separate that at
  1 px, and white is most of her silhouette, so the rim would only have shown on the hair,
  boots, lining and haft.
- The lab can't draw it either. `src/lab/engine/shaders.ts` brightens a rimmed texel toward the
  light colour (`max(lit, colour) + 0.12 × colour`, stepped to 0, half or full). I ran that
  formula with the values in `src/lab/data/lighting.json`, a baked sprite, the colours as stored
  and no point-light diffuse. Full rim turns W1 into `#ffffff`, which is 1.14–1.17:1 against the
  unrimmed pixel; half rim gives 1.12:1. Where the rim does show (the outline, dark cloth), it
  lands on off-palette colours such as `#b3ffff` and `#536f8b`. So today's rim is invisible on
  white and off-palette everywhere else, and rubric 11 asks for both visible and on-palette.
- The outline pixel is where a rim can show on every material. OL `#181032` recoloured to A3
  measures 7.0:1 against what it was, and to A4 13.2:1. The contract already asks for outline
  texels with an outward normal, and the spike's rim demo writes them
  (`tools/pixel-pipeline/rimlight_demo.py`), so they're the texels the rim term hits hardest.

**The rim table.** The runtime picks a level per texel (off, half, full), as it does today.
Each light has a family: **cool** for the azure effect lights and the world rim (`#99d6ff`),
**warm** for the gold lights (the Sanctuary rim, R's tracery point, R's second flash). The
output colour always comes from this table, so every rimmed pixel is a palette colour.

| Texel on the lit side | Cool, half | Cool, full | Warm, half | Warm, full | Contrast, full [M] |
|---|---|---|---|---|---|
| Outline OL | A3 | A4 | G3 | G1 | OL→A4 13.2:1, OL→G1 11.4:1; A4 against the lab's backdrop 12.2:1 (top band) to 4.0:1 (lowest, palest band) |
| Inner pixel, W1 or W2 (broad shapes only) | – | – | – | – | none: nothing on her is brighter, so the recoloured outline beside it carries the rim. A4 next to W1 is only 1.27:1, so at full it reads as a warm-to-cool colour change at the edge; A3 next to W1 (half) is 2.4:1 |
| Inner pixel, W3 or W4 (the shaded side of white) | – | A5 | – | G0 | W3→A5 2.0:1, W4→A5 3.5:1; W3→G0 1.9:1, W4→G0 3.3:1 |
| Inner pixel, I1–I4 (hair, lining, boots, haft) | – | A3 | – | G2 | I2→A3 2.9:1, I3→A3 4.6:1; the outline beside it is A4, so the band steps brightest at the edge |
| Inner pixel, S3–S4, T3–T4 (shaded skin, steel) | – | A5 | – | G0 | S3→A5 1.9:1, T3→A5 3.0:1 |
| Inner pixel, gold G2–G4 | – | A5 | – | G0 | G2→A5 2.2:1, G2→G0 2.1:1 |
| Everything else | unchanged | unchanged | unchanged | unchanged | – |

Two things follow from the table:

- **On white the rim is mostly the outline changing colour.** The unlit side keeps its dark OL
  line and the lit side turns azure. That asymmetry is what reads as "lit from that side". When
  the light is behind her (the default rim from upper back, N5's saint, R's backlit hold), it
  lands on the side the baked key light leaves in W3 and W4, so the inner step to A5 adds a
  second, brighter pixel there. When the light is in front, it lands on key-lit W1 and W2, and
  the outline alone carries it.
- **The half level is a coloured line and full is a lit edge.** Half is OL→A3, like ref 05's
  coloured outlines [visible, REF-BREAKDOWN]. Full adds the inner step. The idle world rim
  usually sits at half; an attack's light pushes it to full.

**This needs an engine change** (listed in `MOVESET.md` section 8). The runtime keeps its rim
level and threshold, but replaces the brighten step with a lookup,
`rimLUT[palette index][family][level]`, which returns a palette colour. It needs three things:

1. a per-texel palette index: either an index atlas beside the albedo and normal atlases, or an
   exact match of the albedo colour against the sprite's 29 colours in the shader
2. a light family: an optional `rim: "cool" | "warm"` on the `light` event (the world rim is
   cool); the shader takes the family of the strongest rim contribution
3. the "2 px on broad shapes" rule as data: the exporter writes outward normals on the outline,
   and on the second pixel inward only where the shape is broad, so the shader doesn't have to
   guess

`RUNTIME-CONTRACT.md` (lines 179–181) would change with it. I've left that file alone; it's the
coordinator's call. [I]

**A/B before any move art** (`MOVESET.md` section 10, item 2): the same white-dominant contact
frame with the rim on and off, and with the outline-only rim against outline plus inner step,
at 3x on the lab's dark and pale backdrop bands.

- **The rim is choreographed** (from halo.md): in some moves the light moves on purpose, so the
  rim walks round her (N2's orbit, Q's lancets rising outward, R's glass pouring clockwise). The
  exact events are in each move's table in `MOVESET.md`.
- **Two-sided moments stay legal.** When light stands on both sides (Q), she gets a rim on both
  flanks but never on top and bottom together, so it never closes into an outline.
- **Normal maps:** exported per frame, quantised to a few directions per material, silhouette
  texels pointing outward with a small z (RUNTIME-CONTRACT; RESEARCH 4.5). A smooth normal gives
  a smooth rim, which the rubric fails.

## 10. Status on her body (no HUD)

From halo.md's diegetic UI, moved onto Lancet. CANON asks for restrained world UI [S].

| State | Where it shows | How it reads |
|---|---|---|
| R meter | the rose disc's 8 glass cells | cells light one at a time as the meter fills (dark cells are A0). All 8 lit and glinting every 90 f = R ready. |
| Q cooldown | the blade's glass spine (3 azure pixels) | on cast all 3 go A0; one relights every third of the cooldown (8 s → one every 160 f). All 3 lit = Q ready. |
| Illumination timer (12 s after R) | a 25 px rose floating behind her shoulder | its 8 panes go dark one every 90 f |
| Panes (M1 resource) | the panes themselves, hanging in the air | count them; gilded ones are gold-leaded |

At 3x the glass spine's pixels are 9 screen px each. Whether that reads at a glance is an A/B
question; the fallback is to add the same state as a 1 px glow on the stole's gold crosses. [I]

## 11. What stays the same in every frame

These are the model-sheet locks. A frame that breaks one fails rubric 7 ("consistency in
motion") no matter how good it looks alone.

1. **Height and head.** 96 px in every straight-legged standing drawing (±1 px for breathing),
   16 px head in every facing, eye row at the same height on the skull.
2. **Face stamps.** One stamp per facing and expression; eyes never change size or spacing.
3. **Palette.** Exactly the 29 sprite colours above; every rendered frame is snapped to them.
   Effects use only their own ramps. No new colours appear mid-animation, including under the
   rim, which only ever outputs a colour from the rim table (section 9).
4. **Line.** A 1 px OL outline on the silhouette; inner lines in the material's darkest tone;
   selective outline on white where it touches the veil or sleeve (a W4 line, not OL).
5. **Light.** Baked key light always from upper front; rim only from real lights, on the lit
   side's outline and, on broad shapes, one pixel inside it.
6. **Gold trim** is always 1 px; cross glyphs keep their sizes (collar 3×3 at 96 and **5×5 with
   a dark backing at 144**, revision 3; sleeve 3×5, tabard 5×7, stole 3×5).
7. **The glaive** is 130 px in every drawing except smears, where it may stretch up to 15% and
   bend (ref 09's bent blade [visible]). The disc and glass spine always show the current meter
   and cooldown state.
8. **Pivot** at the foot centre on the ground; hands on the haft (section 7).
9. **Cloth sizes:** sleeve mouth 18 px hanging, never over 32 px flared (27 and 48 at 144); tabards keep their
   lengths; only the lead flag flares.
10. **Pixel size:** effects, apparitions, face stamps and the cut-in are all on the sprite's
    pixel grid; no mixed pixel sizes (rubric 7). The 2.5x glass saint is a bigger render, not an
    upscale.

## 12. How she gets built (3D-to-pixel route)

- **Rendered in Blender** from a rigged model: body, costume, hair, glaive with its disc.
  Orthographic camera, no anti-aliasing, constant toon ramps, and per-frame albedo, normal and
  material-ID passes [S, RESEARCH 4.1, 4.7]. Since revision 3.4 the body is SiroinoSotai by
  しろいの (CC0) and the head is MMD用女性素体 by 射当ユウキ (commercial use and modification
  allowed), welded and rigged by `tools/pixel-pipeline/build_rosace_v2.py` (`PIPELINE.md` 3.6b–3.6e;
  licences in `THIRD_PARTY.md`). The retired v1 base was VRoid's CC0 `HairSample_Female.vrm`. Cloth and hair are hand-keyed per drawing; shape keys push the flare on
  contact and smear drawings.

**Nothing is drawn as procedural contours in code.** That was the previous attempt's approach
(the "crimson halo" contour rig on branch `claude/magical-meitner-ea41go`), which Dex rated 3/10.
Revision 1 of this doc still said effects would be "drawn by hand or in code"; with no pixel
artist on the project, "in code" would have meant the same thing again. So the effects go
through the same Blender pipeline as her body:

- **Effects are Blender geometry, rendered like she is.** Same orthographic camera, no
  anti-aliasing, flat emission shaders stepped to the effect ramps with Constant colour ramps,
  palette snap, and albedo, normal and material-ID passes. That keeps one pixel grid, gives the
  effects normals (so the glass can take rim too) and gives the leading lines for free from the
  ID pass. The rendered frames play in the lab as flipbook effect sprites (`MOVESET.md`
  section 8, item 1). By family:
  - **Smears:** a ribbon mesh lofted along the blade's swept path, with a thickness profile
    (thick leading edge, knife-thin tail). The spike already records cutting-edge samples at
    sub-frames for this (`meta["smear"]` in `tools/pixel-pipeline/blender_spike.py` [M]).
    Stretch and bend are keyed on the mesh.
  - **Glass decay:** the same ribbon split into cells (a cell pattern as material IDs, so each
    cell renders flat A1, A2 or A3, and leading is drawn where the ID changes). Shards are those
    cells as separate pieces on keyed ballistic arcs, not a physics simulation.
  - **Panes, lancets, spikes, the rose, rings and floor bands:** flat or low-relief meshes. The
    rose is one 45° wedge instanced eight times; the grid-exact flips and 90° turns still hold
    as a check in post [M, checked by script in liturgy.md]. Floor bands are strips on the floor
    plane, seen from the side camera.
  - **The glass saint** (N5) and **ghost glaive** (Illumination): her own model and weapon with
    the glass material, rendered at 2.5x and 1.6x size on the same pixel grid, not scaled up
    afterwards. This is the 3D route's biggest advantage: an apparition at any size is a
    render, not a redraw.
- **Derived deterministically from the renders:** the glass afterimages and the saint's cells
  (the silhouette filled by material from the ID pass, leading drawn where the material
  changes), the saint's assembly and shatter order, and the two-tone impact frames (a palette
  swap).
- **Authored as pixels, and how** (never generated):
  - **Face stamps.** At 96 px an eye is 3×2 px and a whole face is about 20–30 placed pixels
    per facing and expression (section 5). Route: render the 3D head at sprite size to fix the
    stamp's position, and at 4x as a reference for eye placement, then place the stamp pixels
    explicitly as a small per-pixel data file or in a pixel editor. That's pixel placement on a
    tiny, fixed budget, checked at 6x against 05 and 01. It isn't contour drawing. **Revision
    3:** at 144 the stamp is constructed on the `ART-RULES.md` section 6 grid (the 3D head gives
    only position and turn), tried in 3 variants per expression, and checked at 6x against 07,
    08 and 09 with the rules in `art-rules/checklist.json`.
  - **Cut-in bust** (640×96): render the same model as a bust at about 3x the sprite's head size
    (a head of about 48 px) through the same toon, no-anti-aliasing, palette-snapped pipeline,
    then paint over the eyes, lashes, iris, highlight, brows and blush pixel by pixel (ref 01's
    and 07's construction). The paint-over is the only hand layer; everything under it is a
    render.
  - **Who paints** [I]: Dex or a pixel artist he brings in, or an agent making explicit pixel
    edits in small crops at 6x, A/B-checked edit by edit. This is the riskiest step left in the
    route, so prove it on one face stamp and one cut-in drawing before the moveset art is built
    (section 13, decision 6).
- **Procedural in the lab, for real:** particles (dust, sparks, motes, small shards), lights,
  camera, and the world palette events. They're points and small sprites, not contours.
- **Procedural in the lab, for timing only:** greybox stand-ins for every layer, using the
  effect kinds the engine already has (`arc`, `ring`, `pillar`, `burst`, `streak`, `disc`,
  `particles`, `cracks`, `afterimage`, `group` [M, RUNTIME-CONTRACT]). They prove timing and
  width before the art exists and never ship as the art.
- **Hand-touch budget:** contact, coil and hold drawings (hers and the saint's) plus every face;
  the rest gets the automatic cleanup (orphan pixels, pixels that flip between frames) from
  RESEARCH 4.8.
- **Hard rule:** no image generation. The generative add-ons that are enabled in Blender 5.1
  (`stablegen`, `higgsfield_blender`, `meshy` [M, MOTION-SOURCES]) stay off in every session that
  touches her.

## 13. Decisions for Dex

1. **Height:** 96 px (05's face budget) or about 128 px (closer to 07/08/09)? Recommended: A/B
   96, 112 and 128 on the first real model before authoring moves. [I]
2. **Glaive over sword.** CANON's "the sword" line would change.
3. **Hair and eyes:** indigo with azure tips and azure eyes. Alternatives to A/B: gold eyes
   (judgment.md, halo.md), or hair shifted toward violet if she dissolves into her own blue.
4. **Costume additions:** thong-cut back kept (decided by Dex 2026-09-28), dark indigo
   thigh-highs (decided by Dex 2026-09-29, revision 3; were white), indigo boots, short veil,
   indigo sleeve lining.
5. **Name.** "Rosace" is a placeholder.
6. **Who does the pixel paint-over** on the face stamps and the cut-in (section 12): Dex, a
   pixel artist he brings in, or an agent making explicit pixel edits under A/B? Recommended:
   prove it on one stamp and one cut-in drawing first. [I]
7. **The free hand at rest** (revision 3.1, from construct round R1). Section 1 puts it at the
   collar cross. With the sleeves at their DESIGN size (the 144 column above), the far bell hangs
   from a forearm that crosses the chest: it closes the far arm window (ART-RULES FG-N04, a block
   rule) and covers the chest window and hip band (CL-N03). The hand on the far hip passes every
   silhouette rule and reads with more attitude, and the 3D rig's own idle already stands that
   way. Options: hand on the far hip (the round R1 hero), or the collar hand with the far bell
   pinned back. [I; M, ART-RULES 10 round R1, O-10]
8. **Boot height** (revision 3.1). Section 3 row 12 gives the boots 9 px at 96 (about 13.5 at 144,
   an ankle boot) but calls them mid-calf; both construct rounds draw them 20–21 px tall at 144.
   Which is it? [conflict; ART-RULES O-12]

## Revision log

**Revision 3**, 2026-09-29. Design fixes Dex approved after critic round 4, which plateaued at
about 5.7/10 against the refs' 9. The critics' repeated notes were a blank half-lidded stare, a
mannequin stance, white-on-white legs, block hands, a flagpole grip and a missing collar cross.
The construction rules behind every fix are in `ART-RULES.md` (rule IDs in brackets); the
evidence is in `art-rules/face.md`, `figure.md` and `pixel.md`.

1. **Face: bright and confident by default** (section 5, short version item 2). Was: "a calm
   half-lidded face", Serene (half-lid, 1 iris pixel) as the default, no brows at 96. Now: open
   azure eyes aimed at a named target, brows always present, a smirk with a bent corner, one
   asymmetry, and a 144 px construction grid that lengthens the face below the eyes (round 4 was
   0.69 of the face width; the refs are 0.87–0.91). The half-lid survives as Serene, for prayer
   beats only. Resolute is renamed Focused and now moves brows and mouth as well as lids. The 96
   and 128 px face tables and the round-4 stamps in `art/rosace/faces/` are marked superseded,
   not deleted. [FC-P01–FC-P20, FC-N01, FC-N22, FC-N23]
2. **Dark thigh-highs** (section 3 rows 11–12, section 4, section 1 value structure, decision
   4). Was: white thigh-highs on the tabard's W ramp, 1.30:1 against the W1 tabard, so the legs
   merged. Now: the outfit's dark indigo ramp (I2 core), 6.8:1 against W1, which also puts a dark
   value between the legs. The boot gets a 1 px gold cuff line and runs one step darker so it
   still separates from the stocking (I2/I4 is only 1.95:1). No new colour; `palette.json`'s
   `stocking` material needs its ramp moved by that file's owner. [CL-P04, PX-P26]
3. **Collar cross restored** (section 3 row 1, section 11 lock 6). Was: a 3×3 cross that read
   as a gold blob at 144 (gold on white is 1.13:1). Now: 5×5 at 144 on a 1 px dark backing,
   visible in every front and three-quarter key pose, framed (not covered) by the free hand.
   [CL-P05]
4. **Constructed hands and a real two-hand grip** (section 7, section 2 arm row). Was: a
   three-stamp hand library (rounded-rectangle fists, a four-bump palm) and a forward arm lying
   along the haft. Now: every hand built per pose from palm box, mitten, thumb wedge and wrist
   step, at 144 px sizes; two-hand grips with the rear hand at the hip, the hands 24–30 px apart,
   both fists on the haft line, the haft collinear through them, and wrists inside the
   functional limits. The round-4 hand library is superseded, not deleted. [HD-P01–HD-P06,
   GR-P01–GR-P06, GR-N01, GR-N05]
5. **An idle with attitude** (section 1 rest pose and personality, section 7 rest carry). Was:
   the glaive upright beside her (about 6.5° at 144), level shoulders and hips, both knees
   locked, no gap between the arms and the body. Now: contrapposto with a vertical weight leg,
   opposed shoulder and hip tilts, a bent free knee, a tilted head, the glaive leaning away from
   her body at 15–35° with a wedge of negative space, and both arms opened off the body (the
   glaive arm reaching out, the free hand at the collar with the elbow lifted). [FG-P08–FG-P16,
   FG-N01, FG-N02, FG-N04, GR-P09, GR-N02, GR-N03]
6. **Height note** (section "Height"). 144 px is recorded as the shipped height, as PIPELINE 2.1
   already decided. The 96 and 128 px columns elsewhere are not converted yet; 144 wins where
   they conflict.
7. **Build route note** (section 12, face stamps). At 144 the stamp is constructed on the
   `ART-RULES.md` grid in 3 variants per expression and checked with `art-rules/checklist.json`;
   the 3D head gives only position and turn.

**Revision 3.1**, 2026-09-29. Design fixes from construct round R1 (`ART-RULES.md` section 10); no
change to how she looks.

1. **A 144 px column in section 2** for every part size that was only written at 96 and 128, most
   importantly the sleeve (42 long, 27 mouth, 48 flared), the tabard (11 × 51), the hair (about
   82 from the crown) and the veil (18 × 24). Round C1 drew the bells at a third of that size
   because the table had no 144 values. Lock 9 in section 11 gets the 144 sleeve numbers too.
   [ART-RULES CL-P06]
2. **Decision 7 added (the free hand at rest):** the collar hand of section 1 fails FG-N04 once the
   bells are at size; the hip hand passes. Section 1 carries a note and is otherwise unchanged
   until Dex picks. [ART-RULES CL-N03, O-10]
3. **Decision 8 added (boot height):** section 3 row 12's 9 px at 96 against "mid-calf" and the
   20–21 px both constructs draw. [ART-RULES O-12]

**Revision 3.2**, 2026-09-29. Design fixes from construct round R2 (`ART-RULES.md` section 10, round
R2), answering the round-1 critique of the painted face ("a tired, faintly sad young woman, not a
confident priestess"). Each item was tried as a trial variant and kept by rule check and by eye.

1. **The eye** (section 5): an A2 iris top with a 2 px A4 crescent and an I3 pupil, replacing the I3
   top that merged with the lash; the lash heavy only at the outer end with a 2 px flick; on
   Confident the lid line falls toward the nose. [FC-P22, FC-P13, FC-N25]
2. **The smile reaches the eyes:** the smirk side's lower lid lifts 1 px. [FC-P24]
3. **Brows** sit in forehead windows between fringe clumps and never slope down at the outer end on
   Confident, Focused or Ignited. [FC-P15, FC-N26]
4. **The smirk** is S4 throughout, 3 px, the near corner rising 2 rows. [FC-P07]
5. **Blush** is 2 px on one row; no vertical or diagonal marks under the eyes except the nose. [FC-P17,
   FC-N24]
6. **Chin** reads as a point: no neck skin beside the chin row. [FC-N13]
7. **Ignited and Hurt:** a dark iris core in an A4 rim; > < squeezed eyes. (section 5)
8. **The fringe** (section 6): 4 unequal clumps from a parting, not 3 equal ones. [HR-P11, HR-P12,
   HR-N04]
9. **The idle** (section 1): she leans about 2 px toward her staff, so the grip arm bends.
10. **No A1 on the sprite** (section 4): measured, it cannot serve as an iris top.

**Revision 3.3**, 2026-09-29. Design fixes from construct round R3 (`ART-RULES.md` section 10, round R3),
answering the round-2 critique (6.2/10: "sullen or unimpressed ... not confident and charming"). Each item
was a trial variant (one axis) kept by rule check and by eye beside refs 07, 08 and 09; the mouth by the
whole-face pick (ART-RULES WF-P11).

1. **The near eye is the big one** (section 5): the lash is the flick plus one row (was three rows over
   the near eye), so the near eye shows 4 iris rows against the far eye's 3. [FC-P09, FC-P13, FC-P26]
2. **Matched catchlights:** both on the top iris row at one offset from the pupils. [FC-P12]
3. **Brows in clean windows** under a solid fringe shadow; near 3 px cocked, far 2 px level. [FC-P15,
   FC-P27, FC-N27]
4. **The Confident mouth:** a 4 px smile with both corners up and a near dimple (was a 3 px smirk).
   [FC-P07]
5. **The jaw curves** into the chin (runs that shorten), never a staircase. [FC-N28]
6. **Ignited's shout:** the teeth row over a dark mouth. (section 5)
7. **Hair** (section 6): the angel ring on the skull's curve, the back hair in clumps, a lit silhouette
   break, an off-centre parting in front view. [HR-P08, HR-P13, HR-N05]
8. **The idle** (section 1): the free foot steps about 5 px toward the staff with the heel lifted (feet
   about 29 px apart). A cocked head was tried and dropped (it covered the collar cross, CL-P05).

**Revision 3.4**, 2026-09-29. The 3D base is adopted. Dex asked for "the busty SiroinoSotai body,
then swap in the head from the MMD女性素体"; that base won the blind A/B against the old one 6 to 5
(`review/rosace/base-v2/compare/`). The judge also found it was not busty yet and had heavier
thighs and shorter legs than the old base. Those fixes were made before adopting it. Numbers are
at 144 px, front view; the table is in section 2.

1. **Bust:** 15.8 → 18.1 px deep, 18.9 → 20.9 wide (the source's Breasts_LLL key at 0.5 added to
   Breasts_LL 1.0).
2. **Waist:** 11.9 → 10.0 px; waist to hips 0.47 → 0.417 (the old base: 0.429).
3. **Thighs:** 11.8 → 10.8 px at the top (the UpperLeg_L key is off).
4. **Legs:** the crotch moves from 51.6% to 53.7% of her height, 74.2 → 77.3 px at 144, back to the
   old base's 53.9%. The legs are stretched more and the torso is shortened, so the body isn't
   scaled down to fit.
5. **What it cost:** hips 25.3 → 24.1 px and shoulders 26.9 → 26.6. The glaive's off hand reaches
   less far: in N1 the worst hand-to-haft gap goes from 3.35 to 4.59 cm (about 3.5 px at 144).
   That one is open (`PIPELINE.md` 3.6e).
6. **Not done here, because they are pose work** (the hero keys in `art/rosace/poses/`): the near
   knee bowing in on the 80 px idle, hip tilt and back arch in the profile N1 frames, and deeper,
   more stylised bends to match refs 07 and 09.

**Revision 3.5**, 2026-09-29. Dex's appeal direction after the artist lane's A/B sheets, where she
lost every pick: the target is raised to 9/10 (parity with the refs); the idle and the back view
become seductive and elegant, on a wider stance; the bust gets bigger or more prominent; the thong
string becomes 1 px and black. The full block, with the numbers, the never-list and who owns
each change, is at the top of this file. A new figure-pose lane owns stance, pose and bust shape.
