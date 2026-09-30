import { test } from "node:test";
import assert from "node:assert/strict";
import { assessSummon, SUMMON_TIMES, SUMMON_PROFILES } from "./summon-verdict.mjs";

// A declared contract fixture, not a native measurement or golden runtime.
function contractFixture() {
  const raw = { frames: [] };
  for (const profile of SUMMON_PROFILES) {
    raw[`woke-${profile}`] = "woken"; raw[`errors-${profile}`] = []; raw[`bad-${profile}`] = [];
    for (const at of SUMMON_TIMES) {
      const cooldown = at > 4.4, held = at > 2.4 && !cooldown;
      const f = { at, terminal: cooldown ? "cooldown" : held ? "summoned" : "summoning", seals: cooldown ? "spent" : held ? "held" : "forming", panel: cooldown ? "summoned" : null,
        lit: cooldown ? Array(5).fill(at === 5.4 ? 0.75 : 0.25) : Array.from({ length: 5 }, (_, k) => held || k < Math.min(5, Math.round(at / 0.4)) ? 1 : 0),
        inView: cooldown ? [true, true, false, false, false] : Array(5).fill(true), closeup: 0, view: cooldown ? [252, 268] : [260, 276], playerX: 255.3 };
      if (profile === "1080p") raw.frames.push(f); else raw[`${profile}-${at}`] = f;
    }
  }
  return raw;
}
const frame = (r, p, at) => p === "1080p" ? r.frames.find((f) => f.at === at) : r[`${p}-${at}`];
test("complete declared phases accept released spent framing", () => assert.equal(assessSummon(contractFixture()).passed, true));
test("adjacent held state at the 2.4-second boundary is accepted", () => {
  const r = contractFixture();
  for (const p of SUMMON_PROFILES) { const f = frame(r, p, 2.4); f.terminal = "summoned"; f.seals = "held"; }
  assert.equal(assessSummon(r).passed, true);
});
const mutations = [
  ["clipped forming ring", (r) => { frame(r, "1080p", 1.2).inView[4] = false; }],
  ["clipped held phone ring", (r) => { frame(r, "phone", 4.4).inView[2] = false; }],
  ["collapsed formation", (r) => { for (const at of [0.8, 1.2, 1.6]) frame(r, "1440p", at).lit.fill(1); }],
  ["missing held snapshot", (r) => { r.frames = r.frames.filter((f) => f.at !== 3.2); }],
  ["missing phone profile", (r) => { for (const at of SUMMON_TIMES) delete r[`phone-${at}`]; }],
  ["early cooldown relabel cannot evade framing", (r) => { const f = frame(r, "1440p", 1.2); f.terminal = "cooldown"; f.seals = "spent"; f.inView = [false, false, false, false, false]; }],
  ["early panel interrupts forming", (r) => { frame(r, "1080p", 2).panel = "summoned"; }],
  ["held ring unlit", (r) => { frame(r, "phone", 3.2).lit[4] = 0; }],
  ["empty ring array", (r) => { frame(r, "1440p", 4.4).inView = []; }],
  ["missing cooldown panel", (r) => { frame(r, "phone", 5.4).panel = null; }],
  ["spent seals do not fade", (r) => { frame(r, "1080p", 7).lit = Array(5).fill(0.75); }],
  ["cooldown remains ring-focused", (r) => { frame(r, "1440p", 5.4).view = [260, 276]; }],
  ["player closeup hides ring", (r) => { frame(r, "phone", 1.2).closeup = 0.5; }],
  ["unknown phase pair", (r) => { frame(r, "1080p", 5.4).seals = "held"; }],
  ["recorded request error", (r) => { r["bad-phone"] = ["404 missing sprite"]; }],
];
for (const [name, mutate] of mutations) test(`reject ${name}`, () => { const r = contractFixture(); mutate(r); assert.equal(assessSummon(r).passed, false); });
