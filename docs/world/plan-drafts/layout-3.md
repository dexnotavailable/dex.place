# Layout 3: hub and spokes ("the last lamp")

Draft world plan for discussion. It builds on draft 1, "the Procession" (`../MAP-AND-STORY.md`),
and keeps every content item in `CANON.md`. Mobs and bosses are out of scope: the arena, its
terminal and the summoning states are in, the warden itself is not.

Map and pacing chart: [`layout-3.svg`](layout-3.svg). The map is drawn to scale: 1 H = 4 px.

## In one paragraph

You arrive on a dock under the broken ring, with a colossus wading far across the lake behind it,
reflected in the still water. A short shore path leads into **the hollow**, a warm city inside a
fallen megastructure. The hollow is the hub: the account counter, a donation shrine, the map
banner, the archive and a lift all sit within about a minute of the dock. Three spokes leave
it, and each ends in a view: **up** through the storm to the arena and the calm above it,
**east** across the plain where the colossi walk, and **west and up** along the lamplighters'
path to the chapel of light where Dex's art hangs. One grand shortcut, **the Ring Line**, runs
along the ring's broken arm overhead and ties the three view-ends together, with a lamp cage
dropping from the chapel back down to the lake beside the dock. The first-visit loop takes
roughly 12 to 15 minutes without stopping to look at art. It alternates vast and cozy
throughout, and the storm peaks once, in the middle.

## 1. Locked scale (one config)

These numbers come from the coordinator's decision. They belong in one scale module, the
single source of truth (`src/scenes/engine/scale.ts`, `SCALE`); this plan only consumes them.

| Key | Value | Meaning |
|---|---|---|
| world view | 1280 x 720 world px | double the old 640 x 360 |
| presentation | largest integer nearest-neighbour scale that fits, else sharp-bilinear | never plain bilinear |
| **H** | **80 world px** | the player's height in exploration, sole to crown; everything below is in H |
| close-up | 144 px | cut-ins, combat zoom, portraits only |
| one screen | **16 H x 9 H** | the unit used for room sizes below ("screens") |

For comparison, the old site's hero was about 6% of the view's height. Ours is 80 / 720 = 11%,
a little bigger, as Dex asked.

**Movement in H.** These are the lab's tuning numbers (`src/lab/data/tuning.json`,
`player.clips.json`, authored for a 96 px character) expressed in H. The scale config should
store movement in H so that every jump in this plan still works if H is nudged.

| Move | In H | Level-design limit (keeps a ~15% margin) |
|---|---|---|
| run | 2.0 H/s (one screen in 8 s) | |
| single jump height | about 1.1 H | ledges up to **0.9 H** |
| double jump height | about 1.8 H total | ledges up to **1.6 H** |
| dash | about 1.1 H in 0.3 s, no gravity, 1 air dash | |
| running jump gap | about 1.3 H | **1.1 H** |
| + double jump | about 2.2 H | **1.9 H** |
| + air dash | about 3.2 H | **2.8 H** (the "dash gap") |
| walkable step | | **0.25 H** (stairs: 0.25 H rise per 0.4 H tread) |

**Standard object sizes in H.** An ordinary door is 1.4 x 0.7 H. An interior ceiling is 3 to 4 H.
The counter is 0.6 H tall, a bench seat 0.3 H, a lamp post 2.5 H, a pew 0.5 H. An artwork frame is
2.4 x 1.35 H at eye height, because the works are 16:9. Grand doors are 6 H and up.

**Camera rules.** Vast exteriors put the player at about 0.70 of the view's height, so the sky
dominates. Cozy rooms clamp the camera to the room so that the ceiling is visible: any room
under 9 H tall shows its own ceiling, and that is what makes it feel indoors. Vertical rooms
(the lift, the chain stair, the bell tower) follow vertically with a small look-ahead. The arena
clamps to its own 32 H floor.

## 2. The story, told by the route

This keeps "the Procession" from draft 1. Colossi walk an endless line toward the broken ring.
They don't notice anyone. People live in the hollow of a fallen megastructure and keep lamps
burning along the colossi's route. The player is a lamplighter. Nobody explains the ring, the
colossi or the spire.

The small human story is **the last lamp**. There is no text dump; everything below is visible
in the world:

1. **The dock (arrival).** Stillness. High on the ring's inner face, catching the light shaft,
   is one tiny dark window. It is the only dark light-point in the scene, and most people won't
   notice it yet.
2. **The gate hall.** A clerk runs the counter (the dex account). On the counter is a lamp
   ledger. Behind the clerk, a board of small lamps shows every shrine, and one of them is dark.
   A high west window looks toward the ring. The clerk has an empty second chair and a cup.
   If you talk to her, she says one short line at most, with no quest.
3. **The spokes.** Every shrine you rest at, you light (E). Its lamp stays lit in your save,
   its lamp on the gate-hall board lights too, and so does its mark on the map banner.
4. **The spire and the crown.** You climb through the storm to the arena and above it, into
   silence. From the crown the Ring Line runs east and west. West, you can see the dark chapel
   window up close, but its grille is locked from the other side.
