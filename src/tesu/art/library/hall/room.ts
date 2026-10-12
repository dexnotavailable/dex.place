// The Hall of Works' play-plane structure: the raised timber walkway the whole floor runs
// along (its lacquered edge is the walk line) over the darker stone floor nearer us; the
// massive end walls with the door walls built into them; the Long Gallery's floor beam on its
// posts and brackets, with its vermilion balustrade (front plane, she walks behind it); the
// stair down to the great doors with its rail (front plane) and the nook under it; the
// central pillar that carries the map. Everything takes the hall's light from lights.ts.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, LitField, clamp, cyl, fbm, grain, hash, keep, lathe, lum, mt, poly, rect, tn, vnoise, type At } from "./kit.ts";

const H = 96;

// ---------------------------------------------------------------------------
// The walkway's edge and the floor nearer us
// ---------------------------------------------------------------------------
export interface FloorP {
  /** Length (px); the anchor is its west end on the walk line. */
  w: number;
  /** How far down it runs (px). */
  below: number;
  /** Gold caps along the edge (local x). */
  caps: number[];
  at?: At;
}

export const hallFloor = definePainter<FloorP>("hall.floor", {
  bounds(p) {
    return [0, -2, p.w, p.below];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const NOSE = 12, FACE = 44;
    rect(c, 0, -1, p.w, p.below, (X, Y, lx, ly) => {
      const l = lf.get(lx, Math.min(ly, 0) - 20);
      if (ly < NOSE) {
        // the lacquered edge beam: a lit lip where the light grazes it, scuffed
        const cap = p.caps.some((cx) => Math.abs(lx - cx) < 9);
        if (cap) return mt(M.gold, lum(l, 0, ly < 3 ? -0.9 : 0) * 1.1 - (ly > 9 ? 0.3 : 0), X, Y, 0.05, 1);
        if (ly < 2) return mt(M.wood, lum(l, 0, -1) * 1.25, X, Y, 0.0, 1);
        const scuff = vnoise(lx * 0.15, ly * 0.6, 5) > 0.7 ? 0.12 : 0;
        return mt(M.lacq, lum(l) * 0.75 + scuff - (ly > 9 ? 0.2 : 0), X, Y, 0.05, 1);
      }
      if (ly < FACE) {
        // the walkway's face: panels with a gold-line inset, in the shadow of the lip
        const pw = 2 * H;
        const u = ((lx % pw) + pw) % pw;
        const inPanel = u > 8 && u < pw - 8 && ly > NOSE + 6 && ly < FACE - 6;
        const line = inPanel && (Math.abs(u - 12) < 1 || Math.abs(u - (pw - 12)) < 1 || Math.abs(ly - NOSE - 10) < 0.7 || Math.abs(ly - FACE + 10) < 0.7);
        const shadow = ly < NOSE + 5 ? 0.25 : 0;
        if (line) return mt(M.gold, lum(l) * 0.5 - shadow, X, Y, 0.3, 1);
        if (!inPanel) return mt(M.wood, lum(l) * 0.45 - shadow, X, Y, 0.35, 1);
        return mt(M.lacq, lum(l) * 0.55 - shadow + grain(lx, ly, 3, false) * 0.08, X, Y, 0.1, 1);
      }
      // the stone floor nearer us: big flags, their joints opening out toward the camera,
      // darker with distance from the lights, a lantern's warmth caught in the polish
      const depth = (ly - FACE) / H;
      const row = Math.floor(Math.sqrt(depth * 9));
      const rowTop = (row * row) / 9;
      const fw = (1.6 + row * 0.5) * H;
      const off = (row % 2) * fw * 0.5;
      const joint = depth - rowTop < 0.025 + row * 0.006 || (((lx + off) % fw) + fw) % fw < 1.2 + row * 0.4;
      const lf2 = lf.get(lx, -20);
      const gleam = vnoise(lx * 0.03, depth * 2, 9) * 0.15;
      const lit = lum(lf2) * (0.42 - depth * 0.05) + gleam - (joint ? 0.15 : 0) - (ly < FACE + 4 ? 0.2 : 0);
      return mt(M.stone, lit, X, Y, 0.62, 1, 0.5);
    });
  },
});

// ---------------------------------------------------------------------------
// The end walls: a door wall right behind the walk line, built into the room's thick end
// ---------------------------------------------------------------------------
export interface EndWallP {
  /** -1: the west end (front doors), 1: the east end (great doors). */
  side: -1 | 1;
  /** The room's end (local x 0 is the end wall line); the door wall runs from the end inward `wall` px. */
  wall: number;
  /** The doors: local x of their near jamb (from the end) and width, height (px). */
  doorAt: number;
  doorW: number;
  doorH: number;
  /** How tall the door wall stands (px) and how far out the end's mass runs (px). */
  top: number;
  out: number;
  /** Daylight behind the doors (0..1). */
  day: number;
  great?: boolean;
  at?: At;
}

