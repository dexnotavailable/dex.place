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

import { Pix, hashInt, mulberry, type BuildCtx, type LayerDef, type SceneDef } from "../../../../scenes/engine/index.ts";
import { f, v2 } from "../../../../scenes/engine/layers.ts";
import { lifted } from "./shift.ts";
import { putter } from "./grammar.ts";
import { bumper, pool, wallTex } from "./houses.ts";

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
  /** World x (H) of arched openings onto the stacks, and of warm lights (x, height above the floor in H, strength 0..1). */
  arches: number[];
  lights: [number, number, number][];
  /** The door's centre, the product bays' stretch of panelling, the clock's pilaster, the ladder (world x, H). */
  door: number;
  products: [number, number];
  clock: number;
  ladder: number;
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
        [0.3, "#1c120a"],
        [0.62, "#36220f"],
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
    [3.6, 11, 0.16, 0.4],
    [1.9, 23, 0.2, 0.5],
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
    L.push({ kind: "pix", name: `stacks-${d}`, depth: d, fog: d > 3 ? 0.62 : 0.36, pix, x, y: 0, twinkle: 0.2, dither: 0.3 });
  }

  // the back wall (depth 1, room-aligned): built-in shelves to the ceiling in bays between oak
  // pilasters, a wainscot of raised panels with a lit dado rail, arches onto the stacks, beams under
  // the ceiling, the masonry above the ceiling and below the floor. Two stretches are panelling,
  // not books: round the door (its moulded oak case is built into the wall: the door prop is only
  // the leaf) and behind the product bays (so the three bays you use stand out against a quiet
  // wall with a carved frieze). The candles' and the lamp's light is painted into it in steps.
  {
    const pix = new Pix(o.roomW + 16, H);
    const ox = -Math.round(span / 2) - 8;
    const put = putter(pix, ox + Math.round(span / 2), 0, R("wood")); // put(roomX, screenY)
    const bump = bumper(pix, ox + Math.round(span / 2), 0);
    const arches = o.arches.map((wx) => rx(wx));
    const archHalf = Math.round(o.H * 0.75);
    const archTop = ceilS + Math.round(o.H * 0.8);
    const inArch = (x: number, y: number): boolean =>
      arches.some((ax) => Math.abs(x - ax) < archHalf && y < floorS && (y > archTop + archHalf || Math.hypot(x - ax, y - (archTop + archHalf)) < archHalf));
    const wain = floorS - Math.round(o.H * 0.95);
    const dX = rx(o.door);
    const doorBay = (x: number): boolean => Math.abs(x - dX) < 78;
    const prod = (x: number): boolean => x >= rx(o.products[0]) && x < rx(o.products[1]);
    const clockX = rx(o.clock);
    const pilaster = (x: number): boolean => {
      // oak pilasters between the shelf bays, and one under the clock
      if (Math.abs(x - clockX) < 22) return true;
      const bay = 150;
      return x % bay < 10;
    };
    const shelfH = 30;
    for (let x = -8; x < o.roomW + 8; x++) {
      // masonry above the ceiling
      for (let y = 0; y < ceilS - 8; y++) put(x, y, 0.17 + wallTex("stone", x, y, 4), R("stone"));
      // the ceiling: boards, a lit edge (lamplight from below)
      for (let y = ceilS - 8; y < ceilS; y++) put(x, y, y === ceilS - 1 ? 0.34 : 0.2 + (x % 60 === 0 ? -0.06 : 0));
      // the wall
      for (let y = ceilS; y < floorS; y++) {
        if (inArch(x, y)) continue;
        let s: number;
        let row = R("wood");
        if (y >= wain) {
          // wainscot: raised panels, a lit dado rail on top
          const pw = 64;
          const lxp = (x + 4000) % pw;
          const ly = y - wain;
          const edge = lxp < 3 || lxp > pw - 4 || ly < 6 || ly > floorS - wain - 6;
          s = edge ? 0.25 : 0.19 + (lxp === 4 || ly === 7 ? 0.08 : lxp === pw - 5 ? -0.04 : 0);
          if (ly < 3) s = ly === 0 ? 0.44 : 0.32;
          else if (ly === 3) s = 0.12;
          s += wallTex("boards", x, y, 5) * 0.3;
        } else if (doorBay(x) || prod(x)) {
          // panelling: tall raised panels under a frieze
          const pw = prod(x) ? 96 : 52;
          const lxp = (x - (prod(x) ? rx(o.products[0]) : dX - 78) + 4000) % pw;
          const ly = y - ceilS;
          const frieze = ly < 34;
          if (frieze) {
            // a carved frieze: a running scroll between two lit fillets
            s = 0.24 + (ly === 0 || ly === 33 ? 0.14 : ly === 1 || ly === 32 ? -0.06 : 0);
            if (ly > 6 && ly < 28) {
              const ph = Math.sin((x / 14) * Math.PI) * 7 + 17;
              const d = Math.abs(ly - ph);
              s = d < 1.5 ? 0.38 : d < 3 ? 0.16 : 0.22;
            }
          } else {
            const edge = lxp < 4 || lxp > pw - 5;
            s = edge ? 0.24 + (lxp === 0 ? 0.1 : 0) : 0.2 + (lxp === 5 ? 0.07 : lxp === pw - 6 ? -0.05 : 0) + ((y - ceilS - 34) % 70 < 3 ? 0.06 : 0);
            // a little grain in each panel (whole streaks, never single flecks at a band edge)
            if (hashInt(x >> 2, Math.floor((y - ceilS) / 70), 6) < 0.18 && !edge) s -= 0.03;
          }
        } else if (y < ceilS + 10) s = 0.28 + (y === ceilS + 9 ? -0.1 : 0);
        else if (pilaster(x)) {
          const lx2 = Math.abs(x - clockX) < 22 ? x - clockX + 22 : x % 150;
          const w2 = Math.abs(x - clockX) < 22 ? 44 : 10;
          s = 0.24 + (lx2 === 0 ? 0.1 : lx2 === w2 - 1 ? -0.08 : 0) + ((y - ceilS) % 90 < 2 ? 0.06 : 0) + wallTex("boards", x, y, 8) * 0.4;
        } else {
          // built-in shelves up to the ceiling: books as spines with uneven tops, the shelf lips lit
          const sy = (y - ceilS - 10) % shelfH;
          const bay = Math.floor(x / 150);
          const lxb = x % 150;
          if (sy < 3) s = sy === 0 ? 0.36 : sy === 1 ? 0.26 : 0.1;
          else {
            const shelf = Math.floor((y - ceilS) / shelfH);
            const gap = hashInt(Math.floor(lxb / 40), shelf, bay + 31) < 0.12;
            const book = Math.floor(lxb / 3 + hashInt(Math.floor(lxb / 9), shelf, bay) * 2);
            const hgt = shelfH - 5 - Math.floor(hashInt(book, shelf, bay + 9) * 8);
            if (!gap && sy > shelfH - hgt) {
              const k = hashInt(book, bay, 3);
              s = 0.14 + k * 0.08 + (sy === shelfH - hgt + 1 ? 0.06 : 0) + ((lxb % 3) === 0 ? -0.04 : 0);
              // a gilt band on some spines
              if (k > 0.5 && (sy - (shelfH - hgt)) === 4) s += 0.1;
              row = k < 0.3 ? R("spine") : k < 0.55 ? R("spine2") : k < 0.7 ? R("spine3") : R("wood");
            } else s = 0.06;
          }
        }
        put(x, y, s, row);
      }
      // under the floor: the foundation
      for (let y = floorS; y < H; y++) put(x, y, 0.13 + wallTex("stone", x, y - floorS, 8), R("stone"));
    }
    // the arches' mouldings: a lit inner fillet, a keystone
    for (const ax of arches) {
      for (let t = Math.PI; t <= Math.PI * 2; t += 0.004)
        for (let k = 0; k < 10; k++) {
          const x = Math.round(ax + Math.cos(t) * (archHalf + k));
          const y = Math.round(archTop + archHalf + Math.sin(t) * (archHalf + k));
          put(x, y, k < 2 ? 0.44 : k === 9 ? 0.12 : 0.27);
        }
      for (const side of [-1, 1]) for (let y = archTop + archHalf; y < floorS; y++) for (let k = 0; k < 10; k++) put(ax + side * (archHalf + k), y, k < 2 ? 0.42 : k === 9 ? 0.12 : 0.26 - ((y - archTop) % 40 === 0 ? 0.06 : 0));
      for (let y = archTop - 12; y < archTop + 8; y++) for (let x = ax - 8; x < ax + 8; x++) put(x, y, 0.36 + (y === archTop - 12 ? 0.12 : 0) + (x === ax - 8 ? 0.06 : x === ax + 7 ? -0.08 : 0));
    }
    // the door's case: a moulded oak architrave round a reveal 4 px proud of the leaf all round, a
    // cornice with a pediment board, a worn sill; the leaf (the prop) fills the opening
    {
      const lw = Math.round(o.H * 0.35), lh = Math.round(o.H * 1.4);
      const ow = lw + 4, oh = lh + 4;
      const top = floorS - oh;
      for (let y = top; y < floorS; y++)
        for (let x = dX - ow; x < dX + ow; x++) {
          const inL = x - (dX - ow), inR = dX + ow - 1 - x, inT = y - top;
          let s = 0.04;
          if (inT < 4) s = 0.06 - inT * 0.01;
          else if (inR < 4) s = 0.22 - inR * 0.035; // the reveal facing the reading lamp
          else if (inL < 4) s = 0.08;
          put(x, y, s);
        }
      const aw = 14;
      for (let y = top - aw; y < floorS; y++)
        for (let x = dX - ow - aw; x < dX + ow + aw; x++) {
          const inOpen = x >= dX - ow && x < dX + ow && y >= top;
          if (inOpen) continue;
          const dEdge = Math.min(x - (dX - ow - aw), dX + ow + aw - 1 - x, y - (top - aw));
          // a three-step moulding: outer bead, flat, inner bead
          let s = dEdge < 2 ? 0.44 : dEdge < 4 ? 0.22 : dEdge < 10 ? 0.38 + ((x + y) % 5 === 0 ? -0.02 : 0) : dEdge < 12 ? 0.52 : 0.26;
          if (y >= floorS - 14) s = 0.42 + (y === floorS - 14 ? 0.12 : 0); // plinth blocks
          put(x, y, s);
        }
      // cornice and pediment board
      for (let y = top - aw - 22; y < top - aw; y++)
        for (let x = dX - ow - aw - 10; x < dX + ow + aw + 10; x++) {
          const ly = y - (top - aw - 22);
          const inset = ly > 10 ? Math.min(10, ly - 10) : 0;
          if (x < dX - ow - aw - 10 + inset || x >= dX + ow + aw + 10 - inset) continue;
          put(x, y, ly === 0 ? 0.56 : ly < 3 ? 0.42 : ly === 10 ? 0.16 : ly < 10 ? 0.34 : 0.3 + (ly === 21 ? -0.1 : 0));
        }
      // the reading lamp's light on the case's right side
    }
    // beams under the ceiling, every 3 H, with brackets
    for (let bx = Math.round(o.H * 1.5); bx < o.roomW; bx += o.H * 3) {
      for (let y = ceilS; y < ceilS + 14; y++) for (let k = -10; k <= 10; k++) put(bx + k, y, y === ceilS + 13 ? 0.16 : k === -10 ? 0.34 : 0.24);
      for (let i = 0; i < 16; i++) for (const side of [-1, 1]) for (let q = 0; q < 3; q++) put(bx + side * (10 + i), ceilS + 14 + (16 - i) - q, q === 0 ? 0.3 : 0.2);
    }
    // a library ladder on its rail in the first long run of shelves
    {
      const railY = ceilS + 18;
      for (let x = 0; x < o.roomW; x++) if (!doorBay(x) && !prod(x) && !inArch(x, railY)) (put(x, railY, 0.42), put(x, railY + 1, 0.2));
      const lx0 = rx(o.ladder);
      for (let i = 0; i < floorS - railY; i++) {
        const y = railY + i;
        const x = Math.round(lx0 + i * 0.22);
        for (const off of [0, 22]) (put(x + off, y, 0.4), put(x + off + 1, y, 0.24), put(x + off + 2, y, 0.12));
        if (i % 24 === 12) for (let q = 2; q < 22; q++) (put(x + q, y, 0.36), put(x + q, y + 1, 0.14));
      }
      for (let q = -2; q < 26; q++) put(lx0 + q, railY - 2, 0.3);
    }
    // a clock on its pilaster, stopped at no particular hour
    {
      const cx = clockX, cy = ceilS + Math.round(o.H * 1.1);
      for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) {
        const d = Math.hypot(x, y);
        if (d > 15) continue;
        put(cx + x, cy + y, d > 13 ? 0.44 : d > 12 ? 0.16 : 0.36 + (x < 0 && y < 0 ? 0.04 : 0), d > 12 ? R("wood") : R("candle"));
      }
      for (let k = 0; k < 10; k++) put(cx, cy - k, 0.08, R("wood"));
      for (let k = 0; k < 7; k++) put(cx + k, cy + Math.round(k * 0.5), 0.08, R("wood"));
      for (let y = cy + 16; y < cy + 40; y++) put(cx, y, 0.34); // the pendulum rod's case
    }
    // the lights, painted into the wall in steps: big warm pools round the lamp and the candelabra,
    // small ones round the candles, all a little stronger below the light (it falls)
    // the room's own warmth first (the oiled wood takes the candlelight everywhere a little)
    for (let y = ceilS; y < floorS; y++) for (let x = -8; x < o.roomW + 8; x++) if (!inArch(x, y)) bump(x, y, 0.09 + ((y - ceilS) / (floorS - ceilS)) * 0.06);
    for (const [wx, hy, k] of o.lights) {
      const lx2 = rx(wx), ly2 = floorS - hy * o.H;
      const rad = o.H * (1 + k * 1.5);
      pool(bump, lx2, ly2 + rad * 0.15, rad, rad * 1.05, 0.08 + k * 0.16, 4, Math.round(wx * 10));
    }
    // occlusion: the floor's edge, the corners under the beams
    for (let q = 0; q < 10; q++) for (let x = -8; x < o.roomW + 8; x++) bump(x, floorS - 1 - q, -0.06 + q * 0.006);
    for (let q = 0; q < 8; q++) for (let x = -8; x < o.roomW + 8; x++) bump(x, ceilS + q, -0.05 + q * 0.006);
    L.push({ kind: "pix", name: "wall", depth: 1, fog: 0, pix, x: ox, y: 0, twinkle: 0, dither: 0 });
  }
  return L;
}
