"""Drive 9 whole-character blind round: the drive-9 combined stills beside the finish-bar refs 07, 08, 09 and 04 and
the current build as the control, idle / N1 contact / Q stamp / back, at 144 (refs at their native grid) and at 80
(refs resampled to world scale, WF-P15, plus ref 05 drawn at about our size, WF-P18). Builds nothing, renders nothing.

  python tools/pixel-pipeline/drive9/d9_round.py [--round round-1] [--seed 20261201]
      [--raw <build>/lanes/drive9/raw/H110] [--tag D1] [--prev-raw <raw> --prev-tag <tag>] [--confounds <json>]

--prev-raw adds the previous round's drive-9 stills as one more blind slot, 'prev' (round 2: round 1's stills), so
the critics can say whether the round moved; the shuffle then keeps ours, prev and the control apart from each other.
--confounds replaces the confound list with the json's 'confounds' (a round's own list).

Writes review/rosace/art/drive9/<round>/ (git-ignored: the refs are third-party and never committed):
  <shot>_px144_x3.png, _x1.png   ours and the control beside refs 07/08/09/04 native (137-158 px figures)
  <shot>_px80_x3.png, _x1.png    the 80 px world stills beside the same crops box-resampled to an 80 px figure and
                                 snapped to the crop's own 48-colour palette (whole_sheets.ref_world), and ref 05 at
                                 its own 1x (a sprite drawn at world size, about 100 px), the frame closest to the pose
  all_px144_x1.png, all_px80_x1.png   every sheet of that size stacked (same letters)
  diag_codec_idle_px144_x3.png   WF-P16's once-per-round diagnostic: ours and the control through a WebP q90 round
                                 trip like the refs' source files; never counts as progress
  key.json                       letters, the seed actually used, sources with hashes, pose freshness, ref crops,
                                 world factors, confounds
  verdicts/TEMPLATE.json         one critic's per-parameter form (WF-P16: each critic's form is saved here)

One letter mapping A-G for every sheet (WF-P13). The 144 sheets show six letters (ref 05's letter is absent: it is
not drawn at close-up size). The shuffle (WF-P15) moves every entry off its listed place and keeps ours and the
control apart; the first seed from --seed up that does both is used and recorded.
"""
import argparse
import hashlib
import io
import json
import os
import random
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
import whole_sheets as WS  # noqa: E402
sys.path.insert(0, HERE)
import d9_view as DV  # noqa: E402

BUILD = WS.BUILD
POSES = os.path.join(REPO, "art", "rosace", "poses")
REF05 = os.path.join(WS.NATIVE, "05-anim-sailormars-sheet_1x.png")
# shot: (still tag, pose file, per-slot (crop, pose_match) as whole_sheets rounds 1-2, ref 05 box + note)
SHOTS = {
    "idle": ("idle", "idle_appeal.json",
             {"ref07": ("07_idle", True), "ref08": ("08_idle", True), "ref09": ("09_idle", True),
              "ref04": ("04_c", True)},
             ((672, 0, 707, 118), "row 1, hand-on-hip three-quarter front")),
    "n1": ("n1_contact", "n1_contact.json",
           {"ref07": ("07_attack", True), "ref08": ("08_attack", True), "ref09": ("09_attack", True),
            "ref04": ("04_l", False)},
           ((324, 118, 383, 222), "row 2, arm-thrust strike")),
    "q": ("q_stamp", "q_stamp.json",
          {"ref07": ("07_attack", False), "ref08": ("08_attack", True), "ref09": ("09_raise", True),
           "ref04": ("04_r", False)},
          ((391, 118, 447, 222), "row 2, strike follow-through")),
    "back": ("back", "back_appeal.json",
             {"ref07": ("07_idle", False), "ref08": ("08_idle", False), "ref09": ("09_raise", True),
              "ref04": ("04_c", False)},
             ((8, 0, 45, 118), "row 1 frame 1, three-quarter from behind")),
}
SLOTS = ["ours", "control", "ref07", "ref08", "ref09", "ref04", "ref05"]
LETTERS = "ABCDEFG"
CONFOUNDS = [
    "ours (drive 9) is route F1's render-to-pixels chain, so the integrated chain's pixel passes are not in it: the "
    "constructed hands and weapon (N1's glass blade crescent), the outfit glyphs and windows (the tabard's gold "
    "crosses) and the collar cross. The control carries them.",
    "The control's idle, N1 and back are run_f3.py's control (the integrated build and stills chain, no route "
    "overrides) in the same pose files; its Q is the integrated canonical still (same q_stamp.json). Ours has the "
    "head x1.10, so its body renders about 1.5% smaller at the same H.",
    "The back view still stamps a two-eye front face on ours (the back glance face is not built).",
    "The 80 px refs 07/08/09/04 are box-resampled and palette-snapped (WF-P15): an approximation of the ref at world "
    "scale, not a drawing. Ref 05 is a native sprite at its own 1x (about 100 px, a little over our 80), JPEG-sourced, "
    "white ground keyed out; an 'ours reads better at 80' call counts only if it holds against ref 05 (WF-P18).",
    "07/08/09 are lossy WebP sources; the diag_codec sheet puts ours and the control through the same kind of round "
    "trip (WF-P16) and does not count as progress.",
    "The 144 sheets have six panels; ref 05's letter only appears on the 80 sheets.",
]


