# Character A/B quality rubric

The bar our player character has to clear on each dimension, stated as "what ref-level looks
like", with the reference that sets it. Measurements behind the numbers are in
`REF-BREAKDOWN.md`. The full critique checklist is `CRITIQUE-PARAMS.md`; each dimension here
lists the checklist parts it covers.

Dex's rule for the loop: keep going until our work matches the refs on every front and the
critics split 50/50 or prefer ours. In practice (same as `CRITIQUE-PARAMS.md`): **every
dimension comes out a tie or better across the critic panel, and overall at least half of the
critics prefer ours or can't choose.** A single strong dimension doesn't make up for a weak one.

References are named by filename. They and every A/B sheet that contains them stay in the
git-ignored `review/` folder and are never committed.

## Running an A/B round

1. **Same pixel grid.** Take refs from `review/refs/character/native/` (already downscaled to
   their native grid). Show ours and the ref at the same integer zoom. Never scale either side by
   a fraction.
2. **Two viewing sizes.**
   - *Real size:* 3x. Our 640×360 view fills a 1920×1080 screen at exactly 3x, so this is what a
     player on a 1080p screen sees. Critics judge first impression, readability and motion here.
   - *Inspection size:* 6x, for outline, clusters and face pixels.
3. **Blind.** Crop out watermarks, labels and names; use the same background behind both; put
   ours on the left or right at random for each dimension; don't say which one is ours.
4. **Matched pairs.** Compare like with like: a standing pose with a standing pose, a slash with a
   slash, an ultimate with an ultimate. The table below says which ref to pair for each
   dimension.
5. **Motion is judged moving.** Loop our animation at game speed through at least one full
   cycle. Single frames prove nothing (`CANON.md`). The refs have no timing (see
   `REF-BREAKDOWN.md`), so show a ref's frames as a flipbook at our timing. Critics judge its
   poses, arcs and spacing, not its speed. Timing itself is judged against our timing source
   (MMD motion or mocap) and by what feels right at real size.
6. **Critics.** At least three independent critics with no stake in the work, then Dex's call.
   Each marks **ours / ref / tie** per dimension, names the concrete gap and proposes a fix.
7. **Record the round** (template at the end) with the sheet's path in `review/`.

**About size.** Our working height is 96 px. Only `05-anim-sailormars-sheet.webp` is drawn at
that size; 07, 08 and 09 are 137–158 px. When ours goes up against those bigger refs, critics
judge craft per pixel, not how much detail fits. If critics keep picking the bigger ref on
Face or Shading purely because of its pixel budget, treat that as evidence on the open height
question in `REF-BREAKDOWN.md`, not as a reason to cram more detail into 96 px.

## Which ref to pair for each dimension

| Dimension | Primary pair | Also useful |
|---|---|---|
| 1 Silhouette | 05 (same size), 11 (silhouettes) | 07 attack pose, 13 head shapes |
| 2 Proportion and appeal | 04, 08 | 07, 09, 10 |
| 3 Face | 05 at 96 px; 07/08 if we go to ~128 px | 01 (construction logic, expressions) |
| 4 Shading and form | 01 (white), 07 (dark cloth, metal) | 03 (hue shift), 09 (cloth ridges) |
| 5 Outline | 01, 07 | 05 (coloured lines), 09 (selective) |
| 6 Palette | 01, 06 | 13 (for contrast) |
| 7 Pixel cleanliness | 01, 06 | 07 |
| 8 Motion | 05 sequences, 10 sequences, 09 key frames | 07 key pose |
| 9 Smear and VFX quality | 10 (smears), 08 (layers), 07 | 06, 09, 11 |
| 10 AOE width and grandeur | 11, 12 | 08 |
| 11 Rim light | our own bar (see below); 09 ridge highlights; 11/12 for "effect as light" | – |
| 12 Readability at 1x | 05 at real size; 13 enemies in the same frame | 06 (scene) |

---

## 1. Silhouette

*Covers CRITIQUE-PARAMS 1, 10.*

**Ref-level looks like:**

- Every key pose reads as a solid fill at real size. 11 draws its characters as pure silhouettes
  and every pose still reads. In 05 each kick, jump and cast frame can be named from the outline
  alone. In 07's attack frame the body is upside down over the weapon and it still reads as an
  overhead slam.
- There's negative space between the limbs, the weapon and the body in strike poses. 05's kicks
  clear the torso completely; in 09's strike the arms, sword and sleeves all stand apart.
- The head has its own shape. 13 gives every enemy a distinct crown, halo, hood or horns. For us
  that's the hair, collar and any headpiece.

**Fails when:** limbs or the weapon sit across the torso in a key pose; the weapon disappears
against the body; the effect hides the character at the moment of contact; the idle is a
symmetrical stand with no attitude.

