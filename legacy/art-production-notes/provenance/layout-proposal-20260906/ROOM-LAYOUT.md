# One proposed layout: five rooms along a ruined waterfront

**Proposal only. No live map, game, scene manifest or owner documentation changed.** Dex's latest direct review supersedes previous taste acceptance: the clustered layout, exposed stairs and disconnected props/cut states need another composition pass. Boss/arena work waits.

Build one **14,400 × 2,304 world-pixel map** (900 × 144 tiles at 16 px). Keep the 52 px authored hero and current pixel scale. The world becomes a sequence of large places, with one primary installation per room and substantial architecture around it. The four existing tabs still take visitors directly to their destination; walking the whole world is optional.

The present map is 3,840 px wide. With the existing camera, a 3440×1376 world frame sees about 2,550 world px. Downloads is only 655 px from Home; Archive and Exhibition have nearly the same x and only 680 px of vertical separation. This makes multiple destinations share one view regardless of extra decoration. In this proposal adjacent main anchors are 2,800–2,900 px apart, so even that wide view cannot include both primary installations.

## Room envelopes and safe arrivals

Coordinates are world pixels; y increases downward. Each anchor has at least 192 px of uninterrupted ground around it and sits clear of transitions. Main interaction roots sit about 60 px to the right of their arrival anchor, within the existing E reach.

| Place | Main room x envelope | Floor y / ceiling | Anchor x,y | Main installation and reading |
| --- | --- | --- | --- | --- |
| Arrival | 400–2,500 | 960 / open sky | 1,500,960 | Small traveler, one signal post at 1,560 and a bench; water and a distant spire do the large-scale work. Wayfinding banner belongs near the exit at 2,250, away from the spawn grouping. |
| Dispatch / Downloads | 3,400–5,300 | 960 / ceiling around 240 | 4,400,960 | Terminal at 4,460 installed in a service counter/wall bay. Gantry and a low side service platform explain the industrial props. The optional cable/bridge mechanism belongs here after its state assembly is repaired. |
| Archive / Documentation | 6,200–8,100 | 1,120 / ceiling around 480 | 7,200,1,120 | Terminal at 7,260; two filing bays, one on either side. Six physical files keep separate x positions and remain within E's vertical reach on low shelves. No row of loose files across an outdoor floor. |
| Exhibition / Illustrations | 9,000–10,900 | 832 / roof around 40 | 10,000,832 | Main gallery bay at 10,060 and the existing second bay farther along, around 10,480. Tall roof and soft skylight define the room. Frames attach to wall bays; personal artwork remains in the Illustrations viewer. |
| Support / Donate | 11,800–13,900 | 960 / ceiling around 250 | 12,800,960 | One plinth at 12,860, physically seated in a quieter alcove. A large opening onto water/cliff and one warm light make the destination distinct. No new constellation of props around it. |

The 1,900–2,100 px envelopes are architectural rooms, not prop carpets. Furnish the usable floor mainly within about 600 px of each main anchor. Preserve empty wall, ceiling, distant view and structural mass elsewhere. At the existing 148 px/s walking speed, anchor-to-anchor walking is about 19 seconds before the lift ride; the full optional route is roughly 90 seconds. Direct tabs remain immediate.

## Continuous routes and thresholds

```text
Arrival y960 → covered gate → Dispatch y960 → enclosed descent → Archive y1120
    → enclosed lift rises 288 px → Exhibition y832 → enclosed descent → Support y960

All five main rooms progress left to right in the map.
```

| Connector | Concrete route | Visual separation |
| --- | --- | --- |
| Arrival → Dispatch, x2,500–3,400 | Level floor y960. Wide approach narrows through a service gate, then opens onto Dispatch. | Two thick piers and a ceiling create a 900 px covered threshold. A small rear slit preserves waterfront continuity. The next terminal is not visible from the Arrival anchor. |
| Dispatch → Archive, x5,300–6,200 | Level to x5,520, then 20 solid steps with 16 px treads/8 px rises to x5,840, y1,120; broad lower landing to x6,200. | This is inside a heavy wall section with a low lit passage, not an outdoor diagonal crossing the vista. End piers/roof mask the outside rooms; the walking band stays visible. |
| Archive → Exhibition, x8,100–9,000 | One existing lift at x8,600, width128, stops y1,120 and y832. Lower approach ends at the deck's left edge x8,536; upper exit begins at its right edge x8,664. Call points around x8,470/y1,120 and x8,730/y832. | Full-height shaft structure, fixed rails, flush landings and one dock indicator per stop. The 288 px ride is about 9 seconds at current speed. It visibly transfers the traveler to the skylit hall. No second lift or new control. |
| Exhibition → Support, x10,900–11,800 | Level to x11,180; 16 solid 16 px treads/8 px rises descend 128 px by x11,436; generous flat landing continues into Support. | A short enclosed maintenance passage makes the room change legible. Support's warm opening appears after the exit pier. |

