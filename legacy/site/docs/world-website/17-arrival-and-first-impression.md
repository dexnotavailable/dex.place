# Arrival, loading, and the first minute

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. Cinematic black bars and one-gesture Enter with chosen sound plus focus supersede the old no-bars/focus-only arrival. Native scroll reveals the complete website. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

**CONFIRMED:** Dex wants the first impression designed as a complete sequence: loading, transition into the first space, and the experience from there. The original storyboard below remains a tunable baseline under the received go. The source v1.5 checkpoint records the locally implemented and narrowly verified refinements; it does not claim public completion.

This chapter owns the home arrival presentation. [02](02-world-and-gameplay.md) owns the map and interactions, [05](05-shell-and-system-controls.md) owns focus/routes, [06](06-mobile-accessibility.md) owns touch/accessibility, and [12](12-audio-composition-and-budget.md) owns audio. The intended feeling is a quiet place becoming visible, followed by an immediate, tangible response to the visitor's sword.

The staging below is an adjustable storyboard under 00/01. The roughly 800 ms reveal, 45%/70% player position, exact tower shape and first-minute timing bands are starting choices to watch and tune in the actual scene. The reference feeling and useful interaction decide the result. Keep preview-to-scene alignment, honest loading, immediately useful tabs, deliberate play/audio activation and the real cable/terminal actions firm; document settled visual changes at the scene checkpoint.

## 1. First paint: a signal in the dark

Implementation refinement: preview plates are exported from the actual raw world canvas at safe navigation anchors, with wide and portrait framing. The live renderer and static plate share the same pure camera calculation. Capture the canvas pixels directly at a rendered frame boundary: a browser screenshot clipped to the canvas rectangle can still bake overlapping DOM controls into the image and is rejected for this use. The pending plate is darkened; its crimson signal uses the same registered world coordinate as the actual architecture. Readiness starts an interruptible .8-second opacity reveal, and play/navigation can dismiss that decoration immediately. Browse site uses the same static scene family. These frames contain no personal gallery artwork or baked visitor text.

The home world viewport begins in deep charcoal. A thin pale horizon and a single small crimson signal establish depth. The signal sits at the actual arrival tower's screen position; it does not become a spinning logo or a progress meter. These forms come from the approved arrival scene composition. If the small scene preview has not loaded, the charcoal shell and readable controls still paint.

The currently selected clean renderer preview is an eager, high-priority image with asynchronous decoding. Choose only the required section/aspect profile; do not preload all rooms or gallery artwork to accelerate arrival. Text compression and image priority are delivery choices that require a fresh cold-load measurement on the final build, rather than a promise of immediate loading on every connection.

The lowercase Daniel `dex` stays at the upper left, with the four section links, Sound off and Menu in their normal positions. There is no second centered logo, tagline, title card, paragraph or separate Start screen. Shell text stays legible through the lightening background using its own restrained contrast backing. Navigation is usable immediately; the loading treatment occupies the world viewport only.

`Loading world…` is a small readable DOM status near the viewport's lower edge, above mobile safe areas and reserved controls. It is not pixel-sized decorative text. Show it only while the world is actually pending. No percentage, filling bar, fake asset counter, looping loading quips or artificial minimum load duration.

Use one lightweight static scene preview exported from the actual approved world, with responsive composition variants as needed. The loading treatment and playable scene must agree on horizon, tower, floor, player anchor and camera framing. No personal illustration, separate generated hero image, video download or bespoke intro character animation is needed.

## 2. Ready: reveal the causeway

On readiness, the same composition resolves into a broad pale sky and still water. The concrete causeway appears across the lower portion, with the small traveler standing safely on it. Starting sketch: the signal becomes a tiny light on the service level of an immense support/tower rising beyond the frame, with a broad span receding into haze. A complete distant mass across open water is another valid composition drawn from the supplied scale studies; choose the stronger assembled view. Ordinary near objects, quiet depth and the enormous form establish scale. The first settled frame already carries the disproportion; no later zoom-out is needed to explain it.

Original full-motion storyboard: a single approximately 800 ms exposure/haze transition, with sky/water resolving before silhouettes and the near floor/player. The settled v1.5 implementation uses one .8-second fade from the darkened aligned plate to the ready world; it does not claim a separate staged animation for each layer. The camera remains fixed; nothing zooms toward the hero. No flash, black bars, camera tour, falling character, wake-up performance or automatic sword flourish. Use the donor's existing Idle pose/clip.

The reveal is decorative and interruptible. Ready immediately enables SYS-06; activating it finishes the reveal before accepting gameplay actions. There is no added wait for an animation to end. A fast cached load can paint the finished composition directly. Never manufacture several seconds of darkness to make the sequence happen.

