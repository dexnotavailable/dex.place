// The Hall of Works' play-plane structure: the raised timber walkway the whole floor runs
// along (its lacquered edge is the walk line) over the darker stone floor nearer us; the
// massive end walls with the door walls built into them; the Long Gallery's floor beam on its
// posts and brackets, with its vermilion balustrade (front plane, she walks behind it); the
// stair down to the nook with its rail (front plane). Everything takes the hall's light from
// lights.ts. (The central pillar that carried the rolled map is gone: the map of Tesu stands
// on its own stand beside the gate now, services.ts.)

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, SCREEN, LitField, clamp, colBase, colLight, cyl, face, fbm, grain, hash, keep, lathe, lum, mt, poly, rect, tn, vnoise, type At } from "./kit.ts";

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
  /** Lights doubled in the polished floor: [local x, half width, strength]. */
  refl?: [number, number, number][];
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
        // the walkway's face: panels with a gold-line inset, in the shadow of the lip; (hall loop
        // round 1) the inlay worn away in places and broken where feet and furniture stand on it
        const pw = 2 * H;
        const u = ((lx % pw) + pw) % pw;
        const inPanel = u > 8 && u < pw - 8 && ly > NOSE + 6 && ly < FACE - 6;
        const worn = fbm(lx * 0.035, 3.7, 41, 2) > 0.6 || hash(Math.floor(lx / 7), 2, 43) > 0.93;
        const line = inPanel && !worn && (Math.abs(u - 12) < 1 || Math.abs(u - (pw - 12)) < 1 || Math.abs(ly - NOSE - 10) < 0.7 || Math.abs(ly - FACE + 10) < 0.7);
        const shadow = ly < NOSE + 5 ? 0.25 : 0;
        if (line) return mt(M.gold, lum(l) * 0.5 - shadow, X, Y, 0.3, 1);
        if (!inPanel) return mt(M.wood, lum(l) * 0.45 - shadow, X, Y, 0.35, 1);
        return mt(M.lacq, lum(l) * 0.55 - shadow + grain(lx, ly, 3, false) * 0.08, X, Y, 0.1, 1);
      }
      // the stone floor nearer us: big flags in courses, their joints opening out toward the
      // camera, the whole floor darkening toward us (the lights are behind)
      const depth = (ly - FACE) / H;
      const row = Math.floor(Math.sqrt(depth * 9));
      const rowTop = (row * row) / 9;
      const fw = (1.6 + row * 0.5) * H;
      const off = (row % 2) * fw * 0.5 + hash(row, 1, 17) * fw * 0.3;
      const joint = depth - rowTop < 0.025 + row * 0.006 || (((lx + off) % fw) + fw) % fw < 1.2 + row * 0.4;
      const lf2 = lf.get(lx, -20);
      // (hall loop round 1) the polish doubles every light above as a clean streak straight down,
      // broken by the floor's ripples into dashes, fading as it nears us: warm under the lanterns
      // and lamps, pale under the daylight; painted in whole colours (no dithered ghost)
      let best = 0, day = false;
      for (const rx of p.refl ?? []) {
        const w = rx[1] * (rx[2] >= 0.5 ? 0.42 + depth * 0.1 : 0.22 + depth * 0.06);
        const d = Math.abs(lx - rx[0]) / w;
        if (d >= 1) continue;
        const ripple = vnoise(lx * 0.04, ly * 0.22, 5) > 0.36 ? 1 : 0.25;
        const v = (1 - d * d) * rx[2] * Math.max(0, 1 - depth / (rx[2] >= 0.5 ? 3 : 2)) * ripple;
        if (v > best) { best = v; day = rx[2] >= 0.5; }
      }
      if (best > 0.09 && !joint) {
        const ramp = day ? REFL_DAY : REFL_WARM;
        const i = best > 0.42 ? 0 : best > 0.26 ? 1 : best > 0.16 ? 2 : 3;
        return ramp[i]!;
      }
      const gleam = vnoise(lx * 0.02, depth * 3, 9) * 0.08;
      const lit = lum(lf2) * (0.3 - depth * 0.07) + gleam - (joint ? 0.14 : 0) - (ly < FACE + 4 ? 0.2 : 0) - depth * 0.05;
      return mt(M.stone, lit, X, Y, 0.62, 1, 0.5);
    });
  },
});

