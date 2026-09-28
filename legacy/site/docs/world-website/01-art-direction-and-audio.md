# Art direction, brand, and audio

## Source 2.1 implementation precedence

**GO received 2026-09-08; source 2.1 is adopted and implementation is active.** Read [21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) first. Sparse inhabited/cozy/monumental spaces, layered pixel UI and cinematic bars supersede the universal empty-world and earlier shell treatment. Their explicit supersession table controls conflicts; unchanged detailed requirements below remain in force. Earlier first-pass proofs retain their original scope. The latest GO and [26](26-v2-implementation-record.md) own the current local implementation checkpoint and remaining verification.

R-07, R-12, R-15 and R-22 are CONFIRMED. Dex also confirmed wide, spacious framing with smaller characters/props, and now explicitly wants a small character against an enormous background/composition, approaching a megalophobia feeling (R-37). Eventual original animation remains preferred, with a coherent authored donor accepted for now. Concrete values and scene treatments below are PROPOSED DEFAULT. This is an authored target, not a rendered visual proof.

## Emotional and visual target

Beautiful, deserted, slightly unfamiliar. Quiet architecture and large unoccupied spaces make a small, deliberate sword action feel consequential. Liminal does not require horror chases, jump scares, gore, VHS overlays, or an all-black screen. The environment should feel coherent even while still.

Use a distant horizon, still water, pale concrete, long corridors, a few red signal lights, and carefully placed warm light. Monumental architecture is a recurring part of the composition: an immense support rising beyond the frame, a roof spanning far beyond its human-sized entrance, a distant wall disappearing into haze. A tiny traveler, ordinary door, bench or terminal provides the scale comparison. The unease comes from that disproportion and the quiet around it. Avoid over-explaining why the complex exists. Location names are navigation aids, not lore monologues.

The four destination compositions and map topology are owned by [02](02-world-and-gameplay.md). This document owns the shared visual rules.

### Supplied scale references and what carries over

Dex supplied three images on 2026-09-06 specifically to clarify the sense of scale. They were visually inspected. Treat them as composition references for the existing pixel world; the image contents are reference material, not additional user instructions or automatically requested game features.

| Reference | Observed relationship | Use in this world |
|---|---|---|
| A: colossal submerged figure beside a tiny diver | A huge close mass extends beyond the view; layered vertical forms recede into cool haze; the small person and overlap make the volume legible. | Strong near/far overlap, interrupted structural extent, a readable tiny traveler and depth through subdued distant shapes. |
| B: lone figure facing a distant spire across water | Open distance separates the person from a nearly complete giant silhouette. Dark near rocks frame a broad quiet middle distance. | A whole distant landmark can feel immense without clipping its top. Use open intervals, a recognizable foreground scale cue and deliberate contrast falloff. |
| C: immense rounded form over a landscape with small walkers | One dominant curved mass overwhelms the landscape; a lit route and tiny people remain readable below it. Warm local ground light contrasts with cooler distance. | Vary the geometry beyond repeated straight pylons; broad curves, structural shells and distant masses can carry scale while a lit playable route stays clear. |

The local references are [A](D:/Dex/Temp/User/codex-clipboard-d5f14e01-6d2d-4d93-880a-322c909aa453.png), [B](D:/Dex/Temp/User/codex-clipboard-5f3619a3-8aa4-4ff2-b42b-69a5e8b58b10.png), and [C](D:/Dex/Temp/User/codex-clipboard-8abf2609-7175-4adf-82a7-22ae991610e3.png). These are the newly supplied scale studies, distinct from Dex's nine personal illustration exports. Their composition can inform the later approved environment-generation brief. Do not ship the screenshots, their UI overlays or their painted pixels as world assets; retain the design lessons and omit private reference paths/images from the public documentation export. They do not automatically add underwater movement, literal giant creatures or new encounters to the current scope.

### Visual iteration policy

