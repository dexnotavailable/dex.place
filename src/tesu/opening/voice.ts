// Her voice in the opening (Dex picked the takes by ear, 10-19; lanes/opening/VOICE-CUES.md): six lines on Track 1's
// clock, each file booked on the audio context at its T (beats.ts `voice`, timeline.ts VOICE) and played to its end
// (never a cut tail), the music ducked a little under each line's speech so she reads over the build. Subtitles are
// the conductor's (timeline.ts subtitleAt), so they show on time even with no sound.
//
// The files are lane D's encodes of the approved takes (public/audio/opening/voice-<n>.opus, .m4a for Safari); the
// page says which the build has (voice-files.ts: a missing one is never fetched). They load once the page's audio
// context exists (after "dex" has written itself), well before the press.

import { BEATS } from "./beats.ts";
import { VOICE } from "./timeline.ts";
import type { Track1 } from "./track.ts";

const V = BEATS.voice;

export class OpeningVoice {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly bufs = new Map<number, AudioBuffer>();
  private playing: AudioBufferSourceNode[] = [];
  private sched: { at: number; from: number; track: Track1 | null } | null = null;
  readonly ext: "opus" | "m4a";

  constructor(ctx: AudioContext, dest: AudioNode, have: readonly number[]) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(dest);
    const probe = typeof document !== "undefined" ? document.createElement("audio") : null;
    this.ext = probe?.canPlayType('audio/ogg; codecs="opus"') ? "opus" : "m4a";
    for (const n of have) void this.load(n);
  }

  private async load(n: number): Promise<void> {
    try {
      const res = await fetch(`${V.dir}voice-${n}.${this.ext}`);
      if (!res.ok) return;
      this.bufs.set(n, await this.ctx.decodeAudioData(await res.arrayBuffer()));
      // decoded after the press: booked now if its line has not begun speaking yet
      if (this.sched) this.place(n);
    } catch {
      /* a line that cannot be had stays silent; its subtitle still shows */
    }
  }

  /** Books every line still to come: context time `at` sounds T `from` (Track 1's schedule), the music ducked under each. */
  play(at: number, from: number, track: Track1 | null): void {
    this.stop(at);
    this.sched = { at, from, track };
    // the music dips under each line still to speak (in time order, on its own gain stage)
    track?.duck(at, VOICE.filter((v) => v.to > from).map((v) => [at + Math.max(0, v.from - from), at + (v.to - from)] as [number, number]), V.duckDb, V.ramp);
    for (const v of VOICE) this.place(v.n);
  }

  private place(n: number): void {
    const s = this.sched, buf = this.bufs.get(n), v = VOICE.find((x) => x.n === n);
    if (!s || !buf || !v) return;
    const now = this.ctx.currentTime;
    const startAt = s.at + (v.at - s.from);
    // a line already speaking when it could be booked is left out (never started mid-word)
    if (s.at + (v.from - s.from) < now + 0.02) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    const off = Math.max(0, now + 0.02 - startAt);
    src.start(startAt + off, off);
    src.onended = () => { this.playing = this.playing.filter((x) => x !== src); };
    this.playing.push(src);
  }

  /** Stops every line at context time `at` (a skip, a re-seek, the end). */
  stop(at = this.ctx.currentTime): void {
    for (const src of this.playing) {
      try { src.stop(at); } catch { /* not started */ }
    }
    this.playing = [];
    this.sched?.track?.duck(at, [], V.duckDb, V.ramp);
    this.sched = null;
  }
}

const voices = new WeakMap<AudioContext, OpeningVoice>();

/** The page's voice on its audio context (made once; starts loading the files the build has). */
export function voiceFor(ctx: AudioContext, have: readonly number[]): OpeningVoice {
  let v = voices.get(ctx);
  if (!v) {
    v = new OpeningVoice(ctx, ctx.destination, have);
    voices.set(ctx, v);
  }
  return v;
}
