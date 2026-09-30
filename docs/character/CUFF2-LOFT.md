# Cuff2: upper-loft refit at the same 55 mm

Reviewed source experiment; independent review passed after the computed-overflow fix. Native Blender, finished
pixels, anatomy, cloth and appearance acceptance have not run. The R2 default
and every frozen bcb/c138/545/f5 input remain unchanged.

C1 on exact c138 rejected its fixed55mm construction before candidate render:
the smoothstep(.65,1,t) concentrated retreat near the mouth and compressed or
reversed actual longitudinal gaps. Its trace remains in the delivery source
finding `lanes/delivery/source-findings/rosace-cuff-C1-c138e5d.md`. Parent raw
144/80 frames exist; no C1 candidate finish or score is inferred.

Cuff2 changes construction method and preservation scope. For column k, let
q(row)=dot(p(row,k), shoulder-to-wrist axis), L=q(22)-q(0), and
d=0.055*smoothstep(-.35,.35,sin(phi)). Its axial coordinates become
q'(row)=q(0)+(1-d/L)*(q(row)-q(0)). Equivalently, retreat is d times the
normalized **actual** axial progress. Radial coordinates do not participate.
Every axial gap in a column retains the same factor 1-d/L, including bent or
nonuniformly spaced source rows. An insufficient actual span rejects the fixed
55mm request; there is no shortening clamp, numeric retune or waived guard.

The attachment ring row0 and lower sector sin(phi)<=-.35 are exact. Rows1..22
in upper sectors now refit, including the rows1..14 that C1 protected. This is
the intentional broader loft scope. The lower hanging bell, cross at phi=-80
degrees and its anchor stay in the protected sector. sleeve.R, both original
mesh datablocks, source indices, face winding, UV/corner/point/crease/limb
attributes, rig weights, material faces, modifiers and transforms remain exact.
The copied mesh can have changed derived surface normals; no custom normals
are overwritten. Custom-normal or shape-key inputs reject.

The pure geometry validates690vertices/660unique source cells, integer cyclic
quad corners, a finite unit axis, every finite positive source axial gap, and
every actual column span. The adapter verifies all23source rings' world
front=-Y/up=+Z azimuth signs and order using their projections perpendicular
to the supplied axis. It rejects collapsed basis, shifted/reflected/duplicate
azimuths. Parent or candidate triangles must have strictly positive area and
retain orientation for both possible quad diagonals and all4corner Jacobians.
Every stored gap must retain max(10micrometres,25%of parent). Float32 mesh
storage is separately audited; radial residual must stay <=1e-7m, with exact
protected coordinates. This bound concerns storage precision and does not
relax the positive triangle, Jacobian, topology or gap checks.

## Reuse and cleanup

New source is only `art/rosace/integration/cuff2/` and this document, based on
bd94059a13d5becd68b80c0d219fdb6ad1d989f9 in the isolated
`D:/Dex/Temp/dex-place-rosace-cuff2-20260930` branch
`codex/rosace-cuff2-loft-20260930`. No Stage3/export or specialist C1 edit.

`cuff2_blender.py` loads the unchanged C1 copied-mesh guard/restore and typed
structure/attribute primitives read-only. Only that loaded adapter's `G`
dependency is temporarily replaced with Cuff2; the exact arbitrary prior
object restores on success or exceptions, including cleanup errors. Cuff2
adds both-original-mesh checks, writable modifier RNA state, matrices and UV
selection state, source azimuth verification and a stored-coordinate audit.
Unknown mutable modifier collection schemas fail closed pending an actual
typed snapshot. The native Blender API remains unexecuted by this CPU lane.

`cuff2_trial.py` reuses the actual H1 `nx_hands_blender.main` around the exact
bcb closed construction gesture and existing seated1.30 hand solve. Both modes
retain head1.10 and original R2 finish. This parent is diagnostic; the current
545blind votes did not promote its body/gesture or W2 opening. Cuff2 has no
face, hand-pose, window, shader, finish, physics or motion stack.

