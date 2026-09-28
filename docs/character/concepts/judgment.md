# Judgment: the executioner-saint

A concept for the player character, built from the angle "Judgment". Companions:
`../REF-BREAKDOWN.md` (what the refs measure), `../QUALITY-RUBRIC.md` (the A/B bar),
`../CRITIQUE-PARAMS.md`, `../RESEARCH.md` (timing and staging numbers), `../MOTION-SOURCES.md`
(where timing can come from).

Tags, the same as the companion docs:

- **[M]** measured, here or in the companion doc named next to it.
- **[S]** sourced from outside.
- **[I]** inference or proposal.

**Everything in this file is a design proposal [I] unless it carries another tag.** Numbers
borrowed from the companion docs keep their original tags.

## The pitch

She's a court executioner who is also a saint. She doesn't fight enemies so much as carry out
their sentences. The whole kit rests on one idea: **a cross is a sword planted in the ground.**

- Planted upright, her glaive is a cross.
- The crosses of light she brings down are swords of light driven into the floor point first.
- Her ultimate drops a cross-shaped greatsword of light big enough to cleave the whole screen.
  She uses it to cut a cross across the screen, one full-height vertical cut and one full-width
  horizontal cut, which crosses out everything on it.

A small bell on the glaive keeps time. Light hits make it clink, and every heavy hit is a full
toll, so the fight sounds like a death knell. She moves slowly and on purpose: long, still
wind-ups, strikes that take a single drawing, and effects that land a beat after the swing.
The cut comes first and the verdict follows.

