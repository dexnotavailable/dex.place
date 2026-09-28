<a id="build-readiness-and-scope-closure"></a>
# Build readiness and scope closure

Design baseline. Requirements and proposals below describe intended behavior; release verification is recorded separately.

**CONFIRMED** is Dex's instruction. Every other concrete mapping, budget, implementation sequence, and internal filename below is **PROPOSED DEFAULT** unless marked **OPEN** for a factual/proof gap. A later go-ahead to the reviewed package accepts its proposed defaults within that scope; it does not mean every production gate has passed.

<a id="1-current-decision-and-authorization-boundary"></a>
## 1. Current decision and authorization boundary

- **CONFIRMED:** Dex rejected the generated animations as suitable production work. The built-in result was the least bad, with its slash only tentatively acceptable; that feedback does not promote the result into the game.
- **CONFIRMED:** Use the authored CC0 Martial Hero for the current stage. Original animation remains a future endpoint.
- **CONFIRMED:** Assemble the remaining website specification before go. That documentation closure is complete enough for the received go; production, implementation and scoped public delivery now follow 15/18. The rejected character sprite-model comparison remains closed.
- **CONFIRMED:** The first boss reward is the full website documentation ZIP. Existing personal art remains display-only in Illustrations.
- The selected route remains Phaser + Tiled + Krita in the React/Vite shell. A local Phaser world now imports the authored Tiled map and uses the unchanged donor clips; the current scoped runtime receipts are summarized below. This progress does not reopen engine selection or infer unrecorded editor/device proof.
- The first playable uses the donor as authored, with the explicit reused-state mapping in [10](world-production-workflow.md). Do not require a redesign, recolor, new aerial animation, or missing-pose repaint before play can begin.
- All four sections and their existing controls remain in scope. No account, inventory, currency, shop, new primary tab, bank login, or unrecorded control is introduced by closing these gaps.

<a id="2-decisions-sufficiently-specified-to-start-after-go"></a>
## 2. Decisions sufficiently specified to start after go

| Area | Fixed direction / proposed implementation default | Owner |
|---|---|---|
| Identity | Lowercase `dex`, Daniel mark, restrained factual copy. | [01](art-direction-and-audio.md) |
| World | Connected liminal platformer, wide framing, small readable traveler, modular objects. | [02](world-and-gameplay.md), [10](world-production-workflow.md) |
| Runtime/editor | Phaser game layer and Tiled authoring integrated with the existing DOM shell; Krita preserves donor registration and exports. | [07](content-runtime-and-hosting.md), [10](world-production-workflow.md) |
| Character | CC0 Martial Hero unchanged initially; concrete clip/state reuse, no production generated sheets. | [10](world-production-workflow.md) |
| Downloads | Exact docs artifact selected before combat, one-shot intent, direct link, disarmed refresh. | [03](sections-and-controls.md), [05](shell-and-system-controls.md) |
| Documentation | One sanitized edition supplies both online pages and reward ZIP; six file props link into the complete index. | [03](sections-and-controls.md), this chapter |
| Gallery | Nine known local images, basename titles and inspected factual alt; story/captions later; public metadata review before release. | [03](sections-and-controls.md) |
| Donations | Ko-fi and MB Bank contracts, selected VND amount, coherent QR, no inferred payment completion. | [04](donation.md) |
| Sound | Existing opt-in controls and composition/export plan; local-first production under 14, ElevenLabs reserved; no visitor/runtime generation. | [12](audio-composition-and-budget.md), [14](local-audio-model-research.md) |
| Responsive behavior | Mobile framing/touch, keyboard/DOM alternative, reduced motion, fixed readable controls. | [06](mobile-accessibility.md), [11](framing-and-sprite-comparison.md) |
| Delivery | Local proof first, public origin preserved until a scoped deployment step; release checks remain mandatory. | [07](content-runtime-and-hosting.md), [08](acceptance-and-delivery.md) |

“Specified” means no additional taste menu is required to start that work after go. It does not mean installed dependencies, imported donor assets, device behavior, or public availability have been proven.

