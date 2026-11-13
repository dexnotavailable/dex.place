# art-construct: drawing Rosace like an artist, in code

These tools build a face and a figure the way a pixel artist would. They start from construction
guides and an underdrawing, add a block-in, and only then place pixels. Every step is written as
data. Then they check the result against `docs/character/ART-RULES.md` and put it beside the
finish-bar refs at the same zoom. No image generation is used anywhere. The 3D render is at most
a faint reference layer under the gesture.

Python 3 with numpy and Pillow; no scipy. Run from the repo root.

| Tool | What it does | Writes |
|---|---|---|
| `face_construct.py` | Builds a face from parameters: head size, yaw bucket (front, q34, profile), roll, pitch, expression, gaze, and the variant axes. It draws the construction first: the head ball, side plane, curved centre line, FC-P01 grid rows, jaw contour, hair mass and clump spines. Then a flat block-in. Then it places features from the authored library (`art/rosace/construct/faces/feature_library_144.json`), with designed cast shadows and clump shading | `art/rosace/construct/faces/<name>.json` (stamp rows + face.json landmarks + params), `.png`, `_ids.png`, `_parts.png`; with `--sheet`, `review/rosace/construct/face/<name>_construct.png` |
| `figure_construct.py` | Builds a figure from a gesture spec (`art/rosace/construct/figure/<pose>.gesture.json`): line of action, shoulder and hip tilts, weight foot, hand and foot targets, and IK for the elbows and knees with per-segment foreshortening. Then the mannequin (rib-cage and pelvis boxes, tapered limb cylinders), the solid silhouette with its negative space, the costume, shading with one key light, the outline (with a pixel-perfect pass and contact lines between light materials), and the pixels. The head comes from `face_construct`. `--ref` lays the 3D render under the gesture as a reference only. `--thumbs` builds and scores the spec's thumbnail variants (WF-P03) | `art/rosace/construct/figure/<pose>/`: `sprite.png`, `sprite_ids.png`, `sprite_parts.png`, `pose.json`, `face.json`, `construct.json`, `thumbs/`; `review/rosace/construct/figure/<pose>_construct.png`, `<pose>_thumbs.png` |
| `rules_check.py` | Runs every rule in `docs/character/art-rules/checklist.json` on a sprite and/or face. It prints PASS/FAIL with the measured value and the target; semi rules are marked `*`, critic-only rules show as CRITIC, and rules that don't apply show as SKIP with the reason. The exit code is 1 on any block-severity FAIL | stdout; `--json` |
| `sheets.py` | Review sheets on the `tools/pixel-pipeline/stills_sheets.py` conventions. Blind A/B sheets against refs 07, 08, 09 and 04, with panels on native grids at one zoom, sides shuffled with a seed, and `key.json` recording which side is ours. Also a face-vs-ref-head A/B, the expression set beside the ref heads, and a before/after against the round-4-fix 3D still | `review/rosace/construct/ab/` |
| `pixel_metrics.py` | The research metrics (banding, clusters, outline, values, border contrast); `rules_check` borrows its banding count | stdout / `--json` |
| `finish_metrics.py` | The finish-gap numbers for our stills (`docs/character/art-rules/finish-gap.md`): chroma (median S, chromatic and accent shares), the L* register, the near-black share of the silhouette ring, tones per material, banding and cluster size (from `pixel_metrics.py`), and mass. The ref side is in the git-ignored `review/rosace/art/finish-gap/` | stdout / `--json` |
| `rules_sync.py` | Checks that ART-RULES.md and checklist.json agree | stdout |
| `face_crop.py`, `face_map.py`, `patch_tones.py` | Research helpers from the rule-writing pass | review/ |
| `artlib.py` | Shared code: palette, layered canvas (code / material id / part id), raster primitives, masks and components, guides drawn at zoom, sheet helpers | – |

## The loop (ART-RULES section 1)

```sh
# 1. faces: the six expressions, one-axis variants for WF-P04, then check
python tools/art-construct/face_construct.py --batch art/rosace/construct/faces/set_q34_144.json --sheet
python tools/art-construct/face_construct.py --batch art/rosace/construct/faces/set_q34_144.json --variants
python tools/art-construct/rules_check.py --face art/rosace/construct/faces/q34_confident_144.json

# 2. figure: thumbnails first (score, keep two), then the chosen spec with the 3D reference layer
python tools/art-construct/figure_construct.py art/rosace/construct/figure/idle_hero.gesture.json --thumbs
python tools/art-construct/figure_construct.py art/rosace/construct/figure/idle_hero.gesture.json --ref --sheet
python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero --fails

# 3. look: blind A/B against the finish bar, the expression set, before/after
python tools/art-construct/sheets.py all

# 4. write down what changed and why: ART-RULES section 10, then
python tools/art-construct/rules_sync.py
```

