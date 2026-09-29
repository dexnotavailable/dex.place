export const meta = {
  name: 'dex-website-final-fixes',
  description: 'Fix the 3 blocking website issues (gallery weight, donate contrast, mobile menu focus) + stale ops tests, then independent verification before going live',
  phases: [
    { title: 'Fix', detail: 'single integrator' },
    { title: 'Verify', detail: 'tech + visual recheck' },
  ],
}
const CTX = `
Repo D:\\Dex\\Projects\\dex.place (public; main is live; do NOT commit/push). The new website (src/site/, content/, docs/site/DESIGN-SYSTEM.md) passed visual/motion/content critics at 8.2-8.5 but the tech critic found 3 blocking issues. Other lanes are editing tools/, art/, review/motion/ — don't touch those. Keep /lab/ and /scenes/ building. Ports 20000-20999.
Blocking issues to fix properly:
1. GALLERY WEIGHT: the collage srcset offers only 512w and 2048w and all 9 images use loading="eager"; phones download ~8 MB and LCP was 24.6 s on Slow 4G + 4x CPU. Fix: generate intermediate widths (e.g. 384/640/960/1280/2048) from the existing display files at build or prep time (lossless or near-lossless WebP of Dex's own art — never recolour or crop, keep aspect and ICC), correct sizes attributes per layout, lazy-load everything below the first row, fetchpriority/eager only for the first visible piece, same for /gallery/NN/ piece pages. Target LCP <= 2.5 s on the throttled phone profile and first-load image bytes under ~1 MB on phone.
2. DONATE CONTRAST: slider tick labels are #b7b7b7 on white (2.0:1) in the default "Any amount" state via opacity 0.5 (src/site/styles/donate.css ~244-263). Keep all visible text >= 4.5:1 in every state; dim the track only.
3. MOBILE MENU FOCUS: the popover menu leaves focus on the covered Menu button and Tab escapes to hidden page content (WCAG 2.4.11/2.4.3). Move focus into the popover on open (autofocus on its Close button or first item), keep focus inside while open, Escape closes and returns focus to the Menu button, and make background content inert while open.
Also: ops/test/ops.test.mjs has 2 failing tunnel-patch tests because they read the REAL tunnel script, which is now patched in production; make those tests use fixture copies (never touch the real script), and run node --test ops/test/ops.test.mjs to all-pass.
Also apply the motion critic's top two polish items if cheap (see the website workflow notes in docs/site/ if recorded).
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'result'] } } }, required: ['summary', 'files', 'checks'] }
phase('Fix')
const fix = await agent(`${CTX}\nFix everything, then verify yourself: npm run build from clean, npm test, ops tests, axe on every page (Edge desktop, Samsung-UA mobile emulation, WebKit iPad), throttled LCP on /gallery/ and a piece page, keyboard walk of the mobile menu, and visual screenshots of the gallery and donate pages (look at them) into review/site/final/.`, { label: 'fix', phase: 'Fix', schema: DOC, effort: 'high' })
phase('Verify')
const verify = await parallel([
  `TECH: rebuild from clean; npm test; node --test ops/test/ops.test.mjs; axe (serious/critical = blocking) on all routes in 3 engines/profiles; throttled Slow-4G + 4x CPU LCP and image bytes on /gallery/ and /gallery/01/ on a 390x844 DPR3 profile; keyboard walk of the mobile menu (focus enters, stays, Escape returns); VietQR still decodes byte-for-byte at the default no-amount state and at 100,000 / 2,500,000 / 10,000,000 VND and the slider can't go below 100,000.`,
  `VISUAL: nothing regressed — screenshots of every page at 1440x900 and 390x844, gallery hover/open/close still smooth, donate page looks right in both states, menu looks right. Blocking = visible regression or broken layout.`,
].map((lens, i) => () => agent(`${CTX}\nIndependent verifier (don't edit source). Fix report: ${JSON.stringify(fix).slice(0, 4000)}\nLens: ${lens}\nSave evidence to review/site/final-verify-${i + 1}/.`, { label: `verify:${i + 1}`, phase: 'Verify', schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, blocking: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'blocking', 'notes'] }, effort: 'high' })))
let fix2 = null
const blocking = verify.filter(Boolean).flatMap(v => v.blocking || [])
if (blocking.length) fix2 = await agent(`${CTX}\nFix these verifier findings and re-verify: ${JSON.stringify(blocking).slice(0, 6000)}`, { label: 'fix:2', phase: 'Verify', schema: DOC, effort: 'high' })
return { fix, verify, fix2 }
