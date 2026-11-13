// The map banner: a painted map rolled up under a rod, the roll held by a
// cord tied off to a cleat on the wall. Slash the cord and the roll drops,
// unrolling the cloth (verlet cloth, rows released as the roll passes), the
// weighted hem swings and settles. Then E reads the full map. The cut stays
// cut for the visit (persisted). It's a map, not fast travel.
// Origin: the rod's centre.

import type { CellGrid } from "../cells.ts";
import type { Hit } from "../hits.ts";
import type { Cloth, Rope } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import { resolveMat } from "../materials.ts";

export interface BannerParams {
  /** Cloth width and length in H. */
  width: number;
  length: number;
  /** Cleat position relative to the rod, in H. */
  cleat: [number, number];
  /** Lit shrines (1..6, the save's shrine:n): their marks show lit on the map. */
  shrines: number[];
}

interface Refs {
  cloth: Cloth;
  clothPart: Part;
  roll: Part;
  rope: Rope;
  src: CellGrid;
  canvas: import("../builder.ts").PartBuilder;
  unrolled: number;
  speed: number;
  length: number;
  topY: number;
  r0: number;
  spacing: number;
}

/**
 * The world's route, from WORLD-PLAN section 3: floor points in H (x west to
 * east, y up from the lake), in walking order. The map draws this side view
 * with its height exaggerated so the W reads on a portrait banner.
 */
export const ROUTE: [number, number][] = [
  [-20, 0.3], [0, 0.3], [34, 0.3], [40, 3], [46, 6], [60, 6], [76, 6], [92, 2], [108, 1], [140, 1.5], [172, 2],
  [180, -14], [188, -32], [220, -32], [252, -32], [265, -32], [265, 40], [276, 58], [284, 76], [300, 80], [316, 84],
  [356, 62], [396, 40], [410, 40], [458, 40], [466, 46], [472, 52],
];
/** The six shrines (lamp marks), numbered as the save's `shrine:1..6`. */
export const SHRINES: [number, number][] = [[68, 6], [164, 2], [220, -32], [266, 58], [356, 62], [403, 40]];

function mapXY(w: number, h: number): { X: (x: number) => number; Y: (y: number) => number } {
  const x0 = 7, x1 = w - 7, sx = (x1 - x0) / 492;
  const sy = 0.7, base = Math.round(h * 0.1) + 12 + Math.round(92 * sy);
  return { X: (x) => Math.round(x0 + (x + 20) * sx), Y: (y) => Math.round(base - y * sy) };
}

