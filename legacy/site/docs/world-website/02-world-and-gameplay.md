# World and gameplay specification

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. The nonlinear room graph, freely opening Archive door, click attack, mobs/death/nearby respawn and fresh boss-to-product-menu visit replace the earlier gameplay/map/reward rules. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

This is a design contract for `dex.place`, not an implementation task or a claim that the game exists.

- **CONFIRMED** means Dex explicitly requested the behavior or constraint.
- **PROPOSED DEFAULT** means the concrete baseline chosen for review; it is not individually approved by Dex.
- **OPEN** means a factual input or verification is still required before the affected feature can ship.

Unless marked otherwise, every measurement, map detail, visual choice, control tuning value, and mechanic below is a **PROPOSED DEFAULT**. Implementing begins only after Dex says go.

## 1. Confirmed direction and limits

- **CONFIRMED:** The environment is a cinematic, liminal pixel platformer. The visitor can explore horizontally and vertically.
- **CONFIRMED:** Smaller characters and props within wide framing should make the environment feel spacious; eventual original animation is preferred, with a coherent authored donor accepted for now.
- **CONFIRMED:** The player carries a sword or katana and slices things to perform actions.
- **CONFIRMED:** Fighting a boss is part of downloading a selected file; defeating it leads into that download.
- **CONFIRMED:** Documentation appears as physical files in the world. Illustrations live in an exhibit hall. Donate uses the hall/exhibit idea as well.
- **CONFIRMED:** The four navigation labels are Downloads, Documentation, Illustrations, and Donate.
- **CONFIRMED:** Existing personal art is displayed only in Illustrations. It supplies no player, boss, environment, texture, promotional crop, or generation reference.
- **CONFIRMED:** Kaizen belongs to Convergence. Story descriptions are deferred and provide no world lore or game premise at this stage.
- **CONFIRMED:** The brand is lowercase `dex` in Daniel; prose should be restrained rather than promotional.
- Bruno Simon is a reference for a navigable portfolio, not permission to copy its map, vehicle controls, assets, or branding.
- No multiplayer, account system, public leaderboard, inventory, shop, progression tree, achievements, currency, or purchase-gated content enters this baseline.
- The game provides an expressive way to explore the website. Every section also has a normal DOM route.

## 2. Visual premise

The place is a deserted complex above still water: long platforms, railway-like structures, high windows, silent corridors, and rooms that open onto enormous skies. A compact useful path runs through structures far larger than their ordinary entrances and furnishings. Supports and roof spans continue beyond the frame; the small traveler makes their size apparent. The architecture feels usable but inexplicably empty. [01](01-art-direction-and-audio.md) owns the monumental scale, quiet-space and restrained-text targets.

| Element | Intended appearance and behavior |
| --- | --- |
| Main palette | Chalk white concrete, charcoal structures, pale sky, cool distant water, restrained crimson signals; [01-art-direction-and-audio.md](01-art-direction-and-audio.md) owns the exact tokens. Local lights may be warmer without defining a competing palette. |
| Player | A small independent traveler silhouette with one readable katana; dark clothing and one subdued red accent are proposed. A coherent licensed donor may serve the current stage; original animation is the eventual endpoint. No resemblance target drawn from Dex's existing art. |
| Scale | Small readable player and modest human-scale props within broad architecture, pylons, halls, and sky. Camera composition follows [01](01-art-direction-and-audio.md); traversal details and controls retain their readable size. |
| Pixel treatment | Deliberately authored pixel shapes, sharp silhouettes, limited clusters, consistent density; no mixed-resolution generated fragments. |
| Atmosphere | Stillness, distant machinery, reflection, haze, a few moving cables, and subtle cloth motion. |
| Red | Used for a few architectural landmarks, active targets, and the slash accent. It never carries essential meaning alone. |
| World text | Only necessary section names, prompts, file labels, and small contextual details. No slogans on every wall. |
| Story | Suggestion through space and composition; no scripted backstory, named factions, dialogue tree, or invented connection to Convergence. |

