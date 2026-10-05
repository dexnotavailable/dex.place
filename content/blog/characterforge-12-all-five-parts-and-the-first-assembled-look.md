---
title: CharacterForge 12: all five parts and the first assembled look
summary: All five shapes are now generated and picked. The skin-tight outfit becomes paint, guided by a colour pass on the body. Head, body, boots, weapon and cloak were put together for the first time, and the cloak has to be redone.
date: 2026-10-06
nsfw: true
---

CharacterForge is building one playable anime-style character, C001, in Blender and Unreal Engine. Update 11 ended with two of the five shapes picked: the head with hair, and the body. Since then the other three (boots, weapon, cloak) came out of Tripo, the outfit got a colour guide, all five parts were put together for a first look, and that look showed the cloak is built wrong. This post covers all of it.

**This post contains nudity.** C001 is an adult, a woman in her mid-20s. From this update on, the blog shows her nude body: the body picture sheet and our grey clay renders of the body mesh. The body has smooth, non-explicit anatomy. Every nude or near-nude image is blurred until you click "Show image", one image at a time. The clothed renders (boots, weapon, cloak, and the assembled look from behind) are not blurred. As before, there is no concept art, no key art, none of the dressed picture sheets and nothing from other studios. Verified: own renders only, plus one nude body sheet, NSFW-tagged.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Progress (playable character): **16%** · Now: **S5 — Loops, UVs, freeze** (all five shapes are generated, picked and assembled into a first clay look; the body has its outfit tracing guide and its region map. The cloak is being redone from a whole-character generation, and the loop, neck stitch and UV work has started)

**Roadmap.** S0 to S12 are Product 1.

| Stage | Work | Status |
|---|---|---|
| S0 | Brief: read the design images, set up the folders | ✅ done |
| S1 | Sheets: multi-view picture sheets (turns, body, parts), approved by Dex | ✅ done |
| S2 | Tripo shapes: head + hair, body, boots, weapon, cloak as quad meshes | ▶ in progress, 85% |
| S3 | Texture guide: first-pass colour on the shapes (a tracing guide only) | ▶ in progress, 80% |
| S4 | Regions: palette and region IDs on the meshes | ▶ in progress, 90% |
| S5 | Loops, UVs and freeze: clean flow where things bend, then lock the layout | ▶ in progress, 5% |
| S6 | Paint: the paint of record, face first | ○ not started |
| S7 | Maps: shading and processing maps | ○ not started |
| S8 | Rig: skeleton, weights, face keys | ○ not started |
| S9 | Physics: hair and cloth chains | ○ not started |
| S10 | Animation: idle, run, attacks, emotes | ○ not started |
| S11 | VFX: attack and ultimate effects | ○ not started |
| S12 | Unreal build: assembly and a playable build | ○ not started |

*As of 2026-10-06. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## The body, shown for the first time

Update 11 kept the body renders private, because the body is an unclothed base. Dex has now decided they go on the blog, tagged and blurred. Here is the body picture sheet we generated with Mango 3 (an image model on mage.space), front view. It floats with no head, because the head is a separate part with its own sheet. This sheet is what Tripo turned into the body mesh.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/body-sheet-front-headless.webp" width="1030" height="1600" alt="Nude body picture sheet, front view, headless floating adult body with bone arms" loading="lazy" decoding="async" data-nsfw>

*Figure 1. The body picture sheet, front. Bone arms from just above the elbow, bare feet in the heel stance. Verified: nude body sheet, NSFW-tagged.*

And here is what Tripo made from it: body variant 3, with head variant 2 placed on top, in plain clay. These are the two picks from the first gate in update 11.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/body-clay-front-back.webp" width="1600" height="1243" alt="Clay render of body variant 3 with head variant 2, front and back, nude" loading="lazy" decoding="async" data-nsfw>

*Figure 2. Body variant 3 and head variant 2 in clay, front (left) and back (right).*

## The outfit is paint, not cloth

C001 wears a skin-tight set: black torn bands, a hip band, thigh wraps and sheer stockings. The question was whether that needs its own mesh or can be painted on the body. Two routes ran side by side:

- **Route A:** Meshy, a 3D service, repainted body variant 3 from four outfit pictures. It worked. The bands, the thong, the wraps and the stocking tops land in the right places from all four sides. It cost 15 Meshy credits.
- **Route B:** Tripo made the body already dressed, with colour. Tripo's content filter refused the colour step four times (refunded every time), so B gave us shapes with no colour.

