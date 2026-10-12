// Zhusha in the player slot. Her own frames come from her lane as dex.sprite/1 exports at
// /tesu/zhusha/ (96 px) and /tesu/zhusha-close/ (192 px); until they land, the lab's
// procedural figure stands in, recoloured to her black, scarlet and talisman gold, with a
// Qing hat a size too big and the talisman at the side of her face. Swapped in place: the
// exports load instead with no code change.
//
// The lab's clip data, tuning and effects are authored for a 96 px character, which is
// exactly H here: nothing is scaled. The close-up bake is 2x (192 px).

import clipsRaw from "../lab/data/player.clips.json?raw";
import tuningRaw from "../lab/data/tuning.json?raw";
import vfxRaw from "../lab/data/vfx.json?raw";
import type { ClipSource } from "../lab/art/standin-bake.ts";
import { M, PAL, withFigureLook, type Skeleton, type Pose } from "../lab/art/standin-figure.ts";
import type { PixBuf } from "../lab/art/pixbuf.ts";
import { ContractError, isStandinManifest, validatePackage, type SpritePackage } from "../lab/contracts.ts";
import { validateVfxLibrary, type VfxLibrary } from "../lab/engine/vfx.ts";
import type { RuntimeSprite } from "../lab/game/assets.ts";
import type { Tuning } from "../lab/game/game.ts";
import type { SpriteSheet } from "../lab/engine/renderer.ts";
import { PLAYER_CLIPS } from "../lab/game/player.ts";
import type { WorldRenderer } from "../world/render/renderer.ts";
import { scaleClipSource } from "../world/player/scale.ts";
import { bakeScaledStandin, WORLD_CLIPS } from "../world/player/standin.ts";
import { validateAtlasImages, validateExportPair } from "../world/player/export-validation.ts";
import { CLOSE_H, H } from "./config.ts";

export interface ZhushaAssets {
  sprite: RuntimeSprite;
  closeup: RuntimeSprite;
  tuning: Tuning;
  vfx: VfxLibrary;
  heights: { play: number; close: number };
  bakeMs: number;
}

// her colours on the stand-in's materials
const HAT = PAL.add({ tones: ["#0c0b10", "#16141c", "#211e29", "#2e2a39", "#423d52"], line: "#050407", lite: "#16141c" });
const SCARLET = PAL.add({ tones: ["#6e0c16", "#a4141f", "#d8232c", "#f2433f", "#ff7a6a"], line: "#3a050b", lite: "#6e0c16" });
const TALISMAN = PAL.add({ tones: ["#b07a12", "#dca82e", "#f5d25c", "#ffe891", "#fff6c8"], line: "#5a3c06", lite: "#8a5c10", bias: 0.3 });

const TONES = new Map([
  [M.cloth, ["#16141c", "#232030", "#322e42", "#433e56", "#5a546f"]],
  [M.clothIn, ["#6e0c16", "#a4141f", "#d8232c", "#f2433f", "#ff7a6a"]],
  [M.boot, ["#060509", "#0f0d14", "#1c1924", "#2e2a3a", "#5a5470"]],
  [M.sock, ["#0a080d", "#16121b", "#241c2a", "#3a1c2a", "#5c2030"]],
  [M.hair, ["#07060b", "#100e17", "#1a1724", "#262234", "#363048"]],
  [M.hairSheen, ["#262234", "#363048", "#4a4260", "#5e5578", "#7a7094"]],
  [M.ribbon, ["#6e0c16", "#a4141f", "#d8232c", "#f2433f", "#ff7a6a"]],
  [M.shaft, ["#3a3f52", "#5d6680", "#8d97b0", "#c4cbdc", "#eef1f8"]],
]);

