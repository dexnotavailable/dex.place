# legacy

This folder is a salvage bank from the September 2026 Codex iterations of dex.place. It holds old code, docs and finished runtime assets so we can pull ideas, pieces or files forward on purpose.

Nothing in here is the live site. The live site is built from the rest of this repo. Nothing here is wired into that build, and the folder deliberately has no `package.json` at its root. If something in here is worth keeping, copy it out into the real site and review it there. Don't build or deploy from `legacy/`.

Imported on 2026-09-28. `MANIFEST.md` lists every source, count, size and exclusion.

## What's in each folder

| Folder | What it is | Came from |
|---|---|---|
| `site/` | The whole website source tree as it sat on disk, including about 56 changes that were never committed. It spans four iterations; see below. | `D:\Dex\Projects\dex-place-world\site` (branch `codex/dex-place-inhabited-v2-20260908`) |
| `planning-20260913/` | Planning docs for the Registry game, plus the map-exploration concept images and their prompts. **Start with `HANDOFF-20260926.md`.** It records what Dex wants, what was accepted and what should be reconsidered. | `D:\Dex\Projects\dex-place-art-production\planning-20260913` |
| `registry-pipeline/` | Text side of the Registry art pipeline: the Python/Node scripts, prompts, material and room JSON, and review reports. It has no images. | `D:\Dex\Projects\dex-place-art-production\registry-game-20260913` |
| `art-production-notes/` | A hand-picked set of decision, review and report docs from the rest of the art-production folder (audio, prototypes, provenance, source, v2). | `D:\Dex\Projects\dex-place-art-production\<folder>` |

## Iterations inside `site/`

The old repo mixed several attempts. Here's where each one lives:

| Iteration | When | Main code | Main assets |
|---|---|---|---|
| Earlier portfolio site ("experience") | July to August 2026, before the world | `src/app/`, `src/styles/`, `src/imports/`, `tests/experience.spec.ts` | `public/assets/` (Dex's portfolio art, project screenshots, hero brushwork) |
| v1 world, first published pass | Published 2026-09-08 | `src/worldsite/main.tsx`, `src/worldsite/game/` | `public/world/scene-assets.json`, `public/world/maps/`, `public/world/assets/` (library-v1, depth-library-v1), `public/world/hero/`, `public/audio/world-v1/`, `public/world/preview/` |
| v2 "inhabited" public site | Published 2026-09-08 as inhabited-20260908-c | `src/worldsite/v2/`, `index.html`, `server/` (account, Ko-fi intake and voice API) | `public/world/scene-assets-v2.json`, `rooms-v2.json`, `cast-v2/`, `fonts-v2/`, `assets/v2/`, `public/audio/v2/`, `public/content/`, `public/files/` |
| The Registry, a 12-room game | 2026-09-13, local only, never published | `registry.html`, `vite.registry.config.ts`, `src/worldsite/registry/`, `scripts/test-registry-*.mjs` | `public/world/registry/` |

`docs/world-website/` holds the long specification chapters behind v1 and v2. `HOSTING.md`, `IMPLEMENTATION.md` and `REVIEW-READY.md` are the old status records. The old agent instruction files were renamed to `AGENTS.historical.md` and `CLAUDE.historical.md` so coding agents don't load them as live instructions. They contain "GO" and authorization language that no longer applies.

## Things to know before reusing anything

- These are old notes, not current instructions. Dex's current direction is set in chat and in the repo root docs. Nothing in `legacy/` authorizes work, generation or deployment.
- Dex's own illustrations and portfolio art stay in the runtime locations they were served from (`site/public/content/illustrations/`, `site/public/assets/`).
- Every third-party runtime asset is CC0 and has its license note next to it: `site/public/world/hero/LICENSE.txt` (Martial Hero), `site/public/world/cast-v2/THIRD-PARTY-LICENSES.md` (wizard, rat, bat, townsfolk, fire, UI frames), `site/public/world/fonts-v2/LICENSE.md` (m5x7) and `site/public/audio/world-v1/recorded-steps-v1/ATTRIBUTION.md` (footsteps). The Daniel font is free to share with its notice (`site/public/world/brand/Daniel-license.txt`, with a copy in `site/src/assets/fonts/`).
- The Suno theme in `site/public/audio/world-v1/suno-theme-b-v1/` was publicly served under Dex's paid-plan rights. It isn't a redistributable asset library; see its `ATTRIBUTION.md`.
- `site/package.json` expects pnpm and the old Windows pnpm store. The Figma-era `src/app/` code also needs packages that aren't listed there. Treat all of this as source to read, not a project to install.

## Where the excluded raw material still lives

None of this was moved or deleted. The originals are all still on D: (read-only as far as this repo is concerned):

- Raw Registry production (room renders, layers, sheets, props, exports, the whole-map anchor, review images): `D:\Dex\Projects\dex-place-art-production\registry-game-20260913\`
- Audio production (Suno provider exports, ACE-Step renders, auditions, masters, instruments, proofs): `D:\Dex\Projects\dex-place-art-production\audio\` and `...\v2\audio\`
- Third-party asset intake (original archives, creator pages, previews): `D:\Dex\Projects\dex-place-art-production\v2\donors\` and `...\donors\`
- Prototype captures, provenance receipts, source exports, release staging: the matching folders under `D:\Dex\Projects\dex-place-art-production\`
- Build outputs and installed dependencies (`dist/`, `dist-registry/`, `node_modules/`) and proof screenshots (`design/`): `D:\Dex\Projects\dex-place-world\site\`
- Account data, runtime data and coordination notes: `D:\Dex\Projects\dex-place-world\runtime-v2\`, `runtime-v2-tests\`, `coordination\`. These are private and must never be copied into this repo.
