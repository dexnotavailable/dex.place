"""Builds the fall's cloud library (cloudlib.py) into the game's assets.

  python -I tools/clouds/build.py [id ...] [--jobs N] [--sheet <dir>]

Writes public/tesu/clouds/<id>/l<level>/00.webp + manifest.json (the "frames" sprite kind's set) for each cloud and
level, and src/tesu/art/library/opening/cloud-library.ts (each cloud's size, anchor, sets, light tag) for the
painter that places them. --sheet writes a contact sheet of the library on the fall's sky (keep it OUT of the repo).
"""

from __future__ import annotations

import json
import multiprocessing as mp
import os
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cloudlib as cl  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "tesu", "clouds")
TS = os.path.join(ROOT, "src", "tesu", "art", "library", "opening", "cloud-library.ts")
# (round 3, W1-1) l200: the close ride (zoom 4) draws the mid plane at 1.27x and the back at 1.87x of level 1; with a
# level-2 set every plane there draws by the palette-keeping DOWNscale (render/sprites.ts picks the smallest set at or
# above the art scale), never an upscale of l100 (the mush and the topo-map bands)
LEVELS = (2.0, 1.0, 0.5, 0.25)

# (round 3, W1-3) masses, then lobes, then sub-lobes: the cells' own light shows more (form 0.72), the crevices under
# each lobe go down to a mid-dark cobalt (ao 0.95, the darker steps' share up) and each lobe's sun-facing rim is crisper
LOOK = {"ao": 0.95, "kr": 0.6, "form": 0.72, "form_px": 10, "lumps": 0.6, "rim_gap": 3, "rim_px": 2.5, "base_wave": 30, "base_tear": 10}
# (round 2b) the deck's sun is higher and further behind it: its crowns lit from above (the gust's hero), the body
# under them in their shadow (a thick layer: the light cannot get through), the cells' cast shadows short and soft (no
# vertical combs); under its crowns the layer's lower half lies in its own shadow (`under`: no lit tier of bellies
# reads as a crown from below at the break-out)
DECK = dict(LOOK, vs=2.5, kb=0.05, form_px=12, sun=[-0.5, -0.75, -0.45], kbelly=0.0, rags=False, sigma=0.05, reach=500, ss=0.4, ss_len=24, under=(0.42, 0.62, 0.3))
# the shares of the steps (lightest first): a sunlit heap; a deck chunk (more of it is belly); a far heap
LIT = [0.11, 0.17, 0.06, 0.05, 0.05, 0.09, 0.1, 0.1, 0.1, 0.09, 0.08]
DECKS = [0.05, 0.07, 0.05, 0.06, 0.08, 0.12, 0.15, 0.15, 0.13, 0.08, 0.06]

