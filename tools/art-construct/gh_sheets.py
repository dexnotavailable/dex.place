"""Glaive-hands lane, round 1: the review set in review/rosace/art/glaive-hands/round-1/ (git-ignored).

  python tools/art-construct/gh_sheets.py [--seed N] [--round round-1]

Writes
  stills/<still>_<px>.png (+ _x3)           the lane's stills (l3 glaive, lane poses, constructed hands, rose)
  crops/<still>_<px>_glaive_hands_x{1,3,6}  the part: the weapon and the gripping hands
  ab/part_<still>_<ref>_x{3,1}.png          BLIND A/B: our part crop and the matching ref crop, sides from the seed
  ab/pick_<still>_<px>_x{3,1}.png           WF-P11 whole-figure pick: candidates P1..Pn shuffled beside the ref
  key.json                                  which side / letter is which, the seed, the candidate list
Candidates for the pick: control = the canonical stills (renders/final_v2: the shipped glaive, R3 poses, raw
render hands); lane_l2 (the lane's pick); lane_l3 (bigger disc and blade); lane_r4 (the shipped glaive geometry on
the lane poses, hands and rose); lane_l2_raw_hands (the lane without the constructed hands: base.png).
Panels share one background and one zoom; every sheet shows native 1x beside the zoom (PIPELINE 5.2).
"""
import argparse
import json
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
WORK = os.path.join(BUILD, "lanes", "work")
REFS = os.path.join(REPO, "review", "rosace", "_refcrops", "r1")
BG = (96, 96, 104, 255)
STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black"]
REF_FOR = {"idle_hero": ["r09_idle", "r08_idle"], "n1_contact": ["r09_attack", "r07_attack"],
           "q_stamp": ["r08_attack", "r09_attack"], "n2_pivot_black": ["r09_back", "r07_idle"]}
# weapon-and-hands boxes on the ref crops (native px), read off refs_hands_x4.png
REF_PART = {"r07_idle": (0, 0, 128, 150), "r08_idle": (5, 55, 125, 185), "r09_idle": (0, 45, 95, 195),
            "r09_attack": (55, 0, 200, 120), "r07_attack": (0, 20, 170, 200), "r08_attack": (60, 60, 150, 200),
            "r09_back": (0, 0, 145, 195)}
CANDS = {
    "control": lambda s, px: os.path.join(BUILD, "renders", "final_v2", s, f"px{px}", "still.png"),
    "lane_l2": lambda s, px: os.path.join(WORK, "l2_r1", s, f"px{px}", "still.png"),
    "lane_l3": lambda s, px: os.path.join(WORK, "l3_r1", s, f"px{px}", "still.png"),
    "lane_r4": lambda s, px: os.path.join(WORK, "r4_r1", s, f"px{px}", "still.png"),
    "lane_l2_raw_hands": lambda s, px: os.path.join(WORK, "l2_r1", s, f"px{px}", "base.png"),
}

# round 2 (critique 5.5/10): control = the round-1 lane pick (l3_r1); l4_r2 = the round's first pass (short tails, r2
# fists, dark blade); the new lanes l4_r3 / l5_r3 (r3 fists, wrist, 80 px rose, N1 smear, the N1 / N2 pose picks)
CANDS_R2 = {
    "control_l3_r1": lambda s, px: os.path.join(WORK, "l3_r1", s, f"px{px}", "still.png"),
    "l4_r2_fists": lambda s, px: os.path.join(WORK, "l4_r2", s, f"px{px}", "still.png"),
    "l4_r3": lambda s, px: os.path.join(WORK, "l4_r3", s, f"px{px}", "still.png"),
    "l5_r3": lambda s, px: os.path.join(WORK, "l5_r3", s, f"px{px}", "still.png"),
}


def flat(im):
    b = Image.new("RGBA", im.size, BG)
    b.alpha_composite(im.convert("RGBA"))
    return b


