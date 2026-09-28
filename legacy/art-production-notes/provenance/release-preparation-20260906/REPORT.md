# Release staging and origin preparation

Status: **candidate d prepared and verified with the canonical-host server fix. No promotion performed; 25 audio listening reviews remain pending.**

Latest candidate: `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-d\site`. Its 207 payload path/size/SHA256 records are identical to candidate c, including all 41 compiled files, artwork, audio, map and documentation ZIP. All 33 tracked source inputs also match c and the post-verification source freeze. The release manifest changes only its candidate identity/build metadata; the separately staged server contains the new www redirect. Server SHA256: `61a6b8214b151f370c859006e94d0ccded1bfd0045daa10a9536fc2070848aab`. Public release-manifest SHA256: `cf94a9a07bfeeb3f7649328d843ced3e4efb448c591cf6683b4d9f91cc8224d3`.

All 15 HTTP groups passed against candidate d's own hash-checked reviewed server copy. The additional group checks 308 redirects for www.dex.place with case/port variations, exact encoded deep-path/query preservation, malformed target rejection before redirect, unchanged canonical/local-host responses and the canonical ZIP identity/preflight. Full release closure remains 167 references. This is local origin behavior proof; public DNS/tunnel/edge behavior has not been tested by this lane.

Candidate c's existing desktop/portrait cold-load proof and the normal native-input fight receipt are qualified by that complete payload hash equality. The fight receipt is `D:\Dex\Automation\Proofs\dex-place\20260906-build\candidate-c-final\chromium-staging-combat.json`: 24.479 seconds, one 193,966-byte ZIP with the frozen fd14303f... SHA256, zero errors. It explicitly uses an isolated HTTPS staging harness forwarding to local 5193 with unmodified bodies; it is not public delivery evidence. Neither browser suite was replayed for this server-only change. Qualification and proof links: `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-d\final-verification-receipt.json`.

Human playtesting should use `http://127.0.0.1:5188`. Frozen production preview `http://127.0.0.1:5193` still serves candidate c and the previous server version, with bytes identical to d's frontend. Its boss/download route intentionally retains canonical HTTPS file-origin validation and therefore requires the documented HTTPS staging harness. No listener was replaced or hosting task activated for candidate d; the HTTP verifier's 5189 listener is closed. Candidate c is preserved as history. The remaining paragraphs record its earlier checkpoint.

Candidate c: `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-c\site`. It contains 207 payload files plus its release manifest (208 staged files), 695,656,784 payload bytes and 695,699,491 total staged bytes. All 50 world roles, nine public gallery items, seven legacy files, 21 documentation chapters and the exact ten selected v4 previews are included. Older preview revisions are excluded. The docs ZIP is 193,966 bytes, SHA256 `fd14303f34c00bf48491bebd44ae18def84bc2aa9de05df961a880988eeecd69`.

All 14 HTTP groups passed, including 167 final JS/CSS/manifest references and the P17 CSS background/Daniel/WOFF2 font checks. Fresh Brave contexts at 1366×900 and 390×844 each made 68 successful requests, loaded the correct home v4 poster at its declared dimensions, removed the loading composition, exposed Enter world and displayed one renderer. Both loading and revealed captures were visually inspected. The cold-load test explicitly delayed only scene-assets.json by 2 seconds to make the real loading poster observable. This is emulated portrait browser evidence, not physical Samsung Internet/Safari device proof.

The builder's 33 tracked input hashes matched before/after build and again after HTTP/browser verification. Gallery pending is empty; audio pending remains 25. The publication gate was not invoked or bypassed for this preparatory build. Receipt: `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-c\final-verification-receipt.json`; HTTP/browser JSON files are in that candidate's `http-proof` directory. Captures `cold-home-{wide,portrait}.png` and `revealed-home-{wide,portrait}.png` are beside this report.

Frozen review server remains alive at `http://127.0.0.1:5193`: node PID 3368, exec session 93289, using candidate c's immutable `reviewed-server\serve-production.mjs` and candidate c's site root. The isolated Brave probe session was closed. Root owns final snapshot review and eventual server shutdown. Port 8088, scheduled hosting tasks, SP13 sources and the original site's files remain untouched by this lane.

