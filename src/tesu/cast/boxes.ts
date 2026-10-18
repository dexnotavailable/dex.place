// The cast's placeholder boxes, the parts with no browser in them (npcs.ts draws; the tests check): which
// world sprites are NPCs, and the box each one stands in at a frame. Dex 10-18: "white placeholder boxes at
// player height" until every character's 128 px art exists; the art then comes through the same contract.

export interface Pose {
  sx?: number;
  sy?: number;
  lean?: number;
}

export interface CastEntry {
  who: string;
  name?: string;
  /** Box width in her drawn heights. */
  w: number;
  /** Frame index (or "*") -> slot in public/assets/cast/<who>/. */
  roles?: Record<string, string>;
  poses?: Record<string, Pose>;
}

export interface CastFile {
  npcs: Record<string, CastEntry>;
}

const SLOT = /^[a-z0-9_]+$/;

/** Checks cast.json; throws naming every problem. */
export function validateCast(json: unknown): CastFile {
  const bad: string[] = [];
  const o = json as { npcs?: Record<string, Record<string, unknown>> } | null;
  if (!o || typeof o !== "object" || !o.npcs || typeof o.npcs !== "object") throw new Error("cast.json: no npcs");
  for (const [id, e] of Object.entries(o.npcs)) {
    if (!e || typeof e !== "object") { bad.push(`${id}: not an object`); continue; }
    if (typeof e.who !== "string" || !SLOT.test(e.who)) bad.push(`${id}: who must be a folder name`);
    if (typeof e.w !== "number" || !(e.w > 0) || e.w > 8) bad.push(`${id}: w must be a width in her drawn heights (0..8]`);
    const roles = (e.roles ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(roles)) {
      if (k !== "*" && !/^\d+$/.test(k)) bad.push(`${id}: roles key "${k}" must be a frame index or "*"`);
      if (typeof v !== "string" || !SLOT.test(v)) bad.push(`${id}: roles.${k} must be a slot name`);
    }
    const poses = (e.poses ?? {}) as Record<string, Record<string, unknown>>;
    for (const [k, p] of Object.entries(poses)) {
      if (!/^\d+$/.test(k)) bad.push(`${id}: poses key "${k}" must be a frame index`);
      for (const [f, v] of Object.entries(p ?? {})) {
        if (!["sx", "sy", "lean"].includes(f) || typeof v !== "number" || !Number.isFinite(v)) bad.push(`${id}: poses.${k}.${f}`);
        else if (f !== "lean" && (v <= 0 || v > 2)) bad.push(`${id}: poses.${k}.${f} must be in (0, 2]`);
      }
    }
  }
  if (bad.length) throw new Error(`cast.json: ${bad.join("; ")}`);
  return o as unknown as CastFile;
}

/** The box an NPC stands in at a frame: width and height (world px) and its lean (top shift per px of height). */
export function npcBox(e: CastEntry, bodyH: number, frame: number): { w: number; h: number; lean: number } {
  const p = e.poses?.[String(frame)] ?? {};
  return { w: e.w * bodyH * (p.sx ?? 1), h: bodyH * (p.sy ?? 1), lean: p.lean ?? 0 };
}

/** The slot a frame plays (null: the box). */
export function npcSlot(e: CastEntry, frame: number): string | null {
  return e.roles?.[String(frame)] ?? e.roles?.["*"] ?? null;
}
