// Silhouette grammars for amber-hollow, all written in layer coordinates
// (ox is the layer x of the Pix buffer's left edge). Towers carry thousands of
// 1 px window lights as emissive texels; the shader keeps them at full
// brightness, lets a few dim at random, and fogs them less than the walls.

import { Pix, clamp, fbm, fbm1, hashInt, mulberry, smooth } from "../../engine/index.ts";

export type FogFn = (x: number, y: number) => number;

/** Emissive window rows with their relative weights. */
export interface WinSet {
  rows: number[];
  weights: number[];
}

function pickRow(ws: WinSet, h: number): number {
  let total = 0;
  for (const w of ws.weights) total += w;
  let acc = 0;
  for (let i = 0; i < ws.rows.length; i++) {
    acc += ws.weights[i]! / total;
    if (h <= acc) return ws.rows[i]!;
  }
  return ws.rows[ws.rows.length - 1]!;
}

export interface TowerOpts {
  x: number;
  w: number;
  ground: number;
  h: number;
  row: number;
  wins: WinSet;
  seed: number;
  shade?: number;
  /** Window grid step (x, y) and lit density 0..1. */
  gx?: number;
  gy?: number;
  lit?: number;
  setbacks?: number;
  spire?: number;
  fog?: FogFn;
  /** Lit window strips instead of single windows. */
  strips?: boolean;
  /** Emissive tip on the antenna (row), or none. */
  tip?: number;
  u?: number;
}

/** A block tower with setbacks, ribs, floor bands, windows and an optional antenna. */
export function tower(pix: Pix, ox: number, o: TowerOpts): number {
  const r = mulberry(o.seed);
  const u = o.u ?? 1;
  const X = (x: number): number => Math.round(x - ox);
  const base = o.shade ?? 0.22;
  const gx = o.gx ?? 2;
  const gy = o.gy ?? 3;
  const lit = o.lit ?? 0.14;
  const blocks: { x: number; w: number; y0: number; y1: number }[] = [];
  let x = Math.round(o.x);
  let w = Math.round(o.w);
  let top = Math.round(o.ground - o.h);
  blocks.push({ x, w, y0: top, y1: Math.round(o.ground) });
  let sb = o.setbacks ?? (r() < 0.65 ? 1 + Math.floor(r() * 2) : 0);
  while (sb-- > 0 && w > 5) {
    const nw = Math.max(3, Math.round(w * (0.45 + r() * 0.35)));
    const nh = Math.max(3, Math.round(o.h * (0.06 + r() * 0.16)));
    x += Math.round((w - nw) * r());
    w = nw;
    blocks.push({ x, w, y0: top - nh, y1: top });
    top -= nh;
  }
  const ribStep = 3 + Math.floor(r() * 4);
  const bandStep = gy * (3 + Math.floor(r() * 3));
  const fog = o.fog;
  for (const b of blocks) {
    const sh0 = base + (r() - 0.5) * 0.06;
    for (let yy = b.y0; yy < b.y1; yy++)
      for (let xx = b.x; xx < b.x + b.w; xx++) {
        let s = sh0;
        if ((xx - b.x) % ribStep === 0 && xx > b.x) s += 0.035;
        if ((yy - b.y0) % bandStep === 0) s += 0.05;
        s += (hashInt(Math.floor(xx / 3), Math.floor(yy / 5), o.seed) - 0.5) * 0.03;
        pix.set(X(xx), yy, s, o.row, fog ? fog(xx, yy) : 0);
      }
    // windows
    if (b.w >= 3) {
      const strips = o.strips ?? r() < 0.25;
      for (let yy = b.y0 + 2; yy < b.y1 - 1; yy += gy) {
        const floorLit = fbm(b.x / 13, yy / (gy * 4), o.seed + 3, 2);
        const k = clamp(0.25 + 1.8 * smooth(0.38, 0.72, floorLit));
        if (strips) {
          if (hashInt(b.x, yy, o.seed + 5) > lit * 3 * k) continue;
          const row = pickRow(o.wins, hashInt(yy, b.x, o.seed + 7));
          const a = b.x + 1 + Math.floor(hashInt(yy, 1, o.seed) * (b.w - 2) * 0.5);
          const e = b.x + b.w - 1 - Math.floor(hashInt(yy, 2, o.seed) * (b.w - 2) * 0.4);
          for (let xx = a; xx < e; xx++) pix.set(X(xx), yy, 0.9, row, fog ? fog(xx, yy) : 0, true);
          continue;
        }
        for (let xx = b.x + 1; xx < b.x + b.w - 1; xx += gx) {
          if (hashInt(xx, yy, o.seed + 1) >= lit * k) continue;
          const row = pickRow(o.wins, hashInt(xx, yy, o.seed + 2));
          pix.set(X(xx), yy, 0.9, row, fog ? fog(xx, yy) : 0, true);
        }
      }
    }
  }
  // roof clutter and antenna
  const tb = blocks[blocks.length - 1]!;
  if (tb.w > 6 && r() < 0.7) {
    const bw = Math.max(2, Math.round(tb.w * (0.2 + r() * 0.3)));
    const bx = tb.x + Math.round((tb.w - bw) * r());
    const bh = Math.max(2, Math.round((2 + r() * 3) * u));
    for (let yy = tb.y0 - bh; yy < tb.y0; yy++) for (let xx = bx; xx < bx + bw; xx++) pix.set(X(xx), yy, base + 0.03, o.row, fog ? fog(xx, yy) : 0);
  }
  const spire = o.spire ?? (r() < 0.22 ? (4 + r() * 12) * u : 0);
  if (spire > 0) {
    const sx = tb.x + Math.floor(tb.w * (0.2 + r() * 0.6));
    for (let yy = Math.round(tb.y0 - spire); yy < tb.y0; yy++) pix.set(X(sx), yy, base + 0.05, o.row, fog ? fog(sx, yy) : 0);
    if (o.tip !== undefined) pix.set(X(sx), Math.round(tb.y0 - spire) - 1, 0.9, o.tip, fog ? fog(sx, tb.y0) : 0, true);
  }
  return tb.y0;
}

