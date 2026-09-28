<a id="world-asset-inventory"></a>
# World asset inventory

Go active · source specification v1.8 · The library now contains51 independent generated/exported world-art roles:10 foreground,21 props,10 middle and10 background. Current raster participation is36 roles, with15 reserved and165 authored image placements. The original approximately50 target remains the planning baseline; loaded textures and roster counts are not final acceptance. State changes and exact source/runtime mappings live in the private production inventory (private asset-authoring root), dated runtime integration receipt (private asset-authoring root) and selected export manifests. Hero, gallery, brand and audio remain separate collections.

<a id="production-and-counting-rules"></a>
## Production and counting rules

- One focused image-generation request per asset/component role. Never request the whole world or all 50 pieces in one image/sheet. Preserve individual sources; atlas packing is a later export. Sustained individual generation is authorized, with thought given to each piece's use and composition.
- Match visible pixel pitch after scale within each depth role. Terminal v2 supplies the user-approved pixel-style reference; the large platform needs finer source pixels to avoid oversized rendered blocks. Middle/background can be finer while the scene remains unmistakably pixel art. Every brief specifies camera role, materials/light, placement and separate-state needs.
- **Confirmed v1.4:** require fully 2D-looking flat side-view/front elevation. Record a separate projection review: visible top/side faces, foreshortening, angled end caps, isometric or extruded 3D viewpoints need repair/replacement. Small edge highlights may remain, while depth comes from layer overlap and contrast. Matching pixel pitch or successful post-pixelation does not make a perspective-heavy source acceptable.
- Generate a coherent foreground batch, inspect it with the actual CC0 traveler and UI, then produce distinct middle/background layers. Iterate in context throughout the extended generation pass.
- If built-in generation returns unrelated infographics or other wrong material, switch to Higgsfield GPT Image 2 as Dex authorized, retaining the focused per-asset briefs. Verify actual model/quote and remaining credits; no purchase or ElevenLabs spending is implied. Do not claim throttling without evidence.
- Planned, generating, draft, needs-rework, accepted, integrated and retired are distinct statuses. Generated means a returned source exists, not that it passes. Count accepted usable pieces, not files, transparent margins, animation frames or alternate rejected takes. Style approval is a separate review field and never silently increments accepted count.
- Inspect all destinations against this roster. Replace/consolidate a weak or redundant entry with its reason; do not add clutter merely to reach 50. A scene or necessary interaction missing usable parts remains unfinished.

<a id="per-asset-scale-and-production-record"></a>
## Per-asset scale and production record

Keep the stable ID, depth layer, destination and compositional purpose alongside raw source, generation route, derivatives and runtime mapping. Every asset has these scale fields; unknowns remain null until measured, with estimates labeled:

| Field | Meaning / proof |
|---|---|
| `sourceOpaqueRect` | Subject bounds in source pixels, excluding margins; RGB baked checker backgrounds require an explicit subject mask/crop and cannot pass as transparency. |
| `sourcePixelBlock` | Source block width/height with measurement or estimate method; use the derivative grid after a controlled resample. |
| `logicalRenderSize` | Visible subject width/height on the authored logical pixel grid, before world/camera scale. |
| `worldScale` | Uniform world transform, recorded with the camera/view used for screen-pitch review. |
| `depthRole` / `gridRole` | Foreground/play-plane/middle/far purpose and the pixel grid it must match; nearby objects share coherent visible pitch, distant forms may be finer. |
| `styleReview` / `acceptanceEvidence` / `runtime_mapping` | Keep style judgment, usable-source acceptance and actual scene integration separately evidenced. |
| `projectionReview` | Strict flat 2D elevation reviewed separately from pixel pitch; record any exposed top/side plane and its targeted rework before acceptance. |

The crop/grid/scale relationship and trial acceptance are owned by [01](art-direction-and-audio.md). Record derivative transforms without overwriting the raw source or another trial's metadata. A high-definition source plus controlled per-asset pixelation is allowed for the requested comparison; accept it only after native and converted variants are judged at equal scene size with the unchanged CC0 hero, terminal, larger platform and depth layers. Never apply this experiment to UI, gallery artwork or QR codes.

<a id="roster"></a>
## Roster

