# Coherent asset and modular world production

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. Expand coherent authored NPC/boss/mob donors and individually produced room/UI layers. Keep independent source, grid, animation and state proof; no all-in-one generation. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

Status: **go active; scoped asset production and complete implementation authorized**. The completed [bounded sprite comparison](11-framing-and-sprite-comparison.md) remains historical experiment evidence. Dex selected the authored donor, then authorized the complete website and sustained individual environment generation. Read the [decision register](00-decisions-and-scope.md), [inventory](19-world-asset-inventory.md) and [site rules](../../AGENTS.md) with this workflow. Production authorization does not establish asset acceptance or public runtime proof.

**CONFIRMED** records Dex's requirement. **PROPOSED DEFAULT** records the concrete route to try after go. **OPEN** records an unverified capability or missing production proof. All unmarked implementation details below are proposed defaults.

## 1. The requirement this workflow must satisfy

- **CONFIRMED:** The character must remain the same coherent character across its animations. A collection of loosely matching generated poses is insufficient.
- **CONFIRMED:** Terminals, elevators, lights, and other interactive details must exist as separate controllable objects in a real game environment.
- **CONFIRMED:** The website remains a cinematic liminal pixel platformer; moving and interacting should operate on the objects the visitor sees.
- **CONFIRMED:** Existing personal illustrations remain display-only in Illustrations, including exclusion as generation/reference material.
- **CONFIRMED:** Keep the selected CC0 character, generate foreground environment assets as many separate reusable pieces first, then generate separate background layers and assemble the scene. Do not ask a generator for the complete website/world in one image or every asset in one generated sheet (R-38).
- **CONFIRMED:** The three newly supplied scale studies guide composition under01. Their purpose is an immense place around a tiny traveler; visual defaults may be tuned from the assembled result under00 rather than treated as inflexible quotas (R-39).
- A convincing mockup is a visual reference. It is not evidence that its terminal can open, its lift can carry a player, or its sword can hit something.
- A working export is technical evidence. It is not evidence of character consistency, good animation, or appealing composition.
- Every production decision below supports the existing [world/gameplay](02-world-and-gameplay.md), [section controls](03-sections-and-controls.md), and [shell controls](05-shell-and-system-controls.md). It introduces no visitor controls or rewards.

## 2. Proposed toolchain and current truth

| Job | Proposed owner | Current status and limit |
| --- | --- | --- |
| Map composition | Tiled: visible tile layers, object classes, templates, properties, and JSON export. | Not found in the bounded local inventory; not installed or integrated by this planning work. |
| Game runtime | Phaser as an isolated 2D prototype inside the existing React/Vite DOM shell. | Proposed dependency; no Phaser installation, importer, or browser proof claimed. |
| Pixel and animation authoring | Installed Krita, with controlled frame edits and editable `.kra` sources. | Krita 5.3.2.1 executable and registry verified; this workflow's animation export still requires an actual proof. |
| Static environment production | Individual original foreground/prop pieces, then separate middle/far/sky layers; controlled post-pixelation trials are allowed under01. | Active generation, with actual draft/accepted/integrated counts in19's private inventory. Use the actual tool/model identity and cost where exposed; inspect each result in composition. No new character-sheet competition or one-shot full-world image. |
| Sound production | Approved exported music, ambience, and effects using the audio workflow. | Offline production; visitor interactions never invoke generation or consume provider credits. |
| Conditional character fallback | Blender renders from one controlled model/rig/camera setup to 2D frames. | Blender 5.1.2 registry and executable presence verified; no suitable rig or render pipeline is yet proven. |

**PROPOSED DEFAULT:** Tiled + Phaser + Krita is the chosen route for the first implementation after go, conditional on one complete room passing section 8. It is not an open engine-design menu or a promise that all integration seams already work.

Godot is also installed locally, but this proposal does not migrate the website into Godot or maintain two game runtimes. Aseprite/LibreSprite/LDtk were not located in the bounded inventory; they are not assumed dependencies.

## 3. Make the character coherent before expanding its actions

