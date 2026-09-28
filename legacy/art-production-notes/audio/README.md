# dex.place local audio production — 2026-09-06

Status: **current soundtrack artistically rejected after Dex's playtest; technical file/manager proofs retained as history**. Dex reported that early music is too energetic and becomes calm only later, section cues do not feel cohesive, and footsteps sound poor. These files must not be described as listened-approved or accepted merely because they decode and play.

The next direction is calm throughout, with deliberate silent sections and an orchestral variant restricted to the arena; boss work can wait. Preserve the current sources, masters, compact review and three-repeat files as rejected-candidate evidence. This checkpoint authorizes no new generation, provider spend, model download or runtime/publication-metadata change. The root is updating the design before the music/world rebuild and will assign the bounded audio revision separately. Physical-device, complete listening and final mix acceptance remain unproven.

The subsequently authorized [calm comparison](calm-comparison/README.md) now reuses the existing Support bed across audible ordinary regions, with explicit silence and preserved offsets. It is an unapproved behavioral comparison, not a replacement score acceptance. A 58.26-second actual manager recording and scoped native/API proofs are provided there. The later authorized [recorded footstep trial](recorded-steps-v1/README.md) now maps the same four material IDs to quiet versioned CC0 derivatives, retaining the synthetic files/manifests for rollback. Those replacements remain `comparison-unapproved`; grounding/timing and listening judgment are still separate.

## Outputs and provenance

- Five requested 60-second native stereo ACE-Step v1 sources are preserved as `*-ace-v1-source.wav`, PCM24 at 48 kHz. The actual native duration is 59.907479 seconds; requested timing/key is not musical proof. Existing arrival source was reused, not regenerated.
- Exact checkpoint revision: `82cd0d7b6322bd28cd4e830fe675ddb6180ce36c`. This is the pre-existing **ACE-Step v1 3.5B**, not ACE 1.5 XL. Its local checkpoint card says Apache-2.0; the exact card and code license are copied into `provenance/`. The runtime and weights remain their existing A-backed junction targets. No model download, shared-runtime upgrade or GPU-owner eviction occurred.
- `ace-v1-attempt-first-failure.*` preserve the earlier TorchCodec writer failure. `try_existing_ace.py` uses a task-local SoundFile PCM24 export adapter. The successful initial attempt took 22.57 seconds; the four related cue calls took 16.55, 9.87, 9.00 and 9.25 seconds respectively. These are recorded tool wall times, not estimates for the whole creative task. Observed peak allocated VRAM was about 6.44 GiB at most (6,596.5 MiB). The existing runtime source commit is `1bee4c9f5b43e30995f8d4d33b3919197ce1bd68`.
- `generate_related_beds.py` retains the four new cue prompts, fixed seeds and bounded batch-one production. Provider credits: **0**. New model downloads: **0**. ElevenLabs/Higgsfield audio were not used.
- `motif-notes.json`, `motif-instrument.json`, `motif-authored-source.wav`, and `finish_audio.py` retain the original four-note motif and soft harmonic instrument. Music stems are mixed offline into each final cue. Effects and ambience use original deterministic physical-texture/noise/modal synthesis, with no sampled recordings, voice or third-party melody.

## Runtime inventory

`D:/Dex/Projects/dex-place-world/site/public/audio/world-v1/manifest.json` inventories every actual export by duration, channels, size and SHA-256. It contains no private authoring paths.

| Family | Assets | Runtime representation |
|---|---:|---|
| Music | 5 | 48-second stereo Opus about 96 kbps plus AAC-LC about 128 kbps; manager fetches one compatible format |
| Ambience | 2 | 12-second mono Opus about 48 kbps plus AAC-LC about 64 kbps |
| Effects | 18 | Trimmed mono PCM16 WAV, 0.18–1.8 seconds |

32 audio files total, about 8.04 MiB including the public manifest. The music cues are arrival, archive, gallery, support and boss. All source/master/audition WAVs remain private; only the runtime exports enter the site.