<a id="3-fight-route-and-pause-closure"></a>
## 3. Fight route and pause closure

- Treat the encounter as an in-memory submode of `/downloads/:productId?release=<releaseId>&artifact=<artifactId>`.
- `Fight & download` snapshots that exact selection, hides the details panel, and enters the arena without a new fight URL or history entry.
- Menu, Settings, Controls, and their Back/Resume actions preserve the encounter/intent and its selected URL while paused. They do not become navigation events.
- Any primary-tab activation cancels first, including Downloads while that tab is already highlighted. Then the selected primary index opens under the existing navigation contract.
- Browser Back that leaves the selected details, Home, Leave fight, world restart, text-only mode, refresh, or page exit disarms the encounter. A late victory callback cannot resurrect it.
- Refresh reconstructs the exact product/release/artifact details when still available, with no fight, armed download, held input, or autoplay audio.
- Victory/result retains the same selection; a manual retry requests that artifact only. Replay is explicitly unarmed. Unavailable metadata never silently selects replacement bytes.
- Donation method selection stays within `/donate`; its Change method/Close/Back behavior is exactly [04](donation.md) and [05](shell-and-system-controls.md), not a second history convention.

<a id="4-local-artifact-proof-versus-public-delivery"></a>
## 4. Local artifact proof versus public delivery

The documentation ZIP must exist before its local fight/download proof. It contains the reviewed portable edition below, with real filename, byte length, SHA-256, release ID, and artifact ID. A fixture can test isolated state logic; it cannot satisfy the confirmed first reward.

| Environment | Permitted artifact source | What a pass establishes |
|---|---|---|
| Local development | Separate development manifest; HTTP on the exact declared loopback origin/port; actual packaged docs ZIP. | Local selection, fight, one-shot handoff, headers, archive integrity, and refresh/cancellation behavior. |
| Production candidate | Production manifest with public HTTPS URL and immutable versioned bytes; no development override. | A build suitable for the remaining release checks, not automatic public success. |
| Public release | Verified HTTPS response through the actual dex.place edge/origin, plus browser interaction proof. | Only the publicly exercised behavior and artifact version. |

- The loopback exception requires explicit development mode and the configured exact origin. It cannot authorize arbitrary local paths, private LAN origins, `file:`, `data:`, `blob:`, or another unrelated local file.
- A production build rejects loopback/private-network destinations and local-file schemes even when metadata otherwise looks complete. Development records must not enter its manifest.
- Correct ZIP responses do not use the SPA fallback or return HTML under a successful ZIP status. Validate actual content type, attachment filename, byte length, and checksum.
- A local HTTP transfer is not public HTTPS proof, and a file response is not proof the browser finished writing the file to disk.
- Preserve the existing public site and accepted releases throughout local proof. Promoting a replacement and retaining a rollback build are separate delivery tasks, governed by the actual later authorization.

<a id="5-one-reviewed-public-documentation-edition"></a>
## 5. One reviewed public documentation edition

The online reader, search index, physical-file targets and ZIP share one reviewed sanitized export and edition ID. The current source specification is revision 1.8; public documentation edition 1.0 remains an unpublished repair candidate. The five-room repair is integrated locally with scoped traversal and interface proof. Music, recorded footsteps, physical-device checks and whole-experience acceptance remain open; boss work is deferred under [the world-cohesion revision](world-cohesion-revision.md). This export does not establish public promotion. Reader records, sanitized files, ZIP and release metadata must be generated from the same bytes and reviewed together. Candidate exports may be refreshed before first publication. Once published, versioned bytes are immutable and later changes require a new public edition. A version label or generated archive does not establish public availability.

<a id="explicit-source-allowlist-and-portable-names"></a>
### Explicit source allowlist and portable names

Only these website-specification sources are included initially. Each source is read through the transformation rules below; allowlisting a chapter is not permission to copy its private operational facts unchanged.

