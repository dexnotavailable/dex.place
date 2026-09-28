# V2 focused UI completion

2026-09-08. Assigned UI work is complete and handed back for root preview/staging integration. The UI source is frozen at `source-handoff.json`; no service/game/public-content or hosting edits were made in this lane. Chapter26 contains the decisions and evidence boundary.

## Implemented

- Scrolling Illustrations unmounts offscreen images while preserving the last measured content height. The942px gallery slot,6504px document and5366px footer position were unchanged on withdrawal; no further art requests started. No hidden art element or prefetch was introduced.
- Added mobile Dash; six game controls use a two-by-two action group in narrow layouts, selected44–62px sizing with narrow viewport limits, and a separate central hold-to-talk position. Left-handed ordering remains available. Social/control tap targets are at least44px in coarse-pointer layouts.
- System Menu retains its original game/web context. Settings/Controls/Restart close back to Menu; closing a game-opened Menu resumes its input owner, while web-opened settings restores its actual opener. Menu Map only exists after the physical cut; there is no quick travel.
- Enter/Resume stays Loading during saved-room hydration. The gameplay-owned prepared phase permits paused resumption after resources finish. Post-entry renderer loss clears stale passage/blackout/prompt state and offers explicit Retry world plus Website; the recreated world still needs deliberate Resume.
- Physical inspection close/browse/history dismissal calls close-inspection. Browser Back/Forward between versions of the same active victory product retains that visit; returning to game ends it and history cannot recreate it.
- Unknown root/account/donation paths get an honest Page unavailable state. Invalid encoded art/product IDs stay with their existing owning error views. Deep links/history position content immediately, without a long animated scroll through unrelated sections.
- DOM button/link focus blocks gameplay J/Space movement/attack leakage. Sound completion reads the actual manager state, fixing a late enable callback that incorrectly re-lit the icon after mute. Product unavailable/status and stale checksum callbacks are bounded to the current file.
- VoiceController and VoicePanel load together with a caught failure. Native reproduction established that the failed module import persisted in the document; explicit Reload page now replaces the ineffective retry loop. It is user-triggered and warns of an arena restart when relevant. No automatic microphone request is added.

## Proof

| Receipt | Result | Scope |
|---|---|---|
| `proof.json` |18/18, no errors/source drift | Actual App desktop,390×844 portrait and844×390 landscape in true coarse-pointer browser contexts. Gallery withdrawal, Menu/focus, art Next/Previous/Escape, direct article, touch Dash/Large layout, voice controls and explicit WebGL loss/retry |
| `victory-history-proof.json` |13/13, no errors/source drift | Actual prior native browser storage, saved-room request delay, normal reload/UI/E/keyboard, explicitly assisted8HP authored victory, version/history ownership and no automatic downloads |
| `edge-proof.json` |13/13, no errors/source drift; exact final UI/game source matches | Unknown/encoded routes, no hidden art requests, prepared Resume with a delayed real room image, DOM keyboard ownership, Sound cancellation and VoicePanel module failure/reload recovery |
| `unavailable-product-proof.json` |pass | Explicit private unavailable-record override of the real ProductRecord component; native click gives no href/download/status. Public records unchanged |

Final `npx tsc --noEmit` passes. The React best-practices review covered lifecycle cleanup, refs for current async/event ownership, conditional media loading, real DOM semantics and source-scoped failure feedback. No unrelated framework/dependency refactor was added.

Representative inspected images: `desktop-gallery.png`, `desktop-reader.png`, `phone-touch-large.png`, `landscape-touch-large.png`, `phone-voice-controls.png`, `landscape-voice-controls.png`, `renderer-retry.png`, `saved-room-loading.png`, `victory-version-history.png`, `prepared-resume.png`. Art remains the unchanged gallery display source; no world material was generated or edited here.

## Failed attempts retained

- First assisted-history attempts failed before world creation because Vite served a stale assemblies export after a separate gameplay patch. The gameplay/root lanes diagnosed it and refreshed the dev server. An unrelated first test assertion also looked for assistance in a snapshot field that does not expose it; the corrected native UI/storage assertion was used for the completed run.
- The first encoded-ID check sampled during animated deep-link scrolling. The focused diagnostic showed the owning unavailable state and no art fetch; immediate deep-link/history positioning removed the unnecessary transit.
- The actual Sound icon/manager mismatch and failed same-document VoicePanel retry were reproduced, fixed, and passed in the final edge receipt. Earlier failure receipts remain separate.
- Early unavailable-component harness setup lacked Vite's React preamble/default ReactDOM import, and its first data mutation targeted a different cached module instance. Only the final explicit unavailable-response fixture is counted as a pass.

These44 scoped actual-App assertions plus the one component fixture do not replace the full final regression. The victory was assisted; device contexts are emulated; no real joined microphone, account, clipboard, payment or public deployment was exercised. Root's V2WorldPreview component remains unmounted by this lane, and its canvas markup was left intact for that integration. Preview/source exports should follow root's final visual freeze.
