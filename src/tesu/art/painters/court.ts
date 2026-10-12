// The Prize Court on the prow (GDK 5.1, A.3): a round open-air court seen from the side, so
// its paved floor shows as a band with the great inked seal lying on it; Bao's gong tower;
// the Prize Board at the gate with the newest release banner over it; the paper spectators
// in tiers behind (the back plane); lantern pillars; the gate back into the hall.
// Stand-ins in the world's palette until the ground lane's finished props replace them in
// these same slots.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone } from "../raster.ts";

/** Fills a level-1 rectangle with a per-pixel colour (u, v: 0..1 across it). */
function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

/** An ellipse; col gets the normalised position (du, dv in -1..1) and the squared radius. */
function oval(c: PaintCtx, cx: number, cy: number, rx: number, ry: number, col: (x: number, y: number, du: number, dv: number, d: number) => number): void {
  fill(c, cx - rx, cy - ry, cx + rx, cy + ry, (x, y, u, v) => {
    const du = u * 2 - 1, dv = v * 2 - 1;
    const d = du * du + dv * dv;
    return d > 1 ? 0 : col(x, y, du, dv, d);
  });
}

/** A small tiled roof cap: eave at y, from x0 to x1, rising rh, with gold ridge and turned-up ends. */
function cap(c: PaintCtx, x0: number, x1: number, y: number, rh: number): void {
  const steps = Math.max(2, Math.ceil(rh * c.d));
  const cx = (x0 + x1) / 2, span = (x1 - x0) / 2;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const half = span * (1 - 0.45 * Math.pow(u, 0.8));
    const Y = Math.round(c.Y(y - u * rh));
    const xa = Math.round(c.X(cx - half)), xb = Math.round(c.X(cx + half));
    for (let x = xa; x < xb; x++) {
      let col = tone(P.tile, clamp(0.25 + 0.5 * (1 - u), 0, 1), x, Y, 0.3);
      if (i === steps) col = P.gold[1]!;
      if (x === xa || x === xb - 1) col = P.ink[0]!;
      c.buf.set(x, Y, col);
    }
  }
  fill(c, x0 + 4, y, x1 - 4, y + 5, (x) => ((x & 3) === 0 ? P.gold[3]! : P.ink[0]!));
  for (const s of [-1, 1]) {
    const X = Math.round(c.X(cx + s * span + s * 3)), Y = Math.round(c.Y(y - rh * 0.25));
    c.buf.set(X, Y, P.ink[0]!);
    c.buf.set(X, Y - 1, P.ink[0]!);
  }
}

// --- the court floor -----------------------------------------------------------------------

export interface CourtFloorP {
  /** Length along the prow, px; the anchor is the west end on the walk line. */
  w: number;
  /** The seal's centre from the west end and its half width, px. */
  seal: [number, number];
}

/**
 * The paved court seen from a little above: a band of stone paving from its far rim (behind
 * her feet) to its near rim, the great inked seal lying flat on it, then the slab's face.
 */