/** Paint the map onto the cloth design (the real route; shrines in `lit` show as lit). */
function paintMap(c: import("../builder.ts").PartBuilder, w: number, h: number, seed: number, lit: number[] = []): void {
  const { X, Y } = mapXY(w, h);
  // cloth ground, red border, top hem, weighted bottom hem rod
  c.rect(0, 0, w, h, { mat: "clothRed", profile: "flat", depth: 1, piece: "cloth" });
  c.rect(4, 7, w - 8, h - 16, { mat: "parchment", profile: "flat", depth: 1.4, piece: "field" });
  c.speckle({ amount: 0.08, seed, tone: -1, scale: 3, mats: ["parchment"] });
  c.speckle({ amount: 0.05, seed: seed + 1, tone: 1, scale: 2, mats: ["parchment"] });
  c.rect(0, 0, w, 3, { mat: "clothRed", mode: "paint", tone: 1 });
  c.rect(0, h - 6, w, 6, { mat: "woodDark", profile: "cylH", z: 2, piece: "hem" });
  const ink = { mat: "mapInk", profile: "flat" as const, depth: 1.4, noInk: true, piece: "ink" };
  const red = { mat: "mapRed", profile: "flat" as const, depth: 1.4, noInk: true, piece: "ink" };
  const dot = (x: number, y: number, o = ink): void => void c.pixels([[x, y]], o);
  // the lake under Ringwater, wave marks, and the ring hanging over the dock
  for (let x = X(-20); x <= X(110); x++) if (x % 3 !== 0) dot(x, Y(0) + 2);
  for (let k = 0; k < 7; k++) {
    const x = X(-14) + k * 4, y = Y(0) + 5 + (k % 2) * 3;
    c.pixels([[x, y + 1], [x + 1, y], [x + 2, y + 1]], ink);
  }
  const rx = X(14), ry = Y(34), R = 11;
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    if (a > 5.2 && a < 5.7) continue; // the break in the ring
    dot(Math.round(rx + Math.cos(a) * R * 0.7), Math.round(ry + Math.sin(a) * R));
  }
  c.circle(rx + 1, ry - 2, 1.5, { ...ink, mat: "mapRed" });
  // the plain's horizon with colossi walking it
  for (let x = X(110); x <= X(172); x += 2) dot(x, Y(1) + 1);
  for (let k = 0; k < 3; k++) {
    c.ornament(X(118 + k * 18), Y(1) - 8, `
      .#.
      ###
      .#.
      #.#
      #.#
    `, { "#": ink.mat }, { profile: "flat", noInk: true, piece: "ink" });
  }
  // the hollow: a bowl under the market
  for (let x = X(186); x <= X(262); x++) {
    const t = (x - X(186)) / Math.max(1, X(262) - X(186));
    dot(x, Math.round(Y(-32) + 3 + Math.sin(Math.PI * t) * 5));
  }
  // the spire: a black blade from the hollow to above the Crown, a storm on it
  c.poly([X(258), Y(-30), X(274), Y(-30), X(270), Y(80), X(266), Y(96)], { ...ink, piece: "spire" });
  for (let k = 0; k < 5; k++) c.ellipse(X(262 + k * 5), Y(98) + (k % 2) * 2, 4, 2, { ...ink, mat: "mapInk", tone: -1 });
  // the fallen ring segment (the pilgrim path) and the chapel with its bell tower
  for (let x = X(316); x <= X(396); x++) {
    const t = (x - X(316)) / Math.max(1, X(396) - X(316));
    dot(x, Math.round(Y(84 - 44 * t) + 2 + Math.sin(Math.PI * t) * -3));
  }
  c.ornament(X(424) - 3, Y(40) - 9, `
    ...#...
    ..###..
    .#...#.
    #.....#
    #..#..#
    #..#..#
    #######
  `, { "#": ink.mat }, { profile: "flat", noInk: true, piece: "ink" });
  c.rect(X(470), Y(58), 1, Y(40) - Y(58), ink);
  // the route itself: a dotted red line, the one you walk
  for (let k = 0; k < ROUTE.length - 1; k++) {
    const [ax, ay] = ROUTE[k]!, [bx, by] = ROUTE[k + 1]!;
    const x0 = X(ax), y0 = Y(ay), x1 = X(bx), y1 = Y(by);
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= n; s++) if (s % 3 !== 2) dot(Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n) - 1, red);
  }
  // the sky door: a faint arc from the bell balcony back over everything to the lodge's loft
  const [sx0, sy0] = [X(472), Y(52)], [sx1, sy1] = [X(53), Y(10.5)];
  for (let s = 0; s <= 60; s++) {
    if (s % 4 >= 2) continue;
    const t = s / 60;
    const x = sx0 + (sx1 - sx0) * t, y = sy0 + (sy1 - sy0) * t - Math.sin(Math.PI * t) * (h * 0.22);
    dot(Math.round(x), Math.round(y), ink);
  }
  paintShrines(c, w, h, lit);
  // compass mark
  c.ornament(w - 14, h - 22, `
    ..#..
    ..#..
    #####
    ..#..
    ..#..
  `, { "#": ink.mat }, { profile: "flat", noInk: true, piece: "ink" });
}

