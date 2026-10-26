# Reference-only gacha models: proportion targets for Rosace's base

Researched 2026-09-29. Nothing was downloaded, bought or generated. Tags: **[M]** measured, meaning I
read it on the source page myself this session; **[S]** sourced, meaning it comes from a search
result or secondary page I did not open or could not render; **[I]** inference, meaning my own
reasoning. None of this is legal advice.

## The answer first

**Yes, two studios officially give out their character models: HoYoverse and Kuro. You still
shouldn't download them for this job.** HoYoverse covers Genshin, Star Rail, Zenless Zone Zero and
Honkai 3rd. Kuro covers Wuthering Waves and Punishing: Gray Raven. Both post MMD (PMX) files on
模之屋 / aplaybox.com through certified official accounts [M]. Every model page I checked carries the
same site rule flag, "Forbidden for use other than video production" [M]. Measuring a model to build
our own base is not video production. The per-model readmes also ban extracting parts for other
models, commercial use and redistribution [M]. Kuro's readmes go further and ban any use "涉及到金钱交易"
(involving money transactions) [M]. dex.place has a donate button, so that clause is uncomfortable
[I].

**So get the numbers from images, not files.** Measure proportions from official 2D full-body art
and from screenshots Dex takes himself (in-game or from the aplaybox preview video). Write down only
ratios in head units, average them across several characters, and apply the averages to our own
base. None of their pixels or vertices enter the repo or any .blend file [I]. A ratio like "legs are
52% of height" is a measurement of a design, not a copy of it. Averaging over five or more characters
also keeps Rosace from matching any one of them [I].

## 1. Who officially distributes models, and on what terms

### 1.1 HoYoverse (miHoYo): Genshin, Star Rail, ZZZ, Honkai 3rd

- **Where:** aplaybox.com, one official account per game. The Genshin account "原神" is at
  `https://www.aplaybox.com/u/680828836` [S for the URL; M for the account name shown on model pages].
  Star Rail models appear under the account "崩坏：星穹铁道" and ZZZ under "绝区零" [M]. Honkai 3rd
  models are reported under the uploader 神帝宇 [S].
- **Cost / size:** free to download, but it needs an aplaybox account, reportedly registered with a
  phone number [S]. Some pages also add "Follow Requirement / Follow the creator" and like/favourite
  download gates [M]. File size is not shown on the page before login [M]. I did not create an account
  (not allowed in this task, and Dex would have to do it himself).
- **Terms, Genshin Lumine page** (`https://www.aplaybox.com/details/model/fyxu1HgyD14n`, reposted
  2023-10-18) [M]. The readme text in Chinese:
  - allowed: "允许完善物理，修正模型权重、表情等bug", "允许改色，适度更改衣装，添加spa、toon等" (fix physics,
    weights and expression bugs; recolour, moderately change the outfit, add sphere/toon maps)
  - forbidden: "请勿二次配布，以及拆取部件以用于改造其他模型" (no redistribution, no taking parts to
    build other models); "请勿用于18禁作品，极端宗教宣传，血腥恐怖猎奇作品，人身攻击等"; "请勿用于商业用途" (no commercial use)
  - "模型提供：miHoYo", "模型改造：观海", "最终解释权归属：miHoYo" (miHoYo has the final interpretation)
  - site sidebar "Distribution rules": "Commercial use is prohibited", "Secondary distribution is
    prohibited/ok", "Allows modification of the model", "Need complete credit list / no need credit",
    "Forbidden for use other than video production"
- **Terms, ZZZ Jane page** (`https://www.aplaybox.com/details/model/GHalX64frEcm`, 2024-09-05) [M]:
  the same readme word for word, credited "模型制作：观海子", final interpretation miHoYo. The sidebar has
  the same five flags, including the video-only one.
- **Terms, Star Rail 绯英 page** (`https://www.aplaybox.com/details/model/PTcyIsdGqdY3`, 2026-04-21)
  [M]: "允许改造，优化骨骼和刚体，重制UV" (edits, bone/rigid-body work and UV rebuilds allowed), "请勿二次配布",
  the same content bans, "请勿用于商业用途", "模型版权所属miHoYo". The sidebar has the same five flags.
