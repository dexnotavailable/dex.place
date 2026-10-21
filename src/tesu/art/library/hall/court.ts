// The Prize Court on the prow (GDK 5.1, A.3), in the morning: the paved arena with the great
// inked seal lying on it, its masonry foundation (a gold-figured frieze, pilasters, courses
// stepping down onto the karst), the gatehouse porch built against the hall's east wall, the
// Prize Board under its release banner, Bao's gong tower with the great bronze gong (a sprite
// that swings when struck), stone lantern pillars, the Prow Stair's mouth framed by newel
// posts, and at the tip a bench and a stone rail where the land falls away.
//
// Daylight from the upper left (COURT_LIGHT): lit faces up and left, shadows down and right.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { bayer4 } from "../../raster.ts";
import { P } from "../../palette.ts";
import { paintPodium } from "./court-stone.ts";
import { paintFoundation } from "./court-found.ts";
import { COURT_LIGHT } from "./lights.ts";
import { tileRoof } from "./furniture.ts";
import { cloudScroll, plumCrest, rosette, text, textWidth, trophy } from "./signs.ts";
import { M, LitField, bevel, clamp, colBase, cyl, face, fbm, grain, hash, keep, lathe, mt, rect, tn, vnoise, type Ramp } from "./kit.ts";

const H = 96;
const SIDE = -1; // the sun is up and to the left

const lacq = M.lacqDay;
const day = (k = 0.92): number => k;

function woodBox(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, seed: number, lo = 0.1, hi = 1, bev = 3, k = 0.92): void {
  const w = x1 - x0, h = y1 - y0;
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const [nx, ny] = bevel((lx - x0) / w, (ly - y0) / h, bev / w, bev / h);
    return mt(ramp, face(k, SIDE, nx, ny) + grain(lx, ly, seed, h > w) * 0.08, X, Y, lo, hi);
  });
}

function fitting(c: PaintCtx, x: number, y: number, sx: number, sy: number, s = 7): void {
  rect(c, Math.min(x, x + sx * s), Math.min(y, y + sy * s), Math.max(x, x + sx * s), Math.max(y, y + sy * s), (X, Y, lx, ly) => {
    const dx = Math.abs(lx - x), dy = Math.abs(ly - y);
    if (dx > 2.4 && dy > 2.4) return 0;
    return mt(M.gold, face(day(), SIDE, sx * 0.3, -sy * 0.3) * 1.05, X, Y, 0.0, 1);
  });
}

// ---------------------------------------------------------------------------
// The arena's floor surface (P3): paving receding from the stands to the play line, the great
// seal lying on it (an ink ring, a square seal, its script left in the stone)
// ---------------------------------------------------------------------------
export interface CourtFloorP {
  w: number;
  /** Plane px per H; how far down it runs. */
  u: number;
  below: number;
  /** The seal's centre (local px) and its radius (px across). */
  seal: [number, number];
}

export const courtFloor = definePainter<CourtFloorP>("court.floor", {
  bounds(p) {
    return [0, -p.below - 0.6 * H, p.w, 2];
  },
  paint(c, p) {
    // (hall loop round 2, W2-10: round 1's receding paving with diagonal shadows was a 3D top) the
    // floor is the walk line seen edge-on; the band behind it is the stands' podium, face-on (court-stone.ts)
    paintPodium(c, { w: p.w, below: p.below });
  },
});

// ---------------------------------------------------------------------------
// The foundation (play): the floor's coping (the walk line), a frieze of gold cartouches on
// grey stone, pilasters, courses stepping down; its foot follows the rock it is built on
// ---------------------------------------------------------------------------
export interface FoundationP {
  w: number;
  /** Depth of the masonry below the floor line (px) at each end and in the middle. */
  depth: number;
  /** The stairwell's mouth (local x range) where the coping breaks and the walls return. */
  well?: [number, number];
  /** Pilasters (local x). */
  pilasters: number[];
  /** (hall loop round 1) Where the frieze breaks for its one carved panel (local x; default 0.36 of w). */
  centre?: number;
}

export const foundation = definePainter<FoundationP>("court.foundation", {
  bounds(p) {
    return [-6, -4, p.w + 6, p.depth + 0.8 * H];
  },
  paint(c, p) {
    // (hall loop round 2, W2-11: round 1's was a uniform ashlar tile under a stamped frieze) chunks, never a
    // tile (court-found.ts)
    paintFoundation(c, p);
  },
});

// ---------------------------------------------------------------------------
// The gatehouse porch: vermilion posts on stone bases, a lacquer lintel, the doors ajar with
// the hall's warm light between them, its own small tiled roof against the hall's wall
// ---------------------------------------------------------------------------
export interface GateP {
  /** Width of the porch and the height of its doors (px); the anchor is its west end on the floor. */
  w: number;
  h: number;
}

export const gatehouse = definePainter<GateP>("court.gatehouse", {
  bounds(p) {
    return [-0.5 * H, -p.h - 1.4 * H, p.w + 0.6 * H, 4];
  },
  paint(c, p) {
    const W = p.w, D = p.h;
    const lf = new LitField(COURT_LIGHT, undefined, 16);
    void lf;
    // the wall the doors sit in: dark lacquer panels behind
    woodBox(c, 0, -D - 0.6 * H, W, 0, lacq, 3, 0.25, 1, 2);
    // the doors: two leaves ajar, warm light from the hall between them
    const d0 = 0.22 * W, d1 = 0.78 * W;
    rect(c, d0, -D, d1, 0, (X, Y, lx, ly) => {
      const u = (lx - d0) / (d1 - d0), v = (ly + D) / D;
      if (Math.abs(u - 0.5) < 0.07) return tn(M.glow, clamp(0.15 + v * 0.35, 0, 1), X, Y, 0.4);
      const leaf = u < 0.5 ? u / 0.43 : (1 - u) / 0.43;
      const stud = Math.hypot((((leaf * (d1 - d0) * 0.43) % 14) + 14) % 14 - 7, (((v * D) % 16) + 16) % 16 - 8) < 2.2 && v > 0.05 && v < 0.95;
      if (stud) return mt(M.gold, face(0.9, SIDE, 0, -0.5) * 0.9, X, Y, 0.1, 1);
      return mt(M.verm, face(0.9, SIDE, u < 0.5 ? -0.2 : 0.4, 0) * 0.75 + grain(lx, ly, 5, false) * 0.05, X, Y, 0.2, 1);
    });
    // posts on stone bases
    for (const px of [0.1 * W, 0.9 * W]) {
      colBase(c, px, 0.13 * H, 0.42 * H, 0.95, SIDE, 7);
      lathe(c, px, -D - 0.6 * H, -0.42 * H, () => 0.13 * H, (X, Y, u, _lx, ly) => {
        const band = -ly > D + 0.3 * H || (-ly > 1.0 * H && -ly < 1.15 * H);
        return band ? mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.05, 1) : mt(M.verm, cyl(0.95, u, SIDE, 0.15) * 0.85, X, Y, 0.1, 1);
      });
    }
    // the lintel with a plaque, then the roof
    woodBox(c, -0.1 * W, -D - 0.6 * H, 1.1 * W, -D - 0.25 * H, lacq, 9, 0.1, 1, 3);
    rect(c, 0.3 * W, -D - 0.56 * H, 0.7 * W, -D - 0.29 * H, (X, Y, lx, ly) => {
      const u = (lx - 0.3 * W) / (0.4 * W), v = (ly + D + 0.56 * H) / (0.27 * H);
      if (u < 0.05 || u > 0.95 || v < 0.1 || v > 0.9) return mt(M.gold, face(0.9, SIDE) * 0.95, X, Y, 0.05, 1);
      return mt(lacq, 0.4, X, Y, 0.1, 1);
    });
    // (round 2, W1-2: no pseudo-script) the plaque's mark: the hall's plum-blossom crest between two cloud scrolls
    {
      const pcx = Math.round(0.5 * W), pcy = Math.round(-D - 0.425 * H), r = Math.max(6, Math.round(0.27 * H * 0.8 / 2 - 1));
      plumCrest(c, pcx, pcy, r, (X, Y) => mt(M.gold, 0.92, X, Y, 0.05, 1), (X, Y) => mt(lacq, 0.25, X, Y, 0.1, 1), (X, Y) => mt(M.gold, 1.1, X, Y, 0.05, 1));
      const tail = Math.max(4, 0.2 * W - r - 12);
      cloudScroll(c, Math.round(0.3 * W + 7), pcy - 1, 3, 1, tail, (X, Y) => mt(M.gold, 0.85, X, Y, 0.05, 1));
      cloudScroll(c, Math.round(0.7 * W - 7), pcy - 1, 3, -1, tail, (X, Y) => mt(M.gold, 0.85, X, Y, 0.05, 1));
    }
    tileRoof(c, new LitField(COURT_LIGHT, undefined, 16), SIDE, -0.45 * W, 1.45 * W, -D - 0.6 * H, 0.75 * H, 3);
  },
});