export const endWall = definePainter<EndWallP>("hall.endwall", {
  bounds(p) {
    const a = p.side < 0 ? -p.out : -p.wall - 40;
    const b = p.side < 0 ? p.wall + 40 : p.out;
    return [a, -20 * H, b, 6 * H];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const s = p.side;
    // local x measured from the end wall line, positive into the room
    const inx = (lx: number): number => lx * -s;
    // the end's mass beyond the room: a thick plastered wall in shadow, its timber frame showing
    rect(c, s < 0 ? -p.out : 0, -20 * H, s < 0 ? 0 : p.out, 6 * H, (X, Y, lx, ly) => {
      const d = -inx(lx); // distance beyond the end, px
      const l = lf.get(s < 0 ? -10 : 10, Math.min(ly, -20));
      const post = ((d % (2.2 * H)) + 2.2 * H) % (2.2 * H) < 0.32 * H;
      const beam = ((((-ly) % (3.1 * H)) + 3.1 * H) % (3.1 * H)) < 0.26 * H;
      const near = clamp(1 - d / (1.6 * H), 0, 1);
      const plaster = fbm(lx * 0.05, ly * 0.05, 31, 3);
      if (ly > 0) return tn(M.dark, 0.88, X, Y, 0.4);
      if (post || beam) return mt(M.lacq, lum(l) * near * 0.6, X, Y, 0.35, 1);
      return mt(M.dark, lum(l) * near * 0.5 + (plaster - 0.5) * 0.12, X, Y, 0.45, 1);
    });
    // the corner column at the room's end: vermilion, lit by the doors' daylight
    const colR = 0.3 * H;
    const ccx = -s * colR * 0.6;
    const cside = clamp(lf.get(ccx, -2 * H).dx * 1.6, -1, 1);
    lathe(c, ccx, -20 * H, 0, (ly) => (ly > -0.9 * H ? colR * 1.22 : colR), (X, Y, u, _lx, ly) => {
      const l = lf.get(ccx, ly);
      const hgt = -ly / H;
      const n = cyl(l.k, u, cside, 0.1);
      if (hgt < 0.9) return mt(M.stone, n * 0.85 + (hgt > 0.82 ? 0.15 : 0), X, Y, 0.3, 1);
      const band = (hgt > 1.0 && hgt < 1.2) || (hgt > 6.6 && hgt < 6.8);
      return band ? mt(M.gold, n * 0.9, X, Y, 0.2, 1) : mt(M.verm, n * 0.75, X, Y, 0.25, 1);
    });
    // the door wall: lacquer panels framed in timber, the doors set deep in it
    const dx0 = Math.min(inx(p.doorAt), inx(p.doorAt + p.doorW)) * 1, dx1 = Math.max(inx(p.doorAt), inx(p.doorAt + p.doorW));
    const w0 = Math.min(0, -s * p.wall), w1 = Math.max(0, -s * p.wall);
    const surround = 0.38 * H;
    rect(c, w0, -p.top, w1, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const inDoor = lx > dx0 - surround && lx < dx1 + surround && ly > -p.doorH - surround * 1.4;
      if (inDoor) return 0;
      const pu = ((lx % (0.95 * H)) + 0.95 * H) % (0.95 * H), pv = ((ly % (1.25 * H)) + 1.25 * H) % (1.25 * H);
      const frame = pu < 0.1 * H || pv < 0.1 * H;
      const skirt = ly > -0.45 * H;
      if (skirt) return mt(M.stone, lum(l) * (ly < -0.42 * H ? 1.2 : 0.75), X, Y, 0.25, 1);
      if (frame) return mt(M.wood, lum(l, pu < 0.05 * H ? -0.6 : 0, pv < 0.05 * H ? -0.6 : 0) * 0.8, X, Y, 0.25, 1);
      return mt(M.lacq, lum(l) * 0.8 + grain(lx, ly, 13) * 0.1, X, Y, 0.1, 1);
    });
    // the doorway: a stone threshold and step, carved jambs, a lintel with a plaque, the transom
    doorway(c, p, dx0, dx1, surround, lf);
  },
});

