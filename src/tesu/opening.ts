// The opening in the world (chart: opening/beats.ts, revision 4), from the press to the hand-back, locked to Track 1
// through the heard clock (opening/clock.ts). T is read from the page's conductor every tick; nothing here runs on
// its own clock, so a slow phone replays ticks instead of drifting, a covered world simply holds, and the skip is a
// jump in T.
//
//   T 0       the press: the camera is high in the sky over Kagami; the paper the gust took from the page falls
//             back in from the top (0.9) and comes down on the east wind through the clouds and the fog, the
//             camera with it (ways 1-3; way 4, from the website's jetty, starts on bar 6 on her, the paper coming
//             in from the right)
//   T 12.61   bar 6, the orchestra: under the clouds, the postcard of Kagami, the paper a speck over the jetty
//   T 14.60   the push-in to the close band; 17.89 the paper becomes the catch's drawing (f001)
//   T 18.57   bar 9: the SLAP (f007), the hat jams, the ofuda takes hold, she pushes the brim up and settles
//   T 20.56   she walks on her own; the camera pulls back over the lake
//   T 24.52   the hush; 27.98 the pickup; 28.47 drop 1: she breaks into her run, control returns, the bars retract
//   T 30.45   the crash: the camera whips out (time-locked) to the widest frame
//   T 32.42   0:32, TESU on the widest frame (the music lifts into it); 36.35 it fades, the camera eases back in;
//             38.31 the world's tracks own the frame again
//
// Until the gameplay lane's clips are slotted she holds the waiting drawing (the catch's f000, bare-hatted), plays
// the catch, and is the white box after it (the idle, the walk, the run: slots.json). Hands-free she keeps running
// and stops on the terrace; the first input takes her over.

import type { OpeningLink } from "./opening/conductor.ts";
import { BEATS, VOICE, cameraAt, clipAt, herPhase, herSpeedH, herXH, reducedHold, startT, windAt, type Framed, type Shot, type Way } from "./opening/timeline.ts";

/** Her lines' cues (beats.ts voice): way 4 plays none of them. */
const VOICE_CUES = new Set(VOICE.map((v) => v.cue));
/** The long takes (a chart cue with its length: the speech) and how long each speaks (s). */
const TAKES = new Map<string, number>(BEATS.sfx.flatMap((c) => ("len" in c ? [[c.id, c.len] as const] : [])));

/**
 * A cue whose moment on the context's clock is `at`, at `now` (chart time `T`, `lead` s of booking ahead): wait, book
 * it on `at`, play it at once, or drop it. An effect a quarter second late is dropped (a drum hit out of time is worse
 * than none; the press's own gust is no drum hit and plays at once). A long take (`len`: the speech, 24.7 s) is never
 * dropped while it still speaks: it is booked on its moment even when that has passed, and the sound engine starts
 * it that far into the file (sound.ts startOf), so it stays on the music and its subtitles.
 */
export function cueAction(now: number, at: number, T: number, lead: number, len?: number): "wait" | "book" | "now" | "drop" {
  if (at - now > lead) return "wait";
  const late = now - at;
  if (len !== undefined) return late < len ? "book" : "drop";
  if (late > 0.05 && late < 0.25 && T < 0.5) return "now";
  return late < 0.25 ? "book" : "drop";
}

export type OpeningState = "off" | "cine" | "free" | "done";

/** How far ahead on the context's clock an effect is scheduled (s). */
const CUE_LEAD = 0.25;

export interface OpeningHost {
  herX(): number;
  /** Takes her along the ground to x (world px); `jump`: put her down there (a skip). */
  moveTo(x: number, jump: boolean): void;
  /** The catch's drawing at its clip tick (`clip`), the idle held, her walk, or her run playing. */
  pose(kind: "clip" | "still" | "walk" | "run", tick?: number): void;
  /** A movement or action input since the given input tick (the player takes over). */
  touchedSince(tick: number): boolean;
  inputTick(): number;
  /** Hands her over to the player at this speed (px per tick, + right). */
  release(vx: number): void;
  title(text: string, hold: number, out: number, after: string, maxFrac: number): void;
  /** The big title's own time, set from T each tick (so it holds two bars of the music, however the frames run). */
  titleAt(t: number): void;
  /** An effect on the beat: `at` is the context time to start it at (null: now). */
  sfx(id: string, at: number | null): void;
  /** Effects scheduled ahead that have not started yet are dropped (a skip). */
  sfxCancel(): void;
  /** The ambience bed's level (1 = as set), reached over `secs`. */
  bed(k: number, secs: number): void;
  /** The world's own framing at x (the hand-back's target). */
  framing(x: number): Framed;
  frameW(): number;
  frameH(): number;
  /** A short cross-fade (a skip, a reduced-motion cut). */
  cut(): void;
  /** The cinematic owns the screen (touch controls hidden) or not. */
  cine(on: boolean): void;
}

