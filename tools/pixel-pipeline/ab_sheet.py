"""A/B sheet: our frames vs reference sprites, every panel on its native pixel grid at one zoom.

Reference handling (measured, see spike notes):
  07-anim-amberowl-wrench.webp  top half is a 2x upscale; grid phase x even / y odd
                                (within-2x2-block variance 43 vs ~190-290 for other offsets),
                                so we box-downsample crop(0,1,800,399) to 400x199 native.
  09-anim-amberowl-katana-cats  labelled "original size" (原寸) by the artist; used 1:1.
References are third-party images: the output sheet stays in the git-ignored review/ folder.

usage: python ab_sheet.py <spike_dir> <refs_dir> <out.png> [zoom]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

spike, refs, out = sys.argv[1], sys.argv[2], sys.argv[3]
Z = int(sys.argv[4]) if len(sys.argv) > 4 else 3
BG = (112, 112, 118)


def ours(px, f, box):
    im = Image.open(os.path.join(spike, f"out_px{px}_ss4", f"final_{f:04d}.png")).convert("RGBA")
    bg = Image.new("RGBA", im.size, BG + (255,))
    bg.alpha_composite(im)
    return bg.crop(box).convert("RGB")




ref07 = Image.open(os.path.join(refs, "07-anim-amberowl-wrench.webp")).convert("RGB")
ref07n = ref07.crop((0, 1, 800, 399)).resize((400, 199), Image.BOX)
ref09 = Image.open(os.path.join(refs, "09-anim-amberowl-katana-cats.webp")).convert("RGB")

rows = [
    ("attack frame", [
        ("OURS 96px  f12 (smear + ring)", ours(96, 12, (60, 22, 330, 184))),
        ("OURS 176px  f12", ours(176, 12, (150, 40, 620, 337))),
        ("REF 07 native (2x->1x)", ref07n.crop((180, 0, 400, 199))),
        ("REF 09 native 1:1", ref09.crop((420, 22, 670, 215))),
    ]),
    ("character, hold pose, no VFX", [
        ("OURS 96px  f9", ours(96, 9, (40, 70, 250, 184))),
        ("OURS 176px  f9", ours(176, 9, (90, 110, 460, 337))),
        ("REF 07 native idle", ref07n.crop((40, 0, 200, 199))),
        ("REF 09 native idle", ref09.crop((55, 22, 240, 215))),
    ]),
]
try:
    font = ImageFont.load_default(size=22)
except TypeError:
    font = ImageFont.load_default()
pad, lab = 16, 34
row_imgs = []
for title, panels in rows:
    ims = [p.resize((p.width * Z, p.height * Z), Image.NEAREST) for _, p in panels]
    h = max(i.height for i in ims) + lab
    w = sum(i.width for i in ims) + pad * (len(ims) + 1)
    r = Image.new("RGB", (w, h + lab), (24, 24, 28))
    d = ImageDraw.Draw(r)
    d.text((pad, 4), title.upper(), fill=(255, 255, 255), font=font)
    x = pad
    for (name, p), im in zip(panels, ims):
        d.text((x, lab + 2), f"{name}  [{p.width}x{p.height} native, x{Z}]", fill=(230, 220, 160), font=font)
        r.paste(im, (x, lab * 2))
        x += im.width + pad
    row_imgs.append(r)
W = max(r.width for r in row_imgs)
H = sum(r.height for r in row_imgs) + pad
sheet = Image.new("RGB", (W, H), (24, 24, 28))
y = 0
for r in row_imgs:
    sheet.paste(r, (0, y))
    y += r.height + pad
sheet.save(out)
print(out, sheet.size)