def sha(path, n=12, algo="sha1"):
    h = hashlib.new(algo, open(path, "rb").read()).hexdigest()
    return h[:n] if n else h


def crop(im, pad=3):
    b = im.getchannel("A").getbbox()
    return im.crop((max(0, b[0] - pad), max(0, b[1] - pad), min(im.width, b[2] + pad), min(im.height, b[3] + pad)))


def ours_path(raw, tag, shot, px):
    return os.path.join(raw, shot, f"px{px}", tag, "still_ground.png")


def control_dir(shot, px):
    if shot == "q":
        return os.path.join(BUILD, "renders", "integrated", "q_stamp", f"px{px}")
    return os.path.join(BUILD, "renders", "finish-F3", "control", shot, f"px{px}")


def ref05(box):
    """ref 05 at its own 1x inside a sheet box, trimmed; ground keyed by d9_view.key_white (border flood fill, so
    her white suit and highlights stay inside the figure)"""
    a = np.asarray(Image.open(REF05).convert("RGB"))[box[1]:box[3], box[0]:box[2]].astype(int)
    fg = DV.key_white(a)
    im = Image.fromarray(np.dstack([a, np.where(fg, 255, 0)]).astype(np.uint8), "RGBA")
    return crop(im, 2)


def webp_rt(im, q=90):
    b = io.BytesIO()
    im.convert("RGB").save(b, "WEBP", quality=q)
    return Image.open(io.BytesIO(b.getvalue())).convert("RGB")