function doorway(c: PaintCtx, p: EndWallP, dx0: number, dx1: number, sr: number, lf: LitField): void {
  const dh = p.doorH;
  const cx = (dx0 + dx1) / 2;
  // jambs: carved timber posts with gold-leaf vine, a stone pedestal each
  for (const jx of [dx0 - sr, dx1]) {
    rect(c, jx, -dh, jx + sr, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - jx) / sr;
      if (ly > -0.75 * H) {
        const top = ly < -0.7 * H;
        const carve = Math.hypot(u - 0.5, (ly + 0.35 * H) / H * 1.4) < 0.28;
        return mt(M.stone, lum(l, (u - 0.5) * 1.2, top ? -0.8 : 0) * (carve ? 0.75 : 1) + 0.05, X, Y, 0.1, 1);
      }
      const vine = u > 0.25 && u < 0.75 && Math.sin(ly * 0.25 + Math.sin(ly * 0.07) * 3) * 0.5 + 0.5 > Math.abs(u - 0.5) * 2.6;
      if (vine) return mt(M.gold, lum(l, (u - 0.5), 0) * 0.85, X, Y, 0.15, 1);
      return mt(M.wood, lum(l, (u - 0.5) * 1.4, 0) * 0.7, X, Y, 0.25, 1);
    });
  }
  // the lintel and its plaque
  const ly0 = -dh - sr * 1.4, ly1 = -dh;
  rect(c, dx0 - sr * 1.25, ly0, dx1 + sr * 1.25, ly1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - ly0) / (ly1 - ly0);
    if (v < 0.14) return mt(M.gold, lum(l, 0, -0.9) * 0.95, X, Y, 0.1, 1);
    const pw = (dx1 - dx0) * 0.42;
    const inPlaque = Math.abs(lx - cx) < pw / 2 && v > 0.26 && v < 0.86;
    if (inPlaque) {
      const e = Math.min(pw / 2 - Math.abs(lx - cx), (Math.min(v - 0.26, 0.86 - v)) * (ly1 - ly0));
      if (e < 3) return mt(M.gold, lum(l) * 0.95, X, Y, 0.1, 1);
      // three gold characters as strokes (no readable text)
      const k = (lx - (cx - pw / 2)) / pw * 3;
      const ci = Math.floor(k), cu = k - ci, cv = (v - 0.26) / 0.6;
      const st = Math.abs(cv - 0.5) < 0.08 || Math.abs(cu - 0.5) < 0.07 || (hash(ci, 2, 5) > 0.5 && Math.abs(cu + cv - 1) < 0.08);
      if (st && cu > 0.15 && cu < 0.85 && cv > 0.15 && cv < 0.85) return mt(M.gold, lum(l) * 1.1, X, Y, 0.05, 1);
      return mt(M.lacq, lum(l) * 0.4, X, Y, 0.3, 1);
    }
    return mt(M.verm, lum(l) * 0.7 + (Math.sin(lx * 0.4) > 0.7 ? 0.1 : 0), X, Y, 0.3, 1);
  });
  // the doors themselves: studded leaves (vermilion), gold lion-head rings, daylight in the seam
  const g = p.great ? 1 : 0.85;
  rect(c, dx0, -dh, dx1, 0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const u = (lx - dx0) / (dx1 - dx0), v = (ly + dh) / dh;
    const seam = Math.abs(u - 0.5) < 0.012 + 0.004 * p.day;
    if (seam) return keep(X, Y, 0.35 + 0.4 * p.day * v) ? tn(M.paper, 0.15 + 0.35 * (1 - v), X, Y, 0.4) : mt(M.verm, lum(l) * 0.3, X, Y, 0.4, 1);
    const leaf = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
    const edge = leaf < 0.035 || leaf > 0.965 || v < 0.02;
    if (edge) return mt(M.verm, lum(l, leaf < 0.5 ? -0.6 : 0.6, 0) * 0.55, X, Y, 0.4, 1);
    // studs in rows
    const sr2 = 0.032 * H * g;
    const gx = ((leaf * (dx1 - dx0) / 2) % (0.3 * H)) - 0.15 * H, gy = ((v * dh) % (0.36 * H)) - 0.18 * H;
    const sd = Math.hypot(gx, gy);
    if (v > 0.06 && v < 0.94 && leaf > 0.1 && leaf < 0.9 && sd < sr2) return mt(M.gold, lum(l, gx / sr2 * 0.7, gy / sr2 * 0.7) * 0.8, X, Y, 0.2, 1);
    // the lion-head rings near the seam
    const rx = u < 0.5 ? 0.43 : 0.57, ry = 0.52;
    const rd = Math.hypot((u - rx) * (dx1 - dx0), (v - ry) * dh);
    if (rd < 0.15 * H * g && rd > 0.11 * H * g && v > ry) return mt(M.gold, lum(l, (u - rx) * 4, 0.3) * 1.0, X, Y, 0.05, 1);
    if (Math.hypot((u - rx) * (dx1 - dx0), (v - ry + 0.04) * dh) < 0.12 * H * g) return mt(M.bronze, lum(l, (u - rx) * 3, (v - ry) * 3) * 1.0, X, Y, 0.1, 1);
    // the lacquer, worn paler round the rings and along the foot, daylight under the leaves
    const worn = (Math.abs(v - 0.5) < 0.12 ? 0.08 : 0) + (v > 0.92 ? 0.1 : 0);
    const under = v > 0.985 && p.day > 0 ? 0.6 : 0;
    if (under) return keep(X, Y, 0.6) ? tn(M.paper, 0.2, X, Y, 0) : mt(M.verm, lum(l) * 0.4, X, Y, 0.4, 1);
    return mt(M.verm, lum(l) * 0.72 + worn + grain(lx, ly, 17) * 0.08, X, Y, 0.25, 1);
  });
  // the stone threshold and a step out onto the walkway
  rect(c, dx0 - sr * 1.1, -0.14 * H, dx1 + sr * 1.1, 0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    return mt(M.stone, lum(l, 0, ly < -0.11 * H ? -0.9 : 0) * (ly < -0.11 * H ? 1.25 : 0.85), X, Y, 0.15, 1);
  });
  // the transom over the lintel: a lattice glowing with the day outside
  const ty0 = ly0 - 0.62 * H, ty1 = ly0;
  rect(c, dx0 - sr, ty0, dx1 + sr, ty1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const u = (lx - dx0 + sr) / (dx1 - dx0 + 2 * sr), v = (ly - ty0) / (ty1 - ty0);
    if (u < 0.03 || u > 0.97 || v < 0.08 || v > 0.92) return mt(M.wood, lum(l) * 0.8, X, Y, 0.2, 1);
    const s = 0.16 * H;
    const gx = (((lx - dx0) % s) + s) % s, gy = (((ly - ty0) % (s * 0.8)) + s * 0.8) % (s * 0.8);
    const off = Math.floor((ly - ty0) / (s * 0.8)) % 2 ? s / 2 : 0;
    const gx2 = (((lx - dx0 + off) % s) + s) % s;
    if (gy < 0.025 * H || gx2 < 0.025 * H) return mt(M.wood, lum(l) * 0.5, X, Y, 0.45, 1);
    return tn(M.paper, clamp(0.5 + 0.3 * (1 - p.day) + 0.25 * v + (gx < 0 ? 0 : 0), 0, 1), X, Y, 0.55);
  });
}

