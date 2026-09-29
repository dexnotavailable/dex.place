export const meta = {
  name: 'world-build-phase2',
  description: 'World build phase 2 per WORLD-PLAN section 13: W0 runtime+grey-box and P0 pixel kit first, then region lanes R-A..R-E and S1 sound in parallel, then I1 story/integration — each with critics and a fix round',
  phases: [
    { title: 'Foundation', detail: 'W0 runtime + 21-room grey-box, P0 pixel engine + shared kit' },
    { title: 'Regions', detail: 'R-A Ringwater, R-B Shore and Plain, R-C Hollow, R-D Spire, R-E Chapel, S1 Sound' },
    { title: 'Integration', detail: 'I1 story, residents, ending, full-round playtest' },
    { title: 'Review', detail: 'critic per lane + fix round' },
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

async function lane(key, phaseName, brief, criticLens) {
  const built = await agent(`${CTX}\nYou are lane ${key}. Do exactly what WORLD-PLAN.md section 13 says for ${key}, plus: ${brief}\nMeet every acceptance check in section 13 for your lane and the common checks.`, { label: `${key}:build`, phase: phaseName, schema: DOC, effort: 'high' })
  if (!built) return { key, built: null }
  const review = await agent(`${CTX}\nIndependent critic for lane ${key}. ${criticLens} Also check every section-13 acceptance item for ${key}. Lane report: ${JSON.stringify(built).slice(0, 3500)}. Capture your own evidence into review/world/phase2/critic-${key}/ and look at it. Blocking = an acceptance item fails, it looks off-style or dead, or it breaks the runtime.${key === 'W0' ? '\n\nRESUME NOTE: this step was stopped cleanly on 2026-09-29 at 13:30 for an account switch. The progress of the stopped attempt (files it made, last steps) is in D:/Dex/Projects/dex.place/review/resume/world-W0-critic.md. Read it first and continue from that work instead of redoing it.' : ''}`, { label: `${key}:critic`, phase: 'Review', schema: CRIT, effort: 'high' })
  if (!review || (review.verdict !== 'blocking' && review.score >= 7)) return { key, built, review }
  const fixed = await agent(`${CTX}\nFix lane ${key} (its own paths only) per this critique and re-verify with fresh evidence: ${JSON.stringify(review).slice(0, 6000)}${key === 'P0' ? '\n\nRESUME NOTE: this step was stopped cleanly on 2026-09-29 at 13:30 for an account switch. The progress of the stopped attempt (files it made, last steps) is in D:/Dex/Projects/dex.place/review/resume/world-P0-fix.md. Read it first and continue from that work instead of redoing it.' : ''}`, { label: `${key}:fix`, phase: 'Review', schema: DOC, effort: 'high' })
  return { key, built, review, fixed }
}

phase('Foundation')
const foundation = await parallel([
  () => lane('W0', 'Foundation', 'Also provide auto-discovery for region rooms (src/world/rooms/<region>/*) and story/sound hooks so region lanes never edit src/world/main.ts. The grey-box must make the whole round walkable end to end.', 'Walk the whole grey-box round via Playwright; measure travel times vs section 6; all shortcuts persist across reload; website scroll-away works from every room; camera modes; no blur; 60 fps.'),
  () => lane('P0', 'Foundation', 'First fold src/pixel/scale.ts into the single scale source. Provide auto-discovery for region recipe folders (src/pixel/props/<region>/*) so region lanes never edit src/pixel/props/index.ts. Build the whole shared kit listed in section 13.', 'Open /props/ and exercise every kit prop through all states and hit shapes at game size: readability, style match with the character pipeline, motion, reason to exist, undisturbed props cost nothing, particle caps hold, breakage policy enforced.'),
])
log(`foundation: ${foundation.map(f => f && f.key + ':' + (f.review ? f.review.score : 'n/a')).join(', ')}`)

phase('Regions')
const regions = await parallel([
  () => lane('R-A', 'Regions', 'Ringwater (A0-A4) including the arrival fix above.', 'First frame per section 4 A1 (nothing interactive in view, red line visible), the hybrid colossus reflection, lodge warmth, account panel shows only real session state, map shows real flags, the ending with round:done. Cozy vs vast contrast.'),
  () => lane('R-B', 'Regions', 'Shore and Plain (B1-B5).', 'Wading colossus and sheet-water flats, footfall ripples and reeds, flash- and motion-safe shake, the Stonetop pass fills half the frame, the causeway ~32 s with something new every screen; grand scale.'),
  () => lane('R-C', 'Regions', 'Hollow (C1-C3).', 'Warm lived-in amber city, the archive behind an ordinary door with real readable docs, music silent in the archive within 4 s, dust in time with footfalls; cozy contrast after the plain.'),
  () => lane('R-D', 'Regions', 'Spire (D1-D4) with the storm.', 'Storm and gusts telegraphed >= 1 s, never pushing the player off; lightning inside the flash gate; terminal flow with only real products and no faked fight/download; the Blade reveal; serene-to-storm drama.'),
  () => lane('R-E', 'Regions', 'Chapel (E1-E4) with the gallery per section 14 default 3.', 'Art only from content/gallery/manifest.json + public/gallery/, displayed at quality in DOM, never pixelated/lit/textured; frames ignore hits; nothing fractures in the nave; the latch/bell/loft link; after-storm calm and emotion.'),
  () => lane('S1', 'Regions', 'Sound: move chosen audio from legacy/ into public/audio/world/ (respect each file\u2019s ATTRIBUTION.md), switch AUDIO_BASE, music state machine content, beds, SFX, footsteps per surface.', 'No abrupt starts (every entry swells), rooms that belong together keep one playhead, archive silent, storm per default 8; note that only Dex\u2019s ears can approve.'),
])
log(`regions: ${regions.map(r => r && r.key + ':' + (r.review ? r.review.score : 'n/a')).join(', ')}`)

phase('Integration')
const i1 = await lane('I1', 'Integration', 'Integrate all regions into one continuous round from the dock back to the lodge; residents and the keeper arc; distant lamps keyed to the save; the evening state; all shortcuts; a recorded full first-round playtest (GIF/MP4 of key beats) and a pacing check vs section 10; mark real-device checks as pending for Dex.', 'Play the whole round: flow, storytelling beats felt, grand vs cozy, vast then indoors, serene then storm then after-storm, cohesion (does it all look like one world), aliveness, readability of the 80 px player everywhere, performance per region, zero console errors, touch.')
return { foundation, regions, i1 }
