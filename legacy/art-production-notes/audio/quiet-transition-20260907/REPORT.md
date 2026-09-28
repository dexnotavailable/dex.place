# Quiet-region transition repair

2026-09-07. Only `site/src/worldsite/audio.ts` was changed. All other files here are private proof. No manifest, selection, documentation, map, Suno, account or release changes were made.

## Reproduction and repair

The previous implementation changed the entire music bus to the incoming region's zero level using a 25 ms exponential time constant, then separately faded the outgoing voice over 200 ms. The two envelopes multiplied. In the actual Brave Web Audio manager at 53.33 ms, only 8.694% of the initial gain remained, although the 200 ms voice envelope still held 73.344%.

User volume now remains on each bus. A separate lightweight GainNode holds each loop voice's regional mix. Incoming quiet regions do not alter that departing voice. Its regional level is frozen at departure; the existing 200 ms voice envelope owns the complete fade. Shared audible music still keeps its transport, and each fading voice disconnects its mix node when it ends. No extra AudioBuffer is allocated.

After repair, actual gain at 53.33 ms was 73.344% at 48 kHz and 73.339% at 96 kHz. The sampled 50/100/150 ms envelopes, zero sources after silence, shared transport, blur cancellation and immediate mute disconnection pass.

## Proof

- `before.json`: actual manager reproduction on temporary authored v1 music.
- `audio-before.ts`: pre-repair source snapshot.
- `after.json`: four native Brave Web Audio profiles, 48/96 kHz with Opus/AAC; 60 assertions pass, no page errors.
- `probe.mjs`: reproducible private browser fixture on localhost:5198; initial activation uses its native button. It imports the actual live audio manager and serves only selected media URLs.
- `current-contract.json`: freshly derived map/effect requirements and changed loader fingerprint.
- TypeScript check: `pnpm exec tsc --noEmit` passes.

Each profile decoded the exact active sixteen-entry selection with no pre-opt-in audio request. Current v1 support bounds remain 3,291,430 frames at 48 kHz, or 6,582,860 at 96 kHz: 68.571458 seconds. All three cached loop endpoint differences measure below -100 dBFS after codec/resampler integration. Cache allocation including both ambience loops and thirteen effects is 31,846,132 bytes at 48 kHz and 63,692,264 bytes at 96 kHz, below the 67,108,864-byte cap. This leaves only about 3.26 MiB at 96 kHz; a longer Suno master needs a fresh memory measurement and potentially a shorter export.

The first post-repair run retained two overly strict assertions in `first-after-with-overstrict-assertions.json`: exact bitwise-zero seam and synchronous AudioParam.value readback at the instant of mute. Measured residual seams were below -100 dBFS; native gain readback advances with the audio render quantum. The corrected proof reports those measurements explicitly, verifies immediate source disconnection, and confirms master gain zero after a 20 ms observation. Mute has no authored fade. No application code was changed to conceal those initial test failures.

## Remaining integration action

The runtime selection guard intentionally becomes stale when audited loader methods change. Root must review this repair and update only the owner manifest's `activeRuntime.guard.effectContractSha256` to:

`8c03c46650c3b093af75f63ef37b2f3e8d8622c6ce2638c60702a893e2e99193`

Then rerun `node scripts/audio-runtime-selection.mjs --check`. The sixteen active entries did not change. No guard or selection metadata was updated by this lane.

This certifies the temporary v1 manager/codec/transition behavior, not listening preference, full-site destination binding, real Samsung/iPad hardware, whole-loop audition, Suno generation, or publication. The eventual Suno-derived export must receive its own duration, codec, boundary and memory checks; creative approval remains separate.
