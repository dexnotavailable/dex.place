# dex account, treasury and social presence

Source2.1 adds [23](23-code-donors-and-integration-sources.md) for verified version/license/integration references. Its candidates do not replace the session, privacy, progress, treasury or social contracts here; actual service behavior remains to be proved after go.

2026-09-08 · Adopted source 2.1 account/social contract under the latest GO. [26](26-v2-implementation-record.md) separates implemented local behavior, isolated fixtures, actual provider/media evidence and remaining complete-pass verification. This chapter retains the stated confirmed/proposed/open distinctions.

**CONFIRMED** identifies the user's stated direction. **PROPOSED DEFAULT** identifies a concrete implementation choice for the coming GO, not a claim that Dex separately chose every detail. **OPEN** identifies missing external facts or proof. Unmarked technical limits and control details are proposed defaults. Preserve this distinction in the public export.

## 1. Confirmed direction and proposed implementation boundaries

**CONFIRMED user requirements:**

- The identity is literally **`dex account`**, shared with dexCode/dexClient and extensible to other Dex products.
- Include progress and donation history. Exploration includes remembered room/content discoveries, map cuts and persistent shortcuts/mechanisms, safe checkpoint and settings, with historical boss results.
- **Each new visit to a world product menu requires a fresh fight.** Boss history never creates a permanent menu-unlock flag. This does not reset persistent exploration whenever the page or account reloads.
- Treasury and its contribution ranking use confirmed donations. Keep the existing Ko-fi and MB Bank recipient/amount controls.
- Other visitors appear as ghosts in independent private worlds; their combat and mechanism actions do not alter the local world. Local rendering stays normal and remote ghosts are tinted.
- After approximately60 seconds without actual movement or intentional V/push-to-talk activity, an inactive ghost fades. Active speaking/intentional activity refreshes presence; background jitter does not.
- Voice uses hold **V**, with an equivalent mobile interaction, and no invisible audible participants.
- Account access belongs to the complete themed, scrollable website presentation and the contextual account-counter inspection, using the same account state.

**PROPOSED DEFAULT implementation policies:** authenticated opt-in presence; room/version/geometry admission; audience/rate limits; browser session design; microphone permission/release/focus guards; functional per-person mute/block and server-enforced owner abuse controls; recording off by default; conservative treasury visibility. These are authored controls and policies for the coming GO, not additional statements attributed to the user. Their concrete contracts follow below.

Website and bounded shared-backend adapters are the proposed scope for delivering those requirements. Do not silently redesign dexCode/dexClient, replace their authentication, move their stores or change their product permissions. Existing public content remains usable without an account, social participation or microphone. There is no login-based donation reward, currency, paid upgrade, subscription tier, text chat, direct messaging, voice transcription or competitive gameplay leaderboard here. **Confirmed-contribution treasury ranking is in scope** and is separate from competitive gameplay scoring. Personal artwork remains confined to its approved Illustrations display use.

## 2. Existing identity source and the browser boundary

The inspected local sources provide a usable starting identity contract, not current live-service proof:

| Owner source | Established by source | Not established |
|---|---|---|
| [dexClient account manager](<D:/Dex/Projects/SUMMER PROJECT 3/dex-client/client/src/main/accountManager.cjs>) | Default relay origin `https://relay.dex.place`; password sign-in/sign-up, conditional OAuth, identity projection and local session ownership | Current provider availability, website cookie/session behavior or a live browser sign-up |
| [dexCode account manager](D:/Dex/AI/DexShell/electron/accountManager.cjs) | Same default identity origin; refresh, account/device use and signed-out lifecycle | Website SSO or permission to reuse a desktop session file in a browser |
| [Account architecture](D:/Dex/AI/DexShell/docs/account-relay-architecture.md) | Suite-wide Dex identity; dexClient setup doorway; dexCode desktop guest mode and account-backed mobile/device/chat use | Every older deployment/version statement being current |
| [Relay auth handler](<D:/Dex/AI/DexShell/relay/dexcode-relay/api/auth/[action].mjs>) | Supabase-backed sign-in, sign-up, refresh, OAuth URL and `me` handlers | Website recovery/code-exchange/cookie endpoints or a verified `dex.place` callback registration |
| [Relay helper](D:/Dex/AI/DexShell/relay/dexcode-relay/api/_lib/supabase.mjs) | Server-side auth configuration references, bearer validation and existing API response/CORS behavior | A reviewed credentialed cross-origin browser session policy |
| [Mobile browser predecessor](D:/Dex/AI/DexShell/relay/dexcode-relay/public/mobile/mobile-shell.js) | Browser sign-in/refresh and locally stored bearer-session precedent | Cross-origin/cross-browser SSO, a production website session design or shared filesystem access |

These files were inspected as source. No credential file, live session store or account record was read. Source references and configuration names may be retained privately; raw secrets, tokens, cookies and local account data must not enter public docs, frontend bundles, logs or review artifacts.

### Proposed adapter ownership

