"""Regenerate the machine-made part of CATALOGUE.md from the run reports and QC summaries.

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/make_catalogue.py

Everything above the line `<!-- AUTO-TABLE -->` in CATALOGUE.md is hand-written and kept; the
table below it is rebuilt: one row per BVH under <raw>/<move>/, with the move, how it was made
(key-pose mode / text / video clip), the prompt or clip, the model, length, the QC numbers from
review/motion/previews/<move>/summary.json, and the verdict from VERDICTS below (first matching
pattern wins; `-` = generated and QC'd but not individually judged).
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw")
PREV = Path(r"D:\Dex\Projects\dex.place\review\motion\previews")
CAT = HERE / "CATALOGUE.md"
MARK = "<!-- AUTO-TABLE -->"

# (regex on the stem, verdict) -- verdicts come from looking at the comparison strips in
# review/motion/previews/_compare/ plus the QC numbers; see the hand-written section.
VERDICTS = [
    (r"^n1_study_ee_s1_00$", "PICK"), (r"^n1_study_soft_s1_01$", "alt"), (r"^n1_study_textee_s1_02$", "alt"),
    (r"^n1_study_text(5s)?_", "reject: no scoop, never overhead"), (r"^n1_study_full", "reject: pops at the S1-C1 snap"),
    (r"^n3_study_textee_s1_00$", "PICK"), (r"^n3_study_ee_s1_00$", "alt"),
    (r"^n3_study_text(5s)?_", "reject: holds the glaive out, no twirl path"),
    (r"^n5_study_ee_s1_00$", "PICK"), (r"^n5_study_soft_s1_01$", "alt"), (r"^n5_study_textee_s1_00$", "alt"),
    (r"^n5_study_text(5s)?_", "reject: no spin, no kneel"), (r"^n5_study_full", "reject: 16-31 pops"),
    (r"^n5long_", "reject: misses a key by 70-86 cm"),
    (r"^q_study_ee_s1_00$", "PICK"), (r"^q_study_textee_s1_00$", "alt"), (r"^q_study_soft_s1_00$", "alt"),
    (r"^q_study_text(5s)?_", "reject: plants a staff but never lifts it overhead"),
    (r"^dash_study_ee_s1_00$", "PICK"), (r"^dash_study_textee_s1_00$", "alt"),
    (r"^dash_study_text_", "reject: splays into a wide squat"), (r"^dash_(study|game)_soft", "reject: misses the floor path (23-37 cm mean, up to 122 cm)"),
    (r"^dash_attack_study_ee_s1_00$", "PICK"), (r"^dash_attack_study_text_s1_00$", "alt (looser, full 358 deg spin)"),
    (r"^dash_attack_study_textee_s1_01$", "alt"), (r"^dash_attack_(study|game)_soft", "reject: misses the floor path (23-37 cm mean, up to 162 cm)"),
    (r"^idle_study_text_s1_00$", "PICK"), (r"^idle_study_text_s1_01$", "alt"),
    (r"^idle_study_(full|ee|textee)", "ok but frozen (<1 px of motion)"),
    (r"^run_study_free_s1_00$", "PICK (legs)"), (r"^run_study_carry_s1_02$", "alt (right hand carries)"),
    (r"^run_study_text_s1_00$", "alt"), (r"^run_study_free_s1_0[12]$", "reject: 4 pops"),
    (r"^windmill_kneelift_gemx$", "PICK (capture matches video)"), (r"^windmill_overhead_gemx$", "PICK for upper body (feet slide 39 cm/s)"),
    (r"^bigsweep_overhead_gemx$", "PICK (trim first ~25 f)"), (r"^whirlpool_wheels_gemx$", "PICK (trim first ~17 f)"),
    (r"^thrustmow_thrust_mow_gemx$", "ok (side view only; trim first ~15 f)"),
    (r"^whirlpool_twirl_plant", "reject: capture flips facing and straightens legs from f50"),
    (r"^bigsweep_sweep_kneel", "reject: capture never kneels (hips >= 90 cm)"),
    (r"^windmill_overhead_kimodo_x0.6", "reject: foot slide 67-129 cm/s"),
    (r"_game_", "game tempo: jitter 1.3-5.0 cm, use study + our retime"),
]


def verdict(stem):
    for pat, v in VERDICTS:
        if re.search(pat, stem):
            return v
    return "-"


def qc_rows():
    out = {}
    for f in PREV.glob("*/summary.json"):
        for r in json.loads(f.read_text(encoding="utf-8")):
            out[r["stem"]] = r
    return out


def run_info(bvh):
    stem = bvh.stem
    m = re.match(r"(.+)_(\d\d)$", stem)
    rep = bvh.with_name((m.group(1) if m else stem) + ".json")
    if not rep.exists():
        return {}
    return json.loads(rep.read_text(encoding="utf-8"))


def source_of(move, stem, info):
    if stem.endswith("_gemx"):
        a, b = info.get("frames_30fps", [None, None])
        return ("GEM-X capture", f"`{info.get('clip')}` f{a}-{b} ({info.get('note', '')})", "GEM-X (SOMA)")
    m = re.match(r"(.+?)_kimodo_x([\d.]+)_s\d+", stem)
    if move == "video" and m:
        return (f"video keys x{m.group(2)}", f"key poses picked from `{m.group(1)}_gemx`, gaps x{m.group(2)}",
                "Kimodo v1.1 (no text)")
    m = re.match(r".+?_(study|game)_([a-z0-9]+?)_s(\d+)_\d\d$", stem)
    tempo, mode = (m.group(1), m.group(2)) if m else ("?", "?")
    prompt = info.get("prompt") or ""
    how = {"full": "MOVESET keys, all joints", "soft": "MOVESET keys, all joints, no post-process",
           "ee": "MOVESET keys, wrists/ankles/hips", "text": "text + opening stance only",
           "text5s": "text + opening stance, 5 s", "textee": "text + wrists/ankles/hips keys",
           "free": "root path + opening stance", "carry": "root path + right-hand carry keys"}.get(mode, mode)
    src = f"{tempo} / {how}"
    txt = f'"{prompt}"' if prompt else "(no text)"
    model = "Kimodo v1.1 + text" if prompt else "Kimodo v1.1 (no text)"
    return src, txt, model


def main():
    qc = qc_rows()
    lines = ["| File (under `raw/`) | Move | Made from | Prompt / clip | Model | Frames @30 | Slide cm/s | Jitter cm | Pops | Key err cm mean/max | Verdict |",
             "|---|---|---|---|---|---|---|---|---|---|---|"]
    moves = sorted(d.name for d in RAW.iterdir() if d.is_dir() and not d.name.startswith("_"))
    n = 0
    for mv in moves:
        for bvh in sorted((RAW / mv).glob("*.bvh")):
            info = run_info(bvh)
            src, txt, model = source_of(mv, bvh.stem, info)
            q = qc.get(bvh.stem, {})
            k = q.get("key_err_cm_mean_max")
            kt = f"{k[0]}/{k[1]}" if k and k[0] is not None else "-"
            if len(txt) > 70:
                txt = txt[:67] + '..."'
            lines.append(f"| `{mv}/{bvh.name}` | {mv} | {src} | {txt} | {model} | {q.get('frames', '?')} | "
                         f"{q.get('foot_slide_cm_s', ['?'])[0]} | {q.get('jitter_cm', '?')} | {q.get('pops', '?')} | {kt} | "
                         f"{verdict(bvh.stem)} |")
            n += 1
    head = CAT.read_text(encoding="utf-8").split(MARK)[0] if CAT.exists() else "# Motion catalogue\n\n"
    CAT.write_text(head + MARK + "\n\n" + f"{n} motions.\n\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print("CATALOGUE", CAT, n, "rows")


if __name__ == "__main__":
    main()
