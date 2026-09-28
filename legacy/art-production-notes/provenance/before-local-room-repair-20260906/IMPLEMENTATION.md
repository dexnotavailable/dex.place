# dex.place implementation checkpoint

**Latest steering:** Dex playtested and found the props/post-cut states incohesive, destinations clustered, stairs/footsteps poor and music too energetic/inconsistent. Boss work can wait. Candidate d is NOT promotable. Chapter20 owns the repair pass; source spec1.6. New goal-turn audit also found real renderer loss: simulation continued unseen. `game/index.ts` now latches loss and stops input; root is finishing its UI error handling. Prior "all independent work finished" and human-only blocker audit are invalid after this feedback. Continue world/audio work, not release promotion.

**Read REVIEW-READY.md first.** It is the compact latest state after candidate-d verification and all13 final native controls. The paragraphs below preserve earlier iteration history and are superseded where they differ.

Goal active; public finish line is unchanged. The previous goal work is classified as progress: authoritative code, assets and real browser proof were created. Do not mark complete from the current local build.

Current checkpoint (supersedes earlier progress paragraphs below): source specification1.5 reconciled; selected clean raw-frame preview revisionv4. Final taste pass resolved portrait missing landmark/Enter overlap, duplicated banner, gallery doorway appearance, Support framing/backing and weak value hierarchy. The final Support right-edge trim is included in v4. All9gallery exports and live metadata passed individual publication review; statuses nowpublic in manifest+sourceadapter, awaiting root exporter propagation. Source readyannouncement fixed with8real checks;47 qualified arrival/banner/lift assertions now recorded. Finalcoverage identified Browse hidingcontent, assistance not applying to activeboss andLarge touchmovement staying48; source fixes compile and targeted retest is ongoing. These are nonvisual wiring changes, so v4 raw picture geometry remains valid.

Release dependency audit caught missing loadingposters in oldcandidateb; that candidate must NOT be promoted. Builder now verifies selectedpreviewmanifest/hash/dependencyclosure; nextfreshcandidate waits for finaldocs/content export and sourcefreeze. Originalpublic remainsoffline/paused, noactivation. Human requests arepending for bankapp check of100kQR and65s audio sampler because the owning specification keeps these release-only checks separate. Do not silently mark music listened, bankverified, physicaldevicespassed or wholepublicfinished.

Discord current state: exact unresolved transaction was handed back to UNTIL YOU WAKE and our lease73c76e80-03dc-4d32-bb88-2efba7b270e4 released at12:19:34UTC. That task cleared the modal by restarting its exactDiscordprocess; newFriendswindow726252 had correctdexnotavailable account, but nativeinput still failed. Its lease also released. Boundedwebfallback found wrong Braveaccount dwmaanxxx and missing enrolledcredentialref, no login/send. Both messages remain sent:false in D:/Dex/Automation/DiscordBridge/queued-updates-20260906-1927.json. Humanmessage1546105272567595088 at17:30 said dex: to UYW and dex.place Any progress updates? Our exactprogress+scene/audio/QR attachmentpaths are queued; no messageID exists for a dex.place send. No ongoing Discord input owner, no further restart/input loop withoutnew evidence. An earlier pending request to close the modal is nowobsolete; actual blocker is input/login routeavailability. Use prefixes/replyIDs to route anyfuturehumanreply.