| Private source filename | Export filename / reader slug |
|---|---|
| `README.md` | `index.md` / `index` |
| `00-decisions-and-scope.md` | `decisions-and-scope.md` / `decisions-and-scope` |
| `01-art-direction-and-audio.md` | `art-direction-and-audio.md` / `art-direction-and-audio` |
| `02-world-and-gameplay.md` | `world-and-gameplay.md` / `world-and-gameplay` |
| `03-sections-and-controls.md` | `sections-and-controls.md` / `sections-and-controls` |
| `04-donation.md` | `donation.md` / `donation` |
| `05-shell-and-system-controls.md` | `shell-and-system-controls.md` / `shell-and-system-controls` |
| `06-mobile-accessibility.md` | `mobile-accessibility.md` / `mobile-accessibility` |
| `07-content-runtime-and-hosting.md` | `content-runtime-and-hosting.md` / `content-runtime-and-hosting` |
| `08-acceptance-and-delivery.md` | `acceptance-and-delivery.md` / `acceptance-and-delivery` |
| `09-sources-open-items-and-changelog.md` | `sources-and-change-rules.md` / `sources-and-change-rules` |
| `10-world-production-workflow.md` | `world-production-workflow.md` / `world-production-workflow` |
| `11-framing-and-sprite-comparison.md` | `framing-and-sprite-comparison.md` / `framing-and-sprite-comparison` |
| `12-audio-composition-and-budget.md` | `audio-composition-and-budget.md` / `audio-composition-and-budget` |
| `13-build-readiness-and-scope.md` | `build-readiness-and-scope.md` / `build-readiness-and-scope` |
| `14-local-audio-model-research.md` | `local-audio-model-research.md` / `local-audio-model-research` |
| `15-after-go-workflow.md` | `after-go-workflow.md` / `after-go-workflow` |
| `16-copy-and-input-contract.md` | `copy-and-input-contract.md` / `copy-and-input-contract` |
| `17-arrival-and-first-impression.md` | `arrival-and-first-impression.md` / `arrival-and-first-impression` |
| `18-physical-interface-and-review-loop.md` | `physical-interface-and-review-loop.md` / `physical-interface-and-review-loop` |
| `19-world-asset-inventory.md` | `world-asset-inventory.md` / `world-asset-inventory` |

Reader project ID is `dex-place`. Every exported heading has a stable explicit ID. A new source chapter requires an allowlist update and review; directory enumeration cannot silently expand the archive.

<a id="transformations-and-exclusions"></a>
### Transformations and exclusions

- Preserve all public-facing rules: appearance, navigation, each control ID/label, interaction states, timings, accessibility, amounts/payment facts, failure behavior, documented scope, and acceptance expectations.
- Preserve whether a detail is confirmed, proposed, deferred, or awaiting proof. Sanitation must not make a proposal appear user-confirmed or turn a planned feature into a shipped claim.
- Replace absolute workstation paths and owner-file links with portable role names or links to the equivalent exported chapter. Explain necessary architecture without exposing machine folder names.
- Remove provider request/job IDs, workspace names, credit balances, raw cost/account ledgers, private proof paths, operator chronology, task IDs, and secret-reference identifiers.
- Retain relevant general experiment lessons and production constraints without private attempt/account records. Chapter 19's roster, counting rules and pixel-scale contract are public design material; exact draft paths, live generation handles, private inventory and derivative accounting are excluded or rewritten as general review requirements. No generated raw sprite sheet is bundled as website documentation media by default.
- Exclude private implementation guidance, private ownership records materials, credentials, API keys, machine logs, auth/session files, scripts used to operate accounts, original illustration masters, donor archives, and unrelated project documents.
- Keep explicitly public donation facts from [04](donation.md), including Ko-fi URL, MB Bank account, recipient name, supported range, and QR rules. Their deliberate publication is distinct from credentials or private operator accounts.
- Rewrite every internal link to the portable export filename and stable anchor. Keep relevant public official-source links. Private file links cannot survive as broken public links.
- If a paragraph mixes a required public rule with private context, rewrite that paragraph to preserve the complete rule. Do not solve privacy by deleting an entire feature section.

<a id="coverage-and-packaging-proof"></a>
### Coverage and packaging proof

