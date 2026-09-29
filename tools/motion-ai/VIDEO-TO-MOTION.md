# Video to motion for Rosace: which model, and which clips to feed it

Which "motion capture from an ordinary video" models we can run on this PC, and which
reference clips are worth feeding them for Rosace's glaive moves. Research date: 2026-09-28.

**No model and no video has been downloaded.** To check timestamps and camera framing, I
fetched YouTube's scrub-bar preview thumbnails (the little frames the player shows when you
hover the progress bar) plus each video's metadata, and tiled them into labelled contact sheets
with `storyboard_sheet.py`. They sit in the git-ignored `review/motion/_storyboards/` (93 MB)
and are logged in `THIRD_PARTY.md`.

Companions: `MODELS.md` (text and keyframe generators, mainly Kimodo; it also covers GEM-X
briefly), `THIRD_PARTY.md` (download log), `docs/character/MOVESET.md` (frame tables we retime
to), `docs/character/MOTION-SOURCES.md` (licence risk levels; same tags as here).

Tags:

- **[M]** measured: checked on this PC today, or read directly off an API, a file listing, a
  licence file, an issue thread or a storyboard contact sheet.
- **[S]** sourced: the maker's own page, paper, model card or licence. "[S, secondary]" means
  read through a search summary or a third party.
- **[I]** inference: our reading or proposal. Treat as a claim to test.

## The short answer

1. **Model: start with NVIDIA's GEM-X.** It turns a video of one person into a 3D skeleton
   moving over time, on the same SOMA skeleton that Kimodo (the "animator from NVIDIA" in
   `MODELS.md`) uses, so a captured pose can go straight into Kimodo as a keyframe. It needs no
   sign-in anywhere, and its weights allow commercial use. [M, S]
   **But it's a v1.0 with rough edges that hit us** [M, from its GitHub issues]: on a video
   with a moving camera the public demo quietly treats the camera as fixed; limbs can swap when
   a foot goes above the hip; the released model doesn't output fingers; and its exported BVH
   has a reported rest-pose problem. So feed it **fixed-camera clips**, and check every capture
   for swapped limbs.
2. **Second: SAM 3D Body (Meta) for single key poses.** It reads one image at a time, so it
   gives jittery motion over a clip, but our animation is pose to pose anyway (MOVESET 0.1:
   frames are added around key poses, never between them). Point it at the exact frame of a
   coil, a contact or a follow-through and it gives that pose. It's already inside GEM-X's
   download, so again no sign-in. [M, S, I]
3. **Third: GVHMR**, the best-tested open model of this kind and the one other projects use to
   lift martial-arts video. Keep it as a second opinion if GEM-X struggles. It needs Dex to
   register for the SMPL and SMPL-X body models (Max Planck Institute accounts), and its code
   licence is "educational, research and non-profit purposes only". [S]
