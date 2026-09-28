<a id="mobile-input-and-accessibility-specification"></a>
# Mobile, input, and accessibility specification

<a id="source-21-implementation-precedence"></a>
## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](inhabited-world-and-experience.md) and [22](dex-account-treasury-and-social-presence.md) first. Add native scroll/game handoff, mobile left-click-equivalent attack and proximity PTT, ghost presence, voice interruption and account forms. Preserve accessible direct access and real-device proof. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

This is a documentation-only baseline. **CONFIRMED** records Dex's explicit direction; **PROPOSED DEFAULT** identifies reviewable design choices; **OPEN** identifies missing facts. All unmarked details below are **PROPOSED DEFAULT** and require the later go-ahead before implementation.

<a id="1-confirmed-experience-and-default-approach"></a>
## 1. Confirmed experience and default approach

- **CONFIRMED:** Mobile must feel good. A different mobile variant is possible if needed; Dex has not required a separate map.
- **CONFIRMED:** Dex's primary devices are Android using Samsung Internet and an iPad. Safari is the stated default on iPad, to be checked against the actual device. Every integrated build revision receives the supported mobile regression pass in [15](after-go-workflow.md).
- **CONFIRMED:** Preserve the pixel platformer, sword interactions, four sections, and cinematic liminal atmosphere.
- **PROPOSED DEFAULT:** Share the map, content, collisions, and encounter rules with desktop; adapt camera, touch controls, layout, and assistance.
- Do not build a second independently maintained mobile game unless actual testing demonstrates that the shared-map approach fails.
- Every visitor can use the whole website through ordinary controls with the game paused or disabled.
- No essential content, donation method, or download is conditional on precise input, reaction time, audio, or a particular orientation.

<a id="2-responsive-presentation"></a>
## 2. Responsive presentation

| Surface | Default presentation | Play framing |
| --- | --- | --- |
| Wide desktop, at least 1,024 CSS px | Compact persistent top navigation; world fills available viewport; section content uses readable panels. | Wide view with player below center and enough look-ahead for jumps. |
| Tablet/narrow desktop, 768–1,023 CSS px | Same four section labels remain visible; panels can use more viewport width. | Camera adapts to actual viewport, never crops by stretching the desktop scene. |
| Phone portrait, below 768 CSS px | Identity row with lowercase dex/home, Sound and Menu, followed by all four named sections. One tab row only when measured fit allows; otherwise a 2×2 grid. Content opens full screen below the actual shell. | World uses the remaining area; safe platforms and landing targets remain visible, with an enormous structural edge/opening continuing beyond the portrait frame. |
| Phone landscape | Slim shell; section panel can cover world; no demand to rotate. | Touch movement at lower left, actions at lower right, combat information clear above controls. |

- Support a 320 CSS px-wide content viewport without horizontal document scrolling; tables/code may have their own labeled overflow region.
- Never shrink body text or touch targets to fit every desktop widget on a phone.
- Start with the 2×2 tab grid below 480 CSS px; at larger widths use one row only if the actual full labels, at least 48 px-high touch areas and 8 px separation fit at the visitor's text settings. Grid reading order stays Downloads, Documentation, Illustrations, Donate. If enlarged text needs still more room, allow taller rows or a single-column stack; no label truncation or horizontal page scroll. This is reflow of SYS-02–05, not new navigation.
- Use01's modest default type and spacing, with 16 px body/fields and readable 14 px navigation/secondary labels. Labels may wrap, and the shell's measured height determines the remaining world area. Never place content underneath a tab row whose height was assumed rather than measured.
- Render pixel art with a consistent nearest-neighbor treatment and stable camera sampling; UI text uses crisp normal text rendering.
- Cinematic composition adapts by repositioning decorative framing and adjusting camera distance, not by hiding navigation.
- Preserve01's small-traveler/immense-place feeling even when readability floors make the portrait or short-landscape player ratio larger. Compose the actual view using height, distance, broad forms and quiet regions as appropriate; no identical structure/reference recipe or fixed percentage is required for every viewport. The visible game plane can be compact without becoming a dollhouse room. Low quality and reduced motion retain the chosen scale relationships.
- On unusually short landscape screens, display a smaller world preview with normal section access and the shared `Enter world` control SYS-06; gameplay must not begin behind obstructing controls.
- Respect device safe areas and browser controls; fixed navigation and touch buttons cannot sit under a notch or home gesture area.
- Browser zoom and dynamic text size remain enabled.
- Orientation change pauses gameplay, recomputes the view, clears held touches, and requires Resume. It does not restart a fight or trigger a download.

<a id="3-touch-control-inventory"></a>
## 3. Touch control inventory

