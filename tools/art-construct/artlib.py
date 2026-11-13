"""Shared pieces for the art-construct tools: palette, a layered pixel canvas, raster primitives,
masks and connected components (numpy + PIL only; no scipy), and sheet helpers.

Everything here works on the native pixel grid. Guides (the underdrawing) are vector data that
the sheet helpers draw at zoom, so a guide line never becomes a sprite pixel (ART-RULES WF-P01).

Pixel grids in the construct data files use one character per pixel (KEY below). '.' is empty.
"""
import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PALETTE = ROOT / 'art' / 'rosace' / 'palette.json'

# one character per palette code, used by every authored pixel grid under art/rosace/construct
KEY = {
    'O': 'OL',
    'a': 'A2', 'b': 'A3', 'c': 'A4', 'h': 'A5',
    'w': 'W1', 'e': 'W2', 'f': 'W3', 'g': 'W4',
    '1': 'S1', 's': 'S2', 't': 'S3', 'm': 'S4', 'p': 'SB',
    'j': 'I0', 'k': 'I1', 'l': 'I2', 'n': 'I3', 'd': 'I4',
    'u': 'G0', 'v': 'G1', 'x': 'G2', 'z': 'G3', 'q': 'G4',
    'B': 'B1', 'C': 'B2', 'T': 'T2', 'U': 'T3', 'V': 'T4',
}
CHAR = {v: k for k, v in KEY.items()}

# material ids = art/rosace/palette.json "materials" ids (the ids map every construct tool writes)
MAT = {'skin': 1, 'white': 2, 'stocking': 3, 'gold': 4, 'hair': 5, 'hairtip': 6, 'indigo': 7,
       'lining': 8, 'boot': 9, 'haft': 10, 'steel': 11, 'edge': 12, 'glass': 13, 'glass2': 14,
       'glasscore': 15, 'beige': 16, 'thong': 17, 'veil': 18, 'eye': 20, 'line': 21}
MATNAME = {v: k for k, v in MAT.items()}

# semantic parts (zones, negative space, grip checks). Written to parts.png (R channel).
PART = {'hair_back': 1, 'veil': 2, 'head': 3, 'face': 4, 'hair_front': 5, 'neck': 6, 'torso': 7,
        'pelvis': 8, 'tabard': 9, 'leg_far': 10, 'leg_near': 11, 'boot_far': 12, 'boot_near': 13,
        'arm_far': 14, 'arm_near': 15, 'sleeve_far': 16, 'sleeve_near': 17, 'hand_far': 18,
        'hand_near': 19, 'weapon': 20, 'collar': 21, 'cross': 22, 'eye': 23}
PARTNAME = {v: k for k, v in PART.items()}
ARM_PARTS = ('arm_far', 'arm_near', 'sleeve_far', 'sleeve_near', 'hand_far', 'hand_near')
TORSO_PARTS = ('torso', 'pelvis', 'tabard', 'collar', 'cross', 'neck', 'leg_far', 'leg_near')


# ---------------------------------------------------------------- palette

