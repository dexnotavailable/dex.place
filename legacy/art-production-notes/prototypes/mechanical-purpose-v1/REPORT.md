# Mechanical purpose: bridge and lift

2026-09-07. **Implemented and locally verified; final integrated acceptance remains root-owned.** Design was recorded in `DESIGN.md` before edits. Before/after native screenshots and complete browser videos are preserved. No generated image, paid provider action, audio change, public deployment or CC0 character edit occurred.

## The bridge now changes the route

Before, both banks and the192px bridge sat64px above a continuous main floor. Native walking reached5156.9,960 with the bridge still intact; cutting it did not provide needed access. `before-under-bridge.png` and `before-receipt.json` preserve that failure of purpose.

The main floor now ends at4920 and resumes at5112; the same rigid deck is hinged at4920,960. Removed both raised service banks and the obsolete standalone side railing. The held state leaves a real192px gap. E and J still release the same physically registered rope; only the settled deck supplies a walkable surface. A bounded reset pocket beginning at y1024 sends an uncut fall to the existing Dispatch anchor4400,960. Direct tabs remain usable. No new control, gate or progression state was introduced.

Native proof in `after-receipt.json`:

- Held bridge was intact;43 simulation samples recorded a real fall inside the gap and safe Dispatch reset.
- E visibly lowered and settled the deck. The crossing produced117 simulation samples; all68 interior-deck samples were grounded at y960 with support `dispatch.lowering-bridge.01`.
- Menu → Restart world restored the held bridge. A separate native J slash released it again and changed the corresponding cable to cut.

The fixed hinge, original192px native deck, receiving bank bracket and attached rope remnants remain owned by HingedBridge. The map's cable point follows the64px vertical move; it does not define a competing cut volume. `after-bridge-held-gap.png`, `after-bridge-lowering.png`, `after-bridge-settled.png` and `after-bridge-crossed.png` show the actual states.

## The lift now reads as attached machinery

The former full P10-strip repeats displayed small hardware motifs along thin isolated rails. At mid-travel their ends had no legible common structure. The new assembly uses P10's native4px guide crop inside continuous fixed steel spines, joined by top/base crossmembers and brackets attached to the lower-left/upper-right bank. Short rigid brackets visibly connect the guide shoes to the moving deck. The source pixels are cropped/repeated at scale1; no stretched belt image or floating decorative strap remains.

Lift position8600, stops1120/832,192px deck, collision surface and movement/carry state machine remain unchanged. Its frame stays fixed while the deck, railings, lamp and shoes move as one carriage. Native ascent and descent each recorded563 occupied simulation samples, with zero rider-to-deck Y error. Mid-ascent Menu pause preserved both positions; Resume continued to the same stop. Both docking endpoints were reached correctly. Full-shaft and moving states are in `after-lift-shaft-lower.png`, `after-lift-moving-up.png`, `after-lift-upper.png`, `after-lift-moving-down.png` and `after-lift-lower.png`.

Eight meaningful native checks passed with no page errors. This is desktop browser evidence; physical mobile feel, the new double jump and final whole-site journeys belong to their separate verification lanes.

## Review media and final source boundary

- Complete before recording: `before-video/page@75bbec95b23c6faf6a577edf20f92046.webm`.
- Complete after recording: `after-video/page@f49126f64d28fdc2541c1146cd2dfc6d.webm`.
- `mechanism-proof-reel.mp4` concatenates after-video intervals3.8–5.8,8.2–12.7,27.8–38.1 and38.1–47.8 seconds. These show gap fall, bridge lowering/crossing and both lift directions at original speed; the full video preserves continuity. There is no generated or simulated replacement footage.

After this mechanical verification, root authorized one separate occlusion fix: `threshold.beam-support` moves from depth18 to3 so the real stairs/slab draw in front of it. Its source crop, coordinates and dimensions stay unchanged. The platform lane owns the fresh stair captures for that targeted change. Mechanical/map hashes in the after receipt remain current; its scene hash precedes only that remote depth-order change.

Current identities at handoff:

- `src/worldsite/game/mechanisms.ts`: `cb13255dca2ad5436a95703db1ba63b05418cbd7449773ea611aafc4dd973a91`.
- `public/world/maps/causeway.json`: `855827457de1bed23d3d540fd4d99deb13a13ef03b0d7070f17385c43aa15bb2`.
- `public/world/scene-assets.json`: `abd0f210bbd56d538f74c369bbf99659f6848a0fac388d44de970bb8dea01e09`.

TypeScript and scoped diff-whitespace checks passed. Only mechanisms.ts, map geometry and the two named scene-placement changes were edited by this mechanics pass. WorldScene, main UI, platform renderer, lighting and specification chapters were left to their owners. Root must refresh final previews/docs/inventory and integrate all lanes before final acceptance. The temporary5195 Vite process(PID51900) and all proof browsers were closed; shared5188 was used for the after proof and was not stopped.
