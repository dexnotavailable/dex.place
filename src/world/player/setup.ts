// The world's player: the lab's controller, moves, VFX, rim lighting and
// runtime contract, at the world's locked scale.
//
// Sprites: a pipeline export at /world/character/manifest.json (80 px) and
// /world/character-closeup/manifest.json (144 px) when present (same
// dex.sprite/1 contract as the lab); otherwise the procedural stand-in, baked
// at both heights. Data (clip timings, boxes, events, effect sizes, tuning)
// comes from the lab's files, scaled from the 96 px they are authored at.

import clipsRaw from "../../lab/data/player.clips.json?raw";
import tuningRaw from "../../lab/data/tuning.json?raw";
import vfxRaw from "../../lab/data/vfx.json?raw";
import type { ClipSource } from "../../lab/art/standin-bake.ts";
import { ContractError, isStandinManifest, validatePackage, type SpritePackage } from "../../lab/contracts.ts";
import { validateVfxLibrary, type VfxLibrary } from "../../lab/engine/vfx.ts";
import type { RuntimeSprite } from "../../lab/game/assets.ts";
import type { Tuning } from "../../lab/game/game.ts";
import type { SpriteSheet } from "../../lab/engine/renderer.ts";
import { K, K_CLOSE, SCALE } from "../config.ts";
import type { WorldRenderer } from "../render/renderer.ts";
import { scaleClipSource, scaleTuning, scaleVfxLibrary } from "./scale.ts";
import { bakeScaledStandin } from "./standin.ts";

export interface PlayerAssets {
  /** Exploration sprite (H = 80). The simulation runs on this one. */
  sprite: RuntimeSprite;
  /** Close-up sprite (144 px): same clip ids and frame order, drawn during combat zoom and portraits. */
  closeup: RuntimeSprite;
  tuning: Tuning;
  vfx: VfxLibrary;
  /** Measured stand-in height (px) at each size, for the scale report. */
  heights: { world: number; closeup: number };
  bakeMs: number;
}

function wrap(pkg: SpritePackage, sheets: Map<string, SpriteSheet>, source: RuntimeSprite["source"]): RuntimeSprite {
  return { name: pkg.name, source, pkg, sheets, clips: new Map(pkg.clips.map((c) => [c.id, c])), defaultHurt: pkg.defaults?.hurtboxes ?? [] };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** A pipeline export at /world/<dir>/, or null (missing / placeholder) so the stand-in is used. */
async function loadExport(r: WorldRenderer, dir: string): Promise<RuntimeSprite | null> {
  const base = `/world/${dir}/`;
  const file = `${base}manifest.json`;
  let text: string;
  try {
    const res = await fetch(file, { cache: "no-cache" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
    text = await res.text();
  } catch {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new ContractError(file, [`$: not valid JSON: ${e instanceof Error ? e.message : String(e)}`]);
  }
  if (isStandinManifest(json)) return null;
  const pkg = validatePackage(json, file);
  const sheets = new Map<string, SpriteSheet>();
  for (const a of pkg.atlases) {
    const albedo = await loadImage(base + a.albedo);
    const normal = a.normal ? await loadImage(base + a.normal) : null;
    sheets.set(a.id, { albedo: r.texture(albedo), normal: normal ? r.texture(normal) : r.flatNormal, keyInfluence: a.shading === "flat" ? 1 : 0.25 });
  }
  return wrap(pkg, sheets, "pipeline");
}

export async function loadPlayer(r: WorldRenderer): Promise<PlayerAssets> {
  const t0 = performance.now();
  const src = JSON.parse(clipsRaw) as ClipSource;
  const worldSrc = scaleClipSource(src, K);
  const lab = JSON.parse(tuningRaw) as Tuning;
  const tuning: Tuning = { ...lab, player: scaleTuning(lab.player, K) };
  const vfx = validateVfxLibrary(scaleVfxLibrary(JSON.parse(vfxRaw), K));

  const heights: { world: number; closeup: number } = { world: SCALE.H, closeup: SCALE.closeupH };
  const bake = (k: number, name: string): RuntimeSprite => {
    const s = k === K ? worldSrc : scaleClipSource(src, k);
    const b = bakeScaledStandin(s, k, name);
    if (b.warnings.length) console.info(`${name} pose notes:\n${b.warnings.slice(0, 8).join("\n")}`);
    if (k === K) heights.world = b.height;
    else heights.closeup = b.height;
    const sheets = new Map<string, SpriteSheet>([["standin", { albedo: r.texture(b.atlas.albedo), normal: r.texture(b.atlas.normal), keyInfluence: 0.25 }]]);
    return wrap(b.pkg, sheets, "standin");
  };
  const sprite = (await loadExport(r, "character")) ?? bake(K, "player (stand-in, world)");
  const closeup = (await loadExport(r, "character-closeup")) ?? bake(K_CLOSE, "player (stand-in, close-up)");
  return { sprite, closeup, tuning, vfx, heights, bakeMs: Math.round(performance.now() - t0) };
}
