export const meta = {
  name: 'rosace-artistry-pass',
  description: 'Per-part artistry lanes on the adopted v2 base (face, hair, outfit, glaive+hands, shading/pixel craft) with ART-RULES and blind critics, then integration and whole-character 31-param loop',
  phases: [
    { title: 'Parts', detail: '5 parallel part lanes, each with own files, critic rounds' },
    { title: 'Integrate', detail: 'merge all parts into the canonical build' },
    { title: 'Whole', detail: 'whole-character blind critic loop, plateau stop' },
  ],
}
const CTX = `
Project: dex.place player character "Rosace". Repo D:\\Dex\\Projects\\dex.place (public; no commits/pushes). Read: docs/character/DESIGN.md (latest design fixes: bright confident eyes, dark thigh-highs, collar cross, real hands and two-hand grip, idle with attitude, thong-cut back), docs/character/ART-RULES.md (+ art-rules/face.md, figure.md, pixel.md, checklist.json, and the Learning log), docs/character/PIPELINE.md, CRITIQUE-PARAMS.md, QUALITY-RUBRIC.md. Refs (third-party, never commit): D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\ + native/ (finish bar: 07, 08, 09, 04).
Dex: the base body and head are human-authored and good (SiroinoSotai CC0 body + 射当ユウキ MMD head, now canonical in D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\rosace.blend, built by tools/pixel-pipeline/build_rosace_v2.py + rosace_v2/ + rosace/ modules). "Everything else needs to really lock in and refine to get it to artistry level." Recent scores: whole character ~6/10 (refs = 9); the artist lane plateaued at 5.6-6.0 and found the checker too lenient, so a drawing is only done when a side-by-side pick vs the ref at 3x and 1x says so (rule WF-P11). Known open issues on v2: face stamps not re-anchored to the new head (144 idle lost its mouth), a hair strand crossing the cheek like a scar, figure pale and flat-shaded vs refs, rubble of hue banding on skin/white cloth.
Both sizes matter: 144 px close-up render AND the 80 px world render (locked world scale).
HARD RULES: no image generation; pixel work authored in code/data (construction tools in tools/art-construct, override layers in art/rosace/overrides); Blender headless in the isolated env (tools/pixel-pipeline/blender.ps1), absolute paths, and each lane builds to ITS OWN output file (e.g. D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\<lane>.blend) — never write the canonical rosace.blend except in the Integrate step. Every lane appends what it tried / failed / learned to ART-RULES.md's Learning log (append-only; short rows) and new checks to checklist.json. Sheets with refs go to review/rosace/art/<lane>/ (git-ignored), labelled A/B with key.json.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, media: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'media'] }
const CRIT = { type: 'object', properties: { params: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, winner: { type: 'string', enum: ['ours', 'ref', 'tie'] }, gap: { type: 'string' }, fix: { type: 'string' } }, required: ['param', 'winner', 'gap', 'fix'] } }, score: { type: 'number' }, prefersOurs: { type: 'string', enum: ['yes', 'no', 'cant-choose'] }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['params', 'score', 'prefersOurs', 'topFixes'] }

const PARTS = [
  { key: 'face', owns: 'art/rosace/construct/faces/**, tools/art-construct/face_* and heads_*, tools/pixel-pipeline/faces.py and author_faces*.py, face anchoring in the render path', brief: 'Re-anchor and finish the face library on the v2 head: construction-grid faces (front, 3/4, profile x confident, focused/attack, smile, plus pain/closed for motion) at 144 and simplified ones at 80; eyes that point the same way, charismatic and attractive per ART-RULES face rules; no hair crossing the face; brows and mouth readable; test composited on the actual v2 renders in several poses.', lens: 'FACE AND GENUINE ATTRACTIVENESS (CRITIQUE-PARAMS 2, 3) at 144 and 80.' },
  { key: 'hair', owns: 'tools/pixel-pipeline/rosace/hair.py (+ any hair helpers you add), hair materials, art/rosace/overrides hair layers', brief: 'Hair and veil: clump design with a readable silhouette beyond the skull, strand flow, tapered tips, a designed specular band, how it frames the face (no strands across the face), veil shape, secondary-motion chains that read in motion.', lens: 'HEAD AND HAIR (CRITIQUE-PARAMS 4) and how the hair frames the face.' },
  { key: 'outfit', owns: 'tools/pixel-pipeline/rosace/outfit.py (+ helpers), outfit materials, art/rosace/overrides outfit layers', brief: 'Every outfit piece at pixel scale: collar and cross, bodice and chest window, detached sleeves with indigo lining, long front tabard, open back and halter, thong-cut back with gold harness and garters, dark thigh-highs with gold top bands, boots with gold caps; fabric that reads as fabric (folds placed deliberately), crisp gold trim, value separation so nothing melts into the white; sex appeal in theme.', lens: 'OUTFIT, MATERIAL READ AND SEX APPEAL IN THEME (CRITIQUE-PARAMS 12, 13).' },
  { key: 'glaive-hands', owns: 'tools/pixel-pipeline/rosace/glaive.py, art/rosace/hands/**, tools/pixel-pipeline/author_hands.py, grip sockets and IK targets', brief: 'The glaive "Lancet" silhouette and materials (gold fittings, glass cells, glints), readable at 80 and 144; constructed pixel hands per ART-RULES figure/hand rules; a believable two-hand grip in idle, N1 contact and Q stamp (wrists, spacing, the weapon never floats).', lens: 'WEAPON, GRIP, ARMS AND HANDS (CRITIQUE-PARAMS 6, 7, 8).' },
  { key: 'shading', owns: 'tools/pixel-pipeline/rosace_post.py, rosace/materials.py, rim.py, postprocess.py, the override-layer compositing order, art/rosace/overrides global layers, palette.json', brief: 'Kill the 3D-render look: per-material tone counts and hue-shifted ramps matching what refs 07/08/09 measure; clean hand-shaped clusters instead of normal-banding; form shading that follows anatomy (skin, white cloth, gold, dark stockings); selective outline and interior lines; a painted-override workflow for key frames; rim on outline per DESIGN section 9. Must preserve other lanes\' parts (only shading/post/material ramps and the global override layer).', lens: 'MATERIALS AND SHADING, PALETTE AND VALUE, PIXEL CRAFT, RIM LIGHT (CRITIQUE-PARAMS 14-17).' },
]

phase('Parts')
const parts = await pipeline(
  PARTS,
  async (p) => {
    let build = null, crit = null, hist = []
    for (let round = 1; round <= 3; round++) {
      build = await agent(`${CTX}
