"""Hair lane round 2 driver (host side): render a lane build, add the face pass, then finish each
still with the hair pixel pass (hair_px.py) and the face lane's F2 face.

  python tools/pixel-pipeline/hair_lane2.py build r2 [...]          # hair_lane.py build (lanes/hair/<v>.blend)
  python tools/pixel-pipeline/hair_lane2.py render r2 [...]         # stills_v2 render + author_faces_pass
  python tools/pixel-pipeline/hair_lane2.py finish r2 p0 [p1 ...]   # per hair_px preset: renders/<v>@<preset>/
  python tools/pixel-pipeline/hair_lane2.py all r2 p0 [p1 ...]

Layout (never rosace.blend, never the canonical renders):
  lanes/hair/<v>.blend                          the lane build (hair_lane_build.py)
  lanes/hair/renders/<v>/<still>/px<N>/          the Blender passes + meta + facepass.json + facewin.png
  lanes/hair/renders/<v>@<preset>/<still>/px<N>/ a copy of the passes, then:
      rosace_post.py --no-face --tag noface     (as stills_v2)
      hair_px.py --preset <preset>              the hair pixel pass (rewrites noface.png / noface_id.png;
                                                 the post output is kept as noface_post.png / _id)
      overrides.py build + apply, ROSACE_FACES=f2   the face lane's F2 face + rim + glyphs -> still.png
The 'none' preset skips the hair pass (the round's control: the build's render with the F2 face).
Integrate: add the hair_px.py step between rosace_post.py and overrides.py in stills_v2.py.
"""
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LANE = os.environ.get("HAIR_LANE_DIR", r"D:\Dex\Projects\dex-place-art\rosace\build\lanes\hair")
POSES = os.path.join(REPO, "art", "rosace", "poses")
ODIR = os.path.join(REPO, "art", "rosace", "overrides")
STILLS = [("idle_hero", "idle_hero"), ("n1_contact", "n1_contact"), ("q_stamp", "q_stamp"),
          ("n2_pivot_black", "n2_pivot")]
PXS = (144, 80)
PASS_FILES = ("beauty.png", "id.png", "depth.png", "normal.png", "albedo.png", "meta.json", "facepass.json",
              "facewin.png", "light.png", "depth2.png")


def blend(v):
    return os.path.join(LANE, f"{v}.blend")


def rdir(v, preset=None):
    return os.path.join(LANE, "renders", v if preset is None else f"{v}@{preset}")


def run(cmd, env=None, quiet=False):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-4000:])
        raise SystemExit(f"failed: {[str(c) for c in cmd[:4]]}")
    if not quiet:
        for ln in out.splitlines():
            if "HAIR" in ln or "Traceback" in ln or "hair_px" in ln:
                print("   ", ln[:300])
        print(f"  {time.time() - t:5.1f} s  {os.path.basename(str(cmd[1]))}")
    return out


def build(v):
    run([sys.executable, os.path.join(HERE, "hair_lane.py"), "build", v])


def render(v):
    out = rdir(v)
    run([sys.executable, os.path.join(HERE, "stills_v2.py"), "--blend", blend(v), "--out", out, "--hi", "0",
         "--only", ",".join(s for s, _ in STILLS), "--plain"])
    for name, pose in STILLS:
        run([sys.executable, os.path.join(HERE, "blender_env.py"), "run", "--python-exit-code", "1", "--python",
             os.path.join(HERE, "author_faces_pass.py"), "--", "--blend", blend(v), "--pose",
             os.path.join(POSES, pose + ".json")] + sum([["--still", os.path.join(out, name, f"px{px}")] for px in PXS], []))


def finish(v, preset):
    src, dst = rdir(v), rdir(v, preset)
    env = dict(os.environ, ROSACE_FACES="f2")
    for name, pose in STILLS:
        for px in PXS:
            s, d = os.path.join(src, name, f"px{px}"), os.path.join(dst, name, f"px{px}")
            os.makedirs(d, exist_ok=True)
            for f in PASS_FILES:
                if os.path.exists(os.path.join(s, f)):
                    shutil.copyfile(os.path.join(s, f), os.path.join(d, f))
            for sub in ("light", "depth2"):
                if os.path.isdir(os.path.join(s, sub)):
                    shutil.copytree(os.path.join(s, sub), os.path.join(d, sub), dirs_exist_ok=True)
            run([sys.executable, os.path.join(HERE, "rosace_post.py"), "--raw", d, "--no-face", "--tag", "noface"],
                quiet=True)
            if preset != "none":
                o = run([sys.executable, os.path.join(HERE, "hair_px.py"), "--still", d, "--preset", preset], quiet=True)
                last = [ln for ln in o.splitlines() if ln.startswith("hair_px")]
                print("   ", name, px, last[-1][:240] if last else "")
            layer = f"{pose}_{px}"
            ops = [] if os.path.exists(os.path.join(ODIR, layer + ".json")) else ["--ops", f"{pose}_144"]
            common = ["--still", d, "--layer", layer, "--layer-dir", os.path.join(dst, "_layers")] + ops
            run([sys.executable, os.path.join(HERE, "overrides.py"), "build"] + common, env=env, quiet=True)
            run([sys.executable, os.path.join(HERE, "overrides.py"), "apply"] + common, env=env, quiet=True)
            if preset != "none":
                sys.path.insert(0, HERE)
                import hair_px
                if "fwin" in hair_px.PRESETS[preset]["steps"]:
                    o = run([sys.executable, os.path.join(HERE, "hair_px.py"), "--still", d, "--face-window"], quiet=True)
                    print("      ", o.strip().splitlines()[-1][:200])
                if "hue" in hair_px.PRESETS[preset]["steps"]:
                    run([sys.executable, os.path.join(HERE, "hair_px.py"), "--still", d, "--hue"], quiet=True)
    print("finished", dst)


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:]
    if cmd in ("build", "render"):
        for v in rest:
            (build if cmd == "build" else render)(v)
    elif cmd == "finish":
        v, *ps = rest
        for p in ps:
            finish(v, p)
    elif cmd == "all":
        v, *ps = rest
        build(v)
        render(v)
        for p in ps:
            finish(v, p)
