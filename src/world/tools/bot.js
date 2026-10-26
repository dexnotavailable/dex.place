// In-page walker for the round (loaded by round.mjs into /world/?manual).
// It plays through the real game: real input actions (left, right, jump, m1),
// real E (use), real transitions, rides and panels; it only decides when to
// press what. Each call runs up to `budget` simulation ticks and returns
// { done } or { wait } (a room's shaders are still compiling: the node side
// waits in real time, so honest loading never inflates the measured times).
//
// Positions are world H (the plan's coordinates, from each room's origin).
/* global window */
(() => {
  const W = () => window.__world;
  const G = () => window.__world.game;
  const H = 80;
  const held = new Set();
  // the game releases every key while it holds the controls (a door, a ride, a panel), so a
  // key the walker still wants is pressed again whenever the game no longer has it down
  const press = (a) => {
    if (!held.has(a) || !G().input.isDown(a)) W().press(a);
    held.add(a);
  };
  const release = (a) => {
    if (held.has(a)) {
      W().release(a);
      held.delete(a);
    }
  };
  const releaseAll = () => {
    for (const a of [...held]) release(a);
  };
  const st = () => {
    const g = G();
    const b = g.player.body;
    const o = g.room.def.origin ?? [0, 0];
    return { room: g.room.def.id, x: o[0] + b.x / H, y: o[1] - b.y / H, px: b.x, py: b.y, grounded: b.grounded, trans: !!g.trans, loading: g.loading };
  };
  /** Room px for a world x in the current room. */
  const rx = (wx) => (wx - (G().room.def.origin ?? [0, 0])[0]) * H;
  const ready = () => {
    const g = G();
    const bd = g.room.backdrop;
    return !bd || bd.ready();
  };
  let jumpT = 0;
  /** Every jump the walker made: where it left the ground, why, how far the gap was, where it landed (world H). */
  const jumps = [];
  let open = null;
  let lastX = null;
  let stuck = 0;
  const tick = () => {
    G().realTick();
    if (jumpT > 0 && --jumpT === 0) release("jump");
    if (open && G().player.body.grounded && open.t++ > 4) {
      const s = st();
      open.to = { x: +s.x.toFixed(2), y: +s.y.toFixed(2) };
      open.rise = +(s.y - open.from.y).toFixed(2);
      jumps.push(open);
      open = null;
    }
  };
  const jump = (ticks = 16, why = "blocked", gap = null) => {
    release("jump");
    press("jump");
    jumpT = ticks;
    const s = st();
    open = { room: s.room, why, gap, from: { x: +s.x.toFixed(2), y: +s.y.toFixed(2) }, t: 0 };
  };
  /** Width of the gap ahead (H): from the edge to where ground at about this height resumes. */
  const gapAhead = (dir) => {
    const g = G();
    const b = g.player.body;
    const col = g.room.collision;
    let edge = null;
    for (let d = 0; d < H * 4; d += 2) {
      const x = b.x + dir * d;
      const gy = col.groundAt(x, b.y - H * 0.95);
      const near = Math.abs(gy - b.y) <= H * 0.95;
      if (edge === null && !near) edge = d;
      if (edge !== null && near) return +((d - edge) / H).toFixed(2);
    }
    return null;
  };
  /** Transition in progress while the next room compiles: wait in real time. */
  const blockedByLoading = () => {
    const g = G();
    return !!g.trans && !ready();
  };

  const bot = {
    st,
    jumps: () => jumps,
    releaseAll,
    /**
     * Walk toward world x until crossing it (or the room changes). Jumps when
     * blocked or when the ground ahead drops away more than 0.55 H.
     */
    walk(targetX, budget = 900, o = {}) {
      const s0 = st();
      const room = s0.room;
      const dir = targetX >= s0.x ? 1 : -1;
      const side = dir > 0 ? "right" : "left";
      release(dir > 0 ? "left" : "right");
      for (let i = 0; i < budget; i++) {
        if (blockedByLoading()) return { wait: true };
        const s = st();
        if (s.room !== room && !s.trans) {
          releaseAll();
          return { done: true, room: s.room };
        }
        if (s.trans) {
          tick();
          continue;
        }
        if ((dir > 0 && s.x >= targetX) || (dir < 0 && s.x <= targetX)) {
          release(side);
          return { done: true, room: s.room };
        }
        press(side);
        const g = G();
        const b = g.player.body;
        if (b.grounded && jumpT === 0 && !o.noJump) {
          const col = g.room.collision;
          const ahead = b.x + dir * H * 0.5;
          const edge = b.x + dir * H * 0.22;
          // the first surface at or below a step-up above the feet: a stair going up is not a gap
          const gy = col.groundAt(edge, b.y - H * 0.3);
          const drop = gy - b.y;
          const edgeOpen = col.isOpen(dir > 0 ? "right" : "left", b.y) && (ahead < 0 || ahead > g.room.def.w);
          const inWater = (g.room.def.water ?? []).some((w) => ahead >= w.x0 && ahead <= w.x1);
          if (lastX !== null && Math.abs(b.x - lastX) < 0.2) stuck++;
          else stuck = 0;
          if (stuck > 3) {
            jump(18, "ledge");
            stuck = 0;
          } else if (drop > H * 0.55 && !edgeOpen && !inWater && !o.noGapJump) jump(18, "gap", gapAhead(dir));
        }
        lastX = b.x;
        tick();
      }
      return { done: false, budget: true, ...st() };
    },
    /** Hop onto a stair's treads (jump while walking). */
    hop(dir, budget = 60) {
      const side = dir > 0 ? "right" : "left";
      press(side);
      jump(14);
      for (let i = 0; i < budget; i++) {
        tick();
        if (i > 8 && G().player.body.grounded) break;
      }
      release(side);
      return { done: true, ...st() };
    },
    /** Swing (m1) facing dir. */
    slash(dir) {
      const side = dir > 0 ? "right" : "left";
      press(side);
      tick();
      release(side);
      press("m1");
      for (let i = 0; i < 4; i++) tick();
      release("m1");
      for (let i = 0; i < 40; i++) tick();
      return { done: true, ...st() };
    },
    /** E on the nearest usable thing. */
    use() {
      releaseAll();
      const near = G().state().near;
      W().use();
      tick();
      return { done: true, near };
    },
    closePanel() {
      const g = G();
      if (g.panels.open) g.panels.close();
      return { done: true };
    },
    /** Let time pass (rides, doors), waiting for loading honestly; stops early on a room change or when `until` says so. */
    wait(ticks, until, from) {
      // `from`: the room we are leaving (a call resumed after a loading pause keeps it)
      const room = from ?? st().room;
      for (let i = 0; i < ticks; i++) {
        if (blockedByLoading()) return { wait: true, left: ticks - i };
        tick();
        const s = st();
        if (until === "room" && s.room !== room && !s.trans) return { done: true, room: s.room };
        if (until === "idle" && !s.trans && !G().room.props.some((p) => p.moving)) {
          if (i > 10) return { done: true };
        }
        if (until === "panel" && G().panels.open) return { done: true, panel: G().panels.kind };
      }
      return { done: true, ...st() };
    },
  };
  window.__bot = bot;
})();
