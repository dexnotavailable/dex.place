"""Route F2 ("proportions for pixel appeal"): head-scale variants of Rosace through the canonical stills chain.

  python tools/pixel-pipeline/finish_f2/stills_f2.py render [--keys H100,H110,H115,H120]   # Blender, one at a time
  python tools/pixel-pipeline/finish_f2/stills_f2.py chain  [--variants H100,H115E,...]    # pixel passes (plain python)
  python tools/pixel-pipeline/finish_f2/stills_f2.py measure                               # -> <out>/measure.json
  python tools/pixel-pipeline/finish_f2/stills_f2.py all

Base: the canonical build (build/rosace.blend: the integrated lanes, round WH2, the bust shape.json 'current' S7 already
applied by build_rosace_v2.py) posed with the figure-pose lane's newest appeal poses through its applier
(rosace_v2/figure_pose.py, read-only): idle = idle_appeal.json (else idle_appeal_A.json), back = back_appeal.json
(else back_appeal_A.json), black thong; N1 = the canonical n1_contact.json. The pose files are snapshotted into
<out>/poses/ at the first render (sha1 in <out>/poses/_poses.json) so every variant uses the same pose even while
the figure-pose lane is still writing.

Render keys (head_scale.py, applied at pose time after the build; H stays 144 px unless fit_h is off):
  H100 head 1.00 (the control)   H110 1.10   H115 1.15   H120 1.20; neck width +40 % of the head's gain, length 1.0
Variants = render key + eye stamps: 'H115' = wh2.json's eyes, 'H115E' = faces_f2.json 'eyes_big' (144 only).

The chain per still is stills_v2.py's integrated chain with the canonical picks (art/rosace/integrated.json
'stills'): rosace_post --shade, hair_px, overrides.py (face F2 composer, collar glyph, rim; the appeal poses borrow
idle_hero_144's / n2_pivot_144's ops, whose patches are STALE there and skipped), outfit_px + outfit_px2, the
constructed hands where a spec exists for the pose (n1_contact only: hand specs are per pose), wh2 (faces from
<out>/<variant>/_faces.json), the remap, the hair hue, the contact shadow.
Outputs: <out>/raw/<key>/<still>/px<N>/ (passes + facepass), <out>/v/<variant>/<still>/px<N>/still.png (+ ground).
Default out: D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F2 (never rosace.blend; nothing writes a .blend).
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
OUT = os.path.join(BUILD, "lanes", "finish-F2")
POSES = os.path.join(REPO, "art", "rosace", "poses")
ODIR = os.path.join(REPO, "art", "rosace", "overrides")
INTEGRATED = os.path.join(REPO, "art", "rosace", "integrated.json")
GH_RENDER = os.path.join(REPO, "tools", "art-construct", "gh_render.py")
FACEPASS = os.path.join(PIPE, "author_faces_pass.py")
BL_RUN = os.path.join(HERE, "bl_run.py")
WH2_FACES = os.path.join(REPO, "art", "rosace", "faces", "wh2.json")
F2_FACES = os.path.join(HERE, "faces_f2.json")
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))

KEYS = {"H100": {"head": 1.00}, "H110": {"head": 1.10}, "H115": {"head": 1.15}, "H120": {"head": 1.20},
        "H115L": {"head": 1.15, "neck_l": 0.85}}
# still -> (pose candidates, newest first; canonical name for rim family / ops; extra render args)
STILLS = {"idle": (["idle_appeal", "idle_appeal_A"], "idle_hero", []),
          "n1": (["n1_contact"], "n1_contact", []),
          "back": (["back_appeal", "back_appeal_A"], "n2_pivot", ["--thong", "black"])}
RAW_FILES = ("albedo.png", "beauty.png", "depth.png", "depth2.png", "id.png", "light.png", "normal.png", "meta.json",
             "landmarks.json", "facepass.json", "facewin.png")
PXS = (144, 80)


def sha1(p):
    return hashlib.sha1(open(p, "rb").read()).hexdigest()[:12]


def snapshot_poses(out):
    """copy the newest pose file per still into <out>/poses once; later runs reuse the snapshot"""
    pd = os.path.join(out, "poses")
    rec_p = os.path.join(pd, "_poses.json")
    if os.path.exists(rec_p):
        return json.load(open(rec_p, encoding="utf-8"))
    os.makedirs(pd, exist_ok=True)
    rec = {"_doc": "pose snapshot for route F2 (the figure-pose lane was still running; its files are used read-only)"}
    for s, (cands, canon, extra) in STILLS.items():
        src = next(os.path.join(POSES, c + ".json") for c in cands if os.path.exists(os.path.join(POSES, c + ".json")))
        dst = os.path.join(pd, os.path.basename(src))
        shutil.copyfile(src, dst)
        rec[s] = {"pose": os.path.basename(src)[:-5], "src": src, "file": dst, "sha1": sha1(dst),
                  "mtime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(src)))}
    json.dump(rec, open(rec_p, "w", encoding="utf-8"), indent=1)
    return rec


def run(cmd, label, env=None):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-4000:])
        raise SystemExit(f"{label} failed ({r.returncode})")
    print(f"  {label}: {time.time() - t:5.1f} s", flush=True)
    return out


def bl(key, script, args, label):
    k = dict(KEYS[key])
    own = ["--head", k["head"], "--neck-w", k.get("neck_w", 0.4), "--neck-l", k.get("neck_l", 1.0),
           "--fit-h", int(k.get("fit_h", 1))]
    out = run([sys.executable, os.path.join(PIPE, "blender_env.py"), "run", "--python-exit-code", "1", "--python", BL_RUN,
               "--"] + own + ["--script", script] + args, label)
    return [ln for ln in out.splitlines() if ln.startswith(("F2_HEAD", "RENDERED", "FACEPASS"))]


def render(out, keys, blend, only=None):
    rec = snapshot_poses(out)
    cfg = json.load(open(INTEGRATED, encoding="utf-8"))["stills"]
    log = {}
    for key in keys:
        for s, (cands, canon, extra) in STILLS.items():
            if only and s not in only:
                continue
            pf = rec[s]["file"]
            d = os.path.join(out, "raw", key, s)
            notes = bl(key, GH_RENDER, ["--blend", blend, "--pose", pf, "--px", ",".join(map(str, PXS)), "--ss", "4",
                                        "--passes", cfg["passes"], "--out", d] + extra, f"render {key} {s}")
            notes += bl(key, FACEPASS, ["--blend", blend, "--pose", pf] +
                        sum([["--still", os.path.join(d, f"px{px}")] for px in PXS], []), f"facepass {key} {s}")
            log[f"{key}/{s}"] = notes
    json.dump(log, open(os.path.join(out, "raw", "_render_log.json"), "w"), indent=1)


def faces_json(vdir, big):
    F = json.load(open(WH2_FACES, encoding="utf-8"))
    A = json.load(open(F2_FACES, encoding="utf-8"))
    F["expressions"].update(A["expressions"])
    if big:
        for px, st in A["eyes_big"].items():
            F["stamps"][px].update(st)
    F["_f2"] = {"base": WH2_FACES, "additions": F2_FACES, "eyes_big": big}
    p = os.path.join(vdir, "_faces.json")
    json.dump(F, open(p, "w", encoding="utf-8"), indent=1)
    return p


def chain(out, variants, only=None):
    import stills_v2
    import wh2_px
    rec = snapshot_poses(out)
    full = json.load(open(INTEGRATED, encoding="utf-8"))["stills"]
    preset = os.path.join(REPO, full["shading"])
    P = json.load(open(preset, encoding="utf-8"))
    env = dict(os.environ, ROSACE_FACES=full["face"]["composer"])
    if P.get("rim_style"):
        env["ROSACE_RIM_STYLE"] = os.path.join(REPO, P["rim_style"])
    import hair_px
    for v in variants:
        key, big = v.rstrip("E"), v.endswith("E")
        vdir = os.path.join(out, "v", v)
        os.makedirs(vdir, exist_ok=True)
        wh2_px.FACES = faces_json(vdir, big)
        layers = os.path.join(vdir, "_layers")
        notes = {}
        for s, (cands, canon, extra) in STILLS.items():
            if only and s not in only:
                continue
            pose = rec[s]["pose"]
            for px in PXS:
                raw = os.path.join(out, "raw", key, s, f"px{px}")
                still = os.path.join(vdir, s, f"px{px}")
                if os.path.isdir(still):
                    shutil.rmtree(still)
                os.makedirs(still)
                for f in RAW_FILES:
                    shutil.copyfile(os.path.join(raw, f), os.path.join(still, f))
                run([sys.executable, os.path.join(PIPE, "rosace_post.py"), "--raw", still, "--no-face", "--tag", "noface",
                     "--shade", preset], f"post {v} {s} {px}")
                steps = [x for x in hair_px.PRESETS[full["hair_px"]["preset"]]["steps"]
                         if x in hair_px.ALL and x not in full["hair_px"].get("skip", [])]
                run([sys.executable, os.path.join(PIPE, "hair_px.py"), "--still", still, "--preset",
                     full["hair_px"]["preset"], "--only", ",".join(steps)], f"hair {v} {s} {px}")
                layer = f"{pose}_{px}"
                ops_src = layer if os.path.exists(os.path.join(ODIR, layer + ".json")) else f"{canon}_144"
                ops = [] if ops_src == layer else ["--ops", ops_src]
                common = ["--still", still, "--layer", layer, "--layer-dir", layers] + ops
                fam = P.get("rim_family", {}).get(canon) or P.get("rim_family", {}).get(pose)
                senv = dict(env, ROSACE_RIM_FAMILY=fam) if fam else env
                run([sys.executable, os.path.join(PIPE, "overrides.py"), "build"] + common, f"layer {v} {layer}", senv)
                run([sys.executable, os.path.join(PIPE, "overrides.py"), "apply"] + common, f"apply {v} {s} {px}", senv)
                cfg = dict(full)
                if not os.path.exists(os.path.join(REPO, full["hands"], f"{pose}_{px}.json")):
                    cfg["hands"] = None
                log = []
                if not cfg["hands"] and px != 144:
                    # wh2's 80 px ornament step reads the 144 still's still_hands (the pin is placed from it)
                    d144 = os.path.join(vdir, s, "px144")
                    if not os.path.exists(os.path.join(d144, "still_hands.png")):
                        shutil.copyfile(os.path.join(d144, "still_o2.png"), os.path.join(d144, "still_hands.png"))
                n = stills_v2.lane_passes(s, pose, px, still, cfg, preset, P, log)
                n["ops"] = ops_src
                n["hands"] = bool(cfg["hands"])
                notes[f"{s}_{px}"] = n
        json.dump(notes, open(os.path.join(vdir, "_chain.json"), "w"), indent=1, default=str)
        print("variant", v, "done", flush=True)


def head_measure(still):
    """hair top (topmost hair/hairtip/veil px), chin (facepass), sole (anchor y): head = chin - top, H = sole - top"""
    m = json.load(open(os.path.join(still, "meta.json")))
    fp = json.load(open(os.path.join(still, "facepass.json")))
    ids = np.array(Image.open(os.path.join(still, "noface_id.png")).convert("RGBA"))
    img = np.array(Image.open(os.path.join(still, "still.png")).convert("RGBA"))
    hid = [m["materials"][k]["id"] for k in ("hair", "hairtip", "veil") if k in m["materials"]]
    hair = np.isin(ids[..., 0], hid) & (ids[..., 3] > 0)
    ys = np.nonzero(hair.any(1))[0]
    top = int(ys.min()) if len(ys) else None
    sole = m["anchor"][1]
    chin = fp["chin"][1]
    wh = json.load(open(os.path.join(still, "wh2.json")))
    face = wh.get("face", {})
    eyes = face.get("check", {}).get("eyes_px")
    a = img[..., 3] > 0
    return {"canvas": m["canvas"], "ppm": round(m["ppm"], 3), "hair_top": top, "chin": round(chin, 1), "sole": sole,
            "head_px": round(chin - top, 1), "H_px": sole - top, "head_over_H": round((chin - top) / (sole - top), 3),
            "eye_stamp_px": eyes, "mouth_ok": face.get("check", {}).get("mouth_ok"),
            "eyes_open": face.get("check", {}).get("eyes_open"), "eye_shifts": face.get("eye_shifts"),
            "opaque_px": int(a.sum()), "colours": int(len(np.unique(img[a][:, :3], axis=0)))}


def measure(out):
    res = {}
    for v in sorted(os.listdir(os.path.join(out, "v"))):
        for s in STILLS:
            for px in PXS:
                d = os.path.join(out, "v", v, s, f"px{px}")
                if os.path.exists(os.path.join(d, "still.png")):
                    res.setdefault(v, {})[f"{s}_{px}"] = head_measure(d)
    json.dump(res, open(os.path.join(out, "measure.json"), "w"), indent=1)
    for v, r in res.items():
        print(v, {k: (x["head_over_H"], x["head_px"], x["H_px"], x["eye_stamp_px"], x["colours"]) for k, x in r.items()})
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["render", "chain", "measure", "all"])
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--blend", default=os.path.join(BUILD, "rosace.blend"))
    ap.add_argument("--keys", default="H100,H110,H115,H120")
    ap.add_argument("--variants", default="H100,H100E,H110,H110E,H115,H115E,H120,H120E")
    ap.add_argument("--only", default="", help="comma list of stills (idle,n1,back)")
    a = ap.parse_args()
    out = os.path.abspath(a.out)
    assert os.path.basename(out) != "build", "--out is a lane folder, never the build root"
    only = [x for x in a.only.split(",") if x] or None
    if a.cmd in ("render", "all"):
        render(out, a.keys.split(","), os.path.abspath(a.blend), only)
    if a.cmd in ("chain", "all"):
        chain(out, a.variants.split(","), only)
    if a.cmd in ("measure", "all"):
        measure(out)


if __name__ == "__main__":
    main()