1. Reuse the existing provider user ID as the stable `dex account` ID. Never join accounts by display name or silently merge two provider users because their email text looks similar.
2. Add a bounded website-facing account adapter, with versioned contracts and tests around the existing relay/provider. Keep product data behind modules such as `dex-place`, `dexcode` and `dexclient`; identity reuse does not grant website access to chats, files or remote PC execution.
3. Prefer a same-origin website session boundary under `/api/account/`. A short-lived host-only Secure/HttpOnly/SameSite cookie identifies a server-side website session; refresh material stays server-side behind the existing secret-storage/deployment boundary. Do not put the desktop session file, refresh token or service-role key in browser storage or URLs.
4. Apply CSRF/origin checks to website mutations, rotate sessions at authentication changes, and expire/revoke them deliberately. Existing bearer clients retain their contract; website cookie support must not silently weaken or replace it.
5. OAuth uses a verified authorization-code/PKCE/state flow and an explicitly registered `dex.place` callback. The inspected implicit-fragment predecessor is not automatic approval to place long-lived tokens in website URLs. If the existing adapter lacks the required exchange route, implement a narrow compatible addition after proving the provider flow.
6. Browser sign-in and desktop sign-in share identity, not automatic access to each other's local sessions. Do not promise that logging into the website signs every installed app in or out. Website logout affects website sessions/presence/voice within its stated scope.
7. Backend configuration contains secret references only in project documentation. Resolve actual secrets only in the authorized execution environment; browser modules receive no backend setup fields.

**OPEN before live integration:** deployed identity/source version, Google enablement, callback allowlist, email confirmation/recovery capability, applicable provider limits, and the actual session adapter/storage owner. Verify with owned test accounts after GO. An old relay health receipt is not proof that these website flows work now.

## 3. Account screens, states and controls

The account entry is a secondary shell action, not a fifth primary content tab. `/account` uses the full themed website presentation with natural page scrolling, readable hierarchy and responsive content, following chapter21. It must not reintroduce the old viewport-confined modal as the entire account experience. Direct/deep links work without canvas. Interacting with the account counter opens the same account flow through a context-bound inspection surface; the world and physical opener are retained for return. Full-page and counter-context views share identity, validation, loading/error state and control contracts rather than separate account implementations. Full account content owns focus/scroll and pauses world interaction; Close/Back returns appropriately to its actual source. No sword action submits credentials or approves external login.

| State | Visible behavior |
|---|---|
| Guest | `dex account`, Sign in and Create account; existing public content remains usable |
| Session checking | Reserved identity space and `Checking account…`; never flash another person's data |
| Sign-in/create form | Explicit fields and independent submit state; browser password-manager/autofill supported |
| OAuth pending | Explain the external continuation; Cancel returns safely without reporting success |
| Confirmation required | State that the account needs confirmation; no fabricated signed-in session |
| Signed in | Display name, profile, private progress/history and this website's session controls |
| Session expired | Stop authenticated writes/presence/voice; retain unsynced local progress safely; offer Sign in |
| Offline/relay unavailable | Public site and local progress continue; private account data is either clearly cached or unavailable |
| Recovery pending/invalid | Explicit recovery status; expired/used/canceled links never mutate a different account |
| Mutation failure | Keep valid draft, show a field-specific/retryable result; no false success from timeout |

All submits prevent duplicate activation while their exact request is pending. Cancellation/route exit invalidates stale responses. Authentication success verifies identity before displaying account data. Error copy must not expose provider internals, account-existence information unnecessarily, credentials or a different user's profile.

| ID | Label | Concrete contract |
|---|---|---|
| ACC-001 | dex account | Open the full themed `/account` page, or the same state through account-counter inspection; guest sees sign-in and authenticated visitor sees their overview; focus heading |
| ACC-002 | Sign in | Select sign-in form; retain only safe current-page drafts |
| ACC-003 | Create account | Select registration; explain existing shared identity without implying a separate website account |
| ACC-004 | Email | Validated email field with appropriate autocomplete; never published as ghost/public alias |
| ACC-005 | Password | Masked password field; never persisted in progress, analytics or error logs |
| ACC-006 | Show password / Hide password | Changes only this field's visibility; accessible pressed/state wording |
| ACC-007 | Sign in / Create account | Submit the active validated form once; loading/denial/confirmation states are distinct |
| ACC-008 | Continue with Google | Available only after actual provider configuration is known; external auth has a safe return/cancel path |
| ACC-009 | Forgot password | Open recovery form; never disclose whether an entered account exists |
| ACC-010 | Send recovery link | Submit once; generic response, bounded resend cooldown and actual delivery/error handling |
| ACC-011 | New password | Available only inside a verified recovery session, with normal validation/autocomplete |
| ACC-012 | Save new password | Complete the verified recovery flow once; invalidate consumed link/session and return to sign-in as appropriate |
| ACC-013 | Resend confirmation | Actual supported confirmation route only; bounded cooldown and honest unavailable state |
| ACC-014 | Cancel / Close | Cancel pending local intent; return to the prior website route or actual counter inspection opener according to entry context; never cancel someone else's backend session |
| ACC-015 | Profile | Open own profile fields; public display-name explanation is clear |
| ACC-016 | Display name | Plain text, proposed2–32 characters; no HTML, impersonation privilege or email fallback in public presence |
| ACC-017 | Save profile | Validate, submit with revision, then display server-confirmed values; failure preserves draft |
| ACC-018 | Progress | Read own versioned product progress, including supported imported guest state and provenance limits |
| ACC-019 | Donation history | Read own confirmed records and separately labelled unresolved claims; no other person's private contributions |
| ACC-020 | Sign out | End this website session and stop social/voice immediately; public content remains. Do not claim global desktop/provider logout |
| ACC-021 | Retry account | Retry the failed read/session check without repeating a completed mutation |
| ACC-022 | Import local progress | Deliberately merge this browser's guest progress after showing destination account and summary |
| ACC-023 | Keep local progress separate | Continue with guest data unmerged; do not silently delete it or re-prompt every navigation |
| ACC-024 | Confirm progress import | Idempotent server merge against the displayed account/version; restore prior state on rejected migration |

