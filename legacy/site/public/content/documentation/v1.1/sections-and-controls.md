<a id="sections-content-and-control-contracts"></a>
# Sections, content, and control contracts

<a id="source-21-implementation-precedence"></a>
## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](inhabited-world-and-experience.md) and [22](dex-account-treasury-and-social-presence.md) first. World victory opens a product menu through black and never automatically requests a file. Direct web content is below the game; each artwork gets a dedicated inspector. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

Design baseline. Requirements and proposals below describe intended behavior; release verification is recorded separately.

Last updated: 2026-09-06. Scope: Downloads, Documentation, and Illustrations. The companion documents own global navigation, world movement, pause/settings, and Donate. Together they form one specification; this document must not invent extra top-level tabs.

<a id="1-decision-language-and-boundaries"></a>
## 1. Decision language and boundaries

- **CONFIRMED** means Dex explicitly requested or accepted the behavior.
- **PROPOSED DEFAULT** means a concrete agent recommendation recorded for review; it is not a claim that Dex approved the detail.
- **OPEN** means missing factual input or required proof must be resolved before the dependent feature can be promoted. Authorized implementation may produce that proof; routine authored design choices are proposed defaults, not additional confirmation gates.
- **DEFERRED** means excluded from the first implementation unless Dex later adds it explicitly.
- All control layouts, labels other than the four tab names, spatial details, timings, sorting rules, persistence rules, and mechanics below are **PROPOSED DEFAULT** unless explicitly marked otherwise.
- A proposal recorded here is reviewable scope, not permission to build it now. Later go-ahead to the reviewed package accepts its proposed defaults subject to Dex's exclusions and factual/proof gaps, as specified in [00](decisions-and-scope.md). New controls and changed behavior must be documented before implementation.

<a id="confirmed-section-intent"></a>
### Confirmed section intent

| Section | Confirmed intent | Constraint |
|---|---|---|
| Downloads | A selected file can be earned by slaying a boss, then its download is triggered. | Selection and the coming file transfer must be deliberate; the fight cannot silently select an executable for the visitor. |
| Documentation | Files lie in the world and can be opened/read. | World presentation must coexist with readable document content. |
| Illustrations | An exhibit hall displays Dex's art. | Existing artwork is permitted only for display in this section. |
| Donate | A corresponding exhibit/support space offers Ko-fi or MB Bank. | The separate donation specification owns payment controls and recipient truth. |

**CONFIRMED:** the four top-level labels are `Downloads`, `Documentation`, `Illustrations`, and `Donate`. `dex` is lowercase in the Daniel font. Do not introduce Projects, About, Store, News, Community, or a fifth tab. Project context belongs within Downloads and Documentation.

**CONFIRMED:** existing art must not become the player, enemies, architecture, backgrounds, textures, loading screens, landing-page ornament, UI chrome, or image-generation references. Do not infer permission from its presence in legacy site code. A gallery thumbnail and its full display are allowed; a background image behind a downloads panel is not.

**DEFERRED:** descriptions of the illustrations and Convergence story publishing. Kaizen is confirmed as the main character of Dex's story series Convergence. No further biography, plot, character relationship, or title is to be invented.

<a id="2-shared-section-interaction-rules"></a>
## 2. Shared section interaction rules

<a id="route-contract"></a>
### Route contract

| URL | Meaning | Entry result |
|---|---|---|
| `/` | World landing | Global specification owns spawn, navigation, and loading. |
| `/downloads` | Download selection index | Open the Downloads panel at its landmark. |
| `/downloads/:productId` | One product and its releases | Open its details; no automatic fight or transfer. |
| `/documentation` | Searchable document index | Open the index, even if no file has been found in the world. |
| `/documentation/:projectId/:docSlug` | One document | Open the reader at its current version unless an explicit version is in the URL. |
| `/illustrations` | Exhibition catalog | Open the grid/list associated with the exhibit hall. |
| `/illustrations/:artworkId` | One artwork | Open the accessible viewer. |
| `/donate` | Donation choice | Donation specification owns its panel. |

- **PROPOSED DEFAULT:** document URLs use `?version=<versionId>` for a pinned version and `#<headingId>` for an anchor. Downloads use `?release=<releaseId>&artifact=<artifactId>` to retain the exact release/file selection. Internal IDs are stable slugs, never local Windows paths.
- **PROPOSED DEFAULT:** opening a section or item creates the appropriate browser-history entry. Replacing search/filter text updates the URL without adding a history entry per keystroke. Back restores the previous route and its scroll position. Forward works normally.
- **PROPOSED DEFAULT:** refresh and pasted links reconstruct the same selected content. They never reconstruct an armed download intent, active boss battle, payment attempt, held movement key, or autoplay decision.
- **PROPOSED DEFAULT:** stale/deleted item IDs show `This item is unavailable` with a link to the owning index. Do not redirect silently to another product, document, release, or artwork.
- **PROPOSED DEFAULT:** all public content routes use the real site origin. Owner-only file-system paths remain out of public manifests and error messages.
- **PROPOSED DEFAULT:** a fight is an in-memory submode of the selected Downloads detail URL. `Fight & download` hides its panel without changing that product/release/artifact address or adding a fight-history entry. Refresh reconstructs the selected details disarmed, never the encounter.
- **PROPOSED DEFAULT:** activating any primary tab, including Downloads when already in that route family, cancels the encounter/intent before revealing its index. Menu, Settings, Controls, and their Back/Resume actions pause and retain the encounter; they are not route navigation. Browser Back that leaves the detail route cancels it.

