# Retime: how we tune a move

The AI (Kimodo) gives us believable body motion between our key poses. It doesn't give us game
timing. This layer does: you edit a small JSON **timing sheet**, and the move is rebuilt with
our holds, snaps, easing, overshoot and exaggeration, stepped to MOVESET's drawings, on
Rosace's rig, in pixels.

Tags: **[M]** measured here, **[S]** from a source doc, **[I]** my inference.

## The loop

```sh
# 1. edit the sheet
code tools/motion-ai/timing/n1.json

# 2a. stick-figure check: ~1-3 s [M]
python tools/motion-ai/retime.py build tools/motion-ai/timing/n1.json --raw-too
#     -> review/motion/retime/n1_stick.gif (raw | retimed, side by side) + n1_stick_sheet.png (one column per drawing)

# 2b. real pixels on Rosace: ~12 s for N1, ~16 s for N5 [M]
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1.json
#     -> review/motion/retime/n1_pixel_sheet.png (every drawing, 2x)
#     --raw-too also renders the untouched AI clip (about +25 s for N1, +65 s for N5)

# 3. blind A/B/C against the raw clip and the hand-keyed spike: ~10 s per move [M]
python tools/motion-ai/ab_compose.py n1 n5
#     -> review/motion/ab/<move>_abc_{1x,3x}.gif, _3x.mp4, _abc_sheet.png, _abc_sheet_x2.png, key.json
```

Everything runs with the system Python (numpy + Pillow) plus Blender headless through
`tools/pixel-pipeline/blender_env.py`, so Dex's own Blender and prefs never load. Nothing touches
the GPU apart from Blender's small EEVEE renders.

## What a timing sheet says

`timing/n1.json` and `timing/n5.json` follow MOVESET.md's frame tables. Frame numbers are 60 fps
game frames: `0` is the pose before the input, `N` is MOVESET's fN.

```json
{
 "name": "n1", "length": 33,
 "source": {"npz": "n1/n1_study_ee_s1_00.npz", "meta": "_constraints/n1_study_ee.meta.json"},
 "push_ref": "stance",
 "keys": [
  {"name": "stance",  "src": "stance",  "frame": 0, "glaive": "upright"},
  {"name": "A2 coil", "src": "A2 coil", "frame": 3, "hold": 2, "ease": "out",
   "push": {"spine": 1.25, "arms": 1.15, "root_y": 1.3}, "add": {"lean": -4}},
  {"name": "F2 overhead", "src": "F2 over head", "frame": 14, "hold": 1, "ease": "out",
   "push": {"spine": 1.3, "arms": 1.2}, "add": {"lean": -8}, "settle": {"amount": 0.15, "frames": 8}}
 ],
 "exposure": {"mode": "drawings", "drawings": [["A1", 1, 2], ["A2", 3, 3], ["A3", 6, 2]]}
}
```

Source paths are relative to `D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw` (`--raw` changes it).

### A key

| Field | Meaning |
|---|---|
| `src` | Which moment of the AI clip is this key: a label from the generator's sidecar (`"A2 coil"`), a label with an offset (`"A2 coil+1.5"`, in source frames at 30 fps), or a plain source frame number. `retime.py keys <npz> --meta <sidecar>` lists the labels plus the extremes and strikes it finds on its own. |
| `frame` | The game frame where the pose lands. |
| `hold` | Extra frames the pose is frozen after `frame`: a true freeze, not a slow drift. The AI can't hold a pose (N5's coil wanders by about 100 degrees while "held"), so we don't ask it to. |
| `ease` | How we travel into this key from the end of the previous hold (table below). Default: `ease_default`, then `in_out`. |
| `path` | `"source"` (default): replay the AI's own in-betweens on our clock, so arcs and spins survive. `"pose"`: slerp straight from the previous key pose. |
| `push` | Exaggeration: scale how far each chain has rotated away from the `push_ref` pose. `1.0` is the source; `1.3` goes 30% further. Chains: `spine`, `neck`, `hips` (tilt), `arm_L`, `arm_R`, `leg_L`, `leg_R`; groups `arms`, `legs`, `torso`, `body`; any SOMA joint name. Channels: `yaw` (hips heading, unwrapped, so a 230-degree turn pushes the right way), `root_y` (crouch or rise), `root_xz` (step length and root motion). Between keys the push fades with the same easing as the pose. |
| `add` | Offsets added on top, in degrees (and cm for `crouch`): `twist` (spine; + turns her left), `lean` (spine; + forward), `side` (spine bend), `yaw` (whole-body heading), `head_turn`, `head_nod`, `crouch` (hips height, cm), and `rot: {"Joint": [x, y, z]}` for anything else. This is where a line of action gets drawn in. |
| `settle` | Overshoot and rebound after landing: at `frame` the pose sits `amount` (a fraction of the move into this key) past the key, swings back a little past it at about two-thirds of `frames`, and rests at the key by `frames`. |
| `glaive` | `"hands"` (default): the haft runs from the right wrist through the left, and both hands grip it. `"upright"`: one-handed, upright at her side. `[x, y, z]`: a direction in her frame (y up, z her forward, x her left). Blends like everything else. |

