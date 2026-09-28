# Content, runtime, and local hosting contract

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. Keep the actual local origin owner. Shared account/progress/treasury/presence/voice services are in scope under22; old static-only and no-account boundaries are superseded. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

This document owns architecture and migration constraints, with the original2026-09-06 proposal distinguished from the measured source1.8 implementation below. The build/public-delivery go is active under18. Local implementation evidence does not establish current public hosting health or final release availability.

## Existing owner evidence

| Surface | Observed state / use |
|---|---|
| Source root | `D:/Dex/Projects/SUMMER PROJECT 3/dex-client` |
| Website | `site/`, currently React + TypeScript with Vite and pnpm; inspect existing scripts before future work |
| Working branch | `codex/summer-2026-cinematic-overhaul` at inspection; many unrelated client/catalog modifications already exist |
| Shared catalog | `catalog/dex-products.json`, schema 0.1 at inspection; current products include `dexcode` / `dexCode`. This is not a complete inventory of every desired public project. |
| Old support owner | `site/src/app/components/Support.tsx` already contains Ko-fi URL, MB BIN and account; no new payment endpoint is implemented by these docs |
| Logo sources | `brand-assets/` with Daniel outline variants and OTF sources |
| Local illustration sources | `D:/Dex/Media/Images/Inbox`; exact nine-file register is in [03](03-sections-and-controls.md) |
| Hosting documentation | [../../HOSTING.md](../../HOSTING.md), historically recorded local origin `127.0.0.1:8088` and Cloudflare `dex-site` tunnel |
| Desktop client | `client/`; release packaging and integration are separate work; this website specification does not authorize altering them |

The repo map's older “no git” and old Next.js/Tauri proposals are not current implementation facts. Current source inspection takes precedence. No dependency changes or repo reconstruction are needed for documentation.

## Proposed architecture boundaries

Use a normal accessible website shell for URLs, text, controls, file actions and payment choices, with a separately managed game renderer. The world sends typed navigation or encounter events into that shell. It does not own money values, release identity, article rendering or arbitrary browser navigation.

The chosen proposed route is Phaser for the 2D runtime and Tiled for authored maps, with installed Krita for controlled raster/frame work. This is the route to prove after go, not an open engine-selection menu. [10](10-world-production-workflow.md) owns production. Phaser/Tiled installation and native map import, animation, and mobile integration are post-go proof tasks, not capabilities claimed here. Preserve React/Vite/pnpm. Replace the route only after documenting a concrete failure and the bounded replacement.

### Private authoring and reviewed export roots

**PROPOSED DEFAULT:** private authoring root `D:/Dex/Projects/dex-place-art-production`, separate from the website's served directories. Its planned children are `source`, `donors`, `maps`, `animation`, `audio`, and `provenance`. No folders or assets are created by this specification. The separate root's version-control setup is future scoped work; commits/pushes still require Dex's request and must not touch the current dirty client/catalog set.

Only the approved importer/exporter emits reviewed runtime assets into `site/public/assets/world/<build-revision>/` and gallery display assets into `site/public/assets/illustrations/<build-revision>/` in the implementation checkout. Copy no editable masters, private manifests, original donor archives, raw generation attempts, or operator records into public assets. Private PNG masters remain in authoring; public images are approved display exports. [13](13-build-readiness-and-scope.md) defines the source-to-public review and handoff boundary.

| Boundary | Allowed responsibility | Forbidden shortcut |
|---|---|---|
| Website shell | Routes, semantic controls, focus, content loading, preferences | Canvas-only docs/payment forms |
| Game runtime | Movement, collision, animation, cut objects, boss state | Untrusted file URLs or payment actions embedded in scene scripts |
| Content adapter | Validate public records and produce view models | Rewriting shared client catalog to fit temporary UI assumptions |
| Download controller | Exact selected release snapshot and once-only handoff | Any arbitrary victory event causing an unselected download |
| Donation controller | Integer VND state, recipient facts, coherent QR snapshot | Bank login, transfer execution or fabricated payment success |
| Asset loader | Load approved role-bound assets by region | Directory-wide art import into the global scene |
| Audio controller | Explicit opt-in, bus mixing, pause/mute state | Generator API calls on visitor actions |