The wrapper restores library, recipe and its exact prior MODE, head installer,
figure_pose.apply_pose, **posing.apply_pose**, grip_hand, hand_rest,
f1_module, every captured component facepass, PASSES, argv and module search
path. Mesh cleanup runs before hook restoration; a mesh-removal exception
still restores all function hooks. C1's restore first restores the original
object.data pointer, then removes its private copy. A removal failure can leave
an unused private datablock and rejects native qualification; it cannot justify
claiming complete cleanup. The wrapper never saves a blend.

`cuff2_native_post.py` reuses the exact existing `d9_post.process`, R2 finish
loader, categorical `visible_hand` (material/part/limb14) and matrix comparison
primitives. It implements new Cuff2 schema/provenance guards and creates only
`cuff2_trial.json`, `cuff2-native-proof.json`, and `cuff2-native-...` sheets.
No C1 result is silently relabeled, and no shader pipeline is duplicated.

## CPU evidence and native dependency

Run CPU checks through the packet's shared gate as owner `rosace-source`:

```powershell
& 'D:/Dex/Automation/reports/dex-suite-resumption-20260930/resource-gate.ps1' -Owner 'rosace-source' -ScriptBlock {
  python -B 'art/rosace/integration/cuff2/check_cuff2.py'
  if ($LASTEXITCODE) { throw "Cuff2 CPU failed: $LASTEXITCODE" }
}
```

16 test methods currently pass; `cpu-report.json` binds their exact Python
source hashes. The fixtures compile the actual F3 `sleeves_f3.point` function
and common lerp/smoothstep AST with injected vector math, and execute the
unchanged C1 fixture(.28): original C1 rejects, Cuff2 passes the same55mm.
Other checks exercise bent/mixed axial spacing, a non-axis-aligned source,
protected coordinates, face-array/cyclic-corner permutations, malformed or
deleted/duplicate cells, incorrect schema, azimuth shifts/reflections, axial
reversal/zero/insufficient span, nonfinite/nonunit axes, and invalid triangles.
The actual Cuff2 wrapper **and actual H1 main** run with injected native
dependencies through success, library, installer-after-patch, geometry,
render and mesh-cleanup failures; checks compare exact prior function objects.
An arbitrary prior geometry dependency and cleanup failure also restore.
The real Cuff2/C1 copied-mesh adapter also executes with injected mesh data:
original pointers, coordinates and crease attributes remain exact, private
copy restoration/removal succeeds, and custom-normal input rejects.
Native post fixtures reject C1 schema, wrong scope/retreat/finish/window,
corrupt matrices/framing/grips, NaNs and incomplete/changed frozen bindings.
These checks neither execute Blender nor prove real pixels or native API use.

`native-request.json` describes four raw idle stills only: parent/Cuff2 at
144/80, ss4, same closed gesture/seated1.30/head1.10. `frozen-parent.json`
binds the exact existing bcb seven raw image passes plus meta/grip/reconstruction
records at both sizes. The parent integrator must independently review, freeze
an exact reviewed source head/hashes, and emit its own READY before delivery.
This uncommitted request is not READY or dispatch authority.

Delivery alone runs two separate fresh Blender processes through its existing
exclusive packet/native/GPU gate, deadline, exit-code1 and owned cleanup:

```powershell
python "$repoPath/tools/pixel-pipeline/blender_env.py" run --python-exit-code 1 --python "$repoPath/art/rosace/integration/cuff2/cuff2_trial.py" -- --cuff-mode parent --hand-scale 1.3 --shots idle --px 144,80 --ss 4 --head 1.10 --blend 'D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend' --r2 "$repoPath/tools/pixel-pipeline/drive9/r2_model.json" --out "$repoPath/review/rosace/integration/cuff2/native-20260930/parent"
python "$repoPath/tools/pixel-pipeline/blender_env.py" run --python-exit-code 1 --python "$repoPath/art/rosace/integration/cuff2/cuff2_trial.py" -- --cuff-mode cuff2 --hand-scale 1.3 --shots idle --px 144,80 --ss 4 --head 1.10 --blend 'D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend' --r2 "$repoPath/tools/pixel-pipeline/drive9/r2_model.json" --out "$repoPath/review/rosace/integration/cuff2/native-20260930/cuff2"
python "$repoPath/art/rosace/integration/cuff2/cuff2_native_post.py" --root "$repoPath/review/rosace/integration/cuff2/native-20260930" --frozen-parent 'D:/Dex/Temp/rosace-reconstruction1-native-20260930/review/rosace/art/next/reconstruction1-delivery/construction-control-raw'
```

