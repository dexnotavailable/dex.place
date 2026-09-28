<a id="donate-place-panel-amounts-and-qr-contract"></a>
# Donate: place, panel, amounts, and QR contract

<a id="source-21-implementation-precedence"></a>
## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](inhabited-world-and-experience.md) and [22](dex-account-treasury-and-social-presence.md) first. Existing recipient, amounts and QR controls remain. Distributed boxes, verified donation history and the opt-in treasury are added in22; QR generation still proves no payment. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

Design baseline. Requirements and proposals below describe intended behavior; release verification is recorded separately.

Decision labels: **CONFIRMED** records Dex's request; **PROPOSED DEFAULT** records a concrete authored choice for review before implementation; **OPEN** records a verification or integration gap. Proposed defaults do not become new user requirements by being written here.

<a id="confirmed-scope-and-identity"></a>
## Confirmed scope and identity

- **CONFIRMED:** the top-level destination is `Donate`. **PROPOSED DEFAULT:** its direct route is `/donate`.
- **CONFIRMED:** it belongs to the cinematic, liminal pixel world and can be entered through an exhibit-like space.
- **CONFIRMED:** offer Ko-fi redirect and an MB Bank QR route.
- **CONFIRMED:** Ko-fi destination is exactly `https://ko-fi.com/dexdonation`.
- **CONFIRMED:** bank is MB Bank; account number is the string `0585739325`.
- **CONFIRMED:** the official account-holder name supplied by Dex is `THIEU GIA MINH`.
- **CONFIRMED:** MB amount range is 100,000–10,000,000 VND, inclusive, selected with a slider.
- **CONFIRMED:** Dex would like the public-facing name to read like “donate dex.”
- **CONFIRMED:** the wordmark is lowercase `dex` in Daniel; this does not change the legal bank recipient.
- **CONFIRMED:** existing personal artwork is displayed exclusively in Illustrations; it is not décor for this room.
- **PROPOSED DEFAULT:** panel heading is `donate to dex`; transfer memo is `dex support`.
- **PROPOSED DEFAULT:** Ko-fi and MB Bank have equal visual weight; neither is preselected on a fresh visit.
- The previous site's smaller minimum or scan-only implementation is historical context; this document's confirmed 100,000 VND minimum supersedes it for the planned website.

<a id="the-place-and-first-impression"></a>
## The place and first impression

- **PROPOSED DEFAULT:** a human-scale support pocket joins the exhibition wing: pale stone, a low desk, a bench and one warm light within a vast open structural bay. The small furnishings and immense surrounding opening follow01/02; the camera never turns the destination into a cramped cozy room.
- A huge quiet window faces still water. A red indicator marks the desk; no spinning coins, fundraising meter, flashing payment button, or donor leaderboard.
- The place uses newly authored environment assets. Neither Kaizen nor existing illustrations are repurposed as shopkeepers, signage, textures, or backgrounds.
- The exterior landmark reads `Donate`. The interior shows the lowercase Daniel wordmark once, with functional text in the site's readable interface font.
- The world interaction prompt is `Open Donate`; keyboard, touch, and direct tab access reach the same panel. Gamepad controls are deferred in the shared input specification.
- A nearby harmless object may react to a sword strike as ambient play. Hitting any object never selects an amount, generates a QR, opens Ko-fi, or initiates payment.
- There is no boss, collectible requirement, paywall, platforming requirement, or timed offer for reaching this panel.
- When the panel opens, combat and movement input pause. World ambience continues under the user's existing sound preference; the panel adds no payment sound or new music autoplay.

<a id="panel-composition-and-exact-copy"></a>
## Panel composition and exact copy

- **PROPOSED DEFAULT:** heading `donate to dex`, with no supporting slogan or sales line. Method labels and the factual transfer instructions provide the remaining copy.
- First view contains `Ko-fi` and `MB Bank · VND`, followed by the persistent `Close` control.
- The `Ko-fi` method is itself a direct external link, with helper `Choose your amount on Ko-fi.` Selecting it redirects immediately; there is no intervening method-confirmation screen.
- MB view: heading `MB Bank`; amount controls; recipient facts; QR area; secondary `Change method`.
- Recipient facts always show `MB Bank`, `0585739325`, `THIEU GIA MINH`, and memo `dex support` as separate labelled values.
- Recipient label is `Account holder`. The heading `donate to dex` is never placed in that field.
- Amount heading is `Amount (VND)`. Grouped display example: `100,000 VND`; input itself contains ungrouped digits to avoid locale ambiguity.
- QR helper when ready: `Scan with your banking app, or save this QR and import it there.`
- Under the ready QR: `Check the recipient and amount in your banking app before confirming.`
- No `Payment successful`, `Donation received`, receipt number, or donation total appears without a separately specified verified reconciliation integration.