Initial profile editing is display name plus supported existing provider avatar presentation. Arbitrary avatar/file uploads, social biographies, friends lists and account billing are not added incidentally. A fallback avatar uses initials or a neutral existing asset, never private gallery art. Recovery/session expiration/logout are actual first-pass flows, not dead links. If a required provider route is unavailable, implement a verified compatible route or mark the feature incomplete; do not present a decorative recovery form.

## 4. Progress, guest merge and world visits

**CONFIRMED:** include all progress and donation history. Implement this through explicit product-owned modules rather than one untyped JSON object that every product overwrites.

The `dex-place` progress schema is limited to explicit room/content discoveries, the cut map and persistent shortcut/mechanism states, a safe checkpoint, settings and boss encounter/win history. No quest system, NPC quest milestones, objective tree, collections or reward inventory is introduced by this account chapter. Include existing verified history where an owner/import source exists; do not fabricate visits, cuts, fights or donations that were never recorded.

Each record has account/guest scope, product/module ID, stable room/content/mechanism ID as applicable, schema version, world revision, event ID, recorded time and source/provenance. Server-authored confirmation is distinct from user-reported/client gameplay state. Progress is not a payment receipt, account entitlement or proof of a transferable competitive score.

- Guest progress stays local to that browser/device until a deliberate merge. A guest token is not a backend credential. Disabled/corrupt local storage degrades to session-only progress with an honest message.
- At sign-in, show the target account and merge preview. Union compatible discovery/cut IDs, deduplicate historical events and preserve stable shortcut/mechanism states. Resolve checkpoint/settings conflicts explicitly without deleting either source snapshot. Repeated sign-in/import cannot duplicate history or reset exploration implicitly.
- Conflicting branches or choices remain explicit. Default to retaining both historical events while keeping the currently active account branch; do not choose a destructive overwrite. A migration needing user choice stays pending with the original guest data retained.
- Donation claims/confirmed records never merge by client-supplied totals. They use the verified ledger/linking rules below.
- Account switch must dispose cached private data and queued requests before loading the next identity. An offline mutation created for account A cannot replay into B.
- Use bounded idempotent writes and revision checks. Retry safe events after reconnect; reject stale ownership/schema and retain a readable unsynced record. Do not silently call an unsaved action synced.
- Map migrations use stable semantic anchors/object IDs, never blindly restored raw coordinates. Restore compatible saved cuts and persistent shortcuts/mechanisms in a safe stable state before resolving the checkpoint. Missing/unsafe locations return to a current safe anchor with history retained. Removed content/mechanism IDs stay historical rather than becoming unrelated new progress.
- A corrupt/future-version payload cannot teleport the player, restore an armed download, grant admin/voice privileges or inject an unknown item. Keep a recoverable prior version and a migration receipt.

### Persistent exploration and fresh product-menu fights

Exploration persists across page reload, sign-in and return: restore valid discoveries, saved cuts, stable shortcut/mechanism states, checkpoint and settings through the migration rules above. A cut that was persisted may restore its safe settled consequence; never serialize a moving deck/lift position, held key, open menu, live fight or victory-download intent as resumable state. Moving mechanisms resume from an appropriate safe dock/stable state derived from the current map and saved discrete progress, not from an obsolete animation frame. Explicit Restart/reset may clear its stated exploration scope through the normal clear/confirmation contract; login or reload is not an implicit reset.

The fresh-fight boundary is **each world product-menu visit**, not every global world session or every mechanism. A victory grants only an ephemeral grant bound to the current product/menu visit. Closing or leaving that menu, reloading, or changing product invalidates the grant. Each new world entry to a product menu therefore requires a fresh fight, even when past wins and exploration remain in account history. Never persist `bossMenuUnlocked=true` or replay an old victory callback. Direct ordinary download access remains its separate content route. A failed/repeated history sync cannot trigger a download or restore a grant.

## 5. Treasury and verified donation history

Treasury is a secondary view within Donate (`/donate/treasury` proposed), with personal history under `/account`. The current Ko-fi URL, MB account/recipient,100k–10mil VND controls, coherent QR snapshot and no-false-payment-success rules remain owned by04. Choosing a method, amount, QR, copy action, outgoing link or returning browser session never confirms a contribution.

