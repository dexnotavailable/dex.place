# Final v2 audio guard and bounded integration proof

Date:2026-09-08. Guard check and TypeScript pass. The selected Suno B media, all music files and all effect files remain byte-identical. There are21 active entries:2 music,2 ambience,17 effects.25 codec/file representations were read and checked against their declared sizes/hashes. Runtime selection JSON is unchanged; only the owner manifest's guard hash changed.

## Repairs and measured results

The actual App emits a file's paper-open effect just before its reader pauses audio. The old pause stopped the450ms source after42.7ms; its native ended event arrived53.3ms after start. The repaired manager allows only an already-started paper-open/confirm transient to reach an absolute180ms deadline, with its final45ms faded. The actual App ended event now arrives181.3ms after start. After that transition, the reader has zero music, ambience and effect voices. No delayed decode may start under the reader. Those two small cue buffers are primed before longer music files after opt-in.

Mute, blur, explicit pause and hidden-document handling do not preserve this tail. A late cancelled cold cue cannot appear inside the reader. A same-quantum mute/voice-activity edge was also repaired: muted master gain is pinned exactly to zero instead of cancelling that zero and scheduling a decay from the previous value.

Voice ducking retains the approved factors: music0.5012 (just under6dB attenuation), effects0.85, ambience0.65. Native measurements after the attack transition were0.5031/0.5030 relative music gain, approximately−5.97dB. Release rises smoothly toward the user's gain with the existing450ms time constant. Voice activity changes neither the current music source nor cache/transport identity.

## Proof scope

- `native-proof.json`:20 checks passed across48k output/Opus and96k output/AAC. Actual native Web Audio, one live context and one48k decoder.21 cached buffers occupy64,768,372 bytes, below67,108,864 bytes. B's exact loop remains0..4,020,960 frames /83.77 seconds; codec seam tolerance is below1e−7. No new full192k matrix was run because source media/decoder behavior are unchanged from prior exact-media proof.
- `cue-cancellation-proof.json`:3 checks passed for cancelled cold decode, immediate blur cancellation with no restart, and immediate explicit pause.
- `before-app-cue.json`, `after-app-cue.json`: actual App Enter with sound, native walking and E to the physical Archive reader. Read-only native AudioBufferSource start/stop/ended observation forwards original calls unchanged.
- `first-native-settle-and-mute-edge.json`: preserved initial measurement failure. The fixture waited only450ms for a450ms gain time constant, so its baseline had not settled; the correction waited3.8s. That run also exposed the real mute scheduling edge described above.
- `final-seal.json`: exact selected file identities, reviewed requirements, source hashes and guard update receipt. Native proof source hashes were rechecked before sealing.

Headless process output was muted for desktop etiquette. These checks establish native timing, gain and source lifecycle behavior; they do not claim new listening approval, physical-device coverage, a staging build or public delivery. Existing listening flags were preserved rather than promoted from technical results.

## Guard scope

The requirement set is derived from the actual PUBLIC_ASSETS map and current audio direction. The updated seal includes direct gameplay effect emitters plus inspection/pause/room lifecycle methods, every audio-manager method, and the App's effect dispatch, audio scene synchronization, entry and inspector controls. This prevents a future gain, cancellation or UI-ordering change from passing only because media IDs still match.

Current seal: `ee214fb68c047679d2de4cd567693dab74e7bb687ac94a3a975b1a90495cf736`.

| Owner file | SHA256 |
|---|---|
| src/worldsite/audio.ts | 903c58a37e3aa78f569899b9349874d2de01ea659bee75404e912161e0f88a42 |
| src/worldsite/audio-direction.ts | 354172cab6e69a5724c94e23e4557c15fb2beb312eda2483a6701e0af1380bbf |
| src/worldsite/audio-runtime-selection.json | 0cbd9870288a592b7b1e8cf5dae6b492be72f043d8bf99ecb69ec5adeae25544 |
| scripts/audio-runtime-selection.mjs | f651df41fe1edcfa29c5d454049ec605f01c9fb7b5c857e307d20ab6187e4f0f |
| public/audio/world-v1/manifest.json | 67d8021f6af32c8d85dcb7041c19dbdd57929caebbfde07674d422b4b5a2f3e2 |

Selected B remains support.opus1,152,333 bytes SHA`b0f5d425b80eb4af4d37dc11bfa6fd4c95192be24ce264b709a7ba4d30d02f1c`, support.m4a1,322,589 bytes SHA`2df21d1caffb73d43ee40a96ccba65b35b6a0d58ae86fd16e3f7bed0660fa9b4`.

No provider credits, audio generation, gameplay/UI changes or public promotion were used in this lane.
