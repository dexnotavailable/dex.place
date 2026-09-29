"""Contact sheet of rendered frames (nearest-neighbour zoom) for inspection.
usage: python contact.py <frame_dir> <out.png> [zoom] [cols] [frames...]"""
import sys, os, glob
from PIL import Image

d, out = sys.argv[1], sys.argv[2]
zoom = int(sys.argv[3]) if len(sys.argv) > 3 else 2
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
files = sorted(glob.glob(os.path.join(d, "*.png")))
if len(sys.argv) > 5:
    want = set(int(x) for x in sys.argv[5].split(","))
    files = [f for f in files if int(os.path.basename(f)[:4]) in want]
ims = [Image.open(f).convert("RGBA") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * w * zoom, rows * h * zoom), (118, 118, 122, 255))
for i, im in enumerate(ims):
    bg = Image.new("RGBA", im.size, (118, 118, 122, 255) if (i // cols + i % cols) % 2 == 0 else (110, 110, 116, 255))
    bg.alpha_composite(im)
    sheet.paste(bg.resize((w * zoom, h * zoom), Image.NEAREST), ((i % cols) * w * zoom, (i // cols) * h * zoom))
sheet.save(out)
print(out, sheet.size)
