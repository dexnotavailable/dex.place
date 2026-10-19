// The mix (Dex 10-19: "make sure it mixes her voice and gives it effects, don't leave it dry; give it the same treatment
// AAA games give their VAs' post-processing ... any reverb or distortion or whatnot, also bass hits for the ult and other
// relevant layers"). Everything here processes recorded files; nothing synthesizes sound at runtime: the reverbs are
// impulse responses baked offline (public/audio/ir, lanes/audio/lane2/tools/make-ir.py), the ult's double is a baked
// octave-down copy of each take, the bass hits and impact layers are takes.
//
// - Her voice bus: high-pass, a presence lift, a gentle de-ess, a compressor (every line at one level), light saturation,
//   panned with her place on screen, and a reverb send that matches the space she is in (a short bright room by
//   default, a big hall in the Hall of Works and the court, open air with a pre-delay and a far slap outdoors).
// - The ult register: heavier saturation, the octave-down double low under it, a long dark reverb, a sub hit under the
//   R call, the transform and the big kiai (sound.ts plays those layers).
// - Ducking: the music and the beds dip under her voice, the effects a little; the big hits dip everything else.
// - A / B: `?mix=dry` (or Sound.setMix("dry")) plays the same sounds with every effect off, for Dex's ear.

/** The reverb spaces (one baked impulse response each, /audio/ir/<space>). */
export type Space = "room" | "hall" | "open";
export const SPACES: readonly Space[] = ["room", "hall", "open"];
/** Places with their own space; the rest: a room indoors, open air outdoors. */
export const SPACE_OF: Readonly<Record<string, Space>> = { "hall-of-works": "hall", "prize-court": "hall" };

export function spaceFor(place: string | null, inside: boolean): Space {
  return (place && SPACE_OF[place]) || (inside ? "room" : "open");
}

/** The voice chain's settings (one table, so the A / B renders and the game use the same numbers). */
export const VOICE_MIX = {
  highpass: 90,
  presence: { f: 3200, q: 0.9, gain: 3.5 },
  deess: { f: 7200, q: 2.2, gain: -3 },
  comp: { threshold: -26, knee: 8, ratio: 4, attack: 0.004, release: 0.18 },
  drive: 1.8,
  makeup: 1.1,
  wet: { room: 0.22, hall: 0.34, open: 0.14 } as Record<Space, number>,
  ult: { highpass: 70, presence: { f: 2800, q: 0.8, gain: 4.5 }, drive: 3.6, makeup: 1.0, wet: 0.42, double: 0.3 },
  /** Her place on screen to the voice's pan (at most this far left or right). */
  panSpread: 0.35,
  /** Ducking under her voice: music / beds and effects, in dB, with the release after the line. */
  duck: { music: -7, sfx: -3, attack: 0.06, release: 0.45 },
};

/**
 * The safety limiter at the very end (the layered hits, the subs and her voice can stack past full scale): a fast,
 * hard-knee compressor that only acts on the overs.
 */
export function masterLimiter(ctx: BaseAudioContext, out: AudioNode): DynamicsCompressorNode {
  const l = ctx.createDynamicsCompressor();
  l.threshold.value = -2;
  l.knee.value = 0;
  l.ratio.value = 20;
  l.attack.value = 0.002;
  l.release.value = 0.12;
  l.connect(out);
  return l;
}

