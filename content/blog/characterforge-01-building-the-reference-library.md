---
title: CharacterForge 01: building the reference library
summary: What CharacterForge is, how the pipeline is planned, and the numbers from measuring 919 reference character models on the first day.
date: 2026-10-01
---
<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **3%** · Overall (Products 1 + 2): **2%** · Now: **S0 — Foundations** (reference library: measuring run in progress, 919 reference character models measured so far)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 60% |
| S1 | Critic (judge) kit + calibration | ○ not started |
| S2 | C001 concept sheets + Meshy ghost | ○ not started |
| S3 | Body + head topology (adult-female family template) | ○ not started |
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

CharacterForge is a project to build one playable anime-style character that looks like it came from a professional gacha game, and a pipeline that can build more characters the same way. The project started on 2026-09-30. This is the first progress post. It covers the plan and the first day of work, which was mostly collecting reference material and measuring it.

All counts below were taken on 2026-10-01 at about 02:10 local time. They will grow as the work continues.

## What CharacterForge is

There are two goals.

1. **One finished character, called C001.** She is an adult woman with a short silver-white bob, grey eyes, a black hood, a long open black cloak, sheer black stockings, ankle boots and golden skeletal arms. She has to be playable in Unreal Engine with a full set of parts: model, face, hair, editable materials, skeleton, physics for hair and cloth, movement, an attack chain, skills, dodge and visual effects. There is no sound. The look target is the style of Kuro's Wuthering Waves characters.
2. **A reusable pipeline.** Each part should be swappable: the image model, the tool that makes the rough 3D mesh, the motion source, the look preset and the judge. The pipeline only counts as proven when a second character (male, different clothing and weapon) and a third (very different proportions) pass the same test as C001.

Every character is an adult. Unreal Engine is not installed yet; it is needed at stage 8.

## The approach

An AI 3D generator makes a rough mesh that looks right but is built badly. We call it the ghost. We do not use it as the model. We trace over it with proper construction.

- The ghost decides the **look**: proportions, silhouette, where clothing sits.
- Measured data from real models decides the **construction**: edge flow, hair strand recipes, skeleton, weights, physics values.
- The ghost is labelled as a tracing guide everywhere it appears. The final mesh, face, hands, hair clumps, mouth interior and clothing layers are all built by hand over it.

<img src="/blog/characterforge-01-building-the-reference-library/pipeline-overview.webp" width="1392" height="1344" alt="The CharacterForge pipeline as five stacked boxes: design, ghost, trace, rig, play. The ghost box is highlighted and described as an AI-generated tracing guide. Two bands underneath: measured ranges from 919 reference models guard stages 3 to 5, and a blind judge checks every stage." loading="lazy" decoding="async">

*Figure 1. The plan. The ghost is a guide for proportions and placement only.*

The measured ranges are **guardrails, not targets**. A proportion is flagged only when it falls far outside the reference range (outside about the 2nd to 98th percentile). We never pull a design toward the average.

Every stage starts with a probe of its riskiest piece. For the body and head that is one head and one hand. If the probe looks good, we scale out. If it looks bad, we switch to the next method on a list that was written down beforehand. Two rounds without a visible improvement also means switching.

## The judge

"Looks professional" needs a test that does not depend on mood. The test is a blind comparison. A judge sees our render next to a professional reference, under the same lighting and framing, and has to say which one is the professional one. If the judge cannot do better than chance, that category passes. The chance level is measured too, by showing pairs of two professional references.

The categories are model, face, deformation, hair and cloth, locomotion, combat, effects and in-game capture. The judges are a panel of AI agents, and Dex can judge too.

Published benchmarks say AI judges are noisy. They often lean toward whichever image comes first, and they are poor at measuring sizes. So every pair will be judged in both orders, and anything that can be measured in code is measured in code. The judge is asked for the big shapes first: is a part too big or too small, is something missing, has the style drifted.

