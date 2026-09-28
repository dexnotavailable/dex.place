# Concept: LITURGY, the ritual-dance priestess

In this concept a fight plays like a church service. Every input is the next step of one
continuous dance: the end of one hit is already the wind-up of the next. Her detached sleeves,
tabards, stole and hair trail behind her like ribbons. Her effects are made of stained glass.
Each swing hardens into leaded glass panes that hang in the air, light her from the side and
then shatter. Those panes power her finisher and her skill. Her ultimate draws a rose window
across the whole screen and throws every pane outward.

Working name: **Rosace** (French for "rose window"). It's a placeholder; Dex names her.

Companions: `../REF-BREAKDOWN.md`, `../QUALITY-RUBRIC.md`, `../CRITIQUE-PARAMS.md`,
`../RESEARCH.md`, `../MOTION-SOURCES.md`. References are named by filename and never embedded.

Tags, the same as the companion docs:

- **[M]** measured, quoted from a companion doc (the section is named).
- **[S]** sourced, quoted from a companion doc's outside source.
- **[I]** inference or design proposal. **Everything in this file is [I] unless it's tagged
  otherwise.** Every number below is a first A/B candidate, not a decision.

Units: **H = character height = 96 px** (the working assumption). Frames are at 60 fps and
written `f`. Move frames are local: f1 is the first frame after the input.

## The short version

1. **Weapon: a glaive.** It's a processional cross that is also a blade: a long dark haft, a
   small rose-window disc with gold arms that make a cross, and a lancet-shaped blade. Two
   stole ribbons are tied under the blade. At rest the silhouette reads "priestess holding a
   processional cross". In motion it's a baton-twirling polearm with a reach of 1.35 H.
2. **Colour identity: "Chartres blue" glass with gold leading.** A cobalt-to-azure ramp with a
   cool white core, plus gold from the costume. The ultimate alone adds amethyst. There's no
   red anywhere, so red always means the enemy (ref 13).
3. **Every smear decays into stained glass.** Ref 10's decay (full, then striped, then a
   sliver) becomes full, then leaded glass cells, then falling shards. So every hit shows the
   motif, not just the ultimate.
4. **Panes are the kit's thread.** Each M1 hit leaves a small glass pane hanging where the
   blade passed. Panes last a few seconds and light her rim. The finisher and Q absorb them to
   grow wider. Hitting on the beat makes a gilded pane.
5. **Three shape languages, one per scale.** A horizontal ring that expands sideways (the M1
   finisher), a row of vertical lancet windows rising from the floor (Q), and a face-on rose
   disc (R). A rose window is a flat disc seen face-on, so a side-view game shows it without
   any faked perspective.
6. **8-fold symmetry is her signature and a pixel-art shortcut.** Every radial line sits at
   0, 45 or 90 degrees, the three cleanest pixel lines. The rose only needs one 45-degree
   wedge drawn by hand; the grid's exact flips and 90-degree turns produce the rest with no
   resampling (checked with a script: exact, and the wedge is about an eighth of the pixels).
7. **Widths:** M1 hits 1.8–2.4 H, the finisher ring 4.8 H (7.2 H with panes), the dash trail
   2.3 H, Q 5.6 H (8.2 H when built up), and R fills the whole view with beams running off both
   edges.

---

## 1. Character design at pixel scale

### 1.1 Silhouette and proportions

At rest she should read in solid black as "a slim figure with two bell-shaped sleeves,
standing beside a tall cross-staff". The glaive is the tallest shape on screen, so it
identifies her before any detail does.

- **Idle (the processional stance):** the glaive stands upright beside her, blade up, butt on
  the floor, held a few pixels away from the body so there's negative space between staff and
  hip. Weight is on the back leg with the hip out (contrapposto). The free hand touches the
  cross at her collar. Stole tails and sleeve hems drift in a slow loop. About every 6 s she
  turns the staff once in her hand (24 f), which is the idle flourish.
- **Head shape:** long indigo hair, a short white veil behind it and a small gold rose pin at
  the crown. The enemies in ref 13 each have a spiked crown, halo ring, hood or horns; a dark
  head with a white veil behind it is unlike all of them.
- **Personality in the pose:** serene. She never looks strained, because the violence belongs
  to the ritual. That also matches CANON's quiet, still arrival.

The pixel budget below is what 96 px buys at 6 heads tall. These are proposals sized from
REF-BREAKDOWN's table for ref 14.

| Part | Size at H = 96 | Note |
|---|---|---|
| Head (skull top to chin) | 16 px | 6 heads tall, inside the rubric's 5.5–6.5 [M, rubric 2] |
| Chin to crotch | 30 px | collar 5 px tall |
| Crotch to sole | 50 px | 52% of height: long gacha legs |
| Shoulders / waist / hips (3/4 view) | 18 / 10 / 16 px | hourglass |
| Arm, shoulder to wrist | 30 px | hands 4–5 px |
| Detached sleeve | 28 px long, mouth 18 px hanging, up to 32 px flared | flare keyed per drawing (see 1.6) |
| Front tabard | 7 × 34 px | hip to mid-shin |
| Back tabard | 7 × 26 px | replaces the thong cut (1.2) |
| Hair tail | about 55 px | ends mid-thigh |
| Veil | 12 × 16 px | back of the head to the shoulder blades |
| Glaive | 130 px (1.35 H) | the refs' weapons run 0.93–1.1 H [M, REF-BREAKDOWN]; a glaive goes longer by design |

### 1.2 Outfit, adapted from `14-outfit-priest-sister.png`

The costume keeps ref 14's parts and places. It adds legs and a back cover the sheet doesn't
design. The skin it shows comes in small patches, each framed by gold lines, which is what
makes it read as a designed costume rather than bare skin at 96 px (REF-BREAKDOWN's point
under 14). The table lists each part, what's shown or covered, and the pixel treatment.

| Ref 14 part | Liturgy version | Shown / covered | At 96 px |
|---|---|---|---|
| High stand collar with a gold cross and small shoulder yoke | kept | covered | 5 px white block, 1 px gold rim, 3×3 gold cross |
| Front panel with a diamond chest window | kept | window shown | window 5×9 px front view, 3×9 at 3/4; 1 px gold frame around two skin tones |
| Open sides, armpit to hip | kept; front panel 1 px wider each side | shown | the arm usually covers the upper part; the hip shows in side view, crossed by gold lines |
| Bare shoulders and upper arms, gold armbands | kept | shown | armbands are a 1–2 px gold line with 1 highlight pixel |
| Detached trumpet sleeves, gold border, fleur-cross corners | kept, plus an **indigo lining** | covered | white outside, indigo inside: a flare flips the sleeve from light to dark, which reads at real size and gives rim light a dark surface to sit on |
| Long front tabard with a V-notch and a gold fleur-cross | kept | covered | 7 px strip, 1 px gold edge, 5×7 cross |
| Hip band with oval medallion, O-rings, cross charms | kept; the medallion becomes a tiny rose (3×3 gold with 1 azure pixel) | band on skin | ties the costume to the rose motif |
| Garter straps to a thigh band, cross charms | kept | mid-thigh skin shown | 1 px gold straps over about 16 px of bare thigh; 1×2 px charms swing |
| Open back: pentagon yoke, upper-back cross, mid-back strap | kept | back shown | shows during N2's pivot and the dash pirouette |
| Thong-cut back | **replaced by a short back tabard** (REF-BREAKDOWN proposal) | covered | at 96 px a thong is a 1–2 px line in a skin blob that reads as nude; a tabard reads as costume and is one more ribbon in spins |
| Legs (not on the sheet) | white thigh-highs with a 1 px gold top band | covered below mid-thigh | the garters need something to hold |
| Feet (not on the sheet) | **indigo mid-calf boots**, gold toe and heel caps | covered | dark feet ground her on light floors and take rim light |
| Head (not on the sheet) | short white veil (warm beige lace hem), gold rose hairpin | covered | the "sister" read, plus a head shape unlike the enemies' |

Net read: bare shoulders, chest window, sides, open back and a band of thigh, all framed in
gold. It's "decently revealing" in the places ref 14 chose, and it's still plainly a priest.

### 1.3 Hair, face, headpiece