A failed check goes back to the step that owns it (WF-P06). The fix goes into the gesture spec,
the feature library or the construction code, never into the output pixels. Every spec and library
file is data, so a round of trial and error is a diff someone can read.

## Coordinates and data

- **Pixel grids** in the data files use one character per palette code; the map is `KEY` in
  `artlib.py` (O = OL, a/b/c/h = A2–A5, w/e/f/g = W1–W4, 1/s/t/m/p = S1–S4/SB, j/k/l/n/d = I0–I4,
  u/v/x/z/q = G0–G4). `.` is empty.
- **Face rows** count up from the chin (row 0), as in ART-RULES 6.2. A face is authored facing
  screen-right; `facing=left` mirrors the finished pixels (the key light swaps with it, DESIGN 9).
- **Gesture specs** use `h` (px above the sole) and `dx` (px from the body centre at the feet,
  + = the side she faces). Tilts are the angle of the near→far line, + = the far side up.
- **pose.json** (written by `figure_construct`) is the checker's wireframe input: canvas
  landmarks, the line of action, the axes, feet boxes, grips, hand construction flags, and the
  keep-out and must-be zones in canvas polygons. **face.json** holds the landmarks for a face stamp.
  Both follow the schemas proposed in checklist.json's `inputs`.
- **ids / parts** layers: the R channel is the material id (palette.json `materials`) or the part
  id (`PART` in `artlib.py`). The checker uses them for negative space, grips, contact lines and
  zones.

## Tags

As in the character docs: **[M]** measured, **[S key]** a source below, **[I]** our inference.
Every construction number in the specs and library is [I] until the learning log confirms it.

## Where each construction step comes from

The keys are those of ART-RULES section 12 (all accessed 2026-09-29). Only the sources a tool's
construction step implements are listed here. The rule-level basis for every threshold is in
ART-RULES and checklist.json.

