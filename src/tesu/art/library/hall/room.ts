// The Hall of Works' play-plane structure: the raised timber walkway the whole floor runs
// along (its lacquered edge is the walk line) over the darker stone floor nearer us; the
// massive end walls with the door walls built into them; the Long Gallery's floor beam on its
// posts and brackets, with its vermilion balustrade (front plane, she walks behind it). (The
// stair down to the nook is stair.ts.) Everything takes the hall's light from
// lights.ts. (The central pillar that carried the rolled map is gone: the map of Tesu stands
// on its own stand beside the gate now, services.ts.)

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, SCREEN, LitField, clamp, colBase, colLight, cyl, face, fbm, grain, hash, keep, lathe, lum, mt, poly, rect, tn, vnoise, type At } from "./kit.ts";
import { cloudScroll, plumCrest } from "./signs.ts";

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
      // (hall loop round 2, W2-5: the round-1 dashes read as ripples on water) the lacquered stone doubles
      // every light above as a soft vertical smear straight down that fades fast, a little streaked down
      // its length (the polish), cut by the joints between the flags: warm under the lanterns and lamps;
      // under the gate, the court's warm paving first and its pale sky below it
      let best = 0, day = false;
      for (const rx of p.refl ?? []) {
        const isDay = rx[2] >= 0.5;
        const w = rx[1] * (isDay ? 0.4 : 0.26) * (1 + depth * 0.15);
        const d = Math.abs(lx - rx[0]) / w;
        if (d >= 1) continue;
        // (second pass: a 2-D noise thresholded into bands drew jagged peaks, a mirrored landscape) the polish's
        // streaks run straight down: the noise changes across the smear, hardly at all down it; the smear thins and
        // fades fast, its foot breaking up into the streaks instead of ending on a line
        const fade = Math.max(0, 1 - depth / (isDay ? 1.25 : 0.9));
        const streak = 0.72 + 0.4 * vnoise(lx * 0.23, 3.1 + depth * 0.06, 5) + 0.12 * vnoise(lx * 0.9, depth * 0.03, 6);
        const v = (1 - d * d) * rx[2] * fade * fade * streak - (1 - fade) * 0.12 * vnoise(lx * 0.5, 1, 7);
        if (v > best) { best = v; day = isDay; }
      }
      if (best > 0.08 && !joint) {
        const ramp = day ? (depth < 0.24 + (hash(X, Y, 11) - 0.5) * 0.14 ? REFL_DAY : REFL_SKY) : REFL_WARM;
        const i = best > 0.5 ? 0 : best > 0.3 ? 1 : best > 0.17 ? 2 : 3;
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
const REFL_SKY = [P.cloud[3]!, P.range[3]!, P.range[5]!, P.tile[3]!] as const;

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
      let n = cyl(ck, u, cside, 0.1) - clamp((hgt - 6) / 14, 0, 1) * 0.15;
      if (hgt < 0.9) return 0;
      // (integration, round 2: high up the column sank into the end's dark with the shell, so in hall-wide the back
      // wall met the dark on a ruled line from the tie beam down) its edge turned to the room keeps the room's
      // lamplight all the way up, so the room ends on a column's lit edge, not a cut
      const toRoom = u * -s;
      if (toRoom > 0.1) n = Math.max(n, (0.3 + ((toRoom - 0.1) / 0.9) ** 1.5 * 0.42) * (0.85 + clamp((hgt - 7) / 6, 0, 1) * 0.3));
      const band = (hgt > 1.0 && hgt < 1.2) || (hgt > 6.6 && hgt < 6.8);
      return band ? mt(M.gold, n * 0.9, X, Y, 0.2, 1) : mt(M.verm, n * 0.75, X, Y, 0.25, 1);
    });
    // the door wall: lacquer panels framed in timber, the doors set deep in it
    const dx0 = Math.min(inx(p.doorAt), inx(p.doorAt + p.doorW)) * 1, dx1 = Math.max(inx(p.doorAt), inx(p.doorAt + p.doorW));
    const w0 = Math.min(0, -s * p.wall), w1 = Math.max(0, -s * p.wall);
    const surround = 0.38 * H;
    // (hall loop round 2, W2-9: the east end's wall was a flat brown grid, its west edge a straight seam against
    // the back wall) where no door is built in, the end is a screen wall with its own corner post
    if (p.doorW <= 0) {
      screenWall(c, w0, w1, p.top, s, lf);
      return;
    }
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
      // (round 2, W1-2: no pseudo-script) the ground of the plaque; its mark is painted over it below
      return mt(M.lacq, lum(l) * 0.4, X, Y, 0.3, 1);
    }
    return mt(M.verm, lum(l) * 0.7 + (Math.sin(lx * 0.4) > 0.7 ? 0.1 : 0), X, Y, 0.3, 1);
  });
  // the plaque's mark, wordless: the hall's plum-blossom crest in a ring between two gold cloud scrolls
  {
    const pw = (dx1 - dx0) * 0.42, ph = (ly1 - ly0) * 0.6, pcy = Math.round(ly0 + (ly1 - ly0) * 0.56);
    const gold = (k: number) => (X: number, Y: number, lx: number, ly: number) => mt(M.gold, lum(lf.get(lx, ly)) * k, X, Y, 0.05, 1);
    const r = Math.max(5, Math.round(ph / 2 - 3));
    plumCrest(c, Math.round(cx), pcy, r, gold(1.1), (X, Y) => mt(M.lacq, 0.25, X, Y, 0.1, 1), gold(1.3));
    const sr = Math.max(2.5, Math.min(4, ph * 0.18)), tail = Math.max(4, pw / 2 - r - sr * 2 - 6);
    cloudScroll(c, Math.round(cx - pw / 2 + 5 + sr), pcy - 1, sr, 1, tail, gold(0.95));
    cloudScroll(c, Math.round(cx + pw / 2 - 5 - sr), pcy - 1, sr, -1, tail, gold(0.95));
  }
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

