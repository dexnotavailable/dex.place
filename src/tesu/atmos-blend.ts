// The sky, haze, mist, sun, water key and grade at a point of the land, blended between
// neighbouring atmos entries. Each entry takes over from the one before it (in the world's
// list order) at its x, and within its y band if it has one; an entry with a `blend` width does
// so gradually, over that many px centred on its edges, so a fall, a ride or a walk through a
// change of light never snaps. Width 0 (the default) is the old hard switch, exactly.

import type { Atmos } from "./world/types.ts";

type RGB = [number, number, number];

const parse = (h: string): RGB => {
  const v = h.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const hex = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mixHex = (a: string, b: string, t: number): string => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const p = parse(a), q = parse(b);
  return hex([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
};
const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Still water's key when an entry gives none (the colours the renderer always used). */
export const DEFAULT_WATER: NonNullable<Atmos["water"]> = { deep: "#1f5a60", body: "#3f8f8a", shallow: "#bfe0dc", glint: "#fffbe8" };

/** How much an entry holds at (x, y): 0 outside, 1 inside, a smooth ramp across its edges. */
export function atmosWeight(e: Atmos, x: number, y: number): number {
  const w = e.blend ?? 0;
  const ramp = (d: number): number => (w > 0 ? smooth(d / w + 0.5) : d >= 0 ? 1 : 0);
  let m = ramp(x - e.x);
  if (e.y0 !== undefined) m *= ramp(y - e.y0);
  if (e.y1 !== undefined) m *= w > 0 ? ramp(e.y1 - y) : y <= e.y1 ? 1 : 0;
  return m;
}

/** The atmos at (x, y): the first entry that applies there, then each later one laid over it by its weight. */
export function blendAtmos(list: readonly Atmos[], x: number, y: number, interiorY: number): Atmos {
  // which entries take part: their y band (widened by their blend) holds y; outdoor ones stay above the interiors
  const near = list.filter((e) => {
    const h = (e.blend ?? 0) / 2;
    return (e.y0 === undefined || y >= e.y0 - h) && (e.y1 === undefined || y <= e.y1 + h) && (e.y0 !== undefined || y < interiorY);
  });
  const base = near[0] ?? list[0]!;
  let out: Atmos = { ...base, water: base.water ?? DEFAULT_WATER, grade: base.grade ?? [1, 1, 1, 0] };
  for (const e of near) {
    if (e === base) continue;
    const t = atmosWeight(e, x, y);
    if (t <= 0) continue;
    out = mixAtmos(out, e, t);
  }
  return out;
}

/** a laid over by b at strength t. */
export function mixAtmos(a: Atmos, b: Atmos, t: number): Atmos {
  if (t >= 1) return { ...b, water: b.water ?? DEFAULT_WATER, grade: b.grade ?? [1, 1, 1, 0] };
  const wa = a.water ?? DEFAULT_WATER, wb = b.water ?? DEFAULT_WATER;
  const ga = a.grade ?? [1, 1, 1, 0], gb = b.grade ?? [1, 1, 1, 0];
  // the sun moves between the two places; where only one has a sun it sets (or rises) with t
  let sun: [number, number] | null = a.sun;
  if (a.sun && b.sun) sun = [a.sun[0] + (b.sun[0] - a.sun[0]) * t, a.sun[1] + (b.sun[1] - a.sun[1]) * t];
  else if (!a.sun && b.sun) sun = t >= 0.5 ? b.sun : null;
  else if (a.sun && !b.sun) sun = t >= 0.5 ? null : a.sun;
  return {
    ...(t >= 0.5 ? b : a),
    sky: [mixHex(a.sky[0], b.sky[0], t), mixHex(a.sky[1], b.sky[1], t), mixHex(a.sky[2], b.sky[2], t)],
    haze: mixHex(a.haze, b.haze, t),
    mist: a.mist + (b.mist - a.mist) * t,
    mistColour: mixHex(a.mistColour, b.mistColour, t),
    sun,
    water: {
      deep: mixHex(wa.deep, wb.deep, t), body: mixHex(wa.body, wb.body, t), shallow: mixHex(wa.shallow, wb.shallow, t), glint: mixHex(wa.glint, wb.glint, t),
      mirror: mix3(wa.mirror ?? [1, 1, 1], wb.mirror ?? [1, 1, 1], t),
    },
    grade: [ga[0] + (gb[0] - ga[0]) * t, ga[1] + (gb[1] - ga[1]) * t, ga[2] + (gb[2] - ga[2]) * t, ga[3] + (gb[3] - ga[3]) * t],
    glow: mixGlow(a.glow, b.glow, t),
    fog: mixFog(a.fog, b.fog, t),
  };
}

/** The sun's bloom across a change of place: it fades in or out with t where only one has it. */
function mixGlow(a: Atmos["glow"], b: Atmos["glow"], t: number): Atmos["glow"] {
  if (!a && !b) return undefined;
  const ga = a ?? { ...b!, strength: 0 }, gb = b ?? { ...a!, strength: 0 };
  return { radius: ga.radius + (gb.radius - ga.radius) * t, strength: ga.strength + (gb.strength - ga.strength) * t, colour: mixHex(ga.colour, gb.colour, t) };
}

/** Fog banks across a change of place: each plane's bank thins away (or gathers) with t. */
function mixFog(a: Atmos["fog"], b: Atmos["fog"], t: number): Atmos["fog"] {
  if (!a?.length && !b?.length) return undefined;
  const out: NonNullable<Atmos["fog"]> = [];
  for (const f of a ?? []) {
    const g = b?.find((x) => x.plane === f.plane);
    if (!g) { out.push({ ...f, density: f.density * (1 - t) }); continue; }
    out.push({ ...(t >= 0.5 ? g : f), density: f.density + (g.density - f.density) * t, height: f.height + (g.height - f.height) * t });
  }
  for (const g of b ?? []) if (!a?.some((x) => x.plane === g.plane)) out.push({ ...g, density: g.density * t });
  return out;
}
