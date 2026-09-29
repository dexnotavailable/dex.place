# AI motion models for Rosace

Which AI motion generators we can run on this PC to rough in Rosace's body motion, which one
Dex most likely means by "that one animator from nvidia", and a ranked top 3. Research date:
2026-09-28. **Nothing has been downloaded yet.** Every size below was read today from the
Hugging Face API or a repo file listing.

Companions: `docs/character/MOVESET.md` (the frame tables we retime to),
`docs/character/MOTION-SOURCES.md` (mocap clips and licence risk levels; same tags as here),
`THIRD_PARTY.md` in this folder (download log).

Tags:

- **[M]** measured: checked on this PC today, or read directly off an API / file listing / licence file.
- **[S]** sourced: the maker's own page, paper, model card or licence (named). "[S, secondary]"
  means read through a search summary or a third party, not the primary page.
- **[I]** inference: our reading or proposal. Treat as a claim to test.

## The short answer

1. **Dex's "animator from NVIDIA" is almost certainly Kimodo** (NVIDIA Research, released
   2026-03-16, v1.1 on 2026-04-10). You describe the motion in words, pin poses at chosen
   frames, pin hands or feet, draw a path on the floor, and it fills in the whole-body motion.
   It comes with a local timeline editor. [S] That this is the one Dex saw is [I]: the other
   2026 NVIDIA motion releases are real-time robot/game controllers (ARDY, MotionBricks) or
   video motion capture (GEM-X), and none of them is pitched as an animation tool.
2. **It runs on this PC.** NVIDIA tested it on the RTX 4090. It needs about 17 GB of video
   memory with everything on the GPU, or under 3 GB with the text encoder on the CPU, and takes
   2 to 5 seconds per clip. [S] **One snag:** its text encoder is Meta's Llama 3 8B, and Meta's
   copy on Hugging Face is gated with manual approval [M]. That's a Dex step; two ways around it
   are in "What Dex needs to do".
3. **Ranking for us:**
   1. **Kimodo** (NVIDIA): text + full-body key poses + hand/foot targets + floor path. Trained
      on 700 hours of studio mocap that includes about 50,000 sword and martial-arts clips.
      Weights allow commercial use. **The pick.**
   2. **GEM-X** (NVIDIA): the "feed it a reference video" half. It turns an ordinary video of
      one person into 3D motion on the same SOMA body skeleton Kimodo uses, so poses lifted from
      a reference clip can go straight into Kimodo as keyframes. Commercial-use weights, no
      sign-in. It is motion *capture* from video, not a generator.
   3. **HY-Motion 1.0** (Tencent): the strongest text-only model with public weights; officially
      supports Windows; no sign-in. No keyframes, too big for 24 GB without offloading, and its
      licence forbids showing its output outside its territory, which a public website does.
      **Private second opinion and timing study only.**
4. **What the AI gives us, and what stays ours.** It gives believable body mechanics: weight
   shifts, foot plants, hips leading a spin, arms trailing. It won't give anime timing. All of
   these learned from real mocap, so expect realistic timing and restrained poses [I]. That's the
   part Dex wants to own anyway: we sample the AI motion at the drawing frames MOVESET calls
   for, then set holds, snap, overshoot and rebound, and push the poses. None of these models
   knows about a glaive, and Kimodo and HY-Motion have no fingers [S]. The glaive is a prop we
   animate; both hands stay on it through hand targets and IK [I].
5. **Dex-needed:** pick a Llama 3 route for Kimodo (sign up and request access, or OK a
   licence-permitted ungated copy); decide whether HY-Motion is allowed at all; optionally film
   himself doing the moves with a broom for GEM-X. No SMPL/SMPL-X registration, no Adobe, and no
   gated dataset is needed for the recommended route.

## How it fits the pipeline [I]

