# Layout 1: the Pilgrimage Loop (plan draft)

One of several competing world plans. Nothing here is built. It uses the locked scale below,
the four world refs in `docs/world/REFS.md`, the content in `CANON.md`, and the prop list in
`docs/props/PIXEL-MATTER.md`. Map and pacing chart: `layout-1.svg` (same folder).

## In one paragraph

You arrive on a dock under the broken ring, with a colossus wading across the far side of the
lake and its reflection moving in the water. You walk right, away from the lake: past a small
ferry house (the account counter and the first donation box), along a reed shore, onto a
misty causeway where the colossi walk, then down into a warm city inside a fallen hull (the
archive), up a black spire to the arena (downloads), out through a storm, and up a fallen
piece of the ring itself to a chapel of light above the clouds (the gallery). In the chapel you
lift a latch, and its door opens straight back into the ferry house beside the dock. The whole
thing is one long line outward with three branches going up or down, closed into a loop by
shortcuts you open from the far side, the way Hollow Knight does it.

## Locked scale (applies to every number below)

| Thing | Value |
|---|---|
| World view | 1280 x 720 world px (double the old 640 x 360) |
| Presentation | largest whole-number nearest upscale that fits; otherwise sharp-bilinear (nearest to the next whole multiple, then linear down to fit). Never plain bilinear |
| Player height **H** | 80 world px in exploration; 144 px close-up render for cut-ins, combat zoom, portraits |
| One screen | **16 H wide x 9 H tall** |
| Run speed | about **2 H per second**, so one screen width is about 8 s of walking |

All of these come from one config so they can be nudged later: `SCALE` in
`src/scenes/engine/scale.ts` (view 1280 x 720, player 80, close-up 144, the presentation rule).
Every room, step, door and gap below is written in H, so if H moves, the world regenerates
with it.

The lab's movement tuning is authored for a 96 px character. Scaled by H (multiply velocities
and gravity by 80/96), the same feel gives this envelope, simulated from
`src/lab/data/tuning.json` and the `dash` clip's root motion:

| Move | Measured at lab tuning | Design limit (with margin) |
|---|---|---|
| Single jump | 1.03 H up, 1.5 H across at run speed | ledges up to **0.9 H**, gaps up to **1.25 H** |
| Double jump | 1.72 H up, 2.5 H across | ledges up to **1.5 H**, gaps up to **2 H** |
| Double jump + air dash | 1.72 H up, 3.6 H across | **dash gaps** 2.5 to 3 H |
| Walkable step | none | up to **0.25 H** per step (stairs read as stairs) |
| Dash on the ground | 1.14 H in 18 ticks | none |

**Traversal rules for this layout.** The route to the downloads arena, the archive, the
account counter and every donation box needs only walking, single jumps and lifts. The gallery
route asks for double jumps and has exactly one dash gap, placed where missing it drops you
one ledge down and never kills you. There are no death pits outside the arena. Anyone who
does not want to play at all scrolls down to the website.

## The story: "the Lamplighter's Round"

This builds on draft 1, "the Procession", and folds in the one small arc from the old
Registry story that Dex accepted (a door that opens onto empty sky, a long way round, a latch,
a coffee break). Nothing is explained in text. The story is told by where things are.

**The world, as a visitor would piece it together.** Colossi walk a slow line around a lake,
under a broken ring. People live in the hollows of fallen megastructures and keep lamps
burning at shrines along the colossi's path, so travellers can find the way. You are one of
the lamplighters: at every shrine you rest at, you light its lamp. Nobody tells you why the
ring broke or where the colossi are going.

**The small human story.** It belongs to one person, the ferry house clerk.

1. **The dock.** Nobody is there. A suitcase stands on the boards. A pier lantern is already
   lit, so someone keeps this place.
2. **The ferry house.** The first person you meet, a surprise after the empty dock. The clerk
   runs the counter (your dex account, the first donation box). Behind her is a door with a
   small chapel mark. Open it and it shows empty sky: far away and high up, above a storm on
   the horizon, one warm lit window on a broken piece of the ring. On the sill next to the door
   there is a cup that has gone cold. If you talk to her, one line: *"It used to open onto the
   chapel. Mind the step."*
3. **The causeway.** You light your first shrine lamp. A colossus crosses behind you. The map
   banner hangs here: cut it down and the map shows the shrines as a dotted line, the round
   you are walking.
4. **The hollow and the spire.** Life going on under enormous things: stalls, cranes, the
   archive. The arena is a branch up the spire, a job people come here to do, not the end of
   the story.
5. **The storm.** You leave the city through a culvert, into rain. A fallen segment of the
   ring leans out of the sea into the clouds. Halfway up, a small shelter with candles someone
   keeps lit. The climb is the hardest part of the route.
6. **The chapel.** Above the clouds the storm stops at once. Silence, then the theme. Dex's
   nine pictures hang in the nave. On the bench under the rose window: a cushion with a dent
   in it and a sprig of dried flowers. Beside the entrance is the door that belongs to the
   ferry house, held shut by a latch on this side.
7. **The latch.** Lift it and the door shows the warm ferry house interior, lamps on, dusk in
   its window. Step through and you are home, beside the dock.