| Step in the tools | Source | Author | URL |
|---|---|---|---|
| Head ball, side-plane oval, curved centre line (`face_construct` step 1) | proko-head, after Loomis *Drawing the Head and Hands* (1956) | Stan Prokopenko | https://www.proko.com/course-lesson/how-to-draw-the-head-from-any-angle |
| Anime grid rows: eye line near half the head, nose halfway to the chin, mouth above halfway | maryli-front | Mary Li | https://maryliart.com/how-to-draw-the-head-anime-style-guideline-front-view-tutorial |
| 3/4: centre line about ¾ across, far eye narrower, nose toward the far eye, chin off-centre | maryli-34 | Mary Li | https://maryliart.com/how-to-draw-the-head-and-face-in-3-4-view-anime-style |
| 3/4 female face proportions | ao-female34 | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-female-face-3-4-view/ |
| Hair as clumps off the skull, from a parting; side clumps swing to their side | ao-hair34 | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-hair-in-3-4-view-step-by-step/ |
| Big eyes, small mouth, almost no nose at pixel scale; hair flow, blob, then shade | slynyrd-29 | Raymond Schlitter (Slynyrd) | https://www.slynyrd.com/blog/2020/7/28/pixelblog-29-anime-faces-and-hair |
| Iris dark on top, light at the bottom; both irises aim one way; whites opposite the gaze | csp-eyes | make.art.alive (Clip Studio Tips) | https://tips.clip-studio.com/en-us/articles/10216 |
| Highlight on the cornea at the iris edge, same side both eyes | csp-konart | Konart (Clip Studio Tips) | https://tips.clip-studio.com/en-us/articles/2623 |
| Expressions change brows, lids and mouth together | faigin (read via summaries) | Gary Faigin | https://archive.org/details/artistscompleteg0000faig |
| No twins; asymmetry as appeal (eye-line roll, brow height, mouth corner) | thomas-johnston; riki-twinning | Frank Thomas and Ollie Johnston (via Prof. Swardson, UNM); J.K. Riki | https://swardson.com/unm/animation1/mod08-solidDrawing.php ; https://www.animatorisland.com/defining-the-art-twinning/ |
| Line of action first; C and S curves; straights against curves (`figure_construct` step 1) | proko-gesture; hampton-gesture | Stan Prokopenko; Steven Michael Hampton | https://www.proko.com/course-lesson/how-to-draw-gesture ; https://www.proko.com/course-lesson/what-you-need-to-know-about-gesture |
| Contrapposto: opposed tilts, vertical weight leg, plumb line from the pit of the neck | london-contrapposto; aam-contrapposto | Vladimir London (Life Drawing Academy); Anime Art Academy | https://lifedrawing.academy/drawing-lessons/contrapposto ; https://animeartmagazine.com/using-contrapposto-to-create-beautiful-standing-poses-for-women/ |
| Three masses on one spine: rib-cage and pelvis boxes (step 2) | proko-bean; proko-robobean | Stan Prokopenko | https://www.proko.com/course-lesson/how-to-simplify-the-motion-of-the-torso-the-bean/ ; https://www.proko.com/course-lesson/how-to-draw-structure-in-the-body-robo-bean/ |
| Head-count proportions, crotch at the midpoint | aam-ratio | Anime Art Academy | https://animeartmagazine.com/head-to-body-ratio-this-simple-anime-illustration-technique-will-give-you-perfect-proportions-every-time/ |
| Negative shapes designed (the arm-gap measurement, step 3) | proko-proportions | Stan Prokopenko | https://www.proko.com/course-lesson/how-to-draw-accurate-proportions |
| Foreshortening: parts turned toward or away from the camera look shorter | han-wide | Peter Han (Proko) | https://www.proko.com/course-lesson/how-to-draw-wide-angle-poses-with-peter-han |
| Hands: palm box, finger mitten, thumb wedge, wrist step | proko-hands | Stan Prokopenko | https://www.proko.com/course-lesson/how-to-draw-hands-from-imagination-step-by-step |
| Weapon weight in the body; hands, weapon and body drawn as one | svarc-gun | Katarina Svarc (PoseMy.Art) | https://posemy.art/blog/drawing-gun-holding-poses/ |
| Folds from tension points (the tabard's pipe fold from the hip band) | hampton-folds | Steven Michael Hampton (Proko) | https://www.proko.com/course-lesson/intro-to-pipe-folds-and-diaper-folds |
| Tangents: separate by a clear gap or overlap (sliver check) | blevins-tangents | Neil Blevins | https://artofsoulburn.com/art_lessons/composition_tangents/composition_tangents.htm |
| One light, one terminator per form, no pillow shading (step 5) | saint11-4; yu-mistakes; slynyrd-6-5 | Pedro Medeiros; Derek Yu; Raymond Schlitter | https://saint11.art/pixel_art_articles/article4/ ; https://www.derekyu.com/makegames/pixelart2.html ; https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow |
| Clusters, orphans, 1 px parts can't hold shading | saint11-2 | Pedro Medeiros | https://saint11.art/pixel_art_articles/article2/ |
| Pixel-perfect lines: no L-corner doubles (outline pass) | rickyhan; mortmort (video) | Ricky Han; MortMort | https://rickyhan.com/jekyll/update/2018/11/22/pixel-art-algorithm-pixel-perfect.html ; https://www.youtube.com/watch?v=gW1G_FLsuEs |
| Banding (the hugging-run metric) | azzi-pixel-logic (read via excerpts) | Michael Azzi | https://pixellogicbook.com/ |
| Materials: glossy streaks, gold as 2 px lit over shade | jansson; imonk | Arne Niklas Jansson; imonk | https://androidarts.com/pixtut/pixelart.htm ; https://itch.io/t/2176027/pixel-tutorial-metal-surfaces |
| Designed shadows over a 3D base ("expressiveness over accuracy"); the render as a reference only | motomura-ggxrd; vasseur-deadcells | Junya Christopher Motomura (Arc System Works); Thomas Vasseur (Motion Twin) | https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf ; https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i- |
| Thumbnails and variants, judged side by side at the same scale | saint11-1 | Pedro Medeiros | https://saint11.art/pixel_art_articles/article1/ |

## Known limits (round C1)

- The checker still can't measure: FG-P17 (twist), FG-P19 (idle frames), the two-hand grip rules
  GR-P01 to GR-P04 and GR-P07 (the idle holds the haft in one hand), HD-P03 (a free open hand) and
  PX-P22 (AA; the constructor places none). These print SKIP.
- Palette findings (PX-P05, P06, P07, P10, P24) are for the palette owner (ART-RULES O-6).
  `palette.json`'s `stocking` material still maps the W ramp; the constructor uses DESIGN's
  indigo ramp directly.
- The feature library is authored for 144 px. Other head sizes scale the construction grid, but
  the eye, brow and mouth grids stay the 144 ones.
- Profile and front views are constructed but have only been looked at, not tuned; the proof was
  the q34 set and the idle.
- The rendering is a first pass. The checker's craft metrics (banding, thin shadow shapes, local
  density) and the A/B sheets both say it is far from refs 07, 08 and 09. The learning log's
  round C1 rows are the baseline for the next round.

## Round R1: the paint route (2026-09-29)

Round C1 drew the face and hair from parametric shapes and dressed the figure with small part
models. By eye next to refs 07, 08 and 09 that gave a helmet of hair, a boxy lower face and a thin
figure. Round R1 keeps C1's construction (the guides, the gesture solver, the mannequin, the checker)
and changes who places the pixels: the head is **painted as layered pixel data** on the construction
grid, and the figure is dressed with **part models at DESIGN size** (the 144 px column of DESIGN 2).
The C1 tools above still run and are unchanged; their outputs are superseded (see
`art/rosace/construct/README.md`).

