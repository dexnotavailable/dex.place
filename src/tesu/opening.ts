// The opening in the world (the opening lane's PLAN.md and BEATS.json; GDK 3.9): from the press to the
// hand-back, locked to Track 1 through the heard clock (opening/clock.ts). T is read from the page's
// conductor every tick; nothing here runs on its own clock, so a slow phone replays ticks instead of
// drifting, a covered world simply holds, and the skip is a jump in T.
//
//   T 0       the press: she stands at the catch spot, bare-hatted; the talisman enters the sky at 0.64
//   T 4.63    the world window lands (the held postcard); the camera follows the letter down (authored shots)
//   T 12.61   the catch; 14.60 the slap; 15.43 the anchor (the bones' bake carries the talisman throughout)
//   T 16.59   she walks on her own, one footfall a beat; the reveal track (keyed to her x) takes the camera
//   T 24.52   the hush; 27.98 the pickup; 28.47 drop 1: she breaks into her run, control returns, the bars
//             retract, the camera whips out (time-locked) to the widest frame on 30.45, drop 2, under TESU
//   T 34.38   TESU fades, the camera eases back in; 36.35 the world's tracks own the frame again
//
// Until the gameplay lane's clips exist she holds the current sprite's idle as a still (the catch, the slap,
// the anchor), slides through the walk at the solved walk speed, and runs with the current run clip after
// the drop. Hands-free she keeps running and stops on the terrace; the first input takes her over.

import type { OpeningLink } from "./opening/conductor.ts";
import { BEATS, beatAt, cameraAt, herPhase, herSpeedH, herXH, reducedHold, windAt, type Framed, type Shot } from "./opening/timeline.ts";

export type OpeningState = "off" | "cine" | "free" | "done";

/** How far ahead on the context's clock an effect is scheduled (s). */
const CUE_LEAD = 0.25;

export interface OpeningHost {
  herX(): number;
  /** Takes her along the ground to x (world px); `jump`: put her down there (a skip). */
  moveTo(x: number, jump: boolean): void;
  /** A still of the current sprite's idle, or its run playing. */
  pose(kind: "still" | "walk" | "run"): void;
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
  framing(x: number, opening: boolean): Framed;
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
  reducedMotion = false;
  /** She runs on her own after the drop until the first input. */
  autoRun = false;
  /** No input for a while after the hand-back: the "→" tag beside her. */
  hint = false;
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

  /** The press: T 0 (or wherever the link's clock stands). */
  start(link: OpeningLink): void {
    this.link = link;
    this.state = "cine";
    this.epoch = link.epoch;
    this.fired.clear();
    this.titled = false;
    this.ducked = false;
    this.released = undefined;
    this.autoRun = true;
    this.hold = -1;
    this.reducedMotion = this.reducedMotion || link.reduced;
    this.T = Math.max(0, link.T());
    this.host.cine(true);
    this.host.moveTo(herXH(this.T) * 96, true);
  }

  /** The reveal track applies and place names keep quiet (the opening has not handed back yet). */
  get active(): boolean {
    return this.state === "cine" || this.state === "free";
  }

  /** The opening moves her this tick (the cinematic, or the hands-free run). */
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
    const T = Math.max(0, link.T(1000 / 60));
    this.T = T;
    const h = this.host;
    if (link.epoch !== this.epoch) {
      // a skip: she is put down walking at her place for T, the talisman on her hat, the frame cut
      this.epoch = link.epoch;
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
   * The effects on their beats, scheduled on the music's own clock (CHECK-1 item 11's critic, film v0): a cue is
   * asked for when its moment on the context's render clock is a quarter second away (plus the longest recent
   * wait between frames), and starts exactly then. The heard T runs behind the render clock by the output's
   * delay (Bluetooth 0.1 to 0.3 s), so a cue triggered on T itself would be late, or dropped, on such outputs.
   * Without a running context (the page clock) a cue goes on T, as before.
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
      const at = now === null ? null : link.ctxTimeOf(c.T);
      if (at !== null && now !== null) {
        if (at - now > CUE_LEAD + this.gap) return;
        this.fired.add(i);
        // the press's own gust is no drum hit: if the first tick comes a little late it plays at once
        if (now - at > 0.05 && now - at < 0.25 && c.T < 0.5) h.sfx(c.id, null);
        else if (now - at < 0.25) h.sfx(c.id, at);
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
    this.host.pose(ph === "run" || ph === "skid" ? "run" : ph === "walk" ? "walk" : "still");
    return true;
  }

  /** The frame the opening asks for at her x (world px), or null when the world's tracks have it. */
  camera(x: number): Shot | null {
    if (!this.active) return null;
    const h = this.host;
    return cameraAt(this.T, { x, W: h.frameW(), H: h.frameH(), reveal: (v) => h.framing(v, true), world: (v) => h.framing(v, false), released: this.released, reduced: this.reducedMotion });
  }

  /** Her step's phase (radians) while she walks or runs, for the talisman's bob; null when she stands. */
  bob(): number | null {
    const T = this.T, ph = herPhase(T);
    if (ph === "walk") return (2 * Math.PI * (T - BEATS.her.walkFrom)) / beatAt(T);
    if (ph === "run") return 2 * Math.PI * T * 5;
    return null;
  }

  /** The ambient air on the talisman now. */
  wind(): { base: number; gust: number } {
    return windAt(this.active ? this.T : 1e9);
  }
}
