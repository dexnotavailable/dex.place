<a id="dexplace-world-website-specification"></a>
# dex.place — world website specification

Source specification version:1.8 · Date:2026-09-08 · Status: **Selected Suno B is integrated with native media proof; the current full walking route and true200% browser/keyboard checks pass. Requested device flows and integrated sound are now user-reported working; spoken accessibility, separate QR import and public delivery remain unverified.** Public documentation edition1.0 remains unpublished. This reconciliation supersedes the previous export snapshot and requires refreshed reader/module/ZIP parity.

Read [20-world-repair-after-playtest.md](world-cohesion-revision.md) first for the latest direction: continuous platforms, layered fog/light, useful machinery, anchored E prompts, gallery displays, double jump and Dex's selected B theme. The integrated ambience/effects now have initial-release review from the reported device playtest and existing technical evidence. Boss development stays deferred. Earlier agent visual sign-off and review-ready statements are superseded; scoped functional proofs remain evidence for their recorded revisions.

Dex explicitly authorized the build and public dex.place finish line. Read18 first for the latest physical-interface direction, E/slash/DOM assignments and repeated read/build/step-back/inspect/pivot workflow. This supersedes earlier planning-phase 'waiting for go' wording retained in focused chapters as authoring history. Those chapters' requirements remain in force; they do not claim implementation proof.

This is the source of truth for the cinematic, liminal pixel-platformer version of dex.place. It records what Dex requested, the reviewed defaults, settled implementation refinements, unresolved evidence, the controls that may exist, and how the result must be checked. A working local implementation now exists; the scoped receipts in 09 do not establish a finished public replacement.

<a id="read-order-and-ownership"></a>
## Read order and ownership

| Document | Owns |
|---|---|
| [00-decisions-and-scope.md](decisions-and-scope.md) | Confirmed requirements, proposed defaults, exclusions, permission boundary, change control |
| [01-art-direction-and-audio.md](art-direction-and-audio.md) | Brand, typography, pixels, composition, lighting, motion, sound, asset restrictions |
| [02-world-and-gameplay.md](world-and-gameplay.md) | Geography, each place, player actions, sword interactions, encounters, camera and reset behavior |
| [03-sections-and-controls.md](sections-and-controls.md) | Downloads, documentation, illustrations: content, buttons, state transitions, URLs |
| [04-donation.md](donation.md) | Ko-fi redirect, MB Bank identity, amount selection, QR states, every donation control |
| [05-shell-and-system-controls.md](shell-and-system-controls.md) | Entry, navigation, menus, settings, global focus, loading, errors, session state |
| [06-mobile-accessibility.md](mobile-accessibility.md) | Touch, responsive camera, keyboard access, reduced motion, non-game access |
| [07-content-runtime-and-hosting.md](content-runtime-and-hosting.md) | Content records, game/site boundary, storage, delivery, local hosting, migration |
| [08-acceptance-and-delivery.md](acceptance-and-delivery.md) | Requirement coverage, acceptance scenarios, evidence and release gates |
| [09-sources-open-items-and-changelog.md](sources-and-change-rules.md) | Evidence, factual gaps, future decisions, document revision history |
| [10-world-production-workflow.md](world-production-workflow.md) | Map authoring, modular objects, coherent animation production, toolchain proposal, one-room production proof |
| [11-framing-and-sprite-comparison.md](framing-and-sprite-comparison.md) | Wide framing rules, original-animation endpoint, bounded provider comparison and evidence |
| [12-audio-composition-and-budget.md](audio-composition-and-budget.md) | Section compositions, motif, loops/transitions, audio formats/memory, ElevenLabs and Higgsfield budgets |
| [13-build-readiness-and-scope.md](build-readiness-and-scope.md) | Final gap closure, selected donor mappings, shared public docs export, local/public proof, asset roots and exact worktree handoff |
| [14-local-audio-model-research.md](local-audio-model-research.md) | Local shortlist, primary capabilities, dated user reviews, live inventory and reserved ElevenLabs budget |
| [15-after-go-workflow.md](after-go-workflow.md) | Conditional storage preparation, asset/spec reconciliation, complete implementation, mobile regressions and workable handoff |
| [16-copy-and-input-contract.md](copy-and-input-contract.md) | Literal visitor copy, rejected slogans, supplied materials, required/optional inputs and confirmed device targets |
| [17-arrival-and-first-impression.md](arrival-and-first-impression.md) | First paint, loading, causeway reveal, first minute, sound consent, return/error/mobile arrival states |
| [18-physical-interface-and-review-loop.md](physical-interface-and-review-loop.md) | Go authorization, every interaction's action/state ownership, slash-open banner and build/inspect/pivot loop |
| [19-world-asset-inventory.md](world-asset-inventory.md) | Approximately 50 distinct world-art pieces, layer coverage, honest production states, pixel-scale metadata and generation routing |
| [20-world-repair-after-playtest.md](world-cohesion-revision.md) | Current world, traversal, mechanism and music repair; arrangement review and measured implementation checkpoints |