- **HoYoverse's global fan-creation guides.** These are written for the global game versions and
  say they do not apply to the mainland-China versions. The aplaybox files are mainland-China
  distributions, so the per-model readme above is the governing text for those files [I].
  - *Honkai: Star Rail Fan Creations Guide v1.0*, `https://www.hoyolab.com/article/17883171` [M], and
    *Zenless Zone Zero Fan Creations Guide v1.0*, `https://www.hoyolab.com/article/30075725` [M]. Both
    have the same structure. Rights "include, but are not limited to, music, original artworks, and
    models." Fan creation is allowed "for non-commercial personal use", with the notice "© All rights
    reserved by miHoYo" plus a set Legal Statement. They say this is not a licence: rights "are not
    transferred to you… nor shall they be deemed as licenses". They will act against "Extracting…
    or copying and selling official materials (including original paintings, models, CGs…)". Garage
    kits made "by making use of or making references to official graphics" are allowed for free
    display and gifting only.
  - *Genshin Impact Overseas Fan-Made Merchandising Guide*, `https://www.hoyolab.com/article/381519`
    [M]. It defines "Official source materials include original game material, official promotional
    material, official models, official CG…". It covers merchandise only. It does not grant model use.
  - The video rules ban "commercial donations" on in-game-footage content [S, quoted on a fansite,
    yaoyaoguides.com/legal.php]. I did not see this on an official page.

### 1.2 Kuro Games: Wuthering Waves, Punishing: Gray Raven

- **Where:** the aplaybox account "鸣潮", certified "鸣潮官方账号", `https://www.aplaybox.com/u/811099367`
  [M]. It shows 176 works, the latest being 【鸣潮】锁暝 posted 2026-09-24 [M]. PGR models are on
  aplaybox credited "模型提供：战双帕弥什" [M].
- **Cost / size:** as above. Free, account needed, size not shown [M/S].
- **Terms, WuWa Jinhsi** (`https://www.aplaybox.com/details/model/JueNdBobuslM`, 2024-09-18) and the
  **newest, 锁暝** (`https://www.aplaybox.com/details/model/LT6BGB9ola9l`, 2026-09-24) [M]. The
  readme is in Chinese, Japanese and English and is identical in substance across the two:
  - forbidden: "Redistribution"; "商业使用以及任何涉及到金钱交易的使用" (commercial use *and any use
    involving money transactions*); R-18, political, religious and crime use; insulting people or
    countries; "Deceiving/Claiming to be the original creator"
  - editing: "Allowed to edit, but it can't be edit out of the character. Anyway, Redistribution is not
    allowed." The Japanese version adds "このモデルの一部を別モデルに移植不可" (no transplanting parts of
    this model into another model)
  - "The final copyright of this model material belongs to Guangzhou Kuluo Technology Co"
  - site sidebar: "Commercial use is prohibited", "Model modification is prohibited", "Forbidden for use
    other than video production"
  - A Q-version Rover readme reportedly also forbids "uses other than MMD videos" in its own text [S].
- **Terms, PGR 21号·XXI** (`https://www.aplaybox.com/details/model/VLdKrgCnHlNX`, 2021-06-21) [M]:
  the same wording as the miHoYo/观海 readme, with "最终解释权归属：战双帕弥什". The sidebar has the
  video-only flag.
- **Kuro's global fan rules:** *Guidelines for Derivative Works of Wuthering Waves*,
  `https://wutheringwaves.kurogames.com/p/en/produce.html` [M]. Derivative works are "independent new
  works re-created by derivatives creators with reference to Authorized Contents in the forms of
  literary works, pictures, videos or material objects etc., with the exception of games (material or
  digital), software and commercial works/merchandises". dex.place is a game/software, so it falls
  outside this permission even as a fan work [I]. Rosace is not a fan work anyway. The guidelines say
  nothing about donations or 3D model reuse [M].

### 1.3 Others checked

| Studio / game | Official models? | Status |
|---|---|---|
| Hypergryph / Gryphline: **Arknights: Endfield** | None found. Endfield models on aplaybox, DeviantArt and Sketchfab are fan conversions or rips [S]. There is a creator program page (`endfield.gryphline.com/special/creators-application/en-us`) but no public fan-creation guide [S]. | Don't use rips at all. Use official 2D art only (section 3). |
| Hotta Studio: **Tower of Fantasy** | Official free MMD models announced by the JP account and the global news site [S]. | Terms not verified. Not needed. |
| Seasun: **Snowbreak (尘白禁区)** | Listed as a certified official account on aplaybox [S]. | Terms not verified. |
| Yostar: **Blue Archive** | `bluearchive.jp/MMD` exists, but the page rendered blank for me [M]. Most circulating models are fan-made or reportedly ripped [S]. | Unverified. |
| Cygames **Uma Musume**, Bandai Namco **Gakumas** | No official models found. Fan models only [S]. | Out. |
| Konami (LAUGH DiAMOND), Nexon (HIT: The World) | Official MMD terms exist and limit use to MMD only [S]. | Not gacha-action style. Out. |

