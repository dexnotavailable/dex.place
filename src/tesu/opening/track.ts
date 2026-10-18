// Track 1 (the picked take, cee81608), delivered in two pieces only to deliver it and joined back so that
// it IS the WAV again (the plan, section 6; CHECK-1 item 10):
//
// - piece A, 0 to the seam + 0.1 s, fetched and decoded before "continue" (Opus in Ogg, AAC in M4A for
//   Safari); piece B, from the seam - 0.1 s to the end, fetched after the press, decoded under the cinematic;
// - the join is a 10 ms equal-GAIN (linear) cross-fade centred on the seam (a zero crossing 1.7 ms before
//   the bar-20 line): A 1 -> 0 while B 0 -> 1, so the gains always sum to 1 and, the pieces being the same
//   recording, the level never moves (an equal-power fade would bump it +3 dB); neither piece's own edge is
//   ever heard;
// - every start lands on the sample grid (t0 is on it, and the cut points are whole samples);
// - B late (not decoded by T 39): A fades out over its last bar and B comes in on the first bar line after
//   it is ready, with a one-beat fade-in (the opening has ended by then);
// - Dex's lift (vetting, 10-16): "Have the volume increase at 0:32, not too sudden but enough for the drop to hit
//   way harder": its own gain stage rises by the chart's dB over a beat and a bit into 0:32 and stays up.

import { BEATS } from "./beats.ts";
import { beatAt, nextBarLine } from "./timeline.ts";

