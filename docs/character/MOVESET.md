# Player character moveset: "Rosace"

Every move the player character has: the M1 string, the M2 dash and what comes out of it, the
Q skill and the R ultimate. For each move: a frame table at 60 fps with drawings and holds,
cancel windows, invulnerable frames, root motion, hit areas in character heights and pixels, the
effect layers per phase with colours, rim-light events, camera, sound, and where the timing comes
from. The character herself (outfit, palette codes, face, weapon) is in `DESIGN.md`; colour codes
like W3, G1 or A4 below are defined there.

Companions: `DESIGN.md`, `REF-BREAKDOWN.md`, `QUALITY-RUBRIC.md`, `CRITIQUE-PARAMS.md`,
`RESEARCH.md`, `MOTION-SOURCES.md`, `RUNTIME-CONTRACT.md`. References are named by filename and
never embedded.

This is **revision 2**, after a critique round on revision 1. What changed and why is listed in
the revision log at the end.

**2026-09-30 production integration note:** the original wide Liturgy brief is
retained. Attack/motion/effect specialists stage authored data at80/144 using
H-normalized extents and exact60Hz exposures; source integrator owns shared
changes. Existing N1/N5 source/actions do not establish the complete kit or
physical sleeve/tabard playback. First proposed batch is finite N1 keys/cycle
and oneN1->N2transition before wider view/kit coverage. Diagnostic front/q34/
profile/back/both-side views are private construction/retarget references;
gameplay remains the canon flat side view. SeeSPECIALIST-INTEGRATION.md.

Tags, the same as the companion docs:

- **[M]** measured, here or in the companion doc named next to it.
- **[S]** sourced from outside, usually through a companion doc.
- **[visible]** seen on an image, not measured.
- **[I]** inference or design proposal. **Everything in this file is [I] unless it carries
  another tag.** Every number is a first A/B candidate, not a decision.

## Why this concept

**The base is Liturgy** (`concepts/liturgy.md`), the judges' top pick at 8.5, ahead of Halo
(8) and Judgment (7.5). The judges' reasons, in short:

- it's the most fluid: every hit starts from the previous hit's follow-through, so the string
  reads as one dance, and the dash is a pirouette
- its motif is on **every basic hit** (each smear decays into stained glass), which is how the
  newest HoYo and Kuro characters feel, rather than saving the idea for the ultimate
- it's the widest: finisher ring 4.8 H (7.2 H built up), Q 5.6 H (8.2 H held)
- R's backlit saint in front of a rose window is the clearest "screenshot frame" of the three

The judges' main worries about it were **noise** at 96 px (eight trailing cloth pieces plus
glass shards) and **too many systems** for a first playthrough; and, for all three concepts,
**early M1 hits that are too narrow** for a brief that asks for very wide everything. The grafts
below were picked to fix the noise and systems worries and to add the best single ideas from the
other two. The narrow hits are fixed in the hits themselves: every M1 hit now spans at least
2.2 H where it actually hits (section 0.7).

| # | Idea | From | Where it lands here | What it fixes or adds |
|---|---|---|---|---|
| 1 | "Float, then fall": a weightless hang with cloth and hair rising, then a stretch drawing and a snap drop | Halo | N4's vault hang, Q's raise and stamp, R's rise and the Wave 3 drop | a timing signature for the vertical moves. Liturgy's own "coil, then release" stays on the horizontal ones (N2, N5, the dash). |
| 2 | Rings split into a dimmer back half (behind her) and a full front half (in front); orbits move faster across the front | Halo | N2's sweep, N5's sweep and glass ring, Q's overhead twirl, the Illumination rose | makes a flat side view read as depth |
| 3 | Floor rings drawn as a band 10–16 px tall, whatever their width | Halo | N5's ring floor light, Q's floor band, Aspersion's splash | lets a ring lie on the floor without faking perspective |
| 4 | Player-timed collapse, with everyone lifted weightless for a beat before the burst | Halo (Q gravity well) | Q: press Q again to shatter the nave early; a 10 f float beat always comes first | player control inside the spectacle. The well itself was not taken; Q stays one idea. |
| 5 | Status shown on her body, not a HUD | Halo | the glaive's rose disc is the R meter; the blade's glass spine is the Q cooldown | premium feel, no HUD, fits CANON's restrained UI |
| 6 | Rim light as choreography | Halo | N2 (rim travels round her), Q (rim walks outward with the lancets), R (rim walks clockwise as glass pours; a beam silhouettes her) | the rim tells the story instead of acting as an outline |
| 7 | One lead cloth flag per move | Halo | `DESIGN.md` section 8 | the noise worry |
| 8 | "Cross out the screen": a grey world, one full-height and one full-width line, a total freeze, then colour floods back from the lines | Judgment | R's final beat, built from the rose's own vertical and horizontal beams | gives R a decisive ending instead of a generic star burst |
| 9 | "Summary Judgment": cut through the enemy line without stopping, walk away, the cut goes off a beat later | Judgment | Aspersion (the dash attack): the cut hardens into a glass seam that shatters behind her 12 f later | the cool-moment design modern kits use; also replaces Liturgy's separate counter move (Pax) |
| 10 | Summoned objects that stand as wards and block shots | Judgment | Q's lancets block the turret's shots while they stand | a use for the lancets beyond damage, directly testable on the blank map |
| 11 | A 2–4 f silence before every big hit | Judgment | N5, Q's shatter, both R flashes | sound as feel |
| 12 | A telegraph during a held coil | Judgment (guillotine line), Halo (guide ellipse) | N5: a dotted 1 px ellipse at the ring's radius during the coil, while the glass saint fills in behind her | turns a long wind-up into anticipation, not delay |
| 13 | A ghost weapon: a second, bigger body doing the hit | Judgment | in the base kit, N5's **glass saint**, a 2.5 H stained-glass apparition of her that breaks into the finisher's spikes; after R, Illumination's **ghost glaive**, a filled glass copy of Lancet that repeats every N1–N4 swing at 1.6x and hits | a large second body in the base kit, which RESEARCH 3.2 calls the strongest tool at 96 px. Revision 1 used this graft as a 1 px gold "echo arc" to make the openers look wide; that echo didn't hit and was a hairline at 3x, so it's gone and the width now comes from the hits themselves (section 0.7). |

**Trimmed from Liturgy** to answer the "too many systems" worry:

- **Pax** (the counter out of the perfect dash) is gone as its own move. Its shard fan now lives
  in the enhanced Aspersion.
- **Cadence** (on-beat inputs making gilded panes and a sung phrase) is kept but moved to the
  second build (section 9). The first build must feel good without it.

**Not taken:** Halo's gravity-well sphere, star marks and head halo (a ring behind the head is an
enemy sign in ref 13 [visible]); Judgment's sentence marks, bell and cleaver head. Panes already
do the "your string builds something" job, and one resource is enough.

## The short version

"Widest reach" is the horizontal span of the hit area (section 0.7), with the ground layer's
span after it where that's wider.

| Input | Move | One line | First hit (whiff) | Widest reach |
|---|---|---|---|---|
| M1 ×1 | N1 Kyrie | scooping rising cut from low behind her, along the floor, up high in front; scrapes a glass furrow | f9 | 2.5 H hit (1.0 H of it behind her); 2.9 H dust |
| M1 ×2 | N2 Gloria | full pivot, one flat sweep front and back | f8 | 2.5 H hit, both sides; 2.9 H dust |
| M1 ×3 | N3 Sanctus | three baton twirls, each throwing a bigger glass ring | f8, f13, f22 | 2.2 / 2.5 / 2.8 H hits; 3.2 H mini-rose |
| M1 ×4 | N4 Credo | chop that sends glass fissures both ways, vault over the haft upside down while a row of glass spikes erupts along the fissures | f10, f18 | 2.5 H hit, twice; spikes 1.1 H tall |
| M1 ×5 | N5 Agnus Dei | a 2.5 H glass saint forms behind her wound coil; 360° sweep; the sweep hardens into a glass ring that shatters as the saint breaks into spikes along it | f30, f54 | 5.0 H spikes, 1.5 H tall; 4.8 H ring (7.2 H with panes) |
| M2 | Procession | gliding pirouette leaving stained-glass copies of her | none | 2.3 H trail |
| M2 on a hit | Sanctuary | perfect dash: a glass saint takes the hit; 0.5 s of slow motion | none | – |
| M2 → M1 | Aspersion | cuts straight through the line, walks away; the glass seam shatters behind her | f4–9, f22 | 2.6 H seam |
| Q | Nave | overhead twirl, stamp; lancet windows rise both sides, stand as wards, shatter when you say | f24, f30–42, on shatter | 5.6 H (8.2 H held) |
| R | Te Deum | time stops; a rose window draws itself behind her; four waves; the screen is crossed out | f95 | the whole view and past both edges |
| after R | Illumination (12 s) | a floating rose and a glass ghost glaive double every swing | – | finisher always past both edges |

---

## 0. Rules shared by every move

### 0.1 Frames, drawings, conventions

- **60 fps game frames, written `f`.** f1 is the first frame after the input. Tables give
  **whiff timing** (nothing hit); on a hit the hitstop is inserted and every later frame moves
  back by that much, the way gcsim keeps hitlag separate [S, RESEARCH 2.2].