1. **References in.** Per phase of each move: a plain text description ("low scooping upward
   cut with a two-handed polearm; weight rocks back, then lunges forward"), key poses blocked
   on a stand-in body in Blender, and optionally a reference video.
2. **Video to motion (GEM-X).** Reference clip in, SOMA 3D motion out. We keep only the frames
   that match MOVESET key drawings (coil, contact, follow-through).
3. **Generate (Kimodo).** Text + those key poses as full-body keyframes + both wrists pinned to
   the haft line at key frames + a root path for the lunge or pivot. Out: 30 fps motion as BVH.
4. **Blender, headless, in an isolated user env** (same pattern as
   `tools/pixel-pipeline/blender_env.py`, never Dex's prefs, never the Blender MCP). Import the
   BVH, retarget SOMA to the VRM humanoid (Seed-san for tests; the Rosace rig read-only once it
   exists), glaive parented to the right hand with off-hand IK on the haft.
5. **Retime.** Keep only the drawings the MOVESET tables call for (A1 ×2, A2 ×3, S1 ×1, …),
   add holds, snap into contact, overshoot on follow-through, rebound. MOVESET 0.1: "Frames are
   added before or after key poses, never between them." The AI supplies candidate key poses
   and breakdowns, never the in-betweens.
6. **Push the poses** (stronger line of action, wider arcs), then the pixel render.

Kimodo and HY-Motion both output 30 fps [S], the same rate MOVESET authors drawings at
(section 0.1) [M], so one AI frame maps to one 2 f slot at 60 fps.

## This PC today [M]

| Item | Reading |
|---|---|
| GPU | RTX 4090, 24,564 MiB; 3,146 MiB already in use by the desktop when checked; driver 591.86 |
| Free disk | D: 67 GB; C: 19 GB |
| Python | system 3.13; `uv` installed; no conda |
| CUDA toolkit | not on PATH; portable CUDA 12.9.1 at `D:\Dex\Tools\cuda-toolkit-12.9.1-portable` |
| C++ build | Visual Studio Build Tools 2022 (17.14), CMake 4.3.3, Ninja 1.13.2 |
| Linux routes | WSL2 Ubuntu-24.04 (stopped; disk at `D:\Dex\AI\WSL\DexCodeFrontier-Ubuntu-24.04`, named for another project, so keep this work out of it [I]); Docker Desktop 29.5.3 with the Linux engine running, data at `D:\Dex\Docker` |
| Test body | `Seed-san.vrm` (10.9 MB) already at `D:\Dex\Inbox\Downloads\dexplace-character\vrm\` |
| Folders | `D:\Dex\Tools\venvs` exists (holds `psd-tools` only); `D:\Dex\Models` doesn't exist yet |

## Top 3 in detail

### 1. Kimodo (NVIDIA Spatial Intelligence Lab): the pick

- **What:** a motion diffusion model, about 0.3 B parameters [S, model card].
- **Conditioning** [S, README and project page]: text (one prompt or a sequence of prompts);
  full-body keyframes (every joint position at chosen frames, from sparse keys to in-betweening
  between two poses); end-effectors (hand and foot positions and rotations); 2D root waypoints
  or a full floor path. It also works from constraints with no text: NVIDIA's own benchmark has
  a `constraints_notext` split [S, benchmark results page].
- **Output** [S, docs and model card]: 30 fps, at most 10 s (300 frames) per generation. NPZ
  (joint positions, global and local rotations, foot contacts) and **BVH for the SOMA models**
  (`--bvh`, centimetres, optional `--bvh_standard_tpose`). Y-up, +Z forward. Body skeleton of
  30 SOMA joints with no fingers (the paper: "body-only motions (i.e., no finger motions)"),
  written out in the 77-joint SOMA layout.
- **Quality on our kind of motion:**
  - The training data, Bones Rigplay (700 h of optical mocap), "covers ... videogame combat,
    dancing, athletics, and more", with styles such as angry and stealthy [S, Kimodo paper].
  - NVIDIA's SONIC paper, trained on the same capture library, counts "Combat (sword, martial
    arts, and more)" at 50,162 of 317,189 training clips [S, SONIC paper Table 2].
  - Project page demo categories: stunts, dancing, stylised motion, prompt sequences [S].
  - Full-body keyframes are hit to 3.21 cm mean joint error [S, paper].
  - No published head-to-head with HY-Motion on keyframes. An anonymous September 2026 paper
    (Timo) reportedly rates Kimodo highest on plausibility among four released systems, on the
    authors' own text-only benchmark [S, secondary; not re-read in full].
  - Known weak spots, from the model card: "Generated motions may include artifacts like foot
    skating" and "The motion does not always follow the given text prompt." [S] The N4
    upside-down vault and N3 baton twirls are the moves most likely to need heavy hand work;
    the twirls are mostly prop motion anyway [I].
- **Licences** [S]: code Apache-2.0. SOMA weights: NVIDIA Open Model License (version dated
  2025-10-24). Commercial use allowed (§2.2); NVIDIA claims no rights in outputs (§2.4); the
  NVIDIA notice is required when distributing the model (§3.1); the licence ends if you
  disable a guardrail or sue over the model (§2.1). **Avoid the SMPL-X variant:** it's under a
  separate non-commercial NVIDIA R&D licence [S] and click-gated on Hugging Face [M].
- **Text encoder:** LLM2Vec on top of `meta-llama/Meta-Llama-3-8B-Instruct` [S, install docs].
  Meta's repo is `gated: manual` [M]. The two McGill LLM2Vec adapter repos are MIT, ungated,
  0.18 + 0.17 GB [M].
- **Windows** [S]: "developed on Linux, though Windows should work especially if using
  Docker". Python 3.10. The usual Windows snag is the optional MotionCorrection C++ module
  (foot-skate cleanup). A fix for building it inside a venv was merged 2026-09-22 (PR #51)
  [S, secondary], and it can be skipped with `SKIP_MOTION_CORRECTION_IN_SETUP=1`. We have MSVC,
  CMake and Docker, so native, build-from-source and container routes are all open [M]. Skipping
  the cleanup costs little because we re-plant feet during retiming [I].
- **Disk** [M]: weights 1.13 GB; Llama 3 8B Instruct safetensors 16.06 GB; adapters 0.35 GB;
  about 17.5 GB, plus a PyTorch venv (about 5 to 6 GB, estimate [I]).
- **Video memory** [S]: about 17 GB all on GPU, which fits the ~21 GB free today [M];
  `TEXT_ENCODER_DEVICE=cpu` brings it under 3 GB.
- **Tools around it** [S]: `kimodo_demo`, a local timeline editor at 127.0.0.1:7860;
  `kimodo_convert` for format conversion. Community Blender bridges exist (KimodoToBlender, a
  Blender UI fork) but are unreviewed, and we'd use our own headless importer anyway [I]. The
  C++/GGML port `kimodo.cpp` avoids PyTorch but is Linux-only (CPU/Vulkan) and doesn't do
  constraints yet [S], so it's no use to us now.

### 2. GEM-X (NVIDIA, the GENMO family): the reference-video route

- **What:** turns a monocular video (a moving camera is fine) of one person into world-space
  3D motion. Released 2026-03-16. One forward pass, no diffusion [S, model card].
- **Why it's in the top 3:** it's how "feed them references" works for video. It outputs SOMA,
  77 joints including hands and face: the same body model family Kimodo uses. Frames from a
  reference clip can become Kimodo keyframes, or the whole clip can be retargeted directly.
  [S for the formats; the hand-off is I]
- **Quality** [S, model card]: trained only on synthetic renders (Rigplay motion on about 4,000
  CG characters); 115.2 mm world-space joint error on NVIDIA's internal test set. Its own
  limits: "fast camera motion, textureless environments, or motion blur" and "unusual
  clothing, heavy occlusion, or non-standard body proportions may produce inaccurate
  estimates". Game footage of long-sleeved anime characters with smeared weapons hits most of
  those [I]. A clean video of Dex doing the move with a broom will capture far better, and the
  motion is then his own [I].
- **Licences** [S]: code Apache-2.0; model under the NVIDIA Open Model License, and the card says
  "ready for commercial use". Its person tracker is Meta's SAM 3D Body, bundled in NVIDIA's
  repo under Meta's SAM License (commercial use allowed; ship the licence text if you
  redistribute; no military or weapons-development end uses) [S, GEM-X `ATTRIBUTIONS.md`].
  Meta's own copy is manually gated; NVIDIA's bundled copy isn't [M].
- **Rights caveat** [I, using the risk levels in MOTION-SOURCES]: motion captured from someone
  else's game footage is a trace of their animation. That stays timing study inside
  `review/motion/`. Only motion re-authored from our own keys, or from Dex's own recording,
  ships.
- **Files we'd need** [M]: `gem_soma.ckpt` 0.54 GB, `sam3d_body.ckpt` 2.11 GB, `vitpose.pth`
  3.39 GB, `mhr_model.pt` 0.70 GB: about 6.7 GB. The full repo is 32.4 GB because it also
  carries GEM-SMPL, ONNX copies and evaluation data; pull only these files. The SOMA body
  assets come through a git-lfs submodule (size not measured).
- **Windows** [S]: the card lists Linux only; CUDA 12.1+; the quick start uses Python 3.12 and
  PyTorch cu126; a Dockerfile is provided. Docker with its data on D: is the likely route [I].

### 3. HY-Motion 1.0 (Tencent Hunyuan): text-only second opinion

- **What:** a 1.0 B flow-matching diffusion transformer (plus a 0.46 B Lite version); text and
  length in, motion out. Released 2025-12-30; no newer version exists as of today [S].
- **Conditioning:** text and duration only. No keyframes, no paths [S].
- **Output:** 30 fps, SMPL-H 22 body joints, no hands [S, paper]. It ships its own rigged
  "wooden" body (`assets/wooden_models/boy_Rigging_smplx_tex.fbx`) [M, repo tree], so no
  MPI/SMPL registration is needed. FBX export goes through Autodesk's FBX Python SDK, whose
  Windows builds are picky about Python versions [S, secondary]; NPZ always works.
- **Quality** [S, paper]: pretrained on 3,000+ h (12 M web-video clips lifted to 3D with GVHMR,
  about 500 h of mocap, artist animation), fine-tuned on 400 h. Its category list includes
  "Sports & Athletics" and "Game Character Actions". Tencent's own evaluation: instruction
  following 3.24 vs MoMask 2.31; motion quality 3.43 vs DART 3.11; SSAE 78.6% vs 58.0%.
  Stated limits: complex instructions and object interaction.
- **Licence** [S, `License.txt`]: Tencent HY-Motion 1.0 Community License.
  - Territory excludes the EU, UK and South Korea (§1.l). Dex, in Vietnam, is inside it.
  - But §5.c bars using or displaying the works, "Output or results" outside the territory.
    dex.place is public, so EU and UK visitors would see frames derived from it. For shipped
    sprites that's a medium-to-high risk [I].
  - No using outputs to improve other AI models (§5.b); a 1 million monthly-active-user cap
    (§4); the acceptable-use policy asks for disclosure of machine-generated content.
- **Gate:** none [M]. Text encoders: `Qwen/Qwen3-8B` (16.40 GB, Apache-2.0, ungated) and
  `openai/clip-vit-large-patch14` (1.71 GB of safetensors) [M]. The optional prompt-rewrite
  model is 61 GB [M]: skip it with `--disable_rewrite --disable_duration_est`.
- **Video memory** [S]: minimum 26 GB (full) or 24 GB (Lite), so neither fits today's ~21 GB
  free without offloading. The README suggests one seed, prompts under 30 words, clips under
  5 s; a community exporter's `--cpu-offload` claims a 3 to 4 GB peak [S, secondary].
- **Windows:** officially supported [S].
- **Disk** [M]: 4.17 GB (full) or 1.84 GB (Lite), + 16.40 GB Qwen3 + 1.71 GB CLIP: about 20
  to 22 GB.

## Everything else checked

What each one takes in, what it puts out, and why it isn't in the top 3. "HumanML3D" below
means trained on the HumanML3D dataset, which is built from AMASS (licence notes after the
table).

| Model | Maker, date | Takes | Gives | Licence: code / weights | Sign-in needed | Why not top 3 |
|---|---|---|---|---|---|---|
| ARDY | NVIDIA, 2026-07-10 (SIGGRAPH 2026) | live text, keyframes, paths, joint targets | "Core" skeleton at 20 fps, G1 robot at 25 fps; SOMA "coming soon" [S] | Apache-2.0 / NVIDIA Open Model [S] | same gated Llama 3 encoder [S] | real-time version of Kimodo; lower frame rate, no SOMA yet, nothing gained for offline authoring |
| MotionBricks | NVIDIA, SIGGRAPH 2026 | velocity, heading, style commands, "proxy keyframes" [S] | G1 humanoid focus [S] | preview in GR00T-WholeBodyControl; licence not verified | not checked | real-time locomotion and object interaction; no attack authoring |
| GEM-SMPL (GENMO) | NVIDIA, ICCV 2025; weights 2026-03 | video + text + audio/music [S] | SMPL [S] | NVIDIA OneWay Noncommercial [M, LICENSE] | SMPL body model (MPI registration) [S] | non-commercial, plus a sign-up |
| Kimodo-SMPLX-RP | NVIDIA, 2026-03 | as Kimodo | SMPL-X | Apache-2.0 / NVIDIA R&D, non-commercial [S] | click-gated [M] | licence |
| kimodo.cpp | community port, 2026 | text only so far [S] | skeleton-only GLB [S] | Apache-2.0 port; weights keep NVIDIA terms [S] | GGML weights ungated [M] | Linux-only, no constraints yet |
| ProtoMotions / MaskedMimic | NVIDIA | control of a physics-simulated character [I] | simulated humanoids [I] | Apache-2.0 [M] | not checked | a robotics/simulation training framework; physical realism is the opposite of the push we want [I] |
| Timo | anonymous ICLR 2027 submission, Sept 2026 | text [S] | body parameters [S] | nothing released [S] | n/a | nothing to download |
| MotionMillion ("Go to Zero", 3B/7B) | ICCV 2025 | text [S] | HumanML3D-style joints [I] | Apache-2.0 code; data CC BY-NC-SA 4.0; no separate weight licence [S, secondary] | dataset gated [S, secondary] | effectively research-only |
| MoMask | CVPR 2024 | text, temporal inpainting [S] | HumanML3D 22 joints, writes BVH [S] | MIT [M] / HumanML3D | none | AMASS data terms; older quality (HY-Motion's table puts it well behind) |
| MDM | 2022 | text, inpainting | HumanML3D; SMPL for meshes | MIT [M] / HumanML3D | SMPL for meshes | same data terms; older |
| CondMDI | SIGGRAPH 2024 | text + sparse or partial keyframes [S] | HumanML3D [S] | MIT [M] / HumanML3D | none | the research baseline for what Kimodo does, on older non-commercial data |
| T2M-GPT | 2023 | text | HumanML3D | Apache-2.0 [M] / HumanML3D | none | same data terms; older |
| MotionGPT | 2023 | text | HumanML3D | MIT [M] / HumanML3D | none | same data terms; older |
| MotionLCM | 2024 | text + trajectory control, real-time | HumanML3D | "Non-commercial Scientific Research" licence [M, LICENSE] | none | licence |
| DART | ICLR 2025 | text, waypoints, in-betweening, real-time | SMPL-X [I] | Apache-2.0 code [M] / trained on AMASS-derived data [I] | SMPL-X registration [I] | sign-up plus data terms |
| GVHMR | SIGGRAPH Asia 2024 | video | SMPL / SMPL-X [S] | weights non-commercial [S, secondary] | SMPL-X registration [S] | sign-up and non-commercial (HY-Motion used it to build its training data) |
| SAM 3D Body | Meta, Nov 2025 | single image (per frame for video) [S] | MHR rig (Apache-2.0) [S] | SAM License [S] | Meta repo manually gated [M] | GEM-X already wraps it with motion over time |
| Audio2Face and other Omniverse/ACE tools | NVIDIA | audio | faces [I] | not checked | not checked | faces, not bodies [I] |
| Hosted apps (Cascadeur, Uthana, DeepMotion, Rokoko Vision, Move.ai) | various | app or web upload | various | per service | accounts [I] | account creation is Dex's call; not researched in depth here |

## Licences in plain words

- **NVIDIA Open Model License** (Kimodo SOMA, GEM-X, ARDY): free, commercial use allowed,
  outputs are ours. The NVIDIA notice goes with the model if we ever redistribute the model
  itself. A credit line in our credits page is cheap good manners either way [I].
- **Llama 3 Community License** (only inside Kimodo, as its text encoder): using it at all means
  accepting Meta's licence and acceptable-use policy (its text: "By clicking “I Accept” below or
  by using or distributing any portion or element of the Llama Materials") [M, LICENSE file].
  Redistribution is allowed with a copy of the licence and a "Built with Meta Llama 3" notice
  (§1.b.i) [M, LICENSE file]. That clause is why ungated copies on Hugging Face are legitimate.
  We never ship the encoder or its raw outputs; our frames are Kimodo's motion [I].
- **SAM License** (inside GEM-X): commercial use allowed; keep the licence text with any copy we
  pass on; no military or weapons-development uses; the licence ends if we sue Meta over it
  [S]. A fictional glaive in a sprite is nowhere near the weapons clause [I].
- **Tencent HY-Motion 1.0 Community License:** the territory and display clause above. Fine for
  private study in Vietnam, risky for anything shipped on a public site [I].
- **HumanML3D / AMASS family:** the AMASS licence allows non-commercial research, education and
  "non-commercial artistic projects", and bans using the data to train networks for commercial
  use of any kind [S, AMASS licence page]. With the donate button, dex.place sits in the
  "medium" band from MOTION-SOURCES at best. Nothing trained on it should reach shipped frames [I].

## What Dex needs to do

1. **Choose how Kimodo gets its text encoder.** One of:
   - **a. Official:** sign in to (or create) a Hugging Face account, request access at
     `huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct` (Meta approves by hand), create a
     read-only token, and store it as a Windows Credential Manager secret. Agents never see or
     type it.
   - **b. No sign-in:** say yes to downloading an ungated, licence-permitted copy, e.g.
     `NousResearch/Meta-Llama-3-8B-Instruct` (16.06 GB, ungated [M]). Same weights, same Llama 3
     licence; a yes here means accepting that licence and Meta's acceptable-use policy.
   - **c. Neither yet:** we try Kimodo with keyframes and no text. The model supports it (NVIDIA's
     `constraints_notext` benchmark), but whether the code runs without loading the encoder is
     untested.
2. **HY-Motion:** say whether it's allowed for anything beyond private timing study. Our
   recommendation: private study only, or skip it.
3. **Optional, high value:** film yourself doing the key moves with a broom or pole: side view,
   plain background, whole body in frame, 60 fps if the phone can. That's the cleanest input
   GEM-X can get, and the motion is yours.
4. **Disk:** Kimodo + GEM-X fits the ~30 GB budget (below). Adding HY-Motion needs about 20 GB
   more.

## Disk plan (≤ 30 GB)

Sizes are measured [M] except the venvs, which are estimates [I].

| Download | Size | For |
|---|---|---|
| `nvidia/Kimodo-SOMA-RP-v1.1` | 1.13 GB | Kimodo |
| Meta-Llama-3-8B-Instruct safetensors (Meta's or a licensed copy) | 16.06 GB | Kimodo text |
| `McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp` + `-supervised` | 0.35 GB | Kimodo text |
| `nvidia/GEM-X`: 4 files listed above | 6.74 GB | video capture |
| PyTorch venv(s) under `D:\Dex\Tools\venvs\` | ~5–6 GB each | both |

About 24.3 GB of weights. One shared Python 3.10 venv keeps the total near 30 GB; two separate
venvs push it to about 36 GB [I]. Order: Kimodo first, GEM-X once Kimodo produces a usable clip.

Keep everything off C: (SHARED.md drive policy): `HF_HOME=D:\Dex\Models\hf`, `UV_CACHE_DIR` and
`PIP_CACHE_DIR` under `D:\Dex\Caches`, `UV_PYTHON_INSTALL_DIR` under `D:\Dex\Tools\python`,
`TORCH_HOME` under `D:\Dex\Models\torch`.

## Not verified yet

- Kimodo on native Windows on this PC (not installed yet).
- Kimodo running without its text encoder loaded (the `constraints_notext` route).
- How Kimodo handles a full 360° sweep (N2, N5), the upside-down vault over the haft (N4) and
  the gliding pirouette (dash). These make good first test prompts.
- The SOMA → VRM bone mapping and rest-pose alignment (test on Seed-san).
- GEM-X on anime or game footage vs a self-recorded clip.
- ARDY's SOMA release and MotionBricks' full release status.
- HY-Motion FBX export on Windows.

## Sources (checked 2026-09-28)

- Kimodo: github.com/nv-tlabs/kimodo (README, changelog); research.nvidia.com/labs/sil/projects/kimodo
  (project page, docs: installation, output formats, benchmark results); tech report
  research.nvidia.com/labs/sil/projects/kimodo/assets/kimodo_tech_report.pdf; paper
  arxiv.org/abs/2603.15546; huggingface.co/nvidia/Kimodo-SOMA-RP-v1 and -v1.1 model cards;
  community: github.com/localai-org/kimodo.cpp, gist Aero-Ex Kimodo install guide,
  github.com/jtydhr88/ComfyUI-Kimodo, nv-tlabs/kimodo PR #51.
- SONIC paper (Rigplay category counts): arxiv.org/abs/2511.07820 (HTML version, Table 2).
- ARDY: github.com/nv-tlabs/ardy; research.nvidia.com/labs/sil/projects/ardy.
- MotionBricks: nvlabs.github.io/motionbricks; GIGAZINE 2026-06-15 report.
- GEM-X / GENMO: github.com/NVlabs/GEM-X (README, ATTRIBUTIONS.md, docs/INSTALL.md);
  huggingface.co/nvidia/GEM-X (model card, LICENSE, file list); github.com/NVlabs/GENMO (README,
  LICENSE); research.nvidia.com/labs/dair/gem; arxiv.org/abs/2505.01425.
- NVIDIA Open Model License: nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license
  (version 2025-10-24).
- HY-Motion: github.com/Tencent-Hunyuan/HY-Motion-1.0 (README, License.txt, repo tree, issue #49);
  huggingface.co/tencent/HY-Motion-1.0; arxiv.org/abs/2512.23464 (HTML); github.com/zysilm/hy-motion-fbx-exporter.
- Timo: timoiclr2027.github.io; arxiv.org/abs/2609.30761 (via search summary).
- MotionMillion: github.com/VankouF/MotionMillion-Codes; huggingface.co/datasets/InternRobotics/MotionMillion.
- MoMask, MDM, CondMDI, T2M-GPT, MotionGPT, MotionLCM, DART: each repo's LICENSE file on GitHub;
  CondMDI README and setarehc.github.io/CondMDI; MoMask README.
- AMASS licence: amass.is.tue.mpg.de/license.html.
- GVHMR: github.com/zju3dv/GVHMR; huggingface.co/ryanrudes/gvhmr.
- SAM 3D Body / MHR: github.com/facebookresearch/sam-3d-body; github.com/facebookresearch/MHR;
  huggingface.co/facebook/sam-3d-body-dinov3.
- Llama 3 licence: LICENSE file in huggingface.co/NousResearch/Meta-Llama-3-8B-Instruct.
- Hugging Face API (`/api/models/<id>?blobs=true`) for every gated flag and size marked [M].