No horror jumpscares, flashing warning walls, blood/gore, lens dirt, heavy chromatic aberration, or compulsory film-grain filter. Bosses are original mechanical or abstract constructs that separate into inert pieces when defeated.

## 3. Map and routes

The initial map is one bounded connected level with a central arrival causeway and four landmarks. It contains one shared reusable arena, rather than a separate level for every downloadable file.

```text
                        Illustrations: Exhibition Hall
                        /                       \
                 stair /                         \ accessible lift
                      /                           \
     Downloads -- Arrival Causeway ---------- Donate: Support Alcove
     Dispatch        |                             |
     Terminal        | lower walkway               | covered corridor
        |            +-----------------------------+
     Boss Arena                   |
                              Documentation
                               Archive
```

The diagram expresses adjacency, not a final pixel layout. All normal routes are open from arrival; the arena is entered by an explicit encounter action.

| Location | Position and connections | Landmark and view | Essential interactions |
| --- | --- | --- | --- |
| Arrival Causeway | Central safe spawn; walk west to Dispatch, east to Support; stair/lift to Exhibition; lower walkway to Archive. | Long pale platform, bench, signal tower, enormous sky, still water below. | First control hint, section signs, return-home marker, ambient radio control through the DOM shell. |
| Dispatch Terminal | West of arrival; return by same path; arena entrance behind terminal. | Empty departure boards, hanging destination tags, loading-bay silhouette; warm single service light. | Approach terminal, press Interact, inspect files, choose a specific artifact, begin encounter or direct download. |
| Boss Arena | A contained room adjoining Dispatch; ordinary arena exit returns to terminal. | Broad dry floor, two reachable ledges, clear dark backdrop behind the boss, empty space around telegraphs. | Armed download battle, pause, retry, leave, optional replay after victory. |
| Archive | Lower east; reachable through a safe sloping corridor and lift; return to causeway or Support corridor. | Tall cabinets, long shafts of light, dry raised paths above shallow reflective water. | Inspect named loose documents, shelves, folder indexes, and the Archive index terminal (DOC-02); open readable documentation. |
| Exhibition Hall | Upper level; stairs from causeway, lift from Support. | Quiet white hall, generous spacing, roof lights, long sightlines, frames recessed into dedicated bays. | Open Illustrations; inspect artwork and its metadata in the gallery interface. |
| Support Alcove | East of arrival; adjoining Exhibition structure; lower corridor links Archive. | Small plinth and seating within a vast open structural bay; sky through an immense opening. Alcove names the human-scale interaction pocket, not a tight camera crop. | Open Donate; choose Ko-fi or MB Bank in the normal interface. No combat or precision movement here. |

- Playable map extent starts at approximately 3,200 by 960 logical world pixels; tile/collider planning uses a 16-pixel unit. These are greybox targets, not mandatory final asset dimensions or limits on the implied architecture. Decorative structures may extend beyond map/camera bounds without adding playable regions; use bounded modular layers rather than one enormous texture.
- A first visitor can reach any landmark from arrival in roughly 15–30 seconds without advanced movement.
- Optional roof routes and overlooks extend exploration; none contains an exclusive essential download, document, illustration, or donation method.
- Elevators are slow two-stop platforms with the Summon lift / Ride lift contracts in the interaction inventory below. No visitor can strand a lift outside reach.
- Route selection from the persistent tabs opens its DOM section immediately and relocates the paused world to that section's safe anchor.
- Closing a section follows [05](05-shell-and-system-controls.md): physical-prop entry restores that safe source position; tab/deep-link entry uses the section anchor. Home returns to arrival. Direct deep links skip the intro journey.
- A short optional camera transition may depict travel; the content never waits for it. Reduced motion uses an immediate cut.
- All anchors have enough flat space that dismissing a panel cannot drop the player into damage or a fall.

