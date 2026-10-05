---
title: CharacterForge update 11: attempt 3, a new approach
summary: Attempt 3 changes who makes what. Generators make the visible shapes, our code only builds the structure, and every look is judged by eye. The brief and the picture sheets are done, and the first Tripo gate has picked a head and a body.
date: 2026-10-06
---

CharacterForge is building one playable anime-style character, C001, in Blender and Unreal Engine. Attempt 2 (updates 01 to 10) was closed on 2026-10-04: the machinery worked, but the look never reached the bar. Attempt 3 starts from the same character and the same design images with a different split of work. This post covers what changes, what happened in the first day, what the first 3D gate found, and what comes next. From here on, a new post goes out at every milestone.

Only our own renders appear here: grey clay and wireframe renders of meshes that are in our project. No concept art, no key art, no other studios' models or stills, and none of the picture sheets. The sheets are made from the private design images, so they stay private. The body renders are left out too, because the body is an unclothed base and its renders stay private until it is dressed. Verified: own renders only.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Progress (playable character): **9%** · Now: **S2 — Tripo shapes** (attempt 3 is a new approach: generators make the visible shapes, our code only builds the structure. The brief and the approved picture sheets are done. The first two shape jobs (head with hair, and body) are generated and picked at the first gate; the boots, weapon and cloak are next)

**Roadmap.** S0 to S12 are Product 1.

| Stage | Work | Status |
|---|---|---|
| S0 | Brief: read the design images, set up the folders | ✅ done |
| S1 | Sheets: multi-view picture sheets (turns, body, parts), approved by Dex | ✅ done |
| S2 | Tripo shapes: head + hair, body, boots, weapon, cloak as quad meshes | ▶ in progress, 40% |
| S3 | Texture guide: first-pass colour on the shapes (a tracing guide only) | ○ not started |
| S4 | Regions: palette and region IDs on the meshes | ○ not started |
| S5 | Loops, UVs and freeze: clean flow where things bend, then lock the layout | ○ not started |
| S6 | Paint: the paint of record, face first | ○ not started |
| S7 | Maps: shading and processing maps | ○ not started |
| S8 | Rig: skeleton, weights, face keys | ○ not started |
| S9 | Physics: hair and cloth chains | ○ not started |
| S10 | Animation: idle, run, attacks, emotes | ○ not started |
| S11 | VFX: attack and ultimate effects | ○ not started |
| S12 | Unreal build: assembly and a playable build | ○ not started |

*As of 2026-10-06. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## Why attempt 3 is different

In attempt 2 our own scripts decided most visible shapes: the face, the hair, the skin-tight outfit. Each shape was built from rules and measurements, and each round was checked against numbers taken from about 2,300 professional models. Several rounds passed every number and still looked wrong. Wherever a script made the shape, the judges and Dex called it amateur, even with every number in range. The parts that got closest to pro level (bone arms, boots, cloak) were the ones that started from someone else's modelling eye.

So attempt 3 flips the split. The rule it is built on: quality only came from sources that already had a modeller's eye, so those sources make every visible shape, and our code is limited to structure.

## What attempt 3 changes

1. **Generators make the visible shapes, agents do structure.** An image generator draws the picture sheets. Tripo, a 3D generator, turns those sheets into meshes. We author paint last. Our code does loops, UV layout, bones, weights and maps, and it moves data. It never lays down a visible form.
2. **Eyes first, not numbers.** Every stage ends with a render next to the reference, same camera and same crop. We look, write down the three biggest problems, change one thing, and look again. Numbers have three jobs only: catch invisible breakage (holes, flipped faces, bad weights), give starting values, and help diagnose something an eye has already flagged. A look never passes on a number.
3. **Minimal parts.** There are five shape jobs: head with hair, body, cloak with hood, boots, and weapon. The only stitch is the neck. Everything else is a separate mesh that sits on top. Attempt 2 had many lanes and many seams.
4. **Reference-led sheets with lock-in.** The prompt names only the view, and the reference pictures carry the design. One generation per slot, and if it is right we lock it. Edit first, re-roll last. Parts float on their sheet and are never cropped. Once Dex approves the sheet set it is the ruler: scale and proportion are judged by laying a render over the sheet and looking.
5. **Tripo P2.0 quads.** Tripo's newest model makes quad-based meshes, one part per job. We want quads because they give clean loops around anything that bends: shoulders, knees, mouth.

The order after the shapes: a first-pass colour guide on the meshes (a tracing guide only, never shipped), regions, new loops where things move, UV layout, then a freeze. Paint is welded to the UV layout, so it comes after the freeze. Then maps, rig, physics, animation, effects and the Unreal build. The roadmap above lists all thirteen stages.

## What happened on Oct 5 and 6

**S0, the brief (done).** We read the two design images by eye and wrote a one-page brief: what the design commits to, where the two images disagree, and what nobody has drawn yet (the top of the hair with the hood off, the bare feet, the far side of the weapon). Nothing was spent.

**S1, the sheets (done).** Two image services on mage.space went through a short probe: Grok Image 2.0 and Mango 3. Grok drew the dressed views best. Mango handled the body sheet, which Grok would not take. The set that came out of it:

- a master front and four turn views
- a master body sheet
- floating part sheets for the body, the head with hair (four views), the cloak with hood, the boots and the weapon side
- four outfit views to use as a texture source

Dex approved the sheet set. It took 122 generations and 14,754 gems, against a cap of 15,000 for this build. Gems are the image service's currency.

What did not work cleanly:

- four requests were blocked by the services' content filters and were still charged, 615 gems in total; each sheet now goes to whichever service accepts it
- the cloak front is only a partial pass (the gem colour and the gather at the neck are still off), because the second attempt came out worse than the first and was thrown away
- the cloak's left view is empty
- the body's left view is a mirror of the right view, because the real left drawing had a stray heel spike

**S2, the first Tripo gate.** Two jobs have run, each charged 100 credits whatever number of variants it makes:

| Job | Variants | Polygons | Share of triangles |
|---|---|---|---|
| Head and hair | 2 | 7,800 and 8,863 | 17% and 17% |
| Body | 4 | 12,393, 18,999, 26,952 and 30,374 | 15% to 27% |

The head job went in with 2 variants before we decided to always ask for 4 for the same price. The meshes are mostly quads, not all quads: between one in six and one in four polygons is a triangle.

## What the first gate found

The gate is a look, not a score. Each variant was rendered in clay and wire and laid over its sheet at equal height, and we wrote a verdict for every zone. KEEP means Tripo's faces stay. WRAP means a template is wrapped over Tripo's shape. REBUILD means we make it ourselves.

**Picks: head variant 2 and body variant 3.** Both are good starts, so nothing goes back to Tripo and no more credits are spent on these two. The bob, bangs and cheek locks sit on the sheet from the front and back, with no invented ponytail and no bulge at the back. On the body, all four variants match the sheet almost exactly: the arms land where they are drawn, there are no ghost arms, and the feet hold the heel stance. Body variant 3 won because its skin has the cleanest grid of four-sided faces (about 6% triangles on the skin; the rigid bone pieces carry most of the remaining triangles). Variant 2 is the lighter backup at 19k polygons. Head and body placed together over the full-body picture line up almost exactly, neck included.

<img src="/blog/characterforge-11-attempt-3-a-new-approach/head-v2-clay-and-wire-front.webp" width="1600" height="796" alt="Head variant 2 in clay on the left and with its wireframe on the right, front view" loading="lazy" decoding="async">

*Figure 1. Head variant 2, front view, clay (left) and wireframe (right). The outline matches the approved sheet. The face is an even grid of quads.*

Why variant 2 beat variant 1 is easiest to see up close. Variant 1 copied the drawn eye shine into little highlight blobs on the eyeballs and came out in 24 loose pieces. Variant 2 is one clean piece with a real ear.

<img src="/blog/characterforge-11-attempt-3-a-new-approach/head-v1-vs-v2-face-clay.webp" width="1600" height="795" alt="Face close-up in clay, variant 1 on the left and variant 2 on the right" loading="lazy" decoding="async">

*Figure 2. Face close-up, variant 1 (left) and variant 2 (right). Variant 1 has small highlight blobs on both eyeballs; variant 2 does not.*

**The three biggest problems**, all fixable in our own stages, none a reason to re-roll:

1. **The hair below the crown.** The crown is one smooth cap and matches the sheet. Below it, Tripo split the bangs and the hem into dozens of thin separate blades, spikier than the sheet, which draws soft tapered clumps. From the side, the cheek lock stands off the head like a flat paddle instead of lying along the cheek. Verdict: crown KEEP; bangs, hem and cheek locks REBUILD.

<img src="/blog/characterforge-11-attempt-3-a-new-approach/head-v2-three-quarter-and-side.webp" width="1600" height="797" alt="Head variant 2 in clay, three-quarter view on the left and right side view on the right" loading="lazy" decoding="async">

*Figure 3. Head variant 2, three-quarter and right side. The thin hair blades and the paddle-shaped cheek lock are the problem.*

2. **The face.** It is a plain, even grid with one loop round each eye and one round the mouth. That is not enough to blink or talk. The eyeball is a placeholder, and in profile the lips and chin push slightly forward. Verdict: eyes, mouth and nose WRAP, so a face template with proper lid and lip loops goes over Tripo's shape and keeps the shape. Ears KEEP.

<img src="/blog/characterforge-11-attempt-3-a-new-approach/head-v2-face-wire-closeup.webp" width="1400" height="1400" alt="Face close-up of head variant 2 with the wireframe over the clay" loading="lazy" decoding="async">

*Figure 4. Head variant 2, face close-up in wireframe. One loop round each eye and the mouth.*

3. **The body's neck is cut about 1.5% too high.** Put the head on and the body's neck would run up inside the jaw. The neck widths match, so this is a re-cut lower and a re-ring, not a re-roll. The plan is one even ring of 24 to 32 edges on both meshes, under the choker.

Smaller things: a few pinholes (one on the body seam, and between the toes), and lumpy outer ankles that the boots will hide. For the body the other verdicts are mostly KEEP; only the shoulders and the hip joints get a WRAP, so the arm can drop from the A-pose and the legs can walk and kick.

Not the mesh's fault: the side sheets disagree with the front sheet. The head side sheet draws a longer neck, and the body side sheet hangs the arms straight down, while Tripo followed the front. Those go on a list for later overlays.

## What comes next

- **Dex looks at the gate.** The picks are ours so far, and the contact sheets are ready for him.
- **Boots and weapon in Tripo, then the cloak.** The cloak runs last because its front sheet is the weakest.
- **The neck stitch,** with the lower re-cut, matching shading and identical weights on both sides, so the join never shows.
- **Then the colour guide, regions, loops, UVs and the freeze,** followed by paint.

The percentages at the top are rough. The stage weights are guesses in days made at the start of attempt 3, and they get re-forecast as real costs arrive.
