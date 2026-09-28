# HALO: celestial mechanics

A concept for the player character in which every part of her kit is built from rings, orbits
and gravity. It's one of several concept angles going into A/B. Nothing here is approved, and
everything in it is a claim to test at real size.

Companions: `../REF-BREAKDOWN.md`, `../QUALITY-RUBRIC.md`, `../CRITIQUE-PARAMS.md`,
`../RESEARCH.md`, `../MOTION-SOURCES.md`. References are named by filename and live only in the
git-ignored `review/refs/character/`.

Tags (the same as the companion docs):

- **[M]** measured: counted, read from a file in this repo, or plain arithmetic.
- **[S]** sourced: another doc or outside source says it. Most of these point to `RESEARCH.md`.
- **[visible]**: seen on a reference image.
- **[I]** inference: a design proposal or opinion. **Unless a line is tagged otherwise, the design
  in this file is [I].**

**Units and conventions**

- **H** is the character's height: 96 native px, the working target. 1.5H = 144 px, 2H = 192,
  3H = 288, 4H = 384, 5H = 480, 7H = 672. The 640x360 view is 6.7H wide and 3.75H tall. [M]
- **f** is one 60 fps game frame, which is one tick in the runtime contract. Frame numbers count
  from the button press at f1 and give **whiff timing**, meaning the timing when nothing is hit.
  On a hit, the freeze-on-impact ("hitstop") is inserted and every later frame moves back by
  that much. gcsim, the community Genshin combat simulator, keeps hitlag separate in the same
  way. [S, RESEARCH 2.2]
- **Drawings** are authored at 30 fps, so most drawings stay on screen for 2 f. Smears and
  flashes stay for 1 f. "Hold" is the number of extra frames a key drawing stays up; it maps to
  the contract's `Frame.hold`. [M: `src/lab/contracts.ts`; S: RESEARCH 4.4]
- **Hitboxes** are in px relative to the foot pivot, facing right, with negative y above the
  feet. That matches the contract's y-down convention. [M: `src/lab/contracts.ts`]
- Her body landmarks, in px above the feet: skull top 96, chin 80, shoulders 76, chest 68, waist
  58, hips 52, knees 26.
- **Colour names:** S0–S5 are the starlight effect ramp and "gold" is the costume gold ramp. Both
  are defined in 1.6.

## The pitch in plain words

- She's a sister of a sky that runs like clockwork. Her halo, the rings on her glaive and every
  one of her attacks orbit around something.
- Every move is a ring or an arc around a centre. Each ring is split into a back half, drawn
  behind her, and a front half, drawn in front of her. That's how a flat side view gets depth.
- **Her timing signature is "float, then fall":** big moves hang weightless for a beat, then drop
  with a snap. That contrast is her personality in motion.
- **Width comes from second bodies, not a bigger sprite.** The glaive's rings come off and grow
  into a gravity well (Q). Her own halo leaves her head and comes back 7H wide (R).
- **Colour:** a white-and-gold costume, midnight hair, gold eyes. The rings are gold and the
  energy is starlight azure. There's no red anywhere on her, so red on screen always means an
  enemy.

---

## 1. Character design at pixel scale

### 1.1 Silhouette

The silhouette tells you who she is before any detail does: from top to bottom it's a tilted
broken halo, long straight dark hair, a tall white collar, bell-shaped sleeves, a narrow white
strip of tabard running down the centre, long white legs, and a staff taller than she is with a
ring at its crossing.

- **Head.** A thin, segmented gold halo floats tilted behind the crown. It breaks up the top of
  the silhouette the way 01's flower ornament does. [visible] Ref 13's enemies each get a
  distinct head shape (crown, hood, horns, halo), and one of them, "THE END", has a complete red
  ring behind its head. [visible] So ours is gold, tipped back into an ellipse, and broken into
  three arcs. It never reads as a flat full ring.
- **Shoulders and arms.** Bare shoulders, then gold armbands, then trumpet sleeves that flare to
  16–18 px at the mouth. At rest, the arms make a bell shape that's wider at the wrists than at
  the shoulders. In action, the sleeves are her flags.
- **Torso.** A narrow hourglass under a tall collar. The collar is a white block 5 px tall that
  stretches her neck into a "vestment" column. That reads as priest at 1x, even when the chest
  window is too small to see.
- **Legs.** Long, in white thigh-highs. The front tabard is a vertical white strip down the
  middle with a gold cross. It's the strongest vertical line on the body.
- **Weapon at rest.** Held upright, the glaive's head (a cross guard through two rings) sits
  above her halo, so she reads as a saint carrying a processional cross. The weapon comes second.
