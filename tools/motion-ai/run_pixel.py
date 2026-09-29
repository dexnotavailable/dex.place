"""One command from timing sheet to pixel frames (system Python; calls Blender headless).

  python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1.json            # retimed (B) only
  python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1.json --raw-too  # + the raw clip (A)
  python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1.json --stick-only
  python tools/motion-ai/run_pixel.py tools/motion-ai/timing/n1_r2.json --hero       --blend D:/Dex/Projects/dex-place-art/rosace/motion-ai/work/rosace_snapshot_0342.blend       --review-dir review/motion/r2/round-1       # round 2: hero keys + spring cloth (RETIME.md)

Steps: retime.py build -> blender_apply.py (retarget, glaive, IK, drape, render the new drawings)
-> tools/pixel-pipeline/rosace_post.py --frames -> <renders>/<name>/px<N>/sprite_####.png and a
contact sheet of every drawing (<review>/retime/<name>_pixel_sheet.png). Timings are printed.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ART = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai")
BLEND = ART / "work" / "rosace_snapshot_0258.blend"   # round 1; round 2 passes --blend .../rosace_snapshot_0342.blend


def run(cmd, label):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-4000:])
        raise SystemExit(f"{label} failed ({r.returncode})")
    print(f"  {label}: {time.time() - t:5.1f} s")
    return out


def sheet(px_dir, out_png, scale=2):
    from PIL import Image, ImageDraw
    meta = json.loads((px_dir / "meta.json").read_text())
    frames = meta["frames"]
    ims = [Image.open(px_dir / f"sprite_{f:04d}.png").convert("RGBA") for f in frames]
    w, h = ims[0].size
    drawing = meta["motion"]["drawing"]
    first = {}
    for gf, s in enumerate(meta["motion"]["sample_frame"]):
        first.setdefault(s, gf)
    bg = Image.new("RGBA", (w * len(ims), h + 12), (52, 52, 64, 255))
    d = ImageDraw.Draw(bg)
    for i, (f, im) in enumerate(zip(frames, ims)):
        bg.alpha_composite(im, (i * w, 12))
        d.text((i * w + 2, 0), f"f{first.get(f, f)} {drawing[first.get(f, f)]}", fill=(230, 230, 160, 255))
    bg = bg.resize((bg.width * scale, bg.height * scale), Image.NEAREST)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out_png)
    return out_png


def pixel(npz, name, px, extra, blend=BLEND, review=None, smear_sheet=None):
    out = ART / "renders" / name
    log = run([sys.executable, REPO / "tools/pixel-pipeline/blender_env.py", "run", "--python-exit-code", "1",
               "--python", HERE / "blender_apply.py", "--", "--npz", npz, "--blend", blend, "--out", out,
               "--px", px, "--save-blend", ART / "actions" / f"{name}.blend", *extra], f"blender {name}")
    for line in log.splitlines():
        if "retarget direction" in line or "measured" in line or "APPLY_DONE" in line:
            print("   ", line.strip())
    for p in (out / f"px{px}").glob("sprite_*_body.png"):
        p.unlink()                    # smear.py's body-only copies from an earlier render are stale now
    run([sys.executable, REPO / "tools/pixel-pipeline/rosace_post.py", "--raw", out / f"px{px}", "--frames"],
        f"post {name}")
    if smear_sheet:
        log = run([sys.executable, HERE / "smear.py", out / f"px{px}", smear_sheet], f"smear {name}")
        for line in log.splitlines():
            print("   ", line[:160])
    png = sheet(out / f"px{px}", Path(review or REPO / "review/motion/retime").resolve() / f"{name}_pixel_sheet.png")
    print("   sheet", png)
    return out / f"px{px}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--raw-too", action="store_true")
    ap.add_argument("--stick-only", action="store_true")
    ap.add_argument("--px", default="144")
    ap.add_argument("--blend", default=str(BLEND), help="a read-only COPY of rosace.blend")
    ap.add_argument("--blender-args", default="", help="extra args for blender_apply.py, space separated")
    ap.add_argument("--hero", action="store_true", help="apply the sheet's hero section (hand-posed keys, spring cloth)")
    ap.add_argument("--review-dir", default=None, help="where the pixel contact sheet goes")
    a = ap.parse_args()
    t0 = time.time()
    name = json.loads(Path(a.sheet).read_text())["name"]
    cmd = [sys.executable, HERE / "retime.py", "build", a.sheet] + (["--raw-too"] if a.raw_too else [])
    if a.review_dir:
        cmd += ["--preview-dir", str(Path(a.review_dir).resolve())]
    print(run(cmd, "retime").strip().splitlines()[0])
    if a.stick_only:
        return
    extra = a.blender_args.split() if a.blender_args else []
    blend = str(Path(a.blend).resolve())
    hero = ["--hero", str(Path(a.sheet).resolve())] if a.hero else []
    has_smear = a.hero and any(not k.startswith("_") for k in json.loads(Path(a.sheet).read_text()).get("smear", {}))
    pixel(ART / "retimed" / f"{name}.npz", name, a.px, extra + hero, blend, a.review_dir,
          str(Path(a.sheet).resolve()) if has_smear else None)
    if a.raw_too:
        pixel(ART / "retimed" / f"{name}_raw.npz", f"{name}_raw", a.px, extra, blend, a.review_dir)
    print(f"total {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