### Easing into a key

| `ease` | Feel |
|---|---|
| `"linear"` | Even spacing. |
| `"in"` / `["in", 3]` | Slow out of the last pose, fast into this one (accelerating into a strike). |
| `"out"` / `["out", 3]` | Fast departure, cushioned arrival (follow-through landing). |
| `"in_out"` | Slow, fast, slow (default). |
| `["snap", n]` | Hold the previous pose, then arrive in the last `n` frames (1-2 is a snap). |
| `["snap_out", n]` | The same, with the arrival cushioned. |
| `"hold"` | Nothing moves until the key frame, then it pops (a straight cut). |
| `["back_out", s]` | Arrive, go past by about 10% (`s = 1.70`), come back, land exactly on the key. |
| `["back_in", s]` | Dip the other way first (a little anticipation), then go. |

### Exposure: which frames get a new drawing

- `{"mode": "drawings", "drawings": [[name, start, hold], ...]}`: MOVESET's drawing table. Every
  drawing is a sample of the timed curve at its start frame, held for its length. Add a 4th
  number to sample a different frame (`["R1", 68, 9, 73]` shows the f73 pose from f68 to f76);
  that's how an in-between drawing gets placed where it reads best. Frames before the first
  drawing show frame 0.
- `"ones"`, `"twos"` or `"threes"`: a new drawing every 1, 2 or 3 frames, restarting at every
  key and every hold's end, so keys always land.

MOVESET section 0.1: frames go before or after key poses, never between them. With
`drawings` mode each key is a drawing of its own, and the transition drawings (A3, F1, R1...)
are the only in-betweens.

## What happens to the sheet (the pipeline)

1. **`retime.py build`** (numpy): samples the AI clip on our clock, applies push, add, overshoot
   and settle, steps it to the exposure, and writes
   `dex-place-art/rosace/motion-ai/retimed/<name>.npz` (same layout as Kimodo's NPZ, now at
   60 fps) plus a JSON listing every frame's drawing, source time, foot contacts and forward root
   travel. Foot contacts are found on the continuous curve (low and slow: ankle or toe within
   3 cm of the floor and under 0.45 m/s). The glaive direction is tracked here too (below).
2. **`blender_apply.py`** (Blender, headless), on a read-only snapshot of Rosace:
   - **Retarget.** SOMA77 and the VRoid humanoid both rest in a T-pose, facing the same way
     once the axes are swapped, so each mapped `J_Bip_*` bone copies the source joint's rotation
     from rest (`bone_map_vrm.json`). Hips height scales by leg length (0.919 on Rosace [M]).
     Checked on N1 and N5 [M]: the upper arm-to-wrist and hip-to-ankle directions on the rig
     match the source within 3-6 degrees on average, 10 degrees at worst.
   - **Root motion.** In place by default: the AI's smoothed root travel is taken out of the
     sprite and written as `root_motion_px` in `meta.json` (RUNTIME-CONTRACT's `rootMotion`).
     Measured: N1 moves her 17.6 px forward; MOVESET asks for +8 and +4 px at 96 px, which is
     18 px at 144. N5 moves her 4.8 px; MOVESET's -6 and +10 px would be +6 px at 144. `--keep-root`
     leaves the travel in the sprite.
   - **Glaive and hands.** The haft is aimed from the source's right wrist through its left:
     the key poses were built as a two-handed grip with the wrists 0.44 m apart. Frames where
     the wrists aren't near that spacing (a regrip, hands crossing) take a direction bridged in
     time between trusted frames. We don't aim from the rig's own hands: Rosace's shoulders
     and arms differ from the AI body, and at contact her hands are so close that their
     difference swung the haft by up to 53 degrees [M]. The right hand's grip point becomes the
     rig's `grip_off` socket. The left hand IK-grips `grip_main`, slid along the haft to where
     its source hand was, kept inside arm's reach, and lets go when the source hands are more
     than 0.75 m apart. Elbow poles come from the source elbows. If either end of the haft would
     go through the floor, it's pitched up until it rests on the floor (N1's A3 scoop).
     Measured on every rendered drawing where the hand grips fully: the worst drawing per clip
     has a hand 0.7 to 3.4 cm off the shaft's centre line, about the haft's radius plus the
     hand's thickness.
   - **Foot lock.** Planted spans lock the ankle IK target where the foot landed, in ground
     space so in-place playback doesn't slide. When the AI's foot creeps more than 5 cm, or the
     spot leaves the leg's reach, the lock re-plants (N5: two small re-plants in the coil, one in
     the rise). Measured: 0.0 cm drift on every locked drawing.
   - **Secondary chains** (hair, veil, sleeves, tabard, stoles): the rig's own static drape per
     drawing, with a wind that lags the chest's motion. It's a stand-in for follow-through, not
     a cloth sim [I].
   - Only frames that start a new drawing are rendered (N1: 11 of 34; N5: 15 of 95), through
     `tools/pixel-pipeline/rosace/render.py` at 144 px, camera yaw 60 and elevation 8 (the pose
     library's side-ish view). The action is saved to
     `dex-place-art/rosace/motion-ai/actions/<name>.blend`.
3. **`tools/pixel-pipeline/rosace_post.py --frames`** turns the passes into sprites, with the
   same palette, outlines and face stamps as the stills (expression `resolute`).

## The first A/B/C (N1 and N5)

`review/motion/ab/`: letters are shuffled per move and `key.json` says which is which. Look at
the GIFs or MP4s before opening the key.

- **raw**: the AI clip on the same rig with the same retarget, glaive and IK steps, every
  generated frame shown once at 60 fps. Because the study-tempo clips put MOVESET's fN at source
  frame 12 + N, the raw keys land on the same frames as MOVESET's. The only differences from
  retimed are holds, snaps, easing, push and stepping.
- **retimed**: `timing/n1.json` and `timing/n5.json` as committed.
- **spike**: the stand-in priestess's hand-keyed 24-frame sweep (`blender_spike.py --px 144 --ss 4`,
  post-processed with `--no-vfx`). It's a different model doing a different move, so treat it
  as a feel reference, not a like-for-like.