/** The polish's reflections: of the lanterns and lamps (warm), of the daylight (pale). */
const REFL_WARM = [P.ember[3]!, P.ember[4]!, P.umber[0]!, P.umber[1]!] as const;
const REFL_DAY = [P.paper[2]!, P.stone[3]!, P.stone[4]!, P.stone[5]!] as const;

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
    // the end's shell, running out to the frame's edge in the entrance shot (round 1, L10: no black void
    // past the end walls): a timber-framed wall in the cool dark, a tall lattice window with the day
    // behind its paper, a second one up by the gallery, a long banner hanging between them
    rect(c, s < 0 ? -p.out : 0, -20 * H, s < 0 ? 0 : p.out, 6 * H, (X, Y, lx, ly) => {
      const d = -inx(lx); // distance beyond the end, px
      const l = lf.get(s < 0 ? -10 : 10, Math.min(ly, -20));
      const up = -ly / H;
      if (ly > 0) return tn(M.dark, 0.88, X, Y, 0.4);
      const fade = clamp(1 - (d - 3.6 * H) / (3 * H), 0.25, 1);
      // the windows: lattice over paper, a cool day behind it, brighter low in each pane
      for (const [w0, w1, h0, h1] of [[0.95, 2.45, 1.9, 5.9], [1.1, 2.3, 8.6, 11.6]] as const) {
        if (d > w0 * H && d < w1 * H && up > h0 && up < h1) {
          const u = (d - w0 * H) / ((w1 - w0) * H), v = (up - h0) / (h1 - h0);
          const frame = u < 0.07 || u > 0.93 || v < 0.05 || v > 0.95;
          if (frame) return mt(M.lacq, lum(l) * 0.55, X, Y, 0.2, 1);
          const g = 0.17 * H;
          const gx = ((d % g) + g) % g, gy = ((((-ly) % g) + g) % g);
          if (gx < 2 || gy < 2 || Math.abs(gx - gy) < 1.2) return mt(M.lacq, 0.3, X, Y, 0.3, 1);
          return tn(P.tile, clamp(0.08 + v * 0.35 + Math.abs(u - 0.5) * 0.4, 0, 1), X, Y, 0.5);
        }
      }
      // the banner: deep red silk with a gold hem and a gold emblem, hanging from a rod
      const bd = d - 2.95 * H;
      if (Math.abs(bd) < 0.32 * H && up > 3.4 && up < 8.0) {
        const v = (8.0 - up) / 4.6;
        const tail = v > 0.92 && Math.abs(bd) > 0.32 * H * (1 - (v - 0.92) * 10);
        if (tail) return 0;
        if (up > 7.85) return tn(M.gold, 0.35, X, Y, 0);
        const hem = Math.abs(Math.abs(bd) - 0.27 * H) < 2 || (v > 0.86 && v < 0.89);
        const emblem = Math.hypot(bd, (up - 6.6) * H) < 0.16 * H && Math.hypot(bd, (up - 6.6) * H) > 0.1 * H;
        if (hem || emblem) return mt(M.gold, lum(l) * 0.75 * fade, X, Y, 0.3, 1);
        return mt(M.verm, (lum(l) * 0.55 + Math.sin(bd * 0.12) * 0.06) * fade, X, Y, 0.3, 1);
      }
      const post = ((d % (2.2 * H)) + 2.2 * H) % (2.2 * H) < 0.32 * H && d > 0.4 * H;
      const beam = ((((-ly) % (3.1 * H)) + 3.1 * H) % (3.1 * H)) < 0.26 * H;
      const plaster = fbm(lx * 0.05, ly * 0.05, 31, 3);
      if (post || beam) return mt(M.lacq, (lum(l) * 0.75 + 0.18) * fade, X, Y, 0.3, 1);
      return mt(M.dark, (lum(l) * 0.6 + 0.12) * fade + (plaster - 0.5) * 0.12, X, Y, 0.35, 1);
    });
    // the corner column at the room's end: vermilion, lit by the doors' daylight
    const colR = 0.3 * H;
    const ccx = -s * colR * 0.6;
    const { k: ck, side: cside } = colLight(lf, ccx, -8 * H, 0);
    colBase(c, ccx, colR, 0.9 * H, ck, cside, 13);
    lathe(c, ccx, -20 * H, 0, () => colR, (X, Y, u, _lx, ly) => {
      const hgt = -ly / H;
      const n = cyl(ck, u, cside, 0.1) - clamp((hgt - 6) / 14, 0, 1) * 0.15;
      if (hgt < 0.9) return 0;
      const band = (hgt > 1.0 && hgt < 1.2) || (hgt > 6.6 && hgt < 6.8);
      return band ? mt(M.gold, n * 0.9, X, Y, 0.2, 1) : mt(M.verm, n * 0.75, X, Y, 0.25, 1);
    });
    // the door wall: lacquer panels framed in timber, the doors set deep in it
    const dx0 = Math.min(inx(p.doorAt), inx(p.doorAt + p.doorW)) * 1, dx1 = Math.max(inx(p.doorAt), inx(p.doorAt + p.doorW));
    const w0 = Math.min(0, -s * p.wall), w1 = Math.max(0, -s * p.wall);
    const surround = 0.38 * H;
    rect(c, w0, -p.top, w1, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const inDoor = p.doorW > 0 && lx > dx0 - surround && lx < dx1 + surround && ly > -p.doorH - surround * 1.4;
      if (inDoor) return 0;
      const pu = ((lx % (0.95 * H)) + 0.95 * H) % (0.95 * H), pv = ((ly % (1.25 * H)) + 1.25 * H) % (1.25 * H);
      const frame = pu < 0.1 * H || pv < 0.1 * H;
      const skirt = ly > -0.45 * H;
      if (skirt) return mt(M.stone, lum(l) * (ly < -0.42 * H ? 1.2 : 0.75), X, Y, 0.25, 1);
      if (frame) return mt(M.wood, lum(l, pu < 0.05 * H ? -0.6 : 0, pv < 0.05 * H ? -0.6 : 0) * 0.8, X, Y, 0.25, 1);
      return mt(M.lacq, lum(l) * 0.8 + grain(lx, ly, 13) * 0.1, X, Y, 0.1, 1);
    });
    // the doorway: a stone threshold and step, carved jambs, a lintel with a plaque, the transom (the
    // east end has none since the court's gate moved to the middle, round 1)
    if (p.doorW > 0) doorway(c, p, dx0, dx1, surround, lf);
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
  // one light for the doors (their mean), a little brighter low where the daylight leaks in:
  // lacquer this big must read as one smooth surface, not a map of the lantern pools
  const dl = colLight(lf, cx, -dh, 0);
  const doorK = Math.max(0.55, dl.k);
  // (hall loop round 1) the leaves as built doors: each a frame of stiles and rails round a studded
  // upper field and a raised lower panel, its thickness showing in shadow at the jamb; the lintel's
  // shadow across their tops; studs domed (lit above-left, a shadow below-right); the lacquer worn to
  // the timber where hands push, by the seam at hand height; a real gap between the leaves with the
  // day showing through it and under them (the floor's spill is the room's light, hall-light.ts)
  const W = dx1 - dx0, leafW = W / 2;
  const stile = Math.max(5, leafW * 0.09), rail = Math.max(5, dh * 0.055);
  const lock0 = dh * 0.6, lock1 = lock0 + rail * 0.9, low1 = dh - rail * 1.6;
  const cols = 5, rows = 7;
  rect(c, dx0, -dh, dx1, 0, (X, Y, lx, ly) => {
    const v = (ly + dh) / dh, y = ly + dh;
    const l = { k: doorK * (0.86 + 0.22 * v), dx: dl.side * 0.6, dy: -0.8 };
    const li = Math.abs(lx - cx), lu = leafW - li;
    // the seam: a dark gap, the day a thin line through its middle, brightest low
    if (li < 1.3) {
      if (li < 0.55 && p.day > 0 && v > 0.04) return tn(M.paper, clamp(0.35 - v * 0.3 - p.day * 0.1, 0, 1), X, Y, 0);
      return tn(M.ink, 0.0, X, Y, 0);
    }
    // under the leaves: the day in a bright line along the threshold
    if (v > 0.988 && p.day > 0) return tn(M.paper, 0.2, X, Y, 0);
    // the lintel's shadow across the leaves' tops, in two steps
    const lintel = y < dh * 0.045 ? -0.26 : y < dh * 0.1 + Math.sin(lx * 0.3) * 0.6 ? -0.13 : 0;
    // the leaf's thickness at the jamb: its edge in shadow, a lit arris
    if (lu < 3.5) return lu > 2.4 ? mt(M.verm, face(l.k, dl.side) * 0.75 + lintel, X, Y, 0.25, 1) : mt(M.verm, l.k * 0.22 + lintel, X, Y, 0.4, 1);
    const side = lx < cx ? -1 : 1;
    // the frame: stiles at both sides of the leaf, a top rail, a lock rail, a bottom rail
    const inStile = lu < 3.5 + stile || li < 1.3 + stile * 0.8;
    const inRail = y < rail || (y > lock0 && y < lock1) || y > low1;
    if (inStile || inRail) {
      // the frame stands proud of the panels: its inner edges catch the light on the top-left
      const ein = Math.min(Math.abs(lu - 3.5 - stile), Math.abs(li - 1.3 - stile * 0.8), Math.abs(y - rail), Math.abs(y - lock0), Math.abs(y - lock1), Math.abs(y - low1));
      const arris = ein < 1.2 ? 0.08 : 0;
      return mt(M.verm, face(l.k, dl.side) * 0.78 + arris + lintel + grain(lx, ly, 23, !inRail) * 0.05, X, Y, 0.25, 1);
    }
    // the worn lacquer where hands push it: near the seam at hand height, the timber showing
    const handZone = Math.max(0, 1 - Math.abs(y - dh * 0.55) / (dh * 0.14)) * Math.max(0, 1 - li / (leafW * 0.42));
    if (handZone > 0 && fbm(lx * 0.12, ly * 0.12, 37, 2) < handZone * 0.75 - 0.08) return mt(M.wood, face(l.k, dl.side) * 0.7 + lintel, X, Y, 0.3, 1);
    // the lower panel: raised, its bevels lit top-left and dark bottom-right
    if (y > lock1 && y < low1) {
      const px0 = side < 0 ? dx0 + 3.5 + stile : cx + 1.3 + stile * 0.8, px1 = side < 0 ? cx - 1.3 - stile * 0.8 : dx1 - 3.5 - stile;
      const e = Math.min(lx - px0, px1 - lx, y - lock1, low1 - y);
      const bev = 4;
      if (e < bev) {
        const topLeft = Math.min(lx - px0, y - lock1) < Math.min(px1 - lx, low1 - y);
        return mt(M.verm, face(l.k, dl.side) * (topLeft ? 0.95 : 0.5) + lintel, X, Y, 0.25, 1);
      }
      return mt(M.verm, face(l.k, dl.side) * 0.74 + lintel + grain(lx, ly, 29, false) * 0.04 + (y > low1 - 8 ? -0.06 : 0), X, Y, 0.25, 1);
    }
    // the upper field: studs in rows, domed, each with a small shadow below-right
    const f0 = side < 0 ? dx0 + 3.5 + stile : cx + 1.3 + stile * 0.8, fw = leafW - 4.8 - stile * 1.8;
    const fu = (lx - f0) / fw, fv = (y - rail) / (lock0 - rail);
    const sr2 = Math.max(1.6, 0.034 * H * g);
    const gi = Math.round(fu * cols - 0.5), gj = Math.round(fv * rows - 0.5);
    const sx = f0 + ((gi + 0.5) / cols) * fw, sy = rail + ((gj + 0.5) / rows) * (lock0 - rail);
    const ddx = lx - sx, ddy = y - sy;
    if (gi >= 0 && gi < cols && gj >= 0 && gj < rows) {
      const sd = Math.hypot(ddx, ddy);
      if (sd < sr2) {
        const lit = -(ddx + ddy) / (sr2 * 1.4);
        return mt(M.gold, face(l.k, dl.side) * (0.62 + lit * 0.5) + (lit > 0.45 ? 0.15 : 0), X, Y, 0.05, 1);
      }
      if (Math.hypot(ddx - 1.3, ddy - 1.5) < sr2 && ddx > -0.5 && ddy > -0.5) return mt(M.verm, face(l.k, dl.side) * 0.45 + lintel, X, Y, 0.3, 1);
    }
    // the lion-head rings near the seam
    const rx = cx + side * leafW * 0.16, ry = dh * 0.5;
    const rd = Math.hypot(lx - rx, y - ry);
    if (rd < 0.15 * H * g && rd > 0.11 * H * g && y > ry) return mt(M.gold, face(l.k, dl.side, (lx - rx) / (0.15 * H), 0.3) * 1.0, X, Y, 0.05, 1);
    if (Math.hypot(lx - rx, y - ry + 0.04 * dh) < 0.12 * H * g) return mt(M.bronze, face(l.k, dl.side, (lx - rx) / (0.12 * H), (y - ry) / (0.12 * H)) * 1.0, X, Y, 0.1, 1);
    return mt(M.verm, face(l.k, dl.side) * 0.7 + lintel + grain(lx, ly, 17, false) * 0.04, X, Y, 0.25, 1);
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
    // a fine fret of dark timber (stepped squares) over paper lit by the day outside
    const s = 0.2 * H;
    const gx = (((lx - dx0) % s) + s) % s, gy = (((ly - ty0) % s) + s) % s;
    const bar = gx < 2 || gy < 2 || (Math.abs(Math.max(Math.abs(gx - s / 2), Math.abs(gy - s / 2)) - s * 0.22) < 1.1);
    if (bar) return mt(M.wood, lum(l) * 0.35, X, Y, 0.5, 1);
    const glow = 0.35 * p.day + 0.35 * Math.sin(u * Math.PI);
    return tn(SCREEN, clamp(0.85 - glow, 0, 1), X, Y, 0.55);
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
      // gold medallions on the fascia, between them a gold vine; (hall loop round 1) never the
      // same twice in a row: rosettes, coins and lotuses, the odd one fallen out of its socket, a
      // beam joint with an iron strap every few, the gilding worn where it is out of the light
      const pitch = 1.65 * H;
      const mi = Math.floor(lx / pitch);
      const m = ((lx % pitch) + pitch) % pitch - pitch / 2;
      const cy = (D + 6) / 2;
      const kind = hash(mi, 1, 71);
      // a joint: two beams butted, a dark split and a strap across it
      if (mi % 4 === 1 && Math.abs(m + pitch * 0.5) < 6) {
        if (Math.abs(m + pitch * 0.5) < 1) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.3, 1);
        return mt(M.bronze, lum(l, 0, ly < cy ? -0.4 : 0.4) * 0.6, X, Y, 0.2, 1);
      }
      const d = Math.hypot(m * 0.85, ly - cy);
      if (d < 0.13 * H) {
        if (kind < 0.1) return d > 0.1 * H ? mt(M.lacq, lum(l) * 0.35, X, Y, 0.2, 1) : mt(M.lacq, lum(l) * 0.5, X, Y, 0.2, 1);
        const ring = d > 0.1 * H;
        const ang = Math.atan2(ly - cy, m);
        const inner = kind < 0.45 ? Math.sin(ang * 8) > 0.1 : kind < 0.75 ? Math.abs(m) > 0.035 * H || Math.abs(ly - cy) > 0.035 * H : Math.cos(ang * 5) > 0.3;
        const dim = l.k < 0.45 ? 0.8 : 1;
        return mt(M.gold, lum(l, m / (0.3 * H), (ly - cy) / (0.3 * H)) * (ring ? 0.85 : inner ? 0.7 : 0.45) * dim, X, Y, 0.2, 1);
      }
      const wornVine = fbm(lx * 0.03, 2.2, 73, 2) > 0.62;
      const vine = !wornVine && Math.abs(ly - cy - Math.sin(lx * 0.07 + mi) * 5) < 0.8 / c.d && Math.abs(m) > 0.2 * H;
      if (vine) return mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1);
      return mt(M.lacq, lum(l) * 0.7 + grain(lx, ly, 19, false) * 0.08, X, Y, 0.05, 1);
    });
  },
});

