# MMD / anime base-body search for Rosace

Researched 2026-09-29. Nothing was bought, no account was used, no model file was downloaded,
no image was generated. Tags as elsewhere in `BASE-OPTIONS`: **[M]** read by me on the source
page (raw BOOTH item JSON, raw HTML, or the PDF); **[S]** from a search summary I did not
re-read myself; **[I]** my inference. Not legal advice.

## Ranking (2026-09-29, after run 2)

**Plainly: nothing has passed yet.** No candidate has made it into Blender. That means no
model has been measured, rendered in our 144 px style, checked for topology or weights, or had its
archive readme read. The only renders in `review/rosace/base-search/` are of our current base.
What follows is a **provisional** ranking. It uses the shop preview sheets, which I looked at
myself (`review/rosace/base-search/_store/`), and the terms text I re-read live on the shop pages
today [M]. Only **Kanata** plausibly clears both the quality bar and the terms. The other two
clear terms and body shape but miss parts of the bar: no head, no MMD rig, no physics.

Ranking order: appeal and anime proportions, then terms safety, then rig/physics/weights, then
ease of stripping.

### 1. Kanata: アニメ系女性素体 全年齢版 (BOOTH 2628224, ¥3,000). Provisional pick.

- **Why it wins:** it is the closest to ref 04's adult gacha look. The ruler overlay on the
  wireframe sheet gives about 6.9 heads, legs about 51%, and a calm hourglass: shoulders and
  hips about 1.17 heads, waist about 0.69. Its waist is less pinched than our current base's
  wasp waist. The quad topology is clean, with proper loops at the bust, knees and elbows. It is
  the only candidate with an anime **head and face** (27+ expression morphs), plus body-shape
  morphs, as **PMX + .blend**, High (23,694 tris) and Low (8,114 tris). It is also the only one
  whose MMD rig is known to exist (D-bones fixed in v1.15/1.16). My read of the sheet: the face
  is a fairly generic 2010s MMD face, and the arms and legs are slightly more "natural" than
  gacha. It's appealing, but not HoYo-sharp.
- **Terms, quoted live today [M]:** 「この素体を利用して制作したモデルは商用利用・販売・配布することができます。」
  and 「「禁止事項」に該当しない範囲であれば、当素体モデル購入者は、商用利用・販売・配布を自由に行うことができます。」
  禁止事項: 「当素体モデルの自作を主張。」「当素体モデルをそのまま再配布・販売する行為。」
  「当素体モデルを利用したモデルを素体モデルとして販売する行為。」 and 「作者Kanataが不適切と判断した行為。」
  So modification is allowed, building another character on it is the product's stated purpose,
  commercial use is allowed (which settles the donate button), and nothing ties it to one
  character. One soft risk is the catch-all clause letting Kanata forbid anything they judge
  inappropriate.
- **Credit:** not required. Because we may not claim the base as our own work (自作を主張), a
  credit line is still the safe way to comply. Suggested line: `Base body: Kanata「アニメ系女性素体」(modelerkanata.booth.pm)`.
- **Unknowns to check on download:** whether rigid bodies and joints exist (the listing
  mentions only bones and D-bones), and the readme inside the zip.
- **What we'd change:** hide the underwear and knee-socks meshes (they're separate additions from
  v1.10/v1.17, so stripping should be easy). Widen the waist slightly toward 15 px in
  three-quarter view. Lengthen the shins a touch for gacha legs. Replace the eyes and face
  texture with Rosace's. Add our own rigid bodies or spring chains for hair, skirt and bust.

### 2. SiroinoSotai v1.0 (BOOTH 8268676, free, CC0). Safest terms, but headless.

- **Why second:** the Default T-pose has long legs and a clean, appealing hourglass. The 27
  body-shape keys (Slim / Default / Large) cover everything from a slim Rosace to ref 04's curvy
  figures. The PC mesh is 16,704 tris of clean quads, the weights were done by a named weight
  artist (せらすずな), and it was built in Blender 5.2, so it matches our toolchain era. Why not
  first: it has **no head**, **no MMD rig** (Unity Humanoid FBX/.blend) and **no physics**.