// ---------------------------------------------------------------------------
// The Long Gallery: its floor beam on posts and brackets; the balustrade (front plane)
// ---------------------------------------------------------------------------
export interface GalleryP {
  w: number;
  /** Depth of the floor beam (px). */
  depth: number;
  /** Posts down to the floor (local x) and the floor's drop to the walkway below (px). */
  posts: number[];
  drop: number;
  /** Where the map pillar passes through (local x, its half width). */
  pillar: [number, number];
  at?: At;
}

export const gallery = definePainter<GalleryP>("hall.gallery", {
  bounds(p) {
    return [-30, -6, p.w + 30, p.drop + 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const D = p.depth;
    // posts first (they stand behind the beam's brackets)
    for (const px of p.posts) post(c, px, p.drop, D, lf);
    // the beam: a lit nosing, the carved fascia, a dark soffit edge under it
    rect(c, 0, 0, p.w, D, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      if (Math.abs(lx - p.pillar[0]) < p.pillar[1] - 2) return 0;
      if (ly < 3) return mt(M.wood, lum(l, 0, -1) * 1.15, X, Y, 0.05, 1);
      if (ly < 9) return mt(M.verm, lum(l) * 0.75, X, Y, 0.3, 1);
      if (ly > D - 6) return mt(M.lacq, lum(l) * 0.35, X, Y, 0.3, 1);
      // gold medallions on the fascia, between them a gold vine
      const pitch = 1.65 * H;
      const m = ((lx % pitch) + pitch) % pitch - pitch / 2;
      const cy = (D + 6) / 2;
      const d = Math.hypot(m * 0.85, ly - cy);
      if (d < 0.13 * H) {
        const ring = d > 0.1 * H;
        const petal = Math.sin(Math.atan2(ly - cy, m) * 8) > 0.1;
        return mt(M.gold, lum(l, m / (0.3 * H), (ly - cy) / (0.3 * H)) * (ring ? 0.85 : petal ? 0.7 : 0.45), X, Y, 0.2, 1);
      }
      const vine = Math.abs(ly - cy - Math.sin(lx * 0.07) * 5) < 0.8 / c.d && Math.abs(m) > 0.2 * H;
      if (vine) return mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1);
      return mt(M.lacq, lum(l) * 0.7 + grain(lx, ly, 19, false) * 0.08, X, Y, 0.05, 1);
    });
  },
});

