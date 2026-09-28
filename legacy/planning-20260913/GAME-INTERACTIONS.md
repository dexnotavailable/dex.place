# Registry game interaction inventory

This is the game-only implementation companion to GAME-BUILD.md. The complete-room references define composition; the whole-map image defines connections/shared landmarks, never literal dimensions. Changes made after visual or gameplay inspection must be reflected here and in the runtime manifests. Correct-looking behavior matters more than retaining an initial numerical setting.

## Entry, input and interruptions

| Surface | Action and result |
|---|---|
| First load | Fetch the real arrival/checkpoint materials and authored player clips. Show actual progress. Enter stays unavailable until the required room is ready. |
| Enter | One explicit gesture focuses gameplay and starts the chosen sound mode. The Enter gesture must not also attack. No forced admiration timer. |
| Sound on/off before entry | Select the initial preference without playing anything. Default on is a preference; browser audio still waits for Enter. |
| Sound icon after entry | Start/resume or mute through the actual audio manager. A failure presents a retryable status message. |
| A/D or arrows | Move. The initial arrival camera holds the central composition until the traveller commits to a direction. |
| Space | Buffered, variable-height jump; release and press again for the available double jump. |
| Shift | Dash with its existing cooldown/air availability. |
| Left pointer / J | Slash in the current facing direction. A direct artwork pointer hit opens that artwork instead. |
| E / Use | Use the nearest eligible door, service or object. It never substitutes for cutting a restraint. |
| Touch controls | Separate left/right, Use, Dash, Attack and Jump buttons; movement and an action can be held together. Release/cancel clears input. |
| Escape / pause icon | Pause and open the menu. Escape inside a nested panel returns to its parent, then closes back to the game. |
| Tab | Release gameplay keyboard ownership. Resume explicitly reclaims it. |
| Focus loss / hidden page | Clear held input and pause sound/gameplay. Returning must not silently resume movement or surprise audio. |
| Loading Retry | Retry the failed material/chunk operation. Missing art never becomes a procedural placeholder. |
| Stay here | Cancel a pending room passage and return control to the room that is still present. |
| Reload game | Recover an unsuccessful game/panel startup through the isolated entry; preserve valid saved progress. |

Every modal owns keyboard focus, supports Escape and has an explicit close control. Closing returns focus to the canvas when gameplay resumes. Reader/art inspection pauses dangerous gameplay. NPC dialogue uses a compact bubble while its anchored acknowledgment remains visible.

## Places and physical state

| Place | E / inspection | Slash / physical outcome |
|---|---|---|
| Arrival | No service content in the first camera. Automatic room boundaries lead left to the overlook and right to registry. | Ordinary player attack only; no introductory obstacle. |
| Overlook | Bench offers rest and a quiet view; no progress prerequisite. | No mechanism. |
| Registry | Accountant gives the red-rail/tree clue. Courtyard door initially reveals sky; after the far-side latch it becomes the return passage. Donation box and adjacent donor record are separate services. Archive-side connection returns near its actual doorway. | NPCs/furniture are not destructible. |
| Junction | Ordinary room doors; inspect the map after release. At each overlapping staircase mouth, Use makes a brief200ms first step onto the chosen flight, then ordinary directional movement traverses it. | A real jump-and-slash contact severs the map restraint. A grounded slash below it misses. |
| Dispatch vestibule | Select the current documentation collection; Leave closes the panel, Enter arena begins a fresh challenge. Donation point remains safe. | No ambient fight in the vestibule. |
| Arena | Pause includes Leave arena. Victory opens the selected collection menu after the defeat/blackout beat. | Warden telegraphs, attacks and recovers. Damage, knockback, invulnerability, nearby respawn and retry are real. Each new collection visit creates another full-health warden. |
| Archive | Ungated ordinary doors; inspect records, search titles/content, open a record, return to its list. The lower path loops back to registry. | No quest lock or combat gate on documentation. |
| Service passage | Doors connect junction and reflecting room. Low obstacles and a sparse seal sentry use the same movement/combat rules. | Sentry can damage/kill the traveller; nearby recovery remains possible. |
| Reflecting room | Dry walkway and bench; left returns to service passage, right proceeds to sky walk. | No swimming system. Actual sky/cloud/ring layers reflect beneath the animated ripple layer. |
| Sky walk | Ordinary end doors. | Cut the real cord; fixed post remains fixed, the two cord pieces move from their respective attachments, and the hinged deck lowers over a real gap. Crossing waits for the lowered walking surface. |
| Exhibit | Each of nine originals has an individual E/pointer inspector. A separate catalogue shows all nine. Donation box/record remain distinct. | No destruction or generation use of personal art. |
| Courtyard | Operate the maintenance latch, then use the return door. Bench/tree establish the destination. Returning near the accountant presents and saves the changed routine. | Latch is a Use action: its fixed mounting plate stays still while the independent lever rotates. |

