# Rosace package: motion plan, sources, how it is built

Goal: the World's player is the real rendered Rosace (drive-9 round 2 look, `R2`) instead of the procedural
stand-in, at both sizes (`public/world/character/` 80 px, `public/world/character-closeup/` 144 px), all 17 clips,
gameplay timing untouched. Character design belongs to the Codex lanes; this only packages what exists.

## What is used, read-only

| Input | Used for |
|---|---|
| `D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend` (sha256 `aef28c7f...`, the promoted drive-9 R2 build) | opened by Blender, never saved, no backups touched |
| `tools/pixel-pipeline/drive9/` (`d9_blender.py`, `r2_blender.py`, `d9_post.py`, `r2_model.json`, `r2_finish.json`), `finish_f1/f2/f3`, `rosace/`, `rosace_v2/figure_pose.py` | the promoted stills chain (PIPELINE.md 3.6r), loaded from the Dex checkout, never edited |
| `art/rosace/drive9.json` `promoted` | head scale 1.10, model/finish picks |
| `art/rosace/poses/*.json`, `poses/motion/*.json` | hand-posed hero keys |
| `src/lab/data/player.clips.json`, `src/lab/art/standin-poses.ts`, the World's sit poses | the clip definitions and the stand-in's code-authored poses |
| `D:/Dex/Automation/reports/dex-suite-resumption-20260930/` (STAGES.md, lanes) | newest ACCEPTED look: R2 stays default, no newer look is accepted |

R2 is used. FC1/W2/C2/FH1 candidates in the receipts are rejected or unaccepted appearance trials; none replaced R2.

## Motion inventory and the choice per clip

Three kinds of motion exist, and what each is good for:

