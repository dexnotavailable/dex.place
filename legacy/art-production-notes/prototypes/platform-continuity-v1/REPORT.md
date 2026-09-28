# Continuous platform material

2026-09-07. Implemented a direct response to Dex's request that the standing platform loop cleanly without looking like Lego pieces.

## Result

The repeated bracketed 480×70 FG01 picture no longer paints the walking surface. `game/platforms.ts` draws a continuous flat slab with a thin pale cap, quiet blue-charcoal fascia, sparse world-coordinate wear/construction joints, and true vertical ends at exposed collider edges. Repeated floor records do not introduce bracket seams. Three bearing plates attach to the actual separately authored FG03 arrival piers; their locations come from those placements, not a repeating texture interval.

The long platform now reads as one architectural span. At normal and phone size its restrained detail avoids a repeating row of support shapes. At ultrawide size the uninterrupted cap and broad fascia preserve the large scale. Existing raster props remain the detailed foreground objects; the floor is intentionally quieter. No generated images or raster edits were needed.

Only a new platforms.ts plus the Environment import/buildFloors delegation changed rendering in this lane. Map/WorldScene/camera, moving lift and bridge mechanics were not edited. The current map still contains44 main stair solids, each24 px wide with8 px rise; floor/cap rendering reads their exact x/y/width. The bridge and lift gaps stay unpainted. Existing service-bank rendering remains available for older maps but does not draw over the current main-route bridge gap.

## Actual captures

- `before-desktop-arrival.png` → `after-desktop-arrival.png`: same player/camera, bracket repetition removed.
- `before-ultrawide-arrival.png` → `after-ultrawide-arrival.png`: long-span continuity and sparse structural supports.
- `before-phone-arrival.png` → `after-phone-arrival.png`: actual phone-emulated scale, readable cap and unchanged touch controls.
- `final-desktop-stairs.png`, `final-ultrawide-stairs.png`, `final-phone-stairs.png`: actual walking to the first threshold landing, grounded at y928 with zero jumping; cap/treads visible.
- `after-desktop-dispatch.png`: a real open192 px main-route gap between4920 and5112, with independently raised bridge. That geometry belongs to the mechanics lane.

`before-capture.json` and `after-capture.json` each record9 screenshots,9 raw native canvas captures, player/camera states, source hashes and zero browser errors. `final-capture.json` adds3 staircase captures after the mechanics lane's approved threshold.beam-support depth18→3 correction. That separate scene change exposes the landing cap behind which the pillar previously hid it; this lane reported the visibility problem but did not edit its placement.

The first pre-change attempt encountered a framebuffer/context failure during a contemporaneous Vite HMR reload. `before-first-context-error.json` preserves it. A fresh-context full retry passed, followed by the full after run. No claim of a diagnosed production framebuffer defect is made. Final whole-site checks should use a frozen build to avoid concurrent source reloads.

TypeScript passes. The map query confirms44 unchanged24-wide/8-rise stair records and no static floor covering4920..5112 at y960. This lane visually traversed the first threshold in three layouts; full44-stair traversal and occupied lift/bridge motion are separately owned mechanics proofs. Phone captures are emulation, not a real Samsung/iPad verdict.

## Inventory and source preservation

Chapter10/19 and the private production inventory now identify FG01's raster as reserve material and the slab/stair structural role as code-native. FG10 also remains a reserved raster. The library still holds50 separately generated/exported images;34 raster source roles currently render and16 are reserved. Loading all50 is not claimed to show all50. The scene contains165 authored image placements at this checkpoint. No code strip, tread, bearing plate or repeat inflates the generated-asset count.

The unchanged FG01 file SHA256 remains `caf5b68a2db42514f59557c6a6c8011531758782de427b3527b138aed4952db1`. Its native export/mapping survives in `reservedRasterMapping`; original image files and receipts remain untouched. `inventory-before.json` preserves the prior owner document, with `reconcile-inventory.py` and `inventory-reconciliation.json` recording the update. Whole-scene acceptance and public promotion remain open.

## Root handoff

Platform rendering/source ownership is returned. Refresh public documentation and previews at the coordinated checkpoint; no staging or deployment was done here. The new material accepts the current map geometry and root's lighting treatment without a new lighting API. If additional supports are needed, place them at authored structural points rather than restoring a periodic bracket pattern.