The figures, percentages, coordinates, intervals and architectural sketches remain the documented baseline under [00](00-decisions-and-scope.md). Keep them present and assess them together with whole-scene visual/playback quality. Tune the view, shape, lighting, density and spacing coherently, documenting justified refinements at the checkpoint. A checklist pass cannot accept a cramped, incoherent or unpleasant result, and a pleasing image cannot excuse missing specified behavior. Accessibility, coherent pixel/collision scale, truthful content and the user's asset boundaries remain required.

Scene variety matters. An open vista, a close overwhelming mass, a deep void and a quieter human-scale threshold can belong to the same world. Each destination should contribute to the overall immense-place feeling without repeating an identical tower, bench and percentage recipe. The foreground-first, separately generated asset workflow in 10 supplies editable pieces for this iteration.

## Brand and typography

| Element | Intended appearance / rule |
|---|---|
| Logo | Literal lowercase `dex`, Daniel letterforms; no tagline in the header. Never substitute all caps, generic handwritten text, or pixel lettering for the mark. |
| Starting wordmark candidate | `brand-assets/dex-logo-daniel-regular-black.svg`, recolored pale on dark backgrounds if needed. Weight is a proposed default, to be checked at header size. |
| Existing variants | Regular/Bold/Black outline SVGs and OTF sources exist. The generic `dex-logo.svg` alias currently differs in geometry from the plain regular/bold variants; do not assume it is the selected design. |
| UI and document type | Existing Inter family as the proposed readable sans. Daniel is reserved for the wordmark, not documentation paragraphs or numeric amounts. |
| Code and technical metadata | Existing JetBrains Mono or a readable system monospace. No pixel text for banking details or long documentation. |
| Body and input fields | 16 CSS px baseline (1rem at default settings), 1.6 line-height, approximately 60–72 characters per line in documentation. Fields/amounts remain ordinary readable text. Zoom and text scaling remain functional. |
| Section/article title | Plain Downloads / Documentation / Illustrations / Donate or the actual article title; 24 CSS px desktop, 20 CSS px compact, line-height 1.25–1.35. Wrap long titles. No viewport-sized heading, giant numeral or separate marketing headline. |
| Subheading | 18–20 CSS px, line-height about 1.4. Hierarchy comes from weight and space, without enormous jumps in size. |
| Navigation, button label, nearby prop prompt | 14 CSS px baseline, line-height about 1.4–1.5; input fields and longer instructions remain 16 px. Modest letters sit inside generous hit areas; small text never implies a small target. |
| Secondary metadata/loading status | 14 CSS px baseline, line-height at least 1.5, readable contrast. Never reduce essential instructions or failure text to decorative microtype. |
| Wordmark footprint | Start at visible Daniel glyph height 24 CSS px desktop / 20 px compact, width from the real outline aspect ratio. Its clickable area stays at least 48 px high on touch. No giant duplicate logo in the world. |

These are default-size design values, expressed in relative units in the UI so browser text preferences can enlarge them. They are not hard maximums against user zoom. No normal website text uses viewport-width scaling. If a label does not fit, wrap/reflow its layout; never squeeze its letter spacing, distort it, truncate a primary tab, or lower the font to make a composition pass.

At default zoom the desktop shell aims for a single 56 CSS px-high row with 24–40 px outer side space and 24–32 px between navigation labels where available. The compact shell uses a 48 px minimum identity row plus naturally sized tab rows;05/06 own the measured-fit rule and 2×2 fallback. Give the scene the remaining viewport instead of putting it inside a centered website card or padding it with a large hero-text band.

The Daniel font source and license live at `D:/Dex/Projects/SUMMER PROJECT 3/dex-client/brand-assets/source-fonts/daniel/`. Recheck `Daniel Midgley.txt` and distribution needs during asset preparation. Do not upload source fonts or user artwork to generators as an incidental convenience.

## Proposed color tokens

| Token | Value | Role |
|---|---|---|
| Paper | `#F3F1EA` | Reading panels and pale architecture |
| Sky | `#DCE6E6` | Distant open space |
| Concrete | `#B9C2C2` | Middle-distance structures |
| Ink | `#181D24` | Text, close silhouettes, deep openings |
| Water | `#657A85` | Reflective low-contrast ground plane |
| Signal | `#D8434D` | Active focus, signal lights, decisive accents |
| Warm light | `#E3BD83` | Sparse lamps and support alcove |
| Quiet text | `#505B64` | Secondary content on pale panels |

