# Free and open base bodies for Rosace (non-VRoid)

Researched 2026-09-29. Nothing was downloaded, bought, installed or generated. Sizes and prices
are what the source pages list. Tags: **[M]** measured, meaning I read it this session on the
source page itself, in the raw page HTML, or in the project's own repo data through the GitHub or
Sketchfab API; **[S]** sourced, meaning it comes from a search snippet or a secondary article; **[I]**
inference, meaning my own reasoning. This is not legal advice.

## The answer first

**Yes, there are free non-VRoid bases, but none of them is "gacha-grade out of the box".** No free
base I found ships Genshin / Wuthering Waves / ZZZ proportions. So the base's real job is good
topology, a usable skeleton and a clean licence. The proportions come from our own shaping pass,
using shape keys sculpted to measured targets, not from the base. VRoid's generic bust/hip ratio is
a symptom of the current restyle as much as of VRoid. `build_rosace.py` only scales and remaps
(`BUST_SCALE 1.45`, `PELVIS_SCALE 0.97`, a piecewise vertical remap, per `PIPELINE.md` 3.6), and
scaling can't make a new shape like hip flare, a waist pinch, a thigh taper or the underbust line
[I].

Ranked for our use:

1. **MB-Lab "Anime female" (F_AN01 / F_AN02). Best free fit, with one licence caveat.** It is the
   only free option I found with an anime-styled body and named sliders for breast mass, tone,
   push and height, waist size, gluteus and leg length. It also has a skinned skeleton that
   includes **breast bones**. Its models are AGPL-3, but its licence page says 2D renders are
   "not considered a derived product" [M], and our sprites are 2D renders. The catch: the project
   is archived (final 1.8.1, 2024-06-08) and targets Blender 4.0 [M]. Blender 5.1.2 compatibility is
   **untested** [I].
2. **David Onizaki's "Genshin Style Anime Female Base Mesh" (Sketchfab, CC BY 4.0).** Anime body
   with shape keys for "arms, legs, bust, hips, neck, shoulders, and face" [M]. It has no rig. It
   needs a provenance check before use, because it is tagged `genshin` [M] and we must be sure it
   isn't built on a ripped game mesh [I].
3. **Death Joe Productions "CC0 Character Base Mesh Pack" (Gumroad, $0+).** It contains a "busty
   anime body" and a "thicc anime body" [M], both CC0. The topology is dense and sculpt-grade, so
   use them as **shape targets** to project our rigged base onto, not as the rigged mesh [I].
4. **MPFB2 (MakeHuman for Blender, maintained, CC0 output).** It has the best tooling and licence
   hygiene, with realistic topology, breast / hip / waist / buttocks targets and a
   `game_engine_with_breast` rig [M]. The look is realistic, so it needs our anime shaping, and the
   head gets replaced [I].
5. **Blender Studio Human Base Meshes (CC0).** A clean "Stylized Female" sculpt base [M]. It is
   Western-stylised, not anime, and unrigged. Useful as a sculpt start, not as a direct answer
   [I].

Also checked and not recommended: hiamBoz's CC0 anime parts kit (promising but unverified;
details below), Quaternius Universal Base Characters (CC0 and rigged, but Western low-poly),
Blender Studio's Rain (CC-BY, cartoon), Kenney (CC0, blocky), CharMorph (realistic bodies), and
several Sketchfab / itch items with no licence or a non-CC licence.

**My recommendation [I]:** run one bounded spike. Build an MB-Lab anime female in a throwaway
Blender profile. Slide her toward Rosace's targets, finalize, rename the bones to `J_Bip_*`, and
drop her into the existing build. In parallel, test whether projecting onto one Death Joe CC0 body
gives a better bust/hip shape key than the sliders. If MB-Lab won't run on 5.1.2, run it once in a
separate Blender 4.2 LTS install, save the finalized `.blend`, and do everything else in 5.1.2.
Dex has to approve each download listed in section 5 first.

