# Generated wood door leaf — 2026-09-08

Implemented in `site/src/worldsite/game/doorway.ts` only. The previous file is preserved as `doorway-before.ts.txt`.

The V2-P03 generated104×309 wooden leaf now renders at uniform native1× behind the actual V2-P02 frame placement. A fixed geometry mask follows the measured opening of the192×275 stone source, with a small overlap under the opaque stone. The tall leaf continues below the threshold and is clipped there. The source image was not stretched, repainted, recropped on disk or replaced. The pale FG08 moving panel and its old separate posts/lintel were removed from the mechanism.

The leaf and its small latch move left beneath that fixed aperture. The shadow remains behind them and the generated stone frame remains stationary. Existing E ownership and the half-second room transition stay in WorldScene unchanged. A departed door resets closed while hidden, so returning no longer retains the old opening state.

## Visible verification

- `closed-desktop.png`: wood fills the arch apex and opening; no empty semicircle or pale slab.
- `opening-desktop.png`: native E started the existing passage transition; captured after120ms by pausing the private scene. Leaf/latch move independently beneath the fixed stone aperture.
- `returned-desktop.png`: actual key movement/E passage back into Junction; leaf closed again.
- `returned-portrait.png`: real390×844 renderer resize; mask and wood registration remain aligned.
- `proof.json`: five checks passed, no page errors or context loss. Two opening/ready event pairs observed for the actual round trip. Asset/source hashes recorded.
- `pnpm exec tsc --noEmit`: passed.

The private fixture initially enters Junction explicitly for lookdev. All subsequent walking and E transitions use native key events. It is not a full App blackout/menu or public acceptance claim. The original room-graph, collision, player and progress sources were not edited.

One surrounding composition issue remains visible and has been sent to root: Junction FG08.017 now reaches the floor but covers the right part of the arrival doorway. Its lateral placement is owned by the composition pass. This does not invalidate the leaf/mask fit, clearly visible on the unobstructed Hearth/Archive doors in the same view.

No external accounts, media generation, source-image edits or public publishing were used.
