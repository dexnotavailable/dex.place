// The opening's conductor: owns the press, Track 1, the heard clock, the bars, captions and the skip chip.
// It lives in the page that took the press (the homepage, or /tesu/ on its own) and is handed to the world's
// frame as an OpeningLink, so the page (the fall, captions, bars) and the world (the camera, her, the
// talisman, TESU) read one T.
//
// The press starts Track 1 at +0.05 s on the sample grid (t0); T is the heard time from there (clock.ts).
// Esc or the chip before T 27.49: the music dips for a quarter second and resumes from 27.49 (the quietest
// beat of the hush); T jumps there and the world re-places her (the clock's epoch). The chip: first visit,
// on the first input and for 4 s after the last; return visits, from T 0.5; it leaves with the bars at
// drop 1. Covered by the website before the hand-back: the context (the world's sound with it) suspends and
// T holds; the tab hidden, the same. The context refusing to run: the page clock 200 ms after the press and
// a "tap for sound" chip that resumes it and seeks Track 1 to the current T. Track 1 failing: the page clock,
// silent, captions on time.

import { HeardClock, onGrid } from "./clock.ts";
import { Overlay } from "./overlay.ts";
import { Track1 } from "./track.ts";
import { BEATS, VOICE, barsAt, startT, subtitleAt, type Way } from "./timeline.ts";

/** What the world's frame reads (the conductor, or a silent stand-in for tools). */
export interface OpeningLink {
  /** Track 1's time as heard, `leadMs` from now (one frame: the moment the frame shows). */
  T(leadMs?: number): number;
  /** Bumped on every seek (the skip). */
  readonly epoch: number;
  readonly reduced: boolean;
  /** Seen before (the short mark, the chip from T 0.5). */
  readonly repeat: boolean;
  /** How the visitor came in (the website's four ways): ways 1-3 play the fall from T 0, way 4 the jetty's catch from bar 6. */
  readonly way?: Way;
  /** Track 1 is sounding: the world's own score waits. */
  readonly music: boolean;
  /** The world's region theme takes over (after the hand-back): Track 1 fades out over `secs` and stays down. */
  handOver?(secs: number): void;
  /** The context time at which Track 1's time T sounds (for cues on the beat), or null without audio. */
  ctxTimeOf(T: number): number | null;
  /** Esc or the chip: true if it skipped. */
  skip(): boolean;
  /** Any input during the cinematic (shows the chip on a first visit). */
  input(): void;
  /** The page's AudioContext (the world's sound shares it), or null. */
  readonly ctx: AudioContext | null;
  /**
   * The website's ofuda at the press (rev 5: it drops out of the black where the loader left it): its tie in css px of
   * the page's viewport, the page's device px per art px, and its 12 nodes (x, y, z art px) from the tie.
   */
  readonly paperFrom?: PaperFrom | null;
}

export interface PaperFrom {
  x: number;
  y: number;
  k: number;
  nodes: number[];
}

const SAVE = "tesu.opening";

export interface OpeningNote {
  seen: number;
  completed: boolean;
}

export function readOpeningNote(): OpeningNote {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE) ?? "null") as Partial<OpeningNote> | null;
    return { seen: Math.max(0, Number(v?.seen) || 0), completed: !!v?.completed };
  } catch {
    return { seen: 0, completed: false };
  }
}

function writeOpeningNote(n: OpeningNote): void {
  try {
    localStorage.setItem(SAVE, JSON.stringify(n));
  } catch { /* private mode */ }
}

/** The page's AudioContext: made early (suspended; decoding works on it) and resumed inside a gesture. */
export function makeAudio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: "interactive" });
    // iOS: the silent switch must not mute the opening
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
    return ctx;
  } catch {
    return null;
  }
}

export class Conductor implements OpeningLink {
  readonly clock: HeardClock;
  readonly overlay: Overlay;
  readonly reduced: boolean;
  readonly repeat: boolean;
  readonly way: Way;
  /** Where the music and the picture start (T): 0, or bar 6 for way 4. */
  readonly from: number;
  started = false;
  finished = false;
  skipped = false;
  /** Covered by the website (the column says so once the world has landed). */
  private covered = false;
  private hidden = false;
  /** The region's theme has taken over: Track 1 is faded out for good (the handOver call). */
  private handedOver = false;
  private pressAt = 0;
  private chipUntil = -Infinity;
  private raf = 0;
  private readonly win: Window;
  private readonly cleanups: (() => void)[] = [];
  readonly ctx: AudioContext | null;
  readonly track: Track1 | null;
  /** Told each frame with T (the page's fall rides on it). */
  onFrame: (T: number) => void = () => {};

