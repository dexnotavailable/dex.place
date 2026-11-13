// Lane I1: the recorded first round against WORLD-PLAN section 10 (the pacing curve).
//   node src/world/story/_tools/pacing.mjs [--in review/world/phase2/I1/round.json]
//
// For each beat of section 10 it sets the plan's space (+5 vast .. -5 cozy), tension
// (0 serene .. 10 storm) and time beside what the game measured at that beat in the
// playtest (round.mjs): the time, and the room's state read from the running game.
// Measured space and tension are bands, not invented numbers:
//   space   cozy    an interior, a roofed area, or an underground room that is locked or
//                   fits one screen tall (its ceiling in view)
//           medium  a locked camera outdoors on a frame about one screen big (a porch, a
//                   stair), or a wider rail underground
//           vast    everything else outdoors (rail or free under the sky; the lift car)
//   tension storm   the arena awake, or rain 0.5+ on an open ledge (not roofed, not locked)
//           uneasy  overcast 0.3+ (mist, overcast), or rain seen from shelter / the lift car
//           calm    serene and after (the clearing), or otherwise quiet
// Plan bands: space >= +3 vast, -1..+2 medium, <= -2 cozy; tension >= 6 storm, 3..5
// uneasy, 0..2 calm. A beat "matches" when its measured band is the plan's band or next to
// it on the boundary (a plan value of exactly +2/-2 or 2/3 accepts either neighbour).
// Writes pacing.json and pacing.html (+ pacing.png via Playwright) next to the input.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const require = createRequire(new URL("../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const IN = arg("in", "review/world/phase2/I1/round.json");
const OUT = dirname(IN);
const r = JSON.parse(readFileSync(IN, "utf8"));