8. **What changes.** The clerk looks up, takes her cup, walks through the door and sits on her
   bench in the chapel light. On later visits she is sometimes there on her break. From the
   chapel balcony, at dusk, the shrines you lit show as a line of small lights along the whole
   route, and the colossi walk the same line on the horizon. That is the whole story: a round
   walked, lamps lit, one person's view given back.

No quest marker, no completion banner, no forced dialogue. The clerk can be skipped entirely
and the loop still reads through the props (the cold cup, the cushion, the sky door).

**The visual rhymes that hold it together:** the ring (huge at the dock, receding behind the
causeway, hidden in the hollow, tiny from the spire, a lightning silhouette in the storm, at
eye level from the chapel, with the rose window framing the sun through its hole, the same
light shaft you saw on arrival); the colossi (wading at the dock, walking the plain, specks
on the horizon from the spire, lit by lightning in the storm, a procession at dusk from the
balcony); the muted red floor line (the arrival hint, the red cloth on the shrine lanterns,
the spire's red warning lights, the red cord on the map banner).

## Route overview

```
Pier's End  <-  Dock (spawn)
                 -> Ferry Yard / Ferry House ........................ chapel door (S4) ....
                 -> Reed Shore                                                            :
                 -> Causeway      + up: Stonetop (optional view)                          :
                 -> Throat (down) + S1 freight lift, S2 awning drop                       :
                 -> Lamp Market   + door: Archive                                         :
                 -> Crane Yard    + up: Spire Lift -> Landing -> Seal Floor (arena)       :
                 -> Culvert                                                               :
                 -> Stormward     + S3 rope bridge                                        :
                 -> Segment (up)  + Storm Shelter, Bell Ledge                             :
                 -> Cloudbreak -> Chapel -> Rose Balcony                                  :
                                    :.............................. latch ...............:
```

Main line (left to right): Dock, Ferry House, Reed Shore, Causeway, Throat, Lamp Market, Crane
Yard, Culvert, Stormward, Segment, Chapel. Branches: Pier's End (left, rest), Stonetop (up,
optional view), the Throat (down into the hollow), Archive (a door), the Spire (up to the
arena). Shortcuts: the freight lift (market to causeway), the awning drop (causeway to market,
one way), the rope bridge (Stormward), the chapel door (chapel to ferry house).

## Regions and rooms

Sizes are width x height in H, then in screens (one screen = 16 x 9 H). Time is walking time
across at 2 H/s. "Vast" and "cozy" describe how big the space feels, "serene" and "storm" how
calm it is. Numbers in the first column match the map and the pacing chart in `layout-1.svg`.

### Region A: Ringwater (arrival). Refs: w03 ring over lake, with w01's colossus added

The hybrid Dex asked for. Everything that makes `ring-lake` work stays: the tilted ring
cropped by the frame, the sun in its hole, the light shaft to the water, the still lake with
per-row parallax, reflections of everything standing in it, sparkles, the crag spire, the dock.
What gets added is a colossus (the `colossus-plain` creature and walk) **wading through the far
shallows of the lake** at about depth 36, right to left, on a slow loop:

- Its legs stand in the water, so the layer mirrors about its own waterline
  (`reflect: waterY(36)`). The lake shows the pale body upside down, broken by the ripple
  shear, and the dark, wet lower legs as long dark streaks.
- Where a foot lands: a ring ripple and a thin spray column instead of the plain's dust
  billow; drips fall from a lifted foot back into the water with small ring ripples.
- Once per crossing it walks through the light shaft. For those few seconds the shaft lights
  its back, and the warm sparkle path in the water shows its reflection lit. This is the
  arrival's hero moment; it needs no player action.
- Mist in front of it (the horizon bank and low water mist) eats its far legs in steps, as in
  w01. Sound: a low thud and a long wash per step, felt more than heard.
- It walks behind the crag spire and in front of the far hills, so the ring stays the biggest
  thing and the colossus reads as weather. On screen it is about 5 to 6 H tall at depth 36,
  which makes it roughly 200 H tall in the world.

Resolution: at 1280 x 720 the scene gets twice the pixels in both directions (`ctx.u = 2`).
View-scaled things (ring, clouds, water rows, mist) get finer detail; character-scaled things
(dock, posts, suitcase, lantern) are authored in H and stay chunky. That contrast is the
megalophobia read: coarse, familiar things close, fine, huge things far.

| # | Room | Size | Screens | Walk | Purpose | Mood | Light and weather | Sound |
|---|---|---|---|---|---|---|---|---|
| 1 | **The Dock** (spawn) | 30 x 18 | 1.9 x 2.0 | 15 s | first view, scenery first | vast, serene | late afternoon, sun in the ring, warm shaft, still water | ambience only (water, wind, far colossus steps); the theme enters after about 40 s or once you walk a screen, over 8 s |
| 2 | **Pier's End** (left) | 12 x 9 | 0.75 x 1 | 6 s | the resting overlook | vast, serene, private | same, shaft seen side-on | theme continues, ducked |
| 3a | **Ferry Yard** | 12 x 9 | 0.75 x 1 | 6 s | the first right-hand reveal | open, homely | same, lamp on the house | theme continues |
| 3b | **Ferry House** (interior) | 14 x 6 | 0.9 x 0.67 | 7 s | account counter, first donation box, the sky door | cozy, serene | warm lamp and window light; the sky door throws cold daylight | theme continues, muffled through walls (low-pass, -8 dB); kettle, clock |

