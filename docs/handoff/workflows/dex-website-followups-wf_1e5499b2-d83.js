export const meta = {
  name: 'dex-website-followups',
  description: 'Website follow-ups after going live: piece-page image caps for tablet and desktop, desktop gallery LCP, a11y on docs code blocks, a 560 px gallery copy for tablet margin; then an independent re-verify',
  phases: [ { title: 'Fix' }, { title: 'Verify' }, { title: 'Refix' } ],
}
const CTX = `
Repo D:\\Dex\\Projects\\dex.place (public; main is LIVE at https://dex.place via the PC deploy puller; do NOT commit or push; the driver commits). The dark pixel website (src/site/**, content/**, docs/site/**, public/gallery derived widths) went live as 4b8416e after a release check at 8.8 (evidence review/site/dark/verify-ship/, fix-tablet/). Playwright: D:/Dex/Temp/dexplace-site-research/node_modules/playwright-core with PLAYWRIGHT_BROWSERS_PATH=D:/Dex/Temp/ms-playwright; Edge is installed, Chrome is not; never run bare "msedge.exe --version". Don't touch src/world, src/pixel, src/scenes, src/lab, tools, art, vite.config.ts, public/audio. Ports 26000-26999; stop your servers. Measure LCP on Slow 4G + 4x CPU read 12-15 s after load. Gallery image copies are derived from Dex's originals by resizing only (the existing width pipeline); no image generation of any kind.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } } }, required: ['summary', 'files', 'checks'] }
const VER = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, score: { type: 'number' }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'score', 'blocking', 'notes'] }
phase('Fix')
const fix = await agent(`${CTX}
Fix these follow-ups from the release verifier:
1. The single-artwork pages (/gallery/NN/) have a phone cap (piecePhoneCap) but no tablet or desktop cap. /gallery/05/ takes 11.3 s on a 768 DPR2 tablet (it picks the 2048 px original, 1.8 MB) and 6.8 s at 1440. Give the piece pages tablet and desktop caps in the style of the collage's lead-tile budget, so LCP is at or under 2.5 s at 768/820 DPR2 and 1440x900, while the art still looks sharp at the size it is shown. Take 2x screenshots and look at them. Check all 9 pieces, not just 05.
2. Desktop 1440x900 /gallery/ is 2.52-2.56 s (LCP 02-640.webp); bring it under 2.5 s with margin.
3. Add a 560 px copy to the gallery width set (resize from the originals with the existing pipeline, same quality settings) if it gives tablets real margin under 2.5 s; update the manifest and srcsets.
4. Docs: <pre> code blocks carry aria-label with no role (axe aria-prohibited-attr). Fix it accessibly.
Re-measure phones too so nothing regresses, run npm test and both tsc checks, and put the evidence in review/site/dark/followups/.`, { label: 'followups', phase: 'Fix', schema: DOC, effort: 'high' })
phase('Verify')
let v = await agent(`${CTX}
Independent release verifier for a change to the LIVE site (don't edit source). Fix report: ${JSON.stringify(fix).slice(0, 3000)}
Build it yourself; run npm test and tsc. Measure LCP (3 runs each) on /gallery/01/ through /gallery/09/, /gallery/, /#gallery and / at 390x844 DPR3 (Samsung UA), 768x1024 DPR2, 820x1180 DPR2 and 1440x900. Run axe WCAG AA on all routes, 50 Edge navigations, and a crawl for 404s. Look at 2x screenshots of the piece pages for sharpness. Confirm the VietQR payloads are unchanged. Blocking means any phone or tablet budget miss, any regression versus the live site, an error, an a11y violation, or visibly soft art. Evidence goes in review/site/dark/followups-verify/.`, { label: 'verify', phase: 'Verify', schema: VER, effort: 'high' })
let refix = null
if (v && v.verdict === 'blocking') {
  phase('Refix')
  refix = await agent(`${CTX}\nFix these blockers and re-check each with fresh evidence: ${JSON.stringify(v.blocking).slice(0, 5000)}`, { label: 'refix', phase: 'Refix', schema: DOC, effort: 'high' })
  v = await agent(`${CTX}\nIndependent re-verify (don't edit source). Previous blockers: ${JSON.stringify(v.blocking).slice(0, 2500)}. Refix: ${JSON.stringify(refix).slice(0, 2500)}. Re-check each blocker, then run npm test, phone and tablet LCP on the piece pages and /gallery/, and 50 Edge navigations.`, { label: 'reverify', phase: 'Verify', schema: VER, effort: 'high' })
}
return { fix: fix && fix.summary, verdict: v, refix: refix && refix.summary }
