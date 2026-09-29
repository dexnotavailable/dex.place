# Rosace fabric physics contract — source module, native proof pending

Dex requires physical fabric on the loincloth/tabard and both bell sleeves.
The world uses2D sprites: simulate those authored meshes in Blender, bake their
deformed frames into movement clips, and retain actual moving proof. This is
not a runtime mesh-cloth claim. The current canonical R2 remains unchanged.

The old `tools/motion-ai/blender_apply.py` spring-driven cloth bones remain a
preserved earlier method. Their motion/static drape is not accepted as proof
of this requested mesh simulation. The new isolated module is
`tools/pixel-pipeline/next/cloth/setup.py`; settings/pieces are in
`art/rosace/next/cloth-physics.json`. All numbers are initial authored trials,
not proven material constants or final acceptance.

## Physical ownership

Simulated pieces: `tabard`, `sleeve.L`, `sleeve.R`, with their existing meshes,
materials, lining/thickness, ornament design and coverage. Install one native
Cloth modifier after the Armature and before Solidify. The tabard's waist
boundary row25 and each sleeve's complete upper-arm boundary loop30 are pinned;
hems/cuffs remain free. Reassign only those seam vertices' deform weights to
hips/upper arm so old garment-chain animation cannot drag the pins. Select
the sleeve loop topologically, not with an incomplete height cutoff.

Gravity, mass, stiffness, damping, attachment inertia and deterministic wind
are explicit. Body/head and the actual moving haft/blade get Collision
modifiers in a restricted collection; garments/ornaments are excluded from
that collider collection. Self collision is enabled. Account for the inward
Solidify shell in both object and self separation margins and record the
effective margins. Settings do not prove that a moving shell avoids clipping.

Cross ornaments are frozen at the intended bind pose only in memory and
SurfaceDeform-bound to their actual fabric. Their old Armature/chain modifiers
are removed from the temporary scene; visibility flags stay unchanged. A
missing ornament, unsupported RNA property, wrong seam topology or failed
surface bind stops qualification. Nothing saves the canonical blend.

## Simulation and export

Prepare the full driver body/weapon animation **before** installing Cloth.
Calling pose/drape solvers piecemeal while Cloth evaluates can feed intermediate
states into its cache. During simulation use finalized keyed motion and one
chronological frame step. The rendering callback may not change the rig or
current frame. Free fabric uses a fixed rest shape (`use_dynamic_mesh=false`),
with45held entry frames before export; warmup must equal the intended starting
pose and stay held. This avoids initializing cloth in a different T/rest pose.

`install(scene, config, output, start, end)` prepares the native simulation;
`chronological_bake(...)` evaluates every60Hz frame, emits actual world-space
fabric geometry/hashes and optionally calls delivery's pixel renderer. Preserve
native version, settings, mesh/pin/collider/ornament maps, warmup/frame range,
driver action, cache/geometry hashes and source head. Unsupported installed5.1
API must fail closed; documentation of a newer API is not execution evidence.

Pixel rendering uses144hero/80world and the approved R2 finish, with one common
framing and foot/root-anchor convention across each whole trajectory. Export
root motion exactly once. Normal/albedo frames must represent the same actual
deformation. A geometry bake or callback log alone is not a rendered clip.

Bake idle, run, turn, jump/land, dash and representative M1/Q/R from the actual
authored/retimed motions. A small pinned-wind or body-translation diagnostic can
qualify the solver first, but it does not qualify any gameplay move. No quality
score is inferred from still frames, modifier installation or changed vertices.

Keep simulation state continuous through transitions: idle↔run, turn→run,
jump/fall→land, dash→recovery and attack/skill/ultimate→idle. Do not reset fabric
to a cold entry cache at every clip boundary. Baked2D animation needs explicit
entry/exit or transition clips and phase-safe loops; state changes must not
snap. Keep these sprite integration contracts separate from world source.

## Acceptance and rollback

Inspect actual moving clips at native and integer zoom: cloth lag, inertia,
folding and settling must read; attachment seams remain attached; approved
silhouette/coverage and ornaments survive. No obvious body/haft/self clipping,
rubbery stretch, jitter or loop/transition jump is accepted. Compare physics
control/candidate moving trajectories with the same driver, timing and finish.
Native setup/maps and simulation metadata support playback inspection, never
replace it. Three fresh critics are required for actual candidate pixel/motion
proof; they must view moving clips before making a motion judgment.

The source-only checks cover exact seam selection, free hems, immutable hand
ladder and syntax. Native setup/bake, actual pixels, smooth transition exports
and playback remain pending. Keep both R2 rollback bundles and all rejected
artifacts; no canonical asset, picker map or default changes before acceptance.

Primary API/shape references checked while authoring:
[ClothSettings](https://docs.blender.org/api/main/bpy.types.ClothSettings.html),
[cloth shape/pins](https://docs.blender.org/manual/en/latest/physics/cloth/settings/shape.html),
[cloth collision settings](https://docs.blender.org/api/main/bpy.types.ClothCollisionSettings.html),
[CollisionSettings](https://docs.blender.org/api/main/bpy.types.CollisionSettings.html).
They document interface/semantics; delivery verifies the actual installed RNA.
