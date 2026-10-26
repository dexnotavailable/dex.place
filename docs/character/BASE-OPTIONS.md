# Base body options for Rosace, and the proportion sheet

Written 2026-09-29, in answer to Dex: "any options other than vroid? my previous experience is
vroid models have pretty generic bust / hip ratios". This file ranks the routes and says how
we set Rosace's proportions on whichever body we pick. The evidence lives in three sibling
files:

- `BASE-OPTIONS/free-bases.md`: free and open bodies (MB-Lab, Onizaki, Death Joe, MPFB2 and
  others), with licence quotes.
- `BASE-OPTIONS/paid-bases.md`: BOOTH avatars, Character Creator, add-ons, with licence quotes.
- `BASE-OPTIONS/reference-models.md`: official gacha models (look, don't download) and how to
  measure proportions from images.

Nothing was downloaded, bought or generated for this file. Licence quotes are repeated here only
in short form; the full quotes and source URLs are in the sibling files. Not legal advice.

Tags, as in the sibling files:

- **[M]** measured: I ran it or read it myself this session, on the source page, in the repo, or
  on the current build.
- **[S]** sourced: taken from a sibling file or a secondary source, not re-checked here.
- **[I]** inference or proposal.

---

## The answer first

**Yes, there are real alternatives to VRoid. But the first thing to fix is how we set the
proportions, not which body we start from.** I measured the current build, and its nude body is
not "generic" where you'd expect [M]:

- **The waist is already pinched harder than our own design asks.** In three-quarter view it's
  10.5 px at 144 px tall. DESIGN.md wants 15 px, and that 15 includes the costume.
- **What's actually off is elsewhere:**
  - The hips are 21.3 px in three-quarter view against DESIGN's 24.
  - The knee sits at 52 px above the sole against DESIGN's 39, so the thighs are short and the
    shins long.
  - The legs are 56% of her height against DESIGN's 52%.
  - Nothing in the design sets a bust number at all.

So "generic" is mostly about the shapes between the measuring points: the bust shape, the line
from hip to thigh, how heavy the thighs are, and a waist pinch that's short and sudden. Knob
tuning can't fix those reliably [I]. Every route below therefore ends in the same step: a written
proportion sheet, applied by script, checked by measurement.

**Ranked routes:**

1. **Keep the current CC0 body and rig, and apply a proportion sheet by script.** Optionally,
   pull the curves from a free CC0 anime sculpt (Death Joe's "busty" and "thicc" bodies) by
   projecting our mesh onto it. Costs $0 (the pack is pay-what-you-want, suggested $2). No
   licence risk. Smallest effort, and it answers "is the base even the problem?" within one
   build.
2. **Swap to a free anime base.** First choice is David Onizaki's "Genshin Style Anime Female
   Base Mesh" (CC BY 4.0, with bust and hip shape keys, no rig). The fallback is MB-Lab's
   "Anime female": rigged, with breast bones and named bust / waist / hip sliders. MB-Lab models
   are AGPL, but its licence exempts 2D renders. Costs $0. Low to medium licence risk; medium to
   large effort.
3. **Buy a professionally modelled BOOTH body.** 水鏡こよみ (¥8,000) ships a `.blend` file and
   plainly allows game production. 龍のヨルちゃん (¥8,000) has an explicit clause allowing
   distribution in games. Low licence risk for sprites. Largest effort, and Dex has to make the
   purchase himself.

**What I'd do [I]:** route 1 now. Then run a blind A/B at 144 px against the current build.
Spike route 2 only if the body still reads as generic after that, and route 3 only if route 2
fails. Nothing done in route 1 is wasted: routes 2 and 3 end with the same proportion pass and
the same gates.

---

## 1. Ranked recommendation

Each column has a job. "Licence risk" is for our actual use: 144 px sprites on a public,
not-for-profit site with a donate button, where the 3D file never ships. "Effort" counts the
work needed to get back to the build's current gates.

| # | Route | Cost | Licence risk | Effort | Dex decides or buys |
|---|---|---|---|---|---|
| 1 | Current HairSample_Female body + proportion sheet + scripted proportion keys; optional projection onto a Death Joe CC0 sculpt | $0 (Death Joe $0+, suggested $2; file sizes not listed) [S] | none: CC0 on CC0 [S] | S–M: one measuring script (a prototype exists), one targets file, and the body keys solved from targets instead of hand-tuned | Approve the sheet's targets and the three conflicts in 2.3. Get the Death Joe pack himself: a Gumroad checkout, even at $0, is his to do |
| 2 | Onizaki CC BY 4.0 anime base, fitted to our `J_Bip_*` skeleton with weights transferred from the current body. Fallback: MB-Lab 1.8.1 anime female | $0 [S] | Onizaki low once the provenance check passes (needs a credit line); MB-Lab medium (AGPL; the footnote defining "non-reverse-engineering scene" is missing; keep the `.blend` private) [S] | M–L: adapter (rename, T-pose, weights), re-tune costume and hair offsets, re-pass every gate, then the route 1 pass on top | Approve the downloads. The Sketchfab download needs Dex's own login. Accept the credit line, or accept AGPL for the private `.blend` |
| 3 | 水鏡こよみ (100円外務省), or 龍のヨルちゃん (KUYUYU/電脳屋) | ¥8,000 each; file size not listed [S] | low for sprites: こよみ 「ゲーム制作…での商用利用も可」, ヨル allows games unless the release contains reusable model data; both ban redistribution [S] | L: VRChat avatar to our rig (strip outfit and hair, rename Unity Humanoid bones, drop lilToon). Body keys are only chest and thigh, no waist or hip, so the route 1 pass still runs | Buy it himself on BOOTH. Before buying, ask the こよみ author for the list of 29 body keys |

### Why this order

- **Route 1 first, because the measurements point at the method, not the mesh [M/I].**
  - `body.py` already does more than scale. It has Gaussian width bands (`PROFILE`, `GLUTE`,
    `THIGH`, `CALF`, `KNEE`, `ANKLE`, `INNER_THIGH`) [M, repo].
  - Those numbers were hand-tuned by critics across rounds r2-r4 and never checked against a
    target table. That's how the waist got over-pinched while the hips and knee drifted [M,
    measured in 2.2].
  - A solved, gated pass fixes that on any body.
  - The one thing route 1 can't add is a better-sculpted surface. The Death Joe projection (2.4,
    stage 4c) is the cheap test of whether a better sculpt matters at 144 px.
