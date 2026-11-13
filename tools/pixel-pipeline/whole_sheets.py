"""Whole-character blind A/B sheets (round 'whole', 2026-09-29): the integrated canonical stills beside the
finish-bar refs 07, 08, 09 and 04, the pre-integration canonical stills as the control (WF-P11, WF-P13).

  python tools/pixel-pipeline/whole_sheets.py [--round round-1] [--seed 20260929]
      [--renders <build>/renders/integrated] [--control <build>/renders/final_v2]
      [--control-blend <build>/rosace_pre_artistry.blend] [--control-doc "what the control is"]
  round 2 (WH2): --round round-2 --control <build>/renders/whole_r1 --control-blend <build>/rosace_wh1.blend
      --control-doc "the round-1 integrated still (rosace_wh1.blend, renders/whole_r1)"

Writes into review/rosace/art/whole/<round>/ (git-ignored; the refs are third-party and never committed):
  <still>_px144_x3.png, _x1.png   the 144 px still, whole figure, beside the four refs at their native grid
                                  (refs are 137-158 px tall, so native is the same scale as 144)
  <still>_px80_x3.png, _x1.png    the 80 px world still beside the same four ref crops resampled to world scale
                                  (ref figure height -> 80 px; box filter, then snapped to the crop's own palette)
  all_px144_x1.png, all_px80_x1.png   every sheet of that size stacked (rows = stills, same letters)
  key.json                        the letter mapping, seed, sources (blend sha256, still sha1s, pose sha1 check),
                                  the ref crop boxes and heights, and which ref crops are pose matches

One letter mapping for every sheet (WF-P13): six candidates A-F = ours, control, ref07, ref08, ref09, ref04. Each
ref slot uses that ref's crop closest to the still's pose (07/08/04 have no back view: on the back sheet they
stand in as finish-bar figures only; key.json says so). Panels are bottom-aligned (one ground line) and labelled
with letters only. Stills are still.png (no contact shadow), so ours and the control are framed the same way.
"""
import argparse
import hashlib
import json
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
NATIVE = os.path.join(REPO, "review", "refs", "character", "native")
POSES = os.path.join(REPO, "art", "rosace", "poses")
BACKDROP = (104, 102, 98)
SHEET_BG = (34, 34, 40)

F07 = "07-anim-amberowl-wrench_bonus-originalsize_1x.png"
F08 = "08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png"
F09 = "09-anim-amberowl-katana-cats_1x.png"
F04 = "04-style-grid9_native-p2.158.png"
# ref crops on the native-grid copies: (file, box, figure height skull-top to sole in native px, note)
# heights: REF-BREAKDOWN summary table (07 ~137, 08 ~150, 09 ~158); 04 read on the crop (hat/ears excluded) [I]
CROPS = {
    "07_idle": (F07, (64, 12, 174, 194), 137, "07 bonus 1x, dark-haired idle (the studio logo corner at bottom left is painted out with the row's background, see LOGO)"),
    "07_attack": (F07, (172, 14, 340, 200), 137, "07 bonus 1x, wrench swing with arc"),
    "08_idle": (F08, (178, 40, 342, 222), 150, "08 bonus 1x, hand-on-hip idle with sword"),
    "08_attack": (F08, (352, 14, 600, 230), 150, "08 bonus 1x, airborne called strike with the red bolt"),
    "09_idle": (F09, (60, 28, 210, 215), 158, "09 1x top row col 1, idle"),
    "09_raise": (F09, (245, 20, 405, 215), 158, "09 1x top row col 2, overhead wind-up seen three-quarter from behind"),
    "09_attack": (F09, (425, 20, 655, 215), 158, "09 1x top row col 3, katana slash with the petal trail"),
    "04_c": (F04, (142, 180, 226, 348), 150, "04 native p2.158, row 2 centre (hat, hand on hip)"),
    "04_l": (F04, (18, 180, 145, 348), 150, "04 native p2.158, row 2 left (twin tails, gun at hip)"),
    "04_r": (F04, (230, 180, 318, 348), 150, "04 native p2.158, row 2 right (red hair, rifle)"),
}
# per still: our still dir name, pose file, the crop for each ref slot, and whether that crop matches the pose
STILLS = [
    ("idle", "idle_hero", "idle_hero.json",
     {"ref07": ("07_idle", True), "ref08": ("08_idle", True), "ref09": ("09_idle", True), "ref04": ("04_c", True)}),
    ("n1_contact", "n1_contact", "n1_contact.json",
     {"ref07": ("07_attack", True), "ref08": ("08_attack", True), "ref09": ("09_attack", True),
      "ref04": ("04_l", False)}),
    ("q_stamp", "q_stamp", "q_stamp.json",
     {"ref07": ("07_attack", False), "ref08": ("08_attack", True), "ref09": ("09_raise", True),
      "ref04": ("04_r", False)}),
    ("back", "n2_pivot_black", "n2_pivot.json",
     {"ref07": ("07_idle", False), "ref08": ("08_idle", False), "ref09": ("09_raise", True),
      "ref04": ("04_c", False)}),
]
SLOTS = ["ours", "control", "ref07", "ref08", "ref09", "ref04"]
WORLD_PX = 80


