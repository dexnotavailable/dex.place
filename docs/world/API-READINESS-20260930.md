# Story API rebuild probe readiness

`WorldApi.rebuild(id)` releases an already-built non-current room so the next
entry can build fresh data through story hooks. It returns true only when that
room was released. The current room, unknown rooms and unbuilt rooms are refused.
This is the existing `hooks.ts` contract and `game.ts` implementation.

`RoomStream` keeps rooms within `STREAM.keepDepth` warm. A1's declared neighbours
are A0 and A2. `game.frame()` calls `warmOne()` during calm wall-clock frames, at
most once per half second, with no transition or loading. The manual test hook's
`advance()` only runs simulation ticks and renders; it does not call `frame()`.

The old API fixture advanced repeatedly inside one synchronous page evaluation,
then selected any already-built neighbour. The saved native D3D11 run at
`afda9fa6ab394853a280d8813720fff759def9b6` had only A1 built, selected no
neighbour, and failed its rebuild boundary. Its valid-positive case was never
exercised. The current/unknown refusal, rest persistence and seven actor feeds
were separate successful observations. This does not demonstrate product refusal
of a valid built neighbour; the original failed verdict remains unchanged.

The corrected fixture requires A1 to settle, chooses a defined distinct declared
neighbour, then yields for up to 30 seconds for that specific room to become
built. It observes actual frame scheduling; it never forces stream warming,
building or target entry. It records readiness diagnostics, the target and built
state, then captures `builtBefore=true`, `rebuild=true`, `builtAfter=false` in one
evaluation to avoid a rewarming race. Current/unknown refusals and all existing
save/actor checks remain required. Missing target, failed settle, timeout, lost
readiness or an unexercised positive case fail explicitly; undefined is never
passed to the positive API call.

Portable adapter controls establish the fixture protocol only. A fresh bounded
native API run, owned by sole delivery, is still required to establish the actual
positive result. Runtime, API, stream, room graph, authored UI and assets are
unchanged by this fixture correction.
