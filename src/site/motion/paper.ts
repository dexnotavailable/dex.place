// The homepage loader's moving parts, drawn as whole pixels on the page's overlay canvas (motion/column.ts):
//
// - `Paper`: the small ofuda (8 x 20 art px, the world's own drawing; sprites.ts) as a short chain of paper
//   points hanging from its tie: it trails behind wherever it is carried, flutters in the wind, twists so its
//   back shows now and then, and bends row by row (the "paper physics" Dex asked for: a few px, real paper).
// - `LoaderStage`: the chibi loader items (placeholders) cycling under the "dex" mark: each drops in, bobs,
//   hops once or twice and leaves as pixel dust on the mark's wind (left to right); when the world is ready
//   the cycle lands on the ofuda (it drops in last and stays).
//
// Positions are css px on the page; one art px is `k` device px (whole numbers: never smoothed).

import { ITEMS, ITEM_SIZE, OFUDA_BACK, OFUDA_FRONT, OFUDA_H, OFUDA_W, PAL, roster, type ItemId, type Rgb } from "./sprites.ts";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Paints whole-pixel squares, batching fills by colour. */
export class PixelPen {
  private ctx: CanvasRenderingContext2D;
  private last = "";
  alpha = 1;
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  px(x: number, y: number, k: number, c: Rgb, a = 1): void {
    const style = `rgba(${c[0]},${c[1]},${c[2]},${a * this.alpha})`;
    if (style !== this.last) {
      this.ctx.fillStyle = style;
      this.last = style;
    }
    this.ctx.fillRect(x, y, k, k);
  }
  reset(): void {
    this.last = "";
  }
}

// ------------------------------------------------------------------------------------------------ the ofuda

interface Node { x: number; y: number; px: number; py: number }

const NODES = 4;
const SEG = (OFUDA_H - 1) / (NODES - 1);

export interface PaperState {
  /** Wind across it, art px / s^2 (+ to the right). */
  wind: number;
  /** How restless the air is, 0..1. */
  flutter: number;
}

export class Paper {
  private nodes: Node[] = [];
  private twist = 0;
  private twistV = 0;
  private t = Math.random() * 10;
  private flipT = -1;
  /** Css px per art px the sim was last run at (the chain lives in art px). */
  private kc = 2;

  constructor() {
    for (let i = 0; i < NODES; i++) this.nodes.push({ x: 0, y: i * SEG, px: 0, py: i * SEG });
  }

  /** Puts the chain straight down from (x, y) css px, at rest. */
  place(x: number, y: number, kc: number): void {
    this.kc = kc;
    const ax = x / kc, ay = y / kc;
    this.nodes.forEach((n, i) => {
      n.x = n.px = ax;
      n.y = n.py = ay + i * SEG;
    });
    this.twist = this.twistV = 0;
  }

  /** A gust: one or two quick flips (the press). */
  flip(): void {
    this.flipT = 0;
  }

