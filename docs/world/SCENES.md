# Scene prototypes (/scenes/)

Quick, atmospheric vibe prototypes of the world look, one per ref, so Dex can open them side by
side and decide what to commit before the lanes start. Every pixel is generated in code at
runtime: no image files, no image generation, nothing traced from a ref. Refs live in the
git-ignored `review/refs/world/` (see `REFS.md`); captures go to `review/scenes/<scene>/`.

## Run it

```
npm run dev -- --port 19517 --strictPort --host 127.0.0.1
```

Open `http://127.0.0.1:19517/scenes/`. Use a port in 19500-19999. The page is dev-only: it
is not in `vite.config.ts`'s build inputs, so `npm run build` does not ship it.

| Key | Does |
|---|---|
| 1-9 (or the dim list bottom left) | switch scene (files in alphabetical order) |
| arrows / A D, or drag (mouse or touch) | pan the camera; the slow auto drift resumes 5 s after you let go |
| Space | auto drift on/off |
| Z | near 640x360 / far 960x540 |
| C | stand-in figure on/off |
| M | reduced motion (also on when the OS asks for it) |
| P | pause scene time |
| backquote | fps, frame cost, layer/draw counts |

URL options: `?scene=<id>`, `?far`, `?nochar`, `?reduced`, `?fps`, `?cam=0..1` (fixed camera),
`?t=<seconds>`, `?solo=a,b` / `?hide=a,b` (layer names, for debugging), `?manual` (no real-time
loop; drive it from `window.__scenes`: `step(n, dt)`, `setCam(t)`, `png()`, `select(id)`).

## Pixel rules (what the engine enforces)

- Everything renders into one low-res target, 640x360 (near) or 960x540 (far), shown at the
  largest whole-number scale that fits, letterboxed in black. Every texture is NEAREST.
- Toggling near/far **rebuilds** the scene at the new size (`ctx.u = H / 360`), so view-scaled
  things get finer pixels in far mode while character-scaled things (the figure, a dock, a lamp)
  stay the same pixel size. Far layers get finer detail for free; near layers use `chunk: 2-3`.
- Every layer's parallax offset is rounded to a whole pixel per layer, per frame. Cloud drift is
  whole pixels too (`floor(t * speed)`); shape change comes from domain-warp evolution, not
  sub-pixel sliding.
- Colours only come from ramps (2-7 colours, darkest first, hue-shifted shadows). Shaders compute
  a shade 0..1 and `ramp()` snaps it to a band, optionally dithering the band edge (ordered 4x4
  Bayer, keyed to the layer's own pixels so the pattern moves with the layer).
- Fog and haze are stepped: the sky/haze gradient is quantised into bands; fog that varies across
  a layer is quantised in eighths with dithered edges. A layer's own depth fog is exact (a flat
  layer stays flat, no dither noise everywhere).

## Files

```
scenes/index.html              the page (title "dex", no text)
src/scenes/main.ts             scene list (import.meta.glob), input, fps readout, automation hooks
src/scenes/scenes/<id>.ts      one scene per file, default export SceneDef   <- add yours here
src/scenes/engine/
  engine.ts      renderer: build, reflection pass, main pass, integer upscale, scissoring
  types.ts       SceneDef, LayerDef kinds, BuildCtx
  glsl.ts        shared GLSL: hashes, value noise, fbm/ridged, bayer, stepd, ramp, layerOff,
                 flashLight; point-sprite shader (particles, birds, glints, glows)
  layers.ts      procedural presets: sky, disc, mist, fogBand, shaftFn + shaft, water, glow
  pix.ts         Pix buffers, rasterisers, shape grammars: terrain, rangeProfile, cragProfile,
                 peakProfile, skyline, megastructure
  particles.ts   Motes (dust, motes, debris), Falling, Embers, Flock (birds)
  flashes.ts     FlashAccents + the global flash gate
  camera.ts      auto drift + manual pan
  character.ts   the stand-in figure
  palette.ts     ramps, shiftRamp(), palette texture
  noise.ts       CPU noise, seeded rng
tools/scene-pipeline/          capture and measurement scripts (below)
```

Adding a scene never touches a shared file: drop `src/scenes/scenes/<id>.ts` and it appears in
the list. If you need a new generic tool (a preset, a particle kind), add it to the engine in a
way that doesn't change existing behaviour, and note it here.

## The layer model

A scene is an ordered list of layers, drawn back to front.

- **depth**: distance in player-plane units. `1` is the character's plane, `2` is twice as far,
  `Infinity` is the sky, below `1` is foreground. Parallax = `1 / depth`.