Lane: ${p.key}. You own: ${p.owns}. Don't edit other lanes' files (face, hair, outfit, glaive-hands, shading lanes run in parallel).
Brief: ${p.brief}
Round ${round}. ${crit ? 'Critique to address first: ' + JSON.stringify(crit).slice(0, 6000) : ''}
Work like an artist: several variants, construction first, rule_check (tools/art-construct/rules_check.py), side-by-side vs refs at 3x and 1x, keep the best. Render the stills set (idle hero, N1 contact, Q stamp, back view) at 144 and 80 from your lane build, and part crops. Build blind A/B sheets for your part vs the matching ref crops in review/rosace/art/${p.key}/round-${round}/ with key.json. Log learnings.`, { label: `${p.key}:r${round}`, phase: 'Parts', schema: DOC, effort: 'high' })
      if (!build) break
      const c = await agent(`${CTX}
Independent, demanding critic for the ${p.key} part. Lens: ${p.lens}
Open the sheets in review/rosace/art/${p.key}/round-${round}/ (Read the PNGs); verdicts before key.json. Per param winner/gap/fix, score /10 (refs = 9), prefers ours?, top fixes.`, { label: `${p.key}:critic:r${round}`, phase: 'Parts', schema: CRIT, effort: 'high' })
      if (!c) break
      hist.push({ round, score: c.score, prefer: c.prefersOurs })
      log(`${p.key} r${round}: ${c.score} (${c.prefersOurs})`)
      if (c.score >= 7.5 && c.prefersOurs !== 'no') break
      if (hist.length >= 2 && hist[hist.length - 1].score <= hist[hist.length - 2].score) { log(`${p.key}: no gain, stopping`); break }
      crit = { score: c.score, lost: c.params.filter(x => x.winner === 'ref'), topFixes: c.topFixes }
    }
    return { key: p.key, build, hist }
  },
)

phase('Integrate')
const integ = await agent(`${CTX}
Part lanes finished: ${JSON.stringify(parts.filter(Boolean).map(p => ({ key: p.key, hist: p.hist, summary: p.build && p.build.summary && p.build.summary.slice(0, 900) })))}
Integrate every part lane's work into the canonical build: make build_rosace_v2.py produce rosace.blend with all five lanes' changes (back up the current rosace.blend as rosace_pre_artistry.blend first), resolve conflicts in favour of what each lane's critic preferred, re-render the full stills set at 144 and 80 plus one N1 motion strip, and look at everything. Update PIPELINE.md with the proven changes. Output to review/rosace/art/integrated/.`, { label: 'integrate', phase: 'Integrate', schema: DOC, effort: 'high' })

