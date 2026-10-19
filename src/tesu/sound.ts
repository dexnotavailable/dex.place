// Tesu's sound (GDK 3.9, 4, Appendix C). Every sound is a recorded file: nothing is synthesized. (Dex 10-19: "the
// game still has the old chiptune-ish music from the old procedural stuff": the placeholder score and the lab's
// oscillator stand-ins are gone; a cue with no file is silent until its sound exists.)
//
// - Effects: every cue id the game emits (her moves, the court, things breaking, the opening) maps to its files, a
//   volume and a rate (CUES). "<dir>/<name>" is an encoded pair under /audio/ (.opus, or .m4a where Opus is not
//   played); "world/sfx/<name>.wav" is the old generic library, not yet vetted (audio.test.mjs keeps that list from
//   growing). An id not in the table, or with an empty file list, is silent. A cue may bring layers (`with`: the hit's
//   body and tail, the big hits' sub) and dip the music under it (`duck`).
// - Her sounds land on her drawings: the swing on the move's hit tick (the anim.json `hits` drawing; the controller's
//   swingFx), the hit when the blade connects, footsteps by ground material on the drawings where a foot lands
//   (STEP_FRAMES, read off the run and walk art).
// - Her voice (VOICE, Dex-approved takes): kiai on her swings now and then, the jump, the dash, the hurt, the knockdown,
//   the defeat, the respawn, the Q and E calls, the R call and the transform in the ult register; through the voice bus
//   (mix.ts: EQ, compression, saturation, the space's reverb, pan), the music ducking under it.
// - Beds: the ambience per place, cross-faded (the lake, the heights, the hall).
// - Region themes (region-music.ts): each place's main theme, streamed, after the opening.
// - The opening plays Track 1, owned by the page's conductor (opening/conductor.ts) on the page's AudioContext, which
//   this module shares (start(ctx)).
//
// Nothing starts abruptly: the first sound of a visit waits for the visitor's first click, key or tap and swells in.
// While the world waits for the opening's press it stays silent (the plan's D10: the first sound anyone hears is
// Track 1's first piano note).

import { Ducker, SPACES, VOICE_MIX, VoiceBus, type Space } from "./mix.ts";
import { RegionMusic } from "./region-music.ts";

const AUDIO = "/audio/";

/**
 * A cue's files: one is picked per play. "<dir>/<name>" is an encoded pair under /audio/ (.opus or .m4a, whichever
 * the browser plays); "world/sfx/<name>.wav" is a legacy file. An empty list is a silent cue (no sound yet).
 */
interface Cue {
  files: string[];
  vol: number;
  rate: number;
  /** Other cues played with it, at the same instant (layers: an impact's body and tail, a sub hit). */
  with?: string[];
  /** Dips the music (dB) and the other effects (half that) while it hits: the big hits. */
  duck?: number;
}

/** A legacy library file (world/sfx, not vetted yet). */
const c = (file: string, vol = 1, rate = 1): Cue => ({ files: [`world/sfx/${file}.wav`], vol, rate });
/** Encoded pairs under /audio/<dir>/. */
const pairs = (dir: string) => (names: string[], vol = 1, rate = 1, more: Partial<Cue> = {}): Cue => ({ files: names.map((n) => `${dir}/${n}`), vol, rate, ...more });
const court = pairs("court");
const her = pairs("her");
const opening = pairs("opening");
const steps = pairs("steps");
const props = pairs("props");
/** No sound for it yet: silent (not a stand-in). */
const SILENT: Cue = { files: [], vol: 0, rate: 1 };

/** Ground materials (world/types.ts Surface), each with its own footsteps. */
export const SURFACES = ["wood", "stone", "earth", "grass", "tile", "water"] as const;
/** Footstep takes per material (steps/<material>-<n>). */
export const STEP_TAKES = 4;
const stepCue = (m: string, vol: number): Cue => steps(Array.from({ length: STEP_TAKES }, (_, i) => `${m}-${i + 1}`), vol);

/**
 * Cue id -> files. The court's and the props' breaks, tinks and effects are Dex-approved (best or ok in
 * lanes/audio/VETTING.json). Her sounds (her/), her footsteps (steps/), the opening's sounds (opening/) and some of the
 * world's (props/) are the audio lane's ElevenLabs takes, on the vetting page for Dex's ear; the opening's voice lines
 * (opening/line*) are Dex's picks. The rest is the old library (recorded CC0 derivatives), not yet vetted.
 */
