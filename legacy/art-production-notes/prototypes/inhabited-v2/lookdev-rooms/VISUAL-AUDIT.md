# Inhabited v2 room lookdev — 2026-09-08

The small-character / monumental-world proportion works, and the continuous floor material still reads as one surface. The current room composition is not visually ready: repeated structural bands flatten the exteriors, the interiors hide much of their generated art behind opaque walls, and the new arched frames do not fit the old moving door leaves. These are assembly problems that should be corrected before spending on another broad asset batch.

## Evidence and scope

- `all-11-entry-rooms.png`: all 11 rooms at 1600×1000.
- `centre-room-details.png`: Hearth, Treasury, Reservoir and Gallery centre compositions.
- 18 individual PNGs: 11 entry viewpoints, four explicitly reframed centre viewpoints, three 390×844 portrait samples.
- `receipt.json`: room/camera snapshots, final source hashes, no page errors in the completed capture. A later read-only comparison found none of the seven recorded source hashes changed.
- `capture.mjs`: private Brave headless lookdev harness using the actual WorldScene, Environment, lighting, map, actor assets and scene-assets-v2. It uses explicit room commands and labelled centre-camera reframing. No player-coordinate injection. These captures are not traversal, full App entry UX, mobile controls or public acceptance proof.
- Personal illustrations are intentionally absent from this bare canvas; neutral exhibit plates are correct here. Centre cameras can leave the actual entrance-position hero outside the frame. That is a declared framing method, not a missing-player defect.
- Two earlier harness import/module-identity errors are preserved separately. They were not world failures. Browser closed after captures.

## Priority corrections

1. **Remove the rectangular warm wash and reveal authored interiors.** `Environment.buildRooms` draws a flat support-room rectangle at `(room.x+width*.38, floor-390)` with width `width*.31` and height390: Hearth868×390; Treasury1054×390. Its boundary is conspicuous in both desktop and portrait. Replace that backing with an actual wall/recess/material composition and bounded light falloff. Several existing generated placements are hidden by the opaque depth−44 backplate: Hearth M04 at depth−50, Treasury M10 at−60 and M04 at−44 (created before the backplate). Correct their intended layer/occlusion role; changing inventory counts would not fix visibility.

2. **Recompose the exterior depth rails.** The apparent haze bands are largely authored structural sprites: M01 has straight top/bottom rails and is stretched from960×137 to2920×370 in Arrival at alpha.33; B05 adds another full-width straight beam. Their overlapping translucent lines cross the landmark at similar values. Source PNGs have actual alpha apertures; this is not evidence of alpha-decoder failure. Keep one dominant silhouette, choose non-competing midground framing, let supporting piers extend into occlusion/depth, and preserve negative space around the hero. Avoid solving this with more all-over fog.

3. **Make the door a single registered assembly.** `V2-P02` visual frame is170×230 at depth7, while `RoomDoorway` still draws an80×144 pale FG08 leaf and old posts/lintel at depth12. The exposed top semicircle and industrial sheet look unrelated to the arch. Author one aperture/leaf/hinge/crop contract and use it for closed/opening/open states. Separately, `*.FG08` foreground columns are120×725 placed at floor−800: their bases stop75px above the floor. They overlap entry arches and look suspended. Move, extend or attach them structurally; do not merely reduce opacity.

## Per-room findings and next action

| Room | Observed defect | Targeted action |
|---|---|---|
| Arrival | Monumental viaduct is strong, but several straight translucent rails bisect it; the near arch and large pier bottoms end abruptly in open air. Portrait preserves the small hero but makes these cutoffs especially obvious. | Keep the viaduct as focal silhouette. Lower/remove competing M01/B05 rails and conceal/extend pier endings through designed depth. Keep the current floor continuity and hero size. |
| Junction | Three nearly identical pale door panels cluster across one entry view. Foreground FG08 overlaps the left doorway and ends above ground. Backdrop rails cut across arch/doors. | Distinguish door surroundings and destination cues through structure/light, register their leaf states, ground foreground columns. Retain the connected shallow staircase. |
| Dispatch | Entry is a long repeat of flat outlined bays, with a column passing over the door. No strong workshop/product focal composition is visible from entry. | Reveal authored recess/material layers and stage the product light/terminal as a visible destination; leave approach space rather than uniformly filling every bay. |
| Arena | Entry composition is almost identical to Dispatch because both use `kind:dispatch` wall/bay construction. No arena-specific backdrop focal structure. Boss intentionally not spawned by this lookdev entry. | Give the fight space a distinct large-scale silhouette/backwall and controlled central light. Preserve native combat silhouettes and usable ground; assess boss motion separately. |
| Hearth | Huge warm rectangle and general haze dominate an otherwise empty hall. Counter is correctly floor-registered at244×42; resident is left of it, not working behind it. | Remove rectangular backing, expose/author the recess, place the service resident relative to a deliberate counter opening/behind-counter depth. Keep a warm local pocket and surrounding quiet space. |
| Treasury | Same rectangular light wash; a tiny resident and donation box carry almost the whole room. Intended M10/M04 generated structures are hidden behind opaque backing. | Resolve depths first; create a distinct ledger/treasury working area with existing lawful assets and actual service anchor. Keep warm mood restrained. |
| Lookout | The giant monolith and bench create the best clear scale cue, but repeated horizontal translucent beams flatten its depth. | Preserve the monolith/bench relationship. Remove competing midground rails and protect the lighter negative-space opening. |
| Reservoir | Multiple giant arches at similar contrast overlap, some ending in open air. The real bridge gap and native rat silhouette remain legible. | Choose a dominant structure and separate the others through placement/occlusion/value. Keep bridge opening/hinge/cable silhouettes unobstructed. |
| Gallery | Hanging FG08 pillar stops75px above floor beside the entrance; repeated rectangular clerestory windows make a flat wall pattern. Existing M04 looks like another suspended empty frame. | Ground/attach structural members and vary the room through actual wall depth and light rhythm. Do not add personal art to the canvas to mask composition problems. Inspect final DOM artwork separately. |
| Archive | Entry reads as an empty dark hall with a thin terminal and folders. Generated architectural/shelving layers are behind the opaque wall, and the entry column overlaps the door. | Make shelf/recess architecture visible and registered, then focus the terminal/article grouping. Keep the Archive access free. |
| Return shaft | Lift and upper docking geometry are clear, but FG08.078 passes through the upper doorway/platform region. A large hard ceiling band dominates the upper half. | Reposition/attach the column outside the door silhouette, articulate the shaft backing with existing material, preserve both stops and192px deck geometry. |

## What should remain

- The hero stays small against the environment. Native cast proportions are readable without giant scaling.
- Continuous generated FG01 floor material has no conspicuous short end-cap repetition in these captures.
- Gallery spacing leaves room for actual display-only illustrations; blank plates in this harness are expected.
- Reservoir bridge and Return shaft lift have distinct, readable physical silhouettes.
- Lookout's bench / huge monument contrast is worth preserving.

No production source, images, manifests, map or document exports changed during this audit. No visual approval or final release claim is made.
