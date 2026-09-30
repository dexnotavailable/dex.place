# World plan: "The Round"

The final plan for the dex.place world, for the phase 2 build. Everything except mobs and bosses
is in scope. It supersedes draft 1 in `MAP-AND-STORY.md`.

It is built on the winning draft, layout 2 "Descent and Ascent" (`plan-drafts/layout-2.md`), with
grafts from layout 1 (`plan-drafts/layout-1.md`) and layout 3 (`plan-drafts/layout-3.md`).
Section 15 lists what came from where. The side-view map and the pacing chart are in
[`WORLD-MAP.svg`](WORLD-MAP.svg).

Content is exactly `CANON.md`. The plan covers:

- the arrival, scenery first
- the dex account counter near the start
- donation boxes with donor plaques at rest places
- the slashable map banner
- the archive (docs) behind an ordinary door
- the arena with the boss terminal and its summoning states, but no boss
- the chapel of light with Dex's 9 artworks
- the website, one scroll away from anywhere

**What already exists** (checked 2026-09-29). Phase 2 builds on these; it does not start over:

- the locked scale config, `src/scenes/engine/scale.ts`;
- the arrival scene, `src/scenes/scenes/arrival.ts` (the ring-lake + colossus hybrid);
- the **world runtime** at `/world/` (`src/world/**`, documented in [`RUNTIME.md`](RUNTIME.md)).
  It already has rooms as data sized in H, streaming, doors and latched shortcuts, lifts, the
  camera with framing zones, the lab player scaled to H = 80, weather and time, sound wired (not
  yet listened to), E-to-use with DOM panels, the save, debug and touch. It is proven on a 3-room
  test world (arrival, plain, house) with stub props;
- the **pixel matter engine** at `src/pixel/**` (documented in
  [`../props/ENGINE.md`](../props/ENGINE.md)), proven in the `/props/` sandbox with the map
  banner, boss terminal, donation box and donor plaque, stained glass, candelabra, destructible
  floor and font. Connecting it to the runtime is a proposed adapter (RUNTIME.md, "Props").

The rooms, story, props and flow below are not built yet.

---

## 0. In plain words

You arrive on a small dock at the edge of a still lake. A broken ring hangs over the water with
the sun in its hole, and a colossus the size of weather walks the far shore. The lake reflects all
of it. Nothing asks anything of you.

**The route.** A muted red line on the boards points right.

1. Up a cliff stair to the keeper's lodge: the account counter, the first donation box, and a door
   in the loft that opens onto a dusk sky, although it is morning.
2. Out through the reeds, where a colossus wades close enough to rock the water under you.
3. Across a long flooded causeway into rising wind. A black spire sits on the horizon with a storm
   stuck to it.
4. Down into a warm city inside a fallen structure. The archive is here.
5. Up a lift and a storm-lashed climb to the arena at the spire's top.
6. Onto the spire's blade, where the storm tears open.
7. Down a fallen piece of the ring at dusk, to the chapel where Dex's art hangs.
8. On the chapel's bell balcony, a latch opens the loft door you saw in the first minute, and you
   step back into the lodge.

**The shape.** Drawn from the side, the route is a W. It starts at water level and drops to the
lowest point (the city). It climbs to the highest (the spire), then settles in the middle (the
chapel) before the door brings you home.

**The pacing.** Vast spaces and small rooms alternate about every minute. The tension rises once,
from serene to storm, peaks at the arena, and then breaks, so the second half is the calm after
the storm.

**How long it takes.**

- A first round takes **12 to 15 minutes** with stops to look.
- A returning visitor reaches any destination in **under 2 minutes** through shortcuts they opened
  themselves.
- The website reaches everything instantly.

---

## 1. Locked scale (one config, the source of truth)

**Where it lives.** `src/scenes/engine/scale.ts` exports `SCALE`, and it is the source of truth
for these numbers. The scene engine and the world runtime read it: `src/world/config.ts` derives
its names from it and authors room geometry in H through `h(n)`. Nudging H there rescales
everything written in H below. Nothing in this plan is sized in raw pixels.

**One loose end (closed by P0, 2026-09-29).** `src/pixel/scale.ts` now reads
`src/scenes/engine/scale.ts`: it only renames the numbers for the pixel engine (`SCALE.H`,
`closeupH`, `present.integerCover`) and uses the same `presentRect`, so nothing can drift apart.

| Key | Value | What it means |
|---|---|---|
| World view | **1280 x 720** world px | Double the old 640 x 360 in each direction: "twice the resolution". |
| Presentation | The largest whole-number nearest-neighbour upscale that fills at least 92% of the fitted size (`present.integerFill`). Otherwise **sharp-bilinear**: nearest up to the next whole multiple, then a linear downsample to fit. | Pixels stay crisp at 1.5x on 1080p. Never plain bilinear. |
| **H** (player height, exploration) | **80 world px**, sole to crown | About 11% of the view height. The old site's hero was about 6%, so ours is a little bigger, as Dex asked. |
| Close-up render | **144 px** | Only for cut-ins, combat zoom and portraits. Never used for walking around. |
| One screen | **16 H wide x 9 H tall** | The unit for room sizes ("screens") in this plan. |

**What "twice the resolution" does.** At 1280 x 720 the scene engine's `ctx.u` is 2.

- Things sized to the view get twice as fine: the ring, sky, clouds, water rows, far cities.
- Things sized in H stay chunky next to the player: docks, doors, lamps, props.

That is CANON's rule from "How assets get made": chunkier pixels near, finer far. It is also what
makes the distance read as huge.

**Camera scale is locked too.** (Revised 2026-10-01, Dex: the camera stands further back
outside and zooms in indoors.) The world renders a 1536 x 864 frame; outside the whole frame shows
(19.2 x 10.8 H), interiors zoom in until the room fills it (16 x 9 H or closer). Scenes are still
composed at 1280 x 720 and extend past it (RUNTIME.md "Frame and zoom"). Combat zoom and cut-ins use the 144 px close-up render. How the character runtime's
`zoom` event maps onto it belongs to the character lane (`docs/character/RUNTIME-CONTRACT.md`),
not to this plan.

### Movement, in H

The lab's movement tuning (`src/lab/data/tuning.json`) is authored for a 96 px character. The
world runtime already keeps the same feel: `src/world/player/scale.ts` scales speeds,
accelerations, jump velocities and gravity together by `SCALE.player / 96` (the `K` in
`src/world/config.ts`), so every jump covers the same number of H, and nudging H keeps every gap
in this plan valid. Timings never scale.

The heights below were **measured in `/world/`** (`src/world/tools/flow.mjs`), and since W0 the
distances across too (`src/world/tools/reach.mjs`, on the flat pier of the grey-box A0, real
input at 60 Hz, 2026-09-29).

| Move | Reach | Design limit, with margin |
|---|---|---|
| Run | 2.0 H/s, so one screen takes 8 s | |
| Walkable step (no jump) | the runtime steps up 0.26 H by itself (`PHYSICS.stepUp`) | 0.25 H |
| Single jump | **1.02 H up, 1.30 H across at a run (measured)** | **ledges up to 0.9 H, gaps up to 1.1 H** |
| Jump + double jump | **1.70 H up, 2.27 H across (measured)** | ledges up to 1.5 H, gaps up to 1.9 H |
| Ground dash | **1.14 H (measured)** | |
| Jump + double + air dash | **3.17 H across (measured)** | dash gaps up to 2.8 H |

**Rules the map follows.** They keep the world friendly to people who never play games.

- **Required route** (every destination, every donation box): walking, stairs, lifts and single
  jumps only.
- **Double-jump lines** are optional: views, rooftops, benches, a bell.
- **Dash gaps** are for secrets only, and each has a visible catch ledge below it.
- **No fall damage and no bottomless pits.** Water or a missed climb puts you back on the last safe
  ledge with a splash or a gust, a short fade, and no damage.
- **If the round drags in playtest**, raise exploration run speed in the config (for example to
  2.4 H/s). The geometry stays put.

### Standard sizes

These are the pieces the player touches most. They are fixed so the player reads as a person among
ordinary objects. The pixel column is at H = 80.

| Thing | In H | px at H = 80 |
|---|---|---|
| Stair step (rise x tread) | 0.2 x 0.3 | 16 x 24 |
| Ramp | at most 30° | |
| One-way platform thickness | 0.15 | 12 |
| Ordinary door (h x w) | 1.4 x 0.7 | 112 x 56 |
| Big door (chapel, lift gate, arena shutter) | 4 x 2.5 | 320 x 200 |
| Counter or lectern top | 0.55 | 44 |
| Bench or pew seat | 0.28 | 22 |
| Donation box / donor plaque beside it | 0.5 tall / 0.6 x 0.4 | 40 / 48 x 32 |
| Shrine lantern on its post | 1.5 | 120 |
| Lamp post | 2.5 | 200 |
| Map banner: rod width / unrolled cloth | 1.8 / 2.4 tall | 144 / 192 |
| Boss terminal | 1.4 x 1.0 | 112 x 80 |
| Artwork frame, landscape 16:9 (works 01 to 05) | 2.4 x 1.35 | 192 x 108 |
| Artwork frame, portrait (06 is 2:3; 07 to 09 are 9:16) | 1.6 x 2.4 / 1.35 x 2.4 | 128 x 192 / 108 x 192 |
| Lowest cozy ceiling | 2.2 | 176 |
| Flat ground where ghosts gather (benches, shrines, views) | at least 6 H wide | 480 |

### Camera modes

Each room names one mode:

- **Locked.** The room fits one screen and the camera doesn't move. Used for cozy rooms: the
  stillness and the visible ceiling are what say "indoors".
- **Rail.** Follows x only. Used for long horizontal rooms.
- **Free.** Follows both axes, with look-ahead. Used for vertical rooms.
- **Vista hold.** After you stand still for 2 s, the camera eases in whole pixels to a composed
  framing, with no zoom. Used at the dock, Pier's End, the Blade and the balcony.
- **Arena.** Clamped to the arena floor while the terminal is summoning.

**Anchors.** The anchor is how far down the view the player's feet sit.

- Vast exteriors: 0.72 to 0.80, so the sky dominates. The dock is 0.8.
- Ordinary rooms: 0.64, the lab's default.
- Downward rooms (Hollow Mouth, Pilgrim Path): 0.35 to 0.5, so you see where you're going.

**What the runtime has today.** One global anchor (`CAMERA.anchorY` 0.78 in
`src/world/config.ts`) with look-ahead and a 0.55 H vertical dead zone. Framing zones already
give fixed compositions with extra bars, which covers most of the vista hold. The locked, rail,
free and arena-clamp modes and a per-room anchor are W0 asks (section 12).

**Settled by R-A (2026-09-29): the dock's deck sits at 0.8.** The scenes lane first composed the
arrival with the deck at 0.91 of the view. Looked at side by side with the world's bars
(`review/world/phase2/R-A/anchor/compare-091-vs-080-with-bars.png`): at 0.91 the deck is 20 px
above the bottom bar, the player's reflection and the pilings' are cut off, and a phone's touch
pad covers the dock; at 0.8 the lake gets a full reflected player and pier under the dock, the
sky still fills the top two thirds, the figure stands against the sparkle path, and every
Ringwater room keeps the feet on the same row. `src/scenes/scenes/arrival/geo.ts` `DECK_AT`
holds it.

---

## 2. The story: "The Round"

This keeps draft 1's Procession and folds in the one arc Dex accepted from the Registry: a door
onto empty sky, a long way round, a latch released from the far side, and a quiet cup break. It is
told by where things are, not by text.

**The world.** Colossi walk a slow line around the lake, toward a broken ring that hangs over the
water. They never notice anyone. People live in the hollows of fallen megastructures and keep lamps
burning at shrines along the colossi's route, so travellers can find their way. Nothing explains
the ring, the colossi or the spire.

**The small human story.** Last night's storm is still sitting on the spire, and it blew the shrine
lamps out. This morning only one lamp is lit: the lantern on the dock where you stand, which the
keeper tends.

You are a traveller with a sword (currently Rosace, a priestess, which suits a lamp-lighting
round). You rest at each shrine, and resting lights its lamp. That's the whole mechanic. Nobody
asks you to do it, and no quest text tracks it.

**Residents: three, and only one of them speaks.** CANON wants it lonely enough that meeting
someone is a surprise.

| Resident | Where | What they do |
|---|---|---|
| **The keeper** | the lodge, later Pier's End | Runs the counter. Says two lines in the whole game. |
| **The ferryman** | asleep in his boat at Pier's End | Wakes later, waves, runs the ferry. No lines. |
| **The archivist** | the archive | Reads. A pressed E gets a hum, not a word. |

The market also has a few unnamed silhouettes working. None of them can be talked to.

### The beats

1. **Morning on the dock.** Only scenery. The lit lantern beside you is the one lamp still
   burning. The colossus walks the far shore through the light shaft, and the lake mirrors it. A
   muted red line on the boards runs right.
2. **The lodge.**
   - The keeper is behind the counter with her ledger. Pressing E on the ledger opens the dex
     account panel directly. Pressing E on her gets her first line, once: *"Storm took the lamps
     again."*
   - On the wall behind her, a **lamp board** holds six small lamps, one per shrine. All six are
     dark.
   - Upstairs, a door with a red mark opens onto **a dusk sky** although it's morning outside. A
     maintenance rail bolted from the far side bars the doorway.
   - Through it you see, far below, the lake, a tiny ring, and a black spire with a storm sitting
     on it. You are looking at the world from somewhere very high. Nobody comments.
3. **The first shrine** in the keeper's yard.
   - Resting lights it. The lamp posts along the shore path come on one after another, as if they
     share one wick.
   - The map banner hangs rolled on the shrine's arch.
4. **The reed shallows.** The colossus plants a foot in the shallows at middle distance. A ring
   ripple crosses the whole lake and washes through the reeds around your ankles.
5. **The causeway.**
   - The long walk into weather. The spire is on the horizon ahead with its storm, and the ring is
     behind you.
   - A colossus passes close enough to shake the ground.
   - A small shelter stands on the flats, displaced from somewhere ordinary: it's a bus stop.
6. **The hollow.**
   - A warm city inside a fallen structure. The colossi are felt here, not seen: dust sifts from
     the ceiling in time with footfalls far above.
   - The archivist reads.
   - At the Hollow Mouth you pull a lever that lifts the culvert gate. A horn sounds down the
     tunnel, and far off, the ferryman wakes.
7. **The lift and the storm.**
   - The lift climbs out of the amber into cold blue, with the pale planet behind the spire.
   - It stops where lightning broke its rail, so you climb the outside in rain and gusts.
   - Halfway up there's a window alcove with candles, a bench and rain on the glass: the coziest
     place inside the worst weather.
8. **The Crown.** The arena at the top. The boss terminal is dormant, with rain running down its
   screen. Using it is optional.
