export const meta = {
  name: 'dex-place-repo-setup',
  description: 'Stand up dex.place repo: deploy/server ops, fresh placeholder site, legacy salvage import, then review + secret scan',
  phases: [
    { title: 'Build', detail: 'ops tooling, placeholder site, legacy import in parallel (disjoint paths)' },
    { title: 'Review', detail: 'adversarial review per build item, one fix round if blocking' },
    { title: 'Secret scan', detail: 'secret-preflight over the whole staged tree' },
  ],
}

const COMMON = `
Context (shared by all workers):
- Local clone of the PUBLIC GitHub repo dexnotavailable/dex.place lives at D:\\Dex\\Projects\\dex.place (branch main, currently only README.md). This repo becomes the single source of truth for the live site https://dex.place. A puller on this Windows PC will build main and serve it on 127.0.0.1:8088 behind an existing Cloudflare Tunnel.
- Windows 11, Git Bash shell available, Windows PowerShell 5.1 at C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe. Node v24.18.0 and npm 11.16.0 are installed. pnpm is NOT on PATH — use npm only.
- D: drive has only ~22 GB free. Never copy large binaries around. Temporary work goes under D:\\Dex\\Temp\\.
- DO NOT: commit, push, or run any git command that changes history in D:\\Dex\\Projects\\dex.place (the coordinator commits). DO NOT touch port 8088, the scheduled tasks "\\Dex\\Dex Site Origin" / "\\Dex\\Dex Site Cloudflare Tunnel", cloudflared, anything under D:\\Dex\\Projects\\SUMMER PROJECT 3, or modify anything under D:\\Dex\\Projects\\dex-place-world or D:\\Dex\\Projects\\dex-place-art-production (read-only sources).
- Only create/modify files inside your assigned paths in the clone. Other workers are writing other paths concurrently.
- Brand rules for any visible text: the mark is lowercase "dex" in the Daniel font. No taglines, subtitles, "solo dev", "made with love", "coming soon", sales copy, or invented filler text.
`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'result'] } },
    openIssues: { type: 'array', items: { type: 'string' } },
    artifacts: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'checks', 'openIssues'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'pass-with-notes', 'blocking'] },
    blocking: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['issue', 'fix'] } },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'blocking', 'notes'],
}

