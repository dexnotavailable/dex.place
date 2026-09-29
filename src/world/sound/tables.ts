// The world's sound content (lane S1). The runtime (audio.ts) owns the music
// state machine of WORLD-PLAN section 9; this module hands it the content
// through hooks.ts (found by glob, no shared edit):
//
// - AUDIO_BASE moves from legacy/ (never served in production) to
//   public/audio/world/, built by src/world/sound/build/build.mjs. What every
//   file is and where it came from: public/audio/world/ATTRIBUTION.md and
//   manifest.json.
// - the music (Dex's Suno "B" theme; arena-chamber held for the arena), the
//   ambience beds of section 9, the effects and the footsteps per surface;
// - every cue id the rooms and the pixel-matter props emit, mapped to a file
//   (with a rate and a volume), so nothing falls through to the lab's
//   placeholder synth voices except the player's own moves;
// - the bell per place (the ferry bell at Ringwater, the rib bell on the
//   causeway and the pilgrim path, the chapel bell in the chapel);
// - "wind alone" at Stonetop: the music ducks out while the colossus passes
//   at eye level (the plain keeper's `passing` state), and comes back after.
//
// Cue points (the music's entry points) live in the rooms' `audio` data; the
// measured values and why they sit where they do are in THEME below and in
// docs/world/RUNTIME.md "Sound". Everything here is listening-pending: Dex's
// ears are the approval, not a fade check.

import { registerSound, type SoundTables } from "../audio.ts";
import type { SoundHooks, WorldApi } from "../hooks.ts";

type Cue = { file?: string; synth?: string; rate?: number; vol?: number };

/** The theme's measured shape (public/audio/world/music/theme-b.opus, 83.78 s). */
export const THEME = {
  seconds: 83.78,
  /** Silence at the front, then the high piano phrase. */
  quietFront: 2.65,
  /** The dense middle (sustained strings and air over the piano) runs to here; a breath follows (-27 dB for about 1.5 s). */
  climaxEnd: 48.5,
  /** The last section (the plan's grand, mystical passage) starts here: the air drops away and the piano stands alone. */
  passage: 50.5,
  /** The tail fades from about 77 s to the end. */
  tail: 77,
};

const FILE_IDS = {
  sfx: [
    "bell-chapel", "bell-ferry", "bell-rib", "bench-sit", "cable-cut", "chain", "clink", "cloth-1", "cloth-2", "cloth-flap",
    "cloth-tear", "colossus-footfall", "confirm", "crank", "door-close", "door-open", "door-rattle", "flame-gutter", "flame-light",
    "glass-hit", "glass-shatter", "grit-sift", "hit-metal", "horn", "hurt", "landing", "leaf-rustle", "lever-pull", "lift-dock",
    "lift-start", "metal-heavy", "metal-hit", "neon-buzz", "neon-spark", "paper-cut", "paper-open", "shard-reassemble", "slash-1",
    "slash-2", "splash-1", "splash-2", "stone-break", "stone-hit", "telegraph", "thud", "unlatch", "whoosh", "wood-break",
    "wood-hit", "wood-knock",
  ],
  steps: ["earth", "grating", "metal", "rug", "stone", "tile", "water", "wet-metal", "wood"],
};

const files: Record<string, string> = {};
for (const id of FILE_IDS.sfx) files[id] = `sfx/${id}.wav`;
for (const s of FILE_IDS.steps) for (const n of [1, 2]) files[`step-${s}-${n}`] = `steps/${s}-${n}.wav`;
// the runtime's own default ids, moved off legacy/
files["step-concrete-1"] = "steps/stone-1.wav";
files["step-concrete-2"] = "steps/stone-2.wav";
files["step-metal-1"] = "steps/metal-1.wav";
files["step-metal-2"] = "steps/metal-2.wav";

const steps: SoundTables["steps"] = {};
for (const s of FILE_IDS.steps) steps[s] = { files: [`step-${s}-1`, `step-${s}-2`], vol: 1 };