- **Terms, quoted live today [M]:** 「CC0ライセンスのため、個人・法人、商用・非商用を問わず自由に利用でき、利用報告・許可申請・クレジット表記も必要ありません。」
  and 「VRChat以外にも、ゲーム、映像、配信、イラストなど、幅広い創作にご利用いただけます。」
  CC0 1.0 applies to the FBX, the .blend and the textures. This is the cleanest licence in the
  search.
- **Two catches:**
  - We must not call our work 「公式」「公認」「認定」「監修」「共同開発」 without permission.
  - The SiroinoSotai logo is *not* CC0, so don't use it.
- **Credit:** none required. Optional line: `Base body: SiroinoSotai by しろいの (CC0)`.
- **What we'd change:** attach a head, either our current `head_skin` or Kanata's head if we buy
  that too. Blend the neck seam. Retarget or rename the Humanoid armature to our rig. Add
  spring bones. A headless body also means the face, which is the biggest appeal factor, is
  still ours to solve.

### 3. RINNE素体S v1.1 (BOOTH 6227959, free). Most gacha hourglass, headless, naming condition.

- **Why third:** from the store sheets, it has the strongest gacha silhouette of the lot: a
  narrow waist, full hips and long legs. It has 6 body-shape keys and 60 hide keys, at 13,626
  polys. Like SiroinoSotai, it has **no head**, **no MMD rig** and **no physics**, and its zip is
  488 MB. It's third because its terms are slightly weaker than CC0, and the hips and rear run
  heavier than Rosace's 24 px hip target.
- **Terms, quoted live today [M]:** 「このモデルは、個人利用・商用利用を問わず、自由に利用、改変、再配布が可能です。」
  Conditions: 「1. 自作発言の禁止」「2. 未改変状態での再配布の禁止」「3. 商品説明の義務: 本モデルを使用した際は、商品説明欄もしくは商品名に「RINNE素体S」と明記する必要があります。」
- **Credit:** effectively **required**. The name 「RINNE素体S」 must appear. For a website, that
  means a credits entry: `Base body: RINNE素体S (rinne-official.booth.pm)` [I: condition 3
  is written for shop listings; a site credits line is the closest equivalent].
- **What we'd change:** the same head, rig and spring work as #2, and pull in the hips and thighs
  with its shape keys.

### Not in the top 3

- **プリメロ工房 1958825:** free, with a head and an MMD-named rig. But the A-pose sheet shows a
  modest hourglass and a simple mesh with no physics, and it has less appeal than #1–#3. Keep it
  as a cheap test of the pipeline.
- **Syria 2582307:** clothed, with a heavy "むっちり" build.
- **Jump!Jun 2181568:** exactly 6 heads, with short VRChat legs.
- Everything else is rejected above or in the Rejected list below.

### Recommendation

1. **Next step (needs Dex):**
   - **Kanata:** buying it (¥3,000) is Dex's call; if he buys, he drops the zip in `D:\Dex\Inbox\Downloads\dexplace-character\mmd\`.
   - **SiroinoSotai:** he places a ¥0 BOOTH order and drops that zip in the same folder.
   - Then run the two commands under "After a download". The ranking only becomes real
     after `measure.json` and the 144 px sheets exist for each.
2. **If Dex doesn't want to buy anything:** use SiroinoSotai's body with our current
   `head_skin`, and our own spring chains. The terms are the safest possible, and we were going
   to build Rosace's physics ourselves anyway. What we'd lose is a ready-made anime face.
3. **If the Kanata render disappoints at 144 px**, for example if the face or legs read as
   "old MMD": keep the current base. It already hits the size targets. Improve it by relaxing
   the wasp waist and re-topologising, rather than taking a body that's only different.

## Run 2 (2026-09-29): download, measure, render

