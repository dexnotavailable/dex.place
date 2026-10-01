# World runtime (`/world/`)

The engine the whole world runs on: the locked scale, the presenter, rooms as data with
streaming, the camera and its modes, the lab's player at world scale, rides, wading and sitting,
weather and time, ambient life, the music state machine, interaction and panels, pixel matter
(through the adapter), the save, the story and sound hooks, the travel-time logger, debug and
touch. Phase 2 runs **the round**: the authored regions covering all 21 spaces of
[`WORLD-PLAN.md`](WORLD-PLAN.md) section 3, walkable end to end, with the four shortcuts. The
original 3-room test world (arrival, plain, house) is kept at `?world=test`. Mobs and bosses are
out of scope; the arena hooks (terminal states, arena music, the arena clamp, combat zoom) are in.

Status marks: **proven** (built and checked in captures), **in progress**, **proposed**.

## Phase 2 candidate, September 30

Recovered from cloud world commit `24b8f75` and the matching PC snapshot, isolated from
the PC's uncommitted character work. The authored rooms, composition, controls and motion
are preserved. The current release record is [`RELEASE-20260930.md`](RELEASE-20260930.md).
The historical lane results below belong to their recorded runs; they are not a current
Safari, Samsung, laptop or listening approval.

The recovered cross-lane source includes S1's entry/rest patch, D1's muffle ramp, the Blade
audio cut and all lamp points, subject lighting isolated from lightning, summon framing,
product documentation bays, the build-time sprite manifest probe, the seated stand-in and
the rebuild/setRest story API. Independent source review found and fixed two additional
issues: standing now resets a kit bench's seated state, and `blade:cleared` stops the storm
driver's sound cues even while visual rain is still easing. Source probes cover both.
Normal/test room-graph selection also prevents a saved phase 1 rest from stranding a returning
visitor in the legacy test world, while preserving the old save for rollback.

The round, sound and ship-fix recorders now produce failure verdicts. CPU/SwiftShader runs
are source verification; delivery's D3D and real-device runs provide the hardware boundaries.
Current CPU closure passes old-rest migration/save preservation and the separate 11-ledge
Stonetop climb. Verifier cleanup awaits its own Windows process trees, tested with an actual
Node descendant. Original replay errors/count correction and five navigation aborts remain
recorded; see the release record for exact proof paths and limits.

## Run it

```
npx vite --port 24000 --strictPort --host 127.0.0.1      # W0's ports: 24000-24099
sh src/world/tools/restart-capture.sh 24001              # capture-only server (no HMR, no watching)
```

Open `http://127.0.0.1:24000/world/`. `world/index.html` is a build input and `npm run build`
writes `dist/world/index.html`. Build inputs remain owned by the shared integration. The capture
server (`src/world/tools/vite.capture.config.mjs`) keeps other lanes' edits from reloading a page
mid-run; restart it after your own edits.

| Input | Does |
|---|---|
| Enter / tap / click (first) | the one Enter action: control, and sound starts in its saved state |
| A D / arrows | move; W / Up / Space jump (hold for height, again in the air for the double jump) |
| S / Down + jump | drop through a one-way platform |
| J / left click, K / Shift / right click, Q, R | the lab's moveset (M1 string, dash, skill, ultimate) |
| E / Enter (after start) | use the nearest usable thing (a small key glyph shows over her head at her interaction point, so it stays put when the prop changes state) |
| M, the speaker top right | sound on / off (saved) |
| backquote | debug overlay (fps, scale, room, area, camera mode, streaming, weather, sound, save, travel) + boxes |
| scroll down | the world closes like a curtain and waits; the website is underneath |

URL options: `?room=<id>&spawn=<id>` (wins over the saved place and rest place), `?world=test` (the old
test world), `?debug`, `?manual` (no real-time loop; drive it from `window.__world`:
`advance(n)`, `press(a)`, `release(a)`, `begin()`, `use()`, `teleport(room, spawn)`,
`place(x, y?)`, `closeup(on)`, `state()`), `?mute`, `?fresh` (forget the save), `?go` (skip the
Enter gate, for automation).

## The locked scale (proven)

One source of truth for the numbers: `src/scenes/engine/scale.ts` (view 1280x720, player H 80,
close-up 144, the presentation rule). `src/world/config.ts` names them for the world and adds
what only the runtime needs (camera framing, bars, step heights, streaming depth). World
geometry is authored in H through `h(n)`.

| | |
|---|---|
| World view (design) | 1280 x 720 world px: what scenes and rooms are composed in |
| Frame (2026-10-01, camera lane) | The frame's HEIGHT is fixed at 864; its WIDTH follows the window (`frameWidthFor`, `config.ts` `FRAME_W`: 1280..3072 in steps of 8: 16:9 1536, 21:9 2016, 16:10 1384, 3:2 1296). The view extends sideways, never stretches, and the scale comes from the window height, so there are no black side borders; windows narrower than 1280:864 letterbox top and bottom only, ultrawides past 32:9 keep pillars; the touch rails never reserve black gutters (the picture runs full width under the buttons, `main.ts`). Outside the view is the design view's framing (`ZOOM.exterior` 1.2, player 11% of the view), inside `ZOOM.interior` 1.45 (max 1.8). Attack punch-in, the ult_r zoom and the running look-ahead live in `camera.ts` (`CAMERA.punch`, `CAMERA.ult`, `CAMERA.lookRun`). Earlier: 1536 x 864 world px (`config.ts` `FRAME`, Dex 2026-10-01: "foreground zoom further, the character slightly smaller; indoors could use zoom"). Outside, the whole frame shows (H is ~9% of its height); inside, `viewZoom` zooms in about its centre (see Frame and zoom below) |
| Player | H = 80 px (~9% of the frame outside, ~11% at the design framing; the old site's hero was ~6%) |
| Close-up | 144 px render for combat zoom, cut-ins, portraits (`CLOSEUP_ZOOM` = 1.8) |
| Presentation | `presentRect()`: whole-number nearest when it fills the window (1440p: 2x, 4K: 3x); otherwise sharp-bilinear at the exact fit (1080p: 1.5x; phone landscape 2532x1170: 1.625x). Never plain bilinear. |
| Bars | 0.03 of the view height per bar exploring, up to 0.085 in cinematic zones |
| Reach (measured, `tools/reach.mjs`) | run 2.0 H/s; single jump 1.02 H up, **1.30 H across** at a run; jump + double 1.70 H up, 2.27 H across; jump + double + air dash 3.17 H across; ground dash 1.14 H |
| Steps | auto step-up 0.26 H, stick-to-steps 0.3 H |

**One source (folded 2026-09-29, P0):** `src/scenes/engine/scale.ts` holds the numbers;
`src/pixel/scale.ts` and this runtime's `config.ts` both derive from it.

The player's data is authored at 96 px (the lab stand-in and MOVESET). `player/scale.ts` scales
hitboxes, hurtboxes, root motion, event offsets, knockback, shake, effect sizes (the VFX library)
and the tuning (speeds, accelerations, jump velocities and gravity together, so jump heights stay
the same in H) by 80/96. Timings never scale. The stand-in is **redrawn**, not resampled, at 80
and 144 (`player/standin.ts`: a PixBuf that scales every shape it is given). A pipeline export at
`/world/character/manifest.json` (80 px) and `/world/character-closeup/manifest.json` (144 px) in
the `dex.sprite/1` contract replaces the stand-in with no code change.

## Frame (proven)

```
reflection  backdrop layers mirrored (their own waterlines) + the world's reflecting sprites
            (terrain, props flagged reflect, the player) mirrored about the room's waterline
main        backdrop back pass -> far/back props + pixel far/bg -> terrain, decals -> middle
            props + pixel mid/decal (+ debris) -> effects (back) -> player -> effects (front) ->
            front props + pixel fg -> front terrain -> light layer + pixel light, glows and
            additive particles -> ambient -> backdrop front pass -> prompt, HUD, debug
close-up    when the combat zoom is on: the world is zoomed 1.8x and the player and her
            effects are drawn again from the 144 px bake at native pixel size on top
present     scale rule, bars, zoom punch, impact frames, fades (dithered per world pixel)
```

One WebGL2 context. `render/renderer.ts` is the lab's renderer (same sprite and VFX shaders,
same lighting: key, effect lights, rim) resized and extended with a draw transform (zoom about a
focus, mirror about a row) and the close-up overlay target. `render/presenter.ts` does the scale
rule with four texel fetches (exact nearest-to-next-multiple then linear).

## Backdrops (proven)

`backdrop/engine.ts` forks the scene engine so any `/scenes/` scene is a room backdrop,
unchanged: shared context, the world camera (x 0..span at depth 1, so the player plane pans 1:1),
optional vertical parallax (`vertical`, 0 for rooms one view tall with water, 1 inside), passes
split at the scene's figure layer (layers after it draw in front of the world), weather uniforms
(`uWx`, `uWx2`, `uBolt`, `uCamY`), lightning merged into the scene's flash lights, a flat
multiply blend for storm grading. Its `MAIN` is derived from the scene engine's at load (it throws
a clear error if that ever changes shape), so reflection fades and other scene-engine changes
carry over.

Shaders compile in the background (`KHR_parallel_shader_compile`): layers appear as their
programs finish, the first room stays black until it is ready (honest loading, no fake wait),
and a door or edge stays dark until the next room is ready. **Measured:** the arrival scene's
shaders take ~9 s to compile under ANGLE/D3D11 in headless Edge; the CPU build is 0.2-0.5 s per
room. Neighbours compile while you play. Cutting shader size is the scenes lane's lever.

Backdrops in use: the grey-box's `backdrop/blockout.ts` (one small stepped sky or interior wash
per mood with a far survey grid: morning, overcast, amber, storm, dusk, evening, lodge, archive,
tile, chapel; rooms with the same mood share the same shader source); the test world's
`scenes/arrival.ts`, `scenes/colossus-plain.ts` and `backdrop/interior.ts`.

## The round: grey-box (proven, W0)

`rooms/_blockout/` holds all 21 rooms of WORLD-PLAN section 3 at the plan's world coordinates
(`_build.ts` authors in H: x west to east, y as elevation with the lake at 0), plus `S2`, the
ferry ride. Terrain art `block` is flat grey with a grid line every H and a tick every half H on
its lip, so gaps and ledges read in H in any capture. Mechanisms are real props: doors, the latch
pair of the sky door, levers, shrines, lamp posts, the rope bridge, the crane hook, the spire lift
with its express stop, the ferry, benches. The proven pixel-matter services run through the
adapter: a donation box and donor plaque at the lodge and every shrine, the map banner, the boss
terminal, a candelabra and stained glass in the storm alcove, the font on the porch.

| File | Rooms |
|---|---|
| `a-ringwater.ts` | A0 Pier's End, A1 the Dock (spawn), A2 Cliff Stair, A3 Keeper's Lodge (two floors), A4 Keeper's Yard (shrine 1, map banner), S2 the ferry |
| `b-plain.ts` | B1 Reed Shallows (wade, rope bridge), B2 the Causeway with **B3 the Bus Shelter (shrine 2) and B4 Stonetop as areas inside it**, B5 Hollow Mouth (culvert lever, crane hook) |
| `c-hollow.ts` | C1 Foundry Market (shrine 3, walkway), C2 the Archive, C3 Lift Foot |
| `d-spire.ts` | D1 Lift Ride, D2 Outer Climb (shrine 4 in the storm alcove), D3 the Crown (terminal, express lever), D4 the Blade |
| `e-chapel.ts` | E1 Pilgrim Path (shrine 5, the ring bay), E2 Chapel Porch (shrine 6), E3 Chapel of Light (9 frames, catalogue, rose crank), E4 Bell Stair and Balcony (the latch) |

Deviations from the plan, each so the round stays walkable at the standard step (0.2 x 0.3 H):
**E4 is 28 x 14 H** (12 H of stairs need 18 H of run without a switchback; a region lane can
fold it); **the A3 loft is 3.4 H** tall (plan: 4) so the lodge, floor to ceiling, fits one locked
screen above the bars; several rooms are a little taller than the plan so the camera anchor holds
at their top and bottom floors; B3 and B4 are areas of B2 rather than rooms of their own.