export const courtfloor = definePainter<CourtFloorP>("courtfloor", {
  bounds(p) {
    return [-4, -16, p.w + 4, 52];
  },
  paint(c, p) {
    const far = -14, near = 22, face = 48;
    const [scx, srx] = p.seal;
    // the band is 36 px deep: a ring 2 x 3.4 H across lies about 30 px deep on it
    const sry = Math.min(15, srx * 0.15);
    fill(c, 0, far, p.w, face, (x, y, u) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      if (ly < near) {
        // the paving: rows that get deeper toward the viewer, joints offset per row
        const t = (ly - far) / (near - far);
        const rows = [0, 0.16, 0.36, 0.62, 1];
        let r = 0;
        while (r < rows.length - 2 && t > rows[r + 1]!) r++;
        const rowTop = far + rows[r]! * (near - far);
        if (Math.abs(ly - rowTop) < 0.6 && r > 0) return P.stone[4]!;
        const slab = 34 + r * 18;
        const off = (r % 2) * slab * 0.5;
        if (((lx + off) % slab + slab) % slab < 1.2) return P.stone[4]!;
        // the seal lying flat on the paving, seen from a little above: a red-ink ring and,
        // inside it, a square seal in red with its script left in the stone's colour
        const ex = (lx - scx) / srx, ey = (ly - 3) / sry;
        const e = Math.hypot(ex, ey);
        if (e > 0.9 && e <= 1) return e > 0.97 && bayer4(x, y) > 0.5 ? P.red[2]! : P.red[3]!;
        if (Math.abs(ex) < 0.44 && Math.abs(ey) < 0.62) {
          if (Math.abs(ex) > 0.41 || Math.abs(ey) > 0.5) return P.red[4]!;
          const strokes =
            (Math.abs(ex + 0.22) < 0.025 && Math.abs(ey) < 0.36) ||
            (Math.abs(ex - 0.05) < 0.025 && ey > -0.36 && ey < 0.1) ||
            (Math.abs(ey + 0.12) < 0.1 && ex > -0.3 && ex < 0.14) ||
            (Math.abs(ey - 0.24) < 0.1 && ex > -0.05 && ex < 0.32) ||
            (Math.abs(ex - 0.26) < 0.025 && Math.abs(ey) < 0.36);
          return strokes ? P.stone[1]! : P.red[3]!;
        }
        return tone(P.stone, 0.12 + 0.3 * t + (u < 0.04 || u > 0.96 ? 0.2 : 0), x, y, 0.35);
      }
      // the near rim (a lit lip) and the slab's face of cut blocks
      if (ly < near + 2) return P.stone[0]!;
      const course = Math.floor((ly - near) / 13);
      const bw = 46;
      const off = (course % 2) * bw * 0.5;
      if ((ly - near) % 13 < 1 || ((lx + off) % bw + bw) % bw < 1.2) return P.stone[5]!;
      return tone(P.stone, 0.42 + 0.12 * course, x, y, 0.35);
    });
  },
});

// --- the gong tower ------------------------------------------------------------------------

export interface GongTowerP {
  /** Height of the tower above the floor, px. */
  h: number;
}

/**
 * Bao's gong tower: two vermilion posts carrying the great bronze gong on a lacquer beam
 * low down, where Bao can reach it, and above it the tower going on up past the frame's
 * top edge, a ladder inside (the climb to the palace roofs comes later), a roof at the top.
 */