const ITEMS = [
  {
    key: 'ops',
    build: `${COMMON}
Your assigned paths: ops/** only.

Build the hosting tooling that makes the GitHub repo decide the live site.

1. ops/server.mjs — zero-dependency Node HTTP server (node: built-ins only). Binds 127.0.0.1:<port> (default 8088, overridable by --port/env). Serves the ACTIVE build directory, which it resolves from the deploy state file (state.json in the deploy root) so a deploy switch takes effect without restart and without any request ever seeing a missing directory (re-read state on mtime change; state.json is written via temp-file + rename). Also serves /downloads/* from a configurable downloads dir (default D:\\Dex\\Servers\\dex.place\\downloads; files there are NOT in git: e.g. dexClient-Setup-0.1.0.exe is 665 MB).
   Requirements: strict path safety (no traversal, no encoded traversal, no dotfiles, realpath must stay inside the served root); correct MIME types incl. .html .js .mjs .css .json .svg .png .webp .gif .otf .ttf .woff .woff2 .ogg .mp3 .wav .webm .mp4 .wasm .zip .exe .sha256 .txt; HTML gets "Cache-Control: no-cache, no-transform" (no-transform stops Cloudflare injecting analytics); files under /assets/ (Vite hashed) get "public, max-age=31536000, immutable"; other static "no-cache"; /downloads/* gets "private, no-store", Content-Disposition attachment, Accept-Ranges with correct 206/416 Range handling, HEAD support. ETag/Last-Modified with 304 for non-download files. Security headers: x-content-type-options nosniff, referrer-policy strict-origin-when-cross-origin, x-frame-options SAMEORIGIN. Host www.dex.place -> 301 to https://dex.place same path+query. GET /healthz -> 200 text "ok". GET /__deploy -> JSON {sha, deployedAt, previousSha, lastFailedSha?} from state (no secrets, no local paths). Directory requests map to index.html; unknown paths -> 404 using the build's 404.html if present. Only GET/HEAD allowed (405 otherwise). Graceful shutdown on SIGINT/SIGTERM. Logs to a file under the deploy root logs dir.

2. ops/deploy.mjs — the puller. Deploy root default D:\\Dex\\Servers\\dex.place containing: repo\\ (a clean clone of https://github.com/dexnotavailable/dex.place.git, branch main — hard-reset to origin/main every cycle, never hand-edited), builds\\<shortsha>\\ (per-commit build workspace), downloads\\, logs\\, state.json. Every 30 s (configurable): git fetch; if origin/main differs from the deployed sha and is not the last failed sha: materialise that commit into builds\\<shortsha>\\ (git archive or worktree), run "npm ci" (or "npm install" if no lockfile) with npm cache under the deploy root (cache\\npm), run "npm run build", verify dist/index.html exists, smoke-test by spawning server.mjs on an ephemeral port against the candidate (GET / == 200 and /healthz == ok), then atomically switch state.json to the new build. A failed build/smoke test records lastFailedSha + log path in state.json and leaves the current build live. Keep the last 5 successful builds; never prune the active or previous one. Single-instance lock file. If the newly deployed commit changed anything under ops/, exit with code 75 after switching so the supervisor restarts with the new ops code (self-update). Also support "node ops/deploy.mjs --once" and "--rollback" (switch state back to previousSha build).

3. ops/start-origin.ps1 — Windows PowerShell 5.1 compatible supervisor (no PS7-only syntax), modelled on a KeepAlive launcher: params -DeployRoot (default D:\\Dex\\Servers\\dex.place), -Port 8088, -KeepAlive. On first run clones the repo into DeployRoot\\repo if missing and runs one deploy (--once) so there is something to serve. Starts server.mjs and deploy.mjs from DeployRoot\\repo\\ops with hidden windows and log redirection, health-checks /healthz, and with -KeepAlive restarts either process if it exits (backoff, exit code 75 = immediate restart). Resolve node.exe via Get-Command.

4. ops/install-hosting.ps1 — DO NOT RUN IT FOR REAL. Cutover script the coordinator will run later: supports -WhatIf (print plan only). Steps: export current "\\Dex\\Dex Site Origin" task XML to D:\\Dex\\Automation\\backups\\dex-place\\<timestamp>\\ ; stage DeployRoot (clone + first deploy via start-origin logic) BEFORE touching the old origin; hardlink (same volume, zero extra space) the existing files from D:\\Dex\\Projects\\SUMMER PROJECT 3\\dex-client\\site\\dist\\downloads\\* into DeployRoot\\downloads\\ ; then stop the process listening on 127.0.0.1:8088 only after verifying its command line contains run-production.mjs; change ONLY the task's Exec action to run ops\\start-origin.ps1 -KeepAlive from DeployRoot\\repo (keep triggers/principal/settings exactly; working dir DeployRoot); start the task; wait for http://127.0.0.1:8088/healthz. If health fails within timeout, automatically restore the backed-up task XML and restart the old origin.
   ops/rollback-to-v2.ps1 — restore a given backup XML, stop the new origin on 8088, start the old task, wait for its health (old origin health: GET /healthz == ok).

5. ops/README.md — plain-language: how pushing/merging to main makes it live (~within a minute), where things live, how to see what's live (/__deploy), how to roll back one build, how to roll back to the old v2 origin, logs.

6. ops/test/ops.test.mjs using node:test — MUST actually run and pass. Use a temp deploy root under D:\\Dex\\Temp\\dex-place-ops-test\\ and a local bare git repo you create there (trivial package.json whose build script writes dist/index.html) instead of GitHub. Ports 18000-18999 only, never 8088. Cover: traversal attempts (../, %2e%2e, backslash, dotfiles) blocked; headers per class; Range 206/416 and HEAD on downloads; 304 via ETag; www redirect; /healthz; /__deploy; deploy of commit A then B; failing build keeps B live and records lastFailedSha; --rollback; and zero failed requests while hammering GET / during a switch. Also run PowerShell parser checks on the .ps1 files ([System.Management.Automation.Language.Parser]::ParseFile) under powershell.exe 5.1 and run install-hosting.ps1 -WhatIf to show the plan (it must not change anything).
Report exact test output summary.`,
    review: (b) => `${COMMON}
You are an adversarial reviewer. Do not edit files. Try to break the dex.place hosting tooling in D:\\Dex\\Projects\\dex.place\\ops\\ (the builder reported: ${JSON.stringify(b).slice(0, 3000)}).
Re-run: node --test ops/test/ (from the clone root) and report the real result. Then probe beyond the tests with your own throwaway scripts under D:\\Dex\\Temp\\dex-place-ops-review\\ (ports 18000-18999 only; never 8088, never the real scheduled tasks, never run install-hosting.ps1 or rollback-to-v2.ps1 except with -WhatIf):
- path traversal / encoded / UNC / junction or symlink escape, huge or malformed Range headers, HEAD vs GET parity, method handling;
- can a broken commit ever go live? what if the build hangs forever (timeout?) or npm ci fails midway; disk growth; lock file stale after crash;
- is the state switch atomic on Windows (rename over existing file semantics); does server re-read state correctly;
- self-update via exit 75 actually restarts with new code under start-origin.ps1 -KeepAlive; PS 5.1 compatibility of every .ps1 (no ?? / ?. / ternary / -Parallel etc.);
- install-hosting.ps1 logic: backs up before changing, verifies old process identity before stopping, restores on failed health, keeps task trigger/principal/settings; -WhatIf truly makes no changes;
- security posture: public repo, npm lifecycle scripts run from main on this PC (acceptable only because only accounts with push access to main can trigger — confirm nothing deploys from other branches or PRs).
Only mark "blocking" for real defects that would take the site down, deploy a broken/unreviewed build, expose files, or damage the old origin/rollback path. Everything else is a note.`,
  },
  {
    key: 'scaffold',
    build: `${COMMON}
Your assigned paths in the clone: package.json, package-lock.json, index.html, vite.config.ts, tsconfig.json, src/**, public/**, .gitignore, .gitattributes. Do not touch ops/** or legacy/** (other workers).

Build a fresh, minimal Vite + TypeScript (vanilla, no UI framework) project at the repo root. This is the placeholder that goes live on dex.place today, replacing the old site, while the real site is built piece by piece. It must stay useful: direct downloads and donate.
- npm scripts: dev, build (vite build -> dist/), preview. Pin exact dependency versions. tsconfig "include" must be ["src"] only (a legacy/ folder with old .ts code will sit in the repo and must never be type-checked or bundled). .gitignore: node_modules, dist, .vite, logs, *.log, .env*, review/ (local A/B review sheets that may contain third-party reference images must never be committed). .gitattributes: text=auto eol=lf, and mark binary types (png, webp, otf, ttf, woff2, ogg, mp3, wav, zip, exe).
- Brand: copy D:\\Dex\\Projects\\dex-place-world\\site\\public\\world\\brand\\Daniel-Regular.otf and Daniel-license.txt into public/fonts/ (read the license and report exactly what it permits for web embedding and redistribution in a public repo; if it forbids redistribution, do NOT copy the font file and instead report the blocker). Inspect D:\\Dex\\Projects\\dex-place-world\\site\\public\\assets\\brand\\dex-mark-white.svg and dex-mark-black.svg and public\\world\\brand\\dex-icon.svg; use the icon as favicon and the lowercase "dex" wordmark either as the SVG (if it is the Daniel wordmark) or as live text in Daniel via @font-face.
- Page content, nothing more:
  * the "dex" mark (roughly 110 px wide on desktop, 80 px on phones);
  * downloads — direct links to /downloads/dexClient-Setup-0.1.0.exe (665,563,123 bytes), /downloads/dexSMP-Fabric-26.1.2-Friend-Installer.zip (994,485 bytes), /downloads/Hoshikawa-Haven-Brand-v1.zip (43,157 bytes), each with human size and a small link to its .sha256 sidecar (same path + .sha256). Use the file names as the labels (or a plain product name derived from them: "dexClient", "dexSMP Fabric friend installer", "Hoshikawa Haven brand pack"). Keep the list in one data file src/downloads.ts so it is easy to edit.
  * donate — a link to https://ko-fi.com/dexdonation.
  * No other text. No tagline, subtitle, "coming soon", descriptions, footer credits.
- Look: dark, very quiet, generous negative space, small readable type (system UI stack for body; Daniel only for the mark), clear focus styles, AA contrast, 44 px touch targets, safe-area insets, works in Samsung Internet and iPad Safari, no animation required (if any, respect prefers-reduced-motion). No external requests (no Google Fonts, no analytics, no CDNs). <title>dex</title>. Add public/404.html in the same quiet style with only the mark and a link home.
- Verify: npm install (creates package-lock.json), npm run build succeeds, dist/index.html exists. Serve dist on a port in 18000-18999 (vite preview) and take screenshots at 1440x900 and 390x844 using Playwright (npx playwright / playwright-cli; install chromium into a cache under D:\\Dex\\Temp if needed). Save screenshots under D:\\Dex\\Temp\\dex-place-scaffold-review\\ and list their paths in artifacts. Look at your screenshots and fix anything cramped, misaligned, or off-brand before reporting.`,
    review: (b) => `${COMMON}
Review the fresh placeholder site in D:\\Dex\\Projects\\dex.place (builder report: ${JSON.stringify(b).slice(0, 3000)}). Do not edit files.
Check: npm run build passes from a clean state (delete dist first); tsconfig includes only src; no external network requests in built output (grep dist for http(s):// other than ko-fi and dex.place); visible text contains nothing beyond the mark, download names/sizes/checksum links, the section labels and the Ko-fi link (flag any tagline/subtitle/filler); Daniel font license actually permits what was done (read public/fonts license text yourself); .gitignore covers node_modules, dist, .env*, review/; download links and sizes match: dexClient-Setup-0.1.0.exe 665563123, dexSMP-Fabric-26.1.2-Friend-Installer.zip 994485, Hoshikawa-Haven-Brand-v1.zip 43157.
Open the screenshots listed in the report (Read the PNG files) and judge them visually: is it quiet, well-spaced, readable, not cramped, mark sized sensibly, good on the 390px phone view? Mark "blocking" only for build failure, license violation, off-brand copy, broken links, or clearly broken layout.`,
  },
  {
    key: 'legacy',
    build: `${COMMON}
Your assigned path: legacy/** only.

Import the salvage bank from the September 2026 Codex iterations of dex.place (v1 world, v2 "inhabited" public site, and the local "Registry" 12-room game) into legacy/ as CODE + DOCS + finished runtime assets. This is reference material for future work, not the live site. Copy (don't move) from these read-only sources:

A. D:\\Dex\\Projects\\dex-place-world\\site (git working tree, branch codex/dex-place-inhabited-v2-20260908, with ~56 uncommitted changes — copy the working tree as it is on disk) -> legacy/site/
   include: src/, docs/, scripts/, server/, tests/, guidelines/, public/ (runtime assets), and top-level files (package.json, pnpm-lock.yaml, tsconfig*.json, vite*.config.ts, playwright.config.ts, index.html, registry.html, release-allowlist.json, default_shadcn_theme.css, postcss.config.mjs, pnpm-workspace.yaml, *.md incl. README/HOSTING/IMPLEMENTATION/REVIEW-READY/ATTRIBUTIONS/AGENTS/CLAUDE/design-qa).
   exclude: node_modules, dist, dist-*, .logs, .vite, coverage, test-results, playwright-report, any .env*, and design/ unless a file there is clearly Dex/agent-authored text (third-party reference screenshots/images must be excluded).
B. D:\\Dex\\Projects\\dex-place-art-production\\planning-20260913 -> legacy/planning-20260913/ (all md + the map-exploration concept PNGs + prompts.json). HANDOFF-20260926.md is the key doc.
C. D:\\Dex\\Projects\\dex-place-art-production\\registry-game-20260913 -> legacy/registry-pipeline/ : only *.md, *.json, *.py, *.mjs, *.txt at any depth. Exclude layers/, exports/, rooms/, sheets/, props/, anchor/ and all images (raw production stays on D:).
D. Other folders under D:\\Dex\\Projects\\dex-place-art-production (animation, audio, donors, maps, prototypes, provenance, references, release-staging, source, v2): inspect each; copy only small agent/Dex-authored text docs (md/json/txt) that explain decisions or reviews into legacy/art-production-notes/<folder>/. EXCLUDE entirely: references/ (third-party), donors/ (possible personal data), audio provider exports/stems (Suno/ElevenLabs sources stay private), release-staging/, any binary.
E. EXCLUDE entirely: D:\\Dex\\Projects\\dex-place-world\\coordination, runtime-v2 (production data may contain account PII), runtime-v2-tests.

Hard rules for everything copied:
- no single file > 50 MB; report the 20 largest files and the total size of legacy/. Target <= 250 MB total. If over, do not silently drop: list candidates to drop with sizes and drop only obvious duplicates/build outputs.
- no secrets: grep the copied tree for private keys, "BEGIN .*PRIVATE KEY", AKIA, ghp_/gho_/github_pat_, sk_[0-9a-fA-F]{20,} (an ElevenLabs key was once pasted in chat), xox[baprs]-, "password\\s*[:=]", "secret\\s*[:=]", "token\\s*[:=]" with literal values, livekit api secrets, supabase service_role keys, .pem/.key/.pfx files, auth.json, credentials files. Remove any hit and record it (redact the value in your report).
- no personal data beyond what dex.place already published (the Ko-fi URL, MB Bank recipient THIEU GIA MINH and account number shown on the old public donate page are already public and fine). Remove emails, account records, donor records, logs with IPs/user agents.
- no third-party copyrighted reference imagery. Third-party game assets are allowed only if their license permits redistribution in a public repository and the license/attribution file comes with them — check legacy/site/ATTRIBUTIONS.md and any license files (e.g. Martial Hero CC0 is fine; check Gothicvania and any other packs; if a license forbids redistribution or is unclear, exclude those files and list them).
- Dex's own illustrations (the gallery artworks) were already publicly served; keep them in their runtime locations.

Write legacy/README.md (plain language: what this is, which iteration each folder came from, that it is a salvage bank and not live, and where the excluded raw material still lives on D:) and legacy/MANIFEST.md (source -> destination, file counts, sizes, and EVERY exclusion rule with reason and the specific notable files excluded). Do not add a package.json at legacy/ root.`,
    review: (b) => `${COMMON}
Adversarially review the legacy/ import in D:\\Dex\\Projects\\dex.place\\legacy (builder report: ${JSON.stringify(b).slice(0, 3000)}). Do not edit files. This goes into a PUBLIC GitHub repo, so hunt for anything that must not be published:
- secrets or credentials of any kind (run your own regex sweep: private keys, AKIA, ghp_/gho_/github_pat_, sk_ hex keys, xox tokens, JWTs "eyJ" with 3 segments, supabase service_role, livekit secret, password/secret/token assignments with literal values, .env files, .pem/.key/.pfx, auth.json, WinCred target names are ok);
- personal data: email addresses (list them), phone numbers, IP addresses, user agents in logs, account/donor records, session exports;
- third-party copyrighted images (reference screenshots, anime/game captures, other artists' sprites) — sample the image files and look at suspicious ones (Read the PNG) — and third-party asset packs whose license does not allow public redistribution;
- files > 50 MB; total size vs 250 MB target.
Also sanity-check that MANIFEST.md matches what is actually on disk. Mark "blocking" for any secret, PII, clearly non-redistributable third-party content, or file > 100 MB.`,
  },
]

