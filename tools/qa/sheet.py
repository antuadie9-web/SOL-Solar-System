import sys,json,os
from PIL import Image, ImageDraw, ImageFont
# usage: sheet.py out.jpg cols W dir1[,dir2] name1 name2 ...   (if two dirs: pairs side by side A|B)
out,cols,W=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]); dirs=sys.argv[4].split(','); names=sys.argv[5:]
H=int(W*9/16)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',max(12,W//40))
except: font=None
tiles=[]
for n in names:
    for d in dirs:
        p=f'{d}/{n}.png'
        im=Image.open(p).convert('RGB').resize((W,H)) if os.path.exists(p) else Image.new('RGB',(W,H),(60,0,0))
        dr=ImageDraw.Draw(im); lab=f"{os.path.basename(d)} · {n}"
        try:
            m=json.load(open(f'{d}/{n}.json')); lab+=f" · EV {m.get('exposureEV')} · {m.get('viewingMode')}"
        except: pass
        dr.rectangle((0,0,W,int(W/30)+8),fill=(0,0,0)); dr.text((6,3),lab,fill=(255,230,120),font=font)
        tiles.append(im)
c=(-cols if cols<0 else (cols*len(dirs) if len(dirs)>1 else cols))   # negative cols = absolute column count (e.g. -1 stacks A over B)
rows=(len(tiles)+c-1)//c
S=Image.new('RGB',(c*W,rows*H),(20,20,20))
for i,t in enumerate(tiles): S.paste(t,((i%c)*W,(i//c)*H))
S.save(out,quality=90)
