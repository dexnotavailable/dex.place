# Shell, navigation, and system controls

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. The complete scrolling website, restrained game chrome, explicit intro sound/focus handoff and NX controls replace the viewport-only shell and implicit teleporting tab behavior. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

All exact layouts, controls and timings here are PROPOSED DEFAULT except the four section labels and Daniel wordmark. Section-specific controls belong to [03](03-sections-and-controls.md) and [04](04-donation.md); this document owns global behavior.

## Entry and page structure

The URL loads useful navigation and readable section content before the world finishes loading. Home `/` shows the Daniel `dex` wordmark, four section links, Sound off, Menu, and the world. No required splash screen, video, provider account, or full-screen tutorial stands between arrival and the site.

[17](17-arrival-and-first-impression.md) owns the designed world loading state and interruptible causeway reveal. The shell stays available over its signal/horizon composition. This is the home world presentation, not an additional entrance screen; navigation and deliberate gameplay focus never wait for a decorative transition.

Initial focus stays in ordinary document order. The world does not capture movement keys until the visitor deliberately clicks/taps its play surface or activates its focusable Enter world control. The focus state and keyboard instructions are visible; Tab always exits to the next normal control.

The in-range action hint follows the selected physical object's live screen anchor. Place it above that object with a small gap and clamp its measured DOM rectangle inside the world viewport; long labels wrap rather than overflow. Its key/verb and label remain ordinary readable text. The hint is informational, separate from the keyboard legend and mobile action buttons, and does not create another focus target. Hide it when there is no eligible target, gameplay loses focus, a panel/menu opens, or the world is unavailable. Camera/resize changes update position without repeatedly announcing an unchanged label. Moving or cutting an object updates the same target/state owner used by E and slash.

Desktop shell: wordmark at upper left; primary navigation across the upper edge; small audio/menu controls at upper right. Preserve scene sightlines and keep the footer out of the moving viewport. Compact shell: wordmark plus audio/menu at top and all four section names in a fixed navigation strip within safe-area bounds. The mobile document owns breakpoints and touch geometry.

[01](01-art-direction-and-audio.md) owns default type and spacing: modest Daniel mark, 14 px navigation, readable 16 px body/fields and 20–24 px section titles. The world fills the available width rather than living in a centered content card. Keep the header quiet and the skyline free of giant duplicate titles. A tab row is used only when all full labels, gaps and touch hit areas fit; otherwise the same four links reflow to a 2×2 grid in reading order. [06](06-mobile-accessibility.md) owns narrow/enlarged-text behavior. Never hide a tab or shrink its text to preserve one row.

The wordmark links home; it is not a fifth named tab. Menu contains settings/help/return-to-world actions, not extra primary destinations or a second catalog. No hidden marketing menu or hover-only navigation.

## Routes and history

| URL | Primary content | World position on direct entry |
|---|---|---|
| `/` | Arrival / playable world | Causeway safe anchor |
| `/downloads` | Downloads index | Dispatch safe anchor |
| `/downloads/:productId` | Product and release details | Dispatch safe anchor |
| `/documentation` | Documentation index | Archive safe anchor |
| `/documentation/:projectId/:docSlug` | Article; optional section fragment | Archive safe anchor |
| `/illustrations` | Gallery index | Exhibition safe anchor |
| `/illustrations/:artworkId` | Selected illustration | Exhibition safe anchor |
| `/donate` | Donation method panel | Support safe anchor |

Section links are real links with meaningful URLs, usable without controlling the character. Clicking a section changes history once, opens its panel immediately, and moves the paused world to its safe anchor. The optional scene transition does not delay content, intercept a second intent, or issue a second history entry. A later navigation wins over an earlier unfinished transition.

An encounter is an in-memory submode of `/downloads/:productId?release=<releaseId>&artifact=<artifactId>`. Starting it hides the details panel and retains that exact address, without adding a fight URL/history entry. Refresh shows the selected details disarmed. Any primary-tab activation, including Downloads while an encounter is active, cancels intent before opening the tab's index; cancellation happens even when route-family equality would otherwise skip navigation. Menu/Settings/Controls pause and retain the submode and URL; their Back/Resume actions do not cancel it.

