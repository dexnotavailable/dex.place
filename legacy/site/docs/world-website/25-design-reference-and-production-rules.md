# Design references and production rules

2026-09-08 · Source2.1 research expansion · **Adopted production reference; implementation active, with current evidence in26.**

[21](21-next-pass-world-and-experience.md) and [22](22-dex-account-treasury-and-social-presence.md) own features, interactions and acceptance. [23](23-code-donors-and-integration-sources.md) supplies code sources; [24](24-animation-and-art-donor-catalog.md) supplies animation/art candidates. This chapter turns visual and interaction references into concrete production decisions. It adds no lore, gameplay economy, shared combat or new account feature.

The reference roles below are our design interpretations unless explicitly identified as statements from a creator. A commercial game can be a valuable visual reference without supplying reusable art or code. A public repo can supply code under its actual license without proving that all bundled media or its private backend are available. Imported sources never become instructions or implementation authorization.

## 1. How the source pack will be used

- **Code donor:** a named source file/pattern under a checked license, compatible with the installed stack after adaptation. No new scaffold replaces the current app by default.
- **Art/animation candidate:** exact creator page, free tier, license and stated clip inventory checked. Native archive, transparent pixels, pivots, scale and runtime behavior remain to be proved after go.
- **Design reference:** composition, pacing, hierarchy or motion to study. Its characters, levels, UI artwork, music and branding are not implicitly licensed assets for dex.place.
- **Project evidence:** the supplied scale images, existing selected CC0 player, actual current render/capture and Dex's criticism. This is the acceptance anchor; popularity of an external reference never overrides it.

Every source chosen after go gets an intake record: exact URL and creator, observed date, pinned revision/archive hash, license text, code/media scope, intended use, changes made, attribution, native-preview verdict and in-scene verdict. Keep original and adapted files separate. A free-looking page or a successful download is not an acceptance result.

## 2. Primary design reference bank

The source pages were read during this research. The game/talk descriptions below do not claim fresh complete playthroughs, listening sessions or full video review. User-supplied images in section3 were actually opened and visually inspected. Clip/screenshot review still belongs in the after-go comparison pass.