// ---------------------------------------------------------------------------
// The Prize Board: a black-lacquer board on legs, a small roof, one gold-framed plaque per
// product with its champion's emblem; over it on two poles the newest release's banner
// ---------------------------------------------------------------------------
export interface BoardP {
  plaques: string[];
}

/**
 * (hall loop round 2, W2-14: round 1's red blob face and purple cone hat read as clip art) each product's
 * mark as an enamel seal: a round gold bezel lit from the upper left with a glint on its shoulder, a glossy
 * enamel field (its own sheen arc, darker toward the lower right), the mark raised in it in gold wire and
 * enamel. dexClient: the guardian lion's head (the banner's lion, the same drawing) on red enamel; dexCode:
 * Yuki's crooked mage hat in violet enamel, her red gem on its band, frost glints round it, on ice-blue.
 */
function emblem(c: PaintCtx, id: string, cx: number, cy: number, s: number): void {
  const R = 15 * s, RIM = Math.max(3, 0.16 * R);
  const lion = id === "dexclient";
  const FIELD: Ramp = lion ? M.verm : [P.blue[0]!, P.blue[1]!, P.blue[2]!, P.blue[3]!, P.blue[4]!, P.ink[1]!];
  // Yuki's hat in the field's unit coords: the brim's ellipse, the cone leaning, its tip bent over
  const hatCone = (u: number, v: number): boolean => {
    if (v > 0.3 || v < -0.72) return false;
    const t = (0.3 - v) / 1.02; // 0 at the brim .. 1 at the tip
    const axis = 0.06 + t * t * 0.32;
    return Math.abs(u - axis) < 0.3 * (1 - t) + 0.03;
  };
  const hatBrim = (u: number, v: number): boolean => Math.hypot(u / 0.66, (v - 0.33) / 0.12) < 1;
  const inHat = (u: number, v: number): boolean => hatCone(u, v) || hatBrim(u, v);
  rect(c, cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1, (X, Y, lx, ly) => {
    const dx = lx - cx, dy = ly - cy, d = Math.hypot(dx, dy);
    if (d > R) return 0;
    const nx = dx / R, ny = dy / R;
    if (d > R - RIM) {
      // the bezel: rounded, so it faces up-left on the upper left and away on the lower right
      const t = (d - (R - RIM)) / RIM;
      if (t < 0.18) return mt(M.gold, 0.32, X, Y, 0.1, 1);
      const roll = (t - 0.55) * 1.6;
      const lit = face(0.98, SIDE, nx * roll, ny * roll) * 1.02;
      if (Math.abs(Math.atan2(ny, nx) + 2.3) < 0.18 && t > 0.4 && t < 0.75) return mt(M.paper, 1.1, X, Y, 0.0, 1);
      return mt(M.gold, lit, X, Y, 0.0, 1);
    }
    const f = R - RIM;
    const u = dx / f, v = dy / f;
    // the enamel's gloss: a sheen arc along the upper left inside the bezel, a darker lower right
    const sheen = Math.abs(Math.hypot(u + 0.12, v + 0.12) - 0.86) < 0.06 && u + v < -0.5;
    const field = (): number => {
      if (sheen) return lion ? mt(M.verm, 1.0, X, Y, 0.0, 1) : mt(FIELD, 1.05, X, Y, 0.0, 1);
      return mt(FIELD, 0.72 - (u + v) * 0.14 - Math.hypot(u, v) * 0.08, X, Y, lion ? 0.15 : 0.05, 1, 0.3);
    };
    if (lion) {
      const st = lionThread(u / 0.66, (v + 0.02) / 0.6, lx, ly, 0.9, X, Y);
      return st || field();
    }
    // Yuki's hat: violet enamel in gold wire, lit up and left; its band gold with her red gem
    const wire = inHat(u, v) && !(inHat(u - 0.07, v) && inHat(u + 0.07, v) && inHat(u, v - 0.07) && inHat(u, v + 0.07));
    if (wire) return mt(M.gold, face(0.95, SIDE, -0.3, -0.3) * 0.95, X, Y, 0.0, 1);
    if (hatBrim(u, v)) return mt(P.violet, face(0.95, SIDE, u * 0.6, -0.2) * 0.8 - (v > 0.36 ? 0.12 : 0), X, Y, 0.0, 1);
    if (hatCone(u, v)) {
      const band = v > 0.1 && v < 0.24;
      if (band) return Math.hypot(u - 0.08, v - 0.17) < 0.09 ? mt(M.verm, Math.hypot(u - 0.05, v - 0.14) < 0.03 ? 1.1 : 0.85, X, Y, 0.0, 1) : mt(M.gold, 0.85, X, Y, 0.0, 1);
      const t = (0.3 - v) / 1.02, axis = 0.06 + t * t * 0.32;
      const across = (u - axis) / (0.3 * (1 - t) + 0.03);
      return mt(P.violet, face(0.95, SIDE, across * 0.8, -0.2) * 0.9, X, Y, 0.0, 1);
    }
    // frost glints in the field: small four-point stars
    for (const [sx, sy, sr] of [[-0.55, -0.32, 0.13], [0.55, -0.55, 0.09], [-0.4, 0.62, 0.08]] as const) {
      const ax = Math.abs(u - sx), ay = Math.abs(v - sy);
      if ((ax < 0.02 && ay < sr) || (ay < 0.02 && ax < sr) || ax + ay < 0.035) return mt(P.snow, 1.0 - (ax + ay) * 2, X, Y, 0.0, 1);
    }
    return field();
  });
}

/**
 * (hall loop round 2, W2-13: round 1's dot-eyed, grid-toothed mask read as a cartoon) the guardian lion's
 * head, embroidered on the release banner (and raised on the dexClient seal) in the gacha idiom: a mane
 * of snail-shell curls in two rings with a curled beard under the chin, a heavy carved brow, fierce
 * slanted eyes with gold irises, a broad nose with flared nostrils, curled cheeks, an open mouth with
 * fangs, a tongue; a small bronze jewel on the brow. Gold satin on red lacquer, every part in thread
 * (stitch grooves along its own direction), lit by the cloth's fold under it. (u, v) is the cloth point
 * in the face's unit circle; 0 where the head isn't.
 */
