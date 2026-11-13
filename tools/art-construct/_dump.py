import sys;sys.path.insert(0,'tools/art-construct')
import json, head_paint as HP, artlib as A
view, expr = sys.argv[1], sys.argv[2]
spec=json.load(open(f'art/rosace/construct/faces/r2/head_{view}.json',encoding='utf-8'))
h=HP.Head(spec,expr);cv=h.compose()
g=A.codes_to_grid(cv.code,h.pal)
y0,y1=(int(sys.argv[3]),int(sys.argv[4])) if len(sys.argv)>4 else (0,46)
print('   '+''.join(str(i%10) for i in range(38)))
for i,r in enumerate(g[y0:y1]): print('%2d '%(i+y0)+r)