<a id="control-inventory"></a>
## Control inventory

All IDs are stable specification IDs, not a requirement to use a particular frontend framework. Global navigation controls are defined in the shared interface specification; the IDs below own donation-specific behavior.

| ID | Visible label / accessible name | Behavior, availability, and focus |
|---|---|---|
| DON-001 | Open Donate | World desk trigger opens `/donate`; focus moves to the panel heading; direct route skips traversal. |
| DON-002 | Close | Uses the Close/history policy in [05](shell-and-system-controls.md): world-prop entry restores its safe source position; tab/direct entry uses Support anchor, and direct entry replaces the panel route with `/` rather than navigating externally. Focus restores to opener or Donate tab. Escape has the same effect unless a browser-native dialog owns focus. |
| DON-003 | Ko-fi | Ordinary same-tab external link directly to `https://ko-fi.com/dexdonation`. Selecting it redirects immediately; no amount, currency, identity, referral or payment query parameters are added. Browser Back returns according to browser history, with Donate state restored when available. |
| DON-004 | MB Bank · VND | Selects MB view with the session's committed amount, initially 100,000 VND; focuses the method heading; does not request a QR yet. |
| DON-005 | Change method | Returns to method selection; invalidates and hides any pending/ready QR; keeps committed amount in current-page memory; focus returns to the previously selected method button. |
| DON-006 | Amount (VND) | Accessible slider with the mapping and keyboard rules below; commits selection without any network request. A changed value invalidates an existing QR immediately. |
| DON-007 | Enter amount in VND | Editable numeric text field with numeric mobile keyboard; edits only the draft value until Apply amount. Invalid drafts show an associated error; no silent correction. |
| DON-008 | Apply amount | Commits a valid numeric draft and synchronizes slider/preset state. Disabled while unchanged or invalid; Enter in the field has the same valid-only behavior. Focus stays in the input after commit. |
| DON-009 | 100k | Selects exactly 100,000 VND, resets numeric draft, marks this preset selected, and invalidates any different QR; focus stays on this button. |
| DON-010 | 500k | Selects exactly 500,000 VND with DON-009 behavior. Accessible name: `500,000 VND`. |
| DON-011 | 1m | Selects exactly 1,000,000 VND with DON-009 behavior. Accessible name: `1,000,000 VND`. |
| DON-012 | 5m | Selects exactly 5,000,000 VND with DON-009 behavior. Accessible name: `5,000,000 VND`. |
| DON-013 | 10m | Selects exactly 10,000,000 VND with DON-009 behavior. Accessible name: `10,000,000 VND`. |
| DON-014 | Generate QR | Enabled only for a valid committed amount with no uncommitted draft. Freezes request fields and starts QR preparation; no transfer occurs. During loading, same position reads `Generating QR…` and is disabled. |
| DON-015 | Retry QR | Shown on QR failure; repeats preparation for the current valid committed fields, never a superseded request. Focus remains on the action position. |
| DON-016 | Save QR image | Enabled only for the latest ready QR; saves that exact coherent request image with amount in its filename. Failure retains the visible QR and announces the fallback below. |
| DON-017 | Copy account number | Copies `0585739325` exactly. Success status `Account number copied`; clipboard denial reveals selectable account text and `Select and copy the account number.` |
| DON-018 | Copy account holder | Copies `THIEU GIA MINH` exactly. Success status `Account holder copied`; denial reveals selectable text. |
| DON-019 | Copy transfer note | Copies `dex support` exactly. Success status `Transfer note copied`; denial reveals selectable text. |
| DON-021 | Open QR image | Same-device save fallback for the current ready image only; opens its image in a new tab from an explicit click, with accessible warning `opens image in a new tab`. Never opens a banking app or transfer flow. |

There is no extra Ko-fi confirmation button, `I paid`, `Confirm transfer`, `Pay now`, amount reset on close, donor-name field, email field, tip multiplier, recurring toggle, or bank-login control in this scope. DON-020 was retired during specification review because the extra redirect step contradicted the requested direct selection behavior.

<a id="amount-behavior"></a>
## Amount behavior

