# Room streaming, gallery frames and reset repair — 2026-09-08

Implemented in gameplay source. Parent-owned Environment provides idempotent `ensureRoom(roomId)` and the parent/UI lane owns loading/retry presentation.

## Result

Initial world loading now requests metadata, the hero, shared platform/sky/water material and Arrival dependencies. Cast sheets and deeper-room materials load at their boundary. An observed initial-load checkpoint dropped from99 to29 `/world/` responses and from3,005,695 to2,060,916 encoded bytes. These counts include the DOM parchment/fonts under `/world/`; they are measured development checkpoints, not a controlled cold-network benchmark. There are zero cast-sheet requests before Arrival is ready. `before-initial.json` and `after-initial.json` retain the actual URL/size lists.

Room dependencies derive from current scene placements, per-object material roles and actual resident/mob/product actor metadata. Sprite descriptors load as spritesheets. Content/repeat frames are registered before Environment/assembly/Population hydration. Every room caches its textures and constructed state; revisiting does not rebuild machinery or re-fetch its textures.

At a boundary, held inputs and active presence pause while real assets load. Failure leaves the source room/progress intact; E or Retry passage retries. A resumed simulation tick starts the existing half-second door opening. Menu/blur state is never unpaused by an asynchronous callback. Cached restart bypasses an obsolete request queue, and tokens prevent stale targets from replacing the current room. Scene shutdown, destroy and actual renderer loss invalidate hydration.

The five landscape and four portrait exhibits now use dimensions-only metadata to assemble native P14 frame borders around appropriately shaped apertures. Original artwork remains in DOM display elements, at its original aspect ratio; no artwork URLs/pixels enter canvas metadata. Wide frames keep only the two original lower feet rather than repeating feet with the rail. Frame sources remain native1×.

Bat reset clears `deadGrounded`, fall velocity and hit state. Restoring an uncut progress snapshot also re-latches an already hydrated map; an earlier account/guest world's map cut cannot remain visually open.

## Proof

- `proof.json`:9 actual App checks passed with native Enter/walk/E/Menu/Retry/Resume. A real cloth image request was delayed then aborted; an Archive image was delayed. Source/input freeze, source-safe failure, hydration/retry, E/Slash hints outside Gallery, paused completion, resume and cached return passed. No source drift in the captured window.
- `lifecycle-proof.json`:16 controlled real-Phaser checks passed. All11 rooms hydrate without missing textures; nine frames use native material and dimensions only; the historical second-bat-death failure is reproduced; the repaired reset falls again; uncut restore re-latches the map. Explicit room commands and scripted contacts are lifecycle/lookdev tests, not native traversal. No source drift.
- `cancellation-proof.json`:4 checks passed for stale restart completion, Scene disposal, availability of an actual WebGL loss fault, and actual App context loss during pending hydration. No source drift.
- `pnpm exec tsc --noEmit`: passed after the final gameplay changes.

The first paused-blackout deadlock and the first missing Scene DESTROY cancellation are preserved as separate defect receipts. Gameplay now delays opening until resume; root additionally guards blackout visibility when a menu/inspector covers the world. The two fixes have distinct ownership.

The context-loss probe also observed **zero post-entry renderer retry buttons**. Hydration cancellation is correct, but that UI recovery gap is assigned to the UI owner, with `context-loss-after-load.png` as evidence. Do not count it as completed here.

## Current review boundaries

- Final11-room visual capture must await `snapshot.roomId === target` and `!snapshot.pendingRoom` after each now-asynchronous enter-room command.
- `gallery-aspect-frames.png` is actual neutral canvas lookdev; personal illustrations are intentionally absent. Full DOM exhibit composition remains a separate visual review.
- Broader current App reverse-door coverage and device/public checks remain tracked in `../INTEGRATED-CHECKPOINT.md`; the controlled all-room hydration checks do not replace them.
- Visited texture caching is retained. This pass implements first-scene/deeper-room streaming, not GPU texture eviction or a measured GPU-memory cap.
- Public publishing and documentation export were not performed by this gameplay lane.

## Main source

`roomResources.ts`, `WorldScene.ts`, `population.ts`, `galleryFrames.ts`, `illustrationDimensions.ts`, `assemblies.ts`, `assets.ts`, `contracts.ts`, `index.ts`.

Rebuild dimensions through `../build-gallery-dimensions.mjs`; its private provenance file hashes the `{id,width,height}` projection from public content. The original generated frame, leaf and all personal illustration files were not edited.
