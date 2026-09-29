export const meta = {
  name: 'dex-website',
  description: 'Design and build the scroll-down dex.place website: research, 3 direction prototypes judged, full build (landing, downloads, gallery, docs+blog, donate/VietQR), critic loop',
  phases: [
    { title: 'Research', detail: 'Endfield site visual analysis + award-site patterns; VietQR/tech; content inventory' },
    { title: 'Directions', detail: '3 coded homepage prototypes' },
    { title: 'Judge', detail: '3 judges pick + graft' },
    { title: 'Build', detail: 'design system + shell, then pages in parallel' },
    { title: 'Critique', detail: '4-lens critic panel, fix loop' },
  ],
}

const CTX = `
Project: dex.place — Dex's personal site. Repo D:\\Dex\\Projects\\dex.place (public GitHub; main is the LIVE site; do NOT commit or push, the coordinator does). Read CANON.md and AGENTS.md first (brand: the mark is lowercase "dex" in the Daniel font, font file public/fonts/Daniel-Regular.otf with its license; NO taglines, subtitles, "solo dev", "made with love", sales copy or invented filler; four destinations; direct access without playing or signing in).
The site has two layers: a 2D pixel game world on top (built elsewhere, not your job — reserve a mount point) and, when you scroll down, the black cinematic bars recede and a real website takes over. YOU build that website, working, at the site root.
Dex's brief (verbatim essentials): "when i say normal website i honestly still mean a really impressive and good looking site, i want good fadein animations, non cluttered texts, buttons pop out with good easing and whatnot. As for the vibe, looking for blocky shapes that pop out, colored glyphs, cute pixel icons, layered stuff in the background floating and fun looking? like a hyperpop vibe, overall cute and colorful, but not too chaotic, i can only describe it with the colors u see on arknights endfield website, apart from that apply anything we can from good websites or award winning sites."
Sections:
- Main landing: projects going on — dexCode, dexClient, then dex.place. Short descriptions, mostly imagery; placeholders for now (clearly replaceable data, not invented claims). Factual one-liners may come from the projects' own docs (read-only): dexCode D:\\Dex\\Temp\\dexcode-tool-runtime-parity-20260830\\docs\\product-canon.md (and its README), dexClient D:\\Dex\\Projects\\dexClient (README/CONTRACTS). Never invent features.
- Downloads for those projects: currently only dexClient has a real file (/downloads/dexClient-Setup-0.1.0.exe, 665,563,123 bytes, sidecar .sha256). dexCode has no public download yet — show its state honestly, don't invent binaries.
- Gallery: Dex's own art (display only). Sources: legacy/site/public/content/illustrations/*-display.webp and *-thumbnail.webp with manifest.json (10 pieces incl. alt text; originals at D:\\Dex\\Media\\Images\\Inbox). "dont name them, frame them nicely, maybe a collage? stuff transforms, shrinks and grows as ur cursor moves/hovers over them and as u click into and out of stuff." No visible titles (keep alt text for accessibility). Never use his art as decoration elsewhere.
- Documentation and blog: "neat organized not cluttered". Build the structure from markdown content files with prerendered pages and real URLs; seed with clearly marked placeholder entries Dex will replace (no invented facts).
- Donate: Ko-fi (https://ko-fi.com/dexdonation) and MB Bank QR. "by default the QR is just for my bank, but sliding the donation value 0-10mil vnd regenerates the QR so it prefills the amount." Reuse the VietQR/EMVCo payload logic Dex already verified in his MB Bank app, from legacy/site/src/worldsite/content/index.ts and legacy/site/src/worldsite/sections/Donate.tsx (MB Bank, account 0585739325, recipient THIEU GIA MINH; at 0 VND the QR carries no amount).
HARD RULES: no image generation of any kind; icons and decorative shapes are authored in code (pixel grids as data rendered to SVG/canvas, CSS/SVG shapes). No external network requests at runtime (self-host fonts; OFL fonts via npm @fontsource or official repos are fine). Direct, shareable URLs for every page; content readable without JS; prefers-reduced-motion honoured; WCAG AA; works on Samsung Internet (Android) and iPad Safari; fast (small JS, no layout shift).
Coexistence: other workflows are editing src/lab/**, lab/index.html, scenes/**, src/scenes/**, tools/**, art/** — don't touch those. vite.config.ts is shared: when you change it, read-modify-write and PRESERVE the existing lab input (and any scenes input). One "npm run build" must still produce dist/ with dist/index.html (the deploy puller smoke-tests that) and still build /lab/. The ops server (ops/server.mjs) maps /downloads/* to a downloads folder outside the build: if you want a /downloads/ PAGE, make the minimal ops change (serve a real file from the downloads folder when it exists there, otherwise fall through to the build) with tests in ops/test/ops.test.mjs (run: node --test ops/test/ops.test.mjs); otherwise pick a different page URL. Ports 20000-20999 for local servers. Playwright browsers may exist under D:\\Dex\\Tools\\playwright-browsers.
`

