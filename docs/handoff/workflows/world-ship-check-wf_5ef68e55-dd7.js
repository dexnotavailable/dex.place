export const meta = {
  name: 'world-ship-check',
  description: 'Fix the cross-lane issues World I1 found, re-verify the unverified region fixes, then an independent release check before the world goes live',
  phases: [ { title: 'Fix' }, { title: 'Verify' }, { title: 'Refix' } ],
}
const CTX = `
Project: dex.place world (repo D:\\Dex\\Projects\\dex.place, public; main is live; do NOT commit or push; the driver commits). Read docs/world/WORLD-PLAN.md (section 13 lanes and acceptance checks; the I1 status block), docs/world/RUNTIME.md (incl. "The round, integrated"), docs/props/ENGINE.md, CANON.md, AGENTS.md. Locked scale: 1280x720 view, player H = 80 px. Phase 2 is complete and integrated: every region lane built, I1 played the whole round (531 s, every story beat, 0 errors) and its critic passed it at 8 with notes. Evidence is in review/world/phase2/. Lane reports are in review/resume/world-phase2-state.json (earlier lanes) and the I1 report in docs/world/RUNTIME.md.
HARD RULES: no image generation; real content only; don't edit vite.config.ts, src/site/**, src/lab/**, tools/pixel-pipeline/**, art/**, docs/character/**. Ports 25000-25999. Verify with Playwright at 1080p (1.5x sharp), 1440p (2x) and a phone viewport; look at your own screenshots before reporting. The website at src/site is already live and must stay untouched and working.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } } }, required: ['summary', 'files', 'checks'] }
const VER = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, score: { type: 'number' }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'score', 'blocking', 'notes'] }

phase('Fix')
const fix = await agent(`${CTX}
Task: fix the cross-lane problems the I1 integration found. You may now touch any src/world, src/pixel, src/scenes or public/audio/world path that each fix needs (say which lane owned it):
1. S1's sound patch to shared world files is still unapplied. Find it (S1's report and files in review/world/phase2/S1/ and public/audio/world/) and apply it so the music state machine plays S1's content, beds, SFX and footsteps per surface.
2. Storm lightning flashes the player sprite in the storm rooms; the player must stay readable (lightning lights the world, not a white-out of the character).
3. The summon close-up hides the floor seals.
4. The archive bays in the Hollow can't open their own product's docs; link each to the real doc page.
5. R-D: the lift ride's music never opens up; the storm's sound doesn't cut off on the Blade; only one lit lamp shows from the Blade's tip (all lit shrines should show).
6. Every world load logs 404s for /world/character/manifest.json and /world/character-closeup/manifest.json from the optional sprite probe (src/world/player/setup.ts); make the probe quiet when there is no manifest.
7. She stands on benches instead of sitting: give the stand-in player a seated pose on benches.
8. W0's story interface can't rebuild a room or set the start place, so I1 and R-A reach in through the page's world handle; add those two calls to the story API and switch both callers to it.
Re-play the whole round afterwards (the round tool) with 0 errors, NOT filtering 404s, and re-check each fix with fresh evidence in review/world/phase2/ship-fix/.`, { label: 'cross-lane-fix', phase: 'Fix', schema: DOC, effort: 'high' })

phase('Verify')
const verifyAll = async (tag, extra) => parallel([
  () => agent(`${CTX}
Independent critic (don't edit source). Re-verify the region fixes that were never re-checked plus the cross-lane fixes. ${extra}
- R-B Shore and Plain: the wading colossus and sheet-water flats, footfall ripples and reeds, flash- and motion-safe shake, the Stonetop pass fills half the frame, the causeway about 32 s with something new every screen, grand scale.
- R-D Spire: storm and gusts telegraphed at least 1 s ahead, never pushing the player off; lightning inside the flash gate; the terminal flow with only real products and no faked fight or download; the Blade reveal; the serene-to-storm drama.
- S1 Sound: no abrupt starts (every entry swells), rooms that belong together keep one playhead, the archive silent, storm per default 8.
- R-E Chapel's fix from its blocking critique (see the R-E:critic entry in review/resume/world-phase2-state.json).
Capture your own evidence into review/world/phase2/ship-verify-${tag}/regions/ and look at it. Blocking = an acceptance item fails, it looks off-style or dead, or it breaks the runtime.`, { label: `verify-regions-${tag}`, phase: 'Verify', schema: VER, effort: 'high' }),
  () => agent(`${CTX}
Independent RELEASE verifier: the last gate before the world goes live, so be strict (don't edit source). ${extra}
- Build it yourself: npx vite build, npm test, npm run check (tsc).
- Replay the whole round with the round tool, without filtering 404s or console errors, and confirm every section-2 story beat, the save flags across a reload, the four shortcuts, and the website scroll-away from every room.
- Frame cost per room.
- The phone viewport with real CDP touch events.
- The flash budget.
- A crawl of /world/ assets for 404s and external requests.
- Every audio file under public/audio/world has a licence and attribution entry that allows redistribution in a public repo. Report the total size added to the repo.
- The website (/, /gallery/, /donate/, /downloads/, /docs/) still builds, and its npm tests still pass.
- Look at screenshots of each region at 1080p and on a phone for anything broken or off-style.
Blocking = any uncaught error or 404, a story beat that does not fire, a save or shortcut failure, a licence gap, a visible break, or a website regression. Evidence goes in review/world/phase2/ship-verify-${tag}/release/.`, { label: `verify-release-${tag}`, phase: 'Verify', schema: VER, effort: 'high' }),
])
let vs = await verifyAll('1', `Fix report: ${JSON.stringify(fix).slice(0, 3000)}`)
const blocking = (arr) => arr.filter(Boolean).flatMap(v => v.verdict === 'blocking' ? v.blocking : [])
let refixes = []
for (let i = 1; i <= 2 && blocking(vs).length; i++) {
  phase('Refix')
  const f = await agent(`${CTX}\nFix these release blockers (any world path) and re-check each with fresh evidence in review/world/phase2/ship-refix-${i}/: ${JSON.stringify(blocking(vs)).slice(0, 6000)}`, { label: `refix-${i}`, phase: 'Refix', schema: DOC, effort: 'high' })
  refixes.push(f)
  vs = await verifyAll(String(i + 1), `This is a re-check after refix ${i}. Previous blockers: ${JSON.stringify(blocking(vs)).slice(0, 2500)}. Refix report: ${JSON.stringify(f).slice(0, 2500)}`)
}
return { fix: fix && fix.summary, verdicts: vs.map(v => v && { verdict: v.verdict, score: v.score, blocking: v.blocking, notes: v.notes.slice(0, 6) }), refixes: refixes.map(f => f && f.summary) }
