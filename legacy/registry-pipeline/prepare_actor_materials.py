"""Extract and register authored Registry actor pixels; no repainting or resizing.

Sources are immutable keyed/RGBA originals. Every frame is translated as a whole
onto a larger transparent cell. The two cross-cell sword tips are assigned to
their actual poses by non-overlapping source rectangles, not erased or redrawn.
Only this production owner's exports/reviews and actor-materials.json are written.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
HELPER = Path(r'C:\Users\sanic\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py')
OUT = ROOT / 'exports'
REVIEW = ROOT / 'reviews' / 'actor-registration-v1'
PIVOT = (384, 560)
# These are registration landmarks on the original 512-pixel cells. X is the
# projected centre of ground support, with collapsed support hand/body positions
# annotated by eye; Y is the foot/heap plane, never a lower sword hilt pixel.
SPEC = {
    'warden-idle': {'anchors': [(347,462),(317,462),(304,462),(347,462),(317,462),(304,462)], 'ms': [240]*6, 'loop': True},
    'warden-attack': {'anchors': [(331,485),(291,485),(304,485),(380,445),(349,445),(368,445)], 'ms': [400,450,65,85,100,150], 'loop': False},
    'warden-recover': {'anchors': [(352,439),(337,439),(335,439),(347,442),(310,445),(309,445)], 'ms': [180,180,220,220,240,260], 'loop': False},
    'warden-hit': {'anchors': [(348,463),(311,463),(298,463),(345,462),(312,462),(303,462)], 'ms': [45,45,45,45,50,50], 'loop': False},
    'warden-death': {'anchors': [(341,467),(307,466),(334,466),(350,378),(342,382),(342,382)], 'ms': [160,180,200,230,300,400], 'loop': False},
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_source(key):
    source = ROOT / 'sheets' / f'{key}-green-v1.png'
    alpha = ROOT / 'sheets' / f'{key}-alpha-v1.png'
    if alpha.exists():
        with Image.open(alpha) as check:
            if check.mode != 'RGBA' or check.getextrema()[3][0] != 0:
                raise ValueError(f'Existing alpha output is not a transparent RGBA: {alpha}')
        return source, alpha
    with Image.open(source) as check:
        if check.mode == 'RGBA' and check.getextrema()[3][0] < 255:
            check.save(alpha)
            return source, alpha
    subprocess.run([sys.executable,str(HELPER),'--input',str(source),'--out',str(alpha),
                    '--key-color','#00ff00','--soft-matte','--transparent-threshold','50',
                    '--opaque-threshold','160','--spill-cleanup'],check=True)
    return source, alpha


def write_png(path, image):
    if path.exists():
        with Image.open(path) as old:
            if old.mode != image.mode or old.size != image.size or old.tobytes() != image.tobytes():
                raise ValueError(f'Immutable prepared output differs: {path}')
    else:
        image.save(path)


def validate(key, path, size, pivot, ms, loop):
    destination = REVIEW / key
    if destination.exists():
        report = json.loads((destination/'report.json').read_text())
        if report['sourceEncodedSha256'] != sha(path):
            raise ValueError(f'Stale validation output: {destination}')
        return
    args = [sys.executable,str(ROOT/'validate_sheets.py'),'--input',str(path),
            '--output',str(destination),'--frame-width',str(size),'--frame-height',str(size),
            '--frames','6','--columns','3','--pivot',','.join(map(str,pivot)),
            '--alpha-mode','soft','--durations-ms',','.join(map(str,ms)),'--gif']
    if not loop:
        args.append('--once')
    subprocess.run(args, check=True)


def prepare_warden(key, spec):
    original, alpha = alpha_source(key)
    sheet = Image.open(alpha).convert('RGBA')
    if sheet.size != (1536,1024):
        raise ValueError(f'Unexpected source geometry: {key} {sheet.size}')
    packed = Image.new('RGBA',(1920,1280))
    notes = []
    source_assigned = 0
    for i, anchor in enumerate(spec['anchors']):
        sx, sy = i%3*512, i//3*512
        rect = [sx,sy,sx+512,sy+512]
        # Both sheets contain the third pose's complete sword tip in the empty
        # right gutter of pose 1. Neither actor overlaps the crop boundary x1000.
        if key in ('warden-hit','warden-death') and i == 1:
            rect[2] = 1000
        if key in ('warden-hit','warden-death') and i == 2:
            rect[0] = 1000
        crop = sheet.crop(rect)
        dx = PIVOT[0] - anchor[0] + rect[0] - sx
        dy = PIVOT[1] - anchor[1] + rect[1] - sy
        bounds = crop.getbbox()
        if not bounds:
            raise ValueError(f'Empty frame: {key} {i}')
        translated_bounds = [bounds[0]+dx,bounds[1]+dy,bounds[2]+dx,bounds[3]+dy]
        if min(translated_bounds) < 0 or max(translated_bounds) > 640:
            raise ValueError(f'Content would be clipped: {key} {i} {translated_bounds}')
        frame = Image.new('RGBA',(640,640))
        frame.paste(crop,(dx,dy))
        before = np.asarray(crop)
        after = np.asarray(frame)
        before_count = int(np.count_nonzero(before[:,:,3]))
        after_count = int(np.count_nonzero(after[:,:,3]))
        if before_count != after_count:
            raise ValueError(f'Visible pixels lost: {key} {i}')
        # Exact RGBA equality at translated source placement, including key edges.
        restored = frame.crop((dx,dy,dx+crop.width,dy+crop.height))
        if restored.tobytes() != crop.tobytes():
            raise ValueError(f'Pixel change during registration: {key} {i}')
        packed.paste(frame,(i%3*640,i//3*640))
        source_assigned += before_count
        notes.append({'frame':i,'sourceRect':rect,'sourceGroundAnchor':list(anchor),
                      'translation':[dx,dy],'outputBounds':translated_bounds,'retainedAlphaPixels':after_count})
    if source_assigned != int(np.count_nonzero(np.asarray(sheet)[:,:,3])):
        raise ValueError(f'Source alpha pixels unassigned or duplicated: {key}')
    path = OUT / f'{key}-registered-v1.png'
    write_png(path,packed)
    validate(key,path,640,PIVOT,spec['ms'],spec['loop'])
    return {'path':str(path),'sha256':sha(path),'width':1920,'height':1280,
            'frameWidth':640,'frameHeight':640,'frames':6,'columns':3,
            'frameMs':spec['ms'],'loop':spec['loop'],'pivot':list(PIVOT),
            'bodyBounds':{'x':306,'y':144,'width':168,'height':416}}, {
                'source':str(original),'sourceSha256':sha(original),'alpha':str(alpha),
                'allVisibleSourcePixelsRetainedOnce':True,'visiblePixelCount':source_assigned,
                'scaleChanges':False,'frames':notes,
                'nominalBodyHeight':416,'measuredIdleAlphaHeight':419,
                'bodyBoundsMeaning':'Fixed nominal standing-body scale; never the current crouch or corpse bounds.'}


def prepare_banner():
    original, alpha = alpha_source('map-banner')
    sheet = Image.open(alpha).convert('RGBA')
    packed = Image.new('RGBA',sheet.size)
    first = np.asarray(sheet.crop((0,0,512,512))).astype(np.float32)
    target = first[65:108,100:412].copy()
    target[:,:,:3] *= target[:,:,3:4]/255
    notes = []
    for i in range(6):
        frame = sheet.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512))
        # Register the fixed top rod only, rather than the changing paper bounds.
        candidates = []
        for dy in range(-3,4):
            for dx in range(-2,3):
                patch = np.asarray(frame.crop((100-dx,65-dy,412-dx,108-dy))).astype(np.float32)
                patch[:,:,:3] *= patch[:,:,3:4]/255
                candidates.append((float(np.mean(np.abs(target-patch))),abs(dx)+abs(dy),dx,dy))
        _,_,dx,dy = min(candidates)
        if i == 0:
            dx,dy = 0,0
        out = Image.new('RGBA',(512,512))
        out.paste(frame,(dx,dy))
        if np.count_nonzero(np.asarray(out)[:,:,3]) != np.count_nonzero(np.asarray(frame)[:,:,3]):
            raise ValueError(f'Banner alpha clipped: {i}')
        packed.paste(out,(i%3*512,i//3*512))
        notes.append({'frame':i,'translation':[dx,dy],'outputBounds':list(out.getbbox())})
    path = OUT/'map-banner-registered-v1.png'
    write_png(path,packed)
    timing = [80,70,80,90,120,160]
    validate('map-banner',path,512,(256,88),timing,False)
    return {'path':str(path),'sha256':sha(path),'width':1536,'height':1024,
            'frameWidth':512,'frameHeight':512,'frames':6,'columns':3,'frameMs':timing,
            'loop':False,'pivot':[256,88],
            'anchors':{'bottom':[256,387],'rolledTie':[256,113],'unrolledTie':[256,387]}}, {
                'source':str(original),'sourceSha256':sha(original),'frames':notes,
                'registration':'Top-rod image match in bounded +/-2px X, +/-3px Y; whole frames translated only.',
                'anchors':'Bottom is the centre of the final lower rod, not lowest antialiased outer pixel. The tie anchors attach separate runtime cord; source contains no authored cut rope.'}


def make_game_scale_review(materials):
    keys = list(SPEC)
    # Explicit nearest-neighbour review only. The runtime sheets above stay native.
    scale = 96/416
    cell = round(640*scale)
    panel = Image.new('RGB',(6*(cell+12),len(keys)*(cell+38)),(24,35,43))
    draw = ImageDraw.Draw(panel)
    for row,key in enumerate(keys):
        im = Image.open(materials[key]['path'])
        for i in range(6):
            f = im.crop((i%3*640,i//3*640,i%3*640+640,i//3*640+640)).resize((cell,cell),Image.Resampling.NEAREST)
            x,y = i*(cell+12),row*(cell+38)+24
            panel.paste(f,(x,y),f)
            draw.text((x,y-17),f'{key[7:]} {i}',fill=(238,225,196))
            floor=y+round(560*scale)
            draw.line((x,floor,x+cell,floor),fill=(79,102,109))
    write_png(REVIEW/'game-scale-contact.png',panel)


def main():
    OUT.mkdir(exist_ok=True)
    REVIEW.mkdir(parents=True,exist_ok=True)
    materials, registration = {}, {}
    for key,spec in SPEC.items():
        materials[key],registration[key]=prepare_warden(key,spec)
    materials['map-banner'],registration['map-banner']=prepare_banner()
    (ROOT/'actor-materials.json').write_text(json.dumps(materials,indent=2)+'\n',encoding='utf-8')
    (REVIEW/'registration.json').write_text(json.dumps(registration,indent=2)+'\n',encoding='utf-8')
    make_game_scale_review(materials)
    print(json.dumps({'materials':str(ROOT/'actor-materials.json'),'review':str(REVIEW),'assets':list(materials)}))


if __name__=='__main__':
    main()
