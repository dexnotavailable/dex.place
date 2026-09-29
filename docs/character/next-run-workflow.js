export const meta = {
  name: 'rosace-next-run',
  description: 'Break the 5.8 plateau with six structural levers judged one at a time (pose, hands, value key, bust form, lost constructed passes, attack faces): per-letter number gates, then a blind forced-choice A/B against a ratcheting control, then two whole-character rounds and a WF-P22 promotion',
  phases: [
    { title: 'Prep', detail: 'nx_blender wrapper + control reproduced to 0 px, stance diagnosis, metrics, post and sheet tools, settled.json' },
    { title: 'Levers', detail: 'pose (Blender), value key, ported passes and attack faces in parallel; then bust form; then hands' },
    { title: 'Stack', detail: 'merge kept levers into one ratchet build and re-check every gate' },
    { title: 'Whole', detail: 'two 5-lens blind rounds against the promoted round 2 and the refs' },
    { title: 'Promote', detail: 'only on a double blind win, procedural and 0 px reproducible' },
    { title: 'Report', detail: 'per-part scores, learning log, PIPELINE.md, questions for Dex' },
  ],
}

// DRAFT, written in the cloud from the pc-sync snapshot (docs/character/NEXT-RUN.md explains every lever and rule).
// Run on the PC only. args (optional): { dex: { gloves, whiteBar, freeHand, headPiece, settled, ownPoseFiles,
// promoteOnLeverWin, heelFloor, glaiveLean, legScale, fcP39Revert } } = Dex's answers to NEXT-RUN.md section 5;
// anything missing counts as "not decided".
// Like the PC's earlier scripts, the body ends with a top-level `return RESULT` (the harness runs the body as an async
// function). Syntax check: NEXT-RUN.md section 6 (a .mjs copy with the last line swapped for an export, plus a stubbed
// dry run that runs the body as an async function exactly as written).

const A = (typeof args === 'object' && args) ? args : {}
const DEX = A.dex || {}
const BUILD = 'D:\\Dex\\Projects\\dex-place-art\\rosace\\build'
const NEXT = `${BUILD}\\lanes\\next`
const REVIEW = 'review/rosace/art/next'

const CTX = `
Project: dex.place player character "Rosace". Repo D:\\Dex\\Projects\\dex.place (public; no commits or pushes). Read first: docs/character/NEXT-RUN.md (this run's plan: levers, per-letter gates, keep rule, loop, section 3.0 = the shared tools), docs/character/DESIGN.md (revision 3.5 at the top overrides older text), docs/character/ART-RULES.md (sections 1-4 and the Learning log, rows FPA, FPB, FR1, D9 to D9-P; open items O-32, O-33) + art-rules/*.md (finish-gap.md, pose.md, checklist.json), docs/character/PIPELINE.md (3.6l-3.6r: the drive-9 chain), CRITIQUE-PARAMS.md, art/rosace/drive9.json ('promoted').
State: whole-character critics score her about 5.8 (refs 8.4-8.9 on the same sheets). The canonical build is drive-9 round 2 (stills_v2.py default chain: d9_blender.py --r2 drive9/r2_model.json, then d9_post.py --finish drive9/r2_finish.json --tag R2). Weakest: hands 3.4-4.5 and grip 4-5 in every round; round 2 also lost weapon, grip and outfit to the integrated control because the drive-9 chain skips the integrated code-palette passes (glyphs, collar cross, outfit windows, rose disc, smear, hands).
THE SHARED TOOLS (written in Prep; NEXT-RUN.md 3.0): tools/pixel-pipeline/next/nx_blender.py loads drive9/d9_blender.py as a library (its source compiled without the trailing main(), as d9_blender loads f1_blender) and overrides PICK['shots'] and pose_file from art/rosace/next/next.json; it adds the depth2 pass (limb ids in B), writes gh_render's 'haft' and 'grips' block (tools/art-construct/gh_render.landmarks) as haft_grips.json in every render dir, and has hooks for new geometry (next/nx_geom.py) and a --blend lane build. Pose changes (new pose files, bone '.scale' entries) go through next.json's shots and pose patches, never through d9_blender's --r2 'mesh_edits' (vertex scales only). next/nx_post.py runs drive9/d9_post.process unchanged, recomputes the sprite labels with finish_f1 F1.downsample and the ring from alpha, runs the optional next steps, redraws still_ground with finish_judge/judge_sheets.f1_grounded and copies <raw>/<shot>/px<N>/<tag>/ into the lane's own folder (d9_post writes inside the raw tree). Finish overlays in art/rosace/next/ use base '../../../tools/pixel-pipeline/drive9/r2_finish.json' (load_finish resolves base next to the overlay); a faces overlay is r2_faces '../../../art/rosace/next/<file>.json' (resolved from drive9/).
Dex's answers to NEXT-RUN.md section 5 (null = not decided; never decide these yourself): ${JSON.stringify(DEX)}.
HARD RULES: no image generation of any kind (no AI image tools, no generative add-ons): everything is rendered from our own 3D model or authored as data and code. HoYoverse/Kuro official models are never used for parts. Third-party refs stay under D:\\Dex\\Projects\\dex.place\\review\\ (git-ignored) and are never copied elsewhere. Blender headless only through tools/pixel-pipeline/blender.ps1 (or blender_env.py run), absolute paths, at most one Blender process per agent, ss 4, 144 and 80 px only (this PC has had GPU driver crashes). Never write rosace.blend or any backup blend (only the Promote step may write rosace.blend). Never edit art/rosace/drive9.json, art/rosace/integrated.json, tools/pixel-pipeline/drive9/**, tools/art-construct/**, rosace_v2/figure_shape.py, rosace_v2/figure_pose.py, art/rosace/figure/shape.json or existing pose files: this run makes NEW files only, in tools/pixel-pipeline/next/**, art/rosace/next/**, new pose names art/rosace/poses/*_next*.json, lane builds and raw renders under ${NEXT}\\, sheets under ${REVIEW}/. No per-still paint layers (WF-P22: everything must carry to motion frames). The face is the promoted R2 face (drive9/r2_faces.json); FC-P39's D9-R5 text (2-row lash block, paint-over) is NOT this run's face rule (NEXT-RUN.md 3, "Not levers"). Append learnings to the ART-RULES Learning log and checks to checklist.json (read-modify-write right before saving); keep PIPELINE.md current for anything that changes how she is built (new section 3.6s). Talk plainly in summaries: answer first, numbers with a sentence saying what they mean.
`

