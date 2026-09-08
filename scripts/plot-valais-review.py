"""Render the complete admitted path set against all 13 canton districts (Pillow)."""
import json,gzip,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
out=Path('docs/assets');out.mkdir(exist_ok=True)
boundary=json.loads(gzip.decompress(Path('data/valais-sources/decoded.json.gz').read_bytes()))
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
def xy(p):
 lon,lat=p[:2];x=(lat*3600-169028.66)/10000;y=(lon*3600-26782.5)/10000
 return (2600072.37+211455.93*y-10938.51*y*x-.36*y*x*x-44.54*y**3,1200147.07+308807.95*x+3745.25*y*y+76.63*x*x-194.56*y*y*x+119.79*x**3)
paths={}
for date in ['2026-09-04','2026-09-06']:
 folder=Path('public/data/valais-region')/date;m=json.loads((folder/'valais-region-day-manifest.json').read_text())
 for chunk in m['chunks']:
  for t in json.loads((folder/chunk['path']).read_text())['trains']:
   for i in t['pathSegments']:
    line=m['paths'][i];key=json.dumps(line)
    paths[key]=(t['transportMode'],[xy(p) for p in line])
W,H=520,410
canvas=Image.new('RGB',(W*4,H*4+80),'white');draw=ImageDraw.Draw(canvas)
draw.text((20,12),'Valais / Wallis — full admitted geometry, 4 and 6 September 2026',font=font,fill='#111827')
draw.text((20,44),'Blue: inferred OSM buses   Red: reviewed FOT rail / rack rail   Grey: swisstopo boundary   No street-direction certification',font=small,fill='#4b5563')
features=[dict(properties=dict(name='Whole canton'),geometry=boundary['canton'][0]['geometry'])]+boundary['districts']
for idx,f in enumerate(features):
 g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 pts=[p for poly in polys for ring in poly for p in ring];x0=min(p[0] for p in pts);x1=max(p[0] for p in pts);y0=min(p[1] for p in pts);y1=max(p[1] for p in pts)
 scale=min((W-36)/(x1-x0),(H-72)/(y1-y0));cx=(x0+x1)/2;cy=(y0+y1)/2
 project=lambda p:((p[0]-cx)*scale+W/2,H/2+15-(p[1]-cy)*scale)
 tile=Image.new('RGB',(W,H),'#fafbfc');d=ImageDraw.Draw(tile)
 for poly in polys:
  d.polygon([project(p) for p in poly[0]],fill='#e5e7eb',outline='#9ca3af')
  for ring in poly[1:]:d.polygon([project(p) for p in ring],fill='#fafbfc')
 for mode,line in paths.values():
  if not any(x0-1000<=p[0]<=x1+1000 and y0-1000<=p[1]<=y1+1000 for p in line):continue
  d.line([project(p) for p in line],fill='#2563a7' if mode=='bus' else '#c62828',width=1 if mode=='bus' else 2)
 d.rectangle((0,0,W,35),fill='white');d.text((12,7),f['properties']['name'],font=font,fill='#111827');d.rectangle((0,0,W-1,H-1),outline='#d1d5db')
 canvas.paste(tile,((idx%4)*W,80+(idx//4)*H))
canvas.save(out/'valais-geometry-review.png')
print('Rendered',len(paths),'unique admitted paths across complete canton and 13 districts')
