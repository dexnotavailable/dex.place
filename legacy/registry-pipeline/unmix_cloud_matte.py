"""Unmix green matte only at a cloud boundary, preserving opaque interiors.

Known composite C = alpha * foreground + (1-alpha) * green. Alpha is fitted
against the nearest clean authored cloud colour; foreground is reconstructed
from C rather than blurred or replaced with that neighbour. No source mutation.
"""
from pathlib import Path
import argparse
import hashlib
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def nearest_foreground(rgb, clean, candidates, radius=22, key=None, fit=False):
    yy,xx=np.nonzero(candidates)
    values=np.zeros((len(xx),3),np.float32)
    found=np.zeros(len(xx),bool)
    distance=np.full(len(xx),float('inf'),np.float32)
    best=np.full(len(xx),float('inf'),np.float32)
    observed=rgb[yy,xx]
    h,w=clean.shape
    offsets=sorted(((dy,dx) for dy in range(-radius,radius+1) for dx in range(-radius,radius+1)),key=lambda p:p[0]**2+p[1]**2)
    for dy,dx in offsets:
        pending=np.arange(len(xx)) if fit else np.flatnonzero(~found)
        if len(pending)==0:break
        y,x=yy[pending]+dy,xx[pending]+dx
        valid=(y>=0)&(y<h)&(x>=0)&(x<w)
        pending,y,x=pending[valid],y[valid],x[valid]
        chosen=clean[y,x]
        selected=pending[chosen]
        colors=rgb[y[chosen],x[chosen]]
        if fit:
            vector=colors-key
            obs=observed[selected]-key
            a=np.clip(np.sum(obs*vector,axis=1)/np.maximum(np.sum(vector*vector,axis=1),1),0,1)
            residual=np.sqrt(np.mean((obs-a[:,None]*vector)**2,axis=1))
            score=residual+.24*(dx*dx+dy*dy)**.5
            improves=score<best[selected]
            selected,colors,score=selected[improves],colors[improves],score[improves]
            best[selected]=score
        values[selected]=colors
        found[selected]=True
        distance[selected]=(dx*dx+dy*dy)**.5
    return values,found,distance


