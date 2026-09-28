# Local sampled piano and sustained strings

Verified 2026-09-07 local time. The usable route is **FluidSynth 2.6.0 + GeneralUser GS 2.0.3**. No accounts, audio-device routing, model weights, provider credits, purchases or existing music files were used or changed.

## Exact paths

- Wrapper: `D:/Dex/Projects/dex-place-art-production/audio/original-theme/tools/Render-Midi.ps1`
- Renderer: `D:/Dex/Projects/dex-place-art-production/audio/original-theme/tools/fluidsynth-2.6.0/fluidsynth-v2.6.0-win10-x64-cpp11/bin/fluidsynth.exe`
- Bank: `D:/Dex/Projects/dex-place-art-production/audio/original-theme/instruments/GeneralUser-GS-2.0.3.sf2`
- SoundFont license: `instruments/GeneralUser-GS-LICENSE.txt`
- FluidSynth license: `tools/FluidSynth-LICENSE.txt`
- Author's synth documentation: `instruments/GeneralUser-GS-DOCUMENTATION.md`

```powershell
& 'D:/Dex/Projects/dex-place-art-production/audio/original-theme/tools/Render-Midi.ps1' -Midi 'D:/path/score.mid' -OutputWave 'D:/path/new-stem.float.wav'
```

The wrapper refuses existing outputs. It renders 48 kHz stereo float WAV, default gain 0.5, dry reverb/chorus/limiter off, and writes a log and hash/format receipt. It preserves MIDI programs, banks, note velocities, sustain, pan and expression through the actual FluidSynth engine. Render piano and strings as separate MIDI stems for later balance/reverb if wanted. This wrapper does not master loudness or approve musical quality.

## Verified presets

Bank 0, zero-based MIDI program numbers:

|Program|SoundFont preset|Use|
|---:|---|---|
|0|Grand Piano|Sampled acoustic piano; use softer velocities for the calm theme.|
|1|Bright Grand Piano|Brighter alternative, unnecessary for the current quiet direction.|
|48|Fast Strings|Quicker ensemble attack.|
|49|Slow Strings|Sustained ensemble bed; preferred starting choice for this score.|

Human GM charts may call these 1, 2, 49, 50. The file contains16,046,831 16-bit sample values. It is actual sampled synthesis, not an oscillator placeholder. Preset inventory and verified Git blob are in `proof/instruments.json`.

## Provenance and licenses

GeneralUser GS 2.0.3 is from the creator's canonical repository, pinned to commit `684543d5e5efaef08d02be50dcda8d552478fa60`:

- [Author's product page](https://schristiancollins.com/generaluser.php)
- [Pinned source bank](https://github.com/mrbumpy409/GeneralUser-GS/blob/684543d5e5efaef08d02be50dcda8d552478fa60/GeneralUser-GS.sf2)
- [Pinned full license](https://github.com/mrbumpy409/GeneralUser-GS/blob/684543d5e5efaef08d02be50dcda8d552478fa60/documentation/LICENSE.txt)

Its custom License v2.0 expressly permits private/commercial music creation and profit from recordings. It is not CC0. The full license also says some historic third-party sample origins cannot be established with 100% certainty; this receipt preserves that qualification rather than claiming independently audited ownership of every sample. The website needs rendered music files; the SoundFont stays in the private production tools/instruments area.

Bank size 32,319,396 bytes. SHA256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`. Its Git blob SHA1 `298b552d2e9d1307e03e5c5c99d2c046aaed9ec3` was independently computed using the Git blob header and matched the creator repository API record. The author recommends FluidSynth 2.3+ for complete modulation support; using the old TinySoundFont adapter with this modern bank was avoided.

FluidSynth comes from the [official 2.6.0 release](https://github.com/FluidSynth/fluidsynth/releases/tag/v2.6.0). Portable Windows 10 x64 archive size 2,722,370 bytes; SHA256 `817262deacaa748edb3af6731dffe1766b00146790becfccc949a9f701e76681`, verified against the official release asset digest before extraction/execution. FluidSynth is LGPL 2.1; its full upstream license and unmodified archive are retained. No system installation or PATH change was made. Runtime reports 2.6.0. See `proof/fluidsynth-release-api.json`.

## Actual render proof

`proof/piano-and-slow-strings.mid` is only an instrument diagnostic: three soft piano notes, followed by a held three-note Slow Strings chord. It is not the theme or reused music from another project.

- Native FluidSynth output: `proof/piano-and-slow-strings.float.wav`.
- Wrapper separately verified: `proof/wrapper-piano-and-strings.float.wav` and `.float.render.json`.
- Format 48 kHz, stereo, 32-bit IEEE float; 10.762667 seconds including native release tail.
- Peak −26.3453 dBFS; RMS −42.0786 dBFS at gain 0.5 and soft test velocities. No clipping. This intentionally leaves mix headroom.
- `proof/piano-and-slow-strings-listening-preview.mp3` is a fixed +12 dB preview only, for easier audition. No tone/effects were changed.

This verifies renderability and distinct selected presets. Final piano/strings tone and the composition still require audition; no listening approval is inferred from file metrics.

## Bounded local inventory

Searched D:/Dex/Music, D:/Dex/Creative, D:/Dex/Apps for SF2/SFZ and relevant renderer/application files. Found `D:/Dex/Creative/UntilYouWake/audio/music/sketches/tools` with a working TinySoundFont C adapter and a 5.97 MB TimGM6mb bank. Its adapter intentionally routes every program/channel to piano, and its own receipt labels the compact piano as sketch-only. It was inspected as a donor and left untouched. Its GPL 2 bank and MIT renderer remain in their original project; this route does not copy them or use that project's music. No unrestricted whole-drive sample hunt was performed.