export const gongtower = definePainter<GongTowerP>("gongtower", {
  bounds(p) {
    return [-110, -p.h - 70, 110, 4];
  },
  paint(c, p) {
    const H = p.h;
    // a stone plinth
    fill(c, -96, -18, 96, 0, (x, y, u, v) => tone(P.stone, v < 0.15 ? 0.05 : u < 0.2 ? 0.3 : u < 0.8 ? 0.45 : 0.75, x, y, 0.3));
    // the two posts, full height
    for (const px of [-78, 62]) {
      fill(c, px, -H, px + 16, -18, (x, y, u) => {
        if (u < 0.08 || u > 0.92) return P.ink[0]!;
        return tone(P.red, u < 0.3 ? 0.15 : u < 0.7 ? 0.4 : 0.7, x, y, 0.3);
      });
    }
    // the gong's beam and its cords
    fill(c, -92, -248, 92, -232, (x, y, _u, v) => (v < 0.2 ? P.gold[2]! : tone(P.lacquer, 0.55, x, y, 0.3)));
    for (const cx of [-30, 30]) fill(c, cx - 1, -232, cx + 1, -206, () => P.red[4]!);
    // the gong: a big bronze disc with a raised boss and rings
    const gy = -138, gr = 70;
    oval(c, 0, gy, gr, gr, (x, y, du, dv, d) => {
      const r = Math.sqrt(d);
      if (r > 0.94) return P.gold[5]!;
      if (r > 0.88) return P.gold[3]!;
      if (Math.abs(r - 0.62) < 0.03 || Math.abs(r - 0.4) < 0.025) return P.gold[4]!;
      if (r < 0.2) return tone(P.gold, du + dv < -0.1 ? 0.05 : 0.3, x, y, 0.3);
      const lit = -du * 0.6 - dv * 0.8;
      return tone(P.gold, clamp(0.5 - lit * 0.35, 0.1, 0.9), x, y, 0.4);
    });
    // the tower above: lacquer panels between the posts, gold bands, a ladder up the middle
    fill(c, -62, -H + 40, 62, -260, (x, y, u, v) => {
      const ly = c.ly(y + 0.5);
      if (((ly % 120) + 120) % 120 < 6) return P.gold[2]!;
      if (u > 0.4 && u < 0.6) {
        const lx = c.lx(x + 0.5);
        if (Math.abs(lx + 12) < 2 || Math.abs(lx - 12) < 2) return P.timber[3]!;
        if (((ly % 22) + 22) % 22 < 3) return P.timber[2]!;
        return tone(P.lacquer, 0.85, x, y, 0.3);
      }
      return tone(P.lacquer, 0.35 + 0.35 * u + 0.05 * v, x, y, 0.3);
    });
    // a little balcony and a roof at each storey (one in three readable from the court)
    for (let k = 1; k * 360 < H - 80; k++) cap(c, -100, 100, -260 - k * 360 + 40, 30);
    cap(c, -110, 110, -H + 40, 64);
  },
});

// --- the Prize Board and its release banner --------------------------------------------------

export interface BoardP {
  /** The plaques shown (product ids; the art for each is the champion's emblem). */
  plaques?: string[];
}

/** A champion's emblem on a plaque or banner: the lion's face (dexClient) or a mage's hat (dexCode). */
function emblem(c: PaintCtx, id: string, cx: number, cy: number, s: number): void {
  if (id === "dexclient") {
    // the lion's face: red, a gold mirror on the brow, white fur brows, a wide mouth
    oval(c, cx, cy, 15 * s, 13 * s, (x, y, du) => tone(P.red, du < -0.3 ? 0.1 : du < 0.4 ? 0.3 : 0.55, x, y, 0.3));
    oval(c, cx, cy - 7 * s, 3.5 * s, 3.5 * s, () => P.gold[1]!);
    for (const sx of [-1, 1]) {
      fill(c, cx + sx * 9 * s - 5 * s, cy - 4 * s, cx + sx * 9 * s + 5 * s, cy - 1 * s, () => P.paper[0]!);
      oval(c, cx + sx * 7 * s, cy + 1 * s, 3 * s, 3 * s, () => P.ink[0]!);
    }
    fill(c, cx - 9 * s, cy + 6 * s, cx + 9 * s, cy + 10 * s, (_x, _y, _u, v) => (v < 0.5 ? P.paper[0]! : P.red[5]!));
  } else {
    // a pointed mage's hat with a red gem (Yuki's red stays on her pin and gem only)
    fill(c, cx - 15 * s, cy + 6 * s, cx + 15 * s, cy + 10 * s, (x, y) => tone(P.violet, 0.6, x, y, 0.3));
    for (let i = 0; i < 22 * s; i++) {
      const w = (1 - i / (22 * s)) * 9 * s;
      fill(c, cx - w + i * 0.15, cy + 6 * s - i, cx + w + i * 0.15, cy + 7 * s - i, (x, y) => tone(P.violet, 0.4 + 0.2 * (i / (22 * s)), x, y, 0.3));
    }
    oval(c, cx, cy + 2 * s, 2.5 * s, 2.5 * s, () => P.red[2]!);
  }
}

/**
 * The Prize Board at the court's gate: a black lacquer board on two legs, one gold-rimmed
 * plaque per product, and over it the newest release's festival banner, gacha-style, with
 * its champion's face. Anchor: the board's foot, centre.
 */