## 1. What "fits us" means

Taken from the repo, so each candidate is judged against the same bar:

- **Proportion targets** (`PIPELINE.md` 3.3, `DESIGN.md` 2): about 6 heads (6.46 measured after the
  r1 fix), crotch to sole 52% of H, shoulders / waist / hips 18 / 10 / 16 px at 96 px in
  three-quarter view ("a clear hourglass"). Shipped height is H = 144 px. Refs 04, 07, 08 and 09
  are 5.5-6.5 heads [M, repo].
- **Rig contract**: the build, posing, IK, `bake_keys` and the SOMA retarget all address
  `J_Bip_*` bone names. `tools/motion-ai/bone_map_vrm.json` maps 22 SOMA joints onto
  `J_Bip_C_Hips / Spine / Chest / UpperChest / Neck / Head`, plus L/R `Shoulder / UpperArm /
  LowerArm / Hand / UpperLeg / LowerLeg / Foot / ToeBase`. It assumes a **T-pose rest**, Z up,
  facing -Y [M, repo]. Fingers are not retargeted; the grip poses them. Hips height is scaled by
  leg length, so any leg ratio works [M, repo].
- **Output is 2D**: the shipped artefact is pixel sprites, never a 3D file. This matters for
  AGPL / CC-BY [I].
- **Blender**: pinned at 5.1.2 in an isolated profile, run with `--disable-autoexec`
  (`tools/pixel-pipeline/blender_env.py`) [M, repo].

## 2. Scorecard

The rows below rate each base on licence, cost, anime look, bust/hip controls, topology and how
well its skeleton fits our `J_Bip_*` rig. "Rig effort" means the work to reach our 22-bone T-pose
contract.

| Base | Licence (for our 2D use) | Cost / size | Anime look | Bust / waist / hip control | Topology for deformation | Rig effort |
|---|---|---|---|---|---|---|
| MB-Lab anime female | Code GPL-3, data and models AGPL-3, 2D renders exempt [M] | free; repo ~220 MB (GitHub API size) [M] | yes, "shojo style" [M] | named sliders [M] | animation topology, 13,995 verts [M] | rename ~14 bones plus twist bones; rest pose unverified [I] |
| Onizaki "Genshin Style" | CC BY 4.0, credit required [M] | free; size not shown [M] | yes [M] | shape keys: bust, hips, legs, arms, shoulders, neck, face [M] | unknown; 32,040 faces / 16,584 verts [M] | full rig from scratch (fit our skeleton) [I] |
| Death Joe CC0 pack | CC0 [M] | $0+ (suggested $2); size not listed [M] | yes, "busty" and "thicc" variants [M] | baked into the sculpt [M] | dense sculpt topology, retopo needed [M/I] | not a rig target; use as a projection target [I] |
| MPFB2 2.0.17 | code GPL-3; core assets and exports CC0 [M] | free; 42.9 MB extension [M] | no (realistic) [I] | many targets: breast, hip, waist, buttocks, torso [M] | good general-purpose [I] | UE-style 55-bone rig with breasts; rename; rest pose likely A [I] |
| Blender Studio HBM v1.4.1 | CC0 [M] | free; 50,643,039 B [M] | no (Western stylised) [I] | none; sculpt it [M] | clean quads, closed volume, sculpt-first [M] | full rig from scratch [I] |
| hiamBoz anime parts kit | CC0 [M] | $0+; 24 MB + 29 MB (+1.7 / 1.8 MB older files) [M] | tagged Anime [M] | unknown [I] | unknown [I] | unknown whether rigged [I] |
| Quaternius UBC | CC0 [M] | Standard 122 MB PWYW; Source 600 MB at $19.99 [M] | no [I] | 3 body types only [M] | game topology, ~13k tris [M] | UE-mannequin rig like our UAL clips [I]; rename |

## 3. Candidates in detail

### 3.1 MB-Lab: Anime female (F_AN01, F_AN02, F_AN03)

