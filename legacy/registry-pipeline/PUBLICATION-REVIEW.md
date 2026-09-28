# Registry art publication checkpoint

Current catalogue: `registry-art-c7a87b2dca86e1`,70 actual registered assets and12 room layer sets. All currently expected semantic keys are present. This is isolated local game publication to `site/public/world/registry`; the old public website, hosting, account services and game source were not edited by this lane.

Run `python D:\Dex\Projects\dex-place-art-production\registry-game-20260913\publish_art.py` after approved source manifests change. It reads actual dimensions/hashes, copies only existing assets, verifies grid metadata, exports unique room wall/floor crops and atomically replaces assets.json. Missing assets remain missing rather than acquiring procedural substitutes.

## Inputs and ordering

1. `processed-materials.json`:12 boundary-corrected structures and static prop/frame crops.
2. `structure-overrides.json` and `material-overrides.json`: reviewed local foliage-gap recovery, exact generated low-floor patches and corrected tree. Their original processed-base hashes must still match; a newly generated base cannot be silently hidden by a stale override.
3. `exports/export-manifest.json`: currently8 mechanical/static additions, including real door recess and service fluorescent fixtures/emission. Future semantic-ID records are merged on rerun.
4. `actor-materials.json`: five warden clips and the map banner, with their actual frame layout, timing, facing and native pivots.
5. `cloud-materials.json`: approved mid/far v5 unmix outputs; original opaque cloud interiors remain byte-preserved.

Wide pool water is1536×1024 with four1536×256frames at1800ms, rather than stretching a512px tile. Folio material retains the explicitly requested stable URL `/world/registry/art/folio-material-v1.png`; the rest use semantic/hash basenames. Old unreferenced files are retained for rollback; no deletion was performed.

## Placement and contact corrections

- Every room uses1672×941 source coordinates mapped to1600×900. Layer positions are relative to the reference camera. Arrival referenceLeft600 is applied once by the game renderer.
- Each wall/floor pair reassembles to the exact processed source pixels. Split positions follow the actual floor boundary, while controller contact follows the separately measured footline.
- Arrival adds two600logical empty continuations from contiguous627px native source crops. The lower continuation source starts690 and is placed at712, adding22nativepx to align the new≈729footline with≈751in the main view. Original pillars cover the joins; the slab's front profile still differs slightly beneath the walking plane and should be judged in traversal.
- Sky uses modest camera-relative overscan at approximately native aspect. The shared ring is attenuated to alpha.86 and its source right edge stays beyond each room viewport. Distinct far-cloud bands supply distant texture; mid clouds are no longer reused for every depth.
- Junction central column is an exact source cropx402–531 placed atdepth46. It occludes the traveller without changing collision.
- Courtyard tree is grounded by its actual root pivot atsourceY687, about6sourcepx behind the player's footline. Height450sourcepx preserves the crown's intended position and aspect. The bench remains in front.
- Service passage uses the delivered horizontal fluorescent pair atsourcecentres563/1185,Y380, width110logical, with independently animated additive emission. Ordinary wall fixtures are not substituted for them.
- Native props no longer use noise-polluted alpha bounds. `prepare_materials.py` derives substantial alpha128 row/column support, retains2px safety padding, preserves every pixel inside the crop and registers actual foot pivots. The terminal's meaningful soft edge remains inside this crop.
- Door frame aperture metadata is[115,97]..[585,958] in its701×992native crop, supplied under both `apertureTL/BR` and descriptive aliases. The runtime worker owns exact fit/leaf masking and minimum useful door dimensions.
- Exhibit frames use bottom-centre pivots to match the runtime's frame-bottom anchors. Actual illustrations remain separate display-only content; no image generation references personal art.

## Pink key-gap correction

Actual browser captures showed obvious magenta foliage despite solid-interior alpha passing. Reference/key/alpha crops established many of these as tiny sky gaps or leaf-edge mixtures whose colour never reached the near-pure-magenta threshold. They were not assumed to be intentional flowers.

`key_registry_layer.py --spill-roi` now supports an explicit, reviewed local exception: estimate/unmix high-magenta pixels inside selected foliage regions. The final room overrides replace only **previously visible strong-pink pixels** in those regions on the existing boundary-alpha base. Every other RGBA byte remains unchanged, including floor, stone and previously clean background/edge pixels. A candidate that accidentally reinstated protected background pixels was not published; only `*-foliage-final` files are referenced.

Major strong-pink counts fell from309to0 in rest,497to2 in registry,815to0 in junction,229to0 in archive,836to0 in pool, and1079to3 in exhibit. These are diagnostic results, not aesthetic approval. Actual crop comparisons on dark/warm/sky backdrops show the large magenta clusters removed while leaf form/material persists. Remaining isolated pixels and subtle edge colours still deserve the final native scene glance.

Low-passage floor colour was a separate painted reflection. Root generated a retouch; only rectangles[146,646,271,671] and[1495,645,1550,671] were copied into a derived keyed plate. Every original pixel outside those rectangles is unchanged. Native boundary composites show a quiet beige/grey left patch and subdued warm right reflection without an obvious cut seam. No full-room retouch replacement was used.

## Verification boundaries

`reviews/publication-01/publication-validation-final.json` records70 matching published hashes/dimensions,12 exact wall/floor source reconstructions, repeatable catalogue version, tree foot and column placement. `PUBLICATION-CHECKPOINT.json` retains source-manifest hashes and each published file's provenance.

I inspected the worker's actual browser rest/registry/junction captures at catalogue355, which exposed the foliage and door-fit issues. Offline reconstructions used exported real runtime room/prop data to inspect native prop contact and reveal source-edge clipping. Later corrected layers/floor patches were inspected as actual composite pixels. These are not claims of latest whole-route play, final animation taste, mobile performance or production deployment; root and the game worker own those checks.
