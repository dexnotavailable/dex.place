// An explicit verdict on the recorder's observed journey. This does not
// turn old/cross-head artifacts into fresh proof; the caller records head.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function assessRound(report) {
  const failures = [];
  const requirePass = (ok, message) => { if (!ok) failures.push(message); };
  const expected = [1, 2, 3, 4, 5, 6, 7, 7.1, 9, 10, 11, 12, 13, 14, 15, 15.1, 16, 17, 17.1, 18, 19, 20, 21, 22, 22.1, 23, 24];
  // B4 is the optional Stonetop branch (beat 8); the main round does not
  // take it. Rested/view snapshots are separate observed checkpoints.
  requirePass(report.errors.length === 0, `Browser errors: ${JSON.stringify(report.errors)}`);
  requirePass(report.beats.length === expected.length && report.beats.every((b, i) => b.n === expected[i]), "All 27 main-round checkpoints must occur in order");
  requirePass(!report.first.firstFrame.near && report.first.firstFrame.usable.length === 0, "Arrival must show scenery before interactions");
  const e = report.first.ending;
  requirePass(e.sitting && e.keeper === "sitting" && e.cups && e.evening, "Ending must seat player beside keeper and two cups in evening");
  requirePass(report.later.missing.length === 0, `Reload lost flags: ${report.later.missing}`);
  requirePass(report.later.rest?.room === "A1" && !report.later.a1.evening && !report.later.a0.keeper, "Later visit must start at the morning dock with the keeper back at work");
  requirePass(!report.returning.S1.waded, "Opened bridge must cross without wading");
  for (const dest of ["documentation", "downloads", "illustrations", "account", "donate", "map"]) requirePass(Number.isFinite(report.returning[dest]), `Returning route missing: ${dest}`);
  // B3/B4 are authored areas of B2. S2 is the ferry room; all 20 live
  // room IDs (21 planned spaces) must expose the same scroll-away path.
  const rooms = ["A0", "A1", "A2", "A3", "A4", "S2", "B1", "B2", "B5", "C1", "C2", "C3", "D1", "D2", "D3", "D4", "E1", "E2", "E3", "E4"];
  requirePass(rooms.every((id) => report.scroll[id]) && Object.keys(report.scroll).every((id) => report.scroll[id]), "Every authored room must pause for the website and resume");
  const flashes = report.first.flashes.map(([t]) => t);
  const maxFlashes = Math.max(0, ...flashes.map((t) => flashes.filter((u) => u >= t && u < t + 1).length));
  requirePass(maxFlashes <= 3, `Flash budget exceeded: ${maxFlashes} starts per second`);
  return { failures, maxFlashes, passed: failures.length === 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  const verdict = assessRound(JSON.parse(readFileSync(file, "utf8")));
  writeFileSync(file.replace(/\.json$/, "-verdict.json"), JSON.stringify({ at: new Date().toISOString(), ...verdict }, null, 2));
  console.log(JSON.stringify(verdict));
  if (!verdict.passed) process.exitCode = 1;
}