function post(c: PaintCtx, px: number, drop: number, D: number, lf: LitField): void {
  const r = 0.2 * H;
  const { k: pk, side } = colLight(lf, px, D, drop);
  colBaseAt(c, px, drop, r, 0.55 * H, pk, side, 7);
  lathe(c, px, D - 4, drop, () => r, (X, Y, u, lx, ly) => {
    const fromFloor = (drop - ly) / H;
    const n = cyl(pk, u, side, 0.1);
    if (fromFloor < 0.55) return 0;
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
    // (hall loop round 1) the stair as a built flight, not a hatched wedge. Under the stringer the
    // flight's carriage shows its stepped underside (a sawtooth: each step's underside a dark
    // plank, its riser's underside lit from the nook below); behind and under it the nook's
    // panelled wall takes the flight's cast shadow, sawtooth-edged, deepening toward the top
    // where the stair closes over; low down the nook's lamp lights the wall warm
    const D = p.depth;
    const STR = Math.round(D * 0.55); // the stringer's depth below the treads' line
    const SAW = rise * 0.95; // how far the stepped underside hangs below the stringer
    const sawAt = (lx: number): number => {
      const k = ((lx % run) + run) % run / run;
      return STR + 4 + SAW * (1 - k);
    };
    rect(c, 0, STR, p.dx, p.dy, (X, Y, lx, ly) => {
      const base = lx * slope;
      const t = ly - base;
      const fromFloor = p.dy - ly;
      const l = lf.get(lx, ly);
      const saw = sawAt(lx);
      if (t < STR + 2) return 0;
      // the carriage's stepped underside: dark tread undersides, lit riser undersides
      if (t < saw) {
        const k = ((lx % run) + run) % run;
        const riserFace = k < 3;
        const edge = saw - t < 2;
        if (riserFace) return mt(M.wood, lum(l, -0.6, 0.8) * 0.85, X, Y, 0.2, 1);
        return mt(M.lacq, lum(l) * (edge ? 0.55 : 0.32) + grain(lx, ly, 27, false) * 0.05, X, Y, 0.2, 1);
      }
      if (ly > p.dy) return 0;
      // the nook's wall: boards in frames, a rail, a skirt
      const board = ((lx % 22) + 22) % 22 < 1.3;
      const rail = Math.abs(fromFloor - 0.92 * H) < 3;
      const skirt = fromFloor < 0.32 * H;
      // the flight's shadow on it: below the sawtooth, offset down and to the right, darkest high up
      const sh = t < sawAt(lx - 0.22 * H) + 0.45 * H ? 1 : 0;
      const high = clamp(1 - fromFloor / Math.max(1, p.dy), 0, 1);
      const shadow = sh * (0.16 + high * 0.14) + high * 0.12;
      let v: number;
      if (rail) v = lum(l, 0, fromFloor > 0.92 * H ? 0.6 : -0.8) * 0.9;
      else if (skirt) v = lum(l) * (fromFloor > 0.29 * H ? 1.1 : 0.6);
      else v = lum(l) * (board ? 0.45 : 0.7) + grain(lx, ly, 27) * 0.06;
      return mt(rail ? M.wood : skirt ? M.lacq : M.wood, v - shadow, X, Y, rail ? 0.2 : skirt ? 0.1 : 0.35, 1);
    });
    // the treads' line and the stringer: a lit top lip, the lacquered face with a gold bead, its
    // thickness showing as a darker bottom face
    rect(c, -2, 0, p.dx + 2, p.dy + D, (X, Y, lx, ly) => {
      const base = lx * slope; // the treads' line
      const t = ly - base;
      const stepTop = rise * (Math.floor(lx / run) + 1);
      if (ly < stepTop + 2 && t < 6) return 0; // leave the treads
      if (t < 2 || t > STR + 2) return 0;
      const l = lf.get(lx, ly);
      if (t < 6) return mt(M.verm, lum(l, 0, -0.7) * 1.0, X, Y, 0.2, 1);
      if (Math.abs(t - 9) < 1) return mt(M.gold, lum(l) * 0.85, X, Y, 0.2, 1);
      if (t > STR - 2) return mt(M.verm, lum(l, 0, 0.8) * 0.4, X, Y, 0.35, 1);
      return mt(M.verm, lum(l) * 0.62 + grain(lx - ly / slope, ly, 21, false) * 0.05, X, Y, 0.25, 1);
    });
  },
});

