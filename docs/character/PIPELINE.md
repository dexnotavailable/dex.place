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

The SOMA-to-VRM mapping is not built yet.

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
| SOMA-to-VRM retarget; retime step; frame export to `dex.sprite/1` | in progress / not built |
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
