# Pixel matter engine (`src/pixel/`)

The engine that `PIXEL-MATTER.md` describes, built. A prop is a recipe: code that writes cells.
There are no image files. This page is the recipe format for prop lanes and the API for the lane
that places props in the world. If this page and the code disagree, the code wins and this page
gets fixed in the same change.

Status: **proven** in the `/props/` sandbox: the six proof props (map banner, boss terminal,
donation box and donor plaque, stained-glass window, candelabra, destructible floor), the font,
and the **shared kit** for phase 2 (26 more recipes, see "The shared kit" below). Every recipe
is recorded through its states by `src/pixel/tools/kit.mjs`; phase 2 captures live in
`review/world/phase2/P0/` (git-ignored). Proven 2026-09-29 by lane P0.

## Scale (locked)

One source of truth: `src/scenes/engine/scale.ts`, the locked scale the scene engine and the
world runtime read. `src/pixel/scale.ts` only renames its numbers for this engine (`SCALE.H`,
`closeupH`, `present.integerCover`) and calls its `presentRect` for the presentation rule, so
the two can't drift apart; it adds `hu` and `physics`. Nudge a number in the scenes file.

| Setting | Value |
|---|---|
| World view | 1280 x 720 world px (double the old 640 x 360) |
| Player height `H` | 80 px in exploration (about 11% of the view; the old site's hero was about 6%) |
| Close-up | 144 px (cut-ins, combat zoom, portraits) |
| Presentation | Largest whole-number nearest upscale when it covers at least 92% of the screen; otherwise **sharp-bilinear**: nearest upscale to the next whole multiple, then a linear downsample to fit (1.5x on 1080p). Never plain bilinear. |
| Physics | gravity 17.5 H/s², so motion scales with H |

Every recipe sizes itself from `H` (`b.u(0.5)` is half a player height, rounded to whole
pixels). The sandbox's H toggle rebuilds the same recipes at 144 to prove it.

## Run it

```
npx vite --port 24100 --strictPort --host 127.0.0.1     # then open /props/ (P0's ports: 24100-24199)
```

`/props/` is dev-only (not in the build inputs). URL options: `?h=144`, `?lab` (lab lighting
instead of the chapel's), `?manual` (no RAF loop; drive it from `window.__pixel`),
`?prop=<id>` (one registered recipe on its stage, with its variants and companions), `?kit`
(every registered recipe in one lineup: the kit, then each region folder), `?indoor` (the
chapel wall behind a stage), `?nave` (a sway-only room), `?reduced` (reduced motion),
`?wind=<px/s²>`. The panel's "open a stage" list has every registered recipe.

| Input | Does |
|---|---|
| click | fire the current tool from the H gauge toward the cursor (`point` hits at the cursor) |
| 1-7 | tools: slash, heavy, Q, R, point, dash wind, move light |
| J K Q R F | slash, heavy, Q, R, dash wind from the gauge |
| A / D, shift+click | walk the gauge / put it at the cursor |
| E | use the nearest usable prop (opens real DOM panels) |
| V, P, `.`, Tab | cycle view (lit, albedo, normals, layers), pause, step, hide panel |

The panel has the prop picker (reason, state buttons, use, hit, restore, and the effects:
dissolve, reveal, assemble, disintegrate, glint), layer toggles, slow motion (1x, 0.25x, 0.1x),
the draggable light, lighting (chapel / lab), placeholder sound and live stats.

Captures run against a capture-only server with HMR and file watching off, so other lanes'
edits can't reload the page mid-recording: `bash src/pixel/tools/restart-capture-server.sh`
(`PORT=24101` by default; run it again after every edit). Frames come from the 1280 x 720
target and are only ever upscaled nearest.

| Tool | What it records |
|---|---|
| `node src/pixel/tools/kit.mjs [--only a,b] [--out dir]` | every registered recipe on its stage through its `demo.script`: a GIF, a still after each step, and `summary.json` (states seen, size against the plan's standard, breakage class, cues, idle cost, flash starts, console errors) |
| `node src/pixel/tools/lineup.mjs [--angle d3d11 or swiftshader]` | the `?kit` lineup through the real presenter at 1080p (1.5x sharp-bilinear), 1440p (2x), phone landscape and portrait, plus the 1x frames and the frame cost |
| `node src/pixel/tools/policy.mjs` | the breakage policy in a normal and a sway-only room (every move from both sides; cells, cloth, ropes, the floor, and `form` for code-drawn plants), healing, and the particle, chunk and ambient caps and flash gate under 17 s of spam (normal and reduced motion) |
| `node src/pixel/tools/shot.mjs "<query>" out.png [--scale 2] [--crop x,y,w,h]` | one frame |
| `node src/pixel/tools/capture.mjs` | the phase 1 proof-room captures |

## Cells

`CellGrid` (`cells.ts`) stores per cell: `mat` (material id), `tone` (ramp offset for details,
cracks, wear), `piece` (sub-part; higher pieces sit in front and get inner lines), `flags`,
`height` (-> normal), `hp` and `age`. A 2 px transparent pad surrounds the drawable area so
outlines have room. Coordinates in the API are logical (0,0 = top-left of the drawable area).

Flags: `F_NOINK` (no outline or inner line), `F_CRACK`, `F_SCORCH`, `F_FRESH` (just healed, one
tone brighter briefly), `F_HOT`, `F_ADDED` (not in the original: crater rims), `F_NOHIT`.

Every part is snapshotted after build (`grid.orig`), which is what healing and restore return to.

## Materials

`materials.ts`. A material is a 4-tone ramp (deep, shadow, lit, highlight; shadows cooler, lights
warmer) plus the thresholds on the key-lit value that pick a tone (Rosace's banding from
`art/rosace/palette.json`), outline colours (`line`, lit-side `selout`, `inner`), an optional
specular band, `emissive` (flame, glyphs, seal), `glow` (backlit share: stained glass, screens),
`glint`, and behaviour: `crumble` (stone), `shatter` (glass), `splinter` (wood), `dent` (metal),
`tear` (cloth, paper, rope), `gutter` (flame), `splash` (water), `none`. Plus `hardness` (hp per
cell), `bounce`, `friction`, `debris` (share of removed cells that fly as pixels) and a `sound`
family.

The world ramps are muted and top out below Rosace's W1 white so she stays the brightest thing on
screen. Her own materials are registered as `rosace.<name>` straight from her palette file. The
shared outline ink is her `OL`. Add a material with `defineMaterial(name, spec)`.

## How it looks (same pipeline as the characters)

`shaders.ts` `CELL_FS`, per world pixel:

1. **Ramp**: the key light picks a tone from the material ramp by the thresholds, shifted by the
   cell's tone; the specular band replaces the top tone where the normal faces the half vector.
2. **Lab lighting**: the lab's `SPRITE_FS` model (values from `src/lab/data/lighting.json`):
   ambient + key with the "baked" key influence (0.25), up to 16 point lights capped and eased
   into the room left below white, a light-colour band on texels facing a strong light, and the
   rim on the first surface pixel inside the silhouette, never on the outline. Parts can scale
   the rim (`part.rim = 0` for ropes, where every pixel is an edge).
3. **Outline**: empty pixels next to an inked cell take the material's `line`, or `selout` on
   the lit side (right and top with the current key); a cell next to a piece behind it becomes
   the `inner` line. Outline and inner lines follow carving live.

Emissive materials skip lighting and take their ramp tone from `part.heat` (flicker). Glow
materials mix toward their bright tones by `part.glow` (the window's backlight). A room can
override lighting (the sandbox's chapel is darker than the lab).

Views: `lit`, `albedo` (ramp only), `normals`, `layers` (tinted by layer).

## Layers

| Layer | Parallax | Use |
|---|---|---|
| `far` | 0.25 | distant shapes |
| `bg` | 1 | walls, windows, plaques, banners behind her |
| `mid` | 1 | things at her depth, solid or platforms; debris |
| `decal` | 1 | marks painted onto a surface; `mask: "ground"` clips to the ground's cells |
| *(actors)* | | the host draws the player and mobs here (`RenderOptions.actors`) |
| `fg` | 1.12 | in front of her |
| `light` | 1 | additive glows, beams, rings (stepped and dithered), additive particles |

Parts of one prop can sit on different layers. Offsets are rounded to whole pixels per layer.

## Recipe format

```ts
import { defineRecipe } from "../prop.ts";

export const lantern = defineRecipe<{ chain: number }, Refs>({
  id: "lantern",
  reason: "Why it is here (required; CANON).",
  defaults: { chain: 0.6 },                    // your params, sized in H
  use: { reach: 0.9, prompt: "light" },        // optional: E within 0.9 H of the prop's bounds
  persist: ["lit"],                            // optional: c.data keys saved for the visit
  build(b, p) {                                // p = your params + { H, seed, wear, variant }
    const u = (f: number) => b.u(f);           // H fractions -> whole px
    const body = b.part("body", {              // one CellGrid per part
      w: u(0.3), h: u(0.4),
      pivot: [u(0.15), 0],                     // pivot inside the part (default: bottom centre)
      at: [0, -u(1.5)],                        // where the pivot sits, prop-local (or parent-local)
      layer: "mid", z: 5, collide: "none", smoothRotate: true,
    });
    body.rect(0, 0, u(0.3), u(0.4), { mat: "iron", profile: "bevel", r: 2 });
    b.light({ part: "body", at: [u(0.15), u(0.2)], colour: [1, 0.7, 0.4], radius: u(2), flicker: 0.4 });
    b.glow({ part: "body", at: [u(0.15), u(0.2)], colour: [1, 0.6, 0.3], radius: u(0.3) });
    return { body: b.get("body") };            // refs the states use
  },
  initial: "on",                               // or (c) => c.data["lit"] ? "on" : "off"
  states: {
    on: {
      sound: "lamp.on",                        // cue on enter
      enter(c, from) {},
      update(c, dt) {},
      hit(c, h) { c.damage(h.hit); return "off"; },   // default material response, then a state
      use(c) { return "off"; },
      after: [10, "off"],                      // automatic transition
    },
    off: { use: () => "on" },
  },
});
```

`c` in a state is the `Prop`: `c.refs`, `c.part(name)`, `c.go(state)`, `c.t` (seconds in state),
`c.data` (persisted keys), `c.sound(id)`, `c.emit({ type, ... })`, `c.damage(hit, onlyParts?)`,
`c.cut(hit, { ropes, cloth })`, `c.world` (particles, tweens, lights, restore), `c.rand`.

A state with no `hit` handler applies `c.damage(hit)` automatically. A hit handler receives the
overlap before any damage (which parts, how many cells, contact point) and decides.

### Fields every phase 2 recipe sets

| Field | Required | What it does |
|---|---|---|
| `breakage` | yes | `never`, `heal`, `cut` or `floor` (see "Breakage policy"). The type requires it; at runtime a recipe without one is treated as `heal` and warns |
| `demo` | for the kit and region lanes | how the sandbox stages it (`at` H above the floor, `params`, `w`, `indoor`, `variants`, `with` companions such as a lamp for the moths) and its capture `script` (steps: `go`, `use`, `hit` + `from`/`face`, `act` + `arg`, `walk`, `wind`, `on` a companion, `wait` seconds) |
| `actions` | no | named host actions (`prop.act("ring")`): a bell's `ring`, a lamp post's `light` with a delay, a door's `open`, `close` and `release`, the banner's `shrines` |
| `cues` | no | sound cues emitted from code; state `sound` cues are collected automatically (`soundCues(recipe)` in the registry lists both, for the sound lane) |
| `standard` | where the plan gives a size | `{ w, h, parts }` in H from WORLD-PLAN section 1; `w` is the drawn width, `h` how far the top sits above the origin. `kit.mjs` checks it within 1 px |
| `feel` | no | hits within this many H reach the hit handler even when they touch no cell (grass bows from a swing, paper lifts in a dash) |
| `form` | when a part is drawn in code (dynamic) and can be cut | `(c) => number`: how much of the prop is there (grass: total blade height; vines: strand points). `policy.mjs` holds it exactly in a sway-only room and wants it back at the built value after healing, since cell counts cannot see dynamic parts |

### Drawing (PartBuilder, `builder.ts`)

Shapes, each with `{ mat, profile, r, depth, z, piece, tone, toneFn, paint, noInk, mode, hp, flags }`:

| Shape | Notes |
|---|---|
| `rect`, `roundRect` (`chamfer`), `circle`, `ellipse`, `ring` (`flat`) | |
| `poly(points)` | non-zero fill |
| `stroke(points, width \| widths)` | thick polyline, cylinder profile by default |
| `line` | 1 px Bresenham |
| `arch(x, y, w, h, { spring, pointed })` | pointed gothic arch (1 = equilateral) |
| `pixels(points)` | individual cells |
| `ornament(x, y, art, legend)` | a text pixel grid: `'.'` empty, other characters through the legend |
| `text(str, x, y)` | engraved (sunk, darker) or `raised` 3x5 text |

Profiles give the height the normals come from: `flat`, `dome` (rounded to radius `r`), `bevel`,
`cylV` (columns, candles), `cylH` (rods, rolls), `sunk` (engraving, recesses). `z` lifts a shape
onto what's under it (a trim on a box). Modes: `over` (default), `under` (only empty cells),
`paint` (recolour existing cells, keep their height), `raise`, `erase`.

Details (all coordinates are the part's own grid px; `region` is an inclusive
`{ x0, y0, x1, y1 }` rect, default the whole grid; `mats` limits a detail to those materials;
`tone` is the ramp step added, negative = darker):

| Detail | Signature |
|---|---|
| `speckle` | `speckle({ amount, seed?, tone? = -1, region?, mats?, scale? = 1 })`: value-noise flecks; `amount` 0..1 is the share of cells touched |
| `grain` | `grain({ dir? = "v", seed?, tone? = -1, density? = 0.28, region?, mats?, stretch? = 9 })`: streaks along x (`"h"`) or y (`"v"`); `stretch` is the streak length |
| `cracks` | `cracks(x, y, { n? = 2, len? = 10, seed?, tone? = -2, dir?, spread? = 1.2 })`: `n` random-walk cracks from (x, y), `dir` in radians (random if unset); flags the cells `F_CRACK` and sinks them 1 |
| `rivets` | `rivets(pts: [x, y][], { mat, r? = 1.2, z? })`: domed heads at each point, no ink line; `z` defaults to the height already there, so they sit on the surface |
| `wear` | `wear({ amount, seed?, region? })`: edge cells go missing (45%) or darken; `amount` 0..1 per edge cell |
| `bricks` | `bricks(x, y, w, h, { bw, bh, mat, mortar, stagger? = 0.5, seed?, z?, bevel?, piece?, tones?, jitter? })`: bevelled blocks over a mortar bed with per-block tone |

`piece(name)` selects the current piece.

### Parts, lights, glows, ropes, cloth (PropBuilder, `prop.ts`)

- `b.part(name, spec)`: `w, h, pivot, at, parent` (child parts move and rotate with the parent),
  `layer, z, parallax, outline (0/1/2 soft), lit, collide, hittable, ground, smoothRotate, mask,
  fog, visible`. After building, `b.get(name)` gives the `Part` for flags (`tag.heal = true`
  makes it mend like the floor).
- `b.light(...)`: a point light in the same list as effect lights, so it rim-lights Rosace in its
  colour. `level` (states animate it) and `flicker`.
- `b.glow(...)`: light-layer `disc`, `beam` (start, end, two widths) or `ring` (flattened).
- `b.rope(name, spec)`: verlet rope or chain with pins, slack, end mass; drawn as its own part;
  cut by slashes (`c.cut` in a hit handler; a plain `point` hit has no cut path), rests on the
  ground.
- `b.hang(partName, rope, { align? = true })`: the part rides the rope's free end (a lantern on
  its chain, a bell on a cord). Set the part's `pivot` to its hook; with `align` it turns with the
  last segment. Give the rope an `endMass` so the swing feels weighted. When the rope is cut the
  part falls with the loose end, lands on the ground and settles flat.

  ```ts
  const body = b.part("body", { w: u(0.3), h: u(0.4), pivot: [u(0.15), 0], z: 5 });
  // ... draw the body ...
  const { rope } = b.rope("chain", { from: [0, 0], to: [0, u(1.1)], segments: 10, mat: "iron",
    width: 2, chain: true, pinStart: true, endMass: 4 });
  b.hang("body", rope);
  ```
- `b.canvas(w, h)` + `b.cloth(name, spec)`: verlet cloth (2.5D: points carry a z so compressed
  cloth folds and lights like folds) that keeps the design's real pixels (inverse bilinear per
  quad). Pins, `push`, `tear`.
- `part.dynamic = (part, dt) => ...` re-rasterises a part each step (flames, glyph screens).

### Motion (`motion.ts`)

`sway`, `flicker`, `bob` (procedural); `Spring` and `Pendulum` (hits swing things, they settle);
`world.tweens.add({ target, key, to, dur, ease })` (keyed eased motion: doors, lifts, dissolves,
light levels); `Rope`, `Cloth`. Rotation is pixel-art safe: parts with `smoothRotate` rotate
through a Scale2x x2 index map (`scale2x2` in `render.ts`), sampled nearest, rebuilt only when
the part's shape changes.

### Pixel effects (`fx.ts`)

`dissolve(world, part, 0|1, dur, mode)` (ordered, noise, sweep), `assemble(world, part)` (every
cell flies home one by one, bottom rows first), `disintegrate(world, part, { dir, drift })`
(cells detach along a sweep into drifting particles of their own colours), `glint(part)` (a sweep
across metal and glass), `Ripples` (1D damped waves for a water surface; see `props/font.ts`).

### Breaking (`hits.ts`, `break.ts`)

- **Hits**: `{ shape, type, damage, force, dir, crater?, scar? }`. Shapes: `point`, `circle`,
  `rect`, `line`, `cone`, `arc` (an elliptical band between two angles, y down, that follows her
  swing). `presetHit(type, footX, footY, face, H)` gives her moves from `MOVESET.md`: slash (N1
  crescent 2.5 H across, 1.75 H tall), heavy (N4 chop + crater), Q (5.6 H by 1.8 H dome + crater),
  R (beams across the view, a crater each), point, dash wind.
- **Damage** by behaviour: stone loses hp, darkens, cracks spread, then cells come off; glass
  shatters the whole pane (piece) it touches; wood splinters (grain-stretched pieces); metal
  dents (height pushed in) and sparks; cloth, paper and rope cut along the core of a slash; flame
  reports to the prop (it gutters); `none` ignores.
- **Fracture**: removed cells split by Voronoi (smaller near the impact) into rigid chunks
  (gravity, bounce, spin, settle flat into rubble; they rotate through the same safe rotation)
  and single-pixel particles. **Debris keeps its real colours**: chunks are the actual cells,
  particles carry their cell's colour.
- **Ground**: `crater(world, part, x, y, rx, ry, rim, hit)` carves a bowl, piles a raised rim of
  the same stone on both sides, runs cracks down the face and throws debris and dust;
  `scar(world, part, hit)` grooves the surface where a slash crosses it.
- **Healing**: ground parts and parts tagged `heal` record wounds. After `world.heal.delay` (4.5 s
  in the sandbox) their chunks and pixels fly home and the rest reassembles from the bottom up;
  any wound mends in about `heal.time` (3.5 s). `world.restoreDebris(part)` and
  `world.restorePart(part)` do it on demand (the window's slow reassembly uses them).

## Game hooks

**In the world runtime (proven by lane W0, 2026-09-29):** `src/world/pixel/adapter.ts` runs one
`PixelWorld` per room and uses every hook below: hits from Rosace's moves as `presetHit` shapes,
E through `nearestUsable`, the `panel` / `sound` / `shake` / `summon` / `state` events and the
kit's `door` / `lever` / `rest` / `sit` / `stand` host events, colliders (as platform tops: pixel
matter never blocks the way), lights both ways, `blow` from the dash, `saveData` mirrored into the
world save (`cut` becomes `cut:<id>`), `releaseWorld` on room teardown, and `solidAt` extended with
the room's terrain so cords and debris rest on it. Recipes are looked up through
`src/pixel/registry.ts`. **Ask:** the adapter draws through `PixelRenderer`'s private per-layer
calls (`useCell`, `drawPart`, `drawGlows`, `drawParticles`) into the world's bound target; a
public "draw these layers into the bound target, no clear" call would remove that seam. Also:
`fg` / `far` parallax is computed from absolute room x, which shifts props in rooms wider than a
screen. See `docs/world/RUNTIME.md`, "Props".

| Hook | API |
|---|---|
| Hits | `world.hit(hit)` -> per prop reports; loose rubble gets knocked around |
| E / use | `world.nearestUsable(x, y)`, `world.use(x, y)`; recipes set `use.reach` (H, measured from the prop's drawn bounds, not its origin) and `prompt`. A prop hung high sets `use.zone`, a prop-local rect in H (`[x0, y0, x1, y1]`, y down, mirrored with the prop) that replaces the bounds: a lantern whose origin is its ceiling hook 2.6 H up uses `zone: [-0.4, 0, 0.4, 2.6]` to be usable from the floor |
| Panels | props emit `{ type: "panel", panel: "donate" \| "donors" \| "map" }`; the host opens real DOM panels (focus, close, Esc) |
| Light | `world.lights(view)` -> `PointLight[]` (same fields as the lab's), strongest 16; `world.glows()` |
| Collision | `part.collide`: `solid`, `platform`, `trigger`, `none`; `world.colliders()`, `world.solidAt(x, y)`, `world.groundY(x, fromY)` |
| Wind | `world.blow(x, y, r, fx, fy, dur)` (her dash and spins), `world.wind` (ambient); cloth, ropes, flames and the font answer |
| Sound | events `{ type: "sound", id, x, y, volume }`; ids are `<family>.hit`, `.break`, and per-state cues (`terminal.summon`, `donate.chime`, ...) |
| States | events `{ type: "state", prop, from, to }`; the terminal also emits `summon` and `warden` (`form`) |
| Save | `world.saveData[propId]` holds each prop's `persist` keys (the banner's cut); pass it back when rebuilding a room |
| Room teardown | `renderer.releaseWorld(world)` before dropping a world (room transition, rebuild, H change): frees every texture its parts and debris hold. Chunks that leave the world during play (landed home, evicted, cleared, `world.remove(prop)`) are retired and freed on the renderer's next frame automatically |
| Reason | `recipe.reason` is required; `defineRecipe` throws without it |
| Recipes by id | `findRecipe("map-banner")` / `recipe(id)` / `allRecipes()` from `src/pixel/registry.ts` (any spelling: kebab, camel, snake) |
| Host actions | `prop.act(name, arg)`: `shrineLantern` `light` / `douse`, `lampPost` `light` (arg: delay in s, for the chain of lamps after a shrine) / `off` / `flicker` / `gust`, `door` `open` / `close` / `release`, `hangingBell` `ring`, `mapBanner` `shrines` (arg: lit shrine numbers), `lever` `set`, `dust` `sift` (a far footfall), `rubble` `shake`, `cable` `shake`, `clothHanging` `gust`, `sign` `on` / `off` / `flicker`, `bench` `stand`, `candles` `light` / `snuff`, `hangingLantern` `on` / `off` / `nudge` |
| Story events | `{ type: "rest" }` (shrine lantern: save point, light the next lamps), `{ type: "sit", x, y }` and `{ type: "stand" }` (bench), `{ type: "door", action: "rattle" \| "unlatch" \| "open" \| "enter" }`, `{ type: "lever", on }`, `{ type: "bell", strength }` |
| Actors | `world.actors = [{ x, y, vx, h }]` each frame (the player, later mobs): grass parts, vines brush aside, puddles ring under steps, the offering bowl rocks, paper lifts when you hurry past |
| View | `world.view = { x, y, w, h }` each frame: dynamic parts more than 2 H outside it skip redrawing; ambient emitters spawn only in view |
| Weather | `world.wind` (steady + gust), `world.rain` (0..1: puddles dot), `world.reduced` (reduced motion: ambient halves, flashes go through the reduced gate) |
| Flash gate | `world.flashGate` (default: the scene engine's `FlashGate`, 3 starts a second, 1 per 2 s reduced). Every `flashLight` / `flashGlow` and a neon flicker asks it. World's `PixelRoom` delegates to its host callback using `game.seconds` and current `game.reduced`, and copies reduced mode before building/stepping props; assigning the host gate object directly would mix room-local and global clocks. Standalone/hostless worlds retain their local gate. Count accepted starts once at the authoritative host gate; delegated caller observations are separate and same-tick starts remain distinct. CPU regression: `node --test src/world/tools/shared-flash.test.mjs`; native appearance/flash qualification remains separate |
| Room rule | `world.breakage = "sway"` makes a room sway-only (the chapel nave) |

## Performance and budgets

- Cells live in two RGBA8 textures per part; undisturbed cells cost nothing but the draw. Only the
  dirty rect uploads (`texSubImage2D`); normals are recomputed for that rect only.
- Ropes, cloth and chunks sleep when still; healing touches only wound rects; dynamic parts
  (flames, cloth, glyph screens) re-upload each step while awake. A chunk counts as touching the
  ground within 1 px above it, is pushed out only by its real (fractional) depth, locks flat to a
  quarter turn (a long piece always on its long side), and sleeps after 0.35 s still (every chunk asleep about 2 s after a Q, and a
  sleeping chunk never moves again). Asleep, it only re-checks its support five times a second
  and wakes if the ground under it goes or grows into it.
- GPU memory: textures belong to parts. Retired parts are freed each frame and
  `releaseWorld` frees a whole room, so live textures return to the fresh-room count after every
  heal and every rebuild (see `review/world/props/fix/gpu.json`). `renderer.stats.gpuParts` is the
  number of parts holding textures.
- Building the 16 H sandbox room costs about 250-270 ms (`world.add` for 11 props, mostly cell
  rasterising and normals) plus about 50 ms for the first step and render (full uploads). Build
  the next room during a transition fade or ahead of time, not on the frame it appears.
- Budgets per room (`world.budget`): 72 chunks (the oldest settled rubble crumbles to dust past
  that; its cells still heal), 6000 particles (the oldest non-homing ones are replaced), 16
  lights.
- Measured in the sandbox, headless Edge on d3d11. A single Q with about 1.0 million cells in
  the room: 2.4-2.7 ms of CPU per frame (1.3-1.4 ms simulation), 116 draws, 72 chunks, about 600
  particles. Sustained spam (a heavy, Q, R, slash or wind every 8 frames for about 17 s, chunks
  at the 72 cap, particles at the 6000 cap): simulation p50 4.9 / p95 7.2 ms, render CPU p50 6.0 /
  p95 9.7 ms, so about 17 ms at p95, right at the 60 fps budget; idle simulation 0.5 ms
  (`review/world/props/fix/perf.json`). Normal play is well inside the budget; a mob-heavy fight
  with constant ground hits would need lower chunk and particle budgets. While the banner cloth
  moves it uploads about 1.6 MB per frame; it stops when the cloth sleeps.
- **Phase 2 (proven 2026-09-29, `review/world/phase2/P0/`):**
  - *Undisturbed props cost nothing once they have settled* (about 10 s for the map banner's
    cloth, which still uploads about 13.5 KB a frame at 5 s and 0 from 10 s on;
    `fix2/idle.json`). After settling every recipe measured 0 uploads and under 0.03 ms of
    simulation per frame, except live flames, which redraw at 15 Hz (hand-keyed
    pixel-art timing): about 0.26 uploads and 0.1-0.2 KB per frame per lamp, 2 KB for a full
    candelabra, plus the font, whose slow drip keeps its surface moving (2.8 KB per frame)
    (`kit/summary.json`). Ropes and cloth now sleep: their "still" test ignores points
    lying on the ground, ropes rest on the ground only (not on solid props), and a pennant has a
    looser threshold.
  - Dynamic parts upload only the rows they touched: `clearAll` marks the rect that held cells
    and cloth marks the rect it covers now (before: the whole grid every step).
  - `part.dynamicEvery` throttles a dynamic part (flames: 4); parts outside `world.view` wait.
  - Budgets: `world.budget.ambient` (320 motes, halved in reduced motion) on top of 72 chunks,
    6000 particles and 16 lights. Under 17 s of spam across the whole 36-recipe lineup (13 520 px
    wide, 66 props): particles peaked at 5998, chunks at 72, ambient at 53; simulation p50 8.3 /
    p95 11.1 ms; flash starts at most 3 in any second (1 per 2 s in reduced motion) with 207
    denied by the gate (`policy.json`). That room is far busier than any planned room.
  - The lineup renders at 1.4 ms a frame on d3d11 (render + 1 px readback, 1280 x 720) and
    46 ms on SwiftShader (`lineup/report-d3d11.json`, `lineup-swiftshader/`).

## Proof props (`src/pixel/props/`)

| Prop | States | Breaks / moves |
|---|---|---|
| `mapBanner` | rolled -> unrolling -> unrolled (E: map panel); `cut` persists | slash the cord: the roll drops, rows release, the hem swings; hits sway the cloth; the map never tears. Rod 1.8 H, cloth 2.4 H (plan sizes). The map is **the real route** from WORLD-PLAN section 3: the W side view (lake and ring, the plain with colossi, the hollow's bowl, the spire with its storm, the fallen ring segment, the chapel), the route as a dotted red line, the sky door's arc from the balcony back to the loft, and the six shrine marks, which show lit for the numbers passed in `shrines` (param or action) |
| `bossTerminal` | dormant -> woken -> summoning -> summoned -> cooldown -> dormant | E wakes, E summons (seal assembles from noise, beam rises, red light); the host calls `cooldown` after the fight; hits dent and spark, glitch the screen, sway the cables; it mends. 1.4 x 1.0 H (plan size); the screen redraws only when its picture changes |
| `donationBox` | idle -> used (E: donate panel, lamp flare, chime, glint) | never breaks (policy): hits flash and darken a shade, and that mends; no payment is ever faked. 0.5 H tall (plan size) |
| `donorPlaque` | idle (E: donors panel) | real names only; empty data stays blank engraved rules. 0.6 x 0.4 H (plan size), three rows |
| `stainedGlass` | idle -> broken -> restoring -> idle | panes shatter into glinting shards with real colours; light and shafts dim with the glass left; after 4.5 s the shards fly home one by one; the stone frame chips and mends |
| `candelabra` | lit, guttering, out, relighting (E relights) | wobbles on a spring through pixel-safe rotation; hits and the dash wind gutter flames (smoke); heavy hits crumble candles; flames light and rim the room |
| `floor` | idle | craters with raised rims, slash scars, cracks down the face, heals |
| `font` | still | water ripples and splashes on hits and wind |
| `wall`, `gauge` | | sandbox room and the H-tall scale figure in Rosace's palette |

## Breakage policy (WORLD-PLAN section 4, enforced)

Every recipe declares a class and the engine enforces it in `Prop.damage` and `Prop.cut`
(`break.ts` `damage(..., { keep })`):

| Class | Who | What hits do |
|---|---|---|
| `never` | service and story objects: donation box, donor plaque, the terminal, doors, shrine lantern, bells, lever, cables, the training dummy, dust, moths, puddles, paper | flash, shake, dent and spark; no cell ever leaves, no pane shatters, nothing tears or is cut; darkened cells mend |
| `heal` | glass outside the chapel, pillars, crates, barrels, benches, candles, plants, cloth, signs, luggage, rubble, lamp posts, lanterns, the offering bowl, the font | break for real; every drawn part mends in the room (the engine tags every static part `heal` by itself) |
| `cut` | the map banner (and R-B's rope bridge) | the cord cuts for good (`persist`); the rest mends |
| `floor` | the destructible floor | craters and scars that heal from the bottom up |

A room with `world.breakage = "sway"` (the nave) keeps every cell of every prop: nothing
fractures, tears or is cut; cloth and ropes are only pushed, grass blades only bend and vine
strands only swing (a rustle instead of a cut), rubble's `shake` only shudders the heap, and the
floor takes no crater or scar. Every code path that removes matter asks `prop.keepsCells` first:
`damage`, `cut`, the floor, pillar toppling, grass and vine cuts, rubble's `shake`.

Grass and vines are drawn in code into dynamic parts that are redrawn every frame, so a cell
count cannot see a mown blade. A recipe like that declares `form` (`Recipe.form`: grass returns
its total blade height, vines their strand points), and the policy check holds that number too.
Checked by `policy.mjs` (2026-09-29, `review/world/phase2/P0/fix2/policy.json`): every move
(heavy, Q, R, slash, dash wind, and a point at the prop's centre) from both sides of every prop
in the lineup. 0 cells or form lost by the 27 `never` props; everything whole again 14 s later,
form included (0 props not whole, 0 chunks left, the floor exact); and in a sway-only room 0
cells lost, 0 form lost, 0 tears, 0 cuts across all 69 props, with 0 floor cells changed. The
check catches the old gap: with the grass and vine gates removed it reports 4 sway violations
(grass 1190 -> 691, vines 85 -> 14; `policy-control-ungated.json`), which the earlier
static-cells-only check reported as 0.

## The shared kit (`src/pixel/props/*.ts`, lane P0)

Each has a `demo` with a capture script through its states; `kit.mjs` records them all
(`review/world/phase2/P0/kit/<id>.gif`, stills per step, `summary.json`). Sizes marked "plan"
are WORLD-PLAN section 1's and are checked within 1 px.

| Recipe | Kinds / params | States, actions | Breaks, moves, feeds |
|---|---|---|---|
| `shrineLantern` | `lit`, `ribbon` (the red cloth) | out -> lighting -> lit; E "rest" emits `rest`; `light`, `douse`; `lit` persists | never; hit shakes it and dips the flame; panes dark when out, warm when lit; light 2.8 H. 1.5 H (plan) |
| `offeringBowl` | `petals` | still; `ripple` | ripples from hits, rests and passing actors; petals drift on the ripples; stone chips and mends |
| `door` | `ordinary`, `sky` (red mark), `big` (arched double), `gate` (slides), `shutter` (rolls up); `latch` none / far / near; `beyond` dark / none; `frame` stone / timber; `solid` | closed, rattle, unlatching, opening, open, closing; E opens, rattles (latched far side) or releases the rail (near side, saved as `unlatched`) then opens; `open`, `close`, `release`; emits `door` events | never; the leaf swings in perspective (redrawn only while it moves), the gate slides, the shutter rolls; the maintenance rail tips off. 1.4 x 0.7 H / 4 x 2.5 H (plan) |
| `lampPost` | `lit`, `arm` side | off, lighting (after a delay), on, flicker; `light(delay)`, `off`, `flicker`, `gust` | the lantern swings on its hook (hits, wind, gusts); panes shatter and mend. 2.5 H (plan) |
| `bench` | `stone`, `wood`, `pew`; `length` | idle, sat (E sits: `sit` / `stand` events); `stand` | seat is a one-way platform; splinters and mends; rocks in a sway room. Seat 0.28 H (plan) |
| `candles` | `count`, `row` / `cluster`, stand `none` / `rack` / `ledge`, `lit` | lit, guttering, out, relighting (along the row); `light`, `snuff` | wind and hits gutter the flames they reach (smoke); wax crumbles and mends; one light per three candles |
| `hangingLantern` | `iron` / `paper`, `drop` | on, off (E); `on`, `off`, `nudge` | verlet chain with the lantern's weight: swings and settles; chains don't cut |
| `hangingBell` | `small` (ferry), `medium` (rib), `large` (chapel); `usable` | rest, swinging; `ring` (the latch rings it by itself) | never; pendulum bell with a lagging clapper: each strike is a `bell.ring` cue sized by the strike, a glint and a faint ring of light |
| `clothHanging` | `banner`, `tapestry` (the colossi's procession), `pennant` (on a pole, pinned at the hoist); colours | hanging, torn, restoring; `gust` | verlet cloth that keeps its pixels; slashes tear it, it fades, knits and returns; the pennant streams in the storm's wind |
| `prayerFlags` | `prayer` / `laundry`, `span`, `height`, `posts` | hanging, cut, restoring | flutter grows with the wind; a slash cuts the line and each half hangs from its post, then it restores |
| `grass` | `grass`, `dry`, `flowers`; width, height, density | growing | blades lean with the wind, part around actors, bow from swings and dashes; cut blades drop to stubs, leaves or petals scatter, they grow back (the step stays awake until every blade is back). In a sway room blades only bend and rustle. `form`: total blade height |
| `vines` | width, length, strands, `flowers` | growing | hanging strands sway, part when brushed, are cut short and grow back down. In a sway room strands only swing and rustle. `form`: strand points |
| `rubble` | `stone`, `brick`, `timber` | idle; `shake` | pieces knock off and mend; in a sway room `shake` only shudders the heap |
| `crate` | size, `stack` 1-3 | idle | solid, splinters along the grain, mends |
| `barrel` | | standing, tipping (rolls), restoring | a heavy hit, Q or R knocks it over and it rolls, then stands back |
| `luggage` | `suitcase` (the dock's scale anchor), `trunk`, `bag` | upright, tipping, tipped, righting | tips over about its foot, rights itself after a while. Suitcase 0.6 x 0.42 H plus its handle |
| `sign` | `board`, `hanging`, `post` (arrow), `neon`; `lines` (real words only) | idle; neon: lit, flicker (through the flash gate), spark, dark; `on`, `off`, `flicker` | boards dent and mend, hanging ones swing; neon sparks when hit and lights its surroundings |
| `cable` | `cable`, `chain`, `rope`; between two points or hanging free with a hook | hanging; `shake` | never; sags, swings when hit and in wind, settles |
| `pillar` | `round`, `square`, `broken`; height, width, stone | standing, fallen | chips and cracks; when enough is gone the upper drums fall as rubble, then fly home and it stands again |
| `trainingDummy` | | idle | never; every hit type has its own reaction (slash rocks it and knocks straw loose, heavy bends it far back, Q bounces it, R shudders it, point twitches it, wind sways it); always springs back |
| `lever` | `floor` / `wall`, `on` | off, pulling, on (persists); `set` | never; E pulls it over with a clank and emits `lever` |
| `dust` | `dust`, `ash`, `seeds`, `embers`, `grit`; rect, count, `lit` | drifting; `sift` (grit from a ceiling, in time with a footfall) | ambient motes that wander and ride the wind (the dash parts them), capped per room |
| `moths` | count, reach | waiting | find the nearest lit warm lamp and flutter round it; drift off when it goes out |
| `puddle` | width, sky `day` / `dusk` / `storm` | still | a sunk sheet of the sky's colour; footsteps ring it, hits splash it, rain dots it |
| `paper` | count | lying | wind, a dash or a hurried step lifts the pages; they flutter down showing their face; strays fade home |

Shared helpers for any recipe (`src/pixel/kit.ts`): `addFlame` / `stepFlame` / `snuffFlame` /
`lightFlame` (live 15 Hz flames with a light and a glow), `puff` (dust, splinters, straw, sparks,
smoke, water, petals, leaves, paper, ash), `glassTone` (panes dark when their light is out),
`hitPush`, `hitAt`, `remaining`, `matId`. New materials: earth, moss, grass, grassDry, three
flower colours, straw, burlap, canvas, clothPale / Gold / Teal, leather, leatherDark, rust,
copper, verdigris, cable, lampGlass, paperLamp, neonRose / Teal / Tube, bone, puddleDay / Dusk /
Storm, moth.

## Region recipes (auto-discovery)

Put a recipe in `src/pixel/props/<region>/<name>.ts` (`ringwater`, `plain`, `hollow`, `spire`,
`chapel`) and export it; that's all. `src/pixel/registry.ts` finds every exported recipe in
`src/pixel/props/*.ts` and `src/pixel/props/*/**/*.ts` with `import.meta.glob`, so no lane edits
a shared list (not `props/index.ts`, not the sandbox). It shows up in `/props/?kit`, in the
panel's stage list, at `/props/?prop=<id>`, and in `kit.mjs --only <id>`. Materials a region
file defines at module level load with it. Ids must be unique across all folders (duplicates are
reported in `REGISTRY_ERRORS`, shown in the sandbox panel). Import engine pieces from
`../../prop.ts`, `../../kit.ts` and so on, or from `../../index.ts`; the registry is not
re-exported from `index.ts`, so there is no import cycle. Proven with a throwaway folder
(`review/world/phase2/P0/discovery-proof.txt`).

### Chapel (`src/pixel/props/chapel/`, lane R-E, proven 2026-09-29)

Recorded through their states with `kit.mjs --only <ids> --out review/world/phase2/R-E/kit`
(undisturbed: 0 uploads and under 0.03 ms of simulation a frame; live flames redraw at 15 Hz like the kit's). Region materials in
`materials.ts`: `gilt`, `giltDark`, `artBoard`, `limestone`, `oak`, five sunset-backlit rose
glasses, `stoneware`, `dustBloom`, `broomStraw`, `shawlRose`.

| Recipe | States, actions | Breaks, moves |
|---|---|---|
| `artFrame` | idle; E emits `panel gallery <art>` | never; every part unhittable, so a hit passes through with no reaction. `easel` (the work 2.4 x 1.35 H on a 1.02 H tray) or `niche` (hung on a wire, 1.0 H sill). `artRect()` gives the work's rect for the DOM thumbnail |
| `catalogueLectern` | still, turning (a page lifts and flops back now and then, when you hurry past, or on a slash / dash); E emits `panel gallery all` | never |
| `roseWindow` | shut, opening (the oak leaves swing back on their hinges), sweeping (the shafts move east; each work's light and floor pool come on as they pass), lit; `open`, `settle`; persists `open` | never; hits knock the shutter. The biggest light: two own lights, a halo, three beams, a light and a pool per work (`targets`). `rest` (E3: 4) = the last works the light comes to rest on: a stronger light and pool there, the shafts settle spread across them, and works the sweep has passed keep a softer glow (45%) |
| `roseCrank` | closed, opening (the wheel spins, chain dust), open; persists `done` | never; emits the kit's `lever` event (the host sets its `flag`, `rose:open`) and calls the window's `open` |
| `censer` | hanging (smoke, more while it swings) | never; a chained pendulum on a wall bracket |
| `broom`, `shawl`, `dustyCup` | leaning / fallen (found leaning again), hanging (cloth pinned at its middle), still (rocks on its saucer, dust lifts) | never (story props) |
| `chapelDoor` | the kit door plus: one E opens it and it carries you through `auto` s after it stands open; releasing the latch rings `bell` once | never |
| `naveRule` | sets its world to `breakage = "sway"` | invisible |
| `pathLamp` | the kit lamp post, dark until the named shrine lantern (same room) is lit, then on after `1.2 + 0.55 * order` s; on at once when the shrine was already lit | heal |
| `naveBench` | the kit pew / bench without its own E (the room's `sit-spot` sits you) | heal (sway-only in the nave) |
| `votives` | the kit candles without E; a flame put out relights itself after 5 s | heal (sway-only in the nave) |
| `naveCandelabra` | the kit candelabra; a flame struck or blown out gutters and relights itself after 5 s (E still relights at once) | heal (sway-only in the nave) |

### Hollow (`src/pixel/props/hollow/`, lane R-C, proven 2026-09-29)

Materials (`materials.ts`, all `hollow*`): pipe red, walkway steel, flagstones, silhouettes,
the archivist's coat, hair and skin, book spines, the green lamp glass, hearth fire, dials,
digits, beacons, fluorescent tubes, waiting-room seats, tile, market goods.

| Recipe | What it does | Breakage |
|---|---|---|
| `gratingWalk`, `gratingStair` | the market walkway (open grating, channel beams, a rail behind) and its stairs at 0.2 x 0.3 H; draw only (terrain collides) | heal (dents) |
| `hollowFloor` | flagstone, tile or boards; craters, scars, heals; ground but not a collider | floor |
| `marketStall` | tools, lamps, cloth, pots or empty; posts, a 1.8 H roof, a striped verlet awning that tears and knits, counter and wares, a stall lamp; `gust` | heal |
| `marketFigure` | a silhouette at work: hammer (strikes an anvil, sparks), sort, sit (dozes), sweep; flinches when hit | never |
| `neonGlyph` | glyph tubes that mean nothing, or the archive's book mark; lit, flicker (flash gate), spark, dark | never |
| `steamVent` | a floor grate: wisps, hiss, burst (`world.blow`, a wind source, no damage) | never |
| `junctionBox` | sparks and lights the street for a moment (flash gate), settles; a slow lamp | never |
| `redPipe` | the underground route mark, flanges, brackets, a valve | heal |
| `hollowRadio` | the radio the muffled theme comes from; the speaker cloth breathes; rocks and crackles | never |
| `jibCrane` | a crane behind the walkway: the trolley runs now and then, the hook swings when hit | never |
| `hearthFire` | the Hearth Shrine's fire: flames, embers, one glow, an orange light that rims her | heal |
| `hollowCable` | a short cable span or a free chain with a hook, in a tight draw box | never |
| `marketLantern` | paper (under the walkway) or iron (over the archive door): one pendulum part, no chain sim | heal |
| `hollowFootfalls` | invisible: the far colossus's crossings; each thud sifts grit, sways lamps, shakes 1 px, pulses the backdrop (`pulse.ts`) | never |
| `archiveShelf` | a product bay with a plain sign; E emits `panel: archive, arg: g-<group>`; sways, rattles, a scroll falls and goes home | never |
| `archiveLectern` | the index; pages lift when you hurry or dash past; E opens the archive panel; makes its world sway-only | never |
| `archivist` | reads in her armchair, turns a page now and then; E: a hum and she looks up | never |
| `archiveLamp`, `hollowRug` | the green reading lamp on its side table; a worn rug | never |
| `waitingChairs` | a row of joined chairs (E sits, like a bench) | heal |
| `ticketDisplay` | frozen on one number; a hit drops the digits out once | never |
| `spireArrowSign` | an up arrow with the spire mark | never |
| `hollowBeacon` | off; amber and turning while the watched gate opens; `red` for an arena summon | never |
| `fluorescentStrip` | cold light; a tube stutters now and then (flash gate) | never |
| `hollowLiftCar` | the car in its shaft, counterweight, cables; parked, called (the gate opening), departing, arriving | never |
| `operatorBooth`, `operatorChair` | the empty booth and chair | heal |

### Ringwater (`src/pixel/props/ringwater/`, lane R-A, proven 2026-09-29)

Recorded through their states with `kit.mjs --only <ids> --out review/world/phase2/R-A/kit`;
idle cost 0 uploads except the 15 Hz flames (pier lantern, stove). Region materials in
`materials.ts`: the keeper's and the ferryman's (`ringSkin`, `ringHairGrey`, `ringDress`,
`ringShawl`, `ringApron`, `ringCoat`, `ringHat`), `ringGlaze`, `ringGlazeBlue`, `ringBoat`,
`ringReed`, `ringReedHead`, the lamp board's `ringLampOff` / `ringLampOn`, the speech card's
`ringSpeech` / `ringSpeechBack`, `ringInk`. Several are the kit's recipes re-dressed by spreading
the kit recipe and replacing what differs (the pattern R-E uses too).

| Recipe | States, actions | Breaks, moves |
|---|---|---|
| `registryCounter` | idle; E rings the bell and emits `panel account` | never; the bell swings and rings on any blow (the keeper named in `keeper` looks up), the ledger's page lifts in a dash. Top 0.55 H (plan) |
| `keeper` | lodge: working, acknowledging, speaking, away; pier: absent, sitting, speaking. E: her first line once (persists `greeted`), then only a look; at the pier the second line on E or after 1.5 s sitting beside her | never; drawn in cells at 0.92 H, the line on a small unlit card in the 3x5 font |
| `lampBoard` | idle; `on1` ... `on6` light one lamp each (idempotent) | never; shakes on its nails |
| `productBoard` | idle; E emits `panel downloads` | never; lists `productLines()`, the real entries of `src/site/data/downloads.ts`; the spire mark's red light blinks slowly (not a flash) |
| `stove` | lit | never; live fire (light 3.4 H), the kettle steams, hits ring the iron and rattle the lid |
| `cups` | still | never (story objects); `count` 1 to 3, `dusty` |
| `ringBench` | the kit bench without its own E (a `ring-seat` stub sits you) | heal |
| `lodgeShelf` | still | never; sways and rattles |
| `lodgeDoor` | the kit door plus: one E opens it and the host takes you through; it shuts behind you when nobody is near; `ajar` swings it open and leaves it | never |
| `skyDoor` | the kit door (`sky`, red mark, `beyond: none`, rail on the far side) plus: E opens it barred onto whatever the backdrop paints behind it, E again rattles the rail, it shuts when you walk away; `free` drops the rail for good (persists `unlatched`), then E goes through | never |
| `lodgeFacade` | home | never; the lodge from outside: stone footing, logs, eave, a warm window (a light), smoke from the stovepipe |
| `shrineArch` | idle | heal; stone posts with red cords, the lintel the map banner hangs from |
| `pierLantern` | on; `gust` | heal; the keeper's lamp: a lantern on a hook that swings and never goes out (hits dip it) |
| `mooring` | idle; `ripple` | heal; a post in the water with a verlet line to a bobbing float, a slow ring of light at its foot |
| `bellPost` | idle | heal; a timber post, with a crossbeam for the ferry bell (`reach`) or bare for a plaque (`back`) |
| `reeds` | growing | heal; the kit grass grown tall with seed heads (same motion, policy and `form`) |
| `ferryBoat` | asleep, waving (E while asleep), awake, boarding (E: a `door` event, the room's doors table says where); `ripple` | heal; the hull splinters and mends, it bobs and rocks, the ferryman breathes under his hat |

### Spire (`src/pixel/props/spire/`, lane R-D, proven 2026-09-29)

Materials (`materials.ts`): `spireIron` (blue-black plate with a wet sheen), `spireIronDark`
(girders, undersides), `routeRed` (the route's red paint), `lampAmber` / `lampRed` / `lampOff`
(beacon lenses), `wardenPlate` (old armour); `bladeIron` (in `edge.ts`: the Blade's iron with a
gold sheen). `storm.ts` holds no recipe: it is the storm's gust program (`GUST`, `gustAt`, its
GLSL twin `GUST_GLSL`), the live values the spire's pieces share (`STORM`: the gust from the
backdrop's clock, lightning, the save's lit shrines, the player, the arena's summoning) and the
lift's height (`LIFT`). RUNTIME.md, "Region D", has the program.

Recorded through their states with `kit.mjs --only <ids> --out review/world/phase2/R-D/kit`
(and `kit-3` after the last fix): idle cost 0 uploads and at most 0.01 ms of simulation, except
`stormBanner` (0.07 to 0.15 ms and 14 KB a frame: it sways all the time, by design); flash starts
at most 3 in any second. A state's `update` return value is ignored by `Prop.update` (only `hit`
and `use` returns change state), so timed hand-offs call `c.go()`: the armour settling back to
`still`, the seals going `spent` to `dark`, the banner `torn` to `knitting` to `hanging` (all three
had stuck in their first state before; checked in the sandbox, each now completes).

| Recipe | What it does | Breakage |
|---|---|---|
| `spireDeck` | catwalk (tread plate, a Warren-truss girder, brackets), landing or arena floor (deep plate in courses; a deep arena floor adds a cornice, pilasters and scuppers spilling rain); an optional 0.3 H lip with the route's red (its own small part); `cantilever` (H from the left end to the face) hangs an overhanging end on a truss that deepens back into the face, `posts` stand it on the walkway below; dents and sparks, heavy hits buckle a crater; draw only (terrain collides) | floor |
| `spireStair` | a flight of the climb: two 0.8 H machine housings, 22 steps of 0.2 x 0.3 H on a closed stringer with a lit beam, support posts, a handrail behind; built from small parts (an open stair is mostly air); flip for a flight that climbs left | floor |
| `stormDirector` | invisible: plays the gust program on the kit (pennants snap through the tell and stream in the gust, lamp posts swing, chains shake), lights the lamp posts named for a shrine in order, keeps cloth cheap (20 Hz redraw, cloth well out of view sleeps), and hands the player, view and rain to the pixel world; `still` mode for air without gusts | never |
| `warningLight` | a caged beacon (floor, wall or hanging): `blink` (quicker through a gust's tell), `turning` (a band sweeps the lens), `red` (or red on its own while the arena summons, `arena: true`), `off`; a hit sparks and dims it for a moment, stepped, never a strobe | never |
| `brokenArmour` | a warden's helm, pauldron, greave: a hit or a dash knocks them hopping and skidding (inside `slide`), they settle flat and stay where they land | never |
| `counterweight` | stacked weights in a yoke on two cables: `hang` (sways in the gusts) or `ride` (moves opposite the lift's car by its published height: they pass halfway) | never |
| `stormAlcove` | the storm alcove's recess cut into the climb's face: a back wall of smoke-warmed plate (`spireIronWarm`) in three bays with pilasters, a skirting and the lintel's stepped shadow; jambs in two orders (outer plate, dark reveal, sill plates); a lintel bearing past the jambs on corbels with a hood that throws the rain clear (in front of her; it drips); a warm fill light | floor |
| `stormWindow` | the alcove's small stained-glass window: an iron pointed arch, leaded storm-blue quarries and a warm rose; `cracked` (an overlay), `shattered`, `reassembling`, `whole`; rain runs down it (15 Hz); dark with the storm behind it, lit from behind by lightning (the world's flash), throwing its colours into the alcove | heal |
| `spirePortal` | a big doorway cut into the spire's iron over a kit big door (lift gate, arena shutter): two orders stepping in (a lit outer plate, a dark reveal), a riveted lintel bearing past the jambs on corbels with the red chevrons, a hood with a drip edge, a worn sill, and the inside (the lift's shaft with its rails and cables, or a passage through the wall); `trim: "compact"` drops the outer order and hood where the wall around it is a building with its own plating (`crownTower`); between the kit frame and the leaf, so the gate still slides and the shutter still rolls; `SURROUND` gives its size for a backdrop that cuts its wall around it | never |
| `crownTower` | the Crown's gatehouses: a tower of riveted plate courses (lit lips, girdles, staggered joints), a battered plinth, a crenellated crest with a bite out of it, an antenna with a red lamp, optionally the lift's hoist head (wheel housing, cables down into the gate); the shutters and the lift gate are cut into it | never |
| `arenaSeals` | five seals in the arena floor's face, a ring 10 H across: dark, glowing (woken), forming (one after another, red columns), held, spent (smoke); follows the terminal and rolls the arena shutters down and up | never |
| `terminalRoster` | the terminal's screen while woken: the real products from `src/site/data/downloads.ts` (DEXCLIENT with a steady caret, DEXCODE dimmed; the ones with a download first, and the rows page every 3 s if the list outgrows the screen, so nothing is dropped); while it cools down, SITE BELOW and an arrow | never |
| `stormBanner` | a long banner that sways by row shear from its design at 15 Hz (no cloth sim: with it the Crown's pixel simulation fell from 6.1 to 0.6 ms a frame; the kit banner costs about 0.9 ms awake); a slash tears it where it lands, the lower part drops and fades, then knits back | heal |
| `bladeEdge` | the Blade's knife edge: lapped iron plates on a steady slope with rivets and a fringe of broken spikes, in 4 H parts; gold-lit by the dusk key once the storm has broken | floor |

### Shore and Plain (`src/pixel/props/plain/`, lane R-B, proven 2026-09-29)

Recorded through their states with `kit.mjs --only <ids> --out review/world/phase2/R-B/kit`;
idle cost 0 uploads and at most 0.01 ms of simulation for every one. Region materials in
`materials.ts` (cooler and greyer than the kit's: weathered, wet, under a white sky):
`plainWood`, `plainWoodDark`, `plainRope`, `plainStone`, `plainStoneDark`, `plainStoneWarm`,
`plainLichen`, `reedStem`, `reedDry`, `reedHead`, `plainBone`, `plainBoneDark`, `plainIron`,
`plainPaint`, `plainConcrete`, `plainGlass`, `plainSignFace`, `plainBrass`. No words anywhere:
the ferry board (the kit `sign` with `lines: []`), the route sign and the shelter's timetable are
blank, their numbers worn off. `bus.ts` is the region's controller channel (not a recipe).

| Recipe | States, actions | Breaks, moves |
|---|---|---|
| `ropeBridge` | raised, falling, lowered; persists `cut` (the room mirrors it to `cut:rope-bridge`, S1) | cut; a plank deck hinged on the east bank stands hauled up at 0.9 rad over the channel, its haul line over the tall mast's pulley and down to a cleat at hand height. Only a hit that lands east of the mast and parts the tail line counts (a slash from the channel does nothing); the deck swings down with rod physics (3g/2L), slams onto the west post (1 px shake, splash), bounces and lies there, a platform only when down; the haul line runs free and trails from the deck. Wood splinters and mends |
| `reedBed` | growing | heal; tall stems standing in water, some with cattail heads and long leaves: lean with the wind, part around the player (`world.actors`, fed by `plainRumble`), bow from swings and dashes and all together when the colossus's ring washes in; cut short, they grow back. `form`: total stem height. `layer` mid (behind) or fg (low, in front) |
| `markerPost` | standing, torn, restoring | heal; a leaning post in a cairn with a strip of the route's red cloth (verlet, pinned at the hoist) streaming in the wind; slashes tear the strip, which knits back |
| `standingStone` | standing | heal; a lichened menhir (domed polygon), chips and cracks, never falls; `flat` for the Stonetop stones whose tops are ledges |
| `ribArch` | resting | heal; a spine arching over the road with ribs curving into the flats, two level broken ribs (the room's one-way platforms), two near rib tips in front at the feet |
| `busShelter` | standing | heal; concrete roof slab, steel posts, a back wall of steel-framed glass (two panes cracked; the glass shatters and mends), a blank timetable frame, a kerb. The roof's collision is the room's |
| `routeSign` | idle | heal; a pole with a round plate on a bracket (it swings on a pendulum when hit) and a blank timetable board |
| `craneFrame` | idle, running | never; lattice mast, jib and counter-jib, head sheave, counterweight, winch house. The hook (the room's carrier) signals `running` / `idle`: the drum turns, the head lamp glows amber (a steady light, never a flash) |
| `culvertGate` | closed (E rattles), lifting, open (E: a `door` event, `enter`); persists `open`; action `open` | never; an iron portcullis in the culvert's arch that retracts up into its housing (redrawn by rows as it lifts); the brass horn on the arch blows once (`culvert.horn`, smoke, 1 px shake); the lake's light appears at the tunnel's end. Lifted by the kit `lever` (placement `flag: lever:culvert`, `target`, `msg: lifting`) |
| `callLever` | up, pulling, return | never; a post box with a red-gripped handle that springs back; each pull emits `lever` with `on: false`, so the host signals the placement's `target` with its `msg` (the hook's `call:0` / `call:1`) |
| `plainRumble` | idle | never; invisible. Drains the room keeper's events (`bus.ts`): the footfall's `shake` event, the ring's wash (a broad gust through `world.blow`), a breeze from the west that rises toward the room's east end (`breeze`); and it keeps `world.actors` on the player |

## Known limits

- Rosace is not in the sandbox: there is no sprite export yet (`/world/character/` is empty),
  so the H gauge in her palette stands in for her scale and colours.
- ~~The sound is placeholder synth~~: every material family (`<family>.hit` / `.break`) and every
  per-state cue now has a file in `src/world/sound/tables.ts` (S1, 2026-09-29; checked by
  `src/world/sound/verify.mjs`, which reads the ids from the source). A new cue id needs a line there.
- Flame, cloth and glyph parts still re-rasterise on the CPU while awake (now only the rows they
  touch upload, and flames only at 15 Hz).
- The spam test in the whole-kit lineup reaches 8-11 ms of simulation: fine for a stress case,
  but a real fight in a crowded room should lower `world.budget.chunks` and `particles`.
- The critic pass looked at every recipe's stills at game size and fixed what read badly (the
  pew's back, vine leaves, grass height, the pennant in wind, puddles, moths, dust, paper faces,
  splinters landing on end); motion was judged from the capture stills, not by Dex.

## Ground cover and the ground (2026-10-01)

`PropBuilder.groundRise(x, reach)` returns how many rows the ground under prop-local `x` sits above
the prop's own base (negative: below), or NaN when there is no ground within `reach` px (over a
drop, inside a wall); a blade that gets NaN should not be grown. It asks `PixelWorld.surfaceY`,
which uses `world.plantGround` (the host's terrain and water surface; null in the sandbox, where it
falls back to `solidAt` and then to the placement). `grass`, `reeds` and `reedBed` root every blade
this way, so a patch follows steps and slopes and stops at edges. Write new cover the same way; see
docs/world/SCENES.md, "Layering, grounding and blending".