4. **The gacha trailers are poor capture input.** From their storyboards [M]: shots last 1 to 2
   seconds, glowing effects cover the limbs, cameras swing, enemies overlap her. Only the
   gameplay-style videos (Arknights: Endfield's *Operator Combat Demo*, ZZZ's *Agent Combat
   Intel*) have 2 to 8 second stretches of whole-body attacks. Motion captured from them is a
   trace of the studio's animation, so it stays timing and pose study in `review/motion/`,
   never shipped. [I, using MOTION-SOURCES' risk levels]
5. **The best capture input found is Motion Actor Inc's "Long Weapon" series**: about 200
   videos of professional motion actors doing polearm moves one at a time, fixed camera, plain
   wall, whole body in frame, mostly 1080p at 60 fps [M]. The channel says its videos are free to trace
   and rearrange, and bans use for profit [M, channel description]. With the donation button,
   whether dex.place counts as "not for profit" is Dex's call. The cleanest input of all is
   still Dex filming himself with a broom handle.
6. **Clip shortlist below: 11 segments**, 6 of them Motion Actor, 2 real-world martial arts
   (naginata, guandao), 3 official game videos (study only). All together they're about 0.5
   GB at 1080p [M, from the metadata].

## How capture fits the pipeline [I]

`MODELS.md` has the whole pipeline. The video step, concretely:

1. Download only the approved segment (`yt-dlp --download-sections "*0:00-0:21"`), into
   `review/motion/<clip>/`.
2. Resample to 30 fps with ffmpeg. MOVESET draws on 30 fps timing [M], and one of GEM-X's demo
   video writers is hard-coded to 30 fps (issue #29) [M], so 30 fps in keeps everything in step
   [I]. For two-person clips, crop to our performer.
3. Run GEM-X with `--static_cam` (every top clip has a fixed camera). Out comes
   `hpe_results.pt`: per-frame joint rotations and root position. GEM-X already contains a
   SOMA BVH writer (`export_soma_bvh` in `scripts/demo/retarget_utils.py`) [M], and Kimodo has
   one for the same skeleton [M, repo tree].
4. For key poses only: run SAM 3D Body on the chosen frames, then convert its output to SOMA
   with SOMA-X's `tools.mhr2soma` [S, SOMA-X docs] and hand the poses to Kimodo as keyframes.
5. Blender, headless and in an isolated user env: import the BVH, retarget to the VRM test body
   (Seed-san), sample the MOVESET drawing frames, then retime and push the poses.

What the video models don't give us [S, I]:

- **The glaive.** None of them tracks a weapon. During two-handed phases the haft lies along
  the line from one wrist to the other, so the glaive can be placed from the two wrists
  alone. One-handed twirls (N3) are prop animation we key ourselves.
- **Fingers.** GEM-X's released config sets `remove_fingers: true` (issue #20) [M]; GVHMR
  doesn't articulate hands either (issue #85) [S].
- **Anime timing and cloth.** Captured motion is real-world timing. The holds, snap, overshoot
  and push are ours.

Which camera angle captures best for a side-view game [I]: a side-on clip records exactly the
plane our sprites show, so its most accurate dimensions are the ones on screen; the cost is
that the far arm is hidden and guessed. A front view sees both arms but has to guess depth,
and in a side-view render that depth becomes left-right movement on screen. So side-on is
best for us and three-quarter is a fair second; a pure front view is the weakest.

## Models, ranked

The table puts every candidate side by side on Dex's criteria. "Gated" means some download
needs an account or approval. Details follow for the top three.

| # | Model | Fast athletic motion | Moves through the world? | Skeleton out | Licence (code / weights) | Gated | Windows + 4090 |
|---|---|---|---|---|---|---|---|
| 1 | **GEM-X** (NVIDIA, v1.0, 2026-03) | trained on renders of Bones RigPlay mocap, which includes a large combat set [S]; no public benchmark; open issues on limb swaps and vigorous footwork [M] | designed to; the public demo currently falls back to a fixed camera (#24) [M] | SOMA 77-joint layout, fingers off; root in metres [M] | Apache-2.0 / NVIDIA Open Model, commercial OK; bundles Meta's SAM License [M] | **none** [M] | Linux-only per card; Docker Desktop here has the NVIDIA runtime registered [M]; native Windows via its ONNX demo is plausible [I] |
| 2 | **SAM 3D Body** (Meta, 2025-11) | one image at a time; trained with a data engine aimed at rare poses [S] | no (per image) | MHR body + hands [S]; converts to SOMA [S] | SAM License, commercial OK [S] | Meta's copy manual-gated; same-size files ungated in `nvidia/GEM-X` [M] | runs inside the GEM-X environment [I] |
| 3 | **GVHMR** (Zhejiang Univ., SIGGRAPH Asia 2024; TPAMI 2026) | widely used to lift martial-arts and web video (KungfuAthlete, HY-Motion) [S]; jitters on fast limbs, and smoothing that jitter shrinks swings [S, secondary] | yes; handles camera turns (SimpleVO), `-s` for fixed cameras [S] | SMPL-X body, no hands [S] | educational, research and non-profit only / same; plus SMPL-X licence [M, S] | **SMPL + SMPL-X registration** [S] | community Windows fork exists (unreviewed) [S]; trained on 2x 4090 [S] |
| 4 | GEM-SMPL / GENMO (NVIDIA, ICCV 2025) | generative, video + text conditioning [S] | yes [S] | SMPL [S] | NVIDIA OneWay Noncommercial: "research or evaluation purposes only" [M] | SMPL registration [S] | Linux scripts [S] |
| 5 | WHAM (CVPR 2024) | behind GVHMR on the published benchmarks [S, secondary] | yes (DPVO / DROID-SLAM) [S] | SMPL [S] | MIT / SMPL licence [M] | SMPL + SMPLify registration [S] | DPVO CUDA build [S] |
| 6 | TRAM (ECCV 2024) | strong on moving cameras, metric scale [S] | yes, with masked DROID-SLAM [S] | SMPL [S] | MIT / SMPL licence [M] | SMPL + SMPLify registration [S] | DROID-SLAM build [S] |
| 7 | DuoMo (Meta, CVPR 2026) | newest; claims 16% lower world error on EMDB, 30% on RICH [S, abstract] | yes, but no SLAM in the release [S] | mesh vertices, SMPL-X assets [S] | Meta XRCIA Noncommercial Research [M] | SMPL-X registration [S] | conda + pytorch3d build [S] |
| 8 | PromptHMR-Video (CVPR 2025) | BEDLAM2 checkpoints [S] | yes (DROID-SLAM, Metric3D) [S] | SMPL-X [S] | Meshcapade "non-commercial scientific research" [M] | SMPL-X registration [S] | Linux install script [S] |
| 9 | 4D-Humans / HMR 2.0 (2023) | per frame with tracking [S] | no (camera space) [S] | SMPL [S] | MIT / SMPL licence [S] | SMPL registration [S] | superseded [I] |
| 10 | CoMotion (Apple, 2025) | multi-person, online [S] | not checked | SMPL [S] | Apple sample-code + model licence (not read) | SMPL registration [S] | not checked |
| – | Hosted apps (Rokoko Vision, Move.ai, DeepMotion, Plask, QuickMagic) | – | – | – | per service | accounts | out: account creation is Dex's call |

For our use, only GEM-X and SAM 3D Body are usable without any sign-in and with licences that
fit a public site. GVHMR fits only under the non-profit reading and after Dex registers.
Numbers 4 to 8 are research-only licences, so they're out for anything that ships.

### 1. GEM-X (NVIDIA): the pick

- **What it is** [S, model card]: a 12-layer transformer that takes per-frame image features
  (from SAM 3D Body), the person's box and the camera's focal length, and regresses the
  motion in one pass (no diffusion, no sampling). Longer clips run through a sliding
  120-frame window.
- **Training** [S, model card]: only synthetic video. NVIDIA rendered 350,000 Bones RigPlay mocap
  sequences on about 4,000 CG characters over HDRI backgrounds. `MODELS.md` cites NVIDIA's
  SONIC paper, trained on the same capture library: 50,162 of 317,189 clips are "Combat
  (sword, martial arts, and more)" [S]. That's the best hint that polearm-like motion is in
  its experience. Training on rendered CG characters may even suit game footage better than
  real-video models [I, untested].
- **Quality evidence:** only NVIDIA's internal synthetic test, 115.2 mm world-space joint error
  [S]. No independent test on fast motion exists that I could find [S, search]. The card's own
  limits: SLAM errors from "fast camera motion, textureless environments, or motion blur";
  "unusual clothing, heavy occlusion, or non-standard body proportions" may fail silently [S].
- **Open issues that matter to us** [M, GitHub issues read 2026-09-28]:
  - #24: nothing in the repo writes a real camera trajectory, so "dynamic-camera video silently
    falls back to a static trajectory". Use fixed-camera clips.
  - #26: "Tracking failure and limb swapping when foot elevation exceeds hip height". That's
    N4's vault and any high kick.
  - #27: unstable motion when the hands are fairly still and the feet move hard.
  - #20: README says hands and face; the released config removes fingers and the card says no
    face.
  - #17: exported BVH has a wrong rest pose (one reply routes it through Kimodo to fix it).
  - #29: one of the demo's video writers is hard-coded to 30 fps whatever the input rate.
  - #28: a crash while setting up the SOMA body model after the assets download.
  - #2: a user posted scripts to import the result into Blender as armature plus mesh.
- **Downloads** [M, Hugging Face API and `gem/utils/hf_utils.py`]: the demo fetches everything
  from the ungated `nvidia/GEM-X`: `gem_soma.ckpt` 541.8 MB, `vitpose.pth` 3,388.5 MB,
  `sam3d_body.ckpt` 2,109.1 MB, `mhr_model.pt` 696.1 MB, plus tiny config and scale files
  (about 6.74 GB). SOMA body assets come from `nvidia/SOMA-X`, ungated, Apache-2.0, 0.87 GB for
  the whole repo. Skip the rest of `nvidia/GEM-X` (32.4 GB in total: GEM-SMPL, ONNX copies,
  evaluation data).
- **Licences** [M]: code Apache-2.0; model under the NVIDIA Open Model License (version dated
  2025-10-24): commercial use allowed, "NVIDIA claims no ownership rights in outputs", notice
  required only when redistributing the model [S]. Its bundled SAM 3D Body is under Meta's SAM
  License (see ATTRIBUTIONS.md).
- **Input rights** [S, model card]: "Users are responsible for ensuring they have proper rights
  and permissions for all input video content", and it must not process video of people
  "without appropriate legal authorization and, where required, explicit consent". Motion
  Actor grants tracing on its channel; the other real-world clips don't grant anything, which
  is one more reason they stay private study.
- **Running it here:**
  - The card lists Linux only [S]. The repo's Dockerfile builds on
    `nvidia/cuda:12.6.0-devel-ubuntu22.04` [M].
  - Docker Desktop 29.5.3 is running with an `nvidia` runtime registered and its data on D:
    [M]. A GPU container hasn't been tried.
  - The ONNX demo (`demo_soma_onnx.py`) swaps detectron2 for a bundled YOLOX + ByteTrack
    detector [M], which removes the hardest Windows build step. It forces EGL rendering by
    default [M], so a native Windows run would need that render step changed or skipped [I].
  - The WSL2 Ubuntu here is named for another project (`DexCodeFrontier-Ubuntu-24.04`) [M], so
    keep this work out of it [I].
  - One user reports it needs more than 8 GB of video memory [S, secondary]; the 4090 has 24 GB.
- **Disk estimate** [I]: 6.74 GB weights + up to 0.87 GB SOMA assets + a CUDA/PyTorch
  environment (5 to 10 GB, more if Docker). Roughly 13 to 18 GB.

### 2. SAM 3D Body (Meta): key poses from single frames

- **What it is** [S]: a single-image model for the whole body including feet and hands,
  output on Meta's Momentum Human Rig (MHR). Takes optional 2D keypoint or mask prompts, so a
  wrong limb can be nudged by hand.
- **Why it's useful for us** [I]: pose-to-pose means we need a handful of exact poses per
  move, not a continuous track. One strong image model on the exact coil, contact and
  follow-through frames beats smoothing a jittery track. It also works on a paused game frame,
  which gives a pose reference rather than a copied motion track (still derived from their
  art, so still study only for game footage).
- **Downloads** [M]: Meta's repos (`facebook/sam-3d-body-dinov3`, `-vith`) are `gated:
  manual`. `nvidia/GEM-X` carries `sam3d_body.ckpt` and `mhr_model.pt` at exactly the same
  byte sizes as Meta's dinov3 `model.ckpt` (2,109,129,346) and `mhr_model.pt` (696,110,248),
  ungated. That they're the same weights is my inference from the sizes and GEM-X's
  ATTRIBUTIONS [I].
- **Licence** [S]: SAM License: use, modify, redistribute with the licence; no military,
  nuclear, espionage or weapons end uses. A fictional glaive in a sprite isn't that [I].
- **To SOMA** [S]: SOMA-X ships `python -m tools.mhr2soma` with smoothing presets.

### 3. GVHMR: the proven second opinion

- **What it is** [S]: SIGGRAPH Asia 2024, extended in TPAMI 2026. Estimates motion in a
  "gravity-view" frame so it doesn't drift vertically. It estimates how the camera turns with
  its own SimpleVO by default (DPVO optional); `-s` declares a fixed camera.
- **Track record** [S, secondary]: beat WHAM on RICH (78.8 vs 109.9 mm world-aligned error) and
  EMDB (111.0 vs 135.6 mm). Used to lift kung fu videos for the KungfuAthlete dataset (whose
  notes say weapon moves carry only "overall movement", no weapon or hand detail) and 12 M web
  clips for Tencent's HY-Motion training set.
- **Weak spots on fast motion** [S, secondary]: 3D jitter comes from 2D keypoint noise; one
  developer found strong smoothing removed about 40% of the arm-swing size; another paper
  filters its output for sudden orientation jumps (which matters for spins). The TPAMI version
  adds foot and hand "stationary" labels and claims better fast-motion results, but the README
  still lists only the 2024 checkpoint `gvhmr_siga24_release.ckpt` [M].
- **Licence** [M, LICENSE]: "educational, research and non-profit purposes only. Any
  modification based on this work must be open-source and prohibited for commercial use."
  SMPL-X's own licence allows "non-commercial scientific research, non-commercial education,
  or non-commercial artistic projects" and bans redistribution [S, SMPL-X licence page].
- **Dex-needed:** create accounts at `smpl.is.tue.mpg.de` and `smpl-x.is.tue.mpg.de`, accept
  the licences, download `SMPLX_{GENDER}.npz` and `SMPL_{GENDER}.pkl` himself. Copies floating
  on Hugging Face or GitHub are redistributions the licence forbids; don't use them.
- **Other checkpoints** [S]: Google Drive folder (GVHMR, HMR2, ViTPose-H, YOLOv8x, DPVO), no
  sign-in; total size not measured. YOLOv8 is Ultralytics code (AGPL-3.0) [I, not rechecked].
- **Windows** [S]: a community fork (`t96361765-byte/GVHMR`) says it adds a Windows 11 guide with
  SMPL-X NPZ output and FBX export through Blender; its `docs/WINDOWS.md` returned 404 when I
  checked [M]. Unreviewed.

### Differences from `MODELS.md`

Three GEM-X points in `MODELS.md` read more optimistically than today's evidence [M]:

- It says GEM-X outputs "77 joints including hands and face". The released config drops
  fingers and the card says no face (issue #20).
- It says "a moving camera is fine". In the public code the moving-camera path falls back to
  a fixed camera without warning (issue #24).
- SOMA body asset size was "not measured": `nvidia/SOMA-X` is 0.87 GB, ungated, Apache-2.0.

## Reference clips

### How they were checked [M]

For each video I read its metadata (length, frame rate, resolution, licence field, chapters)
and its storyboard previews. The previews come about one per second for clips under 2
minutes, one per 2 s for 3- to 4-minute clips and one per 5 s for 8-minute ones, so
timestamps below are good to about that step. I didn't watch the videos with sound or at full rate.
Every video here carries YouTube's standard licence; none is Creative Commons.

What makes a clip good for capture, in order: one person, fixed camera, whole body in frame
the whole time, no effects over the limbs, 60 fps, plain background, and a side-on or
three-quarter view. The rights column uses MOTION-SOURCES' language: **ship-OK** means the
owner allows tracing for our kind of use; **study** means it stays in `review/motion/`.

### The shortlist: 11 segments, best capture first

The table ranks clips by how well they'll capture and how closely they match a Rosace move.
Notes on each follow.

| # | Clip | Segment(s) | Feeds | Capture | Rights |
|---|---|---|---|---|---|
| 1 | Motion Actor, "擬似眉刃" blade windmill | 0:00–0:21, 0:23–0:50, 0:53–1:29 | N3 twirls, Q overhead twirl, N5 coil | excellent | ship-OK if non-profit |
| 2 | Motion Actor, "渦潮弾き" whirlpool | 0:00–0:14, then more takes to 1:30 | Q twirl and stamp, N3, R | excellent | ship-OK if non-profit |
| 3 | Motion Actor, "退き突き薙ぎ払い" retreat, thrust, mow down | 0:00–0:09 (repeats 0:11–0:16, 0:19–0:32, 0:35–0:39) | Aspersion, N1/N2 low sweep | excellent | ship-OK if non-profit |
| 4 | Motion Actor, "ジャンピングスピアー" jumping spear (female performer) | 0:00–0:03, 0:06–0:09, 0:12–0:22 | N4 vault and drop, R's snap drop | good | ship-OK if non-profit |
| 5 | Motion Actor, "大なぎ払い" big mowing sweep | 0:00–0:12 | N2 pivot sweep, N5 360° sweep | good | ship-OK if non-profit |
| 6 | Motion Actor, "薙槍" mowing spear | 0:00–0:17 | N1 scoop, N2 | good | ship-OK if non-profit |
| 7 | Ikari Dojo, Kukishin-ryū naginata kata (slow motion) | 1:35–2:01, 2:32–2:50, 2:50–3:20 | N1/N2 low sweeps, N4 overhead drop, Aspersion | good | study |
| 8 | Pan Hongshen, guandao (2023 national championships) | 0:20–0:47, 1:02–1:33 | real-weight glaive timing for N2, N5, Q; robe | fair to good | study |
| 9 | Arknights: Endfield, Operator Combat Demo: Lifeng | 0:13–0:15, 0:17–0:24, 0:28–0:31 | N1–N5 rhythm, R ring | fair | study |
| 10 | Zenless Zone Zero, Agent Combat Intel: Tsukishiro Yanagi | 0:13–0:16, 0:19–0:22, 0:26–0:28 | string rhythm, EX timing | poor | study |
| 11 | Arknights: Endfield, Operator Combat Demo: Camille | 0:15–0:17, 0:26–0:28, 0:43–0:44 | polearm twirl into a pose | poor to fair | study |

**1. Blade windmill** — https://www.youtube.com/watch?v=F2nStU9Wqck

- Motion Actor Inc, uploaded 2024-04-19, 1:30, 1080p at 60 fps [M]. The on-screen caption calls
  it "blade windmill"; 眉刃 is the Chinese glaive family [I].
- Three takes, separated by one-second close-ups at 0:22 and 0:51–0:52 [M]. Two-handed pole
  windmills in front, overhead and behind the back; a knee-lift pivot near 0:04; low lunges
  around 0:11, 0:17 and 0:20 [M].
- Camera: fixed, front to three-quarter; body about half the frame height; black clothes
  against a light wall [M]. The performer turns, so some stretches are side-on.

**2. Whirlpool** — https://www.youtube.com/watch?v=-iJ_d5z5m3o

- Motion Actor Inc, 2023-12-17, 1:40, 1080p60 [M].
- First take 0:00–0:14: vertical wheels at the side of the body, overhead spin, then the pole
  planted upright at 0:09–0:12, which is a good reference for Q's stamp [M, I]. Further takes
  run to 1:30, cut by brief close-ups (for example 0:15, 0:48, 1:31) [M].
- Same studio and framing as #1; orange top, easy to separate from the wall [M].

**3. Retreat, thrust, mow down** — https://www.youtube.com/watch?v=H9C2IemTkzM

- Motion Actor Inc, 2023-09-24, 1:11, 1080p60 [M].
- 0:00–0:09 near side-on: a back-step, a full-extension thrust (0:01–0:03), a wide low mow
  (0:03–0:05), recoil to guard (0:06–0:09). Repeats at 0:11–0:16, 0:19–0:32 and 0:35–0:39,
  with close-ups between [M].
- The thrust-through into a sweep is Aspersion's shape (MOVESET section 2) [I].

**4. Jumping spear** — https://www.youtube.com/watch?v=qO_l86zXvxo

- Motion Actor Inc, performer Yamashita Sayo, 2024-01-14, 1:08, 1080p at 30 fps [M].
- 0:00–0:03 standing leap and downward plunge into a crouch; 0:06–0:09 run-up leap and plunge;
  0:12–0:22 step onto a box, leap off, plunge, rise [M]. Side-on, fixed camera, wide gym;
  body about a third of the frame height [M].
- The only female performer in the shortlist; her weight and proportions are closer to
  Rosace's [I]. 30 fps means more blur on the leap [I].

**5. Big mowing sweep** — https://www.youtube.com/watch?v=yeOMbxdKv6o

- Motion Actor Inc, performer Hiroaki Tanaka, 2023-02-03, 0:53, 1080p60 [M].
- 0:00–0:12 continuous; closer framing at 0:13 and 0:16, then more takes [M]. Near side-on,
  grey studio; dark clothes on grey is lower contrast than #1–#3 [M].

**6. Mowing spear** — https://www.youtube.com/watch?v=lxy4EunNTWc

- Motion Actor Inc, Hiroaki Tanaka, 2022-05-28, 1:32, 1080p60 [M].
- 0:00–0:17 continuous sweeps and turns, close-up at 0:18–0:19, further takes after [M].

**7. Kukishin-ryū naginata kata, slow motion** — https://www.youtube.com/watch?v=Kd_z675zf_o

- Ikari Dojo, 2025-08-13, 4:11, 1080p at 30 fps [M]; the title says slow motion [S].
- Chapters [S, video chapters]: Kasumi Harai "Mist Sweep" 1:35–2:01; Raijin Otoshi "Thunder
  God Drop" 2:32–2:50; Tsukomi Harai "Thrusting Sweep" 2:50–3:20. Others: Tenchi Arashi
  0:00–0:21, Kaminari no Mai 0:21–0:46, Sashi Gaeshi 0:46–1:07, Ryūsui Gaeshi 1:07–1:35,
  Kasane Giri 2:01–2:32, Hashira Otoshi 3:20–3:46, Ura no Mai 3:46–4:11.
- Side-on the whole way, outdoors, near-fixed camera; two people, naginata on the left; body
  about 40% of the frame height [M]. Crop to the left performer before capture [I].
- The only clip showing the real naginata grip: the rear hand slides along the haft on the
  big cuts [I]. Slow motion loses real timing, which we set ourselves anyway [I].

**8. Guandao, Pan Hongshen** — https://www.youtube.com/watch?v=feggAzQWc4U

- blue hippo films, 2023-03-28, 1:58, up to 2160p at 30 fps [M]. A guandao is a Chinese glaive.
- One continuous routine; densest spins and jumps 0:20–0:47; turning sweeps and low stances
  1:02–1:33 [M].
- Side-on, the camera pans to follow him (so use GVHMR or accept a wrong root path from GEM-X);
  body about a third of frame height; long robe over the legs [M, I].
- Best real-speed timing for a heavy glaive, and the robe is a cloth reference for her
  habit [I].

**9. Endfield, Lifeng** — https://www.youtube.com/watch?v=_15zxxf2ucM

- Arknights: Endfield official, 2026-01-18, 0:39, 1080p60 [M].
- 0:13–0:15 battle skill: a whole-body polearm swing with a gold arc, three-quarter view.
  0:17–0:24 basic string and "Finisher", whole body at mid distance, moderate effects.
  0:28–0:31 ultimate ring around him [M].
- Stable gameplay camera, a few cuts; the character is small in frame [M].

**10. ZZZ, Yanagi** — https://www.youtube.com/watch?v=9N_o6OwOyd0

- Zenless Zone Zero official, 2024-10-29, 0:53, 1080p60 [M].
- 0:13–0:16 basic string; 0:19–0:22; 0:26–0:28 EX special [M]. Blue lightning covers her,
  enemies overlap, cuts every 1 to 3 s [M]. Good for rhythm, poor for capture.

**11. Endfield, Camille** — https://www.youtube.com/watch?v=pmsO8tUZ9Z8

- Arknights: Endfield official, 2026-06-24, 0:57, 1080p60 [M].
- 0:15–0:17 a polearm twirl into a held pose, close and whole body; 0:26–0:28; 0:43–0:44.
  Heavy red effects between [M].

### Checked and not recommended for capture

Each of these was checked the same way. The times mark where combat appears, for timing study.

| Video | Where combat appears | Why not |
|---|---|---|
| ZZZ, Yanagi Character Demo "99+ To-Dos" (`UcjFp9_0flo`, 30 fps) | 1:34–1:37 | story short; combat is a few cut-up seconds [M] |
| Genshin, Raiden Shogun demo (`mvrW4aKwAXw`) | 1:04–1:12, 1:40–1:57 | purple lightning over everything, fast cuts [M] |
| Genshin, Xiao "Doombane" (`sjozpa9DsZU`) | 0:20–0:33, 1:19–1:23 | one-second shots, green effects [M] |
| Genshin, Hu Tao (`qrH9vMZBwAk`) | 0:36–0:46, 1:12–1:19 | fire effects, cuts [M] |
| Genshin, Arlecchino "Lullaby" (`TnYFVP3c_bs`) | 0:59–1:15, 2:06–2:12 | red effects, dark, cuts [M] |
| Genshin, Flins "Nocturne Sentinel" (`bxya0iOjQMk`, 30 fps) | – | a 2D-animated stylised trailer, no 3D gameplay [M] |
| Wuthering Waves, Jiyan showcase (`wnxtQsHOy1k`) | 0:45–0:57, 2:50–3:18 | dark cinematic, heavy effects [M] |
| Wuthering Waves, Cartethyia Combat Showcase (`P9dUQPIEdFs`, 30 fps) | 0:22–0:33, 0:47–1:10 | heavy effects, cuts [M] |
| Honkai: Star Rail, Dan Heng • Imbibitor Lunae (`Dbc6E41mHdo`, 30 fps) | 0:31–0:45 | water-effect cinematic [M]; a turn-based game has no free-moving attacks anyway |
| Endfield, Liino (`kTHEqpvUnzA`) | 0:15–0:42 | purple effects over the body [M] |
| Guillaume Erard's 4K 60 fps kobudo recordings (Tendō-ryū `JdzSJbGr-zY`, Toda-ha Bukō-ryū `s2N9jCKfdO4`, Yōshin-ryū `GjmIGExq0OY` and others) | whole videos | wide hall shots with many pairs at once, or overlapping performers [M]. Yōshin-ryū (women in kimono with naginata) is a good sleeve and hakama reference for her cloth |
| IWUF Men's Qiangshu, Tomoya Okawa (`XUx21RiBDZI`, 25 fps) | whole routine | broadcast cuts and pans [M] |
| Motion Actor long-weapon compilation (`RYBRn88IGBM`) | – | cuts every ~5 s; use it as an index to pick single videos [M] |
| Motion Actor "Relieving stress", Mao (`MDfTuCq_F-Q`) | – | two people, small in a wide studio [M] |

### Motion Actor's terms [M]

The channel description, read today, in Japanese: 「チャンネル内の動画はトレスフリー・アレンジフリーですが、
営利目的での利用・転載・販売等は禁止とさせていただいております。」 That is: its videos are free to
trace and rearrange, but use for profit, reposting and sale are prohibited. The English text
under it says "Feel free to trace, reference, and modify the artwork for personal use.
However, any commercial use, redistribution, re-uploading, or sale of the content is
prohibited." The Japanese is the looser of the two: it bans profit-making use, not all
non-personal use [I]. MOTION-SOURCES already flags this channel for the donation question.
Raw video and extracted motion files stay out of the repo either way (no redistribution).

## Download plan, for approval

Video-only streams (no audio needed), sizes from the metadata [M]. Fetching only the listed
segments with `--download-sections` makes them smaller still.

| # | Video id | Format | Size |
|---|---|---|---|
| 1 | `F2nStU9Wqck` | 1080p60 H.264 (299) | 50.3 MB |
| 2 | `-iJ_d5z5m3o` | 1080p60 H.264 (299) | 59.8 MB |
| 3 | `H9C2IemTkzM` | 1080p60 H.264 (299) | 31.3 MB |
| 4 | `qO_l86zXvxo` | 1080p30 H.264 (137) | 11.5 MB |
| 5 | `yeOMbxdKv6o` | 1080p60 H.264 (299) | 20.4 MB |
| 6 | `lxy4EunNTWc` | 1080p60 H.264 (299) | 36.0 MB |
| 7 | `Kd_z675zf_o` | 1080p30 H.264 (137) | 128.4 MB |
| 8 | `feggAzQWc4U` | 2160p30 AV1 (401) | 62.4 MB |
| 9 | `_15zxxf2ucM` | 1080p60 H.264 (299) | 25.6 MB |
| 10 | `9N_o6OwOyd0` | 1080p60 H.264 (299) | 33.2 MB |
| 11 | `pmsO8tUZ9Z8` | 1080p60 H.264 (299) | 39.1 MB |

Total about 0.5 GB, into `review/motion/<video_id>/`, each logged in `THIRD_PARTY.md`.

## First capture test, once approved [I]

1. Clips #1 (0:00–0:21), #3 (0:00–0:09) and #4 (0:06–0:09): a spin, a side-on sweep and a leap.
2. GEM-X with `--static_cam`; SAM 3D Body on six hand-picked frames (coil, contact and
   follow-through for #1 and #3).
3. Look at GEM-X's own overlay videos (`0_kp2d77_overlay.mp4`, the in-camera mesh) frame by
   frame; count limb swaps; check the wrists stay on the pole at contact frames.
4. Retarget to Seed-san, render side-on, and put it next to the source at the MOVESET drawing
   frames.
5. Pass: no limb swaps, and the key drawings read correctly after only pose pushing. If GEM-X
   fails on the leap (#4, issue #26 territory), that's where GVHMR earns Dex's registration.
6. Don't smooth hard: smoothing that removes jitter also shrinks the swings [S, secondary].
   Keep only key frames and re-key the rest.

## What Dex needs to decide or do

1. **Approve the downloads** above (about 0.5 GB, into the git-ignored `review/motion/`).
2. **Motion Actor and the donation button:** is dex.place "not for profit" under their
   terms? If yes, clips #1–#6 can feed shipped motion. If no, they drop to study, and Dex's own
   footage becomes the only shippable video input.
3. **Game clips stay study-only** (recommended). Capturing a studio's animation and shipping it
   is the "traced from someone else's game" case MOTION-SOURCES rates high risk.
4. **Only if we want GVHMR:** register at `smpl.is.tue.mpg.de` and `smpl-x.is.tue.mpg.de` and
   download the body model files himself. Agents can't create accounts.
5. **Optional, the best input of all:** film the moves with a broom or pole. Side-on, plain
   wall, whole body in frame for the whole move, 60 fps if the phone can, a fixed phone
   (tripod or propped), fitted clothes so the knees and elbows show.

## Not verified yet

- Any of these models running on this PC. Nothing is installed.
- GPU passthrough in Docker Desktop, and GEM-X's ONNX demo on native Windows.
- GEM-X and SAM 3D Body on game footage and on anime proportions.
- How GEM-X handles a pole vault or 360° spins (issues #26 and #27 suggest trouble).
- Whether GEM-X's bundled SAM 3D Body file is byte-identical to Meta's (only the sizes match).
- GVHMR's Google Drive checkpoint sizes, and whether a TPAMI checkpoint is public.
- The timestamps are from 1–5 s preview frames, not from watching at full rate. Scrub each
  segment once before capturing.

## Sources (checked 2026-09-28)

- GEM-X: github.com/NVlabs/GEM-X (README, docs/INSTALL.md, docs/DEMO.md,
  docs/RELATED_PROJECTS.md, ATTRIBUTIONS.md, LICENSE, Dockerfile, CHANGELOG.md,
  scripts/install_env.sh, scripts/demo/demo_soma.py, demo_soma_onnx.py, retarget_utils.py,
  gem/utils/hf_utils.py, sam3db_extractor.py; issues #2, #17, #20, #24, #26–#29);
  huggingface.co/nvidia/GEM-X (model card, file list via API); CEB Studios Patreon post "GEM-X
  with SOMA-retarget" and the gem-x.cpp port (via search).
- GENMO / GEM-SMPL: github.com/NVlabs/GENMO (README, LICENSE); arxiv.org/abs/2505.01425;
  research.nvidia.com/labs/dair/gem.
- SOMA-X: github.com/NVlabs/SOMA-X (README, docs/tools.md, repo tree);
  huggingface.co/nvidia/SOMA-X (API). SOMA Retargeter: github.com/NVIDIA/soma-retargeter. Kimodo:
  github.com/nv-tlabs/kimodo (README, repo tree), Kimodo install docs.
- NVIDIA Open Model License: nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license.
- SAM 3D Body: github.com/facebookresearch/sam-3d-body (README, LICENSE);
  huggingface.co/facebook/sam-3d-body-dinov3 and -vith (API).
- GVHMR: github.com/zju3dv/GVHMR (README, docs/INSTALL.md, LICENSE, issue #85);
  github.com/t96361765-byte/GVHMR (README); search summaries of the GVHMR paper and TPAMI
  version, KungfuAthlete, KungfuBot, "Go to Zero", FactorizedHMR, NomaDamas/CozyClay issue #408.
- SMPL-X licence: smpl-x.is.tue.mpg.de/modellicense.html.
- WHAM, TRAM, 4D-Humans, PromptHMR, DuoMo, CoMotion, NLF: each GitHub README and LICENSE
  (DuoMo's LICENSE.pdf read as text); GitHub API for dates and licence fields; DuoMo abstract
  (arxiv.org/abs/2603.03265) via search.
- Endfield polearm roster: Mobalytics and Game8 polearm lists (via search).
- Every video: `yt-dlp --dump-json` metadata and YouTube storyboard previews, tiled by
  `tools/motion-ai/storyboard_sheet.py` into `review/motion/_storyboards/<id>/`. Motion Actor
  channel list and description via yt-dlp.
- This PC: `nvidia-smi`, `wsl -l -v`, the Lxss registry keys, `docker info`, `df`.
