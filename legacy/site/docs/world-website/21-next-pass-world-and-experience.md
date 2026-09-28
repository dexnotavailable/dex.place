# Next pass: the inhabited world and website

Source specification 2.1 · Reconciled 2026-09-08 · **GO received 2026-09-08; adopted scope, implementation active.**

Dex rates the public foundation as "okay", not good or amazing. Existing functional receipts remain evidence for their tested revisions; they are not aesthetic acceptance of this next version. This chapter and [22](22-dex-account-treasury-and-social-presence.md) are the current change contract. They supersede conflicting first-pass rules in 00–20 without deleting that history.

The latest explicit GO authorizes the complete scope in this chapter. The earlier discussion hold is historical. [26](26-v2-implementation-record.md) records current local implementation and unfinished proof. Continue the read/build/step-back/inspect/replace loop; do not silently reduce the pass to a map prototype, account mock, silent ghosts or a collection of passing tests.

## Source pack to read with this plan

[23](23-code-donors-and-integration-sources.md) selects compatible code patterns and documents version/license traps. [24](24-animation-and-art-donor-catalog.md) expands the animation/art intake queue with verified free tiers and preview limits. [25](25-design-reference-and-production-rules.md) maps external references and the supplied scale images to room composition, physical animation and concrete rejection criteria. Read these before selecting or acquiring material after go. This2.1 research expansion leaves the confirmed feature scope below intact.

## 1. Settled requirements and proposed details

CONFIRMED rows below come from the latest discussion. Exact map geometry, visual treatments, timing, capacity and implementation choices outside those rows are PROPOSED DEFAULTS, accepted as the working baseline on go and tuned through actual inspection. OPEN means missing facts or evidence, not an invitation to defer ordinary taste decisions.

| ID | Confirmed next-pass requirement | Owner |
|---|---|---|
| N-01 | Rework the okay foundation into a cohesive, cinematic, emotional experience; technical compliance alone is insufficient. | This chapter's production and acceptance loop |
| N-02 | Nonlinear map; priority is Downloads, then Donate, Illustrations, Documentation. | Room graph below |
| N-03 | Reaching the art exhibit should be a journey that builds attachment. | Gallery approach, shortcuts and inspection |
| N-04 | The archive is behind a physical door into a separate room, with no key, puzzle or prerequisite. | Door and Archive contracts |
| N-05 | Scattered donation boxes, plus a treasury tracking top donors. | World boxes here; verified records in22 |
| N-06 | More assets and distinct spaces, including cozy refuge, enormous places, and doors transporting the player into interiors. | Room and asset production |
| N-07 | The world is sparsely inhabited; attendants communicate through gestures/services. Lore can come later. Encounters with someone should still surprise. | Population and service interactions |
| N-08 | Replace the cut dropdown with a physically released, inspectable map. Sword completes, cable falls, cut stays cut; it does not serve as quick travel. | Map assembly and controls |
| N-09 | Inspect each artwork separately; the folder can expose the entire collection. | Per-art inspection |
| N-10 | Proper loading/intro, deliberate continue with sound choice, immediate gameplay control afterward, gentler musical arrival. | Entry/scroll state machine |
| N-11 | Less visible instructional labeling, more discovery; click to attack. | Input grammar and cues |
| N-12 | Redesign topbar and menus through typography/layers/compositing; cinematic black bars; scrolling moves from game into a proper website. | Dual presentation and UI surfaces |
| N-13 | Literal name `dex account`; shared identity across dex.place, dexCode and dexClient; saved exploration, donation history/credit, expandable app integration. | 22 |
| N-14 | Other visitors are tinted social ghosts; local avatar is normal. Each player retains independent combat and progression. | 22 |
| N-15 | Remote avatars fade after about one minute without movement or intentional talking; talking also keeps a stationary visitor active. | 22 |
| N-16 | V proximity voice chat; mobile needs a usable equivalent. | 22 |
| N-17 | Sparse mobs can damage, knock back and kill; respawn nearby. | Combat and recovery |
| N-18 | Every new world visit to a product menu requires a fresh boss victory. Boss death leads through black to the product menu; choose the download there. Direct downloads remain available by scrolling into the website. | Product/encounter state machine |
| N-19 | Find and use more properly reusable assets, especially coherent authored NPC/enemy/boss animation. | Donor intake below |

