// The blending toolkit: what makes a room's layers read as one image (shared light, palette and
// atmosphere) instead of a backdrop with things stood in front of it. A room opts in with
// `RoomDef.blend` (types.ts); a room without it renders exactly as before.
//
//   grade    one colour cast over the composed world (backdrop, terrain, props, the player): a
//            multiply toward the room's light, then a small lift in its haze colour, so the sprite
//            lighting and the backdrop's own palette land in the same family. fromLight() derives it.
//   haze     distance haze on pixel-matter props: parts on the far layer take a veil of the haze
//            colour, bg parts half of it, so a far lantern is paler and bluer than the lamp beside
//            you (the backdrop's own fog does the same for scene layers).
//   band     a soft contact band above every exposed terrain top: a few stepped, dithered rows of
//            the haze colour, so the ground line melts into the backdrop behind it instead of
//            cutting it with a hard edge (rock and earth: over their irregular rim).
//   shadow   strength of the contact shadows under props and the player (game.ts
//            drawContactShadows; 1 = as before, 0 = off).
//   halo     a stepped, dithered additive glow around every lit lamp, in the lamp's own colour, so a
//            light source tints the pixels around it and not only the sprites it lights. Steady (it
//            never follows a flicker), so it adds nothing to the flash budget.
//
// Everything is whole pixels, no blur; bands and halos use the renderer's dithered rect (Bayer, per
// world pixel). Audit: docs/world/SCENES.md "The blending toolkit".

import type { Lighting, RGB, WorldRenderer } from "./renderer.ts";
import type { PixelWorld } from "../../pixel/index.ts";
import type { RoomDef } from "../room/types.ts";
import type { PropLight } from "../props-api.ts";
import { FRAME, SCALE } from "../config.ts";

export interface BlendSpec {
  grade?: { mul?: RGB; lift?: RGB };
  haze?: { colour: RGB; far: number; bg?: number };
  band?: { colour?: RGB; rows?: number; strength?: number };
  shadow?: number;
  halo?: { strength?: number; minRadius?: number; max?: number };
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * A spec from a room's own sprite lighting: the cast toward its key and rim light, and a haze in the
 * rim's colour softened toward the ambient. `amount` (0..1) is how strongly the whole composed frame
 * is pulled toward that light (default 0.16: felt, never a filter), `haze` the far-prop veil.
 */
export function fromLight(l: Pick<Lighting, "ambient" | "keyColour" | "rimColour">, o: { amount?: number; haze?: number; band?: number; halo?: number } = {}): BlendSpec {
  const amount = o.amount ?? 0.16;
  const tint = l.keyColour.map((k, i) => k * 0.6 + l.rimColour[i]! * 0.4) as RGB;
  const top = Math.max(...tint, 1e-3);
  const cast = tint.map((t) => t / top) as RGB; // brightest channel 1: hue only
  const mul = cast.map((c) => mix(1, c, amount)) as RGB;
  // haze: the rim colour pulled toward the ambient, lifted so it reads as air, not as paint
  const haze = l.rimColour.map((r, i) => clamp01(mix(r, l.ambient[i]! * 1.6 + 0.12, 0.45))) as RGB;
  return {
    grade: { mul, lift: haze.map((h) => h * 0.03) as RGB },
    haze: { colour: haze, far: o.haze ?? 0.3, bg: (o.haze ?? 0.3) * 0.45 },
    band: { colour: haze, rows: 8, strength: o.band ?? 1 },
    shadow: 1,
    halo: { strength: o.halo ?? 1 },
  };
}

/** `?blend=auto` turns fromLight() on for every room that has no spec of its own (a review switch). */
const AUTO = typeof location !== "undefined" && /[?&]blend=auto\b/.test(location.search);

/** The spec a room uses: its own, the auto review spec, or none. */
export function resolveBlend(def: Pick<RoomDef, "blend" | "lighting">): BlendSpec | null {
  if (def.blend) return def.blend;
  return AUTO ? fromLight(def.lighting) : null;
}

/** Far and bg pixel parts take the distance veil (Part.fog = colour + amount). Recipes that set their own fog keep it. */
export function applyHaze(world: PixelWorld, spec: BlendSpec | null): void {
  const h = spec?.haze;
  if (!h) return;
  for (const p of world.allParts()) {
    if (p.fog[3] > 0) continue;
    const a = p.layer === "far" ? h.far : p.layer === "bg" ? (h.bg ?? h.far * 0.45) : 0;
    if (a > 0) p.fog = [h.colour[0], h.colour[1], h.colour[2], a];
  }
}

interface Seg {
  x0: number;
  x1: number;
  /** Row of the collision line; the band starts `lift` rows above it. */
  y: number;
  lift: number;
}

/** Steps of the band, strongest at the ground line: opacity per row above it (times strength). */
const BAND_STEPS = [0.26, 0.2, 0.15, 0.1, 0.07, 0.045, 0.025, 0.012];

/** Exposed terrain tops of a room, by interval subtraction: a top covered by a higher or level neighbour is not a horizon. */
export function exposedTops(def: Pick<RoomDef, "terrain">, H = SCALE.H): Seg[] {
  const solids = def.terrain.filter((t) => !t.oneWay && t.art !== "none" && !t.front);
  const out: Seg[] = [];
  for (const t of solids) {
    let spans: [number, number][] = [[t.x, t.x + t.w]];
    for (const o of solids) {
      if (o === t || o.y > t.y + 1) continue; // only a level or higher neighbour covers this top
      const lo = o.x, hi = o.x + o.w;
      const next: [number, number][] = [];
      for (const [a, b] of spans) {
        if (hi <= a || lo >= b) next.push([a, b]);
        else {
          if (lo > a) next.push([a, lo]);
          if (hi < b) next.push([hi, b]);
        }
      }
      spans = next;
    }
    const lift = t.art === "rock" ? Math.round(H * 0.16 * 0.5) : t.art === "earth" ? Math.round(H * 0.03) : 0;
    for (const [a, b] of spans) if (b - a >= 12) out.push({ x0: a, x1: b, y: t.y, lift });
  }
  return out;
}

/** A room's blending: built with the room, drawn by game.ts at four points of the frame. */
export class RoomBlend {
  private tops: Seg[];
  private halos: { dx: number; dy: number; w: number; level: number }[][] = [];

