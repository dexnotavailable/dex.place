"""Build Tesu Display (the dex.place title font) from its pixel grid.

One source, two outputs:

  src/title-font/glyphs.txt              the hand-drawn pixel glyphs (the source)
  public/fonts/tesu-display/atlas.png    bitmap atlas for the canvas world
  public/fonts/tesu-display/atlas.json   its metrics
  public/fonts/tesu-display/TesuDisplay.woff   webfont for DOM headings

Every pixel becomes a 40-unit square (1000 units per em, so one em is 25 font
pixels). Set the DOM font-size to a multiple of 25px and each font pixel lands
on whole CSS pixels.

Vietnamese capitals (for Hoai Pho and the rest) are composed here from the base
letters and the `mark` blocks in glyphs.txt: circumflex, breve and horn, the five
tones (grave, acute, hook above, tilde, dot below), stacked where Vietnamese
stacks them. A hand-drawn `glyph` block for any of them wins over the composed
one (`glyph X up N` when it reaches N rows above the cap line).

Usage (from the repo root; needs Python 3.11+ with fontTools and Pillow):

  python tools/title-font/build.py [--ttf PATH]

--ttf also writes a desktop TTF (for design tools) to PATH, outside the site.
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src" / "title-font" / "glyphs.txt"
OUT = ROOT / "public" / "fonts" / "tesu-display"

FAMILY = "Tesu Display"
PS_NAME = "TesuDisplay-Regular"
VERSION = "1.100"
COPYRIGHT = "Copyright 2026 Dex (dex.place). Drawn from scratch for dex.place."

CAP = 20  # cap height in font pixels; glyph row 19 sits on the baseline
ABOVE = 11  # rows above the cap line for accents (two stacked marks)
ASCENT = CAP + ABOVE  # font pixels above the baseline
DESCENT = 4  # font pixels below the baseline (Q's tail, the comma, the dot below)
UNIT = 40  # font units per font pixel
UPM = 1000  # one em is 25 font pixels
SIDE = 1  # side bearing in font pixels on each side, so the default gap is 2
SPACE = 8  # advance of the space in font pixels


class Glyph:
    """Pixel rows; the first `up` rows sit above the cap line.

    `shift` columns of ink hang left of the letter's origin (an accent wider than
    a narrow letter such as I); `adv` is the advance in pixels, before side bearings.
    """

    def __init__(self, rows: list[str], up: int = 0, shift: int = 0, adv: int | None = None) -> None:
        self.rows = rows
        self.up = up
        self.shift = shift
        self.adv = len(rows[0]) - shift if adv is None else adv

    @property
    def w(self) -> int:
        return len(self.rows[0])


def load_source(path: Path) -> tuple[dict[str, Glyph], dict[str, list[str]]]:
    """Glyph blocks and mark blocks from glyphs.txt."""
    glyphs: dict[str, Glyph] = {}
    marks: dict[str, list[str]] = {}
    kind: str | None = None
    cur: str | None = None
    up = 0
    rows: list[str] = []

    def close() -> None:
        nonlocal kind, cur, rows, up
        if cur is not None:
            if not rows:
                raise ValueError(f"{kind} {cur!r} has no rows")
            widths = {len(r) for r in rows}
            if len(widths) != 1:
                raise ValueError(f"{kind} {cur!r} has ragged rows: {sorted(widths)}")
            if set("".join(rows)) - {"#", "."}:
                raise ValueError(f"{kind} {cur!r} uses characters other than # and .")
            if kind == "mark":
                marks[cur] = rows
            else:
                if up > ABOVE:
                    raise ValueError(f"glyph {cur!r} reaches more than {ABOVE} rows above the cap")
                if len(rows) < up + CAP:
                    raise ValueError(f"glyph {cur!r} is shorter than the cap height")
                if len(rows) > up + CAP + DESCENT:
                    raise ValueError(f"glyph {cur!r} descends more than {DESCENT} px")
                glyphs[cur] = Glyph(rows, up)
        kind, cur, rows, up = None, None, [], 0

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(";"):
            continue
        if line.startswith("glyph ") or line.startswith("mark "):
            close()
            kind, _, rest = line.partition(" ")
            parts = rest.split(" ")
            # "glyph X" or "glyph X up N"
            cur = parts[0]
            if len(parts) == 3 and parts[1] == "up":
                up = int(parts[2])
        elif not line.strip():
            close()
        else:
            if cur is None:
                raise ValueError(f"pixel row outside a block: {line!r}")
            rows.append(line)
    close()
    return glyphs, marks


# Vietnamese: the vowels with circumflex, breve or horn, each with the five tones.
VI_BASES = "A\u0102\u00c2E\u00caIO\u00d4\u01a0U\u01afY"
VI_TONES = ["", "\u0300", "\u0301", "\u0309", "\u0303", "\u0323"]
COMBINING = {
    "\u0300": "grave", "\u0301": "acute", "\u0309": "hook", "\u0303": "tilde", "\u0323": "dotbelow",
    "\u0302": "circumflex", "\u0306": "breve", "\u031b": "horn",
}
GAP = 2  # empty rows between the cap line and the lowest mark


def vietnamese_capitals() -> list[str]:
    out = []
    for b in VI_BASES:
        for t in VI_TONES:
            c = unicodedata.normalize("NFC", b + t)
            assert len(c) == 1, (b, t)
            out.append(c)
    return out


def compose(ch: str, glyphs: dict[str, Glyph], marks: dict[str, list[str]]) -> Glyph:
    """Builds a Vietnamese capital from its base letter and marks."""
    decomposed = unicodedata.normalize("NFD", ch)
    base = glyphs[decomposed[0]]
    names = [COMBINING[c] for c in decomposed[1:]]
    pix: set[tuple[int, int]] = {(x, y) for y, r in enumerate(base.rows[base.up :]) for x, c in enumerate(r) if c == "#"}
    cx = (base.w - 1) / 2

    def stamp(name: str, left: int, top: int) -> None:
        for yy, r in enumerate(marks[name]):
            for xx, c in enumerate(r):
                if c == "#":
                    pix.add((left + xx, top + yy))

    def centred(name: str, centre: float) -> int:
        return round(centre - (len(marks[name][0]) - 1) / 2)

    if "horn" in names:
        # the horn leaves the top right corner of O or U, rising up and out;
        # its bottom row is cap row 2
        h = marks["horn"]
        stamp("horn", base.w - 3, 3 - len(h))
    shape = next((n for n in names if n in ("circumflex", "breve")), None)
    tone = next((n for n in names if n in ("grave", "acute", "hook", "tilde")), None)
    low = -GAP - 1  # bottom row of the first mark above the cap
    if shape:
        sh = marks[shape]
        left = centred(shape, cx)
        if shape == "circumflex" and tone in ("grave", "acute", "hook"):
            # Vietnamese sets these tones beside the circumflex, up to its right
            left -= 2
            stamp(shape, left, low - len(sh) + 1)
            tm = marks[tone]
            stamp(tone, left + len(sh[0]) - 2, low - len(sh) + 1 - len(tm) + 1)
        else:
            stamp(shape, left, low - len(sh) + 1)
            if tone:
                # the tilde over a circumflex, and every tone over a breve, stack above it
                tm = marks[tone]
                stamp(tone, centred(tone, cx), low - len(sh) - 1 - len(tm) + 1)
    elif tone:
        tm = marks[tone]
        stamp(tone, centred(tone, cx), low - len(tm) + 1)
    if "dotbelow" in names:
        stamp("dotbelow", centred("dotbelow", cx), CAP + 1)

    # accents may overhang a narrow letter on either side without widening its
    # advance; the horn does widen it, so the next letter keeps clear of it
    xs = [p[0] for p in pix]
    shift = max(0, -min(xs))
    right = max(base.w, max(xs) + 1)
    adv = base.w + (right - base.w if "horn" in names else 0)
    top = min(0, min(p[1] for p in pix))
    bottom = max(CAP - 1, max(p[1] for p in pix))
    rows = ["".join("#" if (x, y) in pix else "." for x in range(-shift, right)) for y in range(top, bottom + 1)]
    return Glyph(rows, -top, shift, adv)


def load_glyphs(path: Path) -> dict[str, Glyph]:
    glyphs, marks = load_source(path)
    if "\u0110" not in glyphs:
        raise ValueError("glyphs.txt needs a hand-drawn \u0110 (D with stroke)")
    for ch in vietnamese_capitals():
        if ch not in glyphs:
            glyphs[ch] = compose(ch, glyphs, marks)
    for ch, g in glyphs.items():
        below = len(g.rows) - g.up - CAP
        if g.up > ABOVE or below > DESCENT:
            raise ValueError(f"{ch!r} does not fit the line ({g.up} above, {below} below)")
    return glyphs


def glyph_name(ch: str) -> str:
    named = {
        ".": "period", ",": "comma", "'": "quotesingle", "-": "hyphen",
        "!": "exclam", "?": "question", "&": "ampersand", ":": "colon",
    }
    if ch in named:
        return named[ch]
    if ch.isdigit():
        return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][int(ch)]
    if ch.isascii():
        return ch
    return f"uni{ord(ch):04X}"


def contours(rows: list[str], up: int = 0) -> list[list[tuple[int, int]]]:
    """Outline of the filled pixels as closed polygons in pixel corners.

    Coordinates are y-up with y=0 on the baseline. Outer rings run clockwise and
    holes counter-clockwise (TrueType's rule), with collinear points removed.
    """
    filled = {(x, y - up) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "#"}
    # Directed boundary edges, each pixel traced clockwise in y-up space.
    # A pixel at grid (x, row) spans x..x+1 and, y-up, (CAP-1-row)..(CAP-row).
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}

    def add(a: tuple[int, int], b: tuple[int, int]) -> None:
        edges.setdefault(a, []).append(b)

    for x, row in filled:
        y0 = CAP - 1 - row
        y1 = y0 + 1
        if (x, row - 1) not in filled:  # top edge, left to right
            add((x, y1), (x + 1, y1))
        if (x + 1, row) not in filled:  # right edge, downwards
            add((x + 1, y1), (x + 1, y0))
        if (x, row + 1) not in filled:  # bottom edge, right to left
            add((x + 1, y0), (x, y0))
        if (x - 1, row) not in filled:  # left edge, upwards
            add((x, y0), (x, y1))

    def turn_rank(d_in: tuple[int, int], d_out: tuple[int, int]) -> int:
        # At a vertex shared by two diagonal pixels, prefer the right turn
        # (clockwise), which keeps touching rings separate.
        cross = d_in[0] * d_out[1] - d_in[1] * d_out[0]
        return 0 if cross < 0 else (1 if cross == 0 else 2)

    rings: list[list[tuple[int, int]]] = []
    while edges:
        start = next(iter(edges))
        ring = [start]
        prev = start
        nxt = edges[start].pop()
        if not edges[start]:
            del edges[start]
        while nxt != start:
            ring.append(nxt)
            outs = edges[nxt]
            d_in = (nxt[0] - prev[0], nxt[1] - prev[1])
            outs.sort(key=lambda p: turn_rank(d_in, (p[0] - nxt[0], p[1] - nxt[1])))
            prev, nxt2 = nxt, outs.pop(0)
            if not outs:
                del edges[nxt]
            nxt = nxt2
        # drop collinear points
        simple = []
        n = len(ring)
        for i, p in enumerate(ring):
            a = ring[i - 1]
            b = ring[(i + 1) % n]
            if (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) != 0:
                simple.append(p)
        rings.append(simple)
    return rings


def build_font(glyphs: dict[str, Glyph]) -> FontBuilder:
    order = [".notdef", "space"] + [glyph_name(c) for c in glyphs]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)

    cmap = {0x20: "space"}
    for ch in glyphs:
        cmap[ord(ch)] = glyph_name(ch)
        if ch.isalpha() and len(ch.lower()) == 1:
            cmap[ord(ch.lower())] = glyph_name(ch)  # lowercase shows the same capitals
    fb.setupCharacterMap(cmap)

    tt_glyphs = {}
    metrics = {}

    # .notdef: a hollow box the size of an H
    pen = TTGlyphPen(None)
    for ring in ([(0, 0), (0, CAP), (12, CAP), (12, 0)], [(2, 2), (10, 2), (10, CAP - 2), (2, CAP - 2)]):
        pen.moveTo(((ring[0][0] + SIDE) * UNIT, ring[0][1] * UNIT))
        for p in ring[1:]:
            pen.lineTo(((p[0] + SIDE) * UNIT, p[1] * UNIT))
        pen.closePath()
    tt_glyphs[".notdef"] = pen.glyph()
    metrics[".notdef"] = ((12 + 2 * SIDE) * UNIT, SIDE * UNIT)

    tt_glyphs["space"] = TTGlyphPen(None).glyph()
    metrics["space"] = (SPACE * UNIT, 0)

    for ch, g in glyphs.items():
        pen = TTGlyphPen(None)
        rings = contours(g.rows, g.up)
        dx = SIDE - g.shift
        for ring in rings:
            pen.moveTo(((ring[0][0] + dx) * UNIT, ring[0][1] * UNIT))
            for p in ring[1:]:
                pen.lineTo(((p[0] + dx) * UNIT, p[1] * UNIT))
            pen.closePath()
        name = glyph_name(ch)
        tt_glyphs[name] = pen.glyph()
        # hmtx's left side bearing must equal the outline's xMin, or renderers shift the glyph
        x_min = min(p[0] for ring in rings for p in ring)
        metrics[name] = ((g.adv + 2 * SIDE) * UNIT, (x_min + dx) * UNIT)

    fb.setupGlyf(tt_glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT * UNIT, descent=-DESCENT * UNIT)
    fb.setupNameTable(
        {
            "familyName": FAMILY,
            "styleName": "Regular",
            "uniqueFontIdentifier": f"{PS_NAME};{VERSION}",
            "fullName": f"{FAMILY} Regular",
            "psName": PS_NAME,
            "version": f"Version {VERSION}",
            "copyright": COPYRIGHT,
            "manufacturer": "Dex",
            "vendorURL": "https://dex.place",
            "licenseDescription": "See LICENSE.txt beside this font. Drawn for dex.place; not for redistribution without permission.",
        }
    )
    fb.setupOS2(
        sTypoAscender=ASCENT * UNIT,
        sTypoDescender=-DESCENT * UNIT,
        sTypoLineGap=0,
        usWinAscent=ASCENT * UNIT,
        usWinDescent=DESCENT * UNIT,
        sxHeight=CAP * UNIT,
        sCapHeight=CAP * UNIT,
        achVendID="DEX ",
        fsType=0,
    )
    fb.setupPost(isFixedPitch=0)
    return fb


def build_atlas(glyphs: dict[str, Glyph]) -> tuple[Image.Image, dict]:
    pad = 1
    cell_h = ABOVE + CAP + DESCENT
    per_row = 16
    chars = list(glyphs)
    rows_of_cells = [chars[i : i + per_row] for i in range(0, len(chars), per_row)]
    atlas_w = max(sum(glyphs[c].w + 2 * pad for c in r) for r in rows_of_cells)
    atlas_h = len(rows_of_cells) * (cell_h + 2 * pad)
    img = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    px = img.load()
    out = {}
    for ri, r in enumerate(rows_of_cells):
        x = 0
        cap_line = ri * (cell_h + 2 * pad) + pad + ABOVE
        for ch in r:
            g = glyphs[ch]
            gx = x + pad
            gy = cap_line - g.up
            for yy, line in enumerate(g.rows):
                for xx, c in enumerate(line):
                    if c == "#":
                        px[gx + xx, gy + yy] = (255, 255, 255, 255)
            out[ch] = {"x": gx, "y": gy, "w": g.w, "h": len(g.rows), "up": g.up, "advance": g.adv + 2 * SIDE, "left": SIDE - g.shift}
            x += g.w + 2 * pad
    meta = {
        "name": FAMILY,
        "version": VERSION,
        "image": "atlas.png",
        "cap": CAP,
        "ascent": ASCENT,
        "descent": DESCENT,
        "space": SPACE,
        "note": "Units are font pixels. A glyph's rect starts `up` rows above the cap line; row up+cap-1 sits on the baseline. Draw at whole-number scales only.",
        "glyphs": out,
    }
    return img, meta


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Tesu Display from its pixel grid.")
    ap.add_argument("--ttf", help="also write a desktop TTF here (kept out of public/)")
    args = ap.parse_args()
    glyphs = load_glyphs(SRC)
    OUT.mkdir(parents=True, exist_ok=True)
    fb = build_font(glyphs)
    if args.ttf:
        fb.save(args.ttf)
    fb.font.flavor = "woff"
    fb.save(str(OUT / "TesuDisplay.woff"))
    img, meta = build_atlas(glyphs)
    img.save(OUT / "atlas.png", optimize=True)
    (OUT / "atlas.json").write_text(json.dumps(meta, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(glyphs)} glyphs -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