  readonly paperFrom: PaperFrom | null;

  constructor(ctx: AudioContext | null, track: Track1 | null, opts: { doc: Document; reduced: boolean; repeat: boolean; way?: Way; paperFrom?: PaperFrom | null }) {
    this.ctx = ctx;
    this.track = track;
    this.paperFrom = opts.paperFrom ?? null;
    this.reduced = opts.reduced;
    this.repeat = opts.repeat;
    this.way = opts.way ?? "continue";
    this.from = startT(this.way);
    this.win = opts.doc.defaultView ?? window;
    this.clock = new HeardClock(ctx);
    this.overlay = new Overlay(opts.doc, { reduced: opts.reduced, barVh: BEATS.ui.bars.vh });
    this.overlay.chip.addEventListener("click", () => this.skip());
    this.overlay.sound.addEventListener("click", () => this.allowSound());
  }

  /** Her lines are the game's sound cues (beats.ts voice, booked in sfx); Track 1 dips under each one still to speak. */
  private duckUnderVoice(at: number, from: number): void {
    if (this.way === "bottom") return;
    const V = BEATS.voice;
    this.track?.duck(at, VOICE.filter((v) => v.to > from).map((v) => [at + Math.max(0, v.from - from), at + (v.to - from)] as [number, number]), V.duckDb, V.ramp);
  }

  get epoch(): number {
    return this.clock.epoch;
  }

  get music(): boolean {
    return !!this.track && !this.track.failed && this.clock.mode === "audio" && !this.handedOver && this.track.playing(this.T());
  }

  /** The region's theme takes over: Track 1 fades out over `secs` and stays out (the music is the theme's now). */
  handOver(secs: number): void {
    if (this.handedOver) return;
    this.handedOver = true;
    this.track?.level(0, secs);
  }

  T(leadMs = 0): number {
    return this.started ? this.clock.T(leadMs) : this.from;
  }

  ctxTimeOf(T: number): number | null {
    return this.clock.mode === "audio" && this.ctx ? this.clock.ctxTimeOf(T) : null;
  }

  /** The press, inside its gesture: Track 1 starts at +0.05 s on the sample grid, and that moment is T 0 (way 4: bar 6). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.pressAt = performance.now();
    const n = readOpeningNote();
    writeOpeningNote({ seen: n.seen + 1, completed: false });
    const ctx = this.ctx, track = this.track;
    if (ctx && track?.a && !track.failed) {
      if (ctx.state !== "running") void ctx.resume();
      const t0 = onGrid(ctx.currentTime + 0.05, ctx.sampleRate);
      track.play(t0, this.from);
      this.duckUnderVoice(t0, this.from);
      this.clock.anchor(t0, this.from);
      void track.loadB();
      // the context refuses to run: the page clock, and a chip to allow sound
      this.win.setTimeout(() => {
        if (ctx.state === "running" || this.finished || this.clock.mode === "page") return;
        this.clock.usePage(this.from + (performance.now() - this.pressAt) / 1000 - 0.05);
        this.overlay.soundShown(true);
      }, 200);
    } else {
      // no music (no audio at all, or Track 1 failed): silent, on the page clock, captions on time
      this.clock.usePage(this.from - 0.05);
    }
    this.overlay.show(true);
    const doc = this.overlay.root.ownerDocument;
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        if (this.skip()) e.preventDefault();
        return;
      }
      if (!e.repeat) this.input();
    };
    const poke = (e: PointerEvent): void => {
      const t = e.target as Element | null;
      if (t && typeof t.closest === "function" && t.closest(".op-chip, .op-sound")) return;
      this.input();
    };
    const vis = (): void => {
      this.hidden = doc.visibilityState === "hidden";
      this.syncRunning();
    };
    doc.addEventListener("keydown", key, true);
    doc.addEventListener("pointerdown", poke, true);
    doc.addEventListener("visibilitychange", vis);
    this.cleanups.push(() => doc.removeEventListener("keydown", key, true), () => doc.removeEventListener("pointerdown", poke, true), () => doc.removeEventListener("visibilitychange", vis));
    const loop = (): void => {
      this.frame();
      if (!this.overlayDone) this.raf = this.win.requestAnimationFrame(loop);
    };
    this.raf = this.win.requestAnimationFrame(loop);
  }

  private overlayDone = false;

  /** "tap for sound": resume the context and seek Track 1 to where the picture is. */
  private allowSound(): void {
    const ctx = this.ctx, track = this.track;
    if (!ctx || !track?.a) return;
    void ctx.resume().then(() => {
      if (this.clock.mode !== "page" || this.finished) return;
      const at = onGrid(ctx.currentTime + 0.05, ctx.sampleRate);
      const T = this.T() + 0.05;
      track.play(at, T);
      this.duckUnderVoice(at, T);
      this.clock.anchor(at, T);
      this.overlay.soundShown(false);
    });
  }