Close and Back are deliberately different:

- Browser Back follows actual navigation history, including article/gallery selections. It never silently rewrites history to force a particular route.
- Closing a section overlay entered through a physical world prop restores that prop's recorded safe source position (`entryMode=world-prop`). A section entered through a tab uses the destination's safe anchor (`entryMode=navigation`). A direct external/deep-link entry replaces the overlay with `/` while retaining its safe destination anchor. These Close paths stay within dex.place and resume the world at the defined location; they never navigate to an external site.
- Closing a gallery item returns to its gallery index and selection. Closing an article returns to its index only when the control explicitly says Back to documentation; ordinary browser Back honors history.
- Opening a section from a physical prop sets its actual route, so refreshing or sharing the address is meaningful. No collectible state is necessary to resolve it.
- Reopening an ordinary active section focuses/reveals its current panel without duplicating history or resetting content. The active-encounter exception above cancels the fight and opens the chosen primary tab index, including Downloads.
- An unknown path, product, document or artwork renders a real Not found message with available navigation. Never silently open the first item instead.

Legacy route migration is owned by [07](07-content-runtime-and-hosting.md). No existing raw file URL may accidentally become a product detail route.

## Global control registry

Every button below has a visible keyboard focus state, Enter/Space activation when appropriate, and a touch equivalent. Links retain normal link semantics. Disabled controls expose the reason. Control feedback never requires hovering.