The expanded dependency audit found that candidate b's compiled JavaScript references ten v2 preview images absent from its staged files. Evidence: `candidate-b-missing-posters.json` beside this report. Do not promote candidate b. Candidate c resolves that gap through bundled/public preview manifest agreement, scene hash, exact selected image hashes and final dependency closure. All numeric inventory and twelve-group HTTP results below describe the historical b checkpoint.

The historical candidate is `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-b\site`. It contains196 payload files plus the public release manifest, totaling690,465,602bytes. New website/media payload is23,824,032bytes; preserved legacy downloads account for666,601,132bytes. The first candidate remains as prior preparation evidence.

## Clean staging

- Policy: `D:\Dex\Projects\dex-place-world\site\release-allowlist.json`.
- Builder: `D:\Dex\Projects\dex-place-world\site\scripts\prepare-world-release.mjs`.
- Private proof: `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-b\preparation-proof.json`.
- Public relative-path/size/SHA256 inventory: candidate `release-manifest.json`.

Vite builds into an isolated private folder with automatic public copying disabled. The script then copies exact manifest-referenced world, hero, audio, gallery, documentation and ZIP files; required brand/character licenses; and license text from actual rendered runtime packages. It detects source changes during staging, verifies declared hashes/bytes and legacy checksums, checks every ZIP member against the public reader edition, and rejects private workstation paths, raw-generation fields and credential material in text exports. Existing staging directories are never removed or reused.

The candidate includes all50 unique world roles, all nine gallery display/thumbnail pairs, the32 encoded audio files, all21 portable documentation chapters and the real documentation ZIP. The current `B04-shell-depth-v2.png` is included directly from the live scene manifest. Runtime material dependencies and registered state masks are included through the same manifest.

149 public files are excluded, including every `world/trials` file, legacy artwork/project/portfolio directories, raw-display provenance and unused asset-production sidecars. Audio's public manifest is a runtime-only projection; production credit/model/edit/source fields remain in the original owner manifest and private proof. No original public files were deleted.

Source gallery publication and audio listening metadata still say `review-pending` / `pending`. This is recorded in private `reviewGates`, not silently promoted. Root should reconcile these fields from completed review evidence before using the builder's `--require-reviewed` publication gate. Whole-scene quality is explicitly outside staging proof.

## Precise hosting owner

The existing task definitions still point to:

- Site owner: `D:\Dex\Projects\SUMMER PROJECT 3\dex-client\site`.
- Static origin root: that owner's `dist` directory.
- Origin launcher: `scripts\start-production-origin.ps1`, registered with `-KeepAlive`.
- Origin implementation: `scripts\serve-production.mjs`.
- Tunnel launcher: `scripts\start-cloudflare-tunnel.ps1`, registered with `-KeepAlive`.
- Tasks: `\Dex\Dex Site Origin` and `\Dex\Dex Site Cloudflare Tunnel`.

Read-only task evidence is `hosting-task-readonly.json`. Both tasks were **Disabled**, with last run2026-09-03T10:52:05+07:00 and last result1073807364. No8088 listener was present. The public `https://dex.place/healthz` HEAD request returned Cloudflare530 at2026-09-06T12:00:54Z. This is an offline baseline, not a healthy public rollback claim.

The original owner's server remains its2026-07-28 source. Its exact snapshot is `original-owner-server-before.mjs`, SHA256 `ba130a9a55f1791924d8661888567c0471089f8ef014883cd2aea48a631d35d0`. It is text-equivalent to the isolated pre-change server after line-ending normalization; their raw file hashes differ. No credentials, tunnel token, identity store or private hosting logs were read, and neither task was enabled/started/re-registered.

## Legacy compatibility preserved

All seven current files under the original owner's `public\downloads` were copied and verified:

- dexClient0.1.0 installer and SHA256 sidecar.
- dexSMP Fabric26.1.2 Friend Installer ZIP and SHA256 sidecar.
- Hoshikawa Haven resource-pack ZIP, SHA1 and SHA256 sidecars.

The first binary remains665,563,123bytes. The script rejects an unexpected change to this exact legacy-file roster instead of silently dropping another existing link.

