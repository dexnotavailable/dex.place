// Tesu's sound (GDK 3.9, 4, Appendix C; brief: "sound design gets redone"). Three parts:
//
// - Effects: every cue id the game emits (her moves, the court, things breaking) maps to its files, a volume and a
//   rate. The court's and the props' breaks, tinks and effects are Dex-approved (public/audio/court/, encoded
//   pairs; lanes/audio/VETTING.json). The rest is the old generic library (public/audio/world/), not yet vetted:
//   audio.test.mjs keeps that list from growing. An id with no file falls back to the lab's synth sounds; a cue
//   with an empty file list is silent (no approved sound yet).
// - Beds: the ambience per place, cross-faded (the lake, the heights, the hall).
// - Region themes (region-music.ts): each place's main theme, streamed, after the opening.
// - The opening plays Track 1, the picked take, owned by the page's conductor (opening/conductor.ts) on the
//   page's AudioContext, which this module shares (start(ctx)); the score below waits while it sounds.
// - Music: the adaptive score. A bar clock always runs (also before the first click, so the
//   opening can arm the drop on it); a theme is a set of stems that loop together, layers
//   fading in over a bar as cues arrive; the drop lands on a bar line. Until Dex's Suno stems
//   exist (lanes/MUSIC-BRIEF.md), a quiet synthesized placeholder plays the same structure
//   (drum layers, the drop, the arena's drive), so the layering can be judged by ear.
//
// Nothing starts abruptly: the first sound of a visit waits for the visitor's first click,
// key or tap and swells in; every layer fades in over a bar. While the world waits for the opening's press it
// stays silent (the plan's D10: the first sound anyone hears is Track 1's first piano note).

import { Sfx } from "../lab/engine/sfx.ts";
import { RegionMusic } from "./region-music.ts";

const BASE = "/audio/world/";
const AUDIO = "/audio/";

/**
 * A cue's files: one is picked per play. "court/<name>" is an encoded pair (.opus or .m4a, whichever the browser
 * plays); "world/sfx/<name>.wav" is a legacy file. An empty list is a silent cue (no approved sound yet).
 */
interface Cue {
  files: string[];
  vol: number;
  rate: number;
}

const c = (file: string, vol = 1, rate = 1): Cue => ({ files: [`world/sfx/${file}.wav`], vol, rate });
const a = (names: string[], vol = 1, rate = 1): Cue => ({ files: names.map((n) => `court/${n}`), vol, rate });
/** Dex's list has no approved sound for it yet: silent (not a stand-in). */
const SILENT: Cue = { files: [], vol: 0, rate: 1 };

/**
 * Cue id -> files. Ids not here fall back to the lab's synth sounds (her own moves). The court's and the props'
 * breaks, tinks and effects are Dex-approved (best or ok in lanes/audio/VETTING.json). The rest of the table is
 * the old generic library, not yet vetted; audio.test.mjs keeps that list from growing.
 */
export const CUES: Record<string, Cue> = {
  // things breaking (props.ts: `<material>.hit`, `<material>.break`). Breaks: approved (wood thick / thin board,
  // clay, paper: Dex "good but speed up", so the paper break plays at 1.25x)
  "wood.hit": c("wood-hit", 0.6), "wood.break": a(["wood-break-a", "wood-break-b"], 0.75),
  "stone.hit": c("stone-hit", 0.55), "stone.break": c("stone-break", 0.75),
  "clay.hit": c("glass-hit", 0.45, 0.7), "clay.break": a(["clay-break-a"], 0.6),
  "paper.hit": c("paper-cut", 0.5), "paper.break": a(["paper-break-b"], 0.55, 1.25),
  "metal.hit": c("metal-hit", 0.55), "metal.break": c("metal-heavy", 0.6),
  debris: c("grit-sift", 0.4, 1.3), thud: c("thud", 0.5),
  // protected things pass the sword with a tink (props.ts): one of the approved bells, at random
  tink: a(["tink-a", "tink-c", "tink-d"], 0.7),
  splash: c("splash-1", 0.9), "lift-start": c("lift-start", 0.6), "lift-dock": c("lift-dock", 0.6),
  // the court: the gong at a bout's start, the poof in and out, the crowd on the win (approved)
  gong: a(["gong-b"], 0.8), poof: a(["poof-c"], 0.6), cheer: a(["crowd-cheer-b"], 0.7),
  // the court's other moments have no approved sound yet: silent (FOR DEX in the lane notebook)
  installed: SILENT, "lion-windup": SILENT, "lion-land": SILENT, stagger: SILENT, finish: SILENT,
  // her moves that have a recorded sound
  hurt: c("hurt", 0.6), land: c("landing", 0.5), dash: c("whoosh", 0.45, 1.2),
  // doors and panels
  "door-open": c("door-open", 0.5), "panel-open": c("paper-open", 0.45),
  // the opening (its own ids for the audio lane; stand-ins from the files we have, under the music at -18 to
  // -10 dB, the slap and the burst on their drum hits: BEATS.json sfx)
  "op.gust": c("whoosh", 0.3, 0.7), "op.paper-flutter": c("cloth-flap", 0.12, 1.6),
  "op.catch": c("paper-open", 0.32, 1.1), "op.read": c("paper-open", 0.2, 1.25),
  "op.slap": c("wood-knock", 0.32), "op.jam": c("cloth-1", 0.25), "op.brim": c("cloth-2", 0.2),
  "op.hatgrip": c("cloth-2", 0.2, 0.9), "op.inhale": c("whoosh", 0.18, 0.5),
  "op.burst": c("whoosh", 0.3, 1.1), "op.skid": c("grit-sift", 0.3),
};

