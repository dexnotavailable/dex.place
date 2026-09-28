"""Publish actual Registry art, room-relative layers and optional later exports.
No source repaint, game edits or public-site deployment. Run after new manifests.
"""
from pathlib import Path
import hashlib,json,re,shutil
from PIL import Image

ROOT=Path(__file__).resolve().parent
OUT=Path('D:/Dex/Projects/dex-place-world/site/public/world/registry')
SX,SY=1600/1672,900/941
ROOMS=['arrival','rest','registry','junction','vestibule','arena','archive','low-passage','pool','sky-walk','exhibit','courtyard']
FIELDS=['frameWidth','frameHeight','frames','columns','frameMs','loop','pivot','bodyBounds','anchors','facing']
EXPECTED=['bench','registry-desk','accountant-idle','accountant-acknowledge','accountant-rest','door-frame','door-leaf','courtyard-latch','courtyard-latch-base','donor-box','map-banner','bridge','bridge-post','bridge-rope','paper-terminal','tree','cloud-far','cloud-mid','lamp-emission','water-shimmer','warden-idle','warden-attack','warden-recover','warden-hit','warden-death']
ASSETS={};RECEIPTS=[];INPUTS={}

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read_manifest(relative):
    path=ROOT/relative
    if not path.exists():return {}
    INPUTS[relative]=sha(path)
    data=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data,dict):raise ValueError('Expected semantic-ID mapping: '+relative)
    return data

