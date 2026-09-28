# Private mechanism prototype

This fixture proves three small mechanisms using existing native pixels. It is not a finished world composition, production integration, or publication approval. Dex's rejected candidate remains rejected. No new provider assets, user artwork, boss work, public sample content, or deployment are involved.

## Source and evidence

- Module: `D:/Dex/Projects/dex-place-world/site/src/worldsite/game/mechanisms.ts`
- Private preview: `http://127.0.0.1:5195`
- `proof/results.json`: eleven native keyboard/rendered checks, all pass, no browser page errors.
- `proof/final-default.json`: default-only bridge constructor rechecked after the72px default/getter change; actual blade contact and intermediate lowering captured; pass, no page errors.
- Final module SHA256: `1613650046ea1b39a1698ca911a8e05c622eb846d1c02854a695402654c37182`.
- `pnpm exec tsc --noEmit` passed after the final module edits.
- Browser: isolated headless Brave through Playwright CDP;1200×620 canvas, camera zoom0.8,1600×1000 viewport. Proof observes actual canvas/keyboard and read-only state, not injected outcomes.

Visual frames:

- `proof/bridge72-held.png`
- `proof/bridge72-severed.png`
- `proof/bridge72-mid-lowering.png` (−27.5°)
- `proof/bridge72-settled.png`
- `proof/bridge72-crossed-page.png`
- `proof/banner-open-page.png`
- `proof/lift-lower-page.png`
- `proof/lift-moving-page.png`
- `proof/lift-upper-page.png`

## Bridge geometry and contract

```text
                  fixed structural post/beam
 A = H + (−24,−130) o
                     \ upper fiber,90%
                      K red wrap / cut point
                       \ lower fiber,10%
                        o D = rotate((72,0), angle) + H
                      / deck raised−50°
 left bank ========= H .............................. R ===== right bank
                     ^ fixed P08 bearing               ^ receiver
                     <----------192px gap------------->

 held → severed(.08s) → lowering(.62s) → settling(.14s) → settled
 collider: null                                            one-way
```

P07 deck is192px of native left cap/middle/right cap. It rotates rigidly aboutH. P08 bearing stays in the fixed root. Both hardware eyes remain attached; only fiber is severed. The long remainder swings toward down fromA, and the short remainder hangs fromD. This is a single-use cut until explicit world reset.

The originally requested96px deck eye putsK at(H+53.14,F−79.19). It passes logical reach but maps to transparent native attack pixel(163,43). The72px eye putsK at(H+39.25,F−62.64), native pixel(149,59), white blade in contact frames4/5. This is why72 is the default. The final probe used no optional geometry arguments and observed RGBA(254,254,255,255) at actual contact.

Actor positions are feet. Reach uses body center24px above feet. `cutPoint` owns prompt/action placement; never target the old cable source origin. Use `canInteract` for E, turn the actor towardK, then `trySever` at authored slash contact time. `trySever` checks directional slash eligibility. Repeated cuts are rejected. `collisionSurface` is null until settled; the owner must create real left/right banks and leave the gap unfilled until that surface becomes valid. A safe scenic alternate route should exist in the final world.

Cheap getters: `state`, `deckAngle`, `isSettled`. Events: `cut`, `impact`, `settled`. Reduced motion removes decorative swing/bounce but keeps the actual lowering and collision timing. `reset()` restores held state, `destroy()` removes its parts.

The native proof measured fixed/moving hardware transform error below0.000015px, native image scale1, invariant P08 local pivot(−13,−31), no collider before settling completes, and a nativeD walk across the real gap after settling.

## Reversible banner

`LatchedBanner({id,x,floorY,onEvent})` uses existing P16/P17/P18 at native scale, a fixed post, roller, linkage and metal strike latch. The cloth is always intact. `tryRelease(actor,'slash'|'interact')` opens from the latched state; `close()` rewinds it. Opening takes.42s, closing.22s; reduced motion snaps.

```text
 latched --metal latch strike--> opening --> open
    ^                                       |
    +-------------- closing <--Close---------+
```

Cheap getters: `state`, `openAmount`. `interactionPoint` owns its reachable latch. `contentRect` exposes the native inner cloth rectangle; production readable DOM layout/focus still belongs to the root integration. Events: `latch`, `opened`, `closed`. Map `latch` to a mechanical click/hit, never paper-cut. NativeE release, Close/rewind and secondJ release passed with intact cloth and a second latch event.

**Clock ownership:** its visual opening must keep advancing while its own DOM content layer pauses gameplay. Use the presentation clock for that operation. `paused` should represent an actual interruption, not automatically the banner's own open panel.

## Rail lift

`RailLift({id,x,lowerY,upperY,onEvent})` defaults to a192px P09 deck with both caps, matching rail/shoe engagement and an extended native FG04 rail. Fixed rail centers arex±100; both moving shoe centers use those same values. P11 housing/emission are separated and mounted on the moving carriage.

```text
 docked_lower → engaging(.16s) → moving_up → settling(.18s) → docked_upper
 docked_upper → engaging(.16s) → moving_down → settling(.18s) → docked_lower
```

Speed32px/s. `setOccupied` receives real contact ownership. `ride()` requires an occupied dock. `summon('upper'|'lower')` rejects movement and occupied cars. An empty upper dock returns after8s; occupancy holds it. `update(dt,{occupied,paused,reducedMotion})` returns deltaY so the owner can carry its actual grounded rider. `collisionSurface` always follows the carriage. Cheap getters: `state`, `positionY`, `targetY`, `isOccupied`. Events: `drive-start`, `docked`.

The native fixture carried the player from lower560 to upper300 with zero player/deckY divergence and shoes aligned with the fixed rail centers. The upper screenshot's slow sidebar can still show the preceding settling text; the same receipt records the actual `docked_upper` state.

## Scope limits / integration ownership

The module is handed back to root. It does not own gameplay surfaces, route/navigation state, banner DOM typography/focus, sound playback, camera, room layout or production proof. Its `snapshot()` allocates native-art diagnostics and should be reserved for inspection; use the cheap getters during gameplay. The terminal seen beside the fixture is an existing kit scale reference only.