- **Source:** https://github.com/animate1978/MB-Lab (archived; last push 2024-07-21) [M]. The docs
  are at https://mb-lab-docs.readthedocs.io/ [M].
- **Licence, verified on https://mb-lab-docs.readthedocs.io/en/latest/license.html [M]:**
  - Code: "All files written in Python ... are released under GNU General Public License 3."
  - Data: every mesh, image and JSON "released under GNU Affero General Public License 3".
  - Generated models: "The default license for models generated by the software is AGPL 3".
  - 2D exception: "Rendered two-dimensional images or two-dimensional videos of a scene that
    includes 3D models generated with MB-Lab are not considered a derived product". The page
    goes on to say the author of the 2D rendering is its "sole copyright owner".
  - The exception is conditioned on "a non-reverse-engineering scene[*]". The footnote that
    defines that term is **not on the page** [M]. Our 144 px, cel-banded, outlined sprites can't
    realistically be used to rebuild the mesh, so I read them as covered [I]. Two risks: a
    high-res orthographic turnaround published on the site would be closer to the line, and so
    would any published `.blend` or VRM [I].
  - **What this means for us [I]:** keep the MB-Lab-derived `.blend` in the private art location
    (`dex-place-art`), never in the public repo, and never ship the 3D model. Sprites are then
    ours. If a 3D viewer ever goes on the site, this base would force that model to be AGPL.
- **Versions and Blender support:** final release 1.8.1, 2024-06-08. The release notes call it
  the "Final version of MB-Lab as development has moved onto Charmorph". `bl_info` says
  `"blender": (4, 0, 0)` [M]. It is a legacy `bl_info` add-on without a
  `blender_manifest.toml` [M]. Issue #414 "Blender 4.2" (2024-07-17) is unanswered [M]. No
  maintained fork exists: the three most recently pushed forks (2026) carry no Blender-5 work [M].
- **Static scan for Blender 4.1-5.x breakage [M, partial]:** I grepped all 31 `.py` files for
  `use_auto_smooth` (removed in 4.1), `import bgl` (removed in 5.0), `blend_method`,
  `calc_normals_split` and `face_maps`, and got **no hits**. Engine strings use `'BLENDER_EEVEE'`,
  which is valid again in 5.0. That makes a 5.1.2 run plausible but unproven [I]. Known bugs
  from the release notes: BVH import "buggy", and hair presets use the old Principled Hair BSDF
  [S]. We don't use either.
- **What the anime body offers [M, from `data/characters_config.json`]:**
  - `anime_female_base` is 13,995 vertices and 13,806 faces.
  - F_AN01 / F_AN02 are labelled "Anime female ... (AGPL3)" in "shojo style" and share the
    `MBLab_anime_female` template.
  - F_AN03, "Realistic anime female", uses the human female template.
- **Proportion controls [M, from `data/transformations/anime_female_base_transf.json` and
  `data/presets/anime_female_base/anyme_style1.json`]:**
  - Bust: `BreastMass`, `BreastTone`, `BreastScaleY`, `BreastPush`.
  - Waist and hips: `Waist_Size`, `Pelvis_GluteusMass`, `Pelvis_GluteusSize`, `Pelvis_Length`,
    `Pelvis_Angle`.
  - Torso: `Torso_Vshape`, `Torso_Length`, `Torso_SizeX`.
  - Legs: `Legs_UpperlegLength`, `Legs_LowerlegLength`, `Legs_UpperlegSize`.
  - Head: `Head_Size`, `Neck_Length`.
  - Presets: three "anyme_style" plus bodybuilder and obese.
  - MB-Lab's measurement-driven body builder is human-only; the docs say it is not available for
    anime [S]. So anime shaping is slider or preset work, which suits scripted, reproducible
    builds (the slider values go in a JSON) [I].