9. **The Blade.** You step past the arena and **the storm tears open**. From above the weather you
   see:
   - the colossi *below* you for the first time,
   - the lake and the ring,
   - the lamps you have lit, as small points of light back along the way you came.

   You started tiny under them. Now you stand above them.
10. **The pilgrim path at dusk.** A fallen ring segment leans from the spire down toward the far
    cliffs. You walk down its curved back through puddles holding the sunset. A bell hangs from a
    rib.
11. **The chapel.**
    - On the porch, a broom leans by the door. On a hook hang an old shawl and a dusty second cup.
      Someone used to come up here for her break.
    - Inside, the nave is dim, and the rose window is shuttered. Dex's 9 works can already be
      inspected in candle light.
    - One crank opens the shutter. Sunset floods through the rose window and lights the works one
      by one down the aisle.
12. **The latch.**
    - On the bell balcony there's a small door with the same red mark. Its maintenance rail is
      bolted on this side.
    - Release it, and the bell rings once by itself. The door opens into the keeper's loft.
    - The dusk sky was this balcony all along.
13. **Home.**
    - The lodge is empty and its front door is open.
    - Ringwater is lit for evening for the rest of this session. On the bench at Pier's End sits
      the keeper with **two cups**, one set down beside her.
    - Sit, and she says her second line: *"There they go."* The colossus passes. All the lamps
      you lit stand in a line across the valley.
    - No banner and no "complete" message. The round ends with something visibly different.

**What the save keeps.**

- The arrival goes back to morning on every new visit, because the first impression is canon.
- Lit lamps stay lit. They show on the lamp board, on the map, and as tiny flames in the distant
  layers.
- The loft door always opens straight onto the balcony.
- A patch of dusk light falls through it into the loft for good. The keeper's chair and cup sit in
  that patch on later visits, the same small change the Registry arc ended on.

**Wardens** are not built in this phase. When they are, they follow the Registry's accepted logic:
constructs formed by dispatch seals at the Crown, so you never kill a resident.

### Visual rhymes

These hold the world together and do the wayfinding without labels.

- **The ring.** It is huge over the dock and behind you on the causeway. It is hidden in the
  hollow, small and far from the Crown, and at eye level from the balcony, with the sun in its hole
  again.
- **The colossi.** One wades at the dock. They walk close on the causeway and are felt as dust in
  the hollow. From the Blade you see their backs, below you. From the balcony they walk in a line
  along the horizon.
- **The red.** The floor line on the dock, the red cloth on the causeway posts, a red pipe along
  the market, the red pennants on the spire, a red ribbon on the chapel door, and the red mark on
  both sides of the sky door.
- **The lamps.** One lamp is lit at the start. Each shrine you light adds one, and the ending shows
  a line of them.
- **Water.** The lake, the sheet water on the flats, puddles in the storm, sunset in the puddles on
  the ring, and the font in the chapel porch.

---

## 3. The route at a glance

Coordinates are in H. x runs west to east. y is elevation, with the lake surface at 0. Room ids
match the map.

| Id | Room | x | Floor y | Size (w x h, H) | Screens | Camera | Region / ref |
|---|---|---|---|---|---|---|---|
| A0 | Pier's End | -20..0 | 0.3 | 20 x 9 | 1.25 x 1 | rail, vista hold | Ringwater / w03 |
| **A1** | **The Dock (arrival, spawn at x 16)** | 0..34 | 0.3 | 34 x 9 | 2.1 x 1 | rail, vista hold | Ringwater / **w03 + w01** |
| A2 | Cliff Stair | 34..46 | 0.3 to 6 | 12 x 9 | 0.75 x 1 | free | Ringwater / w03 |
| A3 | Keeper's Lodge (two floors) | 46..60 | 6 / 10.5 | 14 x 9 | 0.9 x 1 | locked | Ringwater / warm interior (Eastward) |
| A4 | Keeper's Yard (shrine 1, map banner) | 60..76 | 6 | 16 x 9 | 1 x 1 | rail | Ringwater / w03 |
| B1 | Reed Shallows (rope bridge) | 76..108 | 6 to 0.2 | 32 x 10 | 2 x 1.1 | rail | Shore / w03 + w01 |
| B2 | The Causeway | 108..172 | 1 to 2 | 64 x 12 | 4 x 1.3 | rail | Plain / w01 |
| B3 | Bus Shelter (shrine 2), inside B2 | 160..168 | 2 | 8 x 3 | 0.5 x 0.3 | locked while inside | Plain / w01 |
| B4 | Stonetop (optional), above B3 | 160..172 | 2 to 18 | 12 x 16 | 0.75 x 1.8 | free | Plain / w01 |
| B5 | Hollow Mouth (crane-hook lift, culvert) | 172..188 | 2 to -32 | 16 x 38 | 1 x 4.2 | free | Plain to Hollow / w04 |
| C1 | Foundry Market (shrine 3, hub) | 188..252 | -32 (walkway -26) | 64 x 14 | 4 x 1.55 | rail, some y | Hollow / w04 |
| C2 | The Archive | 224..248 | -38 | 24 x 6 | 1.5 x 0.7 | locked (small rail) | Hollow / warm interior |
| C3 | Lift Foot (waiting room) | 252..270 | -32 | 18 x 10 | 1.1 x 1.1 | locked | Hollow to Spire / w04 + w02 |
| D1 | Lift Ride | 262..268 | -32 to 40 | 6 x 72 | 0.4 x 8 | locked to the car | Spire / w02 |
| D2 | Outer Climb (shrine 4, storm alcove) | 246..286 | 40 to 76 | 40 x 36 | 2.5 x 4 | free | Spire / w02 |
| D3 | The Crown (arena, boss terminal) | 252..284 | 76 | 32 x 12 | 2 x 1.3 | rail; arena while summoning | Spire / w02 |
| D4 | The Blade (the storm breaks) | 284..316 | 76 to 84 | 32 x 10 | 2 x 1.1 | rail, vista hold | Spire / w02 into w03 |
| E1 | Pilgrim Path (shrine 5) | 316..396 | 84 to 40 | 80 x 50 | 5 x 5.5 (diagonal) | free, downhill lean | Dusk / w03 |
| E2 | Chapel Porch (shrine 6) | 396..410 | 40 | 14 x 9 | 0.9 x 1 | locked | Chapel |
| E3 | Chapel of Light (gallery) | 410..458 | 40 | 48 x 14 | 3 x 1.55 | rail, vista hold at the bench | Chapel / w03 light |
| E4 | Bell Stair and Balcony (latch) | 458..472 | 40 to 52 | 14 x 14 | 0.9 x 1.55 | free, vista hold | Chapel |
| (A3) | The sky door: E4 balcony to the A3 loft | | | | | | |

**Extent.** The world spans about **492 x 130 H**, which is about **31 x 14 screens**. That excludes
open sky above the Crown.

**Walking time.** The first round is about 390 s of pure movement (about 6.5 min at 2 H/s),
including about 26 s of lift rides. With stops to look, read and view art it runs 12 to 15
minutes. Section 6 has per-destination times.

---

## 4. Regions and rooms

Every room below has the same fields:

- **Size** in H and screens
- **Camera** mode
- **Purpose**
- **Mood**: vast or cozy, serene or storm
- **Light and weather**
- **Sound**, using the states in section 9. Footstep surfaces are named because CANON wants
  footsteps to match the surface.
- **Ref**
- **Props**, with states and interactions
- **Traversal**

Prop names come from `docs/props/PIXEL-MATTER.md`. **(new)** marks a prop not yet on the approved
list; section 7 collects those for Dex.

**Breakage policy** (proposal; see question 4 in section 14):

- **Never break:** service and story objects. That means donation boxes, plaques, the counter,
  the terminal, doors, shrine lanterns, the lamp board, the rose window and every artwork frame.
  A slash on an artwork frame passes through with no reaction.
- **Break and heal when the room resets:** glass (outside the chapel), pillars, crates, barrels,
  benches outdoors, and plants.
- **Stay cut for the save**, as CANON says: cut cords, meaning the map banner and the rope bridge.
- **Heal slowly:** the floor. Craters and slash scars from Q and R reassemble.

### Region A: Ringwater (morning, serene)

This is the hybrid Dex asked for, and the first room. All of ring-lake's water stays, and the
colossus is added.

#### A1 The Dock (arrival, spawn)

- **Size and camera:** 34 x 9 H (2.1 x 1 screens). Spawn is at x 16, the centre of the first
  frame, which spans x 8 to 24. Rail camera, anchor 0.8, vista hold at spawn.
- **Purpose:** the first impression. Scenery first. Nothing to use.
- **Mood:** the vastest open space in the world, and serene.
- **Light and weather:** early morning. A pale sun in the ring's hole with a stepped shaft to the
  water. Teal haze, still air, a slow cloud veil across the sun.
- **Sound:**
  - *Ambience first*: water lapping, soft wind, a far gull, the colossus's footfalls as a
    sub-bass thud followed by a long wash.
  - Then *Theme swell* after about 12 s or on first movement, whichever comes later.
  - Footsteps on wood.
- **Ref:** the w03 composition (one small figure, cropped ring, shaft, still water) plus w01's
  colossus (a pale form the size of weather, dissolving into haze).

**The hybrid, as built.** The arrival lane's `src/scenes/scenes/arrival.ts` is in progress. I
looked at it at 1280 x 720 on 2026-09-29.

**What it already does:**

- **Ring.** The ring from ring-lake (`arrival/ring.ts`) is cropped top left, with the break and
  hanging hull blocks top right.
- **Light.** The sun sits in the hole with a stepped halo and a shaft down to the water.
- **Water.** It keeps everything that makes ring-lake work (`arrival/water.ts`):
  - per-row parallax,
  - stepped reflections that strengthen toward the horizon,
  - row-shear ripples,
  - the warm sparkle path under the shaft,
  - ring ripples at the dock posts.
- **Colossus.** The creature from `colossus-plain/colossus.ts` walks the far strand behind the lake
  at depth 20, right to left. A fainter ghost walks at depth 27.
  - Each is mirrored about its own waterline (`reflect: waterY(depth)`, SCENES.md rule 2), so the
    pale body breaks up in the ripples as a long reflection.
  - Once per crossing it walks **through the light shaft**. For those seconds its back is lit and
    its lit reflection runs down the sparkle path. That is the arrival's hero moment, and it needs
    no input.
- **Dock and figure.** The dock, the lantern post and a rope coil are sized in P (the player
  height). The figure is 80 px, at x 0.47 of the view, with bright water and the shaft pool behind
  it, never mid-grey rock. Dark cliffs sit on the right.
- **Cost.** About 2.1 ms per frame at 1280 x 720 on the RTX 4090, one measurement with other work
  on the GPU. Not measured under SwiftShader or on a laptop.

**What the room adds on top of the scene:**

- **The way right.** In the scene, the dock ends at the lantern with open water to the right. The
  room keeps the lantern post as a bend and continues a **lower, older boardwalk** 0.2 H down,
  partly awash, across the shallows to the foot of the right-hand cliff at x 34.
  - The **muted red floor line** runs along that boardwalk. It is the only hint to go right, and
    it enters the first frame just right of the player.
- **Footfall ripples.** Each footfall should send a ring ripple across the lake, plus drips from
  the lifted foot, in place of the plain's dust billow. Today the scene's ring ripples are fixed at
  build time. Section 12 asks the engine for moving ripple points fed from the colossus walk's
  TypeScript twin.
- **Timing.** The first frame stays still for as long as people stand and look. There is no timer
  and no prompt.

**Props:**