Tokens are starting candidates; final combinations need contrast proof. Red is a focal accent, not a wash covering every surface. Interactive state must have shape/text/focus feedback as well as color. Donating a larger amount never makes the UI more celebratory or visually rewarding.

## Pixel construction and composition

**CONFIRMED (R-40, latest mid-generation steering):** pixel art must be unmistakable at ordinary gameplay size, with coherent visible pixel pitch after scaling. Dex judged terminal v2's pixel style good, while platform v2's blocks are too large because the platform itself will render much larger. A larger foreground object therefore needs more logical pixels across its visible body; it must not inherit a small prop's coarse source grid and magnify it further. Nearby props and platforms share a coherent visible grid. Middle/background forms may be somewhat finer. The traveler and overall framing stay small/wide; preserve the authored CC0 character.

- Keep the CC0 character's authored pixels/proportions; compose generated foreground and background pixel art around its actual density. Do not repaint the character, stretch its body or arbitrarily enlarge its pixel blocks to force a match.
- A 16-pixel map tile is an authoring unit, not a request for a single visible 16 CSS px block. Source resolution, tile size, display magnification and device-pixel ratio are distinct; select and verify the world sampling at real desktop/mobile viewing size.
- Native pixel-art generation remains a production route. Dex also explicitly authorized a comparison using high-definition object sources followed by controlled per-asset pixelation (R-45). Preserve each raw source; define the crop, logical grid and palette treatment before judging the derivative at its real scene size. A global filter over detailed photographic/painterly scenery is not automatic acceptance. Visible pixel clusters must support clear forms rather than noisy texture everywhere.
- Judge crispness while standing and moving. Fine pixel work must retain stable edges, readable silhouettes and coherent near-object density without shimmer, blur or mismatched coarse sprites. Distant forms may use quieter detail and atmospheric contrast while belonging to the same pixel-art world.
- UI text, Daniel lettering, personal gallery artwork and QR codes keep their existing independent rendering contracts; the small-pixel direction applies to the authored game world, not a filter over the entire website.

- Start art at a 16-pixel tile unit; a nominal 48-pixel-tall player silhouette is a source-authoring starting point, not a required rendered screen height. Source-frame canvas/margins, body height, and displayed height are different measurements.
- Keep objects sharing a depth/role consistent in their pixel treatment. Foreground props retain visible clusters while large foreground platforms use enough source resolution to match their on-screen pitch; distant forms may be finer. A downsampled high-definition source remains an experiment until its silhouette, material, lighting, alpha edges and movement pass beside the authored hero and other assets.
- Use crisp nearest-neighbor sampling for pixel assets and a world camera snapped to the virtual pixel grid. UI text and QR codes render independently at readable native resolution.
- Prefer pixel-aligned scaling where it satisfies framing and readability. Any fractional viewport fit must keep stable nearest-neighbor sampling and pass the comparison proof; integer magnification must not force an oversized actor or unusable crop. Small alignment padding is acceptable, but portrait must never become a tiny landscape strip inside giant letterboxes.
- Composition layers: foreground framing; player/platform plane; architecture; water; horizon/sky. Use restrained parallax and consistent light direction.
- The spawn view has a clear standing surface, a readable route toward a destination, and one immediate harmless sword interaction. Do not begin in a blank void, under water, or facing an unexplained wall.
- The player occupies a small but readable part of a wide scene. Use the ratios and readability overrides below; boss encounters may tighten enough to read attacks and landings. Camera targets must not obscure hazards or navigation.
- Large white areas still contain depth through occlusion, shadows, material edges and atmospheric perspective. Avoid flat empty filler.
- All four places share architecture and lighting logic. Their identity comes from layout, props and sound, not four unrelated art packs.

### Pixel scale evidence and authorized comparison