- **Onizaki before MB-Lab in route 2 [I].**
  - Onizaki is closest to the target look: its description names "Genshin style" and shape keys
    for "arms, legs, bust, hips, neck, shoulders, and face" [S]. CC BY is simpler than AGPL.
  - Having no rig matters less for us than usual. Our `J_Bip_*` skeleton already sits at
    Rosace's proportions, and weights can be transferred from the current body.
  - The gate: its `genshin` tag means we must confirm it's original work before it enters the
    build. Authored quads and shape keys point to original work; triangulated game UVs point to
    a rip [S].
  - MB-Lab is the fallback if that check fails, or if its sliders turn out better. Its anime
    template is 13,995 vertices, against our body's 5,356 [S; M for ours].
- **Route 3 last [I].** It's the best-crafted surface, but also the most conversion work.
  - Its body keys don't cover the waist or hips [S], so it still needs route 1's pass.
  - Buy it only if routes 1 and 2 still read as generic in a blind A/B.

### Not in the top 3, and why [S, sibling files; I for the verdicts]

- **MPFB2** (CC0 output, maintained, a UE-style rig with breast bones): realistic look. It's
  the fallback if both route 2 bodies fail on topology.
- **Character Creator 5 + ToKoMotion anime morphs** ($299 + $75 list): real sliders, but a
  realistic mesh and a heavy pipeline for a 144 px sprite. Also, buy only the Standard
  (exportable) licence, never iContent.
- **Body Type Generator Pro** ($34.99 personal): it makes waist and hip shape keys, but through
  a GUI. That breaks the scripted build unless its output is exported as data. Route 1 does the
  same job in script.