| Tool | What it does | Writes |
|---|---|---|
| `head_paint.py` | Composes a head from `art/rosace/construct/faces/r1/head_<view>.json`: three painted layers (back hair and neck, the face plane, front hair) plus per-expression overlays (eyes, brows, mouth, nose, blush, fixes) at anchors on the face_construct grid. Landmarks for the checker are measured from the painted pixels. `thumbs` runs a trial round (one design axis per variant, `variants_a`, `variants_b` in the spec, verdicts written back); `variants` builds the WF-P04 one-axis variants for every face; `set_px` and `strays` are the painter's pixel pass and its stray finder | `faces/r1/<view>_<expr>_144.{json,png}`, `_ids.png`, `_parts.png`; `faces/r1/variants/`; `review/rosace/construct/round-1/face/` |
| `figure_paint.py` | C1's gesture, IK and mannequin (`figure_construct.Figure`), dressed with R1 part models: bell sleeves (tube over the elbow + gravity drape, lining, hem, folds from the elbow), the hime back hair with a ring and azure tips, the veil, fuller thighs, bust and hip flare, gold lacing on the open sides, garter straps, the DESIGN-length tabard with a turned plane, a fist built to fit HD-P02 and GR-P06 together, the painted r1 head. Rendering: shadow bands of at least 2 px, sel-out on the lit side, the orphan cleanup pass (DESIGN 12), all switchable under `render` in the spec for A/Bs. `--thumbs` scores the spec's thumbnails with these models | `art/rosace/construct/figure/<name>/` (same files as C1); `review/rosace/construct/round-1/figure/` |
| `sheets_r1.py` | The round-1 review set: blind A/B (hero vs 07, 08, 09 idle and 04 centre; the hero's face vs the 07/08/09 heads) with `key.json`, the face library, the face and figure process sheets with every verdict, before/after (3D route, C1, R1), the face composite | `review/rosace/construct/round-1/` |
| `craft_debug.py` | Marks where PX-P23, PX-P12, PX-P13, FG-N06 and PX-N01 point on a zoomed sprite, so a fix goes to the step that owns the pixels | `review/rosace/construct/round-1/_work/` |

```sh
# faces: build the library (3 views x 3 expressions; q34 also serene / ignited / hurt), trial rounds, one-axis variants
python tools/art-construct/head_paint.py all --sheet
python tools/art-construct/head_paint.py build --view q34 --expr serene --sheet      # (ignited, hurt the same)
python tools/art-construct/head_paint.py thumbs --view q34 --tag _b                   # re-runs a trial round on the current base
python tools/art-construct/head_paint.py variants
python tools/art-construct/rules_check.py --face art/rosace/construct/faces/r1/q34_confident_144.json --faces art/rosace/construct/faces/r1

# figure: thumbnails, then the hero with the 3D reference layer
python tools/art-construct/figure_paint.py art/rosace/construct/figure/idle_hero_r1.gesture.json --thumbs
python tools/art-construct/figure_paint.py art/rosace/construct/figure/idle_hero_r1.gesture.json --ref --sheet
python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero_r1 --faces art/rosace/construct/faces/r1

# sheets
python tools/art-construct/sheets_r1.py
```

The collar-hand A/B (`idle_hero_r1_collar`) and the no-sel-out render A/B are built by calling
`figure_paint.build(spec, name, ref, overrides)` with `{"arms": {"far": {"pose": "collar", ...}}}` and
`{"render": {"selout": false}}`; `sheets_r1.py` expects them where the process sheet looks.

### Checker changes in R1 (IDs kept; thresholds unchanged unless stated)

- **FC-P02, FC-P08**: scoped by view. The width ratio, the chin offset and the cheek bulge are
  three-quarter construction; front is checked on its own terms, profile skips FC-P02.
- **PX-P23**: a dither alternates in two directions. The old detector counted every 1 px 45° line
  (folds, lash wraps, flow lines) as dithering.
- **PX-P12**: orphans are 8-connected. A pixel on a 1:1 line was being called an orphan.
- **PX-P14, PX-N02**: the haft (a 3 px line part) is left out, answering open question O-7; the
  with-haft number is still printed.
- New rules are measured: WF-P10, HD-P07, CL-P06, CL-N03, FC-P21, FC-P22, FC-P23, HR-P10.
- C1's idle re-measured under this checker: 129 pass / 24 fail of 175; the R1 hero 137 / 16 (0 block); the collar A/B 133 / 20 (FG-N04 block).

### Sources for the new construction steps (accessed 2026-09-29)

| Step | Source | Author | URL |
|---|---|---|---|
| Profile rows: nose tip about a quarter of the head above the chin, bottom lip about an eighth, the eye below the midline and set back, the neck at an angle | ao-side | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-face-side-view-with-proportions/ |
| The top of the eye at the head's middle guideline in side view (search excerpt, secondary) | maryli-side | Mary Li | https://maryliart.com/how-to-draw-the-head-and-face-anime-style-guideline-side-view-drawing-tutorial |
| Big clumps first, then split them; tips of different lengths | ao-hair34 | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-hair-in-3-4-view-step-by-step/ |
| The bell's folds from tension points (elbow, armband); a pipe fold hangs from them | hampton-folds | Steven Michael Hampton (Proko) | https://www.proko.com/course-lesson/intro-to-pipe-folds-and-diaper-folds |
| Sel-out on the lit side, the darkest tone of the material | jansson; yu-mistakes | Arne Niklas Jansson; Derek Yu | https://androidarts.com/pixtut/pixelart.htm ; https://www.derekyu.com/makegames/pixelart2.html |
| An orphan is a pixel with no neighbour of its colour | saint11-2 | Pedro Medeiros | https://saint11.art/pixel_art_articles/article2/ |
| Precise pixel placement after simplification (the painted head) | slynyrd-29 | Raymond Schlitter | https://www.slynyrd.com/blog/2020/7/28/pixelblog-29-anime-faces-and-hair |

The 3D render (r4fix idle, px144) supplied proportion only: the bell's size (about 20 × 27 px) and
the hips and thighs (ART-RULES WF-P02).

### Known limits (round R1)

- **The finish is still far below 07, 08 and 09.** The construction carries (silhouette mass, a
  face with a target, collar cross, dark legs), but large W2 and S2 areas are flat, the saturated
  indigo reads flat, and the thighs and hips are thinner than ref 04's. PX-P14 (5.3 per 1,000 px
  on the body), PX-P13 (48 thin shadow shapes, most of them interior 1 px lines: O-11) and PX-P27
  (3 cycling gold runs) still fail.
