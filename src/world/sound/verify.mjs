// Lane S1's proof: the world's sound in /world/ with real input and real Web
// Audio (Edge, d3d11), sampled from the page. Not a listening approval.
//   node src/world/sound/verify.mjs [--port 24701] [--quick 1] [--out dir] [--net 1] [--shots 1]
// Writes <out>/verify.json (+ samples for the charts; default out
// review/world/phase2/S1).
//
// Every music entry is judged by what you hear, timed from the moment the
// media element actually starts playing (its "playing" event), not from the
// clock: the loudest the music gets in the first half second after it
// becomes audible must sit at least 10 dB under its settled level, and the
// swell's gain must still be near zero when the element starts. Entries are
// checked on arrival (A1), walking onto the Blade with the real arrow key
// (the rain eases while the swell runs, D4), the chapel's restart (E3), the
// rest-then-swell, the rest running out while you stand in the silent
// archive, and on a throttled phone connection (fast 3G, cache off) for a
// resumed save (A2) and the Blade.
//
// Checks: every file loads from /audio/world/ and decodes, nothing is fetched
// from /legacy/; every cue id in the code has a file; each room gets its bed;
// Ambience first (no music for 12 s and not before you move); every music
// entry is a swell (the music bus's own level, measured after the muffle, never
// jumps); rooms that belong together keep one playhead; the lodge is muffled;
// the archive is silent within 4 s; the storm has no music; the grand
// passage enters at its cue point under its own swell; the chapel starts from
// the top; rest-then-swell after the cue ends; footsteps per surface; the bell
// per place; wind alone while the colossus passes Stonetop.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", "24701");
const QUICK = arg("quick", "0") === "1";
const NET = arg("net", "1") === "1";
const SHOTS = arg("shots", "1") === "1";
const OUT = arg("out", "review/world/phase2/S1");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
};

// --- static: every cue id the code emits ------------------------------------------------------
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|sound[\\/]build|_tools|tools$/.test(p)) walk(p, out);
    } else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}
const emitted = new Set();
const families = new Set();
for (const f of [...walk("src/world"), ...walk("src/pixel")]) {
  if (/src[\\/]world[\\/]sound/.test(f)) continue;
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/(?:\.sound|soundAt|audio\.play|api\.sound)\(\s*"([a-zA-Z0-9.:_-]+)"/g)) emitted.add(m[1]);
  // `sound: "<family>"` on a material means the cues <family>.hit / .break; anywhere else it is a cue id
  for (const line of s.split("\n")) for (const m of line.matchAll(/\bsound:\s*"([a-zA-Z0-9._-]+)"/g)) (/defineMaterial\(/.test(line) ? families : emitted).add(m[1]);
  for (const m of s.matchAll(/\bcues:\s*\[([^\]]*)\]/g)) for (const c of m[1].matchAll(/"([^"]+)"/g)) emitted.add(c[1]);
}
emitted.delete("step"); // footsteps go through the surface table
for (const fam of families) for (const k of ["hit", "break"]) emitted.add(`${fam}.${k}`);

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
const net = [];
const notFound = [];

/** A fresh world page. `throttle` (applied after load, cache off) emulates a phone's connection for everything the sound fetches later. */
async function open({ w = 1280, h = 720, dpr = 1, mobile = false, query = "fresh", throttle = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400) notFound.push(`${r.status()} ${u.replace(/^https?:\/\/[^/]+/, "")}`);
    if (/\/audio\/|\/legacy\//.test(u)) net.push({ url: u.replace(/^https?:\/\/[^/]+/, ""), status: r.status() });
  });
  // when each media element actually starts sounding, and the music's gain at that moment
  await page.addInitScript(() => {
    window.__played = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.__s1) {
        this.__s1 = true;
        this.addEventListener(
          "playing",
          () => {
            const m = window.__world?.game.audio.music;
            window.__played.push({ el: this, t: performance.now(), cue: this.currentTime, gain: m && m.el === this ? m.gain.gain.value : null });
          },
          { once: true },
        );
      }
      return play.call(this);
    };
  });
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 180000 });
  for (let k = 0; k < 900 && (await page.evaluate(() => window.__world.game.loading)); k++) await page.waitForTimeout(100);
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: throttle.latency, downloadThroughput: throttle.down, uploadThroughput: throttle.down / 4 });
  }
  return { ctx, page };
}