1. Produce a private review manifest listing every allowlisted source revision/hash and its output mapping.
2. For each source section, record Included, Rewritten, or Excluded with a reason. A coverage check accounts for every requirement/control and flags an excluded public-facing rule.
3. Keep detailed transformation/exclusion evidence private; its own paths and operational notes must not enter the archive.
4. Emit a public edition manifest with version, public filenames, slugs, heading IDs, and hashes of the sanitized files only.
5. Build online pages/search from those exact sanitized files. Their source-edition hashes match the files packaged into the ZIP even if rendered HTML bytes differ.
6. Package the edition index/chapters/manifest with portable links; then calculate the finished ZIP's byte length and hash for its external release record. Do not insert a self-referential ZIP hash that changes its own bytes.
7. Re-open the actual ZIP and traverse representative cross-chapter links plus all six physical-file destinations. Inspect emitted online/search records for private-data leakage and missing rules.
8. Freeze a reviewed edition. Later source changes require a new export/review/version; do not mutate the bytes of a published documentation release.

The exact six file IDs and targets are in [03](sections-and-controls.md). Each destination names an existing source heading and pins the exported edition. All other chapters still appear in the complete index with no collect/seen gate.

<a id="6-initial-local-gallery-closure"></a>
## 6. Initial local gallery closure

- Use exactly the nine recovered exports listed in [03](sections-and-controls.md); use their basename titles and the minimum factual alt text based on actual inspection.
- Do not invent series context, identity, dates, media, captions, or relationships. The confirmed Kaizen/Convergence fact does not license a new story summary.
- Detailed descriptions are deferred. Missing long captions do not block building the gallery, navigation, or world.
- Local display review does not equal public publication review. Before public release, review the selected image, title, alt, and intended display export; unpublished items remain excluded from the production manifest.
- Import only approved display copies; PSD/CLIP/PNG authoring masters stay private. Existing art never becomes a world, prompt, player, background, or texture source.
- Keep thumbnail/display aspect ratios and neutral presentation. Filename-based titles are an honest local baseline, not an assertion that the filename is the artwork's authored title.

<a id="7-media-and-authoring-budgets"></a>
## 7. Media and authoring budgets

| Resource | Proposed technical budget / boundary |
|---|---|
| World pixel atlases | PNG, maximum 2,048 px per edge; preserve registered frames and metadata. |
| Initial decoded world textures | Retain the approximately 64 MiB image-surface ceiling, originally expressed as four full-size 2048-square RGBA atlases. The compact first map currently uses 50 shared independent texture roles at 33.97 MiB plus 6.4 MiB for the hero; this is a resident compact-map implementation, not proof of future remote-zone streaming. |
| Gallery thumbnail | Maximum 512 px longest edge, preserve aspect, no upscaling. |
| Gallery display | Maximum 2,048 px longest edge, preserve aspect, no upscaling. |
| Large gallery residency | Current plus at most one adjacent image, maximum 32 MiB decoded RGBA; evict obsolete display images. |
| Private masters | Preserve editable sources, native donor frames, approved private PNG masters, and provenance outside served assets. |
| Audio | [12](audio-composition-and-budget.md) owns formats, composition/stems, compressed/decoded limits, and listening proof. |

RGBA estimates use width × height × 4 bytes; one 2,048-square surface is 16 MiB. They are image-surface budgets, not total GPU/process-memory guarantees. Record actual additional texture copies, buffers, and effects overhead when measuring the prototype.

Private authoring now lives at `private asset-authoring root`, with source/donor/map/animation/audio/provenance roles kept outside served outputs. The earlier `public/assets/world/<build-revision>/` and illustration-root sketch was a planning path. Current selected world assets are under `site/public/world/`, audio under `site/public/audio/`, and display/content files follow their checked manifests and release allowlist. Never serve a private source root or promote the entire development public directory. This documentation reconciliation writes no media, mirrored originals or generated public edition.

The authoring source root is outside the website repository. Its version-control setup remains separate scoped work; committing or pushing still requires Dex's request. No current branch commit, bulk mirror, or unrelated client/catalog change is implied.

