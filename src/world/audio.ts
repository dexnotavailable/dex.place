// World sound. Ambience before music; music swells in and never starts
// abruptly (a quiet gap, then a slow rise); rooms that belong together keep
// the music going; reading spots fall silent; the weather is heard (rain,
// wind, thunder after the flash) and muffled through walls.
//
// The music states of WORLD-PLAN section 9 are this file's machine: Ambience
// first, Theme swell, Muffled (a low-pass on the same playhead, -9 dB),
// Ducked, Wind alone (a duck the story drives), Silence (a 4 s fade, the
// playhead keeps running), Opening up (the muffle ramps open over the lift
// ride), Storm (no music), Arena (a 3 s swell in, 6 s out), Grand passage
// (the theme enters at a set cue offset under its own swell), From the top (a
// restart allowed only where a room asks for it), and rest-then-swell (after
// the cue ends, 45 to 90 s of ambience, then the theme swells in again).
//
// Sources, per legacy/site/public/audio ATTRIBUTION.md and the manifest's
// last active runtime ("suno-b-inhabited-v2"):
// - theme: the Suno "B" arrangement Dex picked (suno-theme-b-v1/support), used
//   under Suno's paid-download terms, original theme for dex.place;
// - arena: arena-chamber-v1 (original motif, FluidSynth + GeneralUser GS,
//   recordings permitted);
// - beds: exterior / interior (original deterministic synthesis);
// - effects: original offline synthesis, plus CC0 recorded footsteps.
// The files are served from AUDIO_BASE; in dev that is the legacy folder
// itself (Vite serves the repo root). Shipping the world needs them copied
// into public/audio/ (the sound lane, S1). Contract cue ids without a file
// fall back to the lab's placeholder synth voices.
//
// The sound lane (src/world/sound/**, found by hooks.ts) replaces any table
// here and the base with registerSound(): the runtime owns the state machine,
// the sound lane owns the content (cue points, beds, footsteps).

import { Sfx } from "../lab/engine/sfx.ts";
import type { Surface } from "./room/collision.ts";

export let AUDIO_BASE = "/legacy/site/public/audio";

const MUSIC: Record<string, string> = {
  theme: "world-v1/suno-theme-b-v1/support",
  arena: "v2/arena-chamber-v1",
};
/** Ambience beds by id. The plan's beds (section 9) fall back to the two recorded beds until the sound lane supplies them. */
const BEDS: Record<string, string> = {
  exterior: "world-v1/exterior",
  interior: "world-v1/interior",
  water: "world-v1/exterior",
};
const BED_FALLBACK: Record<string, string> = {
  lake: "exterior",
  reeds: "exterior",
  plain: "exterior",
  shaft: "exterior",
  storm: "exterior",
  dusk: "exterior",
  colossus: "exterior",
  lodge: "interior",
  market: "interior",
  archive: "interior",
  waiting: "interior",
  alcove: "interior",
  chapel: "interior",
};
const FILES: Record<string, string> = {
  "step-concrete-1": "world-v1/recorded-steps-v1/step-concrete-1.wav",
  "step-concrete-2": "world-v1/recorded-steps-v1/step-concrete-2.wav",
  "step-metal-1": "world-v1/recorded-steps-v1/step-metal-1.wav",
  "step-metal-2": "world-v1/recorded-steps-v1/step-metal-2.wav",
  "slash-1": "world-v1/slash-1.wav",
  "slash-2": "world-v1/slash-2.wav",
  "hit-metal": "world-v1/hit-metal.wav",
  "cable-cut": "world-v1/cable-cut.wav",
  "paper-open": "world-v1/paper-open.wav",
  "paper-cut": "world-v1/paper-cut.wav",
  "lift-start": "world-v1/lift-start.wav",
  "lift-dock": "world-v1/lift-dock.wav",
  telegraph: "world-v1/telegraph.wav",
  landing: "world-v1/landing.wav",
  hurt: "world-v1/hurt.wav",
  confirm: "world-v1/confirm.wav",
};

