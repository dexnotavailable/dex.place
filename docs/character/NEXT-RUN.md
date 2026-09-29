# Rosace: the next character run (breaking the 5.8 plateau)

Written 2026-09-29 by a cloud session and revised the same day after independent reviews (see "Review notes" at the
end). It is based on the PC's pc-sync snapshot (`HANDOFF.md`, `docs/handoff/STATUS.md`, `art/rosace/drive9.json`,
ART-RULES 10 rows FPA, FPB, FR1 and D9 to D9-P, open items O-32 and O-33, PIPELINE 3.6l to 3.6r), on the drive-9 code
(`d9_blender.py`, `d9_post.py`, `bl_build.py`, `r2_model.json`), and on my own measurements of the committed renders in
`docs/handoff/media/`. It is a plan, and it changes nothing on its own. The draft PC script that runs it is
`next-run-workflow.js`, in this folder.

---

## For Dex, in plain words

**Where she is.** About 5.8/10. The critics score your refs 8.4 to 8.9 on the same sheets. Every route we tried stopped
at the same height: the 3D route, the 2D construction route, the per-part artistry pass and the five "drive to 9" rounds.
The best of those rounds, round 2, is the look that's live in the build now. Scored part by part, she beats the old build
on her pose, her materials and her colour. She ties it on the face and the hair. She is still weakest on **hands and
grip (3.4-4.5 in every round)**, and on the outfit and weapon details, which round 2 dropped by accident.

**Why she stops at 5.8.** There are three reasons.

1. **The loop was changing too many things at once.** Each round took 15-25 fixes from five critics, plus an
   "escalation", and judged them together. Good changes and bad changes cancelled out. Critics also contradicted each
   other: hand to the collar vs hand off the collar, feet closer vs a wider stance, a bigger head vs "the head is already
   big enough", the diadem on vs off. One round rebuilt an eye lash that the log had already recorded failing three
   times. Critic noise is about ±0.1, the rounds moved 0.3-0.4, and no round could say which change caused its move.
2. **Tuning the render has run out.** Round 2 won with the pose, the finish and more cloth. After that, more ramp
   tuning, more head scale and more pose-angle pushing moved nothing. The parts still at 4-6 are *drawing and
   construction* problems: hands, the bust read as two balls, the bodice, the collar cross and the weapon details.
3. **Two big levers were never really tested.** A darker overall value with calmer colour was measured as the biggest
   single gap. It was tried once, bundled with a painterly finish that washed her out, and lost. Nobody has tested it
   on its own since. The hand fix was never done at the size that matters: every attempt was a 5-6 px stamp or paint
   blob on a hand hidden in a sleeve.

**What the next run does.** It pulls six structural levers, **one at a time**. Each lever builds a short ladder of
versions, each adding one change to the one before. Each version has to pass its own number checks first, then win a
blind side-by-side against the current build before it is kept. In order of expected gain:

1. **Fix the idle and back pose, and re-author the Q.** The pose is the one thing that clearly worked. The figure-pose
   lane already found a stance that passed every check (heels 39 px apart). Round 2's "+30%" push seems to have bent
   the free knee inward and tilted her head to 16°. The run first measures what round 2 changed. Then it rebuilds the
   idle and back as one gesture inside the checks the lane proved reachable, with a head tilt of 5-10°. The Q gets a
   new pose built from scratch; so far it has only been patched.
2. **Build the hands bigger in the 3D model and stage them where they can be seen.** The hand bones get scaled up.
   The grip is re-seated so the hand stays on the haft. The wrists come out of the sleeves, and a small pass draws only
   lines on top of the render (a knuckle line, a thumb and an edge against the hip). No more stamps or paint blobs.
3. **Darken the big areas and calm their colour, and keep the bright colours for her eyes, gem and trim.** Done by
   moving the colour ramps themselves. Changing the gamma was tried and does nothing, because the final colour step
   spreads the tones back out. The near-black outline on her lit side gets a mid-dark tone instead.
4. **Make the bust one lifted form that belongs to the bodice.** A teardrop shape rather than a bigger one, built by
   rebuilding the model with a new bust setting, plus modelled bodice seams and a neckline V.
5. **Bring back the details round 2 lost:** the collar cross, the stained-glass windows, the rose-disc stamp and the
   N1 smear. They exist already, but they are written for the old colour system. A small translator makes them work
   on the new finish.
6. **The attack faces (small):** on Q and N1, both eyes on one line and a closed mouth. The idle and back face stays
   exactly as it is.

Before any of that, the run proves it can reproduce the live build to the exact pixel with its new tools. If it
can't, it stops and reports.

Being honest about the ceiling: if all of these land, my estimate is **6.5-7**, not 9 [I]. Getting from 7 to 9 is about
drawing quality at the level of a pro pixel artist's face and hands. A render plus code may not get there. That is the
biggest decision below, and it's yours.

