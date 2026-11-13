# Constructed Rosace art (rounds C1, R1, R2, R3)

Faces and figures built by `tools/art-construct/` from construction data. This is the route
`docs/character/ART-RULES.md` sets out: guides, then block-in, then pixels. The 3D render is only
a reference layer.

| Path | What it is | Edit or generated |
|---|---|---|
| `faces/feature_library_144.json` | authored pixel data: eye templates per yaw and expression, iris tones, brows, mouths, blush, bang clump construction | **edit** (this is the art) |
| `faces/set_q34_144.json` | the q34 expression set: parameters per face | **edit** |
| `faces/q34_<expr>_144.{json,png}`, `_ids.png`, `_parts.png` | the built faces: stamp rows, face.json landmarks, params | generated |
| `faces/variants/` | one-axis variants per expression (WF-P04) | generated |
| `figure/idle_hero.gesture.json` | the idle's gesture spec, its thumbnail variants and the decisions taken | **edit** |
| `figure/idle_hero/` | the built idle: `sprite.png`, ids and parts layers, `pose.json`, `face.json`, `construct.json`, `thumbs/` | generated |

Rebuild commands are in `tools/art-construct/README.md`.

## What this supersedes

These older files are kept, not deleted. They were built for the 3D-to-pixel route, which stalled
at about 5.7/10 over four critic rounds. New work should start from this folder.

| Superseded | By | Why |
|---|---|---|
| `art/rosace/faces/*_96/128/144.json` (the round-4 face stamps: serene / resolute / radiant) | `faces/` here (confident, focused, radiant, serene, ignited, hurt, built on the 144 grid) | the stamps followed the revision-2 face: a half-lidded default and no brows (DESIGN 5 marks that spec superseded) |
| `art/rosace/hands/*.json` (fixed fist and palm blocks) | hands built per pose from palm box, mitten, thumb wedge and wrist step in `figure_construct.py` | HD-P01: hands are constructed, not stamped from a library |
| `art/rosace/overrides/*` (per-still override layers on the render) | the constructed sprite in `figure/<pose>/` | the overrides patched render pixels; ART-RULES WF-P06 moves each fix back to the step that owns it |

`art/rosace/poses/*.json` (Blender pose specs) stay in use as the source of the 3D reference layer.
`art/rosace/poses/motion/` belongs to another lane.

## Status (2026-09-29)

- Idle `figure/idle_hero`: 125 of 167 checks pass, 0 block-severity fails, 21 fail (major or
  minor), 13 skip, 8 critic-only (`rules_check.py`).
- Faces: every expression passes its face and hair rules (FC, HR) except HR-N02 (a few 1 px hair
  specks, minor).
- Not reviewed by a critic yet. By eye against refs 07, 08 and 09 the construction reads (stance,
  arm windows, glaive angle, open eyes, collar cross, dark legs), but the finish is far behind:
  flat hair, thin arms, little rendering density. See ART-RULES section 10, round C1.

## Round R1 (2026-09-29): the paint route. Start here

Round R1 paints the head as layered pixel data on the construction grid and dresses the figure with
part models at DESIGN size (the 144 px column of DESIGN 2). Tools: `tools/art-construct/head_paint.py`,
`figure_paint.py`, `sheets_r1.py` (README there). Review sheets: `review/rosace/construct/round-1/`.

| Path | What it is | Edit or generated |
|---|---|---|
| `faces/r1/head_q34.json`, `head_front.json`, `head_profile.json` | the painted heads: layers (back, skin, front), expression overlays, the trial rounds (`variants_a`, `variants_b`) with their verdicts | **edit** (this is the art) |
| `faces/r1/<view>_<expr>_144.{json,png}`, `_ids.png`, `_parts.png` | the face library: q34 confident, focused, radiant, serene, ignited, hurt; front and profile confident, focused, radiant | generated |
| `faces/r1/variants/`, `faces/r1/variants_index.json` | the WF-P04 one-axis variants (eye line, brows, mouth row) for every face; no variant beat its base | generated |
| `figure/idle_hero_r1.gesture.json` | the hero's gesture (C1's, with the far hand on the hip), the R1 part sizes, six thumbnails with verdicts | **edit** |
| `figure/idle_hero_r1/` | **the hero**: sprite, ids, parts, pose.json, face.json (the painted q34 confident face as composited), construct.json, `thumbs/` | generated |
| `figure/idle_hero_r1_collar/` | the A/B with the free hand at the collar (DESIGN 1): fails FG-N04 and CL-N03 at the DESIGN sleeve size (DESIGN 13 decision 7) | generated |

Status: the hero passes 137 of 175 rules (16 fail) with no block fails (C1's idle 129 under the same
checker); every q34 face passes its face and hair rules (Radiant: one minor). By eye, R1 is well
past C1 and still well below refs 07, 08 and 09 in finish (ART-RULES section 10, round R1).

### What R1 supersedes (kept, not deleted)