What I see [I, from the sheets]: the retimed clips hit each MOVESET drawing on its frame. N5's
yank and back-arc land at f1 and f5 where the raw clip is still mid-move, the coil is a
deeper, clean freeze where the raw one keeps drifting, and the kneel holds still. In the raw
clip, the AI eases into every key, so strikes arrive soft. The pushes I set are modest (1.15 to
1.4), so contact poses look close to the raw ones. That's the first thing to turn up if it
reads timid.

GIFs play at 50 fps (20 ms per game frame): GIF delays come in 10 ms steps, and browsers slow
10 ms frames to 100 ms. The MP4s are exact 60 fps.

## Round 2: hero keys on the rig, AI in-betweens, spring cloth

Round 1's critics kept the AI "as a blocking and in-between layer, not the finished motion": its
poses are tame, and pushes of 1.15-1.4 hardly changed them. In round 2 we hand-pose the extremes
on Rosace's rig, and the AI supplies only the frames between them. `PIPELINE.md` 3.14 has the
design and the measured numbers.

```sh
# 1. author a hero key: 144 px sprite plus numbers (stance in shoulder widths, hips drop, torso turn,
#    hip-shoulder separation, lean, line of action, tip vs heel, hand-to-shaft gap, arm reach): ~5 s for 8 poses [M]
python tools/motion-ai/hero_stills.py art/rosace/poses/motion/n1_coil.json [...] --sheet review/motion/r2/sheets/hero_keys_x2.png

# 2. sheet -> retime -> hero layer + spring cloth -> pixels: N1 18 s, N5 42 s [M]
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1_r2.json --hero     --blend D:/Dex/Projects/dex-place-art/rosace/motion-ai/work/rosace_snapshot_0342.blend --review-dir review/motion/r2/sheets
python tools/motion-ai/frame_grid.py D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders/n1_r2/px144 review/motion/r2/sheets/n1_r2_frames_x2.png

# 3. blind A/B/C (round-1 retimed / round 2 / spike) and every number in one JSON
python tools/motion-ai/ab_compose.py --round2 n1 n5        # -> review/motion/r2/round-1/ + key.json
python tools/motion-ai/r2_report.py                         # -> review/motion/r2/round-1/_metrics.json
```

The `hero` section of a timing sheet:

```json
"hero": {
 "keys": {
  "A2 coil":  {"pose": "motion/n1_coil.json"},
  "A3 wind":  {"carry": "A2 coil"},
  "S2":       {"mix": [["A4 unwind", 0.45], ["C1 contact", 0.55]]}
 },
 "plants": {"L": [[3, 7, "A2 coil"], [8, 15, "C1 contact"]]}
}
```

- **Key sources:** `pose` is a hand-posed key. `carry` reuses another key's offset from the AI.
  `mix` blends several, weighted, with the rest of the weight left to the AI. A retime key with
  no entry stays pure AI. A hero key has to land on a frame that some drawing samples.
- **What gets layered:** hips, spine, neck and head are the AI pose times the key's offset. The
  glaive, arms and IK poles are interpolated in the chest frame from key to key. Planted feet
  sit exactly on the hero spot, stepping or pivoting between spots.
- **Pose JSON extras** (`hero_layer.resolve`):
  - `weapon.hand_R` places the right hand's grip point; with `hands.R.slide` the hand chokes
    toward the butt.
  - `hands.L.free: true` lets go with the left hand, and 'bones' poses that arm.