const LENSES = [
  { k: 'face', l: 'FACE, GENUINE ATTRACTIVENESS, HEAD AND HAIR (CRITIQUE-PARAMS 2-4).' },
  { k: 'body', l: 'BODY, POSTURE, POSING, STYLISATION, SEX APPEAL IN THEME, ARMS AND HANDS (5, 6, 9-12).' },
  { k: 'gear', l: 'WEAPON, GRIP AND OUTFIT (7, 8, 13).' },
  { k: 'craft', l: 'MATERIALS, SHADING, PALETTE/VALUE, PIXEL CRAFT, RIM (14-17).' },
  { k: 'overall', l: 'FIRST IMPRESSION, ORIGINALITY, DONATION TEST, and 80 px world readability (1, 18, 30, 31).' },
]
phase('Whole')
let whole = [], wcrit = null, cur = integ
for (let round = 1; round <= 3; round++) {
  const sheets = await agent(`${CTX}
Build whole-character blind A/B sheets (shuffled, key.json) vs refs 07/08/09/04 at native grid from the integrated build: idle, N1 contact, Q stamp, back view at 144, and the same at 80 next to a world-scale ref crop. Output review/rosace/art/whole/round-${round}/. ${wcrit ? 'Before building sheets, apply these fixes to the canonical build: ' + JSON.stringify(wcrit).slice(0, 7000) : ''}`, { label: `whole:sheets:r${round}`, phase: 'Whole', schema: DOC, effort: 'high' })
  const rv = await parallel(LENSES.map(c => () => agent(`${CTX}
Independent critic. Lens: ${c.l} Sheets in review/rosace/art/whole/round-${round}/; verdicts before key.json. Per param winner/gap/fix, score /10, prefers ours?, top fixes.`, { label: `whole:${c.k}:r${round}`, phase: 'Whole', schema: CRIT, effort: 'high' })))
  const ok = rv.filter(Boolean)
  const avg = ok.length ? ok.reduce((s, c) => s + c.score, 0) / ok.length : 0
  const prefer = ok.filter(c => c.prefersOurs !== 'no').length
  whole.push({ round, avg, scores: ok.map(c => c.score), prefer })
  log(`whole r${round}: avg ${avg.toFixed(1)} (${ok.map(c => c.score).join('/')}), ${prefer}/${ok.length} prefer or cannot choose`)
  if (avg >= 7.5 && prefer * 2 >= ok.length) break
  if (whole.length >= 2 && whole[whole.length - 1].avg <= whole[whole.length - 2].avg + 0.2) { log('whole: plateau, stopping to report'); break }
  wcrit = ok.map(c => ({ score: c.score, lost: c.params.filter(x => x.winner === 'ref'), topFixes: c.topFixes }))
}
return { parts: parts.filter(Boolean).map(p => ({ key: p.key, hist: p.hist })), integ, whole }