function lionThread(u: number, v: number, lx: number, ly: number, lit: number, X: number, Y: number): number {
  const r = Math.hypot(u, v);
  const groove = (dir: number): number => ((((lx * dir + ly) % 3) + 3) % 3 < 1 ? -0.07 : 0);
  const gold = (k: number): number => mt(M.gold, lit * k, X, Y, 0.12, 1);
  const red = (k: number): number => mt(M.verm, lit * k, X, Y, 0.2, 1);
  // a snail-shell curl at (cu, cv), radius cr: gold coils, its spiral groove red lacquer, lit up and left
  const curl = (cu: number, cv: number, cr: number): number => {
    const du = u - cu, dv = v - cv, d = Math.hypot(du, dv) / cr;
    if (d > 1) return 0;
    const sp = (((Math.atan2(dv, du) / (Math.PI * 2) + d * 1.9) % 1) + 1) % 1;
    if (sp < 0.27 && d > 0.15) return red(0.5 - d * 0.1);
    return gold(0.95 - (du + dv) / cr * 0.18 - d * 0.12);
  };
  // --- the face (drawn over the mane's inner ring)
  if (r < 0.9 && v > -0.95) {
    // the jewel on the brow
    const jr = Math.hypot(u, v + 0.6);
    if (jr < 0.11) return mt(M.bronze, lit * (jr < 0.04 ? 1.15 : u + v + 0.6 < 0 ? 1.0 : 0.65), X, Y, 0.0, 1);
    if (jr < 0.15) return gold(0.55);
    // the brow: two heavy ridges arching over the eyes, lit along their tops, a shadow under them
    const au = Math.abs(u);
    if (au > 0.06 && au < 0.74) {
      const vb = -0.27 - 0.11 * Math.sin(Math.PI * Math.min(1, (au - 0.06) / 0.68));
      const dv = v - vb;
      if (dv > -0.07 && dv < 0.06) return gold(dv < -0.03 ? 1.08 : 0.82 + groove(1.4) * 0.5);
      if (dv >= 0.06 && dv < 0.1) return red(0.42);
    }
    // (round 3, W2-11: dot eyes) the eyes: big almonds, fierce (outer corners up), a heavy ink upper lid that
    // sweeps out past the corner, a gold iris filling most of the eye, a slit pupil, a glint; the white only at
    // the inner corner
    for (const sgn of [-1, 1]) {
      const du = u - sgn * 0.34, dv = v + 0.1 + du * 0.45 * sgn;
      const e = (du / 0.24) ** 2 + (dv / 0.11) ** 2;
      const lid = dv < -0.04 && dv > -0.16 && Math.abs(du + sgn * 0.03) < 0.27 && e < 2.1 && e > 0.55;
      if (lid) return tn(M.ink, 0.0, X, Y, 0);
      if (e < 1) {
        if (e > 0.7 && dv > 0) return tn(M.ink, 0.3, X, Y, 0);
        if (Math.abs(du) < 0.022 && Math.abs(dv) < 0.075) return tn(M.ink, 0.0, X, Y, 0);
        if (Math.hypot(du + 0.05 * sgn, dv + 0.035) < 0.025) return mt(M.paper, 1.1, X, Y, 0.0, 1);
        if (Math.abs(du) < 0.16) return mt(M.gold, 1.0 - Math.abs(du) * 1.5 - (dv < -0.02 ? 0.2 : 0), X, Y, 0.0, 1);
        return du * sgn < 0 ? mt(M.paper, lit * 0.85, X, Y, 0.1, 1) : mt(M.gold, 0.6, X, Y, 0.1, 1);
      }
    }
    // the cheeks: a curl on each side
    for (const sgn of [-1, 1]) {
      const k = curl(sgn * 0.6, 0.18, 0.2);
      if (k) return k;
    }
    // the mouth: open, an ink lip line round it, fangs down from the top and up from the bottom, a tongue
    if (v > 0.33 && v < 0.82) {
      const t = (v - 0.33) / 0.49;
      const half = 0.46 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2 * 0.55));
      if (au < half) {
        if (au > half - 0.045 || t < 0.06 || t > 0.95) return tn(M.ink, 0.3, X, Y, 0);
        // the fangs: two long ones from the top, two short from the bottom
        if (Math.abs(au - 0.27) < 0.055 * (1 - (t - 0.06) / 0.45) && t < 0.5) return mt(M.paper, lit * (u < 0 ? 1.05 : 0.85), X, Y, 0.0, 1);
        if (Math.abs(au - 0.17) < 0.045 * (1 - (0.95 - t) / 0.32) && t > 0.62) return mt(M.paper, lit * 0.9, X, Y, 0.0, 1);
        // (round 3, W2-11: a grid of teeth) the upper gum dark under the lip, two small incisors between the fangs
        if (t < 0.16) return au < 0.11 && t > 0.06 ? mt(M.paper, lit * 0.8, X, Y, 0.1, 1) : red(0.12);
        // the tongue and the dark of the mouth
        if (Math.hypot(u / 0.24, (t - 0.78) / 0.16) < 1) return mt(P.red, lit * 0.8, X, Y, 0.0, 1);
        return red(0.18);
      }
    }
    // the nose: a broad bulb, its bridge lit on the left, flared nostrils
    const nb = Math.hypot(u / 0.21, (v - 0.13) / 0.13);
    for (const sgn of [-1, 1]) if (Math.hypot(u - sgn * 0.1, v - 0.19) < 0.045) return tn(M.ink, 0.4, X, Y, 0);
    if (nb < 1) return gold((u < -0.05 ? 1.05 : 0.82) - (v > 0.19 ? 0.12 : 0) + groove(-0.5));
    if (au < 0.07 && v > -0.3 && v < 0.05) return gold((u < 0 ? 1.0 : 0.78) + groove(-0.4));
    // the face: gold satin, its stitches running diagonally, a little noise in the thread
    return gold(0.78 - (u + v) * 0.08 + groove(0.8) + (vnoise(lx * 0.4, ly * 0.4, 13) - 0.5) * 0.05);
  }
  // --- the mane: two rings of curls round the face, a curled beard under the chin
  const ang = Math.atan2(v, u);
  if (v < 0.75) {
    for (const [ring, n, cr, off] of [[1.0, 13, 0.21, 0], [1.26, 15, 0.18, 0.5]] as const) {
      const k = Math.round(((ang / (Math.PI * 2)) * n) - off);
      for (const kk of [k - 1, k, k + 1]) {
        const a = ((kk + off) / n) * Math.PI * 2;
        const cv = Math.sin(a) * ring;
        if (cv > 0.75) continue;
        const cc = curl(Math.cos(a) * ring, cv, cr);
        if (cc) return cc;
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    const bu = (i - 2) * 0.22, bv = 0.95 + (i % 2) * 0.16 + Math.abs(i - 2) * -0.05;
    const cc = curl(bu, bv, 0.17);
    if (cc) return cc;
  }
  // the dark lacquer between the curls, so the mane reads as one mass
  if (r < 1.2 && v < 0.85) return red(0.3);
  if (Math.abs(u) < 0.55 && v > 0.8 && v < 1.08) return red(0.3);
  return 0;
}

/** The prize cards' paper where it turns from the sun (round 3): a cool grey cream. */
const CARD_COOL: Ramp = [P.cloud[2]!, P.stone[1]!, P.stone[2]!, P.stone[3]!];

/** The release banner's silk: an old red, faded a step, its folds going into the warm dark. */
const SILK: Ramp = [P.red[2]!, P.red[3]!, P.red[4]!, P.red[5]!, P.umber[1]!, P.umber[2]!, P.umber[3]!];

export const board = definePainter<BoardP>("court.board", {
  bounds() {
    return [-1.5 * H, -4.4 * H, 1.5 * H, 4];
  },
  paint(c, p) {
    const plaques = p.plaques.length ? p.plaques : ["dexclient", "dexcode"];
    // (round 2, W1-8: the board is the court's first read) a bigger board under a lit header with a gold prize
    // cup, two large framed prize cards each pinned with an award rosette and named in pixel letters; the
    // release banner over it a step smaller and darker, so it reads second
    const bw = 2.4 * H, bh = 1.62 * H, by1 = -0.62 * H, by0 = by1 - bh;
    const hh = 0.36 * H, hx0 = -bw / 2 - 0.12 * H, hx1 = bw / 2 + 0.12 * H, hy0 = by0 - hh, hy1 = by0 + 3;
    // the banner's poles (behind) and the banner: red silk, gold border, the champion's face
    const poleTop = -4.12 * H;
    for (const px of [-0.98 * H, 0.92 * H]) {
      lathe(c, px, poleTop, 0, () => 4, (X, Y, u) => mt(lacq, cyl(0.95, u, SIDE, 0.2), X, Y, 0.0, 1));
      lathe(c, px, poleTop - 0.15 * H, poleTop + 0.05 * H, () => 6, (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
    }
    woodBox(c, -1.05 * H, poleTop + 0.05 * H, 1.05 * H, poleTop + 0.15 * H, lacq, 2, 0.05, 1, 2);
    const bx0 = -0.76 * H, bx1 = 0.76 * H, ty0 = poleTop + 0.15 * H, ty1 = hy0 - 0.5 * H;
    // (hall loop round 1) the release banner as cloth: heavy red silk hanging from the bar in soft
    // folds that open toward a weighted hem, the morning wind pushing its lower half to the right,
    // a twill weave, a gold fringe; the champion's face embroidered in gold thread on it
    const bwid = bx1 - bx0, drop = ty1 - ty0;
    const LION_S = 3.15 * (drop / (1.9 * H)), LION_CY = ty0 + drop * 0.46;
    const wind = (v: number): number => 4 * v ** 1.5 + 1.0 * Math.sin(v * 5);
    const foldAt = (u: number, v: number): [number, number] => {
      // the surface's height across (folds) and its slope (which way it faces)
      const A = 2.0 + 1.4 * Math.sin(v * 2.4);
      const ph = u * Math.PI * 2 * 2.6 + Math.sin(u * 7.1) * 0.9 + v * 0.8;
      return [A * Math.sin(ph), A * Math.cos(ph) * (Math.PI * 2 * 2.6) / bwid];
    };
    rect(c, bx0 - 4, ty0, bx1 + 12, ty1 + 0.3 * H, (X, Y, lx, ly) => {
      const v = (ly - ty0) / drop;
      if (v < 0 || v > 1.16) return 0;
      const ex = lx - wind(v);
      const u0 = (ex - bx0) / bwid;
      const [hgt, slope] = foldAt(u0, v);
      const u = (ex + hgt * 0.35 * (Math.abs(u0 - 0.5) > 0.42 ? 1 : 0) - bx0) / bwid;
      if (u < 0 || u > 1) return 0;
      // the fringe under the hem: gold threads of uneven length, swinging with the wind
      if (v > 1.0) {
        const th = Math.floor(ex / 2.2);
        const len = 0.07 + 0.08 * hash(th, 3, 17);
        if (v - 1.0 > len || ((ex % 2.2) + 2.2) % 2.2 > 1.3) return 0;
        return mt(M.gold, 0.62 - (v - 1) * 2.5 - slope * 0.6, X, Y, 0.15, 1);
      }
      // light: the side facing the sun (slope < 0 faces left) brighter, the far half in shade; (round 2) the
      // whole banner a step darker than before, so the board under it is the brightest thing here
      const lit = face(0.95, SIDE) * (0.82 - u * 0.16) - slope * 0.7 - (v > 0.03 && v < 0.07 ? 0.12 : 0);
      const weave = (X + Y) % 3 === 0 ? -0.035 : 0;
      // the gold border and the weighted hem band (a heavier double hem), following the folds
      if (u < 0.05 || u > 0.95 || v < 0.03 || (v > 0.9 && v < 0.97)) return mt(M.gold, lit * 0.9 + weave, X, Y, 0.15, 1);
      if (v >= 0.97) return mt(M.verm, lit * 0.6, X, Y, 0.35, 1);
      if (u < 0.08 || u > 0.92 || (v > 0.86 && v <= 0.9)) return mt(M.gold, lit * 0.55, X, Y, 0.25, 1);
      const cx = (ex - 0) / (LION_S * 15), cy = (ly - LION_CY) / (LION_S * 13);
      if (plaques[0] === "dexclient") {
        const st = lionThread(cx, cy, lx, ly, lit, X, Y);
        if (st) return st;
      }
      // the silk: a damask of faint rays round the emblem, woven in
      const ang = Math.atan2(v - 0.42, (u - 0.5) * 1.1);
      const ray = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 18) % 2 === 0;
      // (round 3, W2-11: the banner was the most saturated thing in the frame, S 0.72) old silk, its red faded a step
      // and going into the warm dark in the folds
      return mt(SILK, lit * (ray ? 0.84 : 0.78) + weave, X, Y, 0.0, 1);
    });
    if (plaques[0] !== "dexclient") emblem(c, plaques[0]!, 0, LION_CY, LION_S);
    // the board's legs, its frame
    for (const lx0 of [-1.1 * H, 1.0 * H]) woodBox(c, lx0, by0 + 0.2 * H, lx0 + 0.11 * H, 0, lacq, 3, 0.05, 1, 2);
    rect(c, -1.1 * H, -0.28 * H, 1.11 * H, -0.24 * H, (X, Y) => mt(lacq, 0.6, X, Y, 0.1, 1));
    woodBox(c, -bw / 2, by0, bw / 2, by1, lacq, 5, 0.0, 1, 4);
    rect(c, -bw / 2 + 5, by0 + 5, bw / 2 - 5, by1 - 5, (X, Y, lx, ly) => {
      const e = Math.min(lx + bw / 2 - 5, bw / 2 - 5 - lx, ly - by0 - 5, by1 - 5 - ly);
      return e < 2 ? mt(M.gold, face(0.95, SIDE) * 0.9, X, Y, 0.05, 1) : 0;
    });
    for (const [fx, fy, sx, sy] of [[-bw / 2, by1, 1, -1], [bw / 2, by1, -1, -1]] as const) fitting(c, fx, fy, sx, sy, 9);
    // the downloads (they must read as THE downloads, as prizes): a large lit card per product, cream paper in a
    // double gold frame, its icon large, an award rosette pinned at its head, its name in pixel letters on a red
    // nameplate
    plaques.forEach((id, i) => {
      const n = plaques.length;
      const cx = -bw / 2 + ((i + 0.5) / n) * bw;
      const pw = (bw / n) * 0.86, ph = bh * 0.84;
      const py0 = by0 + (bh - ph) / 2 + 3;
      rect(c, cx - pw / 2, py0, cx + pw / 2, py0 + ph, (X, Y, lx, ly) => {
        const u = (lx - cx + pw / 2) / pw, v = (ly - py0) / ph;
        const e = Math.min(u, 1 - u) * pw;
        const f = Math.min(v, 1 - v) * ph;
        const d = Math.min(e, f);
        if (d < 2) return mt(M.gold, face(0.95, SIDE, u < 0.5 ? -0.5 : 0.5, v < 0.5 ? -0.5 : 0.5), X, Y, 0.0, 1);
        if (d < 3) return mt(lacq, 0.5, X, Y, 0.1, 1);
        if (d < 5) return mt(M.gold, 0.72, X, Y, 0.1, 1);
        // the nameplate
        if (v > 0.78 && v < 0.94 && Math.abs(u - 0.5) < 0.42) {
          const pe = Math.min((0.42 - Math.abs(u - 0.5)) * pw, Math.min(v - 0.78, 0.94 - v) * ph);
          if (pe < 1.5) return mt(M.gold, 0.85, X, Y, 0.05, 1);
          return mt(M.verm, face(0.95, SIDE) * 0.62, X, Y, 0.2, 1);
        }
        // the card: (round 3, W2-10: flat cream) silk-backed paper set back in its frame: the frame's shadow along its
        // top and left inner edges (the sun is up and to the left: the frame's lit lip throws it down and right), the
        // sun warm on its upper left, cooler toward the lower right, a fine weave, brightest round the icon
        const r = Math.hypot((u - 0.5) * pw, (v - 0.44) * ph) / (0.5 * pw);
        const rays = Math.floor(((Math.atan2(v - 0.44, u - 0.5) + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0 && r > 0.55 ? 0.05 : 0;
        const shadowT = f < 5 + 4 + (u < 0.2 ? 2 : 0), shadowL = e < 5 + 3;
        const shade = shadowT || shadowL ? 0.22 : 0;
        const weave = (X % 2 === 0) && (Y % 3 === 0) ? 0.03 : 0;
        const cool = clamp((u + v - 1) * 0.6, 0, 0.5);
        if (cool > 0.12 && !shade && bayer4(X, Y) < cool * 0.7) return mt(CARD_COOL, 1.0 - r * 0.25 - rays - shade, X, Y, 0.0, 1);
        return mt(M.paper, 1.0 - r * 0.22 - rays - shade - weave, X, Y, 0.0, 0.8);
      });
      emblem(c, id, cx, py0 + ph * 0.45, 1.75);
      // the name, in gold pixel letters on the nameplate
      const name = id === "dexclient" ? "DEXCLIENT" : id === "dexcode" ? "DEXCODE" : id.toUpperCase();
      const tw = textWidth(name);
      text(c, cx - tw / 2, py0 + ph * 0.86 - 3.5, name, (X, Y) => tn(M.gold, 0.08, X, Y, 0), { shadow: (X, Y) => tn(M.verm, 0.85, X, Y, 0) });
      // the award rosette pinned over the card's head
      rosette(c, cx, py0 + 4, 8, (X, Y) => tn(M.verm, 0.3, X, Y, 0), (X, Y) => tn(M.gold, 0.1, X, Y, 0), (X, Y) => tn(M.verm, 0.6, X, Y, 0));
    });
    // the header across the board's head: red lacquer in a gold frame, a gold prize cup between two cloud
    // scrolls; a paper lantern at each end, lit, so the header is the lit line the eye finds first
    rect(c, hx0, hy0, hx1, hy1, (X, Y, lx, ly) => {
      const e = Math.min(lx - hx0, hx1 - lx, ly - hy0, hy1 - ly);
      if (e < 2) return mt(M.gold, face(0.95, SIDE, 0, ly - hy0 < 2 ? -0.9 : 0.5), X, Y, 0.0, 1);
      if (e < 3.5) return mt(lacq, 0.45, X, Y, 0.1, 1);
      return mt(M.verm, face(0.95, SIDE) * 0.8 + grain(lx, ly, 59, false) * 0.05, X, Y, 0.1, 1);
    });
    {
      const ccy = (hy0 + hy1) / 2;
      trophy(c, 0, ccy + 10, 10, (X, Y) => tn(M.gold, 0.2, X, Y, 0), (X, Y) => tn(M.gold, 0.55, X, Y, 0), (X, Y) => tn(M.gold, 0.0, X, Y, 0));
      const goldC = (X: number, Y: number): number => tn(M.gold, 0.12, X, Y, 0);
      cloudScroll(c, hx0 + 18, ccy, 6, 1, -16 - (hx0 + 18) - 4, goldC);
      cloudScroll(c, hx1 - 18, ccy, 6, -1, hx1 - 18 - 16 - 4, goldC);
      for (const lx0 of [hx0 + 2, hx1 - 2]) {
        const l0 = hy1 + 2, l1 = l0 + 0.26 * H;
        rect(c, lx0 - 0.5, hy1 - 2, lx0 + 0.5, l0, (X, Y) => tn(lacq, 0.5, X, Y, 0));
        rect(c, lx0 - 7, l0, lx0 + 7, l1, (X, Y, lx, ly) => {
          const u = (lx - lx0 + 7) / 14, v = (ly - l0) / (l1 - l0);
          if (Math.abs(u - 0.5) > 0.5 - Math.abs(v - 0.5) * 0.3) return 0;
          if (v < 0.1 || v > 0.9) return mt(lacq, 0.45, X, Y, 0.1, 1);
          if (Math.abs(v - 0.5) < 0.05) return tn(M.verm, 0.35, X, Y, 0);
          return tn(M.glow, clamp(0.02 + Math.abs(u - 0.5) * 0.8 + Math.abs(v - 0.5) * 0.4, 0, 1), X, Y, 0.45);
        });
      }
    }
    tileRoof(c, new LitField(COURT_LIGHT, undefined, 16), SIDE, hx0 - 0.25 * H, hx1 + 0.25 * H, hy0, 0.42 * H, 7);
  },
});

// ---------------------------------------------------------------------------
// The gong tower: two great posts on stone bases, cross beams with gold medallions, the
// tower going up out of the frame (storey roofs on the way); the gong hangs low between the
// posts (its own sprite)
// ---------------------------------------------------------------------------
export interface TowerP {
  /** The tower's body height (px); with `crown` a roof and a finial stand on it (about 0.9 H more). */
  h: number;
  crown?: boolean;
  /** Storey height (H): a gold band and a balcony roof every storey above the gong's frame (3.6 by default). */
  storey?: number;
  /** Half the span between the posts (px) and the gong's centre above the floor. */
  half: number;
  gongY: number;
}

/** Lacquered timber by day (round 3): the sky caught on its lit side, into the warm dark on its shade side. */
const POST: Ramp = [P.tile[1]!, P.tile[2]!, P.lacquer[0]!, P.lacquer[1]!, P.lacquer[2]!, P.lacquer[3]!, P.umber[3]!, P.lacquer[4]!];
/** The sky seen through the tower's far lattice (round 3). */
const FAR_SKY: Ramp = [P.cloud[2]!, P.range[2]!, P.range[3]!, P.range[4]!, P.range[5]!, P.tile[3]!];

export const gongTower = definePainter<TowerP>("court.gongtower", {
  bounds(p) {
    return [-p.half - 0.9 * H, -p.h - (p.crown ? 1.0 * H : 0), p.half + 0.9 * H, 4];
  },
  paint(c, p) {
    const lf = new LitField(COURT_LIGHT, undefined, 16);
    const r = 0.17 * H;
    const S = p.storey ?? 3.6;
    // the upper storeys: dark lacquer panels between the posts, a ladder up the middle,
    // a balcony and a little roof every 3.6 H
    const tw = p.half * 0.62;
    rect(c, -tw, -p.h, tw, -p.gongY - 1.32 * H - 0.26 * H, (X, Y, lx, ly) => {
      const hgt = -ly / H;
      const u = (lx + tw) / (2 * tw);
      // (hall loop round 1) the face turns from the sun: lit on its left, in shade on its right
      const k = 0.98 - u * 0.3;
      const storey = ((hgt - 3.2) % S + S) % S;
      if (storey < 0.12) return mt(M.gold, face(k, SIDE, 0, storey < 0.04 ? -0.8 : 0.2) * 0.9, X, Y, 0.1, 1);
      // the storey's balcony throws a shadow down the panels under it (round 3, W2-10: deeper, its edge dithered)
      const under = storey < 0.22 ? -0.3 : storey < 0.42 && bayer4(X, Y) < (0.42 - storey) / 0.2 ? -0.3 : 0;
      // vermilion lattice panels set back in lacquer frames: the frame shades each panel's top
      // and left inside edge; the lattice's bars catch the morning only on their upper-left faces
      const pu = (u * 3) % 1, pv = ((hgt - 3.2) % 1.2 + 1.2) % 1.2 / 1.2;
      const frame = pu < 0.08 || pu > 0.92 || pv < 0.07;
      if (frame) {
        const nx = pu < 0.04 ? -0.7 : pu > 0.96 ? 0.7 : 0;
        return mt(lacq, face(k, SIDE, nx, pv < 0.035 ? -0.7 : 0) * 0.9 + under * 0.5, X, Y, 0.0, 1);
      }
      const recess = pu < 0.16 || pv < 0.17;
      const a = (((lx * 0.9 + ly) % 9) + 9) % 9, b = (((lx * 0.9 - ly) % 9) + 9) % 9;
      const bar = a < 1.6 || b < 1.6;
      if (bar) {
        const litFace = a < 0.8 || b > 0.8;
        const sun = recess ? 0.45 : litFace ? 1.0 : 0.55;
        return mt(M.verm, face(k, SIDE) * sun + under, X, Y, 0.2, 1);
      }
      // (round 3, W2-10: depth behind the net) through the gaps, the tower's dark inside, and here and there the sky
      // through the lattice on its far side, paler higher up
      // the far side's lattice lets the sky through as a soft band across the storey, under its floor's shadow, the
      // inside dark below it
      const band = 1 - Math.abs(pv - 0.42) / 0.26;
      if (!recess && under === 0 && band > 0.15 + bayer4(X, Y) * 0.5) return tn(FAR_SKY, clamp(0.3 + (1 - band) * 0.35 + u * 0.25, 0, 1), X, Y, 0.4);
      return mt(lacq, face(k, SIDE) * (recess ? 0.08 : 0.18) + under * 0.3, X, Y, 0.1, 1);
    });
    for (let s = 3.2 + S; s * H < p.h - 0.5 * H; s += S) {
      tileRoof(c, lf, SIDE, -tw - 0.55 * H, tw + 0.55 * H, -s * H, 0.55 * H, Math.floor(s));
    }
    // (round 2, W1-7) its crown: a hipped roof on the top storey and a gold finial, so the tower stands whole
    // in both court frames instead of running off the top edge
    if (p.crown) {
      tileRoof(c, lf, SIDE, -tw - 0.6 * H, tw + 0.6 * H, -p.h + 0.06 * H, 0.52 * H, 11);
      const fy0 = -p.h + 0.06 * H - 0.52 * H - 0.5 * H, fy1 = -p.h + 0.06 * H - 0.52 * H - 0.08 * H;
      lathe(c, 0, fy0, fy1, (ly) => {
        const t = (ly - fy0) / (fy1 - fy0);
        return t < 0.25 ? 1.6 + t * 6 : t < 0.55 ? 3.2 + Math.sin((t - 0.25) / 0.3 * Math.PI) * 2.6 : t < 0.8 ? 2.4 : 2.4 + (t - 0.8) * 14;
      }, (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE, 0.25), X, Y, 0.0, 1));
    }
    // the tower's own corner posts above the gong's frame
    const frameTop = -p.gongY - 1.32 * H - 0.5 * H;
    // (round 3, W2-10: the posts were L 74 in ten colours over 290 px, no lit or shade side) lacquer in the morning:
    // the sky's blue caught along the lit side, a core shadow, the shade side warm-dark with a little bounce; each
    // storey's eave and each beam throws a shadow down the post under it, darkest at the joint; rain streaks
    // down it, grime at the foot
    const beams = [-p.gongY - 1.32 * H, -0.95 * H];
    const postLit = (X: number, Y: number, u: number, lx: number, ly: number, rr: number): number => {
      const hgt = -ly / H;
      let n = cyl(1.0, u, SIDE, 0.35) * 1.02;
      const storey = ((hgt - 3.2) % S + S) % S;
      if (hgt > 3.2 + S - 0.2 && storey < 0.36) n -= storey < 0.2 ? 0.28 : bayer4(X, Y) < (0.36 - storey) / 0.16 ? 0.28 : 0;
      for (const by of beams) {
        const dy = ly - by; // below the beam's underside: positive
        if (dy > 0 && dy < 0.3 * H) n -= dy < 0.08 * H ? 0.32 : bayer4(X, Y) < (0.3 * H - dy) / (0.22 * H) ? 0.22 : 0;
      }
      const streak = vnoise(lx * 0.45 + rr, ly * 0.015, 87) > 0.68 ? -0.07 : 0;
      const grime = hgt < 1.6 ? -(1.6 - hgt) * 0.08 : 0;
      return mt(POST, n * 0.95 + streak + grime, X, Y, 0.0, 1);
    };
    for (const px of [-tw, tw]) {
      lathe(c, px, -p.h, frameTop + 4, () => r * 0.7, (X, Y, u, lx, ly) => {
        const hgt = -ly / H;
        const band = ((hgt - 3.2) % S + S) % S < 0.16;
        return band ? mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1) : postLit(X, Y, u, lx, ly, px);
      });
    }
    // the great posts of the gong's frame, a finial on each
    for (const px of [-p.half, p.half]) {
      lathe(c, px, frameTop - 0.32 * H, frameTop, (ly) => r * (0.4 + 0.6 * Math.sin(((ly - frameTop + 0.32 * H) / (0.32 * H)) * Math.PI)), (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
      colBase(c, px, r, 0.5 * H, 0.95, SIDE, 3);
      lathe(c, px, frameTop, -0.5 * H, () => r, (X, Y, u, lx, ly) => {
        const hgt = -ly / H;
        const band = (hgt > 1.0 && hgt < 1.18) || (((hgt - 3.2) % S + S) % S < 0.16 && hgt > 3);
        return band ? mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1) : postLit(X, Y, u, lx, ly, px);
      });
    }
    // the gong's beam (it hangs from this) and a lower brace, gold medallions at their middles
    for (const [by, dep] of [[-p.gongY - 1.32 * H, 0.26 * H], [-0.95 * H, 0.14 * H]] as const) {
      woodBox(c, -p.half - 0.3 * H, by - dep, p.half + 0.3 * H, by, lacq, 7, 0.0, 1, 3);
      rect(c, -0.17 * H, by - dep - 4, 0.17 * H, by + 4, (X, Y, lx, ly) => (Math.hypot(lx, (ly - by + dep / 2) * 1.2) < 0.17 * H ? mt(M.gold, face(0.95, SIDE, lx / (0.17 * H), (ly - by + dep / 2) / (0.17 * H)), X, Y, 0.0, 1) : 0));
      for (const ex of [-p.half - 0.3 * H, p.half + 0.3 * H]) fitting(c, ex, by - dep, ex < 0 ? 1 : -1, 1, 8);
    }
    // the striker's rest: a padded mallet hanging from the left post on a cord
    const mx = -p.half + r + 10;
    rect(c, mx - 1, -p.gongY - 1.0 * H, mx + 1, -p.gongY + 0.2 * H, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
  },
});

// ---------------------------------------------------------------------------
// The gong (a sprite): a great bronze disc with a raised boss and rings, hung by two red
// cords; struck, it swings back and settles, its face flaring (frames: 0 at rest, 1-11 the
// strike and its decay)
// ---------------------------------------------------------------------------
export interface GongP {
  r: number;
  /** The cords' length above the disc (px); the anchor is the beam's underside at the middle. */
  cord: number;
  frame?: number;
}

// (GONG_FRAMES and gongFrame live in gong.ts, so the court's game code reads them without the hall's painters)
import { GONG_FRAMES } from "./gong.ts";
export { GONG_FRAMES, gongFrame } from "./gong.ts";

export const gong = definePainter<GongP>("court.gong", {
  bounds(p) {
    return [-p.r - 14, -2, p.r + 14, p.cord + p.r * 2 + 12];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    // the swing: struck from the left, it swings away and back, decaying; the face flares
    const t = f === 0 ? 0 : (f - 1) / (GONG_FRAMES - 1);
    const decay = f === 0 ? 0 : Math.exp(-t * 3.2);
    const swing = f === 0 ? 0 : Math.sin(t * Math.PI * 4.5) * 7 * decay;
    const flare = f === 0 ? 0 : Math.max(0, 1 - t * 2.4);
    const cx = Math.round(swing), cy = p.cord + p.r;
    for (const ax of [-p.r * 0.55, p.r * 0.55]) {
      const n = Math.ceil(Math.hypot(cx + ax * 0.9 - ax, cy - p.r * 0.85) * c.d);
      for (let i = 0; i <= n; i++) {
        const tt = i / n;
        const X = Math.round(c.X(ax + (cx + ax * 0.9 - ax) * tt)), Y = Math.round(c.Y((cy - p.r * 0.85) * tt));
        c.buf.set(X, Y, tt < 0.5 ? P.red[3]! : P.red[2]!);
        c.buf.set(X + 1, Y, P.red[4]!);
      }
    }
    rect(c, cx - p.r - 2, cy - p.r - 2, cx + p.r + 2, cy + p.r + 2, (X, Y, lx, ly) => {
      const dx = lx - cx, dy = ly - cy;
      const d = Math.hypot(dx, dy) / p.r;
      if (d > 1) return 0;
      const nx = dx / p.r, ny = dy / p.r;
      // the rim: a thick rolled edge; rings hammered into the face; the boss in the middle
      if (d > 0.92) {
        // (hall loop round 1) the rolled rim: a hot rim light where it faces the sun, its far side dark
        const sunward = -(nx * 0.62 + ny * 0.78);
        if (sunward > 0.55 && d > 0.95) return mt(M.bronze, 1.15, X, Y, 0.0, 1);
        return mt(M.bronze, face(0.95, SIDE, nx * 0.9, ny * 0.9) * (sunward < -0.3 ? 0.5 : 0.75), X, Y, 0.0, 1);
      }
      if (d > 0.86) return mt(M.bronze, face(0.95, SIDE, -nx * 0.6, -ny * 0.6) * 0.6, X, Y, 0.1, 1);
      const ring = Math.abs(d - 0.62) < 0.025 || Math.abs(d - 0.42) < 0.02;
      if (d < 0.2) return mt(M.bronze, face(0.95, SIDE, nx * 2.5, ny * 2.5) * 1.05 + flare * 0.3, X, Y, 0.0, 1);
      // the face: a broad sheen from the upper left, hammer marks, patina in the low rings
      const sheen = clamp(1 - Math.hypot(nx + 0.35, ny + 0.4) * 1.3, 0, 1);
      const hammer = hash(Math.floor(lx / 3), Math.floor(ly / 3), 5) > 0.82 ? -0.06 : 0;
      const patina = d > 0.7 && fbm(lx * 0.15, ly * 0.15, 9, 2) > 0.64;
      if (patina) return tn(P.jade, 0.55, X, Y, 0.3);
      return mt(M.bronze, 0.42 + sheen * 0.55 + hammer + flare * 0.35 - (ring ? 0.18 : 0), X, Y, 0.0, 1);
    });
    // a ring of ink characters round the face (abstract strokes)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const rx = cx + Math.cos(a) * p.r * 0.75, ry = cy + Math.sin(a) * p.r * 0.75;
      rect(c, rx - 3, ry - 3, rx + 3, ry + 3, (X, Y, lx, ly) => (Math.abs(lx - rx) < 0.8 || Math.abs(ly - ry) < 0.8 ? tn(M.bronze, 0.85, X, Y, 0) : 0));
    }
  },
});

// ---------------------------------------------------------------------------
// A stone lantern pillar: a shaft on a lotus base, a lantern house with lit paper, a roof cap
// ---------------------------------------------------------------------------
export interface LPillarP {
  h: number;
  lit?: boolean;
  /** Scale of the shaft and lantern house (near pillars are bigger). */
  s?: number;
}

export const lanternPillar = definePainter<LPillarP>("court.lanternpillar", {
  bounds(p) {
    const k = p.s ?? 1;
    return [-0.5 * H * k, -p.h - 0.9 * H * k, 0.5 * H * k, 4];
  },
  paint(c, p) {
    const lf = new LitField(COURT_LIGHT, undefined, 16);
    const k = p.s ?? 1;
    const r = 0.12 * H * k;
    colBase(c, 0, r * 1.3, 0.38 * H * k, 0.95, SIDE, 9);
    lathe(c, 0, -p.h, -0.38 * H * k, (ly) => r * (1 + 0.06 * Math.sin(ly * 0.05)), (X, Y, u, lx, ly) => {
      const band = Math.abs(ly + p.h * 0.62) < 3;
      return mt(M.stone, cyl(0.95, u, SIDE) * (band ? 0.75 : 0.95) + (fbm(lx * 0.3, ly * 0.1, 4, 2) > 0.7 ? -0.08 : 0), X, Y, 0.1, 1);
    });
    // the lantern house: a stone platform, four posts with lit paper between, a roof
    const hy1 = -p.h, hy0 = hy1 - 0.52 * H * k, hw = 0.24 * H * k;
    rect(c, -hw - 6, hy1 - 6, hw + 6, hy1, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < hy1 - 4 ? -0.8 : 0.4), X, Y, 0.1, 1));
    rect(c, -hw, hy0, hw, hy1 - 6, (X, Y, lx, ly) => {
      const u = (lx + hw) / (2 * hw), v = (ly - hy0) / (hy1 - 6 - hy0);
      if (u < 0.14 || u > 0.86 || Math.abs(u - 0.5) < 0.05) return mt(M.stone, face(0.95, SIDE, u < 0.5 ? -0.6 : 0.6, 0) * 0.8, X, Y, 0.15, 1);
      return tn(p.lit ? M.glow : M.paper, clamp(0.25 + Math.abs(u - 0.5) * 0.5 + v * 0.15, 0, 1), X, Y, 0.5);
    });
    tileRoof(c, lf, SIDE, -hw - 0.2 * H * k, hw + 0.2 * H * k, hy0, 0.3 * H * k, 13);
    lathe(c, 0, hy0 - 0.42 * H * k, hy0 - 0.26 * H * k, (ly) => 5 * k * Math.sin(((ly - hy0 + 0.42 * H * k) / (0.16 * H * k)) * Math.PI), (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
  },
});

// ---------------------------------------------------------------------------
// The newel posts at the Prow Stair's mouth: square stone posts with a small lantern each
// ---------------------------------------------------------------------------
export const newel = definePainter<{ h: number }>("court.newel", {
  bounds(p) {
    return [-0.3 * H, -p.h - 0.6 * H, 0.3 * H, 4];
  },
  paint(c, p) {
    const w = 0.16 * H;
    rect(c, -w, -p.h, w, 0, (X, Y, lx, ly) => {
      const u = (lx + w) / (2 * w), v = -ly / p.h;
      const [nx] = bevel(u, 0.5, 0.15, 0.1);
      const cap = v > 0.9;
      return mt(M.stone, face(0.95, SIDE, nx, cap && v > 0.97 ? -0.8 : 0) * (cap ? 1.05 : 0.9) + (fbm(lx * 0.3, ly * 0.2, 5, 2) > 0.72 ? -0.08 : 0), X, Y, 0.05, 1);
    });
    rect(c, -w - 4, -p.h - 4, w + 4, -p.h + 2, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -p.h - 2 ? -0.9 : 0.4), X, Y, 0.0, 1));
    // a small paper lantern on the cap
    const ly0 = -p.h - 0.42 * H;
    rect(c, -0.11 * H, ly0, 0.11 * H, -p.h - 4, (X, Y, lx, ly) => {
      const u = (lx + 0.11 * H) / (0.22 * H);
      if (u < 0.12 || u > 0.88) return mt(M.wood, 0.5, X, Y, 0.2, 1);
      return tn(M.paper, clamp(0.15 + Math.abs(u - 0.5) * 0.6 + (ly - ly0) / (0.4 * H) * 0.2, 0, 1), X, Y, 0.5);
    });
    rect(c, -0.15 * H, ly0 - 4, 0.15 * H, ly0, (X, Y) => mt(lacq, 0.5, X, Y, 0.1, 1));
  },
});

// ---------------------------------------------------------------------------
// The tip: a stone rail (front plane; she stands behind it) and a bench
// ---------------------------------------------------------------------------
export const tipRail = definePainter<{ w: number; h: number }>("court.rail", {
  bounds(p) {
    return [-0.2 * H, -p.h - 10, p.w + 0.2 * H, 6];
  },
  paint(c, p) {
    const postW = 0.13 * H;
    const n = Math.max(2, Math.round(p.w / (0.9 * H)));
    const step = p.w / n;
    rect(c, 0, -p.h * 0.62, p.w, -p.h * 0.5, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -p.h * 0.6 ? -0.6 : 0.3) * 0.9, X, Y, 0.1, 1));
    rect(c, 0, -p.h - 4, p.w, -p.h + 7, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -p.h - 1 ? -0.9 : 0.4), X, Y, 0.0, 1));
    for (let i = 0; i <= n; i++) {
      const px = i * step;
      rect(c, px - postW / 2, -p.h - 8, px + postW / 2, 0, (X, Y, lx, ly) => {
        const u = (lx - px + postW / 2) / postW;
        const top = ly < -p.h - 2;
        return mt(M.stone, face(0.95, SIDE, u < 0.25 ? -0.7 : u > 0.75 ? 0.7 : 0, top ? -0.8 : 0) + (fbm(lx * 0.3, ly * 0.2, 2, 2) > 0.74 ? -0.08 : 0), X, Y, 0.05, 1);
      });
    }
    // lichen and a crack or two
    rect(c, 0, -p.h - 8, p.w, 0, (X, Y, lx, ly) => (fbm(lx * 0.12, ly * 0.12, 8, 3) > 0.7 && keep(X, Y, 0.5) && c.buf.get(X, Y) ? tn(P.moss, 0.55, X, Y, 0.3) : 0));
  },
});

