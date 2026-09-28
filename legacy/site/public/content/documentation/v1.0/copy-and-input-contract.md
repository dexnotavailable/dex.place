<a id="visitor-copy-and-required-inputs"></a>
# Visitor copy and required inputs

Date: 2026-09-06. Status: implementation active under the existing go; chapter20 owns the latest playtest repair. This chapter owns the plain-copy rule and required factual inputs. Earlier planning entries below remain historical where superseded.

During the current deferred encounter stage, DL-05 (`Fight & download`) is disabled and its explanation is exactly: `The encounter is not ready. You can download the file directly.` DL-06 (`Download file`) remains the usable primary action. This describes the actual prototype state and does not remove direct file access or claim that boss development is finished.

**CONFIRMED** identifies Dex's instruction. **PROPOSED DEFAULT** identifies the concrete reviewable application of that instruction. **OPEN** is a factual or runtime-proof gap, not a reason to return routine design choices to Dex.

<a id="1-brand-and-tone"></a>
## 1. Brand and tone

- **CONFIRMED:** the logo is the literal lowercase word `dex` in Daniel. It has no descriptor, subtitle, profession, biography, slogan, or pitch attached to it.
- The browser tab icon uses the existing canonical Daniel Regular wordmark paths on a pale backing for contrast. It is a brand display asset, not a world sprite or personal illustration; no extra control or alternate brand name is introduced.
- **CONFIRMED:** do not write corporate or sales one-liners. The rejected examples `dex - solo dev` and `projects made with love` are exclusion examples, not candidate website copy.
- **CONFIRMED:** the four primary labels remain `Downloads`, `Documentation`, `Illustrations`, and `Donate`, in that order.
- **PROPOSED DEFAULT:** say what the visitor can do, what the selected item is, or what actually happened. Let the world, art, and interactions provide character.
- The existing `donate to dex` panel heading remains a functional destination heading. Do not add a supporting pitch beneath it.
- Daniel remains the wordmark font. Body text, technical metadata, controls, and bank details use the existing readable type contract in [01](art-direction-and-audio.md).
- **CONFIRMED refinement:** text should not feel oversized or crowded beside the small character and enormous setting.01 now owns explicit default type/spacing values;05/06 own tab reflow. No giant room-name banner, display-size numeral or permanently expanded controls legend enters the quiet scene. User zoom/text enlargement remains supported.

<a id="2-closed-visitor-copy-contract"></a>
## 2. Closed visitor-copy contract

Visitor control and status copy must come from a registered control/state or an approved content record. A developer, generator, template, or imported component may not add incidental product copy.

| Surface | Allowed copy source | Excluded additions |
|---|---|---|
| Header | `dex` plus the four labels; documented Sound and Menu controls in [05](shell-and-system-controls.md). | Role claims, a bio sentence, a tagline, a brand promise, or a fifth tab. |
| Page title / metadata | Home title `dex`; section title `<section> · dex`; item title `<reviewed item title> · dex`. A description may state the actual section contents factually. | SEO sales pitches, role descriptors, fabricated achievements, or personal artwork reused as global share/preview decoration. |
| World signs | Existing section names and target-specific action prompts from [02](world-and-gameplay.md). | Slogans on walls, invented faction messages, inspirational quotations, or lore monologues. |
| Input hints | Documented bindings and actions: `E`, `Interact`, `Jump`, `Slash`, `Dash`, and the existing movement hint. | Loading quips, tutorial banter, unsolicited dialogue, or an invented narrator. |
| Download item | Approved factual name, version, file type, filename, byte size, checksum, and availability. | Fabricated popularity, capabilities, release dates, best-in-class claims, or selling language. |
| Download action/result | Existing DL controls and states in [03](sections-and-controls.md), including `Fight & download`, `Download file`, `Boss defeated`, and `Download requested`. | Congratulations slogans, trophy copy, claims that saving/installation completed, or a reward inventory. |
| Documentation | Approved title and body from the reviewed public edition; existing DOC controls. | A help-chat persona, sales introduction, fake project history, or automatically executed instructions. |
| Illustration | Reviewed title or the documented local basename, factual alt text, and optional supplied metadata; existing ART controls. | Invented story, date, character relationships, artist biography, praise, or automated descriptions presented as Dex's words. |
| Donation choice | `donate to dex`, `Ko-fi`, `MB Bank · VND`, and existing DON controls. | A supporting slogan, guilt, urgency, donation tiers, a goal meter, or praise that increases with the amount. |
| Transfer information | Exact bank, account holder, account string, selected VND amount, note, and factual scan/save guidance in [04](donation.md). | An alias replacing the beneficiary name, an invented receipt, or a claim that money was received. |
| Loading/error/empty state | The relevant registered state: item loading, unavailable content, retry, clipboard/save failure, or renderer failure. Home arrival strings are registered below. | Jokes, cute filler, fake percentages, fake download counts, or an endless spinner presented as progress. |
| Settings | Existing SYS labels, current values, and the specific explanation for unavailable controls. | Additional settings, product promises, suggested purchases, or account/notification invitations. |

