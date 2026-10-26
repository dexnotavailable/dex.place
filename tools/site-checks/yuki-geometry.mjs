// Geometry checks for YUKI on dex.place, the ones the markup and CSS tests (src/site/yuki.test.mjs) can't make
// because they need real layout:
//   1. the drawn Windows prompt (render/yuki.ts smartScreen): each pixel cursor's tip lands inside what it taps, More
//      info and then Run anyway (never Don't run), at rest with motion and under reduced motion, phone to desktop;
//   2. the /yuki/ stage: her orb's ring and her line's bubble sit inside the stage at every width (it stacks under
//      900 px, where a cell is set by the stage's width), the longest line included;
//   3. the motion after the hatch: a click on her starts a new line's pop (and, once released, her hop), and the hop's
//      class really changes what plays (the hatch's own rules used to win);
//   4. everything of hers rests off screen: no animation of her sprite, stage, snow or drawn prompt runs well outside
//      the viewport on /yuki/, /downloads/ or the home page (the hero's snow sits beside the stage and used to run on);
//   5. the retired line: its tag flush with the line's left edge (the old addresses' anchors once took a flex gap), and
//      /downloads/#dexcode and #dexclient still land on it;
//   6. step one's per-browser lines sit inside their step, in the text's column, at phone to desktop widths.
//
// Needs a served build (npm run build, then npx vite preview --port 4173) and Microsoft Edge. playwright-core comes
// from tools/scene-pipeline (npm install --prefix tools/scene-pipeline), or from PLAYWRIGHT_CORE=<a folder holding it>.
//
//   node tools/site-checks/yuki-geometry.mjs [--base http://127.0.0.1:4173] [--headed]
//
// Exits 1 on any failure. Run it on a released build too (YUKI_RELEASE filled) for the hop after a click.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1] === undefined || args[i + 1].startsWith("--") ? true : args[i + 1];
};
const base = String(opt("base", "http://127.0.0.1:4173")).replace(/\/$/, "");

function loadChromium() {
  const from = [process.env.PLAYWRIGHT_CORE, fileURLToPath(new URL("../scene-pipeline/", import.meta.url))].filter(Boolean);
  for (const dir of from) {
    try {
      return createRequire(`${dir.replace(/[\\/]$/, "")}/`)("playwright-core").chromium;
    } catch {
      // next
    }
  }
  console.error("playwright-core not found: npm install --prefix tools/scene-pipeline, or set PLAYWRIGHT_CORE");
  process.exit(2);
}

const chromium = loadChromium();
const browser = await chromium.launch({ channel: "msedge", headless: opt("headed", false) !== true });
const fails = [];
const check = (ok, what) => {
  if (!ok) fails.push(what);
  return ok ? "ok" : "FAIL";
};

async function open(width, height, reduced) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  await page.goto(`${base}/yuki/`, { waitUntil: "load" });
  return { ctx, page };
}

// ---------------------------------------------------------------- 1. the cursors
console.log("1. the Windows prompt: cursor tip inside its target (x, y; target box)");
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  for (const reduced of [true, false]) {
    const { ctx, page } = await open(width, 900, reduced);
    await page.locator("[data-ss]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      // with motion: each cursor frozen where it rests (ss-a 30-50%, ss-b 80-96% of 7.2 s: translate 0, opacity 1)
      for (const a of document.getAnimations()) {
        const n = a.animationName;
        if (!n || !n.startsWith("ss-")) continue;
        a.pause();
        a.currentTime = n.endsWith("-a") ? 0.4 * 7200 : 0.88 * 7200;
      }
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const q = (s) => document.querySelector(s);
      return {
        a: box(q(".ss__cursor--a")), more: box(q(".ss__more .ss__target")),
        b: box(q(".ss__cursor--b")), run: box(q(".ss__btn--go")), dont: box(q(".ss__win--b .ss__btn:not(.ss__btn--go)")),
        winB: box(q(".ss__win--b")),
      };
    });
    const inside = (x, y, t) => x > t.l + 2 && x < t.r - 2 && y > t.t + 2 && y < t.b - 2;
    const fmt = (x, y, t) => `(${Math.round(x)},${Math.round(y)}) in [${Math.round(t.l)}-${Math.round(t.r)} x ${Math.round(t.t)}-${Math.round(t.b)}]`;
    const tag = `${width}${reduced ? " reduced" : " motion "}`;
    const okA = check(inside(g.a.l, g.a.t, g.more), `${tag}: cursor A off More info ${fmt(g.a.l, g.a.t, g.more)}`);
    const okB = check(inside(g.b.l, g.b.t, g.run) && !inside(g.b.l, g.b.t, g.dont), `${tag}: cursor B off Run anyway ${fmt(g.b.l, g.b.t, g.run)}`);
    // (its body may run past the window's foot a little and be clipped; the tip is what taps)
    const bodyIn = g.b.b <= g.winB.b + 1 ? "" : `  (B's body clipped ${Math.round(g.b.b - g.winB.b)} px at the window's foot)`;
    console.log(`  ${tag}  A ${okA} ${fmt(g.a.l, g.a.t, g.more)}   B ${okB} ${fmt(g.b.l, g.b.t, g.run)}${bodyIn}`);
    await ctx.close();
  }
}

