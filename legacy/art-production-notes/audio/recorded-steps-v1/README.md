# Recorded footsteps v1 — integrated comparison, unapproved

The four recorded candidates now supply the existing `step-concrete-1`, `step-concrete-2`, `step-metal-1` and `step-metal-2` IDs. This is the requested integrated trial following rejection of the synthetic steps. No new effect ID, generation, model, spend, main.tsx or game/physics change was introduced.

Runtime files are versioned under `site/public/audio/world-v1/recorded-steps-v1/`. `FOOTSTEP_ASSET_URLS` in `src/worldsite/audio-direction.ts` maps only these IDs; `audio.ts` uses that mapping when loading effects. Existing bus gains are unchanged. All four manifest rows and manager diagnostics explicitly say `comparison-unapproved`.

| Effect | Duration | Bytes | PCM peak before buses |
|---|---:|---:|---:|
| Concrete1 |0.10475s|10,100|−22.06dBFS|
| Concrete2 |0.10760s|10,374|−22.10dBFS|
| Metal1 |0.36000s|34,604|−22.43dBFS|
| Metal2 |0.36000s|34,604|−22.40dBFS|

Total audio payload:89,682 bytes. Concrete uses one fixed −21dB attenuation for both Kenney contacts. Metal uses one fixed −9dB attenuation for both SoftDistortionFX contacts, with5ms cut-edge fades. No per-hit normalization, gain boost, randomized pitch, synthetic reinforcement or landing thump was added. At default master0.6 × effects0.6, peaks are around−31dBFS. Material contrast comes from the recordings.

## Verification

`browser-verification.json` records **eight passing checks, zero page errors** in fresh headless Brave. No audio media was fetched before native Sound opt-in. All four versioned HTTP responses match the manifest's exact SHA-256/size; actual cached Web Audio buffers match mono48kHz duration and quiet peak expectations. None of the four obsolete unversioned footstep URLs was requested.

Native D walking on the safe concrete causeway played the actual new concrete buffers in sequence1→2→1, identified by a pass-through observer on native source starts. All four material files were decoded and hashed; this is not a claim of a completed metal traversal or repaired stair grounding. TypeScript passed. Probe browser closed. `native-walking-trial.png` preserves the tested world state.

## Source and licensing

The [candidate proposal](../foley-candidates/PROPOSAL.md), original ZIP/OGG/MP3 files, Kenney `License.txt`, `source-receipt.json` and precise `candidate-clips.json` remain preserved. The public manifest records creator, CC0 license, source page/representation, exact ranges and constant material gain. The served `recorded-steps-v1/ATTRIBUTION.md` contains portable source/license notes with no workstation paths.

Concrete comes from Kenney Impact Sounds' two named concrete clips. Metal comes from SoftDistortionFX's actual metal-grate recording, using its publicly offered HQ MP3 preview; it is not called the original FLAC. Both sources were checked as CC0 in the preceding source review. The source choice and integration remain artistically unapproved.

The root's release preparer selects the new WAV URLs through the audio manifest, but its current runtime-only projection omits source attribution fields and does not automatically copy the new attribution file. The root was notified to include the portable credit/license note deliberately in the later release package. No release pipeline or hosting change was performed here.

## Rollback and review

`rollback/` contains the prior public and private production manifests plus the four rejected synthetic WAVs, each preserved before this edit. The original unversioned WAVs also remain unchanged at their existing development paths. For a deliberate rollback, restore the previous manifest rows and remove/disable only the four URL overrides; then create a fresh audio manager/page so its decoded cache cannot hide the selection. Do not run the full original sound-generation script merely to undo four file mappings.

`integration.json` records the selected files and identities. The runtime manifest still contains exactly18 effects; preserved alternates do not increase that active count. No musical/listening status was promoted, and other audio exports were left unchanged.

Judge this integrated trial alongside the root's connected-stair and explicit-material repair. A foot contact is not a landing on every riser. The [private candidate reel](../foley-candidates/recorded-candidates-private.mp3) remains available, but playback/decoder proof is not an ear-based approval of contact texture, loudness or final event timing.
