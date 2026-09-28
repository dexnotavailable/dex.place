# Decisions, scope, and change rules

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. The adopted scope additions and current requirement overrides below are active. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

Status language and precedence are defined in [README](README.md). The statements below distinguish Dex's requirements from authored details. Date: 2026-09-06.

## Confirmed requirement register

| ID | Confirmed instruction | Owner / consequence |
|---|---|---|
| R-01 | The website is `dex.place`, hosted on this machine. | [07](07-content-runtime-and-hosting.md); retain local origin ownership, do not silently move hosting. |
| R-02 | Plan and discuss first; hold website implementation until Dex says go. | Source2.0 reconciliation is authorized now. A NEW go is required for21/22; the September6 go describes the first pass. |
| R-03 | Site contains projects, downloads/installers, documentation, illustrations, donation links, and serves as a portfolio. | Projects live inside Downloads and related docs; do not add a fifth Projects tab. |
| R-04 | Four primary content labels remain Downloads, Documentation, Illustrations, Donate. | New spatial priority is Downloads > Donate > Illustrations > Documentation.21 proposes matching web navigation; the old mandatory order is superseded. |
| R-05 | The standalone website should be a good interactive experience; Bruno Simon is an approved reference. | Learn from playable navigation and discovery, not his car, characters, branding, or map. |
| R-06 | The whole environment is a pixel platformer in which the user can move around freely. | Traversable world with horizontal and vertical routes; responsive design. |
| R-07 | The environment should feel cinematic and liminal. | [01](01-art-direction-and-audio.md), [02](02-world-and-gameplay.md). |
| R-08 | Player has a sword or katana and slices things to get things done. | Cutting has legible world consequences; no decorative-only combat system. |
| R-09 | Each new world product-menu visit requires a boss victory, followed by a brief blackout into that product menu. |21 supersedes automatic victory download: visitors explicitly choose/download a real file in the menu. Direct website access requires no fight. |
| R-10 | Documentation appears as files lying in the world. | Physical file interactions open readable documentation. |
| R-11 | Illustrations has a dedicated exhibit journey; donation has distributed boxes and a treasury, with cozy inhabited spaces. |21 owns nonlinear spaces and individual displays;22 owns confirmed contribution records. |
| R-12 | Existing artwork may only be used for display in the illustration section. | No artwork-based protagonist, boss, scenery, loading art, brand background, textures, effects, or generation references. |
| R-13 | Kaizen is the main character of Convergence, a story series Dex made. Story context can be added later with image descriptions. | Preserve factual identity; defer authored story/character captions until that work. |
| R-14 | Mobile must feel good; its presentation may differ. | Same-world adaptation is a proposed default; actual touch proof is required. |
| R-15 | Tie music into the experience. | Adaptive preproduced audio proposal in [01](01-art-direction-and-audio.md). |
| R-16 | Check Higgsfield connectivity; potentially use Higgsfield and ElevenLabs for asset production. | The bounded Higgsfield setup/authentication experiment completed as recorded in11. Scoped image production is now authorized by go, with the conditional GPT Image 2 fallback in19; ElevenLabs access is unverified and its website allocation defaults to zero under14. |
| R-17 | Ko-fi destination is `https://ko-fi.com/dexdonation`; selecting Ko-fi redirects. | Exact external URL, no embedded checkout or fabricated amount parameters. |
| R-18 | MB Bank receiving account is `0585739325`. | Store as a string; preserve leading zero. No bank login needed for the proposed QR flow. |
| R-19 | MB Bank amount slider covers 100k–10mil VND. | Inclusive bounds 100,000 and 10,000,000; the old scan-only minimum is superseded. |
| R-20 | Official account name is `THIEU GIA MINH`; Dex prefers a friendly donation label where possible. | Friendly heading and memo are separate from bank recipient identity. |
| R-21 | Write the whole website down: rules, every place, each button, appearance, interactions; prevent drift and unintended features. | Control registry, state coverage, change register, source references, acceptance evidence. |
| R-22 | Avoid selling too hard. Logo is lowercase `dex` in Daniel. | Plain factual copy; no invented slogans, urgency, fundraising pressure, or corporate pitch. |
| R-23 | The first genuine downloadable content is the website documentation; do not invent a dexCode release. |21 binds the initial product menu to a versioned portable ZIP. Additional products need actual catalog/release/encounter proof. |
| R-24 | World production must address coherent character animation and separately animated/interactive objects such as a terminal glow and an elevator. | [10](10-world-production-workflow.md); prove source, export and runtime behavior together before expanding the world. |
| R-25 | Prefer original animations eventually; the authored donor is accepted for now. | Keep source/provenance and a compatible replacement path. Donor acceptance does not mean permanent original-art goals were dropped. |
| R-26 | Smaller characters/ordinary props within wide framing should increase spaciousness and de-emphasize fine imperfections. | [01](01-art-direction-and-audio.md); readability and structural animation/collision quality still required. |
| R-27 | A bounded comparison can test Higgsfield sprite sheets against the generator available here. | [11](11-framing-and-sprite-comparison.md); narrow experiment exception, not full website go. |
| R-28 | Pick the strongest suitable available Higgsfield models; compare different model families rather than assuming a differently branded route means a different underlying model. | [11](11-framing-and-sprite-comparison.md); name actual models/settings, inspect cost, and base conclusions on returned artifacts. |
| R-29 | Dex judged generated animations poor overall, the built-in route least bad, and its swing only fine-ish; use the CC0 pack for now. | Martial Hero is the selected interim source, used as authored; no generated sheet is promoted and no style contest precedes the first playable. |
| R-30 | Decide composition, feeling and loop behavior for each section, with a reported10,000 ElevenLabs credits and available Higgsfield credits. | [12](12-audio-composition-and-budget.md); separate estimates, live quotes, account entitlement and billing units. |
| R-31 | Assemble remaining specs and audit gaps before Dex says go. | [13](13-build-readiness-and-scope.md); close routine decisions, retain factual proof gates without pretending implementation is done. |
| R-32 | Seek local audio models and actual user experience, prioritizing controllability and atmosphere while preserving ElevenLabs for other media projects. | [14](14-local-audio-model-research.md); proposed local-first route and zero default ElevenLabs allocation; research authorizes no installation/generation. |
| R-33 | No corporate/sales one-liners, role labels or affectionate maker slogans such as the rejected examples in16. | [16](16-copy-and-input-contract.md); logo is only dex; controls and content stay factual. |
| R-34 | After go: prepare storage if needed, reconcile assets/docs for a cohesive cinematic/emotional/fun result, do the complete implementation, then perform final checks for a workable first version. | [15](15-after-go-workflow.md); complete all four destinations and real flows, with safe conditional archival and a precise finish line. |
| R-35 | Primary mobile use is Samsung Internet on Android and an iPad; mobile must be checked across versions/variants. | [06](06-mobile-accessibility.md), [15](15-after-go-workflow.md); iPad Safari is the stated default, actual versions recorded later, every build revision gets supported mobile checks. |
| R-36 | Design the complete first impression: loading, transition into the first space, and the experience from there. | [17](17-arrival-and-first-impression.md); concrete arrival and first-minute baseline, with useful navigation throughout. Detailed staging remains proposed. |
| R-37 | Re-read and reconcile the whole spec for breathing room, modest text and a small character against an enormous background/composition, approaching a megalophobia feeling. | [01](01-art-direction-and-audio.md) owns the scale/type/spacing rules;02/17 apply them to every destination and arrival. Preserve readable interaction and useful short routes. |
| R-38 | Use the CC0 character, then generate separate environment assets for layered assembly: many individual foreground assets first, then background layers; no one-shot complete scene or all-in-one generated asset sheet. | [10](10-world-production-workflow.md); production images have bounded roles and independently editable source files. Packing accepted files into an engine atlas later is a separate export step. |
| R-39 | Fold the three supplied scale references into the existing direction while avoiding a janky result. Keep the specifications; technically satisfying them is insufficient if the whole experience looks or feels bad. | [01](01-art-direction-and-audio.md) owns the reference lessons. Retain the full documented baseline and assess both specification compliance and the assembled experience; tuning refines the spec rather than discarding it. |
| R-40 | The world must unmistakably read as pixel art with consistent visible pixels after scaling. Terminal v2's pixel style is good; platform v2's blocks are too big for a larger platform. Backgrounds may be somewhat finer. | [01](01-art-direction-and-audio.md),10 and19: judge on-screen pixel pitch, preserve the authored CC0 character and record source crop/block size, logical render size, scale and depth/grid role. Style approval alone is not production acceptance. |
| R-41 | Start a long-running goal; the finish line is a surprising, high-quality cinematic and somewhat emotional public dex.place. Pivot/replace when something does not work; technical gates do not supersede entrusted taste inspection. | [18](18-physical-interface-and-review-loop.md); public completion plus integrated visual/audio/play review, no invented claim about Dex's eventual reaction. |
| R-42 | Assign E, slash and normal control actions deliberately for every element; a slashed dropdown can unfold as a separate stateful scroll/flag/banner. Apply this object/state thinking throughout. | [18](18-physical-interface-and-review-loop.md); WORLD-03/04 banner and per-control presentation records; semantics, accessibility and explicit external actions preserved. |
| R-43 | On go edit/read docs first, then repeatedly step back and sanity-check during the workflow. | [15](15-after-go-workflow.md), [18](18-physical-interface-and-review-loop.md); inspect actual integrated increments and capture justified pivots. |
| R-44 | Keep an inventory and aim for approximately 50 useful world assets across foreground, props, middle depth and background. Generate them through many thoughtful individual imagegen requests; switch to Higgsfield GPT Image 2 if built-in output becomes unrelated infographics. | [19](19-world-asset-inventory.md) owns the 10/20/10/10 working roster and honest production counts;10 owns generation/assembly. Verify the fallback's actual model and quote, preserve budget boundaries, and do not claim throttling without evidence. |
| R-45 | Test whether high-definition objects followed by post-pixelation work better; assemble a test scene and judge the result. | [01](01-art-direction-and-audio.md),10 and19: authorize a controlled per-asset comparison at equal scene size beside the CC0 hero and terminal. Acceptance requires consistent pixels, readable forms, clean separation and actual scene/motion proof. |