Retained requirements: small traveler against enormous compositions; unmistakable, consistent pixel art; fully 2D side-view structural assets; continuous platform material; double jump; useful bridge/lift logic; independent fog/light; lowercase `dex` in Daniel; restrained copy; personal illustrations only in their display section; existing Ko-fi/MB Bank facts and100k–10mil VND range; real mobile, accessibility, audio and public proof. No corporate slogans, fabricated product releases or provider-generated character sheets replace the selected authored CC0 player.

## 2. Supersession map

| Previous active rule | Current replacement |
|---|---|
| Boss deferred; Fight & download disabled (16/20) | A real first boss is required in this pass. Existing unready UI is only the public baseline. |
| Victory automatically requests a pre-armed file (02/03/08) | Victory authorizes one world product-menu visit. A deliberate menu action requests the chosen artifact; victory itself requests no file. |
| Permanent project unlock proposed during discussion | Rejected. Saved discoveries or past wins never bypass a new world product-menu encounter. |
| Reversible banner with four destination links; E or slash releases it (18/20) | Slash severs a real fastening, the map settles open and stays open. E then inspects. No travel links and no E-cut. |
| One long room sequence or diagram-only branching | Separate rooms, vertical choices, doors and return loops must be traversable in the actual game. |
| No black bars; first click only focuses game (17) | Responsive bars and deliberate intro entry that acquires controls and attempts the chosen sound state in the same gesture. |
| Persistent four-tab game header; viewport-only content/Browse toggle (05/06) | Restrained game chrome plus a full, scrollable web presentation below. Native scrolling, direct URLs and reading remain usable. |
| No accounts, cloud saves, multiplayer or voice (00/07) | The bounded account, treasury, social presence and voice contracts in22 are in scope. Shared combat remains excluded. |
| Empty/abandoned as the universal population rule | Sparse residents, service gestures and occasional mobs; large quiet stretches remain essential. |
| Original primary order Downloads/Documentation/Illustrations/Donate | Labels/routes stay. New spatial priority is Downloads/Donate/Illustrations/Documentation; matching web-nav order is the proposed default. |
| Proof counts or preview plates from the first pass certify the next map | Reuse evidence only for unchanged code/assets at its actual scope. New map, UI, services and audio require new integrated evidence. |

Unchanged low-level content, QR, source licensing, accessible semantics, failure handling and hosting rules in00–20 remain valid. Their obsolete victory, navigation, entry, population and scope claims do not override this table.

## 3. Spatial design and room graph

This is a proposed adjacency and composition plan, not a locked pixel layout. Names are production names; do not print them everywhere as branding or invent lore around them.

```text
                         lookout -- reservoir crossing -- gallery
                            |                              |
arrival -- junction -- dispatch -- door -- solo arena      | return lift
              |                                           |
           door -- hearth/counter -- treasury -------------+
              |                        |
           archive door -- archive ----+ rear passage
```

The graph is explicit: Arrival↔Junction; Junction↔Dispatch↔Arena; Junction↔Hearth↔Treasury; Junction↔Lookout↔Reservoir↔Gallery; Gallery↔Treasury via lift; Junction↔Archive through a freely opening door; Archive↔Treasury through a rear passage. Gallery's return lift is first released from its gallery landing as a useful discovered shortcut. It needs no collectible key; the web gallery is always directly available.

