// Geometry checks for YUKI on dex.place, the ones the markup and CSS tests (src/site/yuki.test.mjs) can't make
// because they need real layout:
//   1. the drawn Windows prompt (render/yuki.ts smartScreen): each pixel cursor's tip lands inside what it taps, More
//      info and then Run anyway (never Don't run), at rest with motion and under reduced motion, phone to desktop;
//   2. the /yuki/ stage: her orb's ring and her line's bubble sit inside the stage at every width (it stacks under
//      900 px, where a cell is set by the stage's width), the longest line included;
//   3. the motion after the hatch: a click on her starts a new line's pop (and, once released, her hop), and the hop's
//      class really changes what plays (the hatch's own rules used to win).
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
    return { say: names("[data-yuki-say]"), her: names("[data-yuki-stage] .ykstage__her"), line: document.querySelector("[data-yuki-line]").textContent };
  });
  console.log(`  click (${released ? "released" : "not released"}): "${after.line}"  bubble ${JSON.stringify(after.say)}  her ${JSON.stringify(after.her)}`);
  check(after.say.includes("yk-say-new"), "a click: the bubble didn't pop");
  if (released) check(after.her.includes("yk-hop"), "a click: she didn't hop");
  // the class itself, whatever the release: off, a reflow, on (as motion/yuki.ts does)
  await page.waitForTimeout(800);
  const hop = await page.evaluate(() => {
    const g = document.querySelector("[data-yuki-stage] .ykstage__her");
    g.classList.remove("is-hop");
    void g.getBoundingClientRect();
    g.classList.add("is-hop");
    return { name: getComputedStyle(g).animationName, running: g.getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName) };
  });
  console.log(`  .is-hop: animation-name "${hop.name}", running ${JSON.stringify(hop.running)}`);
  check(hop.running.includes("yk-hop") && !hop.running.includes("yk-pop"), ".is-hop: the hop doesn't play, or the pop replays");
  await ctx.close();
}

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} failed:\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log("\nall ok");
