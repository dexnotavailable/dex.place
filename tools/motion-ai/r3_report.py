"""Round-3 numbers for N1 and N5: round 2 (re-rendered on the round-3 model) vs round 3 vs the spike.

  python tools/motion-ai/r3_report.py [--out review/motion/r3/round-1/_metrics.json]

The file names the clips, so it is closed to critics until their blind verdicts are in (like key.json).
Pixel numbers: motion_metrics.py on the rendered sprites, with and without the smears (body_only).
Rig numbers: blender_apply.py --hero writes rig_measure.py numbers and the blade of every rendered image
into meta.json (motion.hero.rig / .blade), so no second Blender pass is needed.

  phase ratio        mean pixel change at the strike drawings / mean at the anticipation drawings
                     (N1: A1 A2 A3 vs S1 C1; N5: A1 A2 A3 A4 vs S1 S2 S3 C1). Body drawings only: a
                     cloth-only redraw is never an anticipation or strike step. Reported on the shipped
                     frames (smear included) and on the body-only frames.
  entry ratio        change at the first strike drawing / change at the last body-drawing step before it
  span at contact    the contact image's horizontal extent / 144 px
  sweep (N5)         A4 through S3 (+ C1): glaive pitch, blade height (base and tip) against her posed
                     knee and upper-chest heights, blade above the head top, haft over the face (the
                     head's screen position within 6 px of the haft line, haft nearer the camera)
  spacing ratio      the animator's spacing: mean on-screen travel (px) of tracked points between one
                     body drawing and the one before it, strike steps over anticipation steps (same
                     drawings as the phase ratio). 'joints' = hips, upper chest, head, both hands,
                     elbows, knees and ankles plus the glaive tip and butt (Rosace only); 'subset' =
                     head, the ground point under the hips, glaive tip and butt, the anchors the spike
                     also records, so all three clips compare; 'tip' = the glaive tip alone (what
                     the eye follows in a strike). Unlike the RGBA count it doesn't
                     saturate: a 7% step moves 7% as far.
  line of action     rear ankle -> head top against vertical at the coil drawings, in her facing frame
                     and in the pelvis's own frame (rig_measure.py); chest to camera (180 = back to it); round 3c adds line_of_action_screen (as the viewer sees it, + = toward the target)
  foot drift         planted-foot drift over every plant span (0 by construction)
  grip error         worst gripping hand's grip point to the haft's centre line
  stole lag          frames until a stole tip is half-way to its new drape after a drawing change:
                     on screen (the root moves with the body, so this stays ~1) and on the chain's
                     shape (tip relative to its root)
  cloth on holds     largest chain-tip travel on screen during held drawings
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
import motion_metrics as MM  # noqa: E402

OUT = REPO / "review" / "motion" / "r3" / "round-1" / "_metrics.json"
REN = MM.REN
PH = {"n1": {"anticipation": [1, 3, 6], "strike": [8, 9], "contact": 9, "coil": [3, 6], "sweep": []},
      "n5": {"anticipation": [1, 5, 9, 23], "strike": [27, 28, 29, 30], "contact": 30, "coil": [9],
             "sweep": [23, 27, 28, 29, 30]}}


def project(meta, p):
    cam = meta["cam"]
    v = np.asarray(p, float) - np.asarray(cam["loc"])
    W, H = meta["canvas"]
    return np.array([W / 2 + v @ np.asarray(cam["right"]) * meta["ppm"], H / 2 - v @ np.asarray(cam["up"]) * meta["ppm"],
                     v @ np.asarray(cam["fwd"])])


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, float((p - a) @ ab / max(ab @ ab, 1e-9))))
    return float(np.linalg.norm(p - (a + ab * t))), t


def sweep_checks(meta, frames):
    mo = meta["motion"]
    hero = mo["hero"]
    Hm = meta["height_m"]
    rows = {}
    for f in frames:
        img = mo["sample_frame"][f]
        b = hero["blade"].get(str(img))
        r = hero["rig"][str(img)]
        if b is None:
            continue
        head_c = (np.asarray(b["head"]) + np.asarray(b["head_top"])) / 2
        hp, butt, tip = project(meta, head_c), project(meta, b["butt"]), project(meta, b["tip"])
        d, t = seg_dist(hp[:2], butt[:2], tip[:2])
        haft_z = butt[2] + (tip[2] - butt[2]) * t
        blade_z = [b["base"][2], b["tip"][2]]
        rows[str(f)] = {
            "drawing": mo["drawing"][f], "glaive_pitch": r.get("glaive_pitch"),
            "blade_z_H": [round(z / Hm, 3) for z in blade_z],
            "knee_z_H": round(min(b["knee_z"]) / Hm, 3) if "knee_z" in b else None,
            "chest_z_H": round(b["chest_z"] / Hm, 3) if "chest_z" in b else None,
            "blade_in_knee_to_chest": (min(blade_z) >= min(b["knee_z"]) - 0.05 and max(blade_z) <= b["chest_z"] + 0.05)
            if "knee_z" in b else None,
            "blade_over_head": max(blade_z) > b["head_top"][2],
            "haft_to_face_px": round(d, 1), "haft_in_front_of_face": bool(haft_z < hp[2]),
            "haft_over_face": bool(d < 6.0 and haft_z < hp[2]),
        }
    return rows


def loa_screen(meta, img):
    """round 3c: the line of action as the viewer sees it: the rear ankle (the one further from the target, screen-left)
    to the head top, against screen vertical, + = leaning toward the target (screen-right). The critics judge this one;
    rig_measure's line_of_action is in her facing frame."""
    b = meta["motion"]["hero"]["blade"][str(img)]
    ank = [project(meta, b["joints"][k]) for k in ("J_Bip_L_Foot", "J_Bip_R_Foot")]
    rear = min(ank, key=lambda p: p[0])
    top = project(meta, b["head_top"])
    return round(math.degrees(math.atan2(top[0] - rear[0], rear[1] - top[1])), 1)