**Camera.** The Dock is framed low: player feet at about 80% of the picture (camera anchor
0.8), so the ring fills the top two thirds. Spawn is at the centre of the first frame, 8 H from
either edge of it. Nothing interactive is inside that frame. The muted red floor line starts
just right of the player and runs off to the right. Pier's End is about 13 H left of spawn
(about 6 s). The Ferry Yard begins just past the first frame's right edge.

**Props, Region A.**

| Prop | Where | States | Interaction and reason |
|---|---|---|---|
| Water | the lake, both rooms | ripples, splashes, reflections | footsteps on the dock boards drop tiny ripples below; a dash along the pier sprays; this is the ring-lake water with the colossus added to its reflection |
| Mooring posts | 4 along the dock, 0.8 H tall | idle, disturbed (sway), chipped | slash chips wood; ring ripples at their feet (already in ring-lake). Scale anchors in the first frame |
| Rope and buoys | between posts, 2 buoys | bob, sway when hit | verlet rope; hit a buoy and it bobs and rings the water |
| Moored boat | left of spawn, 2.2 H long | bob, rock when landed on | a platform that dips 0.1 H when you stand in it; nobody in it |
| Reeds | shore edges | bend when walked through, cut scatters | wind from your dash bends them |
| Pier lantern | end of the dock, 1.1 H | on, flicker | already lit when you arrive (someone keeps this place); a light source that rims you warm |
| Luggage | one suitcase on the dock, 0.4 H | idle, knocked over, tumbles | the ordinary object in the first frame that makes the ring huge; hit it and it falls flat, never breaks |
| Bench | Pier's End | idle, sit | E to sit: the camera eases out two steps of framing and holds; the one "do nothing" reward |
| Doors | Ferry House front door (1.25 H) and **the sky door** (inside, 1.25 H) | closed, opening, open; sky door: open onto sky / open onto chapel | front door: E to enter. Sky door: E opens it onto empty sky with the chapel window far away; before the latch is lifted a safe threshold and a rail stop you; after, it leads to the chapel narthex |
| Registry counter with bell and ledger | Ferry House | idle, bell rung, ledger open | E on the ledger opens the dex account panel (the real account state, same as the website). The bell rings and the clerk looks up. Moved here from the hollow because CANON puts the counter near the start |
| Donation box + donor plaque | Ferry House, by the window | idle, open, used (small light and chime) | E opens the donate panel (Ko-fi, MB Bank QR, amount slider). The plaque shows real top donors, empty when there are none |
| Signs | Ferry House: a painted board beside the counter listing the real products with a small spire mark | idle | E shows the product list with two plain choices: "download on the website" (scrolls down) or where the spire is. No invented products |
| Candles | one on the counter | lit, out, relit | hit it and it gutters; it relights after a moment |
| Hanging bell on a yoke | Ferry Yard, the ferry bell on a post | rest, swing, ring | slash it and it swings and rings across the water |
| Training dummy | Ferry Yard, a straw post | reacts to every hit type, never dies | the first place to try the sword, out of the first frame; no prompt |
| Crates and barrels | Ferry Yard | idle, disturbed, broken (wood splinters) | cargo waiting for the ferry; break and slowly restore |
| Lamp post | Ferry Yard gate | on, flicker, swing | sets the warm pool you walk into |
| Small things | moths around the pier lantern, dust motes in the ferry house, a loose paper on the counter | drift, flutter | life at small scale |

Proposed additions (not on the approved list yet): the clerk's **cup** (cold on the sill, later
carried), a **kettle on a small stove** in the ferry house, and a **latched** state for doors.

### Region B: the Causeway (the plain). Ref: w01 colossus plain

| # | Room | Size | Screens | Walk | Purpose | Mood | Light and weather | Sound |
|---|---|---|---|---|---|---|---|---|
| 4 | **Reed Shore** | 30 x 11 | 1.9 x 1.2 | 15 s | a gentle rise away from the lake | vast, serene | afternoon, the ring now behind you on the left, haze thickening | theme continues; wind rises; reeds |
| 5 | **The Causeway** | 80 x 16 | 5 x 1.8 | 40 s | the long walk with the colossus | the vastest outdoor space | overcast pale haze, slow cloud shadows, rare sheet lightning far off (the first hint of the storm) | theme at full; wind; colossus steps. Rooms 4 to 8 share one music transport |
| 6 | **Waymark Shrine** (inside 5) | 10 x 6 | 0.6 x 0.7 | 5 s | first shrine: rest, map banner, donation box | cozy pocket in a vast space | lantern light under a small roof | theme ducks 4 dB while you rest |
| 7 | **Stonetop** (optional, up) | 14 x 9, 16 H climb | 0.9 x 1, climb 1.8 | 20 s climb | a view: the colossus passes at eye level | vast, a little frightening | wind, haze, the colossus close enough to fill half the frame | music drops to wind alone while it passes, then returns |
| 8 | **The Ribs and the Footprint** (inside 5) | 28 x 9 | 1.75 x 1 | 14 s | walk under a half-buried ribcage, then down into an old footprint | cozy (shelter) inside vast | the rib shadows stripe the path; flowers grow in the footprint | wind drops inside the footprint; birds |

