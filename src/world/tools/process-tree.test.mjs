import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { stopOwnedProcess } from "./process-tree.mjs";

test("Windows verifier teardown terminates its own Node descendant", { skip: process.platform !== "win32", timeout: 15000 }, async () => {
  const script = `const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true, stdio: 'ignore' });
    console.log(child.pid); setInterval(() => {}, 1000);`;
  const parent = spawn(process.execPath, ["-e", script], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const pid = await new Promise((resolve, reject) => {
      let text = "";
      parent.once("error", reject);
      parent.stdout.on("data", (d) => { text += d; if (text.includes("\n")) resolve(Number(text.trim())); });
    });
    assert(Number.isInteger(pid) && pid > 0);
    assert.doesNotThrow(() => process.kill(pid, 0), "child must be alive before teardown");
    await stopOwnedProcess(parent);
    let alive = true;
    for (let n = 0; n < 50 && alive; n++) {
      try { process.kill(pid, 0); } catch (e) { assert.equal(e.code, "ESRCH"); alive = false; }
      if (alive) await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(alive, false, "descendant must not outlive verifier teardown");
    assert.notEqual(parent.exitCode, null);
  } finally {
    await stopOwnedProcess(parent);
  }
});