/** The hat: a wide black brim, a domed crown under a scarlet fringe, a gold knob, tilted; the talisman at her face. */
function hat(b: PixBuf, s: Skeleton, pose: Pose): void {
  const h = s.headC;
  const tilt = (pose.head * 0.5 + s.angC * 0.35 - 9) * (Math.PI / 180);
  const R = (x: number, y: number): [number, number] => [h[0] + x * Math.cos(tilt) - y * Math.sin(tilt), h[1] + x * Math.sin(tilt) + y * Math.cos(tilt)];
  const g = 24;
  // crown
  const [cx, cy] = R(-0.4, -9.2);
  b.ellipse(cx, cy, 7.4, 5.6, tilt, HAT, g, { round: 2 });
  // scarlet fringe on the crown
  const [fx, fy] = R(-0.4, -11.6);
  b.ellipse(fx, fy, 6.6, 3.0, tilt, SCARLET, g, { round: 1.2 });
  // gold knob
  const [kx, ky] = R(-0.2, -15.2);
  b.ellipse(kx, ky, 1.6, 1.6, 0, M.gold, g, { round: 1 });
  // the brim, a size too big
  const [bx, by] = R(0, -6.0);
  b.ellipse(bx, by, 12.4, 2.2, tilt, HAT, g, { round: 0.8 });
  // the talisman hanging at the side of her face
  const [t0x, t0y] = R(6.6, -5.0);
  const [t1x, t1y] = R(7.4, 9.0);
  b.capsule(t0x, t0y, 1.7, t1x, t1y, 1.7, TALISMAN, g, { round: 0.6 });
  b.line(t0x + 0.2, t0y + 4, t1x, t1y - 3, SCARLET, g, 0);
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

/** Exports present at build time (public/tesu/<dir>/manifest.json), so a missing one is never fetched. */
const EXPORTS = new Set(Object.keys(import.meta.glob("/public/tesu/*/manifest.json")).map((k) => k.slice("/public".length)));

async function loadExport(dir: string): Promise<SpritePackage | null> {
  const file = `/tesu/${dir}/manifest.json`;
  if (!EXPORTS.has(file)) return null;
  let json: unknown;
  try {
    const res = await fetch(file, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (e) {
    throw new ContractError(file, [`could not load declared export: ${e instanceof Error ? e.message : String(e)}`]);
  }
  if (isStandinManifest(json)) return null;
  return validatePackage(json, file);
}

async function loadSprite(r: WorldRenderer, pkg: SpritePackage, dir: string): Promise<RuntimeSprite> {
  const base = `/tesu/${dir}/`;
  const sheets = new Map<string, SpriteSheet>();
  for (const a of pkg.atlases) {
    const albedo = await loadImage(base + a.albedo);
    const normal = a.normal ? await loadImage(base + a.normal) : null;
    validateAtlasImages(a, albedo, normal, base);
    sheets.set(a.id, { albedo: r.texture(albedo), normal: normal ? r.texture(normal) : r.flatNormal, keyInfluence: a.shading === "flat" ? 1 : 0.25 });
  }
  return wrap(pkg, sheets, "pipeline");
}

export async function loadZhusha(r: WorldRenderer): Promise<ZhushaAssets> {
  const t0 = performance.now();
  const lab = JSON.parse(clipsRaw) as ClipSource;
  const src: ClipSource = { ...lab, clips: [...lab.clips, ...WORLD_CLIPS] };
  const tuning = JSON.parse(tuningRaw) as Tuning;
  const vfx = validateVfxLibrary(JSON.parse(vfxRaw));
  const heights = { play: H, close: CLOSE_H };
  const bake = (k: number, name: string): RuntimeSprite => {
    const s = k === 1 ? src : scaleClipSource(src, k);
    const b = withFigureLook({ halo: false, after: hat, tones: TONES }, () => bakeScaledStandin(s, k, name));
    if (k === 1) heights.play = b.height;
    else heights.close = b.height;
    const sheets = new Map<string, SpriteSheet>([["standin", { albedo: r.texture(b.atlas.albedo), normal: r.texture(b.atlas.normal), keyInfluence: 0.25 }]]);
    return wrap(b.pkg, sheets, "standin");
  };
  const [play, close] = await Promise.all([loadExport("zhusha"), loadExport("zhusha-close")]);
  validateExportPair(play, close, [...PLAYER_CLIPS, ...WORLD_CLIPS.map((c) => c.id)]);
  const sprite = play ? await loadSprite(r, play, "zhusha") : bake(1, "Zhusha (stand-in, 96 px)");
  const closeup = close ? await loadSprite(r, close, "zhusha-close") : bake(CLOSE_H / H, "Zhusha (stand-in, 192 px)");
  return { sprite, closeup, tuning, vfx, heights, bakeMs: Math.round(performance.now() - t0) };
}
