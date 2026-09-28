# Native banner surface revision

This supersedes the old160×214 banner dimensions in the parent prototype README. Bridge/lift remain unchanged by this revision. Only `LatchedBanner`, its native-cloth helper and necessary type import changed in production source; fixture/capture changes are private.

Shared world geometry:

- `surfaceRect`: top-left `(bannerX−160,floorY−375)`, width320, height368; includes `visibleFraction`.
- `contentRect`:12px inset on all sides,296×344.
- `interactionPoint`: `(bannerX−168,floorY−34)`. For the private2250/960 placement the latch is2082/926.
- Roller345px at `(bannerX−172,floorY−387)`.
- Weight320px; its top reachesfloorY−7 and its7px height ends exactly atfloorY.
- Fixed post395px tall, outside the cloth left edge.

P17 is sliced into nine source regions, with interior/edge regions tiled or cropped to size. That yields20 image parts, all native scale1. P16/P18 use native cap/middle/cap assembly. Every cloth part clips against the same unfolding edge; the weight follows that edge. The cloth is intact through E release, Close and J re-release.

`results.json` records three passing native checks and zero page errors. `pnpm exec tsc --noEmit` passed. Final mechanism module SHA256 at handoff: `79f5c9c80fa1e316099a9ca4509130599af1296662b4a69fb8d834680782ac01`.

Visually inspected actual canvas captures: `closed-canvas.png`, `opening-canvas.png`, `open-canvas.png`. The roller/cloth/weight now share their physical width and the weight ends at the floor. The existing cloth creases repeat through the tiled interior; no generated paint, texture stretch or enlarged pixels were introduced.

The fixture has no reading DOM. Root owns transparent DOM alignment to `surfaceRect`, accessibility and offscreen/portrait handling. These native captures do not claim that final integration has passed yet.