**Confirmed v1.4 projection correction:** the finished world should look fully 2D. Generate props and architecture in strict flat side-view/front elevation, with intentional pixel shapes and no visible top face, foreshortening, angled end caps, isometric view or extruded 3D-render viewpoint. A small edge highlight may define a boundary; it must not become an exposed side plane. Establish environmental depth through separate layer overlap, size relationships and contrast falloff. Controlled post-pixelation and matched pixel pitch do not waive this projection requirement. Inspect existing sources for it; preserve returned drafts and repair or replace the affected piece rather than blindly regenerating the whole batch.

Record each asset's `sourceOpaqueRect` (visible subject bounds in source pixels), `sourcePixelBlock` (measured or estimated block width/height, with method), `logicalRenderSize` (subject size in logical pixels), `worldScale`, `depthRole` and `gridRole` in 19's production inventory. Transparent margins and opaque checker backgrounds are not subject dimensions. If the generator emits an RGB checker, record it as baked background; do not call the full canvas a valid alpha cutout. Unknown measurements stay null until inspected.

For a uniformly scaled source crop, a useful diagnostic is `screenPixelPitch = sourcePixelBlock × logicalRenderSize / sourceOpaqueRect.size × worldScale × cameraCssScale`, evaluated separately on each axis. If the source is converted to a new logical pixel grid, measure the derivative's grid instead. CSS pixels, device pixels and source-image resolution are distinct. Record the camera/viewport used; the equation diagnoses mismatch and never replaces visual judgment.

Compare native pixel-art and controlled post-pixelation derivatives at the same world dimensions in one actual scene containing the unchanged CC0 hero, terminal, larger platform, a middle structure and a far layer. Inspect standing frames and camera/actor motion at ordinary desktop and compact view sizes. Preserve the successful terminal's pixel identity while correcting the platform's pitch; test whether the high-definition route improves large forms without destroying clear edges or material grouping. Record the selected treatment and reason. A flat mosaic, inconsistent near-field blocks, shimmering edges or lost silhouette fails even when a numerical pitch happens to match. UI, personal artwork and QR codes are excluded from this experiment.

### Spacious framing and scale rules

**CONFIRMED:** Smaller characters/props and a wide camera should make the world feel spacious and de-emphasize small visual imperfections. Dex's latest refinement explicitly prioritizes a tiny traveler against an enormous environment, almost megalophobic in scale, with restrained text and breathing room. This is the presentation direction, not permission to hide broken animation or unreadable interaction.

The v0.8 targets below replaced v0.7's exploration 5–7% and arena 7–9% defaults. In v0.9 they remain first-composition guides, not per-scene acceptance bands. Select the final camera by small-traveler scale, readable movement and useful route visibility. The surrounding mass/depth does substantial work; shrinking the actor alone does not establish the intended feeling.

| Measure | Proposed starting target | Override |
|---|---|---|
| Landscape exploration hero body | Approximately 4–5% of usable world viewport height. | Increase its screen size only as needed for silhouette, direction, landing or interaction readability; keep the enormous environment composition. |
| Landscape arena hero body | Approximately 5–7% of usable world viewport height. | Prefer the wider end. Keep boss, threat region, safe floor and next landing visible; never crop an attack or zoom for an ordinary swing. |
| Portrait exploration hero body | Approximately 5–6.5% of usable world viewport height before the mobile readability floor. | Preserve the visible route and structural scale; short/touch-heavy viewports may use a larger ratio. Judge the actual composition and interaction rather than the range alone. |
| Practical desktop floor | Aim for at least 32 CSS px body height. | This is a provisional readability floor, not proof that every 32 px sprite is readable. |
| Practical mobile floor | Aim for at least 40 CSS px body height where viable. | If the ratio and floor conflict, use the floor and recompose surroundings first; tighten only as much as required. Never make the actor illegibly small or reduce touch targets. |
| Landscape composition | Author a wide 16:9 base view; adapt 21:9 by revealing more useful horizontal world. | Preserve actor scale/readability; no horizontal stretching or mandatory side bars. |
| Portrait composition | Use a taller authored camera view with the next landing/movement visible. | Adapt look-ahead and composition; do not merely crop the middle of a desktop shot. |