- **PROPOSED DEFAULT:** initial amount is 100,000 VND. Selection is held only in current-page memory; a fresh page load returns to that default.
- **PROPOSED DEFAULT:** allowed increment is 10,000 VND. There are no decimals, negative values, fractional currency, or currency conversion.
- All calculations use integer VND. Account numbers are strings; preserving the leading zero is a release requirement.
- Numeric field accepts digits only as a valid value. Pasted separators, signs, exponents, letters, or decimals remain an invalid draft with a clear message; they are never reinterpreted as another amount.
- Empty draft error: `Enter an amount.`
- Nonnumeric draft error: `Use digits only, without commas or decimals.`
- Below/above range error: `Choose between 100,000 and 10,000,000 VND.`
- Wrong increment error: `Choose an amount in steps of 10,000 VND.`
- An invalid or unapplied draft hides the QR and disables Generate QR and Save QR image. It never leaves a scannable image beside a different amount draft.
- Apply amount never clamps or rounds user-entered money silently. Invalid drafts must be edited or replaced by an explicit preset/slider selection.
- Selecting a preset or using the slider explicitly replaces an outstanding draft, clears its error, and announces the newly selected amount.
- Arbitrary valid numeric amounts are permitted within the range; presets are shortcuts, not the complete allowed set.
- A preset is visually selected only when the committed amount exactly matches it; otherwise none is selected.

<a id="slider-mapping-and-precision"></a>
### Slider mapping and precision

**PROPOSED DEFAULT:** use a piecewise linear position mapping so the lower end remains practical while retaining the requested 10 million VND maximum.

| Slider position | Amount anchor |
|---|---:|
| 0% | 100,000 VND |
| 25% | 500,000 VND |
| 50% | 1,000,000 VND |
| 75% | 5,000,000 VND |
| 100% | 10,000,000 VND |

- Within each segment, interpolate between its anchors and round pointer selection to the nearest 10,000 VND; half steps round upward. Endpoints are exact and never exceeded.
- The displayed amount updates during pointer movement. Commit on pointer release; no QR request fires during dragging or after release without Generate QR.
- Pointer cancel, lost pointer capture, rotation, or an interrupted drag restores the last committed monetary value and input draft. Any QR already invalidated stays hidden; the user must explicitly Generate QR again. A canceled drag is not silently committed.
- A ready QR is hidden at the first changed draft position, before any newly displayed amount can disagree with it.
- Arrow Left/Down subtract 10,000 VND; Right/Up add 10,000 VND; Page Down/Up change 100,000 VND; Home/End choose the respective minimum/maximum.
- Keyboard values clamp at the documented range endpoints because the user is explicitly adjusting a bounded control; the numeric field has the separate no-clamping rule above.
- Keyboard changes commit individually; the thumb uses the inverse mapping to represent the chosen monetary value.
- Assistive technology hears actual amounts in VND, never an unexplained position value or percentage. Announcements are throttled during dragging and final selection is announced once on release.
- The nonlinear native slider retains its0–100 position value and the actual VND `aria-valuetext`. It also references one non-live current-amount description with `aria-describedby`, because the inspected Chromium AX output exposed the raw position despite the correct DOM value text. The description matches the visible amount during dragging, keyboard/preset selection and Apply amount. An unapplied numeric draft does not change it; canceled dragging restores the prior amount. This description supplies readable monetary context without an extra live announcement loop. Actual screen-reader narration remains separate from DOM/AX evidence.
- Slider labels show the five amount anchors. Touch hit area is generous and dragging does not accidentally scroll the panel; the rest of the panel remains normally scrollable.
- The nonlinear scale is visible through its tick labels and does not suggest that equal distances represent equal amounts.
- Keep all five anchor values legible without overlapping labels or reducing them to microtype. Where the full tick captions do not fit, retain tick marks at their true nonlinear positions and place their ordered value labels in a wrapped legend directly below the slider. This legend is descriptive, not five new preset buttons. Existing numeric entry/presets remain unchanged; amount text stays at01's normal field/body size.

<a id="donation-states-and-transitions"></a>
## Donation states and transitions

