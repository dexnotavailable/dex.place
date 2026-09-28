# Gallery displays, anchored hints and double jump

Implemented in the shared worktree. No hosting, image generation, provider spending, commit or push. Environment/lighting/map edits belong to the other lanes; this lane did not alter their source.

## Gallery and hints

- Docs03/05/18 reconciled first. Existing bays01/02 now display Towaki/Kaizen using their existing registered thumbnails as DOM links, contained at native projected apertures with unchanged colors. The shared ID registry also owns E/Interact and the physical panel-active/return state.
- Display/image subtrees exist only for visible apertures while the ready world is in the physical Gallery and no loading, Browse, menu or content layer is active. No personal artwork is added to canvas textures, generated assets, world previews or posters.
- The current CC0 actor remains in front of the DOM display. WebKit ignored the original HTML-to-SVG mask reference; that approach was replaced with a direct even-odd CSS clip path. Its 45,442-byte source data comes from exact 0/255 alpha runs in the unchanged CC0 sheets. Native runs are cached after first use. No runtime image filter, canvas readback or Phaser framebuffer is used.
- Hints use the selected object's projected anchor, clamp their measured DOM size and retain normal text. They are separate from coarse-pointer action buttons and keyboard instructions. Projection changes rerender the small annotation component rather than the entire App.

`verification.json`: four final Chromium/Brave profiles (1920 desktop,3440 ultrawide,390 actual coarse-pointer context,reduced motion), correct display/viewer and E/touch identity, menu/Browse/Downloads unmounting, no arrival or other disallowed-stage illustration requests, no page/console errors. `cross-engine.json` proves Firefox/WebKit keyboard display activation and focus return; full and cropped occlusion images were visually inspected. This is emulation, not actual Samsung/iPad hardware acceptance. `desktop-illustrations.png` and `phone-illustrations.png` preserve the before state; `*-gallery-after.png` are the final comparison.

## Double jump

Docs02/06 now record the confirmed second press. Space or the existing touch Jump button allows one extra air impulse. Ground/coyote jump preserves it; a late walk-off consumes it. Third press and held autorepeat do not give an additional air jump. A real collision landing on ground, stairs, lift or settled bridge restores the allowance. Pause/focus changes clear held/buffered input but do not refill it. Jump cancels an active dash, preventing its upward impulse from being overwritten. The second jump adds a small local pixel mark; reduced motion retains a brief stationary mark only. No new sprite or audio source.

`jumps-verification.json`: seven cases cover ground/first-second-third input, held autorepeat, coarse-touch two presses, reduced mode, actual stair and lift surfaces, coyote and late walkoff. Ground uses normal starting position. Other surface cases relocate only the home anchor in private request-overridden copies of the original map, with unchanged controller and terrain; the source map hash is recorded. A favicon.ico404 was recorded as a separate non-game warning during those cases.

`bridge-double-jump.json`: after the other lane's new floor-level bridge geometry landed, a separate current-map case used E to cut the rope, waited for the bridge to settle, walked onto it, double-jumped, and landed on that same bridge with the allowance restored. Only the private initial home anchor was relocated; source map hash is recorded. This closes the changed-bridge case instead of claiming the earlier map covered it.

`pnpm exec tsc --noEmit` passes. The keyboard legend uses ASCII `Jump x2`, correcting the earlier invalid multiplication-character encoding. `source-hashes.json` records final lane source and unchanged thumbnail hashes; `hero-mask-provenance.json` records every CC0 source mask input. Final integrated whole-site QA and public release remain the root lane's work.
