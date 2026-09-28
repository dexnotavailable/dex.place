<a id="wide-framing-and-bounded-sprite-generation-comparison"></a>
# Wide framing and bounded sprite-generation comparison

Design baseline. Requirements and proposals below describe intended behavior; release verification is recorded separately.

<a id="confirmed-direction"></a>
## Confirmed direction

- Dex wants original animations eventually and accepts the coherent authored donor temporarily. Preserve a replacement path; do not silently redefine the permanent character as the donor.
- Make characters and ordinary props smaller within a wide composition to increase the feeling of space and reduce the prominence of fine imperfections.
- Add practical rules supporting that direction. Exact camera values are proposed defaults in [01](art-direction-and-audio.md), not individual user approvals.
- A bounded test may compare Higgsfield sprite-sheet output with the generator available in this task. No personal illustrations may be used as references.
- Dex then asked for the strongest available Higgsfield route and explicitly expanded the experiment to different models, because the built-in route might itself use GPT Image 2. The built-in backend identity remains unexposed; that suspicion is not a verified model identity.

<a id="framing-rules-and-their-limits"></a>
## Framing rules and their limits

[01](art-direction-and-audio.md) owns the actual ratios, source/display distinction, readability floors, mobile behavior and quality rules. [02](world-and-gameplay.md) applies them to the existing map.

Wide framing can make tiny shading or contour defects less noticeable. It does not excuse body morphing between frames, foot sliding, duplicated swords, collision mismatch, unreadable telegraphs, missing landing targets or tiny touch controls. Review both the actual play size and a 2x inspection crop. Keep DOM text, QR codes and interaction controls comfortably readable independently of world scale.

Use restrained detail on distant objects, stronger silhouette on the player and interactive props, clear near/middle/far depth, and one focal point per shot. Maintain authored collision and source pixel scale; change framing and world presentation coherently instead of independently shrinking actors or hitboxes.

The scale direction in01 uses monumental mass, familiar scale comparisons and quiet intervals. Its v0.9 refinement treats percentages and exact shapes as tuning guides and draws from the three supplied scale studies; whole distant silhouettes and cropped near masses can both work. A small sprite with unused background padding does not establish the intended relationship. Keep the accepted sense of scale with motion/effects disabled. The historical comparison settings and outcomes below remain unchanged.

Original animation delivery requires the same animation names, pivots, event timing and gameplay interfaces as the temporary donor, or an explicit versioned adapter. Replacing the donor must not rewrite every boss, camera or input rule.

<a id="what-is-being-compared"></a>
## What is being compared

The built-in image generator is available through this task, but it is a hosted tool; do not describe it as an on-PC model. Its exact backend/model is not exposed in this experiment, so the built-in result versus Higgsfield GPT Image 2 cannot be advertised as a verified comparison between distinct model families. Higgsfield is a provider/platform with multiple named models. Identify the actual model, quality, and requested resolution for every Higgsfield result.

The common trial uses one valid sheet per selected model/route, with the same original-character prompt, frame layout, background, motion sequence, and requested 1K output. The selected additional named families are Nano Banana Pro, Seedream v5 Pro, and Recraft v4.1. The GPT Image 2 trial used High quality. These choices are the bounded comparison set, not proof that one configuration is universally the best model for pixel animation.

This is a small production-feasibility comparison, not statistical proof of any provider's overall ability. Access failure or a pending result leaves that entry incomplete rather than making another entry a winner. Record the excluded transport pilot as an actual paid attempt, even though it cannot be quality-scored against the valid prompts.

The existing authored pack remains a motion/provenance control for the production workflow; it is not to be passed into either generator during this no-reference trial. A later controlled reference-assisted trial would be separately labeled.

<a id="experiment-boundary"></a>
## Experiment boundary

The bounded image comparison is closed. No generated character sheet is accepted for production. The chosen authored CC0 character remains the initial animation source. Further experiments require a separate documented scope; they must preserve provenance, exact model identity when exposed, parameters and all results. A pending generation is inspected through its existing record rather than resubmitted blindly. Account access, request identifiers and billing history are not part of the public edition.

<a id="fixed-test-brief"></a>
## Fixed test brief