- **Cloth:** `drape` in each hero key is that key's cloth target; the springs supply the lag.
  Chain omega and zeta live in `hero_layer.CHAIN_DYN`. Held drawings get cloth-only redraws
  every 2 f while a tip moves 0.75 px or more (`meta.json` `sample_frame` maps each game frame to
  the image it shows; `body_sample_frame` gives the body drawing).
- **Re-picking drawings for the strike:** keep the last anticipation drawing next to the one
  before it (N1's A3 is the held coil; N5's A4 turns only the hips 32 degrees), so the big
  change lands on S1/C1. `motion_metrics.py` gives the definitions.

## Round 3: the round-2 critics' six fixes

Round 2 scored 6.0-6.2 blind, against the spike's 4.5-5.0 (refs = 9). The critics asked for six
fixes: slower spacing into the coil, a flat N5 sweep, diagonal coils, clean N5 in-betweens, smear
drawings, and lagging stoles. `PIPELINE.md` 3.14 has the measured numbers and what didn't reach its
target.

```sh
# 0. a fresh read-only snapshot of the live model (never render the live file)
cp -p D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend D:/Dex/Projects/dex-place-art/rosace/motion-ai/work/rosace_snapshot_r3_0529.blend   # then mark it read-only

# 1. hero keys: pelvis-frame parameters -> pose JSONs, then the stills loop (~7 s for 5 poses) [M]
python review/motion/r3/_authoring/author_r3_poses.py           # -> art/rosace/poses/motion/*_r3.json
python tools/motion-ai/hero_stills.py art/rosace/poses/motion/n5_coil_r3.json [...] --blend <snapshot> --out D:/Dex/Projects/dex-place-art/rosace/motion-ai/hero_stills_r3

# 2. sheets (from the round-2 sheets), then sheet -> pixels -> smears: N1 ~20 s, N5 ~45 s [M]
python review/motion/r3/_authoring/make_r3_sheets.py            # -> timing/n1_r3.json, n5_r3.json
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n5_r3.json --hero --blend <snapshot> --review-dir review/motion/r3/_authoring

# 3. round 2 re-rendered on the same model, the blind set, every number
python tools/motion-ai/run_pixel.py review/motion/r3/_authoring/n5_r2m.json --hero --blend <snapshot>
python tools/motion-ai/ab_compose.py --round3 n1 n5             # -> review/motion/r3/round-1/ + key.json
python tools/motion-ai/r3_report.py                             # -> review/motion/r3/round-1/_metrics.json (closed to critics)
```

New fields in a sheet's `hero` section:

| Field | Meaning |
|---|---|
| `"blend": [["stance", 0.3], ["A2 coil", 0.7]]` | The key is an exact mix of other keys' whole poses: a hero pose, or the AI pose at a key with no hero entry. The AI's own in-between is ignored, so spacing is exactly what you write. |
| `"glaive": {"yaw": -98, "pitch": 2, "grip_az": -88, "grip_r": 0.37, "grip_h": 0.8, "edge": "lead", "turn": 1, "like": "C1 contact"}` | The weapon in world (her ground frame, yaw + = toward her left), round her hips' vertical axis. Or give `hand_R`, `dir` and `edge` outright. `like` copies another key's hand hints and elbow poles, turned by the yaw difference. `slideR`, `slideL`, `wL`, `backR`, `backL`, `poleR` and `poleL` override single parts. |
| `"cloth_lag": {"stole_A": 3}` | Frames of delay on a chain's drape shape. It hangs from where its root is now, so the tail trails. |
| `"cloth_dyn": {"stole_A": [0.42, 0.4]}` | Per-chain spring omega (rad/frame) and zeta, overriding `hero_layer.CHAIN_DYN`. |

