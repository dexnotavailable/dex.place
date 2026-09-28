import Phaser from 'phaser';
import type { AssetRect } from './assets';

export interface AssemblyAssetMetadata {
  id: string; frame?: AssetRect;
  attachments?: { origin?: { x: number; y: number }; clothLeft?: { x: number; y: number }; cutPoint?: { x: number; y: number }; pivot?: { x: number; y: number } };
  parts?: {
    screen?: AssetRect; indicator?: AssetRect; glassCrop?: AssetRect; emissionBounds?: AssetRect;
    fixedUpper?: AssetRect; releasedLower?: AssetRect; aperture?: AssetRect; plaque?: AssetRect;
    lensPlacement?: { assetId: string; rect: AssetRect }; clothBearing?: AssetRect;
  };
}
export interface NativeAssemblyPart {
  name: string; assetId: string; textureId: string; image: Phaser.GameObjects.Image;
  sourceRect: AssetRect; x: number; y: number; visibleHeight?: number;
}
export interface NativeAssemblyArt { parts: Record<string, NativeAssemblyPart>; missing: string[] }

export function assemblyAsset(scene: Phaser.Scene, id: string) {
  const ids = id === 'P02' ? ['terminal', 'P02'] : [id];
  const textureId = ids.find(candidate => scene.textures.exists('asset:' + candidate));
  if (!textureId) return undefined;
  const texture = scene.textures.get('asset:' + textureId);
  const frame = texture.get(texture.has('content') ? 'content' : '__BASE');
  const assets = (scene.cache.json.get('scene-manifest') as { assets?: AssemblyAssetMetadata[] })?.assets || [];
  return { textureId, texture, frame, width: frame.cutWidth, height: frame.cutHeight, metadata: assets.find(asset => asset.id === textureId) };
}

/** Frames crop the source texture; no display-size operation can alter pixel pitch. */
export function nativePart(scene: Phaser.Scene, root: Phaser.GameObjects.Container, art: NativeAssemblyArt, name: string, id: string, x: number, y: number, crop?: AssetRect) {
  const asset = assemblyAsset(scene, id);
  if (!asset) { if (!art.missing.includes(id)) art.missing.push(id); return undefined; }
  const rect = crop || { x: 0, y: 0, width: asset.width, height: asset.height };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) || rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 || rect.x + rect.width > asset.width || rect.y + rect.height > asset.height) {
    art.missing.push(id + ':' + name + ':invalid-crop'); return undefined;
  }
  const frameName = `assembly:${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
  if (!asset.texture.has(frameName)) asset.texture.add(frameName, asset.frame.sourceIndex, asset.frame.cutX + rect.x, asset.frame.cutY + rect.y, rect.width, rect.height);
  const image = scene.add.image(Math.round(x), Math.round(y), 'asset:' + asset.textureId, frameName).setOrigin(0, 0).setName(root.name + ':' + name);
  root.add(image);
  const part: NativeAssemblyPart = { name, assetId: id, textureId: asset.textureId, image, sourceRect: { ...rect }, x: Math.round(x), y: Math.round(y) };
  art.parts[name] = part;
  return part;
}

export function nativeBottom(scene: Phaser.Scene, root: Phaser.GameObjects.Container, art: NativeAssemblyArt, name: string, id: string) {
  const asset = assemblyAsset(scene, id);
  const origin = asset?.metadata?.attachments?.origin || { x: Math.floor((asset?.width || 0) / 2), y: asset?.height || 0 };
  return nativePart(scene, root, art, name, id, -origin.x, -origin.y);
}

export function nativeStrip(scene: Phaser.Scene, root: Phaser.GameObjects.Container, art: NativeAssemblyArt, name: string, id: string, x: number, y: number, width: number, centered: boolean) {
  const asset = assemblyAsset(scene, id);
  if (!asset) { if (!art.missing.includes(id)) art.missing.push(id); return false; }
  const span = Math.max(1, Math.round(width));
  for (let at = 0, index = 0; at < span; index++) {
    const size = Math.min(span - at, asset.width);
    const from = centered && span <= asset.width ? Math.floor((asset.width - size) / 2) : 0;
    nativePart(scene, root, art, `${name}:${index}`, id, x + at, y, { x: from, y: 0, width: size, height: asset.height });
    at += size;
  }
  return true;
}

/** Native bezel crops stay opaque while the independent luminous insert changes. */
export function nativeIndicator(scene: Phaser.Scene, root: Phaser.GameObjects.Container, art: NativeAssemblyArt, name: string, id: string, x: number, y: number, fallback: AssetRect) {
  const asset = assemblyAsset(scene, id);
  if (!asset) { if (!art.missing.includes(id)) art.missing.push(id); return undefined; }
  const emission = asset.metadata?.parts?.emissionBounds || fallback;
  const regions = [
    { x: 0, y: 0, width: emission.x, height: asset.height },
    { x: emission.x + emission.width, y: 0, width: asset.width - emission.x - emission.width, height: asset.height },
    { x: emission.x, y: 0, width: emission.width, height: emission.y },
    { x: emission.x, y: emission.y + emission.height, width: emission.width, height: asset.height - emission.y - emission.height },
  ];
  regions.forEach((rect, index) => { if (rect.width > 0 && rect.height > 0) nativePart(scene, root, art, `${name}:bezel:${index}`, id, x + rect.x, y + rect.y, rect); });
  return nativePart(scene, root, art, name + ':emission', id, x + emission.x, y + emission.y, emission);
}

export function nativeArtSnapshot(art: NativeAssemblyArt | undefined) {
  if (!art) return null;
  return { assets: [...new Set(Object.values(art.parts).map(part => part.assetId))], missing: [...art.missing], parts: Object.values(art.parts).map(part => ({ name: part.name, assetId: part.assetId, textureId: part.textureId, sourceRect: part.sourceRect, x: part.image.x, y: part.image.y, width: part.image.width, height: part.image.height, scaleX: part.image.scaleX, scaleY: part.image.scaleY, alpha: part.image.alpha, visible: part.image.visible, visibleHeight: part.visibleHeight ?? part.sourceRect.height })) };
}
