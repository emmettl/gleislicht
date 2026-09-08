import json, math, gzip
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
r=json.loads(Path('data/thurgau-border-rail-sources/path-review.json').read_text())
accepted=[x['strict']['path'] for x in r['rows'] if x['platform']=='3' and not x['reverse']][0]
rejected=[x['permissive']['path'] for x in r['rows'] if x['platform']=='2' and not x['reverse']][0]
platform2=[x['strict']['path'] for x in r['rows'] if x['platform']=='2' and not x['reverse']][0]
osm=json.loads(gzip.decompress(Path('data/thurgau-border-rail-sources/osm.json.gz').read_bytes()))
nodes={x['id']:x for x in osm['elements'] if x['type']=='node'}
way=next(x for x in osm['elements'] if x['type']=='way' and x['id']==122064965)
connector=[[nodes[id]['lon'],nodes[id]['lat']] for id in way['nodes']]
turns=[]
for a,b,c in zip(rejected,rejected[1:],rejected[2:]):
 u=((b[0]-a[0])*math.cos(math.radians(b[1])),b[1]-a[1]);v=((c[0]-b[0])*math.cos(math.radians(b[1])),c[1]-b[1]);norm=math.hypot(*u)*math.hypot(*v)
 if norm and sum(x*y for x,y in zip(u,v))/norm<-.5:turns.append(b)
font=lambda n:ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',n)
im=Image.new('RGB',(1400,880),'#f7fafc');d=ImageDraw.Draw(im)
d.text((28,22),'Bregenz S7 border rail review',font=font(30),fill='#17324a')
d.text((28,68),'Blue: platform 3. Green: platform 2 with reviewed connector. Orange: rejected old candidate. No basemap.',font=font(19),fill='#354f64')
for col,(title,points) in enumerate([('Whole border leg',accepted+rejected),('Reviewed connection · OSM 122064965',[[connector[0][0]-.0005,connector[0][1]-.0005],[connector[-1][0]+.0005,connector[-1][1]+.0005]]+connector)]):
 x0=25+690*col;y0=110;d.rounded_rectangle((x0,y0,x0+660,y0+670),radius=14,fill='white',outline='#d1dce6')
 d.text((x0+18,y0+14),title,font=font(23),fill='#17324a')
 scale=math.cos(math.radians(47.48));xs=[p[0]*scale for p in points];ys=[p[1] for p in points];bounds=min(xs),min(ys),max(xs),max(ys);factor=min(595/(bounds[2]-bounds[0]),570/(bounds[3]-bounds[1]))
 project=lambda p:(x0+330+(p[0]*scale-(bounds[0]+bounds[2])/2)*factor,y0+360-(p[1]-(bounds[1]+bounds[3])/2)*factor)
 # Clip through a transparent panel rather than drawing outside the zoom.
 panel=Image.new('RGBA',im.size);pd=ImageDraw.Draw(panel)
 for path,colour in [(rejected,'#c8692b'),(accepted,'#007f9b'),(platform2,'#298749')]:pd.line([project(p) for p in path],fill=colour,width=3)
 if col==1:
  pd.line([project(p) for p in connector],fill='#14562b',width=6)
  for p in [connector[0],connector[-1]]:
   x,y=project(p);pd.ellipse((x-6,y-6,x+6,y+6),fill='#17324a')
 for p in turns:
  x,y=project(p);pd.ellipse((x-7,y-7,x+7,y+7),outline='#b32728',width=3)
 im.paste(panel.crop((x0+12,y0+55,x0+648,y0+645)),(x0+12,y0+55),panel.crop((x0+12,y0+55,x0+648,y0+645)))
 d=ImageDraw.Draw(im)
 for p,name in [(accepted[0],'St. Margrethen'),(accepted[-1],'Bregenz')]:
  x,y=project(p)
  if x0+15<x<x0+630 and y0+60<y<y0+640:d.ellipse((x-4,y-4,x+4,y+4),fill='#17324a');d.text((min(x+10,x0+510),y+8),name,font=font(17),fill='#17324a')
d.text((28,805),'© OpenStreetMap contributors · ODbL 1.0 · 2 September 2026 snapshot · Gleislicht rail inference',font=font(19),fill='#354f64')
d.text((28,839),'The original turn limit still rejects the orange reversal. Track selection, signalling and operational direction remain unverified.',font=font(18),fill='#354f64')
im.save('docs/assets/thurgau-border-rail-review.png')
print({'sharpTurnsInRejectedCandidate':len(turns)})