export class Opening {
  state: OpeningState = "off";
  link: OpeningLink | null = null;
  /** T this tick (as heard when the frame shows). */
  T = 0;
  /** How the visitor came in (ways 1-3 the fall; 4 the jetty's catch). */
  way: Way = "continue";
  reducedMotion = false;
  /** She runs on her own after the drop until the first input. */
  autoRun = false;
  /** No input for a while after the hand-back: the "→" tag beside her. */
  hint = false;
  /** Bumped when T jumps (a skip): the paper re-places itself. */
  jumps = 0;
  private epoch = -1;
  private fired = new Set<number>();
  private titled = false;
  private ducked = false;
  private released: number | undefined;
  private hold = -1;
  private dropTick = 0;
  private quietSince = 0;
  private quietWall = 0;
  /** The longest recent wait between frames (s), and when the last frame's first tick ran (ms). */
  private gap = 1 / 60;
  private lastWall = 0;
  private readonly host: OpeningHost;

  constructor(host: OpeningHost) {
    this.host = host;
  }

  /** The press: T 0, or bar 6 for way 4 (or wherever the link's clock stands). */
  start(link: OpeningLink): void {
    this.link = link;
    this.way = link.way ?? "continue";
    this.state = "cine";
    this.epoch = link.epoch;
    this.fired.clear();
    this.titled = false;
    this.ducked = false;
    this.released = undefined;
    this.autoRun = true;
    this.hold = -1;
    this.reducedMotion = this.reducedMotion || link.reduced;
    this.T = Math.max(startT(this.way), link.T());
    // the cues before where it starts are past (a take still speaking there starts that far in: cueAction)
    BEATS.sfx.forEach((c, i) => {
      if (c.T < this.T - 0.01 && !(this.T < c.T + (TAKES.get(c.id) ?? 0))) this.fired.add(i);
    });
    this.host.cine(true);
    this.host.moveTo(herXH(this.T) * 96, true);
  }

  /** The opening has the camera and quiets the place names (it has not handed back yet). */
  get active(): boolean {
    return this.state === "cine" || this.state === "free";
  }

  /** The opening moves her this tick (the cinematic, or the hands-free run after the drop). */
  get drives(): boolean {
    return this.state === "cine" || (this.state === "free" && this.autoRun);
  }

  /** Track 1 is playing: the world's own score waits. */
  get music(): boolean {
    return !!this.link?.music;
  }

  /** Once per 60 Hz tick, before the simulation. */
  tick(): void {
    const link = this.link;
    if (!link || this.state === "off") return;
    if (this.state === "done") {
      this.hintTick();
      return;
    }
    const T = Math.max(startT(this.way), link.T(1000 / 60)), was = this.T;
    this.T = T;
    const h = this.host;
    if (link.epoch !== this.epoch && Math.abs(T - was) < 0.25) {
      // the clock re-anchored where it already read (the music's own start on its clock, way 4's bar 6): no skip
      this.epoch = link.epoch;
    }
    if (link.epoch !== this.epoch) {
      // a skip: she is put down walking at her place for T, the ofuda on her hat, the frame cut
      this.epoch = link.epoch;
      this.jumps++;
      h.moveTo(herXH(T) * 96, true);
      h.cut();
      h.sfxCancel();
      BEATS.sfx.forEach((c, i) => { if (c.T < T) this.fired.add(i); });
    }
    this.cues(link, T);
    // the hush ducks the lake bed; the drop brings the ambience back
    if (!this.ducked && T >= BEATS.hush.at && T < BEATS.her.drop1) {
      this.ducked = true;
      h.bed(Math.pow(10, BEATS.hush.duckDb / 20), BEATS.hush.over);
    }
    if (this.ducked && T >= BEATS.her.drop1) {
      this.ducked = false;
      h.bed(1, 0.5);
    }
    const t = BEATS.title;
    if (!this.titled && T >= t.at && T < t.at + t.hold + t.fade) {
      this.titled = true;
      h.title(t.text, t.hold, t.fade, t.after, t.maxWidth);
    }
    if (this.titled) h.titleAt(T - t.at);
    if (this.state === "cine" && T >= BEATS.her.drop1) {
      // drop 1: control returns on this tick (the bars retract in the page)
      this.state = "free";
      this.dropTick = h.inputTick();
      h.cine(false);
    }
    if (this.state === "free" && this.autoRun) {
      // the first input takes her over; standing at the overlook, the game's own idle takes her
      if (h.touchedSince(this.dropTick) || herPhase(T) === "stand") {
        this.autoRun = false;
        // standing: on her mark at the overlook first (the tick that ends the run still moves her)
        if (herPhase(T) === "stand") h.moveTo(herXH(T) * 96, false);
        h.release(herPhase(T) === "stand" ? 0 : (herSpeedH(T) * 96) / 60);
      }
    }
    // the widest frame lets go early only if she has run past the tunnel's first gate
    const cam = BEATS.camera;
    if (this.released === undefined && T >= cam.widest.from && T < cam.easeIn.from && h.herX() > cam.releaseXH * 96) this.released = T;
    if (this.reducedMotion) {
      const n = reducedHold(T);
      if (n !== this.hold) {
        if (this.hold >= 0) h.cut();
        this.hold = n;
      }
    }
    if (T >= BEATS.ui.handBack) {
      this.state = "done";
      this.quietSince = h.inputTick();
      this.quietWall = performance.now();
      h.cine(false);
    }
  }

