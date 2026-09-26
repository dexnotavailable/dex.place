# usage: python3 analyze.py out/<name>.json [joint=hdR] [tip=weapon]
# Key poses = local minima of the driving joint's speed; for every segment between key poses,
# fit the normalised progress curve against our easing library and report the best match.
import json, sys, math
import numpy as np
from PIL import Image, ImageDraw
src = sys.argv[1]; J = sys.argv[2] if len(sys.argv) > 2 else 'hdR'; TIP = sys.argv[3] if len(sys.argv) > 3 else 'weapon'
d = json.load(open(src)); fps = d['fps']; T = d['tracks']
drv = T.get(TIP) or T.get(J)
if not drv: sys.exit('no driver joint in ' + ','.join(T))
P = np.array(drv); n = len(P)
v = np.r_[0, np.linalg.norm(np.diff(P, axis=0), axis=1)] * fps  # px/s
vs = np.convolve(v, np.ones(3) / 3, 'same')
keys = [0] + [i for i in range(2, n - 2) if vs[i] <= vs[i - 1] and vs[i] <= vs[i + 1] and vs[i] < 0.35 * vs.max()] + [n - 1]
k2 = [keys[0]]
for k in keys[1:]:
  if k - k2[-1] >= 3: k2.append(k)
keys = k2
E = {
  'lin': lambda t: t, 'inQuad': lambda t: t * t, 'outQuad': lambda t: 1 - (1 - t) ** 2,
  'inCubic': lambda t: t ** 3, 'outCubic': lambda t: 1 - (1 - t) ** 3,
  'inExpo': lambda t: 0 if t == 0 else 2 ** (10 * t - 10), 'outExpo': lambda t: 1 if t == 1 else 1 - 2 ** (-10 * t),
  'inOutSine': lambda t: -(math.cos(math.pi * t) - 1) / 2, 'inOutCubic': lambda t: 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2,
}
print(f'{src}: {n} frames @ {fps}fps, driver={TIP if TIP in T else J}, peak {vs.max():.0f}px/s')
print('seg   frames  dist(px)  peak@   best-ease (rms)   2nd')
rows = []
for a, b in zip(keys, keys[1:]):
  seg = P[a:b + 1]; L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(seg, axis=0), axis=1))]
  if L[-1] < 1: rows.append((a, b, 0, '-', 'hold', 0)); print(f'{a:3d}-{b:<3d} {b-a:5d}   {0:7.1f}   -      hold'); continue
  u = L / L[-1]; t = np.linspace(0, 1, len(u))
  fits = sorted((math.sqrt(np.mean([(E[k](tt) - uu) ** 2 for tt, uu in zip(t, u)])), k) for k in E)
  pk = a + int(np.argmax(v[a:b + 1]))
  rows.append((a, b, L[-1], pk, fits[0][1], fits[0][0]))
  print(f'{a:3d}-{b:<3d} {b-a:5d}   {L[-1]:7.1f}   {pk:4d}   {fits[0][1]:10s} ({fits[0][0]:.3f})   {fits[1][1]}')
# chart: arc of the driver + head, and speed with key poses
W, HH = d['w'], d['hh']; S = 4
im = Image.new('RGB', (W * S + 420, max(HH * S, 300)), (24, 24, 30)); dr = ImageDraw.Draw(im)
for k, col in [('head', (120, 200, 255)), ('hips', (160, 160, 160)), (TIP if TIP in T else J, (255, 70, 90))]:
  if k not in T: continue
  pts = [(x * S, y * S) for x, y in T[k]]; dr.line(pts, fill=col, width=1)
  for i in keys: dr.ellipse([pts[i][0] - 4, pts[i][1] - 4, pts[i][0] + 4, pts[i][1] + 4], outline=(255, 230, 120))
ox = W * S + 10; gh = 260; mx = vs.max() or 1
dr.text((ox, 4), 'speed (driver) + key poses', fill=(220, 220, 220))
for i in range(1, n): dr.line([(ox + (i - 1) * 400 / n, gh - vs[i - 1] / mx * 230), (ox + i * 400 / n, gh - vs[i] / mx * 230)], fill=(255, 70, 90))
for i in keys: dr.line([(ox + i * 400 / n, 20), (ox + i * 400 / n, gh)], fill=(255, 230, 120))
im.save(src.replace('.json', '-analysis.png')); print('chart', src.replace('.json', '-analysis.png'))