5. **The plain.** You ride the ring east and cut the rope bridge down into the plain. Then you
   walk home west, *with* the colossi, in the same direction they walk. The storm stays behind
   you and the wind drops as you near the hollow.
6. **The chapel.** The long way up: the lamplighters' quarters (bunks, a warm lamp workshop),
   a bell tower, a cliff path over the lake, and a chain stair up the ring's hull. In the
   narthex hangs an old shawl on a hook, and there is a second cup, dusty. The nave is dim and
   candle-lit. One latch (E) opens the shutter: the light shaft floods the rose window and the
   nave, and Dex's nine works are lit one by one down the aisle.
7. **The oculus.** A view of everything you walked. A lever wakes the lamp cage, and the grille
   to the Ring Line swings open.
8. **Home.** The cage lowers you to the pier's end beside the dock you arrived at. Back in the
   gate hall, a patch of rose-coloured light from the chapel now falls through the west window
   next to the counter. The clerk has moved her chair and cup into it. The counter is still
   open. That is the whole ending: a small visible change, no banner.

Draft 1's Rosace-as-lamplighter premise still fits. If Dex prefers the Registry's no-backstory
traveller, the story works unchanged, because nothing in it depends on who the player is.

## 3. Map at a glance

Side view. x is west to east and y is elevation, both in H. The lake surface is y = 0.

```
 y(H)
 104            D5 CROWN ======== RING LINE (car) ==================\
  86  E6 CHAPEL-E7 OCULUS ===/    D4 ARENA                             \
  72  E5 narthex        |         D3 ante                               \
  62  E4 chain stair    |         D2 STORM GALLERY                       \ Arm stop
  45  E3 HIGH SHORE -- E2 bell    |                                       | rope bridge
  25     |           E1 quarters  D1 lift                                 |
  11   cage          B4 stair     |                                       |
   3  A0 A1 DOCK  A2 shore A3 gate B1 hall  B2 WELL  B5 foundry  C1 CAUSEWAY  C2 FIELD  C3  C4 FALLEN ARM
  -6                                   B3 archive
      x: -20 ....... 60 ....... 90 ..... 126 .. 152 ........ 216 ...... 264 . 280 ....... 344
```

The first-visit loop, which is also the order of the pacing chart: A1 A2 A3 B1 B2 (B3) D1 D2 D3 D4
D5, ride the ring east, C4 C3 C2 C1 B5 B2 B4 E1 E2 E3 E4 E5 E6 E7, cage down to A0, then B1.

Nothing forces the loop. The spokes can be done in any order, and every service is reachable
without it (section 5).

## 4. Regions and rooms

Sizes are width x height in H, then in screens (w / 16 x h / 9). "Open" means an exterior whose
sky is unbounded; the height given is the playable band. Refs: w01 colossus plain, w02 monolith
planet, w03 ring over lake, w04 amber foundry hollow.

### Summary table