**Decisions only you can make** (full list with context at the end):
1. If bigger hands still don't read, may she wear **gloves or gauntlets** (white or indigo with gold cuffs)? That would be a design change.
2. **How dark may the white cloth go?** Soft lavender-grey in the shadows and a less bright top, or does it stay paper white?
3. The free hand: **on the hip** (my pick, and most critics'), or at the collar or hair?
4. The head piece: **gold diadem, rosace pin with veil, or no head piece at all?** It went back and forth across four rounds.
5. May the run treat **head scale 1.10, the wider stance and round 2's face** as settled, so critics can't reopen them?
6. The figure-pose lane is closed. **May this run write new pose and bust files** under that lane's folders? It would add new files and never overwrite old ones.
7. **Is a human pixel artist allowed** for the last stretch, painting over or drawing key frames on our renders? That is not image generation. Or do we call about 7 good enough for now and move on to motion?
8. **The stance floor and the glaive lean** (open items O-32 and O-33). On this body, heels 35-43 px apart are out of reach unless the far leg is drawn 10% longer, which the current idle already does. The rule "glaive leaning away from her" can't hold with her current grip. Keep the longer leg? Lower the floor? Accept the glaive leaning in?
9. **The eye rule.** The written face rule was changed in round 5 to a heavy two-row lash, which scored worse. Revert it to round 4's one-row lash?

---

## 1. Where she is: per-part scores

Scores are /10, and the refs are the bar at 9 (the same panels scored refs 07/08/09/04 at 8.4-8.9). Each lens groups
CRITIQUE-PARAMS: face = 2-4, body = 5, 6, 9-12, gear = 7, 8, 13, craft = 14-17, overall = 1, 18, 30, 31.

### 1.1 Drive to 9 (wf_68cebea7-8e1), five blind rounds

| Round (what changed) | face | body | gear | craft | overall | mean |
|---|---|---|---|---|---|---|
| D1: the combined build (F3 mass, F2 head 1.10, figure-pose concept A, F1 finish re-tuned) | 5-5.5 over all lenses (the per-lens forms are in `review/rosace/art/drive9/round-1/verdicts/` on the PC) | | | | | 5.36 |
| **D2: round-1 fixes + ESCALATION 1 (+30%): promoted, live in the build** | 5.8 | 5.8 | 5.5 | 5.8 | 6.2 | **5.78** |
| D3: round-2 fixes (spine tilt, head 1.05, blur/despeckle, lid wedge) | 5.0 | 5.2 | (not recorded) | 5.4 | 5.5 | 5.42 |
| D4: round-3 fixes + ESCALATION 2 (hand paint-over) | 5.8 | 5.2 | 5.5 | 5.8 | 6.0 | 5.66 |
| D5: round-4 fixes + ESCALATION 3 (recombine) | 5.0 | 5.6 | 5.0 | 5.5 | 5.7 | 5.36 |

The integrated control scored 5.0-5.6 in the same sets. Re-judged a round later as `prev`, the same stills moved by only
0.02-0.1 (D9-P), so **a change needs more than +0.1 to count**. Rounds 3 and 5 did not clear that, and `prev` won both.

### 1.2 The promoted round 2 against the control, per parameter (ART-RULES 10, row D9-P)

| Param | Round 2 | Control | Read |
|---|---|---|---|
| 14 materials | 6 | 4.5 | finish lever worked |
| 15 palette and value | 6 | 5 | worked |
| 9 posture | 6.5 | 5 | pose lever worked |
| 12 sex appeal | 6 | 5 | worked |
| 5 body | 6 | 5.5 | worked |
| 16 pixel craft, 17 rim | +0.5 each | | small |
| 2 face | 6 | 6 | tie |
| 4 head and hair | 5.5 | 5.5 | tie |
| **6 arms and hands** | **4.5** | **4.5** | tie at the bottom |
| **8 grip** | **5** | **5.5** | lost: the constructed passes were dropped |
| 7 weapon | 5.5 | 6 | lost: same cause |
| 13 outfit | 5.5 | 6 | lost: same cause |

Across all five rounds, hands scored 3.4-4.5 and grip 4-5.

### 1.3 Earlier runs (same plateau)

- Artistry pass, part lanes: face 4 → 5.5, hair 5.5, outfit 5.5, shading 5.5, glaive-hands 5.
- Artistry whole WH1: face 5, body 5.5, gear 6.3, craft 5.5, overall 6 (5.66). WH2: face 5.5, body 5.5, gear 6, craft
  5.5, overall 6.2 (5.74).
- Figure-pose lane (wf_b9b542bc-170): three concepts (A queen contrapposto, B glaive across the shoulders, C), about 30
  stance variants, WF-P03 thumbnails and two refine rounds. Concept A won its judging at 7 / 7 / 7.5 against the old
  idle's 4 / 5 / 5 (appeal / figure / read). Refine r1 (FR1) passed every rig check at 144: heels 39 px, knee/heel 0.43,
  turn chain 53/50/20, with the free leg scaled 1.10 (O-33). It scored 6 / 5.5 / 5.5, and r2 scored 5.5 / 5.8 / 6. Refine
  r3 and its report failed. The pose files have been frozen since (idle_appeal `a89be9fabdd7`, back_appeal
  `d65ee47e75d8`). The lane also measured what this body can't reach (FPA, FPB; O-32).

### 1.4 What I measured on the promoted stills

These are the committed `handoff-drive9-*` x3 PNGs, sampled back to 1x, figure pixels only, with the ground shadow
removed.

| Still | p90 luma | median HSV S | chromatic share | accent share | L* 20-35 share | ring luma < 40 |
|---|---|---|---|---|---|---|
| idle 144 / 80 | 214 / 207 | 0.44 / 0.41 | 76% / 73% | 11% / 9% | 13% / 12% | ~96% |
| Q 144 / 80 | 219 / 216 | 0.44 / 0.42 | 70% / 68% | 18% / 14% | 14% / 11% | ~94% |
| N1 144 / 80 | 189 / 194 | 0.48 / 0.46 | 81% / 76% | 12% / 11% | 16% / 13% | ~96% |
| back 144 / 80 | 198 / 189 | 0.46 / 0.46 | 80% / 77% | 12% / 12% | 11% / 10% | ~99% |
| refs (finish-gap.md) | 170-180 (D5 craft critic) | 0.15-0.42 | 35-67% | 0.4-3% (09: 20%) | 35-41% (04: 11%) | rel L < 0.06: 30-73% |

How to read it: she is brighter at the top end, more saturated and more colourful everywhere than 07, 08 and 09. The
dark-mid band (L* 20-35), where the refs put 35-41% of their pixels, holds only 10-16% of hers. Nearly all of her
outline is near-black. My ring column is a rough measure on the nearest-sampled x3 files (luma < 40); an independent
review got 93-98% the same way. finish-gap.md's measure is rel L < 0.06: ours 73-90%, refs 30-73%. The gates use
finish-gap's measure. Gold covers roughly 13-18% of the figure by a rough hue measure; that is an area set by geometry.

By eye, in the idle at 144 x3:
- The glaive hand is a fingerless skin blob under a dark cuff at the disc.
- The hip hand barely separates from the hip skin.
- A skin band with a hand-like end runs across the top of the bust. D9-R4 showed it is the lit near chest, collar and
  hair mantle joined into one shape, not a forearm.
- The bust is two outlined lavender-grey ovals at about the sleeve's value.
- The knees cross inward, so the legs don't make the wider A or λ stance of DESIGN 3.5. FR1's pose passed the stance
  checks (heels 39 px, knee/heel 0.43). R2's pose patch moved the free knee's pole and turned the hips, and its stance
  numbers were never re-checked. Prep measures that first (lever 1, step 0).
- The face reads well: bright eyes and a smile.

---

## 2. Why she plateaus: the diagnoses, with evidence

Each diagnosis gives what was asked, what was actually built, and what the evidence says. Rows cited as D9-*, FP*, FR1
and O-* are ART-RULES section 10 and the open-items list.

1. **The loop, not any one part.** Every round applied every critic's top fixes plus an escalation. That is 15-25
   changes, judged as one letter. D3 bundled a spine tilt (which lost on arms, posing and sex appeal) with blur and
   despeckle (which raised the flat-step share from 0.27 to 0.41 and lost on finish). The critics' asks conflict: D4's
   body critic said move the hand to the collar, and D4's gear critic said move it off the collar. D5 asked for "feet
   closer" against DESIGN 3.5 item 3. D5's face critic asked for "24-25 px, x1.12-1.15", which is a *smaller* head than
   the current 27.6 px. D5 also built a two-row lash that D9-R2, R3 and R4 had already logged as a "sleepy slab", and
   face fell from 5.8 to 5.0. **A critic's ask overrode what the builder had already proven.**
2. **Hands and grip were never built at a readable size.**
   - The promoted chain (`stills_v2.drive9_chain`: `d9_blender.py` then `d9_post.py`) never calls `lane_passes()`, so
     `author_hands.apply`, `outfit_px`, `outfit_px2` and `wh2_px` "hands" are all skipped.
   - `d9_post.py`, `r2_blender.py` and `d9_blender.py` contain no hand code.
   - The integrated control, which does carry the constructed stamps, scored the same on hands (4.5 = 4.5) and only
     +0.5 on grip. D5's painted 6x6 fists raised body 5.2 → 5.6 but dropped gear 5.5 → 5.0 ("painted 6x6 lumps").
   - Conclusion: porting the stamps alone won't fix it. The fist at 144 is 5-6 px, against HD-P02's 7-9 and the refs'
     8-10. The hands are also hidden: the glaive hand sits in the cuff, and the hip hand is skin against skin.
3. **The "forearm across the bust" is not a forearm.**
   - D9-R4 read the id pass: it is the lit near chest, the collar and the hair mantle, joined into one limb-like band.
   - D2's hand move helped posture (6.5 vs 5), but the ask came back in D3, D4 and D5.
   - D4's chest repaint (a paint-over) did not move body (5.2), and blind nobody could tell it from the underlay
     (0.8-8.7% of pixels changed). The fix is a *form and turn* change: the near shoulder behind the chest edge, and a
     value break between skin, collar and mantle. It is not a hand move and not a paint-over.
4. **The bust got shading changes, never a shape change.** Size was tested four times (S5, S7, S8, S9), and the critics
   said they "look the same at 1x". D3, the only round built around bust shading, was the regression round.
   `figure_shape.py` has lift, projection, raise, fill and under terms, but no teardrop or apex-drop term. D5 put that
   on `not_done` as "a shape-key job for the figure-pose lane". Bodice tension lines were on `not_done` in D3, D4 and
   D5. There is also no build path for a new bust yet: `figure_shape.apply` refuses a body that already has the
   `figure_bust` key, and `rosace.blend` has S7 applied, so a new bust means a rebuild (lever 4, step 0).
5. **The face: round 2's face is the proven one.** Face scores went 5.8 (D2, the `r2_faces.json` stamps) → 5.0 (D3,
   two-row wedge) → 5.8 (D4, FC-P39 as of D9-R4: one lash row plus a flick, painted over) → 5.0 (D5, two-row block). The
   promoted face is round 2's stamps. FC-P39 is a paint-over rule (WF-P20), and its current text (changed in D9-R5)
   specifies the two-row block that scored 5.0. So this run settles **the R2 face (`drive9/r2_faces.json`)**, not
   FC-P39, and the FC-P39 revert goes to Dex. What's still open is the attack frames: eyes on one line and a closed
   mouth on Q and N1 (lever 6).
