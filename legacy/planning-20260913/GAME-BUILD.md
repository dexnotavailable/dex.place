# The Registry — game build scope

GO received2026-09-13. Dex explicitly authorized the map and complete game portion, requesting scope reconciliation before production. This document supersedes planning holds for that scoped work. Account integration, lower scrolling website and additional content are deferred until Dex guides them later. The old public site/source are preserved; no commit/push or live replacement is implied by this local game-build pass.

## Deliverable

A complete locally reviewable guest-playable Registry game: cinematic central arrival; all twelve connected spaces; responsive movement/combat; an authored boss encounter for each world collection; the full courtyard reconnection story with a visible accountant response; real art/docs inspection; save/resume; sound and accessible keyboard/touch panels. This is a complete small game, not just a first-room prototype. Public account/backend integrations are outside this milestone.

New isolated source entry: site/registry.html and site/src/worldsite/registry/. New generated runtime material: site/public/world/registry/. Dedicated build output: site/dist-registry. Preserve old index/v2 entry and public hosting. Art production owner: D:/Dex/Projects/dex-place-art-production/registry-game-20260913/. Planning references remain unchanged.

## Creative anchors

Accepted story: [The Registry](story-candidate.md). Accepted aesthetic: Open Atrium/Courtyard Between and their quiet central arrival derivative. Current floor plan: [evaluated central arrival](central-arrival-floor-plan.md).

The first frame puts a small traveller centrally inside a huge quiet architectural opening. No service content/NPC/menu labels in that view. Layered moving clouds partially occlude a stationary immense ring. A quiet floor inlay invites right; a short left discovery offers rest. Account table remains near the start but past a right-side reveal. Familiar human-scale objects, surreal spatial relationships, sparse life, tactile combat, visible controlled pixel art. No corporate or philosophical filler copy. Brand stays dex in Daniel.

## Twelve-space map

| ID | Place / purpose | Connections and key behavior |
|---|---|---|
| arrival | Central scenic receiving hall | Safe start, left rest, right registry. No mandatory admiration timer. |
| rest | Shaded overlook | Short optional branch off arrival, visible end, rest pose/view, no progression prerequisite. |
| registry | Accountant alcove | Arrival to junction; accountant/story conversation, first safe donation point; courtyard door initially shows sky and later returns correctly. |
| junction | Small circulation court | Registry, arena approach, archive descent, upper scenic route. Physical map banner can be released and inspected. |
| vestibule | Safe dispatch approach | Junction to arena; explicit collection choice and challenge. Leaving a product panel returns safely here. |
| arena | Seal warden | Clear floor, authored encounter, damage/knockback/death, fresh warden per collection. |
| archive | Practical records | Ordinary ungated door from junction; exit to registry-side landing creates lower loop. Real documentation reader. |
| low-passage | Compressed connecting room | Scenic route turns back across map from junction; simple forgiving movement challenge. |
| pool | Displaced reflecting room | Different materials/acoustics, dry walkway, coherent route to sky-walk. No swimming system. |
| sky-walk | Exposed large-scale crossing | Shared distant landmark recognisable; one physical bridge release makes a real traversable connection. |
| exhibit | Quiet display hall | Existing personal art individually inspectable, catalogue separate, onward to courtyard. No image-generation references drawn from personal art. |
| courtyard | First story destination | Recognisable red railing/tree, far-side maintenance latch, return doorway to registry; completes optional first arc and changes accountant routine. |

Arrival/rest/registry share a receiving-hall landmark and consistent world offsets. Pool/sky-walk/courtyard share a higher viewpoint of that same distant structure. Full-map anchor assigns stable placements/camera relationships so rooms do not regenerate a different ring. Room images establish composition; final collision/room geometry is tuned against real play, with changes recorded.

## Complete game systems

- Movement: left/right, jump with buffer/coyote allowance and variable height, double jump, dash, grounded contact, forgiving step handling. Desktop keyboard plus pointer attack; simultaneous touch movement/action on Samsung/iPad form factors.
- Combat: one cohesive warden with anticipation, active contact and recovery, readable health, hit reactions, knockback, brief invulnerability, nearby safe respawn and retry. Sparse non-boss threats only on the later exploration route; safe areas remain safe. No procedural boss generator or expanded roster required.
- Collection loop: choose current documentation consignment in vestibule -> fresh arena fight -> readable defeat -> black transition -> correct product panel -> explicit documentation ZIP download. Repeat visits fight again; story progress does not permanently unlock collection. Existing published document editions are immutable.
- World interactions: E/use operates doors, records, artwork, NPCs, rest and the courtyard latch. Slash releases the junction map banner and the specific sky-walk bridge restraint through physical contact; falling/cut material and resulting traversable state are visible. Map is inspection, not quick travel. Each action has declared idle/active/completed states and a clear purpose.
- First story: safe sky-facing courtyard door, optional accountant clue, recognisable destination, complete scenic route, far-side latch, permanent personal return connection, small accountant acknowledgement/routine response. No login, payment, art menu visit or automatic room-entry flag substitutes for physically operating the latch.
- Presentation: meaningful loading status and retry; one Enter gesture transfers focus and chosen audio without attacking; no forced waiting. Pause, settings, controls, reduced motion, silent start choice, good exits from every panel and return focus. Reader/art interactions pause dangerous gameplay.
- Persistence: new guest-local storage namespace/world revision; safe checkpoint, completed mechanism/story states, seen artwork and preferences. Restore safely after reload; do not restore held input, an unfinished boss, an open modal or stale prior-world coordinates. Corrupt data falls back cleanly.
- In-world content: existing licensed/original display-only illustrations, current documentation reader and existing immutable download artifact. Each art has its own viewer. No newly invented artwork descriptions or new product content.
- Accountant integration boundary: NPC and story actions fully work. Do not add pretend registration or collect credentials. Real dex-account integration is next phase.
- Donation boundary: physical boxes and discoverable top-donor view are part of the world. Existing public Ko-fi/MB Bank donation choices can be reused without touching payment configuration. No fake payments, sample donors or invented totals. Live donor/account linking and online donor-data integration are deferred; absent records must be represented honestly. Do not modify webhook/auth/LiveKit services.
- Online social ghosts/voice: preserve old implementation as reference; integration awaits the account phase. This milestone is a self-contained guest game and does not claim live multiplayer acceptance.