| ID | Room | H (w x h) | Screens | Purpose | Mood | Light / weather | Sound | Ref |
|---|---|---|---|---|---|---|---|---|
| A0 | Pier's End | 16 x 9 open | 1.0 x 1.0 | rest overlook (left of spawn); later, the cage's landing | vast, serene | low sun, mist on water | ambience, theme piano | w03 |
| A1 | The Dock (arrival) | 32 x 9 open | 2.0 x 1.0 | arrival, scenery first | **vast**, serene | sun through the ring, shaft to the water, still | hush, then theme piano swell | **w03 + w01** |
| A2 | Reed Shore | 32 x 12 open | 2.0 x 1.3 | the path rises; first sight of the hollow's mouth | vast, serene | same, wind in reeds | theme piano | w03 |
| A3 | Hollow Gate | 12 x 20 | 0.75 x 2.2 | a huge mouth into a small warm room | grand threshold | amber spill from inside, cool outside | theme turns muffled | w04 |
| B1 | Gate Hall | 18 x 6 | 1.1 x 0.7 | **account counter**, shrine S1, lamp board | **cozy**, serene | warm lamps; later the chapel's rose light | theme muffled (low-pass) | w04 |
| B2 | The Well (plaza) | 36 x 28 | 2.25 x 3.1 | hub heart: **lift**, **map banner**, stalls, dummy | grand interior | furnace amber, a cold shaft from the roof oculus | theme muffled; market murmur | w04 |
| B3 | Archive | 36 x 6 | 2.25 x 0.7 | **documentation** behind an ordinary door | cozy, silent | reading lamps, dust in beams | **silence** (ambience only) | w04 |
| B4 | Lamplighters' Stair | 14 x 16 | 0.9 x 1.8 | switchback up to the chapel spoke | cozy, vertical | stair lamps, warm | theme muffled | w04 |
| B5 | Foundry Row | 26 x 10 | 1.6 x 1.1 | furnace passage to the plain | medium, warm and busy | furnace glow, embers, steam | furnace roar under the theme | w04 |
| C1 | The Causeway | 64 x 12 open | 4.0 x 1.3 | long walk; the red marker cloth | **vast**, wind | overcast; the storm on the spire visible behind | wind; theme full, sparse | w01 |
| C2 | Footprint Field | 48 x 13 open | 3.0 x 1.4 | craters, bones, standing stones | vast, wind | cloud shadows, breaks of sun | wind, grit, far footfalls | w01 |
| C3 | Procession Shrine | 16 x 6 | 1.0 x 0.7 | shrine S2, shelter | **cozy** pocket in vast | lantern inside, grey outside | wind outside; shrine hum | w01 |
| C4 | The Fallen Arm | 64 x 20 open | 4.0 x 2.2 | end view: the colossus passes close | **vast**, awe | haze, the ring's arm overhead | footfalls you feel; theme swells | w01 + w03 |
| D1 | The Lift | 6 x 59 (ride) | 0.4 x 6.6 | spoke to the spire, 25 s ride | cramped, rising | dark; the storm through slot windows | theme fades, rain rises | w02 |
| D2 | Storm Gallery | 48 x 18 open | 3.0 x 2.0 | climb outside the spire | vast, **storm** | rain, lightning, red warning lights | **storm** (no music) | w02 |
| D3 | Antechamber | 16 x 5 | 1.0 x 0.6 | shrine S3, respawn point | **cozy**, storm outside | one warm lamp, rain on the roof | storm muffled | w02 |
| D4 | The Arena | 32 x 10 open | 2.0 x 1.1 | **boss terminal**, floor seals | tense | storm; the seal's glow while summoning | storm; **orchestral arena variant** while summoning | w02 |
| D5 | The Crown | 32 x 10 open | 2.0 x 1.1 | end view above the storm; Ring Line stop | **vast**, serene | clear, the pale planet, a cloud sea below | silence, then the high piano phrase | w02 |
| E1 | Quarters | 24 x 10 (2 floors) | 1.5 x 1.1 | bunks, lamp workshop | **cozy** (Eastward) | warm lamps, after-rain light in the windows | theme muffled, kettle and drips | w04 |
| E2 | Bell Tower | 12 x 20 | 0.75 x 2.2 | vertical climb; shrine S4 in the loft | cozy, vertical | shafts through louvres | the bell (if struck) | w04 |
| E3 | High Shore | 44 x 9 open | 2.75 x 1.0 | cliff path; the whole lake and dock below | **vast**, after rain | washed clear, wet shine, puddles | theme full | w03 |
| E4 | Chain Stair | 12 x 27 open | 0.75 x 3.0 | climb the ring's hull | vast, vertigo | hard light on the hull plates | wind; theme strings | w03 |
| E5 | Narthex | 12 x 5 | 0.75 x 0.6 | shrine S5, the cage lever, the shawl | **cozy** | candles | hush | w03 |
| E6 | Chapel of Light | 48 x 14 | 3.0 x 1.6 | **the gallery**: 9 works, catalogue | serene, tall but held | dim candles, then the shaft floods in | one piano phrase, then silence while viewing | w03 |
| E7 | Oculus | 12 x 10 open | 0.75 x 1.1 | end view; Ring Line stop | **vast**, serene | the full ring and the lake | theme, full and quiet | w03 + w01 |
| RL | Ring Line | ~60 H west, ~210 H east | ~4 + 13 | the grand shortcut (car) | vast, flowing | high wind, the ring's lamps | theme strings | w03 |
| — | Lamp cage | 72 H drop | 8 tall | chapel to pier's end | vast | down along the ring's hull | theme | w03 |

### Rooms in detail, with props

Prop names come from the approved list in `docs/props/PIXEL-MATTER.md`. **(new)** marks a
prop that is not on that list yet; each one needs Dex's OK. Wherever it says E, the prop opens
a panel or acts. Wherever it says slash, the prop reacts physically.

**Breakage policy (proposal).**
- Service and story objects never break: donation boxes, plaques, the counter, the terminal,
  doors, shrine lanterns, the rose window and every artwork frame. A slash on an artwork frame
  passes through without any reaction, so Dex's work is never touched.
- Glass, pillars, crates, barrels, pews and plants break, and they heal when the room resets.
- Cut cords (the map banner's cord, the rope bridge) stay cut for that save, per CANON.

#### A. The Lake

- **A1 The Dock (arrival).** This is the hybrid of ring over lake and colossus (section 9).
  The player spawns at the centre of a 32 H dock in a very wide, still space. A muted red floor
  line runs right. Nothing else competes: no NPC, no box, no prompt, no timer.
  Props: pier lantern (lit, slow flicker; a light source that rim-lights the player warm);
  mooring posts x3 (ring ripples); rope and buoys on the water (bob); the small moored boat she
  came in on (bobs; slashing it rocks it); reeds at the dock foot (bend when walked through);
  water (ripples, reflections, and a splash on a Q impact); dust and moths at the lantern.
- **A0 Pier's End** (left, 16 H). A resting overlook. Props: bench (E: sit, and the camera eases
  out 10%); a **chain hanging from the sky** into the water, whose end rocks. It is a mystery
  until the lamp cage lands here. Later: the **lamp cage (new, a variant of the lift recipe)**,
  with states away / descending / docked; E to ride. No donation box: views stay pure.
- **A2 Reed Shore** (32 H, rising 3 H by readable 0.25 H steps and slopes). Props: reeds, grass
  and flowers; low rocks; a second lamp post at the top of the rise; a sign (a plain arrow
  icon); luggage left on a rock (someone else arrived too). The hollow's mouth grows ahead.
