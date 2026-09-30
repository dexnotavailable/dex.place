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

Last full update: 2026-09-29 (Integrate step, 3.6g: the five part lanes in the canonical build and stills). Latest section: 3.6r (drive 9 round 2 promoted: the canonical build and stills make its look by default, 2026-09-29).

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
  the pinned VRM 4.7.2, Retarget 5.2.0 and MMD Tools 4.5.14 extensions into an isolated root
  (MMD Tools added 2026-09-29 for PMX base bodies; `check` passes with it). Motion: follow
  `tools/motion-ai/SETUP.md` (two venvs, pinned weights).
- Base-body candidates: `tools/pixel-pipeline/base_search.py` imports a .pmx/.vrm/.fbx/.blend,
  measures it (heads, crotch-to-sole, shoulder/bust/waist/hip/thigh/calf from edge
  cross-sections at the rest pose) and renders hi-res front/3q/side, topology, and 144 px
  frames. [proven on the current base and on a PMX round trip of it: identical numbers]
  `--px-heights 144,80` renders and post-processes every listed figure height (`at_<h>px` in
  `measure.json`, `<name>_px<h>_*.png`); pass `--front=-y` with an `=` (argparse reads a bare
  `-y` as a flag). [proven 2026-09-29, base v2]
- **Gate:** `check` passes: Blender 5.1.2, every path under `D:\Dex\Tools\blender-dexplace`,
  and no forbidden module loaded.

**Step 0.5. Parameterise, or stop.** [blocker for any second character]

- Every script in section 6 item 1 still writes into `art/rosace`,
  `dex-place-art\rosace\build`, `review/rosace` or `motion-ai/raw`. A second character run
  as-is silently overwrites Rosace's data.
- Before step 1: add `--char` / `DEXPLACE_CHAR` to those scripts, or run from a copy.
- Fork these per character (they *are* the character): `build_rosace_v2.py` + `rosace_v2/` (Rosace's
  build since 3.6e; `build_rosace.py` is the retired v1 route), `render_rosace.py`
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

**Step 11. Retarget and retime.** [Implemented for inspected N1/N5 by the later
direct SOMA-to-rig/hero/retime route in3.14. The earlier blanket mapping-blocked
status is superseded. This does not establish complete80/144view/full-kit,
mesh-cloth, glassFX, export or playback acceptance; each remains gated.]

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

### 3.6 Model build numbers (Rosace; per-character values) [proven, `rosace/body.py`, `glaive.py`, `hair.py`; the v1 base, retired 2026-09-29: the canonical base is 3.6b-3.6e]

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

### 3.6b Base v2: SiroinoSotai body + MMD用女性素体 head [built 2026-09-29, adopted 2026-09-29 (3.6e); `build_rosace_v2.py`, `rosace_v2/`]

Dex's pick: "take the busty SiroinoSotai body, then swap in the head from the MMD女性素体".
Output `D:\Dex\Projects\dex-place-art\rosace\build\rosace.blend` (+ `_build.json` report) since the
Adopt step (3.6e); before it, `rosace_v2.blend`. Licences: `THIRD_PARTY.md`. The body-key, leg and
measurement values in this section are the pre-Adopt ones; 3.6e has the current ones.