  constructor(def: Pick<RoomDef, "terrain">, readonly spec: BlendSpec) {
    this.tops = spec.band ? exposedTops(def) : [];
  }

  /** The contact shadow multiplier game.ts applies. */
  get shadow(): number {
    return this.spec.shadow ?? 1;
  }

  /** After the far/bg layers and before the terrain: the band above every exposed top in view. */
  drawBand(r: WorldRenderer): void {
    const b = this.spec.band;
    if (!b || !this.tops.length) return;
    const col = b.colour ?? [0.5, 0.5, 0.55];
    const rows = Math.min(BAND_STEPS.length, b.rows ?? 9);
    const k = b.strength ?? 1;
    const vx0 = r.camX - 4, vx1 = r.camX + r.iw + 4, vy0 = r.camY - 40, vy1 = r.camY + r.ih + 40;
    for (const s of this.tops) {
      if (s.x1 < vx0 || s.x0 > vx1 || s.y < vy0 || s.y - s.lift - rows > vy1) continue;
      const x0 = Math.max(s.x0, vx0), x1 = Math.min(s.x1, vx1);
      for (let i = 0; i < rows + s.lift; i++) {
        const a = BAND_STEPS[Math.max(0, i - s.lift)]! * k;
        if (a <= 0.01) continue;
        r.rect(x0, s.y - 1 - i, x1 - x0, 1, col, 1, Math.min(1, a));
      }
    }
  }

  /** The colour grade over the composed world (call once the world's own sprites are drawn, before the front backdrop pass). */
  drawGrade(r: WorldRenderer): void {
    const g = this.spec.grade;
    if (!g) return;
    if (g.mul) r.dim(g.mul);
    if (g.lift) r.rect(0, 0, FRAME.w, FRAME.h, g.lift, 0, 1, true);
  }

  /** A stepped disc as scanline spans, cached by radius: levels 1 (outer) to `steps` (core). */
  private disc(radius: number, steps: number): { dx: number; dy: number; w: number; level: number }[] {
    const key = radius * 8 + steps;
    let d = this.halos[key];
    if (d) return d;
    d = [];
    for (let level = 1; level <= steps; level++) {
      const R = Math.max(2, Math.round((radius * (steps + 1 - level)) / steps));
      for (let dy = -R; dy <= R; dy += 1) {
        const w = Math.round(Math.sqrt(R * R - dy * dy) * 2);
        if (w > 0) d.push({ dx: -(w >> 1), dy, w, level });
      }
    }
    this.halos[key] = d;
    return d;
  }

  /** Halos around the room's lit lamps, in view. Additive, steady, dithered. */
  drawHalos(r: WorldRenderer, lights: readonly PropLight[]): void {
    const h = this.spec.halo;
    if (!h) return;
    const min = h.minRadius ?? SCALE.H * 0.6;
    const max = h.max ?? 5;
    const k = h.strength ?? 1;
    let n = 0;
    for (const l of lights) {
      if (n >= max) break;
      if (l.radius < min || l.intensity < 0.25) continue;
      const R = Math.min(Math.round(l.radius * 0.55), Math.round(SCALE.H * 1.1));
      const cx = Math.round(l.x), cy = Math.round(l.y);
      if (cx + R < r.camX || cx - R > r.camX + r.iw || cy + R < r.camY || cy - R > r.camY + r.ih) continue;
      n++;
      // quarter steps of intensity: the halo does not follow a flame's flicker
      const q = Math.max(1, Math.round(Math.min(1, l.intensity) * 4)) / 4;
      // five thin steps stacked toward the core, each one a dithered additive disc in the lamp's own
      // colour (pushed a little warmer than the lamp itself so it reads as light, not as grey haze)
      const steps = 5;
      const warm = (c: number): number => Math.pow(c, 1.35) * 0.028 * k * q;
      const colour: RGB = [warm(l.colour[0]), warm(l.colour[1]), warm(l.colour[2])];
      for (const s of this.disc(R, steps)) r.rect(cx + s.dx, cy + s.dy, s.w, 1, colour, 0, 0.8);
    }
  }
}