<a id="panel-focus-and-control-conventions"></a>
### Panel, focus, and control conventions

- **PROPOSED DEFAULT:** section content is real DOM text and controls. Opening a panel pauses world simulation, clears held movement/attack inputs, and gives focus to the panel heading or relevant control.
- **PROPOSED DEFAULT:** the reader/viewer panel fills the usable screen on narrow displays. Desktop retains an unobstructed reading area; scenery must not reduce contrast behind text.
- **PROPOSED DEFAULT:** [01](art-direction-and-audio.md) owns panel widths, modest 20–24 px titles, 16 px reading/field text, 14 px labels and explicit padding/group gaps. A wide shell does not stretch prose beyond its readable measure. Use actual long filenames and article titles in layout proof; wrap them without compressing the type or hiding the file's identity.
- **PROPOSED DEFAULT:** a world hotspot responds to the global Interact action (`E` on keyboard or the visible touch Interact control). It opens exactly the same panel as the corresponding tab/link. Range and focus affordances are visual as well as textual.
- **PROPOSED DEFAULT:** only the currently eligible nearby target shows its readable action/title prompt. Preserve the real target identity, wrapping long titles locally when needed; full titles remain in their panels. Distant files/exhibits never populate the skyline with floating labels. Existing signs and normal navigation remain available.
- **PROPOSED DEFAULT:** Enter/Space activates buttons, Tab follows visual reading order, Escape closes the current local viewer/panel, and ordinary browser Back follows history. No control requires a mouse gesture, hover, pixel-perfect jump, or a timed input sequence.
- **PROPOSED DEFAULT:** close/back restores focus to the opener where it still exists. World position and camera follow the entry-mode and Close/history contract in [05](shell-and-system-controls.md): physical prop source position or tab/direct-entry destination anchor.
- **PROPOSED DEFAULT:** SYS-35 owns Close section for these sections; SYS-08 owns Menu/pause. Local Back controls below move within a section and are not additional primary navigation.
- **PROPOSED DEFAULT:** touch targets are at least 48 by 48 CSS pixels. Focus, hover, pressed, selected, disabled, loading, and error states have distinct visible treatment. Color is supplementary, never the only signal.
- **PROPOSED DEFAULT:** loading preserves panel dimensions, marks the relevant region busy, and never claims content is ready. Errors stay close to their cause and preserve the visitor's selection. Retry is a deliberate action.
- **PROPOSED DEFAULT:** user-facing action text is short and literal. No marketing slogans, fabricated download counts, scarcity, ratings, or inflated claims.

<a id="3-downloads-place-content-and-transfer"></a>
## 3. Downloads: place, content, and transfer

<a id="place-and-visual-arrangement"></a>
### Place and visual arrangement

**PROPOSED DEFAULT:** the Downloads landmark is a silent dispatch chamber opening onto a contained boss arena. A low terminal gives access to the catalog. The chamber uses large empty surfaces, a restrained red signal, distant structural silhouettes, and a clean threshold into the fight. Existing artwork is not used here.

**PROPOSED DEFAULT:** the catalog shows a readable product list; selecting a product opens one detail panel. The selection panel contains title, factual summary, public release status, operating system/architecture, release version, file name, size, installation instructions link, and checksum. The primary action is `Fight & download`; `Download file` is the proposed accessible/direct alternative.

Group product identity, release/file metadata and actions with01's spacing. Avoid a tall heading slab or a dense row of every field. A long checksum/filename wraps or uses its documented local overflow without widening the page; controls remain next to the file they affect. Do not remove factual metadata just to make the panel look empty.

**PROPOSED DEFAULT:** the boss, arena silhouette, moves, damage, health, difficulty, and encounter length are owned by [02](world-and-gameplay.md). This document binds the fight's website outcome, not a second combat specification.

<a id="content-and-release-authority"></a>
### Content and release authority

- **PROPOSED DEFAULT:** `private website source workspace` remains the current product owner surface. Do not edit it as part of this planning pass or present every internal field publicly.
- **VERIFIED INVENTORY, 2026-09-06:** the current catalog contains the `dexcode` product. This observation is not a declaration that its local build is a current public release. Inventory actual public release manifests, public documentation, and approved art exports before populating the new site; additional user projects require explicit catalog mapping and public-content review.
- **PROPOSED DEFAULT:** implementation derives or maintains a reviewed public release manifest tied to that owner, using the required fields below. **OPEN factual inventory:** which real published artifact and document correspond to each intended public release still needs verification. Schema choices are routine implementation decisions within this contract; do not silently create a second authoritative catalog.
- **PROPOSED DEFAULT:** a public downloadable release requires product ID, immutable release/artifact IDs, version, supported OS, architecture, display file name, byte size, SHA-256 checksum, publicly reachable HTTPS artifact URL, and public availability status. Production manifests reject loopback/private hosts and `file:` URLs. The scoped loopback development exception below never makes an artifact public.
- **PROPOSED DEFAULT:** preserve the numeric byte size for accurate display. A human-readable size is derived; an estimated size is labeled as such and cannot be the final published artifact size.
- **PROPOSED DEFAULT:** a production release with no real public artifact is `Not available`. The presence of a local executable, local directory, build record, or a catalog entry is insufficient to enable a public download. After go, the actual reviewed documentation ZIP served by the loopback development origin may enable local-only proof under [13](build-readiness-and-scope.md); production availability remains false.
- **PROPOSED DEFAULT:** an internal product is not automatically a public portfolio announcement. Additional project inclusion, public descriptions, current releases, screenshots, and support matrices require review before their public release; they do not block building the selected documentation reward and local gallery baseline.
- **PROPOSED DEFAULT:** installers are files to save. The website never runs, mounts, installs, or opens them automatically and never fetches an executable merely because the visitor entered the arena or hovered a button.

