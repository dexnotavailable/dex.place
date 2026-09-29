"""Blind A/B/C comparison of one move: raw-generated vs retimed+pushed vs the hand-keyed spike.

  python tools/motion-ai/ab_compose.py n1 [n5 ...]
  python tools/motion-ai/ab_compose.py --round2 n1 n5     # round-1 retimed vs round 2 vs spike
  python tools/motion-ai/ab_compose.py --round3 n1 n5     # round 2 (on the round-3 model) vs round 3 vs spike
  python tools/motion-ai/ab_compose.py --round3b n1 n5    # round 2 vs round 3b vs spike -> review/motion/r3/round-2/
  python tools/motion-ai/ab_compose.py --round3c n1 n5    # round 2 vs round 3c vs spike -> review/motion/r3/round-3/
      -> review/motion/r3/round-1/ + key.json (a different letter order per move)
      -> review/motion/r2/round-1/ (same files; key.json there)

Reads the post-processed pixel frames:
  raw       D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders/<move>_raw/px144/sprite_####.png
  retimed   D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders/<move>/px144/sprite_####.png
  spike     review/motion/ab/_c_spike/out/final_####.png   (blender_spike.py --px 144 --ss 4,
            postprocess.py --no-vfx: the stand-in priestess and her hand-keyed 24-frame sweep)
and writes to review/motion/ab/:
  <move>_abc_1x.gif, <move>_abc_3x.gif   side by side, feet on one line, labels A/B/C only
  <move>_abc_3x.mp4                      the same at an exact 60 fps (GIF can't: see key.json)
  <move>_abc_sheet.png                   one row per clip, every frame (N5: every 2nd), 1x
  <move>_abc_sheet_x2.png                the frames where the retimed clip changes drawing, 2x
  key.json                               which letter is which, per move (shuffled per move)
Each clip plays once and holds its last frame, then all three restart together.
"""
import json
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REN = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\renders")
OUT = REPO / "review" / "motion" / "ab"
SPIKE = OUT / "_c_spike"
BG = (46, 46, 58, 255)
TAIL = 18                      # frames every clip holds its last frame before the loop restarts
FFMPEG = "ffmpeg"


def rosace_clip(name, px=144):
    d = REN / name / f"px{px}"
    meta = json.loads((d / "meta.json").read_text())
    sample = meta["motion"]["sample_frame"]
    cache = {}
    frames = []
    for s in sample:
        if s not in cache:
            cache[s] = Image.open(d / f"sprite_{s:04d}.png").convert("RGBA")
        frames.append(cache[s])
    return {"frames": frames, "anchor": tuple(meta["anchor"]), "sample": sample,
            "root_motion_px": meta["motion"]["root_motion_total_px"], "meta": str(d / "meta.json")}


def spike_clip():
    meta = json.loads((SPIKE / "meta_px144_ss4.json").read_text())
    W, H = meta["canvas"]
    frames = [Image.open(SPIKE / "out" / f"final_{f:04d}.png").convert("RGBA") for f in meta["frames"]]
    # blender_spike.py puts her feet at (0.47, 0.90) of the canvas (ROOT_PX)
    return {"frames": frames, "anchor": (round(0.47 * W), round(0.90 * H)), "sample": list(range(len(frames))),
            "root_motion_px": None, "meta": str(SPIKE / "meta_px144_ss4.json")}


def layout(clips):
    """common panel: every clip's anchor on the same pixel, cropped to what any frame uses"""
    boxes = []
    for c in clips:
        ax, ay = c["anchor"]
        bb = None
        for im in {id(x): x for x in c["frames"]}.values():
            b = im.getbbox()
            if b:
                b = (b[0] - ax, b[1] - ay, b[2] - ax, b[3] - ay)
                bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
        boxes.append(bb)
    x0 = min(b[0] for b in boxes) - 4
    y0 = min(b[1] for b in boxes) - 14
    x1 = max(b[2] for b in boxes) + 4
    y1 = max(b[3] for b in boxes) + 4
    return x0, y0, x1, y1