- Front and profile faces carry three expressions (confident, focused, radiant), so FC-P19/N19
  fail there; q34 has all six.
- In q34 Radiant the raised brows sit on the row where HR-P10 counts the split tips (minor fail).
- The palette findings (PX-P05, P06, P07, P10, P24) are still the palette owner's (O-6).
- The far hand on the hip is a constructed mitten; at 3x it reads as a hand, at 6x as a block.

## Round R2: strokes, trial rounds and paint passes (2026-09-29)

R2 answers the round-1 critique (a tired, faintly sad face; a comb fringe; a flat figure). The face is
**repainted stroke by stroke** on the same construction grid, every fix goes through a trial round
beside refs 07/08/09, and the figure keeps R1's gesture and part models but gets a new gesture
round, fuller masses, painted hands and designed paint passes. Nothing is generated; every pixel
comes from a stroke, a grid or a pass written in these files.

| Tool | What it does | Writes |
|---|---|---|
| `brush.py` | The brush: rasterises explicit strokes (spans, fills, polylines through named pixels, dabs) onto a character grid. It decides no shape | – |
| `heads_r2.py` | The three painted heads (q34, front, profile) as strokes and overlay grids, six expressions each, and the q34 **trial rounds** a, b, c with every variant, verdict and `base_patch` (the base as it was when the round ran, so a round re-renders the same after its winners are folded in) | `art/rosace/construct/faces/r2/head_<view>.json` |
| `face_r2.py` | Builds, previews (x16 grid, construction, refs), runs a trial round (scored on every FC/HR rule, sheeted at x6 and 2x beside the ref heads, verdicts under it), builds the library, construction sheets and the library sheet. It points `head_paint` at `faces/r2`, so `head_paint.one_axis_variants()` gives the WF-P04 variants | `faces/r2/<view>_<expr>_144.*`, `faces/r2/variants/`; `review/rosace/construct/round-2/face/`, `faces_library_x8.png` |
| `figure_r2.py` | `figure_paint.PaintFigure` plus: the R2 head (its back hair under the chin left to the body layer), the calf offset and deltoid masses, painted hands (`HANDS`), and the paint passes `pass_veil`, `pass_torso`, `pass_gloss`, `pass_legs`, `pass_thighs`, `pass_hairtail`, `pass_tabard`, `pass_hands`, `pass_contacts` (each switchable under `render`); `--thumbs` scores the thumbnails with these models and reports the near arm's reach | `art/rosace/construct/figure/<name>/`; `review/rosace/construct/round-2/figure/` |
| `sheets_r2.py` | The round-2 set: blind A/B of the hero vs 07/08/09 idle and 04 centre (x3, x6), the head **as it sits on the figure** vs the 07/08/09 heads (x1, x6, x10), `key.json`, the process sheets with every verdict, before/after (3D route, R1, R2), the composite | `review/rosace/construct/round-2/` |
| `_dump.py`, `_crop.py` | Painter's helpers: print a composed head as a character grid with coordinates; a zoomed crop beside x4, x2 and 1x | stdout / a PNG |

