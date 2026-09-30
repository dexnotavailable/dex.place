# Input, qualification and output boundaries

Normalized input uses `dex.authored-frames/1`. Root paths remain CLI arguments;
image/normal/receipt names are relative to that source root, resolved through
actual filesystem paths. Absolute/traversing/symlink escapes fail. An output root
must be fresh; no canonical or previously produced package is overwritten.

Required top-level fields are contract, fps60, in-place space, authored-native
or authored-2d origin, character id/name, explicit additional requiredClips and
one/two native variants. Optional provenance is kept in a sidecar. Unknown keys
fail. Release requires both heights80/144; review can have one height but two
provided heights must correspond. Current Rosace requires the actual sixteen
Player IDs, World sit and its additionally declared m1_5. No missing move is
filled with an idle clone or procedural generation.

Variant fields: height80/144, shading flat/baked, clips and optional defaults.
Clip fields: id, frames, qualification plus the actual contract's loop, next,
gravity, angles and tags. Frame fields: image/imageSha256, optional
normal/normalSha256/normalSpace, pivot, pose, duration/hold, phase, rootMotion,
anchors, hitboxes/hurtboxes, iframes, cancel and events. All runtime fields are
validated by the existing generic validator; misspelled fields such as event
are rejected instead of being dropped. Input has no atlas rectangle: the actual
packer creates it. Pivot is source native pixel-space, anchors pivot-relative.

For release, every clip declares qualified status, exact40hex sourceHead,
frameSetSha256 and nonempty hashed evidence. Every PNG needs its expected64hex
file digest. `frameSetDigest(clip)` is exported by export_frames.mjs and computes
the accepted-content identity over clip settings and ordered frame source names,
PNG digests, pose/pivot/timing/root, normal convention and approved runtime fields.
It excludes qualification itself and execution/root path metadata. A later
change in timing/events/pivot/source content requires new qualification.

Each listed hashed qualification receipt must use this shape, with the actual accepted
head/clip/frameSet digest. The exporter parses the same bytes it hashes:

```json
{
  "contract": "dex.authored-qualification/1",
  "status": "qualified",
  "sourceHead": "exact accepted source commit",
  "clip": "accepted clip id",
  "frameSetSha256": "frameSetDigest of the accepted normalized clip"
}
```

Those prose values are schema placeholders, not valid hashes or an acceptance
receipt. Production qualification receipts can reference genuine native/render/rig/cloth/motion,
blind critic, licence and runtime proof. Their qualified status is a caller
attestation from the owning integration/delivery workflow. File/identity checks
cannot independently determine whether pixels are attractive or physical cloth
and actual playback passed. No qualified Rosace full-kit receipt is manufactured
here. The historical adapter always writes unqualified status/unknown historical
head, regardless of successful atlas QA.

The public `dex.sprite/1` package contains only its allowed fields. Sidecar
provenance stores source canvas/pivot, trim, per-frame identity and digests,
tick/root data, qualification/evidence and actual validator/packer hashes.
PNG pixel content and its digest are decoded from one immutable byte buffer;
path replacement cannot associate old pixels with a second file version's hash.
Input/metadata/evidence also parse and hash a single captured read.

Review output wraps a validated package in `dex.sprite-review/1` at
review-manifest.json, releaseEligiblefalse and explicit missing coverage. It
cannot be passed to the generic runtime package validator or discovered by the
World manifest glob. A successful review export is technical artifact evidence,
not a finished package or native/art/cloth/playback acceptance.

Release output uses manifest.json in character and character-closeup, with
identical IDs/frame count, source pose identity, duration/hold/phase and loop/next.
The actual native rectangles/pivots differ per size. Source root motion is applied
once and checked in H units across the pair. Sit holds are folded into duration,
preserving60Hz timing on the legacy World duration-only consumer and the repaired
consumer. Generic frame hold semantics remain unchanged on other clips. No
source still/144frame is resized to invent an80variant. Optional normal maps must
cover all supplied frames with matched dimensions/crops/layout and explicit
sprite-y-down or legacy camera-y-up convention; absent maps remain null.
