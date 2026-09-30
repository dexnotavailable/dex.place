---
title: CharacterForge 02: the tracing guide and the judge
summary: Sixteen AI body meshes and how one was picked as the tracing guide for C001, then what happened when the AI judge was tested on professional models that were broken on purpose.
date: 2026-10-01
---

This is the second progress post. It covers two stages that finished on 2026-10-01: S2, the ghost (the AI-made mesh that we trace over), and S1, the calibration of the judge. Post 01 said the head-shrunk meshes had not been checked and that the judge had not been scored yet. Both now have results.

All numbers are from our own project files. The C001 design image and the judge's test images are not shown. The test images are renders of other studios' models.

## Part 1: the tracing guide (S2)

### What was made

The ghost is a rough AI mesh. It decides proportions and where clothing sits. The final model is built by hand on top of it.

The chain has three steps. An image generator draws turnaround sheets of the character (front, side and back views). Meshy, a 3D generator, turns those views into meshes. Then we render, measure and compare every mesh.

16 meshes came out: 9 base bodies in a plain grey bodysuit, and 7 dressed versions with the hood, cloak, harness, shorts, stockings, boots and golden skeletal arms. One more task failed and was not charged. The settings changed between meshes: how many views were fed in (1 to 3), whether a pose was forced, the geometry resolution, and which image model drew the sheet.

<img src="/blog/characterforge-02-the-tracing-guide-and-the-judge/ghost-body-tracing-guide.webp" width="1600" height="1379" alt="Sheet of nine untextured grey clay body meshes in a T-pose, labelled B1 to B9, each shown from the front, three-quarter, side and back. B8 and B9 have visibly smaller heads than B1 to B7. A label in the top right corner reads: AI-generated tracing guide, not final art." loading="lazy" decoding="async">

*Figure 1. AI-generated tracing guide, not final art. The nine base body candidates as untextured grey clay. The dressed candidates are not shown.*

### What went wrong

- **The heads came out too big.** Seven of the nine bodies (B1 to B7) are 6.1 to 6.9 heads tall, and their heads are 1.40 to 1.59 times the size of the design's head. The design is about 9.7 heads tall. The image step caused it: the generator redrew the plain body with a head about 1.4 times too large, and the mesh copied it. Changing the number of views, the pose setting, the geometry resolution or the image model did not fix it. What did fix it was shrinking the head region of the sheet images to 65% (feet kept on the same ground line) and generating again. That gave B8 and B9: 8.71 and 8.53 heads tall, with heads 1.11 and 1.14 times the design's.
- **Every hand is a flat paddle.** A thumb stub, no separate fingers. On the dressed meshes they are bone paddles. Hands will be built from scratch, not traced.
- **Most feet point down.** The bodies stand on tip-toe. The foot length of B1 ranks at the 2nd percentile of the reference models, and B9's at the 6th, because the feet do not lie flat.
- **Body glitches.** B5 has its thighs fused into one column (a gap of 1.4% of body height). B2's thighs almost touch. B8 has its chest piece as a separate loose shell, 7.9% of its vertices.
- **A literal skeleton.** One dressed mesh (D1) came out with a full skeleton for a body: ribcage, pelvis, leg bones and a skull face, in the geometry itself, under a correct hood and cloak. The same three input images, run again mesh-only at a higher geometry setting (D7), gave a normal hooded figure. Same inputs, different result, so one run tells us little. Three other dressed meshes missed in smaller ways: no hood and a cloak 1.8 times the body width (D3), an A-pose when a T-pose was asked for (D5), and a cloak far shorter than the design (D8).
- **Moderation blocks cost money.** The image service's content filter blocked the original reference picture of the character. Recolouring the exposed skin on the reference to grey got it through. Even so, 2 of the 8 sheet generations came back as a blocked placeholder and were still charged: 24 and 175 gems (gems are that service's credits). That is 199 of the 311 gems spent, 64%. One of the two blocked requests used a reference that had passed on another try, so the filter is hard to predict. Meshy also refused the original reference image once and charged nothing. The grey version passed.
- **The meshes are heavy.** The nine bodies have 264,346 to 536,992 triangles, against a median of 36,641 for the reference models. The dressed meshes have 876,036 to 2,271,980. One more reason the ghost is a guide only.

Cost: 390 of the 1,500 Meshy credits went on the 16 meshes (20 per body, 25 at the higher geometry setting, 30 per textured dressed mesh), so 1,110 are left. Of the image gems, 4 are left, so the next images will come from local models.

### How the winner was chosen

The main rule is fidelity to the design: silhouette, proportions, where the clothes sit, how readable it is. The measured reference ranges are guardrails only. A proportion gets flagged only when it lies outside about the 2nd to 98th percentile of the 656 adult female reference models.

