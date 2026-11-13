"""Face lane round F2: the stills set as whole figures (not blind), before / after, at 144 and 80.

  python tools/art-construct/face_f2_stills.py [--round 2]

Reads run_f2.json (face_f2_run.py) and writes review/rosace/art/face/round-<n>/stills_<px>_x<z>.png: per still
the round-4 stamp control, F1, and F2 (the lane's still.png, rendered from lanes/face.blend), on the review
backdrop, trimmed to the figure.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_v2_run as R1  # noqa: E402


def trim_box(pngs, pad=2):
    boxes = []
    for p in pngs:
        a = np.asarray(Image.open(p).convert('RGBA'))[..., 3] > 0
        ys, xs = np.nonzero(a)
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))
    x0 = min(b[0] for b in boxes) - pad
    y0 = min(b[1] for b in boxes) - pad
    return (max(0, x0), max(0, y0), max(b[2] for b in boxes) + pad + 1, max(b[3] for b in boxes) + pad + 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, default=2)
    a = ap.parse_args()
    run = json.loads((R1.LANE / f'run_f{a.round}.json').read_text())
    out = A.ROOT / 'review' / 'rosace' / 'art' / 'face' / f'round-{a.round}'
    for px, zs in ((144, (3, 1)), (80, (4, 1))):
        for z in zs:
            rows = []
            for item in run['stills']:
                if item['px'] != px:
                    continue
                trio = [('round-4 stamp', item['control']), ('F1', item['f1'])]
                if item.get('f2'):                 # round F2b: the first F2 pass is a control too
                    trio.append(('F2 pass 1', item['f2']))
                trio.append((f"F{a.round}{'b' if item.get('f2') else ''}: {item['expr']}", item['png']))
                box = trim_box([p for n, p in trio])
                panels = [(n, A.zoom(A.on_bg(Image.open(p).convert('RGBA').crop(box)), z)) for n, p in trio]
                rows.append(A.row_sheet(panels, title=f"{item['still']} {px} px, x{z}: control / F1 / F{a.round}"))
            A.stack(rows).save(out / f'stills_{px}_x{z}.png')
    print('stills sheets in', out)


if __name__ == '__main__':
    main()
