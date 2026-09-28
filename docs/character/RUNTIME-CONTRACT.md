# Character runtime contract (`dex.sprite/1`)

The one format the character pipeline (Blender 3D -> pixel frames) exports and the lab
runtime (`/lab/`) consumes. The executable version is `src/lab/contracts.ts`
(`validatePackage`); this page explains it. If the two disagree, the code wins and this page
gets fixed in the same change.

Everything that moves or hits is data. Timings, hitboxes, cancel windows, effects, lights and
camera moves live in the package, not in game code, so a new moveset is an export, not a
rewrite.

## Conventions

- **Pixels** are native sprite pixels. One sprite pixel is one low-res screen pixel (the scene
  renders at 640x360 or 960x540 and is upscaled by a whole number).
- **y points down.** Negative y is up.
- **Facing right.** Every frame-relative number (boxes, offsets, root motion, anchors,
  rotations) is authored for a character facing right. The runtime mirrors x when she faces
  left.
- **Time** is 60 Hz simulation ticks. Slow motion stretches ticks; hitstop freezes them.
- **Pivot** is the foot anchor: the point on the ground between the feet, in pixels from the
  frame rect's top-left. The character's world position is this point.

## Files

```
public/lab/character/manifest.json   the package (below)
public/lab/character/<atlas>.png     albedo atlas
public/lab/character/<atlas>_n.png   normal-map atlas, same size and layout
public/lab/turret/...                same format for the turret
```

The runtime fetches `/lab/character/manifest.json`. The repo ships a placeholder:

```json
{ "contract": "dex.sprite/1", "standin": true }
```

which tells the runtime to bake the procedural stand-in. Replacing it with a real package
switches the lab over; nothing else changes. The stand-in is baked into exactly this format
and goes through the same validation, so it exercises every path a real export will.

### Atlas images

- PNG, 8-bit RGBA, sRGB, not premultiplied. Sampled with **nearest filtering only**, fetched
  per texel; there is no mipmapping and no bilinear anywhere.
- Alpha is binary in practice: texels with alpha >= 128 are drawn, the rest discarded. No soft
  edges; anti-aliasing belongs in the pixel art, not in alpha.
- Leave at least 2 px of empty gutter between frames.
- **Normal map**: tangent space for the sprite as drawn facing right. `r = x` (right),
  `g = y` (**down**), `b = z` (toward the viewer), each mapped `-1..1 -> 0..255`. Flat is
  `(128, 128, 255)`. The runtime negates x when the sprite is mirrored. Silhouette-edge texels
  should point outward with a small z so rim light catches them (the stand-in writes
  `z ~= 0.33` on its outline).
- `normal: null` is allowed; the sprite is then lit as flat.

## Manifest

```json
{
  "contract": "dex.sprite/1",
  "name": "priest v1",
  "atlases": [
    { "id": "body", "albedo": "body.png", "normal": "body_n.png", "width": 2048, "height": 1024, "shading": "baked" }
  ],
  "defaults": { "hurtboxes": [{ "x": -6, "y": -84, "w": 13, "h": 82 }] },
  "clips": [ ... ]
}
```

| Field | Meaning |
|---|---|
| `contract` | Always `"dex.sprite/1"`. A breaking change bumps the number. |
| `atlases[].shading` | `"flat"`: albedo is unlit base colour and the key light shades it fully. `"baked"`: the albedo already carries the key-light ramp (toon/pixel shading from the pipeline); the key light only nudges it (key influence 0.25). Point lights and rim apply either way. |
| `atlases[].width/height` | Must match the PNG; checked at load. |
| `defaults.hurtboxes` | Hurtboxes for frames that don't list their own. |

## Clips