- **VN3 avatars** such as サフィー and しなの: item R (building into software, games included)
  is "contact the licensor". Out without written permission.
- **Official HoYoverse / Kuro models**: aplaybox flags them "Forbidden for use other than video
  production". Measure their official images, never the files (2.3).
- **Blender Studio Human Base Meshes, Quaternius, Kenney, CharMorph**: Western, low-poly or
  realistic. Not a gacha body.

---

## 2. The proportion sheet

### 2.1 What it is

One JSON file per character, `art/<char>/proportions.json` [proposed]. It lists every
proportion number we set, where each target came from, the tolerance, and how to measure it.
The build reads it, applies it to whatever base we use, measures the result and fails if a
gated number is out of tolerance. The numbers are ours, not anyone's mesh, so the file lives in
the public repo.

**Units.** Lengths are in **heads (h)**: skull top to chin, on the skin, under the hair. Heights
are in **H**: skull top to sole, boot sole included (PIPELINE 2.1). At 144 px, h is about 24 px
and **1 px ≈ 0.042 h**.

### 2.2 The sheet: current build, targets, gates

The "current" column comes from the saved build `D:\Dex\Projects\dex-place-art\rosace\build\rosace.blend`
(written 2026-09-29 04:50) [M]. How it was measured:

- Rest T-pose, heeled feet, nude `body` + `head_skin` meshes only.
- Widths come from exact cross-sections of the mesh (edges cut by a horizontal plane), not
  vertex bands. The VRoid body is too sparse for vertex bands.
- Arms are excluded from the torso sections. "q34" is the section's width seen from 45° yaw.
- It was run through the isolated Blender 5.1.2 with the scratch script
  `D:\Dex\Temp\base-options\measure_rest.py`, which reads the file and never saves it.

The "design" column is the canon already in `DESIGN.md` section 2 and `ART-RULES.md`. The
"proposed" column is mine and waits for the reference-measuring pass (2.3) and for Dex.