export const prizeboard = definePainter<BoardP>("prizeboard", {
  bounds() {
    return [-130, -440, 130, 4];
  },
  paint(c, p) {
    const plaques = p.plaques ?? ["dexclient", "dexcode"];
    // the banner's pole frame and the banner (behind the board)
    for (const px of [-112, 104]) fill(c, px, -430, px + 8, 0, (x, y, u) => (u < 0.2 || u > 0.8 ? P.ink[0]! : tone(P.timber, 0.55, x, y, 0.3)));
    fill(c, -122, -436, 122, -426, (x, y, _u, v) => (v < 0.3 ? P.gold[2]! : tone(P.lacquer, 0.5, x, y, 0.3)));
    fill(c, -98, -426, 98, -250, (x, y, u, v) => {
      // a swallowtail hem
      if (v > 0.9 && Math.abs(u - 0.5) < 0.12 * ((v - 0.9) / 0.1)) return 0;
      if (u < 0.04 || u > 0.96 || v < 0.03) return P.gold[2]!;
      if (u < 0.08 || u > 0.92) return P.gold[4]!;
      // rays behind the champion, gacha-style
      const ang = Math.atan2(v - 0.45, (u - 0.5) * 1.1);
      const ray = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0;
      return tone(P.red, ray ? 0.25 : 0.4, x, y, 0.3);
    });
    emblem(c, plaques[0] ?? "dexclient", 0, -350, 3.2);
    // a "new" ribbon across the banner's corner
    fill(c, -98, -290, 98, -272, (x, y, _u, v) => (v < 0.15 || v > 0.85 ? P.gold[4]! : tone(P.gold, 0.2, x, y, 0.3)));
    // the board: legs, a frame, a roof cap
    for (const lx of [-96, 84]) fill(c, lx, -190, lx + 12, 0, (x, y, u) => (u < 0.15 || u > 0.85 ? P.ink[0]! : tone(P.lacquer, 0.6, x, y, 0.3)));
    fill(c, -108, -232, 108, -82, (x, y, u, v) => {
      if (u < 0.02 || u > 0.98 || v < 0.03 || v > 0.97) return P.ink[0]!;
      if (u < 0.05 || u > 0.95 || v < 0.07 || v > 0.93) return P.gold[2]!;
      return tone(P.lacquer, 0.55 + 0.25 * v, x, y, 0.3);
    });
    cap(c, -124, 124, -232, 24);
    // the plaques
    plaques.forEach((id, i) => {
      const n = plaques.length;
      const cx = -108 + ((i + 0.5) / n) * 216;
      fill(c, cx - 44, -214, cx + 44, -102, (x, y, u, v) => {
        if (u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96) return P.gold[3]!;
        if (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92) return P.gold[1]!;
        return tone(P.lacquer, 0.3 + 0.3 * v, x, y, 0.3);
      });
      emblem(c, id, cx, -170, 1.6);
      // a gold name bar (the name itself is the panel's, in real text)
      fill(c, cx - 30, -128, cx + 30, -118, (x, y) => tone(P.gold, 0.3, x, y, 0.3));
    });
  },
});

// --- the gate back into the hall --------------------------------------------------------

export interface CourtGateP {
  w: number;
  h: number;
}

