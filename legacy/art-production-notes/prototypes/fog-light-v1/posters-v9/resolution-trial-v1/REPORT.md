# Compact loading/Browse plate trial

Recommend **1280×512 wide plus750×1002 portrait** for these background plates. The actual loading view, blurred Browse panel and brighter bare Browse homepage remain coherent. The hero/cape and signal-post silhouettes survive at3440 px screen width, with deliberately coarser background pixels.1600/1920 retain more fine detail but spend substantially more bytes for little visible benefit in these contexts.

| Home representation | Bytes | Compared with current |
| --- | ---: | ---: |
| Current wide3440 |980,552|—|
| Wide1280 |297,148|69.7% smaller|
| Wide1600 |421,910|57.0% smaller|
| Wide1920 |521,556|46.8% smaller|
| Current portrait1000 |299,570|—|
| Portrait750 |223,612|25.4% smaller|

The requested250 KB home-wide target is **not met** by the specified size trials. I recommend the297 KB result over forcing additional degradation. The ten-plate set with wide1280/portrait750 totals **1,732,554 bytes**, down60.7% from4,408,718. These are file measurements, not a newly measured LCP result; root should rerun the existing stress test after choosing/integrating a representation.

## Actual pixel checks

`capture.json` records16 isolated actual-browser comparisons across1440×900 desktop,3440×1440 wide and390×844 coarse phone. `capture-bare.json` adds the brighter Browse homepage check at ultrawide and phone sizes. Existing CSS, camera rectangles, anchors, signal position and image-rendering:pixelated were retained. Image screen rectangles and signal rectangles match their full-v9 baselines exactly. No browser errors occurred.

The capture substitutes only selected image response bytes inside the isolated browser. Loading holds the real map request; Browse uses the real preference and current UI. No source, perf server or selected v9 manifest was modified. The full v9 files and raw PNGs remain intact. No painting, new generation, palette changes, lossy encoding or personal artwork is involved: candidates use only NEAREST resize of the neutral v9 raw canvas followed by lossless WebP method6.

Useful comparisons:

- `loading-desktop-v9.png` → `loading-desktop-1280.png`
- `browse-home-ultrawide-v9.png` → `browse-home-ultrawide-1280.png`
- `browse-home-phone-v9.png` → `browse-home-phone-750.png`
- `home-wide-1280.webp` and `home-wide-1600.webp` expose the brighter source detail directly.

`exports.json` has exact file paths, hashes, dimensions and unchanged worldRect/anchor data for every candidate. Select wide rows with width1280 and portrait rows with width750. Integrate under new versioned URLs after root inspection; do not overwrite cached v9 images. Current production manifests were confirmed unchanged at the end of both browser runs.