### Proposed ledger and publication defaults

- The owner ledger stores verified incoming contributions with stable ID, provider/source, original-currency amount in integer minor units, received timestamp, verification source/reference, status and audit revision. Never sum USD and VND or invent an exchange rate. Public totals are grouped by currency and are not a bank-balance display.
- Treasury ranking is in scope: rank only adequately linked confirmed, publicly amount-visible contributions within a currency, honoring the visibility rules below. Do not rank fabricated donors, merge unrelated anonymous people into one claimed identity, compare unlike currencies, or expose withheld amounts. This is contribution presentation, not a competitive gameplay leaderboard.
- States are `pending-review`, `confirmed`, `rejected`, `reversed` and `corrected`. Only confirmed, unreversed amounts enter confirmed totals. Corrections/reversals append audit events; they do not erase history or imply that the website initiated a refund.
- Provider event IDs or a reviewed bank-record identity deduplicate imports. Repeated webhooks, operator clicks and claim retries cannot double-count money. Unknown sender, unmatched amount or conflicting evidence stays pending and absent from public confirmed totals.
- **PROPOSED DEFAULT because Dex did not choose public naming/amount disclosure:** public listing is opt-in; default is no identifiable public row. A contribution shown without an explicitly selected alias is `Anonymous`. Amount disclosure is a separate opt-in; withheld amounts display `Private`, not0. Public totals/counts must not allow a withheld individual amount to be recovered from a single-row delta: initially aggregate only amount-public confirmed records and label the subtotal accordingly. The private owner ledger still includes every verified contribution.
- Never derive a public alias from bank sender/legal name, email, receipt text or provider profile without consent. Account display name and donation alias are separate. Changing public-display preferences does not alter the original contribution or beneficiary.
- Each signed-in donor sees all records actually linked to their account, including historical confirmed contributions after reliable matching, plus separately labelled pending/rejected claims. An empty history says no linked records; it does not assert the person never donated.

### Operational first-pass confirmation

Manual verified admin reconciliation is a real initial implementation, not a placeholder waiting for an invented bank API. The owner can enter/import a bounded record from an actual trusted provider receipt or bank transaction record, inspect source/date/currency/amount/reference, match it to a claim/account only when justified, and confirm it into the ledger. Confirmation requires a real evidence reference and an audit entry identifying the authorized operator; a checkbox alone is not evidence.

Only a server-verified owner role can read the private reconciliation queue or mutate confirmation state. A public client cannot assign that role or submit `confirmed=true`. Private receipt references and sender details stay outside public responses. No bank credentials, balances, statements or raw transaction documents are requested from visitors by this website. Prove this real role/storage workflow with isolated, excluded fixtures. If a genuine historical receipt is available, verify it through the same workflow; if none exists, production Treasury remains honestly empty. No new donation or test payment is required to finish implementation.

Investigate automatic provider receipts after GO using the actual available account capabilities and official integration contract. If usable, validate authentic events, replay/idempotency, currency/status and correction behavior before automatic confirmation. Ko-fi redirect alone supplies no receipt. MB Bank account ownership supplies no API entitlement. Do not scrape bank sessions, infer a transaction from a QR, or invent a direct MB Bank API. If automatic integration is unavailable, the verified manual queue must still operate end to end and its manual status must be honest.

### Linking and controls

A signed-in visitor may submit a bounded claim referencing an existing donation (provider, date, amount/currency and receipt/reference if available). It starts pending. Possession of a guessed reference, matching display name or a self-entered amount does not prove ownership. Link only through trusted provider identity/correlation or documented owner verification. Unmatched confirmed contributions remain in the owner ledger without exposing private details to arbitrary claimants. No public receipt-upload feature is added by this form.

| ID | Label | Concrete contract |
|---|---|---|
| TRE-001 | Treasury | Open public confirmed view within Donate; does not initiate payment |
| TRE-002 | Currency | Select a represented currency; totals and rows remain in that currency, with no invented conversion |
| TRE-003 | More contributions | Cursor-paginated confirmed public rows only; stable ordering and deduplication |
| TRE-004 | Back to Donate | Restore method/amount state through normal navigation; no payment-success inference |
| TRE-005 | Add to my history | Open own pending claim form; no automatic public listing |
| TRE-006 | Donation source | Ko-fi or MB Bank source selector; changes only the claim form |
| TRE-007 | Date / Amount / Currency / Reference | Plain validated fields; amount/reference never authorize confirmation or another account lookup |
| TRE-008 | Submit claim | One pending claim with idempotency key; receipt of claim is not receipt of money |
| TRE-009 | Public listing | Explicit per-contribution opt-in; default off |
| TRE-010 | Public name | Choose Anonymous or an explicit plain-text alias; no legal-name/email autofill |
| TRE-011 | Show amount | Separate default-off preference; does not change private ledger value |
| TRE-012 | Save visibility | Apply server-confirmed publication preferences; clear stale public/private caches appropriately |
| TRE-013 | Retry treasury | Retry failed reads; no fake seed rows, totals or pending-as-confirmed substitution |
| TRE-014 | Close claim / Cancel | Preserve or discard unsent current-page draft as stated; no contribution record fabricated |
| ADM-001 | Contribution review | Owner-only pending/matched queue, with private evidence and status |
| ADM-002 | Add verified source record | Enter actual bounded evidence/reference; remains pending until confirmation |
| ADM-003 | Match account | Select only an adequately verified claim/account relationship; unmatched is a valid outcome |
| ADM-004 | Confirm contribution | Confirm exact reviewed amount/currency/reference once; explicit review summary before commit |
| ADM-005 | Reject claim | Record a bounded reason; preserve history and expose only the claimant-safe explanation |
| ADM-006 | Correct / Reverse record | Append a reviewed correction/reversal with reason and recomputed totals; does not execute a bank refund |

