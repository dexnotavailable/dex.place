# dex.place — current Registry game state

Updated2026-09-13. The authorised complete guest-game pass is built and locally reviewable at http://127.0.0.1:5195/. [GAME-BUILD.md](GAME-BUILD.md) owns scope and [GAME-INTERACTIONS.md](GAME-INTERACTIONS.md) records the actual controls/places/panels. Account integration, lower website and additional content await Dex's next guidance. The previous public website is preserved; no public replacement or commit/push was performed.

## Current scope

Arrival is central and scenery-only, with a subtle rightward floor inlay and an optional resting discovery left. Registry is beyond the right-hand first-camera reveal. The [evaluated floor plan](central-arrival-floor-plan.md) and [central arrival study](map-exploration/arrival-central-v2.png) were realized as twelve independently composed rooms. The full-map anchor defines connections and shared landmarks, not literal room dimensions.

Focus on the playable2D world, story, level design, characters, visual compositions and in-world service panels. The lower scrolling website is deferred for now, not cancelled. Nothing about this scope change authorizes disabling existing public services or removing source/assets.

## Accepted direction

- Visual anchors: Backrooms-like spatial wrongness and Monogatari-like strange framing; Hollow Knight chiefly supplies tactile movement/combat direction.
- Curious, vibey exploration and sparse inhabitants. Encounter areas contain the danger; the general atmosphere is not a horror escalation.
- Small legible character and ordinary foreground furnishings against enormous impossible architecture. Visible cohesive pixel art, warm pale materials with cool shadows, selective red accents.
- Arrival prioritises stillness, large volumes and negative space. Denser, more chaotic rooms can come later. Stable resting camera/light, restrained motion, meaningful use of silence.
- Lowercase dex in Daniel. No arbitrary subtitle, promotional one-liner or descriptor. Intro, folio panels, pixel headings and camera scale were reviewed in actual desktop/phone/tablet browser views; exact behavior is in GAME-INTERACTIONS.md and runtime manifests.

## Story accepted by Dex

Rooms become detached from their original buildings and arrive here. A small staff registers them and maintains the connections. The player is a visitor with a sword, without a compulsory backstory. The floating ring remains mysterious.

First arc: a Courtyard door leads to sky; the courtyard remains visible elsewhere. Exploring a scenic route leads through distinct spaces to the exhibit and the far side of that courtyard. Opening its maintenance latch restores a return connection beside arrival. The accountant responds with a small ordinary break in the newly accessible light. The physical shortcut and changed routine provide the payoff. Optional dialogue/progress; no account/payment requirement.

Dispatch uses seals that form constructed wardens. Each in-world collection creates a fresh encounter; destroying the warden releases access to the selected product menu. See [story backbone](story-candidate.md). The first chapter's accountant acting and warden clips are implemented; later chapters remain open.

## Preserved game destinations

| Destination | Required role |
|---|---|
| Arrival / registry | Functional story accountant beyond the first view; real dex account registration/login integration is the next phase |
| Arena | Clear main route; repeat boss defeat -> black transition -> product menu -> explicit download |
| Archive | Documentation through an ordinary door with no prerequisite |
| Exhibit / courtyard | Longer scenic journey; individual artwork inspection, optional broader catalogue, useful return shortcut |
| Donation points | Distributed safe/resting locations with easy nearby top-donor view; no treasury |

Personal illustrations remain display-only and never become environment/generation references. Top-donor views use real confirmed, opt-in data when implemented; planning rows are not donations. Mobs, player damage/death and nearby respawn remain part of the inherited combat direction. Walk/run, jump/double jump, dash, click-to-attack and E/use distinctions remain requirements to tune, not proofs of the new version's feel.

Earlier social ghost/proximity-voice work is preserved history and a carried-forward capability to revisit after the core world is composed. It does not drive arrival design or grant implementation permission now.

## Visual work actually available

- [Arrival stillness study](map-exploration/arrival-stillness-v1.png): positively received by Dex, current opening composition reference. Exact geometry/pixel scale/animation are not final.
- [Open Atrium](map-exploration/open-atrium.png) and [Courtyard Between](map-exploration/courtyard-between.png): preferred aesthetics; neither whole map is selected as final.
- [Suspended Interchange](map-exploration/suspended-interchange.png): retained alternate, not the preferred aesthetic.
- [Map connections and iteration notes](map-exploration/README.md), [arrival prompt/notes](map-exploration/arrival-stillness.md), [map prompts](map-exploration/prompts.json).

The complete standalone guest game now exists. Production owner: `D:/Dex/Projects/dex-place-art-production/registry-game-20260913/`. It contains the whole-map anchor, all twelve complete room references, decomposed geometry, shared atmospheric layers, stateful props and actual actor/cloud/light/water sheets. The published catalogue has70 assets. The curated runnable package is `D:/Dex/Projects/dex-place-world/site/dist-registry`; its199 payload files total68,060,729bytes. Final manifest SHA-256: `dc2d8a534df1b5e4a53d3601c5dc68b2532b0977d5aaf0dc869564627506f44e`.

Actual fresh native traversal reached all twelve rooms and completed the normal boss/repeat download loop, archive/exhibit interactions, physical mechanisms and courtyard return. Browser input/save/death/touch and packaged HTTP/UI checks passed. See [root review](../registry-game-20260913/ROOT-REVIEW.md) and the source `src/worldsite/registry/IMPLEMENTATION.md`. New physical-device and subjective audio review remain separate from those results.

## Production method

Complete room visual -> plan functional layers/states -> extract or generate referenced pieces and concealed backgrounds -> reassemble against accepted composition -> animate/implement -> inspect both feel and visual cohesion. This sequence was followed for the guest-game build. Stateful objects have actual moving pieces and meaningful outcomes. The CC0 Martial Hero supplies the current authored player animation; the accountant and warden use generated, inspected and registered clips. Future replacements must be judged in complete playback at intended scale.

## Next

Dex reviews the completed local guest game, including emotional audio pacing and real-device feel, then guides account integration, the lower scrolling website and additional content. Preserve the current package as the comparison point. Do not restart the completed room-generation pass or resume old public-site/auth work automatically.