The map's top rod stays fixed as its six-frame sheet unfolds. Its final state persists and opens a layout inspection; it is not fast travel. Map and bridge cuts are irreversible within a save. Starting again explicitly clears this game's guest progress.

Door leaves, surrounding trim/recess and opening mask are separate. Normal-sized doors sit within larger architectural openings. Visible stone material must replace a flat placeholder rectangle; opening exposes the appropriate passage/sky through the leaf aperture. Closing/cancelling restores the door state cleanly.

## Panel controls and results

| Panel | Controls |
|---|---|
| Pause | Resume; Settings; Controls; Start again; Leave arena only during an encounter. |
| Settings | Master/music/effects sliders; reduced motion; explicit combat assistance; normal/large touch controls. Assistance extends openings and prevents combat damage and is never used to claim an ordinary victory proof. |
| Start again | Keep exploring or clear the isolated guest save and return to central arrival. No shared dex account data is touched. |
| Accountant | Short accepted courtyard clue or acknowledgment; Continue returns to play. No credential form or pretend registration. |
| Courtyard sky door | Inspect the disconnected opening; Step back. Visiting it does not complete the story. |
| Rest | Rest returns to a quiet view and restores local health. |
| Courtyard latch | Release latch changes the physical lever, persistent shortcut and later accountant response. Closing alone does nothing. |
| Map | Read the full connection graph; dim markers/lines may indicate unseen places, but room labels remain readable. Close returns to the released banner. |
| Collection choice | Current documentation title; Leave; Enter arena. |
| Collection after victory | Edition selector, format/size, explicit Download, expandable filename/hash details. Closing returns to the safe vestibule. |
| Illustration | Fit, zoom out/in, Previous/Next and Close. Original aspect is preserved. Seen state records an actual successful image load. |
| Illustration catalogue | Nine distinct thumbnails/titles open individual inspectors; return/close preserves panel history and focus. |
| Records | Search, record selection, reader navigation and Close. Existing published edition1.1 remains clearly identified and immutable. |
| Donate | Existing Ko-fi redirect or MB Bank panel,100,000–10,000,000VND amount controls, recipient/account facts, QR generation/save and adjacent Top donors. Bank/QR behavior is reused without altering shared payment configuration. |
| Top donors | Honest disconnected-preview state and link back to Donate. No invented names, totals or payments. Backend/account linking is the next phase. |

## Current presentation and production anchors

- One authored52px traveller throughout;96px warden,52px sentry,62px seated accountant. Ordinary furniture is judged against that common body: bench40px, counter28px, donation box42px. Larger architectural openings are not permission to enlarge every foreground prop.
- The12 source room compositions are1672×941; the reference camera maps them to1600×900. Arrival additionally has two600px structural continuations. Ceiling/camera bounds must not reveal a hard cut at the edge of a room plate.
- Per-asset native dimensions, pivots, attachment points, frame durations, loop/hold states and exact placement live in the published catalogue and its private source manifests. The warden's common416px body basis is maintained across crouch, hit and collapse; each pose is not scaled to its own changing bounding box.
- Map unroll is600ms; bridge lowering is1.1s. Fixed hardware does not inherit moving-part transforms. Sword contact uses both axes and the active attack window.
- The selected SunoB cue already contains2.65s of lead silence. The new entry adds350ms breath and an8.5s smooth onset; arena uses1.1s breath and5.5s onset. Ambience starts independently before score decoding, compatible rooms retain music transport, archive/selected passages and inspection have deliberate silence. Subjective listening is separate from scheduling tests.
- Generated backgrounds, props and animated sheets were made through the built-in image tool. Originals, rejected variants, prompts, masks, crop proofs and publication hashes remain under `D:/Dex/Projects/dex-place-art-production/registry-game-20260913/`. Personal artwork appears only as original display content in the exhibit/inspectors.
- Room-local GPU textures are released after their objects are destroyed; required current/shared materials and player clips remain. Return passages reload through normal caching. Measurements label source-RGBA estimates separately from actual browser/GPU memory.

The lower website, account integration, online ghosts/voice and additional content are intentionally awaiting Dex's next guidance. The current delivery remains the complete isolated guest game.