1. **The stand-in's code-authored poses** (`standin-poses.ts`, 71 pose keys, side view, one per drawing of every clip,
   plus the World's two sit poses). They carry the exact timing, phases, hitbox reach and root motion the controller
   was built around. Driving the Rosace rig from them (`posemap.py`: feet, knees, hips, torso lean, head, glaive,
   hands, elbows, hair/cloth wind, all from the stand-in's solved 2D skeleton) keeps every frame count, duration,
   hold and phase identical. This is the default for every drawing.
2. **Hand-posed hero keys** already judged in the drive-9 rounds: `idle_appeal` (the drive-9 idle), the N1 set in
   `poses/motion` (`n1_coil_r3`, `n1_strike_r3c`, `n1_contact_r3b`, `n1_over_r3c`, the same coil/strike/contact/over
   mapping Codex's n1-n2 driver recipes use for m1_1) and `q_stamp`. Where the stand-in drawing means the same thing,
   the hero key is rendered instead (same frame, same ticks). They carry much better anatomy and appeal.
3. **Retimed Kimodo / GEM-X motion** (`motion-ai/retimed/n1_*.npz`, `n5_*.npz`; PIPELINE.md 3.14): only N1 (33
   ticks) and N5 exist. Their timing is not the World clips' timing (frame counts and phases differ), and N5's spin
   points the glaive at the camera from a side view, so neither is used as a whole clip. Their hero keys are (item 2).
   Codex's `codex/rosace-motion-fx-integration-20260930` N1-N2 driver (`specialists/motion/poses/n2_*.json`) is
   "authored-native-unexecuted" (never rendered or accepted), and `codex/rosace-frame-export-20260930`'s exporter needs
   release qualification receipts nobody has issued; both were read, neither is used (this package has its own packer,
   `pack_atlas.py` + `build_manifest.mjs`, and uses the World's own validators).

| Clip | Drawings | Ticks | Source |
|---|---|---|---|
| idle | 4 | 72 | hero `idle_appeal` + a 1.6 degree breath delta (breath 0 / 0.5 / 1) |
| run | 8 | 24 | stand-in poses `run0..run7` on the rig (the planted foot travels the stand-in's stride, no skating) |
| jump | 1 | 600 | stand-in `jumpRise` on the rig |
| apex | 1 | 60 | stand-in `jumpApex` |
| fall | 2 | 66 | stand-in `jumpApex~fall:0.5`, `fall` |
| land | 2 | 8 | stand-in `land`; `land~idle0:0.5` = rig blend into the hero idle |
| double_jump | 5 | 16 | stand-in `djump0..3` (the glaive twirl) + `djump3~jumpApex:0.5` |
| dash | 5 | 18 | stand-in `dash0/1/dashEnd`; `dashEnd~idle0:0.5` blends into the hero idle |
| dash_attack | 5 | 27 | stand-in `dAtkWind/Thrust/Follow` + blends |
| m1_1 | 5 | 24 | hero N1 keys: coil, strike, contact (hitbox frame), over; last frame blends into the hero idle |
| m1_2 | 5 | 24 | stand-in `m1bWind/Strike/Follow` (rising slash); last frame blends into the hero idle |
| m1_3 | 5 | 28 | stand-in `m1cWind/Low/Sweep/Follow` (the spinning sweep, kept in the side plane) |
| m1_4 | 7 | 45 | stand-in `m1dRise/Hang/Slam/Hold/Recover` (the finisher) |
| skill_q | 5 | 42 | stand-in `qRaise`, rig blend into hero `q_stamp`, `q_stamp` (plant), `q_stamp` settled (hold), hero idle |
| ult_r | 8 | 74 | stand-in `rCall/rRise/rCleave/rHold` and blends |
| hurt | 2 | 20 | stand-in `hurt`; `hurt~idle0:0.5` blends into the hero idle |
| sit | 4 | 88 | stand-in sit poses on the rig (pelvis on the bench: seat top 0.28 H) |

74 drawings per size, 71 distinct pose keys (the clips repeat `dash1`, `rCall` and `rRise` as the definitions do).
`data/render_map.json` is the exact pose key to drawing table (`make_render_map.py` writes it).
Nothing is image-generated; every pixel is rendered from `rosace.blend` through the drive-9 chain.
Recovery frames that blend into idle blend the *rig* poses (never pixels), and `qHold~idle0:0.5` is the idle stance
itself because a q_stamp/idle blend pulls the glaive out of both hands.

## Pipeline (all Blender/GPU through the exclusive gate, one process at a time)

1. `node tools/rosace-package/standin_dump.mjs`: stand-in poses + clip frame tables -> `data/standin_solved.json`.
2. `render_batches.py` (via `gate.sh -x`): 12 keys per Blender process; `render_frames_bl.py` opens `rosace.blend`
   read-only, applies R2's mesh edits, circlet and head scale, poses each frame (`posemap.py` or a hero key), and
   renders the 4x id/normal/depth/light/noise passes at 144 and 80 plus the face pass. Camera: orthographic, yaw 62,
   elevation 8, she faces screen right (the runtime mirrors), world origin = the foot pivot, light fixed in camera space.
3. `finish_frames.py`: the promoted R2 finish (`d9_post.process`, unchanged) per frame, plus the contract's normal
   map (r = x right, g = y down, b = toward the viewer; alpha 0 on ink: outline ring and inner lines).
4. `unify_palette.py`: one palette per material across all frames of a size (the per-still quantiser drifts tones
   frame to frame, which would shimmer in motion). Ink and face pixels are untouched.
5. `pack_atlas.py`: trim, shelf-pack (the repo packer's order and 2 px gutter) one albedo + one normal atlas per size.
6. `build_manifest.mjs`: `dex.sprite/1` manifests; the clip definitions are scaled with the World's own
   `scaleClipSource` (hitboxes, root motion, event offsets) so counts/durations/holds/phases/cancels/events are the
   stand-in's; per-frame anchors (`tip`, `butt`, `handN`, `handF`, `head`, `chest`, `halo`) come from the posed rig.
7. `verify_package.mjs`: contract + `validateExportPair` + definition match + atlas PNG sizes + no placeholder drawings.
8. `capture_world.mjs` + `world_strips.py`: the real game headless, every clip at 80 and 144, idle/run/attack/ult in two rooms.

Rollback: delete `public/world/character/` and `public/world/character-closeup/` and rebuild; the loader finds no
manifests and bakes the stand-in again (`capture_world.mjs --probe` reports `standin` for both).

## Known limits (honest)

- Cloth and hair are posed (drape chains solved at pose time), not simulated; no physical sleeves or transitions.
- Hands are the plain rendered rig hands (no constructed-hands pass, which the promoted chain does not include).
- The mapped poses are a side-view reading of a 2D stand-in; the stand-in's blend drawings (1-4 tick smears) are rig
  blends, so a few of them (glaive crossing the floor in `m1dHang~m1dSlam`, `m1cLow`) are rough.
- `data/standin_solved.json` and `data/render_map.json` are generated; the sit poses are copied from `standin.ts` (private there).

## Result (this package)

| | 80 px (`character/`) | 144 px (`character-closeup/`) |
|---|---|---|
| clips / drawings | 17 / 74 | 17 / 74 |
| albedo atlas | 2002x342, 286 KB | 2016x1063, 666 KB |
| normal atlas | same size, 369 KB | same size, 992 KB |
| manifest.json | 57 KB | 57 KB |
| palette | 932 distinct colours over all frames | 1320 |

Checks run: `node --test src/site/world-character.test.mjs` (12/12), `node src/world/tools/character-assets-regressions.mjs`
(12 PASS), `npm test` (102 of 103; the one failure, `content.test.mjs` "placeholders ... not in the feed", fails identically on
the base commit 44dc763 and on origin/main 75c998f), `npm run check`, `npm run build` (dist/world carries both packages),
`tools/rosace-package/verify_package.mjs`. Headless /world/ (software WebGL) reports `source: pipeline` at both sizes with
0 console errors; rollback (both folders removed) reports the stand-in at both sizes, restoring them reports pipeline again.