// Critics get their own context: no plan, no lever list, no build notes, so they can't guess which letter changed what.
const CRITCTX = `
Project: dex.place player character "Rosace", a stained-glass priestess with a glaive, drawn as pixel art at 144 px (close-up) and 80 px (world). Repo D:\\Dex\\Projects\\dex.place. Read only: docs/character/DESIGN.md revision 3.5 (the block at the top: target 9/10 = parity with Dex's refs, seductive-elegant pose, wider stance, a prominent bust that is never 'spheres stuck on', 1 px black thong string) and docs/character/CRITIQUE-PARAMS.md (the numbered params). Do not read NEXT-RUN.md, drive9.json, next.json, the Learning log or any build notes: you judge the pictures alone. The refs are the finish bar and score 9. Be demanding and concrete: name pixels, sizes and places, not adjectives. No image generation of any kind.
`

const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, media: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files'] }
const PREP = { type: 'object', properties: { summary: { type: 'string' }, controlZeroPx: { type: 'boolean' }, changedPx: { type: 'string' }, stanceDiagnosis: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'controlZeroPx', 'stanceDiagnosis', 'files'] }
const VARIANT = { type: 'object', properties: { id: { type: 'string' }, parent: { type: 'string' }, what: { type: 'string' }, variables: { type: 'array', items: { type: 'string' } }, stills: { type: 'string' }, recipe: { type: 'string' }, metrics: { type: 'string' }, gateItems: { type: 'array', items: { type: 'string' } }, gatePass: { type: 'boolean' }, gateFails: { type: 'array', items: { type: 'string' } } }, required: ['id', 'parent', 'what', 'variables', 'stills', 'recipe', 'metrics', 'gateItems', 'gatePass'] }
const BUILDR = { type: 'object', properties: { summary: { type: 'string' }, variants: { type: 'array', items: VARIANT }, rejectedAsks: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'variants', 'files'] }
const SHEETS = { type: 'object', properties: { dir: { type: 'string' }, key: { type: 'array', items: { type: 'object', properties: { letter: { type: 'string' }, entry: { type: 'string' } }, required: ['letter', 'entry'] } }, variants: { type: 'array', items: { type: 'string' } }, sheets: { type: 'array', items: { type: 'string' } } }, required: ['dir', 'key', 'variants', 'sheets'] }
const PSCORE = { type: 'object', properties: { param: { type: 'integer' }, scores: { type: 'array', items: { type: 'object', properties: { letter: { type: 'string' }, score: { type: 'number' } }, required: ['letter', 'score'] } }, best: { type: 'string' }, gap: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'scores', 'best', 'gap', 'fix'] }
const PAIR = { type: 'object', properties: { params: { type: 'array', items: PSCORE }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['params', 'topFixes'] }
const WCRIT = { type: 'object', properties: { lensScores: { type: 'array', items: { type: 'object', properties: { letter: { type: 'string' }, score: { type: 'number' } }, required: ['letter', 'score'] } }, params: { type: 'array', items: PSCORE }, prefersLetter: { type: 'string' }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['lensScores', 'params', 'prefersLetter', 'topFixes'] }
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, reportMarkdown: { type: 'string' }, questionsForDex: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'reportMarkdown', 'questionsForDex', 'files'] }

// Value-key bound from Dex's white bar (question 2): with ref 04's bright white the white may keep its top, so only the
// other materials are held to the low-key refs' p90; otherwise the whole figure is.
const P90 = DEX.whiteBar === '04'
  ? 'p90 luma <= the control\'s on the whole figure, and <= 185 on every material except white and veil'
  : 'p90 luma <= 185 on the whole figure'
// Glaive lean (O-32 (3)): GR-P09 asks 15-35 deg leaning AWAY, but the figure-pose lane measured that a lean away is out
// of the arm's reach with this grip (FPA) and kept an A-frame leaning 14 deg IN. Until Dex rules, the reachable A-frame
// is gated (PS-P24), not GR-P09's direction.
const LEAN = DEX.glaiveLean === 'away'
  ? 'GR-P09 15-35 deg leaning away AND GR-P11 grip gap <= 1.5 cm (if both cannot hold, report it: do not fake the grip)'
  : 'glaive lean 12-20 deg in the kept A-frame (PS-P24 reach budget), GR-P11 grip gap <= 1.5 cm; GR-P09\'s direction waits on Dex (O-32 (3))'
const HEELS = DEX.heelFloor
  ? `heel gap per Dex's O-32 answer (${DEX.heelFloor})`
  : 'PS-P06 heels 35-43 px at 144 and 20-24 at 80, knee gap <= 0.6 x heel gap'
const LEG = DEX.legScale === false
  ? 'Dex ruled out the leg-scale cheat (O-33): remove J_Bip_*_UpperLeg.scale and report the heel gap the free leg can reach'
  : 'keep the existing J_Bip_L_UpperLeg.scale 1.10 (O-33, FR1) and never raise it'

// Shared guards: every letter of every lever passes these, on every shot at both sizes.
const SHARED = ['face skin median within 5 luma of the control', '0 off-palette or empty-material pixels (no pixel outside its material\'s finish tones, except the lever\'s own pass masks)', 'figure integrity: silhouette area within 3% of the control unless the lever owns the shape, no skin islands, bust keep-out 0 px, thong string present']