- **Solid-fill test** (the rubric's silhouette check): tilted halo, straight hair mass, bell
  sleeves, centre strip and staff with a ring. No enemy in 13 has this combination. [visible
  for 13]

### 1.2 Proportions and pixel budget

These numbers say how many pixels each part gets at 96 px. They matter because the face, the
trim and the charms are all fighting for 1–3 px each.

| Part | Size at 96 px | Note |
|---|---|---|
| Head (skull to chin) | 16 px | 6 heads tall, inside the rubric's 5.5–6.5 range [S, rubric 2] |
| Halo | 15 x 5 px ellipse, 1 px gold line, floats 3 px above and behind the crown | adds about 5 px to the top of the sprite |
| Face width | 12 px | |
| Collar | 5 px tall | covers the neck |
| Shoulders | 20 px wide | |
| Chest window | 5 x 8 px | REF-BREAKDOWN's estimate for 14 at 96 px [S] |
| Waist / hips | 10–11 px / 17–18 px wide | a clear hourglass |
| Legs | 51 px from crotch to sole (53% of height) | gacha long legs |
| Sleeves | 26 px long, 16–18 px mouth | |
| Front tabard | 7 x 34 px, hip to mid-shin | cross about 5 x 7 px |
| Back tabard (new) | 7 x 16 px, split into two tails | replaces the thong cut (see 1.3) |
| Boots | 9 px tall | |
| Hands | 3–4 px | |
| Glaive | 125 px long (1.3H) | the refs' weapons run 0.93–1.1H; REF-BREAKDOWN suggests 1.2–1.4H for a glaive [S] |

**If Dex picks about 128 px** (REF-BREAKDOWN's open height question), every part scales by 1.33,
the head gets about 21 px and the eyes get 3–4 px. The effect sizes below are written in H, so
they scale too, except Q. At 128 px the view is only 5H wide, so Q's 5H burst would fill the
whole screen and should drop to 4H.

### 1.3 Outfit, adapted from `14-outfit-priest-sister.png`

Rule: **white and gold outside, night sky inside.** Every lining (the insides of the sleeves, the
back face of both tabards) is midnight indigo with 1 px stars. When cloth flares it shows a
slice of the sky. That keeps a dark value inside the flare, so she doesn't dissolve into her own
white-hot effects (the rubric's readability section), and it makes the costume part of the
celestial theme.

| # | Component (from 14) | Keep / change | At 96 px |
|---|---|---|---|
| 1 | High stand collar with gold edging and a gold cross at the throat | keep | white block with a 1 px gold rim; the cross is a 3x3 plus |
| 2 | Front panel with a diamond chest window outlined in gold | keep | window 5 x 8 px: 2-tone skin inside a 1 px gold line, with one skin-shadow pixel for the cleavage line |
| 3 | Open sides, armpit to hip | keep | skin strip visible in 3/4 view, profile and spins |
| 4 | Gold armbands on the upper arms | keep; they're rings, so they're on-motif | 1–2 px gold band with one highlight pixel |
| 5 | Detached trumpet sleeves, gold border, fleur-cross at the corners | keep, **plus a midnight lining** | white outside, indigo lining, 1 px gold hem; the corner cross is a 3x5 glyph |
| 6 | Front tabard with a V-notch, gold border and a big fleur-cross | keep, **plus a midnight back face** | 7 x 34 px |
| 7 | Hip band, oval medallion, O-rings, cross charms | keep; the O-rings and charms become her "moons" | 1–2 px band, 3x3 medallion, 1x2 charms that swing and orbit on spins |
| 8 | Garter straps to a gold thigh band, with charms | keep | 1 px straps |
| 9 | Open back: pentagon halter yoke with a cross, mid-back strap | keep the open back | gold straps over bare skin |
| 9b | Thong cut at the back | **swap for a short back tabard** in two tails, mirroring the front | REF-BREAKDOWN's reasoning: at 96 px a thong is a 1–2 px line in a skin blob, which reads as nothing or as nude, and spins show the back [S] |
| 10 | No legs or footwear on the sheet | **add** opaque white thigh-highs with a gold top band where the garters clip on, and white boots with gold toe caps, gold heels and a small cross at the cuff | thigh-highs get a 1 px lavender shadow side and a 1 px sheen; sheer stockings are an A/B option |

**What's shown and what's covered.** "Decently revealing but still in theme" means every patch
of skin is framed by gold lines, so it reads as a designed costume and never as underwear.

| Shown (skin) | Covered |
|---|---|
| Shoulders and upper arms, framed by the collar and armbands | neck (collar) |
| The chest window: a small, gold-framed diamond | the chest itself (front panel) |
| Open sides, from armpit to hip | forearms (the sleeves; the hands show) |
| Open back inside the gold halter yoke | the seat (back tabard) and the groin (front tabard over a white high-cut base) |
| Bare hip sides under the gold hip band; the upper thighs between the tabard and the stocking tops, crossed by garter straps | legs from mid-thigh down (thigh-highs, boots) |

In motion, the tabards are keyed by hand and weighted so that a flip shows **the lining, not
what's under it**. In any pose where a tabard lifts high (the finisher hang, the R invocation),
the white high-cut base stays visible underneath. That's CRITIQUE-PARAMS 12: tasteful, never
vulgar, still clearly a priest.

### 1.4 Hair

- **Colour:** midnight indigo, not black (ramp in 1.6). The bottom fifth of the longest clumps
  shifts to azure, with S3 and then S4 on the last 1–2 px ("starlit ends"). During Q and R, the
  tips step up to S4 and S5, so the hair gives off light.
- **Shape:** long and straight, falling to the lower back (about 40 px from the crown), in 5–7
  big clumps with tips that taper to 1 px. That's 01's clump logic. [S, REF-BREAKDOWN 01]
  - A side-swept fringe of 3 clumps down to brow level, with a 1 px gap over each eye.
  - Two long side locks that reach the chest and frame the face.
  - A small gold ring clasp (2x2 px) holds a thin section at the back, as an orbit motif.
- **Length choice:** the hair stops at the lower back instead of mid-thigh. At 96 px, hair, two
  sleeves and two tabards all flaring together turn into noise (see 1.8).
- **Weightless behaviour:** during float beats (the finisher hang, the Q coil, the R
  invocation) the hair **rises and fans upward** instead of trailing. Every weightless moment
  has this signature, and it's keyed by hand, not simulated. Guilty Gear Xrd uses no physics
  simulation, and Dead Cells-style pipelines under-exaggerate cloth. [S, RESEARCH 2.10, 4.4]

### 1.5 Face

The bar at 96 px is 05's size built with 01's logic: a lash row, iris colour showing in at least
1 px, a highlight where there's room, and a blush pixel. [S, rubric 3]

| Feature | Pixels | Colour |
|---|---|---|
| Lash row | 3 px wide, with a 1 px outward flick | outline #1b1530 |
| Iris | 2 px wide x 2 tall: dark top row, bright bottom row | gold #b8742f over #eab64c |
| Highlight | 1 px at the top inner corner of the iris | #ffffff |
| Brows | 1 x 2 px strokes, seen through the fringe gaps | hair lit #444a86 |
| Mouth | 1 px neutral, 2 px smile, 2x2 open | skin line #5a2f3c |
| Blush | 1 px under each eye | #f09a9a |
| Nose | none in 3/4 view; 1 shadow pixel in profile | skin shadow |

**Expressions:**

- **Serene** (default): the lash row sits 1 px low, so the eyes are half-lidded.
- **Focused** (attacks): the brows angle in and the mouth is a 1 px line.
- **Invoking** (R): the eyes open wide and the iris swaps to S4 and S5, lit white-cyan by the
  halo.
- **Hurt**: the eyes shut into a 1 px arc.

Personality for posing: calm, a little smug, merciful. She moves like something in orbit,
unhurried until the moment she isn't.

The face is **hand-drawn for each facing** (3/4 and profile) and laid over the rendered head. A
3D toon face scaled down to 2–5 px turns to mush. [S, REF-BREAKDOWN "what the 3D route has to
add"]

### 1.6 Palette

Two palettes, one for her sprite and one for her effects. Where possible they reuse the colours
the 3D spike already renders with, so we don't drift. [M: read from
`tools/pixel-pipeline/blender_spike.py`]

**Sprite palette: about 28 colours,** inside the rubric's target of 32 or fewer [S, rubric 6].

| Material | line | deep | shadow | lit | highlight | Source |
|---|---|---|---|---|---|---|
| Silhouette outline | #1b1530 | | | | | proposal: a plum-indigo near-black, like 01's #200d23 [S] |
| Skin | #5a2f3c | #a8686e | #dba196 | #f7d2bd | #fff0e6 | spike [M]; 14's chip #f3d2b2 sits between lit and shadow |
| White cloth | #463a66 | #8f82b0 | #c3bad8 | #f1ece6 | #ffffff | spike [M]; lavender shadows like 01's white [S] |
| Gold (trim, halo, rings) | #3d1e16 | #7a4026 | #b8742f | #eab64c | #fff0a6 | spike [M]; 14's chip #d1a452 sits between shadow and lit |
| Midnight (hair, shaft, linings) | #0e0c1c | #1c1a3a | #2c2d5a | #444a86 | #7a86c4 | proposal: one step lighter than the spike's hair ramp (#0c0a16 … #6b6aa0) [M], so it never reads as enemy black. A/B both. |
| Starlit tips and stars | | | S3 #3f9cff | S4 #9fdcff | | shared with the effects |
| Blade | #262c46 | #56628a | #8d9cbc | #d8e3ef | #ffffff (shared) | spike [M] |
| Blush | | | | #f09a9a | | new |

The eyes reuse gold, and the shaft and linings reuse midnight, which saves about 9 colours.

**Effect palette: starlight plus gold.** The effects stay on the same pixel grid as the sprite,
with stepped bands and no soft gradients (rubric 9).

| Swatch | Hex | Used for |
|---|---|---|
| S0 void | #140f3a | dark framing shards (08's trick [S]), the starfield base, the last step of a decal |
| S1 deep violet | #2e2a8c | arc tails, back halves of rings, floor shadow rings |
| S2 violet-blue | #4f56d8 | the far body of an arc, ripples, constellation lines |
| S3 azure | #3f9cff | arc bodies, slivers, the glaive's fuller when lit |
| S4 pale cyan | #9fdcff | arc bodies near the edge, stars, **the rim light during moves** |
| S5 white-hot | #f2fbff | 1–3 px leading edges, cores, flashes; never large areas |
| Gold | the costume ramp: #b8742f, #eab64c, #fff0a6 | ring bodies (halo, armillary rings, satellites) and the R pillars; when a ring gives off light, its band steps up one tone to #fff0a6, then S5 |

Hue runs violet at the dark end to cyan at the bright end (about 243° down to 200°), the same
direction as ref 11's ramp (#a690ff → #a1aae1 → #b1dff6 → #d6fcff). [M: 11's ramp from
REF-BREAKDOWN] Brightness rises at every step.

**Colour rules**

1. **Gold means solid celestial machinery**: the halo, the rings, and the light the halo gives
   off (the R pillars). **Azure means her own energy**: arcs, trails, shockwaves, floor bands.
   **White-hot only on 1–3 px edges and flashes.** Void indigo is used only for framing shards.
2. **No red and no orange-red** anywhere on her or in her effects. Ref 13's enemies use one grey
   ramp plus one red ramp and no other hue [S, REF-BREAKDOWN 13], so red stays the enemy
   telegraph.
3. **Rim colour follows the light source.** Idle uses the world rim, which is pale cyan: the
   lab's `rimColour` is [0.6, 0.84, 1.0], about #99d6ff [M: `src/lab/data/lighting.json`]. Moves
   use S4 #9fdcff, almost the same colour, so the rim never jumps hue between idle and attack.
   R uses gold #eab64c from above while the halo is overhead.

**Why starlight azure is the signature colour**

- Azure sits across the colour wheel from the enemies' red (red is about 0–5°, our azure about
  200–212°). That's the largest hue gap available.
- **Warm costume, cool effects.** The costume white #f1ece6 is warm and the effect cores are
  cool, so she stays separate from her own slash (the rubric's readability section).
- It's the colour family of ref 11, the wide-arc ref Dex prefers. [S, REF-BREAKDOWN 11]
- Rejected alternatives:
  - gold-only effects: they merge into the trim and warm up toward the enemy red
  - white effects: they dissolve into the costume and into 13's white bone highlights
  - violet-only effects: they collide with the costume's lavender shadows
- The azure effects are saturated and the lavender costume shadows are desaturated (#c3bad8,
  #8f82b0), and that difference is what keeps them apart.

### 1.7 Weapon: the Orrery glaive

**Choice: a big glaive, 1.3H (125 px).**

Why a glaive over a sword:

1. **Orbits need a pivot.** A polearm spins around the hands in the middle of the shaft, so the
   tip travels on a radius of roughly 60–70 px, against roughly 40 px for a sword of about body
   height. [I, estimated from the lengths] One twirl draws a ring 1.3–1.4H across without
   stretching her body, so the rings come out of the weapon's own physics.
2. **Two ends make two trails.** The blade leaves an azure trail and the butt ring a gold one, so
   every spin draws two rings, one inside the other: a binary orbit. A sword can't do that.
3. **The width refs Dex likes are polearm refs.** The figures in 11 carry long staffs, and the
   character in 12 carries a spear. [visible]
4. **It hits behind her** (M1-2), like Dead Cells' Symmetrical Lance [S, RESEARCH 2.1], which
   makes her strong in crowds.

What it costs:

- Spin frames get wide, up to about 260 px.
- A 2 px shaft at diagonal angles is the part most likely to shimmer in a 3D-to-pixel render. It
  needs hand-cleaning on key frames.
- **CANON calls the weapon "the sword"** ("Click / J / slash: the sword") [S: `CANON.md`]. If the
  glaive wins, Dex updates that line.

**Parts** (sizes at 96 px):

| Part | Size | Colours | Design |
|---|---|---|---|
| Blade | 36 px long, 7 px at its widest | blade ramp, 1 px white edge (08's sharp-edge highlight [S]), 1 px S3 fuller that lights up when she attacks | a single-edged crescent with a forward hook at the tip and a notch in the spine. Seen side-on it's a crescent moon. |
| Cross guard | 13 x 3 px | gold | 14's fleur-cross, with flared arms |
| Armillary rings | outer 13 px across, inner 9 px | gold; S4 glow inside when charged | two rings at 90° to each other around the guard. From the side one reads as a circle and the other as an ellipse, like a gyroscope. They spin when charged and come off for Q. **They're a diegetic cooldown: while they're missing, Q isn't ready.** |
| Shaft | 2 x about 78 px | midnight ramp, 1 px gold bands at the two grip points | dark on purpose, so it never disappears against her white costume (rubric 1's fail case) |
| Butt | 6 px ring plus a 3x4 cross finial | gold | the counterweight. It draws the inner gold trail in spins and is the pivot for Slingshot. |

**Silhouette, upright:**

```
      _
     / )      crescent blade with a hook tip (36 px)
    / /
   ( (
  --(O)--     cross guard through the armillary rings (13 px)
     |
     =        gold grip band
     |        2 px midnight shaft
     |
     =        gold grip band
     |
     o        butt ring (6 px)
     +        cross finial
```

Upright, the head is a cross with a ring at the crossing, so the weapon reads as a Celtic
processional cross first and a blade second. The priest reading holds even in idle.

### 1.8 Carry, idle and secondary motion

- **Carry:** the glaive stands upright in her near hand, with the butt beside her rear foot. Her
  weight sits on the rear hip (contrapposto), and her free hand rests at the collar cross. The
  spike renders her with her right side toward the camera, so the weapon hand is the near
  hand. [M: `blender_spike.py` conventions]
- **Idle (for the carry only; the idle isn't in this brief):**
  - a 12-drawing loop, each held about 8 f
  - the halo's gaps turn 1/12 of a revolution per loop
  - the armillary rings tick once every two loops
  - the sleeves breathe and the charms sway
- **One lead flag per move.** Hair, two sleeves, two tabards and charms can't all flare at once
  at 96 px without turning into noise. Each move picks one lead:

| Move | Lead flag | The rest |
|---|---|---|
| M1-1 | sleeves rise in the wind-up and whip on contact | hair lags 1 drawing |
| M1-2 | front tabard flares flat and the charms fling outward (orbit) | small |
| M1-3 | hair whips forward on the thrust | sleeves |
| M1-4 | **everything** floats. This is the one zero-g moment in the string. | |
| M2 | hair and sleeves stream back | tabards flat |
| Slingshot | back tabard tails and hair | |
| Q | sleeves drift up in the coil | |
| R | hair rises and fans; every lining shows | everything |

- **Lag:** secondary motion lags 1–2 drawings behind the body, overshoots, then settles. [S,
  rubric 8]

---

## 2. Moveset

### 2.0 Shared rules

1. **Rings have a back half and a front half.** Every ring or orbit is drawn as two pieces:
   - the back half on the back layer, behind her, one ramp step darker and 1 px thinner
   - the front half on the front layer, at full strength

   The runtime already supports this: two `vfx` events, one with `layer: "back"` and one with
   `layer: "front"`. [M: `src/lab/contracts.ts`]
2. **Ring tilt is stylised, not true perspective.**
   - Small rings attached to her (halo, armillary rings, satellites) are rendered in her own 3D
     scene, so they match her camera: 30° yaw and 12° elevation, about a 4.8:1 ellipse. [M: spike
     `CAM_YAW` and `CAM_ELEV`; the ratio is arithmetic]
   - Big effect rings use fixed ratios: 8:1 for rings in the air.
   - **Floor rings have a short axis of 10–16 px whatever their width**, which keeps them to a
     thin floor band like the ground-shadow ellipses in 01, 07 and 08. [visible] That's how a
     ring can lie on the floor without breaking CANON's flat side view. [S: `CANON.md`, "Flat
     side view"]
3. **Float, then fall.**
   - Weightless beats ease out into a hang. The cues: sleeves and hair drift up, 1 px motes rise
     off the floor, the halo tips back.
   - The drop snaps: a stretch drawing, 1 px speed lines, then cloth crashes down and bounces
     once.
4. **Orbits speed up on the front pass.** Orbiting things (stardust, satellites, the gaps in a
   ring) move faster across the front half and slower across the back. That reads as depth and
   weight.
5. **Smears follow 10's anatomy:** a crisp near-white leading edge, 2–3 flat tones, a tapered
   tail. They decay as 1 full drawing, then 1–2 striped drawings, then a 1–2 px sliver, then
   nothing. Effects fade out over 2–4 steps and never pop off. [S, rubric 9]
6. **Star marks and the constellation.**
   - Every M1 hit that connects stamps a star mark on the target, lasting 90 f. It stacks to 3:
     a 3x3 cross, then a 5x5 four-point star, then a 5x5 star with a ring.
   - The finisher (M1-4), the Q Collapse and the R lock connect every mark on screen with 1 px
     S4 lines for 6 f. Then each mark bursts in turn, 4 f apart, for one extra small hit.
   - That's the delayed-payoff principle [S, RESEARCH 1]: your string literally draws a
     constellation across the enemies, and the finisher lights it up.
7. **Hitstop** freezes her and the target. Effects and the rest of the world keep moving
   (Genshin's approach [S, RESEARCH 2.2]). The victim shakes 1 px (Sakurai [S]). Today the
   contract's `hitstop` is a global freeze [M], so this is an engine ask (see 4).
8. **The string survives.**
   - The next M1 input is buffered 10 f before its window opens.
   - The string resets after 40 f with no M1.
   - Dashing and using Q don't reset it (Endfield [S, RESEARCH 1]).
9. **Flash safety.** No more than 3 full-screen flashes in any 1 s window (WCAG 2.3.1 [S,
   RESEARCH 2.8]). The runtime skips `impact` events under prefers-reduced-motion [M: contract
   comment]. We should add the same for full-screen whites and give them a "reduce flashing"
   fallback at 50% tint.

### 2.1 The moveset at a glance

"First hit" is the frame the first damage lands (whiff timing). "Next M1" is when the next
attack input is accepted. "Earliest cancel" is the first frame she can break out into anything.

| Input | Name | One line | First hit | Next M1 | Earliest cancel | Widest reach |
|---|---|---|---|---|---|---|
| M1 1 | Meridian | rising crescent from low behind her to high in front | f9 | f15 | f10 (dash) | 1.6H |
| M1 2 | Retrograde | the glaive swings round behind her back into a flat orbit that hits both sides | f7 | f14 | f9 (dash) | 2H (both sides) |
| M1 3 | Perihelion | a lunging thrust that twirls into a spinning wheel of light | f9, f20 | f30 | f10 (dash, if the thrust hit) | 1.6H wheel, 2.4H ripple |
| M1 4 | Aphelion | hang weightless, orbit, slam; the ring hits the floor and expands | f20, f30 | f72 (new string) | f44 (Q or R) | 3H hit, 4H visible |
| M2 | Transit | weightless dash that leaves a ghost halo behind | none | f5 (Slingshot) | f5 | 2.3H trail |
| M2 then M1 | Slingshot | plants the butt ring as a pivot and whips into a rising launch crescent | f7 | f18 | f14 | 2.5H x 1.8H |
| Q | Armillary / Collapse | throws the glaive's rings, which grow into a gravity well; press again to collapse it | f21 (well opens) | f30 | f28 (Collapse) | pulls 4H, bursts 5H |
| R | Zenith | the sky opens, her halo comes back 7H wide, 12 pillars rain round its rim | f97 | f207 | f207 | 7H halo, full screen |

- The full string takes 15 + 14 + 30 + 90 = 149 f (2.5 s) when every input lands the moment its
  window opens. [M, arithmetic] That's inside RESEARCH's target of 2.5–2.8 s, and the rhythm
  runs short, short, long, longest, as the measured strings do. [S, RESEARCH 2.1, 3.3]
- About **94 drawings** make up these moves, against 05's roughly 147 for a whole fighting-game
  character. [M, counted from the tables below; S, REF-BREAKDOWN 05]

---

### 2.2 M1 string

#### M1-1 Meridian (rising crescent)

**Idea:** a quick one-handed rising cut from low behind her to high in front, drawing a pale
crescent 1.6H across and stamping the first star.

| Phase | Frames | Drawings (frames each) | What happens |
|---|---|---|---|
| Anticipation | f1–7 | D1 settle back (2) · D2 coil (3, then hold 2) | the blade dips low behind her rear hip, hips turn away, the sleeves lift 1–2 px (float cue) |
| Strike | f8 | D3 smear (1) | the blade is drawn bent, as in 09, inside the full crescent |
| Contact | f9–11 | D4 contact (3) | the hit lands on f9; **hitstop 3 f** on a hit |
| Follow-through | f12–17 | D5 stripes (2) · D6 sliver (4) | the sleeves overshoot upward and the hair lags a drawing |
| Recovery | f18–30 | D7 (4) · D8 guard (4, then hold 5) | back to guard, the glaive diagonal |

- **8 drawings, 30 f.** Hitbox active f8–9.
- **Cancels:** into M1-2 from f15 · M2 from f10 · Q or R from f12 · jump from f18 · walk from
  f24. **I-frames** (invulnerable frames): none.
- **Root motion:** a 6 px step forward across D2–D4.
- **Hitbox:** a crescent sector, x −10…+154, y −144…0 (1.6H forward, 1.5H tall). Knockback is a
  small push.

| Phase | Layer | Look and size | Colours |
|---|---|---|---|
| Anticipation | particles | 2–3 motes lift off behind the rear foot and rise 6–10 px | S4, 1 px |
| Anticipation | glow | the glaive's fuller lights up | S3, 1 px |
| Strike | main arc | crescent 154 x 110 px, leading edge 3 px thick, tail tapering to 1 px | edge S5, body S4 → S3, tail S2 |
| Strike | slivers | 2 thin parallel arcs, 6 px inside and outside the main arc | S3 and S2, 1 px |
| Contact | core flash | a 9x9 four-point star for 1 f, then 5x5 for 2 f | S5, then S4 |
| Contact | star mark | stamped on the target, 90 f | S5 |
| Follow-through | decay | full arc → 2 striped drawings → sliver (10's decay) | S4/S3 → S2 |
| Follow-through | particles | 4–6 flecks of stardust shed from the arc and drift **up** 8–12 px over 20 f, fading in 3 steps | S5 → S4 → S2 |
| Contact | light | a light on the blade tip that moves with it: radius 120, intensity 1.2, 12 f. The rim light follows the blade round her front edge. | S4 |

- **Camera:** 1 px shake for 4 f, only on a hit.
- **Sound:**
  - a faint glass shimmer on the wind-up (f3)
  - a short crystalline swish (f7–8)
  - on a hit, a bright chime with a soft thud (f9)
- **Informed by:**
  - refs: 10 (the rising fragment and its decay), 09 (the bent-blade smear), 06 (the contact
    spark)
  - timing: RESEARCH's hit-1 window of 8–10 f; the first hits of Flins and Skirk land at 11 and
    13 f [M, RESEARCH 2.1]
- **Timing sources:**
  - Quaternius UAL2 "Sword Regular A" and "A Rec" (CC0; retarget, then widen for the glaive)
  - 山辺's two-handed katana set (timing only until its readme is read)
  - Bandai Namco slash_normal_001 (timing; this depends on Dex's non-commercial ruling)
  - None of these are downloaded yet. [S, MOTION-SOURCES]

#### M1-2 Retrograde (back-spin orbit)

**Idea:** she lets the glaive's momentum carry it behind her back and all the way round, so the
blade draws a flat azure orbit 2H across that hits both sides, with a smaller gold orbit from the
butt ring inside it.

| Phase | Frames | Drawings | What happens |
|---|---|---|---|
| Anticipation | f1–5 | D1 twist, the glaive passes behind her back (2) · D2 grip swap (3) | the armillary rings spin up |
| Strike | f6 | D3 back half of the orbit (1) | the blade sweeps behind her body |
| Contact | f7–9 | D4 front half; contact (3) | **hitstop 3 f** |
| Follow-through | f10–15 | D5 stripes (2) · D6 sliver (4) | the front tabard flares flat (lead flag), the charms fling outward |
| Recovery | f16–28 | D7 (4) · D8 guard (4, then hold 5) | |

- **8 drawings, 28 f.** Hitbox active f6–8. **Cancels:** into M1-3 from f14 · M2 from f9 · Q or
  R from f10 · jump from f16. **I-frames:** none.
- **Root motion:** she pivots in place, with a 2 px half-step back.
- **Hitbox:** a flat band all the way round her, x −96…+96, y −80…−36 (2H wide, both sides, 0.46H
  tall). Each target is hit once and knocked away from her on whichever side it stands.

| Phase | Layer | Look and size | Colours |
|---|---|---|---|
| Anticipation | glow | the armillary rings spin up (2-drawing cycle); a 1 px glint runs down the shaft | gold, S4 |
| Strike | main arc, back half | the back half of a flat ellipse, 192 x 24 px, on the back layer | edge S3, body S2, tail S1 (one step dimmer) |
| Contact | main arc, front half | the front half on the front layer | edge S5, body S4, tail S3 |
| Contact | inner trail | the butt ring's own ellipse, 80 x 12 px, 1–2 px thick | gold #eab64c and #fff0a6 |
| Contact | flash and mark | per target | S5 |
| Follow-through | decay | stripes, then a sliver | |
| Follow-through | particles | 6 stardust flecks keep orbiting half a turn along the ellipse, then drift up and off | S4/S5 |
| Follow-through | ground | a faint floor ring under her, 120 x 8 px, 12 f, fading in 2 steps | S1 |
| Strike to contact | light | a tip light that moves with the blade: radius 100, intensity 1.0, 10 f. **The rim light travels round her silhouette as the blade orbits.** | S4 |

- **Camera:** 1 px shake for 4 f on a hit.
- **Sound:**
  - a low whirr (f1–5)
  - a double swish: the back pass lower (f6), the front pass higher (f7)
  - a small bell tick from the gold ring
- **Informed by:**
  - refs: 11 (the long horizontal slash, turned into a flat orbit), 09 (sleeves and robe
    flaring), 05 row 7 (a spin where the hair is the main event)
  - Dead Cells' Symmetrical Lance, which hits behind [S]
  - Skirk's N2 lands at 7 f [M, RESEARCH 2.1]
- **Timing sources:** Mixamo "Standing Melee Attack 360 High" (retimed so contact lands on f7);
  Quaternius UAL2 "Sword Regular B" and "B Rec".

#### M1-3 Perihelion (thrust, then a wheel of light)

**Idea:** a lunging thrust (closest approach, hence the name), then she twirls the glaive
hand over hand into a vertical wheel of light 1.6H across that grinds through the target and
sheds a ripple 2.4H wide.

| Phase | Frames | Drawings | What happens |
|---|---|---|---|
| Anticipation | f1–7 | D1 draw back (2) · D2 coil (3, then hold 2) | the rear foot pushes, the fuller brightens |
| Strike A | f8 | D3 thrust smear (1) | a straight streak |
| Contact A | f9–11 | D4 (3) | **hitstop 3 f** |
| Wheel wind-up | f12–19 | D5 hand-over-hand (2) · D6 half-wheel smear (2) · D7 full-wheel smear (2) · D8 wheel spin (2) | the hair whips forward (lead flag) |
| Contact B | f20–23 | D9 wheel grind (4) | **hitstop 4 f** |
| Follow-through | f24–31 | D10 ring stripes (2) · D11 sliver and ripple (6) | |
| Recovery | f32–44 | D12 (4) · D13 guard (4, then hold 5) | |

- **13 drawings, 44 f.** Hitbox A active f8–9; hitbox B active f18–21 (one hit per target).
- **Cancels:**
  - into M1-4 from f30
  - M2 from f10, but only if A hit, or from f22 either way
  - Q or R from f24
  - jump from f32
- **Root motion:** a 20 px lunge across D2–D4, then 4 px more during the wheel.
- **Hitboxes:**
  - **A:** x +16…+140, y −84…−60 (1.3H reach at chest height). Knockback is a small push.
  - **B:** a circle centred at x +80, y −78 with a radius of 77, which as a box is x +3…+157,
    y −155…−1 (1.6H by 1.6H). Knockback lifts slightly and pulls the target toward the wheel's
    centre.

| Phase | Layer | Look and size | Colours |
|---|---|---|---|
| Strike A | streak | a straight thrust streak 116 x 5 px with a 5x5 "comet head" at the tip | core S5 1–2 px, S4, tail S3 |
| Contact A | spark and mark | 6 radial lines of 5 px, plus a star mark | S5/S4 |
| Wheel | main arc | a vertical ring facing the camera, 154 px across, band 3–5 px thick, brightest at the blade | lead segment S5, band S4/S3 |
| Wheel | slivers | 12 spokes of 1 px, flickering inside the ring (the orrery look) | S2 |
| Contact B | burst and mark | an 11x11 burst, plus a second star mark that stacks | S5 |
| Follow-through | ripple | the wheel sheds a 1 px ring that grows from 154 to 230 px (2.4H) and fades in 3 steps. **It's only visual**: it's dim, so it reads as an echo, not a threat. | S2 → S1 |
| Follow-through | particles | stardust rising | S4 |
| Wheel | light | at the wheel's centre: radius 140, intensity 1.4, 16 f | S4 |

- **Camera:** 1 px shake for 3 f on A; 2 px for 5 f on B.
- **Sound:**
  - a "tsk" and a glassy ping on the thrust (f8–9)
  - a gyroscope whirr rising in pitch (f12–19)
  - a buzzing chime on the grind (f20)
- **Informed by:**
  - refs: 12's Q (thrust streaks), 05 row 3 (a dash into a thrust), 10 (decay)
  - multi-hit steps: Skirk's N3 lands at 8 and 22 f; Mavuika's N3 at 28, 33 and 39 f [M,
    RESEARCH 2.1]
- **Timing sources:**
  - Quaternius UAL2 "Sword Regular C" and "C RM" (the lunge)
  - ジュウ's weapon twirl, BowlRoll 62294 (the wheel; retarget only once the trace question in
    MOTION-SOURCES is cleared)
  - 山辺's set for the two-handed grip

#### M1-4 Aphelion (the finisher: hang, orbit, slam)

**Idea:** she hops into a weightless hang with everything floating, whips the glaive through a
full orbit around herself, then drops, and the orbit ring falls with her, hits the floor and
spreads outward as a ring 4H wide that sets off every star mark on screen.

| Phase | Frames | Drawings | What happens |
|---|---|---|---|
| Anticipation | f1–18 | D1 crouch, squashed (2) · D2 hop, stretched (2) · D3 tuck (2) · **D4 the hang (4, then hold 8)** | she rises 14 px, easing into the apex. **Zero-g:** hair, sleeves and both tabards rise, motes float up off the floor, the halo tips back and glows. A dotted 1 px guide line previews the ring (an 8 f warning). |
| Orbit strike | f19–22 | D5 back half of the orbit (1) · D6 front half; contact 1 (1) · D7 orbit complete (2) | hit 1 on f20, **hitstop 3 f** |
| Drop | f23–29 | D8 fall, stretched (3) · D9 glaive overhead (3) · D10 plunge smear (1) | gravity comes back; the ring falls with her |
| Contact 2 | f30–33 | D11 plant; landing squash (4) | hit 2 on f30, **hitstop 8 f** |
| Follow-through | f34–55 | D12 crouch, cloth crashes down (6) · D13 cloth bounces and overshoots (8) · D14 settle (8) | |
| Recovery | f56–90 | D15 (8) · D16 (8) · D17 guard (8, then hold 11) | 60 f of recovery after contact 2, inside RESEARCH's measured 58–72 f [S] |

- **17 drawings, 90 f.**
- **Cancels:** M2 from f50 (20 f after contact) · Q or R from f44 · jump from f60 · a new M1
  string from f72.
- **Poise armour** from f10 to f33: she can still take damage but can't be staggered.
- **Root motion:** 8 px forward and 14 px up across f3–18, easing out; then 6 px forward and
  14 px down across f23–29, easing in.
- **Hitboxes:**
  - **Orbit (f19–21):** x −90…+90, y −92…−52 (1.9H wide, at her raised waist).
  - **Plant and shockwave (f30–34, growing):** a floor band that starts at x ±60 on f30 and
    reaches x ±144 on f34 (3H wide, y −40…0), plus an upright arc in front, x +20…+120,
    y −130…0.
  - Each target is hit once. The hit is heavy; knockback 4 away and 2 up.

| Phase | Layer | Look and size | Colours |
|---|---|---|---|
| Anticipation | debris and dust | a dust puff on take-off (2 drawings) | world palette |
| Anticipation | particles | 6–10 anti-gravity motes rise from the floor under her | S4, 1 px |
| Anticipation | glow and guide | the halo glows; the armillary rings spin fast; a dotted 1 px guide ellipse | gold #fff0a6; guide S3 |
| Orbit | main arc | a flat ellipse 180 x 28 px around her waist, split into back and front halves | front: S5 edge, S4/S3; back: one step dimmer |
| Orbit | slivers | 2 thin rings riding alongside | S3/S2 |
| Contact 1 | flash and mark | per target | S5 |
| Drop | speed lines | 3 vertical 1 px lines above her; the ring stretches downward | S3 |
| Contact 2 | core flash | a 24x24 starburst at the blade tip for 1 f, plus a 1 px "horizon" line 200 px wide for 1 f | S5 |
| Contact 2 | floor ring | the ring hits the floor and becomes 3 concentric flat ellipses growing from ±60 to ±192 px (4H) over 12 f, 10–12 px tall | main S5/S4; slivers S3/S2 |
| Contact 2 | light tongues | 8–12 spikes of light rise from the ring's front edge, 6–30 px tall (12's ground spikes) | S4/S3 |
| Contact 2 | upright arc | the plant's crescent in front of her, 120 x 130 px | S5 → S3 |
| Contact 2 | constellation | every star mark within 4H links up with 1 px lines for 6 f, then each bursts (11x11, 4 f apart) | S4 lines, S5 bursts |
| Contact 2 | debris | 6–10 floor chips thrown up, then falling; 4 dark shards framing the burst (08) | world palette; S0/S1 |
| Follow-through | ground decal | 2–3 concentric "orbit scar" arcs, 1 px, cut into the floor; they cool from hot to dark over 60 f in 3 steps | #fff0a6 → S2 → floor-dark |
| Follow-through | lingering glyph | a 7x5 cross-in-a-ring glyph at the plant point, 90 f | S3 |
| Hang | light | a gold light from the halo: radius 60, intensity 0.8, making a faint rim across her top | gold #eab64c |
| Contact 2 | light | a low floor light: radius 220, intensity 2, 24 f, lighting her from below and in front | S4 |

- **Camera:** a 2 px push upward during the hang; a 3 px shake for 10 f on the plant, fading as
  the square of the remaining intensity (Eiserloh's "trauma" [S, RESEARCH 2.6]). No zoom, and no
  slow motion (the hitstop does that job).
- **Sound:**
  - a hop whoosh (f3)
  - through the hang, a bell shimmer and a whirr rising in pitch (f7–18)
  - a deep "whum" for the orbit (f19–20)
  - a falling whistle (f23–29)
  - the plant: a sub-bass thud, a big glass crack and a short choir "ah" (f30)
  - three descending chimes as each ring passes (f31, f34, f37)
  - debris patter (from f40)
- **Informed by:**
  - Laevatain's string finisher: a 360° ring of fire that passes both screen edges in about
    0.3 s [M, RESEARCH 1]
  - Genshin finishers freeze longest, 0.06 s plus 0.06 s against a target that can still
    flinch, about 7 f [S]; ours is 8 f
  - refs: 07 (an overhead vault slam with ground scratches), 12's E (a crescent with ground
    spikes), 11 (a ground dust layer wider than the arc), 05 row 6 (the shadow shows airtime)
- **Timing sources:**
  - Mixamo "Great Sword High Spin Attack" (the orbit; needs Dex's sign-in)
  - Quaternius UAL2 "Attack Ground Pound" (the plant)
  - Quaternius UAL2 "Sword Attack Air Vertical" (the air body)
  - CMU 88_06 "jump and spin kick" (the shape of the hop and hang)

**Air M1:** in the air, M1 plays Retrograde at gravity 0.3, so she hangs for it. That's a
weightless air spin.

---

### 2.3 M2 Transit (dash)

**Idea:** a short, straight, weightless glide. She tips forward with the glaive trailing behind,
leaves three azure afterimages, and her halo stays behind at the start point for a moment, as if
she moved faster than it could.

| Phase | Frames | Drawings | What happens |
|---|---|---|---|
| Start | f1–2 | D1 lean, squashed forward (2) | invulnerable from f2 |
| Travel | f3–14 | D2 stretch (2) · D3 glide (4, then hold 6) | 128 px (1.33H); 45% of the distance in the first 3 f, then easing out |
| Brake | f15–20 | D4 brake, cloth overshoots forward (2) · D5 settle (4) | invulnerable until f16 |

- **5 drawings, 20 f.** **I-frames f2–16** (15 f). For comparison, Genshin's dash is invulnerable
  from about frame 3 to 24, and Wuthering Waves' dodge for 19 of its 22 frames. [S, RESEARCH 2.3]
- **Cancels:**
  - M1 turns the dash into Slingshot from f5 to f20
  - Q or R from f8
  - jump from f8, keeping half the momentum
  - M2 again from f17, at most twice in a row, then a 36 f lockout
- **In the air:** gravity is 0 from f1 to f14, which is the weightless part. One air dash per
  jump.
- **Root motion:** 128 px forward, as above.
- **Hitbox:** none. The hurtbox is off from f2 to f16.

**Perfect dash ("Occultation").** It triggers when an enemy's active hitbox overlaps her between
f2 and f10, a 9 f window (ZZZ's is claimed at 8–10 f [S, weak]). Then:

- time drops to 0.3x speed for 30 real frames. It snaps in over 2 f and eases out over the last
  12 (deepnight's snap in, ease out [S, RESEARCH 2.7]).
- the world tints one step toward indigo.
- the ghost halo at her start point flashes and eats the hit as a decoy.
- a Slingshot inside the slow motion is upgraded (below).

| Phase | Layer | Look and size | Colours |
|---|---|---|---|
| Start | dust | a floor dust kick | world palette |
| Start | ghost halo | her halo stays at the start point for 10 f, then pops into 6 motes that shoot 64 px **backward** as a short wake | halo gold, motes S4 |
| Travel | trail | a horizontal streak at torso height, from 64 px behind the start point to her front edge: about 222 px (2.3H). 1–3 px bands: brightest next to her, fading toward the tail. | S5 1 px core near her, S4, S3, tail S2 |
| Travel | afterimages | 3 silhouettes left on f4, f7 and f10, each with a tiny ring at the head. Older ones are darker. Each lasts 8 f and fades in 2 steps (the runtime `afterimage` kind [M]). | S3, S2, S1 |
| Brake | dust and particles | a skid of dust; 4 stardust motes carry on forward past her | world palette; S4 |
| Travel | light | a light on her back that moves with her: radius 80, intensity 0.8. The trail rims her from behind. | S4 |

- **Camera:** a 4 px push in the dash direction that fades by 15% a frame (deepnight's camera
  bump [S]). No shake, no zoom.
- **Sound:**
  - a phase whoosh with a glassy shimmer (a short reverse cymbal)
  - a "tink" as the ghost halo pops
  - on a perfect dash: a deep "vwoom" and a slow-time reverb, with the music low-passed during
    the slow motion (Katana Zero slows its music with the world [S, RESEARCH 2.7])
- **Informed by:**
  - refs: 05 row 3 (a dash into a thrust), 06 (the trail behind the lunge), 11 (the dash-slash
    with ground dust)
  - Genshin's dash invulnerability; deepnight's dash camera push and slow motion; ZZZ and
    Wuthering Waves' perfect-dodge slow motion [S, RESEARCH 2.3, 2.7]
- **Timing sources:**
  - Quaternius UAL2 "Sword Dash RM"
  - Bandai Namco dash_feminine_001 (the body lean; timing)
  - Dolphin_664's glide dash, BowlRoll 103142 (timing only)

#### Out of the dash: Slingshot (M1 during Transit)

**Idea:** a gravity assist. She plants the butt ring as a pivot mid-dash, swings her whole body
round it low, and releases into a huge rising crescent 2.5H wide that launches enemies. The
blade draws an azure crescent and her body's path draws a gold U inside it.

| Phase | Frames | Drawings | What happens |
|---|---|---|---|
| Anticipation | f1–5 | D1 butt planted as the pivot, body still travelling, stretched (2) · D2 swing round, body low (3) | a gold spark at the pivot |
| Strike | f6 | D3 smear (1) | |
| Contact | f7–10 | D4 (4) | **hitstop 4 f** |
| Follow-through | f11–20 | D5 stripes (2) · D6 sliver, rising (4) · D7 apex (4) | the back tabard tails and hair lead |
| Recovery | f21–36 | D8 landing (4) · D9 guard (4, then hold 8) | D7 is held until she lands if the floor is lower |

- **9 drawings, 36 f.**
- **Cancels:** M1 carries on with the **next hit in the string** from f18 (Slingshot counts as a
  string hit) · M2 in the air from f14 · Q or R from f14.
- **Root motion:** 48 px forward across f1–10; 24 px up across f6–16; then gravity at double
  strength.
- **Hitbox:** a rising crescent, x −10…+230, y −170…0 (2.5H x 1.8H), active f6–8. Knockback
  launches upward (1 away, 6 up) with heavy stagger.
- **Effects:**
  - a 7x7 gold spark and floor dust at the pivot
  - the main crescent, 240 x 170 px, with a 3 px S5 leading edge, S4/S3 body and 3 slivers
  - her body's U-shaped path in gold (1–2 px, #eab64c and #fff0a6) inside the crescent
  - star marks; stardust rising
  - a light: radius 160, intensity 1.5, 12 f
- **Camera:** 2 px shake for 6 f and a 3 px push upward.
- **Sound:** a metallic clank on the pivot, a big rising swoosh with a cascade of chimes, and a
  bright double chime on the hit.
- **Upgrade inside the perfect-dash slow motion ("Counter-orbit"):** the crescent closes into a
  full vertical ring 2H across around the decoy point, with a second hit 10 f later.
- **Informed by:**
  - refs: 11's rising crescent at the top right (3.5x wide, 1.9x tall [M, REF-BREAKDOWN]); 10's
    low bowl sweep
  - Alice's dodge counter, which puts the personality into the counter rather than the dash
  - Endfield keeping the string alive through dodges [S, RESEARCH 1, 2.3]
- **Timing sources:**
  - Quaternius UAL2 "Sword Attack" (the rising cut)
  - MotionPackage Pro 剣's spear sweep (薙ぎ払う), if Dex buys it
  - 翡水's action set, BowlRoll 227022 (timing only)

**Other things out of the dash:** Q thrown from a dash keeps half the momentum, so the well opens
40 px further ahead. R out of a dash ends the dash at once.

---

### 2.4 Q Armillary, then Collapse

**Idea:** she flings the two rings off her glaive and they grow into a giant spinning armillary
sphere that drags enemies in and grinds them while she keeps fighting. Pressing Q again (or
waiting 2.5 s) makes it collapse: everyone floats weightless for a beat, then it bursts into a
ring shockwave 5H wide.

The pattern is taken from the newest kits: a second body does the work (Phrolova's Hecate), the
player builds the area and chooses when to set it off (Roxy's gathered tornadoes, Hiyuki's
charge), and the payoff lands after control is back (Flins). [S, RESEARCH 1]

**Cast:**

| Phase | Frames | Drawings | What happens |
|---|---|---|---|
| Anticipation | f1–14 | D1 glaive overhead (2) · D2 twirl smear 1 (2) · D3 twirl smear 2 (2) · D4 held coil (2, then hold 6) | the armillary rings spin up and glow; the sleeves drift up (lead flag); motes rise all around her |
| Throw | f15–16 | D5 throw smear (1) · D6 release (1) | the two rings leave the guard |
| Flight | f15–20 | (effect only) | the rings fly 110 px forward on a shallow arc |
| The well opens | f21–26 | (effect only) | a bloom on f21; the sphere reaches full size in 6 f, half of it in the first 2 |
| Her follow-through | f17–26 | D7 arm extended, sleeves whip forward (4) · D8 weight back (6) | |
| Recovery | f27–34 | D9 guard (4, then hold 4) | |

- **9 drawings, 34 f.** She can act again (M1, M2, jump, walk) from f30. Collapse is available
  from f28.
- **I-frames f6–16**, the committed part of the throw.
- **The sphere lasts 150 f from f21.** If she doesn't collapse it, it collapses on its own at
  f171.
- **Cooldown:** 8 s. While the sphere is up and during the cooldown, the rings are missing from
  her glaive, and they re-form out of motes when Q is ready. **The cooldown shows on the weapon
  itself, with no HUD.**

**The sphere** is centred 110 px ahead of her at y −86. It's made of:

- a vertical ring facing the camera, 173 px across (1.8H), from the floor to 1.8H up
- a flat equator ellipse, 384 x 32 px (4H wide), split into back and front halves
- a third ring tilted 60° that tips back and forth ±30° over 60 f
- a small "sun" at the centre, 7x7 px, pulsing on a 2-drawing cycle

Around it:

- **Pull:** enemies within ±192 px (4H) of the centre slide toward it at 0.6 px/f (0.3 px/f for
  heavy enemies), staying on the ground.
- **Opening hit:** the bloom on f21 hits everything inside the vertical ring once, with 2 f of
  hitstop.
- **Ticks:** enemies inside the vertical ring (x +24…+196, y −173…0, 1.8H x 1.8H) take a hit
  every 15 f from f30 to f150, timed to a gap in the ring sweeping past them. That's 9 ticks in
  all, each with 1 f of hitstop on the target only.

**Collapse (press Q again).** Her part is short. The sphere's timeline counts from the press,
t0 = f1.

| Frames | Her drawings | What the sphere does |
|---|---|---|
| f1–10 | D1 point the glaive at the sphere (2) · D2 close the fist (4, then hold 4) | **The float.** The rings contract to 30% of their size, slowly and then fast, and wrap into a spiral. Enemies within 5H lift 24 px off the ground with gravity off. Floor debris lifts too. The world dims one step toward indigo. |
| f11 | D3 release (6, f11–16) | **The burst.** A 1 f `invert` impact frame, then a white core disc 60 px wide for 2 f. The hit covers ±240 px from the centre (5H), y −250…0. **Hitstop 7 f.** Lifted enemies are slammed back down. |
| f12–25 | she can act from f14 | The vertical ring expands from 60 px to over 360 px (full screen height). The floor ring expands to ±240 px (5H) with tongues of light 10–40 px tall. Star marks link to the centre like spokes and burst 4 f apart. |
| f26–115 | | Floor scars (3 concentric ellipses) and 12 glyph ticks round the floor ellipse fade over 90 f. |

Collapse also works in the air. The burst hit is heavy with high stagger.

| Phase | Layer | Look and size | Colours |
|---|---|---|---|
| Anticipation | smears | twirl smears above her head: small circles 70 px across | S4/S3 |
| Anticipation | glow and particles | the armillary rings glow and brighten; the halo tips back; 8–12 motes rise | #eab64c → #fff0a6; S4 |
| Throw | projectiles | two gold rings, 12 px, each with a 40 px comet trail | gold ramp; S4 trail, 1 px |
| Well opens | flash | a disc 40 px wide for 1 f, then a ring pop 60 px wide for 2 f | S5, then S4 |
| Sphere | main rings | three rings with **gold bodies** (they're solid rings) and **azure energy bands** trailing along each ring's path | gold line and highlight; S3/S4 bands; back halves one step dimmer |
| Sphere | glyphs | 12 tick marks (1x3 px) round the equator, like an orrery scale | #fff0a6 |
| Sphere | particles | 12–20 stardust flecks spiralling inward: this is what sells the gravity well | S4/S5 |
| Sphere | ground | the equator's shadow on the floor, a 384 x 10 px band with ticks | S1, S3 ticks |
| Collapse, float | contraction | the rings shrink and their trails wrap into a spiral | as above, brightening |
| Collapse, burst | core flash | 1 f invert frame (full screen), then a 60 px white disc for 2 f | S5 |
| Collapse, burst | main ring | an expanding vertical ring (2 px band with an S5 leading edge) plus the floor ring with its tongues of light | S5/S4; tongues S4/S3 |
| Collapse, burst | slivers | 2 thin rings riding alongside each ring | S3/S2 |
| Collapse, burst | debris | 8 dark shards thrown outward; floor chips | S0/S1; world palette |
| Collapse, burst | constellation | spokes from each star mark to the centre, then bursts | S4 lines, S5 |
| Linger | ground decal | concentric orbit scars and glyph ticks, 90 f, 3 steps | #fff0a6 → S2 → floor-dark |
| Sphere | light | radius 200, intensity 1.2, flicker 0.1, 150 f. **It rims her from whichever side the sphere is on while she fights near it.** | S4 |
| Burst | light | radius 320, intensity 2.5, 30 f | S5/S4 |

- **Camera:**
  - cast: a 2 px push toward the throw
  - sphere: calm, no shake
  - collapse: the 10 f world dim, then a 3 px shake for 12 f fading as the square of its
    intensity. No zoom.
- **Sound:**
  - cast: a whirr rising in pitch (f1–14), then two bell "tings" as the rings leave (f16)
  - the well opens with a soft "fwumm" (f21)
  - the sphere holds a sustained glass-harmonica chord, with a soft chime on each tick, tuned
    to the key of the site's theme
  - collapse: a reverse swell during the float, 1 f of silence, then a huge bell strike with a
    sub-bass boom and a shimmering glass tail
- **Informed by:**
  - refs: 12's W (a ring around the body that becomes a spiked ring) and E (ground spikes); 11
    (the ground layer spreading wider than the arc); 08 (flash plus dark framing shards)
  - AAA: Roxy (the player gathers the area, then sets it off); Mavuika's "Rings of Searing
    Radiance" (rings that follow); Phrolova's Hecate (a second body fights); Flins (follow-up
    hits after control returns); RESEARCH's Q sheet (a 20–30 f wind-up, a 6–9 f hitstop, 3–5H
    wide, delayed hits) [S, RESEARCH 1, 3.3]
- **Timing sources:**
  - ジュウ's "twirl into attack", BowlRoll 62565 (the overhead twirl and throw; on-page terms
    allow modification)
  - Mixamo "Standing Melee Attack 360 High"
  - Quaternius UAL2 "Spell Simple Shoot" (the collapse gesture)
  - MotionPackage Pro 必殺技 "charge and release", if bought

---

### 2.5 R Zenith: the descent of the halo

**Idea:** time stops and the sky tears open into a night full of stars. Her own halo rises off her
head, comes back down 7H wide across the whole screen, and rains twelve pillars of light around
its rim in orbital order, before falling to the floor and crowning the battlefield.

- **Target: about 3.4 s until the player has control back (f207), and about 4.0 s until the
  last effect lands (f240).** RESEARCH measured whole ultimates at 3.4–6.5 s and suggests the
  short end for a web toy people trigger often. [S, RESEARCH 2.4, 3.3]
- **First big hit at f97.** Genshin ultimates take 93–109 f from press to damage. [M, RESEARCH
  2.1]
- **Invulnerable f1–206.** The world is frozen from f1 to f194, so enemies can't act.
- **Meter:** R needs a full meter, built up by landing hits. **The meter shows on her halo**: its
  three gaps close one at a time as it fills, and a complete halo means R is ready. No HUD.

**Beat sheet.** Frames are counted from the press. "World" means enemies and the level; she
keeps animating throughout.

| Frames | Beat | Her drawings | Screen and effects | Camera and light | Sound |
|---|---|---|---|---|---|
| f1–4 | **Freeze** | D1 snaps upright, glaive planted (4) | World time stops. The world darkens 100 → 60 → 35 → 25%, one step per frame, tinted indigo. She and her effects stay at full brightness. | The camera stops following and centres her. The black cinematic bars (CANON's presentation) thicken by 12 px each. | Music ducks 12 dB; a single high bell ping |
| f5–44 | **Cut-in** | D2 glaive raised to her chest (40) | A bust panel (about 160 x 90 native px, same pixel size, just a bigger drawing) slides in over 6 f, holds 28 f, slides out over 6 f. 3 drawings: eyes shut with the hair floating, eyes open gold, eyes flaring white-cyan. Starfield behind. **This is where the detailed face lives**, at the 07/08 level. | a gold rim from above on the panel | a choir inhale; a hair shimmer |
| f45–76 | **Invocation** | D3 swing up (2) · D4 thrust skyward (2) · D5 held on tiptoe with the glaive vertical (4, then hold 24) | Her head halo comes off at f49 and rises straight up, speeding up, trailing a gold line, until it leaves the top of the screen at f60. Hair rises and fans; every lining shows. | the gold top rim fades as the halo leaves | a rising glissando |
| f65–80 | **The sky opens** | D5 still held · D6 looks up (4, f77–80) | f65–68: a 1 px slit of white light 24 px from the top of the view stretches to full width. f69–76: it opens into an elliptical "eye", 560 x 70 px, showing a starfield (an S0/S1 base with stepped nebula bands, S4/S5 and a few #fff0a6 stars, and 1 px S2 constellation lines). f77–80: hold. | a 1 px rumble shake for 8 f | a deep rumble and a choir swell |
| f81–96 | **The halo descends** | D7 glaive brought down level overhead in both hands (2) · D8 braced, looking up (4, then hold 10) | The giant halo comes down through the slit: a gold ellipse 672 x 84 px (7H wide, 16 px past each screen edge), band 3 px thick with a highlight edge, 12 cross glyphs (7x9) round it like a clock face, and the same 3 gaps as her small halo. It drops from above the screen to its lock height (y 64 from the top) over 16 f, easing out, overshoots by 3 px and settles. | a gold light on the halo (radius 300, intensity 1.5) makes a strong rim across her top | a descending chord; clockwork ticking that speeds up (12 ticks) |
| f97 | **Lock (first hit)** | D9 snaps the glaive down and forward (1) | **A full-screen white flash for 2 f (f97–98), then 1 f of `mono` impact frame (f99).** All 12 glyphs light at once and the halo clicks 1/12 of a turn. Every enemy on screen takes a hit (6.7H x 3.75H), and each shakes 1 px while frozen. Star marks link up and burst. | 2 px shake for 6 f | a big bell "DONG" with a choir hit, then silence for 1 f |
| f98–159 | **The rain** | D10 settle (2) · then a 4-drawing loop, D11–D14 at 2 f each, of her twirling the glaive overhead in a flat orbit that matches the halo's turn: she's conducting it. | **12 pillars fall from the 12 glyphs in orbital order, one every 5 f (f100 to f155).** Layout in the table below. Each pillar: a column flash for 1 f running the full screen height (360 px, 3.75H); 3 f at full strength; then 17 f shrinking from full width to 8, 4 and 1 px (10's decay). It lands with a flat splash on the floor (60 x 10 px) and tongues of light 20–40 px tall, throws floor debris and stamps a cross-in-a-ring glyph that stays 120 f. The halo clicks 1/12 of a turn per pillar. **Pillars stop at the first platform top below the halo**, so the test map's platforms catch the light. | a 1 px rumble; each front pillar adds a 1 px bump. **Each pillar puts a light at its foot** (radius 90, intensity 2, 12 f) in gold/S4, so her rim flickers from whichever side the pillar lands: **the rim light orbits her.** | each pillar rings a bell one step higher in the theme's key, so the 12 make a rising arpeggio over 1 s, each with a thump; the choir sustains |
| f160–170 | **Coronation** | D15 raises the glaive (2) · D16 plunge smear (1) · D17 kneels with the glaive driven into the floor (4, then hold 32, f163–198) | She strikes the floor at f163, and **the halo lands 4 f after her strike**. That gap is the delayed payoff, like Fleurdelys's cut followed by the explosion [S]. The halo falls over f163–166, easing in as gravity comes back, stretched with 3 ghost copies above it, and flattens from 8:1 into the floor band as it lands. At f167 it hits the floor as a flat ellipse 672 x 16 px spanning the screen. **A full-screen white flash for 2 f (f167–168)**, a 1 px shock line across the whole width, and all 12 pillar positions erupt at once as 2 px columns for 4 f. A heavy hit to every enemy on screen. | a floor light from below (the fallen halo) | a sub-bass boom, a huge bell and glass shattering |
| f171–194 | **Total freeze** | D17 held | **Everything stops, effects included, for 24 f (0.4 s)** on a symmetrical composition: her kneeling at the centre, the halo ring round the floor, the pillars in cosine spacing on both sides. | none | silence |
| f195–206 | **Return** | D17 until f198 · D18 rises (6, f199–204) · D19 guard (2) | The world brightens 25 → 60 → 100% over f195–202. The slit in the sky closes (the opening in reverse). Motes spiral in and re-form her small halo above her head. | a 3 px release shake, fading; the bars recede | The music **fades back in over about 1 s** (CANON: music never starts abruptly [S]) with a swell of the theme |
| f207–240 | **Control returns; the aftermath** | the player can act; D19 is the start of guard | The 12 floor glyphs set off one by one in the same orbital order, one every 3 f from f201 (small pillars 20 px tall), mostly after control is back. The floor halo decal fades over 120 f. Stardust rises. | | a soft descending arpeggio |

**The pillar layout.** This is what makes the rain look like a ring of light seen from the side,
not a row of lasers.

- Each glyph sits at angle θ round the halo, where 0° is screen-right and 90° points toward the
  camera.
- Its x on screen is her x + 336·cos θ. Its depth is sin θ: pillars in front of her are drawn on
  the front layer and wider; pillars behind her go on the back layer, narrower and one step
  dimmer.
- Because x follows cos θ, the pillars bunch up toward the screen edges and spread out near her,
  the way columns in a ring look from the side.
- Every pillar's hitbox is 24 px wide, from the halo to the floor or platform, plus the floor
  splash (64 x 24 px), whatever its drawn width.

| # | Frame | θ | x offset | Depth | Layer | Drawn width |
|---|---|---|---|---|---|---|
| 1 | f100 | 180° | −336 | 0 | back | 11 px |
| 2 | f105 | 210° | −291 | −0.5 | back | 9 px |
| 3 | f110 | 240° | −168 | −0.87 | back | 8 px |
| 4 | f115 | 270° | 0 | −1 | back | 8 px: **lands right behind her, so for 6 f she's a dark silhouette with a gold rim on both sides (11's silhouette look)** |
| 5 | f120 | 300° | +168 | −0.87 | back | 8 px |
| 6 | f125 | 330° | +291 | −0.5 | back | 9 px |
| 7 | f130 | 0° | +336 | 0 | front | 11 px |
| 8 | f135 | 30° | +291 | +0.5 | front | 12 px |
| 9 | f140 | 60° | +168 | +0.87 | front | 13 px |
| 10 | f145 | 90° | 0 | +1 | front | 14 px: **lands on her and bathes her in light for 6 f**; her outline stays on, and she's the only thing it doesn't hurt |
| 11 | f150 | 120° | −168 | +0.87 | front | 13 px |
| 12 | f155 | 150° | −291 | +0.5 | front | 12 px |

The rain sweeps rightward along the back, then leftward along the front, so the eye follows it
round in a loop. When she faces left, the runtime mirrors x and the sequence mirrors with it.
Pillars 1 and 7 sit 16 px past the screen edges and are cut off by them, which is the point: the
ring carries on beyond the frame.

**Pillar cross-section:** a white-hot core 2–4 px wide (S5), then pale gold #fff0a6, then gold
#eab64c, then a 1 px gold #b8742f edge. Only the floor splash and the tongues of light use azure
(S4/S3). The two light families in R divide the work: **the halo's light is gold, and her own
energy is azure.** The pillar is also the only large area of gold in her whole kit, which
escalates it from Q (12's rule: each stage adds a layer [S]).

**Flash count:** full-screen flashes at f97, f99 (mono) and f167. That's at most 2 in any
60-frame window, under WCAG's 3. [S, RESEARCH 2.8; M, arithmetic] Pillar flashes are single
columns, 8–14 native px wide. At 3x that's 24–42 screen px wide, far smaller than a full-screen
flash, and only one or two flash at a time. Check it against WCAG's area threshold at real size
anyway. [I]

**Zoom:** by default, none. The cut-in panel stands in for the close-up and keeps one pixel grid,
as RESEARCH recommends. [S, RESEARCH 3.2] An A/B candidate: one integer zoom step (the contract
allows 1–2 [M]) from f45 to f80 on her face, then a **snap out at f81** as the halo descends.
Pulling in and then snapping out makes the 7H reveal feel wider.

**Optional A/B:** holding left or right during the rain steers the halo's centre by up to
±64 px at 1 px/f. That's player control inside the spectacle, like Hiyuki's hold [S]. It's off
by default to keep the ultimate simple.

**Afterwards, "Crowned" (720 f, 12 s).** Like Laevatain's 15 s and Fleurdelys's 12 s, the
ultimate changes her moveset for a while. [S, RESEARCH 1]

- Her head halo grows from 15 to 21 px and glows.
- **3 small rings (5 px) orbit her** on a tilted ellipse (60 x 14 px round her torso), passing
  behind and in front.
- **One ring leaves every 240 f, so the orbiting rings are the timer.** No HUD.
- **M1:** every hit calls down a small gold pillar (16 px wide, 1.5H tall) on the target 6 f
  later, for an extra hit.
- **Aphelion:** its floor ring drops 4 pillars at ±96 and ±192 px as it spreads.
- **Q:** the sphere gains a fourth ring, and Collapse rains 6 small pillars round the equator.
- **Transit:** the afterimages turn gold.

**Sources for R**

- refs:
  - 12's R: a ring, light pillars and a white ground splash round a darkened target
  - 08: a strike called down from the sky, with dark shards framing the core
  - 11: wide arcs and silhouettes lit only by the effect
  - 09: motif particles
- measured AAA [M, RESEARCH 2.4]:
  - **Laevatain's cutscene has a burning halo ring behind her** and a 0.8 s "beauty hold"
  - Fleurdelys: the world loses its colour, then the payoff arrives late
  - Alice: a total freeze of 0.23–0.43 s on a symmetrical composition
  - Skirk: a white impact frame on the last hit
  - HSR's Phainon: the ultimate takes over the whole stage
- timing sources:
  - Quaternius UAL2 "Spell Simple Enter/Idle/Shoot/Exit" (the invocation and conducting)
  - Quaternius UAL2 "Attack Ground Pound" (the coronation plant)
  - Mixamo "Great Sword High Spin Attack" (the overhead conducting twirl, flattened into a flat
    orbit)
  - CMU subject 88 (the tiptoe rise, timing)
  - 05 rows 11–12 (arm raised, then pointing forward; drawing counts for the invocation poses)

---

## 3. What makes her feel like a new Kuro, HoYo or Gryphline character

Measured against RESEARCH's list of what reads as "creative" in the newest kits:

1. **Second bodies do the huge hits.**
   - The armillary sphere (Q), the giant halo (R) and the Crowned satellites.
   - Her reach goes out to 7H while the sprite stays 96 px, just as Laevatain's summoned sword,
     Phrolova's Hecate and Cartethyia's sword shadows extend theirs. A generic pixel swordfighter
     only ever gets as wide as its blade.
2. **The ultimate changes the moveset.** For 12 s after R, every swing brings down light.
3. **The stage becomes hers.**
   - Time stops, the world dims, and the sky opens into a starfield **made of her own palette**:
     her hair and linings are that same night sky.
   - When the stage turns to night, it turns into her colours.
4. **The composition is the character.**
   - Every move is a ring round a centre.
   - The R ends on a symmetrical frame: her at the centre, the ring round the floor, the pillars
     in cosine spacing. That's Alice's symmetry and Laevatain's halo ring, done in 2D.
5. **Delayed payoff everywhere.**
   - Star marks build into a constellation that the finisher sets off.
   - Q goes off when you choose.
   - Pillars and glyphs keep landing after control is back.
6. **The player has control inside the spectacle.** You pick when Q collapses (Roxy, Hiyuki); R
   steering is an A/B option.
7. **Graphic abstraction, used sparingly:** 2–3 flash and impact frames per ultimate, capped for
   flash safety (Skirk, Fleurdelys).
8. **Rim light tells the story instead of acting as an outline.**
   - In the string, the rim follows the blade round her.
   - In R, it comes from above while the halo is overhead, and then **orbits her** as pillars
     land on alternating sides.
   - The backlit silhouette (pillar 4) and full bathing in light (pillar 10) are built into the
     geometry, not added on.
   - The measured close-ups all rim-light the character against a dark background, and Guilty
     Gear Xrd gives each character their own light. [S, RESEARCH 2.9]
9. **A timing signature, not even swings.** "Float, then fall" is the gravity and momentum Kuro's
   producer talks about [S, RESEARCH 1], turned into her personality. Every big move has a
   weightless hang before a snap.
10. **The costume performs.**
    - Night-sky linings flash in every flare.
    - The charms swing like moons.
    - The UI is part of the character: the halo's gaps are the R meter, the glaive's rings are
      the Q cooldown, and the orbiting rings are the Crowned timer. That fits CANON's
      "restrained world UI". [S]
11. **Depth in a flat view.** Front and back ring halves, orbits that speed up on the front pass,
    and pillars in cosine spacing make a 2D side view read as volume. The arcs of a generic pixel
    swordfighter are flat crescents on a single layer.

**What would make her generic** (the checks to watch in every A/B):

- the same crescent on every hit
- effects at 1H or less
- white effects on a white costume
- no ground layer
- evenly spaced in-betweens
- rings drawn on one layer
- a halo that just sits there like a hat

Every move here has its own geometry, so none of them should look the same:

| Move | Shape |
|---|---|
| M1-1 | open crescent |
| M1-2 | flat orbit |
| M1-3 | vertical wheel |
| M1-4 | orbit, then a floor ring |
| M2 | straight streak with a ghost halo |
| Slingshot | a U inside a crescent |
| Q | a three-ring sphere, then implosion and explosion |
| R | a giant ellipse with columns |

## 4. Build notes for the 3D-to-pixel route

- **Render in Blender:**
  - the body, costume and glaive, including the armillary rings, the head halo and the Crowned
    satellites
  - Rigid rings are where 3D pays off most: the render gets their perspective right at any tilt,
    and the depth pass says which half is in front of her, which is exactly the back/front split
    rule.
  - the normal pass, for the rim light
- **Draw by hand:**
  - the face for each facing
  - every smear (10's anatomy)
  - every large effect: the arcs, the big rings, the pillars, the starfield, the floor decals
  - the cut-in bust
  - The giant halo's turning is a 12-drawing cycle, one per glyph click, rendered from a 3D
    torus and then cleaned up.
- **Pre-draw large ellipses.** Draw them as sprites at a few set sizes, with hand-cleaned step
  sequences, rather than rasterising them at runtime every frame. A 1 px ellipse rasterised at an
  arbitrary size tends to get jaggies, which fails the rubric's cleanliness check. [I]
- **Blocking in the lab first.** The lab's existing effect kinds can stand in for every layer
  before the final art: arc, ring, pillar, burst, streak, disc, particles (spark, ember, mote,
  shard, feather, debris, dust), cracks, afterimage and group. [M: `src/lab/engine/vfx.ts`] The
  concentric orbit scars need a new decal; `cracks` draws jagged cracks.
- **Engine features this concept needs that the contract doesn't have yet** [M: read against
  `src/lab/contracts.ts`]:
  - effect entities that persist and carry their own hitboxes: the Q sphere, R pillars that land
    after control returns, the delayed star-mark bursts. Today hitboxes live only on her own
    animation frames.
  - a pull force (the Q gravity well)
  - a world darken or tint, plus a sky backdrop layer that can open (R). Today the contract only
    has `impact` in invert or mono.
  - hitstop on the attacker and target only; today's `hitstop` freezes everything
  - a clip that lives on the target and plays when the R lock hits (the frozen enemies' 1 px
    shake)
  - diegetic state on her sprite: the halo's gaps (the meter), the rings on her glaive (the
    cooldown)

## 5. Risks and open questions for Dex

1. **Glaive or sword?** This concept needs the glaive: orbits need a pivot and two ends. CANON
   currently says "the sword". [S]
2. **Height:** 96 or about 128 px? At 128, Q's 5H burst would fill the whole view and should
   drop to 4H (see 1.2).
3. **Floor rings in a flat side view.** The floor-band rule (a 10–16 px ellipse, like a drop
   shadow) is the compromise. A/B it against effects that stay strictly on the floor line.
4. **Ring fatigue.** Every move is ring-shaped, so each needs its own geometry (see the table in
   section 3). If critics say "it's all the same circle", cut M1-2 or M1-3 back to open arcs.
5. **Halo iconography is shared with the enemies.** 13's "THE END" wears a full red ring.
   [visible] Ours is gold, tilted and broken into arcs; check it against 13 at 1x.
6. **White against white.** Keep S5 to 1–3 px edges, and rely on the midnight linings and the
   #1b1530 outline to separate her during her own effects. Check pillar 10 (she stands inside
   the light) at real size.
7. **Hair ramp:** the spike's darker indigo or the lifted midnight ramp? A/B both at 1x next to
   13.
8. **Name:** there's no working name for her yet. The move names (Meridian, Retrograde,
   Perihelion, Aphelion, Transit, Slingshot, Armillary, Zenith) are placeholders taken from
   orbital mechanics.
9. **A story hook, not a decision.** CANON's candidate story, *The Registry*, has "a huge
   distant ring" left unexplained. [S: `CANON.md`] Her halo could rhyme with it. The story is
   open, so that's Dex's call.
10. **Pixel risk:** the 2 px shaft at diagonal angles and the 672 px halo band are the two parts
    most likely to shimmer. Both need checking in motion at real size, not in stills.