## 6. Ghost presence in independent worlds

Presence is a separate optional overlay, not a multiplayer simulation. **PROPOSED DEFAULT:** authenticated visitors explicitly enable Nearby; guests can keep exploring and access all content. This supplies stable identity for meaningful mute/block and owner controls without inventing guest account linkage. If guest social participation is later required, give it a separately reviewed identity/abuse contract rather than silently weakening blocks.

### Membership, compatible placement and activity

**Proposed visibility interpretation:** for presence/voice admission, visible means eligible for representation in the active compatible world, not necessarily inside the current camera rectangle. Ordinary camera culling does not disconnect a nearby voice; spatial playback and the existing Nearby/speaking state identify that person. Inactivity fade, blocking, incompatible geometry, withdrawn presence and full content coverage do revoke audio eligibility. Keep this distinction when adapting the spatial reference in23.

- Server membership binds authenticated subject, one presence session, product/world version, room ID and an admitted geometry compatibility key. Clients cannot publish into arbitrary rooms or spoof another account.
- The compatibility key includes the static collision/layout revision and relevant private dynamic supports. A ghost standing on a private raised/lowered bridge or lift may be shown only when the observer has a compatible support state; otherwise remove/suspend it rather than drawing a floating person or modifying the observer's mechanism.
- Remote snapshots contain only permitted pose information: session/public alias, room/revision, position, facing, pose/animation phase and activity/speaking status. No chats, files, input text, progress inventory, donation history, money or local path is broadcast.
- Remote ghosts never become colliders, interaction targets for swords, boss targets, item collectors or mechanism drivers. A remote slash can show an admitted harmless pose but cannot play a local damage/hit event or alter the observer's world. No remote victory unlocks anything.
- Local actor remains normal. Remote actors use a restrained single tint/opacity vocabulary and a short name/badge on inspection; never use gallery art as another visitor's sprite. Preserve native frame/pixel registration.
- Proposed cap: eight admitted visible remote participants per compatible room/audience, with at most four simultaneous received speakers. Choose nearest eligible visitors with stable tie-breaking/hysteresis; expose a truthful capacity state rather than silently playing unseen extra people.
- Send pose changes at up to10Hz with bounded packet sizes; interpolate only for presentation. Server validates sequence, room bounds and plausible movement envelope. Client timestamps never extend a server lease unboundedly.
- A keepalive or interpolation wobble is not user activity. Refresh `lastMeaningfulActivity` only for actual local movement input producing displacement or intentional current V/mobile-PTT activity. Do not manufacture motion to keep an empty window visible.
- At60 seconds of inactivity, stop transmission eligibility, fade the ghost over approximately2 seconds, then remove it from visible/audible audiences. A current deliberate push-to-talk/speaking session refreshes activity; a stuck key, hidden page or stale speaking flag does not.
- Disconnect/expired lease/stale poses use a bounded short fade, with voice unsubscribed first. Reconnection creates a verified fresh lease and snapshot; it cannot replay old speech or an old movement burst.

### Page and panel ownership

| Context | Pose/presence behavior | Voice behavior |
|---|---|---|
| Active focused world | Send actual admitted movement/activity; render compatible ghosts | Receive only eligible visible nearby people; transmit only while the intentional hold is active |
| Still in world, no activity | No fake movement; activity timer continues | Deliberate PTT may refresh presence; otherwise silence/inactivity rules apply |
| Lightweight Nearby, person or audio HUD popover | Keep eligible visible ghosts and stable selected-person binding; suppress gameplay attack/movement input while controls own focus. Opening this popover does not withdraw membership | Keep eligible listening so mute/block acts on the actual person. End an existing PTT hold and prevent V/typing/click leakage; a fresh intentional talk action requires appropriate world/Talk-control focus |
| Full Menu/modal, reader, gallery viewer, Donate/account/treasury content covering the world | Stop gameplay pose/input publication; mark temporarily unavailable and fade/remove local presence to others | End transmit immediately; suspend received voice while the world is covered, so no hidden audible participants remain |
| Full-content scrolling, text editing, slider dragging or gallery panning | DOM owns input; neither scrolling nor typing counts as world movement/activity. Scrolling a lightweight HUD list instead follows its retained-presence row above | V typed in fields is ordinary text, with no transmit/permission request. Full content withdraws voice eligibility; lightweight controls may retain eligible listening |
| Background, pagehide, blur, rotation or native permission dialog | Clear held input and withdraw/suspend presence; resume only with explicit world entry | Immediately end/unpublish microphone output and suspend reception; no buffered speech on return |
| Version/geometry mismatch | Do not render incompatible remote actors; retain local world | No audio route to an incompatible/invisible participant |

