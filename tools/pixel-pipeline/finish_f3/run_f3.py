"""Route F3, "mass and silhouette": build each variant, render its stills and run the integrated
stills chain on them (plain Python; one Blender process at a time).

  python tools/pixel-pipeline/finish_f3/run_f3.py [--variants control,A,B,C,D] [--no-build]
      [--no-render] [--only idle,n1,back] [--px 144,80]
      [--out D:/Dex/Projects/dex-place-art/rosace/build/renders/finish-F3]

Stills (DESIGN 3.5: the appeal poses are the idle and back heroes):
  idle  art/rosace/poses/idle_appeal.json (the figure-pose lane's newest; _A if it is missing)
  n1    art/rosace/poses/n1_contact.json
  back  art/rosace/poses/back_appeal.json (_A if missing), black thong
The pose files are snapshotted once into <out>/_poses/ (sha1 in _poses/poses.json), so every
variant is posed from the same data while the figure-pose lane keeps working.

Per still: bl_run.py (the figure-pose applier behind posing.apply_pose) runs
tools/art-construct/gh_render.py and author_faces_pass.py, then the integrated chain of
stills_v2.py steps 4-10 (art/rosace/integrated.json 'stills'): post + shading, hair pass, overrides
(face, glyphs, rim), post-face, outfit passes, hands (only where a spec exists for the pose), wh2
(faces keyed by the pose's hero: idle_appeal -> idle_hero, back_appeal -> n2_pivot), the palette
remap, the hair hue and the contact shadow. Output: <out>/<variant>/<still>/px<N>/still.png and
still_ground.png, plus <out>/<variant>/_log.json.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
sys.path.insert(0, HERE)
import stills_v2 as S2  # noqa: E402

BUILD = S2.BUILD
LANES = os.path.join(BUILD, "lanes")
POSES = S2.POSES
GH_RENDER = S2.GH_RENDER
OUT = os.path.join(BUILD, "renders", "finish-F3")
WH2_ALIAS = {"idle_appeal": "idle_hero", "back_appeal": "n2_pivot"}


def pose_file(name):
    p = os.path.join(POSES, name + ".json")
    return p if os.path.exists(p) else os.path.join(POSES, name + "_A.json")


STILLS = [("idle", "idle_appeal", []), ("n1", "n1_contact", []), ("back", "back_appeal", ["--thong", "black"])]


def snapshot_poses(out):
    d = os.path.join(out, "_poses")
    idx = os.path.join(d, "poses.json")
    if os.path.exists(idx):
        return json.load(open(idx, encoding="utf-8"))
    os.makedirs(d, exist_ok=True)
    rec = {}
    for _, pose, _ in STILLS:
        src = pose_file(pose)
        dst = os.path.join(d, pose + ".json")
        shutil.copyfile(src, dst)
        rec[pose] = {"src": src, "path": dst, "sha1": hashlib.sha1(open(src, "rb").read()).hexdigest()[:12],
                     "taken": time.strftime("%Y-%m-%d %H:%M:%S")}
    json.dump(rec, open(idx, "w", encoding="utf-8"), indent=1)
    return rec


def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def variant_poses(v, poses, out):
    """the snapshot poses with the variant's drape patch (finish_f3/drape_f3.json) deep-merged on top;
    the pose name is kept, so the applier, the face table and the hand specs see the same pose"""
    import variants as VT
    patch = VT.get(v).get("drape")
    if not patch:
        return poses
    P = json.load(open(os.path.join(HERE, "drape_f3.json"), encoding="utf-8"))[patch]
    d = os.path.join(out, "_poses", v)
    os.makedirs(d, exist_ok=True)
    res = {}
    for pose, rec in poses.items():
        if pose not in P:
            res[pose] = rec
            continue
        body = deep_merge(json.load(open(rec["path"], encoding="utf-8")), P[pose])
        dst = os.path.join(d, pose + ".json")
        json.dump(body, open(dst, "w", encoding="utf-8"), indent=1)
        res[pose] = dict(rec, path=dst, drape_patch=patch)
    return res


def bl_run(script, args, label, log):
    return S2.blender(["--python", os.path.join(HERE, "bl_run.py"), "--", script] + args, label, log)


def lane_passes(name, pose, px, still, cfg, P, log):
    """stills_v2.lane_passes (steps 7-10) with two changes for poses it has no data for: the hand
    spec is used only if it exists for this pose, and wh2's face table is keyed by the pose's hero"""
    import author_hands
    import outfit_px
    import outfit_px2
    import rosace_shade
    import rosace_shade_stills
    notes = {}
    hp = cfg.get("hair_px")
    if hp:
        import hair_px
        if "fwin" in hair_px.PRESETS[hp["preset"]]["steps"]:
            S2.run([sys.executable, os.path.join(PIPE, "hair_px.py"), "--still", still, "--face-window"],
                   f"hair window {name} {px}", log)
    if P.get("post_face") and cfg.get("post_face", True):
        notes["post_face"] = rosace_shade.post_face(still, P["post_face"])
    shutil.copyfile(os.path.join(still, "still.png"), os.path.join(still, "still_layers.png"))
    lay = os.path.join(os.path.dirname(os.path.dirname(still)), "_outfit_layers")
    if cfg.get("outfit_px"):
        notes["outfit_px"] = str(outfit_px.run(still, "still", "still_ofx", layer_dir=lay))[:300]
    else:
        shutil.copyfile(os.path.join(still, "still.png"), os.path.join(still, "still_ofx.png"))
    if cfg.get("outfit_px2"):
        notes["outfit_px2"] = str(outfit_px2.run(still, "still_ofx", "still_o2", only=cfg["outfit_px2"],
                                                 layer_dir=lay))[:300]
    else:
        shutil.copyfile(os.path.join(still, "still_ofx.png"), os.path.join(still, "still_o2.png"))
    last = "still_o2"
    if cfg.get("hands"):
        spec = os.path.join(REPO, cfg["hands"], f"{pose}_{px}.json")
        notes["hands_spec"] = spec if os.path.exists(spec) else None
        author_hands.apply(still, spec, base="still_o2", tag="still_hands")     # no spec: the rose only
        last = "still_hands"
    if cfg.get("wh2"):
        sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
        import wh2_px
        notes["wh2"] = wh2_px.run(still, WH2_ALIAS.get(pose, pose), cfg["wh2"].get("steps"), base=last, cfg=cfg["wh2"])
        last = "still_wh2"
    sp = os.path.join(still, "still.png")
    shutil.copyfile(os.path.join(still, last + ".png"), sp)
    colors = P.get("colors")
    rosace_shade_stills.remap(sp, colors)
    if hp and cfg.get("hair_hue_after_remap") and "hue" in __import__("hair_px").PRESETS[hp["preset"]]["steps"]:
        notes["hue_px"] = S2.hue_after_remap(still, colors, cfg.get("hair_hue_base", "remapped"))
    S2.previews(sp)
    if cfg.get("ground") and P.get("ground"):
        rosace_shade_stills.ground(still, P["ground"])
    return notes


def do_variant(v, a, poses, cfg, P, env):
    blend = os.path.join(LANES, f"finish-F3_{v}.blend")
    out = os.path.join(a.out, v)
    os.makedirs(out, exist_ok=True)
    log = []
    t0 = time.time()
    if not a.no_build:
        S2.blender(["--python", os.path.join(HERE, "bl_build.py"), "--", "--variant", v, "--out", blend],
                   f"build {v}", log)
    poses = variant_poses(v, poses, a.out)
    pxs = [int(x) for x in a.px.split(",")]
    stills = [s for s in STILLS if not a.only or s[0] in a.only.split(",")]
    if not a.no_render:
        for name, pose, extra in stills:
            pf = poses[pose]["path"]
            bl_run(GH_RENDER, ["--blend", blend, "--pose", pf, "--px", ",".join(map(str, pxs)), "--ss", "4",
                               "--passes", cfg["passes"], "--out", os.path.join(out, name)] + extra,
                   f"render {v} {name}", log)
            if cfg.get("face", {}).get("facepass"):
                bl_run(os.path.join(PIPE, "author_faces_pass.py"),
                       ["--blend", blend, "--pose", pf] + sum([["--still", os.path.join(out, name, f"px{px}")]
                                                               for px in pxs], []), f"facepass {v} {name}", log)
    layers = os.path.join(out, "_layers")
    notes = {}
    for name, pose, extra in stills:
        for px in pxs:
            still = os.path.join(out, name, f"px{px}")
            post = [sys.executable, os.path.join(PIPE, "rosace_post.py"), "--raw", still, "--no-face", "--tag", "noface",
                    "--shade", os.path.join(REPO, cfg["shading"])]
            S2.run(post, f"post {v} {name} {px}", log)
            if cfg.get("hair_px"):
                for f in ("noface_post.png", "noface_post_id.png"):
                    if os.path.exists(os.path.join(still, f)):
                        os.remove(os.path.join(still, f))
                import hair_px
                steps = [s_ for s_ in hair_px.PRESETS[cfg["hair_px"]["preset"]]["steps"]
                         if s_ in hair_px.ALL and s_ not in cfg["hair_px"].get("skip", [])]
                S2.run([sys.executable, os.path.join(PIPE, "hair_px.py"), "--still", still, "--preset",
                        cfg["hair_px"]["preset"], "--only", ",".join(steps)], f"hair {v} {name} {px}", log)
            layer = f"{pose}_{px}"
            ops = [] if os.path.exists(os.path.join(S2.ODIR, layer + ".json")) else ["--ops", f"{pose}_144"]
            common = ["--still", still, "--layer", layer, "--layer-dir", layers] + ops
            fam = P.get("rim_family", {}).get(pose) or P.get("rim_family", {}).get(WH2_ALIAS.get(pose, ""))
            senv = dict(env, ROSACE_RIM_FAMILY=fam) if fam else env
            S2.run([sys.executable, os.path.join(PIPE, "overrides.py"), "build"] + common, f"layer {v} {layer}", log, senv)
            S2.run([sys.executable, os.path.join(PIPE, "overrides.py"), "apply"] + common, f"apply {v} {name} {px}", log,
                   senv)
            notes[f"{name}_{px}"] = lane_passes(name, pose, px, still, cfg, P, log)
    json.dump({"variant": v, "blend": blend, "poses": poses, "integrated": cfg, "lanes": notes, "steps": log,
               "s": round(time.time() - t0, 1)}, open(os.path.join(out, "_log.json"), "w"), indent=1, default=str)
    print(f"variant {v} done in {time.time() - t0:.0f} s -> {out}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", default="control,A,B,C,D")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--only", default="")
    ap.add_argument("--no-build", action="store_true")
    ap.add_argument("--no-render", action="store_true")
    a = ap.parse_args()
    a.out = os.path.abspath(a.out)
    os.makedirs(a.out, exist_ok=True)
    poses = snapshot_poses(a.out)
    cfg = json.load(open(S2.INTEGRATED, encoding="utf-8"))["stills"]
    P = json.load(open(os.path.join(REPO, cfg["shading"]), encoding="utf-8"))
    env = dict(os.environ)
    if cfg.get("face", {}).get("composer"):
        env["ROSACE_FACES"] = cfg["face"]["composer"]
    if P.get("rim_style"):
        env["ROSACE_RIM_STYLE"] = os.path.join(REPO, P["rim_style"])
    for v in a.variants.split(","):
        do_variant(v, a, poses, cfg, P, env)


if __name__ == "__main__":
    main()