| # | Number | How it's measured | Current [M] | Design says | Proposed target [I] | Gate |
|---|---|---|---|---|---|---|
| 1 | Heads tall | H / h | 5.92 | 6.0, band 5.5–6.5 (FG-P01) | 6.0 | ±0.1 |
| 2 | Leg ratio: crotch height | crotch (where the torso section splits into two legs) ÷ H | 0.560 (80.7 px) | 0.52 (DESIGN 2); 72 px = 0.50 (FG-P02) | 0.52 | ±0.01 |
| 3 | Knee height | `J_Bip_L_LowerLeg` head ÷ H | 0.362 (52.1 px); the narrowest knee section is at 0.34 | 39 px = 0.27 (DESIGN 2); 38–40 px, "thigh = calf" (FG-P03) | 0.28–0.30. Heels lengthen the lower leg, so thigh:shin 0.8–1.0 rather than exactly 1 | ±0.01 |
| 4 | Hanging wrist | shoulder joint height − arm length, ÷ H | 0.519 (74.8 px) | at the crotch, 72 px (FG-P02) | at the crotch ±2 px, once row 2 is fixed | ±2 px |
| 5 | Neck length (front) | chin → `J_Bip_C_Neck` head (this underestimates the visible neck by the drop to the collarbone notch) | 0.12 h (3.0 px) | none; r3-fix critics: "3 px of skin above the collar" (`body.py`) | 0.20–0.25 h (5–6 px), from the ref pass | ±1 px |
| 6 | Neck width | section width at mid-neck | 0.27 h (6.5 px) | 8–10 px (FG-P06); ART-RULES round R1 drew a 6 px neck in 2D | 0.30–0.35 h (7–8 px); **conflict, Dex call** | ±1 px |
| 7 | Shoulders, outer | shoulder joints + 2 × arm radius measured 3 cm outboard | 1.09 h front (26.4 px); joints 0.86 h | 27 px three-quarter, with costume (DESIGN 2, FG-P05) | 27 px three-quarter at render (2.4 stage 6) | ±1 px |
| 8 | Bust width / depth | section at the deepest chest point (z = 0.744 H) | 0.79 h wide (19.2 px); 0.64 h deep (15.6 px) | **no number anywhere** | from the ref pass; this is Dex's "bust" complaint, so it gets a real target | ±1 px |
| 9 | Bust projection | bust depth − underbust depth (side view) | 0.21 h (5.0 px) | none | from the ref pass | ±1 px |
| 10 | Underbust | section 0.045 H below the bust | 0.54 h wide, 0.44 h deep | none | from the ref pass | ±1 px |
| 11 | Waist | narrowest torso section between hips and bust | 0.45 h front (10.9 px), 0.43 h q34 (10.5 px), 0.39 h deep; at 0.672 H | 15 px three-quarter, with costume (DESIGN 2, FG-P05) | nude q34 0.55–0.60 h (13–14 px), so the costume lands at 15 | ±1 px |
| 12 | Waist pinch length | height band where the width stays under 1.2 × the minimum | about 0.04 H (6 px): 0.656–0.699 H | none | longer and smoother, 0.07–0.10 H, from the ref pass | ±0.01 H |
| 13 | Hips | widest section at hip / upper-thigh level (both thighs) | 1.05 h front (25.5 px), 0.88 h q34 (21.3 px), 0.57 h deep; at 0.562 H | 24 px three-quarter (DESIGN 2, FG-P05) | q34 1.0 h (24 px): more glute and thigh depth, not more front width | ±1 px |
| 14 | Waist-to-hip, q34 | row 11 ÷ row 13 | 0.49 | 15/24 = 0.625 | 0.58–0.62 | ±0.03 |
| 15 | Thigh top / mid | one leg's section 0.02 H under the crotch / halfway to the knee | top 0.48 h wide, 0.59 h deep; mid 0.34 h wide (mid ÷ top 0.71) | none | fuller mid-thigh: mid ÷ top 0.75–0.80, from the ref pass | ±1 px |
| 16 | Thigh gap | gap between the legs at the same two heights | top 1.1 px, mid 2.7 px, knee 3.3 px | none | 0–1 px at the top, 1–2 px at mid | ±1 px |
| 17 | Knee / calf / ankle | leg section widths | knee 0.23 h (5.6 px); calf max 0.30 h (7.2 px) at 0.256 H; ankle 0.13 h (3.2 px) | calf swell and knee notch exist as `CALF` / `KNEE` knobs, no targets | calf ÷ knee ≥ 1.25; ankle ÷ calf ≤ 0.45 (keep the current shape) | ±1 px |
| 18 | Arm length | `UpperArm` head → `Hand` head | 1.61 h (39.2 px) | 45 px (DESIGN 2 table) | follow row 4 (the wrist at the crotch). DESIGN's 45 px conflicts with FG-P02 at this shoulder height: **Dex call** | ±2 px |
| 19 | Hand | wrist → middle fingertip | 0.48 h (11.6 px) | open hand 10–12 px (HD-P03) | keep | ±1 px |
| 20 | Foot | heel → toe length, in heels | 0.55 h (13.4 px) | none | 0.50–0.55 h (anime feet run small) | ±1 px |

A note on the three views, because it trips people up [M]:

- The design widths are three-quarter **silhouettes with costume**. The body targets are
  **nude**.
- Front and q34 widths don't differ by one fixed factor. On the current body, q34 ÷ front is
  0.84 at the hips (the thighs overlap) but 0.96 at the waist (the section is nearly round).
- So never convert with a cosine. Measure both views on the model (2.4, stage 6).

### 2.3 Where the targets come from

The order of authority [I]:

1. **Canon first.** DESIGN.md section 2 and ART-RULES (FG-P01 to FG-P06, HD-P02 and HD-P03) are
   Dex-approved numbers. They win unless Dex changes them.