// CRITIQUE-PARAMS numbers: target = what the lever must win, guard = what it must not lose. 'letters' = the ladder
// (each letter adds one or two variables to its parent). 'gates' = the gate items per letter, on top of SHARED.
const LEVERS = {
  P: {
    id: 'P', name: 'pose: the idle/back gesture and a re-authored Q', blender: true, target: [9, 10, 11, 12], guard: [1, 3, 5],
    letters: 'P1 (parent control) = the idle/back gesture, one concept-level variable: stance, turn chain, tilts, free hand, glaive angle and head tilt as ONE gesture. P2 (parent control) = the Q gesture, one concept-level variable: the Q pose from scratch. P3 (parent P1) = P1 + P2, only if both pass their gates. Attack FACES are not part of this lever (lever E).',
    brief: `Step 0 (before any variant): read Prep's stance diagnosis (${NEXT}\\control_stance.md: R2's own landmarks.json checks PS-P04, P06, P07 and heel_gap_px against FR1's check_idle_appeal.json) and say what R2's +30% patch (hip rotation 6.5/19.5/5.2, the free-knee pole moved out-forward, head tilt 16) or its camera did to the stance FR1 passed (heels 39 px, knee/heel 0.43, turn chain 53/50/20). Then new pose files only: art/rosace/poses/idle_next.json, back_next.json, q_next.json, written through next.json's shots map and applied by nx_blender (figure_pose.apply_pose read-only; figure_pose's check mode for the numbers). Idle and back: the DESIGN 3.5 stance within what FPA/FPB/FR1 measured is reachable (${LEG}); the turn chain inside PS-P04 (pelvis 35-60 deg, chest 30-50, head 10-30 from the camera, each less than the one below; FR1's 53/50/20 passed); opposed shoulder and hip tilts; head tilt 5-10 deg chin down (R2 has 16); the free hand ${DEX.freeHand ? 'at: ' + DEX.freeHand : 'on the hip'} with the back of the hand to camera and the elbow out; the glaive: ${LEAN}. Q from scratch (q_stamp.json was only ever patched): WF-P03 thumbnails first (4-6, keep two, the thumbnail score includes GR-P05 and GR-P09 as C1 learned), one C or S line of action, legs behind the torso line, the haft never through the pelvis (GR-N05), nothing on the DESIGN 3.5 never-list. Do not re-explore concepts A/B/C or the 30 stance variants the figure-pose lane already ran; read their rows first.`,
    gates: {
      P1: ['PS-N21: 0 IK misses (hand and foot)', HEELS, 'PS-P07 weight leg <= 5 deg, ankle under the pit of the neck +-2 px at 144 (+-1 at 80)', 'PS-P04 turn chain: pelvis 35-60, chest 30-50, head 10-30 deg from the camera, each less than the one below', 'shoulder and hip tilts opposed', 'head tilt 5-10 deg', LEAN, 'body bbox fill >= 0.45', 'arm-body window >= 150 px2 at 144, measured as a bay (PS-P17 per FPA)', 'bust break >= 4 px at 144 and >= 2 at 80', 'PS-P01 at 80 is exempt (known O-32)'],
      P2: ['PS-N21: 0 IK misses', 'Q: 0 pelvis-haft crossings (GR-N05)', 'every WF-P05 keep-out zone empty', 'GR-P11 grip gaps <= 1.5 cm from haft_grips.json', 'idle, N1 and back stills 0 px changed against the control'],
      P3: ['every P1 and P2 item on its own shots'],
    },
  },
  E: {
    id: 'E', name: 'the attack faces (Q and N1): eyes on one line, a closed mouth', blender: false, target: [2, 3], guard: [1, 4, 9],
    letters: 'E1 (parent control) = one variable: the Q and N1 expression entries of a faces overlay.',
    brief: `A faces overlay art/rosace/next/faces_next.json = a copy of tools/pixel-pipeline/drive9/r2_faces.json in which ONLY the Q and N1 (q_stamp, n1_contact) expression entries change: both eyes on one tilt line, drawn stair-stepped in screen space on the tilted Q head (never a rotated upright stamp), and a closed mouth (a 2-3 px set line or smirk). The idle and back face is the promoted R2 face and must not change. Wire it with a finish overlay art/rosace/next/e_finish.json {base: '../../../tools/pixel-pipeline/drive9/r2_finish.json', r2_faces: '../../../art/rosace/next/faces_next.json'} and run nx_post.py on the Prep control's raw passes (${NEXT}\\control\\raw) with a new tag; no Blender.`,
    gates: {
      E1: ['faces_next.json differs from r2_faces.json only inside the q_stamp and n1_contact entries', 'idle and back stills 0 px changed against the control', 'Q and N1 at 144: the two eye centres within 1 px of one tilt line; at 80 within 1 px', 'no open-mouth hole (no interior dark pixel enclosed by the mouth)'],
    },
  },
  K: {
    id: 'K', name: 'low-key, calm-chroma value structure at the ramp stops', blender: false, target: [14, 15, 1, 30], guard: [2, 3, 16],
    letters: 'K1 (parent control) = the key: the stops lowered, same hues. K2 (parent K1) = + the chroma budget. K3 (parent K1) = + the lit-side ring re-tone.',
    brief: `A finish overlay art/rosace/next/k_finish.json with base '../../../tools/pixel-pipeline/drive9/r2_finish.json' (d9_post.load_finish resolves base next to the overlay) that replaces the 'stops' of white, veil, stocking, boot, lining, haft, hair, indigo and gold. Do NOT use gammas: D9-R5 proved the per-material requant spreads the tones back out. K1: big areas darker (stockings, boots, lining, haft into L* 10-36 over 3-4 tones; white's top under paper white${DEX.whiteBar ? '; Dex set the white value bar to: ' + DEX.whiteBar : ''}), same hues. K2 = K1 + the chroma budget (the big areas' S <= 0.30, the white's shadows grey-lavender S <= 0.12, hair and indigo S <= 0.40, gold's dark step desaturated; eyes, gem, azure tips and a thin gold line keep their chroma). K3 = K1 + a ring re-tone: d9_post.lines() already gives the lit-side ring of light and accent materials their stops[0] (near-black for white, gold and skin-adjacent ramps), which is why the ring measures dark; K3 re-tones that lit-side ring on light materials to a mid-dark ramp tone (t 0.19-0.26 of the material's ramp, OKLab L >= ~0.30) as a new numpy step in tools/pixel-pipeline/next/nx_post.py, never in d9_post.py. Run on the Prep control's raw passes (${NEXT}\\control\\raw) through nx_post.py with a new tag per letter (no Blender).`,
    gates: {
      K1: [P90, 'L* 20-35 share >= 20% (now 10-16%)', 'skin median L* at least 6 below the lit white', 'the face, gem and rim hold the top 3% of luma'],
      K2: ['every K1 item', 'median HSV S <= 0.35', 'chromatic share <= 70%', 'accent share <= 5%', 'gold high-chroma share (gold hue, S > 0.6) at most half the control\'s'],
      K3: ['every K1 item', 'ring px near-black (rel L < 0.06, finish-gap.md\'s measure) <= 75%', '0 changed px off the ring'],
    },
  },
  A: {
    id: 'A', name: 'the lost constructed passes, ported by a code-to-tone adapter', blender: false, target: [7, 8, 13], guard: [1, 14, 16],
    letters: 'A1 (parent control) = one variable: the ported passes (glyphs, outfit_px windows and glyphs, the outfit_px2 steps integrated.json enables, the rose-disc stamp, glints and N1 smear). The blade re-tone is NOT in A1 (blade {on: false}); if tried, it is A2 (parent A1).',
    brief: `tools/pixel-pipeline/next/tone_adapter.py, called from tools/pixel-pipeline/next/nx_post.py after drive9/d9_post.process (imported; never edited). It builds the integrated passes' input contract in a work dir per still: base.png (the code image: each finish pixel mapped to its nearest integrated palette code inside its own material, art/rosace/palette.json), noface_id.png at sprite resolution (R = material, G = part, from finish_f1 F1.downsample's mat and part labels), meta.json, and landmarks.json = the figure_pose landmarks merged with haft_grips.json (gh_render's 'haft' and 'grips' blocks, written by nx_blender during Prep's control render). Then it runs the integrated passes as libraries: glyphs.apply (the collar cross), outfit_px windows and glyphs, the outfit_px2 steps integrated.json enables, and author_hands.apply with NEW specs art/rosace/next/hands/<pose>_<px>.json for idle_appeal, n1_contact, q_stamp and back_appeal (hands: [], blade {on: false}, rose, glints and smear per pose; never art/rosace/hands/poses/). Back: only the CHANGED pixels map to the finish's own tones for their material, by value rank, and only after hands.json reports off_palette false. No Blender (Prep rendered the control's haft and grips).`,
    gates: {
      A1: ['the full image forward then back with no pass run changes 0 px', '0 changed px outside each pass mask', 'hands.json off_palette false on every still', 'the collar cross present at its stamp size, 7x7 at 144 and 5 wide x 6 tall at 80, on the idle', 'the rose stamp drawn wherever haft.disc_facing >= 0.85, skipped below', 'N1 smear >= 150 px at 144 and >= 45 at 80'],
      A2: ['every A1 item', 'the blade pass changes only weapon-material pixels'],
    },
  },
  F: {
    id: 'F', name: 'the bust as one form that belongs to the bodice', blender: true, target: [5, 12, 13], guard: [3, 10, 14],
    letters: 'F1 (parent control) = the bust shape (teardrop variant), one variable. F2 (parent F1) = + the bodice strips and the chest value break (two variables).',
    brief: `Step 0 (before any variant): tools/pixel-pipeline/next/bl_build_f.py, a wrapper in the style of drive9/bl_build.py that monkeypatches rosace_v2/figure_shape.variant_params (and its field, for the teardrop term) and runs build_rosace_v2.py unchanged with --out ${NEXT}\\f_<variant>.blend (figure_shape.apply refuses a body that already has the figure_bust key, and rosace.blend has S7 applied, so the bust changes by a rebuild, never by re-applying). Prove it first: an unchanged rebuild (${NEXT}\\f_S7.blend) rendered through nx_blender --blend matches the control at 0 px on all 16 images; if it does not, stop and report. (1) The teardrop term in tools/pixel-pipeline/next/bust_teardrop.py (apex drop 2-3 px at 144, lower-pole fullness, 10-15% narrower at S7's volume); variants in art/rosace/next/shape_next.json (never shape.json${DEX.ownPoseFiles ? '' : '; Dex has not approved taking over the figure-pose files'}). (2) Bodice strips as a geometry module tools/pixel-pipeline/next/nx_geom.py (called from nx_blender's geometry hook, like r2_blender.circlet): a gold centre seam or cross panel, two tension darts from the collar toward each apex and a neckline V, each >= 15 mm wide (a strip under ~13 mm, 1 px at 144, vanishes in the weighted downsample), weighted to the chest and bust bones and carrying the figure_bust shape key so they follow the bust; or re-tag the existing bodice faces with their own material. (3) The chest value break: the collar and hair mantle take their own tone step so the lit near chest stops joining the shoulder into the 'forearm' band (PS-N24).`,
    gates: {
      F1: ['bust break >= 4 px at 144 and >= 2 at 80', 'near-black interior line px <= 50% of each breast perimeter, per breast from the depth2 limb ids (bust_L, bust_R)', 'one highlight cluster <= 6 px per breast', 'underbust shadow over >= 70% of the apex span', 'every other material 0 px changed outside the bust and bodice region'],
      F2: ['every F1 item', 'lit bust mass dL* >= 8 from the lit sleeve', 'upper-chest skin band <= 40% of the chest width at its row', 'each strip >= 1 px wide and continuous at 144 wherever it faces the camera'],
    },
  },
  H: {
    id: 'H', name: 'hands built bigger in 3D and staged to be seen, lines only on top', blender: true, target: [6, 8, 7], guard: [1, 10, 12],
    letters: 'H1 (parent control) = hand scale only. H2 (parent H1) = + staging. H3 (parent H2) = + hand_pass.',
    brief: `(1) Hand scale as pose-bone scale in the pose patch ('J_Bip_L_Hand.scale' / 'J_Bip_R_Hand.scale' x1.2-1.3, as n1_contact.json already does with 1.2), never a mesh edit: the hand is part of the body mesh. figure_pose applies scales after the grip solve, so a 1.3x hand moves the grip point about 1.5 cm off its socket: compensate with the grip 'slide' and read grips.gap_cm from haft_grips.json. Target a 7-9 px fist at 144. (2) Staging as a pose patch on the current control's pose: the glaive hand at chest-to-shoulder height with the wrist >= 3 px clear of the bell's mouth (push the bell up the forearm or shorten the cuff), fingers curled 70-85 around the haft with the thumb over it; the hip hand staged off the hip skin. (3) tools/pixel-pipeline/next/hand_pass.py (called from next/nx_post.py, in the finish's own skin ramp tones, from haft_grips.json and the meta anchors hand_L, hand_R, hand_*_tip, and the depth2 limb ids hand_L / hand_R): only the knuckle line (HD-P02), the thumb wedge, a 1 px contact line where hand skin meets body skin (HD-P08) and the haft repainted collinear through each fist (GR-P05); it never paints the hand's mass.`,
    gates: {
      H1: ['GR-P11: every grips.gap_cm <= 1.5', 'fist bbox 7-9 x 7-9 px at 144 and >= 4 x 5 at 80 with >= 20 hand px (HD-P08), from the depth2 hand ids', 'no floating glaive (GR-N01)'],
      H2: ['every H1 item', 'haft visible >= 2 px on both sides of each fist', 'N1 grip spread 24-30 px with the rear fist at the hip (GR-P01, GR-P04)', 'hip-hand window >= 150 px2', 'glaive-hand wrist >= 3 px clear of the bell'],
      H3: ['every H2 item', 'hand-body contact line continuous (100% of the contact edge)', '0 changed px outside the hand_pass mask'],
    },
    escalate: DEX.gloves === true ? 'ESCALATION (Dex approved): gloves or gauntlets as a new garment in nx_geom.py (white with gold cuffs, or indigo to match the thigh-highs), so the hand reads as its own value shape against the hip and the sleeve. Letter H4 (parent the best passing H letter).' : null,
  },
}

