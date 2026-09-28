# Generated continuous platform surface

2026-09-07. This supersedes the earlier flat procedural face in REPORT.md after Dex identified that surface as visually out of place. Placement/continuity geometry remains useful; the visible material is now the new generated FG01 v4 raster.

## Source and seam choice

Root supplied the original1774×887 RGB image at `source/material-replacements-v1/FG01-continuous-material-raw-v4.png`. Its apparent white checker is baked RGB, not alpha. The selected opaque interior crop is x12,y314,width1750,height265. It excludes the checker above/below the strip and the visible outer boundary bars.

The existing authorized native export applies BOX reduction to480×72,48-color median cut and no dither. No pixels were painted, blended across an edge, copied to force matching boundaries, or silently made transparent. The raw source remains unchanged.

The first full-width crop failed repeat review: its dark outer end bars appeared every480px, with mean boundary difference6.65 RGB levels versus internal95th-percentile4.66. The interior crop's boundary difference is2.99 versus internal95th-percentile4.60. The three-repeat board shows no distinct end-cap seam in the selected variant. These measurements support the visual comparison; they do not claim mathematically identical opposite-edge pixels.

Selected runtime file: `/world/assets/FG01-continuous-v4.png`,480×72, SHA256 `05abc12f2b55967f6822909a6ae254407ffee9e73af1253a5f1028353214e873`.

## Integration and visible result

`platforms.ts` draws generated cap/fascia pixels at native1×, with tile phase anchored in world coordinates and crops exactly at each actual solid. Adjacent map records do not restart the texture or introduce a bracket. The first top row stays at collision y. Exposed gap ends and the three actual pier bearings remain separate assembly details; there is no periodic support train. Bridge/lift mechanisms and collision data are unchanged by this lane.

The material adds clearly visible grain and restrained cracks to the broad surface while retaining the clean continuous silhouette. It looks more consistent with the native terminal, piers and nearby props than the interim smooth fill. Dark backing below deep stairs remains simple structural coverage; it does not replace the exposed generated face.

Actual matched-camera comparisons:

- `before-material-v4-desktop-arrival.png` → `generated-material-v4-desktop-arrival.png`
- `before-material-v4-ultrawide-arrival.png` → `generated-material-v4-ultrawide-arrival.png`
- `before-material-v4-phone-arrival.png` → `generated-material-v4-phone-arrival.png`

All three captures completed with no browser errors. Their receipts preserve player/camera/source hashes; native canvas versions are also present. The ultrawide image includes the first staircase contour, now carrying the same generated material. These are local visual checks; final coordinated gameplay/room captures must follow the independent hardware changes. TypeScript passes.

## Inventory and other work

FG01 is again an active raster role with a new source/crop/runtime mapping. The v3 bracketed source and interim flat implementation remain history. FG10's full image is still reserved; its stair role uses FG01 v4 crops. The shared inventory update was sequenced with the separate P21 hardware lane, which owns the final combined51-library/36-configured-raster tally and its hardware review. No draft, crop variant or tile repeat is counted as another generated role.

The three-offender primitive-body audit is at `../fog-light-v1/placeholder-audit.md`; root received it before hardware generation. The new poster capture script has expanded dependency hashes, stability checks and a gallery-art canvas boundary trace, but v9 poster generation/promotion remains on hold. Neither public/src poster manifest nor any v9 WebP was written in this lane.

Reproducible export/integration/inventory scripts and exact raw/export hashes live beside the new material source. No public documentation export, release staging, payment, account action or audio change occurred here.