- **Skeleton [M, from `data/joints/anime_female_joints.json`]:** `root, pelvis, spine01-03,
  neck, head, clavicle, upperarm (+twist), lowerarm (+twist), hand, thigh (+twist), calf
  (+twist), foot, toes`, full fingers, **plus `breast_L` / `breast_R`**. Every one of our 22
  retarget bones has a one-to-one partner:

  | MB-Lab bone | Our bone |
  |---|---|
  | pelvis | Hips |
  | spine01 / 02 / 03 | Spine / Chest / UpperChest |
  | neck | Neck |
  | head | Head |
  | clavicle | Shoulder |
  | upperarm | UpperArm |
  | lowerarm | LowerArm |
  | hand | Hand |
  | thigh | UpperLeg |
  | calf | LowerLeg |
  | foot | Foot |
  | toes | ToeBase |

  Twist bones can keep their weights as children of the renamed bones, or merge into the
  parents [I]. Breast bones give us a bust spring for free [I].
- **Unknowns to settle in the spike [I]:** the rest pose (our retarget needs a T-pose), whether
  "shojo style" (a 2017-era face) matters when we author faces in 2D anyway (`author_faces.py`),
  and the true heads-tall of the base. I couldn't measure the body without downloading the mesh;
  the joint file stores vertex indices, not positions [M].

### 3.2 CharMorph (MB-Lab's successor)

- **Source:** https://github.com/Upliner/CharMorph. Latest release v0.4.0-3, 2025-03-27, with
  `CharMorph.zip` at 225,754 B. The character library is a separate repo, `Upliner/CharMorph-db`,
  about 1.1 GB, last pushed 2024-07-23. v0.3.5 shipped a bundled 617,760,772 B zip [M].
- **Characters and licences [M, from each `config.yaml` / `license.txt` in CharMorph-db]:**
  - `antonia`: "Antonia Polygon (CC-BY)", `license: CC-BY 3.0`.
  - `reom`: "Reom (CC-BY)".
  - `mb_female` / `mb_male`: "MB-Lab female (AGPL3)".
  - `mb_female` has an `Anime` *type*, but on the realistic MB human mesh (morph
    `morphs/L1/Anime.npy`). The separate MB-Lab anime template is not included.
- **Fit [I]:** a better-maintained tool, but no stylised anime body. It gives Rigify output
  only, which needs renaming. It adds nothing over MB-Lab (anime) or MPFB (CC0) for us.

### 3.3 MPFB2 (MakeHuman for Blender)

- **Source:** https://extensions.blender.org/add-ons/mpfb/ and
  https://github.com/makehumancommunity/mpfb2. Version 2.0.17 (release 2026-07-22), 42.9 MB,
  `blender_version_min = "4.2.0"` with no maximum, `SPDX:GPL-3.0-or-later`. The repo was
  pushed 2026-09-26, so it is actively maintained [M].
- **Licence, verified on https://static.makehumancommunity.org/about/license.html and
  .../mpfb/faq/can_i_sell_models.html [M]:**
  - "All core assets are shared under Creative Commons, CC0."
  - "The source code of MPFB is shared under GPL".
  - The FAQ: "All core assets (the base mesh, targets, skins…) are shared under CC0". Its caveat:
    "If you use a third party asset shared under a different license it is your responsibility
    to fulfill the obligations of that license."
  - **So exported bodies are CC0 if we stick to core assets [M].**
- **Proportion controls [M, from the repo tree `src/mpfb/data/targets/`]:**
  - Breast: `breast-volume-vert-up/down`, `breast-trans-up/down`, `breast-point-*`,
    `breast-dist-*`, plus the cup / firmness macro grid.
  - Hips: `hip-scale-horiz/depth/vert-*`, `hip-waist-up/down`.
  - Buttocks: `buttocks-volume-*`.
  - Also torso, stomach, legs (`upperleg-scale-vert`, `lowerlegs-height`), head scale, and an
    `idealproportions` macro.
