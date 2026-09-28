# Structural key-boundary conversion

Tool: `D:\Dex\Projects\dex-place-art-production\registry-game-20260913\key_registry_layer.py`.

The helper removes a near-magenta, strongly magenta-dominant background. It permits soft alpha and standard key-colour unmixing only inside a3px band adjoining that mask. All other structure retains source RGB and alpha255 exactly. It never touches clouds, bundled helper code, original images or runtime/public assets.

## Exact reviewed commands

```powershell
python D:\Dex\Projects\dex-place-art-production\registry-game-20260913\key_registry_layer.py --input D:\Dex\Projects\dex-place-art-production\registry-game-20260913\layers\rest-structure-keyed-v1.png --output D:\Dex\Projects\dex-place-art-production\registry-game-20260913\reviews\key-boundary-01\rest-final --edge-band 3 --key-tolerance 32 --min-dominance 220 --protect-rect 0,695,1672,941 --measure-rect 180,200,420,650 --measure-rect 500,650,800,700

python D:\Dex\Projects\dex-place-art-production\registry-game-20260913\key_registry_layer.py --input D:\Dex\Projects\dex-place-art-production\registry-game-20260913\layers\low-passage-structure-keyed-v1.png --output D:\Dex\Projects\dex-place-art-production\registry-game-20260913\reviews\key-boundary-01\low-passage-final --edge-band 3 --key-tolerance 32 --min-dominance 220 --protect-rect 0,648,1672,941 --measure-rect 148,648,270,671 --measure-rect 400,400,1400,550
```

Those output directories now exist; choose fresh names for a repeat. Overwrite and output outside the production owner are refused. Green keys, cloud-named inputs and already-transparent sources are also refused.

Default nominated key is255,0,255. The32-channel tolerance and dominance220 are needed because the actual generated near-key areas are not exactly255,0,255: rest's sampled median is245,4,250 and low-passage's233,1,240. The high-dominance mask keeps legitimate purple stone/floor outside its background classification.

The helper estimates edge foreground from the nearest unchanged, low-magenta-dominance pixel within10px. It solves `C = alpha*F + (1-alpha)*K` against the observed background-key median, then reconstructs straight-alpha foreground RGB. It neither globally desaturates nor borrows polluted pink interior pixels as foreground samples. Both reviewed inputs found a clean neighbour for every candidate edge pixel.

**Protect rectangles are room-specific.** The reviewed rest/low-passage floors are solid. Do not copy those full-width bottom protections into sky-walk or other rooms with real openings below the floor: that would preserve the deliberately keyed void. Use only rectangles known to be opaque structure in the actual room.

## Results

| Result | Rest final | Low-passage final |
|---|---:|---:|
| True background pixels removed |578804|33627|
| Outside-band interior pixels verified unchanged and opaque |970668|1534929|
| Candidate edge pixels lacking clean sample |0|0|
| Visible magenta-dominance pixels remaining inside edge band |0|0|
| Visible magenta-dominance pixels remaining outside edge band |309|313|
| Source bytes unchanged |Yes|Yes|

The outputs were inspected on actual dark/light composites. Rest's continuous magenta beam/railing outlines are removed. Its remaining309 magenta-dominant pixels are painted pink areas *within foliage*, beyond the3px correction band. They were preserved under the required opaque-interior contract; they still need a targeted source retouch for clean final foliage. See `rest-final-edge-detail.png`.

Low-passage's previously damaged floor ROI[148,648,270,671] is now **entirely opaque, with source RGB byte-for-byte preserved**. Its pink tone is now visibly the reflection painted into the keyed source, rather than a hole. The same pink reflection appears under the right opening aroundx1498–1547/y649–671. Those reflections need targeted image retouch/replacement of the floor lighting; making them transparent is wrong. See `low-passage-final-edge-detail.png`.

Rest's wall ROI[180,200,420,650] and low-passage wall ROI[400,400,1400,550] also remain exactly unchanged and opaque. The second rest measurement ROI spans real railing/sky and is intentionally not all opaque; it is not a failed protected-interior check.

## Evidence and remaining boundary

- `rest-final/alpha.png`, `low-passage-final/alpha.png`: reviewed conversion candidates for root-owned integration after remaining source retouch.
- Each final directory contains source/tool/output SHA256, settings, opaque-interior invariants, ROI comparisons, actual background/edge masks, and full dark/light composites.
- `validation-summary.json` independently compares saved output pixels against the original outside masks and confirms unchanged source hashes.
- Earlier `rest/` and `low-passage/` outputs are an initial local trial. The final trial excludes painted pink interior from foreground-colour estimation and records the tool hash; prefer `*-final`.

This helper fixes extraction damage and narrow key fringes. It deliberately cannot erase unwanted colour painted into solid foreground without violating the preservation rule. Root handles those specific retouches and publication; these files were not copied to public assets.
