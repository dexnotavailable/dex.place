# A/B log (character-01)

## r1: profile K1.2 (A) vs 3/4 + K1.0 (B) -> B
- B matches ref density/orientation; skirt reads.
- Still off: flat chest slab; cape+hair curtain hides waist; socks cover the legs; stiff soldier pose.

## r2: + bust forms, hourglass corset, over-knee socks, waist tails, hand-on-hip pose -> B
- Attitude and a readable bust; thighs visible.
- Off: flat rendering vs refs' 4-5 tone form shading.

## r3: + form lighting (own-outline height field + bumps -> normals -> 5-tone ramps) -> B
- Thighs/bust/hair read round; A looks flat next to it.
- Off: capelet reads as a pauldron; pose vertical and symmetric; face generic; hair a straight curtain.

## r4: face -> B (a/b/c)
- 4a: face widened to ~19px, eyes lowered clear of the bangs, locks moved out to frame, smirk. Reads as a face, not a helmet.
- 4b: eye whites + 3-tone iris; bang strand texture. Marginal.
- 4c: upswept (tsurime) lash design + warmer skin. Attitude arrives.
- Off: stiff vertical stance; capelet pauldron; face still less rendered than Akko.

## r5: contrapposto -> B (5c)
- 5a subtle; 5b crossed knee tangled the legs (rejected); 5c = hip out + counter-tilt with legs apart.
- Halo redrawn as a 1px ring (was reading as antennae); pauldron overlay removed in 3/4.
- Off: black socks read as stilts; dark materials too black to show form; hair one curtain.

## r6: knee socks + lifted dark values + front locks -> B
- Legs read long and pale with knees (pink-katana ref); forms visible in dark cloth.
- Off: skirt underside reads as shorts; sleeves are pipes; hair a flat curtain; shoes blobs.

## r7: hem trim from real outline distance (curD), sleeve puff/folds, shoe shine -> B (small)

## r8: hair wave/fan + sheen dashes, tattered overskirt panels across the back waist, wider front locks -> B
- Dynamic silhouette; dark panels frame the pale legs.
- Off: single-pixel noise in pleats/hair (refs have clean clusters); hair wing heavy.

## r9: despeckle (orphan cleanup) -> B (marginal, ~150px cleaner)

## r10: slimmer arms with elbow/wrist narrowing -> B; pleat rewrite -> A (blotchy, reverted)

## r11: nearest-bone leg shading (fixes bare shins in deep bends), knee miter clamp, bounce light -> B

## r12: eye lower lid + second catchlight, lit far cheek, lip highlight -> B

## r13: hair cap/bangs strands radiating from the crown, clumped angel ring -> B (helmet read gone)

## r14: costume -> split (dark top, white knee socks) + lifted dark blouse; literal 'death above, angel below'. Variants stay toggleable.

## r15: one bold sheen per hair clump (no dashes), red lining at tattered tips -> B
- Static art now at game-sprite ref level (demons / pink katana); next gains come from motion.

## F1: face contour + eyes (shorter tapered chin, bigger softer irises, nose) -> B

## C1: hourglass pass (narrower waist, fuller bust and hips) -> B (subtle)

## F2: face becomes authored pixel frames, not rig -> B
- At ~19x22 px, spline contours can't place a chin, eyes and mouth precisely, so the face is a
  hand-pixelled sprite (V-chin, cool sclera, 5px iris dark-to-bright, lash flick) with
  expression frames (open / focus / closed / pain, smirk / open mouth).
- Features are composited after lighting, masked to visible skin, so shadows and bangs can't muddy them.
- Fix: sprite pixels shared a layer id with the bangs, so the bangs' cast shadow skipped the face.

## S1: skirt becomes authored frames, not springs -> B
- Rule going forward: rig for limbs and anything that must track the ground/IK; frames for
  cloth, face and FX, where an animator's drawing beats a simulation.
- Frames: rest, rise (hugs), apex (floats), fallA/fallB (flip up, bell, crimson lining band,
  flutter every 5 ticks), land0-2 (squash, rebound, settle), run0-3 (contact/passing sway,
  scaled by speed), dashA/B, flare0-2 (turns and spins). Held at least 2 ticks (on twos).