| Control | Placement and label | Behavior |
| --- | --- | --- |
| Left | Lower left, arrow plus accessible `Move left`. | Hold to move left; stop immediately on release/cancel. |
| Right | Next to Left, arrow plus accessible `Move right`. | Hold to move right; stop immediately on release/cancel. |
| Jump | Lower right, prominent `Jump` button. | Tap/hold matches desktop jump height; release and tap again for one additional air jump. Holding never repeats it. |
| Slash | Right action cluster, prominent `Slash` button with blade symbol. | One slash per tap; optional hold-to-repeat assistance. |
| Dash | Above/inside the action cluster, `Dash`. | Dash once; visible cooldown feedback must not depend on color alone. |
| Interact | Near action cluster only when a target is in reach, with target-specific verb. | Open exactly the labeled document/terminal/gallery/support target. |
| Menu / pause | Stable top corner, accessible `Menu, pause game`; shared SYS-08. | Pause immediately and expose normal settings/navigation controls. |

- Main touch controls have at least 48 by 48 CSS px hit areas, preferably 56–64 px for Jump and Slash, and at least 8 px clear separation.
- Buttons appear only during gameplay. They disappear or become inert when a section panel, dialog, system interruption, or browser overlay owns focus.
- Buttons use visible pressed states. Pointer cancellation and moving the finger away cannot leave a movement direction stuck.
- Support simultaneous movement plus Jump, Slash, or Dash. Multi-touch is bounded to the game controls, not globally hijacked.
- Swiping, pinching, scrolling, and text selection remain normal outside the game surface.
- Do not require swipe attacks, rapid repeated taps, invisible gestures, or holding a button while dragging another control.
- Interact changes label only when the eligible target changes; avoid a tiny floating button chasing the character.
- Offer control size Small/Medium/Large, default Medium, and a left-handed action-layout toggle in Controls/settings.
- Settings changes immediately show a harmless control preview; they cannot start an encounter or leave the current section.
- Portrait traversal includes automatic small step-ups for ledges up to one tile, forgiving edges, and the same buffered/coyote jump rules as desktop.
- A DOM landmark list permits immediate travel to any of the four sections; it does not demand tap-to-pathfind across ambiguous pixel scenery.

<a id="4-keyboard-and-alternative-input"></a>
## 4. Keyboard and alternative input

- The shell, file catalog, documentation, gallery, donation choices, settings, and error recovery are fully usable with Tab, Shift+Tab, Enter, Space, and Escape as appropriate to each control.
- A skip link reaches main content. A second visible option starts/returns to the game when it is available.
- Game keyboard capture starts only after deliberate `Enter world`/focus entry through SYS-06. Arrow keys and Space retain normal page behavior elsewhere.
- Tab exits gameplay capture into the normal shell; the canvas is never a keyboard trap.
- Default gameplay bindings: A/D or arrows, Space jump, Shift dash, J slash, E interact, Escape pause.
- Controls/settings shows the fixed initial bindings with text labels. A keybinding editor is deferred; reserved browser/system shortcuts are not suppressed.
- Losing focus clears all held keys. Regaining focus shows Resume rather than firing a buffered slash or dash.
- Gamepads are deferred; do not display gamepad prompts or claim support before a tested implementation exists.
- Switch control, voice control, and other tools operating standard DOM controls retain access to all essential website actions through the direct interfaces.

<a id="5-assist-settings"></a>
## 5. Assist settings

| Setting | Default | Contract |
| --- | --- | --- |
| Browse site / Return to world (SYS-12) | World available; deliberate Enter world captures game input. | Browse site disables the world simulation and uses static neutral architecture; every route and useful action remains available. Return to world restores the interactive presentation. |
| Motion | System; alternatives Reduced and Full. | Reduced uses immediate travel transitions, no shake, no parallax/ambient drift, no zoom sweeps, and restrained local attack feedback. |
| Hold to slash | Off. | Holding Slash repeats at the normal cooldown; no extra damage advantage or forced rapid tapping. |
| Combat assistance | Off, easy to discover before a fight. | Multiply telegraph and exposed recovery durations by 1.5 and make the player invulnerable; selected file and download semantics remain identical. |
| Sound and audio buses | Silent until intentional Sound activation. | Shared master, music, effects, and ambience sliders follow [01-art-direction-and-audio.md](art-direction-and-audio.md); every meaningful cue also has a visual equivalent. |
| Touch scale | Medium. | Changes hit areas/layout within safe screen bounds; it cannot obscure essential encounter information. |

- High visibility cues are always part of the visual design, not a separately discoverable setting: shapes, outlines, text, and stable contrast reinforce targets and telegraphs.
- **PROPOSED DEFAULT:** The secondary `Download file` link remains available beside `Fight & download`; combat assistance does not replace that alternative.
- The boss failure panel keeps `Retry fight` and `Leave fight` easy to reach; leaving restores product details with the secondary `Download file` route, without an additional failure loop.
- No settings choice changes the visitor's file version, restricts content, or labels them as less skilled.
- Local settings storage failing must not prevent use. Do not add an account to save accessibility preferences.

