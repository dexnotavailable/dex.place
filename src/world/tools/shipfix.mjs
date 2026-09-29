// Evidence for the ship-fix pass (the cross-lane problems I1's integrated round found).
//   node src/world/tools/shipfix.mjs <check> [--port 25001]
// Checks: smoke, strike, summon, archive, lift, blade, lamps, sit, api, all.
// Every check records console errors and every HTTP response of 400 or more,
// unfiltered, and writes to review/world/phase2/ship-fix/<check>/.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { browserOptions, angle } from "./browser.mjs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "25001");
const ROOT = arg("out", "review/world/phase2/ship-fix");
const which = process.argv[2] ?? "all";
const browser = await chromium.launch(browserOptions);
const out = {};
const note = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

/** A world page: size, device scale, query. Collects errors and bad responses. */
async function open(query, { w = 1280, h = 720, dpr = 1, mobile = false, saved = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  if (saved) await ctx.addInitScript((saved) => localStorage.setItem("dex.world.v1", JSON.stringify(saved)), saved);
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  // a media request the page cancels itself (a music element let go on a room change) is not an error
  const aborted = [];
  page.on("requestfailed", (r) => (/ERR_ABORTED/.test(r.failure()?.errorText ?? "") ? aborted : bad).push(`failed ${r.url()} ${r.failure()?.errorText ?? ""}`));
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 180000 });
  const ev = (fn, a) => page.evaluate(fn, a);
  for (let k = 0; k < 900 && (await ev(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    if (query.includes("manual")) await ev(() => window.__world.advance(1));
  }
  return { ctx, page, ev, errors, bad, aborted };
}
/** Wait (advancing a manual world) until the current room's backdrop is ready and no transition runs. */
async function settle(p, id, manual = true) {
  for (let k = 0; k < 600; k++) {
    const ok = await p.ev((id) => {
      const g = window.__world.game;
      return !g.trans && (!id || g.room.def.id === id) && (!g.room.backdrop || g.room.backdrop.ready());
    }, id);
    if (ok) return true;
    await p.page.waitForTimeout(80);
    if (manual) await p.ev(() => window.__world.advance(1));
  }
  return false;
}
const dir = (name) => {
  const d = `${ROOT}/${name}`;
  mkdirSync(d, { recursive: true });
  return d;
};
const save = (name, data) => writeFileSync(`${ROOT}/${name}/${name}.json`, JSON.stringify(data, null, 1));

// --- smoke: a fresh load, no errors, no 404 (the sprite probe is quiet) ---------------------
async function smoke() {
  const d = dir("smoke");
  const res = {};
  for (const [name, o] of [["720p", {}], ["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("fresh&go", o);
    await settle(p, "A1", false);
    await p.page.waitForTimeout(3000);
    const s = await p.ev(() => ({ room: window.__world.game.room.def.id, sprite: window.__world.game.player.sprite?.source ?? null, sit: !!window.__world.game.worldSprite?.clips.get("sit") }));
    await p.page.screenshot({ path: `${d}/A1-${name}.png` });
    res[name] = { ...s, errors: p.errors, bad: p.bad };
    note(`smoke ${name}: ${p.errors.length} errors, ${p.bad.length} bad responses`);
    await p.ctx.close();
  }
  save("smoke", res);
  out.smoke = res;
}

/** Put her at world x in the current room (manual world) and let the camera settle. */
async function placeAt(p, wx, wy = null) {
  await p.ev(([wx, wy]) => {
    const g = window.__world.game;
    // on the ground under her feet (not the top of whatever stands over it: the Crown's overhang)
    const x = (wx - (g.room.def.origin?.[0] ?? 0)) * 80;
    const y = wy === null ? g.room.collision.groundAt(x, g.player.body.y - 40) : ((g.room.def.origin?.[1] ?? 0) - wy) * 80;
    window.__world.place(x, y);
  }, [wx, wy]);
  await p.ev(() => window.__world.advance(90));
}
/** A crop around the player, scaled from the 1280x720 view to the page size. */
async function shotPlayer(p, path, box = [90, 120, 180, 150]) {
  const r = await p.ev(() => {
    const g = window.__world.game;
    const b = g.player.body;
    const [cx, cy] = g.camera.view();
    const cr = g.r.canvas.getBoundingClientRect();
    return { x: b.x - cx, y: b.y - cy, rect: g.r.presenter.rect, dpr: g.r.canvas.width / cr.width, left: cr.left, top: cr.top };
  });
  // the presenter's rect is in canvas pixels; the screenshot clip is in CSS pixels
  const k = r.rect.scale / r.dpr;
  const ox = r.left + r.rect.x / r.dpr, oy = r.top + r.rect.y / r.dpr;
  const clip = { x: Math.max(0, ox + (r.x - box[0]) * k), y: Math.max(0, oy + (r.y - box[1]) * k), width: box[2] * k, height: box[3] * k };
  await p.page.screenshot({ path, clip });
  return { at: [r.x, r.y], scale: k };
}

// --- sit: the stand-in sits on benches (stub and kit), at 1080p / 1440p / phone -------------
async function sit() {
  const d = dir("sit");
  const res = {};
  const spots = [
    ["A0-pier-bench", "A0", "east", -11.65],
    ["C1-market-bench", "C1", "shrine", 215.9],
    ["D4-blade-bench", "D4", "east", 314.3],
    ["E3-look-pew", "E3", "", 445.1],
  ];
  for (const [vname, vo] of [["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("manual&fresh&mute", vo);
    await p.ev(() => window.__world.begin());
    for (const [name, room, spawn, x] of spots) {
      if (vname !== "1080p" && name !== "A0-pier-bench" && name !== "D4-blade-bench") continue;
      await p.ev(([room, spawn]) => window.__world.teleport(room, spawn), [room, spawn]);
      await settle(p, room);
      await placeAt(p, x, room === "C1" ? -32 : null);
      const before = await shotPlayer(p, `${d}/${name}-${vname}-standing.png`);
      await p.ev(() => window.__world.use());
      await p.ev(() => window.__world.advance(150));
      const s = await p.ev(() => {
        const g = window.__world.game;
        const sd = g.player.spriteDraw();
        return { sitting: g.sitting, drawn: sd ? { x: sd.x, y: sd.y, w: sd.sw, h: sd.sh } : null, feet: g.player.body.y };
      });
      await p.page.screenshot({ path: `${d}/${name}-${vname}-full.png` });
      const crop = await shotPlayer(p, `${d}/${name}-${vname}-sitting.png`);
      // any move stands her up
      await p.ev(() => window.__world.press("right"));
      await p.ev(() => window.__world.advance(20));
      await p.ev(() => window.__world.release("right"));
      const stood = await p.ev(() => !window.__world.game.sitting && window.__world.game.player.spriteDraw().sh);
      // Return to the same bench and use it once: movement must have reset
      // its prop state as well as the runtime's seated pose.
      await placeAt(p, x, room === "C1" ? -32 : null);
      await p.ev(() => window.__world.use());
      await p.ev(() => window.__world.advance(10));
      const satAgain = await p.ev(() => !!window.__world.game.sitting);
      res[`${name}-${vname}`] = { ...s, before, crop, stoodUp: !!stood, satAgain };
      note(`sit ${name} ${vname}: sitting ${!!s.sitting}, drawn ${JSON.stringify(s.drawn)}`);
    }
    res[`errors-${vname}`] = p.errors;
    res[`bad-${vname}`] = p.bad;
    await p.ctx.close();
  }
  save("sit", res);
  out.sit = res;
}

/** Mean luminance (0..255) of screenshot A where it differs from B (the player's own pixels), and of B in a box. */
async function lumaDiff(p, a, b, box) {
  return p.ev(async ([a, b, box]) => {
    const load = async (s) => {
      const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob());
      const c = new OffscreenCanvas(bm.width, bm.height);
      const x = c.getContext("2d");
      x.drawImage(bm, 0, 0);
      return x.getImageData(0, 0, bm.width, bm.height);
    };
    const A = await load(a), B = await load(b);
    const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let n = 0, sum = 0, peak = 0, wn = 0, wsum = 0;
    for (let y = 0; y < A.height; y++)
      for (let x = 0; x < A.width; x++) {
        const i = (y * A.width + x) * 4;
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
        if (d > 24) {
          const l = L(A.data, i);
          sum += l;
          n++;
          peak = Math.max(peak, l);
        }
        if (box && x >= box[0] && x < box[0] + box[2] && y >= box[1] && y < box[1] + box[3]) {
          wsum += L(B.data, i);
          wn++;
        }
      }
    return { playerPx: n, playerLuma: n ? +(sum / n).toFixed(1) : 0, playerPeak: +peak.toFixed(0), worldLuma: wn ? +(wsum / wn).toFixed(1) : null };
  }, [a, b, box]);
}

// --- strike: lightning lights the world, not the player (D1 to D3) -------------------------
async function strike() {
  const d = dir("strike");
  const res = {};
  const p = await open("manual&fresh&mute", { w: 1920, h: 1080 });
  await p.ev(() => window.__world.begin());
  for (const [room, spawn] of [["D2", "lift"], ["D3", "west"], ["D1", ""]]) {
    await p.ev(([room, spawn]) => window.__world.teleport(room, spawn), [room, spawn]);
    await settle(p, room);
    await p.ev(() => window.__world.advance(120));
    // no natural strikes during the A/B: only the ones set here
    await p.ev(() => {
      const g = window.__world.game;
      g.__allow ??= g.gate.allow.bind(g.gate);
      g.gate.allow = () => false;
      g.weather.strikes = [];
      g.weather.flash = 0;
    });
    const r = {};
    for (const mode of ["fixed", "before"]) {
      // "before": the old path (the strike's key and ambient surge and its point light on her too), for comparison
      await p.ev((mode) => {
        const g = window.__world.game;
        const W = g.weather;
        W.__lighting ??= W.lighting.bind(W);
        W.lighting = mode === "before" ? (b) => W.__lighting(b) : W.__lighting;
        g.__lights ??= g.lights.bind(g);
        g.lights = mode === "before" ? () => g.__lights(true) : g.__lights;
      }, mode);
      for (const lvl of [0, 0.5, 1]) {
        await p.ev((lvl) => {
          const g = window.__world.game, W = g.weather;
          W.strikes = lvl ? [{ x: g.player.body.x + 200, seed: 7, age: 0.05, dur: 0.3, level: lvl, double: false, thunderIn: 9, heard: true, bolt: true }] : [];
          W.flash = lvl;
          window.__world.render();
        }, lvl);
        const shot = async (hide) => {
          await p.ev((hide) => {
            const g = window.__world.game;
            g.player.__sd ??= g.player.spriteDraw;
            g.player.spriteDraw = hide ? () => undefined : g.player.__sd;
            window.__world.render();
          }, hide);
          return (await p.page.screenshot()).toString("base64");
        };
        const B = await shot(true);
        const A = await shot(false);
        const pos = await p.ev(() => { const g = window.__world.game; const [cx, cy] = g.camera.view(); return [g.player.body.x - cx, g.player.body.y - cy]; });
        // the world beside her: a 120 x 120 box (view px) ahead of her at chest height, in page px (1.5x)
        const box = [Math.round((pos[0] + 60) * 1.5), Math.round((pos[1] - 140) * 1.5), 180, 180];
        const m = await lumaDiff(p, A, B, box);
        r[`${mode}-${lvl}`] = m;
        if (mode === "fixed" || lvl === 1) {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(`${d}/${room}-${mode}-strike${lvl}.png`, Buffer.from(A, "base64"));
        }
        await shotPlayer(p, `${d}/${room}-${mode}-strike${lvl}-player.png`);
      }
    }
    const k = (mode, l) => +(r[`${mode}-${l}`].playerLuma / r[`${mode}-0`].playerLuma).toFixed(2);
    const w = (mode, l) => +(r[`${mode}-${l}`].worldLuma / r[`${mode}-0`].worldLuma).toFixed(2);
    res[room] = { ...r, playerRatio: { fixed05: k("fixed", 0.5), fixed1: k("fixed", 1), before05: k("before", 0.5), before1: k("before", 1) }, worldRatio: { fixed1: w("fixed", 1), before1: w("before", 1) } };
    note(`strike ${room}: player x${res[room].playerRatio.fixed1} at a full strike (before x${res[room].playerRatio.before1}); world x${res[room].worldRatio.fixed1}`);
    await p.ev(() => { const g = window.__world.game; g.gate.allow = g.__allow; g.player.spriteDraw = g.player.__sd; g.weather.lighting = g.weather.__lighting; g.lights = g.__lights; });
  }
  res.errors = p.errors;
  res.bad = p.bad;
  await p.ctx.close();
  save("strike", res);
  out.strike = res;
}

// --- summon: the view is on the seal ring while it lights in sequence and holds --------------
async function summon() {
  const d = dir("summon");
  const res = { frames: [] };
  for (const [vname, vo] of [["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("manual&fresh&mute", vo);
    await p.ev(() => window.__world.begin());
    await p.ev(() => window.__world.teleport("D3", "west"));
    await settle(p, "D3");
    await placeAt(p, 255.3);
    await p.ev(() => window.__world.use());
    await p.ev(() => window.__world.advance(60));
    const woke = await p.ev(() => window.__world.game.room.pixel.world.find("terminal").state);
    if (vname === "1080p") await p.page.screenshot({ path: `${d}/D3-${vname}-woken.png` });
    await p.ev(() => window.__world.use());
    let t = 0;
    for (const at of [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 3.2, 4.4, 5.4, 7]) {
      await p.ev((n) => window.__world.advance(n), Math.round((at - t) * 60));
      t = at;
      const s = await p.ev(() => {
        const g = window.__world.game;
        const [cx] = g.camera.view();
        const seals = g.room.pixel.world.find("seals");
        const o = g.room.def.origin[0];
        const lit = seals.refs.lights.map((l) => +l.level.toFixed(2));
        const xs = [-2, -1, 0, 1, 2].map((k) => o + (seals.x + k * 2.5 * 80) / 80);
        const view = [+(o + cx / 80).toFixed(2), +(o + (cx + 1280) / 80).toFixed(2)];
        const inView = xs.map((x) => x - 0.5 >= view[0] && x + 0.5 <= view[1]);
        return { terminal: g.room.pixel.world.find("terminal").state, seals: seals.state, lit, inView, view, closeup: +g.camera.closeup.toFixed(2), bars: +g.camera.bars.toFixed(3), panel: g.panels.kind, playerX: +(o + g.player.body.x / 80).toFixed(2) };
      });
      if (vname === "1080p") res.frames.push({ at, ...s });
      else res[`${vname}-${at}`] = s;
      if (vname === "1080p" || at === 2.4) await p.page.screenshot({ path: `${d}/D3-${vname}-t${at}.png` });
    }
    res[`woke-${vname}`] = woke;
    res[`errors-${vname}`] = p.errors;
    res[`bad-${vname}`] = p.bad;
    await p.ctx.close();
  }
  for (const f of res.frames) note(`summon t ${f.at}: ${f.terminal}/${f.seals} lit ${f.lit.join(" ")} inView ${f.inView.map((v) => (v ? 1 : 0)).join("")} view ${f.view.join("-")} closeup ${f.closeup} panel ${f.panel}`);
  save("summon", res);
  out.summon = res;
}

// --- archive: each bay opens its own product's real doc pages --------------------------------
async function archive() {
  const d = dir("archive");
  const res = {};
  for (const [vname, vo] of [["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("manual&fresh&mute", vo);
    await p.ev(() => window.__world.begin());
    await p.ev(() => window.__world.teleport("C2", "door"));
    await settle(p, "C2");
    for (const [id, x] of [["docs-index", 236.4], ["bay-1", 241.0], ["bay-2", 243.0], ["bay-3", 245.0]]) {
      if (vname !== "1080p" && id !== "bay-3") continue;
      await placeAt(p, x);
      const near = await p.ev(() => window.__world.state().near);
      await p.ev(() => window.__world.use());
      await p.ev(() => window.__world.advance(10));
      // let the frame load its page
      for (let k = 0; k < 60; k++) {
        const ok = await p.ev(() => { const f = document.querySelector("#panel iframe"); return !!f?.contentDocument && f.contentDocument.readyState === "complete" && f.contentDocument.location.href !== "about:blank"; });
        if (ok) break;
        await p.page.waitForTimeout(100);
      }
      await p.page.waitForTimeout(400);
      const panel = await p.ev(() => {
        const el = document.getElementById("panel");
        const f = el.querySelector("iframe");
        const doc = f?.contentDocument;
        return {
          kind: window.__world.game.panels.kind,
          title: el.querySelector("h2")?.textContent,
          frame: f?.getAttribute("src") ?? null,
          frameTitle: doc?.title ?? null,
          frameH1: doc?.querySelector("h1")?.textContent?.trim() ?? null,
          link: el.querySelector("p.alt a")?.getAttribute("href") ?? null,
          buttons: [...el.querySelectorAll("button[data-doc]")].map((b) => ({ doc: b.dataset.doc, text: b.textContent, pressed: b.getAttribute("aria-pressed") })),
          focus: document.activeElement?.className ?? document.activeElement?.tagName,
        };
      });
      await p.page.screenshot({ path: `${d}/C2-${id}-${vname}.png` });
      const r = { near, ...panel };
      if (panel.buttons.length > 1) {
        await p.page.click(`#panel button[data-doc="${panel.buttons[1].doc}"]`);
        for (let k = 0; k < 60; k++) {
          const ok = await p.ev((u) => { const f = document.querySelector("#panel iframe"); return f?.contentDocument?.location.pathname === u && f.contentDocument.readyState === "complete"; }, panel.buttons[1].doc);
          if (ok) break;
          await p.page.waitForTimeout(100);
        }
        await p.page.waitForTimeout(400);
        r.second = await p.ev(() => {
          const el = document.getElementById("panel");
          const f = el.querySelector("iframe");
          return { frame: f?.getAttribute("src"), frameH1: f?.contentDocument?.querySelector("h1")?.textContent?.trim() ?? null, link: el.querySelector("p.alt a")?.getAttribute("href"), pressed: [...el.querySelectorAll("button[data-doc]")].map((b) => b.getAttribute("aria-pressed")) };
        });
        await p.page.screenshot({ path: `${d}/C2-${id}-${vname}-second.png` });
      }
      // Esc closes, back to the world
      await p.page.keyboard.press("Escape");
      await p.ev(() => window.__world.advance(20));
      r.closed = await p.ev(() => !window.__world.game.panels.open);
      res[`${id}-${vname}`] = r;
      note(`archive ${id} ${vname}: ${r.title} -> ${r.frame} (h1 "${r.frameH1}")${r.second ? `, then ${r.second.frame} (h1 "${r.second.frameH1}")` : ""}`);
    }
    res[`errors-${vname}`] = p.errors;
    res[`bad-${vname}`] = p.bad;
    await p.ctx.close();
  }
  save("archive", res);
  out.archive = res;
}

/** Real-time sound samples (the world running on its own clock, sound on). */
async function sample(p, secs, every = 0.25) {
  const rows = [];
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < secs) {
    rows.push(
      await p.ev(() => {
        const g = window.__world.game;
        const a = g.audio;
        const o = g.room.def.origin ?? [0, 0];
        const val = (n) => (n ? +n.gain.value.toFixed(4) : null);
        return {
          t: +g.seconds.toFixed(2),
          room: g.room.def.id,
          area: g.area?.id ?? null,
          x: +(o[0] + g.player.body.x / 80).toFixed(2),
          y: +(o[1] - g.player.body.y / 80).toFixed(2),
          music: a.state.music,
          level: +a.state.level.toFixed(3),
          muffle: +a.state.muffle.toFixed(3),
          muffleHz: a.muffleFilt ? Math.round(a.muffleFilt.frequency.value) : null,
          muffleGain: a.muffleGain ? +a.muffleGain.gain.value.toFixed(3) : null,
          musicGain: a.music ? +a.music.gain.gain.value.toFixed(4) : null,
          cue: a.music ? +a.music.el.currentTime.toFixed(2) : null,
          bed: a.state.bed,
          bedGain: a.bed ? +a.bed.gain.gain.value.toFixed(4) : null,
          rain: val(a.rain?.gain),
          wind: val(a.wind?.gain),
          flag: g.save.get("blade:cleared"),
          rms: window.__rms ? window.__rms() : null,
        };
      }),
    );
    await p.page.waitForTimeout(every * 1000);
  }
  return rows;
}
/** Adds an analyser on the master output: RMS dBFS, read with each sample. */
async function tapMaster(p) {
  await p.ev(() => {
    const a = window.__world.game.audio;
    const ctx = a.ctx;
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    a.master.connect(an);
    const buf = new Float32Array(an.fftSize);
    window.__rms = () => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += v * v;
      return +(10 * Math.log10(s / buf.length + 1e-12)).toFixed(1);
    };
  });
}

// --- lift: the lift ride's music opens up as the car climbs out of the hollow ----------------
async function lift() {
  const d = dir("lift");
  const p = await open("fresh&go");
  await p.page.waitForTimeout(1500);
  await p.ev(() => { const g = window.__world.game; for (let n = 1; n <= 3; n++) g.save.set(`shrine:${n}`, true); window.__world.teleport("C3", ""); });
  await settle(p, "C3", false);
  // the theme is playing (muffled underground) before the ride
  await p.page.waitForTimeout(12000);
  await p.ev(() => window.__world.teleport("D1", "bottom"));
  const rows = await sample(p, 24);
  await p.page.screenshot({ path: `${d}/D1-top.png` });
  const first = rows.find((r) => r.room === "D1");
  const last = rows[rows.length - 1];
  const res = { rows, summary: { start: first, end: last, muffleSeen: [...new Set(rows.filter((r) => r.room === "D1").map((r) => r.muffle))].length, errors: p.errors, bad: p.bad, aborted: p.aborted } };
  note(`lift: muffle ${first?.muffle} (${first?.muffleHz} Hz) at y ${first?.y} -> ${last.muffle} (${last.muffleHz} Hz, gain ${last.muffleGain}) at y ${last.y}; ${res.summary.muffleSeen} distinct steps; music ${last.music}`);
  await p.ctx.close();
  save("lift", res);
  out.lift = res;
}

// --- blade: the storm's sound cuts off at the break, two seconds of silence, then the swell ----
async function blade() {
  const d = dir("blade");
  const res = {};
  const p = await open("fresh&go");
  await p.page.waitForTimeout(1500);
  await p.ev(() => { const g = window.__world.game; for (let n = 1; n <= 4; n++) g.save.set(`shrine:${n}`, true); for (const k of ["cut:map-banner", "cut:rope-bridge", "lever:culvert", "keeper:greeted", "lever:express"]) g.save.set(k, true); window.__world.teleport("D4", "west"); });
  await settle(p, "D4", false);
  await tapMaster(p);
  await p.ev(() => {
    const g = window.__world.game;
    window.__clearedStormCues = [];
    const play = g.audio.play.bind(g.audio);
    g.audio.play = (id, ...args) => {
      if (id.startsWith("storm.") && g.save.get("blade:cleared")) window.__clearedStormCues.push({ id, t: g.seconds });
      return play(id, ...args);
    };
    window.__restoreStormPlay = () => { g.audio.play = play; };
  });
  // stand in the storm long enough for its sound to settle, then walk east over the break with the real arrow key
  await p.page.waitForTimeout(8000);
  await p.page.keyboard.down("ArrowRight");
  const rows = [];
  const t0 = Date.now();
  let crossedAt = null;
  while ((Date.now() - t0) / 1000 < 26) {
    const r = (await sample(p, 0.1, 0.1))[0];
    r.wall = +((Date.now() - t0) / 1000).toFixed(2);
    rows.push(r);
    if (crossedAt === null && r.area === "D4-break") crossedAt = r.wall;
    if (crossedAt !== null && r.wall - crossedAt > 1.2) await p.page.keyboard.up("ArrowRight");
    if (r.wall > 3 && crossedAt === null && r.x > 300) break;
  }
  await p.page.screenshot({ path: `${d}/D4-after-break.png` });
  const rel = rows.filter((r) => crossedAt !== null).map((r) => ({ ...r, since: +(r.wall - crossedAt).toFixed(2) }));
  const before = rel.filter((r) => r.since < 0 && r.since > -2);
  const gap = rel.filter((r) => r.since >= 0.5 && r.since <= 1.9);
  const firstMusic = rel.find((r) => r.since > 0 && r.musicGain !== null && r.musicGain > 0.005);
  const firstBed = rel.find((r) => r.since > 0 && r.bed === "dusk" && r.bedGain > 0.005);
  const avg = (a, k) => +(a.reduce((s, r) => s + r[k], 0) / Math.max(1, a.length)).toFixed(1);
  res.summary = {
    crossedAt,
    stormRmsBefore: avg(before, "rms"),
    silenceRms: avg(gap, "rms"),
    silenceMax: Math.max(...gap.map((r) => r.rms)),
    rainWindInSilence: Math.max(...gap.map((r) => (r.rain ?? 0) + (r.wind ?? 0))),
    firstMusicAt: firstMusic?.since ?? null,
    firstMusicCue: firstMusic?.cue ?? null,
    firstBedAt: firstBed?.since ?? null,
    cleared: rows[rows.length - 1].flag,
  };
  // This is the first uninterrupted crossing, while the old storm's rain
  // is still easing. A teleport to clear weather would hide the regression.
  res.clearedStormCues = await p.ev(() => { window.__restoreStormPlay(); return window.__clearedStormCues; });
  res.rows = rel;
  note(`blade: storm ${res.summary.stormRmsBefore} dBFS -> ${res.summary.silenceRms} dBFS (max ${res.summary.silenceMax}) in the 0.5-1.9 s after the break; music audible from +${res.summary.firstMusicAt} s (cue ${res.summary.firstMusicCue}); dusk bed from +${res.summary.firstBedAt} s`);
  // a later visit: cleared, walking back west stays dusk (bed) with the theme
  await p.ev(() => window.__world.teleport("D4", "west"));
  await settle(p, "D4", false);
  await p.page.waitForTimeout(6000);
  res.later = (await sample(p, 0.3))[0];
  // A complete gust cycle after the flag, including on a later visit. Rain
  // can still be easing, but storm.tell/gust must never return to the sound.
  res.laterStormCues = await p.ev(() => {
    const g = window.__world.game;
    const cues = [];
    const play = g.audio.play.bind(g.audio);
    g.audio.play = (id, ...args) => { if (id.startsWith("storm.")) cues.push(id); return play(id, ...args); };
    window.__world.advance(60 * 18);
    g.audio.play = play;
    return cues;
  });
  note(`blade later visit (west part, cleared): bed ${res.later.bed}, music ${res.later.music}, rain ${res.later.rain}`);
  res.errors = p.errors;
  res.bad = p.bad;
  res.aborted = p.aborted;
  await p.ctx.close();
  save("blade", res);
  out.blade = res;
}

// --- lamps: every lit shrine shows as a lamp point from the Blade's tip ----------------------
async function lamps() {
  const d = dir("lamps");
  const res = {};
  for (const [vname, vo] of [["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("manual&fresh&mute", vo);
    await p.ev(() => window.__world.begin());
    for (const lit of vname === "1080p" ? [0, 3, 6] : [6]) {
      await p.ev((lit) => {
        const g = window.__world.game;
        for (let n = 1; n <= 6; n++) g.save.set(`shrine:${n}`, n <= lit);
        g.save.set("blade:cleared", true);
        window.__world.teleport("D4", "east");
      }, lit);
      await settle(p, "D4");
      await placeAt(p, 313.2);
      // stand still for the vista hold, and let the storm driver read the save
      await p.ev(() => window.__world.advance(60 * 5));
      const s = await p.ev(() => {
        const g = window.__world.game;
        const [cx, cy] = g.camera.view();
        return { view: [cx, cy], zone: +g.camera.zoneWeight.toFixed(2), lit: [1, 2, 3, 4, 5, 6].filter((n) => g.save.get(`shrine:${n}`)) };
      });
      await p.page.screenshot({ path: `${d}/D4-tip-${lit}lit-${vname}.png` });
      res[`${vname}-${lit}`] = s;
    }
    res[`errors-${vname}`] = p.errors;
    res[`bad-${vname}`] = p.bad;
    await p.ctx.close();
  }
  save("lamps", res);
  out.lamps = res;
}

// --- api: the story API rebuilds a room and sets the start place; the runtime feeds the actor --
async function api() {
  dir("api");
  const p = await open("manual&fresh&mute");
  await p.ev(() => window.__world.begin());
  const res = await p.ev(() => {
    const w = window.__world, g = w.game, api = g.api;
    const out = {};
    w.teleport("A1", "start");
    for (let i = 0; i < 400 && g.stream.status().split(" ").filter((s) => s.endsWith("*")).length < 3; i++) w.advance(5);
    out.warm = g.stream.status();
    const neighbour = g.room.def.neighbours.find((id) => g.stream.rooms.get(id)?.built);
    out.rebuildCurrent = api.rebuild("A1");
    out.rebuildNeighbour = [neighbour, api.rebuild(neighbour), g.stream.rooms.get(neighbour)?.built];
    out.rebuildUnknown = api.rebuild("nowhere");
    api.setRest("E2", "west");
    out.restAfterSet = g.save.data.rest;
    out.stored = JSON.parse(localStorage.getItem("dex.world.v1") ?? "{}").rest ?? null;
    // the pixel world's actor is the player in every room with pixel matter, fed by the runtime
    out.actors = {};
    for (const id of ["A1", "B1", "C1", "C2", "D2", "E1", "E3"]) {
      w.teleport(id, "");
      w.advance(3);
      const a = g.room.pixel?.world.actors?.[0];
      const b = g.player.body;
      out.actors[id] = a ? { x: Math.round(a.x), y: Math.round(a.y), player: [Math.round(b.x), Math.round(b.y)], h: a.h } : null;
    }
    return out;
  });
  // no story or Ringwater code reaches through the page's world handle any more
  const { readdirSync, readFileSync } = await import("node:fs");
  res.worldHandleReachIns = ["src/world/story", "src/world/rooms/ringwater"].flatMap((dd) => readdirSync(dd).filter((f) => f.endsWith(".ts")).filter((f) => readFileSync(`${dd}/${f}`, "utf8").includes("__world")).map((f) => `${dd}/${f}`));
  res.errors = p.errors;
  res.bad = p.bad;
  await p.ctx.close();
  save("api", res);
  note(`api: rebuild current ${res.rebuildCurrent}, neighbour ${JSON.stringify(res.rebuildNeighbour)}, rest ${JSON.stringify(res.restAfterSet)}; actors ${Object.entries(res.actors).map(([k, v]) => `${k}:${v ? "ok" : "none"}`).join(" ")}`);
  out.api = res;
}

async function migration() {
  dir("migration");
  const saved = { v: 1, flags: { "migration:keep": true }, rest: { room: "plain", spawn: "shrine" }, sound: false, props: { retained: { cut: true } } };
  const p = await open("manual", { saved });
  const normal = await p.ev(() => { const g = window.__world.game; return { room: g.room.def.id, ids: g.roomIds(), data: g.save.data }; });
  const errors = [...p.errors], bad = [...p.bad];
  await p.ctx.close();
  const test = await open("world=test&room=house&manual&mute");
  const legacy = await test.ev(() => ({ room: window.__world.game.room.def.id, ids: window.__world.game.roomIds() }));
  errors.push(...test.errors); bad.push(...test.bad);
  await test.ctx.close();
  out.migration = { normal, legacy, errors, bad };
  save("migration", out.migration);
}
// Optional B4 branch: walk/jump from the shelter to the summit. Positions
// are observed after real inputs; no placement/teleport once the route starts.
async function stonetop() {
  const d = dir("stonetop");
  const p = await open("room=B2&spawn=shrine&manual&fresh&mute");
  await p.ev(() => window.__world.begin());
  await settle(p, "B2");
  const route = await p.ev(() => {
    const w = window.__world, g = w.game, b = g.player.body;
    const o = g.room.def.origin;
    const pos = () => ({ x: +(o[0] + b.x / 80).toFixed(3), y: +(o[1] - b.y / 80).toFixed(3), grounded: b.grounded, area: g.area?.id });
    const steer = (x) => { const dx = x - (o[0] + b.x / 80); w.release("left"); w.release("right"); if (Math.abs(dx) > 0.045) w.press(dx < 0 ? "left" : "right"); };
    const walk = (x) => { for (let n = 0; n < 180; n++) { steer(x); g.realTick(); if (Math.abs(pos().x - x) < 0.08) break; } w.release("left"); w.release("right"); for (let n = 0; n < 12; n++) g.realTick(); };
    const hops = [];
    const jump = (x, y) => {
      const from = pos();
      // Discriminate reach from driver timing with the actual controller,
      // collision and input classes. Cosmetic events are silent in the search;
      // the selected inputs are then executed on the real world below.
      let plan = null;
      const noop = () => {};
      const cosmetic = new Proxy({}, { get: () => noop });
      for (const lead of [0, 3, 6, 9]) for (const second of [16, 20, 22, 26, 30]) {
        if (plan) break;
        const player = new g.player.constructor(g.player.sprite, g.player.t, { vfx: cosmetic, feel: cosmetic, camera: cosmetic }, [b.x, b.y]);
        player.body.grounded = b.grounded;
        const collision = new g.room.collision.constructor(g.room.def.w, g.room.def.h);
        collision.solids = g.room.collision.solids.map((s) => ({ ...s }));
        collision.oneWays = g.room.collision.oneWays.map((s) => ({ ...s }));
        const input = Object.create(Object.getPrototypeOf(g.input));
        input.held = new Map([...g.input.held.keys()].map((a) => [a, new Set()]));
        input.pressedAt = new Map(); input.releasedAt = new Map(); input.tick = 0;
        let airborne = false;
        for (let n = -lead; n < 150; n++) {
          const dx = x - (o[0] + player.body.x / 80);
          input.up("left", "trial"); input.up("right", "trial");
          if (Math.abs(dx) > 0.045) input.down(dx < 0 ? "left" : "right", "trial");
          if (n === 0 || n === second) input.down("jump", "trial");
          if (n === second - 2 || n === second + 20) input.up("jump", "trial");
          player.update(input, collision, []); input.tick++;
          if (n >= 0 && !player.body.grounded) airborne = true;
          if (airborne && n > second && player.body.grounded) {
            const py = o[1] - player.body.y / 80;
            const px = o[0] + player.body.x / 80;
            if (Math.abs(py - y) < 0.05 && Math.abs(px - x) < 0.6) plan = { lead, second };
            break;
          }
        }
      }
      if (!plan) { hops.push({ from, target: [x, y], reached: false, reason: "no double-jump timing found by actual-controller discriminator" }); return false; }
      let airborne = false;
      let peak = from.y;
      const trace = [];
      w.release("jump");
      for (let n = -plan.lead; n < 150; n++) {
        steer(x);
        if (n === 0 || n === plan.second) w.press("jump");
        if (n === plan.second - 2 || n === plan.second + 20) w.release("jump");
        g.realTick();
        peak = Math.max(peak, pos().y);
        if ([0, 20, 22, 35, 45, 55, 70].includes(n)) trace.push({ tick: n, ...pos() });
        if (n >= 0 && !b.grounded) airborne = true;
        if (airborne && n > plan.second && b.grounded) break;
      }
      w.release("left"); w.release("right"); w.release("jump");
      const to = pos();
      const reached = to.grounded && Math.abs(to.y - y) < 0.05 && Math.abs(to.x - x) < 0.6;
      hops.push({ from, target: [x, y], to, reached, peak, trace, plan, moves: ["jump", "double-jump"] });
      return reached;
    };
    for (let n = 0; n < 60; n++) g.realTick();
    const steps = [
      [159.0, 159.0, 3.3], [158.5, 157.65, 4.6], [157.95, 159.9, 5.3],
      [166.6, 166.6, 6.8], [167.35, 169.1, 8.3], [169.1, 167.35, 9.8],
      [166.05, 163.9, 11.3], [162.55, 160.95, 12.8], [160.95, 162.55, 14.3],
      [163.95, 165.6, 15.8], [165.6, 165.6, 17.3],
    ];
    for (const [takeoff, x, y] of steps) { walk(takeoff); if (!jump(x, y)) break; }
    w.advance(180);
    return { hops, expectedHops: steps.length, end: pos() };
  });
  await p.page.screenshot({ path: `${d}/route-end.png` });
  route.errors = p.errors; route.bad = p.bad;
  save("stonetop", route);
  await p.ctx.close();
  out.stonetop = route;
  note(`stonetop: ${route.hops.filter((h) => h.reached).length}/${route.expectedHops} double-jump ledges, end ${JSON.stringify(route.end)}`);
}
const checks = { smoke, sit, strike, summon, archive, lift, blade, lamps, api, migration, stonetop };
for (const [k, f] of Object.entries(checks)) if (which === k || which === "all") await f();
await browser.close();
const failures = [];
const requirePass = (ok, message) => { if (!ok) failures.push(message); };
const errorsIn = (obj, path = "") => {
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (/^(errors|bad)(-|$)/.test(k)) requirePass(Array.isArray(v) && v.length === 0, `${path}${k}: ${JSON.stringify(v)}`);
    else if (v && typeof v === "object") errorsIn(v, `${path}${k}.`);
  }
};
errorsIn(out);
if (out.stonetop) requirePass(out.stonetop.hops.length === out.stonetop.expectedHops && out.stonetop.hops.every((h) => h.reached && h.to.grounded) && out.stonetop.end.area === "B4" && out.stonetop.end.grounded && Math.abs(out.stonetop.end.y - 17.3) < 0.05, "stonetop: optional double-jump route must reach the grounded summit through real input");
if (out.migration) {
  const { normal, legacy } = out.migration;
  requirePass(normal.room === "A1" && !normal.ids.includes("plain"), "migration: phase1 rest must fall back to phase2 dock");
  requirePass(normal.data.flags["migration:keep"] && normal.data.props.retained.cut && normal.data.sound === false && normal.data.rest.room === "plain", "migration: preserve old progress, sound and rest for rollback");
  requirePass(legacy.room === "house" && legacy.ids.includes("plain") && !legacy.ids.includes("A1"), "migration: explicit test world must remain accessible");
}
if (out.sit) for (const [k, v] of Object.entries(out.sit)) if (v && "stoodUp" in v) requirePass(v.sitting && v.drawn && v.stoodUp && v.satAgain, `sit: ${k} must sit, stand, and sit again on one use`);
if (out.strike) for (const id of ["D1", "D2", "D3"]) requirePass(out.strike[id]?.playerRatio.fixed1 < 1.15, `strike: ${id} brightens player by 15% or more`);
if (out.summon) for (const f of out.summon.frames) requirePass(f.inView.every(Boolean), `summon: seals clipped at ${f.at}s`);
if (out.archive) for (const [k, v] of Object.entries(out.archive)) if (v?.frame) {
  const expected = k.startsWith("docs-index") ? "/docs/" : k.startsWith("bay-1") ? "/docs/installing-dexclient/" : k.startsWith("bay-2") ? "/docs/dexcode/" : "/docs/about-dex-place/";
  requirePass(v.frameH1 && v.closed && v.frame.split("?")[0] === expected, `archive: ${k} must load its product's doc and close`);
  if (v.second) requirePass(v.second.frame.split("?")[0] === "/docs/writing-docs/" && v.second.pressed.filter((p) => p === "true").length === 1, `archive: ${k} second page/selection mismatch`);
}
if (out.lift) requirePass(out.lift.summary.muffleSeen > 10 && out.lift.summary.start.muffle >= 0.95 && out.lift.summary.end.muffle <= 0.05, "lift: music must open through a gradual muffle ramp");
if (out.api) {
  requirePass(out.api.rebuildCurrent === false && out.api.rebuildNeighbour[1] === true && out.api.rebuildUnknown === false, "api: rebuild boundary failed");
  requirePass(out.api.stored?.room === "E2" && out.api.stored?.spawn === "west" && out.api.worldHandleReachIns.length === 0, "api: start-place persistence/reach-in failed");
  for (const [id, a] of Object.entries(out.api.actors)) requirePass(a && a.h === 80 && a.x === a.player[0] && Math.abs(a.y - a.player[1]) < 2, `api: actor not fed in ${id}`);
}
if (out.blade) {
  requirePass(out.blade.summary.crossedAt !== null && out.blade.summary.cleared, "blade: clear trigger not reached");
  requirePass(out.blade.summary.silenceMax <= -50 && out.blade.summary.rainWindInSilence < 0.001, "blade: storm does not cut to silence");
  requirePass(out.blade.clearedStormCues.length === 0, `blade: cleared storm cues ${out.blade.clearedStormCues}`);
  requirePass(out.blade.laterStormCues.length === 0, `blade: later storm cues ${out.blade.laterStormCues}`);
}
writeFileSync(`${ROOT}/verdict-${which}.json`, JSON.stringify({ at: new Date().toISOString(), angle, checks: Object.keys(out), failures, passed: failures.length === 0 }, null, 2));
if (failures.length) throw new Error(failures.join("\n"));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
