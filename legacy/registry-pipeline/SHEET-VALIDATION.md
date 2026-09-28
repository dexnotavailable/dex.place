# Sheet review utility

`validate_sheets.py` measures source PNG sheets, extracts pixel-preserving crops, and creates native-size contact sheets on light and dark backgrounds. Optional GIFs provide playback for visual review. It never publishes runtime assets or edits the input.

Requires Python, Pillow and NumPy; the existing local Python has Pillow12.3.0 and NumPy2.5.1. No package installation is needed.

## Run

PowerShell example for a soft-alpha cloud sheet, with row-major frame order:

```powershell
python D:\Dex\Projects\dex-place-art-production\registry-game-20260913\validate_sheets.py `
  --input D:\Dex\Projects\dex-place-art-production\registry-game-20260913\sources\cloud-loop.png `
  --output D:\Dex\Projects\dex-place-art-production\registry-game-20260913\reviews\cloud-loop-01 `
  --frame-width 256 --frame-height 128 --frames 8 --columns 4 `
  --pivot 128,64 --alpha-mode soft --frame-ms 250 --gif
```

The source path above is illustrative; it does not claim a cloud asset exists. `--output` must be a **new** directory below the utility's own production directory. Existing directories, the production root itself, traversal outside it and resolved symlinks/junctions outside it are rejected before writes. Choose a fresh suffix for another run. The utility never deletes anything.

Use `--alpha-mode hard` for declared binary-alpha props, `soft` for clouds/light emission with partial transparency, or `opaque` for whole background plates. Hard mode reports partial alpha as an error; it does not repair it. Provide `--durations-ms 80,80,120,160` instead of `--frame-ms` for individual frame timing. The duration count must match `--frames`. `--once` makes a non-repeating preview for an action clip. `--count` aliases `--frames`.

Cells include their transparent margins. Declare one fixed cell-space pivot; default is bottom centre. A pivot may sit on the bottom/right cell boundary. Preserve the same pivot/scale across related clips. If a source needs different pivots, measure those explicitly in separate runs and record the difference in the runtime manifest.

## Evidence produced

- `report.json`: source SHA256/mode/dimensions, grid geometry, durations, decoded RGBA bytes, crop coordinates, fixed pivot, per-frame alpha bounds at >0 and >=128, alpha counts, hidden RGB counts, edge contacts, centroids, and visible consecutive/end-to-start changes.
- `frames/frame-000.png` etc.: exact cropped source pixels, with decoded RGBA equality checked after saving. PNG compressed bytes are naturally different from the source file. No thresholding, matte, resizing or palette change is applied to these crops.
- `contact-dark-01.png` and `contact-light-01.png` etc.: 1:1 frame pixels on contrasting mattes; labels and pivot marks outside the frame. Large sets paginate. Cells too large for a4096px preview page keep their frame crops without automatic shrinking.
- Optional `playback-dark.gif` and `playback-light.gif`: native-size review playback with alpha composited onto the two mattes. **GIF colour/timing are lossy** and identical frames may be merged by the encoder. JSON records centisecond-rounded preview timing; original timing stays intact. Large decoded sequences skip GIF rather than silently scaling down.

Frames must fit an exactly divisible grid, be nonempty, and have valid duration counts. Extra cells after the declared frame count must be fully transparent; unaccounted opaque cells are an error. Exit0 means measurements were produced without structural errors; exit1 means invalid sheet evidence was saved; exit2 means invocation/input/output path was rejected before creating output.

## Required actual review

A transparent corner does not prove a clean cutout. The utility flags simple opaque two-colour checker patterns in corners, but this is deliberately only a heuristic. Painted checkers elsewhere, fringes and low-contrast contamination still require inspection against both mattes. Partial cloud alpha and nonzero RGB below zero alpha are preserved and measured, not automatically stripped.

Inspect fixed architecture/limbs/foot contact for jitter, object identity, silhouette, material/pixel consistency, motion cadence and the final-to-first transition. Edge contact can be intentional for tiling cloud bands; large centroid movement can be intentional animation. Measurements cannot approve either. Compare in-engine composition against the accepted complete room after layering. Combat events must match actual visible contact frames, independently of a nominal clip duration.

Retain source hash, frame/crop bounds, pivot, source-to-world scale, depth, room and shared-landmark identity in the production inventory. Pack reviewed frame PNGs into runtime sheets only after acceptance. This utility deliberately does not repaint a rejected source into something that merely passes alpha checks.

## Utility selfcheck

The isolated synthetic fixture under `reviews/tool-selfcheck-20260913-01` exercises partial alpha and RGB under zero alpha, pixel-preserving crop round trips, explicit GIF timing rounding, invalid hard alpha, unaccounted frame content, checker warnings and refusal to overwrite/escape the output owner. `selfcheck.json` records those outcomes. These prove the utility's relevant mechanics, not the acceptance of any generated animation.