export const CUES: Record<string, Cue> = {
  // things breaking (props.ts: `<material>.hit`, `<material>.break`). Breaks: approved (wood thick / thin board,
  // clay, paper: Dex "good but speed up", so the paper break plays at 1.25x)
  "wood.hit": c("wood-hit", 0.6), "wood.break": court(["wood-break-a", "wood-break-b"], 0.75),
  "stone.hit": c("stone-hit", 0.55), "stone.break": c("stone-break", 0.75),
  "clay.hit": c("glass-hit", 0.45, 0.7), "clay.break": court(["clay-break-a"], 0.6),
  "paper.hit": props(["paper-hit"], 0.5), "paper.break": court(["paper-break-b"], 0.55, 1.25),
  "metal.hit": c("metal-hit", 0.55), "metal.break": c("metal-heavy", 0.6),
  debris: props(["debris"], 0.5), thud: c("thud", 0.5),
  // protected things pass the sword with a tink (props.ts): one of the approved bells, at random
  tink: court(["tink-a", "tink-c", "tink-d"], 0.7),
  // splashes, debris, the paper graze, the panel and the lifts: the audio lane's takes (the old synthesized ones are gone)
  splash: props(["splash"], 0.8), "lift-start": props(["lift-start"], 0.6), "lift-dock": props(["lift-dock"], 0.6),
  // the court: the gong at a bout's start, the poof in and out, the crowd on the win (approved)
  gong: court(["gong-b"], 0.8), poof: court(["poof-c"], 0.6), cheer: court(["crowd-cheer-b"], 0.7),
  // the court's other moments have no approved sound yet: silent (FOR DEX in the lane notebook)
  installed: SILENT, "lion-windup": SILENT, "lion-land": SILENT, stagger: SILENT, finish: SILENT,
  // her: the blade's swing on the hit tick, the windup on the move's first tick (game.ts tells them apart), the hit
  // when it connects in layers (the slice, a body thump, a ringing tail; heavy: a sub under it), the m1_4 chop
  swing: her(["swing-a", "swing-b", "swing-d", "swing-e"], 0.6),
  windup: her(["windup-a"], 0.35),
  hit: her(["hit-c", "hit-d"], 0.7, 1, { with: ["hit.body", "hit.tail"] }),
  "hit.heavy": her(["hit-heavy-a", "hit-heavy-b"], 0.8, 1, { with: ["hit.body", "hit.tail", "hit.sub"] }),
  "hit.body": her(["body-a", "body-b"], 0.5),
  "hit.tail": her(["tail-a", "tail-b"], 0.4),
  "hit.sub": her(["sub-boom-a", "sub-boom-b"], 0.35),
  slam: her(["slam-a"], 0.8, 1, { with: ["hit.body", "hit.sub"] }),
  dash: her(["dash-a", "dash-b"], 0.6),
  jump: her(["jump-a"], 0.5), djump: her(["djump-a"], 0.5),
  land: her(["land-a", "land-b"], 0.55),
  hurt: her(["hurt-d"], 0.7),
  // the big hits (Dex 10-19: "bass hits for the ult"): the Q's blast with a sub drop under it, everything else ducked;
  // the ult's booms (the transform's reveal, the dive's landing). On the controller's own ticks for them (swingFx's
  // q_boom; the R phases), so the combat lane's retiming carries them.
  wave: her(["q-boom-a", "q-boom-b"], 0.85, 1, { with: ["sub.drop"], duck: -9 }),
  ult: her(["sub-boom-a", "sub-boom-b"], 0.9, 1, { duck: -8 }),
  "sub.drop": her(["sub-drop-a"], 0.7),
  "sub.boom": her(["sub-boom-a", "sub-boom-b"], 0.8),
  // the Q's and the R's starts (charge), the R's rise: their sounds wait for the combat lane's timing (wave 2); the
  // calls are her voice (VOICE)
  charge: SILENT, rise: SILENT,
  // footsteps by the ground under her (step.<surface>)
  ...Object.fromEntries(SURFACES.map((m) => [`step.${m}`, stepCue(m, m === "water" ? 0.5 : 0.42)])),
  // doors and panels
  "door-open": c("door-open", 0.5), "panel-open": props(["panel-open"], 0.5),
  // the opening (BEATS.json sfx, booked on the music's clock; under Track 1 at about -18 to -10 dB): the gust that
  // takes the ofuda, its flutter on the wind, the catch, the read, the slap on her hat, the hat jammed down, the brim
  // pushed up, the grip, the burst into the run, the skid. The inhale waits for her voice.
  "op.gust": opening(["gust"], 0.45), "op.paper-flutter": opening(["flutter"], 0.3),
  "op.catch": opening(["catch"], 0.5), "op.read": opening(["read"], 0.35),
  "op.slap": opening(["slap"], 0.6), "op.jam": opening(["jam"], 0.4), "op.brim": opening(["brim"], 0.3),
  "op.hatgrip": opening(["hatgrip"], 0.3), "op.inhale": SILENT,
  "op.burst": opening(["burst"], 0.5), "op.skid": opening(["skid"], 0.45),
  // the opening's voice lines (Dex's picks, lanes/opening/VOICE-CUES.md): the opening lane books them on the music
  ...Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`op.line${i}`, opening([`line${i}`], 1)])),
};