**Check:** fill both sprites with one flat colour at real size. A critic who hasn't seen the
animation names the action and the facing of each key pose.

## 2. Proportion and appeal

*Covers CRITIQUE-PARAMS 3, 4, 5, 6, 7, 9.*

**Ref-level looks like:**

- 5.5–6.5 heads tall (04 at ~6–6.5, 07 ~5.7, 08 ~6, 09 ~6.3, 10 ~5.5). At 96 px that's a
  15–17 px head.
- A defined waist and hips, long legs, and poses with attitude: 07's idle stands on one leg with a
  fist up, 08's has a hand on the hip.
- The weapon at 0.9–1.1 times her height (07's wrench ~0.93x, 08's sword ~1.1x). A glaive may go
  to about 1.2–1.4x. [proposal]
- She looks attractive and confident in every frame, with no off-model in-betweens.

**Fails when:** the head-to-body ratio drifts toward chibi (01 is ~4 heads, 06 ~3) without Dex
choosing that; the proportions change from frame to frame; the weapon looks like a toy next to
her; the idle is stiff.

**Check:** at real size next to 04 and 08, and at inspection size for body shape.

## 3. Face

*Covers CRITIQUE-PARAMS 2, 3.*

**Ref-level looks like, by head size** [measured in `REF-BREAKDOWN.md`]:

| Head size | Ref | Eyes | Other features |
|---|---|---|---|
| ~14–15 px (a 96 px body) | 05 | ~2 px: a dark lash row with a light pixel under it | 1 px mouth, no nose; the face reads through the hair around it |
| ~30 px (chibi) | 01 | 4×5 px: 2-row dark lash, two-tone iris (mid blue over bright cyan), 1 px white highlight at the top of the iris | 3×2 px open mouth, 2–3 blush pixels, no nose |
| ~24–25 px (137–158 px body) | 07, 08 | 4–5×3 px: lash with an outward flick, iris in 2–3 tones, 1 px highlight | 1 px angled brows, 1 px nose shadow, 2–3 px mouth, bangs crossing the eyes |

- Our bar at 96 px: 05's size, built with 01's logic. That means a lash row, iris colour showing
  in at least 1 px, a highlight where there's room, and a blush pixel. The eye colour has to
  survive at real size.
- Expressions: at least neutral, happy and angry, like 01's and 07's portrait sets.
- The face is identical from frame to frame; eyes never drift or change size.

**Fails when:** the eyes turn to blobs or lose their colour; eye spacing drifts; a downsampled
3D face goes to mush; the face looks dead or uncanny in any frame.

**Check:** 6x crops of the face in idle, strike and hurt poses beside 05 and 01, then real size.

## 4. Shading and form

*Covers CRITIQUE-PARAMS 14.*

**Ref-level looks like:**

- 3–4 bands per material (01: 3 on skin, 4 on hair, 3 on white cloth, 4 on pink cloth; 07: 4 on
  navy cloth, 4 greys plus a specular on metal).
- **Hue-shifted shadows.** 01's white cloth goes #ffffff → #c5c1d0 → #a69eb5, which is lavender,
  not grey. 05's white top is shaded lilac. 03's hair runs yellow → orange → red → purple at the
  tips.