## 4. Place-specific composition

The following are starting scene sketches. Keep each destination's identity, connections, interactions and art-use boundary, while allowing its landmark silhouette, furnishing arrangement, framing and light to evolve together in the assembled scene under00/01. An exact gantry, cabinet count, cropped tower or bay count is not a product requirement. Use the supplied scale references to judge the relationship and vary the composition between places.

### Arrival Causeway

- Opening sketch: player low in the view on a clear causeway, an enormous structural form and a small red signal. A cropped support to the right is one useful start; a complete distant silhouette across open water is also valid if it delivers the supplied scale feeling. Long visible floor, ordinary nearby objects and quiet depth establish the relationship. The first settled frame must feel deliberately composed and immense without depending on a later explanatory zoom-out.
- [17](17-arrival-and-first-impression.md) owns loading, the causeway reveal and first-minute route. Camera is already settled when controls become available. Its brief interruptible exposure reveal adds no required fly-through, title sequence or cinematic loading delay.
- A single discreet hint says `Move · Jump · Slash`; actual bindings and touch buttons reflect the active input method.
- Section names are visible on physical signs and remain available in the navigation bar.
- One hanging cable may be cut to drop a short optional bridge; the baseline route remains usable beforehand.
- Returning home restores a calm view, not a forced reset of the whole level.
- Benches, cable targets, and the terminal approach remain modest in scale. Their placement, contrast, and existing prompts make them discoverable without filling the screen with props.

### Dispatch Terminal and arena

- Dispatch places its ordinary terminal beneath an immense quiet gantry and mostly unlettered departure board. Long blank floor/wall intervals separate structural supports. The small service light and terminal are local interaction cues; file names stay in the UI rather than filling the huge board with enlarged lettering.
- Approaching the terminal reveals `Open downloads` with the current Interact binding. Slashing the terminal never downloads anything.
- The arena camera establishes a broad view before control begins so the floor, boss, exits, and telegraph space are visible. It may be tighter than exploration using [01](01-art-direction-and-audio.md)'s arena ratio; it does not zoom onto individual ordinary attacks.
- Arena lighting emphasizes silhouettes and attack shapes. Decorative foreground objects never cover combat lanes.
- The bounded combat floor sits inside a much larger vault or structural aperture that extends beyond the frame. Architecture provides the overwhelming scale; keep the existing boss size/action scope and visible telegraph lane. Do not make the boss fill the screen to substitute for environmental composition.
- Defeat leaves the room readable and calm. No confetti, loot explosion, advertising banner, or invented reward inventory.

### Archive

- Loose files sit in sparse deliberate clusters along a small dry walkway beneath immense shelving shafts and light wells. Separate clusters with quiet wall/light intervals; keep only one nearby eligible prompt visible. A clear folder silhouette and gentle outline reveal interaction without a wall of floating titles.
- A readable nearby label identifies the document or topic before opening; visitors do not have to guess from a file icon.
- Interact opens the selected document at its actual route/anchor. Documents stay in place after reading and cannot be consumed or destroyed.
- Slashing adjacent paper seals can reveal decorative light or open an optional shortcut; it never deletes or damages documentation.
- A shelf index opens the full searchable document listing, including documents whose physical prop is out of view.
- Long reading occurs in the normal documentation panel, with the world paused and visually subdued.
- File props keep a readable silhouette at ordinary play size; spacious camera framing never shrinks document text, search, or reading panels to match their world scale.

### Exhibition Hall