- Measure body height from feet to top of head, excluding sword, slash arc, trail, and transparent frame padding. Usable world viewport excludes DOM shell, reserved touch-control space, and any padding; use CSS pixels, not device-pixel count.
- Treat the player and nearby props as one consistent world scale. Change camera composition uniformly; do not shrink sprites independently of their collision body or change hitboxes to manufacture spaciousness.
- Place the traveling actor near the lower third when floor and landing visibility allow. Looking ahead follows the next meaningful movement, including upward/downward traversal, rather than blindly reserving empty sky.
- Give each view one primary focal point: the traveler/action or the destination landmark. A few smaller signals can guide the route without making every object glow or move.
- Empty space needs a readable horizon, architectural interval, light path, or travel direction. It should communicate distance and stillness, not absence of finished content.
- Establish near, middle, and far depth through occlusion, material grouping, contrast falloff, and sparse framing. Distant shapes are quieter; playable edges retain clear separation.
- Keep terminals, files, benches, and support props at modest human scale relative to the hero. Preserve their affordances through silhouette, local contrast, and existing labels; do not force every object to be tiny.
- Use a few deliberate material/pixel clusters instead of fine scattered noise. Maintain stable outlines, feet, sword direction, and shared lighting; restrained postprocessing cannot replace those.

### Monumental space and breathing room

- Establish immense scale through a deliberate relationship between the traveler, familiar small forms and the surrounding mass/distance. Choose the composition suited to each place: an open horizon, a close silhouette, a deep void or a framed distant structure. Large blank padding alone does not deliver scale. These are existing scenery roles, not new enemies or regions.
- When a shot feels small or busy, useful diagnostic starting points are a dominant span around 10–20 hero-body heights, broad distance/massing around 65–80% of the frame, roughly half the view kept low-detail, and sparse peripheral foreground. They are optional aids, not required quotas or a repeated layout. A reference-like whole distant silhouette can work as well as a cropped near mass; retain ordinary scale cues where they clarify the relationship.
- Allow a structure to continue beyond a top or side edge when that improves the shot, or show its silhouette across an open distance. Sparse repeated modules, occlusion, contrast falloff and long quiet intervals establish depth. A heavy broad shape and an ordinary entrance often do more work than a wall full of scratches and lamps.
- Foreground framing may be adjusted freely for depth, but cannot hide a current hazard, landing or interaction. If it crowds the action, remove or move pieces before adding fog/glow to disguise the problem.
- A landmark can dominate composition while the player/action remains the strongest local contrast. Avoid giving every sign, lamp, prop and particle equal emphasis. Show one nearby contextual action prompt at a time; distant props do not accumulate floating title banners. Existing junction signs and the four normal tabs still communicate the routes.
- The traversable route is compact within the monumental setting. Preserve the 15–30-second normal landmark reach target in 02; giant background architecture does not require minutes of running across empty floors or a newly expanded collision map.
- The camera settles into the chosen spacious view. Ordinary attack, landing, document inspection and idle do not add hero closeups. Brief thresholds and quieter pockets can contrast with broad views; avoid a whole journey of tight rooms or an identical monumental reveal at every stop.
- On portrait, use depth, height or an incomplete structural edge as the composition calls for. On ultrawide, reveal more span and distance without stretching or enlarging the player for its own sake. Low quality and reduced motion retain the chosen scale relationship with simpler static layers.
- A screenshot must still communicate disproportion with UI hidden, motion stopped and audio muted. Audio and parallax reinforce the composition; they cannot supply missing scale.

Illustrative measurement at a 900 CSS px usable world height: a 36–45 px traveler fits the landscape target; a visible structural span of 450–720 px creates a substantially different relationship from a 90 px doorway behind that traveler. At 600 px usable height, the existing 32 px floor wins over a 24–30 px ratio target. These are planning examples, not measured output or a requirement to distort native pixel assets.

