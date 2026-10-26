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
}

interface Refs {
  cloth: Cloth;
  clothPart: Part;
  roll: Part;
  rope: Rope;
  src: CellGrid;
  unrolled: number;
  speed: number;
  length: number;
  topY: number;
  r0: number;
  spacing: number;
}

/** Paint the map onto the cloth design. */
function paintMap(c: import("../builder.ts").PartBuilder, w: number, h: number, seed: number): void {
  const fx = (f: number): number => Math.round(f * w), fy = (f: number): number => Math.round(f * h);
  // cloth ground, red border, top hem, weighted bottom hem rod
  c.rect(0, 0, w, h, { mat: "clothRed", profile: "flat", depth: 1, piece: "cloth" });
  c.rect(4, 7, w - 8, h - 16, { mat: "parchment", profile: "flat", depth: 1.4, piece: "field" });
  c.speckle({ amount: 0.08, seed, tone: -1, scale: 3, mats: ["parchment"] });
  c.speckle({ amount: 0.05, seed: seed + 1, tone: 1, scale: 2, mats: ["parchment"] });
  c.rect(0, 0, w, 3, { mat: "clothRed", mode: "paint", tone: 1 });
  c.rect(0, h - 6, w, 6, { mat: "woodDark", profile: "cylH", z: 2, piece: "hem" });
  const ink = { mat: "mapInk", profile: "flat" as const, depth: 1.4, noInk: true, piece: "ink" };
  const red = { mat: "mapRed", profile: "flat" as const, depth: 1.4, noInk: true, piece: "ink" };
  // the ring, tilted over the sea (top left)
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = fx(0.36) + Math.cos(a) * w * 0.26, y = fy(0.2) + Math.sin(a) * h * 0.075;
    const rx = x + Math.sin(a) * 2, ry = y - Math.cos(a) * w * 0.02;
    c.pixels([[Math.round(rx), Math.round(ry)]], ink);
  }
  // the sea: wave marks along the bottom left
  for (let k = 0; k < 9; k++) {
    const x = fx(0.1) + (k % 3) * fx(0.12) + (Math.floor(k / 3) % 2) * 5, y = fy(0.78) + Math.floor(k / 3) * 6;
    c.pixels([[x, y + 1], [x + 1, y], [x + 2, y], [x + 3, y + 1]], ink);
  }
  // the dock
  c.rect(fx(0.14), fy(0.72), fx(0.14), 2, ink);
  // colossi walking in a line on the horizon
  for (let k = 0; k < 4; k++) {
    const x = fx(0.58) + k * fx(0.09), y = fy(0.33);
    c.ornament(x, y - 6, `
      .#.
      ###
      .#.
      #.#
      #.#
      #.#
    `, { "#": ink.mat }, { mode: "over", profile: "flat", noInk: true, piece: "ink" });
  }
  // the spire (top right) and the hollow (a bowl, middle)
  c.poly([fx(0.8), fy(0.2), fx(0.84), fy(0.5), fx(0.76), fy(0.5)], ink);
  c.rect(fx(0.74), fy(0.5), fx(0.12), 2, ink);
  for (let x = fx(0.36); x < fx(0.66); x++) {
    const t = (x - fx(0.36)) / fx(0.3);
    c.pixels([[x, Math.round(fy(0.52) + Math.sin(Math.PI * t) * fy(0.06))]], ink);
  }
  // the chapel (a small pointed arch near the ring)
  c.ornament(fx(0.16), fy(0.32), `
    ..#..
    .#.#.
    #...#
    #...#
    #####
  `, { "#": ink.mat }, { profile: "flat", noInk: true, piece: "ink" });
  // the route: a dotted red line dock -> plain -> hollow -> spire, and the pilgrim path back to the chapel
  const route = [[0.2, 0.71], [0.3, 0.64], [0.44, 0.62], [0.5, 0.56], [0.62, 0.58], [0.78, 0.52], [0.8, 0.26]];
  const back = [[0.2, 0.71], [0.12, 0.55], [0.18, 0.4]];
  for (const path of [route, back]) {
    for (let k = 0; k < path.length - 1; k++) {
      const [ax, ay] = path[k]!, [bx, by] = path[k + 1]!;
      const n = Math.ceil(Math.hypot((bx! - ax!) * w, (by! - ay!) * h));
      for (let s = 0; s < n; s += 1) {
        if (s % 4 >= 2) continue;
        const t = s / n;
        c.pixels([[Math.round((ax! + (bx! - ax!) * t) * w), Math.round((ay! + (by! - ay!) * t) * h)]], path === route ? red : ink);
      }
    }
  }
  // shrine marks along the route
  for (const [sx, sy] of [[0.3, 0.64], [0.62, 0.58], [0.12, 0.55]]) {
    c.ornament(Math.round(sx! * w) - 1, Math.round(sy! * h) - 4, `
      .#.
      ###
      .#.
    `, { "#": red.mat }, { profile: "flat", noInk: true, piece: "ink" });
  }
  // compass mark
  c.ornament(w - 14, h - 22, `
    ..#..
    ..#..
    #####
    ..#..
    ..#..
  `, { "#": ink.mat }, { profile: "flat", noInk: true, piece: "ink" });
}

export const mapBanner = defineRecipe<BannerParams, Refs>({
  id: "mapBanner",
  reason: "The world map, hung at the first shrine: cutting its cord is the first physical, permanent act; E then reads the map.",
  defaults: { width: 1.3, length: 2.3, cleat: [-1.0, 2.05] },
  use: { reach: 1.1, prompt: "read" },
  persist: ["cut"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const bw = u(p.width), bl = u(p.length);
    const src = b.canvas(bw, bl);
    paintMap(src, bw, bl, p.seed);
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
    return { cloth, clothPart, roll: b.get("roll"), rope, src: src.grid, unrolled: 0, speed: 0, length: bl, topY, r0, spacing };
  },
  initial: (c) => (c.data["cut"] ? "unrolled" : "rolled"),
  states: {
    rolled: {
      enter(c) {
        c.refs.unrolled = 0;
        pinRows(c);
        drawRoll(c);
      },
      update(c) {
        pinRows(c);
      },
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