| ID | Layer | Piece | Used at | Reason |
|---|---|---|---|---|
| FG01 | foreground | causeway module | arrival, dispatch, donate | flat walkable cap and dark structural underside |
| FG02 | foreground | causeway end cap | arrival, archive | terminate modules cleanly at drops |
| FG03 | foreground | pier base | arrival, donate | near support providing a human-to-architecture comparison |
| FG04 | foreground | short railing | arrival, gallery | sparse near-edge frame without covering landings |
| FG05 | foreground | suspended girder | dispatch | high peripheral depth framing |
| FG06 | foreground | near arch crown | gallery | frame a broad entrance without enclosing the camera |
| FG07 | foreground | broken ledge edge | archive | optional shortcut visual with clear collision boundary |
| FG08 | foreground | near pillar edge | arrival | cropped near mass establishing depth |
| FG09 | foreground | low rubble bank | archive, arena | quiet ground punctuation outside combat lanes |
| FG10 | foreground | stair module | gallery, archive | repeatable walkable stair surface |
| P01 | props | bench | arrival, donate | ordinary scale reference and quiet resting place |
| P02 | props | terminal housing | dispatch | independent body for E inspection |
| P03 | props | terminal screen insert | dispatch, archive | separate blank screen/glow states |
| P04 | props | signal post | arrival | local support for small red landmark |
| P05 | props | signal lens | arrival, lift | separate lit/dim state mask |
| P06 | props | cable assembly | arrival | intact/severed cut target states counted as one source |
| P07 | props | bridge deck | arrival | moving deck linked to cut cable |
| P08 | props | bridge hinge bracket | arrival | attachment makes lowering movement believable |
| P09 | props | lift platform | gallery, donate | independent platform carries player |
| P10 | props | lift rail | gallery, donate | static shaft geometry gives travel reference |
| P11 | props | lift dock indicator | gallery, donate | docked/moving states read at small size |
| P12 | props | archive folder | archive | physical document inspect target |
| P13 | props | archive shelf module | archive | sparse file cluster grounding the room function |
| P14 | props | gallery bay frame | gallery | neutral frame without artwork outsideIllustrations |
| P15 | props | donation plinth | donate | small E interaction surface within huge bay |
| P16 | props | banner roller | arrival, dispatch | top roller anchors physical dropdown |
| P17 | props | banner cloth | arrival, dispatch | separate unlettered surface unfolds behind DOMlinks |
| P18 | props | banner bottom weight | arrival, dispatch | independent lower edge/settle motion |
| P19 | props | sentinel body shell | arena | one mechanical boss body with readable vulnerability |
| P20 | props | sentinel arm blade | arena | separate strike limb for telegraphs |
| P21 | props | fixed bridge mounting mast | dispatch | generated steel post/socket registers the held rope to the bank and replaces the flat placeholder body |
| M01 | middle | transit gantry | dispatch | large span above ordinary terminal |
| M02 | middle | concrete wall bay | archive, donate | broad low-detail plane for atmospheric separation |
| M03 | middle | arcade recess | gallery, archive | depth from repeated large dark openings |
| M04 | middle | archive light well | archive | vertical negative space above small walkway |
| M05 | middle | gallery roof span | gallery | immense interior volume |
| M06 | middle | support bay opening | donate | sky-filled opening around small plinth |
| M07 | middle | bridge trestle | arrival | structural depth below causeway |
| M08 | middle | service catwalk | dispatch | small architectural detail communicating enormous supporting mass |
| M09 | middle | water-edge pilings | arrival, donate | depth and reflection scale cues |
| M10 | middle | curved structural rib | arrival, gallery | large curve counters repetitive straight pylons |
| B01 | background | pale sky field | all | quiet tonal field behind entire scene |
| B02 | background | distant haze layer | all | restrained depth plane, no gameplay masking |
| B03 | background | distant spire | arrival | complete monumental silhouette across open distance |
| B04 | background | colossal curved shell | gallery, donate | overwhelming curved mass fromscale-study relationships |
| B05 | background | far colonnade | archive, dispatch | sparse repeated rhythm fading into distance |
| B06 | background | distant skyline | arrival, dispatch | small secondary silhouette groups establish depth |
| B07 | background | still water field | arrival, donate | calm space below skyline |
| B08 | background | reflection band | arrival, donate | separate subdued reflection presentation |
| B09 | background | far cliff mass | archive, arena | quiet depth backing for immense enclosed areas |
| B10 | background | high cloud bank | arrival, gallery | subtle separate sky structure |

<a id="initial-actual-status-preserved-v13-history"></a>
## Initial actual status · preserved v1.3 history

