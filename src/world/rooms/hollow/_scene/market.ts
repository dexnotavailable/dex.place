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
import { parapet, putter, stacks } from "./grammar.ts";

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
  /** Room-aligned structures, world x in H: the archive block, the alcove, walkway columns. */
  archive: [number, number];
  alcove: [number, number];
  columns: number[];
  walkway: number;
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

  // houses behind the market (depth 1.9): taller, further, dimmer
  {
    const d = 1.9;
    const { x, w } = wide(d);
    const top = feet - H * 0.62;
    const pix = new Pix(w, Math.round(H * 1.4));
    const oy = Math.round(top);
    for (const [a, b] of o.dense) {
      stacks(pix, x, oy, {
        x0: lx(d, rx(a)) - 40,
        x1: lx(d, rx(b)) + 40,
        ground: feet + 30,
        bottom: oy + pix.h,
        minH: 150,
        maxH: 380,
        minW: 60,
        maxW: 150,
        win: 3,
        seed: 300 + a,
        row: R("back"),
        wins: [R("win"), R("win2"), R("win")],
        door: R("shop"),
        signs: [R("signa"), R("signr"), R("signc")],
        cloth: [R("awnr"), R("awnt"), R("awng")],
        lit: 0.26,
        shade: 0.17,
        lightX: light,
      });
    }
    out.push({ kind: "pix", name: "stacks-back", depth: d, fog: 0.22, pix, x, y: oy, twinkle: 0.3, dither: 0.2 });
  }
  // near grit, a few specks between the houses
  out.push({
    kind: "points",
    name: "grit-near",
    depth: 2,
    fog: 0,
    system: new PulseGrit({ x0: -W * 0.6, x1: W * 1.6, y0: feet - H * 0.6, y1: feet - H * 0.5, floor: feet, speed: 60, burst: 14, row: R("steam"), shade: 0.45, trickle: 9 }),
  });
  // the market's houses (depth 1.35)
  {
    const d = 1.35;
    const { x, w } = wide(d);
    const top = feet - H * 0.72;
    const pix = new Pix(w, Math.round(H * 1.5));
    const oy = Math.round(top);
    for (const [a, b] of o.dense) {
      stacks(pix, x, oy, {
        x0: lx(d, rx(a)),
        x1: lx(d, rx(b)),
        ground: feet + 18,
        bottom: oy + pix.h,
        minH: 190,
        maxH: 470,
        minW: 90,
        maxW: 190,
        win: 4,
        seed: 500 + a,
        row: R("house"),
        wins: [R("win"), R("win2"), R("win"), R("shop")],
        door: R("shop"),
        signs: [R("signa"), R("signr"), R("signc")],
        cloth: [R("awnr"), R("awnt"), R("awng")],
        lit: 0.3,
        shade: 0.13,
        lightX: light,
      });
    }
    out.push({ kind: "pix", name: "stacks", depth: d, fog: 0.08, pix, x, y: oy, twinkle: 0.25, dither: 0 });
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
    // the archive block: two storeys from the street to the walkway (its roof is the walkway):
    // a stone plinth, pilasters, small barred windows at the street, lit windows above, a cornice
    {
      const [a, b] = o.archive;
      const x0 = X(a), x1 = X(b);
      const top = Y(o.walkway) + 2;
      const plinth = o.street - Math.round(o.H * 0.5);
      const floor2 = o.street - Math.round(o.H * 2.9);
      for (let y = top; y < o.street + 40; y++)
        for (let x = x0; x < x1; x++) {
          const course = Math.floor((y - top) / 16);
          const off = course % 2 ? 20 : 0;
          let s = 0.17 + (hashInt(Math.floor((x - x0 + off) / 40), course, 3) - 0.5) * 0.025 + (fbm1(x / 30 + y / 50, 5, 2) - 0.5) * 0.04;
          if ((x - x0 + off) % 40 === 0 || (y - top) % 16 === 0) s -= 0.035;
          if (y >= plinth) s = 0.2 + (y === plinth ? 0.16 : 0) + ((x - x0) % 60 === 0 ? -0.06 : 0);
          if (Math.abs(y - floor2) < 4) s = y === floor2 - 3 ? 0.34 : 0.22;
          if (x === x0 || x === x0 + 1) s += 0.12;
          put(x, y, s);
        }
      // pilasters
      for (let k = 0; k <= 4; k++) {
        const px2 = Math.round(x0 + ((x1 - x0 - 20) * k) / 4);
        for (let y = top + 10; y < plinth; y++) for (let q = 0; q < 20; q++) put(px2 + q, y, q < 2 ? 0.34 : q > 17 ? 0.1 : 0.2 + ((y - top) % 60 === 0 ? 0.06 : 0));
      }
      // upper windows: tall, warm, one dark; street windows: small, barred, dim
      for (let k = 0; k < 4; k++) {
        const wx = Math.round(x0 + ((x1 - x0 - 20) * (k + 0.5)) / 4) + 10 - 16;
        const wy = floor2 - 106;
        const lit = k !== 2;
        for (let y = wy; y < wy + 78; y++)
          for (let x = wx; x < wx + 32; x++) {
            const rr = Math.hypot(x - (wx + 16), y - (wy + 16));
            if (y - wy < 16 && rr > 16) continue;
            const frame = x < wx + 3 || x >= wx + 29 || y >= wy + 75 || Math.abs(x - (wx + 16)) < 2 || Math.abs(y - (wy + 40)) < 2 || (rr > 13.5 && y - wy < 16);
            if (frame) put(x, y, 0.3);
            else if (lit) put(x, y, 0.9, R(y - wy < 40 ? "win3" : "win"), true);
            else put(x, y, 0.07 + ((y - wy) % 4 === 0 ? 0.05 : 0));
          }
        for (let x = wx - 4; x < wx + 36; x++) (put(x, wy + 78, 0.4), put(x, wy + 79, 0.16));
        const sx = wx + 4, sy = o.street - Math.round(o.H * 1.25);
        if (Math.abs(sx + 12 - X(232)) < 60) continue;
        for (let y = sy; y < sy + 26; y++)
          for (let x = sx; x < sx + 24; x++) {
            const bar = (x - sx) % 6 < 2 || y === sy || y === sy + 25;
            if (bar) put(x, y, 0.3);
            else put(x, y, 0.9, R("win2"), true);
          }
      }
      // cornice under the walkway
      for (let x = x0 - 6; x < x1 + 6; x++) for (let y = top; y < top + 12; y++) put(x, y, y === top + 11 ? 0.08 : y < top + 3 ? 0.34 : 0.24);
      // a drainpipe
      const dp = x1 - 30;
      for (let y = top + 12; y < o.street; y++) (put(dp, y, 0.3), put(dp + 1, y, 0.2), put(dp + 2, y, 0.1));
    }
    // the shrine alcove: an arched niche in a stone wall, warm inside, a firebox at its back
    {
      const [a, b] = o.alcove;
      const x0 = X(a), x1 = X(b);
      const top = Y(o.walkway) + 2;
      const n0 = X(a + 0.9), n1 = X(b - 0.9);
      const cx = (n0 + n1) / 2;
      const hw = (n1 - n0) / 2;
      const archTop = o.street - Math.round(o.H * 3.2);
      const spring = archTop + Math.round(hw * 0.35);
      const inNiche = (x: number, y: number): boolean => x >= n0 && x < n1 && (y >= spring || Math.hypot((x - cx) / hw, (y - spring) / (spring - archTop)) < 1);
      for (let y = top; y < o.street + 40; y++)
        for (let x = x0; x < x1; x++) {
          if (inNiche(x, y)) {
            // the back of the niche: stone courses in a warm stepped light, brightest low and right (the fire)
            const course = Math.floor((y - archTop) / 14);
            const off = course % 2 ? 18 : 0;
            const heat = Math.max(0, 1 - Math.hypot((x - X(217.7)) / (hw * 1.4), (y - o.street) / (o.H * 2.6)));
            let s = 0.12 + Math.floor(heat * 5) * 0.085;
            if ((x - n0 + off) % 36 === 0 || (y - archTop) % 14 === 0) s -= 0.05;
            put(x, y, s, R("furnwall"));
            continue;
          }
          const course = Math.floor((y - top) / 22);
          const off = course % 2 ? 26 : 0;
          let s = 0.17 + (hashInt(Math.floor((x - x0 + off) / 52), course, 9) - 0.5) * 0.03;
          if ((x - x0 + off) % 52 === 0 || (y - top) % 22 === 0) s -= 0.045;
          put(x, y, s);
        }
      // voussoirs round the arch, the jambs, lit on the inner edge
      for (let t = Math.PI; t <= Math.PI * 2; t += 0.003)
        for (let k = 0; k < 12; k++) {
          const x = Math.round(cx + Math.cos(t) * (hw + k));
          const y = Math.round(spring + Math.sin(t) * (spring - archTop + k));
          const seg = Math.floor(((t - Math.PI) / Math.PI) * 11);
          put(x, y, k < 2 ? 0.42 : 0.22 + (seg % 2) * 0.05 - (k > 9 ? 0.06 : 0));
        }
      for (const jx of [n0 - 12, n1]) for (let y = spring; y < o.street; y++) for (let k = 0; k < 12; k++) put(jx + k, y, (jx < cx ? k === 11 : k === 0) ? 0.42 : 0.24 - ((y - spring) % 30 === 0 ? 0.05 : 0));
      // the firebox: a squat arched mouth at the back right, black inside, a lintel
      const fx = X(217.7), fw = Math.round(o.H * 0.8), fh = Math.round(o.H * 1.05);
      for (let y = o.street - fh; y < o.street; y++)
        for (let x = fx - fw; x < fx + fw; x++) {
          const d = Math.hypot((x - fx) / fw, (y - (o.street - fh * 0.55)) / (fh * 0.45));
          if (y < o.street - fh * 0.55 && d > 1) continue;
          put(x, y, 0.03, R("back"));
        }
      for (let x = fx - fw - 8; x < fx + fw + 8; x++) for (let y = o.street - fh - 8; y < o.street - fh + 2; y++) put(x, y, y === o.street - fh - 8 ? 0.4 : 0.22);
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