# id: (kind, seed, form args, look, share, far, what it is)
LIB = {
    # towers: the sky ref's great cumulus (the vast frame's hero, the far towers past the deck)
    # (round 2 integration: the great tower takes no rags. Its torn fringe drew as horizontal stripes ending on a
    # vertical cut under the deck's chunks (the vast frame, the break-out); its wavy, torn floor alone reads as a base)
    "cu-tower-a": ("heap", 31, dict(w=780, h=1150, turrets=3, lead=-0.3, belly=0.24, lean=-0.04), dict(LOOK, rags=False), LIT, 0.0, "great tower"),
    "cu-tower-b": ("heap", 44, dict(w=640, h=860, turrets=3, lead=0.1, belly=0.28, lean=-0.03), LOOK, LIT, 0.0, "tower"),
    # heaps: the middle sizes
    "cu-heap-a": ("heap", 8, dict(w=900, h=420, front_cells=0.6, cell_space=0.75), LOOK, LIT, 0.0, "heap"),
    "cu-heap-b": ("heap", 52, dict(w=1250, h=400, turrets=5, lead=-0.5), LOOK, LIT, 0.0, "broad heap"),
    "cu-heap-c": ("heap", 21, dict(w=700, h=340, front_cells=0.6, cell_space=0.75), LOOK, LIT, 0.0, "heap"),
    "cu-heap-d": ("heap", 63, dict(w=1000, h=560, turrets=4, lead=-0.2), LOOK, LIT, 0.0, "tall heap"),
    # puffs: small, a few turrets
    "cu-puff-a": ("heap", 71, dict(w=380, h=190, turrets=2), LOOK, LIT, 0.0, "puff"),
    "cu-puff-b": ("heap", 77, dict(w=260, h=150, turrets=2, lead=0.2), LOOK, LIT, 0.0, "puff"),
    "cu-puff-c": ("heap", 83, dict(w=180, h=100, turrets=2), LOOK, LIT, 0.0, "small puff"),
    # far heaps: low and flat, compressed toward the sky (the horizon's receding tops)
    "cu-far-a": ("heap", 91, dict(w=700, h=180, turrets=5, belly=0.5), LOOK, LIT, 0.55, "far heap"),
    "cu-far-b": ("heap", 97, dict(w=480, h=140, turrets=4, belly=0.5), LOOK, LIT, 0.65, "far heap"),
    "cu-far-c": ("heap", 99, dict(w=320, h=100, turrets=3, belly=0.5), LOOK, LIT, 0.7, "far heap"),
    # the deck: chunks with crowns, a thick body and rolls hanging along an undulating base
    # (a chunk is about 430 px of its plane tall: at the gust its crowns cross the lower frame under the paper, at
    # the break-out its crowns are hidden above the top bar and its belly is overhead)
    # (round 2b: the deck is a CEILING on the back plane: tall flat-ish crowns (0.84-1.0 of h) so that at the
    # break-out and the postcard every crown sits above the top bar and only the bellies show, while at the gust the
    # crowns lie under the paper; four chunks with torn gaps between them, one round the sun, one the paper falls
    # through)
    "deck-w": ("heap", 5, dict(w=1100, h=380, belly=0.5, tw=[(-0.38, 0.9, 0.09), (-0.2, 1.0, 0.1), (-0.02, 0.92, 0.1), (0.17, 0.97, 0.1), (0.36, 0.88, 0.09)], rolls=1.0, roll_px=34, cut=False, roll_drop=0.45), DECK, DECKS, 0.0, "deck chunk (west, by the sun's gap)"),
    "deck-m": ("heap", 9, dict(w=520, h=400, belly=0.45, tw=[(-0.3, 0.92, 0.15), (0.0, 1.0, 0.17), (0.3, 0.9, 0.15)], rolls=1.0, roll_px=34, cut=False, roll_drop=0.6), DECK, DECKS, 0.0, "deck chunk (hanging low between the sun's gap and the paper's)"),
    "deck-e1": ("heap", 13, dict(w=1000, h=380, belly=0.5, tw=[(-0.36, 0.9, 0.1), (-0.16, 0.97, 0.11), (0.04, 1.0, 0.11), (0.23, 0.92, 0.1), (0.4, 0.88, 0.08)], rolls=1.0, roll_px=36, cut=False, roll_drop=0.45), DECK, DECKS, 0.0, "deck chunk (the gust's hero crown east of the paper)"),
    "deck-e2": ("heap", 29, dict(w=1300, h=360, belly=0.5, tw=[(-0.4, 0.88, 0.08), (-0.24, 1.0, 0.1), (-0.07, 0.9, 0.09), (0.1, 0.96, 0.1), (0.27, 0.9, 0.09), (0.41, 0.86, 0.08)], rolls=1.0, roll_px=36, cut=False, roll_drop=0.4), DECK, DECKS, 0.0, "deck chunk (east)"),
    "deck-mid-a": ("heap", 17, dict(w=1800, h=300, belly=0.62, tw=[(-0.4, 0.5, 0.06), (-0.27, 0.8, 0.08), (-0.12, 0.55, 0.06), (0.03, 0.66, 0.07), (0.2, 1.0, 0.09), (0.36, 0.6, 0.07)], rolls=1.0, roll_px=30, cut=False, roll_drop=0.5, taper=0.1), DECK, DECKS, 0.25, "deck band, middle distance"),
    "deck-far-a": ("heap", 19, dict(w=2200, h=170, belly=0.7, tw=[(-0.42, 0.6, 0.05), (-0.28, 0.9, 0.06), (-0.1, 0.55, 0.05), (0.06, 0.75, 0.05), (0.24, 1.0, 0.07), (0.4, 0.65, 0.05)], taper=0.12, rolls=0.8, roll_px=18, cut=False, roll_drop=0.4), DECK, DECKS, 0.55, "deck band, far"),
    # streaks: low stratus and high cirrus (painted strokes)
    # (round 2, W1-5: tapered, broken, west-sheared translucent strokes: fibrous cirrus high, lumpy stratus low)
    "st-a": ("wisps", 3, dict(w=900, h=56, pieces=2, kind="stratus", thick=(0.6, 1.0), hook=0.15, breaks=0.4, alphas=(0.35, 0.6, 0.88, 1.0)), None, None, 0.0, "low stratus"),
    "st-b": ("wisps", 5, dict(w=600, h=44, pieces=2, kind="stratus", thick=(0.6, 1.0), hook=0.15, breaks=0.4, alphas=(0.35, 0.6, 0.88, 1.0)), None, None, 0.0, "low stratus"),
    "st-c": ("wisps", 13, dict(w=1100, h=64, pieces=3, kind="stratus", thick=(0.5, 1.0), hook=0.12, breaks=0.45, alphas=(0.35, 0.6, 0.88, 1.0)), None, None, 0.2, "low stratus, far"),
    "ci-a": ("wisps", 7, dict(w=800, h=90, pieces=2, kind="cirrus"), None, None, 0.45, "high cirrus"),
    "ci-b": ("wisps", 11, dict(w=560, h=70, pieces=2, kind="cirrus"), None, None, 0.5, "high cirrus"),
    "ci-c": ("wisps", 23, dict(w=700, h=80, pieces=3, kind="cirrus"), None, None, 0.45, "high cirrus"),
    # (round 3) more of the family for the close ride (W1-4, W1-5, W1-7, W1-8, W1-9)
    # a mid heap that is not cu-heap-a (the gust's and the deck's west banks)
    "cu-heap-e": ("heap", 36, dict(w=820, h=470, turrets=3, lead=0.3, belly=0.3), LOOK, LIT, 0.0, "heap"),
    # the come-out's ceiling: the deck's underside seen from beside and under it (rolls and pouches hanging at
    # different sizes, torn gaps where the sun gets through; no crowns: their tops stay above the frame)
    "deck-under": ("slab", 25, dict(w=1900, h=420, rows=3, roll_px=64, rolls=0.75, gaps=[(-0.3, 0.06), (-0.04, 0.04), (0.2, 0.05), (0.38, 0.04)], taper=0.04, top_lumps=0.0), dict(DECK, under=(0.55, 0.95, 0.2), kb=0.12, kbelly=0.0, form=0.92, lumps=0.4), DECKS, 0.12, "deck underside (the come-out's ceiling)"),
    # low stratus, longer and thinner (the ref's pink-lit streaks under the cumulus)
    "st-d": ("wisps", 17, dict(w=1300, h=60, pieces=3, kind="stratus", thick=(0.4, 0.9), hook=0.1, breaks=0.5, tilt=-0.02, alphas=(0.35, 0.6, 0.88, 1.0)), None, None, 0.3, "low stratus, far"),
    "st-e": ("wisps", 19, dict(w=800, h=50, pieces=2, kind="stratus", thick=(0.5, 1.0), hook=0.12, breaks=0.45, alphas=(0.35, 0.6, 0.88, 1.0)), None, None, 0.1, "low stratus"),
    # the sky's texture between the clouds: faint far cirrus combed by the wind (value close to the sky)
    "ci-d": ("wisps", 29, dict(w=1000, h=70, pieces=4, kind="cirrus", tilt=-0.06, hook=0.25, breaks=0.5, thick=(0.3, 0.6)), None, None, 0.9, "faint far cirrus"),
    "ci-e": ("wisps", 31, dict(w=700, h=60, pieces=3, kind="cirrus", tilt=-0.08, hook=0.3, breaks=0.5, thick=(0.3, 0.6)), None, None, 0.9, "faint far cirrus"),
    # the drop's wisp (W1-8): curved, fibrous, torn into strands, lit on top, angled with the wind
    "ci-f": ("wisps", 37, dict(w=620, h=150, pieces=4, kind="cirrus", tilt=-0.14, hook=0.6, breaks=0.38, thick=(0.35, 0.8)), None, None, 0.35, "curved cirrus wisp"),
}


