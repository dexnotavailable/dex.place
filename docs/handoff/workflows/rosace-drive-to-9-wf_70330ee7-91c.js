export const meta = {
  name: 'rosace-drive-to-9',
  description: 'Break the ~5.7 plateau: measure the finish/proportion/mass gap vs refs, bake off three structural routes blind, combine the winners with the figure-pose lane, then loop the whole character toward 9/10 with escalation',
  phases: [
    { title: 'Diagnose', detail: 'measure refs vs ours: colours, ramps, AA, texture, head ratio, fill, mass' },
    { title: 'Routes', detail: 'F1 hi-bit painterly finish, F2 proportions, F3 mass and silhouette' },
    { title: 'Judge', detail: 'blind set with the current build as control, 3 lens judges' },
    { title: 'Combine', detail: 'stack winning levers + figure-pose + thong string into a candidate' },
    { title: 'Whole', detail: '5-lens whole-character loop to 9 with escalations' },
    { title: 'Report', detail: 'promote if better, REPORT.md, PIPELINE.md' },
  ],
}

const CTX = `
Project: dex.place player character "Rosace". Repo D:\\Dex\\Projects\\dex.place (public; no commits or pushes). Read first: docs/character/DESIGN.md (revision 3.5 at the top is Dex's direction and overrides older text: target 9/10 = parity with refs, seductive-elegant pose, wider stance, bigger or more prominent bust, 1 px black thong string), docs/character/ART-RULES.md (+ art-rules/*.md incl. pose.md, checklist.json, Learning log), docs/character/PIPELINE.md (the build and the stills chain: build_rosace_v2.py, stills_v2.py driven by art/rosace/integrated.json), CRITIQUE-PARAMS.md. Refs (third-party, never commit): D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ and native/ (finish bar: 07, 08, 09, 04).
State: the artistry pass integrated five part lanes into the canonical D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\rosace.blend (backup rosace_pre_artistry.blend); integrated stills in review/rosace/art/integrated/. Whole-character critics scored it 5.7 (refs = 9), the same plateau as every earlier route. A separate figure-pose lane is STILL RUNNING (do not edit its files: rosace_v2/figure_shape.py, figure_pose.py, art/rosace/figure/**, art/rosace/poses/idle_appeal*.json, back_appeal*.json, lanes/figure-pose*.blend); its bust pick is in art/rosace/figure/shape.json and its winning pose is concept A "queen contrapposto" (idle_appeal_A.json / back_appeal_A.json, refined copies idle_appeal.json / back_appeal.json when present). Use its newest files read-only.
The driver's diagnosis (Dex left the taste calls to the driver): the gap is structural, not per-part polish. (1) FINISH: the refs read as soft hi-bit painted pixel art (smooth multi-tone ramps, texture, many hues, light anti-aliasing, low-key values); ours reads as hard-banded clean toon on a self-imposed 32-colour cap (PX-P15). PX-P15 is our own rule, not Dex's: if the refs measure higher, match the refs. (2) PROPORTION: ref heads are about 1/6 of height (24-25 px at 137-158 px), which carries face appeal at this size; ours is a taller model ratio. (3) MASS: the refs' silhouettes are big cloth shapes; ours is thin strips. (4) POSE: the figure-pose lane covers it.
HARD RULES: no image generation of any kind (no AI image tools, no generative add-ons); everything is rendered from our own 3D model or authored in code/data. Blender headless via tools/pixel-pipeline/blender.ps1, absolute paths, at most one Blender process per agent, small renders (this PC has had GPU driver crashes). Never write rosace.blend except in the Report step. Both sizes matter: 144 px close-up and 80 px world. Append learnings to the ART-RULES Learning log and checks to checklist.json (read-modify-write right before saving). Keep PIPELINE.md current for anything that changes how she is built.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, media: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'media'] }
const CRIT = { type: 'object', properties: { params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, winner: { type: 'string', enum: ['ours', 'ref', 'tie'] }, gap: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'winner', 'gap', 'fix'] } }, score: { type: 'number' }, prefersOurs: { type: 'string', enum: ['yes', 'no', 'cant-choose'] }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['params', 'score', 'prefersOurs', 'topFixes'] }
const DIAG = { type: 'object', properties: { levers: { type: 'array', items: { type: 'object', properties: { lever: { type: 'string' }, refs: { type: 'string' }, ours: { type: 'string' }, expectedGain: { type: 'number' }, how: { type: 'string' } }, required: ['lever', 'refs', 'ours', 'expectedGain', 'how'] } }, summary: { type: 'string' } }, required: ['levers', 'summary'] }
const JUDGE = { type: 'object', properties: { scores: { type: 'array', items: { type: 'object', properties: { letter: { type: 'string' }, candidate: { type: 'string' }, score: { type: 'number' }, strengths: { type: 'string' }, gaps: { type: 'string' } }, required: ['letter', 'candidate', 'score', 'strengths', 'gaps'] } }, keep: { type: 'array', items: { type: 'string' } }, fixes: { type: 'array', items: { type: 'string' } } }, required: ['scores', 'keep', 'fixes'] }

phase('Diagnose')
const diag = await agent(`${CTX}
Task: MEASURE THE GAP with numbers, not adjectives. Crop refs 07, 08, 09 (native 1x) and 04 (native grid) and our integrated idle, N1 and back view at 144 (review/rosace/art/integrated/ and D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\renders\\integrated). For each: unique colours on the figure; tones per material (skin, light cloth, dark cloth, hair, metal) and their hue shift across the ramp; the share of silhouette-edge pixels that are intermediate (anti-aliased) colours; outline treatment (coloured vs black, selective vs full); texture (local variance inside flat areas); value key (luminance histogram of the figure); saturation range; head height / body height; eye width in px; the figure's bounding box fill of its frame; silhouette area per height (mass). Also read the whole-loop critics' sheets and notes in review/rosace/art/whole/round-2/ for the params the refs won. Write docs/character/art-rules/finish-gap.md with a table of every measure (refs vs ours) and a ranked list of levers with the expected score gain of each. Test the driver's four-lever diagnosis honestly; add any lever it missed.`, { label: 'diagnose', phase: 'Diagnose', schema: DIAG, effort: 'high' })