**The common rule [M, across every official page read]:** no redistribution, no commercial use, no
reusing parts in another model, and aplaybox's "video production only" flag. Nothing grants reference
or measurement use explicitly. The strictest honest reading is that downloading a PMX to measure it
for a game base is outside what they permit [I].

## 2. Method: measuring proportion targets without touching their meshes

### 2.1 Hard rules

1. Their files never enter `D:\Dex\Projects\dex.place`, any git repo, or any .blend that becomes or
   touches our base. That includes loading one as a background underlay [I, from the parts-extraction
   and video-only clauses].
2. Default route: **measure from images only** (2.2). The PMX route (2.4) is listed so Dex can make an
   informed call. My recommendation is not to use it.
3. Record **numbers only**, as ratios in head units (H = skull top to chin). Screenshots used for
   measuring stay outside the repo (for example `D:\Dex\Scratch\proportion-refs\`, not shipped). If
   refs must be kept, keep them in the non-shipped `review/refs` convention with a source line [I].
4. Average **at least 5 characters** from at least 2 games per target. Never take a whole
   silhouette from one character [I].

### 2.2 Image route (recommended)

**Sources:** official full-body key art on the game sites (section 3); screenshots Dex takes in-game
(character/party screen, photo mode with a long lens); frames from the aplaybox "Model display"
preview video, which is watched in the browser and not downloaded [M: every model page has one].

**Getting usable views:**
- Use front and side views as close to orthographic as possible. In photo modes, zoom the camera in
  from far away (long focal length) so perspective foreshortening stays small. Reject any shot where
  the feet look noticeably smaller than the head [I].
- Use a neutral standing pose. Reject contrapposto shots for width measurements; use them only for
  heights.
- The head must be level. If the image is rotated, rotate it back so the vertical line from the
  crown to between the feet is plumb.

**Landmarks and what to measure.** Every value is divided by H.

| # | Measure | View | Landmarks |
|---|---|---|---|
| 1 | Total height / H ("heads tall") | front | skull top (under the hair volume) to sole, barefoot or shoe-sole corrected |
| 2 | Neck length | side | chin to the suprasternal notch (collarbone dip) |
| 3 | Shoulder width | front | outer edge of the deltoid, left to right |
| 4 | Bust width / depth | front / side | widest point at the bust line; side view: back plane to bust apex |
| 5 | Underbust width | front | just below the bust |
| 6 | Waist width / depth | front / side | narrowest point of the torso |
| 7 | Hip width / depth | front / side | widest point at the greater trochanter (upper thigh); side: glute apex to front |
| 8 | Crotch height (leg length) | front | crotch to sole, as a fraction of total height |
| 9 | Knee height | front | kneecap centre to sole |
| 10 | Thigh gap | front, feet at hip width | gap at mid-thigh and just under the crotch (0 = touching) |
| 11 | Hand length | front, open hand | wrist crease to middle fingertip |
| 12 | Foot length | side | heel to toe tip |
| 13 | Arm length | front, arm down | shoulder point to wrist crease; also note where the fingertips land against the thigh |

Derived ratios to report: shoulder:waist:hip (widths), waist-to-hip, bust depth to waist depth, and
legs as a percentage of height.

**Pixel procedure [I]:** measure in any image tool or a small Python/PIL script at the source image's
native resolution. Aim for H ≥ 80 px; below that the error on narrow measures such as the neck and
thigh gap gets too big. Take each value twice, on two different images of the same character, and
keep the mean. Flag it if the two readings differ by more than 5%.

**Error budget [I]:** at H ≈ 100 px, a 2 px landmark uncertainty is ±2% of H. That's fine for
height and widths, but marginal for the thigh gap and neck. For those two, report a range, not a
point.

### 2.3 Recording sheet (numbers only, no images)

```
character | game | source (URL or "Dex screenshot, date") | view | H px | heads-tall | neck/H | shoulder/H | bust W/H | bust D/H | underbust/H | waist W/H | waist D/H | hip W/H | hip D/H | crotch/height | knee/height | thigh gap (mid, top)/H | hand/H | foot/H | arm/H | notes
```

Put the finished table in a sibling doc (e.g. `BASE-OPTIONS/proportion-targets.md`) with per-game
means and an overall mean ± spread. That table is the thing we apply. No reference image is.

### 2.4 PMX route (listed for completeness, not recommended)

What it would take: Dex registers on aplaybox, downloads a PMX, opens it in a throwaway Blender
scene with mmd_tools, reads bounding boxes and vertex-group extents at the rest pose with a script,
records the numbers, and deletes the file. It is more precise than images (true orthographic
widths and depths), but it is a use "other than video production" under the aplaybox flag [M], and
Kuro's ban on money-involving use is a bad fit next to a donate button [M]. Also, the files are fan
edits (观海 / 观海子 / 1010浣 credits) rather than raw game meshes [M]. Commenters on the Lumine page
note the neck is too long ("脖子太长了") and that heights differ between models [M, user comments,
not official]. So even the precise route measures an edit, not the shipped game character. Verdict:
**don't**. The image route gives the proportions people actually see in the game, which is what
we're matching [I].

### 2.5 Applying the numbers to our base [I]

- Convert each mean ratio into a target in Blender units for our base at its own height, then drive
  it with bone scales plus our own shape keys (shoulder, bust, waist, hip, thigh, neck, hand) on the
  base we author or license separately (see the sibling BASE-OPTIONS docs).
- Check against the 144 px targets already in `docs/character/DESIGN.md` section 2: 6 heads, legs
  52% of height, and three-quarter shoulders/waist/hips of 27/15/24 px with a 24 px head. That's
  1.13 H / 0.63 H / 1.00 H in three-quarter view [M, arithmetic from DESIGN.md]. Three-quarter widths
  are not front widths. Convert by rendering our base in both views rather than guessing a factor.
- Push the stylised extremes up to about the spread's upper bound, not past it. Where the gacha
  means come out more exaggerated than DESIGN.md's table, raise it to Dex as a decision instead of
  silently changing the canon.

## 3. 2D proportion references usable the same way (measure only, nothing ships)

| Source | What it gives | Terms / cost | Tag |
|---|---|---|---|
| Official character pages: `genshin.hoyoverse.com`, `hsr.hoyoverse.com`, `zenless.hoyoverse.com/en-us/character`, `wutheringwaves.kurogames.com`, `endfield.gryphline.com` | full-body key art per character, all drawn by the studio at a consistent style | viewing is free; HoYoverse guides allow non-commercial fan use with notice, but we only take numbers | URLs [S]; guides [M] |
| aplaybox "Model display" preview videos | the official model turning or dancing, near-neutral frames available | watched in the browser, not downloaded; the same video-only rule governs the file itself | [M] |
| Dex's own in-game screenshots (photo mode, character screen) | the best front/side control of any 2D source | ZZZ/HSR guides allow screenshots for non-commercial personal use [M]; we keep them private and record numbers | [M]/[I] |
| *Genshin Impact: Official Art Book Vol. 1* (Harper Design, ISBN 9780063303690, 176 pp, covers up to v1.6) | "character designs", but whether it has turnarounds is **unconfirmed** | about US$21 at Walmart; eBay $40–58; hoyo.global listing shows about $59.99 (unclear which edition) [S]. Vol. 2 and 3 exist [S]. Not bought. | [S] |
| Kuro 库街区《鸣潮》影像收录 (official image archive, cited by Moegirlpedia) | official design images; best bet for WuWa design sheets | free to view; terms not checked | [S] |
| HoYoLAB "[Official Artworks] Character setting sheet" (`hoyolab.com/article/4060947`) | was a setting-sheet post | **removed**: the page now shows "There's nothing here..." | [M] |
| Creative Uncut (`creativeuncut.com/art_genshin-impact_a.html`, `..._wuthering-waves_a.html`) | aggregated official concept art and art-book scans | third-party repost, not a licence source; view only | [S] |

## 4. Limits of this pass

- File sizes weren't visible without login, and prices were only needed for the art book, so
  neither is fully pinned down.
- I did not verify the Tower of Fantasy, Snowbreak or Blue Archive terms. Tower of Fantasy and
  Snowbreak have official models [S]; Blue Archive's is unconfirmed. None of the three is needed for
  the image route.
- No proportion numbers are measured yet. Section 2.3 is the sheet; the measuring pass is the next
  task and needs Dex's screenshots or the image sources above.