B's shapes still answered the real question. On the dressed meshes, only three things stand off the skin: the choker, the gold pendant chain, and the bone gauntlets. Everything else (the bands, hip web, wraps and stockings) shows only as creases about 1 mm deep. So the choker and the chain become real geometry, and everything else is paint.

Route A is locked as the **tracing guide**. That is a colour pass we draw over by hand in the paint stage. It is never shipped. Dex's verdict: "good enough".

## The seam lesson

The first guide smeared at her sides, where the side views meet the front and back. The cause was the back picture: it was drawn mirror-symmetric, while the front and sides are not. Meshy could not join a symmetric back to an asymmetric front, so it blurred the join.

We regenerated the back once (149 gems). The new back has torn bands like the front, a hip band as wide as the front's, and bands that carry on round the sides into the side views. Meshy then repainted the body again with the new back. The bands now reach onto her flanks. Some smudge is left at the outer hip and buttock in the back three-quarter views. Those spots get traced from the picture sheets, not from the guide.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/tightset-guide-back-old-vs-new.webp" width="1600" height="1409" alt="Tracing guide on the body mesh, back, sides and back three-quarter views, old guide on top and new guide below" loading="lazy" decoding="async" data-nsfw>

*Figure 3. The tracing guide on body variant 3, labelled. Top row: the old guide. Bottom row: the new guide after the back was redrawn. Same cameras. The hip band and the bands on the flanks now connect.*

This is now a sheet rule for every character: **views must connect at the seams.** No mirror-symmetric back on an outfit whose front is asymmetric.

## Boots, weapon and cloak in Tripo

Each part was one Tripo job with 4 variants. A job costs the same 100 credits whether it makes 1 variant or 4. The three jobs went in back to back. Tripo ran at least 7 jobs at once with no queue, and each took about 2 to 4 minutes. The weapon has only a side picture, and Tripo's multi-view mode would not take a single picture, so it ran in single-image mode.

| Part | Variant faces | Share of triangles |
|---|---|---|
| Boots | 3,538, 4,315, 6,220 and 8,186 | 20%, 18%, 4% and 5% |
| Weapon | 3,247, 4,461, 6,757 and 9,752 | 25%, 26%, 27% and 32% |
| Cloak and hood | 7,924, 10,454, 14,708 and 16,316 | 30%, 30%, 41% and 27% |

The pick is a look, not a score: clay renders of every variant laid over the picture sheets.

**Boots: variant 3.** All four pairs match the sheet's height, stiletto heel, pointed toe and the V notch in the cuff. Variant 3 has the cleanest grid of four-sided faces (about 4% triangles), the clearest ruched folds, and the only shaft that is really hollow. Variant 2 is the backup. It is lighter, but the shaft is sealed shallow just under the cuff.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/boots-v3-clay-turnaround.webp" width="1600" height="456" alt="Boots variant 3 in clay, front, three-quarter, side and back" loading="lazy" decoding="async">

*Figure 4. Boots variant 3. Problems: the shaft is fuller than the front sheet, which partly comes from the sheet being drawn from slightly above, so it gets fitted to her calf. There is a crumpled surface inside where the leg goes, which gets deleted. And there are small cracks to merge and fill.*

**Weapon: variant 4.** From the side, all four lie right on the sheet. From the top and the ends they do not. Variants 1 to 3 grew a second blade at 90 degrees, so the blade is X-shaped in cross-section. That is Tripo guessing the depth from one picture. Variant 4 is the only flat blade with a centre ridge.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/weapon-v4-clay-turnaround.webp" width="1600" height="1588" alt="Weapon variant 4 in clay, side, three-quarter and top views" loading="lazy" decoding="async">

*Figure 5. Weapon variant 4. Problems: seen from above, the claw prongs are wedges as thick as the shaft, so they get thinned by eye. The diamond cut-outs in the guard are smeared into noise, so we cut clean holes ourselves. It has the most triangles of the four, which only matters for shading, because the weapon does not bend.*

**Cloak: variant 3.** We rendered each cloak with everything behind her centre cut away, to see what is really at the front. Variant 3 was the only truly open front, like the sheet. Variants 2 and 4 grew a closed panel from neck to hem. It also had the best pleated shoulder ruffles and a clean rolled hood rim.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/cloak-v3-clay-turnaround.webp" width="1600" height="564" alt="Cloak and hood variant 3 in clay, front, three-quarter, side and back" loading="lazy" decoding="async">