| ID | Label / appearance | Trigger and exact result | Loading, error, focus, and persistence |
|---|---|---|---|
| SYS-01 | `dex` Daniel wordmark | Link to `/`; leave/cancel encounter intent, close section, place player safely at arrival. | Always available; no network dependency for local navigation. Label for assistive tech: `dex home`. |
| SYS-02 | `Downloads` | Open `/downloads` immediately; cancel any encounter, including this Downloads encounter, and travel to Dispatch anchor. | Active state identifies current section; loading affects catalog only, not navigation. |
| SYS-03 | `Documentation` | Open `/documentation` and Archive anchor. | Same navigation semantics; no document pickup required. |
| SYS-04 | `Illustrations` | Open `/illustrations` and Exhibition anchor. | Only this route family may load/display personal art. |
| SYS-05 | `Donate` | Open `/donate` and Support anchor. | Does not select a method, generate a QR, or start a transfer. |
| SYS-06 | `Enter world` focusable play surface / small focus prompt | Give gameplay focus; show current input hint. | Disabled with explanation until world ready; navigation remains usable. Doesn't enable sound. |
| SYS-07 | `Sound off` / `Sound on` speaker button | Explicitly enable/resume audio or mute all buses. | If playback is denied, stay off and announce `Sound could not start. Try again.` Never auto-retry audibly. Preference may be remembered. |
| SYS-08 | `Menu` | Pause world, clear held input, open menu and focus its heading; retain an active encounter and exact selected Downloads URL. | Works during loading and encounters; button stays reachable. |
| SYS-09 | `Resume` | Close pause/menu/help back to the same safe gameplay state. | No automatic resume on tab refocus; gameplay focus is deliberately restored. Disabled when world unavailable, with Browse site alternative. |
| SYS-10 | `Settings` | Open settings inside menu; simulation stays paused. | Back returns to menu, not world. |
| SYS-11 | `Controls` | Show current keyboard/touch bindings, interaction examples and accessibility alternatives. | Text is readable, not drawn only into canvas; close/back restores menu. |
| SYS-12 | `Browse site` / `Return to world` | Switch between content-first DOM access with a neutral static architecture background and the interactive world. | Does not add a fifth destination. Retains route and content; cancels combat intent when disabling world. Art still limited to Illustrations. Preference remembered. |
| SYS-13 | `Restart world` | Open the bounded world-reset confirmation. | Does not immediately reset; disabled while a reset is already applying. |
| SYS-14 | `Restart` in reset dialog | Cancel encounter intent; restore cut objects, lifts and player at arrival, close dialog. | Does not delete preferences, documentation/art files, packages, browser downloads, or donation data. No file request can survive. |
| SYS-15 | `Cancel` in reset dialog | Keep current world and return focus to Restart world. | Escape also cancels; no changes. |
| SYS-16 | `Back` in settings/controls submenu | Return to menu, restore opener focus. | Does not resume combat or exit the site. |
| SYS-17 | `Master volume` slider | Set normalized master gain 0–100 in steps of 5. | Does not bypass explicit mute or activate audio by itself. Remembers value if storage works. |
| SYS-18 | `Music volume` slider | Set music bus 0–100 in steps of 5. | Live preview only if audio already on; no sample autoplay. |
| SYS-19 | `Effects volume` slider | Set effects bus 0–100 in steps of 5. | Same audio rule; no attack triggered by setting change. |
| SYS-20 | `Ambience volume` slider | Set ambience bus 0–100 in steps of 5. | Same audio rule. |
| SYS-21 | `Motion` select: System / Reduced / Full | Set decorative motion policy. System follows browser preference; Reduced removes parallax, shake and sweeping transitions. | Applies immediately to current scene; current route/focus persists. Never changes collision physics. Default System. |
| SYS-22 | `Camera shake` toggle | Allow/disallow impact shake. | Defaults off; unavailable while Reduced motion active, with explanation. Enabling doesn't trigger a demo shake. |
| SYS-23 | `Quality` select: Auto / Low / High | Choose rendering tier; Low removes expensive reflections/particles. | Default Auto. Changing quality preserves gameplay/collision; if initialization fails, revert to last working tier and show status. |
| SYS-24 | `Reset settings` | Open preference-reset confirmation. | No immediate reset. Separate from Restart world. |
| SYS-25 | `Reset` in settings-reset dialog | Restore settings defaults, mute audio, keep current content and world state. | Current menu remains open; no external requests. Storage failure uses session defaults. |
| SYS-26 | `Cancel` in settings-reset dialog | Return to settings without changes. | Focus returns to Reset settings. |
| SYS-27 | `Try loading world again` | Retry failed scene/renderer initialization once. | Busy until completed; cancels older pending initialization. Never repeatedly reloads page or interferes with working content. |
| SYS-28 | `Skip to content` keyboard link | Move focus to current section main content, or four-link index on home. | Visible on focus; bypasses canvas and header repetition. |
| SYS-29 | `Back home` on Not found | Link to `/` without changing or requesting any package. | Works even when resource content is unavailable. |
| SYS-30 | `Dismiss` on noncritical persistent status | Clear only that status. | Never hides required field errors, download fallback actions or unknown payment state. |
| SYS-31 | `Combat assistance` toggle | Apply the slower telegraphs/recovery and invulnerability contract in [06](06-mobile-accessibility.md). | Default off; expose before encounter entry as well as in settings when encounters are configured. During the deferred encounter stage, hide this control in both places while retaining any saved preference. Changes neither file identity nor download intent. A change during a paused active encounter restarts its current pattern at waiting, preserving health and selection, so Resume cannot expose an already-expired telegraph. |
| SYS-32 | `Hold to slash` toggle | Holding the slash action repeats attacks at the normal cooldown. | Default off; releasing/canceling input stops repetition. Does not repeat downloads, interaction, or payment actions. |
| SYS-33 | `Touch scale` select: Small / Medium / Large | Set touch control hit areas to starting targets 48 / 56 / 64 CSS px, reflowing within safe areas. | Default Medium; preview in settings is inert. A cramped layout reflows or uses content mode rather than shrinking below minimum. |
| SYS-34 | `Left-handed controls` toggle | Mirror movement/action cluster placement for touch. | Default off; label and preview update; no changes to keyboard direction or content layout. |
| SYS-35 | `Close section` icon/button, accessible name `Close <section>` | Dismiss the Downloads, Documentation, or Illustrations section to its safe world location using the Close/history policy above. | Remains reachable during load/error. Focus returns to opener or active section link. Donate uses DON-002; an artwork's Back to illustrations is ART-04 and does not close the whole section. |