The world may emit `openSection(sectionId)`, `openDocument(documentId)`, `openArtwork(artworkId)` while entering the designated section, `encounterWon(encounterId, intentId)`, and `encounterAbandoned(encounterId)`. Controllers validate IDs against active state and approved manifests. Duplicate or stale events are ignored. Arbitrary `openUrl`, `downloadAnything`, `pay`, or raw executable scene scripts are outside the contract.

## Public content records

These are semantic contracts, not files already created. Preserve existing source owners and add a documented adapter if their current schemas differ.

### Project record

Required: stable project ID, display name, concise factual description, type, truthful public status, intended order, approved preview asset references, related documentation IDs, releases, and optional existing project URL. Every preview must be explicitly allowed for its destination; display-only illustrations cannot be a project's Downloads thumbnail.

Use an explicit `draft`, `preview`, `available`, `coming-soon`, or `archived` state only when supported by source data. Do not infer public availability from a local file or a package build. Projects without approved downloadable releases are still representable; their action explains availability and may link to real docs.

### Release / downloadable artifact record

Required for an enabled production download: stable release/artifact ID; product ID; displayed version; platform; architecture; filename; exact byte size; checksum algorithm and value; public HTTPS delivery URL; publication status. Production validation rejects loopback/private-network hosts and local-file URLs, including development-origin substitutions. An installation/docs route is optional and must point to real published instructions when present. Missing instructions are labeled honestly as specified by DL-07 and do not alone disable a valid artifact. Display signing/installer caveats only when factual and relevant to the actual release.

Separate product title from artifact filename. One project may have multiple artifacts. Release selection is explicit; device detection is a suggestion only and never swaps a platform silently. The snapshot selected before combat is immutable for that encounter.

Keep mutable “latest” catalog metadata separate from immutable versioned bytes. If a selected version is withdrawn or changed, explain it and require a fresh selection. Never replace an old URL with different bytes under an encounter's stored hash.

The confirmed first artifact is `website documentation`, as defined in [03](03-sections-and-controls.md). This is a website-owned content record; do not modify the shared desktop dexCode catalog merely to make the website's documentation reward appear. Broader project/release inventory remains later work.

**PROPOSED DEFAULT:** a separate development manifest may enable local-only proof for the actual reviewed/versioned documentation ZIP over HTTP on the explicitly configured loopback development origin. The adapter must require development mode, exact origin, and complete filename/size/hash metadata; arbitrary paths, private LAN origins, `file:` URLs, and unrelated local files remain invalid. A production build rejects this manifest and never labels its artifact publicly available. Loopback transfer proves local behavior only.

### Documentation record

Required: stable document ID; project ID; slug; title; topic/category; content path; version/release applicability; updated date if verified; headings/anchors; plain text search projection; optional world prop ID. A doc may exist without a physical prop. Multiple file props may point to one doc without duplicating the article.

The article index exposes all approved documents. World discovery is a navigation layer, not the authorization mechanism. Search and indexes must not depend on collected-file state. Draft/private project documents remain excluded until deliberately approved for public publication.

The first online documentation and first reward ZIP are built from one reviewed sanitized export, not two independently edited editions. Preserve every public-facing behavior/rule, version, slug, heading ID, and portable link. [13](13-build-readiness-and-scope.md) owns the explicit chapter allowlist, transforms, exclusions, and coverage manifest; [03](03-sections-and-controls.md) maps six initial world-file IDs to actual headings. Remove private paths, provider jobs/credit accounting, operator history, and secret references; retain deliberately public donation facts. Never publish/ZIP the private owner directory wholesale.

### Illustration record

Private authoring record: stable artwork ID; source path; gallery-display export path; provenance and publication-ready metadata flag. Emitted public record: artwork ID, approved web display URL(s), title, dimensions/aspect ratio, truthful alt text, optional date/medium/project relation only when verified, display order, and `usage=illustration-display-only`. Never emit a local source/export path, private folder name, or authoring provenance into the browser manifest.

The first local gallery may use exactly the nine recovered images with the basename titles and factual inspected alt texts in [03](03-sections-and-controls.md). Public title/alt/publication review remains a release-only gate; detailed descriptions are deferred and do not block local gallery or shell/game construction. This does not authorize neighboring files. A PSD/CLIP source is never sent as a browser asset. Duplicate exports require deduplication. Do not invent story captions, original-character ownership, series order, or dates from timestamps.

### World and encounter records