export interface CityOpts {
  x0: number;
  x1: number;
  ground: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  row: number;
  wins: WinSet;
  seed: number;
  shade?: number;
  gap?: number;
  lit?: number;
  gx?: number;
  gy?: number;
  fog?: FogFn;
  /** Height envelope 0..1 over layer x, multiplies the random height. */
  env?: (x: number) => number;
  tip?: number;
  u?: number;
  /** 0..1: share of squat industrial megablocks instead of slim towers. */
  blocky?: number;
}

/**
 * A squat industrial megablock (w04's middle city): two or three stepped tiers,
 * each split into a shadowed side plane and a lit front plane, a lit lip on
 * every tier, a cantilevered slab jutting out on a diagonal strut, and windows
 * grouped into floor bands and small clusters rather than a uniform scatter.
 */
export function megablock(
  pix: Pix,
  ox: number,
  o: { x: number; w: number; ground: number; h: number; row: number; wins: WinSet; seed: number; shade?: number; fog?: FogFn; u?: number; lit?: number },
): number {
  const r = mulberry(o.seed);
  const u = o.u ?? 1;
  const base = o.shade ?? 0.22;
  const lit = o.lit ?? 0.14;
  const X = (x: number): number => Math.round(x - ox);
  const fog = o.fog;
  const put = (x: number, y: number, s: number): void => pix.set(X(x), y, s, o.row, fog ? fog(x, y) : 0);
  const tiers: { x: number; w: number; y0: number; y1: number }[] = [];
  let x = Math.round(o.x);
  let w = Math.round(o.w);
  let y1 = Math.round(o.ground);
  const n = r() < 0.55 ? 3 : 2;
  for (let k = 0; k < n && w > 6; k++) {
    const th = Math.max(4, Math.round(o.h * (k === 0 ? 0.5 + r() * 0.15 : 0.2 + r() * 0.15)));
    tiers.push({ x, w, y0: y1 - th, y1 });
    y1 -= th;
    const nw = Math.round(w * (0.5 + r() * 0.3));
    x += Math.round((w - nw) * (r() < 0.5 ? 0.15 : 0.85) * r());
    w = nw;
  }
  const lip = Math.max(1, Math.round(1.5 * u));
  tiers.forEach((b, k) => {
    // the side plane: the left third sits in shadow, a hue-shifted darker band
    const side = Math.round(b.w * (0.22 + r() * 0.16));
    const floor = Math.max(3, Math.round((5 + r() * 3) * u));
    for (let yy = b.y0; yy < b.y1; yy++)
      for (let xx = b.x; xx < b.x + b.w; xx++) {
        const lx = xx - b.x;
        let s = lx < side ? base - 0.08 : base + 0.02;
        if (lx === side) s = base + 0.1;
        if ((yy - b.y0) % floor === 0) s += 0.03;
        if (yy - b.y0 < lip) s = base + 0.2 + (k === tiers.length - 1 ? 0.06 : 0);
        s += (hashInt(Math.floor(xx / 5), Math.floor(yy / 4), o.seed) - 0.5) * 0.025;
        put(xx, yy, s);
      }
    // windows: a few lit floor bands across the front plane, a couple of dense clusters
    for (let yy = b.y0 + lip + 2; yy < b.y1 - 1; yy += floor) {
      const band = hashInt(b.x, yy, o.seed + 3) < lit * 2.2;
      const a = b.x + side + 2 + Math.floor(hashInt(yy, 1, o.seed) * (b.w - side) * 0.4);
      const e = b.x + b.w - 2 - Math.floor(hashInt(yy, 2, o.seed) * (b.w - side) * 0.3);
      for (let xx = b.x + 1; xx < b.x + b.w - 1; xx++) {
        const inBand = band && xx >= a && xx < e && hashInt(xx, yy, o.seed + 4) < 0.8;
        const cell = hashInt(Math.floor(xx / (7 * u)), Math.floor(yy / (8 * u)), o.seed + 6) < lit * 0.9;
        const inCluster = cell && (xx & 1) === 0 && hashInt(xx, yy, o.seed + 8) < 0.7;
        if (!inBand && !inCluster) continue;
        pix.set(X(xx), yy, 0.9, pickRow(o.wins, hashInt(xx >> 3, yy, o.seed + 2)), fog ? fog(xx, yy) : 0, true);
      }
    }
    // a cantilevered slab off one tier, carried by a diagonal strut
    if (k < tiers.length - 1 || tiers.length === 1) {
      if (r() < 0.7) {
        const dir = r() < 0.5 ? -1 : 1;
        const reach = Math.round(b.w * (0.18 + r() * 0.28));
        const sy = b.y0 + Math.round(2 * u);
        const st = Math.max(2, Math.round((2 + r() * 3) * u));
        const x0 = dir > 0 ? b.x + b.w : b.x - reach;
        for (let yy = sy; yy < sy + st; yy++)
          for (let xx = x0; xx < x0 + reach; xx++) put(xx, yy, yy === sy ? base + 0.24 : yy === sy + st - 1 ? base - 0.1 : base - 0.02);
        // the strut: from the slab's far end back down to the wall
        const drop = Math.round(reach * 0.8);
        for (let i = 0; i <= reach; i++) {
          const xx = dir > 0 ? b.x + b.w + reach - i : b.x - reach + i;
          const yy = sy + st + Math.round((i / reach) * drop);
          if (yy < b.y1) (put(xx, yy, base - 0.06), put(xx, yy + 1, base - 0.1));
        }
        // a lit row along the slab's face
        for (let xx = x0 + 1; xx < x0 + reach - 1; xx += 2)
          if (st >= 3 && hashInt(xx, sy, o.seed + 9) < 0.5) pix.set(X(xx), sy + 1, 0.9, o.wins.rows[0]!, fog ? fog(xx, sy) : 0, true);
      }
    }
  });
  // roof plant: a squat box and a short vent stack
  const tb = tiers[tiers.length - 1]!;
  const bw = Math.max(3, Math.round(tb.w * (0.25 + r() * 0.3)));
  const bx = tb.x + Math.round((tb.w - bw) * r());
  const bh = Math.max(2, Math.round((3 + r() * 4) * u));
  for (let yy = tb.y0 - bh; yy < tb.y0; yy++) for (let xx = bx; xx < bx + bw; xx++) put(xx, yy, yy === tb.y0 - bh ? base + 0.14 : base - 0.02);
  if (r() < 0.6) {
    const vx = tb.x + Math.round(tb.w * (0.1 + r() * 0.8));
    const vh = Math.round((6 + r() * 10) * u);
    const vw = Math.max(2, Math.round(2 * u));
    for (let yy = tb.y0 - vh; yy < tb.y0; yy++) for (let k = 0; k < vw; k++) put(vx + k, yy, k === vw - 1 ? base + 0.1 : base - 0.04);
  }
  return tb.y0 - bh;
}

