// The Hall of Works' light landing (the hall loop, round 1): one light logic for the room.
//
// The room's shell (the roof, the upper back wall above the gallery, the ends beyond the end walls)
// sinks into a cool blue-violet dark, like the mass round ref 06's lit gate. Warmth lives only where
// light lands: every lantern and lamp lays a warm pool on whatever is behind and around it, in two
// or three clustered bands with wandering edges (no dither screen); the low lights also lay a pool
// on the floor and a streak of reflection down its polish. The doors' daylight spills across the
// floor as the longest, brightest streak in the room. The skylight's shaft lights what it passes
// through and lands on the floor as a bright patch with the skylight's lattice cast in it.
//
// It is a piece per plane (the back wall's plane and the play plane), painted after everything
// else on that plane: it re-colours what is already there by whole ramp steps (tint.ts), so the
// wood's grain and the lacquer's sheen stay in the light. Every light is read from lights.ts and
// every door from the builder's usables, so when the room is re-laid the light moves with it.

import { definePainter } from "../../painter.ts";
import { BACK_LANTERNS, HALL, HALL_LIGHT, SHAFT } from "./lights.ts";
import { clamp, hash, vnoise, type At } from "./kit.ts";
import { lut, tint } from "./tint.ts";

const H = 96;

export interface HallLightP {
  /** Size of the piece in its plane's px: the anchor is its west end on the walk line. */
  w: number;
  top: number;
  below: number;
  /** World y of the walk line and of the gallery's floor; world x of the room's two end walls. */
  floor: number;
  gallery: number;
  ends: [number, number];
  /** Doors with daylight behind them: [world x0, x1, height (px), daylight 0..1]. */
  doors: [number, number, number, number][];
  /** The play plane: the floor's pools and streaks, the shaft's beam and landing. */
  play?: boolean;
  at: At;
}

interface Pool { x: number; y: number; r: number; k: number }

/**
 * The lights, sorted by the plane their pools can land on without sliding off them as the camera
 * moves (a light's pool must be on its own plane, or on a plane behind it only where the camera
 * looks straight at it). Back: the back wall's own lanterns, pooled on the back wall. Play: every
 * other light, pooled on the floor in front of it. Low: the service lamps near the walk line (a
 * service is in the middle of the frame when she stands at it), also pooled on the back wall.
 */
function sortLights(floor: number, doors: [number, number, number, number][]): { back: Pool[]; play: Pool[]; low: Pool[] } {
  const backKeys = new Set(BACK_LANTERNS.map((l) => `${HALL.x0 + Math.round(l.o * H)}|${floor - Math.round(l.y * H)}`));
  const back: Pool[] = [], play: Pool[] = [], low: Pool[] = [];
  for (const L of HALL_LIGHT.lights) {
    if (L.kind !== "point") continue;
    if (backKeys.has(`${L.x}|${L.y}`)) {
      back.push({ x: L.x, y: L.y, r: Math.min(L.r * 0.5, 1.6 * H), k: L.k * 1.25 });
      continue;
    }
    play.push({ x: L.x, y: L.y, r: L.r, k: L.k });
    const atDoor = doors.some(([d0, d1]) => L.x > d0 - H && L.x < d1 + H);
    if (floor - L.y < 3 * H && !atDoor) low.push({ x: L.x, y: L.y, r: 1.7 * H, k: L.k * 1.1 });
  }
  return { back, play, low };
}