| ID | Label | Concrete contract |
|---|---|---|
| SOC-001 | Nearby | Open lightweight world HUD popover with current room/privacy state; retain eligible visible participants/listening; no primary-tab addition |
| SOC-002 | Show nearby visitors | Explicit participation toggle; off withdraws own presence and removes remote ghosts/voice |
| SOC-003 | Participant | Open lightweight controls bound to the selected account/session; opening them does not remove that ghost or rebind actions to a different person. If the person independently leaves, retain the identity and show that state |
| SOC-004 | Mute person / Unmute person | Stop actual receive subscription/gain for this person; persist per-account preference and show state |
| SOC-005 | Block person | Confirm, then remove both directions of presence/voice eligibility; reconnect cannot restore them locally |
| SOC-006 | Blocked people / Unblock | Own account list; explicit unblock permits future matching, never replays past audio |
| SOC-007 | Report person | Submit subject, room/version/time and selected reason to owner queue; no automatic audio recording/upload |
| SOC-008 | Retry nearby | Retry the failed session/transport join safely; public world remains available |
| SOC-009 | Close nearby | Close lightweight HUD controls and restore world focus without relinking a stale target or silently re-enabling disabled social/voice; PTT needs a fresh hold |

Blocking is more than tint/volume. Enforce it in audience selection/token/subscription policy as well as immediate client cleanup. Do not expose a list of who blocked whom. Name changes or renewed sessions cannot bypass account-level blocks. A forged participant event cannot add a remote sound source outside the admitted list.

## 7. Proximity voice and transport checkpoint

Voice is optional and initially off, independent of the existing soundtrack Sound button. There is no camera request, autoplay microphone prompt, default open mic or recording/transcription. Existing music/SFX settings remain their own controls. Joining voice must not secretly modify donation/profile visibility.

### Actual transport, not an HTTP assumption

LiveKit is the initial implementation candidate for bounded rooms and controlled subscriptions; [its spatial-audio example](https://github.com/livekit-examples/spatial-audio) is a reference, not production proof. Preserve the package license and review the used code before adaptation. Choose the actual deployment/provider only after a small real-connection checkpoint.

LiveKit documents separate signaling/API and WebRTC media connectivity, with ICE/UDP, TCP fallback and optional TURN ports. The existing website's HTTP Cloudflare Tunnel therefore does **not** establish that it carries voice media. [Ports/firewall documentation](https://docs.livekit.io/transport/self-hosting/ports-firewall/). Do not change network rules, create a new public service or buy a voice plan by assumption. After GO, record the proposed endpoint, reachable media route, current entitlement/quote, participant/egress limits and ongoing cost before adopting it. A free local connection is not proof that cross-network mobile clients can connect or that hosted operation is free.

Use short-lived server-issued join grants scoped to account/session, room/version and allowed media operations. Server-only provider signing secrets stay behind secret references. Presence may continue without voice if media is temporarily unavailable, but the requested voice feature stays explicitly incomplete until its real cross-network transport is proved. Do not substitute a fake speaking indicator or route microphone audio through an unverified HTTP endpoint.

### Permission, hold and audio rules

- `Join voice` admits listening only after an explicit gesture; the first deliberate talk setup requests microphone permission. Explain which device is active and provide Leave voice. Browser permission denial, no microphone, busy device, insecure origin and canceled permission are separate recoverable states. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) owns the browser permission/secure-context facts.
- Acquire only audio. A delayed permission result never begins transmission after the original hold was released, focus lost or room/session changed. Require a fresh hold after permission completes. No permission retry loop opens prompts automatically.
- Press V only while focused in active world, or hold the dedicated mobile Talk control. Pointer capture/keyboard state defines the hold. Release, pointercancel, lostpointercapture, blur, visibilitychange, pagehide, rotation, disabled participation, mute/block, session expiry or transport loss ends publication immediately and clears the latch.
- Proposed first route releases/stops capture when leaving voice/background or losing eligibility; any reusable muted capture between deliberate holds must be clearly indicated and proved to transmit no frames. Never pretend a retained live microphone track is closed. A microphone test does not record/upload audio.
- Received speech is distance-attenuated within an authored room radius (proposed start360 world pixels), with bounded stereo pan and no volume spike at entry. Use short gain ramps at admission/removal; no audible route exists when the ghost is faded, culled, blocked, incompatible or hidden by full content. Lightweight participant/audio HUD controls retain visible eligible people and listening; their actual mute/block action, not opening the popover, changes delivery.
- A visible speaking indicator reflects actual admitted audio activity, not just packet traffic or a stale V flag. Visual activity can refresh presence only while the session remains eligible. Mute still wins over speaking status.
- Music may duck modestly while audible nearby speech is present (proposed maximum6dB), then restore smoothly. This affects playback only; it does not change user slider values, generate music or add donation sound rewards. The room's existing silence rules stay intact.
- Proposed per-hold watchdog: stop after60 seconds without a fresh release; require a new press. This bounds stuck-input publication, not a paid-talk quota. Keyboard auto-repeat cannot create additional holds or bypass the watchdog.
- Inbound/outbound voice and session cleanup must work independently of the render framerate. A crashed canvas, suspended tab or stalled pose stream cannot keep a microphone publishing.

