export const meta = {
  name: 'dex-website-dark-final',
  description: 'Fix the last 2 tech blockers of the dark pixel website (gallery deep-link LCP, Edge view-transition error) and re-verify before it goes live',
  phases: [ { title: 'Fix' }, { title: 'Verify' } ],
}
const CTX = `
Repo D:\\Dex\\Projects\\dex.place (public; main is live; do NOT commit/push). The dark pixel website rework (src/site/**, content/**, docs/site/**) passed visual 8.5, interaction 8.6, UX 8.5; the tech critic still blocks on two issues:
1. Following a Gallery nav link to /#gallery on a throttled connection misses the LCP target (every Gallery link on docs, blog and project pages points to /#gallery; the home gallery images are deferred, so when the page opens scrolled to #gallery the largest paint waits). Fix so a direct or deep-linked arrival at #gallery (and any section anchor) prioritises that section's first visible images (eager + fetchpriority for the images in view on arrival, correct sizes), without regressing the plain home load budget; target LCP <= 2.5 s on Slow 4G + 4x CPU at 390x844 DPR3.
2. Page-to-page navigation in Edge sometimes throws an uncaught "Transition was aborted because of invalid state. ViewTransition opt-in disabled" error. Make view transitions robust: cross-document transitions via CSS @view-transition only where supported, JS-driven transitions guarded (feature-detect, catch/ignore aborted transitions, never block navigation), no uncaught errors in Edge, Chrome, Samsung-UA emulation or WebKit.
Don't touch src/world, src/pixel, src/scenes, src/lab, tools, art. Ports 23000-23999.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } } }, required: ['summary', 'files', 'checks'] }
phase('Fix')
const fix = await agent(`${CTX}\nFix both, then verify yourself (npx vite build of the site pages, npm test, throttled LCP for / , /#gallery and /#donate arrivals, 50 rapid page-to-page navigations in Edge and WebKit with zero uncaught errors).`, { label: 'fix', phase: 'Fix', schema: DOC, effort: 'high' })
phase('Verify')
const v = await agent(`${CTX}\nIndependent tech verifier (don't edit source). Fix report: ${JSON.stringify(fix).slice(0, 3000)}. Re-check both issues and re-run the full tech lens: npm test, axe WCAG AA on all routes (Edge desktop, Samsung-UA 390x844, WebKit iPad), throttled LCP incl. deep links, zero console errors/external requests, VietQR decodes (default no-amount and 100k/2.5M/10M), crawl for 404s. Verdict with blocking list.

RESUME NOTE: this step was stopped cleanly on 2026-09-29 at 13:30 for an account switch. The progress of the stopped attempt (files it made, last steps) is in D:/Dex/Projects/dex.place/review/resume/website-verify.md. Read it first and continue from that work instead of redoing it.`, { label: 'verify', phase: 'Verify', schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, score: { type: 'number' }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'score', 'blocking', 'notes'] }, effort: 'high' })
let fix2 = null
if (v && v.blocking && v.blocking.length) fix2 = await agent(`${CTX}\nFix these remaining blockers and re-verify: ${JSON.stringify(v.blocking).slice(0, 5000)}`, { label: 'fix2', phase: 'Verify', schema: DOC, effort: 'high' })
return { fix, v, fix2 }
