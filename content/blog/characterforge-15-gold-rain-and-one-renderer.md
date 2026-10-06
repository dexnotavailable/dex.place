---
title: CharacterForge 15: gold, rain and one renderer
summary: The trailer will render entirely in Blender Cycles at 4K. Her bone hands are now polished pale gold, she gets wet, a shared look library is in place, the rig and physics were rebuilt on the final shapes, and her Japanese voice has four designed candidates.
date: 2026-10-06
nsfw: true
---

CharacterForge is building one playable anime-style character, C001, in Blender and Unreal Engine. This update is about the look side of the last few hours: where the trailer gets rendered, how close our close-ups are to the games we measure against, the gold hand, rain, the rig and physics rebuild, and her voice. The paint work has its own update.

**This post contains one nude image.** C001 is an adult, a woman in her mid-twenties. One strip of grey clay frames below shows her nude clay body under the open cloak, and it is blurred until you click "Show image". The other images are clothed close-ups and are not blurred. As before, there is no concept art, no key art, none of the dressed picture sheets and no frame from any other game or studio. Verified: own renders only, with one nude clay strip, NSFW-tagged.

<!-- tldr:start -->

> [!NOTE]
> **TL;DR** — Progress (playable character): **48%** · Now: **S6 — Paint** (the model is re-frozen with the generated hair restored, rebuilt accessories and generated shoulder fans; paint is being redone trace-first with a new shared tracer, the torn bodysuit is in its last fix round, and the rig and hair and cloth physics are redone on the new freeze)

**Roadmap.** S0 to S12 are Product 1.

| Stage | Work | Status |
|---|---|---|
| S0 | Brief: read the design images, set up the folders | ✅ done |
| S1 | Sheets: multi-view picture sheets (turns, body, parts), approved by Dex | ✅ done |
| S2 | Tripo shapes: head + hair, body, boots, weapon, cloak as quad meshes | ✅ done |
| S3 | Texture guide: first-pass colour on the shapes (a tracing guide only) | ✅ done |
| S4 | Regions: palette and region IDs on the meshes | ✅ done |
| S5 | Loops, UVs and freeze: clean flow where things bend, then lock the layout | ▶ in progress, 92% |
| S6 | Paint: the paint of record, face first | ▶ in progress, 25% |
| S7 | Maps: shading and processing maps | ▶ in progress, 30% |
| S8 | Rig: skeleton, weights, face keys | ▶ in progress, 65% |
| S9 | Physics: hair and cloth chains | ▶ in progress, 60% |
| S10 | Animation: idle, run, attacks, emotes | ▶ in progress, 15% |
| S11 | VFX: attack and ultimate effects | ▶ in progress, 15% |
| S12 | Unreal build: assembly and a playable build | ▶ in progress, 10% |

*As of 2026-10-06. Percentages are effort-weighted stage estimates and get re-forecast as real costs come in.*

<!-- tldr:end -->

## The short version

- **Decided:** the whole trailer renders in Blender Cycles at 4K. Unreal is parked for the trailer, not deleted.
- **Worked:** the bone hands read as polished pale gold, water beads on metal behave like real little lenses, a shared look library now feeds every shot, the rig was rebuilt with one bone chain per hair strand, and the knotted pendant chain and the shoulders showing through the cloak are fixed.
- **Still short:** our close-ups score 4 to 6 out of 10 against the reference games. The gaps are lighting and content, not the renderer. One new eye setting made the eyes worse in three-quarter shots and has to be capped.
- **Next:** the face and eyes through the new tracing tool, hair paint, then the trailer shots.

## One renderer: Blender Cycles at 4K