const S = BEATS.track;
const aSeconds = (S.aEnd + 1) / S.sampleRate;
const bFrom = S.bFrom / S.sampleRate;

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class Track1 {
  readonly out: GainNode;
  /** Dex's lift into 0:32 (its own stage, so the dips and covers on `out` never undo it). */
  readonly lift: GainNode;
  a: AudioBuffer | null = null;
  b: AudioBuffer | null = null;
  readonly ext: "opus" | "m4a";
  /** Piece A is in (fetched and decoded), or failed. */
  readonly aReady: Promise<boolean>;
  private bLoad: Promise<boolean> | null = null;
  private voices: Voice[] = [];
  private aVoice: Voice | null = null;
  /** The playing schedule: context time `at` sounds track time `from`. */
  private sched: { at: number; from: number } | null = null;
  private bPlaced = false;
  private late = false;
  failed = false;
  private readonly ctx: AudioContext;

  constructor(ctx: AudioContext, dest: AudioNode, level = 0.9) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = level;
    this.out.connect(dest);
    this.lift = ctx.createGain();
    this.lift.connect(this.out);
    const probe = typeof document !== "undefined" ? document.createElement("audio") : null;
    this.ext = probe?.canPlayType('audio/ogg; codecs="opus"') ? "opus" : "m4a";
    this.aReady = this.fetch(0).then((buf) => {
      this.a = buf;
      return true;
    }, (e: unknown) => {
      console.warn("[opening] Track 1 piece A", e);
      this.failed = true;
      return false;
    });
  }

  private url(piece: 0 | 1): string {
    const files = piece === 0 ? S.files.a : S.files.b;
    return files[this.ext === "opus" ? 0 : 1]!;
  }

  private async fetch(piece: 0 | 1): Promise<AudioBuffer> {
    const res = await fetch(this.url(piece));
    if (!res.ok) throw new Error(`HTTP ${res.status} ${this.url(piece)}`);
    return await this.ctx.decodeAudioData(await res.arrayBuffer());
  }

  /** Starts piece B's download (after the press: it never competes with the opening set). */
  loadB(): Promise<boolean> {
    this.bLoad ??= this.fetch(1).then((buf) => {
      this.b = buf;
      this.placeB();
      return true;
    }, (e: unknown) => {
      console.warn("[opening] Track 1 piece B", e);
      return false;
    });
    return this.bLoad;
  }

  /** Seconds of codec priming a browser left in (the manifest's per-codec offset; 0 where the decoder trims it). */
  private prime(): number {
    return S.prime[this.ext] / S.sampleRate;
  }

  private voice(buf: AudioBuffer, g: number): Voice {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = g;
    src.connect(gain);
    gain.connect(this.lift);
    const v = { src, gain };
    this.voices.push(v);
    src.onended = () => {
      this.voices = this.voices.filter((x) => x !== v);
      gain.disconnect();
    };
    return v;
  }

  /** Plays the track from track time `from` at context time `at` (both on the sample grid). */
  play(at: number, from: number): void {
    this.stop(at);
    this.sched = { at, from };
    this.liftFrom(at, from);
    this.bPlaced = false;
    this.late = false;
    const half = S.fade / 2;
    if (this.a && from < S.seam - half) {
      const v = this.voice(this.a, 1);
      v.src.start(at, from + this.prime());
      const fadeAt = at + (S.seam - half - from);
      if (fadeAt > at) {
        v.gain.gain.setValueAtTime(1, fadeAt);
        v.gain.gain.linearRampToValueAtTime(0, fadeAt + S.fade);
      }
      v.src.stop(at + (aSeconds - from));
      this.aVoice = v;
    }
    this.placeB();
  }

  /** The lift's gain for a start at context time `at` from track time `from`: flat, then the rise into 0:32. */
  private liftFrom(at: number, from: number): void {
    const L = S.lift, g = this.lift.gain, up = Math.pow(10, L.db / 20);
    g.cancelScheduledValues(0);
    if (from >= L.to) {
      g.setValueAtTime(up, at);
      return;
    }
    const a = at + Math.max(0, L.from - from), b = at + (L.to - from);
    g.setValueAtTime(from > L.from ? 1 + (up - 1) * ((from - L.from) / (L.to - L.from)) : 1, at);
    if (a > at) g.setValueAtTime(1, a);
    g.linearRampToValueAtTime(up, b);
  }

  /** Schedules piece B into the join (or, late, onto the next bar line) once it is decoded. */
  private placeB(): void {
    const s = this.sched;
    if (!s || !this.b || this.bPlaced) return;
    const now = this.ctx.currentTime;
    const Tnow = s.from + (now - s.at);
    const half = S.fade / 2;
    if (!this.late) {
      const joinAt = s.at + (bFrom - s.from);
      if (joinAt >= now + 0.02) {
        const v = this.voice(this.b, 0);
        v.src.start(joinAt, this.prime());
        const fadeAt = s.at + (S.seam - half - s.from);
        v.gain.gain.setValueAtTime(0, fadeAt);
        v.gain.gain.linearRampToValueAtTime(1, fadeAt + S.fade);
        this.bPlaced = true;
        return;
      }
      if (s.from >= bFrom + half) {
        // started (a seek) inside piece B's span: B alone
        const v = this.voice(this.b, 1);
        v.src.start(s.at, s.from - bFrom + this.prime());
        this.bPlaced = true;
        return;
      }
      this.late = true;
    }
    // late: on the first bar line after now, with a one-beat fade-in
    const T = Math.max(nextBarLine(Tnow + 0.15), bFrom);
    const at = s.at + (T - s.from);
    const v = this.voice(this.b, 0);
    v.src.start(at, T - bFrom + this.prime());
    v.gain.gain.setValueAtTime(0, at);
    v.gain.gain.linearRampToValueAtTime(1, at + beatAt(T));
    this.bPlaced = true;
  }

  /** Called every frame with the T being played: B not decoded by its deadline means A fades over its last bar. */
  watch(T: number): void {
    if (this.bPlaced || this.late || !this.sched || !this.aVoice) return;
    if (T < S.bLateFadeFrom - 0.2 || this.b) return;
    this.late = true;
    const s = this.sched;
    const g = this.aVoice.gain.gain;
    const from = s.at + (Math.max(T + 0.05, S.bLateFadeFrom) - s.from);
    g.cancelScheduledValues(from);
    g.setValueAtTime(1, from);
    g.linearRampToValueAtTime(0.0001, s.at + (BEATS.bars[20]! - s.from));
  }

  /** Stops everything at context time `at`. */
  stop(at = this.ctx.currentTime): void {
    for (const v of this.voices) {
      try { v.src.stop(at); } catch { /* not started */ }
    }
    this.voices = [];
    this.aVoice = null;
    this.sched = null;
  }

  /** The music's level: `to` over `secs` (a dip, a cover). */
  level(to: number, secs: number, from = this.ctx.currentTime): void {
    const g = this.out.gain;
    g.cancelScheduledValues(from);
    g.setValueAtTime(g.value, from);
    g.linearRampToValueAtTime(Math.max(0.0001, to), from + secs);
  }

  /** Track 1 is sounding (scheduled and not past its end). */
  playing(T: number): boolean {
    return !!this.sched && T < S.seconds;
  }
}
