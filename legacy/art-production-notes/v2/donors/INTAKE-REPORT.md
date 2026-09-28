# V2 authored cast and UI intake

2026-09-08 · New2.1 go received. Seven original free acquisitions total11,599,845bytes. No paid extras, provider generations, packages, installers, user artwork or runtime code were used. The original Martial Hero sheets were not changed. Downloads followed the creators' normal free gates; source pages and hashes are retained beside each original.

## Selected and published to the source checkout

These are files in the candidate source `public` directory, not a promotion to the running dex.place release. Existing asset URLs and published documentation1.0 were not overwritten.

| Asset | URL / actual native format | Result |
|---|---|---|
| Wizard2 | `/world/cast-v2/wizard2/`;250×250 cells;8 clips | Primary boss. Native cloak body about36×55px, pivot125,167; the much taller staff flame is not its hurtbox. Same1× source pitch as52px hero; no giant scaling. |
| Rat | `/world/cast-v2/rat/`;70×70 cells;5 clips | Ground mob, approximately40×20 visible body, pivot35,45. Idle10/walk8/bite12/hurt3/death6. |
| Bat | `/world/cast-v2/bat/`;87×87 cells;6 distinct source clips,7 clip IDs | Flight/attack11, hurt3, transition3/fall5/death4. Idle/walk share the same authored flight imagery. Flight reference49,62; **fall bottom72 and death bottom55** need the supplied per-clip pivot. |
| Four townsfolk | `/world/cast-v2/townsfolk1` through4 | Hat-man39×52, woman37×46, bearded40×47, oldman34×42 cells. Native visible bodies roughly40–45px; idle/walk only. All feet/pivots/alpha bounds are in manifest. Some original walk frames lift feet by1px; no per-frame trimming was applied. |
| Small fire | `/world/cast-v2/small-fire.png` | Original100×156 sheet,10×26 cells,10columns×6rows=60frames. Modest hearth-flame candidate; housing, world light and scene timing remain separate. |
| Two UI frames | `/world/cast-v2/ui/steel-frame.png`, `paper-frame.png` | Original32×32 thin-outline Kenney parts. Proposed6px slice inset; no finished CSS menu or flattened text. Root owns actual UI acceptance. |
| m5x7 | `/world/fonts-v2/m5x7.ttf` | Original34,300-byte CC0 font selected for compact short labels. Font manifest records missing glyphs and usage boundary. Monogram remains private reserve. |

Main manifest `/world/cast-v2/manifest.json` SHA256: `85124f9a5b77b8bc97c01f9a272f27686664385794f9ec4398e16a877a3ca22a`. All31 published PNG files are byte-identical to a named PNG inside a retained original archive; the audit records the mapping. They total126,987 encoded bytes and13.499MiB of width×height×4 source surfaces, including separately named duplicate flight files. This is not actual GPU/process residency. Combined with the earlier45.582MiB estimate it leaves little room before64MiB, so the expanded world needs its current loading/residency review.

## Schema and contact contract

`actors[]` contains stable id, role, creator/licence/source page/archive hash, scale, footX/Y, relative body rectangle, facingDefault, clips, attackWindows and review status. Frame coordinates are native pixels; body x/y is relative to the pivot; contact windows are zero-based and end-exclusive. Every clip includes URL, frameWidth/Height, frame count, durationsMs, loop/holdLast, per-frame alpha bounds, bytes and hash. All selected sheets face right by native visual inspection.

Wizard `attack` maps to original **Attack2**, its descending dark arc. Pose-derived candidate contact is frames4–6,570–840ms with the initial timing. `attack2` maps to original **Attack1**, forward/upward frames3–5,420–690ms. Rat bite candidate is7–9; Bat's visible white swipe appears8–9. These are animation-pose candidates, not accepted gameplay damage rectangles. The gameplay agent received the actual mappings and must verify attack anticipation, real contact, recovery and the complete death-to-black/menu handoff in the world.

The bat's initially estimated death pivot was wrong and was corrected before the final audit: its actual death alpha bottoms are55 in all four frames, not the earlier approximate77. `clipPivots` now records death49,55 and falling49,72. The gameplay agent was explicitly notified; a corpse floating over the floor is not accepted. Flight-frame wing extent is not the creature's collision body.