- **A3 Hollow Gate** (12 x 20 H). A mouth more than two screens tall that narrows to one ordinary
  1.4 H door into the gate hall: vast outside, small door, warm room. The proportions are wrong on
  purpose, in the Backrooms way. Props: hanging cables and chains (sway in the draught); a lamp
  post; warm spill light around the small door.

#### B. The Hollow (hub)

- **B1 Gate Hall** (18 x 6 H, ceiling visible). About 40 s from spawn.
  - **Registry counter** with bell and ledger. E on the counter or the clerk opens **dex
    account** (same state as the website). E on the bell rings it and the clerk looks up.
    States: clerk working / acknowledging / (after the chapel) on a cup break, sitting in the
    light beside the counter, which stays usable.
  - **Shrine S1**: lantern (E lights it, and it stays lit), offering bowl, **donation box**
    (idle, open → donate panel, small light and chime), **top-donor plaque** beside it (E opens
    the donor list; empty data stays empty).
  - Lamp board **(new; could be a sign variant)**: small lamps per shrine, mirroring your save.
  - Signs; crates; a chair and cup **(new, small)**; the high west window (later the rose light).
- **B2 The Well** (36 x 28 H: the one tall interior in the hub). Three levels: floor (+3),
  gallery (+11), upper gallery (+19). The roof oculus sits at +31, and the lift runs up through it.
  - **Lift platform** with cables and counterweight: idle / called / moving / docked. Its shaft
    glows from the gate hall's inner arch, so the lift is the most visible thing in the hub.
    That serves downloads, the top wayfinding priority.
  - **Map banner**: rolled on a rod on the gallery rail at +11, held by a cord. Slash the cord
    and it unrolls (cloth physics). E opens the full map: your visited rooms and lit shrines.
    It stays cut.
  - Market stalls with cloth awnings (sway; tear when cut, then heal); crates and barrels
    (splinter); a crane with a swinging hook (swings when hit); steam vents (puff, pushed by the
    dash); sparking junction boxes (spark when hit); flickering glyph signs (holy-light signs);
    hanging cables and chains; dust motes in the oculus shaft.
  - **Training dummy** by the lift foot: it reacts to every hit type and never dies. It is the
    one place to try the sword before the storm.
  - **Archive door** on the floor level, east: an ordinary door (closed / opening / open).
    Stairs go down to B3.
- **B3 Archive** (36 x 6 H, below the plaza). No puzzle, no prerequisite.
  - Stair landing, then the stacks (24 H), then a reading room (6 H).
  - Shelves and scroll racks by product, each with a plain sign. E on a shelf opens that
    product's docs.
  - **Lectern with an open book** in the reading room: E opens the documentation index; the
    pages flutter when you pass.
  - Candelabra (reading light); dust motes; loose paper that lifts in the dash's wind; a bench.
  - Real documentation only. The lamp ledger (lore) stays upstairs in B1.
- **B4 Lamplighters' Stair** (14 x 16 H switchback, 0.25 H steps). Props: lamp posts on each
  landing, hanging lanterns, laundry banners (cloth), a sign pointing up (lamp icon).
- **B5 Foundry Row** (26 x 10 H, stepping down 5 H to the plain door). Props: furnace mouths
  (light sources that rim-light the player orange), steam vents, a crane with a hook, a sparking
  junction box, crates and barrels, embers. A grand door (6 H) opens east onto the causeway;
  it is a one-time open that stays open.

#### C. The Plain (colossus spoke, east)

- **C1 The Causeway** (64 H, raised 2 H over the dark plain). Marker posts every ~12 H with red
  cloth strips that whip in the wind; this continues the arrival's red line. The colossus crosses
  far behind (depth ~40, the colossus-plain loop). The spire's storm is visible over your
  shoulder as the only moving dark mass. Props: standing stones; wind-torn prayer flags on lines;
  grass bending in gusts; breakable pillars (old causeway balusters: they chip, then heal); a
  lamp post at the halfway point (E to light it: a tiny lamp on a very long walk).
- **C2 Footprint Field** (48 H). You ramp down off the causeway.
  - **Colossus footprint craters**, 8 H wide and 1.5 H deep: you walk down in and up out.
    Two hold puddles that reflect the sky and the ring (the water system again).
  - **Half-buried bones**: rib arches 6 H tall that you walk under and cross by jumping between
    ribs (gaps of 1 H and 1.9 H); a skull ridge you can climb.
  - Standing stones; rubble; grit blowing along the ground.
  - An optional dash gap (2.6 H) over the widest crater leads to a bone ledge with a view.
- **C3 Procession Shrine** (16 x 6 H, roofed, open-sided). The cozy pocket in the vast plain.
  Props: **shrine S2** (lantern, offering bowl, donation box, top-donor plaque); prayer flags;
  a bench; candles in a niche (flicker; they gutter out when hit and relight).