def _pts_rosace(meta, img, subset):
    b = meta["motion"]["hero"]["blade"][str(img)]
    if subset == "tip":
        return np.array([project(meta, b["tip"])[:2]])
    if subset:
        head = (np.asarray(b["head"]) + np.asarray(b["head_top"])) / 2
        root = np.array([b["hips"][0], b["hips"][1], 0.0])
        P = [head, root, b["tip"], b["butt"]]
    else:
        P = list(b["joints"].values()) + [b["tip"], b["butt"]]
    return np.array([project(meta, p)[:2] for p in P])


def spacing_rosace(meta, ph, subset=False):
    mo = meta["motion"]
    body = mo["body_sample_frame"]

    def step(f):
        a, b = body[f - 1], body[f]
        if a == b:
            return None
        return float(np.mean(np.linalg.norm(_pts_rosace(meta, b, subset) - _pts_rosace(meta, a, subset), axis=1)))
    ant = [step(f) for f in ph["anticipation"]]
    stk = [step(f) for f in ph["strike"]]
    ant = [round(x, 1) for x in ant if x is not None]
    stk = [round(x, 1) for x in stk if x is not None]
    return {"anticipation_px": ant, "strike_px": stk,
            "ratio": round(float(np.mean(stk)) / max(0.1, float(np.mean(ant))), 2) if ant and stk else None}


def spacing_spike(tip_only=False):
    m = json.loads((MM.SPIKE / "meta_px144_ss4.json").read_text())
    a = m["anchors"]

    def pts(f):
        x = a[str(f)]
        if tip_only:
            return np.array([x["blade_edge"][-1][:2]])
        return np.array([x["head"][:2], x["root"][:2], x["blade_edge"][-1][:2], x["butt"][:2]])

    def step(f):
        return float(np.mean(np.linalg.norm(pts(f) - pts(f - 1), axis=1)))
    ph = MM.PHASES["spike"]
    ant = [round(step(f), 1) for f in ph["anticipation"]]
    stk = [round(step(f), 1) for f in ph["strike"]]
    return {"anticipation_px": ant, "strike_px": stk, "ratio": round(float(np.mean(stk)) / float(np.mean(ant)), 2)}


def clip(name, move):
    d = REN / name / "px144"
    meta = json.loads((d / "meta.json").read_text())
    mo = meta["motion"]
    hero = mo["hero"]
    ph = PH[move]
    shipped = MM.clip_metrics(MM.load_rosace(name), ph)
    body = MM.clip_metrics(MM.load_rosace(name, body_only=True), ph)
    sil = MM.clip_metrics(MM.load_rosace(name), ph, MM.silhouette_change)
    rig = hero["rig"]
    at = lambda f: rig[str(mo["sample_frame"][f])]  # noqa: E731
    gaps = [v for r in rig.values() for v in r.get("hand_gap_cm", {}).values()]
    coil = {str(f): {k: at(f).get(k) for k in ("line_of_action", "line_of_action_body", "chest_to_cam", "head_down",
                                                 "lean", "hips_drop", "stance_sw", "knee_gap_over_ankle_gap",
                                                 "torso_yaw", "hips_yaw", "separation")} for f in ph["coil"]}
    for f in ph["coil"]:
        coil[str(f)]["line_of_action_screen"] = loa_screen(meta, mo["sample_frame"][f])
    lag = hero["cloth_lag"]
    smear = json.loads((d / "smear.json").read_text()) if (d / "smear.json").exists() else {}
    strip = lambda m: {k: v for k, v in m.items() if k != "changes"}  # noqa: E731
    return {
        "phase_ratio_shipped": shipped["ratio"], "phase_ratio_body_only": body["ratio"],
        "entry_ratio_body_shipped": shipped["entry_ratio_body"], "entry_ratio_body_body_only": body["entry_ratio_body"],
        "entry_ratio_shipped": shipped["entry_ratio"],
        "anticipation_px_shipped": shipped["anticipation_px"], "strike_px_shipped": shipped["strike_px"],
        "anticipation_px_body_only": body["anticipation_px"], "strike_px_body_only": body["strike_px"],
        "silhouette_phase_ratio": sil["ratio"],
        "spacing_joints": spacing_rosace(meta, ph), "spacing_subset": spacing_rosace(meta, ph, subset=True),
        "spacing_tip": spacing_rosace(meta, ph, subset="tip"),
        "span_contact_H": shipped["span_contact_H"], "span_strike_peak_H": shipped["span_strike_peak_H"],
        "coil": coil,
        "contact": {k: at(ph["contact"]).get(k) for k in ("stance_sw", "hips_drop", "lean", "line_of_action",
                                                           "glaive_pitch", "tip_height_H", "chest_to_cam")},
        "sweep": sweep_checks(meta, ph["sweep"]) if ph["sweep"] else None,
        "foot_drift_cm_max": max([x["max_drift_cm"] for v in hero["foot_drift"].values() for x in v] or [0]),
        "grip_error_cm_max": max(gaps) if gaps else None,
        "stole_lag": {c: {k: v for k, v in (lag.get(c) or {}).items() if k not in ("trail_err_px", "stream")}
                      for c in ("stole_A", "stole_B")},
        "stole_stream": {c: (lag.get(c) or {}).get("stream") for c in ("stole_A", "stole_B")},
        "other_lag": {c: {k: lag[c].get(k) for k in ("median_frames_to_half", "shape_median_frames_to_half")}
                      for c in lag if not c.startswith("stole")},
        "stole_lag_offset_f": hero.get("cloth_lag_offset_f", {}),
        "cloth_on_holds_px_max": max([h["max_px"] for h in hero["holds"]] or [0]),
        "holds": [{k: h[k] for k in ("drawing", "frames", "images", "max_px")} for h in hero["holds"]],
        "smear": smear,
        "_pixels_shipped": strip(shipped), "_pixels_body_only": strip(body),
    }


