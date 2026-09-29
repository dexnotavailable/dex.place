export const meta = {
  name: 'rosace-figure-pose',
  description: 'New figure-pose lane for Rosace per Dex direction (DESIGN rev 3.5): pose rules from tutorials, bust shape variants, 3 seductive-elegant wide-stance idle/back candidates, blind judging, refine loop toward 9/10 with escalation',
  phases: [
    { title: 'Rules+Shape', detail: 'pose/appeal rules from tutorials, in parallel with bust shape variants' },
    { title: 'Shape pick', detail: 'critics pick the bust variant; shape.json + pose applier' },
    { title: 'Explore', detail: '3 pose concepts, each with idle hero + back view at 144 and 80' },
    { title: 'Judge', detail: 'blind combined sheet, 3 lens judges, winner + grafts' },
    { title: 'Refine', detail: 'build -> 3 critics loop to 9/10, escalate on plateau' },
    { title: 'Report', detail: 'REPORT.md for integration, PIPELINE/DESIGN updates' },
  ],
}

const CTX = `
Project: dex.place player character "Rosace". Repo D:\\Dex\\Projects\\dex.place (public; no commits or pushes). Read first: docs/character/DESIGN.md, especially "Revision 3.5" at the top (Dex's appeal direction: target 9/10 = parity with refs, seductive-elegant pose, a wider starting stance, a bigger or more prominent bust, a thinner thong string; it overrides older text below it). Then docs/character/ART-RULES.md (+ art-rules/figure.md, face.md, pixel.md, checklist.json and the Learning log), docs/character/PIPELINE.md (how the model is built and rendered), CRITIQUE-PARAMS.md, QUALITY-RUBRIC.md. Refs (third-party, never commit): D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ and native/ (finish bar: 07, 08, 09, 04).
The 3D base is human-authored and good (SiroinoSotai CC0 body + 射当ユウキ MMD head), canonical in D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\rosace.blend, built by tools/pixel-pipeline/build_rosace_v2.py with the rosace_v2/ and rosace/ modules. Poses are art/rosace/poses/*.json (idle_hero, n1_contact, n2_pivot, q_stamp), applied by tools/pixel-pipeline/rosace/posing.py.
Running in parallel right now (do NOT edit their files): the artistry-pass lanes face, hair, outfit (owns the thong and bodice, outfit.py), glaive-hands (owns hand drawings, grip sockets, IK targets, glaive.py) and shading (materials, post, palette, rim). Each builds to D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\<lane>.blend. World and website lanes also run. This PC has had GPU driver crashes: run at most one Blender process at a time, keep renders small, never stress the GPU.
You are the FIGURE-POSE lane. You own: tools/pixel-pipeline/rosace_v2/figure_shape.py, tools/pixel-pipeline/rosace_v2/figure_pose.py (an applier that runs after posing.py; never edit posing.py), art/rosace/figure/** (shape.json), NEW pose files art/rosace/poses/idle_appeal*.json and back_appeal*.json (never overwrite existing pose files), lane builds D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\figure-pose*.blend, and review/rosace/art/figure-pose/** (git-ignored; sheets that contain refs go only here, blind A/B with key.json). Never write the canonical rosace.blend.
HARD RULES: no image generation of any kind (no AI image tools, no generative add-ons); Blender headless via tools/pixel-pipeline/blender.ps1 with absolute paths; pixel output authored in code and data. Both sizes matter: the 144 px close-up AND the 80 px world render. A drawing is only done when a side-by-side against the ref at 3x and 1x says so (rule WF-P11). Append what you tried, what failed and what you learned to ART-RULES.md's Learning log (append-only, short rows); add checks to art-rules/checklist.json with an immediate read-modify-write right before saving (other lanes append to it too). Keep PIPELINE.md current for anything you change in how she is built (AGENTS.md rule).
`