### Settled composed-runtime checkpoint · source v1.5

The preceding ratios, study sketches and v1.3/v1.4 pixel/projection corrections remain the review baseline. The following are the currently selected implementation refinements, not new fixed quotas or a claim of final visual approval:

- The unchanged donor has a 52-world-pixel body. Portrait framing uses 900 virtual world pixels vertically, with camera zoom floored at 40/52 so the body stays at least 40 CSS px. Landscape uses the existing 1020-world-pixel view and uniform camera fit. No hero pixels, proportions, collider dimensions or hit timing were changed to achieve spaciousness.
- The distant B03 monument receives a portrait-only world offset of(−650,+400). The ordinary camera may show 300 world px beyond the eastern map edge for Support composition; this is visual space, not a walkable-map or collision extension. Near props retain their established grid. Recompose a difficult view before distorting those objects.
- All 50 roster roles are present in the runtime candidate. B04's targeted curved-shell v2 replaces its weaker earlier mass; B03 uses its selected restrained tone derivative. Raw sources and superseded trials remain preserved.56 manifest placements reuse these independent assets, while interaction assemblies own their separate moving/screen/cloth parts. Chapter 19 owns counts and maps; a role count is not whole-scene acceptance.
- Sky coverage follows the full current camera rectangle with a small pixel-aligned overlap. Water retains a stable world horizon, continuous lower fill and a blended end to its texture band. Vertical traversal no longer exposes the former sky/water coverage seam. Low/reduced-motion views retain static coverage and architecture; the subtle drift and optional particles do not carry essential composition.
- Close floors, foundations and joined stair stringers carry stronger dark structure against the pale sky and quieter distance. Interior seams are subdued. Warm service lights and floor pools are local; Gallery has a restrained pale inspection light, while Support receives the warmer emphasis. Large uniform glow and a regular high-contrast wall grid are rejected by this hierarchy.
- Neutral Gallery frames mount 40 world px above their original floor-standing visual position, with a muted backing and small inspection light; the existing E targets and colliders stay in place. Support's dark recess follows a curved upper backing instead of exposing a horizontal sky-to-rectangle cutoff. Neither change reuses personal illustration pixels.
- The selected arrival prompt sits below the hero's feet on phone. The banner is one readable DOM paper surface centered over its physical roller and cloth, with no separate blank sheet left beside it. Chapter 17/18 own the loading/semantic timing and close/focus behavior.

Current shared world texture surfaces are approximately 33.97 MiB decoded, plus 6.4 MiB for the hero. These measurements exclude gallery/audio budgets and renderer overhead; they do not prove device performance. The local composed-scene and native receipts in 09 document their own revisions. Later lighting/backing/poster changes need their focused comparison, and physical-device, listening and final public taste checks remain open.

### Framing does not waive animation quality

- Inspect both normal native-size gameplay and a consistent nearest-neighbor 2× crop of the same motion. [11](11-framing-and-sprite-comparison.md) owns the comparison protocol, evidence layout, and current experiment status.
- Wide framing can reduce emphasis on minor facial or texture details. It does not excuse limb/costume morphing, foot sliding, unstable registration, collision mismatch, unreadable hits, or a sword that changes construction between frames.
- The normal view must communicate movement, contact, landing, and interactions without the inspection crop. The 2× crop must expose no structural contradiction hidden by distance.
- Do not introduce huge hero/boss closeups or ordinary-attack auto-zoom before coherent playback has passed both views. Presentation changes still require the documented camera/interaction contract.
- Keep the accepted normal view as the shipping reference; do not polish only an enlarged still while the real small actor remains unreadable.

## Independent player and sword assets

The site player is an independent traveler silhouette with a katana; exact appearance is an asset-production task. **CONFIRMED:** Dex prefers original animations as the eventual endpoint and accepts a coherent authored donor for the current stage. Adapt the interim licensed set under the provenance workflow in [10](10-world-production-workflow.md); do not claim that adaptation is entirely original art. It must not be Kaizen or extracted from any existing illustration. Face detail is subordinate to silhouette and direction.

