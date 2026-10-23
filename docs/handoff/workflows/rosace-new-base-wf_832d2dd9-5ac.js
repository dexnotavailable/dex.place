export const meta = {
  name: 'rosace-new-base',
  description: 'Assemble Rosace base v2 (SiroinoSotai CC0 busty body + 射当ユウキ MMD female base head), rig/physics/weights, refit hair/outfit/glaive, blind A/B vs current base at 144 and 80 px, adopt if it wins',
  phases: [
    { title: 'Assemble', detail: 'body + head + unified rig + proportion sheet + spring bones' },
    { title: 'Refit', detail: 'Rosace hair, outfit, glaive, materials onto the new body; stills' },
    { title: 'Compare', detail: 'blind A/B critics vs current base and refs' },
    { title: 'Adopt', detail: 'make it canonical if it wins; docs' },
  ],
}
const CTX = `
Project: dex.place player character "Rosace" (docs/character/DESIGN.md, PIPELINE.md, ART-RULES.md if present, CRITIQUE-PARAMS.md; refs in D:\\Dex\\Projects\\dex.place\\review\\refs\\character\\). Repo D:\\Dex\\Projects\\dex.place (public; no commits/pushes).
Dex's decision: "take the busty SiroinoSotai body, then swap in the head from the MMD女性素体." Sources, already extracted:
- BODY: D:\\Dex\\Projects\\dex-place-art\\rosace\\bases\\siroino\\SiroinoSotai_1.0\\ (SiroinoSotai.blend, FBX, TEX/). Licence: CC0 1.0 (BOOTH 8268676) — free for any use, no credit needed; do NOT call our work 「公式」「公認」「認定」「監修」「共同開発」, do NOT use the SiroinoSotai logo. Has 27 body-shape keys (Slim / Default / Large variants), Unity Humanoid rig, clean quads (~16.7k tris), no head, no physics.
- HEAD: D:\\Dex\\Projects\\dex-place-art\\rosace\\bases\\primero\\MMD用女性素体\\mmdBodyWoman.blend by 射当ユウキ (readme 00_ReadMe.txt): only forbids misrepresenting authorship, demeaning use and illegal use; allows commercial and non-commercial use, modification and new works, use outside MMD; credit optional. MMD bone naming.
Record both in D:\\Dex\\Projects\\dex.place\\tools\\pixel-pipeline\\THIRD_PARTY.md (licence quotes, sha256, local paths) and add a credits line to docs/character/DESIGN.md: "Base body: SiroinoSotai by しろいの (CC0) · Head base: MMD用女性素体 by 射当ユウキ".
Current base for comparison: D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\rosace.blend (READ-ONLY; build the new one as rosace_v2.blend next to it; never overwrite rosace.blend unless the Adopt step says so). Build reproducibly from scripts in tools/pixel-pipeline/ (e.g. build_rosace_v2.py + helpers), using the isolated Blender env (tools/pixel-pipeline/blender.ps1; MMD Tools is installed there). Absolute paths for all renders; one Blender process at a time. Existing tooling to reuse: tools/pixel-pipeline/base_search.py (measure/renders), render and post-process scripts, tools/motion-ai (retarget, hero poses in art/rosace/poses/motion/). Scale: player H = 80 px in the world, 144 px close-up render (both must look good). No image generation. Other lanes are running (art-construct 2D face/figure; world build; website) — don't touch their paths (tools/art-construct, art/rosace/construct, src/**, docs/world/**, docs/props/**).
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, measurements: { type: 'string' }, media: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'media'] }
phase('Assemble')
const asm = await agent(`${CTX}
Assemble the v2 base:
1. Import the SiroinoSotai body; choose the busty body-shape settings Dex wants ("the busty one") while keeping gacha-anime appeal (not grotesque): drive its Large bust/hip keys and waist so the result reads as an attractive stylised hourglass at 144 px and 80 px; record the key values.
2. Import the 射当ユウキ head, scale it to the proportion target (~6-6.3 heads total; DESIGN.md head size), fit it onto the neck, weld/blend the neck seam cleanly (matching normals so toon shading doesn't show a seam), and parent/weight it to the head/neck bones.
3. Unify one armature: keep a humanoid skeleton that maps to the bone names the motion retarget and pixel pipeline expect (see tools/motion-ai retarget mapping and PIPELINE.md); add IK controls like the current rig (hands to glaive grip sockets, feet).
4. Physics: add spring/jiggle chains (breasts L/R, glutes, subtle thigh) with damping and stiffness tuned for anime bounce that settles (reuse the motion lane's damped-spring approach), plus the existing hair/sleeve/tabard/veil chains once the outfit is refit.
5. Weights: check deformation in the extreme hero poses from art/rosace/poses/motion/ (coil, lunge, kneel) and the stills poses; fix candy-wrapping, collapsing shoulders/hips.
6. Measure with base_search.py (head units + px at 144 and 80) and render the bare base hi-res and at 144/80 px next to the current base, into review/rosace/base-v2/assemble/. Look at the renders.`, { label: 'assemble', phase: 'Assemble', schema: DOC, effort: 'high' })
phase('Refit')
const refit = await agent(`${CTX}
Assembly report: ${JSON.stringify(asm).slice(0, 4000)}
Refit Rosace onto the v2 base (in rosace_v2.blend, built by script): hair clumps and veil, the whole outfit per the current DESIGN.md (including its latest design fixes: bright confident eyes spec, dark thigh-highs, collar cross, real hands and grip, the thong-cut back), the glaive and grip sockets, materials and palette ramps; transfer/redo weights; hook the cloth/hair chains to the new rig. Render the same stills set as the old stills loop (idle hero, N1 contact, Q stamp, back view) at 144 px AND 80 px through the pixel pipeline with the current face library/overrides where they still fit (note what no longer fits), plus one N1 motion clip retargeted with the existing motion tools (round-3 timing sheet) to prove deformation in motion. Output to review/rosace/base-v2/refit/. Look at everything.`, { label: 'refit', phase: 'Refit', schema: DOC, effort: 'high' })
phase('Compare')
const sheet = await agent(`${CTX}
Build blind A/B sheets (shuffled per sheet, key.json) in review/rosace/base-v2/compare/: v2 base vs current base with the SAME outfit, poses and render settings, at 144 px and at 80 px, for idle, N1 contact, back view, and a strip of the N1 motion; plus v2 vs refs 07/09 at 144. Report the sheet paths.`, { label: 'compare:sheets', phase: 'Compare', schema: DOC, effort: 'high' })
const CRIT = { type: 'object', properties: { winnerByParam: { type: 'array', items: { type: 'object', properties: { param: { type: 'string' }, winner: { type: 'string' }, why: { type: 'string' } }, required: ['param', 'winner', 'why'] } }, overallWinner: { type: 'string' }, v2Score: { type: 'number' }, oldScore: { type: 'number' }, topFixes: { type: 'array', items: { type: 'string' } } }, required: ['winnerByParam', 'overallWinner', 'v2Score', 'oldScore', 'topFixes'] }
const crits = await parallel([
  'BODY AND APPEAL: proportions, hourglass and bust in theme, leg length, silhouette, posing read, genuine attractiveness, sex appeal in theme (CRITIQUE-PARAMS 3, 5, 9-12).',
  'CRAFT AND DEFORMATION: how the body shades as pixel art, seams (neck), deformation in the extreme poses and in the motion strip, readability at 80 px vs 144 px (CRITIQUE-PARAMS 14-16, 19-25).',
].map((lens, i) => () => agent(`${CTX}
Independent critic. Lens: ${lens}
Sheets: ${JSON.stringify(sheet).slice(0, 2500)}. Open every sheet in review/rosace/base-v2/compare/; write verdicts before opening key.json; then map A/B to v2/old. Per param winner and why; overall winner; scores /10 for v2 and old (refs = 9); top fixes for v2.`, { label: `critic:${i + 1}`, phase: 'Compare', schema: CRIT, effort: 'high' })))
const ok = crits.filter(Boolean)
const v2wins = ok.filter(c => /v2|new/i.test(c.overallWinner)).length
log(`v2 preferred by ${v2wins}/${ok.length} critics; scores v2 ${ok.map(c => c.v2Score).join('/')} vs old ${ok.map(c => c.oldScore).join('/')}`)
phase('Adopt')
let adopt = null
if (v2wins * 2 >= ok.length && ok.length) {
  adopt = await agent(`${CTX}
The v2 base won the blind comparison (${JSON.stringify(ok).slice(0, 5000)}). Apply the critics' top fixes that are cheap, then make v2 canonical: the reproducible build scripts produce rosace.blend from the v2 sources (back up the old rosace.blend as rosace_v1.blend first), update docs/character/PIPELINE.md (model build step: base sources, proportion sheet values, spring bones, credits) and DESIGN.md numbers that changed, and re-render the stills set at 144/80 into review/rosace/base-v2/final/. Report.`, { label: 'adopt', phase: 'Adopt', schema: DOC, effort: 'high' })
}
return { asm, refit, sheet, crits: ok, v2wins, adopt }
