// Small ships drifting across the planet: tiny dark hulls drawn pixel by pixel
// as point sprites, each with a slow nav blink (never a flash: 1 px, 0.4 s on
// every few seconds). A scene-local PointSystem; the engine only sees points.

import type { PointSink, PointSystem, SimEnv } from "../../engine/types.ts";

const SQUARE = 0;

/** Hull bitmaps: '#' hull, 'o' nav light, '.' empty. Drawn facing right; mirrored when flying left. */
const HULLS: string[][] = [
  ["..##.....", "#######o.", ".#####..."],
  ["...#....", "######o.", "..###..."],
  [".#......", "#####o..", "...##..."],
  ["....##........", "..#########o...", "#############..", "..######......"],
  ["##.", "###", ".#."],
];

/** A capital ship: long, stepped, with a row of faint lights. */
const CAPITAL: string[] = [
  "..........##...................",
  ".....#######......####.........",
  "..##################o######....",
  "#############################o.",
  "..#####...###########..####....",
  ".......####.......####.........",
];

interface Ship {
  x: number;
  y: number;
  vx: number;
  hull: string[];
  ph: number;
  bob: number;
}

export interface ShipOpts {
  /** Band ships cross in, and the x range they cross (layer px). */
  y: [number, number];
  x: [number, number];
  /** Mean seconds between groups; group size; speed px/s. */
  every: number;
  group: [number, number];
  speed: [number, number];
  row: number;
  lightRow: number;
  shade?: number;
  capital?: boolean;
  /** Start with a group already on screen (at this fraction of the crossing). */
  startAt?: number;
  /** Size multiplier (far mode keeps hulls the same pixel size by default). */
  scale?: number;
}

export class Ships implements PointSystem {
  private ships: Ship[] = [];
  private wait: number;
  private t = 0;
  private started = false;
  constructor(private o: ShipOpts) {
    this.wait = o.every * 0.3;
  }

  private spawn(env: SimEnv, at?: number): void {
    const r = env.ctx.rng;
    const o = this.o;
    const dir = r() < 0.5 ? 1 : -1;
    const n = Math.round(o.group[0] + r() * (o.group[1] - o.group[0]));
    const y0 = o.y[0] + r() * (o.y[1] - o.y[0]);
    const sp = o.speed[0] + r() * (o.speed[1] - o.speed[0]);
    const span = o.x[1] - o.x[0];
    const x = at !== undefined ? o.x[0] + span * at : dir > 0 ? o.x[0] : o.x[1];
    const kind = Math.floor(r() * HULLS.length);
    for (let i = 0; i < n; i++) {
      this.ships.push({
        x: x - dir * i * (14 + r() * 12),
        y: y0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (4 + r() * 3),
        vx: dir * sp * (0.94 + r() * 0.12),
        hull: o.capital ? CAPITAL : HULLS[(kind + (i > 0 && r() < 0.4 ? 1 : 0)) % HULLS.length]!,
        ph: r() * 10,
        bob: r() * 6,
      });
    }
  }

  update(dt: number, env: SimEnv): void {
    this.t = env.t;
    const k = env.reduced ? 0.6 : 1;
    if (!this.started) {
      this.started = true;
      if (this.o.startAt !== undefined) this.spawn(env, this.o.startAt);
    }
    if (this.ships.length === 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = this.o.every * (0.6 + env.ctx.rng() * 0.8);
        this.spawn(env);
      }
      return;
    }
    for (const s of this.ships) s.x += s.vx * dt * k;
    const [x0, x1] = this.o.x;
    this.ships = this.ships.filter((s) => (s.vx > 0 ? s.x < x1 + 60 : s.x > x0 - 60));
  }

  draw(sink: PointSink): void {
    const sh = this.o.shade ?? 0.1;
    for (const s of this.ships) {
      const flip = s.vx < 0;
      const hw = s.hull[0]!.length;
      const bx = Math.round(s.x - hw / 2);
      const by = Math.round(s.y + Math.sin(this.t * 0.25 + s.bob) * 1.2);
      for (let r = 0; r < s.hull.length; r++) {
        const line = s.hull[r]!;
        for (let c = 0; c < line.length; c++) {
          const ch = line[flip ? line.length - 1 - c : c];
          if (ch === "#") sink.push(bx + c, by + r, 1, SQUARE, this.o.row, sh + (r === 0 ? 0.12 : 0), 0, 1);
          else if (ch === "o") {
            const on = (this.t + s.ph) % 3.2 < 0.45;
            sink.push(bx + c, by + r, 1, SQUARE, on ? this.o.lightRow : this.o.row, on ? 0.99 : sh, 0, 1);
          }
        }
      }
    }
  }
}
