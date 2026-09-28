// Sprite package loading. public/lab/<name>/manifest.json either holds a real
// pipeline export (validated against the contract) or the placeholder
// { "standin": true }, in which case the procedural stand-in is baked.

import { ContractError, isStandinManifest, validatePackage, type Box, type Clip, type SpritePackage } from "../contracts.ts";
import type { PackedAtlas } from "../art/atlas-builder.ts";
import type { Renderer, SpriteSheet } from "../engine/renderer.ts";

export interface RuntimeSprite {
  name: string;
  source: "pipeline" | "standin";
  pkg: SpritePackage;
  sheets: Map<string, SpriteSheet>;
  clips: Map<string, Clip>;
  defaultHurt: Box[];
}

const keyInfluence = (shading: "flat" | "baked"): number => (shading === "flat" ? 1 : 0.25);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function wrap(pkg: SpritePackage, sheets: Map<string, SpriteSheet>, source: RuntimeSprite["source"]): RuntimeSprite {
  return {
    name: pkg.name,
    source,
    pkg,
    sheets,
    clips: new Map(pkg.clips.map((c) => [c.id, c])),
    defaultHurt: pkg.defaults?.hurtboxes ?? [],
  };
}

export function fromBaked(r: Renderer, pkg: SpritePackage, atlas: PackedAtlas): RuntimeSprite {
  const sheets = new Map<string, SpriteSheet>();
  for (const a of pkg.atlases) {
    sheets.set(a.id, { albedo: r.texture(atlas.albedo), normal: r.texture(atlas.normal), keyInfluence: keyInfluence(a.shading) });
  }
  return wrap(pkg, sheets, "standin");
}

/**
 * Returns the pipeline export when public/lab/<dir>/manifest.json is one,
 * otherwise null (the caller bakes the stand-in). No manifest (404) or no
 * network means the stand-in; a manifest that is there but isn't valid JSON
 * is a contract failure with the file named, never a silent fallback.
 */
export async function loadExported(r: Renderer, dir: string): Promise<RuntimeSprite | null> {
  const base = `/lab/${dir}/`;
  const file = `${base}manifest.json`;
  let text: string;
  try {
    const res = await fetch(file, { cache: "no-cache" });
    if (!res.ok) return null;
    text = await res.text();
  } catch (e) {
    console.warn(`${file}: could not fetch (${e instanceof Error ? e.message : String(e)}); using the stand-in`);
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
    if (albedo.naturalWidth !== a.width || albedo.naturalHeight !== a.height) {
      throw new Error(`${base}${a.albedo} is ${albedo.naturalWidth}x${albedo.naturalHeight}, manifest says ${a.width}x${a.height}`);
    }
    // the normal map shares the albedo's layout, so it must be the same size
    if (normal && (normal.naturalWidth !== a.width || normal.naturalHeight !== a.height)) {
      throw new Error(`${base}${a.normal} is ${normal.naturalWidth}x${normal.naturalHeight}, albedo is ${a.width}x${a.height}`);
    }
    sheets.set(a.id, {
      albedo: r.texture(albedo),
      normal: normal ? r.texture(normal) : r.flatNormal,
      keyInfluence: keyInfluence(a.shading),
    });
  }
  return wrap(pkg, sheets, "pipeline");
}
