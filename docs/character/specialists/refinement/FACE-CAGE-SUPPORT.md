# FC1 original P0 support and encoded-normal correction

Source hypothesis only, September30. Worktree starts at exactbd94059; bd and the418
zero-render probe remain frozen. Actual df39907e...70e43 diagnostic shows copy/update
preserve all5120 corners. A zero-deformation setter roundtrip changes2592 decoded and
2596 encoded corners, including four encoded-only cases. Deformation can also alter
decoding context while keeping stored pairs. No full head coordinates were serialized,
so this source step cannot claim that actual expanded planes leave enough facial space.

`facecage_support.plan` takes the actual original head polygons/points. P0 is immutable:
ALL vertices whose ORIGINAL G.move returns the original coordinate, actual941, plus
explicit Neck-weight vertices and their existing anatomical edge neighborhood. For
original neck/crown/back regions, use full incident polygon stars, including every
vertex of every incident polygon. Move neck threshold UP to maximum neck-supportZ,
crown DOWN to minimum crown-supportZ and back cutoff toward front to minimum backY.
Both back cutoff and taper start use that final back plane. Keep the original orbital
lift/width, jaw narrowing and bridge amplitudes. Head and all hidden refs consume the
SAME continuous final config, including target-normal transport and projected anchors.

Reject before candidate rendering if neck leaves insufficient face space, crown is at
or below eyeZ+.30span, back at or beyond eyeY-.10span, final head does not change, actual
native-float coordinates differ from the declared field, or actual geometry has a
nonfinite, overstrained or flipped/degenerated changed triangle. Full polygon stars
are a conservative hypothesis; they do not assert a Blender smoothing fan. Actual
strict normal readback can still reject the method. No hidden raster, pose or material
lever is introduced, and no image is promised if actual space/support is unsupported.

The guard contract is explicitly clarified. ALL ORIGINAL P0/anatomy corners retain
EXACT original decoded components AND original encoded signed16 pairs. No originally
protected corner is removed. Originally active vertices newly pinned by support remain
inside the ORIGINAL active normal footprint: their decoding context can need encoding
changes despite zero final positional displacement. This is not a literal unchanged
old dynamic-final-zero guard, a tolerance allowance or an omission waiver.

After final geometry is bound, read actual deform-only decoded normals. Compute target
normals with G.transport and FINALcfg. Run the setter on the owned copy, then restore
original CORNER INT16_2D `value` pairs for the COMPLETE set where deform-only decoded
equals original AND intended target equals original. Restore even if the setter changed
only encoded pairs without changing decoded components. Rebind/update/read actual
values, require every originalP0/anatomy and every complete-preservable corner exact in
both domains. Unsupported encoded names/domains/types/RNA fields/pair values fail.
All counts, ordered-pair hashes, schema, mismatch indices and vectors/pairs are reported;
active target-versus-final differences are measured without a quality score.

Outside typed invariants include every attribute name/domain/datatype/required flag,
RNA payload schema and values. Only declared position and encoded-normal payloads may
differ; their schemas stay exact. Typed legacy UV data is materialized FIRST, since it
can create internal selection attributes. Candidate and every original invariant are
read back after ALL head/ref normal operations. Original coordinates/decoded/encoded
arrays stay exact. All pointers restore before owned mesh removals; cleanup attempts
all objects even after an individual removal failure.

Fresh private `facecage-support-install.json` is written before the first candidate
image, including rejection paths. It retains old/attempted-final planes, full polygon
support sets, ALL originalP0 corner indices, actual normal schema/count/full hashes,
complete mismatch corner/vector/pair rows, and actual cleanup result. The payload is
bounded by the finite native vertex/corner count; no unchanged face-array duplication
or extra native probe is required. Source fixtures test encoded-only setter drift,
support-target/deform-context drift, monotonic/rejected planes, UV materialization order,
actual shared-config adapter behavior, failure retention and complete pointer cleanup.
Injected CPU meshes/normals prove those code paths, not Blender/API or art acceptance.

Future native post now includes depth2. Frozen R2 has only SIX raw PNG passes and is
unchanged. Bind the seventh separately to actual completed failedbd FC1 control depth2,
with its original meta, _render.json, delivery READY/native receipt and file hashes.
The input manifest also binds frozen six passes and finished controls plus actual418
normal diagnostic. New controls must replay validated native RGBA8 dimensions/sample
bytes exactly for all seven sources, retaining file SHA provenance without lossy mode
conversion. R2 still/ground and all existing head/rig/framing/ROI guards remain exact.

Post guards now require BOTH trial sourceInputBinding dictionaries equal actual verified
input/metadata-source bindings, and compare the entire new control/candidate metadata
against corresponding frozenR2 AND failedbd-depth2 metadata. No paired camera/light/
framing/height/pose/material/extra-field drift can pass merely by matching each other.
Only the declared six-to-seven depth2 pass schema, cage eye-placement interface, and
specific absolute pose_file/d9.r2 relocation are interpreted. Referenced source filename
and bytes must agree after ONLY CRLF->LF; retain raw SHA256s and check each pose_sha1
prefix against that record's own actual raw source bytes. No lone-CR removal, whitespace,
JSON-semantic/numeric or image tolerance. Frozen referenced and executing source files
are pinned in separate metadata-sources.json, preserving the original574ecde6 input
binding. Every one of seven control/candidate PNG shapes must exactly match its ID/meta
dimensions BEFORE ROI or NumPy comparison, rejecting height-one broadcast cases.
The direct postguard fixtures exercise real guards with actual frozen metadata and
synthetic valid PNGs, without a mocked ROI/mask or actual post/render execution.

Admission distinguishes model identities explicitly. The original574ecde6 input binding
keeps its historical support-worktree model key/read path fixed. A new native code
checkout may have another REPO, but its actual relative tools/pixel-pipeline/drive9/
r2_model.json is separately enforced against the frozen historical raw SHA and the
relative executingReferencedSources in66ca81de metadata binding. No arbitrary data-root
normalization or relocation is allowed; frozenR2, failedbd, canonical and diagnostic
absolute roots remain fixed. Actual collect/verify fixtures relocate only an isolated
code root with byte-exact model/poses and admitted manifests, reject changed executing
or historical model bytes using shadow copies, and do not mutate real inputs.

CPU commands through resource-gate Ownerrosace-source: existing check_facecage.py,
check_facecage_cleanup.py, new check_facecage_support.py/check_facecage_shared.py, then
facecage_inputs.py freeze-inputs, freeze-metadata-sources and verify-inputs; changed
post guard checks use check_facecage_post.py. New request is integration/
facecage_support/native-request.json. ROOT independently reviews before exact-source
READY; sole delivery owns any finite8still native execution. No child commit/push,
native/GPU/browser/post run, canonical/default replacement or accepted face/9 claim.