/** The hit's weight comes as its volume (the controller's afterHits: light 0.6, heavier 1): heavier hits sound heavy. */
const HEAVY_FROM = 0.9;

// --- her voice --------------------------------------------------------------------------------------------------

/**
 * A voice moment: the takes in each register (public/audio/voice/<take>, every one "ok" in Dex's listening verdicts,
 * lanes/audio/lane2/voice/VERDICTS.json), how often it speaks, the least time since her last line, and whether it
 * speaks over a line still playing (`prio`). `register: "ult"` always uses the ult register (the R call, the
 * transform); `sub`: a bass hit under it.
 */
export interface VoiceMoment {
  normal: string[];
  ult: string[];
  chance: number;
  gap: number;
  prio: boolean;
  register?: "ult";
  sub?: string;
}

export const VOICE: Readonly<Record<string, VoiceMoment>> = {
  kiai: { normal: ["n-kiai-1", "n-kiai-2", "n-kiai-3"], ult: ["u-kiai-2", "u-kiai-3"], chance: 0.4, gap: 0.6, prio: false },
  jump: { normal: ["n-jump"], ult: ["n-jump"], chance: 0.3, gap: 0.8, prio: false },
  dash: { normal: ["n-dash"], ult: ["n-dash"], chance: 0.35, gap: 0.8, prio: false },
  hurt: { normal: ["n-hurt-1", "n-hurt-2"], ult: ["u-hurt", "u-grunt"], chance: 1, gap: 0.5, prio: true },
  knockdown: { normal: ["n-knockdown"], ult: ["u-hurt"], chance: 1, gap: 0.3, prio: true },
  defeat: { normal: ["n-defeat"], ult: ["n-defeat"], chance: 1, gap: 0.3, prio: true },
  respawn: { normal: ["n-respawn"], ult: ["n-respawn"], chance: 1, gap: 0.3, prio: true },
  q: { normal: ["n-q-call"], ult: ["n-q-call"], chance: 1, gap: 0.3, prio: true },
  e: { normal: ["n-e-call"], ult: ["n-e-call"], chance: 1, gap: 0.3, prio: true },
  r: { normal: ["u-r-call-1", "u-r-call-2"], ult: ["u-r-call-1", "u-r-call-2"], chance: 1, gap: 0, prio: true, register: "ult", sub: "sub.boom" },
  transform: { normal: ["u-transform"], ult: ["u-transform"], chance: 1, gap: 0, prio: true, register: "ult", sub: "sub.drop" },
};
/** Ult-register takes with a baked octave-down double (voice/<take>-dbl), mixed low under them for weight. */
export const DOUBLED = ["u-grunt", "u-hurt", "u-kiai-2", "u-kiai-3", "u-r-call-1", "u-r-call-2", "u-transform"];

/** Her state as the voice follows it (once per frame). */
export interface HerState {
  state: string;
  phase: string | null;
  ult: boolean;
}

/**
 * Which voice moment a game event is (pure, for tests): the move's first tick says "swing" (the windup; the E's tap
 * calls), "charge" starts the Q (the R's charge is its call phase, below), the hit tick's swing may kiai, the jump,
 * the dash, the hurt.
 */
export function voiceFor(id: string, info: { first: boolean; role: string; state: string }): string | null {
  if (id === "swing") return info.first ? (info.role === "e_tap" ? "e" : null) : "kiai";
  if (id === "charge") return info.state === "ult" ? null : "q";
  if (id === "jump" || id === "djump") return "jump";
  if (id === "dash") return info.state === "ult" ? null : "dash";
  if (id === "hurt") return "hurt";
  return null;
}