The eventual original set must pass the same frame-registration, action-timing, normal-view, and 2× comparison gates before replacing the accepted donor. That endpoint does not authorize producing a full original frame set now or mixing an unproven original cycle into an otherwise coherent interim set.

Required poses: idle, run, jump rise, fall, land, dash, slash, hurt, defeat, interact. Required effects: grounded slash, aerial slash, impact, cut object separation, restrained dash trail, respawn. Required world cut classes: ropes/cables, brittle seals, suspended debris. Details and consequences are in [02](02-world-and-gameplay.md).

Animation sheets need fixed pivot/feet reference, documented frame order/duration, readable sword reach, coherent proportions and no extra limbs or frame-to-frame costume changes. Animation playback is driven by gameplay state. A GIF or video with unrelated timing cannot stand in for a controllable character.

## Panels, controls, and feedback style

- Reading panels are opaque enough to read over bright water and dark structures; backdrop dims the paused world gently.
- Desktop panels use a clean rectangular shell, modest border, clear close control, visible title and independently scrolling content. Avoid huge decorative border chrome.
- Buttons use legible text, a 1–2 px outline or filled accent, and a clear focused/pressed state. Hover shifts at most 1–2 px; no magnetic cursor movement.
- Fullscreen media viewer gives the artwork its own neutral surround. It preserves aspect ratio and does not apply blur, color grading, parallax, moving layers, or animated cropping to user art.
- Focus ring is always visible. Disabled actions show a reason. Spinner-only errors are not sufficient.
- Download victory uses a concise result panel and a visible file action; no confetti shower, leaderboard, social-sharing prompt, or fake install animation.
- Documentation pickups glow subtly and show a real title on interaction. They are not illegible microscopic text textures pretending to be documents.
- Payment QR has a stable white field and quiet zone; no pixelation, hue tint, logo overlap, scanline, animation or bloom over its modules.

### Panel spacing and text density

- At default desktop sizing, use section shells around 720–1,040 CSS px wide, bounded by the actual viewport with at least 24 px outer gutters. A long-document/index shell may use the upper end; the method-choice/settings surface can remain around 480–640 px. Never stretch an ordinary panel across an ultrawide monitor just because room exists.
- Use 24–32 px desktop inner padding, 16–20 px compact padding, 24–32 px between major groups, 12–16 px between related rows and 8–12 px between a field label and its control. Existing minimum hit-area/separation requirements win. Spaciousness comes from clear grouping, not from oversized letters or a densely tiled wall of cards.
- The title/action header sizes to its contents, starting with a 48 px minimum control row. Avoid a tall decorative heading slab. Put a 16–24 px gap between this header and content. The close control remains visible while the body scrolls.
- Documentation stays within the readable line measure even when its shell is wide. Optional index/sidebar layout may use remaining width; when it would squeeze the body, reflow using the existing controls rather than compressing text. Do not add a new sidebar feature merely to fill unused space.
- Compact content uses the available screen below the shell, with normal page/panel scrolling and full-width readable fields. Default desktop gutters are not mandatory in a 320 px viewport. The art fullscreen viewer and scannable QR retain their separate functional sizing contracts.
- In the world, show actual nearby action text only. Do not add room-name hero banners, giant floating file titles, decorative verse, or a large permanent controls legend. In open panels, readable content is the focal point; do not make it translucent or miniature to preserve an uninterrupted background.

The default-size values require actual desktop/phone screenshot and text-scaling proof after go. Documenting them does not establish that the layout already looks spacious.

## Timing and motion vocabulary

Starting targets, all subject to measured playtesting:

| Motion | Proposed target | Reduced-motion behavior |
|---|---|---|
| UI state change | 100–160 ms opacity/translation | Immediate or short opacity only |
| Panel entry/exit | 160–220 ms | No travel; immediate focus-correct state |
| Section camera transition | At most 450 ms, skippable; destination visible early | Immediate destination |
| Ambient elements | Slow loops; different periods, low displacement | Static frame |
| Major slash impact | 35–55 ms local gameplay hit-stop | Keep input feedback; no flash or shake |
| Camera shake | Small and brief, only heavy impacts; configurable off | Always off |
| Boss defeat | Under 1.2 seconds before readable result | Direct result state |

