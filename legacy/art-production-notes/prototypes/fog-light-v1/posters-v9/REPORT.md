# Loading/Browse poster refresh v9

2026-09-07. The actual local renderer supplied all ten plates after the generated FG01/P21/native hardware, platform, fog/light, pit backdrop, camera, movement and gallery-annotation changes stabilized.

Both `public/world/preview/manifest.json` and `src/worldsite/content/world-preview.json` now select `v9-generated-materials-fog-light` and are byte-identical. All ten selected WebPs are new v9 files. The previous manifests and every v8 image are preserved.

## Exact export

- Five wide plates: viewport3440×1440, raw canvas3440×1376.
- Five portrait plates: viewport1000×1400, raw canvas1000×1336.
- Existing lossless WebP method6 pipeline; no resizing, lossy encoding, painting, retouching or added compositing in runtime images.
- All ten decoded WebP pixel buffers exactly match their source PNGs.
- Total selected bytes:4,408,718. Largest single file: home-wide-v9.webp at980,552 bytes. Further cold-transfer optimization remains a separate task.
- All ten selected HTTP URLs return image/webp and the expected SHA256. TypeScript passes.

Camera bounds remain400–13900. The home signal is derived from the actual map Home object and P04 origin/lens metadata: x1560,y861,width3,height3. Each entry stores the actual player anchor and inverse-camera world rectangle.

## Stability and artwork boundary

The updated capture tool hashes all game modules, including lighting.ts and platforms.ts, plus shell/camera/annotation inputs:28 source inputs in this capture and60 actual world/hero asset files. It checks hashes before every frame and at completion, and rejects runtime/HMR errors. The export checks again before touching selected files/manifests. This run had no changed hashes, HMR event or browser error.

DOM-only annotation/preview inputs are separately named in the receipt: they were hashed to establish capture-session stability and exclusion behavior, not baked into the plates. The generated world-preview.json output is deliberately excluded from the input guard to avoid a self-referential hash cycle.

Both gallery raw plates visibly contain neutral apertures. Separate private DOM screenshots show the actual personal artwork display: two loaded thumbnail images in the wide view and one in portrait. Instrumented canvas drawing/texture-upload routes recorded zero personal-art image uploads. Only the raw world canvas at a rendered RAF boundary supplies exported pixels; the DOM screenshots are evidence and are never export inputs.

## Hashes and proofs

- Map: `855827457de1bed23d3d540fd4d99deb13a13ef03b0d7070f17385c43aa15bb2`
- Scene: `6add0758365076fc60bc0b67969e07f8e6df2b0eb8939af15b3bb656fcc3ede8`
- Renderer input digest: `ff4f70ade7cb7175b829f8a2e3248d0baadabc4c80389704ac91394efbf4165d`
- Manifest: `a633c5a9916ae12b0664c3545a1c85b37a690497b6f77738497d2a06e584f0a3`
- Raw capture receipt and ten PNGs: `source/exports/world-posters-20260907-v9/receipt.json`.
- `verification-v9.json`: lossless pixels, dimensions, bytes, hashes, v8 preservation.
- `http-verification-v9.json`: current served representation checks.
- `v9-all-frames.png`: private inspection board; all ten plates were visually inspected.

The private inventory poster pointer and chapter19 now reference v9 without changing51-library/36-raster/15-reserve counts. No public documentation export, production build, deployment, audio change or account action occurred in this lane. These images synchronize loading/Browse appearance; they do not establish overall artistic acceptance or public availability.
