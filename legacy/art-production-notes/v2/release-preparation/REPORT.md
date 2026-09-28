# V2 documentation and release preparation

2026-09-08. Export and staging tooling is updated. **No complete v2 staging candidate or public deployment has been made in this lane.** Root is still revising room materials and loading previews; final input hashes and integrated statuses must settle first.

## Documentation 1.1 candidate

- Source specification2.1: all28 allowlisted chapters,367 sections,318 portable links, and all existing/new requirement and control IDs. Four physical archive destinations are derived from the actual v2 map rather than the old six-file map.
- Current unfrozen archive: `public/files/dex-place-documentation/v1.1/dex-place-documentation-v1.1.zip`,302191bytes, SHA256 `ab039ff663f194211a89ee5cf1172bd64bbfb5dfc1342db4d02d24b844da27bd`.
- Reader markdown and all30ZIP members have exact byte parity. Source snapshots are rechecked immediately before writes. Configuration pins source2.1 and output1.1; no directory-wide export.
- Frozen1.0 retains all29 files byte-identically, including its226602-byte ZIP with SHA256 `02b8b3f26c3c83c299274be52689f21cc921dbd559561d7a885797102ab85134`. Published marker, historical metadata and reader/ZIP parity are checked before reuse. The marker is not served in a candidate.
- Generated `documentation` contains28current plus22historical documents so old `?version=1.0` routes remain available. `download` stays latest; additive `documentationReleases` contains1.1 and1.0 for the product's version selector. Root owns ProductRecord integration.
- Shared gallery derivatives/manifest are verified but never rewritten by a docs export. Personal originals remain untouched.
- Public portability: exact workstation paths, task identifiers, private proof/account/provider setup records become role descriptions or narrowly curated implementation summaries. No credentials are read. Current banners say adopted2.1/current implementation, while earlier contracts retain explicit supersession. The original source and transformation hashes remain in the private export receipt.

Proof: `docs-candidate/private-export-review.json`, `frozen-v1.0-before.json`. Syntax checks and TypeScript pass. An actual App reader retry failed during initial renderer loading with `Framebuffer status: Incomplete Attachment` and a detached heading; browser closed. That receipt is `reader-proof.json`. It is not a reader pass, and concurrent editing has not been established as the cause. Retry once source is stable. Gameplay's earlier1.1 reader evidence predates the focused banner rewrite.

## Staging closure

`prepare-world-release.mjs` now derives the actual map from `PUBLIC_ASSETS`, checks the v2 entry, admits the reviewed room/scene/cast/font/UI manifests, collects authored frames and fire, and accepts the two reviewed audio families. The current policy expects54 raster roles,11rooms and7 actors; root must reconcile the count as new individually reviewed materials land.

Preview requirements: existing five section keys × wide/portrait, numeric-version WebP URLs, dimensions/hash/worldRect/anchor; exact current sceneSha256, mapSha256 and new roomsSha256. Old v10 plates deliberately fail the current v2 hash check. Root owns capture and layout metadata.

The immutable1.0 reader/download paths are explicitly retained. Current ZIP members are independently decoded and matched to online files. The staging privacy scan covers both `sk-` and `sk_` raw-key forms. Final JS/JSON dependency extraction now inspects actual literal data rather than treating Markdown code examples embedded inside strings as runtime fetches. Missing concrete imports, URLs or manifests still fail closure. CSS fonts/materials remain checked.

Both the original D: staging root and `A:/Dex/Archives/dex-place/release-staging` are accepted bounded private roots. A: requires an explicit `--out` child. Each candidate is new; no existing candidate is overwritten or removed. Recheck space before building. Live H and SP13 remain unchanged.

## Private service module

`scripts/bundle-website-service.mjs` exports `bundleWebsiteService({site,out})`. Preparation calls it with `<candidate>/server`; it creates `runtime.mjs`, complete exact dependency notices and `bundle-receipt.json`, outside the candidate's served `site/` directory.

Probe output `bundle-probe-1/server/runtime.mjs`:541748bytes, SHA256 `7dbbf34c0c0cf32ef4f5e8862142f8ec1608b00e0e9f46fa98ad0c298b1156a9`. Real Node24.18 ESM import exposes `createWebsiteService`; no listener, store or provider action was started. Bundled dependencies: livekit-server-sdk2.18.0, @livekit/protocol1.48.0, jose5.10.0 and @bufbuild/protobuf1.10.1. Only Node builtins remain external. Exact owned-source allowlist excludes tests, pilots, repair tools, configuration files and credentials.

The installed protobuf package omitted its full license file. The pinned fallback preserves its exact [upstream Apache license](https://raw.githubusercontent.com/bufbuild/protobuf-es/v1.10.1/LICENSE), plus the full Google BSD notice from the installed matching runtime. This same helper serves browser and Node dependency notices; unexpected package/license versions fail for review. Original SDK source/legal comments remain in the private bundle.

Root must pass canonical `origin`, the parsed staged `world/rooms-v2.json` as `map`, and explicit persistent `dataRoot` outside deployed/authoring roots. Root owns secret resolution, same-origin API mounting, one service/store process, startup/shutdown and actual account/media verification. The protected Windows identity resolver remains an external owner reference; no secret-store file was copied. The module bundle is not a media-server binary or proof of public voice transport.

## Final freeze steps

1. Reconcile source checkpoints/banners and new material roster; stop source writers for candidate preparation.
2. Inspect any changed gameplay/audio emitter methods, then refresh the audio selection guard if its contract changed. No blind seal update.
3. Capture root-owned v2 loading plates with exact scene/map/room hashes.
4. Re-export unfrozen1.1 with `python scripts/export-world-docs.py --proof-dir <private-proof>`; verify old1.0 unchanged and latest UI version links.
5. Prepare one new candidate, preferably explicit A: output if D: remains constrained. Review service sibling, licence receipts, privacy scan and final dependency closure.
6. Run updated HTTP verifier on its own loopback port, then complete frozen App/device/service/visual/listening proofs. Root owns promotion, rollback and eventual1.1 publication seal.

Preparing or importing is not proof of public delivery or whole-experience acceptance. No H/hosting task/tunnel modification, commit or push occurred here.