Readiness means the arrival renderer, native player clips, spawn, floor/collision, immediate cable/bridge and local input handlers are usable. Critical fonts get a legible fallback. Gallery images and audio do not gate world readiness, and DOM documents remain available during loading. The current compact map loads its 50 shared world texture roles together within the measured budget; remote-zone streaming from the original expansion plan is not yet proven. Future larger regions retain that streaming/budget requirement. Ready must not expose an unfinished floor or invisible collider in the immediate playable area.

Proposed landscape framing: player around 45% across the viewport, feet around 70% down the usable world area, facing west toward Dispatch. The tower sits to the right; the first cable lies a few walking seconds left, and a warm service light hints at Dispatch farther along that route. Exact placement follows actual donor readability and the wide-frame rules in 01/11. Do not shrink the body, controls or text to preserve a coordinate.

## 3. Taking control

The address-bar Enter key navigates to the site; it grants neither gameplay focus nor audio consent. Ready visitors can use the existing small `Enter world` prompt (SYS-06), click/tap the play surface, or simply use the four section links. The first surface activation only focuses play; it cannot also slash, jump or open a prop. Tab still leaves the world.

Once focused, show the existing device-specific `Move · Jump · Slash` hint and control bindings. Keep the hint discreet and contextual; do not display a modal tutorial or checklist. The scene remains safe while unfocused. A visitor who stays still sees the accepted idle animation and sparse ambient movement; inactivity triggers no camera tour, encounter, popup or forced action.

## 4. The first minute after taking control

These are composition/playtest targets for an unhurried interested visitor, not timers, scripted movement or network promises. Every action is optional; signs and tabs expose all destinations from the start.

| Approximate elapsed play | What invites attention | Visitor action and visible consequence |
|---|---|---|
| 0–10 seconds | Long clear floor, small traveler, cable a few steps west. | Walk or try a jump. Camera follows only after actual movement reaches its normal dead zone; donor movement, landing and foot contact must feel responsive. No damage or precision gap on the baseline approach. |
| 10–20 seconds | A readable hanging cable with the existing cut-target cue. | Slash once. Contact aligns with the hit frame; the cable separates and a short bridge lowers with a restrained impact and settling motion. It changes a traversable object, rather than awarding points or showing a tutorial-success banner. The normal route was already open. |
| 20–40 seconds | The new short path and warm light lead toward the Dispatch terminal. | Walk toward the light. The terminal's quiet glow becomes a readable `Open downloads` prompt with E / Interact in range. Sword hits on the terminal do not request a file. |
| 40–60 seconds | A real file at an ordinary terminal. | Press E / Interact. Open the Downloads DOM panel under its existing contract, pause the world, and expose the website documentation ZIP with actual release details. Choosing `Fight & download` deliberately begins the encounter; closing the panel returns to the safe terminal approach. No automatic boss introduction or pre-armed download. |

This route demonstrates movement, consequence and useful content with one object and one terminal. It adds no mechanic, extra download, quest state or required onboarding achievement. If the visitor goes another way, the lower Archive walkway offers inspectable documents, the upper stairs/lift lead to the Exhibition, and the eastern route leads to Donate. Do not redirect them back to the intended first-minute route.

The emotional progression is restrained: distance and curiosity on arrival, a small physical payoff from the cut, then recognition that the places contain the actual website. Boss intensity belongs after deliberate selection, not to the first page load.

## 5. Sound and ambient motion

Fresh entry is silent. Sound off is visible from first paint and remains an explicit opt-in; Enter world never enables it. If selected while loading, the audio request obeys 12 and remains independent of visual readiness. A remembered preference does not grant a new-page audible autoplay or bypass browser denial.

On sound activation in the arrival region, use existing AMB-01 exterior air and MUS-01 at its sparse opening. Its first four bars leave room before the motif; do not write a sixth intro cue, add a logo sting or charge additional generation credits for this sequence. Later activation uses the current region's audio rules. Cable and bridge effects remain visible when muted and play only if already enabled.

At rest, use a slow signal glow, subtle exterior drift and restrained water movement within the current motion/quality settings. Avoid synchronized pulsing of the entire scene, rapid blinking and dozens of competing particles. Each object remains a separate authored assembly under 10. Reduced motion makes decorative layers static; sound consent is independent.

## 6. Loading, return and interruption cases