- Empty, neutral architectural bays can exist in the world; personal artwork is only loaded/displayed while the Illustrations section is active.
- Reaching a bay reveals its title and prompt; using Interact opens Illustrations and the selected artwork. Proximity alone never forces a modal open. A visitor elsewhere does not see art through windows, reflections, previews, or cross-section transitions.
- Illustrations may present the hall as its own gallery composition behind the readable viewer; art remains within that section boundary.
- Start with one or two neutral exhibit bays in an establishing world view, broad empty wall intervals and an immense surrounding volume. Adjust bay count and ceiling framing to the actual composition; keep the full catalog in its panel rather than cramming every bay into the first shot. Frames leave clear breathing room. No crops are made to fill a wall unless separately approved for that display.
- Slash has no effect on artwork or its frame. There is no vandalism effect, hit flash over art, breakable painting, or art reward drop.
- Descriptions are factual supplied metadata or future authored captions. Convergence expansion waits for the later description pass.

### Support Alcove

- Shares the restrained architecture and exhibition pacing of the hall: a small warm plinth and bench inside a vast open bay, with a high structural edge leaving the frame and a long view of sky/water. Keep the interaction close and approachable while the surrounding volume remains enormous. No reused personal artwork.
- The plinth opens Donate. It is not a checkout, boss, collecting machine, or slot machine.
- Selecting an amount, copying an account, revealing a QR, or following Ko-fi happens in normal controls with the world paused.
- No simulated contribution counter, donor leaderboard, shaking collection jar, guilt copy, or fabricated bank confirmation.
- Leaving Donate preserves ordinary UI state where appropriate; it provides no gameplay power, access, or currency.
- The alcove's furnishings can be small within the wide hall composition; the camera must not enclose them in a cramped room. Bank details, QR, slider and touch controls keep their independent readable DOM sizing.

## 5. Player movement and controls

| Action | Desktop default | Behavior |
| --- | --- | --- |
| Move | A/D or Left/Right | Ground acceleration and a short deceleration; no drift that makes platform edges frustrating. |
| Jump | Space | Tap for a short jump, hold for a higher jump; press again for one additional air jump. No upgrade requirement. |
| Dash | Shift | Short horizontal dash in facing/movement direction; usable on ground and once per airtime. |
| Slash | J | Single readable katana arc in the facing direction; no combo input sequence. |
| Interact | E | Activate the single nearest eligible prompt. Never activates a hidden second target. |
| Pause/back | Escape | Pause active gameplay; otherwise close the topmost dismissible panel. |
| Section travel | Visible DOM tabs | Open section directly and pause/relocate the world. Never requires a game keybind. |

- Initial tuning target: run speed 120 logical pixels/second; horizontal dash 220 pixels/second for 160 ms; dash cooldown 600 ms.
- Jump target: approximately 64 pixels of height; 120 ms coyote time and 150 ms buffered jump input; forgiving landing edges without magnetic movement that feels uncontrollable.

**CONFIRMED 2026-09-07:** one additional air jump uses the same Space / touch Jump control. A fresh second press applies one upward impulse; holding, autorepeat or a third airborne press never supplies another. Grounded and coyote jumps preserve the additional air jump. After walking off beyond coyote time, one air jump is still available. A legitimate landing on solid ground, stairs, a lift or a settled bridge restores it; pause, blur, settings and focus changes do not. Jumping cancels an active dash so its upward impulse is not swallowed. The authored CC0 jump/fall poses remain unchanged; a few small pixels at the second-jump point provide local feedback, without new audio, screen flash or shake. Reduced motion keeps only a brief stationary mark. Restart/travel create the normal fully restored ground state.
- Slash target: 100 ms anticipation, 80 ms active contact, 180 ms recovery. One target receives at most one hit per slash.
- Movement direction is readable from the sprite. Attacking with no direction held uses the last facing direction.
- Slash does not lock the player in place for its full duration. A successful environment cut may add a small forward carry, but never an involuntary fall.
- Dash restores on safe landing. It never grants access to an otherwise inaccessible essential section.
- No wall-jump, grappling hook, stamina meter, weapon inventory, combo grading, or midair lock-on is included initially.
- Exact tuning remains adjustable data; acceptance is responsive, predictable control on desktop and touch, not adherence to provisional numbers despite failed playtests.
- Inputs only operate when gameplay explicitly has focus. Typing in search, amounts, settings, or any DOM control never moves or attacks.
- Entering a panel, losing window focus, opening an external link, or hiding the tab clears held inputs and pauses simulation.

