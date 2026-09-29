"""Automatic garbage checks for a generated or captured BVH (SOMA 77 layout, centimetres, Y-up).

  python tools/motion-ai/motion_qc.py clip.bvh [more.bvh ...] [--json out.json] [--grip 0.2,0.8]

Numbers it reports (all measured from the file, nothing modelled):

  foot_slide_cm_s   mean / p95 horizontal speed of a foot joint while it is planted
                    (planted = within 2.5 cm of its lowest height and moving < 20 cm/s
                    vertically). Mocap-clean motion sits around 1-4 cm/s mean.
  slide_cm          total horizontal distance feet travel while planted
  floor_cm          lowest joint height (negative = through the floor)
  jitter_cm         mean distance between each joint and a cubic 7-frame Savitzky-Golay fit of
                    itself (smooth arcs survive the fit; frame-to-frame buzz does not).
                    Clean motion: < 0.3 cm. Buzzing: > 0.6 cm.
  pops              one-frame jumps: a joint's per-frame speed > 2.5x both neighbours and
                    > 6 cm/frame (pinned keys snapping, capture glitches); pop_frames lists where
  jerk              mean |third difference| of joint positions, cm/frame^3 (higher = snappier
                    or noisier; compare variants of the same move, not across moves)
  wrist_deg         max and p95 angle between forearm and hand direction; > 80 deg reads as
                    a broken wrist
  hands_cm          distance between the two wrists: min / median / max, and the share of
                    frames inside the two-handed grip band (--grip, metres; default 0.15-0.85)
  yaw_deg           total signed hips rotation about the vertical (a 360 spin shows ~360)
  travel_cm         hips horizontal travel (start to end) and hips height range
  flags             human-readable warnings from the thresholds above
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bvh_tools import Bvh  # noqa: E402

FOOT_JOINTS = ("LeftFoot", "LeftToeBase", "RightFoot", "RightToeBase")


SG7 = np.array([-2, 3, 6, 7, 6, 3, -2]) / 21.0  # Savitzky-Golay, window 7, cubic


def _smooth(x):
    """Cubic Savitzky-Golay fit over 7 frames: keeps smooth motion (even fast arcs), removes buzz."""
    k = len(SG7)
    pad = k // 2
    xp = np.concatenate([np.repeat(x[:1], pad, 0), x, np.repeat(x[-1:], pad, 0)], 0)
    return np.apply_along_axis(lambda v: np.convolve(v, SG7[::-1], mode="valid"), 0, xp)


def yaw_series(P, names):
    L, R = P[:, names.index("LeftLeg")], P[:, names.index("RightLeg")]
    r = L - R
    fwd = np.stack([-r[:, 2], np.zeros(len(r)), r[:, 0]], -1)  # r x up
    yaw = np.unwrap(np.arctan2(fwd[:, 0], fwd[:, 2]))
    return np.degrees(yaw)


def qc(path, grip=(0.15, 0.85)):
    b = Bvh(path)
    P = b.positions()  # (F, J, 3) cm
    names = b.names
    fps = b.fps
    F = len(P)
    out = {"file": str(path), "frames": F, "fps": round(fps, 2), "seconds": round(F / fps, 2)}
    flags = []

    # feet
    speeds, slide = [], 0.0
    for jn in FOOT_JOINTS:
        if jn not in names:
            continue
        p = P[:, names.index(jn)]
        rest_h = np.percentile(p[:, 1], 5)
        v = np.diff(p, axis=0) * fps
        hs = np.linalg.norm(v[:, [0, 2]], axis=1)
        planted = (p[1:, 1] < rest_h + 2.5) & (np.abs(v[:, 1]) < 20.0)
        speeds.append(hs[planted])
        slide += float(hs[planted].sum() / fps)
    sp = np.concatenate(speeds) if speeds else np.zeros(1)
    out["foot_slide_cm_s"] = [round(float(sp.mean()), 2), round(float(np.percentile(sp, 95)), 2)] if sp.size else [0, 0]
    out["slide_cm"] = round(slide, 1)
    out["planted_share"] = round(float(sp.size / max(1, 4 * (F - 1))), 2)

    body = [i for i, n in enumerate(names) if b.channels[i] or n.endswith("_end")]
    out["floor_cm"] = round(float(P[:, body, 1].min()), 1)

    Pb = P[:, body]
    ex = 3  # ignore the padded ends of the fit
    out["jitter_cm"] = round(float(np.linalg.norm((Pb - _smooth(Pb))[ex:-ex], axis=-1).mean()), 3)
    # pops: a joint whose per-frame speed spikes to > 2.5x both neighbours and > 6 cm/frame, i.e. a
    # one-frame jump (fast but continuous swings don't trigger it: their neighbours are fast too)
    if F > 3:
        sp = np.linalg.norm(np.diff(Pb, axis=0), axis=-1)  # (F-1, J)
        mid, prv, nxt = sp[1:-1], sp[:-2], sp[2:]
        pop = (mid > 6.0) & (mid > 2.5 * prv) & (mid > 2.5 * nxt)
        fr = np.where(pop.any(1))[0] + 1
        out["pops"] = int(pop.sum())
        out["pop_frames"] = fr[:20].tolist()
    if F > 4:
        j3 = np.diff(Pb, n=3, axis=0)
        out["jerk"] = round(float(np.linalg.norm(j3, axis=-1).mean()), 3)

    wr = {}
    for side in ("Left", "Right"):
        try:
            fa = P[:, names.index(f"{side}Hand")] - P[:, names.index(f"{side}ForeArm")]
            hd = P[:, names.index(f"{side}HandMiddle1")] - P[:, names.index(f"{side}Hand")]
        except ValueError:
            continue
        c = (fa * hd).sum(-1) / (np.linalg.norm(fa, axis=-1) * np.linalg.norm(hd, axis=-1) + 1e-9)
        ang = np.degrees(np.arccos(np.clip(c, -1, 1)))
        wr[side] = [round(float(ang.max()), 1), round(float(np.percentile(ang, 95)), 1)]
    out["wrist_deg_max_p95"] = wr

    if "LeftHand" in names and "RightHand" in names:
        d = np.linalg.norm(P[:, names.index("LeftHand")] - P[:, names.index("RightHand")], axis=-1) / 100.0
        out["hands_m_min_med_max"] = [round(float(d.min()), 2), round(float(np.median(d)), 2), round(float(d.max()), 2)]
        out["two_hand_share"] = round(float(((d >= grip[0]) & (d <= grip[1])).mean()), 2)

    if "LeftLeg" in names:
        yaw = yaw_series(P, names)
        out["yaw_deg_total"] = round(float(yaw[-1] - yaw[0]), 1)
        out["yaw_deg_range"] = round(float(yaw.max() - yaw.min()), 1)
        out["yaw_speed_max_deg_s"] = round(float(np.abs(np.diff(yaw)).max() * fps), 1) if F > 1 else 0

    h = P[:, names.index("Hips")]
    out["travel_cm_xz"] = [round(float(h[-1, 0] - h[0, 0]), 1), round(float(h[-1, 2] - h[0, 2]), 1)]
    out["hips_y_cm_min_max"] = [round(float(h[:, 1].min()), 1), round(float(h[:, 1].max()), 1)]

    if out["foot_slide_cm_s"][0] > 8:
        flags.append(f"foot sliding (mean {out['foot_slide_cm_s'][0]} cm/s while planted)")
    if out.get("pops", 0) > 0:
        flags.append(f"{out['pops']} one-frame pops at frames {out['pop_frames']}")
    if out["floor_cm"] < -3:
        flags.append(f"through the floor ({out['floor_cm']} cm)")
    if out["jitter_cm"] > 0.6:
        flags.append(f"jitter ({out['jitter_cm']} cm from smoothed)")
    for s, (mx, p95) in wr.items():
        if p95 > 80:
            flags.append(f"{s} wrist bent past 80 deg for >5% of frames (p95 {p95})")
    out["flags"] = flags
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("bvh", nargs="+")
    p.add_argument("--json", default=None)
    p.add_argument("--grip", default="0.15,0.85")
    a = p.parse_args()
    g = tuple(float(x) for x in a.grip.split(","))
    res = [qc(f, g) for f in a.bvh]
    for r in res:
        print(json.dumps(r))
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