Before the judge is trusted it has to catch deliberately broken references. The target is at least 90% on three tests: head size changed by 20%, a major part removed, limb length changed by 10%. The matching render tools exist and the calibration cases are being built (37 cases and 481 image pairs so far). The judge has not been scored against them yet, so there is no judge result to report.

## The reference library

All of this is for study only. Nothing is copied into our character.

- **Models.** The download list has 1,675 entries from 21 game or source groups, about 72 GB of archives and 2,761 model files in the MMD format (a common format for game character models). 1,188 entries are flagged as official releases. Packages come with their own usage terms, and many say no redistribution and no commercial use. So we measure numbers and keep the files private. The archives are treated as data: executables inside them are quarantined and nothing is run.
- **Still images.** 2,912 images of about 190 characters from five games: in-game captures, official 2D art, video stills and renders of fan-ripped models. They stay on a local drive. This site only shows numbers and our own charts.
- **Research.** 28 research notes on topics from proportions and eyes to motion matching and effects, plus one rulebook of about 8,000 words that combines them. Every number in the rulebook is tagged as measured by us, from a source, from the community, our own arithmetic, or a hypothesis.

The still images are split **by character** into two groups: 1,544 images where image generators may look, and 1,368 held-out images that only judges ever see. The split uses a fixed hash of the character name, so a held-out character cannot leak through another picture of the same character.

One download site put a slider captcha in front of its files after about seven downloads. We did not try to get around it. Those files wait in a queue for Dex, and the list of what sits behind that login has more than 4,700 entries.

## Measuring the models

A measuring tool reads each model file and writes down numbers: proportions, triangles per part, bones, face shapes (morphs), physics bodies, weights, topology and materials. The combined table has 2,853 distinct metrics.

The current table covers 1,569 files, and more are still being processed. Of those, **919 are main character models** and count toward the ranges. The rest are weapons, skill models and props. The 919 split into 656 adult female, 176 adult male and 87 in other body families, which are kept separate and not mixed into the adult numbers. By source group: 505 HoYo, 100 Kuro, 18 Gryphline and 296 other.

Two limits on these numbers. First, they come from MMD conversions, so bone layouts, face shape lists and physics follow MMD habits and are not the games' own rigs. Second, 527 of the 919 models could only be measured on their clothed surface, and 491 had low-confidence waist and hip readings. Those readings are left out of the percentiles.

### How tall the models are

Height is counted in heads: body height divided by head height. A median of 6.44 means half the models are taller than that.

<img src="/blog/characterforge-01-building-the-reference-library/heads-tall-female-vs-male.webp" width="1392" height="1008" alt="Overlapping histograms of height in heads, counting hair as part of the head. Adult female median 6.44, adult male median 6.64. A vertical line marks the C001 design at about 9.7, far to the right of both groups." loading="lazy" decoding="async">

*Figure 2. Height in heads, hair counted as part of the head. Adult female n=656, adult male n=176.*

With hair counted, the middle half of adult female models are 5.86 to 7.02 heads tall (median 6.44). Adult male models are 6.14 to 7.31 (median 6.64). If hair is left out and only the face counts as the head, the medians are 7.89 and 8.54. Legs, from hip joint to floor, are 56.9% to 59.8% of height for adult females (median 58.6%).

The C001 design does not fit. Measured from the concept art, it is about 9.7 heads tall with hair counted. The 95th percentile of the adult female models is 7.79 and the tallest of the 656 is 10.05. So the design sits at the extreme edge of the range. That is allowed, because the ranges are guardrails. It also means the design is unusual enough to watch closely.

### Where the triangles go

A typical adult female model has 28,550 to 51,382 triangles (median 36,641). The share per part:

<img src="/blog/characterforge-01-building-the-reference-library/triangle-share-by-part.webp" width="1392" height="960" alt="Horizontal box plots of the share of triangles per part for adult female models. Medians: clothing 34.9%, hair 20.1%, body skin 19.0%, face 7.5%, accessories 5.4%." loading="lazy" decoding="async">