def ramp_of(far):
    return [cl.hexrgb(x) for x in cl.NEAR] if far <= 0 else cl.ramp_far(far)


def crop(rgba):
    a = rgba[:, :, 3] > 0
    ys, xs = np.nonzero(a)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgba[y0:y1, x0:x1], int(x0), int(y0)


def edge_taper(rgba, L, seed):
    """(round 3, W1-2) No straight cut where a cloud's skirt meets its render's box (the glimpse tower's vertical crop
    edge): the last ~14 px of level 1 at the box's left and right edges thin out along a ragged, row-varying line."""
    a = rgba[:, :, 3] > 0
    H, W = a.shape
    n = max(4, int(14 * L))
    if W <= 4 * n:
        return rgba
    nz = cl.Noise(seed * 11 + 5)
    ys = np.arange(H, dtype=np.float32)
    out = rgba.copy()
    for side in (0, 1):
        reach = n * (0.35 + 0.65 * nz.fbm(ys / (6.0 * L), np.full_like(ys, 2.0 + side), oct=2))
        for d in range(n):
            x = d if side == 0 else W - 1 - d
            cut = a[:, x] & (d < reach)
            out[cut, x, 3] = 0
    return out


def build_one(cid):
    kind, seed, args, look, share, far, what = LIB[cid]
    t0 = time.time()
    ramp = ramp_of(far)
    out = {"id": cid, "kind": kind, "what": what, "sets": []}
    if kind in ("streaks", "wisps"):
        a = dict(args)
        w, h = a.pop("w"), a.pop("h")
        rgba = getattr(cl, kind)(np.random.default_rng(seed), w, h, seed=seed, ramp=ramp, **a)
        rgba, x0, y0 = crop(rgba)
        # anchor: the middle of its box's foot (as the heaps)
        levels = [(1.0, rgba, w / 2 - x0, h - y0)]
    else:
        form = getattr(cl, kind)(np.random.default_rng(seed), **args)
        levels = []
        for L in LEVELS:
            val, ox, oy = cl.render(form, level=L, seed=seed, look=look, pad=24)
            rgba, _ = cl.to_pixels(val, ramp, seed=seed, share=share, level=L, bscale=max(1.0, L))
            pad = int(max(4, 0.08 * form["h"] * L)) + 4
            rgba = np.concatenate([rgba, np.zeros((pad, rgba.shape[1], 4), np.uint8)], 0)
            if look.get("rags", True):
                rgba = cl.rags(rgba, form, ox, oy, L, seed, ramp=ramp)
            rgba = edge_taper(rgba, L, seed)
            rgba, x0, y0 = crop(rgba)
            levels.append((L, rgba, -ox - x0, -oy - y0))
    for L, rgba, ax, ay in levels:
        d = os.path.join(OUT, cid, f"l{int(round(L * 100))}")
        os.makedirs(d, exist_ok=True)
        Image.fromarray(rgba).save(os.path.join(d, "00.webp"), "WEBP", lossless=True, quality=100, method=6)
        man = {"count": 1, "w": int(rgba.shape[1]), "h": int(rgba.shape[0]), "ax": round(float(ax), 2), "ay": round(float(ay), 2)}
        with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(man, f)
        out["sets"].append({"level": L, "base": f"/tesu/clouds/{cid}/l{int(round(L * 100))}/", **man})
    out["secs"] = round(time.time() - t0, 1)
    return out


