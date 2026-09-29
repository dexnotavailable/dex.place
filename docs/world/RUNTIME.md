# World runtime (`/world/`)

The engine the whole world runs on: the locked scale, the presenter, rooms as data with
streaming, the camera, the lab's player at world scale, weather and time, ambient life, sound,
interaction and panels, the save, debug and touch. It is proven on a 3-room test world:
**arrival** (the dock under the ring, with the colossus wading the far water) → **the plain**
(the colossus crossing, mist to storm) → **the house** (indoors, two floors, the storm in the
windows). Mobs and bosses are out of scope; the arena hooks (terminal states, combat zoom) are in.

Status marks: **proven** (built and checked in captures), **in progress**, **proposed**.

## Run it

```
npx vite --port 22763 --strictPort --host 127.0.0.1      # any port in 22000-22999
```

Open `http://127.0.0.1:22763/world/`. Dev-only: `world/index.html` is not a build input
(`vite.config.ts` is not this lane's), so `npm run build` does not ship it yet.

| Input | Does |
|---|---|
| Enter / tap / click (first) | the one Enter action: control, and sound starts in its saved state |
| A D / arrows | move; W / Up / Space jump (hold for height, again in the air for the double jump) |
| S / Down + jump | drop through a one-way platform |
| J / left click, K / Shift / right click, Q, R | the lab's moveset (M1 string, dash, skill, ultimate) |
| E / Enter (after start) | use the nearest usable thing (a small key glyph shows over it) |
| M, the speaker top right | sound on / off (saved) |
| backquote | debug overlay (fps, scale, room, streaming, weather, camera, sound, save) + boxes |
| scroll down | the world closes like a curtain; the website links are underneath |

URL options: `?room=<id>&spawn=<id>`, `?debug`, `?manual` (no real-time loop; drive it from
`window.__world`: `advance(n)`, `press(a)`, `release(a)`, `begin()`, `use()`, `teleport(room,
spawn)`, `place(x, y?)`, `closeup(on)`, `state()`), `?mute`, `?fresh` (forget the save), `?go`
(skip the Enter gate, for automation).

## The locked scale (proven)

One source of truth for the numbers: `src/scenes/engine/scale.ts` (view 1280x720, player H 80,
close-up 144, the presentation rule). `src/world/config.ts` names them for the world and adds
what only the runtime needs (camera framing, bars, step heights, streaming depth). World
geometry is authored in H through `h(n)`.

| | |
|---|---|
| World view | 1280 x 720 world px |
| Player | H = 80 px (~11% of the view; the old site's hero was ~6%) |
| Close-up | 144 px render for combat zoom, cut-ins, portraits (`CLOSEUP_ZOOM` = 1.8) |
| Presentation | `presentRect()`: whole-number nearest when it fills the window (1440p: 2x, 4K: 3x); otherwise sharp-bilinear at the exact fit (1080p: 1.5x; phone landscape 2532x1170: 1.625x). Never plain bilinear. |
| Bars | 0.03 of the view height per bar exploring, up to 0.085 in cinematic zones |
| Jump reach (measured) | single 1.03 H, double 1.71 H; run 2 H/s |
| Steps | auto step-up 0.26 H, stick-to-steps 0.3 H |

**Heads-up:** there are now three scale files: `src/scenes/engine/scale.ts` (the world reads
this one), `src/pixel/scale.ts` (the pixel lane's) and this runtime's `config.ts`, which derives
from the first. The values agree today (the pixel lane's integer-cover threshold is also 0.92);
the coordinator should fold them into one module.

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
main        backdrop back pass -> far/back props, terrain, decals -> middle props ->
            effects (back) -> player -> effects (front) -> front props and terrain ->
            light layer (glows) -> ambient -> backdrop front pass -> prompt, HUD, debug
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
shaders take ~9 s to compile under ANGLE/D3D11 in headless Edge (their own `/scenes/` page reports
~17 s for the same scene); the CPU build is 0.2-0.5 s per room. Neighbours compile while you play.
Warm again (browser shader cache) is much faster. Cutting shader size is the scenes lane's lever.

The test world's backdrops: `scenes/arrival.ts` (the scenes lane's ring-over-lake + colossus
hybrid; the world hides only its figure and uses its dock as the pier's visual), `scenes/colossus-
plain.ts` (hides figure, causeway, cloth, corner rocks and its own lightning; the world's weather
drives lightning), and `backdrop/interior.ts` (this lane: plaster and timber, arched windows with
the outdoor weather, the distant ring and rain on the glass, window light and lamp pools, dust,
dark pillars in front).

## Rooms (proven)

`room/types.ts` is the data model; `rooms/*.ts` are the three rooms. A room has: size (in H),
a backdrop spec, sprite lighting, terrain pieces (solid or one-way, with art `stone`, `rock`,
`wood`, `earth`, `plaster` or `none` for collision only), spawns, edge exits, props (recipe + id +
params, optionally reflected), doors (prop id → room/spawn, or → a panel for an ordinary archive
door), framing zones, a weather program, sound, ambient life, a waterline, neighbours, a pit line.

- **Collision** (`room/collision.ts`): implements what the lab Player calls on its World (move,
  supported, groundAt, bounds). Solids, one-way platforms (down + jump drops through; the Player
  gets a proxied input so "down" only means that on a one-way), movers (a lift carries you),
  readable stairs, open edges where exits are.
- **Transitions**: edge exits and doors fade out, switch rooms (building if needed), place you at
  the spawn, fade in once the room is ready. Pits fade and return you to the last solid ground.
- **Shortcuts**: a door with `latch` is locked from its far side (it rattles); the same door
  prop with `latchSide` releases the latch (saved) and opens. Test world: the house's back door
  opens onto the arrival's lone shore door, which then opens both ways.
- **Streaming** (`room/room.ts` `RoomStream`): the current room and rooms within
  `STREAM.keepDepth` doors are built (neighbours in calm frames, shaders in the background);
  the rest are disposed. Only the current room simulates.
- **Camera** (`room/camera.ts`): look-ahead toward facing, feet at 0.78 of the view, vertical
  dead zone 0.55 H, clamped to the room; framing zones take over with a feather (fixed
  compositions, extra bars); shake and the zoom punch are the lab's calls; `setCloseup()` eases
  the 1.8x combat zoom that hands the player to the 144 px render.
- **Terrain art** (`room/terrain.ts`): lit albedo + normal slabs in the room's ramp; rock and
  earth rise in an irregular rim above their collision line.

## Props (stub engine, proven; real engine: proposed adapter)

`props-api.ts` is the interface the runtime talks to (matching PIXEL-MATTER: recipe, reason,
states, layers, collision, hit, use, lights, wind pushes, sound, save). `props/stub.ts` implements
it with a small cell rasteriser (materials with ramps, height profiles, pieces, ink outline in the
normal alpha, row-shear sway and swings, cloth rows), and `props/recipes.ts` has the test world's
props: lantern post, donation box, donor plaque, map banner (slash the cord, it unrolls, E reads
the map; the cut is saved), bench (rest: checkpoint, full health), door (closed / opening / open /
locked, latch shortcut), grass and reeds (bend, cut, regrow), piling (platform), buoy, standing
stone (solid), prayer flags (wind), bones, offering bowl, the red floor line (the one "go right"
hint), registry counter with bell (dex account), lectern (archive), bookshelf (platform), candles,
hanging lamp (swings, light), boss terminal (dormant / woken / summoning / cooling), artwork frame
(display only: never drawn into the world; E shows the piece), crate (damaged, broken), lift
(stops, easing, carries), house front.

The pixel lane's engine has since landed in `src/pixel/` (see `docs/props/ENGINE.md`) with its
own `PixelWorld` (hit, nearestUsable/use, lights, colliders, wind, events, saveData) and renderer.
**Proposed adapter:** one `PixelWorld` per room, created in `Room.build`; map `world.colliders()`
into `Collision`, `world.lights()` into the sprite lights, `world.blow()` from the pushes,
`world.hit()` from the player's hitboxes, its `panel` / `sound` / `state` events to
`openPanel` / `WorldAudio.play` / the arena hooks, its `saveData` to `Save`; draw its parts into
the world target inside the main pass (its renderer shares the lab lighting model). Rooms keep
their `props` lists; recipe names map to the engine's (`map-banner` → `mapBanner`, ...).

## Weather and time (proven)

`weather.ts`: states serene, mist, overcast, rain, storm, after (the clearing). A room's program
is one state or zones along its width (the plain: mist 0-20%, overcast to 44%, rain to 64%,
storm to the house), blended at the edges and eased over seconds. Interiors keep the outdoor
weather: you see it in the windows and hear it through the walls. Outputs: layer uniforms (rain,
wind, mist, darkness, flash, overcast, after), rain streaks far and near with wind slant, a mist
band, a flat storm grade, sky flashes and stepped bolts, lightning lights on the backdrop and a
strong point light over the strike (it rims the player), sprite lighting (ambient and key dim,
cold tint), wind with gusts for cloth, grass, flags and flames. Lightning asks the global flash
gate (at most 3 starts in any second; 1 per 2 s in reduced motion) and thunder follows after a
distance delay. Time of day (day / dusk / night) is a room property that scales the light.

Story beat: after about 40 s indoors during the storm, the plain's program switches to serene /
after-storm for the visit: you went in out of the storm and come out after it.

## Ambient life (proven, simple)

`ambient.ts`: dust in the player plane, moths around warm lights that are on, rain splashes on
the ground in view. The backdrops carry birds, motes in light, distant lights and the colossus's
gulls. Each is a hook that pixel-matter particles can replace.

## Sound (in progress: wired, not listened to)

`audio.ts`. Music never starts abruptly: a quiet gap, then a slow swell (9 s); rooms with the
same music keep it playing; level follows the weather (rain ducks it), interiors, panels and
silence zones (the reading lectern). Ambience beds cross-fade per room. Rain and wind are
synthesised from filtered noise at weather levels and muffled indoors; thunder is a low rumble
after the flash. Footsteps follow the surface under you.

Sources (per `legacy/site/public/audio` ATTRIBUTION.md and its last active runtime,
"suno-b-inhabited-v2"): the **Suno "B" theme** (`suno-theme-b-v1/support`), `arena-chamber-v1`
(held for the arena), the `exterior` / `interior` beds, the recorded CC0 footsteps and the
original synthesised effects. Contract cue ids without a file use the lab's placeholder synth.
Files load from `AUDIO_BASE` = `/legacy/site/public/audio` (Vite serves the repo root in dev).
**To ship:** copy those files into `public/audio/` and set `AUDIO_BASE` (legacy/ is never
served in production). Dex's ears are the approval; nothing here has been listened to.

## Interaction and panels (proven)

E uses the nearest usable prop in reach. Panels (`ui.ts`) are real DOM: focus moves in, Tab is
trapped, Esc / close / clicking outside returns to the world. They load the website's own pages
(`/donate/`, `/docs/`, `/downloads/`) in a frame with `?embed=world` appended so the site can
drop its chrome there (**website lane:** support `embed=world`), with a plain link to open the
page. The gallery panel shows one of Dex's pieces from `content/gallery/manifest.json` with a
link to all of them. Donors and dex account say plainly that they aren't connected yet; nothing
is faked. The terminal's summoning runs the combat zoom; with no warden yet it says so and links
the downloads (always direct on the website).

## Save, debug, touch (proven)

- `save.ts`: localStorage `dex.world.v1`: flags (`cut:<prop>`, `latch:<id>`), the last rest
  place (you start there next visit), sound on/off.
- Debug overlay (backquote): fps, frame cost, draws, the scale and presentation mode, room size
  in H, build and compile times, the live room set, weather, camera, sound, save; collision,
  prop and hit boxes and a 1 H bar next to the player.
- `touch.ts`: the lab's layout (move pad, jump, strike, dash, Q, R) plus down and a use button
  that appears only when something is usable.

## Verify

```
node src/world/tools/tour.mjs --tag 1080                                   # 1920x1080
node src/world/tools/tour.mjs --w 2560 --h 1440 --tag 1440
node src/world/tools/tour.mjs --w 844 --h 390 --dpr 3 --touch 1 --mobile 1 --tag phone-landscape
node src/world/tools/tour.mjs --w 390 --h 844 --dpr 3 --touch 1 --mobile 1 --tag phone-portrait
node src/world/tools/flow.mjs          # mechanics: jump reach, exits, doors, lift, latch, pit, save
node src/world/tools/gif.mjs           # motion: pilings hop, storm, lift (ffmpeg)
node src/world/tools/shot.mjs <out.png> "go&debug" 1920 1080 1 8000
```

All use `playwright-core` from `tools/scene-pipeline` driving Edge; port from `--port` or
`WORLD_PORT` (default 22763). Output goes to `review/world/runtime/` (git-ignored). Results on
2026-09-29: no console errors; 1080p at 1.5x sharp-bilinear, 1440p at 2x nearest, phone
landscape at 1.625x sharp-bilinear, phone portrait at 0.91x (letterboxed, small); flow: edge exit
to the plain, house door, lift rises 5.4 H and carries, storm passes after 40 s inside, back-door
latch saved and the shore door then opens, pit returns you to the dock, save survives a reload.

## Open

- Phone portrait shows the whole 16:9 view letterboxed and small; a portrait framing (a
  narrower crop or a rotate hint) needs a decision with Dex.
- The arrival's deck sits at 0.91 of the view (the scenes lane's composition); the world camera
  frames feet at 0.78 elsewhere. The arrival's reflections of the player and pilings fall in the
  last few rows above the bottom bar.
- Shader compile time on first load (above).
- Real Rosace sprites, the pixel-matter adapter, the real map on the banner, donor and account
  data, listening approval for all sound.
