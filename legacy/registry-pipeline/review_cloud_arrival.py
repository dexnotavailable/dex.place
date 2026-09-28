"""Render a static layer-registration comparison for cloud matte review only.

Uses actual published arrival layer geometry and textures; no runtime/public
edits. This is a CPU composite, not a browser gameplay or shader acceptance test.
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
PUBLIC=Path(r'D:\Dex\Projects\dex-place-world\site\public')
CAT=json.loads((PUBLIC/'world/registry/assets.json').read_text())
OUT=ROOT/'reviews/cloud-unmix-v5'


def render(replace):
    canvas=Image.new('RGBA',(1600,900),(24,35,43,255))
    for layer in sorted(CAT['rooms']['arrival']['layers'],key=lambda l:l['depth']):
        key=layer['asset'];a=CAT['assets'][key]
        path=ROOT/'exports'/f'{key}-unmixed-v5.png' if replace and key in ('cloud-far','cloud-mid') else PUBLIC/a['src'].lstrip('/')
        im=Image.open(path).convert('RGBA')
        if 'frames' in a:
            frame=int(math.floor(layer.get('phase',0)*1000/a.get('frameMs',1300)))%a['frames']
            cols=a['columns'];w=a['frameWidth'];h=a['frameHeight'];x=frame%cols*w;y=frame//cols*h
            im=im.crop((x,y,x+w,y+h))
        im=im.resize((round(layer['width']),round(layer['height'])),Image.Resampling.NEAREST)
        if layer.get('alpha',1)!=1:
            im.putalpha(im.getchannel('A').point(lambda v:round(v*layer['alpha'])))
        canvas.alpha_composite(im,(round(layer['x']),round(layer['y'])))
    return canvas.convert('RGB')


old=render(False);new=render(True)
old.save(OUT/'arrival-old-matte.png');new.save(OUT/'arrival-unmixed.png')
regions=[('high cloud edge',(980,330,1390,570)),('far cloud wisps',(740,500,1220,655))]
for label,rect in regions:
    w,h=rect[2]-rect[0],rect[3]-rect[1]
    pair=Image.new('RGB',(w*2,h+28),(24,35,43))
    draw=ImageDraw.Draw(pair)
    draw.text((5,5),'Current matte',fill='white');draw.text((w+5,5),'Boundary unmix',fill='white')
    pair.paste(old.crop(rect),(0,28));pair.paste(new.crop(rect),(w,28))
    pair.save(OUT/(label.replace(' ','-')+'-arrival-comparison.png'))
for key,rect in [('cloud-far',(0,235,512,330)),('cloud-mid',(0,155,512,380))]:
    im=Image.open(ROOT/'exports'/f'{key}-unmixed-v5.png').convert('RGBA')
    cellh=rect[3]-rect[1]+20
    contact=Image.new('RGBA',(1536,cellh*2),(255,193,165,255))
    for i in range(6):
        x,y=i%3*512,i//3*512
        crop=im.crop((x+rect[0],y+rect[1],x+rect[2],y+rect[3]))
        contact.alpha_composite(crop,(i%3*512,i//3*cellh+20))
        ImageDraw.Draw(contact).text((i%3*512+5,i//3*cellh+4),f'frame {i}',fill=(24,35,43))
    contact.convert('RGB').save(OUT/f'{key}-all-frames-warm.png')
print(str(OUT))
