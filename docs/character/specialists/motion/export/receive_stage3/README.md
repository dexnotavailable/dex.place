# Completed Stage3 → review atlas receiver

This finite adapter consumes the frozenV2 Stage3 output definition. Current
Stage3 READY admits preflight only; completed native/post frames do not exist.
The complete receiver positive path is therefore **unproven until genuine post
input arrives**. Historical pixel utility and synthetic matrix/negative tests
are separate evidence. No fake completed native batch or post-success artifact
is created. No native, finish, Blender, model, download or World process runs.

Only new `motion/export/receive_stage3/` and these docs are Stage4 source. The
receiver changes no planner, body, cloth, FX, frozen1f/9da/9b, input or shared
builder. Stage3 owns actual native/cloth/post qualification, Stage2 owns accepted
appearance, Stage1 alone executes native and publishes.

## Source and admission

`receive_stage3.py` imports the actual owning
`motion_fx_contract.validate_frozen_binding` and
`motion_source_binding.validate_chain`. It requires a complete source root at
base51220b8 plus the exact ten-file frozenV2 overlay; the overlay folder alone
is not a source root. Receipt SHA `b87e65c1...`, body `acda010d...`, ticks
`d493b00f...`, full454-file source fingerprint `2b7fdde0...` stay fixed. These
guards validate source, canonical private blend, genuine provisional body
evidence, packet, evaluated driver, chronological geometry, callback epoch and
all312 cloth off/on raw sets. No copy of the later live Stage3 worktree is used.
The receipt's base commit is expressly not the overlay's executed source commit.

CLI input roots are explicit and D-backed. Native artifacts/raw/geometry must
stay in `nativeRoot`; binding equals the external original binding path. Post
input remains below `postRoot`. Before unchanged Stage3 `validate_chain` reads or
hashes raw passes, the receiver resolves each child named by actual `C.S.RAW_FILES`
for every raw record, requires containment in nativeRoot and an ordinary existing
file. Bounding only the raw directory does not bound a linked child. New normalized output and atlas output must be
fresh, separate from every consumed root and outside public directories.
Preflight contracts, missing inventories, wrong pins/body/packet/source/frame,
changed raw or finished inputs, control clocks and unsupported normals fail.
The normalizer creates no output before every intake/frame check passes.

The caller must provide externally recorded SHA256 pins for native batch, body,
ticks, source fingerprint, frozen source receipt, completed `preview-proof.json`,
actual finish digest, and the **entire completed post tree**. The post proof does
not bind every individual finished identity JSON, so the tree pin is required.
It is a digest argument, not a new producer manifest or a qualification receipt.
Delivery records it after producing the real post output. Do not calculate an
expected pin inside intake from mutable inputs and then call that external proof.

Tree digest algorithm: walk regular post directories without following links;
reject symlinks, Windows junctions and all reparse entries before descent or file
read/hash. Every enumerated resolved path must remain inside postRoot. Then
sort paths, create `[relative_posix_path, sha256(file_bytes)]` rows, serialize
with Python `json.dumps(rows, separators=(',', ':'), ensure_ascii=False)` and
SHA256 its UTF-8 bytes. `tree_digest(root)` is exposed for the **delivery receipt
step**; successful equality only establishes bytes, not art or physical truth.
The finish pin is the owning post's `native-identity.json.finishSha256`, separately
recorded by delivery; all provided actor/control frame identities must agree.

## Command

Run source/PNG checks through existing packet `resource-gate.ps1`, owner
`rosace-stage3-receiver-build`, normal max3/throttle1. Use Node24 and Python with
Pillow. Once a genuine completed batch/post is delivered, the review wrapper is:

```powershell
node art/rosace/specialists/motion/export/receive_stage3/export_review.mjs --source-root <complete-frozenV2-source> --native-root <private-native-artifacts-root> --post-root <completed-private-post-root> --batch <actual-native-batch.json> --batch-sha256 <delivery-recorded-batchSHA> --body-binding <original-frozen-body.json> --body-binding-sha256 acda010d715e91d7f736aa40fdae729547a4212f7c5e47202de134fd0914f97f --ticks-sha256 d493b00f613ded9df54dce2fc6966a7dab97730edeb6077145e1984dd7868e5d --source-fingerprint-sha256 2b7fdde09abd29e2de13a39154655f702f0f8d9aadcb16628e8856e05dddfc91 --source-receipt <frozen-first-slice-source-receipt.json> --source-receipt-sha256 b87e65c107eab81b3b429e8599e804e4f575ed0ba57b49f8909361622da37228 --post-proof-sha256 <delivery-recorded-postProofSHA> --post-tree-sha256 <delivery-recorded-complete-postTreeSHA> --finish-sha256 <delivery-recorded-actualFinishSHA> --out <fresh-private-normalized.json> --output-root <fresh-private-review-packages> --python python
```