// section 10 of WORLD-PLAN.md: [beat, label, space, tension, time "m:ss", measured beat id]
const PLAN = [
  [1, "A1 Dock (arrival)", 5, 1, "0:00", 1],
  [2, "A2 Cliff Stair", 2, 1, "0:12", 2],
  [3, "A3 Keeper's Lodge", -4, 0, "0:20", 3],
  [4, "A4 Yard, shrine 1, map", 1, 1, "1:10", 4],
  [5, "B1 Reed Shallows", 4, 3, "1:35", 5],
  [6, "B2 Causeway", 5, 3, "2:05", 6],
  [7, "B3 Bus Shelter, shrine 2", -3, 2, "2:40", 7.1],
  [8, "B4 Stonetop (optional)", 5, 4, "2:50", null],
  [9, "B5 Hollow Mouth", 3, 4, "3:10", 9],
  [10, "C1 Foundry Market, shrine 3", 1, 2, "3:35", 10],
  [11, "C2 Archive", -5, 0, "4:10", 11],
  [12, "C3 Lift Foot", -2, 2, "5:10", 12],
  [13, "D1 Lift Ride", 4, 5, "5:30", 13],
  [14, "D2 Outer Climb", 3, 8, "5:50", 14],
  [15, "D2 Storm Alcove, shrine 4", -4, 4, "6:40", 15.1],
  [16, "D3 Crown (summoning)", 1, 10, "7:20", 16],
  [17, "D4 Blade (the storm breaks)", 5, 2, "8:20", 17.1],
  [18, "E1 Pilgrim Path", 4, 1, "8:40", 18],
  [19, "E1 Pilgrim Shrine, shrine 5", -1, 0, "9:05", 19],
  [20, "E2 Chapel Porch, shrine 6", -2, 0, "9:35", 20],
  [21, "E3 Chapel of Light", 1, 0, "9:50", 21],
  [22, "E4 Balcony", 5, 0, "12:50", 22.1],
  [23, "A3 Lodge loft (sky door)", -4, 0, "13:20", 23],
  [24, "A0 Pier's End (home)", 0, 0, "13:45", 24],
];
const mmss = (t) => { const r = Math.round(t); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };
const sec = (s) => { const [m, x] = s.split(":").map(Number); return m * 60 + x; };
const spaceBand = (v) => (v >= 3 ? "vast" : v <= -2 ? "cozy" : "medium");
const tensionBand = (v) => (v >= 6 ? "storm" : v >= 3 ? "uneasy" : "calm");
const SB = ["cozy", "medium", "vast"], TB = ["calm", "uneasy", "storm"];
function ok(bands, plan, band, measured, edges) {
  if (band === measured) return true;
  // a plan value on a band's edge accepts the neighbour on that side
  return edges.some(([v, a, b]) => plan === v && ((band === a && measured === b) || (band === b && measured === a)));
}
function measuredSpace(b) {
  if (b.interior || b.roofed) return "cozy";
  // underground, a room that fits one screen shows its ceiling
  if (b.underground) return b.camera === "locked" || b.screens[1] <= 1 ? "cozy" : "medium";
  // a locked frame outdoors that fits about one screen (a porch, a stair); the lift car's
  // locked camera rides a shaft 13 screens tall under the open storm, so it stays vast
  if (b.camera === "locked" && b.screens[0] <= 1.2 && b.screens[1] <= 1.2) return "medium";
  return "vast";
}
function measuredTension(b) {
  if (b.arena) return "storm";
  const w = b.weather;
  // section 8: "after" is the clearing and the calm after the storm (its thin cloud is dusk, not unease)
  if (w.label === "after" || w.label === "serene") return "calm";
  if (w.rain >= 0.5 && !b.roofed && b.camera !== "locked" && !b.interior) return "storm";
  if (w.rain >= 0.5 || w.overcast >= 0.3) return "uneasy";
  return "calm";
}
const rows = PLAN.map(([n, label, space, tension, time, id]) => {
  const b = id === null ? null : r.beats.find((q) => q.n === id);
  if (!b) return { n, label, plan: { space, tension, t: sec(time) }, measured: null, note: "not walked (optional)" };
  const ms = measuredSpace(b), mt = measuredTension(b);
  const sOk = ok(SB, space, spaceBand(space), ms, [[2, "medium", "vast"], [-2, "cozy", "medium"]]);
  const tOk = ok(TB, tension, tensionBand(tension), mt, [[2, "calm", "uneasy"], [3, "calm", "uneasy"], [5, "uneasy", "storm"], [6, "uneasy", "storm"]]);
  return {
    n, label,
    plan: { space, tension, t: sec(time), spaceBand: spaceBand(space), tensionBand: tensionBand(tension) },
    measured: { t: b.t, stops: b.stops, room: b.room, area: b.area, camera: b.camera, interior: b.interior, roofed: b.roofed, underground: b.underground, weather: b.weather, music: b.music, arena: b.arena, space: ms, tension: mt },
    spaceOk: sOk, tensionOk: tOk,
  };
});
const walked = rows.filter((x) => x.measured);
const end = walked[walked.length - 1];
// the time shape: each beat's share of the round, plan vs measured
for (const x of walked) {
  x.planShare = +(x.plan.t / end.plan.t).toFixed(3);
  x.measuredShare = +(x.measured.t / end.measured.t).toFixed(3);
}
// vast / cozy alternation: gaps between the cozy beats, in measured minutes
const cozy = walked.filter((x) => x.measured.space === "cozy").map((x) => x.measured.t);
const gaps = cozy.slice(1).map((t, i) => +((t - cozy[i]) / 60).toFixed(2));
// the tension curve: one rise, one peak at the Crown, the drop at the Blade
const order = walked.map((x) => TB.indexOf(x.measured.tension));
const peakAt = walked.filter((x) => x.measured.tension === "storm").map((x) => x.n);
const firstStorm = order.indexOf(2), lastStorm = order.lastIndexOf(2);
// one rise: the storm beats are one run (the alcove, a breather, may sit inside it as uneasy),
// and everything after the last storm beat is calm
const singleRise = firstStorm >= 0 && order.slice(firstStorm, lastStorm + 1).every((v) => v >= 1) && order.slice(lastStorm + 1).every((v) => v === 0);
const summary = {
  beats: rows.length,
  walked: walked.length,
  spaceMatches: walked.filter((x) => x.spaceOk).length,
  tensionMatches: walked.filter((x) => x.tensionOk).length,
  mismatches: walked.filter((x) => !x.spaceOk || !x.tensionOk).map((x) => ({ n: x.n, label: x.label, plan: [x.plan.spaceBand, x.plan.tensionBand], measured: [x.measured.space, x.measured.tension] })),
  firstRound: { measured: r.first.time, stops: r.first.stops, movement: +(r.first.time - r.first.stops).toFixed(1), planWithStops: end.plan.t, planMovement: 390 },
  timeShapeMaxDiff: Math.max(...walked.map((x) => Math.abs(x.planShare - x.measuredShare))).toFixed(3),
  cozyGapsMinutes: gaps,
  stormBeats: peakAt,
  tensionOneRiseThenDrop: singleRise,
  blade: walked.find((x) => x.n === 17)?.measured.tension,
};
writeFileSync(`${OUT}/pacing.json`, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));

