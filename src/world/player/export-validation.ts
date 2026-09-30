import { ContractError, type AtlasDesc, type SpritePackage } from "../../lab/contracts.ts";

interface ImageSize {
  naturalWidth: number;
  naturalHeight: number;
}

/** Validate decoded pixels before creating a GPU texture, as the lab loader does. */
export function validateAtlasImages(atlas: AtlasDesc, albedo: ImageSize, normal: ImageSize | null, base: string): void {
  const issues: string[] = [];
  if (albedo.naturalWidth !== atlas.width || albedo.naturalHeight !== atlas.height) {
    issues.push(`${atlas.albedo}: decoded ${albedo.naturalWidth}x${albedo.naturalHeight}, expected ${atlas.width}x${atlas.height}`);
  }
  if (normal && (normal.naturalWidth !== atlas.width || normal.naturalHeight !== atlas.height)) {
    issues.push(`${atlas.normal}: decoded ${normal.naturalWidth}x${normal.naturalHeight}, expected matching ${atlas.width}x${atlas.height}`);
  }
  if (atlas.normal && !normal) issues.push(`${atlas.normal}: declared normal map was not decoded`);
  if (issues.length) throw new ContractError(`${base}manifest.json`, issues);
}

/**
 * The world simulation indexes both resolutions by the same clip and frame.
 * A complete export must therefore be installed as one synchronized pair.
 * Both absent/placeholders preserves the existing procedural preview.
 */
export function validateExportPair(world: SpritePackage | null, closeup: SpritePackage | null, requiredClips: readonly string[]): void {
  if (!world && !closeup) return;
  const source = "/world/character/manifest.json + /world/character-closeup/manifest.json";
  if (!world || !closeup) {
    throw new ContractError(source, ["install both 80px and 144px character exports; cannot mix pipeline art with a procedural stand-in"]);
  }
  const issues: string[] = [];
  const small = new Map(world.clips.map((clip) => [clip.id, clip]));
  const large = new Map(closeup.clips.map((clip) => [clip.id, clip]));
  for (const id of new Set([...requiredClips, ...small.keys(), ...large.keys()])) {
    const a = small.get(id);
    const b = large.get(id);
    if (!a || !b) {
      issues.push(`clip ${id}: missing from ${!a ? "80px" : "144px"}${!a && !b ? " and 144px" : ""} export`);
      continue;
    }
    if ((a.loop ?? false) !== (b.loop ?? false) || a.next !== b.next) {
      issues.push(`clip ${id}: loop/next differs between resolutions`);
    }
    if (a.frames.length !== b.frames.length) {
      issues.push(`clip ${id}: frame count differs (${a.frames.length} vs ${b.frames.length})`);
      continue;
    }
    a.frames.forEach((f, i) => {
      const g = b.frames[i]!;
      if (f.duration !== g.duration || (f.hold ?? 0) !== (g.hold ?? 0)) {
        issues.push(`clip ${id} frame ${i}: duration/hold differs between resolutions`);
      }
      if (!f.pose || !g.pose) {
        issues.push(`clip ${id} frame ${i}: both resolutions need a source pose key for frame alignment`);
      } else if (f.phase !== g.phase || f.pose !== g.pose) {
        issues.push(`clip ${id} frame ${i}: phase/pose order differs between resolutions`);
      }
    });
  }
  if (issues.length) throw new ContractError(source, issues);
}
