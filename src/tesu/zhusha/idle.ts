// The idle variant player (Dex 10-16): "Idle should probably be the reverse and forward loop of the first few
// frames, then one of the [loops] we let it follow all the way through, in order to add variance."
//
// A base loop plays drawings base[0]..base[1] forward and back (ping-pong, the end drawings not doubled); after a
// random number of base loops in [every[0], every[1]] the whole take plays through once, then the base loop again.
// Each drawing holds its own ticks. Data-driven from anim.json `idle_variant` (idle and uf_idle). Deterministic for a
// seed, so a replay or a test sees the same idle.

import { drawingIndex, timeline, type IdleVariant } from "./contract.ts";

/** A small seeded PRNG (mulberry32): [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Segment {
  start: number;
  kind: "base" | "full";
  len: number;
  loops: number;
}

export class IdlePlayer {
  /** The base loop's drawings in play order (forward, then back without the end drawings). */
  readonly loopSeq: number[];
  readonly loopTicks: number;
  readonly fullTicks: number;
  private readonly loopStarts: number[];
  private readonly fullStarts: number[];
  private readonly segs: Segment[] = [];
  private readonly rng: () => number;
  private readonly every: [number, number];

  constructor(ticks: readonly number[], v: IdleVariant, rng: () => number) {
    const [a, b] = v.base;
    const seq: number[] = [];
    for (let i = a; i <= b; i++) seq.push(i);
    for (let i = b - 1; i > a; i--) seq.push(i);
    this.loopSeq = seq;
    const lt = timeline(seq.map((i) => ({ ticks: ticks[i]! })));
    this.loopStarts = lt.starts;
    this.loopTicks = lt.total;
    const ft = timeline(ticks.map((t) => ({ ticks: t })));
    this.fullStarts = ft.starts;
    this.fullTicks = ft.total;
    this.rng = rng;
    this.every = v.every;
  }

  private more(): void {
    const last = this.segs[this.segs.length - 1];
    const start = last ? last.start + last.len : 0;
    if (!last || last.kind === "full") {
      const [lo, hi] = this.every;
      const loops = lo + Math.floor(this.rng() * (hi - lo + 1));
      this.segs.push({ start, kind: "base", len: loops * this.loopTicks, loops });
    } else this.segs.push({ start, kind: "full", len: this.fullTicks, loops: 1 });
  }

  private segAt(t: number): Segment {
    while (!this.segs.length || this.segs[this.segs.length - 1]!.start + this.segs[this.segs.length - 1]!.len <= t) this.more();
    let lo = 0, hi = this.segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.segs[mid]!.start <= t) lo = mid;
      else hi = mid - 1;
    }
    return this.segs[lo]!;
  }

  /** Which part plays at tick t (t >= 0) and the drawing shown. */
  at(t: number): { kind: "base" | "full"; index: number } {
    const u = Math.max(0, Math.floor(t));
    const s = this.segAt(u);
    if (s.kind === "base") {
      const k = drawingIndex(this.loopStarts, this.loopTicks, u - s.start, true);
      return { kind: "base", index: this.loopSeq[k]! };
    }
    return { kind: "full", index: drawingIndex(this.fullStarts, this.fullTicks, u - s.start, false) };
  }

  /** The schedule so far (tests, debug). */
  segments(upTo: number): readonly Segment[] {
    this.segAt(Math.max(0, upTo));
    return this.segs;
  }
}