/** A row of towers. Returns rooftop points for props (x, y). */
export function city(pix: Pix, ox: number, o: CityOpts): [number, number][] {
  const r = mulberry(o.seed);
  const tops: [number, number][] = [];
  let x = o.x0;
  let i = 0;
  while (x < o.x1) {
    const block = r() < (o.blocky ?? 0);
    const w = Math.round((o.minW + r() * (o.maxW - o.minW)) * (block ? 2.1 : 1));
    const e = o.env ? o.env(x + w / 2) : 1;
    const h = Math.round((o.minH + Math.pow(r(), 1.3) * (o.maxH - o.minH)) * e * (block ? 0.6 : 1));
    if (h > 2 && block) {
      const top = megablock(pix, ox, {
        x,
        w,
        ground: o.ground,
        h,
        row: o.row,
        wins: o.wins,
        seed: o.seed * 97 + i,
        shade: (o.shade ?? 0.22) + (r() - 0.5) * 0.04,
        fog: o.fog,
        u: o.u,
        lit: o.lit,
      });
      tops.push([x + w / 2, top]);
    } else if (h > 2) {
      const top = tower(pix, ox, {
        x,
        w,
        ground: o.ground,
        h,
        row: o.row,
        wins: o.wins,
        seed: o.seed * 97 + i,
        shade: (o.shade ?? 0.22) + (r() - 0.5) * 0.05,
        lit: o.lit,
        gx: o.gx,
        gy: o.gy,
        fog: o.fog,
        tip: o.tip,
        u: o.u,
      });
      tops.push([x + w / 2, top]);
    }
    x += w + Math.round((o.gap ?? 2) * r());
    i++;
  }
  return tops;
}