const DOC = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: { type: 'string' } },
    media: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'findings'],
}

phase('Research')
const research = await parallel([
  () => agent(`${CTX}
Visual research. (1) Open the official Arknights: Endfield website(s) (search for the current official URL; use Playwright or WebFetch) and extract its actual palette (hex values measured from screenshots), typography style, grid/layout patterns, UI glyphs/labels, motion patterns (entrances, hovers, transitions), and what makes it feel the way it does. Save screenshots only under D:\\Dex\\Projects\\dex.place\\review\\site\\endfield\\ (git-ignored). (2) Study 6-10 award-winning or widely praised sites (Awwwards/FWA/CSS Design Awards SOTD, recent) that fit "blocky shapes that pop, colored glyphs, cute pixel icons, floating layered backgrounds, hyperpop but calm, cute and colorful": note concrete techniques (easing curves and durations, stagger, scroll-driven reveals, magnetic buttons, FLIP gallery transitions, view transitions, sticky/pinned sections, cursor-reactive layers) with URLs. Write D:\\Dex\\Projects\\dex.place\\docs\\site\\VISUAL-RESEARCH.md (text only, no embedded third-party images): palette with hex, type recommendations (self-hostable OFL fonts that pair with the Daniel mark), motion spec numbers, and a do/don't list for "cute and colorful but not chaotic".`, { label: 'research:visual', phase: 'Research', schema: DOC }),
  () => agent(`${CTX}
Technical and content research. (1) VietQR: read the legacy payload code and document exactly what it produces (EMVCo tags, BIN 970422, service code, currency 704, amount tag 54 only when > 0, point-of-initiation 11 vs 12, CRC16-CCITT); write a small pure TS module src/site/vietqr.ts (+ unit tests runnable with node --test, e.g. src/site/vietqr.test.mjs importing a built copy or written in plain JS) that reproduces the legacy output byte-for-byte for 0, 100,000 and 10,000,000 VND, and choose a small self-contained QR encoder (npm package or tiny implementation) — verify by decoding generated QR images with a decoder (e.g. jsQR or zxing via Node) in the tests. (2) Content inventory: the gallery manifest (10 items), the project facts available from the dexCode/dexClient docs, what documentation exists that could seed /docs (e.g. the old site's documentation editions under legacy/site/public/files and legacy docs), and the ops /downloads/ route question. (3) Architecture recommendation: vanilla Vite multi-page with a small build-time markdown/prerender step vs Astro (content collections + view transitions) vs other — judge by: one build to dist/ that also builds /lab/ (vanilla TS page) and later /scenes/, prerendered HTML, cross-page transitions (View Transitions API support in Samsung Internet/iPad Safari), small JS, simplicity for agents. Write D:\\Dex\\Projects\\dex.place\\docs\\site\\TECH-PLAN.md.`, { label: 'research:tech', phase: 'Research', schema: DOC }),
])
const R = JSON.stringify(research.filter(Boolean)).slice(0, 14000)

const DIRS = [
  { key: 'industrial-pop', idea: 'ENDFIELD INDUSTRIAL-POP: a light, airy base close to the Endfield site, black type, the signature Endfield accent as the hero colour, crisp technical labels and thin grid lines, with small saturated glyph blocks (several accent colours) that pop in, and cute pixel icons as friendly counterweights.' },
  { key: 'candy-blocks', idea: 'CANDY BLOCKS: the Endfield palette pushed playful — chunky rounded-square blocks that pop and settle with springy easing, sticker-like pixel icons, layered floating shapes in the background that react to the cursor, cheerful but with generous whitespace so it never gets chaotic.' },
  { key: 'night-glyph', idea: 'NIGHT GLYPH: continuous with the dark cinematic world above — a deep dark base, the Endfield accent colour plus coloured neon-ish glyphs and blocky panels that pop out, floating layered glyph fields in the background, cute pixel icons glowing softly.' },
]

phase('Directions')
const protos = await parallel(DIRS.map(d => () => agent(`${CTX}
Research: ${R}
Build a HOMEPAGE PROTOTYPE for direction "${d.key}": ${d.idea}
It must include: the scroll handoff from a placeholder world viewport at the top (a dark full-viewport block with black cinematic bars that recede as you scroll), the landing projects section (dexCode, dexClient, dex.place with placeholder imagery made in code), a glimpse of each other section (downloads, gallery collage using the real art thumbnails, docs/blog, donate), the navigation, the floating layered background, colored glyphs, cute pixel icons (authored in code), and real motion (fade-ins, staggered reveals, button pop with good easing, hover states). Put it in D:\\Dex\\Projects\\dex.place\\review\\site\\directions\\${d.key}\\ as a self-contained Vite-free static page (index.html + css + js; copy the Daniel font and the needed thumbnails in; no external requests) so it can be opened directly. Capture Playwright screenshots (desktop 1440x900 top, mid-scroll and bottom; mobile 390x844) and a short scroll video/GIF (ffmpeg at D:\\Dex\\Tools\\ffmpeg-9.0.1-full_build) into the same folder. Look at them and polish before reporting.`, { label: `direction:${d.key}`, phase: 'Directions', schema: DOC, effort: 'high' })))