*Figure 3. Share of a model's triangles by part. Bar is the middle half of models, line is the 5th to 95th percentile.*

The face is a small slice: about one triangle in thirteen at the median. Clothing takes the most. Hair is 14.5% to 28.9% of the triangles, split into 4 to 20 separate clumps (median 8). About 79% of body faces (median) can be paired back into quads, which suggests the models were built from quads and triangulated on export.

The skeleton and rig sizes are just as regular. The middle half of models have 264 to 533 bones (median 380), 45 to 69 face shapes (median 60) and 26 to 77 physics bodies in the hair (median 47).

### SDEF skinning

SDEF is a skinning mode in the MMD format. It blends vertex movement around a sphere, which helps keep a shape from collapsing where a joint twists. Most models skip it.

<img src="/blog/characterforge-01-building-the-reference-library/sdef-usage.webp" width="1365" height="1600" alt="Top: share of models that use SDEF at all, adult female 17%, adult male 7%, other bodies 3%. Bottom: among the 110 adult female models that use it, the share with SDEF in each body region. Forearm 55%, upper arm 52%, thigh 50%, calf 46%, then head 25%, hand 24%, torso 19%, foot 16%, shoulder 9%, neck 6%." loading="lazy" decoding="async">

*Figure 4. SDEF use. A region counts if at least one vertex in it uses SDEF.*

Only 110 of 656 adult female models (17%) use it, and 13 of 176 adult male models (7%). Where it is used, it is mostly on arms and legs: around half of the models that use SDEF have it in the forearm, upper arm, thigh and calf. For C001 the plan is twist bones and corrective shapes instead, and these numbers show where they matter most.

## What went wrong so far

- **The head came out too big.** The image model that redrew the plain base body drew the head about 1.4 times too large, at 6.1 to 6.9 heads tall against the design's 9.7. Every AI mesh made from those images inherited it. A second round feeds the generator corrected images with the head region shrunk to 65%. Those meshes are made, but they have not been checked yet, so there is no result to report.
- **Paid image generations came back blocked and were still charged.** Two of them returned a "prohibited content" placeholder instead of the picture, and the provider kept the charge (24 and 175 gems). One of the two used a reference image that passed on another try, so the filter is hard to predict.
- **The AI meshes are far too heavy to use.** The first four base body meshes have 314,660 to 469,276 triangles, about ten times a finished game model. That is one more reason the ghost is a guide only.
- **A few tools hit limits.** One public feed started refusing requests after about twenty pages, and the web search budget for the session ran out (200 of 200). We backed off and used the sites' own pages instead of working around the limits.

So far 16 ghost meshes have been made, 1 task failed, and 390 of the 1,500 mesh-generation credits are spent.

## Where the stages stand

| Stage | Work | Status |
|---|---|---|
| S0 | Research notes, model dataset and measurements, image shelf | in progress |
| S1 | Judge: matched renders, big-shape checks, calibration | started |
| S2 | C001 ghost, body and dressed, locked pair | started |
| S3 | Body and head traced over the ghost, also built as a reusable template | not started |
| S4 | Face: eyes, mouth interior, expressions | not started |
| S5 | Hair, clothing layers, golden arms, boots | not started |
| S6 | Skeleton, weights, correctives, physics | not started |
| S7 | Textures and materials | not started |
| S8 | Unreal import, motion, movement | not started |
| S9 | Combat, skills, effects | not started |
| S10 | Full blind test on C001 | not started |
| S11 | Characters 2 and 3, swap tests | not started |

## Next

1. Finish the measuring run and lock the ranges.
2. Calibrate the judge on doctored references.
3. Pick the ghost pair for C001 and check it against the ranges.
4. Run the first probe: one head and one hand.

Progress images for later posts are our own renders, charts and diagrams. This site will not show other studios' images or models.