| Space | Composition, activity and important actions |
|---|---|
| Arrival | Wide exposed first frame, small clear hero, one monumental silhouette. No enemy, forced camera tour, crowd of labels or NPC lineup. It leads promptly into a genuine junction. |
| Junction | The arena/dispatch route has the strongest sightline. A physical map assembly belongs here where learning the layout matters. Hearth light and the upper path offer distinct alternatives. |
| Dispatch | Product identity belongs at the arena approach. Choose a real catalog product, inspect its factual identity, and explicitly enter its encounter. This is the main game path, not the general direct-download panel. |
| Solo arena | Independently loaded/readied encounter space with readable ground, attacks and landing geometry. Boss visual scale comes from composition and suitable sprites, not crude enlargement. Social audience is separated from the fighting space. |
| Hearth/counter | Human-scale warm interior reached through a door; one attendant provides `dex account` services. Seating, a donation box and quiet work gestures support lingering. No hostile spawns. |
| Treasury | A larger, distinct chamber adjoining the refuge. Its ledger shows actual verified top donors under22's publication policy, with another unobtrusive donation point. An empty ledger is truthful. |
| Lookout | Upper route with an immense reveal and exposed air. Several quiet screens can pass without a character. A small resting point is a natural place to meet a visitor. |
| Reservoir crossing | A different enormous volume between overlook and gallery, with a deliberate change in depth, light and sound. Traversal includes purpose-built bridge/lift geometry and sparse authored enemy pockets. |
| Gallery | Arrival after the journey feels sheltered and attentive. Give each currently approved illustration its own spaced, individually inspectable bay, bound to the existing catalog ID; keep the roster data-driven. A collection folder exposes all works; at most a few resident gestures. The return lift turns a long arrival into a convenient subsequent loop. |
| Archive | Ordinary door opens into a much deeper, quiet interior. Files open exact articles, shelves/folder expose the index. No login, puzzle, combat or collected-key gate. Rear passage creates a return loop. |

Downloads and donation services are close to arrival. The gallery has an expressive longer route; the archive remains clearly reachable despite lower visual prominence. Priority must never be implemented as another compulsory four-room corridor. Each doorway defines target room, entrance anchor, facing, light/audio transition, safe return and loading fallback. A failed interior load leaves the visitor safely at the source door with Retry or the usable web section.

## 4. Population, combat and recovery

Residents have useful roles, limited work/idle gestures and short functional service interfaces. No automatic dialogue, quest markers over every head, invented biography, AI chat or lore writing is included. Reuse real idle/walk clips first; additional service gestures need authored frame/prop coordination and honest source records.

Most compositions contain no resident or enemy. Populate designated stopping places rather than every room. Actual visitor ghosts create unpredictable encounters under22. Do not fabricate online visitors to fill a quiet server.

Mobs spawn only in authored encounter pockets, with a quiet interval and a local population cap. Show a readable emergence/wake/patrol rather than popping into contact with the player. Service areas, entry, art/article inspection and menus are protected. Spawning, damage and motion pause with the local simulation. Mobs and bosses share damage, knockback, hit reaction, death and recovery rules, with different tuning. NPC attendants and other visitors cannot be damaged.

Proposed recovery: full health at a nearby protected checkpoint, held inputs cleared, brief protection and enough separation from nearby enemies to prevent a death loop. Keep exploration, map cuts and shortcuts. No corpse run, lost currency or inventory system. Checkpoints are authored near room entrances/encounters, never calculated from arbitrary recent position. Player death in the arena resets that fight and returns to its nearby entrance/retry state; it does not open the product menu. Falling uses the same safe recovery vocabulary, with its exact damage amount tuned in play.

Retain double jump and improve attack readability, contact timing, stairs, platform edges, knockback limits and footsteps together. Combat input must not trigger donation, account or browser actions.

## 5. Product encounters and victory handoff

```text
world product approach -> select product -> enter arena -> fight
  player dies -> nearby retry -> fresh fight
  boss dies -> finish death beat -> black -> that product menu
  menu Download -> explicit browser file request -> menu remains usable
  leave menu -> arena approach; next world menu visit requires another fight
```

Each encounter binds a product ID and encounter definition. Every product actually exposed through a world arena must have a usable encounter mapping; do not fabricate an unfinished product or distribute a stale installer merely to populate doors. First usable product remains dex.place's genuine documentation bundle unless a separately verified current product is available. Catalog-driven arena variants can reuse a proven authored boss implementation while varying the actual product presentation; a new release does not require repainting the whole game.

The proposed visit rule was acknowledged in discussion: one victory opens the product menu until that visit ends. Browsing versions or retrying a failed/cancelled download inside that open menu does not require a new fight. Closing/leaving it, changing to another product, refreshing or restarting ends that world visit. Persisted account history is never an encounter skip. A hidden tab pauses a valid visit/fight; it cannot complete combat or issue a transfer unseen.

The final blow must complete visibly; boss body/VFX/death have their own state and timing. Hold a short breath, fade/cut to black with the sound tail, then reveal the product-specific menu with useful focus. Reduced motion uses a short direct transition. This is boss defeat, not a player death screen. Cancelled/stale callbacks cannot open the wrong menu or reopen a dismissed one.

