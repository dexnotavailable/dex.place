# Character pipeline playbook

How to make any dex.place character (player, NPC or boss) with the route we built for Rosace.
It covers the steps, the numbers, the commands, the gates and the mistakes that cost us time.
Rosace (the player) is the only character built so far, so she is the worked example, and
most rules were tuned on her. Section 2.2 says which rules carry over to NPCs, enemies and
bosses, which flip, and which don't apply. Units (H_px, H_m, ppm, du) are defined in 2.1.

`AGENTS.md` makes this file the entry point for character work. Any lane that changes the
character, render or motion pipeline updates this file before it finishes.

Status tags:

- **[proven]**: measured or run on this PC. The source file is cited.
- **[in progress]**: built in part, or waiting on a redraw or engine change.
- **[proposed]**: designed and checked by arithmetic, but not built or playtested yet.

Last full update: 2026-09-29 (second-character pass: units, class table, enemy and boss rules).

---

## 1. The route, and why

We model the character in 3D in Blender and render her through palette-exact toon shaders at
sprite size. A pixel post-process then adds 1 px lines, cleanup and a baked rim. Faces and
final touches are hand-authored pixel layers on top, and those layers survive re-renders. The
runtime lights the sprites with a normal map. For motion, AI models give us body mechanics
(NVIDIA Kimodo generates motion from key poses and text; NVIDIA GEM-X captures motion from
video). We retarget that onto our rig and retime it to anime timing ourselves. Every stage is
judged in blind A/B rounds against Dex's reference images.

What led here:

- **Code-drawn 2D failed.** The previous attempt drew the character as procedural contours
  in code (the "crimson halo" rig on branch `claude/magical-meitner-ea41go`). Dex rated it
  3/10 (`DESIGN.md` section 12). Two earlier builds met their specs and still felt janky. Dex
  trusts taste loops over spec compliance.
- **The 3D-to-pixel spike worked (2026-09-28).** It built a stand-in priestess in headless
  Blender 5.1.2 and ran a 24-frame sweep through the whole route. It wrote exact palette bytes
  with 0 off-palette pixels. A full re-render plus post-process of 24 frames took 13 s at
  96 px (1x sampling), and 38.5 s in Blender plus 21 s of post-process at 176 px (4x
  supersampling). Three critics scored it 3.5 / 4 / 3.5 and all called the route viable. They
  put the gap on the stand-in model and the missing hand passes, not on the route. (Journal
  `D:\Dex\Temp\pipeline-playbook\process\wf_df417f73-0b3.txt`, spike entry;
  `review/spike-3d-pixel/`.)
- **The first real model round (2026-09-29)** scored 4.5 / 4.5 / 5.5 / 4.5 / 5 across five
  critic lenses (refs = 9). No critic preferred ours yet, and all five picked 144 px as the
  height. That is the current bar to beat (`wf_12179d17-dce.txt`, critic:*:r1).

Why each piece exists:

| Piece | What it buys | Evidence |
|---|---|---|
| 3D model | Volumes, costume and proportions stay the same across frames and angles. An apparition at 2.5x size is just a bigger render, not a redraw. | spike; `DESIGN.md` 12 |
| Palette-exact toon render | Every pixel is a palette colour straight out of Blender, so nothing needs snapping | spike, r2 stills: 0 off-palette px |
| Hand layers (face stamps, overrides) | A downsampled 3D face never reads at sprite size, so faces are placed pixel by pixel | `DESIGN.md` 5, 12 |
| AI motion + our retime | AI gives weight shifts and foot plants. Anime timing (holds, snaps, pushes) stays ours | `tools/motion-ai/MODELS.md` |
| Blind A/B critic loops | Several independent critics must say we tie or beat the refs, part by part | `QUALITY-RUBRIC.md` |

Hard rules: no image generation anywhere. The generative Blender add-ons stay off, and
`blender_env.py check` fails if they load. Raw third-party files never enter the public repo.

---

## 2. A new character, step by step

### 2.1 Units and world scale (all characters)

