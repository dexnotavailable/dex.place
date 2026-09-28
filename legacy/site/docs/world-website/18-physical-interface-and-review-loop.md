# Physical interfaces and the build-review loop

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. The map is a permanently cut physical assembly, then an E inspection, with no travel links or re-furling. Sword follow-through, falling cable and independent states apply throughout. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

2026-09-06 · Dex has given **go** for the long-running implementation goal, including a finished public dex.place. Read this addition before implementation. The reviewed package remains in force; this adds the latest interaction treatment and quality workflow, not permission to ignore existing specifications.

## Confirmed direction

- Finish the whole site with high-quality cinematic, somewhat emotional atmosphere. Taste inspection is required alongside functional and technical checks; technical existence is insufficient.
- Inspect every button, dropdown and other interactive element in context. Decide whether E, slash or a normal interface action expresses its purpose.
- Interactive imagery is an independently owned object with visible states: a dropdown can unfold like a scroll/banner after a slash, a terminal has a separate glowing screen, and an elevator has its own moving platform. A flattened picture does not implement these interactions.
- Begin by updating and reading the docs. Throughout the build, step back, sanity-check the integrated result, and pivot or replace methods/assets that fail the intended feel.

## Action assignment

| Surface | Deliberate action | Physical treatment and state | Functional contract |
|---|---|---|---|
| Cable, seal, breakable target | Slash; existing accessibility equivalent | Intact, in reach, struck, separating/open, reset; correct contact-time event | Only the targeted assembly changes; no document or art destruction. |
| Terminal | E / Interact | Housing, screen and light are separate parts; idle, in reach, activating, panel active, returning | Opens Downloads; slash never silently selects or downloads a file. |
| File / gallery bay / donation plinth | E / Interact | Local outline/light and a restrained response at the source object; inspect/open/return | Opens the correct real DOM panel and pauses gameplay. Art remains display-only. |
| Lift | E / Interact to summon or ride | Platform, shaft, lamp and doors/rails are independently authored; called, arriving, docked, travelling, paused | Existing WORLD-01/02 carry, occupancy, stop and reset behavior. |
| Wayfinding banner, WORLD-03 | Slash while in reach, or E / Interact / deliberate pointer/touch activation | Rolled, highlighted, releasing, unfurling, open, furling, rolled | Reveals existing destination choices without selecting one. See the concrete contract below. |
| Banner destination row, WORLD-04 | Enter / click / tap on the named link | Readable DOM label on the independently animated banner surface; focus and pressed states | Invokes the matching SYS-02–05 route exactly; no added destination or history convention. |
| Header tabs, Menu, Close, Back, settings | Normal keyboard/pointer/touch control | Modest pressed/focus response; related panel can fold/reveal through independently animated visual parts | Immediate semantic state, correct focus; essential shell remains usable without world input. |
| Release/OS/file selectors and settings dropdowns | Ordinary accessible select/listbox behavior in the paused DOM panel | Separate backing, top rail, unfurling body and bottom edge can visually echo the banner; closed/opening/open/closing, focused option, selected, disabled/error | Existing options and selected-value rules stay authoritative. Do not require an in-world slash while the world is paused. |
| Download / Fight & download / QR generation / Ko-fi | Explicit labeled DOM activation | Restrained local physical press/reveal; result separate from decorative timing | Exact artifact, recipient, amount and once-only intent rules stay intact. No swipe or accidental slash can authorize an external action. |

Every rendered interactive instance resolves to a registered control plus a presentation state record: input verb, source object/anchor, constituent parts, state transitions, focus owner, contact/activation event, cancellation, reset, reduced-motion fallback and sound cue if any. Repeated instances reuse a class and bind their content ID; do not build one-off click handlers that bypass the owner.

The Exhibition refinement registers a DOM display inside each active native frame aperture while keeping the physical bezel/backing and highlight independent. `gallery.bay.01` → `towaki` and `gallery.bay.02` → `kaizen` are shared by display links and E/Interact. The display calls the bay's inspect action, which marks its panel-active state, clears held input and opens that exact existing viewer. On close the same assembly returns to its normal state. No slash mutates or selects artwork. The selected target also emits its projected prompt anchor after camera positioning, so the E hint and visible source remain associated at desktop, ultrawide and touch sizes. Art display remains scoped under03; raw canvas captures continue to contain only neutral bay backing. An inline even-odd CSS clip path derived from the exact opaque pixels of the current authored CC0 frame leaves the canvas-rendered traveler visible in front of an exhibit during a jump; it neither repaints the illustration nor creates a second character. This replaced an SVG fragment-mask approach that WebKit ignored. The clip and display subtree exist only while an exhibit is visible; no renderer framebuffer, filter or canvas readback is created for it.

## The slash-open banner

**Proposed concrete first instance:** a small rolled wayfinding banner on the arrival/Dispatch approach, independent of the cable/bridge and terminal. It reuses the existing four destinations. Place it where its physical response reads without cluttering the opening vista; it can be encountered after the first cut rather than adding everything to the spawn frame.