SYS-35 is the shared section-close control; DON-002 is its donation-specific contract. The world Menu control is also the touch pause control (accessible name `Menu, pause game`), not a second unregistered button. Browser-native Save, Share, permission prompts, and external Ko-fi controls remain browser/provider-owned; the site must not impersonate them.

## State and focus rules

| State | Game input | Animation/audio | Available site behavior |
|---|---|---|---|
| Shell/world loading | Off | Static architectural signal/horizon frame per17; silent until explicit Sound opt-in, audio independent of world readiness | Four links, loading state, accessible content placeholders |
| World ready, unfocused | Off | Slow ambience if opted in | Normal document navigation |
| Exploring, focused | On | Gameplay and appropriate audio | Four links and menu remain reachable |
| Section panel open | Off, held inputs cleared | Simulation paused; quiet section audio if on | Full readable section controls |
| Encounter active | On | Arena mix, readable telegraphs; Downloads details hidden, exact selected URL retained | Menu/settings pause and retain; any primary tab or leave action cancels |
| Menu/settings open | Off | Simulation paused, audio gently paused/quieted | Menu and settings |
| Hidden/unfocused page | Off | Simulation and media paused | Browser behavior; returning shows paused state |
| Text/content mode | Off | Static neutral architectural frame; optional quiet audio | Complete content navigation and direct download |
| Renderer lost/failed | Off | Static fallback, audio quieted | Complete DOM site and retry-world action |

Opening panels clears active pointer captures for gameplay and all held keys. Context menus, browser zoom, selection, text entry, scrolling, clipboard selection and pinch gestures inside DOM panels behave normally. No global preventDefault handler consumes typing or browser shortcuts.

Modal panels trap focus only while modal. Their accessible name is the section title. Initial focus is the heading or appropriate first meaningful field, not a destructive action. Closing restores the opener when it still exists; otherwise use the active section link. Focus must never return to an unloaded object or invisible canvas item.

Escape closes the topmost dismissible layer only. It does not combine a menu close with an unintended slash, leave encounter and start a new download, or exit multiple routes at once. Browser-owned dialogs take precedence. No focus is forcibly reclaimed while another app or tab is active.

In the gallery, browser-native fullscreen exits first; a subsequent Escape leaves the item viewer through ART-04; another Escape on the gallery index invokes SYS-35. An explicit Close section control always closes the whole section. A document's Back to documentation is a separate local navigation action; Escape closes its section. Donation Close is DON-002.

## Loading and failure design

- World assets may stream by region; readable content and navigation have priority. Show textual loading state without invented progress percentages.
- Home loading uses17's actual pending/ready/slow/failed states and concise polite announcements. After8 seconds explain that the tabs work; a known failure or30-second critical-load deadline ends that initialization attempt and exposes SYS-27. No focus change, fake progress, automatic retry or stale completion may override a later route.
- A failed art item shows its own retry/placeholder; it does not replace every illustration with stock/generated art.
- A failed document shows its title and load failure, with index/back/retry controls. Do not silently show an older unrelated version.
- If the package origin is offline, keep descriptive metadata where safely cached and mark unavailable. Never present a successful transfer state.
- QR failure retains accurate selectable bank details, with the QR-specific retry from [04](04-donation.md).
- Storage denial is nonfatal. Preferences work for the current page, and there is no repeated permission request.
- A crash/reload never replays a download intent, bank QR generation, external navigation, or reset confirmation.
- A critical resource error is persistent until resolved or left; transient copy status clears without moving focus.
- The shell remains responsive to a newer navigation intent during every animation/loading state.

## Preference and session inventory

Proposed persistent preferences: sound permission choice, audio levels, motion override, quality tier, camera-shake preference, content-first mode, combat assistance, hold-to-slash, touch scale and handedness. Storage key and schema are versioned; local reset affects only the site preferences.

Proposed current-page-only state: route-derived selection, panel scroll, safe player anchor, cut objects, seen-document markers if used, current artwork zoom, committed donation amount, QR revision, current encounter and transfer intent. The URL owns addressable content; storage never overrides an explicit deep link.

No persistent donation amount, bank activity, supporter identity, transfer intent, browser download completion, release entitlement, or inferred consent is stored. Third-party providers receive only data necessary for the user's explicit action.
