---
title: CharacterForge update 08: switching to a VRoid base and scoring every part against pros
summary: Blind tests showed C001's procedurally built head could not pass for professional, so her base head and body switch to a vetted VRoid base; a stitch lane now joins the parts and every part gets a score against pro models.
date: 2026-10-01
---

CharacterForge is building one playable anime-style character (C001) in Blender and Unreal Engine. Since update 07 the project started scoring every part against professional game models in blind pairs, and the honest result is that every part is still clearly unfinished (1.5 to 2.5 out of 10). The biggest decision: after many rounds, the head we built procedurally still lost every blind test on its shape (a light-bulb skull, no V jaw, a neck straight off the chin). A probe with a VRoid-made base body that Dex vetted for an earlier project removed every head-shape complaint in the same test, so C001's base head and body switch to it, stripped to bare clay; her own eyes, hair, clothes, materials and gold bone arms go on top. Also new: a stitch lane that joins the parts (the neck seam now has no line, the shoulder socket closes around the bone arm), the rig standing her on her heels and importing into Unreal with the mannequin's skeleton, one-piece boots, a clean jointed bone hand, and hair now built from separate clumps.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **41%** · Overall (Products 1 + 2): **22%** · Now: **S3 — Body + head topology** (after blind tests against pro heads, C001's base head and body are switching to a VRoid-made base that Dex vetted earlier; her own eyes, hair, clothes and gold bone arms go on top. Every part is now scored against pro models)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 99% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 80% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 45% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 45% |
| S6 | Rig, weights, correctives, physics | ▶ in progress, 35% |
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

<a id="e-20261001-1120"></a>**11:20 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 10 of C001's rigid parts: the boots are rebuilt as one clean boot (pointed toe, real sole and heel, a rolled funnel cuff), the bone forearm now shows two bones, the hands are clean jointed bone hands in a relaxed pose, the gem tassel hangs from the hood as a cord with a cluster of drops, and a pendant chain hangs from the choker.

<img src="/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/2026-10-01-s5-rigid-r10-3a2b36c5.webp" width="1266" height="1600" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 10 of C001&#x27;s rigid parts: the boots are rebuilt as one clean boot (pointed toe, real sole and heel, a rolled funnel cuff), the bone forearm now shows two bones, the hands are clean jointed bone hands in a" loading="lazy" decoding="async">

---

<a id="e-20261001-1112"></a>**11:12 · S5a hair · S5**

Hair round 11 went after the outline and the hem: the hair now ends at the chin with varied tips over a full second layer, the back no longer balloons, and the fringe has two dominant clumps. Every silhouette measure is now inside the professional range, but the sides still stand off the temples, and we found why: the crown layer keeps a minimum distance from the skull that overrides the narrower outline, which is the next fix.

<img src="/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/2026-10-01-s5-hair-r11-57e977d1.webp" width="576" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 11 went after the outline and the hem: the hair now ends at the chin with varied tips over a full second layer, the back no longer balloons, and the fringe has two dominant clumps. Every silhouette measure is now inside the professional range" loading="lazy" decoding="async">

---

<a id="e-20261001-1035"></a>**10:35 · VRoid base probe · S3**

Probe: a VRoid-made anime base stripped to a bare body (hair, clothes and texture removed) next to our current build, same cameras, clay and wire only. Left is the base, right is ours. The base shows what a working anime head, jaw, ear and neck look like on a clean quad grid; deciding how much of it we adopt is the next step.

<img src="/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/2026-10-01-s3-vroid-probe-25d20e4a.webp" width="1600" height="582" alt="Render sheet from the VRoid base probe lane, stage S3: Probe: a VRoid-made anime base stripped to a bare body (hair, clothes and texture removed) next to our current build, same cameras, clay and wire only. Left is the base, right is ours. The base shows what a working anime head, jaw, ear and neck" loading="lazy" decoding="async">

---

<a id="e-20261001-1013"></a>**10:13 · S4 face · S4**

Round 5 of C001's face kit on the newest head: closed eyes now shut flat instead of bulging, the upper lid and lash rim read as a solid edge even in grey clay, and a small soft nose shadow lets the nose show at three-quarter view.

<img src="/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/2026-10-01-s4-face-v2-r5-4c619d43.webp" width="1064" height="1600" alt="Render sheet from the S4 face lane, stage S4: Round 5 of C001&#x27;s face kit on the newest head: closed eyes now shut flat instead of bulging, the upper lid and lash rim read as a solid edge even in grey clay, and a small soft nose shadow lets the nose show at three-quarter view." loading="lazy" decoding="async">

---

<a id="e-20261001-1011"></a>**10:11 · stitch (seams + junctions) · S5**

The stitch lane rebuilds the character from every lane's latest part and fixes where they meet: the shoulder ring now closes around the golden bone arm, and the neck rings of head and body line up one to one.

<img src="/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/2026-10-01-sstitch-r1-76bcd62d.webp" width="680" height="1126" alt="Render sheet from the stitch (seams + junctions) lane, stage S5: The stitch lane rebuilds the character from every lane&#x27;s latest part and fixes where they meet: the shoulder ring now closes around the golden bone arm, and the neck rings of head and body line up one to one." loading="lazy" decoding="async">

---

<a id="e-20261001-0947"></a>**09:47 · S6 rig · S6**

C001's rig now stands her on her boot heels in the shared assembly instead of letting the heels sink 4 cm into the floor, and her skeleton imports into Unreal 5.8 with exactly the mannequin's bone names, hierarchy and axes. All renders are our own models.

<img src="/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/2026-10-01-s6-rig-r3-a756b394.webp" width="1600" height="995" alt="Render sheet from the S6 rig lane, stage S6: C001&#x27;s rig now stands her on her boot heels in the shared assembly instead of letting the heels sink 4 cm into the floor, and her skeleton imports into Unreal 5.8 with exactly the mannequin&#x27;s bone names, hierarchy and axes. All renders are our own models." loading="lazy" decoding="async">


Previous update: [CharacterForge update 07: the hood, the cloak and blind tests against pro faces](/blog/characterforge-07-the-hood-the-cloak-and-blind-tests-against-pro-faces/)