def panel(im, anchor, box, letter=None, sub=None):
    x0, y0, x1, y1 = box
    out = Image.new("RGBA", (x1 - x0, y1 - y0), BG)
    ax, ay = anchor
    # paste im so that its anchor lands at (-x0, -y0)
    ox, oy = -x0 - ax, -y0 - ay
    src = im.crop((max(0, -ox), max(0, -oy), min(im.width, out.width - ox), min(im.height, out.height - oy)))
    out.alpha_composite(src, (max(0, ox), max(0, oy)))
    d = ImageDraw.Draw(out)
    d.line([(0, -y0), (out.width, -y0)], fill=(74, 74, 92, 255))        # the floor line under her feet
    if letter:
        d.text((3, 1), letter, fill=(255, 240, 170, 255))
    if sub:
        d.text((14, 1), sub, fill=(170, 170, 190, 255))
    return out


def compose(move, seed=None, clips=None, out=None, ref="retimed"):
    global OUT
    if out is not None:
        OUT = out
    clips = clips or {"raw": rosace_clip(f"{move}_raw"), "retimed": rosace_clip(move), "spike": spike_clip()}
    order = list(clips)
    rnd = random.Random(seed if seed is not None else f"dexplace-{move}")
    rnd.shuffle(order)
    letters = dict(zip("ABC", order))
    cl = [clips[letters[k]] for k in "ABC"]
    box = layout(cl)
    n = max(len(c["frames"]) for c in cl) + TAIL
    seq = []
    for f in range(n):
        tiles = []
        for L, c in zip("ABC", cl):
            fr = c["frames"][min(f, len(c["frames"]) - 1)]
            tiles.append(panel(fr, c["anchor"], box, L))
        w, h = tiles[0].size
        im = Image.new("RGBA", (w * 3 + 4, h), (30, 30, 38, 255))
        for i, t in enumerate(tiles):
            im.alpha_composite(t, (i * (w + 2), 0))
        seq.append(im.convert("RGB"))
    OUT.mkdir(parents=True, exist_ok=True)
    for z in (1, 3):
        fr = [s.resize((s.width * z, s.height * z), Image.NEAREST) for s in seq]
        pal = [f.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in fr]
        pal[0].save(OUT / f"{move}_abc_{z}x.gif", save_all=True, append_images=pal[1:], duration=20, loop=0,
                    disposal=1, optimize=False)
    # exact 60 fps MP4 at 3x
    tmp = OUT / "_mp4" / move
    tmp.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(seq):
        s.resize((s.width * 3, s.height * 3), Image.NEAREST).save(tmp / f"{i:04d}.png")
    w3, h3 = seq[0].width * 3, seq[0].height * 3
    pad = f"pad={w3 + (w3 % 2)}:{h3 + (h3 % 2)}"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-framerate", "60", "-i", str(tmp / "%04d.png"),
                    "-vf", pad, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12",
                    str(OUT / f"{move}_abc_3x.mp4")], check=True)
    for p in tmp.glob("*.png"):
        p.unlink()
    tmp.rmdir()
    if not any(tmp.parent.iterdir()):
        tmp.parent.rmdir()
    # contact sheets
    step = 1 if n - TAIL <= 40 else 2
    idx = list(range(0, n - TAIL, step))
    w, h = panel(cl[0]["frames"][0], cl[0]["anchor"], box).size
    sheet = Image.new("RGBA", (w * len(idx), (h + 10) * 3), (30, 30, 38, 255))
    d = ImageDraw.Draw(sheet)
    for r, (L, c) in enumerate(zip("ABC", cl)):
        for i, f in enumerate(idx):
            fr = c["frames"][min(f, len(c["frames"]) - 1)]
            sheet.alpha_composite(panel(fr, c["anchor"], box, L if i == 0 else None), (i * w, r * (h + 10) + 10))
            if r == 0:
                d.text((i * w + 2, 0), f"f{f}", fill=(220, 220, 150, 255))
    sheet.save(OUT / f"{move}_abc_sheet.png")
    # 2x sheet at the frames where the retimed clip shows a new drawing
    rt = clips[ref]["sample"]
    starts = [f for f in range(len(rt)) if f == 0 or rt[f] != rt[f - 1]]
    sheet2 = Image.new("RGBA", (w * len(starts), (h + 10) * 3), (30, 30, 38, 255))
    d = ImageDraw.Draw(sheet2)
    for r, (L, c) in enumerate(zip("ABC", cl)):
        for i, f in enumerate(starts):
            fr = c["frames"][min(f, len(c["frames"]) - 1)]
            sheet2.alpha_composite(panel(fr, c["anchor"], box, L if i == 0 else None), (i * w, r * (h + 10) + 10))
            if r == 0:
                d.text((i * w + 2, 0), f"f{f}", fill=(220, 220, 150, 255))
    sheet2 = sheet2.resize((sheet2.width * 2, sheet2.height * 2), Image.NEAREST)
    sheet2.save(OUT / f"{move}_abc_sheet_x2.png")
    return letters, {k: clips[k] for k in clips}, starts


