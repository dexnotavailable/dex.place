# Motion AI setup: Kimodo (generate) + GEM-X (video capture)

Installed and proven on this PC, 2026-09-28/29. Companions: `MODELS.md` (why these models),
`VIDEO-TO-MOTION.md` (which clips to feed GEM-X), `THIRD_PARTY.md` (every download and its
licence).

Tags: **[M]** measured here, **[S]** from the maker's docs/code, **[I]** my inference.

## The short answer

- **Generation: NVIDIA Kimodo (SOMA v1.1)** runs natively on Windows. You give it key poses,
  hand/foot targets and a floor path; it fills in believable whole-body motion and writes a
  BVH. Measured: three 5-second variations in 5.6 s using 1.2 GB of GPU memory when the GPU
  is free [M]. It hits the key poses we give it within 1 to 4 cm and follows a 5.5 m floor path
  within 1.6 cm on average [M].
- **Text prompts work (2026-09-29).** `kimodo_gen.py --text "..."` loads Kimodo's text encoder
  (LLM2Vec on Llama 3 8B Instruct) from a 16 GB cache on D:. By default the encoder runs on
  the CPU: 16 s to load, then about a second per prompt, and no extra GPU memory [M]. The
  weights came from NousResearch's ungated copy, which is byte-identical to Meta's gated repo
  (every file's hash matches) [M]; Dex accepted Meta's Llama 3 licence for this. A glaive
  prompt and a walk prompt from the same seed give clearly different motion (section "Text
  prompts"). Without `--text`, the old no-text mode (poses and paths only) is unchanged.
- **Video to motion: NVIDIA GEM-X** also runs natively on Windows (NVIDIA lists Linux only). A
  test clip went in and came out as a BVH on the same skeleton Kimodo uses, so captured poses
  can go straight back into Kimodo as keyframes. Measured: 96 frames in 34 s, 7.7 GB peak
  GPU memory [M]. Every held pose came out on the correct side of the body [M, viewed].
- **Only one generator is installed**, on purpose. The runner-up, HY-Motion, needs about 20 GB
  more disk (over the 30 GB budget), 24–26 GB of GPU memory, and its licence forbids showing
  its output in the EU and UK (details in `MODELS.md`). Everything older is trained on
  non-commercial data.
- **Disk used:** about 19 GB on D: for the base install, plus 16.4 GB for the text encoder
  (Dex OK'd going past the 30 GB budget for it). Nothing needed an account, sign-in or token.

## What's where

| Thing | Path | Size [M] |
|---|---|---|
| Kimodo source (commit `58e78189`) | `D:\Dex\Tools\src\kimodo` | 301 MB |
| Kimodo venv (Python 3.10.20) | `D:\Dex\Tools\venvs\kimodo` | 4.5 GB |
| Kimodo weights `Kimodo-SOMA-RP-v1.1` (HF `6c9233af`) | `D:\Dex\Models\kimodo\Kimodo-SOMA-RP-v1.1` | 1.1 GB |
| GEM-X source (commit `32992550`) + SOMA-X / sam-3d-body submodules | `D:\Dex\Tools\src\GEM-X` | 207 MB + 124 MB LFS |
| GEM-X venv (Python 3.12.14) | `D:\Dex\Tools\venvs\gemx` | 5.7 GB |
| GEM-X + SAM 3D Body + SOMA weights (HF `5ccf5ca3` / `104578ed`) | `D:\Dex\Models\gem-x\inputs` (junctioned as `GEM-X\inputs`) | 6.4 GB |
| Kimodo text encoder: Llama 3 8B Instruct (filed as `meta-llama/Meta-Llama-3-8B-Instruct` @ `8afb486c`) + McGill LLM2Vec adapters `mntp` @ `31474e39`, `mntp-supervised` @ `baa8ebf0` | `D:\Dex\Models\hf\hub` (Hugging Face cache layout) | 16.07 GB + 0.18 + 0.17 GB |
| Download provenance: HF API metadata, hash check script and its log | `D:\Dex\Models\hf\provenance` | <1 MB |
| YOLOX person detector (auto-download) | `D:\Dex\Models\torch\hub\checkpoints` | 378 MB |
| Warp kernel cache | `D:\Dex\Caches\warp` | 2 MB |
| Our wrappers | `tools/motion-ai/*.py` (this folder) | – |
| Test outputs, test video | `review/motion/_runs/`, `review/motion/_samples/` (git-ignored) | ~15 MB |

D: free space went from 66 GB to 46 GB over the session [M]. The pieces above add up to about
19 GB; the rest is probably the concurrent Rosace workflow [I]. The two venvs don't share
PyTorch files (different Python versions, so different wheels); each is hardlinked to its own
copy in the uv cache, so the cache adds no second copy [M, `fsutil hardlink list`].

## The wrappers

All outputs are BVH on one documented skeleton (next section) plus an NPZ and a JSON run report.

| Script | Venv | Does |
|---|---|---|
| `kimodo_gen.py` | kimodo | Text prompt and/or constraints JSON (key poses, hand/foot targets, root path) → `<stem>.bvh` + `.npz` + `.json` |
| `text_encoder_check.py` | kimodo | Loads the text encoder the way `kimodo_gen.py` does and reproduces the McGill model card's example numbers; rerun after any package upgrade |
| `gemx_capture.py` | gemx | Video → `motion.bvh`, `motion_soma.npz`, `0_kp2d77_overlay.mp4` (check this first for limb swaps), `hpe_results.pt`, `report.json` |
| `soma_to_bvh.py` | kimodo | SOMA NPZ (77 local rotation matrices + hips path) → BVH with Kimodo's writer; called by `gemx_capture.py` |
| `bvh_tools.py` | either | `info` (frames, fps, hips path, floor contact) and `sheet` (side + front stick-figure contact sheet PNG) for any BVH |
| `blender_bvh_check.py` | Blender 5.1.2 via `tools/pixel-pipeline/blender_env.py` | Imports BVHs headless in the isolated env and reports bones, keyed frames, hips path |

```sh
# generate (no text): 5 s from NVIDIA's two-keyframe example
D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/kimodo_gen.py \
  --constraints D:/Dex/Tools/src/kimodo/kimodo/assets/demo/examples/kimodo-soma-rp/03_full_body_keyframes/constraints.json \
  --duration 5 --seed 43 --out review/motion/_runs/kimodo_smoke_notext
#   --samples N (variations), --steps (default 100), --cfg TEXT CONSTRAINT (default 2 2),
#   --heading RAD, --tpose-rest (BVH rest = T-pose), --device cpu, --no-postprocess

# generate from text (encoder on CPU by default; add --constraints to combine with key poses)
D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/kimodo_gen.py \
  --text "a woman walks calmly forward" --duration 5 --seed 11 --samples 3 --out review/motion/_runs/walk
#   --text-device cpu (default) | cuda | auto,  --text-encoder url (remote kimodo_textencoder server)

# capture from video (fixed camera)
D:/Dex/Tools/venvs/gemx/Scripts/python.exe tools/motion-ai/gemx_capture.py \
  --video review/motion/_samples/muybridge_clubs_30fps.mp4 --out review/motion/_runs/gemx_smoke

# look at any result
D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/bvh_tools.py sheet \
  review/motion/_runs/gemx_smoke/motion.bvh review/motion/_runs/gemx_smoke/bvh_sheet.png --every 6
python tools/pixel-pipeline/blender_env.py run --factory-startup \
  --python tools/motion-ai/blender_bvh_check.py -- review/motion/_runs/gemx_smoke/motion.bvh
```

Constraint JSON format: Kimodo's `docs/source/user_guide/constraints.md` in the source tree.
Y-up, metres, frame 0 at the floor origin, frame indices 0-based and below the frame count
(`kimodo_gen.py` checks this; past the end, the GPU fails with an unhelpful "device-side
assert" [M]). A key pose is `local_joints_rot` per joint (axis-angle) + `root_positions`, so
poses blocked in Blender or captured by GEM-X can be written straight into it [S, I].

## The skeleton (both models, every BVH we write)

- **Layout:** SOMA 77 joints, written under a `Root` wrapper at the origin, so the BVH has 78
  bones [M]. Joint order and names are Kimodo's `SOMASkeleton77` [S]; GEM-X uses the same
  77-joint SOMA layer, and Kimodo feeds exactly these matrices into SOMA for its own mesh
  preview (`kimodo/viz/soma_layer_skin.py`) [S]. A Kimodo NPZ → BVH round trip through
  `soma_to_bvh.py` matches Kimodo's own BVH within 0.03 cm [M].
- **Units and axes:** centimetres, Y-up, character faces +Z at heading 0, 30 fps [M]. `Root`
  and `Hips` carry 6 channels (position, then Z Y X rotation); every other joint has 3
  (Z Y X). The Hips position channel is absolute, not added to its OFFSET (Blender reads it
  the same way) [M].
- **Rest pose:** by default the BVH rest is the BONES-SEED rest pose Kimodo's data uses: local
  axes are not world-aligned, so `Spine1`'s offset points along X [M]. `--tpose-rest` writes a
  standard T-pose rest with world-aligned offsets instead, which is easier to retarget [S].
- **Bone lengths:** always Kimodo's neutral SOMA body (hips 1.005 m above its lowest joint,
  1.76 m from lowest joint to head tip in the neutral pose) [M]. For GEM-X, `soma_to_bvh.py` scales the hips path by
  `1.005 / filmed hip height` so the feet reach the floor. Test clip: feet sank 10 cm before
  the fix and sit 2–9 cm above the floor after it [M].
- **Blender:** `bpy.ops.import_anim.bvh(global_scale=0.01, rotate_mode="NATIVE",
  axis_forward="-Z", axis_up="Y")` gives 78 bones, 30 fps, full keyed range, hips path in
  metres, facing −Y [M].

Hierarchy (`child<parent`); left/right mirror each other:

```
Hips<- ; Spine1<Hips ; Spine2<Spine1 ; Chest<Spine2 ; Neck1<Chest ; Neck2<Neck1 ; Head<Neck2 ;
HeadEnd, Jaw, LeftEye, RightEye < Head
LeftShoulder<Chest ; LeftArm<LeftShoulder ; LeftForeArm<LeftArm ; LeftHand<LeftForeArm ;
  LeftHandThumb1..3, LeftHandThumbEnd                       (chain under LeftHand)
  LeftHandIndex1..4, LeftHandMiddle1..4, LeftHandRing1..4, LeftHandPinky1..4, each + ...End
RightShoulder<Chest ; ... same as left ...
LeftLeg<Hips ; LeftShin<LeftLeg ; LeftFoot<LeftShin ; LeftToeBase<LeftFoot ; LeftToeEnd<LeftToeBase
RightLeg<Hips ; ... same as left ...
```

The numbered list is in `kimodo_gen.py`'s JSON report (`joint_names`).

Which joints actually move [M, rotation change > 0.5° across each test clip]:

| | Joints animated | Notes |
|---|---|---|
| Kimodo | 27 | Its 30-joint model skeleton minus Jaw and both eyes. Fingers sit in a fixed relaxed pose. The 30: Hips, Spine1–2, Chest, Neck1–2, Head, Jaw, eyes, Shoulder/Arm/ForeArm/Hand ×2, ThumbEnd + MiddleEnd ×2 (they aim the hand), Leg/Shin/Foot/ToeBase ×2. |
| GEM-X | 64 | Everything except HeadEnd, the finger End tips and ToeEnds. Its finger joints do move, but the released config drops finger keypoints from the input (issue #20), so treat finger motion as unreliable [I, not checked against video]. |

For Rosace: the glaive is not in either model. Animate it as a prop, parented to the right
hand, with the off hand pinned to the haft by IK (plan in `MODELS.md`) [I].

## Measured performance (RTX 4090 24 GB, driver 591.86, torch 2.10.0+cu126)

The GPU is shared with dexClient's local LLM (`llama-server.exe`, a 27B Qwen, ~22 GB and
~98% load while busy) [M]. Kimodo speed depends heavily on whether that server is working.

| Run | GPU state | Time | Peak torch VRAM |
|---|---|---|---|
| Kimodo, 150 frames, 1 sample, 100 steps | shared, LLM busy | 121 s (1.2 s/step) | 1,163 MiB |
| Kimodo, same (first run of the session) | shared, LLM busy | stalled ~15 min inside the denoising loop (py-spy), killed; cause not isolated | – |
| Kimodo, 150 frames, 5 steps | LLM loaded, its load at that moment unknown | 1.2 s (6.2 steps/s) | 1,163 MiB |
| Kimodo, 150 frames, 10 steps, **CPU** | – | 5.2 s (1.9 steps/s ≈ 52 s per clip) | – |
| Kimodo, 152 frames × **3 samples**, 100 steps | LLM idle | **5.6 s** (+1.1 s load) | 1,229 MiB |
| GEM-X, 96 frames: detect + 2D keypoints + SAM 3D Body | LLM idle | 28.6 s | – |
| GEM-X, prediction + SOMA conversion | LLM idle | 5.4 s | **7,747 MiB** peak for the whole run |

Rule of thumb [I]: if the LLM server is busy, run Kimodo with `--device cpu` (about 1 min a clip)
rather than fight it for the GPU. GEM-X needs ~8 GB of VRAM, so it needs the LLM server idle
or unloaded. Stopping that server is Dex's call; I didn't touch it.

## Proof it works [M]

- **Kimodo, no text, NVIDIA's two-keyframe example** (`03_full_body_keyframes`, seed 43):
  the contact sheet shows a coherent walk, a deep crouch-and-reach at keyframe 79, standing
  up, then walking on. Mean joint distance to NVIDIA's own reference output at the two
  pinned frames: 1.6 cm and 3.6 cm; between keyframes the no-text motion drifts from theirs
  by up to 12 cm, as expected when the text is dropped. BVH: 150 frames, hips start 1.005 m up,
  travel 3.47 m forward.
- **Kimodo, keyframe + 5.55 m floor path** (`07_mixed_constraints`, 3 samples): path error
  1.5–1.6 cm mean, ≤4.1 cm max; keyframe hips within 0.9–1.9 cm.
- **Kimodo foot cleanup** (`motion_correction`, built with MSVC 14.44 + Ninja): same seed with
  and without it, planted-foot sliding 4.4 → 3.8 cm/s mean, 95th percentile unchanged
  (11.9 → 12.4 cm/s), lowest joint −2.4 → −2.7 cm. A small effect; on by default because it's
  Kimodo's default.
- **GEM-X on Muybridge "Athlete swinging clubs"** (public domain, 8 frames at 5 fps, looped to
  96 frames at 30 fps): 2D keypoints on the body in all frames; 3D poses match each photo
  (right club up at frame 24, left at 42, both hands at the head at 12) with left/right
  correct. When the loop jumps from the last pose back to the first (frame 48), GEM-X lags
  into the new pose: it smooths sudden changes over time. That matters for snappy attacks
  [I]: feed it real 30–60 fps footage, not held frames.
- **Blender 5.1.2** (isolated env, headless): both BVHs import with 78 bones at 30 fps; keyed
  frames 1–150 and 1–96; hips paths match the source.

Pictures: `review/motion/_runs/kimodo_smoke_notext_sheet.png`,
`review/motion/_runs/gemx_smoke/{kp2d_tiles.png,bvh_sheet.png,0_kp2d77_overlay.mp4}`.

## Text prompts (added 2026-09-29)

**How it's wired.** Kimodo encodes a prompt with LLM2Vec: Llama 3 8B Instruct plus two small
McGill-NLP LoRA adapters (`mntp`, then `mntp-supervised`). The adapters name
`meta-llama/Meta-Llama-3-8B-Instruct` as their base model, and LLM2Vec only wraps the prompt in
Llama 3's chat template when the base model carries exactly that id [S, `llm2vec.py`]. Loading
the weights from a plain folder would change the id and silently drop the template. So the
NousResearch files are filed in a normal Hugging Face cache under Meta's id and revision:

```
D:\Dex\Models\hf\hub\models--meta-llama--Meta-Llama-3-8B-Instruct\
    refs\main                       -> 8afb486c1db24fe5011ec46dfbe5b5dccdb575c2 (Meta's current main)
    snapshots\8afb486c...\          config, generation_config, tokenizer*, special_tokens_map,
                                    model.safetensors.index.json, model-0000{1..4}-of-00004.safetensors,
                                    LICENSE, USE_POLICY.md, .gitattributes  (no README, no original/*.pth)
D:\Dex\Models\hf\hub\models--McGill-NLP--LLM2Vec-Meta-Llama-3-8B-Instruct-mntp\             (all files)
D:\Dex\Models\hf\hub\models--McGill-NLP--LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised\  (all files)
```

Snapshot folders hold real files and `blobs\` is empty; that's how `huggingface_hub` lays out a
cache on Windows without symlink rights, and it resolves them the same way [M].

**Environment, per run only.** `kimodo_gen.py` (and `text_encoder_check.py`) set these inside
their own process before anything imports Hugging Face; nothing machine-wide changes:
`HF_HOME=D:\Dex\Models\hf`, `HF_HUB_CACHE=...\hub`, `HUGGINGFACE_CACHE_DIR=...\hub` (Kimodo passes
it as `cache_dir`), `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `HF_HUB_DISABLE_IMPLICIT_TOKEN=1`,
telemetry off, the machine's `TRANSFORMERS_CACHE` removed, `TEXT_ENCODER_MODE=local`,
`TEXT_ENCODER_DEVICE` from `--text-device`. `DEXPLACE_HF_HOME` overrides the cache root.
(The machine-wide `HF_HOME` is `D:\Dex\AI\HuggingFace`; it's left alone.)

**Where the encoder runs.** Default `--text-device cpu`: load 15–16 s, encode about 1 s per
prompt, peak GPU use unchanged at 1.2 GB [M]. The bf16 weights take ~15 GiB of RAM while loaded
(the PC has 63 GB; 30 GB was free when checked) [M/S]. `cuda` works too but holds 15.6 GB of
VRAM [M]; the one GPU-encoder run happened while the LLM server was loaded and took 3.5 min
instead of 30 s. `auto` picks cuda only if ≥ 20 GiB is free at start, and the LLM server can
reclaim memory mid-run, so CPU is the safe default.

**Encoder check [M].** `text_encoder_check.py` reproduces the retrieval example on the
`mntp-supervised` model card: cosine matrix `[[0.6463, 0.1623], [0.0782, 0.5837]]` against the
published `[[0.6470, 0.1619], [0.0786, 0.5844]]` (max difference 0.0007), with 224 LoRA modules
active and the Llama 3 template applied. transformers 5.1 prints a "LOAD REPORT" listing LoRA keys as
MISSING/UNEXPECTED plus a PEFT "multiple adapters" warning: that's transformers' own adapter
auto-load failing on a key prefix before LLM2Vec loads the adapters properly. The matching
numbers show it's harmless. If a package upgrade changes that, the check fails.

**Proof: the prompt changes the motion [M].** Same seed (11), 5 s (150 frames), no constraints,
3 samples per prompt, 100 steps, encoder on CPU. Outputs, stats and sheets:
`review/motion/text-encoder/` (`a_notext_*`, `b_glaive_*`, `c_walk_*`, `stats.json`,
`compare_seed11_s0{0,1,2}.png`, `compare_stats.py`). Means over the 3 samples:

| | (a) no text | (b) "a woman swings a long glaive in a wide horizontal arc, then spins and plants it" | (c) "a woman walks calmly forward" |
|---|---|---|---|
| Hips travel, start to end | 1.76 m (0.02–4.2) | **0.06 m** (stays put) | **6.65 m** (5.7–7.5, ≈1.3 m/s) |
| Foot swaps (≈ steps) | 3 | 4 (0–10) | **10** (9–11) |
| Hand speed relative to hips, 95th pct (L / R) | 1.2 / 0.6 m/s | **4.4 / 4.8 m/s** | 1.0 / 1.1 m/s |
| Hand sweep around the body (L / R) | 54° / 41° | **300° / 216°** | 69° / 73° |
| Max hand reach from the hips, horizontal | 0.43 m | **0.79 m** (arms out) | 0.38 m |
| Hips turn: range / peak speed | 14° / 41°/s | **110° / 379°/s** | 21° / 76°/s |

What the sheets show (`compare_seed11_s00.png`, viewed): (a) stands, then takes one step and
settles; (b) a wide, low fighting stance, arms thrown overhead and swept out horizontally
through frames 40–90 with the torso twisting, then back to a guard with the arm forward;
(c) a steady upright walk with alternating steps and relaxed arms. What (b) doesn't do: a full
spin. The hips turn at most 80–156° (fast, up to 423°/s), so "spins" comes out as a sharp
twist, and there's no distinct plant beat. The walk's foot-slide number (21 cm/s mean) is
high, but so is the one no-text sample that walks (22 cm/s). That looks like `motion_qc.py`
counting rolling feet during a walk as planted, not the text encoder [I].

A no-text keypose run (`03_full_body_keyframes`, 10 steps) was re-run after the wrapper change
and still works (`review/motion/text-encoder/smoke_notext_keypose.*`).

**Reinstalling the encoder** (Git Bash; no token needed, every repo is ungated):

```sh
export HF_HOME='D:\Dex\Models\hf' HF_HUB_CACHE='D:\Dex\Models\hf\hub' HF_HUB_DISABLE_IMPLICIT_TOKEN=1
unset HF_TOKEN TRANSFORMERS_CACHE; HF=D:/Dex/Tools/venvs/kimodo/Scripts/hf.exe
$HF download McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp --revision 31474e395ada192e8ed1586db6be79fb3b70c9c0
$HF download McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised --revision baa8ebf04a1c2500e61288e7dad65e8ae42601a7
#   (then write each repo's refs/main with that hash: a download by hash doesn't create it)
$HF download NousResearch/Meta-Llama-3-8B-Instruct config.json generation_config.json \
    model.safetensors.index.json special_tokens_map.json tokenizer.json tokenizer_config.json \
    LICENSE USE_POLICY.md .gitattributes model-0000{1,2,3,4}-of-00004.safetensors \
    --revision 53346005fb0ef11d3b6a83b12c895cca40156b6c --local-dir 'D:\Dex\Models\hf\_staging\nous-llama3-8b-instruct'
# hash every file against Meta's official metadata, move into the cache under Meta's id, write refs/main, recheck all:
D:/Dex/Tools/venvs/kimodo/Scripts/python.exe D:/Dex/Models/hf/provenance/install_llama3_cache.py install
D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/text_encoder_check.py
```

The download took about 4 minutes. `provenance/install-verify-2026-09-29.txt` has every hash.

## Exact install commands (reproduce from scratch)

Git Bash. uv 0.12.13. Python interpreters already existed under `D:\Dex\AI\Runtimes\_uv-python`.
Machine env already routes `UV_CACHE_DIR=D:\Dex\Caches\uv`, `PIP_CACHE_DIR=D:\Dex\Caches\pip`.

```sh
export UV_LINK_MODE=hardlink UV_CACHE_DIR='D:\Dex\Caches\uv'
PY310='D:\Dex\AI\Runtimes\_uv-python\cpython-3.10.20-windows-x86_64-none\python.exe'
PY312='D:\Dex\AI\Runtimes\_uv-python\cpython-3.12.14-windows-x86_64-none\python.exe'
HF=D:/Dex/Tools/venvs/kimodo/Scripts/hf.exe

# --- sources (LFS skipped; pulled selectively below)
mkdir -p D:/Dex/Tools/src && cd D:/Dex/Tools/src
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/nv-tlabs/kimodo.git        # 58e78189
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/NVlabs/GEM-X.git           # 32992550
cd GEM-X && GIT_LFS_SKIP_SMUDGE=1 git submodule update --init --depth 1 third_party/soma third_party/sam-3d-body

# --- Kimodo venv
cd D:/Dex/Tools/venvs && uv venv kimodo --python "$PY310"
uv pip install --python kimodo/Scripts/python.exe torch==2.10.0 --index-url https://download.pytorch.org/whl/cu126
SKIP_MOTION_CORRECTION_IN_SETUP=1 uv pip install --python kimodo/Scripts/python.exe -e D:/Dex/Tools/src/kimodo
# optional foot cleanup: needs the MSVC environment (cmd), and a clean MotionCorrection/build
#   call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
#   set CMAKE_GENERATOR=Ninja
#   uv pip install --python D:\Dex\Tools\venvs\kimodo\Scripts\python.exe D:\Dex\Tools\src\kimodo\MotionCorrection
$HF download nvidia/Kimodo-SOMA-RP-v1.1 --revision 6c9233af1180b8151e3c4703477104af5dce9dd5 \
    --local-dir D:/Dex/Models/kimodo/Kimodo-SOMA-RP-v1.1

# --- GEM-X venv
uv venv gemx --python "$PY312"
uv pip install --python gemx/Scripts/python.exe torch==2.10.0 torchvision==0.25.0 --index-url https://download.pytorch.org/whl/cu126
cd D:/Dex/Tools/src/GEM-X
uv pip install --python D:/Dex/Tools/venvs/gemx/Scripts/python.exe -e third_party/soma -e .
uv pip install --python D:/Dex/Tools/venvs/gemx/Scripts/python.exe cloudpickle fvcore iopath pycocotools \
    braceexpand roma 'setuptools<75' 'onnxruntime-gpu==1.23.2'
# (no detectron2: the demo path uses the bundled YOLOX ONNX detector)

# --- GEM-X weights into the layout its code expects (relative inputs/ paths)
R=5ccf5ca3746c3620aa4016114f069a5f6ae399cd; I=D:/Dex/Models/gem-x/inputs
$HF download nvidia/GEM-X gem_soma.ckpt config.json LICENSE README.md --revision $R --local-dir $I/pretrained
$HF download nvidia/GEM-X vitpose.pth --revision $R --local-dir $I/checkpoints/vitpose
$HF download nvidia/GEM-X sam3d_body.ckpt model_config.yaml --revision $R --local-dir $I/checkpoints/sam-3d-body-dinov3
$HF download nvidia/GEM-X mhr_model.pt --revision $R --local-dir $I/mhr_data
$HF download nvidia/GEM-X scale_mean.pth scale_comps.pth --revision $R --local-dir $I/soma_data
# SOMA body assets: meshes from HF, but SOMA_neutral.npz + correctives_model.pt from the
# submodule's pinned LFS (HF-latest versions crash the pinned code), MHR lod1 hardlinked.
# Pass files by name: `hf download ... --include a b --exclude c` mis-parses extra patterns.
# (These two SOMA-X lines are the cleaned-up recipe, checked with --dry-run; the session itself
#  got there in several steps, logged in THIRD_PARTY.md.)
S=104578ed58857f6faa7592fb83d0a2dad43c36fa
$HF download nvidia/SOMA-X --revision $S --local-dir $I/soma_assets --include "*.obj"
$HF download nvidia/SOMA-X MHR/mhr_model_lod6.pt SOMAHand.npz SOMA_procedural_transforms.json LICENSE --revision $S --local-dir $I/soma_assets
cd third_party/soma && git lfs pull --include="assets/SOMA_neutral.npz,assets/correctives_model.pt" && cd ../..
cmd //c "mklink /H D:\Dex\Models\gem-x\inputs\soma_assets\SOMA_neutral.npz D:\Dex\Tools\src\GEM-X\third_party\soma\assets\SOMA_neutral.npz"
cmd //c "mklink /H D:\Dex\Models\gem-x\inputs\soma_assets\correctives_model.pt D:\Dex\Tools\src\GEM-X\third_party\soma\assets\correctives_model.pt"
cmd //c "mklink /H D:\Dex\Models\gem-x\inputs\soma_assets\MHR\mhr_model_lod1.pt D:\Dex\Models\gem-x\inputs\mhr_data\mhr_model.pt"
cmd //c "mklink /J D:\Dex\Tools\src\GEM-X\inputs D:\Dex\Models\gem-x\inputs"
# YOLOX (378 MB) downloads itself on the first gemx_capture.py run into D:\Dex\Models\torch.
```

Full package lists: `venv-kimodo.lock.txt`, `venv-gemx.lock.txt`. Key versions: torch
2.10.0+cu126 in both; Kimodo venv transformers 5.1.0, numpy 2.2.6, bvhio 1.5.4; GEM-X venv
numpy 2.5.2, opencv-python 5.0.0.93, onnxruntime-gpu 1.23.2, open3d 0.20.0, warp-lang 1.17.0,
transformers 5.17.0, lightning 2.6.6.

## Windows fixes found along the way [M]

1. **onnxruntime-gpu 1.30 is built for CUDA 13**, so its CUDA provider fails to load next to
   torch cu126 (`cublasLt64_13.dll` missing) and YOLOX silently falls back to CPU. Pin 1.23.2
   (CUDA 12); it reuses torch's bundled CUDA 12 / cuDNN 9 DLLs if torch is imported first.
2. **SOMA-X asset drift:** HF-latest `SOMA_neutral.npz` and `correctives_model.pt` differ from
   the versions GEM-X's pinned SOMA code expects (`KeyError: 'joint_parent_ids'`). Use the
   submodule's LFS copies.
3. **GEM-X's mesh renders need Linux EGL** (Open3D offscreen). `gemx_capture.py` skips them and
   writes the 2D keypoint overlay (OpenCV only) plus our stick-figure sheet instead.
4. **GEM-X's own BVH export** needs the SSH-only `soma-retargeter` submodule and has a
   rest-pose bug (issue #17). We export through Kimodo's writer instead (`soma_to_bvh.py`).
5. **Cache locations:** Warp's kernel cache defaults to `%LOCALAPPDATA%` on C: and YOLOX to
   the machine-wide `TORCH_HOME` (`D:\Dex\AI\Torch`). The wrapper pins them to
   `D:\Dex\Caches\warp` and `D:\Dex\Models\torch`. The 1.7 MB of C: cache from the first run
   was deleted.
6. **MotionCorrection** needs `vcvars64.bat` + Ninja; plain `pip install` finds CMake's VS
   generator but no compiler. A failed attempt leaves a stale `MotionCorrection/build` cache;
   delete it before retrying.
7. One GEM-X run out of four died silently right after YOLOX loaded on CUDA (no traceback).
   It didn't recur on three reruns or in isolation. Unexplained; rerun if it happens.

## Dex-needed

1. **Kimodo text prompts: decided and done (2026-09-29).** Dex chose the ungated NousResearch
   copy (route b) and accepted Meta's Llama 3 licence and use policy; see "Text prompts" and
   `THIRD_PARTY.md`. The pending Meta access request on Hugging Face no longer matters; nothing
   needs a token.
2. **The GPU is shared with dexClient's LLM server.** GEM-X needs ~8 GB free, so either
   schedule capture runs when it's idle, or Dex decides whether to unload it during animation
   sessions. I left it running.
3. **Reference footage** (from `VIDEO-TO-MOTION.md`): the only video used so far is the public-domain
   Muybridge GIF. Real attack clips, or Dex filming the moves with a broom, are the next input.

## Not verified yet

- Text prompts on our actual moves, and text combined with key-pose constraints (the code
  path is the same; only prompt-only clips were tested). Full spins didn't come out of the
  glaive prompt (hips turn at most 156°).
- Retargeting the SOMA BVH onto Seed-san or the Rosace rig (the `--tpose-rest` BVH is the
  intended input; the pixel-pipeline's Retarget extension has no SOMA preset yet [I]).
- GEM-X on real fast footage: done for four Motion Actor clips (2026-09-29, `CATALOGUE.md`). Four of
  eight segments track well; one loses the performer's facing and bent legs, one misses a kneel, and
  the first 15-25 frames are junk wherever the performer walks into shot. Spins and the N4 vault
  are still untested, as are anime/game proportions.
- Whether GEM-X's finger rotations follow the video.
- Kimodo on our actual moves: done for N1, N3, N5, Q, dash, dash attack, idle and run (2026-09-29,
  `CATALOGUE.md`, picks per move). Key poses plus text steer it well; text alone doesn't produce
  the moves. N2, N4 and R are not generated yet.