<a id="6-readable-content-and-assistive-technology"></a>
## 6. Readable content and assistive technology

- The DOM shell is the semantic website. Section headings, lists, download controls, document text, artwork metadata, and donation fields remain real content outside the canvas.
- The decorative/game canvas is labeled as an optional interactive world and does not create hundreds of meaningless screen-reader nodes.
- A screen-reader visitor can open every section and complete every meaningful action without locating a pixel prop or playing combat.
- Focus order follows visual reading order. Opening a panel moves focus to its heading or appropriate initial control; closing it restores focus to the invoking control.
- If navigation destroyed the invoking control, return focus to the active section heading or stable navigation item instead of the document body.
- Visible focus is unmistakable against both light shells and world imagery; hover effects never provide the only cue.
- Buttons have verb-based accessible names. Icon-only music, pause, close, arrows, and copy controls have explicit labels.
- Selected tabs expose current-page state. Status announcements are concise and polite; avoid announcing footsteps, every slash, or continuous boss-health changes.
- Download status says that the handoff was requested/attempted, not that a file was saved successfully when that cannot be observed.
- Document search reports result count and empty states in text. Long filenames wrap or disclose their complete value accessibly.
- Existing artwork has factual alt text prepared in the later description pass; no invented character lore or visual facts may be filled in automatically.
- MB Bank QR has the same recipient/account/selected amount in readable text and copy controls; seeing or scanning a QR is never the only way to obtain transfer information.
- Amount slider also has an editable VND amount field, explicit Apply amount action, presets, and keyboard increment/decrement via arrow keys as specified in [04-donation.md](donation.md); use does not require dragging.
- Donation provider controls identify when they leave dex.place. The site never announces payment success from a click, copy, QR view, or timer.
- Body text and important labels use a highly readable font; Daniel is reserved for the lowercase dex brand mark.
- Target the applicable WCAG 2.2 AA criteria for the DOM website, including contrast, focus, reflow, and input; this is a validation target, not a current conformance claim.

<a id="7-small-device-performance-and-interruption-rules"></a>
## 7. Small-device performance and interruption rules

- Load shell and selected content before optional game/media assets. A slow game download must not block a file catalog, document, or donation link.
- Load personal art only within Illustrations and size display variants appropriately without replacing the originals.
- Use a bounded low-effects setting on constrained devices; remove decorative reflection/parallax/particles before reducing control responsiveness.
- Do not couple simulation speed, boss wind-up duration, or slash cooldown to render frame count.
- Target 60 fps on representative desktop and touch hardware; 30 fps with responsive input is the lowest playable fallback target. Below a stable fallback, offer the usable DOM site and shared `Try loading world again` SYS-27.
- Tab backgrounding, focus loss, phone calls, rotation, and modal opening pause combat and stop held inputs. Resuming never silently consumes an armed download request.
- Browser back changes/returns routes through the same cancellation and focus rules as the visible navigation.
- No fullscreen request, orientation lock, vibration, autoplay sound, or pointer lock is compulsory.

<a id="8-acceptance-checklist"></a>
## 8. Acceptance checklist

- Test portrait and landscape phone layouts, tablet, desktop, 320 px content width, text enlargement, and 200% browser zoom; no essential control is clipped or covered.
- Traverse all destinations on touch without advanced moves; enter and leave every panel without a stuck button or surprise movement.
- Complete an encounter using move+jump and move+slash multi-touch; verify Pause, direct download, fail/retry, rotation, and interruption paths.
- Verify every route and actual download/donation entry point with keyboard only and a screen reader; no canvas action is a prerequisite.
- Verify reduced motion both before first load and after changing it; camera, props, transitions, and contact feedback honor it consistently.
- With all audio muted, read every boss telegraph and interaction prompt; with game assets unavailable, use all website content.
- Drag, type/apply, choose presets, and keyboard-adjust the donation amount without producing a slash or movement input behind the panel.
- Check touch targets and focus contrast over the brightest sky and darkest arena, not just a blank component sample.
- Measure frame/input behavior on at least one real phone and one desktop; emulator screenshots alone do not prove touch feel or performance.
- **OPEN proof:** Record the actual Samsung Internet/Android and iPad Safari/OS versions and device details when available. Primary target choice is resolved. Additional phone/tablet layouts and supported browser-engine variants are covered by15; emulation is never relabeled as physical-device proof.
- **PROPOSED DEFAULT:** Split the mobile map only if testing demonstrates framing/control failures; a later split must preserve the same content/action contracts.

World and encounter mechanics are defined in [02-world-and-gameplay.md](world-and-gameplay.md). Mobile assistance must not introduce extra content, progression, or a second download/payment state machine.
