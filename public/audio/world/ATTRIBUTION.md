# dex.place world audio

What is here and where it came from. `manifest.json` lists every file with its size, SHA-256,
levels, what it is for, and the exact source files (with their SHA-256) for anything derived from a
recording. Everything is **listening-pending** until Dex approves it by ear, except the theme,
which Dex chose.

## Music (`music/`)

- `theme-b`: the original dex.place theme, arrangement produced with Suno and selected by Dex.
  Used under Suno's paid-download terms; not CC0 and not a redistributable asset. See
  `music/ATTRIBUTION-theme-b.md` (copied unchanged from the legacy set).
- `arena-chamber`: an original dex.place motif for strings and cello, rendered with FluidSynth
  2.6.0 and GeneralUser GS 2.0.3 by S. Christian Collins (its licence permits recordings; the
  SoundFont is not distributed). Licences: `music/GeneralUser-GS-LICENSE.txt`,
  `music/FluidSynth-LICENSE.txt`. A stand-in for the arena until an orchestral B exists.

## Ambience beds (`beds/`)

Original deterministic synthesis for dex.place (seeded, no external samples), built as exact
loops by `src/world/sound/build/build.mjs`. Three beds layer processed CC0 hits from Kenney's
Impact Sounds (the shaft's far knocks, the market's hammering, the clocks in the lodge and the
archive), and the archive's page turns reuse the original `paper-open` effect. `exterior` and
`interior` are the legacy beds, unchanged (original synthesis).

## Effects (`sfx/`) and footsteps (`steps/`)

- The legacy effects (`slash-*`, `hit-metal`, `cable-cut`, `paper-*`, `lift-*`, `telegraph`,
  `landing`, `hurt`, `confirm`): original offline synthesis, unchanged.
- Bells, splashes, cloth, the horn, the colossus's footfall, flame, neon and grit: original
  deterministic synthesis.
- Glass, doors, the latch, the lever, wood, stone and metal hits, the chain, the thud, leaves,
  the crank's pawl and the whoosh: processed derivatives (mono, trimmed, fixed gain, some layered
  or pitched) of these CC0 recordings:

- **Kenney (www.kenney.nl)**, *Impact Sounds 1.0*. License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). [Source](https://kenney.nl/assets/impact-sounds)
- **rubberduck**, *100 CC0 SFX #2*. License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). [Source](https://opengameart.org/content/100-cc0-sfx-2)
- **TinyWorlds**, *Different steps on wood, stone, leaves, gravel and mud*. License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). [Source](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud)

- Footsteps: stone is the legacy Kenney concrete pair; grating, metal and wet metal derive from
  **SoftDistortionFX, Metal Footsteps** ([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
  [source](https://freesound.org/people/SoftDistortionFX/sounds/398937/)), as in the legacy
  `recorded-steps-v1/ATTRIBUTION.md`; wood, earth, tile and rug are Kenney's; water is
  rubberduck's wet steps with a synthesised slosh. One fixed gain per material, no per-hit
  normalisation.

CC0 needs no credit; it is given anyway.