const CRITICS = [
  'a player of 3D gacha games (Wuthering Waves, Genshin, Star Rail, ZZZ) deciding whether this character is worth pulling for',
  'a professional pixel artist who ships 140-160 px character sprites',
  'a character designer who judges pose, anatomy and costume construction',
]

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
function scoreFor(p, letter) { const s = (p.scores || []).find(x => x.letter === letter); return s ? s.score : null }
function letterMap(sh) { const m = {}; (sh.key || []).forEach(k => { m[k.entry] = k.letter }); return m }
function gateText(L) { return Object.entries(L.gates).map(([k, v]) => `${k}: ${v.join('; ')}`).join(' | ') }

// Mean target delta of one entry over another, across all critics (null if either is missing).
function targetDelta(verdicts, L, a, b) {
  const d = []
  for (const c of verdicts) for (const p of c.params) {
    if (!L.target.includes(p.param)) continue
    const sa = scoreFor(p, a), sb = scoreFor(p, b)
    if (sa !== null && sb !== null) d.push(sa - sb)
  }
  return d.length ? +mean(d).toFixed(2) : null
}

// The keep rule (NEXT-RUN.md 4.4): >= 2 of 3 critics pick the variant over the control on most target params, mean
// target delta >= +0.3 (three times the measured +-0.1 panel noise), and no guard param down by more than 0.3.
// Each variant's delta over its parent letter is also reported, so the ladder shows what each variable added.
function decide(sh, verdicts, L, parents) {
  const m = letterMap(sh)
  const cl = m.control
  const out = []
  for (const vid of sh.variants) {
    const vl = m[vid]
    if (!vl || !cl) continue
    const dT = [], dG = {}
    let pref = 0
    for (const c of verdicts) {
      let wins = 0, n = 0
      for (const p of c.params) {
        const sv = scoreFor(p, vl), s0 = scoreFor(p, cl)
        if (sv === null || s0 === null) continue
        if (L.target.includes(p.param)) { dT.push(sv - s0); n++; if (p.best === vl) wins++ }
        if (L.guard.includes(p.param)) { (dG[p.param] = dG[p.param] || []).push(sv - s0) }
      }
      if (n && wins * 2 > n) pref++
    }
    const dTarget = mean(dT)
    const worstGuard = Math.min(0, ...Object.values(dG).map(mean))
    const par = parents[vid]
    const vsParent = par && par !== 'control' && m[par] ? targetDelta(verdicts, L, vl, m[par]) : null
    out.push({ id: vid, parent: par || 'control', vsParent, dTarget: +dTarget.toFixed(2), worstGuard: +worstGuard.toFixed(2), pref, keep: pref >= 2 && dTarget >= 0.3 && worstGuard >= -0.3 })
  }
  return out
}