**Region lanes replace rooms by id.** Put rooms in `src/world/rooms/<region>/` (any file, any
export shape; `_`-prefixed files and folders are helpers); `rooms/registry.ts` finds every
`RoomDef` by glob, and a room whose id matches a grey-box room (`A0` ... `E4`, `S2`) replaces it.
Stub-engine recipes exported next to the rooms become placeable by name. Nobody edits `main.ts`.

## Rooms (proven)

`room/types.ts` is the data model. A room has: size (in H), a world origin (in H, for the map
and the travel log), a region, a backdrop spec, sprite lighting, terrain pieces (solid, one-way
or stair treads; art `stone`, `rock`, `wood`, `earth`, `plaster`, `block`, or `none` for
collision only), spawns (optionally putting a carrier at a stop and sending it on), edge exits
(each in a y band, so one edge can hold several), props (recipe + id + params, the engine, flip,
reflected), doors (prop id → room/spawn with an optional flag set on the way through, or → a
panel), framing zones and vista holds, a camera mode, areas (a part with its own camera, sound,
roof), shallow water, triggers (set a flag or a session flag, or signal a prop), pits, a weather
program and a conditional one (`weatherIf`: the Blade stays clear after `blade:cleared`), an
underground flag, sound, ambient life, a waterline, neighbours, a pit line.

- **Collision** (`room/collision.ts`): implements what the lab Player calls on its World (move,
  supported, groundAt, bounds). Solids, one-way platforms (down + jump drops through; the Player
  gets a proxied input so "down" only means that on a one-way), movers (a lift carries you),
  readable stairs, open edge bands where exits are. **Stair treads** (`stair: true` one-ways) are
  stairs you can walk under (the lodge's loft stair over its ground floor, the market walkway's
  stairs over the street): standing on a tread you walk up the next and stick to them going
  down; from the floor you take the stair with a small jump, so walking past underneath never
  climbs by accident.
- **Transitions**: edge exits and doors fade out, switch rooms (building if needed), place you at
  the spawn, fade in once the room is ready. Pits (the room's line, or pit zones such as the water
  under a gap) fade and return you to the last safe ground.
- **Shortcuts**: a door with `latch` is locked from its far side (it rattles); the same door
  prop with `latchSide` releases the latch (saved) and opens. The sky door (`latch:sky-door`)
  opens from the E4 balcony and then works both ways. Room entry closes every door
  (`Door.close()`); a latched door seen from the barred side goes back to locked and only
  `refresh()` unlocks it, when the flag is in the save (a fresh save keeps S4 barred).
- **Frozen controls** (a door, a transition, a ride, a rest, sitting, the intro): the player's
  input proxy reads nothing while frozen, but keys that are still physically held stay held, so a
  key held through a door or an edge exit keeps walking afterwards. Panels, sitting down, the
  site coming up and window blur still release every key.
- **Streaming** (`room/room.ts` `RoomStream`): the current room and rooms within
  `STREAM.keepDepth` doors are built (neighbours in calm frames, shaders in the background);
  the rest are disposed, pixel-matter textures included. Only the current room simulates. A room
  is rebuilt from fresh data (story hooks may adjust it) when it comes back.
- **Camera** (`room/camera.ts`), per room and per area: **locked** (the room or area fits one
  screen; a locked area frames itself where you walk in), **rail** (follows x; an optional
  vertical slack in H before the row moves), **free** (both axes, look-ahead, a vertical
  look-ahead in H for the downhill rooms); a per-room **anchor** (feet at 0.8 on the dock, 0.64 in
  ordinary rooms, 0.35 in the Hollow Mouth, 0.5 on the Pilgrim Path); **vista holds** (a zone
  with `hold: 2` takes over only after 2 s standing still, easing in whole pixels, no zoom); the
  **arena clamp** while the terminal summons and holds its seal; an **override** (sitting). The
  view zoom is per room or area (`RoomCamera.zoom`, below), not per moment. Framing zones, shake,
  the zoom punch and `setCloseup()` (the 1.8x combat zoom that hands the player to the 144 px
  render) are as before, on top of it.

## Frame and zoom (2026-10-01)

- **Frame** (`config.ts` `FRAME`, 1536 x 864): the world target, the pixel-matter renderer and
  the reflection targets are this size. `camera.viewZoom` 1 shows all of it; more zooms in about
  its centre in the presenter (sharp-bilinear like the rest). The camera clamps and frames with
  the zoomed view (`camera.vw`, `camera.vh`); `camera.view()` is the frame's top-left.
- **Zoom rule** (`game.ts` `zoomFor`, `ZOOM`): outside 1; interiors (`weather.interior`) and rooms
  with `camera.zoom: "fit"` zoom in until the room fills the frame, at least 1.2 (the old
  1280 x 720 framing) and at most 1.5. Explicit numbers win (D1's ride keeps 1.2). Areas can set
  their own; the zoom eases between areas and snaps on a room change (behind the door fade). A
  short screen (CSS height up to 540: a phone held sideways) keeps 1.2 everywhere, so she stays
  readable there. Rooms shorter than the zoomed view sit on the frame's bottom outside (the extra
  is sky) and centre inside.
- **Backdrops keep their composition.** A scene is still built and composed for 1280 x 720 (its
  `ctx.W`, `ctx.H`, `ctx.span`); `camera.design()` says where the old design camera stands for
  this frame (clamped exactly as before, so player-plane layers stay on the collision) and where
  that design view sits in the frame (`Backdrop.setCamera(x, y, at)`). The shaders evaluate `s`
  over the whole frame (`uFrame`), so procedural layers simply continue past the old edges, and
  `ctx.panWidth` is `MARGIN` wider on each side so pan textures do too. Layers a scene builds at
  exactly the design width need their own margin (A2's cliff, A4's yard: `_cliff.ts` `EDGE`).
  Reflections sample the frame-sized reflection target through `reflPx()` (`glsl.ts` `LIB_REFL`).
- **Cost**: the frame has 1.44x the pixels. Headless Edge on the laptop's Intel Arc 140V
  (uncapped): A1 162 -> 146 fps, B2 142 -> 126, C1 195 -> 160, E3 587 -> 476.
- **Contact shadows** (`game.ts` `drawContactShadows`, `renderer.shade()`): a stepped band of
  multiply-darkened pixels on the floor line under every grounded prop (pixel matter and stub)
  and the player, so nothing sits on the floor like a sticker. A true darken (not dithered),
  drawn after the terrain and before the props.
- **Ground painter** (`src/scenes/engine/ground.ts`): `rockInfo`/`paintGround`/`paintSteps` paint
  near ground as lit rock facets (a stretched Voronoi, a bevel toward the key light, open cracks
  on some borders, big masses carrying their own tone, calming with depth) under a grass cap
  with blades and overhangs, stones bedded in the soil, and cut stone steps with joints and
  chipped corners. Used by A2's cliff and A4's yard (`_cliff.ts`), B1's embankment
  (`reed-shallows/land.ts`) and B2's crater and Stonetop (`causeway/road.ts`).
- **Rides and moving floors** (`props/kit.ts` `carrier`): stops with eased keyed motion at an
  average speed in H/s, per-stop speeds (the express), stops that need a flag (`lever:express`),
  E to go on, `call:<i>` / `go:<i>` signals from levers, spawns that put the carrier at a stop and
  send it on. While it moves it holds the rider's controls. The crane hook is 32 H in 10 s, the
  spire lift 72 H in 16 s to the break and 108 H in 18 s express, the ferry 28.6 H in 16 s.
- **Wading**: `water` zones slow you to half the run speed while your feet are below the
  surface, with water footsteps. **Sitting**: E on a bench sits you; the camera holds (on the
  room's vista near the bench if there is one), the prompt and HUD hide, the music dips 4 dB; any
  move stands you up.
- **Terrain art** (`room/terrain.ts`): lit albedo + normal slabs in the room's ramp; rock and
  earth rise in an irregular rim above their collision line; `block` is the grey-box.

## Props (stub engine and pixel matter through the adapter, proven)

`props-api.ts` is the interface the runtime talks to (matching PIXEL-MATTER: recipe, reason,
states, layers, collision, hit, use, lights, wind pushes, sound, save, plus `signal` / `receive`
between props, session flags and the carrier calls). `props/stub.ts` implements it with a small
cell rasteriser, and `props/recipes.ts` has the test world's props (lantern post, donation box,
donor plaque, map banner, bench, door, grass and reeds, piling, buoy, standing stone, prayer
flags, bones, offering bowl, the red floor line, registry counter with bell, lectern, bookshelf,
candles, hanging lamp, boss terminal, artwork frame, crate, lift, house front). Doors take `w` /
`h` in H (big doors 2.5 x 4); lecterns take a `panel` (the chapel's opens the catalogue); artwork
frames take the plan's sizes; benches sit.

`props/kit.ts` adds the round's mechanisms: `shrine` (out / lit; E rests: `shrine:N`, the rest
place, the lamps), `lamp-post` (dark until its shrine is lit, then on in sequence), `lever` (a
flag, a signal, permanent or not), `rope-bridge` (slash the rope from the east bank; the deck
swings down and stays down: `cut:<id>`), `carrier`, `boat` (the ferry: asleep until
`lever:culvert`, then a door onto the ride).

**The pixel-matter adapter** (`pixel/adapter.ts`, proven in the round): one `PixelWorld` per
room, built with it and freed with it (`releaseWorld`). A placement picks its engine: `engine:
"pixel"` asks the pixel registry (`src/pixel/registry.ts`: every recipe under
`src/pixel/props/**`, the kit and the region folders, looked up forgivingly, so `map-banner`
finds `mapBanner`); otherwise the runtime's stub wins when it knows the name (its doors, levers
and lifts carry the round's mechanics), then pixel matter. Each tick the adapter steps the world
with the room's wind and the player's dash pushes, turns her moves into the engine's preset hit
shapes (slash, heavy, Q and R once per clip, the dash's wind), reads its colliders into the
room's collision (**pixel matter never blocks the way**: its solids become platform tops; walls
are terrain), merges its lights into the sprite lights (and the world's lights into its cells),
maps its events (`sound`, `panel`, `shake`, `summon`, `state`, and the kit's host events `door`
/ `lever` / `rest` / `sit` / `stand` onto the same mechanics as the stub props, with
`params.flag` naming the world flag), and mirrors its persisted keys into the save (`cut` →
`cut:<id>`; a placement's world flag sets the kit prop's own key back on the next build). The
room's terrain is the pixel world's ground, so a cut cord and debris come to rest on it.

**Drawing:** a `PixelRenderer` made on the world's canvas shares the one WebGL2 context; its
cell, glow and particle programs draw straight into the world target between the world's layers.
It uses the renderer's per-layer internals through one typed seam checked at start-up. **Ask for
P0:** a public "draw these layers into the bound target" call. Known limits: pixel parts are not
drawn in the reflection pass, and `fg` / `far` parallax is computed from the room's origin (fine
one screen wide; wide rooms want it about the prop).

**The terminal's interim** (no wardens yet): woken, summoning and the held seal bring the arena
music in (3 s); the camera clamps to the arena and the close-up zoom runs; 2.5 s after the seal
holds, the terminal cools down and the panel says plainly that no warden answers yet and that
downloads are direct on the website, with the link. No fake fight, no fake download.

## Weather and time (proven)

`weather.ts`: states serene, mist, overcast, rain, storm, after (the clearing). A room's program
is one state or zones along its width, blended at the edges and eased over seconds. Interiors
keep the outdoor weather: you see it in the windows and hear it through the walls; roofed areas
(the shelter, the alcove) keep the rain off. Outputs: layer uniforms, rain streaks, a mist band,
a flat storm grade, sky flashes and stepped bolts, lightning lights on the backdrop and a strong
point light over the strike (it rims the player), sprite lighting, wind with gusts for cloth,
grass, flags and flames. Lightning asks the global flash gate (at most 3 starts in any second; 1
per 2 s in reduced motion) and thunder follows after a distance delay. Time of day (day / dusk /
night) is a room property that scales the light.

The test world's beat (after about 40 s indoors during the storm the plain clears for the visit)
is now a room option (`stormPasses`, set only on the test house). **The round keeps its
weather**: the storm belongs to the spire. **Underground** rooms (the Hollow) have no sky and no
rain; thunder reaches them only as a far rumble every 25 to 55 s.

## Ambient life (proven, simple)

