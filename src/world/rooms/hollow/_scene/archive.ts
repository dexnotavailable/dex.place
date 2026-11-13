// C2 The Archive backdrop: the coziest room in the world, and the quietest.
// Behind the reading room's back wall the stacks go on further than they
// should (Backrooms' job: a familiar place with the wrong proportions): rank
// after rank of shelving fading into warm dark, a candle here and there down
// an aisle. The back wall itself is oiled panelling with books built in, a
// few arched openings onto the stacks, ceiling beams; above the ceiling and
// under the floor, the hollow's masonry (the room is shorter than the view,
// so the camera shows a band of each).
//
// Authored at the room's only framing (the camera centred on the room) and
// lifted like the market (shift.ts), so it stays right if the room changes.

import { Pix, fbm1, hashInt, mulberry, type BuildCtx, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import { f, v2 } from "../../../../scenes/engine/layers.ts";
import { lifted } from "./shift.ts";
import { putter } from "./grammar.ts";

export interface ArchiveOpts {
  roomW: number;
  roomH: number;
  /** The camera's top row (room px): the room is centred in the view. */
  ref: number;
  /** Room y of the floor and of the ceiling's underside. */
  floor: number;
  ceiling: number;
  /** World x of the room's left edge (H) and px per H. */
  x0: number;
  H: number;
  /** World x (H) of arched openings onto the stacks, and of warm lights (x, height above the floor in H). */
  arches: number[];
  lights: [number, number][];
}

const PALETTE = {
  wood: ["#0c0806", "#150e0a", "#20150e", "#2e1e13", "#402a1a", "#583a22", "#7a5230"],
  stack: ["#070506", "#0d0908", "#150e0b", "#1f150f", "#2b1c13", "#3c2818"],
  spine: ["#140a0a", "#24120f", "#3a1c16", "#522a1c", "#6e3c24"],
  spine2: ["#0a100c", "#122016", "#1c3020", "#2a442a"],
  spine3: ["#0c0c18", "#141628", "#1e223c", "#2c3252"],
  stone: ["#0a0808", "#120e0d", "#1b1513", "#261d19", "#342822"],
  candle: ["#6d3f1c", "#c7803a", "#ffd494", "#fff0cc"],
  glass: ["#1a3a26", "#2e6644", "#5aa27a"],
  standin: ["#07070a", "#101015", "#24232c", "#a29792"],
};

export function archiveScene(o: ArchiveOpts): SceneDef {
  const base: SceneDef = {
    title: "hollow: the archive",
    palette: PALETTE,
    fog: {
      stops: [
        [0, "#0a0706"],
        [0.3, "#171009"],
        [0.62, "#24170d"],
        [1, "#0c0806"],
      ],
      bands: 8,
      dither: 0.5,
      density: 0.35,
      max: 0.82,
    },
    prelude: (ctx) => prelude(ctx, o),
    build: (ctx) => layers(ctx, o),
  };
  return lifted(base, { ref: o.ref, vertical: 1, title: base.title });
}

/** Warm pools around the lamps and candles (screen space at the reference framing). */
function prelude(ctx: BuildCtx, o: ArchiveOpts): string {
  const span = ctx.span;
  const pts = o.lights.map(([wx, hy]) => v2((wx - o.x0) * o.H - span / 2, o.floor - o.ref - hy * o.H));
  return /* glsl */ `
const vec2 ALAMPS[${pts.length}] = vec2[${pts.length}](${pts.join(", ")});
float sceneLight(vec2 s, float depth) {
  float l = 0.0;
  if (depth < 1.5) return 0.0; // the wall is lit by the props' own lights, not painted pools
  for (int i = 0; i < ${pts.length}; i++) {
    // the lamp at depth 1 seen from a layer at this depth: its screen x pans at 1/depth
    vec2 c = vec2(ALAMPS[i].x - layerOff(1.0), ALAMPS[i].y);
    float r = length((s - c) * vec2(0.7, 1.0)) / ${f(o.H * 2.6)};
    float k = 1.0 / max(1.0, depth);
    l += floor(max(0.0, 1.0 - r) * 3.0) / 3.0 * 0.16 * (0.4 + 0.6 * k);
  }
  return l;
}`;
}

function layers(ctx: BuildCtx, o: ArchiveOpts): LayerDef[] {
  const { W, H } = ctx;
  const span = ctx.span;
  const R = (n: string): number => ctx.row(n);
  const L: LayerDef[] = [{ kind: "glsl", name: "sky", depth: Infinity, fog: 0, body: `vec4 layer(vec2 p, vec2 s) { return vec4(fogColor(s), 1.0); }` }];
  const floorS = o.floor - o.ref; // the floor's screen row at the reference framing
  const ceilS = o.ceiling - o.ref;
  const rx = (wx: number): number => (wx - o.x0) * o.H;
  const wide = (d: number): { x: number; w: number } => {
    const w = ctx.panWidth(d) + 8;
    return { x: -Math.ceil((w - W) / 2), w };
  };

  // the stacks, two ranks deep: tall shelving in the dark, books as one-pixel spines,
  // aisles between the ranges with a candle burning far down some of them
  for (const [d, seed, shade, lit] of [
    [3.6, 11, 0.16, 0.25],
    [1.9, 23, 0.2, 0.4],
  ] as [number, number, number, number][]) {
    const { x, w } = wide(d);
    const pix = new Pix(w, H);
    const put = putter(pix, x, 0, R("stack"));
    const r = mulberry(seed);
    let xx = x;
    while (xx < x + w) {
      const rw = Math.round((d > 3 ? 70 : 110) + r() * 90);
      const aisle = Math.round((d > 3 ? 16 : 26) + r() * 20);
      const top = Math.round(ceilS - 10 - r() * 20);
      const bottom = Math.round(floorS + 30 / d);
      const shelfH = d > 3 ? 18 : 26;
      for (let y = top; y < bottom; y++)
        for (let q = xx; q < xx + rw; q++) {
          const lxq = q - xx;
          const onShelf = (y - top) % shelfH;
          let s = shade;
          if (lxq < 3 || lxq > rw - 4) s = shade + 0.06;
          else if (onShelf < 2) s = shade + 0.1;
          else {
            // spines: a column of one to three pixels per book, uneven tops
            const book = Math.floor(lxq / 2 + hashInt(Math.floor(lxq / 7), Math.floor((y - top) / shelfH), seed) * 3);
            const hgt = shelfH - 3 - Math.floor(hashInt(book, Math.floor((y - top) / shelfH), seed + 1) * 6);
            if (onShelf > shelfH - hgt) {
              const k = hashInt(book, 7, seed + 2);
              put(q, y, shade + 0.05 + k * 0.08, k < 0.35 ? R("spine") : k < 0.6 ? R("spine2") : k < 0.75 ? R("spine3") : R("stack"));
              continue;
            }
            s = shade - 0.06;
          }
          put(q, y, s);
        }
      // a candle far down the aisle after this range
      if (r() < lit) {
        const cx = xx + rw + Math.round(aisle / 2);
        const cy = Math.round(floorS - (d > 3 ? 10 : 18) - r() * 20);
        for (let k = 0; k < 3; k++) put(cx, cy - k, 0.9, R("candle"), true);
        put(cx, cy + 1, 0.3);
      }
      xx += rw + aisle;
    }
    L.push({ kind: "pix", name: `stacks-${d}`, depth: d, fog: d > 3 ? 0.55 : 0.3, pix, x, y: 0, twinkle: 0.2, dither: 0.3 });
  }

  // the back wall (depth 1, room-aligned): panelling, built-in shelves, arches onto the stacks,
  // beams under the ceiling, the masonry above the ceiling and below the floor
  {
    const pix = new Pix(o.roomW + 16, H);
    const ox = -Math.round(span / 2) - 8;
    const put = putter(pix, ox + Math.round(span / 2), 0, R("wood")); // put(roomX, screenY)
    const r = mulberry(5);
    const arches = o.arches.map((wx) => rx(wx));
    const archHalf = Math.round(o.H * 0.75);
    const archTop = ceilS + Math.round(o.H * 0.8);
    const inArch = (x: number, y: number): boolean =>
      arches.some((ax) => Math.abs(x - ax) < archHalf && y < floorS && (y > archTop + archHalf || Math.hypot(x - ax, y - (archTop + archHalf)) < archHalf));
    const wain = floorS - Math.round(o.H * 0.95);
    for (let x = -8; x < o.roomW + 8; x++) {
      // masonry above the ceiling
      for (let y = 0; y < ceilS - 8; y++) {
        const course = Math.floor(y / 14);
        const off = course % 2 ? 22 : 0;
        let s = 0.18 + (hashInt(Math.floor((x + off) / 44), course, 4) - 0.5) * 0.05;
        if ((x + off) % 44 === 0 || y % 14 === 0) s -= 0.06;
        put(x, y, s, R("stone"));
      }
      // the ceiling: boards, a lit edge (lamplight from below)
      for (let y = ceilS - 8; y < ceilS; y++) put(x, y, y === ceilS - 1 ? 0.34 : 0.2 + (x % 60 === 0 ? -0.06 : 0));
      // the wall
      for (let y = ceilS; y < floorS; y++) {
        if (inArch(x, y)) continue;
        let s: number;
        let row = R("wood");
        if (y >= wain) {
          // wainscot: raised panels
          const pw = 64;
          const lxp = x % pw;
          const ly = y - wain;
          const edge = lxp < 3 || lxp > pw - 4 || ly < 4 || ly > floorS - wain - 6;
          s = edge ? 0.26 : 0.2 + (lxp === 4 || ly === 5 ? 0.08 : 0);
          if (ly === 0) s = 0.4;
        } else {
          // built-in shelves up to the ceiling
          const shelfH = 30;
          const sy = (y - ceilS - 10) % shelfH;
          const bay = Math.floor(x / 150);
          const lxb = x % 150;
          if (y < ceilS + 10) s = 0.28;
          else if (lxb < 5) s = 0.24 + (lxb === 0 ? 0.08 : 0);
          else if (sy < 3) s = 0.3 - (sy === 2 ? 0.1 : 0);
          else {
            const book = Math.floor(lxb / 3 + hashInt(Math.floor(lxb / 9), Math.floor((y - ceilS) / shelfH), bay) * 2);
            const hgt = shelfH - 5 - Math.floor(hashInt(book, Math.floor((y - ceilS) / shelfH), bay + 9) * 8);
            if (sy > shelfH - hgt) {
              const k = hashInt(book, bay, 3);
              s = 0.13 + k * 0.07 + (sy === shelfH - hgt + 1 ? 0.04 : 0);
              row = k < 0.3 ? R("spine") : k < 0.55 ? R("spine2") : k < 0.7 ? R("spine3") : R("wood");
            } else s = 0.08;
          }
        }
        s += (fbm1(x / 40 + y / 90, 7, 2) - 0.5) * 0.03;
        put(x, y, s, row);
      }
      // under the floor: the foundation
      for (let y = floorS; y < H; y++) {
        const course = Math.floor((y - floorS) / 18);
        const off = course % 2 ? 30 : 0;
        let s = 0.14 + (hashInt(Math.floor((x + off) / 60), course, 8) - 0.5) * 0.05;
        if ((x + off) % 60 === 0 || (y - floorS) % 18 === 0) s -= 0.05;
        put(x, y, s, R("stone"));
      }
    }
    // the arches' mouldings
    for (const ax of arches)
      for (let t = Math.PI; t <= Math.PI * 2; t += 0.004)
        for (let k = 0; k < 8; k++) {
          const x = Math.round(ax + Math.cos(t) * (archHalf + k));
          const y = Math.round(archTop + archHalf + Math.sin(t) * (archHalf + k));
          put(x, y, k < 2 ? 0.42 : 0.26);
        }
    for (const ax of arches) for (const side of [-1, 1]) for (let y = archTop + archHalf; y < floorS; y++) for (let k = 0; k < 8; k++) put(ax + side * (archHalf + k), y, k < 2 ? 0.4 : 0.24);
    // beams under the ceiling, every 3 H, with brackets
    for (let bx = Math.round(o.H * 1.5); bx < o.roomW; bx += o.H * 3) {
      for (let y = ceilS; y < ceilS + 14; y++) for (let k = -10; k <= 10; k++) put(bx + k, y, y === ceilS + 13 ? 0.16 : k === -10 ? 0.34 : 0.24);
      for (let i = 0; i < 16; i++) for (const side of [-1, 1]) put(bx + side * (10 + i), ceilS + 14 + (16 - i), 0.22);
    }
    // a clock on the wall between the first two bays, stopped at no particular hour
    {
      const cx = rx(o.x0 + 4.2), cy = ceilS + Math.round(o.H * 1.1);
      for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) {
        const d = Math.hypot(x, y);
        if (d > 14) continue;
        put(cx + x, cy + y, d > 12 ? 0.4 : d > 11 ? 0.16 : 0.34, d > 11 ? R("wood") : R("candle"));
      }
      for (let k = 0; k < 9; k++) put(cx, cy - k, 0.08, R("wood"));
      for (let k = 0; k < 6; k++) put(cx + k, cy + Math.round(k * 0.5), 0.08, R("wood"));
      void r;
    }
    L.push({ kind: "pix", name: "wall", depth: 1, fog: 0, pix, x: ox, y: 0, twinkle: 0, dither: 0 });
  }
  return L;
}