def convert(source, output):
    im=Image.open(source)
    if im.mode=='RGBA' and im.getextrema()[3][0]<255:
        raise ValueError('Use the original opaque green-keyed sheet, not an already-keyed image.')
    rgba=np.array(im.convert('RGBA'))
    rgb=rgba[:,:,:3].astype(np.float32)
    nominated=np.array([0,255,0],np.float32)
    dominance=rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])
    background=(np.max(np.abs(rgb-nominated),axis=2)<=36)&(dominance>=190)
    key=np.median(rgb[background],axis=0)
    expanded=np.asarray(Image.fromarray(background.astype('uint8')*255).filter(ImageFilter.MaxFilter(7)))>0
    band=expanded&~background
    # The generated source also has a few solid-green remnants 4--12 pixels
    # inside an edge. Extend only to green-dominant pixels near that same edge;
    # purple/blue authored shadows remain outside this extension and unchanged.
    near_edge=np.asarray(Image.fromarray(background.astype('uint8')*255).filter(ImageFilter.MaxFilter(25)))>0
    band|=near_edge&~background&(dominance>0)
    # A sample two pixels inside the silhouette avoids sampling the green rim.
    expanded2=np.asarray(Image.fromarray(background.astype('uint8')*255).filter(ImageFilter.MaxFilter(5)))>0
    clean=~expanded2&(dominance<=-12)
    candidates=band
    estimates,found,dist=nearest_foreground(rgb,clean,candidates,radius=14,key=key,fit=True)
    if not np.all(found):
        # Thin isolated cloud streaks have no two-pixel eroded core. Their clean
        # source-colour pixels are still usable estimates, without eroding them.
        missing=np.zeros_like(candidates)
        cy,cx=np.nonzero(candidates)
        missing[cy[~found],cx[~found]]=True
        fallback,got,fd=nearest_foreground(rgb,~background&(dominance<=-12),missing,48)
        indices=np.flatnonzero(~found)
        estimates[indices[got]]=fallback[got]
        dist[indices[got]]=fd[got]
        found[indices[got]]=True
    ys,xs=np.nonzero(candidates)
    y,x=ys[found],xs[found]
    observed=rgb[y,x]
    f=estimates[found]
    vector=f-key
    denom=np.maximum(np.sum(vector*vector,axis=1),1)
    alpha=np.clip(np.sum((observed-key)*vector,axis=1)/denom,0,1)
    fitted=key+alpha[:,None]*vector
    residual=np.sqrt(np.mean((fitted-observed)**2,axis=1))
    # A boundary colour that is not consistent with the known matte mixture is
    # still authored colour, so leave it opaque instead of washing the palette.
    source_dominance=observed[:,1]-np.maximum(observed[:,0],observed[:,2])
    green_contamination=source_dominance>0
    # Some generated key edges are not a perfect three-channel composite. Use
    # the nearby authored cloud's green/non-key relationship to estimate alpha
    # there; this recovers the key channel instead of leaving cyan or clipping G.
    ratio=f[:,1]/np.maximum(np.maximum(f[:,0],f[:,2]),1)
    nonkey=np.maximum(observed[:,0],observed[:,2])
    ratio_alpha=1-(observed[:,1]-ratio*nonkey)/np.maximum(key[1]-ratio*max(key[0],key[2]),1)
    minimum=np.maximum((observed[:,0]-key[0])/(255-key[0]),(observed[:,2]-key[2])/(255-key[2]))
    ratio_alpha=np.clip(np.maximum(ratio_alpha,minimum),0,1)
    alpha=np.where(green_contamination,ratio_alpha,alpha)
    eligible=(alpha<.995)&((residual<28)|green_contamination)
    y,x,observed,alpha=y[eligible],x[eligible],observed[eligible],alpha[eligible]
    foreground=(observed-(1-alpha[:,None])*key)/np.maximum(alpha[:,None],1/255)
    result=rgba.copy()
    result[background]=0
    result[y,x,:3]=np.rint(np.clip(foreground,0,255)).astype('uint8')
    result[y,x,3]=np.rint(alpha*255).astype('uint8')
    result[result[:,:,3]==0,:3]=0
    interior=~background&~band
    assert np.array_equal(result[interior],rgba[interior])
    assert np.all(result[interior,3]==255)
    changed=np.any(result[:,:,:3]!=rgba[:,:,:3],axis=2)&~background
    assert not np.any(changed&~band)
    output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():raise ValueError('Versioned output already exists')
    Image.fromarray(result).save(output)
    return {'source':str(source),'sourceSha256':sha(source),'path':str(output),'sha256':sha(output),
            'key':key.tolist(),'backgroundPixels':int(background.sum()),'boundaryPixels':int(band.sum()),
            'convertedBoundaryPixels':int(eligible.sum()),'noCleanNeighbour':int((~found).sum()),
            'opaqueInteriorPixels':int(interior.sum()),'opaqueInteriorByteIdentical':True,
            'maxForegroundSampleDistance':float(dist[found].max()),
            'method':'3px boundary unmix plus green-dominant matte remnants within12px of key; nearby clean cloud estimate selected by matte-fit and distance; all other interiors unchanged',
            'limits':'Unknown original alpha is estimated. Distinct isolated wisps may use a nearby clean colour; review actual warm/dark composites.'}


def composite(im,color):
    canvas=Image.new('RGBA',im.size,color+(255,))
    canvas.alpha_composite(im)
    return canvas.convert('RGB')


def review_pair(old,new,review,key):
    old=Image.open(old).convert('RGBA');new=Image.open(new).convert('RGBA')
    for name,color in [('warm',(255,193,165)),('dark',(24,35,43))]:
        pair=Image.new('RGB',(1024,300 if key=='cloud-far' else 530),color)
        roi=(0,225,512,335) if key=='cloud-far' else (0,140,512,385)
        for i,im in enumerate((old,new)):
            crop=composite(im.crop(roi),color).resize((1024,(roi[3]-roi[1])*2),Image.Resampling.NEAREST)
            # One before/after row at native width for comparison without hiding
            # single-pixel edge defects behind interpolating resampling.
            row=composite(im.crop(roi),color)
            y=25+i*(roi[3]-roi[1]+22)
            pair.paste(row,(0,y))
            ImageDraw.Draw(pair).text((0,y-18),'BEFORE' if i==0 else 'BOUNDARY UNMIX',fill=(24,35,43) if name=='warm' else 'white')
            crop.save(review/f'{key}-{name}-{i}-2x.png')
        pair.save(review/f'{key}-{name}-comparison.png')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--version',default='v1')
    args=parser.parse_args()
    review=ROOT/'reviews'/f'cloud-unmix-{args.version}'
    if review.exists():raise ValueError('Choose a fresh review version')
    review.mkdir(parents=True)
    materials={}
    for key,source,previous in [
        ('cloud-far','cloud-far-green-v1.png','cloud-far-alpha-v1.png'),
        ('cloud-mid','cloud-mid-green-v3.png','cloud-mid-alpha-v3.png')]:
        path=ROOT/'exports'/f'{key}-unmixed-{args.version}.png'
        materials[key]=convert(ROOT/'sheets'/source,path)
        review_pair(ROOT/'sheets'/previous,path,review,key)
    (review/'report.json').write_text(json.dumps(materials,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'review':str(review),'materials':materials}))


if __name__=='__main__':main()
