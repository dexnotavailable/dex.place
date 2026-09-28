# Original Suno reference v2

Prepared from Dex's request for a slightly higher melody and more opening space before the strings. This is an authored reference for Suno Cover, not a Suno result. No account action or credits were used. All writes are inside this new folder; every existing v1 root file was hash-checked and preserved.

## Upload / editable files

- `dex-place-theme-suno-reference-v2.mp3`: upload/listening reference,192kbps stereo.
- `dex-place-theme-suno-reference-v2.wav`: matching24-bit/48kHz stereo PCM reference.
- `dex-place-theme-suno-reference-v2.mid`: editable four-track MIDI,56BPM,D minor.
- `composition-v2.json`: exact note/velocity/entry/fade data.
- `create_reference.py`: reproducible authoring/render source. Reads v1's literal score withAST; never imports or runs the v1 exporter.

## Changes from v1

Only the melody moves up one octave: all49 attacks/50 notated entries, note starts and velocities are preserved. Bass, piano harmony and string pitches keep their original registers. The first F tie remains a single sustained note. Bar2's finalD and bar4's finalE release slightly earlier, adding0.08 and0.16 beat of space respectively. No new melody, percussion or countermelody was added.

A2-beat pre-roll adds2.142858 seconds. Including the melody's existing half-beat rest, the first lead note starts at2.678573 seconds. Bars1–2 have lead piano alone. Piano harmony enters gently in bar3 at10.727147 seconds,65% of its former velocities with the extra low fifth omitted; bar4 uses82%, then the existing levels return. Slow Strings enters in bar4 at15.107149 seconds, with MIDI expression rising from0 to100 across its first two four-beat entries.

Musical span:70.714314 seconds. Ending release tail:3 seconds. Final reference length:73.7143125 seconds. This is a standalone upload reference, not a loop master. The last1.2 seconds receive a gentle ending fade.

## Render / levels

Actual GeneralUser GS2.0.3 Grand Piano(program0) and Slow Strings(program49) through native FluidSynth2.6.0. Same modest FDN reverb as v1: room0.65,damp0.55,level0.22,width0.8; chorus off. Same45Hz high-pass/6.5kHz low-pass. One constant gain preserves phrase dynamics; no dynamic compressor, limiter or per-note normalization.

- WAV: **−21.01 LUFS**, **−4.83dBTP**.
- MP3: **−21.27 LUFS**, **−5.10dBTP**.
- Finite samples; zero clipping. These are measured file levels, not listening approval.
- `midi-audit.json` independently checks the exported MIDI's transposition, timing, two modified releases, delayed accompaniment, expression fade, programs and closed notes.
- `render-receipt.json` retains exact commands, source/output hashes and signal measurements. Its loudnorm output fields are measurement-pass diagnostics; dynamic loudnorm was not applied to the exported audio.

## Exact upload identity

MP3 bytes:1,770,668. SHA256:
`ba9adf2e0a66a3d2706676bcff1c30f3db47cac0513d60563034740bf1add158`

WAV bytes:21,229,824. SHA256:
`615b1d514bcf852f492e4206dbba8d7817853ffb93a5f6536d6377abe1d36459`

MIDI bytes:2,106. SHA256:
`4876f153aa1df1afc5fd3d24843001c303e7ca382e3e4d444b7fea2ad730bab2`

The existing instrument licenses/provenance remain in `../INSTRUMENT-ROUTE.md`. This folder contains no provider-generated music; final Suno settings, upload and listening selection belong to root.
