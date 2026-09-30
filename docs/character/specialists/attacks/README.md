# Rosace attack choreography — authored proposal

Owner: `rosace-attacks`. Source base: `bcb220de03c0b84e8fa68851328cd1d799a11de5`.
This namespace supplies data and drawing instructions to the Rosace integrator. It does not
change shared MOVESET/PIPELINE, a rig, the world controller, R2 or any frozen native request.
All new numbers are design proposals until moving native output is accepted.

`art/rosace/specialists/attacks/n1-n2.json` is the first complete mini-sequence.
`export_choreography.py` validates it and exports **atlas-independent planning ticks**, not
`dex.sprite/1` frames. No invented atlas rectangles, baked cloth, normals or rig results.

## Authoring conventions

- 60 simulation ticks/second, first tick 1; drawing exposures are inclusive and add exactly
  to the whiff length. Body keys are stepped. Continuous native constraint/cloth solves may
  exist beneath these exposures; the runtime must never tween raster drawings.
- H means skull-to-sole body height, excluding weapon/veil/ornaments. Positive x is forward,
  positive y is down from the foot pivot. Floating point H-space is retained in the planning
  export at H80/H144. Collision remains continuous; raster bounds use floor(min), ceil(max).
- Hitboxes are relative to the **current root** unless explicitly world-anchored. Width is
  simultaneous union of active hit area, never trail length or root travel accumulated over time.
- Knockback uses source-H96 pixels per simulation tick, explicitly `knockbackBasis` in data.
  Target velocity is source velocity times targetH/96, keeping the same H-per-tick launch.
  Outward x signs resolve per victim relative to attacker; they do not always face right.
- Canon exact box ratios take precedence over rounded prose H dimensions. The N2 cosmetic
  ellipse is 2.6H; the actual hitting span is 2.5H. Its 0.05H overscan at each end is cosmetic.
- `poseGoal` and `tipPathH` are drawing directions, not solved bone matrices. The contact/grip
  sockets must be resolved on the unchanged executing model by motion/integrator.
- Contact holds are part of whiff exposure. Insert hitstop only once on first collision per
  hit group; holding contact for three ticks does not automatically add three freeze ticks.

## N1 → N2: one gesture through a changing plane

Kyrie starts with weight dropping into a low rear coil, then sweeps a J from behind the heel,
across the floor and up in front. The solid weapon follows the smear head. Contact stays an
exaggerated forward diagonal, with a bent front knee and a clear face. The right hand carries
the weapon over the right shoulder; the left opens. Gloria catches that momentum, plants the
front foot, shows a coherent three-quarter back coil, and releases a low flat sweep that returns
to front. The tip light travels behind, then in front; tabards are its lead flag.

N1 f15 completes before N2 f1. The two boundary drawings use the same source body/weapon state,
grip weight, root transform and cloth state. N2 f1–3 repeats the inherited one-handed drawing.
The left hand approaches along the shaft on the hidden simulation track and is closed on its
socket by A2. Do not teleport a palm or swap anatomical hands. A native contact corridor and
actual cuff/haft separation must be shown; this packet cannot prove the regrip is solvable.

N1 whiff recovery to f33 remains available. A late N2 cancel samples the actual current N1
state, with a **two-tick entry variant inside N2 f1–3**, not a jump back to F2. Author one variant
for f16–23 and one for f24–33 only after the first seam passes. Default route is the earliest
f15 boundary. Gameplay facing remains right even during the authored full turn. Mirroring
negates x and yaw direction but preserves anatomical sockets and depth/front/back ordering.

The coil holds because the body has wound up, rather than drifting slowly through a turn. The
release skips to the largest tip displacement in one smear drawing. Overshoot continues into
F1/F2, then three settling drawings close the phrase. Premium feel is a target for real-speed
comparison; these instructions do not establish ZZZ/WuWa parity or a reference score.

## Contact and whiff

Arc, blade swish, dust and rim play on both routes. Stars, shards from a victim, chime, pane,
camera push and hitstop require collision. Preserve impact point and outward knockback sign for
targets on either side. A group may damage several targets once each, but aggregate freeze is
once per group, never multiplied by the target count. FX use simulation time and continue through
actor-only freeze; current lab global-freeze behavior needs an integrator change or an explicitly
labeled fallback. Planning export uses separate actor and wall clocks to expose that dependency.

On an early f8 collision, N1 holds the active S1 drawing; on f9 it holds C1. Canon's active
window starts before the named contact drawing. Preserve the earliest impact point and current
weapon state; do not warp immediately into the later pose to obtain a prettier freeze.

## Root, feet, weapon and physical cloth

- N1 retains exact +8/96H over f6–9 and +4/96H over f12–15. N2 adds +6/96H during f7–10,
  without moving the planted toe; solve the pelvis around that support, then replant only once
  unloaded. Stop forward deltas at a wall and recompute planted feet; attacks still animate.
- N1 inherits existing `n1_r3c` foot-plant ranges. N2's front support foot is **an anatomical
  binding resolved from the N1 contact**, not whichever foot appears on screen-right. Heel may
  lift, pivot yaw may turn; toe translation is pinned. No crossing knees or shaft floor clamp.
- Right hand is primary throughout the seam. Left grip weight 0 at N1 F1/F2 and N2 A1, 1 at
  N2 A2/C1. Socket slides must preserve contact; weapon path is evaluated in world space so
  chest rotation cannot drag the blade up. A smear may draw a bent weapon on one tick; the
  physical collider/shaft remains rigid. Do not infer grip acceptance from skeleton distances.
- Sleeves pin at the established proximal seam; tabards pin at the established waist seam.
  Preserve mesh/material and established hand sizing. Physical collision includes torso,
  pelvis/thighs, both forearms/hands, rigid haft/head and floor. No spring-only substitute.
- Bake continuous cloth with a pre-roll from stance, carry position **and velocity** across
  N1→N2 and each cancel, and sample into stepped 2D exposures. Body freeze keeps cloth/FX
  evolving against frozen colliders. Let only the lead flag dominate; other fabric has inertia
  with one overshoot/settle. Quantitative collision/grip tolerances belong to the rig owner;
  a count or solver completion alone cannot establish readable physical cloth.

## Integration and rollback

Integrator resolves rig/yaw/socket/units and routes finite native work to delivery. Shared docs
can link this proposal after integration; this lane does not edit them. Preserve existing N1
retime/smear as A control and the unchanged R2 model/look. Candidate B changes choreography/FX
only after that control matches. No whole-kit promotion from this data check.
Rollback of this namespace is a revert of its source commits on the integrator's isolated branch;
existing exact R2 rollbacks remain the sole native/asset rollback owners. A future real PREVIEW
needs exact head, actual control/candidate paths, stable id, comparison and rollback. This
authored packet has no rendered character candidate and intentionally has no PREVIEW.
