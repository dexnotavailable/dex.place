# Rosace next PC check — 2026-09-30

The target is still reference parity 9. Promoted drive-9 round 2 (5.78) stays the
canonical character. `NEXT-RUN.md` and `next-run-workflow.js` are the recovered
cloud proposal, not an executed run; their 6.5–7 estimate is not an accepted bar.

## Current bounded change

The collar-only experiment was **rejected**: both the independent blind critic
and coordinator preferred the preserved R2 collar. The sampled colors were
misattributed after cleanup/AA (I3 became gold, G3 blue, G1 lavender); the
self-membership color check did not catch this. Its code and actual images are
retained privately in `collar-2/source-rejected/` and the experiment directories,
but the adapter and its public command-line switch were removed. This rejected
glyph is not being redone or shipped.

`tools/pixel-pipeline/next/nx_post.py` now only replays the unchanged R2 finish
in private copies of raw passes and compares it to a preserved reference tree.
The next candidate is `art/rosace/next/headtilt8_model.json`: **only idle head
tilt changes from 16 to 8 degrees**, inside DESIGN3.5's 5–10 range. Back already
uses 6 degrees and stays unchanged. Body pose, hands, bust, outfit, face stamps,
head scale1.10, Q/N1/back, mesh edits and finish remain exactly R2. This is an
unrendered source recipe; it is not a visual improvement claim.

## Observed source proof

Run directory (git-ignored):
`D:/Dex/Temp/dex-place-rosace-20260930/review/rosace/art/next/collar-2`.

- On existing R2 raw passes: all **16** control images reproduce at **0 changed
  pixels** (4 shots × 2 sizes × transparent/contact-shadow images).
- Collar trial: idle changes 25/20 px at 144/80; N1 changes 19/0; Q and back
  change 0/0. Hidden or rear-facing glyphs are skipped, rather than painted over
  the sleeve, hair or back.
- Visible idle stamp boxes are 7×7 at 144 and 5×6 at 80. Each changed pixel is
  inside the returned glyph mask; alpha/silhouette change is 0 for every shot.
- The trial's color self-membership check passed but did not validate material
  semantics; it is explicitly superseded by the rejected-adapter diagnosis.
- Canonical blend SHA256 remains
  `aef28c7f5cdddee6f18bd12c06d988b5436eeac24049ddf4f6ca37f654394373`;
  pre-drive9 backup remains
  `23545647f5edea16a1fa459d1b61d1e7b2a0c470df8c5b44d13b17f57cf642f5`.

This proves a finish-only replay. No fresh Blender render, native runtime,
motion, art promotion, integration or deployment has been claimed.

## Replay

Use a fresh `--out`; the tool refuses to overwrite a prior trial, overlap its
source directory, or continue after any control mismatch. It never writes the
input raw tree. Run through the shared source gate:

```powershell
& 'D:/Dex/Automation/reports/dex-suite-resumption-20260930/resource-gate.ps1' -Owner 'rosace-source' -ScriptBlock {
    Set-Location 'D:/Dex/Temp/dex-place-rosace-20260930'
    python tools/pixel-pipeline/next/nx_post.py --root 'D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2' --out 'D:/Dex/Temp/dex-place-rosace-20260930/review/rosace/art/next/control-replay'
    if ($LASTEXITCODE) { throw "finish-only replay failed: $LASTEXITCODE" }
}
```

`--reference <preserved-R2-raw-root>` compares a fresh delivery render with the
old R2 pixels. If omitted, the input root is also the reference. `proof.json` includes raw
input hashes, exact image differences, mask and silhouette checks. `blind/`
contains consistent A/B sheets at x1 and x3; the key is separate. These pair
sheets contain only our own character pixels; reference-bearing sheets stay in
the original ignored `review/` tree and are never committed.

## Delivery dependency

Only delivery may run Blender/GPU/native checks. A fresh read-only render from
the preserved canonical blend must reproduce the promoted R2 control before
this pass can be accepted on that render. Render into a new directory, use the
existing isolated Blender route and exclusive resource/GPU ownership, and keep
the canonical blend and every backup unchanged. Passes needed by this tool:
beauty/depth/id/light/noise/normal, meta, facepass, landmarks, plus the
unchanged R2 finished `R2/still.png` and `R2/still_ground.png` reference in each
shot/size directory. Do not change the default character chain for this trial.

The delivery render request is `art/rosace/next/headtilt8-request.json`. It asks
for a fresh R2 control first, 0 px comparison against the preserved rendered
reference, then only two idle candidate renders (144/80) using the new model
JSON. Candidate pixels require same-scale/native comparisons and blind
part/guard review before any acceptance. The original canonical blend is
opened read-only and no `--save-lane` is allowed. No main merge is needed to run
this request in the isolated lane worktree.

The recovered cloud proposal's full multi-agent workflow is not dispatched.
The resumption packet limits this owner to one implementation worker and one
bounded reviewer initially. A single review is candidate evidence, not the
cloud plan's 2-of-3 acceptance or the required whole-character promotion proof.

Next structural work is pose/head-tilt and hand staging, each separately under
delivery's render gate, followed by value, bodice construction, the remaining
lost details and attack faces. Full grand M1/M2/dash/Q/R motion follows accepted
character quality. No target reduction, gloves, new headpiece or official
Kuro/HoYo model parts are introduced here.