**Camera.** Anchor 0.75 on the causeway (lots of sky), 0.64 in the shrine and the footprint.
The colossus crosses on its loop behind the causeway (as in `colossus-plain`), and the rock lip
hides its feet near the right edge. The Stonetop view uses a fixed framing while you stand on
the top.

**Traversal.** Reed Shore rises 3.5 H over 30 H in steps of 0.25 H. The causeway is flat
with low breaks. Stonetop: standing stones as ledges, 1.2 to 1.5 H apart vertically
(double jumps), 16 H in total, falling only drops you to the stone below. The Footprint is a
2.5 H deep dip with a gentle slope in and a 0.9 H lip out (single jump).

**Props, Region B.**

| Prop | Where | States | Interaction and reason |
|---|---|---|---|
| Shrine lantern | Waymark Shrine, 1.0 H, red cloth tied on | out, lighting, on, flicker | E to rest: you light it, it becomes your respawn point and shows as lit on the map and from the chapel balcony |
| Offering bowl | Waymark Shrine | idle, rippled | holds rainwater; hit and it ripples. Why it's there: people leave small things for the lamplighters |
| Donation box + donor plaque | Waymark Shrine | idle, open, used | as in the ferry house |
| Map banner | Waymark Shrine, rod at 2.5 H, unrolled 2 x 1.4 H, red cord | rolled, cord cut, unrolling, hanging | slash the cord and it unrolls (cloth); E reads the full map. The cut stays cut in that save. The map shows the shrine route as a dotted line and lit shrines as points |
| Censer on a chain | hangs from the shrine's roof beam | swing, trail smoke | swings when hit; the smoke shows the wind |
| Bench | Waymark Shrine and Stonetop | idle, sit | sit to rest and look |
| Prayer flags on lines | along the causeway, across the Reed Shore path | sway, whip, tear when cut | wind-torn; they point the wind toward the storm you'll meet later |
| Standing stones | Stonetop climb, plus 3 along the causeway | idle, chipped, cracked | the climb's ledges; chips fly when hit, cracks spread, never break through |
| Colossus footprint craters | room 8, one big (walkable), two small in the far ground | static | scale made walkable: the dip is 10 H across |
| Bones half-buried | room 8, a ribcage arch 6 H tall | static, dust when hit | walk under it; the stripes of shadow make a room without walls |
| Grass and flowers | Reed Shore verges, inside the footprint | bend, cut scatters | flowers only inside the footprint: the cozy detail |
| Lamp posts | 3 along the Reed Shore | on, flicker, swing | the last lights of the settlement before the open plain |
| Destructible floor | the causeway stones | craters, scars, heals | Q and R leave marks that slowly reassemble |
| Small things | ash drifting on the causeway, birds (scene layer) | drift | |

### Region C: the Hollow. Ref: w04 amber foundry hollow

| # | Room | Size | Screens | Walk | Purpose | Mood | Light and weather | Sound |
|---|---|---|---|---|---|---|---|---|
| 9 | **The Throat** | 16 x 36 | 1 x 4 | about 35 s down the switchbacks | the descent: the hollow opens below you | vast, interior, first time sees the city | daylight at the top, amber haze deeper down, searchlights sweep the far wall | theme continues, wind fades into city hum as you go down |
| 10 | **Lamp Market** | 44 x 18 | 2.75 x 2 | 22 s | the inhabited hub; second shrine; the archive door | cozy and busy under something vast | warm lamps, stall light, furnace glow in the distance, steam | theme ducked under market ambience (voices far off, clinks, steam) |
| 11 | **The Archive** (interior) | 22 x 12 with a mezzanine | 1.4 x 1.3 | 11 s | documentation | coziest, quietest | still lamp light, dust in the light | **silence**: music fades out over 4 s; room tone, one clock, pages |
| 12 | **Crane Yard** | 24 x 12 | 1.5 x 1.3 | 12 s | the spire lift base, the culvert to the east | industrial, half vast | furnace light, sparks, searchlight passes | theme low; cranes, steam, distant hammering |

**Camera.** In the Throat the camera looks down (anchor 0.35) so the city is below you. In the
market, anchor 0.64 with the hollow's far wall and its bright opening behind. The archive is
smaller than two screens and the camera is clamped to the room with darkness beyond.

**Traversal.** The Throat is four switchback flights down the hollow's inner wall, stairs of
0.25 H, landings every 9 H. **Awning drop (shortcut, one way):** from the first landing you
can step off and fall through two market awnings, which bounce and tear, landing you in the
market in about 6 s. **Freight lift (shortcut):** a cage on the Throat's east wall between
the market and the Throat head. On the first visit it is chained at the top; the lever is in
the market. Pull it and the lift works both ways from then on (12 s ride). The archive
mezzanine is reached by a ladder-stair inside.

**Props, Region C.**