def shuffle(seed, slots=None):
    slots = slots or SLOTS
    ours = [x for x in ("ours", "control", "prev") if x in slots]
    while True:
        o = slots[:]
        random.Random(seed).shuffle(o)
        if all(o[i] != slots[i] for i in range(len(slots))) and \
                all(abs(o.index(p) - o.index(q)) > 1 for i, p in enumerate(ours) for q in ours[i + 1:]):
            return o, seed
        seed += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", default="round-1")
    ap.add_argument("--seed", type=int, default=20261201)
    ap.add_argument("--raw", default=os.path.join(BUILD, "lanes", "drive9", "raw", "H110"))
    ap.add_argument("--tag", default="D1")
    ap.add_argument("--prev-raw", default=None)
    ap.add_argument("--prev-tag", default="D1")
    ap.add_argument("--confounds", default=None)
    ap.add_argument("--files", default=None, help="comma list of this round's finish/face/post files (next to this "
                                                   "script or absolute), recorded in key.json by sha1")
    a = ap.parse_args()
    out = os.path.join(REPO, "review", "rosace", "art", "drive9", a.round)
    os.makedirs(os.path.join(out, "verdicts"), exist_ok=True)
    slots = SLOTS + (["prev"] if a.prev_raw else [])
    letters_all = "ABCDEFGH"[:len(slots)]
    order, seed = shuffle(a.seed, slots)
    mapping = {letters_all[i]: who for i, who in enumerate(order)}
    confounds = json.load(open(a.confounds, encoding="utf-8"))["confounds"] if a.confounds else CONFOUNDS
    inv = {v: k for k, v in mapping.items()}

    rend = json.load(open(os.path.join(a.raw, "_render.json")))
    d9_blend = rend["blend"]
    fresh = {}
    for shot, (_, pose_file, _, _) in SHOTS.items():
        now = sha(os.path.join(POSES, pose_file))
        cm = json.load(open(os.path.join(control_dir(shot, 144), "meta.json")))
        fresh[shot] = {"pose_file": pose_file, "pose_file_sha1_now": now,
                       "ours_render_pose_sha1": rend["shots"][shot]["pose_sha1"],
                       "control_render_pose_sha1": cm.get("pose_sha1"),
                       "current": rend["shots"][shot]["pose_sha1"] == now == cm.get("pose_sha1")}
    stale = [k for k, v in fresh.items() if not v["current"]]

    key = {
        "_doc": "Drive 9 whole-character blind round %s. One letter mapping on every sheet (WF-P13). 'ours' = the "
                "drive-9 combined build (lanes/drive9.blend, d9_blender.py passes, d9_post.py finish; PIPELINE 3.6l), "
                "'control' = the current integrated build and stills chain in the same poses, refXX = that "
                "finish-bar ref's crop closest to the shot's pose (pose_match false = a finish-bar figure only). "
                "144 sheets: refs at their native grid. 80 sheets: refs 07/08/09/04 resampled to an 80 px figure "
                "(WF-P15) and ref 05 at its own 1x (WF-P18). Open only after writing the verdicts." % a.round,
        "question": "Per sheet, rank the panels and say, per look parameter (CRITIQUE-PARAMS 1-18 and 31), whether "
                    "each non-ref panel is ref-level, and the concrete gap and fix. At 144: which reads closest to the "
                    "refs' finish, face, mass and pose appeal? At 80: which reads best in the world, checked against "
                    "the native small sprite before calling ours better?",
        "seed": seed, "seed_requested": a.seed, "letters": mapping,
        "sources": {
            "ours": os.path.join(a.raw, "<shot>", "px<N>", a.tag, "still_ground.png"),
            "control": "renders/finish-F3/control/<shot> (idle, n1, back) and renders/integrated/q_stamp (q), "
                       "still_ground.png",
            "drive9_blend": d9_blend, "drive9_blend_sha256": sha(d9_blend, None, "sha256"),
            "drive9_blend_sha256_at_render": rend["blend_sha256"],
            "rosace_blend_sha256": sha(os.path.join(BUILD, "rosace.blend"), None, "sha256"),
            "drive9_json_sha1": sha(os.path.join(REPO, "art", "rosace", "drive9.json")),
            "d9_finish_json_sha1": sha(os.path.join(HERE, "d9_finish.json")),
            "shape_json_current": json.load(open(os.path.join(REPO, "art", "rosace", "figure", "shape.json")))
            .get("current"),
            "head": rend.get("head"), "drape": rend.get("drape"),
            "r2": rend.get("r2"),
            "round_files": {f: sha(f if os.path.isabs(f) else os.path.join(HERE, f))
                            for f in (a.files.split(",") if a.files else [])},
            "prev": (os.path.join(a.prev_raw, "<shot>", "px<N>", a.prev_tag, "still_ground.png") if a.prev_raw else None),
            "image": "still_ground.png (the chain's contact shadow, WF-P16) cropped to its alpha bbox + 3 px, on "
                     "backdrop %s; refs keep their painted ground" % (WS.BACKDROP,),
            "pose_freshness": fresh,
        },
        "ref_crops": {k: {"file": v[0], "box": v[1], "figure_height_native_px": v[2], "note": v[3]}
                      for k, v in WS.CROPS.items()},
        "ref05": {"file": os.path.basename(REF05),
                  "boxes": {s: {"box": v[3][0], "note": v[3][1]} for s, v in SHOTS.items()}},
        "confounds": confounds,
        "sheets": {},
    }

    if a.prev_raw:
        key["_doc"] += (" 'prev' = the previous round's drive-9 stills (%s, tag %s), so the critics can judge whether "
                        "this round moved." % (a.prev_raw, a.prev_tag))
    rows = {144: [], 80: []}
    for shot, (tag, _, refs, (box05, _)) in SHOTS.items():
        for px in (144, 80):
            panels, info = {}, {}
            p = ours_path(a.raw, a.tag, shot, px)
            panels["ours"] = WS.on_bg(crop(Image.open(p).convert("RGBA")))
            info["ours"] = {"still": p, "still_sha1": sha(p)}
            p = os.path.join(control_dir(shot, px), "still_ground.png")
            panels["control"] = WS.on_bg(crop(Image.open(p).convert("RGBA")))
            info["control"] = {"still": p, "still_sha1": sha(p)}
            if a.prev_raw:
                p = ours_path(a.prev_raw, a.prev_tag, shot, px)
                panels["prev"] = WS.on_bg(crop(Image.open(p).convert("RGBA")))
                info["prev"] = {"still": p, "still_sha1": sha(p)}
            for slot, (c, match) in refs.items():
                if px == 144:
                    panels[slot] = WS.ref_native(c)
                    info[slot] = {"ref_crop": c, "pose_match": match, "scale": "native 1x"}
                else:
                    panels[slot], k = WS.ref_world(c)
                    info[slot] = {"ref_crop": c, "pose_match": match, "world_scale_factor": k}
            if px == 80:
                panels["ref05"] = WS.on_bg(ref05(box05))
                info["ref05"] = {"box": box05, "scale": "native 1x", "figure_px": panels["ref05"].height - 4}
            letters = [L for L in letters_all if mapping[L] in panels]
            ims = [panels[mapping[L]] for L in letters]
            for z in (3, 1):
                title = f"{shot}  {px}px  x{z}" + ("  (refs at world scale)" if px == 80 else "  (refs native)")
                sh = WS.sheet([WS.zoom(i, z) for i in ims], letters, title)
                name = f"{shot}_px{px}_x{z}.png"
                sh.save(os.path.join(out, name))
                if z == 1:
                    rows[px].append(sh)
                key["sheets"][name] = {L: dict(who=mapping[L], **info[mapping[L]]) for L in letters}
            if shot == "idle" and px == 144:
                diag = dict(panels)
                for w_ in ("ours", "control", "prev"):
                    if w_ in diag:
                        diag[w_] = webp_rt(panels[w_])
                sh = WS.sheet([WS.zoom(diag[mapping[L]], 3) for L in letters], letters,
                              "DIAGNOSTIC (codec): idle 144px x3, every panel as lossy as the refs' WebP sources")
                sh.save(os.path.join(out, "diag_codec_idle_px144_x3.png"))
                key["sheets"]["diag_codec_idle_px144_x3.png"] = {
                    "_doc": "WF-P16: ours, control (and prev) through WebP q90 (refs unchanged). Diagnostic only.",
                    **{L: mapping[L] for L in letters}}
    for px in (144, 80):
        WS.vstack(rows[px]).save(os.path.join(out, f"all_px{px}_x1.png"))
    json.dump(key, open(os.path.join(out, "key.json"), "w"), indent=1)

    params = ["1 first impression", "2 face", "3 attractiveness", "4 head and hair", "5 body and proportions",
              "6 arms and hands", "7 weapon", "8 grip", "9 posture", "10 posing", "11 stylisation", "12 sex appeal",
              "13 outfit", "14 materials and shading", "15 palette and value", "16 pixel craft", "17 rim light",
              "18 originality", "31 donation test"]
    tpl = {"_doc": "One critic's form for drive-9 round %s (WF-P16). Fill it from the sheets alone, save it as "
                   "verdicts/<critic>.json, and only then open key.json. Score 1-10 where the refs' finish bar is 9; "
                   "per parameter, name the letter you judge and give the gap and the fix." % a.round,
           "critic": "", "opened_key_before_verdict": False,
           "sheets": {n: {"rank_best_to_worst": [], "notes": ""} for n in key["sheets"] if not n.startswith("diag")},
           "per_letter": {L: {"overall_1_10": None, "params": {q: {"score_1_10": None, "gap": "", "fix": ""}
                                                              for q in params}} for L in letters_all},
           "codec_diagnostic": {"did_the_codec_sheet_change_your_finish_read": None, "notes": ""}}
    json.dump(tpl, open(os.path.join(out, "verdicts", "TEMPLATE.json"), "w"), indent=1)
    print("sheets in", out, "| seed", seed, "| stale:", stale or "none")


if __name__ == "__main__":
    main()