/** World cue ids -> file (with rate and volume) or a lab synth voice. */
const CUES: Record<string, { file?: string; synth?: string; rate?: number; vol?: number }> = {
  swing: { file: "slash", vol: 0.45 },
  land: { file: "landing", vol: 0.5 },
  hurt: { file: "hurt", vol: 0.7 },
  knock: { file: "hit-metal", rate: 0.55, vol: 0.35 },
  clink: { file: "hit-metal", rate: 1.6, vol: 0.3 },
  chime: { file: "confirm", vol: 0.55 },
  bell: { file: "confirm", rate: 1.25, vol: 0.5 },
  latch: { file: "hit-metal", rate: 0.8, vol: 0.5 },
  chain: { file: "hit-metal", rate: 1.3, vol: 0.25 },
  "cable-cut": { file: "cable-cut", vol: 0.8 },
  "paper-open": { file: "paper-open", vol: 0.7 },
  "lift-start": { file: "lift-start", vol: 0.7 },
  "lift-dock": { file: "lift-dock", vol: 0.7 },
  telegraph: { file: "telegraph", vol: 0.7 },
  stone: { synth: "hit", vol: 0.6 },
  "wood-hit": { synth: "hit", vol: 0.7 },
  "wood-break": { synth: "hit_heavy", vol: 0.6 },
  door: { synth: "land", vol: 0.7 },
  rattle: { file: "hit-metal", rate: 0.7, vol: 0.3 },
  gutter: { synth: "dash", vol: 0.25 },
  cloth: { synth: "dash", vol: 0.35 },
  grass: { synth: "swing", vol: 0.3 },
  // pixel-matter families and states (src/pixel emits <family>.hit / .break and per-state cues)
  "stone.hit": { synth: "hit", vol: 0.5 },
  "stone.break": { synth: "hit_heavy", vol: 0.5 },
  "wood.hit": { synth: "hit", vol: 0.6 },
  "wood.break": { synth: "hit_heavy", vol: 0.5 },
  "metal.hit": { file: "hit-metal", vol: 0.35 },
  "glass.hit": { file: "hit-metal", rate: 1.8, vol: 0.25 },
  "glass.break": { file: "hit-metal", rate: 2.2, vol: 0.35 },
  "cloth.hit": { synth: "dash", vol: 0.3 },
  "rope.break": { file: "cable-cut", vol: 0.8 },
  "donate.chime": { file: "confirm", vol: 0.55 },
  "terminal.wake": { file: "telegraph", vol: 0.6 },
  "terminal.summon": { file: "telegraph", rate: 0.8, vol: 0.7 },
};

/** Options for a music entry (WORLD-PLAN section 9 states). */
export interface MusicOpts {
  /** Swell length in seconds (default 9). */
  rise?: number;
  /** Start this many seconds into the cue (the Blade's grand passage). */
  at?: number;
  /** Quiet before the swell starts (default 1.5 s, 2.5 s after another track). */
  delay?: number;
  /** Start again from the top even if the same cue is playing (the chapel only). */
  restart?: boolean;
  /** Seconds a change of level takes, linear (silence: 4; the arena's exit: 6). */
  fade?: number;
}

/** The sound lane's tables (src/world/sound/**): merged over the runtime's defaults. */
export interface SoundTables {
  base?: string;
  music?: Record<string, string>;
  beds?: Record<string, string>;
  files?: Record<string, string>;
  cues?: Record<string, { file?: string; synth?: string; rate?: number; vol?: number }>;
  /** Footsteps: surface -> file ids (alternated) with a rate. */
  steps?: Record<string, { files: string[]; rate?: number; vol?: number }>;
  /** Seconds of ambience after the theme ends before it swells in again from the top ([min, max], default [45, 90]). */
  restAfterEnd?: [number, number];
}

