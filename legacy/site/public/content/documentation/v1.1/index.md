<a id="dexplace-world-website-specification"></a>
# dex.place — world website specification

Public design edition 1.1 · source specification 2.1 · 2026-09-08 · unpublished candidate; runtime and promotion proof are separate.

Dex's assessment of the live foundation is **okay, not good or amazing**. This pass redesigns the map, physical interactions, first impression, website presentation and inhabited atmosphere, and adds working combat, dex account, treasury, social ghosts and proximity voice. The local candidate is being implemented and inspected. Chapter26 records current evidence and unfinished work; the public first-pass release remains unchanged.

The September6 go authorized the first pass. After discussing and reconciling the next pass, Dex explicitly greenlit its full implementation and publication on September8. Earlier planning holds are historical; the current go and chapter26 supersede them.

<a id="current-authorization"></a>
## Current authorization

The new go is received. [26 — Implementation record](v2-implementation-record.md) owns kickoff, progress and proof. Earlier planning holds and unimplemented status descriptions remain historical snapshots; the full reviewed21-25 scope is authorized now.

<a id="read-first"></a>
## Read first

1. [21 — Next pass: the inhabited world and website](inhabited-world-and-experience.md): confirmed N-01–N-19 requirements, explicit supersessions, room graph, every changed interaction, intro/scroll/UI/audio/asset direction, NX controls, go workflow and V2 acceptance.
2. [22 — dex account, treasury and social presence](dex-account-treasury-and-social-presence.md): shared identity, browser sessions, progress, verified contributions, independent ghosts, activity expiry, proximity voice, controls and real service proof.
3. [23 — Code donors and integration sources](code-donors-and-integration-sources.md): exact installed/upstream versions, licenses, compatible source patterns and integration proof.
4. [24 — Animation and art donor catalog](animation-and-art-donor-catalog.md): curated free tiers, authored clip inventory, preview observations, fit warnings and intake order.
5. [25 — Design references and production rules](design-reference-and-production-rules.md): reference roles, supplied scale images, per-room direction, visible rejection criteria, motion recipes and UI/audio source rules.
6. The focused owner chapters below for unchanged detailed contracts and dated evidence.

The source2.1 expansion supplies research and production detail for the2.0 feature contract. The later explicit go authorizes implementation of that reviewed scope. A linked repository alone does not add another gameplay system; selected dependencies still require compatibility and licence review.

<a id="confirmed-direction-at-a-glance"></a>
## Confirmed direction at a glance

- Nonlinear world; spatial priority **Downloads → Donate → Illustrations → Documentation**. These are priorities, not a compulsory walking sequence. Four content labels remain; matching web-nav order is the proposed default.
- Arena on the main path; every new world visit to a product menu needs a fresh boss victory. Boss death leads through a brief blackout to that product menu. A deliberate menu action downloads the selected file. Scrolling below the game gives direct website access.
- A longer gallery journey, each artwork inspected individually, a collection folder for the whole catalog. Archive behind a freely opening door into a separate interior; no prerequisite.
- Cozy refuge and counter, enormous exposed/interior spaces, room transitions, useful return connections, scattered donation boxes and a treasury of verified donors.
- Sparse inhabitants, service gestures and occasional mobs. Damage, knockback, death and nearby respawn. Authored lore/NPC conversations remain later work.
- A permanently released physical map: slash, proper sword contact/follow-through, severed cable falling, map settling open, then E inspection. No re-furling or quick travel.
- Click attack, contextual E, reduced visible instruction labels, preserved discoverability and accessible semantics.
- Deliberate loading/Enter/sound/focus handoff; gentle musical entry. Cinematic bars frame play; normal scrolling releases game input and reveals a complete themed website.
- Layered material UI, considered pixel typography and readable text, coherent independently assembled world art, authored NPC/boss animations, better use of legitimate free donors.
- Literal **dex account**, shared identity with dexCode/dexClient, saved exploration and confirmed donation history/treasury credit, with expandable product integration. Saved progress never permanently bypasses a boss-menu visit.
- Normal local character, tinted social ghosts with independent progress. Movement or intentional talking keeps them active; roughly60 seconds of inactivity fades them. V proximity PTT plus mobile equivalent; no shared combat/mechanisms.

Retain the selected authored CC0 player, double jump, unmistakable consistent pixels, small-character/immense-composition relationship, continuous 2D platforms, useful machinery, independent fog/material lighting and Low/reduced alternatives. Keep selected Suno B as the musical identity. The logo is lowercase `dex` in Daniel; visitor copy remains factual and restrained. Personal art is used only for its designated display section, never environment, player, boss, UI backing or generation reference. Existing Ko-fi and MB Bank recipient/amount controls remain correct.

<a id="ownership-and-precedence"></a>
## Ownership and precedence

1. Dex's latest explicit instruction.
2. The current confirmed requirements and explicit supersession table in21/22.
3. Unchanged confirmed requirements in00 and focused owner contracts.
4. Labeled proposed defaults, tuned through actual composition and gameplay inspection.
5. Older source/runtime notes and receipts as dated evidence only.

