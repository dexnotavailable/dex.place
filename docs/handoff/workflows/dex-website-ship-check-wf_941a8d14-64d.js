export const meta = {
  name: 'dex-website-ship-check',
  description: 'Tablet image cap for the dark pixel website, then an independent full verification before it goes live',
  phases: [ { title: 'Tablet cap' }, { title: 'Verify' }, { title: 'Fix' } ],
}
const CTX = `
Repo D:\\Dex\\Projects\\dex.place (public; main is live; do NOT commit or push; the driver commits). The dark pixel website rework lives in src/site/**, content/**, docs/site/**, public/fonts, package.json (fonts). It has passed visual 8.5, interaction 8.6 and UX 8.5 critics. Tech round 5 fixed every blocker: /gallery/ and /#gallery LCP about 2.1 s on Slow 4G + 4x CPU at 390x844 DPR3; zero view-transition errors in 150 navigations per engine. Its scripts and logs are in review/site/dark/fix-tech-r5/ (Playwright: D:/Dex/Temp/dexplace-site-research/node_modules/playwright-core, PLAYWRIGHT_BROWSERS_PATH=D:/Dex/Temp/ms-playwright; Edge is installed, Chrome is not). Don't touch src/world, src/pixel, src/scenes, src/lab, tools, art, vite.config.ts. Use ports 23000-23999 and stop your servers. Never run bare "msedge.exe --version" (it opens a window).
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } } }, required: ['summary', 'files', 'checks'] }
const VER = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, score: { type: 'number' }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'score', 'blocking', 'notes'] }

phase('Tablet cap')
const cap = await agent(`${CTX}
Driver's taste call: on a 768x1024 tablet on Slow 4G, /gallery/ takes 13-15 s to its largest paint because tablets pull the 960/1280 px copies. Cap the image choice for tablet widths (roughly 600-1100 CSS px): through sizes/srcset and the lead-tile budget, make a tablet pick copies at about 1.5x its density at most, the way the phone lead tiles already share a 200 KB budget. Keep phones and desktop as they are, or better. Art must stay crisp: take a 2x screenshot of a tablet tile and look at it. Target: /gallery/ and /#gallery LCP at or under 2.5 s at 768x1024 DPR2 and 820x1180 DPR2 on Slow 4G + 4x CPU, read 12-15 s after load. Re-check the phone numbers so they don't regress. Update tests and docs/site/DESIGN-SYSTEM.md.
An earlier attempt at this exact task got far (132 steps) before the old account hit its usage limit. Read D:/Dex/Projects/dex.place/review/resume/wf_941a8d14-tablet-cap.md first and continue from its edits instead of starting over.`, { label: 'tablet-cap', phase: 'Tablet cap', schema: DOC, effort: 'high' })

phase('Verify')
let v = await agent(`${CTX}
Independent release verifier: this is the last gate before the site goes live, so be strict. Don't edit source. Tablet-cap report: ${JSON.stringify(cap).slice(0, 2500)}
Build it yourself (npx vite build) and run npm test. Then on the built site:
- LCP on Slow 4G + 4x CPU, read 12-15 s after load, 3 runs each, for / , /#gallery, /gallery/ , /gallery/05/ , /downloads/ , /docs/ and /#donate at 390x844 DPR3 (Samsung UA), 768x1024 DPR2 and 1440x900.
- 50 rapid navigations, 2 seeds each, in Edge, Chromium and WebKit, with zero uncaught errors.
- axe WCAG AA on every route.
- The VietQR payloads decode: the default with no amount, plus 100k, 2.5M and 10M.
- A crawl for 404s and external requests; the dexClient 0.4.6 download link resolves.
- Screenshots of landing, gallery, gallery hover, downloads, donate and docs at phone and desktop sizes. Look at them for anything broken or off-style.
Blocking means a failed budget on the phone profile, any uncaught error, an a11y serious or critical issue, a broken link or QR, or something visibly broken. Put the evidence in review/site/dark/verify-ship/.`, { label: 'verify', phase: 'Verify', schema: VER, effort: 'high' })

let fixes = []
for (let i = 1; i <= 2 && v && v.verdict === 'blocking'; i++) {
  phase('Fix')
  const f = await agent(`${CTX}\nFix these release blockers and re-check each one with fresh evidence: ${JSON.stringify(v.blocking).slice(0, 5000)}`, { label: `fix-${i}`, phase: 'Fix', schema: DOC, effort: 'high' })
  fixes.push(f)
  v = await agent(`${CTX}\nIndependent release verifier, re-check after fixes (don't edit source). The previous blockers were ${JSON.stringify(v.blocking).slice(0, 3000)}. The fix report: ${JSON.stringify(f).slice(0, 2500)}. Re-run npm test and a build, re-check every previous blocker, and spot-check phone LCP on /gallery/ and /#gallery, plus 50 Edge navigations. Evidence goes in review/site/dark/verify-ship/recheck-${i}/.`, { label: `reverify-${i}`, phase: 'Verify', schema: VER, effort: 'high' })
}
return { cap, verdict: v, fixes }