def main_round2(moves):
    """round 2 (hero keys + spring cloth): r1 = round-1 retimed, r2 = this round, spike"""
    out = REPO / "review" / "motion" / "r2" / "round-1"
    out.mkdir(parents=True, exist_ok=True)
    keyp = out / "key.json"
    key = {"_about": ("Blind A/B/C per move, round 2 of the motion route. r1 = round-1 retimed clip "
                      "(tools/motion-ai/timing/<move>.json, AI poses, pushes 1.15-1.4). r2 = this round: hand-posed "
                      "hero keys on Rosace's rig (art/rosace/poses/motion/), AI only for in-betweens and weight "
                      "shifts, pushes 1.6-2.0, re-picked drawings, spring cloth with cloth-only redraws on holds "
                      "(tools/motion-ai/timing/<move>_r2.json). spike = the stand-in priestess's hand-keyed "
                      "24-frame sweep (a different model and move: a feel reference only), VFX off. No smears or "
                      "VFX on any clip. GIFs play at 50 fps (20 ms per game frame); the MP4 is exact 60 fps. "
                      "Every clip holds its last frame for 18 frames before the loop. Shuffle seed "
                      "'20260929-r2-<move>'."), "seed": "20260929-r2-<move>"}
    for m in moves:
        clips = {"r1": rosace_clip(m), "r2": rosace_clip(f"{m}_r2"), "spike": spike_clip()}
        letters, cl, starts = compose(m, seed=f"20260929-r2-{m}", clips=clips, out=out, ref="r2")
        key[m] = {L: letters[L] for L in "ABC"}
        key[m]["_sources"] = {k: cl[k]["meta"] for k in cl}
        key[m]["_r2_new_image_frames"] = starts
        print(m, key[m]["A"], key[m]["B"], key[m]["C"])
    keyp.write_text(json.dumps(key, indent=1))


def main_round3(moves, rnd_name="round-1"):
    """round 3: r2 (the round-2 sheet re-rendered on the round-3 model) / r3 / spike, a different letter
    order per move (round 2 used the same order for both moves, which let a critic carry a guess over)"""
    out = REPO / "review" / "motion" / "r3" / rnd_name
    out.mkdir(parents=True, exist_ok=True)
    key = {"_about": ("Blind A/B/C per move, round 3 of the motion route. r2 = the round-2 sheet "
                      "(tools/motion-ai/timing/<move>_r2.json) re-rendered unchanged on the round-3 model snapshot, so "
                      "the letters compare motion, not model edits. r3 = this round (tools/motion-ai/timing/<move>_r3.json): "
                      "the round-2 critics' six fixes, with tracked blade smears on the strike drawings (tools/motion-ai/"
                      "smear.py; N1 S1, N5 S1-S3). spike = the stand-in priestess's hand-keyed 24-frame sweep (a different "
                      "model and move: a feel reference), VFX off. r2 has no smears; neither Rosace clip has the "
                      "stained-glass VFX (panes, furrow, leading, shards). GIFs play at 50 fps (20 ms per game frame); "
                      "the MP4 is exact 60 fps. Every clip holds its last frame for 18 frames before the loop. Letter "
                      "order differs per move. Open this file and _metrics.json only after writing the verdicts.")}
    used = set()
    for m in moves:
        clips = {"r2": rosace_clip(f"{m}_r2m"), "r3": rosace_clip(f"{m}_r3"), "spike": spike_clip()}
        k = 0
        while True:                      # no letter means the same clip as in any earlier move
            seed = f"20260929-r3-{m}-{k}"
            order = list(clips)
            random.Random(seed).shuffle(order)
            if all(all(a != b for a, b in zip(order, u)) for u in used):
                break
            k += 1
        used.add(tuple(order))
        letters, cl, starts = compose(m, seed=seed, clips=clips, out=out, ref="r3")
        key[m] = {L: letters[L] for L in "ABC"}
        key[m]["seed"] = seed
        key[m]["_sources"] = {k2: cl[k2]["meta"] for k2 in cl}
        key[m]["_r3_new_image_frames"] = starts
        print(m, key[m]["A"], key[m]["B"], key[m]["C"])
    (out / "key.json").write_text(json.dumps(key, indent=1))


