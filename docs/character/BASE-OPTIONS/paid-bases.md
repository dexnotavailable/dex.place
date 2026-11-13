# Paid anime base meshes: BOOTH, Gumroad/Superhive, RenderHub, Reallusion

**Short answer.** Yes, there are paid alternatives to VRoid, but almost nothing on the market
gives a real set of "bust / waist / hip" sliders together with gacha-grade anime appeal and
a licence that clearly covers game sprites. The two routes worth trying:

1. **A KUYUYU/電脳屋 or 100円外務省 BOOTH avatar** (龍のヨルちゃん ¥8,000, ヘルベチカ ¥6,000,
   アストラル ¥6,500, 水鏡こよみ ¥8,000). These are hand-built VRChat avatars with a much less
   generic figure than VRoid. Unusually for BOOTH, their own terms say in plain words that game
   use is allowed. Their body shape keys are few: chest large/none/push-up, thigh thick/thin,
   shoulders. The hourglass still needs your own edits.
2. **Reallusion Character Creator 5** ($299) **+ the ToKoMotion "CC4 Anime Base Morphs Vol.01"**
   pack ($75 list). This is the only paid option with real body-proportion sliders. The licence
   is clean once you have a Standard (exportable) licence. The catch: realistic CC topology and
   shading, Windows only, and a heavy pipeline for a sprite that ends up 144 px tall.

Also worth knowing: **Body Type Generator Pro** (Superhive, $34.99 personal / $59.99 commercial)
is a Blender add-on, not a base. It builds waist/hip/chest/glute "zones" and bakes them into
named shape keys on *your own* mesh. That fixes "generic VRoid ratios" without changing base.
The free CC-BY "Genshin Style Anime Female Base Mesh" (David Onizaki) already ships bust and hip
shape keys. It is the free-lane answer and is listed here only for comparison.

Nothing was downloaded or bought for this document. No images were generated.

Tags, as in `DESIGN.md`:

- **[M]** measured: the figure was read directly off the source page's raw text or API (scraped
  page text, BOOTH item JSON, Sketchfab API), or computed here.
- **[S]** sourced: stated by a source that summarises the page for me (WebFetch or a search
  snippet), without my own check of the raw text. Weaker than [M].
- **[I]** inference or recommendation.

Pages checked on 2026-09-29. Prices and terms change, so re-read the page before buying.

---

## 1. What "fit for 144 px" means here

`DESIGN.md` section 2 sets the target silhouette at 144 px tall: about 6 heads, and
**shoulders / waist / hips = 27 / 15 / 24 px** in three-quarter view ("a clear hourglass") [M,
read from DESIGN.md]. Put another way: waist width is 62% of hip width and about 10% of her
height. At 144 px, one pixel is 0.7% of her height [M, arithmetic].

What that means for a base [I]:

- **The waist and hip width are what the sprite shows.** A few percent of bust volume is a
  1 px change, visible mostly in side and three-quarter profile. Waist pinch, hip width, thigh
  mass and leg length change the outline. A base "has good ratios" if its three-quarter render
  at 144 px, before any 2D pass, is close to 27 / 15 / 24.
- **Polycount doesn't matter** at this size. 20k and 130k both render fine to 144 px. What
  matters is a clean `.blend` or FBX with a standard humanoid armature for the existing
  Blender → pixel pipeline.
- **The face barely matters for the sprite.** At 144 px the head is about 24 px, and the face
  is redrawn by the 2D construction pass anyway. The face only matters for the cut-in bust
  (about 3x head size, DESIGN.md "cut-in").
- **Acceptance test for any candidate:** render an orthographic three-quarter view at 144 px,
  count shoulder / waist / hip px, and compare to 27 / 15 / 24. Then compare against the current
  VRoid restyle rendered the same way. This is cheap, and it replaces "it looks generic" with a
  number.

---

## 2. The licence trap: VN3

Most popular BOOTH avatars use the **VN3 licence** template. Its conditions are lettered items
that each creator sets to allowed, not allowed, or "ask us" [M, vn3.org/icons]. The item that
decides dex.place is:

- **R: 「製品開発等のためのソフトウェアへの組み込み」** (building it into software, games
  included) [M, vn3.org/icons item list].

On the VN3 avatars I checked (サフィー, ルフィナ, ルリエ from 仮想VoidCat), R is set to
**"Please contact the Licensor(s)"** [M, page text]. So by default you need permission first.
VN3's default "use" covers personal expression such as commemorative photos and posting them
online [M, vn3.org/terms commentary]. A web game that ships sprite sheets goes well beyond that
[I]. **Rule: a VN3 avatar is out unless its R item says allowed, or you have written
permission.** The candidates below were chosen because their own text grants game use, not
because of VN3.

The donate button doesn't change any verdict below. Every licence I recommend allows
commercial use outright, so whether dex.place counts as for-profit never comes up [I].

---

## 3. Candidates

### A. KUYUYU/電脳屋: 龍のヨルちゃん, ヘルベチカ, アストラル (BOOTH), recommended to try

- **URLs:** https://booth.pm/ja/items/3923094 (ヨルちゃん), https://booth.pm/ja/items/5405062
  (ヘルベチカ), https://booth.pm/ja/items/1490378 (アストラル)
- **Price:** ¥8,000 / ¥6,000 / ¥6,500 [M, item JSON / page]. File size: not listed on the page.
- **Formats:** FBX, Unity prefabs, PNG textures (ヨルちゃん says "PSD無し", so no PSD); lilToon
  shader [M]. No `.blend` listed. Import the FBX into Blender [I].
- **Polys:** ヨルちゃん "約104000", ヘルベチカ "約93000", アストラル about 63,000 with all
  clothing [M].
- **Rig:** VRChat humanoid with PhysBones; chest bones [M]. They share a common base body,
  "A1XBody" (the other version is "B01Body") [M].
- **Body shape keys (ヨルちゃん):** chest (large, none, push-up, NSFW); thighs (for tights
  texture, thick, thin); per-part hide keys; shoulder and chest keys added 2025-09-21; a
  sloped-shoulder key added 2025-11-07 [M]. **No waist or hip key is listed** [M].
- **Licence (quoted, ヨルちゃん special terms; ヘルベチカ and アストラル carry the same
  clause):**
  - 「その他アプリケーション、ゲーム、動画配信等でもご利用頂けます。」
  - English version on the page: in-game use in "softwares, videos, or games, and distributing
    the software, video, and games, whether it's paid or free: Allowed"
  - Exception: not allowed if the release contains data "that can be used again as model data"
  - "Commercial use: Allowed"; "Redistribution: Not allowed" [M, page text]
  - Pixel sprites cannot be turned back into model data, so dex.place is inside this [I].
- **Fit [I]:** The best licence-plus-appeal combination found on BOOTH. It's a dragon-girl
  design, so strip the horns and tail, and budget time to take her out of Unity/lilToon. Chest
  and thigh keys help, but the waist-to-hip pinch still has to be hand-sculpted or added with
  Body Type Generator Pro (D).

### B. 100円外務省: 水鏡こよみ, 若姫ひつく (BOOTH), recommended to try

- **URLs:** https://booth.pm/ja/items/3664061, https://booth.pm/ja/items/4726958
- **Price:** ¥8,000 each [M]. File size: not listed.
- **Formats:** Humanoid avatar. **`.blend` and PSD included** (「blendファイル、PSDファイル同梱」)
  [M, こよみ].
- **Shape keys (こよみ):** "Face 188個 Body29個"; body-hide keys for outfit swaps; a
  masculinising key [M]. The 29 body keys are not itemised on the page, so it is unknown
  whether they include bust, waist or hip.
- **Licence (quoted, こよみ):**
  - 「ゲーム制作や動画配信その他での商用利用も可です。」
  - Redistribution and public-avatar use are forbidden [M, page text]
  - ひつく's page carries the same game-production line [M]
- **Fit [I]:** The only gacha-grade BOOTH avatar found that ships a `.blend`, which makes it the
  easiest drop-in for the Blender pipeline. Before buying, ask the author (contact on the page)
  for the list of the 29 body keys.

