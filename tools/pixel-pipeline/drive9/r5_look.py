"""Drive 9 round 5, labelled (NOT blind) look sheets: ESCALATION 3's side-by-side of the two lever mixes after the same
round-5 fixes, with round 4 and the control for reference: per shot, heads at 144 x6 and 80 x6 / x1, whole figures at
x3 (144) and x4 (80). Written to review/rosace/art/drive9/round-5-look/ (git-ignored), a sibling of the blind round-5/
folder. The head crop and the strip layout are round 4's (r4_look.py, used as a library).

  python tools/pixel-pipeline/drive9/r5_look.py
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import r4_look as L4  # noqa: E402

RAW = os.path.join(L4.BUILD, "lanes", "drive9", "raw")


def main():
    out = os.path.join(L4.REPO, "review", "rosace", "art", "drive9", "round-5-look")
    os.makedirs(out, exist_ok=True)
    for shot in ("idle", "n1", "q", "back"):
        for px in (144, 80):
            dirs = [("round 4 (R4)", os.path.join(RAW, "R4", shot, f"px{px}", "R4")),
                    ("mix P: F3 L mass (R5, alt)", os.path.join(RAW, "R5", shot, f"px{px}", "R5")),
                    ("mix X under (R5xu)", os.path.join(RAW, "R5x", shot, f"px{px}", "R5xu")),
                    ("mix X: open + low key (R5x, ours)", os.path.join(RAW, "R5x", shot, f"px{px}", "R5x")),
                    ("control", L4.control(shot, px))]
            heads, whole = [], []
            for label, d in dirs:
                im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
                heads.append((label, im.crop(L4.head_box(d, px))))
                whole.append((label, im))
            for z in ((6,) if px >= 110 else (6, 1)):
                L4.strip(heads, z, f"{shot} {px}px head x{z} (labelled, not blind)").save(
                    os.path.join(out, f"head_{shot}_px{px}_x{z}.png"))
            L4.strip(whole, 3 if px >= 110 else 4, f"{shot} {px}px whole (labelled, not blind)").save(
                os.path.join(out, f"whole_{shot}_px{px}.png"))
    print("look sheets in", out)


if __name__ == "__main__":
    main()