function controlText(c) {
  return `CONTROL "${c.name}": stills ${c.stills}; raw passes ${c.raw || 'see its recipe'}; reproduce with: ${c.recipe}`
}

async function runLever(L, control) {
  let fixes = null, misses = 0, escUsed = false
  const hist = []
  for (let it = 1; it <= 4; it++) {
    let esc = ''
    if (misses >= 2) {
      if (L.escalate && !escUsed) { esc = L.escalate; escUsed = true } else break
    } else if (it === 4) break
    const b = await agent(`${CTX}
Task: LEVER ${L.id}, "${L.name}", iteration ${it}. ${controlText(control)}
Brief: ${L.brief}
Letters (a ladder: each letter adds one or two variables to its parent, both inside this lever): ${L.letters}
${esc}
Build the letters (drop one only if its parent failed). Variables are counted at the concept level the letters name; list them per letter. Render idle, N1, Q and back at 144 and 80 (${L.blender ? 'through tools/pixel-pipeline/next/nx_blender.py, one Blender process at a time, through blender.ps1' : 'no Blender: the control\'s raw passes plus nx_post.py'}) into ${NEXT}\\${L.id}\\it${it}\\<letter> (raw passes under <letter>\\raw, finished stills copied out of the raw tree by nx_post.py). Then measure every letter with tools/pixel-pipeline/next/nx_metrics.py against ITS OWN gate items plus the shared guards, never another letter's: ${gateText(L)} | shared (every letter): ${SHARED.join('; ')}. gateItems = the items you applied; gatePass = every one of them passes on every shot at both sizes; list the fails. Fix and re-measure before you report; drop a letter you cannot fix. Look at each letter beside its parent and the control at 144 x3 and 80 x3 yourself.
${fixes ? 'Critic fixes from the last iteration. First strike every ask that conflicts with art/rosace/next/settled.json or with a failed row in the ART-RULES Learning log (list those in rejectedAsks, "for Dex"), then apply the rest inside this lever only: ' + JSON.stringify(fixes).slice(0, 6000) : ''}
recipe = the exact commands that rebuild a letter's stills from scratch. Log what you tried and learned (row prefix NX-${L.id}).`, { label: `${L.id}:build:${it}`, phase: 'Levers', schema: BUILDR, effort: 'high' })
    if (!b) break
    const ok = b.variants.filter(v => v.gatePass)
    if (!ok.length) {
      misses++
      hist.push({ it, gate: 'no letter passed', fails: b.variants.map(v => v.id + ': ' + (v.gateFails || []).join('; ')) })
      log(`lever ${L.id} it${it}: no letter passed its own gate`)
      fixes = b.variants.flatMap(v => v.gateFails || [])
      continue
    }
    const parents = {}
    ok.forEach(v => { parents[v.id] = ok.some(x => x.id === v.parent) ? v.parent : 'control' })
    const sh = await agent(`${CTX}
Task: build ONE blind pair set for lever ${L.id}, iteration ${it}, with tools/pixel-pipeline/next/nx_pair.py, in ${REVIEW}/lever-${L.id}/it${it}/. Entries: "control" = ${control.stills}; ${ok.map(v => '"' + v.id + '" = ' + v.stills).join('; ')}; plus two pose-matched refs (the closest of 07/08/09, and 04) at their native grid, and ref 05 on the 80 sheets (WF-P18). Sheets: every shot (idle, n1, q, back) at 144 x3 and x1 and at 80 x3 and x1, ours on its contact shadow (WF-P16), letters only on panels, one mapping on every sheet (WF-P13), the shuffle moving every entry off its listed place and keeping the control and the variants apart (WF-P15). Also one codec-diagnostic sheet (never counts). Return the letter mapping in 'key' (entries: control, the variant ids, and ref ids) and variants = [${ok.map(v => '"' + v.id + '"').join(', ')}].`, { label: `${L.id}:sheets:${it}`, phase: 'Levers', schema: SHEETS, effort: 'medium' })
    if (!sh) break
    const vs = (await parallel(CRITICS.map((who, i) => () => agent(`${CRITCTX}
Independent, demanding critic: judge as ${who}. You are BLIND: never open key.json or anything that names the letters.
Open every sheet in ${sh.dir} (Read the PNGs: ${sh.sheets.slice(0, 20).join(', ')}). For each CRITIQUE-PARAMS number in [${L.target.concat(L.guard).join(', ')}], score EVERY non-ref letter /10 (the refs are the bar at 9) and name the best non-ref letter (or "cant-tell"), with the concrete gap and one fix. Then top fixes. Judge at 1x and at 80 px as much as at x3.`, { label: `${L.id}:critic${i + 1}:${it}`, phase: 'Levers', schema: PAIR, effort: 'high' })))).filter(Boolean)
    const d = decide(sh, vs, L, parents)
    hist.push({ it, critics: vs.length, decisions: d })
    log(`lever ${L.id} it${it}: ${d.map(x => x.id + ' dT ' + x.dTarget + (x.vsParent !== null ? ' (vs ' + x.parent + ' ' + x.vsParent + ')' : '') + ' guard ' + x.worstGuard + ' pref ' + x.pref + '/' + vs.length + (x.keep ? ' KEEP' : '')).join(' | ')}`)
    const kept = d.filter(x => x.keep).sort((a, b) => b.dTarget - a.dTarget)[0]
    if (kept) {
      const v = b.variants.find(x => x.id === kept.id)
      return { lever: L.id, kept: { name: `${L.id}:${v.id}`, stills: v.stills, raw: v.stills + '\\raw', recipe: v.recipe, what: v.what, metrics: v.metrics }, decision: kept, hist, sheets: sh.dir }
    }
    misses++
    fixes = vs.flatMap(c => c.topFixes)
  }
  log(`lever ${L.id}: not kept (${hist.length} iterations)`)
  return { lever: L.id, kept: null, hist }
}