### C. Reallusion Character Creator 5 + ToKoMotion anime morphs, the slider route

- **URLs:** https://www.reallusion.com/character-creator/,
  https://www.reallusion.com/contentstore/pack/character-creator/3d-character/cc4-anime-base-morphs-vol-01,
  https://www.reallusion.com/license/content.html, https://www.reallusion.com/Content/EULA/EULA.htm
- **Price:**
  - CC5 $299 perpetual; CC5 Deluxe $479 (includes "HD Ultimate Morphs") [S, WebFetch of the CC
    page]. CG Channel (Jan 2026) also reports a subscription option at $29/month or $99/year
    [S, search snippet].
  - Anime Base Morphs Vol.01: $75 list, shown at $52.50 on sale [S]. Requires "CC v4.30 or
    above"; contains 5 head morphs and 5 full-body morphs ("from Chibi, to cute girls, fit guys
    and mysterious women") [S].
  - File sizes: not listed.
- **Formats / rig:** FBX with rig and morphs, OBJ, USD. There is a free "Auto Setup for Blender"
  add-on (open source, soupday/cc_blender_tools) [S]. The CC base mesh is realistic-human
  topology with a full body and facial rig [I].
- **Proportion controls:** CC's morph system is slider-based, with the body split into parts
  [S, CC4 manual]. Named bust, waist and hip sliders come mainly from the paid "Ultimate Morphs"
  pack [S].
- **Licence (quoted):**
  - Standard licence: "Export content to any external software or game engine"
    [M, license/content.html]
  - Content EULA: derived creations may be sold "for use in commercial games, AR/VR projects and
    interactive services" [M, EULA text]
  - The cheaper **iContent** tier is render-inside-Reallusion only. Exporting it to FBX/OBJ
    "requires the acquisition of a Standard License" [M]. Blender rendering needs export, so
    **buy Standard, not iContent** [I].
  - A Standard licence covers one character for commercial games when CC Components are used
    [M, license page]. That's fine for Rosace [I].
- **Fit [I]:** The strongest proportion control, and the most expensive and slowest. The CC look
  is Western-realistic at heart, so gacha appeal would come from the anime morph pack plus the
  existing Blender toon/pixel pass. Worth it only if Dex wants a slider body he can re-tune
  forever. For one 144 px heroine it is probably overkill.

### D. Body Type Generator Pro (Superhive add-on), fixes ratios on any base

- **URL:** https://superhivemarket.com/products/body-type-generator-pro--smart-anatomy-markers--shape-keys--blender-4
- **Price:** Personal $34.99, Commercial $59.99, Studio $139.96 [S, WebFetch]. Blender 3.5–5.x
  [S].
- **What it does:** 19 anatomy markers, 17 weighted body zones, 28 custom sliders, and presets
  including a female "Anime" preset. Results become named shape keys, and the original Basis
  "remains unchanged" [S]. You can weight a single zone, for example hips at 1.8 for a curvier
  result [S].
- **Licence:** listed as GPL (add-on code) [S]. The page has no separate text about output
  meshes. Your own mesh stays yours; GPL covers the add-on's code [I].
- **Fit [I]:** The cheapest direct answer to "VRoid ratios are generic". Run it on the current
  CC0 VRoid restyle, or on candidate A/B, and bake "waist pinch" and "hip width" keys until the
  144 px render hits 27 / 15 / 24. The Personal tier is enough for a personal, not-for-profit
  site. Check Superhive's tier wording before buying if the donate button worries you.

### E. Minimoku "Anime Female Base Mesh" (Gumroad / Superhive / Fab), clean but generic

- **URLs:** https://minimoku.gumroad.com/l/anime_female_basemesh,
  https://superhivemarket.com/products/anime-female-base-mesh
- **Price:** $25 on Gumroad [M, page JSON]. $29 on Superhive [S]. **97.2 MB** [M, Gumroad].
- **Formats:** `.blend`, `.fbx`, `.obj`, `.unitypackage`, 4K PSD+PNG textures [M].
  20,448 polygons / 20,851 vertices [M].