function post(c: PaintCtx, px: number, drop: number, D: number, lf: LitField): void {
  const r = 0.2 * H;
  const side = clamp(lf.get(px, drop * 0.5).dx * 1.6, -1, 1);
  lathe(c, px, D - 4, drop, (ly) => (ly > drop - 0.55 * H ? r * 1.35 : r), (X, Y, u, lx, ly) => {
    const l = lf.get(px, ly);
    const fromFloor = (drop - ly) / H;
    const n = cyl(l.k, u, side, 0.1);
    if (fromFloor < 0.55) return mt(M.stone, n * 0.85 + (fromFloor > 0.5 ? 0.15 : 0) + (fbm(lx * 0.4, ly * 0.4, 3, 2) > 0.72 ? -0.1 : 0), X, Y, 0.3, 1);
    const band = (fromFloor > 0.6 && fromFloor < 0.74) || ly < D + 0.2 * H;
    if (band) return mt(M.gold, n * 0.9, X, Y, 0.2, 1);
    return mt(M.verm, n * 0.78 - (fromFloor < 1.3 ? vnoise(lx * 0.5, ly * 0.2, 2) * 0.08 : 0), X, Y, 0.25, 1);
  });
  // the post's head: a gold-carved bearing block wider than the post, and a short curled
  // corbel either side carrying the beam (dark timber, gold-edged)
  const capW = r * 1.9, capH = 0.2 * H;
  rect(c, px - capW, D, px + capW, D + capH, (X, Y, lx, ly) => {
    const l = lf.get(px, ly);
    const u = (lx - px) / capW, v = (ly - D) / capH;
    const flute = Math.sin(u * 14) > 0.4 && v > 0.25 && v < 0.8;
    return mt(M.gold, cyl(l.k, u, side) * (flute ? 0.65 : 0.9) + (v < 0.15 ? 0.1 : 0), X, Y, 0.2, 1);
  });
  for (const s2 of [-1, 1]) {
    const len = 0.46 * H, dep = 0.3 * H;
    const pts: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(px + s2 * (capW + len * t), D + capH * 0.1);
    }
    for (let i = 14; i >= 0; i--) {
      const t = i / 14;
      // the underside: a quarter curve up to the tip, ending in a small curl
      const yy = D + capH * 0.1 + dep * Math.pow(1 - t, 0.7) + (t > 0.85 ? Math.sin(((t - 0.85) / 0.15) * Math.PI) * 0.06 * H : 0);
      pts.push(px + s2 * (capW * 0.6 + (len + capW * 0.4) * t), yy);
    }
    poly(c, pts, (X, Y, lx, ly) => {
      const l = lf.get(px, ly);
      const k = (Math.abs(lx - px) - capW * 0.6) / (len + capW * 0.4);
      const under = D + capH * 0.1 + dep * Math.pow(Math.max(0, 1 - k), 0.7);
      const e = Math.min(ly - D - capH * 0.1, under - ly);
      if (e < 1.5) return mt(M.gold, l.k * 0.75, X, Y, 0.3, 1);
      const curl = Math.hypot(k - 0.82, (ly - D) / H * 3 - 0.35) < 0.12;
      return curl ? mt(M.gold, l.k * 0.6, X, Y, 0.3, 1) : mt(M.lacq, cyl(l.k, s2 * 0.4, side) * 0.7, X, Y, 0.1, 1);
    });
  }
}

export interface RailP {
  w: number;
  h: number;
  at?: At;
}

/** The gallery's balustrade (front plane: she walks behind it): posts with gold caps, a lattice band she shows through. */
export const balustrade = definePainter<RailP>("hall.balustrade", {
  bounds(p) {
    return [-8, -p.h - 14, p.w + 8, 2];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const pitch = 1.08 * H;
    const n = Math.max(1, Math.round(p.w / pitch));
    const step = p.w / n;
    rect(c, 0, -p.h, p.w, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const v = (ly + p.h) / p.h;
      const k = ((lx % step) + step) % step;
      const postW = 9;
      if (k < postW || lx > p.w - postW) return mt(M.verm, lum(l, k < postW / 2 ? -0.6 : 0.5, 0) * 0.9, X, Y, 0.15, 1);
      if (v < 0.12) return mt(M.verm, lum(l, 0, v < 0.05 ? -0.9 : 0.2) * 1.0, X, Y, 0.15, 1);
      if (v > 0.38 && v < 0.46) return mt(M.verm, lum(l) * 0.8, X, Y, 0.25, 1);
      if (v > 0.9) return mt(M.verm, lum(l) * 0.7, X, Y, 0.3, 1);
      if (v > 0.46 && v < 0.9) {
        // an open fret: thin bars, mostly air, so she stays readable behind it
        const s = 0.22 * H;
        const a = (((lx - k + 2 * postW) % s) + s) % s;
        const mid = Math.abs(v - 0.68) < 0.025;
        if (a < 2 || mid) return mt(M.verm, lum(l) * 0.7, X, Y, 0.3, 1);
        // little carved cloud knots in the middle of each span
        const ku = k - step / 2;
        if (Math.hypot(ku, (v - 0.68) * p.h) < 6) return mt(M.gold, lum(l) * 0.9, X, Y, 0.1, 1);
      }
      return 0;
    });
    // gold caps on the posts
    for (let i = 0; i <= n; i++) {
      const cx = Math.min(i * step + 4.5, p.w - 4.5);
      lathe(c, cx, -p.h - 13, -p.h + 1, (ly) => {
        const t = (ly + p.h + 13) / 14;
        return t < 0.15 ? 1.5 : t < 0.7 ? 3 + 2 * Math.sin(t * Math.PI) : 4.6;
      }, (X, Y, u, lx, ly) => mt(M.gold, lum(lf.get(lx, ly), u * 0.9, -0.3) * 1.05, X, Y, 0.05, 1));
    }
  },
});