phase('Prep')
const R2 = { name: 'R2 (promoted drive-9 round 2)', stills: `${NEXT}\\control\\stills`, raw: `${NEXT}\\control\\raw`, recipe: `blender.ps1 --python tools/pixel-pipeline/next/nx_blender.py -- --blend ${BUILD}\\rosace.blend --next art/rosace/next/next.json --entry promoted --out ${NEXT}\\control\\raw; python tools/pixel-pipeline/next/nx_post.py --root ${NEXT}\\control\\raw --finish tools/pixel-pipeline/drive9/r2_finish.json --tag R2 --copy ${NEXT}\\control\\stills` }
const prep = await agent(`${CTX}
Task: PREP for the next run (NEXT-RUN.md 3.0). One Blender process at a time.
(1) Write art/rosace/next/next.json: 'promoted' = a copy of drive9.json's promoted shots, head, model and finish, plus the pose-file list per shot as d9_blender's PICK['shots'] has it; 'control' = the same; levers = {}.
(2) Write tools/pixel-pipeline/next/nx_blender.py: load drive9/d9_blender.py as a library the way d9_blender loads f1_blender (compile the source without the trailing main() into a module), then before calling its main(): set the module's PICK['shots'] from the next.json entry, replace its pose_file with one that looks in art/rosace/poses/ for the entry's names (new *_next names included) and applies the entry's pose patches (deep-merged; a null value deletes a key), add 'depth2' to its PASSES (limb ids in B, rosace/materials.py), wrap the facepass hook so every render dir also gets haft_grips.json from tools/art-construct/gh_render.landmarks (compiled without its trailing main(); its 'haft' block: butt, tip, disc, disc_facing, blade_base, sockets; its 'grips' block with gap_cm), and add a geometry hook that runs next/nx_geom.py modules named in the entry after r2_blender's edits. Never edit drive9/**.
(3) Prove it: render the control with ${R2.recipe}. It must match ${BUILD}\\renders\\drive9 at 0 changed px on all 16 images (4 shots x 144/80 x still/still_ground). Report controlZeroPx and the changed-pixel counts.
(4) Write tools/pixel-pipeline/next/nx_post.py: run drive9/d9_post.process unchanged (same preset and flags as stills_v2's drive9 chain), then recompute alpha, mat and part with finish_f1 F1.downsample (deterministic; process() returns only its report), the ring from alpha, and run the optional next steps switched on by a 'next' block in the finish json (tone_adapter, ring re-tone, hand_pass, in that order), then redraw still_ground with finish_judge/judge_sheets.f1_grounded and copy <raw>/<shot>/px<N>/<tag>/ to --copy. With no 'next' block the output must equal d9_post's at 0 px (check on the control).
(5) Stance diagnosis: read the control's landmarks.json checks (PS-P04, PS-P06, PS-P07, heel_gap_px, the knee gap) for idle and back at 144 and 80, set them beside FR1's check_idle_appeal.json (heels 39 px, knee/heel 0.43, turn chain 53/50/20), and write ${NEXT}\\control_stance.md: what R2's pose patch (drive9/r2_model.json 'poses': hip rotation 6.5/19.5/5.2, the leg.L pole, look tilt 16) or its camera changed. Return it as stanceDiagnosis.
(6) Write tools/pixel-pipeline/next/nx_metrics.py: figure-only measures for every gate item in NEXT-RUN.md section 3 and the shared guards (value, chroma, accent, gold high-chroma share, L* bands, ring near-black as rel L < 0.06 per finish-gap.md, skin-vs-white, face-luma share, per-limb boxes and bust measures from the depth2 B channel downsampled to sprite size by majority vote, haft sides and grip gaps from haft_grips.json, bbox fill, windows as bays, the figure_pose check numbers, eye-line and mouth checks, changed-px masks); run it on the control and save ${NEXT}\\control_metrics.json.
(7) Write tools/pixel-pipeline/next/nx_pair.py (lever pair sets) and nx_round.py (whole rounds, 5 lenses, prev slot), importing drive9/d9_round.py and d9_view.py read-only.
(8) Write art/rosace/next/settled.json: head 1.10; the face = the promoted R2 face (drive9/r2_faces.json), with FC-P39's D9-R5 text (2-row lash block, a WF-P20 paint-over) marked 'not this run's rule, revert is Dex's call'; the DESIGN 3.5 item 3 stance within O-32's measured reach; no paint-over (WF-P20 retired for this run); no colour cap; 'thousands of colours' is the refs' codec; plus each non-null answer in Dex's list above, each with its evidence row.
Add PIPELINE.md section 3.6s (in progress) with the commands.`, { label: 'prep', phase: 'Prep', schema: PREP, effort: 'high' })
const prepOk = !!(prep && prep.controlZeroPx)
if (!prepOk) log(`prep: the control did not reproduce at 0 px (${prep ? prep.changedPx || 'no counts' : 'prep failed'}); stopping for Dex before any lever`)

