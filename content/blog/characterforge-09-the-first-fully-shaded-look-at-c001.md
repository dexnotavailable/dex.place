---
title: CharacterForge update 09: the first fully shaded look at C001
summary: C001 is assembled and shaded for the first time: VRoid-based head and body with her own face, the adapted bob, the full outfit, gold bone arms and boots, all scored blind against pro models.
date: 2026-10-01
---

CharacterForge is building one playable anime-style character (C001) in Blender and Unreal Engine. This update is the first time she looks like herself: every part assembled, posed on her heels and shaded with our own Kuro-style toon materials (the top image, under four lighting presets, including the hand-drawn face shadow sweep). Since update 08 the base switched to a VRoid body Dex vetted earlier, with her proportions applied by script and checked against pro ranges; her face kit, the adapted VRoid bob, the full outfit (hood with crest gems, cloak, harness, V brief, wraps, sheer stockings), the gold bone arms and the boots sit on top. Every part is scored in blind pairs against professional game models, now with several fresh judges and pro-versus-pro control pairs so the numbers are trustworthy: the bone arms reached pro parity, the boots sit within the normal spread between two pro boots, and the face is about 17 points above the 'can't tell' line. Next: hair clumps, the surprise mouth and iris, cloak drape, then into Unreal for motion and combat.

Only our own renders appear here. No concept art, no other studios' models or stills, and the AI-made ghost mesh is never shown without a tracing-guide label.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Product 1 (playable character): **47%** · Overall (Products 1 + 2): **25%** · Now: **S3 — Body + head topology** (C001 is now fully assembled and shaded: VRoid-based head and body with her own face kit, adapted VRoid bob, the whole outfit, gold bone arms and boots, rigged for Unreal. Every part is scored blind against pro models; the boots and bone arms are near pro level, the face is about 17 points above the 'can't tell' line)

**Roadmap.** S0 to S10 are Product 1, S11 is Product 2.

| Stage | Work | Status |
|---|---|---|
| S0 | Foundations: research, MMD dataset + metrics, reference shelf | ▶ in progress, 99% |
| S1 | Critic (judge) kit + calibration | ✅ done |
| S2 | C001 concept sheets + Meshy ghost | ✅ done |
| S3 | Body + head topology (adult-female family template) | ▶ in progress, 92% |
| S4 | Face system: eyes, mouth interior, expressions, face shading | ▶ in progress, 55% |
| S5 | Hair, clothing layers, bone arms, boots | ▶ in progress, 55% |
| S6 | Rig, weights, correctives, physics | ▶ in progress, 45% |
| S7 | Texturing + materials (Kuro-look NPR, Blender to Unreal) | ▶ in progress, 45% |
| S8 | Unreal import, motion, motion-matching locomotion | ▶ in progress, 35% |
| S9 | Combat kit + VFX | ▶ in progress, 20% |
| S10 | Full blind test (Product 1) | ○ not started |
| S11 | Chassis + C002 + C003 + provider swap tests (Product 2) | ○ not started |

*As of 2026-10-01. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## What landed

Newest first. Times are local time at the build machine (UTC+7).

### 2026-10-01

<a id="e-20261001-1352"></a>**13:52 · S4 face · S4**

Round 10 of C001's face kit on the latest base head: the upper eyelid now overhangs the top of the iris, the lash rim is thinner, the surprised face opens the jaw instead of pushing the lips into an O, and the keyed head now hides the organic arms so the bone arms show. A new blind test with six fresh judges still told our face from professional ones every time, mainly from the surprised mouth and a ring-like eye rim in grey clay renders.

<img src="/blog/characterforge-09-the-first-fully-shaded-look-at-c001/2026-10-01-s4-face-v2-r10-ddc8b278.webp" width="1064" height="1600" alt="Render sheet from the S4 face lane, stage S4: Round 10 of C001&#x27;s face kit on the latest base head: the upper eyelid now overhangs the top of the iris, the lash rim is thinner, the surprised face opens the jaw instead of pushing the lips into an O, and the keyed head now hides the organic arms so the" loading="lazy" decoding="async">

---

<a id="e-20261001-1344"></a>**13:44 · S7 shader + texturing · S7**

