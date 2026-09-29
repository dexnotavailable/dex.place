import { createRequire } from "node:module";
const require = createRequire("D:/Dex/Projects/dex.place/tools/scene-pipeline/package.json");
const { chromium } = require("playwright-core");
const b = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11"] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("PAGEERR", e.stack));
await page.goto("http://127.0.0.1:25001/world/?fresh&go", { timeout: 180000 });
await page.waitForTimeout(8000);
await b.close();