- **C4 The Fallen Arm** (64 x 20 H). The ring's broken arm stabs into the plain, a diagonal as
  big as a district.
  - The colossus's loop passes **close** here: depth ~3, one foot plants inside the frame, and
    the ground shakes (camera shake 2 px, dust billow).
  - It is not an enemy: it never notices you, has no hitbox and cannot hurt you.
  - At the east end, a rock outcrop gives the **end view**: the procession of colossi in a line
    across the horizon, walking west toward the ring. Props: a bench; one lamp post; nothing else.
  - **Arm stop** of the Ring Line, 20 H up the arm. A **rope bridge (new as a prop; the
    interaction is in CANON)** hangs raised: cut the rope, the post stays, the deck lowers and
    becomes a walkable ramp. Riding in from the ring, you cut it from above. It stays cut.
  - Wind-whipped pennants on the arm; rubble; debris dropping from the arm's torn edge.

#### D. The Spire (storm spoke, up)

- **D1 The Lift** (59 H ride, about 25 s).
  - Inside: the cage, a warning light, cables. Slot windows every ~8 H flash the storm and,
    looking down, the hollow's lights.
  - Mid-stop at the storm gallery on the first ascent. After you reach the top once, the lift
    runs **express** from B2 to D3 (about 12 s). Downloads stay quick for returning visitors.
