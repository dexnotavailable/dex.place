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
> **TL;DR** — Product 1 (playable character): **23%** · Overall (Products 1 + 2): **12%** · Now: **S3 — Body + head topology** (construction works across lanes (rigs, physics, expressions, zero clipping); the LOOK of face and hair is being rebuilt with data-driven poly modelling (head-construction study, tolerance bands))

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 95% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 90% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 25% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 15% |
| S6 | Rig, weights, correctives, physics | ○ not started |
| S7 | Texturing + materials (Kuro-look NPR, Blender to Unreal) | ▶ in progress, 15% |
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

<a id="e-20261001-0616"></a>**06:16 · character-forge S3 body · S3**

C001's body got a smaller head (toward the concept's proportions), a slightly fuller bust and a smoothed neck base, shown in clay and wireframe so every polygon is visible; next up are the golden bone arms, hair and clothing.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s3-c001-body-v1b-69f726bb.webp" width="1600" height="781" alt="Render sheet from the character-forge S3 body lane, stage S3: C001&#x27;s body got a smaller head (toward the concept&#x27;s proportions), a slightly fuller bust and a smoothed neck base, shown in clay and wireframe so every polygon is visible; next up are the golden bone arms, hair and clothing." loading="lazy" decoding="async">

---

<a id="e-20261001-0602"></a>**06:02 · gameplay · S8**

Epic's free mannequin running around inside our own Unreal project: idle, walk, run, sprint, stop, a turn and a jump, all chosen automatically by motion matching from scripted controller input. It is a stand-in body so C001 can drop onto the same system later.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s8-gameplay-locomotion-r1-5dc39bbb.webp" width="1600" height="734" alt="Render sheet from the gameplay lane, stage S8: Epic&#x27;s free mannequin running around inside our own Unreal project: idle, walk, run, sprint, stop, a turn and a jump, all chosen automatically by motion matching from scripted controller input. It is a stand-in body so C001 can drop onto the same system" loading="lazy" decoding="async">

---

<a id="e-20261001-0551"></a>**05:51 · S4 face system (Claude, Opus 5.5) · S4**

C001's face system first pass: flush anime eyes built from layered iris/highlight graphics, a real mouth interior (teeth, tongue), and 25 expression shapes shown in clay, flat colour and wireframe. Next: the head shape is being rebuilt from pro-model data, then these eyes and expressions get regenerated onto it.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s4-face-r3-9eec6f83.webp" width="1194" height="1600" alt="Render sheet from the S4 face system (Claude, Opus 5.5) lane, stage S4: C001&#x27;s face system first pass: flush anime eyes built from layered iris/highlight graphics, a real mouth interior (teeth, tongue), and 25 expression shapes shown in clay, flat colour and wireframe. Next: the head shape is being" loading="lazy" decoding="async">

---

<a id="e-20261001-0544"></a>**05:44 · S5a hair · S5**

First full pass at C001's short silver bob: about 30 clumps authored over the head (under-layer, bob masses, choppy bangs, face-framing locks) in clean quads with one UV strip per clump. It also has a hood-on tucked state and a first spring-chain physics test (head turn, run bob, settle). Next: the silhouette still reads as a stiff helmet with a stamped zigzag hem, so round 3 switches to hand-shaped curve clumps: bigger hero bangs, tapered individual ends, an inward tuck at the jaw.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-hair-r2-5214e489.webp" width="876" height="1600" alt="Render sheet from the S5a hair lane, stage S5: First full pass at C001&#x27;s short silver bob: about 30 clumps authored over the head (under-layer, bob masses, choppy bangs, face-framing locks) in clean quads with one UV strip per clump. It also has a hood-on tucked state and a first spring-chain physic" loading="lazy" decoding="async">

---

<a id="e-20261001-0540"></a>**05:40 · shader · S7**

Round 2 of the toon shader kit in Blender: a cleaner face-shadow map that moves as one shape with the light, thin tinted hair highlight, no skin gloss, blush zones, painted-fold cloak with a real lace motif, and a new WuWa-style key+fill+rim lighting preset. Placeholder test model, not the final character: the bob is the AI tracing guide's placeholder hair, not final art.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s7-shader-r2-blender-20487300.webp" width="1600" height="1548" alt="Render sheet from the shader lane, stage S7: Round 2 of the toon shader kit in Blender: a cleaner face-shadow map that moves as one shape with the light, thin tinted hair highlight, no skin gloss, blush zones, painted-fold cloak with a real lace motif, and a new WuWa-style key+fill+rim lighting pres" loading="lazy" decoding="async">

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
