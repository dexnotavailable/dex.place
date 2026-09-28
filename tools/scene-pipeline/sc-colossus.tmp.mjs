import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const files = process.argv.slice(2);
const b = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11","--enable-gpu","--ignore-gpu-blocklist"] });
const p = await b.newPage();
await p.setContent("<canvas id=c></canvas>");
for (const fpath of files) {
  const src = readFileSync(fpath, "utf8");
  const r = await p.evaluate((src) => {
    const gl = document.getElementById("c").getContext("webgl2");
    const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, "#version 300 es\nvoid main(){gl_Position=vec4(0.0);}"); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, src); gl.compileShader(fs);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    const t = performance.now();
    const ok = gl.getProgramParameter(pr, gl.LINK_STATUS);
    return { ms: Math.round(performance.now() - t), ok, log: ok ? "" : (gl.getShaderInfoLog(fs) + gl.getProgramInfoLog(pr)).slice(0, 800) };
  }, src);
  console.log(fpath, JSON.stringify(r));
}
await b.close();
