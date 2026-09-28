# Dispatch / Archive light and recess correction

Only `D:/Dex/Projects/dex-place-world/site/src/worldsite/game/environment.ts` changed. Current layout, map/scene JSON, WorldScene, hero, UI, artwork, QR and audio were untouched. Before and after captures use the locally installed map/scene on5188, native section navigation and the real raw world canvas. This is a local candidate, not public-live acceptance.

## Selected result: after-v2

The old large cones were below much of the wall art and read as flat triangles. Dispatch and Archive now have a darker backing above their wall/gantry textures, with a restrained SCREEN light layer on actual nearby pixels. A140×24-world-pixel floor-contact pool and a low72px-high spill preserve the existing floor/prop textures. The fixed fixture is aligned to the room's real terminal and keeps its suspension wire. No high-intensity bloom, new geometry or asset generation was introduced.

The first revision used a larger oval around the terminal. Independent saved-image review agreed the cone/recess fixes were meaningful but found that oval smoky in portrait. One bounded revision lowered and flattened it; `after-v1` remains as comparison history. `after-v2` is selected. The result is quiet and surface-bound rather than a glowing orb or enlarged cone.

Archive's M04 frame now has an opaque dark aperture, inset top/side shadow and sill treatment. Its dimensions derive from the placed M04 size and the normalized native213×640 aperture; its backing follows the actual image position/parallax. Background wall lines no longer continue through the opening. The frame reads as a deep recess instead of a transparent outline.

## Verification

- `pnpm exec tsc --noEmit` passed after the final revision.
- Actual1920×1080 desktop and412×915 portrait captures for both rooms, all visually inspected: `before/` and `after-v2/`.
- Actual Settings UI selected Quality=Low and Motion=Reduced, then visited both rooms. Both setting snapshots verified; essential spill/pool and recess remain. Low hides only the optional soft wall spill. `low-reduced/receipt.json` records pass and zero page errors; its Dispatch frame was visually inspected afterv2.
- Zero page errors in all before/after captures. No game state or clock injection.
- Same WorldScene/map/scene hashes before and after. No collision, route or menu behavior change; unrelated full-route proofs were not repeated.
- One shared96×96 runtime mask texture, reused by the two rooms. World textures retain their native pixels. No external image export or new shader framework.

Final environment SHA256: `8988e299b623690cd755e4598c4c0a598128d469c96f27368dc0953d29b83204`.

Baseline environment SHA256: `106dec392f84ff3b9b5b2f4cd91bd37cee9a6d4fce5b20f475cca3fe3b367703`; its exact source is preserved at `before/environment.ts`. Root owns any acceptance/rollback and recapture of the loading posters. Support's distantM10 material remains later polish outside this change.