| Case | Exact behavior |
|---|---|
| Cold home load | Useful shell and static signal/horizon state first; critical arrival assets load; actual readiness permits the short reveal and SYS-06. Focus stays in normal document order. |
| Fast/cached home load | Show the settled causeway as soon as available. No mandatory loader display, delayed progress completion or replayed first-minute sequence. |
| Still loading after 8 seconds | Change the small status once to `World is still loading. You can use the tabs.` Continue pending work; elapsed time alone is not proof of failure. No fake countdown. |
| Known initialization failure or 30-second critical-load deadline | Cancel that initialization attempt, retain static architecture and readable routes, and show `World could not load.` with existing SYS-27 `Try loading world again`. Retry starts a new attempt; obsolete completions cannot replace newer route/renderer state. These timeout values are proposed configuration defaults. |
| Section link during loading/reveal | Open its DOM panel immediately under 05. Cancel the home reveal and prioritize that route's content; no stale completion can send the visitor back to arrival. |
| Direct deep link | Show the requested content immediately with its safe destination frame. Never perform the causeway arrival journey behind or ahead of the requested page. |
| Home during the same page session | Restore the causeway safe anchor and normal composition; no loader if resident, no arrival sequence replay, no cut-object reset. Restart world retains its separate confirmed-reset scope. |
| Reduced motion or content-first preference | Use a static readable scene and immediate ready cut. No exposure reveal, parallax or drifting decorative layers. Content-first keeps its current mode rather than starting the renderer for the intro. |
| Tab hidden, lost focus or device rotation | Clear held input and follow the pause/Resume rules in 05/06. Do not replay the intro, jump the camera, auto-resume gameplay or audibly restart a cue on return. |

Use a concise polite status region for loading/ready/failure changes. A permanently mounted screen-reader-only status region announces `World ready` once per initialization attempt while on home, and clears when a new attempt starts. A direct deep link never receives the home-ready announcement. Do not announce each asset, transition stage or ambient blink, and do not move focus when loading completes. Underlying page navigation and accessible main content never wait for the renderer.

## 7. Phone and tablet arrival

Use the same place and first-action logic, with a separately composed viewport for portrait. Preserve visible floor, player, first cable, landing and at least one clear direction cue above the touch controls. Use height, open distance or a broad structural edge to keep the scale feeling; choose the composition that works on that screen. Show less lateral scenery instead of making the player and UI microscopic or enclosing them in a tiny chamber. Landscape can reveal more of the horizon; no rotation demand blocks entry. The compact tab layout follows 05/06's measured fit and 2×2 fallback.

The compact header and four-link strip are present during loading. The SYS-06 tap activates play; then movement/action controls occupy the already reserved safe areas. The reveal cannot cover those controls, change their positions under a finger or intercept a held gesture. Samsung Internet and iPad Safari receive real-device checks when available, with separate emulation evidence as required by 15.

The selected v1.5 portrait camera uses 900 virtual world pixels vertically and a 40 CSS px body floor with the unchanged 52-world-pixel donor. B03's portrait-only offset is(−650,+400); the ordinary eastern view has 300 world px of visual padding. The same calculation places the static plate, and the phone Enter prompt sits below the feet. These are recorded composition refinements, not changes to character pixels, collision geometry or touch sizes. Chapter 01 owns their wider scene context.

## 8. Acceptance and production evidence

Record a cold-load sequence, fast return, throttled load, failed renderer, interrupted reveal and portrait first minute from the actual implementation. Compare preview and ready frames for camera/anchor/scale alignment. Confirm that the first slash changes the bridge, E opens the true Downloads panel, and a file is requested only by the registered deliberate encounter/direct-download flows.

Also verify keyboard-only entry/exit, silent fresh load, sound opt-in during loading, reduced motion, a direct article/art link, loading completion after navigation away, orientation pause and mobile safe areas. Record measured loading time separately from the proposed reveal duration. A planned storyboard or generated mockup is not this runtime proof.

This chapter adds no new control IDs or paid media allocation. New literal strings are limited to the loading/ready/failure statuses registered in 16; other buttons reuse 05. Include the sanitized chapter in the common reader/search/documentation ZIP export under 13.

### Source v1.5 evidence checkpoint

The [native arrival/banner/lift report](D:/Dex/Automation/Proofs/dex-place/20260906-build/arrival-banner-lift/REPORT.md) preserves 14 arrival assertions, including an 803.6 ms measured fade, Enter/navigation cancellation, immediate reduced-motion cut, actual 8/30-second loading states, Retry and an obsolete delayed response that could not replace a newer route. A separate 8-assertion retest verifies the mounted ready announcement across two actual initializations, unchanged keyboard focus, no repeat on ordinary navigation and no wrong announcement on a direct article. The original failure and corrective proof remain separate records.

Clean raw-canvas v4 plates are now selected in both preview manifests with `captureRevision:v4` and `*-v4.webp` URLs, after the final backing trim and current camera/material composition. The canonical `scripts/capture-world-posters.mjs` reads renderer pixels at a rendered frame boundary; its private receipt records `renderSourceHashes` as well as the scene hash. Preview URLs, dimensions and world rectangles decide which plates are active. Contaminated page-composite v1 captures remain rejected; clean v2/v3 are preserved history. After a camera/composition change, regenerate/review aligned plates and update metadata together. The root performed the v4 selection; this source reconciliation itself exports or promotes no media. Actual page captures verify UI; raw-canvas captures verify art and must not be interchanged.