Use existing walk/jump/E. Every required ascent/descent is walkable or lift-carried; no repeated jumping to climb a one-way stair chain. The existing movement code auto-steps **solid** risers up to 16 px, while one-way stairs bypass that horizontal step logic. Use 8 px solid risers, generous flat landings and one stair construction that visibly matches those dimensions. Do not paste the current four-step illustration across dozens of 8 px collision strips.

Opaque room backings and thick portal piers are essential. An arch silhouette alone does not divide a room. Use a real wall mass with a cutaway opening, a roof over the travel band and far scenery clipped to deliberate apertures. Foreground strips may frame the passage, but cannot cover the hero or E prompt. Camera anchors should show their room's installation first; short connector bounds can contain a transition without revealing two complete content rooms. These are scene/camera constraints, not loading doors or new navigation mechanics.

## Reuse the library selectively

Keep one common material family: subdued blue-grey structure, worn cream cap/trim, dark metal fittings and restrained warm/red functional light. Room identity comes from architecture, light and openings, not five unrelated palettes. Foreground assets retain native logical scale; do not enlarge a 560 px arch to span an entire 2,000 px room. Build large forms from structural masses and native repeats/crops, with larger middle/far pieces behind them.

| Existing roles | Use in this layout |
| --- | --- |
| FG01/02/03/04/05/08 | Shared cap, end cap, pier, railing, girder and edge/pillar construction. These are the dependable structural vocabulary to establish first. |
| FG06/07/09 | One arch at an actual threshold, broken ledge only at an exterior edge, rubble only where the surrounding structure explains it. Avoid decorative rubble at every destination. |
| P01–05 | Bench, terminal housing/screen, signal post/lens. Install them against supports and keep their relative native scale consistent. The terminal material family is the reference for service hardware. |
| P09–11 | One complete lift inside its shaft. Fixed rails attach to shaft structure; deck and its indicator move together; landing lights stay on their own landings. |
| P12/13 | Archive filing bays. Keep the shelf's required separate dark backing; mount files low enough for the current E interaction rule and at distinct x positions. |
| P14/15 | Gallery wall installations and Support alcove focal object. Their surrounding architecture does most of the differentiation. |
| P16–18 | One wayfinding banner near Arrival's exit, with roller, cloth and bottom weight registered to one mount. Do not sprinkle unrelated hanging panels across the route. |
| M01/07/08 | Dispatch's gantry, trestle and service catwalk, kept behind the playable plane. |
| M02/04 | Archive wall bays and light well. |
| M03/05 | Exhibition recesses and roof span. |
| M06/10 | Support opening and monumental rib. |
| M09, B01–10 | Exterior pilings, sky, haze, water, reflection, spire, cliffs and distant shells. Select by each room's view opening; do not show every distant landmark behind every room. |
| P19/20 | Preserve in the library; boss/arena work is deferred. |

The 50-role inventory is a useful library, not a requirement to place all 50 in one visible composition.

## Pieces that genuinely need correction

1. **P06 + P07 + P08 as an installed cable/bridge set.** P06 currently reads as a rigid braided rod with a ring; the large hinge and cut crop do not tell a coherent load/attachment story when scattered around the floor. Rework the intact/severed state and endpoint registration together before returning this set to the focal path. Preserve the existing lowering-bridge action; do not solve the problem by inventing another mechanism. The optional Dispatch service bay gives it a purpose without making the main route depend on it.
2. **FG10 as a route kit.** Its native four-step block has a different rise and structural silhouette from the current chain of tiny cropped collision treads. First author the small solid riser/landing geometry and derive a matching cap/stringer kit from the existing structural material. Only request a replacement image if that controlled construction still looks poor in the room. No more long exposed diagonal strips.
3. **P01/P12/P15 need restrained placement before another generation pass.** The bench can read as a loose bar, the folder as a blank block, and the plinth as a generic pedestal. Proper supports, backing and grouping may fix their reading. Do not accept them merely because alpha cleanup passed, and do not regenerate all props before testing one fitted bay.

This should begin with structural reuse and at most a targeted cable/state and stair correction, not another 50-image batch.

## Necessary implementation seams for root

This cannot be achieved by changing map coordinates alone. Current `Environment.buildInterior`, foundations, lights and waterline are absolute-coordinate drawings; `cameraFrame` does not consume room bounds; and non-boss recovery contains `x<1390 && y>820` plus a fixed left clamp. Those assumptions would misplace rooms or reject the new safe floors. Move those spatial facts into the room/connector records while preserving physics and control semantics. The terminal/lift instance creation itself is already map-driven.

The first composition test should be **Arrival, the covered gate and Dispatch**, at the widest camera and phone portrait. Require one primary destination installation per settled view, clear near/middle/far separation, and physically attached prop parts at native scale. Then build Archive and the shaft with the same materials. Keep the final Support/Exhibition polish and deferred boss work out of that first taste checkpoint.

QA43's private fixture exports remain paused at `provenance/qa43-repeatability-20260906`. Its 28 protected live/donor files matched their before hashes; no browser fixture was loaded and no repeatability acceptance is claimed.