## Proposed baseline decisions

These resolve routine design choices without repeatedly sending taste menus to Dex. They remain visible as proposals until the reviewed baseline is authorized.

| ID | Proposed default | Why / scope |
|---|---|---|
| P-01 | Nonlinear sparsely inhabited monumental spaces, with cozy refuge, exposed travel, enormous reservoir and dedicated interiors. |21 owns the tunable room graph and contrasting compositions. |
| P-02 | A small traveler with a sword, using the selected authored CC0 Martial Hero initially; original replacement deferred and unrelated to the illustration characters. | Keeps the production choice explicit and separates world identity from display-only art. |
| P-03 | Movement uses jump, dash, slash, and context interaction. | Bounded expressive vocabulary, shared across desktop and touch. |
| P-04 | A complete direct website sits below the game; native scroll and explicit Resume connect the two presentations. |21 replaces viewport-only panels and silent tab teleportation. |
| P-05 | Direct downloads are available in the website below the world. |CONFIRMED in the next-pass discussion; world menu entry still requires a fresh boss fight. |
| P-06 | Catalog-driven encounter definitions use coherently authored boss clips, with a real mapping for every exposed world product. |21 permits a reusable first boss implementation without fabricating separate finished products. |
| P-07 | Product selection binds an encounter; boss defeat opens one product-menu visit through black. |Explicit Download acts on the selected immutable artifact. Victory itself requests no file; closing ends the visit. |
| P-08 | World pauses behind full content panels, menus, external focus changes, and unavailable rendering. | Reading and payment choices are stable; touch and keyboard input cannot leak into combat. |
| P-09 | Same map on mobile, with responsive camera, forgiving input, and direct navigation. | One place with device-appropriate presentation. A separate mobile map requires evidence and a documented revision. |
| P-10 | Instrumental theme with synchronized mixes, environmental sounds, and explicit audio opt-in. | Fits quiet atmosphere and gives transitions musical continuity. |
| P-11 | Generated media is produced during authoring, while accounts, presence and voice use bounded runtime services. |Visitors never trigger paid media generation;22 owns the added service contracts. |
| P-12 | MB QR uses exact recipient information with a friendly heading; selected amount is explicitly committed before QR generation. | Coherent amount, recipient and displayed QR; no stale or mismatched payment requests. |
| P-13 | English interface initially, Vietnamese-aware VND formatting and bank information. | User did not request translation of the whole website. Full bilingual UI is deferred pending scope. |
| P-14 | dex account supplies shared identity, saved exploration and confirmed donation history; visiting/browsing/donating can remain guest-accessible. |22 defines browser sessions, guest merge, extensible product boundaries and verified treasury. |
| P-15 | Author maps in Tiled and test a Phaser runtime integrated with the existing DOM site; use installed Krita for controlled frame/asset editing. | Concrete toolchain route under the active go; actual import/browser proof still required. |
| P-16 | Begin the character proof with one complete licensed authored animation set; preserve frame registration and author missing states in a controlled source. | Avoid independently generated animation frames. A researched donor is not a shipped custom character. |

