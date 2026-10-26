"""N1 on the v2 refit through the motion lane's own tools (plain Python; calls Blender headless).

  python tools/pixel-pipeline/rosace_v2/motion_v2.py [--sheet tools/motion-ai/timing/n1_r3c.json]
      [--px 144,80] [--hi 640] [--review review/rosace/base-v2/refit/motion]

1. a read-only snapshot of rosace.blend (the v2 base since the Adopt step) in <motion-ai>/work/ (the motion lane never renders a
   live file: RETIME.md "Known limits")
2. a copy of the timing sheet named <name>_v2refit next to the snapshot, so retime.py and
   run_pixel.py write <motion-ai>/{retimed,renders,actions}/<name>_v2refit and never touch the
   motion lane's own <name> outputs
3. tools/motion-ai/run_pixel.py <copy> --hero --blend <snapshot> --px N for every N (the retime,
   hero keys, spring cloth, and, on the v2 rig, the soft-tissue springs in blender_apply.py step 4b;
   then rosace_post.py --frames and smear.py)
4. --hi: blender_apply.py alone at a big px, beauty only, for looking at deformation
5. strips / GIFs of every drawing into --review
"""
import argparse
import json
import os
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIPE = HERE.parent
REPO = PIPE.parents[1]
MOTION = REPO / "tools" / "motion-ai"
ART = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai")
BUILD = Path(os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build"))


def run(cmd, label):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-4000:])
        raise SystemExit(f"{label} failed ({r.returncode})")
    print(f"  {label}: {time.time() - t:5.1f} s")
    return out


def strip(px_dir, out_png, scale, bg=(104, 102, 98, 255)):
    from PIL import Image, ImageDraw
    meta = json.loads((px_dir / "meta.json").read_text())
    frames = meta["frames"]
    tag = "sprite" if (px_dir / f"sprite_{frames[0]:04d}.png").exists() else None
    ims = []
    for f in frames:
        p = px_dir / (f"sprite_{f:04d}.png" if tag else f"beauty/{f:04d}.png")
        ims.append(Image.open(p).convert("RGBA"))
    w, h = ims[0].size
    drawing = meta["motion"]["drawing"]
    first = {}
    for gf, s in enumerate(meta["motion"]["sample_frame"]):
        first.setdefault(s, gf)
    S = Image.new("RGBA", (w * len(ims), h + 12), bg)
    d = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(zip(frames, ims)):
        S.alpha_composite(im, (i * w, 12))
        d.text((i * w + 2, 0), f"f{first.get(f, f)} {drawing[first.get(f, f)]}", fill=(30, 28, 40, 255))
    S = S.resize((S.width * scale, S.height * scale), Image.NEAREST)
    S.save(out_png)
    # the same drawings as a grid (the strip is too wide to read at once)
    cols = 7
    tw, th = (w * scale, (h + 12) * scale)
    G = Image.new("RGBA", (tw * min(cols, len(ims)), th * ((len(ims) + cols - 1) // cols)), bg)
    for i in range(len(ims)):
        G.alpha_composite(S.crop((i * tw, 0, (i + 1) * tw, th)), ((i % cols) * tw, (i // cols) * th))
    G.save(out_png.with_name(out_png.stem.replace("_strip", "_grid") + ".png"))
    # the clip at game timing: every game frame shows its drawing (60 fps -> 17 ms per frame)
    seq = [ims[frames.index(s)] for s in meta["motion"]["sample_frame"]]
    gif = [Image.new("RGBA", (w, h), bg) for _ in seq]
    for g, im in zip(gif, seq):
        g.alpha_composite(im)
    gif = [g.resize((w * scale, h * scale), Image.NEAREST).convert("P", palette=Image.ADAPTIVE) for g in gif]
    gif[0].save(out_png.with_suffix(".gif"), save_all=True, append_images=gif[1:], duration=17, loop=0)
    return out_png


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", default=str(MOTION / "timing" / "n1_r3c.json"))
    ap.add_argument("--blend", default=str(BUILD / "rosace.blend"))
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--hi", type=int, default=640)
    ap.add_argument("--pad", default="40")
    ap.add_argument("--review", default=str(REPO / "review" / "rosace" / "base-v2" / "refit" / "motion"))
    ap.add_argument("--no-finish", dest="finish", action="store_false",
                    help="skip motion_finish.py (the shading preset's tones and remap, the hair hue) on the frames")
    ap.add_argument("--tag", default="v2refit", help="output suffix: <sheet>_<tag> (v1match = the v1 base in the v2 outfit)")
    a = ap.parse_args()
    review = Path(a.review).resolve()
    review.mkdir(parents=True, exist_ok=True)
    # 1. snapshot
    snap = ART / "work" / f"rosace_{a.tag}_snapshot_{time.strftime('%H%M')}.blend"
    snap.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(a.blend, snap)
    os.chmod(snap, stat.S_IREAD)
    # 2. renamed sheet
    sheet = json.loads(Path(a.sheet).read_text(encoding="utf-8"))
    name = sheet["name"] + "_" + a.tag
    sheet["name"] = name
    sheet["move"] = sheet.get("move", "") + f" [{a.tag}: same sheet on {Path(a.blend).name}]"
    sheet_copy = snap.parent / f"{name}.json"
    sheet_copy.write_text(json.dumps(sheet, indent=1, ensure_ascii=False), encoding="utf-8")
    log = {"snapshot": str(snap), "sheet": str(sheet_copy), "source_sheet": a.sheet, "runs": []}
    # 3. pixel runs
    for px in [int(x) for x in a.px.split(",")]:
        out = run([sys.executable, MOTION / "run_pixel.py", sheet_copy, "--hero", "--blend", snap, "--px", px,
                   "--review-dir", review, "--blender-args", f"--pad {a.pad}"], f"run_pixel {px}")
        pxd = ART / "renders" / name / f"px{px}"
        if a.finish:        # the stills' lane colours on the frames (motion_finish.py; Integrate step)
            sys.path.insert(0, str(PIPE))
            import motion_finish
            motion_finish.finish(str(pxd), json.loads((REPO / "art" / "rosace" / "integrated.json").read_text("utf-8")))
        strip(pxd, review / f"{name}_px{px}_strip.png", 3 if px >= 144 else 4)
        meta = json.loads((pxd / "meta.json").read_text())
        log["runs"].append({"px": px, "dir": str(pxd), "frames": meta["frames"],
                            "measurements": {k: (max(v) if v else None) for k, v in meta["motion"]["measurements"].items()},
                            "jiggle": meta["motion"].get("jiggle"),
                            "notes": [ln.strip() for ln in out.splitlines() if "jiggle" in ln or "measured" in ln]})
    # 4. hi-res beauty for deformation
    if a.hi:
        outd = ART / "renders" / (name + "_hi")
        run([sys.executable, PIPE / "blender_env.py", "run", "--python-exit-code", "1", "--python",
             MOTION / "blender_apply.py", "--", "--npz", ART / "retimed" / f"{name}.npz", "--blend", snap,
             "--out", outd, "--px", a.hi, "--hero", sheet_copy, "--passes", "beauty", "--pad", "20"], f"hi {a.hi}")
        strip(outd / f"px{a.hi}", review / f"{name}_hi{a.hi}_strip.png", 1, bg=(30, 28, 40, 255))
    json.dump(log, open(review / f"{name}_log.json", "w"), indent=1)
    print("motion review in", review)


if __name__ == "__main__":
    main()