def write_ts(entries):
    lines = [
        "// GENERATED by tools/clouds/build.py (the fall's cloud library: clouds built in 3D and rendered, snapped to the",
        "// pixel grid and the cloud palette; tools/clouds/cloudlib.py). Do not edit by hand: change the library there and",
        "// rebuild. Each cloud: its rendered sets (level = art density, 1 at play zoom), its size and anchor at level 1",
        "// (the middle of its base), and the light it is lit by (one sun, upper left: never flip a cloud).",
        "",
        "export interface CloudSet { level: number; base: string }",
        "export interface CloudEntry {",
        "  /** What it is (a tower, a heap, a deck chunk, a streak). */",
        "  what: string;",
        "  /** Level-1 size and anchor (px of its plane). */",
        "  w: number;",
        "  h: number;",
        "  ax: number;",
        "  ay: number;",
        "  sets: readonly CloudSet[];",
        "}",
        "",
        f"export const CLOUD_LIGHT = {json.dumps(cl.LIGHT_TAG)} as const;",
        "",
        "export const CLOUDS: Readonly<Record<string, CloudEntry>> = {",
    ]
    for e in entries:
        s1 = next(s for s in e["sets"] if s["level"] == 1.0)
        sets = ", ".join(f'{{ level: {s["level"]}, base: "{s["base"]}" }}' for s in e["sets"])
        lines.append(f'  "{e["id"]}": {{ what: {json.dumps(e["what"])}, w: {s1["w"]}, h: {s1["h"]}, ax: {s1["ax"]}, ay: {s1["ay"]}, sets: [{sets}] }},')
    lines.append("};")
    lines.append("")
    with open(TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


def sheet(entries, d):
    os.makedirs(d, exist_ok=True)
    tiles = []
    for e in entries:
        s1 = next(s for s in e["sets"] if s["level"] == 1.0)
        im = np.asarray(Image.open(os.path.join(OUT, e["id"], "l100", "00.webp")).convert("RGBA"))
        bg = cl.sky_bg(im.shape[1] + 20, im.shape[0] + 20)
        cl.over(bg, im, 10, 10)
        tiles.append((e["id"], bg))
    # rows of up to 2400 px
    rows, row, wsum = [], [], 0
    for t in tiles:
        if row and wsum + t[1].shape[1] > 2600:
            rows.append(row)
            row, wsum = [], 0
        row.append(t)
        wsum += t[1].shape[1]
    if row:
        rows.append(row)
    W = max(sum(t[1].shape[1] for t in r) for r in rows)
    imgs = []
    for r in rows:
        H = max(t[1].shape[0] for t in r)
        canvas = np.full((H, W, 3), 40, np.uint8)
        x = 0
        for _, t in r:
            canvas[:t.shape[0], x:x + t.shape[1]] = t
            x += t.shape[1]
        imgs.append(canvas)
    Image.fromarray(np.concatenate(imgs, 0)).save(os.path.join(d, "library-sheet.png"))


if __name__ == "__main__":
    args = sys.argv[1:]
    jobs = 6
    sheet_dir = None
    if "--jobs" in args:
        i = args.index("--jobs")
        jobs = int(args[i + 1])
        del args[i:i + 2]
    if "--sheet" in args:
        i = args.index("--sheet")
        sheet_dir = args[i + 1]
        del args[i:i + 2]
    ids = args or list(LIB)
    # (biggest first, so the pool ends together)
    ids.sort(key=lambda k: -LIB[k][2].get("w", 0) * LIB[k][2].get("h", 0))
    with mp.Pool(jobs) as pool:
        done = pool.map(build_one, ids, chunksize=1)
    for e in done:
        print(f'{e["id"]:12s} {e["secs"]:6.1f}s ' + " ".join(f'l{s["level"]}:{s["w"]}x{s["h"]}' for s in e["sets"]))
    # the TS index covers every built cloud on disk (a partial rebuild keeps the others)
    allents = {e["id"]: e for e in done}
    for cid in LIB:
        if cid in allents:
            continue
        sets = []
        for L in LEVELS:
            mpath = os.path.join(OUT, cid, f"l{int(round(L * 100))}", "manifest.json")
            if os.path.exists(mpath):
                man = json.load(open(mpath, encoding="utf-8"))
                sets.append({"level": L, "base": f"/tesu/clouds/{cid}/l{int(round(L * 100))}/", **man})
        if sets:
            allents[cid] = {"id": cid, "what": LIB[cid][6], "sets": sets}
    ents = [allents[c] for c in LIB if c in allents]
    write_ts(ents)
    if sheet_dir:
        sheet(ents, sheet_dir)
