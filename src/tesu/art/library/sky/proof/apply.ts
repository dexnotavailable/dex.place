// Proof of fit, not placement: puts the env-sky set into the builder's real Kagami so it
// can be judged in the actual frames (the opening, play zoom, the widest frame). It reuses
// the builder's own slots (the same x, widths and heights for the far ranges, towers and
// clouds) and only adds a few drifting mist wisps and two low stratus layers, marked as
// suggestions. Placement stays the world builder's; this file is for the review page only.
//
// Two stand-ins for engine hooks asked for in lanes/ART-REQUESTS.md: sprites that drift and
// wrap (instead of walking back and forth), and the still water's colours taken from the
// time-of-day key. Both are patched in here at run time and nowhere else.

import { Atmos } from "../../../../render/atmos.ts";
import { SpriteRenderer } from "../../../../render/sprites.ts";
import { LAKE_Y } from "../../../../world/sections/common.ts";
import { PLANES, type PlaneId, type SpriteDef, type WorldDef } from "../../../../world/types.ts";
import { painter } from "../../../painter.ts";
import { MORNING, type SkyKey } from "../keys.ts";

const hex = (s: string): [number, number, number] => {
  const v = parseInt(s.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

/** Drift: `p.drift` is plane px per second, wrapping over `path` (3D px). */
function patchDrift(): void {
  const orig = SpriteRenderer.position;
  SpriteRenderer.position = (def: SpriteDef, time: number) => {
    const drift = def.p["drift"] as number | undefined;
    if (drift === undefined || !def.path) return orig(def, time);
    const [a, b] = def.path;
    const span = b - a;
    const v = drift / PLANES[def.plane].rate;
    const x = a + ((((def.x - a + time * v) % span) + span) % span);
    const frame = Math.floor(time * (def.fps ?? 0)) % Math.max(1, def.frames ?? 1);
    return { x, y: def.y, frame, flip: false };
  };
}

/** The water's colours from the key (game.ts passes fixed ones today). */
function patchWater(key: SkyKey): void {
  const proto = Atmos.prototype as unknown as { drawWater: Atmos["drawWater"] };
  const orig = proto.drawWater;
  proto.drawWater = function (this: Atmos, w, hh, refl, d) {
    return orig.call(this, w, hh, refl, { ...d, deep: hex(key.water.deep), body: hex(key.water.body), shallow: hex(key.water.shallow), glint: hex(key.water.glint) });
  };
}

let nextSeed = 50001;

function addPiece(world: WorldDef, plane: PlaneId, kind: string, planeX: number, y3: number, p: Record<string, unknown>, z: number): void {
  const r = PLANES[plane].rate;
  const x = planeX / r;
  const b = painter(kind).bounds(p);
  world.pieces.push({ plane, kind, x, y: y3, p, z, seed: nextSeed++ * 7919, box: [x * r + b[0], y3 * r + b[1], x * r + b[2], y3 * r + b[3]] });
}

function addSprite(world: WorldDef, id: string, plane: PlaneId, kind: string, planeX: number, planeDy: number, p: Record<string, unknown>, wrap: [number, number], fps: number): void {
  const r = PLANES[plane].rate;
  world.sprites.push({ id, plane, kind, x: planeX / r, y: LAKE_Y + planeDy / r, p, seed: nextSeed++ * 7919, frames: 4, fps, path: [wrap[0] / r, wrap[1] / r], reflect: true });
}

export function applySkyProof(world: WorldDef, key: SkyKey = MORNING): void {
  patchDrift();
  patchWater(key);

  // the light: Kagami's atmosphere takes the key
  for (const a of world.atmos) {
    a.sky = [...key.sky];
    a.haze = key.haze;
    a.mist = key.mist;
    a.mistColour = key.mistColour;
    a.sun = key.sun ? [...key.sun] : null;
  }

  // the builder's slots, swapped one for one
  const keep = [];
  const ranges: { x: number; p: Record<string, unknown> }[] = [];
  const towers: { x: number; p: Record<string, unknown> }[] = [];
  const clouds: { x: number; y: number; p: Record<string, unknown> }[] = [];
  for (const pc of world.pieces) {
    if (pc.plane === "far" && pc.kind === "range") ranges.push({ x: pc.x * PLANES.far.rate, p: pc.p });
    else if (pc.plane === "mid" && pc.kind === "towers") towers.push({ x: pc.x * PLANES.mid.rate, p: pc.p });
    else if (pc.plane === "sky" && pc.kind === "cloud") clouds.push({ x: pc.x * PLANES.sky.rate, y: pc.y, p: pc.p });
    else keep.push(pc);
  }
  world.pieces.length = 0;
  world.pieces.push(...keep);

  // P1: the snow ranges become layered karst in mist (same x, width; a little shorter)
  ranges.forEach((r, i) => {
    const w = r.p["w"] as number, hh = r.p["h"] as number;
    addPiece(world, "far", "sky.karst", r.x, LAKE_Y, { w, h: Math.round(hh * 0.72), rows: i % 2 ? 2 : 3, look: "far", mist: Math.round(hh * 0.16), green: 0.6 }, i);
  });
  // P2: the builder's tower clusters, same list, drawn as Wuling and Liyue pillars
  towers.forEach((t, i) => {
    addPiece(world, "mid", "sky.karst", t.x, LAKE_Y, { w: 0, h: 260, rows: 1, look: "near", towers: t.p["t"], mist: 30, green: 0.8 }, i);
  });

  // P0: the cloud slots, as drifting sprites (the big ones banks, the thin ones strata)
  const skyWrap: [number, number] = [-1700, 2500];
  clouds.forEach((cl, i) => {
    const w = cl.p["w"] as number, hh = cl.p["h"] as number;
    const dy = (cl.y - LAKE_Y) * PLANES.sky.rate;
    const big = hh >= 64;
    addSprite(world, `sky-cloud-${i}`, "sky", big ? "sky.bank" : "sky.stratus", cl.x, dy, big ? { w, h: Math.round(hh * 1.05), drift: 2 } : { w: Math.round(w * 1.3), h: Math.round(hh * 0.3), layers: 2, drift: 3 }, skyWrap, 2);
  });
  // suggested: two low stratus layers just over the far karst (layered mist between sky and range)
  addSprite(world, "sky-low-0", "sky", "sky.stratus", -260, -70, { w: 900, h: 14, layers: 2, drift: 3.5 }, skyWrap, 2);
  addSprite(world, "sky-low-1", "sky", "sky.stratus", 760, -96, { w: 700, h: 12, layers: 2, drift: 3 }, skyWrap, 2);
  // suggested: mist wisps drifting along the far and middle rows
  const farWrap: [number, number] = [-900, 2400];
  [[-200, -34, 520, 22], [520, -52, 420, 18], [1150, -30, 600, 24]].forEach(([x, dy, w, th], i) =>
    addSprite(world, `far-wisp-${i}`, "far", "sky.wisp", x!, dy!, { w, h: th, density: 0.65, drift: 5 }, farWrap, 3));
  // suggested: ripple rings round the mooring posts standing in the lake (play-plane depth)
  for (const pc of keep) {
    if (pc.plane !== "play" || pc.kind !== "moorPost") continue;
    world.sprites.push({ id: `ripple-${Math.round(pc.x)}`, plane: "front", kind: "sky.ripple", x: pc.x, y: LAKE_Y, p: { rx: 26, rings: 3 }, seed: nextSeed++ * 7919, frames: 8, fps: 8, reflect: false });
  }
  const midWrap: [number, number] = [-400, 5400];
  [[600, -24, 520, 26], [1900, -40, 460, 22], [3300, -22, 640, 30]].forEach(([x, dy, w, th], i) =>
    addSprite(world, `mid-wisp-${i}`, "mid", "sky.wisp", x!, dy!, { w, h: th, density: 0.6, drift: 7 }, midWrap, 3));
}