Never delay the browser handoff merely to finish a cinematic. A victory's animation and its once-only download intent are independent. Preserve all artifact/snapshot availability validation in [03](03-sections-and-controls.md); do not skip it to retain browser activation. If valid activation remains afterward, use it; asynchronous checks may lose that opportunity, so always expose the manual handoff button.

## Audio direction

The canonical composition, cue sheet, motif, loop construction, transitions, audio formats, memory limits and credit budgets are in [12-audio-composition-and-budget.md](12-audio-composition-and-budget.md). Use five related region cues, two ambience sources and a bounded effect library. No paid stem-separation dependency or runtime generation is included.

The feeling stays instrumental, spacious and restrained: distant piano/bell-like notes, soft synth texture, sparse low tones and room sounds. Boss music adds focused rhythm; documentation remains quiet; illustrations receive an open melodic space; Donate remains warm without amount-based musical reward.

All audio is opt-in. Mute wins immediately. Content-panel pause is distinct from menu/window pause; chapter 12 owns the exact fade, offset and transport rules. A sound conveying gameplay information always has a visual equivalent.

Defaults after opt-in: master 60%, music 45%, effects 60%, ambience 40% of normalized buses. These are proposed mix settings, not loudness guarantees. [05](05-shell-and-system-controls.md) owns the existing controls; chapter 12 owns normalization/listening acceptance.

## Provider and asset-production boundary

Higgsfield is a candidate for new environment concepts, props and animation exploration. ElevenLabs is a candidate for music, ambience and effects. Provider tools are production helpers; the public website plays approved local/exported assets. No visitor action starts generation, consumes provider credits, or exposes a production key.

The earlier v0.1–v0.2 notes that Higgsfield authentication was unverified describe the historical planning stage. In the later user-authorized sprite experiment, Higgsfield CLI 1.1.24 was installed on D, OAuth succeeded through the existing browser session, and generation access was verified; [11](11-framing-and-sprite-comparison.md) records the completed attempts, exclusions and costs. That sprite experiment is closed; the authored CC0 donor remains selected. Its former wait-for-go boundary was superseded by Dex's explicit go on 2026-09-06, which authorizes the scoped website build, asset workflow and checked public deployment under15/18. The later bounded Suno arrangement request and its actual results are recorded in20. These authorizations do not reopen rejected sprite trials, authorize purchases or establish unverified provider entitlements. ElevenLabs remains reserved for other projects. The built-in image generator is hosted and its exact backend is unexposed. Any previously pasted API secret must not be copied into docs, examples, frontend code, manifests, screenshots, or reports. Local implementation exists; final media, integrated quality, device and public-delivery proof remain separate.

The source-to-runtime workflow is owned by [10](10-world-production-workflow.md). Character animation begins from a coherent authored set, with controlled frame edits and event timing; independent generated frames are not the default production method. Static concept/asset generation does not supply collision, object state, motion paths or attachment points.

Generated pixel assets require manual/engine QA for shared palette, tile seams, transparent edges, sprite identity and frame registration. Generated music requires listening QA and loop editing. Do not promise ready-to-ship sprite sheets or seamless music because a generator returns a file.

## Asset register contract

Every asset used later needs: stable ID, role, source path, creator/provider, input provenance, license/reuse basis, dimensions or audio format, revision/hash, processing notes, intended destination, and visual/audio acceptance evidence. Prompt references must obey the existing-art restriction.

User illustrations have an `illustration-display-only` role and may only resolve from the illustration manifest/viewer. Do not preload the whole original-art folder for spawn. Source PSD/CLIP files remain untouched. Exporting gallery display copies is separate authorized production work, not part of this documentation pass.

Music/source licenses and provider terms must be checked against the actual account before public use. No legal or entitlement assumptions are made by this draft. See [09](09-sources-open-items-and-changelog.md).