2. **Dex's own refs** (04, 07, 08 and 09 in `review/refs/character/`), measured on their native
   pixel grid with the `native/` tools (PIPELINE 3.1).
   - They give heads tall (04: 6–6.5; 07: 5.7; 08: 6.0; 09: 6.3), crotch height and knee
     height [S, REF-BREAKDOWN].
   - At a 24–25 px head, a 1 px landmark error is 4% of a head. The refs are also posed, not
     neutral. So use them for heights, and treat their widths as ±1 px bands only.
3. **Reference-only gacha models, from images only** (`BASE-OPTIONS/reference-models.md`
   section 2):
   - Sources: official full-body art, Dex's own in-game photo-mode screenshots, frames of the
     aplaybox preview video watched in the browser.
   - Front and side views, a long lens, a neutral stance.
   - The 13 landmarks from that file, recorded as ratios in heads.
   - At least 5 characters from at least 2 games, so no single character is copied.
   - No PMX file is ever downloaded, loaded or used as an underlay. Their terms are video-only.
   - This pass fills the rows that canon leaves empty: bust, underbust, pinch length, thighs,
     neck and feet.
4. **Pick inside the spread.** Take the mean ± spread per row. Push the stylised rows (bust
   projection, hip depth, waist ÷ hip) toward the stylised end of the spread, not past it.
5. **Conflicts go to Dex, not into the file silently.** Three are open now:
   - Row 2, the crotch: 52% by canon, 56% in the build.
   - Row 3, the knee: 39 px by canon, 52 px in the build.
   - Row 6 and row 18: neck width, and arm length against the wrist rule.

**From silhouette to nude.** The design widths include the costume. To get the nude target:

- Render the same pose at 144 px with the costume on and off.
- Scan the alpha mask at the landmark rows. The difference is the costume thickness per row.
- Nude target = silhouette target − costume thickness.

The bodice sits 0.0065 m off the skin (PIPELINE 2.1). At ppm 81.41 that's about 0.5 px per side
[M, arithmetic]. That's where the 13–14 px nude waist in row 11 comes from.

### 2.4 Applying the sheet to any base, by script

The rule that keeps it deterministic, and keeps skin weights valid:

- **Anything that moves a joint** (a length, the shoulder width, where the knee is) goes into
  the **rest remap**. The remap moves bones and vertices together with one function, as
  `body.py` already does.
- **Anything that only moves the surface** (bust, waist pinch, hip flare, thigh mass, calf)
  goes into **named shape keys** under the armature.
- Every input is JSON. No step depends on a hand-edited `.blend`. PIPELINE 4.1 already says
  "the scripts are the model".

The stages, as a proposed `rosace/proportions.py`, plus one adapter per base in
`rosace/bases/<id>.py` [all I]:

0. **Adapter (one per base).**
   - Rename to `J_Bip_*`, including `J_Sec_{L,R}_Bust1/2`. `outfit.py` reads the bust, neck,
     hip, knee, ankle, shoulder, elbow and wrist from those bones [M, repo].
   - Convert an A-pose rest to a T-pose: pose it to T, apply the armature per shape key, then
     apply the pose as rest.
   - Face −Y, Z up, metres. Strip clothes and hair.
   - Rename tables:
     - MB-Lab: `pelvis → Hips`, `spine01-03 → Spine/Chest/UpperChest`,
       `clavicle → Shoulder`, `thigh → UpperLeg`, `calf → LowerLeg`, `toes → ToeBase`,
       `breast_L/R → J_Sec_*_Bust1` [S, free-bases 3.1].
     - Onizaki has no rig: fit our skeleton to the mesh, then Data Transfer the weights from the
       current body (nearest face interpolated) and clean them up.
1. **Densify, only if needed.**
   - The current body is 5,356 vertices including the hands [M]. At 144 px one output pixel is
     1.3 cm [M, arithmetic: 1.8956 m ÷ 144].
   - If stage 6 shows faceted curves at the render supersample, apply one Catmull-Clark
     subdivision before any key. Vertex groups interpolate through it.
