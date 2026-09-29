# World plan, layout 2: "Descent and Ascent" (draft for Dex)

One of several competing layout drafts. This one follows a single shape: you arrive **high on a
ledge above the lake**, **descend** past the lake and across the plain into the **hollow**
underground, **climb** the spire up **into the storm**, and walk **down the pilgrim path to the
chapel at dusk**. Then a door you saw in the first minute brings you home.

Drawn as a side view, the route is a big W: high, low, lowest, highest, middle. The map and the
pacing chart are in [`layout-2.svg`](layout-2.svg).

Content is unchanged from `CANON.md`: the arrival (scenery first), the dex account counter near the
start, donation boxes with donor plaques at rest places, the slashable map banner, the archive
(docs) behind an ordinary door, the arena with the boss terminal (no boss built yet), the chapel of
light with Dex's 9 artworks, and the website one scroll away. Mobs and bosses are out of scope.
This draft places all of that. It doesn't build any of it.

Every size is in **H** (the player's exploration height, 80 world px) and in **screens** (one
screen is 1280 x 720 world px, which is **16 H wide and 9 H tall**).

---

## 1. Scale grammar (all of it follows from the locked scale)

The coordinator locked the scale. This draft only sizes the world against it:

- World view **1280 x 720** world px, double the old 640 x 360. Shown at the largest integer
  nearest-neighbour upscale that fits, otherwise sharp-bilinear. Never plain bilinear.
- **H = 80 px** in exploration, about 11% of the view height (the old site's hero was about 6%).
  A **144 px** close-up render is kept for cut-ins, combat zoom and portraits.
- One config holds these numbers. Everything below is written in H, so nudging H later rescales
  the whole world instead of breaking it.

### Sizes everything is built from

These are the standard sizes for the pieces the player touches most. They are chosen so the player
reads as a person among ordinary objects:

| Thing | Size in H | px at H = 80 |
|---|---|---|
| Stair step (rise x tread) | 0.2 x 0.3 | 16 x 24 |
| Walkable ramp | at most 30° | |
| One-way platform thickness | 0.15 | 12 |
| Ordinary door (h x w) | 1.5 x 0.75 | 120 x 60 |
| Big door (chapel, lift gate) | 4 x 2.5 | 320 x 200 |
| Counter / lectern top | 0.55 | 44 |
| Bench seat | 0.28 | 22 |
| Donation box (with its plaque beside it) | 0.5 tall, plaque 0.6 x 0.4 | 40, 48 x 32 |
| Shrine lantern on its post | 1.5 | 120 |
| Lamp post | 3 | 240 |
| Map banner: rod / unrolled cloth | rod 1.8 wide, cloth 2.4 tall | 144, 192 |
| Boss terminal | 1.4 tall, 1.0 wide | 112 x 80 |
| Artwork frame, landscape / portrait | 2.4 x 1.35 / 1.35 x 2.4 | 192 x 108 / 108 x 192 |
| Cozy-room ceiling (lowest) | 2.2 | 176 |

### Movement envelope, and the rules the map follows

The lab's movement numbers (`src/lab/data/tuning.json`, tuned at H = 96) translate into H like
this, assuming the world keeps them proportional to H:

| Move | Reach |
|---|---|
| Run | 2.0 H/s, so one screen takes 8 s |
| Full single jump | 1.08 H up; 1.4 H across at a run |
| Jump + double jump | 1.8 H up; 2.2 H across |
| Dash (ground or air) | 1.83 H |
| Jump + double + air dash | about 4 H across on the level |

The map sticks to these rules so the world is friendly to people who never play games:

- **Required route:** ledges no higher than **1.0 H**, gaps no wider than **1.2 H**. Anything
  bigger uses stairs, a ramp, a lift, or water shallow enough to wade.
- **Effort (optional side bits):** up to 1.6 H up and 2.0 H across (the double jump).
- **Secrets only:** gaps up to 3.5 H (double jump plus air dash). Never on the route to content.
- **No fall damage and no bottomless pits.** Falling into water or off the spire puts you back
  on the last safe ground with a splash or a gust and a short fade.
- **If the route drags**, raise exploration run speed in the config (for example to 2.4 H/s). The
  geometry stays as it is.

### Camera modes per room

- **Locked:** the room fits one screen and the camera doesn't move. Used for cozy rooms, so
  stillness itself says "indoors".
- **Rail:** the camera follows x only. Used for corridors and the causeway.
- **Free:** follows both axes. Used for vertical sections.
- **Vista hold:** after you stand still for 2 s, the camera eases (whole pixels, no zoom) to a
  composed framing. Used at the arrival, the dock, the blade and the balcony.
- **Arena:** clamped to the arena floor while the terminal is summoning.

---

## 2. The story, told through the route

**Working title: "The Round."** It builds on the Procession (draft 1). It also keeps the Registry's
accepted first arc (a door that opens onto empty sky gets reconnected, and the counter keeper
takes a small break) and folds it into the same walk.

**The world.** Colossi walk west along the lake's edge, toward a broken ring that hangs over the
water. They never notice anyone. People keep lamps burning at shrines along the colossi's route
so travellers can find their way. Nothing explains the ring, the colossi or the spire.

**The small human story.** Last night's storm is still sitting on the spire, and it blew the
shrine lamps out. This morning only one lamp is burning: the keeper's own, at the overlook beside
her lodge. You're a traveller with a sword (currently Rosace, a priestess, which suits a
lamp-lighting round). You rest at each shrine, and resting lights its lamp. That's the whole
mechanic. Nobody asks you to do it and no quest text tracks it.

How it's told, beat by beat (with at most one short line per person):

1. **Morning at the ledge.** The first view is only scenery: the ring, the lake, a colossus wading
   far out, its reflection. The one lit lamp is off-screen to the left, at the overlook. A muted
   red line on the stone points right.
2. **The lodge.** The keeper is behind the counter with her ledger (the dex account). If you
   press E she says: *"Storm took the lamps again."* Upstairs, a door with a red mark opens onto
   empty sky: a small safe landing, and beyond it a **dusk** sky although it's morning outside.
   Nobody comments on it.
3. **The stair shrine.** The first dark lamp. Resting lights it, and the lamp posts down the stair
   come on one after another, as if they share one wick. From here you can see the whole plain.
   The map banner hangs here, rolled up on its cord.
4. **The dock.** A ferryman sleeps in his moored boat. A colossus puts a foot down in the
   shallows at middle distance. Rings spread across the whole lake and his boat rocks. He keeps
   sleeping.
5. **The plain.** A long causeway into weather. The spire is on the horizon ahead with a storm
   stuck to it; the ring sits behind you. A colossus plants a foot close enough that the ground
   shakes. There's a small shelter, displaced from somewhere ordinary: it's a bus stop.
6. **The hollow.** A warm city inside a fallen structure. The colossi are felt here, not seen:
   dust sifts from the ceiling in time with footfalls far above. A mender sits by the hearth
   shrine fixing a lantern. The archivist in the archive reads and doesn't look up (*"Mm."*). You
   open the culvert gate, a horn sounds, and far off the ferryman wakes.
7. **The lift and the storm.** The lift climbs out of the amber and into cold blue. The pale planet
   comes up behind the spire. The lift stops where lightning broke its rail long ago, so you
   climb the outside in rain and gusts. Halfway up there's a window alcove with a lamp, candles
   and a bench, rain beating on the glass: the coziest moment inside the worst weather.
8. **The Crown.** The arena at the top. The boss terminal is dormant, with rain running down its
   screen. Using it is optional. Past it you step onto the blade, **the storm tears open** and the
   theme reaches its grand passage. From above the weather you can see everything: the colossi
   now below you, the lake, the ring, and the lamps you've lit so far as small points of light
   back along the way you came.