<a id="initial-downloadable-content-confirmed-documentation-reward"></a>
### Initial downloadable content — confirmed documentation reward

**CONFIRMED (R-23):** the first boss reward is the website documentation itself. dexCode is not a fabricated downloadable release and is not required to prove the flow.

**PROPOSED DEFAULT:** one product card named `website documentation`, product ID `dex-place-documentation`, artifact ID `website-docs-zip`, with a ZIP containing the portable public edition of this full design specification. Filename pattern: `dex-place-documentation-v<spec-version>.zip`. The final version, byte size and SHA-256 come from the actual reviewed packaged archive; they are unknown until packaging. No ZIP is generated or served by this documentation edit.

- The initial online Documentation pages and ZIP must derive from the same reviewed sanitized export, with matching version and content hashes. Package its index and every allowlisted focused design chapter, preserving all public-facing rules and portable links; give the archive a root README.
- Use the explicit source allowlist, transformation record, and exclusion manifest in [13](build-readiness-and-scope.md). Replace private paths with portable role references; remove provider job IDs, credit balances, operator history, secret references, machine logs, private ownership records data, site agent-instruction files, illustration PSD/CLIP masters, and unrelated project docs. Never blanket-ZIP the owner folder or silently drop public-facing behavior during sanitation.
- User-supplied public donation facts may remain in the public specification. Never mistake an API key for public documentation material.
- This ZIP is platform-independent: display `ZIP · all platforms` rather than an OS-specific installer claim. Retain both release and artifact query parameters for the selected docs edition.
- Proposed artifact route pattern: `/files/dex-place-documentation/v<spec-version>/dex-place-documentation-v<spec-version>.zip`; it must be a real versioned file response, not an SPA route returning HTML.
- Fight & download and Download file bind the exact same archive metadata. Updating the working Markdown files never mutates a previously published ZIP's bytes; publish a new edition.
- For testing, use the actual packaged documentation archive once it exists. A temporary fixture may be used for isolated intent tests but must not be presented as the requested final reward.
- Local-only proof may serve that exact archive through a declared loopback HTTP development origin and a separate development manifest. It still needs real ZIP bytes, filename, length, checksum, and version; no production manifest or public-ready claim may reuse its loopback URL.

<a id="download-control-registry"></a>
### Download control registry

Every ID below is **PROPOSED DEFAULT**. The registry is the complete first-pass set of local Downloads controls; global HUD and combat controls are owned elsewhere. Repeated controls carry the stable ID plus the relevant product, release, document, heading, code-block, or artwork ID in the implementation inventory; runtime list positions are not stable identifiers.

