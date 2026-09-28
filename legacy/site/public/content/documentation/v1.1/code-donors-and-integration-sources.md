<a id="code-donors-and-integration-sources"></a>
# Code donors and integration sources

2026-09-08 · Source specification 2.1 research expansion. **Research baseline adopted for implementation; current evidence is recorded in26.** No dependency installation, repository clone, account action, transport provisioning or runtime change was performed for this chapter.

[21](inhabited-world-and-experience.md) owns the experience and execution sequence; [22](dex-account-treasury-and-social-presence.md) owns account, treasury, ghost and voice contracts. This chapter identifies useful implementation sources. It does not add the features of those demos to our scope. **INSPECTED** means the cited source/license was read. **EXECUTABLE UNVERIFIED** means it has not been integrated or proved in dex.place. All external candidates below have that latter status.

<a id="1-actual-starting-point"></a>
## 1. Actual starting point

The inspected package owner (private website source workspace) and installed package metadata resolve Phaser 3.90.0, React/ReactDOM 18.3.1, Vite 6.3.5, DOMPurify 3.4.14, marked 15.0.12 and Playwright 1.62.1. DOMPurify's declared range is still `^3.2.6`; it is the resolved 3.4.14 source that matters to this review. These are local versions, not claims about the newest release of each project.

Existing owners remain the first code donors:

- Game bootstrap (private website source workspace) owns one Phaser instance, pixel rendering and renderer recovery. DOM input and the existing audio manager remain separate; copying a template must not create a second input/audio owner.
- WorldScene (private website source workspace) owns the current simulation and authored animation selection. Visual callbacks alone must not become the authority for damage, cable contact or download requests.
- Map loader (private website source workspace) currently reads top-level object layers and supported rectangular geometry. Nested groups, infinite chunks and arbitrary shapes are not already supported merely because Tiled exports them.
- UI (private website source workspace), lighting (private website source workspace) and environment (private website source workspace) supply existing integration seams. Preserve their ownership while adapting the new scrolling pages, contextual interactions, room composition and Low/reduced-motion behavior.
- The dexClient account manager (private website source workspace), dexCode account manager (private website source workspace), relay auth handler (private website source workspace) and account architecture (private website source workspace) own the existing shared identity. Supabase examples below support bounded adapters around that identity; they do not authorize another account system.

<a id="2-curated-source-register"></a>
## 2. Curated source register

These are twelve focused sources, not twelve new dependencies. Entries C23-01/02/03/05/06/11/12 are primarily references or existing-stack guidance. C23-04 is an optional UI primitive dependency. C23-07/08/09/10 require an explicit integration choice within the reviewed scope after GO. Branch-based version observations are dated snapshots; pin the selected tag/commit and recheck its license before copying code. A repository's code license does not automatically establish rights to every screenshot, font, recording or third-party asset it contains.

<a id="c23-01-phaser-3-source-animation-scene-lifecycle-and-renderer-limits"></a>
### C23-01 — Phaser 3 source: animation, scene lifecycle and renderer limits