- **Pier lantern** (the keeper's lamp, lit at the start): on, slow flicker, swings when hit and
  settles. It is a light source that rims the player warm. Moths circle it.
- **Mooring posts:** idle, sway when hit, chip. They get ring ripples at their feet.
- **Rope and buoys:** verlet rope. A buoy bobs and rings the water when hit.
- **Luggage:** one suitcase on the boards 3 H left of spawn. It is the ordinary object that makes
  the ring huge. It tips over when hit and restores; it never breaks.
- **Water:** ripples, splashes, reflections. Footsteps on the boards drop tiny rings below, and a
  dash sprays.
- **Destructible floor** (wood): splinters and heals.
- Drifting dust.
- **Nothing else.** No NPC, no sign, no donation box and no prompt in the first view.

**Traversal:** flat, then a 0.2 H step down onto the old boardwalk. Left leads to A0.

#### A0 Pier's End (the resting overlook, left)

- **Size and camera:** 20 x 9 H (1.25 x 1 screens). Rail camera, vista hold at the bench.
- **Purpose:**
  - CANON's short resting overlook to the left.
  - The ferry landing.
  - Where the story ends.
- **Mood:** vast view, from a small private spot. Serene.
- **Light:** the same morning, with the shaft seen side-on. After the round, evening.
- **Sound:** the theme, ducked. Water and rope creak. Footsteps on wood.
- **Props:**
  - **Bench:** E sits. The camera eases to a wider composed framing (in whole pixels, no zoom) and
    the UI hides. It splinters when slashed and restores.
  - **Small moored boat** with the ferryman asleep inside.
    - States: moored and asleep, then (after the culvert opens) awake, boarding, sailing, docked.
    - It bobs, and rocks harder when footfall ripples pass under it.
    - E before the culvert opens: a sleepy wave. After: a ride.
  - **Hanging bell on a yoke** (the ferry bell) on a post. Hit it and it swings, rings and settles.
    After the culvert opens, ringing it calls the ferry.
  - Mooring posts, rope and buoys; reeds; a grass tuft growing out of the planks.
  - **After the round:** the keeper and **two cups** (new), one on the bench.
- **Traversal:** flat. It is a dead end apart from the ferry.

#### A2 Cliff Stair

- **Size and camera:** 12 x 9 H (0.75 x 1 screens), rising 5.7 H. Free camera.
- **Purpose:** the first climb, and the reveal of the lodge on its shelf.
- **Mood:** it is still vast, and you are leaving the water. Serene.
- **Light:** morning. The shaft moves across the water below as you climb.
- **Sound:** the theme continues. Footsteps on stone.
- **Props:**
  - **Lamp posts** (3) up the stair. They are dark until shrine 1 is lit, then light in sequence
    down toward the dock.
  - Vines on the cliff: they bend, and cutting them scatters leaves.
  - Grass; rubble at the foot.
  - Destructible floor (stone).
- **Traversal:** stairs only (0.2 H steps) with one landing. No jumps.

#### A3 The Keeper's Lodge (dex account)

- **Size and camera:** 14 x 9 H (0.9 x 1 screens). Two floors: the ground floor is 4.5 H tall, the
  loft 4 H. Locked camera, ceiling visible.
- **Purpose:**
  - the **dex account counter**, about 20 s from spawn, near the start as CANON wants
  - the first **donation box and donor plaque**
  - the **product board** (the first downloads pointer)
  - the **sky door**
- **Mood:** cozy and serene. It is the first "vast, then indoors" cut.
- **Light:** warm stove glow, a candle on the counter, morning light through one west window.
- **Sound:** *Muffled*: the theme through walls, low-passed, about -8 to -10 dB, never restarted.
  A stove crackle, a kettle, a clock. Footsteps on wood.
- **Props:**
  - **Registry counter with its bell and ledger.**
    - E on the counter or ledger opens the **dex account** panel: register, sign in, recover,
      sign out. It is the same account state as the website, and it never fakes a session.
    - The bell rings when used or slashed, and the keeper looks up.
    - The keeper's states: working, acknowledging, away (after the round).
  - **Lamp board** (new; could be a sign variant): six tiny lamps behind the counter, one per
    shrine, mirroring the save. It shows progress with no UI.
  - **Product board** (a sign): lists the **real** products from the live downloads list, with a
    small spire mark. E shows two plain choices:
    - *Download on the website*, which scrolls down to the site's downloads.
    - *The spire*, which points out of the window at the spire's red light.

    It never invents a product. This is the first downloads wayfinding, 20 s in.
  - **Donation box** beside the stove. States: idle; E opens the donate panel (Ko-fi, then the MB
    Bank QR and its amount slider); a small light and chime when used.
    - The **donor plaque** beside it shows real top donors, or empty engraved rows with no data.
  - **Doors:**
    - Front door (west) and yard door (east): closed, opening, open.
    - **Sky door** in the loft, with a red mark. States: closed; open with the rail (dusk view,
      barred); open onto the balcony (after the latch). It gets a latched state (new).
  - **Candles** on the counter: flicker; gutter out when hit; relight.
  - A **hanging lantern**: it swings.
  - **Shelves** with a lost-property shelf of **luggage** (a trunk, a case). It tips when hit and
    restores.
  - A **bench** by the window. **Loose paper** on the counter flutters in dash wind. **Dust
    motes** in the window light.
  - Stove and kettle (new); cups (new).
- **Traversal:** a readable stair to the loft (0.2 H steps, with a handrail).

#### A4 Keeper's Yard (shrine 1, map banner)

- **Size and camera:** 16 x 9 H (1 x 1 screens) on the cliff shelf at y 6. Rail camera.
- **Purpose:** the first shrine, the **map banner**, and the first sword toy.
- **Mood:** it opens to vast again, and it is serene. The lake is on your left, and the reeds and
  the plain are ahead.
- **Light:** morning.
- **Sound:** the theme. Footsteps on packed earth and stone.
- **Props:**
  - **Training dummy** (the keeper beats rugs on it): reacts to every hit type and never dies.
    There is no prompt.
  - **Laundry line** (cloth on lines, like prayer flags): sways, tears when cut, restores.
  - **Shrine 1 (Yard Shrine):**
    - Shrine lantern: out, then lit on rest, then flicker.
    - Offering bowl: holds rainwater, and ripples when hit.
    - **Donation box** and **donor plaque**.
    - E on the lantern rests you. That lights it, sets your respawn, lights its lamp on the board,
      and lights the lamp posts toward shrine 2 in sequence.
  - **Map banner** on the shrine's arch: rolled on a rod and held by a red cord.
    - Slash the cord and the cloth unrolls with cloth physics. E then reads the full map. The cut
      stays cut in that save.
    - The map shows the whole side view, the four destinations, the rooms you've visited and the
      lit shrines.
    - It is a map, not fast travel.
  - Grass and flowers (bend; scatter when cut; regrow). Destructible floor.
  - **Lamp posts** along the path east. They are dark until shrine 1 is lit.
- **Traversal:** flat. At the east end a ramp with steps goes down into B1.

### Region B: Shore and Plain (late morning to overcast; wind rising)

#### B1 Reed Shallows (rope bridge)

- **Size and camera:** 32 x 10 H (2 x 1.1 screens), dropping from 6 to 0.2. Rail camera.
- **Purpose:** the first **near** encounter with scale. The hybrid continues: the same water, and
  the colossus much nearer.
- **Mood:** vast and still, then a jolt of awe.
- **Light:** late morning, the sun breaking through. The reflections are strongest here.
- **Sound:**
  - The theme continues.
  - Reeds hiss and water laps.
  - A footfall is a sub-bass thud followed about 1 s later by a ripple hiss.
  - Footsteps on wood and in shallow water.
- **Ref:** w03 water, w01 colossus.
- **Colossus:** a wading variant crosses at depth about 8, in the shallows, on a loop of about 95 s.
  - Once per pass it plants a foot in frame. A ring ripple reaches the shore, the reeds sway, and
    the camera shakes 1 px.
  - Spray and drips replace dust.
- **Props:**
  - **Reeds:** bend and part as you pass. Your dash wind bends them.
  - **Water:** ripples, splashes, reflections, footfall rings.
  - Old **mooring posts** and a **buoy** line, with no boat.
  - **Sign:** a ferry board whose text is worn away to nothing.
  - **Lamp posts** on the boardwalk.
  - **Puddles** on the planks.
  - **Rope bridge** (new as a prop; the interaction is in CANON) over the reed channel at
    x 92..98.
    - A plank deck is hauled up against the far (east) post by a rope.
    - Slash the rope: the rope separates, the post stays, and the deck swings down across the
      channel and becomes walkable.
    - States: raised, cut, swinging, lowered and walkable. It stays cut for the save.
- **Traversal:**
  - The ramp down from the yard.
  - The boardwalk.
  - The first time: **wade** the 6 H channel, knee-deep at 50% run speed, with the footfall ripples
    washing past. Then cut the bridge from the far side (shortcut S1).
  - The boardwalk has one 0.9 H gap, a single jump; you can also wade around it.

#### B2 The Causeway

- **Size and camera:** 64 x 12 H (4 x 1.3 screens). Rail camera, anchor 0.75. About 32 s of
  walking, with something to see every screen.
- **Purpose:** the journey. Weather building, a colossus close enough to shake the ground, shrine 2.
- **Mood:** the vastest outdoor walk. Calm turning uneasy.
- **Light and weather:**
  - Overcast, grey-violet haze (w01), slow cloud shadows.
  - The wind rises from west to east.
  - Rare sheet lightning far off on the spire, which stands on the horizon ahead with its storm.
    This is the first sight of the storm.
- **Sound:** the theme at about 80%. Wind layers strengthen to the east, with grass hiss and distant
  thunder. Footsteps on stone, and splashing in sheet water.
- **Ref:** w01 (dark plain, pale colossus, haze). The flats are **flooded sheet water**, so the
  lake's reflections carry through the plain.
- **Colossus:** it walks the flats at depth 6 to 12, on the colossus-plain loop of about 95 s.
  - It plants one foot behind the causeway per pass: a 2 px camera shake, ring ripples racing
    across the sheet water, grass flattened.
  - A ghost walks much deeper in the haze.
- **Props:**
  - **Marker posts with red cloth** (from the colossus-plain scene; new as a prop): they whip in
    the wind. These are the route marks.
  - **Standing stones:** chip and crack; restore; never fall.
  - **Prayer flags** on lines between the stones: cloth in the wind; tear when cut; restore.
  - **Breakable pillars:** a short broken colonnade at x 124..130. They chip, crack and crumble to
    rubble, then restore.
  - **Colossus footprint crater** at x 134..144: a 3 H dip with ramps. Rainwater pools at the
    bottom reflecting the sky, and rubble lines the rim.
  - **Bones of something huge, half-buried:** a rib arch at x 148..156 that you walk under. The
    ribs are one-way platforms (an optional climb).
  - **Lamp posts** along the causeway: dark until shrine 1 is lit.
  - Grass and flowers, dense and wind-bent.
  - **Loose paper:** one page blows along the ground ahead of you.
  - Dust and ash. Destructible floor (stone).
- **Traversal:**
  - Two breaks in the causeway.
    - At x 120: 1.1 H, a single jump.
    - At x 146: 2.5 H. You can wade around it through shin-deep water, or cross it with jump,
      double jump and dash for a quicker line.
  - The rib-arch top is optional, by double jump.

#### B3 Bus Shelter (shrine 2)

- **Size and camera:** 8 x 3 H at x 160..168, a roofed pocket inside B2. Locked while inside.
- **Purpose:** the second shrine and donation box. A pocket of cozy inside the vast.
- **Mood:** cozy and a little wrong, in the Backrooms way: a bus stop on a flooded plain.
- **Light:** the shrine lantern inside, grey outside.
- **Sound:** the theme ducked about 4 dB while you rest. Wind outside, rain drips off the roof edge.
- **Props:**
  - A **bench**.
  - The shrine lantern and offering bowl.
  - **Donation box** and **donor plaque**.
  - A route **sign** (new) whose numbers have worn off.
  - Moths.
  - **Puddles** under the dripping edge.

#### B4 Stonetop (optional)

- **Size and camera:** 12 x 16 H (0.75 x 1.8 screens) of climb, starting from the shelter's roof.
  Free camera, with a fixed framing at the top.
- **Purpose:** a view in which the colossus passes **at eye level**, close enough to fill half the
  frame.
- **Mood:** vast and a little frightening.
- **Sound:** the music drops to wind alone while it passes, then returns.
- **Props:** standing stones as ledges (they chip), a bench at the top, prayer flags.
- **Traversal:** double-jump ledges 1.2 to 1.5 H apart. A fall drops you only to the stone below.

#### B5 Hollow Mouth (crane-hook lift, culvert gate)

- **Size and camera:** 16 x 38 H (1 x 4.2 screens). The plain has collapsed into the fallen
  structure below. Free camera, anchor 0.35 (looking down).
- **Purpose:** the door to the underworld. The ride down is a reveal.
- **Mood:** vast (vertical), and tense for a moment: the first time the ground falls away.
- **Light:** overcast daylight falling in two stepped shafts. The amber glow rises from below.
- **Sound:**
  - The theme dips to about 60%.
  - Wind above gives way to machine hum below.
  - Chain clatter from the legacy `lift-start` and `lift-dock` sounds.
- **Ref:** w04's opening, seen from above.
- **Props:**
  - **Crane with a swinging hook.** Its hook platform is the lift.
    - States: idle at the top, called, descending, at the bottom.
    - A lever (new) at each end; E calls it. The ride takes 10 s for 34 H.
    - The hook swings when hit and settles.
  - **Hanging cables and chains** down the shaft: verlet sway; they swing when hit.
  - **Culvert gate** on the upper platform at y 0: a barred door.
    - States: closed, lifting, open.
    - It opens from **inside**, by the lever beside it. That shows the lake's light down the
      tunnel, and a horn sounds.
    - The ferryman at Pier's End wakes (shortcut S2).
  - Vines hanging into the hole. Falling dust.
- **Traversal:** the lift. There is also an optional climb down by ledges (0.9 H drops) for
  players who want to jump.

### Region C: The Hollow (underground; amber, lived-in; no weather, thunder only as a far rumble)

#### C1 Foundry Market (shrine 3, the hub)

- **Size and camera:** 64 x 14 H (4 x 1.55 screens). Street level is y -32, with an upper walkway
  at -26 joined by stairs at both ends. Rail camera with some vertical freedom, anchor 0.64.
- **Purpose:**
  - **The hub.** The crane lift, the culvert and ferry landing, the archive door and the spire
    lift all sit within about a minute of each other.
  - **Shrine 3.**
  - It is the one "denser" place CANON allows.
- **Mood:** medium scale, dense and lived-in. Calm but busy.
- **Light:** amber haze and furnace pockets in the background (w04). A white searchlight beam, and
  lamps at every stall.
- **Sound:**
  - *Muffled*: the theme low-passed, playing from a stall radio (new). It is a diegetic source at
    about -8 dB.
  - Market murmur with no words, hammering, steam hiss, furnace roar, a distant freighter horn.
  - When a colossus crosses far above: a deep thud every 2.5 s and dust sifting down.
  - Footsteps on metal grating and on stone.
- **Ref:** w04, through the amber-hollow scene as the backdrop layers.
- **Props:**
  - **Market stalls with cloth awnings** (4). The awnings sway, tear along a cut and restore.
    Stall keepers are unnamed silhouettes, and one stall is empty.
  - **Crates and barrels:** crates splinter; barrels dent and roll a little. All restore.
  - **Neon and holy-light signs:** lit, flicker, sparking when hit, dark for a beat. The glyphs
    mean nothing, except a small book mark over the archive door.
  - **Steam vents:** hiss on a cycle. A burst pushes cloth, flames and grass (it is a wind source)
    and does no damage.
  - **Sparking junction boxes:** a hit makes them spark. The sparks are a light source; the box
    settles.
  - **Hanging cables and chains** across the street. **Street lamp posts.**
  - **Cranes with swinging hooks** in the background.
  - A **red pipe** along the walkway: the route mark underground.
  - Destructible floor (grating dents, stone chips).
  - Loose paper, dust motes in lamp light, moths at the stall lamps, puddles by the vents.
- **Shrine 3 (the Hearth Shrine)** at x 212..220, in a furnace-warm alcove: shrine lantern,
  offering bowl, **donation box** and **donor plaque**, and a **bench**.
- **Archive door** at x 232 in the back alley: an ordinary door with a small lamp above it (see C2).
- **Traversal:**
  - The street is flat, with stairs to the walkway.
  - Optional rooftops over the stalls (0.9 to 1.5 H ledges).
  - A 1.9 H gap in the walkway is a double-jump line to a rooftop bench.

#### C2 The Archive (documentation)

- **Size and camera:** 24 x 6 H (1.5 x 0.7 screens), down a short stair from the alley. The ceiling
  is 5 H. Locked camera with a small rail.
- **Purpose:** **documentation**, as real docs panels. No puzzle and no prerequisite. Real docs are
  clearly separate from lore; the lamp ledger stays in the lodge.
- **Mood:** the coziest room in the world, and the quietest.
- **Light:** candles and one green-shaded reading lamp. Dust hangs in the light.
- **Sound:** *Silence*.
  - The music fades out over 4 s at the door.
  - Room tone, a clock tick, paper, and the furnace very far away.
  - Footsteps on a rug and on wood.
- **Props:**
  - **Archive door:** closed, opening, open; E opens it. It looks like any other door.
  - **Shelves and scroll racks,** one bay per product, each with a plain sign.
    - E on a bay opens that product's docs.
    - A hit only makes them sway and rattle, and a scroll may fall. Nothing breaks in a reading
      room.
  - **Lectern with an open book:** the pages flutter when you pass or dash. **E opens the
    documentation index** as real DOM, with focus, back and close.
  - **Candles and a candelabra:** flicker; gutter out when hit; relight.
  - A reading chair (bench); loose paper; dust motes.
  - The **archivist** reads (idle). E gets a hum.
- **Traversal:** none. It is a room to stop in.

#### C3 Lift Foot (waiting room)

- **Size and camera:** 18 x 10 H (1.1 x 1.1 screens), where the spire's stem pierces the hollow
  floor. Locked camera.
- **Purpose:** the threshold, and the start of the ascent.
- **Mood:** cozy and a little uncanny: a **waiting room** arranged wrong, at the foot of a
  megastructure. Calm.
- **Light:** cold fluorescent strips against the amber outside. A warning light turns while the
  lift moves.
- **Sound:** the radio on the empty operator's chair keeps the theme going, muffled. Hum. Footsteps
  on tile.
- **Props:**
  - **Lift platform, with its cables and counterweight.**
    - States: parked, called, rising, arriving, stopped at the break (y 40).
    - After the express lever is thrown, it runs straight to the Crown.
    - The **lift gate** is a big door: closed, opening, open.
  - **Warning lights:** off; amber and turning while the lift moves; red during an arena summon.
  - **Signs:** an up arrow with the spire mark (the downloads route), and a ticket-number display
    frozen on one number.
  - **Benches** (a row of waiting-room chairs).
  - **Luggage and crates** waiting.
  - A second **training dummy**, a warm-up before the storm.
  - The radio (new).
- **Traversal:** flat. Step onto the lift and press E.

### Region D: The Spire (storm)

#### D1 Lift Ride

- **Size and camera:** a 6 x 72 H shaft, 16 s at 4.5 H/s. The camera is locked to the car.
- **Purpose:** the big transition, from amber interior to cold storm exterior.
- **Mood:** vast (a vertical reveal). Tension rising.
- **Light:** in order:
  - amber in the hollow,
  - about 3 s of dark through the hollow's ceiling,
  - the spire's cold blue side-light, with the **pale planet** rising behind (w02),
  - rain beginning on the car.
- **Sound:** the market's muffled theme opens up as you leave the hollow, rises, then thins out as
  rain and wind take over near the break. Cable hum. The clatter stops at the break.
- **Props:**
  - The counterweight passing the other way halfway up. That is the "how big is this" moment.
  - Warning lights. Window slits flashing past.
- **Traversal:** none. At the break the gate opens onto D2.

#### D2 Outer Climb (shrine 4, the storm alcove)

- **Size and camera:** 40 x 36 H (2.5 x 4 screens). Five ledge rows about 7 H apart zigzag up the
  spire's leaning face. Free camera with upward look-ahead.
- **Purpose:** the physical challenge of the world, still friendly. Shrine 4 is halfway.
- **Mood:** vast, exposed, **storm**.
- **Weather:**
  - Slanting rain.
  - Gusts on a readable cycle: 6 s calm, then a 3 s gust that pushes 0.5 H/s outward. Pennants
    and the rain angle warn about 1 s ahead.
  - Lightning inside the clouds: cloud glow only, never a white flash on the player. It stays
    within the engine's global flash gate.
- **Sound:** *Storm*: rain, wind and thunder, and no music. Footsteps on wet metal.
- **Ref:** w02 (a black angular structure, a pale disc, small lit windows, a diagonal thrust).
- **Props:**
  - **Wind-whipped pennants** in muted red: the route marks up here, and the gust tell.
  - **Warning lights:** blink at every ledge edge. A hit makes them spark and flicker.
  - **Broken armour pieces** from earlier wardens: they rattle and slide when hit or dashed
    through, and stay where they land.
  - **Breakable pillars** (stub fins on the ledges): chip, crack, crumble, restore.
  - **Hanging chains.** **Puddles** that splash, ringed by rain.
  - The lift's counterweight hanging in its channel at the east edge.
  - A lamp post that swings on its bracket in gusts.
  - Destructible floor (metal dents and sparks).
- **Shrine 4 (the Storm Alcove)** at x 262..270, y 58: a window alcove cut into the spire,
  8 x 3.5 H. The camera locks while you're inside.
  - Shrine lantern, **candles** and a candelabra (they lean in the draught), a **bench**, a
    **donation box** and **donor plaque**.
  - A small cracked **stained-glass window** with rain on it. Lightning lights it from behind. It
    is the first stained glass in the world and a hint of the chapel.
    - States: whole, cracked, shattered, reassembling.
  - Sound: rain muffled through glass, and the lantern's crackle. No music here either.
- **Traversal:**
  - Required: ledges up to 0.9 H, gaps up to 1.1 H.
  - A gust never pushes you off: each ledge ends in a 0.3 H lip.
  - A fall puts you back one ledge row (a gust fade), never down the whole climb.
  - Optional: a 2.8 H dash gap to a ledge with a lone pennant and a view, with a catch ledge
    below.

#### D3 The Crown (arena, boss terminal)

- **Size and camera:** 32 x 12 H (2 x 1.3 screens). The fight floor is 24 H between two pillar
  lines, and the terminal stands at the west end under an overhang. Rail camera, arena-clamped
  while summoning.
- **Purpose:** **downloads.** In the finished world, every product-menu visit costs a fresh
  fight. The warden is out of scope now, so this phase builds the arena, the terminal, its states,
  and the honest interim.
- **Mood:** medium-vast. The storm is at its peak here, and it is most tense while summoning.
- **Weather:** heavy rain, close lightning (flash-gated), wind. The floor seals glow through
  standing water.
- **Sound:**
  - Storm ambience.
  - When the terminal wakes, the *Arena* state fades in over 3 s. When it cools down, the state
    fades back to storm over 6 s.
- **Props:**
  - **Boss terminal** (the pixel engine's `bossTerminal`, already proven in the sandbox).
    - States, with the engine's names: **`dormant`** (a dark screen, rain running down it);
      **`woken`** (E: the screen lights and shows the real product list from the live downloads
      list); **`summoning`** (a beam, and the floor seals light in sequence); **`summoned`** (the
      seal held, where a warden will form later); **`cooldown`** (the host calls it); back to
      dormant.
    - **The interim, until wardens exist:** summoning ends with the seal holding, then fading. The
      terminal cools down, and one honest line on its screen says the product's download is on the
      website below, with a control that scrolls there.
    - No fake fight and no fake download.
    - Past wins never unlock anything.
  - **Arena floor seals** (a ring of five, 10 H across): dark, glowing, forming, spent. They sit
    on destructible floor whose craters heal quickly between visits.
  - **Arena shutters** at both ends (big doors): open; closing and closed while summoning;
    opening. Walking through is always allowed when idle.
  - **Breakable pillars** (the two pillar lines, cover in future fights): chip, crack, crumble;
    restored when the terminal cools down.
  - **Broken armour pieces.** **Wind-whipped pennants.** **Warning lights**, red while summoning.
  - Two long **banners** behind the terminal: sway, tear.
  - **Express lever** (new) at the east end (x 282). E throws it, permanently, and the lift then
    runs from the Lift Foot to the Crown non-stop (shortcut S3).
  - Puddles and rubble.
- **Traversal:** a flat arena floor, with 0.9 H ledges on the pillar tops for aerial play. The
  terminal is optional.

#### D4 The Blade (the storm breaks)

- **Size and camera:** 32 x 10 H (2 x 1.1 screens), rising 8 H along the monolith's top edge. Rail
  camera, vista hold at the tip.
- **Purpose:** the emotional turn. You get above the weather.
- **Mood:** the vastest moment since the arrival. Storm to serene, at once.
- **Light:**
  - At x 292 the cloud tears open over about 4 s in stepped bands.
  - A low **dusk** sun comes from the west, behind the ring, while the planet sets behind the
    spire.
  - Wet surfaces turn gold.
- **Sound:**
  - The storm cuts off, and there are 2 s of silence.
  - Then the theme enters **under a 5 s swell** from about 48 s into the cue, so its grand
    passage (around 54 s, the part Dex picked it for) lands as the clouds finish opening.
  - It swells in. It never starts at full level.
- **Ref:** w02 (the blade against the disc) turning into w03 (the ring and the light).
- **What you see:**
  - the colossi **below you** for the first time, their backs, with birds wheeling over them
  - the lake, the ring and the lodge's cliff
  - the lamps you have lit, as points of light
- **Props:** pennants now hanging still; rubble; moss on the edge (grass: bends); one **bench** at
  the tip. Nothing else.
- **Traversal:** a gentle slope under 20°. At the tip, the fallen ring segment leans against the
  blade, and a step down onto it begins E1.

### Region E: The Pilgrim Path and the Chapel (dusk; after the storm; serene)

#### E1 Pilgrim Path on the ring segment (shrine 5)

- **Size and camera:** 80 H long, dropping 44 H, about 5 screens along a curved diagonal. The
  surface is under 30°, with steps in the steep parts. Free camera leaning to the downhill side,
  anchor 0.5.
- **Purpose:** the long exhale. CANON says getting to the gallery can be a longer journey so it
  means more.
- **Mood:** vast and serene, turning cozier as the chapel comes near.
- **Light:** dusk. A rose-gold low sun, violet shadows, and puddles holding the sunset. Lamp posts
  come on one by one after shrine 5 is lit.
- **Sound:** the theme's second half plays out and ends naturally partway down. After that come
  wind dying, dripping water and the far bell.
- **Ref:** w03 (the ring's inner face, the light).
- **Props:**
  - **Stained-glass windows** set in the ring's panels.
    - They shatter into glinting shards when hit, throw coloured light onto the path and onto the
      player (lit props feed the light list), and reassemble slowly.
    - This is the one place where breaking glass is freely a pleasure and never a loss.
  - **Prayer candles in rows** on the rim ledges: lit at dusk; gutter out when hit; relight.
  - **Lamp posts.**
  - **Hanging bell on a yoke** from a ring rib at x 344. It swings and rings when hit, and the
    sound carries across the valley.
  - **Banners** (processional, on poles): cloth sway; tear when cut.
  - **Grass, flowers and vines** growing on the fallen ring.
  - **Puddles** that reflect. Rubble. Moths.
- **Shrine 5 (the Pilgrim Shrine)** at x 360, y about 62, on a flat terrace: shrine lantern,
  offering bowl, **bench**, **donation box** and **donor plaque**.
- **Traversal:**
  - A gentle downhill with steps.
  - One missing panel is a 1.1 H gap, a single jump; a lower path goes around it through a ring
    bay.
  - Optional: climb the rib (0.9 to 1.5 H ledges) to reach the bell.

#### E2 Chapel Porch (shrine 6)

- **Size and camera:** 14 x 9 H (0.9 x 1 screens). Locked camera.
- **Purpose:** the threshold, and the **sixth and last lamp**.
- **Mood:** cozy-outdoor and serene.
- **Light:** dusk, plus the porch lanterns.
- **Sound:** wind and a little door reverb. Footsteps on stone.
- **Props:**
  - **Font with water:** E or a hit makes ripples and a small chime. It reflects the lanterns, and
    it is the calmest water in the world.
  - **Hanging lanterns.**
  - **Chapel doors** (big, with a red ribbon): closed, opening, open. E opens them; they are never
    locked.
  - Shrine lantern (the last lamp), a **donation box** and a **donor plaque**. A bench.
  - A broom leaning by the door, a **shawl on a hook** (cloth that sways) and a **dusty second
    cup** (new) on the sill. This is the story told by props.
  - Loose paper.
- **Traversal:** flat.

#### E3 Chapel of Light (the gallery)

- **Size and camera:** 48 x 14 H (3 x 1.55 screens). The nave is 14 H tall: grand, yet held in.
  Rail camera, vista hold at the bench.
- **Purpose:** **Dex's 9 artworks**, each shown on its own, plus the catalogue.
- **Mood:** grand and cozy at once, the only room that is both. Completely calm.
- **Light:**
  - **On arrival:** candle-dim, with the rose window shuttered. The works can already be inspected;
    the light is atmosphere, not a lock.
  - **After the shutter crank:** sunset through the **rose window** high on the west wall, above
    the doors, throws coloured shafts east down the nave. They sweep the aisle and light each frame in turn, then pool on
    the floor.
  - Candles, and a soft warm spill on each frame.
- **Sound:**
  - The theme **starts from the top** here, with its built-in 2.65 s quiet breath and then the
    high piano. This is the only place it starts rather than continues. The storm has cleared the
    air, and the previous playback ended on the path.
  - About 60% level, with a large reverb.
  - Opening an artwork panel drops it another 6 dB.
  - Footsteps on stone, with reverb.
- **Props:**
  - **Frames for each artwork.**
    - **01 to 05** (16:9, 2.4 x 1.35 H) stand on **easels** down the nave in manifest order.
    - **06 to 09** (portrait) hang in four tall niches at the east end, where the rose light
      comes to rest.
    - E on a frame opens that piece alone in a real DOM panel from `public/gallery/` via
      `content/gallery/manifest.json`. It has alt text, no visible titles, back and close, and
      left/right to step to the neighbouring work.
    - Frames ignore hits. The art is never pixelated, lit, tinted, or used as texture or backdrop
      (see question 3 in section 14).
  - **Lectern with an open book** by the door: **E opens the catalogue** of all nine. Its pages
    flutter.
  - **Rose window** (stained glass) and its **shutter crank** (new; a door variant: closed,
    opening, open).
    - It is the biggest light source in the world. It is unbreakable, and it rim-lights the player
      in colour.
  - **Stained-glass side windows:** coloured light only; they don't break here.
  - **Pews and benches:** they sway and creak when hit and don't splinter in the nave.
  - One **bench to sit and look**: E sits, the camera holds on the works, the UI hides, and the
    music dips.
  - **Prayer candles in rows** under the frames, and **candelabras**: flicker; lean in dash wind;
    gutter out and relight if hit.
  - **Censer on a chain:** swings like a pendulum and trails smoke that shows the light shafts; it
    swings when hit.
  - **Hanging lanterns.** **Tapestries** between the windows: they sway and don't tear in the nave.
  - Dust motes in the coloured light.
- **Nave rule:** combat input still works, but hits only disturb things (they sway, flicker or
  ring). Nothing fractures in the room that holds the art.
- **Traversal:** flat. A stair at the east end leads up to E4.

#### E4 Bell Stair and Balcony (latch; the sky door)

- **Size and camera:** 14 x 14 H (0.9 x 1.55 screens). A stair rises 12 H to a balcony outside the
  chapel's east gable. Free camera, vista hold on the balcony.
- **Purpose:** the "view from above" draft 1 promised, and the **shortcut home**.
- **Mood:** vast, with the whole route visible to the west, and serene. The second-quietest place.
- **Light:** the last of the dusk. The lamps you lit are visible in a line across the valley, and
  the colossi walk the horizon.
- **Sound:** the chapel's playback carries out here and ends naturally. It doesn't restart until
  you move to another region. Wind, and the bell.
- **Props:**
  - **Hanging bell on a yoke** (the chapel bell). It rings when hit, and rings once by itself when
    the latch is released.
  - **The red-marked door** with its **maintenance rail latch** (new; a door state: latched,
    released).
    - Release it and the rail swings away. The door opens onto the A3 loft.
  - A bench for the view. Prayer flags. Vines over the balcony rail.
- **Traversal:** stairs. After the release the latch door is a permanent two-way link to the A3
  loft (shortcut S4).

---

## 5. Room graph and shortcuts

**The graph.** `--` is a walk, `==` is a lift or ride, and `..` is a shortcut opened once from its
far side.

```
A0 Pier's End -- A1 Dock -- A2 Cliff Stair -- A3 Lodge -- A4 Yard -- B1 Reed Shallows -- B2 Causeway -- B5 Hollow Mouth
   :                                          :  (loft)                    (S1 rope bridge)   |  B3 Shelter  ||
   :                                          :                                               |  B4 Stonetop || crane lift
   :.......... S2 ferry through the culvert ..:...............................................:........... B5 low
   :                                          :                                                             |
   :                                          :                                   C2 Archive -- C1 Foundry Market -- C3 Lift Foot
   :                                          :                                                                       ||  D1 lift
   :                                          :                                         D2 Outer Climb (shrine 4) ==||
   :                                          :                                                     |               || S3 express
   :                                          :                                         D3 Crown (arena) ===========||
   :                                          :                                                     |
   :                                          :                                         D4 Blade -- E1 Pilgrim Path -- E2 Porch -- E3 Chapel -- E4 Balcony
   :                                          :......................... S4 sky door (latch) ........................................:
```

**Why it flows.**

- The first round is one line, so nobody gets lost.
- Every shortcut is a physical place, opened once from its far side. That is Hollow Knight's
  rule: each opening is a reward for having walked that stretch.
- After the round, the lodge and Pier's End form a hub on the lake.
  - The **sky door** reaches the chapel.
  - The **ferry** reaches the hollow, for the archive and the lift.
  - The **express lift** reaches the arena.
  - Everything is within 2 minutes.

**Doors.** All open with E. None is locked except where noted.

- A3: front, yard, and the sky door (barred by a rail until S4).
- B5: the culvert gate, opened only from inside.
- C2: the archive door.
- C3: the lift gate.
- D3: the arena shutters, which close only while summoning.
- E2: the chapel doors.
- E3: the rose shutter.
- E4: the latch door, opened only from the balcony side.

**Lifts and rides:**

| Ride | From, to | Time |
|---|---|---|
| Crane hook | B5 top to C1 street (34 H) | 10 s; called from either end |
| Spire lift | C3 to the break at y 40 (72 H) | 16 s |
| Spire lift, express (after S3) | C3 to D3 (108 H) | 18 s, faster, skipping the climb |
| Ferry (after S2) | A0 to B5 culvert landing, out on the lake and through the culvert under the causeway | 16 s; a scenic ride with the colossus seen from the water |

**Shortcuts:**

| # | Shortcut | Opened by | Saves |
|---|---|---|---|
| S1 | Rope bridge over the reed channel (B1) | Slashing its rope from the east bank | The slow wade, both ways |
| S2 | Ferry, A0 to B5 | The culvert lever inside B5. The horn wakes the ferryman; ring the ferry bell at A0 to call him. | The shallows and the whole causeway |
| S3 | Express lift, C3 to D3 | The lever at the Crown's east end | The outer climb |
| S4 | Sky door, A3 loft to the E4 balcony | Releasing the latch on the balcony | The whole world: the chapel is about 40 s from spawn |

**No fast travel.** The map banner is a map, as CANON says. Every shortcut is a place you move
through.

**Jumps on the required route** (all single jumps up to 1.1 H): the B1 boardwalk gap, the B2 break
at x 120, the D2 ledges, and the E1 missing panel.

**Double-jump lines** (optional): B4 Stonetop, the B2 rib arch, the C1 rooftops and walkway gap,
and the E1 bell rib.

**Dash gaps** (secrets, each with a catch ledge): the B2 second break (2.5 H, with a wade-around
beneath it) and the D2 lone-pennant ledge (2.8 H).

---

## 6. Destinations: where they are, how you find them, how long it takes

These are in CANON's wayfinding priority. The website is one scroll away everywhere: the black bars
recede and the real site comes up with no game in the way.

Times are movement at 2 H/s plus rides. A first visit adds stops.

| Destination | Where | How you find it | First visit | Returning (shortcuts open) |
|---|---|---|---|---|
| **Downloads** | D3 Crown: terminal, then (later) a warden, then the product menu | The lodge's product board at about 20 s offers the website download and points at the spire. The spire's red light and storm are on the horizon from the causeway onward. The map marks it, and the Lift Foot's up arrow carries the spire mark. | About 4.5 min of movement, about 7 min with stops | About 1:45 (ferry, crane, walk, express lift) |
| **Donate** | 7 boxes: the lodge, then shrines 1 to 6 | Every rest place has one, always with its plaque. The first is in the first building. | About 22 s | About 22 s |
| **Illustrations** | E3 Chapel of Light | The sky door's dusk view shows it's somewhere high up. The Blade and the path lead down to it. | About 6 min of movement, about 10 min with stops | **About 40 s** (sky door, then down the bell stair) |
| **Documentation** | C2 Archive, behind an ordinary door off the market alley | The map marks it. A lamp and a small book mark over the door. It's on the way to the lift. | About 2:10 of movement, about 4 min with stops | About 70 s (ferry, crane, walk) |
| **dex account** | A3 counter (keeper, ledger) | The first building after the dock | About 21 s | About 21 s |
| **Map** | A4 shrine 1 banner (slash the cord, then E) | You walk right under it | About 28 s | About 28 s |
| **Website** | Everywhere: scroll down | The bars recede. The world's sound fades, and the world waits. | Instant | Instant |

**Wayfinding without labels:**

- **Muted red marks** trace the main route (see the visual rhymes in section 2).
- **Lamp posts** light up toward the next shrine once you've lit the one you're at.
- **Landmarks stay visible.** The ring is in the west sky: behind you going out, ahead of you
  coming home. The spire stays on the eastern horizon until you're inside it.

**Other visitors** (not built in this phase):

- Ghost silhouettes will collect where people stop: the shrines, benches, Pier's End, Stonetop, the
  Blade tip and the balcony.
- Each of those spots has at least 6 H of flat ground, room for two or three ghosts to gesture.

---

## 7. Every prop, and where it goes

This checks that nothing on the approved list in `PIXEL-MATTER.md` is left out. Rooms are the ids
from section 3.

| Prop | Placed in | States and interactions used |
|---|---|---|
| **Boss terminal** | D3 | `dormant`, `woken` (E), `summoning`, `summoned` (seal held), `cooldown`; the interim website pointer |
| **Donation box + top-donor plaque** | A3, A4, B3, C1, D2, E1, E2 | idle; E opens the donate panel; light and chime. The plaque shows real data or empty rows. Never breaks. |
| **Map banner** | A4 | rolled, cord cut (permanent), unrolling, hanging; E reads |
| Stained-glass windows | E1 (breakable), D2 alcove (breakable), E3 side windows (light only) | shatter, shards, coloured light, reassemble |
| Candelabras and candles | A3, C2, D2, E3 | flicker, light source, gutter when hit, relight |
| Hanging bell on a yoke | A0 (ferry bell), E1 (rib bell), E4 (chapel bell) | rest, swing, ring, settle; rings itself at the latch |
| Banners and tapestries | D3 and E1 (tear); E3 (sway only) | cloth sway, tear along a cut, restore |
| Pews and benches | A0, A3, B3, B4, C1, C2, C3, D2, D4, E1, E2, E3, E4 | outdoors they splinter and heal; in E3 they sway only; E sits |
| Lectern with an open book | C2 (docs), E3 (catalogue) | pages flutter; E opens the panel |
| Censer on a chain | E3 | pendulum swing, smoke trail, swings when hit |
| Lamp posts | A2, A4, B1, B2, C1, D2, E1 | on, off, flicker, swing; lit in sequence after a shrine |
| Doors | A3 (front, yard, sky), B5 (culvert), C2 (archive), C3 (lift gate), D3 (shutters), E2 (chapel), E3 (rose shutter), E4 (latch) | closed, opening, open; plus a latched state (new) |
| Signs | A3 (product board, lamp board), B1 (ferry board), B3 (route sign), C1 (neon), C3 (arrow, ticket display) | lit or worn, flicker; no selling copy |
| Luggage | A1, A3, C3 | tip over, restore |
| Training dummy | A4, C3 | reacts to every hit type, never dies |
| Breakable pillars | B2, D2, D3 | chip, crack, crumble, rubble, restore |
| Grass, flowers, vines | A0, A2, A4, B2, B5, D4, E1, E4 | bend when walked through or swung near, scatter when cut, regrow |
| Destructible floor, rubble | A1, A2, A4, B2, C1, D2, D3, E1 | craters and scars that heal; rubble at rims |
| Water | A0, A1, B1 (lake), B2 (sheet flats, crater pool), E2 (font) | ripples, splashes, reflections, footfall rings |
| Mooring posts, rope and buoys | A0, A1, B1 | bob, sway, creak, chip |
| Small moored boat | A0 | moored and asleep, awake, boarding, sailing, docked |
| Reeds | A0, B1 | bend and part; dash wind |
| Pier lantern | A1 (the keeper's lamp) | on, flicker, swing |
| Shrine (lantern, offering bowl, box, plaque) | A4, B3, C1, D2, E1, E2 | lantern out, lit on rest, flicker; bowl ripples |
| Prayer flags on lines | A4 (laundry), B2, B4, E4 | wind, tear, restore |
| Standing stones | B2, B4 | chip, crack, restore |
| Colossus footprint crater | B2 | walkable dip with pooled water |
| Bones half-buried | B2 | rib arch; ribs are one-way platforms |
| Hanging cables and chains | B5, C1, D2 | verlet sway, swing when hit |
| Cranes with swinging hooks | B5 (the lift), C1 (background) | idle, called, moving; swing when hit |
| Sparking junction boxes | C1 | spark (a light source), settle |
| Steam vents | C1 | cycle, burst (a wind source) |
| Market stalls with awnings | C1 | sway, tear, restore |
| Crates and barrels | C1, C3 | splinter, dent, roll, restore |
| Neon / holy-light signs | C1 | lit, flicker, spark, dark |
| Registry counter, bell and ledger | A3 (moved from the hollow so the counter is near the start, as CANON wants) | E opens dex account; the bell rings |
| Archive door | C2 | an ordinary door |
| Shelves and scroll racks | A3, C2 | sway and rattle only; E on a C2 bay opens that product's docs |
| Dust motes in lamp light | A3, C1, C2, E3 | drift, part in dash wind |
| Lift platform, cables, counterweight | C3, D1, D2 | parked, called, rising, arriving, stopped at the break, express |
| Warning lights | C3, D1, D2, D3 | off, amber turning, red, blink, spark |
| Arena floor seals | D3 | dark, glowing, forming, spent |
| Broken armour pieces | D2, D3 | rattle, slide, stay |
| Wind-whipped pennants | D2, D3, D4 | whip in gusts (the gust tell), hang still after the storm |
| Artwork frames and easels | E3 | E inspects; ignore hits |
| Rose window | E3 | a light source; unbreakable |
| Prayer candles in rows | E1, E3 | lit, gutter, relight |
| Font with water | E2 | ripples; E touches it |
| Hanging lanterns | A3, E2, E3 | swing, flicker |
| Bench to sit and look | E3 (and A0, B4, D4, E4) | E sits, the camera holds, the UI hides |
| Dust and ash, moths, puddles, loose paper | everywhere (listed per room) | drift; moths around lights; puddles splash and reflect; paper flutters |

**Proposed new props.** These need Dex's OK (question 7):

| New prop | Where | Why |
|---|---|---|
| Latched door state and maintenance rail | A3 / E4 sky door | the story's latch |
| Rope bridge (the CANON interaction as a prop) | B1 | shortcut S1 |
| Levers | B5 (crane, culvert), D3 (express) | shortcuts S2 and S3 |
| Lamp board | A3 | progress without UI |
| Product board (a sign variant) | A3 | the first downloads pointer |
| Stove and kettle, cups (including the dusty cup), shawl on a hook, broom | A3, A0, E2 | the keeper's story, told by props |
| Radio | C1, C3 | keeps the theme going, muffled, underground |
| Marker posts with red cloth (already in the colossus-plain scene) | B2 | route marks |
| Route sign | B3 | the bus stop |
| Rose-window shutter crank (a door variant) | E3 | the gallery reveal |

---

## 8. Light, weather and time: serene, then storm, then after the storm

**Rule.** Each region's light is fixed. Revisiting a place always looks the same, because the light
is the region's identity, not a clock.

The route is walked from morning to dusk. The weather belongs to places: the storm is always on the
spire.

**The two exceptions:**

- The **Blade** is a scripted transition, from storm to clear dusk, the first time you cross it.
  After that it is clear.
- **Ringwater's evening** is shown only after the round, for the rest of that session. A new visit
  is morning again.

| Phase | Region | Time | Runtime state (`weather.ts`) | Key light | Weather and air | Particles and accents (all through the flash gate) |
|---|---|---|---|---|---|---|
| Serene | A Ringwater | early morning | `serene`, day | pale sun in the ring's hole, shaft to the water | clear, high haze, still | dust, gulls, specks off the ring, glints on the ring's rails, a slow beacon at the break |
| Serene, wind rising | B1 Reed Shallows | late morning | `serene`, day | the sun breaking through | light wind | reed seeds, spray from footfalls |
| Uneasy | B2 to B5 Causeway, Mouth | overcast | zones: `mist` west, `overcast` east; day | flat grey-violet, cloud shadows, breaks of sun | wind rising to the east; the storm on the spire ahead | grit, grass seeds, birds over the colossus, far sheet lightning |
| Sheltered | C Hollow | none (underground) | `serene` with no sky in the windows; thunder only through the audio bed (new: an "underground" flag) | amber furnaces, stall lamps, white searchlights | warm haze, steam; thunder only as a far rumble | embers, dust, grit sifting from the ceiling, welding arcs, sign flicker |
| **Storm** | D1 to D3 Spire | afternoon storm | `rain` in D1, `storm` in D2 and D3; day, darkened | cold blue side-light, the pale planet, lightning glow in the clouds | rain, gusts on a cycle, thunder | rain, spray, sparks; at most 2 lightning starts in any second |
| Break | D4 Blade | storm to dusk | zones: `storm` to `after`, scripted once (`blade:cleared`); dusk | low rose-gold sun from the west | clearing in stepped bands, then still | drips, birds |
| After the storm | E Pilgrim Path and Chapel | dusk | `after`, dusk | sunset through the ring and the rose window | calm, wet | moths, dust in coloured light, candle smoke, glints on wet plates |
| Home | A after the round (this session) | evening | `serene`, night (a warm evening grade, not dark) | the lamps, the last glow, the line of lit shrines | still | moths |

**The runtime's weather rule versus this plan's.** The test world in `/world/` switches the
plain to after-storm once you have spent about 40 s indoors: you go in out of the storm and come
out after it. That was a proof of the weather program, not this world's rule. Here the storm
belongs to the spire, and each region's light holds, so W0 turns that beat off for the final
rooms. Time of day stays a room property, as it is today.

**Light feeds the player.** Every lit prop feeds the light list: lanterns, candles, furnaces,
warning lights, sparks and the rose window. So the player is rim-lit in the local colour: warm at
shrines, orange in the foundry, red in the storm, rose in the chapel.

---

## 9. Music and ambience

**The theme.** Dex's chosen **Suno "B"** cue:
`legacy/site/public/audio/world-v1/suno-theme-b-v1/support.opus` (and `.m4a`, with
`ATTRIBUTION.md`).

- It runs 83.77 s, including a 2.65 s quiet breath at the front.
- Its grand, mystical passage starts around 54 s.

**The CANON rules:**

- ambience comes first
- music swells in and never starts abruptly
- rooms that belong together keep one playhead running instead of restarting
- some reading spots are silent

**One more rule for a long world.** After the cue ends, ambience holds for 45 to 90 s. Then the
theme swells in again from its start. It is never a hard cut back in.

| State | What plays | Where |
|---|---|---|
| **Ambience first** | the room's sound bed only; no music for about 12 s | A1 on Enter |
| **Theme swell** | B fades in from its quiet start (the high piano phrase) and plays on at 70 to 100% | A0, A1, A2, A4, B1, B2 (about 80%), B5 (about 60%) |
| **Muffled** | the same playhead, low-passed, at -8 to -10 dB (through walls, or from a radio), so it never restarts | A3 lodge, C1 market, C3 Lift Foot |
| **Ducked** | B 4 to 6 dB under the room's ambience | resting at a shrine, B3, an open artwork panel |
| **Wind alone** | music ducks out while the colossus passes at eye level | B4 Stonetop |
| **Silence** | music fades out over 4 s; only room tone | C2 Archive; D4 for 2 s |
| **Opening up** | the muffled playhead un-muffles and rises, then thins out as the rain takes over | D1 Lift Ride |
| **Storm** | no music: rain, wind, and thunder after each flash | D2, the D2 alcove (muffled through glass), D3 idle |
| **Arena** | the orchestral variant: 3 s fade in when the terminal wakes, 6 s fade out when it cools down | D3 while woken, summoning or holding a seal |
| **Grand passage** | B from about 48 s under a 5 s swell, timed so about 54 s lands as the clouds finish opening; it plays to the cue's end across D4 and E1 | D4, E1 |
| **From the top** | B restarts from its beginning, the only place it does | E3 Chapel, carrying on to E4, where it ends naturally |

**What the runtime plays today** (`src/world/audio.ts`, wired but not yet listened to). Each room's
`audio` gives `music` (`theme`, `arena` or `none`), a `bed` (`exterior`, `interior` or `water`),
silence zones, and how much weather comes through the walls. Music never starts abruptly: a quiet
gap, then a 9 s swell. Rooms with the same music keep one playhead, and the level ducks for rain,
interiors and panels. That already covers Ambience first, Theme swell, Ducked, Silence, Storm
and Arena.

These states still need W0 and S1:

- **Muffled** as a low-pass at a named level, rather than only a duck.
- **Opening up**, which ramps muffled to open over the lift ride.
- **Grand passage**, which enters the theme at a set offset under its own swell.
- **From the top**, a forced restart that is allowed only in the chapel.
- **Wind alone**, a duck driven by the colossus's position.
- The **rest-then-swell** rule after the cue ends.
- The ambience beds below, beyond the current three.

**The arena variant: the honest status.** No orchestral arrangement of B exists yet. The only
candidate on disk is `legacy/site/public/audio/v2/arena-chamber-v1.opus`. It is an original
strings-and-cello piece on a different motif, and nobody has approved it. It can stand in, but an
orchestral B needs Dex's ear (question 5).

**Cue points get picked by ear with Dex:** the swell-in point, the Blade's entry point, and the
fade lengths. A technical fade check is not a listening approval.

**Ambience beds needed:**

| Bed | Where |
|---|---|
| Lake | water lap, far gull, rope creak |
| Colossus footfall | sub-bass thud, then a long wash |
| Lodge | stove, kettle, clock |
| Reeds | reed hiss |
| Plain | wind layers, grass hiss, distant thunder |
| Shaft | machine hum rising from below |
| Market | murmur with no words, hammering, steam, furnace, freighter horn |
| Archive | room tone, clock, paper |
| Waiting room | fluorescent hum |
| Storm | rain, gusts, thunder |
| Alcove | rain on glass |
| Dusk | wind dying, drips |
| Chapel | large reverb tail, candle hiss |

**SFX on disk in `legacy/site/public/audio/world-v1/`** are candidates:

- `cable-cut` for the map cord and the rope bridge
- `lift-start` and `lift-dock`
- `step-concrete-*` and `step-metal-*`
- `paper-open` for the lectern and panels
- `landing`, `slash-*`, `hit-metal`
- `telegraph` for the terminal waking
- `confirm`

**Still missing:**

- bells (ferry, rib, chapel)
- water steps and splashes
- cloth, glass shatter, and the shard reassemble
- the colossus footfall
- the horn
- the crank

**Footstep surfaces needed:** wood, stone, packed earth, shallow water, metal grating, wet metal,
tile and rug.

---

## 10. Pacing curve

**What the curve shows.** Vast and cozy alternate about every minute: each vast space is followed by
a small one, and each small room holds a shrine or a service. So rest and usefulness land where the
space closes in.

Tension has **one** long rise, from serene through the rising wind and the storm climb, to a single
peak at the arena. Then it drops at once when the storm breaks. The storm alcove is a breather
inside the rise, so the climb isn't a flat wall of tension. The second half is an exhale: vast and
calm, then cozy and calm.

That is Dex's brief in one line: grand in places and cozy in others, vast then indoors, serene then
storm.

**Scales.** Space runs from **+5 (vast)** to **-5 (cozy)**. Tension runs from **0 (serene)** to
**10 (storm)**. The chart is the lower half of `WORLD-MAP.svg`: two panels sharing the route axis,
never one chart with two y-axes, with a hover tooltip on each point. The same data:

| # | Beat | Space | Tension | Time into a first round |
|---|---|---|---|---|
| 1 | A1 Dock (arrival) | +5 | 1 | 0:00 |
| 2 | A2 Cliff Stair | +2 | 1 | 0:12 |
| 3 | A3 Keeper's Lodge | -4 | 0 | 0:20 |
| 4 | A4 Yard, shrine 1, map | +1 | 1 | 1:10 |
| 5 | B1 Reed Shallows (colossus close) | +4 | 3 | 1:35 |
| 6 | B2 Causeway | +5 | 3 | 2:05 |
| 7 | B3 Bus Shelter, shrine 2 | -3 | 2 | 2:40 |
| 8 | B4 Stonetop (optional) | +5 | 4 | 2:50 |
| 9 | B5 Hollow Mouth | +3 | 4 | 3:10 |
| 10 | C1 Foundry Market, shrine 3 | +1 | 2 | 3:35 |
| 11 | C2 Archive | -5 | 0 | 4:10 |
| 12 | C3 Lift Foot | -2 | 2 | 5:10 |
| 13 | D1 Lift Ride | +4 | 5 | 5:30 |
| 14 | D2 Outer Climb | +3 | 8 | 5:50 |
| 15 | D2 Storm Alcove, shrine 4 | -4 | 4 | 6:40 |
| 16 | D3 Crown (summoning) | +1 | 10 | 7:20 |
| 17 | D4 Blade (the storm breaks) | +5 | 2 | 8:20 |
| 18 | E1 Pilgrim Path | +4 | 1 | 8:40 |
| 19 | E1 Pilgrim Shrine, shrine 5 | -1 | 0 | 9:05 |
| 20 | E2 Chapel Porch, shrine 6 | -2 | 0 | 9:35 |
| 21 | E3 Chapel of Light | +1 | 0 | 9:50 |
| 22 | E4 Balcony | +5 | 0 | 12:50 |
| 23 | A3 Lodge loft (through the sky door) | -4 | 0 | 13:20 |
| 24 | A0 Pier's End (home, the keeper) | 0 | 0 | 13:45 |

These values are design intent, not measurements. The integration lane checks them in a real
playtest (section 13, I1).

**Checked by I1 (2026-09-29, `review/world/phase2/I1/pacing.png`):** in the recorded playtest the
game's tension was in the plan's band at every beat walked and its space at 18 of 23 (A4, D3, the
pilgrim shrine, E3 and A0 read one band off, as their room texts say), in the plan's order; the
bot took 8.8 minutes, so the times are compressed against a person's 12 to 15.

---

## 11. Save state and world flags

Everything the world remembers. All of it is per save, and nothing about payment or donations gates
any of it.

**Where it lives.** The runtime's save (`src/world/save.ts`, localStorage `dex.world.v1`) already
has boolean `flags`, a `rest` place (you start there on the next visit) and the sound choice. It
already writes `cut:<propId>` and `latch:<doorId>`. The keys below use the same `kind:id` pattern,
so the new ones need no new save format. Pixel-matter props also keep their own persist keys in
`world.saveData[propId]`; the adapter mirrors the ones listed here into `flags`, so a single save
answers every "is it open" question.

| Flag | Set by | Changes |
|---|---|---|
| `shrine:1` to `shrine:6` (and `rest`) | resting at a shrine lantern | the lantern stays lit; lamp posts to the next shrine light up; the lamp board and the map show it; distant layers show a lamp point (seen from D4 and E4); `rest` becomes this shrine |
| `cut:map-banner` | slashing the banner cord | the banner hangs unrolled; E reads it |
| `cut:rope-bridge` (S1) | slashing the rope from the east bank | the deck lies lowered and walkable |
| `lever:culvert` (S2) | the lever in B5 | the gate is up; the ferryman is awake; the ferry bell calls the boat |
| `lever:express` (S3) | the lever in D3 | the lift runs C3 to D3 non-stop |
| `blade:cleared` | crossing D4 once | the Blade stays clear |
| `rose:open` | the crank in E3 | the nave stays sunlit |
| `latch:sky-door` (S4) | the latch on E4 | the sky door is a two-way door; the dusk patch lies in the loft |
| `round:done` | walking through the released door the first time | the keeper and two cups at Pier's End, evening light (this session); later visits show her chair in the dusk patch |
| `keeper:greeted` | her first line, once | she won't repeat it |

**Start place after the round (I1):** completing the round (`round:done`) sets the save's start
place to the dock, so the next visit opens on the morning dock; resting at a shrine later moves it
as usual.

**Not saved:** Ringwater's evening light (it lasts only for the session, so the arrival is
morning again next visit) and every broken or healed prop apart from the cuts above.

---

## 12. Engine and runtime asks (for the build lanes, not done here)

**Scene engine** (`src/scenes/engine/**`). Add these without changing existing behaviour, and note
them in `SCENES.md`:

- **Moving ring ripples.** Water ring ripples at points that move, fed each frame. For the colossus,
  they come from the walk's TypeScript twin. Today the ripple points are fixed at build time.
- **A wading colossus.** Spray and drips at the feet instead of dust.
- **Sheet-water ground** for the plain: the colossus-plain ground with water's reflection rows.
- **Light states.** Per-region palette states (morning, overcast, amber, storm, dusk, evening),
  plus a scripted stepped-band transition for the Blade. The world backdrop already passes weather
  uniforms (`uWx`, `uWx2`, `uBolt`, `uCamY`) to every layer, so scenes grade from those.
- **Distant lamps.** Far-layer lamp points keyed to the save.
- **Shader size.** The arrival's shaders take about 9 s to compile under ANGLE/D3D11 in headless
  Edge (RUNTIME.md). The runtime hides this honestly, but smaller shaders are the scenes lane's
  lever, and they matter more with 21 rooms.

**World runtime** (`src/world/**`, exists; see [`RUNTIME.md`](RUNTIME.md)). The runtime already
has most of the list this plan needs:

- rooms as data in H
- edge exits and doors
- latched shortcuts
- lifts that carry you
- pits that return you to safe ground
- streaming
- framing zones
- weather zones and flash-gated lightning
- the E interaction and DOM panels (loading the site's pages with `?embed=world`)
- the save
- `?room=` and `?spawn=`
- the debug overlay
- touch
- the combat zoom to the 144 px close-up

What this plan still asks of it:

- **The pixel-matter adapter** (RUNTIME.md, "Props"): one `PixelWorld` per room, with its
  colliders, lights, wind, hits, panel, sound and state events, and its save data wired in. It
  replaces the stub props (`src/world/props/stub.ts`).
- **Camera modes** from section 1 (locked, rail, free, vista hold, arena clamp) and a **per-room
  anchor**. Today there is one global anchor plus framing zones.
- **Rides and moving floors:** the ferry, the crane hook, the express lift, and wading water at
  50% run speed.
- **Sitting:** E on a bench sits, holds the camera and hides the UI.
- **Audio states** beyond today's three music values (section 9).
- **An underground flag** for the hollow: no sky, with thunder only in the audio bed.
- **The final rooms keep their weather.** Turn off the test world's "the storm passes while you're
  indoors" beat (section 8).
- **A travel-time logger** for checking section 6.

**Stale docs.** `SCENES.md` still describes 640 / 960 targets and a 136 px stand-in.
`docs/character/RUNTIME-CONTRACT.md` and the character docs still assume the old view and H = 96.
Their owners should update them to `scale.ts`. This lane doesn't edit `docs/character/**`.

**Cost risk.**

- The arrival, with the ring and the colossus in one scene, costs about 2.1 ms per frame at
  1280 x 720 on the 4090.
- Under SwiftShader the 640 x 360 prototypes already took 41 to 107 ms per frame. 1280 x 720 has 4x
  the pixels, so expect several hundred ms there.
- Each colossus layer's `Tracker` bounds (scissored to its columns) matter even more at this size.
- The pixel engine measured 2.4 to 2.7 ms of CPU per frame right after a Q, with about a million
  cells in the sandbox room. Region lanes with many awake cloth or flame parts need their own
  budget (ENGINE.md, "Known limits").
- A real laptop measurement is required before any region is called done (lane I1).

---

## 13. Build breakdown for phase 2

**Shape.** Two foundation lanes go first, and both extend code that already exists: W0 the
world runtime in `src/world/`, and P0 the pixel engine in `src/pixel/`. Five region lanes can
then run in parallel, each owning only its own rooms. An audio lane runs alongside, and one
integration lane goes last.

The region lanes can start on day one. Their **backdrop scenes** only need the existing scene
engine, and the room format already exists (`src/world/room/types.ts`, with the test rooms in
`src/world/rooms/` as examples). Their props start on stub recipes and move to pixel matter as
P0's kit and the adapter land.

**Paths below are proposals; the coordinator assigns the real ones.** They follow how the code
is actually wired today:

- Scenes are found by a glob in `src/scenes/main.ts`, so a new scene file needs no shared edit.
- Rooms are registered in `src/world/main.ts`, which W0 owns. Region lanes hand W0 one import
  line each.
- Pixel-matter recipes in `src/pixel/props/<region>/` are found automatically
  (`src/pixel/registry.ts`, `findRecipe(id)`), so region lanes add files and never edit
  `src/pixel/props/index.ts` (P0, proven; `docs/props/ENGINE.md`, "Region recipes").

- A lane never edits another lane's paths.
- Nobody edits `vite.config.ts`, `src/site/**`, `src/lab/**`, `tools/**`, `art/**` or
  `docs/character/**` without their owner.
- Ports are 22000 to 22999.
- There is no image generation. Props are pixel matter (data, not image files), and backgrounds
  are procedural. Dex's art appears only as gallery display.

**Every lane's acceptance also includes these common checks:**

- **Scale.** Screenshots at 1280 x 720 at 1x, at a 1.5x sharp-bilinear fit (1920 x 1080), and on
  mobile. The player measures 80 px, and every size matches the tables here within one pixel per H.
- **Crispness.** No plain-bilinear frame anywhere.
- **Flash budget.** `flashcheck` shows at most 3 flash starts in any second (target 2), including
  in reduced motion.
- **Cost.** `gpucost` at 1280 x 720 on d3d11, recorded against the room budget, with the SwiftShader
  number noted.
- **Readability.** The player stays readable in front of every backdrop.
- **Content.** No invented products, donors or totals. Empty data stays empty.
- **Review.** The lane looks at its own captures and judges motion through a full cycle before
  reporting. Captures go to git-ignored `review/`.

| Lane | Owns (proposed) | Builds | Interactions | Acceptance, besides the common checks |
|---|---|---|---|---|
| **W0 World runtime and grey-box** (first) | `src/world/**` except the region room folders, `src/world/sound/**` and `src/world/story/**`; `world/index.html`; `docs/world/RUNTIME.md` | Extend the existing runtime with the asks in section 12: the pixel-matter adapter, the camera modes and per-room anchor, rides and wading, sitting, the audio states, the underground flag, the save keys in section 11, and a travel-time logger. Retire the test rooms (`plain.ts`, `house.ts`) once their regions exist. **A grey-box of all 21 rooms** at their sizes, collision only, in `src/world/rooms/_blockout/`. | doors, lifts (keyed motion with easing), rides, the sky-door link, respawn at the last lit shrine | The whole round is walkable in grey-box end to end. Measured times are within 20% of section 6. Every required gap and ledge is inside the limits in section 1. All four shortcuts work and persist across a reload. The website scroll-away works from every room. |
| **P0 Pixel-matter engine and shared kit** (first, in parallel) | `src/pixel/**` except the region recipe folders; the `/props/` sandbox; `docs/props/ENGINE.md` | First, make `src/pixel/scale.ts` read `src/scenes/engine/scale.ts` (section 1). Then the engine's open limits (ENGINE.md), and **the shared kit.** Already proven: map banner, boss terminal, donation box and donor plaque, stained glass, candelabra, destructible floor, font. Still to build: shrine set (lantern, bowl), doors (all states, including latched and rail), lamp post, bench and pew, loose candles, hanging lantern, hanging bell, banners and cloth, grass, flowers and vines, rubble, crates and barrels, luggage, signs, cables and chains, breakable pillars, training dummy, lever, dust, moths, puddles and paper. | hit shapes, wind, light-list feed, collision types, sound cues per state | Every kit prop is recorded in the sandbox through all its states, with one critic pass at game size (readability, style match with the player, motion, reason) and one fix round. Undisturbed props cost nothing per frame. Particle caps hold. The breakage policy in section 4 is enforced. |
| **R-A Ringwater** | `src/world/rooms/ringwater/**`, `src/pixel/props/ringwater/**`; takes over `src/scenes/scenes/arrival*` and replaces the test room `src/world/rooms/arrival.ts` | A0 to A4. The dock extension, the red line, and the evening light state. Lodge interior. Props: counter, bell and ledger; lamp board; product board; stove and kettle; cups; sky door and rail; map banner; ferry boat and ferryman; ferry bell; pier lantern; mooring posts, rope and buoys; reeds; laundry line; the keeper (idle, acknowledging, away, at Pier's End). | dex account panel, donate panel, product board (website scroll), map panel, keeper's two lines, sky door both states | The first frame matches section 4 A1: nothing interactive in view, the red line visible. The hybrid shows the colossus's reflection in the ripples and its pass through the shaft. The account panel shows only real session state. The map shows real flags. The ending plays with `round:done`. |
| **R-B Shore and Plain** | `src/world/rooms/plain/**`, `src/pixel/props/plain/**`, scenes `reed-shallows`, `causeway`, `hollow-mouth` (built from `colossus-plain`) | B1 to B5. The wading colossus at depth about 8 and the sheet-water flats (engine asks in section 12). Props: rope bridge, standing stones, prayer flags, red marker posts, colonnade, footprint crater, rib arch, bus shelter and route sign, crane-hook lift, culvert gate, levers and horn. | S1 cut; S2 opening (including waking the ferryman); crane lift calls | Footfall ripples cross the water and rock the reeds. The 1 to 2 px shake is flash- and motion-safe (off in reduced motion). The Stonetop pass fills half the frame. The causeway takes about 32 s with something new every screen. |
| **R-C Hollow** | `src/world/rooms/hollow/**`, `src/pixel/props/hollow/**`; reuses `amber-hollow` layers | C1 to C3. Props: stalls and awnings, neon signs, steam vents, junction boxes, background cranes, red pipe, radio, shelves and scroll racks by product, archive lectern, the archivist, lift platform and gate, warning lights, waiting-room benches, ticket display. | documentation index and per-product docs (real docs only), lift call | The archive door is an ordinary door with no prerequisite. The docs panel is plain readable DOM with focus and close. Music falls silent in the archive within 4 s. Dust sifts in time with the colossus's footfalls. |
| **R-D Spire** | `src/world/rooms/spire/**`, `src/pixel/props/spire/**`; reuses `monolith-planet` layers | D1 to D4. The storm and gust programs on the runtime's weather (the gust cycle and its tells), the storm light state, the stepped storm-break. Props: lift ride and counterweight, pennants, broken armour, arena floor seals, shutters, the terminal, the express lever, alcove stained glass. | the terminal flow (`dormant`, `woken` with the live product list, `summoning`, `summoned`, `cooldown`, website pointer); S3 | Gusts are telegraphed at least 1 s ahead and never push the player off. Lightning stays inside the flash gate with no white flash on the player. The terminal lists only real products and never fakes a fight or a download. The Blade reveal shows the colossi below and the lit shrine points. |
| **R-E Chapel** | `src/world/rooms/chapel/**`, `src/pixel/props/chapel/**`, scenes `pilgrim-path`, `chapel` | E1 to E4. The ring segment at dusk and the chapel interior. Props: stained-glass panels, prayer candles, processional banners, rib and chapel bells, font, 9 frames and easels, the catalogue lectern, rose window and shutter crank, censer, pews, tapestries, broom, shawl, dusty cup, the latch door. | artwork panel (one work, alt text, next and previous), catalogue (all 9), rose shutter, latch (S4) | The art is loaded only from `content/gallery/manifest.json` and `public/gallery/`, shown at display quality in DOM. It is never pixelated, tinted, lit, or used as texture or backdrop. Frames ignore hits. Nothing fractures in the nave. The latch rings the bell and opens into the A3 loft. |
| **S1 Sound** | `src/world/sound/**` (cue points, beds, footstep tables), `public/audio/world/**` | Copy the chosen files from `legacy/site/public/audio/` into `public/audio/` and switch `AUDIO_BASE`, since `legacy/` is never served in production. Then the music state machine's content: cue points, fades, the rest-then-swell rule, the ambience beds and the SFX list in section 9, footsteps per surface. | state changes driven by W0 | No abrupt starts: every music entry is a swell. Rooms that belong together keep one playhead. The archive is silent. **Dex listens and approves by ear**; fade checks alone don't count. |
| **I1 Story and integration** (last) | `src/world/story/**` | The residents' states; the keeper's arc and the ending; distant lamps keyed to the save; the lamp board; the evening state; all shortcuts end to end. | the whole round | A full first-round playtest recorded, with space and tension checked against section 10. Returning-visitor times checked against section 6. Real-device runs on Samsung Internet (Android) and iPad Safari, reported separately from emulation. A laptop GPU measurement per region. |

**Status, P0 (2026-09-29): proven.** The scale is folded into one source; region recipe folders
are auto-discovered; the whole shared kit is built (shrine lantern and offering bowl, doors of
every kind with the latched state and maintenance rail, lamp post, bench and pew, loose candles,
hanging lantern, hanging bell, banners, tapestry and pennants, prayer flags and laundry, grass,
flowers and vines, rubble, crates and barrels, luggage, signs including neon, cables and chains,
breakable pillars, training dummy, lever, dust, moths, puddles, paper); the proof props match
the section 1 sizes and the map banner shows the real route. Each recipe is recorded through its
states, critiqued at game size and fixed once; undisturbed props cost nothing but 15 Hz flames;
caps hold; the breakage policy is enforced and checked (fix round 2: grass, vines and rubble's
`shake` no longer cut or crumble in a sway-only room, and `policy.mjs` now fires every move from
both sides and checks the form of code-drawn plants and the floor too: 0 violations, and it
reports 4 when the plant gates are removed). Details and numbers:
`docs/props/ENGINE.md`; captures: `review/world/phase2/P0/`.

**Status, R-A Ringwater (2026-09-29): built and proven** (details: `RUNTIME.md` "Ringwater";
captures `review/world/phase2/R-A/`). A0 to A4 and the ferry ride's lake replace the grey-box
by id in `src/world/rooms/ringwater/`, on the grey-box's world coordinates, spawns, exits and
prop ids, so the round's bot still walks them. Backdrops: the arrival scene made into a factory
(`arrivalScene()`): the dock with its older boardwalk, the red line and the cliff foot (A1);
Pier's End seen from 27 H further left with true parallax (a camera bias: A0); the cliff stair
and the yard seen from higher (a camera rise: A2, A4); the evening palette after the round; the
lodge interior is its own scene. The arrival colossus's rear-leg slice is fixed (the body's
`EXTENT.x1` 300 -> 380: 68 of 116 sampled seconds of a pass showed a straight vertical cut of up
to 61 rows before, none longer than 15 rows after, those being real straight leg edges and the
cliff's occlusion; `edgecut-before/after.json`), and the deck is at 0.8 (section 1). Seventeen
region recipes in `src/pixel/props/ringwater/` (counter with bell and ledger, keeper, lamp
board, product board, stove and kettle, cups, the ringBench, shelves, lodge and sky doors,
lodge facade, shrine arch, pier lantern, mooring posts with floats, bell post, reeds, ferry
boat with the ferryman). Acceptance: the first frame has nothing usable in view and the red
line runs from the player's feet to the right; the colossus crosses the shaft once a pass
(about 118 s) and its lit reflection breaks up in the ripples; the account panel says plainly
that the dex account isn't open yet; the map panel and the banner show only the save's lit
shrines; the keeper's first line comes once per save (`keeper:greeted`); the sky door opens
barred onto the dusk until `latch:sky-door`, then goes through; with `round:done` set this
session Ringwater turns to evening, the keeper leaves the lodge (front door open) and sits at
Pier's End with two cups and says her second line when you sit with her. Changed from the grey-
box: A2 is one locked 9 H frame (the whole climb in view, so the lake backdrop holds true) and
its top lamp post stands on the upper flight; the A4 shrine keeps the grey-box's x.
Independent critic (2026-09-29, `review/world/phase2/critic-R-A/`, own Playwright probes at
720p, 1080p 1.5x sharp, 1440p 2x and a 844 x 390 phone): every R-A acceptance item re-proven
with real input and no page errors (nothing usable in view for 20 s at all four sizes, feet at
0.8; colossus lit in the shaft about every 118 s; account panel text only; map and lamp board
show exactly the save's shrines; sky door barred on a fresh save; ending through the real E4
latch with `round:done`, "There they go." shown 1.5 to 6 s after sitting). The edge scan finds
no body-space slice left on the arrival or colossus-plain. Polish notes, not blocking: the lodge
is warm-toned but evenly lit (small stove glow, a bare upper-left wall); A2's cliff is a large
flat dark mass; the player stands, not sits, on the Pier's End bench (no sit pose); after the
round the lodge windows keep morning light.

**Status, lane W0 (2026-09-29; details and numbers in [`RUNTIME.md`](RUNTIME.md)).** Built and
proven in `/world/`: the grey-box of all 21 rooms (`src/world/rooms/_blockout/`, B3 and B4 as
areas of B2, plus the ferry ride S2), walkable end to end by a bot using real input
(`src/world/tools/round.mjs`); every jump the round needs is a 0.8 H ledge or a gap of at most
1.1 H; the section 6 times are within 20% (first visit: account 18 s, donate 21 s, map 28 s,
documentation 153 s, downloads 280 s, illustrations 372 s; returning: 18, 21, 29, 72, 117, 40 s);
all four shortcuts work and their flags survive a reload (the sky door stays barred on a fresh save
until the balcony latch); the website scroll-away works in every room, by wheel on desktop and by
a vertical swipe on a phone. Also built: the pixel-matter adapter, the camera modes and per-room anchor, vista holds and
the arena clamp, rides (crane hook, spire lift with the express stop, ferry) and wading,
sitting, the music states of section 9 (as a machine; nothing listened to), the underground
flag, the section 11 save keys, the travel-time logger, the story and sound hooks. Region lanes
replace a grey-box room by giving theirs the same id in `src/world/rooms/<region>/`; nobody edits
`main.ts`. Deviations: E4 is 28 H wide (a 12 H stair of standard steps needs 18 H of run), the
A3 loft is 3.4 H tall so the lodge fits one locked screen.

**Status, lane R-E (2026-09-29): E1 to E4 built and proven in `/world/`** (details and numbers in
[`RUNTIME.md`](RUNTIME.md), "Region E"; recipes in [`../props/ENGINE.md`](../props/ENGINE.md),
"Chapel"; captures in `review/world/phase2/R-E/`). The pilgrim path down the fallen ring at dusk
(sun in the far ring's hole, colossi on the horizon, lit shrines as points on the valley floor,
keyed to the save), the porch with the keeper's story in props, the Chapel of Light with Dex's
nine works as real thumbnails pinned in their frames (section 14, default 3) and the full work on
E with previous / next / all works, the catalogue, the rose shutter and its sweep, the nave rule,
and the bell tower with the latch home. `verify.mjs` passes 23 of 23 with real input; the common
checks pass (scale, sharp-bilinear, flash at most 3 a second under bell spam, 0.9 to 3.4 ms on
d3d11). Deviations: the E1 surface is flights of standard steps (0.2 x 0.3 H, 33.7 degrees) with
landings, since 44 H of drop over 80 H with a 6 H terrace leaves no room for a sub-30-degree ramp;
shrine 5 sits at x 356.8 on a terrace 351.6..358 (plan: 360), the rib bell at 342.45 (plan: 344);
E4 keeps W0's 28 H width and puts the balcony at the east end (its view looks back across the
valley with the sun and ring in front of you); the gallery's DOM overlay and panel buttons reach
the runtime through `window.__world` until W0 exposes a mapping (asks in RUNTIME.md).
Fix round after the R-E critique (2026-09-29): where Rosace passes in front of a work, only her
exact sprite silhouette is masked out of the thumbnail (no more fixed box that showed the black
board as a strip under the work, or a box while jumping); measured in pixels over 162 captures
at 1080p, 1440p and phone (`mask.mjs`): no board shows. The rose light now visibly comes to rest
on the niches 06 to 09, and the nave's candelabras relight themselves after a hit
(`verify.mjs`: 24 of 24).

**Status, lane R-C (2026-09-29): C1 to C3 built and proven in `/world/`** (details and numbers in
[`RUNTIME.md`](RUNTIME.md), "Region C"; recipes in [`../props/ENGINE.md`](../props/ENGINE.md),
"Hollow"). The market is the amber-hollow scene re-framed for its street with the market's own
near layers; the archive and the lift foot have their own scenes. Every prop in the R-C row is
pixel matter (26 region recipes plus the kit). Acceptance: the archive door is an ordinary door
with no prerequisite; the documentation index is the site's real `/docs/` page in W0's DOM dialog
(focus in, Esc out); the music's real gain reaches 0 within 4 s of the door (3.9 to 4.0 s measured); grit sifts on the
same tick as every footfall (a thud every 2.5 s through a crossing); flash at most 2 a second;
1080p, 1440p and phone captures; 1.4 to 5.4 ms a frame on d3d11. Open: per-product docs need the
archive panel to use its `arg` (W0's `ui.ts`; the bays already send the `/docs/` group anchor).

**Status, lane R-D (2026-09-29): D1 to D4 built and proven in `/world/`** (details and numbers in
[`RUNTIME.md`](RUNTIME.md), "Region D"; recipes in [`../props/ENGINE.md`](../props/ENGINE.md),
"Spire"; captures in `review/world/phase2/R-D/`). The lift ride with its backdrop keyed to the
car's height (the foundry's haze, the ceiling rock, the storm), the outer climb on the spire's
face with the storm alcove (shrine 4) and the secret perch, the Crown's arena, and the Blade with
the stepped storm-break onto the dusk world (colossi below, the lit shrines as lamp points). One
storm program drives gusts, the rain's lean, the pennants and the beacons from the backdrop's
clock. Acceptance: every gust's tell starts 1.48 to 1.50 s before the push, and the push never
carries her past a catwalk's stop or off it (standing, walking with and against it, on every
catwalk); the terminal wakes on the real products from the site's downloads data, summons (seals,
shutters, arena clamp), then cools down and points at the website: no fight, no download, nothing
unlocked; flash starts at most 1 in any second in D1 to D4 (reduced motion too); the whole climb
walks with real input from R-C's Lift Foot into R-E's Pilgrim Path (ride 25.8 s, climb 81.8 s,
express return 36.9 s), and W0's round walks over it; 1080p, 1440p and phone captures; 1.2 to
3.9 ms a frame on d3d11. Fix pass after the critic (`review/world/phase2/R-D/fix/`): the Blade's
bench stands on a widened flat tip (it floated 0.5 H over the slope), the D1 foundry yard fills
the lower screen, the terminal's caret shows and the roster pages instead of dropping products,
the lit lamps and the colossi below read better; the climb, gusts timing and checks re-run on the
integrated repo with the same numbers. Open, for W0: the runtime's `rain` strikes (1.2 a minute)
still brighten the player's key and rim (about 2.1 times the brightness around her at a full
strike, the critic's measure), so the acceptance line "no white flash on the player" is not met
until the weather program gets a sky-only strike option (or a per-room lightning override) that
D1 to D4 then turn on; the spire's own storm lightning stays in the clouds. Also for W0: the
`summon` close-up frames her at the terminal, so the seal ring lighting in sequence is off
screen.

**Status, lane R-B (2026-09-29): B1 to B5 built and proven in `/world/`** (details and numbers in
[`RUNTIME.md`](RUNTIME.md), "Region B"; recipes in [`../props/ENGINE.md`](../props/ENGINE.md),
"Shore and Plain"; scenes in [`SCENES.md`](SCENES.md); captures in `review/world/phase2/R-B/`).
Three backdrops built from colossus-plain: the reed shallows (the lake late in the morning, a
colossus wading at depth 8), the causeway (flooded sheet water, the colossus at depth 9 and a
ghost, the spire and its storm ahead, the wind rising east) and the hollow mouth (the shaft
from above, cold grey to amber). Every prop in the R-B row is pixel matter: 11 region recipes
(rope bridge, reed beds, marker posts, standing stones, rib arch, bus shelter, route sign, crane
frame, culvert gate with its horn, call levers, the rumble) plus the kit's prayer flags,
pillars, lever, lamp posts, shrine set, bench, sign, rubble, grass, paper, puddles, moths,
chains and vines; the crane's hook is the runtime's carrier in the region's steel. S1 (cut only
from the east bank), S2 (the culvert lever; R-A's ferryman wakes on `lever:culvert`) and both
hook calls work and persist across a reload. Acceptance: the one big footfall a pass throws a
ring that reaches the player plane 2.5 to 2.9 s later and bows the reeds and grass (lean 0.22
to 1.14 in B1); the shake is 1 px in B1 and 2 px in B2, off in reduced motion, and flash starts
stay at most 2 a second; the colossus fills 0.65 (road) and 0.79 (summit) of the frame's height
as it passes Stonetop; the causeway takes 34.2 s end to end with something new every screen
(marks and stones, colonnade and crater, the wade and the ribs, the shelter and the tor); 1080p,
1440p and phone captures; 1.5 to 6.6 ms a frame on d3d11. Deviations: the crater is standard
steps down 2.8 H (the grey-box's), the hook drops 32 H in 10 s, B5's way down keeps the
grey-box's slabs 4 H apart. Critic fix (2026-09-29): the B5 street's flat dark wall (about 45% of the
bottom frame) is now the hollow's lit floor with two rows of market stalls, the fallen arcade across
the street and the east arch full of the market's light; in that region near-black pixels fell from
90% to 11% (`review/world/phase2/R-B/fix-b5/`).

**Status, lane S1 Sound (2026-09-29): built; proven by measurement only with a W0 patch still to apply; not yet approved by ear**
(details in [`RUNTIME.md`](RUNTIME.md), "Sound"; evidence `review/world/phase2/S1/`). The chosen
files are copied from `legacy/` into `public/audio/world/` with their attribution, and
`AUDIO_BASE` is `/audio/world` (through the sound hook, `src/world/sound/tables.ts`). Built: the
twelve beds of section 9, every missing effect (bells for the ferry, the rib and the chapel,
splashes, cloth, glass shatter and the shard reassemble, the colossus footfall, the horn, the
crank, and more), a footstep pair for each of the nine surfaces, a file for every cue id the code
emits, the bell per place, and wind alone at Stonetop. `verify.mjs` passes 25 of 25 with real
input and real Web Audio: ambience first; every entry rises from zero gain (largest step 0.006
per 50 ms); Ringwater keeps one playhead; the lodge is muffled; the archive reaches silence in
4.0 s; the storm has no music; the grand passage enters at 48 s and carries into E1; the chapel
starts from the top; the end rests 72 s, then swells in; Stonetop ducks for the whole pass.
Critic fix (2026-09-29): that run timed entries by the clock, and the critic heard three real
failures, all in W0's `audio.ts`. `verify.mjs` now times each entry by actual playback, walks onto
the Blade, lets the rest end inside the archive and runs on emulated fast 3G (29 checks). On the
tree as it is: **25 of 29** (the Blade's entry arrives at 44% gain when the rain eases mid-swell;
after a rest that ends in the archive the Hollow's music stays dead; on fast 3G, A2 and D4 first
sound 27 to 28 s late at full level). With S1's handoff patch for W0
(`review/world/phase2/S1/w0-handoff/audio.ts.patch`, served in place of `audio.ts` on a proof
server, nothing outside S1's paths edited): **29 of 29**, every entry 19 to 25 dB under its
settled level for its first half second and at zero gain when the element starts. **Not signed
off until W0 applies the patch.** Also open: Dex's ears (every file is `listening: pending`); for
R-D, D1's "Opening up" ramp and D4's storm cut-off with 2 s of silence (room data); iOS Safari on
a real device.

**Status, lane I1 Story and integration (2026-09-29): the whole round integrated and played;
real-device and laptop runs pending for Dex** (details and numbers in [`RUNTIME.md`](RUNTIME.md),
"The round, integrated"; evidence `review/world/phase2/I1/`). One continuous first round from a
fresh save through every region's real rooms, dock to lodge to Pier's End, with real input, 0
errors, recorded as 15 key-beat clips and a timelapse. The story glue (`src/world/story/`) makes
the evening arrive everywhere at once after the sky door (the lodge beyond it used to keep morning
windows), starts the next visit on the dock once the round is done, and shows the lamps you lit,
live from the save, on Ringwater's far strand (the ending's "line across the valley", with the
colossus walking over them) and from the balcony (the scene's own lamps were hidden under the
valley mist). The residents and the keeper's arc run as the regions built them: her first line
once, the lamp board, away at evening, two cups and "There they go." at Pier's End; the ferryman
wakes on the culvert and runs the ferry; the archivist hums (R-C). All four shortcuts work end to
end; returning times 18.5 / 20.9 / 29.2 / 74.6 / 121.1 (+15%) / 39.8 s against section 6; all 15
flags survive a reload. Pacing against section 10: tension in the plan's band at all 23 beats
walked (one rise, the peak at the Crown, calm from the Blade), space at 18 (the other five are
boundary cases the room texts describe), cozy places every 0.5 to 2.4 minutes; the bot's round is
8.8 minutes (44 s of stops) against the plan's 13.75, so the 12 to 15 minutes needs a human
playtest. Common checks re-run on the integrated tree: 1080p, 1440p, phone; flash at most 2 a
second over the whole round (A2's glints reach 3 alone); 0.8 to 5.9 ms a frame on d3d11.
**Pending for Dex:** Samsung Internet and iPad Safari on real devices; a laptop GPU per region; a
listening pass; a human stopwatch round. Open for other lanes: see RUNTIME.md "Open".

**Order and overlap.**

- Days 1 to 2: W0 and P0 start. R-A to R-E start their backdrop scenes and lay out their rooms
  in the existing room format, with stub props.
- Then the region lanes swap in pixel-matter props from P0's kit, plus their own region props,
  as the adapter lands.
- S1 follows W0's state machine.
- I1 starts when at least three regions are walkable.

---

## 14. Open for Dex

**Defaults applied for phase 2 (2026-09-29, coordinator; Dex may override any of them):**
1. Order as planned: services before combat, gallery last.
2. "The Round" as written; the player is Rosace.
3. Art in the world: option B, a DOM overlay of the real thumbnail pinned inside each frame
   (never pixelated, tinted, lit or used as a texture), with the full work on E.
4. Breakage policy and nave rule as in section 4; craters and broken props heal in the room.
5. Arena music: `arena-chamber-v1` for now.
6. Length 12–15 minutes; 4 screens of causeway.
7. The new props in section 7 are approved.
8. The storm has weather only, no music.

The original questions:

1. **The order.** Services (account, docs) come before combat (the arena), and the gallery comes
   last. Is that right?
2. **The story.** Does "The Round" fit: lamps relit after a storm, the keeper's two lines, the
   two cups? Should the player be Rosace in the story, or stay an unnamed traveller? Nothing
   depends on who the player is.
3. **Art in the world.** Two options:
   - **A:** the frames in the nave hold a soft light panel, and the work itself appears only in the
     full-quality panel on E.
   - **B:** a small DOM overlay of the real thumbnail pinned inside each frame, never pixelated or
     used as a texture.

   Either way the art stays display only.
4. **Breakage.** Are the breakage policy (section 4) and the nave rule right? Should craters and
   broken props heal in the room?
5. **Arena music.** Is an orchestral arrangement of B worth making, or does `arena-chamber-v1`
   serve for now?
6. **Length.** A first round takes 12 to 15 minutes. Is 4 screens of causeway right?
7. **New props.** Approve the additions in section 7.
8. **The storm without music.** The plan leaves the storm with weather only, so the Blade's
   return lands harder. Or should the alcove get a low string pedal?

---

## 15. Where this came from

**The base: layout 2, "Descent and Ascent".** It gave the W-shaped route, "The Round", cause and
effect instead of text, the storm-break payoff at the Blade, the keeper's two cups, and the sky door
that turns out to be the balcony.

**Changed from layout 2, following the judge's notes:**

- **Spawn.** It moved from a ledge 36 H above the lake to **the dock**. The dock is the w03
  composition, and it is what the arrival scene lane is building.
- **Downloads.** Layout 2 reached them late on a first visit. They now come about 3 minutes earlier
  (about 7 min with stops), after a shorter causeway, and a product board at about 20 s offers the
  website download straight away.
- **Residents.** Five became **three**, with one speaking. The mender and the attendant are gone;
  the attendant's place is taken by props (the broom, the shawl, the dusty cup).
- **The Blade's music.** The theme now enters **under a swell** instead of starting at 54 s.
- **The storm.** It has no music now.
- **Length.** The round is shorter: 12 to 15 minutes instead of 15 to 20.
- **Hub.** The market now works as a hub reachable by the ferry.

**From layout 1, "the Pilgrimage Loop":**

- the colossus walking through the light shaft as the arrival's hero moment
- the suitcase as the first scale anchor
- the product board (with the honest "download on the website" choice) and the interim terminal
  ending that points to the website
- Stonetop (the colossus at eye level)
- the rope bridge cut from the far side
- the visual rhymes
- the theme restarting "from the top" only in the chapel
- the clerk's cold cup, which became the dusty cup on the porch

**From layout 3, "hub and spokes":**

- the lamp board mirroring the save
- the rose-window shutter that floods the nave and lights the works one by one
- the shawl and second cup in the chapel porch
- the dusk light that falls into the lodge for good after the round, with the keeper's chair
  moved into it
- the breakage policy
- the "rooms under 9 H show their ceiling" rule for cozy rooms
- per-product docs bays in the archive

The drafts stay in `plan-drafts/` for reference.