def main():
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT
    new = sys.argv[sys.argv.index("--new") + 1] if "--new" in sys.argv else None     # round 3b: --new r3b; 3c: --new r3c
    res = {"_about": __doc__, "definitions": MM.__doc__}
    if new:
        PH["n5"]["sweep"] = [23, 27, 28, 29, 30, 33]
    for m in ("n1", "n5"):
        sp = MM.load_spike()
        spk = MM.clip_metrics(sp, MM.PHASES["spike"])
        res[m] = {"r2": clip(f"{m}_r2m", m), "r3": clip(f"{m}_r3", m),
                  "spike": {"phase_ratio": spk["ratio"], "entry_ratio": spk["entry_ratio"],
                            "span_contact_H": spk["span_contact_H"], "spacing_subset": spacing_spike(), "spacing_tip": spacing_spike(True),
                            "anticipation_px": spk["anticipation_px"], "strike_px": spk["strike_px"]},
                  "_clips": {"r2": f"{m}_r2m (round-2 sheet on the round-3 model)", "r3": f"{m}_r3"}}
        if new == "r3c":                 # round 3c: round 3b too, the clip the critics just scored
            res[m]["r3b"] = clip(f"{m}_r3b", m)
            res[m]["_clips"]["r3b"] = f"{m}_r3b (round 3b, r3/round-2)"
        if new:
            res[m][new] = clip(f"{m}_{new}", m)
            res[m]["_clips"][new] = f"{m}_{new} (this round)"
            res[m]["_clips"]["r3"] = f"{m}_r3 (round 3, r3/round-1)"
        r2, r3 = res[m]["r2"], res[m][new or "r3"]
        print(f"{m}: phase ratio shipped r2 {r2['phase_ratio_shipped']} -> r3 {r3['phase_ratio_shipped']} "
              f"(body only {r2['phase_ratio_body_only']} -> {r3['phase_ratio_body_only']}); entry(body) "
              f"{r2['entry_ratio_body_shipped']} -> {r3['entry_ratio_body_shipped']}; span {r2['span_contact_H']} -> "
              f"{r3['span_contact_H']} H; drift {r3['foot_drift_cm_max']} cm; grip {r3['grip_error_cm_max']} cm")
        print(f"   spacing (joints) r2 {r2['spacing_joints']['ratio']} -> r3 {r3['spacing_joints']['ratio']}; subset r2 "
              f"{r2['spacing_subset']['ratio']} -> r3 {r3['spacing_subset']['ratio']} (spike {res[m]['spike']['spacing_subset']['ratio']})")
        print(f"   spacing (tip) r2 {r2['spacing_tip']['ratio']} -> r3 {r3['spacing_tip']['ratio']} (spike {res[m]['spike']['spacing_tip']['ratio']})")
        print("   r3 steps", r3["spacing_joints"], "| rgba ant", r3["anticipation_px_shipped"], "strike", r3["strike_px_shipped"])
        print("   coil", json.dumps(r3["coil"]))
        print("   stole lag", json.dumps(r3["stole_lag"]))
        if r3["sweep"]:
            for f, v in r3["sweep"].items():
                print("   sweep", f, json.dumps(v))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=1))
    print(out)


if __name__ == "__main__":
    main()