| ID | Visual / label and trigger | Behavior | Loading, disabled, and error result | Keyboard / touch |
|---|---|---|---|---|
| DL-01 | World dispatch terminal; Interact | Opens `/downloads` at the catalog. | Catalog can load independently of the world. Failure shows `Downloads could not load` and DL-15. | E / touch Interact; tab route equivalent. |
| DL-02 | Product row with name, short summary, release state | Opens `/downloads/:productId`; preserves index scroll. | Missing product gets unavailable panel and DL-13. No misleading clickable empty row. | Focusable link; Enter / tap. |
| DL-03 | `System` selection with OS and architecture | Selects a real published variant. Device detection may suggest, never override an explicit selection. | A variant with no artifact reads `Not available`; fight/direct transfer disabled with adjacent explanation. | Native/select-equivalent keyboard operation / full touch picker. |
| DL-04 | `Version` selection | Chooses a listed public release; updates release query and displayed metadata together. | Historical/unavailable releases remain clearly labeled; no fallback to a different file without another selection. | Arrow/Enter / tap picker. |
| DL-05 | `Fight & download` primary button | Displays selected filename and size beside action; snapshots the exact product/release/artifact, arms one victory-triggered handoff, and enters fight submode while hiding details and retaining its URL. | Disabled if metadata/artifact is missing, validation is pending, or an intent already exists. Setup failure leaves disarmed detail panel and clear retryable error. | Enter/Space / tap; announces `Defeat the boss to download <filename> (<size>).` |
| DL-06 | `Download file` secondary link | **Proposed accessibility/direct route:** deliberate activation requests the selected artifact without combat. | Unavailable release disables the action with reason. Browser handoff is not labeled completed. | Normal keyboard-accessible download link / tap. |
| DL-07 | `Installation instructions` text link | Opens the exact project/release installation document under Documentation. | Missing instructions show `Instructions are not available yet`; never link to unrelated docs. | Enter / tap. |
| DL-08 | `Release notes` text link | Opens the corresponding version's document when published. | Hidden when no release notes exist; no empty promised page. | Enter / tap. |
| DL-09 | `Copy checksum` small button next to full checksum | Copies only the SHA-256 string; short `Copied` feedback. | Clipboard failure reveals/selects readable checksum and says `Select and copy the checksum.` | Enter/Space / tap; checksum remains selectable. |
| DL-10 | Victory result action `Download file` | Remains visible after the single automatic request so the user can initiate/retry the same artifact manually. | Explains `If your browser did not start it, download the file here.` No inferred save/completion status. | Normal link / tap; first result focus goes to heading, then this action. |
| DL-11 | Defeat panel `Retry fight` | Restarts this encounter with the same still-valid armed snapshot. A loss makes no file request. | Revalidates the environment-appropriate manifest's availability: public HTTPS in production or the scoped real ZIP in local proof. Invalid release returns to details for a fresh choice. | Enter/Space / tap. |
| DL-12 | Battle pause or defeat panel `Leave fight` | Disarms intent, returns safely to selected product details, and restores focus. | Leaving makes no download request; browser Back/navigation does the same cancellation. | Enter/Space / tap; shared pause owns entry to paused state. |
| DL-13 | `Back to downloads` | Returns from detail/unavailable view to index and its previous scroll. | Works with an empty catalog; no network dependency for route change. | Link; Enter / tap. |
| DL-14 | Victory panel `Play again` | Starts a practice replay with no armed transfer. The replay result offers a route back to file details. | Explicit text `Replay only` distinguishes it; no second transfer from the same intent. | Enter/Space / tap. |
| DL-15 | `Retry` in catalog/metadata error panel | Retries only the failed catalog or metadata fetch. | Busy while one retry is active; persistent errors remain visible without a retry loop. | Enter/Space / tap. |
| DL-16 | `File` artifact selector when multiple files share the selected version/platform | Selects one exact artifact such as installer or portable archive, showing type, filename and size; all subsequent actions bind its artifact ID. | With one artifact, show its identity as text. With multiple, require an explicit choice before arming/downloading; no silent default executable. Changes cancel old intent and clear stale validation. | Native/select-equivalent keyboard navigation / tap. |

**PROPOSED DEFAULT P-05:** DL-06 direct download is an authored accessibility/usability proposal, not an explicit user-confirmed instruction that the boss must be bypassable. Keep the fight as the prominent experience and allow the standard link for visitors who need it. Dex can revise this before implementation; go-ahead to the reviewed package accepts this default unless Dex excludes it. No separate confirmation is required solely for this routine design choice.

<a id="one-file-intent-state-machine"></a>
### One-file intent state machine

| State | Entry | Allowed next state / effect |
|---|---|---|
| Browsing | Catalog/detail entry | Selecting a valid release can lead to Armed only through DL-05; DL-06 performs a separate deliberate direct action. |
| Armed | DL-05 accepted with complete release snapshot and fresh local intent ID | Start Fighting. Arena setup failure or cancellation disarms and returns to Browsing/details with error and deliberate retry; no stranded intent. No executable fetch occurs at arming. |
| Fighting | Arena ready and controls active | Loss -> Defeated; victory -> Won; leave/navigate/refresh -> Canceled. |
| Defeated | Player fails encounter | DL-11 -> Fighting with same valid intent; DL-12 -> Canceled. No automatic retry or request. |
| Won | One authoritative boss defeat for this encounter | Revalidate snapshot availability, then consume intent once and attempt browser file request; show Result. |
| Result | Request attempted, blocked, or unavailable | DL-10 provides deliberate manual request; DL-14 replays without intent; details can create a new intent. |
| Canceled | Leave, route change, refresh, tab close, or explicit cancellation | No later callback may trigger a file request. Old victory/loading events are ignored. |