/** The one Enter action (real input), then sample the music bus after the muffle (music only), the whole output and the machine every 50 ms. */
async function arm(page) {
  await page.evaluate(() => {
    const g = window.__world.game;
    const a = g.audio;
    window.__s1 = { log: [], samples: [], t0: performance.now() };
    const orig = a.file.bind(a);
    a.file = (id, vol, rate, pan) => {
      const ok = orig(id, vol, rate, pan);
      window.__s1.log.push({ id, vol: +vol.toFixed(3), rate, ok, room: g.room?.def.id, t: (performance.now() - window.__s1.t0) / 1000 });
      return ok;
    };
  });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__world.game.audio.started, null, { timeout: 10000 });
  await page.evaluate(() => {
  const a = window.__world.game.audio;
  const tap = (node) => {
    const an = a.ctx.createAnalyser();
    an.fftSize = 2048;
    node.connect(an);
    return an;
  };
  const music = tap(a.muffleGain);
  const out = tap(a.master);
  const buf = new Float32Array(2048);
  const db = (an) => {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    return +(10 * Math.log10(s / buf.length + 1e-12)).toFixed(1);
  };
  window.__s1.sample = () => {
    const g = window.__world.game;
    const m = a.music;
    return {
      t: +((performance.now() - window.__s1.t0) / 1000).toFixed(2),
      room: g.room?.def.id,
      area: g.area?.id ?? null,
      music: a.state.music,
      entries: a.state.entries,
      resting: a.state.resting,
      gain: m ? +m.gain.gain.value.toFixed(4) : 0,
      cue: m ? +m.el.currentTime.toFixed(2) : null,
      paused: m ? m.el.paused : null,
      played: (() => {
        const p = m && window.__played.find((q) => q.el === m.el);
        return p ? { t: +((p.t - window.__s1.t0) / 1000).toFixed(2), cue: +p.cue.toFixed(2), gain: p.gain === null ? null : +p.gain.toFixed(4) } : null;
      })(),
      rain: +g.weather.p.rain.toFixed(2),
      muffleHz: Math.round(a.muffleFilt.frequency.value),
      muffleGain: +a.muffleGain.gain.value.toFixed(3),
      bed: a.bed ? a.bed.path : null,
      bedT: a.bed ? +a.bed.el.currentTime.toFixed(2) : null,
      bedGain: a.bed ? +a.bed.gain.gain.value.toFixed(3) : 0,
      musicDb: db(music),
      // the current music track alone (before the bus): an entry is judged on its own track, not the old one fading under it
      trackDb: (() => {
        if (!m) return -120;
        if (window.__s1.tapped !== m.gain) {
          window.__s1.tapped = m.gain;
          window.__s1.trackAn = tap(m.gain);
        }
        return db(window.__s1.trackAn);
      })(),
      outDb: db(out),
      ducks: Object.fromEntries(g.ducks),
      ctx: a.ctx.state,
    };
  };
  window.__s1.timer = setInterval(() => window.__s1.samples.push(window.__s1.sample()), 50);
  });
}