<a id="8-carry-the-actual-reviewed-spec-into-implementation"></a>
## 8. Carry the actual reviewed spec into implementation

Transfer the reviewed design package into the implementation checkout explicitly; a clean revision alone may omit later approved documents. Record each allowlisted source file, byte length and hash in a private handoff manifest. Copy only the reviewed website specification and its required implementation guidance, leaving unrelated projects and releases untouched. Verify hashes and local links after transfer and read the current owners before coding. Public export manifests remain separate from this private handoff evidence. This process does not itself commit, publish or claim runtime success.

<a id="9-work-and-gates-by-phase"></a>
## 9. Work and gates by phase

| Phase | Required work or proof | Does it prevent starting the chosen local build after go? |
|---|---|---|
| Design baseline | Use these recorded scope, route, donor, export, media, and interaction defaults. | Go has been received; no further generic taste/start permission is needed. |
| Post-go setup | Verify/install the selected Tiled/Phaser toolchain as scoped, inspect actual Martial Hero archive/metadata, preserve native frames. | It is implementation work to perform first, not a pre-go approval menu. |
| Post-go one-room proof | Prove native map export/import, frame timing/reuse, terminal, lift/carry/pause, cable/bridge, and mobile framing. | It gates expansion into the rest of the world, not starting the room. |
| Post-go content proof | Build/review the sanitized edition, real docs ZIP and loopback handoff; run the local nine-image gallery. | It gates claiming those local behaviors complete. |
| Post-go audio proof | Produce/export/listen against 12; preserve mute, loops, layer timing, and budgets. | It gates audio acceptance; silent shell/world work can proceed. |
| Release-only metadata | Preserve the nine individually reviewed public-display gallery bindings; review any later changed/additional records. | Current gallery metadata is reviewed in09. Recheck the final payload; unreviewed new items stay out of production. |
| Release-only banking | Preserve the verified encoder fields and Dex's100k bank-app recipient/amount confirmation; complete separate same-device import proof without executing a transfer. | Recipient facts are confirmed. Scan versus image import was not specified; do not claim both methods verified or request the account name again. |
| Release-only hosting | Verify current origin/tunnel owner, public HTTPS/routes/artifacts, real target browsers, rollback and deployment scope. | No; old public site remains unchanged while local proof is incomplete. |

**Current proof split · source1.8, reconciled2026-09-08:** the complete current Arrival→Support→Arrival route has34 checks,9,166 observed walking samples and all44 stairs covered in both directions. True browser200% zoom and64 accessibility-tree/keyboard checks pass, with18 focused donation-description/preview checks. Selected Suno B is integrated and passes132 exact-media/transport assertions with37,682,372 decoded bytes. All nine gallery records retain their public-display review. Dex's MB Bank,0585739325,THIEU GIA MINH and100,000 VND bank-app confirmation remains established without payment. Each receipt stays tied to its tested source/artifact hashes; a source edit requires the matching sanitized export.

Latest device checkpoint2026-09-08: Dex reported the requested Samsung Internet/iPad Safari LAN journey working, including movement/double jump, bridge/lift, sound, panel opening/closing and documentation download on candidate g. This is user-reported physical-device success; versions/models were not supplied, and no agent hardware instrumentation or individual sound-file rating is claimed. The current15 active ambience/effects now have initial-release integrated review alongside selected B, using that report and technical evidence; audio bytes are unchanged.

Still unverified: separately evidenced bank-image import, actual screen-reader speech, device-version-specific coverage and public HTTPS/secure-context clipboard/delivery. Public promotion is in progress and requires actual domain proof. The Narrator attempt stopped before speech began; AX/zoom proof does not substitute for it. The device report does not retroactively prove earlier emulator runs were hardware tests or imply payment/QR-import verification. These limits neither erase deployment authorization nor establish whole-goal completion.

The implementation handoff must demonstrate that all reviewed files arrived unchanged, the direct/fight routes select identical bytes, the six physical files resolve to the same export used by the ZIP, and local gallery data cannot enter the production manifest without its release review. These are concrete checks after go, not claims that documentation edits have performed them.

