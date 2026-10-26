import sys;sys.path.insert(0,'tools/art-construct')
from PIL import Image
import artlib as A
src,out=sys.argv[1],sys.argv[2]
x0,y0,x1,y1,z=map(int,sys.argv[3:8])
im=A.on_bg(Image.open(src).convert('RGBA'))
c=im.crop((x0,y0,x1,y1))
panels=[('x%d'%z,A.zoom(c,z)),('x4',A.zoom(im,4)),('x2',A.zoom(im,2)),('1x',im)]
A.row_sheet(panels,title=src.split('/')[-1]).save(out)