- **Hair:** a long hime cut. Straight bangs broken into 3 clumps by 1 px separators, sidelocks
  to the collarbone held by small gold cross clasps (these swing like the garter charms), and
  back hair to mid-thigh, gathered loosely near the end by a gold ring so the lower half moves
  as one clean ribbon. **Indigo-violet, with the tips shifting to azure**, the same hue-shift
  trick ref 03 uses on its hair tips. Visually she's been dipped in her own glass light. At
  least a third of the hair pixels should sit in the two lightest indigo tones, so the mass
  never reads as black next to the ref 13 enemies [I, a target to check with `_palette.py`].
- **Face, built like ref 05 at its size and with ref 01's logic** (rubric 3):
  - Eye: 3×2 px. The top row is the lash (outline colour, 3 px, with the outer end flicking up
    1 px in 3/4 view). The bottom row holds a 2-tone azure iris (A2 inner, A3 outer) and one
    skin pixel. The 1 px highlight appears only in the cut-in and close-ups.
  - Far eye 2 px wide at 3/4 view. No brows (the bangs cover them). No nose in 3/4 view; in
    profile, 1 px of S3 marks it. Mouth 1 px (S4), 2 px when open. One blush pixel under each
    eye.
  - Expressions: **serene** is the default, half-lidded with the lash row lowered 1 px so only
    1 iris pixel shows. **Resolute** drops the inner lash end 1 px. **Radiant** closes the eyes
    into 3 px arcs and opens the mouth 2 px. **Ignited** (R only) turns the iris to A4 with a
    1 px A4 glow beside the eye.
  - The face is hand-authored for each facing angle (front 3/4, profile, back); the 3D face is
    never downsampled (REF-BREAKDOWN, "what the route has to add by hand").
- **Cut-in bust (R):** the same character at 3 times the sprite's head size (about 48 px
  head), same pixel size, built with ref 01 and 07's face construction.

### 1.4 Palette

Proposal: 30 colours for the character including the weapon, inside the rubric's 32
[rubric 6]. Materials share darks, and the indigo ramp serves hair, sleeve linings, boots and
the haft. The table gives each ramp from light to dark.

| Material | Ramp (light → dark) | Notes |
|---|---|---|
| Outline | `#181032` | tinted near-black plum-navy, never `#000000` (rubric 5) |
| White cloth (W1–W4) | `#f8f5f0` → `#dcd7e6` → `#b7aecb` → `#8b80a6` | W1 is ref 14's white chip; lavender shadows like ref 01 |
| Gold (G0–G4) | `#fff3c4` → `#ecc96f` → `#d1a452` → `#a2722f` → `#6a4520` | G2 is ref 14's gold chip; G0 is the 1 px specular only |
| Skin (S1–S4) + blush | `#fbe4cf` → `#f3d2b2` → `#e2a996` → `#b8766f`; blush `#ee9ea0` | S2 is ref 14's skin chip |
| Beige (B1–B2) | `#e4d2ba` → `#c4ab93` | ref 14's beige chip; veil lace and the back of the stole, so ribbon twists show as a colour flip |
| Indigo (I0–I4) | `#a9b8f2` → `#6c72d0` → `#4a4aa6` → `#322c78` → `#211a4e` | hair, sleeve lining, boots, glaive haft |
| Steel (T2–T4) | `#bccae2` → `#8290b4` → `#505a84` | blade; its cutting edge uses A5 (ref 08's white edge line) |
| Rim on white | `#e6f4ff` | see 1.7 |
| Shared with VFX | A2 `#2a62d0`, A3 `#4aa8f0`, A4 `#a0e6ff`, A5 `#f0fcff` | eyes, hair tips, weapon glass |

The effects get their own ramps, each running dark to hot with white-hot only at the brightest
point (rubric 9):

| VFX ramp | Colours (dark → hot) | Used for |
|---|---|---|
| Chartres azure (A0–A5) | `#0d1240` → `#1a2f8c` → `#2a62d0` → `#4aa8f0` → `#a0e6ff` → `#f0fcff` | every smear, pane and flash; A0 is the "leading" between glass cells |
| Gold light | G3 → G2 → G1 → G0 → `#fffbe8` | slivers, tracery lines, on-beat glints, R's second flash |
| Amethyst (V1–V3) | `#3a1a68` → `#6a3cb0` → `#a47ae6` | R's petal hearts and the darkest cells of gilded panes; nowhere else, so it signals "ultimate" |
| Dust | W3, W4 | ground dust in the costume's shadow lavender, ref 11's grey dust layer brought onto our palette |

Readability rules:

- **No red and no neutral grey** in her or her effects. The enemies own exactly those
  (13: one grey ramp plus one red ramp [M, REF-BREAKDOWN]).
- **Her white against her effect cores:** her whitest white is warm (`#f8f5f0`); effect cores
  are cool (`#f0fcff`) and always surrounded by an A4 band, and she keeps her outline. That's
  rubric 12's rule, met by colour temperature as well as brightness.
- **Enemies hit by her flash A4 for 2 f**, so a hit is marked in her colour, not theirs.

### 1.5 Weapon: the processional glaive "Lancet"

**Choice: glaive.** Three reasons:

1. **Width.** Dex wants very wide AOE. At 1.35 H, a full swing with the arms extended sweeps a
   circle about 3 H across before any effect is added. A 1 H sword sweeps about 2.2 H.
2. **The dance.** Continuous spins, baton twirls, passing the weapon behind the back, planting
   it and vaulting: the whole "ritual dance" vocabulary comes from staff and polearm work. A
   sword's short lever can't circle the body the same way.
3. **The theme.** A priest's processional cross is a tall staff with a cross at the top. A
   glaive held blade-up is that silhouette, so she is in costume even at rest.

CANON's interaction line says "the sword" for slashing and cutting cords. The glaive's blade
does the same job; the Character section of CANON is still open and Dex's brief allows either.
Flagged in section 6.

The silhouette, bottom to top:

| Part | Size | Look |
|---|---|---|
| Butt | 3×6 px | gold spike and knop for planting |
| Haft | 94 px long, 3 px thick | **dark indigo lacquer** (I2 core, outline sides) with three 2 px gold bands at the grip points. The haft is dark on purpose so the weapon never vanishes against her white body or a pale floor (rubric 1). |
| Rose disc | 9 px across | gold ring, 8 glass cells alternating A2 and A3, 1 px A5 centre; glows A4 when a move is active. It's the light source for her rim, the on-beat cue, and the seed of the ultimate. |
| Cross arms | 4 px each side, 17 px across in total | gold, ending in 1 px trefoil nubs; with the haft and blade they form the cross |
| Blade | 28 px long, 8 px at its widest | half a lancet window split down the middle: straight spine, convex cutting edge curving into the point. A 1 px gold fuller with 3 azure glass pixels (the "glass spine"). A 4×4 fleur-de-lis barb on the spine near the base echoes ref 14's crosses. Steel T2–T4, cutting edge A5. |
| Stole | 2 tails, 34 × 3 px each | white front, beige back, gold 3×5 cross at each end, tied under the rose disc. They're the weapon's built-in motion trail. |

Rejected alternative: a censer on a chain at the butt end. It's very liturgical, but it adds a
second swinging mass that fights the stole for attention at 96 px.

### 1.6 The cloth as ribbons

Eight trailing elements is a lot for 96 px. The only way it stays readable is strict rules
about who lags how much, and where cloth is allowed to be during a hit. All of it is
hand-keyed per drawing, with no physics simulation (the Guilty Gear Xrd rule [S, RESEARCH
4.2]). The table sets the order.

| Element | Lags the body by | Overshoot | Settles in |
|---|---|---|---|
| Veil | 1 drawing | small | 2 drawings |
| Sidelocks and clasps | 1 | small | 2 |
| Garter charms (1×2 px) | 1 | yes, a flick | 2 |
| Sleeves | 1 | flare up to 32 px on contact drawings | 3 |
| Front and back tabards | 2 | yes | 3 |
| Hair tail | 2 | fans into 5–8 strands on spins (ref 05 row 7) | 4 |
| Stole tails | 2–3 (the tip of the whip) | most | 4 |

**The trailing-side rule:** on every contact drawing, all cloth and hair are swept to the side
the blade came *from*. The side it's travelling *toward* stays clear, which keeps the negative
space open for the weapon and the smear (rubric 1).

**Per-drawing exaggeration:** sleeves flare 15% bigger and the stole lengthens 20% on contact
and smear drawings, done with shape keys on those drawings only. That follows Guilty Gear's
practice of deforming the mesh on each key [S, RESEARCH 4.2].

### 1.7 Rim light

Rim light is the rubric's own bar: 1 px, lit side only, in the light's colour, timed with the
effect [rubric 11]. What Liturgy adds is *where the light comes from*.

- **Her own light direction** (upper-back, pale gold G1), fixed per character, like Guilty
  Gear's per-character light [S, RESEARCH 2.9].
- **Every hanging pane is a point light.** The nearest two panes plus the active move's effect
  drive the normal-map rim, so during a string she's lit by the glass she has made. Stepped to
  1–2 palette colours, never a gradient.
- **Dark materials carry the bright rim:** a 1 px A4 band on the hair, sleeve lining, boots and
  haft.
- **White cloth can't take a brighter rim,** because nothing on her is brighter than W1. On
  white, the rim is a *temperature* rim: the lit edge shifts from warm W1 to cool `#e6f4ff`.
  It reads as "lit by blue glass" without a white-on-white halo.
- **Two-sided moments stay legal.** During Q, lancets stand on both sides, so she gets a rim on
  both flanks but never on top or bottom. It never closes into a full outline (rubric 11).

---

## 2. Moveset

### 2.0 Rules shared by every move

**Frames and drawings.** The game runs at 60 fps. Drawings are authored on 30 fps timing, so
most hold 2 game frames. Smear and flash drawings hold 1 frame, and contact and coil poses
hold 3–8 [S, RESEARCH 4.4: Dead Cells ran animations at 30 fps; add frames before or after
keys, never between them]. In the tables, "A2 ×3" means drawing A2 held for 3 frames.

**Flow.** Each hit's first wind-up drawing is keyed from the previous hit's last
follow-through drawing, so a chained string never pops a pose. Hits 2–5 only ever start
chained.

**Hit feel** [S, RESEARCH 2.2; numbers from its rule of thumb]:

- Hitstop freezes her and the enemies she hit; effects and other enemies keep moving.
- Victims shake 1 px, sideways on the ground and up-down in the air, alternating every 2 f
  (Sakurai).
- Light hits freeze for 2–3 f, heavy hits for 4–8 f [I, inside RESEARCH 2.2's rule of thumb:
  2–5 f for normal hits, 6–9 f for finishers].
- She holds the contact drawing during the freeze instead of drifting at 1% speed, because
  sub-pixel drift shimmers.

**Camera** [S, RESEARCH 2.6 and 3.2]:

- No zoom, ever: a non-integer zoom breaks the pixel grid.
- Replacements for zoom are a 1–6 px camera push, a darkened background, and CANON's black
  cinematic bars closing in.
- Shake is whole-pixel translation with no rotation, sized by trauma squared, at most 4 px.

**Flash safety** [S, RESEARCH 2.8]:

- At most 2 full-screen flashes anywhere in the kit, both in R, 1.3 s apart.
- Every other flash is local (a disc around the contact point).
- Impact frames hold steady instead of alternating.
- A "reduce flashing" setting turns full-screen flashes into a 40% tint.

**The glass decay: how every smear dies.** This is ref 10's decay sequence (1 full drawing,
then 1–2 striped drawings, then a sliver [M, REF-BREAKDOWN]) redrawn as her motif. The table
gives the stages; per-move tables only list the frames.