**Short version: no candidate made it into Blender, because none can be downloaded without
Dex.** Every free one sits behind a sign-in, and the best one (Kanata) costs ¥3,000. I don't
sign in to Dex's accounts or buy things, and the Chrome extension that holds his logins was not
connected. So there are **no survivors with renders yet**, and none of the readmes inside the
archives were read. Everything else is ready: when Dex drops a zip in
`D:\Dex\Inbox\Downloads\dexplace-character\mmd\`, one command imports, measures and renders it.

What I checked live [M]:

- BOOTH free items: the item JSON lists the file URLs, but fetching them without a session
  returns `302 -> https://booth.pm/users/sign_in` (tested on 1958825 `MMD用女性素体.zip` and
  2582307 `Syria_Bunny_1.00.zip`). Same route for SiroinoSotai (`SiroinoSotai_1.0.zip`),
  RINNE (`RINNE_SotaiS1.1.zip`) and biencg (`human_model.blend.zip`).
- Nico 3D (td31255 and the rest): the only download link on the page is the niconico login.
- Sketchfab (Onizaki base): the download API answers `401` without a token.
- GitHub, itch.io and BowlRoll: no anime MMD 素体 with clear terms turned up. The itch.io
  "base-mesh" results are Western or low-poly, and BowlRoll search results render client-side.

### What was built and proven this run

- **MMD Tools 4.5.14 is installed in the isolated Blender** (pinned with sha256 in
  `tools/pixel-pipeline/blender_env.py` `EXTENSIONS`, row added to `THIRD_PARTY.md`).
  `blender_env.py setup` ends with `isolation OK` and `mmd_tools 4.5.14` enabled; Dex's
  profile is untouched.
- **`tools/pixel-pipeline/base_search.py`** imports a .pmx / .pmd / .vrm / .fbx / .glb / .blend,
  hides meshes by name (`--keep` / `--hide`, so hair and outfit go away), counts MMD rigid
  bodies, joints and morphs (or VRM spring chains), measures the body at rest pose, and renders:
  hi-res front / three-quarter / side, topology front / three-quarter, and 144 px frames
  (DESIGN.md skin ramp S1–S4, 1 px outline) with the 24 px head and 75 px crotch guides drawn in.
  Widths come from cutting the mesh with horizontal planes, not from bounding boxes. Hanging
  hands are excluded from hip width because arm-weighted vertices are left out.
