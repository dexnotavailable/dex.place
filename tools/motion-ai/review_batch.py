"""Preview + QC every generated/captured BVH under the raw folder, and rank variants per move.

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/review_batch.py [move ...] [--no-render]

For every <raw>/<move>/*.bvh (and <raw>/video/*.bvh): renders review/motion/previews/<move>/<stem>.mp4,
.gif and _sheet.png (motion_preview.py), runs motion_qc.py, reads the Kimodo run report
(key-pose and path errors), and writes review/motion/previews/<move>/summary.json plus a
printed table sorted by a rough garbage score (lower is better):

  score = foot slide mean (cm/s) + 5 * jitter (cm) + 3 * pops + key error mean (cm) + path error mean (cm)
          + 0.3 * max(0, wrist p95 - 60 deg) + intent penalty

Intent penalty (what the move is supposed to show): 20 if a two-handed move keeps both
wrists on the haft (0.15-0.85 m apart) for under half the clip; 20 if a spin move (dash,
dash_attack, n5) turns the hips through under 270 deg (dash) / 120 deg (n5). The score only
sorts; the final call is made by looking at the sheets.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from motion_qc import qc  # noqa: E402

RAW = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw")
PREV = Path(r"D:\Dex\Projects\dex.place\review\motion\previews")
PY = sys.executable
TWO_HANDED = {"n1", "n5", "n5long", "dash_attack"}
SPIN = {"dash": 270, "dash_attack": 270, "n5": 120, "n5long": 120}


def run_report(bvh):
    stem = bvh.stem
    base = stem.rsplit("_", 1)[0] if stem[-3:-2] == "_" and stem[-2:].isdigit() else stem
    j = bvh.with_name(base + ".json")
    if not j.exists():
        return None, None
    rep = json.loads(j.read_text(encoding="utf-8"))
    i = int(stem[-2:]) if base != stem else 0
    ce = rep.get("constraint_error_cm") or {}
    k = ce.get("keys_mean_max", [[None, None]])
    pth = ce.get("path_mean_max", [[None, None]])
    return (k[min(i, len(k) - 1)] if k else None), (pth[min(i, len(pth) - 1)] if pth else None)


def score(move, q, kerr, perr):
    s = q["foot_slide_cm_s"][0] + 5 * q["jitter_cm"] + 3 * q.get("pops", 0)
    s += (kerr[0] or 0) if kerr else 0
    s += (perr[0] or 0) if perr else 0
    wr = max((v[1] for v in q["wrist_deg_max_p95"].values()), default=0)
    s += 0.3 * max(0, wr - 60)
    m = move.split("_video")[0]
    if m in TWO_HANDED and q.get("two_hand_share", 1) < 0.5:
        s += 20
    if m in SPIN and q.get("yaw_deg_range", 0) < SPIN[m]:
        s += 20
    return round(s, 1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("moves", nargs="*")
    p.add_argument("--raw", default=str(RAW))
    p.add_argument("--no-render", action="store_true")
    a = p.parse_args()
    raw = Path(a.raw)
    moves = a.moves or sorted(d.name for d in raw.iterdir() if d.is_dir() and not d.name.startswith("_"))
    for m in moves:
        rows = []
        outdir = PREV / m
        outdir.mkdir(parents=True, exist_ok=True)
        for bvh in sorted((raw / m).glob("*.bvh")):
            if not a.no_render:
                subprocess.run([PY, str(HERE / "motion_preview.py"), str(bvh), "--out", str(outdir / bvh.stem),
                                "--sheet", "--every", "4"], check=True, capture_output=True)
            q = qc(str(bvh))
            kerr, perr = run_report(bvh)
            rows.append({"bvh": str(bvh), "stem": bvh.stem, "score": score(m, q, kerr, perr),
                         "key_err_cm_mean_max": kerr, "path_err_cm_mean_max": perr, **{k: v for k, v in q.items() if k != "file"}})
        rows.sort(key=lambda r: r["score"])
        (outdir / "summary.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
        print(f"== {m} ({len(rows)} clips)")
        for r in rows:
            wr = max((v[1] for v in r["wrist_deg_max_p95"].values()), default=0)
            print(f"  {r['score']:6.1f}  {r['stem']:34s} {r['frames']:3d}f  key {r['key_err_cm_mean_max']}  "
                  f"path {r['path_err_cm_mean_max']}  slide {r['foot_slide_cm_s'][0]:5.1f}  jit {r['jitter_cm']:.2f}  "
                  f"pops {r.get('pops')}  wrist95 {wr:5.1f}  2h {r.get('two_hand_share')}  yaw {r.get('yaw_deg_range')}  "
                  f"floor {r['floor_cm']}  {'; '.join(r['flags'])}")


if __name__ == "__main__":
    main()
