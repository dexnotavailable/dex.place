// Hit shapes: point, circle, cone, line, rect, and the slash arc that follows
// Rosace's actual swing (an elliptical band between two angles). Plus the
// sandbox presets for her moves, sized in H from docs/character/MOVESET.md.

import type { Rect } from "./cells.ts";

export type HitShape =
  | { kind: "point"; x: number; y: number }
  | { kind: "circle"; x: number; y: number; r: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "line"; x0: number; y0: number; x1: number; y1: number; w: number }
  | { kind: "cone"; x: number; y: number; dir: number; spread: number; len: number }
  /** Elliptical band: outer radii rx, ry, `thick` px deep, from angle a0 to a1 (radians, y down, sweep either way). */
  | { kind: "arc"; x: number; y: number; rx: number; ry: number; a0: number; a1: number; thick: number };

export type HitType = "slash" | "heavy" | "q" | "r" | "point" | "wind";

export interface Hit {
  shape: HitShape;
  type: HitType;
  /** Damage per fully covered cell. */
  damage: number;
  /** Launch speed for debris, px/s. */
  force: number;
  /** Unit direction the hit travels (debris and knock direction). */
  dir: [number, number];
  /** Carve a crater where it meets the ground: radii in px and rim height. */
  crater?: { rx: number; ry: number; rim: number };
  /** Leave a slash scar on the ground. */
  scar?: boolean;
  source?: string;
}

const TAU = Math.PI * 2;

function angleIn(a: number, a0: number, a1: number): number {
  // position 0..1 along the sweep from a0 to a1, or -1
  const span = a1 - a0;
  let rel = a - a0;
  if (span >= 0) rel = ((rel % TAU) + TAU) % TAU;
  else rel = -((((-rel) % TAU) + TAU) % TAU);
  const s = rel / (span || 1e-6);
  return s >= 0 && s <= 1 ? s : -1;
}

/** Coverage of world point (x, y): 0 outside, up to 1 at the core. */
export function coverage(h: HitShape, x: number, y: number): number {
  switch (h.kind) {
    case "point": {
      const d = Math.hypot(x - h.x, y - h.y);
      return d <= 1.6 ? 1 : d <= 3 ? 0.4 : 0;
    }
    case "circle": {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d > h.r) return 0;
      return Math.min(1, 1.35 - (d / h.r) * 0.7);
    }
    case "rect":
      return x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h ? 1 : 0;
    case "line": {
      const dx = h.x1 - h.x0, dy = h.y1 - h.y0, L2 = dx * dx + dy * dy || 1e-9;
      let t = ((x - h.x0) * dx + (y - h.y0) * dy) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - h.x0 - dx * t, y - h.y0 - dy * t);
      return d <= h.w / 2 ? 1 - (d / (h.w / 2)) * 0.5 : 0;
    }
    case "cone": {
      const dx = x - h.x, dy = y - h.y;
      const d = Math.hypot(dx, dy);
      if (d > h.len) return 0;
      let da = Math.atan2(dy, dx) - h.dir;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > h.spread / 2) return 0;
      return 1 - (d / h.len) * 0.5;
    }
    case "arc": {
      const nx = (x - h.x) / h.rx, ny = (y - h.y) / h.ry;
      const r = Math.hypot(nx, ny);
      const rin = 1 - h.thick / Math.max(1, (h.rx + h.ry) / 2);
      if (r > 1 || r < rin) return 0;
      const s = angleIn(Math.atan2(ny, nx), h.a0, h.a1);
      if (s < 0) return 0;
      // thickest behind the leading edge (like the smear), thin tail
      const across = (r - rin) / Math.max(1e-3, 1 - rin);
      const body = Math.sin(Math.PI * Math.pow(s, 0.6));
      if (across < 1 - body) return 0;
      return 0.5 + 0.5 * across;
    }
  }
}

export function hitBounds(h: HitShape): Rect {
  switch (h.kind) {
    case "point":
      return { x0: h.x - 3, y0: h.y - 3, x1: h.x + 3, y1: h.y + 3 };
    case "circle":
      return { x0: h.x - h.r, y0: h.y - h.r, x1: h.x + h.r, y1: h.y + h.r };
    case "rect":
      return { x0: h.x, y0: h.y, x1: h.x + h.w, y1: h.y + h.h };
    case "line":
      return { x0: Math.min(h.x0, h.x1) - h.w, y0: Math.min(h.y0, h.y1) - h.w, x1: Math.max(h.x0, h.x1) + h.w, y1: Math.max(h.y0, h.y1) + h.w };
    case "cone":
      return { x0: h.x - h.len, y0: h.y - h.len, x1: h.x + h.len, y1: h.y + h.len };
    case "arc":
      return { x0: h.x - h.rx, y0: h.y - h.ry, x1: h.x + h.rx, y1: h.y + h.ry };
  }
}

