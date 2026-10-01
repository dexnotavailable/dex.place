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
import { f, v2, shaft, shaftFn } from "../../../../scenes/engine/layers.ts";
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
  /** Light wells (world x, H): grates in the ceiling under the street's drains, the market's amber
   * falling through them in shafts that lean a little toward the east, and where each lands. */
  wells: number[];
}

/** A light well's shaft: layer x at the ceiling and at the floor (it leans east, with the street's light). */
function wellLine(o: ArchiveOpts, wx: number, span: number): [number, number] {
  const x = (wx - o.x0) * o.H - span / 2;
  return [x, x + o.H * 0.7];
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
  // the market's light through the street's grates: amber, a little dusty
  well: ["#3a2412", "#6e4520", "#a4703a", "#d6a464", "#f2d29a"],
  // near silhouettes in front of the reading room (the beam over the camera, book piles on the floor)
  fore: ["#060404", "#0c0807", "#130d0a", "#1c130e", "#2a1c13", "#46301c", "#76502c"],
  standin: ["#07070a", "#101015", "#24232c", "#a29792"],
  paper: ["#1a140e", "#2e2418", "#4a3c28", "#6a583c", "#8c7754", "#ad966c"],
  brass: ["#1c1208", "#3a2610", "#5e4018", "#8a6424", "#b48a3a", "#d6ae5a"],
  ink: ["#12141a", "#1e2230", "#2e364c", "#465270"],
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
  const floorS = o.floor - o.ref, ceilS = o.ceiling - o.ref;
  const shafts = o.wells
    .map((wx, i) => {
      const [x0, x1] = wellLine(o, wx, span);
      return shaftFn({ fn: `well${i}`, from: [x0, ceilS - 4], to: [x1, floorS + 6], w0: o.H * 0.32, w1: o.H * 0.62, streaks: 5, speed: 0.02, fadeStart: 0.78, intensity: 0.85 });
    })
    .join("\n");
  return /* glsl */ `${shafts}
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
    // (round 3: deeper in the warm haze, so the room's own wall stands in front of them by value)
    L.push({ kind: "pix", name: `stacks-${d}`, depth: d, fog: d > 3 ? 0.74 : 0.5, pix, x, y: 0, twinkle: 0.2, dither: 0.3 });
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
      // (the opening is cut 6 px deeper than the leaf all round: the leaf stands back in the wall's
      // thickness on an oak sill, its head in the architrave's shadow: the prop's sill and recess)
      const lw = Math.round(o.H * 0.35), lh = Math.round(o.H * 1.4);
      const ow = lw + 6, oh = lh + 6;
      const top = floorS - oh;
      for (let y = top; y < floorS; y++)
        for (let x = dX - ow; x < dX + ow; x++) {
          const inL = x - (dX - ow), inR = dX + ow - 1 - x, inT = y - top;
          let s = 0.04;
          if (inT < 6) s = 0.04 + (inT === 5 ? 0.02 : 0);
          else if (inR < 6) s = 0.36 - inR * 0.04 - (inT < 16 ? 0.1 : 0); // the reveal facing the reading lamp
          else if (inL < 6) s = 0.1 - inL * 0.008;
          put(x, y, s + wallTex("boards", x, y, 6) * 0.3);
        }
      // the sill: an oak threshold proud of the boards, its nose lit, worn in the middle, its contact
      // shadow where it meets the floor
      for (let x = dX - ow - 16; x < dX + ow + 16; x++) {
        const worn = Math.abs(x - dX) < lw - 6 ? 1 : 0;
        for (let q = worn; q < 6; q++) put(x, floorS - 6 + q, q === worn ? 0.56 : q === worn + 1 ? 0.4 : q === 5 ? 0.08 : 0.3 - q * 0.02);
      }
      const aw = 14;
      for (let y = top - aw; y < floorS; y++)
        for (let x = dX - ow - aw; x < dX + ow + aw; x++) {
          const inOpen = x >= dX - ow && x < dX + ow && y >= top;
          if (inOpen) continue;
          const dEdge = Math.min(x - (dX - ow - aw), dX + ow + aw - 1 - x, y - (top - aw));
          // a three-step moulding: outer bead, flat, inner bead
          let s = dEdge < 2 ? 0.44 : dEdge < 4 ? 0.22 : dEdge < 10 ? 0.38 + ((x + y) % 5 === 0 ? -0.02 : 0) : dEdge < 12 ? 0.52 : 0.26;
          if (y >= floorS - 20) s = 0.42 + (y === floorS - 20 ? 0.12 : 0) + (dEdge === 0 ? -0.1 : 0); // plinth blocks
          if (y >= floorS - 6) continue; // the sill runs across the plinths
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
    // the archive's fittings, built into the two stretches of panelling (round 1 left them as large
    // empty planes): over the product bays a card catalogue, the chart of the Round in a gilt frame
    // under its picture lamp, and pigeonholes of rolled charts; over the door a wall of pigeonholes
    // with scrolls, bundles and ledgers, and a carved name board. Each sits in a moulded case let into
    // the panelling (a lit top edge, a shadow under it), so it reads as part of the wall
    {
      const caseBox = (x0: number, y0: number, x1: number, y1: number): void => {
        // a moulded case: lit top and near edge, dark far edge, the shadow it throws on the panel under it
        for (let y = y0 - 5; y < y1 + 6; y++)
          for (let x = x0 - 5; x < x1 + 5; x++) {
            if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
            let s = 0.32 + (y < y0 ? 0.08 : 0) + (y >= y1 ? -0.02 : 0);
            if (y === y0 - 5) s = 0.5;
            else if (x === x0 - 5) s = 0.44;
            else if (x === x1 + 4) s = 0.14;
            else if (y === y1 + 5) s = 0.14;
            else if (y === y0 - 1 || x === x0 - 1) s = 0.16; // the inner arris into the case
            put(x, y, s);
          }
        for (let q = 0; q < 6; q++) for (let x = x0 - 3; x < x1 + 7; x++) bump(x, y1 + 6 + q, -0.07 + q * 0.012);
      };
      const drawers = (x0: number, y0: number, x1: number, y1: number, seed: number): void => {
        caseBox(x0, y0, x1, y1);
        const cw = 21, ch = 14;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const lx = (x - x0) % cw, ly = (y - y0) % ch;
            const col = Math.floor((x - x0) / cw), row = Math.floor((y - y0) / ch);
            if (lx < 2 || ly < 2) {
              put(x, y, 0.08);
              continue;
            }
            let s = 0.3 + hashInt(col, row, seed) * 0.04;
            if (ly === 2) s = 0.42;
            else if (lx === 2) s = 0.38;
            else if (ly === ch - 1) s = 0.18;
            else if (lx === cw - 1) s = 0.2;
            put(x, y, s);
            // the label holder (brass rim, a card in it) and the pull under it
            const mx = lx - Math.floor(cw / 2), my = ly - 5;
            if (Math.abs(mx) <= 4 && my >= -1 && my <= 2) {
              const rim = Math.abs(mx) === 4 || my === -1 || my === 2;
              if (rim) put(x, y, my === -1 ? 0.6 : 0.42, R("brass"));
              else put(x, y, 0.5 + (hashInt(x, y, seed + col) < 0.25 ? -0.2 : 0), R("paper"));
            }
            if (Math.abs(mx) <= 2 && (ly === 10 || ly === 11)) put(x, y, ly === 10 ? 0.62 : 0.34, R("brass"));
          }
      };
      const holes = (x0: number, y0: number, x1: number, y1: number, cw: number, ch: number, seed: number): void => {
        caseBox(x0, y0, x1, y1);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const lx = (x - x0) % cw, ly = (y - y0) % ch;
            // the dividers: 3 px of oak, the shelf's lip lit, the upright's near face lit
            if (ly < 3) {
              put(x, y, ly === 0 ? 0.46 : ly === 1 ? 0.32 : 0.2);
              continue;
            }
            if (lx < 3) {
              put(x, y, lx === 0 ? 0.36 : lx === 1 ? 0.28 : 0.16);
              continue;
            }
            // inside: dark at the back, the shelf's shadow at the top
            put(x, y, 0.05 + (ly > ch - 4 ? 0.03 : 0) - (ly < 6 ? 0.02 : 0));
          }
        // contents, one kind per hole: rolled charts end-on, a tied bundle, a stack of ledgers, empty
        for (let row = 0; row * ch < y1 - y0 - 3; row++)
          for (let col = 0; col * cw < x1 - x0 - 3; col++) {
            const hx = x0 + col * cw + 3, hy = y0 + row * ch + 3, iw = cw - 3, ih = ch - 3;
            if (hx + iw > x1 || hy + ih > y1) continue;
            const k = hashInt(col, row, seed);
            if (k < 0.45) {
              // scrolls, end-on: rings of paper with a dark core, stacked in a little pyramid
              const rr = (ih > 16 ? 3 : 2) + (hashInt(row, col, seed + 5) > 0.5 ? 1 : 0);
              const n = Math.max(1, Math.floor(iw / (rr * 2 + 1)) - (k < 0.2 ? 1 : 0));
              for (let i = 0; i < n; i++)
                for (const lift of i % 2 && n > 2 ? [0, 1] : [0]) {
                  const cx = hx + rr + 1 + i * (rr * 2 + 1), cy = hy + ih - rr - 1 - lift * (rr * 2 - 1);
                  for (let y = -rr; y <= rr; y++)
                    for (let x = -rr; x <= rr; x++) {
                      const d = Math.hypot(x, y);
                      if (d > rr + 0.3) continue;
                      put(cx + x, cy + y, d < 1.2 ? 0.12 : 0.36 + (x + y < 0 ? 0.16 : 0) - (d > rr - 0.6 ? 0.08 : 0), R("paper"));
                    }
                }
            } else if (k < 0.7) {
              // a bundle of papers, tied with red tape
              const bw = iw - 4, bh2 = Math.min(ih - 4, 10);
              for (let y = 0; y < bh2; y++) for (let x = 0; x < bw; x++) put(hx + 2 + x, hy + ih - bh2 + y, 0.32 + (y % 3 === 0 ? 0.12 : 0) + (x === 0 ? 0.06 : 0), R("paper"));
              for (let y = 0; y < bh2; y++) put(hx + 2 + Math.floor(bw / 2), hy + ih - bh2 + y, 0.5, R("spine"));
            } else if (k < 0.88) {
              // ledgers lying flat, spines out
              let y = hy + ih - 1;
              for (let n = 0; y > hy + 4 && n < 4; n++) {
                const lh = 3 + (hashInt(n, col, seed + row) > 0.5 ? 1 : 0);
                const rowk = hashInt(n, row, seed + 3);
                for (let q = 0; q < lh; q++) for (let x = hx + 1 + (n % 2); x < hx + iw - 1 - (n % 3); x++) put(x, y - q, 0.24 + (q === lh - 1 ? 0.1 : 0), rowk < 0.4 ? R("spine") : rowk < 0.7 ? R("spine2") : R("spine3"));
                y -= lh;
              }
            }
          }
      };
      // over the product bays
      const p0 = rx(o.products[0]), p1 = rx(o.products[1]);
      const bandT = ceilS + 46, bandB = floorS - Math.round(o.H * 2.82);
      const third = Math.round((p1 - p0) / 3);
      drawers(p0 + 14, bandT + 8, p0 + third - 10, bandB, 31);
      holes(p1 - third + 10, bandT + 8, p1 - 14, bandB, 24, 20, 37);
      // the chart of the Round: a gilt frame, parchment, the ring and its five places, the red route
      {
        const mx0 = p0 + third + 4, mx1 = p1 - third - 4, my0 = bandT - 4, my1 = bandB + 4;
        const cx = (mx0 + mx1) / 2, cy = (my0 + my1) / 2 - 4;
        for (let y = my0; y < my1; y++)
          for (let x = mx0; x < mx1; x++) {
            const e = Math.min(x - mx0, mx1 - 1 - x, y - my0, my1 - 1 - y);
            if (e < 7) {
              // the frame: a lit outer bead, a hollow, a lit inner bead
              const lit = x - mx0 + (y - my0) < (mx1 - mx0 + my1 - my0) / 2;
              put(x, y, (e === 0 ? 0.3 : e === 1 ? 0.62 : e < 4 ? 0.44 : e === 4 ? 0.26 : e === 5 ? 0.56 : 0.2) + (lit ? 0.04 : -0.06), R("brass"));
              continue;
            }
            // parchment, foxed toward its edges, a grid of faint lines
            let s = 0.5 - Math.max(0, 14 - e) * 0.012 + (hashInt(x >> 2, y >> 2, 41) - 0.5) * 0.06;
            if ((x - mx0) % 16 === 0 || (y - my0) % 16 === 0) s -= 0.05;
            put(x, y, s, R("paper"));
          }
        const ry = (my1 - my0) * 0.28, rxx = ry * 1.3;
        const ring = (x: number, y: number): number => Math.hypot((x - cx) / rxx, (y - cy) / ry);
        for (let y = Math.floor(cy - ry - 6); y < cy + ry + 6; y++)
          for (let x = Math.floor(cx - rxx - 8); x < cx + rxx + 8; x++) {
            const d = ring(x, y);
            if (d > 0.82 && d < 1.12) put(x, y, d > 0.9 && d < 1.04 ? 0.44 : 0.3, R("ink"));
            else if (d > 0.74 && d < 1.2 && (x + y) & 1) put(x, y, 0.36, R("paper"));
          }
        // the five places round the ring: Ringwater (on it), the Shore and Plain, the Hollow, the
        // Spire, the Chapel; a dot each, the Spire a mark that goes up, the Hollow ringed in brass
        const places: [number, number][] = [[-1.0, 0.2], [0.95, -0.35], [0.3, 1.02], [-0.25, -1.05], [0.9, 0.62]];
        const marks: [number, number][] = [];
        for (const [i, [a, bb]] of places.entries()) {
          const x = Math.round(cx + a * rxx), y = Math.round(cy + bb * ry);
          marks.push([x, y]);
          for (let q = -2; q <= 2; q++) for (let w = -2; w <= 2; w++) if (Math.abs(q) + Math.abs(w) < 4) put(x + w, y + q, 0.22, R("ink"));
          if (i === 3) for (let q = 0; q < 12; q++) put(x, y - 3 - q, 0.22, R("ink"));
          if (i === 2) for (let t = 0; t < Math.PI * 2; t += 0.2) put(Math.round(x + Math.cos(t) * 5), Math.round(y + Math.sin(t) * 5), 0.55, R("brass"));
        }
        // the route in red, dashed, place to place
        for (let i = 0; i + 1 < marks.length; i++) {
          const [ax, ay] = marks[i]!, [bx, by] = marks[i + 1]!;
          const n = Math.round(Math.hypot(bx - ax, by - ay));
          for (let t = 3; t < n - 3; t++) if (t % 5 < 3) put(Math.round(ax + ((bx - ax) * t) / n), Math.round(ay + ((by - ay) * t) / n), 0.5, R("spine"));
        }
        // a compass rose in the corner, a title cartouche at the foot
        const kx = mx1 - 22, ky = my0 + 22;
        for (let q = -9; q <= 9; q++) (put(kx, ky + q, 0.26, R("ink")), put(kx + q, ky, 0.26, R("ink")));
        for (let q = -4; q <= 4; q++) (put(kx + q, ky + q, 0.34, R("ink")), put(kx + q, ky - q, 0.34, R("ink")));
        for (let x = Math.round(cx - 30); x < cx + 30; x++)
          for (let y = my1 - 22; y < my1 - 12; y++) put(x, y, y === my1 - 22 || y === my1 - 13 ? 0.3 : 0.44 + (y === my1 - 18 && x % 4 < 3 && Math.abs(x - cx) < 24 ? -0.2 : 0), R("paper"));
        // the picture lamp: a brass bar on a stem over the frame, its light falling on the chart
        for (let x = Math.round(cx - 22); x < cx + 22; x++) (put(x, my0 - 12, 0.6, R("brass")), put(x, my0 - 11, 0.3, R("brass")), put(x, my0 - 10, 0.5, R("candle"), true));
        for (let q = 1; q < 10; q++) put(Math.round(cx), my0 - 12 - q, 0.4, R("brass"));
        pool(bump, cx, my0 + 20, (mx1 - mx0) * 0.6, (my1 - my0) * 0.7, 0.14, 4, 43);
      }
      // over the door: pigeonholes up to the frieze and a carved name board on the cornice
      {
        const caseTop = floorS - (Math.round(o.H * 1.4) + 4) - 14 - 22;
        holes(dX - 66, ceilS + 46, dX + 66, caseTop - 34, 22, 22, 53);
        for (let y = caseTop - 26; y < caseTop - 8; y++)
          for (let x = dX - 46; x < dX + 46; x++) {
            const e = Math.min(x - (dX - 46), dX + 45 - x, y - (caseTop - 26), caseTop - 9 - y);
            let s = e === 0 ? 0.5 : e < 3 ? 0.34 : 0.26;
            // carved letters: blocky strokes, lit on their upper edge (no real word: the archive's mark)
            const lx = x - (dX - 36), ly = y - (caseTop - 21);
            if (lx >= 0 && lx < 72 && ly >= 0 && ly < 8 && lx % 9 < 6) {
              const bit = hashInt(Math.floor(lx / 3), Math.floor(ly / 3), 61) < 0.55;
              if (bit) s = ly % 3 === 0 ? 0.46 : 0.14;
            }
            put(x, y, s);
          }
      }
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
      const rad = o.H * (1.2 + k * 1.8);
      pool(bump, lx2, ly2 + rad * 0.15, rad, rad * 1.05, 0.14 + k * 0.3, 5, Math.round(wx * 10));
    }
    // the light is all low (candles, a table lamp): the wall darkens toward the ceiling, so the
    // pools read as light and the shelves go up into the dark
    for (let y = ceilS; y < floorS; y++) {
      const t = 1 - (y - ceilS) / (floorS - ceilS);
      if (t < 0.35) continue;
      for (let x = -8; x < o.roomW + 8; x++) if (!inArch(x, y) && ((x ^ y) & 1 || t > 0.5)) bump(x, y, -(t - 0.35) * 0.34);
    }
    // the light wells: a grate in the ceiling boards (iron bars against the amber above), a lit shaft
    // of masonry over it up to the street, and the shaft's light on the wall where it passes and lands
    for (const wx of o.wells) {
      const gx = rx(wx);
      const [lx0, lx1] = wellLine(o, wx, span).map((v) => v + span / 2);
      for (let y = 0; y < ceilS; y++)
        for (let x = gx - 22; x < gx + 22; x++) {
          const e = Math.min(x - (gx - 22), gx + 21 - x);
          if (y >= ceilS - 8) {
            // the grate in the ceiling boards: bars and the light between them
            const bar = (x - gx + 40) % 6 < 2 || e < 2;
            if (bar) put(x, y, 0.3 + (y === ceilS - 1 ? 0.12 : 0));
            else put(x, y, 0.9, R("well"), true);
            continue;
          }
          // the shaft through the masonry: its sides lit by the light coming down, brighter toward the street
          const k = 1 - y / Math.max(1, ceilS - 8);
          put(x, y, e < 3 ? 0.3 + k * 0.12 : 0.36 + (1 - k) * 0.22 + ((x + y) & 1 ? 0.02 : 0), e < 3 ? R("stone") : R("well"));
        }
      // the light on the wall along the shaft, stepped, and a warm patch on the wainscot where it lands
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9;
        const cx = lx0! + (lx1! - lx0!) * t, cy = ceilS + (floorS - ceilS) * t;
        pool(bump, cx, cy, o.H * (0.3 + t * 0.32), o.H * 0.42, 0.07, 2, Math.round(wx * 10) + i);
      }
      pool(bump, lx1!, floorS - o.H * 0.3, o.H * 0.85, o.H * 0.55, 0.12, 3, Math.round(wx * 13));
    }
    // occlusion: the floor's edge, the corners under the beams
    for (let q = 0; q < 10; q++) for (let x = -8; x < o.roomW + 8; x++) bump(x, floorS - 1 - q, -0.06 + q * 0.006);
    for (let q = 0; q < 8; q++) for (let x = -8; x < o.roomW + 8; x++) bump(x, ceilS + q, -0.05 + q * 0.006);
    L.push({ kind: "pix", name: "wall", depth: 1, fog: 0, pix, x: ox, y: 0, twinkle: 0, dither: 0 });
  }
  // the light wells' shafts: stepped additive light in the room's air, in front of the wall (behind the
  // player and the props: the room's dominant light, from above, the way the refs light a room)
  for (const [i, wx] of o.wells.entries()) {
    const [x0, x1] = wellLine(o, wx, span);
    L.push({ ...shaft({ name: `well-${i}`, depth: 1, fn: `well${i}`, row: "well", steps: 4, alpha: 0.42 }), bounds: { x0: Math.min(x0, x1) - o.H, x1: Math.max(x0, x1) + o.H, y0: ceilS - 6, y1: floorS + 8 } });
  }
  L.push(...archiveFore(ctx, o));
  return L;
}

/**
 * Near silhouettes in front of the reading room (round 3): the frame's top edge is a carved beam close
 * to the camera with chain lamps hanging from it; along its foot, piles of books stand on the floor
 * nearer than the player, short enough to leave her readable. Front pass
 * (depth < 1): they draw over the world and slide faster than it. Near-black oak with a warm rim.
 */
function archiveFore(ctx: BuildCtx, o: ArchiveOpts): LayerDef[] {
  const { W, H } = ctx;
  const span = ctx.span;
  const R = (n: string): number => ctx.row(n);
  const d = 0.72;
  const lx = (roomX: number): number => W / 2 + (roomX - W / 2 - span / 2) / d;
  const X = (wx: number): number => lx((wx - o.x0) * o.H);
  const w = Math.ceil(ctx.panWidth(d)) + 300;
  const x = -Math.ceil((w - W) / 2);
  const floorS = o.floor - o.ref, ceilS = o.ceiling - o.ref;
  const pix = new Pix(w, H + 40);
  const put = putter(pix, x, 0, R("fore"));
  // the beam: across the whole top, its underside lit by the room, brackets every so often, and a
  // chain lamp hanging from it here and there (a dark brass cage round a flame)
  const beamB = Math.max(18, ceilS - 16);
  for (let xx = x; xx < x + w; xx++) {
    for (let yy = 0; yy < beamB; yy++) put(xx, yy, 0.2 + (yy === beamB - 1 ? 0.5 : yy === beamB - 2 ? 0.3 : 0) + ((xx >> 3) % 7 === 0 ? -0.04 : 0));
    const k = (xx - x) % 340;
    if (k < 26) for (let q = 0; q < 26 - k; q++) put(xx, beamB + q, 0.22 + (q === 26 - k - 1 ? 0.3 : 0));
  }
  for (const wx of [228.2, 240.3]) {
    const cx = Math.round(X(wx));
    const len = Math.round(o.H * 0.9);
    for (let yy = beamB; yy < beamB + len; yy++) put(cx + ((yy >> 2) & 1), yy, (yy & 3) === 0 ? 0.5 : 0.26);
    for (let yy = 0; yy < 22; yy++)
      for (let q = -9; q <= 9; q++) {
        const hw = 4 + Math.round(Math.sin((yy / 22) * Math.PI) * 5);
        if (Math.abs(q) > hw) continue;
        const cage = Math.abs(q) === hw || yy % 7 === 0;
        if (cage) put(cx + q, beamB + len + yy, Math.abs(q) === hw && q > 0 ? 0.62 : 0.3);
        else put(cx + q, beamB + len + yy, 0.62 - Math.abs(q) * 0.04 + (yy > 14 ? -0.1 : 0), R("well"));
      }
  }
  // the floor's near edge: piles of books, short (under 0.5 H over the floor line)
  const piles = [226.4, 230.6, 234.1, 238.3, 242.4, 246.6];
  for (const [i, wx] of piles.entries()) {
    const cx = Math.round(X(wx));
    const base = Math.round(floorS + 46);
    // books lying in a pile, each a little offset: some spine out (cloth, two gilt bands, a lit top
    // edge), some fore-edge out (the paper block in lines between the boards)
    let yb = base;
    const top = floorS - Math.round(o.H * (0.08 + hashInt(i, 1, 7) * 0.4));
    for (let k = 0; yb > top && k < 30; k++) {
      const bh = 7 + Math.round(hashInt(i, k, 9) * 5), bw = 50 + Math.round(hashInt(k, i, 11) * 34);
      const off = Math.round((hashInt(i + 3, k, 13) - 0.5) * 16);
      const pick = hashInt(k, i, 15);
      const row = pick < 0.35 ? R("spine") : pick < 0.6 ? R("spine2") : pick < 0.8 ? R("spine3") : R("paper");
      const edge = row === R("paper");
      for (let yy = yb - bh; yy < yb; yy++)
        for (let q = Math.round(-bw / 2); q < bw / 2; q++) {
          const ly = yy - (yb - bh), lq = q + bw / 2;
          let sv: number;
          let rr = row;
          if (edge) {
            // boards top and bottom, the pages between in lines
            if (ly === 0 || ly === bh - 1) (sv = ly === 0 ? 0.36 : 0.1), (rr = R("spine"));
            else sv = 0.2 + (ly % 2 ? 0.05 : -0.04) - (lq > bw - 4 ? 0.08 : 0);
          } else {
            sv = 0.16 + (ly === 0 ? 0.2 : ly === 1 ? 0.06 : ly === bh - 1 ? -0.1 : 0) - (lq < 2 ? 0.06 : 0) + (lq > bw - 3 ? 0.1 : 0);
            if ((Math.abs(lq - 7) < 1 || Math.abs(lq - (bw - 8)) < 1) && ly > 0 && ly < bh - 1) (sv = 0.32), (rr = R("brass"));
          }
          put(cx + off + q, yy, sv, rr);
        }
      yb -= bh;
    }
  }
  return [{ kind: "pix", name: "fore", depth: d, fog: 0, pix, x, y: 0, twinkle: 0, dither: 0 }];
}