const done = {}
let fails = 0
let control = R2
if (prepOk) {
  phase('Levers')
  // Group 1: the pose lever (the only Blender job) and three finish-only levers on the control's raw passes.
  const G1 = ['P', 'K', 'A', 'E']
  const g1 = await parallel(G1.map(k => () => runLever(LEVERS[k], R2)))
  g1.filter(Boolean).forEach(r => { done[r.lever] = r })
  // E is a small face-only lever: its miss is logged but does not count toward the stop rule.
  fails = ['P', 'K', 'A'].filter(k => !(done[k] && done[k].kept)).length
  log(`group 1: ${G1.map(k => k + (done[k] && done[k].kept ? ' kept ' + done[k].kept.name : ' not kept')).join(', ')}`)

  const kept1 = G1.filter(k => done[k] && done[k].kept).map(k => done[k].kept)
  if (kept1.length) {
    phase('Stack')
    const st = await agent(`${CTX}
Task: STACK the kept levers into one ratchet control (no judging: the levers already won blind). Kept: ${JSON.stringify(kept1).slice(0, 5000)}. The pose lever's render (if kept) is the base (its raw passes); otherwise the control's raw passes. Merge the kept finish overlays (K's k_finish.json, E's e_finish.json) into one art/rosace/next/ratchet1_finish.json with the same relative bases, and switch on the kept nx_post steps (A's tone_adapter, K3's ring re-tone). Write art/rosace/next/next.json 'ratchet1' (the pose entry, finish json, next steps, and every file's sha1). Render or finish the four shots at 144 and 80 into ${NEXT}\\ratchet1 (raw under raw\\, stills under stills\\), re-run every kept letter's own gate with nx_metrics.py, and show by eye (144 x3, 80 x3) that nothing clashed. If a gate now fails because two levers interact, fix inside the lever that owns the number and say so. Return the stills path and the recipe in the summary's first two lines as "stills: <path>" and "recipe: <commands>".`, { label: 'stack:1', phase: 'Stack', schema: DOC, effort: 'high' })
    if (st) control = { name: 'ratchet1 (' + kept1.map(k => k.name).join(' + ') + ')', stills: `${NEXT}\\ratchet1\\stills`, raw: `${NEXT}\\ratchet1\\raw`, recipe: 'art/rosace/next/next.json ratchet1; ' + st.summary.slice(0, 600) }
  }

  phase('Levers')
  if (fails < 2) {
    const rF = await runLever(LEVERS.F, control)
    if (rF) done.F = rF
    if (rF && rF.kept) control = rF.kept
    else fails++
  }
  if (fails < 2) {
    const rH = await runLever(LEVERS.H, control)
    if (rH) done.H = rH
    if (rH && rH.kept) control = rH.kept
    else fails++
  }
}
const stopForDex = !prepOk || fails >= 2
if (prepOk && fails >= 2) log(`${fails} levers failed the keep rule: stopping for Dex before the whole rounds (NEXT-RUN.md 4.10)`)

// Whole-character rounds: the stacked build (ours) against the promoted R2 (control) and the refs, all 5 lenses.
const LENSES = [
  { k: 'face', l: 'FACE, GENUINE ATTRACTIVENESS, HEAD AND HAIR (CRITIQUE-PARAMS 2-4)', p: [2, 3, 4] },
  { k: 'body', l: 'BODY, ARMS AND HANDS, POSTURE, POSING, STYLISATION, SEX APPEAL IN THEME (5, 6, 9-12), against DESIGN rev 3.5', p: [5, 6, 9, 10, 11, 12] },
  { k: 'gear', l: 'WEAPON, GRIP AND OUTFIT (7, 8, 13)', p: [7, 8, 13] },
  { k: 'craft', l: 'MATERIALS, PALETTE AND VALUE, PIXEL CRAFT, RIM (14-17)', p: [14, 15, 16, 17] },
  { k: 'overall', l: 'FIRST IMPRESSION, ORIGINALITY, 80 PX READABILITY, THE DONATION TEST (1, 18, 30, 31)', p: [1, 18, 30, 31] },
]
const whole = []
let ours = control
let cand1 = null
if (!stopForDex && control !== R2) {
  phase('Stack')
  const fin = await agent(`${CTX}
Task: FINAL STACK. The current ratchet is ${controlText(control)}. Levers: ${JSON.stringify(Object.values(done).map(r => ({ lever: r.lever, kept: r.kept && r.kept.name, decision: r.decision })))}. Make art/rosace/next/next.json 'candidate' the one recipe that rebuilds it from rosace.blend (read-only; or the kept F lane blend built by bl_build_f.py from sources) plus this run's new files, rebuild it from scratch into ${NEXT}\\candidate (raw\\, stills\\) and prove 0 changed px against the ratchet's stills. Re-run every kept letter's gate.`, { label: 'stack:final', phase: 'Stack', schema: DOC, effort: 'high' })
  if (fin) ours = { name: 'candidate', stills: `${NEXT}\\candidate\\stills`, recipe: 'art/rosace/next/next.json candidate' }
  cand1 = ours

  phase('Whole')
  let wfix = null
  for (let round = 1; round <= 2; round++) {
    const prevNote = round === 2 ? `a "prev" slot = round 1's candidate stills (${ours.stills}); ` : ''
    if (round === 2) {
      const fx = await agent(`${CTX}
Task: WHOLE ROUND 2 FIXES. Round 1 per-param losses to the control and critic fixes: ${JSON.stringify(wfix).slice(0, 7000)}. Strike every ask that conflicts with art/rosace/next/settled.json or a failed Learning-log row (list them for Dex). Fix only params where ours lost to the control, ONE variable per fix, inside the lever that owns it; re-run that letter's own gate. Write the result as art/rosace/next/next.json 'candidate2' and its stills to ${NEXT}\\candidate2\\stills. Return "stills: <path>" as the summary's first line.`, { label: 'whole:fix:r2', phase: 'Whole', schema: DOC, effort: 'high' })
      if (!fx) break
      ours = { name: 'candidate2', stills: `${NEXT}\\candidate2\\stills`, recipe: 'art/rosace/next/next.json candidate2', prev: ours.stills }
    }
    const sh = await agent(`${CTX}
Task: build whole-character blind round ${round} with tools/pixel-pipeline/next/nx_round.py in ${REVIEW}/whole-${round}/. Entries: "ours" = ${ours.stills}; "control" = ${R2.stills}; ${prevNote}refs 07, 08, 09, 04 at native grid on the 144 sheets, resampled to world scale on the 80 sheets with ref 05 native (WF-P15, WF-P18). Idle, N1, Q and back at 144 x3/x1 and 80 x3/x1, contact shadows (WF-P16), one mapping, an honest shuffle, a codec-diagnostic sheet. Return the letter mapping (entries: ours, control${round === 2 ? ', prev' : ''}, ref ids) and variants = ["ours"${round === 2 ? ', "prev"' : ''}].`, { label: `whole:sheets:r${round}`, phase: 'Whole', schema: SHEETS, effort: 'medium' })
    if (!sh) break
    const vs = await parallel(LENSES.map(c => () => agent(`${CRITCTX}
Independent, demanding critic. Lens: ${c.l}. You are BLIND: never open key.json. Open every sheet in ${sh.dir} (Read the PNGs). Score every letter, refs included, /10 on the lens (the refs' bar is 9) in lensScores; per CRITIQUE-PARAMS number in [${c.p.join(', ')}] score every letter and name the best non-ref letter or "cant-tell", with the gap and one fix; say which non-ref letter you prefer; top fixes.`, { label: `whole:${c.k}:r${round}`, phase: 'Whole', schema: WCRIT, effort: 'high' })))
    const m = letterMap(sh)
    const rows = LENSES.map((c, i) => {
      const v = vs[i]
      if (!v) return null
      const s = l => { const x = v.lensScores.find(y => y.letter === l); return x ? x.score : null }
      return { lens: c.k, ours: s(m.ours), control: s(m.control), prev: m.prev ? s(m.prev) : null, prefersOurs: v.prefersLetter === m.ours }
    }).filter(Boolean)
    const oursMean = mean(rows.map(r => r.ours).filter(x => x !== null))
    const ctlMean = mean(rows.map(r => r.control).filter(x => x !== null))
    const lensLoss = rows.filter(r => r.ours !== null && r.control !== null && r.ours < r.control).map(r => r.lens)
    const prevRows = rows.filter(r => r.prev !== null && r.control !== null)
    const prevMean = prevRows.length ? +mean(prevRows.map(r => r.prev)).toFixed(2) : null
    const prevLensLoss = prevRows.filter(r => r.prev < r.control).map(r => r.lens)
    whole.push({ round, rows, oursMean: +oursMean.toFixed(2), controlMean: +ctlMean.toFixed(2), prevMean, lensLoss, prevLensLoss, dir: sh.dir })
    log(`whole r${round}: ours ${oursMean.toFixed(2)} vs control ${ctlMean.toFixed(2)}; ${rows.map(r => r.lens + ' ' + r.ours + '/' + r.control).join(', ')}${lensLoss.length ? '; lost on ' + lensLoss.join(', ') : ''}`)
    if (round === 1 && oursMean < ctlMean + 0.3) { log('whole r1: the stacked build did not beat R2 by 0.3; stopping for Dex (NEXT-RUN.md 4.10)'); break }
    wfix = vs.map((v, i) => v ? ({ lens: LENSES[i].k, lost: v.params.filter(p => scoreFor(p, m.ours) !== null && scoreFor(p, m.control) !== null && scoreFor(p, m.ours) < scoreFor(p, m.control)), topFixes: v.topFixes }) : null).filter(Boolean)
  }
}

