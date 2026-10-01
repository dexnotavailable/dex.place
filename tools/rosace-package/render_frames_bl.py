"""Rosace packaging, Blender side: render the drive-9 passes for the stand-in-driven poses, one still set per pose key.

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python <this file> -- \
      --blend D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend --solved data/standin_solved.json \
      --keys idle0,run0 --out <dir> --px 144,80 [--yaw 62 --elev 8 --ss 4]

Derived from tools/pixel-pipeline/drive9/d9_blender.py (same repo; read-only here): the promoted drive-9 round-2 look
(head scale 1.10, tabard flare, circlet, drape, the 4x id/normal/depth/light/noise passes and the face pass), but the
poses come from posemap.py (the stand-in's per-frame poses mapped onto the rig, side view) instead of pose files.
The opened .blend is never saved. Per key and size: <out>/<key>/px<N>/{id,normal,depth,light,beauty,noise}.png,
meta.json (+ exported anchors), facepass.json, landmarks.json, pose.json.
"""
import json
import math
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.environ.get("ROSACE_PIPE", r"D:\Dex\Projects\dex.place\tools\pixel-pipeline")
SRC_REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, HERE)
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))
sys.path.insert(0, os.path.join(PIPE, "finish_f2"))

import bpy  # noqa: E402

from rosace import common, materials, posing, render  # noqa: E402
import figure_pose  # noqa: E402   (read-only: apply_pose, measure)
import head_scale  # noqa: E402
import posemap  # noqa: E402