const ROUTES = [
  { id: 'F1', name: 'hi-bit painterly finish', brief: `Change how she is RENDERED, not the model: a painterly NPR material set in Blender (soft multi-step ramps instead of hard cel bands, hue-shifted shadows and warm/cool light, cavity and AO, a subtle procedural brush-noise texture inside flat areas, rim per DESIGN section 9), rendered at 3-4x and downsampled with a controlled filter to 144 and 80, then quantised to an adaptive palette sized to what the refs measure (see finish-gap.md), with a selective, coloured 1 px outline and a cleanup pass for stray pixels. Try at least 3 settings (ramp softness, texture strength, palette size, AA amount) and keep the best by side-by-side against refs 07/08/09 at 3x and 1x. It must still read as pixel art at 1x, not as a blurry downscale. Own files: tools/pixel-pipeline/finish_f1/**, lane D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\finish-F1.blend.` },
  { id: 'F2', name: 'proportions for pixel appeal', brief: `Change the PROPORTIONS the way gacha pixel art does: scale the head (skull, face and hair together) by +10%, +15% and +20% with the neck adjusted so the join stays clean; eyes +10-15% in the face stamps; check how the bust pick (shape.json) reads with each; keep her elegant and long-legged (she is not chibi). Try the variants, look at each beside refs 07/08/09 at 3x and 1x and at 80 px, and keep the best. Own files: tools/pixel-pipeline/finish_f2/** (a head-scale module applied after the build), lane D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\finish-F2.blend.` },
  { id: 'F3', name: 'mass and silhouette', brief: `Give her BIG SHAPES within the design (DESIGN sections 1 and 3): larger bell sleeves with visible indigo lining, a longer and wider tabard with tails that can flutter, more veil and hair volume past the skull, and deliberate cloth fold accents, so the black-fill silhouette has the mass of the refs while keeping the chest window, open back, thong-cut back and legs visible. Try at least 3 variants and keep the best by black-fill silhouette and 3x/1x side-by-side vs the refs. Own files: tools/pixel-pipeline/finish_f3/** (parameter overrides applied after outfit.py and hair.py; do not edit those files), lane D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\finish-F3.blend.` },
]
phase('Routes')
const routes = await parallel(ROUTES.map(r => () => agent(`${CTX}
Measured gap: ${diag ? JSON.stringify(diag).slice(0, 3500) : 'see docs/character/art-rules/finish-gap.md'}
Task: ROUTE ${r.id}, "${r.name}". ${r.brief}
Base: the integrated canonical build with the figure-pose lane's newest pose applied (idle_appeal.json if present, else idle_appeal_A.json, and the back_appeal equivalent) and the bust from shape.json, using its applier read-only. Render idle (3/4), N1 contact and the back view at 144 and 80, plus black-fill silhouettes, into review/rosace/art/finish/${r.id}/ with your own blind A/B sheets vs refs 07/09/04 (key.json). Report what you kept, what you rejected and why, and the exact commands to reproduce your pick.`, { label: `route-${r.id}`, phase: 'Routes', schema: DOC, effort: 'high' })))
const okRoutes = ROUTES.filter((r, i) => routes[i])