| Prop | Where | States | Interaction and reason |
|---|---|---|---|
| Hanging cables and chains | down the Throat, over the market | sway, swing when hit, spark (cables) | the hollow's wiring; give the vertical descent something moving |
| Cranes with swinging hooks | Throat head (one), Crane Yard (two) | slew, hoist, hook swings and settles | keyed motion on a loop; hit a hook and it pendulums |
| Market stalls with cloth awnings | Lamp Market, 4 stalls | idle, sway, bounced, torn (cloth), restoring | two of them are the awning drop's landing |
| Crates and barrels | market, Crane Yard | idle, broken, restoring | |
| Neon or holy-light signs | market (3), Crane Yard (1) | on, flicker, off | light sources that tint you; glyphs, no words except a small book mark by the archive door |
| Steam vents | market (1), Crane Yard (2) | idle, venting | a timed puff; walking through it hides you for a moment; pushes cloth |
| Sparking junction boxes | Crane Yard, Culvert mouth | idle, spark | a flash accent on the global gate; hit it and it sparks |
| Lamp posts | market street | on, flicker | |
| Shrine set (lantern, offering bowl, donation box + plaque) | **Market Shrine**, next to the archive door | as Waymark | the second rest point and donation box; placed beside the archive so the docs door is easy to find |
| Doors | **the archive door** (ordinary, 1.25 H, a small book mark and a lamp above it) | closed, opening, open | E to open. No puzzle, no prerequisite |
| Shelves and scroll racks | the archive, both floors | idle, disturbed (a scroll falls) | background props; hitting them is allowed but gentle (paper, not destruction) |
| Lectern with an open book | the archive's reading desk | idle, pages flutter | **E opens the documentation** (the real docs from `content/docs`), plain readable DOM |
| Dust motes | archive lamp light | drift | |
| Loose paper | archive floor, market | flutter when you pass | |
| Banners and tapestries | market (hanging between stalls) | sway, tear | |
| Destructible floor | market flagstones, yard plates | craters, scars, heals | metal plates dent and spark instead of cratering |
| Small things | moths at the market lamps, puddles by the vents | | |

Proposed addition: the freight lift's **lever and gate** (or treat it as a variant of the
spire's lift platform).

### Region D: the Spire (vertical branch up from the Crane Yard). Ref: w02 monolith planet

| # | Room | Size | Screens | Walk | Purpose | Mood | Light and weather | Sound |
|---|---|---|---|---|---|---|---|---|
| 13 | **Spire Lift** | 6 x 96 ride | 0.4 x 10.7 | 32 s at 3 H/s | the ride: dark shaft, then out through the hollow roof into open sky | vast, rising | shaft dark with warning lights passing; outside: thin high air, cloud sea below, the pale planet huge, the black spire leaning over you | the theme returns to full as you break out of the roof |
| 14 | **Spire Landing** | 18 x 8 | 1.1 x 0.9 | 9 s | shrine before the arena (respawn), practice | exposed, calm | cold blue, pennants whipping | theme; wind |
| 15 | **The Seal Floor** (arena) | 32 x 12 | 2 x 1.3 | 16 s | the downloads arena | grand and tense | planet light from the left, blue uplight from the seals, red warning lights | orchestral arena variant when the terminal wakes |

**Camera.** In the lift the camera holds the car at the bottom third and lets the spire and
the planet slide past. On the Seal Floor the camera is locked to the arena's two screens and
pulls to fit the whole floor when the terminal wakes.

**The arena flow (without a boss, for now).** The terminal wakes when you walk up to it. E
opens the product choice (real products only, from the live downloads list). Choosing one
starts the summoning: the floor seals light in sequence, a beam forms, a seal draws itself in
the air. That is where the warden will form. **Until wardens exist**, the summoning ends
with the seal holding and fading back, the terminal cooling down, and one honest line on the
terminal: the product's download is on the website below (it scrolls there). No fake fight,
no fake download.

**Props, Region D.**

| Prop | Where | States | Interaction and reason |
|---|---|---|---|
| Lift platform with cables and counterweight | the Spire Lift | at bottom, moving, at top; counterweight passes the other way | E on the call post; keyed motion with easing; the counterweight passing you halfway is the "how big is this" moment |
| Warning lights | every 12 H up the spire, on the landing rail, arena corners | on, blink (muted red) | the red ties back to the arrival floor line; seen from the causeway as a slow red blink on the spire |
| Shrine set (lantern, bowl, donation box + plaque) | **Spire Landing** | as Waymark | rest and respawn right next to the arena |
| Training dummy | Spire Landing, armour hung on a post | reacts, never dies | warm up before the arena |
| Wind-whipped pennants | landing and the arena's edge | whip, tear when cut | |
| **Boss terminal** | the Seal Floor, back wall, 1.4 H | dormant, woken (screen lights), summoning (beam and seal forming), cooling down | E to use; see the flow above |
| Arena floor seals | 5 across the Seal Floor | dark, lit in sequence, full, fading | driven by the terminal; light the room blue |
| Breakable pillars | 2 at the arena's sides, 5 H | chip, crack, crumble, restore | cover during fights later; slash-testable now |
| Broken armour pieces | scattered on the arena and landing | idle, knocked, skid | what's left of earlier wardens: tells you what happens here without text |
| Banners | two long ones behind the terminal | sway, tear | |
| Rubble | arena edges | settle | |
| Destructible floor | the whole arena | craters, scars, heals quickly | the arena resets between visits |

### Region E: the Stormward and the Segment. Refs: w01 plain and w03 cliffs, in storm

