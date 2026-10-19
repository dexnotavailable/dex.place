// Zhusha in the player slot: her traced pixel art comes through the sprite contract
// (lanes/anim/SPRITE-CONTRACT.md) from public/assets/zhusha/<slot>/, one folder per move, loaded
// by zhusha/anims.ts. A move with no traced drawing yet is the white box (zhusha/draw.ts). Her
// controller and its numbers are zhusha/controller.ts and zhusha/feel.json. Her talisman is not
// part of any drawing: the world draws it live on her hat (opening/paper.ts).
//
// The procedural stand-in figure and the lab's clip package that used to stand in for her are
// retired here (Dex, Oct 16: the white box until the traced art lands, slot by slot).

import tuningRaw from "../lab/data/tuning.json?raw";
import vfxRaw from "../lab/data/vfx.json?raw";
import { validateVfxLibrary, type VfxLibrary } from "../lab/engine/vfx.ts";
import type { WorldRenderer } from "../world/render/renderer.ts";
import { loadAnims, type AnimSet, type Slot } from "./zhusha/anims.ts";
import { loadCast } from "./cast/npcs.ts";

export interface ZhushaAssets {
  anims: AnimSet;
  /** The cast's 128 px art present ("who/slot"; none yet: every NPC is the white box, cast/npcs.ts). */
  cast: Map<string, Slot>;
  /** The lab's game-feel limits (hitstop cap, impact cooldown). */
  feel: { maxHitstop: number; impactCooldown: number };
  vfx: VfxLibrary;
  loadMs: number;
}

export async function loadZhusha(r: WorldRenderer): Promise<ZhushaAssets> {
  const t0 = performance.now();
  const tuning = JSON.parse(tuningRaw) as { feel: { maxHitstop: number; impactCooldown: number } };
  const vfx = validateVfxLibrary(JSON.parse(vfxRaw));
  const [anims, cast] = await Promise.all([loadAnims(r), loadCast(r)]);
  performance.mark("tesu:sprite-1x");
  return { anims, cast, feel: tuning.feel, vfx, loadMs: Math.round(performance.now() - t0) };
}