- **fog**: defaults to `fog.max * (1 - exp(-fog.density * (depth - 1)))` from the scene's
  `FogSpec`; override per layer with `fog`.
- **coordinates**: a layer is authored in **screen pixels at mid-pan**. `p` (layer pixel) equals
  `s` (screen pixel) when the camera sits in the middle of its range; at other positions
  `p = s + round(camX * par) - round(span/2 * par)`. A layer at depth `d` must cover
  `ctx.panWidth(d)` pixels of width, centred on the screen, to never show an edge while panning.
- **bounds**: an optional layer-space box; the engine scissors to it, so a thin mist band only
  pays for its own rows. Pix layers are scissored to their solid texels automatically.
- **reflect**: a waterline (layer y). The layer is also drawn mirrored about it into the
  reflection buffer that water samples. Leave it off for things that shouldn't show in water.
- **blend**: `over` (default) or `add` (light: shafts, glows, glints).

Layer kinds:

| kind | what | use for |
|---|---|---|
| `glsl` | your GLSL body `vec4 layer(vec2 p, vec2 s)` run per pixel | anything procedural and animated: the ring, clouds, water; presets in `layers.ts` build these |
| `pix` | a `Pix` buffer you fill on the CPU at build time (shade, ramp, extra fog, emissive per texel) | silhouettes: terrain, cliffs, skylines, megastructures, docks, props |
| `points` | a `PointSystem` drawn as whole-pixel point sprites | dust, motes, embers, falling debris, birds, flash accents |
| `character` | the stand-in figure at `x`, `ground` | readability check, toggled with C |

A Pix texel stores data, not colour: R shade, G ramp row (+128 = emissive), B extra fog,
A solid. The shader lights it (`shade + sceneLight() + flashLight()`), snaps it to the ramp and
fogs it, so the shaft, a lamp or a flash light up rock and wood live.

### Presets (`layers.ts`)

- `sky()`: the fog gradient itself (so far layers dissolve into exactly the sky behind them),
  optional stars.
- `disc()`: sun, moon or planet with stepped shading, atmospheric rim and stepped halo.
- `mist()`: domain-warped fbm in a vertical band, whole-pixel drift, evolving shape, 2-4
  density levels with their own alpha, tinted toward the haze colour, brightened by
  `sceneLight()` (mist glows inside a light shaft). `loop` makes it tile horizontally.
- `fogBand()`: a flatter, wider mist for banks along a horizon.
- `shaftFn()` + `shaft()`: a light shaft's intensity field (put `shaftFn` in the prelude so every
  layer can be lit by it) and its visible additive beam.
- `water()`: per-row ground-plane parallax (row depth = `dNear / k`), stepped reflection that
  gets stronger toward the horizon, row-shear ripples, sparkles denser on bright reflections and
  in a sun pool, and ring ripples at given points.
- `glow()`: a small warm light with a slow stepped flicker.

Opt-in options added for ring-lake (defaults unchanged, so other scenes render exactly as before):
`FogSpec.dither` and `glow.dither` (how much of each sky band edge is dithered; default 0.85 /
0.8), `shaftFn({ fromShiftX })` (a GLSL expression added to the origin's x, to pin a shaft's top to
something at another depth), `water({ pool: { row, path }, waterDither })` (a ramp for sparkles in
the pool, a stepped lit path toward it, and the body/reflection dither; default 0.9),
`disc({ halo: { seam } })` (how much of each halo step edge is dithered; default 0.7) and
`mist({ edgeDither })` (how much of each density-level edge is dithered; default 0.9; lower
values make evolving cloud edges flip in patches instead of scattered single pixels).

### Shape grammars (`pix.ts`)

- `terrain(pix, {top, bottom, scale, chunk, light, strata, vertical, rim, ao, fog})`: fills
  under a profile with rock lit from a heightfield (ridged fbm) and optional ledges/fissures.
- Profiles: `rangeProfile` (ridges), `cragProfile` (spires and crags with shelves),
  `peakProfile`, `minProfile` (combine).
- `skyline()`: blocks, setbacks, spires, window lights.
- `megastructure()`: a leaning monolith: tiers, ribs, bands, cantilevers, sparse lit windows, a
  broken crown.

### Water and what stands in it

Water rows get nearer toward the bottom of the screen. With `k1` the water row of depth 1
(the waterline under the player plane), a thing at depth `d` meets the water at
`waterY(d) = hor - 1 + (H - hor) * k1 / d`, and water's `dNear = k1`. Two rules keep it right:

