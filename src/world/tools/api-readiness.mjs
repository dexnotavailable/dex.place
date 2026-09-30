// Fixture protocol only: allow actual wall-clock frames to warm a declared
// neighbour. Never force stream.get/build/warmOne or teleport to the target.
const snapshot = (p) => p.ev(() => {
  const g = window.__world.game;
  return { room: g.room.def.id, neighbours: [...g.room.def.neighbours], known: g.roomIds(),
    built: g.room.def.neighbours.filter((id) => g.stream.rooms.get(id)?.built === true),
    warm: g.stream.status(), transitioning: !!g.trans, loading: g.loading,
    roomReady: !g.room.backdrop || g.room.backdrop.ready() };
});

export async function waitForWarmNeighbour(p, roomId, settled, { timeoutMs = 30000 } = {}) {
  const started = Date.now(), before = await snapshot(p);
  const target = before.neighbours.find((id) => typeof id === "string" && id.length > 0 && id !== roomId && before.known.includes(id)) ?? null;
  const result = { roomId, target, settled, timeoutMs, before, after: before, passed: false, timedOut: false, elapsedMs: 0, reason: null };
  if (!settled || before.room !== roomId) result.reason = "current room did not settle";
  else if (!target) result.reason = "no defined distinct declared neighbour";
  else {
    try {
      // Playwright polling yields to the real frame loop. Simulation advances
      // cannot run game.frame's wall-clock half-second warm scheduler.
      await p.page.waitForFunction(({ roomId, target }) => {
        const g = window.__world.game;
        return g.room.def.id === roomId && !g.trans && !g.loading &&
          (!g.room.backdrop || g.room.backdrop.ready()) &&
          g.room.def.neighbours.includes(target) && g.stream.rooms.get(target)?.built === true;
      }, { roomId, target }, { timeout: timeoutMs, polling: 100 });
    } catch (e) {
      if (e.name !== "TimeoutError") throw e;
      result.timedOut = true;
    }
    result.after = await snapshot(p);
    const a = result.after;
    result.passed = !result.timedOut && a.room === roomId && !a.transitioning && !a.loading && a.roomReady && a.neighbours.includes(target) && a.built.includes(target);
    if (!result.passed) result.reason = result.timedOut ? "specific neighbour readiness timed out" : "specific neighbour readiness changed";
  }
  result.elapsedMs = Date.now() - started;
  return result;
}

// Serialized into one page evaluation: do not yield between built-before,
// rebuild and built-after, as the frame scheduler could rewarm the room.
export function probeRebuildBoundary({ roomId, target, ready }) {
  const g = window.__world.game, api = g.api;
  const warm = g.stream.status(), currentRoom = g.room.def.id;
  const targetDeclared = typeof target === "string" && target.length > 0 && target !== currentRoom && g.room.def.neighbours.includes(target);
  const builtBefore = targetDeclared && g.stream.rooms.get(target)?.built === true;
  const positiveExercised = ready === true && currentRoom === roomId && builtBefore;
  const rebuildCurrent = api.rebuild(roomId);
  const rebuilt = positiveExercised ? api.rebuild(target) : null;
  const builtAfter = positiveExercised ? g.stream.rooms.get(target)?.built ?? null : null;
  const rebuildUnknown = api.rebuild("nowhere");
  return { warm, currentRoom, targetDeclared, builtBefore, positiveExercised, rebuildCurrent,
    rebuildNeighbour: [target, rebuilt, builtAfter], rebuildUnknown };
}

export function assessRebuildBoundary(raw) {
  const failures = [], r = raw?.warmReadiness, n = raw?.rebuildNeighbour;
  if (!(r?.passed === true && r.settled === true && r.roomId === "A1" && r.timedOut === false)) failures.push("api: specific warm-neighbour readiness not established");
  if (!(raw?.currentRoom === "A1" && raw.rebuildCurrent === false && raw.rebuildUnknown === false)) failures.push("api: current/unknown rebuild refusal failed");
  if (!(typeof r?.target === "string" && r.target.length > 0 && r.target !== "A1" && raw?.targetDeclared === true && raw.builtBefore === true && raw.positiveExercised === true && Array.isArray(n) && n.length === 3 && n[0] === r.target && n[1] === true && n[2] === false)) failures.push("api: built non-current neighbour must be positively released");
  return { passed: failures.length === 0, failures };
}
