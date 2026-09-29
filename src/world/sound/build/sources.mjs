// Where recorded material comes from, with its licence. The CC0 packs live
// outside the repo (big, and not ours to redistribute as packs); point
// DEX_AUDIO_SOURCES at the folder that holds them (see build.mjs). Only small
// processed derivatives are written to public/audio/world/, and every one of
// them lists its source file, pack, licence and the source's SHA-256 in the
// manifest.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decode, sha256, SR } from "./dsp.mjs";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const LEGACY = join(REPO, "legacy/site/public/audio");

export const PACKS = {
  kenney: {
    title: "Impact Sounds 1.0",
    creator: "Kenney (www.kenney.nl)",
    license: "CC0-1.0",
    page: "https://kenney.nl/assets/impact-sounds",
    dir: "Extracted/kenney_impact-sounds/Audio",
  },
  sfx100: {
    title: "100 CC0 SFX #2",
    creator: "rubberduck",
    license: "CC0-1.0",
    page: "https://opengameart.org/content/100-cc0-sfx-2",
    dir: "Audio/OpenGameArt_CC0/sfx_100_v2/Extracted",
  },
  tinyworlds: {
    title: "Different steps on wood, stone, leaves, gravel and mud",
    creator: "TinyWorlds",
    license: "CC0-1.0",
    page: "https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud",
    dir: "Audio/OpenGameArt_CC0/Footsteps/different_steps_cc0/Extracted",
  },
  legacy: {
    title: "dex.place world-v1 audio (legacy/site/public/audio)",
    creator: "dex.place",
    license: "see the ATTRIBUTION.md beside each file",
    page: "",
    dir: "",
  },
};

const root = process.env.DEX_AUDIO_SOURCES ?? "";

/** Load a source clip (mono by default) and remember it for the manifest. */
export function src(pack, file, { ch = 1, sr = SR } = {}) {
  const p = pack === "legacy" ? join(LEGACY, file) : join(root, PACKS[pack].dir, file);
  if (!existsSync(p)) throw new Error(`missing source ${pack}/${file} (set DEX_AUDIO_SOURCES; see src/world/sound/build/build.mjs)`);
  const chans = decode(p, { sr, ch });
  const info = { pack, file, license: PACKS[pack].license, sha256: sha256(p) };
  return Object.assign(chans[0], { chans, info });
}