| Stage | Length | Look |
|---|---|---|
| Full | the smear drawing(s) | leading edge A5, 2–3 px thick; body in two flat tones (A3, A2); tail tapering in A1 to a 1 px point; 1–2 thin gold (G1) slivers riding outside the arc |
| Leaded | next 4–6 f | 1 px A0 lines cut the smear into 3–7 glass cells along its length (cells keep flat A1/A2/A3); leading edge drops to A4 |
| Shards | next 6–10 f | cells come loose as 2–4 px shards that fall with gravity; each has one glint pixel that blinks once |
| Gone | 2 f | 1–2 px gold slivers of leading, then nothing |

**Leading on glass is the one dark line in her effects.** The rubric fails "a dark line drawn
around effects" (rubric 5). Leading appears only on the glass layers (cells, panes, lancets,
the rose), which behave as solid objects the way ref 08's dark shards do. It never outlines a
smear's full stage, a flash or a spark. This is the first thing to A/B (section 5).

**Panes: the thread through the kit.**

- Every M1 hit leaves one **pane** at the tip of its arc. A pane is a small lancet of glass,
  7×13 px (A1/A2/A3 cells, A0 leading, a 1 px A4 glow). It hangs there bobbing 1 px every
  20 f, lives 150 f (2.5 s), and then dies through the glass decay.
- **At most 8** panes exist at once; the oldest breaks first.
- Panes are point lights for her rim (1.7).
- The M1 finisher absorbs up to 4 pane units and Q absorbs up to 4. A gilded pane counts as 2.

**Cadence: the beat.**

- The first 8 f of each hit's chain window are its **cadence window**, and the rose disc on
  the glaive glints (1 px G0, 2 f) as it opens.
- An input pressed inside the window is **on the beat**:
  - the pane comes out **gilded** (gold leading, amethyst in its darkest cell, 240 f life,
    counts double)
  - her rim flashes G1 for 2 f
  - the hit sings the next note of a rising phrase (SFX)
- Inputs buffered before the window opens still chain, just not on the beat. Mashing works;
  rhythm rewards.

**Effect widths at a glance.** How wide each move reaches compared with the floors the rubric
and research set. Wider is the brief.

| Move | Main effect | Widest reach | Rubric floor [rubric 10] | Research suggestion [RESEARCH 3.2] |
|---|---|---|---|---|
| M1 hits 1–4 | 1.8–2.4 H (173–230 px) | 2.4 H | ≥1.5 H | 1.5–2.5 H |
| M1 finisher | sweep 3.3 H, ring 4.8 H | 7.2 H with 4 pane units (691 px, wider than the 640 px view) | – | 3 H plus a floor band |
| M2 dash trail | 2.3 H | – | ≥2 H | ≥2 H |
| Dash attack | sweep 2.7 H, spray to 3.0 H ahead | 3.0 H | – | – |
| Q | 5.6 H (538 px, 84% of the view) | 8.2 H built up | ≥3 H | 3–5 H |
| R | the whole view both ways, beams off both edges | ≥6.7 H wide, 3.75 H tall | ≥4 H | ≥640 px plus full height |

### 2.1 M1: "The Ordinary" (five hits)

Named for the five sung parts of the Mass. Sanctus and Credo swap places on purpose, because
the triple "Holy, holy, holy" belongs in the multi-hit slot.

**Whole-string timing.** Chained at the earliest windows, hits land at f9, 22, 38, 43, 52, 71,
79, 124 and 148. She's free to dash at f144 (2.4 s), and the string with full recovery lasts
188 f (3.1 s). The gaps between hits run 13, 16, 5, 9, 19, 8, 45, 24 frames: deliberately
uneven, with a long breath before the finisher. For comparison, gcsim puts Genshin sword and
polearm strings at 160–179 f with uneven gaps [M, RESEARCH 2.1].

#### N1 "Kyrie": rising cut

**Idea:** a quick rising cut that opens the ritual and leaves the first pane hanging where the
blade passed.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–7 | A1 ×2, A2 ×3, A3 ×2 | weight drops back; glaive dips low behind the hip; A2 is the coil; sleeves pulled back |
| Strike | f8 | S1 ×1 | glaive whips from low-behind to high-front; the blade itself is drawn bent (ref 09) |
| Contact + hitstop | f9–11 | C1 ×3 | hit lands f9; 3 f freeze |
| Follow-through | f12–15 | F1 ×2, F2 ×2 | glaive carries over her head; sleeves and stole overshoot forward |
| Recovery (if not chained) | f16–33 | R1 ×6, R2 ×6, R3 ×6 | settles into the processional stance |

- 10 drawings.
- **Windows:**
  - input buffer from f4
  - chains to N2 from f15 (cadence f15–22)
  - dash, jump, Q or R from f12
  - no i-frames