- **Drawings are authored on 30 fps timing** (Dead Cells' rate [S, RESEARCH 4.1]), so most hold
  2 f. Smears and flashes hold 1 f; contact, coil and hold poses 3–8 f or more. "A2 ×3" means
  drawing A2 on screen for 3 f. In the export, that's `duration` plus `hold` (RUNTIME-CONTRACT).
- **Frames are added before or after key poses, never between them** (Dead Cells [S, RESEARCH
  2.10]). No interpolated in-betweens.
- **Hit areas** are in H (her height, 96 px) and as contract boxes `{x, y, w, h}` in px from the
  foot pivot, facing right, y negative upward (RUNTIME-CONTRACT). When a hitbox must change
  timing inside one long drawing, the drawing is split into several frames that reuse the same
  image rect.
- **Clip ids** (RUNTIME-CONTRACT; the controller requires `m1_1`…`m1_4` [M,
  `src/lab/game/player.ts`]): N1–N5 are `m1_1`…`m1_5`, with `m1_5` reached through `m1_4`'s cancel
  window (the contract makes a five-hit string a data change [M]); the dash is `dash`; Aspersion
  is `dash_attack`; Q is `skill_q`; R is `ult_r`.

### 0.2 Flow

- Each hit's first wind-up drawing is keyed from the previous hit's last follow-through drawing,
  so a chained string never pops a pose. N2–N5 only ever start chained.
- Attack inputs buffer for 12 f (the contract's buffer [M, RUNTIME-CONTRACT]).
- **The string survives other actions.** Dash, jump, Q and R cancel recoveries without resetting
  the string; after a dash, the next M1 is Aspersion, and after Aspersion the string continues at
  N3. Endfield keeps its string alive through dodges and skills [S, RESEARCH 2.1]. The string
  resets after 45 f with no M1 input.

### 0.3 Hit feel

- **Hitstop** freezes her and the enemies she hit; effects and other enemies keep moving, as in
  Genshin [S, RESEARCH 2.2]. The victim shakes 1 px (sideways on the ground, up and down in the
  air) every 2 f, as Sakurai describes [S]. She **holds the contact drawing** during the freeze
  instead of drifting at 1% speed, because sub-pixel drift shimmers [I, RESEARCH 3.2].
- **Sizes:** light hits 2–3 f, heavy hits 4–8 f, inside RESEARCH's rule of thumb (2–5 f normal,
  6–9 f finishers) [S]. The lab caps any single hitstop at 14 f [M, `tuning.json` `maxHitstop`].
- Today's contract freezes the whole simulation on hitstop; victim-only freezes are an engine
  ask (section 8).

### 0.4 Camera

- **No zoom, ever.** A non-integer zoom resamples every pixel and shimmers [S, RESEARCH 3.2].
  Zoom's jobs go to a 1–6 px camera push, a dimmed background, and CANON's black cinematic bars.
- **Shake** is whole-pixel translation with no rotation, sized by "trauma" squared (Eiserloh [S,
  RESEARCH 2.6]), at most 4 px. Shakes are listed as amplitude in px and duration in f (the
  contract's `shake` event).

### 0.5 Flash safety

- At most **2 full-screen flashes in the whole kit, both in R, 100 f apart** (section 6). WCAG
  2.3.1 allows at most 3 in any second [S, RESEARCH 2.8].
- Every other flash is local: a star or disc around the contact point.
- Impact frames hold steady; they never alternate.
- A "reduce flashing" setting turns full-screen flashes into a 40% tint.

### 0.6 The glass decay: how every smear dies

Ref 10's decay (1 full drawing, then 1–2 striped drawings, then a sliver [M, REF-BREAKDOWN])
redrawn as her motif. Per-move tables list only the frames for each stage.

| Stage | Length | Look |
|---|---|---|
| Full | the smear drawing(s) | leading edge A5, 2–3 px thick; body in two flat tones (A3, A2); tail tapering in A1 to a 1 px point; 1–2 thin G1 slivers riding outside the arc |
| Leaded | next 4–6 f | 1 px A0 lines cut the smear into 3–7 glass cells along its length (flat A1/A2/A3); leading edge drops to A4 |
| Shards | next 6–10 f | cells come loose as 2–4 px shards that fall with gravity; each has one glint pixel that blinks once |
| Gone | 2 f | 1–2 px G1 slivers of leading, then nothing |

**Leading is the one dark line in her effects.** The rubric fails "a dark line drawn around
effects" (rubric 5). Leading appears only on glass (cells, panes, lancets, the rose), which
behaves as a solid object the way ref 08's dark shards do [visible]. It never outlines a full
smear, a flash or a spark. This is the first thing to A/B (section 10).

### 0.7 Width: every M1 hit is wide where it hits

This replaces revision 1's gold echo arcs. Those made the openers look wide with a 1 px line
that didn't hit: at 3x it was a 3-screen-px hairline that reads as an outline or noise, not as
area.

- **Width is horizontal span:** the hit area's left edge to its right edge, in H. Arc length
  doesn't count, and neither does a line that doesn't hit. The Width check below measures every
  move this way.
- **Floor: every M1 hit spans at least 2.2 H.** Rubric 10 fails 0.8–1.75 H, the band where the
  pixel attack refs 06–10 sit. Ref 11's arcs run 2.4–4.2 H [M, REF-BREAKDOWN]. Revision 1's N1
  spanned 1.36 H, all in front, and N4's chop 1.0 H with a 0.35 H pillar [M, arithmetic from
  their boxes].
- **What you see is what hits.** Each hit's main arc, or its ground shock where the hit is a
  floor shock, is drawn to the size of its hit area.
- **A ground layer wider than the arc on every step** (dust, glass furrow, fissure), as ref 11's
  grey dust spreads wider than its arcs [M/visible, REF-BREAKDOWN].
- **The motif works at area scale,** not only in the 7×13 panes: N1's glass furrow, N3's thrown
  glass rings and mini-rose, N4's fissures and spike row, N5's glass saint and spike ring.
- **The ghost weapon idea lives on as real bodies that hit:** N5's glass saint in the base kit,
  and Illumination's ghost glaive after R (section 5), a filled glass copy of Lancet.

### 0.8 Panes: the thread through the kit

- Every M1 hit that connects leaves one **pane** at the tip of its arc: a small lancet of glass
  7×13 px (A1/A2/A3 cells, A0 leading, a 1 px A4 glow). It hangs there bobbing 1 px every 20 f,
  lives 150 f (2.5 s), then dies through the glass decay.
- **At most 6** at once; the oldest breaks first. (Liturgy had 8; cut for noise.)
- Panes are point lights for her rim: the nearest two light her (the contract's `light` event:
  A4, radius 60, intensity 0.6, for the pane's life).
- N5 and Q **absorb** up to 4 panes each to grow wider (numbers in each move). Absorbing is a
  second-build system (section 9); the first build spawns panes as decoration only.

### 0.9 Two rhythm signatures

- **Coil, then release** (horizontal moves: N2, N5, the dash): a wound pose held still, every
  ribbon wrapped the same way, then one explosive unwind.
- **Float, then fall** (vertical moves: N4's vault, Q's raise, R's rise and drop; from Halo):
  a weightless hang where hair and sleeves drift up and 1 px motes rise off the floor, then a
  stretch drawing, 1 px speed lines, and a snap drop with the cloth crashing down and bouncing
  once.

### 0.10 Rings in a flat view (grafted from Halo)

- Anything that wraps round her is drawn in two halves: the **back half on the back layer**, one
  ramp step dimmer and 1 px thinner, and the **front half on the front layer** at full strength.
  The contract already supports this: two `vfx` events with `layer: "back"` and
  `layer: "front"` [M].
- Orbiting things move faster across the front half than the back.
- Anything lying on the floor is a band 10–16 px tall, however wide it is, like the flat ground
  shadows in 01, 07 and 08 [visible]. That keeps CANON's flat side view.

### 0.11 Sound rules

- Each M1 hit has a glass chime on contact, one step higher per hit, resolving on N5's chord.
- **A 2–4 f silence before every big hit** (from Judgment): N5's contact, Q's shatter, both R
  flashes.
- Sound ids below are proposals; the lab plays placeholder synth for ids it knows
  (RUNTIME-CONTRACT).

### 0.12 Terrain on the test map

- Floor bands, cracks, dust and splashes follow the surface she stands on and stop at platform
  edges.
- Q's lancets rise from the highest ground under their x position.
- R's beams and lines ignore terrain.

### 0.13 Contact halos on the heavy hits

Revision 1's contact stars were 7–13 px (about 0.1 H), with no glow on any M1 or Q contact.
Refs 08, 11 and 12 lean on glow (rubric 9).

- **Where:** N3's third twirl and N4's bite (1.2 H across), N5's contact and Q's stamp (1.5 H
  across). Light hits keep their star alone.
- **Built on the palette, not added light.** Two stepped bands round the core star: an inner disc
  to 45% of the diameter in A4 at 50% ordered dither, and an outer ring to the full diameter in
  A3 at 25%. Every drawn pixel is a palette colour, and every undrawn one shows what's behind, so
  she and the enemies stay visible through it (rubric 12). No gradient, no dark edge.
- **Timing:** 2 f with both bands, then 2 f with only the outer band stepped down to A2, then
  gone. That's the rubric's 2–4 drawing exit.
- **Layer:** behind her when it's centred on her (the Q stamp); in front at an enemy contact.
- **Light:** each halo fires a `light` event (A4, radius 1.5 times the halo's radius, intensity
  1.6, 4 f), so the rim flashes with it.
- **Size on screen:** a 1.5 H halo covers 7% of the 640×360 view, and a 1.2 H one 4.5% [M,
  arithmetic], so these stay local flashes (section 0.5).
- **Engine note:** the lab's VFX `glow()` already uses a Bayer dither but adds light, which
  leaves the palette [M, `src/lab/engine/shaders.ts`]. The halo needs palette colours painted
  through the same dither pattern (section 8, item 15).

---

## Width check

How far each move reaches, measured the way section 0.7 defines it: the horizontal span of the
hit area, from its left edge to its right edge, facing right, from the boxes in each move's
section. It isn't arc length, and it doesn't count lines that don't hit. The view is 6.7 H wide
and 3.75 H tall at 96 px [M, RESEARCH 3.1], so anything over 6.7 H runs off both edges.

**The floors:** every M1 hit at least 2.2 H (section 0.7); rubric 10 fails 0.8–1.75 H; ref 11's
arcs are 2.4–4.2 H; RESEARCH 3.2 suggests an M1 finisher of about 3 H, Q 3–5 H, and R off both
edges.

All spans and tops below are [M, arithmetic from the boxes]. "Was" is revision 1.

| Hit | Hitting span | Was | Behind her | Top of hit area | Ground or visible layer |
|---|---|---|---|---|---|
| N1 | **2.5 H** (240 px, −100 to +140) | 1.36 H, none behind | 1.04 H | 1.75 H (168 px) | dust band 2.9 H |
| N2 | **2.5 H** (240 px, ±120) | 2.29 H | 1.25 H | 0.85 H (82 px) | dust band 2.9 H |
| N3 twirls 1 / 2 / 3 | **2.2 / 2.5 / 2.8 H** (212 / 240 / 268 px) | 1.4 / 1.7 / 2.0 H | 0.55 / 0.7 / 0.84 H | 1.85 / 2.0 / 2.15 H | mini-rose 3.2 H (doesn't hit) |
| N4 hit 1 (chop + fissures) | **2.5 H** (240 px, −24 to +216) | 1.0 H | 0.25 H | chop 1.7 H; fissures 0.35 H | dust 2.9 H round the bite |
| N4 hit 2 (spike row) | **2.5 H** (240 px, round the bite) | 0.35 H | 0.25 H | 1.1 H centre, 0.8 H sides | – |
| N5 sweep | 3.2 H (308 px, ±154) | same | 1.6 H | 0.82 H | – |
| N5 ring | 4.8 H (460 px, inner ±0.8 H left out) | same | 2.4 H | 0.72 H | dust band 5.2 H |
| N5 spikes | **5.0 H** (480 px, ±240) | – (new) | 2.5 H | **1.5 H** (144 px) | 7.2 H with 4 panes (second build) |
| M2 trail | – (no hit) | – | – | – | 2.3 H of afterimages (rubric floor ≥ 2 H) |
| Aspersion pass / seam | 2.2 H of floor swept / 2.6 H | same | – | 1.1 H / 0.9 H | 3.0 H enhanced fan |
| Q shatter | 5.6 H (538 px, 84% of the view) | same | 2.8 H | 1.8 H | 8.2 H held or with panes |
| R | the whole view; beams and lines off both edges | same | – | full height | – |
| N5 in Illumination | at least 7 H | same | – | – | past both edges |
| Ghost glaive in Illumination | 4.0 H (N1, N2, N4); 3.5 / 4.0 / 4.5 H (N3) | 2.9–3.8 H | – | – | – |

**Vertical reach on the test map.** The turret stands on a platform 62 px above the floor, and
its hurtbox runs from 62 to 120 px up (`src/lab/data/map.json` platform `y: -62`;
`src/lab/game/turret.ts` default hurtbox 58 px tall) [M]. The other platforms are 74, 96, 142, 150
and 216 px up [M, map.json]. From the floor next to that platform:

- **Reach all of the turret:** N1, N3, N4's chop (when the turret is 0.3–1.3 H ahead), N4's
  spike row near the bite, N5's spikes, Q's shatter, R.
- **Clip only its bottom:** N2 (20 px), N5's sweep (17 px), N5's ring (7 px) [M, arithmetic].
  Revision 1's critique was right that the flat bands barely reach anything on a platform.
  The fix is N5's spike row, which puts 1.5 H of height at the wide ends of the finisher, and
  N4's spike row. N2 stays a flat sweep on purpose: it's the string's one low, fast hit.

## Whole-string timing

Chained at the earliest windows with nothing hit (whiff), each hit starts when the previous
one's chain window opens: N2 at +15, N3 at +32, N4 at +64, N5 at +98. [M, arithmetic from the
tables below]

| | N1 | N2 | N3 | N4 | N5 |
|---|---|---|---|---|---|
| Starts at (string frame) | 0 | 15 | 32 | 64 | 98 |
| Hits land at | 9 | 23 | 40, 45, 54 | 74, 82 | 128, 152 |
| Hitstop on a hit (f) | 3 | 3 | 2, 2, 4 | 4, 3 | 8, 4 |

- Free to dash or jump at string frame 148 (2.47 s); a new string at 170; the clip ends at 192
  (3.2 s). When every hit lands, 33 f of hitstop are added. [M, arithmetic]
- The gaps between hits run 14, 17, 5, 9, 20, 8, 46, 24 f: deliberately uneven, with a long
  breath before the finisher. Genshin's strings are uneven the same way (Skirk's next-input
  frames: 19 / 18 / 37 / 19 / 67) [M, RESEARCH 2.1].
- Against RESEARCH's measured ranges: early hits land 8–10 f after input (measured 7–16 f); the
  finisher lands at f30 (measured 29–35 f); its recovery after contact is 64 f (measured
  58–72 f) [M, RESEARCH 2.1].

---

## 1. M1: "The Ordinary" (five hits)

Named for the five sung parts of the Mass. Sanctus and Credo swap places on purpose: the triple
"Holy, holy, holy" belongs in the multi-hit slot.

### N1 "Kyrie": scooping rising cut (`m1_1`)

**Idea:** a scooping rising cut that opens the ritual. The blade starts low behind her, scrapes
along the floor past her feet, and rises high in front, so the very first hit covers both sides
of her and leaves a strip of glass in the floor. The first pane hangs where the blade passed.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–7 | A1 ×2, A2 ×3, A3 ×2 | weight drops back; glaive dips low behind the hip; A2 is the coil, sleeves pulled back, the blade tip about 1 H behind her heel and just off the floor |
| Strike | f8 | S1 ×1 | the scoop in one smear drawing: the tip runs from behind her along the floor under her feet and whips up to high in front; the blade itself is drawn bent (ref 09 [visible]) |
| Contact + hitstop | f9–11 | C1 ×3 | hit lands f9; 3 f freeze on a hit |
| Follow-through | f12–15 | F1 ×2, F2 ×2 | glaive carries over her head; sleeves overshoot forward (lead flag) |
| Recovery | f16–33 | R1 ×6, R2 ×6, R3 ×6 | settles into the processional stance |

- **10 drawings, 33 f.**
- **Cancels:** N2 from f15 · dash, jump, Q or R from f12 · walk from f24. **I-frames:** none.
- **Root motion:** +8 px over f6–9 (the step in), +4 px over f12–15.
- **Hit area** (active f8–10, group `n1`): the J-shaped path of the scoop, from 1.04 H behind
  her at floor level to high in front. **2.5 H across (240 px, −100 to +140) and 1.75 H tall
  (168 px).** Boxes:
  - low, behind and under her: `{x: -100, y: -44, w: 150, h: 44}`
  - rising in front: `{x: 40, y: -120, w: 100, h: 120}`
  - high in front: `{x: 20, y: -168, w: 104, h: 48}`

  Knockback `[0.8, -2.0]` (a small pop up, away from her on either side), hitstop 3.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Anticipation | blade glint | f5–6 | 1 px point running up the cutting edge | A5 |
| Strike | main arc | full f8, leaded f9–14, shards f15–24 | a J-shaped crescent **2.5 H across (240 px) and 1.75 H tall (168 px)**, the size of the hit area: a knife-thin tail on the floor behind her, a belly scraping the floor under her feet, and the thick head (12 px at the leading edge) rising in front | A5 edge; A3/A2 body; A1 tail |
| Strike | slivers | f8–12 | 2 parallel 1 px arcs outside the head of the arc | G1, G2 |
| Ground | glass furrow | full f8, leaded f9–20, shards f21–32 | where the tip scraped: a band from 1.05 H behind her to 0.5 H ahead (150 px), 4 px tall, split into glass cells, then the glass decay | A2/A3 cells, A0 leading, A4 top edge |
| Ground | dust band | f8–26 | stepped dust from 1.3 H behind her to 1.6 H ahead (2.9 H, 278 px), 4 px tall, wider than the arc | W3, W4 |
| Contact | core flash | f9–10 | 8-point star, 9 px | A5 centre, A4 arms |
| Contact | particles | f9–30 | 4–6 shards 2–3 px; 3 gold motes rising | A2/A3 with an A5 glint; G0 |
| Contact | pane | spawns f9 on a hit | 7×13 lancet at the arc's tip | A1–A3, A0 leading |

- **Rim and light:** a light on the blade tip (`anchor: "tip"`, `attach: true`): A4, radius 90,
  intensity 1.4, 16 f from f8, cool family. Rim per `DESIGN.md` section 9: the lit-side outline
  turns A3 (half) or A4 (full), and at full, on the shaded side of broad white shapes, the pixel
  inside it steps to A5.
- **Camera:** 1 px push in the facing direction on contact.
- **SFX:** `silk.whoosh` + `blade.swish` (f7); `glass.chime.1` on contact (f9).
- **Informed by:** ref 11's rising crescent (about 3.5 H wide and 1.9 H tall) and its dust
  layer spreading wider than the arc [M, REF-BREAKDOWN]; ref 10 (smear anatomy and decay),
  ref 09 (bent blade), ref 06 (draw order: trail behind, slash in front, spark on top)
  [M/visible, REF-BREAKDOWN].
- **Timing source:** numbers from RESEARCH 2.1 and 3.3 (Genshin first hits land at 11–13 f for
  Flins and Skirk [M, gcsim]; the research sheet suggests 8–10 f). Motion to borrow and check
  against: Quaternius UAL2 "Sword Regular A" + "A Rec" (CC0, retarget and alter); Bandai Namco
  `slash_normal_001` (timing only until Dex rules on its non-commercial licence) [S,
  MOTION-SOURCES]. None downloaded yet.

### N2 "Gloria": pivot sweep, front and back (`m1_2`)

**Idea:** she pivots all the way round so one flat sweep cuts in front and behind, and her open
back shows mid-turn. Coil, then release.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–6 | A1 ×3, A2 ×3 | pivots on the front foot; A2 shows her back (open back, thong-cut seat framed by the gold harness), glaive at shoulder height behind her |
| Strike | f7 | S1 ×1 | a flat ellipse of smear all the way round her |
| Contact + hitstop | f8–10 | C1 ×3 | front again, glaive leading low; the tabards wrapped the other way (lead flag) |
| Follow-through | f11–16 | F1 ×3, F2 ×3 | tabards unwind and flare |
| Recovery | f17–38 | R1 ×7, R2 ×7, R3 ×8 | |

- **9 drawings, 38 f.**
- **Cancels:** N3 from f17 · dash from f11 · jump, Q or R from f11 · walk from f26. **I-frames:**
  none.
- **Root motion:** turns in place, +6 px.
- **Hit area** (active f7–9): a flat ellipse on her hips, both sides, **±1.25 H (2.5 H, 240 px)
  by 0.6 H, from the knee to above the chest**: `{x: -120, y: -82, w: 240, h: 58}`, group `n2`.
  Knockback `[2.0, -0.6]` away from her on either side, hitstop 3. It's the string's one low,
  fast hit, so it stays flat on purpose; it clips only the bottom 20 px of the turret from the
  floor (Width check).

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Strike | main arc, back half | full f7, leaded f8–13, shards f14–24 | back half of an ellipse 2.6 H × 0.5 H (250 × 48 px), **back layer**, one step dimmer, 1 px thinner | A4 edge, A2/A1 body |
| Strike | main arc, front half | same | front half, **front layer** | A5 edge, A3/A2, A1 tail |
| Strike | slivers | f7–11 | 2 thin flat arcs above and below, which take the visible height to about 0.65 H | G1 |
| Contact | core flash | f8–9 | 9 px 8-point star on each enemy hit | A5, A4 |
| Contact | particles | f8–30 | shards thrown sideways | A2/A3 |
| Contact | pane | f8 on a hit | at the front tip | as N1 |
| Ground | dust band | f7–20 | stepped dust ±1.45 H (2.9 H), 4 px tall, wider than the ellipse | W3, W4 |

- **Rim and light (choreographed):** a tip light (A4, radius 100, intensity 1.0, attached) that
  travels with the blade: behind her on f7, in front on f8. **The rim travels round her
  silhouette** from back edges to front edges as the sweep passes.
- **Camera:** 1 px push.
- **SFX:** `silk.flutter.long` (f1–6); a double swish, lower on the back pass (f7) and higher on
  the front (f8); `glass.chime.2`.
- **Informed by:** ref 11's long flat horizontal arcs with dust under them [M, REF-BREAKDOWN];
  ref 05 row 7 (hair and cloth in a turn) [visible]; Dead Cells' Symmetrical Lance hits behind
  [S, RESEARCH 2.1].
- **Timing source:** RESEARCH 2.1 (Skirk's N2 lands at 7 f, Flins' at 11 f [M, gcsim]). Motion:
  UAL2 "Sword Regular B" + "B Rec"; 山辺康夫's two-handed katana set for the grip shift (timing
  only until its readme is read) [S, MOTION-SOURCES].

### N3 "Sanctus": three twirls, three thrown rings (`m1_3`)

**Idea:** three baton twirls in front of her. Each twirl flings a ring of glass off the blade's
tip, each ring wider than the last. The third flashes a rose that previews the ultimate.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–6 | A1 ×3, A2 ×3 | grip slides to the middle of the haft; glaive upright before her chest |
| Twirl 1 | f7–9 | D1 ×1 (smear), C1 ×2 | a full vertical disc; its glass ring flies out to 2.2 H across; hit f8 |
| Twirl 2 | f10–14 | T1 ×2 (grip slide), D2 ×1, C2 ×2 | ring to 2.5 H; hit f13 |
| Coil | f15–20 | K1 ×6 | the pause before the third "Holy": grip slides to the butt, glaive diagonal back and high, up on her toes |
| Twirl 3 | f21–25 | D3 ×1, C3 ×4 | ring to 2.8 H; hit f22 |
| Follow-through | f26–31 | F1 ×3, F2 ×3 | glaive raised high |
| Recovery | f32–55 | R1 ×8, R2 ×8, R3 ×8 | |

- **15 drawings, 55 f.** Hair is the lead flag, fanning on each twirl.
- **Cancels:** N4 from f32 · dash from f10 · jump, Q or R from f26 · walk from f40. **I-frames:**
  none.
- **Root motion:** +4 px per twirl.
- **Hit areas:** three circles, the size of the thrown rings, centred 0.55 H ahead of her chest
  (53 px ahead, 72 px up) and cut off at the floor.
  - Twirl 1 (f7–8, group `a`): **2.2 H across**, `{x: -53, y: -178, w: 212, h: 178}`, hitstop 2.
  - Twirl 2 (f12–13, group `b`): **2.5 H**, `{x: -67, y: -192, w: 240, h: 192}`, hitstop 2.
  - Twirl 3 (f21–23, group `c`): **2.8 H**, `{x: -81, y: -206, w: 268, h: 206}`, hitstop 4.
    It reaches 0.84 H behind her and 2.15 H up.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Twirls | discs | each: full 1 f, leaded 4 f, shards 6 f | the tip's own circle, about 1.4 H across (1.55 H at most with the 15% smear stretch): a ring with a thick leading edge, open in the middle | A5 edge, A3/A2, A1 |
| Twirls | thrown glass rings | each: expands over 2 f from the tip's circle to full size (2.2 / 2.5 / 2.8 H), full 1 f, leaded 4 f, shards 6 f | a filled 2-tone band 6 px thick with an A5 leading edge; 8-fold symmetric, so each size is built from one 45° wedge. This is what hits. Where a ring crosses her body, that segment goes on the back layer, so she stays in front of her own effect (rubric 12). | A5 edge, A4/A3 band, A2 inner edge |
| Twirl 3 | mini-rose | f22–30 | 8 panes (7×13, like the M1 panes) flash out along the 8 axes to 1.6 H radius, then fall as shards (3.2 H across). Doesn't hit. | A2/A3, A0 leading, G2 hub |
| Contacts | core flash | f8, f13, f22 | 8-point stars, 7 / 9 / 11 px | A5, A4 |
| Twirl 3 | contact halo | f22–25 | 1.2 H across (section 0.13) | A4, A3 → A2 |
| Twirl 3 | sliver | f21–25 | 1 px gold circle just outside the third ring | G1 |
| Contacts | particles | f22–40 | 8–10 shards, gold motes | A2/A3, G0 |
| Twirl 3 | pane | f22 on a hit | one pane (the mini-rose isn't a pane) | as N1 |

- **Rim and light:** a light at the disc centre, A4, radius 120, intensity 1.2, on each twirl
  (8 f each), cool family; she's front-lit by the discs.
- **Camera:** 1 px shake for 6 f on the third twirl only.
- **SFX:** three handbell strikes a step apart (f8, f13, f22), the third with a glass shimmer;
  `glass.chime.3`.
- **Informed by:** ref 05 row 7 (a spin where the hair is the spectacle) [visible]; ref 12 W (a
  ring round the body) [M]; multi-hit steps like Skirk's N3 at 8 and 22 f and Mavuika's at 28,
  33, 39 f [M, RESEARCH 2.1].
- **Timing source:** RESEARCH 2.1 (multi-hit steps). Motion: ジュウ's weapon twirl, BowlRoll 62294
  (its page allows modification and reuse; watch the preview first because of its "motion trace"
  tag) [S, MOTION-SOURCES].

### N4 "Credo": chop, fissures, vault, spikes (`m1_4`)

**Idea:** she drives the glaive into the floor. The bite sends two glass fissures racing along
the floor both ways. She vaults over the haft upside down and hangs weightless at the top while
the fissures erupt beneath her into a row of glass spikes. Float, then fall.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–8 | A1 ×3, A2 ×5 | glaive swung overhead; she arches onto her toes. A2 is one straight vertical line from boots to blade |
| Strike | f9 | S1 ×1 | vertical crescent from over her head to the floor ahead |
| Contact + hitstop | f10–13 | C1 ×4 | blade bites the floor 1.0 H ahead, haft leaning back toward her (never an inverted cross); two glass fissures race out from the bite, 1.25 H each way in 3 f |
| Vault up | f14–16 | V1 ×3 | weight onto the haft |
| **Hang** | f17–22 | V2 ×6 | upside down above the haft (ref 07's pose [visible]). **Weightless:** hair, sleeves and tabards float away from her body, motes rise from the cut |
| Snap | f23–24 | V3 ×2 | legs over, heel leading, stretched; 1 px speed lines |
| Fall | f25–28 | V4 ×4 | coming down beyond the glaive |
| Land | f29–33 | V5 ×5 | crouched landing squash, cloth crashing down and bouncing once; glaive still planted behind her |
| Spike row (hit 2) | f18 | effect only | the fissures erupt: 7 jagged glass spikes burst up along them, tallest at the bite, under her as she hangs |
| Recovery | f34–63 | R1 ×8, R2 ×8, R3 ×7, R4 ×7 | pulls the glaive out behind her, twirls it back to the stance |

- **13 drawings, 63 f.** Everything floats at the hang: one of the two moves where every cloth
  piece flares.
- **Cancels:** N5 from f34 · dash or jump from f14 (cancelling during the vault snaps the glaive
  back to her hand in one smear drawing) · Q or R from f34 · walk from f50. **I-frames:** none.
- **Root motion** per drawing `[dx, dy]`: V1 `[10, -24]`, V2 `[40, -16]` (peak 40 px, 0.42 H,
  off the floor), V3 `[20, 10]`, V4 `[30, 20]`, V5 `[20, 10]`: +120 px (1.25 H) forward in all.
- **Hit areas.** The bite is 96 px ahead of where she started (1.0 H). Both hits span **2.5 H
  (240 px, from 24 px behind her start to 216 px ahead)**.
  - **Hit 1, chop and fissures** (group `a`, so each enemy is hit once by whichever reaches it
    first). Knockback `[0.5, 1.5]` (slammed down), hitstop 4, heavy.
    - chop (f9–11): 0.3–1.3 H ahead, floor to 1.7 H: `{x: 29, y: -163, w: 96, h: 163}`
    - fissures (f10–12): a floor shock ±1.25 H round the bite, 0.35 H tall:
      `{x: -24, y: -34, w: 240, h: 34}`
  - **Hit 2, spike row** (f18–22, group `b`): 7 spikes at the bite and at ±0.4, ±0.8 and
    ±1.2 H from it, 1.1, 0.9, 0.7 and 0.5 H tall. Three boxes approximate them:
    - centre: `{x: 53, y: -106, w: 86, h: 106}` (±0.45 H round the bite, 1.1 H tall)
    - sides: `{x: -24, y: -77, w: 77, h: 77}` and `{x: 139, y: -77, w: 77, h: 77}` (0.8 H tall)

    Knockback `[0, -3.0]` (launch), hitstop 3. The spikes are fixed in the world while she
    vaults, so these are persistent effect hitboxes (section 8, item 2). Fallback in today's
    contract: author them per frame with x minus her root motion so far, as revision 1 did for
    the pillar.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Strike | main arc | full f9, leaded f10–15, shards f16–26 | vertical crescent 1.7 H tall | A5, A3/A2, A1 |
| Contact | core flash | f10–11 | 11 px star at the bite | A5, A4 |
| Contact | contact halo | f10–13 | 1.2 H across, at the bite (section 0.13) | A4, A3 → A2 |
| Contact | glass fissures | race out f10–12, then leaded cracks fading to f70 | two filled bands running ±1.25 H from the bite (2.5 H), 6 px tall, with a bright running tip; once they stop they settle into 1 px leaded cracks | A5 tip, A3/A2 band; then A0 lines with a 1 px A3 glow |
| Contact | dust band | f10–28 | stepped dust ±1.45 H from the bite (2.9 H), 4 px tall | W3, W4 |
| Contact | debris | f10–30 | floor chips thrown both ways | W4, I4 |
| Hang | motes | f17–22 | 6 motes rising along the fissures | A4 |
| Hit 2 | spike row | erupt f18–20, full f21–22, then the glass decay to f34 | 7 jagged glass spikes along the fissures, 10 / 8 / 8 / 6 px wide and 1.1 / 0.9 / 0.7 / 0.5 H tall from the bite outward. Jagged shards, not windows, so they don't read as Q's lancets (ref 12 E's ground spikes [M]) | A1–A3 cells, A0 leading, A5 tips |
| Snap | speed lines | f23–24 | 3 vertical 1 px lines above her | A3 |
| Contact | pane | f10 on a hit | at the cut | as N1 |

- **Rim and light:** a light at the bite (A4, radius 160, intensity 1.6, f18–30, cool family):
  she's lit from below by the spike row while upside down, so the rim is on the edges of her
  hair, sleeves and tabards that face the floor.
- **Camera:** 2 px shake for 10 f on the bite; the camera follows the vault with a 4 f lag so
  the jump reads.
- **SFX:** chop whoosh (f8); `stone.crack` + low bell (f10); glass bursting upward (f18); a held
  breath through the hang (f17–22); cloth snap (f23); `glass.chime.4` on landing.
- **Informed by:** ref 07 (the upside-down vault over the weapon, ground scratches) and ref 08
  (ground burst) [visible, M]; ref 12 E (a crescent wave with spikes erupting from the ground)
  [M, REF-BREAKDOWN]; ref 05 row 6 (the floor shadow stays put and shrinks to show airtime)
  [visible].
- **Timing source:** RESEARCH 2.1 (hit 4 in Flins' and Skirk's strings lands at 11–20 f [M,
  gcsim]). Motion: UAL2 "Attack Ground Pound" for the chop; CMU subject 88 (flips, spin kicks)
  for the vault arc; CMU's terms allow retargeting [S, MOTION-SOURCES].

### N5 "Agnus Dei": the glass saint and the glass ring (`m1_5`, finisher)

**Idea:** she tears the glaive free into a wound coil, and while she holds it a stained-glass
saint 2.5 times her height fills in behind her. She unwinds in one snap into a full-circle sweep
and kneels; the saint flings its arms wide with her. The sweep hardens into a ring of glass round
her that expands to both sides and shatters, and the saint breaks with it, its glass falling
into the ring and erupting as a row of spikes. Coil, then release.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–8 | A1 ×4, A2 ×4 | A1 yanks the glaive out from behind; A2 swings it up behind her in a back-arc (visual only) |
| **Held coil** | f9–22 | A3 ×14 | deep crouch, back three-quarters to camera, glaive flat behind her at hip height, **every sleeve, ribbon and the hair wound round her the same way**. The glass saint assembles behind her. |
| Unwind (the snap) | f23–26 | A4 ×4 | one release drawing: hips already round, shoulders following, glaive still trailing flat behind |
| Strike | f27–29 | S1 ×1, S2 ×1, S3 ×1 | the spin in three smear drawings, 1 f each: back half of the ellipse, the whole ellipse, the brightest leading edge |
| Contact + hitstop | f30–37 | C1 ×8 | front, arms extended, the sleeves flung out on the trailing side; the saint flings its arms wide behind her |
| Ring forms | f38–47 | F1 ×5, F2 ×5 | she sinks into a kneel; the ellipse doesn't decay, it "leads" into a hovering glass ring at hip height |
| Ring expands, shatters | f48–54 | K1 ×7 | the ring widens from ±1.6 H to ±2.4 H in 6 f; at f54 the ring and the saint shatter together and 8 spikes erupt along the ring |
| Amen kneel | f55–67 | K1 ×13 | a symmetrical end pose, glaive upright |
| Recovery | f68–94 | R1 ×9, R2 ×9, R3 ×9 | rising |

- **14 drawings, 94 f**, plus 2 glass-saint drawings (below).
- **Why the coil is 14 f and the unwind 4 f.** Revision 1 had an 8 f coil, then 8 f of unwind
  over 2 drawings, then 5 f of spin: 13 f from releasing the coil to the hit, which reads as a
  second wind-up. It also broke section 0.1's rule that frames go before or after key poses,
  never between them. Now it's 7 f from release (f23) to contact (f30): one release drawing
  and three 1 f smears. The 6 f saved went into the coil hold, so contact stays at f30, inside
  the measured 29–35 f [M, RESEARCH 2.1]. The 14 f coil is longer than RESEARCH 3.3's suggested
  6–8 f; that number is a proposal, not a measurement, and the saint filling in turns the hold
  into anticipation you can watch. A/B the coil at 10, 14 and 18 f; contact moves to f26 or f34
  with it, and f26 falls just outside the measured range.
- **Cancels:** dash, jump, Q or R from f50 (20 f after contact, as RESEARCH 3.3 suggests) · a new
  string from f72 · walk from f76. **I-frames:** none. **Poise armour** f9–29 (hits damage her but
  don't interrupt the coil; engine ask, section 8). The ring and spike hits at f54 belong to the
  effect, not to her frames (section 8, item 2), so a cancel at f50 doesn't lose them. Until
  persistent effect hitboxes exist, open that cancel at f57 instead.
- **Root motion:** −6 px in the coil, +10 px in the spin.
- **Hit areas:**
  - Sweep (f27–31, group `a`): flat ellipse ±1.6 H (3.2 H wide) by 0.55 H, knee to chest:
    `{x: -154, y: -79, w: 308, h: 53}`. Her own glaive reaches that far: 1.35 H held at the butt
    plus her arm reach (`DESIGN.md` section 7). Knockback `[3.0, -1.5]`, hitstop 8, heavy.
  - Ring (f54–56, group `b`): a band ±2.4 H (4.8 H) by 0.35 H at hip height, the inner ±0.8 H
    left out: `{x: -230, y: -69, w: 153, h: 34}` and `{x: 77, y: -69, w: 153, h: 34}`.
    Knockback `[2.4, -3.0]`, hitstop 4.
  - **Spikes** (f54–58, group `c`): 8 spikes at ±0.9, ±1.4, ±1.9 and ±2.4 H, 0.9, 1.1, 1.3 and
    1.5 H tall, taller toward the ends, so the widest part of the finisher is also the tallest.
    **5.0 H across (480 px), up to 1.5 H (144 px).** Four boxes: `{x: 77, y: -106, w: 77,
    h: 106}` and `{x: 154, y: -144, w: 86, h: 144}`, and their mirrors `{x: -154, y: -106,
    w: 77, h: 106}` and `{x: -240, y: -144, w: 86, h: 144}`. Knockback `[0.5, -3.5]` (launched
    up), hitstop 4. They reach the whole turret from the floor, and enemies standing on the
    74 and 96 px platforms (Width check).
  - **Panes widen the ring** (second build): each pane absorbed (up to 4) adds 0.3 H per side, up
    to ±3.6 H (7.2 H, 691 px), past both edges of the view. The panes dive into the ring as it
    forms and show as brighter gilded segments. The spikes spread out along the wider ring.

**The glass saint.** This is the base kit's large second body, which RESEARCH 3.2 calls the
strongest tool a 96 px character has (an apparition 2–4 H tall). It's Judgment's ghost weapon,
redrawn as her own glass likeness.

- **What it is:** her own model with the glass material, rendered at 2.5x (240 px standing) on
  the same pixel grid (`DESIGN.md` section 12). Its feet are on her pivot, on the back layer.
  Cells come from the material-ID pass, with leading wherever the material changes.
- **Faceless.** The head is the veil and one A3 cell, so there's never a second, bigger face to
  author and keep on model (`DESIGN.md` section 5).
- **Two drawings, and neither copies her pose,** so it reads as a window saint behind her
  rather than a big copy of her:
  - G1 "vigil": standing, hands joined at the chest, its glaive upright beside it as a cross
  - G2 "gloria": arms flung wide, sleeves open, glaive held out flat; about 2.5 H tall and 2.5 H
    across
- **Timeline:**
  - f9–22: G1 assembles from the floor up, about 6 cells lighting per frame, under the guide
    ellipse. It's whole by the end of the coil, so the hold becomes something you watch fill.
  - f23–29: G1 holds; its edge cells step up to A3.
  - f30: G2, together with her contact drawing. This is the string's screenshot frame.
  - f31–53: G2 holds behind the forming ring; the ring's back half passes in front of its shins.
  - f54: it shatters with the ring. Its cells fall into the floor along the ring, and the spikes
    that erupt are made of its colours.
- **It doesn't hit on its own.** Its shatter is the spike hit, so the big body pays off as the
  tall hit.
- **Readable behind her:** one ramp step dimmer than her effects (A1/A2 cells, A3 edge, A0
  leading, A5 only on its glaive's edge) and 2.5 times her size, so it can't be mistaken for
  her. She keeps her outline in front of it (rubric 12).

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Anticipation | back-arc | f5–8 | non-hitting halo smear behind her, 1.2 H | A3/A2, no core |
| Coil | **guide ellipse** (telegraph) | f9–26 | dotted 1 px ellipse at the ring's final radius, ±2.4 H, 12 px tall, on the floor | A3 at 50% dither |
| Coil | glass saint G1, assembling | f9–29 | 2.5x render, back layer, cells lighting from the floor up | A1/A2 cells, A3 edge, A0 leading |
| Unwind | spin lines | f23–26 | 2–3 thin curved 1 px arcs round her | W2 |
| Strike | main arc | f27–37 | flat ellipse 3.3 H × 0.6 H, back half on the back layer (dimmer), front half on the front layer | A5 edge, A3/A2, A1 |
| Contact | core flash | f30–31 | 13 px star at each contact | A5, A4 |
| Contact | contact halo | f30–33 | 1.5 H across at each contact (section 0.13) | A4, A3 → A2 |
| Contact | glass saint G2 | f30–53 | arms wide, about 2.5 H tall and across, back layer | as G1; glaive edge A5 |
| Ring | glass ring | f38–54 | the ellipse becomes 16–24 leaded cells, then widens; back half dimmer, behind her | A1–A3 cells, A0 leading; gilded segments G2 |
| Shatter | shards | f54–80 | every ring cell breaks into 2–3 shards thrown outward and up; the saint's cells fall into the ring | A2/A3, A5 glints |
| Shatter | spikes | erupt f54–56, full f57–58, then the glass decay to f72 | 8 jagged spikes along the ring, 0.9 → 1.5 H tall toward the ends; N4's spike design at larger sizes | A1–A3 cells, A0 leading, A5 tips |
| Ground | dust and floor light | f30–60 | stepped dust band ±2.6 H; a 12 px floor light band under the ring | W3, W4; A3 |
| Ground | glyph | f54–110 | gold tracery lines on the floor under the ring, fading | G2 → G3 |

- **Rim and light:** during the coil the background dims to 80% (f9–22) and the saint behind
  her is her light: a light at the saint's chest (A3, radius 200, intensity 0.9, f9–54, cool
  family) backlights her, so the rim sits on her back edges while she's wound. Most of those
  edges are the white back and tabards, which is exactly the case `DESIGN.md` section 9's lit
  outline fixes. From the spin, a light at the ring's brightest segment (A4, radius 160,
  intensity 1.6, f27–60) rims her waist on that side; while she kneels, the floor band lights
  her from below.
- **Camera:** 2 px push back during the coil, 3 px forward on contact; 3 px shake for 16 f on the
  shatter.
- **SFX:** coil: a held breath and fabric creak, under a rising glass shimmer as the saint fills
  in (f9–22); **silence f27–29**; spin: a wide whoosh with glass shimmer; contact: `bell.big` and
  a choir swell as the saint opens its arms (f30); shatter: a glass crash under a choir chord
  that resolves the string's rising chimes (f54).
- **Informed by:** ref 11 (a 4.2 H horizontal slash with dust spreading wider than the arc) [M];
  ref 12 E (each stage adds a layer, ending in a crescent plus a field of ground spikes) [M];
  Laevatain's 360° fire ring, which spreads past both screen edges in about 0.3 s [M, RESEARCH
  1]; RESEARCH 3.2's large-apparition row [I, from the sourced examples].
- **Timing source:** RESEARCH 2.1 and 3.3 (finishers land at 29–35 f and recover in 58–72 f [M,
  gcsim]; a held coil of 6–8 f and a freeze of 7–9 f are the research sheet's suggestions [I]).
  Motion: Mixamo "Standing Melee Attack 360 High" (a clip name seen in third-party credits, not
  yet verified inside Mixamo; needs Dex's Adobe sign-in); UAL2 "Sword Regular C" and the full
  combo clip [S, MOTION-SOURCES].

---

## 2. M2: "Procession" (dash), Sanctuary, Aspersion

### Procession: the dash (`dash`)

**Idea:** a gliding pirouette that leaves stained-glass copies of her silhouette behind.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Startup | f1–3 | D1 ×3 | leans in; hair, veil and stole snap back; dust puff |
| Travel | f4–17 | D2 ×3, D3 ×4, D4 ×4, D5 ×3 | the pirouette: D2 turning away; D3 back to camera with the cloth wrapped round her; D4 coming round as the cloth opens; D5 facing front, leaning back to brake |
| Brake | f18–23 | D6 ×3, D7 ×3 | skids; sleeves and tabards overshoot forward, then settle |

- **7 drawings, 23 f.** Hair and veil are the lead flag.
- **I-frames f3–18** (16 f). **Perfect-dash window f3–10.**
- **Root motion:** 176 px (1.83 H): 110 px over f4–9, 58 px over f10–17, an 8 px skid over
  f18–23. The fast start and eased end are the snap.
- **Cancels:** Aspersion (M1) from f10 until 8 f after the dash ends · Q or R from f10 · jump from
  f6 · a second dash from f20. After two dashes in a row, 36 f before the next (Genshin also locks
  repeated dashes over a 0.8 s window [S, RESEARCH 2.3]).
- **In the air:** the same timing, no dust, gravity 0 over f3–17.
- **Hit area:** none.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Startup | dust | f1–10 | puff behind, 10–14 px | W3, W4 |
| Travel | glass afterimages | spawn f4, f8, f12; each lives 24 f | her own silhouette from that drawing filled as stained glass: flat A2 body, A3 on panels facing the light, A4 along the leading edge, A0 leading along her real interior lines (from the material-ID pass). Decay: 8 f full, 8 f leaded lines only, 8 f falling shards. Together they span about 2.3 H. | A0–A4 |
| Travel | floor streak | f4–30 | 1 px light line along the floor under her path, fading from the tail | A3 → A1 |
| Brake | dust | f18–26 | skid puff, 10–14 px | W3, W4 |

- **Rim and light:** a light attached to her back (A4, radius 80, intensity 0.8, f4–18); the
  afterimages rim her trailing edge.
- **Camera:** a 4 px push in the dash direction that shrinks 15% each frame (deepnight's camera
  bump [S, RESEARCH 2.6]). No shake.
- **SFX:** `silk.whirl`, a soft glass shimmer, a breath from the choir.
- **Informed by:** ref 05 row 3 (a dash into an attack), ref 06 (the trail behind a lunge),
  ref 11 row 4 (a horizontal dash-slash over dust) [M/visible, REF-BREAKDOWN].
- **Timing source:** RESEARCH 2.3 (Genshin's dash is about 20 f, invulnerable from about f3 to
  f24; Wuthering Waves' dodge 22 f with 19 invulnerable [S, weak]). Motion: UAL2 "Sword Dash RM";
  Bandai Namco `dash_feminine_001` (timing; the non-commercial question applies); Dolphin_664's
  glide dash, BowlRoll 103142 (timing only) [S, MOTION-SOURCES].

### Sanctuary: the perfect dash

**Idea:** dodge at the last moment and the copy she leaves becomes a glass saint that takes the
hit for her.

| Beat | Real frames from the trigger | What happens |
|---|---|---|
| Trigger | +0 | an enemy hitbox or projectile overlaps her hurtbox during dash f3–10. On the test map, the turret's shots are the target. |
| Saint pane | +0 to +8 | the afterimage nearest the hit becomes a full-colour glass statue of her dash pose and takes the blow |
| Shatter | +8 | the statue breaks into 12–16 shards; 13 px star; `bell.clear` |
| Slow motion | +0 to +30 (0.5 s) | the world drops to 0.3x (the contract's `slowmo`, factor 0.3), snapping in over 3 f and easing out over 12 f; she keeps full speed. The world desaturates 30% while it lasts. |
| Rim | +0 to +6 | a gold rim (light: G1, radius 90, intensity 1.4, 6 f) |
| Follow-up | M1 within 40 real frames | Aspersion is upgraded to **Absolved** (below) |

- **Source:** 0.3x for about 0.5 s, fast in and eased out, is RESEARCH 3.3's profile from
  deepnight's demo [S, RESEARCH 2.7]; Wuthering Waves and ZZZ both slow time on a perfect dodge
  [S, RESEARCH 2.3].

### Aspersion: the attack out of the dash (`dash_attack`)

**Idea** (grafted from Judgment's Summary Judgment): she cuts straight through the enemy line
without stopping and walks away with the glaive on her shoulder. The cut hangs in the air as a
glass seam; 12 f later it shatters behind her, spraying glass droplets like holy water from an
aspergillum.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Anticipation | f1–3 | A1 ×3 | still sliding low; glaive drawn back at the hip in both hands |
| The pass | f4–9 | S1 ×2 (smear), P1 ×4 | S1: one long straight passing cut. P1: extended, sliding through the enemies |
| Walk-away | f10–15 | W1 ×6 | straightens and swings the glaive onto her shoulder, back to the enemies; the stole streams (lead flag) |
| Verdict | f16–27 | V1 ×12 | the calm pose, hair and veil settling; **the seam shatters behind her at f22** |
| Recovery | f28–41 | R1 ×7, R2 ×7 | back to ready |

- **7 drawings, 41 f.**
- **Cancels:** M1 continues the string at **N3** from f28 (Aspersion counts as N2) · dash, Q or R
  from f24 · walk from f30. **I-frames:** f1–3 (carried over from the dash).
- **Root motion:** +40 px over f1–3 (the dash's momentum), +80 px over f4–9, +8 px over f10–15:
  128 px (1.33 H).
- **Hit areas:**
  - **The pass** (f4–9, group `a`): a box that moves with her, `{x: -10, y: -106, w: 100, h: 96}`,
    sweeping about 2.2 H of floor. Each enemy it touches **freezes for 12 f and she doesn't**:
    she keeps sliding (victim-only hitstop, section 8). Knockback 0 (they're held for the
    verdict).
  - **The verdict** (f22–25, group `b`): the seam runs from 0.3 H behind the start point to
    2.3 H past it (2.6 H, 250 px), floor to 0.9 H. It's fixed in the world, so it's a persistent
    effect hitbox (section 8); fallback: author it per frame against her root motion, as N4's
    spike row. Knockback `[1.5, -3.0]`, hitstop 5 (victims only).
  - **Droplets** (f26–36): 7 hitboxes of 12×12 px landing 1–2 f apart along and just past the
    seam; small hits, hitstop 1.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Pass | smear | f4–9 | straight horizontal wedge 150 × 10 px with a needle-thin tail | A5 edge, A3/A2 |
| Pass | cut lines | f4–21 | 1 px line across each victim | A5 |
| Pass | afterimages | f4, f7 | 2 glass silhouettes (as the dash) | A0–A4 |
| Walk-away | seam hardens | f10–21 | the whole cut becomes a 3 px leaded glass line glinting along its length | A2/A3 cells, A0 leading, A5 glints |
| Verdict | the shatter | f22–25, then the glass decay | the seam opens 1 → 3 → 12 px in 4 f, then leaded, then shards bursting upward | A5 core, A4, A3/A2 |
| Verdict | droplets | f22–36 | 7 beads, 3×3 (A4 core, A2 rim), on arcs up and forward; each landing makes a 7 px star and a white-azure floor splash 16 × 4 px | A4, A2; W1/A4 splash |

- **Rim and light:** the shatter goes off behind her, so a light at the seam's centre (A4, radius
  160, intensity 2.0, 20 f from f22) **backlights her walk-away**: rim on her back edges only.
- **Camera:** nothing on the pass; 2 px shake for 8 f at the verdict.
- **SFX:** a clean "shhk" on the pass (f4); ambience ducks during the walk-away (f10–21); two boot
  clicks; `glass.crack` + a mid bell at f22; seven quick glass ticks as the droplets land.
- **Absolved** (Aspersion within 40 f of a Sanctuary): the seam's shatter also fires the broken
  saint's 12–16 shards in a 30° fan toward the attacker, reaching 3.0 H (each shard a 6×6 hitbox,
  hitstop 1), and a 1.1 H glass spike bursts under the attacker (N4's centre spike, reused).
  This replaces Liturgy's separate "Pax" counter.
- **Informed by:** ref 06 (lunge trail, speed lines), ref 11 row 4, ref 12 (white ground splashes)
  [M/visible]; Fleurdelys's cut landing before her colour explodes [M, RESEARCH 2.4]; Alice ending
  her charged attack by walking away [S, RESEARCH 1]; ZZZ putting the personality in the dodge
  counter rather than the dash [S, RESEARCH 2.3].
- **Timing source:** RESEARCH 2.3 and 2.4 (the delayed payoff). Motion: UAL2 "Sword Dash RM"
  running into "Sword Regular C" [S, MOTION-SOURCES].

---

## 3. Q: "Nave" (`skill_q`)

**Idea:** she lifts the glaive overhead and twirls it, rising weightless onto her toes, then
stamps the butt down. A row of tall lancet windows rises out of the ground on both sides. They
stand as wards that block shots. When the player presses Q again (or after 2 s), everyone inside
floats for a beat, gold vault arches join the lancet tips, and the whole nave shatters outward.

| Phase | Frames | Drawings × hold | What you see |
|---|---|---|---|
| Raise | f1–6 | Q1 ×3, Q2 ×3 | glaive lifted flat overhead in both hands; the sleeves slide to her elbows (lead flag); the rose disc lights |
| Overhead twirl (float) | f7–20 | T1–T4 ×2 each, looped (14 f) | the glaive spins flat above her head; she rises onto her toes, sleeves and hair drift up, gold motes spiral in |
| Stamp (the fall) | f21–23 | Q3 ×2 (stretch, glaive snapped upright), Q4 ×1 (smear, butt driven down) | |
| Contact + hitstop | f24–29 | Q5 ×6 | butt strikes the floor at f24; local flash; crack |
| Lancets rise | f30–33 | Q6 ×4 | rising from the stamp |
| Benediction | f34–63 | Q7 ×30 | glaive planted, right hand raised with two fingers in blessing, head tilted, sleeves settling. **This is Q's beauty frame.** Pairs of lancets rise at f30, 33, 36, 39, 42. |
| Recovery | f64–81 | Q9 ×8, Q10 ×10 | |

- **14 drawings** (Q1–Q10 and T1–T4). **Control returns at f52**: any input leaves the pose and
  the lancets stay standing.
- **I-frames:** f21–30 (the stamp).
- **Cooldown:** 8 s, shown on the blade's glass spine (`DESIGN.md` section 10).
- **Root motion:** none (a planted ritual).

**The lancets.** Five pairs, rising outward and taller toward the outside:

| Pair | Rises at | Position | Height | Width |
|---|---|---|---|---|
| 1 | f30 | ±0.5 H (±48 px) | 0.7 H (67 px) | 24 px |
| 2 | f33 | ±0.95 H (±91) | 0.85 H (82) | 24 |
| 3 | f36 | ±1.4 H (±134) | 1.0 H (96) | 24 |
| 4 | f39 | ±1.85 H (±178) | 1.15 H (110) | 24 |
| 5 | f42 | ±2.3 H (±221) | 1.3 H (125) | 24 |

- **Wards** (from Judgment): while standing, each lancet blocks any enemy projectile that touches
  it; the projectile breaks against the glass with a 5 px A4 star. On the test map, a lancet
  between her and the turret eats its shots.
- **The shatter** is triggered by **pressing Q again** from f44 on, or automatically **120 f
  after the stamp's contact** (f144). Timeline from the trigger, t0:
  - t0–t9, **the float** (from Halo's collapse): every enemy inside the nave lifts 16 px with
    gravity off; the lancets brighten one step; 1 px G1 **vault arches** join the lancet tips
    into pointed Gothic arches (t2–t9), so for a moment the nave has a ceiling. Sound drops to
    silence over t6–t9.
  - t10, **the shatter**: every lancet breaks outward at once; lifted enemies are slammed back
    down. If she's still in Q7, she plays Q8 ×4 (closing the raised hand).
  - Pressing Q twice quickly gives the earliest shatter at f54.
- **Hold version** (second build): holding Q through the twirl keeps it looping; every 18 f held
  adds one more pair 0.45 H further out and 0.15 H taller, up to 3 extra pairs (54 f). Release
  to stamp. She's rooted while holding, with no i-frames. This is the player building the area,
  like Roxy's tornadoes and Hiyuki's hold [S, RESEARCH 1].
- **Panes** (second build): at the stamp, loose panes fly down into the row; each pane adds a
  gilded pair at the outer end. Hold and panes together add at most 4 pairs.

**Hit areas** (the lancets and the shatter outlive her animation, so they're persistent effect
hitboxes, section 8):

- **Stamp shock** (f24–26): a floor band ±0.8 H by 0.25 H, `{x: -77, y: -24, w: 154, h: 24}`.
  Knockback `[2.0, -2.0]`, hitstop 6.
- **Each rising lancet** (3 f from its rise): 24 px wide by its height, at its position. A small
  launch (knockback `[0, -2.0]`), hitstop 2.
- **Shatter** (t10–t12): from ±0.3 H to ±2.8 H, floor to 1.8 H: `{x: -269, y: -173, w: 240,
  h: 173}` and `{x: 29, y: -173, w: 240, h: 173}`. **5.6 H across (538 px, 84% of the view).**
  Knockback `[2.5, 2.0]` (slammed down out of the float), hitstop 8 (victims), heavy. With 4
  extra pairs it reaches ±4.1 H (8.2 H), and the outer lancets rise off-screen: the screen edges
  become part of the nave.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Raise | disc glow | f1–20 | the rose disc lights to A4 | A4 |
| Twirl | converging motes | f7–20 | 12–16 gold pixels spiralling in to the glaive | G0, G1 |
| Twirl | overhead smear | f7–20 | flat ellipse 1.8 H above her head, looping; back half dimmer on the back layer, faster across the front | A4 edge, A3/A2, G1 slivers |
| Twirl | rising motes | f7–20 | 6 motes lifting off the floor round her feet (the float cue) | A4 |
| Stamp | core flash | f24–25 | 13 px star at the butt | A5, A4 |
| Stamp | contact halo | f24–27 | 1.5 H across, behind her (section 0.13); replaces revision 1's solid A5 disc, which would have hidden her | A4, A3 → A2 |
| Stamp | floor crack | f24–90 | 1.6 H crack drawn as leading | A0, A3 glow |
| Stamp | dust | f24–50 | stepped dust band spreading to ±3 H | W3, W4 |
| Lancets | rise | 3 drawings each (1 f crack flash, 2 f half height, then full) | pointed-arch panes 24 px wide, 67–125 px tall; 3–5 cells each (A1, A2, A3, a G2 cell at the tip), A0 leading, 1 px A4 glow. A 12 px A3 floor light band joins their bases. Lancets on the back layer; the floor band on the front. One design at five heights, made by repeating the middle rows so the pixel grid holds. | A0–A4, G2 |
| Float | vault arches | t2–t9 | 1 px pointed arches joining the lancet tips | G1 |
| Shatter | shards | t10–t40 | 6–10 shards per lancet thrown outward and up to ±3.0 H; a 1 f star at each lancet's centre | A1–A5 |
| Linger | glyphs | t10–t70 | a short gold tracery mark on the floor at each lancet base, fading | G2 → G3 |

- **Rim and light (choreographed):** each lancet pair spawns a pair of lights at its base (A4,
  radius 70, intensity 0.9, lasting until the shatter). As pairs rise inner to outer, **the rim
  appears on both her flanks and walks outward**, strongest from the pair that just rose. Rim on
  both sides, never top and bottom together. During the twirl, the disc's light puts a thin A4
  rim across her top.
- **Camera:** 2 px push down on the stamp (a bow); 2 px shake for 12 f on the stamp and 3 px for
  18 f on the shatter; the background dims to 70% from f34 while the glass glows, and comes back
  over 20 f after the shatter.
- **SFX:** raise: a rising choir vowel over the twirl's whoosh; stamp: `bell.bourdon` + stone
  crack; lancets: ascending glass chimes, one per pair; wards blocking a shot: a bright glass
  "tik"; float: a soft organ chord, then silence t6–t9; shatter: a big glass crash with the choir
  cut into its reverb tail.
- **Informed by:** ref 12 E (a crescent plus a field of ground spikes, escalating stage by
  stage) [M]; ref 08 (flash and ground burst) [visible]; ref 11 (dust wider than the effect) [M];
  Flins' follow-up hits after control returns [M, RESEARCH 1]; Roxy gathering tornadoes and
  Hiyuki's hold [S, RESEARCH 1].
- **Timing source:** RESEARCH 3.3's Q sheet (a 20–30 f wind-up with a gathering glow, 6–9 f
  hitstop, 3–5 H wide, delayed secondary hits) [I, from measured data]. Motion: ジュウ's
  "twirl into attack", BowlRoll 62565 (the overhead twirl into the stamp); UAL2 "Attack Ground
  Pound" (the stamp); UAL2 "Spell Simple Shoot" (the blessing hand); MotionPackage Pro 剣's spear
  stance if Dex buys it [S, MOTION-SOURCES].

---

## 4. R: "Te Deum" (`ult_r`)

**Idea:** time stops and the level goes dark as a nave. A rose window draws itself behind her
head and pours full of glass; she's backlit in front of it. Then the window breaks outward in
waves across the whole screen, and the ultimate ends by crossing out the screen with its own
vertical and horizontal beams: a grey world frozen on a cross of light, then colour flooding
back out along the lines.

**The shape** follows the four ultimates measured in RESEARCH 2.4: a cut-in onto a dark stage
with the character rim-lit, anticipation to the first flash, held impact frames, a total freeze,
and a return with effects still running [M]. Our numbers against theirs:

| Beat | Ours | Measured [M, RESEARCH 2.1, 2.4] |
|---|---|---|
| Press to first hit | f95, 1.58 s | Genshin 93–109 f (1.55–1.8 s); first big flash 0.9–2.5 s |
| Total freeze | 22 f, 0.37 s | Alice 0.23–0.43 s |
| Control returns | f209, 3.48 s | totals 3.4–6.5 s; RESEARCH suggests 3.5–4.5 s for a web toy |
| Effects end | f270, 4.5 s | – |

**Where the rose sits:** its centre (the oculus) is behind her head, the saint-with-halo image.
It's 344 px across (3.6 H), the view height less an 8 px margin, and whatever falls below the
floor line is hidden behind the floor, like a sun half risen. 16 outer lancets extend the design
to 460 px (4.8 H). It's a flat disc facing the camera, so the side view needs no perspective
trick. If she's within 1.2 H of a screen edge, the camera pans (whole pixels, at most 8 px per
frame, eased) to centre her.

**Stage rules:**

- **Freeze f1–196:** everything but her and her effects stops: enemies, the turret, projectiles.
  Frozen enemies still register hits (they flash A4 and shake 1 px) and their knockback is
  stored; it all fires at f197.
- **Dim:** the world steps down 100 → 60 → 35 → 25% over f1–4 with an indigo tint; enemies stop
  at 40% so targets stay visible.
- **Bars:** CANON's black cinematic bars close in 16 px over f1–12 and open over f197–208.
- **I-frames f1–208.**

| Frames (time) | Her drawings | What happens |
|---|---|---|
| f1–6 (0.00 s) | – | time stops; the world dims; the bars start closing |
| f1–24 (0–0.4 s) | cut-in | a 640 × 96 band across the middle of the view: her bust, eyes opening as the irises ignite A4, gold rim, glass cells behind her. Slides in over 6 f in whole-pixel steps, holds 12, slides out over 6. Three cut-in drawings: eyes shut, eyes opening, eyes open and ignited. |
| f25–32 | L1 ×4, L2 ×4 | **the float:** she rises 24 px lifting the glaive upright in front of her (the processional-cross pose); hair and every lining rise |
| f33–44 | L3a / L3b alternating every 8 f (a floating loop for hair and cloth), through f90 | the tracery draws itself: a bright gold point traces the outer circle (12 f); 8 spokes shoot out at 45° steps (f41–44) |
| f45–56 | floating | 8 petal circles drawn |
| f57–72 | floating | glass pours in: cells fill clockwise, about 6 per frame. **The rim walks clockwise round her** with the filling. |
| **f73–90 (0.3 s)** | floating | **beauty hold.** The full rose glows behind her and she's backlit: rim along her top and outer edges, her front in lavender shade. The donation screenshot. |
| f91–94 | C1 ×2, C2 ×2 | the consecration: one vertical twirl of the glaive in front of the oculus (a 1.6 H disc of smear). **Silence.** |
| **f95–96** | C2 held | **flash 1:** full-screen A5 for 2 f. **Hit 1:** the whole view. |
| f97–112 (0.27 s) | I1 ×8, I2 ×8 | impact frames: the world goes A0 navy; the rose and her silhouette go A5 with A0 leading. Each drawing lights more of the rose, inside out. The dark background holds steady, so nothing strobes. |
| f113–128 | P1 ×16 | colour returns. **Wave 1:** the 8 inner petals break off and sweep outward as a clockwise pinwheel of crescents; she sweeps the glaive clockwise |
| f129–144 | P2 ×16 | **Wave 2:** the 16 outer lancets fire along the 8 axes to the view edges: the horizontal pair crosses the full width, the vertical pair the full height, the diagonals make an X. She thrusts the glaive skyward. The vertical beam passes behind her: **for 4 f (f129–132) she's a dark silhouette rimmed on both sides.** |
| f145–156 | L4 ×6, L5 ×6 | **Wave 3, the fall:** the gold tracery snaps and breaks outward; she drops out of the float (L4 stretched, speed lines) and lands kneeling (L5 squash, cloth crashing down) |
| f157–160 | K1 | **the world greys** in 2 steps. Everything stops except the cores of the horizontal and vertical beams, which stay as 2 px A5 lines with a 1 px A4 glow: **a cross over the whole screen**, through the oculus behind her |
| **f161–182 (0.37 s)** | K1 | **total freeze.** Nothing moves, not even particles; shards hang mid-air. She kneels with the glaive upright beside her. Real silence. |
| f183–194 | K2 ×12 | the lines thicken 2 → 4 → 8 px (4 f each); she lifts her eyes to the camera, irises ignited. **Silence f191–194.** |
| **f195–196** | K2 | **flash 2:** warm gold-white `#fffbe8`, 2 f, 100 f after flash 1. **Wave 4, the execution:** the vertical line opens to 48 px and the horizontal to 40 px in 3 f; everything on screen takes the final hit. |
| f197–208 | K2 | **colour floods back outward from the two lines** over 12 f; stored knockback fires; the bars open; the frozen shards fall as glass rain |
| **f209 (3.48 s)** | – | **control returns**; Illumination begins |
| f209–270 | – | the rain keeps falling; shards landing on enemies deal small delayed hits until f245; the lines decay (stripes, slivers) by f230; the last shards fade by f270 (4.5 s) |

- **12 sprite drawings** (L1, L2, L3a, L3b, C1, C2, P1, P2, L4, L5, K1, K2) plus 3 cut-in
  drawings. I1 and I2 are palette swaps of L3 and the rose, not new drawings. Few drawings, long
  holds, effects carrying the motion: Guilty Gear's limited-animation approach [S, RESEARCH 2.10].
- **Hit areas** (all during the stage freeze, so knockback is stored and hitstop is 0):
  - Hit 1 (f95): the whole view. Light damage, stagger.
  - Wave 1 (f113–116): a ring round the oculus from 0.4 to 1.9 H (3.8 H across).
  - Wave 2 (f129–132): 8 beams 20 px thick from the oculus to the view edges; the horizontal
    beam is 640 px wide, the vertical 360 px tall.
  - Wave 3 (f145–148): a 3.6 H circle round the oculus.
  - Wave 4 (f195–198): the whole view plus 1 H past each edge, every height. Maximum stagger;
    stored knockback `[3, -5]`.
  - Glass rain (f209–245): 36 falling 6×6 hitboxes across the full width, hitstop 1.

| Phase | Layer | Frames | Shape and size | Colours |
|---|---|---|---|---|
| Stage | dim | f1–196 | world palette-mapped to 25% with an indigo tint; enemies to 40% | I4, I3, A0 |
| Cut-in | panel | f1–24 | 640 × 96 band on the same pixel grid: a bust render of her model with a pixel paint-over on the face (`DESIGN.md` section 12) | full sprite palette, A4 rim |
| Tracery | gold lines | f33–56 | 1 px gold: circle, 8 spokes, 8 petal circles. One 45° wedge drawn; the other 7 are exact flips and 90° turns. | G1, G2 |
| Glass | cells | f57–112 | about 96 cells: outer ring cobalt and azure, petal hearts amethyst (the only amethyst in the kit), oculus gold with an A5 core; all A0 leading | A1–A4, V1–V3, G2, A5 |
| Flash 1 | full screen | f95–96 | – | A5 |
| Impact | two-tone | f97–112 | palette swap, held on eights | A0, A5 |
| Wave 1 | crescents | f113–128 | 8 crescents sweeping 45° each, 0.9 → 1.9 H radius. Two crescent drawings (one on an axis, one on a diagonal), each turned 4 times losslessly. | A5 edge, A3/A2, V2 heart |
| Wave 2 | beams | f129–144 | 16 straight streaks along the 8 axes, 20 px thick, off-screen | A5 core, A4, A2 body |
| Wave 3 | tracery break | f145–156 | tracery snaps into gold slivers flying outward | G0–G3 |
| Cross | lines | f157–194 | 2 → 4 → 8 px lines, full width and full height | A5 core, A4 glow; world in greys (W4, I4, A0) |
| Flash 2 | full screen | f195–196 | – | `#fffbe8` |
| Wave 4 | execution | f195–208 | lines open to 48 / 40 px; 30 indigo shards and 40 gold 3×3 cross sparks; a colour wipe spreading outward from the lines | A5, A4, G1; I4 shards |
| Rain | shards | f197–270 | 40–60 shards 2–4 px, glinting | A1–A5, V2 |
| Ground | floor | f197–260 | full-width stepped dust and a floor light band | W3, W4, A3 |
| Scar | floor | f197–440 | a cross-shaped burn: a light line along the whole floor and a mark under the vertical line, cooling to indigo | A3 → A0 |

- **Rim and light (choreographed):**
  - f25–56: a gold light at the tracery's drawing point (G1, radius 120, intensity 1.0): rim
    from above and behind.
  - f57–72: **8 short lights at the 8 petal positions, 2 f apart, clockwise** (A4, radius 140,
    intensity 1.4, 4 f each): the rim walks clockwise round her silhouette as the glass pours.
    The contract has no moving light, so this uses 8 static ones.
  - f73–90: one light at the oculus behind her head (A4, radius 360, intensity 2.0): **backlit**,
    rim on her top and outer edges only.
  - f129–132: the vertical beam behind her: body one band darker, rim on both flanks.
  - f195–200: a gold light in front (G0, radius 300, intensity 2.4): **bathed in light**, front
    lit, outline kept.
- **Camera:** no zoom; bars close 16 px; the edge pan above; shake 2 px for 12 f on Wave 2 and
  4 px for 20 f on Wave 4; the cut-in stands in for the close-up the 3D games use (RESEARCH 3.2's
  option (a)). The lab's `cutinTicks` tuning is 54 today [M, `tuning.json`]; Te Deum uses 24.
- **SFX:** time stop: a reversed cymbal swell cut to silence, then one low organ note swelling;
  tracery: a quill scratch and a chime glissando; glass pour: a rising crystalline shimmer;
  consecration: silence; flash 1: a choir chord struck with `bell.bourdon`; waves 1–3: glass
  cascades, one per beat; the freeze: 0.37 s of real silence (CANON asks for intentional
  silence [S]); flash 2: full organ, choir and bell; colour flood: a rushing swell; resume: shard
  tinkles as the music eases back in over about 1 s (CANON: music never starts abruptly [S]).
- **Informed by:** ref 12 R (ring, light pillars, ground eruption), ref 11 (the widest arcs),
  ref 08 (the layer stack) [M/visible]; Laevatain's burning halo ring behind her and 0.8 s
  near-still hero hold; Alice's centred symmetry and final total freeze; Fleurdelys's grey,
  colourless world with the cut line through it and colour returning as an explosion along the
  cut; Skirk's radial fan round a dark core [all M, RESEARCH 2.4].
- **Timing source:** the beat structure and every duration above are built from RESEARCH 2.4's
  frame-by-frame measurements and gcsim's press-to-damage data [M]. Motion for her body: UAL2
  "Spell Simple Enter / Idle / Shoot / Exit" (the float and cast); ジュウ's twirl, BowlRoll
  62294 (the consecration); UAL2 "Attack Ground Pound" (the landing); MotionPackage Pro 必殺技's
  charge-and-release if bought [S, MOTION-SOURCES].

## 5. After R: "Illumination" (12 s)

The ultimate keeps paying off after the cutscene, the way Fleurdelys (12 s) and Laevatain (15 s)
change their basic attacks [S, RESEARCH 1].

- **The timer is in the world:** a 25 px rose window floats behind her shoulder. Its 8 panes go
  dark one every 90 f (1.5 s): 720 f in all. It orbits 4 px round her shoulder, back half behind
  her, faster across the front.
- **The glass ghost glaive** (Judgment's Headsman's Shade, redrawn in glass): 4 f after each
  N1–N4 swing, a stained-glass copy of Lancet swings the same arc again at **1.6x** the size
  round the same centre. It's a filled glass body (A1–A3 cells, A0 leading, A4 edge), rendered at
  1.6x from the weapon model (`DESIGN.md` section 12), and each swing is its own hit, hitstop 2.
  Horizontal spans: N1 4.0 H, N2 4.0 H, N3's twirls 3.5 / 4.0 / 4.5 H (cut off by the floor and,
  on the third, the top of the view), N4 4.0 H (the ghost's chop sends its own fissures ±2.0 H). Its hit areas are the
  move's boxes scaled 1.6x round the same centre. Revision 1 spanned 2.9–3.8 H with the old,
  narrower arcs.
- **N5 becomes "Agnus Dei: Rose":** the ring always expands past both view edges (at least 7 H)
  whatever the pane count, the spikes spread out along it, and the glass saint is gilded (gold
  leading).
- **Q** adds 2 pairs to the nave for free.
- **Every pane made during Illumination is gilded** (gold leading, amethyst darkest cell, 240 f
  life).
- **The end:** the last pane goes dark, the rose breaks into gold motes with one soft chime.
- **R's meter** starts refilling from zero; the glaive's disc cells show it (`DESIGN.md`
  section 10).

---

## 6. Flash budget

| Source | Full-screen flashes | When |
|---|---|---|
| R flash 1 | 1 (A5, 2 f) | f95 |
| R impact frames | 0 extra (a held dark swap that follows flash 1; no alternation) | f97–112 |
| R flash 2 | 1 (`#fffbe8`, 2 f) | f195, 100 f after flash 1 |
| Everything else | 0 (local stars and discs only) | – |

At most one full-screen flash in any 60 f window, under WCAG 2.3.1's three [S, RESEARCH 2.8;
M, arithmetic]. A flash governor (at most 3 per 60 f from all sources, section 8) and a "reduce
flashing" setting (40% tint) still ship, because enemies and the turret may add their own.

## 7. Drawing budget

How many unique drawings the moves need, so the scope is visible up front. Idle, run, jump and
hurt aren't counted.

The effect column counts effect drawings rendered from Blender geometry and touched up by hand
on the contact drawings (`DESIGN.md` section 12), not drawings made from scratch.

| Set | Character drawings | Effect drawings [I, estimate] |
|---|---|---|
| M1 (N1–N5) | 10 + 9 + 15 + 13 + 14 = 61 | about 26: N1's J-crescent and glass furrow; N2's ellipse front and back; N3's tip disc and thrown ring from one wedge each, and the mini-rose; N4's vertical crescent, fissure, and one spike design at 4 sizes; N5's spin ellipse, glass ring and 2 glass-saint renders; the contact halo at 2 sizes; the glass decay sets |
| M2, Aspersion | 7 + 7 = 14 (the afterimages and the saint are recolours of dash frames) | about 5: straight smear, seam, droplet, splash |
| Q | 14 | about 10: overhead ellipse loop, one lancet design at 5 heights, rise, shatter, arches |
| R | 12 + 3 cut-in | about 20: rose wedge (tracery and glass), 2 wave-1 crescents, beams, lines, cut-in |
| **Total** | **about 104** | **about 60** |

For comparison, ref 05 has about 147 drawings for a whole fighting-game character [M,
REF-BREAKDOWN]. [M, count for the character column]

## 8. Runtime contract fit and engine asks

**Fits today** (RUNTIME-CONTRACT [M]): clips and frames with `duration` and `hold`; hitboxes with
groups, knockback, stagger and hitstop; cancel windows; i-frames; root motion; anchors; events
for `vfx` (with `layer: "back"`/`"front"`), `light`, `shake`, `slowmo`, `cutin`, `sound` and
`impact`; the procedural effect kinds for greybox stand-ins.

**Needs engine work** (merged from all three concepts; proposals for the coordinator, nothing
changed here):

1. **Flipbook effect sprites:** an effect kind that plays pre-rendered frames with its own
   timing. Smears larger than the character's frame, lancets, spikes, the glass saint, the rose
   and the cut-in art need it.
2. **Persistent effect entities with their own hitboxes and lifetimes:** panes, N4's spike row,
   N5's ring and spikes (so a cancel at f50 doesn't lose them), Aspersion's seam and droplets,
   Q's lancets and shatter, R's rain. Today hitboxes live only on her animation frames.
3. **Wards:** effect entities that destroy enemy projectiles on contact (Q).
4. **Victim-only hitstop** (the attacker keeps moving): Aspersion's pass, and ideally every hit
   (RESEARCH 2.2's Genshin model). Today's `hitstop` freezes the whole simulation [M].
5. **Poise armour per frame:** N5's coil.
6. **Stage freeze with stored knockback** (R), and **enemy lift** with gravity off for a set
   time (Q's float).
7. **World palette events:** dim with a tint, grey out, desaturate (Sanctuary), and a colour wipe
   spreading outward from a line (R's colour flood).
8. **A flash governor** (at most 3 full-screen flashes per 60 f, all sources) and a "reduce
   flashing" setting.
9. **A cinematic-bars event.**
10. **Hold-to-extend and second-press inputs** for Q.
11. **Sprite overlay state:** the disc's 8 cells (R meter) and the glass spine's 3 pixels (Q
    cooldown) drawn from game state on every frame.
12. **A perfect-dash trigger:** an overlap test during specific dash frames that fires a clip
    event.
13. **`m1_5`:** no engine change needed; it's reached from `m1_4`'s cancel window [M].
14. **Palette-mapped rim** (`DESIGN.md` section 9). Keep the rim level (0, half, full) and
    threshold, but replace the brighten step (`max(lit, colour) + 0.12 × colour` in
    `src/lab/engine/shaders.ts` [M]) with a lookup, `rimLUT[palette index][family][level]`, that
    returns a palette colour. It needs a per-texel palette index (an index atlas, or an exact
    match against the sprite's 29 colours), an optional `rim: "cool" | "warm"` on the `light`
    event, and outward normals on the outline (plus the second pixel on broad shapes) from the
    exporter. Without it the rim is invisible on her white (W1 becomes `#ffffff`, 1.14–1.17:1)
    and off-palette elsewhere [M, arithmetic]. `RUNTIME-CONTRACT.md` lines 179–181 would change
    with it.
15. **Dithered paint for `disc`** (the contact halos, section 0.13): palette colours painted
    through the Bayer pattern. Today's `glow()` dithers but adds light, which leaves the palette
    [M, `src/lab/engine/shaders.ts`].

## 9. First build on the blank test map

Dex asked for a blank map with just the character, a turret and some platforms. The first build
proves the feel of the moves before the systems pile up (the judges' "too many systems" worry).

**First build:**

- N1–N5 at the section 0.7 widths, with their ground layers, the contact halos, N5's glass
  saint and spikes, panes as decoration (no absorbing), and the glass decay
- the palette-mapped rim (engine ask 14), because Dex asked for rim light explicitly and today's
  rim doesn't show on her white
- Procession (dash) with glass afterimages; Aspersion without the Absolved upgrade
- Q tap version: lancets as wards against the turret, shatter on second press or auto
- R Te Deum in full, with Illumination's timer rose and ghost glaive
- Greybox first with the lab's procedural effect kinds, for timing and width only, then swap in
  the rendered effect art move by move

**Second build**, once the first passes an A/B round on Motion, VFX and AOE width:

- panes feeding N5's ring and Q's row; cadence (on-beat inputs, gilded panes, the sung phrase)
- Sanctuary and Absolved
- Q's hold version
- the disc and glass-spine meter overlays, if the engine work lands

## 10. What to A/B first

Each is a question a blind critic can answer at 3x (the rubric's method).

1. **Leading lines vs rubric 5** ("no dark line around effects"): a pane and a decaying smear
   with A0 navy leading against the same with A1 cobalt leading. If critics read navy as an
   outline, switch to cobalt.
2. **Rim on her white** (before any move art; `DESIGN.md` section 9). Use one white-dominant
   contact frame: N5's coil with the saint backlighting her back and tabards, or N2's contact
   with her back to the tip light. Show it with the rim on and off, then the outline-only rim
   (1 px) against the outline plus the inner step (2 px on broad shapes). Judge at 3x on the lab's
   dark top band and its pale lowest band. The critic's question is rubric 11's: does she look lit
   by the move, or just outlined? It passes when critics find the rim on the white without being
   told where to look.
3. **Width at real size.** N1 and N4 at 3x next to ref 11's rows, with the measured span printed
   under each. Critics say whether each hit looks as wide as its hit area. Revision 1's echo arcs
   are gone; if a critic still wants more width on the openers, test a filled echo band 4–8 px
   thick that hits, not a line.
4. **Does she dissolve into her own blue?** Indigo hair and azure eyes next to azure effects: N3's
   third ring crossing her body, the glass saint behind her, and R's backlit hold. Fallback: shift
   the hair toward violet (hue only), or gold eyes.
5. **Grace or noise at 96 px:** the silhouette fill test (rubric 1) on N2 and N5 contact drawings
   with the lead-flag rule against all cloth flaring; and with and without the stole.
6. **N5's glass saint:** the contact frame and the shatter with and without the saint, at 3x.
   Grandeur or noise? Does she stay the brightest thing on screen? And the coil at 10, 14 and 18 f.
7. **Panes at real size:** does a 7×13 pane read as glass at 3x, or as a speck? Fallback: 9×17,
   or drop panes from the first build and keep the motif in the area-scale layers (section 0.7).
8. **Warm white vs cool effect cores** at real size on Samsung Internet and iPad Safari
   (CANON's review devices).
9. **The vault (N4) carries her 1.25 H forward.** Does it break the planted feel or carry her into
   enemies on the test map? Fallback: vault back over the glaive to the same side.
10. **R's 25% dim:** does it hide the turret and enemies too much? 40% on enemies is the start.
11. **R's cross-out lines:** do two 2 px lines read as "the screen is crossed out" or as a UI
    mark? Judgment's own risk. If the latter, draw the lines as leaded glass seams (3 px, cells,
    glinting) rather than plain light.

## Timing sources at a glance

Every duration here currently comes from **RESEARCH.md's measurements** (gcsim frame data and
the four ultimates timed frame by frame) turned into a starting sheet. **No motion file has been
downloaded yet**; MOTION-SOURCES lists the batch for Dex to approve. Once downloaded, each clip
below is scrubbed for timing (anticipation, contact, hold, recovery, snap and ease) and either
retargeted and altered (CC0 and permissive sources) or used for timing only, then A/B'd at real
speed.

| Move | Numbers from | Motion to borrow or check against [S, MOTION-SOURCES] | Licence note |
|---|---|---|---|
| N1 | RESEARCH 2.1, 3.3 | UAL2 Sword Regular A + A Rec; Bandai `slash_normal_001` | CC0; CC BY-NC (timing only until Dex rules) |
| N2 | RESEARCH 2.1 | UAL2 Sword Regular B + B Rec; 山辺 two-handed set | CC0; readme unread (timing only) |
| N3 | RESEARCH 2.1 (multi-hit steps) | ジュウ weapon twirl (BowlRoll 62294) | page allows modification; trace flag to check |
| N4 | RESEARCH 2.1 | UAL2 Attack Ground Pound; CMU subject 88 | CC0; CMU terms allow retargeting |
| N5 | RESEARCH 2.1, 3.3 | Mixamo Standing Melee Attack 360 High; UAL2 Sword Regular C + combo | Adobe royalty-free, needs Dex's sign-in; raw FBX never in the repo |
| Dash | RESEARCH 2.3 | UAL2 Sword Dash RM; Bandai `dash_feminine_001`; Dolphin_664 glide dash | CC0; CC BY-NC; timing only |
| Sanctuary | RESEARCH 2.3, 2.7 | – (slow-mo profile from deepnight's demo) | – |
| Aspersion | RESEARCH 2.3, 2.4 | UAL2 Sword Dash RM → Sword Regular C | CC0 |
| Q | RESEARCH 3.3 | ジュウ twirl into attack (62565); UAL2 Attack Ground Pound, Spell Simple Shoot; MotionPackage 剣 if bought | page allows modification; CC0; paid |
| R | RESEARCH 2.1, 2.4 | UAL2 Spell Simple Enter/Idle/Shoot/Exit; ジュウ twirl; UAL2 Ground Pound; MotionPackage 必殺技 if bought | CC0; paid |

## Revision log

**Revision 2**, after the critique of revision 1. Blocking points first.

1. **The M1 openers weren't actually wide** (blocking). Revision 1 measured N1 as 1.8 H of arc
   length; its hit area spanned 1.36 H, all in front. N4's chop was 1.0 H and its pillar 0.35 H.
   Both sat in the band rubric 10 fails. The width was meant to come from a 1 px gold echo that
   didn't hit.
   - Width is now defined as the hit area's horizontal span (section 0.7). The Width check
     measures every move that way and shows revision 1's value beside each.
   - Floor: every M1 hit spans at least 2.2 H.
   - N1 is a scoop from 1.04 H behind her to high in front: 2.5 H, with a glass furrow and a
     2.9 H dust band.
   - N4's bite sends fissures ±1.25 H (hit 1, 2.5 H) that erupt into a row of 7 glass spikes
     (hit 2, 2.5 H, 1.1 H tall).
   - N3's twirls throw filled glass rings of 2.2, 2.5 and 2.8 H (were 1.4, 1.7 and 2.0).
   - N2 widens from 2.3 to 2.5 H and rises from 0.45 to 0.6 H tall.
   - The echo arcs are gone. The ghost-weapon idea lives on as N5's glass saint and
     Illumination's ghost glaive, which is a filled glass body that hits.
2. **The rim was invisible on her white, and the runtime couldn't draw it** (blocking). This is
   fixed in `DESIGN.md` section 9: the rim now recolours the lit-side outline (OL→A3 or A4, 7.0
   to 13.2:1), and on broad shapes the shaded white edge steps to A5 (2.0 to 3.5:1). It comes
   from a per-material palette lookup, which is engine ask 14 here. The rim-on/rim-off test is
   A/B item 2.
3. **N5's unwind was sluggish.** It's now one release drawing of 4 f plus three 1 f smears: 7 f
   from release to contact, down from 13 f. The 6 f saved went into the coil hold, so contact
   stays at f30.
4. **The wide bands had no height.** N5 gains 8 spikes along the ring, up to 1.5 H tall at the
   ends, and N4 its spike row. The Width check now has a vertical-reach check against the test
   map's turret, whose hurtbox is 62–120 px up.
5. **The contact flashes were small.** The heavy hits (N3's third twirl, N4, N5, the Q stamp)
   get a stepped, dithered, on-palette halo 1.2–1.5 H across (section 0.13). That's engine
   ask 15.
6. **There was no large second body in the base kit.** N5 gets the glass saint: a 2.5 H
   apparition that fills in during the coil, spreads its arms at contact, and breaks into the
   spikes.
7. **Pipeline feasibility.** Effects, apparitions, the face stamps and the cut-in now have a
   build route that uses no procedural contour drawing (`DESIGN.md` section 12).
8. **Found while revising:** revision 1 put N5's ring hit on her own frames at f54, but let a
   dash cancel her at f50, which would have dropped the hit. The ring and spikes are now effect
   hits (engine ask 2), and the fallback opens that cancel at f57.