// WF-P22 + NEXT-RUN.md 4.9: the round-1 candidate must beat the control by more than 0.1 in round 1 (as ours) AND in
// round 2 (as prev), with no lens below the control (unless Dex allowed a lever-lens promotion); it is procedural by
// construction, and Promote proves a fresh rebuild reproduces the judged stills to 0 px. candidate2 was judged only
// once, so it is reported as the next run's candidate, never promoted here.
const noLoss = ls => DEX.promoteOnLeverWin === true || !ls.length
const bothWon = !!cand1 && whole.length === 2 &&
  whole[0].oursMean > whole[0].controlMean + 0.1 && noLoss(whole[0].lensLoss) &&
  whole[1].prevMean !== null && whole[1].prevMean > whole[1].controlMean + 0.1 && noLoss(whole[1].prevLensLoss)
let promote = null
if (bothWon) {
  phase('Promote')
  promote = await agent(`${CTX}
Task: PROMOTE (the only step allowed to write rosace.blend). Whole rounds: ${JSON.stringify(whole)}. Promote the round-1 candidate, which won as ours in round 1 and again as prev in round 2 (${cand1.stills}; recipe ${cand1.recipe}); candidate2 (${ours.stills}) was judged only once and stays a lane candidate for the next run. Back up ${BUILD}\\rosace.blend as rosace_pre_next.blend first and refuse if that backup already exists with other content (never overwrite any backup). Make build_rosace_v2.py and stills_v2.py produce this look by default through a new chain 'next' reading art/rosace/next/next.json (keep --chain drive9 and --chain integrated working and unchanged). Rebuild from scratch and prove 0 changed px against the judged stills on all 16 images; if it is not 0 px, restore the backup, keep the old default, and report why. Pose files: ${DEX.ownPoseFiles ? 'Dex approved making the next poses and bust canonical picks' : 'Dex has not approved taking over the figure-pose files: reference the new pose and shape files from next.json only'}. Update PIPELINE.md (3.6s: done) and add a WF-P22 learning-log row.`, { label: 'promote', phase: 'Promote', schema: DOC, effort: 'high' })
} else {
  log(`no promotion: ${whole.length ? whole.map(w => 'r' + w.round + ' ' + w.oursMean + ' vs ' + w.controlMean).join(', ') : 'no whole round ran'}`)
}

phase('Report')
const report = await agent(`${CTX}
Task: REPORT. Prep: ${prep ? JSON.stringify({ controlZeroPx: prep.controlZeroPx, changedPx: prep.changedPx, stance: prep.stanceDiagnosis }).slice(0, 2000) : 'failed'}. Levers: ${JSON.stringify(Object.values(done)).slice(0, 9000)}. Whole rounds: ${JSON.stringify(whole)}. Promoted: ${promote ? promote.summary.slice(0, 800) : 'no'}. Stopped for Dex: ${stopForDex}.
Return reportMarkdown for Dex (the coordinator saves it as ${REVIEW}/REPORT.md): answer first in plain words; then per part and per lens, never one overall score alone: each lever's target and guard params (control vs each letter, per critic, and each letter against its parent), the whole-round lens table (ours, control, refs), what moved and what did not, the sheets to look at (paths), the measured gate numbers before and after; then the honest remaining gap and the next levers; then every ask struck by settled.json. questionsForDex: every open design call (O-32, O-33, the FC-P39 revert, and NEXT-RUN.md section 5's unanswered items) and every "for Dex" ask, each one sentence with its evidence. Update the ART-RULES Learning log (rows NX-*) and PIPELINE.md 3.6s with the final state.`, { label: 'report', phase: 'Report', schema: REPORT, effort: 'high' })

const RESULT = {
  prep: prep ? { controlZeroPx: prep.controlZeroPx, stanceDiagnosis: prep.stanceDiagnosis } : null,
  levers: Object.values(done).map(r => ({ lever: r.lever, kept: r.kept && r.kept.name, decision: r.decision || null, iterations: r.hist.length })),
  stopForDex,
  whole,
  promoted: !!(promote && bothWon),
  report: report && report.summary,
  questionsForDex: report ? report.questionsForDex : [],
}
return RESULT