/** Ambience beds by place (files in beds/, opus or m4a). */
export const BEDS: Record<string, string> = {
  lake: "beds/lake",
  heights: "beds/exterior",
  hall: "beds/interior",
};

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  bedBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lab = new Sfx();
  private ext = "opus";
  readonly music: Music;
  /** The places' main themes (streamed; they wait for the opening's hand-back). */
  readonly regions = new RegionMusic();
  private bed: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantBed: string | null = null;
  /** Times each cue played (debug and tests). */
  readonly played = new Map<string, number>();
  /** Held silent (the world waits for the opening's press): start() does nothing until it is let go. */
  locked = false;

  constructor() {
    this.music = new Music(this);
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
    for (const k of ["sfxBus", "bedBus", "musicBus"] as const) {
      const g = ctx.createGain();
      g.gain.value = k === "bedBus" ? 0.55 : k === "musicBus" ? 0.6 : 0.9;
      g.connect(this.master);
      this[k] = g;
    }
    this.music.attach(ctx);
    this.regions.attach(ctx, this.master!, this.ext);
    if (this.wantBed) this.setBed(this.wantBed);
    for (const id of ["wood.break", "clay.break", "paper.break", "debris", "gong", "poof", "cheer", "tink"]) this.preload(id);
    for (const id of Object.keys(CUES)) if (id.startsWith("op.")) this.preload(id);
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

  /** A sound effect by cue id; `at`: the context time to start it (on a beat of the music), else now. */
  sfx(id: string, volume = 1, at: number | null = null): void {
    this.played.set(id, (this.played.get(id) ?? 0) + 1);
    const cue = CUES[id];
    if (!cue) {
      this.lab.play(id, volume);
      return;
    }
    if (!cue.files.length) return;
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== "running") return;
    const asked = at ?? ctx.currentTime;
    const file = cue.files[Math.floor(Math.random() * cue.files.length)]!;
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
      // (the opening) scheduled ahead on the music's clock: a skip can still drop it before it starts
      if (t > ctx.currentTime + 0.005) {
        this.ahead.push({ s, t });
        s.onended = () => { this.ahead = this.ahead.filter((a) => a.s !== s); };
      }
    });
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
    void this.load(`${BASE}${BEDS[id]}.${this.ext}`).then((buf) => {
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

// --- the adaptive score ------------------------------------------------------------------------

/** A theme: its tempo, and (when Dex's stems exist) one file per layer looping together. */
interface Theme {
  bpm: number;
  beats: number;
  /** Stem files per layer, in the order they come in; empty: the synthesized placeholder. */
  stems: string[];
  /** The drop's stem (calm) and the landscape form after it. */
  drop?: string;
}

const THEMES: Record<"calm" | "intense", Theme> = {
  // 120 bpm: a bar is 2 s, so the drop waits at most two seconds after the terrace arms it
  calm: { bpm: 120, beats: 4, stems: [] },
  intense: { bpm: 140, beats: 4, stems: [] },
};

type Mood = "off" | "calm" | "intense" | "hall";

/**
 * The score: a bar clock that always runs, the mood (calm, intense, the hall's quiet), the
 * layers that are in, and the drop. cue() takes the game's cues: "calm:start",
 * "calm:layer:N", "calm:drop", "music:arena", "music:hush", "music:resolve", "music:hall".
 */
export class Music {
  private t0 = performance.now() / 1000;
  mood: Mood = "off";
  /** Another music is playing (the opening's Track 1): this score waits, silent, until it ends. */
  held = false;
  layers = 0;
  dropped = false;
  private hush = false;
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  /** The last 16th scheduled (in clock 16ths). */
  private next16 = -1;
  private resolveAt = -1;
  private sound: Sound;
  /** Stems playing (when the theme has files): one gain per layer, all looping on the bar clock. */
  private stems: { theme: "calm" | "intense"; layer: number; gain: GainNode }[] = [];
  private stemsFor: string | null = null;

  constructor(sound: Sound) {
    this.sound = sound;
  }

  get theme(): Theme {
    return THEMES[this.mood === "intense" ? "intense" : "calm"];
  }

  /** Seconds since the clock started. */
  now(): number {
    return performance.now() / 1000 - this.t0;
  }

  barSeconds(): number {
    const t = this.theme;
    return (60 / t.bpm) * t.beats;
  }

  /** Seconds until the next bar line (the opening arms the drop on it). */
  nextBar(): number {
    const b = this.barSeconds();
    const r = b - (this.now() % b);
    return r < 0.02 ? r + b : r;
  }

  cue(name: string): void {
    if (name === "calm:start") { this.mood = "calm"; this.layers = 0; this.dropped = false; }
    else if (name.startsWith("calm:layer:")) { if (this.mood === "off") this.mood = "calm"; this.layers = Math.max(this.layers, Number(name.slice(11))); }
    else if (name === "calm:drop") { this.mood = "calm"; this.dropped = true; this.layers = 5; }
    else if (name === "music:arena") { this.mood = "intense"; this.hush = false; }
    else if (name === "music:hush") { this.hush = true; this.sound.regions.duck(0.4, 0.5); }
    else if (name === "music:resolve") { this.hush = false; this.resolveAt = this.now() + this.nextBar(); this.sound.regions.duck(1, 1.5); }
    else if (name === "music:hall") { if (this.mood !== "intense") { this.mood = "hall"; } }
    else if (name === "music:land") { if (this.mood !== "intense") { this.mood = "calm"; this.dropped = true; this.layers = 2; } }
  }

  attach(ctx: AudioContext): void {
    this.ctx = ctx;
    // the clock keeps its phase: audio time lines up with the bar clock that was already running
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.55;
    this.bus.connect(this.sound.musicBus!);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  /**
   * Stems: every stem of a theme starts together on a bar line and loops; a layer is a gain
   * that fades in over a bar when its cue comes (the drop's stem replaces the drum layers).
   */
  private stemTick(): boolean {
    const ctx = this.ctx!;
    const key = this.mood === "intense" ? "intense" : "calm";
    const th = THEMES[key];
    const files = [...th.stems, ...(th.drop ? [th.drop] : [])];
    if (!files.length) return false;
    if (this.stemsFor !== key) {
      this.stemsFor = key;
      const at = ctx.currentTime + this.nextBar();
      files.forEach((f, i) => {
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.connect(this.bus!);
        this.stems.push({ theme: key, layer: i < th.stems.length ? i + 1 : 99, gain });
        void fetch(f).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(gain);
          // join the loop in phase with the bar clock, however late the file arrived
          const late = Math.max(0, ctx.currentTime - at);
          src.start(Math.max(at, ctx.currentTime), late % buf.duration);
        }).catch(() => {});
      });
    }
    const fade = this.barSeconds() / 3;
    for (const st of this.stems) {
      let on = st.theme === key;
      if (on && key === "calm") on = st.layer === 99 ? this.dropped : !this.dropped ? st.layer <= this.layers : st.layer <= 2;
      if (on && key === "intense" && this.hush) on = st.layer <= 1;
      st.gain.gain.setTargetAtTime(on ? 1 : 0.0001, ctx.currentTime, fade);
    }
    return true;
  }

  /** The look-ahead scheduler: the placeholder's hits for the next 0.2 s, on the clock's grid. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.mood === "off" || this.held) return;
    if (this.stemTick()) return;
    const th = this.theme;
    const s16 = 60 / th.bpm / 4;
    const offset = ctx.currentTime - this.now();
    const until = this.now() + 0.2;
    let k = Math.max(this.next16 + 1, Math.ceil(this.now() / s16));
    for (; k * s16 < until; k++) {
      this.next16 = k;
      const at = k * s16 + offset;
      if (at < ctx.currentTime) continue;
      if (this.resolveAt >= 0 && k * s16 >= this.resolveAt) {
        this.resolveAt = -1;
        this.mood = "calm";
        this.dropped = true;
        this.layers = 2;
        this.chord(at, 3.2, 0.5);
      }
      this.step(k % (th.beats * 4), Math.floor(k / (th.beats * 4)), at);
    }
  }

  /** One 16th of the placeholder score. */
  private step(i: number, bar: number, at: number): void {
    const L = this.layers, m = this.mood;
    if (m === "hall") {
      if (i === 0 && bar % 2 === 0) this.chord(at, 6, 0.18);
      return;
    }
    if (m === "intense") {
      const q = this.hush ? 0.35 : 1;
      if (i % 4 === 0) this.drum(at, 62, 0.5 * q);
      if (i % 8 === 4) this.drum(at, 180, 0.32 * q, 0.08);
      if (i % 2 === 1) this.tick(at, 0.06 * q);
      if (i === 14 || i === 15) this.drum(at, 90, 0.3 * q);
      if (i === 0 && bar % 2 === 0) this.chord(at, 3.4, 0.22 * q, true);
      return;
    }
    // calm: the build, layer by layer, then the drop and the landscape form
    if (this.dropped) {
      if (i === 0 && bar % 2 === 0) this.chord(at, 6.5, 0.26);
      if (i === 0) this.drum(at, 55, 0.35);
      if (L >= 2 && (i === 6 || i === 10)) this.pluck(at, [294, 330, 392, 440, 587][(bar * 3 + i) % 5]!, 0.08);
      return;
    }
    if (L >= 1 && i === 0) this.drum(at, 58, 0.42);
    if (L >= 2 && i === 8) this.drum(at, 64, 0.34);
    if (L >= 2 && (i === 4 || i === 12)) this.drum(at, 170, 0.16, 0.06);
    if (L >= 3 && i % 2 === 0) this.tick(at, 0.035);
    if (L >= 4 && i >= 12) this.drum(at, 80 + i * 4, 0.12 + (i - 12) * 0.04);
    if (L >= 5 && (i === 0 || i === 3 || i === 6)) this.drum(at, 48, 0.5);
    if (L === 0 && i === 0 && bar % 2 === 0) this.pluck(at, 294, 0.06);
  }

  // --- the placeholder's instruments (synthesized; replaced by stems) -------------------------------

  private env(at: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(this.bus!);
    return g;
  }

  /** A taiko-ish drum: a pitched body falling in pitch, a soft skin noise. */
  private drum(at: number, f: number, v: number, decay = 0.45): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 1.6, at);
    o.frequency.exponentialRampToValueAtTime(f, at + 0.05);
    o.connect(this.env(at, v, 0.004, decay));
    o.start(at);
    o.stop(at + decay + 0.1);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    n.connect(lp);
    lp.connect(this.env(at, v * 0.35, 0.002, 0.08));
    n.start(at, Math.random() * 0.5);
    n.stop(at + 0.15);
  }

  private tick(at: number, v: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = 3200;
    n.connect(hp);
    hp.connect(this.env(at, v, 0.002, 0.04));
    n.start(at, Math.random() * 0.5);
    n.stop(at + 0.08);
  }

  private pluck(at: number, f: number, v: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(this.env(at, v, 0.005, 1.2));
    o.start(at);
    o.stop(at + 1.3);
  }

  /** A sustained chord (the drop, the landscape form, the arena's pad): D minor pentatonic. */
  private chord(at: number, len: number, v: number, dark = false): void {
    const ctx = this.ctx!;
    const notes = dark ? [73.4, 110, 146.8, 174.6] : [146.8, 220, 293.7, 329.6, 440];
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(400, at);
    lp.frequency.linearRampToValueAtTime(1600, at + len * 0.4);
    lp.connect(this.env(at, v, len * 0.25, len * 0.75));
    for (const f of notes) {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(at);
        o.stop(at + len + 0.1);
      }
    }
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}
