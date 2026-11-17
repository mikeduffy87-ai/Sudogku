import numpy as np
from PIL import Image, ImageFilter
from collections import deque
from scipy import ndimage as ndi
SH=Image.open('design/toby-character-sheet.png').convert('RGB')
def cut(box, icon=False, extra_keep=0, seeds_skip_top=None, shadow_from=0.0):
    im=np.asarray(SH.crop(box)).astype(int); h,w,_=im.shape
    R,G,B=im[...,0],im[...,1],im[...,2]; mn=im.min(-1)
    cream=(mn>228)&(R-B<26)
    lav=(B-G>8)&(B>180)&(R>150)          # light lavender shadows / blobs
    if shadow_from>0: lav&=(np.arange(h)[:,None]>=int(h*shadow_from))
    passable=cream|(lav if not icon else np.zeros_like(cream))
    top=[(0,x) for x in range(w) if not (seeds_skip_top and seeds_skip_top[0]<=x<=seeds_skip_top[1])]
    seeds=[(y,0) for y in range(h)]+[(y,w-1) for y in range(h)]+[(h-1,x) for x in range(w)]+top
    bg=np.zeros((h,w),bool); q=deque(seeds)
    while q:
        y,x=q.popleft()
        if bg[y,x] or not passable[y,x]: continue
        bg[y,x]=True
        for yy,xx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0<=yy<h and 0<=xx<w and not bg[yy,xx]: q.append((yy,xx))
    fg=~bg
    if not icon:
        ys=np.arange(h)[:,None]>=int(h*shadow_from)
        fg&=~((B>R+6)&(mn<235)&ys)           # purple shadow under the dog
    lb,n=ndi.label(fg); sz=ndi.sum(fg,lb,range(1,n+1))
    order=np.argsort(sz)[::-1]
    keep=lb==(1+order[0])
    # keep extra sizeable pieces (rays, ? bubble, scribble) when asked
    for k in order[1:1+extra_keep+3]:
        piece=lb==(1+k)
        if sz[k]>40 and not (piece[0,:].any() or piece[-1,:].any() or piece[:,0].any() or piece[:,-1].any()): keep|=piece
    keep=ndi.binary_fill_holes(keep)
    a=Image.fromarray((keep*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7))
    out=Image.fromarray(im.astype('uint8')).convert('RGBA'); out.putalpha(a)
    return out.crop(out.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox())
def square(img, size, pad=0.04):
    s=int(max(img.size)*(1+pad)); sq=Image.new('RGBA',(s,s),(0,0,0,0)); sq.paste(img,((s-img.width)//2,(s-img.height)//2)); return sq.resize((size,size),Image.LANCZOS)
jobs={ # name: (box, icon, extra pieces, opts)
 'face-happy':((512,436,722,618),False,0,{}),'face-focused':((718,436,920,618),False,0,{}),'face-excited':((916,436,1126,618),False,4,{}),
 'face-sorry':((1120,436,1328,618),False,0,{}),'face-cheeky':((1322,436,1528,618),False,0,{}),
 'act-sniff':((15,745,295,945),False,3,{}),'act-hint':((300,760,530,950),False,2,{'shadow_from':0.7}),'act-complete':((528,752,785,950),False,6,{'seeds_skip_top':(40,240)}),
 'act-oops':((785,770,1015,945),False,3,{'shadow_from':0.6}),
 'tile':((1068,778,1272,978),True,0,{}),'app':((1296,768,1530,1004),True,0,{}),'hero':((0,203,505,720),False,0,{'seeds_skip_top':(80,480)}),'wordmark':((2,2,500,140),True,0,{})}
import os; os.makedirs('toby-cuts',exist_ok=True)
for name,(box,icon,extra,opts) in jobs.items():
    img=cut(box,icon,extra,**opts)
    if name in ('hero','wordmark'): img.save(f'toby-cuts/{name}.png')
    else: square(img,320 if not name.startswith('act') else 360).save(f'toby-cuts/{name}.png')
    print(name,img.size)
# contact sheet on dark + lilac tiles
names=list(jobs); tiles=[]
for nm in names:
    im=Image.open(f'toby-cuts/{nm}.png'); im.thumbnail((230,230))
    t=Image.new('RGBA',(240,240),(45,45,60,255)); t.alpha_composite(im,((240-im.width)//2,(240-im.height)//2)); tiles.append(t)
cs=Image.new('RGB',(240*5,240*3),(0,0,0))
for k,t in enumerate(tiles): cs.paste(t.convert('RGB'),((k%5)*240,(k//5)*240))
cs.save('toby-cuts/_preview.png')