If one release-only check remains unresolved, keep that release feature truthfully unpublished while continuing independent authorized local work; do not relabel the whole local build blocked or publicly complete.

<a id="10-completion-language-and-next-action"></a>
## 10. Completion language and next action

[15](after-go-workflow.md) is the operational owner for the four-stage go workflow and whole workable-version requirement. [16](copy-and-input-contract.md) owns the final visitor-copy and supplied-input audit. This chapter retains source/export and readiness facts, not a competing implementation order.

- Current result: the local implementation and selected native/cross-engine journeys have scoped proof; continue final composition/content reconciliation, requested human checks, atomic candidate export and public verification under the received go.
- After work begins, report `planned`, `locally verified`, and `publicly verified` separately, with exact artifact/revision evidence.
- Do not call the whole website ready because the docs are complete, because a donor is selected, because generation succeeded, or because a development page loads.
- Do not restart rejected generated-animation work or require a fully original hero before the accepted donor can make the first room playable.
- Keep the old public runtime and accepted download artifacts as the deployment/rollback owner until the scoped promotion already authorized by go is assessed and proven.
- Additional features must enter the owning specification and acceptance inventory first; closing this baseline is not permission to improvise them during implementation.

<a id="historical-local-integration-and-release-proof-source-v15"></a>
### Historical local integration and release proof · source v1.5

The following paragraphs preserve the earlier compact-map checkpoint;20 and the source1.7 proof split above supersede their composition, pending-recipient and media state. They do not certify the newer repaired world.

The compact map now integrates 50 world-art roles across 56 manifest placements, with independently cropped/stateful props and the unchanged CC0 hero. Shared world texture surfaces measure 33.97 MiB decoded plus 6.4 MiB for the hero. Individual generation sources and targeted B04 shell replacement are preserved; no all-in-one generated sheet is implied. Chapters 01/17/18/19 record camera, seam, light, gallery-mounting, banner and clean-preview refinements.

The native arrival/banner/lift receipt has 39 qualified assertions plus 8 passing ready-announcement retest assertions. Actual Firefox and Windows Playwright WebKit also exercised frozen local journeys and normal fights with one exact ZIP handoff through an HTTPS staging transport. Those requests were fulfilled from the frozen local build; they did not reach public dex.place. Windows WebKit's unavailable Web Audio is an observed engine limitation, not a finding about physical iPad Safari. Neither emulation nor codec/DOM proof establishes listening, bank ownership or real-device feel.

Release preparation is separate from promotion. Earlier artifact hashes and review gates apply only to their exact bytes. The owner confirmed that the current 100,000 VND QR displays MB Bank, account 0585739325, recipient THIEU GIA MINH and 100,000 VND in a banking app, without a payment. The response does not identify the banking app or distinguish camera scanning from image import; neither method is independently claimed verified. Twenty local asynchronous checks cover QR regeneration, stale success/error, amount/method changes, Retry and unmounting; independently decoded displayed images agree with their current payment fields. Ko-fi selection and ordinary browser Back reach the intended URLs, while the provider creator page encountered its own security verification. The requested Samsung Internet and iPad Safari playtest was reported working by the owner, with device/browser versions unspecified. Separate bank-image import, screen-reader speech and public HTTPS behavior are not established by that report. Listening and whole-route quality still require review.

<a id="current-staging-and-rollback-boundary-2026-09-07"></a>
### Current staging and rollback boundary ·2026-09-07

Candidate e is superseded by later camera, audio, control and documentation changes and is now archived at `private asset-authoring root`. The private `provenance/release-archive-e-20260907` receipt verifies264 regular files, two internal junctions and697,150,895 bytes before removal of its active-work copy. This archival did not change the active site. The earlier verified origin snapshot preserves a paused/offline baseline, not a proven healthy public site. Prepare a fresh reviewed immutable payload, recheck the original hosting owner and rollback identity, then use the scoped promotion already authorized by go. Public HTTPS/routes/artifacts and real-device results require their own proof.