And a top-level `smear` section, one entry per strike drawing (`smear.py`'s docstring has the method):

| Field | Meaning |
|---|---|
| `from` | The drawing whose rendered blade starts the swept path (default: the previous drawing). |
| `turn` | +1 / -1: which way round her the blade goes (+ = toward her left, N5's unwind). Default: the shorter way. |
| `lead` | How far on toward the next drawing's blade the smear reaches (N1's S1: 0.85, the J's rising head). |
| `style`, `head` | `flat` sweeps use the outer 85% of the blade at the head; `head` sets it (N1: 0.55, about MOVESET's 18 px head at 144 px). |
| `ring` | Also draw the rest of the tip's circle, dimmer and depth-tested (N5's S2: the whole ellipse). |
| `bright` | A thicker A5 edge, and A3 further back (N5's S3: the brightest leading edge). |

What each fix became:

1. **Slow-in.** N1: A1 is 70% of the way into the coil, A2 is the coil, A3 is the held coil (cloth
   only). N5: A1 55%, A2 88%, A3 the coil, and A4 turns only the hips. Strike: S1, S2, S3 are 12%,
   38% and 72% of A4 → C1, so S1 is small and S3 and C1 are big. The RGBA phase ratio stays under 3.
   `PIPELINE.md` 3.14 explains why: the count saturates, and both wind-ups travel about as far as
   their strikes.
2. **Flat N5 sweep.** A world glaive through S1-S3: 220° from behind her, round her camera side, to
   the front. Pitch 0-2°, blade 0.35-0.52 H, never over her head (round 2: 18-24° and up to 1.09 H).
3. **Diagonal coils.** Line of action 34° (N1) and 44° (N5, in the pelvis's own frame). Back
   three-quarters to the camera: chest 142° and 150° from it. Head down 58° and 45°. Hips over the
   front knee with a long, straight rear leg. The kneel is a three-quarter genuflection, upright and
   open, with the glaive upright in front of her and clear of her face.
4. **Clean in-betweens.** N5's A1 pulls the haft back along the screen, where round 2 pointed it at
   the camera. A2 lifts the blade up behind her, where round 2 swung it in front. N1's A1 tips the
   blade back instead of forward.
5. **Smears.** N1 S1 is a J: a thin tail along the floor behind her, rising into a crescent in
   front. N5 S1 is a small tip glow, S2 is the ellipse round her, S3 is the flat leading edge. All
   are palette A1-A5 at 144 px and depth-tested against her body.
6. **Stoles.** A 3 f shape delay plus a 0.42 / 0.40 spring. Their shape gets half-way to the new
   drape in 4-7 f (2-3.5 drawings), behind the veil's 3-4 f. Round 2's slow spring took 11-13 f,
   which read as limp.

## Round 3b: the round-3 critics' fixes

Round 3 scored N5 6.8 and N1 6.4-6.6 blind (round 2: 5.8-6.0, spike: 4.0-4.6). `PIPELINE.md` 3.14 lists what the
critics asked for and the measured numbers.

```sh
# 0. a fresh read-only snapshot (byte-identical to round 3's here, so n1_r2m / n5_r2m stand)
cp -p D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend D:/Dex/Projects/dex-place-art/rosace/motion-ai/work/rosace_snapshot_r3r2_0620.blend  # then chmod a-w

# 1. hero keys, then the stills loop (~7 s for 4 poses) [M]
python review/motion/r3/_authoring/author_r3b_poses.py        # -> art/rosace/poses/motion/*_r3b.json
python tools/motion-ai/hero_stills.py art/rosace/poses/motion/n5_kneel_r3b.json [...] --blend <snapshot> --out D:/Dex/Projects/dex-place-art/rosace/motion-ai/hero_stills_r3b

# 2. sheets, then sheet -> pixels -> smears: N1 ~20 s, N5 ~48 s [M]; --pad widens the canvas so the smears fit
python review/motion/r3/_authoring/make_r3b_sheets.py         # -> timing/n1_r3b.json, n5_r3b.json
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1_r3b.json --hero --blend <snapshot> --review-dir review/motion/r3/_authoring --blender-args "--pad 40"
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n5_r3b.json --hero --blend <snapshot> --review-dir review/motion/r3/_authoring --blender-args "--pad 60"
python tools/motion-ai/smear.py <renders>/n1_r3b/px144 tools/motion-ai/timing/n1_r3b.json   # re-run the smear alone (<1 s)

# 3. the blind set and every number
python tools/motion-ai/ab_compose.py --round3b n1 n5          # -> review/motion/r3/round-2/ + key.json
python tools/motion-ai/r3_report.py --new r3b --out review/motion/r3/round-2/_metrics.json   # closed to critics
```

New sheet fields (in `hero` unless noted):

| Field | Meaning |
|---|---|
| `"sink": 0.013` (on a key) | That key's state with the hips lowered (metres, world down); planted feet stay, so the knees bend. 1 px = 1.3 cm at 144 px. |
| `"wL": 0` (on a key) | The left hand's grip weight there, after blends (a blend of a two-handed and a one-handed key left the hand floating half-way). |
| `"slideL": -1.5` (in a world `glaive`) | Where the left hand sits along the haft (N5's A1: toward the butt, within reach). |
| `plants` naming any key | `[[0, 4, "ready"], ...]`: idle and blend keys can anchor feet too (A1 = a weight drop with the feet still). |
| `"cloth_world": {"stole_A": 0.6}` | Pins that share of the chain's spring target to where the lagged drape hung in space, so the stole tails stream behind the glaive, then swing through. |
| `"hold_build": {"A3": {"wind": [1.0, 1.7], "g": [1.0, 0.8]}}` | A held drawing whose cloth keeps winding up: its drape wind and gravity scale across the hold, frame by frame (the body doesn't move). |
| top-level `smear._v: 2` | `smear_v2.py` (below). v1 sheets render as before. |
| blender_apply `--pad N` | Canvas margin in px (default 6). |

`smear_v2.py` fields (per smear drawing): `thick` (px at the head), `h` (flat: vertical px), `style` (`J` / `flat`),
`lead`, `turn`, `turn_lead`, `hide_glaive` (render without the glaive and stoles, draw it bent into the head), `bend`
and `bend_mix` (the curve), `reach_dip`, `lift`, `smooth` (the J's shape), `ring`, `ring_px`, `ring_deg` (the rest of
the ellipse, or only the back half), `dim` and `bright`. The module docstring has the method.

What each fix became:

1. **Spacing.** A1 is 20% of the way with the feet planted on the idle spots, A2 is the coil, and A3 is a 1 px
   sink with the glaive held still in world. N5's A2 back-arc is 2°. N5's A4 is a 25° hip release
   (`n5_release_r3b`) with the glaive held. RGBA phase ratio on the shipped body drawings: N1 **3.37**, N5
   **2.58**; on the body-only images 1.23 and 1.05. `PIPELINE.md` 3.14 explains why N5 stays under 3.
2. **N1's arc and J.** C1 is the high end of the scoop (`n1_contact_r3b`: tip 1.40 H up). F1 is 70/30 into F2,
   and R1 / R2 are 55% / 18% of F2 before idle. S1 is a J on the camera side: a knife tail on the floor behind
   her, a belly along the floor in front of her feet, a 56 px head rising in front (2.29 H wide), with the glaive
   drawn bent.
3. **N5's sweep.** The body turns inside the spin (S2 = `n5_spin_r3b`, chest to the camera). The flat world
   glaive runs 170° → 62° at 2-3° of pitch. S1 is the back half of the ellipse; S2 the whole ellipse (thick
   front, thin dim back, glaive hidden and drawn bent); S3 the bright leading crescent.
4. **Follow-through.** C1 carries the glaive 32° past the target line, arms across, cloth flung to the trailing
   side; C1b (f33 ×5) settles back 24°. The swept ellipse stays on C1 and C1b, fading (MOVESET's main arc runs
   f27-37).
5. **Kneel.** `n5_kneel_r3b`: both knees down, square to the camera, the glaive upright at her right side at arm's
   length, left arm open, head bowed.
6. **Stoles.** A 4 f lag, 60% pinned in space, zeta 0.3. They stream back along the glaive's move for a median
   of 4-6 f (2-3 drawings), up to 12 f after the big moves. Blend keys now blend their drapes, so the mid-spin
   sleeves fly instead of hanging.

## Round 3c: the round-3b critics' fixes

Round 3b scored 6.6 on both moves from both critics (round 2: 5.8-6.0, spike: 4.4-4.5). `PIPELINE.md` 3.14 lists
what they asked for and the measured numbers.

```sh
# 0. a fresh read-only snapshot (byte-identical to rounds 3 and 3b here, so n1_r2m / n5_r2m stand)
cp -p D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend D:/Dex/Projects/dex-place-art/rosace/motion-ai/work/rosace_snapshot_r3r3_0714.blend  # then chmod a-w

# 1. hero keys, then the stills loop (~12 s for 10 poses) [M]; look_stills.py tiles them, feet on one line
python review/motion/r3/_authoring/author_r3c_poses.py        # -> art/rosace/poses/motion/*_r3c.json + r3c_pose_params.json
python tools/motion-ai/hero_stills.py art/rosace/poses/motion/n5_coil_r3c.json [...] --blend <snapshot> --out D:/Dex/Projects/dex-place-art/rosace/motion-ai/hero_stills_r3c
python review/motion/r3/_authoring/look_stills.py D:/Dex/Projects/dex-place-art/rosace/motion-ai/hero_stills_r3c <out.png> 4 n5_coil_r3c n5_kneel_r3c

# 2. sheets, then sheet -> pixels -> smears: N1 ~19 s, N5 ~48 s [M]
python review/motion/r3/_authoring/make_r3c_sheets.py         # -> timing/n1_r3c.json, n5_r3c.json (reads r3c_pose_params.json)
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1_r3c.json --hero --blend <snapshot> --review-dir review/motion/r3/_authoring3 --blender-args "--pad 40"
python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n5_r3c.json --hero --blend <snapshot> --review-dir review/motion/r3/_authoring3 --blender-args "--pad 60"
python tools/motion-ai/smear.py <renders>/n1_r3c/px144 tools/motion-ai/timing/n1_r3c.json   # re-run the smear alone (<1 s N1, ~2 s N5)

# 3. the blind set and every number
python tools/motion-ai/ab_compose.py --round3c n1 n5          # -> review/motion/r3/round-3/ + key.json
python tools/motion-ai/r3_report.py --new r3c --out review/motion/r3/round-3/_metrics.json   # closed to critics
```

`smear_v3.py` fields, per smear drawing (the module docstring has the method):

| Field | Meaning |
|---|---|
| `style` | `J` (N1: a floor run, then a quadratic tangent to it rising into the head) or `flat` (the tip's circle round her hips) |
| `from`, `lead` | The tail's tracked blade, and how far from this drawing's tracked tip toward the next drawing's the head sits (N1 1.0 = on C1's tip; N5 S3 0 = on the solid blade's tip) |
| `hook`, `belly_cam` | J only: how far past the head (H) the curve's control point sits, so the head curls back; how far toward the camera (m) the belly runs, in front of her feet |
| `start_yaw` | flat only: the tail's world azimuth round her hips (turning +) |
| `thick`, `peak` | Crescent profile: the widest px, and where along it (0 = the head) |
| `bright`, `speed_line`, `dim`, `dim_back` | A 2 px A5 edge instead of 1.2; a 1 px A5 inner line over the front half; steps darker; the part behind her hips one step dimmer (default on) |
| `ring` | 0-1: that fraction of the tip's circle, back from the head (2 px A3 in front of her, 1 px A2 behind) |
| `fade` | `{"0": {}, "2": {...}}`: overrides per image of a held drawing, by frame offset (`thick`, `ring`, `dim`, `start_yaw`...), or `{"gone": true}` |
| `same_as`, `keep` | Draw another smear drawing's path; keep only that share of it from the head (a remnant that re-tapers) |
| `slivers` | Two 1 px gold arcs 3 and 6 px outside the head (MOVESET N1) |
| `hide_glaive`, `bend`, `bend_mix` | As v2: the glaive left out of the render and drawn bent from the hands into the head |

What each fix became:

1. **N1's J.** One smooth curve with no corner, the belly on the ground line, a pointed 22 px head, A4 -> A1 along the
   stroke, an A5 edge, a speed line, gold slivers, and a 50% checker where it crosses her. On C1 its head half stays,
   thinner and dimmer, ending at the solid blade; it's gone by f11.
2. **N1's S1 body** is `n1_strike_r3c`, a diagonal with the front knee driving forward.
3. **N1's A1** blends 45% into the coil, the glaive tipped back and down to 30 deg (not up). F2 goes over the right
   shoulder one-handed, so her face stays clear.
4. **N5's ring** is continuous: S1 the back half, S2 the whole ring plus the front crescent, S3 80% of the ring plus
   the bright crescent ending on the blade's tip, C1 55% then 30%, C1b a sliver, gone from f35. The front crescent is
   12-16 px and dithered over her legs.
5. **N5 after contact:** F1 flat and carried back round the front, F2 45 deg, F3 76 deg, K1 upright. The kneel is wider
   and turned 10 deg. R1 is a half-kneel (`n5_rise_r3c`) and R2 a blend half-way to standing.
6. **N5's wind-up and coil.** Body 30 / 80 / 100% + sink. The glaive goes up (70 deg), then over the top into a
   back-arc (36 deg), then flat. The coil (`n5_coil_r3c`) lunges toward the target over the bent front knee, the rear
   leg straight: 43 deg line of action on screen (round 3b: 1.4 deg), back 164 deg from the camera.
7. **The spin turns in every strike drawing:** back (coil) -> left profile (S1, `n5_spin1_r3c`) -> chest to camera
   (S2) -> the target (C1).
8. **Stoles.** N1 now has a 6 f lag, 80% pinned in space. Streaming medians: N1 2 / 3 f, N5 7 / 7 f.
9. **Phase ratio >= 3: not met** (N1 2.19, N5 1.48 on the shipped body drawings). Round 3b's 3.37 came from a smear
   slab the critics rejected. `PIPELINE.md` 3.14 has the numbers and says not to tune toward this metric.

## Known limits

- **Model snapshot.** Round 1 renders use a copy of `rosace.blend` from 02:58 on 2026-09-29; round 2
  uses `work/rosace_snapshot_0342.blend` (03:42, marked read-only), and round 3 uses
  `work/rosace_snapshot_r3_0529.blend` (the live file as saved at 04:50, copied at 05:29, read-only;
  round 2 was re-rendered on it as `n1_r2m` / `n5_r2m` for the blind set). Round 3b uses
  `work/rosace_snapshot_r3r2_0620.blend` (copied at 06:20, read-only, byte-identical to round 3's: the live
  file hadn't changed since 04:50). Round 3c uses `work/rosace_snapshot_r3r3_0714.blend` (copied at 07:14,
  read-only, byte-identical again). The other
  workflow is still changing the model; pass a fresh copy with
  `run_pixel.py ... --blend <copy>`. Never point it at the live file while that workflow saves.
- **Phase ratio ≥ 3.** Round 3b: N1 3.37 (met) and N5 2.58 (not met) on the shipped body drawings, through
  the smears' area. On the body-only images both stay at 1.0-1.2, and the spacing ratios are 2.0-2.3 (N1) and
  1.3 (N5); the spike reaches 3.6 on spacing and 1.72 on RGBA. N5's four-drawing wind-up (yank, coil, sink,
  release) costs 22k px. The next lever is the move design (`PIPELINE.md` 3.14), not the retime.
  Round 3c: N1 2.19 and N5 1.48. The critics' MOVESET-sized crescents replaced round 3b's slabs, and N5's wind-up is
  spread over three moving drawings. Report the metric, don't tune toward it: judge on spacing (N1 tip 2.91, N5 0.99),
  the silhouette ratio and the blind scores.
- **Smears are the smear only.** The stained-glass stages (leading, cells, shards, panes, furrow, the glass
  saint and ring) aren't drawn. Round 3c: N5's ellipse decays over C1 / C1b and is gone from f35, before MOVESET's
  ring would take over at f38. N1's J leaves a remnant on C1. There is still no contact flash, furrow or dust.
- **Plain VRM route.** The retarget works on any `J_Bip_*` armature. The glaive, hand IK and
  drape rely on the Rosace rig's added bones (`glaive`, sockets, `ik_*`, `pole_*`, chains), so
  a bare VRM would need those added first. Not built yet.
- **Fingers** are one fixed grip curl (the left hand opens as it lets go); neither model gives
  usable fingers.
- **Hitstop** isn't inserted: sheets are whiff timing, as in MOVESET's tables.
- **Foreshortened haft.** In N5's S2, the sweep points the haft almost straight at the camera, so it
  nearly vanishes. Round 3's smear (the ellipse round her) carries that drawing. The rest of the
  stained-glass VFX (leaded decay, shards, panes, furrow) isn't drawn.
- **Face** stamps come from the 144 px face library, which is still waiting on its redraw
  (PIPELINE.md 3.10).

## Files

| File | What |
|---|---|
| `retime.py` | Sheet -> retimed NPZ + JSON; `keys`, `init` (scaffold a sheet from a generator sidecar), `preview` |
| `quat.py` | numpy quaternion helpers |
| `soma77.json` | The SOMA77 skeleton as stored in Kimodo/GEM-X NPZs (names, parents, T-pose offsets) |
| `bone_map_vrm.json` | SOMA -> J_Bip map, axis swap, grip sockets, two-hand and slide limits |
| `blender_apply.py` | Retarget + glaive + IK + drape + render (Blender, headless) |
| `run_pixel.py` | One command: sheet -> sprites + sheet PNG |
| `ab_compose.py` | Blind A/B/C GIFs, MP4 and contact sheets |
| `timing/n1.json`, `timing/n5.json` | The two tuned sheets |
| `timing/n1_r2.json`, `timing/n5_r2.json` | Round 2 sheets: pushes 1.6-2.0, re-picked drawings, `hero` section |
| `hero_layer.py` | Hero-key layering, plants, spring cloth (Blender side of `blender_apply.py --hero`) |
| `hero_stills.py` | Hero-key authoring loop: pose JSONs -> 144 px sprites + numbers |
| `rig_measure.py` | Pose numbers on the rig (stance, twist, lean, glaive, hand gap, IK reach) |
| `measure_action.py` | `rig_measure.py` on every image of a saved clip (round 1 included) |
| `motion_metrics.py` | Pixel metrics: entry / mean / silhouette ratios, span at contact |
| `r2_report.py` | Round-2 numbers for N1 and N5 in one JSON |
| `frame_grid.py` | Every rendered image of a clip, in rows, labelled (drawing, cloth-only) |
| `../../art/rosace/poses/motion/*.json` | The hand-posed hero keys (`*_r3.json`: round 3) |
| `timing/n1_r3.json`, `timing/n5_r3.json` | Round 3 sheets: `blend` spacing, world `glaive` keys, `cloth_lag` / `cloth_dyn`, `smear` |
| `smear.py` | Tracked blade smears on strike drawings (post step; `run_pixel.py` runs it when a sheet has `smear`) |
| `r3_report.py` | Round-3 numbers: RGBA phase ratio (shipped and body only), spacing ratios, sweep checks, coils, lag |
| `../../review/motion/r3/_authoring/author_r3_poses.py`, `make_r3_sheets.py` | Writers for the round-3 poses and sheets |
| `timing/n1_r3b.json`, `timing/n5_r3b.json` | Round 3b sheets: `sink`, `wL`, plants on any key, world-held glaive on holds, `cloth_world`, `hold_build`, C1b, `smear._v: 2` |
| `smear_v2.py` | Smears v2: thick bands, bent glaive on `hide_glaive` drawings, 4x raster (`smear.py` dispatches to it) |
| `../../review/motion/r3/_authoring/author_r3b_poses.py`, `make_r3b_sheets.py`, `zoom_r3b.py` | Writers for the round-3b poses and sheets; a close-up sheet of chosen frames |
| `timing/n1_r3c.json`, `timing/n5_r3c.json` | Round 3c sheets: `smear._v: 3`, N5 F2/F3 and R1/R2 keys, the spread wind-ups |
| `smear_v3.py` | Smears v3: crescent profile, colour along the stroke, dither over her body, the J as one curve, ring fraction, per-image `fade`, remnants (`smear.py` dispatches to it) |
| `../../review/motion/r3/_authoring/author_r3c_poses.py`, `make_r3c_sheets.py`, `look_stills.py` | Writers for the round-3c poses and sheets; hero stills tiled with the feet on one line |
