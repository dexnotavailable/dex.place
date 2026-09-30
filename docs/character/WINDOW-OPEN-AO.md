# Bounded open-window AO diagnostic

PNG guard follow-up, September30: root's actual C2 parent replay found all14 PNG file
hashes different while their native RGBA dimensions/sample bytes remained identical;
independent IHDR inspection found8bitRGBA for all28 files. The source finding is bound
as separate supporting evidence with SHA313c299a...5c800a2; it does not substitute C2's
closed bcb parent for this actual545 opening parent. `post.py` now validates PNG signature,
first13byte IHDR/CRC,8bit color type6, dimensions and decoded native RGBA8 mode/sample
bytes without conversion or tolerance. Encoding/metadata-only changes pass; single
R/G/B/A sample, dimension, depth, mode or corrupt-IHDR changes fail. Original file SHA
and decoded sample SHA remain in proof, while frozen source/input PNG bytes remain
hash-bound in binding. ROI/alpha/all spatial guards and art method are unchanged.

This follow-up starts at root's runtime commit `ef243b08a560958d89892382444a615e02a51c6b`.
Geometry/native/rest/check_rest remain byte-exact129; post is now explicitly changed
for image comparison only. Root reviews this increment before a later runtime commit
and the same exact-runtime-head freeze -> metadata commit -> external finalHEAD READY
sequence. No child freeze at ef243b0, no commit/native run or existing129 request edit.

Entry follow-up, September30: frozen source129's held native request is preserved.
The new `codex/rosace-window-ao-entry-bootstrap-20260930` worktree repairs only entry
discovery and explicit source admission. `wrapper.py` temporarily adds its own directory
and the reviewed helper directory before importing the actual siblings, restoring the
exact `sys.path` list identity/content after imports succeed or fail. No geometry,
S7 shape evaluation, ray formula, native guard or existing execute/main cleanup changes.
The real `importlib` regression clears binding/native/geometry/rest/helper caches and
removes those directories from the path; it loads the actual wrapper and siblings with
no `bpy` import or native call. A separate forced-import-failure route checks restoration.

The new request id is `rosace-open-window-physical-ao-entry-bootstrap-129-20260930`.
Its source base is129; actual geometry/native parent remains545. Parent independently
reviews this source before the runtime source commit, ROOT freeze and final READY:

```text
python art/rosace/integration/window_ao/binding.py check-admission --expected-source-head <full exact current source HEAD>
python art/rosace/integration/window_ao/binding.py freeze --expected-source-head <full reviewed source HEAD>
python art/rosace/integration/window_ao/binding.py verify
```

Freeze requires the exact explicit current runtime source HEAD and ancestry from545
and129; freeze still checks actual545 parent HEAD. It records that reviewed `sourceHead`
as a bounded ancestor. Native verify requires545,129 and that sourceHead ancestry plus
complete exact runtime source/input/CLI/frozen-evidence fingerprints. It records the
actual executing HEAD, while external ROOT READY/delivery admission pins that final
HEAD exactly. Changed runtime source or an unrelated/non-descendant HEAD fails.

The two-step checkpoint avoids a tracked commit-hash cycle: commit reviewed runtime
code first, freeze at that exact live HEAD, then commit only generated manifest/receipt
metadata. An unchanged runtime fingerprint permits that metadata-only descendant;
ROOT READY records its final executing HEAD outside the tracked binding. Do not embed
that final commit hash self-referentially in its manifest. Manifest/receipt JSON uses
UTF-8 LF, matching eol=lf; binding/source-checks do not self-hash. The inherited binding
here remains pending root's post-review freeze. Same four stills/guards, no art change.

Stage2 source checkpoint, September30. Actual545 W2 native geometry preservation passed,
but three fresh blind critics rejected the dark burgundy chest patch. Native opening
light has median AO29/255 and ramp16/255; differently oriented other skin has about235
and109. `materials.py` multiplies diffuse and ambient by the POINT `ao`; the canonical
rest bake includes closed clothing, while W2 removes copied bodice faces and preserves
the body AO. Stale closed-clothing AO is a source-backed hypothesis. This comparison
can disprove it; no source fixture or scalar ratio confirms its cause or visual quality.

The opt-in entry is `art/rosace/integration/window_ao/wrapper.py`. It delegates to the
unchanged exact545 `nx_reconstruction_blender.py`: real opening, same R2 model/blend,
head1.10, authored gesture and seated hands1.30, idle144/80 at ss4. Both controls have
the same actual W2 aperture. The candidate hooks only after `W.install` completes its
unmodified strict retained-face and protected-body guards, before pose. The control
hook never copies, updates or inspects body AO data.

Candidate eligibility comes from the actual rest ring's inner geometry and actual
body source polygons, using validated simple X/Z triangulation and positive-area
polygon intersections. It requires front -Y normals and all overlap vertices strictly
behind the ring, within the native body AO distance. Depth ties, back faces, ambiguous
source identities and nonfinite data stop. Every vertex of each eligible face is
explicitly selected for POINT interpolation, and every incident face is declared as
support. No guide/raster/RGB mask, guessed chest bounds or whole-body rebake selects
the data. The raw/finished footprint derives from posed versions of those same source
indices, with declared one raw supersample and one sprite-cell local finish edges.

The candidate copies only body mesh data in memory. It snapshots streaming native
typed schema/payload hashes, UVs, topology, positions, decoded corner normals, shape
keys, weights/groups, matrices, custom properties, material pointers and IDs. Only
named FLOAT/POINT `ao` values at selected indices can differ. All other values and all
outside AO values remain exact, with no tolerance. Original datablock contents are
verified separately. Unsupported native schemas fail. Every selected value is computed
with the existing deterministic `hemisphere_dirs(24)`, inverse-transpose world normal,
1.5mm origin and distance-weighted ray formula; authored `crease` remains multiplied
in. Actual body .075 distance/.9 strength must remain unchanged. No forced AO1, shade
lift, material retune or painted replacement pixels.