`/sp13` remains an external mount at `D:\Dex\GameDev\Deploy\SP13\WebGL`; it is not copied into the website release. The original narrow root-file allowlist and `releases/<id>/player/...` behavior are preserved. Current SP13 release is `atlas-web-unlit-97e0a48-97e0a4823851-atlas-web-public-003`. Its launcher references the allowed root JS/CSS files; the separate realm-proof helper file is not referenced by the active HTML/launcher and was not broadly exposed. Actual mount index/current/release HTTP reads passed on the candidate server. SP13 source, release, history and pointer files were not changed.

## Origin fixes and proof

Only the isolated site's server was changed. The tested copy is `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-b\reviewed-server\serve-production.mjs`, SHA256 `57e6b71db38432ce749736591b2da6a7d53ed5549f9a49f23c1631a988b232ff`.

1. Download attachment headers now apply to real legacy files and versioned ZIPs. `/downloads`, `/downloads/` and `/downloads/dex-place-documentation` return the SPA HTML without attachment headers.
2. ZIP, WAV, Opus/Ogg, M4A/MP4, MP3, SHA1, TTF and Markdown MIME types are defined.
3. The main root now uses the same canonical realpath containment as SP13. Windows junction escapes, source-like files and trial paths are rejected.
4. Malformed percent sequences, control/NUL characters, encoded backslashes and Windows alternate-stream colon paths return400 without killing the process.
5. Single byte ranges, suffixes, invalid ranges, ETag lists/304 and If-Range date/mismatch behavior are handled. Empty files return200/zero bytes without an invalid read-stream range.
6. Legacy downloads retain `private, no-store`; hashed/versioned immutable assets use immutable caching. HTML and mutable roots retain revalidation. SP13 current remains `no-store`, and SP13 releases remain immutable.
7. `DEX_SITE_ROOT` and `DEX_SP13_ROOT` permit explicit test roots. Importing the module does not start a listener. Defaults still fit the original launcher/dist layout.

Verifier: `D:\Dex\Projects\dex-place-world\site\scripts\verify-world-release.mjs`. Actual HTTP proof: `D:\Dex\Projects\dex-place-art-production\release-staging\preparation-20260906-b\http-proof\server-verification.json`.

All12 HTTP groups passed on127.0.0.1:5189, including all196 allowlisted payload-file HEAD responses, actual installer range bytes, docs ZIP suffix/headers, malformed request survival, two real Windows junction escape cases, empty files and compressed Unity WASM representation. The verifier closes its listeners;5189 was closed afterward.8088 and the hosting tasks were untouched. This is origin behavior proof, not public edge promotion or production-browser quality proof.

## Concrete next actions after root's quality checks

1. Finish the composed scene/control/mobile/publication/listening reviews and reconcile their metadata. Freeze the intended source/assets/edition.
2. Run `node scripts/prepare-world-release.mjs --id <new-reviewed-id> --require-reviewed` from the isolated site. Use a fresh ID after any source or asset change. Run `node scripts/verify-world-release.mjs <new-stage-site>` and root's browser checks against the built candidate.
3. Capture the original owner's current `dist`, exact server script, task enabled/running states and hashes in a release-specific rollback directory under `D:\Dex\Automation\backups\dex-place`. Verify resolved source/destination paths before any move. The captured baseline task states are Disabled.
4. Promote the verified candidate directory into the original owner's `dist` and the tested server into its `scripts\serve-production.mjs`. Keep the existing launcher/task definitions and SP13 mount. Do not rebuild from the original owner's older app source as part of this copy, because that would recreate the old site.
5. Only at the authorized promotion step, enable/start the exact Origin task and verify8088; then enable/start the exact Tunnel task through its existing credential-owning launcher. No task re-registration or direct token handling is needed for the observed definitions.
6. Recheck actual dex.place/www HTTPS, all four destinations, assets/audio/ZIP headers and handoff, legacy ranges/checksums, and `/sp13` behavior through the edge. Keep local and public evidence separate.
7. If promotion must be undone, restore the captured `dist` and server bytes and the captured task states. The rollback baseline is the prior paused/offline state; it must not be described as a verified healthy live site.

No commit, push, production-owner edit, public write, task activation or secret access was performed by this lane. Current production readiness remains unproven until root completes the whole-scene and public release gates.