- **PROPOSED DEFAULT:** snapshot fields are immutable for the encounter: product ID, release ID, artifact ID, version, OS, architecture, filename, byte size, checksum, validated delivery URL, and environment scope. Production requires public HTTPS; only the separately validated development snapshot permits loopback HTTP. A new release cannot replace the selected file during a fight or carry a development URL into production.
- **PROPOSED DEFAULT:** the transfer intent exists only in current in-memory session state. Do not save it to localStorage, cookies, URL, service worker, background job, or server account. Refresh deliberately cancels it.
- **PROPOSED DEFAULT:** if arena setup cannot complete, clear the armed intent and enable a fresh DL-05 attempt or DL-06 direct action. A late arena-ready event from that failed attempt is ignored. This is distinct from Defeated, which retains the current valid intent for Retry fight.
- **PROPOSED DEFAULT:** a new selection cannot arm a second simultaneous encounter. Returning to details cancels the old intent before a replacement can be armed.
- **PROPOSED DEFAULT:** an encounter has no arbitrary deadline or forced background timer. Hiding the tab pauses combat and clears held input. Returning resumes into pause; it cannot cause an offscreen victory or transfer.
- **PROPOSED DEFAULT:** if a release is withdrawn, its integrity metadata changes, its URL expires, or availability cannot be checked at victory, display the result without requesting a different file. Offer `Back to downloads` and a fresh deliberate selection. Do not silently renew/retarget the snapshot.
- **PROPOSED DEFAULT:** a metadata network timeout ends that request and exposes Retry; it does not win, lose, or restart the fight. Proposed metadata timeout is 15 seconds, configurable in one place and subject to implementation verification.
- **PROPOSED DEFAULT:** consumed intent IDs and encounter result guards prevent repeated death/animation/render callbacks from issuing more requests. A manual DL-10 click is a new user action, not an automatic retry.
- **PROPOSED DEFAULT:** result copy is `Boss defeated` plus `Download requested` when a request was issued, or the concrete failure message otherwise. Never show `Downloaded`, `Installed`, a fabricated percentage, or the user's save path.
- **PROPOSED DEFAULT:** an incompatible current device receives a factual note such as `Windows file selected`. The user can still download a file for another machine through deliberate selection; device detection is not proof of intent.
- **PROPOSED DEFAULT:** if the world fails or a browser blocks a delayed request, preserve release detail and the ordinary DL-06/DL-10 link. Fight success is not proof that the browser saved anything.

<a id="4-documentation-physical-files-and-readable-pages"></a>
## 4. Documentation: physical files and readable pages

<a id="place-and-file-behavior"></a>
### Place and file behavior

**CONFIRMED:** documentation appears as physical files lying in the world.

**PROPOSED DEFAULT:** documentation occupies an archive zone with scattered folders, papers on desks, and sparse pools of light. Files have clear interaction boundaries; typography remains in the reader panel, not crammed into tiny world sprites. A file can sit in an accessible main route or optional corner without becoming the only path to its document.

**PROPOSED DEFAULT:** interacting with a file opens its exact document and may mark it locally as seen. It is a reading interaction, not an inventory requirement. The file stays in place and can be reopened; users cannot destroy documentation with the sword or lose it by leaving a room.

**PROPOSED DEFAULT:** all published documentation is available through the index before exploration. No boss, pickup counter, login, donation, character ability, or replay is a prerequisite. Optional discovered/seen state carries no content entitlement.

<a id="documentation-content-contract"></a>
### Documentation content contract

- **PROPOSED DEFAULT:** every document has stable project ID, slug, title, version ID, category, public/draft status, authored or reviewed date, body, heading IDs, and explicit related product/release IDs where applicable.
- **PROPOSED DEFAULT:** production indexes/rendering consume only the reviewed public export. Local proof uses that same sanitized edition before publication; missing bodies and draft placeholders are not success pages.
- **PROPOSED DEFAULT:** index categories begin with Installation, Usage, Troubleshooting, and Release notes, but appear only when content exists. These are filters inside Documentation, not new top-level tabs.
- **PROPOSED DEFAULT:** default search covers document titles, headings, and public body text; matching project/version filters apply consistently. Search consumes the sanitized export, with no private owner material, credentials, private paths, or unpublished unrelated projects. Explicitly public donation facts from [04](donation.md) are allowed and must not be mistaken for secret account material.
- **PROPOSED DEFAULT:** current-version status comes from authored metadata. The site does not guess that a lexicographically largest version is the recommended one.
- **PROPOSED DEFAULT:** documentation commands are selectable text; Copy copies code, not prompt decorations or invisible extra shell instructions. The website never executes a copied command.

<a id="initial-six-physical-file-destinations"></a>
### Initial six physical-file destinations

All rows are **PROPOSED DEFAULT**. Project ID is `dex-place`; the named source headings exist in the reviewed design documents. The export fixes these heading IDs explicitly so renderer-specific punctuation handling cannot break the links.

| Stable world file ID | Reader slug and heading ID | Existing source heading |
|---|---|---|
| `archive.file.controls.01` | `shell-and-system-controls#global-control-registry` | 05: Global control registry |
| `archive.file.movement.01` | `world-and-gameplay#5-player-movement-and-controls` | 02: 5. Player movement and controls |
| `archive.file.downloads.01` | `sections-and-controls#3-downloads-place-content-and-transfer` | 03: 3. Downloads: place, content, and transfer |
| `archive.file.illustrations.01` | `sections-and-controls#5-illustrations-exhibit-hall-and-full-artwork-viewer` | 03: 5. Illustrations: exhibit hall and full artwork viewer |
| `archive.file.donate.01` | `donation#amount-behavior` | 04: Amount behavior |
| `archive.file.accessibility.01` | `mobile-accessibility#5-assist-settings` | 06: 5. Assist settings |

Each row resolves to `/documentation/dex-place/<slug>?version=<export-version>#<heading-id>`. The complete index includes every exported chapter, including those without a prop; no collection/seen gate controls access. This is the initial placement-content mapping, not six new document-writing tasks.

<a id="documentation-control-registry"></a>
### Documentation control registry

Every ID below is **PROPOSED DEFAULT**.