Angle-bracket values are required handoff placeholders, not existing outputs or
valid hashes. No currently runnable completed-input command is claimed. The
Python command accepts the same arguments except output-root/python if only a
normalized input is wanted. There is no release, test, partial-intake or bypass
mode. The JS wrapper invokes file/CPU Python normalization then unchanged9da
`export_frames.mjs` with mode **review**. It does not execute Stage3 post/native.

## Frame and movement contract

The exported clip is explicitly `review_n1_n2_cloth_chain_slice`:77 simulation
rows at60Hz, frames1..77, duration1 each, cloth-on `noFX.png`, both80/144, baked
shading. Frame0 remains a source origin diagnostic. The early chain is not
complete canonical N1 or N2, idle or the full kit. It supplies no Player clip
coverage, hitboxes, events, contact holds, branch FX or generated fallback.
Diagnostic APNG hitstop expansion is checked against actual Stage3 playback
clock but is not baked into actor frame duration. Stable pose keys include the
frozen body/packet and simulationFrame plus clip/actor tick/recipe; cloth redraws
at a repeated actor pose remain distinct rows and paired across heights.

Every consumed cloth-on and cloth-off finished identity must match the original
batch identity/body/scene/driver/geometry epoch, five raw-input hashes, actual
finish pin and unchanged PNG bytes. Finished actor PNG must be single-frame RGBA
at the native canvas; mask/control grids must match. Both complete post preview
inventories and six route/control clocks are checked. Native batches and post
receipts remain evidence inputs, not `dex.authored-qualification/1` acceptance.

Raw anchors are supersampled. Actual per-frame pivot is
`meta.anchors.root.xy / meta.ss`, an actor Root origin. This removes baked root
travel from sprite placement through pivot alone. PNGs are never shifted,
resized or resampled. Other explicit anchors become `anchor.xy/ss - pivot`.
The fixed `meta.anchor` world origin is not substituted for actor pivot. Existing
9da trim correction then preserves the native pivot in the packed atlas.

Review rootMotion uses the actual camera basis:

```text
dH = packet.rootForwardH[f] - packet.rootForwardH[f-1]
worldDelta = sequence.rootForward * dH * meta.height_m
rootMotion = meta.ppm * [dot(worldDelta, cam.right), -dot(worldDelta, cam.up)]
```

Per-frame observed projected Root increments must match within0.01 native pixel,
the explicit float32 camera-projection tolerance; paired expected H-space deltas
must match within1e-6. Height×ppm must equal native height and the actual camera
basis must be finite/orthonormal. Current source camera60/8 and fixed corridors
are checked. A discrepancy rejects intake; no root/packet rewrite hides it.

This camera projection can have nonzero Y. It is **quarantined from release and
World**: blindly applying it alongside World gravity could be wrong. Stage3 and
World must adjudicate canonical movement axes and once-only travel in actual
playback. This receiver changes no runtime/gravity/axis policy. Final-grid
normals are omitted; raw ss4 normal maps cannot describe finished ink/alpha.

Review packages contain `review-manifest.json`, body atlas and provenance for
H80 `character` and H144 `character-closeup`. They contain no discoverable
`manifest.json`, carry unqualified status and fail release requirements. Private
raw models/actions/blends/human references never enter these atlases.

## Proof limits and next handoff

The bounded proof checks actual frozenV2 source/body/tick validation, actual
preflight request rejection, and admission/identity/clock/matrix negative cases.
Historical real N1 metadata/PNGs exercise the projected Root pivot utility through
unchanged9da review packing; packed body PNG hashes remain exact. Synthetic
77-frame camera trajectories test math/H correspondence only; no synthetic full
batch, post proof, finished-image or release success is presented.

Full intake/frame checks have no positive native test yet. Next required input is
Stage3's separately authorized complete native batch and finished cloth-on/noFX
post, with external delivery pins and real moving review. Then run this command,
inspect actual paired atlas/pivots/roots/timing and hand any mismatches back to the
owning source. Accepted Stage2 rebind, full kit/sit, physical cloth/FX transitions,
runtime axis/playback, release qualification and exact rollback remain required.
545 is appearance-rejected mechanical input, never current accepted Rosace.