/**
 * Rim light from the bright opening behind: edges facing the light's x get
 * `side`, top edges get `top`, and a softer second pixel inward.
 */
export function rimToward(pix: Pix, lx: number, side: number, top: number, inner = 0): void {
  const edits: number[] = [];
  for (let y = 0; y < pix.h; y++)
    for (let x = 0; x < pix.w; x++) {
      if (!pix.solid(x, y)) continue;
      const i = (y * pix.w + x) * 4;
      if (pix.data[i + 1]! >= 128) continue;
      const dir = x < lx ? 1 : -1;
      let add = 0;
      if (!pix.solid(x + dir, y)) add += side;
      else if (inner > 0 && !pix.solid(x + 2 * dir, y)) add += inner;
      if (!pix.solid(x, y - 1)) add += top;
      if (add > 0) edits.push(x, y, add);
    }
  for (let k = 0; k < edits.length; k += 3) pix.setShade(edits[k]!, edits[k + 1]!, pix.shadeAt(edits[k]!, edits[k + 1]!) + edits[k + 2]!);
}

/** A straight beam between a and b, width w, with ribs across it and lit long edges. */
export function beam(
  pix: Pix,
  ox: number,
  a: [number, number],
  b: [number, number],
  w: number,
  o: { row: number; shade: number; rib: number; edge?: number; fog?: FogFn; seed: number; truss?: boolean },
): void {
  const [ax, ay] = a;
  const [bx, by] = b;
  const L = Math.hypot(bx - ax, by - ay);
  const dx = (bx - ax) / L;
  const dy = (by - ay) / L;
  const x0 = Math.floor(Math.min(ax, bx) - w);
  const x1 = Math.ceil(Math.max(ax, bx) + w);
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - w));
  const y1 = Math.min(pix.h, Math.ceil(Math.max(ay, by) + w));
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const rx = x + 0.5 - ax;
      const ry = y + 0.5 - ay;
      const al = rx * dx + ry * dy;
      const pe = -dy * rx + dx * ry;
      if (al < 0 || al > L || Math.abs(pe) > w / 2) continue;
      const n = pe / (w / 2);
      let s = o.shade + (hashInt(Math.floor(al / 9), Math.floor(n * 2), o.seed) - 0.5) * 0.04;
      if (o.truss) {
        // open lattice: chords on both edges and a zigzag between them
        const tri = Math.abs(((al / w) % 1) * 2 - 1) * 2 - 1;
        const onChord = Math.abs(n) > 1 - 2.2 / w;
        const onZig = Math.abs(n - tri) * (w / 2) < 0.9;
        if (!onChord && !onZig) continue;
      } else {
        if (al % o.rib < 1.2) s += 0.06;
        if (al % o.rib > o.rib - 1.5) s -= 0.04;
      }
      if (n < -1 + 2.4 / w) s += o.edge ?? 0.14;
      pix.set(x - ox, y, s, o.row, o.fog ? o.fog(x, y) : 0);
    }
}