/** A soft-clip curve (tanh), `k` = drive; 1 is nearly clean. */
export function driveCurve(k: number, n = 2048): Float32Array {
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

interface Chain {
  input: GainNode;
  /** The processed path's output level (0 when the mix is dry). */
  wetPath: GainNode;
  /** The untouched path (A / B). */
  dryPath: GainNode;
}

/**
 * Her voice: two chains (normal and ult) into one panner; reverb sends per space plus the ult's long dark one.
 * Built on any BaseAudioContext, so the listening page's A / B renders run the same graph offline.
 */
export class VoiceBus {
  readonly normal: Chain;
  readonly ult: Chain;
  private pan: StereoPannerNode;
  private sends = new Map<Space | "ult", { conv: ConvolverNode; gain: GainNode }>();
  private ctx: BaseAudioContext;
  space: Space = "open";
  dry = false;

  constructor(ctx: BaseAudioContext, out: AudioNode, irs: Partial<Record<Space | "ult", AudioBuffer | null>>) {
    this.ctx = ctx;
    this.pan = ctx.createStereoPanner();
    this.pan.connect(out);
    const M = VOICE_MIX;
    for (const k of [...SPACES, "ult"] as const) {
      const conv = ctx.createConvolver();
      const ir = irs[k];
      if (ir) conv.buffer = ir;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      conv.connect(gain);
      gain.connect(out);
      this.sends.set(k, { conv, gain });
    }
    this.normal = this.chain(M.highpass, M.presence, M.drive, M.makeup, false);
    this.ult = this.chain(M.ult.highpass, M.ult.presence, M.ult.drive, M.ult.makeup, true);
    this.setSpace("open", 0);
  }

  private chain(hp: number, presence: { f: number; q: number; gain: number }, drive: number, makeup: number, ult: boolean): Chain {
    const ctx = this.ctx, M = VOICE_MIX;
    const input = ctx.createGain();
    const h = ctx.createBiquadFilter();
    h.type = "highpass";
    h.frequency.value = hp;
    h.Q.value = 0.7;
    const p = ctx.createBiquadFilter();
    p.type = "peaking";
    p.frequency.value = presence.f;
    p.Q.value = presence.q;
    p.gain.value = presence.gain;
    const d = ctx.createBiquadFilter();
    d.type = "peaking";
    d.frequency.value = M.deess.f;
    d.Q.value = M.deess.q;
    d.gain.value = M.deess.gain;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = M.comp.threshold;
    comp.knee.value = M.comp.knee;
    comp.ratio.value = ult ? M.comp.ratio + 2 : M.comp.ratio;
    comp.attack.value = M.comp.attack;
    comp.release.value = M.comp.release;
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(drive) as Float32Array<ArrayBuffer>;
    shaper.oversample = "2x";
    const wetPath = ctx.createGain();
    wetPath.gain.value = makeup;
    const dryPath = ctx.createGain();
    dryPath.gain.value = 0;
    input.connect(h);
    h.connect(p);
    p.connect(d);
    d.connect(comp);
    comp.connect(shaper);
    shaper.connect(wetPath);
    wetPath.connect(this.pan);
    input.connect(dryPath);
    dryPath.connect(this.pan);
    // the reverb sends take the compressed voice (before the saturation: the room hears her, not the grit)
    for (const k of [...SPACES, "ult"] as const) {
      if (k === "ult" && !ult) continue;
      const tap = ctx.createGain();
      tap.gain.value = 1;
      comp.connect(tap);
      tap.connect(this.sends.get(k)!.conv);
    }
    return { input, wetPath, dryPath };
  }

  /** The impulse responses, once loaded (each convolver takes its buffer once). */
  setIrs(irs: Partial<Record<Space | "ult", AudioBuffer | null>>): void {
    for (const [k, ir] of Object.entries(irs)) {
      const s = this.sends.get(k as Space | "ult");
      if (s && ir && !s.conv.buffer) s.conv.buffer = ir;
    }
  }

  /** The space she is in: its reverb fades in over `secs`, the others out. */
  setSpace(space: Space, secs = 1.5): void {
    this.space = space;
    const now = this.ctx.currentTime;
    for (const k of SPACES) {
      const g = this.sends.get(k)!.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this.dry || k !== space ? 0 : VOICE_MIX.wet[k], now + Math.max(0.001, secs));
    }
    const u = this.sends.get("ult")!.gain.gain;
    u.setValueAtTime(this.dry ? 0 : VOICE_MIX.ult.wet, now);
  }

  /** Her place on screen, -1 (left edge) .. 1 (right edge). */
  setPan(x: number): void {
    const v = Math.max(-1, Math.min(1, x)) * VOICE_MIX.panSpread;
    this.pan.pan.setTargetAtTime(this.dry ? 0 : v, this.ctx.currentTime, 0.08);
  }

  /** A / B: dry plays the takes untouched (no EQ, compression, saturation, reverb or pan). */
  setDry(dry: boolean): void {
    this.dry = dry;
    for (const c of [this.normal, this.ult]) {
      c.dryPath.gain.value = dry ? 1 : 0;
      c.wetPath.gain.value = dry ? 0 : c === this.ult ? VOICE_MIX.ult.makeup : VOICE_MIX.makeup;
    }
    this.setSpace(this.space, 0);
    if (dry) this.pan.pan.value = 0;
  }
}

/** Dips a gain for a while: down over `attack`, held to `until`, back over `release` (a deeper dip wins). */
export class Ducker {
  readonly node: GainNode;
  private ctx: BaseAudioContext;
  private until = 0;
  private depth = 1;

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.node = ctx.createGain();
    this.node.connect(out);
  }

  duck(db: number, from: number, until: number, attack = VOICE_MIX.duck.attack, release = VOICE_MIX.duck.release): void {
    const k = Math.pow(10, db / 20);
    const g = this.node.gain;
    const now = Math.max(this.ctx.currentTime, from);
    const depth = now < this.until ? Math.min(this.depth, k) : k;
    this.depth = depth;
    this.until = Math.max(this.until, until);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(depth, now + attack);
    g.setValueAtTime(depth, this.until);
    g.linearRampToValueAtTime(1, this.until + release);
  }
}