- One consistent light direction (front-left in 01, top-front in 07).
- Every material reads as itself: metal gets a 1 px bright edge (08's blade), cloth gets broad
  bands with highlights on the fold ridges (09's robe), skin gets soft 3-step shading, gold gets
  3 steps plus a 1 px highlight.

**Fails when:** the white is flat, or shaded with plain grey; pillow shading (light in the
middle, dark all round the edge); a toon render leaks 6+ bands or smooth gradients; dithering is
used as texture everywhere.

**Check:** 6x crops of white cloth, gold, skin and hair beside 01 and 07.

## 5. Outline

*Covers CRITIQUE-PARAMS 16.*

**Ref-level looks like:**

- A 1 px outline in a tinted near-black (01's dark plum #200d23, 07/08's blue-black #100d0e and
  #1e1e2a) or a coloured one (05: purple on hair, brown on skin).
- Lines inside the shape are lighter than the silhouette line and take their colour from the
  material (01's hair lines are dark brown, not the outline colour).
- Light materials are outlined selectively: 09's white hair is edged in light grey, not black.
- Effects have no dark outline (06, 07, 10, 11). Where 08 has dark shapes around the bolt, they're
  a separate layer of shards, not an outline.

**Fails when:** pure #000000 lines everywhere; renderer lines 2 px thick; gaps in the outline; a
dark line drawn around effects.

**Check:** 6x beside 01 and 07.

## 6. Palette

*Covers CRITIQUE-PARAMS 15.*

**Ref-level looks like:**

- A small, deliberate palette. In 01, 18 colours cover 95% of the figure (31 cover 99%); in 06,
  12 cover 95% of the entire scene. Our target: the character including the weapon at about 32
  colours or fewer, with each material on its own ramp and the darks shared. [proposal]
- Each effect on its own ramp of 4–6 steps from dark to hot (08: #030003 → #2f1a44 → #721134 →
  #a41427 → #dc1315 → #f1b998; 11: violet → periwinkle → pale cyan → near-white; 12: four reds).
- She's clearly apart from the enemies. 13 uses only a grey ramp and a red ramp, so white, gold
  and a cool accent separate her; red stays out of her costume accents and her effects.
- The costume follows 14's chips (white #f8f5f0, gold #d1a452, light beige #e4d2ba, skin #f3d2b2),
  extended into ramps.

**Fails when:** dozens of near-duplicate colours (02 and 03 show this); colours drift between
frames; her effects use the enemy red.

**Check:** run `review/refs/character/native/_palette.py` on our frames and compare its counts
with 01 and 06.

## 7. Pixel cleanliness

*Covers CRITIQUE-PARAMS 16, 25.*

**Ref-level looks like (01 and 06 are the bar):**

- No orphan pixels: a single pixel of a different colour that isn't a deliberate highlight.
- No jaggies. The step lengths along a line or curve change smoothly (1-1-2-2-3, not 1-3-1-2).
- No doubled corners on 1 px lines, and no soft anti-aliasing halo against transparency.
- Colour clusters are clean shapes with a purpose.
- **In motion,** nothing shimmers or "boils" on surfaces that aren't moving. None of the refs
  does this, and it's the typical 3D-to-pixel failure, so it needs checking in the loop, not in
  stills.

**Fails when:** 02-style stray pixels; noise; mixed pixel sizes (effects or the weapon at a
different resolution from the body); render shimmer between frames.

**Check:** 6x stills, then a real-size loop watching the torso and costume for shimmer.

## 8. Motion: arcs, spacing, timing

*Covers CRITIQUE-PARAMS 11, 19–25.*

**Ref-level looks like** [drawing counts from 05, 09 and 10]:

| Phase | Ref-level | Where to see it |
|---|---|---|
| anticipation | 1–2 drawings, with a clear coil | 05 kick: 2; 09 wind-up: 1 |
| strike | 1 drawing carried by the smear, not by even in-betweens | 10 |
| contact | held for 1–2 drawings | 05 kick: 2 at full extension |
| follow-through | 1–2 decay drawings | 10 |
| recovery | 1–3 drawings, ending in a readable pose | 05, 09 (sheathing) |

- **Secondary motion:** hair, sleeves, tabard and charms lag 1–2 drawings behind the body,
  overshoot, then settle without jitter (05's hair, 09's robe and sleeves). In 05's rising spin
  the hair is the main event.
- **Arcs:** the weapon tip and hands travel on clean arcs. 10's smears are literally the tip's
  path, and they're smooth curves.
- **Spacing:** a big jump between the wind-up and the strike; slow into and out of the held poses.
- **Ground:** feet plant without sliding; airtime shows through a floor shadow that stays down and
  shrinks (05 row 6).
- **Timing:** the refs don't carry it. It's judged against the timing source (MMD or mocap) and
  by critics at real speed.

**Fails when:** evenly spaced in-betweens that feel floaty; no held poses; hair and cloth moving
in sync with the body; jitter; sliding feet; a pose that pops between frames.

**Check:** real-size loops next to 05 and 10 flipbooks, then frame-by-frame at 6x.

## 9. Smear and VFX quality

*Covers CRITIQUE-PARAMS 11, 27.*

**Ref-level looks like:**

- **Smears follow 10's anatomy:** a thick, crisp leading edge where the blade is, near-white on
  that edge, 2–3 flat tones through the body, and a tail that tapers to a point. A C-shape wraps
  around the body. The decay runs 1 full drawing, then 1–2 striped drawings, then a 1–2 px sliver,
  then nothing. 09's option of bending the blade itself counts too.
- **Layers** from `REF-BREAKDOWN.md`: core flash, main arc, secondary slivers, particles, debris,
  ground decal, glow. Q and R use at least four of them; an M1 hit can make do with three (for
  example arc, spark, ground scratch, as in 07). [proposal]
- **Ramps** run dark to hot in 4–6 steps, with white-hot only at the brightest point (08).
- **Motif particles** carry her theme, the way 09's petals and thorns carry that character's.
  For a priest: crosses, feathers or light motes. [proposal]
- **One pixel grid:** effects use the same pixel size as the sprite, with stepped bands instead of
  soft gradients (11's bloom drawn as a 1–2 tone halo).
- **Contact marks:** any hit that touches the floor leaves a ground decal (07's scratches, 12's
  splashes and spikes).
- **Exits:** effects fade out over 2–4 drawings instead of popping off.

**Fails when:** gradient blobs; effects at a finer pixel size than the sprite; every layer at the
same brightness; effects popping in or out; one generic slash reused on every move.

**Check:** 6x frame strips beside 10 and 08, then real-size loops.

## 10. AOE width and grandeur

*Covers CRITIQUE-PARAMS 26.*

**Ref-level looks like:**

- Dex's preferred refs set the width: 11's arcs are 2.4–4.2 times the character's height; 12's E
  finishes at ~4x, and its R sphere is ~1.8x with a ground field around it.
- A ground layer that spreads wider than the arc itself (11's grey dust, 12's splashes).
- Escalation: each stage of a skill adds a layer (12).
- For a 96 px character [proposal, same as `REF-BREAKDOWN.md`]: M1 arcs of at least 1.5x
  (≥150 px), an M2 trail of at least 2x, Q at 3x or more (≥290 px, close to half the 640 px
  view), and R at 4x or more, up to the full view width.

**Fails when:** effects hug the weapon at 1x or less (where the pixel attack refs 06–10 sit, at
0.8–1.75x); there's no ground part; the arc is a single layer.

**Check:** measure effect width in native pixels against character height, and against the
640 px view; judge grandeur at real size.

## 11. Rim light

*Covers CRITIQUE-PARAMS 17.*

None of the pixel refs uses a systematic rim light, so this bar is ours. Refs support it only
partly: 09's pink highlights on the robe's fold ridges show edge light on cloth, and 11 and 12
show an effect lighting the scene (11's bloom, 12's red floor glow under the R).

**Ref-level (our bar) looks like:**

- A 1 px band, 2 px at most on broad shapes, along the silhouette edges that face the light.
- It takes the colour of the light: the effect's colour while a move is active, the world light
  otherwise.
- It's only on the lit side and never runs all the way round, which would make it a second
  outline.
- It follows the effect's timing: it comes up with the flash and fades with the decay.
- It follows the form (shoulders, hair clumps, sleeve hems, the weapon's edge), and stays inside
  the palette with no smooth gradients, even when it's driven by normal maps.

**Fails when:** a glowing outline all round the body; rim on the shadow side; a rim that ignores
the effect; a gradient rim; rim that flattens the form instead of adding to it.

**Check:** the same frame with rim on and off, at real size. The critic's question is whether
the rim makes her look lit by the move, or just outlined.

## 12. Readability at 1x game size

*Covers CRITIQUE-PARAMS 1, 30.*

**Ref-level looks like:**

- At real size (3x on 1080p, and also 2x for 720p) on the actual map with the turret and
  13-style enemies on screen, a critic can tell at a glance where she is, which way she's
  facing, which move she's doing, when the hit lands, and which effects are hers and which are
  the enemy's.
- 05 at its native size is the proof that a 96 px character can read clearly.
- **White costume against white effect cores:** during effect frames she keeps her outline and
  her lavender-shaded white, while the effect cores stay brighter, cooler or in another hue, so
  she never dissolves into her own slash.
- Red stays the enemy colour (13).

**Fails when:** she disappears inside her own effect; player and enemy effects get confused;
facing or hit timing is unclear at real size.

**Check:** a real-size screen capture of the blank test map (character, turret, platforms)
during each move, shown to a critic for a few seconds.

## Also judged: costume fidelity

*Covers CRITIQUE-PARAMS 12, 13; ref 14.*

At real size these parts read: collar with its cross, chest window, armbands, flared detached
sleeves, front tabard with its cross, hip medallion, garters and charms, thigh-highs and boots.
The gold trim is a clean 1 px line. The sleeves and tabards flare in motion, and nothing changes
between frames that shouldn't. The costume is revealing in the designed places and reads as a
priest, not as underwear. The proposed changes (thigh-highs, boots, back tabard) are in
`REF-BREAKDOWN.md` under 14.

## Round record template

Keep one record per round, stored next to the round's sheets in `review/`.

```
Round:        <n>          Date: <yyyy-mm-dd>
Build:        <branch / commit / file>
Sheets:       review/<path>
Critics:      <ids>

Dimension                 Pair (ref)  C1    C2    C3    Dex   Gap (concrete)            Fix
1  Silhouette             05, 11      ours  tie   ref   -     ...                       ...
2  Proportion and appeal  04, 08
3  Face                   05 / 01
4  Shading and form       01, 07
5  Outline                01, 07
6  Palette                01, 06
7  Pixel cleanliness      01, 06
8  Motion                 05, 10, 09
9  Smear and VFX          10, 08, 07
10 AOE width              11, 12
11 Rim light              own bar
12 Readability at 1x      05 + 13
+  Costume fidelity       14

Overall: prefer ours / can't choose / prefer ref  (per critic)
Pass: every dimension tie-or-better AND at least half of critics prefer ours or can't choose
Next: <the fixes for this round's worst dimension>
```