def register(key,source,expected=None,**meta):
    if not re.fullmatch('[a-z0-9][a-z0-9-]*',key):raise ValueError('Bad semantic key: '+key)
    source=Path(source)
    if not source.is_absolute():source=ROOT/source
    source=source.resolve(strict=True)
    if not source.is_relative_to(ROOT):raise ValueError('Source outside owner: '+str(source))
    digest=sha(source)
    if expected and expected!=digest:raise ValueError('Source changed: '+key)
    with Image.open(source) as im:width,height=im.size
    fixed_name=meta.pop('_filename',None)
    if fixed_name and Path(fixed_name).name!=fixed_name:raise ValueError('Invalid fixed asset basename')
    meta={k:v for k,v in meta.items() if k in FIELDS}
    if 'frameWidth' in meta or 'frameHeight' in meta:
        fw,fh=meta['frameWidth'],meta['frameHeight'];count=meta.get('frames',1)
        if width%fw or height%fh or count>width//fw*(height//fh):raise ValueError('Bad sheet grid: '+key)
        if meta.get('columns',width//fw)!=width//fw:raise ValueError('Bad sheet columns: '+key)
        if isinstance(meta.get('frameMs'),list) and len(meta['frameMs'])!=count:raise ValueError('Bad timings: '+key)
    filename=fixed_name or f'{key}-{digest[:12]}{source.suffix.lower()}'
    target=OUT/'art'/filename;target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists() or sha(target)!=digest:shutil.copy2(source,target)
    assert sha(target)==digest
    ASSETS[key]={'src':'/world/registry/art/'+filename,'width':width,'height':height,**meta,'sourceSha256':digest}
    RECEIPTS.append({'id':key,'source':str(source),'target':str(target),'sha256':digest,'metadata':meta})

def crop_register(key,source,box):
    source=Path(source);digest=sha(source)
    with Image.open(source) as im:
        if not(0<=box[0]<box[2]<=im.width and 0<=box[1]<box[3]<=im.height):raise ValueError('Bad crop: '+key)
        crop=im.crop(box);target=ROOT/'exports'/'published-layers'/f'{key}-{digest[:12]}.png';target.parent.mkdir(parents=True,exist_ok=True);crop.save(target)
        assert Image.open(target).convert('RGBA').tobytes()==crop.convert('RGBA').tobytes()
    register(key,target)
    RECEIPTS[-1].update(parentSource=str(source),parentSha256=digest,sourceRectXYXY=list(box),operation='exact pixel crop; no resizing')

def layer(asset,role,x,y,width,height,depth,**meta):
    return {'asset':asset,'role':role,'x':round(x,4),'y':round(y,4),'width':round(width,4),'height':round(height,4),'depth':depth,**meta}

def atmosphere(room):
    offsets={'arrival':(0,0),'rest':(110,-30),'registry':(-580,-20),'junction':(-80,0),'vestibule':(-130,-150),'arena':(-130,-135),'archive':(-240,-100),'low-passage':(-120,-140),'pool':(-90,-10),'sky-walk':(-180,-95),'exhibit':(-300,-155),'courtyard':(-330,-150)}
    x,y=offsets[room]
    # A small camera-relative overscan keeps the sky covered during arrival
    # movement without stretching its skyline across the2800px room width.
    # Cropped ring sources continue beyond their right edge: keep that edge
    # outside each visible viewport when choosing the reference framing.
    ring_width=1664+max(0,-x)
    out=[layer('shared-sky','sky',-32,-18,1664,936,-100,parallax=.02),layer('shared-ring','landmark',x,y,ring_width,ring_width*900/1600,-80,parallax=.07,alpha=.86)]
    if room in ['vestibule','arena','archive','low-passage']:
        out.append(layer('cloud-far','cloud',120,-380,1100,1100,-85,parallax=.04,alpha=.5,phase=1,drift=.18));return out
    out += [layer('cloud-far','cloud',-180,90,1020,1020,-90,parallax=.035,alpha=.78,phase=1.4,drift=.16),layer('cloud-far','cloud',700,-5,1080,1080,-89,parallax=.04,alpha=.72,phase=3.6,drift=.2)]
    if room=='arrival':
        out += [layer('cloud-mid','cloud',1000,20,800,800,-70,parallax=.11,alpha=.92,phase=1.8,drift=.35),layer('cloud-mid','cloud',-340,175,1030,1030,-65,parallax=.13,alpha=.88,phase=4.1,drift=.48)]
    else:
        x,y,size={'rest':(850,90,940),'registry':(-330,185,1000),'junction':(940,90,930),'pool':(900,5,870),'sky-walk':(800,150,1110),'exhibit':(960,-20,1050),'courtyard':(900,5,1000)}[room]
        out.append(layer('cloud-mid','cloud',x,y,size,size,-65,parallax=.12,alpha=.85,phase=2.2,drift=.38))
    return out

def lights(room):
    points={'arrival':[],'rest':[(210,396)],'registry':[(581,456),(1197,469),(1423,469)],'junction':[(763,180),(1120,425),(1552,517)],'vestibule':[(234,516),(970,446)],'arena':[(315,544),(586,513),(1088,513),(1358,544)],'archive':[(252,454),(1454,460)],'low-passage':[(84,506),(1603,507)],'pool':[(65,597)],'sky-walk':[(26,540),(1645,551)],'exhibit':[(233,497),(1436,496)],'courtyard':[(155,475),(1407,542),(1584,542)]}[room]
    out=[];a=ASSETS['lamp-fixture']
    if room=='low-passage' and 'service-light' in ASSETS and 'service-emission' in ASSETS:
        points=[]
        fixture=ASSETS['service-light'];width=110;height=width*fixture['height']/fixture['width']
        for i,x in enumerate([563,1185]):
            cx,cy=x*SX,380*SY
            out += [layer('service-light','foreground',cx-width/2,cy-height/2,width,height,10),layer('service-emission','light',cx-150,cy-150,300,300,12,blend='add',alpha=.16,phase=i*.83)]
    for i,(x,y) in enumerate(points):
        h=48 if room in ['arena','rest'] else 42;w=h*a['width']/a['height'];cx,cy=x*SX,y*SY;glow=h*1.7
        out += [layer('lamp-fixture','foreground',cx-w/2,cy-h/2,w,h,10),layer('lamp-emission','light',cx-glow/2,cy-glow/2,glow,glow,12,blend='add',alpha=.32,phase=i*.73)]
    return out

def main():
    ASSETS.clear();RECEIPTS.clear();INPUTS.clear()
    geometry={r['id']:r for r in json.loads((ROOT/'room-geometry-review.json').read_text())['rooms']}
    processed=read_manifest('processed-materials.json')
    for overrides in ['structure-overrides.json','material-overrides.json']:
        for key,item in read_manifest(overrides).items():
            base_hash=item.get('baseProcessedSha256')
            if base_hash and processed.get(key,{}).get('sha256')!=base_hash:raise ValueError('Reviewed override has a changed base: '+key)
            processed[key]=item
    register('shared-sky','layers/shared-sky-v1.png');register('shared-ring','layers/shared-ring-alpha-v2.png')
    if (ROOT/'props/folio-material-v1.png').exists():register('folio-material','props/folio-material-v1.png',_filename='folio-material-v1.png')
    for key,file,ms,pivot in [('cloud-mid','cloud-mid-alpha-v3.png',1300,[256,280]),('cloud-far','cloud-far-alpha-v1.png',1300,[256,280]),('lamp-emission','lamp-emission-v1.png',1100,[256,256])]:
        register(key,Path('sheets')/file,frameWidth=512,frameHeight=512,frames=6,columns=3,frameMs=ms,loop=True,pivot=pivot)
    if (ROOT/'sheets/pool-water-wide-v2.png').exists():register('water-shimmer','sheets/pool-water-wide-v2.png',frameWidth=1536,frameHeight=256,frames=4,columns=1,frameMs=1800,loop=True,pivot=[768,128])
    elif (ROOT/'sheets/pool-water-v1.png').exists():register('water-shimmer','sheets/pool-water-v1.png',frameWidth=512,frameHeight=512,frames=6,columns=3,frameMs=1400,loop=True,pivot=[256,256])
    for key,(times,loop) in {'accountant-idle':([450,350,300,300,400,500],True),'accountant-acknowledge':([180,180,240,650,240,300],False),'accountant-rest':([200,450,600,900,500,1700],False)}.items():
        register(key,Path('sheets')/(key+'-alpha-v1.png'),frameWidth=512,frameHeight=512,frames=6,columns=3,frameMs=times,loop=loop,pivot=[256,489],bodyBounds={'x':149,'y':77,'width':315,'height':415},anchors={'handPlane':[256,309]})
    for key,item in processed.items():
        if key.endswith('-structure'):continue
        meta={k:item[k] for k in FIELDS if k in item}
        if key.startswith('exhibit-frame-'):meta['pivot']=[item['size'][0]/2,item['size'][1]]
        if key=='door-frame' and 'anchors' in meta:
            meta['anchors']={**meta['anchors'],'apertureTL':meta['anchors']['apertureTopLeft'],'apertureBR':meta['anchors']['apertureBottomRight']}
        register(key,item['path'],item.get('sha256'),**meta)
    for path in ['exports/export-manifest.json','actor-materials.json','cloud-materials.json']:
        for key,item in read_manifest(path).items():register(key,item['path'],item.get('sha256'),**{k:item[k] for k in FIELDS if k in item})
    rooms={}
    for room in ROOMS:
        item=processed[room+'-structure'];source=Path(item['path'])
        if sha(source)!=item['sha256']:raise ValueError('Structure changed: '+room)
        split=742 if room=='arrival' else geometry[room]['floor']['rearFloorBoundaryY']
        crop_register(room+'-wall',source,(0,0,1672,split));crop_register(room+'-floor',source,(0,split,1672,941))
        layers=atmosphere(room)+[layer(room+'-wall','wall',0,0,1600,split*SY,-30),layer(room+'-floor','floor',0,split*SY,1600,(941-split)*SY,-20)]+lights(room)
        if room=='courtyard':
            a=ASSETS['tree'];scale=450*SY/a.get('bodyBounds',{}).get('height',a['height']);pivot=a['pivot'];w,h=a['width']*scale,a['height']*scale
            layers.append(layer('tree','foreground',536*SX-pivot[0]*scale,687*SY-pivot[1]*scale,w,h,5))
        if room=='exhibit':
            a=ASSETS['bench'];h=40;w=h*a['width']/a['height'];layers.append(layer('bench','foreground',843*SX-w/2,699*SY-h,w,h,15))
        if room=='pool' and 'water-shimmer' in ASSETS:layers.append(layer('water-shimmer','water',0,540*SY,1600,201*SY,-50,blend='normal',phase=0))
        if room=='junction':
            crop_register('junction-column',source,(402,0,531,941))
            layers.append(layer('junction-column','foreground',402*SX,0,129*SX,900,46))
        rooms[room]={'layers':sorted(layers,key=lambda x:x['depth']),'referenceGeometry':{'sourceSize':[1672,941],'logicalSize':[1600,900],'referenceLeft':600 if room=='arrival' else 0,'footline':geometry[room]['floor']['playerFootLineY']*SY,'wallFloorSplitSourceY':split,'note':'Layer coordinates relative to reference camera; runtime applies referenceLeft once.'}}
    extension=ROOT/'reviews/publication-extension-01/alpha.png'
    if extension.exists():
        for side,x,left in [('left',-600,209),('right',1600,836)]:
            top=side+'-arrival-extension-top';floor=side+'-arrival-extension-floor'
            crop_register(top,extension,(left,0,left+627,61));crop_register(floor,extension,(left,690,left+627,941))
            rooms['arrival']['layers'] += [layer(top,'wall',x,0,600,61*SY,-32),layer(floor,'floor',x,712*SY,600,251*SY,-22)]
        rooms['arrival']['layers'].sort(key=lambda x:x['depth'])
    for room in rooms.values():
        for l in room['layers']:
            if l['asset'] not in ASSETS:raise ValueError('Missing layer asset')
    content={'assets':ASSETS,'rooms':rooms};stamp=hashlib.sha256(json.dumps(content,sort_keys=True).encode()).hexdigest()[:14];catalogue={'version':'registry-art-'+stamp,**content}
    temp=OUT/'assets.json.pending';temp.write_text(json.dumps(catalogue,indent=2)+'\n',encoding='utf-8');temp.replace(OUT/'assets.json')
    missing=[k for k in EXPECTED if k not in ASSETS]
    checkpoint={'version':catalogue['version'],'catalogue':str(OUT/'assets.json'),'catalogueSha256':sha(OUT/'assets.json'),'sourceManifests':INPUTS,'assets':len(ASSETS),'roomsWithLayers':len(rooms),'missingSemanticKeys':missing,'registered':RECEIPTS,'scope':'isolated local-game asset publication; no live-site deployment','review':'reference reconstruction and actual browser contacts still require inspection','arrivalExtension':extension.exists()}
    (ROOT/'PUBLICATION-CHECKPOINT.json').write_text(json.dumps(checkpoint,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:checkpoint[k] for k in ['version','catalogue','assets','roomsWithLayers','missingSemanticKeys','arrivalExtension']}))

if __name__=='__main__':main()
