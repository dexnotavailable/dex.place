# Pixel matter engine (`src/pixel/`)

The engine that `PIXEL-MATTER.md` describes, built. A prop is a recipe: code that writes cells.
There are no image files. This page is the recipe format for prop lanes and the API for the lane
that places props in the world. If this page and the code disagree, the code wins and this page
gets fixed in the same change.

Status: **proven** in the `/props/` sandbox with six proof props (map banner, boss terminal,
donation box and donor plaque, stained-glass window, candelabra, destructible floor) plus a font
(for ripples). Captures live in `review/world/props/` (git-ignored).

## Scale (locked)

One source of truth: `src/pixel/scale.ts`.

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
npm run dev -- --port 22417 --strictPort --host 127.0.0.1     # then open /props/
```

`/props/` is dev-only (not in the build inputs). URL options: `?h=144`, `?lab` (lab lighting
instead of the chapel's), `?manual` (no RAF loop; drive it from `window.__pixel`).

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

Captures: `node src/pixel/tools/capture.mjs --port 22418 [--only banner,terminal,...]` against a
capture-only server (`npx vite --config src/pixel/tools/vite.capture.config.mjs --port 22418
--strictPort --host 127.0.0.1`; restart it with `src/pixel/tools/restart-capture-server.sh` after
edits). That server has HMR and file watching off, so other lanes' edits can't reload the page
mid-recording. Frames come from the 1280 x 720 target and are only ever upscaled nearest.

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

## Performance and budgets

- Cells live in two RGBA8 textures per part; undisturbed cells cost nothing but the draw. Only the
  dirty rect uploads (`texSubImage2D`); normals are recomputed for that rect only.
- Ropes, cloth and chunks sleep when still; healing touches only wound rects; dynamic parts
  (flames, cloth, glyph screens) re-upload each step while awake. A chunk counts as touching the
  ground within 1 px above it, is pushed out only by its real (fractional) depth, locks flat to a
  quarter turn, and sleeps after 0.35 s still (every chunk asleep about 2 s after a Q, and a
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

## Proof props (`src/pixel/props/`)

| Prop | States | Breaks / moves |
|---|---|---|
| `mapBanner` | rolled -> unrolling -> unrolled (E: map panel); `cut` persists | slash the cord: the roll drops, rows release, the hem swings; hits sway the cloth; the map never tears |
| `bossTerminal` | dormant -> woken -> summoning -> summoned -> cooldown -> dormant | E wakes, E summons (seal assembles from noise, beam rises, red light); the host calls `cooldown` after the fight; hits dent and spark, glitch the screen, sway the cables; it mends |
| `donationBox` | idle -> used (E: donate panel, lamp flare, chime, glint) | chips (three times the normal hp) and mends; no payment is ever faked |
| `donorPlaque` | idle (E: donors panel) | real names only; empty data stays blank engraved rules |
| `stainedGlass` | idle -> broken -> restoring -> idle | panes shatter into glinting shards with real colours; light and shafts dim with the glass left; after 4.5 s the shards fly home one by one; the stone frame chips and mends |
| `candelabra` | lit, guttering, out, relighting (E relights) | wobbles on a spring through pixel-safe rotation; hits and the dash wind gutter flames (smoke); heavy hits crumble candles; flames light and rim the room |
| `floor` | idle | craters with raised rims, slash scars, cracks down the face, heals |
| `font` | still | water ripples and splashes on hits and wind |
| `wall`, `gauge` | | sandbox room and the H-tall scale figure in Rosace's palette |

## Known limits

- Rosace is not in the sandbox; the H gauge stands in for her scale and palette.
- The unrolled banner's map is a placeholder drawing of the Procession route, to be replaced by
  the real world map.
- The sound is placeholder synth.
- Dynamic parts (flames, cloth, glyph screens) re-upload their whole grid each step while awake:
  cheap at these sizes, but a room with many of them awake at once needs its own budget.