  skip(): boolean {
    if (!this.started || this.finished) return false;
    const T = this.T();
    const to = BEATS.ui.skipTo;
    if (T >= to) return false;
    const ctx = this.ctx, track = this.track;
    if (ctx && track && this.clock.mode === "audio" && ctx.state === "running") {
      // the music dips for a quarter second and resumes from the hush's quietest beat
      const dip = BEATS.ui.skipDip, now = ctx.currentTime;
      track.level(0, dip * 0.4, now);
      const at = onGrid(now + dip * 0.5, ctx.sampleRate);
      track.play(at, to);
      this.duckUnderVoice(at, to);
      const g = track.out.gain;
      g.setValueAtTime(0.0001, at);
      g.linearRampToValueAtTime(0.9, at + dip * 0.4);
      this.clock.anchor(at, to);
    } else {
      this.clock.usePage(to);
    }
    this.skipped = true;
    this.overlay.chipShown(false);
    return true;
  }

  input(): void {
    if (!this.started || this.repeat) return;
    if (this.T() < BEATS.her.drop1) this.chipUntil = performance.now() + BEATS.ui.chipHold * 1000;
  }

  /** The website covers the world (after it has landed): before the hand-back the world and the music pause together. */
  setCovered(on: boolean): void {
    if (on === this.covered) return;
    this.covered = on;
    this.syncRunning();
  }

  private syncRunning(): void {
    if (!this.started) return;
    const T = this.T();
    const ctx = this.ctx;
    const hold = this.covered || this.hidden;
    if (T < BEATS.ui.handBack) {
      if (this.clock.mode === "page") this.clock.pausePage(hold);
      else if (ctx) void (hold ? ctx.suspend() : ctx.resume());
    } else if (this.track && ctx) {
      // after the opening Track 1 plays on; covered, it fades down with the world's sound
      this.track.level(this.covered || this.handedOver ? 0 : 0.9, 0.4);
    }
  }

  private frame(): void {
    const T = this.T(1000 / 60);
    this.overlay.bars(barsAt(T, this.reduced, this.from));
    // (way 4, from the website's jetty: no voice lines, Dex 10-19)
    this.overlay.subtitle(this.way === "bottom" ? null : subtitleAt(T));
    const drop = BEATS.her.drop1;
    const chip = !this.skipped && T < drop && (this.repeat ? T >= BEATS.ui.chipFrom : performance.now() < this.chipUntil);
    this.overlay.chipShown(chip);
    if (T >= drop) this.overlay.retireChip();
    this.track?.watch(T);
    this.onFrame(T);
    if (T >= BEATS.ui.handBack && !this.finished) {
      this.finished = true;
      writeOpeningNote({ seen: readOpeningNote().seen, completed: true });
    }
    if (this.finished && T >= BEATS.ui.handBack + 1) {
      this.overlayDone = true;
      this.overlay.destroy();
      for (const c of this.cleanups) c();
    }
  }

  destroy(): void {
    this.win.cancelAnimationFrame(this.raf);
    this.overlayDone = true;
    this.overlay.destroy();
    for (const c of this.cleanups) c();
    this.track?.stop();
  }
}

/** A silent link on a given clock (tools, ?manual captures: T is the world's own simulated time). */
export class SilentLink implements OpeningLink {
  epoch = 0;
  readonly ctx = null;
  readonly reduced: boolean;
  readonly repeat = false;
  readonly music = false;
  readonly way: Way;
  private base = 0;
  private readonly time: () => number;

  constructor(time: () => number, reduced = false, way: Way = "continue") {
    this.time = time;
    this.reduced = reduced;
    this.way = way;
    this.base = time() - startT(way);
  }

  T(): number {
    return this.time() - this.base;
  }

  ctxTimeOf(): null {
    return null;
  }

  skip(): boolean {
    const T = this.T();
    if (T >= BEATS.ui.skipTo) return false;
    this.base -= BEATS.ui.skipTo - T;
    this.epoch++;
    return true;
  }

  input(): void {}
}