  /** Moves its tie to (x, y) css px and lets the paper follow. */
  step(dt: number, x: number, y: number, kc: number, s: PaperState, reduced: boolean): void {
    if (Math.abs(kc - this.kc) > 1e-3 || !this.nodes[0]) this.place(x, y, kc);
    const ax = x / kc, ay = y / kc;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    if (reduced) {
      // no physics: it hangs straight from the tie
      this.place(x, y, kc);
      this.twist = 0;
      return;
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let s0 = 0; s0 < steps; s0++) {
      const n0 = this.nodes[0]!;
      n0.px = n0.x;
      n0.py = n0.y;
      n0.x = ax;
      n0.y = ay;
      const tt = this.t + s0 * h;
      const gust = s.flutter * (Math.sin(tt * 3.1) * 0.6 + Math.sin(tt * 7.7 + 1.3) * 0.4);
      const fx = s.wind + gust * 70;
      for (let i = 1; i < NODES; i++) {
        const n = this.nodes[i]!;
        // paper is light: a lot of drag
        const vx = (n.x - n.px) * 0.93, vy = (n.y - n.py) * 0.93;
        n.px = n.x;
        n.py = n.y;
        n.x += vx + fx * (i / NODES) * h * h;
        n.y += vy + 260 * h * h;
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < NODES; i++) {
          const a = this.nodes[i - 1]!, b = this.nodes[i]!;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const f = (d - SEG) / d;
          if (i === 1) { b.x -= dx * f; b.y -= dy * f; }
          else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; }
        }
      }
      // twist: a spring toward what the wind wants, plus the gust's flips
      let target = s.flutter * 0.55 * Math.sin(tt * 1.7 + Math.sin(tt * 0.6) * 2);
      if (this.flipT >= 0) {
        this.flipT += h;
        target = this.flipT < 0.9 ? this.flipT * Math.PI * 4.4 : 0;
        if (this.flipT >= 0.9) this.flipT = -1;
      }
      this.twistV += ((target - this.twist) * 90 - this.twistV * 9) * h;
      this.twist += this.twistV * h;
    }
  }

  /** The tie's position and the chain's lowest point, css px (the poke zone). */
  bounds(): { x0: number; y0: number; x1: number; y1: number } {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes) {
      x0 = Math.min(x0, n.x - OFUDA_W / 2);
      x1 = Math.max(x1, n.x + OFUDA_W / 2);
      y0 = Math.min(y0, n.y);
      y1 = Math.max(y1, n.y + 1);
    }
    return { x0: x0 * this.kc, y0: y0 * this.kc, x1: x1 * this.kc, y1: y1 * this.kc };
  }

  /** Draws it: each row of the drawing along the chain, as wide as its twist shows it. */
  draw(pen: PixelPen, k: number, dpr: number): void {
    const css = k / dpr;
    const scale = this.kc / css; // art px of the sim -> art px on screen (the same, unless kc changed)
    let prevY = -Infinity;
    for (let r = 0; r < OFUDA_H; r++) {
      const u = r / (OFUDA_H - 1);
      const seg = Math.min(NODES - 2, Math.floor(u * (NODES - 1)));
      const f = u * (NODES - 1) - seg;
      const a = this.nodes[seg]!, b = this.nodes[seg + 1]!;
      const cx = (a.x + (b.x - a.x) * f) * scale;
      const cy = (a.y + (b.y - a.y) * f) * scale;
      const tw = this.twist * (0.25 + 0.75 * u);
      const c = Math.cos(tw);
      const w = Math.max(1, Math.round(OFUDA_W * Math.abs(c)));
      const back = c < 0;
      const rows = back ? OFUDA_BACK : OFUDA_FRONT;
      const row = rows[r]!;
      const y = Math.round(cy);
      const x0 = Math.round(cx - w / 2);
      // fill any gap the chain's stretch leaves between rows with this row
      const from = prevY === -Infinity ? y : Math.min(y, prevY + 1);
      for (let yy = from; yy <= y; yy++) {
        for (let i = 0; i < w; i++) {
          // sample the drawing nearest (mirrored on the back, as paper is)
          let col = Math.min(OFUDA_W - 1, Math.floor(((i + 0.5) / w) * OFUDA_W));
          if (back) col = OFUDA_W - 1 - col;
          const ch = row[col]!;
          if (ch === ".") continue;
          pen.px((x0 + i) * k, yy * k, k, PAL[ch]!);
        }
      }
      prevY = Math.max(prevY, y);
    }
  }
}

// ------------------------------------------------------------------------------------------- the loader items

/** Seconds: drop in, stay, leave. */
export const ITEM_TIME = { enter: 0.42, stay: 3.4, exit: 0.5, hops: [1.3, 2.5] as const, minStay: 0.7, ofudaDrop: 0.75 };

interface Dust { x: number; y: number; vx: number; vy: number; age: number; life: number; c: Rgb }

export type StagePhase = "item" | "ofuda" | "done";

export class LoaderStage {
  private order: ItemId[];
  private at = 0;
  private t = 0;
  private landing = false;
  /** When the item on show leaves (s into its turn). */
  private leaveAt = ITEM_TIME.enter + ITEM_TIME.stay;
  private dust: Dust[] = [];
  private poked = -1;
  phase: StagePhase = "item";
  /** Seconds since the ofuda began to drop in (phase "ofuda" / "done"). */
  ofudaT = 0;

  constructor(seed: number) {
    this.order = roster(seed, 6);
  }

  get item(): ItemId {
    return this.order[this.at % this.order.length]!;
  }

  /** The items that have shown so far, in order (for checks). */
  shown(): ItemId[] {
    return this.order.slice(0, this.at + 1);
  }

  /** Loading has finished: the current item leaves (once it has been seen a moment) and the ofuda lands. */
  land(): void {
    if (this.landing) return;
    this.landing = true;
    const T = ITEM_TIME;
    this.leaveAt = Math.min(this.leaveAt, Math.max(this.t, T.enter + T.minStay));
  }

  poke(): void {
    if (this.phase === "item") this.poked = this.t;
  }

  /** Skips straight to the ofuda at rest (a return visit that finds the world already in). */
  settle(): void {
    this.landing = true;
    this.phase = "done";
    this.ofudaT = ITEM_TIME.ofudaDrop;
    this.dust = [];
  }