- Stable instance `arrival.wayfinding-banner.01`; WORLD-03 owns opening/closing, WORLD-04 binds each of the four existing destination links. This is a world navigation expression, not a fifth primary section or new reward.
- Source parts: support/top roller, fastening/seal, cloth/paper body, bottom weight/edge, optional separate shadow. Generate/author them with the small-pixel environment kit. DOM labels remain real text; never bake the four links into an image.
- Closed + in range: show `Unfurl` with Slash and E / Interact alternatives. One valid strike releases the fastening and starts the unfurl. Repeated hits/held input are consumed while opening; the action cannot fire a link, download or donation.
- Opening: clear gameplay input and acquire a lightweight dropdown focus layer. Animate the independent body/edge over approximately 350–500 ms; the settled v1.5 runtime uses 420 ms. This presentation uses a UI clock while simulation is paused. Ready links become semantically available immediately; keyboard/pointer activation can finish the decorative reveal without a waiting gate.
- Open: four ordinary links, in the existing order. Enter/click/tap invokes the corresponding SYS route. The list has an accessible name `Destinations`, standard focus order and a visible Close control through WORLD-03. No secret extra choices or unreadable sprite-font text.
- Escape, Close or an outside deliberate click closes without navigation; restore the opener/focused world surface and clear stale held inputs. Destination selection closes the banner before handing control to the ordinary section panel; keep the normal route/history/focus semantics.
- Closing visually furls the body back to the roller over approximately 180–260 ms; the settled v1.5 runtime uses 220 ms. Input/navigation is not delayed. A new intent cancels obsolete presentation callbacks; reopening resolves from the latest logical state, without duplicate effects.
- New section navigation, reset, renderer loss or tab interruption cancels pending banner actions. Hidden-tab return follows the existing explicit Resume behavior. A stale unfurl callback never reopens a dismissed menu.
- Reduced motion shows the open or closed state immediately; keyboard/touch and Browse site retain normal destination navigation. The banner is not required to reach any content.

Timing and visual anatomy are documented starting choices; inspect the actual unfold at gameplay size and tune it coherently. The distinct stateful object, correctly assigned actions and accessible semantic links are required.

## Read, build, step back, inspect, replace

1. At each work block, read the active owner docs, current build checkpoint and last unresolved quality finding. Identify the user journey and the intended visual/emotional effect before touching its pieces.
2. Build a small integrated increment: working geometry, actual CC0 player, independently generated/assembled assets, real content and relevant DOM states together. Avoid a large parallel asset pile that has never shared a screen.
3. Inspect the actual browser at ordinary size. Move, jump, slash, open E interactions, expand every dropdown, select every option, close/return, pause, resize and try the touch variant. Watch the transition rather than judging a finished frame alone.
4. Step back for a whole-scene pass: focal point, small-pixel consistency, enormous scale, breathing room, lighting, audio space, responsive action and emotional tone. Remove distracting UI or revise weak staging within the documented contract. A green test cannot dismiss a weak picture or clumsy action.
5. If an approach repeatedly produces poor results, name the concrete failure and replace the responsible asset, composition, animation method or adapter. Preserve a known working revision. Two failed attempts without new evidence trigger a method change, not more blind rerolls. Existing tool/account/budget and feature boundaries remain in force.
6. Record the accepted scene/config/spec changes and representative proof, plus what remains weak. New behavior must enter its owner first; routine visual adjustments are captured at the checkpoint. Then continue into the next integrated increment.

## Finish line and honest proof

### Composed implementation checkpoint · source v1.5

The first composed trial put a separate DOM card beside a blank physical cloth. That double-surface treatment is superseded: the selected desktop menu is one readable DOM paper surface centered over the physical roller/cloth. Its emitted screen anchor comes from the banner's world x and y−233 roller position, transformed by the live camera. The roller, cropped cloth and following bottom weight retain independent state ownership; the DOM supplies readable labels and hit targets without leaving a second blank sheet beside the menu. A light unblurred backdrop preserves the surrounding place. Narrow screens use one inset readable surface, bounded within the usable viewport.

Outside pointer-down, Escape and Close dismiss without selecting a destination. The consumed opening slash is cleared and returns to the appropriate resting/falling pose, preventing a frozen white arc across the menu. The object settles into explicit `rolled/amount0` and `open/amount1` after its .22/.42-second clocks; reduced motion resolves immediately. Navigation cancels the presentation before its ordinary route handoff. Device rotation closes it into Menu and requires explicit Resume, and return to portrait cannot reopen it. Tab hidden/lost focus and renderer loss retain the same cancellation contract; the local headless tab-switch attempt did not actually hide the document, so it is not hidden-tab proof.

Physical terminals expose panel-active and short return presentations on their own screen/status parts. The lift deck and bridge use native cropped art aligned with the existing collider width; the generated full export is not distorted to fit. Gallery frames now mount 40 world px above their previous visual position and retain neutral apertures and subtle inspection lights; their E targets are unchanged. Personal illustrations are still fetched and displayed only by the Illustrations content viewer.

Native proof now covers slash/E/touch banner entry, outside/Escape/Close, destination navigation, settled/reduced states and actual orientation cancellation at desktop/phone sizes. The remaining lift cases also passed: occupied descent with exact carry, repeated-input rejection, both landing summons, eight-second empty return and no occupied auto-return. Chapter 09 links these scoped receipts. Their source hashes and emulation boundaries remain part of the result; they do not certify later builds automatically.

The complete reviewed website must work at public dex.place on this machine, including real documentation ZIP delivery, all destinations, gallery, donation choices, coherent audio, layer/object animation and supported responsive access. Current public hosting remains the rollback owner until a tested replacement is ready. This go authorizes scoped deployment of that finished replacement; no second generic deployment permission is needed. Actual payment, identity/security gates and destructive unknown-data actions retain their separate boundaries.

Public reachability alone is not completion. Inspect the final public build for the same scenes, interactions, media and failure paths tested locally. Every dropdown/button has an action/state result, and every scene receives taste inspection. Keep physical Samsung/iPad/bank checks distinct from emulation; prepare a concrete user-assisted check only when tool access genuinely cannot prove the required behavior. Continue all independent work in the meantime.

Surprise and emotional impact are the quality aim entrusted to the agent; they cannot be claimed as a measured user reaction before Dex sees it. Deliver the strongest coherent experience supported by real inspection, rather than adding unapproved features to manufacture spectacle.
