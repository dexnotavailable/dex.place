# Focal bands 1 — same-clump hair hierarchy

This opt-in letter builds on the exact native-stage diagnostic in
`HAIR-CLUSTERS-1.md`. The earlier incidental fragment cleanup changes5/0
pixels and is neutral at144/80. This letter deliberately constructs shade
bands across the crown, face frame and mantle using their native part IDs.
It does not activate in the existing pipeline or runtime.

## Construction and preservation

`focal_bands.json` assigns each targeted native hair part one authored role:
crown, frame or mantle. Each role has fixed ordered OKLab lightness boundaries
for dark/form/lit shades and a population quantile within each occupied band
for choosing a representative. Crown selects toward the lighter middle,
frame near the middle, mantle toward the darker middle. This is a deliberate
hierarchy choice within the existing R2 forms, not a new global palette.

Representatives come only from the eligible original pixels of that exact
material+part. Missing shades remain missing, so small80px clumps may use
one or two bands. Projection stays within the pixel's original dark/form/lit
role; lit-area coverage must remain exact. Bounded perceptual outliers keep
their original RGB. No color is introduced, no material/color family migrates,
and source shading order remains ordered across the three roles.

The exact R2 replay captures semantic labels, all selected clump separators
(including visually unchanged selections), face/occlusion/outline keep and
actual rim changes. Original sheen core/halo and semantic skin-contact fringe
boundaries are protected and excluded from representative selection. This
letter uses native semantic face protection instead of the first letter's
blanket face box; it still changes no skin or face feature. Skin presence is
derived from any visible native skin subpixel, including mixed/partial cells,
then dilated by one cell for fringe contact. Fully covered, pure-material
cells are required. The first letter's generic neighbor halo is deliberately
replaced by exact native outline/rim/occlusion/separator and semantic-contact
protection; it is not a required mask in this distinct construction method.
Material AA cells, azure tips, gold,
white, clothing, glaive, geometry, pose and alpha stay exact.

The local synchronous wrappers restore both R2 functions in `finally` and
edit no shared source. Transparent and grounded controls must reproduce R2
at zero pixels. Native categorical disagreement is a failed qualification.

## Observed finite result

The first actual saved-R2 idle replay at144/80 produced94/10 changed hair pixels.
Hair connected components decreased274->226 and103->97. Original global
unique RGB counts stayed197/170; these counts do not prove craft. No changes
occurred outside the eligible scope or to alpha, native labels, the initial skin-contact mask,
sheen, keep, rim, nonhair materials or the authored lit footprint. Both raw
and original finished input hashes remained exact.

Actual1x whole/head views and nearest6x head views were inspected. The144
crown/frame looks subtly cleaner; the80 difference is small and has no
confident visual gain. No part score, reference parity, AAA claim or promotion
follows. Source review caught missing mixed-skin cells in that initial contact
mask; the corrected finite replay and dependency-config snapshot supersede
its contact-guard qualification. Corrected output changes72/3 hair pixels,
components274->237 and103->100, with all stated protection/control guards0
and unchanged global RGB counts. The mixed/partial native-skin fixture
exposes the original mask bug and passes after correction. The world80
change is now only three pixels; no material visual gain is claimed.
The packet PREVIEW exposes the corrected real candidate for independent
critic triage. Only materially new art merits the three fresh fixed9 critics;
the older0/0,4/0 and5/0 diagnostics remain preserved without empty waves.

## Invocation and handoff

Use the shared packet gate as `rosace-artistry-source` for CPU replay:

```powershell
python art/rosace/specialists/artistry/focal_bands.py `
  --root <preserved-R2-raw-root> `
  --out <executing-worktree>/review/rosace/artistry/<fresh-letter>
```

Proof records exact input/module/config/helper hashes, per-part bands and
population counts, topology, semantic/alpha scope and source provenance.
Whole/head144/80 views, raw/control/candidate/scope sheets and captured native
stage arrays are private outputs, never production assets or public references.
Raw nearest-sample images remain diagnostics only.

Rosace owns source integration and the required shared `PIPELINE.md` record.
Its consumer must qualify matched input/stage contracts and actual acceptance
before activating the optional function. The still finish is not established
for motion: the current motion exporter lacks these native inputs. Native
multi-view, moving cloth, collision/transition/playback and gameplay acceptance
belong to delivery. Frozen requests, R2 assets/maps and both exact rollback
manifests remain untouched. Rollback omits this letter and retains exact R2.
