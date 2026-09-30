# Crown summon acceptance contract

The arena view must contain all five seals while they form and hold. At cooldown,
the camera returns to the traveller and the honest interim panel appears while the
spent seals fade. Full-ring visibility belongs to the active sequence; the spent
phase must prove the transition, panel and fading instead.

This follows the existing authored contract:

- `WORLD-PLAN.md`, Camera and D3 The Crown: arena-clamped while summoning; summoned
  holds the seal, followed by cooldown and the honest interim.
- `RUNTIME.md`, D3 The Crown: sequential seals, arena camera, held seal, then
  cooldown, SITE BELOW, the website downloads panel, opening shutters and fading.
- `src/world/rooms/spire/d3-crown.ts`: arena focus while summoning and held.
- `src/world/game.ts`: the summon view and arena clamp cover summoning/summoned;
  cooldown ends that view and opens the summoned interim panel.
- `src/pixel/props/spire/arena.ts`: forming seals start 0.4 seconds apart, rise
  over 0.3 seconds in quarter steps, hold fully lit, then fade when spent and
  command the shutters to open.

`src/world/tools/summon-verdict.mjs` assesses the complete existing shipfix
schedule for 1080p, 1440p and phone. Each profile must record a wake, empty error
and bad-request arrays, and all ten ordered/scheduled snapshots:

| Simulation time | Required phase and observations |
| --- | --- |
| 0.4, 0.8, 1.2, 1.6, 2.0 s | summoning/forming; all five in view; no panel or player close-up; sequential lit counts 1, 2, 3, 4, 5 |
| 2.4 s | summoning/forming or the adjacent summoned/held transition; all five visible and fully lit; no panel or close-up |
| 3.2, 4.4 s | summoned/held; all five visible and fully lit; no panel or close-up |
| 5.4, 7.0 s | cooldown/spent; summoned interim panel; released view includes the traveller; no close-up; every seal fades below full intensity and fades further by 7 s |

The driver uses fixed 60 Hz advances. Quarter-step light quantization keeps the
next seal at zero at the intermediate scheduled boundaries; this allows the
existing frame granularity without accepting an early all-at-once formation.
Only the 2.4-second adjacent phase boundary is tolerated. Unknown state pairs,
missing profiles/snapshots, empty seal arrays, early panels, clipped active rings,
unlit held seals and stalled fading fail.

The saved RTX 4090/D3D11 run on
`afda9fa6ab394853a280d8813720fff759def9b6` failed the old unconditional
full-ring predicate at 5.4 and 7 seconds. Its original failed verdict and raw
records remain intact. All three profiles recorded the intended active and spent
phases. Retrospective CPU assessment under this reconciled predicate is separate
from a fresh native qualification. Exact hold duration and completed shutter
motion are not established by these sparse snapshots.

This correction changes the fixture only. Runtime, camera, seals, timing, authored
UI, audio and assets are unchanged. Delivery owns integration and any native,
device, listening or public acceptance.
