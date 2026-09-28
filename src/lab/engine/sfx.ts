// Placeholder sound for the contract's sound cue ids: tiny synthesized
// clicks, whooshes and thumps so hit timing can be judged by ear. Real sound
// design replaces this; the cue ids stay. The context starts on the first
// user gesture (browsers block audio before that).

type Voice = (ctx: AudioContext, out: AudioNode, v: number, noise: AudioBuffer) => void;

function env(ctx: AudioContext, out: AudioNode, gain: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, gain: number, dur: number, attack = 0.004): void {
  const o = ctx.createOscillator();
  o.type = type;
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(env(ctx, out, gain, attack, dur));
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function hiss(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, type: BiquadFilterType, f0: number, f1: number, gain: number, dur: number, attack = 0.004): void {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  const t = ctx.currentTime;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  f.Q.value = 1.2;
  s.connect(f);
  f.connect(env(ctx, out, gain, attack, dur));
  s.start(t, Math.random() * 0.5);
  s.stop(t + attack + dur + 0.05);
}

const VOICES: Record<string, Voice> = {
  step: (c, o, v, n) => hiss(c, o, n, "bandpass", 1800, 1200, 0.035 * v, 0.03),
  jump: (c, o, v) => tone(c, o, "sine", 320, 560, 0.05 * v, 0.09),
  djump: (c, o, v, n) => {
    tone(c, o, "triangle", 520, 980, 0.045 * v, 0.14);
    tone(c, o, "sine", 1560, 1900, 0.02 * v, 0.2, 0.02);
    hiss(c, o, n, "highpass", 4000, 6000, 0.02 * v, 0.12);
  },
  land: (c, o, v, n) => {
    hiss(c, o, n, "lowpass", 500, 200, 0.08 * v, 0.08);
    tone(c, o, "sine", 110, 60, 0.07 * v, 0.1);
  },
  dash: (c, o, v, n) => hiss(c, o, n, "bandpass", 2200, 500, 0.09 * v, 0.16),
  swing: (c, o, v, n) => hiss(c, o, n, "bandpass", 700, 2800, 0.07 * v, 0.11),
  rise: (c, o, v, n) => hiss(c, o, n, "bandpass", 300, 2000, 0.06 * v, 0.22, 0.05),
  hit: (c, o, v, n) => {
    tone(c, o, "square", 220, 120, 0.05 * v, 0.05);
    hiss(c, o, n, "highpass", 2500, 1800, 0.08 * v, 0.06);
  },
  hit_heavy: (c, o, v, n) => {
    tone(c, o, "square", 180, 80, 0.06 * v, 0.08);
    tone(c, o, "sine", 90, 40, 0.16 * v, 0.2);
    hiss(c, o, n, "bandpass", 1600, 500, 0.1 * v, 0.14);
  },
  slam: (c, o, v, n) => {
    tone(c, o, "sine", 70, 32, 0.22 * v, 0.34);
    hiss(c, o, n, "lowpass", 900, 150, 0.14 * v, 0.3);
  },
  wave: (c, o, v, n) => {
    tone(c, o, "sine", 64, 30, 0.2 * v, 0.4);
    hiss(c, o, n, "lowpass", 1200, 200, 0.1 * v, 0.4);
    tone(c, o, "sine", 880, 870, 0.025 * v, 0.7, 0.02);
    tone(c, o, "sine", 1320, 1310, 0.018 * v, 0.8, 0.03);
  },
  charge: (c, o, v) => tone(c, o, "sine", 220, 660, 0.04 * v, 0.3, 0.06),
  ult: (c, o, v, n) => {
    for (const f of [440, 554.4, 659.3, 880]) tone(c, o, "sine", f, f * 1.002, 0.03 * v, 0.9, 0.25);
    hiss(c, o, n, "highpass", 3000, 7000, 0.02 * v, 0.8, 0.3);
  },
  ult_hit: (c, o, v, n) => {
    tone(c, o, "sine", 60, 26, 0.3 * v, 0.6);
    hiss(c, o, n, "lowpass", 2000, 120, 0.18 * v, 0.6);
    tone(c, o, "sine", 1320, 1300, 0.03 * v, 1.0, 0.05);
  },
  hurt: (c, o, v) => tone(c, o, "sawtooth", 170, 90, 0.05 * v, 0.14),
  turret_charge: (c, o, v) => tone(c, o, "square", 90, 200, 0.018 * v, 0.7, 0.2),
  turret_fire: (c, o, v, n) => {
    tone(c, o, "square", 700, 180, 0.04 * v, 0.09);
    hiss(c, o, n, "bandpass", 1400, 700, 0.04 * v, 0.08);
  },
  turret_break: (c, o, v, n) => {
    hiss(c, o, n, "lowpass", 1800, 120, 0.18 * v, 0.45);
    tone(c, o, "square", 120, 40, 0.06 * v, 0.3);
  },
  turret_rebuild: (c, o, v) => tone(c, o, "triangle", 200, 420, 0.035 * v, 0.3, 0.1),
  parry: (c, o, v, n) => {
    tone(c, o, "triangle", 1400, 1100, 0.04 * v, 0.12);
    hiss(c, o, n, "highpass", 5000, 4000, 0.03 * v, 0.06);
  },
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  constructor() {
    const unlock = (): void => {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.55;
        this.out.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    };
    window.addEventListener("keydown", unlock, { capture: true });
    window.addEventListener("pointerdown", unlock, { capture: true });
  }

  play(id: string, volume = 1): void {
    if (this.muted || !this.ctx || !this.out || !this.noise || this.ctx.state !== "running") return;
    const v = VOICES[id];
    if (v) v(this.ctx, this.out, volume, this.noise);
  }
}