def sha(path, n=None, algo="sha1"):
    h = hashlib.new(algo, open(path, "rb").read()).hexdigest()
    return h[:n] if n else h


def on_bg(im):
    b = Image.new("RGBA", im.size, BACKDROP + (255,))
    b.alpha_composite(im.convert("RGBA"))
    return b.convert("RGB")


def still(root, s, px, pad=3):
    im = Image.open(os.path.join(root, s, f"px{px}", "still.png")).convert("RGBA")
    x0, y0, x1, y1 = im.split()[3].getbbox()
    box = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    return on_bg(im.crop(box))


# the Amber Owl logo corner that reaches into the 07 idle crop: (native box, background sample x) per file
LOGO = {F07: ((0, 158, 78, 240), 79)}


def ref_native(name):
    f, box, _, _ = CROPS[name]
    im = Image.open(os.path.join(NATIVE, f)).convert("RGB")
    if f in LOGO:                     # display only: the logo box takes the row's background colour
        (x0, y0, x1, y1), sx = LOGO[f]
        px = im.load()
        for y in range(y0, min(y1, im.height)):
            bg = px[sx, y]
            for x in range(x0, x1):
                px[x, y] = bg
    return im.crop(box)


def ref_world(name):
    """the ref crop at world scale: its figure height -> 80 px. Box-filter it, then snap every pixel to the
    native crop's own 48-colour palette (no dither), so it stays a hard-edged pixel image, not a blur."""
    im = ref_native(name)
    k = WORLD_PX / CROPS[name][2]
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.BOX)
    pal = im.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return small.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB"), round(k, 4)


def zoom(im, z):
    return im.resize((im.width * z, im.height * z), Image.NEAREST)


def sheet(panels, letters, title, gap=10, top=18):
    W = sum(p.width for p in panels) + gap * (len(panels) + 1)
    H = max(p.height for p in panels) + top + gap + 14
    sh = Image.new("RGB", (W, H), SHEET_BG)
    d = ImageDraw.Draw(sh)
    d.text((gap, 2), title, fill=(200, 200, 200))
    x = gap
    base = H - gap
    for p, lab in zip(panels, letters):
        sh.paste(p, (x, base - p.height))          # bottoms aligned: one ground line
        d.text((x, top), lab, fill=(245, 235, 160))
        x += p.width + gap
    return sh


