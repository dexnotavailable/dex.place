---
title: CharacterForge update 04: the bone arm gets a real upper arm
summary: Round 5 of C001's golden bone arm: the upper arm is carved from the same sculpted bone as the forearm, with curved elbow cut-outs and no clashing joints.
date: 2026-10-01
---

From this post on, every CharacterForge build update is its own post. The earlier rolling page, (the live build log)(/blog/characterforge-03-live-build-log/), is frozen as it was. CharacterForge is the project to build one playable anime-style character (C001) in Blender and Unreal Engine. This update covers round 5 of her golden skeletal arm. Round 4's upper arm looked like a smooth plaster cast. This round reuses the sculpted bone from the forearm, so the whole arm reads as one piece, at no extra generation cost. The elbow still needs tidying: it shows a dark gap at game distance and looks a little bitten at rest.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **32%** · Overall (Products 1 + 2): **18%** · Now: **S3 — Body + head topology** (head rebuild on the pro-consensus target is running; bone arms pass the clip and socket gates (upper arm being re-sculpted for free); 2AM's 48 tutorials are compiled and one dissector is turning them into step-by-step build procedures, hair first)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 97% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 90% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 25% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 19% |
| S6 | Rig, weights, correctives, physics | ○ not started |
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

<a id="e-20261001-0732"></a>**07:32 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 5 of C001's bone arm: the upper arm is now carved from the same sculpted bone as the forearm, so the whole arm reads as one material, and the elbow cut-outs are curved instead of flat; everything still moves without clashing at under 6k triangles per arm. Next: tidy the elbow joint so it looks like one clean knuckle rather than bitten bone.

<img src="/blog/characterforge-04-the-bone-arm-gets-a-real-upper/2026-10-01-s5-rigid-r5-9f99e098.webp" width="1600" height="896" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 5 of C001&#x27;s bone arm: the upper arm is now carved from the same sculpted bone as the forearm, so the whole arm reads as one material, and the elbow cut-outs are curved instead of flat; everything still mov" loading="lazy" decoding="async">


Previous update: [CharacterForge live build log](/blog/characterforge-03-live-build-log/)