- Dynamic text uses reviewed fields, not arbitrary template-generated prose. A factual product summary can be present when its content record is approved; it must not become an invented sales pitch.
- A repeated button binds its existing stable control ID to the content ID. Repetition does not authorize new wording or behavior.
- Keyboard and touch labels can reflect the active binding, but the action retains the same meaning. Preserve descriptive accessible names from the registry.
- Concise notices may describe a real consequence, such as the selected filename and size before combat. They must not manufacture urgency or excitement.
- Accurate source/license credits belong in the documentation's credit/provenance context. They are factual attribution, not a tagline attached to the brand, and do not create another primary tab.
- A new necessary control or message must first enter its owning control/state row with trigger, outcome, failure behavior, and accessibility name. This is documentation work, not a reason to create a new approval menu for routine wording.
- A genuine new feature, changed scope, or contradiction of a confirmed instruction follows the change process in [00](decisions-and-scope.md).

Home arrival statuses in [17](arrival-and-first-impression.md) use only `Loading world…`, `World is still loading. You can use the tabs.`, `World ready`, and `World could not load.` Show/announce only the actual state. Ready is a once-per-attempt polite announcement while on home, not a persistent success banner. Retry uses existing SYS-27 `Try loading world again`; entry uses SYS-06 `Enter world`. No new intro button or tagline is implied.

<a id="3-internal-direction-is-not-a-visitor-tagline"></a>
## 3. Internal direction is not a visitor tagline

Words such as cinematic, liminal, quiet, spacious, warm, or atmospheric remain useful in art direction, scene composition, audio briefs, and QA observations. Do not remove them from those documents merely because the visitor copy is restrained.

The internal room descriptions, camera rules, soundtrack cue IDs, source-selection notes, and research judgments are production instructions. They do not automatically become banners, captions, track names, dialogue, loading messages, or hero text.

The reviewed public documentation may explain those design decisions as documentation. That is different from inserting the explanation into the live site's header or promotional UI. Its source/privacy transforms remain owned by [13](build-readiness-and-scope.md).

<a id="4-copy-audit-recorded-in-this-pass"></a>
## 4. Copy audit recorded in this pass

The visitor-copy contract excludes role labels, biographies, taglines and fundraising pitches. Keep the functional donation heading, method choices and factual instructions. Retain literal victory/download states and accurate metadata; a browser request is distinct from a saved file or installed program. Atmospheric language remains design direction rather than automatically becoming live banners. Legacy runtime copy must pass this same contract before reuse.

<a id="5-inputs-already-sufficient-for-the-local-build"></a>
## 5. Inputs already sufficient for the local build

No further biography, tagline, role description, design preference, account-name answer, or contact information is needed from Dex to start after the scoped go. The [readiness contract](build-readiness-and-scope.md) owns runtime/public proof gates; the execution workflow linked from [README](index.md) owns stage order and checkpoint behavior.

