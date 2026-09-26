# usage: python3 compose.py out.png label1=img1 label2=img2 ...  (all native-res, shown at 4x)
import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]; items=[a.split('=',1) for a in sys.argv[2:]]
S=4; pad=16; bg=(122,120,128)
ims=[(l,Image.open(p).convert('RGBA')) for l,p in items]
W=sum(im.width*S+pad for _,im in ims)+pad; H=max(im.height*S for _,im in ims)+pad*2+24
canvas=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(canvas)
x=pad
for l,im in ims:
    big=im.resize((im.width*S,im.height*S),Image.NEAREST)
    canvas.paste(big,(x,pad+24+(H-pad*2-24-big.height)),big)
    d.text((x,pad),l,fill=(255,255,255))
    x+=big.width+pad
canvas.save(out); print(out, canvas.size)