| Field | Meaning |
|---|---|
| `id` | Unique. The controller asks for clips by id (list below). |
| `atlas` | Atlas id. |
| `loop` | Loops forever; otherwise the clip ends after its last frame. |
| `next` | Clip to play when a non-looping clip ends. |
| `gravity` | Gravity multiplier while this clip plays. `0` hangs in place (root motion still moves). |
| `angles` | `{ "from": -90, "to": 90 }`: frames are aim angles, evenly spaced (turret barrel). |
| `tags` | `"locomotion"`, `"free"` (plays without locking control: land, double jump), `"dash"`, `"m1"`, `"finisher"`, `"skill"`, `"ult"`, `"hurt"`, `"indexed"`. |
| `frames` | At least one. |

### Clip ids the player controller uses

`idle`, `run`, `jump`, `apex`, `fall`, `land`, `double_jump`, `dash`, `dash_attack`, `m1_1`,
`m1_2`, `m1_3`, `m1_4`, `skill_q`, `ult_r`, `hurt`. Missing ids fail at load with a clear
message. The M1 chain order is not hard-coded: it comes from cancel windows (see below), so a
five-hit string is a data change.

The turret package uses `base`, `head` (frame 0 idle, frame 1 charged), `barrel`
(angle-indexed) and `broken`.

## Frames

| Field | Meaning |
|---|---|
| `rect` | `[x, y, w, h]` in atlas pixels. |
| `pivot` | `[x, y]` foot anchor inside the rect. |
| `duration` | Ticks the drawing shows (>= 1). |
| `hold` | Extra ticks the drawing is held after `duration`. Kept separate so a timing review can tune holds (anticipation holds, contact holds) without touching the drawing count. |
| `phase` | `anticipation`, `active`, `recovery` or `neutral`. Shown in the debug overlay; used for review. |
| `hitboxes` | Active hit volumes this frame (below). |
| `hurtboxes` | Overrides the defaults this frame. `[]` means nothing can hit her. |
| `iframes` | `true`: hurtboxes ignore hits this frame (dash, ultimate). |
| `cancel` | Cancel windows (below). |
| `rootMotion` | `[dx, dy]` pixels travelled over the whole frame, spread evenly over its ticks, facing-relative. A non-zero `dy` overrides gravity for the frame. Collision still applies. |
| `events` | Fired on the tick the frame starts (below). |
| `anchors` | Named points relative to the pivot: `tip` (weapon tip), `handN`, `handF`, `head`, `chest`, `halo`, `butt` for the player; `mount`, `barrel`, `eye`, `muzzle` for the turret. Events can place themselves on an anchor. |
| `pose` | Informational: the source pose / action frame name. |

### Hitboxes

```json
{ "x": -2, "y": -86, "w": 82, "h": 84, "damage": 10, "knockback": [2.4, -1.2], "hitstop": 4,
  "stagger": 12, "group": "a", "heavy": false, "hitVfx": "hit.light", "shake": { "amplitude": 6, "duration": 16 } }
```

- Box relative to the pivot, facing right, in pixels.
- `knockback` is launch velocity in px/tick; x points away from the attacker.
- `hitstop` freezes the whole simulation for that many ticks on contact (the camera shake and
  flashes keep running). The largest pending hitstop wins; capped by `feel.maxHitstop`.
- `stagger` is poise damage. `heavy: true` staggers at once.
- `group`: all hitboxes sharing a group hit a given target once per clip play. Put the same
  group on consecutive active frames of one swing; give a multi-hit move several groups.
- `hitVfx` spawns at the centre of the overlap, facing the attacker's direction.

### Cancel windows

```json
"cancel": [{ "into": { "m1": "m1_2", "m2": "dash", "jump": "*", "move": "*" }, "onHit": false }]
```

While the frame plays, a buffered input for an action in `into` interrupts the clip:
`m1` (left click / J), `m2` (right click / K / Shift = dash), `skill` (Q), `ult` (R), `jump`,
`move` (any horizontal input returns control). The value is the clip to play, or `"*"` for the
controller's default (`m1_1`, `dash`, `skill_q`, `ult_r`, normal jump). `onHit: true` opens the
window only after this play has hit something. Attacks buffer for 12 ticks, jumps for 8.

## Events

