export const meta = {
  name: 'world-build-phase2-continue',
  description: 'Continue world phase 2 after the usage-limit failures: R-A critic, R-B/R-D/S1 builds (from their partial work), R-E fix, then I1 integration; finished lanes are not rerun',
  phases: [
    { title: 'Regions', detail: 'R-A critic+fix, R-B, R-D, S1 build+critic+fix, R-E fix' },
    { title: 'Integration', detail: 'I1 story, residents, ending, full-round playtest' },
  ],
}
const CTX = `
Project: dex.place world (repo D:\\Dex\\Projects\\dex.place, public; main is live; do NOT commit/push; the coordinator integrates). READ FIRST: docs/world/WORLD-PLAN.md (the final plan; section 13 defines every lane, what it owns, builds, its interactions and acceptance checks; section 14 lists the defaults applied for Dex's open questions), docs/world/RUNTIME.md (the existing runtime in src/world/), docs/props/ENGINE.md + PIXEL-MATTER.md (the pixel-matter engine in src/pixel/), docs/world/SCENES.md (scene engine in src/scenes/), CANON.md, AGENTS.md. Locked scale: 1280x720 view, player H = 80 px (src/scenes/engine/scale.ts is the single source), sharp-bilinear presentation.
Dex's goal: "the whole world done except mobs and bosses; good flow, good storytelling, grand in places yet cozy in others, vast then indoors, serene then storm; cohesive, alive, looks good; all props in." World refs (third-party; look, never commit): review/refs/world/.
HARD RULES: no image generation; props are pixel matter (recipes, not image files); Dex's art only as gallery display per section 14 default 3; real content only (downloads, docs, gallery from the site's content/ and public/); no fake sessions/donations/products. Each lane owns ONLY its section-13 paths; foundation lanes provide auto-discovery (import.meta.glob or equivalent) so region lanes never edit shared registries. Don't edit vite.config.ts, src/site/**, src/lab/**, tools/pixel-pipeline/**, art/**, docs/character/**. Ports 24000-24999 (give each lane its own 100-port block by lane order). Verify with Playwright at 1080p (1.5x sharp) and 1440p (2x) and a phone viewport; look at your own screenshots/GIFs before reporting; evidence under review/world/phase2/<lane>/. Update docs/world/RUNTIME.md / ENGINE.md / WORLD-PLAN.md status for what you prove.
Known fix to include in R-A: the arrival colossus's rear leg is sliced by a hard vertical line for ~35 s of each 115 s pass (body-space EXTENT clip in the arrival colossus shader) — fix it, and settle the dock deck at the plan's 0.8 view anchor vs the scene's 0.91 by looking at both.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } }, media: { type: 'array', items: { type: 'string' } }, openIssues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'checks'] }
const CRIT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, score: { type: 'number' }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'score', 'blocking', 'notes'] }
const STATE = 'D:/Dex/Projects/dex.place/review/resume/world-phase2-state.json'
const DONE = `Already finished in the stopped run (reports in ${STATE}, keyed like "W0:build", "R-C:critic"): W0 foundation (critic 6.5, blockers fixed), P0 pixel kit (critic 7.5, blocker fixed), R-A Ringwater built, R-C Hollow (critic 8, pass-with-notes), R-E Chapel built (critic 6.5, one blocker).`
const RES = (name) => `\nAn earlier attempt at this exact step died when the old account hit its weekly usage limit (not a failure of the work). Read D:/Dex/Projects/dex.place/review/resume/${name}.md first: it lists the files that attempt changed and its last steps. Continue from that work instead of starting over, and watch for half-finished edits.`

const LENS = {
  'R-A': 'First frame per section 4 A1 (nothing interactive in view, red line visible), the hybrid colossus reflection, lodge warmth, account panel shows only real session state, map shows real flags, the ending with round:done. Cozy vs vast contrast.',
  'R-B': 'Wading colossus and sheet-water flats, footfall ripples and reeds, flash- and motion-safe shake, the Stonetop pass fills half the frame, the causeway ~32 s with something new every screen; grand scale.',
  'R-D': 'Storm and gusts telegraphed >= 1 s, never pushing the player off; lightning inside the flash gate; terminal flow with only real products and no faked fight/download; the Blade reveal; serene-to-storm drama.',
  'R-E': 'Art only from content/gallery/manifest.json + public/gallery/, displayed at quality in DOM, never pixelated/lit/textured; frames ignore hits; nothing fractures in the nave; the latch/bell/loft link; after-storm calm and emotion.',
  'S1': 'No abrupt starts (every entry swells), rooms that belong together keep one playhead, archive silent, storm per default 8; note that only Dex\u2019s ears can approve.',
}
const BRIEF = {
  'R-B': 'Shore and Plain (B1-B5).',
  'R-D': 'Spire (D1-D4) with the storm.',
  'S1': 'Sound: move chosen audio from legacy/ into public/audio/world/ (respect each file\u2019s ATTRIBUTION.md), switch AUDIO_BASE, music state machine content, beds, SFX, footsteps per surface.',
}
const build = (key, digest) => agent(`${CTX}\n${DONE}\nYou are lane ${key}. Do exactly what WORLD-PLAN.md section 13 says for ${key}, plus: ${BRIEF[key]}\nMeet every acceptance check in section 13 for your lane and the common checks.${RES(digest)}`, { label: `${key}:build`, phase: 'Regions', schema: DOC, effort: 'high' })
const critic = (key, reportRef, digest) => agent(`${CTX}\nIndependent critic for lane ${key}. ${LENS[key]} Also check every section-13 acceptance item for ${key}. Lane report: ${reportRef}. Capture your own evidence into review/world/phase2/critic-${key}/ and look at it. Blocking = an acceptance item fails, it looks off-style or dead, or it breaks the runtime.${digest ? RES(digest) : ''}`, { label: `${key}:critic`, phase: 'Regions', schema: CRIT, effort: 'high' })
const fix = (key, reviewRef, digest) => agent(`${CTX}\nFix lane ${key} (its own paths only) per this critique and re-verify with fresh evidence: ${reviewRef}${digest ? RES(digest) : ''}`, { label: `${key}:fix`, phase: 'Regions', schema: DOC, effort: 'high' })
const needsFix = (r) => r && (r.verdict === 'blocking' || r.score < 7)

phase('Regions')
const chains = await parallel([
  async () => {
    const rv = await critic('R-A', `the "R-A:build" entry in ${STATE}`, 'wf_8dbb7c86-R-A-critic')
    const fx = needsFix(rv) ? await fix('R-A', JSON.stringify(rv).slice(0, 6000)) : null
    return { key: 'R-A', review: rv, fixed: fx }
  },
  ...['R-B', 'R-D', 'S1'].map(key => async () => {
    const b = await build(key, `wf_8dbb7c86-${key}-build`)
    if (!b) return { key, built: null }
    const rv = await critic(key, JSON.stringify(b).slice(0, 3500))
    const fx = needsFix(rv) ? await fix(key, JSON.stringify(rv).slice(0, 6000)) : null
    return { key, built: b, review: rv, fixed: fx }
  }),
  async () => {
    const fx = await fix('R-E', `the "R-E:critic" entry in ${STATE}`, 'wf_8dbb7c86-R-E-fix')
    return { key: 'R-E', fixed: fx }
  },
])
const ok = chains.filter(Boolean)
log(`regions: ${ok.map(c => c.key + ':' + (c.review ? c.review.score + ' ' + c.review.verdict : (c.fixed ? 'fixed' : 'n/a'))).join(', ')}`)

phase('Integration')
const I1B = 'Integrate all regions into one continuous round from the dock back to the lodge; residents and the keeper arc; distant lamps keyed to the save; the evening state; all shortcuts; a recorded full first-round playtest (GIF/MP4 of key beats) and a pacing check vs section 10; mark real-device checks as pending for Dex.'
const i1 = await agent(`${CTX}\n${DONE}\nThis run's region results: ${JSON.stringify(ok.map(c => ({ key: c.key, review: c.review && { verdict: c.review.verdict, score: c.review.score, blocking: c.review.blocking }, fixed: c.fixed && c.fixed.summary && c.fixed.summary.slice(0, 600), built: c.built && c.built.summary && c.built.summary.slice(0, 600) })))}\nYou are lane I1. Do exactly what WORLD-PLAN.md section 13 says for I1, plus: ${I1B}\nMeet every acceptance check in section 13 for your lane and the common checks.`, { label: 'I1:build', phase: 'Integration', schema: DOC, effort: 'high' })
const i1r = i1 ? await agent(`${CTX}\nIndependent critic for lane I1. Play the whole round: flow, storytelling beats felt, grand vs cozy, vast then indoors, serene then storm then after-storm, cohesion (does it all look like one world), aliveness, readability of the 80 px player everywhere, performance per region, zero console errors, touch. Also check every section-13 acceptance item for I1. Lane report: ${JSON.stringify(i1).slice(0, 3500)}. Capture your own evidence into review/world/phase2/critic-I1/ and look at it. Blocking = an acceptance item fails, it looks off-style or dead, or it breaks the runtime.`, { label: 'I1:critic', phase: 'Integration', schema: CRIT, effort: 'high' }) : null
const i1f = needsFix(i1r) ? await agent(`${CTX}\nFix lane I1 per this critique (touch other lanes' paths only where integration requires it, and say so) and re-verify with fresh evidence: ${JSON.stringify(i1r).slice(0, 6000)}`, { label: 'I1:fix', phase: 'Integration', schema: DOC, effort: 'high' }) : null
return { regions: ok.map(c => ({ key: c.key, review: c.review && { verdict: c.review.verdict, score: c.review.score }, fixed: !!c.fixed, built: !!c.built })), i1: i1 && i1.summary, i1Review: i1r, i1Fixed: i1f && i1f.summary }