- Newly described masked traveler with katana, charcoal coat and a restrained red belt; unrelated to existing art or named game characters.
- Requested 1024x1024 output, exactly 4x4 cells; each output cell 256x256 represents logical 64x64 pixels at 4x scale. Actual size remains a scored result, not an assumed fact.
- First eight cells: a side-facing run cycle. Last eight cells: a grounded slash sequence.
- Fixed logical root x32, foot baseline y54, roughly32-pixel body height; uniform magenta background with no grid/text.
- Same anatomy, clothing, sword and scale in every frame. No generated scene or effects masking motion.
- Preserve raw output. Exact cell slicing/playback is an inspection derivative; no frame-specific recentering, repainting, warping, interpolation or corrective edits before scoring.

Raw comparison assets remain private and are not shipped game assets.

<a id="scoring-and-evidence"></a>
## Scoring and evidence

| Dimension | What to inspect |
|---|---|
| Structure | Actual image dimensions, frame count, grid placement, clipped content, background consistency |
| Identity | Head/body proportions, costume, limbs, katana count/length/grip, facing direction |
| Registration | Feet baseline, root stability, transparent/key background margins, unintended camera or scale changes |
| Motion | Run contact/passing poses and loop seam; slash anticipation/contact/recovery continuity |
| Integration | Named frame mapping, predictable crop cells, event-window suitability, absence of fabricated text or baked effects |
| Gameplay-size read | Native intended small presentation and 2x inspection; silhouette remains legible |
| Effort and access | Actual attempts, model/settings, available cost information, failures, and correction work required |

Use `pass`, `partial`, `fail`, or `not tested` per dimension and explain visible defects. Do not invent numeric accuracy or frame-timing metrics. A static sheet alone cannot pass motion; use derived fixed-cell playback/sequence inspection and explicitly state any playback limits.

Prompt adherence is not the same as a production animation. Even a better generated sheet must clear the coherent-source, missing-state and object-production gates in [10](world-production-workflow.md) before it can replace the authored pipeline.

<a id="outcome-and-attempt-register"></a>
## Outcome and attempt register

The comparison tested the hosted built-in image route and named GPT Image 2, Nano Banana Pro, Seedream 5 Pro and Recraft 4.1 routes. The built-in backend identity was not exposed, so the comparison cannot establish that every branded route represents a distinct model family. One sample per valid route is limited feasibility evidence. A malformed transport attempt was excluded from quality scoring. Outputs were not promoted into the game. The observations below retain the practical lessons; account ledgers and provider identifiers are excluded.

<a id="completed-quality-observations"></a>
### Completed quality observations

- Independent static review found broadly stable character identity in both sheets, with remaining registration and weapon-construction changes.
- In both sheets, the sword in slash frame 5 extends into the neighboring cell assigned to slash frame 6. Fixed cell extraction therefore risks mixing or clipping adjacent-frame content.
- Built-in output also misses the requested size/integer pixel-grid contract. Do not silently resize or recenter it before the raw-output score to make adherence appear better.
- Fixed-cell GIF inspection derivatives exist under the proof directory. They preserve the sheet's cell assignment; they are inspectors, not corrected production animations.
- No engine integration, gameplay playback, hitbox timing, mobile control, or source-edit/re-export proof has been performed. A static review and derived GIF do not pass those gates.
- Nano Banana Pro retained broad identity but added forbidden grid lines, crowded the frame borders, repeated run poses and produced a discontinuous slash with cross-cell blade spill.
- Seedream5.0 Pro offered the most promising art/layout reference of the three added samples, with approximate foot-line alignment and sensible spacing. Its run poses are near-duplicates/walk-like; it adds baked ground marks and clips a slash at the outer edge. Weapon continuity still needs authoring.
- RecraftV4.1 gave a simple silhouette, but its requested slash is mostly a repeated guard pose with a changing blade. Run8 also changes into that guard prematurely.
- None is a finished production animation. The interim authored donor remains the accepted path, with eventual original animation still required. A small-view preview does not waive the structural failures.

This is a one-sample-per-model/route finding. Use the report and raw artifacts, not a blanket claim that a provider is universally superior. Keep the excluded pilot in history. Further trials require documented scope and retain all attempts.

<a id="dexs-final-review-and-production-decision"></a>
## Dex's final review and production decision

Dex judged all generated animations poor overall, the built-in route least bad, and its swing only tentatively acceptable. This differs from earlier reviewers' preferences for individual still-image/layout qualities and is the authoritative taste decision. No generated sheet is selected for production. Use the CC0 Martial Hero as authored for now; original animation remains the later target. The bounded experiment is closed.
