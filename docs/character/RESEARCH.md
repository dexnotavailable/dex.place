# How the big action gachas stage their attacks, and how that survives as 2D pixel art

Research for the player character's M1 string, M2 dash, Q skill and R ultimate. It looks at
how the latest Kuro Games (Wuthering Waves), HoYoverse (Zenless Zone Zero, Genshin Impact,
Honkai: Star Rail) and Gryphline (Arknights: Endfield) characters stage their attacks. It then
turns what they do into timing numbers and rules for a 96 px character in a 640x360 view, and
covers how 3D-to-pixel pipelines (Dead Cells, Guilty Gear Xrd) deal with frame rate, holds,
outlines, normal maps and per-frame fixes.

Written 2026-09-28. "Latest" means as of that date: Wuthering Waves 3.6 (3.7 lands 30 Sept),
Zenless Zone Zero 3.2, Genshin Impact 7.1, Honkai: Star Rail 4.6, Arknights: Endfield 1.5.

Companions: `REF-BREAKDOWN.md` (what Dex's reference images measure), `QUALITY-RUBRIC.md` (the
A/B bar), `CRITIQUE-PARAMS.md`, `MOTION-SOURCES.md`. This file adds the one thing those say the
refs can't give us: **timing**.

Tags (the same ones the companion docs use):

- **[M]** measured: I counted it myself, either frame by frame from gameplay video or by
  reading numbers out of a community simulator's source code. "How the measurements were made"
  explains both.
- **[S]** sourced: an outside source says it. "Weak" means one unverified community post, a
  store blog, or sources that disagree.
- **[I]** inference: my reading or a proposal. Treat it as a claim to test in A/B.

Frames are written as `f` at 60 frames per second unless marked otherwise. 1 f = 16.7 ms.

## The short version

1. **The ultimates share one structure, whichever studio made them.** In the four I timed
   frame by frame, the game cuts to a close-up on a dark background with the character
   rim-lit. It spends 0.9–2.5 s on anticipation, lands on a full-screen white flash of 1–4
   frames, throws in black-and-white or two-tone "impact frames", often ends on a held pose
   or a total freeze of 0.2–0.8 s, then drops back into gameplay with the effects still
   running. Total length: 3.4–6.5 s. [M]
2. **The wind-up is long and the hit is short.** In Genshin's measured data, an ultimate
   takes 93–109 f (1.55–1.8 s) from button press to first damage. The last hits keep landing
   after the player has control back. [M, from the gcsim simulator]
3. **Basic attack strings build up rhythmically.** For swords and polearms, early hits land
   7–16 f (0.12–0.27 s) after the input. The finisher needs 29–35 f (0.5–0.6 s), freezes
   longer on impact (0.06 s against 0.02–0.03 s), and has the longest recovery. A full
   string takes about 2.7–3.0 s. Dead Cells' fast sword, a 2D example, follows the same
   pattern: five short hits of 0.12–0.25 s, then a 0.6 s finisher. [M, S]
4. **Hitstop is small and it adds up.** Genshin freezes the attacker for 0.02–0.15 s per
   hit, adds 0.06 s when the enemy can still flinch, and plays the attacker at 1% speed
   during the freeze rather than stopping them dead. Sakurai (Smash) describes the same trick:
   the attacker keeps creeping forward while the victim shakes. [S, M]
5. **"Wide" really is wide.** Genshin ultimates hit a 14 m circle or a 14 x 12 m box, about 8
   times the character's height. Laevatain's flame ring in Endfield spreads past the edges of
   the screen, more than 10 times her on-screen height. In our 640x360 view a 96 px character
   is only 6.7 heights wide, so an honest translation has R running off both edges of the
   screen and Q covering half the view or more. [M, I]
6. **What makes the new characters feel creative** is less about the swing and more about
   staging:
   - a **second body** does the huge hit (a summoned flame sword, a puppet, sword shadows)
   - the ultimate **changes the basic attacks** for the next 12–15 s, so the grand feeling
     outlasts the cutscene
   - the ultimate **takes over the whole screen or stage**
   - graphic abstraction: monochrome frames, speed lines, starbursts
   - geometric compositions tied to the character (Alice's symmetry)
   - player-controlled timing inside the spectacle (Hiyuki charges her ultimate while time
     is paused)

   [S, M, I]
7. **For our pixel version:**
   - Most of the grandeur carries over through the effect layers.
   - Close-up camera work does **not** carry over, because we can't zoom a 96 px sprite
     without breaking the pixel grid. Hand-drawn cut-in panels, a darkened stage, flash
     frames and the hitstop and shake numbers above should do that job instead.
   - Screen shake must use whole-pixel offsets with no rotation.
   - Monochrome impact frames are cheap to do: a palette swap. They need a flash-safety cap:
     the ZZZ ultimate I measured strobes about 3.8 times a second, and the web-accessibility
     rule (WCAG) allows at most 3. [I, S]
8. **The 3D-to-pixel route is proven.**
   - Dead Cells rendered 3ds Max animations at a character height of about 50 px, with no
     anti-aliasing, a per-frame normal map and a toon shader, at 30 fps. It built attacks
     pose to pose, adding frames before or after key poses and never between them, and used
     visual effects to sell the motion. The unsolved problem was flickering pixels.
   - Guilty Gear Xrd got its 2D look by switching off interpolation between keys entirely,
     re-posing and deforming the mesh on every key, hand-editing normals, giving each
     character its own light, and never using physics simulation.
   - Both of those rules apply to our Blender route. [S]

## How the measurements were made

**Frame-by-frame video timing [M].** I streamed public YouTube uploads of in-game footage in
an isolated headless Edge window on this PC and drew each video frame to a canvas in the page.
For every frame the script recorded:

- average brightness, which catches flashes and cuts to black
- the average change from the previous frame, which catches cuts, holds and freezes (a change
  of 0 means an identical frame)

It then assembled contact sheets, which I read by eye.

- All four uploads play at 30 fps, measured from the browser's own per-frame timestamps
  (33.3 ms apart). The games run at 60, so every time below is good to about ±1 captured
  frame (±33 ms).
- These are fan uploads. The inputs are unknown, so I can say when something appears on
  screen but not which button caused it.
- No video files were downloaded; the page streamed and the script read frames from memory.
  The contact sheets contain other people's game frames, so they live in the git-ignored
  `review/research/ult-measurements/` and never in the committed repo. The two small scripts
  are in `review/research/tools/`.

**Genshin frame data from gcsim [M, community].** gcsim is the open-source Genshin combat
simulator. Its character files hard-code frame counts that the community measured at 60 fps
with frame-stepped video:

- the frame each hit lands (the "hitmark")
- the earliest frame the next action can start (the "cancel")
- hitlag
- hitbox sizes in metres

I read them straight from the source for Skirk, Mavuika and Flins (`internal/characters/*/`
on the `main` branch, read 2026-09-28). KeqingMains' Theorycrafting Library (KQM TCL) documents
the method: counted at 60 fps with macros, and usually measured to the hitmark.

**Cross-check.** The video timing of Skirk's ultimate lines up with gcsim to within about 0.1
s: first hit 1.73 s after the cast on video against 1.82 s in gcsim, last hit 2.70 s against
2.63 s. That gives some confidence in both methods.

## 1. What the studios are actually doing

### Kuro Games: Wuthering Waves

**How the studio talks about it.**

- Producer Solon Lee says the fun of action games hides in tiny details: the "grip", how the
  animation swing feels, the sense of gravity and momentum. He names NieR and Devil May Cry 5
  as the games that shaped Kuro's combat, and Elden Ring as the push to take action into an
  open world. [S, fan translation of an interview]
- Much of the Wuthering Waves team came from Kuro's earlier action game, Punishing: Gray
  Raven. [S]
- A Game Developer analysis notes that the ultimates (Resonance Liberations) use camera pans
  and effects to show each character's fighting personality before the attack goes off, and
  that the basic attacks carry the same personality. [S]

**How an ultimate behaves.** A Resonance Liberation cuts to a short cutscene that **stops
time**, pauses challenge timers, interrupts whatever the character was doing, and gives a
moment of immunity afterwards. Players use it as a panic button and to skip recovery
animations. [S, community guide]

**Examples.**

1. **Cartethyia / Fleurdelys (2.4, Aero sword).**
   - Her first ultimate cuts her HP to 50% and transforms her into Fleurdelys, a taller adult
     form, for 12 s.
   - In that form the basic string gains a fifth hit. Stage 1 is a lunging impale, and stage
     4 can create a force field that roots enemies.
   - Her earlier attacks leave "sword shadows" on the field, which a plunge attack recalls
     for buffs.
   - The finisher, *Blade of Howling Squall*, deals Aero damage along a straight line in
     front of her. [S, kit text]

   **Measured [M]**, counted from the cut into the cinematic (timeline below): 5.4 s from
   cut-in to gameplay, and 2.54 s of anticipation before the first white flash.

   Why it reads as creative: the cut is shown as the world losing its colour. The damage
   (the colour explosion) lands later than the cut itself, so the eye gets the cut first and
   the payoff second. [I]
2. **Phrolova (2.5, Havoc, conductor).**
   - Her ultimate moves her into a corner of the screen, seated on a ring, while her puppet
     Hecate takes centre stage.
   - Her normal inputs now *cue* Hecate instead of attacking directly: attack, dodge, reset,
     and a "Curtain Call" finisher.
   - Musical "notes" cycle every 4 s and change what Hecate's attacks do. [S, community
     guides]
   - Why it's creative: the ultimate recomposes the screen and turns her into a puppeteer. A
     second body does the fighting. [I]