/**
 * The east end's screen wall (round 2, W2-9): a corner post at its edge into the room (a stone base, its face
 * toward the room lit), a lacquer dado, three paper screens lit from a lamp in the passage behind them (one slid
 * a hand's width open, light leaking at the seams between the leaves, someone's shadow on the paper), a bracket
 * shelf over them with a box, a vase and a scroll case, boarding above it darkening up into the shell with a
 * long ink scroll, a beam, and a lattice window high up with the cool day behind it.
 */
function screenWall(c: PaintCtx, w0: number, w1: number, top: number, s: number, lf: LitField): void {
  const POSTW = Math.round(0.22 * H);
  // the post stands at the edge toward the room
  const pin = s > 0 ? w0 : w1 - POSTW;
  const f0 = s > 0 ? w0 + POSTW : w0, f1 = s > 0 ? w1 : w1 - POSTW;
  const FW = f1 - f0;
  const SCR0 = 1.12, SCR1 = 3.35, SHELF = 3.42, BEAM0 = 6.95, BEAM1 = 7.25, WIN0 = 7.6, WIN1 = 9.15;
  const leaves = 3, lw = FW / leaves;
  const open = Math.round(0.09 * H); // the middle leaf slid this far
  const lampU = 0.62, lampUp = 1.9; // the lamp in the passage behind
  rect(c, Math.min(w0, pin), -top, Math.max(w1, pin + POSTW), 0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const up = -ly / H;
    // --- the corner post
    if (lx >= pin && lx < pin + POSTW) {
      const pu = (lx - pin) / POSTW;
      const toRoom = s > 0 ? pu : 1 - pu; // 0 on its face toward the room
      if (up < 0.55) return mt(M.stone, lum(l, s > 0 ? -0.6 : 0.6, up > 0.5 ? -0.8 : 0) * (up > 0.5 ? 1.15 : 0.85) - (toRoom > 0.85 ? 0.12 : 0), X, Y, 0.2, 1);
      if (Math.abs(up - 3.38) < 0.06 || Math.abs(up - 7.1) < 0.06) return mt(M.gold, lum(l) * 0.75, X, Y, 0.3, 1);
      const v = 0.22 + lum(l, toRoom < 0.25 ? -0.8 * s : toRoom > 0.8 ? 0.7 * s : 0) * 0.8 + (toRoom < 0.22 ? 0.14 : toRoom > 0.8 ? -0.12 : 0) + grain(lx, ly, 17) * 0.06 - clamp((up - 4) / 6, 0, 1) * 0.2;
      return mt(M.verm, v, X, Y, 0.3, 1);
    }
    if (lx < f0 || lx >= f1) return 0;
    const fu = (lx - f0) / FW;
    const dim = clamp((up - 3.5) / 6, 0, 1) * 0.25; // the wall darkens as it rises away from the floor's lamps
    // --- the skirting and the dado
    if (up < 0.45) return mt(M.stone, lum(l, 0, up > 0.42 ? -0.8 : 0) * (up > 0.42 ? 1.2 : 0.75), X, Y, 0.25, 1);
    if (up < SCR0) {
      const pu = (fu * 2) % 1, pv = (up - 0.45) / (SCR0 - 0.45);
      const e = Math.min(pu, 1 - pu) * FW / 2, ev = Math.min(pv, 1 - pv) * (SCR0 - 0.45) * H;
      if (e < 3 || ev < 3) return mt(M.wood, lum(l, 0, ev < 3 && pv < 0.5 ? -0.7 : 0) * 0.75, X, Y, 0.25, 1);
      if (Math.abs(Math.min(e, ev) - 7) < 1) return mt(M.gold, lum(l) * 0.7, X, Y, 0.3, 1);
      return mt(M.lacq, lum(l) * 0.75 + grain(lx, ly, 19, false) * 0.06, X, Y, 0.1, 1);
    }
    // --- the screens
    if (up < SCR1) {
      const li = Math.min(leaves - 1, Math.floor(fu * leaves));
      let lu = (lx - f0 - li * lw) / lw; // 0..1 across the leaf
      // the middle leaf slid toward the west: a gap at its east side shows the passage's warm light
      if (li === 1) {
        if (lu * lw > lw - open) {
          const gv = (up - SCR0) / (SCR1 - SCR0);
          return tn(M.glow, clamp(0.3 + Math.abs(gv - 0.35) * 0.9, 0, 1), X, Y, 0.4);
        }
        lu = (lu * lw) / (lw - open);
      }
      const ex = Math.min(lu, 1 - lu) * lw, vv = (up - SCR0) / (SCR1 - SCR0);
      const ey = Math.min(vv, 1 - vv) * (SCR1 - SCR0) * H;
      // the seam between two leaves: the light leaking through a 1 px gap
      if ((li === 2 && lu * lw < 1) || (li === 0 && (1 - lu) * lw < 1)) return P.ember[1]!;
      if (ex < 4 || ey < 4) return mt(M.wood, lum(l, 0, ey < 4 && vv > 0.5 ? -0.6 : 0) * 0.8 - dim, X, Y, 0.25, 1);
      // the kick panel low on each leaf
      if (vv < 0.16) return mt(M.lacq, lum(l) * 0.7, X, Y, 0.15, 1);
      if (Math.abs(vv - 0.16) * (SCR1 - SCR0) * H < 2) return mt(M.wood, lum(l) * 0.8, X, Y, 0.25, 1);
      // thin lattice bars over the paper
      const bx = (ex - 4) % (0.19 * H), by = (ey - 4) % (0.24 * H);
      if (bx < 1.6 || by < 1.6) return mt(M.wood, 0.32, X, Y, 0.3, 1);
      // the paper, lit from behind: a bloom round the lamp's place, dimmer up and at the ends
      const gu = fu - lampU, gv = up - lampUp;
      const bloom = Math.exp(-(gu * gu) / 0.09 - (gv * gv) / 1.1);
      // someone in the passage between the lamp and the east leaf: a soft shadow on the paper
      if (li === 2) {
        const hx = (lu - 0.45) * lw, hy = (up - 2.55) * H;
        const head = Math.hypot(hx, hy) < 0.12 * H;
        const body = hy < -0.08 * H && hy > -1.3 * H && Math.abs(hx + hy * 0.05) < 0.13 * H + (-hy - 0.1 * H) * 0.18;
        if (head || body) return tn(SCREEN, clamp(0.97 - bloom * 0.25, 0, 1), X, Y, 0.3);
      }
      return tn(SCREEN, clamp(0.9 - bloom * 0.42 - (vnoise(lx * 0.04, ly * 0.04, 23) - 0.5) * 0.08, 0, 1), X, Y, 0.45);
    }
    // --- the shelf's rail
    if (up < SHELF) return mt(M.wood, lum(l, 0, up > SHELF - 0.025 ? -0.8 : 0.3) * 0.85, X, Y, 0.2, 1);
    // --- the beam and the window high up
    if (up >= BEAM0 && up < BEAM1) {
      const bv = (up - BEAM0) / (BEAM1 - BEAM0);
      if (bv > 0.86) return mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1);
      return mt(M.wood, lum(l, 0, bv < 0.15 ? 0.8 : 0) * 0.7 - dim, X, Y, 0.25, 1);
    }
    if (up >= WIN0 && up < WIN1 && fu > 0.12 && fu < 0.88) {
      const wu = (fu - 0.12) / 0.76, wv = (up - WIN0) / (WIN1 - WIN0);
      const e = Math.min(wu * 0.76 * FW, (1 - wu) * 0.76 * FW, wv * (WIN1 - WIN0) * H, (1 - wv) * (WIN1 - WIN0) * H);
      if (e < 4) return mt(M.wood, lum(l, 0, wv > 0.9 ? -0.6 : 0) * 0.55 - dim, X, Y, 0.3, 1);
      // a deep reveal under its head
      if (wv > 0.88) return mt(M.lacq, 0.12, X, Y, 0.2, 1);
      const g = 0.16 * H;
      const gx = (((lx - f0) % g) + g) % g, gy = (((-ly) % g) + g) % g;
      if (gx < 1.8 || gy < 1.8 || (Math.abs(gx - gy) < 1.1 && hash(Math.floor((lx - f0) / g), Math.floor(-ly / g), 29) < 0.5)) return mt(M.lacq, 0.25, X, Y, 0.3, 1);
      return tn(P.tile, clamp(0.12 + (1 - wv) * 0.3 + Math.abs(wu - 0.5) * 0.35, 0, 1), X, Y, 0.5);
    }
    // --- the boarding, a long ink scroll on it
    const sw = 0.62 * H;
    const scx = f0 + FW * 0.5;
    if (up > 3.75 && up < 6.6 && Math.abs(lx - scx) < sw / 2 + 4) {
      const su = (lx - scx + sw / 2) / sw, sv = (up - 3.75) / (6.6 - 3.75);
      if (sv > 0.97) return mt(M.wood, lum(l, 0, -0.6) * 0.8, X, Y, 0.2, 1); // the rod
      if (su < 0 || su > 1) return sv > 0.05 && su > 1 ? mt(M.lacq, 0.1, X, Y, 0.2, 1) : mt(M.lacq, lum(l) * 0.7 + 0.08 - dim, X, Y, 0.15, 1); // its shadow
      if (su < 0.1 || su > 0.9 || sv < 0.06 || sv > 0.92) return mt(M.verm, lum(l) * 0.55 - dim, X, Y, 0.3, 1);
      // ink mountains under mist, the paper aged
      const ridge = 0.3 + 0.18 * Math.abs(Math.sin(su * 6.3 + 1.1)) + 0.08 * Math.sin(su * 19);
      const far = 0.55 + 0.1 * Math.sin(su * 9 + 2);
      if (sv < ridge) return mt(M.paper, 0.15 + lum(l) * 0.35 - (ridge - sv) * 0.5 - dim, X, Y, 0.3, 1);
      if (sv > far && sv < far + 0.08 && keep(X, Y, 0.5)) return mt(M.paper, 0.2 + lum(l) * 0.6 - dim, X, Y, 0.2, 1);
      return mt(M.paper, 0.3 + lum(l) * 0.7 - dim - sv * 0.08, X, Y, 0.15, 1);
    }
    const board = (((lx - f0) % (0.3 * H)) + 0.3 * H) % (0.3 * H) < 1.2;
    return mt(M.lacq, lum(l) * 0.7 + 0.08 - dim - (board ? 0.12 : 0) + grain(lx, ly, 21) * 0.08, X, Y, 0.15, 1);
  });
  // --- the shelf: two brackets under it, a lidded box, a vase and a scroll case on it
  const sy = -SHELF * H;
  for (const bu of [0.12, 0.88]) {
    const bx = f0 + FW * bu;
    poly(c, [bx - 2, sy, bx + 2, sy, bx + 2, sy + 0.24 * H, bx - 2, sy + 0.24 * H], (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly), -0.4, 0) * 0.6, X, Y, 0.25, 1));
    const reach = 0.16 * H * (bu < 0.5 ? 1 : -1);
    poly(c, [bx, sy, bx + reach, sy, bx, sy + 0.18 * H], (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly)) * 0.55, X, Y, 0.25, 1));
  }
  const items: [number, number, number, "box" | "vase" | "case"][] = [[0.14, 0.26, 0.24, "box"], [0.46, 0.14, 0.34, "vase"], [0.66, 0.3, 0.12, "case"]];
  for (const [iu, iw, ih, kind] of items) {
    const ix0 = f0 + FW * iu, ix1 = ix0 + FW * iw, ihp = ih * H;
    rect(c, ix0, sy - ihp, ix1 + 3, sy, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - ix0) / (ix1 - ix0), v = (ly - sy + ihp) / ihp;
      if (u > 1) return v > 0.25 ? mt(M.lacq, 0.08, X, Y, 0.2, 1) : 0; // its shadow on the boards
      if (kind === "vase") {
        const prof = 0.5 * (v < 0.22 ? 0.42 : Math.sin(Math.min(1, (v - 0.12) * 1.15) * Math.PI) * 0.95 + 0.05);
        if (Math.abs(u - 0.5) > prof) return 0;
        return mt(P.blue, cyl(lum(l) + 0.25, (u - 0.5) / Math.max(0.05, prof), -0.6, 0.2) * 0.9, X, Y, 0.2, 1);
      }
      if (kind === "case") {
        if (v < 0.12) return mt(M.gold, lum(l, 0, -0.8), X, Y, 0.2, 1);
        return mt(M.wood, lum(l, (u - 0.5) * 1.2, 0) * 0.85, X, Y, 0.2, 1);
      }
      // a red lacquer box, its lid's lip lit, a gold clasp
      if (v < 0.08) return mt(M.verm, lum(l, 0, -0.9) * 1.1, X, Y, 0.2, 1);
      if (Math.abs(v - 0.3) < 0.04) return mt(M.lacq, 0.2, X, Y, 0.2, 1);
      if (Math.abs(u - 0.5) < 0.06 && v > 0.32 && v < 0.5) return mt(M.gold, lum(l) * 0.9, X, Y, 0.2, 1);
      return mt(M.verm, lum(l, (u - 0.5) * 0.8, 0) * 0.7, X, Y, 0.25, 1);
    });
  }
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
    for (const px of p.posts) post(c, px, p.drop, D, lf, p.w);
    // the beam's lengths of work (round 2): [x0, x1, kind, seed]; never the same kind twice running
    const segs: [number, number, number, number][] = [];
    for (let x = -0.4 * H, i = 0, last = -1; x < p.w + H; i++) {
      const len = Math.round((1.4 + 1.8 * hash(i, 2, 77)) * H);
      let kind = Math.floor(hash(i, 3, 77) * 5);
      if (kind === last) kind = (kind + 1 + Math.floor(hash(i, 4, 77) * 3)) % 5;
      segs.push([x, x + len, kind, 900 + i * 13]);
      last = kind;
      x += len;
    }
    // the beam: a lit nosing, the carved fascia, a dark soffit edge under it
    rect(c, 0, 0, p.w, D, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      if (Math.abs(lx - p.pillar[0]) < p.pillar[1] - 2) return 0;
      if (ly < 3) return mt(M.wood, lum(l, 0, -1) * 1.15, X, Y, 0.05, 1);
      if (ly < 9) return mt(M.verm, lum(l) * 0.75, X, Y, 0.3, 1);
      if (ly > D - 6) return mt(M.lacq, lum(l) * 0.35, X, Y, 0.3, 1);
      // (hall loop round 2, W2-8: one medallion and swag every 1.65 H read as one repeat at play zoom) the beam is
      // made of lengths of different work, each 1.4 .. 3.2 H long and its own: a run of medallions on a vine, a
      // long gold-framed cartouche with a cloud relief on red, a Suzhou-painted length (teal and red bands round a
      // half-round panel with a little landscape), a plain length with a name tablet hung on it and its tassels, a
      // worn length with the gilding flaked and a newer board pieced in; iron straps at the joints
      const si = segs.findIndex(([a, b]) => lx >= a && lx < b);
      const [s0, s1, kind, sseed] = segs[si < 0 ? 0 : si]!;
      const cy = (D + 6) / 2;
      const fy = (ly - 9) / (D - 15); // 0 under the red band .. 1 over the soffit edge
      const sl = s1 - s0, su = (lx - s0) / sl, sm = lx - (s0 + s1) / 2;
      // the joint: two beams butted, a dark split and an iron strap with rivets across it
      if (lx - s0 < 7 || s1 - lx < 1) {
        if (lx - s0 < 1) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.3, 1);
        const rv = Math.abs(lx - s0 - 4) < 1.2 && (Math.abs(fy - 0.25) < 0.08 || Math.abs(fy - 0.75) < 0.08);
        return rv ? mt(M.bronze, lum(l, 0, -0.5) * 1.1, X, Y, 0.1, 1) : mt(M.lacq, lum(l, 0, ly < cy ? -0.4 : 0.4) * 0.45 + 0.05, X, Y, 0.2, 1);
      }
      const base = (): number => mt(M.lacq, lum(l) * 0.7 + grain(lx, ly, 19, false) * 0.08, X, Y, 0.05, 1);
      if (kind === 0) {
        // medallions on a vine: two or three across the length, one fallen out of its socket now and then
        const n = sl > 2.4 * H ? 3 : 2;
        const mi = Math.min(n - 1, Math.floor(su * n));
        const m = (su * n - mi - 0.5) * sl / n;
        const d = Math.hypot(m * 0.85, ly - cy);
        const mk = hash(mi, sseed, 71);
        if (d < 0.13 * H) {
          if (mk < 0.12) return d > 0.1 * H ? mt(M.lacq, lum(l) * 0.35, X, Y, 0.2, 1) : mt(M.lacq, lum(l) * 0.5, X, Y, 0.2, 1);
          const ring = d > 0.1 * H;
          const ang = Math.atan2(ly - cy, m);
          const inner = mk < 0.45 ? Math.sin(ang * 8) > 0.1 : mk < 0.75 ? Math.abs(m) > 0.035 * H || Math.abs(ly - cy) > 0.035 * H : Math.cos(ang * 5) > 0.3;
          return mt(M.gold, lum(l, m / (0.3 * H), (ly - cy) / (0.3 * H)) * (ring ? 0.85 : inner ? 0.7 : 0.45), X, Y, 0.2, 1);
        }
        const vine = fbm(lx * 0.03, 2.2, 73, 2) < 0.62 && Math.abs(ly - cy - Math.sin(lx * 0.07 + mi) * 5) < 0.8 / c.d && Math.abs(m) > 0.2 * H;
        return vine ? mt(M.gold, lum(l) * 0.6, X, Y, 0.3, 1) : base();
      }
      if (kind === 1) {
        // a long cartouche: a gold frame, a red ground, a running cloud scroll in raised gold
        const e = Math.min(lx - s0 - 0.18 * H, s1 - lx - 0.18 * H, (fy - 0.12) * (D - 15), (0.88 - fy) * (D - 15));
        if (e < 0) return base();
        if (e < 2) return mt(M.gold, lum(l, 0, fy < 0.5 ? -0.6 : 0.6) * 0.85, X, Y, 0.15, 1);
        if (e < 3.5) return mt(M.lacq, lum(l) * 0.3, X, Y, 0.2, 1);
        // its ground; the cloud scrolls in raised gold are laid over it after (below)
        return mt(M.verm, lum(l) * 0.45 + (fbm(lx * 0.05, ly * 0.1, sseed, 2) - 0.5) * 0.08, X, Y, 0.3, 1);
      }
      if (kind === 2) {
        // a Suzhou-painted length: teal and red bands toward each end, a half-round panel in its middle with a
        // little ink landscape on cream, a gold rim round it
        // the panel hangs from the beam's top like a cloth over it: its flat side up, its curve down
        const hw = Math.min(0.62 * H, sl * 0.3);
        const ar = Math.hypot(sm / hw, (ly - 9) / ((D - 15) * 0.92));
        if (ar < 1) {
          if (ar > 0.88) return mt(M.gold, lum(l) * 0.7, X, Y, 0.2, 1);
          const pu = sm / hw, pv = (ly - 9) / (D - 15);
          // a dark ground with a pale far ridge across it in mist
          const ridge = 0.45 + 0.16 * Math.abs(Math.sin(pu * 4 + sseed)) + 0.06 * Math.sin(pu * 13);
          if (pv > ridge && pv < ridge + 0.14) return mt(M.paper, 0.1 + lum(l) * 0.4, X, Y, 0.3, 1);
          return tn(P.jade, clamp(0.86 + (1 - lum(l)) * 0.12 - (pv > ridge ? 0 : 0.04), 0, 1), X, Y, 0.3);
        }
        // the end bands (a gold line, a teal band, a red one) only near each end; between them and the panel the
        // beam's own dark lacquer with a thin gold line along it
        const fromEnd = Math.min(lx - s0, s1 - lx) / H;
        if (fromEnd < 0.42) {
          const r = Math.floor(fromEnd / 0.14);
          if (Math.abs(fromEnd - r * 0.14) < 0.02) return mt(M.gold, lum(l) * 0.55, X, Y, 0.3, 1);
          return r === 1 ? tn(P.jade, clamp(0.84 + (1 - lum(l)) * 0.15, 0, 1), X, Y, 0.3) : mt(M.verm, lum(l) * 0.42, X, Y, 0.3, 1);
        }
        if (Math.abs(fy - 0.5) < 0.04) return mt(M.gold, lum(l) * 0.5, X, Y, 0.3, 1);
        return base();
      }
      if (kind === 3) {
        // a plain length with a name tablet hung on it: black lacquer, a gold edge, a gilt seal (its tassels hang below)
        const tw = 0.42 * H;
        const e = Math.min(tw - Math.abs(sm), (fy - 0.06) * (D - 15), (0.94 - fy) * (D - 15));
        if (e > 0) {
          if (e < 1.8) return mt(M.gold, lum(l, sm < 0 ? -0.5 : 0.5, fy < 0.5 ? -0.7 : 0.4) * 0.9, X, Y, 0.1, 1);
          if (Math.hypot(sm, ly - cy) < 0.08 * H) return mt(M.gold, lum(l) * 0.7, X, Y, 0.3, 1);
          return mt(M.lacq, lum(l) * 0.3, X, Y, 0.2, 1);
        }
        // its shadow on the beam, down and right
        if (sm > tw && sm < tw + 3 && fy > 0.15) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.3, 1);
        return base();
      }
      // a worn length: the gilding flaked, bare timber showing, a newer board pieced in with its nails
      const pz0 = s0 + sl * (0.3 + 0.3 * hash(sseed, 3, 75)), pz1 = pz0 + 0.55 * H;
      if (lx > pz0 && lx < pz1 && fy > 0.1 && fy < 0.9) {
        const nail = Math.abs(lx - pz0 - 3) < 1 || Math.abs(pz1 - lx - 3) < 1;
        if (nail && (Math.abs(fy - 0.25) < 0.06 || Math.abs(fy - 0.75) < 0.06)) return mt(M.bronze, lum(l) * 0.8, X, Y, 0.2, 1);
        return mt(M.wood, lum(l, 0, fy < 0.15 ? -0.5 : 0) * 0.75 + grain(lx, ly, sseed, false) * 0.15, X, Y, 0.2, 1);
      }
      const f = fbm(lx * 0.035, ly * 0.09, sseed, 3);
      if (f > 0.6) return mt(M.wood, lum(l) * 0.45 + grain(lx, ly, sseed + 1, false) * 0.1, X, Y, 0.3, 1);
      if (f > 0.57) return mt(M.gold, lum(l) * 0.4, X, Y, 0.3, 1);
      return base();
    });
    // the cartouches' cloud scrolls: curls facing each other in pairs along the red ground, raised gold
    for (const [s0, s1, kind, sseed] of segs) {
      if (kind !== 1) continue;
      const cy = Math.round((D + 6) / 2), r = Math.max(4, Math.round((D - 15) * 0.22));
      const n = Math.max(2, Math.floor((s1 - s0 - 0.4 * H) / (0.55 * H)));
      for (let k = 0; k < n; k++) {
        const x = s0 + 0.2 * H + (k + 0.5) * (s1 - s0 - 0.4 * H) / n;
        if (x < 0 || x > p.w || Math.abs(x - p.pillar[0]) < p.pillar[1] + r) continue;
        const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
        cloudScroll(c, Math.round(x - dir * r * 0.6), cy + (hash(k, sseed, 79) < 0.5 ? -1 : 1), r, dir, Math.round(0.16 * H), (X, Y, lx, ly) => mt(M.gold, lum(lf.get(lx, ly), 0, ly < cy ? -0.5 : 0.4) * 0.85, X, Y, 0.2, 1));
      }
    }
    // the tablets' tassels, hung below the beam
    for (const [s0, s1, kind] of segs) {
      if (kind !== 3) continue;
      const mid = (s0 + s1) / 2;
      for (const tx of [mid - 0.36 * H, mid + 0.36 * H]) {
        rect(c, tx - 1.5, D - 2, tx + 1.5, D + 0.32 * H, (X, Y, lx, ly) => {
          const v = (ly - D) / (0.32 * H);
          if (v < 0.12) return Math.abs(lx - tx) < 1 ? mt(M.gold, lum(lf.get(lx, ly)) * 0.8, X, Y, 0.2, 1) : 0;
          if (v < 0.25) return mt(M.gold, lum(lf.get(lx, ly)) * 0.7, X, Y, 0.2, 1);
          return mt(M.verm, lum(lf.get(lx, ly), (lx - tx) / 2, 0) * 0.65, X, Y, 0.3, 1);
        });
      }
    }
  },
});

function post(c: PaintCtx, px: number, drop: number, D: number, lf: LitField, beamEnd?: number): void {
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
    // (hall loop round 2, W1-1) no corbel reaching out from a post past the beam's end (the dark flap at the
    // stair's head): it carries nothing there
    if (beamEnd !== undefined && s2 > 0 && px + capW + 0.46 * H > beamEnd) continue;
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

// (hall loop round 2: the stair is its own module now, stair.ts: two flights and a landing on posts)

/** A column base standing on a floor `fy` px below the local origin. */
function colBaseAt(c: PaintCtx, cx: number, fy: number, r: number, top: number, k: number, side: number, seed: number): void {
  const shifted = { ...c, Y: (v: number) => c.Y(v + fy), ly: (v: number) => c.ly(v) - fy };
  colBase(shifted as PaintCtx, cx, r, top, k, side, seed);
}

export { P, hash, keep, tn };