**CONFIRMED:** After rejecting the generated-animation trials, Dex selected the coherent authored CC0 [Martial Hero by LuizMelo](https://luizmelo.itch.io/martial-hero) for now. Use it as authored for the first playable; do not reopen a character-design comparison or repaint it before that proof. Original animation remains the eventual goal. The author advertises idle/run at eight frames each, jump/fall at four each, two six-frame attacks, four hit frames, and six death frames. Layered sources are not advertised.

**Actual donor inspection, 2026-09-06:** The official free download produced a 33,768-byte archive, SHA256 `65df84320dafb557fcc12aa9809177d86af78a46c37b25f8b44891d178802ee3`, containing its own CC0 license. Native transparent frames are 200 by 200 pixels. Idle and Run have eight frames, Attack1/Attack2 and Death six, Take Hit four. **Jump and Fall each contain two frames**, despite the page advertising four. The common foot baseline is source y=122, with the imported pivot x=100, y=122; Idle's visible silhouette is about 52 pixels high. Public sheets retain the original bytes under stable lowercase names. `public/world/hero/manifest.json` records the verified sizes, per-frame alpha bounds, source URL/license, frame timing and pivot. The private production donor archive, full-frame contact sheet and `provenance/martial-hero.json` preserve import evidence; actual browser transitions and collision still need runtime proof.

Inspection also found that Attack1's visible sword arc occurs only on zero-based frames4 and5. The initial timing is corrected below to align those frames with the existing `[100,180)` ms contact interval. Earlier six-frame durations would have tested contact during anticipation. Preserve authored pixels; use a separate Idle recovery presentation after the final attack frame.

1. After go, acquire the actual archive, preserve it unchanged, and record creator, source URL, license evidence, retrieval date, and content hash.
2. Inspect actual filenames, frame dimensions/counts, transparent margins, and advertised motion in a neutral contact sheet. Confirm archive integrity and workable registration; this is an import check for the selected donor, not a fresh style competition.
3. Record source frame dimensions, transparent margins, feet baseline, pivot, facing, and animation order. Preserve that registration when importing frames into Krita.
4. Preserve native donor pixel scale and authored proportions in a controlled source/import record. Do not force it into the earlier nominal 48 px source silhouette or repaint its palette before the first playable. Camera/display framing remains independently governed by [01](01-art-direction-and-audio.md).
5. Map missing dash, landing, interaction, and air-slash states to the explicit interim reuse table below. Do not produce new frames to fill those states before the first playable; later original replacements have a separate proof/cost.
6. Verify transitions as well as loops: idle to run, run to stop, jump to fall to land, slash to idle/run, hit recovery, and dash exit. A good individual frame cannot compensate for visible shape changes between states.
7. Export registered transparent frames and explicit timing/event metadata. Re-import the exported result to check it, rather than judging only Krita's source preview.

Krita provides raster frame animation, timeline/onion-skin tools, and image-sequence export. Initially use it for controlled inspection/export with donor pixels preserved; it is not an automatic in-between drawing system. [Krita animation](https://docs.krita.org/en/user_manual/animation.html), [Render Animation](https://docs.krita.org/en/reference_manual/render_animation.html).

### Initial clip mapping

Names now map to the inspected archive clips. Timing/reuse rows are implementation baselines and must pass actual imported playback before acceptance. Metadata changes after that probe stay in the documented animation data, not scattered code or undocumented art edits.

| Runtime state | Authored clip / frame mapping | Timing and honest limit |
|---|---|---|
| Idle | Idle, all 8 frames | Start at 125 ms/frame, looping; adjust cadence only if actual playback justifies it. |
| Run | Run, all 8 frames | Start at 80 ms/frame, looping; verify foot contact against movement and document any cadence adjustment. |
| Jump rise | Jump, both 2 actual frames | Start at 80 ms/frame, hold last while rising; physics transition to falling takes precedence. |
| Fall | Fall, both 2 actual frames | Start at 80 ms/frame, hold last until landing; collision determines landing. |
| Ground slash | Attack1, all 6 frames, followed by Idle recovery | Durations `[25, 25, 25, 25, 40, 40]` ms: first four frames provide 100 ms anticipation, frames4–5 provide 80 ms active strike, then Idle displays during 180 ms recovery; 360 ms action total. The recovery remains action state even though its presentation reuses Idle. |
| Air slash | Attack1, same 6 frames/pivot/events | Reuse honestly as an interim airborne attack with gravity and airborne collision active; this is not a custom authored aerial animation. |
| Hurt | Take Hit, all 4 frames | 50 ms/frame, 200 ms total; the separately specified damage-invulnerability clock remains independent. |
| Defeat | Death, all 6 frames | 60 ms/frame, 360 ms total, then the existing retry/leave result. |
| Dash | Proposed Run frame index 2, zero-based | Hold 160 ms for existing dash duration; verify that this actual frame is a suitable passing pose before accepting the mapping. |
| Land | First Idle frame | Hold up to 60 ms without blocking input; a new deliberate movement/action cancels the visual hold. |
| Interact | Idle | Keep ordinary idle while existing Interact behavior runs; no invented gesture or control. |
| Unused source | Attack2 | Preserve in source; unused initially, with no second attack button or combo feature. |

Ground/air slash damage is active only on the shared action interval `[100, 180)` ms. Crossed time events execute once even if a displayed frame is skipped; physics/action metadata owns contact. The first playable must show native gameplay and the 2x inspection crop before this reuse is accepted.

- If the actual archive cannot satisfy a technical import or readable-action gate, report that concrete failure and fix the source mapping first. A new donor or fully original set is not an automatic pre-playable task merely because another style might be prettier.
- A recolored or edited donor remains an adapted licensed asset. Record the original creator; do not describe a palette change as entirely original character art.
- Proposed initial credit: `Martial Hero — LuizMelo, CC0.` Add an accurate adaptation note only when actual modifications occur. Keep private provenance even if attribution is not required by the license.
- **CONFIRMED:** Original animations are the eventual target; Dex accepts the authored donor for now. Preserve compatible state names, pivots and action-event contracts for replacement. Original production needs its own frame list, visual gate and real effort estimate; it is not automatically solved by a single prompt.
- Blender same-rig rendering remains a later bounded fallback after a demonstrated unsolved failure, not part of the first playable now that the authored donor is selected. It would render offline to the same contract, never silently switch the website to live 3D.
- Do not mix independent image-generated sprite frames, optical-flow guesses, or extracted video frames into the hero and assume registration alone fixes identity, limbs, or sword geometry.

## 4. Author a level, not an interactive screenshot

Each room is a map document whose appearance and behavior can be edited independently. Background plates can depict distant unreachable scenery; they cannot contain baked-in duplicates of playable props.

### Generate pieces, then compose the scene

This is the environment production order after go, within15's preparation and implementation stages. Work on the smallest useful set for one assembled scene before producing the rest of the world.

1. **Place the actual CC0 traveler in a rough playable composition.** Use simple temporary shapes for the walkable path, horizon and distant mass so screen scale, camera and interaction reach can be judged. These shapes are layout tools; no all-in-one generated scene is needed. Keep the donor's authored pixels/animation and the confirmed actions.
2. **Generate the first foreground/play-plane pieces separately.** Start with useful modules such as a platform edge, support base, short rail/beam, bench, terminal housing, screen insert, lift platform, cable attachment and bridge segment. Each generated image has one coherent object/component role with clean separation and margins. Reuse accepted modules where appropriate.19 supplies the approximately 50-piece working roster: 10 foreground, 20 props, 10 middle and 10 background. Count useful distinct pieces; frames and rejected alternates do not add coverage.
3. **Assemble and test those pieces immediately.** Place them with the traveler in the real camera. Match pixel density, material, light direction and perspective; fix inconsistent edges/registration. Bind terminal/lift/cable parts to their own transforms and interaction/collision state. Check at actual play size with the shell and touch controls present. Avoid finishing an entire foreground library before discovering that it looks incoherent together.
4. **Generate the background in separate depth roles.** Build a mid-distance structure or architectural span, a distinct monumental silhouette, farther forms, and sky/haze/water layers as the composition requires. Each image belongs to one coherent depth/object role. A whole distant structural silhouette can be one source asset; it must not also contain the foreground path, traveler, terminal, UI and all other depth planes. Generate toward the foreground's established palette/perspective, then tune the assembled scene together.
5. **Add controlled environmental motion to separate objects/layers.** Screen glow uses its emission/overlay; cables use their authored parts; the lift moves its platform assembly; subtle haze/water motion acts only on appropriate decorative layers. Follow the technique table below. A generated still does not become interactive merely through a pan/zoom, and a generated video does not supply object state.
6. **Judge the whole scene as well as the specifications.** Compare the visual scale relationships in01's three references, movement readability, depth, lighting, coherent visible pixel pitch and actual content UI. Move, simplify, replace or retune the relevant piece when the result looks wrong while retaining the documented requirements. Passing a camera percentage or component check cannot accept an otherwise poor result. Record any justified refinement to the proposed baseline at the scene checkpoint and keep the successful composition as the reference for the next region.
7. **Expand selectively, then export.** Reuse compatible pieces and generate only missing roles for the next destination. Preserve individual editable source files and provenance. A deterministic build step may pack accepted independent images into runtime texture atlases within07/13's limits; that packaging is not an all-in-one generated sheet. Keep each object's frame/rect metadata, pivot and source mapping independently replaceable.

Each generation brief names the object's role, side-view/perspective, intended pixel scale, material/palette, common lighting, background/alpha requirement and margin/attachment needs. Share this short visual brief across the batch, then accept assets by their combined appearance in the scene. Do not inflate prompts with the entire website specification or ask the generator to implement navigation, physics or payment UI.

**Confirmed v1.4 production correction:** require a fully 2D-looking strict flat side-view/front elevation in every future brief. No visible top face, foreshortening, angled end cap, isometric view or 3D extruded-prop viewpoint. Small edge highlights are allowed; depth comes from layered overlap and contrast. Platforms have a flat horizontal cap line, flat cutface and vertical seam-friendly ends; their upper surface is not visible. Record this projection verdict separately from pixel pitch and alpha quality. Keep already live generation jobs and inspect their returned files before deciding on targeted rework; do not silently duplicate jobs or regenerate the whole library.

The pixel brief follows01's latest scale-aware direction: terminal v2's pixel style is user-approved, while platform v2's blocks are too large at its intended larger world size. Match visible near-field pixel pitch after crop, logical-grid selection and camera/world scaling; background forms may be finer. Record `sourceOpaqueRect`, `sourcePixelBlock`, `logicalRenderSize`, `worldScale`, `depthRole` and `gridRole` per asset. Source canvas dimensions alone cannot establish consistency. Keep the CC0 traveler authored. The terminal revision still has an opaque baked checker background, so style approval does not make it a usable production cutout.

Dex explicitly authorized testing a high-definition source followed by controlled post-pixelation. Compare that derivative with native pixel-art output at equal scene dimensions beside the hero and terminal, including a larger platform and depth layers. Preserve raw sources and transformation parameters. Accept only after silhouette, light/material grouping, pixel pitch, clean alpha separation and real camera motion pass; no automatic global mosaic treatment or UI/gallery/QR pixelation.

Separate static coherent forms at useful boundaries, and separate anything that moves, glows, breaks or interacts according to its actual state. This prevents a collage of unrelated fragments without turning each region into hundreds of tiny mandatory assets. No unseen batch is automatically production-ready; no visitor action calls a generator. Dedicated individual generation can continue for the substantial asset pass, with scene checks and inventory updates between useful batches. If the built-in route returns unrelated infographics or similarly wrong content, switch to the authorized Higgsfield GPT Image 2 route, verifying its actual model and current quote first. Preserve the failed output and describe the observed failure; do not infer throttling without evidence. Existing spend boundaries apply, with no purchase or default ElevenLabs spend.

The newly supplied scale studies are identified in01; Dex's nine gallery illustrations remain excluded from every environment/character prompt. A screenshot exported from the accepted assembled scene may supply the matching loading preview in17. It is derived from the real scene after assembly, not a replacement one-shot world image.

### Map and assembly layers

| Map layer/group | Authored contents | Runtime interpretation |
| --- | --- | --- |
| `distance` | Sky, far structures, water-horizon plates; bounded parallax metadata. | Decorative imagery; never a collision or interaction source. |
| `back_tiles` | Rear walls, static shaft recesses, distant railings, architectural tilework. | Static visible scenery behind actors. |
| `collision` | Deliberately authored solids, one-way platforms, and boundaries. | The authority for static traversable geometry, separate from painted detail. |
| `objects` | Terminal, lift, cable, bridge, file prop, gallery bay, support plinth instances. | Create the matching reusable assembly with its own state and stable instance ID. |
| `front_tiles` | Foreground rails, framing beams, occlusion strips. | Decorative foreground constrained by visibility/readability rules. |
| `anchors_and_paths` | Player/section spawn points, lift stops, permitted motion paths. | Spatial references, not hardcoded coordinate duplicates in source code. |
| `camera_bounds` | Playable bounds, safe compositions and transition regions; referenced per-anchor landscape/portrait/ultrawide framing records. | Camera constraints and01's scale/visibility targets; no new compulsory cutscene or enlarged traversal requirement. |
| `audio_bounds` | Region ambience and localized emitter bounds. | Existing music/ambience settings and pause behavior govern playback. |

Tiled object layers support spatial objects with custom properties, including references to other objects; this suits spawns, zones, paths, and connected props. [Tiled objects](https://doc.mapeditor.org/en/stable/manual/objects/).

Keep the working camera values and an accepted composition reference for each destination. Record body/structure measurements or quiet-region annotations when they help diagnose the view; do not require a numeric composition form for every anchor. Preserve the chosen scale relationship and essential visibility through export and Low/reduced-motion variants. Distant structural layers may extend beyond the collision map while remaining bounded/cullable rendering data. Avoid a single enormous image merely to draw an enormous building.

- Use a stable application ID such as `arrival.terminal.downloads.01` per instance, in addition to Tiled's map-local object ID. Renaming a label does not change identity.
- Shared class data defines the assembly type. Instance properties hold placement, route/content reference, optional cosmetic variation, and links to other local objects.
- Store terminal assembly defaults in an authored template plus a runtime assembly definition; the map places one root marker. Tiled templates do not magically implement a multi-part runtime object.
- Prefer external tilesets for template-backed tile objects. Template defaults and deliberate instance overrides remain distinct in source. [Tiled templates](https://doc.mapeditor.org/en/stable/manual/using-templates/).
- Preserve editable templates in authoring; normalize/detach them into a reproducible runtime JSON export if the selected loader cannot resolve them. Prove that export behavior rather than assuming native compatibility.
- Pin the editor/export format and normalize the format's actual class/type fields, references, external paths, and supported layer features. Tiled's JSON serialization has version-specific details; arbitrary newest-editor output is not a compatibility guarantee. [JSON map format](https://doc.mapeditor.org/en/stable/reference/json-map-format/).
- The importer rejects duplicate stable IDs, missing target references, unknown required object classes, unsupported collision shapes, and unapproved asset references with an exact authoring location.
- Moving one object root in Tiled moves its complete assembled object on next export/load. Duplicating an instance gives it a new stable ID and independent state; it never shares mutable runtime state by accident.
- Linked cable/bridge or lift/landing copies require explicit reference remapping. A duplicate must not silently operate the original bridge or platform.

## 5. Reusable assemblies

### Terminal example

| Part | Source and attachment | Responsibility |
| --- | --- | --- |
| Cabinet | Static transparent sprite attached to the terminal root. | Shape, material, shadow; no active screen or glow baked into it. |
| Screen | Separate sprite/frame set at a root-relative offset. | Small idle/activity animation consistent with existing catalog state. |
| Emission mask | Separate aligned mask or additive sprite. | Controlled screen glow; strength can change without repainting cabinet pixels. |
| Collider | Root-relative configured geometry when the cabinet is solid. | Collision only; does not expand because glow pixels extend beyond the cabinet. |
| Interaction zone | Root-relative zone with existing route/action reference. | E/touch Interact opens the correct section; visible shell remains the equivalent path. |
| Hum emitter | Root-relative point/area. | Local ambience governed by Sound, ambience level, distance, and pause. |
| State | One per-instance state record. | Coordinates the visual response without sharing state across terminals. |

- Proposed visual states: idle, in reach, and panel active. The panel-active appearance may freeze while the world is paused. These are presentation states, not new controls.
- A catalog error belongs to the documented DOM error state. It does not invent a broken-world terminal that must be repaired before downloads work.
- Screen animation, emission intensity, and hum follow the same terminal state; none initiates a download or opens a route on its own.
- Screen/glow offsets are defined once relative to the root. A moved terminal cannot leave its glow, sound, interaction zone, or collider behind.
- Low quality can use a flat emissive overlay instead of an expensive lighting effect. The terminal stays readable and usable with glow and audio disabled.

### Elevator example

- Static shaft, rails, walls, and architectural framing belong to the room. The moving platform is a separate assembly; no platform pixels are baked into the shaft plate.
- The platform root owns its exact collision body, visible platform, attached indicators/lights, and relevant audio location. All use the same world transform.
- Two stop references and landing interaction zones come from the map. WORLD-01 and WORLD-02 in [02](02-world-and-gameplay.md) own Summon lift, Ride up/down, speed, return delay, and occupied behavior.
- State is `docked_lower`, `moving_up`, `docked_upper`, or `moving_down`, with occupied state evaluated by the collision/contact system. No second hidden tween state guesses where the platform is.
- Move the collision authority in the shared fixed simulation step. Compute its actual displacement and carry a supported player by that same displacement before collision resolution.
- Rendering follows that collision transform. Do not tween only the platform sprite while its collider remains stationary or follows another clock.
- Jumping off releases supported contact; the player is no longer dragged by the lift. The unoccupied platform continues its current trip and then obeys the documented dock/return rules.
- Commands during travel neither reverse a ridden platform nor accumulate in a queue. Direction reverses only through the existing valid command at a dock, or the documented empty return behavior.
- Pause freezes platform movement, carrying, indicators, and timers together. Resume preserves position and support contact; it does not apply a large elapsed-time leap.
- Validate both travel directions, landing edge contact, boarding, dismount, jumping off, pause/resume, and occupied return-delay suppression. Engine availability alone proves none of these.

### Cut cable and linked bridge

- Place the cable and bridge as separate instances with an explicit local target link. Their art, collision state, and relationship stay editable in the map.
- The cable's uncut/cut state determines its own appearance and one idempotent transition of the linked bridge. Repeated slash callbacks cannot drop the bridge repeatedly.
- The bridge moves/changes collision through its own assembly; its moving pixels and walkable geometry share the same authority, like the lift.
- Only this cable instance and its referenced bridge change. Cutting must not remove the shared sprite, every tile of a visual type, another cable, or a whole scenery layer.
- Any permitted detached fragments are bounded cosmetic pieces with no new reward rule. Restart world restores instance state using the existing shell contract.

## 6. Choose animation technique by what actually changes

| Detail | Technique | What must remain synchronized |
| --- | --- | --- |
| Hero and boss body poses | Authored registered frames; controlled state transitions. | Character identity, pivot, feet, facing, sword geometry, and action timing. |
| Lift/bridge translation | Deterministic collision-authoritative transform. | Platform, carried player, attached lights, zones, and sound origin. |
| Terminal screen | Small authored frame loop or deterministic screen pattern. | Per-instance terminal state and pause. |
| Screen glow/signal light | Separate mask/sprite with bounded intensity animation. | Owner transform, current state, motion/quality settings. |
| Clouds/reflections | Separate decorative layers with restrained transforms. | Camera composition, reduced motion, no false collision. |
| Slash arc/contact sparks | Authored effect frames or bounded particles attached to the action. | Actual contact event, orientation, one-hit guard, pause. |
| Hum/footsteps/impact | Audio cues or loops from existing sound assets. | Owner/action state; mute and visual equivalents. |

Most moving environmental details need authored parts plus small deterministic motion. They do not each require a generated video.

- Define animation frame order, duration, loop policy, cancel/transition rules, and action-event times in one animation record. Keep damage windows tied to that record.
- Run action events on the simulation timeline and process crossed event boundaries exactly once, including a low-frame-rate update that skips a displayed frame.
- A rendered frame-change callback must not be the sole authority for damage, a bridge transition, or a file handoff. Visual playback can skip frames; important events cannot disappear or duplicate.
- Phaser supplies named frame sequences, timing, and playback controls. The application's simulation/action adapter must still enforce the coherence and event rules above. [Phaser animations](https://docs.phaser.io/phaser/concepts/animations).
- Start with a 60 Hz fixed simulation step and bounded catch-up; render refresh rate does not change lift speed, attack duration, or timer outcomes. Excessive lag pauses/recovers rather than teleporting through unprocessed collisions.
- Preserve precise physics positions internally; sample render positions consistently onto the pixel grid. Never round collision geometry independently each frame.
- Disable interpolation/smoothing for pixel poses or camera paths where it creates shimmer, blurry edges, or collider/visual mismatch. Any retained interpolation must move related visual parts consistently.
- Full/reduced motion and Low/High quality change decorative presentation, never action-event order or collision results.

## 7. Source, export, and revision contract

1. Keep editable `.kra`, map/project/template files, approved donor originals, and provenance in the private authoring surface specified by [07](07-content-runtime-and-hosting.md). No new folder is created during this planning stage.
2. Export transparent frame sequences at a deliberate native pixel size. Maintain source canvas registration; if atlas packing trims frames, preserve source size, trim offset, pivot, and frame name in metadata.
3. Emit atlas textures plus animation metadata with stable named frames, durations, events, bounds, and exact source revision. Do not infer action timing from alphabetical filename order.
4. Export the normalized map and its referenced object definitions/assets with the same build revision. File references resolve through approved public asset IDs, not workstation paths.
5. Validate source-to-export completeness, duplicate IDs, atlas entries, map links, collision references, and usage permissions before loading the room.
6. Re-open/reload the exported package in the actual browser prototype and compare it against the authoring view and approved motion reference.

- Record creator, license/reuse basis, original source URL, source hash, transformation notes, export-tool versions/options, and revision in private provenance. Publish credits where appropriate.
- A public manifest contains only required public asset IDs/URLs, geometry, behavior data, and version information. Never emit raw API keys, local source paths, or private authoring folders.
- Do not manually repair exported JSON or atlas offsets as the lasting solution. Fix the owning source/exporter so the next export preserves the correction.
- Preserve an accepted revision before experimentation. A bad new export can revert without losing the reviewed source or confusing it with generated alternatives.

## 8. One-room proof before whole-world production

The internal test loop can contain a terminal, lift, cable and bridge without putting every object in the opening shot. Distribute them along the short loop, keeping01's monumental arrival composition and breathing room visible. The first-room gate must establish scale as well as mechanics; a crowded test chamber is not the visual baseline for the remaining destinations.

The initial room contains one complete small traversal loop: hero, safe platforms, terminal, two-stop lift, cut cable and bridge, and restrained atmospheric layers. It is a production-pipeline test, not an extra public website section.

**CONFIRMED:** The first boss reward is the full website documentation ZIP. Any encounter/download proof added to this room must use that documented artifact and the existing one-shot intent contract; an arbitrary placeholder reward does not satisfy it.

| Proof | Required observable result |
| --- | --- |
| WP-01 · character | Idle/run/slash loops and transitions read as the same body, clothes, and sword; feet/pivot stay stable; actual browser playback matches exported frames. |
| WP-02 · action timing | Visible strike, active hit region, contact effect, and result agree at low/high render rates; each slash hits one target at most once. |
| WP-03 · terminal | Cabinet, screen states, emission mask, collider, Interact zone, and hum behave as one assembly; opening content follows existing DOM/pause rules. |
| WP-04 · lift | Summon and ride work both ways; standing player is carried; jumping off releases support; pause/resume has no snap; in-transit reversal is rejected and valid dock reversal works. |
| WP-05 · cable/bridge | One cut changes exactly its linked bridge and collision; repeats do nothing; restart restores both without touching another instance. |
| WP-06 · edit placement | Move a terminal and lift through their map placement/path data; re-export/load once; all attached parts, zones, stops, and sound positions follow. |
| WP-07 · duplicate | Duplicate the terminal with a fresh stable ID; both instances work independently; state changes on one do not animate or disable the other. |
| WP-08 · repeat export | Re-export the preserved donor frames plus one map-placement edit, load the new revision, and verify pixel identity/registration without hand-patching coordinates, atlas offsets, or manifests. A source-art repaint is not required before first playable. |
| WP-09 · touch and fallback | Traverse and use the room on a target real mobile device; controls, pixel readability, performance, reduced motion, and text/navigation mode meet [06](06-mobile-accessibility.md). |
| WP-10 · durable proof | Save a short browser recording, source/export revision, asset/license inventory, device/browser details, and explicit pass/fail observations in the [08](08-acceptance-and-delivery.md) proof record. |

- A screenshot alone cannot pass animation, movement, carrying, state independence, or repeat-export checks.
- **OPEN after go:** Tiled installation/export, Phaser integration, exact donor archive/frame inspection, Krita round-trip, interim clip mapping, and target-device behavior require actual tests. These are work the chosen route must perform, not additional design-approval menus.
- Do not expand into all four landmarks, a full boss set, or a large custom sprite budget while the room fails a foundational check.
- WP-01–WP-08 establish the mechanical/source/export foundation. An unavailable real phone for WP-09 is a pending evidence item, not a reason to stop independent desktop/content work or claim mobile passed. [15](15-after-go-workflow.md) owns the later whole-version and real-device finish line. The room is an internal milestone, never the complete website deliverable.
- After two failed quality attempts without new evidence, name the failure and change the relevant method, beginning with registration/export/timing corrections. Replacing the selected donor or starting new original production needs a documented reason and bounded scope; do not reopen open-ended character generation.
- Do not repeatedly generate more inconsistent frames, hide broken motion under particles, or flatten separate objects into a picture to make a screenshot appear finished.
- The winning route is the one with coherent motion, editable modular objects, repeatable exports, and real browser/mobile proof. Its runtime and source evidence become the baseline for the wider world.

## Interim flat platform material · 2026-09-07

Dex's latest platform correction is implemented as a flat code-native slab assembly in `game/platforms.ts`. The former FG01 image repeats its short bracket and edge pattern too visibly along a large surface. Keep that raster export as reserve material; the walking floor now uses a continuous pale cap and dark fascia, sparse world-coordinate wear and construction joints, and end caps only at genuine exposed collider edges. This is one structural material applied across existing geometry, not a new generated asset count.

FG03 piers remain separately placed authored supports. Connection plates appear only where those piers meet the slab; supports are never repeated at texture intervals. Each of the 44 stair treads keeps the map's exact x/y/width and 8 px-rise / 24 px-tread geometry, with shallow same-palette caps over a connected mass. Bridge/lift gaps remain empty in this renderer and their mechanisms keep their own transforms and geometry. No visible top plane, foreshortened edge, raster source edit or personal artwork is involved.

Normal, ultrawide and phone-emulated arrival/stair/Dispatch captures verify the quieter continuous appearance and first threshold traversal. Full-route mechanics and physical-device acceptance remain separate. The original FG01 image and earlier native/export receipts are preserved, with its changed active-use status recorded in19 rather than claiming the historical raster is still displayed.

### Generated material replaces the interim flat surface

Dex subsequently identified the flat procedural surface as visually out of place. The current platform uses a new, independently generated FG01 v4 strip over the same geometry assembly. A rectangular crop excludes the raw image's baked checker background and boundary bars, then the established BOX/48-color/no-dither export produces a480×72 native material. No edge painting, copied seam pixels or per-instance stretching is used. Three-repeat inspection and actual normal/ultrawide/phone captures show grain and cracks with clean joins, without the old bracket pattern.

`platforms.ts` now paints the generated cap/fascia at native1×, using a common world-coordinate tile phase and cropping each tile to its exact solid. Deep stair backing and separately placed support attachments remain geometry; they no longer stand in for the visible platform material. The old FG01 v3 image and the interim flat implementation remain preserved comparison history. FG01 is again a visibly rendered raster role, and44 stair tread coordinates plus real mechanism gaps remain authoritative.
