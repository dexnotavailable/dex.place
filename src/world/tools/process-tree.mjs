// Teardown only ChildProcess instances created/tracked by this verifier.
// Windows forced Node termination skips Playwright's exit handlers, so kill
// its descendants in the same operation before releasing the source lease.
import { spawn } from "node:child_process";
export async function stopOwnedProcess(p) {
  if (!p.pid || p.exitCode !== null || p.signalCode !== null) return;
  const ended = new Promise((resolve) => p.once("exit", resolve));
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(p.pid), "/T", "/F"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let detail = "";
    killer.stderr.on("data", (d) => { detail += d; });
    const code = await new Promise((resolve, reject) => { killer.once("error", reject); killer.once("exit", resolve); });
    // A process can finish normally between the ownership check and taskkill.
    if (code !== 0 && p.exitCode === null && p.signalCode === null) throw new Error(`Owned process-tree cleanup failed for ${p.pid}: ${detail.trim()}`);
  } else {
    p.kill("SIGTERM"); // permits Playwright's normal graceful exit handlers
  }
  await ended;
}