| Superseded | By | Why |
|---|---|---|
| `faces/feature_library_144.json`, `faces/set_q34_144.json`, `faces/q34_*_144.*`, `faces/variants/` (the C1 parametric faces) | `faces/r1/` | the parametric hair shell and jaw read as a helmet and a boxy lower face beside the refs; the painted heads pass 52–56 automatic face rules where C1 had fails (learning log R1) |
| `figure/idle_hero.gesture.json`, `figure/idle_hero/` (the C1 idle) | `figure/idle_hero_r1*` | C1's sleeves were a third of DESIGN's size and its face was the parametric one |

## Round R2 (2026-09-29): repainted faces, a leaning idle. Start here

Tools: `tools/art-construct/heads_r2.py`, `face_r2.py`, `figure_r2.py`, `sheets_r2.py`, `brush.py`
(README there). Review sheets: `review/rosace/construct/round-2/` (git-ignored; third-party refs).

| Path | What it is | Edit or generated |
|---|---|---|
| `faces/r2/head_q34.json`, `head_front.json`, `head_profile.json` | the repainted heads: layers, six expressions per view, the q34 trial rounds a/b/c with verdicts. **Written by `tools/art-construct/heads_r2.py`: edit the strokes there, not the JSON** | generated from the stroke file |
| `faces/r2/<view>_<expr>_144.{json,png}`, `_ids.png`, `_parts.png` | the 18-face library (q34, front, profile × confident, focused, radiant, serene, ignited, hurt) | generated |
| `faces/r2/variants/`, `faces/r2/variants_index.json` | WF-P04 one-axis variants for all 18 faces; none beat its base | generated |
| `figure/idle_hero_r2.gesture.json` | the hero's gesture (t7: the chest and head lean toward the staff), the R2 masses, hands, render switches, eight thumbnails with verdicts | **edit** |
| `figure/idle_hero_r2/` | **the hero**: sprite, ids, parts, pose.json, face.json, construct.json, `thumbs/` | generated |

Status: all 18 faces pass every automatic face and hair rule; the hero passes 143 of 183 rules with no
block fail (R1's hero under the same checker: 133). By eye the face now reads awake and sure of itself
and the figure reads cleaner, but the finish is still well below refs 07, 08 and 09 (ART-RULES
section 10, round R2).

### What R2 supersedes (kept, not deleted)

| Superseded | By | Why |
|---|---|---|
| `faces/r1/` (the R1 painted heads and library) | `faces/r2/` | the round-1 critique read the R1 face as tired and sad; under the R2 checker it fails 11 face and hair rules (FC-P07, P17, P22, P24, P25, N13, N24, N26, HR-P11, P12, N04) |
| `figure/idle_hero_r1*` | `figure/idle_hero_r2/` | the R1 head, capsule hands, the level reaching arm, and the head's back hair stamped over the shoulder |

The C1 files and the round-4 files listed above stay superseded as before.

## Round R3 (2026-09-29): the critic gate, repainted heads, a stepping idle. Start here

Tools: `tools/art-construct/heads_r3.py`, `face_r3.py`, `figure_r3.py`, `sheets_r3.py` (README there). Review sheets:
`review/rosace/construct/round-3/` (git-ignored; third-party refs).

| Path | What it is | Edit or generated |
|---|---|---|
| `faces/r3/head_q34.json`, `head_front.json`, `head_profile.json` | the repainted heads: layers, six expressions per view, the q34 trial rounds a–e and the WF-P11 pick with their verdicts. **Written by `tools/art-construct/heads_r3.py`: edit the strokes there, not the JSON** | generated from the stroke file |
| `faces/r3/<view>_<expr>_144.{json,png}`, `_ids.png`, `_parts.png` | the 18-face library (q34, front, profile × confident, focused, radiant, serene, ignited, hurt) | generated |
| `faces/r3/variants/`, `faces/r3/variants_index.json` | WF-P04 one-axis variants for all 18 faces; none beat its base | generated |
| `figure/idle_hero_r3.gesture.json` | the hero's gesture (R2's t7 with the free foot stepping toward the staff: thumbnail t7_wide_bent), the render switches (`r3_tail`), nine thumbnails with verdicts | **edit** |
| `figure/idle_hero_r3/` | **the hero**: sprite, ids, parts, pose.json, face.json, construct.json, `thumbs/` | generated |

Status: all 18 faces pass every automatic face and hair rule; the hero passes 149 of 190 rules with no block fail (R2's
hero under the same checker: 135). By eye the face now reads open, bright and smiling and the idle steps, but the
figure's finish is still clearly below refs 07, 08 and 09 (ART-RULES section 10, round R3; O-18).

### What R3 supersedes (kept, not deleted)

| Superseded | By | Why |
|---|---|---|
| `faces/r2/` (the R2 painted heads and library) | `faces/r3/` | the round-2 critique read the R2 face as sullen; under the R3 checker its Confident fails 14 face and hair rules (FC-P07, P09, P12, P16, P26, P27, N05, N06, N11, N28, HR-P03, P08, N01, N05), and it read the most sullen of five in the WF-P11 pick |
| `figure/idle_hero_r2*` | `figure/idle_hero_r3/` | the R2 head, the striped hair tail, the two-column legs (R2's pose is kept as thumbnail t0, the #2) |

The C1, R1 and round-4 files listed above stay superseded as before.
