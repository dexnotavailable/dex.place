"""Drive 9 review output: the combined stills, labelled look sheets against the current build and the three route
picks, and a blind set (combined vs current vs refs) with key.json. Writes review/rosace/art/drive9/combined/
(git-ignored: it holds third-party refs).

  python tools/pixel-pipeline/drive9/d9_sheets.py [--raw <lanes/drive9/raw/H110>] [--tag D1] [--seed 20261109]

Refs: 07/09/04 native 1x crops at 144 (finish-gap crops); at 80 the same crops box-resampled per WF-P15 plus ref 05
at its own 1x (a native small-size sprite, about 104 px tall: the judges' fix before any 80 px call counts).
"""
import argparse
import json
import os
import random
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(PIPE, "finish_f3"))
sys.path.insert(0, os.path.join(PIPE, "finish_judge"))
import sheets_f3 as F3S  # noqa: E402
import judge_sheets as JS  # noqa: E402
import d9_view as DV  # noqa: E402

BUILD = JS.BUILD
OUT = os.path.join(REPO, "review", "rosace", "art", "drive9", "combined")
SHOTS = ("idle", "n1", "q", "back")
REFS = {"idle": {"ref07": "07_idle", "ref09": "09_idle", "ref04": "04_c"},
        "n1": {"ref07": "07_attack", "ref09": "09_attack", "ref04": "04_l"},
        "q": {"ref07": "07_attack", "ref09": "09_raise", "ref04": "04_r"},
        "back": {"ref07": "07_idle", "ref09": "09_raise", "ref04": "04_c"}}


def cur_dir(s, px):
    if s == "q":
        return os.path.join(BUILD, "renders", "integrated", "q_stamp", f"px{px}")
    return JS.still_dir("current", s, px)


def load_entry(e, s, px, raw, tag):
    if e == "d9":
        return JS.crop(Image.open(os.path.join(raw, s, f"px{px}", tag, "still_ground.png")).convert("RGBA"))
    if e == "current":
        return JS.crop(Image.open(os.path.join(cur_dir(s, px), "still_ground.png")).convert("RGBA"))
    if s == "q":
        return None
    return JS.ours(e, s, px)[0]


def sil(im):
    a = np.asarray(im.getchannel("A")) > 0
    o = np.zeros(a.shape + (4,), np.uint8)
    o[a] = (0, 0, 0, 255)
    return Image.fromarray(o, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=os.path.join(BUILD, "lanes", "drive9", "raw", "H110"))
    ap.add_argument("--tag", default="D1")
    ap.add_argument("--seed", type=int, default=20261109)
    a = ap.parse_args()
    for sub in ("stills", "look", "blind"):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    rng = random.Random(a.seed)
    key = {"_doc": "Drive 9 blind set: the combined build (d9) against the current build and the refs, one letter "
                   "mapping per sheet (letters only on panels). Open only after writing the verdicts.",
           "question": "Rank every panel per sheet. Which build panel reads closest to the refs' finish, face, mass and "
                       "pose appeal at 144, and which reads best in the world at 80 (read 80 against ref 05, which is "
                       "a native small sprite, before calling ours better)?",
           "seed": a.seed, "sheets": {}}
    for s in SHOTS:
        for px in (144, 80):
            d9 = load_entry("d9", s, px, a.raw, a.tag)
            base = f"{s}_{px}"
            # the stills, x1 and zoomed
            src = os.path.join(a.raw, s, f"px{px}", a.tag)
            shutil.copyfile(os.path.join(src, "still.png"), os.path.join(OUT, "stills", f"{base}.png"))
            shutil.copyfile(os.path.join(src, "still_ground.png"), os.path.join(OUT, "stills", f"{base}_ground.png"))
            z = 3 if px == 144 else 4
            g = Image.new("RGBA", d9.size, F3S.BG + (255,) if len(F3S.BG) == 3 else F3S.BG)
            g.alpha_composite(d9)
            g.resize((d9.width * z, d9.height * z), Image.NEAREST).save(os.path.join(OUT, "stills", f"{base}_x{z}.png"))
            sil(d9).save(os.path.join(OUT, "stills", f"{base}_sil.png"))
            # labelled look sheet
            panels = []
            for e in ("current", "F1", "F2", "F3", "d9"):
                im = d9 if e == "d9" else load_entry(e, s, px, a.raw, a.tag)
                if im is not None:
                    panels.append((e if e != "d9" else "d9 (combined)", im))
            refs = [(k, F3S.ref(v, px)[0].convert("RGBA")) for k, v in REFS[s].items()]
            if px == 80:
                refs.append(("ref05 native", DV.ref05(0)))
            F3S.sheet(f"drive 9 look: {s} {px} px (labelled, not blind)", panels + refs, z).save(
                os.path.join(OUT, "look", f"{base}_x{z}.png"))
            F3S.sheet(f"drive 9 look: {s} {px} px x1", panels + refs, 1).save(os.path.join(OUT, "look", f"{base}_x1.png"))
            # blind
            ents = [("d9", d9), ("current", load_entry("current", s, px, a.raw, a.tag))] + refs
            order = ents[:]
            rng.shuffle(order)
            letters = {chr(65 + i): n for i, (n, _) in enumerate(order)}
            F3S.sheet(f"{s} {px} px", [(chr(65 + i), im) for i, (_, im) in enumerate(order)], z).save(
                os.path.join(OUT, "blind", f"{base}_x{z}.png"))
            F3S.sheet(f"{s} {px} px x1", [(chr(65 + i), im) for i, (_, im) in enumerate(order)], 1).save(
                os.path.join(OUT, "blind", f"{base}_x1.png"))
            key["sheets"][base] = letters
            print(base, "done", flush=True)
    key["confounds"] = [
        "d9 is route F1's render-to-pixels chain, so the integrated chain's pixel passes are not in it: the glaive-hands "
        "lane's constructed hands and weapon (N1's glass blade crescent), the outfit glyphs and windows (the tabard's "
        "gold crosses), and the collar cross. Current carries them.",
        "Current's idle, N1 and back are run_f3.py's control in the same pose files; its Q is the integrated canonical "
        "still (same q_stamp.json, d9801054cd42). d9's head is x1.10, so its body renders 1.5% smaller at the same H.",
        "The 80 px refs 07/09/04 are box-resampled and snapped to 32 colours (WF-P15); ref05 is a native small sprite at "
        "its own 1x (about 104 px tall, white ground keyed out)."]
    key["sources"] = {"d9": a.raw + f"/<shot>/px<N>/{a.tag}/still_ground.png",
                      "current": "renders/finish-F3/control (idle, n1, back) and renders/integrated/q_stamp (q)",
                      "refs": {k: v for k, v in REFS.items()}, "ref05": DV.REF05 + " frame 0 at 1x"}
    json.dump(key, open(os.path.join(OUT, "blind", "key.json"), "w"), indent=1)
    mp = os.path.join(BUILD, "lanes", "drive9", "metrics.json")
    if os.path.exists(mp):
        shutil.copyfile(mp, os.path.join(OUT, "metrics.json"))


if __name__ == "__main__":
    main()
