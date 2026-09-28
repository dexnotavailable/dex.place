# legacy/ import manifest

Import date: 2026-09-28. Every source was copied, not moved; the originals on D: are untouched. Sizes are in bytes, with MiB (1 MiB = 1,048,576 bytes) in brackets.

## Totals

- **Files:** 1,140
- **Size:** 204,995,974 bytes (195.5 MiB). The target was 250 MB or less, so nothing had to be dropped for size.
- **Largest single file:** 2,891,348 bytes (2.76 MiB). The limit was 50 MB, and no file is anywhere near it.

## Source to destination

| # | Source (read-only) | Destination | Files | Bytes |
|---|---|---|---|---|
| A | `D:\Dex\Projects\dex-place-world\site` working tree on branch `codex/dex-place-inhabited-v2-20260908`, including its uncommitted changes as they sat on disk | `legacy/site/` | 899 | 193,126,638 (184.2) |
| B | `D:\Dex\Projects\dex-place-art-production\planning-20260913` | `legacy/planning-20260913/` | 15 | 10,488,066 (10.0) |
| C | `D:\Dex\Projects\dex-place-art-production\registry-game-20260913` (text only) | `legacy/registry-pipeline/` | 128 | 892,508 (0.85) |
| D | `D:\Dex\Projects\dex-place-art-production\{audio,prototypes,provenance,source,v2}` (curated docs) | `legacy/art-production-notes/<folder>/` | 96 | 462,449 (0.44) |
| | Written during import | `legacy/README.md`, `legacy/MANIFEST.md` | 2 | |

The A count is 896 files copied, minus 2 removed after the privacy scan, plus 5 license and notice files added (listed under "Changes made during import").

### A: `legacy/site/` breakdown

| Path | Files | Bytes |
|---|---|---|
| top-level files (package.json, pnpm-lock.yaml, tsconfig*.json, vite*.config.ts, playwright.config.ts, index.html, registry.html, release-allowlist.json, default_shadcn_theme.css, postcss.config.mjs, pnpm-workspace.yaml, all *.md) | 21 | 113,631 |
| `src/` | 174 | 3,056,066 |
| `docs/` | 28 | 760,229 |
| `scripts/` | 35 | 293,418 |
| `server/` | 24 | 178,481 |
| `tests/` | 3 | 835,369 |
| `guidelines/` | 1 | 2,620 |
| `public/assets/` | 103 | 31,607,738 |
| `public/audio/` | 49 | 15,463,567 |
| `public/content/` | 78 | 11,893,653 |
| `public/files/` | 6 | 541,124 |
| `public/world/` | 377 | 128,380,742 |

### B: `legacy/planning-20260913/`

Everything was copied: `CURRENT-PLAN.md`, `GAME-BUILD.md`, `GAME-INTERACTIONS.md`, `HANDOFF-20260926.md` (the key doc), `RUNTIME-ASSET-CONTRACT.md`, `central-arrival-floor-plan.md`, `story-candidate.md`, and `map-exploration/` (`README.md`, `arrival-stillness.md`, `prompts.json`, and five generated concept PNGs: `arrival-central-v2`, `arrival-stillness-v1`, `courtyard-between`, `open-atrium`, `suspended-interchange`). Nothing was excluded.

### C: `legacy/registry-pipeline/`

This has only `*.md`, `*.json`, `*.py`, `*.mjs` and `*.txt` at any depth: 107 json, 9 md, 9 py, 2 mjs and 1 txt. That covers the review reports, publication checkpoint, inventory, room/material/animation prompts, geometry review, the processing scripts (`key_registry_layer.py`, `prepare_*.py`, `publish_art.py`, `unmix_cloud_matte.py`, `validate_sheets.py`, `review_*.py/.mjs`, `record_asset.py`) and `reviews/**` report JSON.

### D: `legacy/art-production-notes/`

