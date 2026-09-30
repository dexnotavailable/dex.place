# Installing an authored character in the World

The existing `dex.sprite/1` contract is reused. Publish a pair:

- `public/world/character/manifest.json`: 80px exploration package.
- `public/world/character-closeup/manifest.json`: 144px inspection/close-up package.

Each directory contains its own relative atlas PNGs. The build discovers these paths;
build again after adding manifests. Both missing, or both explicit stand-in manifests,
preserve the procedural preview. Once a real export is supplied, missing its counterpart
is an error. A declared export's HTTP, MIME, JSON or image failure is reported instead
of being presented as successfully loaded character art.

Both packages must pass the normal sprite contract and contain every `PLAYER_CLIPS`
entry plus all World-specific clips (currently `sit`). They need the same clip IDs,
loop/next values, frame counts, durations, holds and phases. Every frame needs the same
nonempty `pose` source key at both resolutions, allowing index alignment to be checked.
Packing order, atlas dimensions, frame rectangles and pivots may differ with resolution.
The source key records provenance; actual pose/image correctness still needs visual review.

Decoded albedo dimensions must equal the manifest and the optional decoded normal map
must match. Normals retain the existing contract's ink alpha. The loader checks decoded
sizes before GPU upload. The World uses duration plus hold for seated animation too.

Source checks: `node --test src/site/world-character.test.mjs`,
`node src/world/tools/character-assets-regressions.mjs`, then the normal test and
build commands. The second executes the actual loader and procedural bake with only
bundler imports and fetch/image/GPU boundaries adapted for a CPU fixture. These checks
prove rejection of malformed pairs and timing behavior; they do not prove art quality,
native image decoding, actual completed moves or physical cloth.

Release proof still requires actual `source: "pipeline"` at both resolutions, a clean
load, moving authored clips including sit, matching pivots/root motion/lighting in the
World, full cloth/effect/transition acceptance and the exact previous-package rollback.
No placeholder frame duplication or procedural fallback counts as an exported move.