- **Rigs [M, from `src/mpfb/data/rigs/standard/`]:** `default`, `default_no_toes`,
  `game_engine`, `game_engine_with_breast`, `mixamo`, `mixamo_unity`, `cmu_mb`, `openpose`, plus
  Rigify. `game_engine_with_breast` has 55 bones in UE-mannequin style (`pelvis, spine_01-03,
  neck_01, head, clavicle_l, upperarm_l, lowerarm_l, hand_l, thigh_l, calf_l, foot_l, ball_l,
  breast_l/r`, fingers). That maps 1:1 onto our 22 bones [M/I].
- **Open issues [M]:** #439 "Rigify changed identification of generated rigs" (Rigify only; we
  wouldn't use it) and #358 "hands and feets crushed when setting up Mixamo animated rig".
- **Fit [I]:** the cleanest licence and maintenance story, with realistic deformation topology.
  Getting to a gacha body means realistic mesh, then targets, then our anime restyle and sculpted
  shape keys. The head must be replaced or re-sculpted for an anime skull. MakeHuman's default
  rest is probably an A-pose, so convert it to our T-pose (unverified).

### 3.4 Blender Studio "Human Base Meshes" bundle

- **Source:** https://www.blender.org/download/demo-files/. The entry reads "Human Base Meshes
  v1.4.1 by Blender Studio and community contributions … 49 MB – CC0 … Requires Blender 4.2 LTS or
  newer" [M, raw HTML]. The page says "Updated: Jan 20, 2025" [M], but the file index
  https://download.blender.org/demo/asset-bundles/human-base-meshes/ dates
  `human-base-meshes-bundle-v1.4.1.zip` **20-Jan-2026, 50,643,039 B**, after v1.4.0 on
  29-Sep-2025 [M]. The page's year is probably a typo [I].
- **Contents [M, from developer.blender.org docs pages]:**
  - "Base Mesh - Stylized Female", "Stylized Male", "Stylized Head", plus stylised
    eye / foot / hand / jaw parts.
  - The 4.0 additions: a Planar Head, a "Generic Head Topology" with example-shape shape keys,
    and stylised and realistic "Primitive Assets … separated into multiple objects with parenting
    for fast non-destructive object posing".
  - A scan-based realistic male. v1.4 added a realistic skeleton model [S].
  - The meshes are "closed volumes" made for the Multiresolution modifier and voxel remesh [M].
  - CG Channel describes the bundle as "clean quad topology" with UDIM-ready UVs [S].
- **Rig:** none. The posing primitives are parented objects, not an armature [M/S].
- **Style [I]:** Blender Studio's stylised figures are Western stylised (Julien Kaspar-style),
  not anime-gacha. No anime asset is listed.
- **Fit [I]:** a good CC0 sculpt start if Dex wants to sculpt Rosace's body himself or with
  critique loops. It is not a drop-in. It needs a full rig (fit our `J_Bip_*` skeleton, then
  weights by data-transfer from the VRoid body plus cleanup). The docs don't claim
  deformation-oriented edge loops for the stylised female, so check shoulder and hip loops before
  rigging.

### 3.5 CC0 / CC-BY stylised anime female bases (community)

- **David Onizaki, "Genshin Style Anime Female Base Mesh For Blender"**, at
  https://sketchfab.com/3d-models/genshin-style-anime-female-base-mesh-for-blender-c2d6727e8c9742feb9a4a3bccac6e0e0.
  - **Licence [M, Sketchfab API]:** label "CC Attribution", URL
    `creativecommons.org/licenses/by/4.0/`, requirements "Author must be credited. Commercial
    use is allowed." Credit line needed on the site's credits page [I].
  - **Model [M, API]:** published 2021-07-20, 32,040 faces, 16,584 vertices, downloadable,
    no animations. Tags: base, mesh, female, anime, genshin. Its description lists shape keys
    for "arms, legs, bust, hips, neck, shoulders, and face" and an anime shader.
  - **Copies:** a Gumroad copy exists under a third-party account ("downloadforfree") [S].
    Only use the Sketchfab original [I].
  - **Provenance flag [I]:** "Genshin style" plus the `genshin` tag means we should confirm it
    is an original build before it enters the repo. A quad base with authored shape keys points
    to original work; ripped game meshes are triangulated with game UV layouts. Check this after
    download, before any use, and consider asking the author.
  - **Fit [I]:** the closest free match to the look Dex wants, with bust and hip shape keys
    already there. It has no rig: fit the `J_Bip_*` skeleton, then transfer or auto weights.
    Topology quality is unknown until inspected.