Required: region ID; safe entry anchor; neighbor links; camera bounds; collision geometry reference; approved original or licensed asset references with provenance; section mapping; interactive props with stable IDs/type/target/outcome; reset policy; audio context. Encounter record includes template ID, spawn points, pattern tuning, accessibility mode, and allowed binding to the selected artifact.

Each region carries its working camera configuration and an accepted composition reference/short intent note.01 owns the visual direction and10 owns export/proof. Hero/structure measurements, quiet-region annotations and foreground percentages are optional diagnostics when tuning, not mandatory runtime schema fields or per-region validation quotas. Record actual responsive camera choices where used; preserve essential visibility. Decorative extent is separate from playable collision bounds, so a large wall does not create new traversable regions or require a giant texture.

A new content record can reuse a region/encounter template. It must not cause a new top-level tab, randomly named boss, or new required gameplay mechanic. Unknown IDs fail visibly and safely.

### Donation record

The canonical public facts and amount behavior belong to [04](04-donation.md). Keep bank account as a string, amount as integer VND, provider URL exact, and account-holder identity separate from friendly text. No credentials are part of this record. Do not place the previously supplied production API key in any example configuration.

## Runtime state and consistency

- URL state identifies section/item/version/artifact where relevant. An encounter hides the panel as an in-memory Downloads submode while preserving the selected URL; refresh restores disarmed details without loading the game.
- Game simulation has a single active focus owner; overlays pause it, and held inputs clear before resuming.
- Encounter intent and bank-QR request have different controllers and revisions. Neither can be revived from stale callbacks after leaving its route.
- Any primary tab, including the currently highlighted Downloads tab, cancels encounter intent. Menu/settings pause and retain it. Donation method/back/close continue to follow the shared [04](04-donation.md)/[05](05-shell-and-system-controls.md) navigation contracts.
- Content requests use request IDs/cancellation so late responses cannot populate the wrong product, document, artwork or amount.
- Settings are versioned and optional. Storage refusal/corruption falls back to defaults; never throws the user out of the site.
- No service worker or PWA offline-install behavior is included initially. Introducing one requires documented cache/upgrade rules, especially for executable releases and bank details.
- Content-first mode works without game resources. Screen readers use real text/navigation rather than a fake narration of coordinates.

## Loading and performance targets

These are proposed acceptance budgets to measure, not claims of current performance:

| Area | Starting budget / proof |
|---|---|
| Initial navigation and text | Usable within 2 seconds on the agreed midrange mobile/4G test profile; identify actual device/network conditions in proof |
| Initial world region | Aim for 5 MB compressed critical scene payload or less, excluding opt-in audio and lazy gallery media |
| Rendering | Aim for stable 60 fps on target desktop, at least stable 30 fps on target mobile at Low; report p95 frame times and device |
| Input | No visible stuck-key state; jump/slash feedback appears on the next practical render frame |
| Documentation and donation | Input and scrolling remain responsive while game paused; no background renderer contention |
| Large media | Lazy-load by section/item; choose responsive display exports; never load all full-size art at spawn |
| World textures | Individual raster sources at most2,048px per edge and approximately64MiB combined decoded source/generated surfaces. The former four-full-size-atlas layout was a packaging default; the current bounded shared-file strategy is recorded below. |
| Gallery images | Thumbnails at most 512 px longest edge; display exports at most 2,048 px longest edge; preserve aspect without upscaling; current plus one adjacent large image, at most 32 MiB decoded RGBA |
| Audio | [12](12-audio-composition-and-budget.md) owns formats, loop/stem method, and budgets; explicit opt-in and hidden-page pause apply |
| Installers | Stream via browser/origin; never buffer a large executable into renderer memory |

If a budget fails, reduce particles, reflection passes, texture detail and secondary motion first. Preserve confirmed interaction, the monumental silhouette, familiar scale reference, quiet space and composed camera view at Low as well as High. Huge architecture can use bounded tiled/modular low-detail layers within the existing texture cap; scale does not authorize a giant monolithic bitmap or larger GPU budget. Do not cut essential accessibility or silently omit mobile to claim pass. Actual Samsung Internet Android/iPad Safari device results remain OPEN proof items under15.

Decoded estimates use width × height ×4 bytes: a2,048-square RGBA texture is16MiB. They budget image surfaces, not total GPU/process memory; mipmaps, copies, render buffers and browser overhead require separate measurement. The earlier proposal to keep only current/neighboring zones and evict at boundaries is not implemented. Source1.8 intentionally loads the bounded51-image shared library, with36 configured raster roles and15 reserved. The added P21 mast is included; configured means used somewhere in the composed runtime, not simultaneously visible or artistically accepted. The current scene contains165 placements. This avoids a new streaming dependency for a small reusable set; it does not authorize unbounded growth or claim that loaded means rendered.