## Decisions explicitly displaced by this conversation

- Existing art as landing imagery, transition masks, environment decoration, or player identity is superseded by R-12.
- Using Kaizen as the site mascot/player is not approved and is excluded.
- The earlier ordinary rooftop town/café concept is an unaccepted alternative, not the world specification.
- Seasonal palettes, pointer particle effects, magnetic buttons, continuous artwork rigs, and legacy project theaters are existing/historical behavior; they do not automatically carry over.
- An earlier broad product hierarchy does not authorize additional navigation tabs, newsletter popups, subscription features, or desktop-client work.
- The old MB slider's scan-only state is outside the new specified range.
- Historic hosting suggestions for third-party-only origins do not override local hosting at dex.place.

## Out of scope and deferred work

**IN SCOPE for the next go:** the complete N-01–N-19 register in21 and the dex account, saved exploration, confirmed donation history/treasury, independent social ghosts and proximity voice contracts in22. Official automated receipt support is investigated; an operational owner-confirmed workflow is the initial truthful fallback.

**OUT OF SCOPE:** shared combat/co-op/PvP, unrestricted public text chat/guestbooks, user uploads, purchasable gameplay upgrades, currency/loot/skill trees/gacha, subscription checkout, donation-gated content or combat privileges, bank scraping, contact forms/newsletters, analytics SDKs, wallet connections, installer execution, silently moving site hosting and unrelated desktop-product rewrites. Bounded shared-identity adapters are covered by22.