| ID / source | What the source establishes | Proposed lesson for dex.place | Boundary |
|---|---|---|---|
| REF-01 [Hollow Knight: Forgotten Crossroads, Team Cherry](https://www.teamcherry.com.au/blog/the-forgotten-crossroads-a-hollow-knight-tour) | Creator describes open interconnected tunnels, shortcuts, dangers and occasional friendly travelers | Draw and traverse a real room graph; services interrupt long quiet stretches; return shortcuts make exploration change the route | No copied Hallownest geometry, insect characters, dialogue, hand-drawn art or collectible gates |
| REF-02 [Introducing Hollow Knight, Team Cherry](https://www.teamcherry.com.au/blog/introducing-hollow-knight) | Creator describes traditional2D animation, a restrained early visual palette, varied places and inhabitants continuing their tasks | Strong silhouette, limited scene accents, small work gestures, readable enemy states | Early-development description is historical, not a universal recipe for the final game's rendering or a license |
| REF-03 [Journey, thatgamecompany](https://thatgamecompany.com/journey/) | Official premise combines a vast landscape, distant destination and chance encounters with companions | Make scale legible through ordinary human-sized cues; let a remote traveler become meaningful against emptiness; create a landmark to move toward | Our game stays side-view pixel art and independent progression, with the explicitly requested voice option |
| REF-04 [Eastward, Pixpil/Chucklefish](https://eastwardgame.com/) | Official page presents varied towns/camps/forests, a cast and a detailed material-themed promotional website | Cozy interiors can be warm, useful and furnished; repeated material/typography rules can connect a game to its website | Avoid dense-town population, cooking/quests/gacha, sales slogans and top-down perspective. These are not new features |
| REF-05 [Hyper Light Drifter, Heart Machine](https://www.heartmachine.com/) | Developer identifies the game and its ruined-world direction | Secondary study target for color masses, restrained luminous accents and small actors against large ruins | Palette/cluster reference only; no top-down layout, copied characters, music, blood or default neon saturation. Actual shot comparison remains pending |
| REF-06 [Bruno Simon's portfolio](https://bruno-simon.com/) and [Folio2025 source](https://github.com/brunosimon/folio-2025) | The site publishes controls/quality/respawn surfaces and links its MIT client source; server code is explicitly withheld | Play can lead naturally to useful content; inspect ordering of input, physics, view, interactions, visuals and audio rather than allowing unrelated handlers to compete | No Three.js/Rapier/car rewrite or imported biography/achievements/whispers. The repo does not supply our presence/voice backend |
| REF-07 [Celeste & TowerFall Physics, Maddy Makes Games](https://www.maddymakesgames.com/articles/celeste_and_towerfall_physics/index.html) | Author explains actors/solids, fractional movement remainders and moving-solid carry/push behavior | Use as a diagnostic model for platform edges, stairs and lifts: stable feet, explicit riding, correct pushing and deterministic recovery | Reason about our existing Phaser implementation; no unlicensed engine/code transplant or wholesale physics rewrite by analogy |
| REF-08 [Forgiveness Mechanics, Seth Coster / GDC2020](https://www.gdcvault.com/play/1026606/Forgiveness-Mechanics-Reading-Minds-for/) | Speaker's session describes input-tolerance techniques for responsive play | Preserve input buffering and coyote behavior where they express intent, while keeping damage and visible collision trustworthy | Talk listing/abstract reviewed, not a claimed watched recording; no borrowed magic frame counts or new assist features inferred |
| REF-09 [The12 principles of animation in video games, Jonathan Cooper](https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games) | Author discusses adapting anticipation, follow-through and other animation principles to game responsiveness | Separate readable anticipation/contact/recovery; allow secondary cable/paper motion after contact without prematurely removing the sword pose | Use concepts and authored donor clips, not copied book prose or one universal easing/animation speed |
| REF-10 [Designing Celeste, Maddy Thorson / GDC2017](https://www.gdcvault.com/play/1024307/Level-Design-Workshop-Designing-Celeste) | Official talk catalogue identifies room/stage layout, area-map arrangement and story integration | Study how a complete route is arranged and revised, alongside individual rooms | Catalogue/abstract checked; full talk review remains pending. Do not import precision-platformer difficulty or story systems |
| REF-11 [Machinarium, Amanita Design](https://amanita-design.net/games/machinarium.html) | Creator identifies the environmental robot adventure and official media | Reserve reference for service-object staging and readable physical actions | Page search text available but direct fetch failed during this run; no claim of inspected animation. No puzzle/quest/lore import or asset reuse |

These sources have different jobs. Hollow Knight supplies the adjacency/solitude reference, Journey the scale/social reference, Eastward the refuge/material reference, and the animation/physics sources the contact/control reference. Do not average their art styles into a collage.

## 3. Dex's supplied scale references

These three supplied images were opened locally again on2026-09-08. Original artist/license has not been established, so keep them as private composition references rather than redistributable source art. The intended lessons below are our visual observations.

| Reference | Observed relationship | Translation into a side-view pixel scene |
|---|---|---|
| [Submerged giant and diver](D:/Dex/Temp/User/codex-clipboard-d5f14e01-6d2d-4d93-880a-322c909aa453.png) | A tiny nearby human cue; an immense cropped form; successive dark structures disappear into haze | Use an oversized partial structure behind a readable small walkway, with several quieter depth planes. Shape must read before surface texture |
| [Standing figure and distant upright mass](D:/Dex/Temp/User/codex-clipboard-5f3619a3-8aa4-4ff2-b42b-69a5e8b58b10.png) | Ordinary figure and shoreline establish a stable scale; a clear distant silhouette rises through a broad pale field | A tiny door, rail or traveler establishes scale before a huge vertical shaft/tower. Keep a clean silhouette and broad negative space |
| [Travelers below an enormous rounded form](D:/Dex/Temp/User/codex-clipboard-8abf2609-7175-4adf-82a7-22ae991610e3.png) | Human figures occupy a narrow ground band while one huge continuous form dominates the view | Allow a room's dominant shape to extend well beyond the camera. Avoid filling its empty surroundings with signs, equal-sized pillars and repeated props |

None requires copying a monster, changing the game's camera perspective or making the player unreadably small. Pixel art must express those relationships through silhouettes, value separation, repetition at believable scales and depth, not through photorealistic source textures pasted behind sprites.

## 4. Room-specific look and rhythm

This table refines21's proposed graph. Palette/light/decoration choices are starting art direction and remain tunable. The functional connections and exact content boundaries stay firm.

| Place | Dominant composition | Materials/light/movement | What to avoid |
|---|---|---|---|
| Arrival | Long quiet ground band, small traveler, one enormous cropped/distant landmark | Cool stone/metal, pale distance, a small restrained warm/red cue, slow distant movement | An opening full of controls, NPCs, particles and evenly spaced decorative pillars |
| Junction | Two visibly different route opportunities plus the arena's strongest sightline | Map hangs on a believable fixture; warm refuge doorway and upper route carry different silhouettes | A diagram that promises branches but routes everyone along one corridor |
| Hearth/counter | Compression after exposed travel; a protected human-sized pool of warmth | Wood/paper/aged metal, warm local lamp, one attendant and a few coordinated service gestures | A crowded tavern, repeated sales reminders or a white generic account card hovering over unrelated art |
| Treasury | A taller ordered interior with a ledger focal point and quiet perimeter | Related paper/metal language, deliberate illumination at the ledger, sparse donation box | Fake prosperity through invented names/counts, coins everywhere, reward-tier spectacle |
| Lookout | Open sky/water and a distant route/figure reveal | Wind-led small motion, reduced foreground detail, clean silhouette | Constant combat or fog so thick the next landing disappears |
| Reservoir | A distinct enormous volume, successive depth planes, a small useful crossing | Cool muted water/stone, separated haze, a few independent hanging/structural elements | Enlarging a small sprite until its pixels become boulders; a repeating train of platform modules |
| Gallery | Quiet arrival, generous space per work, a discernible beginning and return route | Neutral frames and light around the display; art itself stays ungraded/unpixelated | Personal illustrations in global fog/UI textures; opening the entire catalog when inspecting one piece |
| Archive | Door threshold reveals unexpected depth; layered shelving gives a sense of interior extent | Paper/cabinets, constrained light shafts, quiet service motion, clear reading surface | A locked-content puzzle, unreadable dark body text or paragraphs trapped in a tiny game popup |
| Dispatch/arena | Product identity at the threshold; clear duel ground against a low-noise backdrop | Boss silhouette/telegraph first, contact/impact second, atmosphere third | Busy enemy particles hiding attacks; generic monster pack collage; success overlays before the death beat |

Population is part of composition. Service pockets may contain one recognizable worker, while several intervening views contain none. A remote ghost may pass through that silence; do not manufacture a crowd to prove the feature exists. Room-specific enemy caps and spawn intervals are tuned in an actual walking/listening journey.

## 5. Production rules and visible rejection criteria

These are project design rules derived from Dex's constraints and the reference roles above. They are not claims that an external source mandates these exact implementation choices.

| Rule | Working instruction | Reject the result when |
|---|---|---|
| DR-01 Scale before detail | Compose the real player, ground band, dominant mass and route in a small thumbnail before decoration | Removing texture makes the scene read as a flat row of props rather than a large place |
| DR-02 Connected geography | Give rooms distinct entrances/exits, vertical choices and useful return connections; walk the whole loop early | Branches exist only in the map graphic or every destination is reached by continuing right |
| DR-03 Contrast creates scale | Place a sheltered, ordinary room before or after a large reveal; use a known-size door/rail/person | Every space has the same camera distance, vertical extent and prop density |
| DR-04 One foreground grid | Compare hero, terminal, floor, doorway and new actors at final play size; record source crop and effective pixel pitch | Assets look like different games or shimmer/chunk differently as the camera moves |
| DR-05 Distance has a role | Distant forms may use finer detail/pixels but quieter contrast; keep middle planes distinct | A background competes with the hero or the foreground looks pasted onto a photograph |
| DR-06 Flat usable structure | Author side-view floors, frames, supports and openings; keep collision and visible top edges registered | Platform perspective suggests a3D camera that never moves, joints form Lego seams, or the feet float |
| DR-07 Material light | Give lights a source and a local effect on world surfaces; keep haze planes separate and restrained | Glow is an arbitrary halo, fog hides interaction/landings, or the entire scene receives one flattening tint |
| DR-08 Sparse meaningful motion | Use one or two readable local motions amid slower distant movement; desynchronize natural idles | Every prop pulses on the same loop or particles become the main subject everywhere |
| DR-09 Physical contact | Bind action consequences to the actual hit/use event, then let follow-through and secondary parts settle | The sword vanishes before the cut, the wrong cable breaks, or the menu is the only evidence of contact |
| DR-10 Readable combat | Distinguish anticipation, active hit and recovery in pose/timing; authored collision windows follow the clip | Damage happens before a readable tell, the hit shape disagrees with the weapon, or effects hide the boss |
| DR-11 Reliable movement | Preserve responsive double jump/input tolerance; test stairs, edge landings, moving carry and knockback together | The player sticks on small risers, footsteps machine-gun, or a lift slowly separates from the feet |
| DR-12 Discoverable objects | Use placement, silhouette, proximity response and restrained contextual cues; keep full accessible names | Removing large labels makes objects impossible to distinguish, or all scenery falsely looks usable |
| DR-13 UI shares materials | Use a small family of frame, backing, edge, shadow and typography parts with real DOM text | Every interface is the same plain card, or every room has a different unrelated UI theme |
| DR-14 Reading has room | Use appropriate full web layouts and inner article scrolling; retain ordinary direct URLs | Long text is squeezed into gameplay framing or wheel/touch gestures unexpectedly change modes |
| DR-15 Bars serve composition | Tune bars per viewport without hiding feet, attacks or controls; release them naturally into web browsing | Bars simply reduce an already cramped viewport or become a mandatory slow scroll animation |
| DR-16 Entry transfers control | One deliberate Enter attempts chosen audio and acquires gameplay; reveal and controls share a known ready state | A second click is needed, the scene looks ready but ignores movement, or music starts as a sudden wall |
| DR-17 Typography stays readable | Pixel fonts carry short headings/labels; readable body/fallback fonts handle articles, names, Vietnamese and money | Small glyphs blur, long passages fatigue, names become missing-glyph boxes or QR/bank facts are stylized beyond recognition |
| DR-18 Ghosts feel present | Restrained tint, compatible world placement, real activity expiry and identifiable admitted speakers | Ghosts walk over local gaps, appear as opaque crowds, or inactive/blocked/incompatible people remain audible; ordinary camera-edge culling follows22's separate proximity rule |
| DR-19 Keep the musical identity | Retain selected SunoB; give arrival breath, coherent calm travel, purposeful arena contrast and reading quiet | New rooms switch to unrelated tracks or material sounds interrupt the emotional pacing |
| DR-20 Content remains factual | Let composition carry personality; register concise controls/status rather than importing donor-site copy | A template adds a role tagline, marketing pitch, invented lore or fake popularity to fill space |

For pixel comparison, record approximate source cluster size, cropped source bounds, drawn world size and the complete camera/canvas-to-CSS scale. Compare the resulting visible cluster size against the selected hero and adjacent material at normal play size. Do not rely on PNG dimensions or `image-rendering: pixelated` alone. Render snapping and texture sampling should be evaluated separately from physics precision; no blanket physics rewrite is justified by this rule.

Rules guide inspection, not asset-count padding or a rigid pixel-coordinate recipe. If a frame meets numbers but looks weak, change it and record why. If a proposal conflicts with a functional requirement, resolve the contract rather than ignoring it in code.

## 6. Motion and assembly recipes to prove after go

These are proposed animation anatomies, not generated sprite-sheet requests or claims that a donor already contains the required gesture. Fine timing is tuned using real clips and contact frames. REF-09 motivates the separation of anticipation/contact/follow-through; the actual components and event ownership below are our implementation design.

| Assembly | Independent parts | Intent → consequence → settled state |
|---|---|---|
| Cut map | Fixed support, fastening, attached cable segment, loose cable end, map body, bottom weight, shadow | Sword enters its active window → fastening severs at contact → loose cable drops and body unrolls under its weight → sword completes recovery while paper/weight settle → E inspection becomes available. Close leaves the cut open |
| Interior door | Frame, leaf/shutter, handle/indicator, interior darkness/light, threshold transition | Context use moves the door/indicator → doorway reveals a readable transition → target scene is ready → place the traveler at its authored entrance. Failure keeps a safe source-side state |
| Lift | Fixed guides/frame, platform, attached moving shoes, restrained wheels/cables, stop indicator | Summon changes local signal → platform travels on guides → exact carry/contact maintained → platform settles at a real floor height. Decorative belts cannot imply an unattached mechanism |
| Counter service | Actor idle/approved work clip, counter, independent record/book or service prop, UI backing | Approach gets a small orientation/gesture response → E chooses the service → the themed account/ledger surface opens with real focus. No invented dialogue or fake receipt |
| Boss | Authored body clips, separate intentional attack VFX, hit regions, death pieces/state, transition layer | Pose announces action → active contact window → recover; on actual defeat finish death beat → controlled black → correct product menu. No file is requested by the death event |
| Art inspector | Physical frame/backing/light, exact DOM image, separate UI frame/caption/controls | E binds one art ID → dedicated inspection emphasizes that work → close returns to the same bay. The collection folder is a separate catalog action |
| Scroll handoff | World viewport, independently sized bars, web layout, focus/input/audio owners | Native scroll signals departure → release gameplay/PTT and pause → bars open and full website enters view → ordinary content scrolling. Return restores position with deliberate Resume |

Keep animation events in the object's state owner, with idempotent contact and cancellation. A late callback cannot re-open a dismissed menu or reapply a cut. UI presentation timing does not get to corrupt combat completion; gameplay pause does not freeze a half-open DOM surface. Reduced motion preserves the same final physical/semantic result using a shorter transition.

## 7. Interface rules with authoritative behavior references

The decorative surface may look like paper, a hanging map, a ledger or a product record. Its controls remain semantic HTML with real labels, focus and data. Use the existing accessible primitives and scoped23 references rather than reproducing semantics inside a canvas.

- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): use appropriate initial focus, bounded modal focus, a real close action and sensible focus return. Nearby/person popovers follow22's lightweight rules instead of falsely making the whole world modal.
- [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): bars, sticky navigation, paper edges and scroll containers must not cover the focused control. Inspect at real browser zoom, not only enlarged CSS.
- [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): the criterion uses24×24 CSS pixels with defined exceptions. Our proposed comfortable touch-control footprint is larger, around44–48 CSS pixels where space permits; do not mislabel44 as that criterion's minimum.
- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal text generally needs4.5:1 and large text3:1 under the criterion. Measure actual text over its rendered material, not a flat palette swatch behind a translucent texture.

Pixel-font selection in24 is conditional on real glyph coverage and license. Keep Daniel for `dex`, choose one short-label pixel family after comparison, and keep a readable text family/fallback for long documents and account names. Test the actual strings `Downloads`, `dex account`, `THIEU GIA MINH`, `100,000 VND`, a Vietnamese name with accents, an error message and a long article. No font choice is accepted because its specimen alone looks good.

## 8. Short production comparison plan

After go, acquire the exact selected code/art sources and retain licenses/hashes. Then make small labeled comparisons inside the actual game and DOM stack:

1. **Actor strip at play size:** current hero beside the strongest boss, mob and townsfolk candidates; idle, locomotion, attack/hit/death or service clip as supplied. Check native silhouette/pivots, feet, outline and pixel pitch. Reject incompatible bodies before scene expansion.
2. **Material junction:** real floor segment/corner, doorframe, map fixture, actor and one background mass. Compare native-pixel and any authorized controlled post-pixelation source at equal world size. Never pixelate UI, artwork or QR.
3. **Two contrasting rooms:** the hearth and the reservoir, connected through a working transition. Check that they feel like one world with different scale/temperature, including Low and narrow-screen versions.
4. **One complete physical action:** sword contact, map cable drop, settling, E map inspection and close. Judge the whole sequence at normal speed and frame-stepped contact; no standalone GIF-only sign-off.
5. **One game-to-web route:** entry sound/focus, boss death/black/product menu, explicit file download, scroll and return. Include keyboard/touch and text zoom early, not after the artwork is frozen.
6. **Social resting place:** two actual clients share an otherwise quiet room, with nearby voice and activity expiry. Judge whether the visitor encounter adds atmosphere without creating constant HUD noise.

These comparisons inform the full21/22 implementation. They do not replace completing every room, registered control and real service. Capture accepted and rejected alternatives with a short reason, actual revision and next correction; do not create an endless mood-board phase after go.

## 9. Sound-material sources alongside the selected music

Keep selected SunoB and the source/rights/export records in12 and the private audio production root. A new donor pack is raw material for an identified weak effect, not a reason to replace the musical identity. These official pages were checked; no new audio was downloaded or auditioned in this research.

| Source | Verified page facts / existing project evidence | Proposed use and actual next proof |
|---|---|---|
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) |130 files, free, CC0. The current project's `audio/foley-candidates/PROPOSAL.md` and `audio/recorded-steps-v1/README.md` already document its concrete-footstep originals, licence and runtime derivatives | Start with the owned source and compare actual step/contact timing. Fix cadence, attachment and mix before assuming another sample pack solves weak footsteps. Inspect/replace only the identified material mismatch |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) |100 files, free, CC0 | Candidate restrained click/service/confirmation texture. Do not attach a generic beep to every action or use UI sound as substitute for a cable/door physically moving. Archive and listening review still pending |
| [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) |50 files, free, CC0; official tags include foley, footsteps and weapons | Reserve physical contact/weapon comparison. Exact clip names, recording quality and fit are unverified until intake/listening; the label RPG does not imply cinematic suitability |

SFX timing is bound to meaningful contact/settlement states, with stable material gain and a listening pass under the actual theme/voice mix. Preserve variation that sounds natural; avoid uncontrolled pitch/gain randomization or a footstep on every collision tick. Quiet rooms should have fewer and softer events, not merely a quieter copy of the arena mix. New capture/generation or provider spend remains after-go work with the existing budget boundary.

## 10. Source and review status

- Current project sources and the three supplied scale images were read/inspected. Original game reference pages, creator articles, official talk descriptions and W3C pages were checked; a description alone is not a watched video or played scene.
- Creator preview observations and exact candidate licenses/free tiers are in24; archive completeness and runtime animation fit remain unverified until intake.
- Code licenses and installed/upstream version differences are in23. A source example is not a verified installed integration or a reason to upgrade the whole stack.
- Current SunoB/source provenance and authored Martial Hero remain the selected local materials. No new soundtrack, provider generation, repo clone, package install, asset acquisition or website implementation was performed by this reference-writing turn.
- Some source fetches failed or returned only a small image/link. Those are explicitly marked; do not treat a resolved image URL as proof that its animation was inspected. No remote media was downloaded to work around a preview limitation.
- Any public documentation release must include23–25 through an updated allowlist/privacy transform. Private local reference paths and unlicensed reference imagery must not be copied into the public ZIP. Published edition1.0 remains immutable; the next go owns the new public edition.