def main_round3b(moves, rnd_name="round-2"):
    """round 3b (r3 critique round 2): r2 (the round-2 sheet on the same model) / r3b (this round) / spike.
    Each move gets a different letter order from the other move AND from its own round-1 order, so no letter
    carries a guess over from either."""
    out = REPO / "review" / "motion" / "r3" / rnd_name
    out.mkdir(parents=True, exist_ok=True)
    prev = {"n1": ("r2", "spike", "r3b"), "n5": ("r3b", "r2", "spike")}     # round-1 orders (r3 there = this lineage)
    key = {"_about": ("Blind A/B/C per move, round 3b (the r3 critics' round-2 fixes). r2 = the round-2 sheet "
                      "(tools/motion-ai/timing/<move>_r2.json) rendered unchanged on the same model (byte-identical "
                      "snapshot), so the letters compare motion, not model edits. r3b = this round "
                      "(tools/motion-ai/timing/<move>_r3b.json; smear_v2.py smears on N1 S1 and N5 S1-S3, plus N5's "
                      "fading ellipse on C1/C1b, MOVESET's f27-37 main arc). spike = the stand-in priestess's hand-keyed "
                      "24-frame sweep (a different model and move: a feel reference), VFX off. Neither Rosace clip has "
                      "the stained-glass VFX (panes, furrow, leading, shards, saint, ring). GIFs play at 50 fps (20 ms per "
                      "game frame); the MP4 is exact 60 fps. Every clip holds its last frame for 18 frames before the "
                      "loop. Letter order differs per move and from round 1. Open this file and _metrics.json only "
                      "after writing the verdicts.")}
    used = []
    for m in moves:
        clips = {"r2": rosace_clip(f"{m}_r2m"), "r3b": rosace_clip(f"{m}_r3b"), "spike": spike_clip()}
        k = 0
        while True:
            seed = f"20260929-r3b-{m}-{k}"
            order = list(clips)
            random.Random(seed).shuffle(order)
            ok = all(x != y for x, y in zip(order, prev[m])) and all(all(x != y for x, y in zip(order, u)) for u in used)
            if ok:
                break
            k += 1
        used.append(tuple(order))
        letters, cl, starts = compose(m, seed=seed, clips=clips, out=out, ref="r3b")
        key[m] = {L: letters[L] for L in "ABC"}
        key[m]["seed"] = seed
        key[m]["_sources"] = {k2: cl[k2]["meta"] for k2 in cl}
        key[m]["_r3b_new_image_frames"] = starts
        print(m, key[m]["A"], key[m]["B"], key[m]["C"])
    (out / "key.json").write_text(json.dumps(key, indent=1))