The final measured music levels are approximately -21 LUFS, with boss at -20 LUFS. Measured master true peaks range from -9.59 to -3.25 dBTP. Dynamic loudnorm was rejected because its varying gain damaged the loop boundary; the retained workflow measures EBU loudness and applies constant gain. Master endpoint differences are exactly zero at PCM24 precision. Codec decoding can introduce a boundary difference, so the manager uses a 128-sample cosine blend in place, with no second decoded buffer. Live Brave loop-boundary readback was below -80 dBFS. This signal check does not prove musical seam quality.

All cue transitions use the documented 200 ms fade-out, 100 ms quiet gap and 500 ms fade-in. Generated tempo/harmony alignment remains unproven, so beat-aligned overlapping transitions are deliberately not claimed.

## Implementation and evidence

- `site/src/worldsite/audio.ts`: lazy singleton manager and typed API (`getWorldAudio`, `audioRegionFor`, `AudioScene`, `AudioEffect`, `AudioGains`). Master/music/effects/ambience gains use normalized 0–1 values. `world-audio-status` carries diagnostics and asynchronous errors.
- `audio-file-verification.json`: all 32 final files decode through existing FFmpeg; finite samples, no clipping, measured master loudness and exact source/codec facts. The raw decoded seam metric in this report is **before** the manager's in-place seam treatment.
- `audio-browser-verification.json` and `probe_audio.mjs`: 21 passing checks in isolated headless Brave using real Chromium Web Audio. No audio/context before explicit opt-in; all 32 shipped Opus/AAC/WAV formats decode; one selected format fetched; reader gain 0.65 without restart; pause/blur stop with saved offsets; explicit resume; immediate mute; no effect replay while paused; effect-ID coalescing and 12-voice cap; newest region wins; readable activation/load failures.
- At 48 kHz, the measured two-cue/two-ambience/all-effects cache was **43,186,560 bytes** (~41.19 MiB). At 96 kHz it evicted the outgoing music before decode and used **44,901,120 bytes** (~42.82 MiB) with one music cue. At 192 kHz, the oversized cue was refused before decode with sound muted. The cap is 64 MiB, measured from actual decoded samples.
- TypeScript `tsc --noEmit` passed after the final manager change.

The first browser probe imported a stale Vite module URL, giving it a different singleton from the live App; the harness now resolves the actual loaded module URL. That observation timeout was a probe issue, not evidence of failed generation or a reason to restart sources.

## Listening and integration handoff

Open `auditions/index.html` for a 65-second five-cue reel and five individual three-repeat players. Individual MP3s contain 144 seconds: three actual Opus-decoded 48-second loops with the same seam treatment as the manager. Headphone/speaker review should inspect seams at 48 and 96 seconds, density, melody/key compatibility, perceived loudness, noise-floor changes and fatigue. These are playable assets; no listening pass is claimed because this agent's audio tool returned that audio input is unsupported.

Outstanding acceptance belongs to the integrated site owner:

1. Listen and refine the five cues, ambience and physical effects in the assembled world. Reject any mismatch; do not interpret decoder/probe success as taste approval.
2. Wire gameplay events to the exported `AudioEffect` IDs, with stable event IDs. Cached effects play immediately and are not queued behind music fades. Footstep variant/material, cable once-only cut, boss hit/telegraph, lift start/dock, paper open/cut, landing/hurt and outcome transitions still need real gameplay timing proof.
3. On explicit Resume after blur, call `resumeFromGesture()` if sound was enabled. Set current gains/scene before first activation. Surface the manager's `lastError` and `needsGesture` through existing shell status. Root owns these App integrations.
4. Hear three full loops and transitions on headphones and speakers; exercise Samsung Internet Android and iPad Safari on actual devices. Headless Brave is desktop-engine evidence, not physical mobile proof.
5. Confirm victory/defeat treatment in the actual encounter flow: don't let a menu pause suppress the intended short outcome phrase, and never delay file delivery for sound.

No hosting, commits, spending, source deletion or non-audio game/UI edits were performed by this lane.