- **Rig contract kept:** `J_Bip_*` names (Unity Humanoid renamed; `Chest` split into Chest +
  UpperChest with a 6 cm weight band), `Root`, `J_Adj_*_FaceEye`, objects `body` / `head_skin`,
  `rosace_height` 1.8956 (v1's, so pose files in metres still fit), `head_metrics`, v1 IK and
  glaive sockets (`rosace/rig.py`, `glaive.py` unchanged). Every pose in `art/rosace/poses/`
  applies through `hero_layer.resolve` + `posing.apply_pose` (on the bare base the outfit chain
  bones are skipped; the dressed build of 3.6c has them all).
- **Body keys** (`rosace_v2/body.py` BODY_KEYS, baked into the mesh): Breasts_LL 1.0,
  Hips_01_L 1.0, Hips_02_L 1.0, UpperLeg_L 0.3, Spine_Slim 1.8 (extrapolated), Chest_Slim 0.5,
  Heels 1.0. Breasts_LLL and All_L read grotesque; Chest_02_Slim shrinks the bust.
- **Proportions:** HEADS 6.1 (head 0.308 m); LEG_STRETCH 1.22 ankle-to-hip (crotch at 51.6%;
  unstretched it is 48.6% once a head is on); the headless neck is cut NECK_DROP 0.035
  (source units) below its open top, or it reads as a giraffe neck.
- **Head weld:** the MMD mesh is cut GAP 6 mm above the body's neck ring, its neck radius
  tapers onto the ring over TAPER 35 mm, a zipper strip joins the rings (16 body / 30 head
  verts), normals come from the welded mesh and are smoothed over ±35 mm, then split into the
  two objects with those custom normals. Face normals as v1, scaled to the head and gated off
  below the chin. Eye sockets and mouth are filled; the source's eye/brow/mouth meshes sit in a
  never-rendered `head_ref` collection.
- **Deformation helpers:** `J_Adj_*_LowerArmTwist` takes +50% of the hand's twist,
  `J_Adj_*_UpperArmTwist` -50% of the upper arm's, `J_Adj_*_Deltoid` half the upper arm's
  rotation. All three are Transformation constraints in REPLACE mode, so `posing.bake_keys`'
  FK capture can't double them. Weights limited to 4 per vertex.
- **Soft-tissue jiggle** (`rosace_v2/jiggle.py`, settings on the rig in `arm.data['jiggle']`,
  deliberately not in `chains`): hero_layer's damped spring, target = the tip carried rigidly
  by its parent. omega/zeta/max: bust 0.42 / 0.22 / 18°, glutes 0.55 / 0.30 / 12° (new
  `J_Sec_*_Glute`, peak weight 0.55), thighs 0.80 / 0.45 / 6° (`J_Sec_*_Thigh`, 0.30). Drop and
  run-bob test: bust lag peaks 4.4 cm (about 3 px at 144) and settles in about 0.5 s; call
  `jiggle.bake(arm, f0, f1)` after keying a sequence.
- **Measured** (`base_search.py`, bare, 144 px): heads 6.10 (v1 5.92), crotch 51.6% (v1 53.9%),
  shoulders / bust / waist / hips 26.9 / 18.9 / 11.9 / 25.3 px front, bust depth 15.8 (v1 30.6 /
  19.2 / 10.9 / 25.5, 15.6); at 80 px 14.9 / 10.5 / 6.6 / 14.1. Review: `review/rosace/base-v2/assemble/` (compare_*, checks/, keys/).
- **Pitfalls met:** bisect leaves cut verts unweighted only if you forget that the head's cut
  ring is shared with the bridge (weight it on both objects); moving connected edit bones one
  at a time maps shared joints twice (set all ends at once); removing vertex groups by index in
  a loop reindexes the rest (remove by name).

### 3.6c Refit on v2: hair, veil, outfit, glaive, palette [built 2026-09-29, adopted 2026-09-29 (3.6e); `rosace_v2/refit.py`]

`build_rosace_v2.py` now dresses the v2 base by default (`--bare` gives the assembly base of 3.6b
alone). Output is still `rosace_v2.blend`; `rosace.blend` is untouched (sha256 `0fbbf8e3...`
before and after). Review: `review/rosace/base-v2/refit/` (`stills/`, `checks/`, `motion/`).

- **Route.** The v1 builders are procedural (landmarks from the rig and `head_metrics`, shells cut
  from the body's own faces, ray casts, chain weights), so `hair.build` and `outfit.build` run on
  the v2 body unchanged, and `glaive.build` + `rig.finish` as in 3.6b. Garment weights come from
  the v2 body by nearest-surface transfer, so they include the twist, deltoid and soft-tissue
  bones; the hair, veil, tabard, sleeve and stole chains hang from the v2 `J_Bip_*` bones. For the
  build, `refit.build` swaps in v2 versions of four v1 functions (restored afterwards):
  - **Boots** (`boots_v2`). SiroinoSotai has modelled toes, and a shell cut from them keeps five
    toes and gold toenails under the boot (v1's relax-the-foot trick doesn't bridge them). The
    shell now covers leg, heel and mid-foot; the forefoot (past 42% of the foot's long axis, PCA
    of the foot skin) is a separate envelope: 18 rings x 20 sectors, each sector's radius the
    farthest skin sample in its slab (a radial hull), smoothed, never below 0.97 of the raw hull,
    9.5 mm out, a gold toe cap on the front 34%. Each foot takes weights from its own side's leg
    bones only (a shared transfer gave one vertex the other foot's weights: a spike in `q_stamp`).
    Two dead ends first: casting rays at the whole body (the upward rays hit the shin and the
    instep ballooned), then at foot faces only (the misses left skin gaps at the instep and heel).
  - **Boot cuff.** A gold band shell 15 mm tall at the boot top, 10.5 mm out. The shell trim alone
    never reached a pixel on the v2 leg's larger faces; with both legs on the indigo ramp, this
    line is what separates stocking from boot (DESIGN 3 row 12).
  - **Veil** (`build_veil_v2`, VEIL dict). v1's veil hangs to `UpperChest - 0.13 m`, a white slab
    about 32 x 42 px at 144 in the back view (DESIGN 2 asks 18 x 24). v2: starts at elevation 44
    on the skull (was 62) so the dark crown shows, wraps azimuth 112-248 (was 96-264), radius
    1.10 / 1.12 x the skull ellipsoid (was 1.20 / 1.22), sides end 2 cm below the shoulder joints,
    centre point 7.5 cm lower. Then `_veil_clear` pushes it 10 mm clear of the hair along the
    head-core direction (the hair lies on the real MMD skull, the veil on a fitted ellipsoid, so
    crown clumps came through; max push 45.8 mm, spread to neighbours so it moves as cloth).
    Measured back view (`n2_pivot`): 23 x 34 px at 144, 13 x 19 at 80 (v1 32 x 42, 18 x 24).
    Still bigger than DESIGN's 18 x 24 at 144: it drapes over the hair mass, which is that wide.
  - **Rose pin and veil pins** are placed on the veil's actual outer surface (ray cast), not at
    v1's fixed radius, where they would float.
- **Collar cross** (`hang_collar_cross` + a pixel glyph). v1's pendant sat in the v2 cleavage and
  its dark plate vanished; moved forward, it still rendered as a gold smear at 144 (a 7 px 3D
  cross). It now rests on the upper slope of the bust (18.8 mm forward) and its pixels come from
  an authored glyph (below), because DESIGN specifies the cross in pixels.
- **Palette** (DESIGN revision 3, ART-RULES O-6 and O-8), v2 only, as `scene['rosace_palette_overrides']`,
  which `materials.palette()` merges over `palette.json` (v1 has none, so nothing changes for it):
  `stocking` ramp I4 / I3 / I2 / I1 at t 0 / 0.14 / 0.40 / 0.80, I1 sheen spec at 0.97, inner
  line OL; `boot` I4 / I3 / I3 / I2 at 0 / 0.10 / 0.30 / 0.90, I0 gloss at 0.975. Render meta
  records the merged ramps, so the post-process classifies with them. At Adopt these move into
  `palette.json`.
- **Pixel glyphs** (`glyphs.py`, `art/rosace/glyphs/<name>_<px>.json`) [proven on the four stills
  at 144 and 80]: small authored stamps placed like faces. The build flags an object with
  `ob['glyph']`; `posing.anchors` then writes `glyph_<name>` = projected centre, facing dot and
  screen side; `overrides.face_layer` stamps it after the face. A glyph paints only over its
  `on_parts` (so a hand or hair in front still covers it), needs 3 visible px of its `need_parts`,
  is skipped under `min_facing` 0.25 (the back view), and mirrors with the chest. Collar cross:
  144 = 5 x 5 cross (G1 lit, G3 shade, G0 where the arms cross) on a 1 px I3 backing, 7 x 7 in
  all; 80 = a 3-wide cross on the backing, 5 x 6. 33 px and 24 px land in idle, N1 and Q.
- **Faces at 80 px** (`art/rosace/faces/*_80.json`) [first draft]: the library stopped at 96, so the
  80 px stills had blank faces. q34 serene (the Confident hero face), q34 resolute (Focused),
  front radiant and profile serene, built to revision 3 at the smallest budget: A2 iris top under
  the lash, matched A5 catch-lights, the near eye one iris row taller, the lash flick at the near
  eye's outer corner, 1 px blush, a 2 px smile.
- **Deterministic build.** Two builds of the dressed file give identical meshes, face order,
  weights, bones, attributes and custom properties, and pixel-identical beauty, albedo, id,
  normal and depth passes at 144, 80 and 640 px (`n2_pivot`). The `.blend` files still differ by
  ~100 bytes of file-level noise, so compare content, not sha256. Two fixes in `rosace/geo.py`:
  `bm_to_object` stores faces in a canonical order (by centre), because
  `bmesh.ops.create_uvsphere`'s face order changes between runs (it made `glaive_gold`,
  `hair_cap` and `belt_glass` differ, in v1 builds too); `fix_closed_normals` recalculates over a
  sorted face list, not a set. Build time 11-14 s with the occlusion bake.
- **Stills** (`stills_v2.py`, 144 and 80 px, ss 4): 25-27 colours, 0 off-palette pixels in every
  still. The override layers are built under `<out>/_layers` (`overrides.py --layer-dir`) so the
  v1 layer PNGs in `art/rosace/overrides/` are never rewritten; an 80 px still borrows the 144
  layer's face choice and rim (`--ops`). **Every hand patch is STALE on v2** (idle 11, N1 10, Q 9,
  N2 12), and they are also stale on the current v1 model: they were painted on the round-4
  renders (e.g. idle canvas 77 x 208 then, 82 x 205 on `rosace.blend` now). So neither v1 nor v2
  stills carry them; hands, folds and hair lines on v2 are the raw render until re-authored.
- **Motion** (`rosace_v2/motion_v2.py`): a read-only snapshot, the round-3c N1 sheet copied as
  `n1_r3c_v2refit` (own `retimed/`, `renders/`, `actions/` folders; the motion lane's `n1_r3c`
  outputs are untouched), then `run_pixel.py --hero` at 144 and 80 and `blender_apply.py` at
  640 px for a look at deformation. `blender_apply.py` step 4b bakes the rig's soft-tissue springs
  over every game frame when the rig carries `arm.data['jiggle']` (v2 only; `--no-jiggle` skips).
  N1 on v2: 19 drawings, plant drift 0.01 cm, hand-to-haft gap 3.35 cm at worst (round 3c on v1:
  under 2.5 cm), bust tip lag 4.2 cm, glutes 1.9, thighs 0.9. One run: 34 s at 144, 33 s at 80,
  23 s at 640.

Commands (one Blender at a time):

```sh
python tools/pixel-pipeline/stills_v2.py --build --hi 640          # build + 5 stills x 144/80 (+640 beauty); stills alone 39 s
python tools/pixel-pipeline/stills_v2.py --blend D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend \
    --out D:/Dex/Projects/dex-place-art/rosace/build/renders/v1cmp       # v1 through the same loop, read-only
python tools/pixel-pipeline/rosace_v2/refit_sheets.py --v2 <build>/renders/v2refit --v1 <build>/renders/v1cmp \
    --out review/rosace/base-v2/refit/stills
python tools/pixel-pipeline/rosace_v2/motion_v2.py                  # N1 r3c at 144 + 80 + 640, ~95 s
python tools/pixel-pipeline/blender_env.py run --python tools/pixel-pipeline/rosace_v2/closeup.py -- \
    --blend <build>/rosace_v2.blend --out <dir> [--pose <pose.json>] --shots "name:yaw:elev:bone|x,y,z:size;..."
```

**What does not fit yet** (open for the Adopt step):

- Hand patches, fold and hair-line patches: all STALE (above). The face stamps at 144 still fit
  (placed from anchors) but are the round-4 set (revision 2's spec); the construct lane's
  revision-3 faces (`art/rosace/construct/faces/`) are whole painted heads on another key and
  origin, not stamps over a render, so they can't be dropped in without an adapter.
- The 80 px faces are a first draft, unreviewed. The 80 px stills have no override layers of
  their own.
- Veil 23 x 34 px at 144 against DESIGN's 18 x 24 (it drapes over a wide hair mass).
- Back view: the tabard's indigo lining behind the legs merges with the dark thigh-highs.
- Hand-to-haft gap 3.35 cm at worst in N1 (v1 under 2.5 cm). Cause not investigated; the grip
  sockets and the hand grip offsets in `posing.hand_rest` are v1's.
- `palette.json` still maps `stocking` to the W ramp; the v2 ramps live only in the v2 scene.

### 3.6d Blind base A/B: v2 vs the current base in the same outfit [sheets built 2026-09-29, judged 2026-09-29: v2 6, old base 5 (3.6e); `rosace_v2/build_v1_match.py`, `rosace_v2/compare_sheets.py`]

The judge must see the base, not the outfit fixes, so the current base is rebuilt wearing the v2
refit outfit: `build_v1_match.py` runs `build_rosace.py`'s steps on `HairSample_Female.vrm` with
`refit.apply_palette()` and `refit.build()` (v2 veil, pins, `boots_v2` + gold cuff, collar cross
glyph) and writes `build/scratch/rosace_v1_outfitv2.blend`; `rosace.blend` is never touched
(sha256 `0fbbf8e3...` unchanged). `--plain` is a pure `build_rosace.py` rebuild: its idle at 144
has identical id and albedo passes to `rosace.blend`'s and differs in 0.26% of supersampled beauty
pixels (AO noise), so the rebuild route is faithful.

- **Band shells on v1.** v1's leg faces are 2-3 cm tall, so a narrow band shell finds no face
  centre inside its band: `rosace.blend` ships with a **0-vertex `thigh_bands`**, and the v2 boot
  cuff came out empty too. `outfit.shell` takes an optional `coarse(p, masks)` for the whole-face
  pick (default: the region, so every existing build is unchanged); `build_v1_match.py` rebuilds an
  empty shell once with a coarse pick that also tests the centre shifted +-1..3 cm in z and 2 more
  subdivisions. The final cut is still the garment's region: thigh bands 268 verts (v2 202), cuffs
  188 (v2 180). Fixing v1's shipped thigh bands is left to the Adopt decision.
- **Same everything else.** Stills: `stills_v2.py` on both files (144 and 80 px, ss 4, same poses,
  cameras, post-process, face stamps, glyphs; both 0 off-palette). Motion: `motion_v2.py --tag
  v1match|v2refit --hi 0` (round-3c N1 sheet, same 19 drawings; v1 has no soft-tissue springs, which
  is a real base difference). Hand-to-haft gap at worst: v1 2.4 cm, v2 3.35 cm.
- **Sheets** (`review/rosace/base-v2/compare/`, git-ignored): 01/02 idle 144/80, 03/04 N1 contact,
  05/06 back view (N2 pivot, black thong), 07/08 N1 strip of all 11 distinct drawings at 144/80
  (+ an A|B GIF at game timing), 09 v2 at 144 vs refs 07 and 09 at native size (positions P1-P3
  shuffled). A/B order is drawn per sheet from a seed; the answer and the seed are in `key.json`
  only (reproduce: `--seed 788322799`). Panels share the render anchor as ground line, one zoom and
  one background; still sheets show native 1x beside the zoom.

```sh
python tools/pixel-pipeline/blender_env.py run --python tools/pixel-pipeline/rosace_v2/build_v1_match.py
python tools/pixel-pipeline/stills_v2.py --blend D:/Dex/Projects/dex-place-art/rosace/build/scratch/rosace_v1_outfitv2.blend     --out D:/Dex/Projects/dex-place-art/rosace/build/renders/v1match --hi 0
python tools/pixel-pipeline/rosace_v2/motion_v2.py --tag v1match --blend <build>/scratch/rosace_v1_outfitv2.blend --hi 0     --review D:/Dex/Projects/dex.place/review/rosace/base-v2/compare/_motion
python tools/pixel-pipeline/rosace_v2/motion_v2.py --tag v2refit --hi 0 --review <same>
python tools/pixel-pipeline/rosace_v2/compare_sheets.py [--seed N]
```

### 3.6e Adopt: the v2 base becomes `rosace.blend` [done 2026-09-29; `build_rosace_v2.py`, `rosace_v2/body.py`, `rosace_v2/key_sweep.py`]

The blind A/B (3.6d) went to v2, 6 to 5, but the judge measured that v2 wasn't busty yet (bust
depth 15.8 px at 144 against v1's 15.6), its waist to hips was looser (0.47 against 0.429), its
thighs were heavier (11.8 against 10.4 px) and its legs shorter (crotch at 51.6% against 53.9%).
Those four were fixed in the body build, then v2 was made canonical. All numbers are px at 144,
front view, bare, from `base_search.py` on the rest pose.

- **Base sources** (licences, sha256 and local paths in `tools/pixel-pipeline/THIRD_PARTY.md`;
  `rosace_v2/sources.py` checks the sha256 before every build):
  - body: SiroinoSotai v1.0 by しろいの (BOOTH 8268676, CC0 1.0; never call our work
    「公式」「公認」「認定」「監修」「共同開発」, never use its logo),
    `D:\Dex\Projects\dex-place-art\rosace\bases\siroino\SiroinoSotai_1.0\SiroinoSotai.blend`
  - head: MMD用女性素体 by 射当ユウキ (BOOTH 1958825; commercial use and modification allowed;
    never misrepresent authorship, no demeaning or illegal use),
    `D:\Dex\Projects\dex-place-art\rosace\bases\primero\MMD用女性素体\mmdBodyWoman.blend`
  - credits line (DESIGN.md, top): "Base body: SiroinoSotai by しろいの (CC0) · Head base:
    MMD用女性素体 by 射当ユウキ"
- **Proportion sheet** (the build constants; `_build.json` records them per build):

  | Constant (`rosace_v2/`) | Before (3.6b) | Adopted | What it does |
  |---|---|---|---|
  | `body.BODY_KEYS` | Breasts_LL 1.0, Hips_01_L 1.0, Hips_02_L 1.0, UpperLeg_L 0.3, Spine_Slim 1.8, Chest_Slim 0.5, Heels 1.0 | the same plus **Breasts_LLL 0.5**, **UpperLeg_L removed** | the source's own shape keys, summed and baked |
  | `body.LEG_STRETCH` | 1.22 | **1.30** | ankle-to-hip stretch |
  | `body.TORSO_K` (new) | 1.0 | **0.92** | hip-to-neck z scale: a shorter torso raises the crotch and grows the body scale, where more leg stretch alone shrinks the whole body (1.34 lost 1.3 px of shoulder and 2.2 px of hip) |
  | `body.WAIST_PINCH` (new) | none | **amount 0.17**, centred 0.63 up `J_Bip_C_Spine`, sigma 60 mm below / 45 mm above | narrows x only (the waist is already 95 mm deep); no bone moves |
  | `head.HEADS` | 6.1 | 6.1 | head 0.308 m; body scale `s_b` 1.268 |

  | Measure (px at 144, front) | v1 (retired) | v2 before | **v2 adopted** | 80 px, adopted |
  |---|---|---|---|---|
  | heads tall | 5.92 | 6.10 | **6.10** | |
  | crotch / height | 0.539 | 0.516 | **0.537** (77.3 px) | 42.9 px |
  | shoulders / bust / waist / hips | 30.6 / 19.2 / 10.9 / 25.5 | 26.9 / 18.9 / 11.9 / 25.3 | **26.6 / 20.9 / 10.0 / 24.1** | 14.8 / 11.6 / 5.6 / 13.4 |
  | bust depth | 15.6 | 15.8 | **18.1** | 10.0 |
  | waist / hips | 0.429 | 0.470 | **0.417** | |
  | thigh top (one leg) | 10.4 | 11.8 | **10.8** | 6.0 |

  How the adopted values were picked (`rosace_v2/key_sweep.py`, 21 bare builds, about 12 s each;
  table and JSON in `review/rosace/base-v2/final/measure_vs_prefix/key_sweep.json`): Breasts_LL
  1.4 alone gave a bust depth of only 17.7, and LLL at 1.0 reads grotesque, so LLL 0.5 is stacked
  on LL 1.0. Spine_Slim at 2.5 and 3.0 took only 0.6 and 1.1 px off the waist. Chest_01_Slim and
  Chest_02_Slim cost bust. Hips_01/02_L at 1.3 or 1.5 didn't widen the hips and lowered the
  crotch. What cost what: hips 25.3 → 24.1 (DESIGN's three-quarter target is 24) and shoulders
  26.9 → 26.6.
- **Spring bones** (unchanged from 3.6b; `rosace_v2/jiggle.py`, `arm.data['jiggle']`): omega /
  zeta / max angle: bust 0.42 / 0.22 / 18°, glutes 0.55 / 0.30 / 12°, thighs 0.80 / 0.45 / 6°.
  On the adopted base the drop-and-run test peaks at 4.8 cm of bust lag (about 3.7 px at 144)
  and settles to about 1 mm (`review/rosace/base-v2/final/checks/jiggle_v2.png`). The hair,
  veil, tabard, sleeve and stole chains are the v1 cloth chains (`arm.data['chains']`, 3.6c).
- **Empty shells.** The bigger body scale left `armbands` with 0 vertices: the band is 28 mm
  wide and the arm faces are bigger, so no face centre landed inside it. `refit.build` now
  rebuilds an empty shell once with a coarse pick (the centre shifted ±1–3 cm in x and z) and 2
  more subdivisions. The final cut is still the garment's own region. `_build.json`
  `dress.v2_fixes.empty_retried` lists what was rebuilt (armbands: 364 verts).
- **Files.** `rosace.blend` is built by `build_rosace_v2.py` (its default `--out`). The old
  shipped file was copied to `build/rosace_v1.blend` first (sha256 `0fbbf8e3...`, unchanged),
  and the build refuses to write `rosace.blend` if that backup is missing, or to write
  `rosace_v1.blend` at all. `build_rosace.py` (v1) now writes `build/scratch/rosace_v1_rebuild.blend`
  and refuses both names. `stills.sh`, `stills_v2.py` and `motion_v2.py` default to `rosace.blend`.
  `rosace_v2.blend` is left over from before the Adopt step, with the same content. Exploration
  flags (`--keys`, `--leg-stretch`, `--torso-k`, `--pinch`, `--bare`) never write `rosace.blend`.
- **Checks on the canonical file** (`review/rosace/base-v2/final/`): five stills at 144 and 80 px
  plus 640 px beauty (`stills/`), 25–27 colours and 0 off-palette pixels in every still. The
  stills are pixel-identical to a second build of the same scripts. All 10 hero and still poses
  apply (`checks/poses_*.png`). N1 r3c runs at 144 and 80 (`motion/`): plant drift 0.01 cm.
  Sheets compared with the pre-fix v2 are in `sheets_vs_prefix/`; the bare measures are in
  `measure_vs_v1/` and `measure_vs_prefix/`.
- **Regression, open:** the off (left) hand reaches less far. In N1 the worst hand-to-haft gap
  goes from 3.35 to **4.59 cm** (drawings 3–5; 6: 2.39 → 3.61; 9–11: 3.08 → 3.51). That is about
  3.5 px at 144. The shorter torso drops the shoulders, and the hero keys and grip sockets are
  v1's. The fix belongs in the hero keys or `posing.hand_rest`, not in the body.
- **Not done** (pose work, in the hero keys in `art/rosace/poses/`): the near knee bowing in on
  the 80 px idle, hip tilt and back arch in the profile N1 frames (A1–A3, F1, R1), and deeper,
  more stylised bends to match refs 07 and 09. The `stocking`/`boot` ramps still live in the
  scene (`rosace_palette_overrides`), not in `palette.json`, because the art-construct lane and
  `src/` read `palette.json`. Compare a `build_v1_match.py --plain` rebuild with `rosace_v1.blend`
  now, not `rosace.blend`.

```sh
# canonical build (backs nothing up itself: rosace_v1.blend must exist)
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/build_rosace_v2.py
python tools/pixel-pipeline/stills_v2.py --plain --blend D:/Dex/Projects/dex-place-art/rosace/build/rosace_pre_artistry.blend --out D:/Dex/Projects/dex-place-art/rosace/build/renders/final_v2 --hi 640   # since 3.6g the pose files changed too (old copies: build/scratch/poses_pre_artistry/), so this no longer reproduces final_v2 exactly
python tools/pixel-pipeline/rosace_v2/key_sweep.py --out <build>/scratch/sweep --variants variants.json
python tools/pixel-pipeline/check_rosace_v2.py '--' ... --mode poses|jiggle   # via blender_env.py run; then --sheets <dir>
python tools/pixel-pipeline/rosace_v2/motion_v2.py --tag adopt --hi 0 --review review/rosace/base-v2/final/motion
```

### 3.6f Bust shape variants (figure-pose lane) [built 2026-09-29; S7 is shape.json's `current` since refine round 1 (S5 before), S9 added in refine round 2, not promoted; `rosace_v2/figure_shape.py`, `art/rosace/figure/shape.json`]

DESIGN revision 3.5 item 4 asks for a bigger or more prominent bust. The change is a shape key,
never a remesh or a sculpt, so the human-authored base stays the Basis and the rig still poses it.

- **The key.** `figure_bust` on `body`: an analytic displacement masked by the source's own bust
  weights (`J_Sec_L/R_Bust1`, smoothed 6 passes) times a height ramp above each breast's base
  plane (a plane fitted through the weight rim), so it is exactly 0 at the chest wall. Parameters
  per variant in `shape.json`: `volume` (target ratio of the mound volume in front of the base
  planes; the scale gain k is solved by bisection on the exact mesh volume, after every other
  term, so equal volumes differ in shape only), `lift_deg` (rotation about a hinge `hinge_frac`
  of the way up the base, default 0.5), `projection` (stretch along the base normal), and since
  FP2 `raise_m` (the mass moved straight up), `fill_*` (a forward bump on the chest *above* the
  mound: 0 at `fill_top_m`, 1 at `fill_peak_m`, 0 at `fill_bottom_m` below the shoulder-joint
  line, a Gaussian of `fill_width_m` about x = ±`fill_x_m`; it turns the lifted mound's ledge into
  a ramp), `under_*` (the same kind of bump just under the underbust fold), and `mask_smooth` /
  `h0_frac`. Every parameter defaults to the FP1 behaviour, so S0-S4 rebuild unchanged.
  `current` in shape.json names the variant every command applies when `--variant` is not given.
- **Garments follow.** Outfit shells in this build are separate meshes on the armature, with no
  surface-deform or shrinkwrap, so each chest piece gets a *matching* `figure_bust` key: the same
  field at the garment vertex, with the mask of the nearest body vertex, faded out 2-8 cm from the
  skin. Moved: `bodice` (it carries the chest window and the halter), `collar_cross` and
  `collar_plate` (rigid, mean displacement), and four hair clumps in front of the chest. The
  `ao` occlusion attribute is re-baked (bake.py's settings) within 10 cm of any moved vertex.
- **Files.** Per variant `build/lanes/figure-pose-shape_<V>.blend` (key at 1.0, its own `ao`),
  and the bundle `build/lanes/figure-pose-shape.blend`: keys `figure_bust_<V>` at 0 plus the
  attribute `ao_<V>` (canonical bake kept as `ao_S0`); `select` sets one key to 1 and copies its
  `ao_<V>` into `ao`, because occlusion is a vertex attribute and can't ride on a slider. The
  bundle's S3 and S4 stills are pixel-identical to the per-variant files. The script refuses to
  write `rosace.blend`, `rosace_v1.blend` or `rosace_v2.blend` and only writes `lanes/figure-pose*`.
  **`build/lanes/figure-pose-base.blend`** is `rosace.blend` with `current` (S7 since refine round 1, S5 before) applied: the base
  every figure-pose render and pose check uses (3.7b). The keys are on `body`, `bodice`, `collar`,
  `collar_cross`, `collar_plate`, `midback_strap` (it runs under the bust) and hair clumps 03, 04,
  18 and 19.
- **The side profile in the repo.** `side_profile()` / `profile_summary()` are
  `research/measure_bust.py`'s cross-section method, moved into figure_shape.py. They reproduce its
  numbers exactly (S0 2.61, S2 3.38, S3 4.65) and report `shelf_px` (PS-N20), `fold_px` (the jump
  into the underbust crease), `upper_rows` / `lower_rows` / `flat_rows`, `apex_frac_upperarm`
  (PS-P11), `side_projection_px` and the yaw 30/45/90 breaks (PS-P10). `build` puts them in its
  report. `sweep` solves and measures any number of parameter sets on the open file without
  writing anything, a few seconds each.
- **Measured** (bare rest pose, `measure_bust.py` cross-sections; px at 144, the shelf is the
  largest one-row step of the side profile's upper slope, PS-N20):

  | | S0 base | S1 +20% | S2 +30% | S3 +20% lift 7° proj 0.12 | S4 +40% |
  |---|---|---|---|---|---|
  | k solved | 0 | 0.098 | 0.143 | 0.016 | 0.185 |
  | side projection | 9.2 | 10.2 | 10.6 | 10.8 | 11.0 |
  | break at yaw 30 (PS-P10) | 7.5 | 8.3 | 8.6 | 8.8 | 8.9 |
  | bust depth / width | 17.7 / 20.8 | 18.5 / 21.6 | 18.9 / 22.0 | 19.6 / 21.7 | 19.3 / 22.4 |
  | apex frac of upper arm (PS-P11) | 0.49 | 0.51 | 0.51 | 0.43 | 0.51 |
  | upper / lower slope rows | 11 / 4 | 11 / 5 | 11 / 5 | 10 / 5 | 11 / 5 |
  | shelf step (PS-N20, ≤ 3.5) | 2.6 | 3.1 | 3.4 | **4.65** | **3.65** |

  Waist 9.7 px and underbust depth 7.7 px in every variant. Posed idle_hero: no skin islands in
  the bodice in any still; against S0, 6-9 new bodice vertices and 0-4 collar-cross vertices sit
  behind the skin (the base itself has 241, at the window rim), none visible at 144 or 80. Arm
  clearance to the bust is unchanged (28.9 mm). The back view is identical in all five.
- **Reading.** Size is a small lever at pixel scale: +40% volume buys +1.8 px of projection at 144
  and about +1 px at 80. S3's lift makes a shelf under the collar and S4 is past the same line, so
  the ceiling is about +30% (S2). Nothing is adopted; the pick is Dex's and the blind critics'.
- **FP2: the critics picked S3** (blind averages S3 6.0, S2 5.5, S4 5.25, S1 5.25, S0 4.25) and
  asked for S3's lift with S2's mass, a top that grows out of the collar, and a curved bottom.
  More lift alone makes the ledge worse, so S5 adds the upper fill. S6 is fix 10's alternative
  (S2 volume, gentle lift). Rest profile, px at 144 (sweep files:
  `build/lanes/figure-pose/work/fp/sweep*_out.json`):

  | | S3 | S3 + mass, no fill | **S5** (current) | S6 |
  |---|---|---|---|---|
  | volume / lift / projection | 1.20 / 7° / 0.12 | 1.28 / 9° / 0.13 | 1.28 / 9° / 0.13 | 1.30 / 3.5° / 0.05 |
  | fill / under-fill | – | – | 3 cm / 2 cm | 2 cm / – |
  | shelf (PS-N20, ≤ 3.5) | 4.65 | 6.03 | **2.92** | 2.93 |
  | fold jump | 5.6 | 5.7 | 4.7 | 7.2 |
  | apex frac of upper arm (PS-P11) | 0.43 | 0.43 | 0.43 | 0.49 |
  | side projection / break at yaw 30 | 10.8 / 8.8 | 11.2 / 9.1 | 10.9 / 8.9 | 10.8 / 8.8 |

  S5's upper slope steps 1.2 / 1.3 / 2.9 / 2.7 / 2.5 / 2.6 px from the collar, a ramp where S3 had
  a 4.65 px ledge. Posed idle_hero on the lane base: side bust-out 11 px at 144 and 7 at 80 (S3
  11 and 6), the apex a row higher, no skin islands, and new vertices behind the skin against S0
  of bodice +8, collar +1 and hair 04 +1 (PS-P21). What didn't work: putting the hinge at the top
  of the base (6.2), a softer mask edge (6.4), and a fill that peaks lower down (7.1: it pushes
  both sides of the ledge). Fix 3 (raise the mass about 2 px) can't come from the shape: a 2 mm
  raise already puts the apex at 0.38, under PS-P11's 0.40. The waist gap goes to the pose's
  chest lift. **Not promoted:** fix 9 asks for a blind round of S3 against S5 beside 04a/04b at
  3x and 1x first. Comparison sheets: `review/rosace/art/figure-pose/base/`.
- **Refine round 1: S7 and S8** (the judges asked for another step of size and projection). Lift,
  not size, makes the shelf: at S5's 9° any volume past +34% gives 3.6-4.3 px and moves the apex a
  row up; at 4-5° the volume goes to +50% with the shelf ≤ 3.03 px and the apex at 0.43 (22 sweep
  sets, `build/lanes/figure-pose/work/R1/sweep*_out.json`). Rest profile, px at 144:

  | | S5 | **S7** (current) | S8 |
  |---|---|---|---|
  | volume / lift / projection | 1.28 / 9° / 0.13 | 1.42 / 4° / 0.22 | 1.50 / 4° / 0.18 |
  | shelf / fold jump | 2.93 / 4.7 | 2.97 / 6.3 | 3.03 / 6.8 |
  | side projection / break at yaw 45 | 10.9 / 10.3 | 11.8 / 11.2 | 12.0 / 11.3 |
  | apex frac of upper arm | 0.43 | 0.43 | 0.43 |

  Posed on `idle_appeal` the break is 9 / 10 / 10 px at 144 and 5 in all three at 80. S5, S7 and S8
  are built on the same rosace.blend as `lanes/figure-pose-base-S5.blend`, `-S7` and `-S8`;
  `lanes/figure-pose-base.blend` is rebuilt with `current` (S7). The blind S5/S7/S8 round on the same
  pose is in `review/rosace/art/figure-pose/refine/round-1/`; if the critics pick another, set
  `current` back and rebuild the base.

```sh
# one variant (lane file; default = shape.json 'current'), or every variant as keys in one bundle file
python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python tools/pixel-pipeline/rosace_v2/figure_shape.py -- build [--variant S2] [--out D:/Dex/Projects/dex-place-art/rosace/build/lanes/figure-pose-base.blend]
# solve + measure parameter sets without writing a file (PS-N20 shelf, fold, apex, breaks)
python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python tools/pixel-pipeline/rosace_v2/figure_shape.py -- sweep --out <json> --params '[{"k": "a", "volume": 1.28, "lift_deg": 9, "fill_m": 0.03}]'
# rest measures + side profile of built lane files
python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python tools/pixel-pipeline/rosace_v2/figure_shape.py -- measure --blends <a.blend,b.blend> --out <json>
python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python tools/pixel-pipeline/rosace_v2/figure_shape.py -- bundle [--select S0]
# stills: q34 / true side / back of idle_hero at 144 + 80 (+480 beauty); --variant picks from a bundle
python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python tools/pixel-pipeline/rosace_v2/figure_shape.py -- render --blend <lane .blend> --out <renders>/S2 --views q34:30,side:@left,back:@back [--variant S2]
python tools/pixel-pipeline/rosace_v2/figure_shape.py post --root <renders>
python tools/pixel-pipeline/rosace_v2/figure_shape.py sheets --root <renders> --out review/rosace/art/figure-pose/shape
```

### 3.6g Integrate: the five part lanes in the canonical build and stills [done 2026-09-29; `art/rosace/integrated.json`, `build_rosace_v2.py`, `stills_v2.py`, `motion_finish.py`, `integrated_sheets.py`]

The face, hair, outfit, glaive-hands and shading lanes each built to their own lane file and drew on
the pre-integration canonical still. This step puts every lane's kept result into one build and one
stills chain. `rosace.blend` (sha256 `292d672d...`) is now built with all of them. The file before
this step is `build/rosace_pre_artistry.blend` (sha256 `60974c0b...`, with `_build.json`), and
`build_rosace_v2.py` refuses to write the canonical file unless that backup exists, or to write the
backup at all. Nothing figure-pose built is in here: its bust shape S5 and appeal poses aren't promoted.

- **One file holds the picks:** `art/rosace/integrated.json`. `build` is read by
  `build_rosace_v2.py`, `stills` by `stills_v2.py` and `motion_finish.py`, and `why` gives the reason
  for each pick. An environment variable that is already set (`ROSACE_OUTFIT`, `ROSACE_GLAIVE`,
  `ROSACE_HAIR`) beats the file, so the lane drivers still build their own variants. The lane
  drivers that call `stills_v2.py` (`hair_lane.py`, `hair_lane2.py`, `outfit_lane.py`,
  `face_v2_run.py`, `face_f2_run.py`) now pass `--plain`, which is the pre-integration chain. Their
  controls therefore don't change.
- **What the build picks up:**

  | Lane | In the build | Source |
  |---|---|---|
  | outfit | `ROSACE_OUTFIT=R2Q` (`rosace/outfit_art.py`) | round 2 was the round its critic preferred. R3K3 (round 3) wasn't preferred over R2Q; both scored 6/10 |
  | glaive-hands | `ROSACE_GLAIVE=l5`: beige stole face, 8 du tails | round-2 pick |
  | hair | `ROSACE_HAIR=r2f` (`rosace/hair_v3.py`'s hair and veil plus its hair/hairtip ramps on the scene overrides, the same swap `hair_lane_build.py` makes) | round-2 pick |
  | shading | the per-face `limb` attribute (`rosace_v2/limbs.py`, moved out of `rosace_shade_lane.py`) and the light/depth2 material outputs (`materials.py`) | round-3 pick needs them |
  | face | nothing: pixels only | |

  The build takes 14.6 s with AO and produces 88 dressed objects. `_build.json` has an `integrated` block.
- **Poses** (`art/rosace/poses/{idle_hero,n1_contact,q_stamp,n2_pivot}.json`): each file is the
  glaive-hands lane's pose copied whole, since it is the canonical pose plus that lane's weapon,
  hands, fingers, poles, stole and sleeve drape. The outfit's R2Q drape patches `qtab` (Q) and
  `hair` + `tabn2` (N2) are deep-merged on top. The two lanes touch different keys, so nothing
  conflicts. The outfit's `hair` patch sweeps the hair lane's tail aside in the back view. The
  outfit critic preferred this, and the hair lane never judged the back view with the tail
  aside. The pre-integration pose files are kept in `build/scratch/poses_pre_artistry/`. Every pose
  sha1 changed, so v1 hand patches go STALE (they already were) and so does the shading lane's
  painted idle 144 override (`paint_r2/idle_hero_144.json`).
- **The stills chain** (`stills_v2.py`, the default; one Blender process at a time):
  1. `tools/art-construct/gh_render.py`: the render passes plus `light` and `depth2` plus
     `landmarks.json`, then the 640 px beauty through `render_rosace.py`.
  2. `author_faces_pass.py`: `facepass.json` and `facewin.png`.
  3. `rosace_post.py --shade shading_r3g.json`.
  4. `hair_px.py --preset p1h_nowin --only <all its steps except tips>`.
  5. `overrides.py build/apply` with `ROSACE_FACES=f2`, the preset's `rim_style`, and the per-still
     `rim_family` (warm on N1 and Q).
  6. `hair_px.py --face-window`, only if the preset has `fwin`, then `rosace_shade.post_face`. The
     result is kept as `still_layers.png`.
  7. `outfit_px.run` then `outfit_px2.run` (R2Q's 14 passes), producing `still_ofx` and `still_o2`.
  8. `author_hands.apply --base still_o2 --tag still_hands` with the specs in `art/rosace/hands/poses/`.
  9. The preset's palette remap, applied last. Until this step every pass reads `palette.json`
     codes. Then comes the hair hue trial, shifted from `palette.json`'s I1-I3 on hair pixels.
     Output is `still.png` plus `still_ground.png` (the contact shadow).

  The full set takes 99 s: 5 stills at 144 and 80 plus 640. `--config <json>` trials another pick
  file. `--no-render` reruns steps 3-9 on existing passes.
- **Conflicts settled on the look sheets.** Every lane pass had been tuned on the pre-integration
  still. Three of them broke only in combination, and each is switched off in `integrated.json`
  with its reason (ART-RULES round IN, WF-P14). Side-by-sides are in `review/rosace/art/integrated/trials/`.
  - **Brow windows** (hair `fwin`): the F2b brows sat in skin islands cut into the r2f fringe and
    read as a second pair of shut eyes (HR-N06). The chain uses `p1h_nowin`, the hair lane's own
    fallback.
  - **Fringe tips** (hair `tips`): r2f's centre clump ends between the eyes in N1's head tilt. Its
    A3/A4 tip drew a light-blue column down the nose (new HR-N07). The step is skipped; idle and
    Q look the same without it.
  - **The hue trial against the shading remap:** shifted from the shading lane's desaturated indigo,
    the hair went grey-lavender and merged with the dark stockings. It now shifts `palette.json`'s
    I1-I3 (`hair_hue_base: palette`). The shading lane keeps I0/I4 and the rest of the indigo family.
  - **Outfit against shading on the stockings:** the shading stage re-bands stocking and boot into
    K1-K3 whatever the build ramp is. That matches what the round-2 shading critic called the lane's
    one win, so no outfit ramp was needed.
- **Measured on the integrated stills** (`review/rosace/art/integrated/`):
  - **Palette:** 0 off-palette pixels in all 10 stills, counting the preset's hexes and the 3 hue
    colours as palette (`palette_check.json`).
  - **Colours:** 34 at 144 and 31-32 at 80. That fails PX-P15's cap of 32; the pre-integration
    stills had 25-27. **Open:** the hue trial adds 3 colours and the K stockings add 3.
  - **Rules:** `rosace_shade_check.py --lane --only PX,CL,FC,HR` passes 20-25 rules per still,
    against 15-19 on the pre-integration stills (`rules_check.json`).
    - Newly passing: PX-P31, P06, P24, P34, P36, P37, N13, P38 and HR-P09.
    - Newly failing: PX-P15 (colours), PX-P01 (stockings darker on the lit half), PX-P18 (lit-side
      ring), PX-N06 (K2/K3 within 1.3:1 of OL; the dark-stocking choice) and HR-N02 (4 isolated
      I0/I1 px).
  - **Grip gaps** from the landmarks: 0-1.1 cm on every still.
- **Motion:** `rosace_v2/motion_v2.py --tag integrated` renders N1 r3c on the integrated build.
  - It finishes each frame with `motion_finish.py`: the shading preset's tones by ramp index (the
    stockings go to K), the remap, and the hair hue. Before that step the frames still had blue
    stockings.
  - Faces, constructed hands, and the outfit and hair pixel passes are **stills-only**: frames have
    no light/depth2 pass, face pass or grip landmarks.
  - N1 off-hand gap is 4.59 cm, unchanged from 3.6e; plant drift is 0.01 cm.
  - Strips, grids and GIFs at 144, 80 and 640 are in `review/rosace/art/integrated/motion/`.
- **Review sheets** (`integrated_sheets.py`): `look/` (not blind: pre-integration, each lane's pick
  and the integrated still, per still at 144 and 80), `ab/` (blind A/B/C of integrated vs
  pre-integration vs the ref, with `key.json`), `stills_*`, `heads_*`.
- **By eye** (not blind: the Integrate step built the key): the integrated still beats the pre-integration one on
  every still at both sizes, and is still clearly below refs 07/08/09. The blind `ab/` sheets are
  for a critic (WF-P11).

```sh
# the canonical build (needs build/rosace_v1.blend and build/rosace_pre_artistry.blend)
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/build_rosace_v2.py
# the integrated stills (default out build/renders/integrated), then the sheets
# (since 3.6r the default chain is drive 9: the integrated chain needs --chain integrated; --config implies it)
python tools/pixel-pipeline/stills_v2.py --chain integrated [--no-render] [--only idle_hero] [--config <trial.json>]
python tools/pixel-pipeline/integrated_sheets.py
# N1 on the integrated build (motion_finish.py runs by default; --no-finish skips it)
python tools/pixel-pipeline/rosace_v2/motion_v2.py --tag integrated --review review/rosace/art/integrated/motion
# the pre-integration chain (lane controls)
python tools/pixel-pipeline/stills_v2.py --plain --blend <lane.blend> --out <dir>
```

### 3.6h Round WH2: the whole-character fixes in the canonical build [done 2026-09-29; `integrated.json`, `build_rosace_v2.py`, `tools/art-construct/wh2_px.py`, `art/rosace/faces/wh2.json`, `whole_sheets.py`]

The round-1 whole-character critique (face 5, body and hands 5.5 against the refs' 9) asked for
fixes on the canonical build before the next blind round. The file before this step is
`build/rosace_wh1.blend` (sha256 `292d672d...`, = 3.6g's `rosace.blend`, with `_build.json`), and its
stills are kept as `build/renders/whole_r1/` (the round-2 control). `rosace.blend` is now sha256
`23545647...`.

- **Build** (`integrated.json` build):
  - `bust: S7`: the figure-pose lane's shape key (3.6f; +42% volume, lift 4°, projection 0.22),
    applied by `figure_shape.apply` after the AO bake, the same way the lane made
    `lanes/figure-pose-base.blend`. Solved k 0.0568; rest profile side projection 11.76 px, shelf 2.99.
    `figure_shape.py build` on the canonical file now stops with a message: use
    `--src build/rosace_wh1.blend` for a variant on the pre-bust base.
  - `waist_pinch: {amount: 0.25}` (was the 0.17 default): the critique's "another 2 px at 144".
- **Stills**: step 9b of `stills_v2.py` runs `wh2_px.py` on `still_hands` (palette codes) and writes
  `still_wh2` before the remap. Steps, in order:
  - `face`: the features are re-anchored on facepass per still. The old stamp's features are erased
    on the painted face (the head id plus the skin and eye codes connected to it), and the skin is
    cleaned to S1-S3 with no 1-2 px specks. Then the eyes (FC-P34 fit), a 1 px S3 nose, 2 px SB
    blush per cheek (144 only) and the mouth (FC-P32) are stamped from `faces/wh2.json`'s
    expression table (FC-P33).
  - `facehair`: FC-N29 enforced.
  - `hair`: HR-N08 despeckle, I4 folded into I3, clump separators on hair part-id borders (the
    farther clump's edge px), and the HR-P22 sheen arc.
  - `tips`: the tail's A4 prongs step down to A3, with A4 only on end pixels.
  - `ornament`: the crown pin is a 3x3 cluster, 2x2 at 80, placed there from the 144 still.
  - `hands`: the constructed fists' S1 becomes S2.
  - `skin`: the thighs are banded as cylinders, with a crease over each stocking band, a knee cap
    at each knee landmark, and at 80 one I2 sheen line on each leg.
  - Each still gets a `wh2.json` with the notes and the face checks.
- **Measured**: every still (5 x 2 sizes) passes the mouth and open-eye checks, with 0 hair px left
  on the face interior. Colours are 34 at 144 and 30-32 at 80, the same or fewer than round 1.
- **Blind set** `review/rosace/art/whole/round-2/`: `whole_sheets.py --round round-2 --seed 20261001
  --control renders/whole_r1 --control-blend rosace_wh1.blend`. The seed resolved to 20261006, so
  the letters differ from round 1 (ours E, control C). Pose freshness is clean.
- **Not done** (ART-RULES 10, WH2):
  - N1's rear fist on the hip with a 24-30 px spread (a pose change)
  - the idle head tilt
  - authored clump outlines with tapered tips
  - side locks that stop above the jaw
  - frames: `motion_finish.py` has no wh2 pass yet, so motion frames keep the old faces

```sh
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/build_rosace_v2.py
python tools/pixel-pipeline/stills_v2.py            # renders + every lane pass + wh2 (about 2.5 min)
python tools/pixel-pipeline/stills_v2.py --no-render   # the pixel passes only (about 30 s)
python tools/art-construct/wh2_px.py --still <render>/<still>/px144 [--only face,hair]   # one still, still_hands -> still_wh2
python tools/pixel-pipeline/whole_sheets.py --round round-2 --seed 20261001 --control <build>/renders/whole_r1     --control-blend <build>/rosace_wh1.blend --control-doc "the round-1 integrated still"
```

### 3.6i Route F2: head scale after the build (finish lane) [trial 2026-09-29; pick H110E, not promoted; `tools/pixel-pipeline/finish_f2/`]

A trial of "proportions for pixel appeal": the head (skull, face and hair together) scaled by 1.10, 1.15
and 1.20, with the 144 px eye stamps one column and one row bigger. Nothing is baked into `rosace.blend`
(sha256 `23545647...`, unchanged). The scale is applied at pose time, so it works on every pose file.

- **How the scale is applied** (`head_scale.py`, run inside Blender by `bl_run.py` around an unchanged
  pipeline script such as `gh_render.py`, `author_faces_pass.py` or `render_rosace.py`):
  - `posing.apply_pose` is swapped for the figure-pose lane's applier (`figure_pose.apply_pose`, used
    read-only). That applier gives identical bones on the canonical poses (PS-P22), and the appeal poses
    need it.
  - `J_Bip_C_Head.scale` and `J_Bip_C_Neck.scale` are added to the pose's `bones` scales stage, which
    runs before the drape. The head scales uniformly about its joint at the top of the neck (level with
    the mouth at rest, so the chin drops under 0.5 px). The neck gets wider by 40% of the head's gain
    (1.20 → 1.08) and keeps its length (`neck_l` 1.0). The head's own scale is divided by the neck's,
    so the head ends up exactly `head`.
  - Everything skinned to the head subtree comes with it: head skin, the MMD face features (so
    facepass re-anchors the stamps on the bigger face), the hair cap and clump roots, side locks, veil
    and crown pin. Back hair and the tail keep their length; the weights blend the join. The neck join
    and collar read clean at x6 on all three sizes.
  - `fit_h` (on by default) keeps H at 144 / 80: `rosace_height` rises with the crown (+1.5% at 1.10,
    +3.0% at 1.20), so the body renders that much smaller and the head gains the rest in px.
- **Base:** the canonical build posed with the figure-pose lane's newest `idle_appeal.json` /
  `back_appeal.json`, plus the canonical `n1_contact.json`. The bust is shape.json's `current` (S7),
  which the canonical build already carries (3.6h). The pose files are snapshotted into
  `lanes/finish-F2/poses/` (sha1 in `_poses.json`: idle `a89be9fabdd7`, back `d65ee47e75d8`, n1
  `7530082156ab`).
- **Chain** (`stills_f2.py chain`): the integrated stills chain of 3.6g/3.6h with the canonical picks,
  with three differences:
  - The appeal poses borrow `idle_hero_144` / `n2_pivot_144`'s override ops. Their patches are STALE
    there and skipped.
  - Constructed hands run only where a hand spec exists (N1). There is no appeal-pose hand spec yet.
  - wh2 reads `<variant>/_faces.json`, which is `wh2.json` plus `faces_f2.json`: expressions for the
    two appeal poses and, on `E` variants, the bigger 144 eye stamps. The 80 px eyes are unchanged,
    because one pixel there is +33%.
- **Measured** (`lanes/finish-F2/measure.json`; hair top to chin ÷ hair top to sole). Refs 07/08/09/04 are
  0.20 / 0.18 / 0.17 / 0.14, with heads of 27-28 px (art-rules/finish-gap.md 2.5):

  | | H100 (control) | H110 | H115 | H120 |
  |---|---|---|---|---|
  | idle 144: head px / ÷ H | 25.7 / 0.181 | 27.6 / 0.195 | 28.6 / 0.201 | 29.5 / 0.208 |
  | idle 80: head px / ÷ H | 14.4 / 0.182 | 15.5 / 0.196 | 16.0 / 0.202 | 16.5 / 0.209 |
  | back 144 ÷ H | 0.174 | 0.188 | 0.194 | 0.201 |
  | N1 144 ÷ H (crouched, H = hair top to sole) | 0.233 | 0.248 | 0.261 | 0.268 |

  The appeal idle's tilted, chin-down head measures 25.7 px, against the old idle's 28. That leaves it
  about 2 px under ref 07, and 1.10 gives the 2 px back. Colours are unchanged: 32-34 at 144, 29-32 at
  80.
- **Pick: H110E** (head 1.10 with the bigger eyes). It won the blind idle set, was one of the top two on
  N1 and sat mid-pack on the back view. I judged the sheets before reading `key.json`; it is one judge,
  not a critic round. H120E came last in the idle set: the head reads big against 07/09 at 1x and 80 px.
  H115E was next to last. Blind sheets, silhouettes, head crops and `key.json` are in
  `review/rosace/art/finish/F2/`, with the kept stills in `kept/`.
- **Lane file:** `lanes/finish-F2.blend` is `rosace.blend` with `idle_appeal` posed at head 1.10. It is
  for inspection only: re-posing it resets the scale. Renders go through `stills_f2.py`.
- **Not done / open:**
  - The back glance draws a full two-eye front face (wh2 `face` sees no profile at that head turn). It
    is the same in every variant, including the control.
  - The appeal poses have no constructed hand specs.
  - N1's head ratio is high by construction (a crouch).
  - Promoting the pick means a `head` entry in `integrated.json` that `stills_v2.py` and `gh_render.py`
    read. That isn't built: the scale lives only in `stills_f2.py`.

```sh
# renders (Blender, one at a time; 4 keys x 3 stills x (render + facepass) ~3 min), pixel chain (~12 s/variant), measures
python tools/pixel-pipeline/finish_f2/stills_f2.py render --keys H100,H110,H115,H120
python tools/pixel-pipeline/finish_f2/stills_f2.py chain --variants H100,H100E,H110,H110E,H115,H115E,H120,H120E
python tools/pixel-pipeline/finish_f2/stills_f2.py measure
# blind sheets + key.json + kept/ (review/ only: refs are third-party)
python tools/pixel-pipeline/finish_f2/sheets_f2.py --kept H110E
python tools/pixel-pipeline/finish_f2/sheets_f2.py --labelled --set H100,H100E,H110,H110E,H120E
# the lane file (inspection)
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/finish_f2/bl_run.py -- --head 1.10 \
    --script tools/pixel-pipeline/finish_f2/save_lane.py --blend D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend \
    --pose D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F2/poses/idle_appeal.json \
    --save D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F2.blend
```

### 3.6i Route F1: the hi-bit painterly finish [lane, built 2026-09-29; not promoted; `tools/pixel-pipeline/finish_f1/`]

A second way to get from the 3D model to pixels. It changes how she is **rendered**, not the model: the
canonical `rosace.blend` (read-only; bust = `shape.json` `current`, S7, checked at start) posed with the
figure-pose lane's newest appeal poses through its applier (`figure_pose.apply_pose`, used as a library), a
painterly material branch in Blender, a render at 4x, and a pixel pass that downsamples, builds an adaptive
palette, draws a selective coloured outline and cleans up. It replaces the whole integrated stills chain
(3.6g-3.6h) for the shots it renders; it reuses only round WH2's authored face stamps. No image generation
anywhere: every pixel comes from the model, the material data or authored stamps.

- **Painterly material** (`f1_blender.py`, data in `finish_f1/f1.json`): a `pass_f1` emission branch added to
  every palette material, beside the existing passes (materials.py's `set_pass("f1")` renders it). It takes the
  toon ramp input v (3.5), adds brush noise (world-position noise, feature about 2.5 sprite px, amplitude
  `tex`), a warm reflected-light lift on down-facing shadow (`bounce`, skin and white), a cavity push
  (`cav` x (1 - ao)), then a **6-tone ramp** per material whose tone boundaries are widened by `soft` (0 = hard
  cel bands, 1 = linear between tone centres), the render's spec band, and a rim on grazing normals facing the
  upper back (the side away from the key light, `#99d6ff` screened in, never white; PX-P34). The ramps carry the
  FG1 chroma budget: near-neutral blue-black stockings and boots, grey-lavender white shadows, a darker and
  greyer indigo on the hair and haft, 6 skin tones with shadow S <= 0.30, gold desaturated in the darks;
  saturated colour only on the glass, the azure tips and the stamped eyes.
- **Looks** (Blender side): `cel` (soft 0, no texture: the control), `soft` (0.5, tex 0.05), `paint` (0.85,
  tex 0.10). One Blender process renders every shot, size and look: 3 shots x 2 sizes x (6 passes + 3 looks)
  in about 20 s.
- **Pixel pass** (`f1_post.py`), per preset (look + palette size + AA):
  1. Downsample 4x -> 1x. Alpha where >= 45% of the block is figure (binary: the silhouette is never
     anti-aliased, PX-N04). Label = the block's weighted mode (thin gold, edge, glass, thong and tips win
     ties). Colour = the linear-light mean of the winning label's sub-pixels, blended by `aa` toward the mean
     of all the block's figure sub-pixels only where the block holds more than one label (interior AA).
  2. Adaptive palette: k-means in OKLab per material group (skin, white, dark, hair, haft, gold, steel,
     accent; shares in `GROUP_SHARE`) with the budget `palette - 8` (the lines and face add about 8); each
     cluster keeps a real rendered colour (the member nearest its centre), near-duplicates (OKLab < 0.02)
     merged.
  3. Cleanup: 1 px material orphans; salt-and-pepper (no same-colour 8-neighbour and > 0.09 OKLab L from the
     neighbours' median); 2x2 checkers broken (again after the lines and face, PX-P23); face-skin clusters of
     <= 2 px merged (the refs' faces are 2-3 clean tones).
  4. Lines: the outer ring outside the silhouette. Ground side and the side away from the key light: the
     tinted near-black `#16131d` (V 0.11). Lit side: the material's own darkest tone (sel-out), or for the dark
     materials (stockings, boots, hair, haft) their third-darkest tone, so their lit edge is not black. Skin:
     its darkest tone x 0.8 (lit) or x 0.62 (shadow), a warm umber (PX-P38). Inner lines where another part
     occludes with a depth step (1.8 cm; 1.2 cm hair on hair), on the farther pixel in its darkest tone pulled
     a quarter toward the line colour; dots and 1-2 px line fragments dropped.
  5. Face: `wh2_px.step_face` (round WH2's stamps and expression table) on a minimal adapter, placed on this
     render's own facepass (`f1_blender.py` writes `facepass.json` with author_faces_pass.py's code, because
     that script poses with posing.py and would drop the appeal poses' figure block). Stamp codes are
     recoloured into the F1 palette (skin codes by lightness rank among the skin tones in use).
  6. Thong: each string component thinned to 1 px across its run and drawn in the line colour (DESIGN 3.5
     item 5); the removed pixels take their neighbours' colour.
- **Presets** (`f1.json`): P0 cel / 32 / AA 0 (control), P1 soft / 40 / 0.5, P2 paint / 48 / 0.5, P3 soft / 32
  / 0.25, P4 paint / 40 / 0.35 (added after the first measures). **Pick: P4.**
- **Measured** (`review/rosace/art/finish/F1/metrics.md`, finish_metrics.py plus colour count and PX-P23's
  two-way dither measure, 6 stills per preset, 10 targets each): control (the integrated canonical stills)
  11/60; P0 41, P1 43, P2 43, P3 45, P4 44. The pick at 144 (idle / N1 / back): median S 0.26 / 0.29 / 0.27
  (control 0.43-0.51), chromatic 0.70 / 0.78 / 0.72 (control 0.87-0.91), accent 1.1-1.5% (control 12-15%),
  ring near-black 0.50-0.55 (control 0.73-0.90), skin 5 tones, dark cloth 3-4 tones, banding 2.3 / 2.7 / 5.1
  per 1,000 px (control 6.1-6.3), weighted cluster 38-45 px (control 32-57), L* 20-35 share 15-23% (control
  6-10%), 0 dithered areas. At 80: median S 0.26-0.32, chromatic 0.67-0.72, banding 3.3-6.1 (control
  7.8-15.6). What it misses: PX-P15 (43-45 colours at 144, 38-40 at 80; P3 36-38), PX-P39's chromatic share
  on N1 (skin and gold alone are about 70% there), the back still's banding (5.1), and cluster size (refs
  18-27; P2 reaches 27-38 at 48-52 colours).
- **Not in F1:** the lane pixel passes of 3.6g-3.6h (outfit glyphs and windows, constructed hands, hair
  sheen arc, collar cross, the painted thigh cylinders). Hands come from the 3D. Motion frames aren't
  rendered through F1.
- **Blind set** `review/rosace/art/finish/F1/` (git-ignored: it holds third-party refs): idle, N1 and back at
  144 (refs native) and 80 (refs resampled, WF-P15), x3 and x1, letters A-I (P0-P4, the control, refs 07, 09
  and 04), `key.json` (seed 20261010, pose sha1s, sources), silhouettes, the labelled pick sheets in
  `_labelled_not_for_blind/` and the pick's stills in `pick/`. Ours and the control stand on a contact shadow
  (WF-P16). The pick was made by the lane (not blind); the blind sheets are for a critic (WF-P11).

```sh
# one Blender process: every shot, size and look (about 20 s), then the pixel pass, the measures and the sheets
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
    --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/finish_f1/f1_blender.py -- render \
    --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F1/renders --shots idle,n1,back --px 144,80 \
    --looks cel,soft,paint
python tools/pixel-pipeline/finish_f1/f1_post.py --root D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F1/renders --preset P0,P1,P2,P3,P4
python tools/pixel-pipeline/finish_f1/f1_sheets.py metrics --presets P0,P1,P2,P3,P4
python tools/pixel-pipeline/finish_f1/f1_sheets.py sheets --presets P0,P1,P2,P3,P4 --seed 20261010
python tools/pixel-pipeline/finish_f1/f1_sheets.py pick --pick P4
# the lane file (idle_appeal applied, the f1 branch on the Surface output, look 'paint'); never rosace.blend
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
    --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/finish_f1/f1_blender.py -- render \
    --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F1/lane_check --shots idle --px 144 --looks paint --save-lane
```

### 3.6j Route F3: mass and silhouette [lane, built 2026-09-29; pick L, not promoted; `tools/pixel-pipeline/finish_f3/`]

A trial of "big cloth shapes" (finish-gap.md 2.5: her mass, body area ÷ H² with the glaive out, is 0.23
against 0.28-0.35 on refs 07/08/09; 04 is 0.17). It changes the **model's cloth and hair and their drape**,
not the render: bigger bells with the indigo lining turned out, a longer and wider front tabard with pipe
folds, hair and veil volume past the skull, and drape patches that put the new mass outside the legs.
Nothing is baked into `rosace.blend`; the lane file is `lanes/finish-F3.blend` (variant L), and the
variant builds are `lanes/finish-F3_<v>.blend`.

- **How it builds without editing the part builders.** `finish_f3/bl_build.py` imports
  `finish_f3/overrides.py`, which swaps `outfit_art.sleeves_r2` and `outfit_art.tabard_r2` for
  parameterised copies (same object names, parts, chains, materials and anchors) and registers a
  `hair_v3` variant `f3` (r2f with F3's volume, set through `ROSACE_HAIR`). Then it runs
  `build_rosace_v2.py` unchanged with `--out` on the lane file, so everything else is the integrated build
  (`integrated.json` `build`). The bust is `shape.json` `current` (S7), read through
  `figure_shape.variant_params`; if the figure-pose lane moves `current`, the build follows it.
- **Poses.** The figure-pose lane's newest `idle_appeal.json` and `back_appeal.json` (and
  `n1_contact.json`) are snapshotted once into `<renders>/finish-F3/_poses/` (sha1 in `poses.json`:
  `a89be9fabdd7`, `d65ee47e75d8`, `7530082156ab`, all still current at the end). A variant's drape patch
  (`finish_f3/drape_f3.json`) is deep-merged over the snapshot, only in the `drape` block, as the outfit
  lane's `pose_patches.json` is at integration. The pose files are never edited.
- **The stills chain on appeal poses.** `finish_f3/bl_run.py` puts `figure_pose.apply_pose` (read-only,
  as a library) behind `posing.apply_pose` for appeal poses, then runs `gh_render.py` and
  `author_faces_pass.py` unchanged. `finish_f3/run_f3.py` then runs `stills_v2.py`'s steps 4-10 with two
  changes: the hand spec is used only if one exists for the pose (none do for the appeal poses, so the
  appeal hands stay 3D), and wh2's face table is keyed by the pose's hero (`idle_appeal` → `idle_hero`,
  `back_appeal` → `n2_pivot`). About 70-100 s per variant (build + 3 stills × 2 sizes).
- **Variants** (`finish_f3/variants.py`; build values in metres at the build scale):

  | Variant | Bells (bell / hang lip / turn-out) | Tabard (length / half-width at hem) | Hair | Drape | Result |
  |---|---|---|---|---|---|
  | control | 0.092 / 0.17 / 0.022 | mid-shin (0.52) / 0.092 | r2f | pose | mass 0.229 idle 144 |
  | A | 0.125 / 0.21 / 0.040 | 0.80 / 0.128 | r2f | pose | the tabard fills the idle's leg gap: the λ goes |
  | B | as A | as A | + crown 1.28, ear 1.33, clumps ×1.2-1.4 | pose | the hair adds about 1 px |
  | C, D | A's or 0.150 / 0.25 | 0.82 / 0.140, split into two tails from 55% | B's or bigger | pose | tails read as gold-edged spikes and extra legs; the back view's long tabard is a third leg (CL-N05) |
  | E, G | 0.160 / 0.30 / 0.050 | 0.70 / 0.118 | B's / D's | p1: hair and near bell blown behind the hip, veil lifted | the veil point stands out as a horn; the tail pokes out of the hip as a ribbon with a claw of azure tips |
  | H | as E | as E | B's | p2: hair swept less | the same tail read |
  | K | as E | as E | B's | p4: N1's far bell trails back | the bell's lining still over the chest in N1 |
  | **L (pick)** | **0.160 / 0.30 / 0.050** | **0.70 / 0.118, pipe folds** | **B's** | **p5** | **mass 0.265 idle 144, 0.28 at 80** |
  | M | as L | as L | D's | p5 | no visible gain over L, more flicks at the head |
  | N | A's | as L | B's | p5 | mass 0.250: a step less |

  Drape p5: idle, the near (hip-hand) bell blows back (`sleeve_R` g 0.8, wind -0.22, 0.3, 0), so it widens
  the silhouette behind the hip and shows a lining crescent instead of hanging over the hip curve; back
  view, the tabard swings forward and toward the free leg (`tabard` g 0.7, wind 0.25, -0.6, 0), out of the
  leg gap; N1, the far bell hangs (`sleeve_L` g 0.9, wind 0.2, 0.5, 0), because N1's fling (g 0.25) turned
  the bigger bell's dark lining over the chest and bust.
- **Measured** (`review/rosace/art/finish/F3/metrics.json`; body area ÷ H², glaive out, as `finish_metrics.py`):

  | Still | Control 144 / 80 | L 144 / 80 | Skin in the torso band, L ÷ control | Stocking px, L ÷ control |
  |---|---|---|---|---|
  | idle | 0.229 / 0.244 | **0.265 / 0.280** | 1.08 / 1.10 | 0.99 / 0.99 |
  | N1 | 0.290 / 0.315 | 0.304 / 0.324 | 0.87 / 0.80 | 1.00 |
  | back | 0.214 / 0.231 | 0.228 / 0.248 | 0.87 / 0.85 | 1.01 / 1.05 |

  The colour count is unchanged (33-34 at 144, 30-31 at 80) and all 6 stills are on-palette. The idle's
  lower-body row widths don't change (0.18-0.34 H at 0.6-0.8 H): with the wide appeal stance the legs set
  the width, and cloth added in front of them only fills the λ.
- **Not reached.** The idle is at 0.265, just under the 0.27-0.30 target, and the back view at 0.228. The
  back's near bell covers part of the hip (torso-band skin 0.87 of the control), and N1's hanging far bell
  covers the waist. The hair swing that would have reached 0.28 (E, 0.278) failed on the tail read (HR-N09).
- **Blind set** `review/rosace/art/finish/F3/`: idle, N1 and back at 144 (x3, x1) and 80 (x4, x1), with
  black-fill silhouettes. Candidates are control, L, M and N beside refs 07, 09 and 04 (the finish-gap.md
  crops; the 80 px refs are box-resampled to an 80 px figure and snapped to their own 32-colour palette).
  The shuffle follows WF-P15 with seed 20261003; `key.json` holds the letters. Ours stands on its contact
  shadow (WF-P16). Labelled look sheets are in `look/`. Not judged yet.

```sh
# one variant: build + idle/N1/back at 144 and 80 through the integrated chain (one Blender at a time)
python tools/pixel-pipeline/finish_f3/run_f3.py --variants L        # [--no-build] [--no-render] [--only idle,n1,back]
# the lane file (the pick)
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/finish_f3/bl_build.py -- --variant L --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F3.blend
# measures, labelled look sheets, blind sheets
python tools/pixel-pipeline/finish_f3/sheets_f3.py metrics --variants control,L,M,N
python tools/pixel-pipeline/finish_f3/sheets_f3.py look --variants control,L,M,N
python tools/pixel-pipeline/finish_f3/sheets_f3.py blind --variants control,L,M,N --seed 20261003
```

To promote L: the `sleeve`, `tabard` and `hair` values go into the outfit and hair lanes' own builders
(or `integrated.json` gains an F3 block that `build_rosace_v2.py` applies through `overrides.install`),
and p5's drape keys go into the pose files through their owners (figure-pose for the appeal poses,
glaive-hands for `n1_contact`).

### 3.6k Finish-routes judging set [built 2026-09-29; `tools/pixel-pipeline/finish_judge/judge_sheets.py`]

One blind set for the three finish routes against the current build; it builds nothing and renders nothing.

- **Entries.** F1 = pick P4 (`lanes/finish-F1/renders/<still>/px<N>/P4/still.png`), F2 = pick H110E
  (`lanes/finish-F2/v/H110E/...`), F3 = pick L (`renders/finish-F3/L/...`), current = `renders/finish-F3/control/...`
  (the integrated build and stills chain with no route overrides, in the same poses). All four are posed from
  `idle_appeal.json` a89be9fabdd7, `n1_contact.json` 7530082156ab, `back_appeal.json` d65ee47e75d8 (F3 plus its
  drape patch), same camera, bust S7.
- **Same shadow (WF-P17).** F1 has no chain shadow, so the script draws `rosace_shade_stills.ground`'s ellipse
  with `shading_r3g.json`'s `ground` spec from F1's boot ids; on the six current stills that code reproduces
  `still_ground.png` pixel for pixel. The remaining confound (F1 and F2 lack the weapon pass on the appeal idle
  and back) is listed in key.json.
- **Sheets** (`review/rosace/art/finish/judge/`, git-ignored): idle 144 x3 and x1, idle 80 x3 and x1, N1 144 and
  80 x3, back 144 and 80 x3, black-fill silhouettes (idle 144 and 80, N1 144, back 144), refs 07/09/04 at their
  native grid for 144 and resampled per WF-P15 for 80 (`finish_f3/sheets_f3.ref`). One letter mapping A-G for
  all sheets; the seed and the shuffle rule are in key.json.

```
python tools/pixel-pipeline/finish_judge/judge_sheets.py --seed 20261029
```

### 3.6l Drive 9: the combined build (F3 mass + F2 head + figure-pose appeal poses and bust + F1 finish, re-tuned) [lane, built 2026-09-29; not promoted; `art/rosace/drive9.json`, `tools/pixel-pipeline/drive9/`]

This step stacks the levers the finish-routes judges kept (3.6k: refs 9, F2 5.9, current 5.6, F3 5.4, F1 5.0) in one
build and one render chain. Nothing is baked into `rosace.blend` (sha256 `23545647...`, unchanged). The lane file is
`lanes/drive9.blend`, and the pick file is `art/rosace/drive9.json` (`integrated.json` is not touched). Every
pick has a reason under `why`.

- **The order, and where each lever lives:**
  1. **Model** (`drive9/bl_build.py`): route F3's pick L is installed through `finish_f3/overrides.install`,
     used as a library. That gives ref-14 bells, the mid tabard with pipe folds and hair volume. Then
     `build_rosace_v2.py` runs unchanged with `--out lanes/drive9.blend`. The bust is `shape.json`'s `current`
     (S7), read at build time the same way F3 reads it. The build takes 20 s.
  2. **Pose and head** (`drive9/d9_blender.py`, at render time):
     - The figure-pose lane's newest `idle_appeal.json` / `back_appeal.json` (concept A) go through its applier,
       `figure_pose.apply_pose`, used read-only. `n1_contact` and `q_stamp` are the canonical poses.
     - F3's drape patch p5 (`finish_f3/drape_f3.json`) is deep-merged over each pose.
     - F2's head scale comes from `finish_f2/head_scale.install`: head x1.10 about the neck-top joint, neck width
       +4%, H refit.
     - `--head` and `--drape` (`<shot>=<patch|none>`) trial other values.
  3. **Finish** (`drive9/d9_post.py`, numpy only): route F1's method with the look moved out of Blender, so every
     colour decision can be re-tuned in seconds.
     - Blender renders the passes only at 4x: id, normal, depth, light (R = the toon ramp input v, G = ao, B = the
       spec band), beauty, and a new **noise** pass. Noise R is brush noise (about 2.5 sprite px) and G is strand
       noise stretched along world z (about 1.2 px), both on the world position.
     - Paint at 4x: v' = v + tex(brush) + strand(strand) - cav(1 - ao) + bounce, raised to a per-material gamma
       (the low-key push). Each material's ramp (`drive9/d9_finish.json`) is OKLab-interpolated between 5-11
       hue-shifted stops anchored on the current build's colours. The spec band mixes toward the material's
       spec colour.
     - The face skin (head part) takes no texture and a lifted input (`face.lift` 0.32). The refs' faces are
       2-3 clean tones.
     - Downsample with `f1_post.downsample` (hard silhouette, interior AA 0.35 only between materials).
     - Per-material k-means to `tones` (5-10) colours. Blocks that hold two materials snap to the whole palette
       (the AA in-betweens).
     - F1's cleanup.
     - Lines: the ring is always there. On light materials the lit side takes the material's deepest ramp stop,
       so white keeps a dark line against the grey ground. Dark materials take their third-darkest tone. Skin
       takes a warm umber. Inner occlusion lines as in F1.
     - The **hair angel ring**: the spec band's 1x coverage >= 0.3 becomes a core tone with a 2-tone halo.
     - **Bust**: a cleavage wedge where the bodice's screen-space normal x flips by >= 0.45 between the apexes
       (the side facing away from the key light; 2 px at the top, extended up to the neckline). An underbust
       shadow goes on the first non-bodice pixel under the bodice, and bodice pixels facing down
       (n_y < -0.35) step toward the mid shadow.
     - A **1 px rim** on the silhouette edge that faces the rim direction (screen upper left). The render's
       normal has to agree. The rim is screened toward a per-material colour: cool `#9fdcff`, hair lavender
       `#c8b6ff`, skin warm `#ffd9b0`. It is never white.
     - Round WH2's face stamps plus F2's appeal expressions and the bigger 144 eyes (`faces_f2.json`). The
       stamped blush is redrawn soft (a 55% core and a 22% ring).
     - `requant`: each material's colours are folded back to `tones` + 3, with the face and lines kept.
     - The thong goes to 1 px in the line colour (`f1_post.thong`; DESIGN 3.5 item 5).
     - The chain's contact shadow is drawn with `judge_sheets.f1_grounded`.
- **Clashes settled by side-by-side** (`review/rosace/art/drive9/combined/trials/`):
  - **Head 1.10 against 1.15.** Head ÷ H on the combined stills: H110 idle 0.195 (27.6 px), back 0.188;
    H115 0.201 / 0.194. The refs run 0.14-0.20. The judges' "1/6, 24-25 px" would mean a smaller head than now.
    By eye H115 gains nothing, and F2's blind set had it next to last. **1.10 kept.**
  - **The dark hip lobe** (the judges split). Rendering with the near bell hanging (`--drape idle=none`)
    changes almost nothing: the lobe is the bigger F3 bell's lining. It is kept, with a 7-step lining ramp and
    strand texture.
  - **F1's palette against the current identity.** Ramps are hue-shifted around the current anchors
    (saturated violet hair, true gold with an orange-brown shadow and a near-white-yellow spec, lilac-shadowed
    white, dark violet-black stockings with a sheen near v 0.9). Nothing is desaturated. The first white ramp
    put the lit cloth at lavender mid tones (the white's median v is 0.44), so the white stops were moved to
    near-white from v 0.40.
  - **The skin terminator.** A wide red-orange band turned the back view's shadowed skin brick-red. The
    terminator is now a narrow step (v 0.20-0.29), with cool rose shadows below it.
- **Measured** (`drive9/d9_metrics.py` → `lanes/drive9/metrics.json`; combined, with current in brackets):

  | Still | Colours 144 / 80 | Mean HSV S 144 / 80 | V < 0.35 share 144 / 80 | Mass 144 / 80 |
  |---|---|---|---|---|
  | idle | 152 / 118 (33 / 30) | 0.451 / 0.431 (0.458 / 0.476) | 0.323 / 0.369 (0.336 / 0.372) | 0.264 / 0.277 (0.229 / 0.244) |
  | N1 | 156 / 141 (33 / 31) | 0.482 / 0.461 (0.482 / 0.504) | 0.361 / 0.391 (0.383 / 0.436) | 0.310 / 0.331 (0.290 / 0.315) |
  | back | 149 / 125 (34 / 31) | 0.459 / 0.451 (0.475 / 0.491) | 0.394 / 0.418 (0.369 / 0.399) | 0.228 / 0.242 (0.214 / 0.231) |

  Saturation holds at the current level at 144 (F1 was 0.26-0.29). The low-key share is at or within 0.04 of
  current, but it is not above it: the judges asked for more. A 1 px rim runs on 255-340 px per 144 still.
  The cleavage covers 12 rows on the idle and Q; the back and N1 show no bust valley.
- **Motion** (`drive9/d9_motion.py`, `d9_motion_bl.py`): the motion lane's integrated N1 (`n1_r3c_integrated`
  npz and hero sheet, read-only) runs through `tools/motion-ai/blender_apply.py` unchanged on `drive9.blend`.
  Hooks on `render.setup_shot` / `render_passes` add the head scale, the noise pass and per-drawing still
  passes. `d9_post.py` then runs on every drawing. 19 drawings at 144 and 80; strips, grids and GIFs are in
  `review/rosace/art/drive9/combined/motion/`. The finish works on frames, faces included.
- **Not in drive 9** (confounds in the blind `key.json`):
  - The integrated chain's pixel passes: the constructed hands and weapon (N1's glass blade crescent), the
    outfit glyphs and windows, and the collar cross.
  - `smear.py` on the frames (it needs 1x depth/beauty sequences).
  - The stance fix, which is the figure-pose lane's (idle knees still cross inward).
  - The back glance still stamps a two-eye front face.
  - The veil flips over the head in N1's wind-up frames. The motion lane's spring does this in the current
    build too.
- **Review** (`review/rosace/art/drive9/combined/`, git-ignored):
  - `stills/`: idle, N1, Q and back at 144 and 80, x1, zoomed, on the ground, silhouettes.
  - `look/`: labelled current, F1, F2, F3, d9 and refs.
  - `blind/`: d9, current, 07, 09, 04, plus native **ref 05** at 80 (the judges' protocol fix;
    `d9_view.ref05`), with `key.json`, seed 20261109.
  - `motion/`, `trials/`, `metrics.json`.
  - By eye, not blind: d9 beats current on finish at both sizes (ramps, texture, rim, skin, stockings) and on
    mass. It is still lighter and cleaner than 07/09, and the face drawing is unchanged.

```sh
# model (one Blender): F3 L on the integrated build -> lanes/drive9.blend
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/bl_build.py
# passes (one Blender, ~25 s for 4 shots x 2 sizes at 4x); --head / --drape trial other values
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
    --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/H110 --head 1.10
# finish (numpy, ~4 s), measures, review sheets
python tools/pixel-pipeline/drive9/d9_post.py --root D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/H110
python tools/pixel-pipeline/drive9/d9_metrics.py
python tools/pixel-pipeline/drive9/d9_sheets.py
# N1 motion through the same finish (one Blender per size, ~75 s at 144)
python tools/pixel-pipeline/drive9/d9_motion.py [--px 144,80] [--no-render]
```

### 3.6m Drive 9 whole-character round 1: the blind set [sheets built 2026-09-29; `tools/pixel-pipeline/drive9/d9_round.py`]

The first blind whole-character round on the drive-9 build (3.6l). It builds and renders nothing: it reads the 3.6l
stills (`lanes/drive9/raw/H110/<shot>/px<N>/D1/still_ground.png`) and lays them out beside the refs and the control.

- **Pose check first.** The figure-pose lane has produced no newer pose since drive 9 rendered: `idle_appeal.json`
  (sha1 `a89be9fabdd7`, 15:35) and `back_appeal.json` (`d65ee47e75d8`, 15:36) are still its newest promoted files, and
  its R3 work files (15:54) were never promoted. So drive 9's stills are current and nothing was re-rendered. key.json
  records the freshness per shot: ours, the control and the pose file agree on all four.
- **Entries, one letter mapping A-G (WF-P13):**
  - ours = drive 9;
  - control = the current build in the same poses (`renders/finish-F3/control` for idle, N1 and back;
    `renders/integrated/q_stamp` for Q);
  - refs 07, 08, 09 and 04, each on its crop closest to the pose (`whole_sheets.CROPS`, with pose_match in key.json);
  - ref 05 at its own 1x, on the 80 sheets only. That means the 144 sheets show six letters.
- **The shuffle (WF-P15)** moves every entry off its listed place and keeps ours and the control apart. Seed 20261201
  passed on the first try.
- **144 sheets:** refs at their native grid, x3 and x1.
- **80 sheets:** refs 07, 08, 09 and 04 box-resampled to an 80 px figure and snapped to 48 colours
  (`whole_sheets.ref_world`), plus ref 05 in the frame closest to the pose (99-102 px tall; WF-P18). x3 and x1.
- **Ground (WF-P16):** ours and the control stand on the chain's contact shadow.
- **Codec diagnostic (WF-P16):** `diag_codec_idle_px144_x3.png` puts ours and the control through WebP q90. It is
  diagnostic only.
- **Ref 05 keying (WF-P18, changed):** only near-white connected to the box border counts as ground
  (`d9_view.key_white`). The old global white key punched 107-281 px out of each ref 05 figure (the white suit,
  gloves and highlights showed the grey backdrop), which made the native ref look broken beside ours.
  `d9_view.ref05` uses the new key too. The earlier `combined/blind/` sheets were built with the old key and were not
  rebuilt.
- **Confounds** (listed in key.json):
  - drive 9 lacks the chain's pixel passes: the constructed hands and weapon, the glyphs and the collar cross;
  - the back view's face is a front stamp;
  - the 80 px refs are resampled, and ref 05 is about 25% taller than our 80;
  - the control's Q comes from the integrated chain.
- **Output** (`review/rosace/art/drive9/round-1/`, git-ignored):
  - `<shot>_px144_x3/x1`, `<shot>_px80_x3/x1` for idle, n1, q and back;
  - `all_px144_x1`, `all_px80_x1`, `diag_codec_idle_px144_x3`, `key.json`;
  - `verdicts/TEMPLATE.json`: each critic fills a copy from the sheets alone (CRITIQUE-PARAMS 1-18 and 31 per letter,
    scored 1-10 where the refs' bar is 9) and only then opens key.json.
- **Not judged yet.** Whoever built the sheets has seen the key, so the verdicts must come from critics who have not.

```sh
python tools/pixel-pipeline/drive9/d9_round.py --round round-1 --seed 20261201
```

### 3.6n Drive 9 whole-character round 2: the critics' fixes, escalation 1, the blind set [built 2026-09-29; not promoted; `drive9/r2_model.json`, `r2_finish.json`, `r2_faces.json`, `r2_blender.py`, `d9_post.py`, `d9_round.py`]

Round 1's blind critics (3.6m; verdicts in `review/rosace/art/drive9/round-1/verdicts/`) scored drive 9 at 5-5.5 against
the refs' 9. This round applies their fixes to the drive-9 build and pushes the levers that were winning about 30%
further (ESCALATION 1), then pulls back what broke. Nothing is baked: `lanes/drive9.blend` and `rosace.blend` (sha256
`23545647...`) are unchanged, and the figure-pose lane's files are only read. `art/rosace/drive9.json` has a new
`round2` block with each pick and its reason.

- **Pose check first.** The figure-pose lane has promoted nothing new. Its newest files are still `idle_appeal.json`
  (`a89be9fabdd7`) and `back_appeal.json` (`d65ee47e75d8`), and its work files stop at 15:54. So this round uses the
  same concept A poses, with its own patches on top.
- **Render-time patches** (`d9_blender.py --r2 <json>`, library `drive9/r2_blender.py`). The json is
  `drive9/r2_model.json`, and every value's reason is in its `why`.
  - `mesh_edits`: the front tabard's rest mesh is widened in x, x1.3 at the waist to x1.65 at the hem (a flare). Its
    idle chain hangs straight (g 1.0, no side wind), so the tabard covers the crotch. The critics had said "the pelvis
    reads as one skin block: bottomless" and "the tabard reads as a sword".
  - `circlet`: a gold front diadem is built from the hair's own outer contour at the brow. The front sits at 1.775 m
    and the back at 1.845 m, on a 160° arc whose ends sink 2 cm into the hair. The band is 0.032 m tall, with a flat
    glass rosace jewel (gold rim and glasscore centre) at the front. All of it is weighted 100% to `J_Bip_C_Head`,
    so the head scale carries it.
  - `poses`: patches deep-merged over each pose by name, after the drape p5. The pose files are never edited.
    - idle: the concept A angles +30%: hips 6.5/19.5/5.2, torso bend -15.6/-6.5, upper chest 8, head tilt 16, chin
      10. The near wrist moves from the rest-frame [-0.15, 0, 1.22] to [-0.21, 0.09, 1.10], with the elbow pole
      [-0.9, 1.0, 1.3]. The near bell is scaled 0.78 and blown back. The free knee's pole moves out.
    - back: look amount 0.62, max 60. The head turns over the shoulder to three-quarter, and its facing toward the
      camera drops from 0.78 to 0.44.
    - q: the rear foot drops from 0.64 to 0.32 m, with the knee pole down, and the camera yaw goes 50 → 35.
  - New parts need the toon materials' `ao` point attribute, set to 1.0. Without it the light pass reads 0 and the
    part renders as the ramp's darkest stop.
- **Finish overlay** (`d9_post.py --finish drive9/r2_finish.json`). A finish json with `base` is deep-merged over that
  base (`load_finish`), and lists are replaced whole.
  - Tones per material go up about 30%: white 13, skin 12, hair 13, gold 11, and the dark cloth 9-10.
  - The ramps' top stops are capped under paper white: white `#eeeae8`, skin `#f6ddcc`, gold `#f6e4b0`, steel `#d2dcec`.
    The low-key gammas are 1.12-1.3.
  - A new per-material `chroma` scales OKLab a/b in the ramp (x0.8 on the dark cloth and haft, x0.85-0.9 on white,
    hair and gold). The hues stay (PX-P39).
  - The hair ramp is hue-shifted, with indigo darks and a pink-lavender top (`#b688cf`).
  - The rim is stronger on the dark materials (0.5-0.7).
  - The glaive gem is quieter, so the face leads.
  - `hair_clumps` (new step): where two hair part ids meet inside the hair, the darker pixel of the pair takes the
    hair ramp's rank-0.15 tone.
- **Face** (`r2_faces.json`, via `r2_faces` in the finish). One spec covers idle and back.
  - The eyes are new 144 stamps: a 4-tone iris under a lid that covers its top row, a 2 px catchlight plus a 1 px
    secondary, a tapered upper lash with an outer flick that lifts, and a rose-mid lower lash.
  - The smile is 4 px with a lifted corner at 144 and 3 px at 80.
  - The iris colours are a deeper blue ramp.
  - `profile_below` 0.3: when the far eye's 3D facing is under it, the face step draws one profile eye.
    `stamp_face` wraps `wh2_px.face_geometry` to do this. The back glance gets it, and so does N1, whose far eye
    faces 0.23.
  - `r2_face_paint`:
    - the fringe's bottom row takes a mid hair tone mixed toward the skin's shadow (it was a black 'brow' bar);
    - the skin row under the fringe takes a warm shadow, and the row below that a partial step;
    - hair pixels beside face skin take 1 px of AA;
    - the far cheek's edge goes one shadow step down;
    - brows are drawn where the fringe leaves skin (none does on these heads).
- **Trials** (`lanes/drive9/raw/r2_t1..t3`, `r2_va..ve`, `R2_H113`; sheets in `lanes/drive9/r2work/`):
  - The circlet: a full ring read as a hat brim, a 0.02 m band drew as outline only, and without `ao` it rendered
    black. The front diadem is kept.
  - The first eye stamp put the pupil tone on the iris top under the lid, which read sleepy. It is now dark blue.
  - Q: lifting the kicked leg higher made the side splay worse. The lowered rear leg with yaw 35 is kept.
  - The near hand: wrist [-0.19, 0.05, 1.14] (vd) against [-0.21, 0.09, 1.10] (ve). In ve the hand, elbow and waist
    gap read, so ve is kept.
  - Head 1.13 (ESCALATION's head lever) looks no different by eye at 144 or 80. The critics had measured the head at
    about 1/5, at or above the refs' 1/6. **1.10 kept.**
- **Measured** (`d9_metrics.py --d9 <raw>/R2 --tag R2` → `lanes/drive9/metrics_r2.json`, copied to `round-2/metrics.json`;
  round 1 in brackets):

  | Still | Colours 144 / 80 | Mean S 144 / 80 | V < 0.35 144 / 80 | Mass 144 / 80 | p90 V 144 / 80 |
  |---|---|---|---|---|---|
  | idle | 197 / 170 (152 / 118) | 0.409 / 0.397 (0.451 / 0.431) | 0.333 / 0.367 (0.323 / 0.369) | 0.273 / 0.281 (0.264 / 0.277) | 0.92 / 0.89 (0.97) |
  | N1 | 201 / 172 | 0.451 / 0.431 | 0.384 / 0.434 | 0.314 / 0.334 | 0.89 / 0.89 |
  | Q | 192 / 165 | 0.406 / 0.395 | 0.275 / 0.316 | 0.234 / 0.252 | 0.89 / 0.89 |
  | back | 194 / 156 (149 / 125) | 0.440 / 0.438 (0.459 / 0.451) | 0.416 / 0.458 (0.394 / 0.418) | 0.234 / 0.251 (0.228 / 0.242) | 0.88 / 0.89 |

  The idle p90 is still 0.92, because the widened white tabard is lit, and the back's saturation is still 0.44. Both
  miss PX-P45's targets.
- **Not in round 2** (the confounds, in `r2_confounds.json` and key.json):
  - the constructed hand stamps and two-hand grip, which the body critic asked to port first;
  - the glyphs, the collar cross and N1's blade crescent;
  - loose hair strands and curled clump tips;
  - smear on N1;
  - the motion lane's N1 frames, which were not re-run through the round-2 finish.
- **Blind set** (`d9_round.py`, new options `--prev-raw/--prev-tag` and `--confounds`). Eight letters are on one
  mapping, seed 20261301. The slots are ours (round 2), prev (round 1's drive-9 stills), the control and refs
  07/08/09/04, plus ref 05 on the 80 sheets. The shuffle keeps ours, prev and the control apart. Pose freshness is
  current on all four shots.
  - Output: `review/rosace/art/drive9/round-2/` (git-ignored): `<shot>_px144_x3/x1`, `<shot>_px80_x3/x1`, `all_*`,
    `diag_codec_idle_px144_x3`, `key.json`, `metrics.json`, `verdicts/TEMPLATE.json`.
  - **Not judged yet.** The sheet builder has seen the key.

```sh
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
    --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2 --head 1.10 --r2 D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/r2_model.json
python tools/pixel-pipeline/drive9/d9_post.py --root D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2 --finish tools/pixel-pipeline/drive9/r2_finish.json --tag R2
python tools/pixel-pipeline/drive9/d9_metrics.py --d9 D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2 --tag R2 --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/metrics_r2.json
python tools/pixel-pipeline/drive9/d9_round.py --round round-2 --seed 20261301 --raw D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2 --tag R2 \
    --prev-raw D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/H110 --prev-tag D1 --confounds tools/pixel-pipeline/drive9/r2_confounds.json
```

### 3.6o Drive 9 whole-character round 3: the round-2 critics' fixes, the blind set [built 2026-09-29; not promoted; `drive9/r3_model.json`, `r3_finish.json`, `r3_faces.json`, `r3_post.py`, `d9_post.py`, `d9_round.py`]

Round 2's blind critics (3.6n; verdicts in `review/rosace/art/drive9/round-2/verdicts/`) scored drive 9 at 5.5-6.2 against
the refs' 9. This round applies their fixes. As before, nothing is baked: `lanes/drive9.blend` and `rosace.blend` (sha256
`23545647...`) are unchanged, and the figure-pose lane's files are only read. `art/rosace/drive9.json` has a new `round3`
block with each pick, its reason, the measures and what is not done.

- **Pose check first.** The figure-pose lane has still promoted nothing new: `idle_appeal.json` (`a89be9fabdd7`) and
  `back_appeal.json` (`d65ee47e75d8`) are its newest promoted files, its work files stop at 15:54, and
  `review/rosace/art/figure-pose/REPORT.md` does not exist. So this round keeps concept A with its own patches.
- **Render-time model and pose patches** (`d9_blender.py --r2 drive9/r3_model.json --head 1.05`). The file carries round 2's
  edits whole and adds round 3's; every reason is in its `why`.
  - `mesh_edits` takes a new form, `scale_xy` (`r2_blender._scale_xy`): a scale in x and y about a vertical axis through
    `c`, interpolated over `z`. A name ending in `*` matches by prefix, and keys starting with `_` are skipped.
    - Hair volume: every hair clump except the fringe (04-08) and the cap, x1.12 at the crown (z 1.90) falling to x1.0 at
      z 1.45. The circlet is built after this, on the new contour.
    - The haft: x1.25 (x1.4 read as a heavy bar across N1).
  - Head x1.05 with the wider hair (x1.10 before). Head ÷ H on the idle: 0.196 → 0.190.
  - idle: spine side tilt -26 against the hips, chest -4 and upper chest -6 about x (lift and arch), the hip-hand elbow pole
    out-back [-1.2, 0.9, 1.2], and the glaive hand 9 cm up the haft (slide 0.36).
  - back: look amount 0.75 (0.62 read as a profile turned away, 0.85 near-frontal), and the back hair and tail blown to
    the far side.
  - Q: the kicked rear leg planted behind the front leg on its ball, the hips 7 cm higher, and the glaive tilted about 10°
    off her face (direction x +0.18). A tilt of about 25° took the grips out of the hands' reach (ART-RULES PS-P31).
- **Finish overlay** (`d9_post.py --finish drive9/r3_finish.json`, over `r2_finish.json`). Its `r3` block turns on
  `r3_post.py`'s steps. Without that block `d9_post.py` runs exactly as in round 2.
  - `noise_blur`: the brush and strand noise passes are box-blurred at the render scale (1.4 px; 0.4 x 1.6 px) with their
    spread restored, before the ramp. Then `despeckle` runs after the requant: a fill pixel with no same-colour 4-neighbour
    in its own material takes that material's commonest 8-neighbour colour. Lines, rim, face and glass are kept (PX-P47).
  - `rim_inset: false` and `rim_outline`: the rim goes onto the outline pixel on the rim-facing side of curved forms,
    bridged, with runs of at least 3 (PX-P46).
  - Values: whites and veil top out at `#e3dfe5`. OKLab chroma is x0.75 on white, the dark cloth and the haft, and x0.85
    on skin, hair and gold. Hair keeps 10 tones and its spec band drops to 0.35. The haft takes no texture and 5 tones.
  - The stocking is `sheer`, a new per-material option in `paint`: the lit side mixes toward `#7d5873`, up to 50%. The
    boot gets its own darker, bluer ramp and gamma 1.4 (CL-P23).
  - Face lift per shot (`face.lift_shot`): back 0.56, Q 0.40, N1 0.38. That relights the turned face.
  - `face` (`r3_post.face_extras`): the neck's cast shadow, a jaw step and a drawn 2 px blush (FC-P38).
  - `hair` (`r3_post.hair_r3`, `flyaways`): the sheen arc, the fringe gaps, the tip taper and the flyaways (HR-P26). The
    old spec-band `sheen` is off.
  - `bust` (`r3_post.bust_r3`): `bust()` takes `cleave_frac` 0.45 (the valley only under the neckline) and `underside_k`
    0.3. The key-facing bust is lifted toward the white ramp's 0.8 tone, with one 4 px highlight on the lit apex.
  - `belly`: skin beside the tabard takes a 2 px occlusion falloff.
  - `fx` (PX-P48), drawn last on the background only and left out of `sil.png` and the colour counts:
    - N1: the blade's swept glass fan about the rear fist (28 px at the blade, 48°), with A4 edge, A3/A2 body, A1 tail,
      A0 leading into cells and a G1 sliver. MOVESET 0.6 puts N1's contact frame in the leaded stage.
    - Q: a 4-point glass flash and a leaded crack on the floor line at the butt (MOVESET Q5).
- **Face spec** (`r3_faces.json`; `faces_table` now also merges a spec's `expressions`, `brow_rank` and `brows_profile`).
  The eye is a lid wedge (a 1 px flick plus two rows over the outer third) with an A2 band, a 2x2 pupil and a
  desaturated but light iris (FC-P36 changed). Every shot takes the open eye. N1 gets a set line mouth and Q a small
  symmetric open mouth. Brows are a mid hair tone, with none on a profile head.
- **Trials** (`lanes/drive9/raw/r3_t1..t3`, `r3_qa`, `r3_qb`, `R3a`; sheets in `lanes/drive9/r3work/`):
  - The first eye (a full two-row lash on a dark navy iris) read as a sleepy slab.
  - Crown flyaways stood up as antennae.
  - Q's glaive tilts: -0.3 crossed her body, +0.5 lost the grip, and the file's own direction runs through her body.
    +0.18 is kept.
  - A thin crescent smear read as a scythe blade.
  - Haft x1.4 was too heavy on N1.
  - Head 1.05 against 1.10 looks almost the same by eye.
- **Measured** on the figure only, effects excluded (`lanes/drive9/metrics_r3_critic.json`, copied to
  `round-3/metrics_critic_measure.json`; `d9_metrics.py --d9 <raw>/R3 --tag R3` → `metrics_r3.json` counts the effects
  in N1). Round 2 is in brackets. Flat and hard are the round-2 materials critic's shares of horizontal neighbour steps
  that are equal, and that differ by more than 120 (RGB sum):

  | Still 144 | Colours | Mean S | p90 V | Flat | Hard |
  |---|---|---|---|---|---|
  | idle | 188 (197) | 0.380 (0.409) | 0.898 (0.918) | 0.41 (0.27) | 0.30 (0.34) |
  | N1 | 193 (201) | 0.439 (0.451) | 0.882 (0.890) | 0.52 (0.38) | 0.23 (0.27) |
  | Q | 173 (192) | 0.372 (0.406) | 0.890 (0.894) | 0.41 (0.32) | 0.32 (0.33) |
  | back | 183 (194) | 0.425 (0.440) | 0.878 (0.882) | 0.42 (0.27) | 0.25 (0.31) |

  PX-P45 now passes on the idle and Q at 144 and 80. It still fails on saturation for N1 (0.439) and the back (0.425).
- **Not in round 3** (`r3_confounds.json`, key.json):
  - the constructed hand stamps and two-hand grip;
  - bodice construction and a hip side-cut line;
  - the collar cross at 5x7;
  - N1 stretch and squash frames, and the motion lane's frames through this finish;
  - a Q glaive tilt of 15-35°.
- **Blind set** (`d9_round.py`, new option `--files`, which records this round's files by sha1 in key.json under
  `sources.round_files`). Eight letters on one mapping; seed 20261401 became 20261403 under the shuffle rule. The slots are
  ours (round 3), prev (round 2's R2 stills), the control and refs 07/08/09/04, plus ref 05 on the 80 sheets. Pose freshness
  is current on all four shots.
  - Output: `review/rosace/art/drive9/round-3/` (git-ignored): `<shot>_px144_x3/x1`, `<shot>_px80_x3/x1`, `all_*`,
    `diag_codec_idle_px144_x3`, `key.json`, `metrics.json`, `metrics_critic_measure.json`, `verdicts/TEMPLATE.json`.
  - **Not judged yet.** The sheet builder has seen the key.

```sh
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
    --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R3 --head 1.05 --r2 D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/r3_model.json
python tools/pixel-pipeline/drive9/d9_post.py --root D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R3 --finish tools/pixel-pipeline/drive9/r3_finish.json --tag R3
python tools/pixel-pipeline/drive9/d9_metrics.py --d9 D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R3 --tag R3 --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/metrics_r3.json
python tools/pixel-pipeline/drive9/d9_round.py --round round-3 --seed 20261401 --raw D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R3 --tag R3 \
    --prev-raw D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2 --prev-tag R2 --confounds tools/pixel-pipeline/drive9/r3_confounds.json \
    --files r3_model.json,r3_finish.json,r3_faces.json,r3_post.py,d9_post.py,r2_blender.py
```

### 3.6p Drive 9 whole-character round 4: the round-3 critics' fixes, ESCALATION 2 (the paint-over), the blind set [built 2026-09-29; not promoted; `drive9/r4_model.json`, `r4_finish.json`, `r4_post.py`, `r4_paint.py`, `r4_metrics.py`, `r4_look.py`, `art/rosace/overrides/drive9/`]

Round 3's blind critics (3.6o; verdicts in `review/rosace/art/drive9/round-3/verdicts/`) scored drive 9 at 5-5.5 (face 5, body
5.2, materials 5.4, first impression 5.5) and ranked round 2 above round 3 on arms, posing and finish. This round applies their
fixes, takes back what round 3 broke, and adds ESCALATION 2: hand-authored pixel layers on top of the render, on the four key
stills at 144 and at 80. Nothing is baked: `lanes/drive9.blend` and `rosace.blend` (sha256 `23545647...`) are unchanged, and
the figure-pose lane's files are only read. `art/rosace/drive9.json` has a new `round4` block with each pick, its reason, the
measures and what is not done.

- **Pose check first.** The figure-pose lane has still promoted nothing new: `idle_appeal.json` (`a89be9fabdd7`) and
  `back_appeal.json` (`d65ee47e75d8`) are its newest promoted files, its work files stop at 15:54, and
  `review/rosace/art/figure-pose/REPORT.md` does not exist. So this round keeps concept A with its own patches.
- **Render-time model and pose patches** (`d9_blender.py --r2 drive9/r4_model.json --head 1.05`; every reason is in its `why`).
  It is built from rounds 2 and 3, not stacked on round 3:
  - the gold diadem (`circlet`) is gone: the face critic found it pinned the eyes under a gold bar;
  - hair: x1.03 at the crown rising to x1.10 from the ear line down (round 3 had x1.12 at the crown), fringe untouched;
  - kept: the tabard x1.3-1.65 and the haft x1.25;
  - idle: round 2's patch without its free-knee pole (so the legs are the pose file's lambda, as on the control), head tilt
    9 and chin 5 (round 2: 16 and 10), and the waist stretched: `J_Bip_C_Spine.scale` [1, 1.14, 1] with the chest
    counter-scaled [1, 1/1.14, 1], applied after IK, so the hands move under 1 px;
  - back: no look patch (the pose file's own look, amount 1.0, max 85, as on the control), the near bell x0.72 and blown
    forward, round 3's hair to the far side, the same waist stretch;
  - Q: round 2's kick plus round 3's glaive direction (+0.18). With the pose file's direction the haft ran through her face
    (trial `raw/r4_q1`).
- **Finish overlay** (`d9_post.py --finish drive9/r4_finish.json --tag R4u`, over `r3_finish.json`). Its `r4` block turns on
  `r4_post.py`. Without that block `d9_post.py` runs exactly as in round 3.
  - `rim_limit` (PX-P46 changed): each rim run keeps at most 3 px around its most rim-facing pixel (about 30% of the run,
    peaks at least 7 px apart). The rest goes back to the outline colour it had. The rim colour is `#f0dcc6` (hair `#b9a2e0`)
    at k 0.45.
  - `ramp_soften`: inside one material, where two 4-neighbours are 2+ tone ranks apart and differ by more than 0.07 in
    OKLab L, the lighter one takes the material's own tone halfway between them in rank. No new colours are added (a first
    version took the OKLab midpoint and doubled the hair's colours). Metals and glass are skipped.
  - Values: the white and veil ramps top out warm near-white (`#e4e0e8` to `#f1ede9` from t 0.76) over lavender mids, with
    bounce 0.10. Hair gamma is 1.35 (chroma 0.85), stocking gamma 1.3, and lining/indigo chroma 0.7. The bust lift is 0.35 and
    the underside 0.5.
- **The paint-over** (`r4_paint.py`; ESCALATION 2, WF-P20). The underlay is the finished still (tag `R4u`), and the output is
  tag `R4` (ours).
  - One file per still and size, `art/rosace/overrides/drive9/<shot>_<px>.json`. Its `palette` holds hex colours or
    `mat:<material>@<t>` (a tone of the underlay's own material ramp). Its `layers` run in order: `stamp` (rows of palette
    letters), `px`, `line` (a 1 px polyline, one key per segment for a taper), `edge`, and `clumps`, which rasterises fringe
    locks from hand-placed root spans and tips: lit right edge, dark gap line where two locks touch, warm skin shadow under
    them.
  - A layer may carry `over` (the underlay materials it may paint on, `bg` for the ground) and `onkeys` (paint only where the
    current colour is one of those keys). A `why` names the critic fix it answers.
  - `--sign` records `authored_on.still_sha1`, the underlay each file was placed on. A changed underlay makes the file STALE,
    and the still is written as the bare underlay.
  - The 80 px files are placed by hand on the 80 px render, never scaled from 144.
  - What is painted:
    - the faces (FC-P39): an almond eye with one lash row and a flick, a three-row dark-to-light iris with a catchlight, a cool
      inner white, a 2-tone blush and an asymmetric smile on the idle and back glance; set brows and a small shout on Q; a
      profile wedge eye and a set mouth on N1. Tilted heads (back -23°, Q +26°) are drawn stair-stepped in screen space. A
      `rot` option (an upright stamp rotated by nearest sampling) exists but broke the lashes, so it is unused;
    - the idle fringe as 6 tapered locks (4 at 80). The back glance takes gap cuts only (HR-P27);
    - loose strands off the outline, lock gaps and lit lock edges on the near side mass;
    - pipe folds on the tabard and bells, a lit ridge and crease on the far bell's dark lining, a stocking sheen stripe, and
      the spine on the back view;
    - the idle's near chest repainted as a side plane stepping into shadow, with a shadow line at the chest-shoulder boundary
      and the neckline dipped into the cleavage (PS-N24). The critics' 'forearm across the bust' is this skin band. The id
      pass shows body skin, collar and hair mantle there, and no arm.
  - Pixels changed from the underlay: idle 675 at 144 / 117 at 80, back 279 / 50, Q 381 / 58, N1 69 / 35.
- **Trials** (sheets in `lanes/drive9/r4work/`):
  - A 7x6 eye with a full two-row lash read closed and sleepy.
  - A two-row profile lash read as a slab.
  - A rotated upright face stamp broke the lash lines.
  - A 5-lock fringe repaint on the back glance read as a dark visor, with tall skin slits (a lock tapering from its root).
    Locks now keep full width in their upper half (`taper_from`).
- **Measured** on the figure only (`r4_metrics.py` → `lanes/drive9/metrics_r4.json`; round 3 / under / ours):

  | Still 144 | Colours | Mean S | p90 V | V < 0.35 | Flat | Hard |
  |---|---|---|---|---|---|---|
  | idle | 188 / 192 / 196 | 0.380 / 0.398 / 0.399 | 0.898 / 0.906 / 0.906 | 0.29 / 0.35 / 0.33 | 0.41 / 0.36 / 0.33 | 0.28 / 0.29 / 0.32 |
  | N1 | 193 / 196 / 205 | 0.439 / 0.438 / 0.438 | 0.882 / 0.871 / 0.871 | 0.34 / 0.39 / 0.39 | 0.53 / 0.49 / 0.49 | 0.20 / 0.19 / 0.19 |
  | Q | 173 / 178 / 187 | 0.372 / 0.383 / 0.383 | 0.890 / 0.902 / 0.902 | 0.27 / 0.27 / 0.27 | 0.41 / 0.37 / 0.36 | 0.29 / 0.30 / 0.33 |
  | back | 183 / 201 / 211 | 0.425 / 0.432 / 0.432 | 0.878 / 0.882 / 0.882 | 0.39 / 0.44 / 0.44 | 0.42 / 0.37 / 0.35 | 0.21 / 0.20 / 0.22 |

  The low-key share rose on the idle and back, as the palette critic asked. The hard-step share did not fall, because the
  hard steps sit at outlines and material borders, not inside the ramps. PX-P45 still fails on saturation for N1 (0.438) and
  the back (0.432).
- **Not in round 4** (`r4_confounds.json`, key.json):
  - the constructed hand stamps and two-hand grip;
  - bodice construction and tension lines;
  - the collar cross at 5x7 and stained-glass panels on the tabard hem and cuffs;
  - N1 stretch and squash frames, and the motion lane's frames through this finish and paint-over.
- **Blind set** (`d9_round.py`, new option `--under-tag`, which adds the same raw's stills under that tag as one more slot,
  `under`, kept apart from ours, prev and the control like they are; letters run to I). Nine letters on one mapping; seed
  20261501 became 20261541 under the shuffle rule. The slots are ours (R4), under (R4u), prev (round 3's R3 stills), the
  control and refs 07/08/09/04, plus ref 05 on the 80 sheets. Pose freshness is current on all four shots.
  - Output: `review/rosace/art/drive9/round-4/` (git-ignored): `<shot>_px144_x3/x1`, `<shot>_px80_x3/x1`, `all_*`,
    `diag_codec_idle_px144_x3`, `key.json`, `verdicts/TEMPLATE.json`.
  - Labelled before/after look sheets (not blind; round 3 / under / ours / control, heads at 144 x6 and 80 x6 and x1, whole
    figures) are in the sibling folder `review/rosace/art/drive9/round-4-look/` (`r4_look.py`), so a blind critic never opens
    them first.
  - **Not judged yet.** The sheet builder has seen the key.

```sh
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
    --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R4 --head 1.05 --r2 D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/r4_model.json
python tools/pixel-pipeline/drive9/d9_post.py --root D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R4 --finish tools/pixel-pipeline/drive9/r4_finish.json --tag R4u
python tools/pixel-pipeline/drive9/r4_paint.py --root D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R4      # --sign after re-authoring
python tools/pixel-pipeline/drive9/r4_metrics.py --set R3=<raw>/R3:R3 --set R4u=<raw>/R4:R4u --set R4=<raw>/R4:R4 --out <build>/lanes/drive9/metrics_r4.json
python tools/pixel-pipeline/drive9/d9_round.py --round round-4 --seed 20261501 --raw <raw>/R4 --tag R4 --under-tag R4u \
    --prev-raw <raw>/R3 --prev-tag R3 --confounds tools/pixel-pipeline/drive9/r4_confounds.json \
    --files r4_model.json,r4_finish.json,r4_post.py,r4_paint.py,d9_post.py,d9_round.py,<the eight override files>
python tools/pixel-pipeline/drive9/r4_look.py
```

### 3.6q Drive 9 whole-character round 5: the round-4 critics' fixes, ESCALATION 3 (recombine), the blind set [built 2026-09-29; not promoted; `drive9/r5_model.json`, `r5x_model.json`, `r5_finish.json`, `r5x_finish.json`, `r5_post.py`, `r5_blender.py`, `r5_paint.py`, `r5_look.py`, `art/rosace/overrides/drive9_r5/`]

Round 4's blind critics (3.6p; verdicts in `review/rosace/art/drive9/round-4/verdicts/`) scored drive 9 at 5.2-6 (face 5.8, body 5.2,
materials 5.8, first impression 6, weapon/outfit 5.5; the paint-over and the bare render tied). This round applies their fixes and
ESCALATION 3: the same fixes rebuilt on a second lever mix, the two compared side by side, the better kept as ours and the other put
in the blind set as its own letter, `alt` (WF-P21). Nothing is baked: `lanes/drive9.blend`, the new `lanes/drive9n.blend` and
`rosace.blend` (sha256 `23545647...`) are not written by any step, and the figure-pose lane's files are only read.
`art/rosace/drive9.json` has a `round5` block with each pick, its reason, the measures and what is not done.

- **Pose check first.** The figure-pose lane has still promoted nothing new (`idle_appeal.json` `a89be9fabdd7`, `back_appeal.json`
  `d65ee47e75d8`; its work files stop at 15:54; no `review/rosace/art/figure-pose/REPORT.md`). Concept A is kept with patches.
- **The two mixes** (every value's reason is in the model json's `why`):
  - **P** (`alt`): round 4's build, `lanes/drive9.blend` (F3 L: the big bells), with `r5_model.json` and `r5_finish.json`.
  - **X** (ours): `lanes/drive9n.blend`, F3 variant N (A's smaller bells, L's tabard, B's hair; bust S7), built by
    `bl_build.py` with `D9_VARIANT=N D9_OUT=<build>/lanes/drive9n.blend`; `r5x_model.json` = `r5_model.json` plus the far bell
    blown back behind the haft (`sleeve_L` g 0.4, wind [0.4, 1.8, 0.2]) and the near bell x0.85; `r5x_finish.json` = `r5_finish.json`
    plus a lower key (white gamma 1.55, veil 1.5, skin 1.22, hair 1.45, stocking 1.4, lining 1.2).
  - N alone (raw `R5n`) looked almost the same as L: the clog was the far bell's dark lining lobe between the body and the haft,
    not the bells' size. Opening that gap is what changed the read.
  - **Pick: X**, by the labelled side-by-side (`review/rosace/art/drive9/round-5-look/`): at 144 the girl reads before the weapon
    (the body-haft gap is open, the glaive arm and fist read); at 80 X reads as a figure plus a staff while P's dark lobe merges
    with the haft. Back, Q and N1 are nearly the same. X gives up some mass (body area ÷ H², glaive materials out: idle 0.300 ->
    0.280 at 144, 0.331 -> 0.310 at 80), still at the refs' 0.28 low end. The critics can overturn it through `alt`.
- **Render-time model and pose patches** (both mixes; `d9_blender.py --r2 <model json> --head 1.05 --neck-l 1.15 [--blend ...]`):
  - new `d9_blender.py` options: `--blend` (another lane file; asserts it is not `rosace.blend`) and `--neck-l` (head_scale's
    `neck_l`: 1.15 lengthens the neck; the body critic's 'the head sinks onto the bust');
  - idle: upper chest 8 -> 11, head tilt 9 -> 7 and chin 5 -> 6, the near bell smaller (x0.72 on L) and blown back harder;
  - back: the near bell (the white panel over her back) x0.62, blown toward screen right and the camera (wind [-1.6, -1.2, 0.3],
    g 0.2), so the back and hip read; trial `raw/r5_bk0` against `r5_bk1` (blown back: the panel stayed on the waist). The back was
    re-rendered into `raw/R5` and `raw/R5x` from `raw/R5_b` and `raw/R5x_b` after this trial;
  - **the head-top pin** (`r5_blender.pin`, HR-P28): a flat rosace (gold rim, glass, glasscore: the weapon disc's materials) on the
    hair's own surface at azimuth 25 / elevation 58 from the skull centre, r 3.4 cm, with two 13 cm veil ribbon tails falling back and
    down (a V cut at each end), all weighted to the head bone. At azimuth 75 it was edge-on behind the hair (`raw/r5_t1`); a tail laid
    straight down the tangent plane from the front crown fell over the face.
- **Finish** (`d9_post.py --finish drive9/r5_finish.json` or `r5x_finish.json`; an `r5` block turns on `r5_post.py`, and without it
  `d9_post.py` runs exactly as in round 4):
  - `rim_arcs` (PX-P46 changed) replaces round 4's `rim_limit`: a rim run under 5 px goes back to the outline; a longer run keeps one
    contiguous arc of up to 7 px walked from its most rim-facing pixel (a second arc on runs over 22 px, 14 px away). About 30-90 rim
    px in 4-13 arcs per still; round 4's 3 px islands read as dotted beads;
  - `contour_clean` (PX-P49): orphan light pixels on the silhouette ring take their closest darker ring neighbour (0-4 px per still:
    the 'beads' were the rim islands);
  - `underbust_trim` (CL-P24): a 1 px gold trim on the bodice's bottom edge over skin, the skin row under it two tones down
    (0-11 px per still; none where no bodice edge meets skin, N1 at 80);
  - ramps: hair from blue-navy to pink-lavender (about 55 deg of hue, chroma 1.0); the hair tips periwinkle (`#5876c4` mid, was
    `#4193e6`), so the saturated blue is the gem's and the eyes'.
  - The lower key (X) barely moves the measured low-key share: on the same render V < 0.35 goes 0.300 -> 0.315. The per-material
    palette re-spreads each material's tones over its own range, so an input gamma mostly relabels pixels. A real key change has to
    move the ramp stops.
- **The paint-over** (`r5_paint.py`, round 4's `r4_paint.py` used as a library; WF-P20, WF-P21):
  - one file per still and size in `art/rosace/overrides/drive9_r5/`, seeded from round 4's head layers moved by the head-skin offset
    (R4u -> R5xu, 0-2 px), then re-authored; authored on X's underlay (`R5xu`, `authored_on`);
  - layers marked `port: true` (face, eyes, brows, mouth, blush, fringe, strands, ahoge, sheen arc, fists, hip hand) are also painted
    on P's underlay (`R5u` -> tag `R5`), moved by `head_offset(ours, twin)` (idle +2/+1 px, the rest 0), recorded with the twin's sha1
    in `ported_on`; a changed twin makes the port STALE;
  - a new layer kind, `matbox` {box, on: [materials], keys: dark .. light}: the underlay's pixels of those materials inside the box take
    the keys by their own value rank (a local recolour that keeps the shading);
  - what is painted: the eye (FC-P39 changed: a narrower almond tilted up at the outer corner, a 2-row near-black lash block running
    1 px past it, indigo -> muted blue -> 1 px pale catchlight, no cyan; at 80 the same ramp on round 4's shape), a 3-tone warm face
    plane with a soft shadow under the far eye, blush as 1-2 px strokes, a 3 px smirk and a raised far brow on the idle and back; on Q
    closed mouth, set brows, both eyes on one line and the jaw drawn over the sleeve as a V to a 6 px chin (a jaw line on the old skin
    edge drew a bar at mouth height: the sleeve cut the face at the mouth row); on N1 the same almond and a closed 2 px mouth; an ahoge,
    a third flyaway and a lavender sheen arc at 144; painted fists on the idle and back glaive hands (6x6 at 144, 4x4 at 80, gold
    cuff, knuckle crease) at the render's wrist landmarks and a painted hip hand (grouped fingers, one split); the hair tail's azure
    tips at the idle's hip and by the back view's glaive hand recoloured to the hair's violet (the critics' 'detached blue claw');
  - round 4's cloth-fold, stocking-sheen, spine and chest-repaint layers were placed on round 4's renders and are not in round 5.
- **Measured** on the figure only (`r4_metrics.py` -> `lanes/drive9/metrics_r5.json`; round 4 / P painted / X painted):

  | Still 144 | Colours | Mean S | p90 V | V < 0.35 | Flat | Hard |
  |---|---|---|---|---|---|---|
  | idle | 196 / 201 / 197 | 0.399 / 0.399 / 0.402 | 0.906 / 0.906 / 0.902 | 0.33 / 0.31 / 0.31 | 0.33 / 0.34 / 0.33 | 0.32 / 0.31 / 0.31 |
  | N1 | 205 / 201 / 195 | 0.438 / 0.446 / 0.448 | 0.871 / 0.878 / 0.851 | 0.39 / 0.39 / 0.39 | 0.49 / 0.49 / 0.50 | 0.19 / 0.19 / 0.18 |
  | Q | 187 / 179 / 177 | 0.383 / 0.388 / 0.388 | 0.902 / 0.902 / 0.898 | 0.27 / 0.26 / 0.28 | 0.36 / 0.38 / 0.37 | 0.33 / 0.31 / 0.31 |
  | back | 211 / 203 / 200 | 0.432 / 0.440 / 0.446 | 0.882 / 0.875 / 0.875 | 0.44 / 0.45 / 0.44 | 0.35 / 0.38 / 0.38 | 0.22 / 0.21 / 0.20 |

  The numbers barely move between the rounds and the mixes: round 5's changes are shape and drawing (face, hands, pin, the open
  silhouette), not the global colour statistics.
- **Blind set** (`d9_round.py`, new options `--alt-raw` / `--alt-tag`: another raw's stills as one more slot, `alt`, kept apart from
  ours, prev and the control; letters run to I). Seed 20261601 became 20261616. The slots are ours (X, `R5x`), alt (P, `R5`), prev
  (round 4's `R4`), the control and refs 07/08/09/04, plus ref 05 on the 80 sheets. Pose freshness is current on all four shots.
  - Output: `review/rosace/art/drive9/round-5/` (git-ignored): `<shot>_px144_x3/x1`, `<shot>_px80_x3/x1` (refs at world scale plus
    ref 05 native), `all_*`, `diag_codec_idle_px144_x3`, `key.json`, `verdicts/TEMPLATE.json`; confounds in `r5_confounds.json`.
  - Labelled side-by-side sheets (round 4 / P / X under / X / control; heads at x6, whole figures) are in the sibling
    `review/rosace/art/drive9/round-5-look/` (`r5_look.py`), so a blind critic never opens them first.
  - **Not judged yet.** The sheet builder has seen the key.
- **Not in round 5** (`drive9.json` `round5.not_done`): the constructed hand stamps and two-hand grip (`author_hands.py` works in the
  integrated chain's palette codes; the fists are painted); bodice tension lines, the collar cross at 5x7 and the stained-glass panels;
  a real low-key move; the bust apex drop and teardrop contour (the figure-pose lane's shape keys); N1 stretch and squash and the motion
  frames through this finish.

```sh
# the recombined model (one Blender, ~15 s): F3 variant N -> lanes/drive9n.blend
D9_VARIANT=N D9_OUT=D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9n.blend \
    python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/bl_build.py
# passes, one Blender at a time: X (ours) and P (alt)
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
    --out <raw>/R5x --head 1.05 --neck-l 1.15 --blend D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9n.blend --r2 D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/r5x_model.json
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
    --out <raw>/R5 --head 1.05 --neck-l 1.15 --r2 D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/r5_model.json
# finish (numpy)
python tools/pixel-pipeline/drive9/d9_post.py --root <raw>/R5x --finish tools/pixel-pipeline/drive9/r5x_finish.json --tag R5xu
python tools/pixel-pipeline/drive9/d9_post.py --root <raw>/R5 --finish tools/pixel-pipeline/drive9/r5_finish.json --tag R5u
# paint-over on X and its port to P (--sign after re-authoring records authored_on and ported_on)
python tools/pixel-pipeline/drive9/r5_paint.py --root <raw>/R5x --twin-root <raw>/R5
# measures, blind set, labelled look sheets
python tools/pixel-pipeline/drive9/r4_metrics.py --set R4=<raw>/R4:R4 --set R5=<raw>/R5:R5 --set R5xu=<raw>/R5x:R5xu --set R5x=<raw>/R5x:R5x --out <build>/lanes/drive9/metrics_r5.json
python tools/pixel-pipeline/drive9/d9_round.py --round round-5 --seed 20261601 --raw <raw>/R5x --tag R5x --alt-raw <raw>/R5 --alt-tag R5 \
    --prev-raw <raw>/R4 --prev-tag R4 --confounds tools/pixel-pipeline/drive9/r5_confounds.json --files r5_model.json,r5x_model.json,...
python tools/pixel-pipeline/drive9/r5_look.py
```

### 3.6u Finite hand ladder and physical fabric [source in progress 2026-09-30]

Dex's stricter/faster steering requires three fresh/fork-none actual-pixel
critics per candidate and physical tabard/sleeves. The3root calibration reports
were consumed, not duplicated: hand/thumb/shaft and arm separation, fragmented
material/form clusters, then80face/hair clarity are the shared priorities. Their
6.3/6.5/6.8 baseline judgments are not a gain or a direct rescore of old5.78.

Frozen H1 source stays at322e7cd in the original Rosace worktree. Next source is
isolated at `D:/Dex/Temp/dex-place-rosace-ladder-20260930` on
`codex/rosace-ladder-physics-20260930`. The one-lever1.15/1.30/1.45 ladder keeps
the R2pose/finish/seated grip; H1 wrappers/recipe/driver/model remain byte-identical.
New ladder recipe substitution is local to the native process and restored.
Source tests pass equality/control/one-lever/invalid-values/syntax. Actual
framing/contact/quality are delivery and pixel-panel evidence still pending.

Actual native Cloth modifier source now pins complete25/30waist/upperarm seams,
frees hems/cuffs, applies gravity/inertia/damping/wind/body+weapon/self collision,
and carries ornaments on simulated fabric. It bakes chronologically with held
warmup and preserves driver pose/frame in rendering callbacks. The finite
80px body-translation diagnostic produces actual moving frame/GIF proof when
delivery executes it, but does not qualify gameplay motion/transition clips.
No source install or metadata alone is cloth/motion acceptance. Source contract
and module: `CLOTH-PHYSICS.md`, `next/cloth/`, `cloth-physics.json`. Baseline,
rollbacks, defaults and world/UI/layout code remain unchanged.

### 3.6t Readable authored hands [in progress 2026-09-30; source-ready, native pixels pending]

The next bounded variable is idle hand geometry at absolute uniform1.30 on both
existing authored hand bones. `next/nx_hands_blender.py` wraps the preserved R2
renderer in process; it solves the gripped wrist with the scaled rest offset so
the final grip center remains at the same haft/socket/slide. This necessary
contact compensation may move wrist/elbow IK; arm transforms are not claimed
unchanged. Free-hand pose and finger curls stay R2. No face, sleeve, pose gesture,
finish or N1/Q/back lever is bundled. No paint layers or new hand mass stamps.

Control scale1 leaves pose/grip calls unchanged. Both control/candidate add raw
`depth2` limb IDs and separate `haft_grips.json`. `next/hand_metrics.py` records
categorical hand visibility and synthetic grip gaps without painting pixels or
inferring material colors from finished RGB. Raw counts do not prove finger
anatomy or seams; GH reach_m is unscaled-rest information. Candidate guards:
identity armature/unit-scale ancestors, effective1.30 hand scale, idle only,
canonical R2 blend/model hashes, head1.10, ss4,144/80, no save or output overwrite.
Independent source review and focused pure-Python checks passed; delivery must
prove fresh instrumented R2 control0px before rendering the candidate. Recipe,
targets, exact commands and acceptance limits: `NEXT-HANDS-PC-CHECK.md`.

### 3.6s Controlled next pass [completed native trial 2026-09-30; no promotion]

Round 2 remains promoted at 5.78; target remains reference parity 9. The cloud
proposal was recovered as `NEXT-RUN.md` and `next-run-workflow.js`; it has not
been dispatched. All 16 unchanged-control transparent/contact-shadow images
reproduce at 0 changed pixels in private copies of R2 raw passes. A collar-only
trial changed idle25/20 px and N1 19/0 at144/80; Q/back and silhouette stayed
unchanged. Independent blind review and the coordinator preferred the R2
baseline. Its color attribution was unsafe after cleanup/AA; the rejected
adapter and switch were removed and archived with the trial. No glyph retry or
promotion is planned. `next/nx_post.py` is now only the R2 replay verifier.
Delivery rendered the single-variable idle look.tilt16->8 candidate plus a
fresh R2 control: all16 control images match the preserved reference at0px.
Independent blind review and root prefer R2 personality at144, with80 a rough
tie; the trial remains unpromoted. Canonical blend/backup and all7state maps
are hash-verified unchanged. Source/coverage and replay verifier checks also
passed at delivery. Native receipt: `rosace-headtilt8-render-request-20260930`;
actual preview: `review/rosace/art/next/headtilt8-delivery/PREVIEW.json` and the
owner `lanes/rosace/PREVIEW.json`. Do not repeat the marginal collar/tilt loops.
Commands and rollback proof: `NEXT-PC-CHECK.md`.

### 3.6r Promote drive 9 round 2: the canonical build and stills make the judged round-2 look [done 2026-09-29; `build_rosace_v2.py`, `stills_v2.py`, `drive9/d9_blender.py`, `art/rosace/drive9.json` `promoted`]

The drive-9 loop ran five blind whole-character rounds (3.6m-3.6q). Round 2 scored best, 5.78 over five critics, with the refs at
9. It beat the integrated build twice in blind sets: in round 2 itself (control 5.6) and in round 3, where it was `prev` (5.7
against the control's 5.2). The integrated build scored 5.6 in the finish-routes bake-off. Round 4 tied round 2 (5.7), but it leans
on hand-painted per-still layers that don't carry to new poses or motion frames, and rounds 3 and 5 scored lower. So round 2 is
the one promoted: it is all procedural, a model patch plus a finish json. ART-RULES 10, round D9-P, has the per-lens
reading.

- **Backup:** `build/rosace_pre_drive9.blend` (sha256 `23545647...`, the integrated WH2 build, with `_build.json`). `rosace.blend` is
  now sha256 `aef28c7f...`. `build_rosace_v2.py` refuses to write the canonical file with the drive9 chain unless that backup exists,
  and it never writes any backup (`rosace_v1`, `rosace_pre_artistry`, `rosace_pre_drive9`).
- **The pick file:** `art/rosace/drive9.json` `promoted`: `f3_variant` L, head 1.10, `model` `drive9/r2_model.json`, `finish`
  `drive9/r2_finish.json`, tag R2, the four pose files with the sha1s round 2 was judged on, and the sha1s of the r2 jsons.
  `integrated.json` is unchanged: the drive-9 build is the integrated build plus route F3's mass.
- **`build_rosace_v2.py`** takes `--chain drive9|integrated` (or `ROSACE_CHAIN`). The default is drive9. It loads
  `finish_f3/overrides.py` under its own module name (`overrides` is also the face tool's name) and runs `install('L')` before the
  build, just as `drive9/bl_build.py` did for `lanes/drive9.blend`: ref-14 bells, the mid tabard with pipe folds, hair variant `f3`
  (r2f with more volume). The bust stays `integrated.json`'s S7. The mass lever is **skipped** for `--bare`, when a lane driver already
  set `ROSACE_OUTFIT`, `ROSACE_GLAIVE` or `ROSACE_HAIR`, or when a driver already installed an F3 variant (`finish_f3/bl_build.py`,
  `drive9/bl_build.py`). So every lane driver builds exactly what it built before. `_build.json` has a `chain` block.
- **`stills_v2.py`** takes `--chain drive9|integrated`. The default is drive9, and `--plain` or `--config` imply integrated. The drive-9
  chain:
  1. (`--build`) `build_rosace_v2.py` → `--blend` (rosace.blend by default);
  2. `drive9/d9_blender.py --blend <blend> --head 1.10 --r2 drive9/r2_model.json`: the figure-pose lane's appeal poses through its
     applier (read-only), drape p5, round 2's render-time patches (the tabard flare, the circlet, the pose patches), route F2's head
     scale; the passes at 4x plus facepass and landmarks;
  3. `drive9/d9_post.py --finish drive9/r2_finish.json --tag R2`;
  4. `still.png`, `still_ground.png`, `sil.png` and `post.json` copied up from `R2/` into `<shot>/px<N>/`, with `_x3` and `_x6`
     previews.

  The shots are idle, n1, q and back at 144 and 80. `--only` takes those names or the integrated names (`idle_hero`, `n1_contact`,
  `q_stamp`, `n2_pivot*`). The default out is `build/renders/drive9`; the integrated chain's default is still `renders/integrated`. If
  a pose file's sha1 no longer matches the one round 2 was judged on (for example, the figure-pose lane promotes a refined
  `idle_appeal.json`), the chain prints a WARN and writes it to `_log.json`. It still renders, because the drive-9 idle and back
  follow the lane's newest pose by design.
- **`d9_blender.py`** may now open `rosace.blend`. It never saves the opened file (the patches stay in memory), and `--save-lane`
  on `rosace.blend` is refused.
- **Proof** [M]:
  - The finish alone: `d9_post.py` re-run on round 2's own passes gives 0 changed pixels on all 16 images (4 shots × 2 sizes ×
    `still` / `still_ground`). The later rounds' steps are opt-in blocks in the finish json, so round 2's json skips them.
  - A fresh build: `build_rosace_v2.py` (drive9 chain) into a scratch file gives a `_build.json` identical to
    `lanes/drive9_build.json` except for the new `chain` block. `stills_v2.py` on that file gives 0 changed pixels against the
    judged `lanes/drive9/raw/R2/<shot>/px<N>/R2/` stills, on all 16 images.
  - The canonical run: `stills_v2.py --build` wrote `rosace.blend` (16 s), rendered (13 s) and finished (3 s). It also gives 0
    changed pixels on all 16, both the tag copies and the top-level copies.
  - The old chain: `--chain integrated` builds a `_build.json` identical to `rosace_pre_drive9_build.json` except for `chain`
    (hair r2f, no F3). `stills_v2.py --chain integrated --no-render` on a copy of `renders/integrated/idle_hero` (with its `_layers`)
    reproduces the old idle at 144 and 80 exactly.
- **Not carried by the promotion** (open):
  - The N2 thong variants and the 640 beauty (`--hi` is ignored on the drive-9 chain).
  - The integrated chain's pixel passes: the constructed hands and weapon, the glyphs, the collar cross and the wh2 faces.
  - Motion: `rosace_v2/motion_v2.py --tag integrated` now renders the drive-9 geometry with the old `motion_finish.py`. The finish
    that matches is `drive9/d9_motion.py`, which still reads `lanes/drive9.blend` and d9_finish.json, not r2_finish.json. So no motion
    has been re-run for the promoted look.
  - `whole_sheets.py`, `integrated_sheets.py` and the finish lanes' controls read `renders/integrated` or rebuild from their own
    files, so they are unchanged.
  - The figure-pose lane was still running at promotion. Its `figure_shape.py build` defaults to `--src rosace.blend`, which now
    carries F3 L's cloth. A variant it builds from the canonical file from here on includes that cloth.

```sh
# the canonical build + the promoted stills (one Blender at a time; about 35 s)
python tools/pixel-pipeline/stills_v2.py --build          # = build_rosace_v2.py (drive9) -> rosace.blend, then the drive-9 chain -> renders/drive9
python tools/pixel-pipeline/stills_v2.py --no-render      # the finish only, on the existing passes (about 3 s)
# the old integrated build and stills (lane controls, comparison)
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/build_rosace_v2.py -- --chain integrated --out <lane.blend>
python tools/pixel-pipeline/stills_v2.py --chain integrated --blend <lane.blend> --out <dir>
```

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

### 3.7b The figure-pose applier (`rosace_v2/figure_pose.py`) [built 2026-09-29, round FP2; round-trip proven]

The runtime for appeal poses (`idle_appeal*`, `back_appeal*`; DESIGN 3.5). It runs after
`posing.py`. It imports posing.py's building blocks (reset, set_world_rel, place_foot, place_pole,
place_weapon, grip_hand, orient_hand, curl_fingers, drape) and calls them in `apply_pose`'s exact
order, then adds a `figure` block at fixed stages. Pose designers work only in JSON; they don't
edit the applier.

**Proof it changes nothing by itself** (PS-P22): `roundtrip` applies a pose with posing.py,
snapshots all 112 pose-bone matrices, applies it again with the applier and compares. On
idle_hero, n1_contact, n2_pivot and q_stamp the largest difference is 0.0. idle_hero rendered
through both on `lanes/figure-pose-base.blend` (pose camera, 144 and 80) gives beauty, id,
albedo, normal and depth passes and post-processed stills that are pixel-identical.

**The JSON.** Everything in 3.7 works unchanged. Conventions: degrees and metres, rest-model
world frame (+Z up, she faces -Y, her left is +X). A rotation `[x, y, z]` is about the rest-world
axes carried by the parent, X first, then Y, then Z. On a torso or head bone:

| axis | + | - |
|---|---|---|
| x | bend forward, chin down | lean back, lift the chest |
| y | tilt toward her left (+X) | tilt toward her right |
| z | turn toward her left | turn toward her right (toward a camera at yaw > 0) |

Camera: yaw 0 is in front of her, yaw 90 on her right (-X side); elev is degrees above.

The optional `figure` block, in the order it is applied:

| key | stage | what it does |
|---|---|---|
| `appeal` | – | run the PS checks as an appeal pose (default: the name starts with `idle_appeal` or `back_appeal`) |
| `joints {name: [x,y,z]}` | after `bones` | rotations by name, **composed on top** of any `bones` rotation of that bone. Names: `hips`, `spine`, `chest`, `upper_chest`, `neck`, `head`, `shoulder.L/R`, `upper_arm`, `lower_arm`, `hand`, `upper_leg`, `lower_leg`, `foot`, `toe`, `bust`, or any bone name |
| `torso {bend: [x,y,z], split}` | after joints | one rotation shared over spine / chest / upper chest (default 0.3 / 0.35 / 0.35): the S-curve, chest lift and chest turn as one number each |
| `hips_loc [dx,dy,dz]` | after joints | added to `bones["J_Bip_C_Hips.loc"]` |
| `feet {R\|L: {roll, toe}}` | with the feet | roll about the foot's long axis (+ = sole toward her midline); toe bend (+ = toes up, for a raised heel on the ball). pos, yaw and pitch stay in the top-level `feet` |
| `weight {leg, knee, over, offset}` | after the feet | moves the hips so the pit of the neck (`over: "neck"`) or the centre of mass (`"com"`) is over the weight ankle (+ offset, root frame), and the weight knee's interior angle is `knee` (180 = straight) with that foot on its target: PS-P07 by construction |
| `hands {R\|L: {rel, pos, fdir, palm, at_grip}}` | with the hands | replaces that side's hand; pos, fdir and palm are given in the **rest** pose and carried by the posed bone `rel`, so a hand set on the rest hip stays on the hip whatever the hips do |
| `fingers {R\|L: {curl, per, spread, thumb}}` | after the hands | `per {Index\|Middle\|Ring\|Little: deg \| [j1,j2,j3]}` (a number is spread 0.9 / 1.1 / 0.8 over the joints, as posing.py does); `spread` fans the fingers apart at the knuckles (-1 / -0.33 / +0.33 / +1 of it from index to little, or a per-finger dict); `thumb` is posing.py's number or `{fold, curl, swing}` |
| `look {at, amount, neck, offset, tilt, chin, max}` | after the fingers | turns the head, with `neck` (0.35) of the turn on the neck, toward `"camera"` or a root-frame point; `offset [yaw, pitch]` aims off it (+ = screen right, up); then `tilt` (+ = crown toward her left) and `chin` (+ = down) in the head's own frame, capped at `max` (75°). PS-P04 wants the head 10-30° off the camera with the eyes (stamps) on the viewer, so use `amount` about 0.6 or an offset rather than a full look |

Full stage order: reset, root, bones, [joints, torso, hips_loc], feet [+ roll, toe], [weight],
poles, weapon, hands [+ rel], fingers [+ per-finger], [look], scales, drape.

**Check mode** (`check`, no render, no GPU) writes `landmarks.json` (art-rules/pose.md 7): world
and screen positions at 144 and 80, in the pose camera, of the pit of the neck, neck base, head
joint and crown, and per side the acromion, shoulder, elbow, wrist, ASIS, hip, knee, ankle,
heel, ball, toe and approximate bust apex, plus the centre of mass. It also has the rig measures
(knee and elbow bends; pelvis, chest and head yaw against the camera; chest pitch against the
pelvis; head pitch; foot pitch; IK misses; the weight leg; the pit and centre of mass over the
weight ankle) and a pass/fail per size for PS-P01, P03 (pitch only), P04-P09, N01-N05 and N13-N14.
The fill-based rules need a still and print SKIP. `--clip` adds figure_shape's garment clip counts
(PS-P21). `render` writes the same file next to each still, with that view's camera and pixel
anchor.

On the current idle_hero (not an appeal pose), check reports a weight knee of 40°, a free knee of
46°, and the pit of the neck 7.6 px off the weight ankle at 144: the critics' "half-squat" in
numbers.

```sh
B="python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python tools/pixel-pipeline/rosace_v2/figure_pose.py --"
$B check --pose idle_appeal_a [--out <json>] [--clip]          # default --blend lanes/figure-pose-base.blend
$B render --pose idle_appeal_a --out <dir> [--views cam,side:@left,back:@back] [--px 144,80] [--ss 4] [--hi 0] [--posing]
$B roundtrip --pose idle_hero [--out <json>]                  # exit 1 on any difference (PS-P22)
$B apply --pose idle_appeal_a --save D:/Dex/Projects/dex-place-art/rosace/build/lanes/figure-pose-<name>.blend
python tools/pixel-pipeline/rosace_v2/figure_pose.py post --root <dir>                    # rosace_post on every still
python tools/pixel-pipeline/rosace_v2/figure_pose.py sheet --root <dir> --out review/rosace/art/figure-pose/<name> [--label A]
python tools/pixel-pipeline/rosace_v2/figure_pose.py diff --a <dir> --b <dir>             # still.png pixel diff
```

Views: `cam` is the pose file's camera, `name:<yaw>[:elev]` a fixed yaw, and
`name:@front|@q34|@left|@right|@back` is relative to the posed chest (`side:@left` is the true
profile the bust breaks toward at yaw > 0). Renders go to `<dir>/<view>/px<N>/` (passes,
meta.json, landmarks.json) plus `_render.json`. `sheet` puts each still beside the finish-bar refs
at x3 and x1 (WF-P11). Refs are third-party, so sheets go to `review/` only. The applier saves only
`lanes/figure-pose*.blend` and refuses `rosace.blend`, `rosace_v1.blend` and `rosace_v2.blend`.

**Concept A appeal poses** (figure-pose explore A, 2026-09-29): `art/rosace/poses/idle_appeal_A.json`
(camera yaw 45) and `back_appeal_A.json` (camera yaw 150) are plain pose JSON for this applier; no
code changed. Lane build: `lanes/figure-pose-A.blend` is `figure-pose-base.blend` (S5) with
`idle_appeal_A` applied (`apply --pose idle_appeal_A --save .../lanes/figure-pose-A.blend`). What the
pose data does that isn't obvious from the table above:

- The S comes from per-bone `joints` (spine -30, chest -4, upper chest +14 about y on hips +15), not
  from `torso.bend`: a pelvis roll alone tilts the whole spine to the free side, and `weight` then
  slides the pelvis past the weight ankle (leg 8° off vertical). `torso.bend` carries only the chest
  lift (x -9) and the turn back to the camera (z -5).
- The free foot target is placed in the pose camera's picture plane at a hip-to-ankle chord of 1.0 m
  (knee about 15°); with the weight leg locked that caps the heel gap at about 32 px at 144
  (ART-RULES O-32). The back pose re-aims the free leg out and back into the back camera's plane
  (PS-P23).
- The glaive is placed with `weapon {butt, dir}` from a chosen butt and hand point, and the hand
  grips `grip_main` with `slide` = |hand - butt| - 1.489 m, so a head-height grip lands exactly
  (PS-N21: IK miss 0 mm).
- Drape winds move the near sleeve and side hair back (arm window), the tabard onto the free-leg
  diagonal, the stoles behind the raised arm, and in the back view the hair tail and back hair to
  her left, off the open back.

Exploration used the applier as a library, not new code: `lanes/figure-pose/work/A/` holds
`batch_check.py` / `batch_render.py` (apply + measure or render many pose files in one Blender
process), `gen.py` (the variant generator), `fillcheck.py` (approximate fill measures for PS-P10,
PS-P02, PS-N07 and bays for PS-P17) and `make_review.py` (stills, silhouettes, blind sheets and
key.json in `review/rosace/art/figure-pose/explore/A/`).

**Concept C appeal poses** ("leaning on the lance", figure-pose explore C, 2026-09-29):
`art/rosace/poses/idle_appeal_C.json` (camera yaw 35) and `back_appeal_C.json` (the same body and
glaive, camera yaw 225) are plain pose JSON for this applier; no code changed. Lane build:
`lanes/figure-pose-C.blend` is `figure-pose-base.blend` (S5) with `idle_appeal_C` applied. What the
pose data does:

- Weight on the near (glaive-side) leg, `weight {leg R, knee 176, over neck, offset}`: the offset puts
  the pit 1.7 px toward the glaive (inside PS-P07's 2 px) to buy reach. The S is per-bone `joints` as
  in concept A (hips y 15.5, spine y -37, upper chest y +20): the lumbar shifts the ribcage over the
  weight leg while the shoulders stay at 13.6°.
- The glaive leans 20° on screen with the butt just outside the weight boot. PS-P24: with the pit
  over the weight ankle the gripping shoulder can't reach a 22-25° haft planted outside the boot
  (0.53-0.70 m); 25° only reaches from a butt under her toe, which crosses the weight shin.
- The free foot is grounded en pointe: ankle at z 0.195 m with pitch 45 keeps the ball on the floor
  (higher ankle targets float the foot). The free hand is placed with `hands.L {rel: upper_chest}` at
  the neck, elbow up (the collar hand covered the bust band). The back view keeps the idle's world
  placement and turns the upper chest 6° and the head (`look`, max 80) toward the camera.

Exploration used the applier as a library: `lanes/figure-pose/work/C/` holds `gen_c.py` (a base
dict plus one-axis patches; the glaive and free foot are set in the idle camera's screen frame:
lateral, depth, lean), `probe_c.py` (applies many candidates in one Blender process and prints the
rig checks, the haft's screen lean, the shoulder-to-haft reach and the haft-vs-limb angles),
`runb.sh` (waits until no Blender runs, then runs one), `montage.py` and `sheet_c.py` (blind sheets
and key.json in `review/rosace/art/figure-pose/explore/C/`).

**Concept B appeal poses** ("glaive across the shoulders", figure-pose explore B, 2026-09-29):
`art/rosace/poses/idle_appeal_B.json` (camera yaw 48) and `back_appeal_B.json` (the same body from
behind-left, camera yaw -155) are plain pose JSON for this applier; no code changed. Lane builds:
`lanes/figure-pose-B.blend` (`idle_appeal_B` applied) and `lanes/figure-pose-B-back.blend`
(`back_appeal_B`), both from `figure-pose-base.blend` (S5). What the pose data does:

- The glaive is placed with `weapon {at, socket: grip_mid, dir}`: grip_mid sits 3 cm behind and above
  the posed back-of-neck point (upper-chest rest point 0, 0.045, 1.535 carried by the bone) and `dir`
  is the posed shoulder line plus 6° of rise toward the blade (22° on screen). The wrists are
  top-level `hands {pos, fdir, palm}` 3.5 cm above and 2 cm in front of the haft axis, fingers down and
  forward, so both hands hang over the front of the haft. **The weapon and hands are in the root frame,
  so they must be re-seated after any torso change** (the neck moves 3-4 cm): the lane's `place.py`
  writes those numbers from a check (ART-RULES PS-P25).
- The S lean sits low (`torso.bend` y -17 with split 0.7 / 0.2 / 0.1 on spine / chest / upper chest):
  a lean high in the chest moves the shoulders, not the pit, and left the weight leg 6-7° off
  vertical. `weight.offset` [0.006, -0.025] trades the fore-aft lean against the pit's ±2 px.
- The wide λ uses PS-P20's per-pose cheat `"J_Bip_L_UpperLeg.scale": 1.1` on the free leg. The leg
  IK re-solves after `.scale`: the longer chain keeps the foot on its target and only bends the knee
  more, so aim the target at the real spot (heels 36.5 px at 144 instead of about 19 px; ART-RULES O-33).
- Drape: sleeves g 0.25 and stoles g 0.35 with wind back along the raised arms (they otherwise hang
  as a slab and as white strips); in the back view the back hair and tail are swept over her right
  shoulder (g 0.25-0.3), off the spine, and she glances over the open-arm side (PS-N22).

Exploration used the applier as a library: `lanes/figure-pose/work/B/` holds `fpB.py` (one Blender
process checks or renders many pose files and adds haft measures: neck-to-haft and wrist-to-haft
distances, the haft's screen tilt and ends, the figure's projected size), `place.py` (seats the haft
and wrists from a check), `run.sh` (waits until no Blender runs, then runs one); the review folder
`review/rosace/art/figure-pose/explore/B/` holds the variants, `sheets_B.py` (silhouettes, labelled
and blind sheets, key.json) and `rules_B.py` (rules_check on the stills through outfit_lane's
adapter).

**Refine round 1: the kept appeal poses** (figure-pose refine, 2026-09-29, from the judges' winner A
with their grafts from C and B). `art/rosace/poses/idle_appeal.json` (camera yaw 45) and
`back_appeal.json` (the same body, camera yaw 150) are plain pose JSON for this applier; no code
changed. **Lane build `lanes/figure-pose.blend`** is `lanes/figure-pose-base.blend`, now rebuilt with
shape.json's `current` **S7** (3.6f), with `idle_appeal` applied
(`apply --pose idle_appeal --save .../lanes/figure-pose.blend`). What changed against concept A:

- The glaive moved to the near, weight-side right hand (`hands.R {grip: grip_main, slide}`), planted
  just behind the weight heel and leaning 16° away on screen, the hand at the chin row (grip 1.70 m).
  The haft now stands on the side away from the bust profile (PS-P16). A head-height grip caps the
  lean at about 16°; 18-25° needs a lower grip or a straight arm (ART-RULES PS-P26).
- The free left hand is at the lips with the elbow up and back (`figure.hands.L {rel: upper_chest}`,
  arm pole behind the shoulder) and its sleeve blown back behind the hair (PS-N23); the raised glaive
  arm's bell sleeve hangs (drape g 0.9, PS-P27).
- Stance: B's `"J_Bip_L_UpperLeg.scale": 1.1` cheat, the free foot 0.58 m out on screen, pitch 22 (the
  pointed foot's screen turn-out comes from its pitch): heels 39 px at 144. The pelvis carries the
  extra turn (hips z 10) and the arch (hips x 7), the glaive shoulder is lifted (`shoulder.R` y 12):
  shoulders 13.6° against hips 13.0°, pelvis / chest / head 53 / 50 / 20° from the camera.
- The back view re-aims the free leg into the back camera's plane (heels 40 px), leans the glaive 14°
  away with the butt outboard of the weight boot (off her back), and turns the head fully (look neck
  0.5, max 85) over the near shoulder. Side hair hangs (drape side_R g 0.9): the idle's flick is gone.

Work scripts (outside the repo): `lanes/figure-pose/work/R1/` holds `gen_r1.py` (A's pose files plus
patches, with the free foot and the glaive set in the camera's screen frame: lateral, depth, lean,
grip height), `sw*.py` (one-axis sweeps), `probe_r1.py` (applies many candidates in one Blender
process: rig checks, glaive lean, grip height and reach), `render_r1.py` (renders a list through the
frozen `render_pose`), `strip.py` and `islands.py` (skin islands in the bodice). Review, git-ignored:
`review/rosace/art/figure-pose/refine/round-1/` holds `make_r1.py` (blind idle and back sheets at
144 and 80, x3 and x1, with refs 07, 09, 04a and 04b, black-fill silhouettes, key.json, and the kept
stills under `kept/`) and `rules_r1.py` (rules_check through B's adapter).

```sh
# one Blender at a time (lanes/figure-pose/work/waitblender.sh); B as in the block above
$B check --pose idle_appeal --clip --out <json>
$B apply --pose idle_appeal --save D:/Dex/Projects/dex-place-art/rosace/build/lanes/figure-pose.blend
python review/rosace/art/figure-pose/refine/round-1/make_r1.py     # after render_r1.py + post
```

**Refine round 2: balance, glaive framing, back view** (figure-pose refine, 2026-09-29, on the round-1
critique: the idle leaned 15° toward the glaive as one slab, the haft crossed the hip, the back view
lunged with a spread glove). `art/rosace/poses/idle_appeal.json` (camera yaw 45) and `back_appeal.json`
(yaw 150) are replaced; round 1's are kept as `idle_appeal_r1.json` / `back_appeal_r1.json`. Plain pose
JSON for this applier; no code changed. **Lane build `lanes/figure-pose.blend`** = `figure-pose-base.blend`
(shape.json `current`, S7) with the new `idle_appeal` applied. What the pose data does:

- Concept A's layout again (the critics' best-balanced control): the glaive in the far left hand, butt
  1.0 m out on screen and 0.15 m behind the weight ankle, leaning 19° in (an A-frame), grip 1.66 m, IK 0,
  elbow 50°; the near right hand on the cocked hip. The haft frames her and never crosses the hip.
- The hip shift comes from the lumbar, not the pelvis roll: `figure.weight` holds the pit over the
  ankle, so `joints.spine` y sets where the pelvis lands (-30 → pelvis on the ankle; -22 → weight hip
  4.5 px outboard, leg 3.8° off vertical). `upper_chest` y +6 keeps the shoulders at 13.9° against
  hips 13.7°. Arch `torso.bend` x -12, `look` chin 7, tilt 12.
- Stance: free upper leg 1.1 (PS-P20), free foot 0.60 m out and 0.10 m toward the camera: heels 41 px
  (144) / 23 (80), free knee 25°. Both bell sleeves hang (g 0.9, no wind).
- Back: the same body from yaw 150, free foot re-aimed and pulled in (0.57 m out, 0.31 m toward the
  camera: heels 36 / 20 px), the glaive beyond it leaning 19° in with `weapon.edge` set to the back
  camera's screen axis (0.87, 0.5, 0) so the blade shows its flat, the near hand hanging on the outer
  thigh (`figure.hands.R {rel: hips}`, fingers grouped) with its sleeve blown forward in front of her
  (g 0.3, wind 0.9, -1.2, 0.2), hair tail and back hair swept over the far shoulder, head over the
  near shoulder (look amount 1, neck 0.5, max 85).
- Balance check PS-P28 (new): pit-to-weight-ankle, torso axis and the black-fill silhouette's
  principal axis without the weapon (`review/.../refine/round-2/axis.py`). Round 1's idle 18.6°,
  concept A 6.4°, the kept idle 10.6°, the kept back -5.4°.
- Shape: `S9` in shape.json (S7's volume, under-fold bump -2 cm, lift 5, projection 0.24; fold jump
  6.94 px) is built as `lanes/figure-pose-base-S9.blend` for the blind round; `current` stays S7.

Work scripts (outside the repo): `lanes/figure-pose/work/R2/` holds `gen_r2.py` (A's pose files plus
patches, screen-frame knobs for the free foot and glaive), `sw*.py` (sweeps), `probe_r2.py` (round 1's
probe plus the projected landmarks), `render_r2.py`, `rep.py` (one line per probe), `runb.sh`. Review,
git-ignored: `review/rosace/art/figure-pose/refine/round-2/` holds `make_r2.py` (blind idle and back
sheets with refs 07, 09, 04a, 04b; 144 refs at their native grid, 80 refs box-resampled to 80 px and
snapped to their own median-cut palette; WF-P15 shuffle; key.json; kept stills under `kept/`),
`rules_r2.py` (rules_check with a complete construct-schema pose.json from landmarks.json, so the FG
rules run instead of erroring, plus PS-P28), `axis.py` and `strip.py`.

```sh
# one Blender at a time (lanes/figure-pose/work/waitblender.sh); B as in the block above
$B check --pose idle_appeal --clip --out <json>
$B render --pose idle_appeal --out <dir>/idle_appeal --views cam --px 144,80    # then: figure_pose.py post --root <dir>
$B render --pose back_appeal --out <dir>/back_appeal --views cam --px 144,80 [--blend .../lanes/figure-pose-base-S9.blend]
$B apply --pose idle_appeal --save D:/Dex/Projects/dex-place-art/rosace/build/lanes/figure-pose.blend
python review/rosace/art/figure-pose/refine/round-2/make_r2.py [--labelled]
python review/rosace/art/figure-pose/refine/round-2/rules_r2.py idle_appeal=<dir>/idle_appeal,back_appeal=<dir>/back_appeal
```

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

**Shading stage (`--shade`, shading lane round 1, 2026-09-29) [in progress; off by default in
`rosace_post.py`, on in the canonical stills since the Integrate step (3.6g, preset `shading_r3g.json`)].** `rosace_shade.py`, called after cleanup and
`face_flat`: re-bands skin, white, veil, stocking and boot from two new passes that
`materials.py` writes (`light`: R = the continuous ramp input, G = ao, B = spec band; `depth2`:
the mapped depth in two bytes, ~0.1 mm steps). Per form: normals blurred inside one
(material, part), terminator at a quantile of a designed light (PX-P30 budget), screen-space
cast shadows over `depth2`, 3x3 majority, island merge, no 1 px shadow strips, anti-hug; gold
trims by edge exposure; tone-space painted overrides for key frames
(`art/rosace/overrides/global/paint/<pose>_<px>.json`, WF-P12). Presets:
`art/rosace/overrides/global/shading_r1<v>.json` (round-1 pick `l`). The lane renders from
`build/lanes/shading.blend` (`rosace_shade_lane.py`: the canonical file with the materials
rebuilt, geometry untouched). Compositing order: post (with the stage) -> `overrides.py`
(preface, face, glyphs, patches, rim) -> the preset's hex remap last (`rosace_shade_stills.py`),
so codes keep their identity through every lane's layer. Checks: `rosace_shade_check.py`
(rules_check on rendered stills); sheets: `rosace_shade_sheets.py`.

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
- **80 px stamps** (2026-09-29, first draft, for the v2 refit's in-world height): q34 serene and
  resolute, front radiant, profile serene (3.6c). Other facing/expression pairs at 80 fall back
  to serene, or to no face where there is none ("no face stamp ... face skipped").
- **Pixel glyphs** (`glyphs.py`) use the same idea for non-face details DESIGN gives in pixels
  (the collar cross): stamp file per px, projected anchor, part masks (3.6c).
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
| Base v2 (SiroinoSotai body + MMD用女性素体 head, 3.6b) | **adopted 2026-09-29 (3.6e): `rosace.blend` is built from it**; v1 kept as `rosace_v1.blend`. Bust 18.1 px deep, waist/hips 0.417, crotch 53.7%, thighs 10.8 at 144. All 10 poses apply, jiggle settles, stills 0 off-palette. Open: N1 off-hand gap 4.59 cm (was 3.35) |
| Integrate (3.6g: outfit R2Q, glaive l5 + constructed hands, hair r2f + hair pass, face F2b, shading r3g in one build and one stills chain; `integrated.json`) | done 2026-09-29: `rosace.blend` rebuilt (pre-integration file kept as `rosace_pre_artistry.blend`), 10 stills at 144 and 80, 0 off-palette, 20-25 rule passes per still (pre 15-19), N1 r3c strip with `motion_finish.py`. Open: 34 colours at 144 (PX-P15 cap 32); faces, hands and outfit/hair pixel passes are stills-only; the shading lane's idle 144 paint is STALE on the new pose; blind `ab/` sheets await a critic |
| Refit on v2 (3.6c: hair, veil, outfit, glaive, revision-3 palette, collar-cross glyph, 80 px faces) | built 2026-09-29, adopted with the base (3.6e), judged in the blind A/B (3.6d): the four stills at 144 and 80 px (0 off-palette), 12 hero/still poses dressed at hi-res, N1 r3c on the dressed rig with soft-tissue springs (144, 80, 640). Content-deterministic build. Every v1 hand patch STALE; 80 px faces a first draft |
| Pixel glyphs (`glyphs.py`) | proven on the collar cross, 144 and 80 px, 2026-09-29 |
| Blind base A/B (3.6d: v2 vs current base, same outfit; 144 + 80 px idle, N1 contact, back, N1 strip; v2 vs refs 07/09) | judged 2026-09-29: v2 6/10, old base 5/10; its cheap top fixes (bust, waist, thighs, leg length) applied in 3.6e, the pose fixes not |
| Bust shape variants (3.6f: `figure_shape.py`, S0-S4 on the v2 body, garments keyed to follow) | built 2026-09-29 in `lanes/figure-pose-shape*.blend`, blind sheets in `review/rosace/art/figure-pose/shape/`; not adopted. S3 and S4 fail PS-N20 (shelf); +30% (S2) is the ceiling. FP2: the critics picked S3; S5 (S3's lift with S2's mass plus an upper fill, shelf 2.92) is shape.json's `current` and is applied in `lanes/figure-pose-base.blend`. Not promoted: a blind S3 vs S5 round comes first. Refine round 1: S7 (+42%, lift 4) and S8 (+50%) added, shelf ≤ 3.03; `current` = S7 and `lanes/figure-pose-base.blend` rebuilt with it, pending the blind S5/S7/S8 round in `review/rosace/art/figure-pose/refine/round-1/` |
| Figure-pose applier (3.7b: `figure_pose.py`, a `figure` block on top of posing.py, check mode with landmarks.json) | built 2026-09-29 (FP2). Round-trip proven: all four pose files bone-identical to posing.py, idle_hero stills pixel-identical at 144 and 80. Rig-measurable PS checks in; the fill-based ones (PS-P02, P10, P16, P17, N07, N10) and the posed bust rows still to build (lane helper `work/A/fillcheck.py` approximates P02, P10, P17 and N07) |
| Drive 9: the combined build (3.6l: F3 L + F2 head 1.10 + figure-pose appeal poses and S7 + the re-tuned F1 finish; `drive9.json`, `lanes/drive9.blend`) | built 2026-09-29; **round 2 promoted 2026-09-29 (3.6r)**: `build_rosace_v2.py` and `stills_v2.py` make its look by default (0 px from the judged stills; `rosace_pre_drive9.blend` is the backup). Idle, N1, Q and back at 144 and 80 plus the N1 motion through the finish. Whole round 1 (3.6m): blind sheets against refs 07/08/09/04 (+05 at 80) and the current build in `review/rosace/art/drive9/round-1/`, judged 5-5.5. Round 2 (3.6n) judged 5.5-6.2. Round 3 (3.6o) judged 5-5.5 (it regressed from round 2 on arms, posing and finish). Round 4 (3.6p): the round-3 fixes plus ESCALATION 2, a hand-authored paint-over on the four key stills at 144 and 80 (`art/rosace/overrides/drive9/`), blind sheets in `round-4/` with round 3 as prev and the render without the paint-over as under, judged 5.2-6 (paint-over and bare render tied). Round 5 (3.6q): the round-4 fixes plus ESCALATION 3, the same fixes on a recombined build (`lanes/drive9n.blend`: F3 N, the far bell blown back behind the haft, a lower key) picked over round 4's build by side-by-side; blind sheets in `round-5/` with the other mix as alt and round 4 as prev, judged 5.0-5.7 (5.36; round 4 as prev 5.68). Open: the chain's pixel passes (constructed hands and weapon, glyphs, collar cross) and smears aren't in the finish; the stance fix belongs to the figure-pose lane |
| Appeal poses, refine round 1 (3.7b: `idle_appeal.json`, `back_appeal.json`) | built 2026-09-29 in `lanes/figure-pose.blend` (S7). Idle passes every rig check at 144 (PS-P01 at 80 fails, O-32); bust break 10 / 5 px at 144 / 80, bust keep-out 0 px, no skin islands. Awaiting the blind round against refs 07, 09, 04a, 04b; not promoted |
| Route F1, hi-bit painterly finish (3.6i: `finish_f1/`, painterly material branch, 4x render, per-group OKLab palette, selective coloured outline) | built 2026-09-29 as a lane (`lanes/finish-F1.blend`), not promoted. Pick P4 passes 44 of 60 measured targets (control 11); blind sheets in `review/rosace/art/finish/F1/` await a critic. Open: PX-P15 (43-45 colours), N1 chromatic 0.78, O-35 |
| Route F2 head scale (3.6i: `finish_f2/`, head 1.10/1.15/1.20 at pose time, bigger 144 eye stamps) | trial 2026-09-29: pick H110E (head ÷ H 0.181 → 0.195 on the appeal idle, inside the refs' 0.14-0.20; H120 0.208 rejected as big-headed). One judge (blind to the key), not promoted: no `integrated.json` hook yet |

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

### 8a. Isolated window/face construction continuation (2026-09-30)

- **Proven source check, native in progress:** `next/window_mesh_recipe.py` plans an anterior
  bodice face-only opening from the preserved sternum anchors (about118mm high,44mm half width)
  plus a separate gold boundary strip5mm radially wide. `next/nx_window_mesh_blender.py`
  installs it on an in-memory mesh copy after R2 edits, before pose/render. Preserves original
  vertices/weights/keys/point data and retained face/UV/corner data by native assertions; one
  new closed loop, actual body/collar/cross geometry untouched, no blend save. Synthetic
  front/back topology fixture passed; this is not an installed Blender/shape-key proof.
- **Proposed finite native comparison:** `art/rosace/next/window-mesh-request.json` has explicit
  control/mesh modes, idle only, hand1.0/head1.10/ss4 at144/80. Resolve all paths to executing
  frozen worktree. Sole delivery native/GPU leases at a free boundary, world priority retained.
  `next/window_mesh_post.py --root <private-native-output> --reference <preserved-R2-control>`
  runs unchanged R2 finish, demands exact control pixels and categorical native body/skin
  gain inside the projected aperture, and reports outside-window/alpha changes honestly.
  Actual cloth termination, thin continuous gold rim below cross and skin readability still
  need pixels plus three fresh fixed9 critics. Prior Window1 applique direction stays rejected.
- **Proven actual finish-only pixels, unpromoted:** `next/face2_trial.py --root <genuine-R2-raw>
  --out <fresh-private-review>` compares R2, prior F1 eye seed and Face2. Shared eyeline slope
  0.192, tapered lids/brows/shared iris offset, cheek/jaw planes; native head/pose unchanged,
  original mouth cells exact. Controls0px; final changes93/18 at144/80, all within declared
  face box, alpha0. Late global skin requantization leaked56/1 outside-face intermediate
  pixels; explicit face-region composition discards those changes and preserves intermediate
  diagnostics. Three fresh actual-pixel critics: two prefer F1, craft prefers R2 at144 and
  ties R2/F1 at80. Noneface9; Face2 does not beat its seed and remains unpromoted.
- **Acceptance in progress:** all old/new supplied references are fixed9 for shown parts;
  unshown/motion partsnull; no average hides a weak part. Canonical R2/two rollbacks/seven maps
  and frozen62/72/322 packets stay exact. Physical sleeve/tabard moving clips, collisions,
  gameplay transitions and playback remain mandatory and pending from separate immutable72
  source. See `WINDOW-MESH-FACE2.md` for source commands, limitations and private proof paths.

### 8b. Auxiliary-reference permission (2026-09-30)

**Authorized auxiliary use, not production acceptance:** Dex now permits built-in Imagegen
only as an additional reference. Read the installed Imagegen skill first; no API key or silent
CLI/API/model fallback. Keep generated guides and prompt/tool/input/output/hash provenance
private and git-ignored, clearly labelled GENERATED REFERENCE ONLY. They may inform original
authored geometry/construction, with no tracing, pixel copying, downsampling or generated
sprite/texture/scene/UI substitution. All17 human references remain fixed9. A generated guide
is not automatically9, a Rosace candidate, native output, cloth proof or visual progress.
Keep it out of genuine PREVIEW/READY queues. R2/rollbacks, frozen native packets and the
three-fresh-critic/moving-physics gates are unchanged. Exact scope is in ITERATION-CONTRACT.

**Proven auxiliary tool output only:** one built-in generated facial-construction guide was
inspected and copied byte-exact into private ignored review storage with prompt/input/output
provenance. Its model ID was not exposed and is not inferred. Generic perspective/under-jaw
cues may inform questions; longer hair and diadem/cross design drift are excluded. Neither
the guide nor its illustration polish establishes144/80 readability or native quality.

**Source reviewed, execution in progress:** `next/face_native_diagnostic.py` compares only
preserved genuine R2 beauty/ID/normal/light/landmarks with finished face pixels, no generated
image input, repainting, geometry edit or Blender run. Its first shared-gate attempt timed
out at120seconds behind delivery's exclusive lease without executing. No measured output
exists yet. `FACE-CONSTRUCTION-SOURCE.md` maps the socket-filled visible head, welded custom
normals, hidden feature references and eye-bone anchors. Diagnose those actual relationships
before a new coherent face cage or bounded front-normal experiment; preserve the neck seam.
Guides/baseline diagnostics remain outside genuine candidate queues; READY794 stays frozen.

### 8c. Literal pixel guide reconstruction (2026-09-30)

- **Proven auxiliary output, not native art:** built-in full-character pixel guide generated
  from R2 identity/outfit14/human04+17; private provenance and exact copyhash. Actual1024x1536
  with mixed apparent grid, not verified144/80. Human17refs remainfixed9. No guide raster
  is consumed by production recipe/renderer/finish; no paste/tracing/downsampling.
- **Proven authored finish prototype, unpromoted:** `next/reconstruction_finish.py` on genuine
  R2 raw: control0px144/80, candidate4298/1360changed,alpha0; uniqueRGB197->165/170->142,
  not29color compliance. Three fresh actual-pixel critics: smallface gain144, others/world
  largelytie, none9. Existing mesh/pose/hands/closedwindow unchanged in this prototype.
- **Source in progress, native pending:** `next/reconstruction_recipe.py` and
  `nx_reconstruction_blender.py` compose conceptA torso/hip/chest rhythm, hip freehand,
  seated1.30 authoredhands and actualW2 copied-mesh aperture beforepose, with unchanged
  headscale/tilt/feet/weight/weapon/palette ramps. One explicit dispatch; frozen helpers
  unchanged. ModesR2control/newconstructionclosed/fullreconstruction,144/80sixstills.
  `reconstruction_native_post.py` requires exactR2 and samepose/bone matrices/framing plus
  nativebody/skin gain betweenclosed/open. Threefreshactualcritics/movingcloth stilldue.
- **Proven baseline diagnostic after earlier gate timeout:** genuine R2 native pass crops
  show jaw turn;144screen-band mediancheeklight0.545,jaw0.424. No newBlender run, no geometry
  winner inferred. Do not blindly reconstruct welded normals. See PIXEL-GUIDE-RECONSTRUCTION
  and explicit `art/rosace/next/reconstruction1-request.json` for source/limits/finite gates.

### 8d. Actual native preservation finding (2026-09-30)

**Native observed, opening unqualified:** frozenbcb under5.1.2 rendered R2control andclosed
construction144/80 raw; finishedcontrolstill/ground0px. Actualopening stoppedbefore-render
atretainedface/UV/corner equality, code1/nottimeout. Inputs/R2/maps/rollbacks remainedexact;
no complete integratedopening candidate ornewfullcriticwave. Do notlabel4xrawbeautynativefinish.

**Source correction, nativepending:** mesh_preservation.py compares fulltyped orientedloop
multisets, normalizingonlyfacearrayorder/cyclicstart withUV/corner associations rotatedtogether.
No tolerance, reversewinding, omittedinternalattrs, schema/value loss orduplicate-count waiver.
Requiredcorner-edge storageindices comparebyactualedge identity, withrawindices in diagnostics.
Sourcefixtures pass order/cycliccases and rejectrealdata corruption. Native diagnosticrecords
mustestablishactualcause; oldtrace alonecannot. SeeWINDOW-NATIVE-PRESERVATION.md and finite
window-preservation-repair-request.json. Frozenbcb/794/62/72/322 stayunchanged; integrator owns
sharedrepair while specialistskeepseparate namespaces and criticsown newactualacceptance.

### 8e. Specialist motion/art source integration (2026-09-30)

**Ownership active; interfaces proposed:** six named specialists own attacks/motion/refinement/
artistry/effects/critics in separate art/docs namespaces. Rosace source integrator alone resolves
shared builders/MOVESET/PIPELINE; sole deliveryowns native/model execution/publication and
rosace-critics owns3fresh-history panels for materiallynew actualstills/fullmovingcycles.
No duplicateimplementation/integrator criticwaves or dexCode motioninventory delegation.

**Existing source/artifacts, incomplete acceptance:** N1/N5 directretarget/actions/timing/hero
keys/springdrape/smears andsome144frames exist; blanketStep11blocked text corrected above.
Full80/144views/fullkit/actualmeshcloth/glassstages/runtimeexport remainunverified. OldpublicLAB
standin finding islab-package-specific, notproof no worldsprite exists. Preservehistoryscores,
all17humanfixed9refs and R2/frozen bcb/794/62/72/322/two rollbacks.

**Proposed finite stages:** sharedwindowrepair first; N1 five-key80/144gameplaypairs then one
33tick body/meshcloth cycle withwithoutFX/contact-vs-whiff; oneN1->N2transition; selected
multiviewkeyreference andlaterfullkit cycles. No giantcartesianrender batch. Requiredchannels
include scales/Root/feet/weapon/grip/fingers; FXH-normalization, clock/encodedplayback and
physicalcloth/world-root-inertia boundaries explicit. SeeSPECIALIST-INTEGRATION.md and
art/rosace/integration/specialist-interfaces-v1.json. A writtenmatrix isnot renderedacceptance.
