# Rosace motion catalogue (AI-generated and video-captured body motion)

Every candidate body motion made for Rosace's moves, where it came from, and which ones to use.
Files live in `D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw\` (not a git repo). Previews
(MP4, GIF and contact sheet per motion) are in `review/motion/previews/<move>/`; side-by-side
comparisons are in `review/motion/previews/_compare/`.

Tags: **[M]** measured from the files, **[V]** seen in the previews, **[I]** my inference.

## The short answer

Every move has a usable candidate. The strongest come from **Kimodo in-betweening our own MOVESET
key poses** (wrists, ankles and hips pinned, study tempo), not from text prompts alone. Text alone
makes smooth, clean motion that ignores the move: no N1 overhead finish, no N5 spin, no Q
overhead lift [V]. Its QC scores are the best only because it barely moves.
From video, four of the eight captured segments track the performer well enough to use as
reference; two are broken and rejected.

| Move | Pick | Alternates | Why [evidence] |
|---|---|---|---|
| **N1** scoop to overhead | `n1/n1_study_ee_s1_00` | `n1_study_soft_s1_01`, `n1_study_textee_s1_02` | Coil behind, floor scoop, rising contact and overhead finish all land [V]; 0 pops, jitter 0.75 cm, key poses within 8 cm on average [M] |
| **N3** three twirls, rise, raise | `n3/n3_study_textee_s1_00` | `n3_study_ee_s1_00` (1 pop at f29) | Hands follow the twirl path, heels come up at K1, glaive ends raised high [V]; 0 pops, foot slide 6.7 cm/s [M] |
| **N5** coil, unwind sweep, kneel | `n5/n5_study_ee_s1_00` | `n5_study_soft_s1_01`, `n5_study_textee_s1_00` | Back-arc wind-up, coil at -130°, unwind to 0° into a horizontal forward sweep, kneel with the glaive upright, rise [V]; hips turn 230° in all, 0 pops [M] |
| **Q** overhead lift, stamp, blessing | `q/q_study_ee_s1_00` | `q_study_textee_s1_00`, `q_study_soft_s1_00` | Lifts overhead, rises onto the toes, stretches, plants the glaive vertical [V]; cleanest attack clip: slide 4 cm/s, jitter 0.53 cm, 0 pops [M] |
| **Dash** pirouette glide | `dash/dash_study_ee_s1_00` | `dash_study_textee_s1_00` | Lean in, spinning hop, brake, settle [V]; follows the floor path within 3.2 cm on average, 0 pops [M]. Stops at 346°, not 360°: we add the last 14° in retime |
| **Dash attack** (Procession + Aspersion) | `dash_attack/dash_attack_study_ee_s1_00` | `dash_attack_study_text_s1_00` (full 358° spin, looser arms), `dash_attack_study_textee_s1_01` | Spin, slide low, forward pass with the glaive horizontal, glaive to the shoulder, walk-off [V]; path within 3.4 cm, 0 pops [M] |
| **Idle** breathing stance | `idle/idle_study_text_s1_00` | `idle_study_text_s1_01` | The only idles that visibly move: chest drifts 4.6 cm ≈ 2.5 sprite pixels, against 0.9–1.6 cm (under 1 px) for the key-pinned ones [M] |
| **Run** | `run/run_study_free_s1_00` (legs) | `run_study_carry_s1_02` (right hand carries low), `run_study_text_s1_00` | Regular stride with a flight phase, 10.5 m at 3.6 m/s, 0 pops, slide 6.7 cm/s [M, V]. Arms pump in `free`; take the arms from `carry` or key the glaive carry ourselves |
| **Video reference** | `video/windmill_kneelift_gemx`, `video/windmill_overhead_gemx`, `video/bigsweep_overhead_gemx`, `video/whirlpool_wheels_gemx` | `video/thrustmow_thrust_mow_gemx` | Captured poses match the footage at every sampled frame: knee-lift pivots, overhead windmills, the low lunge sweep, side lunges [V]. `windmill_overhead` slides its feet 39 cm/s [M]: use it for the upper body. Trim the first 15–25 frames: the performer is still walking into shot there [V] |

A sprite pixel is 1.8 cm on this body (96 px = 1.76 m), which is how the idle and foot-slide numbers
translate to what a player would see [I].

## What got rejected, and why

| Rejected | What's wrong [evidence] |
|---|---|
| Text-only N1, N3, N5, Q (`*_study_text_*`, `*_study_text5s_*`) | Smooth, but the move isn't there: N1 pokes the glaive forward-down and never goes overhead; N3 holds the glaive out; N5 turns at most 91° and never kneels; Q plants a staff but never lifts it overhead [V; hips turn range, M] |
| Text-only dash `dash_study_text_*` | Splays into a wide squat with flailing arms mid-dash [V] |
| All `full` mode (every joint pinned + snapping) | One-frame pops where Kimodo snaps onto a key: 10 at N1's S1→C1 snap, 16–31 in N5 [M]. Jitter 2–3.5 cm, about 2× the `ee` versions [M] |
| All `soft` dash and dash-attack | Without post-processing they drift off the floor path: 23–37 cm mean, up to 162 cm [M] |
| All `n5long` (the 230° unwind variant) | Every sample misses one key pose by 70–86 cm [M]: Kimodo won't turn that far between those keys. Needs a different key layout, not more samples [I] |
| All `game` tempo (MOVESET frame N → Kimodo frame N/2) | About twice the jitter of study tempo (1.3–5.0 cm) and more pops [M]. The model is trained on natural-speed motion; generate at study tempo and compress in our retime pass [I] |
| `video/whirlpool_twirl_plant_*` | From f50 the capture turns to face away (+180°) and straightens its legs (median knee bend 19–25°) while the performer faces the camera in a deep bent-knee stance [V, M]. The Kimodo re-keys copy the error |
| `video/bigsweep_sweep_kneel_*` | The performer drops to one knee (f40–69); the capture stands upright with boxed arms throughout (hips never below 90 cm, where a kneel sits near 55 cm) [V, M]. He is half out of frame around f20–30 [V] |
| `video/windmill_overhead_kimodo_x0.6_*` | Foot slide 67–129 cm/s [M] |

## What to know before retiming

- **Holds wander.** Kimodo fills a held pose with motion: N5's coil hold (f21→f34 study) turns on
  to about -210° and crumples low before coming back [V]. Our retime replaces holds with true
  freezes anyway, so only the key poses and the transitions matter [I].
- **One-frame snaps can't come from Kimodo at 30 fps.** N1's S1→C1 is one 60 fps frame; at study tempo it's
  one 30 fps frame, and Kimodo spreads it out (max key error 30 cm on that key in `ee` mode) [M].
  The snap is ours to add in retime; the model provides the poses either side.
- **Foot slide is not always garbage.** The dash and dash attack are glides, so 40+ cm/s "slide"
  there is the intended move, not a defect [I]. For the attacks, `ee` N1 and N5 still slide
  18–23 cm/s on average, mostly during the lunge step. Foot-lock (IK the planted foot) is needed in the
  retime pass [M/I].
- **The glaive is not in the motion.** Both models move a body only. The purple line in previews
  is a proxy drawn between the wrists whenever they are 15–85 cm apart; the real glaive is keyed as
  a prop on the right hand with the left hand pinned to the haft [S, SETUP.md].
- **Video captures need a trim and a side check.** In 4 of 8 segments the first 15–25 frames are
  the performer entering the frame [V]. These clips are shot front-on, so check captures with
  `compare_strips.py --view front`: a side view hides spread legs and arms [V].
- **Video rights.** The four source clips are Motion Actor Inc "Long Weapon" videos: free to trace
  and rearrange, no profit use, no reposting (THIRD_PARTY.md). Everything under `raw/video/` is
  study material until Dex rules whether dex.place counts as non-profit. Never commit it or ship it.

## How it was made

- **Key poses** (`rosace_keys.py`, `rosace_moves.py`): each MOVESET key drawing is written as a pose
  (hips height, lean, twist, hand and foot targets), solved to the SOMA skeleton, and handed to
  Kimodo in one of these modes: `full` (all joints), `soft` (all joints, no clean-up), `ee` (wrists, ankles, hips), `text`
  (text + opening stance only), `textee` (text + `ee` keys), and for the run `free` (floor path only) and `carry`.
  The key-only BVHs are in `raw/_keys/`; constraint files and per-variant key frame lists are in `raw/_constraints/`.
- **Tempo:** `study` = MOVESET 60 fps frame N at Kimodo 30 fps frame N (half speed, room for natural
  motion), `game` = frame N/2 (real speed). Every clip starts with a 12-frame still pre-roll.
- **Text prompts** are in each run's JSON report and in the table below; the encoder is Llama 3 8B via
  LLM2Vec on the CPU (SETUP.md).
- **Video** (`capture_segments.py`): GEM-X on four 1080p60 clips resampled to 30 fps → cut into 8
  attack segments facing +Z (`*_gemx`) → key poses picked where both wrists slow to a stop → Kimodo
  re-in-betweens them at the same timing (`x1.0`) or with every gap shrunk to 60% (`x0.6`).
- **Seeds and samples:** seed 1 (text5s: seed 2), 3 samples per run, 100 diffusion steps.
- **QC** (`motion_qc.py`, `review_batch.py`): foot slide while planted, jitter against a 7-frame
  smooth fit, one-frame pops, wrist bend, two-handed grip share, hips turn, key-pose and path error.
  The combined score only sorts; the picks above come from looking at `review/motion/previews/_compare/`.

Reproduce the review images (Kimodo venv; GPU not needed):

```sh
PY=D:/Dex/Tools/venvs/kimodo/Scripts/python.exe; R=D:/Dex/Projects/dex-place-art/rosace/motion-ai/raw
$PY tools/motion-ai/review_batch.py                       # previews + QC for every move (slow; --no-render for QC only)
$PY tools/motion-ai/compare_strips.py out.png $R/_keys/n5_keys.bvh $R/n5/n5_study_ee_s1_00.bvh ...   # key-frame strips
$PY tools/motion-ai/compare_strips.py out.png $R/video/windmill_kneelift_gemx.bvh --frames even --view front
$PY tools/motion-ai/qc_rows.py n5 study_ee               # QC numbers for matching variants
$PY tools/motion-ai/make_catalogue.py                     # rebuild the table below
```

## Every motion

<!-- AUTO-TABLE -->

244 motions.

| File (under `raw/`) | Move | Made from | Prompt / clip | Model | Frames @30 | Slide cm/s | Jitter cm | Pops | Key err cm mean/max | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| `dash/dash_game_ee_s1_00.bvh` | dash | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 38 | 54.43 | 2.008 | 0 | 15.1/37.7 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash/dash_game_ee_s1_01.bvh` | dash | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 38 | 32.99 | 2.085 | 0 | 15.9/38.1 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash/dash_game_ee_s1_02.bvh` | dash | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 38 | 61.74 | 2.359 | 0 | 12.6/26.6 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash/dash_game_full_s1_00.bvh` | dash | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 38 | 134.13 | 3.159 | 0 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash/dash_game_full_s1_01.bvh` | dash | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 38 | 123.5 | 2.872 | 3 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash/dash_game_full_s1_02.bvh` | dash | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 38 | 211.4 | 3.007 | 0 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash/dash_game_soft_s1_00.bvh` | dash | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 38 | 74.19 | 1.883 | 0 | 54.2/114.9 | reject: misses the floor path (23-37 cm mean, up to 122 cm) |
| `dash/dash_game_soft_s1_01.bvh` | dash | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 38 | 211.28 | 1.719 | 0 | 55.4/102.0 | reject: misses the floor path (23-37 cm mean, up to 122 cm) |
| `dash/dash_game_soft_s1_02.bvh` | dash | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 38 | 153.61 | 2.01 | 0 | 55.3/112.7 | reject: misses the floor path (23-37 cm mean, up to 122 cm) |
| `dash/dash_study_ee_s1_00.bvh` | dash | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 49 | 42.95 | 1.327 | 0 | 7.6/16.9 | PICK |
| `dash/dash_study_ee_s1_01.bvh` | dash | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 49 | 55.87 | 1.595 | 0 | 7.3/17.9 | - |
| `dash/dash_study_ee_s1_02.bvh` | dash | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 49 | 69.07 | 1.291 | 3 | 7.3/11.6 | - |
| `dash/dash_study_full_s1_00.bvh` | dash | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 49 | 76.23 | 2.026 | 0 | 0.5/6.0 | - |
| `dash/dash_study_full_s1_01.bvh` | dash | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 49 | 82.8 | 2.272 | 10 | 0.5/6.0 | - |
| `dash/dash_study_full_s1_02.bvh` | dash | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 49 | 71.78 | 2.298 | 0 | 0.5/6.0 | - |
| `dash/dash_study_soft_s1_00.bvh` | dash | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 49 | 88.42 | 1.372 | 0 | 17.3/42.7 | reject: misses the floor path (23-37 cm mean, up to 122 cm) |
| `dash/dash_study_soft_s1_01.bvh` | dash | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 49 | 89.14 | 1.44 | 0 | 16.6/36.9 | reject: misses the floor path (23-37 cm mean, up to 122 cm) |
| `dash/dash_study_soft_s1_02.bvh` | dash | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 49 | 80.81 | 1.4 | 0 | 17.6/46.1 | reject: misses the floor path (23-37 cm mean, up to 122 cm) |
| `dash/dash_study_text_s1_00.bvh` | dash | study / text + opening stance only | "A person dashes forward in a gliding pirouette, spinning once arou..." | Kimodo v1.1 + text | 49 | 68.31 | 1.336 | 0 | 0.5/6.0 | reject: splays into a wide squat |
| `dash/dash_study_text_s1_01.bvh` | dash | study / text + opening stance only | "A person dashes forward in a gliding pirouette, spinning once arou..." | Kimodo v1.1 + text | 49 | 72.31 | 1.275 | 2 | 0.5/6.0 | reject: splays into a wide squat |
| `dash/dash_study_text_s1_02.bvh` | dash | study / text + opening stance only | "A person dashes forward in a gliding pirouette, spinning once arou..." | Kimodo v1.1 + text | 49 | 53.76 | 1.285 | 0 | 0.5/6.0 | reject: splays into a wide squat |
| `dash/dash_study_textee_s1_00.bvh` | dash | study / text + wrists/ankles/hips keys | "A person dashes forward in a gliding pirouette, spinning once arou..." | Kimodo v1.1 + text | 49 | 42.94 | 1.364 | 0 | 7.3/16.9 | alt |
| `dash/dash_study_textee_s1_01.bvh` | dash | study / text + wrists/ankles/hips keys | "A person dashes forward in a gliding pirouette, spinning once arou..." | Kimodo v1.1 + text | 49 | 61.15 | 1.669 | 0 | 7.7/18.2 | - |
| `dash/dash_study_textee_s1_02.bvh` | dash | study / text + wrists/ankles/hips keys | "A person dashes forward in a gliding pirouette, spinning once arou..." | Kimodo v1.1 + text | 49 | 61.33 | 1.322 | 3 | 7.5/12.5 | - |
| `dash_attack/dash_attack_game_ee_s1_00.bvh` | dash_attack | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 55 | 129.11 | 3.07 | 1 | 15.1/68.9 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash_attack/dash_attack_game_ee_s1_01.bvh` | dash_attack | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 55 | 85.55 | 2.771 | 0 | 13.8/64.3 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash_attack/dash_attack_game_ee_s1_02.bvh` | dash_attack | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 55 | 76.72 | 2.445 | 1 | 14.2/68.4 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash_attack/dash_attack_game_full_s1_00.bvh` | dash_attack | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 55 | 106.75 | 4.771 | 3 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash_attack/dash_attack_game_full_s1_01.bvh` | dash_attack | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 55 | 114.35 | 4.488 | 4 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash_attack/dash_attack_game_full_s1_02.bvh` | dash_attack | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 55 | 67.3 | 4.397 | 6 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `dash_attack/dash_attack_game_soft_s1_00.bvh` | dash_attack | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 55 | 102.43 | 2.71 | 0 | 55.6/120.6 | reject: misses the floor path (23-37 cm mean, up to 162 cm) |
| `dash_attack/dash_attack_game_soft_s1_01.bvh` | dash_attack | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 55 | 130.25 | 2.55 | 0 | 60.7/139.9 | reject: misses the floor path (23-37 cm mean, up to 162 cm) |
| `dash_attack/dash_attack_game_soft_s1_02.bvh` | dash_attack | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 55 | 130.6 | 2.468 | 0 | 57.5/119.8 | reject: misses the floor path (23-37 cm mean, up to 162 cm) |
| `dash_attack/dash_attack_study_ee_s1_00.bvh` | dash_attack | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 84 | 42.31 | 1.421 | 0 | 8.4/24.3 | PICK |
| `dash_attack/dash_attack_study_ee_s1_01.bvh` | dash_attack | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 84 | 46.89 | 1.537 | 0 | 8.5/29.4 | - |
| `dash_attack/dash_attack_study_ee_s1_02.bvh` | dash_attack | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 84 | 52.96 | 1.357 | 1 | 8.6/26.3 | - |
| `dash_attack/dash_attack_study_full_s1_00.bvh` | dash_attack | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 84 | 69.67 | 2.15 | 0 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_full_s1_01.bvh` | dash_attack | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 84 | 55.43 | 2.604 | 1 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_full_s1_02.bvh` | dash_attack | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 84 | 70.38 | 2.365 | 0 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_soft_s1_00.bvh` | dash_attack | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 84 | 38.87 | 1.56 | 2 | 22.3/45.7 | reject: misses the floor path (23-37 cm mean, up to 162 cm) |
| `dash_attack/dash_attack_study_soft_s1_01.bvh` | dash_attack | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 84 | 33.32 | 1.782 | 0 | 21.9/47.2 | reject: misses the floor path (23-37 cm mean, up to 162 cm) |
| `dash_attack/dash_attack_study_soft_s1_02.bvh` | dash_attack | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 84 | 64.47 | 1.367 | 0 | 19.4/43.9 | reject: misses the floor path (23-37 cm mean, up to 162 cm) |
| `dash_attack/dash_attack_study_text5s_s2_00.bvh` | dash_attack | study / text + opening stance, 5 s | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 150 | 34.63 | 0.839 | 0 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_text5s_s2_01.bvh` | dash_attack | study / text + opening stance, 5 s | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 150 | 28.42 | 0.615 | 0 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_text5s_s2_02.bvh` | dash_attack | study / text + opening stance, 5 s | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 150 | 25.22 | 0.698 | 0 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_text_s1_00.bvh` | dash_attack | study / text + opening stance only | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 84 | 33.26 | 0.921 | 0 | 0.5/6.0 | alt (looser, full 358 deg spin) |
| `dash_attack/dash_attack_study_text_s1_01.bvh` | dash_attack | study / text + opening stance only | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 84 | 35.92 | 0.845 | 3 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_text_s1_02.bvh` | dash_attack | study / text + opening stance only | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 84 | 69.28 | 0.934 | 0 | 0.5/6.0 | - |
| `dash_attack/dash_attack_study_textee_s1_00.bvh` | dash_attack | study / text + wrists/ankles/hips keys | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 84 | 40.02 | 1.389 | 0 | 8.7/24.4 | - |
| `dash_attack/dash_attack_study_textee_s1_01.bvh` | dash_attack | study / text + wrists/ankles/hips keys | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 84 | 22.2 | 1.679 | 0 | 9.4/36.7 | alt |
| `dash_attack/dash_attack_study_textee_s1_02.bvh` | dash_attack | study / text + wrists/ankles/hips keys | "A person dashes forward spinning once, then slides low and cuts st..." | Kimodo v1.1 + text | 84 | 34.92 | 1.398 | 0 | 9.0/34.0 | - |
| `idle/idle_study_ee_s1_00.bvh` | idle | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 146 | 0.51 | 0.013 | 0 | 2.4/3.3 | ok but frozen (<1 px of motion) |
| `idle/idle_study_ee_s1_01.bvh` | idle | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 146 | 0.43 | 0.013 | 0 | 2.2/3.3 | ok but frozen (<1 px of motion) |
| `idle/idle_study_ee_s1_02.bvh` | idle | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 146 | 0.47 | 0.012 | 0 | 2.3/3.3 | ok but frozen (<1 px of motion) |
| `idle/idle_study_full_s1_00.bvh` | idle | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 146 | 1.5 | 0.014 | 0 | 0.5/6.0 | ok but frozen (<1 px of motion) |
| `idle/idle_study_full_s1_01.bvh` | idle | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 146 | 1.63 | 0.014 | 0 | 0.5/6.0 | ok but frozen (<1 px of motion) |
| `idle/idle_study_full_s1_02.bvh` | idle | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 146 | 1.34 | 0.014 | 0 | 0.5/6.0 | ok but frozen (<1 px of motion) |
| `idle/idle_study_text_s1_00.bvh` | idle | study / text + opening stance only | "A person stands still holding a tall staff upright at their right ..." | Kimodo v1.1 + text | 146 | 0.58 | 0.007 | 0 | 0.5/6.0 | PICK |
| `idle/idle_study_text_s1_01.bvh` | idle | study / text + opening stance only | "A person stands still holding a tall staff upright at their right ..." | Kimodo v1.1 + text | 146 | 0.48 | 0.007 | 0 | 0.5/6.0 | alt |
| `idle/idle_study_text_s1_02.bvh` | idle | study / text + opening stance only | "A person stands still holding a tall staff upright at their right ..." | Kimodo v1.1 + text | 146 | 0.52 | 0.007 | 0 | 0.5/6.0 | - |
| `idle/idle_study_textee_s1_00.bvh` | idle | study / text + wrists/ankles/hips keys | "A person stands still holding a tall staff upright at their right ..." | Kimodo v1.1 + text | 146 | 0.41 | 0.012 | 0 | 2.3/3.6 | ok but frozen (<1 px of motion) |
| `idle/idle_study_textee_s1_01.bvh` | idle | study / text + wrists/ankles/hips keys | "A person stands still holding a tall staff upright at their right ..." | Kimodo v1.1 + text | 146 | 0.36 | 0.012 | 0 | 2.2/3.1 | ok but frozen (<1 px of motion) |
| `idle/idle_study_textee_s1_02.bvh` | idle | study / text + wrists/ankles/hips keys | "A person stands still holding a tall staff upright at their right ..." | Kimodo v1.1 + text | 146 | 0.4 | 0.012 | 0 | 2.2/3.3 | ok but frozen (<1 px of motion) |
| `n1/n1_game_ee_s1_00.bvh` | n1 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 42 | 20.91 | 1.737 | 1 | 8.0/42.8 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_ee_s1_01.bvh` | n1 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 42 | 33.2 | 1.707 | 0 | 7.8/37.8 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_ee_s1_02.bvh` | n1 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 42 | 24.22 | 1.768 | 0 | 7.9/40.4 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_full_s1_00.bvh` | n1 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 42 | 52.62 | 3.197 | 0 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_full_s1_01.bvh` | n1 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 42 | 49.69 | 3.528 | 0 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_full_s1_02.bvh` | n1 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 42 | 49.69 | 3.54 | 0 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_soft_s1_00.bvh` | n1 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 42 | 25.82 | 1.84 | 9 | 6.3/41.6 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_soft_s1_01.bvh` | n1 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 42 | 30.47 | 1.717 | 6 | 6.3/45.1 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_game_soft_s1_02.bvh` | n1 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 42 | 31.8 | 1.87 | 20 | 6.6/40.8 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n1/n1_study_ee_s1_00.bvh` | n1 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 59 | 18.17 | 0.752 | 0 | 8.1/30.6 | PICK |
| `n1/n1_study_ee_s1_01.bvh` | n1 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 59 | 21.21 | 0.768 | 0 | 7.9/31.4 | - |
| `n1/n1_study_ee_s1_02.bvh` | n1 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 59 | 18.91 | 0.877 | 0 | 8.5/32.0 | - |
| `n1/n1_study_full_s1_00.bvh` | n1 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 59 | 33.4 | 2.358 | 10 | 0.5/6.0 | reject: pops at the S1-C1 snap |
| `n1/n1_study_full_s1_01.bvh` | n1 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 59 | 32.2 | 2.383 | 10 | 0.5/6.0 | reject: pops at the S1-C1 snap |
| `n1/n1_study_full_s1_02.bvh` | n1 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 59 | 43.5 | 2.303 | 10 | 0.5/6.0 | reject: pops at the S1-C1 snap |
| `n1/n1_study_soft_s1_00.bvh` | n1 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 59 | 20.82 | 0.993 | 0 | 6.7/33.5 | - |
| `n1/n1_study_soft_s1_01.bvh` | n1 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 59 | 20.17 | 1.071 | 0 | 6.7/33.5 | alt |
| `n1/n1_study_soft_s1_02.bvh` | n1 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 59 | 29.03 | 1.078 | 0 | 6.5/32.3 | - |
| `n1/n1_study_text5s_s2_00.bvh` | n1 | study / text + opening stance, 5 s | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 150 | 1.61 | 0.026 | 0 | 0.5/6.0 | reject: no scoop, never overhead |
| `n1/n1_study_text5s_s2_01.bvh` | n1 | study / text + opening stance, 5 s | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 150 | 6.74 | 0.062 | 0 | 0.5/6.0 | reject: no scoop, never overhead |
| `n1/n1_study_text5s_s2_02.bvh` | n1 | study / text + opening stance, 5 s | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 150 | 0.49 | 0.037 | 0 | 0.5/6.0 | reject: no scoop, never overhead |
| `n1/n1_study_text_s1_00.bvh` | n1 | study / text + opening stance only | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 59 | 1.98 | 0.087 | 0 | 0.5/6.0 | reject: no scoop, never overhead |
| `n1/n1_study_text_s1_01.bvh` | n1 | study / text + opening stance only | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 59 | 1.1 | 0.134 | 0 | 0.5/6.0 | reject: no scoop, never overhead |
| `n1/n1_study_text_s1_02.bvh` | n1 | study / text + opening stance only | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 59 | 0.91 | 0.033 | 0 | 0.5/6.0 | reject: no scoop, never overhead |
| `n1/n1_study_textee_s1_00.bvh` | n1 | study / text + wrists/ankles/hips keys | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 59 | 20.4 | 0.73 | 0 | 7.8/31.6 | - |
| `n1/n1_study_textee_s1_01.bvh` | n1 | study / text + wrists/ankles/hips keys | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 59 | 20.25 | 0.784 | 0 | 8.0/30.9 | - |
| `n1/n1_study_textee_s1_02.bvh` | n1 | study / text + wrists/ankles/hips keys | "A person holding a long glaive in both hands drops their weight ba..." | Kimodo v1.1 + text | 59 | 18.5 | 0.811 | 0 | 8.5/33.4 | alt |
| `n3/n3_game_ee_s1_00.bvh` | n3 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 54 | 9.37 | 2.143 | 8 | 8.5/36.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_ee_s1_01.bvh` | n3 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 54 | 8.65 | 2.155 | 12 | 8.4/44.3 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_ee_s1_02.bvh` | n3 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 54 | 8.44 | 2.217 | 8 | 8.1/41.1 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_full_s1_00.bvh` | n3 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 54 | 45.29 | 5.041 | 59 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_full_s1_01.bvh` | n3 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 54 | 41.75 | 4.819 | 42 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_full_s1_02.bvh` | n3 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 54 | 36.85 | 4.534 | 44 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_soft_s1_00.bvh` | n3 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 54 | 12.62 | 2.319 | 60 | 8.6/37.6 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_soft_s1_01.bvh` | n3 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 54 | 11.08 | 2.317 | 59 | 8.1/36.2 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_game_soft_s1_02.bvh` | n3 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 54 | 12.94 | 2.322 | 58 | 8.5/37.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n3/n3_study_ee_s1_00.bvh` | n3 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 81 | 5.39 | 1.094 | 1 | 4.3/17.7 | alt |
| `n3/n3_study_ee_s1_01.bvh` | n3 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 81 | 4.24 | 1.153 | 7 | 4.5/17.8 | - |
| `n3/n3_study_ee_s1_02.bvh` | n3 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 81 | 4.11 | 1.094 | 31 | 4.6/18.5 | - |
| `n3/n3_study_full_s1_00.bvh` | n3 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 81 | 18.35 | 2.147 | 26 | 0.5/6.0 | - |
| `n3/n3_study_full_s1_01.bvh` | n3 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 81 | 18.07 | 1.841 | 2 | 0.5/6.0 | - |
| `n3/n3_study_full_s1_02.bvh` | n3 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 81 | 20.43 | 2.156 | 7 | 0.5/6.0 | - |
| `n3/n3_study_soft_s1_00.bvh` | n3 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 81 | 11.49 | 1.302 | 51 | 4.0/18.8 | - |
| `n3/n3_study_soft_s1_01.bvh` | n3 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 81 | 9.72 | 1.222 | 26 | 3.9/20.8 | - |
| `n3/n3_study_soft_s1_02.bvh` | n3 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 81 | 10.98 | 1.347 | 50 | 4.0/18.5 | - |
| `n3/n3_study_text5s_s2_00.bvh` | n3 | study / text + opening stance, 5 s | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 150 | 0.63 | 0.038 | 0 | 0.5/6.0 | reject: holds the glaive out, no twirl path |
| `n3/n3_study_text5s_s2_01.bvh` | n3 | study / text + opening stance, 5 s | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 150 | 0.39 | 0.029 | 0 | 0.5/6.0 | reject: holds the glaive out, no twirl path |
| `n3/n3_study_text5s_s2_02.bvh` | n3 | study / text + opening stance, 5 s | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 150 | 0.89 | 0.075 | 0 | 0.5/6.0 | reject: holds the glaive out, no twirl path |
| `n3/n3_study_text_s1_00.bvh` | n3 | study / text + opening stance only | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 81 | 2.14 | 0.073 | 0 | 0.5/6.0 | reject: holds the glaive out, no twirl path |
| `n3/n3_study_text_s1_01.bvh` | n3 | study / text + opening stance only | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 81 | 0.66 | 0.055 | 0 | 0.5/6.0 | reject: holds the glaive out, no twirl path |
| `n3/n3_study_text_s1_02.bvh` | n3 | study / text + opening stance only | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 81 | 1.16 | 0.16 | 0 | 0.5/6.0 | reject: holds the glaive out, no twirl path |
| `n3/n3_study_textee_s1_00.bvh` | n3 | study / text + wrists/ankles/hips keys | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 81 | 6.73 | 1.081 | 0 | 4.2/17.9 | PICK |
| `n3/n3_study_textee_s1_01.bvh` | n3 | study / text + wrists/ankles/hips keys | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 81 | 5.05 | 1.065 | 2 | 4.7/19.2 | - |
| `n3/n3_study_textee_s1_02.bvh` | n3 | study / text + wrists/ankles/hips keys | "A person twirls a long staff like a baton in front of their chest ..." | Kimodo v1.1 + text | 81 | 5.1 | 1.085 | 35 | 4.6/18.0 | - |
| `n5/n5_game_ee_s1_00.bvh` | n5 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 73 | 44.2 | 1.631 | 0 | 11.5/51.4 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_ee_s1_01.bvh` | n5 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 73 | 34.83 | 1.643 | 0 | 9.9/45.7 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_ee_s1_02.bvh` | n5 | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 73 | 46.83 | 1.787 | 0 | 11.2/43.5 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_full_s1_00.bvh` | n5 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 73 | 57.52 | 3.281 | 2 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_full_s1_01.bvh` | n5 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 73 | 74.99 | 3.297 | 2 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_full_s1_02.bvh` | n5 | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 73 | 92.07 | 3.438 | 2 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_soft_s1_00.bvh` | n5 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 73 | 44.09 | 1.746 | 1 | 9.9/41.3 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_soft_s1_01.bvh` | n5 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 73 | 24.8 | 1.974 | 29 | 9.1/40.7 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_game_soft_s1_02.bvh` | n5 | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 73 | 35.66 | 1.979 | 1 | 9.6/40.9 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `n5/n5_study_ee_s1_00.bvh` | n5 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 120 | 22.58 | 1.19 | 0 | 10.1/40.8 | PICK |
| `n5/n5_study_ee_s1_01.bvh` | n5 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 120 | 26.35 | 0.984 | 0 | 9.6/37.5 | - |
| `n5/n5_study_ee_s1_02.bvh` | n5 | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 120 | 29.04 | 0.995 | 3 | 9.0/37.3 | - |
| `n5/n5_study_full_s1_00.bvh` | n5 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 120 | 85.73 | 2.645 | 29 | 0.5/6.0 | reject: 16-31 pops |
| `n5/n5_study_full_s1_01.bvh` | n5 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 120 | 50.13 | 2.346 | 31 | 0.5/6.0 | reject: 16-31 pops |
| `n5/n5_study_full_s1_02.bvh` | n5 | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 120 | 64.38 | 2.375 | 16 | 0.5/6.0 | reject: 16-31 pops |
| `n5/n5_study_soft_s1_00.bvh` | n5 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 120 | 29.67 | 1.511 | 0 | 7.6/47.1 | - |
| `n5/n5_study_soft_s1_01.bvh` | n5 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 120 | 23.67 | 1.157 | 0 | 7.4/44.8 | alt |
| `n5/n5_study_soft_s1_02.bvh` | n5 | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 120 | 30.22 | 1.26 | 27 | 7.4/35.8 | - |
| `n5/n5_study_text5s_s2_00.bvh` | n5 | study / text + opening stance, 5 s | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 150 | 1.48 | 0.104 | 0 | 0.5/6.0 | reject: no spin, no kneel |
| `n5/n5_study_text5s_s2_01.bvh` | n5 | study / text + opening stance, 5 s | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 150 | 0.7 | 0.081 | 0 | 0.5/6.0 | reject: no spin, no kneel |
| `n5/n5_study_text5s_s2_02.bvh` | n5 | study / text + opening stance, 5 s | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 150 | 0.95 | 0.075 | 0 | 0.5/6.0 | reject: no spin, no kneel |
| `n5/n5_study_text_s1_00.bvh` | n5 | study / text + opening stance only | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 1.88 | 0.074 | 0 | 0.5/6.0 | reject: no spin, no kneel |
| `n5/n5_study_text_s1_01.bvh` | n5 | study / text + opening stance only | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 3.22 | 0.222 | 0 | 0.5/6.0 | reject: no spin, no kneel |
| `n5/n5_study_text_s1_02.bvh` | n5 | study / text + opening stance only | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 1.1 | 0.125 | 0 | 0.5/6.0 | reject: no spin, no kneel |
| `n5/n5_study_textee_s1_00.bvh` | n5 | study / text + wrists/ankles/hips keys | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 26.93 | 1.18 | 0 | 9.6/39.9 | alt |
| `n5/n5_study_textee_s1_01.bvh` | n5 | study / text + wrists/ankles/hips keys | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 33.88 | 1.011 | 0 | 9.4/36.9 | - |
| `n5/n5_study_textee_s1_02.bvh` | n5 | study / text + wrists/ankles/hips keys | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 34.36 | 1.086 | 1 | 9.2/39.2 | - |
| `n5long/n5long_game_ee_s1_00.bvh` | n5long | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 73 | 39.39 | 1.776 | 22 | 13.0/51.6 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_ee_s1_01.bvh` | n5long | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 73 | 29.42 | 1.81 | 25 | 12.8/48.3 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_ee_s1_02.bvh` | n5long | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 73 | 41.9 | 1.835 | 25 | 12.8/45.8 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_full_s1_00.bvh` | n5long | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 73 | 138.06 | 3.252 | 17 | 0.5/6.0 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_full_s1_01.bvh` | n5long | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 73 | 129.62 | 3.254 | 4 | 0.5/6.0 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_full_s1_02.bvh` | n5long | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 73 | 161.59 | 3.213 | 26 | 0.5/6.0 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_soft_s1_00.bvh` | n5long | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 73 | 58.15 | 1.942 | 3 | 10.8/43.4 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_soft_s1_01.bvh` | n5long | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 73 | 31.77 | 1.909 | 25 | 8.7/49.2 | reject: misses a key by 70-86 cm |
| `n5long/n5long_game_soft_s1_02.bvh` | n5long | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 73 | 65.11 | 2.125 | 7 | 9.4/34.3 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_ee_s1_00.bvh` | n5long | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 120 | 52.32 | 0.942 | 1 | 10.0/84.1 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_ee_s1_01.bvh` | n5long | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 120 | 33.7 | 0.907 | 2 | 10.9/85.6 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_ee_s1_02.bvh` | n5long | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 120 | 35.11 | 1.188 | 1 | 9.8/79.5 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_full_s1_00.bvh` | n5long | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 120 | 79.78 | 2.386 | 27 | 0.5/6.0 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_full_s1_01.bvh` | n5long | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 120 | 83.81 | 2.334 | 22 | 0.5/6.0 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_full_s1_02.bvh` | n5long | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 120 | 71.77 | 2.279 | 57 | 0.5/6.0 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_soft_s1_00.bvh` | n5long | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 120 | 23.8 | 1.069 | 8 | 7.4/70.8 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_soft_s1_01.bvh` | n5long | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 120 | 34.98 | 1.125 | 3 | 7.9/81.4 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_soft_s1_02.bvh` | n5long | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 120 | 28.73 | 1.199 | 26 | 7.5/95.8 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_textee_s1_00.bvh` | n5long | study / text + wrists/ankles/hips keys | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 53.95 | 0.944 | 3 | 10.1/84.1 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_textee_s1_01.bvh` | n5long | study / text + wrists/ankles/hips keys | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 44.64 | 0.959 | 3 | 11.1/84.2 | reject: misses a key by 70-86 cm |
| `n5long/n5long_study_textee_s1_02.bvh` | n5long | study / text + wrists/ankles/hips keys | "A person yanks a long glaive back, winds it up behind them into a ..." | Kimodo v1.1 + text | 120 | 40.81 | 1.279 | 1 | 10.1/79.9 | reject: misses a key by 70-86 cm |
| `q/q_game_ee_s1_00.bvh` | q | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 66 | 10.05 | 1.452 | 2 | 5.0/21.6 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_ee_s1_01.bvh` | q | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 66 | 11.69 | 1.311 | 2 | 5.4/27.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_ee_s1_02.bvh` | q | game / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 66 | 13.97 | 1.445 | 1 | 5.0/21.5 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_full_s1_00.bvh` | q | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 66 | 15.94 | 2.828 | 14 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_full_s1_01.bvh` | q | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 66 | 21.66 | 2.805 | 17 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_full_s1_02.bvh` | q | game / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 66 | 13.77 | 2.728 | 14 | 0.5/6.0 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_soft_s1_00.bvh` | q | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 66 | 17.08 | 1.608 | 0 | 3.7/26.9 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_soft_s1_01.bvh` | q | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 66 | 17.09 | 1.6 | 0 | 3.7/26.7 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_game_soft_s1_02.bvh` | q | game / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 66 | 14.34 | 1.541 | 0 | 3.7/26.2 | game tempo: jitter 1.3-5.0 cm, use study + our retime |
| `q/q_study_ee_s1_00.bvh` | q | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 107 | 4.05 | 0.53 | 0 | 3.0/11.1 | PICK |
| `q/q_study_ee_s1_01.bvh` | q | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 107 | 8.64 | 0.564 | 0 | 3.0/11.6 | - |
| `q/q_study_ee_s1_02.bvh` | q | study / MOVESET keys, wrists/ankles/hips | (no text) | Kimodo v1.1 (no text) | 107 | 6.66 | 0.535 | 18 | 3.0/10.2 | - |
| `q/q_study_full_s1_00.bvh` | q | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 107 | 8.87 | 0.783 | 0 | 0.5/6.0 | - |
| `q/q_study_full_s1_01.bvh` | q | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 107 | 12.67 | 0.81 | 0 | 0.5/6.0 | - |
| `q/q_study_full_s1_02.bvh` | q | study / MOVESET keys, all joints | (no text) | Kimodo v1.1 (no text) | 107 | 10.37 | 0.774 | 0 | 0.5/6.0 | - |
| `q/q_study_soft_s1_00.bvh` | q | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 107 | 8.34 | 0.505 | 0 | 2.2/11.4 | alt |
| `q/q_study_soft_s1_01.bvh` | q | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 107 | 12.1 | 0.552 | 0 | 2.3/12.2 | - |
| `q/q_study_soft_s1_02.bvh` | q | study / MOVESET keys, all joints, no post-process | (no text) | Kimodo v1.1 (no text) | 107 | 9.06 | 0.516 | 0 | 2.3/13.2 | - |
| `q/q_study_text5s_s2_00.bvh` | q | study / text + opening stance, 5 s | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 150 | 0.35 | 0.026 | 0 | 0.5/6.0 | reject: plants a staff but never lifts it overhead |
| `q/q_study_text5s_s2_01.bvh` | q | study / text + opening stance, 5 s | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 150 | 0.97 | 0.048 | 0 | 0.5/6.0 | reject: plants a staff but never lifts it overhead |
| `q/q_study_text5s_s2_02.bvh` | q | study / text + opening stance, 5 s | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 150 | 0.7 | 0.064 | 0 | 0.5/6.0 | reject: plants a staff but never lifts it overhead |
| `q/q_study_text_s1_00.bvh` | q | study / text + opening stance only | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 107 | 2.63 | 0.098 | 0 | 0.5/6.0 | reject: plants a staff but never lifts it overhead |
| `q/q_study_text_s1_01.bvh` | q | study / text + opening stance only | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 107 | 1.46 | 0.14 | 0 | 0.5/6.0 | reject: plants a staff but never lifts it overhead |
| `q/q_study_text_s1_02.bvh` | q | study / text + opening stance only | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 107 | 1.02 | 0.067 | 0 | 0.5/6.0 | reject: plants a staff but never lifts it overhead |
| `q/q_study_textee_s1_00.bvh` | q | study / text + wrists/ankles/hips keys | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 107 | 4.48 | 0.541 | 0 | 3.2/12.4 | alt |
| `q/q_study_textee_s1_01.bvh` | q | study / text + wrists/ankles/hips keys | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 107 | 8.19 | 0.592 | 0 | 3.0/11.8 | - |
| `q/q_study_textee_s1_02.bvh` | q | study / text + wrists/ankles/hips keys | "A person lifts a long staff flat above their head and spins it ove..." | Kimodo v1.1 + text | 107 | 9.24 | 0.625 | 0 | 3.1/11.3 | - |
| `run/run_study_carry_s1_00.bvh` | run | study / root path + right-hand carry keys | (no text) | Kimodo v1.1 (no text) | 206 | 24.29 | 0.212 | 4 | 0.9/6.0 | - |
| `run/run_study_carry_s1_01.bvh` | run | study / root path + right-hand carry keys | (no text) | Kimodo v1.1 (no text) | 206 | 25.52 | 0.277 | 0 | 0.9/6.0 | - |
| `run/run_study_carry_s1_02.bvh` | run | study / root path + right-hand carry keys | (no text) | Kimodo v1.1 (no text) | 206 | 23.44 | 0.224 | 0 | 0.9/6.0 | alt (right hand carries) |
| `run/run_study_free_s1_00.bvh` | run | study / root path + opening stance | (no text) | Kimodo v1.1 (no text) | 206 | 6.68 | 0.219 | 0 | 0.5/6.0 | PICK (legs) |
| `run/run_study_free_s1_01.bvh` | run | study / root path + opening stance | (no text) | Kimodo v1.1 (no text) | 206 | 17.41 | 0.22 | 4 | 0.5/6.0 | reject: 4 pops |
| `run/run_study_free_s1_02.bvh` | run | study / root path + opening stance | (no text) | Kimodo v1.1 (no text) | 206 | 21.47 | 0.114 | 4 | 0.5/6.0 | reject: 4 pops |
| `run/run_study_text_s1_00.bvh` | run | study / text + opening stance only | "A person runs forward at a steady pace carrying a long polearm low..." | Kimodo v1.1 + text | 206 | 10.49 | 0.219 | 0 | 0.5/6.0 | alt |
| `run/run_study_text_s1_01.bvh` | run | study / text + opening stance only | "A person runs forward at a steady pace carrying a long polearm low..." | Kimodo v1.1 + text | 206 | 13.27 | 0.238 | 0 | 0.5/6.0 | - |
| `run/run_study_text_s1_02.bvh` | run | study / text + opening stance only | "A person runs forward at a steady pace carrying a long polearm low..." | Kimodo v1.1 + text | 206 | 36.5 | 0.143 | 0 | 0.5/6.0 | - |
| `run/run_study_textee_s1_00.bvh` | run | study / text + wrists/ankles/hips keys | "A person runs forward at a steady pace carrying a long polearm low..." | Kimodo v1.1 + text | 206 | 96.25 | 0.238 | 4 | 12.6/89.2 | - |
| `run/run_study_textee_s1_01.bvh` | run | study / text + wrists/ankles/hips keys | "A person runs forward at a steady pace carrying a long polearm low..." | Kimodo v1.1 + text | 206 | 99.99 | 0.257 | 4 | 13.2/90.7 | - |
| `run/run_study_textee_s1_02.bvh` | run | study / text + wrists/ankles/hips keys | "A person runs forward at a steady pace carrying a long polearm low..." | Kimodo v1.1 + text | 206 | 101.51 | 0.226 | 4 | 12.5/89.7 | - |
| `video/bigsweep_overhead_gemx.bvh` | video | GEM-X capture | `bigsweep_yeOMbxdKv6o` f0-120 (big overhead swings into a low lunge..." | GEM-X (SOMA) | 120 | 8.47 | 0.525 | 0 | - | PICK (trim first ~25 f) |
| `video/bigsweep_overhead_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `bigsweep_overhead_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 71 | 22.31 | 1.138 | 0 | 0.5/6.0 | - |
| `video/bigsweep_overhead_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `bigsweep_overhead_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 71 | 16.82 | 1.354 | 0 | 0.5/6.0 | - |
| `video/bigsweep_overhead_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `bigsweep_overhead_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 120 | 14.26 | 0.652 | 0 | 0.5/6.0 | - |
| `video/bigsweep_overhead_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `bigsweep_overhead_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 120 | 17.13 | 0.587 | 0 | 0.5/6.0 | - |
| `video/bigsweep_sweep_kneel_gemx.bvh` | video | GEM-X capture | `bigsweep_yeOMbxdKv6o` f255-345 (turning sweep, drops to one knee a..." | GEM-X (SOMA) | 90 | 18.03 | 0.463 | 7 | - | reject: capture never kneels (hips >= 90 cm) |
| `video/bigsweep_sweep_kneel_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `bigsweep_sweep_kneel_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 55 | 17.04 | 0.251 | 0 | 0.5/6.0 | reject: capture never kneels (hips >= 90 cm) |
| `video/bigsweep_sweep_kneel_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `bigsweep_sweep_kneel_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 55 | 14.89 | 0.266 | 0 | 0.5/6.0 | reject: capture never kneels (hips >= 90 cm) |
| `video/bigsweep_sweep_kneel_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `bigsweep_sweep_kneel_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 90 | 14.29 | 0.182 | 0 | 0.5/6.0 | reject: capture never kneels (hips >= 90 cm) |
| `video/bigsweep_sweep_kneel_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `bigsweep_sweep_kneel_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 90 | 16.73 | 0.148 | 0 | 0.5/6.0 | reject: capture never kneels (hips >= 90 cm) |
| `video/thrustmow_full_gemx.bvh` | video | GEM-X capture | `thrustmow_H9C2IemTkzM` f0-270 (retreat, thrust, low mow, recoil) | GEM-X (SOMA) | 270 | 15.54 | 0.625 | 15 | - | - |
| `video/thrustmow_full_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `thrustmow_full_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 164 | 32.94 | 0.733 | 0 | 0.5/6.0 | - |
| `video/thrustmow_full_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `thrustmow_full_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 164 | 30.37 | 0.538 | 0 | 0.5/6.0 | - |
| `video/thrustmow_full_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `thrustmow_full_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 270 | 15.42 | 0.324 | 0 | 0.5/6.0 | - |
| `video/thrustmow_full_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `thrustmow_full_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 270 | 28.01 | 0.268 | 0 | 0.5/6.0 | - |
| `video/thrustmow_thrust_mow_gemx.bvh` | video | GEM-X capture | `thrustmow_H9C2IemTkzM` f15-165 (thrust into the wide low mow) | GEM-X (SOMA) | 150 | 18.05 | 0.757 | 0 | - | ok (side view only; trim first ~15 f) |
| `video/thrustmow_thrust_mow_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `thrustmow_thrust_mow_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 90 | 43.02 | 1.398 | 0 | 0.5/6.0 | - |
| `video/thrustmow_thrust_mow_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `thrustmow_thrust_mow_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 90 | 43.23 | 1.202 | 0 | 0.5/6.0 | - |
| `video/thrustmow_thrust_mow_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `thrustmow_thrust_mow_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 150 | 21.91 | 0.786 | 12 | 0.5/6.0 | - |
| `video/thrustmow_thrust_mow_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `thrustmow_thrust_mow_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 150 | 33.13 | 0.521 | 0 | 0.5/6.0 | - |
| `video/whirlpool_twirl_plant_gemx.bvh` | video | GEM-X capture | `whirlpool_-iJ_d5z5m3o` f240-390 (upright pole twirls around the body) | GEM-X (SOMA) | 150 | 14.99 | 0.054 | 0 | - | reject: capture flips facing and straightens legs from f50 |
| `video/whirlpool_twirl_plant_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `whirlpool_twirl_plant_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 90 | 6.56 | 0.124 | 0 | 0.5/6.0 | reject: capture flips facing and straightens legs from f50 |
| `video/whirlpool_twirl_plant_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `whirlpool_twirl_plant_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 90 | 15.36 | 0.146 | 0 | 0.5/6.0 | reject: capture flips facing and straightens legs from f50 |
| `video/whirlpool_twirl_plant_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `whirlpool_twirl_plant_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 150 | 16.11 | 0.061 | 0 | 0.5/6.0 | reject: capture flips facing and straightens legs from f50 |
| `video/whirlpool_twirl_plant_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `whirlpool_twirl_plant_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 150 | 15.63 | 0.209 | 0 | 0.5/6.0 | reject: capture flips facing and straightens legs from f50 |
| `video/whirlpool_wheels_gemx.bvh` | video | GEM-X capture | `whirlpool_-iJ_d5z5m3o` f0-150 (vertical wheels at the side, lunges) | GEM-X (SOMA) | 150 | 17.54 | 0.715 | 0 | - | PICK (trim first ~17 f) |
| `video/whirlpool_wheels_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `whirlpool_wheels_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 92 | 33.91 | 1.285 | 0 | 0.5/6.0 | - |
| `video/whirlpool_wheels_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `whirlpool_wheels_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 92 | 18.17 | 1.652 | 11 | 0.5/6.0 | - |
| `video/whirlpool_wheels_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `whirlpool_wheels_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 150 | 18.83 | 0.643 | 0 | 0.5/6.0 | - |
| `video/whirlpool_wheels_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `whirlpool_wheels_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 150 | 28.81 | 0.713 | 0 | 0.5/6.0 | - |
| `video/windmill_kneelift_gemx.bvh` | video | GEM-X capture | `windmill_F2nStU9Wqck` f300-420 (windmills with knee-lift pivots at..." | GEM-X (SOMA) | 120 | 23.27 | 0.759 | 0 | - | PICK (capture matches video) |
| `video/windmill_kneelift_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `windmill_kneelift_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 72 | 27.73 | 2.314 | 0 | 0.5/6.0 | - |
| `video/windmill_kneelift_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `windmill_kneelift_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 72 | 32.2 | 2.077 | 0 | 0.5/6.0 | - |
| `video/windmill_kneelift_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `windmill_kneelift_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 120 | 15.83 | 1.031 | 0 | 0.5/6.0 | - |
| `video/windmill_kneelift_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `windmill_kneelift_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 120 | 16.4 | 1.239 | 0 | 0.5/6.0 | - |
| `video/windmill_overhead_gemx.bvh` | video | GEM-X capture | `windmill_F2nStU9Wqck` f30-150 (two-handed windmills overhead and b..." | GEM-X (SOMA) | 120 | 38.96 | 0.993 | 0 | - | PICK for upper body (feet slide 39 cm/s) |
| `video/windmill_overhead_kimodo_x0.6_s1_00.bvh` | video | video keys x0.6 | key poses picked from `windmill_overhead_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 72 | 66.76 | 2.88 | 0 | 0.5/6.0 | reject: foot slide 67-129 cm/s |
| `video/windmill_overhead_kimodo_x0.6_s1_01.bvh` | video | video keys x0.6 | key poses picked from `windmill_overhead_gemx`, gaps x0.6 | Kimodo v1.1 (no text) | 72 | 129.28 | 2.865 | 2 | 0.5/6.0 | reject: foot slide 67-129 cm/s |
| `video/windmill_overhead_kimodo_x1.0_s1_00.bvh` | video | video keys x1.0 | key poses picked from `windmill_overhead_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 120 | 26.02 | 1.052 | 0 | 0.5/6.0 | - |
| `video/windmill_overhead_kimodo_x1.0_s1_01.bvh` | video | video keys x1.0 | key poses picked from `windmill_overhead_gemx`, gaps x1.0 | Kimodo v1.1 (no text) | 120 | 18.97 | 1.179 | 0 | 0.5/6.0 | - |