const f = (file: string, vol = 1, rate = 1): Cue => ({ file, vol, rate });

/** Material families of the pixel engine (`<family>.hit`, `<family>.break`; src/pixel/materials.ts). */
const families: Record<string, Cue> = {
  "stone.hit": f("stone-hit", 0.55),
  "stone.break": f("stone-break", 0.7),
  "wood.hit": f("wood-hit", 0.6),
  "wood.break": f("wood-break", 0.7),
  "metal.hit": f("metal-hit", 0.55),
  "metal.break": f("metal-heavy", 0.6),
  "glass.hit": f("glass-hit", 0.45),
  "glass.break": f("glass-shatter", 0.7),
  "cloth.hit": f("cloth-2", 0.5),
  "cloth.break": f("cloth-tear", 0.55),
  "wax.hit": f("thud", 0.3, 1.7),
  "wax.break": f("stone-hit", 0.3, 1.6),
  "flame.hit": f("flame-gutter", 0.5),
  "flame.break": f("flame-gutter", 0.6),
  "seal.hit": f("glass-hit", 0.35, 0.6),
  "water.hit": f("splash-2", 0.5),
  "water.break": f("splash-1", 0.6),
  "leaf.hit": f("leaf-rustle", 0.5),
  "leaf.break": f("leaf-rustle", 0.6, 0.85),
  "earth.hit": f("thud", 0.5),
  "earth.break": f("stone-break", 0.45, 0.8),
  "straw.hit": f("leaf-rustle", 0.45, 0.8),
  "straw.break": f("leaf-rustle", 0.55, 0.7),
  "rope.break": f("cable-cut", 0.8),
  "seal.break": f("glass-shatter", 0.5, 0.8),
  // a heavy blow leaves a crater in the floor
  "stone.crater": f("stone-break", 0.7, 0.8),
  "metal.crater": f("metal-heavy", 0.7, 0.8),
};