6. **The head is settled.**
   - Head ÷ H is 0.195 (27.6 px), which is the top of the refs' 0.14-0.20 (finish-gap 2.5).
   - In F2's blind set, head 1.10 won at 5.9, while 1.15 came next to last and 1.20 last. D3's 1.05 coincided with the
     regression.
   - Critics keep asking for head scale anyway. The run should stop spending rounds on it.
7. **Pose is the lever that worked, and R2 may have undone part of it.** D2's +30% push gave posture +1.5 and sex
   appeal +1 over the control. But:
   - The figure-pose lane already explored widely (concepts A/B/C, about 30 stance variants, thumbnails, refine r1/r2).
     FR1 passed every rig check at 144 with heels 39 px, knee/heel 0.43 and a 53/50/20 turn chain. It did that with
     the 1.10 free-leg scale already in `idle_appeal.json` (O-33).
   - The lane also measured the limits. Heels 35-43 px with a locked weight leg and a bent free knee are out of reach
     without that cheat (max about 32-33 px; FPA, FPB, O-32 (1)). A glaive leaning *away* 15-35° can't be reached with
     concept A's grip; the kept pose is an A-frame leaning 14° *in* (FPA, O-32 (3)).
   - R2's patch turned the hips (bone rotation 6.5/19.5/5.2), moved the free knee's pole out-forward and raised the
     head tilt to 16°, against DESIGN 3.5's 5-10°. Nobody re-checked the stance after it, and the stills show the knees
     crossing. PS-P04 measures the turn from the camera (pelvis 35-60°; FR1 had 53), so the 19.5 bone value is not
     "too little turn".
   - `q_stamp.json` was patched, never re-authored, though WH1, WH2 and D1 all asked for a re-author.
8. **Value and chroma: the biggest measured gap has never been tested alone.** finish-gap.md ranks the chroma budget
   as lever 1 (+0.8 [I]). Route F1 built it together with a painterly texture and AA, and the judges said it washed out
   her colours (F1 last at 5.0). Drive 9 then decided "nothing is desaturated". D5 tried a lower key through the input
   gammas, and V<0.35 moved only 0.300 → 0.315, because the per-material k-means requant spreads the tones back out
   (D9-R5: "a key change has to move the ramp stops"). No round has moved the stops. The promoted build still measures
   p90 luma 189-219 against the refs' 170-180 (section 1.4).
