# dex.place — whole-map exploration

Status: three visual proposals for discussion. None is selected, implemented, or published. The previous website remains shelved and preserved. Dex explicitly authorized planning image generation; a new implementation go is still required.

Latest review: Dex prefers concepts1 and2 aesthetically, with more negative space, bigger rooms and stillness for arrival. Compressed/chaotic spaces remain valid later. The [single-room arrival study](arrival-stillness.md) explores this refinement using both references; it does not approve either map layout or settle the story.

Story accepted: [The Registry backbone](../story-candidate.md) establishes displaced rooms, an optional courtyard-reconnection opening arc and construct wardens for repeat dispatch encounters. Dex responded positively to the quieter arrival image; exact production geometry and animation remain unapproved. Current focus is the game world and its in-world panels. The lower scrolling website is deferred for now, so references below to that website describe eventual scope rather than current work.

## Confirmed direction

- A 2D side-view pixel-art world with a complete website available by native scrolling from the outset.
- Backrooms-like familiar but improbable spaces; Monogatari-like surreal framing and atmosphere; Hollow Knight is primarily the tactile movement and combat reference.
- Calm, vibey exploration with unease in the setting. Danger is concentrated around encounters, not an automatic horror escalation.
- Human-scale foreground furnishings, a small legible character, enormous impossible distant forms, coherent visible pixel clusters.
- Account registry table and accountant near arrival, available without combat or an exploration prerequisite.
- Arena for repeat in-world download encounters. Boss defeat leads through a black transition to the selected product menu; the actual file remains an explicit download action. Direct downloads remain available through the lower website.
- Archive behind an ordinary freely opening door, no prerequisite. A distinct exhibit reached by a longer scenic journey, with a convenient return.
- Scattered donation boxes with an easy adjacent top-donor view. No treasury room. Existing payment evidence and donor privacy requirements are not replaced by a mock leaderboard.
- Original personal artwork stays display-only. No personal illustration was sent to generation; the sheets use generated neutral gallery stand-ins.
- No slogan or subtitle beneath dex. Concept titles and route annotations are planning labels, not selected visitor copy.

## New production method

Realise the complete room/page composition first. Derive functional layers, occluded backgrounds, mechanisms and animation from that accepted visual target. Reassemble the original view and compare before expanding the content. This supersedes the previous requirement to generate small pieces before a complete room. The lower website follows complete design -> responsive compositions -> real components/materials -> interaction states. A planning sheet is not a production sprite sheet or a guarantee of animation coherence.

## Current sheets

1. [The Open Atrium](open-atrium.png) — 8 principal spaces. Clearest connected architectural arrangement, warm open sky, a short arena branch and an upper gallery circuit. The revision removes unwanted generated slogans and moves the return lift beside the safe concourse.
2. [The Courtyard Between](courtyard-between.png) — 10 spaces. Familiar school/civic rooms, pool crossing, roof walk and upside-down city. The final revision replaces the disconnected upper stair with a complete lift. Its placement now crowds the registry; separate those compositions during a selected-room refinement rather than adopting that overlap literally.
3. [Suspended Interchange](suspended-interchange.png) — 10 spaces. Night sky and impossible reservoir, compact services below and a separate scenic circuit above. The lift/registry roof landing needs a more precise room-level approach drawing if selected.

All three are illustrated topology and atmosphere proposals. They are not collision maps or scale-locked animation assets. Whole-map humans and inset humans are shown at different camera scales. Exact stair landings, door leaves, lighting separation and visible pixel pitch remain room-level work after selection. Do not claim playability from these pictures.

## Intended connections

### The Open Atrium

- Main: Arrival <-> Account Registry <-> Concourse <-> safe arena threshold <-> Arena.
- Lower loop: Registry <-> Archive <-> Concourse. Archive door is freely openable.
- Scenic: Concourse <-> Waiting Room landing <-> Sky Walk <-> Exhibit.
- Return: Exhibit <-> lift <-> safe Concourse. Its landing must remain outside the fight boundary.
- Donation/top-donor points: Registry, Concourse, Waiting Room, Archive entrance, Exhibit foyer.

### The Courtyard Between

- Main: Arrival <-> Account Registry <-> Courtyard <-> Vestibule <-> Arena.
- Lower loop: Registry-side landing <-> Archive <-> Vestibule. Archive remains optional and ungated.
- Scenic: Courtyard/Registry-side safe landing <-> lift <-> Empty Classroom <-> paired blue door <-> Pool Crossing <-> Roof Walk <-> Exhibit.
- Return: Exhibit red door <-> Courtyard-side safe door, outside the arena.
- Donation/top-donor points: Registry, safe main-route rest point, Archive entrance, Pool landing, Exhibit foyer. Final placement can redistribute the safe main-route point between Courtyard and Vestibule.

### Suspended Interchange

- Main: Arrival <-> Account Registry <-> Interchange <-> Vestibule <-> Arena.
- Lower loop: Registry-side landing <-> Archive <-> Interchange-side landing.
- Scenic: Registry/Interchange safe landing <-> lift <-> Overlook <-> Waiting Room <-> paired blue door <-> Water Passage <-> Exhibit.
- Return: Exhibit red door <-> Interchange red door.
- Donation/top-donor points: Registry, Interchange, Waiting Room, Archive entrance, Exhibit foyer. The generated Overlook donation marker can consolidate with Waiting Room when laying out the shared landing.

## Interaction and pacing intent

Registry is a few steps from spawn, never a registration gate. The direct arena approach should be unmistakable; art discovery has the longer sequence of contrasting spaces and a useful return. E/Interact reads or uses services and doors; slash belongs to combat or a physical object whose changed state has a visible purpose. No arbitrary slash-to-website action is introduced by these sheets. Top-donor plaques open/read actual opt-in confirmed donor information when implemented; blank planning rows are not contributions.

The world remains optional. Scrolling exposes a separately designed website with direct downloads, docs, art, donations and account access. No exploration achievement is required for those functions.

## Provenance and review

- Route: built-in image_gen. Three independent concepts and three targeted revisions, six calls in total. No API/CLI fallback or generation-model selector was used.
- Exact prompts: [prompts.json](prompts.json).
- Delivered files are copied byte-for-byte from generated outputs, preserving originals in the tool-managed directory. Copy hashes matched.
- The first atrium draft and first two courtyard drafts are superseded, not additional layout choices.
- Final map files: open-atrium.png, courtyard-between.png, suspended-interchange.png.
- No executable code, runtime config, public site, account data, payment configuration or published documentation ZIP was changed.
- Decision pending: Dex selects a layout or combination, then we refine the opening composition and the room connections. Selecting a picture does not by itself authorize implementing the website.
