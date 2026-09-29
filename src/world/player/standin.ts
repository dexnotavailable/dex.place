// The lab's procedural stand-in, baked at the world's heights: 80 px for
// exploration (config SCALE.H) and 144 px for the close-up path. The figure is
// drawn in code from shapes, so instead of resampling pixels it is redrawn at
// the new size: a PixBuf that scales every shape it is given (positions,
// radii, dome heights, trims, and the figure's own per-pixel paint callbacks)
// by k before rasterising. Outlines and 1 px details stay 1 px.
//
// The package goes through the same contract validation as a real pipeline
// export. When Rosace's sprites land, the world loads them instead (see
// player/setup.ts) and this file is only the fallback.

import { pack, trim, type PackedAtlas, type PackedImage } from "../../lab/art/atlas-builder.ts";
import { PixBuf, type Material, type Palette, type ShapeOpts } from "../../lab/art/pixbuf.ts";
import type { ClipSource } from "../../lab/art/standin-bake.ts";
import { drawFigure, KEY_LIGHT, PAL, type Pose } from "../../lab/art/standin-figure.ts";
import { blendPoses, resolvePose } from "../../lab/art/standin-poses.ts";
import { SPRITE_CONTRACT, validatePackage, type Clip, type SpritePackage } from "../../lab/contracts.ts";

/**
 * A PixBuf that draws every shape k times larger (or smaller) about the figure
 * origin. ellipse() and ribbon() build polygons in figure space and call
 * poly(), so they scale there.
 */
class ScaledPixBuf extends PixBuf {
  constructor(w: number, h: number, ox: number, oy: number, pal: Palette, private k: number) {
    super(w, h, ox, oy, pal);
  }

  private opts(o: ShapeOpts): ShapeOpts {
    const k = this.k;
    const out: ShapeOpts = { ...o };
    if (o.round !== undefined) out.round = o.round * k;
    if (o.trim) {
      const where = o.trim.where;
      out.trim = { ...o.trim, width: Math.max(1, o.trim.width * k), where: where ? (x, y) => where(x / k, y / k) : undefined };
    }
    const paint = o.paint;
    if (paint) out.paint = (x, y, d) => paint(x / k, y / k, d / k);
    const skip = o.inkSkip;
    if (skip) out.inkSkip = (x, y) => skip(x / k, y / k);
    return out;
  }

  override poly(P: number[], m: Material, g: number, o: ShapeOpts = {}): void {
    super.poly(P.map((v) => v * this.k), m, g, this.opts(o));
  }

  override capsule(ax: number, ay: number, ra: number, bx: number, by: number, rb: number, m: Material, g: number, o: ShapeOpts = {}): void {
    const k = this.k;
    super.capsule(ax * k, ay * k, ra * k, bx * k, by * k, rb * k, m, g, this.opts(o));
  }

  override line(x0: number, y0: number, x1: number, y1: number, m: Material, g: number, tone = 0): void {
    const k = this.k;
    super.line(x0 * k, y0 * k, x1 * k, y1 * k, m, g, tone);
  }

  override pix(x: number, y: number, rgb: [number, number, number] | null, g = 0): void {
    super.pix(x * this.k, y * this.k, rgb, g);
  }

  override paintMat(x: number, y: number, m: Material, tone = 0): void {
    super.paintMat(x * this.k, y * this.k, m, tone);
  }

  override castShadow(from: number[], to: number[], n: number, dx = 0, dy = -1, amount = -1): void {
    super.castShadow(from, to, Math.max(1, Math.round(n * this.k)), dx, dy, amount);
  }
}

/**
 * Poses only the world needs, drawn by the lab's figure code (authored at 96 px, feet at y 0):
 * sitting on a bench. The kit's seat top is 0.28 H (27 px here); she sits on it with her
 * thighs along the seat, her boots on the floor in front, the spear planted upright beside her
 * knees in the far hand and the near hand in her lap, looking out. Two breaths, like the idle.
 */
