# Handoff: read this first

This file is for any new session, cloud or local, that is asked to "read the repo, say where
we're at, what we're working on, and continue". It is kept current by the coordinating
session on Dex's PC; the moving parts live in `docs/handoff/STATUS.md` on the `pc-sync`
branch (below).

## 1. Where the work is

| Branch | What it holds | Who writes it |
|---|---|---|
| `main` | The live site. The PC's deploy puller builds `main` every 30 s and serves it at https://dex.place (failed builds never go live). | Verified changes only. |
| `pc-sync` | **Everything in progress on Dex's PC**, auto-pushed every 10 min by a scheduled task, even when no agent is running. Adds `docs/handoff/`: `STATUS.md` (live lane status), `workflows/` (the orchestration scripts), `memory/` (the agent's notes on how Dex works), `media/` (our own character renders). | The PC only (`ops/pc-sync.mjs`). Never push to it. |

**To continue in the cloud:** `git fetch origin pc-sync && git checkout -b cloud/<topic> origin/pc-sync`,
read `docs/handoff/STATUS.md`, then work on your `cloud/<topic>` branch. Changes that are verified
(build + `npm test` + an independent check) may be merged to `main`, which deploys them live.
Tell Dex what you merged.

## 2. The project in one paragraph

dex.place is Dex's site: a dark full-pixel website (live) plus a side-scrolling pixel world at
`/world/` where the player character, Rosace, walks a story route whose rooms hold the site's
real content (downloads, docs, gallery, donate). Content is frozen in `CANON.md`; only the
execution is being rebuilt. Rules for every agent are in `AGENTS.md`. Dex steers taste and
direction; agents build, critique each part blind against his references, and iterate.

## 3. Workstreams and state (2026-09-29, evening)

**Website: live.** Commit `4b8416e` "Website: dark full-pixel rework". Passed an independent
release check at 8.8/10 (phone LCP under 2.5 s everywhere, 0 a11y violations, VietQR
verified). Small follow-ups, none blocking: single-artwork pages (`/gallery/NN/`) have no
tablet/desktop size cap (11 s on a slow-4G tablet); desktop `/gallery/` LCP 2.52 s; an
`aria-label` on docs `<pre>` without a role; `/gallery/05/` shows "09 / 09".
Docs: `docs/site/`.

**World (phase 2): built, in release check.** All 21 rooms of `docs/world/WORLD-PLAN.md`,
the story ("The Round"), shortcuts, saves, storm, sound, props engine. A bot plays the whole
round in 531 s with every story beat and 0 errors; the integration critic passed it at 8.
Was running at handoff: a cross-lane fix pass (sound patch, lightning white-out on the player,
bench sitting, archive doc links, quiet sprite probe) and an independent release check. When it
passes, commit `src/world`, `src/pixel`, `src/scenes`, `docs/world`, `docs/props`,
`public/audio/world` to `main` and verify `/world/` live. Pending for Dex only: real-device
Samsung/iPad runs, a laptop GPU check, a listening pass. Docs: `docs/world/RUNTIME.md`.

**Character, Rosace: the main push. Target 9/10 (parity with Dex's references); she is at
about 5.8.** Design: `docs/character/DESIGN.md` (revision 3.5 at the top is Dex's latest
direction: seductive-elegant pose, wider stance, bigger/more prominent bust, 1 px black thong
string). How she is built: `docs/character/PIPELINE.md` (3D base -> Blender headless ->
pixel stills at 144 px close-up and 80 px world size). How to draw and judge her:
`docs/character/ART-RULES.md` + `art-rules/` (face, figure, pixel, pose, finish-gap, 190+
checklist rules), `CRITIQUE-PARAMS.md` (31 params), `QUALITY-RUBRIC.md`.
History: every route plateaued near 5.7 (3D route, 2D artist-construction route, per-part
artistry pass). Blind bake-off findings: a bigger head and eyes (x1.10) helps; bigger cloth
shapes are neutral; a painterly finish lost (it washed out her colours). Measured top levers
(`art-rules/finish-gap.md`): a chroma budget (calmer big areas), the new pose, richer tone
steps on skin and darks. The "drive to 9" run was looping the whole character with blind
critics and escalations (push levers +30%, then hand-authored pixel paint-over on key stills,
then recombine). Its results are in `docs/handoff/STATUS.md`.

**Motion.** NVIDIA Kimodo (text/keypose to motion) and GEM-X (video to motion), retargeted
and retimed with timing sheets; hand-posed hero keys scored 6.0-6.2. Waiting to re-render on
the final model. `docs/character/MOTION-SOURCES.md`, `tools/motion-ai/`.

## 4. What only the PC can do

- **Anything that renders Rosace.** The 3D base (SiroinoSotai CC0 body + an MMD head whose
  terms don't allow redistribution) and all `.blend` builds live outside the repo in
  `D:\Dex\Projects\dex-place-art`. Blender 5.1.2 runs headless there. A cloud session can
  edit the pipeline code, rules and docs, and judge renders already in the repo
  (`docs/handoff/media/` on `pc-sync`), but cannot produce new character renders.
- Kimodo/GEM-X (GPU and model weights on the PC), the deploy puller, Windows Credential Manager
  secrets.
- Reference images (third-party art) stay in the git-ignored `review/` on the PC and are never
  committed.

A cloud session can do: website and world code (Node + Vite + Playwright), docs, rules,
critique of committed images, planning the next character levers, and the website follow-ups.

## 5. Hard rules (from Dex; they override convenience)

- **No image generation of any kind** (no GPT image, Higgsfield, SD, generative add-ons).
  Assets are authored: rendered from our own 3D model, or pixel data written in code.
- **Critique every part separately, blind against his references,** until critics split 50/50
  or prefer ours. The bar: "a 3D gacha player would see her and consider donating." Never
  report one overall score without the per-part breakdown.
- **Never commit** secrets, third-party reference images, or third-party model files. The repo is
  public.
- **HoYoverse/Kuro official models may not be used for parts** (their terms forbid it).
- **`main` is live.** Unfinished is fine; broken is not. Verify before merging.
- Talk to Dex plainly: answer first, evidence under it, define terms, no walls of numbers
  without a sentence saying what they mean. He is warm and direct and fine with casual
  swearing.
- Commit or push only what the task needs; say what you pushed.

## 6. Where to look next

1. `docs/handoff/STATUS.md` on `pc-sync`: which lanes were running, their latest scores and
   verdicts, and the driver's resume notes.
2. The doc of the workstream you pick (above).
3. `docs/handoff/workflows/` on `pc-sync`: the orchestration scripts, useful as patterns for
   critic loops, blind A/B sheets and escalation.