| # | Room | Size | Screens | Walk | Purpose | Mood | Light and weather | Sound |
|---|---|---|---|---|---|---|---|---|
| 16 | **The Culvert** | 28 x 8, rising 20 H | 1.75 x 0.9 | 16 s | leave the city; the weather starts before you see it | cozy-dark, uneasy | dripping, junction-box sparks, the first cold light ahead | theme fades out; drips, then rain heard through the tunnel mouth |
| 17 | **Stormward Shore** and the rope bridge | 48 x 18 | 3 x 2 | 24 s (40 s by the lower way) | open storm; the Segment ahead | vast, **storm** | rain, gusts, lightning in the cloud (the ring silhouetted in flashes), a colossus lit by one flash far out at sea | **no music**: rain, wind, thunder |
| 18 | **The Segment, lower hull and Hull Stair** | 36 wide x 28 rise | 2.25 x 3.1 | about 45 s climbing | climb a fallen piece of the ring | outside vast storm, inside close and dark | outside: rain slanting, wet metal glints; inside: dark, rain drumming overhead | storm outside, drumming and drips inside |
| 19 | **Storm Shelter** | 8 x 6 | 0.5 x 0.67 | 4 s | third shrine, halfway | the coziest room in the storm | candle light through a small cracked stained window | rain muffled; one low string pedal may enter here (to test) |
| 20 | **Bell Ledge** (upper hull) | 24 wide x 28 rise | 1.5 x 3.1 | about 35 s | the last climb, the storm bell | vast, storm at its peak | the densest rain, the closest lightning (inside the global flash limit) | storm; the bell |

**Camera.** Anchor 0.64, lookahead upward during the climb. Rain is a foreground layer that
never covers the player's outline.

**Traversal.**
- **Rope bridge (shortcut).** A deck hangs raised on a rope across an 8 H chasm. The first time,
  you go the lower way: down into a flooded cut (10 H below), wade through shin-deep water,
  up the other side on 0.9 H ledges. On the far side the rope is within reach: slash it and the
  rope separates, the post stays, the deck swings down across the chasm and becomes walkable.
  Permanent in that save.
- **The Segment** is a leaning slab. The route switches between the outer hull (storm, ledges
  1.2 to 1.5 H apart, double jumps) and the Hull Stair inside (stairs, dark, dry) three times,
  so the storm comes in bursts rather than one long slog.
- **The one dash gap** is on the Bell Ledge: 2.8 H across, with a ledge 3 H below it. Missing it
  costs you 10 seconds, not a life.
- Wind gusts push you about 0.1 H/s while airborne on the outer hull; never while standing.

**Props, Region E.**

| Prop | Where | States | Interaction and reason |
|---|---|---|---|
| Rope bridge | Stormward chasm | raised, rope cut, swinging down, lowered | proposed addition to the prop list (CANON already describes it); rope and deck as verlet cloth and a hinged plank chain |
| Water | the flooded cut, puddles everywhere, rain splashes | ripples, splashes | puddles ring with rain; footsteps splash |
| Prayer flags | Stormward shore, whipped flat | whip, tear | the same flags as the causeway, torn |
| Junction boxes | Culvert | spark | |
| Breakable pillars | Culvert supports (2) | chip, crack | |
| Rubble | Segment ledges | settle, fall when hit | small rocks roll off the edge into the storm |
| Hanging cables and chains | Segment hull (ring cabling torn out) | sway in the wind, swing | the ring's insides: tells you this is a piece of the ring |
| Shrine set (lantern, bowl, donation box + plaque) | **Storm Shelter** | as Waymark | rest halfway up |
| Candles and a candelabra | Storm Shelter | lit, flicker (draughts), out, relit | someone keeps them lit |
| Stained-glass window | Storm Shelter, one small cracked pane | whole, cracked, shattered, reassembling | colored light onto the floor; the first stained glass, a hint of the chapel |
| Hanging bell on a yoke | **the storm bell** at the Bell Ledge's top, 1.6 H | rest, swing, ring | slash it and it rings over the storm: the one sound that cuts through the weather |
| Destructible floor | Segment hull plates | dents, scars | |

### Region F: the Chapel of Light (the gallery). Refs: w03 light (ring and shaft), the ring's own architecture

| # | Room | Size | Screens | Walk | Purpose | Mood | Light and weather | Sound |
|---|---|---|---|---|---|---|---|---|
| 21 | **Cloudbreak** | 20 x 6 floor, 18 H of open sky | 1.25 x 2 | 10 s | step up out of the storm | the vastest calm | above the clouds, clear gold sunset, the storm a floor of cloud below you | **silence** for about 3 s (the storm cuts out), then wind only |
| 22 | **The Chapel**: narthex and nave | narthex 8 x 6, nave 32 x 14 | 0.5 x 0.67, 2 x 1.55 | 20 s | Dex's nine artworks, the catalogue, the latch | cozy and tall, luminous, serene | warm light through lancets and the rose window; colored patches on the floor that move as the sun sets | the theme **starts from its beginning** here (its built-in quiet breath, then the piano), close and intimate; ducks 6 dB while an artwork is open |
| 23 | **Rose Balcony** | 12 x 12 | 0.75 x 1.3 | 6 s | the view back over everything | vast, serene | dusk; the ring at eye level with the sun in its hole; the lake far below; your lit shrines as a line of lights; the colossi walking the horizon | theme continues |
| 24 | **The chapel door** into the Ferry House | door | none | 1 s | the loop closes | cozy | the ferry house at dusk, lamps on | the theme carries through the door without restarting |