| State | Visible result | Permitted next actions |
|---|---|---|
| Closed | World and persistent navigation | Open Donate or navigate elsewhere. |
| Method selection | Ko-fi direct link and MB Bank method button | Ko-fi redirects; MB opens amount panel; Close exits the section. |
| MB amount ready | Amount, recipient facts, empty QR slot | Edit amount, Generate QR, copy facts, Change method, or Close. |
| MB draft edited/invalid | Draft and validation; no scannable QR | Correct/apply draft, use slider/preset, copy facts, Change method, or Close. |
| QR loading | Stable-size placeholder and `Preparing QR…` | Edit amount to invalidate, copy facts, Change method, or Close. Generate/Save/Open image disabled. |
| QR ready | Exact latest QR and frozen request summary | Save/Open image, copy facts, change amount, Change method, or Close. |
| QR error | `Couldn’t load the QR. Try again, or use the account details.` | Retry QR, edit amount, copy facts, Change method, or Close. |
| Clipboard error | Selectable fallback adjacent to requested fact | Manual copy; remaining actions remain available. |
| Image save error | `Couldn’t save the image. Open it to save it manually.` | Open QR image or scan visible QR. |
| External return | Donate panel with session state if preserved by browser | Continue normal panel use; no claim that a payment happened. |

- No state waits for a payment or polls the bank. The website has no basis to distinguish “scanned,” “canceled in bank,” and “transferred.”
- Leaving the route cancels pending preparation and invalidates its rendering token. Returning can reuse committed amount in memory but must prepare a new QR explicitly.
- **PROPOSED DEFAULT:** browser Back follows ordinary history as specified in [05](shell-and-system-controls.md); selecting MB or Change method adds no hidden history entries. It may return to an external prior page if that is the actual history. Close is the distinct in-site action.
- Error/status announcements use a polite live region; validation errors are associated with the field. No success/error toast steals focus.
- A panel traps focus only if rendered as a modal. Direct document rendering follows normal page focus order. Opening a browser dialog or external page hands control to the browser.

<a id="qr-content-and-coherence"></a>
## QR content and coherence

- Freeze a request snapshot containing bank BIN, account string, recipient display name, amount integer, transfer memo, template/version, and a unique local request revision.
- The visible request summary and QR image must derive from the same snapshot, not independently from mutable UI state.
- A new amount draft, method change, close, or route exit immediately hides the old image and invalidates its revision before starting any later work.
- Every explicit Generate QR or Retry QR also retires any earlier ready image and revokes its object URL, even when the amount is unchanged. Loading and error states contain no scannable previous image or Save/Open image actions; only the latest successful request may restore them.
- A response may render only when its revision and every relevant snapshot field still match the active valid request. Late successes and errors from canceled requests are ignored.
- Save QR image and Open QR image bind to that same verified ready snapshot. They cannot use a URL cached from a previous amount.
- Proposed save filename: `dex-support-mb-<amount>-vnd.png`, where `<amount>` is the frozen integer amount.
- Generating or viewing a QR presents transfer details; it does not initiate or authorize a money transfer.
- QR image is high contrast with its required quiet zone. Pixel-art styling, red accents, texture, scan lines, reflection, animation, clipping, or scene lighting must never alter the QR itself.
- Recipient facts remain readable outside the image; alternative text describes its purpose and selected amount, while adjacent text provides bank, account, holder, and note.
- Same-device mobile flow is Save QR image, then the visitor uses their banking app's supported image-import feature. No unverified bank deep link is shipped.
- If saving is unsupported or cross-origin image download fails, offer explicit Open QR image and manual save instructions; do not falsely announce a successful save.

<a id="integration-facts-and-open-gates"></a>
## Integration facts and open gates