def z(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def row(panels, labels, gap=10, top=16, foot=None):
    W = sum(p.width for p in panels) + gap * (len(panels) + 1)
    H = max(p.height for p in panels) + top + gap + (14 if foot else 0)
    sh = Image.new("RGBA", (W, H), (34, 34, 40, 255))
    d = ImageDraw.Draw(sh)
    x = gap
    for p, lab in zip(panels, labels):
        sh.paste(p, (x, top + (H - top - gap - (14 if foot else 0) - p.height)))   # bottoms aligned (ground line)
        d.text((x, 2), lab, fill=(235, 235, 235))
        x += p.width + gap
    if foot:
        d.text((gap, H - 14), foot, fill=(170, 170, 170))
    return sh


def part_box(still_dir, pad=4):
    """the weapon and the gripping hands on a lane still: haft line bbox + hand bboxes"""
    lm = json.load(open(os.path.join(still_dir, "landmarks.json")))
    hj = json.load(open(os.path.join(still_dir, "hands.json")))
    xs = [lm["haft"]["butt"][0], lm["haft"]["tip"][0], lm["haft"]["disc"][0]]
    ys = [lm["haft"]["butt"][1], lm["haft"]["tip"][1], lm["haft"]["disc"][1]]
    for h in hj["hands"]:
        x0, y0, x1, y1 = h["bbox"]
        xs += [x0, x1]
        ys += [y0, y1]
    im = Image.open(os.path.join(still_dir, "still.png"))
    # round 2: everything the lane painted (hands, haft repaint, rose, blade pass, the N1 smear) is part of the part
    lay = os.path.join(still_dir, "hands_layer.png")
    if os.path.exists(lay):
        bb = Image.open(lay).getchannel("A").getbbox()
        if bb:
            xs += [bb[0], bb[2] - 1]
            ys += [bb[1], bb[3] - 1]
    return (max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad), min(im.width, int(max(xs)) + pad + 1),
            min(im.height, int(max(ys)) + pad + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--round", default="round-1")
    ap.add_argument("--lane", default="l3_r1", help="the lane pick whose stills and crops go on the sheets")
    a = ap.parse_args()
    cands = CANDS_R2 if a.round == "round-2" else CANDS
    seed = a.seed if a.seed is not None else random.SystemRandom().randrange(1 << 30)
    rng = random.Random(seed)
    out = os.path.join(REPO, "review", "rosace", "art", "glaive-hands", a.round)
    for sub in ("stills", "crops", "ab"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    key = {"_doc": f"glaive-hands {a.round} blind sheets: A/B sides and pick letters. Open only after judging.",
           "seed": seed, "reproduce": f"python tools/art-construct/gh_sheets.py --round {a.round} --lane {a.lane} --seed {seed}",
           "lane": a.lane, "part": {}, "pick": {},
           "candidates": {k: v("<still>", "<px>") for k, v in cands.items()}}
    lane = os.path.join(WORK, a.lane)
    for s in STILLS:
        for px in (144, 80):
            sd = os.path.join(lane, s, f"px{px}")
            im = Image.open(os.path.join(sd, "still.png"))
            im.save(os.path.join(out, "stills", f"{s}_{px}.png"))
            z(flat(im), 3).save(os.path.join(out, "stills", f"{s}_{px}_x3.png"))
            box = part_box(sd)
            c = flat(im.crop(box))
            for k in (1, 3, 6):
                z(c, k).save(os.path.join(out, "crops", f"{s}_{px}_glaive_hands_x{k}.png"))
            # hands only: each fist's bbox + 3 px
            hj = json.load(open(os.path.join(sd, "hands.json")))
            for h in hj["hands"]:
                x0, y0, x1, y1 = h["bbox"]
                pad = 3 if px == 144 else 2
                hc = flat(im.crop((max(0, x0 - pad), max(0, y0 - pad), x1 + pad + 1, y1 + pad + 1)))
                for k in (1, 6, 12):
                    z(hc, k).save(os.path.join(out, "crops", f"{s}_{px}_hand_{h['side']}_x{k}.png"))
            # blind part A/B against each matching ref (at 80 the ref is scaled 80/144, nearest, and labelled so)
            if px in (144, 80):
                for ref in REF_FOR[s]:
                    r = flat(Image.open(os.path.join(REFS, ref + ".png")).crop(REF_PART[ref]))
                    if px == 80:
                        r = r.resize((max(1, int(r.width * 80 / 144)), max(1, int(r.height * 80 / 144))), Image.NEAREST)
                    ours_left = rng.random() < 0.5
                    pan = [c, r] if ours_left else [r, c]
                    for k in (3, 1):
                        row([z(p, k) for p in pan], ["A", "B"],
                            foot=f"{px} px x{k}  which weapon-and-hands would you pull for?" if k == 3 else None
                            ).save(os.path.join(out, "ab", f"part_{s}_{px}_{ref}_x{k}.png"))
                    key["part"][f"{s}_{px}_{ref}"] = {"ours": "A" if ours_left else "B", "ref": ref, "ours_box": box,
                                                      "ref_box": REF_PART[ref], "ref_scale": 1.0 if px == 144 else 80 / 144}
            # WF-P11 whole-figure pick: candidates shuffled, the ref last
            names = [n for n in cands if os.path.exists(cands[n](s, px))]
            rng.shuffle(names)
            ims = [flat(Image.open(cands[n](s, px))) for n in names]
            ref = REF_FOR[s][0]
            rim = flat(Image.open(os.path.join(REFS, ref + ".png")))
            if px == 80:
                rim = rim.resize((max(1, int(rim.width * 80 / 144)), max(1, int(rim.height * 80 / 144))), Image.NEAREST)
            labels = [f"P{i + 1}" for i in range(len(names))] + [f"ref {ref}" + (" (80/144, nearest)" if px == 80 else "")]
            for k in (3, 1):
                row([z(p, k) for p in ims + [rim]], labels,
                    foot=f"{s} {px} px x{k}: which one would you pull for?" if k == 3 else None
                    ).save(os.path.join(out, "ab", f"pick_{s}_{px}_x{k}.png"))
            key["pick"][f"{s}_{px}"] = {f"P{i + 1}": n for i, n in enumerate(names)}
    json.dump(key, open(os.path.join(out, "key.json"), "w"), indent=1)
    print(out, "seed", seed)


if __name__ == "__main__":
    main()
