"""Round R3 figure: the R2 figure route (figure_r2.py: gesture, IK, mannequin, part models, painted hands, paint passes)
with the R3 painted head, a new gesture round and the hair tail repainted as clumps.

  python tools/art-construct/figure_r3.py art/rosace/construct/figure/idle_hero_r3.gesture.json --thumbs
  python tools/art-construct/figure_r3.py art/rosace/construct/figure/idle_hero_r3.gesture.json --ref --sheet
  python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero_r3 --faces art/rosace/construct/faces/r3

What R3 changes, in the order an artist works (WF-P06):
  1. gesture: a thumbnail round on attitude. The round-4 critics' "mannequin" note and the finish bar: refs 07, 08 and
     09 stand 44-57 px apart; R2's hero stands about 24 (the demure processional stance of DESIGN 1). The thumbnails try
     the stance, the hip, the head and the free heel one axis at a time, plus the mannequin control (spec `thumbnails`).
  2. the head: the R3 q34 Confident face (faces/r3, heads_r3.py), with its 1 px roll and the round-3 smile.
  3. the hair tail (pass_tail_r3): R2's tail was two S-curved I4 lines and two lighter strands, the stripes the round-2
     critique named on the head's back hair (4a). It becomes two big clumps: the back one in shadow, the front one with a
     2 px lit ridge that S-bends with the fall and an I1 turn where the hair rolls over the shoulder blades, I4 only where
     the front clump overlaps the back one (ao-shade-hair: shadows "along the bottoms parts of the clumps"; highlights
     "flow along the shape").
The 3D render stays a reference layer under the gesture (WF-P02): proportion and turn only.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import figure_r2 as F2  # noqa: E402  (imports face_r2, which points head_paint at faces/r2 ...)
import face_r3  # noqa: E402,F401  (... so face_r3 is imported after it: head_paint now reads faces/r3)
import figure_construct as FCN  # noqa: E402
import figure_paint as FP  # noqa: E402

OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
SHEETS = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-3' / 'figure'
# WF-P03's thumbnail score, round R3: the 11 silhouette rules plus the two a head move can break. In R2 and again in R3's
# first pass, a thumbnail that cocked the head scored 11/11 and then failed on the full build: the chin covered the collar
# cross (CL-P05, block) and the neck followed the chin so the head-neck angle fell (FG-P12)
THUMB_RULES = tuple(FP.THUMB_RULES) + ('CL-P05', 'FG-P12')


class R3Figure(F2.R2Figure):

    def build(self):
        cv = super().build()
        # the face record for the checker: the R3 head's fringe clumps (HR-P08 counts one dash per clump)
        self.face.rec['params']['bangs'] = face_r3.spec_of('q34').get('bangs', [])
        self.face.rec['params']['route'] = 'r3 painted strokes'
        self.face.rec['params']['pupil'] = True
        r = self.s.get('render', {})
        if r.get('r3_tail', True):
            self.pass_tail_r3()
            self.pass_contacts()
        self.log.append('r3: R3 painted head (faces/r3); ' + ('hair tail as clumps (pass_tail_r3)' if r.get('r3_tail', True)
                                                              else 'R2 hair tail'))
        return cv

    def pass_tail_r3(self):
        """the hime tail below the head as two big clumps (critique 4a on the head's back hair, applied to the tail)"""
        cv, L, I = self.cv, self.L, self.pal.i
        hb = (cv.part == A.PART['hair_back']) & (cv.mat == A.MAT['hair'])
        paint = hb & np.isin(cv.code, self._codes('I1', 'I2', 'I3', 'I4'))
        ch = L['chin']
        ys = [y for y in np.nonzero(hb.any(1))[0] if y > ch[1] + 1]
        if not ys:
            return
        top, bot = ys[0], ys[-1]
        for y in ys:
            xs = np.nonzero(hb[y])[0]
            if len(xs) < 4:
                continue
            x0, x1 = xs.min(), xs.max()
            w = x1 - x0 + 1
            t = (y - top) / max(1, bot - top)
            split = x0 + int(round(0.42 * w + 1.2 * math.sin(5.0 * t + 0.6)))          # the front clump overlaps here
            ridge = x0 + int(round(0.70 * w + 1.4 * math.sin(4.2 * t + 1.1)))          # its lit ridge, S-bending
            for x in range(x0, x1 + 1):
                if not paint[y, x]:
                    continue
                code = 'I3'
                if x >= split and abs(x - ridge) <= 1 and x < x1:
                    code = 'I2'
                cv.code[y, x] = I(code)
            # I4 only under the overlap, in the upper part (where the front clump sits over the back one), and
            # the edge pixel stays I3 so the outline, not a dark band, closes the shape
            # (the upper 45 %: a first draft ran it over two thirds and made a 21 px I4 patch, HR-N03)
            if t < 0.45 and paint[y, split - 1] and split - 1 > x0:
                cv.code[y, split - 1] = I('I4')
            # the turn over the shoulder blades: the ridge is I1 for its first rows (a tapering dash, not a band)
            if y - top < 6 and paint[y, ridge]:
                cv.code[y, ridge] = I('I1')
                if y - top < 3 and paint[y, ridge + 1]:
                    cv.code[y, ridge + 1] = I('I1')


def build(spec_path, name=None, ref=None, overrides=None, do_sheet=False, out=OUT):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    spec = FCN.merged(spec, overrides or {})
    name = name or spec['name']
    spec['name'] = name
    fig = R3Figure(spec)
    fig.gesture()
    fig.mannequin()
    fig.build()
    od = Path(out) / name
    od.mkdir(parents=True, exist_ok=True)
    fig.cv.save(fig.pal, od / 'sprite.png')
    fig.cv.save_layers(str(od / 'sprite'))
    pose = fig.pose_json(name)
    pose['route'] = 'r3 figure_r3 (R3 painted head, tail clumps; R2 paint passes, painted hands)'
    ref_img, ref_info = (None, None)
    if ref:
        ref_img, ref_info = FCN.load_ref(ref, fig)
        pose['reference'] = ref_info
    A.jdump(pose, od / 'pose.json')
    frec = fig.face.record(f'{name}_face')
    frec['params'].update({'bangs': fig.face.rec['params']['bangs'], 'route': 'r3 painted strokes', 'pupil': True})
    frec['origin_on_sprite'] = list(fig.face_origin)
    A.jdump(frec, od / 'face.json')
    fig.head.cv.save_layers(str(od / 'face'))
    A.jdump({'name': name, 'spec': spec, 'log': fig.log, 'reference': ref_info,
             '_doc': 'the spec this sprite was built from (tools/art-construct/figure_r3.py, round R3) and the log'},
            od / 'construct.json')
    if do_sheet:
        SHEETS.mkdir(parents=True, exist_ok=True)
        check = None
        try:
            import rules_check as RC
            check = {'gaps_px': RC.arm_gaps(fig.cv.code > 0, fig.cv.part)[1]}
        except Exception as e:  # noqa: BLE001
            print('gap overlay skipped:', e)
        FCN.construct_sheet(fig, name, ref_img, check).save(SHEETS / f'{name}_construct.png')
    return fig, pose


def thumbnails(spec_path, out=OUT):
    """WF-P03 with the R3 models: build every thumbnail in the spec, fill solid, score on the silhouette rules"""
    import rules_check as RC
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    name = spec['name']
    tdir = Path(out) / name / 'thumbs'
    tdir.mkdir(parents=True, exist_ok=True)
    res = []
    for tv in spec.get('thumbnails', []):
        vname = tv['name']
        fig, pose = build(spec_path, f'{name}__{vname}', None, tv.get('set', {}), False, tdir)
        ctx = RC.Ctx(tdir / f'{name}__{vname}', faces_dir=face_r3.LIB)
        rows = RC.run(ctx, list(THUMB_RULES))
        passed = [r['id'] for r in rows if r['status'].startswith('PASS')]
        gaps, _ = RC.arm_gaps(ctx.mask, ctx.parts)
        area = sum(a for a, w, s_ in gaps if a >= 30 and w >= 3)
        body = (fig.cv.code > 0) & (fig.cv.part != A.PART['weapon'])
        xs = np.nonzero(body.any(0))[0]
        L = fig.L
        feet = abs(L['heel_far'][0] - L['heel_near'][0]) if 'heel_far' in L and 'heel_near' in L else None
        res.append({'name': vname, 'idea': tv.get('idea', ''), 'set': tv.get('set', {}), 'score': len(passed),
                    'gap_area': area, 'width': int(xs.max() - xs.min() + 1), 'passed': passed, 'feet_apart': feet,
                    'failed': [f"{r['id']}: {r['measured']}" for r in rows if r['status'].startswith('FAIL')],
                    'verdict': tv.get('verdict', ''), 'kept': tv.get('kept'), 'fig': fig})
    ranked = sorted(res, key=lambda r: (-r['score'], -r['gap_area']))
    for i, r in enumerate(ranked):
        r['rank'] = i + 1
        A.jdump({k: v for k, v in r.items() if k != 'fig'}, tdir / f"{r['name']}.json")
    panels, colour, one = [], [], []
    for r in ranked:
        cv = r['fig'].cv
        sil = np.full(cv.code.shape + (3,), 104, np.uint8)
        sil[cv.code > 0] = (24, 20, 36)
        sil[cv.part == A.PART['weapon']] = (70, 66, 90)
        tag = f"#{r['rank']} {r['name']} {r['score']}/{len(THUMB_RULES)}" + (' KEPT' if r.get('kept') else '')
        panels.append((tag, A.zoom(Image.fromarray(sil), 2)))
        colour.append((r['name'], A.zoom(A.on_bg(cv.image(r['fig'].pal)), 2)))
        one.append((r['name'], A.on_bg(cv.image(r['fig'].pal))))
    SHEETS.mkdir(parents=True, exist_ok=True)
    notes = [f"{r['name']} (#{r['rank']}, {r['score']}/{len(THUMB_RULES)}, gap {r['gap_area']} px2, width {r['width']}, "
             f"feet {r['feet_apart']}): {r['idea']}" + (f" -> {r['verdict']}" if r['verdict'] else '')
             + (f"  [fails: {'; '.join(f[:60] for f in r['failed'])}]" if r['failed'] else '') for r in ranked]
    s = A.stack([A.row_sheet(panels, title=f'{name} thumbnails (WF-P03): solid fill at 2x, scored on ' + ', '.join(THUMB_RULES)),
                 A.row_sheet(colour, title='the same thumbnails as a colour build, 2x'),
                 A.row_sheet(one, title='1x (game size)'), face_r3.notes_img(notes, 1900)])
    s.save(SHEETS / f'{name}_thumbs.png')
    return ranked


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec')
    ap.add_argument('--name')
    ap.add_argument('--ref', nargs='?', const=str(FCN.DEFAULT_REF))
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--thumbs', action='store_true')
    ap.add_argument('--out', default=str(OUT))
    a = ap.parse_args()
    if a.thumbs:
        for r in thumbnails(a.spec, a.out):
            print(f"#{r['rank']} {r['name']:16s} {r['score']}/{len(THUMB_RULES)} gap {r['gap_area']:4d} width {r['width']} "
                  f"feet {r['feet_apart']}  fails: " + '; '.join(f[:70] for f in r['failed']))
        return
    fig, pose = build(a.spec, a.name, a.ref, None, a.sheet, a.out)
    print(pose['name'], 'ok;', '; '.join(fig.log))


if __name__ == '__main__':
    main()