## 6. Slice and interaction inventory

| Target | Affordance | Trigger and outcome | Persistence/reset |
| --- | --- | --- | --- |
| Hanging cable | Pale cable with marked cut point; outline plus slash icon in reach. | One slash separates the cable and lowers an optional bridge. | Open for the current visit; Restart world restores it. |
| Paper door seal | Clearly drawn seal across a nonessential side opening. | One slash breaks the seal; doorway reveals an overlook/shortcut. | Open for current visit; no document destruction. |
| Suspended geometric object | Small distinct original prop away from menus and art. | One slash splits it into a few fading inert pieces. | Decorative; no currency or tracked collectible. |
| Thin architectural seam | Readable line plus contextual label identifying the destination. | Interact opens the destination; optional slash animates the same opening when gameplay is focused. | No content gating; route remains available from tabs. |
| File prop | Paper/folder silhouette, title, Interact hint. | Interact opens that document. | Never disappears after reading. |
| Gallery bay | Neutral frame silhouette and artwork title within Illustrations. | Interact opens gallery item. | Selection is UI state, not a game collectible. |
| Support plinth | `Donate` label and Interact hint. | Interact opens Donate. | No gameplay state change. |
| Terminal | `Downloads` label and Interact hint. | Interact opens file catalog. | Slashes produce no file request or destructive effect. |
| Boss | Clear silhouette, health indicators, anticipatory attack shapes. | Slash during vulnerable state deals one hit. | Encounter state is discarded on leave/reset. |
| Ordinary scenery | No target outline or action prompt. | Slash passes without sparks, destruction, or misleading feedback. | Static. |
| Arrival home marker | Small `Home` marker; Interact hint. | E / touch Interact invokes SYS-01 exactly; returns to arrival, cancels encounter intent, no external action. | No separate saved state. |
| Archive index terminal | `Documentation` label; Interact hint. | Opens the complete documentation index using DOC-02. It is not a second help system or chatbot. | Same route/focus rules as Documentation tab. |
| Lift landing (WORLD-01) | `Summon lift` when platform is elsewhere; `Lift here` when docked. | E / touch Interact calls an unoccupied platform to this landing. While moving, show `Lift moving`; do not queue repeated commands or redirect a ridden platform. When arrived, summon is inactive and boarding is possible. | Pauses with world; resets to lower stop. |
| Lift platform (WORLD-02) | `Ride up` at lower stop / `Ride down` at upper stop while player is aboard. | E / touch Interact moves to the opposite stop at 32 logical pixels/sec. Carry the standing player; input during travel does not reverse it. Stop/dock safely, then allow dismount. | If empty and untouched for 8 seconds, return to lower stop; never auto-return while occupied. Both landings retain summon control. |
| Wayfinding banner (WORLD-03) | Rolled independent banner; in-range `Unfurl` with Slash / E / Interact. | Slash or equivalent deliberately opens a separately animated banner and accessible destination list; no route is selected by the strike. Close/Escape dismisses.18 owns its exact states, focus and cancellation. | Current presentation only; closes on navigation/reset/interruption; no progression requirement. |
| Banner destination (WORLD-04) | Four real labeled links on the unfolded banner. | Enter/click/tap invokes the corresponding existing SYS-02–05 route. No slash selects an item or triggers external action. | Same route/content/focus rules as the header. |

Only one contextual interaction prompt is active at once. Intentional collisions and decorative effects have distinct silhouettes. Every required action represented by a world prop has an equivalent labeled DOM control.

## 7. Boss encounter and file handoff

### One configured encounter template