/** The moment a change of her state is (pure): knocked down, defeated, back up, the R's call, the transform. */
export function voiceForState(prev: HerState | null, now: HerState): string | null {
  if (!prev) return null;
  if (now.state !== prev.state) {
    if (now.state === "down") return "knockdown";
    if (now.state === "dead") return "defeat";
    if (prev.state === "dead") return "respawn";
  }
  if (now.state === "ult" && now.phase !== prev.phase) {
    if (now.phase === "call") return "r";
    if (now.phase === "transform") return "transform";
  }
  return null;
}

/**
 * Her footsteps: the drawings of each cycle where a foot lands, read off the art (the first drawing with the new
 * foot on the ground row: run f001 and f005, walk f002 and f006). They play by the drawing, so a faster cycle
 * keeps its steps on the feet.
 */
export const STEP_FRAMES: Readonly<Record<string, readonly number[]>> = { run: [1, 5], walk: [2, 6] };
/** A walk's steps are softer than a run's. */
const STEP_VOL: Readonly<Record<string, number>> = { run: 1, walk: 0.7 };

/** Picks the footstep for the drawing she shows (once per frame); a drawing that holds does not step twice. */
export class Footsteps {
  private last: string | null = null;

  /** The cue to play for this frame's drawing (slot id, drawing index), or null. */
  update(slot: string | null, index: number, grounded: boolean, surface: string): { id: string; vol: number } | null {
    const key = slot === null ? null : `${slot}:${index}`;
    if (key === this.last) return null;
    this.last = key;
    if (slot === null || !grounded || !STEP_FRAMES[slot]?.includes(index)) return null;
    const id = `step.${surface}`;
    return { id: id in CUES ? id : "step.stone", vol: STEP_VOL[slot] ?? 1 };
  }
}

/** Ambience beds by place (files in world/beds/, opus or m4a). */
export const BEDS: Record<string, string> = {
  lake: "beds/lake",
  heights: "beds/exterior",
  hall: "beds/interior",
};

