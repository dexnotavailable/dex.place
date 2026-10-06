---
title: CharacterForge 13: frozen parts, a real cloak, bone arms and hand-made eyes
summary: Every part is cleaned and frozen in real units, the cloak is rebuilt the right way round, the bone arms rotate without stretching, the eyes are hand-made, and a skeleton walks in Unreal. The hair still needs another pass.
date: 2026-10-06
nsfw: true
---

CharacterForge is building one playable anime-style character, C001, in Blender and Unreal Engine. Update 12 ended with all five shapes assembled for the first time and a cloak that had to be redone. This post covers what happened next: the head and body were cleaned up, the cloak was rebuilt, the arms were made to move, the eyes were made by hand, and the first skeleton was tested in Unreal.

**This post contains nudity.** C001 is an adult, a woman in her mid-20s. One image below shows her grey clay body under the open cape. It is blurred until you click "Show image". The other images (the assembled look from behind, the bone arms, the eyes) are not blurred. As before, there is no concept art, no key art, none of the dressed picture sheets and nothing from other studios. Verified: own renders only, with one nude clay render, NSFW-tagged.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Progress (playable character): **35%** · Now: **S5 — Loops, UVs, freeze** (every part is generated, cleaned and frozen in metres, and the cloak is rebuilt from a whole-character generation. Left in this stage: the hood's left side, the toes that poke through the boots, and a third hair pass. Her eyes are hand-made, a 320-bone skeleton walks in Unreal, and rough animation, effects and shader passes have started on stand-in models)

**Roadmap.** S0 to S12 are Product 1.

| Stage | Work | Status |
|---|---|---|
| S0 | Brief: read the design images, set up the folders | ✅ done |
| S1 | Sheets: multi-view picture sheets (turns, body, parts), approved by Dex | ✅ done |
| S2 | Tripo shapes: head + hair, body, boots, weapon, cloak as quad meshes | ✅ done |
| S3 | Texture guide: first-pass colour on the shapes (a tracing guide only) | ✅ done |
| S4 | Regions: palette and region IDs on the meshes | ✅ done |
| S5 | Loops, UVs and freeze: clean flow where things bend, then lock the layout | ▶ in progress, 80% |
| S6 | Paint: the paint of record, face first | ▶ in progress, 8% |
| S7 | Maps: shading and processing maps | ○ not started |
| S8 | Rig: skeleton, weights, face keys | ▶ in progress, 30% |
| S9 | Physics: hair and cloth chains | ○ not started |
| S10 | Animation: idle, run, attacks, emotes | ▶ in progress, 15% |
| S11 | VFX: attack and ultimate effects | ▶ in progress, 15% |
| S12 | Unreal build: assembly and a playable build | ▶ in progress, 10% |

*As of 2026-10-06. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## The short version

- **Worked:** the neck joins invisibly, the face can blink and talk, every part is frozen in metres with a fingerprint that a clean rerun reproduces, the new cloak has room for the arms, the bone arms only rotate, and the skeleton walks in Unreal.
- **Failed or still wrong:** the hair (a second attempt came out like a comb and was stopped), the left side of the hood hangs in front of her face, and her toes poke through the boots.
- **Next:** one rebuild that fixes the hood, the toes and the cloak edge after the third hair pass, then the paint.

## Cleaning up the head and the body

Update 12 ended with labels on every face of the head and the body (skin, outfit zone, bone, eyes, mouth and so on). The next step was to make both parts ready to move and to paint.

**The neck.** Head and body are now one skin. They join at a single ring of 36 points under the choker. The two sides sat 1.5 mm apart on average, so the ring is a small weld, not a gap to fill. The first weld looked perfect in the wireframe, but light skimming across it showed a hard line: the two surfaces met at slightly different slopes. One light smoothing pass brought the crease on the ring down from about 30 degrees to under 7, the same as the rows next to it. We then checked it with the choker off, under light from three directions, and with the head turned 60 degrees sideways and 30 degrees up and down. We found no crack, no shading line and no pinch.

**The face can blink and talk.** The first check after this stage found three things: the eye was one piece with the lid edge, so a blink would drag the iris along; the lip slit was filled in, so the mouth could not open; and the hair had a shelf where the clumps left the crown. All three are fixed. Each eye is now its own surface sitting 0.4 mm behind the lid, and a blink test brings the upper lid down onto the lower one without touching the eye. The mouth has a hidden pocket behind the lips, 12 mm deep, and pulling the lower lip down 9.7 mm lets the lips part onto it. Teeth and tongue come later.

**Knees, shoulders and hips.** The knees got clean loops. For the shoulders and hips we tested first and cut second: the arm was raised to 45, 90, 135 and 180 degrees, the thigh to 90 and 120 degrees, and we tried a squat, all on throw-away weights. The armpit and the crotch crease stayed clean in every pose, so those loops stay as Tripo made them. What the test did show was weight trouble: skin behind the shoulder drags into a fan when the arm goes forward. That is fixed when the real weights are painted, not by cutting loops.

**The UV layout** (the flat map that paint will sit on) is clean. The face is one island with no seam anywhere on the front, from ear to ear and brow to chin. On a 4k texture the face gets about 7.6 pixels per millimetre and the body about 2.6, so the face is three times sharper. Stretch on the face averages 1.10, where 1.0 is perfect.

**The freeze.** Freezing means locking the shape and the layout so that paint cannot drift away from them later. We store a fingerprint of every point position, the face structure and the UV layout. A clean rerun from the scripts has to give the same fingerprint, and it does, separately for the skin, the hair, the positions, the structure and the UVs. The skin is 18,396 points and the hair 10,930.

## The cloak, redone the right way

Update 12 ended with Dex's catch: all four Tripo cloaks were closed bells with no room for the arms. The new rule was that a worn garment keeps its openings, and the route was to generate the whole dressed character in Tripo and lift the pieces off it.

**It worked.** Fed the whole picture sheet, Tripo got her construction right in all four variants: bare shoulders, arms going through the puffy sleeves, a padded band above each puff, and the cape and hood as one piece hanging behind with the hood open. Tripo had already split the mesh into separate pieces by itself, which was cleaner than its own cutting tool. Variant 3 was the best, and its cape and hood came out as one clean piece. It replaces the closed bell, which had about 14,700 faces, with a cape of about 3,400.

The new rule from this: **generate whole, extract parts.** Anything the body passes through gets generated with the body in it.

The lifted pieces were not right yet. The puffs and pads sat too low and were too small, skin poked through the pads by up to 2.4 mm, the cape ended at the knee, the hood was too big and faceted with a hole at the nape, and ragged scraps stuck up. None of these was a construction problem any more. They were fit and length, and all were fixed in Blender with no new generation. The puffs and pads were re-fitted, the cape was lengthened, the hood was scaled down about 5%, and the scraps were deleted. The cape, hood, puffs and pads were then rebuilt as clean, even grids of four-sided faces that stay on the old surface, ready for cloth physics, each with its own UV layout.

**What is still wrong with the cloak,** seen when all parts were frozen together and checked by eye beside the picture sheets:

1. **The left side of the hood hangs in front of her face** and hides it from her left. The donor hood was already lopsided, and moving it forward to frame the right cheek pushed the left wall too far. A mirror of the right half fixes it. We show her right side below, where the hood is right.
2. **The cloak edge is paper-thin.** It needs a few millimetres of thickness with a lining and a rim.
3. **The back hem is close but not exact.** The centre is a U just below the knee with longer points at the sides, as drawn, but the side points are about 10 cm shorter than the drawing.
4. **The pads are snug bands,** but the drawing shows a pointed flare on each one that is not built yet.

## The bone arms

C001's forearms and hands are bone, not flesh. The rule for rigid parts is that they only rotate and never stretch, so they cannot be treated like a normal arm with blended weights.

Each arm is now 18 rigid pieces, 36 in all. Each piece is tied to exactly one bone at 100%, so nothing can stretch or blend. The pieces hinge where the bones hinge: the elbow, the wrist, each knuckle and each finger joint. We tested the elbow, wrist, twist, a fist, spread fingers and the weapon grip, on both arms.

<img src="/blog/characterforge-13-frozen-parts-a-real-cloak-and-hand-made-eyes/bone-arms-rotation-test.webp" width="947" height="1600" alt="Bone arm rotation tests on both arms: elbow at 0, 90 and 140 degrees, wrist bends, forearm twist, fist, weapon grip and spread fingers" loading="lazy" decoding="async">

*Figure 1. Every bone arm test on one sheet. Each colour is a separate rigid piece. The grey tube in the grip row is a stand-in for the weapon shaft.*

**Where the twist lives.** A bone forearm cannot roll like a flesh one. Ours is three strands fused into one bundle. We rolled it two ways. Rolling at the wrist made the flat row of knuckles cross the strand ends in plain sight. Rolling the whole bundle inside the elbow plate hides the roll, and the wrist stays exactly as drawn. So the twist lives at the elbow, up to 80 degrees each way.

**What went wrong on the way, and the fixes:**

- Some pieces from Tripo were fused across a joint (the palm and all three pinky bones, and the tip pairs). They were split at the modelled creases, or at the narrowest point.
- The right elbow plate was welded into the skin. It was copied out as its own piece.
- The thumb first bent backwards. Its hinge was re-aimed so it folds across the palm.
- At 90 to 140 degrees of elbow bend, the forearm poked out behind the plate. Moving the pivot 4 mm up and 3 mm forward fixed it.
- There is no wrist block in the bone design. Past about 50 degrees of wrist bend toward the palm, the thumb base touches the forearm end, so that limit is now 50 degrees, not 70.
- The two arms were decimated from 29.8k to 11.9k triangles with no visible change in silhouette.

**The grip.** The first test used the weapon's real 3.9 cm shaft. The slender bone fingers, about 7 cm long, only reach about half way round it. The fix is a grip band of 2.7 cm on the staff, where the key art shows a sleeve. The finger and thumb segments then cover 330 of the 360 degrees round it, and the staff runs 28 degrees off vertical along the forearm with the blade down by her left leg, the way the key art holds it.

## All sixteen parts, frozen together

After the head and body, everything else was frozen in the same scene, in metres. There are 16 objects: skin, hair, cape and hood, two pads, two puffs, two boots, the choker, the chain, the crest, the crest gems, the tassel, the ribbon tails and the weapon. One fingerprint covers all of them, and a clean rerun reproduces it. Boot soles sit on the floor. New geometry in this pass: a choker with a keyhole, a pendant chain down to the navel, a crest with 4 gems where the drawing has 5 or 6, and a three-drop tassel on her right.

Putting all ids in one table caught a real bug. The hair and the choker both carried region id 5, which is harmless until they are in the same file. Region ids now have one owner for the whole character.

<img src="/blog/characterforge-13-frozen-parts-a-real-cloak-and-hand-made-eyes/assembled-clay-front-q34.webp" width="1600" height="1143" alt="First frozen assembly in clay, front and three-quarter from her right: hood, hair, choker, chain, bone arms, puffs and pads, open cape, tassel and boots; the open front shows the nude clay body" loading="lazy" decoding="async" data-nsfw>

*Figure 2. All 16 parts together in clay, front (left) and three-quarter from her right (right). The hair is still the first-pass hair with jagged bangs, and the thin dark strips at the hood edge are the ribbon tails.*

<img src="/blog/characterforge-13-frozen-parts-a-real-cloak-and-hand-made-eyes/assembled-clay-back.webp" width="1600" height="1143" alt="The assembled clay look from behind and three-quarter back: hood, cape with a curved centre hem and longer side points, puffs, bone arms and boots" loading="lazy" decoding="async">

*Figure 3. From behind. The hem has the drawing's shape now: a curve at the centre and longer points at the sides.*

The independent check said **pass with fixes**. From the front, the back and her right side she reads as the approved sheets. It found two failures, both from her left side: the hood wall that hides her face, and both big toes poking out through the inside of the boots. Both fixes are free (a mirror, and hiding the skin faces that sit inside the boots), and they wait for one rebuild after the third hair pass.

## The hair is the worst thing on her right now

The first hair had sawtooth bangs that read as triangles against the sheet's soft layered clumps. A second pass rebuilt it by eye and came out as a comb: 73 thin, near-equal strips, where the sheet has a few big soft clumps. We stopped it. The third pass is aimed by the check notes. The hair in the figures above is the first pass.

## Her eyes are made by hand

The eyes are not generated. Every shape is drawn in code as a designed shape with a soft edge of a few pixels, and there is no blur and no AI pixel in them. They come as separate layers: iris, pupil, white of the eye, a shadow under the upper lid, a window-shaped highlight, a dot highlight, a thin four-point star, three tiny glints, a glow mask and a depth map.

<img src="/blog/characterforge-13-frozen-parts-a-real-cloak-and-hand-made-eyes/eye-kit-sparkle-front.webp" width="1600" height="683" alt="Close-up of the clay head&#x27;s eyes with the star sparkle on: pale grey-green irises with a dark outer line, soft grey pupils, window and dot highlights and a thin four-point star" loading="lazy" decoding="async">

*Figure 4. The eyes on our frozen clay head, front view, with the star on. The skin tint and the zig-zag bangs here are a quick preview shader and the first-pass hair, not final paint.*

The colour is a pale silver grey-green, with a thin dark outline round the iris, which is the strongest trait of the reference. The pupil is a soft mid-grey and not black, because the concept's pupil is barely darker than the iris. Because the layers sit at different depths, the pupil slides a little more than the rest when she looks to the side, which gives the three-quarter view some depth. The star is off at rest. It is meant to bloom only in the close-up of her ultimate attack.

**What is not right yet:** the mood. The reference eyes are calmer and more half-lidded. Dropping the lid further is a shape and a rig key, not paint, so it belongs to the rig. The lashes are lighter than the reference's heavy black mass with a pink lower edge, and they come with the face paint. A thin pale rim shows between the lower lid and the eye at three-quarter angles, which is the face shape itself.

## A skeleton that walks in Unreal

She now has a 320-bone skeleton. It uses the Unreal mannequin's bone names and hierarchy, so animation made for the mannequin can be moved onto her. It also hinges exactly where the rigid bone arms hinge. Of the 320 bones, 188 are chain bones for hair, cloak, hood, puffs, tassel, ribbon tails and pendant, which a physics pass will move later.

The independent check changed the skeleton in four ways: the shoulder joint moved 2 cm up and out after the pose test (the old one flattened the shoulder top at 90 degrees), the spine joints were spaced evenly so a retargeted bend spreads over the chest and not just the waist, 36 lace bones were dropped (the lace trim rides the cape's last row), and the chains were re-run on the final cape.

We imported it into Unreal, and all 320 bones landed within 0.001 cm of where they should be. We then bound a quick stand-in version of her to it with automatic throw-away weights, retargeted one stock mannequin walk, and rendered it. **It walks.**

One finding worth keeping: she stands in heels, so her feet are pitched about 63 degrees, where the mannequin's are about 26. We tried the retarget two ways. With her feet kept in the heeled pose, the ball of the foot stays 0.9 to 1.3 cm above the floor while planted. With the foot flattened to match the mannequin, it floated 6.8 to 7.3 cm. We kept the heeled pose.

**Limits, said plainly:** the weights are for judging poses only, arms overhead crumple the armpit, and the cape does not move yet, so her legs poke through it in a wide stride. The grip pose also has a known problem: the rig's own joint limits clamp it by up to 32 mm, because the limit axes are a few degrees off the joint table's axes. That is a fix for the weighting stage.

## Animation, effects and shaders have started on stand-ins

These three started early, on grey clay stand-ins, so they can run in parallel and so problems show up now. None of it uses her final paint or weights.

- **Animation.** 18 rough clips (idles, game moves, trailer moves and beauty holds) on the stand-in rig. The independent check passed it with fixes. The bone arms read snappy and the cloak and hair trail the way they should. Five things look cheap: the held showpiece pose reads as her lying on a mattress, the ultimate's sweep is done standing on one leg, the front-camera stances read as a frog squat, one attack's tear-out puts her body inside the target, and one dodge reads as hugging a pole (that one is cut).
- **Effects.** Every effect builds and renders from scripts in Unreal Engine 5.8, which was the real win. The look is not there yet. The hero slash crescent is lit like paper and broken in two, the impact bursts are hairline-thin, and frozen rain reads as a starfield.
- **Shaders.** Nine character materials (skin, face, eyes, hair, satin, lace, stockings, bone, gems) with an outline, nine screen-effect materials and three lighting setups, tested on stand-ins with no compile failures. A tone-down pass followed the check.

## A new stage before the sheets, and a layer of sanity checks

The cloak mistake was not unknowable. The facts were known somewhere and lost. The bone arms were listed as rigid in the brief, and the build still nearly gave them normal arm loops, because no later stage read that line. So the pipeline got two additions.

**A construction stage, before any picture is generated.** The character is taken apart on paper. For every part we answer seven plain questions: what is it and how would someone make it, what holds it, what passes through it, how does it move, what states does it have, is it geometry or paint, and how does it join its neighbours. The answers are shown as one annotated picture that Dex can read in a minute and correct. Each part also gets a class (skin, cloth, hair or chain, rigid, mechanism, paint, effect), and the class brings its own build rules. A different kind of character later should only need a new set of style data, not a new pipeline. Every mid-build surprise goes into a lessons file with the specific fix and a general rule. There are more than 40 entries so far.

**Sanity checks, asked by looking.** For each topic (hair, face, eyes, body, cloth, shading, animation, effects, trailer) there is a list of plain questions, each answered by putting a named render beside a reference at the same size. Numbers in it are start values, never a pass mark. The first run over C001 gave 27 items: 22 problems, 4 unknowns and 1 to watch. It confirmed what held up (body, bone arms, skeleton, UVs) and what still reads cheap: the hair, the light on the hair and the face, how the cloak reads, and the feel of the physics.

## The trailer, briefly

Work has started on a character trailer: a written plan for about 96 seconds, a draft piece of music, a stand-in set, and a voice test. The plan is a draft, and there are no trailer images yet.

## What comes next

- **One rebuild** after the third hair pass: mirror the hood's right half onto the left, hide the skin faces inside the boots, and give the cloak edge some thickness.
- **Weights and face keys.** Real skin weights for the body, then the blink, brow and mouth shapes.
- **Paint.** The tracing guide gets baked onto the frozen UV layout and traced by hand, face first, so the eyes above finally get their face.
- **Hair and cloth physics,** re-planned for the new hair, with the float that anime games use and not real-world drape.
- **The look fixes** on the animation and effects passes listed above.

The percentage at the top jumped from 16% to 35% because three stages finished and six more are partly done. The shares for animation, effects and the Unreal build are small on purpose, because those passes run on stand-ins. The stage weights are guesses in days made at the start of attempt 3, and they get re-forecast as real costs arrive.