const STEPS: Record<string, { files: string[]; rate?: number; vol?: number }> = {};
let REST: [number, number] = [45, 90];

export function registerSound(t: SoundTables): void {
  if (t.base) AUDIO_BASE = t.base;
  Object.assign(MUSIC, t.music ?? {});
  Object.assign(BEDS, t.beds ?? {});
  Object.assign(FILES, t.files ?? {});
  Object.assign(CUES, t.cues ?? {});
  Object.assign(STEPS, t.steps ?? {});
  if (t.restAfterEnd) REST = t.restAfterEnd;
}

/**
 * A music entry's swell. It runs from the moment the element actually sounds
 * (its first "playing"), never from the clock alone: on a slow connection the
 * music would otherwise arrive late at full level. A level change during the
 * gap or the rise rescales the swell instead of cancelling it; a stall during
 * the rise holds it and resumes where it was.
 */
type Entry = { level: number; rise: number; notBefore: number; started: number | null; held: number | null };
type Track = { el: HTMLAudioElement; gain: GainNode; id: string; path: string; ended: boolean; entry: Entry | null };

export class WorldAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** Muffle: a low-pass on the music bus and its level (-9 dB at full). */
  private muffleFilt: BiquadFilterNode | null = null;
  private muffleGain: GainNode | null = null;
  private muffleNow = 0;
  private bedBus: GainNode | null = null;
  private wxBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private music: Track | null = null;
  private bed: Track | null = null;
  private buffers = new Map<string, AudioBuffer | "loading">();
  private noise: AudioBuffer | null = null;
  private rain: { gain: GainNode; filt: BiquadFilterNode } | null = null;
  private wind: { gain: GainNode; filt: BiquadFilterNode } | null = null;
  private ext = "opus";
  readonly lab = new Sfx();
  muted = false;
  started = false;
  /** What the rooms ask for (kept while the cue rests after it ends). */
  private want: { id: string; level: number } = { id: "none", level: 0 };
  private restTimer = 0;
  /** What the music is doing (debug and tests): id, level, muffle, resting after the end, how many entries (swells) so far. */
  state = { music: "none", level: 0, bed: "none", muffle: 0, resting: false, entries: 0, lastEntry: { id: "", at: 0, rise: 0, delay: 0 }, history: [] as string[] };
  private musicLevel = 0;
  private stepAlt = 0;
  private slashAlt = 0;

  /** Starts sound on the Enter / first tap gesture. */
  start(muted: boolean): void {
    this.muted = muted;
    this.lab.muted = muted;
    if (this.started) return;
    this.started = true;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const a = document.createElement("audio");
    this.ext = a.canPlayType('audio/ogg; codecs="opus"') ? "opus" : "m4a";
    this.master = ctx.createGain();
    this.master.gain.value = muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    const bus = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.master!);
      return g;
    };
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.muffleFilt = ctx.createBiquadFilter();
    this.muffleFilt.type = "lowpass";
    this.muffleFilt.frequency.value = 18000;
    this.muffleFilt.Q.value = 0.5;
    this.muffleGain = ctx.createGain();
    this.muffleGain.gain.value = 1;
    this.musicBus.connect(this.muffleFilt);
    this.muffleFilt.connect(this.muffleGain);
    this.muffleGain.connect(this.master);
    this.bedBus = bus(0.5);
    this.wxBus = bus(0.6);
    this.sfxBus = bus(0.8);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    // pink-ish noise (softer than white) for rain and wind
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.2965;
      b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    this.rain = this.loopNoise("bandpass", 1400, 0.6);
    this.wind = this.loopNoise("lowpass", 380, 0.9);
    void this.preload();
    if (ctx.state === "suspended") void ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.lab.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.25);
  }

  /** The website is up: the world's sound fades and waits (the Enter choice is untouched). */
  setAway(away: boolean): void {
    if (this.ctx && this.master && !this.muted) this.master.gain.setTargetAtTime(away ? 0 : 0.9, this.ctx.currentTime, away ? 0.6 : 0.9);
  }

  /**
   * Effects and footsteps load after the ambience bed has data, two at a
   * time at low priority, footsteps and the player's own moves first, and
   * wait while a music entry is still waiting for its data: on a phone's
   * connection the theme gets the bandwidth, not 70 effect files.
   */
  private async preload(): Promise<void> {
    const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
    for (let k = 0; k < 80 && this.bed && this.bed.el.readyState < 3; k++) await sleep(100);
    const rank = (id: string): number => (id.startsWith("step-") ? 0 : /^(slash|landing|hurt)/.test(id) ? 1 : 2);
    const ids = Object.keys(FILES).sort((a, b) => rank(a) - rank(b));
    let i = 0;
    const lane = async (): Promise<void> => {
      while (i < ids.length) {
        for (let k = 0; k < 300 && this.music?.entry && this.music.entry.started === null; k++) await sleep(100);
        await this.buffer(ids[i++]!);
      }
    };
    await Promise.all([lane(), lane()]);
  }

  private loopNoise(type: BiquadFilterType, freq: number, q: number): { gain: GainNode; filt: BiquadFilterNode } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.wxBus!);
    src.start();
    return { gain, filt };
  }

  private track(path: string, bus: GainNode, loop: boolean, id: string): Track {
    const ctx = this.ctx!;
    const el = new Audio(`${AUDIO_BASE}/${path}.${this.ext}`);
    el.loop = loop;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(bus);
    const t: Track = { el, gain, id, path, ended: false, entry: null };
    el.addEventListener("ended", () => {
      t.ended = true;
      if (this.music === t) this.restThenSwell();
    });
    return t;
  }

  /** The cue ended naturally: ambience holds for 45 to 90 s, then the theme swells in again from its start. */
  private restThenSwell(): void {
    this.state.resting = true;
    const [a, b] = REST;
    window.clearTimeout(this.restTimer);
    this.restTimer = window.setTimeout(() => {
      this.state.resting = false;
      const m = this.music;
      if (m && m.ended && this.want.id === m.id && this.want.level > 0) {
        this.music = null;
        this.setMusic(m.id, this.want.level);
      }
    }, (a + Math.random() * (b - a)) * 1000);
  }

  /** The element sounds: the swell starts now (after its quiet gap), or resumes after a stall. */
  private entryPlaying(t: Track): void {
    const e = t.entry;
    const ctx = this.ctx;
    if (!e || !ctx) return;
    const now = ctx.currentTime;
    if (e.started === null) e.started = Math.max(now, e.notBefore);
    else if (e.held !== null) {
      e.started = now - e.held;
      e.held = null;
    } else return;
    this.swell(t);
  }

  /** The element stalls for data during the rise: hold the level where it is. */
  private entryStalled(t: Track): void {
    const e = t.entry;
    const ctx = this.ctx;
    if (!e || !ctx || e.started === null || e.held !== null) return;
    const now = ctx.currentTime;
    if (now < e.started) return;
    if (now >= e.started + e.rise) {
      t.entry = null;
      return;
    }
    e.held = now - e.started;
    const g = t.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
  }

  /** (Re)schedule the rest of an entry's swell at its current level: silence, then most of the rise in the last two thirds. */
  private swell(t: Track): void {
    const e = t.entry;
    const ctx = this.ctx;
    if (!e || !ctx || e.started === null) return;
    const now = ctx.currentTime;
    const g = t.gain.gain;
    const k1 = e.started + e.rise * 0.35;
    const k2 = e.started + e.rise;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (now >= k2) {
      t.entry = null;
      g.setTargetAtTime(e.level, now, 1.2);
      return;
    }
    if (now < e.started) g.setValueAtTime(g.value, e.started);
    if (now < k1) g.linearRampToValueAtTime(e.level * 0.12, k1);
    g.linearRampToValueAtTime(e.level, k2);
  }

  private fadeOut(t: Track, secs: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    t.entry = null;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(0, now + secs);
    window.setTimeout(() => {
      t.el.pause();
      t.el.src = "";
    }, secs * 1000 + 200);
  }

  /**
   * Muffled: the same playhead low-passed and down about 9 dB (1 = fully
   * muffled, through walls or from a radio); ramps over `secs`, so the lift
   * ride opens it up gradually.
   */
  setMuffle(amount: number, secs = 1.5): void {
    amount = Math.max(0, Math.min(1, amount));
    this.state.muffle = amount;
    const ctx = this.ctx;
    if (!ctx || !this.muffleFilt || !this.muffleGain) return;
    if (Math.abs(amount - this.muffleNow) < 0.01) return;
    this.muffleNow = amount;
    const now = ctx.currentTime;
    const f = 18000 * Math.pow(650 / 18000, amount);
    this.muffleFilt.frequency.cancelScheduledValues(now);
    this.muffleFilt.frequency.setValueAtTime(this.muffleFilt.frequency.value, now);
    this.muffleFilt.frequency.exponentialRampToValueAtTime(f, now + secs);
    this.muffleGain.gain.setTargetAtTime(Math.pow(10, (-9 * amount) / 20), now, secs / 3);
  }

  /** Seconds into the current cue (debug and tests). */
  cueTime(): number {
    return this.music ? this.music.el.currentTime : 0;
  }

  /** Entry history (debug and tests): every swell in and every fade to none. */
  private note(s: string): void {
    const h = this.state.history;
    if (h[h.length - 1] === s && s === "none") return;
    h.push(s);
    if (h.length > 24) h.shift();
  }

  /** Is this cue playing (not resting after its end)? */
  playing(id: string): boolean {
    return !!this.music && this.music.id === id && !this.music.ended;
  }

  /** The current cue id, playing or resting after its end ("none" if nothing). */
  current(): string {
    return this.music ? this.music.id : this.want.id === "none" ? "none" : this.state.music;
  }

  /**
   * Music state and level. A new cue waits through a quiet gap and rises over
   * `rise` seconds (never abrupt); the same cue keeps its playhead and only
   * changes level, unless `restart` asks for the top again.
   */
  setMusic(id: string, level: number, o: MusicOpts | number = {}): void {
    const opts: MusicOpts = typeof o === "number" ? { rise: o } : o;
    const rise = opts.rise ?? 9;
    level = Math.max(0, Math.min(1, level));
    const prevWant = this.want.id;
    this.want = { id, level };
    this.state.level = level;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) {
      // no audio context (tests, blocked audio): keep the machine's bookkeeping honest
      if (id === "none") this.state.music = "none";
      else if (prevWant !== id || opts.restart) {
        this.state.music = id;
        this.state.entries++;
        this.state.lastEntry = { id, at: opts.at ?? 0, rise, delay: opts.delay ?? 1.5 };
        this.note(`${id}${opts.restart ? " restart" : ""} at ${opts.at ?? 0}`);
      } else if (id === "none") this.note("none");
      return;
    }
    const now = ctx.currentTime;
    if (id === "none") {
      if (this.music) {
        this.fadeOut(this.music, opts.fade ?? 4);
        this.note("none");
      }
      this.music = null;
      this.state.music = "none";
      window.clearTimeout(this.restTimer);
      this.state.resting = false;
      return;
    }
    const path = MUSIC[id];
    if (!path) return;
    if (this.music && this.music.id === id && !opts.restart) {
      // the same cue keeps its playhead (rooms that belong together); only the level moves
      const m = this.music;
      const e = m.entry;
      if (m.ended) {
        // resting after its end: restThenSwell brings it back. If the rest ran
        // out while the room wanted silence (the archive), the first room that
        // wants the theme again swells it in from the top.
        if (this.state.resting || level <= 0.001) return;
        this.music = null;
        this.setMusic(id, level, { rise: opts.rise, delay: opts.delay });
        return;
      }
      if (e && (e.started === null || !opts.fade)) {
        // still in its entry (the quiet gap or the rise): rescale the swell, never cancel it
        if (Math.abs(level - e.level) > 0.001) {
          e.level = level;
          this.musicLevel = level;
          if (e.started !== null && e.held === null) this.swell(m);
        }
        return;
      }
      m.entry = null;
      if (Math.abs(level - this.musicLevel) > 0.01) {
        const g = this.music.gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        if (opts.fade) g.linearRampToValueAtTime(level, now + opts.fade);
        else g.setTargetAtTime(level, now, level < this.musicLevel ? 1.2 : 2.4);
        this.musicLevel = level;
      }
      return;
    }
    const gap = opts.delay ?? (this.music ? 2.5 : 1.5);
    if (this.music) this.fadeOut(this.music, 3.5);
    window.clearTimeout(this.restTimer);
    this.state.resting = false;
    // the theme plays through once and rests (rest-then-swell); other cues loop
    const t = this.track(path, this.musicBus, id !== "theme", id);
    this.music = t;
    this.musicLevel = level;
    this.state.music = id;
    this.state.entries++;
    this.state.lastEntry = { id, at: opts.at ?? 0, rise, delay: gap };
    this.note(`${id}${opts.restart ? " restart" : ""} at ${opts.at ?? 0}`);
    if (opts.at) {
      const at = opts.at;
      const seek = (): void => {
        try {
          t.el.currentTime = at;
        } catch {
          // not seekable yet: the metadata listener tries again
        }
      };
      t.el.addEventListener("loadedmetadata", seek, { once: true });
      seek();
    }
    // never abrupt: silence until the element actually sounds (and the gap has
    // passed), then a slow swell with most of it in the last two thirds
    t.gain.gain.setValueAtTime(0, now);
    t.entry = { level, rise, notBefore: now + gap, started: null, held: null };
    t.el.addEventListener("playing", () => this.entryPlaying(t));
    t.el.addEventListener("waiting", () => this.entryStalled(t));
    window.setTimeout(() => {
      if (this.music === t) void t.el.play().catch(() => undefined);
    }, Math.max(0, gap * 1000 - 100));
  }

  /**
   * The storm's sound cuts off: rain and wind reach silence within a quarter
   * second (a short ramp, never a click), the bed with them, thunder is held
   * back, and after `silence` seconds of nothing `bed` comes in (its usual
   * 2.5 s rise). A room change in the meantime cancels the wait.
   */
  cut(silence: number, bed: string | null): void {
    window.clearTimeout(this.bedTimer);
    this.state.bed = bed ?? "none";
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.hushUntil = now + silence;
    for (const n of [this.rain, this.wind]) {
      if (!n) continue;
      const g = n.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.25);
    }
    if (this.bed) this.fadeOut(this.bed, 0.25);
    this.bed = null;
    this.bedTimer = window.setTimeout(() => this.setBed(bed), silence * 1000);
  }
  private hushUntil = 0;
  private bedTimer = 0;

  setBed(id: string | null, level = 1): void {
    window.clearTimeout(this.bedTimer);
    this.state.bed = id ?? "none";
    const ctx = this.ctx;
    if (!ctx || !this.bedBus) return;
    const path = id ? BEDS[id] ?? BEDS[BED_FALLBACK[id] ?? "exterior"] ?? null : null;
    if (this.bed && this.bed.path === path) {
      this.bed.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.8);
      return;
    }
    if (this.bed) this.fadeOut(this.bed, 2.5);
    this.bed = null;
    if (!path) return;
    const t = this.track(path, this.bedBus, true, id ?? path);
    this.bed = t;
    t.gain.gain.setValueAtTime(0, ctx.currentTime);
    t.gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 2.5);
    void t.el.play().catch(() => undefined);
  }

  /** Weather sound: rain and wind levels (0..1), and how much comes through walls. */
  setWeather(rain: number, wind: number, through: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.rain || !this.wind) return;
    const now = ctx.currentTime;
    if (now < this.hushUntil) return; // the silence after the storm's cut-off
    this.rain.gain.gain.setTargetAtTime(rain * 0.5 * through, now, 0.6);
    this.rain.filt.frequency.setTargetAtTime(through < 0.8 ? 600 : 1400, now, 0.5);
    this.wind.gain.gain.setTargetAtTime(Math.abs(wind) * 0.45 * through, now, 0.8);
    this.wind.filt.frequency.setTargetAtTime(240 + Math.abs(wind) * 420, now, 0.8);
  }

  /** Thunder: a low rumble, arriving `distance` seconds after its flash (the caller waits). */
  thunder(strength: number, through: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.wxBus || this.muted || ctx.currentTime < this.hushUntil) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(220, now);
    f.frequency.exponentialRampToValueAtTime(70, now + 3);
    const g = ctx.createGain();
    const v = 0.9 * strength * through;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), now + 0.08);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * 0.5), now + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    src.connect(f);
    f.connect(g);
    g.connect(this.wxBus);
    src.start(now, Math.random());
    src.stop(now + 3.6);
  }

  /** A far rumble through the ground (thunder heard underground). */
  rumble(strength: number): void {
    this.thunder(strength * 0.4, 0.5);
  }

  private async buffer(id: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have && have !== "loading") return have;
    if (have === "loading" || !this.ctx) return null;
    const path = FILES[id];
    if (!path) return null;
    this.buffers.set(id, "loading");
    try {
      const res = await fetch(`${AUDIO_BASE}/${path}`, { priority: "low" } as RequestInit);
      if (!res.ok) throw new Error(String(res.status));
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(id, buf);
      return buf;
    } catch {
      this.buffers.delete(id);
      return null;
    }
  }

  private file(id: string, vol: number, rate = 1, pan = 0): boolean {
    const ctx = this.ctx;
    const b = this.buffers.get(id);
    if (!ctx || !this.sfxBus || !b || b === "loading") return false;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g);
    g.connect(p);
    p.connect(this.sfxBus);
    src.start();
    return true;
  }

  /** Footstep on a surface (the sound lane's table first, then the recorded defaults pitched per surface). */
  step(surface: Surface, vol = 0.5): void {
    if (this.muted) return;
    this.stepAlt = 1 - this.stepAlt;
    const table = STEPS[surface];
    if (table && table.files.length) {
      const f = table.files[this.stepAlt % table.files.length]!;
      if (this.file(f, vol * (table.vol ?? 1), table.rate ?? 1)) return;
    }
    if (surface === "water") {
      this.lab.play("dash", vol * 0.3);
      return;
    }
    const metal = surface === "metal" || surface === "grating" || surface === "wet-metal";
    const kind = metal ? "metal" : "concrete";
    const rate = surface === "wood" ? 0.8 : surface === "earth" ? 0.7 : surface === "rug" ? 0.6 : surface === "tile" ? 1.15 : surface === "grating" ? 1.1 : 1;
    const v = vol * (metal ? 0.5 : surface === "rug" ? 0.4 : 1);
    if (!this.file(`step-${kind}-${this.stepAlt + 1}`, v, rate)) this.lab.play("step", vol);
  }

  /** A cue id from the contract or a prop; pan -1..1 from where it happened. */
  play(id: string, vol = 1, pan = 0): void {
    if (this.muted || !this.started) return;
    const c = CUES[id];
    if (!c) {
      this.lab.play(id, vol);
      return;
    }
    if (c.file) {
      let f = c.file;
      if (f === "slash") f = `slash-${(this.slashAlt = 1 - this.slashAlt) + 1}`;
      if (this.file(f, (c.vol ?? 1) * vol, c.rate ?? 1, pan)) return;
    }
    this.lab.play(c.synth ?? id, (c.vol ?? 1) * vol);
  }
}