C001's skin is re-painted on the newest base: the chin shadow now follows her real jaw line, the neck paints cleanly in one strip, and her new separate ears carry their own painted inner-ear shading, shown under four lighting presets.

<img src="/blog/characterforge-09-the-first-fully-shaded-look-at-c001/2026-10-01-s7-shader-r5-f444414d.webp" width="1036" height="1600" alt="Render sheet from the S7 shader + texturing lane, stage S7: C001&#x27;s skin is re-painted on the newest base: the chin shadow now follows her real jaw line, the neck paints cleanly in one strip, and her new separate ears carry their own painted inner-ear shading, shown under four lighting presets." loading="lazy" decoding="async">

---

<a id="e-20261001-1339"></a>**13:39 · S5b rigid parts (bone arms, boots, hood ornaments) · S5**

Round 13 of C001's rigid parts: the boots get the concept's folded cuff (a turned-down flaring band over a binding strap), a fuller pointed toe, seam lines set into the leather and separate colour zones for toe cap, sole, heel and trim; in blind comparisons with professional boots the gap is now about the size of the difference between two professional boots.

<img src="/blog/characterforge-09-the-first-fully-shaded-look-at-c001/2026-10-01-s5-rigid-r13-b4cc81f0.webp" width="1465" height="1600" alt="Render sheet from the S5b rigid parts (bone arms, boots, hood ornaments) lane, stage S5: Round 13 of C001&#x27;s rigid parts: the boots get the concept&#x27;s folded cuff (a turned-down flaring band over a binding strap), a fuller pointed toe, seam lines set into the leather and separate colour zones for toe" loading="lazy" decoding="async">

---

<a id="e-20261001-1337"></a>**13:37 · S5 cloth · S5**

The cloak now hangs from the shoulders behind the arms with a weighted hem and its lace border on the outside, the hood has a rolled rim that frames the hair, and the straps, stocking tops and shoulder flaps are thinner with clean edges. Clay and wireframe views.

<img src="/blog/characterforge-09-the-first-fully-shaded-look-at-c001/2026-10-01-s5-cloth-r8-e569cb93.webp" width="1600" height="1307" alt="Render sheet from the S5 cloth lane, stage S5: The cloak now hangs from the shoulders behind the arms with a weighted hem and its lace border on the outside, the hood has a rolled rim that frames the hair, and the straps, stocking tops and shoulder flaps are thinner with clean edges. Clay and wirefr" loading="lazy" decoding="async">

---

<a id="e-20261001-1334"></a>**13:34 · S5a hair · S5**

Hair round 14 fixed the things that made the hair stop looking like the character: the odd leaf-shaped piece at the parting is gone, the fringe now sits centred on the forehead, the hem curves in toward the chin, and the hair no longer pokes into the head when she turns. The design check is now on the edge between 'same as the concept' and 'drifted'; against professional work it still reads as too many even strips, which is the next step.

<img src="/blog/characterforge-09-the-first-fully-shaded-look-at-c001/2026-10-01-s5-hair-r14-037af11a.webp" width="567" height="1600" alt="Render sheet from the S5a hair lane, stage S5: Hair round 14 fixed the things that made the hair stop looking like the character: the odd leaf-shaped piece at the parting is gone, the fringe now sits centred on the forehead, the hem curves in toward the chin, and the hair no longer pokes into the he" loading="lazy" decoding="async">

---

<a id="e-20261001-1326"></a>**13:26 · base (VRoid substrate) · S3**

C001's ears are now small separate pieces that sit flat against the head, the nose tip is a soft ball and the waist is slimmer; her flesh forearms are hidden so the golden bone arms can take their place.

<img src="/blog/characterforge-09-the-first-fully-shaded-look-at-c001/2026-10-01-s3-base-v3-r5-4af9615a.webp" width="1250" height="360" alt="Render sheet from the base (VRoid substrate) lane, stage S3: C001&#x27;s ears are now small separate pieces that sit flat against the head, the nose tip is a soft ball and the waist is slimmer; her flesh forearms are hidden so the golden bone arms can take their place." loading="lazy" decoding="async">


Previous update: [CharacterForge update 08: switching to a VRoid base and scoring every part against pros](/blog/characterforge-08-switching-to-a-vroid-base-and-scoring-every-part-against/)