1. Draw the water layer **before** anything that stands in it, and give each standing layer its
   base at `waterY(depth)`. The rock then covers the farther water rows above its base, and the
   nearer rows below it show.
2. Mirror each standing layer about its own base (`reflect: waterY(depth)`), not the horizon.

### Light and time

- The scene's `prelude(ctx)` is GLSL shared by every layer. It must define
  `float sceneLight(vec2 s, float depth)`; use it for shafts, lamps, lava glow. Use
  `layerOff(depth)` to place a light that lives at some depth.
- `uTime` is scene seconds; `uReduced` is 1 in reduced motion. Presets slow themselves down
  there; do the same in your own bodies.

### Flash accents

`FlashAccents` emitters (`glint`, `glow`, `sheet`) ask one global gate before starting: at most
**3 starts in any rolling second** (1 per 2 s in reduced motion, with slower fade-in and 60%
intensity). Intensity steps in quarters, never shorter than 0.18 s. Give each emitter a
per-minute `rate`; rare means a few per minute. A `light` on the spec also throws light onto
nearby layers through `flashLight()` (for lightning inside clouds, a lamp flare).
Check with `node tools/scene-pipeline/flashcheck.mjs <scene> 120 [reduced]`.

### The stand-in figure

136 px skull top to sole, glaive 1.35 H, a dark silhouette with a 1 px rim toward the key light
(`rimDir`) and a softer second pixel. Give your scene a `standin` ramp whose top colour is its
rim light. It is lit by `sceneLight()` like everything else. It must stay readable in front of
every scene: put bright haze, water or a shaft behind it, not mid-grey rock.

## Writing a scene

```ts
import { mist, sky, terrain, Pix, rangeProfile, type SceneDef } from "../engine/index.ts";

const scene: SceneDef = {
  title: "my-scene",
  palette: { rock: ["#0b1013", "#1b2528", "#35464a", "#6f7563"], haze: [...], standin: [...] },
  fog: { stops: [[0, "#1b272c"], [0.6, "#7b928b"], [1, "#3f5754"]], density: 0.11, max: 0.8 },
  span: (W) => Math.round(W * 0.45),      // pan range at depth 1
  build: (ctx) => {
    const { W, H, u } = ctx;
    const hills = new Pix(ctx.panWidth(8), H);
    terrain(hills, { row: ctx.row("rock"), top: rangeProfile({ base: H * 0.7, amp: H * 0.2, scale: 60 * u, seed: 1 }), seed: 2, scale: 24 * u });
    return [
      sky(),
      mist({ name: "cloud", depth: 60, y0: 0, y1: H * 0.4, sx: 200 * u, sy: 14 * u, drift: -4, row: "haze" }),
      { kind: "pix", name: "hills", depth: 8, pix: hills, x: -(hills.w - W) / 2, y: 0 },
      { kind: "character", name: "figure", depth: 1, x: W / 2, ground: H - 30 },
    ];
  },
};
export default scene;
```

Author view-scaled sizes as fractions of `W`/`H` or multiples of `u`; author character-scaled
things in plain pixels. Use `ctx.rng` or fixed seeds so a scene is the same every load.

## Verify

Start the dev server, then from the repo root:

- `node tools/scene-pipeline/capture.mjs --scene <id> --port 19517 --stills 0,0.5,1 --frames 120 --dt 0.0667 --tag near`
  (add `--far`, `--pan` for a camera sweep): low-res stills plus x3 nearest upscales, the
  letterboxed window, a no-figure still, a frame sequence, GIF and MP4 (ffmpeg at
  `D:\Dex\Tools\ffmpeg-9.0.1-full_build`). Output: `review/scenes/<id>/`.
- `node tools/scene-pipeline/shot.mjs <out.png> "scene=<id>&solo=sky,ring" 10 0.5 2`: one quick
  still for tuning.
- `node tools/scene-pipeline/gpucost.mjs <id> [d3d11|swiftshader]`: synchronous ms per frame
  (render plus a 1-pixel readback, so the GPU has to finish). Headless rAF fps is not a real
  number; use this. `layercost.mjs` gives the cost per layer.
- `node tools/scene-pipeline/flashcheck.mjs <id> 120 [reduced]`: flash count and the worst
  rolling second. `gateStarts` / `maxGateStartsInAnySecond` count every flash that passed the
  global gate, including a scene's own flash systems (not only `FlashAccents`).

`gpucost`, `layercost` and `flashcheck` use port 19517 unless `SCENES_PORT` is set
(`SCENES_PORT=19683 node tools/scene-pipeline/gpucost.mjs <id>`); `capture` takes `--port`, and
`shot` takes the port as its sixth argument.

