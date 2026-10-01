---
title: CharacterForge update 05: first look at the whole character
summary: Every lane's latest part assembled on one character for the first time: bone arms, winged boots, gems, skin-tight clothing, a game skeleton, and a head being rebuilt.
date: 2026-10-01
---

CharacterForge is building one playable anime-style character (C001) in Blender and Unreal Engine. Since update 04, the project switched to a faster wave: 2AM's 48 modelling tutorials became 52 step-by-step build procedures, and six lanes now build in parallel (head, face, hair, clothing, bone arms and boots, rig). The headline of this update is the first whole-character view: a live assembly links every lane's latest part onto one figure, so every lane can see how its work sits with the others, and a new stitch lane fixes the seams where parts meet. The head is the weak spot: its measured shape is close to the pro target, but blind judges still pick the pro head every time because of creases on the cheeks and jaw, so it is being rebuilt as one clean mesh.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **35%** · Overall (Products 1 + 2): **19%** · Now: **S3 — Body + head topology** (first look at the whole character: every lane's latest part assembled live. Bone arms, boots and gems are done; skin-tight clothing and the rig have their first pass; the head is being rebuilt as one clean mesh; a new stitch lane is fixing the seams where parts meet)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 99% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 92% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 25% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 30% |
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

<a id="e-20261001-0847"></a>**08:47 · integration (global assembly) · S5**

Every part the lanes have built so far, linked onto one character and rendered together: clay, one colour per part and wireframe from four sides, the hair's hood state, seam close-ups and a game-distance view. The seams between parts are measured so the stitch lane knows where they do not meet yet.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-sint-assembly-r1-6b77c203.webp" width="667" height="1600" alt="Render sheet from the integration (global assembly) lane, stage S5: Every part the lanes have built so far, linked onto one character and rendered together: clay, one colour per part and wireframe from four sides, the hair&#x27;s hood state, seam close-ups and a game-distance view. The seams between part" loading="lazy" decoding="async">

---

<a id="e-20261001-0847-2"></a>**08:47 · S5 cloth · S5**

First clothing pass on C001: a woven strap harness, low-rise shorts with hip cut-outs, crossed thigh wraps, a choker and sheer stockings, each built from the body's own faces or swept along lines cut into it. Clay and wireframe views; the cloak and hood come next.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s5-cloth-r1-c19de427.webp" width="1600" height="1186" alt="Render sheet from the S5 cloth lane, stage S5: First clothing pass on C001: a woven strap harness, low-rise shorts with hip cut-outs, crossed thigh wraps, a choker and sheer stockings, each built from the body&#x27;s own faces or swept along lines cut into it. Clay and wireframe views; the cloak and hood" loading="lazy" decoding="async">

---

<a id="e-20261001-0845"></a>**08:45 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 7 of C001's rigid parts: the boots are now traced from the ghost model's boot (sleeker pointed toe, organic scrunched leather instead of regular rings), keeping the concept's low heel and wide winged cuffs; the foot inside stays complete. Next: the hood gems and tassel.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s5-rigid-r7-c1a9fed6.webp" width="1523" height="1600" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 7 of C001&#x27;s rigid parts: the boots are now traced from the ghost model&#x27;s boot (sleeker pointed toe, organic scrunched leather instead of regular rings), keeping the concept&#x27;s low heel and wide winged cuffs" loading="lazy" decoding="async">

---

<a id="e-20261001-0844"></a>**08:44 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 6 of C001's bone arm: the elbow is now one rounded knuckle instead of two bitten ends, the black holes are gone, and the arm is slimmed to the concept's proportions; it still bends cleanly with no clipping at about 5k triangles. Next: the boots.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s5-rigid-r6-e52b71a1.webp" width="1600" height="1344" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 6 of C001&#x27;s bone arm: the elbow is now one rounded knuckle instead of two bitten ends, the black holes are gone, and the arm is slimmed to the concept&#x27;s proportions; it still bends cleanly with no clipping" loading="lazy" decoding="async">

---

<a id="e-20261001-0843"></a>**08:43 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 8 of C001's rigid parts: the hood gems and the green gem tassel now match the concept's shapes (oval gems, a long hexagonal crystal and a leaf-shaped drop), the tassel hangs at chin-to-neck height beside her face, and the forehead gems sit in front of her bangs instead of inside them.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s5-rigid-r8-6683c1f9.webp" width="1539" height="1600" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 8 of C001&#x27;s rigid parts: the hood gems and the green gem tassel now match the concept&#x27;s shapes (oval gems, a long hexagonal crystal and a leaf-shaped drop), the tassel hangs at chin-to-neck height beside h" loading="lazy" decoding="async">

---

<a id="e-20261001-0837"></a>**08:37 · head-procedures (Opus 5.5) · S4 head v2 round D**

Round D of C001's head: the broken ear was rebuilt, the neck slimmed into a column set back under the chin, the chin and lip landmarks authored and the surface faired under raking light; blind judges still pick the pro head every time, mainly for the eye holes and the cheek and jaw creases, which are next.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s4-head-v2-d-134ae73e.webp" width="1410" height="1292" alt="Render sheet from the head-procedures (Opus 5.5) lane, stage S4 head v2 round D: Round D of C001&#x27;s head: the broken ear was rebuilt, the neck slimmed into a column set back under the chin, the chin and lip landmarks authored and the surface faired under raking light; blind judges still pick the pro" loading="lazy" decoding="async">

---

<a id="e-20261001-0832"></a>**08:32 · S6 rig · S6**

C001 now has a game skeleton with the same bone names and axes as Unreal's mannequin, plus skin weights, tested in a stress gym of 14 poses (clay and wireframe). Knees and elbows still pinch in deep bends; corrective shapes are next.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s6-rig-r1-86029a94.webp" width="668" height="1600" alt="Render sheet from the S6 rig lane, stage S6: C001 now has a game skeleton with the same bone names and axes as Unreal&#x27;s mannequin, plus skin weights, tested in a stress gym of 14 poses (clay and wireframe). Knees and elbows still pinch in deep bends; corrective shapes are next." loading="lazy" decoding="async">

---

<a id="e-20261001-0815"></a>**08:15 · head-procedures (Opus 5.5) · S4 head v2 (rounds A, B, C)**

C001's head is now built by procedures: a minimal cage subdivided twice into a 28-vertex-eye, 30-vertex-mouth layout, then fitted to a face target measured from 103 pro heads (shape error 0.123 -&gt; 0.03 eye-distances) while keeping the ghost's lower face where it looks good; the topology is frozen and the 25-key face kit regenerates on it.

<img src="/blog/characterforge-05-first-look-at-the-whole-character/2026-10-01-s4-head-v2-b7a3cce1.webp" width="897" height="1600" alt="Render sheet from the head-procedures (Opus 5.5) lane, stage S4 head v2 (rounds A, B, C): C001&#x27;s head is now built by procedures: a minimal cage subdivided twice into a 28-vertex-eye, 30-vertex-mouth layout, then fitted to a face target measured from 103 pro heads (shape error 0.123 -&amp;gt; 0.03 eye-d" loading="lazy" decoding="async">


Previous update: [CharacterForge update 04: the bone arm gets a real upper arm](/blog/characterforge-04-the-bone-arm-gets-a-real-upper/)