  /**
   * Advances. `x`, `y`: the stage's anchor in css px (top centre of a 16 px item); the dust is left behind in
   * page space. Returns true when the current item has just left (its dust released).
   */
  step(dt: number, x: number, y: number, kc: number, reduced: boolean): boolean {
    this.t += dt;
    for (const d of this.dust) {
      d.age += dt;
      d.vx += 260 * kc * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    this.dust = this.dust.filter((d) => d.age < d.life);
    if (this.phase !== "item") {
      this.ofudaT += dt;
      if (this.ofudaT >= ITEM_TIME.ofudaDrop) this.phase = "done";
      return false;
    }
    // reduced motion: no dust, the next one simply takes its place
    const gone = reduced ? this.leaveAt : this.leaveAt + ITEM_TIME.exit * 0.2;
    if (this.t < gone) return false;
    if (!reduced) this.release(x, y, kc);
    if (this.landing) {
      this.phase = reduced ? "done" : "ofuda";
      this.ofudaT = reduced ? ITEM_TIME.ofudaDrop : 0;
    } else {
      this.at += 1;
      this.t = 0;
      this.leaveAt = ITEM_TIME.enter + ITEM_TIME.stay;
    }
    return true;
  }

  private release(x: number, y: number, kc: number): void {
    const rows = ITEMS[this.item].rows;
    let i = 0;
    for (let yy = 0; yy < ITEM_SIZE; yy++) {
      for (let xx = 0; xx < ITEM_SIZE; xx++) {
        const ch = rows[yy]![xx]!;
        if (ch === ".") continue;
        const h = Math.sin((xx * 12.9898 + yy * 78.233 + i++) * 43758.5453) * 0.5 + 0.5;
        this.dust.push({
          x: x + (xx - ITEM_SIZE / 2) * kc,
          y: y + yy * kc,
          vx: (60 + 180 * h) * kc,
          vy: (h - 0.5) * 18 * kc,
          age: 0,
          life: 0.14 + 0.32 * h * h,
          c: PAL[ch]!,
        });
      }
    }
  }

  /** The item's offset from its rest (art px) and whether it shows, for the frame. */
  private pose(reduced: boolean): { dy: number; show: number } {
    // leaving: it has turned to dust already (the release happens a beat into the exit)
    const T = ITEM_TIME;
    const t = this.t;
    if (reduced) return { dy: 0, show: 1 };
    if (t < T.enter) {
      // drops in from above and lands with one small bounce
      const u = t / T.enter;
      const fall = u < 0.7 ? -14 * (1 - (u / 0.7) * (u / 0.7)) : -2 * Math.sin(((u - 0.7) / 0.3) * Math.PI);
      return { dy: Math.round(fall), show: 1 };
    }
    let dy = Math.floor((t * 2) % 2) === 0 ? 0 : -1; // a slow one-pixel bob
    for (const at of T.hops) {
      const u = (t - T.enter - at) / 0.36;
      if (u > 0 && u < 1) dy = -Math.round(5 * Math.sin(u * Math.PI));
    }
    if (this.poked >= 0) {
      const u = (t - this.poked) / 0.3;
      if (u > 0 && u < 1) dy = -Math.round(4 * Math.sin(u * Math.PI));
    }
    return { dy, show: 1 };
  }

  /** How far above its rest the dropping ofuda is (art px); 0 once it has landed. */
  ofudaLift(): number {
    if (this.phase === "done") return 0;
    const u = clamp01(this.ofudaT / ITEM_TIME.ofudaDrop);
    return -26 * (1 - u) * (1 - u);
  }

  /** Is an item (not the ofuda) on show right now? */
  itemShowing(): boolean {
    return this.phase === "item";
  }

  draw(pen: PixelPen, x: number, y: number, k: number, dpr: number, reduced: boolean): void {
    // the dust (page space)
    for (const d of this.dust) {
      const u = d.age / d.life;
      const a = u < 0.5 ? 1 : u < 0.78 ? 0.62 : 0.3;
      pen.px(Math.round((d.x * dpr) / k) * k, Math.round((d.y * dpr) / k) * k, k, d.c, a);
    }
    if (!this.itemShowing()) return;
    const { dy, show } = this.pose(reduced);
    if (!show) return;
    const rows = ITEMS[this.item].rows;
    const ox = Math.round((x * dpr) / k) - ITEM_SIZE / 2;
    const oy = Math.round((y * dpr) / k) + dy;
    for (let yy = 0; yy < ITEM_SIZE; yy++) {
      const row = rows[yy]!;
      for (let xx = 0; xx < ITEM_SIZE; xx++) {
        const ch = row[xx]!;
        if (ch === ".") continue;
        pen.px((ox + xx) * k, (oy + yy) * k, k, PAL[ch]!);
      }
    }
  }
}