The scripts use `playwright-core` (installed in `tools/scene-pipeline/`, `npm install` there)
driving the installed Microsoft Edge; no browser download.

Judge motion through a full cycle at real size (GIF/MP4 or the live page), not single frames.

## Scenes

### ring-lake (ref w03): the arrival

A colossal broken ring ray-traced per pixel (a thick band: inner face, outer face, two side faces),
cropped by the frame, turning very slowly. Its axis is tipped so the lower arc swings away from
us: we look down onto the **inner face** of the arc, which curves from the upper-left corner down
to the horizon and up to a torn break on the right, the way the ref's big lit inner surface does.
The ring is backlit and dark, one value family: flat-shaded panels in long decks that run along the
arc (five on the inner face, three elsewhere), recessed bays, raised blocks, ribs across every
deck every 1/32 turn, grooves with a bevel. The focal point is where the sun's light cone through
the hole (`ringCone`, stepped in thirds, fixed to the ring's own layer so it pans with it) grazes
the inner face: panels there step up into the warm bands and the ribs and groove bevels flare into
hard warm lines. The inner face's rim against the hole is a hard light line; the near side face
reads as a dark thickness band with a lit lip; outer corners stay dark. Light is stepped before it
reaches the ramp and the ramp has no dither, so moving light changes pixels in patches. The haze
on the low arc is capped (it stays inside the ring's value family instead of turning into a pale
lens). The break is cut in big stepped blocks with a warm torn edge, sits in open sky above the
right-hand cliffs, and seven hull blocks hang beside it (`ring-chunks`), slowly swinging apart
and back. Pattern coordinates are whole fractions of a turn, so nothing seams where the angle
wraps.

A sun disc in the hole with a halo of four flat rings and narrow dithered seams (`halo.seam`, and
a 4-step fog glow with little dither), a stepped light shaft to the water whose top stays pinned to
the sun while its body pans at depth 7 (`shaftFn({ fromShiftX })`), turning warm toward the
bottom, with a flat warm pool where it lands and motes in it. Still water with per-row parallax,
reflections of everything that stands in it (the lit inner face gives a warm broken reflection),
sparse cool sparkles on open water and a warm sparkle path under the shaft, ring ripples at the
dock posts. Mist in five depths (high cloud 90, a veil that drifts across the sun and the upper
ring at 30, cloud across the lower arc, a horizon bank, low mist on the water), all with narrow
edge dither (`edgeDither: 0.35`). Far hills; a crag spire and stepped cliffs in the middle
distance with a dark core, a lit flank toward the sun, a shadow plane and a few ledges
(`flankPlanes`), kept darker than the hazier ring behind them so aerial perspective reads the
right way round (the haze lives in the air at their feet, not in the rock); the right cliffs are
low enough for the ring's right arm and break to rise above them. A dark cliff cropped on the right
with big planes and ledges and a short, dark, broken reflection (`cliffReflection`); low rocks, a
dock with a lantern and foreground rocks in front. Accents: glints on the rails where the cone lights
the inner face, sometimes on the torn ends (~9/min), a slow warm beacon at the break (~5/min),
birds every ~40 s, specks falling off the lower arc.

Checks (after the r2 critique fixes, captures in `review/scenes/ring-lake/r3/`): flashcheck 120 s,
11.5 flashes/min, at most 2 starts in any second (reduced: 3/min, at most 1). Over 15 s in near
mode 1.5% of pixels change per frame (r2: 1.7%) and 43% between the first and last frame; with only
sky, sun and ring shown, 0.12% change per frame (the slow turn of the panel pattern). Cost on an
RTX 4090 (D3D11): 0.61 ms near, 1.05 ms far. Under SwiftShader 53 ms near, 112 ms far. Not yet
measured on a real laptop. The far view is the better megalophobia read (the figure is about a
quarter of the frame height there, over a third in near).

### arrival (refs w03 + w01): the dock, and Ringwater's backdrops (lane R-A)

The ring-lake composition with the colossus walking the far strand behind the lake and through
the light shaft once a pass (about 118 s), each figure mirrored about its own waterline so the
pale body breaks up in the ripples. Since lane R-A (2026-09-29):

- **The deck sits at 0.8 of the view** (`arrival/geo.ts` `DECK_AT`; it was 0.91): the lake
  shows the reflected figure and pier under the dock, and the world's rooms keep the feet on
  that row (WORLD-PLAN section 1).
- **The rear-leg slice is fixed.** `colossus-plain/colossus.ts` `EXTENT.x1` was 300 design units;
  the far rear knee reaches 337 at the back of its swing (plus bow, joint and lumps), so the
  body-space clip and the Tracker's scissor cut it with a straight vertical line for about 35 s
  of every pass. It is 380 now (this also fixes colossus-plain, which uses the same body).
  Detector: `review/world/phase2/R-A/tools/edgecut.mjs` (68 of 116 sampled seconds had a cut of
  10 to 61 rows before; after, only straight leg edges and cliff occlusion of 10 to 15 rows).
- **`arrivalScene(opts)`** builds the world's variants from the same code (the default export
  is the /scenes/ composition, `arrivalScene()`): `dock` ("scene", "world": no lantern or
  figure, the older boardwalk 0.2 P lower with the red line and the cliff foot at the room's
  right end; "pier": Pier's End; "none"), `bias` (a camera bias at depth 1: every layer's
  content moves by bias / depth, glsl bodies are wrapped and `layerOff()` becomes `layerOffB()`
  so per-row parallax and depth-pinned things agree; `arrival/bias.ts`), `rise` (the view stands
  higher: everything in the lake meets the water lower in the frame), `without` (near layers to
  drop), `evening` (the evening palette and fog: the sun low and amber, rose and violet haze,
  darker water, a weaker shaft) and `extra` (the room's own near ground, drawn in the scene's
  palette and mirrored in its lake).