def vstack(ims, gap=8):
    W = max(i.width for i in ims)
    H = sum(i.height for i in ims) + gap * (len(ims) - 1)
    out = Image.new("RGB", (W, H), SHEET_BG)
    y = 0
    for i in ims:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", default="round-1")
    ap.add_argument("--seed", type=int, default=20260929)
    ap.add_argument("--renders", default=os.path.join(BUILD, "renders", "integrated"))
    ap.add_argument("--control", default=os.path.join(BUILD, "renders", "final_v2"))
    ap.add_argument("--control-blend", default=os.path.join(BUILD, "rosace_pre_artistry.blend"),
                    help="the blend the control stills were rendered from (sha256 goes in key.json)")
    ap.add_argument("--control-doc", default="the pre-integration canonical still (rosace_pre_artistry.blend, "
                                             "renders/final_v2)",
                    help="what 'control' is, for key.json's _doc")
    a = ap.parse_args()
    out = os.path.join(REPO, "review", "rosace", "art", "whole", a.round)
    os.makedirs(out, exist_ok=True)

    # shuffle; take the first seed from --seed up whose order moves every slot off its listed place and keeps
    # ours and the control apart (a seed that leaves 'ours' on A beside 'control' on B isn't blind in practice)
    seed = a.seed
    while True:
        order = SLOTS[:]
        random.Random(seed).shuffle(order)
        if all(order[i] != SLOTS[i] for i in range(len(SLOTS))) and \
                abs(order.index("ours") - order.index("control")) > 1:
            break
        seed += 1
    a.seed = seed
    letters = "ABCDEF"
    mapping = {letters[i]: who for i, who in enumerate(order)}

    # freshness (WF-P13): the render's recorded pose sha1 against the pose file today
    fresh = {}
    for tag, s, pose_file, _ in STILLS:
        for px in (144, 80):
            meta = json.load(open(os.path.join(a.renders, s, f"px{px}", "meta.json")))
            now = sha(os.path.join(POSES, pose_file), 12)
            fresh[f"{tag}_{px}"] = {"render_pose_sha1": meta.get("pose_sha1"), "pose_file_sha1": now,
                                    "current": meta.get("pose_sha1") == now}
    stale = [k for k, v in fresh.items() if not v["current"]]
    if stale:
        print("WARNING: stale integrated renders (pose file changed since render):", stale)

    key = {
        "_doc": "Whole-character blind A/B, round %s. One letter mapping on every sheet (WF-P13). 'ours' = the "
                "integrated canonical still (rosace.blend + stills_v2.py chain, renders/integrated), 'control' = "
                "%s, refXX = that "
                "finish-bar ref's crop closest to the still's pose (ref_crops says which crop, and pose_match false "
                "means it is a finish-bar figure only, not the same pose). 144 sheets: refs at their native grid "
                "(137-158 px figures, the same scale as 144). 80 sheets: ours and control at 80 px (the locked "
                "world scale) beside the SAME ref crops resampled so the ref figure is 80 px tall (box filter, then "
                "snapped to the native crop's own 48-colour palette, no dither): an approximation of the ref at "
                "world scale, not a drawing its artist made at that size. Open only after writing the verdicts." % (
                    a.round, a.control_doc),
        "question": "Which one would you pull for? Rank A-F per sheet at x3 and at 1x; at 80, which reads best "
                    "in the world?",
        "seed": a.seed, "letters": mapping,
        "sources": {
            "ours": a.renders, "control": a.control,
            "blend_sha256": sha(os.path.join(BUILD, "rosace.blend"), algo="sha256"),
            "control_blend_sha256": sha(a.control_blend, algo="sha256"),
            "integrated_json_sha1": sha(os.path.join(REPO, "art", "rosace", "integrated.json"), 12),
            "image": "still.png (no contact shadow) cropped to its alpha bbox + 3 px, on backdrop %s" % (BACKDROP,),
            "pose_freshness": fresh,
        },
        "ref_crops": {k: {"file": v[0], "box": v[1], "figure_height_native_px": v[2], "note": v[3]}
                      for k, v in CROPS.items()},
        "sheets": {},
    }

    rows = {144: [], 80: []}
    for tag, s, _, refs in STILLS:
        for px in (144, 80):
            panels, world_k = {}, {}
            panels["ours"] = still(a.renders, s, px)
            panels["control"] = still(a.control, s, px)
            for slot, (crop, _) in refs.items():
                if px == 144:
                    panels[slot] = ref_native(crop)
                else:
                    panels[slot], world_k[slot] = ref_world(crop)
            ims = [panels[mapping[L]] for L in letters]
            for z in (3, 1):
                title = f"{tag}  {px}px  x{z}" + ("  (refs at world scale)" if px == 80 else "  (refs native)")
                sh = sheet([zoom(i, z) for i in ims], list(letters), title)
                name = f"{tag}_px{px}_x{z}.png"
                sh.save(os.path.join(out, name))
                if z == 1:
                    rows[px].append(sh)
                key["sheets"][name] = {
                    L: {"who": mapping[L],
                        **({"ref_crop": refs[mapping[L]][0], "pose_match": refs[mapping[L]][1]}
                           if mapping[L].startswith("ref") else
                           {"still": os.path.join(a.renders if mapping[L] == "ours" else a.control, s,
                                                  f"px{px}", "still.png"),
                            "still_sha1": sha(os.path.join(a.renders if mapping[L] == "ours" else a.control, s,
                                                           f"px{px}", "still.png"), 12)}),
                        **({"world_scale_factor": world_k[mapping[L]]} if mapping[L] in world_k else {})}
                    for L in letters}
    for px in (144, 80):
        vstack(rows[px]).save(os.path.join(out, f"all_px{px}_x1.png"))
    json.dump(key, open(os.path.join(out, "key.json"), "w"), indent=1)
    print("sheets in", out, "| stale:", stale or "none")


if __name__ == "__main__":
    main()