<a id="how-to-interpret-this-package"></a>
## How to interpret this package

- **CONFIRMED**: Dex explicitly requested or clarified it in this conversation. Preserve unless Dex changes it.
- **PROPOSED DEFAULT**: a concrete authored design choice offered for review. It is not a claim that Dex individually approved the detail. These form the reviewable baseline; a later go-ahead to implement this specification accepts its defaults unless Dex narrows or changes them.
- **OPEN**: missing information or proof. An implementation go-ahead does not invent the answer. Only dependent work waits; the rest can progress.
- **DEFERRED**: captured for later; excluded from this implementation baseline.
- **OUT OF SCOPE**: must not appear incidentally.

All unspecified measurements, colors, room structures, copy, timing, controls, accessibility alternatives, and implementation contracts in the focused documents are **PROPOSED DEFAULT**, unless individually marked otherwise. Detailed design is intentionally written down instead of left to a later agent's improvisation.

The tuning policy in [00](decisions-and-scope.md) distinguishes firm functional/asset/accessibility contracts from adjustable visual starting choices. Camera ratios, exact shapes/positions, palette values, spacing and decorative timing are guides; judge the assembled result against the references, tune it autonomously after go, and synchronize settled choices at scene checkpoints. No separate approval or permanent spec revision is needed before every reversible visual adjustment. New controls, outcomes or data use still require an owning contract before implementation.

Dex's clarification: retain the specifications. Technical compliance is necessary but does not establish that the whole experience looks or feels good; both must pass. Visual iteration refines and records the baseline rather than discarding it. The game world is unmistakably pixel art, judged by its visible pixel pitch after scaling: nearby props and platforms belong to one coherent grid, while distant forms may be finer. The terminal revision's pixel style is the current user-approved reference; the large platform needs finer source pixels to avoid oversized blocks in scene. A high-definition source followed by controlled per-asset pixelation is an authorized comparison trial, judged in the actual scene before acceptance. Chapter 01/10 own treatment, 19 owns inventory and 08 owns integrated review.

<a id="conflict-order"></a>
## Conflict order

1. Dex's latest explicit instruction.
2. Confirmed requirements in [00](decisions-and-scope.md).
3. The relevant focused document in this package; it owns its subject.
4. Proposed defaults in this package.
5. Legacy source and historical notes as evidence only.

The old public website remains the rollback/deployment owner until promotion is verified. Its seasonal UI and artwork motion treatment are not the specification for the locally implemented replacement. Documentation reconciliation preserves existing release artifacts, hosting tasks and unrelated desktop-client work. ../../HOSTING.md (private source reference) records an older hosting proof; it is not a fresh health check.

<a id="scope-at-a-glance"></a>
## Scope at a glance

- Domain: `dex.place`, hosted on this machine.
- Logo: literal lowercase `dex`, Daniel font.
- Exactly four primary section labels: **Downloads · Documentation · Illustrations · Donate**.
- Experience: an explorable cinematic liminal pixel world; a small independent sword/katana player against monumental architecture, broad quiet space and modest typography; cutting things changes the world.
- Downloads: a deliberately selected file is associated with an encounter; slaying its boss attempts that file's download once.
- Initial reward: the website documentation itself, packaged as a versioned ZIP. No dexCode public release is required for this first encounter.
- Documentation: files in the world open real documentation.
- Illustrations: a dedicated exhibit hall; existing art is only displayed there.
- Donate: a dedicated hall/alcove with Ko-fi or MB Bank; amount range 100,000–10,000,000 VND.
- All essential content also has readable, addressable DOM interfaces. Direct non-combat access is a proposed accessibility and repeat-visitor default, not an extra primary tab.
- Music is part of the atmosphere. Chapter 12 owns cue/loop design;14 changes the proposed production route to local-first and reserves ElevenLabs for other projects. Scoped production is authorized by the active go; provider and quality boundaries remain in force.
- Production must use coherent authored animations and independently placed objects. A generated picture of a terminal/elevator is not the working object. The proposed workflow is in [10](world-production-workflow.md).
- Environment generation uses separate foreground pieces first, then separate background depth roles, with early in-scene assembly around the CC0 traveler. No complete one-shot scene or generated all-in-one sheet supplies the world. Packing accepted source images into a runtime atlas later is ordinary export.
- The working world-art target is approximately 50 distinct usable pieces: 10 foreground, 20 props, 10 middle and 10 background. Chapter 19 tracks their roles without counting animation frames, rejected alternates, the hero or gallery exports toward that target. Dedicated individual generation continues with repeated scene checks.

