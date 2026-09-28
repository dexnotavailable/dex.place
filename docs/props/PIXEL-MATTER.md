# Props as pixel matter (draft for discussion)

How props work on dex.place. Nothing here is built yet; the prop list gets agreed with Dex
first, then one lane builds the engine and later lanes build props.

## The idea

A prop is data, not a picture. There are no image files. Every pixel of a prop is a cell the
game owns, so any pixel can fade, move, break off, fall, glow or be carved away while the game
runs.

Each cell knows:

- its **material** (stone, glass, wood, iron, gold, cloth, wax, flame, foliage, ...),
- its **height** in the surface, which gives its **normal** for lighting,
- its **piece** (which part or chunk it belongs to),
- its **health** and **age** (for damage, fading, healing).

## How a prop is made

A prop is a short recipe in code:

- **Shapes:** rectangles, circles, polygons, strokes; each with a height profile (flat, rounded,
  bevelled, cylinder) so it shades like a real object.
- **Details:** grain, cracks, rivets, wear; small ornaments typed as text pixel grids inside the
  code, like ASCII art.
- **Parts:** separate pieces with their own pivot and layer (a bell and its yoke, a lamp housing and
  its glow, a banner and its rod).
- **Parameters:** size, wear, seed, variant. One recipe makes many variants, and every prop is sized
  from Rosace's height, so props regenerate correctly whatever height she ends at.

## How it looks

Props go through the same lighting as Rosace: per-pixel normals lit by the key light, effect
lights and rim light, then snapped to each material's 3–4 colour ramp (hue-shifted shadows), then
the same outline pass. They match her style by construction. The world palette stays muted so she
stays the brightest, clearest thing on screen.

## Layers

| Layer | What goes there |
|---|---|
| Far background | distant shapes, slow parallax |
| Background | walls, windows, props behind her |
| Middle | things at her depth; can be solid or platforms |
| Foreground | things in front of her, slight parallax |
| Light | glows, light shafts, flames (added light) |
| Decal | cracks, scorch marks, craters painted onto surfaces |

Parts of one prop can sit on different layers: a lamp post behind her with its glow on the light
layer, a chain hanging in front.

## States

Each prop has a small state machine. States change the cells; nothing swaps an image.

- Common: **idle → disturbed** (flash, shake, sway) **→ damaged** (cracks spread, chips fall)
  **→ broken** (pieces detach) **→ rubble → restoring → idle**.
- Special: lamp on / off / flicker; door closed / opening / open; bell rest / swing / ring;
  candle lit / out.

## Motion

- **Procedural:** flicker, sway in wind, bob, pulse.
- **Springs and pendulums:** things swing when hit and settle.
- **Ropes, chains and cloth** (verlet): banners, tapestries, rope bridges, hanging lanterns.
- **Keyed motion with easing:** doors, lifts, mechanisms.
- **Rotation that stays crisp:** turning parts use a pixel-art-safe rotation, so a swinging bell
  never goes blurry or jagged.

## Pixel effects

- **Dissolve / assemble:** pixels fade out or in through a dither pattern, or fly home one by one.
- **Disintegrate:** cells detach into drifting particles.
- **Burn edge, glint sweep** on metal and glass, **ripples** on water.

## Breaking things

