"""Key stills on the canonical build: the stills set at 144 and 80 px with every kept lane pass.

  python tools/pixel-pipeline/stills_v2.py [--build] [--no-render] [--px 144,80] [--hi 640]
      [--blend D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend]
      [--out D:/Dex/Projects/dex-place-art/rosace/build/renders/integrated] [--only idle_hero] [--plain]

Stills: idle hero, N1 contact, Q stamp, the N2 pivot back view in the black and the white thong.
One Blender process at a time.

Integrated chain (the default since the Integrate step, 2026-09-29; the picks live in
art/rosace/integrated.json 'stills', PIPELINE.md 3.6g has the reasons):
  1. (--build) build_rosace_v2.py -> --blend (rosace.blend by default)
  2. per still: tools/art-construct/gh_render.py, the render_rosace.py passes plus the shading
     lane's light and depth2 passes and landmarks.json (the grip points the hand constructor needs);
     a --hi px beauty pass through render_rosace.py for review
  3. author_faces_pass.py: facepass.json + facewin.png (the face lane's F2 composer places the
     face on the v2 head's own projected features)
  4. rosace_post.py --no-face --tag noface --shade <shading preset>   (shading lane)
  5. hair_px.py --preset <p>                                          (hair lane; rewrites noface*)
  6. overrides.py build + apply, ROSACE_FACES=f2, the preset's rim style and per-still rim family:
     face, collar-cross glyph, rim -> still.png                     (face + shading lanes)
  7. hair_px.py --face-window (the brow windows), rosace_shade.post_face (the fringe's cast on the face)
     -> kept as still_layers.png
  8. outfit_px.py, outfit_px2.py (still -> still_ofx -> still_o2)    (outfit lane)
  9. author_hands.py apply --base still_o2 --tag still_hands       (glaive-hands lane)
 9b. (integrated.json stills.wh2) tools/art-construct/wh2_px.py: round WH2's faces, hair, tips, pin, fists,
     thighs -> still_wh2
 10. the shading preset's palette remap (codes keep their identity until here), then the hair lane's
     hue trial shifted from the remapped indigo -> still.png (+ _x3, _x6); the contact shadow ->
     still_ground.png
--plain: the pre-integration chain (render_rosace passes, post, overrides.py with the caller's
ROSACE_FACES): what the lane drivers use for their controls. It never runs a lane pass.
Outputs <out>/<still>/px<N>/{noface,still}.png (+ intermediates) and <out>/_log.json.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
POSES = os.path.join(REPO, "art", "rosace", "poses")
ODIR = os.path.join(REPO, "art", "rosace", "overrides")
INTEGRATED = os.path.join(REPO, "art", "rosace", "integrated.json")
GH_RENDER = os.path.join(REPO, "tools", "art-construct", "gh_render.py")
# still name, pose file, extra render args (as stills.sh)
STILLS = [
    ("idle_hero", "idle_hero", []),
    ("n1_contact", "n1_contact", []),
    ("q_stamp", "q_stamp", []),
    ("n2_pivot_black", "n2_pivot", ["--thong", "black"]),
    ("n2_pivot_white", "n2_pivot", ["--thong", "white"]),
]
sys.path.insert(0, HERE)


def run(cmd, label, log, env=None):
    t = time.time()
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out[-3000:])
        raise SystemExit(f"{label} failed ({r.returncode})")
    print(f"  {label}: {time.time() - t:5.1f} s")
    log.append({"step": label, "s": round(time.time() - t, 1),
                "notes": [ln.strip() for ln in out.splitlines()
                          if any(k in ln for k in ("STALE", "no face stamp", "face ", "colours", "RENDERED", "glyph",
                                                   "HANDS", "WARN", "shade:", "hair_px"))][:12]})
    return out


def blender(args, label, log):
    return run([sys.executable, os.path.join(HERE, "blender_env.py"), "run", "--python-exit-code", "1"] + args,
               label, log)


def previews(path):
    im = Image.open(path)
    base = path[:-4]
    for z in (3, 6):
        im.resize((im.width * z, im.height * z), Image.NEAREST).save(f"{base}_x{z}.png")


def hue_after_remap(still, colors, base="remapped", dh=0.028, ks=0.90):
    """the hair lane's hue trial (hair_px.final_hue: hair I1-I3 +10 degrees toward violet, 10% less
    saturated, hair px only) applied AFTER the shading preset's remap, so no lane's pass sees an
    off-palette hex. base 'remapped' shifts the shading preset's hexes (the shading lane's value map owns
    the indigo family); 'palette' shifts palette.json's (the hair lane's own hair colours, as it judged them)"""
    import hair_px
    meta = json.load(open(os.path.join(still, "meta.json")))
    sp = os.path.join(still, "still.png")
    img = np.array(Image.open(sp).convert("RGBA"))
    ids = np.array(Image.open(os.path.join(still, "noface_id.png")).convert("RGBA"))
    hair = (ids[..., 3] > 0) & (img[..., 3] > 0) & (ids[..., 0] == meta["materials"]["hair"]["id"])
    n = 0
    for c in ("I1", "I2", "I3"):
        hexc = (colors or {}).get(c) or meta["colors"][c]
        src = tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5))
        sel = hair & (img[..., :3] == src).all(-1)
        img[sel, :3] = hair_px.hue_shift(hexc if base == "remapped" else meta["colors"][c], dh, ks)
        n += int(sel.sum())
    Image.fromarray(img).save(sp)
    return n


def lane_passes(name, pose, px, still, cfg, preset, P, log):
    """steps 7-10 of the module doc on one still (after overrides.py apply wrote still.png)"""
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
            notes["face_window"] = run([sys.executable, os.path.join(HERE, "hair_px.py"), "--still", still,
                                        "--face-window"], f"hair window {name} {px}", log).strip()[-160:]
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
        author_hands.apply(still, spec, base="still_o2", tag="still_hands")
        last = "still_hands"
    if cfg.get("wh2"):
        # round WH2: faces re-anchored per pose, hair cleanup, tips, the crown pin, fists, thighs
        # (tools/art-construct/wh2_px.py; still_hands -> still_wh2, palette codes, before the remap)
        sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
        import wh2_px
        notes["wh2"] = wh2_px.run(still, pose, cfg["wh2"].get("steps"), base=last, cfg=cfg["wh2"])
        last = "still_wh2"
    sp = os.path.join(still, "still.png")
    shutil.copyfile(os.path.join(still, last + ".png"), sp)
    colors = P.get("colors")
    rosace_shade_stills.remap(sp, colors)
    if hp and cfg.get("hair_hue_after_remap") and "hue" in __import__("hair_px").PRESETS[hp["preset"]]["steps"]:
        notes["hue_px"] = hue_after_remap(still, colors, cfg.get("hair_hue_base", "remapped"))
    previews(sp)
    if cfg.get("ground") and P.get("ground"):
        rosace_shade_stills.ground(still, P["ground"])
    return notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", default=os.path.join(BUILD, "rosace.blend"))
    ap.add_argument("--out", default=os.path.join(BUILD, "renders", "integrated"))
    ap.add_argument("--px", default="144,80")
    ap.add_argument("--hi", type=int, default=640, help="also a hi-res beauty pass at this px (0 = none)")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--only", default="", help="comma list of still names")
    ap.add_argument("--plain", action="store_true", help="the pre-integration chain: no lane passes")
    ap.add_argument("--config", default=INTEGRATED, help="an integrated.json to trial (default: the canonical picks)")
    a = ap.parse_args()
    blend, out = os.path.abspath(a.blend), os.path.abspath(a.out)
    # the retired v1 base may be rendered read-only for comparison; it is never rebuilt from here
    assert not (a.build and os.path.basename(blend) in ("rosace_v1.blend", "rosace_pre_artistry.blend")), \
        "never rebuild a backup"
    pxs = [int(x) for x in a.px.split(",")]
    log = []
    stills = [s for s in STILLS if not a.only or s[0] in a.only.split(",")]
    cfg = {} if a.plain else json.load(open(a.config, encoding="utf-8"))["stills"]
    preset = os.path.join(REPO, cfg["shading"]) if cfg.get("shading") else None
    P = json.load(open(preset, encoding="utf-8")) if preset else {}
    env = dict(os.environ)
    if cfg.get("face", {}).get("composer"):
        env["ROSACE_FACES"] = cfg["face"]["composer"]
    if P.get("rim_style"):
        env["ROSACE_RIM_STYLE"] = os.path.join(REPO, P["rim_style"])
    if a.build:
        blender(["--python", os.path.join(HERE, "build_rosace_v2.py"), "--", "--out", blend], "build", log)
    if not a.no_render:
        for name, pose, extra in stills:
            pf = os.path.join(POSES, pose + ".json")
            if cfg.get("landmarks"):
                blender(["--python", GH_RENDER, "--", "--blend", blend, "--pose", pf, "--px", ",".join(map(str, pxs)),
                         "--ss", "4", "--passes", cfg["passes"], "--out", os.path.join(out, name)] + extra,
                        f"render {name}", log)
            else:
                blender(["--python", os.path.join(HERE, "render_rosace.py"), "--", "--blend", blend, "--pose", pf,
                         "--px", ",".join(map(str, pxs)), "--ss", "4", "--out", os.path.join(out, name)]
                        + (["--passes", cfg["passes"]] if cfg.get("passes") else []) + extra, f"render {name}", log)
            if a.hi:
                blender(["--python", os.path.join(HERE, "render_rosace.py"), "--", "--blend", blend, "--pose", pf,
                         "--px", str(a.hi), "--ss", "1", "--passes", "beauty", "--out", os.path.join(out, name)]
                        + extra, f"render {name} hi", log)
            if cfg.get("face", {}).get("facepass"):
                blender(["--python", os.path.join(HERE, "author_faces_pass.py"), "--", "--blend", blend, "--pose", pf]
                        + sum([["--still", os.path.join(out, name, f"px{px}")] for px in pxs], []),
                        f"facepass {name}", log)
    layers = os.path.join(out, "_layers")
    lane_notes = {}
    for name, pose, extra in stills:
        for px in pxs:
            still = os.path.join(out, name, f"px{px}")
            post = [sys.executable, os.path.join(HERE, "rosace_post.py"), "--raw", still, "--no-face", "--tag", "noface"]
            if preset:
                post += ["--shade", preset]
            run(post, f"post {name} {px}", log)
            if cfg.get("hair_px"):
                for f in ("noface_post.png", "noface_post_id.png"):    # hair_px restarts from these: drop stale ones
                    if os.path.exists(os.path.join(still, f)):
                        os.remove(os.path.join(still, f))
                hcmd = [sys.executable, os.path.join(HERE, "hair_px.py"), "--still", still, "--preset",
                        cfg["hair_px"]["preset"]]
                if cfg["hair_px"].get("skip"):       # the preset's pre-face steps minus 'skip'
                    import hair_px
                    hcmd += ["--only", ",".join(s_ for s_ in hair_px.PRESETS[cfg["hair_px"]["preset"]]["steps"]
                                                if s_ in hair_px.ALL and s_ not in cfg["hair_px"]["skip"])]
                run(hcmd, f"hair {name} {px}", log)
            layer = f"{pose}_{px}"
            ops = [] if os.path.exists(os.path.join(ODIR, layer + ".json")) else ["--ops", f"{pose}_144"]
            common = ["--still", still, "--layer", layer, "--layer-dir", layers] + ops
            senv = env
            fam = P.get("rim_family", {}).get(name) or P.get("rim_family", {}).get(pose)
            if fam:
                senv = dict(env, ROSACE_RIM_FAMILY=fam)
            if name != "n2_pivot_white":      # the thong variants share a layer (built from the black one)
                run([sys.executable, os.path.join(HERE, "overrides.py"), "build"] + common, f"layer {layer}", log, senv)
            run([sys.executable, os.path.join(HERE, "overrides.py"), "apply"] + common, f"apply {name} {px}", log, senv)
            if not a.plain:
                lane_notes[f"{name}_{px}"] = lane_passes(name, pose, px, still, cfg, preset, P, log)
                print(f"  lanes {name} {px}: {lane_notes[f'{name}_{px}']}"[:400])
    json.dump({"blend": blend, "px": pxs, "plain": a.plain, "integrated": cfg, "lanes": lane_notes, "steps": log},
              open(os.path.join(out, "_log.json"), "w"), indent=1, default=str)
    print("stills in", out)


if __name__ == "__main__":
    main()