## Native comparison evidence

`inspection/wizard2-all-frames.png`, `rat-all-frames.png`, `bat-all-frames.png` and `npcs-2x.png` were visually inspected. `native-clips.json` and `npcs.json` contain exact dimensions/counts/alpha extents. Standalone browser playback then compared the original images at1× and2× on one floor beside the existing hero reference. Five phase captures and frame samples are in `inspection/browser-*.png` and `browser-preview.json`. This is a native asset browser, not the actual level, controller or complete runtime-fit proof.

Wizard2 already reads at native scale, so Wizard3 was not downloaded merely to expand the pile. Rat and bat supply visibly different grounded/aerial silhouettes. The townsfolk have natural side-view proportions; hat-man is the closest visible-height match, while the other figures can serve sheltered side spaces without enlarging their pixel clusters. No custom recolor, generated character frame, retouch or visual source conversion was applied.

The font comparison was rendered in the same browser. Both m5x7 and Monogram Extended lack the tested Vietnamese `ặ`, `ễ` and dong sign `₫`. Use the existing readable body font for account names and money; do not silently replace user characters or rely on a pixel font's general “accented letters” claim. `inspection/font-review.json` records actual cmap coverage for the representative strings.

The fire's60 cells and Kenney's thin frame variants were separately inspected in `fire-2x.png` and `ui-thin-3x.png`. Fire playback starting at80ms/frame is a proposed calm loop, not a creator timing claim. Steel and paper frames are native-reviewed material candidates; actual9-slice, focus, enlarged text and layered UI tests belong to root.

## Licence and free-tier evidence

- Wizard2 original archive `License.txt` explicitly statesCC0 and personal/commercial use; retained separately.
- Monsters2 contains no separate licence file. The creator page explicitly grantsCC0; its actual native files were inspected and the page/source record is retained. It supplies the required rat/bat states without a paid addition.
- Gothicvania's actual `public-license.pdf` was extracted privately and read using the already bundled PDF library; it expressly grantsCC0 to package art. Its music folder additionally carries a Pascal Belisle attribution notice. **No music, fonts, demo code, PSD, title screens, metadata resource forks or entire environment were published.** Paid Town Plus was never acquired.
- m5x7's creator metadata namesCC0; Monogram's actual TTF also embeds itsCC0 notice. Creator-page evidence and original font hashes are retained. Only m5x7 was published.
- Fires' creator explicitly grantsCC0; only the single selected original PNG is published. The separate paid Animated Effects product was not acquired.
- Kenney's actual archive licence identifies UI Pack–Pixel Adventure2.0 andCC0, despite the source page's older1.0 update label. Only two selected original tiles are published; the500-file pack itself is private.

Original download receipts are `*/download.json`; `acquired.json` records the first six and `kenney-ui/download.json` the seventh. No temporary signed download URL, cookie, account token or payment detail is placed in the public manifests.

## Remaining authored roles and handoff

The cast pack does not contain a new bespoke greeting/record-handover/work cycle at this world's scale. Four residents provide idle and locomotion, with small source gestures such as the oldman's bend/bag sequence. A service panel can use an existing idle response, but a promised handover gesture needs explicit authored animation/prop coordination. Do not invent a source clip or use idle movement as proof of it.

Root still owns the map support/fastening, severed cable ends, falling/unfurling/settled map body, door leaf/latch/frame/interior transition, counter/service prop and deeper room materials. The tiny fire needs a physical housing and restrained light. Those gaps were sent to root while gameplay received the usable cast early. Public-native asset review does not claim any of those stateful assemblies are complete.

Reproducible candidate export order: `publish-cast.py`, `publish-details.py`, `publish-ui.py`, then `final-audit.py`. The details pass adds the bat per-clip pivots and small-fire metadata; do not rerun only the first script and accidentally drop them. `intake-inventory.json` is the full audit/provenance record. All acquisition/preview browsers and the temporary local preview server closed. No commit, public deployment or change to another agent's runtime modules occurred.