export const bench = definePainter<{ w: number }>("court.bench", {
  bounds(p) {
    return [-6, -0.6 * H, p.w + 6, 4];
  },
  paint(c, p) {
    rect(c, -4, -0.46 * H, p.w + 4, -0.38 * H, (X, Y, _lx, ly) => mt(M.stone, face(0.95, SIDE, 0, ly < -0.44 * H ? -0.9 : 0.4), X, Y, 0.0, 1));
    for (const lx0 of [4, p.w - 18]) {
      rect(c, lx0, -0.38 * H, lx0 + 14, 0, (X, Y, lx, _ly) => mt(M.stone, face(0.95, SIDE, lx - lx0 < 3 ? -0.7 : lx - lx0 > 11 ? 0.7 : 0) * 0.85, X, Y, 0.05, 1));
    }
    rect(c, -2, -3, p.w + 2, 2, (X, Y) => (keep(X, Y, 0.55) ? P.stone[5]! : 0));
  },
});

export { cyl };

// ---------------------------------------------------------------------------
// A festival banner on its pole (a sprite): long red silk on a crossbar, a gold-ringed
// emblem, a fringe; the wind from the west lifts it in a wave that travels down its length
// (8 frames at 5 fps), never frozen
// ---------------------------------------------------------------------------
export interface BannerP {
  /** Pole height (px; the anchor is its foot), banner width and drop (px). */
  h: number;
  w: number;
  drop: number;
  phase?: number;
  /** (hall loop round 1) How hard the wind takes this one (1 = as before) and its pattern (0 ring, 1 stripe, 2 band). */
  gust?: number;
  style?: number;
  frame?: number;
}