```sh
python tools/art-construct/heads_r2.py                                   # write the painted heads (the art is in this file)
python tools/art-construct/face_r2.py all                                # the 18-face library
python tools/art-construct/face_r2.py trial --view q34 --round c         # a trial round (a, b, c)
python tools/art-construct/face_r2.py sheets                             # construction + library sheets
python -c "import sys; sys.path.insert(0,'tools/art-construct'); import face_r2, head_paint as HP; HP.one_axis_variants()"
python tools/art-construct/figure_r2.py art/rosace/construct/figure/idle_hero_r2.gesture.json --thumbs
python tools/art-construct/figure_r2.py art/rosace/construct/figure/idle_hero_r2.gesture.json --ref --sheet
python review/rosace/construct/round-2/_work/render_ab.py                # the render A/Bs (git-ignored scratch)
python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero_r2 --faces art/rosace/construct/faces/r2
python tools/art-construct/sheets_r2.py
python tools/art-construct/rules_sync.py
```

### Checker changes in R2 (IDs kept unless new)

- New, measured: FC-P24 (the smile lifts the lower lid), FC-P25 (the Confident eye-line roll), FC-N24 (no
  tear streaks), FC-N25 (no tired lash), FC-N26 (no worry brow), HR-P11 (unequal fringe: tip rows and tone
  periods), HR-P12 (I4 behind the sidelock), HR-N04 (no straight clump lines).
- Changed measurement: FC-P13 counts an iris row only at 2:1 or more against OL; FC-P22 wants A2 on top and
  A4 at the bottom; FC-P07 wants the smirk step inside the S4; FC-P17 wants the blush on one row; FC-N13
  checks both contours and the chin row as it reads (neck skin included); HR-P10 wants one split, not all.
- The control: R1's q34 Confident, which passed R1's checker, fails 11 of these; all 18 R2 faces pass every
  automatic FC/HR rule.
