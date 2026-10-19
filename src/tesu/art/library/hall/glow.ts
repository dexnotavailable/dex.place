// The hall's moving light: hanging lanterns that sway on their long cords and flicker, the
// skylight's shaft that breathes slowly, and the dust turning in it. All sprites (authored
// frames); see the manifest for planes, rates and reduced motion.
//
// Timing (art bible 6): a lantern on a 3-5 m cord swings with a 4 s period, about a pixel and
// a half at the lantern (12 frames at 3 fps), its flame flickering irregularly frame to frame;
// the shaft breathes over 8 s (8 frames at 1 fps); the dust drifts down and to the right and
// turns, 16 frames at 4 fps, looping.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, SCREEN, clamp, hash, keep, lathe, poly, rect, tn, vnoise, type Ramp } from "./kit.ts";

// ---------------------------------------------------------------------------
// Hanging lanterns
// ---------------------------------------------------------------------------
export interface LanternP {
  kind: "round" | "tall" | "palace" | "drum";
  /** Size (1 = the play plane's standard lantern, about 0.4 H across). */
  s: number;
  /** Cord length from the hook (the anchor, up out of the frame) to the lantern's cap, px. */
  cord: number;
  /** Phase offset (0..1) so neighbours never swing together; how lit (0..1). */
  phase?: number;
  lit?: number;
  frame?: number;
}

const FRAMES = 12;

function dims(p: LanternP): { w: number; h: number } {
  const s = p.s;
  switch (p.kind) {
    case "round": return { w: 19 * s, h: 21 * s };
    case "tall": return { w: 14 * s, h: 30 * s };
    case "palace": return { w: 18 * s, h: 26 * s };
    default: return { w: 25 * s, h: 20 * s };
  }
}

export const lantern = definePainter<LanternP>("hall.lantern", {
  bounds(p) {
    const d = dims(p);
    const halo = d.w * 1.6;
    return [-halo - 4, 0, halo + 4, p.cord + d.h * 2 + 22 * p.s + halo * 0.6];
  },
  paint(c, p) {
    const f = (p.frame ?? 0) % FRAMES;
    const ph = p.phase ?? 0;
    const d = dims(p);
    const lit = p.lit ?? 1;
    // the swing: a pendulum on the cord; at the lantern about 1.5 px either way
    const ang = Math.sin(((f / FRAMES) + ph) * Math.PI * 2);
    const sway = Math.round(ang * 1.6 * Math.min(1.5, p.cord / 300 + 0.6));
    const flick = 0.86 + 0.14 * hash(f, 7, Math.floor(ph * 997));
    const cx = sway, top = p.cord;
    // the cord: from the hook, leaning with the swing
    const n = Math.ceil(p.cord * c.d);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const X = Math.round(c.X(cx * t)), Y = Math.round(c.Y(top * t));
      c.buf.set(X, Y, P.umber[4]!);
    }
    // (hall loop round 1) no dithered halo: the lantern's light is painted where it lands, on the
    // walls, things and floor round it (hall-light.ts); the lantern itself is the hot shape
    body(c, p, cx, top, d, lit * flick);
  },
});

