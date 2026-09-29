# Third-party downloads for tools/motion-ai

Every file downloaded for the motion-AI work: where it came from, where it lives, and its
licence. Model weights live under `D:\Dex\Models\`, Python environments under
`D:\Dex\Tools\venvs\`, and third-party reference videos and frames under the git-ignored
`review/motion/`. None of these files go in the repo.

| Date | What | Source URL | Local path | Size | Licence (code / weights) | Notes |
|---|---|---|---|---|---|---|
| 2026-09-28 | YouTube storyboard previews (the small scrub-bar thumbnails, 80×45 to 320×180 px) and `yt-dlp --dump-json` metadata for 48 reference videos, turned into labelled contact sheets by `storyboard_sheet.py` | `i.ytimg.com` storyboard sprites; video pages listed in `VIDEO-TO-MOTION.md` | `review/motion/_storyboards/<video_id>/` (git-ignored) | 93 MB (sheets ~72 MB, metadata JSON 21 MB) | each video's owner; standard YouTube licence, none Creative Commons | Used only to check timestamps and camera framing before asking to download. No video or audio stream was downloaded. Delete the folder when the clip list is settled. |
| 2026-09-28 | Channel video list (titles, ids, durations) and channel description for Motion Actor Inc | `youtube.com/@MotionActorInc` | `review/motion/_meta/` (git-ignored) | 0.9 MB | Motion Actor Inc | Metadata only; the channel description holds its usage terms (quoted in `VIDEO-TO-MOTION.md`). |

The model survey in `MODELS.md` only read web pages and Hugging Face / GitHub API metadata. The
setup rows below (2026-09-29) are real downloads; `SETUP.md` has the exact commands.

### Setup downloads (2026-09-28/29, for `SETUP.md`)

Nothing here needed an account, a token or a click-through: every Hugging Face repo below
reported `gated: false` on its API at download time. Sizes are measured on disk.

| Date | What | Source | Local path | Size | Licence (code / weights) | Notes |
|---|---|---|---|---|---|---|
| 2026-09-28 | Kimodo source, commit `58e78189` (2026-09-22) | `github.com/nv-tlabs/kimodo` | `D:\Dex\Tools\src\kimodo` | 301 MB (incl. 57 MB demo assets) | Apache-2.0 | Includes NVIDIA's example constraint files used for the smoke tests. |
| 2026-09-28 | Kimodo SOMA weights `Kimodo-SOMA-RP-v1.1`, HF commit `6c9233af` | `huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1` | `D:\Dex\Models\kimodo\Kimodo-SOMA-RP-v1.1` | 1.1 GB | NVIDIA Open Model License (LICENSE file in the folder) | Commercial use allowed; NVIDIA claims no rights in outputs. The notice travels with the model only if we redistribute the model itself. |
| 2026-09-29 | MotionCorrection C++ build deps, fetched by its CMake: pybind11 v2.11.1, Eigen 3.4.0 | github.com/pybind/pybind11, gitlab.com/libeigen/eigen | build tree only (`uv` build dir under `D:\Dex\Caches\uv`) | small | BSD-3-Clause / MPL-2.0 | Compiled into the `motion_correction` module in the Kimodo venv; not redistributed. |
| 2026-09-28 | GEM-X source, commit `32992550` (2026-04-27) + submodules SOMA-X `e0f8ff0e` and sam-3d-body `b5c765a0` | `github.com/NVlabs/GEM-X`, `github.com/NVlabs/SOMA-X`, `github.com/facebookresearch/sam-3d-body` | `D:\Dex\Tools\src\GEM-X` (`inputs` is a junction to `D:\Dex\Models\gem-x\inputs`) | 207 MB + 124 MB SOMA LFS objects | Apache-2.0 (GEM-X, SOMA-X) / SAM License (sam-3d-body code) | `soma-retargeter` submodule not cloned (SSH-only, not needed). |
| 2026-09-28 | GEM-X weights, HF commit `5ccf5ca3`: `gem_soma.ckpt`, `vitpose.pth`, `sam3d_body.ckpt` + `model_config.yaml`, `mhr_model.pt`, `scale_mean.pth`, `scale_comps.pth`, `config.json`, `LICENSE`, `README.md` | `huggingface.co/nvidia/GEM-X` | `D:\Dex\Models\gem-x\inputs\{pretrained,checkpoints,mhr_data,soma_data}` | 6.4 GB | Code Apache-2.0 / model NVIDIA Open Model License (model card); bundled SAM 3D Body + MHR under Meta's SAM License (GEM-X `ATTRIBUTIONS.md`) | Skipped `gem_smpl.ckpt` (5.5 GB, SMPL variant under NVIDIA's non-commercial terms) and the ONNX copies. |
| 2026-09-28 | SOMA-X body assets, HF commit `104578ed` (MHR, Anny, SMPL/SMPLX wrap meshes, `SOMAHand.npz`, `SOMA_procedural_transforms.json`, manifest) | `huggingface.co/nvidia/SOMA-X` | `D:\Dex\Models\gem-x\inputs\soma_assets` | ~20 MB (+ the MHR file below) | Apache-2.0 | Mesh files only: no SMPL/SMPL-X body model is included. |
| 2026-09-29 | SOMA-X `SOMA_neutral.npz` + `correctives_model.pt` at the **submodule's pinned commit** (git LFS) | SOMA-X LFS via the GEM-X submodule | `third_party\soma\assets\`, hardlinked into `soma_assets\` | 26.6 + 70.5 MB | Apache-2.0 | The HF-latest copies of these two files (downloaded first, then deleted) don't match GEM-X's pinned SOMA code (`KeyError: joint_parent_ids`; looks like GEM-X issue #28). |
| 2026-09-28 | `MHR/mhr_model_lod1.pt` | SOMA-X HF | `soma_assets\MHR\` | 0 extra: hardlink | Apache-2.0 via SOMA-X; the same file ships in `nvidia/GEM-X` | sha256 `352e271a…77bc` is byte-identical to GEM-X's `mhr_model.pt`, so one copy is stored. `SOMA_template_rig.usda` and `example_animation.npy` came down by mistake (CLI argument parsing) and were deleted. |
| 2026-09-29 | YOLOX-X person detector ONNX `yolox_x_8xb8-300e_humanart-a39d44ed.onnx`, auto-downloaded by GEM-X's demo | `download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/` | `D:\Dex\Models\torch\hub\checkpoints\` (moved from `D:\Dex\AI\Torch`, where it first landed) | 378 MB | YOLOX code Apache-2.0 (Megvii); these OpenMMLab weights were trained on Human-Art, whose data terms I have **not** verified | Only draws the person box each frame; nothing from it reaches the motion. Worth a licence check before any commercial reliance. |
| 2026-09-29 | Python packages (PyTorch 2.10.0+cu126, transformers, hydra, onnxruntime-gpu 1.23.2, open3d, warp-lang, …) | PyPI and `download.pytorch.org/whl/cu126` | `D:\Dex\Tools\venvs\kimodo`, `D:\Dex\Tools\venvs\gemx` (files hardlinked from `D:\Dex\Caches\uv`) | 4.5 + 5.7 GB | each package's own (mostly BSD/MIT/Apache) | Exact versions in `venv-kimodo.lock.txt` and `venv-gemx.lock.txt`. |
| 2026-09-29 | Muybridge, "Athlete swinging clubs" (c. 1881), 8-frame GIF, sha256 `c4f32ffb…31aa` | `commons.wikimedia.org/wiki/File:Athlete_swinging_clubs.gif` | `review/motion/_samples/` (git-ignored) + a 30 fps mp4 made from it | 2.4 MB (+0.6 MB mp4) | Public domain (Commons: Eadweard Muybridge, c. 1881) | GEM-X smoke-test input only. The subject is nude (1880s motion study); keep it in `review/`. |

### Kimodo text encoder (2026-09-29)

**Licence decision (Dex, 2026-09-29):** rather than wait for Meta to approve the gated
`meta-llama/Meta-Llama-3-8B-Instruct` request, use the ungated copy
`NousResearch/Meta-Llama-3-8B-Instruct`. Dex accepts the **Meta Llama 3 Community License** and
the **Meta Llama 3 Acceptable Use Policy** for this use (Kimodo's text encoder, turning motion
prompts into embeddings for dex.place animation work). Both texts are in the cache:
`D:\Dex\Models\hf\hub\models--meta-llama--Meta-Llama-3-8B-Instruct\snapshots\8afb486c...\{LICENSE,USE_POLICY.md}`,
byte-identical to Meta's. Obligations to keep in mind [from the licence text; not legal advice]: if we ever
**distribute or make available** the Llama weights, or a product or service that uses them
(which includes another AI model, e.g. shipping Kimodo together with its encoder), include the
licence and prominently display "Built with Meta Llama 3". A distributed AI model built with
Llama must have a name starting with "Llama 3". Llama outputs may not be used to improve any
*other* large language model. Today the encoder stays on this PC and only its embeddings steer
Kimodo, so none of this is triggered; recheck before shipping any motion tool, not the motions. The
700M-monthly-active-users clause doesn't apply to us. The use policy's prohibited uses don't
cover animating a game character.

**Same bytes as Meta's [M].** Meta's gated repo still publishes its file list and LFS hashes on
the public model-info API (saved in `D:\Dex\Models\hf\provenance\`). Every file we took from
NousResearch has the same git blob id or LFS sha256 as Meta's `main` (`8afb486c`): the four
safetensors shards, index, config, generation config, tokenizer files, LICENSE and USE_POLICY.
Only the README differs (not downloaded). NousResearch has no `original/` folder; Meta's
`original/consolidated.00.pth` (16 GB duplicate) wasn't needed. All 13 downloaded files, and every file in
both McGill repos, were re-hashed after download and match (`provenance\install-verify-2026-09-29.txt`).

| Date | What | Source | Local path | Size | Licence (code / weights) | Notes |
|---|---|---|---|---|---|---|
| 2026-09-29 | Meta Llama 3 8B Instruct weights, tokenizer, configs, LICENSE, USE_POLICY (13 files), NousResearch commit `53346005` | `huggingface.co/NousResearch/Meta-Llama-3-8B-Instruct` (ungated, `gated: false`) | `D:\Dex\Models\hf\hub\models--meta-llama--Meta-Llama-3-8B-Instruct\snapshots\8afb486c1db24fe5011ec46dfbe5b5dccdb575c2` (filed under Meta's id and revision so LLM2Vec applies the Llama 3 prompt template) | 16.07 GB | Meta Llama 3 Community License + Acceptable Use Policy (accepted by Dex, above) | Bytes identical to `meta-llama/Meta-Llama-3-8B-Instruct@8afb486c`. Download log: `provenance
ous-download-2026-09-29.log`. |
| 2026-09-29 | LLM2Vec MNTP LoRA adapter + tokenizer + its custom code files, commit `31474e39` | `huggingface.co/McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp` | `D:\Dex\Models\hf\hub\models--McGill-NLP--LLM2Vec-Meta-Llama-3-8B-Instruct-mntp` | 0.18 GB | MIT (adapter); applied on top of Llama 3, so the Llama licence covers the combination | Kimodo uses its own copy of the LLM2Vec code; the repo's `modeling_llama_encoder.py` is not executed (no `trust_remote_code`). |
| 2026-09-29 | LLM2Vec supervised LoRA adapter, commit `baa8ebf0` | `huggingface.co/McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised` | `D:\Dex\Models\hf\hub\models--McGill-NLP--LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised` | 0.17 GB | MIT | Model-card retrieval example reproduced to 0.0007 (`text_encoder_check.py`). |

No token, account or sign-in was used; the downloads ran with `HF_HUB_DISABLE_IMPLICIT_TOKEN=1`.

Still not downloaded, on purpose: HY-Motion, GVHMR, any SMPL/SMPL-X files, Meta's
`original/*.pth` Llama checkpoint, and any reference video other than the public-domain GIF above.

### Reference clips for video-to-motion (2026-09-29, Rosace move generation)

Four Motion Actor Inc "Long Weapon" segments, the top picks of `VIDEO-TO-MOTION.md`'s shortlist
(#1, #2, #3, #5). Fetched as video-only 1080p60 H.264 segments with yt-dlp 2026.08.19
(`--download-sections`), no account or cookies, then re-encoded to 30 fps with ffmpeg for GEM-X.
This supersedes the "no reference video other than the public-domain GIF" line above.

**Rights [M, channel description, quoted in `VIDEO-TO-MOTION.md`]:** free to trace and rearrange;
no profit use, no reposting, no sale. Until Dex rules whether dex.place (with its donation button)
is "not for profit", everything derived from these clips (GEM-X BVHs, the Kimodo motions keyed
from them) is **study material**: it stays in git-ignored `review/motion/` or in
`dex-place-art/rosace/motion-ai/raw/video/` (not a git repo), is never committed, and never ships.

| Date | What | Source | Local path | Size (60 fps / 30 fps copy) | sha256 (first 12) | Licence |
|---|---|---|---|---|---|---|
| 2026-09-29 | "退き突き薙ぎ払い" retreat, thrust, mow down, 0:00–0:09 | youtube.com/watch?v=H9C2IemTkzM | `review/motion/clips/thrustmow_H9C2IemTkzM{,_30fps}.mp4` | 4.5 / 7.0 MB | `4da9ae2353d4` / `eeb0fee7ca6e` | Motion Actor Inc terms (above); standard YouTube licence |
| 2026-09-29 | "大なぎ払い" big mowing sweep, 0:00–0:12 | youtube.com/watch?v=yeOMbxdKv6o | `review/motion/clips/bigsweep_yeOMbxdKv6o{,_30fps}.mp4` | 3.5 / 6.3 MB | `313fc46f004e` / `a66489b2c829` | same |
| 2026-09-29 | "渦潮弾き" whirlpool, 0:00–0:14 | youtube.com/watch?v=-iJ_d5z5m3o | `review/motion/clips/whirlpool_-iJ_d5z5m3o{,_30fps}.mp4` | 7.4 / 11.4 MB | `cb8d8b9e022a` / `61a084c1d52e` | same |
| 2026-09-29 | "擬似眉刃" blade windmill, 0:00–0:21 | youtube.com/watch?v=F2nStU9Wqck | `review/motion/clips/windmill_F2nStU9Wqck{,_30fps}.mp4` | 10.5 / 15.4 MB | `3be8213bce8b` / `65d86bb4e77f` | same |

Derived files (ours, same rights as their source clip): GEM-X runs in
`review/motion/_runs/gemx_<clip>/`, contact sheets in `review/motion/clips/_sheets/`, cut
segments and Kimodo re-keyed motions in `D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw\video\`,
previews in `review/motion/previews/video/`. Catalogue: `CATALOGUE.md`.

### Retime layer and pixel A/B/C (2026-09-29)

**Nothing was downloaded** for `retime.py`, `blender_apply.py`, `run_pixel.py` or `ab_compose.py`
(numpy, Pillow, Blender 5.1.2 and ffmpeg were already on the PC). What they read:

| Input | Where it came from | Licence / status |
|---|---|---|
| Kimodo motions `n1_study_ee_s1_00`, `n5_study_ee_s1_00` (+ sidecars) | generated here from our own MOVESET key poses (no video) | our output; Kimodo's licence terms as recorded above |
| Rosace rig, read-only copy `dex-place-art/rosace/motion-ai/work/rosace_snapshot_0258.blend` (sha1 `c5d3920c30b9`) | the other workflow's `rosace/build/rosace.blend` at 02:58, copied, never edited | built from HairSample_Female.vrm (CC0, see `tools/pixel-pipeline/THIRD_PARTY.md`) plus our own scripts |
| Hand-keyed spike sweep | re-rendered at 144 px with our own `tools/pixel-pipeline/blender_spike.py` (primitives only) | ours |