2. **Lengths, via the rest remap.**
   - Generalise `Restyle.remap_z`. Today its knots are HairSample's fixed base heights (0.14,
     0.80, 1.075, 1.422 m) [M, `body.py`].
   - Instead, read the knots from the base's measured landmarks: sole, ankle, **knee**, crotch,
     waist, neck base, head joint. Map them to the sheet's target heights.
   - Adding the knee as a knot is what fixes row 3 without touching row 2.
   - Head size stays a scale about the head joint (`HEAD_SCALE`), solved for row 1.
3. **Widths, via solved width bands.**
   - Keep `body.py`'s Gaussian bands (`PROFILE`, `GLUTE`, `THIGH`, …), but compute their
     amplitudes: measure, set amplitude = f(target ÷ current), re-measure.
   - A fixed 3 iterations, rounded to 4 decimals, so two builds agree byte for byte.
   - Write the result as the shape key `P_widths`, not into the basis, so it can be switched off
     for A/B.
   - Shoulder width moves joints, so it stays in stage 2.
4. **Curves, as named shape keys** (`P_bust`, `P_underbust`, `P_waist`, `P_hip`, `P_glute`,
   `P_thigh`, `P_calf`, `P_neck`). Each is made one of three ways:
   - a. **Scripted field**, like stage 3 but local, for example an underbust crease.
   - b. **Lattice.**
     - A script builds the lattice with point offsets from JSON.
     - It's applied with `bpy.ops.object.modifier_apply_as_shapekey` (present in our 5.1.2
       [M]), then the lattice is deleted.
     - Good for blocking long, smooth shapes: rib-cage taper, pelvis tilt, a longer waist
       pinch (row 12).
   - c. **Projection onto a CC0 sculpt** (the Death Joe bodies).
     - Align the sculpt to our rest pose, bind **Surface Deform** or **Shrinkwrap** (nearest
       surface point) under a region vertex-group mask, and apply it as a shape key.
     - Then run **Corrective Smooth** on the armpit, crotch and neck seams. All four modifiers
       exist in 5.1.2 [M].
     - Only the sculpt's shape carries over. Its topology never enters our file.

   Key values live in `proportions.json`. A hand-sculpted key is saved as per-vertex deltas in
   `art/<char>/keys/<key>.npz` and replayed. That's allowed only for deltas made on a CC0 base
   or by us. Deltas on a licensed base (route 3) stay in the private art folder.
5. **Joint check.**
   - After the keys, each hip, knee and shoulder joint must still sit inside its section's
     centroid ± 10% of the section width.
   - The existing IK gate (hands and feet within 0.1 mm) must still pass.
   - Surface keys mustn't drag the mesh off its joints, or the weights fold at extreme poses.
6. **Measure and gate.**
   - Promote the scratch `measure_rest.py` to `tools/pixel-pipeline/measure_proportions.py`.
     It writes `proportions.measured.json` next to the build, and the build fails on any gated
     row out of tolerance.
   - **Render check:**
     - Render the idle and a neutral three-quarter pose at 144 px.
     - Add shoulder, waist and hip anchors to `meta.json` (projected landmark heights).
     - Scan the alpha mask at those rows and compare with DESIGN's 27 / 15 / 24 ±1 px.
   - The measurement replaces "looks generic" with a number. The blind A/B still decides
     appeal.

The measuring script has already paid for itself: the first vertex-band version reported a
0.2 px waist, because the mesh is too sparse for bands. The cross-section version fixed that
[M]. So any new base gets the section-based measure, never bands.

---

## 3. How this plugs into PIPELINE.md

**Which step.** The brief says "step 4 (model build)". In `PIPELINE.md`, step 4 is the height
A/B, and the model build is **step 6, "Base body and model build"** [M]. Step 4 doesn't change
for Rosace: 144 px is decided, and a new base only has to hold the same H. This section
proposes new text for step 6. I have **not** edited `PIPELINE.md`. Other lanes are editing
it, and none of this is built yet. Whoever builds it applies this text with the proven or
proposed tags, per `AGENTS.md`.

### 3.1 Proposed step 6 [proposed]

**Step 6. Base body and model build.**

