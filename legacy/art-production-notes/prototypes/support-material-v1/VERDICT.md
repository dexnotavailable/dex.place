# Support monument material comparison

Recommendation: **tone4-muted** is the better current candidate. This is a private request-override comparison only; no public source, runtime scene, posters or game code changed.

## Exact change for root to review

- Asset `M10.url`: `/world/assets/depth-library-v1/M10-tone4-v1.png`
- Placement `support.far-rib`: preserve `alpha: 0.66`, `tint: 9544878` (`#91a4ae`), position `(12400,180)`, native display size `1100×729`, depth `-83`, scroll factor `0.98` and all room/window composition.
- Textured source SHA256: `9bbf195690cde7e5465870d957f063a579deeb2c2538d2ac4b49978e941504b5`
- Baseline silhouette SHA256: `0aff614e894ac60198838de3093b5afd9faa16420f13272dcb3bf50eff32a659`
- Frozen source scene SHA256: `07ebc749d279ab26346585900c8fb51476144bf35a520c5dc9cc057348a5bdc4`

## Actual pixel review

Captured six raw rendered-canvas frames at desktop 1920×1080 and portrait 1000×1400, through real navigation to Donate and closing the panel. `receipt.json` retains source hashes, settings and actual player/camera snapshots. No state injection, screenshot retouching, source pixel edits or generated image used. Browser was isolated headless Brave; no shared visible browser or Suno controls touched.

The baseline giant arch is an undifferentiated medium-grey shape against a lightly textured room and floor. It reads like an unfinished silhouette placeholder. Tone4 restores long eroded ribs and broken stone subdivisions. The eye can travel along those striations without extra props; the enormous object gains a material and scale cue. Its low-contrast blue-grey still sits behind the darker room uprights and small bright terminal/hero.

The arch's opening remains empty and the water remains broad. Both textures use identical silhouette and alpha coverage, so no negative space was consumed. Hero, near prop pixels, UI, personal illustrations and window geometry are unchanged. The muted variant holds its shape better than the lighter `tone4-air` (`alpha .52`, tint `#b2c1c8`), which washes the damaged edges into the bright background and weakens its weight. In portrait, tone4-muted still reads as weathered mass framing a large empty opening rather than a texture wall. Its detail is finer than foreground pixels, appropriate to the distant scale.

Native dimensions are 1100×729 with one logical pixel pitch and nearest sampling. The desktop camera zoom is about 0.996; portrait about 1.484. Thus source grid projects to about 1 and 1.5 canvas pixels respectively. This change introduces no texture resampling or new scale ratio versus baseline. The four-color source limits high-frequency contrast. It contains shallow beveled/ribbed relief, but as distant scenery through the same window this does not impose a navigable 3D top face or break the side-on walking plane.

This only improves the Support landmark material. It does not certify the rest of the website, moving-camera full route, music, mobile touch behavior, or a final approved art library. The chosen source should be integrated and recaptured by root if this comparison matches the intended atmosphere.

## Files

- `baseline-desktop.png`, `baseline-portrait.png`
- `tone4-muted-desktop.png`, `tone4-muted-portrait.png` — recommended
- `tone4-air-desktop.png`, `tone4-air-portrait.png` — weaker weight, not selected
- `compare.mjs` — reproducible private request override
- each `*-scene.json` — private frozen scene variants
- `receipt.json` — live runtime snapshots and asset hashes