The plan had been to render the trailer in Unreal Engine. We ran a test instead of assuming. Four shots were built in Blender: a wet gold hand, an eye macro, a face close-up with a blurred shape in front, and two seconds of an action shot with motion blur, rain and effects. Each was rendered in Cycles (Blender's path tracer) and in EEVEE (its fast real-time engine), then put beside the reference frames.

Cycles won the hand and the face and tied on the eye. In EEVEE the water beads read as glitter and the cheek picked up scratch-like marks. The action test showed that Blender already does everything the reference shots need: real motion blur on the cloak and the weapon, depth of field, thin slanted rain, and bloom that only lands on the brightest things.

So an independent judge decided: **all 8 close-ups and the whole 40-second cut render in Cycles at 4K.** The reasons, in order:

1. **Cost.** A close-up frame takes about 50 to 90 seconds, an action frame about 8 to 13. The whole cut, re-renders included, is one overnight render of about 5.5 to 9 hours on one graphics card.
2. **Matching.** One set of materials and lights means the gold, the hair and the wet look are the same in every shot. Splitting the trailer between two engines would mean matching two look setups by hand, again every time either side changed.
3. **Proof.** Blender has rendered all of these shots. Unreal has rendered none of them.

To be plain about it: **this is not "Cycles beat Unreal".** Unreal was never rendered for these shots. The decision rests on cost, on matching, and on Blender already doing what the shots need. Unreal comes back if a Cycles shot runs more than three times its time budget, or if a shot needs something Blender handles badly, such as dense fog at scale or many characters. Dex can overrule the decision.

## How close are we to the games we measure against

Dex set the bar: the close-up shots in the trailers for **Arknights: Endfield** and **Wuthering Waves**, plus a rain showcase by the artist **Sakura Rabbit** for wet skin. We studied 24 frames from those videos privately. They are never published, and nothing is sampled from them. Here they are only described in words. Each of our test shots got a score from 1 to 10, where 10 means as good as its reference frame.

The first round, straight out of the renderer test:

| Shot | Score |
|---|---|
| Wet gold hand | 6 |
| Eye macro | 5 |
| Face close-up with foreground blur | 6 |
| Action frame | 4 |

The judge's main point: **nothing is at the reference level yet, and the gaps would look the same in any renderer.** The gold reflected a large area of flat pink skin, so it looked like brass-chrome. The hair was blown out to flat white. The iris was a flat grey, like a contact lens. The action frame had flat blue moonlight and stand-in props that pulled the eye. Those are lighting and content problems.

After the look library (next sections), an independent check re-scored the same shots:

| Shot | Before | After | What changed |
|---|---|---|---|
| Wet gold hand | 6 | 6 | Crisper beads with dark rims; the gold is still warmer than the target |
| Eye macro | 5 | 6 | Bigger reflection of the flame, a small glassy window highlight, a dark top edge on the iris |
| Face close-up | 6 | 5 as rendered, 6 to 6.5 with one setting fixed | The hair is no longer blown white, but a new eye setting broke the eyes (below) |
| Hood and cloak | 3 | 4 | It reads as matte damp leather now, not latex |

The action frame was not re-scored in this round. So the honest summary is small steps: two shots better, one equal, one worse until a single value is changed.

<img src="/blog/characterforge-15-gold-rain-and-one-renderer/eye-macro-cycles.webp" width="1600" height="738" alt="Close-up of C001&#x27;s right eye in Cycles: pale grey iris, a dark pupil, a flame reflection over the upper iris, a small window highlight and three tiny star glints" loading="lazy" decoding="async">

*Figure 1. The eye macro, our Cycles render at 4K, 100 mm at f/11. The flame is a reflection of a candle card in the scene. Still wrong: a thin red halo round the flame, a short white dash across it, a soft pupil edge, and the iris is still pale with little depth.*

<img src="/blog/characterforge-15-gold-rain-and-one-renderer/face-closeup-cycles.webp" width="1600" height="738" alt="C001&#x27;s face in Cycles, three-quarter view under the black hood, silver bob with green crest gems, a warm blurred shape in the left foreground" loading="lazy" decoding="async">

*Figure 2. The face close-up, our Cycles render at 4K, 135 mm at f/8, with the eye fix applied. The hair now sits at a lit grey value instead of blown white, with strand lines. The blurred mass on the left is meant to read as a shoulder in the foreground; it still reads as a brown blur. Body paint and face paint are not final.*

## The gold hand, and what metal showed

C001's forearms and hands are bone. Earlier in this attempt the plan was ivory bone. Dex picked **polished pale gold**, the colour of the reference, and warned that metal would hide nothing in the mesh. He was right.

Mirror-like metal shows every bump as a kink in its reflections. To check the shape we used zebra stripes (a test where straight black and white bands are reflected in the surface: smooth surfaces bend them smoothly, dents make them jump) and a light moved across the hand. That found two problems:

1. **A dent in one claw,** about a third of the way down. The stripes stepped sideways there under every light. No smoothing hides a dent in the shape itself.
2. **Lumpy joints at full 4K size.** The bones of the palm and the joint ends looked inflated, like soft tubes. A render-time subdivision hid the facets but not the lumps.

On top of that, a full count over both arms found 121 open edges and 213 edges where the surface did not join cleanly.

**The fix** was a careful cleanup of the existing mesh, not a new generation. The claw dent is gone, its stripes now run straight and taper with the claw, and the open and badly joined edges went from 121 and 213 to zero. Each arm is still made of rigid pieces that only rotate. An independent check moved them through all 16 test poses, and the most any piece bent was 0.00002 mm, which is rounding noise. The fixed arms are ready but not yet merged into the frozen character, because the merge changes the skin file and has to wait for the body paint.

Dex asked to keep the full, rounded bones of the palm, even though the picture sheet draws them slimmer. A second route also runs: Tripo makes a new high-detail version of the bone arms, which then gets compared with the cleanup under the same gold light.

<img src="/blog/characterforge-15-gold-rain-and-one-renderer/wet-gold-hand-cycles.webp" width="1356" height="1600" alt="Close-up of C001&#x27;s wet pale-gold skeletal hand raised in front of her chin and black choker, covered in clear water beads" loading="lazy" decoding="async">

*Figure 3. The wet gold hand, our Cycles render at 4K, cropped. This is the mesh from before the cleanup, so the dent in the front claw is still there. The gold is still too warm, because it mirrors the pink skin around it. The next change is the pose: the hand in front of the dark hood.*

## Rain on skin and on metal

Dex decided she gets wet. Every material now has a wetness control per shot, and a baked "shelter" map decides where rain lands. Under the hood the face and the hair stay dry; the top of the chest, the top of the hood and the outside of the cloak get wet. Each material has its own kind of water.

- **On metal and vinyl:** real beads, about 10,000 of them on the hand shot. In Cycles each one is a small lens. It shows the gold behind it bent, a hot point of light, and a dark rim. That dark rim is what the reference has. We first tried surrounding the hand with black cards so the gold would get darker, but at full strength the beads turned into black holes, because they refract the black. The version that shipped keeps the black cards out of the beads' view.
- **On skin:** two styles were tested side by side, in both orders. One is the dark flat blots that Endfield uses on wet skin. The other is the small bright specks from the Sakura Rabbit showcase. On bare skin the dark blots looked like freckles or blemishes. **The bright specks won.** They are now the default, and the dark blots stay as an option.

The check found two limits. At a medium shot size neither style reads as wet yet: the skin needs a closer lens or a few larger drips. And the bright specks stay bright inside shadows. They should dim there.

## A look library for every shot

All of this lives in one shared look library for Blender. Every trailer shot now takes its materials, wetness, lights, camera and post-processing from the same place, and a shot only sets up its own geometry and framing.

- **13 materials:** skin, hair, satin, sheer knit, stocking, gold, vinyl, leather, lace, gem, eye, cornea and water.
- **A light kit** that moves with the camera, with a partial dark reflection set for metal, and studio, moon, candle and crimson versions.
- **Camera presets** with real f-stops and motion blur. Nothing is shot at f/1.4 any more, because at that aperture only about 8 mm of her face was sharp.
- **Post:** bloom only on things brighter than white, slight colour fringing only at the frame edges, and film grain.
- **A thin, tapered red-brown outline,** like the sheets. It is never drawn on gems, chain links or glass.

The independent check kept the library, with one exception, which we show here because it is a good example of why every change gets checked against the version before it. A new glassy highlight on the cornea (the clear dome over the eye) looked great in the front-on eye macro. In a three-quarter face shot it turned into a near-mirror at a glancing angle. It reflected her eyelid skin and hair into the eye, as white blocks on one iris and a pink band on the other. The checker found the cause by switching settings off one at a time. Setting that one highlight to zero fixes it. Until it is capped, every three-quarter face shot renders without it.

<img src="/blog/characterforge-15-gold-rain-and-one-renderer/cornea-catch-before-after.webp" width="900" height="772" alt="Two crops of C001&#x27;s eyes in a three-quarter face shot; top: white blocky fragments on the viewer-left iris and a pink band on the viewer-right iris; bottom: the same eyes, clean" loading="lazy" decoding="async">

*Figure 4. Top: the eyes with the new cornea highlight at full strength. Bottom: the same frame with it at zero. Both are our Cycles renders at 4K, cropped at 1:1.*

The anime check passed. The face and the eye still read as an anime game still, not a 3D doll. Four rules from the first renderer test keep it that way: soft light through the skin kept small, a dark under-layer in the hair that is baked in, never computed live, smooth shading on the hard accessories, and eyes that are mostly unlit.

## The rig and physics, rebuilt on the final shapes

The rig had been built on hair that was later thrown away. The current hair is Tripo's original hair, restored after our own rebuilds made it worse. So the skeleton, the weights and the physics were all redone on the final frozen character.

**Per-strand hair.** Dex asked for the hair strands to be identified and given their own bones. The main rig now has 481 bones, including 92 hair chains, one per strand. A lighter version for gameplay has 312 bones, with the hair grouped into 14 clusters. To be honest about the strands: Tripo's hair is mostly one dome whose edge is cut into about 80 points, plus 26 small separate blades. Some strands have real edges in the mesh, and the rest are drawn in along the flow of the hair.

**Gacha float, not real cloth.** Anime games do not move hair and cloth like the real world. Hair trails the head, overshoots once, and is back home in about half a second. The cloak opens into a bell on a turn and falls back into its drawn shape. That is what we tuned for, and the independent look check passed it: the hair settles in 0.3 to 0.5 seconds, the bangs stayed above her eyes in all 48 face frames it looked at, and the cloak falls back into the same folds every time. 36 clips were baked.

<img src="/blog/characterforge-15-gold-rain-and-one-renderer/float-turn180-strip.webp" width="1440" height="323" alt="Six clay frames of C001 turning 180 degrees with the weapon, her nude clay body under the open cloak in the first frame; the cloak opens into a bell during the turn and falls back into its folds" loading="lazy" decoding="async" data-nsfw>

*Figure 5. A 180-degree turn in clay, with physics, frames 14 to 36. The cloak flares into a bell mid-turn and is back in its drawn shape by about frames 28 to 36. These are test clips made for tuning the springs, not final animation.*

The check found two things that looked cheap, and both are fixed:

1. **The pendant chain knotted.** Its big links swung up to 31 cm, like a wrecking ball, and folded into a crumpled knot on her chest. The cause was simple: each of the 11 links could bend 20 degrees with no limit on the total, which adds up to more than 200 degrees, so the chain could fold back on itself. The links now get smaller limits, no link may swing more than 31 degrees away from where it would hang on a rigid chain, the swing is damped more, and the links cannot come closer to her chest than they hang at rest. The swing went from 31.5 cm to 11.9 cm, and the chain now reads as one hanging line that swings and settles.
2. **Her shoulders showed through the back of the cloak** whenever her arms came forward. That was a weighting problem at the collar, not physics. It is fixed with 84 corrective shapes on the cloak, picked frame by frame. Frames with skin showing through went from 1,839 to 241 out of 2,021, and to none in the named test poses.

Still open: thin slivers by the arm slits, poses with the arms straight up (parked), and the cloak-against-shoulder-fan clearance.

## A Japanese voice, designed from text

Her trailer lines are in Japanese, in a polite, theatre-themed register: six short lines plus a laugh, a breath and a hum. Her voice is not cloned from anyone. It is **designed from a written description** (an adult woman in her mid-twenties, a medium-low velvety voice with a light breathy edge, polite on top and quietly dangerous underneath) with a voice design model, Qwen3-TTS.

We made **four candidate voices**: the brief as written, the same brief written in Japanese, a breathier and softer one, and a lower, cooler one. A second model, VoxCPM2, then read every line in each voice: 160 Japanese takes in all, plus 46 English alternates from a third model, Dramabox. All three run on our own machine.

Our tools cannot judge how a voice sounds, so every take was checked by proxies instead: transcribe it back and compare the words, measure the length against its slot in the picture, check the level. Those proxies cannot tell beautiful from flat, so **Dex picks the voice by ear.** What the proxies did show:

- The first takes ran about 1.8 times longer than their slots. Brisk directions, commas instead of long pauses, and the best of four takes brought most lines down to 1.0 to 1.5 times. The longest closing line still does not fit at a natural pace, so it uses a tighter alternate.
- One short line, "anten" (blackout), keeps getting slurred, so it is not done yet.
- The only Japanese transcriber on the machine is small and mishears some words, so its error numbers are worse than a good listener would hear.

## Substance is installed

Dex has an Adobe Substance subscription, so Substance 3D Painter and Designer are now installed. Designer's command-line tools already work in the pipeline: they made five small tiling detail maps for the look library from Designer's own library (a knit, a satin weave, a pebbled leather grain and two scratch maps). Painter comes next, for the paint work.

## What comes next

- **The face and eyes through the new tracing tool.** The tool is being built now. The face gets traced from its generated guide, with no generated pixels in the face and eyes themselves.
- **Hair paint and shading** on the restored hair.
- **Cap the cornea highlight,** pose the gold hand against the dark hood, and merge the cleaned gold arms into the frozen character.
- **The trailer shots,** all in Cycles at 4K, starting with the 8 close-ups.

The stage table at the top still names stage S12 "Unreal build". The playable game build is still planned for Unreal; only the trailer moved to Blender. The percentages are rough: the stage weights are guesses in days made at the start of attempt 3, and they get re-forecast as real costs arrive.