<a id="finding-a-button-or-behavior"></a>
## Finding a button or behavior

Control IDs are stable. Global controls use `SYS-`; section controls use `DL-`, `DOC-`, `ART-`, and `DON-`. World and mobile actions are enumerated in [02](world-and-gameplay.md) and [06](mobile-accessibility.md). A rendered control must resolve to a registered row or a explicitly documented data-driven instance of one. Repeated product/art/document rows bind a content ID; they do not create undocumented behavior.

No implemented feature may rely only on a chat answer, issue comment, screenshot, or developer preference. Resolve the decision here before implementing it. The change process is in [00](decisions-and-scope.md).

<a id="current-handoff"></a>
## Current handoff

Edition 1.0 remains the first unpublished public-design candidate, drawn from source specification revision 1.8. [The world-cohesion revision](world-cohesion-revision.md) owns the active repair. Five principal rooms and four enclosed transitions are integrated locally. A generated continuous platform material replaces repeating block brackets and the superseded flat fill. The Dispatch bridge now closes a real 192 px main-route gap; its generated mounting mast, attached rope, native deck and receiving hardware share the actual mechanism. The lift and banner use matching native raster hardware. Scoped native checks cover cutting, safe gap recovery, crossing, lift carry and banner opening/rewinding. Double jump provides one additional airborne jump, restored on landing. Interaction hints follow their actual targets; active Gallery bays display the corresponding ungraded illustrations as DOM links, with the hero correctly in front. Personal artwork remains outside world textures and loading/Browse plates. The current composition has 51 generated library roles, 36 configured raster participants, 15 reserves and 165 placements plus assemblies. Independent fog and material-light layers preserve useful static illumination on Low/reduced motion. Camera bounds x400-13900 and ten compact v10 plates derived from the preserved v9 renderer captures share the authored room envelope. The selected nearest-neighbor exports preserve geometry and use lossless WebP encoding; their coarser preview pixel grid was visually reviewed. The current Arrival-to-Support-and-back walk has 34 native checks and 9,166 observed walking samples, covering all 44 main stairs in both directions without observed micro-falls. True browser 200-percent zoom and 64 accessibility-tree/keyboard checks also pass; actual screen-reader speech remains unverified. These local results do not establish whole-experience acceptance or public promotion.

The earlier energetic score and calm shared-bed comparison were rejected. Dex selected Suno arrangement B for its grander, mystical character after hearing the original-theme comparison. B now supplies the shared world theme. The complete 81.12-second source is retained with 2.65 seconds of quiet entry, a constant level adjustment and a click-safe final 50-millisecond fade. Its complete-cue repeat is 83.77 seconds, with no omitted phrase, tempo or pitch change. Original MIDI, reference renders and both provider outputs are preserved. B is the approved musical choice. The integrated sound set is reviewed for the initial release following the user-reported Samsung Internet and iPad Safari playtest, including sound; no separate per-file rating is asserted. Arena orchestration and boss tuning stay deferred. While encounters are unconfigured, Download file is the usable primary action and the disabled fight action keeps its explanation. Combat assistance is hidden in file details and Settings until encounters are configured; its saved preference is retained.

The owner confirmed that the current 100,000 VND QR displays MB Bank, account 0585739325, recipient THIEU GIA MINH and 100,000 VND in a banking app, without a payment. The response does not identify the banking app or distinguish camera scanning from image import; neither method is independently claimed verified. Twenty local asynchronous checks cover QR regeneration, stale success/error, amount/method changes, Retry and unmounting; independently decoded displayed images agree with their current payment fields. Ko-fi selection and ordinary browser Back reach the intended URLs, while the provider creator page encountered its own security verification. The requested Samsung Internet and iPad Safari playtest was reported working by the owner, with device/browser versions unspecified. Separate bank-image import, screen-reader speech and public HTTPS behavior are not established by that report.

The unchanged authored CC0 hero, independent assets, pixel consistency, four primary sections, stable controls and artwork display-only boundary remain required. Reader/search and ZIP share the same sanitized bytes; candidate exports may change before first publication, while published edition bytes are immutable.
