# Motion and model sources for the player character

Where we can borrow timing, poses and a 3D body for the glaive/sword priestess, what each
source lets us do, and one download list for Dex to approve. **Nothing listed here has been
downloaded yet.** Research date: 2026-09-28.

Companions: `REF-BREAKDOWN.md` (what each reference image is for) and `CRITIQUE-PARAMS.md`.

Tags used below:

- **[M]** measured: checked on this PC or read directly off the source page/API today.
- **[S]** sourced: the source's own words (quoted) or a named third-party page.
- **[I]** inference: our reading or proposal. Treat as a claim to test.

Two ways to use a motion, because they carry very different license weight:

- **Timing only:** we watch or scrub it, write down frame counts (anticipation, contact, hold,
  recovery, how it snaps and eases), then key our own animation from scratch. Nothing of theirs
  ends up in our files. Lowest risk.
- **Retarget and alter:** we load their motion data onto our rig, then push poses, add smears,
  change holds. The sprite frames we publish are then a derivative of their data, so the license
  has to allow modification and publication.

Risk levels: **low** = clear written license that covers a public, non-commercial, donation-
accepting site. **medium** = permission is plausible but the full terms sit in a readme we
can't read until we download, or "non-commercial" wording meets our donation button.
**high** = traced/ripped from someone else's game or performance, or terms forbid what we need.

## The short version

1. **The best motion data for us is free and clean: Quaternius's Universal Animation Library 2
   (CC0).** It has 3- and 4-hit sword combos split into separate hits with their own recoveries,
   a sword dash, an air slam and a spell cast. That split is exactly the M1-string structure we
   need, and CC0 means we can retarget, bend and publish with no conditions. [S, I]
2. **Mixamo is the second pillar** for big spins (a great-sword high spin, a 360 melee attack).
   Free and royalty-free, but Dex has to sign in with an Adobe ID, and we must never commit the
   raw FBX files to the public repo. [S]
3. **Fan MMD motions are mostly timing-only.** Very few are polearm-specific; most BowlRoll
   pages show no terms and keep them in a readme inside the zip. Two exceptions state
   permission on the page itself (spinach's sword/kick set, and ジュウ's weapon-twirl-into-attack).
   Traced/ripped motions are out. [M, S]
4. **No free polearm dataset exists that we could find.** The only clean, professional glaive-ish
   data (spear sweep, spear thrust, heavy one-handed sword, charge-up specials) is the paid
   MotionPackage Pro series on BOOTH at ¥3,000 each, with a clear license. That's a purchase,
   so it's Dex's call. [M, S]
5. **Base body: build from VRoid Studio's own new-model base**, which is already installed
   (v2.3.0) and needs no download. pixiv's guidelines allow editing it in other software and
   publishing results, including games and websites. VRoid's CC0 beta samples are the
   no-strings fallback. [M, S]
6. **Blender tooling:** MMD Tools isn't installed; the VRM add-on is installed but switched off;
   the best free retarget tool for Blender 5.x is the "Retarget" extension (an Expy Kit fork
   with VRoid, MMD and Mixamo presets). Rokoko's retargeter has open Blender 5 breakage
   reports. [M, S]
7. **Warning from the local check:** three generative add-ons are currently enabled in
   Blender 5.1 (`stablegen`, `higgsfield_blender`, `meshy`). The no-image-generation rule
   means they must not touch this character. [M]

## What is on this PC right now [M]

