export const meta = {
  name: 'dex-website-dark-pixel',
  description: 'Rework the live dex.place website to a dark, sharp, full-pixel theme with calm composition, single full-scroll page, tight justified gallery collage with grow/shrink hover, pop-out buttons; critic loop',
  phases: [
    { title: 'System', detail: 'dark pixel design system + single-scroll shell' },
    { title: 'Sections', detail: 'projects, downloads, gallery, docs+blog, donate adapted in parallel' },
    { title: 'Critique', detail: '4-lens critics, fix loop' },
  ],
}
const CTX = `
Repo D:\\Dex\\Projects\\dex.place (public; main is LIVE; do NOT commit/push — the coordinator does). The website (src/site/, content/, public/gallery, docs/site/DESIGN-SYSTEM.md, TECH-PLAN.md, VISUAL-RESEARCH.md) is live in a light "candy-blocks" style. Read CANON.md (brand: lowercase "dex" in Daniel; no taglines/sales copy/filler), AGENTS.md, and docs/site/*.md first.
Dex's rework brief (verbatim essentials): "lets go full on with the pixel theme, however i want a dark theme instead of what we have currently, no round borders, full blocks and sharp edges with like a 1 or 2 px border, stuff pops out, readjust the assets too, i also dont want it too chaotic we should tone that down with the angles and whatnot. It should be a full scroll too like u dont have to click the tabs, they can take u where u need but not the only way. For the art gallery i want the stuff to be arranged more close in a grid like a collage with adjustment for different aspect ratios, stuff shrink and grow as u hover. Same for other buttons, shrink, hover, popout."
Translate that into:
- DARK PIXEL THEME: dark base (near-black, not pure #000), the Endfield accents (acid yellow as the lead pop, with magenta, mint, cyan used sparingly) as fills and borders; zero border-radius anywhere (including focus rings, inputs, slider, images, QR frame); 1-2 px borders; hard pixel offset shadows that make blocks pop and grow on hover; pixel-crisp rendering (image-rendering: pixelated for pixel icons/placeholder art; integer offsets; no blur shadows, no gradients that smear). Pixel fonts for headings/labels (self-hosted OFL, e.g. Silkscreen, Pixelify Sans, Jersey, Tiny5, VT323, DotGothic16 — pick for legibility) with a highly readable body font for long text (docs, blog, bank details) — readability beats theme for long text. WCAG AA contrast on dark everywhere.
- CALM: remove tilted/rotated elements (the tilted slab, tilted ribbon, rotated frames/stickers), align everything to a clear grid, fewer and quieter floating background elements (slow, sparse, pixel-shaped, never behind reading text), consistent spacing rhythm. Cute via pixel icons and small moments, not clutter.
- ASSETS: redraw the pixel icons, placeholder project art, stickers/mascots and dividers to fit the dark sharp style (drawn in code/data; no image generation; Dex's illustrations are display-only and are never used as decoration).
- FULL SCROLL: the home page becomes one continuous page with all sections in order — projects (dexCode, dexClient, dex.place) -> downloads -> gallery -> docs & blog -> donate — each fully usable in place; the nav jumps to sections with smooth scroll and highlights the current one (scrollspy), but scrolling is the main path. Keep deep links working: section anchors (/#gallery etc.), and keep the existing sub-URLs (/downloads/, /gallery/, /docs/, /blog/, /donate/, /projects/...) working either as full pages or redirects to the anchors — no broken links; docs/blog articles and gallery piece pages remain as their own URLs. The world handoff at the top (black cinematic bars receding into the site) stays.
- GALLERY: a tight justified collage (rows packed to the container width preserving each piece's aspect ratio, 2-4 px gaps, sharp frames with 1-2 px borders); hovering a piece grows it and gently shrinks its neighbours (transform only, no layout jank), keyboard focus does the same; click opens the piece large with a FLIP transition and back; no titles (alt text stays). Keep the responsive-image work (derived widths, sizes, lazy loading, phone byte budget ~1 MB, LCP <= 2.5 s throttled).
- BUTTONS AND CONTROLS: hover pops out (lift + shadow grow), press shrinks (scale down + shadow collapse), crisp step or spring easing that feels pixel-y but not janky; same language for nav items, cards, chips, slider thumb.
- KEEP: VietQR donate (default no-amount code; slider 100,000-10,000,000 VND never below 100,000; byte-for-byte payload tests), direct dexClient 0.4.6 download, reduced-motion, no-JS readability, zero external requests, zero console errors, npm test green, /lab/ and /scenes/ still build.
Other lanes edit tools/, art/, docs/character/ — don't touch. Ports 21000-21999.
`
const DOC = { type: 'object', properties: { summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } }, media: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'checks'] }
phase('System')
const system = await agent(`${CTX}
Rework the design system and the shell: tokens (dark palette with contrast table, pixel + body fonts, spacing grid, borders, pixel shadows, motion curves/durations for pop/press/hover/scroll reveals), the single-scroll home page structure with section anchors, nav with smooth scroll + scrollspy + mobile menu (keep the accessible focus handling), the calmer background layer, redrawn pixel icon set and placeholder art, and the button/card/chip interaction language. Update docs/site/DESIGN-SYSTEM.md. Make sure every existing route still works (full page or redirect). Screenshots at 1440x900 and 390x844 into review/site/dark/system/; look at them and fix anything off-brief before reporting.`, { label: 'system', phase: 'System', schema: DOC, effort: 'high' })
phase('Sections')
const SECTIONS = [
  { k: 'projects', b: 'projects section (dexCode, dexClient, dex.place): dark sharp blocks, redrawn pixel placeholder art, factual short lines, pop-out cards linking to details/downloads/docs.' },
  { k: 'downloads', b: 'downloads section: dexClient 0.4.6 direct download with size and sha256, honest "not yet" for dexCode; one click from the top of the section; chips/buttons in the new pop language.' },
  { k: 'gallery', b: 'gallery section and piece pages: the tight justified collage with aspect-ratio packing, grow-on-hover/shrink-neighbours, keyboard parity, FLIP open/close, sharp 1-2 px frames, responsive images and lazy loading preserved.' },
  { k: 'docs-blog', b: 'docs and blog: in-page section with a clean index (latest posts, doc groups) plus the article pages restyled for the dark theme with highly readable long-form typography, code blocks and anchors.' },
  { k: 'donate', b: 'donate section: Ko-fi and the MB Bank QR in a sharp framed panel on dark (QR itself stays black-on-white with its quiet zone for scanning), default no-amount, slider 100k-10M VND, quick chips, bank details as selectable text; all VietQR tests green.' },
]
const secs = await parallel(SECTIONS.map(s => () => agent(`${CTX}
System report: ${JSON.stringify(system).slice(0, 4000)}
Read the updated docs/site/DESIGN-SYSTEM.md. Build the ${s.k} ${s.b} Stay within that section's own files/content; any shared change minimal and additive (say so). Screenshots desktop + mobile + an interaction GIF into review/site/dark/${s.k}/; look and polish.`, { label: `section:${s.k}`, phase: 'Sections', schema: DOC, effort: 'high' })))
const CRIT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, scoreOutOf10: { type: 'number' }, blocking: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, where: { type: 'string' }, fix: { type: 'string' } }, required: ['issue', 'fix'] } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'scoreOutOf10', 'blocking', 'notes'] }
const LENSES = [
  { k: 'visual', l: 'VISUAL: does it deliver Dex\u2019s brief — dark, fully pixel, sharp blocks, 1-2 px borders, pops, calm (no tilted/chaotic elements), cohesive redrawn assets, strong hierarchy, AA contrast; would it impress next to award-winning sites while staying calm?' },
  { k: 'interaction', l: 'INTERACTION AND MOTION: full-scroll flow, smooth anchor jumps and scrollspy, gallery grow/shrink hover and FLIP open/close, button pop/press, reveals, reduced-motion, no jank (frame timing on desktop and throttled mobile).' },
  { k: 'ux', l: 'UX AND CONTENT: one continuous page that works without clicking tabs; deep links (anchors and old sub-URLs) all work; downloads immediate; docs/blog readable; donate clear; CANON brand rules (no taglines/filler/invented facts); gallery shows no titles.' },
  { k: 'tech', l: 'TECH: clean build (npm run build) with /lab/ and /scenes/; npm test; axe WCAG AA on all routes in Edge desktop, Samsung-UA mobile emulation and WebKit iPad (install WebKit for Playwright if missing, under D:\\Dex\\Tools\\playwright-browsers); throttled LCP and image bytes on the home page (now long) and gallery; zero console errors/external requests; VietQR decode at default and 100k/2.5M/10M; no link 404s across the site (crawl).' },
]
let rounds = []
for (let round = 1; round <= 3; round++) {
  phase('Critique')
  const rev = await parallel(LENSES.map(c => () => agent(`${CTX}
Independent critic, round ${round}. Lens: ${c.l}
Build and run the site (21xxx port), use Playwright on desktop and mobile, interact, capture your own evidence into review/site/dark/critic-${c.k}-r${round}/ and look at it. "blocking" = broken, ugly, off-brief, inaccessible or wrong.`, { label: `critic:${c.k}:r${round}`, phase: 'Critique', schema: CRIT, effort: 'high' })))
  const ok = rev.filter(Boolean)
  const blocking = ok.flatMap(r => r.blocking || [])
  rounds.push({ round, scores: ok.map(r => r.scoreOutOf10), blocking: blocking.length })
  log(`round ${round}: ${ok.map(r => r.scoreOutOf10).join('/')} , ${blocking.length} blocking`)
  if (!blocking.length && ok.every(r => r.scoreOutOf10 >= 8)) break
  if (round === 3) break
  await agent(`${CTX}
Single integrator for round ${round} fixes. Fix every blocking issue and the most valuable notes, keep the system coherent, re-verify (build, npm test, screenshots across sections and viewports): ${JSON.stringify(ok.map(r => ({ score: r.scoreOutOf10, blocking: r.blocking, notes: (r.notes || []).slice(0, 10) }))).slice(0, 14000)}`, { label: `fix:r${round}`, phase: 'Critique', schema: DOC, effort: 'high' })
}
return { system, secs, rounds }