| Input | Available now | Intended use / remaining work after go |
|---|---|---|
| Site identity | `dex`, Daniel, `dex.place`, this-machine hosting, four tabs, and the current visual/interaction specification. | Build the documented shell and world; do not invent a bio or pitch. |
| Daniel assets | Existing OTF sources and SVG wordmark variants recorded in [01](art-direction-and-audio.md). | Use the specified wordmark candidate; verify small-size rendering and font/license packaging. No new logo briefing is required. |
| Nine illustrations | Exact source files in `private illustration export library`, with local basename titles and factual local alt text in [03](sections-and-controls.md). | Build the defined local nine-image gallery. Preserve masters; approve display exports and public metadata before publication. No personal art enters world or generation assets. |
| Character motion | Dex selected the CC0 Martial Hero donor; source URL, advertised animation set, and interim state-mapping workflow are documented in [10](world-production-workflow.md). | Acquire and inspect the archive after go. It is chosen, not downloaded/imported/proven. Use the authored donor initially; original animation remains later work. |
| First downloadable file | The portable public website-documentation ZIP is selected; product/artifact rules and versioned route are in [03](sections-and-controls.md). | Produce the sanitized edition, package it, calculate real bytes/hash, and prove the actual local handoff. No dexCode installer is needed for the first encounter. |
| Physical documentation | Six explicit world-file IDs map to existing source headings in [03](sections-and-controls.md). | Derive the reader, index, physical targets, and ZIP from one reviewed public edition. No new project-description brief is needed. |
| Ko-fi | Exact supplied destination is recorded in [04](donation.md). | Use the direct redirect contract; verify the actual destination later. No Ko-fi password is needed to author this link. |
| MB Bank | Supplied bank, account string, official account holder, amount bounds, and friendly heading are already recorded in [04](donation.md). | Build the documented panel and later verify QR fields without making a transfer. No bank login, replacement name, or new identity answer is required. |
| Audio direction | Compositions/loop/export rules in [12](audio-composition-and-budget.md); local-first ACE-Step 1.5 XL-SFT proposal and fallback candidates in [14](local-audio-model-research.md). | Check resources and the chosen runtime after go, then use the bounded audition. Models are proposed, not ready or quality-proven here. ElevenLabs stays reserved by default. |
| Tool/source owners | Actual website source, existing hosting scripts, and proposed Phaser/Tiled/Krita pipeline are identified. | Verify or install scoped missing dependencies after go. The chosen route needs implementation proof, not another taste decision. |
| Primary mobile targets | **CONFIRMED:** Android with Samsung Internet, plus iPad. **PROPOSED DEFAULT:** Safari on iPad, pending verification of the actual browser. | Include phone/tablet portrait and landscape. Record installed browser/OS/device details when available; exact model/version is not a required question before go. |

<a id="6-later-evidence-and-optional-inputs"></a>
## 6. Later evidence and optional inputs

| Item | Classification | Handling |
|---|---|---|
| Explicit scoped go | Required user instruction before implementation. | Until then, remain in documentation/review. Do not interpret this input register as go. |
| Mobile target answer | Already supplied. | Primary: Samsung Internet on Android and Safari on iPad as the stated working assumption. Also cover supported Android Chrome and iPhone Safari variants; do not ask Dex to repeat the device preference. |
| Actual phone availability and bank-app QR inspection | Later device/proof need. | Test on available authorized hardware after implementation. If Dex must inspect his phone, ask only when there is a concrete QR/build ready to inspect; never request a test transfer. |
| Public gallery metadata review | Later publication proof. | Use the existing local titles/alt text during local work; detailed story captions remain optional/deferred. A missing narrative does not block the gallery build. |
| New artwork titles, dates, Convergence narrative, process notes | Optional/deferred content. | Do not invent them or turn their absence into required onboarding questions. |
| Other projects and future releases | Later content expansion. | Read their actual owners when included. Their absence does not block the selected documentation reward. |
| Model/runtime fit, licensing, exports, loop quality, public hosting health | Implementation/release evidence. | Verify at the relevant scoped stage and report exact limitations; no claim that recording a plan has passed these checks. |
| Passwords, raw API keys, bank credentials | Not required as fresh chat input. | Use existing authorized sessions/secret references when a later approved operation needs them. Do not ask Dex to paste another password or API key into chat. |

No email address, contact form, social biography, additional payment method, subscriber list, shop, or account system is needed or implied. The experiment exception for generated sprite comparisons is closed; this document authorizes no further generation.

**CONFIRMED:** mobile needs checking for every site version. Apply the documented mobile regression matrix to every build revision: supported phone/tablet variants, portrait/landscape, major viewport widths, visible controls and complete section interactions. Record actual browser versions when tested. This does not promise every historical browser release; emulation is identified separately from physical-device proof. If device control is unavailable, one concrete device check may be needed later, not another up-front specification interview.

<a id="7-verification-during-implementation"></a>
## 7. Verification during implementation

- Check the rendered header, menu, all four sections, world prompts, loading, empty/error states, and victory result against their copy owners.
- Inspect template defaults, hidden responsive variants, accessible names, and generated content records; unapproved text often enters through those paths.
- A phrase allowed only as an internal design instruction or a rejected example must not become live interface copy.
- Verify displayed filename/version/size and transfer status against actual selected artifact state; never substitute optimistic success text.
- Verify donation copy contains the functional heading and factual details, with no supporting slogan or amount-based encouragement.
- Keep the optional title/story pass separate from the existing minimal factual local metadata.
- Recheck mobile copy, wrapping, accessible names and control reachability on every build revision using the supplied device targets and supported matrix. Record emulated and physical results separately.
- Record new necessary strings in the relevant control/state contract before implementation; do not grow copy during a cosmetic polish pass.
- Report copy review as performed only after inspecting actual rendered states. This documentation audit does not claim runtime compliance.
