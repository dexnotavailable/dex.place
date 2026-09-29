"""Hero-key authoring loop: render hand-authored pose JSONs as 144 px sprites plus measurements.

  python tools/motion-ai/hero_stills.py art/rosace/poses/motion/n1_coil.json [more.json ...] \
      [--out D:/Dex/Projects/dex-place-art/rosace/motion-ai/hero_stills] [--sheet review/motion/r2/hero_n1.png]
      [--blend <read-only snapshot>] [--yaw 60] [--elev 8] [--px 144]

Run with the system Python: it starts ONE headless Blender (tools/pixel-pipeline/blender_env.py) for all
poses, then the pixel post-process per pose, then a 3x sheet with each pose's numbers under it
(rig_measure.py explains them). Poses are rendered in the motion view (camera yaw 60, elev 8), not the
pose file's own camera, because that is the view the motion frames use.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ART = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai")
BLEND = ART / "work" / "rosace_snapshot_0342.blend"


def in_blender():
    try:
        import bpy  # noqa: F401
        return True
    except ImportError:
        return False


def blender_main():
    import bpy
    sys.path.insert(0, str(HERE))
    sys.path.insert(0, str(REPO / "tools" / "pixel-pipeline"))
    from rosace import materials, posing, render
    import rig_measure
    import hero_layer
    argv = sys.argv[sys.argv.index("--") + 1:]
    a = json.loads(argv[0])
    out_root = a["out"]
    assert os.path.isabs(out_root), "absolute output paths only"
    bpy.ops.wm.open_mainfile(filepath=a["blend"])
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    arm = posing.arm_obj()
    res = {}
    for p in a["poses"]:
        P = json.loads(Path(p).read_text(encoding="utf-8"))
        name = P.get("name") or Path(p).stem
        posing.apply_pose(hero_layer.resolve(P, arm))
        posing.update()
        m = rig_measure.measure(arm)
        shot = render.setup_shot(sc, a["px"], yaw=a["yaw"], elev=a["elev"])
        out = os.path.join(out_root, name, f"px{a['px']}")
        render.render_passes(sc, out)
        anchors = posing.anchors(sc, a["px"])
        render.write_meta(os.path.join(out, "meta.json"), shot,
                          {"pose": name, "expression": P.get("expression", "resolute"), "anchors": anchors,
                           "passes": ["beauty", "albedo", "id", "normal", "depth"], "frames": None,
                           "thong": None, "measure": m})
        res[name] = {"dir": out, "measure": m, "canvas": shot["canvas"], "anchor": shot["anchor"]}
        print("HERO", name, json.dumps(m), flush=True)
    print("HERO_DONE", json.dumps(res), flush=True)


def sheet(res, path, scale=2):
    from PIL import Image, ImageDraw
    tiles = []
    for name, r in res.items():
        im = Image.open(Path(r["dir"]) / "sprite.png").convert("RGBA")
        tiles.append((name, r, im))
    # common ground line: align anchors
    ax = max(r["anchor"][0] for _, r, _ in tiles)
    ay = max(r["anchor"][1] for _, r, _ in tiles)
    W = max(im.width - r["anchor"][0] for _, r, im in tiles) + ax
    Hh = max(im.height - r["anchor"][1] for _, r, im in tiles) + ay
    txt = 190
    out = Image.new("RGBA", (W * len(tiles), Hh + txt), (46, 46, 58, 255))
    d = ImageDraw.Draw(out)
    for i, (name, r, im) in enumerate(tiles):
        out.alpha_composite(im, (i * W + ax - r["anchor"][0], ay - r["anchor"][1]))
        d.line([(i * W, ay), (i * W + W, ay)], fill=(80, 80, 100, 255))
        bb = im.getbbox()
        m = r["measure"]
        lines = [name, f"span {(bb[2] - bb[0]) / 144:.2f} H  ({bb[2] - bb[0]} px)",
                 f"stance {m['stance_sw']} SW  hips {m['hips_drop']}",
                 f"torso {m['torso_yaw']}  hips {m['hips_yaw']}  sep {m['separation']}",
                 f"lean {m['lean']}  LoA {m['line_of_action']}  LoA body {m.get('line_of_action_body')}",
                 f"chest-cam {m.get('chest_to_cam')}  head down {m.get('head_down')}",
                 f"knee/ankle gap {m.get('knee_gap_over_ankle_gap')}",
                 f"tip-heel {m.get('tip_vs_heel_H')} H  behind-hip {m.get('tip_behind_hip_H')} H",
                 f"pitch {m.get('glaive_pitch')}  tip h {m.get('tip_height_H')} H",
                 f"hand gap {m.get('hand_gap_cm')}  ankle ik {m.get('ankle_ik_cm')}"]
        for j, t in enumerate(lines):
            d.text((i * W + 3, Hh + 3 + j * 12), t, fill=(230, 230, 200, 255))
    out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path)
    return path


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("poses", nargs="+")
    ap.add_argument("--out", default=str(ART / "hero_stills"))
    ap.add_argument("--sheet", default=str(REPO / "review" / "motion" / "r2" / "hero_stills.png"))
    ap.add_argument("--blend", default=str(BLEND))
    ap.add_argument("--yaw", type=float, default=60.0)
    ap.add_argument("--elev", type=float, default=8.0)
    ap.add_argument("--px", type=int, default=144)
    a = ap.parse_args()
    job = {"poses": [str(Path(p).resolve()) for p in a.poses], "out": str(Path(a.out).resolve()),
           "blend": str(Path(a.blend).resolve()), "yaw": a.yaw, "elev": a.elev, "px": a.px}
    r = subprocess.run([sys.executable, str(REPO / "tools/pixel-pipeline/blender_env.py"), "run", "--python-exit-code", "1",
                        "--python", str(Path(__file__).resolve()), "--", json.dumps(job)], capture_output=True, text=True)
    log = (r.stdout or "") + (r.stderr or "")
    done = [ln for ln in log.splitlines() if ln.startswith("HERO_DONE")]
    if r.returncode or not done:
        print(log[-5000:])
        raise SystemExit("blender failed")
    res = json.loads(done[0][len("HERO_DONE "):])
    for name, x in res.items():
        p = subprocess.run([sys.executable, str(REPO / "tools/pixel-pipeline/rosace_post.py"), "--raw", x["dir"]],
                           capture_output=True, text=True)
        if p.returncode:
            print(p.stdout[-2000:], p.stderr[-2000:])
            raise SystemExit("post failed")
        print(name, json.dumps(x["measure"]))
    print("sheet", sheet(res, Path(a.sheet)))


if __name__ == "__main__":
    blender_main() if in_blender() else main()