export const banner = definePainter<BannerP>("court.banner", {
  bounds(p) {
    const g = p.gust ?? 1;
    return [-p.w - 12, -p.h - 14, p.w + 16 + 6 * g, 4];
  },
  paint(c, p) {
    const f = ((p.frame ?? 0) + Math.round((p.phase ?? 0) * 8)) % 8;
    const ph = (f / 8) * Math.PI * 2;
    const g = p.gust ?? 1, style = p.style ?? 0;
    // the pole and its finial
    lathe(c, 0, -p.h, 0, () => 2.5, (X, Y, u) => mt(lacq, cyl(0.95, u, SIDE, 0.25), X, Y, 0.0, 1));
    lathe(c, 0, -p.h - 12, -p.h, (ly) => 4 * Math.sin(((ly + p.h + 12) / 12) * Math.PI), (X, Y, u) => mt(M.gold, cyl(0.95, u, SIDE), X, Y, 0.0, 1));
    const bar = -p.h + 4;
    rect(c, -p.w / 2 - 6, bar - 3, p.w / 2 + 6, bar + 1, (X, Y, _lx, ly) => mt(lacq, ly < bar - 2 ? 0.9 : 0.6, X, Y, 0.1, 1));
    // the silk: each row shifted by the travelling wave, more toward the free end and more in a
    // gust; shaded by the wave's slope (the folds facing the sun lit, the others in shade), the
    // far half of the cloth a little darker, a twill in it
    rect(c, -p.w / 2 - 8, bar, p.w / 2 + 10 + 6 * g, bar + p.drop + 12, (X, Y, lx, ly) => {
      const t = (ly - bar) / p.drop;
      if (t < 0 || t > 1.1) return 0;
      const amp = (1 + t * 4) * g;
      const off = Math.sin(t * 5 - ph) * amp + t * t * 3 * (g - 0.8);
      const slope = Math.cos(t * 5 - ph) * Math.min(1.4, g);
      const u = (lx - off + p.w / 2) / p.w;
      if (u < 0 || u > 1) return 0;
      const shade = -slope * 0.12 - u * 0.1 + ((X + Y) % 3 === 0 ? -0.03 : 0);
      if (t > 1) {
        // the fringe: threads of uneven length
        const th = Math.floor(lx / 2);
        return (((lx % 2) + 2) % 2) < 1.2 && t - 1 < 0.04 + 0.06 * hash(th, 2, style + 5) ? mt(M.gold, 0.8 + shade, X, Y, 0.2, 1) : 0;
      }
      if (u < 0.08 || u > 0.92) return mt(M.gold, face(0.95, SIDE) * 0.85 + shade, X, Y, 0.1, 1);
      const ex = (u - 0.5) * p.w, ey = (t - 0.32) * p.drop;
      if (style === 0) {
        const d = Math.hypot(ex, ey);
        if (d < p.w * 0.3 && d > p.w * 0.24) return mt(M.gold, 0.85 + shade, X, Y, 0.1, 1);
        if (d < p.w * 0.16 && Math.sin(Math.atan2(ey, ex) * 5) > -0.2) return mt(M.gold, 0.8 + shade, X, Y, 0.15, 1);
      } else if (style === 1) {
        // a dark stripe down the middle with a chain of gold lozenges on a thread (round 2, W1-2: a pattern,
        // no pseudo-script)
        if (Math.abs(u - 0.5) < 0.16) {
          const gy = ((t * 7) % 1 + 1) % 1, du = Math.abs(u - 0.5) * p.w, dv = Math.abs(gy - 0.5) * p.drop / 7;
          if (t > 0.12 && t < 0.86) {
            const loz = du / (0.1 * p.w) + dv / (0.36 * p.drop / 7);
            if (loz < 1) return mt(M.gold, (loz > 0.62 ? 0.7 : 0.9) + shade, X, Y, 0.1, 1);
            if (du < 0.6) return mt(M.gold, 0.7 + shade, X, Y, 0.1, 1);
          }
          return mt(lacq, 0.55 + shade, X, Y, 0.1, 1);
        }
      } else if (t < 0.18 && t > 0.1) {
        return mt(M.gold, 0.82 + shade, X, Y, 0.1, 1);
      }
      return mt(M.verm, 0.82 + shade, X, Y, 0.15, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// A cliff pine on the near plane (P5), growing out of the rock below the prow: a gnarled trunk
// leaning out, its crown of flat cloud pads topping just below the court's floor line (so it
// frames the bottom corners without ever covering her)
// ---------------------------------------------------------------------------
export interface NearPineP {
  /** Height of the crown's top above the anchor (px) and the lean (-1 left .. 1 right). */
  h: number;
  lean: number;
  seed?: number;
}

export const nearPine = definePainter<NearPineP>("court.nearpine", {
  bounds(p) {
    return [-p.h * 0.9, -p.h - 20, p.h * 0.9, 4];
  },
  paint(c, p) {
    const sd = p.seed ?? 1;
    // the trunk: a bent line of decreasing width from the root (0, 0) up and out
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      pts.push([p.lean * p.h * 0.45 * Math.sin(t * Math.PI * 0.7) + Math.sin(t * 7 + sd) * 6, -p.h * 0.78 * t]);
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]!;
      const w = 14 * (1 - (i / pts.length) * 0.7);
      rect(c, x - w, y - 4, x + w, y + 4, (X, Y, lx) => {
        const u = (lx - x) / w;
        const bark = Math.sin(Y * 0.7 + lx * 0.3) > 0.6 ? -0.08 : 0;
        return mt(M.wood, face(0.8, SIDE, u, 0) * 0.55 + bark, X, Y, 0.35, 1);
      });
    }
    // pads: flat clouds of needles along the upper trunk and on short branches
    const pads: [number, number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const t = 0.45 + k * 0.1;
      const [bx, by] = pts[Math.min(30, Math.round(t * 30))]!;
      const dir = k % 2 ? 1 : -1;
      pads.push([bx + dir * (20 + 30 * hash(k, 1, sd)) + p.lean * 20, by - 6 - 12 * hash(k, 2, sd), 34 + 26 * hash(k, 3, sd)]);
    }
    const top = pts[30]!;
    pads.push([top[0], top[1] - 10, 48]);
    for (const [cx, cy, rr] of pads) {
      rect(c, cx - rr, cy - rr * 0.55, cx + rr, cy + rr * 0.3, (X, Y, lx, ly) => {
        const q = Math.hypot((lx - cx) / rr, (ly - cy) / (rr * (ly < cy ? 0.5 : 0.28))) + (fbm(lx * 0.12, ly * 0.12, sd, 3) - 0.5) * 0.55;
        if (q > 1) return 0;
        const v = (ly - cy) / (rr * 0.5);
        const lit = v < -0.4 && lx < cx ? 0.75 : v < 0 ? 0.55 : 0.3;
        return mt(P.pine, lit + (hash(X, Y, 3) > 0.9 ? 0.1 : 0), X, Y, 0.1, 1);
      });
    }
  },
});
