# Local audio: controls, atmosphere and user evidence

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. Research stays dated. Recheck providers/credits before new work, preserve the default reserved ElevenLabs budget and do not infer voice transport from local audio-model availability. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

Revision 0.5 · 2026-09-06 · Research only. No models were installed, downloaded, launched or used to generate audio in this pass.

**CONFIRMED:** Dex prioritizes controllability and atmosphere over award-winning song quality, wants actual user experience, and prefers to preserve ElevenLabs credits for other media projects. **PROPOSED DEFAULT:** local-first soundtrack production, with zero default ElevenLabs allocation for dex.place unless Dex changes that reservation. The older cloud budgets in12 remain comparisons, not the default production route.

## Practical recommendation

Start with **ACE-Step 1.5 XL-SFT** for controlled instrumental drafts on this Windows workstation. Keep **Stable Audio 3** as the second atmospheric/audio-editing candidate; its Small-SFX model is particularly relevant to ambience and foley. This is a fit judgment from capabilities and user reports, not a listening-test winner on Dex's machine.

The website still plays finished exported files. A local music model runs only during authoring, outside the public website. Start with one selected checkpoint/runtime; do not download every variant, train a LoRA, or build a new music app before obtaining one useful cue.

## Primary-source capability comparison

| Candidate | Useful controls | Limits and practical role |
|---|---|---|
| ACE-Step 1.5 XL-SFT | BPM, key/scale, time signature, duration, instrumental setting, seed, reference audio, cover, region repaint and CFG | First drafting candidate. The XL family is a real April 2026 release; dedicated metadata does not guarantee exact notes/chords. |
| ACE-Step XL-Base | Adds Extract, Lego and Complete tasks | Add only if stem/arrangement editing specifically needs it; SFT/Turbo do not support those tasks. |
| ACE-Step XL-Turbo | Fast low-step generation | CFG is overridden to1. Speed is not additional control; not the initial quality/control-first choice. |
| Stable Audio 3 Medium | Duration/seed, audio-to-audio strength, regional inpainting and continuation; instrumentals and sounds |380-second capacity. BPM/key are prompt text. Post-trained variants ignore CFG/negative prompts; base variants expose them with more sampling work. |
| Stable Audio 3 Small / Small-SFX | Smaller music and SFX models,120-second capacity | Relevant to48-second cues and short sounds. Actual quality/import still untested here. |