- Use one original sentinel-like boss with a small configurable palette, displayed file name, and optional per-project cosmetic treatment.
- Do not invent a unique boss production requirement for every artifact or version. Every downloadable artifact can bind to the shared encounter template.
- Fight target: a readable 30–60 second first successful encounter; the encounter is not a grind or a skill exam.
- Initial player health is three hits; initial boss health is six successful strikes. Neither resource persists outside the encounter.
- Pattern A: 700 ms wind-up with a floor-level line and silhouette pose, one horizontal sweep that can be jumped, then 900 ms exposed recovery.
- Pattern B: 900 ms marked overhead strike aimed at the player's earlier position; walk or dash out, then 1,100 ms exposed recovery.
- Alternate the two patterns, beginning with Pattern A. No random unavoidable move, unseen projectile, bullet-hell phase, or surprise extra health bar.
- Player contact damage occurs only during the explicitly active boss attack, not from brushing against an idle decorative body.
- After a player hit, grant 1,200 ms visible invulnerability; no strobing. One attack cannot consume all three hits.
- Successful slash feedback: small contact pause up to 60 ms, one readable arc, brief local recoil, a dry metallic sound, and a clear health change.
- Camera shake is optional, subtle, and disabled by reduced motion. No fullscreen white hit flash.
- Failure returns the player to a safe arena entrance with `Retry fight` and `Leave fight` controls. No file or payment is required; no long replay animation.
- `Retry fight` reuses the same already armed artifact choice and restarts the encounter. `Leave fight` cancels that intent.

### Download intent state

| State | Entry | Allowed outcome |
| --- | --- | --- |
| Browsing | Visitor opens Downloads. | Inspect files; no download request exists yet. |
| Armed | Visitor explicitly selects `Fight & download` for one exact artifact/version. | Snapshot that selection and enter the arena. |
| Fighting | Arena begins with armed selection visible. | Win, pause, fail/retry, or leave/cancel. |
| Victory | Boss health reaches zero during an armed encounter. | Consume that intent once and attempt the browser file handoff once. |
| Handoff attempted | The selected file transfer has been requested. | Show selected file, attempted state, and explicit `Download file` button if another user-triggered attempt is needed. |
| Replay | Visitor chooses `Play again` after victory, labeled `Replay only`. | Practice only; no armed request and no automatic second download. |
| Cancelled | Visitor leaves encounter, navigates elsewhere, resets world, or chooses another file. | Clear pending intent; a later victory cannot trigger it. |

- Victory does not create or re-arm a download intent. One deliberate `Fight & download` action can result in at most one automatic attempt.
- A stale, removed, or unavailable artifact stops at a clear Unavailable result; never silently substitutes the latest version or another platform build.
- The UI can know that a handoff was attempted; it must not claim the browser finished saving the file.
- If automatic handoff is blocked or unsupported, the same selected artifact remains available through a real visible `Download file` button.
- **PROPOSED DEFAULT:** Offer the secondary `Download file` link beside the encounter option for accessible use, mobile utility, and returning visitors. This is a deliberate direct alternative, not an invisible boss bypass.
- Selecting direct download cancels any armed encounter; a later boss defeat cannot duplicate it.
- [03-sections-and-controls.md](03-sections-and-controls.md) owns exact labels and behavior IDs DL-05, DL-06, DL-10, DL-11, DL-12, and DL-14 as well as file metadata, platform selection, and unavailable/error copy. Those controls preserve these intent semantics.

## 8. Camera, sound, and lifecycle

