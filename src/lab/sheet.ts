// /lab/?sheet : every stand-in pose on one screen, lit by the real renderer.
// A review tool for the character loop (silhouette, face, grip, rim).

import { renderPose } from "./art/standin-bake.ts";
import { pack, type PackedImage } from "./art/atlas-builder.ts";
import { POSES } from "./art/standin-poses.ts";
import type { Lighting, PointLight, Renderer } from "./engine/renderer.ts";

export function runSheet(r: Renderer, lighting: Lighting, filter: string | null): void {
  const keys = Object.keys(POSES).filter((k) => !filter || filter.split(",").some((f) => k.startsWith(f)));
  r.setMode(keys.length <= 6 ? "near" : "far");
  const images: PackedImage[] = [];
  const meta: { key: string; pivot: [number, number]; warnings: string[] }[] = [];
  for (const k of keys) {
    const p = renderPose(k);
    images.push(p.image);
    meta.push({ key: k, pivot: p.pivot, warnings: p.warnings });
  }
  const atlas = pack(images);
  const sheet = { albedo: r.texture(atlas.albedo), normal: r.texture(atlas.normal), keyInfluence: 0.25 };
  const warn = meta.flatMap((m) => m.warnings);
  if (warn.length) console.info(warn.join("\n"));
  const cols = Math.min(keys.length, keys.length <= 6 ? 3 : keys.length <= 10 ? 5 : 8);
  const cellW = Math.floor(r.iw / cols);
  const rows = Math.ceil(keys.length / cols);
  const cellH = Math.floor(r.ih / rows);
  const lights: PointLight[] = [];
  let t = 0;
  const frame = (): void => {
    t++;
    lights.length = 0;
    // one moving warm light so rim + normal response can be judged
    lights.push({ x: r.iw / 2 + Math.cos(t / 60) * r.iw * 0.45, y: 60 + Math.sin(t / 45) * 30, height: 30, radius: 520, colour: [1, 0.72, 0.4], intensity: 0.9 });
    r.begin(0, 0, lighting, lights);
    r.backdrop([0.1, 0.11, 0.15], [0.2, 0.21, 0.27], [0.3, 0.31, 0.36], r.ih, 6);
    meta.forEach((m, i) => {
      const rect = atlas.rects.get(m.key)!;
      const cx = (i % cols) * cellW + Math.floor(cellW / 2);
      const gy = Math.floor(i / cols) * cellH + Math.min(cellH - 6, Math.floor(cellH / 2) + 66);
      r.rect(cx - 30, gy, 60, 1, [0.45, 0.45, 0.52]);
      r.sprite({ sheet, sx: rect[0], sy: rect[1], sw: rect[2], sh: rect[3], x: cx - m.pivot[0], y: gy - m.pivot[1] });
    });
    r.present({ impact: 0, zoomSteps: 0, focus: [0, 0], fade: [0, 0, 0, 0] });
    requestAnimationFrame(frame);
  };
  (window as unknown as { __sheet: unknown }).__sheet = { keys, warnings: warn };
  frame();
}
