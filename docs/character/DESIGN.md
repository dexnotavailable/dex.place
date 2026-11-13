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

## The short version

1. **Who she is.** A priestess whose fighting is a church service: every input is the next step
   of one continuous dance, and her effects are made of stained glass. Working name
   **Rosace** (French for "rose window"); Dex names her.
2. **What she looks like.** Ref 14's white-and-gold priest costume **including its thong-cut
   back** (Dex's call, 2026-09-28: keep it for appeal), white thigh-highs, indigo boots, a short white veil and an indigo sleeve
   lining. Long indigo hime-cut hair with azure tips, azure eyes, a calm half-lidded face.
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

- **Rest pose (the processional stance).** The glaive stands upright beside her, blade up, butt
  on the floor, held 4–8 px away from her hip so there's negative space between staff and body.
  Weight on the back leg, hip out (contrapposto). Her free hand rests at the collar cross.
- **Head shape.** Long dark hair, a short white veil behind it, a small gold rose pin at the
  crown. Each ref 13 enemy has a distinct crown, halo ring, hood or horns [M, REF-BREAKDOWN]; a
  dark head with a white veil point is unlike all of them. **No halo on her head**, because one
  ref 13 enemy wears a full red ring [visible].
- **Value structure** (from judgment.md): dark at the top (hair), light in the middle (white and
  gold costume, skin), dark at the ground (indigo boots) and in the weapon (indigo haft). That
  stops a white costume reading as one pale blob, and gives the rim light dark edges to sit on.
- **Personality in the pose:** serene. The violence belongs to the ritual, so she never looks
  strained. That matches CANON's quiet, still arrival.
- **Idle flourish:** about every 6 s she turns the staff once in her hand (24 f), and the rose
  disc glints.

**Silhouette test** (rubric 1): fill her with one colour at 3x. A critic who hasn't seen the
animation should name the action and facing of every key pose. In strike poses the glaive and
the arms must clear the torso.

## 2. Proportions at 96 px

About 6 heads tall, inside the rubric's 5.5–6.5 band [M, rubric 2]. Sizes are proposals, sized
from REF-BREAKDOWN's estimates for ref 14 at 96 px.

| Part | At 96 px | At 128 px | Note |
|---|---|---|---|
| Height | 96 | 128 | skull top to sole, boots included |
| Head (skull top to chin) | 16 | 21 | |
| Chin to crotch | 30 | 40 | collar 5 px (7 at 128) |
| Crotch to sole | 50 | 67 | 52% of height: long gacha legs (04, 08) |
| Shoulders / waist / hips, three-quarter view | 18 / 10 / 16 | 24 / 13 / 21 | a clear hourglass |
| Arm, shoulder to wrist | 30 | 40 | hands 4–5 px (5–6) |
| Knee height | 26 | 35 | |
| Detached sleeve | 28 long; mouth 18 hanging, up to 32 flared | 37; 24 / 42 | flare keyed per drawing |
| Front tabard | 7 × 34 | 9 × 45 | hip to mid-shin |
| Thong-cut back | 1 px gold edge lines | 1–2 px gold edge lines | ref 14's cut, kept (Dex's call) |
| Hair | tail ends at mid-thigh, about 55 px from the crown | about 73 | gathered by a ring near the end |
| Veil | 12 × 16 | 16 × 21 | back of the head to the shoulder blades |
| Glaive | 130 (1.35 H) | 173 | the refs' weapons run 0.93–1.1 H [M, REF-BREAKDOWN]; a glaive goes longer on purpose |

## 3. Outfit, adapted from `14-outfit-priest-sister.png`

The costume keeps ref 14's parts and places and adds the legs, feet and back cover the sheet
doesn't design. Every patch of skin it shows is small and framed by gold lines, which is what
reads as "designed costume" rather than bare skin at 96 px [I, REF-BREAKDOWN under 14].