const sit0: Pose = {
  hip: [-4, -30],
  lean: -3,
  chest: 6,
  head: 8,
  footN: [16, -3],
  footF: [20, -3],
  toeN: -6,
  toeF: -4,
  wpn: [13, -50, -87],
  slide: 50,
  handN: [9, -30],
  hair: 4,
  cloth: 34,
  clothLift: 0.1,
  expr: "open",
};
const WORLD_POSES: Record<string, Pose> = {
  sit0,
  sit1: { ...sit0, hip: [-4, -29.6], chest: 7, head: 9, wpn: [13, -49.6, -87], handN: [9, -29.6], hair: 2, cloth: 33 },
};

/** A world pose, a lab pose, or an in-between "a~b:t" of either. */
function poseFor(key: string): Pose {
  const m = /^(\w+)~(\w+):([\d.]+)$/.exec(key);
  if (m && (WORLD_POSES[m[1]!] || WORLD_POSES[m[2]!])) return blendPoses(poseFor(m[1]!), poseFor(m[2]!), Number(m[3]));
  return WORLD_POSES[key] ?? resolvePose(key);
}

/** The clips the world adds to the lab's (the stand-in only; a pipeline export brings its own or none). */
export const WORLD_CLIPS: ClipSource["clips"] = [
  {
    id: "sit",
    loop: true,
    tags: ["world"],
    frames: [
      { pose: "sit0", duration: 34 },
      { pose: "sit0~sit1:0.5", duration: 10 },
      { pose: "sit1", duration: 34 },
      { pose: "sit1~sit0:0.5", duration: 10 },
    ],
  },
];

export interface ScaledBake {
  pkg: SpritePackage;
  atlas: PackedAtlas;
  warnings: string[];
  ms: number;
  /** Measured skull-top-to-sole height of the idle pose, px. */
  height: number;
}

function renderPose(key: string, k: number): { image: PackedImage; pivot: [number, number]; anchors: Record<string, [number, number]>; warnings: string[] } {
  const bw = Math.ceil(300 * k);
  const bh = Math.ceil(230 * k);
  const ox = Math.round(150 * k);
  const oy = Math.round(200 * k);
  const buf = new ScaledPixBuf(bw, bh, ox, oy, PAL, k);
  const { anchors, warnings } = drawFigure(buf, poseFor(key));
  const { albedo, normal } = buf.finish(KEY_LIGHT);
  const t = trim(bw, bh, albedo, normal, 0);
  if (!t) throw new Error(`pose ${key} drew nothing at ${k}x`);
  const anc: Record<string, [number, number]> = {};
  for (const [n, v] of Object.entries(anchors)) anc[n] = [Math.round(v[0] * k * 10) / 10, Math.round(v[1] * k * 10) / 10];
  return {
    image: { key, w: t.w, h: t.h, albedo: t.albedo, normal: t.normal },
    pivot: [ox - t.x, oy - t.y],
    anchors: anc,
    warnings: warnings.map((w) => `${key}: ${w}`),
  };
}

/** Bakes the stand-in at scale k (world H / 96) from an already-scaled clip source. */
export function bakeScaledStandin(src: ClipSource, k: number, name: string): ScaledBake {
  const t0 = performance.now();
  const keys = new Set<string>();
  for (const c of src.clips) for (const f of c.frames) keys.add(f.pose);
  const images: PackedImage[] = [];
  const meta = new Map<string, { pivot: [number, number]; anchors: Record<string, [number, number]> }>();
  const warnings: string[] = [];
  let height = 0;
  for (const key of keys) {
    const r = renderPose(key, k);
    images.push(r.image);
    meta.set(key, { pivot: r.pivot, anchors: r.anchors });
    warnings.push(...r.warnings);
    if (key === "idle0") height = r.pivot[1];
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
      name,
      atlases: [{ id: "standin", albedo: "(baked)", normal: "(baked)", width: atlas.width, height: atlas.height, shading: "baked" }],
      clips,
      ...(src.defaults ? { defaults: src.defaults } : {}),
    },
    `${name} (stand-in bake)`,
  );
  return { pkg, atlas, warnings, ms: performance.now() - t0, height };
}