- **Rig:** "Humanoid Rig" [M].
- **Shape keys:** 151 keys: ARKit52, visemes, MMD, facial expressions, and "body shrink" [M].
  **No bust, waist or hip keys** [M].
- **Licence (quoted):**
  - "Commercial use is allowed — including VTubing, streaming, and video content"
  - "Do not redistribute or resell the files"
  - It also bans NFT and AI-training use [M, page text]
- **Fit [I]:** A clean licence and a clean Blender file, but the body is a neutral base, much
  like VRoid in spirit. It only helps paired with D.

### F. Sculpt-starter "素体" bodies (BOOTH), cheap, licence-clean, no appeal built in

None of these has proportion shape keys or a finished anime head. They are anatomy starting
points for a hand sculpt.

| Item | Price | Polys / formats | Licence quote (short) | Tag |
|---|---|---|---|---|
| TOY-BOX 女性アバター素体ボディ Ver.15 https://booth.pm/ja/items/970356 | ¥300 | High △47,012 / Low ≈△11,714; blend, fbx, obj; provisional armature | 「商用・非商用問わずご利用可能です」; only ban: 「未加工での再配布・販売を禁じます」 | [M] |
| アスパラ製作所 素体ちゃん https://booth.pm/ja/items/5628752 | ¥2,000 (sale; variants ¥700 / ¥4,000 shown) | High △32,356 / Low △8,062, **no head**; Blender, FBX; Unity Humanoid bones | 「当素体を利用、改変、一部流用をして商用利用も可能です」 | [M] |
| Jackcg 素体モデル【MMD】 https://booth.pm/ja/items/3319346 | ¥3,000 female (set of 3 ¥8,500) | female 14,714; ma, obj, fbx, pmx; 4K textures; bones and weights | allows 「画像・映像・配信・ゲーム制作」; asks that game data not be easy to extract | [M] |
| いちのみ屋 女性素体 https://booth.pm/ja/items/1655262 | ¥500 (free trial torso) | △28,612; blend, fbx; minimal VRC bones | 「商用利用可」; no resale of the base itself | [M] |
| IotzheiG 3D人型モデル用素体 https://booth.pm/ja/items/1926175 | ¥500 | △6,502; FBX, Blend; simple Humanoid bones; sex not stated | 「改造データのゲーム利用や販売などの商用利用も可能」 | [M] |
| Leo_3D 女性のベースメッシュ https://booth.pm/ja/items/7917286 | ¥100 | 29,927; FBX, Blender 5.0.1 | lists games; 「商用利用：可」「再配布：不可」 | [M] |

**Fit [I]:** Jackcg has the clearest wording for images plus games. TOY-BOX is the best-known
sculpt base. Neither beats "restyle what we have and add D" unless Dex wants to hand-sculpt a
body from scratch.

### G. Checked and not recommended