| # | Part | From 14? | Shown or covered | At 96 px | Motion job |
|---|---|---|---|---|---|
| 1 | High stand collar, gold edge, gold cross at the throat, small shoulder yoke | yes | covers the neck | white block 5 px tall, 1 px gold rim, 3×3 gold cross | rigid |
| 2 | Front panel with a diamond chest window in gold | yes | window shown | window 5×9 front, 3×9 three-quarter; 1 px gold frame around 2 skin tones | rigid |
| 3 | Open sides, armpit to hip | yes; front panel 1 px wider each side | shown | 3–4 px strip in side view, crossed by gold lines; this is her most visible designed skin in a side-view game | none |
| 4 | Bare shoulders, gold armbands | yes | shown | armband 1–2 px gold line, 1 highlight pixel | none |
| 5 | Detached trumpet sleeves, gold hem, fleur-cross at the corners | yes, **plus an indigo lining** | cover the forearms | white outside, indigo inside, 1 px gold hem, 3×5 corner cross. A flare flips the sleeve from light to dark, which reads at real size and gives the rim light a dark surface | main flag |
| 6 | Long front tabard, V-notch, gold border, big fleur-cross | yes | covers the front | 7 px strip, 1 px gold edge, 5×7 cross | main flag; shows facing |
| 7 | Hip band with oval medallion, O-rings, cross charms | yes; the medallion becomes a tiny rose (3×3 gold with 1 azure pixel) | band on skin | 1–2 px band; 1×2 charms | charms flick |
| 8 | Garter straps to a gold thigh band, cross charms | yes | about 16 px of bare thigh shown | 1 px gold straps | charms |
| 9 | Open back: pentagon halter yoke, cross on the upper back, mid-back strap | yes | back shown | 3×5 yoke cross, 1 px gold straps | shows in N2's pivot, the dash pirouette and R |
| 10 | Thong-cut back | **yes, kept as ref 14 designs it** (Dex's call) | seat shown, framed | thong (white, or black if white doesn't read — see below) with a 1 px gold edge meeting the hip band and garter harness; the glutes are shaded as form with the skin ramp (lit, shadow, deep crease) so they read as body, never a flat skin blob | none; the sleeves, veil and hair carry motion from behind |
| 11 | Legs (not on the sheet) | **added**: white thigh-highs, 1 px gold top band | covered below mid-thigh | lavender shadow side, 1 px sheen | none |
| 12 | Feet (not on the sheet) | **added**: indigo mid-calf boots, gold toe and heel caps | covered | 9 px tall | ground her on light floors, take rim light |
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
| I0–I4 | Indigo | `#a9b8f2` `#6c72d0` `#4a4aa6` `#322c78` `#211a4e` | hair, sleeve lining, boots, haft |
| T2–T4 | Steel | `#bccae2` `#8290b4` `#505a84` | blade; the cutting edge uses A5, like ref 08's white edge line [visible] |
| A2–A5 | Azure (shared with the effects) | `#2a62d0` `#4aa8f0` `#a0e6ff` `#f0fcff` | eyes, hair tips, the weapon's glass, and the cool rim (section 9) |

That's 1 + 4 + 5 + 5 + 2 + 5 + 3 + 4 = 29. [M, count] Revision 1 had a 30th colour, RW
`#e6f4ff`, as the rim target on white. It measured 1.03:1 against W1 and is gone (section 9).

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

**At 96 px** (16 px head): ref 05's size built with ref 01's logic (rubric 3).

| Feature | Pixels | Colour |
|---|---|---|
| Eye | 3 wide × 2 tall. Top row: the lash, 3 px, the outer end flicking up 1 px in three-quarter view. Bottom row: 2-tone iris (A2 inner, A3 outer) and 1 skin pixel. | OL; A2, A3 |
| Far eye (three-quarter) | 2 px wide | same |
| Highlight | only in the cut-in and close-ups | – |
| Brows | none; the bangs cover them | – |
| Nose | none in three-quarter; 1 px S3 in profile | S3 |
| Mouth | 1 px; 2 px open | S4 |
| Blush | 1 px under each eye | SB |