// ---------------------------------------------------------------------------
// The stair: stringer, treads and underside (play plane); the rail (front plane)
// ---------------------------------------------------------------------------
export interface StairP {
  dx: number;
  dy: number;
  /** Depth of the stringer below the treads (px). */
  depth: number;
  rail?: boolean;
  at?: At;
}

export const stair = definePainter<StairP>("hall.stair", {
  bounds(p) {
    return [-12, -(p.rail ? 80 : 14), p.dx + 12, p.dy + p.depth + 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 12);
    const n = Math.max(4, Math.round(p.dy / 21));
    const run = p.dx / n, rise = p.dy / n;
    const slope = p.dy / p.dx;
    if (p.rail) {
      // the near rail: a vermilion handrail on posts, open balusters, gold knobs at the ends
      const top = 66;
      rect(c, -8, -top - 12, p.dx + 8, p.dy, (X, Y, lx, ly) => {
        const base = lx * slope; // the treads' line here
        const above = base - ly;
        if (above < 0 || above > top + 6) return 0;
        const l = lf.get(lx, ly);
        const k = ((lx % (run * 2)) + run * 2) % (run * 2);
        if (above > top - 7) return mt(M.verm, lum(l, 0, above > top - 2 ? -0.8 : 0.2) * 0.95, X, Y, 0.15, 1);
        if (above > top - 24 && above < top - 20) return mt(M.verm, lum(l) * 0.7, X, Y, 0.3, 1);
        if (k < 3.5) return mt(M.verm, lum(l, -0.4, 0) * 0.75, X, Y, 0.25, 1);
        return 0;
      });
      for (const [ex, ey] of [[0, 0], [p.dx, p.dy]] as const) {
        lathe(c, ex, ey - top - 14, ey, (ly) => (ly < ey - top - 4 ? 4.5 : 3.2), (X, Y, u, lx, ly) => (ly < ey - top - 4 ? mt(M.gold, lum(lf.get(lx, ly), u, -0.3) * 1.05, X, Y, 0.05, 1) : mt(M.verm, lum(lf.get(lx, ly), u, 0) * 0.85, X, Y, 0.15, 1)));
      }
      return;
    }
    // treads: each a lit nosing over a darker riser
    for (let i = 0; i < n; i++) {
      const x0 = run * i, y0 = rise * (i + 1);
      rect(c, x0 - 1, y0 - rise, x0 + run + 1, y0 + 2, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        if (ly > y0 - 3 && ly < y0 + 2) return mt(M.wood, lum(l, 0, -0.9) * 1.1, X, Y, 0.05, 1);
        if (lx < x0 + 4 && ly > y0 - rise) return mt(M.wood, lum(l, -0.5, 0) * 0.6, X, Y, 0.25, 1);
        return 0;
      });
    }
    // the stringer: a deep lacquered board along the slope, gold-edged
    const D = p.depth;
    rect(c, -2, 0, p.dx + 2, p.dy + D, (X, Y, lx, ly) => {
      const base = lx * slope; // the treads' line
      const t = ly - base;
      const stepTop = rise * (Math.floor(lx / run) + 1);
      if (ly < stepTop + 2 && t < 6) return 0; // leave the treads
      if (t < 2 || t > D + 6) return 0;
      const l = lf.get(lx, ly);
      if (t < 8) return mt(M.verm, lum(l, 0, -0.6) * 0.95, X, Y, 0.2, 1);
      if (Math.abs(t - 11) < 1) return mt(M.gold, lum(l) * 0.8, X, Y, 0.2, 1);
      if (t > D) {
        // the underside: boards seen from below (the nook's ceiling), dark
        const board = ((lx % 18) + 18) % 18 < 1.5;
        return mt(M.wood, lum(l) * (board ? 0.2 : 0.38), X, Y, 0.4, 1);
      }
      return mt(M.lacq, lum(l) * 0.7 + grain(lx - ly * 1.1, ly, 21, false) * 0.08, X, Y, 0.1, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// The central pillar with the land's map rolled on its cord
// ---------------------------------------------------------------------------
export interface PillarP {
  /** Radius (px), height above the floor (px). */
  r: number;
  h: number;
  /** Where the gallery's beam wraps it (px above the floor) and how deep. */
  beam: [number, number];
  at?: At;
}

export const pillar = definePainter<PillarP>("hall.pillar", {
  bounds(p) {
    return [-p.r * 1.6 - 40, -p.h, p.r * 1.6 + 40, 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 10);
    const R = p.r;
    const baseH = 1.05 * H;
    // the carved stone base: a lotus drum, a lion's face in relief, chipped and dusty
    const bside = clamp(lf.get(0, -0.5 * H).dx * 1.6, -1, 1);
    lathe(c, 0, -baseH, 0, (ly) => {
      const t = (ly + baseH) / baseH;
      return R * (1.3 + 0.12 * Math.sin(t * Math.PI * 1.1) + (t > 0.86 ? 0.14 : 0) + (t < 0.1 ? 0.05 : 0));
    }, (X, Y, u, lx, ly) => {
      const l = lf.get(0, ly);
      const t = (ly + baseH) / baseH;
      const n = cyl(l.k, u, bside) + (t < 0.08 || (t > 0.86 && t < 0.9) ? 0.12 : 0);
      // lotus petals round the top, the lion's mask in the middle
      if (t < 0.32 && Math.sin(u * 7.5) > 0.1) return mt(M.stone, n * 0.85, X, Y, 0.15, 1);
      const fx = u * 1.3, fy = (t - 0.6) * 3;
      const face = Math.hypot(fx, fy * 0.9) < 0.55;
      if (face) {
        const eyes = Math.hypot(Math.abs(fx) - 0.2, fy + 0.18) < 0.08;
        const mouth = Math.abs(fy - 0.22) < 0.05 && Math.abs(fx) < 0.25;
        const mane = Math.hypot(fx, fy * 0.9) > 0.42;
        if (eyes || mouth) return mt(M.stone, n * 0.35, X, Y, 0.3, 1);
        if (mane) return mt(M.stone, n * (Math.sin(Math.atan2(fy, fx) * 9) > 0 ? 0.95 : 0.7), X, Y, 0.15, 1);
        return mt(M.stone, n * 1.05, X, Y, 0.1, 1);
      }
      const chip = fbm(lx * 0.25, ly * 0.25, 51, 3) > 0.7 ? -0.18 : 0;
      return mt(M.stone, n * 0.95 + chip, X, Y, 0.15, 1);
    });
    // the shaft: vermilion, gold bands, a lacquer sheen down the side toward the shaft's light
    const side = clamp(lf.get(0, -3 * H).dx * 1.6, -1, 1);
    lathe(c, 0, -p.h, -baseH, () => R, (X, Y, u, lx, ly) => {
      const l = lf.get(0, ly);
      const hgt = -ly;
      const n = cyl(l.k, u, side, 0.12);
      if (hgt > p.beam[0] - p.beam[1] - 4 && hgt < p.beam[0] + 4) return mt(M.gold, n * 0.85 + (Math.sin(lx * 0.6) > 0.3 ? 0.06 : 0), X, Y, 0.2, 1);
      const band = (hgt > 1.15 * H && hgt < 1.32 * H) || (((hgt % (3.2 * H)) + 3.2 * H) % (3.2 * H) < 0.1 * H && hgt > 2 * H);
      if (band) return mt(M.gold, n * 0.9, X, Y, 0.2, 1);
      const worn = hgt < 2.2 * H ? vnoise(lx * 0.3, ly * 0.1, 29) * 0.1 : 0;
      return mt(M.verm, n * 0.78 - worn, X, Y, 0.25, 1);
    });
    // the map: rolled tight on a red cord wound round the pillar, gold end-caps, a paper tag
    const my = -1.45 * H;
    const half = R + 18;
    rect(c, -half, my - 13, half, my + 13, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = lx / half, v = (ly - my) / 13;
      if (Math.abs(u) > 0.9) return mt(M.gold, lum(l, u * 0.6, v * 0.8) * 1.05, X, Y, 0.05, 1);
      const roll = lum(l, 0, v * 0.95);
      const edge = Math.abs(u) > 0.84 && Math.abs(v) < 0.75 ? -0.25 : 0;
      return mt(M.paper, roll * 0.95 + edge, X, Y, 0.0, 1);
    });
    // the cord: wound round the roll twice, then up the pillar in a spiral to a peg
    for (const cxu of [-0.35, 0.3]) rect(c, half * cxu - 2, my - 14, half * cxu + 2, my + 14, (X, Y, lx, ly) => mt(M.verm, lum(lf.get(lx, ly), 0, (ly - my) / 14) * 0.9, X, Y, 0.2, 1));
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const ly = my - 14 - t * 0.95 * H;
      const ux = Math.sin(t * Math.PI * 3) * R * 0.95;
      const front = Math.cos(t * Math.PI * 3) > -0.2;
      if (!front) continue;
      rect(c, ux - 1.5, ly - 2, ux + 1.5, ly + 2, (X, Y, lx, lyy) => mt(M.verm, lum(lf.get(lx, lyy)) * 0.95, X, Y, 0.2, 1));
    }
    // a tassel hanging from the roll's end
    rect(c, half - 3, my + 10, half - 1, my + 34, (X, Y, lx, ly) => mt(M.verm, lum(lf.get(lx, ly)) * (ly > my + 26 ? 0.6 : 0.85), X, Y, 0.25, 1));
  },
});

export { P, hash, keep, tn };

// ---------------------------------------------------------------------------
// The roof over the play plane: the great tie beam the lanterns hang from, the dark coffers
// above it and the skylight the shaft comes down through (only ever seen at the top edge of
// the entrance shot; at play zoom it is always above the frame)
// ---------------------------------------------------------------------------
export interface RoofP {
  w: number;
  /** The beam's underside above the floor and its depth (px). */
  beam: number;
  depth: number;
  /** The skylight: local x range. */
  sky: [number, number];
  /** How far up it is painted (px above the floor). */
  top: number;
  at?: At;
}

export const roof = definePainter<RoofP>("hall.roof", {
  bounds(p) {
    return [0, -p.top, p.w, -p.beam + 4];
  },
  paint(c, p) {
    const lf = new LitField(HALL_LIGHT, p.at, 16);
    const b0 = -p.beam - p.depth, b1 = -p.beam;
    rect(c, 0, -p.top, p.w, b1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      if (ly >= b0) {
        // the tie beam: painted ends, a gold-edged teal body, a lit underside lip
        const v = (ly - b0) / p.depth;
        if (v > 0.9) return mt(M.gold, lum(l, 0, 0.9) * 0.8, X, Y, 0.25, 1);
        if (v < 0.08) return mt(M.lacq, lum(l) * 0.3, X, Y, 0.3, 1);
        const k = ((lx % (4.6 * H)) + 4.6 * H) % (4.6 * H) / (4.6 * H);
        if (k < 0.12 || k > 0.88) return Math.sin(lx * 0.25 + v * 7) > 0.3 ? mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1) : mt(M.verm, lum(l) * 0.45, X, Y, 0.35, 1);
        const cart = Math.abs(k - 0.5) < 0.2 && Math.abs(v - 0.5) < 0.3;
        if (cart) return Math.abs(Math.abs(k - 0.5) - 0.19) < 0.012 || Math.abs(Math.abs(v - 0.5) - 0.29) < 0.04 ? mt(M.gold, lum(l) * 0.75, X, Y, 0.25, 1) : mt(M.lacq, lum(l) * 0.4, X, Y, 0.3, 1);
        return tn(P.jade, clamp(0.84 + (1 - lum(l)) * 0.16, 0, 1), X, Y, 0.45);
      }
      // the skylight: a lattice of light in the dark roof
      if (lx > p.sky[0] && lx < p.sky[1] && ly < b0 - 0.25 * H) {
        const u = (lx - p.sky[0]) / (p.sky[1] - p.sky[0]);
        if (u < 0.06 || u > 0.94) return mt(M.lacq, 0.35, X, Y, 0.3, 1);
        const s2 = 0.28 * H;
        const a = (((lx - p.sky[0]) % s2) + s2) % s2, bb = ((((-ly) % s2) + s2) % s2);
        if (a < 3 || bb < 3) return mt(M.wood, 0.3, X, Y, 0.4, 1);
        return tn(SKYLIGHT, clamp(0.05 + Math.abs(u - 0.5) * 1.1 + ((-ly - p.beam - p.depth) / H) * 0.15, 0, 1), X, Y, 0.55);
      }
      // coffers: a grid of dark lacquer frames, faint gold in the panels, very dark
      const cs = 0.75 * H;
      const gx = ((lx % cs) + cs) % cs, gy = ((((-ly) % (0.5 * H)) + 0.5 * H) % (0.5 * H));
      if (gx < 5 || gy < 4) return mt(M.lacq, lum(l) * 0.35, X, Y, 0.35, 1);
      const rose = Math.hypot(gx - cs / 2, gy - 0.25 * H) < 6;
      return rose ? mt(M.gold, lum(l) * 0.55, X, Y, 0.35, 1) : mt(M.lacq, lum(l) * 0.55, X, Y, 0.35, 1);
    });
  },
});

/** Daylight through the skylight's paper: white-gold. */
const SKYLIGHT = [P.ember[0]!, P.paper[0]!, P.paper[1]!, P.ember[1]!, P.paper[3]!] as const;