class Palette:
    def __init__(self, path=PALETTE):
        d = json.loads(Path(path).read_text(encoding='utf-8'))
        self.doc = d
        self.codes = list(d['colors'].keys())
        self.rgb = {k: tuple(int(v.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) for k, v in d['colors'].items()}
        self.index = {k: i + 1 for i, k in enumerate(self.codes)}   # 0 = empty
        self.lut = np.zeros((len(self.codes) + 1, 4), np.uint8)
        for k, i in self.index.items():
            self.lut[i, :3] = self.rgb[k]
            self.lut[i, 3] = 255
        self.inv = {v: k for k, v in self.rgb.items()}

    def i(self, code):
        return self.index[code]

    def code_of(self, idx):
        return self.codes[idx - 1] if idx > 0 else None

    def lum(self, code):
        return rel_lum(self.rgb[code])

    def contrast(self, a, b):
        return contrast(self.lum(a), self.lum(b))

    def to_rgba(self, codes):
        return self.lut[codes]

    def from_rgba(self, arr):
        """RGBA array -> code index array (0 where alpha is 0 or the colour is off-palette: -1)"""
        h, w = arr.shape[:2]
        out = np.zeros((h, w), np.int16)
        key = (arr[..., 0].astype(np.int32) << 16) | (arr[..., 1].astype(np.int32) << 8) | arr[..., 2]
        table = {(r << 16) | (g << 8) | b: self.index[c] for (r, g, b), c in self.inv.items()}
        for v in np.unique(key[arr[..., 3] > 0]):
            out[(key == v) & (arr[..., 3] > 0)] = table.get(int(v), -1)
        return out


def rel_lum(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) if c.ndim == 1 else \
        0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def contrast(l1, l2):
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def grid_to_codes(rows, pal):
    """authored rows (KEY characters) -> code-index array"""
    h, w = len(rows), max(len(r) for r in rows)
    out = np.zeros((h, w), np.int16)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and ch != ' ':
                out[y, x] = pal.i(KEY[ch])
    return out


def codes_to_grid(codes, pal):
    return [''.join('.' if v <= 0 else CHAR.get(pal.code_of(v), '?') for v in row) for row in codes]


# ---------------------------------------------------------------- canvas

class Canvas:
    """Layered native-grid canvas. code: palette index (0 empty); mat: material id; part: part id."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.code = np.zeros((h, w), np.int16)
        self.mat = np.zeros((h, w), np.int16)
        self.part = np.zeros((h, w), np.int16)

    def put(self, mask, code, mat=0, part=0):
        m = mask if mask.dtype == bool else mask > 0
        if isinstance(code, np.ndarray):
            self.code[m] = code[m]
        else:
            self.code[m] = code
        if mat:
            self.mat[m] = mat
        if part:
            self.part[m] = part

    def filled(self):
        return self.code > 0

    def copy(self):
        c = Canvas(self.w, self.h)
        c.code, c.mat, c.part = self.code.copy(), self.mat.copy(), self.part.copy()
        return c

    def paste(self, other, ox, oy, only=None):
        """paste another canvas at (ox, oy); only = mask on the other canvas (default: filled)"""
        m = other.filled() if only is None else only
        ys, xs = np.nonzero(m)
        ty, tx = ys + oy, xs + ox
        ok = (ty >= 0) & (ty < self.h) & (tx >= 0) & (tx < self.w)
        ys, xs, ty, tx = ys[ok], xs[ok], ty[ok], tx[ok]
        self.code[ty, tx] = other.code[ys, xs]
        self.mat[ty, tx] = other.mat[ys, xs]
        self.part[ty, tx] = other.part[ys, xs]

    def rgba(self, pal):
        return pal.to_rgba(np.clip(self.code, 0, None))

    def image(self, pal):
        return Image.fromarray(self.rgba(pal), 'RGBA')

    def save(self, pal, path):
        self.image(pal).save(path)

    def save_layers(self, stem):
        Image.fromarray(np.clip(self.mat, 0, 255).astype(np.uint8), 'L').save(f'{stem}_ids.png')
        Image.fromarray(np.clip(self.part, 0, 255).astype(np.uint8), 'L').save(f'{stem}_parts.png')


def load_layer(path):
    return np.asarray(Image.open(path).convert('L')).astype(np.int16)


# ---------------------------------------------------------------- raster primitives
# all coordinates are in pixels, x right, y down; a pixel (x, y) has its centre at (x + .5, y + .5)

def _centres(h, w):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def poly_mask(pts, shape):
    """pixel centres inside a polygon (even-odd)"""
    h, w = shape
    X, Y = _centres(h, w)
    inside = np.zeros(shape, bool)
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if y1 == y2:
            continue
        cond = ((y1 <= Y) & (Y < y2)) | ((y2 <= Y) & (Y < y1))
        xint = x1 + (Y - y1) * (x2 - x1) / (y2 - y1)
        inside ^= cond & (X < xint)
    return inside


def capsule_mask(p0, p1, r0, r1, shape):
    """tapered capsule: distance to segment p0-p1 <= radius interpolated r0 -> r1"""
    h, w = shape
    X, Y = _centres(h, w)
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1e-9
    t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
    px, py = x0 + t * dx, y0 + t * dy
    d = np.hypot(X - px, Y - py)
    return d <= r0 + (r1 - r0) * t


def ellipse_mask(c, rx, ry, shape, angle=0.0):
    h, w = shape
    X, Y = _centres(h, w)
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    u = (X - c[0]) * ca + (Y - c[1]) * sa
    v = -(X - c[0]) * sa + (Y - c[1]) * ca
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1.0


def line_px(p0, p1):
    """pixel-perfect Bresenham line between integer pixel coords"""
    x0, y0 = int(round(p0[0])), int(round(p0[1]))
    x1, y1 = int(round(p1[0])), int(round(p1[1]))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    out = []
    while True:
        out.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return out


def px_mask(pxs, shape):
    m = np.zeros(shape, bool)
    for x, y in pxs:
        if 0 <= y < shape[0] and 0 <= x < shape[1]:
            m[y, x] = True
    return m


def bezier(p0, p1, p2, n=32):
    t = np.linspace(0, 1, n)[:, None]
    a, b, c = (np.array(p, float) for p in (p0, p1, p2))
    return (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c


def polyline_len(pts):
    pts = np.asarray(pts, float)
    return float(np.hypot(*np.diff(pts, axis=0).T).sum())


# ---------------------------------------------------------------- mask operations

def shift(mask, dx, dy):
    out = np.zeros_like(mask)
    h, w = mask.shape
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xs0, xs1 = max(0, dx), min(w, w + dx)
    out[ys0:ys1, xs0:xs1] = mask[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


def dilate(mask, n=1, diag=False):
    m = mask.copy()
    for _ in range(n):
        p = np.pad(m, 1)
        nm = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        if diag:
            nm |= p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
        m = nm
    return m


def erode(mask, n=1):
    return ~dilate(~mask, n)


def ring_in(mask):
    """mask pixels with a 4-neighbour outside the mask"""
    p = np.pad(mask, 1)
    return mask & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])


def ring_out(mask):
    return dilate(mask) & ~mask


def components(mask, conn=4):
    """label array (0 = none) and a list of (label, size)"""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    sizes = []
    nb = ((1, 0), (-1, 0), (0, 1), (0, -1)) if conn == 4 else \
        tuple((dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    k = 0
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys, xs):
        if lab[sy, sx]:
            continue
        k += 1
        q = deque([(sy, sx)])
        lab[sy, sx] = k
        n = 0
        while q:
            y, x = q.popleft()
            n += 1
            for dy, dx in nb:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = k
                    q.append((ny, nx))
        sizes.append((k, n))
    return lab, sizes


def dist_inside(mask):
    """city-block-ish distance of each mask pixel to the nearest non-mask pixel (1 = on the edge)"""
    d = np.zeros(mask.shape, np.int32)
    m = mask.copy()
    k = 0
    while m.any():
        k += 1
        d[m] = k
        m = erode(m)
    return d


def fill_holes(mask):
    """mask plus every background region not connected to the border"""
    h, w = mask.shape
    bg = ~mask
    lab, sizes = components(bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    holes = bg & ~np.isin(lab, list(border))
    return mask | holes


def closing(mask, n):
    return erode(dilate(mask, n, diag=True), n) | mask


# ---------------------------------------------------------------- shading helpers

def across(p0, p1, shape):
    """signed across-axis coordinate (px) and along-axis t (0..1) for every pixel"""
    h, w = shape
    X, Y = _centres(h, w)
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1e-9
    ux, uy = dx / L, dy / L
    t = ((X - x0) * ux + (Y - y0) * uy) / L
    s = (X - x0) * (-uy) + (Y - y0) * ux       # + = to the right of the direction p0 -> p1
    return s, t, (ux, uy)


def lit_side_sign(p0, p1, light2d):
    """+1 when the right-hand side of p0->p1 faces the light (light2d = screen vector toward the light)"""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy) or 1e-9
    nx, ny = -dy / L, dx / L
    return 1 if nx * light2d[0] + ny * light2d[1] > 0 else -1


# ---------------------------------------------------------------- images and sheets

def zoom(img, z):
    return img.resize((img.width * z, img.height * z), Image.NEAREST)


def on_bg(img, bg=(104, 102, 98)):
    b = Image.new('RGBA', img.size, tuple(bg) + (255,))
    b.alpha_composite(img.convert('RGBA'))
    return b.convert('RGB')


def font(size=16):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def greyscale(img):
    a = np.asarray(img.convert('RGB')).astype(float)
    L = rel_lum(a) if a.ndim == 3 else a
    g = (np.clip(L, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
    return Image.fromarray(np.stack([g, g, g], -1), 'RGB')


def blur(img, r=2):
    from PIL import ImageFilter
    return img.filter(ImageFilter.GaussianBlur(r))


def row_sheet(panels, title='', pad=18, top=54, bg=(22, 22, 26), label_col=(255, 235, 150), fsize=16):
    """panels: list of (label, PIL image). Bottom-aligned; returns an image."""
    f = font(fsize)
    ft = font(fsize + 2)
    W = sum(p.width for _, p in panels) + pad * (len(panels) + 1)
    H = max(p.height for _, p in panels) + top + pad
    s = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(s)
    if title:
        d.text((pad, 6), title, fill=(210, 210, 210), font=ft)
    x = pad
    for lab, p in panels:
        d.text((x, top - fsize - 8), lab, fill=label_col, font=f)
        s.paste(p.convert('RGB'), (x, H - pad - p.height))
        x += p.width + pad
    return s


def stack(sheets, pad=10, bg=(22, 22, 26)):
    W = max(s.width for s in sheets)
    H = sum(s.height for s in sheets) + pad * (len(sheets) - 1)
    out = Image.new('RGB', (W, H), bg)
    y = 0
    for s in sheets:
        out.paste(s, (0, y))
        y += s.height + pad
    return out


class Guides:
    """vector underdrawing in native pixel coordinates, drawn at zoom on a sheet panel"""

    def __init__(self):
        self.items = []

    def line(self, p0, p1, col, w=1, layer='guide'):
        self.items.append(('line', [tuple(p0), tuple(p1)], col, w, layer))

    def poly(self, pts, col, w=1, closed=False, layer='guide'):
        pts = [tuple(map(float, p)) for p in pts]
        if closed:
            pts = pts + [pts[0]]
        self.items.append(('line', pts, col, w, layer))

    def circle(self, c, r, col, w=1, layer='guide'):
        self.items.append(('ellipse', (c[0] - r, c[1] - r, c[0] + r, c[1] + r), col, w, layer))

    def ellipse(self, c, rx, ry, col, w=1, angle=0.0, layer='guide'):
        t = np.linspace(0, 2 * np.pi, 48)
        ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        pts = [(c[0] + rx * math.cos(a) * ca - ry * math.sin(a) * sa,
                c[1] + rx * math.cos(a) * sa + ry * math.sin(a) * ca) for a in t]
        self.items.append(('line', pts, col, w, layer))

    def box(self, x0, y0, x1, y1, col, w=1, layer='guide'):
        """pixel box, inclusive pixel indices"""
        self.items.append(('rect', (x0, y0, x1 + 1, y1 + 1), col, w, layer))

    def dot(self, p, col, r=2.5, layer='guide'):
        self.items.append(('dot', tuple(p), col, r, layer))

    def text(self, p, s, col, layer='guide'):
        self.items.append(('text', tuple(p), col, s, layer))

    def hline(self, y, x0, x1, col, w=1, label=None, layer='grid'):
        """horizontal guide through the middle of pixel row y"""
        self.items.append(('line', [(x0, y + 0.5), (x1, y + 0.5)], col, w, layer))
        if label:
            self.items.append(('text', (x1 + 0.3, y - 0.2), col, label, layer))

    def draw(self, img, z, layers=None, ox=0, oy=0):
        img = img.convert('RGB').copy()
        d = ImageDraw.Draw(img)
        f = font(max(10, z * 2 + 4))
        for kind, geo, col, w, layer in self.items:
            if layers is not None and layer not in layers:
                continue
            if kind == 'line':
                d.line([((x + ox) * z, (y + oy) * z) for x, y in geo], fill=col, width=max(1, int(w)))
            elif kind == 'ellipse':
                x0, y0, x1, y1 = geo
                d.ellipse([(x0 + ox) * z, (y0 + oy) * z, (x1 + ox) * z, (y1 + oy) * z], outline=col, width=max(1, int(w)))
            elif kind == 'rect':
                x0, y0, x1, y1 = geo
                d.rectangle([(x0 + ox) * z, (y0 + oy) * z, (x1 + ox) * z - 1, (y1 + oy) * z - 1], outline=col, width=max(1, int(w)))
            elif kind == 'dot':
                x, y = geo
                r = w
                d.ellipse([(x + ox) * z - r, (y + oy) * z - r, (x + ox) * z + r, (y + oy) * z + r], fill=col)
            elif kind == 'text':
                x, y = geo
                d.text(((x + ox) * z, (y + oy) * z), w, fill=col, font=f)
        return img


def jdump(obj, path):
    Path(path).write_text(json.dumps(obj, indent=1, default=_np), encoding='utf-8')


def _np(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return round(float(o), 3)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))