| Item | State |
|---|---|
| Blender | 5.1.2 (`C:\Program Files\Blender Foundation\Blender 5.1`) |
| Built-in importers | BVH 1.0.1, FBX 5.15.0, glTF 5.1.20, all enabled |
| VRM add-on (saturday06) | 4.3.0 installed as an extension, **not enabled**. Its manifest allows Blender 4.2.0 to 5.2.0, so 5.1.2 is in range. Latest on extensions.blender.org is 4.7.2. |
| MMD Tools | not installed |
| Retarget / Rokoko / Expy Kit | none installed |
| Generative add-ons enabled | `bl_ext.user_default.stablegen`, `bl_ext.dex_creative.higgsfield_blender`, `bl_ext.dex_creative.meshy`. Keep them off for this work (hard rule). |
| VRoid Studio | **installed, v2.3.0**, relocated to `D:\Dex\Apps\Relocated\UserPrograms\VRoidStudio\2.3.0` (the `%LOCALAPPDATA%\Programs\VRoidStudio` path is a link to it). Not in any Steam library (checked `C:\Program Files (x86)\Steam`, `D:\Dex\Games\SteamLibrary`, `A:\Steam`). |
| VRoid sample models | none downloaded yet (the app's avatar folder is empty) |
| VRoid custom items | several third-party BOOTH items are installed in VRoid Studio. Don't use any of them on this character unless each one's license is checked. |
| Existing `.vroid` masters on `D:\` | these belong to another project and the project ledger has them on a provenance hold. Don't reuse them here. |
| Free space | D: 21 GB free (98% used), C: 19 GB free. Fine for this batch; avoid the multi-GB datasets. |

## Ranked motion shortlist

The first table puts everything side by side. Details and exact terms follow.

| # | Source | Best for | Size | License | Risk | Use |
|---|---|---|---|---|---|---|
| 1 | Quaternius Universal Animation Library 2 (Standard) | M1 combo structure, dash, air slam, spell | 17 MB zip | CC0 | low | retarget and alter |
| 2 | Mixamo (great-sword and melee clips) | Q/R wide spins, heavy slashes | per clip, unmeasured (needs login) | Adobe royalty-free, no raw-file redistribution | low | retarget and alter |
| 3 | Quaternius Universal Animation Library 1 (Standard) | locomotion, jumps, rolls, base combat | 15 MB zip | CC0 | low | retarget and alter |
| 4 | Bandai Namco Research Motion Dataset 1 (selected files) | pro-actor slash, kick, dash styles, dance | ~4.2 MB for 8 files | CC BY-NC 4.0 | medium (donations) | timing, then retarget if NC is judged OK |
| 5 | ジュウ: weapon twirl, and twirl into attack (BowlRoll 62294, 62565) | glaive spin wind-ups for Q/R | 19.41 KB + 24.46 KB | on-page: modification and reuse on other characters OK | medium | timing, then retarget |
| 6 | spinach: ちょっとした格闘モーション１ (BowlRoll 68234) | sword training, slashes, kicks, hit reactions | 314.87 KB | on-page: use freely, don't trouble model makers | medium | timing, then retarget |
| 7 | CMU Graphics Lab mocap (subjects 02, 88) | spin kicks, flips, amateur swordplay | 4.3 MB previews; 33.8 MB BVH zip | "may be copied, modified, or redistributed" | low | timing and retarget |
| 8 | 山辺康夫: 刀モーション11種 + 刀モーション2 (BowlRoll 88301, 148653) | katana choreography, two-handed grip | 3.51 MB + 38.85 KB | not on page (readme in zip) | medium | timing only until readme is read |

### 1. Quaternius Universal Animation Library 2 — top pick

- URL: https://quaternius.itch.io/universal-animation-library-2 (also https://quaternius.com/packs/universalanimationlibrary2.html)
- Author: Quaternius, with animator Gonzalo Furnier. [S]
- Files: `Universal Animation Library 2[Standard].zip` **17 MB**, free. A `[Source]` version with
  the .blend is 50 MB at $14.99 or more. [M, from the itch.io page]
- Formats: OBJ, FBX, glTF in Standard; .blend in Source. Humanoid rig built for retargeting;
  "Compatible with other common rigs (Mixamo for example)". Root-motion and in-place versions.
  Last updated v2.1 (2026-07-05). [S]
- Moves: the page says "3 and 4 hit combos, split into separate hits with their recoveries, and
  full combo anims." The Mesh2Motion browser (which ships these clips) lists: Sword Regular A /
  A Rec / B / B Rec / C / C RM / Combo, Sword Attack, Sword Attack Air Vertical, Sword Dash RM,
  Sword Block, Attack Ground Pound, Roll, NinjaJump Start/Idle/Land, Spell Simple
  Enter/Idle/Shoot/Exit. [M, read off app.mesh2motion.org] Which of these are in the free
  Standard zip vs only Source is not stated; check after download. [I]
- License, quoted: "Free to use in personal, educational and commercial projects. (CC0 License)" [S]
- Risk: **low.** CC0, no credit required (we'll credit anyway).
- Use: **retarget and alter.** The separate hit + recovery clips are the skeleton of the M1
  string; we exaggerate the arcs for a glaive and add hold frames on contact. [I]
- Caveat: a Godot Asset Store reviewer says the UpperChest bones bend too much on other
  characters; a February 2026 review calls these a starting point, not hero animation. Expect
  to rework timing, which we plan to do anyway. [S]

### 2. Mixamo

- URL: https://www.mixamo.com (needs an Adobe ID; Dex signs in)
- Clip names seen in other people's credits (not verified inside Mixamo yet): "Great Sword
  High Spin Attack", "Great Sword Slash", "Standing Melee Attack 360 High", "Stable Sword
  Outward Slash", "Stable Sword Inward Slash"; Mixamo also has Great Sword and Sword and Shield
  packs. [S, third-party pages]
- Format: FBX per clip, downloaded "without skin". Size per clip: unmeasured (needs login).
- Terms, from Adobe's official FAQ (helpx, last updated 2021-09-14): "Mixamo is available free
  for anyone with an Adobe ID"; you can use characters and animations "royalty free for
  personal, commercial, and non-profit projects". Not available for Enterprise/Federated IDs
  or China country codes. [S]
- Terms, from the pinned "Mixamo FAQ - Licensing, Royalties, Ownership, EULA and TOS" post on
  Adobe Community (it calls Mixamo a "limited duration technology preview"): the one thing you can't do
  is "distribute the raw character and animation files"; no credit is required; "The only
  research application Mixamo content can't be used in is training machine-learning models." [S]
- Risk: **low** for our use (rendered sprites in a web game). Rules for us: raw FBX and any
  .blend holding Mixamo actions stay out of the public repo. [I]
- Use: **retarget and alter**, mainly for Q/R wide spins. Mixamo's timing is fairly floaty;
  we'd tighten anticipation and add snap. [I]

### 3. Quaternius Universal Animation Library 1

- URL: https://quaternius.itch.io/universal-animation-library
- Files: `Universal Animation Library[Standard].zip` **15 MB**, free ([Pro] 41 MB at $9.99+, [Source]
  46 MB at $14.99+). 120+ animations total; the free Standard has a subset (a search summary
  says 45; not verified). v3.0 on 2026-06-16 added root motion. [M, S]
- Moves: locomotion in 8 directions, jog, sprint, jumps, crawl, deaths, "combat and gun";
  changelog mentions a fixed "sword swing elbow twist". [S]
- License: "(CC0 License)", same wording as UAL2. Itch lists "Asset license: Creative
  Commons Zero v1.0 Universal". [S]
- Risk: **low.** Use: **retarget and alter** for idle, run, jump and landing, so the combat
  clips from #1 join a consistent movement set. [I]

### 4. Bandai Namco Research Motion Dataset 1

- URL: https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset
- What it is: motion of three professional actors captured in Bandai Namco's mocap studio,
  cleaned and saved as BVH at 30 fps. Dataset 1 has walk, run, dash, walk-back/left/right,
  bow, bye, guide, respond, call, kick, punch, slash, dance, in up to 15 styles (normal,
  happy, angry, proud, feminine, tired, active, giant...). Slash, kick, punch, call and dance
  are "normal" style only. [S]
- Useful files and sizes [M, GitHub API]: `dataset-1_slash_normal_001.bvh` 501,353 B,
  `dataset-1_slash_normal_002.bvh` 592,983 B, `dataset-1_kick_normal_001.bvh` 442,941 B,
  `dataset-1_dash_normal_001.bvh` 28,856 B, `dataset-1_dash_active_001.bvh` 108,310 B,
  `dataset-1_dash_feminine_001.bvh` 122,925 B, `dataset-1_dance-short_normal_001.bvh`
  2,381,120 B. The whole dataset-1 data folder is 45.8 MB.
- License: the repo README and each dataset's LICENSE file say **CC BY-NC 4.0** today. The
  commit history shows "Change license." on 2023-07-04; news coverage from 2022 and older forks
  say CC BY-NC-ND 4.0, so it was loosened (the "no derivatives" part was dropped). [M, S]
- The NC definition in that license: "not primarily intended for or directed towards
  commercial advantage or monetary compensation." [S]
- **Donation flag:** dex.place accepts donations. My reading is that a personal site whose
  purpose isn't earning money is still non-commercial under that definition, but it's a
  judgment call and Dex should make it. If donations ever unlock game content, treat it as
  commercial. [I]
- Also required: attribution, and the README asks to cite the paper (Kobayashi et al., 2023,
  arXiv:2306.08861). [S]
- Risk: **medium** (donations). Use: **timing first** (professional slash timing is the value);
  retarget only after Dex OKs the NC reading. [I]

### 5. ジュウ: ダム＆ディー武器回し / 武器回しからの攻撃 (weapon twirl, and twirl into attack)

- URLs: https://bowlroll.net/file/62294 and https://bowlroll.net/file/62565; previews
  https://www.nicovideo.jp/watch/sm25436591 and https://www.nicovideo.jp/watch/sm25467804
- Author: ジュウ. Posted 2015-01-27 and 2015-01-31. [M]
- Files: `ダム＆ディー武器回しモーション.zip` 19.41 KB (690 DL); `ダム＆ディー武器回しからの攻撃モーション.zip`
  24.46 KB (1,036 DL). VMD only. Password: the video number ("PASS:動画番号"). [M]
- Terms, quoted from the video description: 「改造や他キャラへの流用はＯＫです」 (modifying it and
  reusing it on other characters is OK). Also: made for the ula-style Dum & Dee models and
  needs an external-parent setup, and the author warns reuse on other characters is a lot of
  work. [S]
- Flag: the first video carries the tag 「MMDモーショントレース」 (motion trace), so it may be
  traced from another work; the source isn't named. The weapon type isn't stated either.
  Watch the preview first. [M, I]
- Risk: **medium.** Use: **timing** for the glaive twirl wind-up into a wide strike (Q or R);
  retarget only if the readme matches the page and the trace source turns out harmless. [I]

### 6. spinach: ちょっとした格闘モーション１

- URL: https://bowlroll.net/file/68234; preview https://www.nicovideo.jp/watch/sm26049583
- Author: spinach. Posted 2015-04-12. 14,408 DL. [M]
- File: `ちょっとした格闘モーション１.zip` 314.87 KB, VMD only. [M]
- Moves: kick-focused play fighting, sword training, slashing and getting slashed
  (「蹴り主体でイチャイチャしていたり、剣を使ってトレーニングしたり斬ったり斬られたり」). [S]
- Terms, quoted from the BowlRoll page: 「モデル作成者の方々のご迷惑にならない程度にお好きにお使いください。」
  (use it as you like, as long as it doesn't cause trouble for the model makers). [S]
- Risk: **medium**, only because a readme inside the zip could add conditions. Use: **timing,
  then retarget** for M1 follow-ups, kicks mixed into the string, and hit reactions for enemies. [I]

### 7. CMU Graphics Lab Motion Capture Database

- URL: http://mocap.cs.cmu.edu (search page lists every trial)
- Relevant trials [M, from the site's full list]: subject 02 trials 07/08/09 "swordplay";
  subject 88 "jump and spin kick" (06), "stretches, cartwheels, flips, spin kicks, spins, and
  fall" (04); subject 90 cartwheels and flips; subject 87 backflips.
- Terms, CMU FAQ: "The motion capture data may be copied, modified, or redistributed without
  permission." Home page: "This dataset of motions is free for all uses." The older home-page
  text also says you "may not resell this data directly, even in converted form." [S]
- Formats: the official site serves ASF/AMC, C3D and preview videos. **Blender has no
  ASF/AMC importer**, so use a BVH conversion. B. Hahne's BVH conversions (cgspeed) are
  mirrored at http://codewelt.com/cmumocap; `cmuconvert-mb2-01-09.zip` (subjects 01 to 09) is
  33,755,687 B and `cmuconvert-mb2-86-94.zip` is 92,487,061 B. [M]
- Risk: **low** license; quality is mixed (the swordplay is amateur). Use: **timing and
  retarget** for acrobatic spins and flips in an aerial R; not for the sword arcs. [I]

### 8. 山辺康夫: 刀モーション11種＋剣劇構造サンプル and 刀モーション2

- URLs: https://bowlroll.net/file/88301 and https://bowlroll.net/file/148653; previews
  https://www.nicovideo.jp/watch/sm27762171 and https://www.nicovideo.jp/watch/sm32031068
- Author: 山辺　康夫. Posted 2015-12-10 and 2017-10-01. [M]
- Files: `配布用刀モーション (2).zip` 3.51 MB (contains VMD, VPD, PMD, PMX) and `刀モーション2.0.zip`
  38.85 KB (VMD, VPD, PMX). [M]
- Moves: 11 katana motions plus a sample two-handed-grip bone structure; the second set uses
  "arm-cut arm IK" and needs the setup from sm31560892 first. [S]
- Terms: **none shown on the page** (BowlRoll says no message was written); they'd be in the
  readme inside the zip, if anywhere. [M]
- Risk: **medium.** Use: **timing only** until the readme is read. Worth it because the two-hand
  grip choreography is closer to a polearm than one-handed sword motions. [I]

### Also considered (not in the top 8)

- **Dolphin_664, 戦闘用におそらく使えるかもしれないと思われるモーションたち** — https://bowlroll.net/file/103142,
  177.39 KB `.rar`, 5,914 DL. Slash set (made for one Youmu model) plus anime-style spin jump,
  glide dash and no-arm-swing run. Good timing reference for M2. No terms on page. [M, S]
- **翡水, アクション向けモーション集** — https://bowlroll.net/file/227022, 59.89 KB, 4,806 DL; acrobatic
  action moves. No terms on page. [M]
- **Copyknight20, Sword trigger fight / Sword Art motion** — BowlRoll 325468 (779.64 KB) and
  315660 (12.04 MB). No terms anywhere; the second title suggests a named anime. [M]
- **大剣系モーション** — https://bowlroll.net/file/128413, 18.60 KB. Built on another creator's
  model; password is tied to an MMD contest video. No usage terms on page. [M, S]
- **Mesh2Motion** — https://app.mesh2motion.org; CC0 art assets (MIT code). Mostly the same
  Quaternius clips as #1 in one GLB (`human-base-animations.glb` 5.66 MB,
  `human-addon-animations.glb` 5.29 MB, `human-mocap-animations.glb` 2.03 MB). Good for
  previewing clips on a humanoid in the browser before downloading anything. [M, S]
- **100STYLE** — CC BY 4.0, 100 locomotion styles, but the BVH zip is 1.47 GB. Only worth it
  later if run cycles need style variety. [M, S]

## Watch-only references (no download needed)

These are timing references we can scrub in a browser. Nothing gets saved.

- **The preview videos for every MMD entry above** (Niconico links listed with each).
- **Motion Actor Inc. YouTube** — https://www.youtube.com/@MotionActorInc. A Japanese
  motion-actor company posting movement reference for game and anime creators (channel
  keywords include katana, action, tricking). Channel terms: "Feel free to trace, reference, and modify
  the artwork for personal use. However, any commercial use, redistribution, re-uploading, or
  sale of the content is prohibited." [S] **Donation flag** applies; use as timing reference
  only. [I]
- **Quaternius and Mesh2Motion viewers** — https://quaternius.com/animviewer.html,
  https://app.mesh2motion.org.
- **Mixamo's own previewer** once Dex is signed in.

## Paid option (a purchase, so Dex decides)

**MotionPackage Pro (デジタルモーション株式会社) on BOOTH**, ¥3,000 each, 20 motions per pack, recorded
with suit actors. The 必殺技, ファンタジー and 侍 listings say OptiTrack capture, FBX, 30 fps, Humanoid
bones; the 剣 listing doesn't state its format. [S] Three packs fit us:

- 第65弾 "剣" — https://motionpackage.booth.pm/items/8304062 — includes 構える／薙ぎ払う／突く（槍）
  (spear ready / sweep / thrust), a heavy one-handed sword set, axe sweep and slam. The only
  professional polearm sweep we found.
- 第64弾 "必殺技" — https://motionpackage.booth.pm/items/8304050 — charge-and-release,
  jump uppercut, dual-blade flurry, charged slash (気合を溜めて切る). Ult wind-ups.
- 第63弾 "ファンタジー" — https://motionpackage.booth.pm/items/8304038 — attack and healing
  magic (weak/strong), combo, hip-draw rapid slashes.

License (same on each): free modification; use for any purpose that isn't prohibited;
personal commercial use allowed with credit; companies and mid-size-or-larger commercial use
should contact them; **no redistribution of the motion or modified motion in extractable
form**. [S] Risk: **low**. Rendered sprite frames don't expose the motion data; raw FBX stays
out of the repo. [I]

## Considered and rejected

| Source | Why not |
|---|---|
| Ubisoft LAFAN1 | CC BY-NC-ND 4.0: no sharing of adapted material, and sprites made from it would be adapted material. [S] |
| arisumatio "[MMD] Sword Attack and Damage Motion" (DeviantArt) | described as a motion rip from a commercial mobile game. [S] |
| ジュウ "モーショントレース集" (BowlRoll 304453, 13.25 MB) | traced from Motion Actor Inc. videos, whose terms forbid commercial use and redistribution. [S] |
| いんた "西洋剣術モーションPart2" (BowlRoll 19690) | a trace of another performer's video. [S] |
| KungFuAthlete (Hugging Face) | labeled Apache-2.0 and has 90 staff clips, but it's robot joint data (Unitree G1) or SMPL-H, built from athletes' training videos whose rights aren't explained, and the zip is 2.15 GB. [M, S] |
| MoCap Online free "T.C. Sword" pack | usable license, but getting it means a $0 checkout with personal details, and their license needs written permission for any AI-related use. Low value next to #1 and #2. [S, I] |
| Fan-made Genshin/anime character fight motions (e.g. 刻晴VS嘉然, BowlRoll 279957) | no terms, named commercial characters. [M] |

## Base models (top 3)

We only need a clean humanoid body with anime proportions: we will replace the outfit, hair,
face and weapon. It has to (a) take the retargeted motions, (b) let us check how poses read
from the side-view camera and other angles, and (c) be clean enough to publish sprites from.

| # | Base | Size | License | Risk | Use |
|---|---|---|---|---|---|
| 1 | VRoid Studio 2.3.0 new-model base body | no download | pixiv content, not CC0; editing in other software and publishing (games, websites) allowed | low | the body our character is built on |
| 2 | VRoidPreset / AvatarSample_A (and B, C) | ~15 MB VRM (unofficial mirror size) | all uses allowed, no credit required; no resale of the model file | low | proportion/pose mannequin and a starting point |
| 3 | β Ver AvatarSample_1 to 4, HairSample_Male/Female | ~14 to 18 MB VRM each (unofficial mirror sizes) | CC0 | low | no-strings fallback mannequin |

### 1. VRoid Studio new-model base (recommended)

- Already installed (v2.3.0, see "What is on this PC"). Create a new model, export VRM, import
  with the VRM add-on. No download at all. [M]
- pixiv's VRoid Studio Guidelines (edited 2023-12-21) say: "All content provided by pixiv,
  including the base models when creating a new avatar, is not CC0." Then, for items without a
  special clause, anyone "may sell or use for commercial purposes any mesh, texture, or preset
  item provided by VRoid Studio", and "You can edit and use the model data exported from VRoid
  Studio using software other than VRoid Studio." Images and videos of the models can be used
  in "games, applications, software ... websites". [S]
- Prohibited: making a character-creation app that outputs VRoid-derived meshes (not us). [S]
- Watch for: preset items that show a special license inside VRoid Studio, and the third-party
  custom items already installed. [S, M]

### 2. VRoidPreset A to Z / AvatarSample_A, B, C

- Conditions page: https://vroid.pixiv.help/hc/en-us/articles/4402394424089 (updated
  2024-12-26). "The license to these sample models is not CC0." Their files "can be used by
  anyone in any kind of activity, be it for-profit or not", with "no need to credit the
  original creator". Prohibited includes re-releasing the model as CC0 and "Redistributing the
  .vroid or VRM file of the sample model ... in exchange for a fee." [S]
- VRoid Hub page for AvatarSample_A:
  https://hub.vroid.com/en/characters/2843975675147313744/models/5644550979324015604 shows VRM
  0.0 with every condition set to Allow and "Attribution: Not required". Downloading from the
  Hub needs a pixiv sign-in. [M]
- Or download it inside VRoid Studio: model selection screen → Sample Models → click to
  download (per pixiv's help page 31627266179865). That's still a download, so it's in the
  batch. [S]

### 3. β Ver AvatarSample_1 to 4 and HairSample (CC0)

- pixiv's sample-model FAQ lists HairSample_Male, HairSample_Female and β Ver
  AvatarSample_1 to 4 as CC0; the AvatarSample_1 page says pixiv "has waived all copyright and
  related or neighboring rights to this model." [S]
- These are from the old beta, so the mesh is older. Fine as a mannequin; less ideal as the
  final body. [I]
- Sizes: an unofficial GitHub mirror (madjin/vrm-samples) lists these VRMs at about 14 to 18 MB
  each. Prefer the official VRoid Hub download (pixiv sign-in). [M, S]

### Sketchfab fallback, and a warning

- A live Sketchfab API search today for downloadable **CC0** anime characters returned **zero**
  results. CC BY results are plentiful. [M]
- If we ever need a non-VRoid body: "Taila | Original work" by Partaevil
  (https://sketchfab.com/3d-models/taila-original-work-8ae231b61fc34827be30e2a1edc5b811),
  CC BY, 24,286 faces, tagged rigged with 1 animation, GLB 2.8 MB. Credit required; Sketchfab
  sign-in required. [M]
- Many CC BY anime uploads on Sketchfab are fan rips of commercial characters (today's results
  included a NIKKE character and a Dandadan character). The uploader's CC BY label can't grant
  rights they don't have. Don't use those. [M, I]

## Blender tooling and the retarget route

| Tool | Where | License | Size | Blender 5.1? | Status here |
|---|---|---|---|---|---|
| MMD Tools 4.5.14 | https://extensions.blender.org/add-ons/mmd-tools/ (source https://github.com/MMD-Blender/blender_mmd_tools) | GPL-3.0-or-later | 784.9 KB | README table: "Blender 4.2-5.2" | not installed |
| VRM Add-on for Blender | https://extensions.blender.org/add-ons/vrm/ | GPL-3.0-or-later and MIT | 1.6 MB (4.7.2) | 4.3.0 manifest max 5.2.0; site marks 5.3+ unsupported | 4.3.0 installed, disabled |
| Retarget 5.2.0 (KBS-DEV, fork of Expy Kit + AnimAide) | https://extensions.blender.org/add-ons/retarget/ (source https://github.com/KBSBAUDRICE/Retarget) | GPL-3.0-or-later | 220.3 KB | "COMPATIBLE ONLY WITH BLENDER 5 AND HIGHER"; presets include Mixamo, Vroid, MMD | not installed |
| Rokoko Studio Live (retargeting is free) | https://github.com/Rokoko/rokoko-studio-live-blender | — | — | open issues #131 and #135 report retargeting errors on Blender 5.0/5.0.1; latest release v1-4-3 is from 2025-09-11 | not installed; skip |
| Built-in BVH / FBX / glTF importers | ships with Blender | GPL | — | yes | enabled |

All [M] from the pages and repos above, 2026-09-28.

**How the pieces fit** [S for tool behavior, I for the plan]:

1. **FBX and BVH sources (Quaternius, Mixamo, Bandai Namco, CMU BVH):** import with Blender's
   own importers onto their native armature.
2. **VMD sources (MMD):** MMD Tools can't apply a VMD straight onto a VRM armature. It matches
   bones by name (Bone Map modes: Renamed Bones / PMX / Blender), and an open MMD Tools issue
   (#72, "load .vmd motion onto VRM models") says supporting both is a large effort. MMD
   motions also assume an A-pose, and VRoid rigs are T-pose; MMD Tools has a "use pose mode"
   option for that. The workable route is: import the VMD onto a PMX mannequin (the 刀 set
   includes PMX models; any VRoid→PMX conversion also works), then retarget from there. [S]
3. **Retarget onto our VRoid-based armature** with the Retarget extension ("Bind to Active
   Armature", VRoid and MMD presets), bake, then remove constraints.
4. **Alter:** push key poses, add smear frames, hold contact frames, re-time to the frame
   budget, and adjust for a glaive (longer lever, two-handed grip, wider arcs).
5. Enable the existing VRM add-on (no download) before step 3. Installing MMD Tools and
   Retarget is listed in the batch; per the brief nothing is installed until Dex approves.

## Which source feeds which move [I]

A starting plan, not a lock. Everything gets re-timed and exaggerated to hit the wide AOE look.

| Move | Timing sources | Retarget base |
|---|---|---|
| M1 basic string | UAL2 Sword Regular A/B/C + recoveries; Bandai slash 001/002; 山辺 two-handed katana set; spinach slashes | UAL2 hits, widened for a glaive |
| M2 dash | UAL2 Sword Dash RM; Dolphin_664 glide dash; Bandai dash styles (feminine, active) | UAL2 Sword Dash |
| Q skill | ジュウ weapon twirl into attack; Mixamo Standing Melee Attack 360 High; MotionPackage spear sweep (if bought) | Mixamo 360 or UAL2 combo end |
| R ultimate | Mixamo Great Sword High Spin Attack; UAL2 Sword Attack Air Vertical and Attack Ground Pound; UAL2 Spell Simple; CMU 88 spin kick/flips for an aerial | UAL2 air vertical + ground pound, with a Mixamo spin before it |

## Download batch for approval

One list for Dex to approve in one go. Suggested landing folder:
`D:\Dex\Inbox\Downloads\dexplace-character-motion\`, never inside `D:\Dex\Projects\dex.place`
(the repo is public; see "After download" below).

### A. No sign-in needed (~78 MB total, plus one optional 92.5 MB zip)

| # | File | URL | Source | Size | License |
|---|---|---|---|---|---|
| A1 | `Universal Animation Library 2[Standard].zip` | https://quaternius.itch.io/universal-animation-library-2 | Quaternius (itch.io, $0 "name your price") | 17 MB | CC0 |
| A2 | `Universal Animation Library[Standard].zip` | https://quaternius.itch.io/universal-animation-library | Quaternius (itch.io, $0) | 15 MB | CC0 |
| A3 | `dataset-1_slash_normal_001.bvh` | https://raw.githubusercontent.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset/master/dataset/Bandai-Namco-Research-Motiondataset-1/data/dataset-1_slash_normal_001.bvh | Bandai Namco Research (GitHub) | 501,353 B | CC BY-NC 4.0 |
| A4 | `dataset-1_slash_normal_002.bvh` | same folder as A3 | Bandai Namco Research | 592,983 B | CC BY-NC 4.0 |
| A5 | `dataset-1_kick_normal_001.bvh` | same folder as A3 | Bandai Namco Research | 442,941 B | CC BY-NC 4.0 |
| A6 | `dataset-1_dash_normal_001.bvh` | same folder as A3 | Bandai Namco Research | 28,856 B | CC BY-NC 4.0 |
| A7 | `dataset-1_dash_active_001.bvh` | same folder as A3 | Bandai Namco Research | 108,310 B | CC BY-NC 4.0 |
| A8 | `dataset-1_dash_feminine_001.bvh` | same folder as A3 | Bandai Namco Research | 122,925 B | CC BY-NC 4.0 |
| A9 | `dataset-1_dance-short_normal_001.bvh` | same folder as A3 | Bandai Namco Research | 2,381,120 B | CC BY-NC 4.0 |
| A10 | `LICENSE` (dataset 1) | https://raw.githubusercontent.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset/master/dataset/Bandai-Namco-Research-Motiondataset-1/LICENSE | Bandai Namco Research | 19,346 B | — |
| A11 | `02_07.avi`, `02_08.avi`, `02_09.avi`, `88_04.avi`, `88_06.avi` (preview videos) | http://mocap.cs.cmu.edu/subjects/02/02_07.avi (same pattern for the others) | CMU (official) | 1,486,336 + 1,041,920 + 701,952 + 952,320 + 164,352 B (4.3 MB) | CMU terms |
| A12 | `cmuconvert-mb2-01-09.zip` (BVH, subjects 01 to 09, includes 02 swordplay) | http://codewelt.com/dl/cmuconvert/cmuconvert-mb2-01-09.zip | codewelt mirror of B. Hahne's cgspeed conversion | 33,755,687 B | CMU terms |
| A13 (optional) | `cmuconvert-mb2-86-94.zip` (BVH, includes 87/88/90 acrobatics) | http://codewelt.com/dl/cmuconvert/cmuconvert-mb2-86-94.zip | same mirror | 92,487,061 B | CMU terms |
| A14 | `ダム＆ディー武器回しモーション.zip` | https://bowlroll.net/file/62294 | BowlRoll, ジュウ (password: the video number) | 19.41 KB | modification/reuse OK (page) |
| A15 | `ダム＆ディー武器回しからの攻撃モーション.zip` | https://bowlroll.net/file/62565 | BowlRoll, ジュウ (password: the video number) | 24.46 KB | modification/reuse OK (page) |
| A16 | `ちょっとした格闘モーション１.zip` | https://bowlroll.net/file/68234 | BowlRoll, spinach | 314.87 KB | use freely (page) |
| A17 | `配布用刀モーション (2).zip` | https://bowlroll.net/file/88301 | BowlRoll, 山辺康夫 | 3.51 MB | readme only |
| A18 | `刀モーション2.0.zip` | https://bowlroll.net/file/148653 | BowlRoll, 山辺康夫 | 38.85 KB | readme only |
| A19 | `戦闘用にry).rar` | https://bowlroll.net/file/103142 | BowlRoll, Dolphin_664 | 177.39 KB | readme only |

BowlRoll pages load a reCAPTCHA script, and some older files need a BowlRoll sign-in. If a
CAPTCHA or sign-in appears, Dex has to click through it; agents stop there. [M, S, I]

### B. Needs Dex to sign in

| # | File | Where | Size | License |
|---|---|---|---|---|
| B1 | Mixamo FBX clips, "without skin", 30 fps: Great Sword High Spin Attack, Great Sword Slash, Standing Melee Attack 360 High, Stable Sword Outward Slash, Stable Sword Inward Slash, plus anything useful in the Great Sword pack | https://www.mixamo.com (Adobe ID) | unmeasured until signed in | Adobe royalty-free; no raw-file redistribution |
| B2 | AvatarSample_A VRM (VRM 0.0) | VRoid Hub page above (pixiv sign-in), **or** in VRoid Studio → Sample Models | about 15 MB (unofficial mirror) | VRoidPreset conditions |
| B3 | β Ver AvatarSample_1 VRM | VRoid Hub (pixiv sign-in); linked from https://vroid.pixiv.help/hc/en-us/articles/360012381793 | about 17 MB (unofficial mirror) | CC0 |

### C. Tools (installing is a separate yes)

| # | Item | Where | Size |
|---|---|---|---|
| C1 | MMD Tools 4.5.14 | https://extensions.blender.org/add-ons/mmd-tools/ | 784.9 KB |
| C2 | Retarget 5.2.0 | https://extensions.blender.org/add-ons/retarget/ | 220.3 KB |
| C3 | Enable the installed VRM add-on 4.3.0 (no download), or update to 4.7.2 | https://extensions.blender.org/add-ons/vrm/ | 0 / 1.6 MB |

### D. Purchase (only if Dex wants it)

MotionPackage Pro 第65弾 "剣", 第64弾 "必殺技", 第63弾 "ファンタジー" — ¥3,000 each on BOOTH (links above).

## After download: handling rules [I]

1. **Read every readme before using an MMD file.** If a readme forbids use outside MMD, use in
   games or web content, or modification, that file drops to timing only or gets deleted.
   Record the verdict next to the file.
2. **Raw motion files never go into the repo**: no FBX, BVH, VMD, VRM, PMX, or .blend files
   that hold third-party actions. Mixamo, MotionPackage and most MMD authors forbid
   redistributing them, and the repo is public. Keep them in the raw-art store outside git.
3. **Keep a credits file** for the site: Quaternius (optional, CC0), Bandai Namco Research
   (required: CC BY-NC plus paper citation), CMU (acknowledgment text), MotionPackage (required
   if bought), and each MMD author whose data we retarget.
4. **Keep the generative add-ons off** in any Blender session that touches this character.

## Open questions for Dex

1. **Donations vs "non-commercial."** Is dex.place non-commercial for Bandai Namco's CC BY-NC
   and Motion Actor's "personal use" terms? My view: yes while donations don't unlock anything,
   but it's your call. If no, drop #4 to timing-only.
2. **Buy MotionPackage Pro "剣" (¥3,000)?** It's the only professional polearm sweep and thrust
   we found with a clear license.
3. **Sign-ins:** Adobe ID for Mixamo and pixiv ID for VRoid Hub. Only you can do these.
4. **Base body:** OK to build from VRoid Studio's new-model base (recommended), or do you want
   the CC0 beta samples for the cleanest possible license?

## Sources checked (2026-09-28)

- Quaternius: itch.io pages for UAL1 and UAL2; quaternius.com pack pages; OpenGameArt UAL2 page.
- Mesh2Motion: app.mesh2motion.org explore list; github.com/Mesh2Motion repos (tree listing).
- Mixamo: helpx.adobe.com/creative-cloud/faq/mixamo-faq.html; Adobe Community "Mixamo FAQ -
  Licensing, Royalties, Ownership, EULA and TOS".
- Bandai Namco Research: GitHub repo README, dataset LICENSE files, commit history, GitHub API
  file listing.
- CMU: mocap.cs.cmu.edu home, FAQ and full motion list; codewelt.com/cmumocap; file sizes by
  HTTP HEAD.
- BowlRoll file pages and their message/contents API; Niconico video descriptions via
  ext.nicovideo.jp getthumbinfo; VPVP wiki "モーションデータ/運動系"; DeviantArt pages for
  Copyknight20.
- Motion Actor Inc.: YouTube channel description.
- MotionPackage: BOOTH item JSON for items 8304062, 8304050, 8304038, 8304076.
- VRoid: vroid.com/en/studio/guidelines; vroid.pixiv.help articles 4402614652569,
  4402394424089, 31627266179865, 360012381793; VRoid Hub AvatarSample_A page.
- Sketchfab: public API search and model endpoints.
- Blender: extensions.blender.org pages for MMD Tools, VRM, Retarget; MMD Tools README and
  releases; Rokoko issues #131 and #135; the local Blender 5.1.2 install (headless add-on
  probe).
- Other licenses: Ubisoft LAFAN1 README; Hugging Face KungfuAthleteBot card; Zenodo 100STYLE
  record; MoCap Online product and license pages.
