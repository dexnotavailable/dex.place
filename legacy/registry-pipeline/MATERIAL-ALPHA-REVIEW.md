# Material alpha review

Reviewed all12 structure PNGs, using `arrival-structure-alpha-v3.png` and the other rooms' `*-structure-alpha-v1.png`. Also reviewed the actual six-frame `cloud-mid-alpha-v3`, `cloud-far-alpha-v1` and `lamp-emission-v1` sheets. Evidence lives in `reviews/material-alpha-01/`.

**Two extraction corrections remain before calling the structure set clean:** visible magenta edging in rest, and unintended partial transparency within opaque structure/floor material. The cloud sheets have no visible keyed background problem in this review. Lamp's black background is correct for additive blending.

## Specific corrections

| Priority | Material / coordinates in1672×941 source | Evidence and action |
|---|---|---|
| High | Rest v1: top vines, right edge of left vine curtain, window beam and railing | Conspicuous magenta outlines on both dark/light composites.4537 visible pixels meet a magenta-dominance flag; the visible outlines independently confirm this is spill. Correct the extraction/despill around those contours while preserving leaf/rail silhouettes. |
| High | Low-passage v1: floor beneath left doorway, ROI[148,648,270,671] |2554of2806 pixels are partially transparent, alpha minimum128. The floor visibly acquires pale/pink patches against the review matte. The six-row contact strip at y663 includes alpha49 elsewhere. Restore floor opacity using an interior mask; no sky should move through the walking slab. |
| Medium | Arrival v3: right pillar ROI[1540,540,1588,730] |2840of9120 pixels have partial alpha, minimum165. The pillar's purple material becomes mottled differently on dark/light mattes. Preserve the intended stone colour and opaque interior. This is separate from the already-corrected mid-cloud transparency method. |
| Medium | Registry v1: top-left lintel ROI[115,35,365,67], floor[100,680,1500,735] |645of8000 lintel pixels and2782of77000 floor pixels have partial alpha; minima169and141. The patchy lintel is visible in the detail composite. Review and restore opacity of material inside solid silhouettes. |
| Targeted follow-up | Junction, pool and exhibit floor contact strips |Partial material alpha remains in their sampled walking strips:428,150and75 pixels respectively. No fully transparent breaks were found. Treat these as the same interior-mask concern when correcting the keyed structure set, rather than separate room redesigns. |

Do not globally threshold every image. Clouds intentionally retain soft alpha, foliage has meaningful edge coverage, and aperture cutouts must remain open. A robust correction separates expected solid interior from keyed exterior/aperture regions, with edge-specific spill treatment. Root owns any correction; this review changed no source images.

## What survived decomposition

- No recognisable residual traveller, accountant, boss, sword, static body shadow or body reflection was found in the inspected structure composites. The floors are reconstructed under their former positions.
- Benches, service lecterns, loose lamps, exhibit frames, courtyard tree and bridge deck have been removed from the appropriate base plates for independent placement. Their absence here is intentional.
- Sky, distant structure, cloud and water apertures are intentional transparency, including the sky-walk gap. They are not reported as missing artwork.
- Door apertures are prepared for independent frames/leaves/portal views. Junction's central column and two stair flights remain structurally continuous; their collision/occlusion behavior remains a runtime concern.
- Every sampled six-pixel-high walking strip had zero fully transparent pixels across its intended solid spans. This is a narrow continuity check, not collision approval. Sky-walk correctly excludes the designed gap.
- Vestibule, arena, archive, sky-walk and courtyard had no obvious colour spill, ghost actor or floor-hole failure in this visual pass. Their layered assembly still requires in-engine inspection.

Junction's upper-left region has become an open view where the original room study showed more interior wall. That is a deliberate-looking structural variation rather than alpha debris; reconcile the intended route/occlusion with the room author before relying on that view.

## Animated sheets

All three sources are1536×1024, a3×2 grid of512×512 cells, exactly six nonempty frames. Crop pixels round-trip unchanged; durations/counts/grid checks pass. No checker pattern flags or green-dominant visible pixels were found in the cloud frames. Dark/light contact sheets were inspected for all six frames.

**Mid clouds v3:** clean cloud silhouettes, pastel shading retained and no visible green plate or magenta checker contamination. Partial alpha is limited to approximately0.42–0.50% of each cell. The end-to-start visible delta is within the range of other frame changes. No new extraction defect identified; final timing remains the actual runtime playback's responsibility.

**Far clouds v1:** thin coherent cloud band with small wisps. Approximately0.84–0.87% partial alpha. The final-to-first change is not a structural outlier. The transparent margin is substantial and intentional; place by the measured bounds/pivot rather than stretching the cell to resemble the visible band.

**Lamp emission v1:** RGB with opaque black outside the glow, intentionally tested as an additive sheet. `lamp-additive-mattes.png` shows frame0 added over dark and light surfaces: black contributes nothing. Do not interpret its alpha255 corners as a failed cutout, and do not use ordinary source-over rendering that would expose a black square. Bright-centre clipping on a bright matte is expected additive behavior to tune in the scene.

The GIF files are review aids at1300ms per cloud frame and1100ms per lamp frame. These are inspection timings, not new acceptance rules; no claim of browser playback was made by this audit. The root's existing GPU check of current mid-cloud method remains separate evidence.

## Evidence

- `measurements.json`: source hashes, dimensions, alpha/spill measurements and full dark/light composite paths.
- `overview-dark.png`: scaled overview only; original-size room composites accompany it.
- `roi-measurements.json` and `*-detail.png`: native dark/light comparisons of the identified regions.
- `floor-strip-check.json`: narrow intended-solid contact strip checks.
- `cloud-mid/`, `cloud-far/`, `lamp-emission/`: full validator reports, pixel-preserving frame crops, contacts and GIFs.
- `sheet-summary.json`: per-frame bounds/alpha/visible-delta measurements.

The source hashes identify exactly what was reviewed. A corrected version needs only its affected composite/ROI check and the relevant integrated scene, not another indiscriminate full production audit.
