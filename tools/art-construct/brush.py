"""A pixel artist's brush, as data (round R2).

The round-2 heads are painted stroke by stroke: explicit fills, polylines through named pixels, and
single-pixel dabs. This module only rasterises those strokes onto a character grid; every coordinate
and every palette code is written by hand in the head scripts (`heads_r2.py`). Nothing here decides a
shape. Characters are artlib.KEY codes ('.' = transparent).

  g = Grid(38, 46)
  g.rect(12, 16, 27, 27, 's')                 # fill
  g.span(y, x0, x1, 'l')                      # one row
  g.line([(16, 9), (15, 11), (13, 15)], 'n')  # polyline through the given pixels (Bresenham between them)
  g.dots([(12, 21, 'O'), (13, 22, 'O')])      # single pixels
  g.rows()                                     # -> list of strings for head_paint's layer format
"""


class Grid:
    def __init__(self, w=38, h=46):
        self.w, self.h = w, h
        self.g = [['.'] * w for _ in range(h)]

    def put(self, x, y, ch, only=None):
        if 0 <= x < self.w and 0 <= y < self.h:
            if only is None or self.g[y][x] in only:
                self.g[y][x] = ch

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def span(self, y, x0, x1, ch, only=None):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.put(x, y, ch, only)

    def spans(self, table, ch, only=None):
        """table: {y: (x0, x1)} or {y: [(x0, x1), ...]}"""
        for y, v in table.items():
            for x0, x1 in (v if isinstance(v, list) else [v]):
                self.span(int(y), x0, x1, ch, only)

    def rect(self, x0, y0, x1, y1, ch, only=None):
        for y in range(y0, y1 + 1):
            self.span(y, x0, x1, ch, only)

    def line(self, pts, ch, only=None):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] or pts):
            dx, dy = abs(x1 - x0), -abs(y1 - y0)
            sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
            err = dx + dy
            x, y = x0, y0
            while True:
                self.put(x, y, ch, only)
                if x == x1 and y == y1:
                    break
                e2 = 2 * err
                if e2 >= dy:
                    err += dy
                    x += sx
                if e2 <= dx:
                    err += dx
                    y += sy

    def dots(self, pts, only=None):
        for x, y, ch in pts:
            self.put(x, y, ch, only)

    def recolor(self, pts, ch):
        """dabs that only land where something is already painted"""
        for x, y in pts:
            if self.get(x, y) != '.':
                self.put(x, y, ch)

    def rows(self):
        return [''.join(r) for r in self.g]


def grid_rows(text):
    """a literal overlay grid written as a block of text (leading/trailing blank lines dropped)"""
    lines = [ln for ln in text.strip('\n').split('\n')]
    return [ln.rstrip() for ln in lines]