  /**
   * The effects on their beats, scheduled on the music's own clock: a cue is asked for when its moment on the
   * context's render clock is a quarter second away (plus the longest recent wait between frames), and starts
   * exactly then. The heard T runs behind the render clock by the output's delay (Bluetooth 0.1 to 0.3 s), so a cue
   * triggered on T itself would be late, or dropped, on such outputs. Late, an effect is dropped and a take starts
   * that far in (cueAction). Without a running context (the page clock) a cue goes on T, and a take waits for the
   * context (the "tap for sound" chip) while it would still speak.
   */
  private cues(link: OpeningLink, T: number): void {
    const h = this.host;
    const ctx = link.ctx;
    const now = ctx && ctx.state === "running" ? ctx.currentTime : null;
    const wall = performance.now();
    if (wall - this.lastWall > 4) {
      if (this.lastWall) this.gap = Math.min(0.5, Math.max(this.gap * 0.9, (wall - this.lastWall) / 1000));
      this.lastWall = wall;
    }
    BEATS.sfx.forEach((c, i) => {
      if (this.fired.has(i)) return;
      // way 4 (the website's jetty): no voice lines (Dex 10-19)
      if (this.way === "bottom" && VOICE_CUES.has(c.id)) { this.fired.add(i); return; }
      const at = now === null ? null : link.ctxTimeOf(c.T);
      const len = TAKES.get(c.id);
      if (at !== null && now !== null) {
        const go = cueAction(now, at, c.T, CUE_LEAD + this.gap, len);
        if (go === "wait") return;
        this.fired.add(i);
        if (go !== "drop") h.sfx(c.id, go === "now" ? null : at);
        return;
      }
      if (len !== undefined) {
        if (T >= c.T + len) this.fired.add(i);
        return;
      }
      if (T + 0.15 < c.T) return;
      this.fired.add(i);
      if (T - c.T < 0.25) h.sfx(c.id, null);
    });
  }

  private hintTick(): void {
    const h = this.host;
    if (h.touchedSince(this.quietSince + 1)) {
      this.hint = false;
      this.link = null;
      this.state = "off";
      return;
    }
    // (on the wall clock: a slow device runs fewer ticks than seconds)
    this.hint = performance.now() - this.quietWall > BEATS.ui.hintAfter * 1000;
  }

  /** In the simulation tick: moves her if the opening drives her (then the player's own update is skipped). */
  drive(): boolean {
    if (!this.drives) return false;
    const T = this.T;
    const ph = herPhase(T);
    this.host.moveTo(herXH(T) * 96, false);
    const c = clipAt(T);
    if (c) this.host.pose("clip", c.tick);
    else this.host.pose(ph === "run" || ph === "skid" ? "run" : ph === "walk" ? "walk" : "still");
    return true;
  }

  /** The frame the opening asks for at her x (world px), or null when the world's tracks have it. */
  camera(x: number): Shot | null {
    if (!this.active) return null;
    const h = this.host;
    return cameraAt(this.T, { x, W: h.frameW(), H: h.frameH(), world: (v) => h.framing(v), released: this.released, reduced: this.reducedMotion, way: this.way });
  }

  /** Her step's phase (radians) while she walks or runs, for the ofuda's bob; null when she stands. */
  bob(): number | null {
    const T = this.T, ph = herPhase(T);
    if (ph === "walk") return 2 * Math.PI * (T - BEATS.her.walkFrom) * 2;
    if (ph === "run") return 2 * Math.PI * T * 5;
    return null;
  }

  /** The ambient air on the ofuda on her hat now. */
  wind(): { base: number; gust: number } {
    return windAt(this.active ? this.T : 1e9);
  }
}