- **PMX path proven:** I exported our current base as a PMX with MMD Tools, re-imported it
  through `base_search.py`, and got the same numbers to 0.1 px as the .blend
  (scratch in `D:\Dex\Projects\dex-place-art\rosace\build\scratch\pmx-smoke\`, not a candidate).

### The yardstick: our current base, measured the same way

These are the numbers every candidate will be compared against. They say the current body
already hits the DESIGN.md size targets. So a new base has to win on shape quality, topology,
face and physics, not on the tape measure. Front view, rest pose (T-pose), from
`review/rosace/base-search/current-rosace-base/measure.json` [M]:

| | Current base | At 144 px | DESIGN target at 144 px |
|---|---|---|---|
| Heads tall (skull top to chin) | 5.92 | head 24.3 px | 24 px (about 6 heads) |
| Crotch to sole | 53.9% of height | 77.7 px | 75 px (52%) |
| Shoulders (deltoid to deltoid) | 1.26 heads | 30.6 px | 27 px (three-quarter view) |
| Waist | 0.45 heads wide, 0.39 deep | 10.9 px | 15 px (three-quarter view) |
| Hips | 1.05 heads wide, 0.57 deep | 25.5 px | 24 px (three-quarter view) |
| Bust (chest depth back to front) | 0.64 heads; chest 0.79 wide | 15.6 px | not specified |
| Thigh top / mid, knee, calf, ankle (one leg) | 0.43 / 0.32, 0.23, 0.30, 0.13 heads | thigh 10.4, calf 7.2 px | not specified |

Mesh: `body` 5,356 verts + `head_skin` 833 verts (VRoid beta lineage), no rigid bodies (spring
motion is ours). Renders: `review/rosace/base-search/current-rosace-base/`
(`*_hires.png`, `*_px144_x4.png`). What I see in them: a very pinched wasp waist and a thin
side profile, big round bust, long thin shins, and a head that reads large at 144 px.

### Store-image read of the candidates (not a measurement)

Only the shop preview images could be looked at. They are perspective shots, so treat these
as ±10% [I, from the images]. Sheets are in `review/rosace/base-search/_store/`
(`store_<item>.jpg`, `kanata_ruler.png`).

- **Kanata 2628224 / 2643830** (front-left figure of the wireframe sheet, ruler overlay): skull
  top 118 px, chin 242, heel about 972. That is **about 6.9 heads**, crotch at 540, so
  **legs about 51%**. Shoulders and hips both about 1.17 heads, waist about 0.69 heads. Clean
  quads with proper edge loops around the bust, knees and elbows. A calm hourglass, less pinched
  than ours. Head and face are anime (27+ face morphs), and there are bust morphs. It's closest to
  ref 04's adult 7-head gacha look.
- **SiroinoSotai 8268676** (CC0, headless): the PC T-pose shows long legs, a strong
  bust/waist/hip curve and clean quads. The Slim / Default / Large shape keys cover a slim
  Rosace up to ref 04's curvy figures. It has no head.
- **RINNE素体S 6227959** (headless): the most "gacha" hourglass of the lot, with a narrow waist,
  full hips and long legs. It has no head, and the render style is VRChat.
- **Jump!Jun 2181568:** its own sheet says 「ぴったり6頭身」 (exactly 6 heads). It's a cute VRChat
  figure with short legs for ref 04, and the clothed shots hide the body.
- **TararaTarako Syria 2582307 / 2611621:** only low-angle clothed shots; very heavy bust and
  thighs.
- **プリメロ工房 1958825:** A-pose, about 6.5 heads, modest curves, simple mesh.
- **biencg 7056492:** T-pose, about 6.3 heads, legs look short. It's shaped much like our
  current base, so no gain.
- **Junkyard 3942371:** long neck, realistic ribcage and knees. It reads as **realistic
  proportions**, so it's rejected on Dex's rule.

### Shortlist for Dex to download (in order)

Terms quotes for each are further down in this file (from the shop pages). The archive
readmes still need reading on download.

1. **Kanata アニメ系女性素体 全年齢版**, https://booth.pm/ja/items/2628224, ¥3,000. The only
   PMX with a head, face morphs and body morphs that has clean parts-reuse terms. Buying it is Dex's call.
2. **SiroinoSotai v1.0**, https://booth.pm/ja/items/8268676, free, CC0. Best free body, but it
   needs a head from somewhere (Kanata's, or our current `head_skin`).
3. **RINNE素体S v1.1**, https://booth.pm/ja/items/6227959, free. Condition 3 (name
   『RINNE素体S』 in the product description) applies to products that use it. For a free
   site with sprites, a credit line in the site's credits covers it [I].
4. **プリメロ工房 MMD用女性素体**, https://booth.pm/ja/items/1958825, free, 353 KB. It has a head
   and an MMD-named rig. A cheap test of the PMX-less .blend path.
5. **TararaTarako シリアちゃん**, https://booth.pm/ja/items/2582307, free, 4.37 MB PMX. Clothed;
   worth it only to see a real MMD physics setup from this author.
6. **Jump!Jun キャラクター素体 v12.1**, https://booth.pm/ja/items/2181568, ¥1,500. Only if Dex
   wants the 6-head VRChat look.

### After a download (the exact commands)

From `D:\Dex\Projects\dex.place`, after unzipping into `...\mmd\<name>\`:

```
python tools/pixel-pipeline/blender_env.py run --python tools/pixel-pipeline/base_search.py -- \
  --src "D:/Dex/Inbox/Downloads/dexplace-character/mmd/<name>/<model>.pmx" --name <name> \
  --out review/rosace/base-search/<name> --hide "(?i)hair|髪|pants|下着|socks|ソックス"
python tools/pixel-pipeline/base_search.py --post review/rosace/base-search/<name> \
  --post review/rosace/base-search/current-rosace-base --compare review/rosace/base-search/compare_px144_3q.png
```

`measure.json` then holds heads, leg ratio, the widths in head units and at 144 px, tri / quad
counts, unweighted verts, shape keys, rigid bodies, joints and morph counts. Caveats: widths are
front-view (DESIGN's 27/15/24 are three-quarter), and shoulder width depends on T- vs A-pose.

## The answer first (run 1)

**Best fit: Kanata's "アニメ系女性素体 全年齢版" (BOOTH 2628224, ¥3,000).** It is a purpose-made
anime base body, not a character. It comes as PMX and .blend, in high-poly (23,694 tris) and
low-poly (8,114 tris) versions, rigged and skinned, with D-bones, face morphs and body-shape
morphs. Its previews show long legs, a clear waist and slim limbs. The terms say in plain words
that models made from it may be sold and distributed. They forbid only reselling the base itself
or selling a derivative *as another base*. That is the closest thing on the market to "a real
素体 with anime/gacha proportions and a licence that says yes to what we're doing" [M].

**Runner-up: Jump!Jun "キャラクター素体 v12.1" (クロモジ 7-head / シロモジ 6-head, BOOTH 2181568,
¥1,500 Blender edition).** It uses a VN3 licence with a table that answers every question
(改変 allowed, 他のデータを改変するための利用 allowed, 営利 allowed, credit not required). It
is Blender-native with a Rigify rig and shape keys, but it has no PMX rigid bodies. The mesh is
VRChat-grade (38.5k tris body+head) [M].

**Free options:** TararaTarako's シリアちゃん (explicitly allows "配布、販売時のデータ流用", but the
free model is dressed and very thick-thighed) and Alicia Solid / ニコニ立体ちゃん (Dwango licence,
commercial OK for individuals, PMX with physics). The catch: every free route needs **Dex's own
login** to download. BOOTH ¥0 items still go through an order, and Nico 3D needs a niconico
account. I did neither.

Downloads: none of the model files were fetched. Downloading needs a BOOTH order (even at ¥0) or a
niconico login, and both are Dex's to do. Only the store preview images went to
`D:\Dex\Inbox\Downloads\dexplace-character\mmd\_previews\`, plus the Jump!Jun terms PDF in
`...\mmd\terms\`. Because no model file came down, there are no candidate renders in
`review/rosace/base-search/` yet.

## What each term means for us

- **改変 / 改造**: we may change the mesh. Every candidate below allows it.
- **パーツ流用 / 他のデータを改変するための利用**: we may pull the body out and build a different
  character on it. This is the clause that matters most, and it is where Tda式 and the official
  game models fail.
- **Commercial**: dex.place has a donate button. The strictest reading (黒柚式) treats any money
  "as consideration" as commercial. Voluntary donations for a free site are not consideration
  for the model [I], but candidates that allow commercial use outright remove the question.
- **Redistribution**: not needed. We ship 144 px sprites, never the mesh.

## Candidates

### 1. Kanata: アニメ系女性素体 全年齢版 (recommended)

- URL: https://booth.pm/ja/items/2628224 (R18 edition 2643830, ¥4,000, same terms)
- Author: Kanata (modelerkanata.booth.pm). Also makes MMD character models on Nico 3D (Kanata式).
- Format: PMX + .blend; High 23,694 tris, Low 8,114 tris; face morphs (27 shown), body-shape
  morphs (bust size shown in previews), D-bones fixed in v1.15/1.16, underwear and knee socks
  added; PSDs for face and body [M].
- Terms, quoted [M]:
  - 「この素体を利用して制作したモデルは商用利用・販売・配布することができます。」
  - 「「禁止事項」に該当しない範囲であれば、当素体モデル購入者は、商用利用・販売・配布を自由に行うことができます。」
  - 禁止事項: 「当素体モデルの自作を主張。」「当素体モデルをそのまま再配布・販売する行為。」
    「当素体モデルを利用したモデルを素体モデルとして販売する行為。」 plus the usual
    attack/politics/religion clauses and 「作者Kanataが不適切と判断した行為。」
- Credit: not required by the text; do not claim authorship of the base.
- Proportions from previews [M, visual]: legs about half of height, about 7 heads, narrow waist
  with a real hip flare, slim arms. Anime face. Topology is clean quads on the high version and
  triangulated on the low version.
- Unknown: whether rigid bodies/joints for bust/hair exist (the listing mentions only bones and
  D-bones). We would add our own for hair/outfit anyway [I].

### 2. Jump!Jun: 「シロモジ&クロモジ」キャラクター素体 v12.1

- URL: https://booth.pm/ja/items/2181568 (Blender edition ¥1,500, VRC ¥2,000, full ¥2,500)
- Format: .blend (Blender 4.2 LTS), Rigify-based rig, toon shader group, bust-size shape keys,
  Unity package for the VRC edition. Body+head 38,552 tris [M].
- Terms: VN3 licence PDF, saved as `mmd\terms\jumpjun_v12.1_terms_ja.pdf` [M]. From its table:
  - 「営利・非営利の目的問わず利用を許可します」 (individuals and companies)
  - J 改変: 「許可します」; K 他のデータを改変するための利用: 「許可します」
  - R 製品開発等のためのソフトウェアへの組み込み: 「許可します」
  - V クレジット表記: 「不要ですがあると嬉しいです」 (credit line if used: ©Jump! Jun)
  - Selling or distributing modified *model data* needs "originality" judged by JumpJun. That
    doesn't apply to us, because we don't distribute the mesh.
- Proportions: シロモジ is marketed as 6 heads; クロモジ (v12.0) is the taller body. Big bust,
  soft stylised VRChat look [M, visual]. Less gacha-sharp than Kanata's base.
- No PMX physics. Spring motion would be ours to add [I].

### 3. TararaTarako: むっちりバニーシリアちゃん / マジカルバニー☆シリアちゃん (free)

- URLs: https://booth.pm/ja/items/2582307 , https://booth.pm/ja/items/2611621 (both ¥0);
  also Nico 3D td74481 / td74804. Paid nude 素体 (R18) + high-poly: https://tararatarako.booth.pm/items/2591167
- Format: PMX made with Blender + mmd_tools, standard MMD bones incl. IK/groove fixes [M].
- Terms, quoted from the BOOTH page [M]: 「商用利用の許可」「二次的著作物の配布の許可」
  「配布、販売時のデータ流用の許可」「その他形式に変換しての利用の許可(fbx,vrm等)」
  「著作権表記は可能な限りお願いします。」
- Credit: requested where possible: 「モデル製作：TararaTarako © TararaTarako 2020」.
- Proportions: "むっちり" is the design brief. Heavy bust and thick thighs, a strong hourglass,
  but heavier than Rosace's 27/15/24 target [M, visual]. The free model is clothed, so a
  clean body needs the paid 素体 edition.
- Note: the same author's 夜のエレノアさん has *different* terms (no redistribution) [M].

### 4. Alicia Solid / ニコニ立体ちゃん (Dwango, free)

- URL: https://3d.nicovideo.jp/works/td14712 ; licence https://3d.nicovideo.jp/alicia/rule.html
- Design 黒星紅白, modelling 雨刻. PMX + FBX + Unity; VRM also exists (td32797) [M].
- Terms, quoted [M]: 第3条1 「営利・非営利問わず、利用者自身による以下の行為を非独占的に許諾」
  (1)「当社キャラクターの二次創作物を作成すること。」 (2) 二次創作物の「公衆送信、展示その他販売・頒布」.
  利用者 = 「個人の方（法人を除く団体を含む）」.
- Caveats [M]: 第2条3 「当社は、当社キャラクターの改変物について、著作権を専有しています。」
  So Dwango keeps copyright in mere edits. A new character built on the body is arguably a 二次的著作物,
  but that is the grey zone. 第4条3: Dwango 「いつでも、本ライセンスを停止または終了させることができます」.
  Download needs a niconico login.
- Proportions: slim, long-legged anime teen (my recollection, not re-measured this session [I]).
  Physics present.

### 5. aga: 【MMD】素体配布 PMX,MQO (free)

- URL: https://3d.nicovideo.jp/works/td31255 (20171102素体.zip, 1.28 MB, 5,487 DLs)
- Nico 3D licence flags from the page data [M]: require_attribution "disabled",
  commercial_use "enabled", change_over (改変) "enabled", redistribution "enabled".
  Author note: 「自作FGO酒呑童子にも使用した素体を配布用に調整していたもの」.
- Readme terms not seen (zip is login-gated). Small file, so likely low-poly. Built for a petite
  character (Shuten Douji). Probably too short and flat for Rosace [I].

### 6. プリメロ工房 (射当ユウキ): 【無料】MMD用女性素体（リグ付き）

- URL: https://booth.pm/ja/items/1958825 (free, tip tiers from ¥300)
- Format: Blender 2.8 .blend with an MMD-named armature; PMX not included [M].
- Terms, quoted [M]: 「商用利用・非商用利用のどちらも可能とします。」「素体モデルを改変して、新たな作品を制作しても大丈夫です。」
  「素体を元に作成した作品に関して素体制作者は著作権を主張しません。」 Credit optional.
- Proportions [M, visual]: anime, about 6.5 heads, modest hourglass, legs about half. Simpler mesh; no physics.

### 7. 黒柚式 (神楽坂柚 / kuroyuzu): 個人商用ライセンス models

- Shop: https://kuroyuzu.booth.pm/ (e.g. 4150536 アイリベルダ ¥7,000, 5248746 蜜紬希 ¥7,000,
  6065093 エルエリゼ ¥7,000). Well-known MMD modeller with strong physics.
- Terms page (live site down; read via Wayback 2026-05-10 snapshot) [M]:
  2-2 「改変の内容に関しては特に制限を設けていません。顔を変える、服を変える、性別を変えるなど何れもOKです。」
  1 「モデルデータ本体および付属物を使用して、画像、動画を作成し、公開することができます。」
  Credit **required**: 「著作表記をしてください。※例：「使用モデル：黒柚式 川原えむ (C)神楽坂柚」」
  Also 「規約に無い事は基本的にしてはいけないことと思っていただいたほうが」 and 2-4 counts
  パトロン型/対価 as commercial. That's why the 個人商用 edition matters.
- Fit: legally usable for sprites with credit, but they are full characters (not 素体), and
  the terms are strict about anything unlisted. Second tier.

### 8. 倉前堂: 3D素体【少女】

- URL: https://booth.pm/ja/items/2214468 (¥400). .blend/.fbx/.obj, **no bones**.
- Terms [M]: 「3Dアバター制作や、MMDモデル制作、パーツ流用や改変等自由にご利用ください。」「商用利用ok」「クレジット不要」;
  forbids only 「未加工の状態での二次配布」.
- Proportions: extremely long legs, very slim, large bust [M, visual]. Needs rigging and weights, so it's a mesh-only fallback.

## Rejected

- **Tda式 (Crypton characters):** parts transplant to a non-Tda model is prohibited
  (「Tda式以外の別モデルを作るためにモデルの一部を移植したり素材として使用する」) [S, Nico大百科].
- **HoYoverse / Kuro official models:** see `reference-models.md`.
- **Jackcg 素体モデル (3319346)** and **ByNEET リアル女性用素体 (2486850):** realistic proportions [M, visual].
- **Kanata式 比那名居天子 素体 (td40249):** Touhou character base; files moved off Nico 3D.
- **SPS ユーニス, ゴリマ式ククル:** character models with "MMD only / no VRChat" clauses and no clear parts-reuse permission [M].
- **R産地直送 女性素体1.1 (1711762):** no terms beyond 「ご自由にお使いください」, 3,188 polys.
- **Vhigh! アイドル01 (5054572):** item no longer resolves on BOOTH.
- **そ子さん (茶狐, BowlRoll):** terms only in the readme; the BowlRoll page could not be found; BowlRoll lists were empty without login.

## Next step for Dex

Buy (or ¥0-order) Kanata 2628224 through BOOTH with his own login and drop the zip in
`D:\Dex\Inbox\Downloads\dexplace-character\mmd\`. Then import with MMD Tools into the isolated
Blender env, render front / three-quarter at 144 px into `review/rosace/base-search/`, and
measure shoulder / waist / hip against 27 / 15 / 24.