/** Helpers bound to one page. */
function helpers(page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = (ms) => page.waitForTimeout(ms);
  const tp = async (room, spawn) => {
    await ev(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
    for (let k = 0; k < 600 && (await ev(() => window.__world.game.loading)); k++) await wait(100);
    await wait(300);
  };
  /** Walk with the real arrow key until the named area is reached, then `after` ms more; returns when the area was reached (sampler seconds). */
  const walkInto = async (key, area, after = 1500) => {
    await page.keyboard.down(key);
    let at = null;
    for (let k = 0; k < 600 && at === null; k++) {
      await wait(50);
      at = await ev((id) => ((window.__world.game.area?.id ?? null) === id ? (performance.now() - window.__s1.t0) / 1000 : null), area);
    }
    await wait(after);
    await page.keyboard.up(key);
    return at;
  };
  return {
    ev,
    wait,
    tp,
    walkInto,
    sample: () => ev(() => window.__s1.sample()),
    samplesSince: (t) => ev((t0) => window.__s1.samples.filter((s) => s.t >= t0), t),
    now: () => ev(() => (performance.now() - window.__s1.t0) / 1000),
  };
}

/**
 * A music entry as heard: when it first becomes audible (the music bus above
 * -60 dB), the loudest it gets in the next half second next to its settled
 * level (the median of the window's last 2 s), where the cue was then, and
 * the swell's gain when the element started playing (a fraction of where it
 * settles). A swell: at least 10 dB under settled for that first half second,
 * and near-zero gain (5% or less) when the sound starts.
 */
function entryOf(all) {
  // the last entry in the window, on its own track (an old track fading under it is not the entry)
  const ss = all.filter((s) => s.entries === all.at(-1)?.entries);
  const first = ss.find((s) => s.trackDb > -60);
  const tail = ss.slice(-40).map((s) => s.trackDb).sort((a, b) => a - b);
  const settled = tail[Math.floor(tail.length / 2)];
  const w = first ? ss.filter((s) => s.t >= first.t && s.t <= first.t + 0.5) : [];
  const peak = w.length ? Math.max(...w.map((s) => s.trackDb)) : null;
  const target = ss.at(-1)?.gain || null;
  const played = first?.played ?? ss.at(-1)?.played ?? null;
  const e = {
    audibleAt: first?.t ?? null,
    playedAt: played?.t ?? null,
    cueAtAudible: first?.cue ?? null,
    firstHalfSecondPeakDb: peak,
    settledDb: settled ?? null,
    underSettledDb: peak !== null && settled !== undefined ? +(settled - peak).toFixed(1) : null,
    gainAtPlaying: played?.gain ?? null,
    gainAtPlayingFraction: played && played.gain !== null && target ? +(played.gain / target).toFixed(3) : null,
  };
  e.swell = e.underSettledDb !== null && e.underSettledDb >= 10 && e.gainAtPlayingFraction !== null && e.gainAtPlayingFraction <= 0.05;
  return e;
}

/** The gain curve's largest step per 50 ms (the swell's own smoothness; what is heard is entryOf). */
const swellStats = (ss) => {
  let maxStep = 0;
  for (let i = 1; i < ss.length; i++) maxStep = Math.max(maxStep, ss[i].gain - ss[i - 1].gain);
  return { maxGainStep: +maxStep.toFixed(4) };
};

const { ctx: mainCtx, page } = await open();
await arm(page);
const { ev, wait, tp, walkInto, sample, samplesSince, now } = helpers(page);
const charts = {};

// --- files: all decode; nothing from legacy -------------------------------------------------
await wait(3000);
// effects load in the background (after the bed, a couple at a time): give them up to 60 s
await page.waitForFunction((n) => [...window.__world.game.audio.buffers.values()].filter((b) => b && b !== "loading").length >= n, 70, { timeout: 60000, polling: 250 }).catch(() => undefined);
const loaded = await ev(() => {
  const a = window.__world.game.audio;
  const out = { ok: [], missing: [] };
  for (const [id, b] of a.buffers) (b && b !== "loading" ? out.ok : out.missing).push(id);
  return out;
});
const tables = await ev(async () => {
  const m = await import("/src/world/sound/tables.ts");
  return { files: m.TABLES.files, cues: Object.keys(m.TABLES.cues), beds: m.TABLES.beds, music: m.TABLES.music, steps: m.TABLES.steps, base: m.TABLES.base };
});
check("every effect and footstep file loads and decodes", loaded.missing.length === 0 && loaded.ok.length >= Object.keys(tables.files).length, { decoded: loaded.ok.length, files: Object.keys(tables.files).length, missing: loaded.missing });
const longFiles = await ev(async (t) => {
  const a = window.__world.game.audio;
  const out = [];
  for (const [k, p] of [...Object.entries(t.beds).map(([k, p]) => [`bed ${k}`, p]), ...Object.entries(t.music).map(([k, p]) => [`music ${k}`, p])]) {
    for (const ext of ["opus", "m4a"]) {
      const r = await fetch(`${t.base}/${p}.${ext}`);
      let secs = null, err = null;
      try {
        secs = +(await a.ctx.decodeAudioData(await r.arrayBuffer())).duration.toFixed(2);
      } catch (e) {
        err = String(e);
      }
      out.push({ k, ext, status: r.status, secs, err });
    }
  }
  return out;
}, tables);
check("every bed and music file (opus and m4a) is served and decodes", longFiles.every((f) => f.status === 200 && f.secs > 5), longFiles.filter((f) => f.status !== 200 || !(f.secs > 5)));
const uncovered = [...emitted].filter((id) => !tables.cues.includes(id)).sort();
check("every cue id in the code has a file (no placeholder synth voice)", uncovered.length === 0, { ids: emitted.size, uncovered });
check("AUDIO_BASE is /audio/world", tables.base === "/audio/world");
const hooks = (await ev(() => window.__world.state().hooks)) ?? [];
check("the sound hook is discovered", JSON.stringify(hooks).includes("s1-world-sound"), hooks);

// --- A1: ambience first --------------------------------------------------------------------
let s = await sample();
check("A1 bed is the lake", s.bed === "beds/lake", s.bed);
await wait(QUICK ? 4000 : 13000);
s = await sample();
check("ambience first: no music 13 s after Enter without moving", s.music === "none" && s.musicDb < -80, { t: s.t, music: s.music, musicDb: s.musicDb, bedGain: s.bedGain, outDb: s.outDb });
const moveAt = await now();
await page.keyboard.down("ArrowRight");
await wait(1200);
await page.keyboard.up("ArrowRight");
await wait(13500);
let ss = await samplesSince(moveAt);
charts.a1 = ss;
const firstAudible = ss.find((x) => x.musicDb > -60);
const full = ss.find((x) => x.gain >= 0.95 * (ss[ss.length - 1].gain || 1));
const st = swellStats(ss);
const a1e = entryOf(ss);
check("theme swell at A1: silence, then a slow rise as heard (10 dB or more under settled for the first 0.5 s, gain near 0 when the sound starts)", s.music === "none" && firstAudible && st.maxGainStep < 0.05 && ss[ss.length - 1].music === "theme" && a1e.swell, { enteredAfterMove: firstAudible ? +(firstAudible.t - moveAt).toFixed(2) : null, fullAfterMove: full ? +(full.t - moveAt).toFixed(2) : null, ...st, ...a1e, endGain: ss[ss.length - 1].gain, cue: ss[ss.length - 1].cue });
const steps = await ev(() => window.__s1.log.filter((l) => l.id.startsWith("step-")).map((l) => l.id));
check("footsteps on the dock are wood", steps.length > 0 && steps.every((x) => x.startsWith("step-wood-")), [...new Set(steps)]);

// --- rooms that belong together keep one playhead ------------------------------------------
s = await sample();
const e0 = s.entries, c0 = s.cue;
await tp("A0", "east");
await wait(2500);
let s2 = await sample();
await tp("A2", "west");
await wait(2500);
let s3 = await sample();
check("A1 -> A0 -> A2 keep one playhead (no new entry, the cue runs on)", s2.entries === e0 && s3.entries === e0 && s2.cue > c0 && s3.cue > s2.cue, { entries: [e0, s2.entries, s3.entries], cue: [c0, s2.cue, s3.cue], beds: [s2.bed, s3.bed] });
// A3 the lodge: muffled on the same playhead
const lodgeAt = await now();
await tp("A3", "front");
await wait(3000);
s = await sample();
check("A3 lodge: muffled (low-pass, about -9 dB), same playhead, lodge bed", s.entries === e0 && s.muffleHz < 900 && s.muffleGain < 0.4 && s.bed === "beds/lodge", { muffleHz: s.muffleHz, muffleGain: s.muffleGain, entries: s.entries, bed: s.bed, cue: s.cue });
charts.lodge = await samplesSince(lodgeAt - 1);
// the bell per place
const bells = {};
for (const [room, spawn] of [["A3", "front"], ["A1", "start"], ["B2", "west"], ["E1", "west"], ["E4", "west"]]) {
  await tp(room, spawn);
  await ev(() => window.__world.game.audio.play("bell.ring", 0.8));
  await wait(150);
  bells[room] = await ev(() => window.__s1.log.filter((l) => l.id.startsWith("bell-")).at(-1));
}
check("the bell per place: ferry at Ringwater (desk bell pitched up in the lodge), rib on the causeway and the path, chapel bell in the tower", bells.A3?.id === "bell-ferry" && bells.A3.rate > 1.4 && bells.A1?.id === "bell-ferry" && bells.B2?.id === "bell-rib" && bells.E1?.id === "bell-rib" && bells.E4?.id === "bell-chapel", Object.fromEntries(Object.entries(bells).map(([k, v]) => [k, v && `${v.id} x${v.rate}`])));

// --- beds per room and footsteps per surface -----------------------------------------------
const bedWant = { A0: "lake", A1: "lake", A2: "lake", A3: "lodge", A4: "lake", S2: "lake", B1: "reeds", B2: "plain", B5: "shaft", C1: "market", C2: "archive", C3: "waiting", D1: "shaft", D2: "storm", D3: "storm", D4: "storm", E1: "dusk", E2: "dusk", E3: "chapel", E4: "dusk" };
const bedGot = {};
const stepGot = {};
for (const room of Object.keys(bedWant)) {
  const spawn = await ev((r) => Object.keys(window.__world.game.roomDef(r).spawns)[0], room);
  await tp(room, spawn);
  const n0 = await ev(() => window.__s1.log.length);
  const dir = await ev(() => (window.__world.state().x > window.__world.game.room.def.w / 2 ? "ArrowLeft" : "ArrowRight"));
  await page.keyboard.down(dir);
  await wait(900);
  await page.keyboard.up(dir);
  await wait(400);
  const x = await ev((n) => ({ steps: [...new Set(window.__s1.log.slice(n).filter((l) => l.id.startsWith("step-")).map((l) => l.id.replace(/-\d$/, "")))], surface: window.__world.game.audioFor().surface ?? window.__world.game.room.collision.lastSurface, bed: window.__world.game.audio.bed?.path, bedPlaying: !!window.__world.game.audio.bed && !window.__world.game.audio.bed.el.paused, wading: window.__world.game.wading, area: window.__world.game.area?.id ?? null, areaBed: window.__world.game.area?.audio?.bed ?? null }), n0);
  bedGot[room] = x.area ? `${x.bed} (area ${x.area})` : x.bed;
  if (x.area && x.areaBed) bedWant[room] = x.areaBed;
  stepGot[room] = x;
}
const bedBad = Object.entries(bedWant).filter(([r, b]) => !bedGot[r]?.startsWith(`beds/${b}`));
check("each room plays its bed (section 9)", bedBad.length === 0, bedGot);
const stepBad = Object.entries(stepGot).filter(([, v]) => v.steps.length && !v.steps.every((id) => id === `step-${v.wading ? "water" : v.surface}`));
check("footsteps match the surface in every room", stepBad.length === 0 && Object.values(stepGot).filter((v) => v.steps.length).length >= 12, Object.fromEntries(Object.entries(stepGot).map(([r, v]) => [r, `${v.surface}: ${v.steps.join(",") || "-"}`])));
const direct = {};
for (const surf of ["water", "grating", "wet-metal", "tile", "rug", "earth", "metal", "stone", "wood"]) {
  await ev((x) => window.__world.game.audio.step(x, 0.5), surf);
  direct[surf] = await ev(() => window.__s1.log.at(-1).id);
}
check("every surface of section 9 has its own pair (wood, stone, earth, water, grating, metal, wet metal, tile, rug)", Object.entries(direct).every(([k, v]) => v.startsWith(`step-${k}-`)), direct);

// --- C2: the archive is silent within 4 s ---------------------------------------------------
await tp("C1", "archive");
await wait(3000);
const arcAt = await now();
await tp("C2", "door");
await wait(6000);
ss = await samplesSince(arcAt);
charts.archive = ss;
const zero = ss.find((x) => x.gain <= 0.001);
const endS = ss[ss.length - 1];
check("C2 archive: the music's gain reaches 0 within 4 s, playhead kept", zero && zero.t - arcAt <= 4.2 && endS.music === "theme" && endS.musicDb < -70, { zeroAfter: zero ? +(zero.t - arcAt).toFixed(2) : null, bed: endS.bed, musicDb: endS.musicDb, cue: endS.cue });

// --- D2 storm: no music; D4 the grand passage ----------------------------------------------
const stormAt = await now();
await tp("D2", "shrine");
await wait(5500);
s = await sample();
check("D2 storm: no music (4 s fade out), storm bed", s.music === "none" && s.musicDb < -80 && s.bed === "beds/storm", { music: s.music, musicDb: s.musicDb, bed: s.bed });
// walked in with the real arrow key: the weather is not snapped, so the rain eases while the swell runs
await tp("D4", "west");
await wait(3000);
const walkAt = await now();
const passAt = await walkInto("ArrowRight", "D4-break", 1500);
await wait(9000);
ss = await samplesSince(walkAt);
charts.d4 = ss;
const d4after = passAt === null ? [] : ss.filter((x) => x.t >= passAt);
const d4first = d4after.find((x) => x.musicDb > -60);
const d4st = swellStats(d4after);
const d4e = entryOf(d4after);
const d4end = ss[ss.length - 1];
check("D4 grand passage, walked in: enters at its cue point (48 s) under a 5 s swell after 2 s quiet, as heard, while the rain eases", passAt !== null && d4end.music === "theme" && d4first && d4first.cue >= 47.9 && d4first.cue < 50 && d4st.maxGainStep < 0.05 && d4e.swell, { area: d4end.area, walkedFor: passAt === null ? null : +(passAt - walkAt).toFixed(2), firstAudibleAt: d4first ? +(d4first.t - passAt).toFixed(2) : null, cueThen: d4first?.cue, cueNow: d4end.cue, bed: d4end.bed, rain: d4after.length ? [d4after[0].rain, d4end.rain] : null, ...d4st, ...d4e });
// E1 carries it on
const e1c0 = d4end.cue, e1e0 = d4end.entries;
await tp("E1", "west");
await wait(2000);
s = await sample();
check("E1 carries the grand passage on (same playhead)", s.entries === e1e0 && s.cue > e1c0, { entries: [e1e0, s.entries], cue: [e1c0, s.cue] });
// E3 from the top
await tp("E2", "west");
await wait(1500);
const e3At = await now();
await tp("E3", "west");
await wait(12000);
ss = await samplesSince(e3At);
charts.e3 = ss;
const hist = await ev(() => window.__world.game.audio.state.history.slice(-4));
const e3end = ss[ss.length - 1];
const e3e = entryOf(ss);
check("E3 chapel: the theme starts from the top (the only restart) under a swell, as heard", hist.some((h) => /restart at 0/.test(h)) && e3end.cue < 12 && swellStats(ss).maxGainStep < 0.05 && e3e.swell, { history: hist, cue: e3end.cue, ...swellStats(ss), ...e3e });
await tp("E4", "west");
await wait(1500);
s = await sample();
check("E4 carries the chapel's theme on", s.entries === e3end.entries && s.cue > e3end.cue, { entries: [e3end.entries, s.entries], cue: [e3end.cue, s.cue] });

// --- rest, then swell ------------------------------------------------------------------------
if (!QUICK) {
  await ev(() => {
    window.__world.game.audio.music.el.currentTime = 80.5;
  });
  await page.waitForFunction(() => window.__world.game.audio.state.resting, null, { timeout: 15000 });
  const restAt = await now();
  const entriesAt = (await sample()).entries;
  await page.waitForFunction((e) => window.__world.game.audio.state.entries > e, entriesAt, { timeout: 100000, polling: 250 });
  const backAt = await now();
  await wait(10500);
  ss = await samplesSince(restAt - 1);
  charts.rest = ss;
  const back = ss.filter((x) => x.t >= backAt);
  const re = entryOf(back);
  check("rest, then swell: 45 to 90 s of ambience after the cue ends, then the theme swells in from its start, as heard", backAt - restAt >= 44.5 && backAt - restAt <= 90.5 && back.at(-1).cue < 12 && swellStats(back).maxGainStep < 0.05 && re.swell, { restSeconds: +(backAt - restAt).toFixed(1), cueAfter: back.at(-1).cue, ...swellStats(back), ...re });
}

// --- wind alone at Stonetop -----------------------------------------------------------------
await tp("B2", "shrine");
const spot = await ev(() => {
  const g = window.__world.game;
  for (let x = 3780; x < 5100; x += 20) {
    g.place(x);
    if (g.area?.id === "B4") return x;
  }
  return null;
});
await wait(1500);
const windAt = await now();
let passing = null, cleared = null;
for (let k = 0; k < (QUICK ? 60 : 320); k++) {
  const x = await ev(() => ({ st: window.__world.game.room.prop("keeper")?.state, duck: window.__world.game.ducks.get("colossus") ?? 0, area: window.__world.game.area?.id }));
  if (!passing && x.st === "passing") passing = { t: await now(), ...x };
  if (passing && !cleared && x.st === "far") cleared = { t: await now(), ...x };
  if (passing && cleared) break;
  await wait(500);
}
ss = await samplesSince(windAt);
charts.wind = ss;
const whileS = ss.filter((x) => passing && x.t >= passing.t + 0.6 && (!cleared || x.t < cleared.t - 0.6));
const duckedWhile = whileS.length > 0 && whileS.every((x) => x.ducks.colossus === 30);
const afterClear = cleared ? ss.filter((x) => x.t > cleared.t + 3) : [];
check("wind alone: the music ducks out while the colossus passes Stonetop, then returns", spot && passing && passing.duck !== undefined && duckedWhile && (cleared ? afterClear.every((x) => !x.ducks.colossus) : false), { placedAt: spot, samplesWhile: whileS.length, duckedSamples: whileS.filter((x) => x.ducks.colossus === 30).length, offArea: whileS.filter((x) => x.area !== "B4").length, clearedDucked: afterClear.filter((x) => x.ducks.colossus).length, passingAfter: passing ? +(passing.t - windAt).toFixed(1) : null, passFor: passing && cleared ? +(cleared.t - passing.t).toFixed(1) : null, minMusicDbWhile: passing ? Math.min(...ss.filter((x) => x.t > passing.t + 3 && (!cleared || x.t < cleared.t)).map((x) => x.musicDb)) : null });

await mainCtx.close();

// --- the rest runs out while you stand in the silent archive ------------------------------------
// (the rest is shortened to 4 to 5 s through the sound tables; the machine is the same one)
{
  const { ctx, page: p } = await open();
  await arm(p);
  const h = helpers(p);
  await h.tp("C1", "archive");
  await p.waitForFunction(() => {
    const m = window.__world.game.audio.music;
    return !!m && !m.el.paused && m.el.readyState >= 3 && m.el.currentTime > 1;
  }, null, { timeout: 60000, polling: 250 });
  await h.ev(async () => {
    const m = await import("/src/world/audio.ts");
    m.registerSound({ restAfterEnd: [4, 5] });
    window.__world.game.audio.music.el.currentTime = 81.5;
  });
  await h.tp("C2", "door");
  await p.waitForFunction(() => window.__world.game.audio.state.resting, null, { timeout: 40000 });
  const restAt = await h.now();
  await h.wait(8000); // the rest ends while you are in the archive
  const inArchive = await h.sample();
  const backAt = await h.now();
  await h.tp("C1", "archive");
  await h.wait(16000);
  const c1 = (await h.samplesSince(backAt)).filter((x) => x.room === "C1");
  await h.tp("C3", "west");
  await h.wait(3000);
  const c3 = await h.sample();
  charts.restArchive = await h.samplesSince(restAt - 1);
  const back = entryOf(c1);
  check("the rest runs out in the silent archive: back in C1 the theme swells in again from the top, and C3 hears it (never left dead)", inArchive.room === "C2" && !inArchive.resting && back.audibleAt !== null && back.swell && c1.at(-1).cue < 20 && c3.musicDb > -60, { inArchive: { resting: inArchive.resting, musicDb: inArchive.musicDb, music: inArchive.music }, audibleAfterReturn: back.audibleAt === null ? null : +(back.audibleAt - backAt).toFixed(2), cueInC1: c1.at(-1)?.cue, c3: { musicDb: c3.musicDb, cue: c3.cue, muffleHz: c3.muffleHz }, ...back });
  await ctx.close();
}

// --- a phone's connection (fast 3G: 1.6 Mbps, 150 ms, cache off): entries still swell ----------------
if (NET) {
  const fast3g = { latency: 150, down: (1.6 * 1024 * 1024) / 8 };
  {
    const { ctx, page: p } = await open({ throttle: fast3g });
    await arm(p);
    const h = helpers(p);
    const t0 = await h.now();
    await h.tp("A2", "west"); // a resumed save away from A1: the theme enters after its gap
    await p.waitForFunction(() => window.__s1.samples.some((x) => x.trackDb > -60), null, { timeout: 90000, polling: 250 }).catch(() => undefined);
    await h.wait(11000);
    const ss2 = await h.samplesSince(t0);
    charts.netA2 = ss2;
    const e = entryOf(ss2);
    check("fast 3G, A2: the theme's entry is a swell when it actually sounds", e.swell, { ...e, requestedAt: ss2.find((x) => x.music === "theme")?.t ?? null });
    await ctx.close();
  }
  {
    const { ctx, page: p } = await open({ throttle: fast3g });
    await arm(p);
    const h = helpers(p);
    await h.tp("D4", "west");
    await h.wait(3000);
    const t0 = await h.now();
    const at = await h.walkInto("ArrowRight", "D4-break", 1500);
    await p.waitForFunction(() => window.__s1.samples.some((x) => x.area === "D4-break" && x.trackDb > -60), null, { timeout: 90000, polling: 250 }).catch(() => undefined);
    await h.wait(8000);
    const ss2 = (await h.samplesSince(t0)).filter((x) => at !== null && x.t >= at);
    charts.netD4 = ss2;
    const e = entryOf(ss2);
    check("fast 3G, D4 walked in: the grand passage enters under its swell when it actually sounds (cue 48 to 50 s)", at !== null && e.swell && e.cueAtAudible >= 47.9 && e.cueAtAudible < 50, { ...e, crossedAt: at });
    await ctx.close();
  }
}

// --- screenshots with the debug line: 1080p (1.5x), 1440p (2x), a phone ----------------------------
if (SHOTS) {
  mkdirSync(join(OUT, "shots"), { recursive: true });
  const shots = {};
  for (const [label, o, room, spawn, walk] of [
    ["1080p-D4-break", { w: 1920, h: 1080 }, "D4", "west", "D4-break"],
    ["1440p-C1", { w: 2560, h: 1440 }, "C1", "archive", null],
    ["phone-A1", { w: 390, h: 844, dpr: 3, mobile: true }, null, null, null],
  ]) {
    const { ctx, page: p } = await open({ ...o, query: "fresh&debug" });
    if (o.mobile) {
      await p.touchscreen.tap(195, 422);
      await p.waitForTimeout(500);
      if (!(await p.evaluate(() => window.__world.game.audio.started))) await p.keyboard.press("Enter");
      await p.waitForFunction(() => window.__world.game.audio.started, null, { timeout: 10000 });
      await p.evaluate(() => {
        window.__s1 = { log: [], samples: [], t0: performance.now() };
      });
    } else await arm(p);
    const h = helpers(p);
    if (room) await h.tp(room, spawn);
    if (walk) {
      await h.wait(2000);
      await h.walkInto("ArrowRight", walk, 1500);
    }
    await h.wait(room ? 9000 : 3000);
    await p.screenshot({ path: join(OUT, "shots", `${label}.png`) });
    shots[label] = await p.evaluate(() => window.__world.state().audio);
    await ctx.close();
  }
  check("screenshots at 1080p, 1440p and a phone (the debug line shows the sound state)", Object.keys(shots).length === 3, shots);
}

// --- network ----------------------------------------------------------------------------------
const legacy = net.filter((n) => n.url.includes("/legacy/"));
const bad = net.filter((n) => n.status >= 400);
check("no request to /legacy/, no failed audio request", legacy.length === 0 && bad.length === 0, { requests: net.length, legacy: legacy.slice(0, 5), bad: bad.slice(0, 5) });
check("no page errors", errors.filter((e) => !/Failed to load resource/.test(e)).length === 0, { errors: errors.slice(0, 8), notFound: [...new Set(notFound)].slice(0, 8) });


writeFileSync(join(OUT, "verify.json"), JSON.stringify({ at: new Date().toISOString(), port: PORT, passed: results.filter((r) => r.ok).length, of: results.length, results }, null, 1));
writeFileSync(join(OUT, "samples.json"), JSON.stringify(charts));
console.log(`${results.filter((r) => r.ok).length} of ${results.length} pass`);
await browser.close();