**How the gallery works.** Nine frames in the nave, one per artwork, in manifest order,
along both walls between the lancet windows (four on the left, four on the right, one alone
at the end under the rose window). Each frame is about 2.4 x 1.35 H (the pictures are 16:9).
Walk up to a frame and E opens that one picture in a proper panel, at full quality, with
back/close and its alt text; left/right inside the panel goes to the neighbouring picture. The
**lectern with the open book** by the entrance is the separate catalogue action: E shows all
nine as a grid. The artworks are display only. They are never pixelated, lit, tinted or used as
scenery; how they appear inside the in-world frames is an open question below.

**Props, Region F.**

| Prop | Where | States | Interaction and reason |
|---|---|---|---|
| Frames for each artwork (x9) | nave walls | idle, focused (a faint glint sweep when you approach) | E inspects that artwork |
| Lectern with an open book | narthex | idle, pages flutter | E opens the catalogue of all nine |
| Rose window | end of the nave, 6 H across, framing the ring's hole and the sun | whole, cracked, shattered into shards, reassembling slowly | the biggest light source in the world; colored light rims you as you walk the nave. Breakable because everything glass is, and it always comes back |
| Stained-glass lancets | 8 narrow windows between the frames | whole, shattered, reassembling | colored patches on the floor that creep as the sun moves |
| Prayer candles in rows | under each frame | lit, gutter, out, relit | light sources; your dash wind makes them lean |
| Candelabras | two by the rose window | lit, flicker | |
| Hanging lanterns | down the nave on chains | sway, swing when hit | |
| Font with water | narthex | ripples | the calmest water in the world; rhymes with the lake |
| Pews and benches | the nave; **the clerk's bench** under the rose window with her cushion and dried flowers | idle, splinter (pews), sit | E on the clerk's bench: sit and look at the rose window |
| Censer on a chain | over the nave | swing, smoke | smoke shows the light shafts |
| Banners and tapestries | between lancets, plain cloth | sway, tear | |
| Doors | **the chapel door** (the ferry house's partner, same frame and chapel mark) | latched, closed, opening, open onto the ferry house | E lifts the latch (a physical lever, not unlocked by anything else); from then on it is a two-way door |
| Shrine set (lantern, bowl, donation box + plaque) | narthex | as Waymark | the last shrine; the lamp that closes the round |
| Bench | Rose Balcony | sit | sitting here is the ending shot if you want one |
| Grass, flowers, vines | vines over the chapel's outer wall and the balcony rail | bend, cut scatters | life that grew up here while it was cut off |
| Small things | dust in the colored light, moths at the candles | | |

## Content destinations and how you find them

CANON's wayfinding order is downloads, then donate, then illustrations, then documentation.
The website underneath is always one scroll away and reaches every file directly; the world
never stands in the way of a download.

| Destination | Where in the world | How you find it | First visit from spawn | Later visits |
|---|---|---|---|---|
| **Downloads** | the Seal Floor, top of the spire | the spire's red warning lights blink over the causeway; the ferry house product board points at it; the lift in the Crane Yard has the same mark | about 3 min (walk, Throat, market, lift) | about 2.5 min using the awning drop. The website stays the direct route |
| **Donate** | a box in the ferry house, then one at every shrine (6 in total) | the ferry house is the first building you reach; every lit lantern has a box beside it | about 15 s | the nearest shrine |
| **Illustrations** | the Chapel of Light | its warm window is visible through the sky door in the ferry house and on the far horizon from the causeway | about 5 min without the spire branch, the long way on purpose | about 20 s: through the chapel door in the ferry house, once you have lifted the latch |
| **Documentation** | the Archive, an ordinary door in the Lamp Market | right next to the market shrine, a lamp and a small book mark over the door | about 2 min | about 1.5 min using the awning drop; the freight lift is the quick way back up |
| **dex account** | the ferry house counter | the first building, near the start | about 15 s | same |
| **Map** | the banner at the Waymark Shrine | hanging by the first shrine lantern | about 45 s | read it again at the same spot |
| **Website** | everywhere | scroll down at any moment | instant | instant |

Other visitors' ghosts gather naturally at the shrines and on the Spire Landing, which are the
places people stop.

## Pacing

The route alternates on purpose: every vast space is followed by a small one, and the two
storms (the arena fight, the climb) each end in a quiet room. The chart in `layout-1.svg`
plots both along the gallery run (with the spire branch taken on the way). Values are design
intent on a 0 to 1 scale, not measurements.

| # | Beat | Vast (1) vs cozy (0) | Tense (1) vs calm (0) |
|---|---|---|---|
| 1 | Dock, arrival | 0.95 | 0.05 |
| 2 | Pier's End | 0.8 | 0 |
| 3 | Ferry Yard and Ferry House | 0.15 | 0.05 |
| 4 | Reed Shore | 0.6 | 0.1 |
| 5 | Causeway, colossus | 1.0 | 0.3 |
| 6 | Waymark Shrine | 0.45 | 0.05 |
| 7 | Stonetop (optional) | 0.95 | 0.35 |
| 8 | Ribs and Footprint | 0.4 | 0.25 |
| 9 | The Throat | 0.9 | 0.4 |
| 10 | Lamp Market | 0.45 | 0.15 |
| 11 | Archive | 0.05 | 0 |
| 12 | Crane Yard | 0.5 | 0.25 |
| 13 | Spire Lift | 1.0 | 0.5 |
| 14 | Spire Landing | 0.6 | 0.45 |
| 15 | Seal Floor (arena) | 0.8 | 0.9 |
| 16 | Culvert | 0.15 | 0.4 |
| 17 | Stormward and bridge | 0.85 | 0.75 |
| 18 | Segment, lower hull and Hull Stair | 0.6 | 0.8 |
| 19 | Storm Shelter | 0.1 | 0.3 |
| 20 | Bell Ledge | 0.9 | 0.9 |
| 21 | Cloudbreak | 1.0 | 0.1 |
| 22 | Chapel nave | 0.35 | 0 |
| 23 | Rose Balcony | 1.0 | 0.05 |
| 24 | Through the door, Ferry House | 0.1 | 0 |

## Music and ambience

The selected theme is the Suno "B" cue
(`legacy/site/public/audio/world-v1/suno-theme-b-v1/support.opus`, 83.77 s, with a built-in
2.65 s quiet breath at its head; Dex picked it for the grand, mystical phrase around 54 s).
The orchestral arena variant candidate is `legacy/site/public/audio/v2/arena-chamber-v1`
(strings and cello; still waiting on Dex's ears). Rules: ambience before music, music swells in
and never starts abruptly, rooms that belong together keep one transport running.

| State | What plays | Where |
|---|---|---|
| **ambience** | the room's own sound bed only | the first 40 s at the Dock; the Culvert's end; the whole storm |
| **theme** | B at room level, one transport from the Dock to the Crane Yard and the Spire | Reed Shore, Causeway, the Throat, Spire |
| **theme, muffled** | B low-passed and 8 dB down, as if through a wall | Ferry House |
| **theme, ducked** | B 4 to 6 dB under the room's ambience | shrines while resting, the Lamp Market, an open artwork panel |
| **silence** | music fades out over 4 s; only room tone | the Archive (reading), Cloudbreak's first seconds |
| **theme from the top** | B restarts from its beginning, so its quiet breath and the piano open the room | the Chapel, the only place the theme starts rather than continues, because the storm has already cleared the air |
| **arena** | the orchestral variant, crossfaded in when the terminal wakes, out over 6 s when it cools down | the Seal Floor |

## Light, weather and time of day along the route

One afternoon into dusk, walked forward: afternoon sun in the ring at the Dock, overcast haze
on the causeway with far sheet lightning, amber interior light in the hollow, thin cold light
and the pale planet on the spire, storm dusk on the Stormward and the Segment, clear gold
sunset above the clouds at the chapel, dusk in the ferry house window when you come back
through the door. Each region's light is fixed (it is the region's identity, not a clock), so
revisiting a place always looks the same. The one change you make is the lamps: every shrine
you rest at stays lit in your save.

## Build notes

- **What exists.** The four `/scenes/` prototypes are the background look of regions A (ring-
  lake), B (colossus-plain), C (amber-hollow) and D (monolith-planet). The lab has the player,
  the sword, the VFX and normal-map lighting. Neither has rooms, doors, lifts, interiors,
  weather or pixel-matter props yet.
- **New for this layout:** the colossus in the lake (a second instance of the colossus layer
  with a waterline reflection and ripple/spray feet instead of dust), a rain and gust layer, a
  storm lighting state for the Segment (lightning through the existing global flash gate), a
  room/door/lift transition system with camera zones (anchor, bounds, lookahead per room),
  and the Stormward and Chapel backgrounds (built from the ring-lake cliffs and ring GLSL,
  seen from above and in storm).
- **Scale.** Scenes currently render at 640 x 360 or 960 x 540 with a 136 px stand-in. At the
  locked 1280 x 720 with H = 80, view-scaled layers use `u = 2` and everything the player
  touches is authored in H.
- **Budget.** Room counts to build: 24 spaces, of which 7 interiors or pockets (Ferry House,
  Waymark Shrine, Footprint, Archive, Culvert, Storm Shelter, narthex) are small and cheap,
  and 5 are big vistas that reuse the four prototypes (Dock, Causeway, Throat and Market,
  Spire, Stormward).

## Open questions for Dex

1. The counter moves from the hollow (draft 1) to a ferry house near the start, because CANON
   wants it near the start. Good?
2. In-world artwork frames: show the real picture inside the frame at display quality (never
   pixelated or lit), or a closed veil that opens the panel when you press E?
3. The clerk: is one resident with a coffee-break story the right amount of people, plus a few
   unnamed market residents?
4. The storm has no music, only weather, so the chapel's theme lands harder. Or would you
   like a low string pedal in the storm shelter?
5. Proposed prop additions: door latch state, the clerk's cup and cushion, a kettle and stove,
   the rope bridge, the freight lift lever.
6. Until wardens exist, the arena's summon ends with the seal fading and a pointer to the
   website's download. Acceptable as the interim?