| Move | Name | In one line |
|---|---|---|
| M1 | The Sentence | Four-part glaive string (rising drag-cut, flat sweep, a spinning wheel, then a headsman's chop that raises a cross of light 3.35H wide) |
| M2 | Absolution Step | Invincible low dash with a floor trail and azure afterimages. Timed through an attack, it slows the world and marks the attacker. |
| M2 into M1 | Summary Judgment | She cuts through the whole enemy line without stopping and walks away. The cut detonates a beat later. |
| Q | Knell | Her gavel strike calls down a row of light-swords, one per bell toll. They stand as wards, then detonate into a floor line 5H wide with pillars up to the top of the screen. |
| R | Crux: The Last Sentence | Time stops and a colossal cross-blade of light cuts a cross over the entire screen. Colour floods back along the cuts, and her attacks are upgraded for 12 s. |

## Units used below

- **H** is her height: 96 px from skull to sole at native resolution, the brief's working
  target. Sizes are given in H and in px so they scale if Dex moves to about 128 px.
- **Tick** is 1/60 s, the lab's simulation step (`src/lab/contracts.ts` [M]).
- **Drawing** means one unique sprite image. "D3 4" means drawing 3 is shown for 4 ticks; "held"
  maps to the contract's `hold` field.
- **Hitstop** is the freeze on contact (the contract's `hitstop`). It is added to the listed
  ticks only when the hit connects.
- **Cancel** is the earliest tick at which an input switches to another move. Earlier presses
  are buffered.
- **i-frames** are ticks with no hurtbox.
- **Root motion** is how far the move carries her, in px, facing right.
- **Hitboxes** are measured from her feet: x forward (+) or back (−), height up from the floor.
- **Smear** means one drawing that shows the whole swing as a stretched shape instead of poses
  in between.
- Lab controls: J or left click for M1; K, Shift or right click for M2; Q; R
  (`src/lab/engine/input.ts` [M]).

Authoring rules for every move (RESEARCH.md 4.4):

- Author on twos: most drawings last 2–6 ticks, smears and flash drawings last one, and contact
  and coil drawings are held.
- Add frames before or after a key pose, never between two keys (Dead Cells [S]).
- Hand-key the hair, veil, sleeves, tabards, ribbon and charms 1–2 drawings behind the body,
  with one overshoot drawing and no physics simulation (Guilty Gear Xrd [S]).

---

## 1. Character design at pixel scale

### 1.1 Silhouette

At rest she reads as four shapes inside one outline:

1. **The cross.** The glaive stands planted butt-down beside her, 1.3H tall. Its gold guard
   makes the crossbar at about 0.82H. It's the tallest thing in her silhouette, so from across
   the screen she reads as a saint standing beside her cross.
2. **Two bells.** The detached trumpet sleeves hang from the upper arms and flare into bell
   shapes at hand height, 14–18 px wide at the mouth. The bell motif is built into the costume.
3. **The veil point.** A short white half-veil trails behind the head, so her head reads as a
   nun's in profile. It's her head shape, the way each enemy in 13 has its own crown, hood or
   horns. **No halo:** halos belong to the enemies in 13.
4. **Iron at the ground.** Dark steel greaves up to mid-calf give her a heavy, planted base.

**Value structure.** Dark on top (hair), light in the middle (white and gold costume, skin),
dark again at the bottom (greaves) and in the weapon (blued blade, dark haft). This stops a white
costume reading as one pale blob, and it gives the rim light something to cut against.

**Negative space.** At rest, keep a 4–8 px gap between her and the planted glaive. The sleeves
hang slightly off the hips so they never merge with the tabard. In every strike key pose the
glaive clears the torso (rubric 1).

### 1.2 Proportions at 96 px

| Part | Size | Note |
|---|---|---|
| Height | 96 px, including a 2 px heel | |
| Head (skull top to chin) | 17 px, so 5.65 heads tall | inside the 5.5–6.5 band [M, REF-BREAKDOWN] |
| Eye line | rows 9–10 of the head | |
| Shoulders (three-quarter view) | 15 px | |
| Waist | 9 px | |
| Hips | 15 px | |
| Crotch height | 46 px from the floor (0.48H) | long legs, as in 04 and 08 |
| Knee | 24 px from the floor | |
| Top of the greave | 17 px from the floor | |
| Hand | 3×4 px, bare | skin reads against the lavender sleeve lining and the dark haft |

### 1.3 Outfit, adapted from 14

| Component | Size at 96 px | Shown or covered | Motion job |
|---|---|---|---|
| High stand collar, gold edge, gold cross at the throat (from 14) | 5 px tall; cross 3×3 | covers the neck | none; rigid |
| Front bodice panel, diamond chest window, gold piping (from 14) | window 5 px wide × 9 px tall, edged in 1 px gold | the window shows skin; the panel covers the breasts | none |
| Open sides, armpit to hip (from 14) | 3–4 px strip of skin in side view | shown. The game is side-view, so this is her most visible designed skin. | none |
| Bare shoulders, gold armbands (from 14) | armbands 1–2 px | shown | none |
| Detached trumpet sleeves, gold hem, fleur-cross at the corners (from 14) | 26 px long, mouth 14–18 px; corner cross 3×5 | cover the forearms | **main flag**: the bells swing on every attack |
| Front tabard with V-notch, gold border, big fleur-cross (from 14) | 7 px wide, 34 px long (hip to mid-shin); cross 5×7 | covers the front of the hips | **main flag**: a long line that shows which way she faces |
| Hip band, medallion, O-rings, cross charms (from 14) | band 1–2 px, medallion 3×3, 2 charms each side (1×3) | covers | charms jiggle 1 px |
| Garter straps to gold thigh bands (from 14) | 1 px straps | cross the bare thigh strip | charms |
| Open back: halter pentagon yoke with a cross on the upper back, mid-back strap (from 14) | yoke cross 3×5 | shown when she turns (M1-3, R) | none |
| **Changed:** the thong back becomes a short back tabard | 7 × 18 px, hip to mid-thigh, smaller cross | covers. It's shorter than the front one, so front and back tell apart in spins. | second flag |
| **Added:** white thigh-highs with a gold top band | from 26 px down into the greave | cover the lower legs and leave a 4–6 px thigh strip under the tabard edge | none |
| **Added:** executioner's greaves (blued steel, gold trim, 2 px heel) | 17 px tall | cover | weight in every stomp |
| **Added:** half-veil, white, gold hem, gold cross pin at the crown | 22 px tail to the shoulder blades | covers the back of the head | **flag**: trails on dashes, fans out on spins |

**"Decently revealing but in theme."** What shows is exactly what 14 designs as windows: the
shoulders, the chest window, the sides, the back, and a band of thigh. Each one is a bounded
patch of skin framed by gold lines, and at 96 px that reads as costume. What's covered: the
breasts; the hips and seat, where the back tabard replaces the thong as REF-BREAKDOWN proposes;
and the legs below mid-thigh.

The poses do the rest without getting cheap:

- the idle rests her weight on one hip
- side view shows the open side on every walk
- two moves turn her back to the camera: M1-3's first contact and R's turn

Nothing jiggles except cloth and charms.

**Iconography rule.** Every cross is 14's fleur-cross; there's never a crucifix figure and never
an inverted cross. The glaive is only ever planted butt-down, blade up, which makes an upright
cross. When its blade bites into the floor (M1-4), the haft leans back toward her, so it never
stands as an upside-down cross.

### 1.4 Hair

- **Colour:** midnight indigo, with one azure sheen band across the crown (03's crown bands).
  The sheen ties her hair to her effect colour.
- **Cut:** heavy and straight, down to mid-thigh; the hair curtain is about 50 px long.
  - A hime cut: a blunt fringe on the brow line, and sidelocks cut straight at chest height.
  - The back hair is five big clumps that S-curve when she moves, following 01's clump logic,
    with tips tapering to 1 px.
- **Why dark:** her costume is all light values, so the hair supplies the dark mass at the top
  (see 1.1).
  - It stays separate from the enemies because it's blue-violet with a cool sheen, not neutral
    black; 13 uses a neutral grey ramp [M, REF-BREAKDOWN].
  - In 05 the hair carries most of the motion (about 40–50% of the idle sprite's pixels [M]).
    Hers shares that job with the sleeves and veil.

### 1.5 Face

- **Eyes are gold:**
  - a lash row 3 px wide with a 1 px outward flick
  - 1 px of gold iris under it
  - a 1 px highlight where the angle leaves room
- **Other features:**
  - brows 2 px, level and calm
  - mouth 1–2 px
  - one blush pixel per cheek
  - no nose, except a 1 px shadow in three-quarter view
- This follows 05's size and 01's construction logic (rubric 3).
- **Expressions:**
  - **Judge** is the default: half-lidded and calm.
  - **Verdict:** eyes open, and the iris pixel turns azure (#9fd4ff) during Q, R and Execution
    Hour. That tells the player "a sentence is active".
  - **Soft:** a slight smile, for an idle variant and wins.
  - **Hurt.**
- **Hand-authored:** face pixels are hand-drawn stamps for each facing (three-quarter, profile,
  back) and are never rendered from 3D.
  - REF-BREAKDOWN warns that 3D toon eyes downsampled to 2–5 px turn to mush.
  - The lab already stamps face pixels without rotating them (`src/lab/art/standin-figure.ts`
    [M]).
- **The close-up lives in R's cut-in panel,** so the 96 px face only has to read, not act.

### 1.6 Palette

Two jobs here: keep her body under the rubric's budget of about 32 colours, and keep her effects
away from both the enemies' red and her own white costume.

**Character: 29 colours**

| Ramp | Steps, light to dark | Note |
|---|---|---|
| Outline | #14122a | tinted indigo near-black (01 uses plum, 07 and 08 blue-black [M]); never #000000, which is enemy black |
| Skin | #fbe6d2, #f3d2b2 (14's chip), #e0a98f, #b8756a | warm shadows |
| White cloth | #f6f2ea, #e5e0e8, #c4bdd4, #9a90b2 | lavender shadows like 01's [M]; her brightest white stays warm and below the effect cores |
| Gold | #fff0b8, #f0d58a, #d1a452 (14's chip), #a0772f, #5e4020 | includes a specular step |
| Beige | #e4d2ba (14's chip), #c9b39c | stocking shading, collar lining |
| Hair | #86aef0 (sheen), #4f5fa0, #36407a, #262c55, #1a1d3a | |
| Steel (blade, haft, greaves) | #f2f6ff (1 px edge), #a9b6dc, #5a6394, #343a62, #1c1f38 | blued steel, darker than the costume so the weapon never disappears against her |
| Face accents | #e8b64a iris, #8c4a52 mouth, #eba0a0 blush | the Verdict eye reuses #9fd4ff from the effects |

**Effects**

| Ramp | Steps, dark to hot | Used for |
|---|---|---|
| **Verdict azure** (signature) | #1b1f5c, #2f4cb0, #4f8ff0, #9fd4ff, #f2fbff | arcs, smears, pillars, the light-crosses, the Great Cross, floor bands, afterimages |
| Sigil gold | #5e4020, #a0772f, #f0d58a, #fff6d0 | sentence marks, the glyph, toll rings, cross sparks, floor seams |
| Dust, cool neutral | #3a3f63, #7c8098, #b4b9cc | ground dust, debris |
| Impact frame | world #0d0f24; her and her effects #f2fbff | 1–2 tick monochrome frames |

**Why azure is the signature colour**

- **Against the enemies.** 13 uses one neutral grey ramp and one red ramp [M, REF-BREAKDOWN].
  Azure (hue about 215°) sits opposite red on the colour wheel and is saturated where their greys
  aren't. Her light and their red can't be confused at a glance, and red stays the enemy's
  warning colour.
- **Against her own costume.**
  - Her whites are warm (#f6f2ea) and always carry a 1 px outline and lavender shading.
  - The effect cores are cool (#f2fbff) and never outlined.
  - So she doesn't dissolve into her own slash (rubric 12).
- **Against any background.** The ramp runs from deep indigo to near-white. The indigo end frames
  the bright cores the way 08's dark shards frame its bolt [M], so her effects read on light and
  dark backgrounds alike.
- **Against the world light.** The lab's current world rim light is already pale azure: its
  `rimColour` in `src/lab/data/lighting.json` is #99d6ff [M]. Her effects and the world rim
  agree.
- **Gold is second.** It carries "holy" (crosses, bells, marks) and ties the effects to the
  costume trim, the way the effects in 07's bonus panel recolour along with the character
  [visible].
- **Rule: no red anywhere in her effects.**

### 1.7 Weapon: the glaive "Vesper"

Vesper is named for the evening bell.

**Why a glaive, not a sword:**

1. **Reach makes width.** At 1.3H, held two-handed near the butt, the tip reaches about 1.8–1.9H
   from her feet. A full swing sweeps about 2.4H before any effect is added; a 1.0H sword reaches
   about 1.4H. [I, arithmetic from 1.2]
2. **Weight you can see.** The haft sliding through her lead hand shows the lever, so a long
   wind-up reads as effort rather than delay.
3. **The cross.** Planted butt-down, the haft and guard make an upright cross taller than her,
   which is the kit's central image at rest.
4. **It reads at pixel scale.** A 2 px haft line with a 10 px cleaver head reads at real size
   over the busy costume. A 3 px sword blade gets lost against white cloth.
5. **It's open ground.** The pixel refs are mostly swords (06, 09, 10) and a greatsword (08). The
   closest researched AAA polearm is Genshin's Flins (RESEARCH.md).

**Silhouette: 125 px long (1.3H)**

| Part | Size | Design |
|---|---|---|
| Butt cap | 3×4 px | gold, with a tiny cross finial; it's the "gavel" end in Q |
| Haft | 78 × 2 px | blued steel #343a62 with a #5a6394 light edge, and three gold ferrules at the thirds |
| Guard | 15 × 3 px | a gold crossbar with two short downturned lugs: the cross arm |
| Bell | 3×4 px | a small gold bell hanging under the guard on the spine side. It swings as secondary motion and makes every clink. |
| Ribbon | 2 × 22 px | a white stole with gold ends, knotted under the guard. It makes the trail in every attack and is keyed long on strikes. |
| Head | 44 px long, 10 px at the widest | details below |

The head is a single-edged headsman's cleaver:

- a straight spine with a gold spine line
- a convex edge, widest near the tip
- a square tip with one corner clipped, and no point, because it's made to cut, not stab.
  Historical executioner's swords were made without a sharp point. [S, general historical
  knowledge, not re-checked this session]
- a 3×5 gold cross etched at the base
- a 1 px #f2fbff highlight along the edge, like 08's blade [visible]

**How she carries it.** The weight is forward-heavy.

- At rest: planted butt-down.
- Walking: on her right shoulder, blade behind.
- Running: dragged low behind her at about 20°, ribbon streaming.
- Grip:
  - both hands on every heavy move
  - the lead hand slides along the haft in M1-1 and M1-4
  - a centre, quarterstaff grip for the wheel (M1-3)

### 1.8 Personality in motion

- She's never in a hurry to kill. Her wind-ups are long and still, her strikes take one drawing,
  and after the dash attack she walks away before the cut goes off.
- **Idle:**
  - one hand on the planted haft at chest height
  - weight on one hip, head slightly bowed
  - every 5 s or so she lifts her eyes
  - idle variant: she flicks the bell with a fingertip and listens (a tiny gold ring and one soft
    clink), which hints that she counts the tolls
- **Voice, if any:** short, formal lines, and one word at the execution. No quips during the
  ultimate.
- **No gore.** The enemies are constructed wardens in the carried-forward story (CANON.md [S]).
  "Execution" means unmaking a construct: they break into their own red, black and white shards,
  with no blood.

---

## 2. Moveset

### 2.0 Rules shared by every move

- **Sentence marks.** This is the delayed-payoff layer, like Flins, Fleurdelys and Skirk in
  RESEARCH.md. It's optional for the first build on the test map.
  - Every M1 hit, and a perfect dash, puts a small gold cross (5×7 px) over the enemy's head.
  - Up to three stack. At three they merge into one larger, glowing 7×11 cross.
  - Marks last 360 ticks (6 s).
  - The M1 finisher, Q and R "execute" marks for bonus damage and extra crosses.
- **The peal.** Vesper's bell clinks on each M1 hit, one step lower each time, so you can hear the
  string count down. Every heavy hit gets a full low toll.
- **Sound gap.** Right before the M1 finisher, Q's detonation and each R stroke, all sound ducks
  for 2–4 ticks.
- **Flash budget.** No more than 3 full-screen flashes (white flashes or monochrome impact
  frames) in any 60 ticks.
  - The runtime enforces this across all sources and skips any extras. The limit comes from
    WCAG 2.3.1's three-flash rule (RESEARCH.md [S]).
  - A reduced-flashing setting replaces each flash with a 40% dim.
- **Terrain on the test map.**
  - Floor bands, cracks and dust follow the surface she stands on and stop at platform edges.
  - Q's crosses land on the highest ground under their x position.
  - Pillars and R's lines ignore terrain.
- **Fluidity.** Every recovery can be cancelled into M2 without resetting the M1 string, and the
  dash attack counts as M1-1, so M1 after it continues at M1-2. (Endfield keeps strings alive
  through dodges and skills [S, RESEARCH.md].)
- **Rim light** (QUALITY-RUBRIC section 11):
  - 1 px wide, 2 px on sleeves and hair clumps
  - only on the side facing the active effect
  - in that effect's colour: azure #9fd4ff from arcs, gold #f0d58a from toll rings and glyphs
  - with no move active, the world rim takes over

### 2.1 M1: The Sentence (four-part string)

Read this table as the rhythm of the string: when each hit lands, how long it freezes and how
soon the next input is taken.

| Part | Name | Hit lands (tick) | Hitstop | Next M1 from | M2 from | Clip length | Area |
|---|---|---|---|---|---|---|---|
| 1 | Indictment | 10 | 3 | 15 | 13 (11 on hit) | 31 | 1.6H crescent |
| 2 | Testimony | 8 | 3 | 16 | 11 (9 on hit) | 32 | 2.0H wedge |
| 3 | Breaking Wheel | 9 and 21 | 3 + 4 | 30 | 13, then 25 | 47 | 2.55H wheel |
| 4 | Sentence | 30, band 38–49, echoes 50 and 54 | 8 | restarts at 64 | 46 | 84 | 3.35H cross of light |

Chained at the earliest cancels with every hit landing, the string takes 15 + 16 + 30 + 84 ticks,
plus 21 ticks of hitstop: 166 ticks, about 2.8 s. That sits inside the Genshin strings (Skirk
160 f, Flins about 161 f [M, gcsim via RESEARCH.md]) and RESEARCH.md's 2.5–2.8 s target. The
gaps are uneven on purpose: short, short, long, longest (Skirk's are 19 / 18 / 37 / 19 / 67
[M]).

#### M1-1 Indictment: the rising drag-cut

She drags the blade along the floor behind her and rips it up into a rising crescent in front,
spitting sparks from the scrape.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Anticipation | 0–8 | D1 4 · D2 5 | D1: weight drops to the back foot; the head swings back and down. D2, the coil: hips turned away, haft slid out to full length through the lead hand, blade dragging on the floor at −0.5H; sleeves still swinging forward from idle. |
| Strike | 9 | D3 1 (smear) | the bent-blade smear (09's trick): the glaive drawn as one curved stroke from floor-behind to overhead-in-front, body mid-turn |
| Contact | 10–12 | D4 3 held | arms up and forward, glaive at 45°, tip at +1.2H forward and 1.45H up; hair, veil and sleeves still low, lagging |
| Follow-through | 13–18 | D5 3 · D6 3 | glaive over the shoulder; sleeves and tabard overshoot upward (D5), then start to fall (D6) |
| Recovery | 19–30 | D7 6 · D8 6 | settles into the ready stance: glaive across the body, head low and forward |

- **Drawings:** 8 unique; 31 ticks (0.52 s) on a miss, plus 3 on a hit.
- **Cancel:** into M1-2 from tick 15; M2 from 13 (11 on a hit); Q or R from 13; jump from 17;
  walk from 24. No i-frames.
- **Root motion:** +8 px, stepping in over ticks 4–10.
- **Hitbox (ticks 9–12):** two boxes that follow the crescent.
  - Low box: x +10 to +110 px, height 10–70 px.
  - High box: x +30 to +125 px, height 70–145 px.
  - Reach 1.3H forward and 1.5H up.
  - Knockback is a small pop upward (x 0.6, y −2.2 px per tick). Hitstop 3.

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Anticipation | floor scrape | 4–6 spark pixels at the dragging blade, and a 1 px bright seam on the floor | #fff6d0, #f0d58a | 8 ticks |
| Anticipation | edge glint | one pixel runs up the blade edge | #f2fbff | 2 |
| Strike | main arc | rising C-crescent, 154 × 140 px (1.6H × 1.45H); leading edge 6–8 px thick; tail tapers to 1 px | edge #f2fbff; body #9fd4ff to #4f8ff0; tail #2f4cb0 | full for 4, striped for 4, a 1 px sliver for 4, then gone (10's decay [M]) |
| Strike | slivers | 2 thin parallel arcs, 6 and 11 px outside the main arc | #9fd4ff | follow the main arc's decay |
| Contact | core flash | 4-point star, 9×9 | #f2fbff | 2 |
| Contact | sparks | 6–8 gold spark pixels | #f0d58a, #fff6d0 | 12 |
| Contact | sentence mark | 5×7 gold cross over the enemy | #d1a452, lined #5e4020 | 360 |
| Ground | gouge | 30 px floor scratch behind her, a bright seam cooling to indigo | #f0d58a to #1b1f5c | 30 |
| Light | tip light | point light on the blade tip: radius 90, intensity 1.4 | #9fd4ff | 16 |

- **Camera:** a 1 px push forward at contact; 1 px of shake for 4 ticks on a hit; nothing on a
  miss.
- **Sound:**
  - steel scraping stone (0–8)
  - a low, heavy whoosh (9)
  - on contact (10): the hit thud and the peal's highest clink
  - sleeve snap (13)
- **Sources:**
  - **Refs:**
    - 10 left C: stance, then a swing with the smear starting at the tip, then the full C-crescent
      [M]
    - 06: draw order (trail behind, slash in front, spark on top)
    - 07: ground scratches
    - 09: bent-blade smear
  - **Researched:** Flins's first hit lands at 11 f and Skirk's at 13 f [M, gcsim]. Hers lands at
    10.
  - **Timing:**
    - Quaternius UAL2 "Sword Regular A" and "A Rec" (CC0: retarget and alter)
    - Bandai Namco `dataset-1_slash_normal_001` for a professional drag-up (timing only until the
      non-commercial question is settled)

#### M1-2 Testimony: the flat step-through sweep

She steps through and swings the glaive flat at waist height, rolling the haft across her back,
and lays a long wedge of light over a low wave of dust.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Anticipation | 0–5 | D1 3 · D2 3 | D1: shoulders turn back; the head passes over and behind her own head; haft across her back. D2: front foot steps through; the head is low behind her at hip height. |
| Strike | 6–7 | D3 2 (smear) | horizontal wedge; body side-on; sleeves stretched flat behind |
| Contact | 8–10 | D4 3 held | glaive fully extended flat forward at waist height, tip at +1.5H; hair, sleeves and both tabards trailing |
| Follow-through | 11–17 | D5 4 · D6 3 | glaive wraps round behind her, back half visible; sleeves whip forward past her (overshoot) |
| Recovery | 18–31 | D7 7 · D8 7 | back to ready |

- **Drawings:** 8 unique; 32 ticks, plus 3 on a hit.
- **Cancel:** into M1-3 from 16; M2 from 11 (9 on a hit); Q or R from 11; jump from 18; walk
  from 24.
- **Root motion:** +16 px over ticks 2–9.
- **Hitbox (ticks 6–10):** x −30 to +165 px (−0.3H to +1.7H), height 15–90 px, so 2.0H wide.
  Knockback x 2.4, y −0.6. Hitstop 3.

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Strike | main wedge | horizontal wedge 195 × 24 px (2.0H); 5 px leading edge; tail thins to 1 px behind her | as M1-1 | full for 6, then 3 parallel stripes for 6, then a sliver for 6 |
| Strike | speed lines | 3 lines, 1 px, inside the wedge (07 [M]) | #4f8ff0 | with the wedge |
| Contact | flash, sparks, mark | 7×7 star; 4–6 sparks; +1 mark | as M1-1 | as M1-1 |
| Ground | dust wave | broken brushstroke dust, 210 px long and 4–8 px tall, under the wedge, drifting forward (11's grey dust [M]) | #7c8098, #b4b9cc | 20 |
| Light | blade light | radius 120, intensity 1.4, attached to the tip | #9fd4ff | 18 |

- **Camera:** a 2 px push forward over ticks 6–11; 1 px of shake for 4 ticks on a hit.
- **Sound:** cloth whip, a long low "vwoom", the hit and a clink one step lower.
- **Sources:**
  - **Refs:**
    - 10 left D: a full horizontal wedge, then a thinner, broken decay [M]
    - 11 row 4: a long horizontal slash over ground dust, about 4.2 times its figure's height [M]
  - **Researched:** Skirk's second hit lands at 7 f [M].
  - **Timing:**
    - UAL2 "Sword Regular B" and "B Rec"
    - spinach's slash set (BowlRoll 68234): timing first, then retarget

#### M1-3 Breaking Wheel: the windmill spin (two hits)

She grips the haft at its centre and whirls the glaive in a full vertical wheel. The blade carves
the floor behind her (hit A), passes over the top, and carves the floor in front (hit B). For a
moment a wheel of light 2.4H across stands round her, spraying sparks at both ends. The wheel is
both an old execution device and St Catherine's emblem, a saint's symbol [S, general knowledge],
so the shape fits her double role.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Anticipation | 0–6 | D1 3 · D2 4 | D1: hands slide to the middle of the haft. D2: glaive tilted, head forward and high, butt back and low; the wheel starts. |
| Strike A | 7–8 | D3 2 (smear) | rear half of the wheel: the head sweeps down behind her and bites the floor |
| Contact A | 9–11 | D4 3 held | head low behind, butt high in front; she's turned three-quarters away, with the open back and yoke cross visible |
| Spin | 12–18 | D5 3 · D6 4 | D5: head rising behind her. D6: glaive vertical overhead (an upright cross against the sky), hair fanned into 5–8 spikes (05 row 7 [visible]) |
| Strike B | 19–20 | D7 2 (smear) | front half: the head comes down in front and scrapes forward |
| Contact B | 21–24 | D8 4 held | head on the floor at +1.2H, sparks flying |
| Follow-through | 25–34 | D9 5 · D10 5 | D9: the head rebounds off the floor (one bounce, 6 px up). D10: glaive swung back to the shoulder. |
| Recovery | 35–46 | D11 6 · D12 6 | back to ready |

- **Drawings:** 12 unique; 47 ticks, plus 7 when both hits land.
- **Cancel:**
  - M2 from 13, so you can dash out between the two hits, and again from 25
  - into M1-4 from 30
  - Q or R from 25; jump from 32; walk from 36
- **Root motion:** +6 px in anticipation, none during the wheel, +4 px at strike B.
- **Hitboxes:**
  - **A (ticks 7–10):** x −115 to +20 px (−1.2H to +0.2H), height 0–110 px. Hitstop 3. Its
    knockback (x −1.8, y −1.2) drags enemies from behind her toward her front, so B catches them.
  - **B (ticks 19–23):** x −10 to +130 px (−0.1H to +1.35H), height 0–170 px. Knockback launches
    (x 1.6, y −3.0). Hitstop 4.
  - **Together:** −1.2H to +1.35H, 2.55H wide. The visible wheel is 230 px (2.4H) across and runs
    from the floor to 1.8H.

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Strike A | rear half-wheel | half-ring, 230 px across, 6 px leading edge; below the floor line it becomes a groove | azure ramp | until tick 11 |
| Strike A | groove and sparks | 1 px bright seam 50 px behind her; 12 spark pixels spraying back | #fff6d0, #f0d58a | 40, the seam cooling to #1b1f5c |
| Spin | top arc | 2 px arc over the top that completes the circle, so the whole wheel shows during ticks 14–20; 4 faint spokes inside on D6 | #9fd4ff; spokes #2f4cb0, dithered | 6 |
| Strike B | front half-wheel | 8 px leading edge, heavier than A | azure ramp | full until 24; 3 concentric stripes 25–30; a 1 px circle 31–36 |
| Strike B | groove and sparks | seam 90 px ahead; 16 sparks spraying forward; 2 indigo shards | as A, plus #1b1f5c | 40 |
| Contacts | flashes, marks | 7×7 star, then 9×9; +1 mark each | as M1-1 | as M1-1 |
| Light | wheel light | radius 140, intensity 1.6, on her hands | #9fd4ff | 30 |

- **Rim:** it swaps sides, lighting her back edges during A and her front edges during B.
- **Camera:** 1 px of shake for 3 ticks on A; 2 px for 6 ticks and a 1 px push on B.
- **Sound:**
  - a rising haft whirr ("whum-whum")
  - metal screeching on stone behind her, then the third clink
  - a screech ahead, then the fourth clink and a stone crunch
- **Sources:**
  - **Refs:**
    - 05 row 7: rising spin with the hair as the spectacle, about 10 drawings [M]
    - 10 right C: low stance, rising fragment, sliver, bowl-shaped low sweep
    - 11 top right: crescent with a ground spray
    - 12 W: a ring round the body
  - **Researched:**
    - Skirk's third hit lands at 8 and 22 f [M]; ours at 9 and 21.
    - Dead Cells' Symmetrical Lance also hits behind [S].
  - **Timing:**
    - ジュウ's weapon twirl (BowlRoll 62294), timing only until its trace flag is checked
    - Mixamo "Standing Melee Attack 360 High" for the body turn
    - MotionPackage No. 65's spear sweep, if Dex buys it

#### M1-4 Sentence: the headsman's chop (finisher)

She raises the glaive straight overhead and holds it there like a headsman's axe while a thin
line of light marks where it will fall. One chop buries the blade in the floor, and a cross of
light erupts from the cut, a pillar going up and a band racing both ways along the floor, as the
bell tolls.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Anticipation | 0–7 | D1 4 · D2 4 | steps in; swings the glaive up from low to overhead, back arching |
| Coil, held | 8–19 | D3 4, then held 8 | **the Raised Axe.** Glaive vertical above her (an upright cross against the sky), up on her toes, both hands high. The veil, hair and sleeves are still rising (lag). |
| Pre-drop | 20–25 | D4 6 | knees give 2 px and the blade tips back 10°: the extra coil just before release |
| Strike | 26–29 | D5 2 · D6 2 (smears) | D5 is the top half of the downswing, D6 the bottom half. Blade bent, body folding forward. |
| Contact | 30–37 | D7 8 held (plus 8 of hitstop on a hit) | blade bitten into the floor at +0.9H, haft leaning back toward her, and she's folded low. Hair, veil and sleeves are still in the air above her. |
| Follow-through | 38–55 | D8 6 · D9 12 held | D8: hair, veil and sleeves crash down past rest and settle (one overshoot). D9: she straightens, one hand on the leaning haft, and looks at the target, calm. |
| Recovery | 56–83 | D10 6 · D11 6 · D12 8 · D13 8 | D10: wrenches the blade free, with a little debris. D11: swings it onto her shoulder. D12–13: back to ready. |

- **Drawings:** 13 unique; 84 ticks (1.4 s), plus 8 on a hit.
- **Cancel:**
  - Q or R from 44
  - M2 from 46, 16 ticks after contact
  - jump from 56
  - M1 from 64, restarting at M1-1
  - walk from 70
- **i-frames:** none. The coil (8–29) should take hits without flinching; the contract has no
  field for that yet (see 4.2).
- **Root motion:** +10 px over ticks 0–7, then planted.
- **Hitboxes:**
  - **Chop (ticks 28–31):** x +40 to +120 px, height 0–190 px (0.85H wide, 2H tall). Knockback
    x 0.5, y +1.5: slammed down and bounced. Hitstop 8. Heavy.
  - **Pillar (ticks 30–41):** x +65 to +100 px, height 0–200 px, in the same group as the chop.
  - **Floor band (ticks 38–49):** x −72 to +250 px (−0.75H to +2.6H), height 0–20 px. It travels
    outward from the cut and launches (x 1.0, y −3.5). Hitstop 4.
  - **Echo crosses:** one at −0.75H on tick 50 and one at +2.6H on tick 54, each 0.3H wide and 1H
    tall. Hitstop 3. Any enemy on the band carrying two or more marks gets its own echo cross at
    tick 54, which uses up the marks.
  - **Whole area:** 3.35H wide (322 px), 2.1H tall.

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Coil | glint | 7×7 four-point star on the blade | #f2fbff, #fff6d0 | 3 ticks, from tick 10 |
| Coil | guillotine line | dotted 1 px vertical line from the blade's arc down to the landing point at +0.9H: the telegraph | #9fd4ff, 50% dither | ticks 12–25 |
| Coil | rising motes | 6 motes drifting up from her feet | #9fd4ff | 20 |
| Strike | vertical smear | 2 drawings: a tall narrow wedge, 40 × 170 px | azure ramp | 4 |
| Contact | core flash | 13×13 star at the cut | #f2fbff | 2 |
| Contact | impact frame | monochrome, only when it hits | world #0d0f24; her and the effects #f2fbff | 1 |
| Contact | pillar (the upright of the cross) | a column 24 × 200 px rising from the cut, frayed into rays at the top | core #f2fbff; body #9fd4ff / #4f8ff0; edge #2f4cb0 | full 10, striped 6, a 2 px line 6 |
| Contact | floor band (the crossbar) | a 10 px band racing both ways along the floor with bright tips, reaching −0.75H and +2.6H in 12 ticks | azure; tips #f2fbff | 12, then a 10-tick fade |
| Contact | debris | 8 indigo chunks thrown in arcs, framing the bright core (08 [M]) | #1b1f5c, #3a3f63 | 30 |
| Contact | cross sparks | 10 plus-shaped gold sparks (3×3) drifting upward | #f0d58a, #fff6d0 | 40 |
| Contact | toll rings | two 1 px gold rings from the bell, growing to a 120 px radius, 8 ticks apart | #f0d58a to #a0772f | 24 each |
| Ground | cross scar | cross-hatched cracks along the band with gold seams cooling to indigo, plus a 13×19 gold cross burned into the front face of the floor at the cut | #f0d58a to #1b1f5c | 120 |
| Follow-through | echo crosses | small crosses of light (a 0.8H pillar with a 0.4H bar) pop up at both ends of the band | azure with a gold edge | 16 |
| Light | impact light | radius 220, intensity 2.4, height 40 | #9fd4ff | 30 |
| Light | toll light | radius 120, intensity 0.8 | #f0d58a | 24 |

- **Rim:** azure on her front edges from the pillar; gold on her top edges from the toll rings.
- **Camera:**
  - 3 px of shake for 12 ticks, fading as trauma squared (RESEARCH.md 2.6)
  - a 2 px bump downward at contact
  - no zoom, because a non-integer zoom resamples every pixel and shimmers (RESEARCH.md 3.2)
- **Sound:**
  - cloth whisper (0–7)
  - the bell swings up and rings once, soft and long (8)
  - silence (26–29)
  - at contact (30): the chop, stone splitting, and the big low toll with a 2-second tail
  - a rushing hiss as the band runs (38)
  - two soft echo tolls (50, 54)
  - stone grinding as she wrenches the blade free (56)
- **Sources:**
  - **Refs:**
    - 07: overhead slam and magenta ground scratches [M]
    - 08: strike, ground burst and dark shards [M]
    - 12 R: light pillars; 12 E stage 4: ground spikes
    - 05 row 5: the held extension is the contact [M]
  - **Researched:**
    - Finishers land at 29–35 f with the longest freeze and recovery [M, gcsim].
    - Dead Cells' Broadsword third hit takes 0.90 s [S].
  - **Timing:**
    - UAL2 "Sword Attack Air Vertical" and "Attack Ground Pound"
    - Mixamo "Great Sword Slash" (needs Dex's sign-in)

### 2.2 M2: Absolution Step (dash)

She slips forward low and fast, untouchable, leaving a line of light on the floor and azure
ghosts of herself behind. Dash through an enemy's attack at the right moment and the world slows
and the attacker is marked.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Startup | 0–1 | D1 2 | lean and back-foot push; glaive pulled in close, head trailing low |
| Travel | 2–11 | D2 4 · D3 6 | D2, the stretch: body low and long; hair, veil, sleeves and ribbon streaming flat. D3: glide. |
| Brake | 12–17 | D4 6 | heels dig in, the glaive butt drags on the floor, and the sleeves whip forward past her (overshoot) |
| Recovery | 18–23 | D5 3 · D6 3 | into ready or a run |

- **Drawings:** 6 unique; 24 ticks (0.4 s).
- **i-frames:** ticks 2–15 (14 ticks). The hurtbox also drops low during travel.
- **Cancel:**
  - M1 into Summary Judgment from 4 to 17
  - Q or R from 6
  - jump from 8, keeping momentum
  - M2 again from 16
  - walk from 18
  - Two dashes chain. A third within 45 ticks of the first is refused. (Genshin also puts a
    cooldown on repeated dashes [S].)
- **Root motion:**
  - On the ground: 130 px over ticks 2–11 (13 px per tick), plus 10 px while braking, 140 px
    (1.45H) in all.
  - In the air: the same, with gravity off for ticks 0–13 and D4 swapped for an air-brake
    drawing.
- **Hitbox:** none. The floor trail is 2.3H long (from −30 to +190 px).

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Startup | dust and sparks | a 6 px dust puff behind; 2 gold sparks at the back foot | #b4b9cc, #7c8098; #f0d58a | 12 |
| Travel | afterimages | 3 silhouettes, spawned at ticks 2, 5 and 8 (engine `afterimage`), tinted, fading by stepped dither | #4f8ff0 to #2f4cb0 | 10 each |
| Travel | floor trail | a 2 px line along the floor under her path, with a 1 px glow below it | core #9fd4ff; glow #2f4cb0 | decays from the tail over 18 |
| Travel | speed lines | 5 horizontal 1 px streaks, 10–30 px long | #b4b9cc, #9fd4ff | 6 |
| Brake | skid | 2 dust puffs; 4 sparks from the butt | dust and gold | 14 |
| Brake | end glint | a 5×5 gold cross glint where the trail ends | #f0d58a | 8 |
| Light | dash light | radius 70, intensity 0.9, attached | #9fd4ff | 14 |

- **Camera:** a 4 px bump in the dash direction that shrinks by 15% each tick (deepnight's
  camera bumps [S, RESEARCH.md 2.6]). No shake, no zoom.
- **Sound:** fabric whip, a rush of air and a tiny clapper tick; steel on stone as she brakes.

**Perfect dash, "Absolved."** It triggers if an enemy hitbox or projectile touches her during
ticks 2–9. On the test map the turret's shots are the perfect-dash target.

- **Slow motion:** 0.3 speed for 30 real ticks. It snaps in fast and eases out; deepnight closes
  60% of the gap each tick going in and 20% coming out [S].
- **Look:** the world's colours drop to greys while she and her effects stay in colour, and a
  gold toll ring (radius 90) expands from her.
- **Marks:** the attacker gets two sentence marks.
- **Sound:** one clear bell note over a reversed swell.
- **Follow-up:** an M1 within 40 ticks turns Summary Judgment into its enhanced form (below).

**Sources:**

- **Refs:**
  - 05 row 3: a dash into a thrust kick [M]
  - 06: the trail behind the lunge [M]
  - 11: a horizontal dash-slash over ground dust
- **Researched** (RESEARCH.md 2.3; some sources weak):
  - Genshin's dash is about 20 f, invincible from about frame 3 to 24.
  - Wuthering Waves' dodge is 22 f, 19 of them invincible.
  - Wuthering Waves and ZZZ both slow time on a perfect dodge.
- **Timing:**
  - UAL2 "Sword Dash RM"
  - Bandai Namco `dash_feminine_001` and `dash_active_001` (timing; the non-commercial question
    is still open)
  - Dolphin_664's glide dash (BowlRoll 103142, timing only)

#### M1 out of the dash: Summary Judgment

She cuts straight through the enemy line without stopping and walks on with the glaive on her
shoulder. A beat later, the line she drew through them detonates.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Anticipation | 0–3 | D1 4 | still sliding; glaive drawn back low at the hip in both hands |
| Strike (the pass) | 4–9 | D2 2 (smear) · D3 4 | D2: one long, straight passing cut. D3: extended, sliding through the enemies. |
| Walk-away | 10–15 | D4 6 | she straightens and swings the glaive onto her shoulder, her back to the enemies |
| Verdict | 16–25 | D5 6, then held 4 | the cool pose, hair and veil settling; the cut line detonates behind her at tick 22 |
| Recovery | 26–39 | D6 6 · D7 8 | back to ready |

- **Drawings:** 7 unique; 40 ticks.
- **Cancel:** into M1-2 from 26, so the string carries on; M2 from 24; Q or R from 24; walk from
  30.
- **Root motion:** +40 px (ticks 0–3) plus +80 px (ticks 4–9), 120 px in all. She ends up past
  the enemies.
- **Hitboxes:**
  - **The pass (ticks 4–9):** a box that moves with her, from −10 to +90 px of her current
    position, height 10–110 px. It sweeps about 2.2H of floor.
    - Each enemy it touches freezes for 12 ticks and gets a 1 px white line across its body.
    - She doesn't freeze; she keeps sliding. This needs hitstop that freezes only the victim
      (see 4.2).
  - **The verdict (ticks 22–25):** the cut line runs from −0.3H to +2.3H, measured from where the
    dash attack started (250 px, 2.6H), height 0–0.9H. Hitstop 5, victims only. A small gold
    cross pops on every victim.
  - **Enhanced, after a perfect dash:** the verdict line also sends a pillar, like M1-4's, up
    through the attacker, and executes the attacker's marks.

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Pass | smear | straight horizontal wedge, 150 × 10 px, with a needle-thin tail | azure ramp | 6 |
| Pass | cut lines | 1 px white line across each victim | #f2fbff | 12 |
| Pass | afterimages | 2 silhouettes | #4f8ff0 | 10 |
| Verdict | the line | grows from 1 px to 3 px to a 14 px slash of light along the whole cut over 4 ticks, then stripes, then a sliver | core #f2fbff; azure body | 4, then 12 |
| Verdict | shards | 8 indigo shards burst from the line | #1b1f5c | 24 |
| Verdict | marks | 5×7 gold crosses on the victims | gold ramp | 20 |
| Light | backlight | radius 160, intensity 2.0, behind her | #9fd4ff | 20 |

- **Rim:** the verdict goes off behind her, so the rim lights her back edges and backlights her
  walk-away.
- **Camera:** nothing on the pass; 2 px of shake for 8 ticks at the verdict.
- **Sound:** a clean "shhk" on the pass; the ambience ducks during the walk-away; two boot clicks;
  a sharp crack and a mid-pitched toll at tick 22.
- **Sources:**
  - **Refs:** 06 (lunge trail, speed lines); 11 row 4.
  - **Researched:**
    - Fleurdelys's cut lands before her colour explodes [M, RESEARCH.md 2.4].
    - Alice ends her charged attack by walking away [S].
    - ZZZ puts the personality in the dodge counter, not the dash [S].
  - **Timing:** UAL2 "Sword Dash RM" running into "Sword Regular C".

### 2.3 Q: Knell

She raises the glaive, writes a gold cross in the air, and brings the butt down like a judge's
gavel. Crosses of light fall from the sky point first, one per bell toll, marching outward in a
row; they are swords of light. They stand in the ground as wards, then all detonate together:
their crossbars join into one long line of light, and pillars shoot to the top of the screen.

| Phase | Ticks | Drawings | What's drawn |
|---|---|---|---|
| Anticipation | 0–7 | D1 4 · D2 4 | D1: a one-handed twirl upward (twirl smear). D2: she catches it and lifts it vertically overhead in both hands, presenting it. |
| Pronounce, held | 8–19 | D3 4, then held 6 · D4 2 | D3: the sentence is written in the air above her, and her eyes turn azure. D4: she lifts the glaive a little higher (pre-drop). |
| Strike | 20–21 | D5 2 (smear) | the gavel: the butt of the haft slammed straight down beside her |
| Contact | 22–27 | D6 6 held (plus 6 on a hit) | glaive planted butt-down (an upright cross); her other hand raised, palm out: the pronouncement |
| Crosses fall | 28–43 | D7 8 · D8 8 | she holds the pronouncement, the raised arm's sleeve hanging long; each impact nudges the veil and sleeves (keyed on the beats) |
| Recovery | 44–63 | D9 6 · D10 6 · D11 8 | lowers her hand, lifts the glaive, back to ready |

- **Drawings:** 11 unique, plus the effect drawings. She can act again from tick 44 (0.73 s)
  while the crosses keep working.
- **Cancel:** M2, M1 or jump from 44; R from 30.
- **i-frames:** none. Super-armour over ticks 8–27 is wanted; see 4.2.
- **Root motion:** none.

**The crosses.** They are effect objects that outlive her animation.

| Cross | Lands (tick) | Position | Height showing | Guard width |
|---|---|---|---|---|
| C0 | 26 | −1.0H, behind her | 1.0H (96 px) | 44 px |
| C1 | 32 | +1.0H | 1.2H (115 px) | 52 px |
| C2 | 40 | +2.1H | 1.4H (134 px) | 60 px |
| C3 | 50 | +3.3H | 1.7H (163 px) | 72 px |
| C4 (hold only) | 60 | +4.5H | 1.9H (182 px) | 80 px |

- **Rhythm:** the tolls are 6, 8, then 10 ticks apart. They slow down while each cross lands
  heavier than the last, the rhythm of a funeral knell.
- **Hold variant** (worth an A/B test): holding Q past tick 20 delays the gavel by up to 12 ticks
  and adds C4, so a tap gives four crosses and a hold gives five. The player builds the area,
  like Roxy's tornadoes, and controls timing inside the spectacle, like Hiyuki's charge [S,
  RESEARCH.md].
- **Wards:** while a cross stands, from landing to detonation, it blocks any enemy projectile
  that touches it. On the test map, a cross between her and the turret eats its shots.
- **Marked enemies:** any within 5H gets its own small cross dropped straight onto it, starting
  at tick 34 and then every 4 ticks. This uses up their marks, and these crosses detonate with the
  rest.

**The "Amen" detonation at tick 62** (74 with C4):

- All the crosses flare for 2 ticks (60–61).
- The crossbars stretch and link into one band of light at 0.3H height, from −1.3H to +3.7H
  (480 px, 5.0H, three quarters of the view). With the hold it reaches +4.9H: 595 px, 6.2H.
- A pillar erupts through each cross to the top of the view (3.75H).
- The crosses sink into the floor as they burst.

**Hitboxes:**

- **Gavel shockwave (ticks 20–23):** x −40 to +60 px, height 0–24 px. Knockback x 2, y −2.
  Hitstop 6.
- **Each landing (3 ticks from the moment it lands):** 0.4H wide and as tall as the cross, at its
  x position. Knockback x 0, y +2, pinning the enemy down. Hitstop 4.
- **Detonation (ticks 62–65):**
  - the band, −1.3H to +3.7H, height 0–0.35H
  - plus a full-height pillar 0.3H wide at each cross
  - launches (x 0, y −4); hitstop 7; heavy
- **Whole area:** 5.0H wide (6.2H held) by 3.75H tall.

| Phase | Layer | Shape and size | Colours | Lasts |
|---|---|---|---|---|
| Pronounce | sentence glyph | a 15×21 px fleur-cross drawn stroke by stroke above her head, led by one bright "pen" pixel | #d1a452 line; #fff6d0 pen | drawn over 6 ticks, then holds until the gavel |
| Pronounce | gathering motes | 12 motes flowing into the blade | #9fd4ff | 12 |
| Strike | gavel ring | a flattened floor ring 60 × 10 px, with dust puffs on both sides | ring #f0d58a; dust ramp | 12 |
| Fall | drop streak | each cross falls from the top of the view as a 3 px vertical streak for 3 ticks before it lands: a clear telegraph | core #f2fbff; edges #4f8ff0 | 3 |
| Landing | core flash | 11×11 star at the point | #f2fbff | 2 |
| Landing | cracks and shards | cracks radiating across the floor; 8 indigo shards framing the flash (08) | #1b1f5c, #3a3f63 | 30 |
| Standing | the cross | a sword of light standing point-down, with a 6–8 px blade, a guard, a grip and a gold ring pommel, inside a 1–2 px stepped halo | body azure; guard edges and pommel #d1a452; halo #2f4cb0 at 50% dither | until the detonation |
| Standing | toll rings | a gold ring from each cross as it lands, growing to a 60–100 px radius | #f0d58a | 20 |
| Detonation | impact frame | monochrome, 1 tick, if the flash budget allows | #0d0f24 / #f2fbff | 1 |
| Detonation | band | an 8 px band linking the crosses, bright tips racing outward | azure; tips #f2fbff | 8, then decays |
| Detonation | pillars | 20–28 px wide, the full height of the view, frayed at the top | azure; core #f2fbff | full 16, stripes 6, a 1 px line 6 |
| Detonation | cross sparks | 20 gold sparks, 3×3 | gold ramp | 40 |
| Detonation | big toll ring | from C3, growing to a 240 px radius | #f0d58a to #a0772f | 30 |
| Ground | burn row | a row of cross-shaped burn marks where the crosses stood | gold seams cooling to #1b1f5c | 120 |
| Light | each cross | radius 90, intensity 1.1 | #9fd4ff | from landing to detonation |
| Light | glyph | radius 60, intensity 0.8, above her | #f0d58a | ticks 8–21 |
| Light | detonation | radius 420, intensity 3.0 | #9fd4ff | 28 |

- **Rim:** gold from above while the glyph burns (8–21); azure on her front edges while the
  crosses stand.
- **Camera:**
  - gavel: 1 px of shake for 4 ticks
  - C0–C2: 1 px for 5 ticks each; C3: 2 px for 8
  - detonation: 4 px for 16, and the world dims to 60% for 20 ticks
  - no zoom
- **Sound:**
  - a twirl whoosh (0–3)
  - a soft, sustained shimmer while the glyph writes (8–19)
  - the gavel knock, wood and steel on stone (20)
  - four tolls on the landings, each lower and louder
  - silence (50–61)
  - "Amen" (62): a low boom, a bright glassy shatter and one short sung chord
- **Cooldown:** about 6 s to start, then tune in play.
- **Sources:**
  - **Refs:**
    - 08: a strike from the sky, with flash, bolt, ground burst and dark shards [M]
    - 12 Q: escalating stages
    - 12 E: the final field of ground spikes, about 4 times the figure's height [M]
    - 12 R: light pillars
    - 11: ground dust
  - **Researched:**
    - Laevatain's summoned fragment keeps attacking.
    - Flins's delayed hits land after the player has control back [M, gcsim].
    - Roxy gathers her tornadoes; Hiyuki charges while time is paused [S].
  - **Timing:**
    - UAL2 "Spell Simple Enter / Shoot / Exit" for presenting and pronouncing
    - UAL2 "Attack Ground Pound" for the gavel
    - ジュウ's twirl-into-attack (BowlRoll 62565) for D1
    - MotionPackage No. 64's charge-and-release, if bought

### 2.4 R: Crux, The Last Sentence

Time stops and the world goes grey. A colossal cross-shaped sword of light comes down and plants
itself in the middle of the screen. She uses it to draw a cross over the whole screen, one
full-height vertical cut and one full-width horizontal cut, crossing out everything on it. Then
the sentence is carried out, and colour floods back along the cuts.

**Length:** 3.8 s in all. She gets control back at 3.0 s and the effects finish at 3.8 s.
RESEARCH.md targets 3.5–4.5 s; the measured ultimates ran 3.4–6.5 s [M]. She's invincible from
tick 0 to 190. Cast in the air, she drops to the floor first (4 ticks).

**Stage rules:**

- **Freeze:** from tick 0 to 172, everything but her and her effects is frozen: enemies, the
  turret, projectiles.
  - Frozen enemies still register hits: they flash and shake 1 px, and their knockback is stored.
  - At tick 172 every stored knockback fires at once.
- **Colour:** the world steps down to cool greys at 30% brightness over 6 ticks, in three steps.
- **Bars:** the site's black cinematic bars (CANON.md) close in by 16 px at top and bottom over
  12 ticks, then recede from 172 to 190.

| Ticks | Time | What happens | Her drawings | Effects | Camera and light | Sound |
|---|---|---|---|---|---|---|
| 0–5 | 0.00 s | The stage freezes and the world goes grey. She plants the glaive butt-down beside her. | D1 6 | none | the bars close in | one deep toll; everything else ducks to silence |
| 6–35 | 0.10 s | **Cut-in.** A 640 × 80 px strip slides in over 5 ticks, holds 20 and slides out over 5. It shows her face close up, drawn on the same pixel grid but much larger: the face about 64 px tall, the eyes about 12 px wide. Azure light rises into her irises, the veil's edge lifts, and she's lit from below by azure rim light. | D2 held 30 (hand on the planted haft, head bowed) | the cut-in panel: 4 drawings (sliding in, eyes closed, eyes opening, eyes open) | the cut-in does the close-up; no zoom | a breath; a high, sustained string note comes in quietly |
| 36–66 | 0.60 s | **The Great Cross comes down.** A cross-shaped greatsword of light descends point first, from above the view to +2.6H. Its blade is 30 px wide and its guard 200 px (2.1H). The grip and pommel stay above the top edge: the whole sword is about 5.4H, taller than the screen. It falls fast, then slows as it nears the floor. She raises an open hand. | D3 6 (36–41) · D4 held 25 (42–66) | the Cross in 3 drawings (high, lower, near the floor); 40 azure motes and gold 3×3 crosses rise from the floor across the screen; the floor glows under it (a 6 px band) | the Cross is now the only real light (radius 360, intensity 2.0); her edges facing it get a 2 px azure rim | a low rising drone; a bowed-metal tone |
| 66 | 1.10 s | **The plant.** The point bites the floor. Anyone within 0.6H of the blade takes the first damage. Cracks run the full width of the floor. | D4, still held | a local 21×21 flash only; 2 crack lines across the floor; 12 indigo shards | 3 px of shake for 10 ticks; no full-screen flash (budget) | toll two; stone splitting |
| 67–107 | 1.12 s | **The raising.** She pulls her glaive from the floor and lifts it overhead: M1-4's Raised Axe, pushed further. The Great Cross mirrors her: it pulls out of the floor and leans back. A full-height dotted guillotine line marks its centre (84–107). | D5 6 (67–72) · D6 6 (73–78) · D7 6, then held 23 (79–107) | the Cross in 3 drawings (rising, raised, leaning back); a 7×7 glint on its point at tick 90 | the light holds | a metal groan; silence over 104–107 |
| 108 | 1.80 s | **Stroke 1, the upright.** She chops, M1-4's pose made bigger, and the Great Cross slams straight down: a vertical cut the full height of the view, 40 px wide at the core. | D8 1 (smear) · D9 held 6 (109–114) | a full-height vertical smear; 12 indigo shards; cracks | **flash 1:** 1 tick of full-screen white; 3 px of shake for 8 | the chop; toll three |
| 115–125 | 1.92 s | **The turn.** She spins with her back to the camera (open back, yoke cross) and swings the glaive wide; hair, veil and sleeves fan out into a full circle (05 row 7, where the hair is the spectacle). The Great Cross lifts out of the cut and swings round to horizontal. | D10 4 · D11 4 · D12 3 | the Cross turning horizontal (2 drawings); a swirl of gold motes | none | a huge whoosh |
| 126–127 | 2.10 s | **Stroke 2, the crossbar.** The Great Cross sweeps the whole width of the screen at 0.8H height, from beyond the left edge to beyond the right. | D13 2 (smear) | a horizontal smear more than 640 × 36 px | **flash 2:** a 2-tick monochrome frame (world #0d0f24; her and the effects #f2fbff) | the cleave; toll four; the string note cuts off |
| 128–149 | 2.13 s | **The crossed-out screen.** A total freeze of 22 ticks (0.37 s): nothing moves, not even particles. A full-height vertical line and a full-width horizontal line cross through the enemies (2 px #f2fbff, with a 1 px #9fd4ff glow). She holds the glaive out flat, back three-quarters to the camera, looking over her shoulder. | D14 held 22 | the two lines | none | silence, apart from a very high after-ring |
| 150–161 | 2.50 s | The lines thicken in steps, 2 px to 4 to 8 (4 ticks each). She turns her head to the camera, eyes azure. | D15 12 | the lines | the light rises | a low swell |
| 162–171 | 2.70 s | **The execution.** In 3 ticks the vertical line opens to 48 px wide and the horizontal to 40 px tall. Every enemy on screen takes the final hit. Colour returns to the world, spreading outward from the two lines over 12 ticks. | D16 10 (glaive to the shoulder, turning away) | the burst; 30 indigo shards and 40 gold cross sparks; three gold toll rings growing to a 300 px radius | **flash 3:** 1 tick of white; 4 px of shake for 20 ticks | toll five, the deepest, with a full choir chord and a roar of stone |
| 172–189 | 2.87 s | **Release.** The freeze ends and every stored knockback fires at once. The lines decay: stripes (172–179), slivers (180–187), gone by 190. A giant cross-shaped scar stays on the floor: a burned line across the whole floor and a crater at the base of the vertical. | D17 8 · D18 10 (can be cancelled from 180) | the floor scar, gold seams cooling to indigo over 240 ticks | the bars recede | clattering debris; the toll's tail |
| 180 | 3.00 s | **Control returns** and Execution Hour begins. | then any action | the Great Cross shrinks into her glaive; the Headsman's Shade appears behind her shoulder | none | one soft final toll |
| 180–228 | 3.0–3.8 s | The remaining effects finish while she moves. | none | none | none | none |

**Flash budget.** The three full-screen flashes fall at ticks 108 (white), 126 (monochrome) and
162 (white).

- The window 108–167 holds all three, which is exactly the limit.
- The plant at tick 66 uses only a local flash.
- If M1-4's impact frame happened just before R, the governor skips R's first flash.
- The reduced-flashing setting turns all three into 40% dims.

**Hitboxes.** All land during the stage freeze, so their knockback is stored.

| Hit | Ticks | Area | Note |
|---|---|---|---|
| Plant | 66–67 | x +2.3H to +2.9H, full height | no hitstop (the world is frozen); victims flash and shake 1 px |
| Stroke 1 | 108–110 | x +2.2H to +3.0H, full height (0.8H by 3.75H) | |
| Stroke 2 | 126–128 | from 1H past the left edge to 1H past the right (about 8.7H), height 0.3H–1.3H | the torso line of every enemy on the ground |
| Execution | 162–165 | the whole view plus 1H past each edge, every height | stored knockback x 3, y −5; maximum stagger; all marks executed |

- **Drawings:**
  - hers: 18 (D1–D18)
  - the cut-in: 4
  - the Great Cross: about 16 (descent 3, plant 1, rising and leaning 3, vertical smear 1, turning
    2, horizontal smear 1, line widths 3, burst 2)
  - the lines' decay: 4
  - about 42 in all
- **Rim:** this is where rim light carries the move. With the world at 30%, the Great Cross is the
  only real light. Her edges facing it get a 2 px azure rim and the rest of her drops one band
  darker, and in the cut-in her face is lit from below in azure. All four measured ultimates
  rim-light the character against a dark backdrop [M, RESEARCH.md 2.4].
- **Sources:**
  - **Refs:**
    - 11: the widest arcs, about 4.2x [M]
    - 12 R (ring, pillars, ground eruption) and W
    - 08: a strike from above
    - 05 row 7: a spin with the hair fanned out
    - 14's back view: the turn
  - **Researched:**
    - **Fleurdelys:** a grey, colourless world with the cut line through it, colour returning as
      an explosion along the cut [M].
    - **Alice:** a total freeze of 0.23–0.43 s on a symmetrical lattice of slash lines [M].
    - **Laevatain:** a summoned sword as a second body, a 0.8 s beauty hold and 15 s of changed
      moves [M, S].
    - **Skirk:** a white impact frame on the last hit [M].
    - **Genshin:** 93–109 f from button press to first damage [M]. Ours does first damage at 66
      and the main strokes at 108 and 126.
  - **Timing:**
    - Mixamo "Great Sword High Spin Attack" for the turn into the horizontal
    - UAL2 "Sword Attack Air Vertical" for stroke 1
    - UAL2 "Spell Simple" for the raised hand
    - MotionPackage No. 64's charged slash (気合を溜めて切る), if bought

#### Execution Hour: 12 s after R

- **The Headsman's Shade.** A ghostly copy of her glaive, 2.2H long, hovers behind her right
  shoulder: a flat azure silhouette at 50% dither with gold guard details.
  - On every M1 hit it swings the same arc 4 ticks later, about 1.6 times bigger: M1-1 2.6H, M1-2
    3.2H, M1-3 3.2H across.
  - Each swing is its own hit, with hitstop 2.
  - Laevatain's Sviga Lævi strikes alongside every basic attack for 15 s [S].
- **M1-4 becomes "Sentence Carried Out."** The chop drops a 1.8H cross of light, and its floor
  band runs the full width of the view and off both edges: a small crossed-out screen, with no
  impact frame.
- **Q** adds one cross, and its band runs the full width.
- **A timer you can see.**
  - Vesper's bell glows azure and tolls softly with 3, 2 and 1 s left.
  - The Shade fades out over the last 60 ticks by stepped dither.
  - It ends by breaking into gold motes on one last quiet toll.
- **Charging R** comes from dealing damage; the numbers are tuning, not concept.

### 2.5 Width check

This table checks each move's reach against the minimum widths the companion docs set. Her
height H is 96 px, and the whole view is 6.7H wide, so anything over 6.7H runs off the screen.

| Move | Width | Floor from REF-BREAKDOWN / RESEARCH |
|---|---|---|
| M1-1 | 1.6H crescent | at least 1.5H |
| M1-2 | 2.0H wedge, 2.2H of dust | at least 1.5H |
| M1-3 | 2.55H (the wheel itself 2.4H) | 1.5–2.5H |
| M1-4 | 3.35H wide, 2.1H tall | about 3H plus a floor band |
| M2 | 2.3H floor trail | at least 2H |
| Summary Judgment | 2.6H line | none set |
| Q | 5.0H (6.2H held), 3.75H tall | at least 3H; RESEARCH suggests 3–5H |
| R | about 8.7H (the whole view plus 1H past each edge), 3.75H tall | runs off both edges |
| M1-4 in Execution Hour | the full view | none set |

### 2.6 Drawing budget

How many unique drawings these moves need, so the scope is visible up front. Idle, walk, run and
jump are not counted.

| Set | Character drawings | Hand-drawn effect drawings |
|---|---|---|
| M1, four parts | 8 + 8 + 12 + 13 = 41 | 6 smears, about 8 decay drawings |
| M2 and Summary Judgment | 6 + 7 = 13 | 2 |
| Q | 11 | 6 for the glyph; 8 for the crosses (one design at 2 widths × land, stand, flare, sink; height set by repeating the blade's middle rows, which keeps the pixel grid) |
| R | 18 | 4 for the cut-in, about 16 for the Great Cross, 4 for the line decay |
| **Total** | **about 83** | **about 54** |

For comparison, ref 05 has about 147 drawings for a complete fighting-game character [M].

---

## 3. What makes her a latest-gen Kuro / HoYo / Gryphline character

These are the patterns RESEARCH.md found behind the newest characters ("What reads as creative
across all of them"), and where each one shows up in her kit:

1. **A second body does the huge hit.** The Great Cross, Knell's crosses and the Headsman's Shade
   do it here; Laevatain's Sviga Lævi, Phrolova's Hecate and Cartethyia's sword shadows do it in
   the games. The 96 px sprite never has to stretch to land an 8H hit.
2. **The ultimate changes the moveset.** Execution Hour lasts 12 s (Fleurdelys 12 s, Laevatain
   15 s), so the grand feeling outlasts the cutscene.
3. **The ultimate takes over the screen.** Time stops, the world goes grey, the site's own
   cinematic bars close in, and the screen is literally crossed out.
4. **Delayed payoff.** The cut comes first and the verdict later:
   - the dash attack's line
   - M1-4's echo crosses
   - Knell's detonation after she's free to move
   - R's execution after the freeze

   (Fleurdelys, Flins and Skirk all do this.)
5. **Player control inside the spectacle.** Hold Knell to lengthen the row; time a perfect dash
   to earn the enhanced Summary Judgment (Hiyuki's charge, Roxy's tornadoes, ZZZ's dodge
   counters).
6. **Graphic abstraction on impact.** Monochrome impact frames, a grey world with one coloured
   line, and a total freeze on a symmetrical composition (Fleurdelys, Alice, Skirk).
7. **Composition as character.** Every effect she makes is built from one geometry, a vertical
   line and a horizontal line: the arcs are strokes and the cross is the signature. Alice's
   symmetry and Laevatain's halo ring do the same job for them.
8. **Rhythm you can hear.** The falling peal counts the string down, the knell slows as the
   crosses grow, and silence comes before every big hit, so the timing can be followed by ear.
9. **Escalation.** Hitstop grows from 3 to 3 to 3+4 to 8. Width grows from 1.6H to 2.0H to 2.55H
   to 3.35H, then 5H, then the whole screen. Each move adds one layer, the way 12's skill stages
   do.
10. **Costume as motion.** Nine things move on their own: two sleeves, two tabards, the veil,
    the hair, the ribbon, the bell and the charms. All are hand-keyed with lag and one overshoot.

What a generic pixel swordfighter does, and what she does instead:

| Generic pixel swordfighter | Her |
|---|---|
| One slash reused on every hit | Four different shapes (crescent, wedge, wheel, cross), each with its own decay |
| Effects about the size of the weapon (the pixel refs reach 0.8–1.75H [M]) | Never under 1.6H |
| Nothing on the ground | Every hit marks the floor: scrapes, dust, grooves, bands, burn rows, R's scar |
| Even timing | Held coils, one-drawing strikes, uneven gaps and silences |
| Effects that pop off | Every effect decays through stripes and slivers (10) |
| Red or plain white effects | Azure with gold, never red; cores cooler than her costume |
| No personality | The walk-away, the bell flick, the pronouncement pose; she's never in a hurry |

---

## 4. Production notes for the 3D-to-pixel route

### 4.1 What's rendered, what's drawn, what's procedural

- **Rendered from the Blender rig:** every character drawing. That means an orthographic side
  camera, toon bands, no anti-aliasing and a normal map per frame.
  - This includes the back-view turns (M1-3's contact A; R's D10–D14). The 3D model gets these
    right for free: the open back, the yoke cross and the back tabard rotate correctly.
  - Pose each key separately (Guilty Gear [S]).
  - On smear drawings, stretch the glaive with shape keys to get the bent-blade look.
- **Hand-drawn on the same pixel grid:**
  - every smear and its decay
  - Knell's crosses and the Great Cross
  - the sentence glyph and the marks
  - the cut-in panel
  - the face stamps
- **Procedural**, using the engine kinds already in `src/lab/engine/vfx.ts` [M]:
  - toll rings (ring)
  - core flashes (burst)
  - speed lines and drop streaks (streak)
  - sparks, motes, shards and dust (particles)
  - floor cracks (cracks)
  - the dash ghosts (afterimage)
  - every light
- **Why the split:** the hero shapes stay hand-drawn so no two moves share one generic slash
  (rubric 9).

### 4.2 What the runtime contract doesn't cover yet

Checked against `src/lab/contracts.ts` [M]. These are proposals for the coordinator; nothing was
changed here.

1. **Flipbook effect sprites** with their own timing: an effect kind that plays hand-drawn frames.
   Smears bigger than the character's frame, the crosses and the Great Cross all need it.
2. **Hitstop that freezes only the victim.** The contract's `hitstop` freezes everything;
   Summary Judgment and R need victims to freeze while she keeps moving.
3. **Super-armour per frame**, for M1-4's coil and Knell's pronouncement.
4. **A stage freeze with stored knockback**, plus world-palette events (grey out, dim, a colour
   wipe spreading from a line), for R and the perfect dash.
5. **A flash governor:** at most 3 full-screen flashes per 60 ticks from all sources, and a
   reduced-flashing setting. The contract's `impact` event already skips itself under
   prefers-reduced-motion.
6. **Effect objects that outlive the animation** and carry their own hitboxes (Knell's crosses,
   the Shade), and status marks on enemies.
7. **A cinematic-bars event.**
8. **Hold-to-extend input for Knell.** The input layer already tracks presses per tick, so a
   held-duration reading may already be possible.

---

## 5. Decisions for Dex

1. **The glaive**, argued in 1.7, instead of a sword.
2. **Azure as the signature colour**, with gold second.
3. **Her look:** midnight-indigo hair and gold eyes; the half-veil; steel greaves instead of plain
   boots.
4. **Outfit changes carried over from REF-BREAKDOWN:** a short back tabard instead of the thong,
   and thigh-highs.
5. **Height:** stay at 96 px? Everything here is written in H, so about 128 px is a straight
   scale-up. At 128 px the face gets eyes the size of 07's and 08's, and the cut-in matters less.
6. **Scope of the first build:** do the sentence marks and Execution Hour go in now, or after the
   four moves look right on their own?
7. **R's close-up:** the proposed cut-in panel, or a whole-view 2x integer zoom? (The open
   question from RESEARCH.md.)