Each mesh was rendered as grey clay at equal height. A script measured landmark heights (chin, shoulder, chest, waist, hip, crotch, knee, ankle) as a fraction of body height. The same landmarks were read off the design image by hand, good to about 1.5 points. One point is 1% of body height. The script's own detection is good to 1 or 2 points, so small differences are noise.

The table has the nine body candidates. "Average miss" is how far the landmarks sit from the design's, averaged, in points. Lower is closer.

| Mesh | What was different | Heads tall (hair counted) | Head size vs design | Average miss | Note |
|---|---|---|---|---|---|
| B1 | front, side and back views | 6.61 | x1.47 | 3.8 | kept as second reference for torso and hip curves |
| B2 | front and side views | 6.30 | x1.54 | 5.4 | thighs almost touch |
| B3 | front view only | 6.21 | x1.56 | 5.2 | |
| B4 | sheet drawn from text only, no pose forced | 6.30 | x1.54 | 5.5 | |
| B5 | sheet from a second image model | 6.94 | x1.40 | 6.4 | thighs fused |
| B6 | same as B1, higher geometry setting | 6.12 | x1.59 | 4.8 | |
| B7 | front and back views | 6.30 | x1.54 | 5.0 | |
| B8 | head-shrunk images, three views | 8.71 | x1.11 | 2.1 | chest piece loose |
| B9 | head-shrunk images, front and back | 8.53 | x1.14 | 2.6 | **locked** |

B8 scores slightly closer than B9 (2.1 against 2.6), but its chest piece is not attached. B9 is one clean mesh, and its biggest miss is the hip, 6.1 points lower than the design. So B9 is the body ghost. It still has 264,346 triangles, about seven times the median reference model.

For the dressed ghost, D4 is the only candidate with every element in place: hood, open cloak with a lace border, harness, strappy shorts, stockings, cuffed boots and golden bone arms. Its cloak is fused to the shoulders, so it gets traced, not copied. Its head is bigger than B9's, so it is used for where garments sit relative to the body, not for absolute size. D2 is kept as a second reference for the hood shape and the harness straps.

Three judgment calls came out of this stage.

1. **The design is taller than the reference range.** With hair counted, the design is about 9.7 heads tall. B9 is 8.53, which ranks at the 98th percentile of the 656 reference models. So the design sits above the professional range. When tracing, we keep B9's tall, long-legged look but cap heads-tall and the leg share of height at about the 98th percentile. C001 will end up near 8.5 heads, not 9.7.
2. **Hands are authored fresh** from finger construction notes and the measured ranges.
3. **Feet.** The reusable body template gets flat, neutral feet. The boot heel on C001 comes from the angle of the foot bone.

## Part 2: the judge (S1)

### How calibration works

A judge is only useful if we know what it misses. So before it touches our own work, we test it on professional models that we broke on purpose.

The judge sees two rendered sheets side by side, A on the left and B on the right, and has to pick the one that is more professionally proportioned and built. It also gives a confidence from 50 to 100 and lists flaws. One sheet is the untouched original, and the side is random. If the judge keeps picking the original, it can see the damage. The judge is an AI agent (Claude Opus, medium effort). It reads each image once, with no cropping and no tools.

The damage types:

- Head: 15% smaller, 20% bigger, 30% bigger.
- Eyes: 1.3 times bigger.
- Neck: 25% longer (about 0.7% of body height), or 25% thicker.
- Torso: 15% wider.
- Limbs: legs or arms 10% shorter or 10% longer.
- Missing parts: bangs, the largest piece of main hair, the largest piece of clothing, or the hood or cape deleted.

The set has 120 pairs: 100 of original against damaged, and 20 of two untouched professional models. The second kind has no right answer. It shows how the judge behaves when nothing is wrong. Each damage type was checked to really change the render. 32 different models from five games appear in the damaged pairs. So far 70 of the 120 pairs have been judged (60 damaged, 10 untouched). A second test, a checklist run on one model at a time, covered 12 damaged models and 6 clean ones.

### Results

The judge picked the undamaged model 45 times out of 60, which is 75% (95% interval 63% to 84%). Guessing gives 50%. The S1 bar was 90% on three tests. It met one and missed two.

| Test | Trials | Right | Accuracy | 95% interval | 90% bar |
|---|---|---|---|---|---|
| Head size, 15% smaller or 20% bigger | 8 | 6 | 75% | 41% to 93% | missed |
| Missing major part (main hair, clothing, hood or cape) | 12 | 12 | 100% | 76% to 100% | met |
| Limb length, 10% either way | 16 | 6 | 38% | 18% to 61% | missed |

With 8 to 16 trials per test the intervals are wide. The 100% on missing parts meets the bar on the raw number only.

<img src="/blog/characterforge-02-the-tracing-guide-and-the-judge/critic-calibration.webp" width="1392" height="1080" alt="Horizontal bars showing how often the judge picked the undamaged model, by kind of damage. Missing parts 100 percent, 16 of 16. Neck 88 percent, 7 of 8. Head size 83 percent, 10 of 12. Eye size 75 percent, 3 of 4. Torso width 75 percent, 3 of 4. Limb length 38 percent, 6 of 16, below the dashed 50 percent chance line. A dotted line marks the 90 percent target." loading="lazy" decoding="async">

