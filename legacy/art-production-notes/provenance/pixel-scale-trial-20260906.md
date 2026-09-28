# Pixel-scale trial — 2026-09-06

Status: **pass for source cleanup and bounded scene comparison; partial for final world acceptance**.

The current pick is the detailed **v1 platform downsampled once to 480 × 64** on a 1 world pixel grid, combined with the simpler **v2 terminal cropped and nearest-normalized to 25 × 96**. The unchanged CC0 Martial Hero remains 52 visible world pixels tall. This combination looks more consistent than the two coarse v2 pieces together at the intended scene dimensions.

## What was actually compared

- A: coarse v2 platform and terminal. The generator used similarly sized source blocks for differently sized world objects. The platform consequently shows approximately 4.3 world pixel blocks, while the terminal is approximately 0.83 world pixels per block.
- B: detailed v1 platform, post-pixelated to a 1 world pixel grid, with the v2 terminal. Current pick.
- C: both detailed v1 sources on a 1 world pixel grid. Cohesive weathering, but the small terminal's red status point becomes less readable.
- D: both detailed v1 sources on a 2 world pixel grid. More coarse than the native hero; the terminal loses too much precision.

This uses existing detailed v1 raster sources as the bounded post-pixelation test. It is not proof that every newly generated high-definition object will produce good pixel art automatically. Source silhouette, palette, intended world size and detail hierarchy still matter.

## Files and reproduction

- Script: `D:\Dex\Projects\dex-place-art-production\source\trials\pixel-scale-20260906\build_trial.py`
- Exact source/crop/alpha/hash/size metadata: `D:\Dex\Projects\dex-place-art-production\source\trials\pixel-scale-20260906\trial-manifest.json`
- Actual-size comparison: `D:\Dex\Projects\dex-place-art-production\source\trials\pixel-scale-20260906\proof\comparison-actual-size.png`
- Alpha proof: `D:\Dex\Projects\dex-place-art-production\source\trials\pixel-scale-20260906\proof\alpha-proof.png`
- Isolated review page: `D:\Dex\Projects\dex-place-world\site\public\world\trials\pixel-scale-20260906\index.html`
- Suggested platform: `D:\Dex\Projects\dex-place-art-production\source\trials\pixel-scale-20260906\exports\platform-detailed-v1-pitch1.png`
- Suggested terminal: `D:\Dex\Projects\dex-place-art-production\source\trials\pixel-scale-20260906\exports\terminal-direct-v2.png`

All four original tool returns are preserved byte-for-byte under the trial's `raw` folder. Six derivative files are comparisons of **two inventory roles**, not six additional assets. The shared inventory was not mutated by this lane.

## Extraction

The v1 RGBA files contain a clean object core at alpha 251–253 and lower-alpha external effects. Thresholding at alpha 240 removes the terminal glow and exterior fragments; opaque RGB was not recolored during extraction. The crop boxes are platform `[56,223,2116,497]` and terminal `[330,92,694,1443]`.

Both v2 sources are RGB with baked checkerboards. Only boundary-connected pixels with minimum RGB 225 and channel spread at most 20 were removed; internal whites were preserved. The crop boxes are terminal `[230,90,649,1711]` and platform `[110,286,1665,632]`. Hostile magenta and light-cyan compositions were inspected: no checkerboard or exterior halo remains visible at the trial scales. Export alpha is binary 0/255.

## Browser proof

Headless installed Brave, Playwright CLI, viewport 1280 × 1024, device pixel ratio 1. The review page was served from the exact isolated public folder on a temporary loopback server. It loaded all assets, switched A/B approaches and 1×/0.75× camera scales, and exposed functioning camera-motion and hero-animation toggles. Screenshots were visually inspected. After the initial missing favicon was fixed, the final page reported **zero console errors and zero warnings**.

- Final 1× capture: `source/trials/pixel-scale-20260906/output/playwright/page-2026-09-06T08-41-04-481Z.png`
- Final 0.75× capture: `source/trials/pixel-scale-20260906/output/playwright/page-2026-09-06T08-41-04-972Z.png`
- Motion/animation toggles enabled, 0.75×: `source/trials/pixel-scale-20260906/output/playwright/page-2026-09-06T08-40-14-479Z.png`
- Coarse platform comparison at 0.75×: `source/trials/pixel-scale-20260906/output/playwright/page-2026-09-06T08-40-14-970Z.png`

The exact trial browser was closed and the temporary Python loopback server was stopped after capture. No visible user browser was controlled.

## Integration handoff

Use a common world grid and camera transform for hero, foreground and props. A bigger platform needs more authored pixels across its width; multiplying an existing coarse module cannot recover missing detail. Rebuild a derivative once from its preserved raw source if the intended world dimensions change. Use nearest filtering, and inspect the actual renderer on supported viewport/device combinations; fractional CSS scale can still produce uneven pixel cadence.

Runtime region composition, camera motion quality, device DPR, physical collision contacts, platform seam tiling and independently animated terminal states remain unverified. The review page and manifest contain internal production metadata and should remain outside the final public release bundle. No gameplay, React components, source documents, deployment or acceptance status were changed by this lane.
