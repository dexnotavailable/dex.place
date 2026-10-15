// The heard clock (the opening plan, section 6; CHECK-1 item 11): T is the time on Track 1 that the
// visitor is HEARING now, not ctx.currentTime - t0. currentTime is when audio is rendered, which runs ahead
// of the speaker by the context's own buffering and the device's delay (Bluetooth headphones add 100-300 ms),
// and it moves in render-buffer steps. So:
//
// 1. ctx.getOutputTimestamp() says which context time the output is playing and when (on the page's
//    performance clock); extrapolated to now, that is smooth.
// 2. Browsers differ in how much device latency that already folds in. The context's own estimate of the
//    total is L = baseLatency + outputLatency (baseLatency alone where outputLatency is missing); what the
//    timestamp already covers is g = currentTime - a (smoothed: the median of the last 16). Only the part
//    still missing is subtracted, never the whole latency twice. L is re-read every second (headphones).
// 3. No timestamp (or still 0): currentTime minus all of L. The context not running: T holds; on resume it
//    re-anchors. The page clock stands in when there is no music at all (or until "tap for sound").
// 4. The picture runs on a straight line against performance.now(), nudged toward the measurement by at most
//    1 ms per frame, so a correction never shows; a disagreement over 50 ms (a seek, a resume, a device
//    change) re-anchors at once. T never runs backwards except on a seek (the skip).
// 5. Callers ask for T at the moment their frame reaches the screen (now plus one frame).
//
// One instance lives in the page and is handed to the world's frame, so both read the same T. It only ever
// reads the page's own performance clock (the world passes a lead in ms, never its own timestamps).

/** The parts of an AudioContext the clock reads (a test can stand one in). */
export interface ClockAudio {
  readonly currentTime: number;
  readonly state: string;
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  getOutputTimestamp?(): { contextTime?: number; performanceTime?: number };
}

export class HeardClock {
  /** "audio": from the context; "page": performance.now() (no music, or until sound is allowed). */
  mode: "audio" | "page";
  /** Bumped on every seek (the skip): the world re-places her when it changes. */
  epoch = 0;
  /** The page clock is paused (the world covered while there is no audio to suspend). */
  paused = false;
  private ctxAt = 0;
  private T0 = 0;
  private pageAt = 0;
  private gs: number[] = [];
  private L = 0;
  private lRead = -Infinity;
  private refT = 0;
  private refP = 0;
  private held = true;
  private last = -Infinity;
  private lastUpdate = -Infinity;

  private readonly ctx: ClockAudio | null;
  private readonly now: () => number;

  constructor(ctx: ClockAudio | null, now: () => number = () => performance.now()) {
    this.ctx = ctx;
    this.now = now;
    this.mode = ctx ? "audio" : "page";
  }

  /** T = T0 at context time `ctxTime` (a start or a seek on the sample grid). */
  anchor(ctxTime: number, T0: number): void {
    this.mode = "audio";
    this.ctxAt = ctxTime;
    this.T0 = T0;
    this.restart();
  }

  /** From now on the page's clock, reading T at this moment. */
  usePage(T: number): void {
    this.mode = "page";
    this.pageAt = this.now();
    this.T0 = T;
    this.paused = false;
    this.restart();
  }

  /** The context time at which Track 1's time T sounds out of the context (for scheduling cues). */
  ctxTimeOf(T: number): number {
    return this.ctxAt + (T - this.T0);
  }

  pausePage(on: boolean): void {
    if (this.mode !== "page" || on === this.paused) return;
    const p = this.now();
    if (on) {
      // held exactly where it is now
      this.T0 = this.T0 + (p - this.pageAt) / 1000;
      this.refT = this.T0;
      this.refP = p;
      this.held = true;
    } else this.pageAt = p;
    this.paused = on;
  }

  private restart(): void {
    this.epoch++;
    this.gs = [];
    this.held = true;
    this.last = -Infinity;
    this.lastUpdate = -Infinity;
  }

  /** The measured heard T at performance time p (ms), or null while nothing is running. */
  measure(p: number): number | null {
    if (this.mode === "page") return this.paused ? null : this.T0 + (p - this.pageAt) / 1000;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return null;
    if (p - this.lRead > 1000) {
      this.L = (ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0);
      this.lRead = p;
    }
    let heard: number;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      const a = ts.contextTime + (p - ts.performanceTime) / 1000;
      this.gs.push(ctx.currentTime - a);
      if (this.gs.length > 16) this.gs.shift();
      const g = [...this.gs].sort((x, y) => x - y)[this.gs.length >> 1]!;
      heard = a - Math.max(0, this.L - g);
    } else {
      heard = ctx.currentTime - this.L;
    }
    return this.T0 + (heard - this.ctxAt);
  }

  private update(p: number): void {
    const m = this.measure(p);
    if (m === null) {
      // stopped: hold at the last measured line (never ahead of what was heard; it re-anchors forward on resume)
      this.held = true;
      return;
    }
    const line = this.refT + (p - this.refP) / 1000;
    if (this.held || Math.abs(m - line) > 0.05) {
      this.refT = m;
      this.refP = p;
      this.held = false;
      return;
    }
    this.refT = line + Math.max(-0.001, Math.min(0.001, m - line));
    this.refP = p;
  }

  /** T as heard `leadMs` from now (callers pass one frame interval: the moment their frame shows). */
  T(leadMs = 0): number {
    const p = this.now() + leadMs;
    if (p - this.lastUpdate >= 4 || p < this.lastUpdate) {
      this.update(p);
      this.lastUpdate = p;
    }
    const v = this.held ? this.refT : this.refT + (p - this.refP) / 1000;
    if (v < this.last) return this.last;
    this.last = v;
    return v;
  }

  /** Whether T is moving (the context runs, or the page clock does). */
  get running(): boolean {
    return this.mode === "page" ? !this.paused : this.ctx?.state === "running";
  }
}

/** A context time rounded up to the sample grid, so every later start lands on it too. */
export function onGrid(t: number, sampleRate: number): number {
  return Math.ceil(t * sampleRate - 1e-6) / sampleRate;
}