function body(c: PaintCtx, p: LanternP, cx: number, top: number, d: { w: number; h: number }, glow: number): void {
  const s = p.s;
  const capH = Math.max(2, 3 * s);
  const red: Ramp = [P.ember[1]!, P.ember[2]!, P.red[1]!, P.red[2]!, P.red[3]!, P.red[4]!, P.umber[2]!];
  // the body's light: bright core, darker toward the rim (it is lit from inside)
  const core = (u: number, v: number): number => clamp(1 - (u * u * 0.8 + (v - 0.05) * (v - 0.05) * 0.6) - (1 - glow) * 0.5, 0, 1);
  // top cap and hook
  rect(c, cx - 1, top - 1, cx + 1, top + capH, (X, Y) => tn(M.gold, 0.5, X, Y, 0));
  if (p.kind === "round" || p.kind === "drum") {
    const ry = d.h / 2, rx = d.w / 2;
    const cy = top + capH + ry;
    rect(c, cx - rx * 0.55, top + capH * 0.4, cx + rx * 0.55, top + capH * 1.3, (X, Y, lx) => tn(M.gold, (lx - cx) / rx > 0.2 ? 0.55 : 0.25, X, Y, 0));
    lathe(c, cx, cy - ry, cy + ry, (ly) => {
      const t = (ly - cy) / ry;
      return rx * Math.sqrt(Math.max(0, 1 - t * t * (p.kind === "drum" ? 0.55 : 0.95)));
    }, (X, Y, u, _lx, ly) => {
      const v = (ly - cy) / ry;
      const rib = p.kind === "round" && Math.abs(((Math.asin(clamp(u, -1, 1)) / Math.PI) * 8 + 8) % 1 - 0.5) > 0.42;
      const b = core(u, v) - (rib ? 0.18 : 0);
      if (p.kind === "drum") {
        const band = Math.abs(v) > 0.72;
        if (band) return tn(M.verm, clamp(0.55 - b * 0.4, 0, 1), X, Y, 0.3);
        return tn(SCREEN, clamp(0.95 - b * 1.05, 0, 1), X, Y, 0.5);
      }
      return tn(red, clamp(1 - b * 1.05, 0, 1), X, Y, 0.5);
    });
    rect(c, cx - rx * 0.5, cy + ry - 1, cx + rx * 0.5, cy + ry + capH, (X, Y, lx) => tn(M.gold, (lx - cx) / rx > 0.2 ? 0.6 : 0.3, X, Y, 0));
    tassel(c, cx, cy + ry + capH, 12 * s, s);
  } else if (p.kind === "tall") {
    const rx = d.w / 2, y0 = top + capH, y1 = y0 + d.h;
    rect(c, cx - rx - 1, y0 - 1, cx + rx + 1, y0 + capH, (X, Y, lx) => tn(M.gold, (lx - cx) / rx > 0.3 ? 0.6 : 0.3, X, Y, 0));
    lathe(c, cx, y0 + capH, y1, () => rx, (X, Y, u, lx, ly) => {
      const v = ((ly - y0) / d.h) * 2 - 1;
      const branch = Math.abs((lx - cx) - Math.sin(ly * 0.3) * rx * 0.5) < 0.8 && v > -0.2 && v < 0.7 && Math.abs(u) < 0.7;
      const b = core(u, v * 0.7);
      if (branch) return tn(M.wood, 0.55, X, Y, 0);
      return tn(SCREEN, clamp(0.95 - b * 1.0, 0, 1), X, Y, 0.5);
    });
    rect(c, cx - rx - 1, y1, cx + rx + 1, y1 + capH, (X, Y, lx) => tn(M.gold, (lx - cx) / rx > 0.3 ? 0.6 : 0.3, X, Y, 0));
    tassel(c, cx, y1 + capH, 13 * s, s);
  } else {
    // the palace lantern: a lacquer frame, six paper panels (two seen), red corner ribs, tassels
    const rx = d.w / 2, y0 = top + capH + 2 * s, y1 = y0 + d.h * 0.78;
    // a little roof cap
    for (let i = 0; i < Math.ceil(4 * s); i++) {
      const w = rx * (0.55 + i / (4 * s) * 0.6);
      rect(c, cx - w, top + capH + i - 2 * s, cx + w, top + capH + i + 1 - 2 * s, (X, Y, lx) => tn(M.lacq, (lx - cx) / w > 0.3 ? 0.7 : 0.45, X, Y, 0));
    }
    rect(c, cx - rx, y0, cx + rx, y1, (X, Y, lx, ly) => {
      const u = (lx - cx) / rx, v = ((ly - y0) / (y1 - y0)) * 2 - 1;
      const post = Math.abs(u) > 0.86 || Math.abs(u) < 0.07;
      if (post) return tn(M.verm, Math.abs(u) > 0.86 ? 0.55 : 0.4, X, Y, 0.3);
      if (Math.abs(v) > 0.86) return tn(M.lacq, 0.5, X, Y, 0.3);
      const b = core(u * 0.8, v * 0.6);
      const paint = Math.hypot((Math.abs(u) - 0.47) * 3, v * 1.6) < 0.5 && hash(Math.floor(lx), Math.floor(ly), 3) > 0.3;
      if (paint) return tn(red, clamp(0.85 - b * 0.6, 0, 1), X, Y, 0.4);
      return tn(SCREEN, clamp(0.92 - b * 1.0, 0, 1), X, Y, 0.5);
    });
    // the base skirt and three tassels
    rect(c, cx - rx * 0.8, y1, cx + rx * 0.8, y1 + 2.5 * s, (X, Y, lx) => tn(M.gold, (lx - cx) / rx > 0.2 ? 0.6 : 0.3, X, Y, 0));
    for (const t of [-0.85, 0, 0.85]) tassel(c, cx + t * rx, y1 + 2.5 * s, (t === 0 ? 13 : 9) * s, s * (t === 0 ? 1 : 0.7));
  }
}