const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, media: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'media'] }
const CRIT = { type: 'object', properties: { params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, winner: { type: 'string', enum: ['ours', 'ref', 'tie'] }, gap: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'winner', 'gap', 'fix'] } }, score: { type: 'number' }, prefersOurs: { type: 'string', enum: ['yes', 'no', 'cant-choose'] }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['params', 'score', 'prefersOurs', 'topFixes'] }
const PICK = { type: 'object', properties: { ranking: { type: 'array', items: { type: 'object', properties: { variant: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['variant', 'score', 'why'] } }, fixes: { type: 'array', items: { type: 'string' } } }, required: ['ranking', 'fixes'] }
const JUDGE = { type: 'object', properties: { scores: { type: 'array', items: { type: 'object', properties: { letter: { type: 'string' }, candidate: { type: 'string' }, score: { type: 'number' }, strengths: { type: 'string' }, gaps: { type: 'string' } }, required: ['letter', 'candidate', 'score', 'strengths', 'gaps'] } }, grafts: { type: 'array', items: { type: 'string' } }, fixes: { type: 'array', items: { type: 'string' } } }, required: ['scores', 'grafts', 'fixes'] }

const LENSES = [
  { k: 'appeal', l: 'POSING, APPEAL AND SEX APPEAL IN THEME, ELEGANCE (CRITIQUE-PARAMS 9, 10, 12): is the pose genuinely seductive and elegant the way a top gacha splash or idle is, with a clear S-curve, the stance wide as Dex asked, hands graceful, the gaze knowing? Is it tasteful rather than vulgar?' },
  { k: 'figure', l: 'BODY, PROPORTION, BUST AND STYLISATION, ANATOMY AND BALANCE (CRITIQUE-PARAMS 5, 9, 11): hourglass, bust size and prominence in silhouette, weight over the feet, believable joints, pushed past realistic the way anime and gacha art is.' },
  { k: 'read', l: 'FIRST IMPRESSION, READABILITY AT THE 80 PX WORLD SIZE, SILHOUETTE AND THE DONATION TEST (CRITIQUE-PARAMS 1, 10, 30, 31): at 1x and 3x, and as a black-fill silhouette, would a 3D gacha player screenshot her and consider donating?' },
]

// ---------- Rules + Shape ----------
phase('Rules+Shape')
const rulesP = agent(`${CTX}
Task: establish the POSE AND FIGURE-APPEAL rules, the way an artist learns from real tutorials. Research legit sources (WebSearch/WebFetch are allowed): figure and gesture teaching (Loomis "Figure Drawing for All It's Worth", Michael Hampton "Figure Drawing: Design and Invention", Proko on gesture and contrapposto, Glenn Vilppu), pin-up and glamour posing analysis (Elvgren, fashion and model posing guides on the S-curve, weight shift, hands, chin and gaze), anime and manga female posing guides, and how gacha games stage idle and splash poses (Genshin Impact, Honkai Star Rail, Wuthering Waves, Arknights Endfield, Zenless Zone Zero: describe the conventions, never copy an asset). Also pixel-scale posing (Slynyrd, Saint11/Pedro Medeiros) and how a stylised bust reads at 80 and 144 px (silhouette break, underbust shadow, highlight, cloth tension lines).
Write docs/character/art-rules/pose.md in the same style as figure.md: sources with links, principles, MEASURABLE parameters at 144 and 80 px (tilt angles, stance width in shoulder-widths, weight-leg placement, head tilt, hand shapes, glaive angle and framing, bust projection in px in 3/4 and side views), positive rules PS-P01.. and NEGATIVE rules PS-N01.. (where things must never be: vulgar or crotch-forward stances, symmetry, parallel feet, locked knees, fists at rest, hiding the curves, realistic sag, sphere-stuck bust, tangents, and more you find), and a self-check list. Link it from ART-RULES.md. Add machine checks for the measurable ones to art-rules/checklist.json (read-modify-write immediately before saving). Reconcile with DESIGN revision 3.5: if the tutorials argue for different numbers, say so in pose.md with the source; do not edit DESIGN.md.`, { label: 'pose-rules', phase: 'Rules+Shape', schema: DOC, effort: 'high' })

const shapeP = agent(`${CTX}
Task: BUST SHAPE VARIANTS on the v2 body, per DESIGN revision 3.5 item 4. Write tools/pixel-pipeline/rosace_v2/figure_shape.py: a non-destructive, parameterised change (shape key and/or bone scale on the body; never remesh or hand-sculpt away the human-authored base) with parameters for volume, lift and projection, and make sure the outfit pieces that sit on the chest (bodice, chest window, halter, collar area) follow it in your lane build (check how outfit meshes are fitted in the build: surface deform, shrinkwrap or a matching shape key), with no clipping at 144.
Build D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\figure-pose-shape.blend and render variants: S0 = current base; S1 = +20% volume; S2 = +30% volume; S3 = +20% volume with extra lift and projection; S4 = +40% volume (the ceiling, to see where it breaks). For each: the current idle_hero pose in 3/4, a true side view and the back view, at 144 and at 80, plus black-fill silhouettes. Keep the narrow waist. Build blind comparison sheets in review/rosace/art/figure-pose/shape/ (variants shuffled with letters and key.json, beside refs 07, 09 and 04 at native grid) at 3x and 1x. Look at every sheet yourself and note which variants break anatomy or clip.`, { label: 'shape-variants', phase: 'Rules+Shape', schema: DOC, effort: 'high' })

const shapeChain = shapeP.then(async (shape) => {
  if (!shape) return null
  const crits = await parallel([LENSES[1], LENSES[0]].map(c => () => agent(`${CTX}
Independent, demanding critic of the BUST SHAPE VARIANTS. Lens: ${c.l}
Open the sheets in review/rosace/art/figure-pose/shape/ (Read the PNGs). Give your verdicts on the lettered variants BEFORE opening key.json; then open key.json and report each variant by its real id (S0..S4). Score each /10 against Dex's direction (bigger or more prominent, stylised anime/gacha, reads at 80, not vulgar, no sag, no spheres) with the refs as 9. Also list fixes for the best one.`, { label: `shape-critic:${c.k}`, phase: 'Shape pick', schema: PICK, effort: 'high' })))
  const ok = crits.filter(Boolean)
  const tally = {}
  ok.forEach(c => c.ranking.forEach(r => { const k = (r.variant.match(/S\d/) || [r.variant])[0]; tally[k] = tally[k] || []; tally[k].push(r.score) }))
  const avg = Object.entries(tally).map(([k, v]) => ({ k, avg: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.avg - a.avg)
  const pick = avg.length ? avg[0].k : 'S3'
  log(`bust shape pick: ${pick} (${avg.map(a => a.k + ' ' + a.avg.toFixed(1)).join(', ')})`)
  const fin = await agent(`${CTX}
Task: FINALISE THE SHAPE AND BUILD THE POSE APPLIER.
1. The critics picked bust variant ${pick} (averages: ${JSON.stringify(avg)}). Their fixes: ${JSON.stringify(ok.flatMap(c => c.fixes)).slice(0, 3000)}. Write art/rosace/figure/shape.json with the picked parameters plus the fixes that are small parameter changes, and make figure_shape.py read it by default.
2. Write tools/pixel-pipeline/rosace_v2/figure_pose.py: a generic applier that runs after posing.py, loads a pose JSON (the same format as art/rosace/poses/*.json, extended as needed for hip, spine, chest, shoulder, neck and head rotations, foot and hand IK targets, a head look-at, and finger curls), and applies it. It must be complete enough that three pose designers can work purely by writing JSON files; they will not be allowed to edit it.
3. Build D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\figure-pose-base.blend (the shape applied), render the current idle_hero through the applier at 144 and 80 to prove it round-trips, and document both modules and the JSON format in PIPELINE.md.
Shape round context: ${shape.summary.slice(0, 1500)}`, { label: 'shape-finalise+applier', phase: 'Shape pick', schema: DOC, effort: 'high' })
  return { pick, avg, fin }
})

const [rules, shaped] = await Promise.all([rulesP, shapeChain])
if (!shaped || !shaped.fin) { log('shape/applier step failed; stopping so the driver can look'); return { rules, shaped } }

// ---------- Explore ----------
const CANDS = [
  { id: 'A', name: 'queen contrapposto', brief: 'A wide, planted stance. The weight leg is straight under the pit of the neck; the hip is cocked hard over it; the free leg is extended out and forward with the toe pointed and turned out. The glaive is planted on the far side at about 20 degrees, held high by one elegant hand; the other hand rests on the cocked hip, wrist bent. The chest is lifted with a slight back arch, the torso turned three-quarters, the head tilted, and a knowing glance at the viewer over the near shoulder. Back view: an over-the-shoulder glance, hip shifted, spine curve and thong-cut back visible.' },
  { id: 'B', name: 'glaive across the shoulders', brief: 'The glaive rests horizontally behind her neck across both shoulders, both wrists draped over the haft with relaxed, elegant hands (the classic confident gacha idle). The stance is wide with a strong hip shift, the back arched, the bust forward in three-quarters, and the chin slightly down with the eyes up at the viewer and a soft smile. Back view: the glaive across the shoulders frames the open back; one hip dropped; she looks back past the haft.' },
  { id: 'C', name: 'leaning on the lance', brief: 'Part of her weight leans on the planted glaive, angled about 25 degrees away; her body makes one long S-curve toward it. A wide base: the weight leg straight, the free leg crossing in at the knee while the foot stays wide and pointed. The other hand trails fingertips at the collar or along the thigh. Chin down, eyes up, a hint of a smile. Back view: leaning on the glaive, looking back over the far shoulder, hip out.' },
]
phase('Explore')
const cands = await parallel(CANDS.map(c => () => agent(`${CTX}
Pose rules for this work: docs/character/art-rules/pose.md (just written: ${rules ? rules.summary.slice(0, 800) : 'see the file'}). Bust shape: art/rosace/figure/shape.json (picked ${shaped.pick}); the applier tools/pixel-pipeline/rosace_v2/figure_pose.py is FROZEN for you: write poses purely as JSON; if you truly need an applier feature, put it in your own tools/pixel-pipeline/rosace_v2/figure_pose_ext_${c.id}.py and say so.
Task: POSE CONCEPT ${c.id}, "${c.name}". ${c.brief}
Work like an artist: rough the gesture and line of action first, then build at least 3 sub-variants of this concept (push angles, stance width, hand and head placements), check each against pose.md and rules_check (tools/art-construct/rules_check.py), look at each side-by-side with refs 07, 09 and 04 at 3x and 1x, and keep the best. Files: art/rosace/poses/idle_appeal_${c.id}.json and back_appeal_${c.id}.json, lane build D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\figure-pose-${c.id}.blend (based on figure-pose-base.blend). Render the kept idle (3/4) and back view at 144 and 80, plus black-fill silhouettes, into review/rosace/art/figure-pose/explore/${c.id}/ with your own blind A/B sheets vs the refs and key.json. Hands: use the current hand meshes; the glaive-hands lane will redraw them later, so pose the hands clearly (bones), don't paint them. Report the kept files, render paths and what you rejected and why.`, { label: `pose-${c.id}`, phase: 'Explore', schema: DOC, effort: 'high' })))
const okCands = CANDS.filter((c, i) => cands[i])
if (!okCands.length) { log('all pose candidates failed'); return { rules, shaped, cands } }

// ---------- Judge (barrier: needs all candidates side by side) ----------
phase('Judge')
const judgeSheet = await agent(`${CTX}
Task: build ONE blind judging set in review/rosace/art/figure-pose/judge/. Candidates: ${okCands.map(c => c.id + ' (' + c.name + ')').join(', ')}, from review/rosace/art/figure-pose/explore/<id>/ and their pose files; plus the CURRENT idle (render art/rosace/poses/idle_hero.json from figure-pose-base.blend) as a control. Shuffle all of them under letters (write key.json mapping letters to candidate ids, with the control named "current"). Sheets: every lettered idle at 144 x3 in one row beside ref 07, 09 and 04 idle crops at native grid; the same at 144 x1; the 80 px world idles x3 and x1; the back views x3; and black-fill silhouettes. Label panels with letters only. Candidate reports: ${JSON.stringify(cands.filter(Boolean).map(x => x.summary.slice(0, 700)))}`, { label: 'judge-sheets', phase: 'Judge', schema: DOC, effort: 'medium' })
const judges = await parallel(LENSES.map(c => () => agent(`${CTX}
Independent judge. Lens: ${c.l}
Open every sheet in review/rosace/art/figure-pose/judge/ (Read the PNGs). Score every lettered pose /10 (the refs are 9) BEFORE opening key.json; then open key.json and fill in each letter's candidate id. Then: grafts (the best specific ideas from the non-winning candidates worth moving into the winner) and fixes for the winner.`, { label: `judge:${c.k}`, phase: 'Judge', schema: JUDGE, effort: 'high' })))
const jok = judges.filter(Boolean)
const jt = {}
jok.forEach(j => j.scores.forEach(s => { const k = s.candidate.trim(); jt[k] = jt[k] || []; jt[k].push(s.score) }))
const jr = Object.entries(jt).filter(([k]) => k !== 'current').map(([k, v]) => ({ k, avg: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.avg - a.avg)
const currentAvg = jt.current ? jt.current.reduce((a, b) => a + b, 0) / jt.current.length : null
const winner = jr.length ? jr[0].k : okCands[0].id
log(`pose judging: ${jr.map(r => r.k + ' ' + r.avg.toFixed(1)).join(', ')}; current idle ${currentAvg === null ? 'n/a' : currentAvg.toFixed(1)}; winner ${winner}`)

// ---------- Refine loop toward 9 ----------
phase('Refine')
const ESC = [
  'ESCALATION 1, push harder: exaggerate every pose angle, the stance width, the S-curve and the bust/hip silhouette about 30% past what feels comfortable, then pull back only what breaks anatomy or balance at 144 and 80.',
  'ESCALATION 2, hand-author: keep the 3D render as the underlay and paint a pixel override layer for the 144 idle and back stills (art/rosace/overrides/figure-pose/, compositing per PIPELINE.md): redraw the contour, the S-curve and the bust and hip silhouette by hand per ART-RULES and pose.md, then derive the 80 px from it by hand too.',
  'ESCALATION 3, rebuild from the runner-up: take the second-best candidate and graft in the winner\'s best parts; compare both side by side and keep the better.',
]
let hist = [], crit = { fromJudges: true, grafts: jok.flatMap(j => j.grafts).slice(0, 12), fixes: jok.flatMap(j => j.fixes).slice(0, 16) }, esc = 0, noGain = 0, build = null
for (let round = 1; round <= 6; round++) {
  const escNote = (noGain > 0 && esc < ESC.length) ? ESC[esc] : ''
  if (escNote) esc++
  build = await agent(`${CTX}
Task: REFINE the winning pose toward 9/10. Winner: candidate ${winner} (art/rosace/poses/idle_appeal_${winner}.json, back_appeal_${winner}.json, lane D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\figure-pose-${winner}.blend). Runner-up order: ${JSON.stringify(jr)}.
Round ${round}. Critique to address first: ${JSON.stringify(crit).slice(0, 7000)}
${escNote}
Work as an artist: several variants, rules_check, side-by-side vs refs at 3x and 1x, keep the best. The final files are art/rosace/poses/idle_appeal.json and back_appeal.json and the lane build D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\figure-pose.blend (shape.json applied). Render idle (3/4) and back at 144 and 80 plus black-fill silhouettes, and build blind A/B sheets vs refs 07, 09, 04 (shuffled letters, key.json) in review/rosace/art/figure-pose/refine/round-${round}/. Log learnings.`, { label: `refine:r${round}`, phase: 'Refine', schema: DOC, effort: 'high' })
  if (!build) break
  const rv = await parallel(LENSES.map(c => () => agent(`${CTX}
Independent, demanding critic. Lens: ${c.l}
Open the sheets in review/rosace/art/figure-pose/refine/round-${round}/ (Read the PNGs); verdicts before key.json. Per param winner/gap/fix, a score /10 (the refs are 9), prefers ours?, top fixes. Judge against Dex's direction in DESIGN revision 3.5 as well as the refs.`, { label: `refine-critic:${c.k}:r${round}`, phase: 'Refine', schema: CRIT, effort: 'high' })))
  const ok = rv.filter(Boolean)
  const avg = ok.length ? ok.reduce((s, c) => s + c.score, 0) / ok.length : 0
  const prefer = ok.filter(c => c.prefersOurs !== 'no').length
  const prev = hist.length ? hist[hist.length - 1].avg : (jr.length ? jr[0].avg : 0)
  hist.push({ round, avg, scores: ok.map(c => c.score), prefer, escalation: escNote ? esc : 0 })
  log(`figure-pose refine r${round}: avg ${avg.toFixed(1)} (${ok.map(c => c.score).join('/')}), ${prefer}/${ok.length} prefer or can't choose${escNote ? ', escalation ' + esc : ''}`)
  if (avg >= 9 && prefer * 2 >= ok.length) break
  if (avg < prev + 0.3) noGain++; else noGain = 0
  if (noGain >= 2 && esc >= ESC.length) { log('figure-pose: plateau after all escalations, stopping to report'); break }
  if (noGain >= 3) { log('figure-pose: three rounds without gain, stopping to report'); break }
  crit = ok.map(c => ({ score: c.score, lost: c.params.filter(x => x.winner === 'ref'), topFixes: c.topFixes }))
}

// ---------- Report ----------
phase('Report')
const report = await agent(`${CTX}
Task: write review/rosace/art/figure-pose/REPORT.md for the integration step and for Dex. First line "status: done". Include: the final files (pose JSONs, shape.json, figure_shape.py, figure_pose.py and any ext modules, the lane build), the exact order integration must apply them (base -> figure_shape -> posing.py -> figure_pose.py), what the outfit lane must do to fit the new bust, the scores (shape pick ${shaped.pick}; judging ${JSON.stringify(jr)}, current idle ${currentAvg}; refine history ${JSON.stringify(hist)}), the best sheets to show Dex (paths), and the open gaps in plain words. Update the numbers in DESIGN.md revision 3.5 items 2-4 to the values actually picked, tagged [M] with the file they came from (edit only those items), and make sure PIPELINE.md documents the figure-pose modules.`, { label: 'report', phase: 'Report', schema: DOC, effort: 'medium' })
return { shapePick: shaped.pick, shapeAvg: shaped.avg, judging: jr, currentAvg, winner, hist, report }
