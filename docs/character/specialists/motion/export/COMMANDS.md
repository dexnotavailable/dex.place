# Executed command route and handoff

Run from the isolated source checkout with Node24 and Python/Pillow. These
commands consume files only; they do not launch Blender, a browser, GPU/model or
new authoring runtime. Source/PNG checks use the shared resource gate. Native
qualification and public asset installation remain sole delivery operations.

The executed bounded proof command was:

```powershell
node art/rosace/specialists/motion/export/prove_export.mjs --source-root D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders --out D:/Dex/Automation/reports/dex-suite-resumption-20260930/lanes/rosace-motion/proofs/export-v1/run-2
```

It consumes existing native dressed N1 at80/144, excludes pre-roll0, validates
33actor ticks each, compares every packed crop RGBA and source pivot, runs the
actual ClipPlayer root/pose clock and replays the same Rosace material from a
clean alternate source root. It tests a real compatible f1 normal pair separately.
The proof records historical/unqualified material and no fresh native, mesh
cloth, actual moving playback or release-package acceptance.

The two production functions are exposed as separate executable commands.
Use a **fresh** input/output path; the proof run retained all attempted fixtures:

```powershell
node art/rosace/specialists/motion/export/from_motion_meta.mjs --config art/rosace/specialists/motion/export/rosace-review-import.json --source-root D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders --out D:/Dex/Temp/rosace-export-review/input.json
node art/rosace/specialists/motion/export/export_frames.mjs --input D:/Dex/Temp/rosace-export-review/input.json --source-root D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders --output-root D:/Dex/Temp/rosace-export-review/packages --mode review --python python
```

Those latter paths illustrate a new isolated invocation; the exact executed
versions are retained below corrected run-2; original run-1 and adverse failures
remain preserved. The generic exporter accepts a normalized
`dex.authored-frames/1` input without using the legacy motion adapter. This lets
future character renderers supply authored PNGs/pivots/timelines directly.
No bone retarget is performed during atlas export. Only the adapter's source
anchor-name mapping depends on a rig's metadata names; it is configurable.

Review output:

```text
packages/character/review-manifest.json       dex.sprite-review/1 envelope
packages/character/body.png                  genuine H80 packed pixels
packages/character/provenance.json           source/trim/tick hashes
packages/character-closeup/review-manifest.json
packages/character-closeup/body.png          genuine H144 packed pixels
packages/character-closeup/provenance.json
packages/export-result.json
```

Optional body_n.png uses the same crop/rectangle/dimensions as body.png. Only a
qualified release command writes manifest.json, and a release must provide both
native variants and all required clips. Pass `--mode release` only on accepted
normalized input with qualification evidence and expected frame hashes. There
is currently no complete qualified Rosace input. Importing old N1 cannot produce
a release package, even though its contained review package passes the generic
schema. Missing moves, real sitting and current mesh-cloth/kit acceptance stay
explicit dependencies; nothing falls back to idle or procedural stand-in frames.

After a reviewed qualified export, integrator/delivery place **both** package
directories under the isolated application's public/world tree before the
production build so the World glob discovers them. Use the goal owner's paired
World guards and sit hold timing fix, exact asset/source receipts, native playback
and World acceptance. Exporter QA cannot establish the finished character's art,
31part blind critic parity, physical fabric, full FX/transition kit or gameplay.
Rollback remains removal/revert of this namespace plus the existing exact
native/package asset rollback; this source task replaces no live asset.
