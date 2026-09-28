// Bakes the stand-in character: resolves every pose referenced by the clip
// data, draws it, packs an albedo + normal atlas, fills rect/pivot/anchors and
// hands back a package that goes through the same contract validation as a
// real pipeline export.

import { SPRITE_CONTRACT, validatePackage, type Box, type Clip, type Frame, type SpritePackage } from "../contracts.ts";
import { pack, trim, type PackedAtlas, type PackedImage } from "./atlas-builder.ts";
import { PixBuf } from "./pixbuf.ts";
import { drawFigure, KEY_LIGHT, PAL } from "./standin-figure.ts";
import { resolvePose } from "./standin-poses.ts";

/** Clip source: contract clips whose frames name a pose instead of an atlas rect. */
export interface ClipSource {
  name: string;
  defaults?: { hurtboxes?: Box[] };
  clips: (Omit<Clip, "atlas" | "frames"> & { frames: (Omit<Frame, "rect" | "pivot"> & { pose: string })[] })[];
}

export interface BakedPackage {
  pkg: SpritePackage;
  atlas: PackedAtlas;
  warnings: string[];
  ms: number;
}

const BUF_W = 300;
const BUF_H = 230;
const ORIGIN_X = 150;
const ORIGIN_Y = 200;

export function renderPose(key: string): { image: PackedImage; pivot: [number, number]; anchors: Record<string, [number, number]>; warnings: string[] } {
  const pose = resolvePose(key);
  const buf = new PixBuf(BUF_W, BUF_H, ORIGIN_X, ORIGIN_Y, PAL);
  const { anchors, warnings } = drawFigure(buf, pose);
  const { albedo, normal } = buf.finish(KEY_LIGHT);
  const t = trim(BUF_W, BUF_H, albedo, normal, 0);
  if (!t) throw new Error(`pose ${key} drew nothing`);
  const r = (v: [number, number]): [number, number] => [Math.round(v[0] * 10) / 10, Math.round(v[1] * 10) / 10];
  const anc: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries(anchors)) anc[k] = r(v);
  return {
    image: { key, w: t.w, h: t.h, albedo: t.albedo, normal: t.normal },
    pivot: [ORIGIN_X - t.x, ORIGIN_Y - t.y],
    anchors: anc,
    warnings: warnings.map((w) => `${key}: ${w}`),
  };
}

export function bakeStandin(src: ClipSource): BakedPackage {
  const t0 = performance.now();
  const keys = new Set<string>();
  for (const c of src.clips) for (const f of c.frames) keys.add(f.pose);
  const images: PackedImage[] = [];
  const meta = new Map<string, { pivot: [number, number]; anchors: Record<string, [number, number]> }>();
  const warnings: string[] = [];
  for (const k of keys) {
    const r = renderPose(k);
    images.push(r.image);
    meta.set(k, { pivot: r.pivot, anchors: r.anchors });
    warnings.push(...r.warnings);
  }
  const atlas = pack(images, 2048);
  const clips: Clip[] = src.clips.map((c) => ({
    ...c,
    atlas: "standin",
    frames: c.frames.map((f) => {
      const m = meta.get(f.pose)!;
      return { ...f, rect: atlas.rects.get(f.pose)!, pivot: m.pivot, anchors: { ...m.anchors, ...(f.anchors ?? {}) } };
    }),
  }));
  const pkg = validatePackage(
    {
      contract: SPRITE_CONTRACT,
      name: src.name,
      atlases: [{ id: "standin", albedo: "(baked)", normal: "(baked)", width: atlas.width, height: atlas.height, shading: "baked" }],
      clips,
      ...(src.defaults ? { defaults: src.defaults } : {}),
    },
    `${src.name} (stand-in bake)`,
  );
  return { pkg, atlas, warnings, ms: performance.now() - t0 };
}