3. **Hiyuki (3.3, Glacio sword).** Hold the ultimate button and she drops into a charging
   pose. **The whole game pauses** while she consumes stored "Snowforged Blade" stacks one at a
   time. The strike fires when the button is released or the stacks run out. [S, community
   guide]
   - Why it's creative: the player controls timing inside the spectacle, and the charge
     reads as the most important moment. [I]
4. **Qingxiao (3.6, Aero sword) and Jingran (3.6, Fusion broadblade).**
   - Qingxiao's kit centres on two stances and sword-riding flight. Her ultimate is a
     multi-hit Aero burst that can be cast in mid-air.
   - Jingran's ultimate sacrifices HP (down to 50%) to enter a 15 s state. [S, thin
     pre-release and early-release coverage]
   - I didn't find a written description of either ultimate's visuals.

**Dodge.** The only frame data I found is one creator's test from launch (v1.0) [S, weak]:

- The dodge lasts 22 frames, 19 of them invincible.
- A perfect dodge adds 52 more invincible frames.
- Time slows starting on frame 10.
- The frame rate isn't stated and nobody has confirmed the numbers.

A store blog says the perfect-dodge slow-motion lasts about 1 s. [S, weak]

### HoYoverse: Zenless Zone Zero, Genshin Impact, Honkai: Star Rail

**What's documented.**

- HoYoverse runs an official video series, *Expert Challenge: Behind the Combat Design of
  Zenless Zone Zero*, covering Yuzuha and Alice (July 2025) and Ye Shunguang (December 2025).
  [S]
- The only written summaries come from a currency-reseller blog [S, weak]. They say:
  - Yuzuha's first concept, an umbrella-stab fighter, didn't land, so she was redone around
    candy-and-sweets explosions.
  - Alice's ultimate uses **centred camera angles** and sword-toss illusions to show off her
    symmetry obsession.

  My measurement of Alice's ultimate agrees on the symmetry and centring (below).
- The Genshin GDC 2021 slides list, as separate techniques [S]:
  - a dynamic lightmap for faces
  - separate render pipelines for characters and for scenery
  - artificially controlled shadows

  In short, characters get their own lighting.
- The Honkai: Star Rail talk at GDC is about game design, not animation. [S]

**Zenless Zone Zero.**

1. **Alice Thymefield (2.1, Physical sword).**
   - Kit [S, official skill text]:
     - five-slash basic string
     - three-level charged attack ("Starshine Waltz") that slashes in an area centred on
       the target
     - dodge ("Jumpy Bunny"), a quick dash
     - dodge counter: a slash and a kick
     - special: she hurls her blade through enemies
     - EX specials: a piercing thrust, or backing away with a slash and then thrusting
     - ultimate *Starfall Finale*: slashes over a large area ahead of her, with
       invulnerability
   - Beta footage showed her charged attack starting as a still stance, saber pointed
     forward, until a golden glint flashes at the tip, then exploding into a combo. She ends
     it by walking away. [S]
   - **Measured [M]** (full timeline below):
     - about 5–6.5 s from cut-in to the end of the final freeze
     - a 0.4–0.9 s run of abstract two-tone "impact" drawings, **animated on twos**: each
       drawing holds for 2 captured frames (67 ms) while the gameplay before and after
       changes every frame
     - 1.7–3.2 s of dead-straight slash lines crossing the whole screen from many angles
     - ends on a **total freeze of 0.23–0.43 s** on a symmetrical lattice of slash lines
       around her
2. **Yixuan (2.0, "Auric Ink").**
   - She fights with ink-made projectiles and birds, and uses talismans for movement.
   - Her chain attack is a dash, then an explosive wing burst.
   - Both of her ultimates spread her wings and send "countless talismans" at the enemy, and
     she is invulnerable throughout.
   - Her ultimate summons the Qingming Bird. [S, community guides]
   - Why it's creative: a motif (ink, wings, talismans) replaces a bigger swing, and the
     attack comes from many small bodies instead of one. [I]
3. **Roxy (3.2, Wind stun; the newest agent, banner from 30 Sept).** Holding her EX special
   creates a tornado. She can then gather the tornadoes on the field and set them off as one
   huge tornado. [S, community]
   - Why it's creative: the player builds the area of effect themselves before detonating
     it. [I]
4. **Systems that make ZZZ feel fluid.**
   - A **chain attack** triggers when a heavy hit (including the final hit of the basic
     string) lands on a stunned enemy. The player has a few seconds to pick which teammate
     follows up, and that teammate is invulnerable. Ultimates are invulnerable too. [S]
   - Enemy attacks are telegraphed with **coloured flashes**. Since 3.2, gold always means
     the defensive assist and red always means the evasive assist. [S]
   - A perfect dodge slows time. [S] Guides claim an 8–10 f window and 25–30 f of
     invulnerability. [S, weak: two near-identical texts from store blogs; one other source
     says the frame window depends on frame rate]

**Genshin Impact.** gcsim publishes hard numbers for Genshin, so it anchors most of section 2.

1. **Skirk (5.7, Cryo sword).**
   - Kit [S, official text]: her ultimate *Havoc: Ruin* "rips the space before her apart"
     with rapid consecutive slashes over an area. In her *Seven-Phase Flash* stance it
     becomes *Havoc: Extinction*, which boosts her next normal attacks and absorbs "void
     rifts" that teammates' reactions leave on the field.
   - gcsim [M]:
     - basic hits land at 13 / 7 / 8+22 / 11 / 35 f
     - stance attacks use boxes up to 11 x 6 m
     - ultimate hits at 109, 111, 114, 125 and 135 f, with the last at 158 f, inside a
       14 x 12 m box
     - the player can act again at 100 f
   - **Measured on video [M]:** 3.4 s from cast to gameplay, with a monochrome manga-style
     frame at the cast and a white impact frame at the final hit. One fan comparison video
     shows HoYoverse **revised the ultimate after beta** to add a radial fan of blades and
     the black-and-white impact frames. [M] I read that as HoYoverse buying more spectacle
     on a character that was already out. [I]
2. **Mavuika (5.3, Pyro claymore).**
   - Her skill either summons "Rings of Searing Radiance" that follow the active character,
     or summons the *Flamestrider*, a motorbike she rides.
   - Her ultimate launches her high into the air on the bike and brings down a downward
     *Sunfell Slice*. Afterwards her attacks hit harder for 7 s. [S, official text]
   - gcsim [M]: a single ultimate hit at 106 f, a 7 m-radius circle centred 2.5 m ahead,
     and control back at 116 f.