// ---------------------------------------------------------------- 2. the stage
console.log("2. /yuki/ stage: ring and bubble inside the stage (px below the stage's top; bubble with the longest line)");
for (const width of [320, 375, 600, 700, 768, 820, 834, 899, 900, 1024, 1180, 1440, 1920]) {
  const { ctx, page } = await open(width, 1000, false);
  await page.waitForTimeout(2300);
  const g = await page.evaluate(() => {
    const stage = document.querySelector("[data-yuki-stage]");
    const say = stage.querySelector("[data-yuki-say]");
    const line = say.querySelector("[data-yuki-line]");
    const longest = ["hi! i'm Yuki.", "zz... not out yet.", "open it when it lands!", "five more minutes...", "snow's nice tonight.", "i live on your PC."]
      .sort((x, y) => y.length - x.length)[0];
    line.textContent = longest;
    const s = stage.getBoundingClientRect(), b = say.getBoundingClientRect();
    const ring = stage.querySelector(".ykstage__ring").getBoundingClientRect();
    const her = stage.querySelector(".ykstage__her").getBoundingClientRect();
    return { sTop: s.top, sH: s.height, sL: s.left, sR: s.right, bTop: b.top, bBot: b.bottom, bL: b.left, bR: b.right, ringTop: ring.top, herTop: her.top };
  });
  const r = (v) => Math.round(v);
  const bubbleIn = g.bTop >= g.sTop + 4 && g.bL >= g.sL && g.bR <= g.sR;
  const ringIn = g.ringTop >= g.sTop - 1;
  const clear = g.bBot <= g.herTop + 2;
  const ok = check(bubbleIn && ringIn, `${width}: bubble ${r(g.bTop - g.sTop)} / ring ${r(g.ringTop - g.sTop)} below the stage's top`);
  console.log(`  ${String(width).padStart(4)}  ${ok}  stage ${r(g.sH)} tall  bubble top ${r(g.bTop - g.sTop)}  ring top ${r(g.ringTop - g.sTop)}  bubble foot to her head ${r(g.herTop - g.bBot)}${clear ? "" : " (over her head)"}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 3. the motion after the hatch
console.log("3. after the hatch: a click on her, and the hop's class");
{
  const { ctx, page } = await open(1440, 900, false);
  await page.waitForTimeout(2300);
  const released = await page.evaluate(() => document.querySelector("[data-yuki-page]").dataset.release === "ready");
  await page.click("[data-yuki-stage]");
  await page.waitForTimeout(40);
  const after = await page.evaluate(() => {
    const names = (sel) => document.querySelector(sel).getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName);
    // (her hop is the sprite's own: svg.yk.is-hop moves its .yk__hop group in whole pixels)
    return { say: names("[data-yuki-say]"), her: names("[data-yuki-stage] svg.yk .yk__hop"), line: document.querySelector("[data-yuki-line]").textContent };
  });
  console.log(`  click (${released ? "released" : "not released"}): "${after.line}"  bubble ${JSON.stringify(after.say)}  her ${JSON.stringify(after.her)}`);
  check(after.say.includes("yk-say-new"), "a click: the bubble didn't pop");
  if (released) check(after.her.includes("yk-hop"), "a click: she didn't hop");
  // the class itself, whatever the release: off, a reflow, on (as motion/yuki.ts does)
  await page.waitForTimeout(800);
  const hop = await page.evaluate(() => {
    const g = document.querySelector("[data-yuki-stage] svg.yk");
    g.classList.remove("is-hop");
    void g.getBoundingClientRect();
    g.classList.add("is-hop");
    const hopper = g.querySelector(".yk__hop");
    const stage = document.querySelector("[data-yuki-stage] .ykstage__her");
    const running = [...hopper.getAnimations(), ...stage.getAnimations()].filter((a) => a.playState === "running").map((a) => a.animationName);
    return { name: getComputedStyle(hopper).animationName, running };
  });
  console.log(`  .is-hop: animation-name "${hop.name}", running ${JSON.stringify(hop.running)}`);
  check(hop.running.includes("yk-hop") && !hop.running.includes("yk-pop"), ".is-hop: the hop doesn't play, or the pop replays");
  await ctx.close();
}

// ---------------------------------------------------------------- 4. resting off screen
// Every running animation of hers (her sprite, her stage, the snow, the drawn prompt) whose picture is wholly outside
// the viewport (a quarter of its height past either edge: the observers wake things 10% early) is one too many. The
// picture is the box she is drawn in (the hero, the Downloads art, a banner, a card, the prompt, a tile): a tall one
// half on screen plays whole.
console.log("4. off screen: her animations still running with their picture wholly off screen (0 everywhere)");
async function runningOff(page) {
  return page.evaluate(() => {
    const mine = (el) => el instanceof Element && el.closest(".yk, .ykfx, .ykstage, .ykh, .ss");
    const picture = (el) => el.closest(".ykh, .dlf__art--yuki, [data-ss], .yktile, .pban__in, .pcard__in, .cart") ?? el;
    let on = 0, off = 0;
    const where = new Set();
    const slack = innerHeight * 0.25;
    for (const a of document.getAnimations()) {
      const el = a.effect && a.effect.target;
      if (a.playState !== "running" || !mine(el)) continue;
      const box = picture(el);
      const r = box.getBoundingClientRect();
      if (r.bottom < -slack || r.top > innerHeight + slack) { off++; where.add(String(box.className.baseVal ?? box.className).split(" ")[0]); } else on++;
    }
    return { on, off, where: [...where] };
  });
}
for (const [path, label] of [["/yuki/", "/yuki/"], ["/downloads/", "/downloads/"], ["/", "home"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(2400);
  const seen = [];
  for (const at of ["top", "middle", "bottom"]) {
    await page.evaluate((at) => {
      const h = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo({ top: at === "top" ? 0 : at === "middle" ? h / 2 : h, behavior: "instant" });
    }, at);
    await page.waitForTimeout(500);
    const g = await runningOff(page);
    check(g.off === 0, `${label} at the ${at}: ${g.off} of her animations run off screen (${g.where.join(", ")})`);
    seen.push(`${at} ${g.on} on / ${g.off} off${g.off ? ` (${g.where.join(", ")})` : ""}`);
  }
  console.log(`  ${label.padEnd(12)} ${seen.join("   ")}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 5. the retired line
console.log("5. the retired line: its tag flush with the line's own left edge (the old addresses' anchors take no room)");
for (const [path, label] of [["/downloads/", "/downloads/"], ["/", "home"]]) {
  for (const width of [390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    const g = await page.evaluate(() => [...document.querySelectorAll(".retired")].map((p) => {
      const r = p.getBoundingClientRect();
      const left = r.left + parseFloat(getComputedStyle(p).paddingLeft);
      const tag = p.querySelector(".retired__tag").getBoundingClientRect();
      return { cls: p.className.split(" ")[1], left, tag: tag.left };
    }));
    for (const line of g) {
      const ok = check(Math.abs(line.tag - line.left) <= 1, `${label} ${width}: ${line.cls} tag at ${line.tag.toFixed(1)}, line at ${line.left.toFixed(1)}`);
      console.log(`  ${label.padEnd(12)} ${String(width).padStart(4)}  ${ok}  ${line.cls}: line ${line.left.toFixed(1)}  tag ${line.tag.toFixed(1)}`);
    }
    await ctx.close();
  }
}
{
  // the old addresses still land on the line
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const id of ["dexcode", "dexclient"]) {
    await page.goto(`${base}/downloads/#${id}`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => { const r = document.querySelector(".retired--downloads").getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
    const ok = check(g.top >= 0 && g.bottom <= 800, `/downloads/#${id}: the retired line is not on screen (${Math.round(g.top)}-${Math.round(g.bottom)})`);
    console.log(`  /downloads/#${id}  ${ok}  line at ${Math.round(g.top)}-${Math.round(g.bottom)} of 800`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 6. the browsers' lines in the steps
console.log("6. step one's browser lines: inside their step, in the text's column, nothing wider than the page");
for (const path of ["/yuki/", "/downloads/", "/"]) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    const g = await page.evaluate(() => {
      const out = [];
      for (const ul of document.querySelectorAll("ul.ways")) {
        const step = ul.closest(".ykstep, .step");
        const text = step.querySelector(".ykstep__p, .step__text");
        const u = ul.getBoundingClientRect(), s = step.getBoundingClientRect(), t = text.getBoundingClientRect();
        const lis = [...ul.children].map((li) => li.getBoundingClientRect().height);
        out.push({ cls: ul.className, inStep: u.left >= s.left && u.right <= s.right && u.bottom <= s.bottom, col: Math.abs(u.left - t.left) <= 1, rows: lis.map(Math.round) });
      }
      return { lists: out, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    if (!g.lists.length) continue;
    for (const l of g.lists) {
      const ok = check(l.inStep && l.col && g.wide <= 0, `${path} ${width}: ${l.cls} in step ${l.inStep}, in the text's column ${l.col}, page ${g.wide} px too wide`);
      console.log(`  ${path.padEnd(12)} ${String(width).padStart(4)}  ${ok}  ${l.cls}  rows ${JSON.stringify(l.rows)}`);
    }
    await ctx.close();
  }
}

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} failed:\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log("\nall ok");
