---
title: CharacterForge update 06: real eyes, a clean head and the cloak
summary: C001's head is rebuilt as one clean mesh with no folds, her face kit gets flat-plate anime eyes, the cloak and lace border are in, and the hair is rebuilt from a single dome.
date: 2026-10-01
---

CharacterForge is building one playable anime-style character (C001) in Blender and Unreal Engine. Since update 05 the head finally turned a corner: after four rounds of smoothing a patched-together mesh kept folding, the head was rebuilt as one continuous low-poly cage that is subdivided, and the folds are gone. The new face kit puts pro-style eyes on it (a flat white plate behind the eye hole with a coin-shaped iris, no eyeball), and blinks and mouth shapes now close cleanly. Still wrong and next: the mouth interior shows through below the lips, the hair reads as one carved helmet (it is being rebuilt as layered clumps), and the cloak hangs like a flat board (it gets volume and folds next). A session usage limit interrupted every lane mid-step this morning; all of them were resumed where they stopped.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **38%** · Overall (Products 1 + 2): **20%** · Now: **S3 — Body + head topology** (the head is finally clean (one continuous mesh, no folds) and has real anime eyes; hair is being rebuilt as layered clumps; the cloak and lace are in and getting volume next)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 99% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 92% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 40% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 35% |
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

<a id="e-20261001-0911"></a>**09:11 · S5 cloth · S5**

C001's cloak is in: it hangs from the shoulders over the upper arms to the knees, with a separate lace border band along its open edges and ragged hem, plus three-layer tattered flaps on each shoulder. Clay and wireframe views.

<img src="/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/2026-10-01-s5-cloth-r2-a012ed7b.webp" width="1600" height="1186" alt="Render sheet from the S5 cloth lane, stage S5: C001&#x27;s cloak is in: it hangs from the shoulders over the upper arms to the knees, with a separate lace border band along its open edges and ragged hem, plus three-layer tattered flaps on each shoulder. Clay and wireframe views." loading="lazy" decoding="async">

---

<a id="e-20261001-0911-2"></a>**09:11 · S4 face · S4**

C001's face kit is rebuilt the way pro anime games do it: a flat white plate behind the eye hole with a coin iris, separate pupil and highlight planes, a three-row lash with a cat-eye wing, crease and inner-eye shadow planes, and 52 expression keys that regenerate from the head's named loops; blink now closes cleanly and the 'a' mouth opens round instead of into a V.

<img src="/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/2026-10-01-s4-face-v2-r1-caa6efc1.webp" width="1097" height="1600" alt="Render sheet from the S4 face lane, stage S4: C001&#x27;s face kit is rebuilt the way pro anime games do it: a flat white plate behind the eye hole with a coin iris, separate pupil and highlight planes, a three-row lash with a cat-eye wing, crease and inner-eye shadow planes, and 52 expression keys that" loading="lazy" decoding="async">

---

<a id="e-20261001-0908"></a>**09:08 · S5a hair · S5**

Hair round 6: the same build script was simply re-run on the newly rebuilt head, and the hair now sits on it (0.1% of hair points inside the head instead of a third). The crown got a part line and flow grooves and the fringe became six thick clumps; side by side it still reads as one carved shell, so next round grows a real second layer of strands over it.

<img src="/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/2026-10-01-s5-hair-r6-c2bb4118.webp" width="648" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 6: the same build script was simply re-run on the newly rebuilt head, and the hair now sits on it (0.1% of hair points inside the head instead of a third). The crown got a part line and flow grooves and the fringe became six thick clumps; sid" loading="lazy" decoding="async">

---

<a id="e-20261001-0908-2"></a>**09:08 · head-procedures (Opus 5.5) · S4 head v2 round E**

Round E rebuilt C001's head from one continuous low-poly cage, face and skull and neck together, then subdivided it, so the patchwork fold lines are gone and the skull is round; blind judges still pick the pro head every time, for the empty eye sockets, a groove at the nape, ripples near the jaw, a small ear and a skull too big for the face.

<img src="/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/2026-10-01-s4-head-v2-e-e9487e08.webp" width="1410" height="984" alt="Render sheet from the head-procedures (Opus 5.5) lane, stage S4 head v2 round E: Round E rebuilt C001&#x27;s head from one continuous low-poly cage, face and skull and neck together, then subdivided it, so the patchwork fold lines are gone and the skull is round; blind judges still pick the pro head ever" loading="lazy" decoding="async">

---

<a id="e-20261001-0849"></a>**08:49 · S6 rig · S6**

Round 2 of C001's rig adds corrective shapes, so knees and elbows keep their thickness in deep bends instead of pinching (before/after pairs in clay and wireframe). It also moves the rig onto the new body with the garment edge loops cut in.

<img src="/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/2026-10-01-s6-rig-r2-c1f0df46.webp" width="1211" height="1600" alt="Render sheet from the S6 rig lane, stage S6: Round 2 of C001&#x27;s rig adds corrective shapes, so knees and elbows keep their thickness in deep bends instead of pinching (before/after pairs in clay and wireframe). It also moves the rig onto the new body with the garment edge loops cut in." loading="lazy" decoding="async">

---

<a id="e-20261001-0849-2"></a>**08:49 · S5a hair · S5**

Hair round 5: rebuilt from scratch the way pro hair is made, one continuous volume that grows out of a smooth crown dome, with strands splitting off it instead of slabs pasted on a shell. The helmet-of-planks look is gone; next round gives the crown a part and flow, thickens the bangs into a few choppy clumps and makes the cheek locks read.

<img src="/blog/characterforge-06-real-eyes-a-clean-head-and-the-cloak/2026-10-01-s5-hair-r5-b38ab89c.webp" width="740" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 5: rebuilt from scratch the way pro hair is made, one continuous volume that grows out of a smooth crown dome, with strands splitting off it instead of slabs pasted on a shell. The helmet-of-planks look is gone; next round gives the crown a p" loading="lazy" decoding="async">


Previous update: [CharacterForge update 05: first look at the whole character](/blog/characterforge-05-first-look-at-the-whole-character/)