| ID | Visual / label and trigger | Behavior | Loading, disabled, and error result | Keyboard / touch |
|---|---|---|---|---|
| DOC-01 | Physical folder/paper with nearby title prompt; Interact | Opens its exact document route and optional local seen marker. | Missing document opens unavailable panel with DOC-12; physical file is not consumed. | E / touch Interact; index has same document link. |
| DOC-02 | Archive index terminal / Documentation tab | Opens searchable `/documentation`. | Empty state `No documentation published yet`; fetch failure with DOC-13. | E / touch Interact; global tab equivalent. |
| DOC-03 | Search field `Search documentation` | Filters public docs; query is preserved on return from reader. | Shows results count or `No matching documents`; index loading is announced. | Typing and Enter / touch keyboard; game shortcuts disabled. |
| DOC-04 | Search `Clear` button | Clears query; keeps explicit project/category/version filters. | Hidden or disabled when query empty; no data fetch side effect beyond recomputing results. | Enter/Space / tap; returns focus to search. |
| DOC-05 | `Project` selector | Restricts index to one public project or `All projects`. | Nonexistent saved filter is cleared with explanation; never substitutes unrelated project content. | Keyboard select / touch picker. |
| DOC-06 | `Category` selector | Restricts index to published categories or `All categories`. | Empty filtered state offers change/clear; no phantom category pages. | Keyboard select / touch picker. |
| DOC-07 | Document result row with title, project, version | Opens reader and stores index scroll/query state. | Unavailable document retains title if known and offers DOC-12. | Focusable link; Enter / tap. |
| DOC-08 | Reader `Version` selector | Opens the same document in selected published version; maintains heading only if it exists. | If slug absent in chosen version, explain `This document is not available in that version`; do not display a different version as selected. | Keyboard select / touch picker. |
| DOC-09 | `Contents` disclosure and heading links | Shows section outline; selecting a heading updates URL hash and scrolls reader. | Omitted for documents without useful headings; missing pasted hash loads top with no fabricated section. | Disclosure button then links / tap; reduced motion uses immediate scroll. |
| DOC-10 | Heading `Copy link` button | Copies the absolute document/version/heading URL. | `Copied` status; clipboard error leaves selectable URL for manual copy. | Enter/Space / tap; exposed on focus as well as hover. |
| DOC-11 | Code block `Copy` button | Copies literal code content for that block only. | `Copied`; failure leaves code selectable and reports manual copy instruction. | Enter/Space / tap; no execution. |
| DOC-12 | `Back to documentation` | Returns to index with previous filters, query, and scroll. | Available even when current document fails; never requires completing a collectible. | Link; Enter / tap. |
| DOC-13 | `Retry` in index/reader error state | Repeats only failed public document/index request. | Busy while request in flight; preserves URL/version/query. | Enter/Space / tap. |
| DOC-14 | Authored related link `Get <product>` | Opens exact product/release detail, disarmed. | Render only for reviewed valid relationship; unavailable release says so on destination. | Normal link; Enter / tap. |

**DEFERRED:** accounts, comments, edit-in-browser, annotations, document uploads, community wiki, AI chat/search assistant, arbitrary PDF export, and a generic Copy everything button. Add them only through an explicit future scope change.

<a id="5-illustrations-exhibit-hall-and-full-artwork-viewer"></a>
## 5. Illustrations: exhibit hall and full artwork viewer

<a id="place-and-presentation"></a>
### Place and presentation

**CONFIRMED:** Illustrations is an exhibit hall. This is the only section permitted to display the existing artwork.

**PROPOSED DEFAULT:** the hall is quiet and spacious, with generous distance between exhibits, thin frames or recessed display surfaces, subdued environmental sound, and lighting that does not recolor the artwork itself. The environment is separately authored; the art is a displayed piece, never a texture source for the building.

The world composition follows02: one or two neutral bays in the establishing view, an immense ceiling/opening and broad quiet wall intervals. The gallery panel is the complete catalog and follows01's padding/type rules; it need not put all nine thumbnails above the fold. Keep artwork and aspect ratio prominent, with restrained factual captions. A world bay remains neutral outside the active Illustrations section.

The active physical Exhibition room now displays two registered illustration thumbnails in its existing bays: `gallery.bay.01` displays `towaki`, and `gallery.bay.02` retains `kaizen`. The first bay's former catalog-opening behavior is replaced by opening its displayed item; the Illustrations tab remains the complete catalog. Each display is an ordinary accessible DOM link whose bounds come from the actual frame aperture. It uses the existing illustration manifest, full-image contain framing and unchanged colors. No artwork enters a canvas, environment texture, light treatment, loading/Browse preview or poster export.

Mount a display only while the player is inside the physical Exhibition room, its aperture is visible, the world is ready and there is no loading presentation, Browse mode, menu or content overlay. Leaving that state unmounts its image and link; it does not preload other displays. A previously requested browser resource may finish after unmounting, but no new request is initiated outside the permitted state. E / Interact on a bay and Enter/click/tap on its display resolve through the same registered item and physical activation state. Close restores the physical world focus; a link taking keyboard focus pauses walking and leaves ordinary Tab navigation available. Failed thumbnails retain a factual `Image unavailable` display linked to the same viewer, never a replacement picture.