- **Death Joe Productions, "CC0 Character Base Mesh Pack"**, at
  https://deathjoeproductions.gumroad.com/l/CC0pack01.
  - **Licence [M, raw page data]:** the description says "fully CC0 Licence" and links
    `creativecommons.org/publicdomain/zero/1.0/`.
  - **Price [M]:** `price_cents: 0`, pay what you want, suggested $2.
  - **Contents [M]:** "model 00 - busty anime body base mesh body" and "model 02 - thicc anime
    body base mesh body". "Anime Sculpt BaseMesh" is "Coming Soon". The page says "models will be
    Fully Quad geometry" and invites using the "Dence topology" for retopology practice.
    669 sales, rated 4.9 from 8 ratings. File sizes are not listed.
  - **Fit [I]:** the proportions are exactly the "not generic" bust and hip Dex is asking for,
    and CC0 is the cleanest licence. Dense sculpt topology is wrong for skinning, so use it as a
    projection target: fit it to our rigged base's rest pose, then Shrinkwrap / Surface Deform
    it into a shape key on the rigged body. That keeps our topology, weights and `J_Bip_*` rig.
- **hiamBoz, "Stylized Female Character Parts and Presets"**, at
  https://hiamboz.itch.io/stylized-female-base-mesh-blend.
  - **Licence [M, raw itch info table]:** "Asset license: Creative Commons Zero v1.0
    Universal".
  - **Details [M]:** tags 3D, Anime, Character Customization. "No generative AI was used".
    Updated "2 days ago" (about 2026-09-27). Description: "basemesh with character parts and 5
    presets gltf files". Files: `character_modular_mesh_ftype.blend` 24 MB, `presets.zip` 29 MB,
    and older `stylizedfemalebasemesh.blend` 1.7 MB and `…v2.blend` 1.8 MB.
  - **Unknown:** a search snippet says it is "not rigged" [S], which may describe the older
    files.
  - **Fit [I]:** worth a look because it is CC0, anime-tagged and fresh. Rig, proportions and
    topology are all unknown until opened.

### 3.6 Quaternius, Kenney, Blender Studio character rigs

- **Quaternius Universal Base Characters**, at https://quaternius.itch.io/universal-base-characters
  and https://quaternius.com/packs/universalbasecharacters.html.
  - **Licence [M, raw itch table]:** "Asset license: Creative Commons Zero v1.0 Universal".
    quaternius.com says "Free to use in personal, educational and commercial projects. (CC0
    License)" [M].
  - **Contents [M]:** 6 models in "Superhero, Regular, and Teen proportions (male and female)",
    about 13k tris, a "Humanoid Rig", "Compatible with the Universal Animation Library".
  - **Files [M]:** `Universal Base Characters[Standard].zip` 122 MB, pay what you want (free
    tier is "60-70%" of the pack, OBJ / FBX / glTF). `[Source].zip` 600 MB "if you pay $19.99
    USD or more" (includes `.blend`).
  - **Fit [I]:** the rig should be the same UE-mannequin rig our UAL / Mesh2Motion clips use
    (`THIRD_PARTY.md` notes the Retarget "Unreal Mannequin" preset covers it). But the style is
    Western low-poly with deliberately neutral faces, not gacha. We already have the CC0
    `Female Mannequin/Mannequin_F.blend` from UAL2 on disk [M, `THIRD_PARTY.md`], so a proportion
    or rig test needs no new download.