Independent review found and corrected a source blocker: the canonical S7 build restores
Basis positions after its shaped bake, then sets `figure_bust` to1.0. Its build receipt
records987 body vertices displaced up to40.46mm. Reading `ob.data.vertices` therefore
does not give the actual active rest shape. Eligibility, BVH and body ray origins/normals
now consume the same shape-aware native rest geometry, including the ring/cut bodice
and all other visible occluders, rather than Basis coordinates.

`rest_geometry.py` evaluates each render-visible occluder on a temporary owned object,
mesh and independent key copy. It retains active relative shape values, mutes, key
relationships/interpolation and vertex-group masks; strips ALL modifiers (Armature and
Solidify included), constraints, parent and object animation; and uses the exact original
world transform. POINT/FACE source-index stamps plus exact oriented face/corner topology
guard source identities. Native evaluated positions and shape-aware normals are read
before every temporary object/mesh/key/evaluated mesh is deleted, including error paths.
Original key settings, geometry, attributes, modifiers and transforms are rehashed exact.
The known current nonzero S7 mix is supported; an active `figure_bust` yielding Basis
fails. Absolute, show-only/pinned or driven mesh/key contexts are explicitly unsupported
and stop. This is a native shape-only evaluation route, not a manually approximated mix.

The BVH uses those actual current shaped rest meshes, including body/self, cut bodice,
real gold rim, collar and garments, without modifier/Solidify shells or hidden reference
meshes. Native per-point24-ray
distances, crease, computed value and exact float32 readback are recorded, with actual
version, source geometry, palette and field-source hashes. Native schemas/BVH/world
normal/shape-key behavior are still pending actual delivery; mocks claim none of them.

`binding.json` binds exact545, the complete bounded renderer/finish Python+JSON source
set, canonical blend plus actual S7 build companion, strict forwarded CLI and actual545 OPEN parent evidence. Its
frozen20 are seven raw maps plus meta/facepass/landmarks for each80/144; additional
opening geometry, rig/contact, full preservation, finished and native provenance
files are hashed. C2's CLOSED bcb parent cannot substitute. Source additions/deletions
and content/input/CLI/evidence mutation fail. Every native process verifies before and
after; wrapper exceptions restore all hooks, prior `posing.apply_pose`, recipe mode,
and original body pointer, including partial AO installation and cleanup failure.
The original reconstruction wrapper owns its W2 rollback; no blend is saved.

Four fresh stills are requested: open control144/80 and same opening rebaked144/80.
Parent reuse is disabled in this first request. Native delivery alone owns execution
through its exclusive/GPU lease at a free boundary. Parent source review precedes READY.
The unchanged reconstruction finish (over the R2 base) must replay actual545 control
still/ground0px; all seven control raw PNGs must match actual545 in validated native
RGBA8 dimensions/sample bytes. File hashes remain provenance and can differ by encoding.
Candidate ID/normal/depth/depth2/noise samples stay exact; bones/pose/camera/ppm/anchor and opening/rim
projection stay exact. Only light/beauty may differ in the declared actual support.
`post.py` retains full outputs, reports AO/ramp distributions and changed-color clusters,
and rejects any raw/finished outside-scope or alpha difference. Adaptive palette
coupling is retained and reported, never composited away.

CPU checks, through the packet gate:

Source fixtures are proven on CPU: front/back/depth/touch/nonfinite/source-index
eligibility, deterministic24-ray weighting, exact outside-data rejection, source/input/
CLI/frozen-binding mutation rejection, and six injected actual-wrapper success/failure/
cleanup paths. The actual rest helper has injected nonzero S7-like relative/group/mute
mix, changed normals, source-index/winding/corner corruption and temporary failure/
cleanup fixtures; unsupported absolute/show-only/driven/missing-group contexts reject.
Those supplied CPU evaluations prove helper control flow only. Post fixtures expose
outside footprint and alpha leakage; all new source
compiles. These are synthetic control-flow checks, with native/render/art pending.

```powershell
& D:/Dex/Automation/reports/dex-suite-resumption-20260930/resource-gate.ps1 -Owner rosace-source -ScriptBlock {
  python art/rosace/integration/window_ao/check.py
  if ($LASTEXITCODE) { throw 'AO source fixtures failed' }
  python art/rosace/integration/window_ao/binding.py verify
  if ($LASTEXITCODE) { throw 'AO source/input binding failed' }
}
```

Native entry, separate processes/modes, only by delivery after parent review:

```text
python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python <executing-repo>/art/rosace/integration/window_ao/wrapper.py -- --window-ao-mode <control|rebaked> --out <executing-repo>/review/rosace/art/next/window-ao-delivery/<mode>-raw
python art/rosace/integration/window_ao/post.py --root <executing-repo>/review/rosace/art/next/window-ao-delivery
```

The whole window geometry/material junction remains below9. This is a bounded physical
cache-method change, not default adoption. Inspect real gold frame, skin and shadow at
80/144, then three fresh blind critics on qualified materially new pixels. If it fails,
change the actual contour/rim/material junction next rather than continuing a microtint
loop. R2/default/canonical/rollbacks, frozen545 art, C2, shared W2 and Stage3/4 stay exact;
stills establish no motion/cloth acceptance. PIPELINE is parent-owned and must receive
this source-only checkpoint when the parent adopts the reviewed handoff.