**PROPOSED DEFAULT:** each world exhibit opens the same viewer as its catalog tile. The first public gallery contains curated display exports, not raw project/source files. Full image framing is retained; thumbnails use contain/letterboxing by default to avoid silently cutting off characters or signatures.

**PROPOSED DEFAULT:** catalog order is a stable reviewed `sortOrder`. It is not generated from file modification dates or randomly changed between visits. Until Dex's descriptions are written, display known filenames/titles and the neutral status `Description pending` in planning metadata; do not publish an invented description.

<a id="source-inventory-verified-2026-09-06"></a>
### Source inventory verified 2026-09-06

These are filesystem findings, not approval to publish every image. Source directory: `private illustration export library`. **PROPOSED DEFAULT:** the first local-only gallery uses exactly these nine items with basename titles and the minimum factual alt texts below, derived from actual image inspection. Detailed captions/story/date authoring remains deferred; public metadata/publication review is a release gate, not a blocker for the shell/game or local gallery.

| Stable proposed artwork ID | Verified source file | Known context / editorial state |
|---|---|---|
| `shot-18-2` | `shot_18-2.png` | Description pending; title and publication review pending. |
| `shot-23` | `shot_23.png` | Description pending; title and publication review pending. |
| `inshot-20260620-071233415` | `InShot_20260620_071233415.jpg` | Description pending; title and publication review pending. |
| `inshot-20260826-123444237` | `InShot_20260826_123444237.jpg` | Description pending; title and publication review pending. |
| `inshot-20260721-200821729` | `InShot_20260721_200821729.jpg` | Description pending; title and publication review pending. |
| `inshot-20260708-060051952` | `InShot_20260708_060051952.jpg` | Description pending; title and publication review pending. |
| `inshot-20260708-055457338` | `InShot_20260708_055457338.jpg` | Description pending; title and publication review pending. |
| `kaizen` | `KAIZEN.png` | Confirmed: Kaizen is the main character of Convergence, Dex's story series. Description/story publishing deferred. |
| `towaki` | `TOWAKI.png` | Description pending; do not infer relationship or story role. |

| Local basename title | Minimum factual local alt text |
|---|---|
| `shot_18-2` | Black-haired figure in a suit surrounded by sweeping black ink marks. |
| `shot_23` | Smiling red-haired character with closed eyes, black ribbons and sketch-like fading edges. |
| `InShot_20260620_071233415` | Close-up of a red-haired, golden-eyed character against a pale blue sky with red and black graphic marks. |
| `InShot_20260826_123444237` | Red-and-white-haired hooded character crouching in a glowing red scene. |
| `InShot_20260721_200821729` | Ensemble character poster with red, black and white graphics and VNMC 4K 2026 CONVERGENCE text. |
| `InShot_20260708_060051952` | Character in a split black-and-white coat beneath a large black brushstroke. |
| `InShot_20260708_055457338` | Black-haired character in a long dark coat and red tie with cyan graphic strokes. |
| `KAIZEN` | Red-and-white-haired character standing in a dark hoodie and loose trousers against a peach background. |
| `TOWAKI` | Lilac-haired character in a white dress carrying an oversized gun and hammer against a vivid pink background. |

`KAIZEN.psd` also exists beside these exports. It is an authoring source, not an additional gallery item or a downloadable public file. This inventory does not authorize any source file move, asset conversion, upload, regeneration, or legacy animation reuse.

<a id="illustration-content-contract"></a>
### Illustration content contract

- **PROPOSED DEFAULT:** each published item has immutable artwork ID, approved title, truthful alt text, approved display export(s), intrinsic width/height, stable sort order, and explicit publication state.
- **PROPOSED DEFAULT:** description, year, medium, series, and process assets are optional authored fields. Absence means omitted, not guessed. A missing description cannot be replaced with generated lore.
- **OPEN for public release:** review the local basename titles and factual alt texts for publication, and prepare any later detailed captions separately. `Description pending` remains private editorial metadata, not rendered alt text. This public review does not block the defined local nine-image gallery.
- **PROPOSED DEFAULT:** public exports have web URLs and explicit dimensions. Local paths, PSD/CLIP sources, user folder names, and editing metadata remain out of public manifests.
- **PROPOSED DEFAULT:** request visible thumbnails at at most 512 px on the longest edge; opening a piece loads its display export at at most 2,048 px on the longest edge, preserving aspect ratio without upscaling. Retain only the current plus at most one adjacent large image, within the 32 MiB decoded budget in [07](content-runtime-and-hosting.md); never preload originals or authoring files.
- **PROPOSED DEFAULT:** a failed image keeps its title and error message visible. Missing artwork must not show unrelated fallback art or a synthetic recreation.

<a id="illustrations-control-registry"></a>
### Illustrations control registry

Every ID below is **PROPOSED DEFAULT**.

