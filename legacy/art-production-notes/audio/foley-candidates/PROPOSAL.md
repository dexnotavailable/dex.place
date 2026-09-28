# Recorded footstep replacement proposal

**Subsequent status:** the root authorized an integrated comparison of these four candidates. They now have versioned runtime mappings with explicit `comparison-unapproved` metadata; see [integration and rollback proof](../recorded-steps-v1/README.md). The original proposal/source review below is preserved as history, not a statement that integration is still waiting.

Start with the quiet concrete pair below and the two selected metal-grate contacts. They are **private audition candidates**, not integrated or approved replacements. [Play the 9.86-second candidate reel](recorded-candidates-private.mp3): concrete1 twice, concrete2 twice, metal1 twice, metal2 twice, with one-second gaps. It applies the existing master 0.6 × effects 0.6 gain after the listed fixed material attenuation. No current runtime effect file was changed.

| Proposed existing slot | Candidate / preserved source | Selection and treatment |
|---|---|---|
| `step-concrete-1` | `candidate-concrete-1.wav` from Kenney `footstep_concrete_001.ogg` | Whole 0.10475 s contact, arithmetic mono, fixed −21 dB material gain; peak about −22.06 dBFS before runtime buses |
| `step-concrete-2` | `candidate-concrete-2.wav` from Kenney `footstep_concrete_003.ogg` | Whole 0.10760 s contact, same −21 dB gain; original variation retained |
| `step-metal-1` | `candidate-metal-1.wav` from SoftDistortionFX's metal-grate recording | Source 6.14–6.50s; fixed −9 dB material gain and 5 ms cut-edge fades; peak about −22.42 dBFS before runtime buses |
| `step-metal-2` | `candidate-metal-2.wav` from the same recording | Source 12.42–12.78s; same treatment, different actual contact |

At current runtime defaults these candidates peak around −31 dBFS, substantially quieter than the rejected synthetic contacts. These numbers establish level, not how pleasant the sounds are. No per-hit normalization, fabricated oscillator replacement, pitch effect, heavy landing layer or added reverb was used. The concrete files are short; reject them if the audition still feels too click-like. The metal windows were picked from real waveform onsets with short decaying tails, not claimed to have passed an ear-based squeak/timbre review.

## Sources and license

- **Kenney Impact Sounds**: the official page lists 130 audio files, a foley tag and CC0. The downloaded pack's `License.txt` independently names Kenney, version 1.0 and CC0; it contains the concrete filenames above. Its per-clip microphone/recording details are not supplied. [Official source](https://kenney.nl/assets/impact-sounds). The original 800,850-byte ZIP and selected original OGGs/license are retained privately.
- **SoftDistortionFX — Metal Footsteps**: the author describes actual hard-soled walking on a metal grate; CC0 is explicit. The source is 91.1 s, mono, 44.1 kHz. The inspected file is the publicly available HQ MP3 preview; it is not mislabeled as the original FLAC. The page offers that original through its login download flow. The author notes uneven creaks/squeaks, so these short candidate cuts still require listening. [Official sound page](https://freesound.org/people/SoftDistortionFX/sounds/398937/).
- **Alternate hard-floor pair — GboxMikeFozzy**: `subway-01.ogg` and `subway-02.ogg` are retained as an alternative. The author explicitly recorded walking through a subway, processed noise, and published under CC0. They are 0.154/0.169 s mono contacts at roughly−22/−21 dBFS peak. The exact floor material is not identified, so they are not asserted to be concrete. [Author's source](https://opengameart.org/content/footsteps-0).

`source-receipt.json` retains URLs, download sizes and SHA-256 values. `candidate-clips.json` records precise source ranges, derivatives and fixed gains. `measurements.json` preserves duration/level inspection; stereo measurements use arithmetic averaging rather than an amplified center downmix. Only about 0.82 MB of the Kenney/subway originals plus the small public metal preview was fetched. No account login, purchase, model or provider generation occurred.

The bounded local filename search covered Media, Music Samples, and GameDev Assets/AssetSources; no existing matching footsteps were found there. This is not a claim that the whole machine or archived sound libraries contain none. Kenney's generic light metal impacts were inspected as a fallback but are **not the preferred metal steps**: a generic object hit would risk repeating the current click/thump problem.

## Integration after grounding repair

Keep the four existing `AudioEffect` IDs; no new event or manager API is required. The map supplies explicit concrete/metal material and the hero's real foot-contact events choose the appropriate pair. Alternate contacts without repeating the same sample consecutively; use the recorded variation instead of large random pitch shifts.

Foot contact must follow the walking cycle across connected solid steps. Crossing a tiny stair riser is not a new landing event. Reserve landing audio for a genuine airborne-to-ground contact, separate from footsteps, and verify that an ordinary staircase produces no per-tread impact chatter. The root owns this physics/event change.

Before replacing public WAVs, compare these candidates with the unchanged hero at actual world scale and default volume; confirm quiet shoe/body detail, concrete-versus-metal distinction and lack of harsh squeaks. The agent has inspected source/license/waveform/levels and provided playable artifacts but has no subjective listening approval to report. Preserve originals and update the runtime manifest/provenance only when a concrete replacement is selected; this proposal does not change publication/listening status.