- **Root motion:** +8 px over f6–9 (the step in), +4 px over f12–15.
- **Hitbox:** a crescent sector around her shoulder, radius 0.35–1.45 H (34–139 px), from
  20° below horizontal in front up to 100°. That's about 1.5 H wide by 1.6 H tall.

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Blade glint | f5–6 | 1 px point running up the cutting edge | A5 |
| Main arc | full f8, leaded f9–14, shards f15–24 | crescent 1.8 H long, 12 px thick at the leading edge | A5 edge, A3/A2 body, A1 tail |
| Slivers | f8–12 | 2 parallel 1 px arcs outside the main arc | G1, G2 |
| Core flash | f9–10 | 8-point star, 9 px | A5 centre, A4 arms |
| Particles | f9–30 | 4–6 shards of 2–3 px, 3 gold motes rising | A2/A3 with A5 glint; G0 |
| Pane | spawns f9 | 7×13 lancet at the arc's tip | A1–A3, A0 leading (gilded: G2) |
| Ground | f6–14 | 8 px dust puff at the stepping foot | W3, W4 |
| Rim light | f8–16 | 1 px on edges facing the arc | A4 on dark materials, `#e6f4ff` on white |

- **Camera:** 1 px push in the facing direction on contact.
- **SFX:** silk whoosh plus blade swish; a small glass chime on contact. On the beat, a sung
  "ah", note 1 of the phrase.
- **Informed by:** ref 10 (smear anatomy and decay), ref 09 (bent blade), ref 06 (draw order:
  trail behind, slash in front, spark on top). Genshin's first hits land at 11–13 f (Flins,
  Skirk) [M, RESEARCH 2.1].
- **Timing source:** Quaternius UAL2 "Sword Regular A" plus "A Rec" for the hit/recovery split
  (CC0, retarget). Bandai Namco `slash_normal_001` for professional timing (timing only until
  Dex rules on the non-commercial licence) [S, MOTION-SOURCES].

#### N2 "Gloria": pivot sweep, front and back

**Idea:** she pivots all the way round so one flat sweep cuts both in front and behind, and
the open back of the costume shows mid-turn.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–6 | A1 ×3, A2 ×3 | pivots on the front foot; A2 shows her back (open back, back tabard), glaive at shoulder height behind her |
| Strike | f7 | S1 ×1 | a flat ellipse of smear all the way around her |
| Contact + hitstop | f8–10 | C1 ×3 | front again, glaive leading low; cloth wrapped the other way |
| Follow-through | f11–16 | F1 ×3, F2 ×3 | sleeves unwind and flare |
| Recovery | f17–38 | R1 ×7, R2 ×7, R3 ×8 | |

- 9 drawings.
- **Windows:** chains to N3 from f17 (cadence f17–24); dash from f11. No i-frames.
- **Root motion:** turns in place, +6 px.
- **Hitbox:** a flat ellipse centred on her hips, ±1.15 H (2.3 H wide) by 0.45 H tall, knee to
  chest. It hits both sides.

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Main arc | full f7, leaded f8–13, shards f14–24 | flat ellipse 2.4 H × 0.5 H; the half behind her is drawn behind her body, the front half in front | A5 edge, A3/A2, A1 tail |
| Slivers | f7–11 | 2 thin flat arcs above and below | G1 |
| Core flash | f8–9 | 8-point star, 9 px, on each enemy hit | A5, A4 |
| Particles | f8–30 | shards thrown sideways | A2/A3 |
| Pane | f8 | at the front tip | as N1 |
| Ground | f7–20 | stepped dust band ±1.3 H, 4 px tall | W3, W4 |
| Rim light | f7–14 | from both sides as the ellipse passes | A4 / `#e6f4ff` |

- **Camera:** 1 px push.
- **SFX:** a long silk flutter (sleeves plus stole), a whoosh with a sweep of its own, glass
  chime; on the beat, note 2.
- **Informed by:** ref 11's long flat horizontal arcs with dust under them; ref 05 row 7 (hair
  and cloth in a turn). Flins' N2 lands at 11 f [M, RESEARCH 2.1].
- **Timing source:** UAL2 "Sword Regular B"; 山辺康夫's two-handed katana set for the grip
  shift (timing only until its readme is read) [S, MOTION-SOURCES].

#### N3 "Sanctus": three twirls, "Holy, holy, holy"

**Idea:** three baton twirls in front of her, each wider than the last. The third flashes a
tiny rose that previews the ultimate.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–6 | A1 ×3, A2 ×3 | grip slides to the middle of the haft; glaive upright before her chest |
| Twirl 1 | f7 smear, f8–9 contact | D1 ×1, C1 ×2 | a full vertical disc of smear, 1.4 H across |
| Twirl 2 | f10–11 grip slide, f12 smear, f13–14 contact | T1 ×2, D2 ×1, C2 ×2 | disc 1.7 H |
| Coil (the pause before the third "Holy") | f15–20 | K1 ×6 | grip slides to the butt; glaive held diagonally back and high; she rises onto her toes |
| Twirl 3 | f21 smear, f22–25 contact | D3 ×1, C3 ×4 | disc 2.0 H, hitstop 4 |
| Follow-through | f26–31 | F1 ×3, F2 ×3 | glaive raised high |
| Recovery | f32–55 | R1 ×8, R2 ×8, R3 ×8 | |