3. **Flins (6.0, Electro polearm, the closest thing here to a glaive).**
   - His ultimate unleashes the power of his lamp. There's an area hit, then "after a short
     delay" two middle-phase hits and a final one. [S, official text]
   - His special skill *Northland Spearstorm* hits the area ahead with a flurry of spears.
     [S]
   - gcsim [M]:
     - first ultimate hit at 93 f, middle hits every 9 f from 110 f, final hit at 155 f
     - a 7 m radius around him
     - the player can act again at 91–103 f
     - basic hits land at 11 / 11 / 16 / 20+29 / 29 f
   - Why it's creative: the delayed follow-up hits keep the screen busy after the player has
     already moved on. [I]
4. **Vesna (7.1, Anemo sword, the newest).** She leads a warband and can fly outside combat.
   Coverage of her combat visuals is still thin. [S]

**Honkai: Star Rail.** It's turn-based, so there's no dodge and no basic string worth copying.
It's still the extreme case for ultimates **taking over the stage**:

- Phainon (3.4) turns into *Khaslana* and deploys a Territory. His teammates leave the field
  and only he acts, for 8 extra turns ending in a final hit. [S]
- Castorice's ultimate summons a dragon, Pollux. [S]
- The newest character is Pearl (4.6, released today). [S]

### Gryphline: Arknights: Endfield

**Studio view.** In a June 2025 interview, the developers describe a full combat rebuild
into real-time combat with a tactical focus. Characters now dash to dodge. Each character's
"combo skill" has its own trigger, such as landing a crush, applying a status, or making
several enemies vulnerable. [S]

**Systems** [S, community guides]:

- All four squad members are on the field together and share three skill-point bars.
- **The basic attack string (4 or 5 hits) ends in a "Final Strike"** that builds stagger and
  restores skill points. Dodging or using skills does *not* reset the string.
- A basic attack in mid-air becomes a dive attack.
- Attacking a staggered enemy triggers a **Finisher**.
- Combo skills pop up as an icon when their condition is met.
- On keyboard, the skill is a press and the ultimate is cast by holding its button.
- A **red flash** telegraphs an enemy attack. A perfect dodge on it restores some skill
  points.
- Guides disagree on how many dodges chain before stamina runs out (2 or 3).

**Examples.**

1. **Laevatain (Heat, sword; launch character).**
   - Five-hit string, a dive attack, a finisher on staggered enemies.
   - Her skill summons a magma fragment that keeps attacking. At 4 stacks it sets off a
     large explosion.
   - Her combo skill makes "fire erupt beneath the feet" of burning enemies.
   - Her ultimate *Twilight* summons *Sviga Lævi*, her weapon, as a separate fire sword. For
     15 s it **strikes alongside every basic attack**, and the basic string becomes a
     four-hit string with huge area swings. [S]
   - **Measured [M]:**
     - The cutscene is 4.25 s, including an 0.8 s near-still "beauty hold" on her face with
       a burning halo ring behind her.
     - During the 15 s state, each swing leaves a flame arc on screen for about 0.5–0.8 s.
     - The string finisher is a **360° ring of fire that spreads beyond both edges of the
       screen in about 0.3 s** and lingers about 0.6 s.
     - She is about 80 px tall in a 450 px frame and the ring spans the full 800 px width,
       so it is **at least 10 times her on-screen height**.
     - The string cycles roughly every 1.7–2 s.
   - Why it's creative: the ultimate is a **summon plus a changed moveset**. The grandeur
     comes from 15 s of screen-filling basic attacks, not only from the cutscene. [I]
2. **Last Rite (Cryo, greatsword).**
   - Her combo skill encases the target in icicles, then shatters them.
   - Her ultimate *Vigil Services* covers her in frost armour and forms an **ice scythe**. She
     makes three slashes (400% / 400% / 800%) and is immune while they play.
   - Prydwen lists her long animations as a weakness. [S]
   - Why it's creative: a temporary weapon swap for the ultimate, and a last slash worth
     double. [I]
3. **Typhoeus (1.5, the newest, Nature, an archer with an Arts Unit).** Too new for any
   detailed visual coverage. [S]

### What reads as "creative" across all of them [I, built from the examples above]

1. **A second body does the huge hit.** Laevatain's fire sword, Phrolova's Hecate,
   Cartethyia's sword shadows, Yixuan's talisman swarm and bird, Last Rite's ice scythe.
   The reach grows far past the body without stretching the character.
2. **The ultimate changes the moveset for a while.** Fleurdelys for 12 s, Laevatain's
   *Twilight* for 15 s, Skirk's stance, Mavuika's bike, Phainon's Khaslana. The spectacle
   carries on into normal play.
3. **The screen or stage gets taken over.** Time stops (Wuthering Waves, ZZZ), the world is
   replaced by a void or a red backdrop (Laevatain, Skirk), the whole battlefield becomes a
   Territory (Phainon).
4. **Graphic abstraction at the moment of impact.** Black-and-white frames, a desaturated
   world, starbursts and speed lines. Three of the four ultimates I measured use them.
5. **Composition as character.** Alice's symmetrical lattice, the heraldic squares around
   Fleurdelys, Laevatain's halo ring.
6. **Delayed payoff.** The cut lands, then the explosion (Fleurdelys). A first hit, then
   follow-up hits after control returns (Flins, Skirk).
7. **Player control inside the spectacle.** Hiyuki's charge while time is paused, Alice's
   three-level charge, Roxy gathering her tornadoes.
8. **Colour-coded telegraphs** keep all this readable: ZZZ's gold and red flashes, Endfield's
   red flash.

## 2. Principles, with numbers

### 2.1 Basic attack string: rhythm and escalation

From gcsim. Times are in frames at 60 fps from each input. "Next" is the earliest frame the
next hit can start [M]:

| Character (weapon) | Hit lands at (N1 / N2 / N3 / N4 / N5) | Next hit allowed at | Freeze on hit (hitlag, s) | Full string |
|---|---|---|---|---|
| Skirk (sword) | 13 / 7 / 8+22 / 11 / 35 | 19 / 18 / 37 / 19 / 67 | 0.02 / 0.03 / 0.03 / 0.05 / 0.06 | 160 f ≈ 2.7 s |
| Flins (polearm) | 11 / 11 / 16 / 20+29 / 29 | 14 / 16 / 23 / 40 / 68 (end) | 0.02 / 0.02 / 0.03 / 0 / 0.06 | ≈161 f ≈ 2.7 s |
| Mavuika (claymore, on foot) | 21 / 14+26 / 28+33+39 / 30 | 31 / 42 / 46 / 60 | 0.09 / 0.05 / 0 / 0.10 | 179 f ≈ 3.0 s |

Dead Cells, a 2D reference, from its official wiki. Each figure is the time per hit [S]:

| Weapon | Per hit (s) | Full string |
|---|---|---|
| Balanced Blade (fast sword) | 0.15 / 0.25 / 0.12 / 0.22 / 0.12 / 0.60 | 1.46 s |
| Broadsword (heavy) | 0.60 / 0.75 / 0.90 | 2.25 s, damage 104 / 168 / 360 |
| Symmetrical Lance (spear, hits behind too) | 0.80 / 0.37 / 0.65 | 1.82 s |

What these add up to:

- **Early hits land 0.12–0.27 s after input** (7–16 f) for swords and polearms. [M]
- **The finisher needs about 2–3 times the wind-up** (29–35 f), gets the longest freeze, and
  has the longest recovery (58–72 f to walk). [M]
- **Rhythm alternates short and long.** Look at Skirk's "next" column (19 / 18 / 37 / 19 /
  67) and Balanced Blade (0.15 / 0.25 / 0.12 / 0.22 / 0.12 / 0.60). The gaps are uneven on
  purpose. [M, S]
- **Multi-hit steps** (Skirk N3 at 8 and then 22 f, Mavuika N3 at 28, 33 and 39 f) are how a
  single input fills the screen with more than one arc. [M]
- **The string survives other actions.** Genshin buffers the next input. Dashes, jumps and
  skills cancel the recovery. Endfield keeps the string alive through dodges and skills.
  [S] This is most of what "fluid" means in practice. [I]

### 2.2 Hitstop (the freeze on impact)