D9 = os.path.join(PIPE, "drive9")
PICK = json.load(open(os.path.join(SRC_REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))["promoted"]
R2_MODEL = os.path.join(SRC_REPO, PICK["model"])
PASSES = ("id", "normal", "depth", "light", "beauty")
# stand-in expression -> the face stamp set the drive-9 finish knows (idle_hero / n1_contact / q_stamp / n2_pivot)
EXPR = {"open": "idle_hero", "smile": "idle_hero", "closed": "idle_hero", "focus": "n1_contact", "shout": "q_stamp", "hurt": "q_stamp"}


def _lib(name, path, cut="\nmain()"):
    src = open(path, encoding="utf-8").read()
    src = src[:src.rstrip().rfind(cut)]
    mod = types.ModuleType(name)
    mod.__file__ = path
    exec(compile(src, path, "exec"), mod.__dict__)
    return mod


def safe(key):
    return key.replace("~", "_to_").replace(":", "_").replace("/", "_")


def pose_error(arm, M, cam, entry):
    """how far (stand-in px, screen plane) the posed rig's joints are from the stand-in's solved joints"""
    sk = entry["sk"]
    pb = arm.pose.bones

    def scr(v):
        w = M @ v
        return (w.dot(cam_vec(cam.right)) / cam.du, -w.dot(cam_vec(cam.up)) / cam.du)

    want = {
        "ankleN": (sk["ankleN"], pb["J_Bip_R_Foot"].head), "ankleF": (sk["ankleF"], pb["J_Bip_L_Foot"].head),
        "kneeN": (sk["kneeN"], pb["J_Bip_R_LowerLeg"].head), "kneeF": (sk["kneeF"], pb["J_Bip_L_LowerLeg"].head),
        "elN": (sk["elN"], pb["J_Bip_R_LowerArm"].head), "elF": (sk["elF"], pb["J_Bip_L_LowerArm"].head),
        "haN": (sk["haN"], pb["J_Bip_R_Hand"].head), "haF": (sk["haF"], pb["J_Bip_L_Hand"].head),
        "neck": (sk["neckBase"], pb["J_Bip_C_Neck"].head), "head": (sk["headC"], pb["J_Bip_C_Head"].tail),
        "pelvis": (sk["pelvis"], pb["J_Bip_C_Hips"].head), "wButt": (sk["wButt"], pb["glaive_butt"].head),
        "wTip": (sk["wTip"], pb["glaive_tip"].head),
    }
    out = {}
    for k, (t, b) in want.items():
        x, y = scr(b)
        out[k] = [round(x - t[0], 1), round(y - t[1], 1)]
    return out


def cam_vec(v):
    import mathutils
    return mathutils.Vector(v)


def main():
    argv = common.args_after_dashes(sys.argv)
    blend = common.arg(argv, "--blend")
    out = os.path.abspath(common.arg(argv, "--out"))
    solved = json.load(open(common.arg(argv, "--solved"), encoding="utf-8"))
    keys = common.arg(argv, "--keys").split(",")
    pxs = [int(x) for x in common.arg(argv, "--px", "144,80").split(",")]
    ss = common.arg(argv, "--ss", 4, int)
    yaw = float(common.arg(argv, "--yaw", 62))
    elev = float(common.arg(argv, "--elev", 8))
    assert "rosace.blend" not in out
    bpy.ops.wm.open_mainfile(filepath=blend)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    d9b = _lib("d9_blender_lib", os.path.join(D9, "d9_blender.py"))
    f1 = d9b.f1_module()
    sys.path.insert(0, D9)
    import r2_blender
    R2 = json.load(open(R2_MODEL, encoding="utf-8"))
    r2rep = {"mesh_edits": r2_blender.mesh_edits(R2.get("mesh_edits")), "circlet": r2_blender.circlet(R2.get("circlet"))}
    print("ROSACE R2", json.dumps(r2rep), flush=True)
    for name in list(materials.PASS_NODES):
        d9b.add_noise_pass(name)
    hcfg = json.load(open(os.path.join(SRC_REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))["head"]
    hcfg = dict(hcfg)
    hcfg["head"] = float(PICK["head"])
    hc = head_scale.cfg_from({k: hcfg[k] for k in ("head", "neck_w", "neck_l", "fit_h")})
    head_scale.install(hc)
    arm = posing.arm_obj()
    # a first application fits the height (head scale); H is final after it
    posing.apply_pose({"name": "warm", "root": {"loc": [0, 0, 0], "rot": [0, 0, 0]}})
    bpy.context.view_layer.update()
    H = float(arm["rosace_height"])
    cam = posemap.Cam(yaw, elev, H)
    rep = {"blend": blend, "H": H, "yaw": yaw, "elev": elev, "keys": {}}
    os.makedirs(out, exist_ok=True)
    import copy

    GRIP = {"glaive_butt": 0.0, "grip_off": 0.924, "grip_mid": 1.206, "grip_main": 1.489, "glaive_tip": 2.567}

    def vnorm(v):
        l = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / l for x in v]

    def load_hero(spec):
        """an existing hand-posed key (art/rosace/poses/<name>.json; motion/ keys use the motion lane's hand_R/free-left
        conveniences, resolved here as tools/motion-ai/hero_layer.resolve does), with the drive-9 drape and round-2
        patches as d9_blender.py poses it. '+breath<t>' / '+settle' add small authored deltas (idle breathing, a held pose relaxing)."""
        name, _, mod = spec.partition("+")
        path = d9b.pose_file([name + ".json"])
        P, _ = figure_pose.load_pose(path)
        P = copy.deepcopy(P)
        W = P.get("weapon")
        if W and "hand_R" in W:
            d = vnorm(W["dir"])
            slide = float(P.get("hands", {}).get("R", {}).get("slide", 0.0))
            hr = W.pop("hand_R")
            W["at"] = [hr[i] - d[i] * slide for i in range(3)]
            W["socket"] = "grip_off"
        if P.get("hands", {}).get("L", {}).get("free"):
            P["hands"].pop("L")
        patch = d9b.DRAPE["p5"].get(P.get("name"))
        if patch:
            P = d9b.deep_merge(P, copy.deepcopy(patch))
        r2patch = R2.get("poses", {}).get(P.get("name"))
        if r2patch:
            P = d9b.deep_merge(P, copy.deepcopy(r2patch))
        P["camera"] = {"yaw": yaw, "elev": elev}
        P["expression"] = {"idle_appeal": "idle_hero", "idle_hero": "idle_hero", "n1_contact": "n1_contact", "q_stamp": "q_stamp"}.get(Path_name(name), "idle_hero")
        if mod.startswith("breath"):
            t = float(mod[6:] or 0)
            bend = P.setdefault("figure", {}).setdefault("torso", {}).setdefault("bend", [0, 0, 0])
            bend[0] = bend[0] - 1.6 * t
        elif mod == "settle":
            D = P.get("drape", {})
            for k, v in D.get("chains", {}).items():
                if "wind" in v:
                    v["wind"] = [x * 0.45 for x in v["wind"]]
            if "wind" in D:
                D["wind"] = [x * 0.45 for x in D["wind"]]
        return normalise(P)

    def Path_name(n):
        return os.path.basename(n)

    def normalise(P):
        """weapon -> {butt, dir, edge}; gripping hands -> {grip_main, slide}, so two poses can be blended"""
        W = P.get("weapon")
        if W:
            d = vnorm(W["dir"])
            if "butt" in W:
                butt = list(W["butt"])
            else:
                z = GRIP.get(W.get("socket", "grip_main"), 0.0)
                butt = [W["at"][i] - d[i] * z for i in range(3)]
            P["weapon"] = {"butt": butt, "dir": d, "edge": list(W["edge"])}
        for s, h in list(P.get("hands", {}).items()):
            if "grip" in h:
                dist = GRIP[h["grip"]] + float(h.get("slide", 0.0))
                P["hands"][s] = dict(h, grip="grip_main", slide=dist - GRIP["grip_main"])
        return P

    def lerp_tree(a, b, t):
        if isinstance(a, dict) and isinstance(b, dict):
            out = {}
            for k in set(a) | set(b):
                if k in a and k in b:
                    out[k] = lerp_tree(a[k], b[k], t)
                else:
                    out[k] = copy.deepcopy(a[k] if k in a else b[k])
            return out
        if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
            return a + (b - a) * t
        if isinstance(a, list) and isinstance(b, list) and len(a) == len(b) and all(isinstance(x, (int, float)) for x in a + b):
            return [x + (y - x) * t for x, y in zip(a, b)]
        return copy.deepcopy(a if t < 0.5 else b)

    def build(key):
        """the pose dict for one render key: 'hero:<pose>[+mod]', 'blend:<A>|<B>|<t>', or a stand-in pose key"""
        if key.startswith("hero:"):
            return load_hero(key[5:]), None, {}
        if key.startswith("blend:"):
            ka, kb, t = key[6:].rsplit("|", 2)
            pa, _, _ = build(ka)
            pb_, _, _ = build(kb)
            t = float(t)
            P = lerp_tree(pa, pb_, t)
            near = pa if t < 0.5 else pb_
            # hands are discrete (the nearer pose's grips, free hands and figure-block hand placements), the glaive rides
            # the holding hand: the blended grip point stays on the blended shaft, so nobody is left without the weapon
            P["hands"] = copy.deepcopy(near.get("hands", {}))
            fig_hands = near.get("figure", {}).get("hands")
            P.setdefault("figure", {})
            if fig_hands is not None:
                P["figure"]["hands"] = copy.deepcopy(fig_hands)
            else:
                P["figure"].pop("hands", None)
            if "weapon" in P:
                P["weapon"]["dir"] = vnorm(P["weapon"]["dir"])
                P["weapon"]["edge"] = vnorm(P["weapon"]["edge"])
                holder = next((h for h in ("R", "L") if "grip" in P["hands"].get(h, {}) and "grip" in pa.get("hands", {}).get(h, {})
                               and "grip" in pb_.get("hands", {}).get(h, {})), None)
                if holder:
                    def grip_point(Q):
                        w, hh = Q["weapon"], Q["hands"][holder]
                        dist = GRIP["grip_main"] + hh["slide"]
                        return [w["butt"][i] + w["dir"][i] * dist for i in range(3)]
                    ga, gb = grip_point(pa), grip_point(pb_)
                    g = [ga[i] + (gb[i] - ga[i]) * t for i in range(3)]
                    dist = GRIP["grip_main"] + P["hands"][holder]["slide"]
                    P["weapon"]["butt"] = [g[i] - P["weapon"]["dir"][i] * dist for i in range(3)]
            return P, None, {}
        entry = dict(solved["poses"][key])
        entry["key"] = key
        P1, info = posemap.body_pose(entry, cam, yaw, elev, EXPR)
        posing.apply_pose(P1)
        bpy.context.view_layer.update()
        Mx = arm.matrix_world
        shoulders = {s: tuple(Mx @ arm.pose.bones[f"J_Bip_{s}_UpperArm"].head) for s in "LR"}
        arms, ainfo = posemap.arms_pose(entry, cam, shoulders)
        P = dict(P1)
        for k, v in arms.items():
            if isinstance(v, dict) and isinstance(P.get(k), dict):
                P[k] = dict(P[k], **v)
            else:
                P[k] = v
        return normalise(P), entry, {"hip_z": info["hip_z"], "grip": ainfo["grip"], "shoulders": {s: list(v) for s, v in shoulders.items()}}

    for item in keys:
        out_key, _, key = item.rpartition("=") if "=" in item else ("", "", item)
        out_key = out_key or key
        try:
            P, entry, extra = build(key)
        except Exception:  # noqa: BLE001  one bad key must not cost the rest of the batch
            import traceback
            print("ROSACE FAILED", item, traceback.format_exc(), flush=True)
            continue
        P["camera"] = {"yaw": yaw, "elev": elev}
        meta_p = posing.apply_pose(P)
        bpy.context.view_layer.update()
        M = arm.matrix_world
        rep["keys"][out_key] = dict(extra, render_key=key)
        if entry is not None:
            rep["keys"][out_key]["err"] = pose_error(arm, M, cam, entry)
        key = out_key
        for px in pxs:
            d = os.path.join(out, safe(key), f"px{px}")
            os.makedirs(d, exist_ok=True)
            json.dump(P, open(os.path.join(d, "pose.json"), "w"), indent=1)
            shot_m = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=ss)
            render.render_passes(sc, d, PASSES)
            d9b.set_noise_scale(px)
            materials.set_pass("noise")
            sc.render.filepath = os.path.join(d, "noise.png")
            bpy.ops.render.render(write_still=True)
            materials.set_pass("beauty")
            anchors = posing.anchors(sc, px)
            # export anchors (px from the pivot, at the final size; y down)
            ax, ay = shot_m["anchor"]

            def proj_bone(n):
                p = render.project(sc, M @ arm.pose.bones[n].head)
                return [round(p[0] / ss - ax, 1), round(p[1] / ss - ay, 1)]

            exp = {"tip": proj_bone("glaive_tip"), "butt": proj_bone("glaive_butt"), "handN": proj_bone("J_Bip_R_Hand"),
                   "handF": proj_bone("J_Bip_L_Hand"), "head": proj_bone("J_Bip_C_Head"), "chest": proj_bone("J_Bip_C_UpperChest")}
            exp["halo"] = [exp["head"][0], round(exp["head"][1] - 0.13 * px / H * 0 - 9 * px / 96.0, 1)]
            render.write_meta(os.path.join(d, "meta.json"), shot_m,
                              {"pose": meta_p.get("name"), "expression": meta_p.get("expression"), "pose_file": None,
                               "passes": list(PASSES) + ["noise"], "anchors": anchors, "frames": None, "thong": None,
                               "applier": "figure_pose+head_scale+posemap",
                               "d9": {"shot": "frame", "expr": P["expression"], "head": hc, "drape": None, "r2": R2_MODEL},
                               "export_anchors": exp, "stand_in_key": key})
            f1.facepass(sc, json.load(open(os.path.join(d, "meta.json"))), d)
            try:
                lm = figure_pose.measure(arm, dict(P, camera={"yaw": yaw, "elev": elev}), pxs=(px,), anchors={px: shot_m["anchor"]})
                json.dump(lm, open(os.path.join(d, "landmarks.json"), "w", encoding="utf-8"), indent=1)
            except Exception as e:  # noqa: BLE001
                print("ROSACE WARN landmarks", key, px, e)
            print("ROSACE RENDERED", key, px, shot_m["canvas"], flush=True)
    json.dump(rep, open(os.path.join(out, f"_render_{int(__import__('time').time())}.json"), "w"), indent=1, default=str)


main()