/** The cutting edge as a polyline (ropes, cloth, cords). */
export function cutPath(h: HitShape): number[] {
  switch (h.kind) {
    case "line":
      return [h.x0, h.y0, h.x1, h.y1];
    case "arc": {
      const pts: number[] = [];
      const rm = 1 - h.thick / Math.max(1, (h.rx + h.ry) / 2) / 2;
      for (let i = 0; i <= 24; i++) {
        const a = h.a0 + ((h.a1 - h.a0) * i) / 24;
        pts.push(h.x + Math.cos(a) * h.rx * rm, h.y + Math.sin(a) * h.ry * rm);
      }
      return pts;
    }
    case "cone":
      return [h.x, h.y, h.x + Math.cos(h.dir) * h.len, h.y + Math.sin(h.dir) * h.len];
    default: {
      const b = hitBounds(h);
      return [b.x0, (b.y0 + b.y1) / 2, b.x1, (b.y0 + b.y1) / 2, (b.x0 + b.x1) / 2, b.y0, (b.x0 + b.x1) / 2, b.y1];
    }
  }
}

/** Contact point for effects: the shape's centre of mass-ish. */
export function hitCentre(h: HitShape): [number, number] {
  if (h.kind === "arc") {
    const a = (h.a0 + h.a1) / 2;
    return [h.x + Math.cos(a) * h.rx, h.y + Math.sin(a) * h.ry];
  }
  if (h.kind === "line") return [(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2];
  if (h.kind === "rect") return [h.x + h.w / 2, h.y + h.h / 2];
  return [h.x, h.y];
}

// ---------------------------------------------------------------------------
// Presets for Rosace's moves (sandbox and early world use). Sizes from
// MOVESET.md: N1 crescent 2.5 H across, 1.75 H tall; N4 chop + fissures 2.5 H;
// Q shatter 5.6 H wide, 1.8 H tall; R the whole view.
// ---------------------------------------------------------------------------

/** `x, y`: her foot pivot; `face`: +1 right / -1 left; H: player height. */
export function presetHit(type: HitType, x: number, y: number, face: 1 | -1, H: number): Hit[] {
  const f = face;
  switch (type) {
    case "slash": {
      // N1 "Kyrie": scooping rising cut, a J-shaped crescent from the floor behind to high in front
      const cx = x + f * 0.2 * H, cy = y - 0.88 * H;
      const a0 = f > 0 ? Math.PI * 0.72 : Math.PI * 0.28;
      const a1 = f > 0 ? -Math.PI * 0.42 : Math.PI * 1.42;
      return [{
        shape: { kind: "arc", x: cx, y: cy, rx: 1.25 * H, ry: 0.88 * H, a0, a1, thick: 0.2 * H },
        type, damage: 45, force: 2.6 * H, dir: [f, -0.35], scar: true,
      }];
    }
    case "heavy": {
      // N4 "Credo": a chop 0.3-1.3 H ahead, from 1.7 H down into the floor, then fissures
      const cx = x + f * 0.85 * H;
      return [
        { shape: { kind: "line", x0: cx - f * 0.25 * H, y0: y - 1.7 * H, x1: cx + f * 0.1 * H, y1: y + 0.12 * H, w: 0.22 * H }, type, damage: 110, force: 3.2 * H, dir: [f * 0.3, 1], scar: true },
        { shape: { kind: "circle", x: cx, y, r: 0.55 * H }, type, damage: 80, force: 3.6 * H, dir: [0, -1], crater: { rx: 0.42 * H, ry: 0.16 * H, rim: 3 } },
      ];
    }
    case "q": {
      // Q "Nave" shatter: 5.6 H wide, 1.8 H tall, centred on her; crater at the stamp
      return [
        { shape: { kind: "arc", x, y, rx: 2.8 * H, ry: 1.8 * H, a0: Math.PI, a1: Math.PI * 2, thick: 0.55 * H }, type, damage: 150, force: 4.5 * H, dir: [0, -1] },
        { shape: { kind: "circle", x, y, r: 0.8 * H }, type, damage: 150, force: 4.5 * H, dir: [0, -1], crater: { rx: 0.7 * H, ry: 0.22 * H, rim: 4 } },
      ];
    }
    case "r": {
      // R "Te Deum": beams across the whole view, each leaving a crater
      const out: Hit[] = [];
      for (let k = -3; k <= 3; k++) {
        const bx = x + k * 1.9 * H;
        out.push({ shape: { kind: "rect", x: bx - 0.28 * H, y: y - 9 * H, w: 0.56 * H, h: 9.3 * H }, type, damage: 260, force: 5 * H, dir: [0, 1], crater: { rx: 0.5 * H, ry: 0.2 * H, rim: 4 } });
      }
      return out;
    }
    case "point":
      return [{ shape: { kind: "circle", x, y, r: 0.12 * H }, type, damage: 60, force: 2 * H, dir: [f, 0] }];
    case "wind":
      return [{ shape: { kind: "cone", x, y: y - 0.5 * H, dir: f > 0 ? 0 : Math.PI, spread: 1.1, len: 2.4 * H }, type, damage: 0, force: 5 * H, dir: [f, 0] }];
  }
}