**Source/license:** [Phaser 3.90.0](https://github.com/phaserjs/phaser/tree/v3.90.0), [MIT license](https://raw.githubusercontent.com/phaserjs/phaser/v3.90.0/LICENSE.md). Inspect the pinned [animation-update event](https://raw.githubusercontent.com/phaserjs/phaser/v3.90.0/src/animations/events/ANIMATION_UPDATE_EVENT.js), [ScenePlugin](https://raw.githubusercontent.com/phaserjs/phaser/v3.90.0/src/scene/ScenePlugin.js) and official [FX guidance](https://docs.phaser.io/phaser/concepts/fx).

**Use:** lifecycle semantics for room entry/exit, cancellation and cleanup; authored frame/contact metadata for attacks and mechanisms. Animation updates can occur several times within a rendered frame, and stopping an animation does not produce its completion event. Scene operations can be queued. Those details constrain our adapters rather than supplying a complete combat system.

**Limit:** use the installed 3.90 contract when rolling documentation differs. Phaser FX require WebGL; camera effects cover the camera output and extra passes cost work. Do not adopt Phaser 4 APIs, make a visual frame the sole hit authority, or blur the entire UI/gallery/QR presentation.

**After-GO proof:** low-frame-rate and interrupted attacks deliver each contact once; early room exit leaves no stale callback; cuts persist safely; Low/reduced settings and renderer recovery remain usable. Measure the composed lighting cost before retaining effects.

<a id="c23-02-official-reactphaser-bridge-and-existing-vite-6-build"></a>
### C23-02 — Official React/Phaser bridge and existing Vite 6 build

**Source/license:** [React TypeScript template](https://github.com/phaserjs/template-react-ts), [MIT license](https://raw.githubusercontent.com/phaserjs/template-react-ts/main/LICENSE), [PhaserGame bridge](https://raw.githubusercontent.com/phaserjs/template-react-ts/main/src/PhaserGame.tsx), [EventBus](https://raw.githubusercontent.com/phaserjs/template-react-ts/main/src/game/EventBus.ts). Vite's [6.x backend guidance](https://v6.vite.dev/guide/backend-integration) and [6.3.5 MIT license](https://raw.githubusercontent.com/vitejs/vite/v6.3.5/LICENSE) match our existing build family.

**Use:** one game held in a React ref, deterministic creation/destruction and explicit scene-to-DOM messages. Preserve existing Vite asset/build behavior when adding account endpoints beside the site.

**Version trap:** the inspected template [package](https://raw.githubusercontent.com/phaserjs/template-react-ts/main/package.json) describes Phaser 3 but actually selects Phaser 4.0.0 and React 19. Its scripts also invoke `log.js`. The template is an architectural reference, not a scaffold to paste over the project.

**Do not import:** its package manifest, logging helper, default scene/art, new host, React 19 or Phaser 4. No framework migration follows from using a bridge pattern.

**After-GO proof:** repeated entry/exit, React development remounts and route changes leave one canvas, one listener per event and one input owner; production asset URLs and existing downloads still work.

<a id="c23-03-tiled-authoring-and-json-contracts"></a>
### C23-03 — Tiled authoring and JSON contracts

**Source/license:** [Tiled](https://github.com/mapeditor/tiled), [component license map](https://raw.githubusercontent.com/mapeditor/tiled/master/COPYING), [GPL license](https://raw.githubusercontent.com/mapeditor/tiled/master/LICENSE.GPL) and [editor source notice](https://raw.githubusercontent.com/mapeditor/tiled/master/src/tiled/tiledapplication.cpp). The editor is GPL2-or-later; `libtiled` is BSD2, with other components listed separately. The official [JSON format](https://doc.mapeditor.org/en/stable/reference/json-map-format/) inspected here identifies Tiled 1.12.2 documentation; the local editor version was not checked.

**Use:** room/object organization, stable custom IDs, typed properties and reusable authored objects. Keep collision, visual depth, interaction anchors and room links independently inspectable. A normalized export may flatten supported groups into our existing runtime schema.

**Do not import:** GPL editor implementation into the browser or presume all example art has the same license. Do not silently accept unsupported polygons/chunks/templates or change stable cut/checkpoint IDs during map rearrangement.

**After-GO proof:** a small real exported room round-trips through the chosen Tiled version; unsupported content fails clearly. Traverse every new room link and return path, then reload old saves against the revised map without restoring unsafe transient geometry.

<a id="c23-04-floating-ui-for-contextual-dom-controls"></a>
### C23-04 — Floating UI for contextual DOM controls

**Source/license:** [Floating UI](https://github.com/floating-ui/floating-ui), [MIT license](https://raw.githubusercontent.com/floating-ui/floating-ui/master/LICENSE), [React primitives](https://floating-ui.com/docs/react), [package metadata](https://raw.githubusercontent.com/floating-ui/floating-ui/master/packages/react/package.json). The inspected React package is 0.27.20, with React 17-or-newer peers; it is not installed in this project.

**Use:** anchored interaction/popover positioning with offset, flip, shift and size constraints; virtual world anchors; dismissal and focus primitives. Install only if it improves the existing bounded positioning code. The visual materials and typography remain ours.

**Do not import:** a generic menu theme or blanket modal behavior. Full account/content pages scroll normally. Nearby/person controls retain their selected person and eligible listening while open, as22 requires. Lifecycle subscriptions must stop when their surface is absent.

**After-GO proof:** world anchor, camera, resize, zoom and mobile safe-area changes keep controls reachable; opening mute does not remove its participant or leak attack/PTT; closing restores useful focus without scrolling the player into danger.

<a id="c23-05-w3c-aria-authoring-practices"></a>
### C23-05 — W3C ARIA Authoring Practices

**Source/license:** [APG source](https://github.com/w3c/aria-practices), [repository license notice](https://raw.githubusercontent.com/w3c/aria-practices/main/LICENSE.md), [W3C Software and Document License](https://www.w3.org/copyright/software-license-2023/), [modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

**Use:** distinguish actual modal inspections from normal pages and lightweight popovers; meaningful labels, keyboard traversal, focus containment where appropriate and focus return. These are semantics and interaction guidance, not our site's visual design.

**Limit:** APG examples are references, not proof that a custom implementation works in every browser/assistive technology. The guidance is maintained as a living source; record the adopted pattern and test it against our actual DOM.

**Do not import:** `aria-modal` onto the entire scrolling website, a focus trap on every HUD element, or inaccessible canvas-only account/payment controls.

**After-GO proof:** complete keyboard and 200% zoom journeys; real Narrator speech inspection; actual Samsung Internet and iPad Safari checks, with versions recorded. Automated role snapshots supplement these checks and cannot replace spoken-output evidence.

<a id="c23-06-dompurify-for-the-document-reader"></a>
### C23-06 — DOMPurify for the document reader

**Source/license:** [DOMPurify 3.4.14](https://github.com/cure53/DOMPurify/tree/3.4.14), [package license declaration](https://raw.githubusercontent.com/cure53/DOMPurify/3.4.14/package.json), [Apache2 text](https://raw.githubusercontent.com/cure53/DOMPurify/3.4.14/LICENSE), [MPL2 alternative](https://raw.githubusercontent.com/cure53/DOMPurify/3.4.14/LICENSE-MPL). It is dual licensed **Apache2 OR MPL2**; retain the chosen license obligations for any redistributed code.

**Use:** the existing markdown-to-sanitized-HTML boundary as readers become full themed pages. Profile names, treasury aliases and other simple fields remain text rather than donor-supplied HTML.

**Limit:**3.4.14 is the installed version, not a reason to stop future security review. Re-evaluate supported options and advisories when changing the dependency or its allowlist.

**Do not import:** arbitrary remote HTML, scripts, unsafe URL schemes or permissive settings merely to make copied examples render. Sanitization does not turn document instructions into user authorization.

**After-GO proof:** headings, code, links and keyboard reading still work; representative unsafe HTML/URL fixtures are excluded; allowed document styling remains coherent with the site.

<a id="c23-07-supabase-provider-guidance-behind-the-existing-dex-account"></a>
### C23-07 — Supabase provider guidance behind the existing dex account

**Source/license:** [supabase-js](https://github.com/supabase/supabase-js), [MIT license](https://raw.githubusercontent.com/supabase/supabase-js/master/LICENSE); [supabase/ssr](https://github.com/supabase/ssr), [MIT license](https://raw.githubusercontent.com/supabase/ssr/main/LICENSE); official [server-side auth guidance](https://supabase.com/docs/guides/auth/server-side).

**Use:** provider session, refresh and PKCE concepts when implementing22's bounded website adapter around the existing relay identity. The local account/relay sources in §1 are the authoritative product starting point.

**Version/contract limit:** the official page labels `@supabase/ssr` beta with an unstable API. Its framework quickstarts do not establish our Vite/browser contract. Example Supabase cookies are not automatically the proposed opaque HttpOnly website session. No live provider/callback behavior was verified during this research.

**Do not import:** a new Supabase project, separate user IDs, desktop session files, frontend service credentials or a Next.js migration. Existing mobile bearer storage is a predecessor, not shared browser SSO.

**After-GO proof:** one real identity works through website registration/sign-in/recovery/refresh/logout and existing product boundaries; guest merge and safe map migration are repeatable; authorization prevents cross-user progress or contribution edits.

<a id="c23-08-socketio-room-presence-conditional-transport-reference"></a>
### C23-08 — Socket.IO room presence, conditional transport reference

**Source/license:** [Socket.IO](https://github.com/socketio/socket.io), [MIT license](https://raw.githubusercontent.com/socketio/socket.io/main/LICENSE), [rooms documentation](https://socket.io/docs/v4/rooms/), [server package](https://raw.githubusercontent.com/socketio/socket.io/main/packages/socket.io/package.json). The inspected branch package is4.8.3; choose matching client/server versions if adopted.

**Use:** authenticated room membership, join/leave/disconnect handling and bounded audience delivery. Our proposed messages carry compatible room/version/geometry, pose, activity and presence sequence/lease information. Those additions are our protocol design, not a claim that Socket.IO supplies them.

**Limit:** Socket.IO is not interchangeable with a raw WebSocket client. It is an alternative to a unified LiveKit data route; do not add two presence transports by default. Neither this repository nor the existing HTTP site proves a persistent socket origin is deployed.

**Do not import:** shared physics, shared boss state, global mechanism changes, demo chat or donor account storage.

**After-GO proof:** two independent clients see eligible ghosts while retaining different cut/boss states; stale/disconnected visitors expire; block, version mismatch, reconnection and sequence rejection behave honestly.

<a id="c23-09-livekit-sdk-and-actual-media-server"></a>
### C23-09 — LiveKit SDK and actual media server

**Source/license:** [client SDK](https://github.com/livekit/client-sdk-js), [Apache2 license](https://raw.githubusercontent.com/livekit/client-sdk-js/main/LICENSE), [package](https://raw.githubusercontent.com/livekit/client-sdk-js/main/package.json); [LiveKit server](https://github.com/livekit/livekit), [Apache2 license](https://raw.githubusercontent.com/livekit/livekit/master/LICENSE). The inspected client branch is 2.22.3; its own development toolchain does not require upgrading our Vite app. Official [ports/firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/) and [data-packet](https://docs.livekit.io/transport/data/packets/) guidance define the relevant transport seams.

**Use:** server-issued scoped grants, participant/track lifecycle, publish/unpublish, actual subscription controls and possibly pose delivery alongside audio. Choose a supported pinned client/server combination after checking the real service.

**Limit:** the SFU and ICE/TURN paths are distinct from the site's HTTP origin. Apache2 describes source rights, not free hosting, available capacity or zero bandwidth cost. Managed versus self-hosted service, reachability and operating cost remain OPEN.

**Do not import:** conferencing/video UI, open microphone defaults, recording/egress features or service credentials into the browser.

**After-GO proof:** secure-origin V/mobile hold-to-talk, release/blur/permission failure, two-network audio, mute/block/owner control, bounded room admission and reconnection; record actual media route and cost assumptions before calling voice complete.

<a id="c23-10-livekit-spatial-audio-example-algorithm-reference"></a>
### C23-10 — LiveKit spatial-audio example, algorithm reference

**Source/license:** [official example](https://github.com/livekit-examples/spatial-audio), [Apache2 license](https://raw.githubusercontent.com/livekit-examples/spatial-audio/main/LICENSE), [package](https://raw.githubusercontent.com/livekit-examples/spatial-audio/main/package.json). Inspected source commit: `fe9c218afea4dd57de907e553e468ed4d8e76077`; see its [SpatialAudioController](https://raw.githubusercontent.com/livekit-examples/spatial-audio/fe9c218afea4dd57de907e553e468ed4d8e76077/src/controller/SpatialAudioController.tsx).

**Use:** the concrete separation of distance-based subscription from local spatial playback, plus WebAudio node cleanup. The controller computes relative positions, subscribes only within a distance boundary and uses panner/gain paths. This is useful source evidence for building our own proximity adapter.

**Version limit:** the example package is 0.1.0 with Next 13.1.5, Pixi 7.1.1 and LiveKit client^1.6.3. It is not a tested current 2.x integration. Its mobile branch is implementation history, not proof of current mobile spatial support.

**Do not import:** the Next/Pixi app, legacy SDK contracts, numeric distance tuning or its room/token endpoint unchanged. Visibility, private-world compatibility, blocking and PTT rules still come from22.

**After-GO proof:** audible distance matches eligible active ghosts; faded, blocked, incompatible or withdrawn participants cannot remain audible. Camera-edge culling alone is not the inactivity rule: a compatible nearby person just outside the camera can still be spatially nearby. Verify no double playback and complete node/subscription cleanup on withdrawal. Mobile loudness and intelligibility must be heard on the requested devices.

<a id="c23-11-playwright-as-integration-evidence"></a>
### C23-11 — Playwright as integration evidence

**Source/license:** [Playwright 1.62.1](https://github.com/microsoft/playwright/tree/v1.62.1), [Apache2 license](https://raw.githubusercontent.com/microsoft/playwright/v1.62.1/LICENSE), official [ARIA snapshots](https://playwright.dev/docs/aria-snapshots).

**Use:** the existing browser harness for real keyboard/pointer journeys, DOM semantics, deterministic failure fixtures, video and representative composition captures. Match the installed package to its supported browser binaries; do not assume an old cached browser validates a new dependency.

**Do not import:** a test result as taste approval, injected world state as proof of traversability, or Windows WebKit emulation as physical iPad evidence. ARIA trees do not demonstrate Narrator speech or microphone quality.

**After-GO proof:** on frozen source, complete ordinary-input routes through rooms, map cut, boss-to-menu transition, document/art readers, treasury/account states and social controls. Pair automated receipts with motion/audio review and real device checks; preserve honest failed or unverified states.

<a id="c23-12-bruno-simon-2025-staged-lifecycle-and-discovery-reference"></a>
### C23-12 — Bruno Simon 2025: staged lifecycle and discovery reference

**Source/license:** [folio-2025](https://github.com/brunosimon/folio-2025), [MIT license](https://raw.githubusercontent.com/brunosimon/folio-2025/main/license.md), [readme/game-loop ordering](https://raw.githubusercontent.com/brunosimon/folio-2025/main/readme.md), and the author's [live portfolio](https://bruno-simon.com/).

**Use:** explicit update ordering from input through physics/player/view, then zones and interactive points, then dependent visual/audio systems. Reference the deliberate relationship between exploration and service interactions, and graceful operation when optional online services are absent.

**Limit:** this is a living 3D portfolio source, not a Phaser platformer package. The author explicitly says its server code is not shared and the portfolio works without it. It supplies no reusable ghost/voice backend proof.

**Do not import:** Three.js/TSL, Rapier vehicle control, the car, branding, bundled assets/music or extra achievements/social features. Our approved side-view pixel world and scope remain the target. MIT reuse still requires preserving applicable notices.

**After-GO proof:** inspect our actual lifecycle and first impression: useful input immediately after entry, predictable scene transitions, coherent interaction states and optional social failure that leaves the personal world usable. Similar architecture alone does not prove an equally compelling experience.

<a id="3-integration-decisions-these-sources-support"></a>
## 3. Integration decisions these sources support

**PROPOSED DEFAULT — keep the existing engine and owners.** Adapt small source-backed seams. A complete starter app costs us established input, audio, bank, release and pixel-rendering behavior. No engine, React, host or identity migration is part of this source selection.

**PROPOSED DEFAULT — authored contact events feed one simulation owner.** Each attack/mechanism state records telegraph, active contact, recovery and cancellation. The state machine resolves each contact once even if animation updates skip/repeat; presentation consumes that result. A boss victory enters the product menu through the specified transition and never itself starts a download. Saved discoveries/cuts remain persistent, while each new world product-menu visit requires a fresh encounter under 21/22.

**PROPOSED DEFAULT — normalize authored rooms before runtime.** Stable object/room IDs and geometry versions connect Tiled exports, saved exploration and ghost compatibility. A new map editor feature is admitted only after its exporter and our normalizer agree. Moving lifts, active fights and open menus are transient states, not safe checkpoints.

**PROPOSED DEFAULT — one presence transport after a feasibility comparison.** Prefer the smallest supported route that covers authenticated pose/activity delivery and voice. Socket membership or LiveKit data packets describe remote visitors; they do not turn bridges, mobs or boss fights into shared simulation. Presence admission and block rules must be enforced by the owner service, rather than trusting a remote client's visibility claim.

**OPEN — public media routing and cost.** Cloudflare documents [proxied WebSockets](https://developers.cloudflare.com/network/websockets/), including connection termination/reconnection considerations. That establishes an HTTP-upgrade capability, not a working dex.place socket endpoint. LiveKit documents separate ICE/UDP, ICE/TCP and optional TURN paths; infer neither working media nor permission to change firewall/DNS from a healthy HTTP tunnel. The eventual service must pass a real cross-network call and a bounded audience/cost review. Browser microphone access also needs a secure context and actual user permission under [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). No provider or account settings were changed here.

**PROPOSED DEFAULT — DOM behavior follows the surface.** Full themed pages, modal inspections and lightweight world HUD controls have different scroll/focus/presence consequences. Retain the chapter22 distinction: person controls keep their target available; full readers/account/Donate coverage withdraws social participation as specified. Positioning libraries and APG help implement that contract; their examples do not choose it for us.

<a id="4-after-go-adoption-receipt"></a>
## 4. After-GO adoption receipt

Before integrating a selected donor, record its exact version/commit, source paths, license/notice files, adapted responsibilities, rejected parts and the local owner receiving it. Keep code and third-party media provenance separate. Do not copy secrets, account state or demo telemetry into production. No raw credential or service key belongs in a client bundle or public documentation.

Then prove the smallest useful integration in the real world, inspect the resulting motion/layout/audio, and retain it only when it improves cohesion. Complete the integrated 21/22 journeys afterward; isolated donor demos cannot close those requirements. If a source is incompatible or its integration looks poor, replace that implementation choice while preserving the requirement and documenting the replacement.

This research establishes viable references and several concrete compatibility traps. It does **not** establish live browser SSO, room transport, proximity audio, donor animation quality, screen-reader speech or new public-release readiness. Those are implementation and observation results for the coming GO.