| Folder | Copied files | Bytes | Left on D: (text / binary) |
|---|---|---|---|
| `audio/` | 27 | 108,604 | 95 / 212 |
| `prototypes/` | 33 | 136,479 | 382 / 1,303 |
| `provenance/` | 17 | 109,785 | 284 / 230 |
| `source/` | 3 | 11,417 | 32 / 399 |
| `v2/` | 16 | 96,164 | 172 / 537 |

Selection policy: every copied file is on a hand-picked allowlist (see `D_ALLOW` in the import script noted at the end). It keeps agent- or Dex-authored docs that explain a decision, review, design, handoff or verdict: `REPORT.md`, `README.md`, `PROPOSAL.md`, `DESIGN.md`, `VERDICT.md`, `*-HANDOFF.md`, `*-CHECKPOINT.md`, `*-AUDIT.md`, `*-ANALYSIS.md`, `RIGHTS-REVIEW`, `ROOM-LAYOUT`, `IMPLEMENTATION`/`REVIEW-READY` snapshots, `INTAKE-REPORT`. It also keeps a few small summary or decision JSON files: audio requirements and contract audit, the original-theme composition and motif notes, the Suno B selection receipt (Dex's own pick), the v2 audio summary and selection audit, the font review, and the room scaffold, route and world-action summaries.

## Changes made during import (inside legacy/ only)

| Change | Why |
|---|---|
| Added `site/public/world/cast-v2/THIRD-PARTY-LICENSES.md` | Keeps the per-pack creator, source and license (all CC0) next to the third-party sprites. |
| Added `site/public/world/cast-v2/wizard2/LICENSE.txt` and `site/public/world/cast-v2/ui/LICENSE.txt` | Copies of the packs' own License.txt files (Evil Wizard 2, Kenney UI Pack) from the private intake folder `v2/donors/`. |
| Added `site/public/world/fonts-v2/LICENSE.md` | m5x7 license note. The creator page lists "Creative Commons Zero v1.0 Universal" (rechecked 2026-09-28). |
| Added `site/src/assets/fonts/Daniel-license.txt` | Copy of `public/world/brand/Daniel-license.txt`. The Daniel font may be shared only with its notice, and `Daniel-Bold.otf` had no notice beside it. |
| Renamed `site/AGENTS.md` to `site/AGENTS.historical.md` and `site/CLAUDE.md` to `site/CLAUDE.historical.md` | Content is unchanged. Under their original names, Codex and Claude Code would auto-load them as live instructions when working in `legacy/site/`, and they carry stale "GO received" and imagegen directions. The link from CLAUDE to AGENTS inside them still points at the old name. |
| Removed `site/server/main-account-browser-proof.mjs` and `site/server/existing-account-signup-proof.mjs` after copying | See the privacy scan below. |
| Removed `art-production-notes/audio/original-theme/suno-reference-v2/S001-REQUEST.md` after copying | See the privacy scan below. |

## Exclusion rules

### A: site

| Rule / item | Files | Bytes | Reason |
|---|---|---|---|
| `node_modules/` | 37,335 | 986,096,397 | Installed dependencies; reinstall from `pnpm-lock.yaml`. |
| `dist/` | 430 | 99,646,308 | Build output of the v1/v2 site. |
| `dist-registry/` | 200 | 68,100,459 | Build output of the Registry game. |
| `design/` | 20 | 22,301,993 | Rule: keep only Dex/agent-authored text, and design/ has none. It holds 19 PNG proof screenshots of the old site (`design/proof/*-brave.png` plus `comparison.png`) and a third-party reference image (`design/reference/summer-2026-selected.png`). |
| `scripts/__pycache__/` | 1 | 73,098 | Python bytecode cache. |
| `.npmrc` | 1 | 62 | Machine-local pnpm store path (`D:\Dex\Tools\pnpm-store`); not on the include list. |
| `.env*`, `.logs/`, `.vite/`, `coverage/`, `test-results/`, `playwright-report/`, `*.pem/*.key/*.pfx`, `auth.json`, credentials files, `*.log` | 0 | 0 | Rule applied; none were present in the tree. |
| `public/assets/portfolio/vnmc-lan/event-group.jpg` | 1 | 375,186 | Event photo of about 100 identifiable attendees (VNMC SHOWDOWN LAN). Photographer rights and attendee consent aren't recorded, and whether it was published before couldn't be confirmed from this lane. The old `src/app/components/VnmcLanFeature.tsx` still references it. |
| `public/assets/portfolio/vnmc-lan/dex-host-stage.jpg` | 1 | 84,848 | Event photo by an unrecorded photographer. Same reasoning; referenced by `Portfolio.tsx` and `VnmcLanFeature.tsx`. |
| `server/main-account-browser-proof.mjs` | 1 | 11,258 | Proof script for Dex's real primary account. It hard-coded that account's user ID (`2466c4c6-…` redacted) and read his real login through private credential references. It has no reuse value. |
| `server/existing-account-signup-proof.mjs` | 1 | 4,221 | Same account ID. It also reads Dex's primary login address from his private identity playbook. |

### B: planning-20260913

Nothing was excluded.

### C: registry-game-20260913

| Rule / item | Files | Bytes | Reason |
|---|---|---|---|
| `layers/` | 32 | 52,988,331 | Raw production layers stay on D:. |
| `exports/` | 102 | 76,963,730 | Raw exports stay on D:. This includes the one text file in there, `exports/export-manifest.json` (3,920 bytes), because the whole folder was excluded by rule. |
| `rooms/` | 12 | 27,112,669 | Raw room renders stay on D:. |
| `sheets/` | 28 | 29,832,347 | Raw sprite sheets stay on D:. |
| `props/` | 17 | 20,794,563 | Raw prop images stay on D:. |
| `anchor/` | 1 | 2,694,108 | Whole-map anchor image (`whole-map-v1.png`) stays on D:. |
| All other non-text files (mainly under `reviews/`) | 623 | 376,310,135 | Images are excluded by rule: 579 PNG and 42 GIF review captures. Also 2 JS runtime-data snapshots (`reviews/publication-01/runtime-data/rooms.js`, `scene-geometry.js`), which fall outside the md/json/py/mjs/txt rule. |

### D: other art-production folders

| Rule / item | Files | Bytes | Reason |
|---|---|---|---|
| `references/` | 0 | 0 | Rule: third-party references are never copied. It was empty at import time. |
| `donors/` | 15 | 166,904 | Rule: excluded entirely for possible personal data. At import time it actually held the Martial Hero CC0 intake (zip, sprites, import script), and the runtime copy of those sprites already ships in `site/public/world/hero/` with its LICENSE.txt. |
| `release-staging/` | 759 | 2,072,506,950 | Rule: release payload staging (build copies, receipts, HTTP proofs). |
| `animation/` | 0 | 0 | Empty. |
| `maps/` | 1 | 57,626 | Holds only `causeway.tmj`, the Tiled source for the v1 map, which isn't a decision doc. The runtime export ships at `site/public/world/maps/causeway.json`. |
| Everything off the allowlist in audio, prototypes, provenance, source, v2 | 2,681 non-doc files + 965 md/json/txt | 2,047,743,545 in total | The breakdown follows in the rows below. |
| Binaries and non-doc files | 2,681 | (most of the total) | Rule: no binaries. Includes all 15 Suno provider exports (WAV/MP3 under `audio/original-theme/suno-*`), ACE-Step renders, auditions, masters, the instrument soundfont and tools, a torch compile cache (`audio/temp/`), prototype, poster and lookdev captures, and one-off prototype scripts and HTML. |
| Machine-written proof dumps (most of the 965 text files) | | | Browser, accessibility and Narrator captures (`prototypes/accessibility-20260908/ax-*.json`, `aria-*.txt`), native-playback proofs (`*native-proof.json`, `after.json`, `frozen-g-proof.json`), full-route walking logs (`provenance/layout-proposal-20260906/*-output.txt`), receipts and hash inventories (`provenance/asset-records/`, `batch-*-production-receipt.json`, `source/exports/*/receipt.json`), and compression fixtures. These are evidence logs, not decisions. |
| Throwaway browser profiles | | | `prototypes/accessibility-20260908/isolated-profile*/`: temporary browser profile data. |
| Code snapshots | | | `*.ts.txt` "before" copies (`audio/entrance-revision-v1/audio-before.ts.txt`, `prototypes/inhabited-v2/*WorldScene*.ts.txt`, `door-leaf-v1/doorway-before.ts.txt`). The current code is in `site/src/`. |
| Duplicate specification snapshots | | | `v2/docs-reconciliation-before/`, `provenance/next-pass-reconciliation-20260908/before-docs/`, `provenance/source-pack-20260908/before/`, `v2/release-preparation/private-doc-preview/`. These are earlier copies of the chapters now in `site/docs/world-website/` and `site/public/content/documentation/`. |
| Third-party text | | | GeneralUser GS documentation and readme, the ACE-Step code license and model card copy (`audio/provenance/`), itch.io creator-page scrapes (`v2/donors/*/creator-page.txt`, `download-page-dom.txt`, `evil-wizard2-gate.txt`, which includes other users' comments), and the `THIRD-PARTY-NOTICES.txt` bundles in `v2/release-preparation/*/server/`. The license text that matters travels with the runtime assets instead. |
| `audio/original-theme/suno-reference-v2/S001-REQUEST.md` | 1 | 3,473 | Removed after copying. It records Dex's Suno subscription tier, credit balance and download count. The neighbouring `README.md` keeps the musical intent. |
| `provenance/suno-upload-blocked-audit-20260907.json` | 1 | | Not selected. It records Dex's live desktop activity at that moment. |

### E: never copied

| Source | Files | Bytes | Reason |
|---|---|---|---|
| `D:\Dex\Projects\dex-place-world\coordination` | 4 | 26,557 | Rule: agent coordination scratch. |
| `D:\Dex\Projects\dex-place-world\runtime-v2` | 7 | 9,900 | Rule: production data and config; may contain account PII. |
| `D:\Dex\Projects\dex-place-world\runtime-v2-tests` | 40 | 118,508 | Rule: runtime test data. |

## Third-party license check

| Asset in legacy/ | Creator / pack | License | Redistribution in a public repo | License file shipped |
|---|---|---|---|---|
| `site/public/world/hero/*` | LuizMelo, Martial Hero | CC0 1.0 | Yes | `hero/LICENSE.txt` (original) |
| `site/public/world/cast-v2/wizard2/*` | LuizMelo, Evil Wizard 2 | CC0 1.0 | Yes | `wizard2/LICENSE.txt` (original) |
| `site/public/world/cast-v2/rat/*`, `bat/*` | LuizMelo, Monsters Creatures Fantasy 2 | CC0 1.0 (creator page, rechecked 2026-09-28) | Yes | `cast-v2/THIRD-PARTY-LICENSES.md`, `cast-v2/manifest.json` |
| `site/public/world/cast-v2/townsfolk1-4/*` | Ansimuz, GothicVania Town | CC0 1.0 (pack license PDF) | Yes. Only NPC sheets; the pack's music, which is under a separate license, was never included. | `cast-v2/THIRD-PARTY-LICENSES.md` |
| `site/public/world/cast-v2/small-fire.png` | Stealthix, Animated Fires | CC0 1.0 (creator page) | Yes | `cast-v2/THIRD-PARTY-LICENSES.md` |
| `site/public/world/cast-v2/ui/*.png` | Kenney, UI Pack Pixel Adventure 2.0 | CC0 1.0 | Yes | `ui/LICENSE.txt` (original) |
| `site/public/world/fonts-v2/m5x7.ttf` | Daniel Linssen, m5x7 | CC0 1.0 (itch "Asset license" field, rechecked 2026-09-28) | Yes | `fonts-v2/LICENSE.md` |
| `site/public/world/brand/Daniel-Regular.otf`, `site/src/assets/fonts/Daniel-Bold.otf` | Fontery, Daniel | Free for any use. Sharing is allowed with the notice included; modified copies must not be distributed. | Yes, unmodified, with notice | `Daniel-license.txt` beside both |
| `site/public/audio/world-v1/recorded-steps-v1/*.wav` | Kenney Impact Sounds; SoftDistortionFX (freesound 398937) | CC0 1.0 | Yes | `recorded-steps-v1/ATTRIBUTION.md` |
| `site/public/audio/world-v1/original-theme-v1/*`, `site/public/audio/v2/*` | Original composition rendered with GeneralUser GS 2.0.3 | GeneralUser GS License v2 permits recordings; the soundfont itself isn't included | Yes (recordings) | `original-theme-v1/ATTRIBUTION.md`, `GeneralUser-GS-LICENSE.txt`, `FluidSynth-LICENSE.txt` |
| `site/public/audio/world-v1/suno-theme-b-v1/*` | Dex's original theme, Suno arrangement | Dex's paid-plan rights; not CC0 or a redistributable library | Already publicly served on dex.place | `suno-theme-b-v1/ATTRIBUTION.md` |
| Other `site/public/audio/world-v1/*` | ACE-Step local renders of the original motif; original synthesized effects and ambience | Project-original | Yes | `audio/world-v1/manifest.json` provenance fields |
| `site/src/imports/image*.png` | Screenshots of Dex's own Figma Make mockup, with small Unsplash backgrounds | shadcn/ui MIT; Unsplash License | Yes | `site/ATTRIBUTIONS.md` |
| `site/server/*` | Includes a reproducible LiveKit patch script | Apache-2.0 (LiveKit) | Yes | `server/LICENSE-APACHE-2.0.txt`, `server/THIRD-PARTY-NOTICES.md` |

Nothing third-party failed the check. The only asset exclusions for rights or privacy are the two event photographs above.

Dex's own art stays in its runtime locations: `site/public/content/illustrations/` (gallery artworks), `site/public/assets/art/`, `site/public/assets/portfolio/` (Towaki, VNMC banner, Vuc Menh MV frames), `site/public/assets/projects/` (dexCode, dexSMP, SP13 screenshots) and `site/public/assets/hero/`. Everything under `site/public/world/` apart from the third-party packs above, plus `planning-20260913/map-exploration/*.png`, is project-generated art from the Codex iterations.

## Secret and personal-data scan

Patterns grepped across all of `legacy/` (text files; the two published documentation ZIPs were also opened and scanned):

- `BEGIN .*PRIVATE KEY`, `AKIA…`, `ghp_/gho_/github_pat_`, `sk_[0-9a-fA-F]{20,}`, `xox[baprs]-`, `service_role`, JWT-shaped `eyJ….…` strings: **no hits**.
- `password|secret|token|api key` followed by `:` or `=` and a literal value: the only hits are obvious test fixtures (`isolated-kofi-verification-token-never-production`, `isolated-fixture-secret-never-production`, `fixture@example.invalid` and similar). Real credentials are resolved at runtime from Windows Credential Manager references (`DEX_PLACE_LIVEKIT_API_KEY/SECRET`, the tunnel token target), and no value is in any file.
- Files named `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.ppk`, `id_rsa*`, `auth.json`, `*credential*` or `.env*`: **none**.
- Email addresses: only `@example.invalid` / `@invalid.example` fixtures, plus three Playwright `page@<hash>.webm` artifact names.
- IP addresses: `127.0.0.1`, `0.0.0.0`, and the private LAN address `192.168.1.4`, mentioned three times in historical notes about a retired LAN preview. No public IPs, and no log files with IPs or user agents.
- Account and donor records: none. The server tests use synthetic fixtures only. The account IDs and account-state details found were removed as listed above: two account-proof scripts and the Suno request note. Value redacted here: `2466c4c6-…`.
- Already public and kept on purpose: the Ko-fi page `ko-fi.com/dexdonation`, and the MB Bank recipient THIEU GIA MINH with its account number, both shown on the old public donate page.
- Kept, and not secret: the LiveKit Cloud project hostname (`dex-place-7ptgm75w.livekit.cloud` in `site/scripts/run-production.mjs` and `art-production-notes/v2/IMPLEMENTATION-CHECKPOINT.md`), which browsers connect to anyway, and the Cloudflare Tunnel ID in `site/HOSTING.md`, which was already in the old dex-client repo. Neither grants access without the credentials held in Credential Manager.

## The 20 largest files

| Bytes | MiB | Path |
|---|---|---|
| 2,891,348 | 2.76 | site/public/assets/projects/sp13/dawnward-survey.png |
| 2,793,939 | 2.66 | site/public/assets/projects/sp13/dawnward-construction.png |
| 2,772,567 | 2.64 | site/public/assets/projects/sp13/vision/dawnward-vision.png |
| 2,731,886 | 2.61 | site/public/assets/projects/sp13/dawnward-terrain.png |
| 2,665,051 | 2.54 | site/public/world/registry/art/folio-material-v1.png |
| 2,379,270 | 2.27 | planning-20260913/map-exploration/suspended-interchange.png |
| 2,218,513 | 2.12 | site/public/assets/projects/sp13/vision/current-overview.png |
| 2,211,478 | 2.11 | planning-20260913/map-exploration/courtyard-between.png |
| 2,183,264 | 2.08 | planning-20260913/map-exploration/open-atrium.png |
| 2,123,018 | 2.02 | site/public/world/registry/art/tree-f19905ab72a8.png |
| 2,118,686 | 2.02 | site/public/world/registry/art/tree-43d42358b9e6.png |
| 1,873,406 | 1.79 | site/public/world/registry/art/archive-wall-00822674d050.png |
| 1,873,073 | 1.79 | site/public/world/registry/art/archive-wall-80a08d7c3d50.png |
| 1,822,522 | 1.74 | site/public/world/registry/art/arena-wall-eba27a6e169b.png |
| 1,819,154 | 1.73 | site/public/content/illustrations/inshot-20260721-200821729-display.webp |
| 1,808,314 | 1.72 | planning-20260913/map-exploration/arrival-central-v2.png |
| 1,796,043 | 1.71 | site/public/world/registry/art/vestibule-wall-f5f94270f218.png |
| 1,796,002 | 1.71 | site/public/world/registry/art/vestibule-wall-b45ef55da7e4.png |
| 1,793,090 | 1.71 | site/public/world/registry/art/junction-wall-4a04d2b16c3b.png |
| 1,792,036 | 1.71 | site/public/world/registry/art/junction-wall-2210057b5970.png |

## Optional drop candidates (not dropped)

The import is under the size target, so these stay. If space ever matters, these are the safest to cut:

| Candidate | Files | Size | Why it's safe |
|---|---|---|---|
| Superseded site preview screenshots in `site/public/world/preview/` (all `-v2` to `-v10` and unversioned `home/downloads/documentation/illustrations/donate-{portrait,wide}` files) | 100 | 38.36 MiB | No code, manifest or script names them; only the `-v11` set is referenced. |
| Superseded Registry art in `site/public/world/registry/art/` not listed in `assets.json` or named in code (e.g. `tree-43d42358b9e6.png`, `archive-wall-80a08d7c3d50.png`, `shared-ring-alpha-v1/v2.png`, `cloud-mid-alpha-v2/v3.png`) | 25 | 25.94 MiB | Earlier variants of rooms and materials. The Registry's `assets.json` points at the other variant. |

## Reproducing this import

The copy was done by a one-off script kept outside the repo at `D:\Dex\Temp\legacy-import\copy_legacy.py`. Its log is `copy-log.json` in the same folder. The post-copy removals, license additions and renames listed above were done by hand afterwards.