phase('Judge')
const sheets = await agent(`${CTX}
Task: build ONE blind judging set in review/rosace/art/finish/judge/. Entries: ${okRoutes.map(r => r.id + ' (' + r.name + ')').join(', ')} from review/rosace/art/finish/<id>/, plus the CURRENT integrated build rendered with the same pose as a control named "current". Shuffle under letters (key.json maps letters to ids). Sheets: the idles at 144 x3 in one row beside ref 07/09/04 crops at native grid, the same at 144 x1, the 80 px idles at x3 and x1, the N1 contacts at x3, the back views at x3, and black-fill silhouettes. Letters only on panels.`, { label: 'judge-sheets', phase: 'Judge', schema: DOC, effort: 'medium' })
const JL = [
  { k: 'finish', l: 'MATERIALS, SHADING, PALETTE AND VALUE, PIXEL CRAFT, RIM (CRITIQUE-PARAMS 14-17): which entry has the finish of the refs?' },
  { k: 'appeal', l: 'FACE, GENUINE ATTRACTIVENESS, BODY, PROPORTION, POSE AND SEX APPEAL IN THEME (2, 3, 5, 9-12).' },
  { k: 'first', l: 'FIRST IMPRESSION, SILHOUETTE AND MASS, 80 PX READABILITY, THE DONATION TEST (1, 10, 30, 31).' },
]
const judges = await parallel(JL.map(j => () => agent(`${CTX}
Independent judge. Lens: ${j.l}
Open every sheet in review/rosace/art/finish/judge/ (Read the PNGs). Score every lettered entry /10 (refs = 9) BEFORE opening key.json; then open key.json and fill in each letter's id. Then list which route levers to KEEP in the combined build (they can stack: finish + proportions + mass), and fixes.`, { label: `judge:${j.k}`, phase: 'Judge', schema: JUDGE, effort: 'high' })))
const jok = judges.filter(Boolean)
const jt = {}
jok.forEach(j => j.scores.forEach(s => { const k = s.candidate.trim().split(/[ (]/)[0]; (jt[k] = jt[k] || []).push(s.score) }))
const jr = Object.entries(jt).map(([k, v]) => ({ k, avg: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.avg - a.avg)
const cur = jr.find(x => x.k === 'current')
log(`finish bake-off: ${jr.map(r => r.k + ' ' + r.avg.toFixed(1)).join(', ')}`)
const winners = jr.filter(x => x.k !== 'current' && (!cur || x.avg > cur.avg)).map(x => x.k)

phase('Combine')
const combine = await agent(`${CTX}
Task: COMBINE the levers that beat the current build: ${JSON.stringify(winners)} (bake-off averages ${JSON.stringify(jr)}). Judges' keep-lists: ${JSON.stringify(jok.map(j => j.keep)).slice(0, 2500)}. Judges' fixes: ${JSON.stringify(jok.flatMap(j => j.fixes)).slice(0, 3000)}. Route reports: ${JSON.stringify(routes.filter(Boolean).map(x => x.summary.slice(0, 900)))}
Stack them in a sensible order (model changes: proportions and mass; then pose and bust from the figure-pose lane; then the finish/render route), apply the 1 px black thong string from DESIGN rev 3.5 item 5 if the outfit still has a thicker one, and resolve clashes by side-by-side. Build to D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\drive9.blend with a pick file art/rosace/drive9.json (do not overwrite integrated.json). Render the full stills set (idle, N1 contact, Q stamp, back view) at 144 and 80, and an N1 motion strip if the finish route works on frames. Output to review/rosace/art/drive9/combined/. Look at everything yourself.`, { label: 'combine', phase: 'Combine', schema: DOC, effort: 'high' })

const LENSES = [
  { k: 'face', l: 'FACE, GENUINE ATTRACTIVENESS, HEAD AND HAIR (CRITIQUE-PARAMS 2-4).' },
  { k: 'body', l: 'BODY, POSTURE, POSING, STYLISATION, SEX APPEAL IN THEME, ARMS AND HANDS (5, 6, 9-12), judged against DESIGN rev 3.5.' },
  { k: 'gear', l: 'WEAPON, GRIP AND OUTFIT (7, 8, 13).' },
  { k: 'craft', l: 'MATERIALS, SHADING, PALETTE AND VALUE, PIXEL CRAFT, RIM (14-17).' },
  { k: 'overall', l: 'FIRST IMPRESSION, ORIGINALITY, THE DONATION TEST, 80 PX WORLD READABILITY (1, 18, 30, 31).' },
]
const ESC = [
  `ESCALATION 1, push: exaggerate the winning levers about 30% further (head and eye scale, value contrast and ramp richness, silhouette mass, pose angles), then pull back only what breaks anatomy or readability.`,
  `ESCALATION 2, paint-over: keep the render as the underlay and hand-author pixel override layers (art/rosace/overrides/drive9/) on the four key stills, aimed at the params the refs keep winning (face, hair strands, cloth folds, material texture). Derive the 80 px by hand too.`,
  `ESCALATION 3, recombine: rebuild from the runner-up route or a different lever mix and compare both side by side; keep the better.`,
]
phase('Whole')
let hist = [], wcrit = null, esc = 0, noGain = 0
const base = cur ? cur.avg : 5.7
for (let round = 1; round <= 8; round++) {
  const escNote = (noGain > 0 && esc < ESC.length) ? ESC[esc] : ''
  if (escNote) esc++
  const s = await agent(`${CTX}
Task: WHOLE-CHARACTER ROUND ${round} on the drive9 build (lanes/drive9.blend, art/rosace/drive9.json; combine report: ${combine ? combine.summary.slice(0, 1500) : 'see review/rosace/art/drive9/combined/'}). ${wcrit ? 'First apply these critic fixes to the drive9 build: ' + JSON.stringify(wcrit).slice(0, 7000) : ''}
${escNote}
If the figure-pose lane has produced a newer or better pose since last round (check review/rosace/art/figure-pose/ and its REPORT.md), adopt it. Then build blind A/B sheets (shuffled, key.json) vs refs 07/08/09/04 at native grid: idle, N1 contact, Q stamp and back view at 144 x3 and x1, and at 80 next to a world-scale ref crop. Output to review/rosace/art/drive9/round-${round}/. Log learnings.`, { label: `whole:r${round}`, phase: 'Whole', schema: DOC, effort: 'high' })
  if (!s) break
  const rv = await parallel(LENSES.map(c => () => agent(`${CTX}
Independent, demanding critic. Lens: ${c.l} Sheets in review/rosace/art/drive9/round-${round}/ (Read the PNGs); verdicts before key.json. Per param winner/gap/fix, a score /10 (refs = 9), prefers ours?, top fixes.`, { label: `whole:${c.k}:r${round}`, phase: 'Whole', schema: CRIT, effort: 'high' })))
  const ok = rv.filter(Boolean)
  const avg = ok.length ? ok.reduce((a, c) => a + c.score, 0) / ok.length : 0
  const prefer = ok.filter(c => c.prefersOurs !== 'no').length
  const prev = hist.length ? hist[hist.length - 1].avg : base
  hist.push({ round, avg, scores: ok.map(c => c.score), prefer, escalation: escNote ? esc : 0 })
  log(`drive9 r${round}: avg ${avg.toFixed(2)} (${ok.map(c => c.score).join('/')}), ${prefer}/${ok.length} prefer or cannot choose${escNote ? ', escalation ' + esc : ''}`)
  if (avg >= 9 && prefer * 2 >= ok.length) break
  if (avg < prev + 0.25) noGain++; else noGain = 0
  if (noGain >= 2 && esc >= ESC.length) { log('drive9: plateau after all escalations; stopping to report'); break }
  wcrit = rv.map((c, i) => c ? ({ lens: LENSES[i].k, score: c.score, lost: c.params.filter(x => x.winner === 'ref'), topFixes: c.topFixes }) : null).filter(Boolean)
}

phase('Report')
const best = hist.length ? hist.reduce((a, b) => (b.avg > a.avg ? b : a)) : null
const report = await agent(`${CTX}
Task: REPORT and PROMOTE. Whole-loop history: ${JSON.stringify(hist)}; bake-off: ${JSON.stringify(jr)}; the pre-drive9 integrated build scored ${base} in the bake-off (the whole loop had it at 5.7).
If the best drive9 round (${best ? 'round ' + best.round + ', ' + best.avg.toFixed(2) : 'none'}) beats the integrated build, promote it: back up rosace.blend as rosace_pre_drive9.blend (never overwrite a backup), make build_rosace_v2.py + stills_v2.py produce the drive9 look by default (keep a flag for the old chain), re-render the full stills set and confirm it matches the judged round. Otherwise leave rosace.blend alone.
Write review/rosace/art/drive9/REPORT.md in plain words for Dex: where she stands per lens against the refs, which levers moved the score and which did not, the best sheets to look at (paths), and the honest remaining gap with the next levers to pull. Update PIPELINE.md and the ART-RULES Learning log.`, { label: 'report', phase: 'Report', schema: DOC, effort: 'high' })
return { diag: diag && diag.levers, bakeoff: jr, winners, hist, report: report && report.summary }