*Figure 2. How often the judge picked the undamaged model, by kind of damage. Limb length combines arms (2 of 8) and legs (4 of 8). Eye size and torso width have 4 trials each, so read them as hints.*

### What we learned

1. **Missing parts are easy. Small proportion changes are not.** Deleting the bangs, a main hair piece, a clothing piece or the hood or cape was caught 16 of 16 times. A head 20% or 30% too big was caught 8 of 8. A head 15% too small was caught 2 of 4, which is chance.
2. **The judge cannot see a 10% limb change.** On legs and arms it got 6 of 16, below the chance line: arms 2 of 8, legs 4 of 8. At this render size the change is too small for it. So numbers own proportions. Our build gets measured in code against the design's landmarks and the reference ranges. The judge owns missing or extra parts, big head or face errors, identity against the design, style and appeal.
3. **Position matters.** When the undamaged model was on the left, the judge found it 32 of 35 times (91%). On the right, 13 of 25 (52%, chance). Across all damaged trials it picked the left image 44 of 60 times. On the 10 pairs of two untouched models it picked the left image once. So the lean is not a fixed taste for one side, and it cannot be fixed by subtracting a constant. Every comparison that matters now runs twice with left and right swapped, and only verdicts that agree in both orders count. The neck result is a warning. The judge picked the undamaged model 7 of 8 times on neck damage but never named the neck as the problem in those 7. That 88% is probably the position lean, not a sign that it sees neck changes.
4. **Confidence means something.** All 13 calls at confidence 80 or higher were right. At 65 to 79 it was right 15 of 20 (75%), and at 50 to 64 it was right 17 of 27 (63%). We trust 80 and above and treat the rest as weak evidence.
5. **One-model reviews miss subtle damage.** The checklist on a single model caught the damage in 3 of 12 damaged models. It raised 0 false alarms on the 6 clean ones. It stays quiet unless the problem is obvious, so we compare (our render against the nearest professional renders and against the design) instead of reviewing one model alone.
6. **The judge still finds faults when nothing is wrong.** On pairs of two untouched professional models, it reported a serious flaw (severity 3 or more) on the weaker-looking one in 3 of 10 trials (30%), with a mean confidence of 61. That is the yardstick for the final blind test on C001. A judge that behaves like this is at chance.

### Limits of this run

One run, one judge setup, 4 to 16 trials per group, and 50 of the 120 pairs not judged yet. The calibration cost about 1.7 million tokens of agent usage, roughly 18 thousand per judgment. Going forward, each judge reads each image once and gets at most 5 items per batch. One cheap idea to test later is drawing landmark guide lines and head-height ticks on the pair sheets to help the eye.

S1 closes as a hybrid. The judge alone did not meet the bar on two of three tests, so measured numbers take over proportions and the judge handles the rest.

## Where the stages stand

| Stage | Work | Status |
|---|---|---|
| S0 | Research notes, model dataset and measurements, image shelf | in progress |
| S1 | Judge: matched renders, big-shape checks, calibration | done, hybrid with usage rules |
| S2 | C001 ghost, body and dressed, locked pair | done: B9 body, D4 dressed |
| S3 | Body and head traced over the ghost, also built as a reusable template | probe running |
| S4 | Face: eyes, mouth interior, expressions | not started |
| S5 | Hair, clothing layers, golden arms, boots | not started |
| S6 | Skeleton, weights, correctives, physics | not started |
| S7 | Textures and materials | not started |
| S8 | Unreal import, motion, movement | not started |
| S9 | Combat, skills, effects | not started |
| S10 | Full blind test on C001 | not started |
| S11 | Characters 2 and 3, swap tests | not started |

## Next

S3 opens with its probe: one head and one hand, built by two competing routes at the same time.

1. **Route 1.** The head and one hand are built by script as hand-planned all-quad layouts, with the edge loops placed on purpose. The head is fitted to the B9 ghost. The hand is sized from the measured reference ranges, because the ghost hands are flat paddles.
2. **Route 2, the challenger, head only.** Blender's automatic quad retopology is run on the ghost head, with no hand-planned layout.

Both get checked by measured numbers and by swapped-pair judging. Green means scale out. Yellow means up to two rounds of fixes, with the expected visible change written down first. Red, meaning three or more major issues or no measurable gain after two rounds, means switching route.

The reusable body template will rest in an A-pose (upper arm about 38.7 degrees below horizontal, measured from the reference models) and not in the T-pose the ghost uses.

Progress images for later posts are our own renders, charts and diagrams. The one ghost sheet here is an AI-generated intermediate and is labelled as one. This site will not show other studios' images or models.