- The ring's glints are 4 a minute (were 6). The accents are random (Poisson), so a 60 s sample can
  still cluster 3 starts in a second (the global gate's limit; the plan's target is 2).

### monolith-planet (ref w02): the monolith

A pale moon fills most of the sky: per-pixel sphere shading, soft maria, sparse craters at three
sizes (one big one on the upper right), a thin bright atmospheric rim and a stepped blue halo on
the lit (left) limb, turning very slowly. A black megastructure leans across it, cropped by the top
of the frame: a near-vertical stem, a faceted elbow and a long blade. It is a shape grammar on
three spine sections (`monolith-planet/monolith.ts`): stepped setbacks, a lit bevel toward the
moon, a front face with panels, tier ledges, rails, trenches and ribbing, a blue-lit underside,
sawtooth fins along its back, a fringe of broken spikes under the blade, buttresses, antennas and
a glowing collar. Windows are sparse and twinkle; two bright slots mid-blade echo the ref.

Below it is a sea of cloud (`monolith-planet/clouds.ts`, a scene-local `billows()` layer): rows of
flattened puffs at three sizes, each with its own crest lit from the moon's side, the outer
silhouette brightest, puffs that slowly swell and sink, whole-pixel drift. The blue light rising
from under the monolith's foot (`uplight()` in the prelude) lights the structure's underside and
takes over the undersides of the nearby cloud through `sceneLight()`. Far ruins stand out of the
cloud sea, a horizon bank and flat far cloud floor sit behind the billows, high streaks cross the
moon.

Motion: a light pulse runs up the conduits (stem, then blade) every 14 s (24 s in reduced motion),
lighting the face around its head; soft blue glows and window glints on the surface (~9/min);
faint lightning glows inside the far cloud (~2.5/min); a capital ship and small groups of ships
with slow nav blinks cross the moon; birds far below; blue motes rising past the foot; near
motes. The figure stands at the broken end of a cantilevered ledge with a beacon post, with
wreckage (a heap, a truss girder) in the bottom-left foreground and a veiled ridge with pylon
stumps on the left.

Nothing in the engine was changed. Scene-local pieces: `clouds.ts` (billows), `ships.ts` (a
`PointSystem` drawing tiny hull bitmaps), `planet.ts` (planet GLSL), `monolith.ts` + `geo.ts`
(the structure and its shared geometry: the prelude and the pulse layer read the conduit ranges
from the same build, cached per mode).

Flash check (120 s): 8 starts/min, at most 1 in any second; reduced 4.5/min. Cost under
SwiftShader: 47 ms near, 94 ms far (ring-lake measured 41 / 87 the same way). The D3D11 number
could not be taken cleanly (the GPU was at 99% from other work: 5-8 ms, with ring-lake reading
9.6 ms at the same moment).

### amber-hollow (ref w04): the foundry hollow