| State | Visible result and next action |
|---|---|
| Off | Join voice; no microphone capture or incoming voice |
| Joining | Pending transport; Cancel/Leave available, no transmit |
| Listening | Participant controls and hold-to-talk instruction; microphone readiness shown accurately |
| Permission needed/pending | Explicit requesting state; no presumed publication when the dialog returns |
| Ready | Fresh V/mobile hold may transmit while eligibility holds |
| Talking | Own visible speaking/PTT state; release stops immediately |
| Muted/blocked/idle/covered | No prohibited receive/publish route; state explains the relevant local condition |
| Disconnected/capacity reached | Honest status, bounded retry; no invisible background speaker |
| Permission/device error | Keep core site usable; retry only on deliberate action; no browser-setting changes by the app |

| ID | Label | Concrete contract |
|---|---|---|
| VOI-001 | Join voice | Explicit opt-in for this eligible world session; no camera request |
| VOI-002 | Leave voice | Stop capture/publication/subscriptions and release transport references immediately |
| VOI-003 | Enable microphone | Deliberate permission/device setup; result cannot inherit an obsolete hold |
| VOI-004 | Hold V to talk / Hold to talk | Existing keyboard V plus mobile held button; release/cancel guards above; meaningful pressed/disabled states |
| VOI-005 | Microphone | Choose from legitimately available devices after permission; errors never silently select an unexpected new device |
| VOI-006 | Voice volume | Local received-voice gain, proposed default70%; no change to soundtrack sliders or anyone else's voice |
| VOI-007 | Mute all voices / Unmute voices | Immediate local receive mute; retain per-person blocks/mutes and show state |
| VOI-008 | Retry voice | One bounded reconnect for current identity/room; no automatic permission prompt or stale speech replay |
| VOI-009 | Cancel microphone setup | Dispose late capture results and return to listening/off according to prior state |

## 8. Owner abuse control and data lifetime

Owner controls are operational server-enforced tools under an authenticated owner route, not visible actions for ordinary visitors. Role assignment is verified through the existing backend identity owner, never a public profile flag or account display name.

| ID | Label | Concrete contract |
|---|---|---|
| MOD-001 | Reports | Owner-only queue of bounded reports and necessary identity/time/room evidence; no recorded voice by default |
| MOD-002 | Remove from room | Revoke current presence/voice admission, disconnect and record reason; client reconnect cannot reuse the revoked lease |
| MOD-003 | Restrict voice | Apply a server-enforced duration/scope and reason; existing publication stops, new grants deny it |
| MOD-004 | Restrict social access | Exclude an account from presence/voice for the stated scope; ordinary public content remains available |
| MOD-005 | Review / Lift restriction | Explicit owner action with audit trail; expired/revoked controls are reflected consistently |

Rate-limit joins, claims, profile changes, reports and pose traffic by appropriate authenticated/session/network boundaries; limits must return usable status, not silently fail. Owner review cannot fabricate a transcript or claim to have heard a report's alleged speech. A report records a complaint, not a proven offence. No automatic threat/identity inference or broad user tracking is added.

Proposed data lifetime: live positions/session leases are transient and removed shortly after disconnect/expiry; no location trail is retained as analytics. Account progress and confirmed contribution history are durable user/owner data with versioned correction, subject to the selected backend retention policy. Security/abuse audit retention is bounded and documented before production; store necessary metadata, not microphone recordings. Cross-product retention/deletion ownership remains an explicit open account-data decision. Preserve existing records and do not implement a destructive global Delete account button by guessing ownership; this does not add a new deletion/export UI to the pass.

## 9. Verification required for the complete pass

Use owned test identities and isolated fixtures. Fixture accounts/contributions are visibly marked and excluded from production/public treasury; never seed fake donors, users or public online counts for a screenshot. Preserve the actual release/map/backend/media versions and distinguish native devices from emulation.