`ambient.ts`: dust in the player plane, moths around warm lights that are on, rain splashes on
the ground in view (not under roofs or underground). The backdrops carry birds, motes in light,
distant lights and the colossus's gulls. Each is a hook that pixel-matter particles can replace.

## Sound (content in, machine and content proven; waiting for Dex's ears)

`audio.ts` is the music state machine of WORLD-PLAN section 9. A room (or area) says what it
wants in `audio`; the game (`musicLevel`, every 12 ticks) drives it:

| State | Room data | Proven in the round (`round.json`, `audioHistory`) |
|---|---|---|
| Ambience first | A1 `enter: { wait: 12, move: true }` | the theme enters 12 s after Enter and not before you move |
| Theme swell | `music: "theme"` | one entry, a 9 s swell after a quiet gap |
| Muffled | `muffle: 1` (A3, C1, C3) | a low-pass on the same playhead, -9 dB; it never restarts |
| Opening up | D1 `muffle: { y0, y1, from: 1, to: 0 }` | the muffle opens along the lift's height |
| Ducked | `duck` (B3: 4 dB); resting 5 dB; sitting 4 dB; an artwork panel 6 dB | |
| Wind alone | a hook calls `api.duck("colossus", dB)` | (the region lane drives it from the colossus) |
| Silence | C2 `silent: true` | level 0 over 4 s, playhead kept |
| Storm | `music: "none"` (D2, D3 idle) | a 4 s fade out |
| Arena | the terminal's states | in over 3 s; back to the storm over 6 s |
| Grand passage | D4 area `enter: { at: 48, rise: 5, delay: 2 }` | the theme enters at 48 s under a 5 s swell after 2 s of silence, and carries on into E1 |
| From the top | E3 `fromTop: true` | the only restart; E4 carries it on |
| Rest, then swell | the theme doesn't loop | when it ends: 45 to 90 s of ambience, then it swells in from its start |

Rain and wind are synthesised from filtered noise at weather levels and muffled indoors; thunder
is a low rumble after the flash (the runtime's own, under the beds).

**The content (lane S1, 2026-09-29).** `src/world/sound/tables.ts` is a `SoundHooks` export
found by `hooks.ts`; it moves `AUDIO_BASE` from `/legacy/site/public/audio` (never served in
production) to **`/audio/world`** (`public/audio/world/`, 15 MB) and supplies:

- **Music:** `music/theme-b` (Dex's Suno "B", bytes unchanged, its `ATTRIBUTION-theme-b.md`
  beside it) and `music/arena-chamber` (the arena stand-in, section 14 default 5, with the
  FluidSynth and GeneralUser GS licences).
- **Beds** (36 s exact loops, stereo, opus + m4a): `lake`, `reeds`, `plain`, `shaft`, `market`,
  `archive`, `waiting`, `storm`, `alcove`, `dusk`, `chapel`, `lodge`; `water` plays the lake and
  `colossus` the plain (the footfall is an effect); the legacy `exterior` / `interior` stay for the
  test world. Levels -29 to -41 dBFS RMS, quietest in the archive and chapel.
- **Effects:** the legacy set (copied unchanged) plus bells (ferry, rib, chapel), splashes, cloth
  (rustle, flap, tear), glass (hit, shatter, shard reassemble), the colossus footfall, the horn,
  the crank, doors, the latch, the lever, flame, neon, grit, wood, stone and metal hits and breaks.
  Every cue id the code emits (138 ids: the stub props, the player, the material families
  `<family>.hit` / `.break` and every per-state cue in `src/pixel`) has a file, a rate and a
  volume; only the player's own move voices (jump, dash's lab layer) stay on the lab synth.
- **Footsteps:** a pair per surface: wood, stone, earth, water (wading), grating, metal, wet metal,
  tile, rug; one fixed gain per material, no per-hit normalisation.