/** Prop states and room events (every id emitted in src/world and src/pixel, 2026-09-29). */
const events: Record<string, Cue> = {
  // the runtime's contract ids (stub props, the player, the shrine)
  swing: { file: "slash", vol: 0.45 },
  land: f("landing", 0.5),
  hurt: f("hurt", 0.7),
  dash: f("whoosh", 0.3, 1.1),
  knock: f("wood-knock", 0.7),
  clink: f("clink", 0.5),
  chime: f("confirm", 1),
  latch: f("unlatch", 0.8),
  chain: f("chain", 0.5),
  "cable-cut": f("cable-cut", 0.8),
  "paper-open": f("paper-open", 0.7),
  "lift-start": f("lift-start", 0.7),
  "lift-dock": f("lift-dock", 0.7),
  telegraph: f("telegraph", 0.7),
  stone: f("stone-hit", 0.6),
  "wood-hit": f("wood-hit", 0.7),
  "wood-break": f("wood-break", 0.6),
  door: f("door-open", 0.7),
  rattle: f("door-rattle", 0.5),
  gutter: f("flame-gutter", 0.5),
  cloth: f("cloth-1", 0.5),
  grass: f("leaf-rustle", 0.45),
  // cloth, banners, the map
  "cloth.tear": f("cloth-tear", 0.6),
  "cloth.unroll": f("cloth-flap", 0.5),
  "cloth.settle": f("cloth-2", 0.35),
  "cloth.read": f("cloth-1", 0.3),
  "rope.cut": f("cable-cut", 0.8),
  // chains and metal
  "chain.rattle": f("chain", 0.5),
  "chain.run": f("chain", 0.55, 0.85),
  "censer.chain": f("chain", 0.3, 1.25),
  "armour.rattle": f("chain", 0.4, 0.7),
  "armour.land": f("metal-heavy", 0.6),
  "anvil.strike": f("metal-heavy", 0.5, 1.15),
  "lever.pull": f("lever-pull", 0.7),
  "lever.clank": f("metal-heavy", 0.6),
  "lever.stuck": f("door-rattle", 0.5, 0.7),
  "bell.small": f("bell-ferry", 0.4, 1.8),
  "cable.creak": f("crank", 0.25, 0.5),
  "crank.turn": f("crank", 0.6),
  "shutter.open": f("crank", 0.55, 0.85),
  "crane.run": f("lift-start", 0.6, 0.8),
  "crane.stop": f("lift-dock", 0.6),
  "gate.rattle": f("door-rattle", 0.5, 0.8),
  "gate.open": f("door-open", 0.6, 0.8),
  "gate.lift": f("lift-start", 0.6, 0.9),
  // doors
  "door.open": f("door-open", 0.6),
  "door.close": f("door-close", 0.6),
  "door.shut": f("door-close", 0.7),
  "door.rattle": f("door-rattle", 0.55),
  "door.unlatch": f("unlatch", 0.7),
  // glass, seals, the rose window
  "glass.shatter": f("glass-shatter", 0.7),
  "glass.clink": f("clink", 0.4, 1.3),
  "seal.form": f("shard-reassemble", 0.6, 0.8),
  "seal.spent": f("glass-hit", 0.4, 0.5),
  seal: f("glass-hit", 0.35, 0.6),
  "rose.swell": f("shard-reassemble", 0.45, 0.6),
  // flames and lamps
  "flame.light": f("flame-light", 0.6),
  "flame.gutter": f("flame-gutter", 0.5),
  "shrine.rest": f("flame-light", 0.7, 0.85),
  "lamp.on": f("flame-light", 0.45),
  "lamp.off": f("flame-gutter", 0.4),
  "lamp.spark": f("neon-spark", 0.35),
  "fire.crackle": f("flame-light", 0.3, 1.3),
  // neon, screens, the terminal, radio
  "neon.spark": f("neon-spark", 0.4),
  "neon.buzz": f("neon-buzz", 0.35),
  "display.buzz": f("neon-buzz", 0.3, 0.8),
  "tube.tick": f("neon-spark", 0.2, 1.4),
  "spark.crackle": f("neon-spark", 0.45, 0.9),
  "warning.on": f("clink", 0.4, 0.7),
  "radio.crackle": f("neon-spark", 0.25, 0.8),
  "terminal.wake": f("telegraph", 0.6),
  "terminal.summon": f("telegraph", 0.7, 0.8),
  "terminal.cool": f("telegraph", 0.4, 0.6),
  "terminal.deny": f("hit-metal", 0.35, 0.6),
  // paper and books
  "paper.open": f("paper-open", 0.6),
  "paper.turn": f("paper-open", 0.5, 1.15),
  "paper.flutter": f("paper-cut", 0.35, 0.8),
  "page.turn": f("paper-open", 0.5, 1.15),
  "page.flutter": f("paper-open", 0.35, 1.4),
  "plaque.read": f("paper-open", 0.35),
  // water
  "water.splash": f("splash-1", 0.6),
  "water.step": f("step-water-1", 0.8),
  "water-wash": f("splash-2", 0.55, 0.55),
  "water.wash": f("splash-2", 0.55, 0.55),
  "ferry.wave": f("splash-2", 0.4, 0.8),
  "ferry.board": f("wood-knock", 0.6, 0.8),
  // plants
  "leaf.cut": f("leaf-rustle", 0.55, 1.1),
  "leaf.rustle": f("leaf-rustle", 0.35),
  "reed.rustle": f("leaf-rustle", 0.35, 0.8),
  // furniture and things
  "bench.sit": f("bench-sit", 0.6),
  "shelf.rattle": f("door-rattle", 0.35, 1.3),
  "luggage.tip": f("thud", 0.6),
  "dummy.hit": f("thud", 0.5, 1.1),
  "dummy.thump": f("thud", 0.7, 0.8),
  "luggage.right": f("wood-knock", 0.5),
  "barrel.roll": f("wood-knock", 0.5, 0.6),
  "pillar.topple": f("stone-break", 0.8, 0.7),
  "bridge.fall": f("wood-break", 0.8, 0.7),
  "bridge.slam": f("wood-break", 0.7, 0.8),
  "kettle.lid": f("clink", 0.4, 0.9),
  "cup.rattle": f("clink", 0.3, 1.2),
  "cup.clink": f("clink", 0.4),
  "donate.chime": f("confirm", 1),
  // people (no voices: the rustle of a shawl, a sleeve)
  "keeper.speak": f("cloth-2", 0.25, 0.9),
  "keeper.look": f("cloth-1", 0.2),
  "archivist.hum": f("cloth-1", 0.15, 0.8),
  // the world
  "colossus.footfall": f("colossus-footfall", 0.9),
  "colossus-footfall": f("colossus-footfall", 0.9),
  "grit.sift": f("grit-sift", 0.6),
  "culvert.horn": f("horn", 0.7),
  horn: f("horn", 0.7),
  "steam.hiss": f("whoosh", 0.25, 1.6),
  "steam.burst": f("whoosh", 0.5, 1.2),
  "storm.tell": f("whoosh", 0.35, 0.55),
  "storm.gust": f("whoosh", 0.55, 0.45),
};