function tassel(c: PaintCtx, x: number, y: number, len: number, s: number): void {
  rect(c, x - 0.5, y, x + 0.5, y + len * 0.35, (X, Y) => tn(M.verm, 0.4, X, Y, 0));
  // a knot, then the tassel's skirt widening a little
  rect(c, x - 1.2 * s, y + len * 0.35, x + 1.2 * s, y + len * 0.45, (X, Y) => tn(M.gold, 0.4, X, Y, 0));
  rect(c, x - 1.4 * s, y + len * 0.45, x + 1.4 * s, y + len, (X, Y, lx) => tn(M.verm, (lx - x) / (1.4 * s) > 0.2 ? 0.6 : 0.4, X, Y, 0.3));
}

// ---------------------------------------------------------------------------
// The skylight's shaft
// ---------------------------------------------------------------------------
export interface ShaftP {
  /** The shaft's foot is the anchor (on the floor); its top is `h` px up and `lean` px to the left. */
  h: number;
  lean: number;
  /** Width at the foot and at the top (px). */
  w: number;
  wTop: number;
  /** Bands it passes behind (local y from the foot, negative: [top, bottom]) where nothing is drawn. */
  gaps?: [number, number][];
  frame?: number;
}

export const shaft = definePainter<ShaftP>("hall.shaft", {
  bounds(p) {
    return [-p.lean - p.wTop * 1.9, -p.h, p.w * 1.9, 2];
  },
  paint(c, p) {
    // (hall loop round 1) not a stipple: a few god rays of different widths and lengths down the
    // shaft's slant, the lit air between them a sparse drift of glinting dust (thick in the core,
    // thinning outward: the shaft's soft bands), and a clean edge ray each side. What the shaft
    // passes through is lit a step by the room's light (hall-light.ts); this is only the lit air.
    const f = p.frame ?? 0;
    const breathe = Math.sin((f / 8) * Math.PI * 2);
    const rays: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) rays.push([-0.7 + (1.4 * (i + hash(i, 1, c.seed))) / 5, 0.6 + 1.6 * hash(i, 2, c.seed), hash(i, 3, c.seed)]);
    rect(c, -p.lean - p.wTop * 1.9, -p.h, p.w * 1.9, 0, (X, Y, lx, ly) => {
      if (p.gaps && p.gaps.some((g) => ly > g[0] && ly < g[1])) return 0;
      const t = -ly / p.h; // 0 at the foot .. 1 at the top
      const axis = -p.lean * t;
      const half = (p.w * (1 - t) + p.wTop * t) / 2;
      const s = lx - axis;
      const u = s / half;
      const au = Math.abs(u);
      if (au > 1.02) return 0;
      const low = 1 - t * 0.55;
      // the clean edge each side
      if (Math.abs(au - 0.98) * half < 0.55 && vnoise(u < 0 ? 3 : 7, ly * 0.03 + f * 0.2, 11) > 0.3) return P.ember[2]!;
      // two or three god rays in the core, long dashes drifting as it breathes
      for (const [ru, rw, rs] of rays) {
        if (Math.abs(ru) > 0.5) continue;
        if (Math.abs(s - ru * half) < rw / 2 / Math.max(1, c.d) + 0.25) {
          const n = vnoise(rs * 17, ly * 0.022 + f * 0.18, 13) + breathe * 0.05;
          if (n > 0.52) return n > 0.7 && low > 0.65 ? P.ember[1]! : P.ember[2]!;
        }
      }
      // the lit air in three soft bands, each a step of coverage with a clean border between them,
      // in amber close to the hall's own warm values (a glow, not a screen)
      const cov = (au < 0.42 ? 0.25 : au < 0.76 ? 0.125 : 0.0625) * (low > 0.7 ? 1 : 0.5 + low * 0.7);
      if (keep(X, Y, cov)) return au < 0.42 ? P.ember[2]! : P.ember[3]!;
      return 0;
    });
  },
});

// ---------------------------------------------------------------------------
// Dust in the shaft
// ---------------------------------------------------------------------------
export interface DustP {
  h: number;
  lean: number;
  w: number;
  n: number;
  frame?: number;
}

const DUST_FRAMES = 16;