phase('Judge')
const JUDGE = { type: 'object', properties: { ranking: { type: 'array', items: { type: 'object', properties: { direction: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['direction', 'score', 'why'] } }, graft: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } } }, required: ['ranking', 'graft', 'risks'] }
const judges = await parallel([
  'VIBE: does it match Dex\'s words (blocky pops, coloured glyphs, cute pixel icons, floating layers, hyperpop but calm, cute and colourful, Endfield colours) and would it impress next to award-winning sites?',
  'USABILITY AND CLARITY: non-cluttered text, direct access to downloads/docs/donate, readability, mobile, accessibility, and continuity with the dark pixel game world above.',
  'MOTION AND CRAFT: quality of the fade-ins, easing, button pops, gallery interaction and overall finish; how well it will scale to the full site.',
].map((lens, i) => () => agent(`${CTX}
Judge ${i + 1}. Lens: ${lens}
Open and look at all three prototypes in D:\\Dex\\Projects\\dex.place\\review\\site\\directions\\ (screenshots + GIFs; open the pages in Playwright if useful). Reports: ${JSON.stringify(protos.filter(Boolean)).slice(0, 6000)}. Score each out of 10, name the specific ideas worth grafting into the winner, and the risks.`, { label: `judge:${i + 1}`, phase: 'Judge', schema: JUDGE, effort: 'high' })))

phase('Build')
const system = await agent(`${CTX}
Research: ${R}
Direction prototypes: ${JSON.stringify(protos.filter(Boolean)).slice(0, 5000)}
Judges: ${JSON.stringify(judges.filter(Boolean)).slice(0, 6000)}
Pick the winning direction by the judges' combined view, graft the named ideas, and build the REAL site foundation at the repo root following docs/site/TECH-PLAN.md (you may refine it): the design system (tokens: colour, type, spacing, radii, shadows, motion easing/duration/stagger; self-hosted fonts), the shell (nav, footer, the top world mount point with the black-bar scroll handoff, page transitions), the floating layered background system, the coloured glyph system, the pixel icon set authored in code, shared motion primitives (reveal-on-scroll, button pop, magnetic hover if it fits), content loading for markdown (docs/blog) and data files (projects, downloads, gallery), and the page routes as stubs: / , /downloads/ (or chosen URL), /gallery/, /docs/, /blog/, /donate/ (+ /projects/<slug>/ if the design wants it). Replace the old placeholder root page (keep its downloads info in the new downloads data). Write docs/site/DESIGN-SYSTEM.md. Build must pass (npm run build) with /lab/ still building. Screenshots of the shell into review/site/build/.`, { label: 'build:system', phase: 'Build', schema: DOC, effort: 'high' })

const PAGES = [
  { key: 'landing', brief: 'the main landing: projects (dexCode, dexClient, then dex.place), mostly imagery (placeholder imagery generated in code, e.g. blocky pixel compositions per project), short factual lines, links to each project page/downloads/docs.' },
  { key: 'downloads', brief: 'the downloads page: per project, what is downloadable now (dexClient installer with size, sha256 link, direct download button), honest "not yet" states, no invented binaries. The primary download must be one click from this page and reachable from the landing.' },
  { key: 'gallery', brief: 'the gallery: an unnamed, beautifully framed collage of the 10 artworks; pieces transform, shrink and grow with cursor movement and hover; clicking into a piece opens it large with a smooth shared-element (FLIP/view-transition) animation and clicking out returns; keyboard and touch friendly; lazy loading; no visible titles.' },
  { key: 'docs-blog', brief: 'documentation and blog: organised, uncluttered index pages and article pages from markdown (sidebar or grouped index for docs, date-ordered list for blog), readable long-form typography, code blocks, headings anchors; seed with clearly marked placeholder entries.' },
  { key: 'donate', brief: 'donate: Ko-fi button and the MB Bank QR. UPDATED BY DEX (overrides the 0-10mil wording above): by default, before any sliding, the QR is the account-only code with no amount; the amount slider runs from 100,000 to 10,000,000 VND (never 0), and moving it regenerates the QR live with that amount prefilled; a clear way back to the no-amount default. Sensible steps, formatted VND, a few quick-pick chips. Show the bank, account number and real recipient name as selectable text; QR crisp and scannable; uses src/site/vietqr.ts.' },
]
const pages = await parallel(PAGES.map(p => () => agent(`${CTX}
Foundation report: ${JSON.stringify(system).slice(0, 5000)}
Read docs/site/DESIGN-SYSTEM.md and the shell. Build the "${p.key}" page(s) fully: ${p.brief}
Stay within your page's own files/folders plus its content/data files; if you truly need a shared change, make it minimal and additive and say so in your report. Use the design system's tokens, motion primitives, glyphs and icons so everything feels like one site. Verify with the dev server (20xxx port) + Playwright screenshots at 1440x900 and 390x844 and a short interaction GIF into review/site/build/${p.key}/; look at them and polish.`, { label: `page:${p.key}`, phase: 'Build', schema: DOC, effort: 'high' })))