| Name | Meaning | Rosace |
|---|---|---|
| **H_px** | Shipped sprite height in px: skull top to sole, standing. Excludes hair volume, ears, hats, crowns, horns, halos and the weapon | 144 [proven, step 4] |
| **H_m** | Rest height of the rig in metres, same span (stored on the rig as `rosace_height`) | 1.7688 [proven, `body.py`] |
| **ppm** | Render scale, px per metre = H_px / H_m | 81.41 [proven] |
| **H** | Shorthand for H_px when a length is on screen, H_m when it is on the model. Ratios "in H" work in both | – |
| **du** (design unit, the old "design px" k) | H_m / 96 metres. A fixed modelling unit from the 96 px era, **not a screen pixel**. At Rosace's 144 px, 1 du = 1.5 screen px | 0.01843 m |
| **H_box** | Bounding-box height including crowns, horns, halos and hair volume. Use it only when comparing with refs that measure that way (ref 13's 113-136 px are H_box) | – |

**Sizing rule** [proposed; applies from the second character on]:

- **One world scale.** Every character renders at the player's ppm (81.41 px/m), so pixel
  density matches on screen.
- **Non-player characters are sized relative to the player**, as a multiple of the player's
  shipped H_px (144, not the 96 px still written in `MOVESET.md` and `DESIGN.md`). Model them
  at real size: H_m = H_px / 81.41. Example: a 230 px warden is 2.825 m on the rig.
- **Only the player runs the three-height A/B** (step 4). Everyone else inherits the scale.
- **Metre thresholds under a shared ppm:** one output px is 1/81.41 = 0.0123 m for every
  character. Thresholds that exist to control *pixel* size keep their metre values unchanged:
  inner-line depth step 0.018 m (about 1.5 px), depth jump 0.12 m (about 10 px), hair clump
  step 0.012 m (about 1 px), AO max distance 0.075 m (about 6 px) and offset 0.0015 m.
  Thresholds that exist to fit *this body's geometry* get re-tuned per model: the bodice-to-skin
  offset 0.0065 m, Solidify thicknesses, the restyle knots. Tag stays proposed until a second
  character has been rendered with them.
- **If a character is ever rendered at a different ppm** (don't, without a reason), scale the
  pixel-size thresholds by 81.41 / ppm_new.

### 2.2 Which rules apply to which character class [proposed unless a cell says otherwise]

"Applies" means use as written. "Inverted" means the rule exists but from the other side.
"n/a" means skip it. Every row is proven only for the player column.

| Rule (section) | Player | Friendly NPC | Enemy | Boss |
|---|---|---|---|---|
| Height A/B (step 4, 3.2) | applies [proven] | n/a: sized from player H_px (2.1) | n/a: sized from player H_px | n/a: sized from player H_px |
| Palette ≤ 32 colours, 3-4 bands per material (3.4) | applies [proven] | applies | applies | applies |
| Hue-shifted shadows, "never grey" (3.4 step 2) | applies [proven] | applies | **inverted**: neutral grey ramp is the enemy look (ref 13) | **inverted** |
| No `#000000`, dark masses must not read as black, hair-share check (3.4, 3.9) | applies (outline rule proven; hair share proposed) | applies | **n/a**: black mass allowed (ref 13) | **n/a** |
| Reserved hues (3.4) | excludes enemy red and grey | must not use enemy red; may share player hues | **inverted**: excludes every player hue (3.4 list) | **inverted** |
| 1 px tinted outline (3.9) | applies [proven] | applies | **n/a**: ref 13 has no outline | **n/a** unless a boss ref says otherwise |
| Face library (3.10) | applies | applies if it has a face | faceless or masked: override glyphs only | same as enemy |
| Rim table (3.11) | cool A / warm G [proven in stills] | player table allowed | **inverted**: enemy ramps only (3.11) | **inverted** |
| VFX width floors (3.12) | applies | n/a | n/a: size hit areas against the player (3.12) | n/a: same |
| Player timing tables (3.13) | applies | n/a | n/a: enemy timing has no sourced numbers (3.13) | n/a: same |
| Critic lenses (5.1) | 5 lenses as written | lens set B | lens set C | lens set C |
| Runtime package (3.15) | `dex.sprite/1` player clips [proven] | not designed | turret only [proven]; others not designed | **not designed** |

### 2.3 The steps

Each step lists what goes in, what to run, what comes out, and the gate that must pass before
the next step. "<char>" is the character's folder name.

**Step 0. Machine setup (once).** [proven]

- Blender: `python tools/pixel-pipeline/blender_env.py setup`, then `... check`. This installs
  the pinned VRM 4.7.2 and Retarget 5.2.0 extensions into an isolated root. Motion: follow
  `tools/motion-ai/SETUP.md` (two venvs, pinned weights).
- **Gate:** `check` passes: Blender 5.1.2, every path under `D:\Dex\Tools\blender-dexplace`,
  and no forbidden module loaded.

**Step 0.5. Parameterise, or stop.** [blocker for any second character]

- Every script in section 6 item 1 still writes into `art/rosace`,
  `dex-place-art\rosace\build`, `review/rosace` or `motion-ai/raw`. A second character run
  as-is silently overwrites Rosace's data.
- Before step 1: add `--char` / `DEXPLACE_CHAR` to those scripts, or run from a copy.
- Fork these per character (they *are* the character): `build_rosace.py`, `render_rosace.py`
  (camera and pass settings are generic; the imports are not), `rosace/outfit.py`, `hair.py`,
  `glaive.py`, `motion-ai/rosace_keys.py`, `rosace_moves.py`. Generic in principle but still
  Rosace-bound: `rosace_post.py`, `rosace_check.py`, `rim.py`, `faces.py` (section 6).
- **Gate:** a dry run of each script on `<char>` writes nothing under a `rosace` path.

**Step 1. Turn the refs into measurable targets.** [proven]

- In: Dex's refs, copied to `review/refs/<char>/` (git-ignored).
- Run, from the refs folder: `native/_pitch.py`, `_runs.py`, `_downscale.py`, `_ruler.py`,
  `_bbox.py` and `_palette.py` (section 3.1).
- Out: a `REF-BREAKDOWN.md`-style table per ref. It gives the pitch verdict, height H, head
  size, heads tall, eye size, outline colour, bands per material, palette groups and VFX
  width in H.
- **Gate:** every pixel ref has a pitch verdict whose reconstruction error beats the 1.07x
  control. Lossy and painted refs are flagged, so their palette counts and grids are not used
  as targets.
- **No recoverable grid** (comb score about 0.08 or less and no clean run clusters, like ref 13,
  the only enemy ref) [proposed branch]: the ref is **style-only**. Use it for palette rules
  (which hues, how many ramps, black or not), silhouette and outline yes/no. Don't take px
  sizes, eye sizes or palette counts from it. If the character depends on that ref, ask Dex for
  a second, lossless ref before any px target is set.

**Step 2. Rubric and critique params.** [proven]

- Copy `QUALITY-RUBRIC.md` (12 dimensions plus costume) and `CRITIQUE-PARAMS.md` (31 params)
  into `docs/character/<char>/` (layout in 4.1). Pair each dimension with a named ref for this
  character. For a non-player, swap the params listed under its lens set in 5.1.
- **Gate:** every dimension has a ref to beat.

**Step 3. Design doc.** [proven as a process]

- Write `docs/character/<char>/DESIGN.md` with: silhouette, proportions in H, palette and
  ramps, a face pixel budget, outline rules, the rim table and the model-sheet locks. Use
  Rosace's `DESIGN.md` as the template.
- **Gate:** 32 colours or fewer. Every contrast pair in section 3.4 passes. The value plan
  holds. **Every hue the opposing side owns is excluded** (3.4 "Reserved hues": the player's
  list for an enemy, the enemy's list for the player).

**Step 4. Height A/B, before anything else is built.** [proven]

- Render the first real model at three candidate heights through the full pipeline, faces
  included (Rosace used 96 / 128 / 144). Blind A/B them against the refs at 3x and 6x, plus
  1x in-context shots.
- **Gate:** pick the smallest height where the critics agree the face, hands and trim
  resolve. Then rewrite every px number in the docs for that H.
- **Player only.** NPCs, enemies and bosses skip this step: they take H_px as a multiple of the
  player's 144 px at ppm 81.41 (section 2.1), then check the camera fit (3.16).

**Step 5. Concepts and moveset (combat characters).** [proven, ran once]

- Three concept agents, three judges, a synthesis, a critic, then a revise pass (section 5.5).
- Out: `MOVESET.md` with frame tables at 60 fps, hitboxes in H, VFX layers and hex colours.
- **Gate:** the critic's verdict is not blocking. Widths are measured as hit span, not arc
  length. The flash budget passes.

**Step 6. Base body and model build.** [proven]

- Pick a CC0 VRoid sample with separate Face / Body / Hair meshes and `J_Bip_*` bones
  (section 4.2). Pin it in `tools/pixel-pipeline/third_party.json`, then run
  `python fetch_third_party.py` and `python inventory_imports.py`.
- Build (fork the script per character, step 0.5):
  `tools/pixel-pipeline/blender.sh --python build_<char>.py -- --out <art>/<char>/build/<char>.blend`.
- **Gate:** two independent builds produce identical fingerprints (`cmpblend.py`: A.json ==
  B.json; it still lives only in `dex-place-art/rosace/build/scratch/`, outside the repo, and
  should be promoted to `tools/pixel-pipeline/`). The rest height is stored on the rig. IK
  hands and feet land within 0.1 mm (spike).
- **Non-VRoid body route** (armoured construct, tall monster, anything a VRoid girl can't be
  restyled into) [proposed; nothing built]:
  - Keep a `J_Bip_*` skeleton anyway, because posing (3.7), IK, `bake_keys` and the planned
    SOMA retarget all address those bone names. Scale it to H_m.
  - Rigid parts (armour plates, helmets, a stone body) are separate meshes **parented to one
    bone each**, not skinned, so they never bend. Only soft parts (cloth, cape, tabard) are
    skinned or draped.
  - Solidify and the drape-stiffness numbers (3.6) apply to hanging cloth such as capes only.
  - The restyle knots (3.6) are HairSample_Female's and don't apply; model the body at its
    target proportions directly.

**Step 7. Poses and renders.** [proven]

- Write pose JSON files in `art/<char>/poses/` (section 3.7), then run (fork per character):
  `blender.sh --python render_<char>.py -- --blend ... --pose ... --px <H_px> --ss 4 --out <dir>`
  (Rosace's step-4 run used `--px 96,128,144`).
- **Gate:** `meta.json` is written with anchors. The render's beauty pass is palette-exact.

**Step 8. Post-process, faces and overrides into key stills.** [proven]

- `python rosace_post.py --raw <dir>/px<N> --tag noface --no-face`, then
  `python overrides.py build|apply --still <dir>/px<N> --layer <pose>_<N>`, then
  `python rosace_check.py <dir>`.
- **Gate, universal:** 0 off-palette pixels. The colour count is within the palette. Proposed:
  orphan pixels under 0.5% of opaque pixels (`rosace_check.py` doesn't compute this yet).
  Override patches that don't match their `authored_on` render are reported STALE, not
  applied.
- **Gate, opt-in per character** [proposed]: the hair-share rule (3.4), only for characters
  whose dark masses must not read as black (player and friendly NPCs). `rosace_check.py`
  hard-codes it and the 29-colour limit today; each check should become a `palette.json` flag
  (section 6 item 5).

**Step 9. Stills A/B round.** [proven]

- `python round1_sheets.py --renders <renders> --out review/<char>/round-<n> --seed 20260929`,
  then five lens critics (section 5).
- **Gate:** the pass rule in section 5.3. Otherwise one integrator applies the fixes and the
  loop repeats, up to 6 rounds, before the pivot rule applies.

**Step 10. Motion generation.** [proven for generation and QC]

- Block the key poses as numbers (`tools/motion-ai/rosace_keys.py` `Pose`), then run
  `rosace_moves.py keys` (IK residuals), `build` (constraint JSON) and `gen` (Kimodo). Video
  capture is optional: `gemx_capture.py`, then `capture_segments.py cut|rekey`. Then run
  `review_batch.py` (previews plus QC).
- **Gate:** worst IK key residual 3 cm or less (`keys` prints anything over 3 cm). The QC
  flags are clear or explained (section 3.14). Then a human or critic picks a variant from the
  sheets; the score only sorts them.
- **Characters that aren't human-sized:** generate and QC at Kimodo's 1.76 m human scale, and
  scale at retarget (3.14 "Scale convention") [proposed].

**Step 11. Retarget and retime.** [**BLOCKED** until the SOMA-to-VRM mapping and the retime
step exist. Steps 12-13 need real motion, so they are blocked for every character too: a new
character can get through step 10 and no further.]

- Import the BVH into Blender and retarget SOMA onto the VRM rig. Sample it at the MOVESET's
  drawing frames only, add holds, snaps and overshoot, and push the poses. Then bake to FK
  keys with `posing.bake_keys` and render the frames.
- **Gate (proposed):** the key poses match MOVESET. No interpolated in-betweens. Both hands
  stay on a two-handed weapon.

**Step 12. Export and runtime.** [proven for the contract; real package not exported yet]

- Pack albedo and normal atlases and write `public/lab/character/manifest.json`
  (`dex.sprite/1`, section 3.15). Load `/lab/` and press the backquote key for the debug
  overlay.
- **Gate:** `validatePackage` passes. Clips play at game speed.
- **The exporter must write a real ink mask** (normal alpha under 128 on outline and inner
  lines only) before any dark character ships. The albedo fallback is unsafe for enemy
  palettes (3.15).
- **Enemy / boss package: not designed.** The runtime knows only the player clip ids and the
  turret package, and the manifest paths are fixed (`/lab/character/`, `/lab/turret/`). A boss
  needs clip ids, AI states, telegraphs, phases, poise and stagger, and a per-character
  manifest path (proposed `/lab/<char>/manifest.json`). Owner: the lab engine lane (`src/lab/`,
  `RUNTIME-CONTRACT.md`). Until it exists, step 12's gate can't apply to a boss.

**Step 13. Motion A/B in the lab, then update this file.**

- Critics judge motion playing at game speed, and ref frames as flipbooks at our timing.
- **Gate:** the pass rule, applied to the motion and effects params (19-30).

---

## 3. Formulas and numbers

### 3.1 Recovering a ref's native pixel grid [proven]

The "pitch" is how many image pixels make up one art pixel. Many refs are upscaled, and some
are resized by a non-integer factor. We run three checks and keep the pitch they agree on.
Source: `review/refs/character/native/_pitch.py`, `_runs.py`, `_downscale.py`;
`REF-BREAKDOWN.md` "How the measurements were made".

| Check | How | Reading |
|---|---|---|
| Run lengths | Runs of near-identical colour (tolerance 12 per channel), every 3rd row, weighted by length | An integer upscale k clusters runs on k, 2k, 3k |
| Comb spectrum | D(x) = rows where the max-channel change between x-1 and x exceeds 24. For p from 1.2 to 30 in steps of 0.005: R(p) = \|Σ D(x)·e^(−2πix/p)\| / Σ D | Take the **largest** p whose peak is at least 0.8 of the best peak (so a divisor like P/2 isn't picked). Offset = phase/(2π)·p mod p |
| Reconstruction | Sample each cell's centre, scale back up, and take the mean absolute error per channel (0-255) | Must clearly beat the same test at pitch x1.07 |

Measured on Rosace's refs (score, then error against the control):

| Ref | Pitch | Evidence |
|---|---|---|
| 01 | 4 | 0.99/0.98; 1.41 vs 10.06 |
| 02, 03 | 8 | 0.86 and 0.93; 1.76 vs 8.97 and 2.24 vs 11.67 |
| 04 | 2.158 (web-resized) | 0.26-0.29; 4.01 vs 6.74; offset (1.85, −0.49) refined by minimising the error |
| 06 | 7.5 exactly (gives a 160x90 canvas) | 0.93/0.94; 1.82 vs 4.75 |
| 07, 08 top panels | 2 | Confirmed against the artist's 1x panel. For 07 the grid phase (x even, y odd) came from the within-block variance: 43 against 190-293 at the other offsets |

- **Already 1x:** comb score about 0.08 or less, with length-1 runs making up 40-55% of pixels
  (05, 09, 10).
- **Painted refs** (11, 12, 14) have no grid. They are mood and outfit refs only.

Commands, run from `review/refs/character/` (the scripts need that working directory):

```sh
python native/_pitch.py FILE [x0 y0 x1 y1]
python native/_runs.py FILE x0 y0 x1 y1 [tol]
python native/_downscale.py                      # rebuilds native copies; job list is hard-coded
python native/_ruler.py FILE x0 y0 x1 y1 SCALE STEP OUT
python native/_bbox.py FILE "[(r,g,b),...]" TOL DIL MINH [x0 y0 x1 y1]
python native/_palette.py FILE x0 y0 x1 y1 "[(bg rgb),...]"
```

### 3.2 Height rule and pixel budgets

**Height rule** [proven 2026-09-29]:

1. Take the native heights of the refs whose face and finish the owner points at. For Rosace
   these were refs 07-09, at 137-163 px.
2. Render three candidate heights through the full pipeline (step 4).
3. Pick the smallest height where the face, hands and trim resolve.

Rosace: all five critics picked 144, with 128 as the floor. At 96 the eyes were a lash bar
over two cyan dots, and the hands, trim and blade detail collapsed into blobs. Source:
`wf_12179d17-dce.txt` critic:*:r1 `bestHeight`.

Redo this arithmetic whenever H changes:

| Quantity | Formula | 96 | 128 | 144 |
|---|---|---|---|---|
| View width in H (640x360 view) | 640 / H | 6.67 | 5.0 | 4.44 |
| View height in H | 360 / H | 3.75 | 2.81 | 2.5 |
| Pixel work per drawing, relative to 96 | (H/96)² | 1 | 1.78 | 2.25 |
| Head at 6 heads | H / 6 | 16 | 21.3 | 24 |
| Blender scale (Rosace, H_rest = 1.7688 m) | ppm = px / H_rest | 54.27 | 72.36 | 81.41 |

**Ref targets** [proven, `REF-BREAKDOWN.md`]:

- Body refs are 5.5-6.5 heads (04, 07, 08, 09, 10), with heads of 21-25 px at H 120-158.
- The chibi refs (01 at about 4 heads, 06 at about 3) are not body targets.
- Weapons are 0.93-1.1 H in the refs. A glaive may run 1.2-1.4 H. H here excludes headgear
  (2.1). When a ref's height includes a crown or horns (ref 13), compare H_box with H_box.
- **Non-players** don't use the height rule: H_px = multiple × 144 (2.1). Check the camera fit
  (3.16) before modelling.

**Eye budget by head size** [measured on refs; the 144 spec comes from critics]:

| Head (px) | Eye | Rest of the face |
|---|---|---|
| about 15 (ref 05) | 2 px | 1 px mouth, no nose |
| 16 (96 px body) | 3 wide x 2: a lash row with the outer end flicking up 1 px, 2 iris tones, 1 skin px. Far eye 2 px | 1 px blush |
| 21 (128) | 4x3, 2x2 iris, 1 px highlight at the top inner corner | 1 px brows through gaps in the bangs, 1 px nose shadow |
| 22-25 (144; refs 07-09) | 5 wide x 4-5 tall, arched lash, 1-2 px outer flick, lower-lash dot. 3-tone iris (dark top, mid, bright bottom glow), a 1-2 px highlight on the upper light side that never touches the white. Far eye 4 wide | Brows 1-2 px stamped over the bangs. Serene mouth 2 px with an upturned corner; resolute is a 2x2 open mouth. Blush is a 2-3 px hatch under each eye |

At every size: flat skin below the lash line, plus one far-jaw line. Never downsample a 3D
face. The table stops at a 25 px head: nothing larger has been measured on a ref, so a big
character's face needs its own ref measurement first [unknown]. Faceless and masked characters
skip this table (3.10). Rosace's 144 face library scored 5.5/10 and is waiting on a redraw to this spec
[in progress].

### 3.3 Proportions (Rosace, in H)

Design targets [proposed, `DESIGN.md` 2]:

- About 6 heads.
- Crotch to sole is 52% of H.
- Shoulders / waist / hips are 18 / 10 / 16 px at 96 in three-quarter view (a clear
  hourglass).
- Glaive 1.35 H.

What the round-1 critics asked for:

- Lengthen the torso 3-4 px through the ribcage, not the pelvis.
- Narrow the waist 2 px per side and widen the shoulders 1-2 px.
- Contrapposto: pelvis tilted 8-12°, shoulders counter-tilted.
- Leading hand and blade at 110-125% for foreshortening; extended limbs about 10% longer on
  contact frames.

Measured on the rig at 144, before and after the fix [proven, `fix:r1`]:

| | Before | After |
|---|---|---|
| Skull | 23.6 px | 22.3 px |
| Heads tall | 6.09 | 6.46 |
| Chin to crotch | 37.4 px | 41.7 px |
| Shoulder joints | 17.9 px | 19.9 px |
| Hips / waist | 27.7 px / – | 26.3 px / 17.1 px |

Measure proportions on the rig or with a script. Two critics reading the same render by eye
got a 27-28 px head and a 23 px head.

### 3.4 Palette, ramps and contrast

**Bands** [proven from refs]: 3-4 per material (ref 01: skin 3, hair 4, white cloth 3). A
material fails at 6 or more bands, with smooth gradients, with pillow shading, or with flat or
grey-shaded white.

**Building the palette** [proven for the player, built and rendered; `DESIGN.md` 4,
`art/rosace/palette.json`]. Steps 2, 4 and the "not black" rule below are player-side rules;
enemies invert them (2.2 and "Enemy palette" below).

1. Take the outfit ref's colour chips as each ramp's lit tone.
2. Build 3-5 steps from light to dark and shift the hue in the shadows instead of greying
   them. White goes lavender (`#f8f5f0 #dcd7e6 #b7aecb #8b80a6`), skin goes rose-brown, gold
   goes brown-orange. Use the brightest step only as a 1 px spec.
3. Share darks across materials. One indigo ramp serves hair, lining, boots and haft.
4. Outline in a tinted near-black: OL `#181032`, never `#000000`.
5. Exclude every hue the opposing side owns (list below). Rosace has no red, no orange-red and
   no neutral grey, because the ref-13 enemy is grey plus red.
6. Give effects their own 4-6 step ramp, dark to hot, with white only at the hottest point.
   Keep one accent hue for one meaning (Rosace: amethyst appears only in the ultimate).
7. Keep the whole character, weapon included, at 32 colours or fewer. Rosace has 29, and her
   stills use 24-29 of them.

**Reserved hues** (the source of truth is each character's `palette.json` plus the effect
ramps in its `DESIGN.md` 4):

| Side | Owns | Codes and hex |
|---|---|---|
| Player (Rosace) [proven, `palette.json`, `DESIGN.md` 4] | azure effects and eyes | A0-A5 `#0d1240 #1a2f8c #2a62d0 #4aa8f0 #a0e6ff #f0fcff` |
| | gold and gold light | G0-G4 `#fff3c4 #ecc96f #d1a452 #a2722f #6a4520`, `#fffbe8` |
| | indigo darks | I0-I4 `#a9b8f2 #6c72d0 #4a4aa6 #322c78 #271f5e` |
| | amethyst (ultimate only) | V1-V3 `#3a1a68 #6a3cb0 #a47ae6` |
| | lavender white, steel, outline | W1-W4, T2-T4, OL `#181032` |
| Enemies (ref 13) [measured, `REF-BREAKDOWN.md` 13] | neutral grey, black to white | `#000000 #131313 #262626 #373737 #4b4b4b #5f5f5f #777777 #939393 #acacac #d0d0d0 #ffffff` |
| | red (enemy effects and tells) | `#240000 #370000 #6f0000 #99180f #c12a20` |

One deliberate crossing [proven as a rule, `DESIGN.md` 4 rule 3]: enemies she hits flash A4 for
2 f, so a hit is marked in her colour. The reverse (what the player flashes when an enemy hits
her) isn't decided.

**Enemy palette** [proposed, from ref 13, style-only]: one neutral grey ramp plus one red ramp,
no other hue. Black carries the mass; white is bone and armour highlight; red goes on capes,
halos, emblems, eyes and **every enemy effect and telegraph**, so red always means "enemy".
No outline (ref 13 has none). Exclude every player hue in the table above. Watch the dark end:
`#131313` against `#000000` is 1.13:1, so adjacent black steps won't separate at 1 px (the
same trap as Rosace's I4 against OL).

**Palette count on a ref** [proven, `_palette.py`]: greedy clusters where every channel is
within 16 of the seed, with the background (within 10) excluded. Count the groups that cover
95% and 99% of the figure. Ref 01 gives 18 and 31. Take counts only from lossless refs;
WebP refs inflate them (07 about 36, 09 about 40).

**Value plan:** dark top (hair), light middle (costume), dark bottom (boots, haft).

**Dark masses must not read as black** [player and friendly NPCs only; rule proposed; measured]: at least a third of hair
pixels should sit in the lighter dark-ramp steps (Rosace: I0-I2). Measured at 144: idle 0.50,
N1 0.45, Q 0.47, N2 0.68. It was 0.01 before the hair-normal fix.
`rosace_check.py` prints this share.

**Contrast check** [proven; every figure below recomputed 2026-09-29]. Use it on every pair
that must separate at 1 px: rim against base, darkest tone against the outline, costume
against the effect core.

```
linear(c) = c/12.92            if c <= 0.04045
          = ((c+0.055)/1.055)^2.4   otherwise          (c = channel / 255)
L = 0.2126 R + 0.7152 G + 0.0722 B
contrast = (L_hi + 0.05) / (L_lo + 0.05)
```

| Pair | Ratio | Verdict |
|---|---|---|
| W1 `#f8f5f0` vs old rim RW `#e6f4ff` | 1.03 | Invisible. This killed the "colour-temperature rim" idea |
| W1 vs A5 effect core | 1.04 | Separate them by hue only: keep her outline and an A4 wrap round the core |
| Old I4 `#211a4e` vs OL | 1.14 | Hair and boot interiors merged into the outline |
| Lifted I4 `#271f5e` vs OL | 1.25 | Still weak. Open |
| OL vs A3 / A4 / G1 (rim on outline) | 7.0 / 13.2 / 11.4 | Good |

The rim-table pairs we accepted range from 1.9 to 13.2.

### 3.5 Toon material and render settings [proven, `rosace/materials.py`, `rosace/render.py`]

- **Light value:** L = BW(ShaderToRGB(white Diffuse)). With sun energy π and a white diffuse,
  the ramp input is N·L directly (spike measurement).
- **Ramp input:** v = ao·(0.82·L + 0.16). Back faces get v = 0.02, so the insides of sleeves
  and tabards go deep.
- **Ramp:** a Constant-interpolation ColorRamp with 4 thresholds `t` per material and 4 codes
  [deep, shadow, lit, highlight]. Rosace examples: white t = [0, 0.14, 0.31, 0.56]; skin
  [0, 0.12, 0.36, 0.64]; hair [0, 0.14, 0.36, 0.66]; gold [0, 0.10, 0.28, 0.60].
- **Spec band:** camera-space normal Nc (x right, y up, z toward the viewer). The spec is on
  where dot(Nc, h) > thr and v > t[2], with h = normalize(LIGHT_CAM + (0,0,1)). Gold G0 uses
  thr 0.93.
- **Hair "angel ring" mode:** on where 0.6 < Nc.y < 0.8, Nc.z > 0.4, Nc.x > −0.25 and
  v > t[1]. A plain N·H spec pooled into one blob on the hair.
- **Passes, all through Emission:** beauty, albedo (flat lit colour), id (R = material id,
  G = part), normal (Nc·0.5+0.5), depth (mapped over `depth_range`, in metres).
- **Engine:** EEVEE, filter_size 0, dither 0, 1 TAA sample, view transform Raw, look None,
  exposure 0, gamma 1, transparent film, PNG RGBA 8-bit. Result: exact palette bytes and
  alpha only 0 or 255 (spike; r2 stills `off_palette []`).
- **Key light:** a sun fixed in camera space, LIGHT_CAM = normalize(0.50, 0.62, 0.60) (upper
  front, on the side she faces), with no cast shadow. Each character gets one fixed light
  (Guilty Gear's rule). Cast shadows made noisy blocks on thighs and hips in the spike.
- **Camera:** orthographic, 12 m away. ppm = px / H_rest, so every pose at a given size shares
  one scale. Canvas = ceil(extent·ppm) + 2·6 px padding, over the union of all frames. The
  anchor (between the feet) sits on an integer pixel: ax = floor(−x0·ppm) + pad,
  ay = floor(y1·ppm) + pad. Render resolution = canvas × ss. Key stills used yaw 55-58° and
  elevation 8°.
- **Baked occlusion** (`rosace/bake.py`): 24 fixed Fibonacci hemisphere rays, offset 0.0015 m,
  max distance 0.075 m, strength 0.9.
  occ = Σ(1 − (dist/0.075)²); ao = clamp((1 − 0.9·occ/24)·(1 − crease)).
  Only base meshes occlude, because a garment's own Solidify shell would occlude itself
  completely.

### 3.6 Model build numbers (Rosace; per-character values) [proven, `rosace/body.py`, `glaive.py`, `hair.py`]

- **Restyle:** one deterministic function applied to every vertex and every bone, so skin
  weights stay valid. Vertical remap is piecewise linear with knots at base z (foot, crotch,
  waist, head joint) = (0.14, 0.80, 1.075, 1.422) m on HairSample_Female.
- **Rosace values:**
  - HEAD_SCALE 1.12 (1.20 read big-headed)
  - LEG_STRETCH 1.09, PELVIS_SCALE 0.97, RIB_SCALE 1.12
  - SHOULDER_WIDEN 0.014 m per side, NECK_SLIM 0.86
  - BUST_SCALE 1.45, BUST_LIFT 0.008
  - HEEL_DEG 24, SOLE 0.018 m
  - Rest height comes out at 1.7688 m.
- **Face normals:** lerp(vertex normal, n_face, 0.85·front). Here n_face =
  normalize(lerp(ellipsoid gradient, (0,−1,0.1), 0.55)), the ellipsoid radii are (0.10, 0.11,
  0.14) m, and front = smoothstep(0.02, −0.05, p.y − c.y).
- **Hair normals:** blend toward a skull ellipsoid above the ears and a body cylinder below,
  with weight 0.8·(0.55 + 0.45k) and k = smoothstep(z_ear − 0.10, z_ear + 0.02, z). Without
  this, round-1 hair read as mottled camouflage.
- **Props in design units:** du = H_m/96 metres (2.1; the code calls it k). Every prop
  dimension is written in du, and metres = du count × H_m/96. Rosace's glaive is 130 du long (1.35 H), with the grips at
  0.36 / 0.47 / 0.58 of its length. A du is not a screen pixel: at 144 px, 1 du = 1.5 px.
- **Hanging cloth gets Solidify** so it never turns edge-on into a 1 px ribbon. Clamp every
  Solidify (even offset off, thickness clamp 1.0).
- **Drape stiffness** (0 = follows the parent, 1 = hangs straight): hair_back 0.55,
  hair_tail 0.85, side locks 0.6, veil 0.7, tabard 0.92, sleeves 0.9, stoles 0.9.

### 3.7 Pose file and render outputs [proven, `rosace/posing.py`, `render_rosace.py`]

A pose file is JSON in degrees and metres, in the rest-pose world frame:

- `camera {yaw, elev}` and `root {loc, rot}`
- `bones {J_Bip_*: [x,y,z]}`, plus `<bone>.scale` for exaggeration
- `weapon {butt|grip, dir, edge}` and `hands {R|L: {grip, slide, thumb}}`
- `poles`, `feet {pos, yaw, pitch}` and `fingers {curl, thumb}`
- `drape {gravity, wind, chains}` and `expression` (a face-stamp id)

`bake_keys([(frame, pose), ...])` solves IK and writes plain FK keys, so the timing between
keys stays ours.

`meta.json` per render records: px, ss, ppm, height_m, canvas, anchor, yaw, elev, light_cam,
depth_range, the materials and colours, the parts, pose_sha1 (the first 12 hex digits),
anchors (projected eyes with a facing dot, mouth, head, root, hands, knees and weapon sockets),
frames and variant.

### 3.8 Pixel post-process (`rosace_post.py`) [proven]

In order:

| Stage | Rule |
|---|---|
| Classify | Match each pixel to the nearest colour in its own material's ramp + spec |
| Downsample (ss 4) | In each block, the label (material, code, part) with the highest priority-weighted count wins. The pixel is opaque if 45% or more of the block is covered. Priorities: gold 2.4, glass core 2.5, edge 1.8, haft 1.7, glass 1.6, thong 1.5, hair tip 1.3, boot 1.1, others 1.0 |
| Cleanup | Drop pixels with no opaque 8-neighbour. Fill 1 px holes. Material orphans take the majority of their neighbours (gold exempt). Band specks of 2 px or less (3 px or less in hair) take the bordering code |
| Band smoothing | On skin, white, stocking, veil and hair, 2 passes. Switch a pixel if 6 or more of its 8 same-material neighbours share one other code. 1 px vertical stripes on stocking and skin merge |
| Silhouette outline | 1 px OL outside the silhouette. Use the material's sel-out tone instead where the outward direction · light > 0.35 and the material isn't a dark one |
| Inner lines | Where a different part sits more than 0.018 m nearer (0.03 merged the tabard into the stocking), or any depth jump over 0.12 m. Drawn on the farther pixel in its material's `inner` tone. A dark occluder over a light surface needs no line |
| Hair clumps | A separator where a different clump is more than 0.012 m nearer (0.004 made crown noise) |
| Face | Stamp from the eye anchors (section 3.10) |
| Rim | `--rim cool:half` etc. bakes the rim into the sprite (section 3.11) |
| Outputs | `<tag>.png`, `_albedo`, `_normal` (outline texels point outward, z 0.45), `_id`, `_x3`, `_x6`, `_stats.json` |

Measured on the spike's frame 9 at 96 px [proven]: 1x sampling left 107 isolated pixels out
of 2,670, and 4x supersampling left 62 out of 2,694 before cleanup. So 4x is only slightly
cleaner at 96; the cleanup stage does the rest.

Cleanup target [proposed, critics]: orphans under 0.5% of opaque pixels (round 1 had
1.5-3.0%). Long diagonals should use even step lengths (not 2-3-2-1).

### 3.9 Outline rules [proven from refs for the player; `REF-BREAKDOWN.md`, `palette.json`]

Player and friendly NPCs. Enemies in ref 13 have **no outline** and use `#000000` as mass
(2.2); an enemy follows its own ref, and the "never pure black" rule doesn't apply to it.

- **Silhouette:** 1 px, tinted near-black. Never pure black, and never 2 px renderer lines.
- **Inner lines:** in the material's own darkest tone. Hair clump lines are one step darker
  than the shadow, not the outline colour.
- **Sel-out:** light materials get their own dark tone on the lit side. White against white
  gets W4, not OL. Every material in `palette.json` carries `line`, `selout` and `inner`
  codes.
- **Effects are never outlined.** The one exception is the "leading" lines on glass objects.

### 3.10 Face stamps and override layers [proven format; 144 faces in progress]

- **Stamp file:** `art/<char>/faces/<facing>_<expr>_<px>.json`, with facing front / q34 /
  profile and expr serene / resolute / radiant. That's 27 files for 3 heights. It holds:
  - `rows`: one string per pixel row; `.` leaves the render alone
  - `origin`: the [col, row] that lands on the anchor
  - optionally `flat`: a box where S3/S4 shading is flattened to S2
  - a letter key (`faces.py` KEY: O = OL lash line, a/b/c = iris tones, h = catch-light, and
    so on)
- **Placement:** the midpoint of the two projected eye bones, pushed along the head's
  screen-space forward vector to the face surface, plus an optional per-still nudge. The stamp
  is mirrored for screen-left.
- **Masking:** stamps are painted after lighting and lines, and only on visible skin. Lashes,
  brows and the bang notch may also land on hair next to skin.
- **Override layer:** `art/<char>/overrides/<pose>_<px>.json` holds authored operations
  (`hand`, `fold`, `cleanup`, `relight`, `hair` lines and `despeckle`) plus a `rim` spec.
  `build` writes the layer PNG and a `.touched.json` listing every pixel it touches. In the
  layer PNG, alpha 0 leaves the render alone and `#ff00ff` erases.
- **Staleness:** patches record `authored_on` {canvas, anchor, pose_sha1}. When the render no
  longer matches, the patches are skipped as STALE while the face and rim still apply.
- Commands:
  `overrides.py build|apply|authored --still <render>/px<N> --layer <pose>_<N>`, and
  `faces.py png` for the library sheets.
- **Faceless or masked characters** [proposed]: skip the face library entirely. Eye slits,
  a glowing visor or a mask mark are **override-layer glyphs** (`overrides.py`, placed per
  pose), not stamps. The face library is 27 files only for a character with a readable face.
- **Stamp key per character** [proposed]: `faces.py` KEY maps letters to Rosace's codes (O=OL,
  d=I4, i=I3, a=A2, b=A3, c=A4, h=A5, w=W1, e=W2, r=I3, s=S3, m=S4, p=SB, k=S2). It should read a
  letter-to-code map from the character's `palette.json`. Today `face_stamp_colors` there is
  only a code list (`OL A2 A3 A5 S3 S4 SB I2`) and doesn't match KEY, so it can't be used as-is.

### 3.11 Rim light on the outline [contrast proven; stills implemented; runtime in progress]

The rim recolours the silhouette's own OL pixel on the lit side. On broad shapes (hair mass,
sleeves, tabards, thighs, back) it also steps the pixel just inside at full level. The
output is always a palette colour (`DESIGN.md` 9, `rim.py`).

| Texel | Cool half | Cool full | Warm half | Warm full |
|---|---|---|---|---|
| Outline OL | A3 | A4 | G3 | G1 |
| Inner W3/W4, S3/S4, T3/T4, G2-G4 | – | A5 | – | G0 |
| Inner I1-I4 | – | A3 | – | G2 |
| Inner W1/W2 | – | – | – | – (the outline carries the rim) |

**Placement** (`rim.py` defaults):

- Direction `[-0.62, -0.78]`, threshold 0.5.
- Convex edges only. Take the opaque share of a 9x9 window round the outline pixel: 46 or
  less of 81 counts as convex, and 38 or less is a peak, which gets the brighter tone.
- Break runs where the material changes and after 7 px at most.
- At most 4 px per run on the head: a glint, never a cap.
- Nothing below the knee.
- Light on both flanks is allowed, but never on top and bottom together.

**Why placement matters:** a full-length 1 px cyan contour read as a sticker, and a full cap
read as a helmet or halo.

**Bake it:** the rim must be baked into the exported sprite with `rosace_post.py --rim`, not
only drawn on review sheets. In round 1 the sheet had 207 A3 px and the shipped sprite had 35.

**Enemy rim** [proposed]: the table above is the player's (cyan A, gold G). On an enemy it
would paint the player's colours onto the opposing side. Build an enemy's rim table from its
own ramps only: red `#c12a20` or light grey `#d0d0d0` on a black silhouette. Contrast against
`#000000`: `#c12a20` 3.62:1, `#99180f` 2.49:1, `#d0d0d0` 13.62:1 [computed 2026-09-29 with the
3.4 formula], all inside the 1.9-13.2 band accepted for Rosace. A black silhouette pixel
(`#000000`) is also runtime ink (3.15), so the runtime rim won't touch it: bake the rim.
Neither the rim-LUT builder nor the contrast script exists yet (section 6 item 4).

### 3.12 VFX width, layers and flashes [proposed; arithmetic checked, not playtested]

**The width floors are player-only.** They exist to make the player feel strong. In the
attacker's own H they break for a big character: 2.2 H of a 230 px boss is 506 px, and a 3-5 H
skill is 690-1150 px against a 640 px view.

**Enemy and boss attacks** [proposed; no numbers sourced]:

- Size hit areas in **player H (144 px)**, against the arena width and the player's escape:
  what matters is whether she can see it and dash out of it, not how wide it looks.
- Every enemy attack has a telegraph in the enemy's red (3.4): a pose, a flash, and for an area
  attack a ground decal showing the exact hit area before it goes live. ZZZ and Endfield use
  colour-coded flashes for the same job (`RESEARCH.md`, "Colour-coded telegraphs").
- The flash cap below applies to every source on screen, enemies included.

**Width** is the horizontal span of the hit area, left edge to right edge, in H. Arc length
doesn't count, and neither does a line that doesn't hit.

| Move | Floor |
|---|---|
| Each M1 hit | 2.2 H or more (the pixel refs 06-10 sit at 0.8-1.75 H, which the rubric fails) |
| M2 trail | 2 H or more |
| Finisher | about 3 H or more |
| Q | 3-5 H |
| R | runs off both screen edges, plus one full-height element |

- Every hit also gets a ground layer wider than its arc.
- Check that each width still fits the view in px at the chosen H. At 144, a 5.6 H Q is
  806 px, wider than the 640 px view.
- Also check vertical reach against the enemy hurtboxes. Rosace's flat bands clipped only
  7-20 px of a turret hurtbox that sits 62-120 px up.
- The reverse check (an enemy's reach against the player's hurtbox) has no target yet: the
  player's hurtbox at 144 px isn't set (3.15).

Ref widths in H: 09 0.8; 08 1.15; 07 1.25; 10 1.3-1.5; 06 1.5-1.75; 12 1.4-4; 11 2.4-4.2.

**Layer stack** (the ref that shows each best): core flash (08, 06), main arc (10, 07, 11),
secondary slivers, motif particles (09), debris (08), ground decal (07, 12, 11), a glow band of
1-2 stepped tones, and screen speed lines (06).

- Big skills use 4 or more layers; a light hit can use 3.
- Draw order: trail behind, slash in front, spark on top.

**Smear:** a thick, crisp, near-white leading edge, 2-3 flat tones through the body, and a
tail tapering to a point.

**Decay:** one full drawing, 1-2 striped drawings, a 1-2 px sliver, then gone. Effects never
pop off.

**Contact halo without leaving the palette:**

- Inner disc to 45% of the diameter in A4 at 50% Bayer dither; outer ring in A3 at 25%.
- 2 f with both bands, then 2 f with only the outer band stepped down, then gone.
- Size 1.2 H on medium-heavy hits and 1.5 H on the heaviest (7% of a 640x360 view).
- Needs "dithered paint" in the engine [proposed, engine ask 15].

**Flat side view:**

- Rings are split into a back half (one step dimmer, 1 px thinner, back layer) and a front
  half.
- Floor designs are bands 10-16 px tall.
- Radial art is one 45° wedge plus exact flips and 90° turns.

**Flash cap** (WCAG 2.3.1: at most 3 flashes in any 1 s):

- At most 2 full-screen flashes in a kit, 100 f apart. Impact frames hold steady and never
  alternate.
- Ship a governor (at most 3 full-screen flashes per 60 f from all sources) and a "reduce
  flashing" setting that turns them into a 40% tint.
- A measured ZZZ insert ran about 3.8 flashes per second, which fails.

### 3.13 Timing and hitstop (60 fps game)

Sourced numbers [proven as sourced, `RESEARCH.md` 2.1-2.8]:

| Source | Numbers |
|---|---|
| Genshin (gcsim), sword / polearm / claymore | Early hits land 7-16 f after input. A finisher needs 29-35 f plus 58-72 f of recovery. Gaps are uneven on purpose. A full string runs 2.7-3.0 s |
| Dead Cells | Balanced Blade 0.15 / 0.25 / 0.12 / 0.22 / 0.12 / 0.60 s per hit; Broadsword 0.60 / 0.75 / 0.90 s |
| Hitstop | Genshin freezes the attacker only: frames = ceil((freeze + 0.06)·fps). deepnight 4 f; SF6 about 10/12/14 f (weak source). Rule of thumb: normal 2-5 f, finishers 6-9 f, big skills 0.1-0.15 s |
| Dash | Genshin about 20 f, invincible from f3 to f24-25. Perfect-dodge slow-mo 0.3x, entered fast (closes 60% of the gap per frame) and eased out (20% per frame) |
| Ultimates (4 timed from captures) | 3.4-6.5 s total. Anticipation to first flash 0.9-2.5 s (Genshin 93-109 f). Flash lasts 1-4 frames. Final hold 0.23-0.8 s |

Our conventions [proposed, `MOVESET.md` 0.1-0.3]:

- **Frames:** drawings are authored at 30 fps, so most hold 2 f. Smears and flashes hold 1 f;
  contact, coil and hold poses 3-8 f. Add frames before or after key poses, never between
  them. No interpolated in-betweens.
- **Hitstop:** light hits 2-3 f, heavy 4-8 f. The lab caps a single hitstop at 14 f
  (`src/lab/data/tuning.json` `maxHitstop`). Hold the contact drawing during the freeze
  instead of drifting at 1% speed. The victim shakes 1 px every 2 f.
- **Tables** are written as whiff timing, and hitstop is inserted on a hit.
- **Chaining:** attacks buffer 12 f, and the string resets after 45 f with no attack. Each
  hit's first wind-up drawing is keyed from the previous hit's last follow-through, so a
  chained string never pops a pose.
- **Worked example (Rosace's string):** hits start at f0/15/32/64/98 and land at 9, 23,
  40/45/54, 74/82 and 128/152. She can dash at f148 (2.47 s) and the clip ends at f192
  (3.2 s). That sits inside the gcsim range.
- **Ultimate template:** a cut-in bust on the same pixel grid, at about 3x the sprite's head
  size. The stage dims 100 > 60 > 35 > 25% over 4 f. Impact frames are held two-tone palette
  swaps.
  - Rosace: first hit at f95 (1.58 s), total freeze 22 f, control back at f209, effects end
    at f270.
  - Hold the cut-in at least 40 f so the face shows. The lab default `cutinTicks` is 54;
    Rosace's R still has 24 f [open].
- **Camera:** no non-integer zoom (it shimmers). The runtime's integer zoom step (3x to 4x)
  is allowed. Shake is whole-pixel translation only, at most 4 px, sized by trauma squared.
  Pans are at most 8 px per frame.
- **Secondary motion:** hand-key cloth and hair, no physics sim. Lag behind the body, in
  drawings: veil, side locks, charms and sleeves 1; tabard and hair tail 2; stole 2-3. Each
  settles in 2-4 drawings. One lead flag per move flares; everything else stays within 2 px of
  its rest shape. On contact drawings, cloth sweeps to the side the blade came from.

**Enemy and boss timing** [no sourced numbers]. `RESEARCH.md` 2.x measured player strings,
hitstop, dashes and ultimates only. Nothing is sourced for enemy wind-ups, telegraph length,
punish windows, recovery, boss hitstop on the player, or whether tall characters should move
slower. Source them the same way (frame counts from captures or frame-data sites, tagged by
source strength) before tuning a boss. What exists to design against:

| Number | Value | Status |
|---|---|---|
| Player dash i-frames / perfect-dash window | f3-18 (16 f) / f3-10 | proposed, `MOVESET.md` dash |
| Player dash cooldown; chain within 40 is followed by | 22 / 54 ticks | proven as coded, `tuning.json` |
| Player invulnerability after a hit | 70 ticks | proven as coded, `tuning.json` `hurtInvuln` |
| Lab turret: telegraph, fire interval | 44, 118 ticks | our tuning, not sourced (`tuning.json` `turret`) |
| Lab turret: stagger poise, stagger, stagger immunity | 55, 40, 90 ticks | our tuning, not sourced |
| ZZZ perfect-dodge window | 8-10 f claimed | weak source (`RESEARCH.md`) |

### 3.14 Motion generation, QC and retime parameters

**Kimodo and GEM-X facts** [proven, `tools/motion-ai/SETUP.md`]:

| Item | Value |
|---|---|
| Output | BVH, SOMA 77 joints under a `Root` wrapper (78 bones). Centimetres, Y-up, faces +Z, 30 fps |
| Joints that actually move | Kimodo 27 (no fingers). GEM-X 64 (finger motion unreliable) |
| Neutral body | Hips 1.005 m up, 1.76 m lowest joint to head tip |
| GEM-X scaling | Hips path × 1.005 / filmed hip height (feet sank 10 cm without it) |
| Blender import | `import_anim.bvh(global_scale=0.01, rotate_mode="NATIVE", axis_forward="-Z", axis_up="Y")` |
| Kimodo accuracy | Key poses hit within 1-4 cm; a 5.5 m floor path within 1.6 cm mean |
| Kimodo speed | 3 x 5 s samples in 5.6 s on a free GPU (1.2 GB). If the GPU is busy, use `--device cpu` (about 1 min per clip) |
| Text encoder | Runs on CPU by default: 16 s to load, then about 1 s per prompt |
| GEM-X cost | 96 frames in 34 s, 7.7 GB of GPU memory peak. Needs the local LLM server idle |
| Constraint frames | 0-based and below the frame count. Past the end, the GPU fails with a "device-side assert" |

**Our key-pose layer** [proven, `rosace_keys.py`, `rosace_moves.py`]:

- Poses are written in her frame: root (hip height 0.97 m standing), yaw, lean, twist, wrist
  targets, ankle targets (standing ankle height 0.062 m) and knee targets.
- IK uses Adam on axis-angle rotations. It reports the residual per target.
- Two-handed grip spacing is 0.44 m. The glaive proxy is 2.3 m (1.35 H on the 1.76 m body).
- Every clip gets a still pre-roll of 12 frames and a tail of 14.
- **Tempos:**
  - **study:** MOVESET frame N maps to Kimodo frame N (2x slower than the game), which gives
    the model room.
  - **game:** frame N maps to N/2.
- **Modes:**
  - **full:** every joint pinned, with post-processing. Keys land within about 0.5 cm, but
    the snap makes one-frame pops.
  - **soft:** full without the post-process. No pops, but keys drift about 7 cm.
  - **ee:** wrists, ankles and hips pinned.
  - **text** and **textee:** a text prompt plus the opening stance, or plus the ee keys.
- **Video rekey** (`capture_segments.py`): keys are frames where both wrists slow to a local
  speed minimum. x1.0 keeps the captured timing; x0.6 shrinks every gap between keys to 60%.

**What the first batch showed** [proven, `review/motion/previews/*/summary.json`, 2026-09-29]:

- The median QC score (lower is better) was 39.3 for study tempo (141 clips) and 109.4 for
  game tempo (63 clips). Generate at study tempo and compress in our own retime step.
- `full` mode had the most pops (Q game-full: 14-17 pops).
- `soft` drifted off its keys: dash soft averaged 17 cm key error against about 7 cm for
  `ee`.
- A "spins" prompt gives a sharp twist of at most 156° of hip turn, not a spin.

**QC thresholds** (`motion_qc.py`) [proven as implemented]:

| Metric | Rule |
|---|---|
| Planted foot | Within 2.5 cm of its lowest height and moving under 20 cm/s vertically |
| Foot slide while planted | Clean mocap is about 1-4 cm/s mean |
| Jitter (distance from a cubic 7-frame Savitzky-Golay fit) | Clean under 0.3 cm; buzzing over 0.6 cm |
| Pop | A joint's per-frame speed over 2.5x both neighbours and over 6 cm/frame |
| Wrist | Over 80° between forearm and hand reads as a broken wrist |
| Two-handed grip band | Wrists 0.15-0.85 m apart |

**Ranking score** (`review_batch.py`; it only sorts, and a person makes the final call from
the sheets):

```
score = foot slide mean (cm/s) + 5·jitter (cm) + 3·pops + key error mean + path error mean
      + 0.3·max(0, wrist p95 − 60°) + intent penalty
```

The intent penalty adds 20 if a two-handed move keeps both hands on the haft for under half
the clip. It adds 20 if a spin turns under 270° (dash) or 120° (N5).

**Scale convention for non-human-sized characters** [proposed]:

- Kimodo's body is 1.76 m and every QC threshold above is absolute (2.5 cm plant, 6 cm/frame pop,
  0.3/0.6 cm jitter, 0.15-0.85 m grip band, 3 cm IK residual). So **generate and QC at human
  scale**, then multiply root translation and positions by s = H_m / 1.76 at retarget. Bone
  rotations don't change.
- Write key poses and prop proxies in human-scale metres: a weapon of r × H is a proxy of
  r × 1.76 m, and grip spacing is the character's real spacing ÷ s. Rosace: proxy 2.3 m, grips
  0.44 m apart (`rosace_moves.py`). Note `rosace_moves.py` also fixes `PX = H/96` (the 96 px
  era).
- A 2.8 m character moves like a scaled human under this rule; whether a big body should be
  retimed slower is open (3.13).

**Retime** [proposed, `MODELS.md` "How it fits"]:

- Sample the AI motion only at the MOVESET's drawing frames (one 30 fps AI frame = one 2 f
  slot).
- Add holds, snap into contact, overshoot the follow-through and rebound.
- Push the line of action.
- The AI gives candidate key poses and breakdowns, never the in-betweens.

**Retarget** [in progress]: the Retarget 5.2.0 extension binds a clip to the VRM headlessly
(`retarget_smoke.py`). Quirks found:

- The selected rig follows the active one.
- `current_m` must be set before `execute()`.
- The hips don't follow the source's hip height by default.
- The source rig gets rescaled (about 0.91).

The Retarget extension route stalled there. The route in use is our own direct mapping
(`tools/motion-ai/blender_apply.py`, `bone_map_vrm.json`) [proven 2026-09-29, `RETIME.md`]: each
mapped `J_Bip_*` bone copies its SOMA joint's rotation from rest, hips height scales by leg
length (0.919 on Rosace), and limb directions match the source within 3-6° mean, 10-17° worst.

**Round 2: hand-posed hero keys, AI in-betweens, spring cloth** [proven on N1 and N5,
2026-09-29; blind critique of `review/motion/r2/round-1/`: 6.0-6.2, below]. Round 1's critics kept the AI
only "as a blocking and in-between layer": retimed AI scored 4.5-5.5 and lost to the crude
hand-keyed spike, because the AI's poses are tame (upright, narrow stance, no twist) and pushes
of 1.15-1.4 barely changed them. What round 2 does (`RETIME.md` "Round 2" has the commands):

- **Hero keys are pose-library JSONs on Rosace's rig** (`art/rosace/poses/motion/`): N1 coil,
  scoop, contact, follow-through; N5 coil, release, contact, kneel. They're authored with
  `hero_stills.py`, which renders 144 px sprites with `rig_measure.py` numbers under each
  (about 5 s for 8 poses).
- **Layering** (`hero_layer.py`, `blender_apply.py --hero SHEET`). The timing sheet's `hero`
  section gives each retime key a pose, `carry` (reuse another key's offset), `mix` (weighted) or
  nothing. Body bones (hips, spine, neck, head) are the AI pose times a per-key offset
  (AI(k)^-1 · hero(k)), slerped on the retime's own eased progress. At a hero key the rig is
  exactly the authored pose; in between it keeps the AI's weight shifts.
- **The weapon, arms and IK poles are interpolated key to key, not layered.** They sit in the
  upper chest's frame. Layered on the AI's noisy wrists, the haft pointed at the camera and the
  free hand hit her face.
- **Feet:** `plants` lock a foot on the spot a hero key gives it for a frame span, anchored in
  world space against in-place root motion. Between two different spots the foot steps (eased,
  8 cm lift); on the same spot it pivots.
- **Spring cloth:** each chain bone's tip is a damped spring toward that drawing's static drape,
  stepped at 60 fps with inertia and a length limit. The drape is blended from the hero keys'
  `drape` specs. Omega (rad/frame) and zeta: veil and sidelocks 0.70/0.50, sleeves 0.55/0.40,
  tabard and hair back 0.36, hair tail 0.26, stoles 0.22. A held drawing gets a cloth-only
  redraw every 2 f while any chain tip still moves 0.75 px or more.
- **Amplitude:** timing-sheet pushes are 1.6-2.0 on legs, spine and root at the coil and contact
  keys, with 20-30° of lean into contact. The hero keys then override those keys outright.
- **Speed:** N1 renders in 18 s (19 images) and N5 in 42 s (52 images).

Measured, round 1 retimed → round 2 (spike in brackets). From `r2_report.py`, in
`review/motion/r2/round-1/_metrics.json`:

| Number | N1 | N5 |
|---|---|---|
| Entry ratio: pixel change at the first strike drawing ÷ the last step before it. Round 1's critics measured it this way; it reproduces their spike 5.2-5.4 | 1.24 → **5.8** (5.2) | 1.12 → **5.4** (5.2) |
| The same, counting only body-drawing steps | 1.24 → 5.8 | 1.12 → **1.5** |
| Mean strike ÷ mean anticipation step (RGBA) | 1.22 → 1.71 (1.72) | 0.90 → 1.10 (1.72) |
| Horizontal span at contact | 0.79 → **1.72 H** (1.48) | 1.38 → **1.91 H** (1.48) |
| Stance, coil / contact (SW = 0.336 m outer shoulder width) | 1.53 / 1.72 → 2.1 / 3.5 SW | 1.98 / 2.04 → 2.4 / 3.4 SW |
| Hips height ÷ rest, coil / contact | 0.82 / 0.89 → 0.77 / 0.68 | 0.67 / 0.82 → 0.62 / 0.67 |
| Torso turn from her facing at the coil; largest hip-shoulder separation | 6°; 9° → **85°; 50°** | 164°; 50° → 114° (wound 246° right); **89°** |
| Lean into contact | -3.5° → **29.6°** | 15.8° → **22.2°** |
| Planted-foot drift. Round 1 = inside the retime's contact spans, where its locks re-plant | 19.5 → **0.0 cm** | 40.6 → **0.0 cm** |
| Hand to shaft centre line, worst gripping hand | 2.7 → 2.3 cm | 3.1 → 0.6 cm |
| Cloth tip travel on held drawings (largest chain) | 0 → 16-31 px | 0 → 7-58 px; A3 coil 58, C1 contact 48 |
| Cloth lag, median frames to half-way after a drawing change (round 1 had none) | veil, sides, sleeves, hair 3; tabard 4; stoles 1 | veil, sides, sleeves 2-3; tabard 4; hair 5; stoles 1 |

- The entry ratio clears 3x only because the step before each strike is small. N1's A3 is now
  the held coil (same body, only the cloth moving), and N5's last step is a cloth-only redraw
  on the release hold.
- RGBA change saturates: any pose change reshades almost the whole body, so every body drawing
  costs 4,500-7,300 px however far it moves. That's why the mean-based ratios stay under 2.
  N5's release is a real body drawing (the hips turn 32°), so N5's body-only ratio is 1.5.
- Contact stances run past the requested 1.5-2 SW (3.4-3.5 SW, or 0.63 H between the feet),
  because the lunges were matched to refs 09 and 10.
- N5's coil is wound to the right like the AI's (pelvis -180°, chest -240°, which reads as back
  three-quarters to the camera). Wound left, the deltas slerped the in-betweens the wrong way
  round and the sweep passed behind her, hidden from the camera.
- Neither route draws smears yet, so N5's S1 and S2 foreshorten the haft.
- The stoles measure a 1-frame lag, not the 2-3 drawings `DESIGN.md` 8 asks. Their tips are free
  and don't collide, so when the anchor moves the length limit drags them along at once. Open.

**Round 2's critique** (blind, `review/motion/r2/round-1/`): round 2 scored 6.0-6.2 against the spike's
4.5-5.0 (refs = 9). The critics asked for six fixes: slower spacing into the coil, a flat N5 sweep,
diagonal coils, clean N5 in-betweens, smear drawings, and lagging stoles.

**Round 3: the six fixes** [proven on N1 and N5, 2026-09-29; blind critique of
`review/motion/r3/round-1/`: N5 6.8, N1 6.4-6.6, against round 2's 5.8-6.0 and the spike's 4.0-4.6]. `RETIME.md` "Round 3" has the commands. What changed:

- **Absolute blends for spacing.** A sheet key can be `blend: [[key, w], ...]`: an exact mix of other
  keys' whole poses, ignoring the AI's own in-between. N1: A1 = 70% of the way from the stance to
  the coil, A2 = the coil, A3 = the held coil (same body, cloth settling). N5: A1 = 55%, A2 = 88%,
  A3 = the coil. N5's strike: S1, S2, S3 = 12%, 38%, 72% of the way from A4 to contact.
- **The glaive in world.** A key's `glaive` can be given in her ground frame: an explicit grip and
  direction, or yaw / pitch / grip angle / radius / height around her hips, with `edge: "lead"` and
  `like: <key>` (hands and elbow poles copied from that key, turned by the yaw difference).
  Round 2 blended the glaive in the chest's frame. Through N5's ~200° chest twist that lifted the
  blade over her head. N5's S1-S3 are now 10%, 36% and 70% of a flat 220° sweep, from behind her
  round her camera side to the front. N1's A1 and N5's A1/A2 are world keys too: the yank lies
  along the screen, and the back-arc rises behind her.
- **Coils** (`n1_coil_r3`, `n5_coil_r3`; written by `review/motion/r3/_authoring/author_r3_poses.py`
  from pelvis-frame parameters):
  - N1 now winds left, a backhand coil, so her back turns to the camera.
  - N5 winds right like the AI: pelvis -150°, chest about -205°.
  - Both put the hips over the front knee with a long, straight rear leg, and knee poles along the
    toes and pushed out.
  - The kneel (`n5_kneel_r3`) is a three-quarter genuflection. Her torso is upright and open to the
    camera, the glaive stands upright in front of her and clear of her face, and her head is bowed.
- **Tracked smears** (`smear.py`, a post step that `run_pixel.py` runs when a sheet has a `smear`
  section). This is the spike's method on the Rosace route:
  1. `blender_apply.py` records every image's blade: butt, tip, blade base, a haft point, hips,
     head and joints.
  2. A smear drawing's path runs from the `from` drawing's blade to its own, plus `lead` of the way
     to the next drawing.
  3. Along the path, a haft point travels round her hips in cylinder coordinates, and the blade
     turns round that point. The yaw goes the way `turn` says, so the tip traces an arc.
  4. The path is sampled 64 times, projected with the render camera and filled in 12 lanes from
     blade base to tip.
  5. Colours: an A5 edge on the outer rim, A3 over A2 in the body, and an A1 tail tapering to a
     point.
  6. Each pixel is depth-tested against the body's depth pass. The glaive's own pixels never hide
     the smear, because the smear is the blade drawn bent.
  7. `ring: true` also draws the rest of the tip's circle, dimmer. That is MOVESET's "whole
     ellipse" on S2.
  8. The body-only images are kept as `sprite_####_body.png`.
- **Stoles.** A sheet can set `cloth_lag` (frames of delay on a chain's drape shape) and `cloth_dyn`
  (per-chain omega and zeta). The stoles use 3 f of delay and 0.42 / 0.40.
- **Model.** Everything renders on `work/rosace_snapshot_r3_0529.blend`. That is a read-only copy of
  the live file as saved at 04:50, with small face and haft edits since round 2. Round 2 was
  re-rendered on it unchanged (`n1_r2m`, `n5_r2m`), so the blind set compares motion, not model
  edits.

The next table gives the measured numbers: round 2 re-rendered on the round-3 model, then round 3,
then the spike in brackets. They come from `r3_report.py`, in `review/motion/r3/round-1/_metrics.json`.
"Shipped" means the frames as rendered, smears included.

| Number | N1 | N5 |
|---|---|---|
| Phase ratio, RGBA, body drawings: mean strike change ÷ mean anticipation step (shipped) | 1.71 → **1.89** (1.72) | 1.10 → **1.15** (1.72) |
| The same on the body-only frames (smears removed) | 1.71 → 1.51 | 1.10 → 0.92 |
| Entry ratio, body steps: first strike drawing ÷ the last body step before it | 5.8 → **11.2** | 1.54 → 1.14 |
| Spacing ratio: mean on-screen travel of the joints and the glaive per drawing, strike ÷ anticipation | 2.51 → 1.94 | 0.78 → 0.96 |
| The same on head, hips-ground, tip and butt (the anchors the spike also records) | 2.2 → 2.2 (**3.67**) | 0.79 → 0.91 (3.67) |
| Span at contact; widest strike drawing | 1.72 → 1.72 H; **2.21 H** with S1's smear | 1.90 → 1.92 H; **2.94 H** with S2's ellipse |
| Line of action at the coil: facing frame / pelvis frame; chest to camera (180 = back to it) | 7.5° / -0.7°; 25° → **33.9° / 36.7°; 142°** | 7.4° / 21.8°; 174° → 3.3° / **43.9°; 150°** |
| Head at the coil (+ = looking down) | -1° → 58° | -11° → 45° |
| N5 sweep, A4 to S3: glaive pitch; blade height | r2: 0°, then **18-24°** with the blade over her head at S1-S3 (0.78-1.09 H) → r3: **0-2°**, blade 0.35-0.52 H, between her posed knee (0.17-0.19 H) and upper chest (0.52-0.53 H), never over her head | |
| Planted-foot drift; worst grip (hand to the haft's centre line) | 0.0 cm; 0.25 cm | 0.0 cm; 0.0 cm |
| Stole lag, frames to half-way: on screen / in shape (tip relative to its root) | 2-3 / 11-12 → 1 / **6-7** | 3 / 13 → 2 / **4** |
| Veil / tabard / hair tail, shape (round 3) | 3 / 6 / 13 | 4 / 5 / 13 |
| Largest cloth travel on a held drawing | 36 → 35 px | 59 → 61 px |

- **The ≥ 3 phase-ratio target isn't met, and on this metric it can't be without breaking the
  spacing.**
  - RGBA change saturates. Every body drawing changes 5,000-8,500 px whether it moves 7% or
    100%. Measured: N1's A2 → A3 step, 7% of the coil's travel, changed 5,264 px in an earlier
    render.
  - So a real slow-in over 2-3 drawings raises the anticipation mean. Only a hold (N1's A3: 776 px)
    brings it down.
  - The spike itself measures 1.72.
- **Spacing is the honest measure, and it points at the move design.** For the per-drawing mean to
  reach 3, the strike has to travel 2 × (N1) or 3 × (N5) as far as the whole wind-up. Both
  wind-ups carry the glaive from upright or in front to fully behind her, which is about as far as
  the strike carries it back. The spike gets 3.6 from 9 anticipation drawings on ones, the last
  three nearly still (1-1.2 px), then one 334 px tip step.
  - Next lever: a smaller wind-up or a longer strike path. For example, the sweep going 360° or
    more, which `MOVESET`'s "back half / whole ellipse" hints at.
- Smears add 270 px (N5 S1, small on purpose), 1,011 px (S3), 2,010 px (N1 S1) and 2,319 px (S2
  with its ellipse). Only 4-111 px per drawing are hidden behind her.
- The stoles' shape used to take 11-13 f to get half-way, which reads as limp rather than trailing.
  Now it lands at 4-7 f (2-3.5 drawings), behind the veil (3-4 f), in `DESIGN.md` 8's order. The
  on-screen measure stays at 1-2 f, because the root rides the body.

**Round 3's critique** (blind, `review/motion/r3/round-1/`): N5 6.8, N1 6.4-6.6 (round 2 5.8-6.0, spike
4.0-4.6; refs = 9). Accepted: the diagonal back-three-quarter coils, A1's yank along the screen, A2's back-arc, a
flat world-plane sweep never over her head. Asked for:
- a slow-in you can see: a small A1, the bulk on A2, A3 a 1-2 px sink;
- a J-crescent for N1's S1 (tail on the floor, belly under her feet, curved thick head, bent blade) instead of a
  floor line plus a vertical bar;
- N1's C1 as the high-in-front end of the scoop (no horizontal thrust that pops vertical at F1);
- N5's ellipse with mass (dim thin back half, thick front tapering to a bright head, no solid glaive inside);
- the body turning inside the spin;
- C1 as a follow-through past the target that settles inside the hold;
- stoles visibly trailing;
- an open, symmetrical kneel;
- a progressive N1 recovery.

**Round 3b: the round-3 critics' fixes** [proven on N1 and N5, 2026-09-29; blind set `review/motion/r3/round-2/`:
6.6 on both moves, round 2 5.8-6.0, spike 4.4-4.5]. `RETIME.md` "Round 3b" has the commands and fields. The model is a fresh read-only copy of
the live file (`work/rosace_snapshot_r3r2_0620.blend`, byte-identical to round 3's, sha256 `0fbbf8e3...`), so
the `n1_r2m` / `n5_r2m` renders still stand for the blind set.

- **Spacing.** Both A1s are 20% of the way (a weight drop), with the feet planted on their idle spots
  (`plants` can now name any key). A2 is the coil. A3 is a 1.3 cm (1 px) `sink` with the glaive held still in
  world. N5's A2 back-arc is 2°. N5's A4 is a smaller release (25° of hips, round 3: 38°) with the glaive held
  where the coil left it.
- **N1's arc.** C1 (`n1_contact_r3b`) is the high end of the scoop: tip 1.40 H up, glaive at 33° toward
  screen-right, line of action 32°. F1 is 70/30 C1 → F2, so the glaive goes 33° → about 70° → back over the
  shoulder, an even arc. R1 is 55% of F2 and R2 18% of F2, and R3 is idle: a settle that slows into idle.
- **N5's spin.** S2 is a hand-posed mid-spin (`n5_spin_r3b`): pelvis -70°, chest to the camera (6°). S1 blends
  A4 → S2 (65%) and S3 blends S2 → C1 (50%), so the body turns through the sweep. The world glaive sweeps
  170° → 62° (+252°) at 30 / 62 / 86%. C1 (`n5_contact_r3b`) carries the glaive 32° past the target line, arms
  across, sleeves and tabard flung to the trailing side. A new C1b drawing (f33 ×5) settles back to 38° and
  sinks 1 cm.
- **Kneel** (`n5_kneel_r3b`): both knees down and apart, pelvis and torso square to the camera, upright. The
  glaive stands at her right side at arm's length (0.58 m, about 44 px on screen from her face). The left arm
  opens out to mirror it, and her head is bowed.
- **Smears, v2** (`smear_v2.py`; the sheet's `smear._v: 2`). They follow the same tracked path. What's new:
  - A band with a real width: J bands are offset across the path and lifted off the floor; flat bands run from
    the tip to the blade base, lowered by `h`.
  - A thick head tapering to a 1 px tail: (1 - age)^1.3, about 0.39 H at the head, ref 10's scale.
  - An A5 rim, then A4, A3 and A2 across the band. The back half is one step dimmer.
  - 4x rasterising with coverage downsampling, so the edges step cleanly.
  - On a `hide_glaive` drawing, the glaive and stoles are left out of the render and a bent glaive is drawn
    from the hands into the smear's head.
  - Per move:
    - N1 S1 is a J on the camera side, with a `reach_dip` so the belly runs along the floor in front of her
      feet (MOVESET: 240 px × 168 px at 96 px, i.e. 2.5 H × 1.75 H; drawn 2.29 H wide).
    - N5 S1 is the back half of the ellipse. S2 is the whole ellipse (2.99 H), glaive hidden. S3 is the bright
      leading crescent.
    - C1 and C1b keep the swept ellipse, dimmer and thinner. MOVESET's N5 table runs the main arc f27-37,
      before the glass ring forms at f38. It's the smear only: no leading, cells or ring.
- **Stoles.** They're the glaive's ribbons (`DESIGN.md` 7: "the weapon's built-in motion trail"), so their root
  rides a glaive that moves 100-200 px per drawing. `cloth_world` pins 60% of their spring target to where the
  lagged (4 f) drape hung in space, and zeta 0.3 gives one overshoot.
- **Cloth.** Blend keys now blend their sources' drape specs. Before, they fell back to a windless, neutral drape.
  N5's A3 hold keeps winding up (`hold_build`: wind 1.0 → 1.7x). The cloth floor-clamps.

The next table compares round 2 re-rendered, round 3 and this round, with the spike in brackets. From
`r3_report.py --new r3b` → `review/motion/r3/round-2/_metrics.json`, which is closed to critics.

| Number | N1 | N5 |
|---|---|---|
| **Phase ratio, body drawings, shipped** (mean strike ÷ mean anticipation step; cloth-only redraws excluded) | 1.71 → 1.89 → **3.37** (1.72) | 1.10 → 1.15 → **2.58** (1.72) |
| The same on the body-only images (smears and bent glaive removed) | 1.71 → 1.51 → 1.23 | 1.10 → 0.92 → 1.05 |
| Anticipation / strike steps, shipped RGBA px | A 4,954 / 7,654 / 1,963; S 16,190 / 16,508 | A 6,767 / 7,968 / 3,524 / 3,804; S 9,833 / 16,283 / 18,191 / 12,577 |
| Entry ratio, body steps, shipped (body-only) | 5.8 → 11.2 → **8.25** (2.95) | 1.54 → 1.14 → **2.58** (1.71) |
| Spacing ratio, joints and glaive / tip only | 2.51 → 1.94 → 2.01 / 2.33 (tip 3.62) | 0.78 → 0.96 → 1.30 / 1.33 (3.62) |
| Span at contact (C1 image); widest strike drawing | 1.72 → 1.72 → **1.70 H**; 2.31 H (S1's J) | 1.90 → 1.92 → **3.08 H** with the fading ellipse, **1.79 H** body and glaive alone; S2 2.99 H |
| N5 sweep A4 → S3 (+C1, C1b): glaive pitch; blade height | | **2-3°**; 0.41-0.54 H, between her knee (0.17-0.25 H) and upper chest (0.51-0.56 H); never over her head, haft never over her face |
| Line of action at the coil: facing / pelvis frame; chest to camera; head down | **34° / 37°**; 142°; 58° | 3° / **44°**; 150°; 45° |
| Planted-foot drift; worst grip | **0.0 cm**; 2.4 cm | **0.0 cm**; 0.04 cm |
| Stole streaming: median frames the tail points back along the glaive's move (within 60°) after a move of 6 px or more | **4 / 2 f**; A2 5, S1 4, C1 5, F2 8 | **5 / 6 f**; S2 10, S3 9, F1 12, F2 12 |
| Stole lag, frames to half-way: on screen / in shape | 1 / 12-13 | 1 / 8 |
| Cloth-only redraws: count; mean px changed | 8; 1,597 → 1,232 → **1,123** | 37; 1,025 → 1,168 → 1,047 |

- **N1 clears the phase ratio (3.37); N5 doesn't (2.58).** Both reach it only on the shipped frames. On the
  body-only images the ratio stays at 1.0-1.2, because every whole-body change repaints 4,000-8,000 px however
  far she moves.
- **What's left on N5 is the move design, not the retime.** MOVESET gives N5 four wind-up drawings:
  - A1 (the yank) and A2 (the coil) cost 6.8k and 8.0k px, the glaive alone about 2k of each.
  - A 1 px sink still repaints 2-3.5k px.
  - To reach 3, the strike mean would have to be 16.3k (now 14.2k), or the wind-up would lose a drawing.
  - The critics asked for both slow-in drawings, so they stay.
- **Spacing ratios are unchanged in kind.** N1 is 2.0-2.3 and N5 1.3. N5's A1 yank moves the tip 315 px on
  screen, the largest step in the move.
- The stoles' on-screen "frames to half-way" stays at 1 f and can't grow: the tail is 26 px long and its root
  jumps 100-200 px. Streaming, where the tail points back along the move, is the visible measure.
- N1's cloth on holds is still below round 2's (1.12k against 1.60k px per cloth redraw). The gentler recovery
  excites the springs less; underdamping hair, sleeves and tabard (zeta 0.26-0.28) added about 90 px.

**Round 3b's critique** (blind, `review/motion/r3/round-2/`): 6.6 from both critics, on both moves (round 2 5.8-6.0,
spike 4.4-4.5; refs = 9). Both called it the first version that reads as grand at gameplay size. Accepted: N1's
diagonal coil and its C1 (the best contact in any round), N5's flat sweep with the body turning through it, the
depth-correct smears, the open kneel. Asked for:
- N1's S1 smear as one tapered J-crescent. It read as an L-shaped hockey stick: a hard corner, a stair-stepped
  vertical right edge, four flat stripe bands, a 56 px head (MOVESET: 12 px at 96, so 18 at 144) and a belly under the
  ground line. Wanted: a thin A5 leading edge, 2-3 values fading toward the tail, a pointed head, an inner speed line,
  a translucent body so hers reads through.
- N1's S1 body as a diagonal between the coil and the contact, not an upright knees-in squat.
- N1's A1 as a small dip toward the coil. Round 3b's A1 tilted the glaive up overhead, then A2 swung it about 120°
  down in one drawing.
- N5's ellipse without flicker (whole on S2, gone on S3, whole on C1), decaying over 2-3 drawings instead of a static
  hoop for about 7 ticks. S2 as a curved crescent instead of a straight-cut trapezoid swallowing her legs, and S3's
  head attached to the blade tip.
- N5's C1b -> F1 without the jump from flat to about 40° raised: carry the glaive flat first, add an in-between into
  the kneel, and a breakdown for the rise from kneel to stand.
- N5's wind-up without two pops (idle -> yank, yank -> full coil), and its coil leaning forward over the front knee
  toward the target. It leaned back over the rear knee with the front leg locked straight.
- N1's F1/F2 without the sleeve and veil over her face. The hit still has no impact frame (flash, furrow, dust): that
  is VFX, outside this lane.

**Round 3c: the round-3b critics' fixes** [proven on N1 and N5, 2026-09-29; blind set `review/motion/r3/round-3/`,
critique pending]. `RETIME.md` "Round 3c" has the commands and fields. The model is a fresh read-only copy of the live
file (`work/rosace_snapshot_r3r3_0714.blend`, byte-identical to rounds 3 and 3b, sha256 `0fbbf8e3...`), so `n1_r2m`
and `n5_r2m` still stand for the blind set. The poses are written by `review/motion/r3/_authoring/author_r3c_poses.py`
and the sheets by `make_r3c_sheets.py`.

- **Smears v3** (`smear_v3.py`; the sheet's `smear._v: 3`):
  - The J is one curve through the tracked points. It runs straight along the floor from the tail (A3's tip, behind
    her) to a belly point in front of her feet, then follows a quadratic that leaves the floor tangent to that run and
    rises to C1's tracked tip. The control point sits past the head by `hook` H, so the head curls back: a J with no
    corner. The outer edge is clamped to the ground line.
  - The ellipse is the tip's circle round her hips, from `start_yaw` to the head, at the head's reach and height.
  - The inner edge is a screen-space offset toward the curve's inside. The thickness rises from a 1.5 px point to
    `thick` at `peak` of the length, then falls to a 1 px tail, so it's a crescent. N1's head is 22 px (MOVESET's 18,
    plus the taper); N5's is 12-16 px.
  - Colour runs along the stroke (A4 head, A3, A2, A1 tail) with a 1.2 px A5 leading edge and a 1 px A5 inner speed
    line. Where the body of the band crosses her it's drawn as a 50% checker, so her legs read through.
  - Two 1 px gold slivers sit outside N1's head (MOVESET).
  - `ring` draws a fraction of the circle back from the head (2 px A3 in front, 1 px A2 behind her). `fade` sets
    per-image overrides by frame offset inside a held drawing, and `gone` ends it. `same_as` plus `keep` draw a
    remnant of another drawing's path.
- **N1.**
  - A1 blends 45% into the coil with the glaive tipped back and DOWN to 30° (the hand lowers 0.2 m). A2 is the coil,
    and A3 a 1 px sink.
  - S1 is a hand-posed diagonal (`n1_strike_r3c`): front knee driving over its toes, hips turned toward the target, a
    30° lean.
  - The J (2.22 H wide) is followed on C1 by a remnant: its head half, thinner and one step dimmer, ending at the
    solid blade's tip. It's gone by f11.
  - F1 lets go with the left hand. F2 (`n1_over_r3c`) carries the glaive over her RIGHT shoulder one-handed, the left
    arm open, and the sleeve wind is turned away from her face.
  - Stoles: 6 f of lag, 80% pinned in space.
- **N5.**
  - The wind-up is spread over three drawings: body 30 / 80 / 100% + sink. The glaive tips up out of the ready
    diagonal (70°), then hangs up behind her in a back-arc (36°), then lies flat (MOVESET A1 / A2 / A3).
  - The coil (`n5_coil_r3c`) is a lunge toward the target. The front (left) knee is bent over its toes and the rear
    (right) leg is straight back to the pivot spot. The pelvis faces the feet line (yaw 50), the torso pitches about
    40° over the front knee and twists back 54°, so her back is 164° from the camera and her head is down. Both arms
    reach back to screen-left, and the glaive trails flat at hip height (yaw 210).
  - The spin is drawn in every strike drawing: A4 releases the hips 25°; S1 (`n5_spin1_r3c`) is the left profile
    (pelvis 180); S2 is chest to camera (`n5_spin_r3b`); C1 faces the target. The glaive sweeps 212° flat in world
    (22 / 58 / 86 / 100%).
  - S1 is the back half of the ellipse, dimmed. S2 is the whole ring plus the front crescent. S3 keeps 80% of the
    ring and ends its bright crescent on the solid blade's tip. C1 shows 55% of the ring at f30, then 30%, thinner and
    dimmer, at f32. C1b is a sliver at f33 and gone from f35.
  - After contact, F1 keeps the glaive flat and carries it back round the front at knee-to-hip height while she
    sinks. F2 (a new drawing, f42 ×3) raises it 45° and F3 (f45 ×3) 76° at her right side, with the left hand letting
    go. K1 stands it upright.
  - The kneel (`n5_kneel_r3c`) has the knees 0.50 m apart with each shin straight back under its thigh, and the
    pelvis turned to -35 so the thighs read.
  - R1 (`n5_rise_r3c`) is a half-kneel. R2 is 45% of the way from R1 to standing, and R3 is idle.

The next table compares round 2, round 3b (what the critics just scored) and this round, with the spike in brackets.
From `r3_report.py --new r3c` → `review/motion/r3/round-3/_metrics.json`, which is closed to critics. Screen line of
action = rear ankle → head top against screen vertical, + = toward the target (new in `r3_report.py`).

| Number | N1 | N5 |
|---|---|---|
| **Phase ratio, body drawings, shipped** (mean strike ÷ mean anticipation step; cloth-only redraws excluded) | 1.71 → 3.37 → **2.19** (1.72) | 1.10 → 2.58 → **1.48** (1.72) |
| The same on the body-only images | 1.71 → 1.23 → 1.15 | 1.10 → 1.05 → 0.91 |
| Anticipation / strike steps, shipped RGBA px (round 3c) | A 5,860 / 7,487 / 1,724; S 10,998 / 10,958 | A 6,889 / 7,844 / 7,011 / 3,921; S 8,506 / 9,275 / 10,659 / 9,501 |
| Silhouette-only phase ratio | 1.71 → 4.48 → 2.40 | → 3.28 → 1.60 |
| Entry ratio, body steps, shipped (body-only) | 5.8 → 8.25 → **6.38** (3.31) | 1.54 → 2.58 → 2.17 (1.74) |
| Spacing ratio, joints and glaive / tip only (spike tip 3.62) | 2.51 → 2.01 / 2.33 → 2.32 / **2.91** | 0.78 → 1.30 / 1.33 → 1.33 / 0.99 |
| Span at contact (C1 image); widest strike drawing | 1.72 → 1.70 → **1.70 H**; S1 2.24 H | 1.90 → 3.08 → **3.01 H** with the decaying ring, **1.79 H** body and glaive; S2/S3 2.92-2.94 H |
| Line of action at the coil, screen (facing / pelvis frame) | 12.2° → 37.5° → **37.5°** (same coil) | 14.7° → **1.4°** → **43.0°** (33.0° / 46.3°) |
| Coil: chest to camera; head down | 142°; 58° | 150° → 164°; 45° → 56° |
| N5 sweep A4 → C1b: glaive pitch; blade height | | **2-3°**; 0.38-0.56 H, between the posed knee (0.17-0.32 H) and upper chest (0.53-0.56 H; C1's tip 1 cm over); never over her head, the haft 26-43 px from her face |
| Planted-foot drift; worst grip | **0.0 cm**; 2.4 cm (C1, unchanged) | **0.0 cm**; 1.3 cm |
| Stole streaming, median frames (moves of 6 px or more), A / B | 3 / 2 → **2 / 3** | 5 / 6 → **7 / 7** |
| Largest cloth travel on a held drawing | 38.5 → 35.9 px | 41.1 → 37.5 px |
| Smear pixels per drawing (dithered over her; hidden behind her) | S1 4,940 (38; 37); C1 remnant 1,812 | S1 2,275; S2 5,612 (295; 39); S3 4,541 (210; 68); C1 2,276 → 923; C1b 125 |

- **The ≥ 3 phase ratio is not met on either move, and round 3c moved it down on purpose.** Round 3b reached 3.37 on
  N1 only through smear area: a 56 px slab adds about 10k px to each strike step. The critics rejected that slab and
  asked for MOVESET's 18 px crescent, dithered where it crosses her. A crescent that size adds about 5k px. On the
  body-only images every drawing still costs 4-8k px whatever it does, so the RGBA ratio sits at 0.9-1.2 there.
  Keep reporting it beside the spacing and silhouette ratios, but don't tune toward it.
- **N5's spread wind-up raises the anticipation mean.** Round 3b's A3 was a 1 px sink (3.5k px). Here A3 finishes the
  last 20% of the coil and flattens the glaive (7.0k px), because the critics asked for the move into the coil to
  come over 2-3 drawings. N5's ring also no longer flickers on and off, and flicker was worth pixels: S3 → C1 now
  keeps most of the ring in place.
- **Spacing, the measure that doesn't saturate:** N1's tip ratio rose to 2.91 (spike 3.62), because A1 is now a dip
  and A3 a hold. N5's tip ratio fell to 0.99, because MOVESET's back-arc carries the tip over the top (105 / 208 /
  117 px in A1-A3). As round 3's note says, N5 winds up about as far as it strikes. Only a shorter back-arc or a
  longer sweep changes that.

### 3.15 Runtime contract limits (`dex.sprite/1`) [proven, `RUNTIME-CONTRACT.md`, `src/lab/contracts.ts`]

| Area | Limit |
|---|---|
| Atlas | PNG RGBA 8-bit sRGB, not premultiplied, nearest filtering only. Alpha 128 or more is drawn. At least 2 px gutter between frames. The normal atlas must be the same size as the albedo |
| Normals | r = x right, g = y **down**, b = toward the viewer, mapped −1..1 to 0..255. Flat is (128,128,255). Normal alpha under 128 marks ink (outline and inner lines): no rim, half effect light, flat normal |
| Ink fallback | `shaders.ts` `isInk`: normal alpha < 0.5, **or** max(albedo r,g,b) < 0.07 (a channel of 17 or less, `#111111`). `rosace_post.py` writes normal alpha 255 on everything, outline ring included, so today only the albedo test marks ink. Rosace's OL `#181032` (max channel 50) is **not** ink. An enemy's `#000000` mass **is** ink: no rim, half effect light, flat normal; `#131313` escapes by 2 levels. Unsafe for any dark palette until the exporter writes a real mask [proven, code read 2026-09-29] |
| Shading | `baked` (pipeline art): the key light only nudges, with influence 0.25 |
| Coordinates | Pixels, y down, authored facing right, pivot at the foot anchor, 60 Hz ticks |
| Player clips | `idle run jump apex fall land double_jump dash dash_attack m1_1..m1_4 skill_q ult_r hurt` |
| Turret clips | `base head barrel broken` (`barrel` needs `angles`). Default hurtbox 28 x 58 px (`standin-turret.ts`) |
| Enemy / boss clips | **not designed** (step 12) |
| Player hurtbox | **Not set at 144.** The contract's example is 13 x 82 px and the physics collider is 12 x 44 (`tuning.json`); both predate 144. Proposed: measure it from the shipped idle and record it here |
| Input | Attacks buffer 12 ticks; jump, dash, Q and R buffer 8. `actionHoldTicks` 16 |
| Dash | Cooldown 22 ticks; a chain within 40 is followed by 54 |
| Hits | `maxHitstop` 14. `attackStopGap` 10 px. Shake, zoom and impact on a hitbox fire on contact only |
| Lights | Up to 16 shade sprites, 64 alive. Effect light is capped (`lightCap` 1.35, `lightRoom` 0.6). The rim is at least `rimBoost` 1.45x brighter than the lit colour |
| VFX pools | 256 effects, 2048 particles, 256 per emit. Lifetimes up to 600 ticks. Every `params` key has a validated range |
| Zoom / impact | Zoom is an integer upscale step (1-2 steps). Impact frames last 1-2 ticks and are rate-limited |

### 3.16 Camera and framing for large characters [numbers proven from code; rules proposed]

The game view is 640x360 ("near") or 960x540 ("far") (`renderer.ts` `RESOLUTIONS`). The camera
follows a point 40 px above the player's feet and holds it at 64% of the view height
(`camera.ts`, `tuning.json` camera `anchorY` 0.64, `game.ts`), with a vertical dead zone of
±22 px. The figures below ignore clamping at the world's edges.

| Quantity | Formula | Near 360 | Far 540 |
|---|---|---|---|
| Headroom above the player's floor | 0.64·view_h + 40 | 270 px | 386 px |
| Guaranteed headroom (camera at the edge of its dead zone) | 0.64·view_h + 40 − 22 | 248 px | 364 px |
| Room below her feet | view_h − headroom | 90 px | 154 px |

- A character standing on her floor is fully on screen at near view if its H_box is under
  about 248 px. A 230 px boss is 64% of the view height and fits with 18 px to spare.
- The integer zoom punch crops the view further; with a boss near 248 px, cap it at one step or
  skip it while the boss is on screen [proposed].
- A boss arena camera (framing both fighters, locked bounds, a different anchor) is **not
  designed** [owner: lab engine lane].
- Shake at most 4 px and pans at most 8 px per frame (3.13) apply to every character.

---

## 4. File layout and licensing

### 4.1 Where things go

| Place | Holds | Git |
|---|---|---|
| `docs/character/` | Shared docs: this playbook, `RESEARCH.md`, `RUNTIME-CONTRACT.md`, `MOTION-SOURCES.md` | Public repo |
| `docs/character/<char>/` | Per-character docs: `DESIGN.md`, `MOVESET.md`, `QUALITY-RUBRIC.md`, `CRITIQUE-PARAMS.md`, `REF-BREAKDOWN.md`, `concepts/`. **New characters go here.** Rosace's copies still sit flat in `docs/character/` [to move; other lanes are editing them now] | Public repo |
| `docs/character/prompts/` | Concept, judge, synthesis and lens-critic prompt templates [to create; today they exist only in the scratch `scripts.txt`] | Public repo |
| `tools/pixel-pipeline/`, `tools/motion-ai/` | Our scripts and pinned-download manifests | Public repo |
| `art/<char>/` | `palette.json`, `poses/`, `faces/`, `overrides/`: our own authored data | Public repo |
| `public/lab/character/` | The shipped `dex.sprite/1` package (the path is fixed in the runtime; per-character `public/lab/<char>/` is proposed, step 12) | Public repo |
| `review/` | Refs, A/B sheets, `key.json`, spike output, motion previews, clips, storyboards | Git-ignored (`.gitignore`: "may hold third-party reference images") |
| `D:\Dex\Projects\dex-place-art\<char>\build` | `.blend` build output, renders, inventory, scratch | Outside git |
| `D:\Dex\Projects\dex-place-art\<char>\motion-ai\raw` | Generated and captured BVH, constraints | Outside git |
| `D:\Dex\Inbox\Downloads\dexplace-character` (`DEXPLACE_DOWNLOADS`) | Third-party VRM, GLB, FBX, BVH downloads | Outside git |
| `D:\Dex\Models`, `D:\Dex\Tools`, `D:\Dex\Caches` | Model weights and HF cache, venvs and sources, Blender root, caches | Outside git, D: only |
| `D:\Dex\Temp\pipeline-playbook\` | Workflow journals and extraction notes (the only copy of the critic prompts) | Scratch |

The `.blend` file is build output. The scripts are the model: rebuild rather than hand-edit
the `.blend`.

### 4.2 Licensing rules

- **Base bodies:** use CC0 VRoid samples. HairSample_Female.vrm (VRoid beta sample, VRM 0.0,
  CC0; 119 bones, rest height 1.6683 m) is proven. Seed-san is VRM Public License with a
  required credit line, and its outfit is fused into one mesh, so it's a proportion reference
  only. Pin every download by sha256 in `third_party.json`, and record the licence in the
  source's own words, with a date, in `THIRD_PARTY.md`.
- **Motion risk levels** (`MOTION-SOURCES.md`):
  - low: a clear written licence that covers a public, donation-accepting, non-commercial
    site
  - medium: plausible, but the terms are unread or "non-commercial" meets our donate button
  - high: traced from someone else's game or performance
- **Game footage** captured with GEM-X is a trace of the studio's animation. It stays timing
  study in `review/motion/` and never ships.
- **Motion Actor "Long Weapon" clips** are free to trace but ban profit use. Study only until
  Dex rules on the donation question.
- **Raw motion and model files** (FBX, BVH, VMD, VRM, PMX, and `.blend` files holding
  third-party actions) never go into the repo.
- **Model licences:**
  - Kimodo and GEM-X weights: NVIDIA Open Model License, commercial use OK, outputs are ours.
  - Kimodo's text encoder: Llama 3 licence, accepted by Dex 2026-09-29.
  - Avoid Kimodo-SMPLX (non-commercial) and HY-Motion (its licence bars showing output in the
    EU and UK).
- **Credits file:** list every source whose data we retarget.
- **Blender:** run it only through `blender_env.py`, never Dex's profile or the Blender MCP.

---

## 5. Critique protocol

### 5.1 Lenses and params [proven, in use]

`CRITIQUE-PARAMS.md` has 31 params: 18 Look, 7 Motion, 5 Effects and feel, and the Verdict
(31, the "donation test": would a 3D gacha player screenshot this, share it, or consider
donating?). Stills rounds use five lenses (`scripts.txt`, the Rosace stills script):

| Lens | Params |
|---|---|
| face | 2 face, 3 attractiveness, 4 head and hair |
| body | 5 proportions, 6 arms and hands, 9 posture, 10 posing, 11 stylisation, 12 sex appeal in theme |
| gear | 7 weapon, 8 grip, 13 outfit |
| craft | 14 materials, 15 palette and value, 16 pixel craft, 17 rim |
| overall | 1 first impression, 18 originality, 31 donation test, best height |

Motion (19-25) and effects (26-30) need lenses for the motion rounds [proposed].

**Lens sets by character class** [proposed; only set A has been run]. The params and the
donation test were written for a gacha heroine. For other classes, keep the param numbers and
reword these:

| Set | Class | Changes to the lenses above |
|---|---|---|
| A | Player | As written |
| B | Friendly NPC | 3 attractiveness → "appeal and charm"; 12 sex appeal → "personality reads in the silhouette"; drop 26-28 unless it fights; 31 → "would a player screenshot or remember them" |
| C | Enemy, boss, construct | face lens → **presence**: 2 face → "the head or mask reads as a threat", 3 attractiveness → "menace and awe", 4 head and hair → "head shape distinct from every other enemy" (ref 13's rule); 12 sex appeal → "threat reads in the silhouette"; 13 outfit → "armour and material logic"; 17 rim → enemy rim (3.11); 26 VFX width → **telegraph readability** (can a first-time player see what's coming and where); 31 → "would a player clip and share this fight" |

Every set keeps the rule that the character must be readable against the other side: an enemy
is judged next to the player at the same scale, and the player next to an enemy.

Each critic returns, per param: winner (ours / ref / tie), the concrete gap and the fix. Then
prefersOurs (yes / no / can't choose), a score out of 10 (refs = 9), bestHeight, topFixes and
the donation test in one or two sentences. Never report one overall score without the
per-part breakdown.

### 5.2 A/B sheet rules [proven]

- Every panel is on its native grid, and all panels on a sheet share one **integer** zoom:
  3x is "real size" (640x360 fills 1080p) and 6x is for inspection. Faces get 10x crops.
- **Blind:**
  - Crop out watermarks and labels, and use the same background.
  - Shuffle left and right with a fixed seed (20260929). Record which side is ours in
    `key.json`.
  - Critics open `key.json` only after writing their A/B verdicts.
- Pair like with like: idle with idle, attack with attack, back with the nearest back view.
- **Scale mismatch** [proposed]: when the ref and ours differ by more than about 1.3x in height
  (ref 13's figures are about half a 230 px boss), show both at native size on one integer zoom,
  then a second panel at matched on-screen height (still integer zooms, as close as they get),
  and label each panel's scale. Judge craft on the native panel and design on the matched one.
- Add 1x in-context shots at 640x360 and 960x540.
- **Motion** is judged moving, looping at game speed. Play refs as flipbooks at our timing.
  Use APNG or the lab: the GIF previews ran at 50 fps against 60 fps metadata.
- **Silhouette test:** fill the sprite with one flat colour at 3x. Someone who hasn't seen the
  animation should be able to name each key pose's action and facing.

### 5.3 Pass rule [proven, as coded]

```
losing = every param any critic gave to the ref
prefer = critics whose prefersOurs is not "no"
PASS  when  losing == 0  AND  prefer × 2 >= number of critics
```

One strong dimension never makes up for a weak one. Use at least 3 independent critics (5 for
stills), then Dex's call. Loop at most 6 rounds, with **one** integrator applying fixes
between rounds. The fixer prioritises what the most critics flagged and what most affects
first impression.

Round 1 (2026-09-29): average 4.8, 0 of 5 critics preferred ours, 34 params lost, 2 tied
(originality and head-to-body ratio). Builder self-estimates the same round: 6 and 6.5. Don't
trust builder self-scores.

### 5.4 Running rounds

1. The builder renders the stills and makes the sheets (`round1_sheets.py`).
2. Critics run in parallel, one per lens, each seeing only the sheets.
3. Record the tallies in the rubric's round template, under `review/<char>/round-<n>/`.
4. The integrator fixes the model, materials, poses and scripts, then re-renders.
5. Faces and override layers are rebuilt in the next stills round, not by the model fixer.

Engineering critique loops (the lab) use pass / pass-with-notes / blocking, with up to 3
rounds.

### 5.5 Concept process [proven, ran once]

1. **Research first:** ref breakdown, rubric, timing research, motion sources, and a spike of
   the route with 3 critics.
2. **Three concept agents** write full kit docs against the same refs. Brief them to diverge
   on weapon, palette and silhouette, and put the width floor in the brief: Rosace's three
   converged on the same base, and all three openers sat barely over the floor.
3. **Three independent judges** each return a ranking {concept, score, why}, the best ideas
   to graft, and weaknesses. Record every judge's scores and use the mean or median. Rosace
   means: Liturgy 7.73, Judgment 7.5, Halo 6.77.
4. **Synthesis:** take the top concept as the base and graft ideas that answer the judges'
   named worries. Keep a graft table and a "not taken" list, and leave the concept files
   unchanged.
5. **One critic** returns blocking points backed by measurements, then a revise pass with a
   revision log that shows the "was" values.

### 5.6 Pivot rule [proposed; from Dex's working mode]

- **Spike before committing.** Prove a route end to end on a stand-in before building the real
  thing.
- **Switch methods when a route plateaus.** The code-drawn rig stalled at 3/10, and the spike
  of the 3D route reached 3.5-4 with a stand-in. There is no numeric threshold yet.
- **Proposed trigger:** two consecutive rounds with no gain in the average score, and no drop
  in lost params, on the same lens. When that happens, stop fixing inside the route and spike
  an alternative for that part (for example, a hand-drawn face instead of stamps).

---

## 6. What is Rosace-specific today (refactor list)

Everything below works for Rosace, but a second character needs it parameterised. None of it
has been refactored yet.

1. **Paths:**
   - `art/rosace`, `dex-place-art\rosace\build` and `review/rosace` are hard-coded in:
     - `rosace/common.py`
     - `faces.py`, `overrides.py`, `codes.py`
     - the `round1_sheets.py` and `inventory_imports.py` defaults
   - `motion-ai/raw` is hard-coded in `rosace_moves.py`, `capture_segments.py` and
     `review_batch.py`.
   - Proposed: a `--char` flag or `DEXPLACE_CHAR` env var.
2. **Names in the .blend:** `rosace_rig`, `rosace_height`, `rosace_id`, `rosace_seq` (`body.py`,
   `render.py`, `posing.py`, `glaive.py`, `materials.py`).
3. **Material lists in `rosace_post.py`:**
   - the downsample priorities (gold, edge, glass, haft, hair tip, thong, boot)
   - the DARK set, the HAIR set and `skin`
   - the smoothing and stripe-merge lists
   - Move these into per-material flags in `palette.json`.
4. **Rim tables in `rim.py`** (`RIM_OL`, `RIM_INNER`) name Rosace's codes. Replace them with a
   script that builds the rim LUT from a palette and checks every pair's contrast. Neither the
   LUT builder nor the contrast script exists yet.
5. **Checks:** `rosace_check.py` hard-codes 29 colours and the I0-I2 hair share. Read the limits
   from `palette.json`.
6. **Faces:** the `faces.py` KEY letters map to Rosace's codes. Take the mapping from
   `palette.json` `face_stamp_colors`. There is no reusable "eye template by head size" asset,
   so stamps are re-authored for every character and height.
7. **Body restyle:** the knot heights are HairSample_Female's, and the restyle constants are
   Rosace's. Move them to a per-character restyle file.
8. **Modules that are per character by nature:** `outfit.py`, `hair.py` and `glaive.py`. Keep
   the construction routes (shells, Solidify cloth, design-px props) and write new modules.
9. **Motion:**
   - `rosace_moves.py` has `H = 1.76` and `PX = H/96`, which assumes the 96 px design size.
   - It also hard-codes glaive length 2.3 m and grip spacing 0.44.
   - `review_batch.py` penalties name `dash`, `dash_attack` and `n5`.
   - `motion_preview.py` defaults to a 2.3 m glaive proxy.
10. **Ref tools** need the `review/refs/character/` working directory. `_downscale.py`'s job
    list is hard-coded.
11. **Missing tools:**
    - an H worksheet that re-derives section 3.2 and the VFX px widths for a new H
    - the wedge-symmetry check that `concepts/liturgy.md` cites
    - saved prompt templates for the concept agents, judges and lens critics (today they live
      only in `D:\Dex\Temp\pipeline-playbook\process\scripts.txt`)
12. **Design px unit:** props use k = H/96 even though Rosace ships at 144. This file now calls
    it du = H_m/96 (2.1). The code still says k and "design px"; rename it there too.
13. **Tools outside the repo:** `cmpblend.py` (the step 6 gate) lives only in
    `dex-place-art/rosace/build/scratch/`. Promote it to `tools/pixel-pipeline/`.
14. **Hard-coded class assumptions:** the hair-share rule, the "no black" rules and the rim
    table assume a player-side palette. Put a `class` field (player / npc / enemy / boss) in
    `palette.json` and let `rosace_check.py`, `rim.py` and `rosace_post.py` pick rules from it
    (2.2).
15. **Stale 96 px docs:** `MOVESET.md` and `DESIGN.md` still use H = 96 px for px numbers and hit
    areas. At 144, every px number there scales by 1.5 (numbers in H don't change).

---

## 7. Pitfalls and lessons

Each line gives the mistake, then the fix.

**Design and process**

- We planned at 96 px because one ref was that size, but the finish refs were 137-163 px. →
  Run the height A/B first.
- Docs still say 96 px, and every px width assumes it. → After the height decision, rewrite
  every px number, and check that the VFX widths still fit the view.
- A width was measured as arc length (1.8 H claimed, 1.36 H real). → Measure the hit-box span.
- A 1 px non-hitting "echo arc" was used to fake width, and read as a hairline at 3x. → Width
  comes from filled bodies that hit.
- Critics' eye-measured head sizes disagreed (27-28 px against 23 px). → Measure on the rig.
- Synthesis quoted one judge's scores as "the judges' ranking". → Record all judges and use
  the mean.
- The fixer prompt was cut at 8,000 characters and dropped 2 of 9 blocking items. They came
  back as blocking in the next round. → Pass complete finding lists to the fixer, or split
  them.
- Builders scored their own round 6-6.5 while critics gave 4.8. → Only blind critics count.

**Look**

- A colour-temperature rim on white measured 1.03:1, and the lab's additive rim blew white to
  `#ffffff` and went off-palette. → Rim on the outline pixel through a palette table, and run
  the contrast check first.
- A full-contour cyan rim read as a sticker or helmet. → Convex, lit-side, broken runs only;
  a glint on the head; nothing below the knee.
- The rim was on the review sheet but not in `sprite.png`. → Bake it with `--rim`, and check
  the artefact that ships.
- Dark ramps merged with the outline (1.14:1), and the spike's hair read as black. → Lift the
  dark steps and enforce the hair-share rule.
- In the attack pose the light flip made W2 her most common colour, so she read grey-lavender.
  → Fix the key light per character in camera space.
- A stray skin pixel beside the chest window read as a nipple at 1x. → Mask skin to its
  window (bodice moved from 0.0045 to 0.0065 m off the skin), and check the 1x in-context
  shot.
- A white thong vanished into the trim at 144. → Dex's call was black; A/B close values at
  game size.
- Quantised normals gave rectangular skin banding and 1 px stocking stripes. → Band smoothing
  and stripe merge in post.
- A plain N·H hair spec pooled into one blob. → Angel-ring mode.
- Hair looked mottled. → Proxy hair normals.
- Cast shadows made noisy blocks. → Off by default. Critics want a selective skin-only one
  later.
- Lossy WebP refs inflated palette counts and hid the grid. → Take palette bars only from
  lossless refs.

**Build**

- HEAD_SCALE 1.20 read big-headed. → 1.12.
- SLEEVE_LIP 0.21 read as a shield. → 0.17.
- A knee-high boot ate the stocking. → Boot top at 36% of ankle to knee.
- A 26x3 px stole read as a plank. → 19x2.4.
- An inner-line depth step of 0.03 m merged the tabard into the stocking. → 0.018.
- A hair clump step of 0.004 m made crown noise. → 0.012.
- VRM import leaves MToon outline modifiers and a 180° rotation. → Strip the modifiers and
  bake the rotation into the mesh.
- Re-posing invalidated every hand patch. → `authored_on` plus STALE skipping.

**Motion**

- `full` mode snaps keys into one-frame pops, and `soft` drifts 7-17 cm off its keys. → Use
  `ee` or text + ee, at study tempo.
- Generating at game tempo gave clips 2.8x worse by median QC score. → Generate slow and
  retime ourselves.
- GEM-X smooths sudden changes, so held frames looped into it lag. → Feed it real 30-60 fps
  footage.
- onnxruntime-gpu 1.30 is built for CUDA 13 and silently falls back to CPU. → Pin 1.23.2.
- HF-latest SOMA assets crash GEM-X's pinned code. → Use the submodule's LFS copies.
- If the text-encoder weights load from a plain folder, the Llama 3 chat template is silently
  dropped. → File them in the HF cache under Meta's model id.
- The GPU is shared with a local LLM server, and one Kimodo run stalled for 15 min. → Use
  `--device cpu` when that server is busy.
- Retimed AI poses stayed tame: pushes of 1.15-1.4 left the stance and width almost unchanged.
  → Hand-pose the hero keys on the rig and keep the AI for in-betweens (3.14, round 2).
- Layering hero offsets onto the AI's glaive and arms threw the haft at the camera and the free
  hand at her face: the AI's wrists are noisy. → Interpolate the weapon, arms and IK poles key to
  key in the chest frame; layer only the body.
- A hero coil wound the other way from the AI's (N5: left against the AI's right) made the
  slerped in-betweens turn the wrong way. → Wind hero keys the way the AI does, then push.
- The floor clamp silently tilted N5's kneeling glaive off vertical because the authored butt
  sat 3.5 cm under the floor. → Author props clear of the floor; `hero_stills.py` prints tip and
  butt heights.
- A count of changed RGBA pixels saturates, because any pose change reshades the whole body.
  → Report the entry ratio (first strike ÷ the step before it), a silhouette-only count and the
  mean ratio side by side, with their definitions (`motion_metrics.py`).
- A relative render path resolves against Blender's working folder (round 1 leaked frames to
  `C:\review`). → `blender_apply.py` and `hero_stills.py` assert absolute paths.
- A weapon interpolated in the chest's frame follows the chest. Through N5's ~200° chest twist that
  lifted the blade over her head (18-24° of pitch, blade at 0.78-1.09 H). Blended between an upright
  stance and a trailing coil, it also swung N1's A1 blade forward. → Give sweep and anticipation keys
  a world `glaive`: yaw, pitch and grip round her hips (3.14, round 3).
- A pixel count of changed RGBA saturates at 5,000-8,500 px per body drawing. So a genuine slow-in
  (65% → 93% → 100%) scored worse than a jump plus a hold. → Judge spacing by on-screen joint and
  tip travel (`r3_report.py`), and report the RGBA ratio beside it with the body-only frames.
- The kneel's glaive leaned 16°: its butt was authored 2.4 cm under the floor, and the floor clamp
  tilted it. That's round 2's lesson again. → `hero_stills.py` prints `tip_height_H`; check the butt
  (hand height minus the grip offset) too.
- A toe-direction knee check read nonsense (up to 147° on a straight lunge): the VRoid foot bone
  doesn't point along the toes. → Dropped. Judge knock knees on the render, and use
  `knee_gap_over_ankle_gap` as a hint only.
- A smear interpolated tip-by-tip round the hips drew a straight-edged slab for N1's rising cut. →
  Move a haft point round the hips and turn the blade round that point, so the tip arcs.
- Round 2's key used the same letter order for both moves. → `ab_compose.py --round3` picks, per
  move, an order where no letter means the same clip as in an earlier move.
- The "stoles" hang from the glaive head, so their root moves 100-200 px per drawing. A 26 px tail can't lag
  that on screen, so "frames to half-way" stays at 1 f. → Pin the lagged drape in space (`cloth_world`) and
  measure streaming: the tail pointing back along the move (3.14, round 3b).
- `blend` keys fell back to a neutral, windless drape, so N5's mid-spin and N1's recovery sleeves hung limp.
  → A blend key blends its sources' drape specs.
- The J's tip, carried round her hips at the glaive's reach, circled 2 m out on her far side, so the "belly"
  was a flat ring seen edge-on, 30 px above her feet. A band offset toward the grip collapsed on the floor,
  because there the grip lies along the path. → `reach_dip`, the camera-side `turn`, and a band offset across
  the path and lifted off the floor.
- A bent glaive built from the path's later directions whipped along the floor and dragged the smear's head
  down with it. → A curve from the hands that ends on the smear's head.
- A "weight drop" blended toward the coil also slid the feet 20% of the way, which cost 900 px of boots. →
  Plant the idle spots through A1.
- A 1 px sink carried the glaive (in the chest frame) with it: 1.5k px of glaive. → Hold the glaive in world
  on sink and release drawings.
- A `_why` note inside `plants` crashed `plant_spots`. → Skip underscore keys everywhere a sheet section is
  iterated.
- The RGBA phase ratio reaches 3 only on the shipped frames, through smear area. Every body drawing still
  costs 4-8k px. → Always report the body-only ratio and the spacing ratios beside it.
- Round 3b bought N1's 3.37 with a 56 px smear slab, and the critics read it as a hockey stick. MOVESET's 18 px crescent
  brings the ratio back to 2.2. → Size smears from MOVESET and the refs, never from the metric (3.14, round 3c).
- Colouring a band by lane (across it) turned a near-vertical rise into stepped vertical stripes, "a bar chart". →
  Colour along the stroke (head to tail), with only a thin rim and a speed line running lengthwise.
- A J built by carrying the tip round her hips has a corner where the floor run meets the rise. → One curve: the
  floor run, then a quadratic tangent to it through the tracked head, clamped to the ground line.
- A flat smear whose tail kept the from-drawing's shorter reach drew a second, inner arc beside the ring. → Draw the
  smear on one circle at the head's reach.
- "Over the front knee" in the pelvis's own frame read as "leaning back over the rear knee": N5's pelvis faced away
  from the target, so its front knee was the one away from the target. → Author the lunge toward the target on screen
  and measure the line of action in screen space (`r3_report.py` `line_of_action_screen`: N5 1.4° → 43°).
- A blend slerps the short way, so a pelvis turn over 180° between two keys (N5: release 75° → mid-spin 290°) turns
  backward. → Hand-pose an intermediate turn (`n5_spin1_r3c`) instead of blending across it.
- A raised arm's bell sleeve fell over her face (N1 F2). → Keep the arms beside the head, point that sleeve's drape
  wind away from the face, and check the face on every follow-through drawing.
- Blending a two-handed key with a one-handed one left the free hand 8-10 cm off the haft (N1 F1, N5 F2). → Set `wL`
  on the key so the left hand lets go.
- A kneel square to the camera foreshortens the thighs, so both knees down still read knock-kneed. → Wider knees
  (0.50 m), shins straight back under the thighs, and the pelvis turned 10° toward the target.

---

## 8. Status (2026-09-29)

| Part | Status |
|---|---|
| Isolated Blender env, pinned third-party fetch, deterministic model build | proven |
| Palette-exact toon render, passes, camera and scale maths | proven |
| Post-process (downsample, cleanup, lines, sel-out), `rosace_check` | proven |
| Face-stamp format and placement; override layers with STALE detection | proven |
| Face library at 144 to the critics' spec | in progress (redraw pending; face scored 5.5) |
| Rim on outline in stills (`rim.py`, `--rim`) | proven in stills |
| Rim LUT in the runtime (engine ask 14) | proposed |
| Height decision: 144 px | proven (round 1). `DESIGN.md` and `MOVESET.md` not yet updated |
| Stills A/B rounds | round 1 done (average 4.8, not passing). Round-2 sheets exist in `review/rosace/round-2-model/`, but no critique of them was found on record |
| Kimodo and GEM-X install; key-pose constraints; QC and ranking | proven |
| SOMA-to-VRM retarget; retime step (holds, snaps, easing, push, stepped drawings) | proven on N1 and N5 (`RETIME.md`); round-1 critics: retimed AI 4.5-5.5, raw 3-3.5, lost to the hand-keyed spike |
| Hero keys on the rig + AI in-betweens + spring cloth (`hero_layer.py`, `blender_apply.py --hero`) | proven on N1 and N5, 2026-09-29 (3.14 has the numbers). Blind round 2: 6.0-6.2 against the spike's 4.5-5.0 |
| Round 3: slow-in blends, world glaive keys, diagonal coils, open kneel, stole lag (`blend`, `glaive`, `cloth_lag`, `cloth_dyn` in the sheets) | proven on N1 and N5, 2026-09-29. Flat N5 sweep: 0-2° of pitch, 0.35-0.52 H, never over her head. Coils: 34-44° line of action, back three-quarters (142° / 150°). 0 cm drift, grip under 0.3 cm, stole shape lag 4-7 f. Phase ratio ≥ 3 not met (1.89 / 1.15 RGBA; 3.14 explains why). Blind A/B/C in `review/motion/r3/round-1/`: N5 6.8, N1 6.4-6.6 |
| Round 3b: the round-3 critics' fixes (plants on any key, `sink`, world-held glaive on holds, `cloth_world`, `hold_build`, blended drapes, C1b settle, `n1_contact_r3b`, `n5_spin_r3b`, `n5_contact_r3b`, `n5_kneel_r3b`, `n5_release_r3b`) | proven on N1 and N5, 2026-09-29 (3.14). Phase ratio, shipped body drawings: N1 **3.37** (met), N5 **2.58** (not met; the four-drawing wind-up). Spans 1.70 H (N1) and 1.79 H (N5 body alone), 0 cm drift, grip under 2.5 cm, flat sweep 2-3°, coils 34° and 44°, stoles stream 2-12 f. Blind A/B/C in `review/motion/r3/round-2/`: 6.6 on both moves (round 2 5.8-6.0, spike 4.4-4.5) |
| Round 3c: the round-3b critics' fixes (`n1_strike_r3c`, `n1_over_r3c`, `n5_coil_r3c`, `n5_release_r3c`, `n5_spin1_r3c`, `n5_kneel_r3c`, `n5_rise_r3c`; N5 F2/F3 and R1/R2 breakdowns; screen line of action in `r3_report.py`) | proven on N1 and N5, 2026-09-29 (3.14). Coils 37.5° (N1) and 43° (N5) on screen, back three-quarters, rear leg straight. Flat sweep 2-3°, never over her head. Spans 1.70 H (N1) and 1.79 H (N5 body alone), 0 cm drift, grip under 2.5 cm, stoles stream 2-7 f. Phase ratio ≥ 3 **not met** (2.19 / 1.48 shipped; 3.14 explains why, and says not to tune toward it). Blind A/B/C in `review/motion/r3/round-3/`; critique pending |
| Smears v3 (`smear_v3.py`: crescent profile, colour along the stroke, A5 edge and speed line, 50% dither over her body, J as one curve, per-image fade, remnants) | proven on N1 S1 (+ C1 remnant) and N5 S1-S3 plus the C1/C1b decay, 2026-09-29 |
| Smears v2 (`smear_v2.py`: thick bands, bent glaive, 4x raster) | proven on N1 S1 (J) and N5 S1-S3 plus C1/C1b's fading ellipse, 2026-09-29; superseded by v3 (the critics read the bands as slabs) |
| Tracked blade smears on strike drawings (`smear.py`) | proven on N1 S1 and N5 S1-S3, 2026-09-29: the spike's method, depth-tested, 144 px, palette A1-A5. The stained-glass VFX stages (leaded, shards, panes, furrow) are not built |
| Frame export to `dex.sprite/1` | not built |
| Runtime contract and validation; stand-in package in the lab | proven |
| VFX widths, halo, flash cap, ultimate beats, camera rules | proposed (arithmetic-checked, not playtested) |
| Engine asks: dithered paint (15), flash governor (8), flipbook effects (1) | proposed |
| Pivot trigger number | proposed |
| Second character (any class): units, class table, sizing and scale conventions | proposed (2.1, 2.2); nothing rendered yet |
| `--char` parameterisation (step 0.5) | not built: blocker for a second character |
| Enemy / boss runtime package, boss camera, player hurtbox at 144 | not designed (3.15, 3.16) |
| Enemy timing numbers | none sourced (3.13) |
| Non-VRoid body route, faceless characters, enemy rim | proposed (step 6, 3.10, 3.11) |

**Open conflicts to settle when the engine rim lands:**

- **Where the rim goes.** `RUNTIME-CONTRACT.md` puts the rim on the first surface pixel
  inside the silhouette, never on the outline. `DESIGN.md` 9 puts it on the outline pixel.
  Engine ask 14 is meant to resolve this.
- **The outline's ink mask.** `rosace_post.py` writes normal alpha 255 on the outline ring,
  which the contract reads as lit surface, not ink. The albedo fallback (`shaders.ts`: max
  channel under 0.07) doesn't catch OL `#181032` either (max channel 50 of 255) [proven, code
  read]. The same fallback wrongly catches an enemy's `#000000` armour as ink (3.15). The
  exporter has to write a real mask, following whichever rim model wins.

**Keep this file current.** Every lane that changes the character, render or motion pipeline
updates the matching section before it finishes: new numbers with their source file, changed
commands, gates and pitfalls, each tagged proven, in progress or proposed, with the date.