- **Hit shapes:** point, slash line (along Rosace's actual swing arc), circle, cone.
- **Carving:** hits remove cells. On the floor this makes a **crater** with a raised rim; on stone
  it chips and cracks, and cracks spread by material.
- **Fracture:** a hit splits a part into chunks. Big chunks fall as small rigid bodies (gravity,
  bounce, spin, settle into rubble); small ones become single-pixel particles.
- **Material behaviour:** glass shatters into glinting shards, stone crumbles and leaves dust,
  wood splinters, metal dents and sparks, cloth tears along the cut, flame gutters out.
- **Debris keeps its real colours:** what flies off is the actual pixels that were there.
- **The floor is pixel matter too:** Q and R leave craters and slash scars on it, and it heals
  slowly (the pixels reassemble) so a room resets.

## How props talk to the game

- **Hits:** each prop reacts to hit type, damage, shape and direction.
- **Light:** lit props (candles, lamps, stained glass) feed the same light list as effects, so
  they rim-light Rosace in their colour.
- **Collision:** solid, platform, none or trigger.
- **Wind:** her dash and spins push cloth, grass and flames.
- **Sound cues** per state change.
- **A reason:** every prop records why it's there (CANON).

## Performance

Undisturbed cells are cached into textures and cost nothing. Only disturbed regions simulate.
Particles have a cap, and each room has a budget.

## Workflow

1. **Engine lane** (once): the pixel matter engine, a sandbox page at `/props/` (hit tool with
   slash / heavy / Q / R shapes, state buttons, layer and normal views, slow motion, draggable
   light) and 2–3 proof props.
2. **Prop lanes** (per agreed prop): write the recipe, record the sandbox, one critic checks
   readability at game size, style match with Rosace, states, motion, physics feel and reason,
   one fix round.
3. **Into `/lab`:** place them on the map and tune live with Dex.

## Prop list (draft, growing)

Dex's asks first, then the starting list, then expansions tied to the areas in
`docs/world/MAP-AND-STORY.md`.

**Must have (Dex):**

- **Boss terminal:** summons a warden. States: dormant, woken (screen lights up), summoning (beam and
  seal forming), cooling down. E to use.
- **Donation box:** at every shrine. States: idle, E to open the donate panel, a small light and chime
  when used; a top-donor plaque beside it.
- **Map banner:** rolled on a rod, held by a cord. Slash the cord and it unrolls (cloth physics), then
  E to read the full map. The cut stays cut.

**Starting list:**

- Stained-glass windows (shatter into shards, colored light; reassemble slowly)
- Candelabras and candles (flicker, light source, gutter out when hit, relight)
- Hanging bell on a yoke (swings when hit, rings, settles)
- Banners and tapestries (cloth, sway, tear when cut)
- Pews and benches (splinter)
- Lectern with an open book (pages flutter)
- Censer on a chain (swings, trails smoke)
- Lamp posts (housing and glow separate, flicker, swing)
- Doors (closed, opening, open)
- Signs, luggage
- Training dummy (reacts to every hit type, never dies)
- Breakable pillars (chip, crack, crumble)
- Grass, flowers, vines (bend when walked through or swung near; cut scatters)
- Destructible floor (craters, scars; heals), rubble, water (ripples, splashes, reflections)

**Expansions by area:**

- **Dock and ring:** mooring posts, rope and buoys on the water, a small moored boat that bobs, reeds, a
  pier lantern.
- **Plain:** shrine (lantern, offering bowl, donation box, map banner), wind-torn prayer flags on lines,
  standing stones, colossus footprint craters, bones of something huge half-buried.
- **Hollow:** hanging cables and chains, cranes with swinging hooks, sparking junction boxes, steam vents,
  market stalls with cloth awnings, crates and barrels, flickering neon or holy-light signs, the registry
  counter with a bell and ledger, the archive door, shelves and scroll racks, dust motes in lamp light.
- **Spire:** lift platform with cables and counterweight, warning lights, the boss terminal, arena
  floor seals that glow when a warden forms, broken armour pieces, wind-whipped pennants.
- **Chapel and gallery:** easels or frames for each artwork (E to inspect), a rose window, prayer
  candles in rows, a font with water, hanging lanterns, a bench to sit and look.
- **Everywhere, small:** dust and ash that drifts, moths around lights, puddles, loose paper.

## Open questions for Dex

- The prop list, and which world it's for (the lab only, or the real world's theme).
- How much is breakable: everything, or chosen props?
- Do craters and breakage heal, persist for the visit, or persist in a save?
- Which props are interactive (E) and which are only physical?
