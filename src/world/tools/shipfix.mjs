// Evidence for the ship-fix pass (the cross-lane problems I1's integrated round found).
//   node src/world/tools/shipfix.mjs <check> [--port 25001]
// Checks: smoke, strike, summon, archive, lift, blade, lamps, sit, api, all.
// Every check records console errors and every HTTP response of 400 or more,
// unfiltered, and writes to review/world/phase2/ship-fix/<check>/.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "25001");
const ROOT = "review/world/phase2/ship-fix";
const which = process.argv[2] ?? "all";
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const out = {};
const note = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

/** A world page: size, device scale, query. Collects errors and bad responses. */
async function open(query, { w = 1280, h = 720, dpr = 1, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
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
async function placeAt(p, wx) {
  await p.ev((wx) => {
    const g = window.__world.game;
    // on the ground under her feet (not the top of whatever stands over it: the Crown's overhang)
    const x = (wx - (g.room.def.origin?.[0] ?? 0)) * 80;
    window.__world.place(x, g.room.collision.groundAt(x, g.player.body.y - 40));
  }, wx);
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
    ["C1-market-bench", "C1", "", 215.9],
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
      await placeAt(p, x);
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
      res[`${name}-${vname}`] = { ...s, before, crop, stoodUp: !!stood };
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
  out.lift = res.summary;
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
  res.rows = rel;
  note(`blade: storm ${res.summary.stormRmsBefore} dBFS -> ${res.summary.silenceRms} dBFS (max ${res.summary.silenceMax}) in the 0.5-1.9 s after the break; music audible from +${res.summary.firstMusicAt} s (cue ${res.summary.firstMusicCue}); dusk bed from +${res.summary.firstBedAt} s`);
  // a later visit: cleared, walking back west stays dusk (bed) with the theme
  await p.ev(() => window.__world.teleport("D4", "west"));
  await settle(p, "D4", false);
  await p.page.waitForTimeout(6000);
  res.later = (await sample(p, 0.3))[0];
  note(`blade later visit (west part, cleared): bed ${res.later.bed}, music ${res.later.music}, rain ${res.later.rain}`);
  res.errors = p.errors;
  res.bad = p.bad;
  res.aborted = p.aborted;
  await p.ctx.close();
  save("blade", res);
  out.blade = res.summary;
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

const checks = { smoke, sit, strike, summon, archive, lift, blade, lamps };
for (const [k, f] of Object.entries(checks)) if (which === k || which === "all") await f();
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
