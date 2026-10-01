# Reflection and interaction audits (lane ixr, 2026-10-01)

Tools: `src/world/tools/reflect-audit.mjs` and `src/world/tools/interact-audit.mjs`. Both take `--gpu` (d3d11) or default to software WebGL, and `--port`.

## Reflections
Cause: the arrival lake, reed shallows and causeway flats read the reflection buffer without the design-view frame offset, so everything mirrored about 128 px sideways and 72 px off. Pixel matter (docks, posts, reeds, boats, signs) had no mirror pass at all.
Fix: those three shaders use `reflPx`; the pixel cell shader mirrors about the room waterline; every placement reflects unless `reflect: false`; ripple shear eases in with depth below the waterline.
Audit (8 standing spots over A0, A1, A2, S2, B1, B2): before, the player's reflection in the water was 127-130 px off in x (A0, A1 FAIL); after, 8/8 mirror within 3 px in column and rows, on software GL and on GPU (d3d11).

## Interaction
112 interactables over 20 rooms, each walked into, prompt and E effect checked.
Failures found and fixed: E while sitting never stood you up; E was live during room changes and rests; lit candles/candelabra, unreachable lanterns and unusable bells offered a dead E; a neighbour with a nearer centre beat the prop whose use zone you stood in (shutter door vs terminal).
After: 112 pass, 0 fail (software GL and GPU).
