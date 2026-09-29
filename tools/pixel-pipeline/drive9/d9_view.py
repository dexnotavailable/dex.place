"""Drive 9 quick look (not blind): labelled panels side by side on the sheet ground, for the driver's own eye.

  python tools/pixel-pipeline/drive9/d9_view.py --out <png> --zoom 3 <label>=<still_ground.png or dir> ...
A dir means <dir>/still_ground.png. 'ref:<crop>' draws a finish-gap ref crop at native size (third-party: review/ only).
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "finish_f3"))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "finish_judge"))
import sheets_f3 as F3S  # noqa: E402
import judge_sheets as JS  # noqa: E402


REF05 = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "review", "refs", "character", "native",
                     "05-anim-sailormars-sheet_1x.png")


def key_white(a):
    """figure mask of a white-ground ref box (int RGB array): only near-white connected to the box border is ground
    (a flood fill), so white cloth, gloves and highlights inside the outline stay. A global white key punched
    107-281 px out of each ref 05 figure (round d9 R1). Then JPEG specks: a fg px needs >= 4 fg 8-neighbours (twice)."""
    import numpy as np
    white = np.abs(a - 255).sum(-1) < 90
    bg = np.zeros_like(white)
    bg[0, :], bg[-1, :], bg[:, 0], bg[:, -1] = white[0, :], white[-1, :], white[:, 0], white[:, -1]
    while True:
        g = bg.copy()
        g[1:] |= bg[:-1]
        g[:-1] |= bg[1:]
        g[:, 1:] |= bg[:, :-1]
        g[:, :-1] |= bg[:, 1:]
        g &= white
        if (g == bg).all():
            break
        bg = g
    fg = ~bg
    for _ in range(2):
        p = np.pad(fg, 1)
        n = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx].astype(int)
                for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - fg
        fg = fg & (n >= 4)
    return fg


def ref05(frame=0):
    """ref 05 at its own 1x (a native small-size ref, about 104 px tall: the judges' ask before any 80 px call is
    counted); frame = the n-th figure in the sheet's first row. White ground keyed out."""
    import numpy as np
    im = Image.open(REF05).convert("RGB")
    a = np.asarray(im).astype(int)
    fg = ~(np.abs(a - 255).sum(-1) < 90)          # column runs only; the figure mask is key_white's
    cols = fg[0:118].any(0)
    runs, x = [], 0
    while x < len(cols):
        if cols[x]:
            s0 = x
            while x < len(cols) and cols[x]:
                x += 1
            if x - s0 > 20:
                runs.append((s0, x))
        x += 1
    x0, x1 = runs[frame]
    fg = np.zeros(fg.shape, bool)
    fg[0:118, x0:x1] = key_white(a[0:118, x0:x1])
    ys = np.nonzero(fg[0:118, x0:x1].any(1))[0]
    box = (x0, int(ys.min()), x1, int(ys.max()) + 1)
    rgba = np.dstack([a, np.where(fg, 255, 0)]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA").crop(box)


def load(spec, px):
    if spec.startswith("ref05"):
        return ref05(int(spec[5:] or 0))
    if spec.startswith("ref:"):
        return F3S.ref(spec[4:], px)[0].convert("RGBA")
    p = os.path.join(spec, "still_ground.png") if os.path.isdir(spec) else spec
    return JS.crop(Image.open(p).convert("RGBA"))


def main():
    a = sys.argv[1:]
    out = a[a.index("--out") + 1]
    zoom = int(a[a.index("--zoom") + 1]) if "--zoom" in a else 3
    px = int(a[a.index("--px") + 1]) if "--px" in a else 144
    title = a[a.index("--title") + 1] if "--title" in a else os.path.basename(out)
    items = [x for i, x in enumerate(a) if "=" in x and not a[i - 1].startswith("--")]
    panels = [(k, load(v, px)) for k, v in (x.split("=", 1) for x in items)]
    S = F3S.sheet(title, panels, zoom)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    S.save(out)
    print(out, S.size)


if __name__ == "__main__":
    main()
