# Rosace motion specialist

The first source package consumes the attack planner's `rosace.choreography/1`
N1→N2 interface. It keeps the 33/38 tick tables, earliest f15 seam, H-space root
motion and anatomical right-hand primary grip. N1 reuses its existing hero-key
sources. Eight N2 pose JSONs author the rear coil, low full pivot, contact,
overshoot and two-hand settle. This package has not run a model or Blender.

`sequence.json` resolves authored drawing recipes. `author_sequence.py` validates
the actual planner bytes and exports actor ticks; it never starts a renderer.
`native_driver.py` supplies functions for the integrator/delivery to author an
action on an already prepared isolated rig. It uses the existing evaluated hero
state and grip solver, preserves bone scales in baked keys, binds world toe
markers, and enforces constant body keys. N2 f2/f3 are explicit left-hand reach
redraws; their native solve and pixels are still pending. The actual f15/f1 seam
must keep every bone matrix within 1e-6.

The pose files are authored targets. Skeleton distances, a successful action
bake or a Cloth modifier cannot establish appealing motion or readable grips.
The comparison against existing r3c is required: N1 timing and hero extremes are
reused, while the new A1/absolute-state blend path is not claimed pixel-identical.
N2's full signed turn stays in metadata instead of a shortest quaternion blend.

The physical route reuses `tools/pixel-pipeline/next/cloth/setup.py` and its exact
R2 provenance gate. Delivery supplies approved current in-memory construction;
the disk blend and existing requests remain unchanged. The motion adapter adds
one invisible floor collider in its isolated scene, keeps the original config
bytes, and steps every 60Hz frame from the held prewarm through both attacks and
settle. The caller's pixel callback must neither reapply a pose nor jump frames.
The existing installer checks callback frame and driver matrix preservation.
Current constructed hand/forearm collision membership needs native verification.

`view_keypose_matrix.json` stages 80/144 front, both three-quarter and profile
views, and back, then key extremes and actual moving clips. Strict profile90/0 is
proposed private inspection coverage. Flat world gameplay does not establish an
export yaw. Existing idle45/8 and motion60/8 remain controls; moving stages use60/8.
The integrator adjudicates any final camera change through matched native A/B.
All comparisons keep integer world anchors, a shared canvas and equal
pixels per metre; they never resample a 144 render into an 80 result.

The initial finite request covers the earliest seam and two-hand settling only.
Late entries, mirror variants, hitstop, wall-constrained root motion, actual idle
and N3 transitions need later authored/native work. No full-kit or cloth acceptance
is implied. The critic-owned ACCEPTANCE/CRITIC-PROTOCOL require31 separate parts,
actual full-cycle playback accessible to each critic and full physical cloth,
FX-on/off, transitions and runtime evidence for shipping. Inspection enlargement
is separate from gameplay, which has no zoom. All17 human references remain fixed9 anchors; auxiliary generated
guides remain separate and supply no production pixels or automatic score.

Shared builder/render/PIPELINE changes belong to the Rosace integrator. Source
rollback is removal/revert of this namespace on its integration branch; native
rollback remains the existing exact R2 rollback bundles. No canonical checkout,
main, assets, state maps, installed products or frozen native requests are written.

See `NATIVE-REQUEST.md` for the finite delivery boundary and `CAPABILITIES.md` for
fresh source/file inspection. Source checks are listed in the lane READY record;
actual moving acceptance remains delivery/critic work.