Raw generated drafts, user style approval, usable-source acceptance and runtime integration are separate facts. Multiple revisions of one object count as one roster role. A baked checker background is an image defect, not transparency. Correct pixel pitch at the intended world size and prove clean separation before acceptance; later integration additionally needs actual scene evidence. Track current sources, measurements, transformations and live request state in the private production inventory. The authored CC0 hero and the gallery remain separate collections.

<a id="earlier-integration-checkpoint-source-v15"></a>
## Earlier integration checkpoint · source v1.5

This is the rejected compact-map checkpoint. The room repair below supersedes its placement and active-source counts; it remains production history.

| Layer / collection | Distinct runtime roles | Accounting |
|---|---:|---|
| Foreground |10|FG01–FG10; FG01's runtime alias is `causeway` |
| Props |20|P01–P20; P02's runtime alias is `terminal` |
| Middle |10|M01–M10 |
| Background |10|B01–B10 |
| World total |50|Candidate integration; final whole-scene acceptance remains separate |
| Hero / gallery / brand / audio |Excluded|No frames, repeats, effects, personal art or rejected takes inflate the world count |

The selected scene manifest contains 50 texture roles and 56 placement records. Repeated pieces, cropped floor/stair modules, stateful assemblies and programmatic sky/water coverage are applications of the roster, not additional generated assets. The measured shared texture baseline is 33.9665 MiB decoded RGBA (approximately 33.97), 1.8134 MiB compressed world images, and a separate 6.4087 MiB decoded hero (approximately 6.4). Surface estimates do not include total GPU/process overhead, gallery display residency or audio decoding.

Individual sources and focused generation requests supplied the library; no one-shot scene or all-assets sheet supplied these 50 roles. Native export/crop metadata keeps object bodies, screens, lenses, cable segments, bridge hinge/deck, lift/indicators and banner roller/cloth/weight independently usable. Lift P09 is center-cropped to the existing 96-world-pixel deck; bridge P07 is cropped to its existing width. Do not stretch a large source to change physical dimensions. B04 uses the targeted `B04-shell-depth-v2` replacement; earlier sources remain review history. Chapter 01 records the selected B03 portrait placement and visual hierarchy.

The reconciled private `actual_counts` now records `planned` 50, `generated` 50, `source_exported` 50, `integrated_candidate` 50 and `final_accepted` 0. These are successive stages for the same 50 roles and must not be summed. Earlier counters are archived in `countHistory`; each candidate preserves its earlier source-review status as `sourceStatusBeforeIntegration`. The refreshed runtime receipt points to the current composed-scene review and clean raw-poster-v4 selection. The scene/preview manifests retain exact selected paths/hashes, while earlier source/derivative/capture history stays separate. No integration count is relabeled 50 final public approvals. Chapter 09 links the native and composed-scene evidence.

<a id="earlier-room-repair-source-v16"></a>
## Earlier room repair · source v1.6

The complete library still contains 50 independently generated and exported roles. The repaired local world uses 35 of those source roles in five principal rooms and four connecting thresholds, with 166 placement records plus stateful assemblies. The remaining 15 images are retained as available material. Loading a texture does not prove that it is visibly used, and a repeated wall bay does not count as another generated asset. Final accepted world roles remain zero until the whole experience is accepted.

The rigid P06 cable picture is replaced by separately rendered anchored fibers and fixed metal eyes. FG10's mismatched stair picture is replaced by shallow native FG01 caps aligned with actual 8 px-rise / 24 px-tread geometry. P19/P20 stay reserved while boss work is deferred. The lift now uses a full 192 px deck, registered fixed rails and moving guide shoes. The banner uses a native cropped/tiled 320×368 px cloth, 345 px roller and 320 px weight, with its DOM links aligned to that same surface. These construction changes preserve the source pixel scale and do not inflate the source roster.

The ordinary route is verified from Arrival to Support and back, with all 44 main stair pieces covered in both directions, no unwanted airborne states or extra landing events, and zero lift carry error. The optional service crossing requires a deliberate jump onto its ledge; normal walking stays below it. Local verification is distinct from public deployment and artistic acceptance. Lighting, sound, first-arrival previews and final device checks must remain aligned with the installed revision.

<a id="superseded-flat-platform-checkpoint-source-v17"></a>
## Superseded flat platform checkpoint · source v1.7