The inside of a vast hollow, lit like w04: a near-white opening against near-black masses, and a
dark lower third broken only by furnace pockets and white searchlights. A dark far wall (depth
48) with a huge chamfered octagonal opening and a smaller one on the left, per-pixel in GLSL;
through them a rock face (depth 90, computed only inside the openings) built from diagonal
strata: warped bedding planes of uneven thickness, lit ledge tops, shadowed undersides, dark
joints, and a few bare pale slabs that shine. Its detail is strongest where the light falls, so
the core high on the right goes pale yellow-white and the dim parts stay hazy. Two stepped light
shafts fall out of the opening. The haze colour is bright only in the middle band and falls to
near-black at the ceiling and the floor.

The city at depths 22, 14 and 8 mixes slim towers (fewer antennas) with squat industrial
megablocks: two or three stepped tiers, each split into a shadowed side plane and a lit front
plane, lit lips, a cantilevered slab on a diagonal strut, and windows grouped into floor bands
and clusters. The hammerhead tower (depth 8) is modelled in planes: a shadowed left face, the
front, a recessed shaft, a lighter right face and a chamfer with a hard rim toward the opening's
core; its slab has a lit top, a light upper band, a dark lower band and a chamfered underside;
its windows are lit floor bands and a few dense clusters, not a scatter. It carries a hanging
side pod, a roof crane and a white searchlight; a second beam stands up from the district on the
right. A ceiling of three-plane hanging masses, pipes, lamps and cables (depth 11) drops specks.

Six furnace mouths (depth 7) are the only heat in the lower third: squat molten slots with a
boiling top edge and a crawling crust, and a tight stepped glow (stronger below than above) that
lights the layers around them through `sceneLight()`; embers rise from them and the low haze
glows only near them. Low roofs, tanks and chimneys (depth 5.5) leave a gap behind the figure so
the glow backs it; steam plumes rise from chimneys and two big vents, widening, drifting and
changing shape. A freighter (depth 5, a packed 4-bit sprite in GLSL, lit and fogged live)
crosses every 74 s with cold white headlights and a warm cone that lights the haze and whatever
it passes. Two big cranes (depth 4.2) slew, luff and hoist slowly. Flickering glyph signs (one
on the foundry block that washes its wall, three small ones in the district), flying traffic
lights, a raised bridge with a pylon lamp, a stepped foundry block, the gantry with a lamp, the
figure, and a foreground pipe run and girder. Near smoke (depth 2.2) is its own body: rounded
billows that rise a whole pixel at a time, broken into columns by a vertical noise term, and
thinned to about a third where they cross the foundry block, so they read as volumes in front of
it rather than stripes through it.

Accents: welding arcs in the district and on the hammerhead, furnace flares. All of them share
one minimum gap of 0.6 s between starts (`amber-hollow/flashes.ts`, on top of the engine's global
gate), so no second can hold more than 2.

Scene helpers live in `src/scenes/scenes/amber-hollow/` (geo, city and near silhouette grammars,
ship sprite, GLSL bodies, spaced flashes); no engine changes. The prelude adds two `shaftFn`
beams in front of the scene's own `sceneLight()`.

Checks (2026-09-29): flashcheck 600 s, 9.9 flashes/min with at most 2 starts in any second
(reduced: 4.2/min, at most 1); a later 300 s rerun gave 8.0/min, at most 2 (reduced 3.8/min, at
most 1). Synchronous frame cost on an RTX 4090 (D3D11): 0.99 ms near, 1.25 ms far (ring-lake
measured 1.01 / 0.72 at the same moment); the rerun measured 0.45 / 0.58 (ring-lake 0.52 / 0.52),
and real rendering in Edge held the 180 Hz refresh in near, far and reduced (p99 5.8 ms). Under
SwiftShader (not rerun) 107 ms near,
238 ms far (ring-lake 63 / 123): about 40 layers, the heaviest are the plumes, the haze in the
opening and the cranes. Not yet measured on a real laptop.

### colossus-plain (ref w01): the colossus crossing

A pale colossus the size of weather walks right to left across the far distance of a dark plain,
on a loop. A second, smaller one walks its own slower loop much deeper in the haze, so the view is
rarely empty: a procession of two at different depths. One small figure stands on an old stone
causeway in front, beside a leaning marker post with a strip of red cloth whipping in the wind.

- **The creature** (`colossus-plain/colossus.ts`) is drawn per pixel from a 2D signed-distance
  body: ellipses and tapered capsules blended with smooth unions. Each part carries an outward
  gradient and a local radius, so the shader rounds the flat silhouette into a lit form (key
  light, sky light, cloud shadows through `sceneLight()`, lightning through `flashLight()`).
  The body is authored level and pitched front-up (`TILT`) for a hunched, rearing stance.
  Details: loose-skin folds, ribs rolling under the flanks, pores, back spines, a tentacled
  head that sways, tar-stained legs with drips and root-like toes, thin filaments hanging from
  the belly, and red branching growths off the back. Haze eats its rear, its far-side legs, its
  feet and its thin edges in steps.