**DEFERRED:** Convergence/lore writing, NPC conversations/AI dialogue, detailed artwork narratives, full translation, gamepad/rebinding expansion, user-selectable soundtrack libraries and seasonal variants. The new rooms, first working boss, mobs and service inhabitants in21 are expressly in scope.

The first website may display approved unfinished projects with an honest status. Do not invent releases, documentation, illustrations, dates, download statistics, testimonials, completion percentages, or public donation totals to fill empty spaces.

## Scope control for future implementation

### Firm contracts and tunable visual defaults

**Clarification from Dex:** retain the specifications and their detail. The flexibility policy does not authorize deleting, demoting or ignoring requirements. A technically compliant result can still fail because its composition, motion, readability or cohesion is poor. Acceptance requires the documented behavior and a successful whole experience together. When tuning exposes a real conflict, resolve it in the owner specification and record the chosen result; do not silently waive a rule or ship an ugly result because its checklist passed.

Keep the user-confirmed identity, four sections, art-use boundary, authored CC0 character, separate interactive objects, content/download/bank facts, consent/focus behavior, accessibility and complete first-version scope firm. New controls, user-visible outcomes, data use or changes to those contracts must be documented before implementation. A pretty scene never excuses a broken file, hidden navigation or an unreadable donation panel.

Camera percentages, exact landmark silhouettes/positions, prop spacing, decorative layer count, palette tokens, panel widths, default heading sizes and reveal timing remain the documented starting choices. Apply them together and evaluate the actual composed scene within the existing function, accessibility, tool and budget boundaries. Use measurements to diagnose a weak result alongside the supplied scale feeling, cohesive pixels, readable action and useful content. If a proposed value needs to change, document the justified refinement at the checkpoint; visual appeal alone does not silently waive the specification.

Keep a short working note while trying reversible visual changes. At the next accepted scene checkpoint, update the owning doc/config and retain a representative screenshot with a brief reason for the settled values. Do not require a document revision or Dex approval before every camera nudge, asset adjustment or spacing change. Before a reviewable build/export is handed over, the docs must reflect its chosen behavior and presentation; abandoned trial values need no permanent rule of their own.

Use a single early assembled scene to discover the visual treatment, then adapt its successful relationships across the remaining destinations. Do not pre-generate a complete asset hoard or freeze every room before seeing the foreground, background, CC0 traveler and UI together. Functional work can continue in parallel. This flexibility changes visual iteration cadence, not the requirement to complete the whole website.

1. Read the package and latest change register before modifying runtime files.
2. Bind the change to requirement IDs and the owning control/action IDs.
3. When a feature has no owning row, document its exact behavior, states, visual role, input, content dependencies, and acceptance before coding it. Ordinary visual tuning follows the checkpoint policy above and is not a new feature.
4. Tune existing visual defaults from actual scene/playback evidence and record the settled result at the checkpoint. New product scope or a contradiction of a confirmed rule goes back to Dex; do not bury it in a refactor.
5. Keep one canonical value per subject. Other documents link to the owner instead of defining competing slider scales, key maps, colors, or download states.
6. A doc update records intent; a proof records implemented behavior. Never mark planned rows tested or shipped because they are written.
7. Go-ahead to implement the reviewed package accepts its proposed defaults, except any Dex exclusions and OPEN proof gates. It does not authorize payment, purchases, account-security changes, or unrelated repairs.
8. Do not commit or push unless Dex asks. Documentation is currently uncommitted on the existing owner checkout.

## Definition of a complete specification

Every current user requirement is mapped to an owner. Every allowed control is registered with its outcome. Every place has a composition and interaction description. Every primary journey includes entry, exit, interruption, error and fallback. Missing factual content is in the open register rather than invented. An unfinished implementation cannot use “not in the docs” as permission to improvise.
