"""Preserve opaque structure and crop static sprites; never repaint source art."""
import json, hashlib, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

ROOT=Path(__file__).resolve().parent
ROOMS=['arrival','rest','registry','junction','vestibule','arena','archive','low-passage','pool','sky-walk','exhibit','courtyard']
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dominant_crop(image):
    """Ignore sparse key noise while preserving every pixel inside the crop.

    Actual isolated far-edge2px specks corrupted getbbox/foot pivots. The body
    is defined by alpha128 rows/columns supported by >5pixels, plus2px margin.
    That margin includes the inspected paper terminal's meaningful soft edge;
    its distant alpha1 debris does not determine the rendered footprint.
    """
    alpha=np.asarray(image.getchannel('A'))
    core=alpha>=128
    xs=np.flatnonzero(core.sum(axis=0)>5);ys=np.flatnonzero(core.sum(axis=1)>5)
    if not len(xs) or not len(ys): raise RuntimeError('No substantial prop silhouette')
    body=(int(xs[0]),int(ys[0]),int(xs[-1])+1,int(ys[-1])+1)
    bounds=(max(0,body[0]-2),max(0,body[1]-2),min(image.width,body[2]+2),min(image.height,body[3]+2))
    return bounds,body
def convert(key, source):
    source=ROOT/source
    review=ROOT/'reviews'/'native-key-final-v1'/key
    if not review.exists():
        subprocess.run([sys.executable,str(ROOT/'key_registry_layer.py'),'--input',str(source),'--output',str(review),'--edge-band','3'],check=True,capture_output=True,text=True)
    output=review/'alpha.png'
    if not output.exists(): raise RuntimeError(f'Incomplete key review: {key}')
    return output

processed={}
for room in ROOMS:
    version='v2' if room=='arrival' else 'v1'
    source=f'layers/{room}-structure-keyed-{version}.png'
    alpha=convert(room,source)
    processed[room+'-structure']={'source':source,'path':str(alpha),'sha256':sha(alpha),'operation':'key/edge conversion; opaque interior unchanged'}

prop_sources={
    'bench':'props/bench-keyed-v1.png',
    'registry-desk':'props/registry-desk-keyed-v1.png',
    'donor-box':'props/donor-box-keyed-v1.png',
    'paper-terminal':'props/paper-terminal-keyed-v1.png',
    'door-frame':'props/door-frame-keyed-v1.png',
    'lamp-fixture':'props/lamp-fixture-keyed-v1.png',
    'tree':'props/tree-keyed-v1.png',
}
for key, relative in prop_sources.items():
    src=ROOT/relative
    with Image.open(src) as im: has_alpha=im.mode=='RGBA' and im.getextrema()[3][0]<255
    alpha=src if has_alpha else convert(key,relative)
    with Image.open(alpha) as im:
        im=im.convert('RGBA'); bounds,body=dominant_crop(im)
        target=ROOT/'exports'/f'{key}-native-v2.png';target.parent.mkdir(parents=True,exist_ok=True)
        crop=im.crop(bounds);crop.save(target)
        assert Image.open(target).convert('RGBA').tobytes()==crop.tobytes()
        pivot=[(body[0]+body[2])/2-bounds[0],body[3]-bounds[1]]
        processed[key]={'source':relative,'path':str(target),'sourceBounds':list(bounds),'bodySourceBounds':list(body),'size':list(crop.size),'pivot':pivot,'bodyBounds':{'x':body[0]-bounds[0],'y':body[1]-bounds[1],'width':body[2]-body[0],'height':body[3]-body[1]},'sha256':sha(target),'operation':'exact substantial-silhouette crop plus2px safety; alpha/RGB inside crop unchanged; native foot boundary pivot; no resize/repaint'}
        if key=='door-frame':
            # Aperture from the frame's actual alpha hole, not a generic ratio.
            hole=Image.fromarray(np.where(np.asarray(crop.getchannel('A'))<128,255,0).astype('uint8')).copy()
            seed=(crop.width//2,crop.height//2)
            if hole.getpixel(seed)==255:
                ImageDraw.floodfill(hole,seed,127,thresh=0)
                aperture=Image.fromarray(np.where(np.asarray(hole)==127,255,0).astype('uint8')).getbbox()
                if aperture:processed[key]['anchors']={'apertureTopLeft':[aperture[0],aperture[1]],'apertureBottomRight':[aperture[2],aperture[3]]}

# The closed leaf is cut from the fitted assembled door, not the rejected narrow first attempt.
with Image.open(ROOT/'props/door-assembled-keyed-v2.png') as im:
    bounds=(455,170,925,1034)
    target=ROOT/'exports'/'door-leaf-native-v2.png';im.crop(bounds).convert('RGBA').save(target)
    processed['door-leaf']={'source':'props/door-assembled-keyed-v2.png','path':str(target),'sourceBounds':list(bounds),'size':[470,864],'pivot':[235,864],'sha256':sha(target),'operation':'fixed inner-aperture crop from matched assembled door'}

frame_alpha=convert('exhibit-frames','props/exhibit-frames-keyed-v1.png')
with Image.open(frame_alpha) as im:
    im=im.convert('RGBA'); a=np.asarray(im.getchannel('A'))
    occupied=(a>32).sum(axis=0)>4
    edges=np.diff(np.r_[False,occupied,False].astype(np.int8))
    intervals=[(int(l),int(r)) for l,r in zip(np.where(edges==1)[0],np.where(edges==-1)[0]) if r-l>20]
    if len(intervals)!=9: raise RuntimeError(f'Expected nine extracted frames, found {len(intervals)}')
    for index,(left,right) in enumerate(intervals,1):
        region=im.crop((left,0,right,im.height)); b=region.getchannel('A').getbbox()
        bounds=(left+b[0],b[1],left+b[2],b[3]);out=im.crop(bounds)
        target=ROOT/'exports'/f'exhibit-frame-{index}-native-v1.png';out.save(target)
        processed[f'exhibit-frame-{index}']={'source':'props/exhibit-frames-keyed-v1.png','path':str(target),'sourceBounds':list(bounds),'size':list(out.size),'pivot':[out.width/2,out.height/2],'sha256':sha(target),'operation':'exact component crop; world placement follows room reference, not extraction sheet layout'}

(ROOT/'processed-materials.json').write_text(json.dumps(processed,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'processed':len(processed),'rooms':len(ROOMS),'props':len(prop_sources)+1,'manifest':str(ROOT/'processed-materials.json')}))