- **Kenney:** https://kenney.nl/support says "all game assets on the asset pages are public
  domain licensed (CC0)" [M]. The characters are blocky or mini [I]. Not a fit.
- **Blender Studio "Rain" rig v3:** https://studio.blender.org/characters/rain/v3/, 64.4 MB,
  Blender 4.1+. Credit line "Rain Rig (CC) Blender Foundation | studio.blender.org", CC-BY [M].
  Cartoon proportions, and the rig UI needs auto-run scripts, which clashes with our
  `--disable-autoexec` [M/I]. Not a fit.

### 3.7 Not usable, or not clean enough

- **triadlex "Body 04"** (https://triadlex.itch.io/body-04): "modeled with more anime
  proportions", unrigged, one 1.2 MB `.blend`. **The info table has no licence row and the
  description has no licence text** [M]. With no licence, all rights are reserved, so it is not
  usable [I].
- **atokia.live "Anime female character blank (IK rig+shapekeys)"** and **Mectreno "Base Mesh
  Body - Stylized Female Figure"** on Sketchfab. Licence "Free Standard", with the API summary
  "Under basic restrictions, use worldwide … commercially or not, and in all types of derivative
  works" [M], plus a NoAI clause on the page [M]. They are not Creative Commons, and the Standard
  licence bars redistributing the model as a stand-alone file [M, sketchfab.com/licenses].
  Sprites would be fine; putting the model in a public repo would not [I]. atokia's is
  23,728 faces with an IK rig and shape keys. Mectreno's is a 519k-face sculpt plus three
  lower-level bases [M]. Second-tier fallbacks at best.
- **MozzarellaARC "Anime Base Mesh F (Rhine 8.9)"**: the Sketchfab API returns "Not found"
  (deleted) [M].
- **BlenderKit anime templates** (Dogholme huang, diaverx miky): "Royalty free", Full Plan
  (paid) [M]. Out of scope for the free lane.

## 4. How to reach gacha proportions on any of these

This applies whichever base wins [I]:

1. **Measure targets first, then shape.** Use the ratios from `reference-models.md` and
   `PIPELINE.md` 3.3 (heads tall, crotch height, shoulder / waist / hip widths, bust depth in
   profile). Store them in a JSON beside the build script so `rosace_check.py`-style checks can
   gate them.
2. **Shape keys, not scale.**
   - Sculpt or project one `Proportions` shape key on the unrigged or rest-pose body:
     underbust and bust volume, waist pinch, hip flare, thigh taper, calf and ankle slimming.
   - Scales and lattices stay for long, smooth changes (leg length, torso length), which the
     existing piecewise vertical remap already does well.
   - A Lattice on the pelvis / chest region is fine for blocking, but bake it into the shape key
     so the build stays deterministic.
3. **Keep the rig consistent with the shape.** After changing proportions, move joints to the
   new volumes. MB-Lab and MPFB do this automatically when you finalize. Our restyle already
   applies the same remap to bones and vertices, so a later shape key must not move joint
   centres by more than the weight falloff tolerates. Check with the existing IK residual gate
   (0.1 mm).
4. **Projection route (for CC0 sculpts like Death Joe's):**
   - Align the sculpt to the rigged body's rest pose.
   - Surface Deform or Shrinkwrap (nearest surface point, with offset) the rigged body onto it.
   - Apply as a shape key, then smooth-correct the armpit, crotch and neck.
   - Result: the sculpt's silhouette on our topology and weights. Nothing from the sculpt's own
     topology ships.
5. **Rest-pose conversion to T-pose** (needed for any A-pose base):
   - Pose it to a T-pose.
   - Apply the Armature modifier into the basis. If shape keys exist, apply per key, or bake the
     keys first.
   - Apply the pose as rest, then re-add the modifier.
   - Then `bone_map_vrm.json` works unchanged apart from renaming.
6. **Renaming:** MB-Lab, MPFB `game_engine*` and Quaternius all use UE-mannequin-like names, so
   one rename table per source gets us to `J_Bip_*`. The pinned VRM add-on (4.7.2) can also map
   humanoid bones on arbitrary names if we ever want a VRM export [I]. Our scripts key on
   `J_Bip_*`, so rename anyway.

## 5. What a spike would need (not done; needs Dex's OK per download)

The table lists each thing the spike would download, how big it is and why [M for sizes].

| Item | Size | Why |
|---|---|---|
| MB-Lab 1.8.1 (GitHub source zip) | repo ~220 MB (API `size` 220,006 KB); exact zip size not listed | anime female plus sliders |
| Blender 4.2 LTS portable, only if MB-Lab fails on 5.1.2 | not checked | one-off generation, then save `.blend` |
| Death Joe CC0 pack | not listed | busty / thicc projection targets |
| Onizaki base (Sketchfab) | not listed | CC BY 4.0 anime base plus provenance check |
| MPFB 2.0.17 (optional fallback) | 42.9 MB | CC0 realistic body with breast rig |
| hiamBoz kit (optional) | 24 MB + 29 MB | CC0 anime parts, unverified |

Spike acceptance [I]:

- Rosace built on the new base passes the existing gates: fingerprint determinism, IK residual
  under 0.1 mm, and retarget limb error comparable to the current 3-6° mean.
- Measured proportions hit the section 1 targets.
- A blind A/B sheet at 144 px against the current VRoid build.

## Sources

- Blender demo files: https://www.blender.org/download/demo-files/
- Human Base Meshes index: https://download.blender.org/demo/asset-bundles/human-base-meshes/
- Human Base Meshes docs: https://developer.blender.org/docs/features/asset_system/asset_bundles/human_base_meshes/
  and https://developer.blender.org/docs/release_notes/4.0/asset_bundles/
- CG Channel on the bundle: https://www.cgchannel.com/2023/06/download-blender-studios-free-human-base-meshes/
- MB-Lab: https://github.com/animate1978/MB-Lab (files `data/characters_config.json`,
  `data/joints/anime_female_joints.json`, `data/transformations/anime_female_base_transf.json`,
  `data/presets/anime_female_base/*.json`, issues #414 and #415, releases)
- MB-Lab licence: https://mb-lab-docs.readthedocs.io/en/latest/license.html; creation tools:
  https://mb-lab-docs.readthedocs.io/en/latest/creation_tools.html
- CharMorph: https://github.com/Upliner/CharMorph and https://github.com/Upliner/CharMorph-db
- MPFB: https://extensions.blender.org/add-ons/mpfb/, https://github.com/makehumancommunity/mpfb2,
  https://static.makehumancommunity.org/about/license.html,
  https://static.makehumancommunity.org/mpfb/faq/can_i_sell_models.html,
  https://static.makehumancommunity.org/mpfb/releases/release_2017.html
- Onizaki: https://sketchfab.com/3d-models/genshin-style-anime-female-base-mesh-for-blender-c2d6727e8c9742feb9a4a3bccac6e0e0
- Death Joe: https://deathjoeproductions.gumroad.com/l/CC0pack01
- hiamBoz: https://hiamboz.itch.io/stylized-female-base-mesh-blend
- triadlex: https://triadlex.itch.io/body-04
- Quaternius: https://quaternius.itch.io/universal-base-characters and
  https://quaternius.com/packs/universalbasecharacters.html
- Kenney: https://kenney.nl/support
- Rain: https://studio.blender.org/characters/rain/v3/
- Sketchfab licences: https://sketchfab.com/licenses; atokia
  https://sketchfab.com/3d-models/anime-female-character-blank-ik-rigshapekeys-c913963dae0c45238193036293a16d62;
  Mectreno https://sketchfab.com/3d-models/base-mesh-body-stylized-female-figure-7150ab39b15b4143a27ee3ad6889e0bf