- **QuQu Peke / U / PekeBody** (https://booth.pm/ja/items/3686641 ¥1,500,
  https://booth.pm/ja/items/2736146 ¥1,500, https://sonovr.booth.pm/items/5860965 ¥3,000):
  - The licence is fine: 「商用利用可 ゲーム、動画配信等にもご使用いただけます」 [M]
  - PekeBody's keys are shrink keys plus "Big", "Smal" and "yosete" (chest push-together) [M],
    and it comes without a head [M].
  - [I] Chibi/child-leaning proportions; wrong body type for Rosace.
- **仮想VoidCat サフィー / ルフィナ / ルリエ** (https://booth.pm/ja/items/3939858 ¥5,480, 130 MB
  [M]; 4670579; 7427949):
  - Strong appeal, and サフィー lists 35 body blendshapes [M]
  - But VN3 item R is "Please contact the Licensor(s)" [M]. Only with written permission.
- **ポンデロニウム研究所 しなの** (https://booth.pm/ja/items/6106863, ¥6,000 / ¥3,000 variants):
  - 46 body shape keys (including hip shrink keys) [M]
  - VN3, with the full terms in a Google Drive PDF that I couldn't read. The R setting is
    unverified, so treat it as "ask" (permission form on the page) [I].
- **ひゅうがなつみかん 京狐 / 沙猫 / ルーナリット** (1826902, 2322146, 4063740):
  - The page says 「VRM、ゲーム、動画配信等にもご使用いただけます」 [M], but the terms are
    VN3 and I didn't read the R value. Also, the "shape key for more flesh" (肉付き) is a single
    key [M].
  - Resolve the conflict with the author before relying on it [I].
- **Kasugay "3 Anime Female Base Mesh Pack"** (RenderHub, https://www.renderhub.com/kasugay/3-anime-female-base-mesh-pack):
  - $15, 93.1 MB, 18,491 polys, `.blend` + `.glb` [M]
  - Extended Use Licence, which bans passing the asset to third parties unless it becomes "part
    of a larger Creation" [M, renderhub.com/info/3d-content-licensing]
  - Face keys only ("24+ facial shape keys") [M]. Generic.
- **xivxiy "Full Body Female Base"** (https://xivxiy.gumroad.com/l/animefullfemalebase):
  - $20 [M]; "Commercial usage is allowed!" with required credit [M]
  - Butt and breast physics bones, but no proportion keys [M]. Ships NSFW textures [M].
- **Sepio/yenyayka "Female Anime Style Body Base"** (€8, 5.14 MB, 7 unnamed shape keys, FBX)
  [M]: the licence is only "Do not re-sell or modify and sell my files" [M]. Too thin to rely
  on.
- **Menglow "Anime Female Base Mesh Age Kit"** ($30, 156 MB): the ages are "4, 8, 12 & 16"
  [M]. Wrong body type; excluded.
- **ArtStation "Anime Character Basemesh v12.0"**: ArtStation blocked both the fetch and the
  browser, so the page is unverified. ArtStation's stock Standard licence is reported as "one
  commercial project (up to 2,000 sales or 20,000 views)" [S, search snippet]. A reviewer
  reportedly asked for more body shape keys [S]. Skip unless it can be verified.
- **Fab listing of Minimoku**: Fab returned 403. Fab's Standard licence is reported to allow use
  outside Unreal and in commercial projects, except "UE-Only" assets [S]. Buy via Gumroad
  instead, where the licence was read [I].

---

## 4. Recommendation [I]

1. **Cheapest real fix (about $35):** Body Type Generator Pro on the current CC0 VRoid restyle.
   Bake waist-pinch and hip-width keys. Pass test: 27 / 15 / 24 px at 144 px. Keeps every
   licence question answered (CC0 base).
2. **If the VRoid body still reads "generic" after that:** buy 水鏡こよみ (¥8,000, ships a
   `.blend`, game production explicitly allowed) or 龍のヨルちゃん (¥8,000, explicit
   game-distribution clause). First ask the こよみ author for the body-key list. Run the same
   144 px measurement, then apply D on top if the waist-to-hip pinch is short.
3. **Only if Dex wants a permanent slider figure for many characters:** CC5 Standard + ToKoMotion
   anime morphs (~$375 list). Buy Standard (exportable), never iContent.
4. **Never** use a VN3 avatar whose R item says "contact" or "not allowed" without written
   permission, however good the figure is.

## Sources

- BOOTH item pages and `https://booth.pm/ja/items/<id>.json`, read 2026-09-29 (IDs above)
- VN3 item list: https://www.vn3.org/icons ; commentary: https://www.vn3.org/terms
- Reallusion: https://www.reallusion.com/license/content.html ,
  https://www.reallusion.com/Content/EULA/EULA.htm , https://www.reallusion.com/character-creator/ ,
  CC4 Anime Base Morphs Vol.01 store page (URL above)
- Gumroad product pages (Minimoku, Menglow, xivxiy, yenyayka, nathahniel), page JSON
- RenderHub product page and https://www.renderhub.com/info/3d-content-licensing
- Sketchfab API for the Onizaki base: licence "CC Attribution", 32,040 faces / 16,584 vertices,
  description lists shape keys for "arms, legs, bust, hips, neck, shoulders, and face" [M]
- Superhive product pages (Body Type Generator Pro, Minimoku) via WebFetch [S]