The product menu is a full themed presentation of the selected real product, including available versions/files, factual details and explicit Download controls. It uses the same catalog/content logic as the website below, without duplicating file-selection code. Victory requests no file. Download status distinguishes requested, unavailable, failed/cancelled and retry; it never claims installation or receipt of an OS-saved file without evidence. The direct web route/deep link opens product content immediately and requires no fight or account.

## 6. Input, physical assemblies and visual cues

Input ownership: focused gameplay uses left mouse button for slash, J as the keyboard equivalent, E for inspect/use, the existing movement/double-jump bindings, and V for intentional proximity PTT. Mobile supplies usable movement/jump/attack/context/PTT controls. Normal DOM controls keep ordinary click/tap/keyboard meanings; typing V/J/E in a field never speaks or fights. Clicking UI never leaks an attack behind it.

Visible labels are restrained. Silhouette, light, local motion, facing and proximity response make objects discoverable. Contextual bindings/accessibility names and optional Controls help remain; removing all usable cues is not the goal. Keep exact account/amount/file/microphone states explicit where ambiguity has consequences.

The map assembly is independently authored: support, intact fastening, two cable ends, map body, lower weight and local shadow. State: intact → blade contact → severed/releasing → falling/unfurling → settling → permanently open. The sword keeps its attack pose through contact and follow-through; opening a DOM layer must not sheath it midway. No full modal opens automatically on the cut. Only after release can E inspect the map. Close dismisses the readable view and leaves the physical object open. Save its local exploration state; intentional world reset can restore it.

The inspected map shows the current room graph, visitor location, discovered routes and available return shortcuts. Its legend explains symbols with real text. It contains no quick-travel destination links. A non-combat accessible map view/assisted slash remains available through the relevant accessibility controls without making E silently cut the cable.

Each artwork display binds one art ID. E opens a focused inspector for that piece, with fit/zoom, caption where known and return to the same exhibit. Do not open a whole collection grid behind it. The folder explicitly opens the catalog. Personal art stays unpixelated and ungraded inside its dedicated display/viewer, outside all world textures, UI backdrops and generation references.

Bridges, lifts, doors and service surfaces follow the same anatomy/state discipline: fixed attachment, moving parts, contact/activation, travel, settlement, interruption and return. A component must have an observable purpose. Remove decorative pseudo-mechanisms that cannot be made coherent. Platform texture repetition, perspective, actual collision and prop registration are inspected together.

## 7. Loading, cinematic play and the website below

Proposed state model: loading → entry ready → playing → inspection/menu OR web browsing → deliberate return to play. Direct URLs begin at their corresponding web content, with no compulsory intro journey.

The first frame establishes composition while essential assets load. It is actual task-owned environment art, never personal gallery artwork or an unrelated loading illustration. Show honest progress/status and a usable route into the website if rendering/loading fails. Load the complete minimum first scene and controls before enabling Enter; stream further rooms with clear door-boundary handling. Do not download all new art/audio/NPCs before first control.

`Enter` has a clearly visible sound choice. Proposed default: Sound on is visibly selected at entry; an existing muted choice is respected. Nothing audible plays merely because the page loaded. The deliberate Enter gesture attempts the selected audio state and gives game focus, without requiring a second click. Sound rejection does not block movement. Give music negative space and a gradual entrance; the first frame, sound and first controllable moment must be evaluated together.

Black bars frame the game without clipping the character, controls or critical ground. Their size is responsive and tunable, not a universal fixed crop. Scrolling down releases gameplay/PTT input, pauses simulation, opens the bars and exposes a properly laid-out website. Use normal page scrolling rather than trapping the wheel in a cinematic animation. Scroll gestures inside a document/inspector scroll that content rather than unexpectedly ejecting it. Reduced motion has immediate states; mobile respects safe areas and provides a reachable Browse action so control pads do not trap page scrolling.

Game chrome is restrained: `dex`, Sound, Menu and an accessible route to Browse/controls. Full website navigation lives below, proposed order Downloads, Donate, Illustrations, Documentation, with account access as a utility rather than a fifth main content tab. Use stable direct paths, useful anchors, Back/Forward and deep links. Website route changes do not silently teleport the saved world character. Returning restores the actual safe world position; an explicit Resume/Enter action reacquires gameplay rather than hijacking keyboard focus while reading.

