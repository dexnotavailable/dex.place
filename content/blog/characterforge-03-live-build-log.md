---
title: CharacterForge live build log
summary: The newest Blender and Unreal renders from every CharacterForge lane, newest first, updated many times a day.
date: 2026-10-01
---

This page is the live build log for CharacterForge, the project to build one playable anime-style character (C001) in Blender and Unreal Engine. It shows the newest renders from every lane (body, head, face, hair, parts, materials, rig, Unreal), newest first, and it is updated many times a day. Each entry has a time, the lane and stage, one or two plain sentences on what changed and what comes next, and one image.

The milestone write-ups are separate posts: [post 01](/blog/characterforge-01-building-the-reference-library/) and [post 02](/blog/characterforge-02-the-tracing-guide-and-the-judge/). Those carry the checked numbers. This page is the quick look, so a render here can be rough or wrong, and the next entry may replace it.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **15%** · Overall (Products 1 + 2): **8%** · Now: **S3 — Body + head topology** (C001 body conformed to the dressed ghost (identity green); head being rebuilt from a data-driven study of pro head construction; face, hair, bone arms, shader and gameplay lanes running)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 95% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 85% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ○ not started |
| S5 | Hair, clothing layers, bone arms, boots | ○ not started |
| S6 | Rig, weights, correctives, physics | ○ not started |
| S7 | Texturing + materials (Kuro-look NPR, Blender to Unreal) | ○ not started |
| S8 | Unreal import, motion, motion-matching locomotion | ○ not started |
| S9 | Combat kit + VFX | ○ not started |
| S10 | Full blind test (Product 1) | ○ not started |
| S11 | Chassis + C002 + C003 + provider swap tests (Product 2) | ○ not started |

*As of 2026-10-01. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

<!-- live:start -->

## Live entries

Newest first. Times are local time at the build machine (UTC+7).

### 2026-10-01

<a id="e-20261001-0540"></a>**05:40 · shader · S7**

Round 2 of the toon shader kit in Blender: a cleaner face-shadow map that moves as one shape with the light, thin tinted hair highlight, no skin gloss, blush zones, painted-fold cloak with a real lace motif, and a new WuWa-style key+fill+rim lighting preset. Placeholder test model, not the final character: the bob is the AI tracing guide's placeholder hair, not final art.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s7-shader-r2-blender-20487300.webp" width="1600" height="1548" alt="Render sheet from the shader lane, stage S7: Round 2 of the toon shader kit in Blender: a cleaner face-shadow map that moves as one shape with the light, thin tinted hair highlight, no skin gloss, blush zones, painted-fold cloak with a real lace motif, and a new WuWa-style key+fill+rim lighting pres" loading="lazy" decoding="async">

---

<a id="e-20261001-0539"></a>**05:39 · Blender hair · S5**

Hair round 2: the short bob is now built from strand-recipe clumps over the S3 head, shown in clay, flat and gradient previews with hood-off and hood-on shapes, plus a first spring-chain physics test (head turn, run bob, stop). The clump shapes and the physics are first passes, not final.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-hair-r2-365b9ec6.webp" width="1162" height="1600" alt="Render sheet of the short grey clay bob hair from front, three-quarter, side and back, then flat and gradient previews, hood shape tests, and ten frames of a head-turn physics test." loading="lazy" decoding="async">

---

<a id="e-20261001-0537"></a>**05:37 · character-forge S3 body · S3**

Built the reusable adult-female family template body (clean quad topology, UVs, deformation-tested) that every later character conforms to instead of re-modelling; next is conforming it to C001.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s3-body-template-f0149af6.webp" width="1600" height="307" alt="Render sheet from the character-forge S3 body lane, stage S3: Built the reusable adult-female family template body (clean quad topology, UVs, deformation-tested) that every later character conforms to instead of re-modelling; next is conforming it to C001." loading="lazy" decoding="async">

---

<a id="e-20261001-0537-2"></a>**05:37 · character-forge S3 body · S3**

C001's body is now a conform of the reusable adult-female template: same clean topology and UVs, fitted to C001's proportions with a larger head and clean skin under every garment; next up are the golden bone arms, hair and clothing.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s3-c001-body-v1-f7d791e9.webp" width="1600" height="307" alt="Render sheet from the character-forge S3 body lane, stage S3: C001&#x27;s body is now a conform of the reusable adult-female template: same clean topology and UVs, fitted to C001&#x27;s proportions with a larger head and clean skin under every garment; next up are the golden bone arms, hair and clothing." loading="lazy" decoding="async">

---

<a id="e-20261001-0528"></a>**05:28 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

First pass at C001's rigid parts: golden skeletal arms and hands built as rigid bone pieces on the same humanoid arm/hand bones as the body (curl and elbow tests stay clean), plus pointed low-heel boots with flared cuffs and the green gem tassel. Next: make the forearm strands read more organic and fused, and close the elbow neck.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-rigid-r1-858035f5.webp" width="1429" height="1600" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: First pass at C001&#x27;s rigid parts: golden skeletal arms and hands built as rigid bone pieces on the same humanoid arm/hand bones as the body (curl and elbow tests stay clean), plus pointed low-heel boots with fla" loading="lazy" decoding="async">

---

<a id="e-20261001-0514"></a>**05:14 · Blender body template (detail sheet) · S3**

Detail sheet for the family body template v1: one all-quad body of 12,916 triangles, and all 33 proportion checks land inside the adult-female range. Raised arms and a deep squat still pinch, which the rig stage will correct; next is conforming it to C001's dressed tracing guide.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s3-body-template-sheet-7ce031c9.webp" width="1600" height="1199" alt="Render sheet of the grey clay body template from front, side, back and three-quarter views with wireframe close-ups, stress poses, UV layout, deviation heatmaps and a table of proportion ratios." loading="lazy" decoding="async">

---

<a id="e-20261001-0339"></a>**03:39 · Blender head + hand probe · S3**

Head and hand probe, round 2: smaller nose and mouth, a softer stare, and a fanned, relaxed hand. It reads closer to the design but not right yet, because the eyes are still too wide and look sunken in clay, so eye design carries into the face stage.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s3-probe-route1-r2-16af2e65.webp" width="1600" height="944" alt="Render sheet of the bare grey clay head with its quad wireframe, blink and open-mouth shape tests, and the hand from several sides, with a table of face ratios." loading="lazy" decoding="async">


<!-- live:end -->
