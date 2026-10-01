"""Runs render_frames_bl.py over a key list as several finite Blender processes, one at a time, in ONE shared-gate
exclusive hold (call this through tools/rosace-package/gate.sh -x). Small batches keep each GPU process short.

  bash tools/rosace-package/gate.sh -x python tools/rosace-package/render_batches.py --out review/render/raw \
      --px 144,80 [--keys a,b,c | --all] [--batch 12] [--yaw 62 --elev 8] [--blend <rosace.blend>]
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.environ.get("ROSACE_PIPE", r"D:\Dex\Projects\dex.place\tools\pixel-pipeline")
BLEND = r"D:\Dex\Projects\dex-place-art\rosace\build\rosace.blend"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--keys", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--extra", default="", help="more keys after --all (hero:<pose file> keys)")
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--yaw", default="62")
    ap.add_argument("--elev", default="8")
    ap.add_argument("--blend", default=BLEND)
    ap.add_argument("--map", default=os.path.join(HERE, "data", "render_map.json"))
    ap.add_argument("--solved", default=os.path.join(HERE, "data", "standin_solved.json"))
    a = ap.parse_args()
    solved = json.load(open(a.solved, encoding="utf-8"))
    if a.all:
        keys = []
        for c in solved["clips"]:
            for f in c["frames"]:
                if f["pose"] not in keys:
                    keys.append(f["pose"])
    else:
        keys = [k for k in a.keys.split(",") if k]
    if os.path.exists(a.map):
        rmap = json.load(open(a.map, encoding="utf-8"))
        keys = [f"{k}={rmap[k]}" if k in rmap and rmap[k] != k else k for k in keys]
    keys += [k for k in a.extra.split(",") if k]
    def done(item):
        out_key = item.rpartition("=")[0] if "=" in item else item
        d = out_key.replace("~", "_to_").replace(":", "_").replace("/", "_")
        return all(os.path.exists(os.path.join(a.out, d, f"px{px}", "landmarks.json")) or os.path.exists(os.path.join(a.out, d, f"px{px}", "facepass.json")) for px in a.px.split(","))
    keys = [k for k in keys if not done(k)]
    print(len(keys), "keys to render", flush=True)
    t0 = time.time()
    for i in range(0, len(keys), a.batch):
        chunk = keys[i:i + a.batch]
        cmd = [sys.executable, os.path.join(PIPE, "blender_env.py"), "run", "--python-exit-code", "1", "--python",
               os.path.join(HERE, "render_frames_bl.py"), "--", "--blend", a.blend, "--solved", a.solved, "--keys", ",".join(chunk),
               "--px", a.px, "--out", a.out, "--yaw", a.yaw, "--elev", a.elev]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        log = (r.stdout or "") + (r.stderr or "")
        open(os.path.join(os.path.dirname(os.path.abspath(a.out)), f"batch_{i // a.batch:02d}.log"), "w", encoding="utf-8").write(log)
        done = [ln for ln in log.splitlines() if ln.startswith("ROSACE RENDERED")]
        for ln in log.splitlines():
            if ln.startswith("ROSACE FAILED"):
                print(ln, flush=True)
        print(f"batch {i // a.batch}: {len(chunk)} keys, exit {r.returncode}, {len(done)} renders, {time.time() - t0:.0f}s", flush=True)
        if r.returncode:
            print(log[-3000:])
            raise SystemExit(f"blender batch {i // a.batch} failed")
    print("done", len(keys), "keys")


if __name__ == "__main__":
    main()