/**
 * The hammerhead: a massive block tower with an overhanging platform, a side pod
 * and spires. It is modelled in planes, not one flat fill: a shadowed left face,
 * a mid front face, a recessed shaft, a lighter right face and a chamfer that
 * catches the opening's core, with a hard rim on the lit edge. Windows come in
 * lit floor bands and a few dense clusters, the way a real tower's lit floors do.
 */
export function hammerhead(
  pix: Pix,
  ox: number,
  o: { cx: number; ground: number; top: number; u: number; row: number; wins: WinSet; tip: number; seed: number; fog?: FogFn },
): { craneBase: [number, number]; searchBase: [number, number][] } {
  const { cx, ground, top, u, row } = o;
  const X = (x: number): number => Math.round(x - ox);
  const fog = o.fog;
  const put = (x: number, y: number, s: number): void => pix.set(X(x), y, s, row, fog ? fog(x, y) : 0);
  const fill = (x0: number, y0: number, x1: number, y1: number, sh: (x: number, y: number) => number): void => {
    for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) put(x, y, sh(x, y));
  };
  const emit = (x: number, y: number, r: number): void => pix.set(X(x), y, 0.9, r, fog ? fog(x, y) : 0, true);
  const floorH = Math.round(15 * u);
  const bay = Math.round(8 * u);
  // Windows for one plane [x0, x1) between y0 and y1: per floor, a lit band, a cluster, or nearly dark.
  const windows = (x0: number, y0: number, x1: number, y1: number, seed: number, bandP: number, clusterP: number): void => {
    x0 = Math.round(x0);
    x1 = Math.round(x1);
    for (let fy = Math.round(y0); fy + 5 < y1; fy += floorH) {
      const h = hashInt(x0, fy, seed);
      const colour = pickRow(o.wins, hashInt(fy, x0, seed + 1));
      const rowsY = [fy + Math.round(4 * u), fy + Math.round(4 * u) + 3].filter((y) => y < y1 - 1);
      if (rowsY.length === 0) continue;
      if (h < bandP) {
        // a lit floor: a strip across most of the plane, broken by a few dark bays
        const a = x0 + 1 + Math.floor(hashInt(fy, 3, seed) * (x1 - x0) * 0.25);
        const e = x1 - 1 - Math.floor(hashInt(fy, 4, seed) * (x1 - x0) * 0.25);
        const both = hashInt(fy, 5, seed) < 0.5;
        for (const y of both ? rowsY : rowsY.slice(0, 1))
          for (let x = a; x < e; x++) {
            if (hashInt(Math.floor((x - x0) / bay), fy, seed + 2) < 0.22 || (x - x0) % bay === 0) continue;
            if ((x & 1) === 1 && y !== rowsY[0]) continue;
            emit(x, y, colour);
          }
      } else if (h < bandP + clusterP) {
        // a cluster: a few bays lit across two floors
        const cw = Math.round((6 + hashInt(fy, 6, seed) * 10) * u);
        const a = x0 + 2 + Math.floor(hashInt(fy, 7, seed) * Math.max(1, x1 - x0 - cw - 4));
        for (let y = fy + Math.round(3 * u); y < Math.min(y1 - 1, fy + floorH + Math.round(6 * u)); y += 3)
          for (let x = a; x < Math.min(x1 - 1, a + cw); x += 2) if (hashInt(x, y, seed + 3) < 0.78) emit(x, y, colour);
      } else if (hashInt(fy, 9, seed) < 0.5) {
        // an odd lit window or two in a dark floor
        const x = x0 + 2 + Math.floor(hashInt(fy, 8, seed) * Math.max(1, x1 - x0 - 4));
        emit(x, rowsY[0]!, colour);
        emit(x + 2, rowsY[0]!, colour);
      }
    }
  };
  const bodyL = cx - 50 * u;
  const bodyR = cx + 46 * u;
  const slabT = top - 22 * u;
  const leftFace = bodyL + 18 * u;
  const shaftL = cx - 8 * u;
  const shaftR = cx - 2 * u;
  const cham = bodyR - 10 * u;
  // stepped base flaring toward the ground: lit lips, a shadowed left end
  for (let k = 0; k < 4; k++) {
    const y0 = ground - (46 - k * 11) * u;
    const hw = (58 + k * 14) * u;
    const x0 = cx - hw - 4 * u;
    fill(x0, y0, cx + hw, y0 + 11 * u, (x, y) => {
      if (y === Math.round(y0)) return 0.4;
      if (y === Math.round(y0) + 1) return 0.28;
      let s = x < x0 + 16 * u ? 0.1 : x > cx + hw - 8 * u ? 0.27 : 0.17;
      if ((x | 0) % 9 === 0) s += 0.03;
      return s;
    });
  }
  // body planes
  fill(bodyL, top, bodyR, ground - 40 * u, (x, y) => {
    let s: number;
    if (x < leftFace) s = 0.1;
    else if (x < shaftL) s = 0.2;
    else if (x < shaftR) s = x < shaftL + 1 ? 0.02 : 0.06;
    else if (x < cham) s = 0.27;
    else s = 0.37;
    const lx = Math.round(x - bodyL);
    if (x >= leftFace && x < cham && lx % bay === 0) s += 0.03;
    if (x >= leftFace && x < cham && lx % bay === 1) s -= 0.03;
    if ((y - top) % floorH === 0) s += 0.04;
    // rims: a hard one on the lit right edge, a thin one on the left
    const rx = Math.round(bodyR) - 1 - Math.round(x);
    if (rx === 0) s = 0.66;
    else if (rx === 1) s = 0.48;
    if (Math.round(x) === Math.round(bodyL)) s = 0.3;
    if (Math.round(x) === Math.round(leftFace)) s = 0.24;
    return s + (hashInt(Math.floor(x / 4), Math.floor(y / 6), 5) - 0.5) * 0.02;
  });
  windows(leftFace + 1, top + 2 * u, shaftL - 1, ground - 42 * u, o.seed, 0.34, 0.2);
  windows(shaftR + 1, top + 2 * u, cham - 1, ground - 42 * u, o.seed + 5, 0.4, 0.22);
  windows(bodyL + 2, top + 2 * u, leftFace - 1, ground - 42 * u, o.seed + 13, 0.12, 0.12);
  // the platform slab: overhangs both sides, lit top, a lighter upper band, a
  // darker lower band, a chamfered underside and a lit right end cap
  const slabL = cx - 66 * u;
  const slabR = cx + 72 * u;
  const upper = slabT + 12 * u;
  fill(slabL, slabT, slabR, top + 6 * u, (x, y) => {
    const under = y - top;
    const ch = under > 0 && (x < slabL + under * 2 || x > slabR - under * 2);
    if (ch) return -1;
    if (y === Math.round(slabT)) return 0.72;
    if (y === Math.round(slabT) + 1) return 0.46;
    let s = y < upper ? 0.28 : y < top ? 0.19 : 0.09;
    if (x > slabR - 7 * u) s += 0.1;
    if (x < slabL + 5 * u) s -= 0.06;
    if (Math.round(x) === Math.round(slabR) - 1) s = 0.6;
    if ((y - slabT) % Math.round(7 * u) === 0) s += 0.03;
    return s;
  });
  for (let y = Math.round(top); y < Math.round(top + 6 * u); y++)
    for (let x = Math.round(slabL); x < Math.round(slabR); x++) {
      const under = y - top;
      if (under > 0 && (x < slabL + under * 2 || x > slabR - under * 2) && (x < bodyL || x >= bodyR)) pix.clear(X(x), y);
    }
  // two lit bands along the slab face, broken into runs
  for (const [y, seed] of [
    [Math.round(slabT + 6 * u), o.seed + 9],
    [Math.round(slabT + 16 * u), o.seed + 10],
  ] as const) {
    const colour = pickRow(o.wins, hashInt(y, 1, seed));
    for (let x = Math.round(slabL + 4); x < slabR - 4; x++) {
      if (hashInt(Math.floor(x / Math.round(12 * u)), y, seed) < 0.35 || (x & 1) === 1) continue;
      emit(x, y, colour);
    }
  }
  // the side pod on the left: rises above the slab and hangs below it
  const podL = slabL - 22 * u;
  const podR = slabL - 2 * u;
  const podT = slabT - 38 * u;
  const podSplit = podL + 8 * u;
  fill(podL, podT, podR, top + 58 * u, (x, y) => {
    if (y === Math.round(podT)) return 0.56;
    if (y === Math.round(podT) + 1) return 0.34;
    let s = x < podSplit ? 0.1 : 0.22;
    if (Math.round(x) === Math.round(podR) - 1) s = 0.5;
    if (Math.round(x) === Math.round(podSplit)) s = 0.28;
    if ((y - podT) % Math.round(11 * u) === 0) s += 0.04;
    return s;
  });
  windows(podSplit + 1, podT + 2 * u, podR - 1, top + 56 * u, o.seed + 11, 0.3, 0.2);
  // a bridge from the pod to the slab
  fill(podR, slabT + 4 * u, slabL + 1, slabT + 8 * u, (_x, y) => (y === Math.round(slabT + 4 * u) ? 0.36 : 0.16));
  // roof: blocks and spires (lit on the right), antennas with lamp tips
  fill(cx - 20 * u, slabT - 9 * u, cx + 4 * u, slabT, (x, y) => (y === Math.round(slabT - 9 * u) ? 0.44 : x > cx + 1 * u ? 0.32 : 0.18));
  fill(cx + 30 * u, slabT - 6 * u, cx + 54 * u, slabT, (x, y) => (y === Math.round(slabT - 6 * u) ? 0.42 : x > cx + 50 * u ? 0.34 : 0.19));
  const spire = (sx: number, h: number, w: number): void => {
    for (let y = Math.round(slabT - h); y < slabT; y++) {
      const t = (y - (slabT - h)) / h;
      const hw = Math.max(0.5, w * Math.min(1, t * 1.6));
      for (let x = Math.round(sx - hw); x < sx + hw; x++) put(x, y, x >= sx ? 0.34 : 0.14);
    }
    pix.set(X(sx), Math.round(slabT - h) - 1, 0.9, o.tip, 0, true);
  };
  spire(cx + 12 * u, 30 * u, 3 * u);
  spire(cx + 42 * u, 22 * u, 2.5 * u);
  spire(podL + 10 * u, 62 * u, 3 * u);
  spire(cx + 62 * u, 14 * u, 2 * u);
  return {
    craneBase: [cx - 10 * u, slabT - 9 * u],
    searchBase: [
      [cx - 60 * u, ground - 46 * u],
      [cx + 40 * u, ground - 46 * u],
    ],
  };
}

