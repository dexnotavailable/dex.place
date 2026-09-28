# M01-M09 middle-depth export preparation

Nine independent native-grid drafts, prepared from the existing batch-E originals. This package owns only M01-M09. Source records, global inventory, game files and other layer exports are untouched.

## Recipe

Run `prepare_middle.py --ids M01 M02 M03`, then groups M04-M06 and M07-M09 with Python 3.13, Pillow 12.3.0 and NumPy 2.5.1. Sources resolve from canonical per-asset JSON and must match its SHA256 before processing. The private clean/native/proof directories and public PNGs are regenerated only for the requested group. Inspect both resulting review sheets before running `finalize_review.py`.

1. Threshold source alpha at 128. Clear hidden RGB at zero alpha. Preserve the connected structural assembly from its widest solid row; remove only detached opaque noise. No dark-color key, gap filling, generated replacement or shape redraw.
2. Crop to the real structural alpha bounds. Fix each role's intended width, except M04 whose 640px height is primary. Round the other dimension from the measured crop; no independent width/height stretching.
3. Resize once with premultiplied-RGBA BOX sampling. Threshold reduced structural alpha at 128. Each output pixel occupies one logical world pixel at world scale 1; nearest filtering and integer placement belong to runtime composition.
4. Compress weighted sRGB brightness from input 80-190 into target 122-174. Select the nearest of six shared muted blue-grey tones: `#687e84 #73888e #7e9398 #899da2 #94a7ab #a0b2b4`. No dithering; no hue artifacts survive the shared palette. Clear zero-alpha RGB again.
5. Record crop, dimensions, source/export hashes, mask policy, opening samples and native visual verdict. Derive enclosed transparent opening bounds without filling edge-connected arch/brace voids.

## Native visual QA

The six PNG review sheets show all nine actual-size exports against light and dark fields, beside unchanged authored CC0 hero pixels and the existing 23x96 terminal. The reviewer personally inspected each pair. Contours read flat, openings are clear, thin catwalk rails survive and the shared palette remains quieter than the foreground references.

The large raw preview halos on M06 were mainly hidden RGB beneath alpha zero. Direct alpha inspection and the clean light/dark exports confirm that no manual opening reconstruction was required. Saturated M08 edge contamination was below alpha 8 and is absent after structural extraction.

## Export sizes

| ID | Native size | Enclosed transparent intervals |
|---|---:|---:|
| M01 | 960x137 | 2 |
| M02 | 720x345 | 0 |
| M03 | 800x320 | 0; three arches connect to exterior |
| M04 | 213x640 | 1 |
| M05 | 1024x103 | 0; underside connects to exterior |
| M06 | 720x444 | 1 |
| M07 | 640x253 | 1 |
| M08 | 480x76 | 10; eight railing gaps and two bracket triangles |
| M09 | 640x275 | 0; inter-post spaces connect to exterior |

Public-safe metadata is `site/public/world/assets/depth-library-v1/middle-M01-M09.json`; each role has its own `Mxx-depth-v1.png`. Detailed private records are `provenance/export-records/Mxx-depth-v1.json`, with this folder's `receipt.json` as the compact handoff.

## Remaining acceptance

These are draft assets ready for root scene composition, not accepted or integrated world pieces. Actual placement, overlap, parallax, camera scale, mobile presentation and gameplay readability still need scene review. The exports imply no traversal or collision. Public metadata retains `runtimeAccepted: false` for every role.