- Hero `idle_hero_r2`: 143 pass, 18 fail, 0 block of 183 (R1's hero under the same checker: 133 / 28).

### Sources for the new construction steps (accessed 2026-09-29)

| Step | Source | Author | URL |
|---|---|---|---|
| The lash heavy at the outer end, triangular outer ends, a dark upper and bright lower iris | csp-okids | O_kids (Clip Studio Tips) | https://tips.clip-studio.com/en-us/articles/11807 |
| The angle of the lid line carries the character; down at the outside reads tired | csp-yitsuin | yitsuin (Clip Studio Tips) | https://tips.clip-studio.com/en-us/articles/6515 |
| A smile lifts the lower lid ("overlap the lower lid with the cheek") | proski-expr | Magda Proski (Art Rocket) | https://www.clipstudio.net/how-to-draw/archives/157239 |
| Unequal fringe clumps; darker values under clumps and behind side locks | skyrye-hair (a blog, secondary weight) | Ivan (Sky Rye Design) | https://skyryedesign.com/art/drawing/body/anime-hair-drawing-techniques/ |
| The calf high on the outside, low on the inside | proko-calf | Stan Prokopenko | https://www.proko.com/course-lesson/how-to-draw-the-calf-anatomy-for-artists |
| Prominent clusters first, then refine; no scattered small clusters (the paint passes) | slynyrd-57 | Raymond Schlitter | https://www.slynyrd.com/blog/2025/7/28/pixelblog-57-knights-monsters-amp-castles |

### Known limits (round R2)

- The finish is still well below 07, 08 and 09: the hair has fewer values and less sharp gloss than the
  refs' and the body's shading is thin. The round-4-fix 3D still has richer form shading on the torso and
  legs than the R2 paint passes (ART-RULES O-15).
- PX-P14 banding rose to 8.8 per 1,000 px (R1: 5.3), mostly the painted hair's lines (O-14). The palette
  items (PX-P05/06/07/10/24) are still the palette owner's (O-6).
- The q34 face had three trial rounds; front and profile had construction passes and the WF-P04 sweep
  only. The one-axis variant records don't carry the fringe clump list, so HR-P08 miscounts on them.

## Round R3: the critic gate, a repainted head, a stepping idle (2026-09-29)

R3 answers the round-2 critique (6.2/10: "sullen or unimpressed ... not confident and charming"). The critic found a
face that passed 63/63 automatic face rules, so R3 first fixes the checker (the lenient measurements, the rules the
critique produced) and adds a gate no checker pass can override (WF-P11, a whole-face pick beside ref 08). Then the
three heads are repainted stroke by stroke on the same grid, every fix goes through a one-axis trial round, and the
figure gets a gesture round on attitude and a hair tail in clumps. Nothing is generated; the 3D render is still only the
reference layer under the gesture.

| Tool | What it does | Writes |
|---|---|---|
| `heads_r3.py` | The three painted heads (q34, front, profile) as strokes and overlay grids, six expressions each; the q34 **trial rounds a–e** (the eyes, the brows, the mouth, the hair, the Ignited shout) with every variant, verdict and `base_patch`; the **WF-P11 pick** (`Q34_PICK`: whole faces, R2 as the control) | `art/rosace/construct/faces/r3/head_<view>.json` |
| `face_r3.py` | Builds, previews (x16 grid, construction, R2 and the refs, plus a character dump), runs a trial round (scored on every FC/HR rule; sheeted at x6, 2x and 1x beside the ref heads), runs the **pick** (shuffled slots, `key.json`, a revealed copy), builds the library and the construction sheets. A copy of `face_r2.py` pointed at `faces/r3`, because face_r2 binds its library into default arguments | `faces/r3/<view>_<expr>_144.*`, `faces/r3/variants/`; `review/rosace/construct/round-3/face/` |
| `figure_r3.py` | `figure_r2.R2Figure` with the R3 head and `pass_tail_r3` (the hair tail as two clumps with one lit ridge); `--thumbs` scores thumbnails on the 11 silhouette rules **plus CL-P05 and FG-P12** (WF-P03, round R3) | `art/rosace/construct/figure/idle_hero_r3/`; `review/rosace/construct/round-3/figure/` |
| `sheets_r3.py` | The round-3 set: blind A/B of the hero vs 07/08/09 idle and 04 centre (x3, x6), the head as it sits on the hero vs the 07/08/09 heads (x1, x3, x6, x10), `key.json`, the library, the face and figure process sheets with every verdict, before/after (3D route, R2, R3; and the heads at x8), the composite | `review/rosace/construct/round-3/` |

```sh
python tools/art-construct/heads_r3.py                                   # write the painted heads (the art is in this file)
python tools/art-construct/face_r3.py all                                # the 18-face library
python tools/art-construct/face_r3.py preview --view q34 --expr confident
python tools/art-construct/face_r3.py trial --view q34 --round a         # rounds a, b, c, d (Confident), e (Ignited)
python tools/art-construct/face_r3.py pick --view q34                    # WF-P11: whole faces beside ref 08, x3 and 1x
python tools/art-construct/face_r3.py sheets                             # construction + library sheets
python -c "import sys; sys.path.insert(0,'tools/art-construct'); import face_r3, head_paint as HP; HP.one_axis_variants()"
python tools/art-construct/figure_r3.py art/rosace/construct/figure/idle_hero_r3.gesture.json --thumbs
python tools/art-construct/figure_r3.py art/rosace/construct/figure/idle_hero_r3.gesture.json --ref --sheet
python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero_r3 --faces art/rosace/construct/faces/r3
python tools/art-construct/sheets_r3.py
python tools/art-construct/rules_sync.py
```

### Checker changes in R3 (the "round R3" section at the end of `rules_check.py`; IDs kept unless new)

- New, measured: FC-P26 (near eye dominance), FC-P27 (brow windows), FC-N27 (no speckled fringe edge), FC-N28 (no
  staircase jaw), HR-P13 (a lit silhouette break), HR-N05 (no dark strand sticking out). New, critic: WF-P11 (the gate).
- Changed measurement: FC-P09 (lash rows from the topmost OL, the flick included, to the first full iris row), FC-P13 (a
  row needs >= 2 iris px), FC-P12 (both catchlights on the top iris row at one offset from the pupils), FC-P07/FC-N11 (the
  line only; the Confident mouth is 4 px), FC-P16 (>= 12 px fringe shadow in clusters), FC-N15 (8-connected), HR-P03
  (roots on the hairline row), HR-P04 (rule changed: the fringe stops above the brow window), HR-P08 (dashes on >= 3
  rows), HR-P10 (splits from under the roots), HR-N02 (isolated light px). WF-P03 in `figure_r3.py`: the thumbnail score
  adds CL-P05 and FG-P12.
- The control: R2's q34 Confident, which passed every automatic face rule, fails 14 under the R3 checker; all 18 R3 faces
  pass every automatic FC/HR rule. The R3 hero passes 149 of 190 rules, no block fail (R2's hero under the same checker:
  135).

### Sources for the new construction steps (accessed 2026-09-29)

| Step | Source | Author | URL |
|---|---|---|---|
| Jaws and crowns: segments that shorten toward the middle of a curve ("5, 2, 2, 1, 1") | lospec-outlines | skeddles (Lospec) | https://lospec.com/articles/pixel-art-outlines/ |
| Catchlights matched in both eyes | aam-highlights | Anime Art Academy staff (Anime Art Magazine) | https://animeartmagazine.com/pro-tips-for-drawing-anime-eyes-different-types-of-highlights/ |
| Highlights as dashes that flow along the shape; shadows along the bottoms of the clumps; large clumps | ao-shade-hair | AnimeOutline | https://www.animeoutline.com/how-to-shade-anime-hair-step-by-step/ |
| The hair's cast shadow on the forehead; the head's on the neck | ao-shade-face | AnimeOutline | https://www.animeoutline.com/how-to-shade-an-anime-face-in-different-lighting/ |
| The shout: the top teeth stay, the jaw drops; teeth as one shape | ao-teeth | AnimeOutline | https://www.animeoutline.com/how-to-draw-anime-teeth-tutorial/ |

### Known limits (round R3)

- **The finish is still clearly below 07, 08 and 09.** The face reads open, bright and smiling and the stance steps,
  but the figure is pale and flat-shaded on the torso, bells and legs, the hair has less value range than the refs' and
  no dark masses frame the face. PX-P14 is 9.9 per 1,000 px, PX-P13 49 thin shadow shapes; the palette items (PX-P05,
  P06, P07, P10, P24) are still the palette owner's (O-6). Open question O-18.
- The brow window is one row deep, so every WF-P04 eye-line or brow variant fails FC-P27 (O-17); the variant records
  still carry no bangs list, so HR-P08 miscounts on them (since R2).
- The profile's lit crown flick reads a little like an ear at x7 (O-16).
- Only q34 had trial rounds and the pick; front and profile had construction passes, the checker and the WF-P04 sweep.

## Face lane round F2: faces on the v2 head (2026-09-29)

The face lane draws the face on the real v2 render (the MMD head), not on a painted head. Round F1 is
`face_v2.py` (+ `face_v2_lib.py`, `face_v2_run.py`); round F2 is a second composer that reuses F1's
construction and placement:

| Tool | Does |
|---|---|
| `face_f2.py` | the F2 composer: face_v2's construction and eye placement, then strands out, the fringe kept (flat bottom runs taper to 1 px tips, no windows), the jaw rebuilt on the construction (FC-P30), the skin flattened to S2 with a 1-row fringe shadow and the brown contour ring stepped to S3, a profile's front contour in skin, then blush, eyes, brows (only in a real fringe gap), nose, mouth |
| `face_f2_lib.py` | writes the F2 glyph library and specs (`art/rosace/construct/faces/f2/`): one eye model per view, 144 and 80 px sets |
| `face_f2_run.py` | the round: re-faces the lane stills through the render path (`ROSACE_FACES=f2 stills_v2.py --no-render`), writes WF-P04 variants + the F1 and round-4 controls, the expression library, `run_f2.json` |
| `face_f2_stills.py` | whole-figure stills sheets (round-4 / F1 / F2, 144 and 80) |
| `face_v2_record.py --run run_f2.json --composer f2` | face records and `rules_check` on the F2 faces, plus FC-N29 and FC-N30 in `rules_summary.json` |
| `face_v2_sheets.py --run run_f2.json --round 2` | blind A/B sheets vs 07/08/09 (144) and 05 (80; re-framed crops), WF-P11 pick sheets, library and parts sheets |

The render path (`tools/pixel-pipeline/faces.py v2_face`) uses F2 only with `ROSACE_FACES=f2`; the default stays F1
until the Integrate step flips it. Known limits: FC-P01/P02 still fail on N1 and Q (O-20); FC-P15/N23 fail by design
under a covering fringe (O-26); FC-P09/N06/P24/P26 measure the eye differently from the F1 critique's fix (O-25);
the 80 px faces are judged by the pick, not the 144 rules (O-21).


## Whole round WH2 (2026-09-29)

| Tool | Does |
|---|---|
| `wh2_px.py` | the integrated chain's last pixel pass (`stills_v2.py` step 9b, before the remap): faces re-anchored on facepass with a per-pose expression table (`art/rosace/faces/wh2.json`; FC-P32-P34), FC-N29, the hair despeckle, separators and sheen arc (HR-N08, HR-P22), azure tail tips, the crown pin, fists a value under the cuff, thighs as cylinders and the 80 px leg sheen. Writes `still_wh2.png` and `wh2.json` with the face checks. PIPELINE.md 3.6h |
| `wh2_view.py` | a still crop on an integer grid with 5 px ticks (and `--codes`: the palette code of every px), for authoring by coordinate |