Post requires exact hash-bound frozen inputs, zero-pixel parent replay on all
7raw passes, actual paired/frozen bone matrices<=1e-6, identical camera/ppm/
anchor/canvas and grip/scale/socket/slide, finite synthetic Lgap<=1.5cm and
unchanged R2 processing. Before/after preservation of both canonical blends,
7maps, R2 assets and both exact rollback bundles remains delivery's established
guard. Native can reject this construction; CPU success does not override it.

At80, >=20categorical raw holding-hand skin pixels and a >=4x5bbox remain
necessary, not sufficient. Actual wrist/palm/thumb opposition, shaft contact
and interruption, cuff seam, pinching/clipping and whole144/80 must be viewed.
Only genuinely new qualified finished pixels justify Stage2's three fresh
neutral fixed9 human-reference critics. No mean can hide a per-part rejection.
No automatic canonical/default/main promotion or deployment. Physical sleeve/
tabard collision/inertia/bake/transitions and complete moving gameplay remain
Stage3 dependencies; this idle construction cannot establish them or a9claim.

## Shared playbook insertion for the parent integrator

The PIPELINE lane note records the independent source review: Cuff2 replaces
C1's concentrated distal retreat with the same55mm retreat distributed by
actual column axial progress over upper rows1..22. Row0/lowerbell, both
original sleeve meshes and typed structure remain protected. CPU source and
injected actual-wrapper checks pass; exact four-still native/API/visibility/
anatomy/appearance/cloth proof remains pending. Source/request/limits live in
CUFF2-LOFT.md and art/rosace/integration/cuff2. Rejected C1 remains preserved.

## Native RNA descriptor repair (source only)

The exact f2f2d83 entry repair produced parent144/80, then the candidate stopped
in `cuff2_blender.modifier_state` because Blender's StringProperty descriptor
does not expose `is_array`. This is an RNA descriptor/API failure before the
loft construction runs, not a Cuff2 geometry or appearance verdict. The old27/f2
sources, requests and failure packets remain frozen.

The bounded repair lives in `D:/Dex/Temp/dex-place-rosace-cuff2-rna-descriptors-20260930`,
branch `codex/rosace-cuff2-rna-descriptors-20260930`, base
f2f2d83d396627955e8c4ae0768895e58333d86e. STRING and ENUM use explicit
scalar/enum-flag readout without accessing array metadata. Only BOOLEAN, INT
and FLOAT query their array capability with `getattr(is_array,False)`.
Scalar and array values remain in the exact modifier structure snapshot;
nonfinite floats and invalid value types reject. Enum flag sets sort
deterministically. Pointer/null values retain the existing RNA type/name
identity snapshot. Unsupported mutable RNA types and collections reject;
readonly descriptors and rna_type stay ignored under the existing contract.
No mutable STRING/ENUM value is skipped to bypass the descriptor failure.

Fixtures instantiate StringProperty and EnumProperty objects that genuinely
lack `is_array`. They cover boolean/integer/float scalars and arrays,
pointer/null, enum flag sets, ignored readonly descriptors versus every
retained mutable field, unsupported types/collections and nonfinite values.
Mutations to each supported mutable field change the actual adapter structure
hash, including strings, enums, booleans, numeric arrays and pointer identities.
These are injected CPU fixtures; actual Blender descriptor/native acceptance
still requires delivery. The source CPU receipt is regenerated deterministically
with LF bytes and binds the current source hashes; all21test methods pass under
the packet resource gate as `rosace-source`.

`native-rna-descriptor-repair-request.json`, ID
`rosace-cuff2-rna-descriptor-repair-20260930`, requests the same bounded four
parent/Cuff2 idle144/80 stills in a new output namespace. The old
`native-entry-repair-request.json` is untouched. Fresh independent review and
Root's new exact-head READY precede delivery. Fixed55mm, indices, coordinates,
quarter-gap/triangle/Jacobian/radial guards, copied-original preservation,
camera/rig/shape/custom-normal/UV/data guards and existing raw replay/visibility
acceptance all remain unchanged. No native run or visual gain is claimed by
this repair, and no additional shader, pose, window or motion lever is added.
