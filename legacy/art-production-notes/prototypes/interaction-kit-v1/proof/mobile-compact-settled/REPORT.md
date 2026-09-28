# Compact phone shell and touch check

Actual live5188 source after the final generated-index export. Frozen private `full-route-mechanisms.json` and `full-scene-candidate.json` were served only to two isolated Brave contexts. Playwright's Pixel7 mobile user agent, `hasTouch:true`, `isMobile:true` and deviceScaleFactor1 were used at320×740 and412×915. Touch input used actual tab/Close/Interact taps and Chromium touchStart/touchEnd on the real Move right control. No game state was injected and no source/public data was edited.

Both sizes pass all six bounded control/layout checks:

- Header exactly104px high; four tabs in one grid row, each48px high. All labels fit. At320px the Documentation label has about0.48px space on each side, so it is tight but unclipped.
- Downloads, Documentation, Illustrations and Donate open below the measured header and within the viewport once their existing entrance animation settles.
- All six touch controls are56×56px and remain inside the viewport. The upper action row and lower movement/action row keep their intended reserved footprint.
- Native touch movement reaches the new latch. Touch Interact opens the real banner to100%.
- Full banner is within the view at both sizes, with four44px links and an accessible Close.
- Touch Close rewinds, restores world focus and brings the touch controls back.

Full-open banner rectangles:

|Viewport|x|y|width|height|right margin|
|---|---:|---:|---:|---:|---:|
|320×740|55|305|246.1406|283.0625|18.8594|
|412×915|103|390|288.3438|331.5938|20.6562|

Zero page errors; all tracked source hashes remained unchanged. Exact bounds, four dialog records per viewport, control rectangles and hashes are in `results.json`.

## Narrow hint spacing: corrected

At320px, the original `320-touch-controls.png` showed the central Unfurl hint overlapping the upper-left corner of the Interact tile. Root raised the hint at widths below360px. One fresh native touch approach was then captured in `320-hint-fixed.png`: hint bottom590, controls top602, so the gap is12px. All buttons remain56×56px and no errors occurred. `320-hint-fixed.json` retains exact bounds and the corrected CSS hash. The image was visually inspected. This closes the spacing finding; the full route/dialog loop was not repeated.

Visually inspected: both banner screenshots, both touch-control screenshots and the320 Downloads dialog. The initial `../mobile-compact` attempt stopped on a dialog bound captured during the entrance transform; the veil already started correctly aty104. That early measurement is superseded by the settled bounds here and is not an unresolved fixed-layout defect.

This is local browser viewport/touch proof. Actual Samsung Internet and physical iPad remain unverified.