CONFIRMED records user decisions. PROPOSED DEFAULT records a concrete design/implementation choice for the next go, not an invented user quotation. OPEN records missing facts or proof. DEFERRED/OUT OF SCOPE records what is excluded. A new go accepts the reviewed defaults and full scope while preserving explicit payment/security/destructive-data boundaries.

Functional requirements and asset restrictions stay firm. Exact positions, camera dimensions, timing, room naming, visual ornament and capacity targets can be refined when actual testing shows a better result. Preserve the intent and document the accepted change. Never protect a bad composition by pointing to numerical compliance.

<a id="focused-owner-catalogue"></a>
## Focused owner catalogue

| Document | Owns |
|---|---|
| [00 Decisions](decisions-and-scope.md) | Requirement register, scope and change control |
| [01 Art direction](art-direction-and-audio.md) | Brand, scale, pixel pitch, reference composition, lighting and media treatment |
| [02 World/gameplay](world-and-gameplay.md) | Detailed first-pass traversal/interaction history; current graph/combat overrides in21 |
| [03 Sections](sections-and-controls.md) | Content and exact file/article/art semantics; product-menu and inspector overrides in21 |
| [04 Donations](donation.md) | Exact Ko-fi, MB recipient, amount, QR and failure contracts; records/treasury in22 |
| [05 Shell](shell-and-system-controls.md) | Existing controls/history/focus; new scroll and entry model in21 |
| [06 Mobile/accessibility](mobile-accessibility.md) | Touch, semantic access, motion, keyboard and device evidence |
| [07 Runtime/hosting](content-runtime-and-hosting.md) | Source/data/hosting boundaries; added runtime services in22 |
| [08 Acceptance](acceptance-and-delivery.md) | Unchanged detailed proof cases plus21/22 current acceptance |
| [09 Sources/history](sources-and-change-rules.md) | Evidence, dated open-item history and current reconciliation checkpoint |
| [10 Production](world-production-workflow.md) | Modular asset/animation production and source-to-runtime proof |
| [11 Sprite comparison](framing-and-sprite-comparison.md) | Historical donor/generative comparison and framing rules |
| [12 Audio](audio-composition-and-budget.md) | Composition, loops, memory and provider budgets; new transition/voice requirements in21/22 |
| [13 Readiness](build-readiness-and-scope.md) | Source/public export, private-data handling and delivery boundaries |
| [14 Audio research](local-audio-model-research.md) | Dated local-model capabilities and preserved ElevenLabs allocation |
| [15 Execution](after-go-workflow.md) | Original workflow; new eight-step complete-pass workflow in21 |
| [16 Copy](copy-and-input-contract.md) | Factual wording and known input facts; current labels/actions in21/22 |
| [17 Arrival](arrival-and-first-impression.md) | Earlier storyboard evidence; new Enter/bars/scroll sequence in21 |
| [18 Physical interfaces](physical-interface-and-review-loop.md) | Independent anatomy/state/inspection loop; permanent map overrides in21 |
| [19 Inventory](world-asset-inventory.md) | Existing library/provenance; expand room/actor/UI coverage under21 |
| [20 First-pass repair](world-cohesion-revision.md) | Prior quality feedback, functional repairs and selected B evidence |
| [21 Next-pass experience](inhabited-world-and-experience.md) | Current full pass, actions and acceptance |
| [22 Account/social services](dex-account-treasury-and-social-presence.md) | Current account, contribution, presence and voice contracts |
| [23 Code sources](code-donors-and-integration-sources.md) | Primary compatible repos/examples, licenses and integration limits |
| [24 Animation/art donors](animation-and-art-donor-catalog.md) | Selected/reserve free assets, exact tiers, clips and native intake checks |
| [25 Design reference/rules](design-reference-and-production-rules.md) | Composition, pacing, physical/UI animation, typography, sound and inspection rules |

<a id="source-public-release-and-export-boundary"></a>
## Source, public release and export boundary

Authoring source is `private website source workspace`. Installed origin owner is `private website source workspace`. The live first-pass checkpoint is `preparation-20260908-h`; HOSTING (private source reference), REVIEW-READY (private source reference) and the publication receipt own its dated verified identity. It stays in place during planning and candidate construction. Do not rebuild the installed owner's older source over it.

The published documentation edition1.0 is an immutable source1.8 design/preparation snapshot:226602 bytes, SHA256 `02b8b3f26c3c83c299274be52689f21cc921dbd559561d7a885797102ab85134`. Its `.published` marker remains. Source2.1 changes have not been exported into the live reader, generated module or ZIP. Proposed next public edition is1.1; on go, update exporter allowlist/privacy transforms, readers/search/module, release policy, artifact identity and parity together. Do not remove the marker or overwrite1.0 to make a build pass.

The old public build has real functional/browser/media proof and a user-reported Samsung Internet/iPad Safari playtest. Those prove their scoped revisions, not the new pass or an amazing result. Actual screen-reader speech and saved-QR import remain unverified;21/22 additionally require live account, contribution and multi-client/voice evidence. No fake data or local mock may close those rows.

There are no remaining aesthetic choices to send back before go. Actual service entitlement/callback/media routing, donor archive completeness, contribution verification and physical-device evidence are explicit execution checks. Where a provider cannot support automation, use the documented real fallback rather than fabricate capability or drop the feature. Any genuine spend/security/user-device gate must name the exact blocked action and continue independent work.