export const hallLight = definePainter<HallLightP>("hall.light", {
  bounds(p) {
    return [0, -p.top, p.w, p.below];
  },
  paint(c, p) {
    const at = p.at;
    const L = sortLights(p.floor, p.doors);
    const wallPools = p.play ? [] : [...L.back, ...L.low];
    const warm = [null, lut("warm", 1), lut("warm", 2), lut("warm", 3)] as const;
    const night = [null, lut("night", 1), lut("night", 2), lut("night", 3)] as const;
    const sun = [null, lut("sun", 1), lut("sun", 2), lut("sun", 3)] as const;
    const FY = p.floor;
    // the shaft's slant: x of its axis at a world y
    const shaftAx = (wy: number): number => SHAFT.x1 + (SHAFT.x0 - SHAFT.x1) * clamp((FY - wy) / (FY - SHAFT.y0), 0, 1);
    tint(c, 0, -p.top, p.w, p.below, (X, Y, lx, ly) => {
      const wx = at.wx + lx / at.rate, wy = at.wy + ly / at.rate;
      // the wandering edge of every band: a slow noise, so no pool is a drawn circle
      const jit = (vnoise(wx * 0.07, wy * 0.07, 7) - 0.5) * 0.05 + (hash(X, Y, 3) - 0.5) * 0.015;
      if (wy > FY + 1) {
        if (!p.play) return null;
        // --- the floor: pools under the low lights, reflections down the polish, the doors' day
        const dep = (wy - FY) / H;
        let wv = 0, sv = 0;
        for (const q of L.play) {
          const hgt = (FY - q.y) / H;
          if (hgt > 7) continue;
          const dx = (wx - q.x) / ((0.55 + hgt * 0.08) * H);
          if (Math.abs(dx) > 1) continue;
          // the light catching the walkway's lacquered lip and face just under it (its reflection
          // down the polish is the floor's own, room.ts)
          const near = 1.3 - hgt * 0.12;
          if (dep < 0.13) wv += q.k * near * (1 - dx * dx) * 1.2;
          else if (dep < 0.46) wv += q.k * near * Math.max(0, 1 - dx * dx * 1.8) * 0.6;
        }
        for (const [d0, d1, , day] of p.doors) {
          const cx = (d0 + d1) / 2, hw = (d1 - d0) / 2;
          // the day through the doorway: a fan across the walkway and the floor in front of it
          const u = (wx - cx) / (hw * (0.8 + dep * 0.4));
          sv += day * Math.max(0, 1 - u * u) * Math.max(0, 1 - dep / 1.5) * 1.05;
        }
        // the shaft's landing: a bright patch at its foot with the skylight's lattice cast in it
        const fx = (wx - SHAFT.x1) / SHAFT.pool, fy = (dep - 0.18) / 0.5;
        const land = Math.max(0, 1 - fx * fx - fy * fy);
        if (land > 0) {
          const lean = (SHAFT.x1 - SHAFT.x0) / (FY - SHAFT.y0);
          const gx = wx + (wy - FY) * lean * 3;
          const bar = ((gx % 26) + 26) % 26 < 3.2 || (((wy - FY) % 9) + 9) % 9 < 1.4;
          sv += SHAFT.k * land * (bar ? 0.25 : 1.15);
        }
        const v = Math.max(wv, sv) + jit;
        const n = v > 0.95 ? 3 : v > 0.55 ? 2 : v > 0.22 ? 1 : 0;
        if (!n) return null;
        return sv >= wv ? sun[n]! : warm[n]!;
      }
      // --- the room: the shell sinks into the cool dark, the lights' pools lift it
      let shade = 0;
      if (wy < FY - 10.6 * H) shade = 1;
      if (wy < FY - 13.2 * H) shade = 2;
      if (wx < p.ends[0] - 0.2 * H || wx > p.ends[1] + 0.2 * H) shade = Math.max(shade, wy < FY - 2.2 * H ? 2 : 1);
      let v = 0;
      for (const q of wallPools) {
        const dx = wx - q.x, dy = wy - q.y;
        if (Math.abs(dx) > q.r || Math.abs(dy) > q.r) continue;
        // light falls off a little faster upward (the lantern's cap shades the ceiling over it)
        const f = 1 - (dx * dx + dy * dy * (dy < 0 ? 1.5 : 0.85)) / (q.r * q.r);
        if (f > 0) v += q.k * f * f;
      }
      let lift = bandsOf(v + jit);
      // the shaft: the air it passes through and everything in it a step lighter (play plane)
      if (p.play && wy > SHAFT.y0 && wy < FY) {
        const half = SHAFT.w / 2;
        const d = Math.abs(wx - shaftAx(wy)) / half;
        if (d < 1 + jit * 0.5) return sun[1]!;
      }
      lift -= shade;
      if (lift > 0) return warm[Math.min(3, lift)]!;
      if (lift < 0) return night[Math.min(3, -lift)]!;
      return null;
    });
  },
});

function bandsOf(v: number): number {
  return v > 0.8 ? 3 : v > 0.46 ? 2 : v > 0.2 ? 1 : 0;
}