- **D2 Storm Gallery** (48 x 18 H, a diagonal climb up the spire's leaning face).
  - Catwalks, ledges and cantilevers, with gaps: three jump gaps (1.1 H), two double gaps
    (1.9 H) and one dash gap (2.6 H) over a gust.
  - **Wind gusts** push 0.6 H/s for 2 s. Pennants and the rain angle telegraph each gust 0.5 s
    ahead.
  - Lightning is light only, through the flash gate.
  - No death pits: a missed jump lands on a catch ledge ~3 H below.
  - Props: warning lights (blink; a hit makes them spark and flicker); wind-whipped pennants
    (cloth); breakable pillars (struts); hanging chains; puddles on the catwalks; a lamp post
    that swings on its bracket in gusts.
- **D3 Antechamber** (16 x 5 H). Props: **shrine S3** (lantern, bowl, donation box, top-donor
  plaque); a bench (respawn point for the arena); a door (closed / opening / open) to the arena;
  candles; rain streaks on a window. It is the calm breath before the arena.
- **D4 The Arena** (32 x 10 H, flat floor, open to the storm, walls of broken spire ribs).
  - **Boss terminal**, at the west edge. E wakes it. States:
    - dormant: the screen is dark.
    - woken: the screen lights and the product list appears. In the world this shows only what
      you could summon for, never a download.
    - summoning: a beam rises, and a seal forms in the floor.
    - seal formed: holds here until the warden exists (bosses are out of scope). E again or
      walking away releases the seal.
    - cooling down.
  - **Arena floor seals**: a ring 10 H across (idle faint lines / charging / formed / breaking).
  - Broken armour pieces (earlier wardens' remains; slash to scatter); wind-whipped pennants;
    breakable pillars at the edges; the destructible floor (Q and R craters heal).
  - Later (not now): win → death beat → black → that product's menu → Download. Every visit is a
    fresh fight, and past wins never unlock anything.
- **D5 The Crown** (32 x 10 H, above the cloud deck). Silence. The pale planet fills the sky,
  with a cloud sea below and the ring's arc running both ways.
  - Props: a bench; wind-whipped pennants gone still; one lamp post (E: light it).
  - The **Crown stop** of the Ring Line is here. Its gate is a latch opened from this side, so
    you open it the first time you come up.

#### E. The Chapel (gallery spoke, west and up)

This is the long way, and it should mean something: about 3 minutes from the gate hall on
first visit.

- **E1 Quarters** (two floors of 24 x 5 H; cozy, like Eastward).
  - Bunks **(a bench variant)**, luggage, a lamp workshop bench with lamp housings in rows (the
    lamp post recipe at small size; a slash knocks one swinging).
  - A lectern with the lamplighters' logbook: E shows a few short handwritten lines, dates and
    lamps, and the last chapel entry is old. No lore dump.
  - Hanging lanterns; laundry banners; a stove glow through a grate; drips from the roof into a
    bucket (a puddle).
- **E2 Bell Tower** (12 x 20 H).
  - Climb by stairs and platforms that alternate 0.9 H single jumps with 1.6 H double-jump
    ledges.
  - **Hanging bell on a yoke** at the top: slashing it swings it and rings it across the map
    (the clerk looks up), and it settles.
  - In the loft, **shrine S4** (lantern, bowl, donation box, top-donor plaque) and a bench.
- **E3 High Shore** (44 H cliff path, after rain).
  - The lake, the dock and the hollow gate spread out in the background layers far below and
    beyond; the route so far, seen from above.
  - The ring's inner face is huge and close.
  - A **rope bridge** spans a 6 H chasm here. It is walkable and sways under your steps; don't
    cut this one (cutting it drops the deck as a ramp to a lower ledge path, which rejoins).
  - Props: grass, flowers and vines (bend, scatter when cut); lamp posts (E to light each: three
    small lamps along the path); puddles; standing stones; moths.
- **E4 Chain Stair** (12 x 27 H, climbing the ring's hull).
  - Hull plates as ledges (0.9 H and 1.6 H steps), chains to jump between (hanging chains
    swing), and one dash gap (2.4 H) with a hull plate below as a catch.
  - Vertigo, but no death: a fall lands on the high shore.
  - The lamp cage's chain runs beside you all the way.
- **E5 Narthex** (12 x 5 H).
  - **Shrine S5** (lantern, bowl, donation box, top-donor plaque); a **font with water**
    (ripples when touched; reflections); the shawl on a hook (cloth); a dusty second cup.
  - The **cage lever (new: latch/lever)**: up / down. Pulling it sends the lamp cage to the
    pier's end once, which opens the chapel ↔ arrival shortcut.
- **E6 Chapel of Light** (48 x 14 H). The nave runs east toward the rose window.
  - **The shutter latch (new: a door variant, closed / opening / open)** is 4 H inside the nave.
    E opens it.
    - Before: the nave is candle-dim, and the works are still inspectable. No gating; the light
      is atmosphere, not a lock.
    - After: the light shaft enters through the **rose window** (stained glass, colored light
      that rim-lights the player), sweeps down the aisle, and lights each work in turn.
  - **Nine easels/frames**, one per 5 H bay, 2.4 x 1.35 H, at eye height. E on one opens that
    single artwork (from `content/gallery/manifest.json`, files in `public/gallery/`) with
    back/close. There are no titles, only alt text.
  - The frames never react to the sword, and the art is never used as texture, light or
    backdrop. The frame is the prop; the image appears only in the DOM panel.
  - **Lectern at the nave's head** holds the catalogue: E shows all nine.
  - Other props: prayer candles in rows (flicker, gutter when hit, relight); pews (splinter,
    heal); hanging lanterns; a **censer on a chain** (swings, trails smoke, pushed by the
    dash); side windows of stained glass (breakable: they shatter into shards and reassemble);
    a bench in the middle of the nave (E: sit, and the camera holds on the works); dust motes
    in the shaft.
- **E7 Oculus** (12 x 10 H balcony beyond the rose window).
  - The **end view**: the lake, the dock, the hollow's glow, the plain, and the colossi in a
    line on the horizon walking toward you. Everything you walked, at once.
  - Props: a bench, a hanging lantern.
  - The **Oculus stop** of the Ring Line: a grille latch (E) opened from this side.

#### RL. The Ring Line (the one grand shortcut)

- A rail along the ring's broken arm, carrying **the ring car (new: a variant of the lift
  recipe on a rail)**: 3 H wide, open sides, 7 H/s.
- Stops: **Oculus** (west), **Crown** (centre), **Arm** (east). A foot on the west side, the
  **lamp cage**, joins the narthex to the pier's end.
- The car serves any stop you have been to. Each stop's gate opens from its own spoke side:
  - Crown: its latch opens as you arrive from the arena.
  - Arm: the rope bridge, cut from above.
  - Oculus: its grille, opened from inside the chapel.
- Before a gate is open, you can ride to that stop's platform and see through, but not pass.
  That is how the dark chapel window gets its close-up foreshadowing.
- The ride is the vast, flowing moment of the loop: the theme with strings, the lamps along
  the ring lighting as the car passes, and the storm below on one side with the plain on the
  other.
- Rides: Crown → Arm about 30 s, Crown → Oculus about 9 s, cage 10 s. Walking the rail is
  allowed too, with benches at two lookouts.

## 5. Content destinations and how you find them

In CANON's wayfinding priority order. The website is one scroll away everywhere: the cinematic
bars recede and the real site comes up, with no game in the way.

| Destination | Where | First-visit time from spawn | How you find it |
|---|---|---|---|
| **Downloads** | D4 arena terminal | about 2 min (lift + storm), about 75 s once the express runs | the lift's glowing shaft is the brightest thing seen through the gate hall's inner arch; the storm on the spire is visible from arrival onward |
| **Donate** | shrine S1 in the gate hall, then S2 to S5 on each spoke | about 40 s | S1 sits beside the counter, the first warm lit thing inside; every shrine is the same silhouette (lantern, bowl, box, plaque) |
| **Illustrations** | E6 chapel | about 4 min first time; about 40 s once the cage runs (spawn → A0 → cage) | warm stair lamps rise on the hub's west side; the dark chapel window is visible from the dock, the high shore and the crown |
| **Documentation** | B3 archive | about 55 s | an ordinary door on the plaza floor next to the lift; no prerequisite |
| **dex account** | B1 counter | about 40 s | the clerk and the counter are the first thing inside the hollow |
| **Map** | B2 banner | about 50 s | a rolled banner on the gallery rail above the lift; slash the cord |

## 6. Traversal

- **Doors.** Ordinary doors (1.4 H), for the archive, the antechamber and the quarters: closed /
  opening / open, E to open. Grand doors (6 H+), the foundry's east door and the hollow gate:
  they open once and stay open. The chapel shutter is a door variant.
- **Lifts.**
  - The spire lift (B2 ↔ D2 ↔ D3): a mid-stop on the first ride, express afterwards.
  - The ring car (Oculus ↔ Crown ↔ Arm).
  - The lamp cage (narthex ↔ pier's end).
  - All three are keyed motion with easing, `lift-start` / `lift-dock` sounds, and E to call or
    ride.
- **Shortcuts.** There is one: the Ring Line and its cage foot. Every gate opens from the far
  side (Hollow Knight style), so each opening is a reward for having walked that spoke.
- **Cuts.** The map cord (B2) and the Arm's rope bridge (C4) are permanent per save. The High
  Shore rope bridge is optional to cut and has a lower path.
- **Jumps and gaps**, by the limits in section 1:
  - Exploration spokes use ≤ 0.9 H ledges and ≤ 1.1 H gaps.
  - The two vertical climbs (E2, E4) and the storm gallery (D2) use double-jump ledges
    (≤ 1.6 H) and a few dash gaps (≤ 2.8 H).
  - Every dash gap has a visible catch ledge below.
  - Nothing required needs an air dash before the storm gallery.
- **Falls.** No death pits in exploration. A fall into the lake or off a climb gives a splash
  or dust, a short fade, and you are back at the last safe ledge with no damage.
- **Stairs.** Readable 0.25 H steps everywhere, and footsteps match the surface: wood on the
  dock and in the quarters, stone on the causeway and in the chapel, metal in the lift and on
  the storm gallery and ring rail.
- **Rest.** Five shrines with donation boxes, plus four bench-only views (A0, C4, D5, E7) where
  visitors' ghost silhouettes will tend to gather.

## 7. Pacing curve

The chart is the lower half of `layout-3.svg`, with each value as a hover tooltip there. It uses
the first-visit loop. Space runs from +2 (vast) to -2 (cozy). Mood runs from 0 (calm) to
4 (tense or storm).

| # | Room | Space | Mood | | # | Room | Space | Mood |
|---|---|---|---|---|---|---|---|---|
| 1 | A1 Dock | +2 | 0 | | 15 | C2 Footprint Field | +1.5 | 1 |
| 2 | A2 Reed Shore | +1 | 0 | | 16 | C1 Causeway | +1.5 | 1.5 |
| 3 | A3 Hollow Gate | +2 | 0.5 | | 17 | B5 Foundry Row | -0.5 | 1 |
| 4 | B1 Gate Hall | -2 | 0 | | 18 | B2 The Well | +1 | 0 |
| 5 | B2 The Well | +1 | 0.5 | | 19 | B4 Lamplighters' Stair | -1 | 0 |
| 6 | B3 Archive (side) | -2 | 0 | | 20 | E1 Quarters | -2 | 0 |
| 7 | D1 Lift | -1.5 | 1 | | 21 | E2 Bell Tower | -0.5 | 0.5 |
| 8 | D2 Storm Gallery | +1.5 | 3 | | 22 | E3 High Shore | +2 | 1 |
| 9 | D3 Antechamber | -2 | 1.5 | | 23 | E4 Chain Stair | +1.5 | 2 |
| 10 | D4 Arena | +0.5 | **4** | | 24 | E5 Narthex | -2 | 0 |
| 11 | D5 Crown | +2 | 0 | | 25 | E6 Chapel of Light | +0.5 | 0 |
| 12 | Ring car east | +2 | 0.5 | | 26 | E7 Oculus | +2 | 0 |
| 13 | C4 Fallen Arm | +2 | 2 | | 27 | Cage to A0 | +1 | 0 |
| 14 | C3 Procession Shrine | -1.5 | 0 | | 28 | B1 Gate Hall (cup break) | -2 | 0 |

How to read it:
- Space swings between vast and cozy every one to three rooms. Each cozy room holds a shrine
  or a service, so rest and usefulness land where the space closes in.
- Mood has one real peak, the storm and the arena (steps 8 to 10), then drops straight to zero
  at the crown. That is "serene, then storm", and then the calm above it.
- Two smaller swells follow: the colossus passing close (13) and the vertigo of the chain stair
  (23). Both are awe, not danger.
- The loop ends small and warm: the gate hall with the light in it.

## 8. Sound

The theme is Dex's chosen **Suno "B"** arrangement
(`legacy/site/public/audio/world-v1/suno-theme-b-v1/support.m4a`, attribution alongside). It is
one arrangement, so the states below are sections and treatments of it. The cue points (where
the high piano phrase starts, where the strings enter) should be picked **by ear with Dex**; a
fade check is not a listening approval.

| State | What plays | Used in |
|---|---|---|
| hush | ambience only: water, wind, room tone | the first 8 to 12 s after Enter; A3→B1 threshold |
| piano | the theme's high piano phrase, sparse, swelling in over 6 to 10 s | A1 (after the hush), A0, A2; one phrase at D5 and when the chapel shutter opens |
| full | piano with gentle strings | C4 view, E3, E4, E7, the Ring Line |
| muffled | same playhead, low-passed and quieter, so it never restarts between hub rooms | B1, B2, B4, B5, E1 |
| silence | ambience only, intentional | B3 reading room; E6 while an artwork panel is open; D5 on arrival |
| storm | no music: rain, wind, thunder after each flash | D1 upper half, D2, D3 (muffled), D4 idle |
| arena | an orchestral variant, only while the terminal summons or holds a seal (later: the fight) | D4 |

- **Transitions.** Crossfades of 4 to 8 s. Music always swells in and never starts abruptly (the
  last two versions failed exactly here). Rooms that belong together keep one playhead: the hub
  set, the chapel spoke's interiors, and the plain.
- **The orchestral variant.** There is no approved one yet. `legacy/site/public/audio/v2/arena-chamber-v1`
  is a candidate that needs Dex's ears, or it could be an orchestral arrangement of B itself.
- **SFX already in legacy.** `lift-start`, `lift-dock`, `cable-cut` (the map cord, the rope
  bridge), `paper-open` (docs, logbook), `step-concrete-*`, `step-metal-*`, `landing`,
  `slash-*`, `hit-metal`, `telegraph` (the terminal waking). Still missing: bell, water steps
  and splash, cloth, glass, the colossus footfall.

## 9. The arrival: ring over lake + colossus, at double resolution

This is Dex's direct ask. It is built from the two existing prototypes (`src/scenes/scenes/ring-lake.ts`
and `colossus-plain/`) on the engine's 1280 x 720 target.

- **Keep all of ring-lake's water.** Keep:
  - per-row water parallax, stepped reflections that strengthen toward the horizon, and
    row-shear ripples;
  - the warm sparkle path under the shaft;
  - ring ripples at the dock posts;
  - the lit inner face's broken warm reflection.

  The ring stays the one dominant huge thing: cropped top left, the break on the right.
- **Add the colossus behind the lake**, not in front of it:
  - It walks the far shore and shallows at depth ~40 to 60, right to left, toward the ring:
    the Procession, from frame one.
  - It is a standing layer, so its base sits at `waterY(depth)` and it mirrors about its own
    base (`reflect: waterY(depth)`). The pale body then breaks up in the ripples as a long
    reflection.
  - Its feet in the shallows throw ring ripples and a low spray instead of dust.
  - Haze eats its rear and legs in steps, so it reads as weather, not as a second focal point.
  - The ghost colossus stays deeper still.
- **Timing.** The first frame is still: the colossus is off screen, and its loop is phased to
  enter about 25 to 30 s after Enter. People who stand and look get the reveal; people who run
  right catch it from the shore.
- **Resolution.** Double the view (1280 x 720), so `ctx.u` doubles. View-scaled layers (sky,
  ring, far terrain, mist) get finer pixels for free. Character-scaled things (the dock, the
  lantern, the posts, the boat) are authored in H, so they stay chunky next to the player, as
  CANON asks: chunkier near, finer far.
- **The chapel window.** One tiny dark notch on the ring's inner face in the shaft's cone. After
  the chapel opens, it becomes a steady warm point (your save only).
- **Budget watch.** ring-lake was about 0.6 ms near on the 4090 and colossus-plain about 0.9 ms,
  but under SwiftShader both are heavy, and doubling the pixels roughly doubles the per-pixel
  cost. The colossus layer's `Tracker` bounds, which scissor it to its columns, matter even more
  here. Measure with `gpucost` at 1280 x 720 before judging, and get a real laptop number.

## 10. Light and weather, by region

The whole world sits at **one fixed hour**: a low sun through the ring. The weather belongs to
places, not time, so every visit feels the same and the storm is always on the spire.

| Region | Key light | Weather | Accents (through the flash gate) |
|---|---|---|---|
| Lake | warm low sun through the ring; the shaft to the water | still, mist on the water | glints on the ring, a beacon at the break, birds |
| Hollow | furnace amber, a cold oculus shaft, lamps | steam, embers, dust | welding arcs, furnace flares, sign flicker |
| Plain | overcast blue-grey, moving cloud shadows and breaks of sun | wind, grit; the storm visible on the spire | far lightning over the spire, an eye glint on the colossus |
| Spire | red warning lights; lightning as the only strong light | rain, gusts, storm | lightning bolts and sheets (at most 2 starts in any second) |
| Crown | cold white planet light from above | clear, silent, a cloud sea below | slow window twinkle on the spire |
| Chapel spoke | washed, clear late light | after rain: drips, puddles, wet shine | glints on wet hull plates; later, the rose window's coloured light |

Every lit prop (lanterns, candles, furnaces, warning lights, the rose window) feeds the light
list, so the player is rim-lit in the local colour: warm at shrines, orange in the foundry, red
in the storm, rose in the chapel.

## 11. Scope and open questions for Dex

**Out of scope here:** mobs, bosses and the warden fight, and anything after "seal formed". Also
other visitors' ghosts and voice (the benches are only the places reserved for them).

**For Dex:**

1. Hub and spokes versus draft 1's line. Does the loop (spire first, ride the ring, walk home
   with the colossi, chapel last) feel right, or should the plain come before the spire?
2. The last-lamp story and the clerk's cup break: keep, or go back to the Registry courtyard?
3. New props to approve: the lamp cage and the ring car (lift variants), the rope bridge, the
   latch/lever, the chapel shutter (a door variant), the lamp board, the chair and cup, bunks
   (a bench variant).
4. The breakage policy (section 4): is it right that service objects and art frames never break
   and cut cords stay cut?
5. The arena's orchestral variant: the legacy candidate, or an orchestral arrangement of B?
6. Movement speed: at 2 H/s a screen takes 8 s. The long walks (causeway, arm, high shore) are
   tuned for that; a faster run would shorten the whole loop.