The current public PNG headers were remeasured after the FG01v4 platform and P21 mast exports settled:51 distinct world sources total35,658,320 RGBA bytes, and the unchanged hero sheets total6,720,000 bytes. Current generated lighting/fog fields add5,159,880 bytes(about4.92MiB). The separate96×96 soft-light mask and256×216 beam add36,864 and221,184 bytes respectively, or258,048 bytes together. The combined47,796,248-byte estimate is45.582MiB, below the64MiB source/generated-surface budget. The private `compression-v1/current-surfaces.json` receipt records each PNG's dimensions/hash and the current bounded lighting-construction formulas. These figures exclude gallery images, separately budgeted audio, GPU duplication, mipmaps, render buffers, browser copies and total process memory; they are not a GPU residency measurement. Generated lighting does not count as an additional independently generated art asset. Recheck exact dimensions/residency when adding or replacing material; a growing library may require a separately verified zone/streaming strategy before exceeding the budget.

Gallery full-image preloading remains current plus at most one adjacent display, not both neighbors; unload the prior large image when stepping forward. Physical Gallery bays use only their registered thumbnails as conditional DOM displays. Gallery and world remain separate asset roles, and no personal-art texture enters the world renderer or its previews.

### Measured loading baseline and remaining performance work

The private `20260907-performance-baseline` receipt used an unchanged prior production build, headless Brave1920×1080 and the real loopback origin. Normal cold world-ready was683ms. A separate lab profile at1.6Mbps down,750kbps up,150ms configured latency, cache disabled and4× CPU throttle reached navigation at4.844s, a decoded visible preview at13.982s and world-ready at29.641s without the loader deadline firing. The2-second navigation target was not met in that specific lab condition. It is not a physical Samsung/iPad or population-wide4G result.

Five-second idle RAF p95 intervals were10.1–10.2ms across five normal room samples; these are browser scheduling observations, not measured GPU presentation or a desktop/mobile FPS guarantee. That baseline precedes the latest lighting, platforms, gallery and movement changes. Initial uncompressed resource bodies were about5.58MB, including2.396MB JavaScript and an850,852-byte arrival plate.

Negotiated gzip delivery is now implemented in the production-origin server. On the exact same unchanged older dist, actual JS/CSS HTTP bodies decreased from2,444,987 to663,309 bytes(72.9% smaller), with decoded source hashes verified. One repeat of the same cold lab profile observed navigation at1.916s, decoded preview at13.404s and world-ready at19.589s, with no page errors or failed requests. The private `20260907-compression-cold` receipt and `compression-v1/actual-transfers.json` record this result. It verifies encoded origin delivery for that older visual build, not current-scene, public-edge or physical-device performance. The preview remains slow, and final-build profiling remains pending.

The selected WorldPreview image now requests `loading="eager"`, `fetchPriority="high"` and `decoding="async"`. Only the actual selected section/profile image receives these hints; this does not preload every room or change resolution, pixel policy or compression quality. The image still mounts after the existing size measurement. Earlier traces show a long in-flight preview request overlapping world loading, but did not record request-priority changes; the hints are a justified scheduling attempt, not proof of a faster first impression. Measure their effect on the final settled payload instead of promising a timing improvement.

### Implemented negotiated text delivery

The origin uses built-in asynchronous Node gzip at level6 for eligible HTML, JavaScript, CSS, JSON, SVG, Markdown and related plain text up to4MiB per source. Ordinary files smaller than256 bytes remain identity unless the client excludes identity. A16MiB/64-entry LRU holds compressed representations, and at most two compression jobs run concurrently with shared work per exact source revision. Reads allocate at most the capped source size and validate file size/mtime before and after reading. There is no unbounded compression job queue. These are application body-buffer/work limits, not total Node or socket-memory measurements.

Compressed responses carry `Content-Encoding: gzip`, `Vary: Accept-Encoding`, the exact encoded Content-Length and a strong hash ETag for those encoded bytes. HEAD and304 describe the selected representation; identity retains its existing weak metadata ETag. Quality values, wildcard entries and explicit identity preference/refusal are respected. Unsupported encodings fall back to identity when accepted; a client refusing every available representation receives406. When both compression slots are occupied, clients accepting identity receive the existing identity stream. A gzip-only request instead receives an uncached503 with `Retry-After: 1` rather than an unbounded queued job.

