# Cloud matte correction

Recommended files are listed in `cloud-materials.json`. They are derived from the original green-keyed sheets, not from already-desaturated alpha outputs. No game, renderer, public catalogue or original source file was changed in this lane.

The actual arrival screenshot showed cyan rims and thin green-grey wisps against the peach sky. The source RGB images contain green mixed into cloud edges. The old alpha helper clips the green channel but leaves the red and blue channels attenuated by the original matte; an opaque or partly opaque cyan rim survives. This is present before the animation shader samples the sheets.

`unmix_cloud_matte.py` estimates the real green key from near-key background. It then fits the composite equation against nearby clean authored cloud colours and reconstructs straight foreground RGB/alpha. Colour-fit plus distance selects the estimate, avoiding borrowing a warm highlight merely because it is the closest sample to a blue edge. Processing stays in a three-pixel boundary, plus green-dominant key remnants within twelve pixels of that boundary. All remaining opaque interiors stay byte-identical with alpha255. The purple cloud shadows are preserved, with no palette wash or punched transparent holes. No Gaussian blur, resizing, handpainting or source mutation is involved.

The final pair is version5. Earlier candidates are review-only and should not be published. Version1 exposed unprocessed generated green noise, versions2/3 progressively resolved source matte remnants, and version4 changed colour selection; version5 additionally fixes three green pixels in far-cloud frame5. This is one bounded matte correction, not a series of regenerated clouds.

## Visual judgment

I inspected original and converted sheets, every final frame over a warm background, enlarged warm/dark edge crops, and a full CPU arrival composite using the actual public layer geometry and textures. The corrected upper cloud edge loses its thin green rim and better matches the peach sky. Far cloud banks lose the large green-grey contour. Thin blue/lavender wisps remain as authored foreground; trying to erase every blue pixel would damage that cloud design. The overall improvement is useful but deliberately subtle.

Evidence lives under `reviews/cloud-unmix-v5/`:

- `arrival-old-matte.png` and `arrival-unmixed.png`: actual asset/layer composition, without gameplay, player, UI or frame interpolation.
- `high-cloud-edge-arrival-comparison.png` and `far-cloud-wisps-arrival-comparison.png`: current versus corrected at the same room geometry.
- `cloud-far-all-frames-warm.png` and `cloud-mid-all-frames-warm.png`: all six frames.
- `report.json`: source/output hashes, boundary pixel counts and opaque-interior invariants.
- Per-cloud validation folders: alpha, sheet geometry, frame crops and playback media.

A browser frame using the published replacements remains the final runtime check. The static CPU comparison does not certify shader interpolation, visual motion or gameplay. Ring/structure edges were outside this change.
