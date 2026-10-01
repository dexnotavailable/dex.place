---
title: CharacterForge update 07: the hood, the cloak and blind tests against pro faces
summary: C001's silhouette now matches the concept: a peaked hood with its striped crest, layered shoulder pieces and a flared cloak. The face and head now face fair blind tests against pro faces.
date: 2026-10-01
---

CharacterForge is building one playable anime-style character (C001) in Blender and Unreal Engine. Since update 06 the clothing lane gave her the peaked hood, built by script around her hair so it re-fits whenever the hair changes, with the striped crest where the green gems sit, plus layered fabric shoulder pieces and a cloak that flares out like a bell to a wavy lace hem. The head got a compact skull, a proper ear and a clean closed mouth, and the hair now reads as a bob with long bangs. The face and head went through their first fair blind tests: the same renderer for ours and six held-out pro heads. The pros still win every pair; the judge rates our iris as the most professional part and points mostly at the head shape (a lightbulb outline and a realistic nose), which is the next fix. From here every part, including the cloth, the boots and the skeletal hands, is scored against pro models each round.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **39%** · Overall (Products 1 + 2): **21%** · Now: **S3 — Body + head topology** (her silhouette now matches the concept (peaked hood with crest, shoulder pieces, flared cloak). Face and head are being pushed against blind tests with pro faces; every part is now scored against pro models)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 99% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 92% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 45% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 42% |
| S6 | Rig, weights, correctives, physics | ▶ in progress, 10% |
| S7 | Texturing + materials (Kuro-look NPR, Blender to Unreal) | ▶ in progress, 30% |
| S8 | Unreal import, motion, motion-matching locomotion | ▶ in progress, 35% |
| S9 | Combat kit + VFX | ▶ in progress, 20% |
| S10 | Full blind test (Product 1) | ○ not started |
| S11 | Chassis + C002 + C003 + provider swap tests (Product 2) | ○ not started |

*As of 2026-10-01. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## What landed

Newest first. Times are local time at the build machine (UTC+7).

### 2026-10-01

<a id="e-20261001-0945"></a>**09:45 · S5 cloth · S5**

The hood now carries its striped crest: black strips slanting over the brow where the gems will sit, with two ribbons trailing on her right, and it has been re-fitted by script to the latest hair. Clay and wireframe views.

<img src="/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/2026-10-01-s5-cloth-r4-40ab3158.webp" width="1600" height="1307" alt="Render sheet from the S5 cloth lane, stage S5: The hood now carries its striped crest: black strips slanting over the brow where the gems will sit, with two ribbons trailing on her right, and it has been re-fitted by script to the latest hair. Clay and wireframe views." loading="lazy" decoding="async">

---

<a id="e-20261001-0944"></a>**09:44 · S4 face · S4**

Round 3 of C001's face kit leads with the eye, the biggest tell in the last blind test: a heavier lash band with eyeliner, a larger darker iris tucked under the lower lid, and an eye plate that now sits almost flush; stronger lip and nose lines, an always-on soft blush and lower, heavier brows complete it.

<img src="/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/2026-10-01-s4-face-v2-r3-c399ecb9.webp" width="1064" height="1600" alt="Render sheet from the S4 face lane, stage S4: Round 3 of C001&#x27;s face kit leads with the eye, the biggest tell in the last blind test: a heavier lash band with eyeliner, a larger darker iris tucked under the lower lid, and an eye plate that now sits almost flush; stronger lip and nose lines, an alway" loading="lazy" decoding="async">

---

<a id="e-20261001-0930"></a>**09:30 · S4 face · S4**

Round 2 of C001's face kit rides the latest head by vertex index, all 52 expression keys now pass the clipping checks, and the mouth shapes A I U E O open as distinct shapes after fixing swapped upper/lower lip flags; this round also ran the first blind look test with the real eyes in place.

<img src="/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/2026-10-01-s4-face-v2-r2-4503cb0d.webp" width="1064" height="1600" alt="Render sheet from the S4 face lane, stage S4: Round 2 of C001&#x27;s face kit rides the latest head by vertex index, all 52 expression keys now pass the clipping checks, and the mouth shapes A I U E O open as distinct shapes after fixing swapped upper/lower lip flags; this round also ran the first blind" loading="lazy" decoding="async">

---

<a id="e-20261001-0928"></a>**09:28 · S5 cloth · S5**

C001 now wears her peaked hood, built by script on the inside of the hair's hood-on shape, over a re-shaped cloak that flares out from the shoulders in big folds to a wavy lace hem, with pointed fabric pieces on the shoulders. Clay and wireframe views.

<img src="/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/2026-10-01-s5-cloth-r3-9f6ea77b.webp" width="1600" height="1307" alt="Render sheet from the S5 cloth lane, stage S5: C001 now wears her peaked hood, built by script on the inside of the hair&#x27;s hood-on shape, over a re-shaped cloak that flares out from the shoulders in big folds to a wavy lace hem, with pointed fabric pieces on the shoulders. Clay and wireframe views." loading="lazy" decoding="async">

---

<a id="e-20261001-0927"></a>**09:27 · S5a hair · S5**

Hair round 7: the bob now has two real layers, outer clumps that grow out of the crown and lie over a tucked under-layer, and the volume moved down so it hugs the skull on top and is fullest at the cheeks, with a long chunky fringe and a clump between the eyes. A new two-tone view shows the darker undersides; side by side it still reads too smooth, so next round pushes the clumps further apart.

<img src="/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/2026-10-01-s5-hair-r7-33669019.webp" width="593" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 7: the bob now has two real layers, outer clumps that grow out of the crown and lie over a tucked under-layer, and the volume moved down so it hugs the skull on top and is fullest at the cheeks, with a long chunky fringe and a clump between t" loading="lazy" decoding="async">

---

<a id="e-20261001-0917"></a>**09:17 · head-procedures (Opus 5.5) · S4 head v2 round F**

Round F kept the one-cage head and fixed its proportions: a smaller round skull, a neck that steps cleanly out of the back of the head, a bigger ear with a rim and bowl, and the mouth pouch tucked behind the lips so the closed mouth reads as a line.

<img src="/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/2026-10-01-s4-head-v2-f-28c6f34e.webp" width="1410" height="984" alt="Render sheet from the head-procedures (Opus 5.5) lane, stage S4 head v2 round F: Round F kept the one-cage head and fixed its proportions: a smaller round skull, a neck that steps cleanly out of the back of the head, a bigger ear with a rim and bowl, and the mouth pouch tucked behind the lips so the" loading="lazy" decoding="async">


Previous update: [CharacterForge update 06: real eyes, a clean head and the cloak](/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/)