**At 128 px** (21 px head), closer to 07 and 08:

| Feature | Pixels |
|---|---|
| Eye | 4 wide × 3 tall: lash row 4 px with a 1 px outward flick; iris 2×2 (A2 over A3); 1 px A5 highlight at the top inner corner of the iris |
| Brows | 1 px angled strokes seen through the gaps in the bangs, in I2 |
| Nose | 1 px S3 shadow in three-quarter view |
| Mouth | 2 px; 2×2 open |
| Blush | 2 px under each eye |

**Expressions** (at least neutral, happy, angry per rubric 3):

- **Serene** (default): half-lidded, the lash row lowered 1 px so only 1 iris pixel shows.
- **Resolute** (attacks): the inner lash end drops 1 px.
- **Radiant** (happy, wins): eyes closed into 3 px arcs, mouth open 2 px.
- **Ignited** (R and Illumination): the iris turns A4, with a 1 px A4 glow beside the eye.
- **Hurt:** eyes squeezed into a 1 px arc, mouth 2 px.

**The cut-in bust** (R): the same character at about 3 times the sprite's head size (a head of
about 48 px), on the same pixel grid. This is where the detailed face lives, built with ref 01's
and 07's construction (lash with flick, 3-tone iris, highlight, brows, blush, a nose shadow).
It's a render of the same model with a pixel paint-over on the face (section 12), never
generated (CANON: no image generation).

## 6. Hair

- **Cut:** a long hime cut. Straight bangs broken into 3 clumps by 1 px separators. Sidelocks
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

- Rest: upright in the near hand (her right hand, toward the camera; the spike's convention
  [M, `blender_spike.py`]), butt beside the rear foot.
- Walk: upright, swinging slightly. Run: angled forward, blade leading low, stole streaming.
- Both hands on every attack. The grip slides to the middle of the haft for twirls (N3, Q) and
  to the butt for the widest sweeps (N5).
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
6. **Gold trim** is always 1 px; cross glyphs keep their sizes (collar 3×3, sleeve 3×5, tabard
   5×7, stole 3×5).
7. **The glaive** is 130 px in every drawing except smears, where it may stretch up to 15% and
   bend (ref 09's bent blade [visible]). The disc and glass spine always show the current meter
   and cooldown state.
8. **Pivot** at the foot centre on the ground; hands on the haft (section 7).
9. **Cloth sizes:** sleeve mouth 18 px hanging, never over 32 px flared; tabards keep their
   lengths; only the lead flag flares.
10. **Pixel size:** effects, apparitions, face stamps and the cut-in are all on the sprite's
    pixel grid; no mixed pixel sizes (rubric 7). The 2.5x glass saint is a bigger render, not an
    upscale.

## 12. How she gets built (3D-to-pixel route)

- **Rendered in Blender** from a rigged model: body, costume, hair, glaive with its disc.
  Orthographic camera, no anti-aliasing, constant toon ramps, and per-frame albedo, normal and
  material-ID passes [S, RESEARCH 4.1, 4.7]. The body comes from VRoid Studio's new-model base
  (installed; its guidelines allow editing and publishing in games and websites [S,
  MOTION-SOURCES]). Cloth and hair are hand-keyed per drawing; shape keys push the flare on
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
    tiny, fixed budget, checked at 6x against 05 and 01. It isn't contour drawing.
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
4. **Costume additions:** thong-cut back kept (decided by Dex 2026-09-28), white thigh-highs, indigo boots, short
   veil, indigo sleeve lining.
5. **Name.** "Rosace" is a placeholder.
6. **Who does the pixel paint-over** on the face stamps and the cut-in (section 12): Dex, a
   pixel artist he brings in, or an agent making explicit pixel edits under A/B? Recommended:
   prove it on one stamp and one cut-in drawing first. [I]
