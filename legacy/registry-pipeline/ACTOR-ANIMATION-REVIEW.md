# Registry actor and map preparation

Prepared assets: `actor-materials.json`. All paths are production-local; the publisher owns copying these into the isolated runtime catalogue. No game source or public assets were changed by this lane.

## What was preserved

The five warden sheets are the generated pale ceramic warden with charcoal joints, vermilion seal and sword, facing LEFT. Every keyed source and first alpha result remains unchanged. Each pose was translated as a whole onto a 640 by 640 transparent cell, with no resizing, repainting, recoloring, mirroring or separate limb movement. Six cells form a 1920 by 1280 sheet. Pivot is `[384,560]` throughout; nominal standing-body height is 416 throughout, including crouched and collapsed poses. Measured idle alpha height is 419 pixels, recorded separately rather than silently treating current pose bounds as scale.

Registration landmarks are explicit in `prepare_actor_materials.py` and the review JSON. Ground references use feet or the collapsed supporting hand/body, not the lower sword tip or hilt. The horizontal reference is the projected ground-support centre. This fixes the generated cell-position drift while allowing the actual stance to widen.

The third poses in BOTH hit and death spill a complete sword tip 17 pixels into the preceding cell's otherwise empty right gutter. Non-overlapping source rectangles at sheet x1000 correctly assign those tip pixels to their own pose. No source alpha pixels were discarded or duplicated. The attack's raised sword tips are complete: their source alpha starts at y10 and y2, with no top-edge alpha. The padded output leaves room around them.

The map banner remains six 512 by 512 cells in a 1536 by 1024 sheet. Its top rod is registered at `[256,88]`; lower-row frames required 1,1,2 pixels of downward translation. The final lower rod centre is consequently `[256,387]`, with rolled tie `[256,113]`. These are attachment locations for the separate physical rope. The source sheet contains no cut rope of its own.

## Playback contract

| Asset | Frame durations in milliseconds | Loop |
|---|---|---|
| warden-idle | 240,240,240,240,240,240 | yes |
| warden-attack | 400,450,65,85,100,150 | no |
| warden-recover | 180,180,220,220,240,260 | no |
| warden-hit | 45,45,45,45,50,50 | no |
| warden-death | 160,180,200,230,300,400 | no |
| map-banner | 80,70,80,90,120,160 | no |

Attack poses 0 and 1 are the 850ms windup; poses 2 through 5 are 400ms of slash and follow-through. Runtime should map its normal/assisted windup onto that first 850ms, and its 380/500ms active interval onto the remaining 400ms. Do not use the old 60%-of-total division. Recovery is 1300ms, hit 280ms, death 1470ms followed by the separate runtime hold. Since native warden facing is LEFT, flip only when its world facing is RIGHT.

## Evidence and visual verdict

`reviews/actor-registration-v1/registration.json` records exact source rectangles, translations, hashes and retained alpha pixel counts. The six sheet validators have zero errors. The two warnings merely report GIF centisecond rounding for 45/65/85ms frames; JSON/runtime timing retains the exact values.

I inspected all six original sheets, keyed/registered contact sheets, and the nearest-neighbour game-scale comparison at a nominal 96px warden height. Armor, mask, red seal and weapon remain recognizable across the clips. Crouches get lower and the death heap stays small; it is not enlarged to standing height. The sword has clear windup, strike and recovery silhouettes. The banner reads as an anchored roll dropping downward. These assets are suitable for integration.

This is asset-level acceptance, not final game acceptance. The game-scale contact sheet is `reviews/actor-registration-v1/game-scale-contact.png`. Validate actual facing, sword-hit timing, collision, ground contact, banner rope contact and room lighting in the running game. GIFs are lossy review media; source PNG cells and metadata own pixel/timing truth.
