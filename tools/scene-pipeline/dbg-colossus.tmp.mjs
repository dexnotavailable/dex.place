import { chromium } from "playwright-core";
const scene = process.argv[2] ?? "colossus-plain";
const b = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"] });
const p = await b.newPage();
p.on("pageerror", e => console.log("[err]", e.message.slice(0, 1500)));
p.on("console", m => { if (m.text().startsWith("[T]")) console.log(m.text()); });
await p.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype;
  const src = new WeakMap();
  const oSrc = P.shaderSource; P.shaderSource = function (s, t) { src.set(s, t); return oSrc.call(this, s, t); };
  const oAtt = P.attachShader; const att = new WeakMap();
  P.attachShader = function (pr, s) { if (!att.has(pr)) att.set(pr, []); att.get(pr).push(src.get(s) || ""); return oAtt.call(this, pr, s); };
  const oGP = P.getProgramParameter;
  P.getProgramParameter = function (pr, n) { const t = performance.now(); const r = oGP.call(this, pr, n); const d = performance.now() - t;
    if (d > 150) { const fs = (att.get(pr) || []).map(x => x.length).join("/"); const m = (att.get(pr)||[]).join("").match(/vec4 layer\(vec2 p, vec2 s\) \{\n(.{0,80})/s); console.log(`[T] ${d.toFixed(0)}ms len ${fs} :: ${m ? m[1].replace(/\n/g," ") : ""}`); }
    return r; };
});
const t0 = Date.now();
await p.goto(`http://127.0.0.1:19588/scenes/?manual&scene=${scene}${process.argv[3] ?? ""}`);
await p.waitForFunction(() => window.__scenes?.engine?.sceneId || !document.getElementById("fail").hidden, null, { timeout: 280000 });
console.log(scene, "ready ms", Date.now() - t0, await p.evaluate(() => document.getElementById("fail").hidden ? "ok" : document.getElementById("fail").textContent.slice(0, 1500)));
await b.close();