- **The walk** exists twice with the same numbers: as GLSL for the body and dust, and as a
  TypeScript twin so CPU particles know where the feet are. A foot is planted in world space
  (it does not slide), then lifts (quick rise, slower fall) and plants again; the body bobs
  twice per cycle. Animation time is stepped at 12 fps. Each crossing starts with the head just
  off the right edge and ends with the tail off the left (`crossing()` in the scene file), so
  the loop wrap happens out of view. Near mode: about 63 s on screen out of a 95 s loop; the
  ghost is on a 200 s loop.
- **Dust and debris**: a dust billow and a low skirt where each foot lands, a smaller puff when
  it lifts, dark clods thrown up as a foot peels off, bits dropping from a swinging foot.
  Birds wheel over its back like gulls over a whale.
- **The plain** (`colossus-plain/ground.ts`) is one ground-plane layer: each row below the
  horizon is a distance with its own whole-pixel parallax (like `water()`), with soil streaks,
  pale flats, grit blown along the ground, stepped ground fog at the horizon, and slow cloud
  shadows and breaks of sun that also pass over the rocks and the creature (the prelude's
  `sceneLight()`).
- **Layers** back to front: sky, high streaks, soft cloud masses, lightning and sheet light,
  cloud deck, plain, far mesas, the ghost, a horizon fog bank, a far flock (kept behind the
  colossus so birds never cross the player), the colossus with its dust, debris, birds and eye
  glint, ground haze, a drifting veil, low outcrops and a standing stone, a low rock lip on the
  right, the causeway and post, cloth, figure, blowing grit, foreground rocks.
- **The rock lip** (depth 1.6) is a shape grammar of tilted strata shelves. The crest climbs
  from mid-frame to just above the colossus's ground line at the right edge, so feet planted
  out there sink behind it as in w01, while the entry path stays open. Each shelf has a lit
  ledge, an overhang shadow under the shelf above, and short leaning cracks that break it into
  blocks of varied length, all warped by noise so nothing tiles.
- **Accents**: short stepped lightning bolts deep in the cloud deck (light only, no sprite
  halo; the cloud around them brightens in its own shape), sheet lightning that sometimes
  pulses twice, and a rare glint in the creature's eye. All go through the global gate.

Scene-local systems in `colossus-plain/systems.ts` (not engine features): `Debris`,
`Wheelers`, `Bolts`, `SheetLight` (flash light without a sprite), `EyeGlint`, and `Tracker`,
which moves a layer's `bounds` every frame so the body and dust shaders only run over the
columns the creature can touch, and not at all between crossings. The engine already rereads
`bounds` every frame; the tracker just relies on that.

Checks: flashcheck 180 s, 9 gated flashes/min, at most 2 starts in any second (reduced: 2.7/min,
at most 1). Cost on an RTX 4090 (D3D11): about 0.9 ms near, under 1.5 ms far. Under SwiftShader
about 69 ms near and 154 ms far while the colossus is on screen, about 1.5x ring-lake; nearly
all of it is the colossus shader. Not yet measured on a real laptop.


### pilgrim-path and chapel (lane R-E; region E backdrops, 1280 x 720 world)

Built for their rooms rather than as free prototypes: each is drawn from its room's layout
(`PATH` in `pilgrim-path.ts`, `NAVE` in `chapel.ts`, `PORCH` and `BELFRY` in
`chapel/outside.ts`), and the depth-1 layers are authored in room pixels so treads, niches,
portals, sills and the belfry stair land exactly on the room's collision and props. Deeper
layers are authored at a reference camera row and slide with their depth, sideways and (in the
tall rooms) vertically. The default exports are /scenes/ previews at those framings; the world
imports `pilgrimScene`, `chapelScene`, `porchScene` and `belfryScene`.

- `pilgrim-path/dusk.ts` is the shared after-the-storm dusk: stepped sky with a warm horizon
  glow, a low sun sitting in the far broken ring's hole (a tilted band with a lit inner rim, a
  torn gap and drifting blocks), gold-lit cloud bands, the far range, the spire black on the
  horizon with its storm tearing into rags, three colossi walking west along the horizon, the
  violet valley with the lake holding the sun, valley mist, crags (deep under the path) or the
  chapel's cliff, birds, and the shrine lamps as warm points (only the shrines lit in the save,
  read from `dex.world.v1`).
