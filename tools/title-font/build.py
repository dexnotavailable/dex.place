"""Build Tesu Display (the dex.place title font) from its pixel grid.

One source, two outputs:

  src/title-font/glyphs.txt              the hand-drawn pixel glyphs (the source)
  public/fonts/tesu-display/atlas.png    bitmap atlas for the canvas world
  public/fonts/tesu-display/atlas.json   its metrics
  public/fonts/tesu-display/TesuDisplay.woff   webfont for DOM headings

Every pixel becomes a 40-unit square (1000 units per em, so one em is 25 font
pixels). Set the DOM font-size to a multiple of 25px and each font pixel lands
on whole CSS pixels.

Usage (from the repo root; needs Python 3.11+ with fontTools and Pillow):

  python tools/title-font/build.py [--ttf PATH]

--ttf also writes a desktop TTF (for design tools) to PATH, outside the site.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src" / "title-font" / "glyphs.txt"
OUT = ROOT / "public" / "fonts" / "tesu-display"

FAMILY = "Tesu Display"
PS_NAME = "TesuDisplay-Regular"
VERSION = "1.000"
COPYRIGHT = "Copyright 2026 Dex (dex.place). Drawn from scratch for dex.place."

CAP = 20  # cap height in font pixels; glyph row 19 sits on the baseline
ASCENT = 22  # font pixels above the baseline (cap + 2 of headroom)
DESCENT = 3  # font pixels below the baseline (Q's tail, the comma)
UNIT = 40  # font units per font pixel
UPM = UNIT * (ASCENT + DESCENT)  # 1000
SIDE = 1  # side bearing in font pixels on each side, so the default gap is 2
SPACE = 8  # advance of the space in font pixels


def load_glyphs(path: Path) -> dict[str, list[str]]:
    glyphs: dict[str, list[str]] = {}
    cur: str | None = None
    rows: list[str] = []

    def close() -> None:
        nonlocal cur, rows
        if cur is not None:
            if not rows:
                raise ValueError(f"glyph {cur!r} has no rows")
            widths = {len(r) for r in rows}
            if len(widths) != 1:
                raise ValueError(f"glyph {cur!r} has ragged rows: {sorted(widths)}")
            if len(rows) < CAP:
                raise ValueError(f"glyph {cur!r} is shorter than the cap height")
            if len(rows) > CAP + DESCENT:
                raise ValueError(f"glyph {cur!r} descends more than {DESCENT} px")
            if set("".join(rows)) - {"#", "."}:
                raise ValueError(f"glyph {cur!r} uses characters other than # and .")
            glyphs[cur] = rows
        cur, rows = None, []

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(";"):
            continue
        if line.startswith("glyph "):
            close()
            cur = line[len("glyph ") :]
        elif not line.strip():
            close()
        else:
            if cur is None:
                raise ValueError(f"pixel row outside a glyph block: {line!r}")
            rows.append(line)
    close()
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
    return ch


def contours(rows: list[str]) -> list[list[tuple[int, int]]]:
    """Outline of the filled pixels as closed polygons in pixel corners.

    Coordinates are y-up with y=0 on the baseline. Outer rings run clockwise and
    holes counter-clockwise (TrueType's rule), with collinear points removed.
    """
    filled = {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "#"}
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


def build_font(glyphs: dict[str, list[str]]) -> FontBuilder:
    order = [".notdef", "space"] + [glyph_name(c) for c in glyphs]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)

    cmap = {0x20: "space"}
    for ch in glyphs:
        cmap[ord(ch)] = glyph_name(ch)
        if ch.isalpha():
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

    for ch, rows in glyphs.items():
        pen = TTGlyphPen(None)
        rings = contours(rows)
        for ring in rings:
            pen.moveTo(((ring[0][0] + SIDE) * UNIT, ring[0][1] * UNIT))
            for p in ring[1:]:
                pen.lineTo(((p[0] + SIDE) * UNIT, p[1] * UNIT))
            pen.closePath()
        name = glyph_name(ch)
        tt_glyphs[name] = pen.glyph()
        # hmtx's left side bearing must equal the outline's xMin, or renderers shift the glyph
        x_min = min(p[0] for ring in rings for p in ring)
        metrics[name] = ((len(rows[0]) + 2 * SIDE) * UNIT, (x_min + SIDE) * UNIT)

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


def build_atlas(glyphs: dict[str, list[str]]) -> tuple[Image.Image, dict]:
    pad = 1
    cell_h = CAP + DESCENT
    per_row = 16
    chars = list(glyphs)
    widths = [len(glyphs[c][0]) for c in chars]
    rows_of_cells = [chars[i : i + per_row] for i in range(0, len(chars), per_row)]
    atlas_w = max(sum(len(glyphs[c][0]) + 2 * pad for c in r) for r in rows_of_cells)
    atlas_h = len(rows_of_cells) * (cell_h + 2 * pad)
    img = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    px = img.load()
    out = {}
    for ri, r in enumerate(rows_of_cells):
        x = 0
        y = ri * (cell_h + 2 * pad) + pad
        for ch in r:
            rows = glyphs[ch]
            w = len(rows[0])
            gx = x + pad
            for yy, line in enumerate(rows):
                for xx, c in enumerate(line):
                    if c == "#":
                        px[gx + xx, y + yy] = (255, 255, 255, 255)
            out[ch] = {"x": gx, "y": y, "w": w, "h": len(rows), "advance": w + 2 * SIDE, "left": SIDE}
            x += w + 2 * pad
    meta = {
        "name": FAMILY,
        "version": VERSION,
        "image": "atlas.png",
        "cap": CAP,
        "ascent": ASCENT,
        "descent": DESCENT,
        "space": SPACE,
        "note": "Units are font pixels. A glyph's top row is the cap line; row cap-1 sits on the baseline. Draw at whole-number scales only.",
        "glyphs": out,
    }
    assert len(widths) == len(out)
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