/** The mix: "full" (the voice bus, layers, ducking) or "dry" (the same sounds, every effect off) for A / B. */
export type MixMode = "full" | "dry";

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  bedBus: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private ext = "opus";
  /** The places' main themes (streamed; they wait for the opening's hand-back). */
  readonly regions = new RegionMusic();
  readonly steps = new Footsteps();
  private bed: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantBed: string | null = null;
  /** Her voice bus (mix.ts) and the duckers the voice and the big hits dip. */
  voiceBus: VoiceBus | null = null;
  private musicDuck: Ducker | null = null;
  private sfxDuck: Ducker | null = null;
  private voiceUntil = 0;
  private lastVoice = -1e9;
  private her: HerState | null = null;
  private space: Space = "open";
  /** A / B (Dex): `?mix=dry` plays every sound with the mix's effects off. */
  mix: MixMode = typeof location !== "undefined" && new URLSearchParams(location.search).get("mix") === "dry" ? "dry" : "full";
  /** Times each cue played (debug and tests). */
  readonly played = new Map<string, number>();
  /** Held silent (the world waits for the opening's press): start() does nothing until it is let go. */
  locked = false;

  constructor() {
    const go = (): void => this.start();
    for (const ev of ["keydown", "pointerdown", "touchend"]) window.addEventListener(ev, go, { capture: true });
  }

  /**
   * The first click, key or tap: the context starts and everything swells in. In the page
   * column the press happens in the page around the world window (PLAY, "continue"), so the
   * page hands its own running context over (`ctx`).
   */
  start(given?: AudioContext): void {
    if (this.locked) return;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!given && !AC) return;
    const ctx = given ?? new AC();
    this.ctx = ctx;
    if (ctx.state === "suspended") void ctx.resume();
    const a = document.createElement("audio");
    this.ext = a.canPlayType('audio/ogg; codecs="opus"') ? "opus" : "m4a";
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 2);
    this.master.connect(ctx.destination);
    // the music and the beds dip under her voice and the big hits; the effects a little
    this.musicDuck = new Ducker(ctx, this.master);
    this.sfxDuck = new Ducker(ctx, this.master);
    for (const k of ["sfxBus", "bedBus"] as const) {
      const g = ctx.createGain();
      g.gain.value = k === "bedBus" ? 0.55 : 0.9;
      g.connect(k === "bedBus" ? this.musicDuck.node : this.sfxDuck.node);
      this[k] = g;
    }
    this.regions.attach(ctx, this.musicDuck.node, this.ext);
    // her voice: the bus has no reverb until its impulse responses are in (a moment after the first press)
    const bus = new VoiceBus(ctx, this.master, {});
    this.voiceBus = bus;
    bus.setDry(this.mix === "dry");
    void Promise.all([...SPACES, "ult"].map(async (k) => [k, await this.load(`${AUDIO}ir/${k}.${this.ext}`)] as const)).then((got) => {
      bus.setIrs(Object.fromEntries(got) as Partial<Record<Space | "ult", AudioBuffer | null>>);
    });
    if (this.wantBed) this.setBed(this.wantBed);
    // her moves and the court's first: the sounds that land on a hit must be decoded before it
    for (const id of Object.keys(CUES)) if (/^(swing|windup|hit|slam|dash|jump|djump|land|hurt|step\.|op\.)/.test(id)) this.preload(id);
    for (const id of ["wood.break", "clay.break", "paper.break", "gong", "poof", "cheer", "tink"]) this.preload(id);
    for (const v of Object.values(VOICE)) for (const t of [...v.normal, ...v.ult]) void this.load(this.urlOf(`voice/${t}`));
  }

  private preload(id: string): void {
    for (const f of CUES[id]!.files) void this.load(this.urlOf(f));
  }

  /** The URL of a cue file (the encoded pairs take the codec the browser plays). */
  private urlOf(file: string): string {
    return file.endsWith(".wav") ? AUDIO + file : `${AUDIO}${file}.${this.ext}`;
  }

  /** The world scrolls out of view (the page column): its sound fades down, and back. */
  setVisible(k: number): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, 0.9 * k), this.ctx.currentTime, 0.4);
  }

  /** A / B: the mix on, or every effect off (the voice bus dry, no layers, no ducking). */
  setMix(mode: MixMode): void {
    this.mix = mode;
    this.voiceBus?.setDry(mode === "dry");
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      const ctx = this.ctx;
      p = !ctx ? Promise.resolve(null) : fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      if (ctx) this.buffers.set(url, p);
    }
    return p;
  }

  /** The cue a game event plays (the hit's weight rides on its volume). */
  static resolve(id: string, volume: number): string {
    return id === "hit" && volume >= HEAVY_FROM ? "hit.heavy" : id;
  }

  /** A sound effect by cue id; `at`: the context time to start it (on a beat of the music), else now. */
  sfx(id: string, volume = 1, at: number | null = null): void {
    id = Sound.resolve(id, volume);
    this.played.set(id, (this.played.get(id) ?? 0) + 1);
    const cue = CUES[id];
    if (!cue || !cue.files.length) return;
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== "running") return;
    const asked = at ?? ctx.currentTime;
    const file = cue.files[Math.floor(Math.random() * cue.files.length)]!;
    // the layers (dry A / B: the main sound alone)
    if (this.mix === "full") for (const w of cue.with ?? []) this.sfx(w, volume, at);
    void this.load(this.urlOf(file)).then((buf) => {
      // late by more than a moment: skip it rather than play it out of time
      if (!buf || !this.sfxBus || ctx.currentTime - asked > (at === null ? 0.25 : 0.06)) return;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = cue.rate * (0.96 + Math.random() * 0.08);
      const g = ctx.createGain();
      g.gain.value = cue.vol * volume;
      s.connect(g);
      g.connect(this.sfxBus);
      const t = Math.max(asked, ctx.currentTime);
      s.start(t);
      if (cue.duck && this.mix === "full") {
        const len = Math.min(1.2, buf.duration * 0.5);
        this.musicDuck?.duck(cue.duck, t, t + len, 0.02, 1.2);
        this.sfxDuck?.duck(cue.duck / 2, t + 0.05, t + len * 0.5, 0.02, 0.6);
      }
      // (the opening) scheduled ahead on the music's clock: a skip can still drop it before it starts
      if (t > ctx.currentTime + 0.005) {
        this.ahead.push({ s, t });
        s.onended = () => { this.ahead = this.ahead.filter((a) => a.s !== s); };
      }
    });
  }

  /**
   * Her sound for a game event (feel.sound through game.ts): the effect, and her voice when the moment calls for it.
   * `first`: the move's first tick (its "swing" is the windup).
   */
  herSound(id: string, volume: number, info: { first: boolean; role: string; state: string; ult: boolean }): void {
    this.sfx(id === "swing" && info.first ? "windup" : id, volume);
    const v = voiceFor(id, info);
    if (v) this.voice(v, info.ult);
  }

  /** Once per frame: her state (the voice's knockdown, defeat, respawn, R call, transform), the space, her pan. */
  follow(her: HerState, space: Space, pan: number): void {
    const v = voiceForState(this.her, her);
    this.her = { ...her };
    if (v) this.voice(v, her.ult);
    if (space !== this.space) {
      this.space = space;
      this.voiceBus?.setSpace(space);
    }
    this.voiceBus?.setPan(pan);
  }

  /** Her voice for a moment (VOICE), on the voice bus, the music ducked under it. */
  voice(kind: string, ult: boolean, rnd: () => number = Math.random): void {
    const m = VOICE[kind];
    const ctx = this.ctx, bus = this.voiceBus;
    if (!m || !ctx || !bus || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (!m.prio && now < this.voiceUntil) return;
    if (now - this.lastVoice < m.gap) return;
    if (rnd() >= m.chance) return;
    const reg = m.register ?? (ult ? "ult" : "normal");
    const takes = reg === "ult" ? m.ult : m.normal;
    const take = takes[Math.floor(rnd() * takes.length)]!;
    this.lastVoice = now;
    this.played.set(`voice:${take}`, (this.played.get(`voice:${take}`) ?? 0) + 1);
    if (m.sub) this.sfx(m.sub, 1);
    const chain = reg === "ult" ? bus.ult : bus.normal;
    const play = (buf: AudioBuffer, gain: number): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain;
      s.connect(g);
      g.connect(chain.input);
      s.start(Math.max(now, ctx.currentTime));
      return s;
    };
    void this.load(this.urlOf(`voice/${take}`)).then((buf) => {
      if (!buf || ctx.currentTime - now > 0.3) return;
      play(buf, 1);
      const t = ctx.currentTime;
      this.voiceUntil = Math.max(this.voiceUntil, t + buf.duration);
      if (this.mix === "full") {
        this.musicDuck?.duck(VOICE_MIX.duck.music, t, t + buf.duration);
        this.sfxDuck?.duck(VOICE_MIX.duck.sfx, t, t + buf.duration);
      }
    });
    if (reg === "ult" && DOUBLED.includes(take) && this.mix === "full") {
      void this.load(this.urlOf(`voice/${take}-dbl`)).then((buf) => {
        if (buf && ctx.currentTime - now <= 0.3) play(buf, VOICE_MIX.ult.double);
      });
    }
  }

  /** Her footstep for the drawing she shows (once per frame; game.ts). */
  footstep(slot: string | null, index: number, grounded: boolean, surface: string): void {
    const s = this.steps.update(slot, index, grounded, surface);
    if (s) this.sfx(s.id, s.vol);
  }

  /**
   * A score cue (the court): the hush ducks the place's theme, the resolve brings it back. (The other cues drove the
   * synthesized placeholder score, which is gone.)
   */
  cue(name: string): void {
    if (name === "music:hush") this.regions.duck(0.4, 0.5);
    else if (name === "music:resolve") this.regions.duck(1, 1.5);
  }

  private ahead: { s: AudioBufferSourceNode; t: number }[] = [];

  /** Drops the effects scheduled ahead that have not started yet (the opening's skip). */
  cancelAhead(): void {
    const ctx = this.ctx;
    const now = ctx?.currentTime ?? Infinity;
    for (const a of this.ahead) {
      if (a.t > now) {
        try { a.s.stop(); } catch { /* already stopped */ }
      }
    }
    this.ahead = [];
  }

  /** The ambience beds' level (1 = as set), reached over `secs` (the opening's hush ducks them). */
  bedLevel(k: number, secs: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bedBus) return;
    const g = this.bedBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0.55 * k, ctx.currentTime + secs);
  }

  /** The ambience bed for where she is (cross-faded over 2 s). */
  setBed(id: string | null): void {
    this.wantBed = id;
    const ctx = this.ctx;
    if (!ctx || !this.bedBus || this.bed?.id === id) return;
    const old = this.bed;
    if (old) {
      old.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
      old.src.stop(ctx.currentTime + 3);
      this.bed = null;
    }
    if (!id || !BEDS[id]) return;
    void this.load(`${AUDIO}world/${BEDS[id]}.${this.ext}`).then((buf) => {
      if (!buf || !this.bedBus || this.wantBed !== id || this.bed) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(1, ctx.currentTime, 0.7);
      src.connect(gain);
      gain.connect(this.bedBus);
      src.start();
      this.bed = { id, src, gain };
    });
  }
}
