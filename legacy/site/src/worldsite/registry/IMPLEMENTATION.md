# The Registry — completed local guest-game build

This is the isolated game-only implementation authorised2026-09-13. The new game is locally reviewable; the previous public website, old v2 entry, hosting, shared accounts and lower website remain unchanged. No commit, push or public promotion was performed.

## Build and run

From `D:/Dex/Projects/dex-place-world/site`:

1. `node node_modules/typescript/bin/tsc --project tsconfig.registry.json --noEmit`
2. `node node_modules/vite/bin/vite.js build --config vite.registry.config.ts`
3. After the build completes: `node scripts/test-registry-release.mjs`
4. `cd dist-registry` and `node serve-registry.mjs`
5. Open `http://127.0.0.1:5195/`.

The curated standalone output is `site/dist-registry`. It contains its own `README.md`, `serve-registry.mjs`, licences and `release-manifest.json`; Vite is not required to serve it. The manifest records every payload path/size/SHA-256 and the Registry source hashes. Packaging explicitly selects the new70-asset catalogue, authored hero, fonts, selected audio,9illustrations,28current documentation records and immutable document ZIPs; it does not copy the older700MB public tree.

For source development only: `node node_modules/vite/bin/vite.js --config vite.registry.config.ts`, then `http://127.0.0.1:5194/registry.html`.

## Scope and behavior

- Twelve connected rooms with central scenery-only arrival, both directions, optional rest, registry, clear dispatch route, archive loop, upper service/pool/sky/exhibit/courtyard route and restored return door.
- Common authored52px traveller; variable jump, double jump, dash, mouse/J attack, contextual E, keyboard/touch controls, pause/settings and clear error/retry exits. First ready scene dissolves over850ms without delaying control.
- At overlapping junction stairs, one E chooses Ascend/Descend and animates a200ms first step. Normal walking handles the rest. Main-floor traversal does not accidentally select a stair route. Camera stays within authored vertical coverage; narrow arena uses explicit letterboxing instead of exposing cropped wall edges.
- Real two-dimensional sword contact releases the map restraint and sky bridge. Standing below the map cannot cut it; one jump and a delayed slash can. Map uses the actual six-frame unroll under a fixed top rod. Native cord crops leave anchored stubs; bridge deck lowers around its true hinge while the post stays fixed. Latch mounting plate stays fixed while the lever rotates.
- Six-health constructed warden with source-left facing, fixed asymmetric foot pivot, two attacks, explicit850ms source windup, active/recovery/hurt/death poses, knockback, invulnerability, nearby respawn and optional assistance. Each collection requires a fresh encounter. Victory -> death hold -> blackout -> product inspector -> explicit immutable ZIP download. Pause also permits safe arena exit.
- Courtyard latch is physically operated. The correct return door reconnects and the accountant acknowledges/rests only when visible in active uncovered play. Dialogue is a compact unblurred folio bubble. The clerk uses native handwriting/point-right/cup animation, never a sliding seated sprite.
- Nine original artworks are aspect-fitted into individual frames, with E and direct visible-frame click/tap, a separate catalogue, full inspectors and saved seen state after successful image load. Four portraits occupy portrait bays; canonical artwork metadata/catalogue order remain unchanged.
- Existing28documentation records have search and reading. Donation uses established Ko-fi/MB Bank choices and local QR generation. Top-donor records are explicitly disconnected in this guest preview; no fake totals, payments, registrations or credentials.

Account integration, social ghosts/voice, lower website, new products and additional authored content remain deferred until Dex guides that phase.

## Rendering and lifetime

- Scene-first generated layers, actual cloud/light/water sheets, native pivots and uniform prop scaling. Missing material fails visibly; no procedural world substitute or composite reference is used as the finished room.
- One-pass premultiplied adjacent-frame mixing preserves cloud opacity. Pool reflections mirror the same sky/ring/cloud sprites beneath the real water sheet, clipped to the water surface. No per-frame texture allocation or reflection render target.
- Ordinary125px doors sit inside generated architectural recess material. Leaf masks use the measured native frame aperture. Figurative scale, room architecture and negative space remain distinct.
- Generated folio material supplies a54px-native to10px-screen nine-slice border and restrained bookboard texture. Map labels remain readable independent of discovery state; only markers/paths dim.
- After old room objects are destroyed, unused room and illustration textures are evicted. Current/shared requirements, hero and pending loader requirements remain protected. HTTP cache supplies returns. Actual complete-journey maximum resident RGBA estimate was92.10MiB; highest transition estimate118.38MiB. These are source-texture lower bounds, excluding browser/GPU copies/render targets.
- Guest save namespace `dex.registry.guest.v1`; preferences `dex.registry.preferences.v1`. No old-world/account progress is imported. Reload restores a safe checkpoint, never held controls, an active boss or an open modal.

## Audio

The isolated audio manager retains the selected complete Suno B cue, restrained chamber variation and reviewed source-rate decode/cancellation/loop metadata. Ambience starts before the larger score loads. B already contains2.65s of silence; its additional first breath is350ms with8.5s quintic onset. Arena uses1.1s breath/5.5s onset. Compatible rooms retain musical transport; mute, pause and readers silence their intended buses.

Seven actual WebAudio scheduling/memory/cancellation checks passed. Headless output was muted. Subjective mix/listening quality and new physical Samsung Internet/iPad Safari feedback are separate user review boundaries, not asserted by those measurements.

## Current evidence

Evidence root: `D:/Dex/Automation/Proofs/dex-place/registry-20260913-runtime`.

- `actual-journey/receipt.json`:20passing checks,0JavaScript exceptions. Fresh empty guest state, actual generated media, native keys/pointer, no asset substitution/checkpoint seeding/assistance. Both arrival directions; all12rooms; map standing miss and one-jump contact; normal boss win; actual ZIP; fresh second challenge; archive/upper loops; bridge hardware/crossing;9individual art inspections; catalogue; physical latch and returned clerk routine.
- Actual before/after screenshots in that folder: `06-map-held.png`, `07-map-cut.png`, `14-bridge-held.png`, `15-bridge-cut.png`, `17-courtyard-latch.png`, `18-accountant-return.png`. All-room composition diagnostics are separately under `actual-rooms` and were not substituted for native traversal.
- `browser-actual-system.json`:11passing actual-media input/focus/touch/landscape checks. `save-death-actual.json`:6passing checkpoint/corrupt-save/death/respawn/retry checks; its isolated death test labels the seeded vestibule checkpoint honestly.
- `frame-mix.json`:actual WebGL midpoint test returnedRGBA(127,0,127,255), proving no opacity dip. `audio-native.json`:7actual scheduling checks. `panel-recovery.json`:3checks proving a failed first panel module can return to the world and reload successfully.
- Typecheck and dedicated production build pass. `scripts/test-registry-controller.mjs` supplies14 focused controller/topology/2D-contact checks. Historical fixture-art runs are preserved as development diagnostics, not final-art acceptance.
- Root independently inspected final materials, generated recesses, reflecting pool, grounded tree, mechanisms, returned NPC and mobile/tablet panels. Its packaged launch check is `D:/Dex/Automation/Proofs/dex-place/registry-20260913-root-release/receipt.json`.
- Packaged delivery checks are recorded under `package-smoke`: curated payload HTTP sizes, exact ZIP range/hash/attachment, native packaged movement/focus, desktop/phone/tablet/landscape panels and local MB Bank QR generation. Final manifest identifies the exact delivered bytes.

Physical-device and subjective audio observations remain labelled separately. The completed deliverable is the local guest-game pass, not a claim that account integration or a redesigned public website has shipped.