*Figure 6. Cloak variant 3. Problems: a neck drape fills the bottom of the hood opening. The cloth is many overlapping strips with 41% triangles. And the back sheet draws the cloak about 20% longer than the front sheet.*

## The first assembled look

All five parts went onto body variant 3 in one scene, at her real height: 1.646 m from the ground to the top of the hair, in boots. Nothing went back to a generator and no mesh was edited. We checked it at full size beside the four approved turn views, at equal height from the ground to the hood tip.

**Yes, it reads as her.** The short bob sits in the pointed hood. The cloak is open at the front, with ruffled shoulders. She has the bone arms, the stiletto boots and the claw-and-blade staff. The boots reach the drawn cuff height and stand on the floor. The head sits inside the hood from every side, with no hair poking through.

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/assembly-clay-front-q34.webp" width="1600" height="1015" alt="First assembled look in clay, front and three-quarter, with the weapon; the open cloak shows the nude body" loading="lazy" decoding="async" data-nsfw>

*Figure 7. All five parts together in clay, front (left) and three-quarter (right).*

<img src="/blog/characterforge-12-all-five-parts-and-the-first-assembled-look/assembly-clay-back.webp" width="939" height="1600" alt="First assembled look in clay from behind, cloak covering her to mid-thigh, boots and bone hands visible" loading="lazy" decoding="async">

*Figure 8. From behind. The cloak stops at mid-thigh, but on the drawings it falls to the boot tops in long points.*

**What is wrong, worst first:**

1. **The cloak is too short at the back.** On the drawings the back hem reaches the boot tops in long points. Ours stops between mid-thigh and knee, and the side views lose the tail. That comes from the mesh, not the placement.
2. **The hood peak is about 4% of her height taller than drawn.** Because we compare at equal height to the hood tip, the rest of her looks a little small.
3. **The bare feet poke through the boots a little,** at the inner ankle and under the heel arch. The boot toes also touch. The foot inside the boot gets hidden or deleted later anyway.
4. **The weapon hold is a placeholder.** The shaft runs through her left hand at hip height. The real hold, blade down by her left foot, needs the rig, because the arms are still in the A-pose.
5. **Already known:** her thighs are slimmer than the drawings, the clay cloak is solid where the drawn one is sheer, and a short seam line shows at the crotch from the body mesh. That seam gets closed in the next stage.

A second version with the tracing guide on the body lines up cleanly, and looks the most like her of anything so far.

## The cloak goes back

Then Dex caught something the overlays had not. Every one of the four Tripo cloaks is a closed bell: there is no room for the arms to come out. The real cloak is built differently. Her shoulders are bare. Each arm goes through a puffy frilled sleeve on the upper arm, with a padded band just above it. The cape and hood are one piece hanging behind her, and the hood opening is open.

Our cloak sheet drew the cape, the puffs and the padding overlapped as one shape. No generator could read that construction from it. The open front we were pleased with was real, but the arms had nowhere to go. A quick fix, cutting the bell open in Blender, was started and then stopped: Dex rejected it in favour of a proper route.

The new rule: **a worn garment keeps its openings.** Anything the body passes through (a cloak, sleeves, a hood) must not be drawn as a floating shell with the body edited out. The generator fills the gaps with cloth, and Tripo then builds it closed.

The route now is Dex's preferred one: generate the **whole dressed C001** in Tripo from the most complete sheets, see how Tripo splits it into parts, and lift the cape with hood, the puffy sleeves and the padding onto our body as separate pieces. That job is running as this goes up, so there is no new cloak to show yet; it comes in the next update. The boots and the weapon are not affected.

## Regions

One more step finished in the background. Every face of the head and the body now carries a region label, read off the approved sheets: skin, the outfit zone, stocking, bone, claw and choker on the body, and face, eyes, mouth, ears, hair and neck on the head. Paint and materials use these labels later. The outfit zone is blocky at the hips and thighs, because the mesh there is coarse. That is fine, since the real strap shapes come in paint.

## What comes next

- **S5, loops, UVs and freeze.** New loops where things bend (shoulders, hips, knees, face), the hair below the crown rebuilt, then a UV layout that gets locked. This has started.
- **The neck stitch.** Head and body join at one ring under the choker, with matching shading and identical weights on both sides, checked with the choker on and off and in extreme head turns.
- **The cloak** from the whole-character generation, as above.
- **Then the paint.** The tracing guide gets baked onto the final UV layout and traced by hand, face first.

The percentages at the top are rough. The stage weights are guesses in days made at the start of attempt 3, and they get re-forecast as real costs arrive.
