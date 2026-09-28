# Native hardware materials

2026-09-07. The main bridge/lift/banner bodies now use registered raster material. The verified physical layout and state machines are unchanged. This is local material/function proof, not complete public-site acceptance.

## Sources and registration

Root supplied one separately generated bridge mast: `source/material-replacements-v1/P21-bridge-fixed-mast-raw-v1.png`, SHA256 `46b9af36ae695151ae6bba06407d5b14cf9e280f0d93aa411adfce6d4ba0191a`. The original was visually inspected and remains unchanged. P21 is one new independent source role; no sheet, whole scene or new generative animation was used.

The final keyed subject bounds are(64,126)–(707,1937),643×1811 source pixels. The inspected boss-hole centroid is approximately396.9,503.3. One attachment-based scale, rounded to the native integer grid, produces58×164 pixels with local eye(30,34). Placement(-54,-164) registers that eye to the unchanged fixed rope point(-24,-130) and ends the foot at y0. No runtime scaling, source painting or geometric squashing is used. The first two key derivatives retained purple fringe at4× and were rejected/preserved; the third key-only derivative is selected. These are three processing derivatives of one generated source.

The selected file is `public/world/assets/library-v1/P21-bridge-mast-v1.png`, SHA256 `220f5a165e216a964af9c270ff0abf17655ffc96bc53ddde9ce51f4752a170cd`. The final export recipe/measurement is `source/material-replacements-v1/P21-v3-export.json`; runtime version1 and processing derivative3 are separate identifiers. Native and4× review images are preserved alongside it.

## Main bodies replaced

- Bridge: generated P21 mast/socket replaces the filled-rectangle upright and beam. FG05/P04 native receiver plate/lug replaces the flat receiving bracket. Existing P08 bearing,192px P07 deck, rope eyes/fibers, cut fraction and timing remain unchanged. The socket source itself is visible; a flat icon no longer paints over it.
- Lift: P10 native guide shafts, heads/feet and mount crops replace the flat spine faces. FG05 crops supply17px crossmembers, bank anchors and carriage brackets with preserved cap/face/edge pixels. P10 crops supply the moving shoe housings. Guide centers, full192px deck,1120/832 stops and exact carry are unchanged; the fixed frame stays anchored while the carriage moves.
- Banner: P04's7px stem and27×6 foot supply the pole/base, with P10 native cap and latch housing. Cloth, roller, bottom weight, projected DOM bounds and release/rewind durations are unchanged. A tiny moving lever and contact/indicator pixels remain procedural state cues; they do not replace substantial visible material bodies.

All reused pieces are cropped/repeated at scale1. They are applications of existing generated sources, not additional generated assets. `mechanisms.ts` is the sole state owner; no new control, collision, paid action, source-art filter or personal-art reuse was added.

## Actual review and verification

`after-receipt.json` records11 passing native checks with zero page errors: held-gap fall/reset, E lowering and68 grounded interior-deck samples, Restart, separate J release, lift pause, both occupied directions(563/562 samples, zero carry error), banner opening/rewinding and the expanded51-role library load. The bridge/lift/banner screenshots were inspected at actual1600×1000 gameplay size. Compare earlier material captures under `../mechanical-purpose-v1` with the new `after-bridge-settled.png`, `after-lift-moving-up.png` and `material-banner-open.png`; background/platform changes from the other lanes are not attributed to this pass.

`phone-receipt.json` and its four390×844 captures add coarse-pointer browser inspection. Native touch Interact lowers the bridge, starts the lift and opens the banner after keyboard traversal. Source pixels remain readable and the existing controls/bounds fit. This is emulation, not real Samsung/iPad performance or tactile approval.

Complete53.84-second recording: `after-video/page@061effc817bfb76b8486e241a1048db4.webm`. `hardware-material-motion.mp4` selects source intervals7.8–12.3,29.2–34.2,38–43 and50.2–53.8 at original speed, showing bridge, lift and banner material in action. The full recording preserves continuity; no synthetic replacement frames are used.

## Inventory and handoff

The shared catalog/inventory was reread after the FG01 lane's update before appending P21. It now records51 independent generated/exported/loaded library roles,36 participating raster roles,15 reserve roles and165 scene-image placements; final accepted remains0. The original approximately50 target is retained as planning history. P21's source/registration and reuse notes for FG05/P10/P04 are in the private inventory and `provenance/asset-records/P21.json`.

Actual world source PNG surfaces now total35,658,320 RGBA bytes(34.0064MiB), with1,997,139 encoded bytes. Adding the unchanged hero6,720,000 bytes, current generated lighting5,159,880 bytes and existing soft masks258,048 bytes gives approximately45.582MiB of accounted surfaces. This excludes browser/GPU copies, other generated buffers, gallery and separately budgeted audio; it is not a total-process/GPU measurement.

TypeScript and scoped diff-whitespace checks pass. No source edits remain pending in this lane. Root must reconcile the changed51-role release allowlist, docs/current counts and fresh previews before freezing a final candidate. No codec, poster, documentation export, public origin, tunnel or server was changed here; all proof browsers are closed. Final source identities: mechanisms SHA256 `d16182fa361b95ba6e4e374c479a324056c6c2f211f882eae622e2425502b342`; scene manifest SHA256 `6add0758365076fc60bc0b67969e07f8e6df2b0eb8939af15b3bb656fcc3ede8`.
