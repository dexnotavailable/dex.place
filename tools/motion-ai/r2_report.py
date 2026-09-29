"""Round-2 numbers for N1 and N5: round-1 retimed (r1) vs round 2 (r2) vs the spike, one JSON.

  python tools/motion-ai/r2_report.py [--no-blender]
      -> review/motion/r2/round-1/_metrics.json   (names the clips: open it after the blind verdicts,
                                                  like key.json)

Pixel numbers come from motion_metrics.py (rendered sprites, any clip). Rig numbers come from
measure_action.py (rig_measure.py on every rendered image of the saved action; Rosace clips only, the
spike is a different rig). Cloth numbers come from the round-2 render meta (blender_apply.py --hero).
"""
import json
import math
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
import motion_metrics as MM  # noqa: E402

AUTH = REPO / "review" / "motion" / "r2" / "_authoring"
OUT = REPO / "review" / "motion" / "r2" / "round-1" / "_metrics.json"
REN = MM.REN
CONTACT = {"n1": 9, "n5": 30}
COIL = {"n1": 3, "n5": 9}
ANKLE_REST = 0.159


def rig_summary(name, move):
    R = json.loads((AUTH / f"rig_{name}.json").read_text())
    rig, disp = R["rig"], R["display"]
    frames = sorted(int(f) for f in rig)
    at = lambda f: rig[str(disp[f])]  # noqa: E731  (the image shown at game frame f)
    c, k = at(CONTACT[move]), at(COIL[move])
    gaps = [v for r in rig.values() for v in r.get("hand_gap_cm", {}).values()]
    # planted-foot drift: r2 = the sheet's plant spans; r1 = the retime's foot contacts (round 1's locks)
    import numpy as np
    if name.endswith("_r2"):
        meta = json.loads((REN / name / "px144" / "meta.json").read_text())
        spans = {s: [tuple(x) for x in v] for s, v in meta["motion"]["hero"]["plants"].items()}
    else:
        con = np.load(REN.parent / "retimed" / f"{name}.npz")["contacts"]
        spans = {}
        for si, s in enumerate("LR"):
            spans[s], a = [], None
            for f, on in enumerate(list(con[:, si]) + [False]):
                if on and a is None:
                    a = f
                if not on and a is not None:
                    spans[s].append((a, f - 1))
                    a = None
    slide = []
    for s, sp in spans.items():
        for a, b in sp:
            pts = [rig[str(disp[f])]["ankles"][s] for f in range(a, b + 1)]
            slide.append(round(max(math.dist(p[:2], pts[0][:2]) for p in pts) * 100, 2))
    return {
        "coil": {k2: k[k2] for k2 in ("stance_sw", "hips_drop", "torso_yaw", "hips_yaw", "separation", "lean",
                                       "line_of_action", "tip_vs_heel_H", "tip_behind_hip_H", "tip_height_H")},
        "contact": {k2: c[k2] for k2 in ("stance_sw", "hips_drop", "torso_yaw", "hips_yaw", "separation", "lean",
                                          "line_of_action", "glaive_pitch", "tip_height_H")},
        "max_torso_turn_deg": max(abs(r["torso_yaw"]) for r in rig.values()),
        "max_hip_shoulder_separation_deg": max(abs(r["separation"]) for r in rig.values()),
        "max_stance_sw": max(r["stance_sw"] for r in rig.values()),
        "lowest_hips_drop": min(r["hips_drop"] for r in rig.values()),
        "hand_to_shaft_cm_max": max(gaps) if gaps else None,
        "planted_foot_drift_cm_max": max(slide) if slide else 0.0,
        "planted_spans": {s: [list(x) for x in v] for s, v in spans.items()},
    }


def main():
    if "--no-blender" not in sys.argv:
        subprocess.run([sys.executable, str(HERE / "measure_action.py"), "n1", "n5", "n1_r2", "n5_r2"], check=True)
    px = MM.main(["n1", "n5"])
    out = {"_about": __doc__, "definitions": MM.__doc__}
    for m in ("n1", "n5"):
        meta = json.loads((REN / f"{m}_r2" / "px144" / "meta.json").read_text())
        hero = meta["motion"]["hero"]
        r1, r2 = rig_summary(m, m), rig_summary(f"{m}_r2", m)
        amp = {}
        for key in ("coil", "contact"):
            a, b = r1[key], r2[key]
            amp[key] = {
                "hip_drop_ratio": round((1 - b["hips_drop"]) / max(1e-3, 1 - a["hips_drop"]), 2),
                "stance_ratio": round(b["stance_sw"] / max(1e-3, a["stance_sw"]), 2),
                "torso_turn_r1_r2_deg": [a["torso_yaw"], b["torso_yaw"]],
                "lean_r1_r2_deg": [a["lean"], b["lean"]],
            }
        out[m] = {
            "pixels": {k: {kk: vv for kk, vv in v.items() if kk != "changes"} | {"silhouette": {
                kk: vv for kk, vv in v["silhouette"].items() if kk not in ("changes", "silhouette")}}
                for k, v in px[m].items()},
            "rig": {"r1_retimed": r1, "r2": r2},
            "r2_vs_r1_amplitude": amp,
            "r2_plant_drift_cm": hero["foot_drift"],
            "r2_cloth": {"holds": hero["holds"], "lag": hero["cloth_lag"], "dyn_omega_zeta": hero["cloth_dyn"]},
            "r1_cloth_on_holds": "0 px by construction: a held drawing was one image",
            "r2_hero_keys": hero["hero_keys"],
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1))
    print(OUT)
    return out


if __name__ == "__main__":
    main()