/** The hall's east doors onto the court: vermilion posts, a lacquer lintel, warm doors ajar. */
export const courtgate = definePainter<CourtGateP>("courtgate", {
  bounds(p) {
    return [-p.w / 2 - 30, -p.h - 50, p.w / 2 + 30, 4];
  },
  paint(c, p) {
    const hw = p.w / 2;
    fill(c, -hw + 10, -p.h + 20, hw - 10, 0, (x, y, u, v) => {
      // two leaves ajar: warm light between them
      if (Math.abs(u - 0.5) < 0.08) return tone(P.gold, 0.1 + 0.3 * v, x, y, 0.3);
      if (((c.lx(x + 0.5) % 20) + 20) % 20 < 2 && v < 0.9) return P.gold[3]!;
      return tone(P.red, u < 0.5 ? 0.45 : 0.62, x, y, 0.3);
    });
    for (const s of [-1, 1]) {
      fill(c, s * hw - 10, -p.h, s * hw + 10, 0, (x, y, u) => (u < 0.1 || u > 0.9 ? P.ink[0]! : tone(P.red, u < 0.4 ? 0.15 : 0.5, x, y, 0.3)));
    }
    fill(c, -hw - 20, -p.h - 4, hw + 20, -p.h + 20, (x, y, _u, v) => (v < 0.2 ? P.gold[2]! : tone(P.lacquer, 0.5, x, y, 0.3)));
    cap(c, -hw - 30, hw + 30, -p.h - 4, 34);
  },
});

// --- lantern pillars -------------------------------------------------------------------------

export interface LanternPillarP {
  h: number;
  /** Lit at night (the glow is drawn by the light pass later; the paper shows warmer). */
  lit?: boolean;
}

/** A stone pillar carrying a lacquer lantern house at its top, a red paper lantern inside. */
export const lanternpillar = definePainter<LanternPillarP>("lanternpillar", {
  bounds(p) {
    return [-34, -p.h - 64, 34, 4];
  },
  paint(c, p) {
    fill(c, -24, -16, 24, 0, (x, y, u, v) => tone(P.stone, v < 0.2 ? 0.05 : u < 0.25 ? 0.3 : u < 0.8 ? 0.5 : 0.8, x, y, 0.3));
    fill(c, -12, -p.h, 12, -16, (x, y, u) => {
      if (u < 0.08 || u > 0.92) return P.stone[6]!;
      return tone(P.stone, u < 0.3 ? 0.15 : u < 0.7 ? 0.38 : 0.66, x, y, 0.3);
    });
    // the lantern house
    fill(c, -22, -p.h - 46, 22, -p.h, (x, y, u, v) => {
      if (u < 0.1 || u > 0.9 || v > 0.88) return tone(P.lacquer, 0.6, x, y, 0.3);
      return tone(P.red, u < 0.4 ? (p.lit ? 0.0 : 0.1) : 0.3, x, y, 0.3);
    });
    cap(c, -32, 32, -p.h - 46, 18);
  },
});

// --- the paper spectators -------------------------------------------------------------------

export interface StandsP {
  /** Width of the stands, px of the back plane; the anchor is the centre of their front foot. */
  w: number;
  /** Rows of spectators (default 3). */
  rows?: number;
  /** 0, 1: idle (a little sway), 2: cheering, 3: hushed (leaning in). */
  frame?: number;
  /** Draw the tiers, trestles and lantern strings too (false: the spectators alone). */
  tiers?: boolean;
}

/**
 * The paper spectators in tiers behind the court: festival performers cut from paper, cream
 * and white with ink faces, a red fan or hat here and there, on stepped timber stands with
 * a red rail; strings of lanterns above. Their timber base runs down out of sight behind
 * the court (the prow hides it).
 */