- `pilgrim-path`: the fallen ring segment (hull plates with inset panels, a lip course,
  missing plates, a lit tread lip on every step, hanging ribs, a railing of posts, the terrace's
  shrine wall, the fins that hold the stained glass, the curved rib with the bell's arm and its
  brackets, the cliff by the chapel).
- `chapel`: the nave (coursed limestone, clustered piers, a pointed arcade open to a side aisle
  with glowing lancets and stepped shafts, two closed bays for the tapestries, the west portal in
  three orders around the doors and the rose, the chancel wall with four niches and a blind
  arcade frieze, the east arch to the bell stair), candle pools stepped and dithered, clerestory
  shafts and motes. `chapel/outside.ts`: the porch (the west front, a portal, a lancet with a
  sill, the eave and tiles, a column) and the bell tower (an open arcade, flight one, a flying
  stair on an arch with an oculus, the balcony and its corbels, the belfry shaft and bell-cote,
  and a balustrade layer forced into the front pass so it draws in front of the player).

Cost (in the world, whole frame): 0.9 to 3.4 ms on d3d11; the dusk rooms are the most, E1 at
about 3 ms. Captures: `review/world/phase2/R-E/`.

### reed-shallows, causeway and hollow-mouth (lane R-B; region B backdrops, 1280 x 720 world)

Built for their rooms from the colossus-plain pieces: each scene's player plane is drawn from the
same geometry module its room builds collision from (`reed-shallows/geo.ts`, `causeway/geo.ts`,
`hollow-mouth/geo.ts`), so stairs, boardwalk, road, crater, tor, platform and ledges land on the
collision. The default exports are /scenes/ previews at the room's reference framing; the world
imports `reedShallows(true)`, `causeway(true)` and `hollowMouth(true)`, whose rows follow the
camera up the yard stair, up Stonetop and down the shaft.

- `causeway/shared.ts` is the region's kit: the colossus-plain colossus reused unchanged
  (`crossing`, and `bodyGlsl` with a body-space clip wider than `EXTENT.x1` so no knee is ever
  sliced by a straight line), the walk feed (`WalkClock`: the backdrop's clock and its colossi,
  read by the room's keeper so gameplay footfalls match the drawn ones), ring ripples on water
  computed in GLSL from the same walk (a small ring at every planted foot, and once a pass the
  big ring that races to the player plane), spray and drips where wading feet leave and enter
  water, the far ring (west) and the spire with its stuck storm and red light (east), `camY()`
  for vertical rooms, and a splitter for wide depth-1 art.
- **reed-shallows** (w03 + w01): the arrival's lake late in the morning, sun breaking through,
  the strongest reflections; the colossus wading at depth 8 in front of the far shore; reeds,
  mooring posts and a buoy line (`reed-shallows/reeds.ts`, `water.ts`); the yard stair, the
  boardwalk with its gap and the banks (`land.ts`).
- **causeway** (w01): the stone road on its embankment across flooded sheet water
  (`causeway/flats.ts`), the colossus at depth 9 and a ghost in the haze, rare sheet lightning
  on the spire through the flash gate; the road with its breaks, the footprint crater (earth
  terraces with the road's broken flags in them, its own palette row `earth`) and Stonetop, a tor
  of bedded slabs in a paler stone (`tor`) over a darker core, painted with `terrain()`
  (`causeway/road.ts`).
- **hollow-mouth** (w04 from above): a pinhole vertical parallax (a feature at room row R and
  depth d sits at layer row EYE + (R - EYE) / d); the soil crust, the shaft through the tilted
  floors of the fallen structure, cool light from the rim and amber from the market below,
  girders, cables, dust and embers; at the player plane the poured-concrete stairs and platform
  (board marks, aggregate, stains), the culvert's arch, the west wall's broken slabs, the
  street. The bottom (`hollow-mouth/street.ts`): the hollow's floor as a per-pixel pinhole plane
  (depth = (street row - eye - camY) / (row - eye); sideways (x - W/2) * depth + W/2) with setts,
  puddles and lamplight pools; stall rows at depths 3.1 and 2.05 whose lanterns feed the pools;
  the fallen structure's arcade at 1.3 (torn off west into rubble); the east arch at 1.06 full of
  the market's light, with an additive spill on the street.

Cost (in the world, whole frame at 1280x720, d3d11): B1 4.5 to 5.6 ms, B2 4.9 to 6.6, B5 1.7 to
3.8. Captures: `review/world/phase2/R-B/` (the B5 street fix: `fix-b5/`).
