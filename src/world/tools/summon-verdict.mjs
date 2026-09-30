// WORLD-PLAN: arena framing while summoning; RUNTIME: forming -> held,
// then cooldown/spent and the honest interim panel. Assess every profile
// and scheduled snapshot so a phase filter cannot make missing work pass.
export const SUMMON_TIMES = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 3.2, 4.4, 5.4, 7];
export const SUMMON_PROFILES = ["1080p", "1440p", "phone"];

export function assessSummon(raw) {
  const failures = [], profiles = [];
  const need = (ok, message) => { if (!ok) failures.push(message); };
  const five = (a, type) => Array.isArray(a) && a.length === 5 && a.every((v) => typeof v === type);
  const desktop = Array.isArray(raw?.frames) ? raw.frames : [];
  need(Array.isArray(raw?.frames) && raw.frames.length === SUMMON_TIMES.length && raw.frames.every((f, i) => f.at === SUMMON_TIMES[i]), "summon: complete ordered 1080p snapshot inventory required");
  for (const profile of SUMMON_PROFILES) {
    need(raw?.[`woke-${profile}`] === "woken", `summon ${profile}: terminal must wake`);
    for (const kind of ["errors", "bad"]) need(Array.isArray(raw?.[`${kind}-${profile}`]) && raw[`${kind}-${profile}`].length === 0, `summon ${profile}: ${kind} must be recorded and empty`);
    let previous = null;
    let forming = 0, held = 0, cooldown = 0;
    for (const at of SUMMON_TIMES) {
      const f = profile === "1080p" ? desktop.find((r) => r.at === at) : raw?.[`${profile}-${at}`];
      if (!f) { need(false, `summon ${profile}: missing snapshot ${at}s`); continue; }
      const where = `summon ${profile} at ${at}s`;
      const lightsValid = five(f.lit, "number") && f.lit.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
      need(lightsValid, `${where}: five finite seal levels required`);
      need(five(f.inView, "boolean"), `${where}: five framing observations required`);
      need(Number.isFinite(f.closeup) && f.closeup < 0.02, `${where}: summon/interim must not use a player close-up`);
      if (at <= 2.4) {
        // At the 2.4-second transition boundary either adjacent state is
        // legitimate; both still require the complete visible seal ring.
        const isForming = f.terminal === "summoning" && f.seals === "forming";
        const boundaryHeld = at === 2.4 && f.terminal === "summoned" && f.seals === "held";
        need(isForming || boundaryHeld, `${where}: expected forming (or held at transition)`);
        need(f.panel === null, `${where}: interim panel must not interrupt forming`);
        need(five(f.inView, "boolean") && f.inView.every(Boolean), `${where}: active seal ring clipped`);
        if (isForming) forming++; else if (boundaryHeld) held++;
        if (lightsValid) {
          need(f.lit.every((v, k) => k === 0 || f.lit[k - 1] >= v), `${where}: seals must light in order`);
          if (previous?.lit) need(f.lit.every((v, k) => v >= previous.lit[k]), `${where}: forming light sequence regressed`);
          // The driver advances fixed 60 Hz steps. Seals start 0.4 s apart,
          // rise over 0.3 s, and quantize to quarters: at these scheduled
          // boundaries the next seal still rounds to zero. Require each
          // intermediate count so an early all-at-once flash cannot pass.
          const expectedLit = Math.min(5, Math.round(at / 0.4));
          need(f.lit.filter((v) => v > 0).length === expectedLit, `${where}: expected ${expectedLit} sequentially lit seals`);
          if (at >= 2) need(f.lit.every((v) => v === 1), `${where}: formation must finish before the hold`);
        }
      } else if (at <= 4.4) {
        held++;
        need(f.terminal === "summoned" && f.seals === "held", `${where}: held seal phase required`);
        need(f.panel === null, `${where}: interim panel must not interrupt the hold`);
        need(five(f.inView, "boolean") && f.inView.every(Boolean), `${where}: held seal ring clipped`);
        need(lightsValid && f.lit.every((v) => v === 1), `${where}: all five held seals must remain lit`);
      } else {
        cooldown++;
        // Framing now returns to the traveller/terminal panel; spent rings
        // may leave the exploration view. Their phase and fade still count.
        need(f.terminal === "cooldown" && f.seals === "spent", `${where}: cooldown/spent transition required`);
        need(f.panel === "summoned", `${where}: honest interim panel required`);
        need(Array.isArray(f.view) && f.view.length === 2 && f.view.every(Number.isFinite) && Number.isFinite(f.playerX) && f.playerX >= f.view[0] && f.playerX <= f.view[1], `${where}: released view must include the traveller`);
        if (lightsValid) {
          need(f.lit.every((v) => v < 1), `${where}: spent seals must fade`);
          if (at === 7 && previous?.lit) need(f.lit.every((v, k) => v < previous.lit[k]), `${where}: cooldown fade must progress`);
        }
      }
      previous = lightsValid ? f : null;
    }
    need(forming >= 5 && held >= 2 && cooldown === 2, `summon ${profile}: all required named phases must be observed`);
    profiles.push({ profile, forming, held, cooldown });
  }
  return { passed: failures.length === 0, failures, profiles, snapshots: SUMMON_TIMES.length * SUMMON_PROFILES.length };
}
