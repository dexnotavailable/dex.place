# Selected Suno B runtime theme

2026-09-08. Dex selected the B excerpt beginning at54s in the comparison reel: “54s has this more grand and mystical vibe, like it more, use that.” This approval applies to S001-B music, not A or the ambience/effects collection.

## Complete arrangement retained

The official B WAV remains untouched:81.12 seconds,3,893,760 frames,48 kHz stereo PCM16. The runtime master preserves its entire duration and all phrases, adds exactly2.65 seconds /127,200 frames of initial digital silence, and applies one constant−7.87 dB gain. Only its quiet final50 ms is faded to an exact-zero last sample. There is no beat-grid quantization, pitch/time change, short excerpt loop, compression, or omitted phrase.

The complete cue repeats after **83.77 seconds /4,020,960 frames**. Its next iteration begins with the intentional quiet breath. The master is PCM24, with measured−21.30 LUFS,−10.65 dBTP, finite samples and no clipping. Original source samples before the last50 ms match the constant-gain reference within24-bit rounding tolerance. A first continuous-time fade attempt left a sub-micro-unit nonzero final sample; the final export uses2399 fade intervals over the last2400 sample positions, reaching zero without shortening the cue.

## Runtime exports

| Representation | Setting | Bytes | SHA256 |
| --- | --- | ---: | --- |
| Opus |96 kbps VBR,48 kHz stereo|1,152,333|`b0f5d425b80eb4af4d37dc11bfa6fd4c95192be24ce264b709a7ba4d30d02f1c`|
| AAC/M4A |128 kbps,48 kHz stereo|1,322,589|`2df21d1caffb73d43ee40a96ccba65b35b6a0d58ae86fd16e3f7bed0660fa9b4`|

New URLs are under `/audio/world-v1/suno-theme-b-v1/`. The active support entry contains exact loop/frame metadata and `listeningStatus: approved`. The other fifteen active ambience/effect entries retain their previous listening states. Runtime selection id is `calm-world-suno-b-v1`; its generated config is synchronized with the owner catalog. The retired local original-theme-v1 entry and pre-change catalog/config are saved privately, and previous source/public files remain intact. The release projection selects only the new B theme; it excludes original-theme-v1 and the inactive rejected music/effects.

The brief public attribution states the original-theme/Suno arrangement provenance and links the root-verified official terms, paid-use and remix guidance. It contains no account identifiers, credit ledger, private paths or credentials. This is permitted site playback, not an offer of a CC0/redistributable music library. Root's intended-use review is retained at `../S001-B-RIGHTS-REVIEW.md`.

## Native proof

`after.json` and `native-media-probe.mjs` cover the actual unchanged audio manager at48/96/192 kHz live output with both Opus/AAC. All132 assertions pass: exact16 active assets,48 kHz decoded buffers, correct loop duration, shared transport, preserved fade, quiet states removing voices, immediate mute, no blur resurrection, one live context/one unrendered decoder, and released references on disposal. No browser error occurred.

All six profiles retain **37,682,372 bytes** of decoded audio, below the unchanged67,108,864-byte cap. Both encoded music formats decode to exactly4,020,960 frames. No hardware-rate expanded copy was created in the application cache.

`loop-boundary-proof.json` additionally starts the actual loop source just before its declared end at48 kHz/Opus and192 kHz/AAC. The same source crosses into the quiet prefix at playbackRate1; measured playback position advances through the boundary correctly. Early decoded prefix peak is below−100 dBFS, with the post-boundary graph at digital zero or negligible floating noise. The PCM master itself has exact-zero first/last samples. This proves the numerical/native boundary, not a claimed agent audition of the musical result.

TypeScript and active-selection validation pass. `public-audio-projection.json` records the exact selected runtime catalog without staging a release. No audio.ts change, provider/account action, spend, public-doc export, production build or deployment occurred in this lane.

## Root handoff

Audio media/catalog/config ownership is returned. Root owns chapter12/20 and the coordinated build/QA. The current audio-direction comparison labels predate this selected source; this lane changed only the support music listing/selection, leaving broader direction/effects status interpretation for root. The user chose B's musical character; final full-cue and in-world listening remain distinct from source selection and technical export proof.