const CRIT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] }, scoreOutOf10: { type: 'number' }, blocking: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, where: { type: 'string' }, fix: { type: 'string' } }, required: ['issue', 'fix'] } }, notes: { type: 'array', items: { type: 'string' } } }, required: ['verdict', 'scoreOutOf10', 'blocking', 'notes'] }
const LENSES = [
  { key: 'visual', lens: 'VISUAL DESIGN AND VIBE: award-level polish; Endfield colours; blocky pops, coloured glyphs, cute pixel icons, floating layers; cute and colourful but not chaotic; hierarchy, spacing, typography; the Daniel mark; consistency across pages.' },
  { key: 'motion', lens: 'MOTION AND INTERACTION: fade-ins and staggered reveals, easing curves and durations, button pops, hover states, gallery transforms and click-in/out transitions, page transitions, the scroll handoff from the world with the bars receding, no jank (check frame timing), reduced-motion mode.' },
  { key: 'ux', lens: 'UX, CONTENT AND BRAND: non-cluttered text, clear navigation, downloads reachable immediately and correct, docs/blog organisation, donate flow clarity, no taglines/sales copy/invented facts (CANON), honest placeholders, gallery shows no titles, direct URLs work.' },
  { key: 'tech', lens: 'TECH: npm run build from clean passes (and /lab/ still builds); zero console errors; WCAG AA contrast, keyboard and focus, alt text, landmarks; performance (JS size, LCP, CLS; test with throttling); mobile viewports 390x844 (Samsung Internet-like Chromium) and 1024x1366 (WebKit/iPad); no external requests; VietQR correctness — generate the default no-amount QR plus QRs at 100,000, 2,500,000 and 10,000,000 VND from the live page (the slider must not go below 100,000), decode them, and verify EMVCo tags, amount handling and CRC match the legacy payload Dex verified; ops tests pass if ops changed (node --test ops/test/ops.test.mjs).' },
]

let rounds = []
for (let round = 1; round <= 3; round++) {
  phase('Critique')
  const reviews = await parallel(LENSES.map(l => () => agent(`${CTX}
Independent critic, round ${round}. Lens: ${l.lens}
Build the site and run it (npm run build && preview, or dev, on a 20xxx port); use Playwright to visit every page on desktop and mobile, interact (scroll, hover, click into/out of gallery, slider), and capture your own screenshots/GIFs into review/site/critic-${l.key}-r${round}/. Look at them. Be demanding: this should look like it could win a site-of-the-day while staying calm and cute. "blocking" = broken, ugly, off-brief, inaccessible, or wrong (e.g. an invalid QR).`, { label: `critic:${l.key}:r${round}`, phase: 'Critique', schema: CRIT, effort: 'high' })))
  const ok = reviews.filter(Boolean)
  const blocking = ok.flatMap(r => (r.blocking || []).map(b => ({ lens: '', ...b })))
  rounds.push({ round, scores: ok.map(r => r.scoreOutOf10), blocking: blocking.length, reviews: ok })
  log(`round ${round}: scores ${ok.map(r => r.scoreOutOf10).join('/')}, ${blocking.length} blocking`)
  if (!blocking.length && ok.every(r => r.scoreOutOf10 >= 8)) break
  if (round === 3) break
  await agent(`${CTX}
You are the single integrator for round ${round} fixes on the website. Fix every blocking issue properly and the most valuable notes (don't weaken checks; keep the design system coherent): ${JSON.stringify(ok.map(r => ({ score: r.scoreOutOf10, blocking: r.blocking, notes: (r.notes || []).slice(0, 12) }))).slice(0, 14000)}
Re-verify with fresh screenshots across pages and viewports, npm run build from clean, and (if touched) the VietQR tests and ops tests.`, { label: `fix:r${round}`, phase: 'Critique', schema: DOC, effort: 'high' })
}
return { research, protos, judges, system, pages, rounds: rounds.map(r => ({ round: r.round, scores: r.scores, blocking: r.blocking })), lastReviews: rounds.length ? rounds[rounds.length - 1].reviews : [] }