const FIX_PROMPT = (item, build, review) => `${COMMON}
You are fixing blocking review findings for the "${item.key}" part of the dex.place repo setup, in its assigned paths only (ops -> ops/**; scaffold -> root site files/src/public; legacy -> legacy/**). Builder report: ${JSON.stringify(build).slice(0, 2500)}
Blocking findings to fix: ${JSON.stringify(review.blocking)}
Fix each one properly (no weakening of tests or checks), re-run the relevant verification (tests / build / screenshots / sweeps), and report exactly what changed and the new check results.`

const results = await pipeline(
  ITEMS,
  (item) => agent(item.build, { label: `build:${item.key}`, phase: 'Build', schema: BUILD_SCHEMA }),
  async (build, item) => {
    if (!build) return { key: item.key, build: null, review: null, fix: null, rereview: null }
    const review = await agent(item.review(build), { label: `review:${item.key}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' })
    if (!review || review.verdict !== 'blocking' || !review.blocking.length) return { key: item.key, build, review, fix: null, rereview: null }
    log(`${item.key}: ${review.blocking.length} blocking finding(s), running one fix round`)
    const fix = await agent(FIX_PROMPT(item, build, review), { label: `fix:${item.key}`, phase: 'Review', schema: BUILD_SCHEMA })
    const rereview = await agent(item.review(fix || build), { label: `re-review:${item.key}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' })
    return { key: item.key, build, review, fix, rereview }
  },
)

phase('Secret scan')
const scan = await agent(`Scan the entire working tree of D:\\Dex\\Projects\\dex.place (all untracked and modified files; skip node_modules/ and dist/) as the proposed first push to the PUBLIC repo github.com/dexnotavailable/dex.place. Report every credential, secret, token, private key, .env/auth file, and any personal data (emails, phone numbers, IPs, account or donor records) with file path and line, redacting values. Also flag any single file over 50 MB. Do not modify files.`, { label: 'secret-preflight', agentType: 'secret-preflight' })

return { results, scan }
