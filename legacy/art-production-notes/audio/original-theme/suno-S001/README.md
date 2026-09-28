# dex.place — Suno S001

Two v5.5 Cover arrangements of the authored v2 reference, generated in one action after Dex completed the upload and human verification. Confirmed generation charge: 10 credits. Both provider MP3 and PCM16 stereo 48 kHz WAV exports are preserved with hashes in `S001-export-receipt.json`.

- A: `S001-A-original.wav` (56.52 seconds); original MP3 playback duration 56.3335 seconds.
- B: `S001-B-original.wav` (81.12 seconds); original MP3 playback duration 80.9335 seconds.
- `S001-A-level-matched.mp3` and `S001-B-level-matched.mp3` are full-length listening copies. Constant attenuation is -7.13 dB and -8.87 dB respectively, targeting the upload reference's -21.27 LUFS. No timing, arrangement, opening, fade, or loop edit has been applied.

## Review boundary

Both MP3 exports begin with measurable audio at zero seconds, whereas the authored reference reserves about 2.65 seconds before the first sustained energy. The request for initial negative space is therefore not yet satisfied by these unedited takes. Energy measurements do not identify the first instrument, melodic fidelity, register, emotional character or musical resolution.

The full review copies were presented to Dex. Neither take is selected or listening-approved; neither has replaced the temporary original-theme-v1 website runtime. Preserve the originals. Any later opening or loop edit must be a separately named derivative with source, exact timing, transformation and listening evidence recorded. Never trim automatically to the requested 90 seconds.

## Reproduce

`audio-analysis.py` measures the files without changing them. `finalize-receipt.py` inventories provider exports and the review copies, then synchronizes the generation/export receipts. See `AUDIO-ANALYSIS.md` for the compact findings and their limits. The larger JSON retains the measured envelope.

`WAV-ANALYSIS.md` verifies each WAV against its own MP3 at zero-frame alignment (correlations approximately 0.998). Each WAV preserves an additional 8,952 frames / 0.1865 seconds of low-level tail audio. Do not discard that tail as presumed silent encoder padding. WAV levels differ from the MP3 exports: A -15.14 LUFS, B -13.40 LUFS. Any future WAV master needs its own gain calculation, rather than copying the MP3 review attenuation.

## Export observation

Suno's format rows support multiple selections. Selecting WAV while MP3 is selected requests both. The reliable lossless pass used WAV alone on the already-unlocked song. Both songs were unlocked once; no additional generation or purchase was performed. Before A the visible download allowance was 21; before B it was 20. A final shared-account allowance is not inferred.

The export workflow used the authenticated Suno Download UI. B's prepared MP3 and A's prepared WAV were also fetched from the exact temporary file URLs observed in the page's completed export requests; no API endpoints or file URLs were guessed. Temporary signed URLs are intentionally omitted from durable receipts.