// ---- the chart: two panels on one time axis (never two y-axes), plan vs measured ----------
const W = 1100, PH = 220, L = 64, R = 24, T = 64, GAP = 64;
const tMax = Math.ceil(Math.max(end.plan.t, end.measured.t) / 60) * 60;
const x = (t) => L + ((W - L - R) * t) / tMax;
const bandY = (panel, i) => T + panel * (PH + GAP) + PH - (PH * (i + 0.5)) / 3;
const valY = (panel, v, lo, hi) => T + panel * (PH + GAP) + PH - (PH * (v - lo)) / (hi - lo);
const planS = (v) => valY(0, v, -5.5, 5.5), planT = (v) => valY(1, v, -0.5, 10.5);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
let svg = "";
for (const p of [0, 1]) {
  const y0 = T + p * (PH + GAP);
  const bands = p === 0 ? SB : TB;
  // recessive band guides
  for (let i = 0; i < 3; i++) {
    const yb = y0 + (PH * (2 - i)) / 3;
    svg += `<rect x="${L}" y="${yb}" width="${W - L - R}" height="${PH / 3}" fill="${i % 2 ? "var(--band)" : "none"}"/>`;
    svg += `<text x="${L - 8}" y="${yb + PH / 6 + 4}" text-anchor="end" class="ax">${bands[i]}</text>`;
  }
  svg += `<line x1="${L}" y1="${y0 + PH}" x2="${W - R}" y2="${y0 + PH}" class="base"/>`;
  for (let m = 0; m <= tMax / 60; m++) svg += `<text x="${x(m * 60)}" y="${y0 + PH + 16}" text-anchor="middle" class="ax">${m}:00</text>`;
  svg += `<text x="${L}" y="${y0 - 12}" class="title">${p === 0 ? "Space: vast (top) to cozy (bottom)" : "Tension: calm (bottom) to storm (top)"}</text>`;
  // plan line at the plan's times (its own values, scaled into the bands)
  const pts = rows.map((q) => [x(q.plan.t), p === 0 ? planS(q.plan.space) : planT(q.plan.tension)]);
  svg += `<polyline points="${pts.map((q) => q.join(",")).join(" ")}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>`;
  rows.forEach((q, i) => {
    svg += `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"><title>Plan ${q.n} ${esc(q.label)}: ${p === 0 ? `space ${q.plan.space}` : `tension ${q.plan.tension}`} at ${Math.floor(q.plan.t / 60)}:${String(q.plan.t % 60).padStart(2, "0")}</title></circle>`;
  });
  // measured bands at the measured times
  const mp = walked.map((q) => [x(q.measured.t), bandY(p, (p === 0 ? SB : TB).indexOf(p === 0 ? q.measured.space : q.measured.tension))]);
  svg += `<polyline points="${mp.map((q) => q.join(",")).join(" ")}" fill="none" stroke="var(--s2)" stroke-width="2" stroke-linejoin="round"/>`;
  walked.forEach((q, i) => {
    const good = p === 0 ? q.spaceOk : q.tensionOk;
    svg += `<rect x="${mp[i][0] - 5}" y="${mp[i][1] - 5}" width="10" height="10" rx="2" fill="${good ? "var(--s2)" : "var(--surface)"}" stroke="var(--s2)" stroke-width="2"><title>Measured ${q.n} ${esc(q.label)}: ${p === 0 ? q.measured.space : q.measured.tension} at ${mmss(q.measured.t)} (${q.measured.room}${q.measured.area ? "/" + q.measured.area : ""})${good ? "" : " - differs from the plan"}</title></rect>`;
  });
}
const html = `<!doctype html><meta charset="utf-8"><title>The round: pacing, plan vs measured</title>
<style>
:root{--surface:#fcfcfb;--ink:#1a1a19;--ink2:#5e5d57;--band:#f1f0ec;--s1:#2a78d6;--s2:#eb6834}
@media (prefers-color-scheme: dark){:root{--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--band:#252523;--s1:#3987e5;--s2:#d95926}}
body{margin:0;background:var(--surface);color:var(--ink);font:14px/1.4 system-ui,sans-serif}
.wrap{padding:20px 24px;width:${W}px}
h1{font-size:18px;margin:0 0 4px} p{margin:0 0 10px;color:var(--ink2);max-width:980px}
.ax{fill:var(--ink2);font-size:12px}.title{fill:var(--ink);font-size:13px;font-weight:600}.base{stroke:var(--ink2);stroke-width:1}
.legend{display:flex;gap:18px;margin:6px 0 0;color:var(--ink2)}.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:6px}
table{border-collapse:collapse;margin-top:14px;font-size:12px}td,th{padding:3px 8px;border-bottom:1px solid var(--band);text-align:left}
</style>
<div class="wrap"><h1>The round, played: does the pacing follow section 10?</h1>
<p>Blue is the plan's curve at the plan's times (a 12 to 15 minute round with human stops). Orange is what the running game was in at each beat of the recorded playtest, at the time it got there (${(r.first.time / 60).toFixed(1)} minutes: a bot that uses every service and stops to look ${Math.round(r.first.stops)} s in all). Filled squares match the plan's band; hollow ones differ. Hover any point for its beat.</p>
<div class="legend"><span><i style="background:var(--s1)"></i>Plan (section 10)</span><span><i style="background:var(--s2)"></i>Measured in the game</span></div>
<svg width="${W}" height="${T + 2 * PH + GAP + 30}" role="img" aria-label="Space and tension over the round, plan versus measured">${svg}</svg>
<table><tr><th>#</th><th>Beat</th><th>Plan time</th><th>Measured time</th><th>Plan space / tension</th><th>Measured</th></tr>
${rows.map((q) => `<tr><td>${q.n}</td><td>${esc(q.label)}</td><td>${Math.floor(q.plan.t / 60)}:${String(q.plan.t % 60).padStart(2, "0")}</td><td>${q.measured ? `${mmss(q.measured.t)}` : "-"}</td><td>${q.plan.space} (${spaceBand(q.plan.space)}) / ${q.plan.tension} (${tensionBand(q.plan.tension)})</td><td>${q.measured ? `${q.measured.space}${q.spaceOk ? "" : " (differs)"} / ${q.measured.tension}${q.tensionOk ? "" : " (differs)"}` : q.note}</td></tr>`).join("")}
</table></div>`;
writeFileSync(`${OUT}/pacing.html`, html);
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: W + 48, height: 800 } });
await page.goto(`file:///${process.cwd().replace(/\\/g, "/")}/${OUT}/pacing.html`);
await page.screenshot({ path: `${OUT}/pacing.png`, fullPage: true });
await browser.close();