9. **The pilgrim path at dusk.** A fallen ring segment leans from the spire down toward the far
   cliffs. You walk down its curved back through puddles holding the sunset. A bell hangs from a
   rib. The colossi walk in a line on the horizon, the way you came, toward the ring.
10. **The chapel.** An attendant sweeps the porch and nods. Inside, the chapel of light is where
    Dex's 9 pieces hang, one to a place. Sunset comes through the rose window across the floor.
    A bench lets you sit and look.
11. **The latch.** On the bell balcony there's a small door with the same red mark, held by a
    maintenance latch. Release it, the bell rings once, and the door opens into the keeper's loft.
    The "empty sky" was this balcony at dusk all along.
12. **Home.** The lodge downstairs is empty and its front door is open. The keeper sits on the
    overlook bench with **two cups**, one set down beside her. Sit, and she says: *"There they
    go."* The colossi pass. All the lamps you lit stand in a line across the valley. No banner or
    "complete" message appears. The round ends with something visibly different.

**What the save keeps after that.** On a new visit the arrival goes back to morning (the first
impression is canon). The lamps you lit stay lit and are visible as tiny flames in the distance,
the red-marked door always opens straight into the chapel, and the cup stays on the overlook
bench.

**Wardens** (not built yet) follow the Registry's accepted logic: they are constructs formed by
dispatch seals at the Crown, so you're never killing a resident.

---

## 3. The route at a glance

Coordinates are in H. x runs west to east. y is elevation, with the lake surface at 0.

| # | Room | x | Floor y | Region / ref |
|---|---|---|---|---|
| A0 | Overlook (optional, left of spawn) | -20..0 | 36 | Ledge / w03 |
| A1 | Arrival Ledge (spawn x 24) | 0..48 | 36 | Ledge / w03 + w01 |
| A2 | Keeper's Lodge (ground floor and loft) | 48..64 | 36 / 40.5 | Ledge / (Eastward-warm) |
| A3 | Yard and Switchback Stair (shrine 1) | 64..84 | 36 to 0.5 | Ledge / w03 |
| B1 | The Dock | 84..116 | 0.5 | Shore / w03 + w01 |
| B2 | The Causeway across the flats (shrine 2) | 116..196 | 0 to 2 | Plain / w01 |
| B3 | Hollow Mouth (crane-hook lift, culvert) | 196..212 | 2 to -32 | Plain to Hollow / w04 |
| C1 | Foundry Market (shrine 3) | 212..284 | -32 (walkway -26) | Hollow / w04 |
| C2 | The Archive | 262..286 | -40 | Hollow / (Eastward-warm) |
| C3 | Lift Foot (waiting room) | 284..304 | -32 | Hollow to Spire / w04 + w02 |
| D1 | Lift Ride | 290..302 | -32 to 40 | Spire / w02 |
| D2 | Outer Climb (shrine 4, storm alcove) | 280..320 | 40 to 76 | Spire / w02 |
| D3 | The Crown (arena, boss terminal) | 286..318 | 76 | Spire / w02 |
| D4 | The Blade (storm breaks) | 318..350 | 76 to 84 | Spire / w02 + w03 |
| E1 | Pilgrim Path on the ring segment (shrine 5) | 350..430 | 84 to 32 | Dusk / w03 |
| E2 | Chapel Porch (shrine 6, font) | 430..446 | 32 | Chapel |
| E3 | Chapel of Light (gallery nave) | 446..494 | 32 | Chapel |
| E4 | Bell Stair and Balcony (latch, sky door) | 494..510 | 32 to 44 | Chapel |
| (A2) | back through the sky door into the Lodge loft, then out to the Overlook | | | |

The whole world spans **530 H x 124 H, about 33 x 14 screens**.

The first full round is about 670 H of walking: roughly 6 minutes at 2 H/s, plus 26 s of lift
rides. With stops to look, read and view art it runs **15 to 20 minutes**. The shortcuts in section 7
bring every destination within 2 minutes for someone who has been before, and the website
reaches all of them instantly.

---

## 4. Regions and rooms

Each room lists its size, purpose, mood, light and weather, sound, reference, props (with states
and interactions) and traversal. **Sound** uses the states in section 9. Footstep surfaces are
named because CANON asks footsteps to match the surface.

### Region A: The Ledge (morning, serene)

The hybrid Dex asked for lives here: ring over lake plus colossus, with the water's reflections
kept. The full composition spec is in section 10.

#### A1 Arrival Ledge (spawn)
- **Size:** 48 x 10 H (3 x 1.1 screens). Spawn at x 24. Vista hold at spawn.
- **Purpose:** first impression, scenery first. Nothing to use.
- **Mood:** the vastest open space in the world, and serene.
- **Light/weather:** early morning. A pale gold sun sits in the ring's hole with a shaft down to
  the water. High thin haze, cool teal shadows, still air, a slow cloud veil.
- **Sound:** *Ambience first* (water lapping far below, soft wind, a gull), then *Theme swell*
  after about 12 s or on first movement, whichever comes later. Footsteps on stone.
- **Ref:** w03 composition (small figure, cropped ring, shaft, still water) plus w01's colossus
  (a pale form the size of weather, dissolving into haze).
- **Props:**
  - Muted red floor line (decal). Always there. It's the only hint to go right.
  - Grass and small flowers at the lip. They bend when walked through or swung near; a cut
    scatters them and they regrow.
  - Destructible floor (stone). Q and R leave craters that heal.
  - Drifting dust.
  - Nothing else. No NPC, no sign, no donation box in the first view.
- **Traversal:** flat, with one 0.4 H step down toward the lodge. Going left leads to A0.

