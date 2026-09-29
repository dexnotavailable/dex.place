export const meta = {
  name: 'rosace-motion-round3',
  description: 'Motion round 3 on N1/N5: slow-in anticipation + fast strike, flat N5 sweep, diagonal coils, clean in-betweens, blade smear drawings, stole lag; loop until critics average >= 7.5',
  phases: [
    { title: 'Build', detail: 'apply round-2 critic fixes + smears' },
    { title: 'Critique', detail: 'blind A/B/C (round 2 vs round 3 vs spike)' },
  ],
}
const CTX = `
Project: dex.place player character "Rosace". Repo D:\\Dex\\Projects\\dex.place (public; no commits/pushes). Read docs/character/PIPELINE.md (sections 3.13, 3.14, 5, 7, 8), docs/character/MOVESET.md (N1 and N5 tables; heights still written for 96 px — convert per PIPELINE 3.2 to 144 px), tools/motion-ai/RETIME.md (incl. the Round 2 section), and the round-2 outputs in review/motion/r2/ (key.json, _metrics.json, sheets). Round 2 (hand-posed hero keys in art/rosace/poses/motion/*.json + Kimodo in-betweens + spring cloth, timing sheets tools/motion-ai/timing/n1_r2.json, n5_r2.json) scored 6.0-6.2 blind vs spike 4.5-5.0; refs = 9.
Required this round (critics' round-2 fixes, all of them):
1. SNAP: spread the move into the coil over 2-3 slow-in drawings (N1 f1-f3, N5 A1-A2) so the strike is clearly the fastest change; N5 S1-S3 small S1, big S3/C1 (not four even steps). Judge on the BODY-DRAWING phase ratio (mean strike change / mean anticipation step, cloth-only redraws excluded) >= 3 on both moves (now N1 1.71, N5 1.10).
2. FLAT N5 SWEEP: glaive pitch under ~15 degrees at knee-to-chest height from release through S3, following MOVESET's flat 360 ellipse; no blade over her head, no haft across her face (add in-between keys or interpolate the glaive in a root/world yaw plane instead of the chest frame).
3. DIAGONAL COILS: N1 and N5 coils get a 30-45 degree line of action forward over the front knee, back three-quarters to camera, head down; straighten the knock-kneed legs in the N5 coil and the kneel; make the kneel the open, symmetrical end pose MOVESET describes.
4. CLEAN IN-BETWEENS: fix N5 A1 (haft pointing at camera) and A2 (swinging in front instead of a back-arc).
5. STRIKE DRAWINGS: author blade smear drawings from the tracked 3D blade path (the spike's tracked-smear method in tools/pixel-pipeline — see PIPELINE.md) for N1 S1 (bent-blade smear per ref 09/10) and N5 S1-S3 (flat ellipse), pixel-consistent at 144 px, depth-tested against her body; this is the smear only, not the full stained-glass VFX.
6. STOLES lag 2-3 drawings per DESIGN.md 8 (add drag/collision or a lag offset).
Keep round 2's wins (spans >= 1.7 H, 0 cm foot drift, grip error < 3 cm, cloth moving on holds). Use a fresh read-only snapshot of the live D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\rosace.blend (never write the live file), absolute paths for every Blender render, one Blender process at a time. Outputs to D:\\Dex\\Projects\\dex.place\\review\\motion\\r3\\round-N\\ with blind A/B/C (round 2 vs this round vs spike) using a DIFFERENT random letter order per move and a key.json; keep any metrics file that names clips closed to critics. Update docs/character/PIPELINE.md 3.14/7/8 and RETIME.md with what's proven.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, metrics: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } }, abFiles: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'metrics', 'abFiles'] }
const CRIT = { type: 'object', properties: { ranking: { type: 'array', items: { type: 'object', properties: { variant: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['variant', 'score', 'why'] } }, newestScore: { type: 'number' }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['ranking', 'newestScore', 'topFixes'] }
let build = null, critique = null, history = []
for (let round = 1; round <= 3; round++) {
  phase('Build')
  build = await agent(`${CTX}\nRound ${round}. ${critique ? 'Previous critique first: ' + JSON.stringify(critique).slice(0, 8000) : ''}\nApply the fixes, render N1 and N5, measure (phase ratio body-only, entry ratio, contact span in H, glaive pitch through the N5 sweep, line-of-action angle at coils, foot drift, grip error, stole lag), build the blind A/B/C set, look at every frame, report.`, { label: `build:r${round}`, phase: 'Build', schema: DOC, effort: 'high' })
  if (!build) break
  phase('Critique')
  const crits = await parallel([
    'MOTION CRAFT: arcs, spacing, timing, snap/ease/rebound, weight, line of action, exaggeration, secondary motion, smear quality (CRITIQUE-PARAMS 11, 19-25, 27)',
    'BRIEF FIT: wide, grand, fluid, latest-gen gacha feel vs refs 05, 09, 10 in review/refs/character/; would a 3D gacha player find this attack satisfying?',
  ].map((lens, i) => () => agent(`${CTX}\nIndependent motion critic. Lens: ${lens}. Builder report: ${JSON.stringify(build).slice(0, 3000)}\nWatch the A/B/C media in D:\\Dex\\Projects\\dex.place\\review\\motion\\r3\\round-${round}\\ frame by frame (sample with Read); write verdicts BEFORE opening key.json, then map. Rank 0-10 (refs = 9), give the newest variant's score, and top fixes.`, { label: `critic:${i + 1}:r${round}`, phase: 'Critique', schema: CRIT, effort: 'high' })))
  const ok = crits.filter(Boolean)
  const avg = ok.length ? ok.reduce((s, c) => s + c.newestScore, 0) / ok.length : 0
  history.push({ round, avg, metrics: build.metrics })
  log(`round ${round}: newest avg ${avg.toFixed(1)}`)
  if (avg >= 7.5) break
  critique = ok.map(c => ({ ranking: c.ranking, topFixes: c.topFixes }))
}
return { build, history }