9. **Finish ramps: spent, except the outline.**
   - Soft ramps, despeckle, `ramp_soften`, `rim_arcs` and `contour_clean` were all built.
   - D4's `ramp_soften` left the hard steps unchanged (0.28 → 0.32), because they sit at outlines and material borders.
   - "Thousands of colours" in the refs is their WebP codec (finish-gap 2.1), and the 32-colour cap has been gone
     since D1.
   - The one surviving finish gap is the outline. `d9_post.lines()` already gives the lit-side ring of light and
     accent materials their deepest stop (`stops[0]`), and that stop is near-black for white (#1b1733), gold (#34150f)
     and the skin-adjacent ramps. That is why the ring measures dark. "Use the material's own darkest tone" would
     change almost nothing. Lever 3's K3 therefore re-tones the ring to a mid-dark ramp tone.
10. **Outfit and weapon details were dropped, not beaten.** The collar cross, glyphs, windows, rose-disc stamp and N1
    smear all live in the integrated chain's code-palette passes, which the drive-9 chain skips. `r2_confounds.json`
    lists them. That confound is the whole of round 2's loss on weapon (5.5 vs 6), grip (5 vs 5.5) and outfit
    (5.5 vs 6).
11. **The head piece has no owner.** D2 built the diadem, D4 removed it ("pins the eyes under a gold bar"), D5 added a
    crown pin with veil tails, and D5's critics said "trim the crown". This is a design call. It goes to Dex, not to
    another round.

---

## 3. The levers, ranked by expected gain

All six are procedural, so they carry into motion frames: model rebuilds, geometry modules, pose files, finish json and
numpy passes. No per-still paint layers (WF-P22). The run creates new files and never edits the drive-9, integrated,
figure-pose or art-construct files. Everything new lives in:
- `tools/pixel-pipeline/next/`, `art/rosace/next/`;
- new pose names in `art/rosace/poses/` (`*_next.json`);
- lane builds and raw renders under `D:\Dex\Projects\dex-place-art\rosace\build\lanes\next\`;
- review sheets under `review/rosace/art/next/`.

The **control** for the first levers is the promoted round 2, re-rendered by the new tools (below) and proven equal to
`renders/drive9` at 0 px. After each kept lever, the winner becomes the next control (a ratchet).

Expected gains are my estimates [I]. They overlap and don't add up linearly.

### 3.0 The shared tools (Prep writes them; no lever runs before the control reproduces at 0 px)

The drive-9 code can't take this run's changes as it stands. `d9_blender.py` reads each shot's pose from
`drive9.json`'s `shots` (a module-level `PICK`, and `pose_file()` looks only in that list). Its `--r2` json only
reads `mesh_edits` (vertex scale_x / scale_xy in a z band), `circlet`, `pin` and `poses` (deep-merged onto the
*existing* pose names, and it can't delete keys). So new pose files, bone scales, bodice strips and a new bust have no
entry point there, and `drive9/**` stays read-only. Prep writes:

1. **`next/nx_blender.py`.** It loads `d9_blender.py` as a library, the same way `d9_blender` loads `f1_blender`: the
   source is compiled without its trailing `main()`. Before calling `main()` it:
   - sets the module's `PICK['shots']` from an entry in `art/rosace/next/next.json`;
   - replaces `pose_file` with one that accepts the new `*_next` names and applies the entry's pose patches (deep-merged;
     a `null` deletes a key; bone `.scale` entries allowed);
   - adds `depth2` to `PASSES`. Its B channel carries the per-limb ids (`hand_L/R`, `bust_L/R`; `limbs.py`,
     `materials.py`). The id pass can't separate hand skin from hip skin, or one breast from the other;
   - wraps the facepass call, which runs once per render dir, so every dir also gets `haft_grips.json`: the `haft`
     block (butt, tip, disc, disc_facing, blade_base, sockets) and the `grips` block (point, target, gap_cm) from
     `tools/art-construct/gh_render.landmarks`, compiled without its trailing `main()`. d9's `landmarks.json` is
     figure_pose's schema (joints and PS checks) and has none of these. The hand tips and grip sockets are in
     `meta.json` `anchors`, at ss resolution;
   - adds a geometry hook that runs `next/nx_geom.py` modules (bodice strips, gloves) after r2_blender's edits;
   - takes `--blend` for a lane build.

   **Proof:** with the `promoted` entry, which copies drive9.json's shots, head, model and finish, it must render R2 at
   0 changed px on all 16 images (4 shots × 144/80 × still/still_ground). This render is also the control's raw
   passes (with depth2 and haft_grips), so the finish-only levers need no Blender.
2. **`next/nx_post.py`.** `d9_post.process()` returns only its report: ring, mat, part, the line mask and n2 are never
   saved, and it draws `still_ground.png` itself. nx_post:
   - runs `process()` unchanged;
   - recomputes alpha, mat and part with `F1.downsample` (deterministic), and the ring from alpha;
   - runs the optional next steps a `next` block in the finish json switches on (tone_adapter, ring re-tone,
     hand_pass, in that order);
   - redraws `still_ground.png` with `finish_judge/judge_sheets.f1_grounded`;
   - copies `<raw>/<shot>/px<N>/<tag>/` into the lane's own `stills` folder, because d9_post writes inside the raw tree.

   With no `next` block its output equals d9_post's at 0 px. Finish overlays in `art/rosace/next/` use base
   `'../../../tools/pixel-pipeline/drive9/r2_finish.json'`, because `load_finish` resolves `base` next to the overlay.
   A faces overlay is `r2_faces: '../../../art/rosace/next/<file>.json'`, because d9_post resolves that key from
   `drive9/`.
3. **Stance diagnosis.** The control's `landmarks.json` checks (PS-P04, P06, P07, heel_gap_px, the knee gap) beside
   FR1's `check_idle_appeal.json`, written to `lanes/next/control_stance.md`.
4. **`next/nx_metrics.py`**: every gate below, with the per-limb and bust measures read from depth2 B, downsampled to
   sprite size by majority vote, and the grip and haft measures from `haft_grips.json`. Also `nx_pair.py`, `nx_round.py`,
   `settled.json` and `next.json`.

### Lever 1 (P): the idle/back gesture and a re-authored Q. Expected +0.4 to +0.8

- **Step 0:** read the stance diagnosis and say what R2's patch did to FR1's passing stance: the hip rotation, the
  leg.L pole, the look tilt 16, or the camera. Read FPA, FPB, FR1, O-32 and O-33 first. Don't re-run concepts A/B/C or
  the stance sweeps.
- **Letters** (variables at the concept level):
  - **P1** = the idle/back gesture, one variable: stance, turn chain, tilts, free hand, glaive angle and head tilt as one
    gesture, in `idle_next.json` / `back_next.json`. The free leg keeps its existing 1.10 scale and never goes above it
    (O-33, Dex's call).
  - **P2** = the Q gesture, one variable: `q_next.json` from WF-P03 thumbnails (4-6, keep two, scored with GR-P05 and
    GR-P09 as C1 learned). One C or S line of action, the legs behind the torso line, the haft never through the pelvis
    (GR-N05), nothing on the DESIGN 3.5 never-list.
  - **P3** = P1 + P2, only if both pass.
  - The attack faces are not in this lever (lever 6).
- **Where:** new pose files through `next.json`'s shots and patches, rendered by `nx_blender.py`, checked with
  figure_pose's check mode.
- **Gates, per letter** (plus the shared guards in 4.2):
  - P1: 0 IK misses (PS-N21); PS-P06 heels 35-43 px at 144 and 20-24 at 80 with knee gap ≤ 0.6 × heel gap (or Dex's
    O-32 floor); PS-P07 weight leg ≤ 5° with the ankle under the pit ±2 px; **PS-P04 turn chain: pelvis 35-60°, chest
    30-50°, head 10-30° from the camera**, each less than the one below; shoulder and hip tilts opposed; head tilt
    5-10°; the glaive in the reachable A-frame, leaning in 12-20° (PS-P24), with GR-P11 grip gaps ≤ 1.5 cm (GR-P09's
    "leaning away" waits on Dex, O-32 (3)); bbox fill ≥ 0.45 (0.39 now); arm-body window ≥ 150 px² at 144, measured as
    a bay (FPA); bust break ≥ 4 px at 144 and ≥ 2 at 80. PS-P01 at 80 is exempt (known, O-32 (2)).
  - P2: 0 IK misses; 0 pelvis-haft crossings; every WF-P05 keep-out zone empty; GR-P11 ≤ 1.5 cm; idle, N1 and back
    0 px changed.
- **Blind A/B:** control R2 against the passing letters. Critics judge params 9, 10, 11, 12, with guards 1, 3 and 5.
- **Why it isn't a repeat:** it doesn't explore new gestures for the idle. It restores a stance the lane already proved,
  under R2's look, and fixes the head tilt. The idle checks in P1 are the ones FR1 passed. The Q has never been
  re-authored.

### Lever 2 (H): hands built bigger in 3D and staged to be seen, with lines only on top. Expected +0.3 to +0.6

- **Letters:**
  - **H1** = hand scale only: `J_Bip_L_Hand.scale` / `J_Bip_R_Hand.scale` x1.2-1.3 in the pose patch.
    `n1_contact.json` already uses 1.2. It can't be a mesh edit, because the hand is part of the body mesh. figure_pose
    applies scales after the grip solve, so a 1.3x hand moves the grip point about 1.5 cm off the socket, which is
    GR-P11's limit. Compensate with the grip `slide`. The target is a 7-9 px fist at 144.
  - **H2** = H1 + staging, a pose patch on the current control's pose. The glaive hand sits at chest-to-shoulder
    height, with the wrist clear of the bell's mouth by 3 px or more (the bell pushed up the forearm, or the cuff
    shortened). The fingers curl 70-85 around the haft, with the thumb over it. The hip hand is staged off the hip skin.
  - **H3** = H2 + `next/hand_pass.py` (in nx_post, in the finish's own skin tones, from `haft_grips.json`, the meta
    anchors `hand_*`, `hand_*_tip` and the depth2 hand ids). It draws only the knuckle line (HD-P02), the thumb wedge, a
    1 px contact line where hand skin meets body skin (HD-P08) and the haft collinear through each fist (GR-P05). It
    never paints the hand's mass.
- **Gates, per letter:**
  - H1: every `grips.gap_cm` ≤ 1.5 (GR-P11); fist bbox 7-9 × 7-9 px at 144 and ≥ 4 × 5 at 80 with ≥ 20 hand px
    (HD-P08), from the depth2 hand ids; no floating glaive (GR-N01).
  - H2: H1's items, plus the haft visible ≥ 2 px on both sides of each fist; N1 grip spread 24-30 px with the rear fist
    at the hip (GR-P01, GR-P04); hip-hand window ≥ 150 px²; wrist ≥ 3 px clear of the bell.
  - H3: H2's items, plus the contact line continuous (100% of the contact edge) and 0 changed px outside the pass mask.
- **Blind A/B:** control against the passing letters. Critics judge params 6, 7, 8, with guards 1, 10 and 12. The
  ladder shows what size, staging and lines each add. The D4 paint-over never showed that.
- **Why it isn't a repeat:**
  - The stamps (integrated) and the paint (D5) were 5-6 px, 2D and fixed per still, and scored the same as or worse
    than the render's own hands.
  - This changes the 3D size and staging, so every pose and motion frame carries a readable hand, and it draws only
    construction lines in the finish's own tones.
- **Escalation, if it fails twice:** gloves or gauntlets as a geometry module (H4), only if Dex says yes (question 1).

### Lever 3 (K): a low-key, calm-chroma value structure, set at the ramp stops. Expected +0.3 to +0.7

- **What changes:** a new finish overlay `art/rosace/next/k_finish.json` with base
  `'../../../tools/pixel-pipeline/drive9/r2_finish.json'`. It replaces the `stops` of white, veil, stocking, boot,
  lining, haft, hair, indigo and gold, and leaves the gammas alone (D9-R5). It runs through nx_post on the control's raw
  passes (no Blender).
- **Letters:**
  - **K1** = the key only: the stops lowered, same hues. Stockings, boots, lining and haft go into L* 10-36 over 3-4
    tones. The white's top drops under paper white, as far as Dex's white bar allows.
  - **K2** = K1 + the chroma budget: the big areas' S ≤ 0.30, the white's shadows grey-lavender (S ≤ 0.12), hair and
    indigo S ≤ 0.40, gold's dark step desaturated. The eyes, gem, azure tips and a thin gold line keep their chroma.
  - **K3** = K1 + a ring re-tone: the lit-side ring on light materials takes a mid-dark ramp tone (t 0.19-0.26, OKLab
    L ≥ ~0.30) instead of `stops[0]`. It's a new numpy step in nx_post (section 2.9 says why "the material's darkest
    tone" isn't enough).
- **Gates, per letter** (`nx_metrics.py`, figure only, 144 and 80):
  - K1: p90 luma ≤ 185 (now 189-219; refs 170-180). If Dex picks ref 04's white bar: p90 no higher than the control's
    on the whole figure, and ≤ 185 on every material except white and veil. L* 20-35 share ≥ 20% (now 10-16%); skin
    median L* at least 6 below the lit white; the face, gem and rim hold the top 3% of luma.
  - K2: K1's items, plus median S ≤ 0.35 (now 0.41-0.48); chromatic share ≤ 70%; accent share ≤ 5%; gold high-chroma
    share (gold hue, S > 0.6) at most half the control's. The old "gold ≤ 10% of the sprite" was an area set by
    geometry, which stops can't move, so it's gone.
  - K3: K1's items, plus ring px near-black (rel L < 0.06, finish-gap.md's measure) ≤ 75%, and 0 changed px off the
    ring.
- **Blind A/B:** control against the passing letters. Critics judge params 14, 15, 1 and 30, with guards 2, 3 and 16. A
  144 x3 codec-diagnostic sheet goes with them (WF-P16) and never counts.
- **Why it isn't a repeat:**
  - F1 raised and desaturated *everything*, identity accents included, and bundled texture and AA. It lost because it
    was washed out.
  - This lowers the big areas' value (darker, not paler), keeps the accents and changes nothing else.
  - D5's key attempt moved gammas, which the requant undoes. This moves the stops. The lever has never been judged on
    its own.

### Lever 4 (F): the bust as one form that belongs to the bodice. Expected +0.2 to +0.5

- **Step 0, a build path:** `next/bl_build_f.py`, a wrapper in the style of `drive9/bl_build.py`. It monkeypatches
  `figure_shape.variant_params` (and the field, for the new term) and runs `build_rosace_v2.py` unchanged with
  `--out lanes/next/f_<variant>.blend`. `figure_shape.apply` refuses a body that already has the `figure_bust` key,
  and `rosace.blend` has S7 applied, so the bust can only change by a rebuild. drive9's `bl_build.py` itself only
  writes `lanes/drive9*.blend`. **Proof first:** an unchanged rebuild (`f_S7.blend`) rendered through
  `nx_blender --blend` matches the control at 0 px, or the lever stops. The fallback is to remove `figure_bust` from
  the body and every garment and re-bake ao.
- **Letters:**
  - **F1** = the bust shape, one variable: a teardrop term in `next/bust_teardrop.py` (apex drop 2-3 px at 144,
    lower-pole fullness, 10-15% narrower at S7's volume). Variants go in `art/rosace/next/shape_next.json`, never in
    `shape.json` unless Dex says yes (question 6).
  - **F2** = F1 + the bodice structure and the chest value break (two variables):
    - strips as a geometry module in `next/nx_geom.py`, like `r2_blender.circlet`: a gold centre seam or cross panel,
      two tension darts from the collar toward each apex, and a neckline V. Each strip is ≥ 15 mm wide, because a strip
      thinner than ~13 mm (1 px at 144) disappears in the weighted downsample. The strips are weighted to the chest and
      bust bones and carry the `figure_bust` key, so they follow the bust. The alternative is to re-tag the existing
      bodice faces with their own material;
    - the collar and mantle take their own tone step, so the lit near chest stops joining the shoulder into the
      "forearm" band (PS-N24).
- **Gates, per letter** (per breast from the depth2 `bust_L/R` ids):
  - F1: bust break ≥ 4 px at 144 and ≥ 2 at 80; near-black interior line px ≤ 50% of each breast's perimeter (no closed
    ring); one highlight cluster ≤ 6 px per breast; an underbust shadow over ≥ 70% of the apex span; 0 px changed
    outside the bust and bodice region.
  - F2: F1's items, plus the lit bust mass ΔL* ≥ 8 from the lit sleeve; the upper-chest skin band ≤ 40% of the chest
    width at its row; each strip ≥ 1 px wide and continuous at 144 where it faces the camera.
- **Blind A/B:** control (the ratchet) against the passing letters. Critics judge params 5, 12 and 13, with guards 3,
  10 and 14.
- **Why it isn't a repeat:**
  - Size was tested four times: neutral.
  - Shading-only bust work was D3, which regressed.
  - The D4 chest paint-over was invisible.
  - This lever changes shape and construction in 3D, which no round has done.

### Lever 5 (A): bring the lost constructed passes onto the new finish. Expected +0.2 to +0.4 (cheap)

- **What changes:** a code-to-tone adapter, `next/tone_adapter.py`, run from nx_post on the control's raw passes. The
  integrated passes need an input contract the d9 chain doesn't write, so the adapter builds it in a work dir per
  still:
  - `base.png`: each finish pixel mapped to its nearest integrated palette code (S1-S4, W1-W4, G, A, OL...) within its
    own material;
  - `noface_id.png` at sprite resolution (R = material, G = part), from `F1.downsample`'s labels. d9 writes only the 4x
    `id.png`;
  - `meta.json`, and `landmarks.json` = figure_pose's landmarks merged with `haft_grips.json` (author_hands' `rose()`,
    `glints()`, `blade_pass()` and `smear()` read `lm['haft']` and `lm['grips']`).

  Then it runs, as libraries: `glyphs.apply` (the collar cross), `outfit_px` windows and glyphs, the `outfit_px2` steps
  `integrated.json` enables, and `author_hands.apply` with **new specs** `art/rosace/next/hands/<pose>_<px>.json` for
  idle_appeal, n1_contact, q_stamp and back_appeal. The specs have `hands: []` (lever 2 owns the hands) and
  `blade: {on: false}`, plus rose, glints and smear per pose. idle_appeal and back_appeal have no integrated spec at
  all. Back: **only the changed pixels** map to the finish's own tones for their material, by value rank, and only
  once `hands.json` reports `off_palette: false`.
- **Letters:** **A1** = the ported passes. The blade re-tone (`blade_pass`, on by default in author_hands) is its own
  variable: **A2** = A1 + blade, only if tried.
- **Gates:**
  - A1: the full image forward then back, with no pass run, changes 0 px; 0 changed px outside each pass's mask;
    `off_palette` false; the collar cross present at its stamp size, **7x7 at 144 and 5 wide × 6 tall at 80**, on the
    idle; the rose stamp drawn wherever `haft.disc_facing` ≥ 0.85 and skipped below; the N1 smear ≥ 150 px at 144 and
    ≥ 45 at 80.
  - A2: A1's items, plus the blade pass changes only weapon pixels.
- **Blind A/B:** control against the passing letters. Critics judge params 7, 8 and 13, with guards 1, 14 and 16.
- **Why it isn't a repeat:** it has never been judged. Round 2's loss on those three params is the confound itself: the
  control that carried the passes won exactly those.

### Lever 6 (E): the attack faces. Small

- **What changes:** `art/rosace/next/faces_next.json`, a copy of `drive9/r2_faces.json` in which only the q_stamp and
  n1_contact entries change. Both eyes sit on one tilt line, drawn stair-stepped in screen space, never as a rotated
  upright stamp (D9-R4). The mouth is closed: a 2-3 px set line or smirk. It's wired through `art/rosace/next/e_finish.json`
  (`base` r2_finish, `r2_faces: '../../../art/rosace/next/faces_next.json'`) and run by nx_post on the control's raw
  passes. The idle and back face doesn't change.
- **Letter:** **E1**, one variable.
- **Gates:** the file differs from r2_faces.json only inside those two entries; the idle and back stills 0 px changed;
  on Q and N1 the eye centres within 1 px of one tilt line at 144 and 80; no open-mouth hole.
- **Blind A/B:** control against E1. Critics judge params 2 and 3, with guards 1, 4 and 9. E's miss is logged but
  doesn't count toward the stop rule (4.10).

### Not levers (settled or parked)

- **Head scale:** stays at 1.10.
- **Face:** the promoted **R2 face (`drive9/r2_faces.json`)**, for the idle and back. It is not "FC-P39". FC-P39 is a
  paint-over rule (WF-P20), and its D9-R5 text calls for the two-row lash block that scored 5.0. Reverting FC-P39 to
  its D9-R4 text is question 9. The only face work is lever 6.
- **Paint-over:** retired. It was invisible blind and doesn't carry to motion.
- **Ramp softening, blur and texture:** retired (section 2.9).
- **The head piece:** Dex's call.

---

## 4. The loop design

1. **One lever per blind set, as a ladder.**
   - A set holds the control, the lever's passing letters, and two pose-matched refs (the closest of 07/08/09, plus 04).
   - Every shot is shown at 144 x3 and x1 and at 80 x3 and x1, with ref 05 on the 80 sheets (WF-P18).
   - Each letter has a parent (the control or an earlier letter in the same lever) and adds **one variable, two at
     most, both inside the lever**. Variables are counted at the level the lever names: "the idle gesture" is one
     variable, not six joint angles. Each letter is scored against the control, and against its parent, so the ladder
     shows what each variable added.
2. **Numbers first, per letter.** Each letter is gated only on the numbers its own variables own (section 3), plus
   shared guards that every letter passes: the face skin median within ±5 luma of the control; 0 off-palette or
   empty-material pixels outside the lever's own pass masks; and figure integrity (silhouette area within 3% of the
   control unless the lever owns the shape, no skin islands, bust keep-out 0 px, thong string present). A letter that
   fails its gate never reaches a critic. The builder fixes it or drops it.
3. **Critics are blind and forced to choose.**
   - Three critics per set. The sheet builder returns the letter mapping to the script, so critics never open
     `key.json`.
   - For each of the lever's target and guard params, every critic gives each letter a score /10 (refs = 9) and names
     the best letter or "can't tell".
   - Each critic's form is saved beside key.json (WF-P16).
4. **The keep rule.** A letter is kept when all three of these hold:
   - at least 2 of 3 critics pick it over the control on most target params;
   - its mean target-param score is at least **control + 0.3** (three times the measured ±0.1 noise);
   - no guard param falls by more than 0.3.

   Among the letters that pass, the best is kept, and it becomes the next control.
5. **Filter the critics' asks.** A new file, `art/rosace/next/settled.json`, lists what is decided: head 1.10, the R2
   face, the DESIGN 3.5 stance within O-32's measured reach, no paint-over, no colour cap, "thousands of colours" is
   codec, and Dex's answers to section 5. The next builder gets the critics' fixes with any ask that conflicts with
   `settled.json` or with a learning-log row struck out and listed "for Dex". The builder never re-implements a failed
   row (the D5 lash) without first showing a new variant beating the proven one by eye.
6. **Iterations per lever:** at most three. A lever that misses the keep rule twice in a row stops. Its escalation runs
   only if one is defined and Dex has approved it (gloves for lever 2). The failure goes into the learning log.
7. **Run order:**
   - Prep first: nx_blender and the control's render (one Blender process), with the 0 px proof. If the control doesn't
     reproduce, the run stops for Dex.
   - Group 1 runs in parallel: lever 1 (P), the only Blender job, and the finish-only levers 3 (K), 5 (A) and 6 (E) on
     the control's raw passes (numpy only, minutes).
   - Then lever 4 (F) on the ratchet, then lever 2 (H) on lever 4's winner, because the hands depend on the pose and on
     the bust clearing.
   - Every kept finish-only lever (K, A, E) is re-applied on the latest render, so the ratchet stays one build.
8. **The whole-character check after the levers.**
   - One build stacks every kept lever. It is judged in a full 5-lens blind round (face, body, gear, craft, overall,
     every param 1-18, 30, 31) against the promoted R2 as control and refs 07/08/09/04 (plus 05 at 80).
   - A second round follows, with only fixes for params that lost to the control, one variable per letter, and round 1
     as `prev`.
9. **Promotion follows WF-P22.** The build promoted is round 1's candidate. It must:
   - beat the control by more than 0.1 as `ours` in round 1, and again as `prev` in round 2, with no lens below the
     control either time;
   - be procedural;
   - re-render from a fresh canonical build to 0 changed pixels against the judged stills.

   Only then is `rosace.blend` written, with `rosace_pre_next.blend` backed up first and never overwritten. Round 2's
   fixed build has been judged only once, so it becomes the next run's candidate. It is not promoted here.
10. **When to stop and ask Dex:**
    - the control not reproducing at 0 px in Prep;
    - any lever that needs a DESIGN change (gloves, the white's value, the head piece, pose ownership, the O-32 floor);
    - two of levers P, K, A, F, H failing the keep rule;
    - the stacked build not beating R2 by 0.3 in whole round 1;
    - any critic asking for something `settled.json` rules out, more than once.

    The run then writes its report and stops. It doesn't escalate on its own.
11. **Budget:** each lever uses at most 3 iterations × (1 builder + 1 sheet builder + 3 critics), which is 15 agents,
    plus one escalation iteration where Dex allowed it. With every lever kept on its first try, the run is 48 agents;
    if every group-1 lever fails its gates it is 10, and if the control doesn't reproduce it is 2 (counted in a stubbed
    dry run). The worst case is about 115. Blender stays at one process per agent, small renders at ss 4, 144 and 80
    only.

---

## 5. Questions only Dex can answer

1. **Gloves.** If bigger 3D hands still read as blobs, may she wear gloves or gauntlets? Options: white with gold
   cuffs, or indigo to match the thigh-highs. That changes DESIGN, which currently has bare hands.
2. **The white.** How dark may her white cloth go? The refs she's judged against are low-key (07, 08, 09). Ref 04 is
   white-costumed and sits at her current key. Pick one as the value bar: 04's bright white, or 07/08/09's darker
   register. (This sets K1's p90 gate.)
3. **The free hand.** On the hip (critics D2-D5 mostly, and DESIGN allows it), or at the collar or hair?
4. **The head piece.** A gold diadem (D2, "most original" to one critic, "a heavy gold bar" to another), the rosace pin
   with veil tails (D5), or none?
5. **Settled items.** May the run treat head 1.10, the wider stance of DESIGN 3.5 item 3 (within what O-32 measured
   reachable), and round 2's face (`r2_faces.json`) as closed, so critic asks against them are logged but not built?
6. **Ownership.** The figure-pose lane is closed. May this run write new pose files (`idle_next`, `back_next`,
   `q_next`) and bust variants, and, if they win, make them the canonical picks?
7. **The ceiling.** A render plus code may top out around 7 [I]. Is a human pixel artist allowed for the last stretch
   (paint-overs or key frames on our renders; not image generation)? Or is about 7 good enough to move on to motion,
   which is waiting on the final model?
8. **Promotion.** If a build wins its lever lenses clearly but ties overall, may it be promoted, or must the overall
   mean also beat R2 by more than 0.1?
9. **O-32, the stance floor and the glaive lean.** (1) PS-P06's 35 px heel floor is out of reach on this body without
   a cheat (max about 32-33 px). Lower it to 30 px (17 at 80), or measure at the pointed toe? (3) GR-P09's "15-35°
   leaning away" can't hold with concept A's grip, and the kept pose is an A-frame leaning 14° in. Accept the A-frame,
   or change the grip? (2, 4: the 80 px hip drop and windows as bays are measurement fixes; the run applies them as the
   lane proposed.)
10. **O-33, the leg-scale cheat.** The current idle and back meet the stance only with the far leg scaled 1.10
    (`J_Bip_L_UpperLeg.scale`). Keep it, or move the stance floor instead?
11. **The eye rule.** FC-P39's text was changed in round 5 to a two-row near-black lash block. That round's face scored
    5.0, and D9-R2 to R4 had logged the two-row lash failing. Revert FC-P39 to its D9-R4 text (one lash row plus a
    flick), and should the rule stop being a paint-over rule now that paint-over is retired?

Dex's answers go in as Workflow `args` (section 6). O-32 and O-33 map to `heelFloor`, `glaiveLean` (`'away'` or
`'a-frame'`) and `legScale` (`true` / `false`), and question 11 to `fcP39Revert`.

---

## 6. Files

- Plan: this file. Script draft: `docs/character/next-run-workflow.js`. Like the PC's earlier scripts, it has
  `export const meta` at the top and ends with a top-level `return RESULT`, so the harness gets the lever and whole-round
  results back rather than `undefined`.
- **How it was checked** (in the cloud; nothing was run on the PC):
  - Syntax: a `.mjs` copy with only the last line swapped for an export passes `node --check`:
    `sed 's/^return RESULT$/export { RESULT }/' next-run-workflow.js > nr-check.mjs && node --check nr-check.mjs`.
  - Harness shape: a stubbed dry run strips the `meta` block and runs the rest, `return RESULT` included, as an async
    function body with stub `agent`, `parallel`, `phase` and `log`. Four paths, all as intended:
    - all kept: 48 agents, reaching Promote only when `prev` also won;
    - every group-1 lever failing its gates: 10 agents, stopping for Dex;
    - the stacked build losing whole round 1: 40 agents, no promotion;
    - the control not reproducing in Prep: 2 agents, stopping before any lever.
- Dex's answers go in as Workflow `args`, e.g. `{ dex: { gloves: true, whiteBar: '04', freeHand: 'hip',
  headPiece: 'none', settled: true, ownPoseFiles: true, promoteOnLeverWin: false, heelFloor: '30 px at 144, 17 at 80',
  glaiveLean: 'a-frame', legScale: true, fcP39Revert: true } }`. Anything missing counts as undecided. The gloves
  escalation runs only when `gloves` is `true`.
- Sources read: `HANDOFF.md`, `docs/handoff/STATUS.md`, `docs/character/DESIGN.md` (rev 3.5), `PIPELINE.md` 3.6l-3.6r,
  `ART-RULES.md` 1-4, 10 (FPA, FPB, FR1, D9-D9-P) and open items O-32 / O-33, `art-rules/finish-gap.md`,
  `CRITIQUE-PARAMS.md`, `art/rosace/drive9.json`, `tools/pixel-pipeline/stills_v2.py`, `drive9/d9_post.py`,
  `drive9/d9_blender.py`, `drive9/bl_build.py`, `drive9/r2_model.json`, `drive9/r2_finish.json`, `drive9/r2_faces.json`,
  `author_hands.py`, `glyphs.py`, `art/rosace/glyphs/collar_cross_*.json`, `tools/art-construct/gh_render.py`,
  `rosace_v2/figure_shape.py`, `rosace/materials.py`, `art/rosace/poses/idle_appeal.json`, `n1_contact.json`, and the
  two workflow scripts in `docs/handoff/workflows/`.

---

## Review notes

One independent review (14 items, the last cut off mid-sentence) was checked against the pc-sync code. I accepted and
fixed all of them. Each was confirmed in the source:
- `d9_blender`'s module-level `PICK` and `pose_file`, and `--r2`'s limited keys: new §3.0, `nx_blender.py`.
- The landmark schemas (figure_pose vs gh_render `haft`/`grips`, meta anchors): §3.0, lever A, and the haft and grips
  now rendered in Prep.
- The `noface_id.png`, per-pose hand specs and `blade_pass` default: lever A's input contract, new specs, A2.
- Per-letter gates: 4.2, and `gates` per letter in the script.
- `lines()` already using `stops[0]`: K3 redefined as a mid-dark re-tone.
- `process()` returning only its report, and `load_finish`'s relative base: nx_post, the overlay bases.
- O-32, O-33, PS-P04, and the lane's prior exploration: 1.3, 2.7, lever P, questions 9-10.
- Concept-level variables, the faces moved to lever E, and H split into a ladder: 4.1, levers P, E, H.
- The bust build path: lever F, step 0.
- depth2 limb ids: §3.0, nx_metrics.
- Hand scale as a pose-bone scale with the grip slide and GR-P11: lever H.
- Stamp sizes (7x7 and 5×6), the round-trip test, gold as a high-chroma share, p90 from `whiteBar`: levers A and K.
- The settled face: 2.5, "Not levers", question 11.
- `return RESULT`: the script's last line; §6 gives the check.

Rejected: none. One reading note: the last item's fix text was truncated after "Ship 'return RESULT' to". I read it
as "ship `return RESULT` to match the harness" and did that, keeping `node --check` only as our own syntax check on a
copy.
