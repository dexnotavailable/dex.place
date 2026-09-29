# Third-party inputs for the Rosace build

Everything the character pipeline borrows from someone else: what it is, where it came from,
the licence in the source's own words, and what we use it for. None of these files live in
this repo. `third_party.json` pins every download (URL, size, sha256) and
`fetch_third_party.py` re-fetches and verifies them into
`D:\Dex\Inbox\Downloads\dexplace-character\` (override with `DEXPLACE_DOWNLOADS`).
`inventory_imports.py` import-checks them and writes
`D:\Dex\Projects\dex-place-art\rosace\build\inventory.md`.

Licences checked on the source pages on 2026-09-28.

## What this means for publishing

- Everything here allows modifying the data and publishing sprites rendered from it.
- **Seed-san needs a credit line if any published sprite derives from it** ("Seed-san model
  by VirtualCast, Inc."). It is not CC0, despite what the task brief assumed.
- CMU asks for an acknowledgment (text below) and forbids reselling the data itself.
- CC0 items (Quaternius, Mesh2Motion, HairSample_Female) need nothing; crediting Quaternius
  anyway is good manners.
- Raw files (VRM, GLB, FBX, BVH, .blend holding their actions) stay out of the public repo.
  That is our rule, not a licence requirement for the CC0 ones.

## Blender extensions (isolated env only)

Installed by `python blender_env.py setup` into
`D:\Dex\Tools\blender-dexplace\extensions\user_default\`. Dex's own Blender profile is
untouched. Zips cached in `...\dexplace-character\blender-extensions\`.

| Extension | Version | Source | Licence | Size | sha256 | Use |
|---|---|---|---|---|---|---|
| VRM format (saturday06 / Isamu Mogi) | 4.7.2 | https://extensions.blender.org/add-ons/vrm/ (file: `add-on-vrm-v4.7.2.zip`) | `SPDX:MIT`, `SPDX:GPL-3.0-or-later` (manifest) | 1,643,935 B | `e85588660bfbb4099910a86803fa87dc8348e65541a4ccdcaf40c538f60027dc` | import the VRM base bodies, humanoid bone map, expressions, spring bones |
| Retarget (KBS-DEV, fork of Expy Kit + AnimAide) | 5.2.0 | https://extensions.blender.org/add-ons/retarget/ (file: `add-on-retarget-v5.2.0.zip`; source https://github.com/KBSBAUDRICE/Retarget) | `SPDX:GPL-3.0-or-later` | 225,631 B | `521ec8ff5c2373893ea8022b3f71d27ed191fb73f3a5634cac31585e0dcb7af3` | bone-map presets (Unreal Mannequin = the UAL/Mesh2Motion rig, Vroid, Rigify metarig = Seed-san, Mixamo, MMD) and bind/bake. Proven headless by `retarget_smoke.py`. |
| MMD Tools (MMD team / UuuNyaa) | 4.5.14 | https://extensions.blender.org/add-ons/mmd-tools/ (file: `add-on-mmd-tools-v4.5.14.zip`) | `SPDX:GPL-3.0-or-later` (extensions API) | 803,729 B | `ed3b78184ae9862be0df04e2e147803d011ad067edd8c31029c92fb719e19a6f` | PMX/PMD import for the MMD base-body search (`docs/character/BASE-OPTIONS/mmd-search.md`, `base_search.py`). Installed 2026-09-29; `blender_env.py check` passes with it enabled. |

MMD Tools was "considered, not installed" until 2026-09-29, when PMX base bodies became
candidates. It is now pinned in `EXTENSIONS` like the other two.

## Base bodies (VRM)

### Seed-san

- Source page: https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san
- File URL (pinned): https://raw.githubusercontent.com/vrm-c/vrm-specification/837f156dbce43ad69183ce1bdab549961ae1c1ee/samples/Seed-san/vrm/Seed-san.vrm
- Licence, README in that folder: "[VRM Public License 1.0](https://vrm.dev/en/licenses/1.0/index)
  ... Seed-san model by VirtualCast, Inc." The folder has no LICENSE file.
- Licence settings embedded in the file (VRM 1.0 meta): `avatarPermission: everyone`,
  `commercialUsage: corporation`, `modification: allowModificationRedistribution`,
  `allowRedistribution: true`, `allowExcessivelySexualUsage: true`,
  `allowExcessivelyViolentUsage: true`, `allowPoliticalOrReligiousUsage: true`,
  `allowAntisocialOrHateUsage: true`, **`creditNotation: required`**.
- Size / sha256: 10,917,800 B, `624d0d554bc205bbdc33e22a68a2c3c20edebb3e573011ead8878a65e5329b23`.
  README 194 B, `f0fdc21cf26437d9becd90a64d350bc0307fcfa172e1caea5aa39c52a5b3b9b6`.
- Local: `...\dexplace-character\vrm\Seed-san.vrm`, `...\vrm\Seed-san_README.md`
- Use: fallback base body and proportion reference. Its outfit, robot arm and backpack are
  fused into one mesh, so it needs more stripping than HairSample_Female.

### HairSample_Female (VRoid beta sample)

- Official status: pixiv's VRoid FAQ "Do VRoid Studio's sample models come with conditions
  of use?" (https://vroid.pixiv.help/hc/en-us/articles/4402614652569) lists HairSample_Female
  under "CC0 license models": "The VRoid Studio models listed below are CC0 licensed.
  Copyright is waived, and there is no particular limit when using them."
- Licence embedded in the file (VRM 0.0 meta): `licenseName: CC0`, every usage flag Allow;
  exporter `VRoidStudio-0.11.2`.
- Our copy comes from an **unofficial mirror**, https://github.com/madjin/vrm-samples
  ("VRoid sample models", no licence of its own), because the official download on VRoid
  Hub needs a pixiv sign-in. File URL (pinned):
  https://raw.githubusercontent.com/madjin/vrm-samples/e16eb187100149a315ad92c3c9968f1d5baa6c7d/vroid/beta/HairSample_Female.vrm
- Size / sha256: 17,518,216 B, `adfd242317aaabc773f31f7fff7b013979fbb5baa47e97427a78913d9cb4e979`
- Local: `...\dexplace-character\vrm\HairSample_Female.vrm`
- Use: first-choice CC0 anime base body (separate Face/Body/Hair meshes, J_Bip_* rig that
  matches Retarget's Vroid preset).

## Base v2 (BOOTH; Dex's pick 2026-09-29: "take the busty SiroinoSotai body, then swap in the head from the MMD女性素体")

Downloaded by Dex from BOOTH (both free items; a BOOTH order is his to place). Neither is
pinned in `third_party.json` or fetched by `fetch_third_party.py`: the downloads need his
BOOTH login. `rosace_v2/sources.py` checks the sha256 of the extracted file before every build.
Built into `rosace.blend` by `build_rosace_v2.py`: the canonical Rosace base since the Adopt step
(2026-09-29, PIPELINE.md 3.6e; before it the output was `rosace_v2.blend`, and the retired v1
base is kept as `build/rosace_v1.blend`). sha256 of both build inputs re-checked 2026-09-29 at Adopt. Search notes and the shortlist:
`docs/character/BASE-OPTIONS/mmd-search.md` (items 2 and 4 of its shortlist).

### SiroinoSotai v1.0 (しろいの), the body

- Source page: https://booth.pm/ja/items/8268676 (free)
- Licence, quoted from the shop page (2026-09-29, `mmd-search.md`): 「CC0ライセンスのため、個人・法人、商用・非商用を問わず自由に利用でき、利用報告・許可申請・クレジット表記も必要ありません。」
  and 「VRChat以外にも、ゲーム、映像、配信、イラストなど、幅広い創作にご利用いただけます。」
  CC0 1.0 covers the FBX, the .blend and the textures. The zip has no readme or licence file.
- Two conditions that are not CC0: our work must not be called 「公式」「公認」「認定」「監修」
  「共同開発」 (official, endorsed, certified, supervised, co-developed) without permission, and
  the SiroinoSotai **logo is not CC0**: never use it.
- Credit: not required. We credit anyway (DESIGN.md): "Base body: SiroinoSotai by しろいの (CC0)".
- Download: `D:\Dex\Inbox\Downloads\SiroinoSotai_1.0.zip`, 202,144,789 B,
  `c4ec2093659a75ca0c69ff18bed15ccd5f9d1a87136eded2d6c47bed63321c0a`
- Extracted: `D:\Dex\Projects\dex-place-art\rosace\bases\siroino\SiroinoSotai_1.0\`

| File | Size | sha256 |
|---|---|---|
| `SiroinoSotai.blend` (the build input; Blender 5.2 file, opens in 5.1 with a version warning) | 31,594,225 B | `d5bc3c6031d0f095c6ae509b19a71c3e2b33f3f9f1f43fbc4dc5b1132d7dd677` |
| `SiroinoSotai_PC.fbx` | 3,862,972 B | `73aa62ee0a8805cda3a1649ffffb4a4899412f4da60bd206787602c7c19af0b0` |
| `SiroinoSotai_Mobile.fbx` | 1,116,076 B | `7102dcfdbfa631d17cab3aa84fcb650f3d890cf3b04cdc2bd5b1a1177ee7c811` |
| `SiroinoSotai_1.0.unitypackage` | 34,263,129 B | `f88af125d9189d07b5157413ddfa3771342b926df41ba99fc95d9114b47cb816` |

- Use: the body (objects `Armature` + `SiroinoSotai_PC`: 8,421 verts, 57 weight groups, 98 shape keys plus Basis (93 without the divider
  keys)). The build bakes a set of its own keys (`rosace_v2/body.py` BODY_KEYS; since Adopt Breasts_LL 1.0 +
  Breasts_LLL 0.5, Hips_01/02_L 1.0, Spine_Slim 1.8, Chest_Slim 0.5, Heels 1.0), stretches the legs,
  shortens the torso and pinches the waist (`LEG_STRETCH`, `TORSO_K`, `WAIST_PINCH`), restores the
  quads, renames the Unity Humanoid bones to `J_Bip_*`, cuts the headless neck lower and welds
  the head on. Textures are not used.

### MMD用女性素体（リグ付き） (射当ユウキ, プリメロ工房), the head

- Source page: https://booth.pm/ja/items/1958825 (free)
- Licence, quoted from `00_ReadMe.txt` in the zip. Forbidden, and only these:
  「素体モデルデータの制作者を偽る行為」 (misrepresenting who made the base model: copyright in
  the base model stays with 射当ユウキ), 「他者を貶める行為への使用」 (using it to demean real
  people, races, genders or groups), 「違法行為への利用」 (illegal use). Allowed:
  「商用利用・非商用利用のどちらも可能とします。」「素体モデルを改変して、新たな作品を制作しても大丈夫です。」
  「MMDモデル以外の使用を目的とした制作（例えばUnityやUnrealEngineなど）にこの素体モデルを使用しても問題ありません。」
  and 「素体を元に作成した作品に関して素体制作者は著作権を主張しません。」 Reporting use, linking
  and credit are all optional (「クレジット表記に関して…表記するかは自由とします。」).
- Credit: optional. We credit (DESIGN.md): "Head base: MMD用女性素体 by 射当ユウキ". Never
  present the head base as our own model.
- Download: `D:\Dex\Inbox\Downloads\MMD用女性素体 (1).zip`, 360,964 B,
  `abde54587a2fdf4a6769f498cd9a8c34e7ff4987a4d87c33875eac6f42352f44`
- Extracted: `D:\Dex\Projects\dex-place-art\rosace\bases\primero\MMD用女性素体\`

| File | Size | sha256 |
|---|---|---|
| `mmdBodyWoman.blend` (the build input; MMD-named rig `00_Rig`, unweighted `01_Body` with a mirror modifier, separate eye/brow/lash/mouth meshes) | 1,534,672 B | `ff62d62fa0e30c2dfc805136cb1b6f942416722c76e325ae3b8ca71073f3609e` |
| `00_ReadMe.txt` | 3,594 B | `663c973961e1d7359a82bb90bda547b3642af8480d951f86dee1ea4cf5291ec2` |

- Use: the head only. `01_Body` is cut below the chin, scaled to the head target, its neck
  tapered onto the body's neck ring and welded; the eye sockets and mouth are filled flush (the
  face is stamped as pixels). The eye, brow, lash and mouth meshes ride along in a never-rendered
  `head_ref` collection as a placement reference. The `頭` and `左目`/`右目` bones give the head
  pivot and the eye anchors. The rest of the body mesh is discarded.

## Motion

### Quaternius Universal Animation Library 2 [Standard]

- Source page: https://quaternius.itch.io/universal-animation-library-2 (free, "name your
  own price" at $0). Page version: v2.1 (5/7/2026).
- Licence, page: "Free to use in personal, educational and commercial projects. (CC0
  License)". `License.txt` in the zip: "CC0 1.0 Universal (CC0 1.0) Public Domain
  Dedication".
- File: `Universal Animation Library 2[Standard].zip`, 18,735,003 B,
  `4008ea208a604773a2b2177d965f0f5d3195498b5bf838c3f5785d68e95f2a68`
- Local: `...\dexplace-character\quaternius\` (zip) and `...\quaternius\UAL2_Standard\`
  (unpacked). Key files: `Unreal-Godot/UAL2_Standard.glb` (8,091,444 B,
  `8cee20ab1bc55130092447e810e26df22dd2803eccc54f52137a7d54d7ab88a8`),
  `Unreal-Godot/UAL2_Standard_RM.glb` (`814eee878f82934992d3ea746c539df25e981487109c591f5efbb8dd03286f99`),
  `Unity/UAL2_Standard.fbx` (`d26d0e9f4a202d473194c056045143095a605a53ba1d823ef24055be4b86851d`),
  `Female Mannequin/Mannequin_F.blend` (`980c6eee3a2fb2ee1028d8bdd5bb95f7df983bc9de45e974ee77646b1eafbc70`).
- Use: M1 string (Sword_Regular_A/B/C with separate recoveries, Sword_Regular_Combo,
  Sword_Heavy_Combo), Sword_Dash, Sword_Block, Slide, NinjaJump, hit reaction; female
  mannequin as a same-rig proportion check. 43 clips, 30 fps.

### Quaternius Universal Animation Library 1 [Standard]

- Source page: https://quaternius.itch.io/universal-animation-library (free, $0). Page
  version: v3.0 (16/6/2026).
- Licence, page: "Free to use in personal, educational and commercial projects. (CC0
  License)". `License.txt` in the zip: same CC0 1.0 text (identical file).
- File: `Universal Animation Library[Standard].zip`, 15,904,933 B,
  `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`
- Local: `...\quaternius\UAL1_Standard\`. Key file `Unreal-Godot/UAL1_Standard.glb`
  (7,618,436 B, `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`).
- Use: locomotion (walk, jog, sprint, crouch), jumps, roll, Sword_Attack/Sword_Idle,
  Spell_Simple_* (cast). 43 clips, 30 fps.

### Mesh2Motion human animations

Added because the free UAL2 zip lacks the air attack, ground pound and spell clips the
moveset needs; Mesh2Motion ships them (same Quaternius rig and naming).

- Source page: https://github.com/Mesh2Motion/mesh2motion-app (app: https://app.mesh2motion.org)
- Licence: `LICENSE-CC0.MD`: "All 3d models, blend files, rigs, animations / CC0 1.0
  Universal". README: "The art assets (3d models, rigs, animations) are all licensed under
  CC0." (Code is MIT; not used.)
- Pinned commit `79f3f61a9852ef70234a5a4a7c13ed87f7a71833`, path `static/animations/`:

| File | Size | sha256 |
|---|---|---|
| `human-base-animations.glb` | 5,656,648 B | `406eb0a8dc4ab366e623b79b6e3005a4951392e1bda78ae39c1099d31147733c` |
| `human-addon-animations.glb` | 5,292,804 B | `a0d64d555e0d492026b72d58bf8e16c5e86779295f9093e376dcc001915c2c95` |
| `human-mocap-animations.glb` | 2,025,372 B | `814593d62522f5be8d6bd32df2a8fa3c7feb90a8e1a1ba43f4aaf0048555280d` |

- Local: `...\dexplace-character\mesh2motion\`
- Use: Sword_Attack_Air_Vertical and Attack_Ground_Pound (R ultimate), Backflip,
  Land_Three_Point, Dodge_* with root-motion variants, Run_Anime / Run_Female /
  Walk_Female, Power Up, Levitate. Keys sit on a 24 fps grid; lengths differ from the UAL
  copies, so prefer UAL where both exist.

### CMU Graphics Lab Motion Capture Database (BVH conversion)

- Source: http://mocap.cs.cmu.edu (original ASF/AMC). BVH conversion by Bruce Hahne
  (cgspeed, 2010 "Motionbuilder-friendly" release), fetched from the codewelt mirror
  http://codewelt.com/cmumocap. `READMEFIRST.txt` in the zip documents the conversion.
- Licence, CMU FAQ: "The motion capture data may be copied, modified, or redistributed
  without permission." CMU home page: "This dataset of motions is free for all uses." and
  "You may include this data in commercially-sold products, but you may not resell this
  data directly, even in converted form." Requested acknowledgment: "The data used in this
  project was obtained from mocap.cs.cmu.edu. The database was created with funding from
  NSF EIA-0196217."
- Files (both under the 100 MB cap):

| Zip | Size | sha256 |
|---|---|---|
| `cmuconvert-mb2-01-09.zip` (http://codewelt.com/dl/cmuconvert/cmuconvert-mb2-01-09.zip) | 33,755,687 B | `8822d96dac5694cb5df35e017fa7df174a051249d48d70d6732a7b68953016d9` |
| `cmuconvert-mb2-86-94.zip` (http://codewelt.com/dl/cmuconvert/cmuconvert-mb2-86-94.zip) | 92,487,061 B | `b35e3c0e47ddfe32a58600f57e552a2387a9acbcbde1ad5d35b69277a25829d4` |

- Unpacked to `...\dexplace-character\cmu\bvh\` (only the trials we use, plus the readme
  and index):

| Trial | CMU description | Size | sha256 |
|---|---|---|---|
| 02_07 | swordplay | 1,706,582 B | `40999e80d85823b2a10f0d1175065d86543d22cd115bad759d3c10ddf712c6de` |
| 02_08 | swordplay | 1,137,312 B | `6b0e2dfc0d3f5085851952673c295057e3586961ec91a78f8ea52ec7b2ba85da` |
| 02_09 | swordplay | 790,078 B | `a3a4b23537931c50b6a0f4fb7f15382fe15d4cf5e4520a8dc2e6020e9eb5d009` |
| 88_01 | backflip | 158,001 B | `7216c2e78f2e2a082f22262120c9cd1c91550eed8cfdba4a44cdfa5e4c0eb186` |
| 88_02 | backflips, jump onto platform, handstands, vertical pushups | 2,546,996 B | `db8d6fa627e5594da394a9340577833eb1b82885fb908799a45591f55af7f687` |
| 88_03 | motorcycle pose | 270,710 B | `c8233b09b5e6d949fac8fe49ac12d2e1828c0b01bcf6cf6c37ee8a45b1242f28` |
| 88_04 | stretches, cartwheels, flips, spin kicks, spins, and fall | 950,216 B | `31270d91aa40b5ae71552605519e5797d086470e50f0d1e285da967a86c9f664` |
| 88_05 | cartwheel into backflip | 118,283 B | `759e65060349c2145d30c1109f45e04f73f005e1fb1b790702af40178a38ad6a` |
| 88_06 | jump and spin kick | 178,993 B | `ffb8132848778af3c6d20c6e5d7f0878b92eca5240c534c9a97cb1190eb65f98` |
| 88_07 | cartwheel | 123,428 B | `24620b7a47cddc622d69254fe6fefa901411a32e49cd5c119e893b26b86803cd` |
| 88_08 | crouch and flip backward on hands | 225,065 B | `c09ca52ae671d90f5c3086f7a5841e6a73dc8e07731a98e127171da1fb19c693` |
| 88_09 | stretch and cartwheel | 290,271 B | `184fc431ba4fd1e50bd0032fd865abb68bd74131b1bd973c3aa31138c63cc326` |
| 88_10 | stretch and spin | 359,568 B | `1f64fe100952555cadace38960d5bf7cd61060cea0eac667e21c88ac1abfc0da` |
| 88_11 | stretches and jumps | 1,536,643 B | `a1bb781576a21fe09114358d65f8e8d53b607cd389313a33cc0732935d5d2193` |

- Use: timing and retarget for spins, spin kicks and flips in an aerial R; the amateur
  swordplay (02_07-09) for timing only, not sword arcs. 120 fps, CMU units (x 0.0564 to
  metres).