| Source | What it does | Numbers |
|---|---|---|
| Genshin (KQM TCL, gcsim docs) [S, M] | Only the **attacker** freezes; enemies and the world keep going. During the freeze the attacker plays at 1% speed (sometimes 5%), so it looks frozen without fully stopping. | Sword N1/N2 0.03 s; claymore charged finisher 0.15 s; bow headshot 0.12 s. Add **+0.06 s** against an enemy that can still flinch. Frames = round up((freeze + 0.06) x fps) |
| Sakurai, Smash (Famitsu column, translated) [S] | **Both** fighters freeze. The victim shakes during the freeze: sideways on the ground, up and down in the air. The attacker creeps forward too slowly to see, then snaps back. Freeze length scales with damage, is tuned per move (Marth's sword tip gets extra, projectiles get less) and has a hard cap. Electric hits get extra. | no frame numbers published |
| Sakurai video "Stop for Big Moments!" [S] | Use freezes and slow motion beyond hits. A short burst of slow motion that returns to full speed hits harder than a long one. | none |
| deepnight "Game feel" demo (open source, by Dead Cells' lead designer) [S] | Stops the whole game for a short moment. | `stopFrame` = **4 frames** |
| Hollow Knight, preset freezes, as mirrored by the WeaverCore modding toolkit [S, weak: a mod's copy, not the shipped game] | Slows time down to a target speed, holds, then eases back up. Each row reads ramp-down / hold / ramp-up at target speed. | 0.04 / 0.03 / 0.04 s at 0 (a micro-freeze); 0.01 / 0.25 / 0.10 s at 0; 0.01 / 0.35 / 0.10 s at 0; 0.25 / 2.0 / 0.25 s at 0.15 speed (long slow-mo) |
| Street Fighter 6 [S, weak: trailer analysis before launch] | Freeze scales with button strength. | about 10 / 12 / 14 f for light / medium / heavy |

Rule of thumb: normal hits freeze for 2–5 f, the string finisher for 6–9 f, big skills for
about 0.1–0.15 s, and anything longer only for special moments. The attacker should drift
rather than stop dead. [I, from the numbers above]

### 2.3 Dash and dodge (M2)

| Game | Total | Invincible frames | Extras | Tag |
|---|---|---|---|---|
| Genshin dash | about 20 f (varies ±13 by character) | from about frame 3 to about 24–25 (about 0.37 s) | a cooldown kicks in after consecutive dashes (0.8 s window) | [S, KQM measured] |
| Wuthering Waves dodge | 22 f | 19 f; +52 f on a perfect dodge | slow-mo starts about frame 10 | [S, weak] |
| ZZZ dodge / perfect dodge | — | window about 8–10 f; 25–30 f invincible | slow-mo on a perfect dodge; dodge counter follows | [S, weak] |
| Endfield dodge | — | — | costs stamina; 2–3 in a row; perfect dodge restores skill points; doesn't break the string | [S] |
| deepnight demo dash | — | — | camera nudge of 6 px in the dash direction, zoom nudge of +0.03, **0.4 s of slow motion at 0.8x**; squash to 0.55–0.66 on jumps | [S] |

Alice's dodge is plainly a "quick dash dodge", and her dodge counter is a slash and a kick.
The personality goes into the counter, not the dash itself. [S] (One weak summary of the
developer video describes the kick as a bunny-like back-kick.)

### 2.4 Ultimate cinematic: phase by phase

All four measured [M]. Times are seconds from the cut-in, captured at 30 fps (±0.033 s).

**Laevatain (Endfield)**, 4.25 s total:

| Time | What happens |
|---|---|
| 0.00 | Hard cut from gameplay to a tight close-up on a black-red backdrop |
| 0.05–0.75 | Flames wrap around her |
| 0.75–0.85 | Hand gesture; a thin horizontal flame line |
| 0.94–1.04 | Flame whiteout: peaks over about 3 frames, fades over about 0.2 s |
| 1.15–2.3 | Medium shot: the fire sword appears, a burning halo ring behind her |
| 2.44–2.61 | Swing fills the screen (second flash) |
| 2.74 | 1-frame flash cut |
| **2.80–3.60** | **Near-still hero close-up, 0.8 s** |
| 3.70–4.07 | Wide shot, fade to near-black |
| 4.25 | Back in gameplay with the enhanced moveset |

**Alice (ZZZ)**, about 5–6.5 s total. Two casts are in the same upload and they differ.

Cast A (swimsuit outfit):

| Time | What happens |
|---|---|
| 0.0–2.2 | Close-up sword ritual on a dark background, strong warm rim light on her hair and body |
| 2.2 | Sword-point glint |
| 2.4–2.7 | Two-tone impact drawings |
| 2.8 | Wide shot with a vertical light pillar and a radial zoom blur |
| 3.0–4.7 | Screen-crossing straight slashes |
| 4.8 | Bloom flash |
| **4.98–5.18** | **Total freeze (0.23 s)** on a symmetrical lattice |
| — | Gameplay |

Cast B:

| Time | What happens |
|---|---|
| (to 0.87 s) | Insert of **12 two-tone drawings, each held 2 captured frames (67 ms)**; the last, a whiteout, holds 4. White, black, white, black, white: about 3.8 flashes a second |
| next 3.2 s | Screen-crossing slashes |
| then | Bloom |
| **end** | **Total freeze of 13 captured frames (0.43 s)** |

**Fleurdelys (Wuthering Waves)**, 5.4 s total:

| Time | What happens |
|---|---|
| 0.0–0.3 | Camera sweep with glowing square heraldic sigils |
| 0.35–1.2 | Low-angle hero shot, sword raised, wind gathering (the anticipation) |
| 1.26 | Close-up of her eyes |
| 1.33–1.47 | Near-black frame with a thin blade glint |
| 1.55–1.8 | Vertical ring slash |
| 1.85–2.3 | Fan of red-violet blade lights |
| **2.54** | **1-frame full white flash** |
| **2.55–3.4** | **Pure black-and-white graphic frames** (white slash shards on black), dimming |
| 3.44–3.54 | Whiteout |
| **3.56–4.11** | **Grey, colourless world with the cut line through it (0.55 s)** |
| 4.14–4.24 | White 2 frames, then black 2 frames |
| 4.27 | Colour returns as a blue explosion along the cut line |
| to about 5.4 | Effects linger, then gameplay |

**Skirk (Genshin, revised version)**, about 3.4 s total:

| Time | What happens |
|---|---|
| 0.00–0.06 | Black-and-white manga speed-line frame at the cast |
| 0.2–0.67 | Slow establishing shot of a crystal streak tearing across a dark void |
| 0.7–1.6 | Close-up drawing her blade, white rim light on her hair |
| **1.73** | **White flash = first hit** (gcsim: 1.82 s) |
| 1.8–2.2 | Crossed slashes |
| 2.4–2.6 | Radial blade fan around a dark core |
| **2.66–2.73** | **White impact frame with black ink splatter = last hit** (gcsim: 2.63 s) |
| 2.8–3.4 | Shards fly as the gameplay camera returns |

**What the four share** [M, interpretation I]:

| Beat | Range measured |
|---|---|
| Cut-in | hard cut; the world goes dark (black, red or a void) and the character is rim-lit |
| Anticipation to first big flash | 0.9 s (Laevatain) to 2.5 s (Fleurdelys); Genshin's press-to-damage is 1.55–1.8 s |
| Flash | 1–4 captured frames (33–133 ms) of near-white full screen |
| Impact frames | 3 of 4 use black-and-white or two-tone graphic frames, 0.1–0.9 s in total, often in 2-frame holds |
| Hold or freeze | 0.23–0.8 s near-still or fully frozen at the end (Laevatain, Alice) |
| Return | effects still live, or a changed moveset takes over |
| Total | 3.4–6.5 s |

In gameplay terms: Wuthering Waves stops time and pauses challenge timers during the cutscene
[S]. ZZZ ultimates and chain attacks are invulnerable [S]. In Genshin the player can act again
before the cinematic ends: Skirk at 100 f, with her last hit at 158 f [M].

### 2.5 How big the area is

Genshin hitboxes from gcsim, in metres [M]. Fan measurements put adult models at about 1.6–1.9
m tall; HoYoverse doesn't publish heights. [S, weak]

| Attack | Shape | Size compared with a ~1.75 m character [I, arithmetic] |
|---|---|---|
| Skirk basic hits | circles of radius 2–3.2 m; boxes 2.5 x 3.5–6 m | about 2.3–3.7x across |
| Skirk stance hits | boxes 5–11 m wide x 3.5–6 m deep | up to about 6x |
| Skirk ultimate | 14 x 12 m box, 5 m ahead | about 8x |
| Mavuika / Flins ultimates | circles of radius 7 m | about 8x across |
| Laevatain string finisher (video) | ring past both screen edges | at least 10x her on-screen height [M] |

The companion docs set a floor from Dex's refs: M1 at least 1.5x, M2 at least 2x, Q at least
3x, R at least 4x up to the full view. The studios run well above that. See 3.2.

### 2.6 Screen shake

- **Eiserloh, GDC 2016** [S]:
  - track a "trauma" value from 0 to 1 and shake by trauma squared (or cubed), so small bumps
    barely register and big ones kick hard
  - drive the offsets with smooth noise, not random jumps
  - in 2D, shake position *and* rotation
  - a public example based on the talk lets trauma decay at 0.5 per second and caps rotation
    at 10°
- **deepnight demo** [S]:
  - shake offset = 2.5 game pixels x power, fading as the timer runs out
  - examples: 0.1 s at power 0.2 (a gunshot), 0.6 s at power 0.8 (a heavy landing)
  - separate camera "bumps" of 2–10 px that die off by 15% per frame, and zoom bumps of
    +0.03 that die off by 10% per frame

### 2.7 Slow motion

- **deepnight demo** [S]:
  - default slow-mo speed is 0.3x; the dash uses 0.4 s at 0.8x
  - the game **drops into slow motion quickly** (it closes 60% of the gap each frame) and
    **eases back out** (20% per frame)
- **Sakurai** [S]: keep slow motion brief and return to full speed; brief is what makes it hit
  harder.
- **Katana Zero** [S]:
  - slow-mo is a limited, recharging resource
  - the music slows down with the world, because the designer imagined the soundtrack
    playing in the hero's head
- **Wuthering Waves and ZZZ** use slow motion as the reward for a perfect dodge. [S]

### 2.8 Impact frames and flashes

- **Definition** [S]: sakuga (fan animation) references define "impact frames" (shock
  frames) as special drawings that flash for a split second, usually monochrome or with
  stylised colour, to make an impact land. They're a limited-animation technique: they
  replace in-betweens rather than adding them.
- **Where they show up** [M]: the measured ultimates place them exactly on the cast and on
  the hits (see 2.4).
- **Flash safety** [S, I]: the web-accessibility rule (WCAG 2.3.1) allows at most 3 flashes
  in any one second, unless the flash is small or dim enough to stay under its thresholds. A
  full-screen white-black strobe isn't. Alice's insert runs at about 3.8 a second (white,
  black, white, black, white in about 0.53 s).

### 2.9 Light: the character gets its own

- **Guilty Gear Xrd** [S]:
  - no global light on characters; **each character has its own light direction**, chosen
    to light their idle pose best
  - in battle it stays fixed; in cutscenes it's animated with the character, frame by frame
- **Genshin** [S]: separate render pipelines for characters and scenery, plus a dedicated
  dynamic lightmap for faces.
- **What the measured cinematics show** [M]: every close-up puts the character on a dark
  background with a strong rim light (warm on Alice, white on Skirk's hair, flame-lit on
  Laevatain). The rim light is the cinematic's main light.
- **Unity's 2D pixel-lighting course** [S]:
  - rim light is especially useful in pixel art because it picks out the silhouette
  - Unity has no built-in 2D rim light, so it has to be built
  - generated normal maps are usually too detailed for pixel art

### 2.10 Limited animation and holds

- **Guilty Gear Xrd** [S]:
  - "full animation" (interpolated keys) looked 3D, so they switched interpolation off
    entirely
  - every frame is a hand-posed key, like stop motion
  - each character has about 500 bones
  - scale is keyed heavily for squash, stretch and exaggeration
  - the mesh is deformed on every key to break perfect perspective
  - **no physics simulation**, because it "just doesn't look 2D"
- **Dead Cells** [S]:
  - key poses first
  - once the timing works with as few frames as possible, frames are added **before or after
    the key poses, never between them**
  - visual effects carry the sense of motion, impact and strength
- **ZZZ** [M]: Alice's impact insert is animated on twos (67 ms per drawing) while the
  gameplay around it runs on ones. Measured on a 30 fps capture of a 60 fps game, so "twos"
  here could be "fours" at 60.

## 3. The 2D translation: 96 px character in a 640x360 view

### 3.1 The geometry we're working with [M, arithmetic]

- The character is 96/360 = **27% of the view height**.
- The view is **6.7 character heights wide** and **3.75 tall**.
- Dead Cells' characters were about 50 px tall [S], so we have almost twice their pixels per
  character: more room for a readable face and costume, and more pixels that can flicker.
- There's no camera orbit and no depth, so anything the 3D games do by moving the camera
  (close-ups, low angles, the establishing shot of a void) has to become 2D staging.

### 3.2 Principle by principle: what survives and what changes

| Principle | Survives? | What has to change at 96 px / 640x360 [I unless tagged] |
|---|---|---|
| String rhythm (2.1) | Yes, directly | Use the timings as they are. They're about time, not pixels. |
| Multi-hit steps | Yes | Draw each sub-hit as its own arc. A 3-arc step at 96 px is still very readable. |
| Hitstop (2.2) | Yes | Freeze the attacker and the enemies hit, with Sakurai's shake on the victim (1 px sideways alternation on the ground, up and down in the air). Let effects and other enemies keep moving, as Genshin does, so the screen never looks dead. Whole-pixel shake only. |
| Attacker drift during hitstop | Partly | At 1% speed the drift is sub-pixel, and sub-pixel movement shimmers in pixel art. Hold the contact drawing instead; that's what a held drawing is for. |
| Screen shake (2.6) | Changed | No rotation: rotating pixel art breaks the grid. Translate only, in whole pixels, 1–4 px at 640x360, with deepnight's 2.5 px x power as a starting point. Keep trauma-squared for how big a shake gets. |
| Zoom bumps (2.6) | **No** | A non-integer zoom (1.00 to 1.03) resamples every pixel and shimmers. Swap it for a 1–3 px camera push in the attack direction plus a darkened background or vignette. |
| Close-up camera in the ultimate (2.4) | **No, replace it** | We can't zoom a 96 px sprite without breaking the pixel grid. Use (a) a **hand-drawn cut-in panel**: a bust at native pixel density, larger than the sprite, sliding in over a darkened, frozen stage (the fighting-game super-move pattern), or (b) a whole-view 2x integer zoom for only a few frames. Option (a) keeps one pixel grid, which the rubric requires. |
| Time stop and darkened stage (2.4) | Yes, and it's cheap | Freeze everything but R, drop the background to about 20–30% brightness or a palette tint, and keep the character and effects full-bright. |
| Flash frames (2.8) | Yes | A 1–2 frame full-screen near-white palette swap on the hit frame. |
| Monochrome impact frames (2.8) | Yes, and cheap in pixel art | A palette swap to 2 tones (character and effects white, world black, or inverted) for 2–4 frames at 60, or on twos for up to about 0.5 s. **Cap it at 3 flashes per second** (WCAG) and add a "reduce flashing" setting for the web. |
| Desaturated world beat (Fleurdelys) | Yes | A world-palette swap to greys for 0.3–0.5 s while the cut line stays full colour, then colour returns as the explosion. |
| Held final pose or freeze (2.4) | Yes | 0.25–0.5 s with the whole screen still. At pixel scale a hold reads even more clearly than in 3D. |
| Area width (2.5) | Yes, but it overflows | 3D ultimates are at least 8–10x character height, and our whole view is 6.7x. So: M1 arcs 1.5–2.5x (150–240 px), M1 finisher 3x (about 290 px), M2 trail at least 2x, Q 3–5x (290–480 px, half to three quarters of the view), and **R should run off both edges** (at least 640 px), plus a full-height vertical element (360 px, 3.75x). This raises the companion docs' Q floor from 3x toward 4–5x. |
| Ground ring seen from above | Changed | Seen from the side, Laevatain's ground ring becomes a **floor band**: a strip 4–12 px tall along the floor line spreading outward, with **vertical flame tongues** rising from it. Ground decals and dust carry the width; vertical pillars carry the height. |
| Lingering effects | Yes | Each arc stays up 0.3–0.8 s and overlaps the next swing (Laevatain). That's how a 96 px character "fills the screen" during an ordinary string. |
| Second body (1) | Yes, and it's the strongest tool | A large apparition layer, such as a ghost glaive or a halo-blade 2–4x character height, drawn in the effects pass, can deliver the huge hit while the sprite stays 96 px. For the priest outfit: a giant halo blade or cross-shaped blade of light. |
| Ultimate changes the moveset | Yes | After R, M1 becomes an enhanced string for about 10–15 s with wider arcs and a floor-band finisher. |
| Rim light (2.9) | Yes, via normal maps | Give the character her own light direction, as Guilty Gear does. The rim goes on the lit side only, 1 px (2 on broad shapes), in the effect's colour while a move is active (the rubric's section 11). During R, the darkened stage makes the rim the main light, as in the measured close-ups. |
| Telegraph colours | Yes | Enemies are red, black and white (ref 13). Our effects need a different identity colour; gold and white plus a second colour is still an open question in the companion docs. Reserve one flash colour for enemy tells. |
| Limited animation (2.10) | Yes, it's native to pixel art | See 4.4. |

### 3.3 Starting timing sheet for our four moves

[I, derived from the numbers in section 2; every line is a first A/B candidate, not a
decision. Frames at 60 fps game time.]

**M1: basic string, 4 hits plus a finisher.**

| Hit | Wind-up to contact | Hitstop | Next input allowed | Effect width |
|---|---|---|---|---|
| 1 | 8–10 f | 3 f | about 16 f | 1.5–2x |
| 2 | 6–8 f | 3 f | about 16 f | 1.5–2x |
| 3 (two arcs) | 8 f and 20 f | 3 + 3 f | about 30 f | 2–2.5x |
| 4 | 8 f | 4 f | about 18 f | 2x |
| Finisher | 28–32 f, with a held coil pose of 6–8 f | 7–9 f | recovery about 60 f, dash-cancellable from about 20 f after contact | 3x plus a floor band |

- Full string about 2.5–2.8 s.
- Effects on each hit linger 0.3–0.5 s.
- M2 cancels any recovery **without** resetting the string.

**M2: dash.**

- About 20 f total, invincible from frame 3 to about 20.
- 3–4 afterimages, dust at start and end, a 3–6 px camera push, no zoom.
- A perfect dash (enemy attack inside the window) triggers slow-mo at 0.3x for about 0.5 s:
  snap in fast, ease out. It also opens a dash-counter slash that keeps the string.

**Q: skill.**

- Wind-up 20–30 f, with light gathering and a 1–2 frame flash on contact.
- 6–9 f hitstop.
- Shake around trauma 0.5 (about 2 px) for 0.2–0.3 s.
- Main effect 3–5x wide with a floor band. Delayed secondary hits at +10–20 f keep the screen
  busy.

**R: ultimate, target 3.5–4.5 s.** Towards the short end of the measured 3.4–6.5 s, because
this is a web toy people will trigger often.

| Time (s) | Beat |
|---|---|
| 0.0 | Freeze the stage, darken the world, cut-in panel slides in |
| 0.0–1.5 | Anticipation: halo or apparition blade assembles, rim light rises |
| 1.5 | 1–2 frame white flash, first hit |
| 1.5–2.0 | Two-tone impact frames, 3 flashes per second at most |
| 2.0–3.0 | Screen-spanning slashes / floor band / pillars (full width, full height) |
| 3.0–3.4 | Held final composition |
| 3.4+ | Colour and control return while the last hits and the effects play out; enhanced M1 for 10–15 s |

## 4. The 3D-to-pixel pipeline: technique notes

### 4.1 Dead Cells (Motion Twin, 2018) [S]

- **Why they did it:** one artist doing style, characters, backgrounds, animation and effects
  couldn't hand-draw every retake in time. 3D made retakes a matter of moving keys.
- **Model:** built in 3ds Max over a 2D pixel-art model sheet, with a skeleton, exported as
  FBX. Model detail was kept low on purpose, because the character is only about 50 px tall
  in game.
- **Render:** a small in-house tool renders each frame **very small with no anti-aliasing**,
  and that's the pixel look. Every frame is exported as a PNG **with its own normal map**, so
  the game can light the sprite with a basic toon shader.
- **Frame rate:** animations run at **30 fps**.
- **Animation:** pose to pose, on key frames like 2D animation. Once the timing works with the
  fewest frames, frames are added **before or after** the keys, **never between** them.
  Effects provide the sense of movement, impact and strength.
- **Reuse:** animations move across characters, and armour or weapons attach to existing
  models instead of being redrawn. The developers say this saved hundreds of hours.
- **Known limits:**
  - **flickering pixels were never solved**; hand-cleaning was rejected because the whole
    point was speed
  - less surface detail than hand-drawn pixel art
- **Recreations:**
  - Dan Moran's "Makin' Stuff Look Good" case study and its `PixelArtPipeline` project
    (Unity) rebuild the toon-lit sprite approach
  - one indie developer found it cleaner to render colour and normals as two separate frames
    than to pack them into one texture

### 4.2 Guilty Gear Xrd (Arc System Works, GDC 2015) [S, from the handout]

- **The principle:** kill everything that looks 3D. The maths in a shader is always "correct",
  but correct isn't good enough; every shade on screen has to be the artist's choice.
- **Shading:**
  - a simple step function: lit or unlit
  - a vertex-colour channel shifts the lit/unlit threshold per vertex, and 0 means always in
    shadow
  - **each character has its own light direction**
  - **hand-edited normals on every major feature**, especially faces
- **Colour:** each material has two flat colour lookups, one for lit and one for the shadow
  tint. Shadows are chosen per material (skin shadows lean red); they aren't the lit colour
  multiplied darker. Almost no detail is painted into textures.
- **Lines:**
  - outer lines are an inverted hull (a slightly larger, darker copy of the mesh drawn behind
    it), with vertex colours controlling width and hiding lines where needed
  - inner lines come from a UV trick that keeps them crisp at any distance
- **Animation:**
  - no interpolation at all; every frame is a hand-posed key ("stop motion")
  - about 500 bones per character
  - heavy scale keys
  - **the mesh is deformed on every key** to break perfect perspective
  - "think in 2D"
  - **no physics simulation**
  - camera cuts and swings are reserved for supers and finishes
- **Frame rate:** the game runs at 60 fps, but the handout doesn't say how many frames each
  pose is held. Forum claims of "about 24 fps" for Dragon Ball FighterZ are unsourced, so I
  haven't used them.

### 4.3 Other 2D-look pipelines worth knowing [S]

- **The Last Faith:** its bosses were modelled, rigged and animated in 3ds Max, then given
  **two manual pixel-art passes with no shaders**, so the big bosses kept their size and
  weight. At least some regular enemies were hand-animated in Aseprite.
- **Skul: The Hero Slayer:**
  - hand-animated in Aseprite and imported into Unity
  - Unity's Pixel Perfect Camera keeps motion stable at any resolution
  - defeated enemies shed armour and weapon "parts" with their own weight and spin
  - each skull has a special attack that fires *on swap*, much like Wuthering Waves'
    intro skills
- **Blasphemous:** hand-drawn pixel animation. The lead animator's published time-lapses show
  new frames made by reworking existing ones for fast iteration, and impact effects drawn as
  their own pieces. No frame rates are published.
- **Nine Sols:** hand-drawn sprites and anime-style environments, iterated "countless" times.
  The community-measured parry windows: a press within 0.133 s (about 8 f) before a hit is a
  precise parry, and up to 0.5 s early is an imprecise one. Mashing shrinks the precise
  window. Perfect parries play the cymbal clash from Chinese opera.
- **David Holland's 3D pixel-art renderer:**
  - renders at **640x360**, the same as ours
  - 1 px outlines from depth and normal edge detection, using only the four neighbouring
    pixels; highlights only on convex edges
  - to stop pixels "creeping" as the camera moves, the camera **snaps to a pixel-sized grid**
    and the final image is shifted back by the snap error
  - snapping only works for orthographic cameras; a perspective camera can't be fully
    stabilised this way
- **Blender Studio's 3D pixel-art tests** (Blender 4.2): EEVEE with a Bayer dither and a
  constant-interpolation colour ramp. The compositor's pixelate node anti-aliases edges, which
  makes it unsuitable.

### 4.4 Frame rate and holds for our route [I, from 4.1, 4.2 and 2.10]

- **Author at 30 fps** (Dead Cells' rate), played back in a 60 fps game loop. Most drawings
  are held for 2 game frames; smears and flash frames get a single frame.
- **No interpolated in-betweens between key poses.** Add anticipation and settle frames
  around the keys (Dead Cells' rule). Hold contact and coil poses for 3–8 game frames.
- **Hand-key hair, sleeves, tabard and garter charms** instead of simulating them (Guilty
  Gear's rule). Lag them 1–2 drawings behind the body (the companion docs' secondary-motion
  rule).
- **Deform per key where the silhouette needs it:** a longer glaive on the smear pose, a
  bigger sleeve flare on the contact pose (Guilty Gear's per-key imperfection). Blender's
  shape keys and scale keys can do this on the render rig.

### 4.5 Normal maps and rim light [I, from 4.1, 2.9, and Unity and GDQuest docs]

- **Export a camera-space normal image for every frame** alongside the colour frame, as
  Dead Cells did. In Blender that means transforming the shading normal from world to camera
  space, packing it into 0–1 colour, and writing it to its own output (an AOV) rendered with
  the same no-anti-aliasing settings. Not tested here; the spike should prove it.
- **Quantise the normals to a handful of directions per material.** Generated normals are
  too detailed for pixel art (Unity Learn), and a smooth normal gives a smooth rim, which the
  rubric fails.
- **In game:** light the sprite with the character's own light direction (Guilty Gear), plus
  one rim term along silhouette pixels whose normal faces away from the camera toward the
  effect's light. Step it to 1–2 palette colours. It's driven by the active move's colour and
  timing.
- **An engine fallback without normals:** shift the sprite's silhouette mask 1 px against the
  light direction and subtract it to find the lit edge. This is cruder, but it's a useful A/B
  baseline.

### 4.6 Outlines [S, I]

The options, in the order I'd test them:

1. **Inverted hull in Blender**, with vertex-colour width control (Guilty Gear). It gives the
   most control per area and shows in the viewport.
2. **1 px edge detection from depth and normals** after the low-resolution render (Holland).
   It's always exactly 1 px, which matches the rubric's 1 px tinted outline.
3. **Freestyle.** It's easy, but it adds anti-aliased lines to clean up afterwards.

Whatever renders the line, it gets recoloured to the tinted near-black the companion docs
specify.

Why the line deserves this much care: attendee notes from a Kuro rendering talk say edge
pixels make up 4–5% of the screen in Wuthering Waves' anime-style renderer, against 1–2% in
typical realistic rendering. That's why edge quality dominates the anime look. [S, attendee
notes] On a 96 px sprite the 1 px outline is a much bigger share of the sprite than that, so
it matters even more for us. [I]

### 4.7 No anti-aliasing in Blender [S, for Blender 4.2 onwards; recheck on 5.1]

- **Filter size:** Render Properties, Film, Filter Size set to its minimum. Lospec suggests
  0.01 px.
- **EEVEE Next:** it shares each camera sample with neighbouring pixels, which blurs pixel
  art. A Blender developer confirmed that below a threshold it falls back to the old
  behaviour, which is what we want. Check that the render really comes out with hard pixels.
- **Toon bands:** Shader to RGB, then a Color Ramp set to **Constant**, gives the hard bands.
  It works **only in EEVEE**, not Cycles. Use a single sun lamp for clean band edges.
- **Known shadow artifacts:** EEVEE Next shows artifacts on faces perpendicular to the light;
  lowering the shadow Resolution Limit helps.
- **Other settings:** Colour Management View Transform set to Standard; image textures set
  to Closest; an **orthographic** camera.
- **Hard alpha:** threshold alpha with a constant ramp in the compositor.

### 4.8 Per-frame corrections and stability [S, I]

- **What the others did:** Dead Cells accepted flicker to keep the pipeline fast. The Last
  Faith spent two full manual passes. Guilty Gear fixed the problem at the source, with
  per-key posing and hand-edited normals.
- **Middle route for us [I]:**
  1. Fix what we can in Blender: per-key posing, quantised normals, constant ramps, an
     orthographic camera locked to the character's root, and root motion handled by the game
     rather than baked into the render (Holland's snapping, applied to a sprite).
  2. Run an automatic cleanup for orphan pixels and pixels that flip on and off between
     frames.
  3. Hand-touch only the contact, finisher and hold frames, plus the face, which is
     hand-authored anyway.
- **Judge stability in motion, at real size** (the rubric's pixel-cleanliness check). A still
  frame proves nothing.

## Open questions and follow-ups

1. **Timing for ZZZ, Wuthering Waves and Endfield basic strings.** No public frame data turned
   up; Genshin has gcsim. If the A/B critics want those three specifically, the same
   video-timing method works on official character demos.
2. **Cut-in panel or 2x integer zoom for R.** This needs Dex's call; it's the one place the 3D
   staging can't transfer.
3. **Flash safety.** Should the default follow WCAG (3 flashes a second at most), with the ZZZ
   strobe available only as an opt-in? That's my recommendation.
4. **Hollow Knight's freeze values** come from a modding toolkit's copy of the code, not the
   shipped game.
5. **The ZZZ "Expert Challenge" videos** haven't been transcribed. The written summaries come
   from a weak source.

## Sources

Studios and characters:

- Wuthering Waves 3.7 roster: https://themagicrain.com/2026/09/wuthering-waves-version-3-7-reveals-new-story-content-resonators-and-gameplay-optimisations/
- Solon Lee interview (fan translation): https://x.com/Naruvt0/status/2021634640575180891
- Epic Games Store interview with Kuro: https://store.epicgames.com/en-US/news/wuthering-waves-interview-kuro-games-launch-struggles-future-plans
- Game Developer, "Making a Splash" (Michel Sabbagh, 2024): https://www.gamedeveloper.com/design/making-a-splash-how-wuthering-waves-characters-draw-players-into-its-world
- Resonance Liberation behaviour: https://guildjen.com/wuthering-waves-combat-guide/
- Cartethyia: https://wutheringwaves.fandom.com/wiki/Cartethyia/Combat and https://www.prydwen.gg/wuthering-waves/characters/cartethyia
- Phrolova: https://wuthering.gg/characters/phrolova and https://www.prydwen.gg/wuthering-waves/characters/phrolova
- Hiyuki: https://www.prydwen.gg/wuthering-waves/characters/hiyuki and https://wutheringwaves.fandom.com/wiki/Hiyuki/Combat
- Qingxiao and Jingran: https://www.prydwen.gg/wuthering-waves/characters/qingxiao and https://www.prydwen.gg/wuthering-waves/characters/jingran
- Wuthering Waves dodge frames (weak): https://www.tiktok.com/@pinkumbreon/video/7375601285501881633 and https://gamemarket.gg/news/wuthering-waves/wuthering-waves-combat-basics-master-parry-dodge-swap-cancel
- Kuro, Unreal Fest Shanghai 2023 (NPR rendering notes): https://www.163.com/dy/article/ILS592720511L9VL.html
- ZZZ Expert Challenge: https://www.youtube.com/watch?v=nfJuQb7O4Pg and https://zenless.hoyoverse.com/en-us/news/161660
- ZZZ Expert Challenge summary (weak): https://www.itemd2r.com/en/blog/zenless-zone-zero/uncovering-combat-secrets-of-zless-zone-zero-behind-the-design
- Alice beta coverage: https://www.sportskeeda.com/esports/zenless-zone-zero-zzz-yuzuha-alice-combat-animations-leaked
- Alice kit text: https://zzz.gachabase.net/agents/1401/alice and https://zenless-zone-zero.fandom.com/wiki/Ultimate:_Starfall_Finale
- Alice's symmetry: https://www.icy-veins.com/zenless-zone-zero/news/alice-thymefield-brings-symmetry-sass-and-spookiness-to-zenless-zone-zero/
- Yixuan: https://www.prydwen.gg/zenless/characters/yixuan and https://game8.co/games/Zenless-Zone-Zero/archives/516115
- ZZZ 3.2, Claret, Roxy and the assist flashes: https://www.rpgsite.net/news/21230-zenless-zone-zero-version-3-2-release-date-new-agent-speciality-features, https://timesaver.gg/blog/zzz-roxy-release-date, https://game8.co/games/Zenless-Zone-Zero/archives/614559
- ZZZ chain attacks: https://zenless-zone-zero.fandom.com/wiki/Chain_Attack and https://game8.co/games/Zenless-Zone-Zero/archives/435717
- ZZZ dodge windows (weak): https://www.bahomu.com/blogs/game-guides/advanced-guide-jane-doe-dodge-counters-iframes-zenless-zone and https://note.com/rau_d/n/n2705ec957872
- gcsim source (read 2026-09-28): https://github.com/genshinsim/gcsim/tree/main/internal/characters (`skirk/`, `mavuika/`, `flins/`: `attack.go`, `burst.go`, `skill.go`)
- gcsim docs: https://docs.gcsim.app/mechanics/hitlag/ and https://docs.gcsim.app/mechanics/frames/
- KQM TCL frames: https://library.keqingmains.com/combat-mechanics/frames and https://library.keqingmains.com/evidence/combat-mechanics/frames
- Skirk: https://genshin-impact.fandom.com/wiki/Havoc:_Ruin, https://gamerant.com/genshin-impact-skirk-complete-kit/, https://www.destructoid.com/genshin-impact-skirk-gameplay-animations-leaked-idle-skill-and-burst/
- Mavuika: https://wiki.hoyolab.com/m/genshin/entry/7299?lang=en-us
- Flins: https://genshin-impact.fandom.com/wiki/Ancient_Ritual:_Cometh_the_Night and https://www.prydwen.gg/genshin-impact/characters/flins
- Vesna and Genshin 7.1: https://dotesports.com/genshin-impact/guides/genshin-impact-version-7-1-banners-vesna-and-vodyanitsa
- Genshin model heights (fan-measured): https://gamerant.com/genshin-impact-height-playable-characters/ and https://genshin.aza.gg/db/height?l=en
- Genshin GDC 2021 slides: https://media.gdcvault.com/GDC+2021/2021GDC+_+Haoyu+Cai+_+presentation+file.pdf (talk: https://gdcvault.com/play/1027539/-Genshin-Impact-Crafting-an)
- Honkai: Star Rail GDC talk: https://gdcvault.com/play/1035480/-Honkai-Star-Rail-Reimagining
- Phainon: https://honkai-star-rail.fandom.com/wiki/He_Who_Bears_the_World_Must_Burn and https://www.sportskeeda.com/esports/honkai-star-rail-phainon-trailer-breakdown-33550336-irontomb-reference
- Honkai: Star Rail 4.6: https://www.hoyoverse.com/en-us/news/166390
- Endfield developer interview: https://www.gamespress.com/Arknights-Endfield-Reimagined-An-In-depth-Interview-with-Light-Zhong-a
- Endfield combat guides: https://www.prydwen.gg/arknights-endfield/guides/combat-basics, https://gamewith.net/akendfield/72441, https://arknightsendfield.wiki.fextralife.com/Combat
- Laevatain: https://endfield.wiki.gg/wiki/Laevatain and https://www.icy-veins.com/arknights-endfield/laevatain-profile-skills
- Last Rite: https://www.prydwen.gg/arknights-endfield/characters/last-rite and https://www.icy-veins.com/arknights-endfield/last-rite-profile-skills
- Endfield 1.5 and Typhoeus: https://game8.co/games/Arknights-Endfield/archives/616348

Measured videos (fan uploads of in-game footage):

- Laevatain: https://www.youtube.com/watch?v=oyylm71cvEM
- Alice: https://www.youtube.com/watch?v=cqpO2VDC140
- Cartethyia / Fleurdelys: https://www.youtube.com/watch?v=KsKHPP19ltI
- Skirk (before and after comparison): https://www.youtube.com/watch?v=uAQsTC2yDQg

Game feel, 2D and pipelines:

- Dead Cells deep dive (Thomas Vasseur, 2018): https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
- Dan Moran case study: https://www.youtube.com/watch?v=iNDRre6q98g and https://github.com/Broxxar/PixelArtPipeline
- Dead Cells weapon timings: https://deadcells.wiki.gg/wiki/Balanced_Blade, https://deadcells.wiki.gg/wiki/Broadsword, https://deadcells.wiki.gg/wiki/Symmetrical_Lance
- deepnight "Game feel" demo and source: https://deepnight.net/games/game-feel/ and https://github.com/deepnight/gamefeel
- Guilty Gear Xrd GDC 2015 handout: https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf (video: https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The)
- Sakurai on hitstop: https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ and https://www.youtube.com/watch?v=OdVkEOzdCPw
- Eiserloh, "Juicing Your Cameras With Math" (GDC 2016): http://www.mathforgameprogrammers.com/gdc2016/GDC2016_Eiserloh_Squirrel_JuicingYourCameras.pdf and https://bevy.org/examples/camera/2d-screen-shake/
- Hollow Knight freeze presets (modding mirror): https://github.com/nickc01/WeaverCore/blob/master/Hollow%20Knight/GameManager.cs
- Hollow Knight review: https://critpoints.net/2017/06/22/hollow-knight-review/
- Street Fighter 6 hitstop (weak): https://pastebin.com/zgQLxiiy and https://wiki.supercombo.gg/w/Street_Fighter_6/Game_Data
- Nine Sols: https://ninesols.wiki.gg/wiki/Parry, https://intoindiegames.com/features/nine-sols-an-interview-with-red-candle-games/, https://www.gamedeveloper.com/design/what-goes-into-a-good-parry-system-
- Katana Zero: https://www.gamerevolution.com/originals/520685-katana-zero-interview and https://mcvuk.com/business-news/askiisoft-katana-zero/
- Blasphemous: https://www.gameanim.com/2021/02/19/blasphemous-pixel-art-animation-time-lapses/
- The Last Faith: https://80.lv/articles/developer-offers-a-behind-the-scenes-look-at-the-last-faith-s-bosses and https://www.artstation.com/artwork/rJnWre
- Skul: https://blogs.unity3d.com/2021/01/21/2d-pixel-perfect-for-a-crisp-conquest-in-skul-the-hero-slayer/ and https://create.unity.com/skul-the-hero-slayer-case-study
- SLYNYRD, "Pixelblog 9: Melee Attacks": https://www.slynyrd.com/blog/2018/9/8/pixelblog-9-melee-attacks
- Pedro Medeiros (saint11) pixel tutorials: https://saint11.art/blog/pixel-art-tutorials/
- Impact frames: https://blog.sakugabooru.com/glossary/impact-frames/ and https://www.sakugabooru.com/wiki/show?title=impact_frames
- WCAG 2.3.1, three flashes: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- Unity 2D pixel lighting: https://learn.unity.com/course/2d-lighting-for-pixel-art/tutorial/make-normal-maps-affect-the-scene?version=6.3
- GDQuest 2D normal maps: https://www.gdquest.com/tutorial/godot/2d/lighting-with-normal-maps/
- David Holland, 3D pixel-art rendering: https://www.davidhol.land/articles/3d-pixel-art-rendering/
- Texel splatting (perspective limits): https://arxiv.org/html/2603.14587v1
- Blender Studio, 3D pixel art: https://studio.blender.org/blog/3d-pixel-art-in-blender/
- Lospec Blender Toolkit: https://lospec.com/blender-toolkit/
- EEVEE Next pixel filter: https://projects.blender.org/blender/blender/issues/123648
- EEVEE Next toon shadow artifacts: https://projects.blender.org/blender/blender/issues/125030
- Godot 3D-to-pixel shader (frame-rate note): https://medium.com/@merxon22/godot-shader-render-3d-models-as-pixel-art-4839e6528601