Physical inspections keep their location/return context; longer browsing can transition into the corresponding full web section. In both cases the same semantic content/components serve the data, while presentation fits the material and amount of reading. Preserve independent panel scroll positions and accessible focus restoration. In the scrolling website, an active Illustrations section means its display is actually visible in the viewport or explicitly entered through its navigation/item link; pathname alone is insufficient. Fetch personal art only for that active display/inspector. Do not preload a hidden gallery merely because all four sections coexist in the page, and do not project its images into global backdrops or other sections.

## 8. UI, artwork and audio direction

Redesign typography, hierarchy and composition as a coordinated kit: short pixel headings/labels, the Daniel wordmark, readable article/body text, independent frame/backing/edge/light pieces and authored transitions. Generated raster backing may supply material, but text, focus, hit targets, links, forms and QR remain real DOM content. Never bake visitor text or account fields into a generated page image. Long articles need scrollable reading space, not an oversized in-game popup squeezed into a corner.

Archive surfaces can feel like pages and folders; Dispatch like a prepared product record; Treasury like a ledger; art inspection like an intentional exhibit. Share material, edge, spacing and typography rules so these do not become four unrelated website themes. Avoid an undifferentiated CSS card stack, oversized titles, sales copy, decorative gibberish and incoherent SVG structural placeholders. Small purposeful vector/accessibility icons and procedural light/particles remain implementation choices, not an excuse for unproduced main assets.

Expand the current51-role library according to the new room/actor/UI requirements. The earlier ~50 target is a starting inventory reference, not a cap or a quota to pad. Acquire and produce the additional useful roles needed for these rooms, actors and interfaces. Inventory each new foreground, prop, middle, background, actor animation, UI backing and sound role with planned/acquired/generated/reviewed/integrated status. Never count frames, placement repeats or palette alternatives as new independent world-art roles. Build a per-room coverage table and replace rejected existing assets rather than merely accumulating files.

Production stays separate and layered: coherent individual foreground/platform/door parts, props, middle depth, backgrounds, actors and lighting. No one-shot world or all-assets image sheet. Generate focused missing pieces; preserve authored actor animation. Validate feet/pivots, visible pixel pitch, scale and source rights in an actual assembled scene before batch expansion. Large structural surfaces need finer source detail than small terminals at their respective world sizes. Preserve fully 2D geometry and independent render lighting/fog with Low/reduced alternatives.

Initial donor shortlist, source-page verified2026-09-08; files and visual fit still require intake after go:

| Donor | Proposed role and available motion | Reuse boundary |
|---|---|---|
| [Evil Wizard 2, LuizMelo](https://luizmelo.itch.io/evil-wizard-2) | First boss candidate; idle/run, two attacks, jump/fall, hit/death | Free, CC0; same creator as Martial Hero is a compatibility prospect, not proof |
| [Bringer of Death, Clembod](https://clembod.itch.io/bringer-of-death-free) | Alternate melee/caster guardian; attack/cast/spell/hit/death | Free commercial project use/modification; custom redistribution/resale restrictions, not CC0 |
| [Monsters Creatures Fantasy, LuizMelo](https://luizmelo.itch.io/monsters-creatures-fantasy) | Skeleton, mushroom, goblin, flying eye with authored combat clips | Free, CC0; inspect all required files, do not infer archive completeness from page list |
| [Gothicvania Town, Ansimuz](https://ansimuz.itch.io/gothicvania-town) | Four townsfolk with idle/walk; selective service-space donor | Free base art listedCC0; Plus files are paid, and bundled fonts/music require their own rights check |
| [Lively NPCs, chierit](https://chierit.itch.io/lively-npcs) |49 idle-animated character choices; conditional attendant/background use | Free, CC BY4.0; credit required; proportions/orientation may not fit |
| [Necromancer Free, CreativeKind](https://creativekind.itch.io/necromancer-free) | Conditional caster alternative; three attacks, run/hit/death | Custom commercial/modification terms; no standalone redistribution. Orientation and referenced separate spell pack remain unverified |

Archive exact originals/licenses and check which tier includes each file. Do not ship donor packs as downloadable website assets or treat a product-use license as permission to redistribute an asset bundle. Choose a small coherent cast, not one representative of every free pack.

Keep the selected Suno B theme as the musical identity. Shape a spacious opening and calm transitions, a controlled orchestral arena variant, warmth at the refuge and intentional silence while reading/closely inspecting art. Avoid the earlier energetic opening and unrelated end-section contrast. Footsteps, sword contact, cable fall, paper/door/lift settlement and distant ambience need coherent levels/timing. Voice gently ducks music without making the entire world pump. Inspect real listening transitions, loop boundaries and mobile interruption behavior. New generations or hosted voice capacity require current entitlement/cost checks; do not assume old credits or spend ElevenLabs by default.

## 9. Changed and added control contracts

This registry supplements unchanged SYS/DL/DOC/ART/DON controls.22 owns account, treasury, presence and voice details. Every actual control still records accessible name, input, bound content ID, state, focus/history, failure/cancel/repeat behavior and evidence before shipping.

| ID | Surface/action | Required result and interruption behavior |
|---|---|---|
| NX-01 | Enter / Resume | Enter selected sound state and gameplay focus together; clear stale input; render/audio failure never traps web access. Repeated activation does not restart intro/music. |
| NX-02 | Entry Sound choice | Explicit on/off state, remembered mute, no playback before gesture; error retains playable silent state. Voice consent remains distinct. |
| NX-03 | Scroll / Browse website | Release gameplay/PTT; pause; reveal web area and bars transition; preserve world position. Inner-panel scrolling stays local. |
| NX-04 | Return to world | Restore view/position and a clear Resume opportunity; no accidental keyboard capture or pending attack. |
| NX-05 | World left-click/J/mobile attack | Execute authored swing and contact event; no DOM actions or NPC/ghost damage. Blur, pause and pointer cancellation release held state. |
| NX-06 | E/mobile contextual use | Use one valid nearby door, service, file, released map, lift or artwork. E cannot cut the map fastening; other documented assisted mechanism controls remain separately named and registered. Deterministic target selection. |
| NX-07 | Cut physical map | Contact severs fastening, sword completes, cable/body settle; repeated hits cannot reset or trigger links; saved state stays open. |
| NX-08 | Inspect/close map | Read complete authored layout/current discovery state; optional pan/zoom/reset-to-fit; no teleport; close restores source focus without furling. |
| NX-09 | Enter/leave room door | Transition only after target ready; fixed safe anchor/facing and return; failure/retry/repeated input cannot teleport twice or strand player. Archive entry has no prerequisite. |
| NX-10 | Inspect one artwork / close | Exact art ID and dedicated inspector, no collection grid; close restores original exhibit/pose context safely. |
| NX-11 | Collection folder | Explicit full catalog with existing per-art links; ordinary back/scroll/focus and missing-item behavior. |
| NX-12 | Product selection / enter fight | Select real product and bind valid encounter; unavailable content has honest state; no file download on approach. |
| NX-13 | Player defeat / Retry / leave | Nearby protected recovery; reset current boss, preserve chosen product if retrying; never confuse with boss-victory handoff. |
| NX-14 | Boss defeat → black → product menu | One valid current victory completes death/transition and focuses correct product menu; no automatic download; stale/cancelled events do nothing. |
| NX-15 | Product file/version / Download | Same real catalog as web; explicit file identity, ordinary browser request and retry. No download-success/installation fiction. |
| NX-16 | Leave product menu | End world visit, reset encounter for subsequent world approach; no stored permanent access bypass. Direct web access remains direct. |
| NX-17 | Donation box / treasury ledger | E opens existing donation choices or verified ledger; no amount preselection trick, transfer, rank or account change caused by slash.22 owns records. |
| NX-18 | Counter service | Gesture leads to real dex account state/service; signed-in profile/history or signed-out login/register; no lore/chat system.22 owns form behavior. |
| NX-19 | Gallery return lift latch / summon / ride | First gallery-side release opens a real return connection; subsequent summons/carry cannot strand player; persistence and remote phase filtering agree. |
| NX-20 | Menu / Settings / Controls / Close | Retain accessible semantic controls in themed materials; clear input/PTT on open, restore valid focus on close, preserve the intended paused/resume state. |

## 10. What happens on go

1. **Re-read and establish the candidate.** Read21/22, the23–25 source pack and focused owners; capture current public payload/service identity and rollback. Branch/isolate scoped work as appropriate without committing. Check free storage against actual asset/build forecasts; move only identified safe archival material if necessary. No age-based deletion.
2. **Resolve expensive foundations early.** Verify existing account service and website callback/session flow, progress schema and donation evidence route. Prove a small real presence/voice connection across independent clients with viable media routing and a known cost/capacity envelope. Keep local website hosting; don't silently move the whole site. Scope-dependent identity/security/payment or unavailable-device gates are reported specifically while independent work continues.
3. **Build the actual nonlinear map skeleton.** Traverse the entire graph with the real hero: choices, elevations, doors, cozy/monumental compositions, gallery approach/return, archive and product arena. Check mobile framing and timings. A paper diagram is not acceptance. Replace weak layout before expensive scene dressing.
4. **Prove the complete experience through one connected route.** Intro/sound/focus → movement/slash → correctly falling map → door/service → mob death/nearby respawn → real boss defeat/black/product menu → explicit download → scroll into full web content → resume. Include account/presence seams early; do not finish a beautiful isolated room while core transitions remain fake.
5. **Produce and integrate the whole cast, world and UI.** Intake authored animation donors, generate focused missing layer assets, assemble each room, update inventory, and tune grid/pivots/lighting. Rebuild UI surfaces, per-art displays, all content and useful mechanisms. Preserve already working data/QR/hosting behavior through shared components and regression proof.
6. **Complete accounts, treasury and social voice.** Real registration/login/recovery/session, saved progress/guest merge, verified contribution history/ledger, ghost motion/activity/room membership, PTT/listening/mute/block, compatible private worlds, mobile and interruption behavior. Failure of a service must leave the ordinary website usable; it does not count as completion of that service feature.
7. **Step back repeatedly.** Play/listen/view the current integrated candidate at normal size after each substantial block. Judge loneliness, surprise, scale, pixel coherence, physical contact, clarity and pacing. Record failed methods and pivots. Do not turn numerical targets or this starting geometry into brittle constraints that protect a bad result.
8. **Finish and publish the whole pass.** Complete the matrix below and22, copy/content/license review, new performance budgets and public deployment verification. Produce a NEW immutable public documentation edition (proposed1.1, source2.1), updated allowlist/sanitizer/reader/search/module/ZIP/hash policy and real download identity. Never overwrite published1.0. Promote through the existing host with rollback only after the candidate works; recheck actual dex.place, routes, files, services and media. No commit/push without Dex asking.

A new go accepts this full reviewed pass; it is not approval for unlimited paid plans, destructive unknown-data actions or unrelated desktop-product rewrites. Actual blockers remain explicit and cannot be hidden behind mocked accounts, invented donation totals or local-only voice tests.

## 11. Acceptance matrix for this pass

All rows start **not tested for2.1**. Record actual revisions, screenshots/motion/listening, platform and user-reported versus agent-operated evidence.22 adds its service/security/privacy/voice cases;08's unchanged artifact, art, QR and accessibility cases still apply.

| ID | Required proof |
|---|---|
| V2-01 | Entire nonlinear graph walked in both useful directions; distinct choices, doors, elevations and Gallery return shortcut work. Priority does not become a linear tour. |
| V2-02 | First frame, cozy room, immense reservoir, gallery and archive each pass composition/motion inspection; most travel views remain sparse. |
| V2-03 | Cold/fast/slow/failed loading, direct link and interrupted entry; one deliberate Enter acquires movement immediately and applies the chosen sound state without a second focus click. |
| V2-04 | Bars and native scroll handoff at desktop/ultrawide/portrait/tablet/reduced motion/zoom; web content is complete and controls never crop or trap scrolling. |
| V2-05 | Left-click/J/touch attacks and E contextual use have clear ownership; no input leaks through controls, text fields, panels or scroll transitions. |
| V2-06 | Map intact/contact/cable fall/sword follow-through/unfurl/settle shown in motion; inspect/close/reload preserve cut; no hidden quick travel or E-cut. |
| V2-07 | All doors load/return/retry/repeat safely; Archive opens without prerequisite; differing room and progress states do not produce ghosts walking on local empty air. |
| V2-08 | Each art instance opens only its intended piece; folder opens all; close restores safe world position; raw world/loading/UI assets contain no personal art. |
| V2-09 | Mobs: readable sparse spawning, real damage/knockback/death, nearby protected respawn, no service/panel damage or immediate repeated death. |
| V2-10 | Boss: genuine responsive fight using authored clips; player defeat resets fight nearby; boss defeat completes death, black and correct product menu with no download request. |
| V2-11 | World visit ends on leave/change/reload; every new world product-menu entry requires a new win; saved account state/past victories never bypass it. Repeated victory callbacks cannot duplicate handoff. |
| V2-12 | Product menu: real versions/files/details, explicit successful browser requests and safe retry/unavailability; direct scroll/deep-link path has no fight/account dependency. |
| V2-13 | Account login/register/recovery/logout and cross-product identity verified against the actual backend; website session isolation, guest progress merge and safe revised-map resume proven. |
| V2-14 | Donation boxes preserve all recipient/amount/QR behavior; real confirmed records drive private history and opted-in treasury totals, with dedupe/correction/anonymous/empty/error proof. |
| V2-15 | Two or more independent clients show normal local and tinted remote actors; independent boss/mechanisms, compatible room geometry and no ghost collision/damage are proven. |
| V2-16 | Movement OR intentional talking refreshes activity; expiry around60s fades; new activity reappears; idle animation/background/reconnect cannot create crowds or duplicate avatars. |
| V2-17 | Actual remote voice across separate networks/devices, distance/room separation, permission denial, press/release/cancel/blur/disconnect, mobile hold control, listening/mute/block and visible speaker identity work. Local loopback alone is insufficient. |
| V2-18 | Every rebuilt menu/dropdown/button has semantics, readable focus, scroll/close/keyboard/touch/error states and a coherent physical/material presentation. |
| V2-19 | Full listening journey: gentle entry, selected-theme identity, calm travel, controlled arena variation, intentional reader/art quiet, footsteps/contact timing, voice ducking and clean loops. |
| V2-20 | Expanded asset/animation/UI inventory maps actual source/license/tier/pivot/grid/role to runtime; no placeholder main bodies, incompatible perspective or stretched pixel clusters. |
| V2-21 | New first-frame/load/frame-time/image/audio/network capacity budgets measured on the complete candidate; late-loading rooms and Low/reduced fallbacks retain atmosphere and access. |
| V2-22 | Samsung Internet/Android and iPad Safari integrated checks, desktop browser coverage, real200% zoom, keyboard and actual screen-reader speech; exact versions/evidence scope recorded. |
| V2-23 | New public docs edition includes21/22 after privacy transformation, has reader/search/ZIP parity, working links and exact file identity; published1.0 remains unchanged. |
| V2-24 | Public dex.place routes, redirects, TLS, downloads, account callbacks, ghost/voice service connectivity and retained legacy/SP13 artifacts verified after promotion; rollback and source pointers current. |

## 12. Remaining factual checks and exclusions

No more taste questionnaire is required to continue the adopted implementation. These factual checks are work to resolve, not silent permission to cut features:

- Existing identity service deployment, permitted callbacks, email delivery/recovery and real browser sessions need live proof. Follow22; no secret material enters the public docs.
- The initial treasury can use a real owner-confirmed reconciliation workflow. Automated Ko-fi/bank receipt support must be verified; no bank scraping or fabricated integration. Public identity/amount preferences were not answered, so22 uses explicit opt-in defaults.
- Voice needs a tested transport and a known capacity/cost plan. No new purchase or network-security change is inferred from free-asset research or the website go.
- Donor archive completeness, frame registration, exact redistribution rights and actual fit need intake. Provider asset credits/entitlements must be rechecked before spending.
- Real Narrator speech and saved-QR import were unverified in the public first-pass checkpoint. Carry those forward honestly; the earlier user report confirms recipient/100k amount and the requested Samsung/iPad playtest, not every future version or import method.

Deferred/excluded: authored lore/Convergence expansion, NPC conversations/AI chat, shared combat/co-op/PvP, user asset uploads, economy/currency/loot/skill trees, paid gameplay/donation privileges, fake donor/player counts, telemetry SDKs, automatic installer execution and unrelated app redesigns. The literal `dex account`, public treasury and scoped social voice are authorized additions under the current GO, not reasons to reopen those unrelated features.