- 15 drawings. Hits at f8, f13, f22.
- **Windows:** chains to N4 from f32 (cadence f32–39); dash from f10. No i-frames.
- **Root motion:** +4 px per twirl.
- **Hitbox:** three circles centred 0.55 H in front of her chest, 1.4, 1.7 and 2.0 H across
  (134, 163, 192 px). The last one touches the floor and clears her head.

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Discs | each disc full 1 f, leaded 4 f, shards 6 f | full rings with a thick leading edge. The ring is 8-fold symmetric, so it's authored once per size from one 45° wedge. | A5 edge, A3/A2, A1 |
| Mini-rose | f22–30 | 8 tiny panes flash out along the 8 axes to 1.2 H radius, then fall as shards (2.4 H across) | A2/A3, A0 leading, G2 hub |
| Core flash | f8, f13, f22 | 8-point stars, 7 / 9 / 11 px | A5, A4 |
| Slivers | f21–25 | 1 px gold circle just outside the third disc | G1 |
| Particles | f22–40 | 8–10 shards, gold motes | A2/A3, G0 |
| Pane | f22 | one pane (the mini-rose isn't a pane) | as N1 |
| Rim light | f7–26 | front-lit by the discs | A4 / `#e6f4ff` |

- **Camera:** 1 px shake (trauma 0.2) on the third twirl only.
- **SFX:** three handbell strikes rising a step each; the third rings with a glass shimmer; on
  the beat, note 3 sung three times.
- **Informed by:** ref 05 row 7 (a spin where the hair is the spectacle); ref 12 W (a ring
  around the body). Multi-hit steps like Skirk's N3 (8 f and 22 f) and Mavuika's N3 (28, 33,
  39 f) [M, RESEARCH 2.1].
- **Timing source:** ジュウ's weapon-twirl VMD (BowlRoll 62294). Its page allows modification
  and reuse; watch the preview first because of the "motion trace" tag [S, MOTION-SOURCES].

#### N4 "Credo": chop, plant, vault

**Idea:** she drives the glaive into the floor and vaults over it upside down while glass
bursts up out of the cut.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–8 | A1 ×3, A2 ×5 | glaive swung overhead; she arches up onto her toes. A2 is one straight vertical line from boots to blade, the "elevation" pose, with sleeves hanging. |
| Strike | f9 | S1 ×1 | vertical crescent from over her head to the floor ahead |
| Contact + hitstop | f10–13 | C1 ×4 | blade bites the floor 1.0 H ahead |
| Vault | f14–33 | V1 ×3, V2 ×4, V3 ×4, V4 ×4, V5 ×5 | V1 weight onto the haft; V2 upside down above it (ref 07's pose), with hair, sleeves and tabards hanging skyward; V3 legs over, heel leading; V4 coming down beyond the glaive; V5 crouched landing, glaive still planted behind her |
| Shard pillar (hit 2) | f18 | effect only | 3 lancet shards burst up out of the cut, 0.9 H tall |
| Recovery (if not chained) | f34–63 | R1 ×8, R2 ×8, R3 ×7, R4 ×7 | pulls the glaive out behind her, twirls it back to the stance |

- 13 drawings.
- **Windows:** chains to N5 from f34 (cadence f34–41). Dash or jump from f14; cancelling
  during the vault snaps the glaive back to her hand in one smear frame. No i-frames.
- **Root motion:** +120 px (1.25 H) forward over f14–33, peaking 40 px (0.42 H) off the floor
  at V2.
- **Hitboxes:**
  - chop: from 0.3 to 1.3 H in front, floor up to 1.7 H
  - pillar: 0.35 H wide by 0.9 H tall at the cut

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Main arc | full f9, leaded f10–15, shards f16–26 | vertical crescent 1.7 H tall | A5, A3/A2, A1 |
| Core flash | f10–11 | 11 px star at the bite | A5, A4 |
| Ground crack | f10–70 | crack 1.2 H wide, drawn as glass leading in the floor: A0 lines with 1 px A3 glow, fading over 60 f | A0, A3 |
| Shard pillar | f18–34 | 3 lancet shards rising, then decaying | A1–A3, A0 leading, A5 tips |
| Debris | f10–30 | floor chips thrown both ways | W4, I4 |
| Glyph | f10–70 | the crack is the lingering glyph | as crack |
| Rim light | f18–30 | lit from below by the pillar while she's upside down | A4 on hair and boots |

- **Camera:** 2 px shake (trauma 0.35, 10 f) on the bite. The camera follows the vault with a
  4 f lag, so the jump reads.
- **SFX:** chop whoosh, then stone crack plus a low bell; glass bursting upward; cloth
  snapping as she goes over; on the beat, note 4.
- **Informed by:** ref 07 (the upside-down vault over the weapon, ground scratches) and ref 08
  (ground burst).
- **Timing source:** UAL2 "Attack Ground Pound" for the chop. CMU subject 88 (cartwheels,
  flips, spin kicks) for the vault's arc; licence allows retargeting [S, MOTION-SOURCES].

#### N5 "Agnus Dei": finisher, the glass ring

**Idea:** she tears the glaive free into a full-circle sweep and kneels. The sweep hardens into
a ring of stained glass around her, which expands to both sides and shatters.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–24 | A1 ×4, A2 ×4, **A3 ×8 (held coil)**, A4 ×4, A5 ×4 | A1 yanks the glaive out from behind; A2 the glaive rises behind her in a back-arc (visual only). **A3:** deep crouch, back three-quarters to camera, glaive flat behind her at hip height, and every sleeve, ribbon and the hair wound round her the same way. A4 and A5 start to unwind. |
| Strike | f25–29 | S1 ×2, S2 ×2, S3 ×1 | the spin: back half of the ellipse, then the full ellipse, then the brightest leading edge |
| Contact + hitstop | f30–37 | C1 ×8 | front, arms extended, all cloth flung out on the trailing side |
| Ring forms | f38–47 | F1 ×5, F2 ×5 | she sinks into a kneel; the ellipse doesn't decay, it "leads" into a hovering glass ring at hip height |
| Ring expands, shatters (hit 2) | f48–54 | effect only | the ring widens from ±1.6 H to ±2.4 H in 6 f and shatters along its whole length at f54 |
| Recovery | f48–94 | K1 ×20 (the "Amen" kneel, glaive upright), R1 ×9, R2 ×9, R3 ×9 | a symmetrical end pose, then rising |

- 15 drawings.
- **Windows:** dash, jump, Q or R from f50 (20 f after contact, as research suggests); a new
  string from f72. No i-frames.
- **Root motion:** −6 px in the coil, +10 px in the spin.
- **Hitboxes:**
  - sweep: flat ellipse ±1.6 H (3.2 H wide) by 0.55 H tall, knee to chest
  - ring: flat band ±2.4 H (4.8 H) by 0.35 H at hip height, with the inner ±0.8 H left out
- **Panes widen the ring:** each pane unit absorbed (up to 4) adds 0.3 H per side, up to
  ±3.6 H (7.2 H, 691 px), past both edges of a 640 px view. When the ring forms, the panes
  dive into it and show as brighter, gilded segments.

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Back-arc | f5–8 | non-hitting halo smear behind her, 1.2 H | A3/A2, no core |
| Spin lines (screen layer) | f17–24 | 2–3 thin curved 1 px arcs around her as she unwinds | W2 |
| Main arc | f25–37 | flat ellipse 3.3 H × 0.6 H | A5, A3/A2, A1 |
| Core flash | f30–31 | 13 px star at each contact | A5, A4 |
| Glass ring | f38–54 | the ellipse becomes 16–24 leaded cells, then widens | A1–A3 cells, A0 leading, gilded segments G2 |
| Shatter | f54–80 | every cell breaks into 2–3 shards thrown outward and up | A2/A3, A5 glints |
| Ground | f30–60 | stepped dust band ±2.6 H; a 1 px A3 light line along the floor under the ring | W3, W4, A3 |
| Glyph | f54–110 | gold tracery lines on the floor under the ring, fading | G2 → G3 |
| Rim light | f25–60 | lit along the waist on the side facing the ring's brightest segment; lit from below while kneeling | A4 / `#e6f4ff` |

- **Camera:**
  - background dims to 80% during the coil (f9–16) and comes back on contact
  - 2 px push back during the coil, 3 px forward on contact
  - shake at trauma 0.6 (3 px, 16 f) on the ring shatter
- **SFX:**
  - coil: a held breath, fabric creak
  - spin: a wide whoosh with glass shimmer
  - contact: a big bell
  - ring shatter: a glass crash under a choir chord that resolves the rising phrase
- **Informed by:** ref 11 (a 4.2 H horizontal slash with dust spreading wider than the arc);
  ref 12 E (each stage adds a layer); Laevatain's 360° fire ring, which spreads past both
  screen edges in about 0.3 s [M, RESEARCH 1]. Research's finisher numbers: 28–32 f wind-up
  with a 6–8 f held coil, 7–9 f hitstop [I, RESEARCH 3.3].
- **Timing source:** Mixamo "Standing Melee Attack 360 High" (a clip name seen in third-party
  credits, not yet verified inside Mixamo); UAL2 "Sword Regular C" and the full combo clip for
  the string's end [S, MOTION-SOURCES].

### 2.2 M2: "Procession" (dash)

**Idea:** a gliding pirouette that leaves stained-glass copies of her silhouette behind.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Startup | f1–3 | D1 ×3 | leans in; sleeves, stole and hair snap back; dust puff |
| Travel | f4–17 | D2 ×3, D3 ×4, D4 ×4, D5 ×3 | a pirouette: D2 turning away, D3 back to camera with the cloth wrapped round her, D4 coming round as the cloth opens, D5 facing front and leaning back to brake |
| Brake | f18–23 | D6 ×3, D7 ×3 | skids; sleeves and tabards overshoot forward, then settle |

- 7 drawings, 23 f in total.
- **i-frames:** f3–18. **Perfect-dash window:** f3–10.
- **Root motion:** 176 px (1.83 H): 110 px over f4–9, 58 px over f10–17, an 8 px skid over
  f18–23. The fast start and eased end are the "snap".
- **Cancels:**
  - dash attack (M1) from f10 until 8 f after the dash ends
  - Q or R from f10
  - jump from f6
  - a second dash from f20
  - after two dashes in a row, 36 f (0.6 s) before the next. Genshin also locks dashes
    after consecutive use, over a 0.8 s window [S, RESEARCH 2.3].
- **In the air:** same timing, no dust, no gravity over f3–17.
- **Hitbox:** none. The dash is movement.

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Glass afterimages | spawn f4, f8, f12; each lives 24 f | her own silhouette from that drawing filled as stained glass: flat A2 body, A3 on panels facing the light, A4 along the leading edge, A0 leading along her real interior lines. Decay: 8 f full, 8 f leaded lines only, 8 f falling shards. They span about 2.3 H. | A0–A4 |
| Floor streak | f4–30 | 1 px light line along the floor under her path, fading | A3 → A1 |
| Dust | f1–10 and f18–26 | puffs at start and skid, 10–14 px | W3, W4 |
| Rim light | f4–18 | trailing edge lit by the afterimages | A4 |

- **Camera:** a 3–6 px push in the dash direction, easing back over 12 f. deepnight's demo
  nudges the camera 6 px on a dash [S, RESEARCH 2.3].
- **SFX:** a whirl of silk, a soft glass shimmer, a breath from the choir.
- **Informed by:** ref 05 row 3 (a dash into an attack); ref 06 (the trail behind a lunge);
  ref 11 row 4 (a horizontal dash-slash with dust). The research timing sheet suggests about
  20 f with i-frames from f3 to about f20 [I, RESEARCH 3.3].
- **Timing source:** UAL2 "Sword Dash RM"; Bandai Namco `dash_feminine_001` for a flowing
  body (non-commercial question applies); Dolphin_664's glide dash, timing only
  [S, MOTION-SOURCES].

#### Perfect dash: "Sanctuary"

**Idea:** dodge at the last moment and the copy she leaves becomes a glass saint that takes
the hit for her.

| Beat | Frames (real time) | What happens |
|---|---|---|
| Trigger | an enemy hitbox overlaps her hurtbox during dash f3–10 | |
| Saint Pane | trigger +0 to +8 | the afterimage nearest the hit turns into a full-colour glass statue of her dash pose and takes the blow |
| Shatter | +8 | statue breaks into 12–16 shards; 13 px star; bell strike |
| Slow motion | +0 to +30 (0.5 s) | the world drops to 0.3x speed, snapping in over 3 f and easing out over 12 f; she keeps full speed |
| Rim | +0 to +6 | gold rim (G0/G1) |

The slow motion copies the research profile (0.3x for about 0.5 s, fast in, eased out
[I, RESEARCH 3.3, from deepnight's demo]). The world also desaturates 30% while it lasts.

#### Attack out of the dash: "Aspersion"

**Idea:** attack out of the dash and she skates through a low spin, then flicks a spray of
glass droplets forward like holy water from an aspergillum.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–4 | A1 ×2, A2 ×2 | drops low into a skate; glaive swings flat behind |
| Strike | f5–8 | S1 ×1, S2 ×1, S3 ×2 | a flat 360° skating spin at knee height |
| Contact + hitstop | f9–11 | C1 ×3 | |
| Flick | f12–17 | F1 ×3, F2 ×3 | upward flick; the spray leaves the blade at f14 |
| Spray lands | f20–30 | effect only | 7 droplets land in a fan 1.2–3.0 H ahead, 1–2 f apart; each is a small hit |
| Recovery | f18–39 | R1 ×7, R2 ×7, R3 ×8 | |

- **Windows:** counts as N2, so M1 continues with N3 from f20. Dash from f18.
- **Root motion:** carries the dash's momentum, +77 px (0.8 H) slowing over f1–12.
- **Hitboxes:**
  - spin: flat ellipse ±1.3 H (2.6 H) by 0.4 H, shin to waist
  - spray: 7 hitboxes of 12×12 px
- **VFX:**
  - the spin is a flat ellipse 2.7 H wide with the glass decay
  - droplets are 3×3 px beads (A4 core, A2 rim) on parabolic arcs
  - each landing makes a small 7 px 8-point star and a white-azure floor splash (ref 12's white
    ground splashes)
- **SFX:** a skate hiss, a whoosh, then a run of seven quick glass ticks on landing.
- **Informed by:** ref 12 (Q's streaks and the white splashes); Alice's dodge counter, where
  the personality goes into the counter rather than the dash [S, RESEARCH 2.3].
- **Timing source:** UAL2 "Sword Dash RM" into "Sword Regular C".

#### Counter from Sanctuary: "Pax"

**Idea:** attack during Sanctuary's slow motion and she blinks back through the broken saint,
firing its shards at the attacker.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Blink | f1–4 | P1 ×4 | one smeared body drawing, up to 1.8 H long, back through the falling statue toward the enemy |
| Strike | f5 | S1 ×1 | vertical crescent 2.2 H tall |
| Contact + hitstop | f6–11 | C1 ×6 | the statue's shards fire forward in a 30° fan (f8) |
| Follow-through | f12–17 | F1 ×3, F2 ×3 | |
| Recovery | f18–40 | R1 ×7, R2 ×8, R3 ×8 | |

- **Windows:** M1 continues with N3 from f20; dash from f12.
- **i-frames:** f1–11.
- **Hitboxes:**
  - crescent: 1.2 H wide by 2.2 H tall
  - shard fan: 30°, reaching 3.0 H
- **SFX:** a reversed chime for the blink, a bright bell, glass pellets.
- **Timing source:** UAL2 "Sword Attack" (a single big swing).

### 2.3 Q: "Nave"

**Idea:** she twirls the glaive overhead and strikes the floor with its butt. A row of tall
lancet windows rises out of the ground on both sides, holds for a breath, and shatters
outward.

**Tap version:**

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Raise | f1–6 | Q1 ×3, Q2 ×3 | glaive lifted flat overhead in both hands; the sleeves slide to her elbows; the rose disc lights |
| Overhead twirl | f7–20 | T1–T4 ×2 each, looped (14 f) | the glaive spins flat above her head (an edge-on ellipse of smear); gold motes spiral in toward it |
| Stamp | f21–23 | Q3 ×2, Q4 ×1 (smear) | glaive snaps upright; butt driven down |
| Contact + hitstop | f24–29 | Q5 ×6 | butt strikes the floor at f24; local flash; crack; 6 f freeze |
| Lancet wave | f30–42 | Q6 ×4 (rising from the stamp), then Q7 | pairs of lancets rise at f30, 33, 36, 39, 42 at ±0.5, ±0.95, ±1.4, ±1.85, ±2.3 H, getting taller outward (0.7 → 1.3 H) |
| Benediction hold | f34–59 | Q7 ×26 | glaive planted, right hand raised with two fingers in blessing, head tilted, sleeves settling; the lancets glow; this is Q's beauty frame |
| Vault arches | f54–59 | effect only | 1 px gold lines arc from lancet tip to lancet tip in pointed Gothic arches; for a moment the nave has a ceiling |
| Shatter (hit 2) | f60 | Q8 ×4 | she closes the raised hand; every lancet shatters outward at once; 8 f freeze on the enemies |
| Recovery | f64–81 | Q9 ×8, Q10 ×10 | |

- About 14 unique drawings.
- **Control returns at f52, before the shatter.** If the player moves, she leaves the pose and
  the lancets still shatter on schedule. This is the delayed payoff Flins and Skirk use
  [M, RESEARCH 1].
- **i-frames:** f21–30 (the stamp).
- **Cooldown:** 8 s [I].
- **Hold version** (player control inside the spectacle, like Hiyuki and Roxy [S, RESEARCH 1]):
  - holding Q past f20 keeps the overhead twirl looping
  - every 18 f held adds one more lancet pair, 0.45 H further out and 0.15 H taller, up to 3
    extra pairs (54 f)
  - release to stamp
  - while holding: rooted, no i-frames
- **Pane units:** at the stamp, loose panes fly down into the row and each unit adds a gilded
  lancet pair at the outer end. Hold and panes together can add at most 4 pairs.
- **Root motion:** none (a planted ritual).
- **Hitboxes:**
  - stamp shock: floor band ±0.8 H by 0.25 H
  - each rising lancet: 0.25 H wide by its height, at its position (a small launch, 8 px)
  - shatter: from ±0.3 H to ±2.8 H, floor up to 1.8 H, so **5.6 H across (538 px, 84% of the
    view)**
  - with 4 extra pairs the shatter reaches ±4.1 H (8.2 H), and the outer lancets rise
    off-screen: the edges of the screen become part of the nave

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Converging motes | f7–20 | 12–16 gold pixels spiralling in to the glaive | G0, G1 |
| Overhead smear | f7–20 | flat ellipse 1.8 H above her head, looping | A4 edge, A3/A2, G1 slivers |
| Core flash | f24–25 | 13 px star at the butt, plus a local A5 disc 1 H across (not full screen) | A5, A4 |
| Floor crack | f24–90 | 1.6 H crack drawn as leading | A0, A3 glow |
| Dust | f24–50 | stepped dust band spreading to ±3 H | W3, W4 |
| Lancets | rise 3 drawings each (1 f crack flash, 2 f half height, then full) | pointed-arch panes 24 px wide, 67–125 px tall; 3–5 cells each (cobalt, azure, sky, gold), A0 leading, 1 px A4 glow; a 4 px A3 light band along the floor joins their bases | A0–A4, G2 |
| Vault arches | f54–59 | 1 px pointed arches joining the lancet tips | G1 |
| Shatter | f60–90 | 6–10 shards per lancet, thrown outward and up to ±3.0 H; a 1 f star at each lancet's centre | A1–A5 |
| Glyph | f60–120 | each lancet's base leaves a short gold tracery mark on the floor, fading | G2 → G3 |
| Rim light | f30–60 | lit from both flanks by the lancets: rim on both sides, never top or bottom | A4 / `#e6f4ff` |

- **Camera:**
  - 2 px push down on the stamp (a bow)
  - shake at trauma 0.4 (2 px, 12 f) on the stamp and 0.6 (3 px, 18 f) on the shatter
  - background dims to 70% over f34–59 so the glass glows, then returns over 20 f
- **SFX:**
  - raise: a rising choir vowel over the twirl's whoosh
  - stamp: a deep bourdon bell with a stone crack
  - lancets: ascending glass chimes, one per pair
  - arches: a soft organ chord
  - shatter: a big glass crash, the choir cut off into its reverb tail
- **Informed by:** ref 12 E (a crescent plus a field of ground spikes, escalating stage by
  stage); ref 08 (flash and ground burst); ref 11 (dust wider than the effect). Flins'
  follow-up hits after the player regains control; Hiyuki's hold; Roxy gathering tornadoes
  [S, RESEARCH 1].
- **Timing source:**
  - ジュウ's weapon-twirl-into-attack VMD (BowlRoll 62565) for the twirl into the stamp
  - UAL2 "Attack Ground Pound" for the stamp
  - MotionPackage Pro 剣's spear stance, if Dex buys it [S, MOTION-SOURCES]

### 2.4 R: "Te Deum" (ultimate)

**Idea:** time stops and the level goes dark like a cathedral. A rose window draws itself
behind her head, then every pane sweeps outward across the whole screen.

**The shape of it** follows the four ultimates measured in RESEARCH 2.4:

- a cut-in onto a dark stage with the character rim-lit
- about 1.5 s of wind-up
- a short white flash on the first hit
- held impact frames
- a final freeze
- a return with effects still running

Totals: 1.48 s to the first flash (measured range 0.9–2.5 s), 3.5 s to control (measured
totals 3.4–6.5 s), effects linger to 4.6 s [M, RESEARCH 2.4].

**Where the rose sits:**

- The **oculus (centre) sits behind her head**, the saint-with-halo image.
- The rose is 344 px across (3.6 H), the view height less an 8 px margin at top and bottom.
- Whatever falls below the floor line is hidden behind the floor, like a sun half risen.
- 16 outer lancets extend the design to 460 px across (4.8 H) before the waves throw them
  further.
- It's a flat disc facing the camera, so the side view needs no perspective trick.

This table is the whole ultimate, beat by beat.

| Frames (time) | Her drawings | What happens |
|---|---|---|
| f1–6 (0–0.1 s) | – | time stops; the world dims to 25% brightness with an indigo tint, enemies to 40% so targets stay visible; CANON's black cinematic bars close in 16 px |
| f1–24 (0–0.4 s) | cut-in illustration | a 640×96 band across the middle of the view: her bust, eyes opening as the irises ignite A4, gold rim, glass cells behind her. Slides in over 6 f in whole-pixel steps, holds 12, slides out over 6. |
| f25–32 | L1 ×4, L2 ×4 | she rises 24 px, lifting the glaive upright in front of her: the processional-cross pose |
| f33–44 | L3a / L3b alternating every 8 f (a floating loop for hair and cloth), through f84 | the tracery draws itself: a bright gold point traces the outer circle (12 f), then 8 spokes shoot out at 45° steps (f41–44) |
| f45–56 | (floating) | 8 petal circles drawn |
| f57–72 | (floating) | glass pours in: cells fill clockwise, about 6 per frame |
| **f73–84** | (floating) | **beauty hold.** The full rose glows behind her and she's backlit: rim along her top and outer edges, her front in lavender shade. This is the donation screenshot. |
| f85–88 | C1 ×2, C2 ×2 | the consecration: one vertical twirl of the glaive in front of the oculus (a 1.6 H disc of smear) |
| **f89–90** | – | **flash 1:** full-screen A5 for 2 f. **Hit 1:** whole view, light damage and stagger. |
| f91–114 (0.4 s) | I1, I2, I3 ×8 each | impact frames: the world goes A0 navy, and the rose and her silhouette go A5 with A0 leading. Each drawing lights more of the rose, inside out. The dark background holds steady, so nothing strobes. |
| f115 | P1 ×16 | colour returns. **Wave 1:** the 8 inner petals break off and sweep outward as a clockwise pinwheel of crescents; she sweeps the glaive clockwise |
| f131 | P2 ×16 | **Wave 2:** the 16 outer lancets fire along the 8 axes to the view edges; the horizontal pair crosses the full width, the vertical pair the full height, the diagonals make an X. She thrusts the glaive skyward. |
| f147 | L4 ×6, L5 ×6 | **Wave 3:** the gold tracery snaps and breaks outward; she descends and lands |
| f159–166 | K1 (held from f159) | the oculus pulls inward for 4 f (f163–166), the only "suck-in" beat |
| **f167–168** | K1 | **flash 2:** warm gold-white `#fffbe8`, 2 f, 78 f after flash 1. **Wave 4:** final hit, whole view. |
| f169–174 | K1 | 8-point star rays to every edge; a light wave runs along the floor to both edges |
| f175–192 (0.3 s) | K1 | **total freeze:** everything stops, shards mid-air, in silence. She kneels with the glaive upright beside her; the empty gold tracery glows faintly behind. |
| f193–210 | K1 | time resumes; colour ramps back over 18 f; the bars open; the frozen shards fall as glass rain |
| **f210 (3.5 s)** | – | **control returns** |
| f210–276 | – | the rain keeps falling; shards landing on enemies deal small delayed hits until f250; the last shards fade by f276 (4.6 s) |

- 11 sprite drawings plus the cut-in (L1, L2, L3a, L3b, C1, C2, P1, P2, L4, L5, K1). Few
  drawings, long holds, and effects carrying the motion: Guilty Gear's limited-animation
  approach [S, RESEARCH 2.10].
- **i-frames:** f1–210.
- **Flash count:** 2 full-screen flashes 1.3 s apart, so never more than one in any second
  (WCAG allows 3 [S, RESEARCH 2.8]).
- **Hitboxes:**
  - hit 1: the whole view
  - wave 1: a ring around the rose centre from 0.4 to 1.9 H (3.8 H across)
  - wave 2: 8 beams, 20 px thick, from the centre to the view edges; the horizontal beam is
    640 px wide, the vertical is 360 px tall
  - wave 3: a 3.6 H circle around the rose centre, which covers the view
  - wave 4: the whole view, plus a floor wave the full width at 0.3 H tall
  - glass rain: 36 falling 6×6 px hitboxes across the full width

| VFX layer | Frames | Shape and size | Colours |
|---|---|---|---|
| Stage dim | f1–192 | world palette-mapped to 25% with an indigo tint | I4, I3, A0 |
| Tracery | f33–56 | 1 px gold lines: circle, 8 spokes, 8 petal circles. Drawn as one 45° wedge; the other 7 are exact flips and 90° turns of it. | G1, G2 |
| Glass | f57–114 | about 96 cells. Outer ring cobalt and azure, petal hearts amethyst (the only amethyst in the kit), oculus gold with an A5 core; all A0 leading. | A1–A4, V1–V3, G2, A5 |
| Core flashes | f89–90, f167–168 | full screen | A5; `#fffbe8` |
| Impact frames | f91–114 | two-tone palette swap, held on eights | A0, A5 |
| Wave 1 crescents | f115–130 | 8 crescents sweeping 45° each, 0.9 → 1.9 H radius. Only 2 crescent drawings are needed (one starting on an axis, one on a diagonal), each turned 4 times losslessly. | A5 edge, A3/A2, V2 heart |
| Wave 2 beams | f131–146 | 16 straight streaks along the 8 axes, 20 px thick, off-screen | A5 core, A4, A2 body |
| Wave 3 break | f147–166 | tracery snaps into gold slivers flying outward | G0–G3 |
| Wave 4 star | f167–174 | 8-point ray star to every edge, plus the floor wave | `#fffbe8`, G1, A4 |
| Glass rain | f193–276 | 40–60 shards of 2–4 px, glinting | A1–A5, V2 |
| Ground | f169–260 | full-width stepped dust and a floor light band | W3, W4, A3 |
| Lingering glyph | f175–260 | the empty gold tracery behind her, fading | G2 → G3 |
| Rim light | f25–192 | backlit by the rose (top and outer edges only); gold at flash 2 | A4 → G0 |

- **Camera:**
  - no zoom
  - the bars close 16 px
  - a whole-pixel pan (at most 8 px per frame, eased) centres her if she's within about
    1.2 H of an edge, so the rose isn't cut off
  - shake at trauma 0.5 (2 px, 12 f) on wave 2 and 1.0 (4 px, 30 f) on wave 4
  - the cut-in panel replaces the close-up the 3D games use (RESEARCH 3.2's option a)
- **SFX:**
  - time stop: a reversed cymbal swell cut to silence, then one low organ note swelling
  - tracery: a quill scratch and a chime glissando
  - glass pour: a rising crystalline shimmer
  - consecration and flash 1: a choir chord struck with the bourdon bell
  - waves 1–3: glass cascades, one per beat
  - wave 4: full organ, choir and bell
  - freeze: 0.3 s of real silence (CANON asks for intentional silence)
  - resume: shard tinkles as the music eases back
- **Informed by:**
  - ref 12 R (ring, light pillars, ground eruption); ref 11 (the widest arcs); ref 08 (the
    layer stack)
  - Laevatain: a burning halo ring behind her, an 0.8 s near-still hero hold, a changed
    moveset for 15 s [M, RESEARCH 2.4]
  - Alice: centred symmetry and a final total freeze of 0.23–0.43 s [M]
  - Fleurdelys: a heraldic geometric composition, a colourless world before colour returns [M]
  - Skirk: a radial fan of blades around a dark core [M]
- **Timing source:** the beats above come from RESEARCH 2.4's measurements. For her body,
  UAL2 "Spell Simple Enter / Idle / Shoot / Exit" (levitation and cast) and ジュウ's twirl for
  the consecration. MotionPackage Pro 必殺技's charge-and-release if bought
  [S, MOTION-SOURCES].

### 2.5 After R: "Illumination" (12 s)

The ultimate keeps paying off after the cutscene, the way Fleurdelys (12 s) and Laevatain
(15 s) change their basic attacks [S, RESEARCH 1].

- **A second body:** a 25 px rose window floats behind her shoulder. Its 8 panes are the
  timer, and one goes dark every 90 f (1.5 s), so the timer is in the world, not in a UI bar.
- **Every M1 hit** makes the rose fire a mirrored lancet streak along the hit's direction:
  one extra arc and +0.8 H reach.
- **N5 becomes "Agnus Dei: Rose":** the ring always expands past both view edges (at least
  7 H) regardless of panes, and 8 lancets rise along it.
- **Every pane made during Illumination is gilded.**

---

## 3. Why this reads as a latest-gen Kuro / HoYo / Gryphline character

RESEARCH section 1 lists what makes the newest characters feel creative. Liturgy answers
each point in its own terms. A generic pixel swordfighter answers none of them: it has the
same white arc on every hit, effects about as wide as the weapon, one hit spark, and nothing
connecting the moves.

| What reads as creative [RESEARCH 1] | Studio example | Liturgy's version |
|---|---|---|
| A second body does the huge hit | Laevatain's fire sword, Phrolova's Hecate, Cartethyia's sword shadows | the rose window (R), the hanging panes (M1), the glass saint that takes a hit (Sanctuary), the floating rose after R |
| The ultimate changes the moveset | Fleurdelys 12 s, Laevatain 15 s | Illumination for 12 s, timed by the rose's own panes going dark |
| The stage gets taken over | Wuthering Waves stops time; Skirk's void; Phainon's Territory | time stops, the level turns into a dark nave, a window hangs across the whole view |
| Graphic abstraction at impact | black-and-white frames (Fleurdelys, Skirk, Alice) | two-tone rose impact frames in R, **and** every ordinary smear decays into leaded glass: abstraction on every hit, not only in the cutscene |
| Composition as character | Alice's symmetry | 8-fold symmetry is her signature: big moves resolve on 0/45/90° axes and finishers end in symmetrical poses (the "Amen" kneel, the benediction, the saint before the window) |
| Delayed payoff | Flins' follow-up hits, Skirk's late hits, Fleurdelys' colour arriving after the cut | Q shatters after control returns; the finisher ring shatters after she kneels; R rains glass for a second |
| Player control inside the spectacle | Hiyuki's paused charge, Alice's charge levels, Roxy's gathered tornadoes | holding Q builds the nave; hitting on the beat gilds panes; a perfect dash raises the glass saint |
| Colour-coded telegraphs | ZZZ's gold and red flashes | the rose disc glints on the beat; enemies flash her azure when hit; red is left entirely to the enemies |

Four more things set her apart [I]:

1. **The kit is a piece of music.** Hitting on the beat sings a rising phrase across the
   string, and the finisher resolves it on a chord. That's close to Phrolova's musical notes,
   and to Katana Zero's idea of the soundtrack playing in the hero's head [S, RESEARCH 2.7].
   The phrase could quote the site's chosen theme (CANON: Suno "B"), so combat echoes the
   score; Dex's ears decide.
2. **The costume is a motion system.** Eight trailing pieces with a fixed lag order (1.6) do
   what hair and cloth animation do for HoYo's characters, hand-keyed so they stay 2D.
3. **Calm at rest, grand in motion.** A serene half-lidded face and a processional stance
   match CANON's quiet arrival. The width shows up only when she fights.
4. **One image sells her:** the R beauty hold, a saint silhouetted in front of a glowing rose
   window. It's the frame to finish first and the one a 3D gacha player would screenshot.

---

## 4. How it maps onto the 3D-to-pixel route

- **Built in Blender:** body, costume (sleeves, tabards, veil, stole), glaive with its disc.
  Cloth is hand-keyed per drawing with no simulation. Shape keys push the flare on contact and
  smear drawings. Render orthographic, no anti-aliasing, constant toon ramps, plus a per-frame
  normal pass and a material-ID pass [S, RESEARCH 4.1, 4.2, 4.7].
- **Drawn in 2D (by hand or in code, never generated):**
  - the smear families: crescent, flat ellipse, disc, vertical crescent, each at a few sizes
  - panes, lancets, the rose, stars
  - the face and the cut-in
- **The rose costs an eighth of a rose.** Draw one 45° wedge; the pixel grid's 8 exact
  symmetries (90° turns, and flips including the diagonal one) rebuild the rest with no
  resampling. A script check confirmed the rebuild is exact. The 8-point stars and the N3
  discs work the same way.
- **Glass afterimages are a recolour, not a drawing:**
  - take the dash frame's own silhouette
  - fill it by material from the ID pass
  - draw leading where the ID pass changes material

  This is deterministic, repeatable, and involves no image generation.
- **Hand-touch budget:** contact, coil and hold drawings (N5's A3, Q7, R's L3 and K1) plus
  every face. Per RESEARCH 4.8's middle route, the rest gets automatic cleanup.

## 5. Risks to test first in A/B

Each is a question a blind critic can answer at 3x real size (rubric method).

1. **Leading lines on glass vs. rubric 5** ("no dark line around effects"). Show a pane and a
   decaying smear with A0 navy leading against the same with A1 cobalt leading. If critics
   read the navy as an outline, switch to cobalt.
2. **Does she dissolve into her own blue?** Indigo hair and azure eyes next to azure effects.
   Test N3's third disc overlapping her body, and R's backlit hold. Fallback: shift the hair
   toward violet (hue only).
3. **Eight ribbons at 96 px: grace or noise?** Run the silhouette fill test (rubric 1) on N2
   and N5 contact drawings with and without the stole.
4. **Warm white vs. cool white cores:** does the temperature split hold at real size on
   Samsung Internet and iPad Safari screens (CANON's review devices)?
5. **The vault (N4) sends her 1.25 H forward.** Does that break the "planted ritual" feel or
   carry her into enemies on the test map? Fallback: vault back over the glaive to the same
   side.
6. **Does R's 25% stage dim hide the turret and enemies too much?** 40% on enemies is the
   starting point.

## 6. What this concept asks Dex to decide

1. **Glaive over sword.** CANON's interaction line says "the sword"; the glaive's blade cuts
   cords and ropes the same way.
2. **Indigo hair with azure tips, azure eyes.** The alternative is platinum hair, which melts
   into the white costume and the effect cores.
3. **Costume additions** (from REF-BREAKDOWN's proposal): back tabard instead of the thong,
   white thigh-highs, indigo boots, a short veil, an indigo sleeve lining.
4. **Height.** Everything here is specced at 96 px. At 128 px every pixel size scales by 4/3;
   the numbers in H don't change.
5. **Name.** "Rosace" is a placeholder.
