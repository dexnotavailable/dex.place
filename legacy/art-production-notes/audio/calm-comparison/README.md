# Calm comparison v1 — unapproved

This implements Dex's new comparison direction using the **existing Support bed**, not a newly generated or artistically approved score. The previous five-cue soundtrack remains rejected. No generation, new model, provider spend or runtime audio-file replacement occurred.

[Play the 58.26-second comparison](calm-comparison-v1.mp3). It is actual manager output captured in an isolated audio-only browser fixture, with the same source files, default buses, fades and saved offsets. No narration, normalization or extra music was added. `recording.json` retains timing/source hashes; `recording-signal-checks.json` confirms nonzero audible sections, no clipping, and exact decoded silence in the checked art/reader windows. This is not a subjective listening pass or three-repeat seam review.

| Approximate recording time | State | Audible behavior |
|---|---|---|
| 00:00–00:10 | Arrival | Existing Support cue with restrained exterior ambience |
| 00:10–00:20 | Support | Same uninterrupted cue/position; interior ambience |
| 00:20–00:25 | Dispatch | Music source stopped; restrained interior ambience |
| 00:25–00:30 | Archive room | Music remains stopped; quieter interior ambience |
| 00:30–00:40 | Gallery room | Shared cue resumes its stored offset at 0.55 music multiplier |
| 00:40–00:45 | Viewing art | Music and ambience stopped |
| 00:45–00:50 | Reading | Backgrounds remain stopped |
| 00:50–00:58 | Return to Arrival | Shared cue resumes its stored offset |

Times are approximate MediaRecorder/control timestamps. The later transition-region addition is not a separate phase in this recording; its no-music/interior-ambience behavior is verified in the focused API receipt below.

## Runtime/API handoff

Owned changes: `src/worldsite/audio.ts` and new `src/worldsite/audio-direction.ts`. The existing `setScene`/`setGains`/gesture methods remain. `AudioRegion` adds `dispatch` and `transition`; `AudioContent` adds `art`. `audioRegionFor` recognizes connector labels before room names: transition, threshold, passage, gate, shaft and descent. The supplied `Dispatch passage`, `Archive descent`, `Exhibition lift shaft` and `Support descent` labels all resolve to transition; Exhibition resolves to gallery.

The resolver returns an explicit `music: null` for Dispatch, Archive, transition and the deferred arena score. Transition ambience is interior at 0.30 of the ambience bus. Reader/art return both `music: null` and `ambience: null`; existing action tails finish, while new effects are suppressed. No zero-filled audio file or unrelated music cue represents silence. Shared audible regions keep their existing source running; return from a quiet region restores its saved offset. User bus settings remain independent of direction multipliers.

Diagnostics add direction/status, content, planned music/ambience, quiet reason, music start time and current music position. They expose transport truth without changing it. The direction status is explicitly `comparison-unapproved`.

The root integrated `audioRegionFor` in both main bindings through one scene factory: logical route while a content panel is open, actual geography otherwise; reader and artwork detail get their quiet modes. This also works when Browse mode removes the renderer. No further main binding change is required by this handoff.

## Proof and boundaries

- `native-results.json`: 16 passing native checks, zero page errors. Same music start time across Arrival/Support/Gallery; measured Gallery bus gain 0.2475 (0.45×0.55); explicit quiet sources; saved-offset return; logical Browse mapping; only `support.opus` requested as music; one music buffer and 24,754,560 decoded cache bytes.
- `tail-transition-results.json`: five passing focused API checks. Exact connector labels route correctly; an existing paper tail survives reader entry; a new effect is suppressed; silence settles; transition has no music and measured ambience bus gain 0.12 (0.4×0.3).
- TypeScript passed after the resolver/API and transition changes. Browser-owned recordings/probes are closed.
- The public file/listening metadata was not marked approved. The old audio exports remain preserved. After this calm proof, the root separately authorized the [recorded foley trial](../recorded-steps-v1/README.md), now integrated through the same four IDs with versioned files and `comparison-unapproved` metadata. Its source/provenance and verification are separate from these earlier music checks. The root owns connected stairs, explicit ground materials and final event timing.
- [Combined context-loss proof](D:/Dex/Automation/Proofs/dex-place/20260906-build/remaining-failures/REPORT.md) separately verifies that actual WebGL restoration or Retry cannot reactivate input or audio. It does not approve soundtrack quality.