## Art and animation production sequence

1. Freeze one whole-map planning anchor reflecting the twelve spaces and accepted story. It also identifies shared receiving-hall/upper-sky landmarks and palette relationships.
2. Generate each complete room/scene with the whole-map anchor plus relevant adjacent-room/landmark reference. Judge full composition, normal-sized foreground objects, floor/entry/exit usefulness and distinct atmosphere. Keep reference plates unchanged.
3. Derive shared master backdrop, near/far cloud roles, room background/walls, foreground floors, props and moving mechanism parts through imagegen edits or new generation explicitly referencing the accepted room. Remove baked duplicates; complete concealed areas behind objects. Do not fall back to assembling an unrelated stock kit.
4. Generate actual animated sheets for cloud shapes, luminous inserts/emission, selected background movement, NPC acting and relevant props. Use consistent cell dimensions, fixed pivot, frame durations and explicit loop/hold/contact frames. Clouds combine local sheet motion with slow layer movement; lamps keep housings stable while emission changes. Do not use full-room video or disguise a static sine-drift layer as an animated sheet.
5. Keep the authored Martial Hero movement as a reliable baseline; evaluate any generated replacement through complete playback before adoption. New accountant/warden appearance and acting must suit this world. Quiet acting clips needed: work/idle, acknowledge, story-response action. A model's still-image quality does not prove a coherent clip.
6. Reconstruct the accepted room still at its reference camera, then judge it in motion. Register each derivative's source, bounds, native size, pivot, depth, shared coordinate basis, state and licence/provenance. Keep alpha honest; no baked checkerboard or white-fringe keying.
7. Only after the target is defined, adapt gameplay to it and iterate against actual scenes. Per-room tests and a playable first room are milestones; completion includes the entire game loop and all spaces.

Inventory will track conceptual rooms, generated/accepted layers, props, clips and actual integrated use separately. Aim for enough purposeful material, not a fixed numerical asset count. Share master landmarks and compatible layers across rooms. Background and per-room loading must keep memory/use practical on target devices.

## Audio plan

Reuse the user-selected full Suno B cue and existing calm ambience/effects. Arena uses the existing restrained chamber candidate, with smooth transitions; no new ElevenLabs/Suno spending by default. Source contains an unshipped onset-envelope correction and the B file itself has2.65s silence; avoid stacking extra pauses blindly. Start ambience independently of music loading. Preserve music transport across compatible rooms; do not restart at every doorway. Archive/inspection and selected quiet passages use deliberate silence. Footstep contact/tone must be judged anew; prior steps were not taste-approved.

## Finish line / checks

- Compare actual arrival and each of the twelve room compositions with its accepted reference; verify shared landmark consistency, ground/pixel scale, no missing layers, no arbitrary props and genuine cloud/light sheet playback.
- Exercise both arrival directions, complete archive loop, explicit arena route, full scenic route and restored courtyard shortcut with ordinary input. Check every door endpoint, mechanism and safe return.
- Complete a normal boss victory and repeat collection. Separately test assistance if present; never label an assisted/diagnostic win an ordinary difficulty proof. Download occurs only on explicit choice.
- Verify death/respawn, damage windows, mobility, story latch and accountant response, pause/resume, reload and invalid save handling.
- Inspect all panels, keyboard focus, pointer/touch ownership, simultaneous touch controls, portrait/landscape and iPad-sized layouts. Browser automation/emulation and physical-device feedback are distinct evidence.
- Check actual audio transitions/loop boundaries, complete absence of surprise sound after mute/background/reader, and smooth entry into arena. Listening limitations are reported honestly; waveform measurements are not taste acceptance.
- Build dedicated game output, verify resource loading and errors, create a local reviewable release with source/asset manifest and instructions. No whole-site/auth migration or public replacement before that separate phase is authorised.
- Taste is mandatory: still cinematic arrival, enjoyable movement/combat, purposeful transitions, clear choices, varied rooms, emotional courtyard payoff. Counts or successful type-checks alone cannot finish this job.

## Current checkpoint

The authorised local guest-game pass is complete and packaged at site/dist-registry, running at http://127.0.0.1:5195/. All twelve individually composed rooms and70 registered materials/clips are integrated. The fresh native journey passed20 checks across all rooms/story/combat/download/art/docs/mechanisms, with additional system/save/death/touch and standalone package checks. Root independently inspected the real rooms/panels and launched the packaged copy without dev-server dependencies. Physical-device feedback and subjective final audio listening remain separately labelled; accounts/lower website/additional content await Dex's guidance. See ../registry-game-20260913/ROOT-REVIEW.md and GAME-INTERACTIONS.md.
