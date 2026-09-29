// Keep the isolated capture server and verifier inside one synchronous gate
// lease. No detached process, shared port eviction, or installed-app change.
// WORLD_ANGLE=swiftshader node src/world/tools/run-check.mjs round [tool args]
import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { stopOwnedProcess } from "./process-tree.mjs";
const scripts = { round: "src/world/story/_tools/round.mjs", shipfix: "src/world/tools/shipfix.mjs", sound: "src/world/sound/verify.mjs" };
const [kind, ...args] = process.argv.slice(2);
if (!scripts[kind]) throw new Error("Choose round, shipfix, or sound");
const port = process.env.WORLD_PORT ?? "25061";
if (!/^25\d{3}$/.test(port)) throw new Error("WORLD_PORT must be in the reserved 25000-25999 range");
const outIndex = args.indexOf("--out");
const root = outIndex >= 0 ? args[outIndex + 1] : "review/world/phase2/resumption-20260930";
if (!root) throw new Error("--out needs a directory");
mkdirSync(root, { recursive: true });
const log = createWriteStream(`${root}/${kind}.log`);
const children = new Set();
const nonce = randomUUID();
const start = (argv) => {
  const p = spawn(process.execPath, argv, { windowsHide: true, env: { ...process.env, WORLD_VERIFY_NONCE: nonce }, stdio: ["ignore", "pipe", "pipe"] });
  children.add(p);
  for (const stream of [p.stdout, p.stderr]) stream.on("data", (d) => { process.stdout.write(d); log.write(d); });
  return p;
};
const server = start(["node_modules/vite/bin/vite.js", "--config", "src/world/tools/vite.capture.config.mjs", "--port", port, "--strictPort", "--host", "127.0.0.1"]);
let serverError = null;
const serverStopped = new Promise((resolve) => { server.once("error", (e) => { serverError = e; resolve(e); }); server.once("exit", resolve); });
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (serverError || server.exitCode !== null) throw new Error(`Capture server failed: ${serverError ?? server.exitCode}`);
    try { const response = await fetch(`http://127.0.0.1:${port}/__world-verifier`); ready = response.ok && (await response.json()).nonce === nonce; } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("Capture server did not become ready");
  const verifier = start([scripts[kind], ...args, "--port", port]);
  const code = await Promise.race([
    new Promise((resolve, reject) => { verifier.once("error", reject); verifier.once("exit", resolve); }),
    serverStopped.then((why) => { throw new Error(`Owned capture server stopped during verification: ${why}`); }),
  ]);
  if (code !== 0) throw new Error(`${kind} verifier failed: ${code}`);
} finally {
  // Try every owned tree even if one cleanup fails; leave a concrete error.
  const stopped = await Promise.allSettled([...children].map(stopOwnedProcess));
  await new Promise((r) => log.end(r));
  const failed = stopped.filter((r) => r.status === "rejected");
  if (failed.length) throw new AggregateError(failed.map((r) => r.reason), "Owned verifier process-tree cleanup failed");
}