- **VERIFIED SOURCE, 2026-09-06:** VietQR.io QuickLink describes bank/account/template plus amount, memo, and display-name parameters. Its `accountName` field is image presentation and is outside the VietQR standard; it cannot redefine the beneficiary identified by a bank. The provider also states that official projects need their own template derived from its themes. [VietQR.io QuickLink](https://www.vietqr.io/en/danh-sach-api/link-tao-ma-nhanh/)
- **VERIFIED SOURCE, 2026-09-06:** Casso's MB Bank mapping identifies bank code `MB`, BIN `970422`, and short name `MBBank`. [Casso MB Bank API information](https://casso.vn/api-mbbank/)
- **CONFIRMED BY USER; BANK-APP MATCH REPORTED 2026-09-07:** Dex confirmed that the current 100,000 VND QR displays MB Bank, account `0585739325`, recipient `THIEU GIA MINH` and 100,000 VND in the banking app. This is the user's actual display check, not an agent-performed account lookup. No transfer was requested or executed by the agent.
- **CONFIRMED DESTINATION, LIVE PAGE UNVERIFIED:** the Ko-fi URL is user supplied and corroborated by the existing site documentation; the current page/account state still needs browser verification.
- **OPEN:** choose and validate the production QR generation route after implementation is authorized. QuickLink is a researched candidate, not a claim that a custom template, service entitlement, payment tier, or API credential is already available.
- **OPEN:** satisfy the provider's production-template terms, or document another verified QR route before shipping. Do not silently introduce a paid API, financial-data connection, or account lookup service.
- Browser encoding/decoding and the reported 100,000 VND bank-app field match are separate evidence. **OPEN:** the report did not specify camera scanning versus same-device image import or confirm the displayed memo; do not claim those individually verified. Verification ends before confirming a transfer.
- **OPEN:** verify same-device QR saving/import on the target Android/iOS banking-app/browser combination; support varies by app and cannot be inferred from a desktop screenshot.
- The friendly title `donate to dex` and memo `dex support` are website/content choices. A bank may display the verified legal account name during transfer; no website alias is promised to replace it.
- MB amount selection applies only to the MB QR. Ko-fi sets its own available amounts, currency, and checkout behavior; the site does not claim that an MB selection transfers there.
- No donor banking credentials, transaction history, statements, card details, identity documents, or raw provider keys are collected by this page.
- No QR URL using Dex's real account was generated or requested while writing this specification. Documentation work is not authorization to make a real test donation.

<a id="visual-mobile-and-access-acceptance"></a>
## Visual, mobile, and access acceptance

- The donation hall reads as part of the quiet world, with a desk-sized focal point and restrained copy. Amount controls remain visually calmer than a store checkout.
- Touch controls have at least 48 CSS-pixel hit areas, matching the shared mobile minimum. Small screens use a full-height scrollable content surface with Close always reachable.
- On portrait mobile, amount and recipient facts precede the QR. The on-screen keyboard never conceals field errors, Apply amount, or the selected amount.
- Large text, browser zoom, reduced motion, keyboard-only use, and screen readers can reach both methods without using world controls.
- Amounts, recipient text, and QR remain readable at narrow widths; the QR scales without interpolation blur and retains its quiet zone.
- Follow01's panel spacing and restrained title/body hierarchy. Start with a code area roughly 256 CSS px across inside the complete QR image; keep any provider-template text and quiet zone intact. Actual module count, integer sampling and real scanning/import proof decide the final size. Stack and scroll the panel instead of shrinking bank facts or the code to leave more scenery visible. This is a layout target, not a verified encoder/provider result.
- Copy feedback identifies which fact was copied. Selectable-text fallbacks work without clipboard permission.
- The site requests no notification permission, donation account, donor profile, or audio permission as part of this flow.

<a id="required-verification-before-release"></a>
## Required verification before release

1. Every DON control has its specified label, action, disabled state, error path, focus outcome, and touch/keyboard equivalent.
2. Fresh MB selection starts at exactly 100,000 VND; every anchor and both endpoints are exact; pointer rounding and keyboard precision match this specification.
3. Numeric empty, malformed, decimal, exponent, separator, below-range, above-range, and wrong-increment drafts are rejected without silently changing money.
4. Draft editing hides an old QR immediately. Deliberately delayed and out-of-order responses cannot show an outdated image or request summary.
5. Saved/opened QR content matches the visible ready amount, account, bank, and memo. The account's leading zero survives every layer.
6. Clipboard denial, QR timeout/failure, offline state, image save failure, back navigation, method changes, and panel closure have usable recovery paths.
7. The final provider route/template is verified and documented. No unauthenticated prototype endpoint or assumed service entitlement is promoted silently.
8. Bank-app inspection confirms the recipient and encoded payment fields without executing a transfer; any mismatch blocks publication of the MB method.
9. Ko-fi resolves to the intended creator destination and redirects without invented query parameters. Returning never displays a payment-success claim.
10. Donation access remains available through the direct route and navigation regardless of platforming ability, boss state, media availability, or game rendering failure.

<a id="out-of-scope-unless-separately-approved"></a>
## Out of scope unless separately approved

- Receiving-bank integrations, webhooks, automatic payment reconciliation, receipts, donor histories, tax statements, recurring billing, reward fulfillment, financial analytics, or cross-currency estimates.
- Using a donation to unlock files, remove a boss requirement, increase stats, buy equipment, or alter the portfolio's available content.
- Replacing the legal beneficiary with a friendly label, storing the account number as a numeric value, or treating a rendered QR as proof of bank verification.
- Publishing or generating a real QR, authenticating a service, opening a bank account flow, or initiating any transfer during this documentation-only stage.