/** The six lamp marks: dark outlines, or filled when that shrine is lit (the save's shrine:1..6). */
function paintShrines(c: import("../builder.ts").PartBuilder, w: number, h: number, lit: number[]): void {
  const { X, Y } = mapXY(w, h);
  SHRINES.forEach(([sx, sy], k) => {
    const on = lit.includes(k + 1);
    c.ornament(X(sx) - 1, Y(sy) - 6, on ? `
      .#.
      ###
      ###
      .#.
    ` : `
      .#.
      #.#
      #.#
      .#.
    `, { "#": { mat: on ? "glyph" : "mapRed", tone: on ? 1 : 0 } }, { profile: "flat", noInk: true, piece: "ink", mode: "over" });
  });
}

export const mapBanner = defineRecipe<BannerParams, Refs>({
  id: "mapBanner",
  breakage: "cut",
  reason: "The world map, hung at the first shrine: cutting its cord is the first physical, permanent act; E then reads the map.",
  demo: {
    w: 6, at: 3.2, indoor: true,
    script: [
      { label: "rolled, the cord tied off to its cleat", wait: 1 },
      { label: "slash the cord: it unrolls", hit: "slash", from: -1.6, face: 1, wait: 4 },
      { label: "slash the cloth: it sways (the map never tears)", hit: "slash", from: -0.4, face: 1, wait: 2 },
      { label: "E: read the map", use: true, from: 0, wait: 0.6 },
      { label: "the save lights shrines 1 to 3 on it", act: "shrines", arg: [1, 2, 3], wait: 1 },
    ],
  },
  // WORLD-PLAN section 1: the rod 1.8 H wide (cloth 1.54 plus the finials), 2.4 H of cloth unrolled
  defaults: { width: 1.54, length: 2.4, cleat: [-1.1, 2.05], shrines: [] },
  standard: { w: 1.8, parts: ["rod"], note: "map banner rod width" },
  use: { reach: 1.1, prompt: "read" },
  persist: ["cut"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const bw = u(p.width), bl = u(p.length);
    const src = b.canvas(bw, bl);
    paintMap(src, bw, bl, p.seed, p.shrines);
    src.grid.computeNormals({ x0: 0, y0: 0, x1: src.grid.W - 1, y1: src.grid.Hh - 1 });
    // rod with brass finials and wall brackets
    const rw = bw + u(0.26);
    const rod = b.part("rod", { w: rw, h: 14, pivot: [Math.floor(rw / 2), 10], at: [0, 0], layer: "bg", z: 16 });
    rod.rect(3, 8, rw - 6, 5, { mat: "woodDark", profile: "cylH" });
    for (const x of [4, rw - 5]) rod.circle(x, 10, 4, { mat: "brass", profile: "dome", r: 3, z: 2, piece: "finial" });
    for (const x of [u(0.14), rw - u(0.14) - 3]) rod.rect(x, 0, 3, 10, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "bracket" });
    b.get("rod").tag["heal"] = true;
    // cleat on the wall
    const [cxH, cyH] = p.cleat;
    // sized in H so it reads at 1x: an iron backplate (~0.36 H tall), a brass
    // horn cleat across it (~0.32 H) and the cord's turns wrapped on the horn
    const pw = Math.max(8, u(0.12)), ph = Math.max(20, u(0.36)), hw = Math.max(18, u(0.32)), hh = Math.max(4, u(0.06));
    const cw = Math.max(pw, hw) + 2, ch = ph + 2;
    const hy = Math.round(ch * 0.42);
    const cl = b.part("cleat", { w: cw, h: ch, pivot: [Math.floor(cw / 2), hy], at: [u(cxH), u(cyH)], layer: "bg", z: 16 });
    const px = Math.floor((cw - pw) / 2), hx = Math.floor((cw - hw) / 2);
    cl.roundRect(px, 1, pw, ph, 2, { mat: "iron", profile: "bevel", r: 2, depth: 2 });
    cl.rivets([[px + Math.floor(pw / 2), 4], [px + Math.floor(pw / 2), ph - 3]], { mat: "brass", r: 1, z: 3 });
    cl.roundRect(hx, hy - Math.floor(hh / 2), hw, hh, 2, { mat: "brass", profile: "cylH", z: 2, piece: "horn" });
    for (const k of [-1, 0, 1]) {
      const x = Math.floor(cw / 2) + k * 3;
      cl.stroke([x - 2, hy - hh + 1, x + 2, hy + hh - 1], 2, { mat: "rope", z: 4, piece: "wrap" });
    }
    // the cloth (unrolled rest pose) and the roll
    const spacing = Math.max(5, Math.round(bw / 16));
    const topY = 12;
    const { cloth, part: clothPart } = b.cloth("cloth", { src: src.grid, spacing, x: -bw / 2, y: topY, bottomMass: 4, damping: 0.972, windGain: 0.5, foldGain: 1.5, layer: "bg", room: [bw * 0.45, 6, bw * 0.45, 24] });
    clothPart.z = 15;
    const r0 = Math.max(5, Math.round(Math.sqrt((bl * 1.3) / Math.PI)));
    const roll = b.part("roll", { w: bw + 2, h: r0 * 2 + 2, pivot: [Math.floor(bw / 2) + 1, r0 + 1], at: [0, topY + r0], layer: "bg", z: 17, hittable: false });
    void roll;
    // the cord: cleat -> the roll's left end
    const { rope } = b.rope("cord", { from: [u(cxH), u(cyH) + hh], to: [-bw / 2 + 4, topY + r0], segments: 14, slack: 1.03, mat: "rope", width: 2, pinStart: true, pinEnd: true, layer: "bg" });
    b.parts[b.parts.length - 1]!.part.z = 18;
    return { cloth, clothPart, roll: b.get("roll"), rope, src: src.grid, canvas: src, unrolled: 0, speed: 0, length: bl, topY, r0, spacing };
  },
  actions: {
    /** Show which shrines are lit (numbers 1..6); the host passes the save's shrine flags. */
    shrines: (c, arg) => {
      const R = c.refs;
      paintShrines(R.canvas, R.src.w, R.src.h, Array.isArray(arg) ? (arg as number[]) : []);
      R.src.computeNormals({ x0: 0, y0: 0, x1: R.src.W - 1, y1: R.src.Hh - 1 });
      R.cloth.wake();
      R.clothPart.tag["drawn"] = false;
    },
  },
  initial: (c) => (c.data["cut"] ? "unrolled" : "rolled"),
  states: {
    rolled: {
      enter(c) {
        c.refs.unrolled = 0;
        pinRows(c);
        drawRoll(c);
      },
      // every row is pinned in the roll: nothing to step until the cord is cut
      hit(c, h) {
        const cut = c.cut(h.hit, { cloth: false });
        if (h.parts.length) c.damage(h.hit);
        if (cut.cut > 0) return "unrolling";
      },
    },
    unrolling: {
      sound: "cloth.unroll",
      enter(c) {
        c.data["cut"] = true;
        const r = c.refs.rope;
        r.pins[r.n - 1] = null;
        r.wake();
        c.refs.speed = c.params.H * 0.6;
      },
      update(c, dt) {
        const R = c.refs;
        // the roll drops: gravity against the cloth's drag as it unwinds
        R.speed += (c.world.gravity * 0.45 - R.speed * 1.6) * dt;
        R.unrolled = Math.min(R.length, R.unrolled + R.speed * dt);
        pinRows(c);
        drawRoll(c);
        if (R.unrolled >= R.length) return c.go("unrolled");
      },
      hit(c, h) {
        push(c, h.hit);
      },
    },
    unrolled: {
      enter(c, from) {
        const R = c.refs;
        R.unrolled = R.length;
        releaseAll(c, from !== "unrolling");
        R.roll.visible = false;
        if (from !== "unrolling") {
          // arriving already cut (saved): both cord ends hang
          const r = R.rope;
          r.cutSeg(Math.floor(r.n / 2));
          r.pins[r.n - 1] = null;
        } else c.sound("cloth.settle", 0.6);
      },
      hit(c, h) {
        push(c, h.hit);
        if (h.parts.length) c.damage(h.hit);
      },
      use(c) {
        c.emit({ type: "panel", panel: "map", grid: c.refs.src });
        c.sound("cloth.read", 0.5);
      },
    },
  },
});

