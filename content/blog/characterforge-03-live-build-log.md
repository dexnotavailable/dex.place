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
> **TL;DR** — Product 1 (playable character): **32%** · Overall (Products 1 + 2): **17%** · Now: **S3 — Body + head topology** (construction works across lanes (rigs, physics, expressions, zero clipping); the LOOK of face and hair is being rebuilt with data-driven poly modelling (head-construction study, tolerance bands))

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
| S7 | Texturing + materials (Kuro-look NPR, Blender to Unreal) | ▶ in progress, 30% |
| S8 | Unreal import, motion, motion-matching locomotion | ▶ in progress, 35% |
| S9 | Combat kit + VFX | ▶ in progress, 20% |
| S10 | Full blind test (Product 1) | ○ not started |
| S11 | Chassis + C002 + C003 + provider swap tests (Product 2) | ○ not started |

*As of 2026-10-01. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

<!-- live:start -->

## Live entries

Newest first. Times are local time at the build machine (UTC+7).

### 2026-10-01

<a id="e-20261001-0652"></a>**06:52 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 3 of C001's bone arm: the hand and upper arm are now cut from generated sculpts onto our own joint plan too, so every knuckle is a hidden ball-and-socket and nothing clashes in the fist, elbow or claw tests, at under 6k triangles per arm. Next: a crisper sculpt for the upper arm, which still reads too smooth.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-rigid-r3-dad6b02b.webp" width="1600" height="1363" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 3 of C001&#x27;s bone arm: the hand and upper arm are now cut from generated sculpts onto our own joint plan too, so every knuckle is a hidden ball-and-socket and nothing clashes in the fist, elbow or claw test" loading="lazy" decoding="async">

---

<a id="e-20261001-0649"></a>**06:49 · shader · S7**

The same layered toon shader kit now renders in both Blender and Unreal 5.8 from one parameter table: the colours, face-shadow sweep, hair highlight, lace and sheer stockings line up closely. Placeholder test props, not the final character.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s7-shader-r2-compare-26d40e0a.webp" width="1600" height="1314" alt="Render sheet from the shader lane, stage S7: The same layered toon shader kit now renders in both Blender and Unreal 5.8 from one parameter table: the colours, face-shadow sweep, hair highlight, lace and sheer stockings line up closely. Placeholder test props, not the final character." loading="lazy" decoding="async">

---

<a id="e-20261001-0649-2"></a>**06:49 · shader · S7**

Round 2 of the toon shader kit in Blender: a cleaner face-shadow map that moves as one shape with the light, thin tinted hair highlight, no skin gloss, blush zones, painted-fold cloak with a real lace motif, and a new WuWa-style key+fill+rim lighting preset. Placeholder test props (template mannequin, stand-in hair and cloak), not the final character.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s7-shader-r2-blender-ca8c1c5c.webp" width="1600" height="1548" alt="Render sheet from the shader lane, stage S7: Round 2 of the toon shader kit in Blender: a cleaner face-shadow map that moves as one shape with the light, thin tinted hair highlight, no skin gloss, blush zones, painted-fold cloak with a real lace motif, and a new WuWa-style key+fill+rim lighting pres" loading="lazy" decoding="async">

---

<a id="e-20261001-0648"></a>**06:48 · gameplay · S9**

First combat pass on a stand-in mannequin, all driven by a scripted player: a five-hit chain with input buffering, charged attack, skill, dodge with invulnerability, perfect dodge into slow-motion and a counter, parry into a riposte, a swap intro/outro, and an ultimate with a cut-in camera. The moves, timing windows and numbers live in data, so C001's real animations replace the placeholder clips without touching the combat code.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s9-gameplay-combat-r1-8f1c1e13.webp" width="1600" height="739" alt="Render sheet from the gameplay lane, stage S9: First combat pass on a stand-in mannequin, all driven by a scripted player: a five-hit chain with input buffering, charged attack, skill, dodge with invulnerability, perfect dodge into slow-motion and a counter, parry into a riposte, a swap intro/outro," loading="lazy" decoding="async">

---

<a id="e-20261001-0634"></a>**06:34 · S5a hair · S5**

Hair round 4: the bob's sides are pulled in and the ends tuck toward the chin, and hair physics now keeps strands off the jaw and cheeks in motion. Numbers are inside the pro ranges, but side by side it still reads as a helmet of flat slabs. Next: switch method and trace a sculpted hair target into clumps, keeping all the rig, physics and hood plumbing.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-hair-r4-46439762.webp" width="683" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 4: the bob&#x27;s sides are pulled in and the ends tuck toward the chin, and hair physics now keeps strands off the jaw and cheeks in motion. Numbers are inside the pro ranges, but side by side it still reads as a helmet of flat slabs. Next: switc" loading="lazy" decoding="async">

---

<a id="e-20261001-0633"></a>**06:33 · S5a hair · S5**

Hair round 3: every clump of C001's bob is now its own hand-shaped curve instead of one generator rule. That gives an off-centre part, swept hero bangs, big smooth masses and a hem at the chin. The silhouette sits inside the range of 30 professional chin-length bobs (grey bands). Next: the crown still reads as stacked lids and the sides as flat slabs.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-hair-r3-54030137.webp" width="683" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 3: every clump of C001&#x27;s bob is now its own hand-shaped curve instead of one generator rule. That gives an off-centre part, swept hero bangs, big smooth masses and a hem at the chin. The silhouette sits inside the range of 30 professional chi" loading="lazy" decoding="async">

---

<a id="e-20261001-0616"></a>**06:16 · character-forge S3 body · S3**

C001's body got a smaller head (toward the concept's proportions), a slightly fuller bust and a smoothed neck base, shown in clay and wireframe so every polygon is visible; next up are the golden bone arms, hair and clothing.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s3-c001-body-v1b-69f726bb.webp" width="1600" height="781" alt="Render sheet from the character-forge S3 body lane, stage S3: C001&#x27;s body got a smaller head (toward the concept&#x27;s proportions), a slightly fuller bust and a smoothed neck base, shown in clay and wireframe so every polygon is visible; next up are the golden bone arms, hair and clothing." loading="lazy" decoding="async">

---

<a id="e-20261001-0615"></a>**06:15 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 2 of C001's bone arm: we switched from hand-coded shapes to a sculpt made by a 3D generator, cut to our own joint plan, retopologised and baked; the forearm is done this way and stays clash-free in every test pose. Next: cut the hand and upper arm from the same sculpt so no simple primitives remain.

<img src="/blog/characterforge-03-live-build-log/2026-10-01-s5-rigid-r2-98c8e2c8.webp" width="1600" height="1453" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 2 of C001&#x27;s bone arm: we switched from hand-coded shapes to a sculpt made by a 3D generator, cut to our own joint plan, retopologised and baked; the forearm is done this way and stays clash-free in every t" loading="lazy" decoding="async">

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