All events can sit on an anchor: `"anchor": "tip", "offset": [4, -2]` (offset in facing-right
pixels, added to the anchor or to the pivot when no anchor is given). `"attach": true` makes a
VFX or light follow the character after it spawns.

| `type` | Fields | Runtime |
|---|---|---|
| `vfx` | `id`, `rotation` (degrees, clockwise), `scale` (number or `[sx, sy]`), `colour`, `core`, `edge`, `layer` (`back`/`front`), `params` (primitive overrides), `light` | Spawns a preset from the VFX library (`src/lab/data/vfx.json`). Unknown ids warn at load. |
| `light` | `colour`, `radius`, `intensity`, `duration`, `height`, `flicker` | A point light that fades out linearly. Up to 16 lights are active; they shade sprites through the normal map and drive the rim. |
| `shake` | `amplitude` (px), `duration` | Whole-pixel camera shake, decaying. Reduced under `prefers-reduced-motion`. |
| `zoom` | `steps` (1-2), `duration` | Zoom punch as an **integer upscale step** (3x -> 4x) around the character, so every pixel stays the same size. Skipped under reduced motion. |
| `slowmo` | `factor` (0.05-1), `duration` (real ticks) | Simulation speed. The strongest active slow-mo wins. |
| `cutin` | `id`, `duration` | Starts the ultimate cut-in overlay (the lab draws a dark band, speed lines and an eye close-up). The hook receives the id so real cut-in art can be swapped in per id. |
| `sound` | `id`, `volume` | Sound cue id. The lab plays placeholder synth sounds for the ids it knows; real audio maps the same ids. |
| `impact` | `mode` (`invert`/`mono`), `duration` (1-2) | Screen-space impact frame at art-pixel resolution. Skipped under `prefers-reduced-motion`, rate-limited so two can't stack. |

### VFX library

Presets are data, keyed by id, one of these kinds: `arc` (crescent smear with thickness
curve, white core -> colour -> edge ramp, splitting into slivers), `ring` (flattened ground
shockwave), `pillar` (column of light), `burst` (radial rays), `streak` (spear thrust with
speed lines), `disc` (flash), `particles` (spark, ember, shard, feather, debris, dust, mote;
gravity, drag, colour over life, optional converge), `cracks` (ground decal), `afterimage`
(copies the current frame as a fading silhouette), and `group` (several presets with offsets,
rotations and delays). Every preset can carry a `light`. Shapes are evaluated per low-res
pixel, so effects are pixel art at the sprite's pixel size by construction.

## Rendering model (what the art is lit by)

- Ambient + one key light (upper front). With `shading: "baked"` the key light only nudges.
- Up to 16 point lights from effects, projectiles and the turret's eye.
- Rim: a scene backlight plus every point light brightens texels whose normals face sideways
  toward the light. Width, colour, intensity and threshold are in `src/lab/data/lighting.json`.
- Light is quantized into bands and the rim into 0 / half / full, so lighting stays pixel art.

## Validation

`validatePackage(json, source)` checks every field, type and range, unknown keys, duplicate
ids, atlas references, frame rects inside the atlas, `next` and cancel targets, and throws one
error listing every problem with its JSON path, for example:

```
/lab/character/manifest.json: 2 contract issue(s)
  $.clips[4].frames[2].hitboxes[0].hitstop: expected an integer
  $.clips[7].frames[0].cancel[0].into.m1: unknown clip "m1_5"
```

A package that fails validation does not load; the lab shows a short failure line and the
console has the list.

## Export checklist for the pipeline

1. Render per-frame albedo and normal passes at native size, facing right, same camera.
2. Trim each frame, pack both atlases with the same layout, 2 px gutters.
3. Write `rect`, `pivot` (feet on the ground), `anchors` (weapon tip at least) per frame.
4. Copy timings, hitboxes, cancels and events from the MOVESET; keep ids stable.
5. Drop the files into `public/lab/character/`, reload `/lab/`, press the backquote key for
   the debug overlay (boxes, clip, frame, phase, fps, light count).