function pinRows(c: Prop<Refs>): void {
  const R = c.refs;
  const cl = R.cloth;
  const rollY = c.y + R.topY + R.unrolled;
  for (let j = 0; j < cl.rows; j++) {
    const restY = Math.min(j * R.spacing, R.src.h);
    for (let i = 0; i < cl.cols; i++) {
      const k = j * cl.cols + i;
      const restX = c.x - R.src.w / 2 + Math.min(i * R.spacing, R.src.w);
      if (j === 0) cl.pin(k, restX, c.y + R.topY, 0);
      else if (restY > R.unrolled) cl.pin(k, restX, rollY, 0);
      else if (cl.pins[k]) cl.unpin(k);
    }
  }
  cl.wake();
}

function releaseAll(c: Prop<Refs>, settle: boolean): void {
  const R = c.refs;
  const cl = R.cloth;
  for (let j = 1; j < cl.rows; j++) for (let i = 0; i < cl.cols; i++) cl.unpin(j * cl.cols + i);
  if (settle) {
    // put the points at rest immediately
    for (let j = 0; j < cl.rows; j++) {
      for (let i = 0; i < cl.cols; i++) {
        const k = j * cl.cols + i;
        cl.p[k * 3] = cl.q[k * 3] = c.x - R.src.w / 2 + Math.min(i * R.spacing, R.src.w);
        cl.p[k * 3 + 1] = cl.q[k * 3 + 1] = c.y + R.topY + Math.min(j * R.spacing, R.src.h);
      }
    }
  }
  cl.wake();
}