- **The bell per place**, remapped on room entry: the ferry bell at Ringwater (pitched up 1.6x for
  the lodge counter's desk bell), the rib bell on the causeway and E1/E2, the chapel bell in E3/E4.
- **Wind alone:** the `tick` hook ducks the music 30 dB (`api.duck("colossus")`) while R-B's plain
  keeper reports `passing` in B4 Stonetop, held 2 s past the last `passing` so a flicker at the
  window's edge never lets it bob back; it returns over the runtime's 2.4 s rise.
- **Rest after the end:** 45 to 90 s (`restAfterEnd`).

Where every file came from (CC0 packs: Kenney Impact Sounds, rubberduck's 100 CC0 SFX #2,
TinyWorlds' steps; the legacy CC0 steps; original deterministic synthesis) is in
`public/audio/world/ATTRIBUTION.md`, and per file (bytes, SHA-256, levels, source files with
their SHA-256, `listening: pending`) in `manifest.json`. Rebuild with
`DEX_AUDIO_SOURCES=<folder holding the CC0 packs> node src/world/sound/build/build.mjs
[--only music|beds|sfx|steps]` (deterministic, seeded; nothing is downloaded).

**The theme's cue points, measured** (`THEME` in `tables.ts`; spectrogram
`review/world/phase2/S1/theme-spectrogram.png`): a 2.65 s quiet front, the dense middle to about
48.5 s, a breath (about -27 dB for 1.5 s), then the last section from about **50.5 s** (the air
drops away, the piano stands alone: the plan's "grand, mystical passage"), the tail from 77 s.
The D4 entry at 48 s under a 5 s swell after 2 s quiet puts the first sound at about 49 s, in
the breath, and full level at about 54 s, as section 9 asks. Picking these by ear is Dex's.

**Proof** (`node src/world/sound/verify.mjs --port 24701`: real Enter and arrow keys in Edge on
d3d11, real Web Audio sampled every 50 ms from analysers on the music bus after the muffle and on
the master; `review/world/phase2/S1/verify.json`, chart `music-states.png`): **25 of 25 passed** in the first run (it timed entries by the clock, not by playback; the re-verification below supersedes it).
All 70 effect and footstep files and all 32 bed and music files (opus and m4a) load and decode;
no request goes to `/legacy/`; every cue id has a file. No music for 13 s after Enter without
moving; after moving, the theme's gain rises from 0 over 9 s (largest step 0.006 per 50 ms). A1,
A0, A2, A3 keep one playhead (one entry; the cue runs on); the lodge low-passes to 650 Hz at
0.36 (-9 dB). Every room plays its bed (D2's shrine is in the alcove: the alcove bed); footsteps
match the surface in all 20 rooms. The archive's music gain reaches 0 in 4.0 s with the playhead
kept; D2 has no music; D4 enters at 48.9 s of the cue, E1 carries it on; E3 restarts from the top
(the only restart) and E4 carries it; the cue's end rests 71.7 s, then swells in from the start;
Stonetop ducks the music for the whole 29.7 s pass and releases after. Screenshots with the debug
overlay's sound line: `shots/` (1080p at 1.5x sharp-bilinear, 1440p at 2x, phone).

**Re-verified after the S1 critique (2026-09-29): three entry bugs in `audio.ts` (W0's file), a
patch handed to W0, proven.** `verify.mjs` now judges every entry by ear-level measurement on the
entering track itself: when the element actually starts playing (its `playing` event), the swell's
gain must be at 5% of its target or less, and the loudest the music gets in its first 0.5 s of
being audible must sit 10 dB or more under its settled level. It walks onto the Blade with the
real arrow key (the rain eases during the swell), lets the rest run out inside the silent
archive, and repeats the A2 and D4 entries on an emulated phone connection (fast 3G: 1.6 Mbps,
150 ms, cache off). It runs as 29 checks, plus screenshots at 1080p, 1440p and a phone.

| Run | Result | What fails |
|---|---|---|
| The tree as it is (`review/world/phase2/S1/live/`) | 25 of 29 | D4 walked in: at `playing` the gain is already 44% of target, first 0.5 s 1.3 dB under settled (the rain's level change cancels the scheduled swell). The rest ending in C2: C1 and C3 stay at -120 dB, cue stuck at 83.78 s. Fast 3G A2: first sound 27 s after the request at 100% gain; D4: 28 s after the crossing at 100%, 4.9 dB over settled. |
| With the patch (`review/world/phase2/S1/proof/`) | **29 of 29** | none: D4 walked 25.2 dB under settled, gain 0 at `playing`, first audible at cue 48.5 s (the breath); archive rest: back in C1 audible 4.1 s later from the top, 20 to 22 dB under settled; fast 3G A2 plays after 3.1 s, D4 6.1 s after the crossing, both from gain 0, 20.7 and 24.5 dB under settled. |

The patch is `review/world/phase2/S1/w0-handoff/audio.ts.patch` (against `audio.ts` SHA-256
`2c0c786d...`; the full patched file is beside it). It was proven on a separate dev server that
serves the patched copy in place of `src/world/audio.ts` (`vite.proof.config.ts` there; file
watching off so other lanes' edits don't reload the page mid-measurement); nothing under `src/`
outside `src/world/sound/` was edited. What it changes:

- An entry's swell starts on the element's first `playing` (not before its quiet gap), so a late
  element on a slow connection still enters from zero; a stall (`waiting`) during the rise holds
  the level and `playing` resumes it where it was.
- A level change during the gap or the rise (the rain easing on the Blade, a duck) rescales the
  remaining swell instead of cancelling it. A silent room's fade during the rise still fades.
- When the rest after the theme's end runs out while the room is silent, the next room that wants
  the theme swells it in from the top (before, the same-cue branch returned early for an ended
  track and nothing re-armed it).
- Effects load after the bed has data, two at a time at low fetch priority, footsteps first, and
  pause while a music entry waits for its data, so the theme gets a phone's bandwidth first.

The patch was incorporated by the recovered cross-lane fix. Do not apply it again.
`node src/world/sound/verify.mjs --port <dev port>` checks the current source and now exits
nonzero when a recorded check fails; its historical 29-of-29 result above is not a new run.

Nothing here is approved by ear. The listening list for Dex: the theme's entry points (A1, D4,
E3) and fade lengths, every bed, the bells, the colossus footfall, the horn, and the footsteps.

## Interaction and panels (proven)

E uses the nearest usable prop in reach (stub or pixel matter). Panels (`ui.ts`) are real DOM:
focus moves in, Tab is trapped, Esc / close / clicking outside returns to the world. They load
the website's own pages (`/donate/`, `/docs/`, `/downloads/`) in a frame with `?embed=world`
appended so the site can drop its chrome there (**website lane:** support `embed=world`), with a
plain link to open the page. The gallery panel shows one of Dex's pieces from
`content/gallery/manifest.json` with a link to all of them; the chapel's lectern opens the
catalogue (every real thumbnail, alt text kept, each opening on its own). Donors and dex account
say plainly that they aren't connected yet; nothing is faked. The map panel draws the round's
side view from the rooms' world positions: where you are, where you've been, the shrines you've
lit (real save data only).

**The website, one scroll away, from every room:** scrolling past 60% of the view puts the world
in `away`: no simulation, its sound fades; scrolling back resumes it. Proven in all 20 rooms.

## Save, travel log, debug, touch (proven)

- `save.ts`: localStorage `dex.world.v1`: flags in the `kind:id` names of WORLD-PLAN section 11
  (`shrine:1` ... `shrine:6`, `cut:map-banner`, `cut:rope-bridge`, `lever:culvert`,
  `lever:express`, `blade:cleared`, `rose:open`, `latch:sky-door`, `round:done`,
  `keeper:greeted`), the pixel-matter props' persisted keys, the last rest place (the record of
  the last shrine you rested at), sound on/off, and the position: `place` (room id, x, y and
  facing of the last safe ground) with `lastSeen` (wall-clock ms of the last player activity).
  Session flags (not saved) hold this visit's state (the evening after the round). Nothing about
  payment or donations is stored. Saves from before the position fields load unchanged.
- **Where a load starts** (`startPlace` in `save.ts`, `RESUME_MS` = 180000 ms): under 3 minutes
  since `lastSeen`, the exact saved place; if that room is gone or the spot is no longer
  standable (outside the room, over a pit, no surface under it) the rest place, else the spawn.
  At 3 minutes or more, with no `lastSeen`, or with a future one: the world's spawn (`A1`/`start`,
  the arrival dock). Only the position resets; flags, props, shortcuts, cuts, the rest place
  record and the sound choice stay. `?room=`/`?spawn=` links start exactly there (over any saved
  place or rest place) and `?fresh` forgets the whole save. The homepage embed (`/world/?embed=site`)
  and `/world/` share the key, so the rule is the same on both. `state().startedBy` says which
  rule applied (`place`, `rest`, `spawn`, `link`).
- **When the position is written** (`game.ts`): a heartbeat at most every 3 s while the world runs
  (not away), and immediately on `setAway(true)`, `visibilitychange` to hidden and `pagehide`;
  an unchanged record is not rewritten. `lastSeen` is the last *activity* (movement, a held
  action, an open panel, Enter), not the write time, so a tab left open and idle for 3 minutes
  and then reloaded also starts at the dock, and an idle reload does not extend the window. The
  place write merges only `place`/`lastSeen` into the stored save, so a second open tab cannot
  roll back the other's flags through it (other writes still store this tab's whole save).
  Proof: `node --test src/world/save.test.mjs` (fake clock), and a real-browser check on a
  local build (move, reload within 3 minutes resumes; `lastSeen` 4 minutes back starts at the
  dock with flags and rest kept; the homepage embed resumes the same place).
- **Travel-time logger** (`travel.ts`): room and area entries, flags and the first arrival at
  each destination (a placement with `params.dest`: downloads, donate, illustrations,
  documentation, account, map), in simulation seconds since Enter. In the debug overlay and
  `state().travel`.
- Debug overlay (backquote): fps, frame cost, draws, the scale and presentation mode, room and
  area, source (grey-box, region, test), world position in H, camera mode and anchor, weather,
  sound (music, muffle, ducks), save, travel; collision, prop, water, area and hit boxes and a 1 H
  bar next to the player.
- `touch.ts`: the lab's layout (move pad, jump, strike, dash, Q, R) plus down and a use button
  that appears only when something is usable. The world canvas is `touch-action: pan-y`, so a
  vertical swipe on the world scrolls to the website; the pad buttons keep `touch-action: none`.

## Story and sound hooks (proven: discovery; content: the story and sound lanes)

`hooks.ts` finds every module in `src/world/story/**` and `src/world/sound/**` by glob; any
export with an `id` and hook functions is used. Story hooks get `install`, `tick`, `enter` (room
or area), `flag` (save or session), `rest` (a shrine lit), `state` (a prop's state changed) and
`room` (adjust a room's data before it is built: the evening light after the round). Both see a
`WorldApi`: flags and session flags, the room, area and player, props (stub and pixel) and
`signal`, weather overrides, named music ducks, panels, sounds, a story shake (off in reduced
motion). Nobody edits `main.ts` or `game.ts` to add a hook.

## Verify

```
node src/world/tools/round.mjs --shots 1 --w 1920 --h 1080   # the round end to end, reload, returning runs, scroll-away
node src/world/tools/checks.mjs                              # every room: 1080p / 1440p / phone shots, flash budget, frame cost
node src/world/tools/reach.mjs                               # run, jump, double jump, dash reach in H
node src/world/tools/gif-round.mjs                           # motion: map cord, rope bridge, crane hook, lift ride
node src/world/tools/flow.mjs                                # the test world's mechanics (?world=test)
node src/world/tools/gates.mjs                               # S4 barred on a fresh save, phone swipe-away per room, held keys, site end
node src/world/tools/shot.mjs <out.png> "go&debug" 1920 1080 1 8000
```

All use `playwright-core` from `tools/scene-pipeline` driving Edge; port from `--port` or
`WORLD_PORT` (default 24001, the capture server). `round.mjs` plays with real input through
`tools/bot.js` (it only decides when to press what; it waits in real time while a room's shaders
compile, so honest loading never inflates the times). Output goes to `review/world/phase2/W0/`
(git-ignored).

**Results, 2026-09-29 (lane W0):**

- **The round is walkable end to end** in the grey-box: A1 → A2 → A3 → A4 → B1 (wade, cut the
  bridge) → B2 (B3 shelter) → B5 (culvert lever, crane hook) → C1 → C2 → C1 → C3 → D1 → D2
  (alcove) → D3 (terminal, express lever) → D4 → E1 → E2 → E3 → E4 (latch) → the sky door → A3
  loft → A2 → A1 → A0 (sit on the bench). Six shrines rested; 452 s of play; no console errors.
- **Reach limits:** every jump the round needed: ledges of 0.8 H (twelve, all in D2) and gaps of
  1.1 H (B2 at x 120) and 1.07 H (E1, which also has a walkable ring bay); everything else is
  walking and stairs (limits: ledges 0.9 H, gaps 1.1 H; a run jump reaches 1.30 H).
- **Times against section 6** (simulation seconds from the dock; the first visit includes the
  bot's stops: six rests and the cord cut):

  | Destination | First visit (plan) | Returning (plan) |
  |---|---|---|
  | dex account | 18.1 s (~21 s) | 18.3 s (~21 s) |
  | Donate | 20.5 s (~22 s) | 20.7 s (~22 s) |
  | Map | 28.3 s (~28 s) | 28.7 s (~28 s) |
  | Documentation | 152.7 s (~130 s, +17%) | 71.8 s (~70 s: ferry, crane) |
  | Downloads | 280.3 s (~270 s) | 117.1 s (~105 s, +12%: ferry, crane, express lift) |
  | Illustrations | 371.5 s (~360 s) | 39.6 s (~40 s: the sky door) |

- **Shortcuts persist across a reload:** all 13 flags the round sets (`shrine:1-6`,
  `cut:map-banner` from the pixel banner, `cut:rope-bridge`, `lever:culvert`, `lever:express`,
  `blade:cleared`, `latch:sky-door`, `round:done`) are still set after a reload, and the next
  visit starts at the last shrine (E2). S1: the channel is crossed on the lowered deck without
  wading. The pixel donation box opens the donate panel.
- **Website scroll-away:** in all 20 rooms the site comes up, the world waits (no simulation
  ticks) and resumes on scrolling back. On a phone (844x390 @3, real CDP touch) a vertical swipe
  on the world brings the site up (scrollY 277 to 302 of 390) in all 20 rooms, the world waits,
  and a swipe back down returns to scrollY 0 and resumes; the move pad still moves the player
  and a wobble while holding it does not scroll (`gates.mjs`, `review/world/phase2/W0/fix/`).
  The stand-in site is `box-sizing: border-box`, so it ends at its content (no black band past
  the links).
- **Critic fixes, 2026-09-29:** on a fresh save the loft sky door stays locked (E rattles it, the
  room stays A3, no flag; still locked after re-entering the loft); the balcony latch, a real
  reload and the sky door to E4 then work. A key held through the A1 to A2 edge exit and through
  the lodge front door keeps walking with no re-press (x 35.63 in A2, 48.57 in A3; with the old
  per-frame `releaseAll` the player stops at the spawn: 34.5 and 47.4,
  `fix/held-baseline-releaseAll.json`). The round was re-run after the change: same times to
  within 0.01 s, reload flags intact, no errors.
- **Scale:** 1920x1080 at 1.5x sharp-bilinear, 2560x1440 at 2x nearest, phone landscape
  (2532x1170) at 1.625x sharp-bilinear; H = 80; feet at each room's anchor.
- **Flash budget:** at most 2 starts in any second in every room (the storm rooms D1 to D4), 1 in
  reduced motion; none elsewhere.
- **Cost** (1280 x 720, render + readback, headless Edge, d3d11, RTX 4090): 0.44 to 1.88 ms per
  frame per grey-box room (A4, with the pixel map banner, is the most). SwiftShader: 21 to 51 ms.
  Not measured on a laptop GPU (lane I1).

## Region A: Ringwater (lane R-A, proven 2026-09-29)

`src/world/rooms/ringwater/` replaces the grey-box A0 to A4 and the ferry ride S2 by id, on the
grey-box's world coordinates, spawns, exits, door and prop ids (so the round's bot carries over).
Helpers are `_`-prefixed (`_lib.ts` the evening and restyling, `_lodge.ts` the lodge scene,
`_cliff.ts` the cliff stair and the yard's ground); `state.ts` exports two stub-engine recipes
the registry registers: `ringwater-state` (one per room) and `ring-seat` (sit through the
runtime, so the camera holds on the room's vista). Region recipes are in
`src/pixel/props/ringwater/` (ENGINE.md, "Ringwater").

| Room | What it is |
|---|---|
| A1 The Dock | `arrivalScene({ dock: "world" })`: the arrival with its deck at 0.8 (WORLD-PLAN section 1), the dock ending at the keeper's lamp (a pixel `pierLantern`, moths), the older boardwalk 0.2 H lower and partly awash to the cliff foot at x 34, the muted red line from just right of the player's feet to that end, mooring posts with floats in the water, the suitcase 3 H left of spawn. The first view is the scene's own composition (a framing zone around the spawn); nothing usable in it |
| A0 Pier's End | the same lake from 27 H further left (`bias`: every layer moves by bias / depth, so the sun stays, the ring barely moves, the shaft is seen side-on and the leaning rock spire comes to the middle), the pier with its end posts, a bench (vista hold, `ring-seat`), the ferry moored in front with the ferryman asleep, the ferry bell on its post, moorings, reeds, grass in the planks |
| A2 Cliff Stair | one locked 9 H frame with the whole climb in it (grey-box: free camera, 14.7 H): a rock spur out of the lake under cut stone steps, a landing, the shelf, drawn in the backdrop with the scene's palette and mirrored in the lake (`_cliff.ts`), the lake seen a little higher (`rise`), three lamp posts, vines, grass, rubble, the lodge's west end with the front door |
| A3 The Keeper's Lodge | its own scene (`_lodge.ts`): log walls, wainscot, the loft beam, west windows with the morning (or evening) and their light slanting in, dust, a warm wash by the stove, the stair's handrail, and behind the sky door the dusk view (the lake far below, a tiny ring, the black spire in its storm). Registry counter (E: account), the keeper, the lamp board, the product board (E: downloads), donation box and plaque, stove and kettle, candles, her cup, paper, a hanging lantern, the loft bench, shelves, lost-property luggage, the lodge doors and the sky door |
| A4 Keeper's Yard | the lake from 5.7 H up (`rise`), the shelf's ground drawn in the backdrop, the lodge's east end with the yard door, shrine 1 (lantern, bowl, donation box, the donor plaque on a post), the shrine arch with the map banner, the training dummy, the laundry line, grass and flowers, two lamp posts |
| S2 the ferry | the grey-box ride on the arrival lake (no dock, a small bias); the carrier is still the runtime's stub boat |

**The room state** (`ringwater-state`) reads the save each tick and moves pixel props with
`signal()`: lamp posts toward the next shrine are on when you arrive with the shrine lit, and
come on 0.45 s apart when you rest there; the lamp board shows `on<n>` for each lit shrine; the
ferryman wakes on `lever:culvert`; the sky door loses its rail on `latch:sky-door`; the keeper
is at her ledger, away (evening) or on the bench at Pier's End (evening); it mirrors the
keeper's own persisted `greeted` into `keeper:greeted`.

**The evening** (`_lib.ts`): when `round:done` is set during this visit (the save didn't have it
when Ringwater first looked), rooms built from then on use the evening backdrop (the arrival's
evening palette, the lodge's evening windows), lighting and `dusk` time; the room state sets
the session flag `evening`, and honours it if the story lane sets it. Room defs choose through
getters, so a room already built stays as it was until it is rebuilt (the lodge you step into
through the sky door keeps its morning walls but gets the evening's keeper and open door).
A save that already has `round:done` shows the keeper's chair and cup in the loft.

**Asks for W0 (worked around in Ringwater, not fixed):** the adapter never sets
`world.actors`, so grass never parts round the player, the kit door's "near" test and the
keeper's "sit with her" never see you; the room state feeds the player in through the page's
world handle for its own room. A pixel door is not closed on room entry (the lodge doors close
themselves when nobody is near). A pixel bench's `sit` event holds the camera ahead of the
player instead of on the room's vista, and its state stays `sat` after a move stands you up
(Ringwater uses `ring-seat` for E and a use-less `ringBench` for looks).

**Verified** (`review/world/phase2/R-A/`, tools in `R-A/tools/`):

- `flow.mjs` (real input through `bot.js`): the first frame has nothing usable in view and
  nothing near (`flow.json` `first`); the colossus crosses the light shaft once a pass (about
  118 s: seconds 20 to 26 and 134 to 146 of the capture) and its lit reflection breaks up in the
  ripples (`flow/pass-sheet.png`, `hero-reflection-zoom-x2.png`); E at the ledger opens the
  account panel, which says the dex account isn't open yet; the keeper's first line once, then
  she only looks up, `keeper:greeted` set; the product board opens the website's downloads, the
  box the donate panel; the sky door on a fresh save opens barred onto the dusk, E rattles the
  rail, the room stays A3, no flag, and it swings shut when you walk away; resting at shrine 1
  sets `shrine:1` and the rest place, the yard's lamp posts come on, the lamp board shows lamp
  1, the stair's lamps are on when you come down; the banner's cord cut unrolls it (`cut:map-
  banner`) and E opens the map with only the save's lit shrines; the ferryman waves in his sleep,
  wakes on `lever:culvert`, and E boards S2; with `latch:sky-door` and `round:done` set this
  visit: session `evening`, the keeper away, the front door ajar, the sky door free, the keeper
  sitting at Pier's End with two cups, and her second line when you sit with her. No errors.
- `checks.mjs` (W0's, over A0 to A4 and S2): 1920x1080 at 1.5x sharp-bilinear, 2560x1440 at 2x
  nearest, phone 844x390 @3 at 1.625x sharp-bilinear; feet at 0.8 (A0, A1, A4, S2) and in the
  locked frames at 0.89 (A2 foot of the stair) and 0.9 (A3 ground floor). Flash starts in any
  second: 2 in A0, A1, A4 and S2, 3 in A2 (the limit; the target is 2: the ring's glints and
  the break's beacon are random, and one 60 s sample clustered three; the glint rate went from 6
  to 4 a minute, which did not remove it), 1 in reduced motion; none in the lodge. Cost at 1280x720, d3d11, RTX 4090: A0 3.0, A1 2.2, A2 2.2,
  A3 2.5, A4 4.7 (the banner's cloth, 20 pixel props), S2 1.9 ms; SwiftShader: A1 789, A0 617,
  A3 85 ms (the arrival's ring and colossus shaders; the plan expected several hundred). Not
  measured on a laptop (lane I1).
- W0's `round.mjs` (a copy writing to `R-A/round/`) walks the new rooms with real input: A1 to
  A2 at x 34.5, the lodge's front door with one E, the counter, the box, the yard door, the rest
  at shrine 1, the cord cut, on into B1 and through the plain; it stopped at C1's archive door
  (another lane's room), so the round's return through the sky door was checked by `flow.mjs`.
- `kit.mjs --only <the 17 ids>`: every Ringwater recipe recorded through its states; idle cost
  0 uploads except flames at 15 Hz (the pier lantern, the stove).

## Region E: the Pilgrim Path and the Chapel (lane R-E, proven 2026-09-29)

E1 to E4 replace the grey-box by id (`src/world/rooms/chapel/`), at the grey-box's world
coordinates, so the round's positions still hold (the shrine lanterns at 356.8 and 399.3, the
chapel doors at 408.2, the latch door at 485.2). Backdrops are the scenes `pilgrim-path` and
`chapel` (`src/scenes/scenes/pilgrim-path.ts`, `chapel.ts`, `chapel/outside.ts`,
`pilgrim-path/dusk.ts`), each built from the room's own layout constants (`PATH`, `NAVE`,
`PORCH`, `BELFRY`), so the path's treads, the nave's niches and portal, the porch's sill and the
belfry's stair are drawn exactly where the collision and props are. Terrain there is `art:
"none"` (the scene draws it); the E2 and E3 floors are runtime `stone` in the region's ramps.

| Room | What | Camera |
|---|---|---|
| E1 | the fallen ring segment at dusk: flights of standard steps with landings (84 to 40 over 80 H), the missing panel (1.1 H) over the ring bay, the rib and its bell (brackets 0.9 and 1.2 H), stained glass in the hull's fins, shrine 5's terrace (351.6..358), lamp posts that light down the path | free, anchor 0.5, lookY 1.5 |
| E2 | the chapel's west front and porch: font, shrine 6, box and plaque, lanterns, the dusty cup on the sill, the shawl, the broom, the big doors | locked (the view shows 1 H past each side) |
| E3 | the nave: 01 to 05 on easels, 06 to 09 in the chancel niches, the catalogue lectern, the rose window over the doors and its crank, pews, votives, candelabras, censer, tapestries, lanterns | rail, anchor 0.84; vista hold at the look pew (445.3) on the niches |
| E4 | the bell tower: an open arcade, flight one up its flank, a flying stair on an arch, the balcony with a balustrade drawn in front of the player (a `pass: "front"` backdrop layer), the bell-cote with the chapel bell over the red-marked door | free, anchor 0.64; vista hold on the balcony |

**Gallery (WORLD-PLAN section 14, default 3).** `rooms/chapel/gallery.ts` exports two stub recipes
(found by the registry): `art-thumb` pins the real thumbnail from `content/gallery/manifest.json`
(srcset from its real smaller copies) as an `<img>` in `#stage`, placed during each render
exactly on the frame's board (the frame recipe's `artRect()`) through the camera and the
presenter rect; hidden in the combat close-up, faded with the screen, hidden in any other room.
Where Rosace's drawn sprite passes in front of a work, a CSS mask of her exact silhouette (her
current sprite frame's alpha, read once per frame from the GPU atlas and cached per frame and
scale, same rect, pivot, flip and 0.5 alpha cut as the sprite shader) is taken out of the
`<img>`, so the canvas below shows her and nothing else. Where her pixels don't reach the art,
nothing is masked; while she is drawn dithered (dying, the hurt blink) she goes behind the work.
The frame's board never shows through the art (the fixed player box that cut a black strip
under the work while standing at it, and a black box while jumping, is gone). `sit-spot` is an invisible seat that calls the
runtime's own sit (camera holds on the room's vista). The gallery panel gets previous / next /
all works and the arrow keys while one work is open (a MutationObserver on `#panel` adds them).

**Asks for W0.** Fold previous / next / all works into `ui.ts`; a public world-to-screen mapping
for DOM overlays (the gallery reaches the camera and presenter through `window.__world.game`);
pass the game's `reduced` and its global flash gate into each room's `PixelWorld` (today the
pixel world's own gate and `reduced = false` are used: a bell's ring of light is gated at 3 a
second but not at the reduced 1 per 2 s); a pixel bench's `sit` event could use the room's vista
like the stub bench does.

**Verified** (`node src/world/rooms/chapel/_tools/verify.mjs`, real input through `tools/bot.js`,
1920x1080; `review/world/phase2/R-E/verify/verify.json`): 24 of 24 checks. E1 walks top to bottom
(one jump, at the missing panel, a downhill 1.1 H gap); shrine 5 lights and its four lamp posts
come on one after another (1000, 1100, 1110, 1111); the rib bell rings from its bracket; shrine 6
rests; one E on the chapel doors carries you into E3; the nave is sway-only; E on each of the nine
frames opens that work alone (its own `/gallery/NN.webp`, alt text); next, left arrow and all
works step through the real gallery; the lectern shows all nine; the thumbnails sit on their
boards to within half a CSS px at 1.5x (288 x 162 for a 2.4 x 1.35 H work); slashes, Q and R
across the nave remove no cell of frames, pews, votives, censer, tapestry or candelabra (0
chunks); a candelabra struck in the nave gutters (2 of 5 flames out) and relights by itself
within 7 s with no E; the crank sets `rose:open` and the light sweeps and settles (it comes to
rest on the four niches: a stronger light and floor pool and a warm wash on the niche wall
around each frame, the shafts spread across them, and the easels it passed keep a softer glow;
`review/world/phase2/R-E/fix/e3-rose-rest-449.5.png`); the look pew sits you and
holds the camera on the niches; the latch rings the bell by itself (rest to swinging while the
rail drops) and the door carries you to the A3 loft (`latch:sky-door`, `round:done`); after a
reload the flags persist, the rose stays open, the lamp posts are on and the rail stays released;
no console errors.

**Rosace in front of the art, in pixels** (`node src/world/rooms/chapel/_tools/mask.mjs`,
`review/world/phase2/R-E/mask/<viewport>/mask.json` and a leak map per capture): for all nine
works at 1080p (1.5x), 1440p (2x) and a phone (844x390 @3, touch), standing under the frame at
three spots and at three moments of a jump in front of it (162 captures), five screenshots of the
work's rect on the same frame (as shown; the art unmasked; the overlay hidden; the frame
rendered without her; her drawn flat magenta) sort every pixel that isn't the art into "her"
(the canvas showing her, where she is drawn) or "leak" (the canvas showing through where she
isn't: the board). Result: every capture where she overlaps is masked to her silhouette; no
board shows. The only "leak" pixels are 1 to 5 isolated single pixels per capture (largest
connected patch: 1 px, often at the same spot standing and jumping far from her: the art's own
resampling noise between screenshots), at most 2 within 3 px of her (the blend at her sprite's
edge). Every capture waits for the thumbnail to be loaded and visible (162 of 162). The
old fixed box cut an 80 x 18 CSS px strip at 1080p when standing at a frame.

**Common checks** (`node src/world/rooms/chapel/_tools/checks.mjs`,
`review/world/phase2/R-E/checks/`): 14 views at 1280x720 (1x), 1920x1080 (1.5x sharp-bilinear),
2560x1440 (2x nearest) and a phone (844x390 @3, 1.625x sharp-bilinear); feet at each room's
anchor. Flash: with every bell struck twice a second for 60 s and the rose swept, at most 3
starts in any second (E1, E4: all from the bells' ring of light; E2, E3: none); see the ask above
for reduced motion. Cost, 1280x720, render + readback, d3d11 on the RTX 4090: E1 2.4 to 3.4 ms,
E2 2.9, E3 1.0 to 1.7 (rose lit), E4 0.9 to 1.2; SwiftShader 138 to 205 ms. Not measured on a
laptop (lane I1).

## Region C: the Hollow (lane R-C, proven 2026-09-29)

`src/world/rooms/hollow/` replaces the grey-box C1, C2 and C3 by id, with the grey-box's
geometry, spawns, exits and doors kept (so the round and W0's bot carry over). Helpers under
`_scene/`, `_room.ts` and `_tools/`; the room controller `wick.ts` is a stub-engine recipe found
by the registry. Region recipes in `src/pixel/props/hollow/` (see ENGINE.md, "Hollow").

| Room | What it is |
|---|---|
| C1 Foundry Market | the amber-hollow scene re-framed for a street 6 H under a walkway (`_scene/shift.ts` lifts every layer by ref / depth, so the street framing is the scene's own composition and the climb to the walkway is true parallax), plus the market's own layers: stacked houses at depth 1.9 and 1.35 over the dense stretches, and a room-aligned depth-1 layer (the parapet over the drop at the open ends, the archive block, the Hearth Shrine's arched alcove with its firebox, the walkway's columns, the girder and trusses under the street with the furnace glow below). Pixel matter: the grating walkway and stairs, the destructible flagstones, 4 stalls (one empty) with 3 silhouettes working, shrine 3 set with the hearth fire, the archive's ordinary door with its lamp and book mark, neon glyph signs, steam vents with puddles, junction boxes, the red pipe (walkway and toward the lift), a jib crane with a hook over the walkway gap, cables, paper lanterns, crates, barrels, grit, motes, moths, paper, 4 street lamp posts, a rooftop bench (vista hold) over the archive reached by the 1.9 H double-jump gap |
| C2 The Archive | a reading room whose back wall opens through arches onto stacks that go on further than they should (`_scene/archive.ts`; masonry above the ceiling and under the floor, since the room is shorter than the view). Boards and rugs, the archivist in her armchair with the green reading lamp, a reading chair, the index lectern, candles and a candelabra, three bays (DEXCLIENT, DEXCODE, DEX.PLACE: the `/docs/` groups), motes, paper. The lectern sets the room sway-only |
| C3 Lift Foot | a tiled waiting room (`_scene/liftfoot.ts`): a long window onto the amber hollow (the amber scene's far layers), the spire's fluted stem coming down through the ceiling into the floor with the shaft mouth; the lift car in the shaft behind the gate (a pixel `gate` door), the beacon, the spire arrow sign, two rows of chairs (one faces away from the lift), the ticket display frozen on 47, luggage, a crate, a training dummy, the empty operator's booth and chair with the radio, fluorescent strips |

**Mechanics.** The wick reads the save and moves pixel props through `signal()`: the lamp posts
toward shrine 3 are on when you arrive with `shrine:2` set, and light one after another
(0.55 s apart) when you rest at shrine 3. `hollowFootfalls` keeps the crossing clock (a 30 s
crossing every 70 s, a thud every 2.5 s); on each thud the grit emitters sift, lamps sway, a 1 px
shake runs (the host drops it in reduced motion), a `colossus.footfall` cue plays, and the
backdrops' ceiling grit bursts (`src/pixel/props/hollow/pulse.ts`, one module-level counter the
backdrop's point systems read). Pixel doors take two presses: E opens, E again goes through. The
lift beacon and the car watch the gate: amber and turning while it opens, the car's lamp on.

**Verified** (`node src/world/rooms/hollow/_tools/flow.mjs --shots 1`, real input through W0's
bot, `review/world/phase2/R-C/flow.json`, 18 of 18): rest at shrine 3 sets `shrine:3` and the two
lamps beyond light in order; 12 thuds 2.5 s apart with grit spawned on the same tick every time;
the archive door opens on a fresh save with one E and leads to C2 on the next; the music's real
Web Audio gain falls from 0.70 to 0 within 4 s of the door (a 4 s linear fade; measured 3.90 and 3.97 s in two runs, sampled about every 0.1 s); the lectern opens the archive panel
(a `role="dialog"`, `aria-modal` DOM panel, focus on its close button, the real `/docs/` page in
it) and Esc closes it with focus back on the canvas; the travel log records documentation; a bay
opens the archive panel; E on the archivist gets a hum (no panel); C2 is sway-only; C1 to C3 by
the east edge; the beacon is off, then amber when the gate opens; the gate boards D1. Common
checks (`_tools/checks.mjs`, `review/world/phase2/R-C/checks.json`, 7 views): 1920x1080 at 1.5x
sharp-bilinear, 2560x1440 at 2x nearest, phone landscape 2532x1170 at 1.625x sharp-bilinear, H 80
(the stand-in bbox with halo and glaive is 99, as W0's); flash starts at most 2 in any second (1 in
reduced motion; C2 none); cost at 1280x720, render + readback, d3d11 on the RTX 4090: C1 2.2 to
5.4 ms (street views during a crossing are the most), C2 1.4 to 2.0, C3 2.8; SwiftShader C1 669,
C2 101, C3 481 ms. Motion GIFs: `review/world/phase2/R-C/gif/`. Not measured on a laptop (I1).

**Found on the way (for W0 / P0):** the archive panel ignores its `arg`, so a bay can't open its
own product's page yet (the bays send `g-dexclient` etc., the anchors `/docs/` already has; the
panel would need `/docs/#<arg>` with `embed=world` before the hash). Underground rooms get
`serene`'s 0.08 breeze, so ropes and cloth there never sleep (P0's sleep test needs no wind);
the Hollow keeps its verlet lines few and short for that reason. A pixel part with
`collide` set is rescanned (`grid.bounds()`) every tick by the adapter, so long ground parts
should leave collision to terrain (the Hollow's floors do). The kit cable's rope part is sized
to reach its whole length both ways (a 6 H cable is a million cells redrawn while awake); the
Hollow uses `hollowCable` with a tight `reach`.

## Region D: the Spire (lane R-D, proven 2026-09-29)

`src/world/rooms/spire/` replaces the grey-box D1 to D4 by id. D2 and D3 keep the grey-box's
rows, flights, spawns, exits and prop x positions (the lever, the terminal), so the round and
W0's bot carry over unchanged. Helpers: `_build.ts` (the rooms in world H), `_scenes/` (the four
backdrops), `_tools/` (captures and checks). Two stub-engine recipes live next to the rooms and
are found by the registry: `spire-storm` (`storm-driver.ts`, the storm's program, below) and
`spire-lift` (`lift.ts`, the runtime's carrier in the spire's iron: a caged car, its roof beacon
turning while it moves, publishing its height). Region recipes in `src/pixel/props/spire/` (see
ENGINE.md, "Spire"). Walkable geometry is terrain with `art: "none"`; what you see and hit is
pixel matter (catwalks, flights, the arena floor, the Blade's edge).

| Room | What it is |
|---|---|
| D1 Lift Ride | a 6 x 117 H shaft, the camera locked to the car (`locked` mode in a room taller than the view). The backdrop keys to the car's height: the foundry's amber haze with the city standing in it around the tower's foot and the foundry yard below it (paving rows widening toward you, crane rails with warm glints, crucibles with molten lips, pools of furnace light brightest in the pit under the tower, work lamps; it reaches past the view's bottom at every car height and viewport), about 3 s of dark ceiling rock lit amber from below (pipes, cables, service lamps), then the spire's stem face on the right with window slits streaming past and the storm on the left, the pale planet rising behind (its centre follows the camera's height) over a cloud sea that sinks as you climb, rain starting on the car near the break. The lift tower's rails and braces rush past. The counterweight passes the car the other way at y 4, halfway up the 72 H ride. Warning beacons at the three stops. The muffled theme opens up along the shaft (the runtime's muffle ramp) |
| D2 Outer Climb | 40 x 45 H on the spire's face: six flights (two 0.8 H machine housings, then 22 steps of 0.2 H on a riveted stringer, a handrail behind) between iron catwalks bolted to the face; the landing at the break with the lift's gate in an iron portal. Backdrop: the spire's face (tiers, girdles, buttress ribs, conduits with blue running lights, lit window slots, rain running down it) right of a leaning silhouette with sawtooth fins; left of it the void: storm clouds lit from inside, the pale planet through them with silver-lined edges, a cloud sea far below with ruins (it sinks as you climb). The storm alcove (shrine 4) is a warm recess with a heavy lintel dripping rain: shrine lantern, donation box and plaque, bench, candelabra and candles, and the cracked stained-glass window lit from behind by lightning. Red pennants at the head of every flight, warning beacons on every lip, lamp posts toward shrine 4 (on once shrine 3 is lit), broken armour, stub fins, puddles, chains, the counterweight hanging in its channel at the east edge. The secret: off row 52's open west end, a 2.8 H dash gap to a lone perch with a pennant and a view west (vista hold), a catch ledge 1 H below that reaches under row 52 |
| D3 The Crown | the arena on the spire's flat top: the west shutter, the boss terminal under its overhang with two banners behind it, pillar lines (a 2.3 H column and a 0.9 H broken stub each side, for aerial play), the fight floor with the ring of five seals set in its face, the east shutter, the lift's gate (the express stop), the express lever, the way on to the Blade. Backdrop: the rest of the crown rising behind the arena (a black sawtooth of fins with lit west faces, antenna masts with red lights, a few ports), a low storm ceiling lit from inside, the planet a dark disc behind it, and in a gap in the crest the ring, small and far (it was huge over the dock) |
| D4 The Blade | 32 x 16.6 H up the monolith's top edge (a steady 17 degree slope of lapped iron plates rising 8 H over 26.5 H, then a flat tip deck 3.3 H long, 312.7 to 316; collision is 160 steps of 0.05 H, so the feet never float more than 4 px over the drawn slope). The blade face under the edge is drawn at the room's depth, so it stays under the walking edge whatever the camera does (the sit hold, the vista). Storm at the Crown's door; at x 292 the storm tears open in stepped bands (below). Then: the low dusk sun in the ring's hole in the west, its path on the lake, the lodge's cliff with its window, the plain with the causeway, two colossi walking west far below with birds wheeling over their backs (light haze only, in shadow but for the low sun on their west sides, so they read as solid giants), the hollow's mouth glowing, the lamps you have lit (each a warm halo and core with a thin column of light rising from it), a rose-lit cloud sea, the planet setting behind the blade in the east, and the storm still sitting on the spire behind you. Pennants (still once the sky is clear), rubble, moss on the edge (laid in 0.45 H tufts, each on the slope under it), the bench on the flat tip (313.5 to 315.1, its feet on the deck; E sits) with a vista hold that lets the world below fill the frame |

**The storm program** (`src/pixel/props/spire/storm.ts`, one module every spire piece reads).

- **Gusts:** a 9 s cycle, 6 s calm then 3 s of gust. The push is 0.5 H/s east (with the
  runtime's wind, the rain and the kit's cloth). The tell (`tell` 0..1) rises through the last
  1.7 s of the calm: the pennants start to snap (the director pushes them, harder as the gust
  nears), the rain leans (its angle and drift integrate the program), the warning beacons blink
  faster. `storm.tell` and `storm.gust` cues mark the moments for the sound lane.
- **One clock:** the storm backdrops publish their scene time every frame (a points layer that
  draws nothing), and the rain GLSL computes the same program from `uTime`, so the push, the
  pennants and the rain angle can't drift apart (hitstop slows the simulation, not the
  backdrop). Pieces with no storm backdrop fall back to their own clock.
- **The push** (`spire-storm`): the climb's catwalks are this prop's one-way platforms, and its
  `mover` carries whoever stands on one. It acts only on a catwalk, only in a gust, never in the
  air, on the stairs or in the alcove (sheltered), and never past the catwalk's lip or into the
  next flight's machinery: it stops 0.26 H short (`Deck.stop`). The catwalks' downwind ends all
  have a 0.3 H lip or a housing. A fall lands one or two rows down; past row 64's west lip a pit
  returns you to the last safe ground.
- **Lightning:** the storm rooms run the runtime's `rain` state (1.2 strikes a minute, bolts and
  thunder) and add their own lightning inside the clouds: gated flash accents (the global gate)
  that light the cloud layers through `flashLight` and nothing on the player. The storm's weight
  (heavy rain, dark decks, fast cloud) is in the backdrops.
- **The break** (D4): the weather zones go from `rain` to `after` at x 292 and `blade:cleared`
  keeps it clear. Four bands of solid storm deck read the clearing (`uWx2.w`) and each tears open
  in quarter steps as it passes its threshold (the horizon band first, then above, below, the
  top), the thin places first: about 4 s from the first hole to a clear sky. The lightning in
  the deck fades with it; the storm on the spire behind never clears. The Blade's gold edge and
  the blade face's lit bevel follow the clearing.
- **The driver's other jobs:** it mirrors the save's shrine flags (the Blade's lamp points), the
  lightning level (the alcove window), the player and the rain into the storm module, and the
  director hands them on to the room's pixel world (`world.actors`, `view`, `rain`, `reduced`),
  which the adapter doesn't feed yet: puddles ring under her steps, moss parts round her,
  dynamic parts out of view rest.

**The terminal flow** (D3; the kit's `bossTerminal` with the runtime's arena hooks). Dormant:
dark screen, rain on it. E: woken, and the screen lists the real products from the site's
downloads data (`src/site/data/downloads.ts`, imported read-only): DEXCLIENT with a steady caret
(brighter on the blink), DEXCODE dimmed with none (dexClient installs it); nothing else. The ones
with a download come first, and if the list ever outgrows the screen's rows it pages every 3 s
(nothing is dropped). E: summoning: the five floor seals light one after
another with columns of red, the shutters roll down, the warning beacons go red, the arena music
comes in over 3 s and the camera clamps to the arena (the runtime's). The seal holds; 2.5 s later
the terminal cools down and its screen says SITE BELOW with an arrow, and the runtime's panel
says no warden answers yet and links the website's downloads. The shutters roll up, the seals
fade through smoke. No fight, no download is faked; nothing is unlocked. Walking through the
open shutters is E (the west one back to the climb's top, the east one to the lift's gate).

**Verified** (`review/world/phase2/R-D/`; the lane's tree under `R-D/tree/`, served on 24501,
takes other lanes' work in progress out while they edit):

- End to end with real input through W0's bot (`_tools/climb.mjs`, `climb.json`, and against the
  integrated repo on 24500 from R-C's Lift Foot into R-E's Pilgrim Path, `climb-integrated/`):
  C3, the lift to the break (23.5 s from the Lift Foot's door), the whole climb (81.8 s, resting
  at shrine 4 sets `shrine:4`), the Crown (terminal woken with the roster, summoning with the seals
  forming, both shutters closing and the arena clamp on, the cooldown panel, the express lever
  sets `lever:express`), the Blade (`blade:cleared`), E1. 561 ticks of gust push (3.7 H in all),
  no falls, no pits, 12 jumps (all 0.8 H housings), no console errors. Returning through the
  express lift: Lift Foot to the Crown in 34.7 s (36.9 s through R-C's two-press gate). W0's
  `round.mjs` over the tree: the whole round walks with these rooms (downloads first visit 280.9 s,
  returning 118.0 s; illustrations 372.1 s, returning 39.6 s; all 13 flags survive the reload).
- Gusts (`_tools/gusts.mjs`, `gusts.json`): the tell starts 1.48 to 1.50 s before every push;
  standing still for two cycles in the middle of every catwalk and right against its stop, the
  feet never pass the stop (they stop 20.8 px short) and never drop; walking into the wind and
  with it through a gust on every catwalk, no drop, no pit. The secret: jump, double jump and air
  dash off row 52 reach the perch; an early dash lands on the catch ledge; a jump from the catch
  ledge regains row 52.
- Motion (`gif/`): two gust cycles on row 46 (the rain angle calm and gusting: `gust-lean.png`),
  the whole ride, the storm break walked through, the summon, the alcove through a strike.
- Common checks (W0's `checks.mjs` over the tree, `checks/`): 1920x1080 at 1.5x sharp-bilinear,
  2560x1440 at 2x nearest, phone landscape 2532x1170 at 1.625x sharp-bilinear, H 80 (the
  stand-in box with halo and glaive is 99, as W0's); flash starts at most 1 in any second in D1
  to D4 over 60 s (reduced motion: at most 1). Cost at 1280x720, render + readback, d3d11 on the
  RTX 4090 (`checks/checks.json`, `_tools/cost.mjs` at other standpoints): D1 1.2 to 1.5, D2 3.1 to
  3.4, D3 3.1 to 3.9, D4 1.5 to 2.4 ms; SwiftShader D1 121, D2 198 to 222, D3 118, D4 236 ms.
  Pixel cells per room: D2 3.0 M, D3 1.4 M, D4 0.5 M. Not measured on a laptop (I1).

**Fix pass after the critic (2026-09-29, `review/world/phase2/R-D/fix/`, the integrated repo served
with no HMR or watching on 24502, `fix/serve.mjs`):**

- The Blade's bench no longer floats: the tip deck is now 3.3 H long and the bench stands on it
  (seat top 84.275, the ground under its whole footprint 84.0 in collision, `fix/bench.json`;
  before and after at 1440p, `fix/D4-bench-before-after-1440.png`). The vista capture stands on
  the tip beside it (`_tools/views.mjs` D4-tip at x 313.1). Blade 20.5 s, unchanged.
- The whole climb again with real input on the integrated repo (`fix/climb/climb.json`): ride
  25.8 s, climb 81.8 s, Crown 23.9 s, Blade 20.5 s, express return 36.9 s; 561 gust pushes
  (3.71 H), no falls, no pits, 12 jumps, no console errors; shrine 4, express lever and
  blade-cleared set; the cooldown panel says no warden answers yet and links the downloads.
- The D1 foundry yard (`fix/D1-floor-before-after-phone.png`): no flat black slab, no amber strip
  under it on the phone.
- The terminal's caret shows (`fix/D3-woken-screen-zoom.png`).
- The lit lamps and the colossi below (`fix/views-lit-1440/`, `fix/D4-colossi-before-after-1440.png`).
- Checks (`fix/checks/checks.json`; 1080p, 1440p and phone captures under `fix/checks/rooms/`):
  flash starts at most 1 in any second in D1 to D4 over 60 s, reduced motion too (an earlier run
  of the same check saw 2 in one second in D4, inside the gate's limit of 3); d3d11 at 1280x720:
  D1 1.9 to 2.1, D2 3.0 to 3.2, D3 3.0, D4 2.0 to 2.6 ms.
- A correction to the gusts line above: `gusts.json` records one 80 px drop on the y 2440
  catwalk walking west; that is her walking off the catwalk's open west end in calm air (gust
  level 0 throughout) onto the step below (the critic traced it), not a gust. The gust itself
  never carries her off.
- Still open, and not the spire's to fix: *no white flash on the player* (below) and the summon
  framing (W0's `summon` close-up pushes in to about 9 H around her at the terminal, x 251 to
  260, so the seal ring at x 263 to 273 lighting in sequence is off screen; it should frame the
  arena clamp region, or let a room opt out).

**Found on the way (for W0 / P0 / the coordinator):**

- *No white flash on the player* (acceptance): the runtime's strikes brighten the player's key
  and whiten her rim (`weather.lighting`) and add a point light over each strike. The spire keeps
  that to the `rain` state's 1.2 strikes a minute and does its storm lightning inside the clouds;
  to meet the line fully W0 needs a weather option that keeps strikes off sprites (say `skyOnly`
  on the program), and a way for a scene's own flashes to ask for thunder.
- The adapter doesn't feed the pixel world's `actors`, `view`, `rain`, `reduced` or the global
  `flashGate` (the spire's director bridges the first four from the storm driver).
- Prop platforms always report the surface `wood` (`room.syncCollision`), so footsteps on the
  gust decks say wood, not wet metal; a surface on `Prop.solids()` boxes would fix it.
- The kit's verlet banner costs about 0.9 ms a frame awake and the storm never lets cloth sleep:
  the Crown uses `stormBanner` (a row-shear banner redrawn at 15 Hz), the director redraws kit
  pennants at 20 Hz and lets cloth well out of view sleep. D3's pixel simulation went from 6.1 to
  0.6 ms.
- A carrier in a room narrower than the view: the backdrop's camera clamps to x 0 (its span is 0)
  while the world camera centres, so a backdrop that must line up with the shaft authors it at
  the screen's centre (D1 does).
- The kit door takes two presses (open, then through), so a bot needs a second E at R-C's Lift
  Foot gate (`climb.mjs` does; W0's `round.mjs` will too). The spire's own gates stand open.
- `blade:cleared` is set by the trigger at x 292, so a returning visitor's Blade is clear from
  the Crown's door (as planned); the break plays once per save.

## Region B: Shore and Plain (lane R-B, proven 2026-09-29)

`src/world/rooms/plain/` replaces the grey-box B1, B2 (with the B3 and B4 areas) and B5 by id,
with the grey-box's walk, spawns, exits and prop ids kept, so the round and W0's bot carry over.
Each room builds its collision and its backdrop's player plane from one geometry module in the
scene folder (`reed-shallows/geo.ts`, `causeway/geo.ts`, `hollow-mouth/geo.ts`), so the drawn
stair, boardwalk, road, crater, tor and platform stand exactly where the collision is (terrain
`art: "none"`). Two controllers sit in every room: `plain-keeper` (`keeper.ts`, a stub-engine
recipe found by the registry: it sees the player, the save and the backdrop) and `plainRumble`
(pixel matter: it can shake the camera and blow the grass); they talk through
`src/pixel/props/plain/bus.ts`. The crane's hook is `hook.ts` (the runtime's `Carrier` in the
region's steel). Region recipes in `src/pixel/props/plain/` (ENGINE.md, "Shore and Plain").
Tools in `_tools/` (port block 24300-24399; `serve.sh` starts a capture server with no HMR that
stubs the other region folders out while they are mid-edit; `RB_ISOLATE=0` loads everything).

| Room | What it is |
|---|---|
| B1 Reed Shallows | `reed-shallows` (refs w03 + w01): the arrival's lake late in the morning, sun breaking through, the reflections at their strongest; a colossus wading the shallows at depth 8 (a 95 s pass), its legs standing in the water in front of the far shore, spray tearing off a lifted foot and water streaming off it, its reflection breaking in the ripples; the ring far behind in the west, the spire small on the east horizon; mooring posts and a buoy line with no boat. Player plane: the yard's stone stair (standard steps), the old boardwalk with its 0.9 H gap (jump, or step down and wade round), the 6 H reed channel (wade, knee-deep), the steps up to the causeway. Pixel matter: the rope bridge (S1), 8 reed beds (5 behind, 2 low in front, 1 on the bank), 3 lamp posts, the blank ferry board, puddles, grass |
| B2 The Causeway | `causeway` (ref w01): an old stone road on its embankment across flooded sheet water under a grey-violet sky; the colossus walks the flats at depth 9 (a 94 s pass), close enough to fill the sky; a ghost deep in the haze; ahead, the black spire with its storm stuck to it (rare sheet lightning through the flash gate, its red light); mist in the west third, overcast on. The wind rises toward the east (`plainRumble`'s breeze, 3.5 to 8). Screen 1: red marker posts, two standing stones with prayer flags, the 1.1 H break. Screen 2: the broken colonnade (4 kit pillars), rubble, the footprint crater (standard steps down 2.8 H to a pool that reflects the storm sky, up again; packed-earth terraces with the road's broken flags in them). Screen 3: the 2.5 H break with the shin-deep wade, the rib arch you walk under (its two level ribs are one-way platforms). Screen 4: the shelter and Stonetop. 4 lamp posts, loose paper, grass and flowers |
| B3 Bus Shelter (area) | locked camera at 0.7, 4 dB duck, roofed (rain drips off the roof's two edges): the bus shelter (glass back wall, two panes cracked, blank timetable), shrine 2's lantern and bowl, the donation box and donor plaque (kit, real data only), a stone bench, the route sign with its numbers worn off, moths, puddles |
| B4 Stonetop (area) | free camera at 0.5: a tor of stacked weathered slabs behind the shelter (its own paler stone, lichen crusts on the shelves), climbed from the roof by one-way shelves 1.3 to 1.5 H apart (a fall lands on the shelf below); at the summit a bench, prayer flags on posts and a small stone, with a vista hold that puts the player high in the frame and the colossus passing at her eye level |
| B5 Hollow Mouth | `hollow-mouth` (ref w04 from above), pinhole vertical parallax (`geo.ts`): the plain's soil crust cut off above a shaft through the floors of something huge lying on its side; cool daylight from the rim, amber rising from the market below, girders and cables across the void, dust down and embers up; the spire close on the east sky. Player plane: the plain's lip with grass and roots, poured-concrete stairs (board marks, stains) to the culvert platform, the culvert (`culvertGate` in its arch, the kit lever inside beside it, the horn), the crane on the east lip (`craneFrame`, its hook the lift, a `callLever` at each end), the west wall's broken slabs (the optional way down, 4 H apart), the street at the bottom (`hollow-mouth/street.ts`): the hollow's paved floor drawn per pixel as the plane at the street's elevation (it recedes correctly at every height of the ride and meets every layer standing on it at that layer's ground row), two rows of market stalls on it (striped awnings, tents, a tall shack, crates, lamp posts, strings of lights) whose lanterns light pools on the floor, across the street the fallen structure's arcade (open bays on the lit floor, one bricked with a lit window, one shuttered, a lantern in another; broken off west into a rubble heap) and at the east end the stone arch full of the market's light, the way into C1. Chains, vines, 3 lamp posts toward shrine 3 |

**Mechanics.** The backdrops publish their clock and their colossi (the same `ColossusDef` the
shaders draw) to a feed (`causeway/shared.ts`, `WalkClock`); the keeper runs the walk's
TypeScript twin on it, so every footfall it finds is the one on screen. Near plants thud
(`colossus.footfall`); the one plant per pass whose big ring races across the water shakes the
camera (1 px in B1, 2 px in B2) through the rumble's host `shake` event, which the runtime drops
in reduced motion; when that ring reaches the player plane the rumble's wash bows every reed and
blade in the room at once. The keeper also hands the player to the pixel world (reeds and grass
part round her feet), reports `passing` while the colossus's body is near the view's centre (for
the sound lane's wind-alone duck at Stonetop), lights the lamp posts from the save (on at once
if their shrine is lit, one after another when it gets lit here), and reapplies persisted
openings (`opens`: the culvert gate stays open after a reload). S1: the bridge counts a cut only
from the east bank (a hit east of the mast that parts the tail line) and mirrors its persisted
`cut` to `cut:rope-bridge`. S2: the lever inside the culvert sets `lever:culvert` and lifts the
gate; the horn blows; R-A's ferry at Pier's End wakes on that flag (R-A's `state.ts`); the
gate's door leads to S2. The hook carries you 32 H in 10 s and is called from either end.

**Verified.**

- `_tools/walk.mjs --shots 1` (real input, `review/world/phase2/R-B/walk.json`): the stair and
  the boardwalk; wading in the channel; a slash from the channel does nothing; cut from the east
  bank the deck swings down and you cross on it (not wading); the causeway, the break, the
  crater, the wade, shrine 2 in the shelter; the culvert lever opens the gate; the hook down,
  sent up, called down again from the street; after a reload the bridge is down (and walked on)
  and the gate is open; with `lever:culvert` R-A's ferry takes you to S2 and lands you at B5.
  Times: B1 30.5 s; the causeway 34.2 s end to end (27.5 s to the shelter; the plan's "about
  32 s", +7%); the hook 10 s; B1 to C1 111.7 s. No errors.
- `_tools/footfall.mjs` (`footfall/B1.json`, `B2.json`, GIFs): B1 pass 94.7 s, the big ring
  reaches the reeds 2.5 s after the plant and their lean goes from 0.22 to 1.14; shake 1 px for
  8 ticks. B2 pass 93.5 s, the wash 2.9 s after, the grass 0.46 to 0.75; shake 2 px. Reduced
  motion: no shake (0 px in both), the colossus at half speed (the engine's convention).
- `_tools/stonetop.mjs` (`stonetop.json`): the colossus fills 0.65 of the frame's height at its
  pass seen from the road and 0.79 from the summit (the plan: half).
- `_tools/check.mjs` (`checks.json`, 15 views, with `B5-low` on the last ledge and the B5 street on the phone too): 1280x720 at 1x, 1920x1080 at 1.5x
  sharp-bilinear, 2560x1440 at 2x nearest, phone landscape at 1.625x sharp-bilinear; H 80 (the
  stand-in box with halo and glaive is 99, as W0's). Flash starts at most 2 in any second (the
  spire's sheet lightning on the causeway and Stonetop; 1 in reduced motion; B1 and B5 none).
  Cost at 1280x720, render + readback, d3d11 on the RTX 4090: B1 4.5 to 5.6 ms, B2 4.9 to 6.6,
  B3 5.5, B4 5.5, B5 1.7 to 3.8 (the street 1.7 after its fix); SwiftShader B1 630, B2 564, B4 806, B5 185 ms. Not measured on
  a laptop (I1).
- `kit.mjs --only <the 11 ids> --out review/world/phase2/R-B/kit`: every region recipe recorded
  through its states, idle 0 uploads; motion GIFs of the bridge, the culvert, the crane, the
  wind and the Stonetop pass in `review/world/phase2/R-B/gif/`.
- W0's `round.mjs` (a copy, `review/world/phase2/R-B/round/`) with every region lane loaded
  walks A1 to A4 and all of region B, then stops at C1's archive door (another lane's room; R-A
  saw the same stop).

**Changed from the plan.** The crater is standard steps (0.2 x 0.3 H) down 2.8 H and up again
rather than ramps, as the grey-box built it; the hook's drop is 32 H (the grey-box's platform at
0 and street at -32; the plan says 34). B5's optional way down keeps the grey-box's broken slabs
4 H apart (the plan: 0.9 H drops; a fall costs nothing). The causeway's colossus walks at depth 9
(plan: 6 to 12).
The spire's storm is seen from here as a stuck cloud with rare sheet lightning, no weather on
the causeway itself beyond the mist-to-overcast zones and the rising wind.

## The round, integrated (lane I1, proven 2026-09-29)

Every region's real rooms, played once from a fresh save by W0's bot with real input, from the
dock round to the lodge and home to Pier's End. The story glue is `src/world/story/` (found by
`hooks.ts`; nobody edits `main.ts` or `game.ts`); the tools are in `src/world/story/_tools/`
(port block 24800-24899; capture server `sh src/world/tools/restart-capture.sh 24801`).

**What the story hook does** (`story/round.ts`, `story/lamps.ts`):

- **The evening arrives everywhere at once.** The sky door sets `round:done` as you step through,
  but the lodge on the far side was already built (the stream keeps E4's neighbours warm) with
  morning windows. When `round:done` is set this visit, the hook sets the session flag
  `evening`, tells R-A's rooms at once (`ringwater.forced`), and lets go every warm Ringwater room
  except the current one, so each is built again as evening when you reach it (an honest short
  load behind the door's fade). Proven: the loft you step into is `lodge (evening)`, the keeper
  away, the front door open; A1 and A0 are evening; she sits at Pier's End with two cups.
- **Home is the dock.** Once the round is done the next visit starts on the dock in the morning
  (section 2: "the first impression is canon"), not at the last shrine rested at (E2). Resting at
  a shrine later moves the start as the runtime always does.
- **The lamps you lit, seen from home and from the balcony.** Ringwater's lake backdrops (A0, A1,
  A2, A4) get one points layer on the far strand, at the colossus's depth: one warm flame per lit
  shrine (a stepped halo, a core with its tip, a thread of light over it), mirrored in the lake,
  reading the save live (4 times a second), so a lamp appears the moment its shrine is lit and a
  fresh save shows none. From Pier's End the six stand in a line between the leaning rock and the
  ferry bell, and the colossus walks over them while the keeper says her line. On the balcony
  (R-E's belfry scene) the scene's own lamps sat under the valley mist and could not be seen; the
  hook swaps that one layer for the same live lamps at all six places (the yard by the lake, the
  shelter, the hollow's mouth, the alcove halfway up the spire, the pilgrim shrine, the porch),
  drawn after the mist. The hook wraps a room's backdrop `SceneDef` in `room()` and copies the
  room def's property descriptors, so R-A's evening getters keep working.

**The first round, recorded** (`node src/world/story/_tools/round.mjs --rec 1`,
`review/world/phase2/I1/round.json`, beat stills in `beats/` and contact sheets in `sheets/`, 15
key-beat clips as MP4 and GIF plus `video/first-round-key-beats.mp4` and a timelapse of the whole
round in `video/`): 530.8 s from Enter to sitting with the keeper, of which 44.3 s were stops to
look and read (the dock 8 s, the panels, the Blade's tip, the look pew, the balcony, the ending).
Every beat of section 2 happened through the game: nothing usable in the first frame; the
keeper's first line (`keeper:greeted`); the account panel says the dex account isn't open yet;
the product board opens the website's downloads; the box the donate panel; shrine 1 lights the
yard's lamps; the cord cut unrolls the map; wading, then the bridge cut from the east bank;
shrine 2 in the shelter; the culvert lever; the hook down; shrine 3; the archive's index
(`/docs/?embed=world`) and the music at 0; the lift; the climb and shrine 4 in the alcove; the
terminal wakes, summons and cools down to "No warden answers yet. Downloads are always direct on
the website."; the express lever; the Blade clears (`blade:cleared`, the theme at cue 51.9 s);
shrines 5 and 6; work 01 alone with its alt text; the catalogue of all 9; the rose crank; the
look pew; the latch, the bell, the sky door to the loft; evening; the keeper at Pier's End, two
cups, sitting. 0 console errors; 14 jumps, all within the section 1 limits (ledges 0.8 H, gaps
1.1 H); flash starts over the whole round: 46, never more than 2 in any second.

**Pacing against section 10** (`node src/world/story/_tools/pacing.mjs`, `pacing.json`,
`pacing.png`): each beat's plan space and tension beside the band the running game was in there
(rules in the tool's header: interiors, roofs and one-screen underground rooms are cozy; one-screen
locked frames outdoors are medium; the rest outdoors vast; the arena or rain on an open ledge is
storm; overcast or rain seen from shelter is uneasy; serene and after are calm). Tension matches at
all 23 walked beats: one rise from the causeway's mist through the storm climb, a breather in the
alcove, the peak at the Crown, calm from the Blade on. Space matches at 18 of 23; the five that
differ are boundary cases the plan's own text describes that way (the yard "opens to vast
again", the arena reads vast until it clamps, the pilgrim shrine's terrace is open sky, the chapel
is "grand and cozy at once", Pier's End is "a vast view from a small private spot"). Cozy places
come every 0.5 to 2.4 minutes. The round's time shape follows the plan's to within 7% of its
length at every beat. The bot is faster than a person: 8.8 minutes against the plan's 13.75 with
stops, and 486 s of movement (rides, rests and panels included) against the plan's about 390 s of
pure walking; the 12 to 15 minutes is for people who stop to look, and needs a human playtest.

**Returning visitor** (from the dock, the shortcuts opened in the round), against section 6: dex
account 18.5 s (~21), donate 20.9 s (~22), map 29.2 s (~28), documentation 74.6 s (~70: ferry,
hook), downloads 121.1 s (~105, +15%: ferry, hook, express lift), illustrations 39.8 s (~40: the
sky door). S1: the lowered bridge is crossed without wading. **Later visit** (a reload): all 15
flags kept, the start is the dock, Ringwater is morning, the keeper is back at her counter, her
chair and cup sit in the loft, the lit lamps stand on the far strand. **Website scroll-away:** all
20 rooms.

**Common checks on the integrated tree** (`node src/world/story/_tools/checks.mjs`, W0's checks
over every room with every region and the story loaded, `review/world/phase2/I1/checks/`):
1920x1080 at 1.5x sharp-bilinear, 2560x1440 at 2x nearest, phone 2532x1170 at 1.625x
sharp-bilinear; H 80 (stand-in box with halo and glaive 99); feet at each room's anchor. Flash
starts in any second: at most 2 everywhere except A2 at 3 (the limit; R-A's known cluster of the
ring's random glints), 1 in reduced motion. Cost at 1280x720 on d3d11 (RTX 4090): 0.8 (D1) to
5.9 ms (B2); SwiftShader A1 492, B2 740, C1 523, D2 192, E3 103 ms. Lamps
(`node src/world/story/_tools/lamps.mjs`, `lamps/`): 0, 3 and 6 lit, morning and evening, A0, A1,
A4 and the balcony at 720p, 1080p, 1440p and phone.

**Pending, for Dex (not measured by any lane):** real-device runs on Samsung Internet (Android)
and iPad Safari, including whether iOS lets the music start outside the Enter gesture; a laptop
GPU frame-cost measurement per region; listening to every cue and entry (S1); a human first
round with a stopwatch against the 12 to 15 minutes.

**Asks for W0 from I1:** a `WorldApi` call to rebuild a room (`api.rebuild(id)`) and one to set
the start place (`api.setRest(room, spawn)`); the story reaches both through the page's world
handle today.

## Open

- Phone portrait shows the whole 16:9 view letterboxed and small; a portrait framing (a
  narrower crop or a rotate hint) needs a decision with Dex.
- ~~The arrival's deck at 0.91 against the plan's 0.8~~: settled by R-A at 0.8 (WORLD-PLAN
  section 1).
- Shader compile time on first load (above).
- The adapter draws through the pixel renderer's internals (above); pixel parts skip the
  reflection pass.
- The old test rooms (`rooms/arrival.ts`, `plain.ts`, `house.ts`) stay at `?world=test` until
  their regions exist; R-A takes over `arrival.ts`.
- Region B for the sound lane: the plain keeper's `state` is `passing` while the colossus is
  close (`api.prop("keeper").state`), for Stonetop's wind-alone duck; `colossus.footfall`,
  `water.wash` and `culvert.horn` are cued but nothing is listened to. (S1: the duck is wired and
  proven; all three cues have files.)
- Real Rosace sprites, the real map on the banner, donor and account data, the real ferry ride,
  listening approval for all sound (the beds are built: S1).
- Cross-lane source fixes are incorporated (see the current candidate above). Final release
  verification must use their explicit verdicts and inspect every region at desktop and phone
  size, including an actual evening ending with lamps rather than the morning sit fixture.
- Not tested: iOS Safari. Music and beds call `play()` from a timer outside the Enter gesture,
  and each music entry makes a new element; iOS may block that. Needs a real device.
- `theme-b` retains the existing paid-use provenance and Dex-selected arrangement. Its
  attribution says it is not a CC0/redistributable asset library, rather than claiming the
  site's playback is forbidden. Suno's linked paid-use guidance permits video-game use;
  private generation/download provenance remains outside this public repo. See the release
  record for the asset audit and the boundary of that check.
