# Integrated v2 native-play checkpoint — 2026-09-08

Three native App runs used the actual5188 entry/UI, key events, pointer/wheel controls and read-only WorldScene snapshots. No route fixtures, game commands or player/save injection. The third run loaded the second run's actual saved browser storage through normal App startup. It correctly restored safe exploration instead of an active encounter.

- `integrated-app-v1`: entry held movement, wheel/Menu input release, held double jump, permanent slash-map and map reader, free Archive access, Archive→Treasury→Hearth→Junction loop, explicit product entry, ordinary boss damage/death and protected Dispatch retry.18 recorded assertions; the reader URL-only assertion was insufficient and its screenshot exposed unavailable content. The final helper timed out while the intentional retry dialog remained open. Earlier overly tight movement/tap-height expectations are retained as separate harness-error receipts.
- `integrated-app-v2`: native upper stairs/Lookout/Reservoir bridge, ordinary rat and bat kills, all9 individual artwork URLs with decoded visible images, full gallery return lift and Treasury→Archive.22 assertions passed. The article-content assertion was a false negative: it searched all specification prose for the word unavailable. The screenshot shows the corrected canonical reader actually rendered.
- `integrated-app-v3`:8 assertions passed, no errors, including actual normal guest reload, canonical1.1 article with `article.markdown` and no `.doc-unavailable` state, reader input stop, real UI Combat assistance,8HP authored boss, eight recovery hits through death, actual product page with zero downloads, and a fresh8HP encounter/new visit on next world entry.
- All three completed checkpoints recorded no before/after source-hash drift. Private browser state stays private and is not a release asset.

## Production changes and root fixes

This lane added `maximumBossHealth` to the combat event. Population initializes health and maximum from one8HP constant. Root updated current/legacy UI state and the dynamic meter. No audio events/timing changed.

Actual first-file defect: root's one-segment `/documentation/:slug` builder omitted project and version. Root now resolves the canonical current-edition document URL; v3 verifies the1.1 reader body. Root also added the user-reachable assistance control.

Root identified a separate E/Slash prompt presentation gate (`WorldAnnotations active` limited to Gallery). That fix was not yet part of these captures and must receive its own visible-prompt check. The native-key tests establish interaction behavior, not discoverability while that presentation bug exists.

## Directed-room coverage

All11 rooms were visited through native integrated play.13 of23 directed door links were exercised in these App runs, plus product entry to Arena and ordinary defeat recovery. Do not call that every directed door. Remaining directions for final regression: Junction→Arrival, Dispatch→Junction, Junction→Hearth, Hearth→Treasury, Lookout→Junction, Reservoir→Lookout, Gallery→Reservoir, Return shaft→Gallery, Treasury→Return shaft, Arena→Dispatch. Earlier private game/door fixture receipts cover some reverse directions, but do not substitute for integrated App coverage.

## Visible taste findings

The revised wooden arch doors, grounded columns and bounded warm pools are materially better. Counter resident now stands behind the counter; Treasury's large arch is visible and distinctive. Continuous floor material and small hero / large world scale remain coherent.

Remaining: landscape artworks are very thin strips inside identical tall world frames, although the full inspector displays them well; requested aspect-aware assemblies are the next gameplay task. Large M04 empty frames still appear as weakly motivated wall shapes, and some exterior monument bottoms terminate visibly in open air. These are composition work, not loading/physics claims.

Evidence images: v1 `03-junction-doors.png`, `07-treasury.png`, `08-counter.png`, `10-arena-normal.png`; v2 `04-gallery-entry.png`, `05-individual-artwork.png`, `07-return-lift.png`; v3 `08-fixed-article.png`, `09-assistance-setting.png`, `10-victory-product-page.png`.

No public publishing, real-device coverage, complete voice/session coverage, payment or new music listening approval is claimed.
