# Complete-room geometry review

All12 source room PNGs were inspected individually. Every source is1672×941px. The companion `room-geometry-review.json` contains source hashes, hand-estimated source-pixel footlines, traveller body/silhouette bounds, prop/door anchors, surface guides and per-room issues. These are **annotations for integration**, not automatically traced collision geometry or aesthetic acceptance.

No original images, runtime manifests, assets or game files were changed. The review produces only this file and the JSON record.

## Resolve before collision and layer integration

1. **Sky-walk bridge cannot currently reach.** The left hinge is approximately(725,676), raised tip(725,477), right receiver(1074,676): about199px of deck for a349px gap. A simple rotation leaves roughly150px empty. Derive a correctly sized single deck with contact overlap, or deliberately author a folding/two-leaf mechanism. Do not stretch the source mid-animation or enable collision across empty sky. Retain a meaningful cable attachment/release and a right receiver. Actual double-jump/dash reach also needs checking against the intended bridge requirement.
2. **Generated character size changes greatly.** The reference body is about72px tall in sky-walk and144px in registry. These images cannot all be copied at the same size while claiming one consistent generated traveller. Keep a single native52px actor scale/pixel pitch; deliberately choose common source-to-world mapping and camera framing. If room camera zoom varies, make that a considered transition and retest prop proportions. Do not use the per-room ratios in JSON as a command to stretch each actor.
3. **Feet do not stand at the front slab edge.** The glossy floors show depth; the illustrated walking line is usually behind the slab edge. Arena illustrates this clearly: footline≈757, rear floor boundary≈725, slab front≈819. A collider at819 sinks actors by about62px against the source. Use the annotated footline as the starting contact guide and inspect actual feet, jumps and doorway returns.
4. **Remove characters and their reflections/shadows together.** A clean base needs the underlying rail, wall and floor reconstructed. Otherwise live actors leave static duplicates or persistent reflected silhouettes.
5. **Use one master distant landmark behind the apertures.** Exhibit repeats the ring at unrelated curvatures/scales in the upper panorama, three windows and lower opening. These can become real view apertures over a shared landmark/background layer. Independently drifting those painted fragments would reveal the inconsistency immediately.

## Room contact and scale estimates

Coordinates below are source PNG pixels. Most floor/edge estimates have roughly±6px uncertainty; small prop/body bounds roughly±10px. JSON stores detailed bounds and anchors.

| Room | Illustrated footline | Front slab edge | Reference traveller height | Main integration observation |
|---|---:|---:|---:|---|
| Arrival |751|806|87|Safe continuous walk in both directions, central spawn. Remove reference figure/reflection; keep services beyond the first reveal.|
| Rest |706|754|101|Bench feet≈689; bench sits behind player lane. Left enclosure is an intentional rest destination.|
| Registry |692|738|144|Counter top≈613/base680; door threshold675. Counter/NPC/lamp, donation box and courtyard doorway need independent layers.|
| Junction |645|657|91|Main lane plus upper landing≈211 and lower archive landing≈862. Central column occludes paths and must not become a full-height solid wall.|
| Vestibule |702|719|119|Arena threshold≈685. Distinguish product selector from donation/rest box and resolve blank banner.|
| Arena |757|819|114|Flat clear fight lane; boss body≈219px. Remove both fighters/reflections before animated cast placement.|
| Archive |722|741|130|Both door thresholds≈638 require matching stairs and elevated return spawns. Reading desk/chair sit behind main walking lane.|
| Low passage |663|676|109|Two raised blocks have tops≈600and580; ceiling underside≈369. Keep floor under them and decide solid/one-way behavior explicitly.|
| Pool |748|770|77|Safe continuous foreground; water is behind railing. Bench/blue box at right; do not introduce an invisible swim/pit mechanic.|
| Sky-walk |669|679|72|Left walk ends≈718, right resumes≈1082. Bridge art is too short; fix its actual length before collision.|
| Exhibit |703|728|104|Nine independent apertures; bench behind walking lane. Each work gets its own inspection anchor.|
| Courtyard |692|716|114|Return door/latch at right, tree/bench at left. Shared tree/rail landmark must match earlier glimpses.|

The hero bounding boxes are visual estimates excluding most sword/cape extension; separate silhouette bounds include those extensions. They are not segmentation masks. The native52px baseline is the existing authored hero's visible idle height, not its200px source cell dimension.

## Functional decomposition notes

**Junction:** the central column spans approximatelyx402–531. Its front face and railings should occlude actors where appropriate while the intended main/upper pathways remain traversable. Trace actual tread surfaces or derive a smooth stair collision representation matching them; arbitrary stacked blocks repeat the previous stairs problem. The two left door views both show bookcases/counters: assign real destinations or simplify the redundant interior. The prominent hanging blank sheet must become the actual map with a reachable cut/release/inspect flow, or lose its false interaction emphasis.

**Vestibule:** retain the lectern beside the arena as the obvious product selection point. The left lectern may be the donation point beside the bench; a second unconfigured product menu would dilute the room. The blank wall sheet also needs a defined purpose or removal. The arena leaves, frame and central seal require separate parts and a clear opening for collision.

**Archive:** both entry doors sit above stairs. Do not place a returned traveller at the main floor height within a raised doorway. The long shelf wall can remain coherent set dressing, with a deliberate reading/record interaction at the table instead of treating every book as a menu. The donation box sits on the left raised side; check interaction reach from its actual step.

**Pool:** its water currently reads as a vast lake/ocean. That can work as the Registry's displaced pool opening into impossible water, but it is not a literal small indoor basin. Foreground blue tiling and changing acoustics can make the room distinct. Keep the existing image interpretation coherent when adding water motion.

**Exhibit:** JSON records nine outer-frame bounds, nine approximate inner apertures and nine ground-level inspection anchors. Aperture widths range roughly38–105px and aspect ratios vary. Use aspect-fit real illustration display; do not distort/crop artwork to fit arbitrary generated frames. Replace/enlarge a frame if its native preview is too small. Extract frame trim/backing so real work does not inherit generated paper or global fog/light grading. The lower ring/window repetition needs master-background reconciliation.

**Courtyard:** the visible right door handle/latch is around(1513,591). The scene can support the accepted shortcut payoff, but it does not supply the accountant's cup/standing/walking/sitting action. Preserve the bench/tree/rail identity and a clean NPC route. Door opening alone does not establish that its connection changed; its portal view/status and successful return must demonstrate that.

## What the frames support well

Arrival genuinely reserves its attention for scenery, with an ordinary walk strip and small central figure. The upper/outer rooms retain a recognisable sky/ring family. Registry and archive offer sheltered warmth; low passage provides the strongest vertical compression. These are useful composition anchors. Still, counts and matching colours do not settle movement, sprite registration, visible pixel consistency, interaction clarity or emotional pacing. Reconstruct and inspect those in the actual game before expanding decorative detail.
