"""Crop generated mechanical components with explicit art-space hinge/attachment anchors."""
import json, hashlib, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'exports'; OUT.mkdir(exist_ok=True)
sources={
 'latch':'props/latch-components-keyed-v2.png',
 'deck':'props/bridge-deck-keyed-v1.png',
 'rig':'props/bridge-rig-keyed-v1.png',
 'service':'props/service-light-keyed-v1.png',
}
alpha={}
for key,source in sources.items():
 review=ROOT/'reviews'/('mechanism-key-'+key+'-v1')
 if not review.exists():
  subprocess.run([sys.executable,str(ROOT/'key_registry_layer.py'),'--input',str(ROOT/source),'--output',str(review),'--edge-band','3'],check=True,capture_output=True,text=True)
 alpha[key]=Image.open(review/'alpha.png').convert('RGBA')

manifest={}
def component(key,source,region,pivot,anchors):
 im=alpha[source]; part=im.crop(region); a=np.asarray(part.getchannel('A'))>=128
 # Explicit separate-component regions exclude the output's key-noise corner pixels.
 ys=np.where(a.sum(axis=1)>3)[0]; xs=np.where(a.sum(axis=0)>3)[0]
 if not len(xs) or not len(ys): raise RuntimeError('Missing component '+key)
 b=(max(0,int(xs[0])-2)+region[0],max(0,int(ys[0])-2)+region[1],min(part.width,int(xs[-1])+3)+region[0],min(part.height,int(ys[-1])+3)+region[1])
 crop=im.crop(b); dest=OUT/(key+'-native-v1.png');crop.save(dest)
 transform=lambda p:[p[0]-b[0],p[1]-b[1]]
 manifest[key]={'path':str(dest),'width':crop.width,'height':crop.height,'pivot':transform(pivot),'anchors':{k:transform(v) for k,v in anchors.items()},'source':sources[source],'sourceBounds':list(b),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
component('courtyard-latch-base','latch',(250,200,550,780),(400,492),{})
component('courtyard-latch','latch',(700,350,1350,650),(795,493),{})
component('bridge','deck',(20,200,2150,500),(108,347),{'end':[2071,347],'rope':[2071,347]})
component('bridge-post','rig',(350,500,670,920),(517,870),{'rope':[517,565]})
component('bridge-rope','rig',(1050,5,1190,930),(1106,54),{'start':[1106,54],'end':[1106,877]})
component('service-light','service',(80,420,1300,720),(688,580),{})
# Exact 90-degree frame transpose gives the existing authored light emission
# the horizontal orientation of the service fixture; no new pixels are painted.
with Image.open(ROOT/'sheets/lamp-emission-v1.png') as sheet:
 result=Image.new(sheet.mode,sheet.size)
 for i in range(6):
  x,y=(i%3)*512,(i//3)*512
  result.paste(sheet.crop((x,y,x+512,y+512)).transpose(Image.Transpose.ROTATE_90),(x,y))
 target=OUT/'service-emission-v1.png'; result.save(target)
 manifest['service-emission']={'path':str(target),'width':1536,'height':1024,'frameWidth':512,'frameHeight':512,'frames':6,'columns':3,'frameMs':1100,'loop':True,'pivot':[256,256],'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
with Image.open(ROOT/'props/door-recess-v1.png') as im:
 # The model returned real alpha with an external shadow. Only the opaque
 # stone insert is part of this architectural material, so crop its rectangle.
 box=(132,105,892,1429); result=im.crop(box)
 target=OUT/'door-recess-native-v1.png';result.save(target)
 manifest['door-recess']={'path':str(target),'width':result.width,'height':result.height,'pivot':[result.width/2,result.height],'sourceBounds':list(box),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
(OUT/'export-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:{f:v[f] for f in ['width','height','pivot','anchors'] if f in v} for k,v in manifest.items()},indent=2))
