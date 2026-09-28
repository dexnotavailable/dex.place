# Draft depth library

These11 roles join the separate M01–M09 export set to provide all20 middle/background roles as independent draft files. They are ready for root's actual layered shot review; no runtime or final scene acceptance is claimed.

Public-safe sidecars are `public/world/assets/depth-library-v1/middle-M01-M09.json` and `far-B01-B10-M10.json`. The far sidecar exposes a preferred URL/frame/size directly and retains alternate variants where needed. Original raw sources and earlier art remain preserved. Private per-asset recipes, hashes and QA live under `provenance/export-records`.

B01 sky1280×720 and B07 water1280×512 are opaque edge-to-edge fields. Their contrast is restrained and fine texture reduced. Repeat seams still need an actual composition check.

B02 haze1280×281, B08 reflection1280×120 and B10 cloud1280×192 preserve graded alpha. Contaminated near-zero-alpha pixels were cleared first, and RGB is zero where alpha is zero. Their alpha curves were uniformly reduced for atmospheric use, not hardened: baked alpha multipliers are0.48,0.60 and0.65 respectively. Begin scene opacity at1 to inspect the provided result before further fading.

B04 is actually an open far arch1200×540, not a filled shell. B05 colonnade1400×329, B06 skyline1400×241 and B09 cliff1280×448 retain their openings/gaps and use low-contrast blue-grey palettes. Their geometry is decorative and does not imply collision.

M10 curved rib1100×729 and B03 spire919×1700 retain their source shapes in two deliberate comparisons. The four-tone versions subdue color and grain but still reveal inherited depth/volume cues. The single-tone silhouettes remove internal perspective shading and are the preferred first strict2D composition candidates. Both variants have exactly the same cleaned alpha shape; B03's genuine side arch stays open while its painted central slit remains opaque. Original-source comparisons are private, not additional runtime assets.

Every candidate was visually inspected on dark/light underlays; native-resolution files and review boards are in `proof`. The two projection boards explicitly use420px-wide previews, with separate native proofs. Structured QA in `receipt.json` verifies alpha policy, clear RGB under transparency, dimensions and public/private hashes. A passing export does not prove the complete scene's composition, depth, animation, camera scaling or mobile quality.

`prepare_far.py` refuses changed bytes at an existing public image path. Further visual revisions should get a new export revision so an active runtime cannot silently change beneath root's composition tests.
