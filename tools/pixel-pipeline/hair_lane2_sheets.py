"""Hair lane round 2 review sheets (WF-P11 pick + blind A/B), from hair_lane2.py's finished stills.

  python tools/pixel-pipeline/hair_lane2_sheets.py --round 2 --ours r2f@p0 \
      --pick v3@none,r2f@none,r2f@p0,r2f@p1,r2f@p1h

Candidates are '<build>@<hair_px preset>' render folders under lanes/hair/renders/ ('v3@none' = round 1's
pick with today's F2 face and no pixel pass: the control). Writes review/rosace/art/hair/round-<n>/:
  pick_<still>_px<N>_x3.png / _x1.png   whole figures, candidates shuffled and lettered, refs beside the idle
  pick_heads_px<N>_x6.png               head crops of the same letters beside the ref heads
  ab_<still>_px<N>_vs_<ref>_x3.png      blind A/B: our head/hair crop against the matching ref crop
  ab_..._x1.png                         the same pair at 1x
  parts_<ours>_<i>_x6.png               part crops of the kept candidate (heads, hair, both sizes)
  key.json                              letters and sides (open after the verdicts)
"""
import argparse
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, "tools", "art-construct"))
import hair_lane as L  # noqa: E402
import hair_lane_sheets as HS  # noqa: E402
from sheets import HEADS, REFS  # noqa: E402

SEED = 20260930
STILLS = ("idle_hero", "n1_contact", "q_stamp", "n2_pivot_black")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int, default=2)
    ap.add_argument("--ours", required=True)
    ap.add_argument("--pick", required=True)
    a = ap.parse_args()
    out = os.path.join(REPO, "review", "rosace", "art", "hair", f"round-{a.round}")
    os.makedirs(out, exist_ok=True)
    rnd = random.Random(SEED)
    cands = a.pick.split(",")
    order = cands[:]
    rnd.shuffle(order)
    letters = {chr(65 + i): v for i, v in enumerate(order)}
    key = {"_doc": "Open only after writing the verdicts. pick: letter -> candidate ('<build>@<hair_px preset>'; "
                   "v3@none = round 1's pick, the control, with today's F2 face and no pixel pass). ab: which side is ours.",
           "seed": SEED, "pick": letters, "ab": {}}
    refs = [("ref 07", HS.ref("ref07_idle", REFS)), ("ref 08", HS.ref("ref08_idle", REFS)),
            ("ref 09", HS.ref("ref09_idle", REFS))]
    heads = [("ref 07", HS.ref("ref07", HEADS)), ("ref 08", HS.ref("ref08", HEADS)), ("ref 09", HS.ref("ref09", HEADS))]
    for px in (144, 80):
        for st in STILLS:
            panels = [(k, HS.still(v, st, px)) for k, v in letters.items()] + (refs if st == "idle_hero" else [])
            for z in (3, 1):
                HS.row_sheet(panels, z, f"WF-P11 pick: {st} at {px} px, x{z} (which one would you pull for?)",
                             os.path.join(out, f"pick_{st}_px{px}_x{z}.png"))
        for st in ("idle_hero", "q_stamp"):
            panels = [(k, HS.still(v, st, px, "head")) for k, v in letters.items()] + heads
            HS.row_sheet(panels, 6 if px == 144 else 10, f"heads, {st} at {px} px",
                         os.path.join(out, f"pick_heads_{st}_px{px}_x6.png"))
    pairs = [("idle_hero", "ref07", HEADS, "face"), ("idle_hero", "ref08", HEADS, "face"),
             ("n1_contact", "ref08", HEADS, "face"), ("q_stamp", "ref09", HEADS, "face"),
             ("n2_pivot_black", "ref09_hair", HS.HAIR, "hair")]
    for px in (144, 80):
        for st, rk, table, kind in pairs:
            ours = HS.still(a.ours, st, px, kind)
            theirs = HS.ref(rk, table)
            ab = [ours, theirs]
            flip = rnd.random() < 0.5
            if flip:
                ab.reverse()
            for z in (3, 1):
                name = f"ab_{st}_px{px}_vs_{rk}_x{z}.png"
                HS.row_sheet([("A", ab[0]), ("B", ab[1])], z,
                             f"blind A/B: hair ({st}, {px} px) - which reads as finished art?", os.path.join(out, name))
                key["ab"][name] = {"ours": "B" if flip else "A", "candidate": a.ours, "ref": rk}
    tiles = []
    for px in (144, 80):
        for st in STILLS:
            for kind in ("head", "hair"):
                tiles.append((f"{st} {px} {kind}", HS.still(a.ours, st, px, kind)))
    for i in range(0, len(tiles), 4):
        HS.row_sheet(tiles[i:i + 4], 6 if i < 8 else 10, f"part crops: {a.ours}",
                     os.path.join(out, f"parts_{a.ours.replace('@', '_')}_{i // 4}_x6.png"))
    json.dump(key, open(os.path.join(out, "key.json"), "w"), indent=1)
    print("sheets in", out)


if __name__ == "__main__":
    main()