| Check | Required observable evidence |
|---|---|
| N22-01 Shared identity | Website sign-in and an existing product test account resolve the same provider subject without reading/copying desktop session files or changing its product permissions |
| N22-02 Auth lifecycle | Registration, confirmation if required, sign-in, provider cancel/denial, refresh, expiry, recovery, logout and reconnect work through actual configured routes; no secret/credential leakage |
| N22-03 Browser session boundary | No bearer/refresh material in public URLs/storage/logs; secure cookie/session ownership, CSRF/origin rejection, account-switch isolation and canceled-response cleanup proved |
| N22-04 Guest merge | Empty, duplicate, offline, conflicting, corrupt, old/future-schema and account-switch cases preserve discoveries, cuts/shortcuts, stable mechanisms, checkpoint/settings and boss history; no duplicate merge, invented progress or implicit login reset |
| N22-05 World migration/fresh boss | Saved valid cuts/shortcuts restore safely; obsolete coordinates/IDs migrate without transient lift/fight/menu restoration. Every new world product-menu visit requires a fresh fight; close/leave/reload/product change invalidate only its ephemeral grant, not persistent exploration |
| N22-06 Treasury truth | Prove the actual owner role, storage and confirmation/correction workflow using isolated excluded fixtures, including duplicate/rejected/reversed/unmatched cases. Verify a genuine historical record if available; otherwise production Treasury is honestly empty. No new donation/test payment is an acceptance gate |
| N22-07 Donation privacy | Alias/listing/amount opt-ins, Anonymous/Private states, per-currency totals and account ownership prevent disclosure or guessed-reference history access; unchanged04 QR/Ko-fi behavior regresses cleanly |
| N22-08 Automation route | Available actual receipt integration is investigated and authenticated/idempotent behavior proved if adopted; otherwise the manual verified queue works fully and is labelled honestly |
| N22-09 Independent worlds | Two real clients share visible ghosts while their boss, health, files, bridges and lifts stay independent; no remote state/action can trigger a local external effect |
| N22-10 Compatibility/activity | Different room/version/private support state excludes the ghost/voice;60-second inactivity fades it; movement/PTT refresh works; heartbeats/jitter/background do not keep it alive |
| N22-11 Voice path and cost | Actual clients across different networks, including target Samsung Internet and iPad Safari, join through the selected signaling/media route; codec/latency/reconnect/egress and current cost/entitlement are measured |
| N22-12 Microphone guards | First permission, denial, delayed grant after release, V autorepeat, mobile cancel, blur, rotation, pagehide, canvas loss, logout and packet loss cannot leave capture/publication active or resume it invisibly |
| N22-13 Audibility/mute/block | Voice only comes from admitted visible compatible people. Opening a lightweight person/audio popover retains that target/listening while suppressing attack/PTT/typing leaks; actual mute/block stops routing. Full content/blur withdraws. Reconnect/name changes cannot bypass block/owner restrictions |
| N22-14 Capacity/abuse | Audience/speaker/traffic caps, forged IDs, stale grants, reported users, removal and restriction expiry behave deterministically with usable feedback and no fabricated report evidence |
| N22-15 Accessible complete flows | Full themed scrolling account pages and counter-context inspection share the same flows; every control's keyboard/touch/focus/error/disabled state works at normal/enlarged text, real200% zoom, narrow screens and actual screen-reader speech. Lightweight HUD controls remain distinct from full covering readers/modals; V never captures text input |
| N22-16 Source/public integrity | Account/backend migrations, new API routes, licenses, secret refs, schema/control IDs, deployment/rollback and public-doc export match the exact tested pass; no frozen public edition is overwritten |

## 10. Exact remaining factual checkpoints and GO sequence

**OPEN facts, not requests for another taste menu:** actual identity-provider deployment and callback/recovery configuration; browser session/storage implementation; owner/admin-role provisioning; verified contribution source access and reliable account-linking evidence; available Ko-fi/bank receipt integration; precise public disclosure preference (conservative defaults above apply unless changed); selected voice transport/endpoint, accessible media connectivity, plan/egress limits and quote; supported device/browser versions and actual microphone behavior; account/audit retention policy and cross-product ownership boundaries.

Under the received GO, the implementation sequence for this chapter is:

1. Read the master/current owners and revalidate the existing identity source/live contract with bounded test identities. Record exact proposed backend/schema changes and isolate website adapters from desktop product work.
2. Prove browser login/recovery/session and versioned progress/guest merge against real storage, preserving exploration while invalidating per-product-menu fight grants correctly. Wire full themed scrollable account pages, shared counter-context inspection and errors.
3. Build confirmed-contribution history/ranking, conservative disclosure and real owner reconciliation. Prove it with excluded fixtures and use genuine receipts only when available; never require a test donation. Investigate automatic receipts and retain the operational manual verification base if none is valid.
4. Prove two-client compatible-room ghosts with independent mechanics and real activity/expiry rules before adding voice. No staged fake crowds in production.
5. Establish the actual voice route/cost checkpoint, then implement opt-in held speech, visibility eligibility, real mute/block and owner enforcement. Verify across networks/devices; ordinary HTTP website hosting alone does not pass this step.
6. Reconcile every control/state and inspect the integrated world/panels/voice behavior, then run the complete N22 matrix and the master's existing journeys. Promote only the exact reviewed pass with rollback and honest remaining limits.

This sequence is the adopted implementation plan; current scope and evidence are recorded in26. The received GO does not itself satisfy a concrete provider, microphone, cost, payment or identity/security gate. A real external cost/identity/security gate is handled at its concrete step; it is not replaced with a fake service or silently removed requirement.
