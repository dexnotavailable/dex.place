# Authored frame export — minimum executable seam

Owner: rosace-motion, new export namespace only. Frozen1f0bfa9 motion source,
shared runtime/contracts/assets and integrator files remain unchanged.

`export_frames.mjs` converts existing authored PNG frames into `dex.sprite/1`.
It imports the real `src/lab/art/atlas-builder.ts` trim/shelf packer and
`src/lab/contracts.ts` validator. Headless ImageData is a byte buffer only;
Pillow decodes/encodes PNGs. No frame synthesis, renderer, model, canvas/browser,
native app or default pose is invoked. Node24 and Python/Pillow are installed.

The source root, normalized input and output root are explicit CLI arguments.
Output must be fresh. The exporter validates before exposing the directory and
retains an isolated failed staging trial for diagnosis. It writes neither its
input tree nor the canonical assets. A release output root is the directory that
will become `public/world`, containing `character` H80 and `character-closeup`
H144. Only the integrator/delivery may copy accepted release outputs there.

## Input and clocks

Input contract: `dex.authored-frames/1`, `fps:60`, `space:"in-place"`, origin
`authored-native` or `authored-2d`, character id/name, explicit additional
`requiredClips`, and variants with `height:80|144`, shading and clips. Each frame
supplies a relative PNG path, explicit native foot pivot, nonempty stable source
`pose` identity, duration/optional hold, optional per-frame total rootMotion and
approved runtime frame data (phase/boxes/cancels/events/anchors). The existing
validator owns those runtime fields. Anchor coordinates are relative to pivot;
source pivot is offset by the trim origin, never clamped or top-aligned. A foot
pivot may legitimately lie outside a trimmed airborne drawing.
Unknown input fields fail; a mistyped event cannot silently disappear. Input,
metadata, evidence and decoded PNG identity are derived from the same read bytes.

Ticks are60Hz. Runtime ClipPlayer uses duration+hold and spreads rootMotion over
those ticks. Varying per-tick root impulses must be separate frame rows, even
when the same image is reused. There is no averaging across held drawings.
Packed image deduplication changes atlas storage only, never frame/tick order.
For sit, hold is folded into duration so the old duration-only World seated
consumer and the repaired consumer share the same exposure without extra frames.
Both supplied sizes must agree by clip ID, frame count, duration, hold, phase,
loop/next and source pose identity. Release also checks root deltas in H units.
Per-resolution rectangles/pivots stay independent. The goal owner's World seam
guards enforce the same paired package boundary; loader remains integrator-owned.

## Review versus release

Review mode emits `review-manifest.json` with contract `dex.sprite-review/1`,
`releaseEligible:false`, missing required clips and its validated package inside.
It never writes `manifest.json`; the World glob cannot select it. Renaming the
review envelope to manifest still fails the generic package validator. This is
an exporter diagnostic, not new art, native cloth or a finished playable package.

Release mode requires both native80/144 variants, every actual Player required
clip plus World `sit`, and every explicit character-specific required move
(Rosace import declares `m1_5`). Every clip must have qualified caller evidence,
an exact source head and existing hashed evidence files; every image/normal has
an expected digest. Qualification binds frameSetSha256 over clip settings/source names,
image/normal hashes, pose/pivot/timing/root and approved runtime fields. Its
hashed dex.authored-qualification/1 receipt must match clip/head/frame set. A
generic unrelated report cannot qualify changed accepted pixels or timing.
Missing/unqualified frames or clips fail, with no idle or
procedural fallback. A non-idle clip made entirely from idle drawings is rejected.
Qualification is caller attestation checked for file identity, not an automatic
art/cloth/playback score. Integrator/delivery retain actual native, motion,
physical fabric,31part blind critic, FX/transition/runtime and licence acceptance.

Normals are optional per variant: supply every matching native map or use null.
The codec preserves the authored ink-mask alpha. Input normalSpace must explicitly
be sprite-y-down or legacy camera-y-up; the latter converts green to255-green on
surface pixels. Dimensions/crop/atlas layout must match. No flat map is fabricated
for a missing file. Legacy strike smears contain bright albedo with no matching
normal surface alpha; the real historical N1 proof therefore chooses normal:null.
Do not claim those missing lit surfaces were repaired by a coordinate conversion.

## Existing Rosace material, alternate-root replay and native dependency

`from_motion_meta.mjs` imports saved motion metadata, checks native px/ss1 and
in-place space, maps explicit anchor names and preserves sample_frame (including
cloth-only redraws), body key, actor tick and root impulse. It emits one row per
actor tick so80/144 stay index-compatible and impulses remain exact. Pre-roll0 is
excluded by default. It never assigns release qualification or gameplay hit/FX
data to historical pixels. Character/anchor mapping is config, not hard-coded
rig assumptions in the exporter.

The real fixture is dressed N1 `n1_r3c_integrated/px80|px144`:33 gameplay ticks
after excluding frame0,19saved drawings, historically rendered and currently
unqualified. The optional normal path must be shown separately on compatible
real non-strike inputs. A clean copied source tree plus the same config/input
must replay with identical package/atlas bytes. This proves root configurability
on Rosace; it invents no second character or speculative framework.

Native input qualification, complete kit including sitting, actual physical
sleeves/tabard/transition frames and gameplay remain sole delivery dependencies.
This source does not install the packages or clear Rosace visual/cloth acceptance.
Commands and exact executed proof/limitations are recorded in the lane READY.