Explicit Range requests select identity before conditional validation, including a full identity response after an If-Range mismatch. Existing206/416, suffix ranges,304 precedence, weak If-Range rejection and date validators remain. Binary archives/installers/images/audio and explicitly precompressed `.gz`/`.br` Unity resources retain exact payloads and their existing MIME, disposition, cache and range behavior; no second compression layer is added.

Thirteen private real-HTTP groups passed: six text formats and decoded equality; compressed HEAD/304 and cross-representation validators; quality/wildcard/refusal negotiation; Range/If-Range/416; binary identity; Unity/SP13 MIME/cache/allowlists; canonical redirects, SPA handling, security headers and real Windows-junction escape rejection; empty/oversize sources; changed-source invalidation; concurrent cold fallback; gzip-only saturation; and real cache byte/entry eviction. This origin proof does not replace final release-manifest verification or public HTTPS/edge checks. Final cold-load and render profiling against the new material, mast, geometry, gallery, motion and preview payload remains required; actual Samsung/iPad performance remains open.

## Local hosting and delivery

CONFIRMED: public address `dex.place`, hosted on this machine. The current historical arrangement is the local origin plus Cloudflare Tunnel described in `HOSTING.md`. Retain that owner until a scoped deployment plan is reviewed. No DNS, firewall, tunnel, scheduled-task or registrar changes happen in documentation work.

Future release checks must verify public HTTPS, canonical host behavior, path refresh fallback for all page routes, and exact artifact responses through the public edge. A localhost test is not proof of public delivery. A machine sleeping/offline means its origin may be unavailable; document real uptime behavior without claiming 24/7 guarantees.

Page HTML/routing and raw artifacts must have unambiguous handling. Preserve existing `/downloads/<filename>` URLs and checksum sidecars where published. Resolve them by exact artifact routes before SPA page fallback; a ZIP/EXE request must never receive HTML status 200. Unknown artifact paths return a real failure. Prefer an explicitly versioned artifact namespace for new files, with legacy links preserved.

Download response: correct content type, attachment disposition, filename, length, and range/resume behavior for large files. Public delivery is HTTPS only; the separate loopback-HTTP development exception above is solely for local proof. Support real 206/416 semantics where the origin serves ranges. Do not “fix” an accepted release by rebuilding it for a website visual change. Browser prompts and final save location are browser-owned.

QR integration remains a provider decision and verification gate. The documented third-party QuickLink route may have production template conditions. The site must not claim a local/offline QR generator until an actual standards-compatible encoder and scan proof exist. QR creation is distinct from payment confirmation.

## Migration plan after go

1. Snapshot current source/git state and preserve unrelated dirty client/catalog work. Make an isolated implementation branch/worktree only after go, according to actual repository state. Because reviewed specification files are currently uncommitted, a HEAD-only worktree can omit them: transfer the exact reviewed allowlist of docs, site AGENTS/CLAUDE instructions, and README pointer with path/hash manifest, then verify equality before building. Do not copy unrelated dirty client/catalog changes. [13](13-build-readiness-and-scope.md) owns the handoff list; no commit is implied.
2. Recheck current hosting owner and existing route/artifact inventory without altering live tasks.
3. Build the new shell/content adapter and an independent limited world prototype in the authorized development surface. Keep production unchanged while proof is incomplete.
4. Map `/portfolio` and any other legacy public page paths from actual route inventory. Proposed `/portfolio` redirect to `/illustrations` is only correct after verifying it does not discard existing project content; otherwise use a documented compatibility page.
5. Remove cross-section personal-art use in the new build. Legacy effects are not reused incidentally.
6. Prove every section and shared state on desktop/mobile before promoting. The downloadable bytes and desktop-client integration remain separate owners.
7. Deploy an atomic versioned site build through the existing origin owner, keep a rollback build, and verify public routing/headers plus visible interaction. Deployment permission is assessed against Dex's actual go-ahead scope at that time.
8. Update hosting proof and the spec changelog only with what was actually verified. A deployed artifact is not a successful browser flow until checked.

No implementation is performed by this list. It exists to prevent the game layer, public downloads, and hosting changes from being improvised independently.