- [01](01-art-direction-and-audio.md) owns starting camera ratios and readability guides. They measure usable world view, not the browser or padded sprite canvas; select the final composition from actual scale, route visibility and readable movement. A numeric range cannot pass or fail a scene by itself. Preserve the immense-place feeling even when a short viewport needs a larger traveler ratio.
- If floor, ratio, and viewport fit conflict, reframe or tighten the camera until the actor and next landing are readable. HUD, text, QR, and touch buttons never shrink to meet a world composition target.
- A camera change scales the world view uniformly. Player/prop collision geometry and authoritative movement remain constant; do not shrink a sprite separately from its body or alter hitboxes to suggest a larger space.
- Use a 16:9 landscape composition as the starting view and reveal more horizontal room at 21:9. Portrait has different look-ahead/framing and no giant landscape letterbox; it must show the next meaningful movement and safe destination.
- Camera follows with a modest dead zone and looks slightly ahead horizontally; it does not constantly recenter after every footstep.
- Frame platforms and fall destinations before the player commits. No leap requires guessing what is below the viewport.
- Major spaces have authored composition anchors; entering them gently adjusts framing without taking movement control away.
- Foreground structures may cross an empty part of the view, but never fully hide the player, hazards, buttons, or attack telegraphs.
- Decorative parallax, cloud drift, reflections, and cloth movement are restrained and stop with paused world simulation.
- Sound direction: distant machinery, concrete/metal footsteps, restrained piano and synth textures, distinct slash/contact cues.
- Sound begins only after an explicit Sound activation; Enter world alone does not enable it. Master, music, effects, and ambience controls use the mix/settings contract in [01-art-direction-and-audio.md](01-art-direction-and-audio.md); reading never starts an unexpected track.
- Entering documentation or other panels lowers/pauses the world mix according to audio settings; essential information always has a visual equivalent.
- A fall returns to the most recent safe platform without a death animation or health penalty outside combat.
- Pause exposes `Resume`, controls/settings, return-home navigation, and `Restart world` through the shared shell. Restart requires an explicit confirmation stating that it clears this visit's props and active encounter, not browser downloads, user files, or saved settings.
- World state is per visit and disposable. Keep user settings separately; no server account or persistent progression is required.
- Graphics failure leaves the DOM website usable, with `World unavailable` text and the shared `Try loading world again` SYS-27 control rather than a blank page.

## 9. Acceptance and remaining decisions

- First load shows useful navigation before gameplay finishes loading; each route works with gameplay unavailable.
- A visitor can traverse every essential destination without combat, advanced movement, sound, or a hidden clue.
- Each sliceable prop has a legible affordance and an observable, bounded outcome. Ordinary scenery never pretends to be interactive.
- Compare ordinary native gameplay with the same motion at nearest-neighbor 2× crop using [11](11-framing-and-sprite-comparison.md). Spacious framing can de-emphasize fine detail, but cannot conceal limb morphing, foot sliding, unstable pixels, bad collisions, or unreadable contact.
- Check exploration and arena scale on landscape, wide landscape, and portrait: small actors remain legible, landing/attack space stays visible, and all DOM/touch elements retain their independent sizes.
- Boss wind-ups, strike shapes, health, fail/retry, and exit are readable at the minimum supported viewport and with sound muted.
- Verify armed win, replay, retry, leave, route change, version removal, and blocked handoff: no duplicate or wrong-file request occurs.
- Verify closing a panel never resumes a held movement/attack key and never spawns a player over a hazard.
- Verify no personal artwork is visible or requested outside the Illustrations section, including reflections and transitional frames.
- Verify no game action mutates a payment amount, follows an external payment link, or implies a donation succeeded.
- Verify the world remains atmospheric without relying on heavy motion or loud music; reduced motion remains a composed scene.
- **OPEN:** Interim licensed-player suitability, eventual original-animation production, boss/environment assets, and final visual references require their respective production proofs; this document approves no use of the existing art as a reference.
- **OPEN:** Exact real artifacts and documentation records depend on the content inventory; missing content must not be filled with invented projects or releases.
- **PROPOSED DEFAULT TO REVIEW:** Direct download alternative, shared sentinel encounter, liminal complex map, and provisional movement/combat values above.

Mobile and accessibility behavior is defined in [06-mobile-accessibility.md](06-mobile-accessibility.md) and is part of the acceptance bar for every mechanic in this file.