export const dust = definePainter<DustP>("hall.dust", {
  bounds(p) {
    return [-p.lean - p.w, -p.h, p.w + 4, 4];
  },
  paint(c, p) {
    const f = (p.frame ?? 0) % DUST_FRAMES;
    const tt = f / DUST_FRAMES;
    for (let i = 0; i < p.n; i++) {
      // each mote loops on its own small orbit, drifting down and right in the light
      const t0 = hash(i, 1, c.seed), x0 = hash(i, 2, c.seed) * 2 - 1, y0 = hash(i, 3, c.seed);
      const ph = (tt + t0) * Math.PI * 2;
      const ly = -p.h * (0.08 + 0.85 * y0) + Math.sin(ph) * 9;
      const t = -ly / p.h;
      const axis = -p.lean * t;
      const half = p.w * (1 - 0.15 * t) / 2;
      const lx = axis + x0 * half * 0.85 + Math.cos(ph * (hash(i, 4, c.seed) > 0.5 ? 1 : -1)) * 6;
      const tw = Math.sin(ph * 2 + i) > -0.3;
      if (!tw) continue;
      const X = Math.round(c.X(lx)), Y = Math.round(c.Y(ly));
      c.buf.set(X, Y, hash(i, 5, c.seed) > 0.4 ? P.ember[0]! : P.paper[1]!);
      if (hash(i, 6, c.seed) > 0.85 && c.d >= 1) c.buf.set(X + 1, Y, P.ember[1]!);
    }
  },
});

// ---------------------------------------------------------------------------
// A paper crane taking off from the Crane Desk: it lifts, finds the shaft and rises up it out
// of the frame toward the skylight, then the desk is quiet a while (frames 0-23 the flight at
// 8 fps, 24-63 empty: an 8 s loop). Wings beat every other frame, slower as it climbs.
// ---------------------------------------------------------------------------
export interface CraneFlightP {
  /** The rise (px) and the drift left along the shaft (px) over the flight. */
  rise: number;
  drift: number;
  frame?: number;
}

export const CRANE_FRAMES = 64;

export const craneFlight = definePainter<CraneFlightP>("hall.craneflight", {
  bounds(p) {
    return [-p.drift - 24, -p.rise - 24, 40, 6];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    if (f >= 24) return;
    const t = f / 23;
    // ease out of the desk, then a steady climb with a slow sideways weave
    const e = t < 0.25 ? (t / 0.25) ** 2 * 0.12 : 0.12 + (t - 0.25) / 0.75 * 0.88;
    const x = -p.drift * e + Math.sin(t * Math.PI * 3) * 6 * t;
    const y = -p.rise * e - 4;
    const up = f % 2 === 0;
    const s = 1;
    const body = [x - 6 * s, y, x + 7 * s, y - 2 * s, x + 9 * s, y - 5 * s, x + 4 * s, y - 1 * s, x - 2 * s, y + 1 * s];
    poly(c, body, (X, Y) => tn(M.paper, 0.05, X, Y, 0));
    const wing = up
      ? [x - 2 * s, y - 1 * s, x + 2 * s, y - 1 * s, x - 1 * s, y - 10 * s]
      : [x - 2 * s, y, x + 2 * s, y, x + 1 * s, y + 7 * s];
    poly(c, wing, (X, Y) => tn(M.paper, up ? 0.2 : 0.4, X, Y, 0));
  },
});

// ---------------------------------------------------------------------------
// Incense smoke: a thread rising from a censer, wavering, widening and breaking up as it
// climbs (16 frames at 4 fps, looping)
// ---------------------------------------------------------------------------
export interface SmokeP {
  h: number;
  frame?: number;
}

export const smoke = definePainter<SmokeP>("hall.smoke", {
  bounds(p) {
    return [-30, -p.h, 30, 2];
  },
  paint(c, p) {
    const f = (p.frame ?? 0) % 16;
    const ph = (f / 16) * Math.PI * 2;
    for (let ly = 0; ly > -p.h; ly -= 1 / c.d) {
      const t = -ly / p.h;
      const x = Math.sin(t * 7 - ph) * 5 * t + Math.sin(t * 3.1 - ph * 0.5) * 9 * t * t;
      const w = 0.6 + t * 6;
      const a = (t < 0.5 ? 0.5 : 0.5 * (1 - (t - 0.5) * 2)) * (0.6 + 0.4 * Math.sin(t * 13 - ph * 2));
      for (let dx = -w; dx <= w; dx += 1 / c.d) {
        const X = Math.round(c.X(x + dx)), Y = Math.round(c.Y(ly));
        const edge = 1 - Math.abs(dx) / (w + 0.01);
        if (keep(X, Y, a * edge)) c.buf.set(X, Y, t < 0.3 ? P.paper[1]! : P.paper[3]!);
      }
    }
  },
});
