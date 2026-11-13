"""Drive 9 round 4, labelled (NOT blind) look sheets for the face-and-head lane the round-3 critics asked for ('face and
head need their own before/after sheet at 80 px, not only 144'): per shot, the head crop of round 3, round 4 before
the paint-over (under), round 4 (ours) and the control, at 144 x6 and at 80 x6 and x1, plus whole-figure before/after
strips at x3 (144) and x4 (80). Written to review/rosace/art/drive9/round-4-look/ (git-ignored), a sibling of the
blind round-4/ folder, so a blind critic never opens it by accident.

  python tools/pixel-pipeline/drive9/r4_look.py [--raw <raw>/R4] [--prev <raw>/R3:R3]
"""
import argparse
import json
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
BG = (88, 88, 92, 255)


def head_box(d, px):
    f = json.load(open(os.path.join(d, "facepass.json")))
    r = 20 if px >= 110 else 12
    x, y = f["nose"][0], f["nose"][1]
    return (int(x - r), int(y - r - (6 if px >= 110 else 3)), int(x + r), int(y + r - (6 if px >= 110 else 3)))


def control(shot, px):
    if shot == "q":
        return os.path.join(BUILD, "renders", "integrated", "q_stamp", f"px{px}")
    return os.path.join(BUILD, "renders", "finish-F3", "control", shot, f"px{px}")


def strip(items, z, title):
    ims = []
    for label, im in items:
        base = Image.new("RGBA", im.size, BG)
        base.alpha_composite(im)
        ims.append((label, base.resize((im.width * z, im.height * z), Image.NEAREST)))
    W = sum(i.width for _, i in ims) + 10 * (len(ims) + 1)
    H = max(i.height for _, i in ims) + 34
    o = Image.new("RGBA", (W, H), (26, 26, 30, 255))
    d = ImageDraw.Draw(o)
    d.text((10, 2), title, fill=(230, 230, 230, 255))
    x = 10
    for label, i in ims:
        d.text((x, 16), label, fill=(230, 230, 230, 255))
        o.paste(i, (x, 30))
        x += i.width + 10
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=os.path.join(BUILD, "lanes", "drive9", "raw", "R4"))
    ap.add_argument("--prev", default=os.path.join(BUILD, "lanes", "drive9", "raw", "R3") + ":R3")
    a = ap.parse_args()
    praw, ptag = a.prev.rsplit(":", 1)
    out = os.path.join(REPO, "review", "rosace", "art", "drive9", "round-4-look")
    os.makedirs(out, exist_ok=True)
    for shot in ("idle", "n1", "q", "back"):
        for px in (144, 80):
            dirs = [("round 3", os.path.join(praw, shot, f"px{px}", ptag)),
                    ("R4 under (no paint-over)", os.path.join(a.raw, shot, f"px{px}", "R4u")),
                    ("R4 ours (paint-over)", os.path.join(a.raw, shot, f"px{px}", "R4")),
                    ("control", control(shot, px))]
            heads, whole = [], []
            for label, d in dirs:
                im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
                heads.append((label, im.crop(head_box(d, px))))
                whole.append((label, im))
            for z in ((6,) if px >= 110 else (6, 1)):
                strip(heads, z, f"{shot} {px}px head x{z} (labelled, not blind)").save(
                    os.path.join(out, f"head_{shot}_px{px}_x{z}.png"))
            strip(whole, 3 if px >= 110 else 4, f"{shot} {px}px whole (labelled, not blind)").save(
                os.path.join(out, f"whole_{shot}_px{px}.png"))
    print("look sheets in", out)


if __name__ == "__main__":
    main()
