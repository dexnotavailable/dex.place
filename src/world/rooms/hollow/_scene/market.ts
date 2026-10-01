// C1 Foundry Market backdrop: the amber-hollow scene (w04) re-framed for a
// street 6 H under a walkway, 4 screens wide, plus the market's own near
// layers. The scene's far layers stay exactly as the scenes lane composed
// them (the opening, the rock face, the far city, the hammerhead, the
// furnace pockets, the freighter, the cranes); its own player-plane pieces
// (the gantry, the figure, the foreground frame, the overhang) are left out
// because the room has its own. Added here:
//
//   stacks-back  1.9   stacked houses behind the market, windows, laundry
//   grit         11/2  specks from the ceiling, in bursts on each far footfall
//   stacks       1.35  the market's own houses behind the street
//   street-back  1     room-aligned: the archive block's face and the back
//                      alley, the shrine's furnace alcove, the walkway's
//                      columns, the parapet over the drop at both open ends
//
// Coordinates: every layer is authored at the street framing (the camera
// with the player on the street) and lifted by ref / depth (shift.ts), so the
// camera's climb to the walkway gives true parallax.

import amber from "../../../../scenes/scenes/amber-hollow.ts";
import { geo } from "../../../../scenes/scenes/amber-hollow/geo.ts";
import { buildShip } from "../../../../scenes/scenes/amber-hollow/ship.ts";
import { prelude as amberPrelude, shipLane } from "../../../../scenes/scenes/amber-hollow/glsl.ts";
import { Pix, shaftFn, hashInt, fbm1, type BuildCtx, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import type { PointSink, PointSystem, SimEnv } from "../../../../scenes/engine/types.ts";
import { PULSE } from "../../../../pixel/props/hollow/pulse.ts";
import { lifted } from "./shift.ts";
import { parapet, putter } from "./grammar.ts";
import { bumper, houses, pool, wallTex } from "./houses.ts";

/** Falling grit that bursts on every far footfall (PULSE), plus a slow trickle. */
export class PulseGrit implements PointSystem {
  private ps: { x: number; y: number; v: number; big: boolean }[] = [];
  private seen = PULSE.n;
  private acc = 0;
  constructor(private o: { x0: number; x1: number; y0: number; y1: number; floor: number; speed: number; burst: number; row: number; shade: number; trickle: number }) {}
  update(dt: number, env: SimEnv): void {
    const k = env.reduced ? 0.5 : 1;
    const rng = env.ctx.rng;
    const spawn = (n: number): void => {
      for (let i = 0; i < n && this.ps.length < 90; i++) this.ps.push({ x: this.o.x0 + rng() * (this.o.x1 - this.o.x0), y: this.o.y0 + rng() * (this.o.y1 - this.o.y0), v: this.o.speed * (0.6 + rng() * 0.8), big: rng() > 0.8 });
    };
    if (PULSE.n !== this.seen) {
      this.seen = PULSE.n;
      spawn(Math.round(this.o.burst * PULSE.strength * k));
    }
    this.acc += dt;
    if (this.acc > this.o.trickle) {
      this.acc = 0;
      spawn(1);
    }
    for (const p of this.ps) p.y += p.v * dt * k;
    this.ps = this.ps.filter((p) => p.y < this.o.floor);
  }
  draw(sink: PointSink): void {
    for (const p of this.ps) sink.push(Math.round(p.x), Math.round(p.y), p.big ? 2 : 1, 0, this.o.row, this.o.shade, 0, 1);
  }
}

export interface MarketOpts {
  /** Room size in px, the camera's top row with the player on the street, the street's room y. */
  roomW: number;
  roomH: number;
  ref: number;
  street: number;
  /** World x of the room's left edge (H) and px per H. */
  x0: number;
  H: number;
  /** World x ranges (H) where houses stand behind the street; elsewhere the parapet and the drop. */
  dense: [number, number][];
  /** The row behind (depth 1.9), if it runs further than the front row (across the drop at the west end). */
  denseBack?: [number, number][];
  /** Room-aligned structures, world x in H: the archive block, the alcove, walkway columns. */
  archive: [number, number];
  alcove: [number, number];
  columns: number[];
  walkway: number;
  /** The archive's doorway (world x), its bracket lamp (x, y in world H), the walkway lanterns. */
  door: number;
  doorLamps?: [number, number][];
  lanterns?: [number, number][];
  /** The donor plaque on the alcove's back wall (x, its bottom's world y): a corbel carries it. */
  plaque?: [number, number];
  /** The hearth (world x). */
  hearth: number;
}

export function marketScene(o: MarketOpts): SceneDef {
  const palette = {
    ...amber.palette,
    back: ["#0a080a", "#120e0e", "#1c1512", "#2a1f17", "#3e2c1d", "#5e4128", "#8a6038"],
    furnwall: ["#140a08", "#24120c", "#3a1c10", "#582a14", "#7a3c18", "#a05620"],
    house: ["#08070a", "#0f0c0d", "#181210", "#241a14", "#35271b", "#4e3822", "#76532f"],
    wall: ["#0d0a0b", "#16100e", "#211813", "#2e2218", "#40301f", "#5a4228", "#7e5c36"],
    awnr: ["#2a0e0e", "#4a1a16", "#6e2a1e", "#94402a"],
    awnt: ["#0e1e1e", "#16302e", "#224844", "#34645c"],
    awng: ["#2a1e0e", "#46321a", "#6a4c26", "#8e6a36"],
    shop: ["#5a2c10", "#a2521c", "#e08a3a", "#f0a650"],
    furn: ["#5a1a08", "#a8400e", "#e8761e", "#ffb050", "#ffe6a8"],
  };
  const ref = o.ref;
  return lifted(amber, {
    title: "hollow: foundry market",
    ref,
    vertical: 1,
    palette,
    drop: ["gantry", "figure", "foreground", "overhang", "lamp-glow", "ceiling-dust"],
    prelude: (ctx) => {
      // the scene's prelude, with its deck lamp moved off the map (the room has its own lamps)
      const g = { ...geo(ctx), lamp: [-100000, -100000] as [number, number] };
      const sp = buildShip(g.u);
      const lane = shipLane(g, ctx, sp);
      const { W, H, u } = g;
      const sign = { x: Math.round(W * 0.155), y: Math.round(H * 0.5), w: Math.round(9 * u), h: Math.round(42 * u), row: "signa", period: 9.5, offset: 2, vertical: true };
      return (
        shaftFn({ fn: "openShaft", from: [W * 0.66, H * 0.12], to: [W * 0.4, H * 0.86], w0: H * 0.05, w1: H * 0.2, streaks: 7, speed: 0.035, fadeStart: 0.6, intensity: 0.9 }) +
        shaftFn({ fn: "openShaft2", from: [W * 0.74, H * 0.14], to: [W * 0.9, H * 0.82], w0: H * 0.03, w1: H * 0.1, streaks: 5, speed: -0.03, fadeStart: 0.55, intensity: 0.6 }) +
        amberPrelude(g, sp, lane, sign)
      );
    },
    compose: (ctx, ls) => [...ls, ...near(ctx, o)],
  });
}

function near(ctx: BuildCtx, o: MarketOpts): LayerDef[] {
  const { W, H } = ctx;
  const span = ctx.span;
  const R = (n: string): number => ctx.row(n);
  const out: LayerDef[] = [];
  const feet = o.street - o.ref; // the street line on screen at the reference framing
  /** Room px -> layer x at depth d (what stands behind that room x when you stand there). */
  const lx = (d: number, roomX: number): number => W / 2 + (roomX - W / 2 - span / 2) / d;
  const rx = (wx: number): number => (wx - o.x0) * o.H;
  const wide = (d: number): { x: number; w: number } => {
    const w = ctx.panWidth(d) + 8;
    return { x: -Math.ceil((w - W) / 2), w };
  };
  const light = W * 0.62; // the opening's core, where rims face

  // ceiling grit far off (depth 11), bursting on each footfall
  out.push({
    kind: "points",
    name: "grit-far",
    depth: 11,
    fog: 0.25,
    system: new PulseGrit({ x0: -W * 0.2, x1: W * 1.2, y0: H * 0.04, y1: H * 0.12, floor: H * 0.85, speed: 18, burst: 26, row: R("mid"), shade: 0.4, trickle: 4 }),
  });

  // houses behind the market (depth 1.9): the same streets one row further back, smaller, in
  // more of the hollow's haze (aerial perspective: lighter and flatter than the row in front)
  {
    const d = 1.9;
    const { x, w } = wide(d);
    const top = feet - H * 0.9;
    const pix = new Pix(w, Math.round(H * 1.7));
    const oy = Math.round(top);
    for (const [a, b] of o.denseBack ?? o.dense) {
      houses(pix, x, oy, {
        x0: lx(d, rx(a)) - 70,
        x1: lx(d, rx(b)) + 70,
        ground: feet + 30,
        bottom: oy + pix.h,
        seed: 300 + a,
        row: R("back"),
        wins: [R("win"), R("win2"), R("win3")],
        shop: R("shop"),
        signs: [R("signa"), R("signr"), R("signc")],
        cloth: [R("awnr"), R("awnt"), R("awng")],
        shade: 0.26,
        lightX: light,
        storey: 86,
        minW: 110,
        maxW: 190,
        lit: 0.42,
        scale: 0.56,
        floors: [3, 5],
      });
    }
    out.push({ kind: "pix", name: "stacks-back", depth: d, fog: 0.34, pix, x, y: oy, twinkle: 0.3, dither: 0.25 });
  }
  // near grit, a few specks between the houses
  out.push({
    kind: "points",
    name: "grit-near",
    depth: 2,
    fog: 0,
    system: new PulseGrit({ x0: -W * 0.6, x1: W * 1.6, y0: feet - H * 0.6, y1: feet - H * 0.5, floor: feet, speed: 60, burst: 14, row: R("steam"), shade: 0.45, trickle: 9 }),
  });
  // the market's houses (depth 1.35), at the player's own scale: a storey is about 2 H
  {
    const d = 1.35;
    const { x, w } = wide(d);
    const top = feet - H * 0.95;
    const pix = new Pix(w, Math.round(H * 1.8));
    const oy = Math.round(top);
    for (const [a, b] of o.dense) {
      houses(pix, x, oy, {
        x0: lx(d, rx(a)),
        x1: lx(d, rx(b)),
        ground: feet + 18,
        bottom: oy + pix.h,
        seed: 500 + a,
        row: R("house"),
        wins: [R("win"), R("win2"), R("win")],
        shop: R("shop"),
        signs: [R("signa"), R("signr"), R("signc")],
        cloth: [R("awnr"), R("awnt"), R("awng")],
        shade: 0.27,
        lightX: light,
        storey: 124,
        minW: 170,
        maxW: 280,
        lit: 0.38,
        scale: 0.8,
        floors: [3, 4],
      });
    }
    out.push({ kind: "pix", name: "stacks", depth: d, fog: 0.12, pix, x, y: oy, twinkle: 0.25, dither: 0.15 });
  }

  // room-aligned (depth 1): the parapet at the open ends, the archive block, the alcove, columns
  {
    const oy = -o.ref;
    const pix = new Pix(ctx.panWidth(1) + 8, o.roomH);
    const ox = -Math.round(span / 2) - 4;
    const put = putter(pix, ox + Math.round(span / 2), 0, R("wall"));
    // put() takes room x (the layer x is room x - span / 2)
    const Y = (wy: number): number => o.street - (wy - -32) * o.H;
    const X = rx;
    // parapet over the drop wherever no house stands behind the street
    const open: [number, number][] = [];
    let at = o.x0;
    for (const [a, b] of [...o.dense].sort((p, q) => p[0] - q[0])) {
      if (a > at) open.push([at, a]);
      at = Math.max(at, b);
    }
    if (at < o.x0 + o.roomW / o.H) open.push([at, o.x0 + o.roomW / o.H]);
    for (const [a, b] of open) parapet(pix, ox + Math.round(span / 2), 0, { x0: X(a), x1: X(b), top: o.street - Math.round(o.H * 0.55), bottom: o.street + 40, row: R("wall"), seed: 7 });
    // under the street: the ledge is a slab on a deep girder, with trusses, pipes and a few
    // work lamps hanging into the drop (the street's flagstones are pixel matter, 1.2 H deep)
    {
      const g0 = o.street + Math.round(o.H * 1.2);
      for (let x = 0; x < o.roomW; x++) {
        for (let y = g0; y < g0 + 26; y++) {
          let s = 0.14;
          if (y === g0) s = 0.3;
          else if (y < g0 + 4) s = 0.2;
          else if (y > g0 + 21) s = 0.18;
          else if (x % 48 < 3) s = 0.2;
          put(x, y, s);
        }
        // truss under the girder
        const tw = 56;
        const ph = (x % (tw * 2)) / tw;
        const zy = Math.round(g0 + 26 + (ph < 1 ? ph : 2 - ph) * tw);
        put(x, zy, 0.14);
        put(x, zy + 1, 0.08);
        put(x, g0 + 26 + tw, 0.16);
        put(x, g0 + 27 + tw, 0.08);
      }
      const r = (k: number): number => hashInt(k, 3, 17);
      for (let k = 0; k < o.roomW / 90; k++) {
        const x = Math.round(k * 90 + r(k) * 60);
        const len = 30 + Math.round(r(k + 99) * 120);
        for (let y = g0 + 26; y < g0 + 26 + len; y++) (put(x, y, 0.12), put(x + 1, y, 0.06));
        if (r(k + 7) < 0.3) for (let y = 0; y < 3; y++) for (let q = -1; q < 3; q++) put(x + q, g0 + 26 + len + y, 0.9, R("lamp"), true);
      }
    }
    // the archive block: two storeys of soot-dark brick from the street to the walkway (its roof is
    // the walkway): cut-stone quoins and plinth, a string course, tall lit windows above and small
    // barred ones at the street, and the archive's doorway built into it (an arched stone surround
    // with a deep reveal, a keystone, a step), lit by a bracket lamp beside it
    const bump = bumper(pix, ox + Math.round(span / 2), 0);
    {
      const [a, b] = o.archive;
      const x0 = X(a), x1 = X(b);
      const top = Y(o.walkway) + 2;
      const plinth = o.street - Math.round(o.H * 0.5);
      const floor2 = o.street - Math.round(o.H * 2.9);
      const quoin = (x: number, y: number): boolean => {
        const k = Math.floor((y - top) / 18);
        const reach = k % 2 ? 34 : 22;
        return x - x0 < reach || x1 - 1 - x < reach;
      };
      for (let y = top; y < o.street + 40; y++)
        for (let x = x0; x < x1; x++) {
          let s: number;
          if (y >= plinth) s = 0.24 + wallTex("stone", x - x0, y - plinth, 41) + (y === plinth ? 0.14 : y === plinth + 1 ? 0.06 : 0);
          else if (quoin(x, y)) s = 0.27 + wallTex("stone", x - x0, y - top, 43) * 0.6 + ((y - top) % 18 === 0 ? 0.08 : (y - top) % 18 === 17 ? -0.08 : 0);
          else s = 0.21 + wallTex("brick", x - x0, y - top, 47) + (fbm1(x / 30 + y / 50, 5, 2) - 0.5) * 0.04;
          // soot under the walkway
          if (y < top + 40) s -= ((top + 40 - y) / 40) * 0.06;
          if (Math.abs(y - floor2) < 5) s = y === floor2 - 4 ? 0.4 : y === floor2 - 3 ? 0.3 : y === floor2 + 4 ? 0.1 : 0.24;
          if (x === x0 || x === x0 + 1) s += 0.12;
          put(x, y, s);
        }
      // upper windows: tall, arched, warm, one dark; a spill of light round the lit ones
      for (let k = 0; k < 4; k++) {
        const wx = Math.round(x0 + ((x1 - x0 - 20) * (k + 0.5)) / 4) + 10 - 16;
        const wy = floor2 - 106;
        const lit = k !== 2;
        if (lit) pool(bump, wx + 16, wy + 52, 46, 70, 0.1, 3, k);
        for (let y = wy - 6; y < wy + 78; y++)
          for (let x = wx - 6; x < wx + 38; x++) {
            const rr = Math.hypot(x - (wx + 16), y - (wy + 16));
            if (y - wy < 16 && rr > 22) continue;
            if (x < wx || x >= wx + 32 || (y - wy < 16 && rr > 16) || y < wy) {
              // a brick arch and reveal round the opening
              const voussoir = y - wy < 16 ? Math.abs(Math.floor(Math.atan2(y - (wy + 16), x - (wx + 16)) * 4)) % 2 : 0;
              put(x, y, 0.3 + voussoir * 0.04 + (rr > 20 && y - wy < 16 ? 0.06 : 0) + (x === wx - 6 || x === wx + 37 ? -0.06 : 0));
              continue;
            }
            const frame = x < wx + 3 || x >= wx + 29 || y >= wy + 75 || Math.abs(x - (wx + 16)) < 2 || Math.abs(y - (wy + 40)) < 2 || (rr > 13.5 && y - wy < 16);
            if (frame) put(x, y, 0.34);
            else if (lit) put(x, y, 0.9, R(y - wy < 40 ? "win3" : "win"), true);
            else put(x, y, 0.07 + ((y - wy) % 4 === 0 ? 0.05 : 0) + (x - wx - (y - wy) * 0.4 > 18 && x - wx - (y - wy) * 0.4 < 20 ? 0.14 : 0));
          }
        for (let x = wx - 8; x < wx + 40; x++) (put(x, wy + 78, 0.42), put(x, wy + 79, 0.2), put(x, wy + 80, 0.12));
        for (let q = 0; q < 4; q++) for (let x = wx - 6; x < wx + 38; x++) bump(x, wy + 81 + q, -0.06 + q * 0.015);
        const sx = wx + 4, sy = o.street - Math.round(o.H * 1.25);
        if (Math.abs(sx + 12 - X(o.door)) < 110) continue;
        for (let y = sy - 4; y < sy + 30; y++)
          for (let x = sx - 4; x < sx + 28; x++) {
            if (x < sx || x >= sx + 24 || y < sy || y >= sy + 26) {
              put(x, y, 0.3 + (y < sy ? 0.06 : 0));
              continue;
            }
            const bar = (x - sx) % 6 < 2 || y === sy || y === sy + 25;
            if (bar) put(x, y, 0.32 + ((x - sx) % 6 === 0 ? 0.06 : 0));
            else put(x, y, 0.9, R("win2"), true);
          }
        pool(bump, sx + 12, sy + 20, 30, 26, 0.07, 2, k + 9);
      }
      // cornice under the walkway
      for (let x = x0 - 6; x < x1 + 6; x++) for (let y = top; y < top + 12; y++) put(x, y, y === top + 11 ? 0.08 : y < top + 3 ? 0.36 : 0.24 + (x % 10 === 0 && y > top + 5 ? -0.06 : 0));
      for (let q = 0; q < 6; q++) for (let x = x0; x < x1; x++) bump(x, top + 12 + q, -0.08 + q * 0.013);
      // a drainpipe with brackets
      const dp = x1 - 30;
      for (let y = top + 12; y < o.street; y++) {
        put(dp, y, 0.32);
        put(dp + 1, y, 0.22);
        put(dp + 2, y, 0.1);
        if ((y - top) % 44 === 0) for (let q = -2; q < 5; q++) put(dp + q, y, 0.36);
      }
      // the doorway, built into the wall (the door prop is only the leaf: pixel/props/hollow/doorway.ts).
      // The opening is 4 px wider and taller than the leaf on each side, so the reveal's faces show
      // round it (lit toward the lamp, dark on the far side); cut-stone jambs, a lintel slab, a
      // relieving arch over it whose tympanum carries the book mark, a worn step
      const dX = X(o.door);
      const lw = Math.round(o.H * 0.35); // half the leaf (0.7 H)
      const lh = Math.round(o.H * 1.4);
      const ow = lw + 4, oh = lh + 4;
      const jw = 16;
      const lintB = o.street - oh, lintT = lintB - 16;
      const ahw = ow + jw, rise = 30, ring = 18;
      const archY = (x: number, r: number, h2: number): number => lintT - Math.sqrt(Math.max(0, 1 - ((x - dX) / r) ** 2)) * h2;
      // the tympanum: recessed stone under the arch, in shadow at its top
      for (let y = lintT - rise - 1; y < lintT; y++)
        for (let x = dX - ahw; x < dX + ahw; x++) {
          if (y < archY(x, ahw, rise)) continue;
          put(x, y, 0.17 + wallTex("stone", x, y, 53) * 0.5 - (y < lintT - rise + 8 ? 0.04 : 0));
        }
      // the reveal round the leaf, then the dark opening behind it (seen when the leaf swings)
      for (let y = lintB; y < o.street; y++)
        for (let x = dX - ow; x < dX + ow; x++) {
          const inL = x - (dX - ow), inR = dX + ow - 1 - x, inT = y - lintB;
          let s = 0.04;
          if (inT < 4) s = 0.07 - inT * 0.01;
          else if (inL < 4) s = 0.24 - inL * 0.04;
          else if (inR < 4) s = 0.08;
          put(x, y, s + wallTex("stone", x, y, 55) * 0.3);
        }
      // jambs: long and short blocks, the arris into the opening lit on the lamp side
      for (let y = lintB; y < o.street - 6; y++)
        for (const side of [-1, 1]) {
          const k = Math.floor((o.street - y) / 22);
          const wid = jw + (k % 2 ? 8 : 0);
          for (let q = 0; q < wid; q++) {
            const x = side < 0 ? dX - ow - wid + q : dX + ow + q;
            const iy = (o.street - y) % 22;
            let s = 0.33 + wallTex("stone", x, y, 57) * 0.5;
            if (iy === 0) s -= 0.12;
            else if (iy === 21) s += 0.1;
            const arris = side < 0 ? q === wid - 1 : q === 0;
            const outer = side < 0 ? q === 0 : q === wid - 1;
            if (arris) s += side < 0 ? 0.14 : 0.04;
            if (outer) s -= 0.08;
            put(x, y, s);
          }
        }
      // the lintel: one slab, lit along its top, a shadow under it on the reveal
      for (let y = lintT; y < lintB; y++)
        for (let x = dX - ahw - 6; x < dX + ahw + 6; x++) put(x, y, 0.35 + (y === lintT ? 0.14 : y === lintT + 1 ? 0.06 : y === lintB - 1 ? -0.1 : 0) + wallTex("stone", x * 3, y, 58) * 0.25 + (x === dX - ahw - 6 ? 0.08 : x === dX + ahw + 5 ? -0.08 : 0));
      // the relieving arch: voussoirs and a keystone
      for (let t = 0; t <= Math.PI; t += 0.002)
        for (let k = 0; k < ring; k++) {
          const x = Math.round(dX - Math.cos(t) * (ahw + k));
          const y = Math.round(lintT - Math.sin(t) * (rise + k * 0.9));
          const segf = (t / Math.PI) * 7;
          let s = 0.3 + (Math.floor(segf) % 2) * 0.04 + wallTex("stone", x, y, 59) * 0.4;
          if (k === 0) s += 0.12;
          if (k === ring - 1) s -= 0.08;
          if (Math.abs(segf - Math.round(segf)) < 0.045) s -= 0.1;
          put(x, y, s);
        }
      for (let y = lintT - rise - ring - 6; y < lintT - rise + 4; y++)
        for (let x = dX - 11; x < dX + 11; x++) put(x, y, 0.4 + (y === lintT - rise - ring - 6 ? 0.12 : 0) + (x === dX - 11 ? 0.06 : x === dX + 10 ? -0.08 : 0) + wallTex("stone", x, y, 61) * 0.3);
      // the step: a worn stone slab proud of the street, its nose lit
      for (let x = dX - ahw - 14; x < dX + ahw + 14; x++) {
        const worn = Math.abs(x - dX) < lw ? 1 : 0;
        for (let q = 0; q < 6 - worn; q++) put(x, o.street - 6 + worn + q, 0.3 + (q === 0 ? 0.16 : q === 1 ? 0.06 : -0.03 * q) + wallTex("stone", x, q, 63) * 0.3);
      }
      // pilasters between the window bays and either side of the doorway: cut stone standing proud
      // of the brick, lit on the side toward the opening, from the plinth to the string course
      {
        const bays = 4;
        const pxs: number[] = [];
        for (let k = 1; k < bays; k++) pxs.push(Math.round(x0 + ((x1 - x0 - 20) * k) / bays) + 10);
        pxs.push(dX - ahw - 54, dX + ahw + 54);
        for (const pcx of pxs) {
          if (Math.abs(pcx - dX) < ahw + 30) continue;
          for (let y = floor2 + 5; y < plinth; y++)
            for (let q = -11; q < 11; q++) {
              const course = Math.floor((y - floor2) / 18);
              let s = 0.29 + wallTex("stone", pcx + q, y, 91) * 0.4 + ((y - floor2) % 18 === 0 ? -0.08 : 0);
              if (q === -11) s += 0.14;
              else if (q === -10) s += 0.05;
              else if (q === 10) s -= 0.1;
              if (course % 2 && (q === -11 || q === 10)) s += 0.02;
              put(pcx + q, y, s);
            }
          for (let y = floor2 + 5; y < plinth; y++) for (let q = 11; q < 16; q++) bump(pcx + q, y, -0.06 + (q - 11) * 0.012);
          // a capital and a base
          for (let q = -14; q < 14; q++) for (let y = 0; y < 6; y++) (put(pcx + q, floor2 + 5 + y, 0.36 + (y === 0 ? 0.12 : y === 5 ? -0.1 : 0)), put(pcx + q, plinth - 6 + y, 0.34 + (y === 0 ? 0.1 : 0)));
        }
      }
      // the bracket lamps' iron: a wall plate, a scrolled arm out to the hang point (mirrored on the
      // far side of the doorway), and their light on the wall, the surround and the step
      for (const [lxw, lhy] of o.doorLamps ?? []) {
        const lx2 = X(lxw), ly2 = Y(lhy);
        const sd = lx2 < dX ? 1 : -1; // the arm reaches toward the door
        const P = (dx: number, y: number, v: number): void => put(lx2 - sd * dx, y, v);
        for (let y = ly2 - 6; y < ly2 + 22; y++) for (let dx = 22; dx <= 30; dx++) P(dx, y, 0.34 + (dx === 30 ? 0.1 : 0) + (y === ly2 - 6 ? 0.1 : 0));
        for (let dx = -1; dx <= 22; dx++) (P(dx, ly2 - 1, 0.44), P(dx, ly2, 0.28));
        for (let i = 0; i < 18; i++) P(22 - i, ly2 + 18 - i, 0.32);
        for (let a2 = 0; a2 < Math.PI * 1.6; a2 += 0.08) put(Math.round(lx2 - sd * (10 - Math.cos(a2) * 4)), Math.round(ly2 + 6 + Math.sin(a2) * 4), 0.36);
        pool(bump, lx2, ly2 + 40, 150, 170, 0.13, 4, Math.round(lxw * 10));
      }
      // the walkway lanterns' light on the upper wall
      for (const [lw, lhy] of o.lanterns ?? []) if (X(lw) > x0 && X(lw) < x1) pool(bump, X(lw), Y(lhy) + 20, 70, 80, 0.06, 2, Math.round(lw));
    }
    // the shrine alcove: an arched niche in a cut-stone wall, warm inside from the hearth at its back;
    // the hearth has an iron hood and a flue that climbs the niche and on up a chimney breast; the
    // fire's light spills out of the arch onto the street wall; a carved flame (the shrine's mark)
    // over the arch; the donor plaque stands on a corbel, not on nothing
    {
      const [a, b] = o.alcove;
      const x0 = X(a), x1 = X(b);
      const top = Y(o.walkway) + 2;
      const n0 = X(a + 0.9), n1 = X(b - 0.9);
      const cx = (n0 + n1) / 2;
      const hw = (n1 - n0) / 2;
      const archTop = o.street - Math.round(o.H * 3.2);
      const spring = archTop + Math.round(hw * 0.35);
      const fx = X(o.hearth), fw = Math.round(o.H * 0.8), fh = Math.round(o.H * 1.05);
      const inNiche = (x: number, y: number): boolean => x >= n0 && x < n1 && (y >= spring || Math.hypot((x - cx) / hw, (y - spring) / (spring - archTop)) < 1);
      for (let y = top; y < o.street + 40; y++)
        for (let x = x0; x < x1; x++) {
          if (inNiche(x, y)) {
            // the back of the niche: stone courses in a warm stepped light, brightest low and toward the fire
            const heat = Math.max(0, 1 - Math.hypot((x - fx) / (hw * 1.25), (y - o.street) / (o.H * 2.9)));
            let s = 0.13 + Math.floor(heat * 6) * 0.075 + wallTex("stone", x - n0, y - archTop, 67) * 0.8;
            // the niche's own depth: its sides and crown in shadow
            const side = Math.min(x - n0, n1 - 1 - x);
            if (side < 18) s -= (18 - side) * 0.006;
            if (y < spring + 20) s -= 0.03;
            put(x, y, s, R("furnwall"));
            continue;
          }
          let s = 0.22 + wallTex("stone", x - x0, y - top, 69);
          if (y < top + 40) s -= ((top + 40 - y) / 40) * 0.06;
          put(x, y, s);
        }
      // the fire's light out through the arch, on the jambs, the street wall and the step
      pool(bump, fx - fw * 0.3, o.street - 20, hw * 1.7, o.H * 2.4, 0.14, 4, 81);
      // voussoirs round the arch, the jambs, their inner arris lit by the fire
      for (let t = Math.PI; t <= Math.PI * 2; t += 0.0025)
        for (let k = 0; k < 18; k++) {
          const x = Math.round(cx + Math.cos(t) * (hw + k));
          const y = Math.round(spring + Math.sin(t) * (spring - archTop + k));
          const segf = ((t - Math.PI) / Math.PI) * 13;
          const seg = Math.floor(segf);
          let s = 0.27 + (seg % 2) * 0.05 + wallTex("stone", x, y, 71) * 0.4 - (k > 15 ? 0.08 : 0);
          if (Math.abs(segf - Math.round(segf)) < 0.05) s -= 0.1;
          if (k < 3) put(x, y, 0.42 + (2 - k) * 0.08 + (Math.cos(t) > 0 ? 0.1 : 0), R("furnwall"));
          else put(x, y, s);
        }
      for (const jx of [n0 - 18, n1])
        for (let y = spring; y < o.street; y++)
          for (let k = 0; k < 18; k++) {
            const inner = jx < cx ? k >= 15 : k < 3;
            const iy = (o.street - y) % 26;
            if (inner) put(jx + k, y, 0.4 + (jx > cx ? 0.12 : 0) + (iy === 0 ? -0.1 : 0), R("furnwall"));
            else put(jx + k, y, 0.27 + wallTex("stone", jx + k, y, 73) * 0.5 + (iy === 0 ? -0.1 : iy === 25 ? 0.08 : 0) + (jx < cx ? (k === 0 ? -0.06 : 0) : k === 17 ? -0.06 : 0));
          }
      // a keystone carved with the flame
      {
        const ky = archTop - 2;
        for (let y = ky - 26; y < ky + 20; y++)
          for (let x = cx - 16; x < cx + 16; x++) {
            const taper = (y - (ky - 26)) / 46;
            if (Math.abs(x - cx) > 10 + (1 - taper) * 6) continue;
            let s = 0.36 + wallTex("stone", x, y, 75) * 0.3 + (y === ky - 26 ? 0.12 : 0);
            // the flame in low relief: a teardrop, lit on its left
            const fyy = (y - (ky - 18)) / 26;
            const fwid = fyy > 0 && fyy < 1 ? Math.sin(fyy * Math.PI) * (fyy > 0.5 ? 7 : 7 * (fyy * 1.6)) : 0;
            if (Math.abs(x - cx) < fwid) s += x < cx ? 0.12 : -0.04;
            else if (Math.abs(Math.abs(x - cx) - fwid) < 1 && fwid > 0) s -= 0.1;
            put(Math.round(x), y, s);
          }
      }
      // above the arch: a string course, and the hearth hall's high round windows glowing from the
      // fire inside, each in a stone ring with a sill, soot licking up from them
      {
        const course = archTop - 44;
        for (let x = x0; x < x1; x++)
          for (let q = 0; q < 9; q++) {
            if (Math.abs(x - fx) < 34) continue;
            put(x, course + q, 0.3 + (q === 0 ? 0.16 : q === 1 ? 0.06 : q === 8 ? -0.12 : 0) + wallTex("stone", x, q, 87) * 0.3);
          }
        for (let q = 0; q < 4; q++) for (let x = x0; x < x1; x++) if (Math.abs(x - fx) >= 34) bump(x, course + 9 + q, -0.07 + q * 0.016);
        const wy = Math.round((top + 14 + course) / 2);
        for (const wxk of [-0.62, -0.18, 0.26]) {
          const wx = Math.round(cx + hw * wxk);
          if (Math.abs(wx - fx) < 70 || wy - 30 < top + 14) continue;
          pool(bump, wx, wy - 10, 46, 60, 0.07, 2, wx);
          for (let y = wy - 30; y <= wy + 30; y++)
            for (let x = wx - 30; x <= wx + 30; x++) {
              const d = Math.hypot(x - wx, y - wy);
              if (d > 30) continue;
              if (d > 22) {
                const seg = Math.floor(((Math.atan2(y - wy, x - wx) + Math.PI) / (Math.PI * 2)) * 12);
                put(x, y, 0.3 + (seg % 2) * 0.05 + (y < wy ? 0.06 : -0.04) + (d > 29 ? -0.08 : 0));
              } else if (Math.abs(x - wx) < 1.5 || Math.abs(y - wy) < 1.5 || Math.abs(d - 11) < 1) put(x, y, 0.26);
              else put(x, y, 0.9, R(d < 11 ? "win" : "win2"), true);
            }
          for (let x = wx - 26; x < wx + 26; x++) for (let q = 0; q < 4; q++) put(x, wy + 30 + q, 0.34 + (q === 0 ? 0.12 : 0));
          for (let q = 0; q < 50; q++) for (let x = wx - 14; x < wx + 14; x++) if (hashInt(x, q, 89 + wx) < 0.45 - q / 120) bump(x, wy - 31 - q, -0.05);
        }
      }
      // the firebox: a squat arched mouth at the back right, black inside, a stone lintel
      for (let y = o.street - fh; y < o.street; y++)
        for (let x = fx - fw; x < fx + fw; x++) {
          const d = Math.hypot((x - fx) / fw, (y - (o.street - fh * 0.55)) / (fh * 0.45));
          if (y < o.street - fh * 0.55 && d > 1) continue;
          put(x, y, 0.03 + (y > o.street - 10 ? 0.1 : 0), R("back"));
        }
      for (let x = fx - fw - 10; x < fx + fw + 10; x++) for (let y = o.street - fh - 10; y < o.street - fh + 2; y++) put(x, y, y === o.street - fh - 10 ? 0.44 : y > o.street - fh - 2 ? 0.5 : 0.3 + wallTex("stone", x, y, 77) * 0.4, R("furnwall"));
      // the hood: riveted iron, wide over the mouth, narrowing to the flue
      const hoodB = o.street - fh - 10, hoodT = hoodB - 48;
      const flueW = 30;
      for (let y = hoodT; y < hoodB; y++) {
        const t = (y - hoodT) / (hoodB - hoodT);
        const half = flueW / 2 + t * (fw + 6 - flueW / 2);
        for (let x = Math.round(fx - half); x < fx + half; x++) {
          const u = (x - (fx - half)) / (half * 2);
          let s = 0.16 + Math.sin(u * Math.PI) * 0.1 + (y === hoodB - 1 ? 0.2 : 0) + (u < 0.06 ? 0.08 : 0);
          if ((y - hoodT) % 12 === 0) s += 0.06;
          if ((y - hoodT) % 12 === 6 && Math.round(u * 10) % 2 === 0 && Math.abs(u * 10 - Math.round(u * 10)) < 0.08) s += 0.18;
          // underside glow from the fire below
          if (hoodB - y < 6) put(x, y, 0.55 - (hoodB - y) * 0.06, R("furnwall"));
          else put(x, y, s, R("back"));
        }
      }
      // the flue up the niche and on up the chimney breast above the arch (to the walkway)
      const ringOut = Math.round(spring - Math.sqrt(Math.max(0, 1 - ((fx - cx) / (hw + 18)) ** 2)) * (spring - archTop + 18));
      for (let y = top + 12; y < hoodT; y++) {
        if (y < ringOut - 1) {
          // the chimney breast: brick standing a little proud, lit on its fire side
          for (let x = fx - 34; x < fx + 34; x++) put(x, y, 0.31 + wallTex("brick", x - fx + 340, y, 79) + (x < fx - 31 ? 0.16 : x < fx - 28 ? 0.06 : x > fx + 30 ? -0.12 : 0) + (y === ringOut - 2 ? 0.12 : 0));
          for (let x = fx + 34; x < fx + 46; x++) bump(x, y, -0.09 + (x - fx - 34) * 0.006);
          continue;
        }
        // the iron flue, through the arch and down the niche to the hood
        for (let x = fx - flueW / 2; x < fx + flueW / 2; x++) {
          const u = (x - (fx - flueW / 2)) / flueW;
          let s = 0.12 + Math.sin(u * Math.PI) * 0.12 + (u < 0.1 ? 0.06 : 0);
          if ((y - top) % 40 < 3) s += 0.1;
          if ((y - top) % 40 === 1 && (u < 0.15 || u > 0.85)) s += 0.12;
          put(x, y, s, R("back"));
        }
      }
      for (let q = 0; q < 70; q++) for (let x = fx - 46; x < fx + 46; x++) if (hashInt(x, q, 83) < 0.5 - q / 160) bump(x, top + 12 + q, -0.05);
      // the plaque's corbel: a stone shelf with two brackets, a shadow behind the plaque
      if (o.plaque) {
        const [pxw, pyw] = o.plaque;
        const px2 = X(pxw), py2 = Y(pyw);
        for (let y = py2 - 34; y < py2 + 2; y++) for (let x = px2 - 22; x < px2 + 28; x++) bump(x, y, -0.07);
        for (let x = px2 - 32; x < px2 + 32; x++) for (let q = 0; q < 7; q++) put(x, py2 + q, 0.44 + (q === 0 ? 0.2 : q === 1 ? 0.08 : q === 6 ? -0.14 : 0) + wallTex("stone", x, q, 85) * 0.3, R("furnwall"));
        for (const bx2 of [px2 - 24, px2 + 16]) for (let q = 0; q < 12; q++) for (let t = 0; t < 8 - Math.floor(q * 0.6); t++) put(bx2 + t, py2 + 7 + q, 0.3 - q * 0.01, R("furnwall"));
        for (let q = 0; q < 4; q++) for (let x = px2 - 30; x < px2 + 30; x++) bump(x, py2 + 19 + q, -0.06 + q * 0.015);
      }
    }
    // the walkway's columns: riveted steel from the street up under the deck, with knee braces
    for (const cxw of o.columns) {
      const cx = X(cxw);
      const top = Y(o.walkway) + 12;
      for (let y = top; y < o.street + Math.round(o.H * 1.2); y++)
        for (let k = -9; k <= 9; k++) {
          let s = 0.16;
          if (k <= -8) s = 0.3;
          else if (k >= 8) s = 0.1;
          else if (Math.abs(k) < 3) s = 0.13;
          if ((y - top) % 40 < 2) s += 0.06;
          if (Math.abs(k) === 6 && (y - top) % 10 === 5) s += 0.12;
          put(cx + k, y, s);
        }
      for (let i = 0; i < 70; i++)
        for (const side of [-1, 1]) {
          const x = cx + side * (9 + i);
          const y = top + Math.round(70 - i);
          put(x, y, 0.2);
          put(x, y + 1, 0.12);
          put(x, y + 2, 0.08);
        }
    }
    out.push({ kind: "pix", name: "street-back", depth: 1, fog: 0, pix, x: ox, y: oy, twinkle: 0.15, dither: 0 });
  }
  return out;
}