The bracketed FG01 raster is now reserved, including its historical `causeway` alias and untouched 480×70 export. `game/platforms.ts` supplies the FG01 structural role as a code-native continuous slab: thin pale cap, quiet fascia, sparse wear anchored to world coordinates, and end caps at actual gaps. FG03 pier images remain active; their attachment plates are separate and occur only at the authored supports. FG10 remains a reserved raster. Its current stair role shares this code-native material at the exact existing tread coordinates, rather than using the former cropped FG01 image.

The library still has 50 generated/exported images. Current raster participation is 34 source roles, with16 reserved images; the scene still loads the complete library. Code-native slab/stair construction is documented as replacement use of existing roles, not extra generated pieces. The current scene has165 authored image placements after the mechanical bridge revision removed its obsolete side railing. Repeated strips, supports, shader geometry and animation frames do not increase the inventory.

Actual desktop, ultrawide and phone-emulated captures show the floor continuing cleanly across long runs and the first staircase. The main-route bridge revision now has a real gap, which this renderer leaves open. These are local appearance/mechanical checkpoints with final whole-experience acceptance still open; the earlier compact-map and raised-service-crossing descriptions above are history.

<a id="generated-fg01-v4-material-source-v18"></a>
## Generated FG01 v4 material · source v1.8

FG01 has returned to active raster use through a new480×72 continuous material export. Its generated raw image is cropped to the actual opaque strip, excluding baked checker pixels and visible outer boundary bars, then reduced with the existing native-grid pipeline. The selected interior crop passes a three-repeat seam review and actual desktop/ultrawide/phone inspection. The full-width crop was rejected because it repeated a dark end seam; neither variant uses painted or copied seam edges.

The `causeway` alias now resolves to `/world/assets/FG01-continuous-v4.png`. The old bracketed v3 export remains reserve/history. Code owns placement, exact collision crops, true end faces and separate support attachments; the visible cap/fascia is generated imagery. The shared stair role also uses native FG01 v4 pixels, while the complete FG10 raster remains reserved. The intermediate flat code fill was rejected as inconsistent with the generated materials and is superseded. FG01 v4 replaces the same source role; it does not add another role or revive the interim34-image count.

<a id="p21-and-native-hardware-current-source-v18"></a>
## P21 and native hardware · current source v1.8

P21 is a separately generated fixed bridge mast, exported at58×164 native pixels from its inspected keyed643×1811 subject. Its measured local socket(30,34) is placed at(-54,-164), preserving the existing fixed eye(-24,-130) and foot at y0. The raw source is unchanged. Three key/crop derivatives come from that one generation; the first two retained visible fringe and were rejected. The selected runtime file is `/world/assets/library-v1/P21-bridge-mast-v1.png`. The native source body replaces the earlier rectangle mast without changing the hinge, rope, deck, collider or timing.

Lift crossmembers, bank anchors and carriage brackets reuse cropped FG05 material; P10 supplies native rail heads/feet, guide spans, mounts and moving shoe housings. P04/P10 material supplies the banner pole, base and latch housing. These independent pieces remain at scale1 and preserve their separate state ownership. Small contact/lever/light pixels and rope rendering remain procedural; they are not substitutes for the major material bodies and do not require separate generation.

The reconciled library is10 foreground,21 props,10 middle and10 background sources:51 total,36 participating raster roles and15 reserved, with165 scene-image placements plus native assemblies. All51 library textures currently load, but they are not all visible together. Native cropping/repetition, FG01 variants, generated light fields and animation frames do not inflate these counts. Whole-experience final accepted count remains0.

The private `source/material-replacements-v1/GENERATION-REQUESTS.md` retains the exact separate generation briefs/references; the export receipts preserve source hashes, crop/alpha rules and registration. `prototypes/hardware-material-v1/REPORT.md` records actual desktop material/state inspection,11 native checks and four phone-emulated material captures. These are scoped local proof, not public delivery or physical-device approval. The previous flat-body and bracketed-platform states remain preserved history.

The current loading/Browse plates are v10, derived from the actual v9 canvas captures after the generated platform/hardware and lighting changes. The approved NEAREST export uses 1280×512 wide and 750×1002 portrait samples, then lossless WebP encoding, while preserving each world rectangle, anchor, camera bound and home-signal location. The gallery plates remain neutral, with personal art confined to the live DOM exhibit. The private v10 verification (private asset-authoring root) records the transformation, map/scene/renderer hashes and 1,732,554 total selected bytes. Full-resolution v9 and earlier v8 plates remain preserved; this compact export is not public-deployment or whole-experience acceptance.