def main_round3c(moves, rnd_name="round-3"):
    """round 3c (r3 critique round 3): r2 / r3c (this round) / spike. Each move's letter order differs from the other
    move's AND from both earlier r3 rounds' orders for that move (r3 and r3b count as this lineage), position by position."""
    out = REPO / "review" / "motion" / "r3" / rnd_name
    out.mkdir(parents=True, exist_ok=True)
    prev = {"n1": [("r2", "spike", "new"), ("spike", "new", "r2")], "n5": [("new", "r2", "spike"), ("r2", "spike", "new")]}
    key = {"_about": ("Blind A/B/C per move, round 3c (the r3b critics' fixes). r2 = the round-2 sheet "
                      "(tools/motion-ai/timing/<move>_r2.json) rendered unchanged on the same model (byte-identical "
                      "snapshot), so the letters compare motion, not model edits. r3c = this round "
                      "(tools/motion-ai/timing/<move>_r3c.json; smear_v3.py crescents on N1 S1 (+ a fading remnant on C1) "
                      "and N5 S1-S3, with N5's ellipse decaying over C1 / C1b). spike = the stand-in priestess's hand-keyed "
                      "24-frame sweep (a different model and move: a feel reference), VFX off. Neither Rosace clip has "
                      "the stained-glass VFX (panes, furrow, leading, shards, saint, ring, contact flash). GIFs play at 50 "
                      "fps (20 ms per game frame); the MP4 is exact 60 fps. Every clip holds its last frame for 18 frames "
                      "before the loop. Letter order differs per move and from rounds 1 and 2. Open this file and "
                      "_metrics.json only after writing the verdicts.")}
    used = []
    for m in moves:
        clips = {"r2": rosace_clip(f"{m}_r2m"), "r3c": rosace_clip(f"{m}_r3c"), "spike": spike_clip()}
        pv = [tuple("r3c" if x == "new" else x for x in o) for o in prev[m]]
        k = 0
        while True:
            seed = f"20260929-r3c-{m}-{k}"
            order = list(clips)
            random.Random(seed).shuffle(order)
            ok = all(all(x != y for x, y in zip(order, u)) for u in pv + used)
            if ok:
                break
            k += 1
        used.append(tuple(order))
        letters, cl, starts = compose(m, seed=seed, clips=clips, out=out, ref="r3c")
        key[m] = {L: letters[L] for L in "ABC"}
        key[m]["seed"] = seed
        key[m]["_sources"] = {k2: cl[k2]["meta"] for k2 in cl}
        key[m]["_r3c_new_image_frames"] = starts
        print(m, key[m]["A"], key[m]["B"], key[m]["C"])
    (out / "key.json").write_text(json.dumps(key, indent=1))


def main():
    if sys.argv[1:2] == ["--round3c"]:
        return main_round3c(sys.argv[2:] or ["n1", "n5"])
    if sys.argv[1:2] == ["--round3b"]:
        return main_round3b(sys.argv[2:] or ["n1", "n5"])
    if sys.argv[1:2] == ["--round2"]:
        return main_round2(sys.argv[2:] or ["n1", "n5"])
    if sys.argv[1:2] == ["--round3"]:
        return main_round3(sys.argv[2:] or ["n1", "n5"])
    moves = sys.argv[1:] or ["n1", "n5"]
    keyp = OUT / "key.json"
    key = json.loads(keyp.read_text()) if keyp.exists() else {}
    key["_about"] = ("Blind A/B/C per move. raw = the AI clip (Kimodo, end-effector keys) retargeted with the same "
                     "rig, glaive and IK steps, every generated frame shown once at 60 fps (its keys land on the "
                     "same frames as MOVESET's). retimed = the same clip rebuilt from tools/motion-ai/timing/<move>.json "
                     "(holds, snaps, easing, push, MOVESET drawing exposure). spike = the stand-in priestess's "
                     "hand-keyed 24-frame sweep from tools/pixel-pipeline/blender_spike.py (a different model and "
                     "a different move: a timing and feel reference only), VFX off. GIFs play at 50 fps (20 ms per "
                     "game frame: GIF delays are in 10 ms steps and browsers slow 10 ms frames to 100 ms); the MP4 "
                     "is exact 60 fps. Every clip holds its last frame for 18 frames before the loop.")
    for m in moves:
        letters, clips, starts = compose(m)
        key[m] = {L: letters[L] for L in "ABC"}
        key[m]["_sources"] = {k: clips[k]["meta"] for k in clips}
        key[m]["_retimed_drawing_frames"] = starts
        print(m, key[m]["A"], key[m]["B"], key[m]["C"])
    keyp.write_text(json.dumps(key, indent=1))


if __name__ == "__main__":
    main()
