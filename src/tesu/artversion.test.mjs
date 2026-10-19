// (lane C 10-19) The drawings' content versions (plates/bake-plugin.ts artVersions): the server and Cloudflare keep
// /assets/ for a year, so the loaders fetch every drawing folder's files under ?v=<hash of its files>; a changed
// drawing gets a new URL, an unchanged folder keeps its URL (still cached).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artVersions } from "./plates/bake-plugin.ts";

test("art versions: one per drawing folder (her slots, the cast's, the effects'), changing with any of its files", () => {
  const pub = mkdtempSync(join(tmpdir(), "tesu-art-"));
  try {
    const put = (rel, body) => { const f = join(pub, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, body); };
    put("assets/zhusha/idle/anim.json", "{}");
    put("assets/zhusha/idle/f000.png", "a");
    put("assets/zhusha/run/anim.json", "{}");
    put("assets/zhusha/run/f000.png", "a");
    put("assets/cast/lion/idle/anim.json", "{}");
    put("assets/fx/spark/fx.json", "{}");
    put("assets/zhusha/notes.txt", "not a slot");
    const v1 = artVersions(pub);
    assert.deepEqual(Object.keys(v1).sort(), ["/assets/cast/lion/idle", "/assets/fx/spark", "/assets/zhusha/idle", "/assets/zhusha/run"]);
    for (const h of Object.values(v1)) assert.match(h, /^[0-9a-f]{10}$/);
    // a redrawn frame under the same name: a new version for that slot only
    put("assets/zhusha/idle/f000.png", "b");
    const v2 = artVersions(pub);
    assert.notEqual(v2["/assets/zhusha/idle"], v1["/assets/zhusha/idle"]);
    assert.equal(v2["/assets/zhusha/run"], v1["/assets/zhusha/run"]);
    // a drawing added
    put("assets/zhusha/run/f001.png", "c");
    assert.notEqual(artVersions(pub)["/assets/zhusha/run"], v1["/assets/zhusha/run"]);
  } finally {
    rmSync(pub, { recursive: true, force: true });
  }
});