/** Rows of 1 px catenary cables between points (sagging), for ceilings and cranes. */
export function cable(pix: Pix, ox: number, a: [number, number], b: [number, number], sag: number, row: number, shade: number, fog?: FogFn): void {
  const n = Math.ceil(Math.abs(b[0] - a[0])) + 1;
  let py = -1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(a[0] + (b[0] - a[0]) * t);
    const y = Math.round(a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t));
    const y0 = py < 0 ? y : Math.min(py, y);
    const y1 = py < 0 ? y : Math.max(py, y);
    for (let yy = y0; yy <= y1; yy++) pix.set(x - ox, yy, shade, row, fog ? fog(x, yy) : 0);
    py = y;
  }
}

/** The hollow's ceiling: an inverted skyline of hanging masses, pipes, lamps and cables. */
export function ceiling(pix: Pix, ox: number, o: { x0: number; x1: number; u: number; H: number; row: number; lamp: number; seed: number; fog?: FogFn }): void {
  const r = mulberry(o.seed);
  const { u, H, row } = o;
  const fog = o.fog;
  const put = (x: number, y: number, s: number): void => pix.set(Math.round(x - ox), Math.round(y), s, row, fog ? fog(x, y) : 0);
  // the slab itself: a ragged underside
  for (let x = Math.floor(o.x0); x < o.x1; x++) {
    const bot = H * 0.035 + fbm1(x / (60 * u), o.seed, 3) * H * 0.05 + Math.floor(fbm1(x / (18 * u), o.seed + 1, 2) * 3) * 3 * u;
    for (let y = 0; y < bot; y++) put(x, y, 0.1 + (y > bot - 2 ? 0.14 : 0) + (hashInt(Math.floor(x / 6), Math.floor(y / 4), 3) - 0.5) * 0.03);
  }
  // hanging masses
  let x = o.x0;
  while (x < o.x1) {
    const w = Math.round((10 + r() * 46) * u);
    if (r() < 0.55) {
      const h = Math.round(H * (0.05 + Math.pow(r(), 2) * 0.12));
      // three planes: a shadowed left face, the front, a lit right edge; a lit underside lip
      const side = Math.round(w * (0.25 + r() * 0.15));
      for (let yy = 0; yy < h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          const lx = xx - x;
          let s = lx < side ? 0.07 : 0.14;
          if (lx === side) s = 0.19;
          if (lx >= w - Math.max(1, Math.round(u))) s = 0.24;
          if (yy === h - 1) s = 0.3;
          else if (yy === h - 2) s += 0.06;
          if (lx > side && lx % Math.round(6 * u) === 0) s += 0.03;
          put(xx, yy, s);
        }
      // lamps under it
      if (r() < 0.6) {
        const lx = x + Math.round(w * (0.2 + r() * 0.6));
        pix.set(Math.round(lx - ox), h, 0.9, o.lamp, fog ? fog(lx, h) : 0, true);
        pix.set(Math.round(lx - ox) + 1, h, 0.9, o.lamp, fog ? fog(lx, h) : 0, true);
      }
    }
    x += w + Math.round(r() * 20 * u);
  }
  // hanging pipes and cables
  for (let i = 0; i < Math.round((o.x1 - o.x0) / (14 * u)); i++) {
    const px = o.x0 + r() * (o.x1 - o.x0);
    const len = H * (0.06 + Math.pow(r(), 1.8) * 0.26);
    const w = r() < 0.3 ? 2 : 1;
    for (let y = 0; y < len; y++) for (let k = 0; k < w; k++) put(px + k, y, 0.14 + (k === 0 ? 0.04 : 0));
    if (r() < 0.35) {
      // a lamp or a weight at the end
      const lx = Math.round(px);
      if (r() < 0.5) pix.set(Math.round(lx - ox), Math.round(len), 0.9, o.lamp, fog ? fog(lx, len) : 0, true);
      else for (let y = Math.round(len); y < len + 3 * u; y++) for (let k = -1; k <= w; k++) put(lx + k, y, 0.16);
    }
  }
  for (let i = 0; i < Math.round((o.x1 - o.x0) / (70 * u)); i++) {
    const ax = o.x0 + r() * (o.x1 - o.x0);
    const bx = ax + (30 + r() * 90) * u;
    cable(pix, ox, [ax, H * 0.05], [bx, H * (0.04 + r() * 0.04)], H * (0.03 + r() * 0.08), row, 0.13, fog);
  }
}