- **6a. Pick the base** with `docs/character/BASE-OPTIONS.md` (routes 1–3).
  - Pin it in `third_party.json` with its sha256. Record its licence in its own words, with a
    date, in `THIRD_PARTY.md`.
  - A non-CC0 base and everything derived from it (the `.blend`, sculpted deltas) stays in
    `dex-place-art`, never in the repo.
- **6b. Adapter** (`rosace/bases/<id>.py`): rename to `J_Bip_*` / `J_Sec_*_Bust*`, convert the
  rest to a T-pose, face −Y in metres, strip clothes and hair.
  - **Gate:** all 22 retarget bones in `bone_map_vrm.json` exist, and so do the bust bones.
- **6c. Proportion sheet** (`art/<char>/proportions.json`), filled from canon, refs and the
  image-only reference pass (BASE-OPTIONS 2.3). Dex signs off on the conflicting rows.
- **6d. Proportion pass** (`rosace/proportions.py`): the rest remap for lengths, then solved
  width keys, then named curve keys (BASE-OPTIONS 2.4).
- **6e. Build the rest** (`build_<char>.py`: materials, hair, outfit, glaive, rig, AO).
  - Costume and hair read their landmarks from bones, which the adapter guarantees.
  - Their metre offsets are re-tuned per base (PIPELINE 2.1 already classes these as
    per-model).
- **6f. Gates:**
  - Two builds give identical fingerprints (`cmpblend.py`).
  - IK within 0.1 mm.
  - `measure_proportions.py` has every gated row within tolerance.
  - The 144 px silhouette check hits DESIGN's shoulder, waist and hip widths ±1 px.
  - On a base swap: a blind A/B at 144 px against the previous base, on the Proportion and
    Silhouette rubric dimensions.

### 3.2 Knock-on edits for whoever lands it

- **PIPELINE 3.6 is out of date [M].**
  - It lists `HEAD_SCALE 1.12`, `LEG_STRETCH 1.09`, `PELVIS_SCALE 0.97`, `RIB_SCALE 1.12`,
    `SHOULDER_WIDEN 0.014` and a rest height of 1.7688 m.
  - `body.py` now has 1.265 / 1.30 / 0.92 / 0.97 / 0.028, plus `NECK_STRETCH 1.30` and
    `ARM_STRETCH 1.18`.
  - The saved rig's `rosace_height` is 1.8956 m, and `rig_measure.py`'s docstring says 1.863.
  - Once the sheet exists, 3.6 should point to `proportions.json` instead of copying numbers.
- **PIPELINE 3.3** should gain the measured table from 2.2 above, with its definitions. Two
  critics reading the same render by eye already disagreed by 4-5 px on the head (3.3).
- **PIPELINE 4.2, "Base bodies: use CC0 VRoid samples"**, becomes: CC0, or CC BY with a credit
  line, or a licence whose own text allows use in games. Anything not CC0 stays private, with
  the licence quoted in `THIRD_PARTY.md`.
- **The step 6 "Non-VRoid body route"** loses its line "the restyle knots are
  HairSample_Female's". The knots now come from landmarks (stage 2), so every base is handled
  the same way.
- **Section 6 (refactor list)** gains: `body.py`'s knobs move into `proportions.json`; add
  `measure_proportions.py`; add the `rosace/bases/` adapters.

### 3.3 What Dex decides

1. Route 1 now, with a blind A/B before any base swap? (Recommended.)
2. The three conflicts: row 2 (crotch 52% or 56%), row 3 (knee 39 px or 52 px), and rows 6 and
   18 (neck width 6 or 8–10 px; arm length against the wrist rule).
3. Whether to run the reference-measuring pass. It needs Dex's in-game screenshots, or approval
   to measure official full-body art in the browser.
4. Downloads, each approved on its own. Death Joe pack ($0+, size not listed). Onizaki base
   (free, needs Dex's Sketchfab login, size not shown). MB-Lab 1.8.1 (GitHub; repo about
   220 MB).
5. Purchases, route 3 only: 水鏡こよみ or 龍のヨルちゃん at ¥8,000. Dex buys on BOOTH himself,
   after the こよみ author has answered about the body keys.
