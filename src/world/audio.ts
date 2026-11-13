// World sound. Ambience before music; music swells in and never starts
// abruptly (a quiet gap, then a slow rise); rooms that belong together keep
// the music going; reading spots fall silent; the weather is heard (rain,
// wind, thunder after the flash) and muffled through walls.
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
// into public/audio/ (docs/world/RUNTIME.md). Contract cue ids without a file
// fall back to the lab's placeholder synth voices.

import { Sfx } from "../lab/engine/sfx.ts";
import type { Surface } from "./room/collision.ts";

export const AUDIO_BASE = "/legacy/site/public/audio";

const MUSIC: Record<"theme" | "arena", string> = {
  theme: "world-v1/suno-theme-b-v1/support",
  arena: "v2/arena-chamber-v1",
};
const BEDS: Record<"exterior" | "interior" | "water", string> = {
  exterior: "world-v1/exterior",
  interior: "world-v1/interior",
  water: "world-v1/exterior",
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
};

type Track = { el: HTMLAudioElement; gain: GainNode; id: string };

export class WorldAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
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
  /** What the music is doing (debug): id, level. */
  state = { music: "none", level: 0, bed: "none" };
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
    this.musicBus = bus(0.55);
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
    for (const id of Object.keys(FILES)) void this.buffer(id);
    if (ctx.state === "suspended") void ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.lab.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.25);
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

  private track(path: string, bus: GainNode): Track {
    const ctx = this.ctx!;
    const el = new Audio(`${AUDIO_BASE}/${path}.${this.ext}`);
    el.loop = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(bus);
    return { el, gain, id: path };
  }

  private fadeOut(t: Track, secs: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(0, now + secs);
    window.setTimeout(() => {
      t.el.pause();
      t.el.src = "";
    }, secs * 1000 + 200);
  }

  /**
   * Music state and level. A new track waits through a quiet gap and rises
   * over `rise` seconds; the same track only changes level (slowly).
   */
  setMusic(id: "theme" | "arena" | "none", level: number, rise = 9): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    level = Math.max(0, Math.min(1, level));
    this.state.level = level;
    const now = ctx.currentTime;
    if (id === "none") {
      if (this.music) this.fadeOut(this.music, 4);
      this.music = null;
      this.state.music = "none";
      return;
    }
    const path = MUSIC[id];
    if (this.music && this.music.id === path) {
      if (Math.abs(level - this.musicLevel) > 0.01) {
        this.music.gain.gain.cancelScheduledValues(now);
        this.music.gain.gain.setValueAtTime(this.music.gain.gain.value, now);
        this.music.gain.gain.setTargetAtTime(level, now, level < this.musicLevel ? 1.2 : 2.4);
        this.musicLevel = level;
      }
      return;
    }
    const gap = this.music ? 2.5 : 1.5;
    if (this.music) this.fadeOut(this.music, 3.5);
    const t = this.track(path, this.musicBus);
    this.music = t;
    this.musicLevel = level;
    this.state.music = id;
    t.gain.gain.setValueAtTime(0, now);
    t.gain.gain.setValueAtTime(0, now + gap);
    // a slow swell: most of it in the last two thirds
    t.gain.gain.linearRampToValueAtTime(level * 0.12, now + gap + rise * 0.35);
    t.gain.gain.linearRampToValueAtTime(level, now + gap + rise);
    window.setTimeout(() => {
      if (this.music === t) void t.el.play().catch(() => undefined);
    }, gap * 1000 - 100);
  }

  setBed(id: "exterior" | "interior" | "water" | null, level = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.bedBus) return;
    const path = id ? BEDS[id] : null;
    if (this.bed && this.bed.id === path) {
      this.bed.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.8);
      return;
    }
    if (this.bed) this.fadeOut(this.bed, 2.5);
    this.bed = null;
    this.state.bed = id ?? "none";
    if (!path) return;
    const t = this.track(path, this.bedBus);
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
    this.rain.gain.gain.setTargetAtTime(rain * 0.5 * through, now, 0.6);
    this.rain.filt.frequency.setTargetAtTime(through < 0.8 ? 600 : 1400, now, 0.5);
    this.wind.gain.gain.setTargetAtTime(Math.abs(wind) * 0.45 * through, now, 0.8);
    this.wind.filt.frequency.setTargetAtTime(240 + Math.abs(wind) * 420, now, 0.8);
  }

  /** Thunder: a low rumble, arriving `distance` seconds after its flash (the caller waits). */
  thunder(strength: number, through: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.wxBus || this.muted) return;
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

  private async buffer(id: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have && have !== "loading") return have;
    if (have === "loading" || !this.ctx) return null;
    const path = FILES[id];
    if (!path) return null;
    this.buffers.set(id, "loading");
    try {
      const res = await fetch(`${AUDIO_BASE}/${path}`);
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

  /** Footstep on a surface. */
  step(surface: Surface, vol = 0.5): void {
    if (this.muted) return;
    this.stepAlt = 1 - this.stepAlt;
    const kind = surface === "metal" ? "metal" : "concrete";
    const rate = surface === "wood" ? 0.8 : surface === "earth" ? 0.7 : 1;
    if (!this.file(`step-${kind}-${this.stepAlt + 1}`, vol * (surface === "metal" ? 0.5 : 1), rate)) this.lab.play("step", vol);
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
