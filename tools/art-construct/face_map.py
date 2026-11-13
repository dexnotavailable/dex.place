"""Print a character map of a face region for pixel counting (research only).

Usage: python face_map.py SRC x0 y0 x1 y1 [--palette art/rosace/palette.json]
With --palette, pixels are mapped exactly to the character's palette codes instead
(Rosace: '#' OL, 1/s/3/4 S1-S4, p SB, a/b/c/h A2-A5, W/w W1/W2, i I0-I2, I I3-I4,
g gold, '?' off-palette). Use that mode on our own lossless renders.
Legend: '#' very dark (lash/outline, luma<60), 'd' dark (60-110), 'r' saturated
red/amber iris-ish (sat>0.45, hue<50 or >330), 'b' saturated blue, 'W' near-white
(luma>225), 's' skin-ish (warm, luma 150-225), '.' other/mid. Classes are coarse
on purpose: they are for counting eye/mouth spans, not for colour work.
"""
import colorsys
import sys
from PIL import Image

def cls(p):
    r, g, b = p[:3]
    if len(p) > 3 and p[3] < 128:
        return ' '
    L = 0.299 * r + 0.587 * g + 0.114 * b
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if L < 60:
        return '#'
    if s > 0.45 and (h < 50 or h > 330) and L < 200:
        return 'r'
    if s > 0.35 and 180 < h < 260:
        return 'b'
    if L > 225:
        return 'W'
    if L < 110:
        return 'd'
    if r > g > b and r - b > 25 and L >= 150:
        return 's'
    return '.'

SYM = {'OL': '#', 'S1': '1', 'S2': 's', 'S3': '3', 'S4': '4', 'SB': 'p', 'A2': 'a', 'A3': 'b',
       'A4': 'c', 'A5': 'h', 'W1': 'W', 'W2': 'w', 'I0': 'i', 'I1': 'i', 'I2': 'i', 'I3': 'I',
       'I4': 'I', 'G0': 'g', 'G1': 'g', 'G2': 'g', 'G3': 'g', 'G4': 'g'}


def palette_cls(path):
    import json
    cols = json.load(open(path))['colors']
    inv = {}
    for k, v in cols.items():
        h = v if isinstance(v, str) else v.get('hex')
        if isinstance(h, str):
            h = h.lstrip('#')
            inv[tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))] = k

    def f(p):
        if len(p) > 3 and p[3] < 128:
            return ' '
        k = inv.get(tuple(p[:3]))
        return SYM.get(k, '.') if k else '?'
    return f


if __name__ == "__main__":
    a = sys.argv
    if '--palette' in a:
        i = a.index('--palette')
        cls = palette_cls(a[i + 1])
        a = a[:i] + a[i + 2:]
    im = Image.open(a[1]).convert("RGBA")
    x0, y0, x1, y1 = map(int, a[2:6])
    print('     ' + ''.join(str((x // 10) % 10) for x in range(x0, x1)))
    print('     ' + ''.join(str(x % 10) for x in range(x0, x1)))
    for y in range(y0, y1):
        print(f'{y:4d} ' + ''.join(cls(im.getpixel((x, y))) for x in range(x0, x1)))