Latest continuation: layered scene v3 and full independent prop integration now exist. `scripts/compose-world.mjs` owns56 named placements plus all50 asset roles; `src/worldsite/game/environment.ts` owns static grounds/interior/fog/water, `assemblies.ts` and `assemblyArt.ts` own physical art states. WorldScene owns sentinel body/arm articulation. Root camera math is shared with loading preview through `camera-frame.ts`. Posterv1 was rejected because DOM-clipped screenshots included Enter world; selected v2 is raw canvas captured at RAF, under public/world/preview/*-v2.webp. Native files/private raw receipt remain under art-production/source/exports/world-posters-20260906-v2. Loading/anchored banner changes compile and still need focused fresh proof. Consumed banner slash now clears its frozen arc; settled banner and terminal state reset fixed.

Controls-finish report has50 passing assertions including real normal fights, retained exact snapshot, cancellation/timeouts/withdrawal/manual recovery, donation and asynchronous audio status. Cross-engine report now verifies actualFirefox153 and WebKit26.5Windows, fourDOMdestinations at six viewport/text settings, native QRSave/Open and real HTTPS-staging normal fights. This is isolated local routing, not publicproof. Firefox WebAudio works; this WebKitWindows binary lacks AudioContext and correctly remains silent. PhysicalSamsung/iPad and listening remain unproven. Frozen5192 preview is test-only and must never be promoted wholesale.

Release prep agent owns scripts/prepare-world-release.mjs, release-allowlist.json and isolated scripts/serve-production.mjs fixes. Candidate retains7legacydownloads (~666MiB), excludes trial/private metadata, and preserves externalSP13 mount. It is not public. Server tests on5189 underway. Root_controls_finish now has a read-only live taste review; preliminary finding agrees root: scale/pixelcohesion reads, but daylight midtones and competing small structures still need stronger lighting and focal hierarchy. Do not call this visually finished.

## Current owner

- Isolated code: D:/Dex/Projects/dex-place-world/site, branch codex/dex-place-world-20260906. No commits/pushes authorized.
- Docs: docs/world-website, latest strict flat2D/pixel-scale steering is in01/10/19. The user gave go; earlier planning-only text is historical.
- Production: D:/Dex/Projects/dex-place-art-production; provenance/world-asset-inventory.json and per-asset receipts. Run provenance/reconcile_inventory.py to merge raw receipt status without granting runtime acceptance.
- Dev: http://127.0.0.1:5188, running Vite. Public dex.place/origin8088 were offline and hosting tasks Disabled at preflight; do not confuse local proof with public delivery.

## Proven work

- React shell/pages/settings/physical banner and authored CC0 Phaser world build successfully. Native Tiled1.12.2 export used.
- First desktop integration:8 real browser checks passed; screenshots under D:/Dex/Automation/Proofs/dex-place/20260906-build/first-browser-pass.
- World actions: all6 physical document/hash targets, lift carry/pause, all18 SFX events, native6-frame death and real normal fight victory with exactly one hash-verified ZIP download. Proof: art-production/provenance/world-actions-20260906/summary.json.
- FG01/P02 flatv3 sources cleaned, native-grid integrated and locally inspected. Whole scene is still a visual blockout with most assets unintegrated.
- 50 world-art roles have separately generated first drafts after batches A–F plus root M10/B03. Raw coverage is not acceptance. Some earlier near assets need flat2D replacements; middle/background need depth/pixel/alpha cleanup and actual composition.
- Audio:5 music loops,2 ambience,18 effects,32 browserfiles; local ACEv1 + authored motif, no providercredits/downloads. Browser manager21 checks pass. Subjective listening and physical devices remain pending; tools cannot hear audio.
-9 gallery display/thumbnail exports are aspect-preserving verified derivatives; public metadata review still pending.
- QR actual-image decoding and independent TLV/CRC pass all991 amounts; bank recipient lookup still requires real bank app.
- Mobile source bugs fixed/retested: action-cluster jumping, 200%text header/navigation, fullscreencontrols/zero-size renderer, portraitzoom1.25, captions, foldingdropdownfocus/Escape. Proof mobile-first-pass/RETEST.md.

## Latest changes needing focused retest

- Gallery now supports4x zoom and percentage display (source correction).
- Donate rewritten for page-session amount retention, drag preview/commit/cancel, all5 presets, precise keys, associated numeric errors, valid-only Apply/Enter, separate Retry QR failure, immutable generated amount and blob image links. tsc passed; native focused regression pending.
- Exact download bytes/hash verified before arming, but retry/victory revalidation and wrong IDs/version/query handling still need closure.
- Control coverage:101 IDs plus aliases, recorded in control-coverage; presence is not a complete browser pass.

## Highest-priority remaining work

Composition checkpoint: all50 independent source roles now exist; all28 remaining near candidates and20 middle/far candidates have clean public-safe sidecars. Root is assembling them through named data placements, retaining native near pixel pitch and using strict2D silhouette variants for B03/M10. Whole-scene acceptance remains pending. Replace placeholder masses with a dominant far landmark, open water/haze, narrower middle structures and distinct occupied floor planes; keep the user's personal illustrations out of world textures. Decorative Low settings reduce atmosphere/reflection density while preserving floor, objects and landmark readability. Audio_finish owns physical assembly art; root owns environment, camera and sentinel articulation. Section-controls proof now50 focused passes; root_controls_finish owns remaining root/global/download/donation closure.

1. Finish clean exports/replacements and assemble all50-role library across all places; major missing work is actual cinematic/emotional composition, depth, sky/water/lighting and independently animated props, including real banner parts and sentinel body/arm.
2. Resolve control-coverage omissions: DOC category, code Copy, responsive Contents/headinglinks/index state; SYS true Skip; exact route/version validation; remaining settings/gallery/failure states. Do not remove specs to hide gaps.
3. Integrate layer quality presets, loading/arrival transition from the real scene, local audio + root asynchronous audio status; conduct whole-scene taste review and full journeys.
4. Exclude public/world/trials and any private source/provenance metadata from release. Freeze/re-export the public docs edition only after final spec reconciliation; current edition1.0 is unpublished.
5. Full supported browser/mobile matrix, real Samsung/iPad/bank checks when possible, audible review, then scoped hosting promotion with rollback and public verification.

## Discord updates: explicit authorization

Dex asked for milestone updates through his existing Discord account in server aa, #general. Label every outgoing message [dex.place] and identify it as from codex. Replies use dex:; act only when clearly addressed to this website, using reply context/project name. Other tasks also post here; their updates are not user instructions.

Use Computer Use node_repl @oai/sky. Exact observed app com.squirrel.Discord.Discord; window id263226, app process:C:/Users/sanic/AppData/Local/Discord/app-1.0.9256/Discord.exe. Always revalidate live channel and draft before typing/sending. It changed to a DM once; no message was typed or sent. Another task [Codex UNTIL YOU WAKE] was later seen composing an unsent update; do not alter or submit it. Our first Discord progress message is STILL PENDING. Never claim sent until it is visible in chat.

Computer Use skill/guidance/api/confirmation files were read. User explicitly authorizes these progress messages and project attachments; no repeated generic send approval is needed. Current UIA indexed click returned cache errors; screenshot-coordinate click works after foreground activation, but shared-app contention requires careful current-state checks. No PowerShell UIA while using Computer Use.

Browser tool: D:/Dex/Tools/agent-browser/0.36.0/agent-browser.exe. Direct binary avoids npx self-update/EBUSY. Use isolated headless Brave, never Codex IAB. Quote @refs in PowerShell. Playwright native keyboard through verified CDP is used for held movement; no cheat state injection.


Discord collision update: UYW task is 01a07498-d078-75d3-a17c-23e70b9a0708 (app title Summarize shared ChatGPT chat). Both tasks acknowledged input pause via app-native coordination. UYW kickoff was sent as message1546098479338749984. Our paragraph landed in UYW's attachment File name field when that modal appeared between observations; no Open/Send was pressed. UYW will cancel/recover its own picker and create shared lease helpers under D:/Dex/Automation/DiscordBridge, then explicitly yield. Do not issue further Discord input until that handoff and lease acquisition. Native Discord is the authorized dexnotavailable account; Brave Discord is a different account. First dex.place progress message remains unsent. Only project-matched dex: replies are user steering.

Shared Discord lease is now implemented by UYW: D:/Dex/Automation/DiscordBridge/Discord-UiLease.ps1. Read README first. Acquire with -Action Acquire -OwnerThread 01a07479-4f4a-7031-8a51-34c5576ab262 -Purpose 'dex.place Discord update'; proceed only status=acquired, keep leaseId. Renew/Release require exact owner+leaseId. Busy/expired never permits takeover. UYW still holds the lease and will explicitly yield. Hold a lease even for Discord state observations to avoid shared accessibility-cache races. No Discord heartbeat exists in this task yet; any later one must use this protocol, project prefix and dex: routing.

Discord recovery update: acquired lease73c76e80-03dc-4d32-bb88-2efba7b270e4 at2026-09-06T10:30Z. Fresh native state exposed Open dialog2240/Cancel2390, but screenshot-1 Cancel and separately refreshed Escape both failed 'failed to activate captured window'. No Open/Send pressed. A single asynchronous request asks Dex to press Esc when back and reply closed; primary goal work continues. UYW was notified. Keep this lease unresolved (renew exact owner/id before any later Discord action); do not clear it as if modal closed. Our first progress message still queued/unsent. Input attempted in picker was only the known plain progress paragraph, no executable command or file selection.
