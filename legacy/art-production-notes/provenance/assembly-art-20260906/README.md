# Native assembly art integration — 2026-09-06

**Bounded integration complete and locally verified.** Only `site/src/worldsite/game/assemblies.ts` and new `assemblyArt.ts` were changed. The world owner retains WorldScene, collisions, hero, asset loading/manifest, placement/composition and effect events.

## Asset bindings and pixel treatment

All image parts use native texture frames at scale1. No `setDisplaySize`, `setScale`, rotation or pixel-density fitting was introduced. Root camera sampling remains the shared world-scale owner. Metadata comes from the registered scene-manifest `parts`/`attachments`, with current approved coordinates as fallbacks. Repeated crops/parts do not create additional inventory roles.

| Assembly | Native sources | Registration / state |
|---|---|---|
| Terminal | P02 alias`terminal`, P03 |23×96 housing; P03 glass crop(1,4,11,13) sits in P02 aperture(6,15,11,13). Static housing, independent glass, existing graphical light and status pixel. Panel active→200ms returning→intact. |
| Home | P04, P05 |27×112 post at integer bottom origin(13,112).12px lens placed at(8,8); native bezel crops remain opaque while independent emission changes brightness. |
| File | P12 |32×20 native folder, bottom-centered. Titles and links remain DOM-owned; reading never consumes the image. |
| Gallery bay | P14 |110×176 native frame with separate neutral dark backing at aperture(9,9,92,153). **No personal artwork texture enters the world.** |
| Donate plinth | P15 |49×56 native body, independent plaque highlight at(16,15,16,10). No payment facts or QR baked into art. |
| Banner | P16, P17, P18 |185px roller and160px bearing; full160×214 cloth reveals by texture cropping. Separate160×7 weight follows the revealed lower edge. Cloth top=-221, weight bottom=0 when fully open; roller top=-233. Existing DOM anchor y-102 remains near the cloth center. Low release cord/fastening keeps slash contact readable. Existing0.42/0.22 presentation clock retained; explicit open/rolled settled phases. |
| Cable | P06 |23×176 source split at cutY146 into native146px fixed upper and30px released lower. The fixed crop stays unchanged; lower part falls/fades with integer translations, or disappears immediately under reduced motion. |
| Bridge | P07, P08 |P07 native256×21 is cropped fromx0 tow110 for the existing110px collision span. P08 bearing uses registered pivot(13,31). The existing vertical lowering mechanic and collider are unchanged. |
| Lift | P09, FG04, P11 |P09 native192×23 is **center-cropped x48,w96** to the existing96px platform. Native FG04 railing end/span crops compose a96px rail without stretching. Separate P11 bezel/emission moves with the deck. |
| Lift landings | P11 |Native28×9 indicators on existing supports. Visual brightness follows linked lift state/location through the named assembly's published visual data; no gameplay ownership is moved into painting. |
| Cut seal | Narrow P17 crops |Two12×24 native paper fragments over the existing neutral doorway backing. Root explicitly permitted this reuse. P13 is a shelf cabinet and was not misapplied as a seal. |
| Ornament | P05 |Native small lens with independent bezel/emission on the existing cord. Cut pieces fall/fade; no new effects are emitted here. |

Structural flat backings, small support/cord geometry, highlights and fallback shapes remain graphical parts. They are not extra generated assets or personal-art substitutes. Missing textures retain the old functional fallback shapes and are named in the optional art diagnostics.

`assemblyArtSnapshot(a)` is a read-only export that reports actual part asset IDs, source rectangles, image dimensions/scale/alpha/position, cloth clipping and missing-role names. The world owner may include it in existing diagnostics; it exposes no mutation API.

## Native evidence

`probe.mjs` used normal header navigation, Enter world, A/D walking, E, J, Close, Menu and Resume. It did not teleport, set object states or inject time. All23 canvas-only PNGs were read from the actual canvas on the rendering animation frame; they exclude DOM overlays and gallery imagery. PNG nonblank checks guard the capture route.

- Cable cut and lowered bridge reached their original logical states (`cut`, bridge`open` aty604).
- Banner reached open/amount1 and closed/amount0 with correct settled phases. The full cloth and separate weight align above the floor in `08-banner-open.png`.
- Terminal E opened Downloads. `terminal-phase-verification.json` samples real frames through native Close and observes **panel_active, returning, intact**. The initial80ms-plus-PNG attempt missed the short returning phase; `12-terminal-returning.png` actually shows an already-idle frame and is superseded by `terminal-returning-sampled.png`.
- Documentation/file, Gallery bay and Donate plinth E routes opened their normal DOM panels. The canvas-only gallery captures16/17 remain neutral even while the separate viewer is open.
- Lift movement carried the player at exactly the deck's logical Y; Menu froze it aty622.4; Resume reached upper stop360 with the player on the platform. Native cap, railing and indicator move together. Screens20–23 show the sequence.
- No runtime page exceptions occurred. Final TypeScript noEmit passed. All probe browsers were closed; Vite remains running.

The first terminal phase sample exposed a coordination detail: WorldScene's newer Resume handler already cleared panel_active to intact. The local art presentation now detects that handoff and retains its200ms return fade without altering input/outcome behavior. This was proved with frame sampling, not by lengthening the animation to suit a screenshot.

## Composition handoff / known boundary

The source assets and native prop assembly look coherent in the captured scene. Global background silhouettes, floating structural joins, camera composition, loading posters and publication remain world-owner work.

One existing WorldScene presentation issue was reported to root: the banner's strike can remain frozen over its open cloth because the world pauses while the attack is active (`08-banner-open.png`). The world owner should finish/cancel the consumed slash presentation or advance its visual recovery separately. This lane did not alter WorldScene to hide it.

No raw source images, public manifest, map, hero, effect routing, DOM controls, hosting or unrelated files were changed. No generation, provider spending, commits or pushes occurred.