Sources: [ACE repository](https://github.com/ace-step/ACE-Step-1.5), [XL-SFT card](https://huggingface.co/ACE-Step/acestep-v15-xl-sft), [ACE inference controls](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INFERENCE.md), [Stable repository](https://github.com/Stability-AI/stable-audio-3), [Stable inference](https://github.com/Stability-AI/stable-audio-3/blob/main/docs/workflows/inference.md).

Check licenses for the exact checkpoint and supporting components. The reviewed ACE XL-SFT card identifies MIT; do not copy an old article's license label to every artifact. Stable uses its Community License with an annual-revenue enterprise threshold; the repository's code license alone is not the model-use contract.

## Actual user reports

| Source / date | Reported experience | Limit and relevance |
|---|---|---|
| [ACE XL-SFT composer tests, July17,2026](https://github.com/ace-step/ACE-Step-1.5/discussions/1268) |Single-variable comparisons, usually1–3 seeds, using an original reference. Explicit key settings helped harmonic problems; retaining a useful direction helped iteration. |Abrupt arrivals and phrase-level arrangement faults remained. Human listening, Claude-assisted writeup; this is current XL evidence rather than launch-era Turbo anecdotes. |
| [ACE repaint/outpaint, May7,2026](https://www.reddit.com/r/StableDiffusion/comments/1t6psua/acestepcpp_can_now_outpaint/) |A user extended a song and repainted a saxophone section; XL worked better for them than a non-XL merge. |Needed repeated attempts; extension could sound grainier. Editing exists but is not reliable one-pass precision. |
| [Stable Audio3 Medium hands-on, May27,2026](https://jurn.link/dazposer/index.php/2026/05/27/an-update-on-stable-audio-3/) |Actually ran Medium bf16 in ComfyUI; liked ambient/electronic output. More explicit sequencing/pace preservation helped restyling a rendered tune. |Reference melody drifted; older Stable Audio remained useful for some environmental mixes. Stronger evidence for atmosphere than exact reconstruction. |
| [SA3 sample discussion, May26,2026](https://www.reddit.com/r/StableDiffusion/comments/1togz9j/running_those_live_lofisynthwave_channels_on/) |Praise for simple instrumentals and speed, criticism of muddy instruments, bland melody and genre drift. |Variant unclear. Some commenters overlap with the repaint thread; do not count them as independent corroboration. |
| [ComfyUI regression report, August18,2026](https://github.com/Comfy-Org/ComfyUI/issues/15701) |A user supplied comparison outputs and reported distortion after runtime updates. |A user report, not a universal defect. Freeze model/runtime versions and retain accepted WAVs before upgrading. |

The repeated February “My experience using ACE-Step1.5” crossposts count as one reviewer. Old HeartMuLa3B launch comments cannot establish its current quality. Generic affiliate rankings were not used to choose a model. None of these reports proves seamless loops, exact chord control, or performance on this machine.

## Other candidates

HeartMuLa, YuE and DiffRhythm remain relevant local song families, but the reviewed evidence did not establish a stronger fit for editable instrumental loops. MiniMax Music3.0 has real official August13,2026 weights and promising song generation, but an equivalent region-editing workflow and clear license entry were not established in the reviewed material. It is a later candidate, not another automatic download. [MiniMax release](https://www.minimax.io/blog/minimax-music-3-0-next-generation-open-weights-production-ready-versatile-music-model), [model card](https://huggingface.co/MiniMaxAI/MiniMax-Music3).

## Fresh local inventory

- RTX4090:24,564 MiB VRAM,2,664 MiB used at the initial snapshot. Available VRAM changes and is not reserved by this research.
- RAM:63.15 GiB total,39.21 GiB available. D:31.16 GiB free. A:about8,786.59 GiB free.
- Existing ACE-Step v1 3.5B weights:approximately7.707 GiB, with an older source/venv. This is not ACE1.5 XL and its current imports/inference were not tested.
- `D:/Dex/AI/Models/ACE-Step` and `D:/Dex/AI/Runtimes/music.ace-step` are junctions into `A:/Dex/Archives/Storage-Reclaim/2026-07-27/AI/`. Preserve and inspect reuse before duplicating files. A D-looking path does not prove SSD residency.
- Stable Audio folders contain cache/probe markers only:12 files totaling1,176 bytes, no usable weights. Its environment is a stub. Do not describe it as ready.
- Comfy Desktop and FFmpeg executable paths exist. No audio workflow or model was launched in this pass.

ACE's official guidance supports24 GB cards, but planner choice, free VRAM, batch size and duration still govern fit. Documentation weight/residency figures differ and are not measured runtime totals here. Stable Medium's official CUDA route needs Flash Attention2; its optimized TensorRT route is Linux-only. Windows dependency support is therefore a practical question to prove. Do not apply an H200 speed measurement to this4090. [ACE GPU guidance](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/GPU_COMPATIBILITY.md), [Stable runtime](https://github.com/Stability-AI/stable-audio-3).

With only31 GiB free on D, size the exact checkpoint, planner, environment and temporary caches first. Stage one active model set, preserve archived assets and do not delete user data or silently fill C to make installation fit.

## How we make the result controllable

Keep chapter12's shared motif and section compositions. Use an authored melody/rhythm as a retained source when exact musical identity matters; use models to draft surrounding timbre, texture and variations. A reference/cover workflow is more grounded than asking unrelated text prompts to invent matching tracks.

Freeze checkpoint, runtime, parameters and seed. Set supported BPM/key/duration/instrumental fields explicitly. Save accepted output before changing one variable at a time. A fixed seed is not guaranteed reproducible across runtime/model updates.

Use targeted repaint/audio-to-audio only when the selected checkpoint supports it. Compare the edited region and seams against the preserved original. Exact notes, chords and polished phrase transitions remain things to hear/measure and edit, not guaranteed prompt outcomes.

Finish the approved source locally into the documented48-second loops. Three-repeat listening, region transitions, codec/browser decoding and action-sound timing still apply. Models remain offline authoring tools; visitors never trigger generation.

## Bounded audition after go

Verify selected weights/license/runtime and current resource headroom first. Proposed starting set:60-second archive calm, gallery warmth and restrained arena cues, two fixed seeds each, batch1. Six drafts form an initial audition, not an indefinite search or a current generation authorization.

Review mood, instrumental compliance, pulse/key, instrument clarity, continuity and an editable loopable phrase. Record actual audio, parameters, wall time, VRAM and failure observations. If the route repeatedly misses the required controls, switch based on evidence rather than expanding the sample count indefinitely. Stable Audio is the next candidate if ACE's steering works but its atmospheric texture does not.

## Credits and scope

- Proposed default ElevenLabs allocation for dex.place is **0**, preserving the reported10,000 credits unless Dex later changes the reservation.
- Local generation has no per-generation provider credits; it uses compute time, electricity and storage. Model access/licenses still need verification.
- Higgsfield remains a bounded fallback within future authorized scope, not a parallel automatic batch. Chapter12's paid estimates remain optional comparisons.
- No downloads, installs, GPU unloading, generation or provider-credit spending occurred. Website implementation still waits for go.