#### A0 Overlook (optional rest)
- **Size:** 20 x 9 H (1.25 x 1 screen). Locked camera.
- **Purpose:** CANON's short resting overlook to the left. It's also where the story ends.
- **Mood:** cozy-outdoor and serene.
- **Light:** the same morning, plus the keeper's lamp, the one warm point.
- **Sound:** ambience, with the theme at 70%. Footsteps on stone.
- **Props:**
  - Lamp post (the keeper's lamp). States: on (lit at start), flicker, swing when hit and settle.
    Moths circle it.
  - Bench. E sits: the camera holds and the UI hides. It splinters when slashed and restores.
  - A mooring post, oddly far above the water, that serves as a seat. It's one of the "wrong
    place" familiar objects.
  - Flowers.
  - After the round: the keeper, two cups, one of them on the bench.
- **Traversal:** flat. It's a dead end.

#### A2 The Keeper's Lodge (dex account)
- **Size:** 16 x 9 H (1 x 1 screen), two floors: ground floor 4.5 H tall, loft 4 H. Locked camera.
- **Purpose:** the **dex account counter** (near the start, as CANON wants), the first
  **donation box and donor plaque**, and the start of the red-marked sky door story.
- **Mood:** cozy indoors and serene. It's the first "vast, then indoors" cut.
- **Light:** warm stove glow, candles on the counter, morning light through one window.
- **Sound:** *Muffled* (the theme through walls, low-passed, about -10 dB), stove crackle, a kettle.
  Footsteps on wood.
- **Props:**
  - **Registry counter, with its bell and ledger.** E on the counter or ledger opens the dex
    account panel (register, sign in, recover, sign out; real sessions only). The bell rings
    when used or slashed, then settles. The keeper is behind it.
  - **Donation box** beside the stove. States: idle, then E opens the donate panel (Ko-fi and the
    MB Bank QR), then a small light and chime. The **donor plaque** is next to it; with no data
    it shows empty engraved rows.
  - **Doors.**
    - Front door: closed, opening, open.
    - Yard door (east).
    - **Sky door** in the loft, with a red mark: closed, then opening onto the dusk-sky landing
      (1 H deep, fenced, safe). After the latch is released it opens onto the E4 balcony.
  - Candles (flicker, gutter out when hit, relight).
  - A hanging lantern that swings.
  - Shelves: a lost-property shelf holding **luggage** (a trunk and a case) that tips when hit
    and restores.
  - Bench.
  - Loose paper that flutters in dash wind.
  - Dust motes in the window light.
  - Proposed new props: a stove and kettle, and cups.
- **Traversal:** a readable stair up to the loft (steps 0.2 H, with a handrail).

#### A3 Keeper's Yard and the Switchback Stair (shrine 1, map banner)
- **Size:** 20 x 38 H (1.25 x 4.2 screens). A small yard (8 H) at the top, then four stair
  flights down the cliff face. Free camera.
- **Purpose:** the descent begins. It also holds the first sword toy, **shrine 1**, the **map
  banner**, and a cut-rope shortcut.
- **Mood:** it opens to vast again, and it's serene. The lake and plain fill the view as you go
  down.
- **Light:** morning. The shaft moves across the water below as the camera descends.
- **Sound:** the theme continues. Footsteps on stone, and on wood over the deck.
- **Props:**
  - **Training dummy** in the yard (the keeper beats rugs on it). It reacts to every hit type and
    never dies.
  - A laundry line (cloth on lines, like prayer flags): sways, tears when cut, restores.
  - Vines on the cliff. They bend, and cutting them scatters leaves.
  - Grass.
  - Rubble.
  - **Shrine 1 (Stair shrine)** on the landing at y 22:
    - Shrine lantern: out, then lit on rest, then flicker.
    - Offering bowl, which rings softly when touched.
    - **Donation box** and **donor plaque**.
  - **Map banner** on the shrine's arch: rolled on a rod, held by a cord.
    - Slash the cord and the cloth unrolls with cloth physics. E then reads the full map. The cut
      stays cut in that save.
    - The map shows the whole side view, the four destinations, and which shrine lamps are lit.
  - **Lamp posts down the stair** (6). They are dark until shrine 1 is lit, then light in
    sequence.
  - **Rope-held deck** (from CANON's rope bridge), at the y 12 landing:
    - A plank deck is hauled up against the cliff by a rope over a post.
    - Slash the rope: the rope separates, the post stays, and the deck swings down to become a
      ramp straight to the pier head.
    - States: raised, cut, swinging, lowered and walkable.
- **Traversal:**
  - Stairs only, with no jumps required.
  - Cutting the deck skips two flights, and the ramp works both ways afterwards.
  - Optional: a 1.5 H ledge under the yard holds a bench with a better view (double jump).

### Region B: The Shore and the Plain (late morning to overcast, wind rising)

#### B1 The Dock
- **Size:** 32 x 10 H (2 x 1.1 screens). Rail camera, with a vista hold at the pier end.
- **Purpose:** the first near encounter with scale. It's also the ferry landing (a shortcut,
  section 7).
- **Mood:** vast and still, with a jolt of awe.
- **Light:** late morning. The shaft pool is warm on the water, and the reflections are strongest
  here.
- **Sound:**
  - The theme continues.
  - Water lapping and rope creak.
  - The colossus footfall is a sub-bass thud, followed by ripple hiss about 1 s later.
  - Footsteps on wood.
- **Ref:** w03 (dock, water, figure) and w01 (colossus).
- **Props:**
  - **Pier**. It's destructible floor made of wood: it splinters and heals.
  - **Mooring posts**, with rope, and **buoys** that bob on the water.
  - **Small moored boat** with the ferryman asleep inside. It bobs, and rocks harder when the
    colossus footfall rings pass under it.
    - States: moored (asleep), and after the culvert opens: awake, boarding, sailing, docked.
    - E on the boat gets a sleepy wave (before) or a ride (after).
  - **Pier lantern**: on, flicker, swings when hit.
  - **Reeds**, which bend and part as you pass.
  - **Luggage** (a traveller's trunk on the pier; tips over when hit and restores).
  - **Sign**: a ferry board. Its text is worn away to nothing.
  - **Hanging bell on a yoke** at the pier end, the ferry bell. Hitting it swings and rings it,
    and it settles. After the culvert opens, ringing it calls the ferry.
  - **Water**: ripples, splashes and reflections, plus the colossus's footfall ring ripples.
  - **Puddles** on the planks.
- **Traversal:** flat. Wading off the pier into the shallows is allowed (knee deep, run at 50%).

#### B2 The Causeway across the flats (shrine 2)
- **Size:** 80 x 12 H (5 x 1.3 screens). Rail camera. It's the longest horizontal room, about
  40 s of walking, with something to see every screen.
- **Purpose:** journey, weather building up, a passing colossus close enough to shake the ground,
  **shrine 2**.
- **Mood:** vast. Calm turns uneasy.
- **Light/weather:** overcast, grey-violet haze (w01), slow cloud shadows. The wind rises across
  the room. Thunder rolls from the spire, which stands on the horizon ahead with its storm.
- **Sound:**
  - The theme continues at 80%.
  - Wind layers get stronger toward the east, with grass hiss and distant thunder.
  - Footsteps on stone, splashing in shallow water.
- **Ref:** w01 (dark plain, pale colossus, haze). The flats are **flooded sheet water**, so the
  lake's reflections carry through the plain (the hybrid again).
- **Props:**
  - **Standing stones.** Chip and crack when hit, restore. They never fall.
  - **Prayer flags** on lines between the stones: cloth in the wind; they tear when cut and restore.
  - **Marker posts with red cloth** (from the colossus-plain scene), which whip in the wind.
    They're the route marks.
  - **Breakable pillars.** A short broken colonnade along the causeway, at x 124 to 132. They
    chip, crack and crumble to rubble, then restore.
  - **Colossus footprint crater** (x 136 to 146):
    - You walk down into it and back out: a 3 H dip with ramps.
    - Rain water pools in the bottom, reflecting the sky.
    - Rubble lines the rim.
  - **Bones of something huge, half-buried.** A rib arch (x 158 to 168) that you walk under. The
    ribs are one-way platforms (optional climb to a view).
  - Grass and flowers, dense, bent by the wind.
  - **Lamp posts** along the causeway. They're dark until shrine 2 is lit.
  - **Loose paper**: one page blows along the ground ahead of you.
  - Dust and ash.
  - Destructible floor.
- **Shrine 2 (the Footprint Shelter)**, at x 176 to 184:
  - A **bus shelter** displaced from somewhere ordinary: roofed, 8 x 3 H, a pocket of cozy
    inside the vast.
  - Inside: a bench, the shrine lantern, the offering bowl, the **donation box** and **donor
    plaque**, a route **sign** whose numbers have worn off, and moths.
  - **Puddles** under the dripping roof edge.
- **Colossus:** it walks the flats at depth 6 to 12, much closer than at the arrival. It crosses
  about every 95 s on a loop, and plants one foot behind the causeway once per pass: a 2 px
  camera shake, ring ripples racing across the sheet water, grass flattened.
- **Traversal:**
  - Two breaks in the causeway: at x 128 (1.1 H, a single jump) and x 150 (2.5 H). You can walk
    around the second one through knee-deep water, or cross it with jump, double jump and dash
    for a quicker line.
  - The rib-arch top is optional, reached by double jump.

#### B3 Hollow Mouth (crane-hook lift, culvert gate)
- **Size:** 16 x 38 H (1 x 4.2 screens). A sinkhole where the plain collapsed into the fallen
  structure below. Free camera.
- **Purpose:** the door to the underworld. The ride down is a reveal.
- **Mood:** vast (vertical). Tense for a moment: the first time the ground falls away.
- **Light:** overcast daylight falling in two stepped shafts. The amber glow rises from below as
  you go down.
- **Sound:**
  - The theme dips to 60%.
  - Wind above gives way to machine hum below.
  - Crane chain clatter (the legacy `lift-start` and `lift-dock` sounds are candidates).
- **Ref:** w04's opening, seen from above.
- **Props:**
  - **Crane with a swinging hook.** Its hook platform is the lift.
    - States: idle at top, called, descending, at bottom.
    - A lever at each end (E calls it). The ride takes 10 s for 34 H.
    - The hook swings when hit and settles.
  - **Hanging cables and chains** down the shaft. Verlet physics: they sway and swing when hit.
  - **Culvert gate** on the top platform (a barred door): closed, lifting, open. It's opened from
    **inside**, by the lever beside it, **after** you've crossed the plain. Opening it shows the
    lake through the tunnel, a horn sounds, and the ferryman wakes (a shortcut, section 7).
  - Vines hanging into the hole.
  - Falling dust.
- **Traversal:** the lift. There's also an optional climb down by ledges (1 H drops) for players
  who want to jump.

### Region C: The Hollow (underground, amber, lived-in; no weather, the storm heard above)

#### C1 Foundry Market (shrine 3; hub)
- **Size:** 72 x 14 H (4.5 x 1.55 screens). A street level at -32 and an upper walkway at -26,
  joined by stairs at both ends. Rail camera with some vertical freedom.
- **Purpose:** inhabited warmth after the vast plain. It holds **shrine 3**, the **archive
  door**, and the way to the lift.
- **Mood:** medium scale, dense and lived-in. Calm but busy. It's the one "denser" place CANON
  allows.
- **Light:** amber haze and furnace pockets in the background (w04). A white searchlight beam, and
  lamps at every stall.
- **Sound:**
  - *Muffled*: the theme plays low-passed from a radio at a stall (a diegetic source at -8 dB).
  - Ambience: market murmur (no words), hammering, steam hiss, furnace roar, and a distant
    freighter horn.
  - When a colossus crosses far above, a deep thud comes every 2.5 s and dust sifts down.
  - Footsteps on metal grating and on stone.
- **Ref:** w04 (the amber-hollow scene), directly.
- **Props:**
  - **Market stalls with cloth awnings** (4). The awnings sway, tear along a cut and restore.
    Stall keepers are sparse, and one stall is empty.
  - **Crates and barrels.** Crates splinter; barrels dent and roll a little. All restore.
  - **Flickering neon and holy-light signs.** States: lit, flicker, sparking when hit, dark for a
    beat. The glyphs mean nothing.
  - **Steam vents.** They hiss on a cycle, and each burst pushes cloth, flames and grass (a wind
    source). No damage.
  - **Sparking junction boxes.** A hit makes them spark (sparks are a light source), and they
    settle.
  - **Hanging cables and chains** across the street.
  - **Street lamp posts.**
  - **Cranes with swinging hooks** in the background.
  - Destructible floor (grating dents, stone chips).
  - Loose paper, and dust motes in lamp light.
- **Shrine 3 (the Hearth Shrine)** in a furnace-warm alcove at x 242 to 250:
  - Shrine lantern, offering bowl, **donation box** and **donor plaque**.
  - A bench where the **mender** sits fixing a lantern (NPC; one idle loop plus a nod).
- **Archive door** in the back alley at x 268: an ordinary door (see C2).
- **Traversal:**
  - Flat street, stairs to the walkway.
  - Optional: rooftops over the stalls, 1 to 1.6 H ledges.
  - A gap in the walkway (2 H) is a double-jump line to a rooftop bench.

#### C2 The Archive (documentation)
- **Size:** 24 x 7 H (1.5 x 0.8 screens), below the alley down a short stair. The ceiling is
  5 H. Locked camera (it fits one screen width with a small rail).
- **Purpose:** **documentation**, real docs panels. No puzzle and no prerequisite, as CANON
  requires. Clearly separate from any lore.
- **Mood:** the coziest room in the world, and silent.
- **Light:** candles and one green-shaded reading lamp. Dust hangs in it.
- **Sound:** *Silence*. The music fades out over 4 s at the door. What's left: a clock tick,
  paper, and the furnace very far away. Footsteps on a rug and on wood.
- **Props:**
  - **Archive door**: closed, opening, open. E opens it. It's plain and looks exactly like any
    other door.
  - **Shelves and scroll racks.** In a reading room they only sway and rattle when hit. Nothing
    breaks here.
  - **Lectern with an open book.** Its pages flutter when you pass or dash. **E opens the
    documentation panel** (real DOM, focus, back and close).
  - **Candles and a candelabra.** They flicker, gutter out when hit, and relight.
  - Bench (a reading chair).
  - Loose paper.
  - Dust motes in lamp light.
  - The **archivist** reads (idle). E gets *"Mm."*
- **Traversal:** none. It's a room to stop in.

#### C3 Lift Foot (waiting room)
- **Size:** 20 x 10 H (1.25 x 1.1 screens). Locked camera. It's where the spire's stem pierces
  the hollow floor.
- **Purpose:** a threshold, and the start of the ascent.
- **Mood:** cozy and a little uncanny: a **waiting room** arranged wrong, at the foot of a
  megastructure. Calm.
- **Light:** cold fluorescent strips against the amber outside. A warning light turns while the
  lift moves.
- **Sound:** a radio on the empty operator's chair plays the theme, muffled. Hum. Footsteps on
  tile.
- **Props:**
  - **Lift platform, with its cables and counterweight.**
    - States: parked, called, rising, arriving, stopped at the break (y 40). After the express
      lever is thrown, it runs straight to the Crown.
    - The lift gate is a big door: closed, opening, open.
  - **Warning lights**: off; amber and turning while moving; red during an arena summon.
  - **Signs**: an up arrow, and a ticket-number display frozen on one number.
  - **Benches** (a row of waiting-room chairs).
  - **Luggage and crates** waiting.
  - A second **training dummy** (the lift guards' practice).
  - Proposed new prop: the radio.
- **Traversal:** flat. You step onto the lift and E rides it.

### Region D: The Spire (storm)

#### D1 Lift Ride
- **Size:** a 12 x 72 H shaft, about 8 screens of vertical ride, which takes 16 s at 4.5 H/s. The
  camera is locked to the platform.
- **Purpose:** the big transition, from amber interior to cold storm exterior.
- **Mood:** vast (vertical reveal). Tension rising.
- **Light:**
  - Amber in the hollow.
  - Then darkness through the hollow's ceiling, about 3 s.
  - Then the spire's cold blue side-light and the **pale planet** rising behind (w02).
  - Rain starts on the platform.
- **Sound:**
  - The *Theme swell* returns, strings up, under a rising storm ambience.
  - Cable hum; the lift clatter stops at the break.
- **Props:**
  - Cables and counterweight passing.
  - Warning lights.
  - Window slits that flash past.
- **Traversal:** none. At the break the gate opens onto the outer climb.

#### D2 Outer Climb (shrine 4, the storm alcove)
- **Size:** 40 x 36 H (2.5 x 4 screens). Five ledge rows, about 7 H apart, zigzagging up the
  spire's leaning face. Free camera.
- **Purpose:** the physical challenge of the world (still friendly), with **shrine 4** halfway.
- **Mood:** vast and exposed, in a storm.
- **Weather:**
  - Rain at an angle.
  - Gusts on a readable cycle (6 s calm, 3 s gust). A gust pushes you 0.5 H/s outward, and the
    pennants and rain angle warn about 1 s ahead.
  - Lightning in the clouds: cloud glow, never a white flash on the player. It stays inside the
    engine's flash gate.
- **Sound:**
  - *Storm*: rain, wind and thunder lead. The theme drops to about 40% (strings only, if stems
    ever exist).
  - Footsteps on wet metal.
- **Ref:** w02 (black angular structure, pale disc, small lit windows, diagonal thrust).
- **Props:**
  - **Wind-whipped pennants** in muted red. They're the route marks up here, and they show the
    gust direction.
  - **Warning lights** that blink, more at every ledge edge.
  - **Broken armour pieces** from past wardens. They rattle and slide when hit or dashed through,
    and stay in the world.
  - **Breakable pillars** (stub fins on the ledges): chip, crack, crumble, restore.
  - **Hanging chains.**
  - **Puddles** on the ledges that splash.
  - The lift's **counterweight** hangs in its channel at the right edge.
  - Destructible floor (metal dents).
- **Shrine 4 (the Storm Alcove)** at x 284 to 292, y 58: a window alcove cut into the spire,
  8 x 3.5 H, with the camera locked while you're inside.
  - Shrine lantern, **candles**, bench, **donation box** and **donor plaque**.
  - A small **stained-glass window** with rain on it. Lightning lights it from behind.
  - The *Muffled* state: the storm is heard through glass, and the theme comes back to 70%.
  - Cozy inside the worst weather.
- **Traversal:**
  - Required: ledges 1 H up, gaps at most 1.2 H.
  - Gusts never push you off. Each ledge ends in a lip 0.3 H tall.
  - Falling puts you back one ledge row (a gust fade), never down the whole climb.
  - Optional: a 3 H dash gap to a ledge with a lone pennant and a view, for secret-seekers.

#### D3 The Crown (arena and boss terminal)
- **Size:** 32 x 12 H (2 x 1.3 screens). The fight floor is 24 H (1.5 screens) between two
  pillar lines. The terminal sits at the west end under an overhang. Rail camera, arena-clamped
  while summoning.
- **Purpose:** **downloads**. Each product-menu visit costs a fresh fight. The boss isn't built
  in this scope, so this build is the arena, the terminal and its states.
- **Mood:** medium-vast. Storm at its peak, most tense when summoning.
- **Weather:** heavy rain, close lightning (flash-gated), wind. The arena's floor seals glow
  through the water.
- **Sound:**
  - Storm ambience.
  - When the terminal wakes, the *Arena* state starts: the orchestral variant fades in over 3 s.
  - It fades back to storm over 6 s when cooling.
- **Props:**
  - **Boss terminal.**
    - States: **dormant** (dark screen with rain on it), **woken** (E: the screen lights and
      shows the product list), **summoning** (a beam, and a seal forming in the floor seals),
      **cooling down**, then back to dormant.
    - For now, summoning ends in a **held seal**, because no warden is built yet. Walking away or
      pressing back runs cooling down.
    - The finished flow will be: summon, fight the warden, death beat, cut to black, the
      product's menu, Download. Past wins never unlock the route.
  - **Arena floor seals** (a 5-seal ring): dark, glowing, forming, spent. They sit on
    destructible floor, whose craters and scars heal.
  - **Arena shutters** at both ends (big doors): open, closing, closed while summoning, opening.
  - **Breakable pillars** (the two pillar lines; cover). They chip, crack and crumble, and
    restore after the fight.
  - **Broken armour pieces.**
  - **Wind-whipped pennants.**
  - **Warning lights** (red while summoning).
  - **Express lever** at the east end (x 316). E throws it, it's permanent, and the lift then
    runs Lift Foot to Crown non-stop.
  - Puddles and rubble.
- **Traversal:** flat arena floor. There are 1 H ledges on the pillar tops for aerial play.
  Walking through is always allowed; the terminal is optional.

#### D4 The Blade (the storm breaks)
- **Size:** 32 x 10 H (2 x 1.1 screens), rising 8 H along the monolith's top edge. Vista hold at
  its tip.
- **Purpose:** the emotional turn. You get above the weather.
- **Mood:** the vastest moment after the arrival. Storm to serene, all at once.
- **Light:**
  - When you pass x 326, the cloud tears open over about 4 s, in stepped bands.
  - Low **dusk** sun comes in from the west, behind the ring. The planet sets behind the spire.
  - Wet surfaces turn gold.
- **Sound:** *Silence* for 2 s (the storm cuts off), then the *Theme at 54 s*: the B cue starts
  at its "grand, mystical" section, the part Dex picked it for.
- **Ref:** w02 (the blade against the disc), turning into w03 (the ring and the light).
- **What you see:**
  - The colossi **below you** for the first time: their backs, birds wheeling over them.
  - The lake, the ring, the lodge ledge.
  - The lamps you've lit, as points of light.
- **Props:**
  - Pennants, now hanging still.
  - Rubble.
  - Moss on the edge (grass: bends).
  - One **bench** at the tip, for the view.
  - Nothing else.
- **Traversal:** a gentle slope (under 20°). At the tip, the fallen ring segment leans against the
  blade, and a step down onto it begins E1.

### Region E: The Pilgrim Path and the Chapel (dusk, serene)

#### E1 Pilgrim Path on the ring segment (shrine 5)
- **Size:** 80 H long, dropping 52 H, about 5 screens along a curved diagonal (its surface under
  30°, with steps in the steep parts). Free camera leaning to the downhill side.
- **Purpose:** the long exhale. Getting to the gallery takes a journey, so it means more (CANON).
- **Mood:** vast and serene, getting cozier as the chapel comes near.
- **Light:** dusk. A rose-gold low sun, violet shadows, puddles holding the sunset. Lamps come on
  one by one after shrine 5 is lit.
- **Sound:** *Theme* (gentle strings, soft), wind dying, dripping water, a far bell.
- **Ref:** w03 (the ring's inner face, the light).
- **Props:**
  - **Stained-glass windows** set in the ring's panels:
    - They shatter into glinting shards when hit, throw coloured light onto the path and on
      Rosace (lit props feed the light list), and reassemble slowly.
    - They're the only freely breakable glass in the world, placed where breaking them is a
      pleasure and never a loss.
  - **Prayer candles in rows** on ledges along the rim. Lit at dusk; they gutter out when hit
    and relight.
  - **Lamp posts.**
  - **Hanging bell on a yoke** from a ring rib at x 398. It swings and rings when hit, and the
    sound carries across the valley.
  - **Banners and tapestries**: processional banners on poles. Cloth that sways and tears when
    cut.
  - **Grass, flowers and vines** growing on the fallen ring.
  - **Puddles**, which reflect.
  - Rubble.
  - Moths.
- **Shrine 5 (the Pilgrim Shrine)** at x 410, y about 56, on a flat terrace of the segment:
  shrine lantern, offering bowl, **bench**, **donation box** and **donor plaque**.
- **Traversal:**
  - A gentle downhill with some steps.
  - One gap where a panel is missing (1.2 H, a single jump). A lower path goes around it through
    a ring bay.
  - Optional: climb the rib (1 to 1.6 H ledges) to reach the bell.

#### E2 Chapel Porch (shrine 6)
- **Size:** 16 x 9 H (1 x 1 screen). Locked camera.
- **Purpose:** the threshold. It holds the **sixth and last lamp**.
- **Mood:** cozy-outdoor and serene.
- **Light:** dusk, plus the porch lanterns.
- **Sound:** the theme at 70%. Footsteps on stone, with a little reverb from the doors.
- **Props:**
  - **Font with water.** Touching it (E) or hitting it makes ripples and a small chime. It
    reflects the lanterns.
  - **Hanging lanterns.**
  - **Chapel doors** (big): closed, opening, open. E opens them. They're never locked.
  - Shrine lantern (the last lamp), a **donation box** and a **donor plaque**.
  - A bench.
  - The **attendant**, who sweeps (NPC; idle plus a nod).
  - Loose paper.
- **Traversal:** flat.

#### E3 Chapel of Light (the gallery)
- **Size:** 48 x 14 H (3 x 1.55 screens). The nave is 14 H tall: grand, yet held in. Rail camera,
  with a vista hold at the bench.
- **Purpose:** **Dex's 9 artworks**, each shown on its own, plus the catalogue.
- **Mood:** grand-cozy (the only room that is both). Completely calm.
- **Light:**
  - Sunset through the **rose window** high on the west wall. It throws coloured shafts that
    fall down the nave and pool on the floor.
  - Candles.
  - Each artwork frame is lit by a soft warm spill.
- **Sound:**
  - The *Theme* at about 60% with a large reverb.
  - Opening an artwork panel drops the music by another 6 dB.
  - Footsteps on stone, with reverb.
- **Props:**
  - **Frames for each artwork.**
    - **01 to 05** (landscape, 2.4 x 1.35 H) stand on **easels** down the nave in manifest order.
    - **06 to 09** (portrait, 1.35 x 2.4 H) hang in four tall niches at the east end.
    - E on a frame opens that piece alone in a real DOM panel, from `public/gallery/` via
      `content/gallery/manifest.json`, with alt text and no visible titles.
    - Frames ignore hits. Nothing near the art reacts to the sword.
  - **Lectern with an open book** by the door: **E opens the catalogue** (all 9). Its pages
    flutter.
  - **Rose window** (stained glass). It's a light source and does **not** break.
  - **Stained-glass side windows**: coloured light only. They don't break here.
  - **Pews and benches**: they sway and creak when hit, and don't splinter in the nave.
  - One **bench to sit and look**: E sits, the camera holds, the UI hides, and the music dips.
  - **Prayer candles in rows** and **candelabras**: they flicker, and gutter out and relight if
    hit.
  - **Censer on a chain**: it swings (pendulum) and trails smoke. It swings when hit.
  - **Hanging lanterns.**
  - **Tapestries** between the windows: cloth that sways (no tearing in the nave).
  - Dust motes in the coloured light.
- **Nave rule:** combat input still works in the nave, but hits only disturb things: they sway,
  flicker or ring. Nothing fractures in the room that holds the art.
- **Open for Dex:** how the art shows **in the world** (section 12, question 3).
- **Traversal:** flat. A stair at the east end leads up to E4.

#### E4 Bell Stair and Balcony (latch; the sky door)
- **Size:** 16 x 14 H (1 x 1.55 screens). A stair up 12 H to a balcony outside the chapel's east
  gable. Vista hold at the balcony.
- **Purpose:** the "view from above" that MAP-AND-STORY promised, and the **shortcut home**.
- **Mood:** vast (the whole route is visible to the west) and serene. It's the second-quietest
  place.
- **Light:** the last of the dusk. The lamps you've lit are visible in a line across the valley.
- **Sound:** the theme ends its cue naturally here, and doesn't restart until you move on. Wind
  and the bell.
- **Props:**
  - **Hanging bell on a yoke** (the chapel bell). It rings when hit, and rings once by itself
    when the latch is released.
  - **Maintenance latch** (proposed new prop: shut, released) on a small **door** with the red
    mark (closed, opening, open).
  - A bench for the view.
  - Prayer flags.
- **Traversal:**
  - Stairs.
  - The latch door leads to the A2 loft through the **sky door**. After the release it's a
    permanent two-way link.

---

## 5. Where the content is, and how you find it

This table shows each destination, where it sits in the world, how a visitor finds it, and how
long it takes to reach once the shortcuts are open:

| Destination (CANON priority) | Where | How you find it | Returning visitor, shortcuts open |
|---|---|---|---|
| **Downloads** | D3 Crown: terminal, then (future) warden, then product menu | The spire is on the horizon from the plain onward. The map banner marks it. The lift's up arrow. | Lodge, deck ramp, ferry, crane, market, express lift: about 100 s |
| **Donate** | 7 boxes: lodge, shrines 1 to 5, chapel porch | Every rest place has one, always with its plaque. The first is 12 s from spawn. | About 12 s |
| **Illustrations** | E3 Chapel of Light | First time: the whole round. Afterwards: the red-marked sky door in the lodge loft. | About 25 s |
| **Documentation** | C2 Archive, behind an ordinary door off the market alley | The map banner marks it. It's on the direct way to the lift. | About 70 s |
| **dex account** | A2 counter, keeper and ledger | The first building after the reveal | About 10 s |
| **Map** | A3 shrine 1 banner (slash the cord, then E) | You pass right under it | |
| **Website** | Everywhere: scroll down | The black bars recede into the real site. The world's sound fades and the world waits. | Instant |

**Wayfinding without labels:**

- **Muted red marks** trace the main route: the floor line, the red cloth on posts, a red pipe in
  the hollow, red pennants on the spire, a red ribbon on the chapel door, and the red mark on
  both ends of the sky door.
- **Lamp posts** light up toward the next shrine once you've lit the one you're at.
- **Landmarks stay visible:** the ring stays in the west sky (behind you going out, ahead of you
  coming home), and the spire stays on the eastern horizon until you're inside it.

**Other visitors:**

- Other visitors show up as ghost silhouettes. They collect naturally at shrines, benches, the
  blade tip and the balcony, the places where people stop.
- Those spots are wide enough (at least 6 H of flat ground) for two or three of them to gesture.

---

## 6. Every prop from PIXEL-MATTER.md, and where it goes

This checks that nothing on the approved list is left out. Rooms are the ids from section 3.

| Prop | Placed in | States and interactions used |
|---|---|---|
| **Boss terminal** | D3 | dormant, woken (E), summoning, cooling down (plus a held seal until wardens exist) |
| **Donation box + top-donor plaque** | A2, A3, B2, C1, D2, E1, E2 | idle, E opens the donate panel, light and chime. The plaque shows real data or empty rows |
| **Map banner** | A3 | rolled, cord cut (permanent), unrolling, hanging; E reads |
| Stained-glass windows | E1 (breakable), D2 alcove, E3 (light only) | shatter, shards, coloured light, reassemble |
| Candelabras and candles | A2, C2, D2, E3 | flicker, light source, gutter when hit, relight |
| Hanging bell on a yoke | B1 (ferry bell), E1, E4 | rest, swing, ring, settle; the latch ring |
| Banners and tapestries | E1 (tear), E3 (sway only) | cloth sway, tear along a cut, restore |
| Pews and benches | A0, A2, A3, B2, C1, C2, C3, D2, D4, E1, E2, E3, E4 | splinter outdoors, sway only in E3; E sits |
| Lectern with an open book | C2 (docs), E3 (catalogue) | pages flutter; E opens the panel |
| Censer on a chain | E3 | swings, trails smoke, swings when hit |
| Lamp posts | A0, A3, B2, C1, E1 | on, off, flicker, swing; lit in sequence after a shrine |
| Doors | A2 (front, yard, sky), B3 (culvert), C2 (archive), C3 (lift gate), D3 (shutters), E2 (chapel), E4 (latch) | closed, opening, open |
| Signs | B1, B2, C1, C3 | lit or worn, flicker; no copy that sells |
| Luggage | A2, B1, C3 | tip over, restore |
| Training dummy | A3, C3 | reacts to every hit type, never dies |
| Breakable pillars | B2, D2, D3 | chip, crack, crumble, rubble, restore |
| Grass, flowers, vines | A0, A1, A3, B2, B3, D4, E1 | bend when walked through or swung near, scatter when cut, regrow |
| Destructible floor, rubble | A1, B1, B2, C1, D2, D3, E1 | craters and scars that heal; rubble at rims |
| Water | A1 (lake), B1, B2 (sheet flats), E2 (font) | ripples, splashes, reflections, footfall rings |
| Mooring posts, rope and buoys | A0 (one displaced), B1 | bob, creak |
| Small moored boat | B1 | moored, awake, boarding, sailing, docked |
| Reeds | B1 | bend and part |
| Pier lantern | B1 | on, flicker, swing |
| Shrine (lantern, offering bowl, box, banner) | A3, B2, C1, D2, E1, E2 | lantern out, lit on rest, flicker |
| Prayer flags on lines | A3 (laundry), B2, E4 | wind, tear, restore |
| Standing stones | B2 | chip, crack, restore |
| Colossus footprint crater | B2 | walkable dip with pooled water |
| Bones half-buried | B2 | rib arch; ribs are one-way platforms |
| Hanging cables and chains | B3, C1, D2 | verlet sway, swing when hit |
| Cranes with swinging hooks | B3 (the lift), C1 (background) | idle, called, moving; swing when hit |
| Sparking junction boxes | C1 | spark (a light source), settle |
| Steam vents | C1 | cycle, burst (a wind source) |
| Market stalls with awnings | C1 | sway, tear, restore |
| Crates and barrels | C1, C3 | splinter, dent, roll, restore |
| Neon / holy-light signs | C1 | lit, flicker, spark, dark |
| Registry counter, bell and ledger | **A2** (moved here from the hollow so the counter is near the start, per CANON) | E opens dex account; the bell rings |
| Archive door | C2 | an ordinary door |
| Shelves and scroll racks | A2, C2 | sway and rattle only |
| Dust motes in lamp light | A2, C1, C2, E3 | drift, part in dash wind |
| Lift platform, cables, counterweight | C3, D1, D2 | parked, called, rising, arriving, stopped at the break, express |
| Warning lights | C3, D1, D2, D3 | off, amber turning, red, blink |
| Arena floor seals | D3 | dark, glowing, forming, spent |
| Broken armour pieces | D2, D3 | rattle, slide, stay |
| Wind-whipped pennants | D2, D3, D4 | whip in gusts (gust tell), hang still after the storm |
| Artwork frames / easels | E3 | E inspects; ignore hits |
| Rose window | E3 | a light source; unbreakable |
| Prayer candles in rows | E1, E3 | lit, gutter, relight |
| Font with water | E2 | ripples; E touches it |
| Hanging lanterns | A2, E2, E3 | swing, flicker |
| Bench to sit and look | E3 (and A0, D4, E4) | E sits, camera holds, UI hides |
| Dust and ash, moths, puddles, loose paper | everywhere (listed per room) | drift; moths around lights; puddles splash and reflect; paper flutters |

**Proposed new props** (not on the list yet, so they need Dex's OK):

- Stove and kettle (A2)
- Cups (A2, A0)
- A radio (C3, C1)
- The rope-held deck from CANON's rope-bridge rule (A3)
- Marker posts with red cloth, already in the colossus-plain scene (B2)
- Levers (B3, D3)
- The maintenance latch (E4)
- A route sign in the bus shelter (B2)

---

## 7. Traversal: jumps, dash gaps, doors, lifts and shortcuts

**Jumps on the required route.** Every gap on the route to content is at most 1.2 H and every
ledge is at most 1.0 H, so single jumps are enough. The places they occur:

- the causeway break at x 128
- the ring panel gap on E1
- the D2 ledges

**Double-jump lines (optional):**

- A3 view bench
- B2 rib arch
- C1 rooftops and the walkway gap
- E1 bell rib

**Dash gaps (secrets only):**

- B2 second causeway break: optional quick line, 2.5 H, with the wade-around below.
- D2 lone-pennant ledge: 3 H.

**Doors** (all use E; none is locked except where noted):

- A2 front, yard and sky door
- B3 culvert gate: opened only from inside
- C2 archive
- C3 lift gate
- D3 arena shutters: they close only while summoning
- E2 chapel doors
- E4 latch door: opened only from the balcony side

**Lifts:**

| Lift | From, to | Ride |
|---|---|---|
| Crane hook | B3 top to C1 street (34 H) | 10 s; called from either end |
| Spire lift | C3 to the break at y 40 (72 H) | 16 s |
| Spire lift, express (after the lever) | C3 to D3 (108 H) | 18 s at a faster speed; the outer climb is skipped |

**Shortcuts** (each is opened once, physically, from the far side, and stays open in the save,
in the Hollow Knight manner):

| # | Shortcut | Opened by | Saves |
|---|---|---|---|
| S1 | Rope-held deck, A3 | Slashing its rope at the y 12 landing | Two stair flights, both ways |
| S2 | Ferry, B1 dock to the B3 culvert | The culvert lever inside B3, after crossing the plain once. The horn wakes the ferryman; ring the ferry bell to call him. | The whole causeway. It's a 12 s scenic ride, with the colossus footfall seen from the water |
| S3 | Express lift, C3 to D3 | The lever at the Crown's east end | The outer climb |
| S4 | Sky door, A2 loft to the E4 balcony | Releasing the latch on the balcony | The whole world: the chapel is 25 s from spawn |

**No fast travel.** The map banner is a map, not fast travel (CANON). Every shortcut is a
physical place you move through.

---

## 8. The pacing curve

What the curve shows: the route alternates big open spaces with small enclosed ones about every
1 to 2 minutes. Tension has a single long rise, peaking at the Crown, then drops away at once
when the storm breaks. So the second half is an exhale: vast and calm, then cozy and calm.

Scale runs from **+5 (vast)** to **-5 (cozy)**. Tension runs from **0 (serene)** to **10
(storm)**. The chart is the lower half of `layout-2.svg` (two small panels sharing the route
axis, with tooltips on each point). The same data:

| # | Room | Scale | Tension | Time into a first round |
|---|---|---|---|---|
| 1 | A1 Arrival Ledge | +5 | 1 | 0:00 |
| 2 | A2 Lodge | -4 | 0 | 0:40 |
| 3 | A3 Switchback, shrine 1 | +2 | 1 | 1:30 |
| 4 | B1 Dock | +4 | 3 | 2:40 |
| 5 | B2 Causeway | +5 | 3 | 3:30 |
| 6 | B2 Bus shelter, shrine 2 | -3 | 2 | 4:30 |
| 7 | B3 Hollow Mouth | +3 | 4 | 5:00 |
| 8 | C1 Foundry Market, shrine 3 | +2 | 3 | 5:30 |
| 9 | C2 Archive | -5 | 0 | 6:30 |
| 10 | C3 Lift Foot | -2 | 2 | 7:30 |
| 11 | D1 Lift Ride | +4 | 5 | 8:00 |
| 12 | D2 Outer Climb | +3 | 8 | 8:30 |
| 13 | D2 Storm Alcove, shrine 4 | -4 | 4 | 9:15 |
| 14 | D3 Crown (summoning) | +1 | 10 | 10:30 |
| 15 | D4 Blade | +5 | 2 | 11:30 |
| 16 | E1 Pilgrim Path | +4 | 1 | 12:30 |
| 17 | E1 Pilgrim shrine, shrine 5 | -1 | 0 | 13:15 |
| 18 | E2 Porch, shrine 6 | -1 | 0 | 14:15 |
| 19 | E3 Chapel of Light | +1 | 0 | 14:45 |
| 20 | E4 Balcony | +5 | 0 | 17:00 |
| 21 | A0 Overlook, keeper (home) | -2 | 0 | 17:45 |

In plain words: grand in places and cozy in others, vast then indoors, serene then storm. The
cozy rooms (lodge, bus shelter, archive, storm alcove, porch) come right after the vast ones, and
the one storm sits between two serene ends. The arena is the only 10. The storm alcove gives a
breather inside the rise, so the climb isn't a flat wall of tension.

---

## 9. Light, weather and music along the route

**Light and weather timeline.** Time of day is tied to the place, not a clock. The route itself
runs from morning to dusk:

| Region | Time | Key light | Weather and air | Particles |
|---|---|---|---|---|
| Ledge (A) | early morning | pale gold sun in the ring, shaft to the water | clear, high haze, still | dust, gulls, specks off the ring |
| Shore and plain (B) | late morning, then overcast | cloud-broken sun, then flat grey-violet | wind rising, distant storm to the east | grit, grass seeds, birds over the colossus |
| Hollow (C) | none (inside) | amber furnaces, stall lamps, white searchlights | warm haze, steam; the storm only heard | embers, dust, sifting ceiling grit |
| Spire (D1 to D3) | afternoon storm | cold blue side-light, pale planet, lightning glow | rain, gusts, thunder | rain, spray, sparks |
| Blade (D4) | the storm breaks, then dusk | low rose-gold sun from the west | clearing, still | drips, birds |
| Pilgrim and chapel (E) | dusk | sunset through the ring and the rose window | calm, wet | moths, dust in coloured light, candle smoke |
| Home (A0 after the latch) | early evening | lamps and the last glow | still | moths |

**Music and ambience.** The theme is Dex's chosen **Suno "B"** cue:
`legacy/site/public/audio/world-v1/suno-theme-b-v1/support.opus` (and `.m4a`). It's 83.77 s
including 2.65 s of silence at the front, and its "grand, mystical" passage starts at 54 s. Per
CANON:

- ambience comes first
- the music swells in and never starts abruptly
- rooms that belong together keep it playing instead of restarting it
- reading spots are silent

| State | Where | What plays |
|---|---|---|
| **Ambience first** | A1 on Enter | wind, water, gulls. No music for about 12 s. |
| **Theme swell** | A1 onward, D1 | B fades in from its quiet start (the high piano phrase), then plays on through A0, A3, B1 and B2 at 70 to 100% |
| **Muffled** | A2, C1, C3, D2 alcove | the same playback low-passed at -8 to -10 dB (through walls, or from a radio), so it never restarts |
| **Silence** | C2 Archive; D4 for 2 s | fade out over 4 s; only room tone |
| **Storm** | D2, D3 idle | storm ambience leads; B at about 40% |
| **Arena** | D3 while summoning | the orchestral variant (below), 3 s fade in, 6 s fade out |
| **Theme at 54 s** | D4 when the storm breaks | B restarts at its grand passage, timed to the clouds opening |
| **Theme, soft** | E1 to E4 | B continues with gentle strings at 60 to 80%, reverb in E3; -6 dB while an artwork is open; the cue ends naturally at the balcony |

**Arena variant: the honest status.** No orchestral arrangement of B exists yet. The only
candidate on disk is `legacy/site/public/audio/v2/arena-chamber-v1.opus`. It's an original
strings-and-cello piece on a different motif, and nobody has listened to it for approval yet. It
can stand in, but an orchestral B needs Dex's ear (question 5).

**SFX already on disk** (candidates, in `legacy/site/public/audio/world-v1/`):

- `cable-cut` for the banner cord and the deck rope
- `lift-start` and `lift-dock`
- `step-concrete-*` and `step-metal-*`
- `paper-open` for the lectern and panels
- `landing`

**Footstep surfaces needed:** stone, wood, metal grating, wet metal, tile, rug, shallow water.

---

## 10. The arrival hybrid (Dex's direct ask)

What Dex asked for: ring over lake, **plus** the colossus, keeping the water's reflections. The
first frame, at 1280 x 720:

- **Ring:** cropped from the upper-left corner, about 55% of the width. The sun sits in its hole
  at upper centre-left, and a stepped shaft falls to the water. This is the ring-lake scene as it
  is.
- **Lake:**
  - From the horizon (about 0.45 of the frame height) down to the ledge lip (about 0.78).
  - Because you're high up, the horizon sits higher than in the dock composition, so more water
    shows. That's where "high above the lake" comes from.
  - Per-row parallax, stepped reflections, the warm sparkle path under the shaft.
- **Colossus:**
  - It wades right to left through the far shallows at about depth 40, knee-deep. Its body top
    reaches about 0.25 of the frame height.
  - Water is drawn **before** it, so the lake covers its legs below the waterline (SCENES.md
    rule 1).
  - It's mirrored about its own waterline, `reflect: waterY(depth)` (rule 2), so its **reflection
    breaks up in the stepped ripples**.
  - Each footfall sends ring ripples across the lake instead of dust, with drips falling from
    the lifted foot.
  - A second, ghostly colossus walks much deeper in the haze near the horizon.
- **Figure:** centred at x = 0.5, feet at about 0.78, 80 px tall (11% of the view). Bright water
  and the shaft pool sit behind her, never mid-grey rock (the readability rule in SCENES.md).
- **Ledge:** a dark stone band across the bottom 22%, with the muted red line running right.
- **Resolution:** at 1280 x 720 the scene engine's `u` is 2, so ring panels, haze bands and water
  rows get twice as fine. The figure, lamps, dock and doors are sized in H and keep their pixel
  size. That's the "twice the resolution" Dex asked for, without shrinking the player below the
  locked scale.

The same hybrid continues on purpose. At the dock the colossus comes nearer, over the same water.
On the plain the flats are sheet water, so the reflections keep going.

---

## 11. Asks for the build lanes (not done here)

- **Scene engine:**
  - Water ring ripples at **moving** points, fed each frame from the colossus walk's
    TypeScript twin. Today the ripple points are fixed at build time.
  - A colossus variant that wades, throwing spray instead of dust.
  - A **sheet-water ground** for the plain.
  - A shared **rain and gust field** that the pixel-matter wind (cloth, grass, flames) also reads.
- **Region light states:** morning, overcast, amber, storm, dusk and evening palettes per region.
  The D4 storm-break is a scripted transition in stepped bands.
- **Save state:**
  - lamps lit (6)
  - banner cut
  - deck cut
  - culvert open
  - express lever
  - latch released
  - round done
- **Distant lamps:** far layers show lamp points keyed to the save, so lit shrines are visible
  from the blade and the balcony.
- **Camera:** vista hold, locked, rail, free and arena modes (section 1). Whole-pixel easing, no
  zoom.
- **Cost risk:**
  - The arrival puts the ring and the colossus in one scene at 4x the pixels of the old near mode.
  - On an RTX 4090 that's fine. Under SwiftShader, today's 41 + 69 ms per frame at 640 x 360
    suggests several hundred ms at 1280 x 720.
  - The colossus `Tracker` bounds help. A laptop measurement is needed before calling it done.
- **Stale docs:** SCENES.md (640 / 960 targets, a 136 px stand-in) and the character docs (H = 96)
  still describe the old scale. Their owners should update them to the locked config. This lane
  doesn't edit `docs/character/**`.

---

## 12. Open for Dex

1. **Order.** This draft puts services (account, docs) before combat (arena), with the gallery
   last. Is that right, or should the arena come before the hollow?
2. **The story.** Does "the Round" (lamps relit after a storm, the keeper's two cups) fit? Should
   the player be Rosace in-story, or stay an unnamed traveller?
3. **Art in the world.** Option A: the frames in the nave show a soft light panel, and the piece
   itself appears only in the full-quality panel on E. Option B: a small DOM overlay of the real
   thumbnail, pinned inside each frame. (It would never be pixelated or used as a texture;
   either option keeps the art display-only.)
4. **Breakage.** Should craters and broken props heal in the room, as proposed here? And is the
   gallery rule (nothing breaks near the art) right?
5. **Arena music.** Is an orchestral arrangement of B worth making, or does the existing
   arena-chamber cue serve for now?
6. **Length.** The first round takes 15 to 20 minutes. Is the plain at 5 screens right, or should
   it be shorter?
7. **New props.** Approve the proposed additions in section 6 (stove, cups, radio, rope-held deck,
   levers, latch).