export const stands = definePainter<StandsP>("stands", {
  bounds(p) {
    const rows = p.rows ?? 3;
    return [-p.w / 2 - 8, -rows * 34 - 76, p.w / 2 + 8, 260];
  },
  paint(c, p) {
    const rows = p.rows ?? 3;
    const f = p.frame ?? 0;
    const hw = p.w / 2;
    const tiers = p.tiers ?? true;
    // the base: timber trestles down out of sight
    if (tiers) fill(c, -hw, 0, hw, 260, (x, y) => {
      const lx = c.lx(x + 0.5);
      if (((lx + hw) % 60) < 8) return tone(P.timber, 0.75, x, y, 0.3);
      const ly = c.ly(y + 0.5);
      if (Math.abs(((ly + (lx + hw) * 0.8) % 120) - 60) < 3) return P.timber[5]!;
      return 0;
    });
    // the tiers, back to front
    for (let r = rows - 1; r >= 0; r--) {
      const top = -r * 34 - 20;
      const inset = r * 26;
      if (tiers) {
        fill(c, -hw + inset, top, hw - inset, top + 20 + r * 34, (x, y, _u, v) => {
          if (v < 0.08) return P.timber[1]!;
          return tone(P.timber, 0.45 + 0.15 * v, x, y, 0.3);
        });
        // red rail along each tier's front
        fill(c, -hw + inset, top - 4, hw - inset, top - 1, () => P.red[3]!);
      }
      // the spectators on this tier
      const n = Math.floor((p.w - inset * 2) / 22);
      for (let i = 0; i < n; i++) {
        const hsh = hash(i, r, c.seed);
        if (hsh < -0.8) continue; // a gap
        const sx = -hw + inset + 11 + i * 22 + hsh * 3;
        const sway = f === 1 ? (hsh > 0 ? 1 : -1) : 0;
        const lean = f === 3 ? 3 : 0;
        const bodyTop = top - 30 + (f === 2 ? -3 : 0);
        // a paper body (a rounded robe), cream or white, a few red
        const robe = hsh > 0.6 ? P.red : P.paper;
        fill(c, sx - 7 + sway + lean, bodyTop + 12, sx + 7 + sway + lean, top - 4, (x, y, u) => {
          if (u < 0.12 || u > 0.88) return robe[robe.length - 1]!;
          return tone(robe, u < 0.5 ? 0.1 : 0.3, x, y, 0.3);
        });
        // a head: paper with two ink dots
        const hx = sx + sway + lean * 1.5, hy = bodyTop + 6;
        oval(c, hx, hy, 6, 6, (x, y, du) => (du > 0.75 ? P.paper[3]! : tone(P.paper, 0.05, x, y, 0.3)));
        if (c.d >= 0.5) {
          c.buf.set(Math.round(c.X(hx - 2)), Math.round(c.Y(hy)), P.ink[0]!);
          c.buf.set(Math.round(c.X(hx + 2)), Math.round(c.Y(hy)), P.ink[0]!);
          if (f === 2) c.buf.set(Math.round(c.X(hx)), Math.round(c.Y(hy + 3)), P.red[4]!);
        }
        // arms up when cheering; hands to the mouth when hushed
        if (f === 2) {
          fill(c, sx - 9 + sway, bodyTop - 4, sx - 7 + sway, bodyTop + 12, () => robe[2]!);
          fill(c, sx + 7 + sway, bodyTop - 4, sx + 9 + sway, bodyTop + 12, () => robe[2]!);
          if (hsh > 0.3) fill(c, sx + 6, bodyTop - 10, sx + 13, bodyTop - 4, () => (hsh > 0.6 ? P.gold[2]! : P.red[2]!));
        } else if (f === 3) {
          fill(c, hx - 1, hy + 3, hx + 2, hy + 6, () => P.paper[2]!);
        } else if (hsh > 0.2 && hsh < 0.45) {
          // a red fan held up
          oval(c, sx + 9 + sway, bodyTop + 8, 5, 4, (x, y, du) => (du < -0.6 ? P.red[4]! : tone(P.red, 0.25, x, y, 0.3)));
        }
      }
    }
    // strings of small lanterns over the stands
    if (tiers) for (let lx = -hw + 20; lx < hw - 20; lx += 1 / c.d) {
      const sag = Math.sin(((lx + hw) / p.w) * Math.PI * 3) * 6;
      const y = -rows * 34 - 58 + Math.abs(sag);
      c.buf.set(Math.round(c.X(lx)), Math.round(c.Y(y)), P.ink[0]!);
      if (((Math.round(lx) % 46) + 46) % 46 === 0) oval(c, lx, y + 7, 4, 5, (x, yy, du) => tone(P.red, du < 0 ? 0.1 : 0.35, x, yy, 0.3));
    }
  },
});