/** Which bell a place rings (a hanging bell, the lodge counter's desk bell). */
export const BELLS: { match: RegExp; cue: Cue }[] = [
  { match: /^A3$/, cue: f("bell-ferry", 0.5, 1.6) }, // the counter's desk bell: the ferry bell's metal, smaller
  { match: /^(A\d|S2)$/, cue: f("bell-ferry", 0.8) },
  { match: /^(B\d|E1|E2)$/, cue: f("bell-rib", 0.8) },
  { match: /^(E3|E4)$/, cue: f("bell-chapel", 0.9) },
];
const bellFor = (room: string): Cue => BELLS.find((b) => b.match.test(room))?.cue ?? f("bell-rib", 0.8);

export const TABLES: SoundTables = {
  base: "/audio/world",
  music: { theme: "music/theme-b", arena: "music/arena-chamber" },
  beds: {
    exterior: "beds/exterior",
    interior: "beds/interior",
    water: "beds/lake",
    lake: "beds/lake",
    reeds: "beds/reeds",
    plain: "beds/plain",
    colossus: "beds/plain",
    shaft: "beds/shaft",
    market: "beds/market",
    archive: "beds/archive",
    waiting: "beds/waiting",
    storm: "beds/storm",
    alcove: "beds/alcove",
    dusk: "beds/dusk",
    chapel: "beds/chapel",
    lodge: "beds/lodge",
  },
  files,
  cues: { ...families, ...events, "bell.ring": bellFor("A1"), bell: bellFor("A1") },
  steps,
  restAfterEnd: [45, 90],
};

/**
 * Wind alone (section 9): at Stonetop the music ducks out while the colossus
 * passes at eye level, held `hold` seconds past the keeper's last "passing"
 * so a flicker at the edge of its window never lets the music bob back.
 */
export const WIND_ALONE = { room: "B2", area: "B4", keeper: "keeper", db: 30, hold: 2 };

let windDuck = 0;
let lastPass = -1e9;

export const worldSound: SoundHooks = {
  id: "s1-world-sound",
  tables: TABLES,
  enter(room: string, _area: string | null, _api: WorldApi): void {
    const bell = bellFor(room);
    registerSound({ cues: { "bell.ring": bell, bell } });
  },
  tick(api: WorldApi): void {
    const w = WIND_ALONE;
    const here = api.room() === w.room && api.area() === w.area;
    if (here && api.prop(w.keeper)?.state === "passing") lastPass = api.time();
    const on = here && api.time() - lastPass < w.hold;
    const want = on ? w.db : 0;
    if (want !== windDuck) {
      windDuck = want;
      api.duck("colossus", want);
    }
  },
};
