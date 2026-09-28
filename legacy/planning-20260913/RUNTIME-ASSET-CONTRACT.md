# Registry runtime / production handoff

Root owns all new art generation, art preparation tools, public/world/registry/** and asset registration. The single implementation worker owns src/worldsite/registry/**, registry.html, vite.registry.config.ts, tsconfig.registry.json and isolated registry test scripts. Do not edit old v2 or hosting files. Coordinate contract changes before either side writes the other's paths.

Use logical reference-camera size1600x900. Hero native52px body is an initial baseline (~6% view height). Room model/physics/camera must be data-driven, not tied to old v2 coordinates. Mobile may adjust logical view while preserving safe floor and legible character. The new scene entry never mounts account/social/lowerwebsite code.

The generated art catalogue is `/world/registry/assets.json`:

```ts
type ArtAsset = {
  src: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
  columns?: number;
  frameMs?: number | number[];
  loop?: boolean;
  pivot?: [number, number];
};
type ArtCatalogue = {
  version: string;
  assets: Record<string, ArtAsset>;
  rooms: Record<string, {
    reference?: string;
    layers: Array<{
      asset: string;
      role: 'sky'|'landmark'|'cloud'|'wall'|'floor'|'foreground'|'light';
      x: number; y: number; width: number; height: number;
      depth: number;
      parallax?: number;
      alpha?: number;
      phase?: number;
      drift?: number;
      blend?: 'normal'|'screen'|'add';
    }>;
  }>;
};
```

Layer x/y/width/height are in reference-camera coordinates; room-specific x-offset can extend broad floor/walls for actual playable extent. Room definitions own reference camera centre and world offset for shared landmark coherence. Root will register only actual files with actual dimensions; the worker must not create fictitious asset entries. Multiple room layers can share one asset.

Room IDs: arrival, rest, registry, junction, vestibule, arena, archive, low-passage, pool, sky-walk, exhibit, courtyard. Read GAME-BUILD.md and central-arrival-floor-plan.md for exact flow; the map image supplies shared aesthetics/landmarks, while this authored topology governs behavior. The scenic branch starts at junction, not arrival.

Expected semantic prop/clip IDs (may be delivered progressively): bench, registry-desk, accountant-idle, accountant-acknowledge, accountant-rest, door-frame, door-leaf, courtyard-latch, donor-box, map-banner, bridge, bridge-rope, paper-terminal, exhibit-frame, tree, cloud-far, cloud-mid, cloud-near, lamp-emission, water-shimmer, warden-idle, warden-attack, warden-recover, warden-hit, warden-death. If a clip is not yet delivered, preserve an integration status; do not claim that a procedural placeholder is final generated art.

Hero: use actual `/world/hero/manifest.json` and authored source clips; root will judge a replacement only after an animation test. No unconditional hero frame/collider assumptions for future actor definitions.

Room scripts own interactable placement and collision and can scale/position those semantically to the final room references. Props should not be baked duplicates in wall plates. Preserve sheet frame pivots and actual frame timing. Clouds/luminous inserts must play delivered sheet frames, with separate phase; static drift alone does not satisfy the user's request.

Root will put each room reference in art-production/registry-game-20260913/rooms/<id>/reference.png. Do not use those composite pictures as the sole final runtime room. Compare assembled layers against them during review.
