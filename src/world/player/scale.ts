// Scales the lab's player data (authored for a 96 px character, the MOVESET
// numbers) to the world's locked player height, so every move keeps its reach
// in H: hitboxes, hurtboxes, root motion, event offsets and effect sizes,
// knockback and shake, run speed, jump velocities and gravity (jump heights
// in H stay the same because velocity and gravity scale together). Durations
// and timings never scale.

import type { ClipSource } from "../../lab/art/standin-bake.ts";
import type { PlayerTuning } from "../../lab/game/player.ts";

const r1 = (v: number): number => Math.round(v * 10) / 10;

type Json = unknown;

function scaleBox<T extends { x: number; y: number; w: number; h: number }>(b: T, k: number): T {
  return { ...b, x: Math.round(b.x * k), y: Math.round(b.y * k), w: Math.max(1, Math.round(b.w * k)), h: Math.max(1, Math.round(b.h * k)) };
}

/** Pixel-valued keys in VFX presets and event params. */
const VFX_PX = new Set(["radius", "thickness", "glow", "length", "r0", "r1", "width", "height", "speedMin", "speedMax", "gravity", "areaW", "areaH", "inward"]);

function scaleVfxObject(o: Json, k: number): Json {
  if (Array.isArray(o)) return o.map((x) => scaleVfxObject(x, k));
  if (!o || typeof o !== "object") return o;
  const out: Record<string, Json> = {};
  for (const [key, v] of Object.entries(o as Record<string, Json>)) {
    if (typeof v === "number" && VFX_PX.has(key)) out[key] = r1(v * k);
    else if (key === "offset" && Array.isArray(v) && typeof v[0] === "number") out[key] = (v as number[]).map((n) => r1(n * k));
    else out[key] = scaleVfxObject(v, k);
  }
  return out;
}

/** The VFX library (src/lab/data/vfx.json) at the world's scale. */
export function scaleVfxLibrary(lib: Json, k: number): Json {
  return scaleVfxObject(lib, k);
}

/** Clip source (poses + timings + boxes + events) at the world's scale. */
export function scaleClipSource(src: ClipSource, k: number): ClipSource {
  const ev = (e: Record<string, Json>): Record<string, Json> => {
    const o: Record<string, Json> = { ...e };
    if (Array.isArray(e.offset)) o.offset = (e.offset as number[]).map((n) => r1(n * k));
    if (e.type === "shake" && typeof e.amplitude === "number") o.amplitude = Math.max(1, Math.round(e.amplitude * k));
    if (e.type === "light" && typeof e.radius === "number") o.radius = r1(e.radius * k);
    if (e.type === "light" && typeof e.height === "number") o.height = r1(e.height * k);
    if (e.params) o.params = scaleVfxObject(e.params, k);
    if (e.light && typeof e.light === "object") o.light = scaleVfxObject(e.light, k);
    return o;
  };
  return {
    ...src,
    defaults: src.defaults?.hurtboxes ? { ...src.defaults, hurtboxes: src.defaults.hurtboxes.map((b) => scaleBox(b, k)) } : src.defaults,
    clips: src.clips.map((c) => ({
      ...c,
      frames: c.frames.map((f) => ({
        ...f,
        hitboxes: f.hitboxes?.map((hb) => ({
          ...scaleBox(hb, k),
          knockback: hb.knockback ? ([r1(hb.knockback[0] * k), r1(hb.knockback[1] * k)] as [number, number]) : hb.knockback,
          shake: hb.shake ? { ...hb.shake, amplitude: Math.max(1, Math.round(hb.shake.amplitude * k)) } : hb.shake,
        })),
        hurtboxes: f.hurtboxes?.map((b) => scaleBox(b, k)),
        rootMotion: f.rootMotion ? ([r1(f.rootMotion[0] * k), r1(f.rootMotion[1] * k)] as [number, number]) : f.rootMotion,
        anchors: f.anchors ? Object.fromEntries(Object.entries(f.anchors).map(([n, a]) => [n, [r1(a[0] * k), r1(a[1] * k)] as [number, number]])) : f.anchors,
        events: f.events?.map((e) => ev(e as unknown as Record<string, Json>)) as typeof f.events,
      })),
    })),
  };
}

/** Player tuning at the world's scale: px and px/tick values scale, ticks don't. */
export function scaleTuning(t: PlayerTuning, k: number): PlayerTuning {
  return {
    ...t,
    runSpeed: t.runSpeed * k,
    accelGround: t.accelGround * k,
    decelGround: t.decelGround * k,
    accelAir: t.accelAir * k,
    gravity: t.gravity * k,
    apexBand: t.apexBand * k,
    fallMax: t.fallMax * k,
    jumpVelocity: t.jumpVelocity * k,
    doubleJumpVelocity: t.doubleJumpVelocity * k,
    attackStopGap: Math.round(t.attackStopGap * k),
    collider: { w: Math.round(t.collider.w * k), h: Math.round(t.collider.h * k) },
    landClipMinFall: t.landClipMinFall * k,
  };
}