/** The roll: a cylinder of the cloth's own colours, shrinking as it unwinds. */
function drawRoll(c: Prop<Refs>): void {
  const R = c.refs;
  const g = R.roll.grid;
  g.clearAll();
  const left = 1 - R.unrolled / R.length;
  if (left <= 0.01) {
    R.roll.visible = false;
    return;
  }
  R.roll.visible = true;
  const r = Math.max(2.5, R.r0 * Math.sqrt(left));
  R.roll.y = R.topY + R.unrolled + r - 1;
  const cy = g.h / 2;
  const red = resolveMat("clothRed").id, parch = resolveMat("parchment").id;
  for (let y = 0; y < g.h; y++) {
    const dy = (y + 0.5 - cy) / r;
    if (Math.abs(dy) > 1) continue;
    const hgt = Math.sqrt(1 - dy * dy) * r;
    // winding lines drift as it turns
    const turn = Math.floor((y + R.unrolled * 0.7) / 3) % 3 === 0;
    for (let x = 1; x < g.w - 1; x++) {
      const i = g.inner(x, y);
      const edge = x < 5 || x > g.w - 6;
      g.setRaw(i, edge ? red : parch, turn && !edge ? -1 : 0, 1, hgt + 1, 0, 30);
    }
  }
  g.computeNormals();
}

function push(c: Prop<Refs>, hit: Hit): void {
  const [x, y] = hit.shape.kind === "arc" || hit.shape.kind === "circle" || hit.shape.kind === "cone" || hit.shape.kind === "point" ? [hit.shape.x, hit.shape.y] : [c.x, c.y + c.refs.length / 2];
  const H = c.params.H;
  const f = hit.type === "wind" ? 1.2 : hit.type === "slash" ? 2.4 : 3.5;
  c.refs.cloth.push(x, y, H * 2.2, hit.dir[0] * f, hit.dir[1] * f * 0.5, f * 0.8);
}
