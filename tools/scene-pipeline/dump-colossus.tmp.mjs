import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const b = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"] });
const p = await b.newPage();
let n = 0;
p.on("console", m => { const t = m.text(); if (t.startsWith("[SRC]")) { const s = t.slice(5); if (s.length > 30000) writeFileSync(`../../review/scenes/colossus-plain/fix-r2/tmp/fs${n++}.glsl`, s); } });
await p.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype;
  const oSrc = P.shaderSource; P.shaderSource = function (s, t) { console.log("[SRC]" + t); return oSrc.call(this, s, t); };
});
await p.goto(`http://127.0.0.1:19588/scenes/?manual&scene=colossus-plain`);
await p.waitForTimeout(8000);
console.log("dumped", n);
await b.close();
