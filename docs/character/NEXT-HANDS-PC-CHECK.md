# Readable hands: first controlled 3D comparison

R2 remains promoted at5.78; target remains reference parity9. Both the collar
adapter and headtilt8 trial lost to the preserved baseline and are retained,
unpromoted. This request moves to authored hand anatomy and visible grip.

**Candidate H1:** only idle hand geometry changes, using both hand bones at
absolute uniform scale1.30. The original authored palm/fingers deform in3D;
there is no replacement hand stamp, paint blob or image generation. Wrist
translation compensates the gripped hand's increased rest offset so the
synthetic grip center stays on the exact R2 socket and slide. This contact
constraint can change lower-arm/elbow IK; it is not a claim that arm pixels or
transforms stay identical. The original free-hand position/finger gesture,
R2 head tilt16, body, hair, outfit, weapon and finish remain the control.

H1 is intentionally not stacked with a cuff/pose/value/face change. If size is
visible but wrists remain buried, the next separately judged staging letter
can expose the wrist at the sleeve mouth. Do not run it without first viewing
H1's actual pixels and checking its anatomy/contact.

## Source and route

- `next/hand_recipe.py`: pure pose-copy injection; control1.0 returns equal
  data; candidate adds exactly the two hand-scale inputs.
- `next/nx_hands_blender.py`: AST-loads unchanged d9_blender and gh_render
  after removing only their final verified main() calls. Candidate grip_hand
  temporarily uses a scaled rest grip offset; hand_rest is restored before
  measuring actual posed grip. Both arms require unit inherited scales, the
  rig identity transform and effective hand scale1.30. Control is untouched.
- `depth2` is an additional raw pass, B categorical limb IDs14/15. A facepass
  hook also writes `haft_grips.json`, separate from original PS landmarks.
- `next/hand_metrics.py`: mode/vote the categorical IDs within the selected
  raw material/part, intersect with skin, then record per-side boxes/area and
  the synthetic grip gaps. Never average IDs or attribute final RGB by label.
  Diagnostics write only to the lane's ignored next-trial tree.

The control and candidate use the exact canonical blend SHA256
`aef28c7f5cdddee6f18bd12c06d988b5436eeac24049ddf4f6ca37f654394373` and
preserved model SHA256
`1b30ca8eccc324cda999d90e3bae20f58e62970483ea3f9f877b8d61f73cebf3`.
Canonical model/state mapping/default-chain files are never changed or saved.
The existing owner and delivery rollback bundles remain prerequisites.

## Delivery execution

Use `art/rosace/next/hands130-request.json`, this lane's pushed source head,
and fresh output `review/rosace/art/next/hands130-delivery`.
Only delivery runs Blender, through `blender_env.py` plus its exclusive
resource gate and actual GPU lease. One synchronous Blender at a time.

1. Run `python tools/pixel-pipeline/next/check_hands.py` under the source gate.
2. Render instrumented control using `nx_hands_blender.py`, `--hand-scale1.0`
   (CLI token is `--hand-scale 1.0`), all four shots,144/80,head1.10,ss4 and
   `--r2` pointing to the unchanged source r2_model.json. Never --save-lane.
3. Verify its finish against the preserved raw R2 reference through
   `nx_post.py --root <control-raw> --reference <preserved-R2> --out <control-proof>`.
   All16 decoded transparent/contact-shadow images must differ by0px.
   Stop if that fails; instrument changes cannot become a new baseline.
4. Render candidate using the same wrapper/model/finish settings with explicit
   `--hand-scale 1.3 --shots idle`. The wrapper rejects any other candidate
   shot list and any head/neck/drape change. Finish with unchanged d9_post:
   `--root <candidate-raw> --shots idle --px 144,80 --finish <r2_finish> --tag R2`.
5. Run hand_metrics on fresh control/candidate idle raw directories. Grip gap
   must be≤1.5cm. A zero gap is the rig's synthetic grip center, not proof of
   finger wrap, thumb opposition or wrist skin continuity. Reach_m remains an
   unscaled-rest estimate and is not an acceptance measurement.
6. Compare baseline/candidate at the same framing/background,144 and80,x1/x3,
   plus enlarged hand crops. Preserve raw passes and logs. Inspect palm/finger
   group, opposed thumb, skin seam, sleeve clearance and collinear visible haft.
   Report raw hand boxes against7–9px at144 and minimum4×5/20skin pixels at80;
   score face/hands/body/outfit/weapon/pose/pixel craft separately. Small-scale
   readability and no guard regression are required. A source pass does not
   count as a visible win or reference parity.

Source checks at preparation passed immutable control/copy, sole hand-scale
input changes, rejection of invalid scales, grip-center formula at several
rotations, and Python syntax. Independent source review checked the uniform
math, hook restoration, coordinate/inherited-scale guards and idle scope. No
Blender execution or new hand pixels have occurred in the Rosace source chat.

Publish genuine pixels immediately as PREVIEW and return the exact receipt and
paths to this chat for blind critique. Do not change any canonical assets,
picker maps or defaults merely because rendering/import/checks succeeded.