/** A column base standing on a floor `fy` px below the local origin. */
function colBaseAt(c: PaintCtx, cx: number, fy: number, r: number, top: number, k: number, side: number, seed: number): void {
  const shifted = { ...c, Y: (v: number) => c.Y(v + fy), ly: (v: number) => c.ly(v) - fy };
  colBase(shifted as PaintCtx, cx, r, top, k, side, seed);
}

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
    const sx0 = p.sky[0], sx1 = p.sky[1], sw = sx1 - sx0;
    rect(c, 0, -p.top, p.w, b1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      if (ly >= b0) {
        // the long beam: dark lacquer, a gold bead top and bottom, a dim painted cartouche every
        // bay, a gold scroll at each joint; its underside lip catches the light below
        const v = (ly - b0) / p.depth;
        if (v > 0.88) return mt(M.gold, lum(l, 0, 0.9) * 0.75, X, Y, 0.3, 1);
        if (v < 0.07) return mt(M.gold, lum(l, 0, -0.9) * 0.45, X, Y, 0.35, 1);
        const k = ((lx % (4.6 * H)) + 4.6 * H) % (4.6 * H) / (4.6 * H);
        const ek = Math.min(k, 1 - k) * 4.6 * H;
        if (ek < 0.32 * H) {
          const f = Math.sin(ek * 0.35 + Math.sin((v - 0.5) * 6) * 2.5);
          return Math.abs(f) < 0.22 ? mt(M.gold, lum(l) * 0.6, X, Y, 0.35, 1) : mt(M.verm, lum(l) * 0.35, X, Y, 0.4, 1);
        }
        const cart = Math.abs(k - 0.5) < 0.17 && Math.abs(v - 0.5) < 0.28;
        if (cart) {
          const edge = Math.abs(Math.abs(k - 0.5) - 0.165) < 0.01 || Math.abs(Math.abs(v - 0.5) - 0.27) < 0.04;
          return edge ? mt(M.gold, lum(l) * 0.65, X, Y, 0.3, 1) : tn(P.jade, clamp(0.86 + (1 - lum(l)) * 0.14, 0, 1), X, Y, 0.45);
        }
        return mt(M.lacq, lum(l) * 0.5 + grain(lx, ly, 61, false) * 0.05, X, Y, 0.1, 1);
      }
      // the skylight: a deep well in the roof, its inner walls lit by the day pouring down it,
      // the lattice at its mouth in silhouette against the brightness
      const wellDepth = 0.55 * H;
      if (lx > sx0 - wellDepth * 0.4 && lx < sx1 + wellDepth * 0.4 && ly < b0 - 0.2 * H && ly > b0 - 2.4 * H) {
        const u = (lx - sx0) / sw;
        const up = (b0 - 0.2 * H - ly) / H; // how far up the well
        if (u < 0 || u > 1) {
          // the well's side walls, lit from the opening, darker going down
          const side = u < 0 ? -u * sw / (wellDepth * 0.4) : (u - 1) * sw / (wellDepth * 0.4);
          return mt(M.wood, (1 - side) * (0.35 + 0.4 * clamp(up / 2.5, 0, 1)), X, Y, 0.2, 1);
        }
        const s2 = 0.3 * H;
        const a = (((lx - sx0) % s2) + s2) % s2, bb = ((((-ly) % s2) + s2) % s2);
        const bar = (a < 2.5 || bb < 2.5) && up < 1.4;
        if (bar) return mt(M.wood, 0.25 + 0.3 * clamp(up, 0, 1), X, Y, 0.35, 1);
        // (round 1: held a step below the court gate's daylight, the room's key now)
        const glow = clamp(0.25 + Math.abs(u - 0.5) * 0.6 - up * 0.06, 0, 1);
        return tn(SKYLIGHT_DIM, glow, X, Y, 0.55);
      }
      // coffers: lacquer frames, each panel holding a faint gold rosette, warmed near the
      // skylight and the lanterns, darkest far up
      const cs = 0.75 * H;
      const gx = ((lx % cs) + cs) % cs, gy = ((((-ly) % (0.55 * H)) + 0.55 * H) % (0.55 * H));
      const near = clamp(1 - Math.abs(lx - (sx0 + sx1) / 2) / (3.2 * H), 0, 1) * 0.35;
      // the roof falls into the dark the higher it goes (round 1, L10: no flat band at the frame's top)
      const far = clamp(((b0 - ly) / H - 1.2) / 5, 0, 1);
      const lit = (lum(l) * 0.5 + near) * (1 - far * 0.8);
      if (gx < 4 || gy < 4) return mt(M.wood, lit * 0.75, X, Y, 0.35, 1);
      const rose = Math.hypot(gx - cs / 2, gy - 0.275 * H) < 7;
      const petal = rose && Math.sin(Math.atan2(gy - 0.275 * H, gx - cs / 2) * 8) > 0;
      return rose ? mt(M.gold, lit * (petal ? 0.8 : 0.5), X, Y, 0.35, 1) : mt(M.lacq, lit * 0.6, X, Y, 0.2, 1);
    });
  },
});

/** The skylight's paper held below the court gate's daylight (round 1: the gate is the room's key). */
const SKYLIGHT_DIM = [P.paper[2]!, P.paper[3]!, P.ember[4]!, P.paper[4]!, P.umber[0]!] as const;