| ID | Visual / label and trigger | Behavior | Loading, disabled, and error result | Keyboard / touch |
|---|---|---|---|---|
| ART-01 | World exhibit frame with title; Interact | Opens `/illustrations/:artworkId`. | Unavailable art opens truthful unavailable panel and ART-04. | E / touch Interact; gallery tile equivalent. |
| ART-02 | Gallery entrance index / Illustrations tab | Opens `/illustrations` with curated thumbnail grid. | Empty state `No illustrations published yet`; catalog load error exposes ART-10. | E / touch Interact; global tab equivalent. |
| ART-03 | Thumbnail tile with title | Opens artwork viewer; stores gallery scroll and opener. | Image failure retains title and open action so reader can inspect error/details. | Link; Enter / tap. |
| ART-04 | `Back to illustrations` | Leaves viewer for gallery at preserved scroll; restores tile focus when possible. | Available during image load/error. | Link; Enter / tap; Escape follows shared local-close policy. |
| ART-05 | `Previous illustration` arrow button | Opens previous published item in stable order; resets fit/zoom for the next image. | Disabled at first item; no wraparound surprise. | Enter/Space; Left arrow when viewer itself focused / tap. |
| ART-06 | `Next illustration` arrow button | Opens next published item in stable order; resets fit/zoom. | Disabled at last item; loading keeps selected title accurate. | Enter/Space; Right arrow when viewer itself focused / tap. |
| ART-07 | `Zoom in` | Increases viewer image scale by 25 percentage points, from fit (100%) up to 400% of fit; shows percentage and clamps pan to image bounds. | Disabled at 400% or while image unavailable. | Enter/Space / tap; pinch optional, never required. |
| ART-08 | `Fit image` | Restores full contained artwork and centered pan. | Disabled if image unavailable; idempotent at fit. | Enter/Space / tap; available after any zoom/pan. |
| ART-09 | `Full screen` / `Exit full screen` | Requests supported browser fullscreen for artwork viewer; label reflects actual state. | Unsupported/denied fullscreen leaves normal viewer usable; no false fullscreen indicator. | Enter/Space / tap; native Escape supported without trapping user. |
| ART-10 | `Retry image` or catalog `Retry` | Retries the failed item/catalog only. | Busy during one request; preserves selected piece and does not skip it. | Enter/Space / tap. |
| ART-11 | Zoomed image pan surface | Moves view within artwork bounds, never scrolls or moves the game. | Active only above fit; reset via ART-08. | Arrow keys when pan surface focused / drag; visible zoom controls remain reachable. |
| ART-12 | `Zoom out` | Decreases viewer scale by 25 percentage points down to fit (100%); paired visually with ART-07. | Disabled at fit or while image unavailable. | Enter/Space / tap; preserves artwork in bounds. |

**PROPOSED DEFAULT:** arrow keys navigate pieces only in fit view with the viewer navigation context focused. In zoom/pan focus they pan; fields, other controls, and assistive-technology navigation are not intercepted. Touch swipe-to-change artwork is **DEFERRED** to prevent conflict with panning and browser gestures.

**DEFERRED:** favorite/like counts, social sharing buttons, public comments, original-file downloads, prints/shop, paid gallery locks, commissions, automated art generation, soundtrack attached to individual art, and animated rigging of existing pieces. These are not implied by portfolio or exhibit hall.

<a id="6-acceptance-scenarios-and-drift-guard"></a>
## 6. Acceptance scenarios and drift guard

All scenarios below are **PROPOSED DEFAULT** implementation acceptance criteria. Passing documentation review is not the same as passing runtime behavior.

| Scenario | Required observable result |
|---|---|
| Direct section/detail URL and refresh | Correct selected section/content, readable without game progress; no armed download or held game input. |
| Browser Back after document/art opening | Previous route, selection, scroll, and keyboard focus return coherently. |
| Keyboard-only visitor | Can access sections, select a release, use proposed direct download, read/copy docs, inspect art, and close panels without platforming. |
| Touch portrait visitor | Full content usable, controls visible above safe areas, no text selection causing slash/jump, no hover-only action. |
| Fight victorious once | Exactly one automatic request attempt for the explicit immutable file; result never claims saved or installed. |
| Defeat, repeated victory callbacks, or replay | Defeat produces no transfer; duplicate callbacks do not transfer again; unarmed replay produces none. |
| Leave/Back/refresh while fighting | Intent canceled; late callbacks cannot request a file. |
| Release updated or withdrawn midfight | No substituted artifact; precise unavailable result and path back to selection. |
| Missing artifact or unsupported browser world renderer | Real file availability remains truthful; proposed standard download route and DOM sections remain usable. |
| Documentation file never found in world | Index still opens its published contents; no collectible gate or missing permission. |
| Empty search, missing version, and missing heading | Clear states; no fabricated document or silent version substitution. |
| Clipboard denied | Checksum, code, or link remains selectable; error does not claim copy succeeded. |
| Art image broken or fullscreen denied | Accurate title/error and exit route remain; no unrelated fallback image or trapped fullscreen state. |
| Gallery metadata incomplete | The defined local nine-item baseline uses basename titles and factual alt; unreviewed pieces remain unpublished in production, with no invented lore/date or blocked shell/game work. |
| Asset reference audit | Existing user artwork appears only as approved Illustrations display content, with no world/UI/prompt reuse. |

Before changing a control, update its stable ID row, state transitions, URL effects, accessibility behavior, and relevant acceptance case. If a proposed feature cannot be found here or in a companion specification, it is outside the documented scope until recorded and reviewed.
