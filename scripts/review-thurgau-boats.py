"""Draw the admitted full boat patterns and their original shoreline constraints."""
import json,gzip,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
r=json.loads(Path('data/thurgau-boat-sources/path-review.json').read_text())
lakes=json.loads(gzip.decompress(Path('data/thurgau-boat-sources/lakes.json.gz').read_bytes()))['results']
polygons=[p for f in lakes if f['id'] in [124,171] for p in f['geometry']['coordinates']]
accepted=[p for p in r['patterns'] if p['admitted']]
font=lambda n:ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',n)
canvas=Image.new('RGB',(1600,1250),'#f7fafc');draw=ImageDraw.Draw(canvas)
draw.text((25,18),'Thurgau · admitted shipping patterns',font=font(31),fill='#17324a')
draw.text((25,63),'26 Friday + 26 Sunday journeys · blue/green: directed paths · orange: recorded dock-area discrepancies',font=font(20),fill='#354f64')
routeids=list(dict.fromkeys(p['routeId'] for p in accepted))
for panel,rid in enumerate(routeids):
 ps=[p for p in accepted if p['routeId']==rid];pts=[q for p in ps for s in p['segments'] for q in s['path']]
 x0=20+(panel%2)*790;y0=108+(panel//2)*520
 draw.rounded_rectangle((x0,y0,x0+770,y0+500),radius=12,fill='white',outline='#cdd8e0')
 draw.text((x0+18,y0+12),f"{ps[0]['line']} · {rid}",font=font(23),fill='#17324a')
 c=math.cos(math.radians(47.6));xs=[q[0]*c for q in pts];ys=[q[1] for q in pts]
 a,b=min(xs),min(ys);w=max(max(xs)-a,.005);h=max(max(ys)-b,.005);scale=min(695/w,360/h)
 def xy(q):return(x0+385+(q[0]*c-a-w/2)*scale,y0+270-(q[1]-b-h/2)*scale)
 layer=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(layer)
 for poly in polygons:
  d.polygon([xy(q) for q in poly[0]],fill='#e5f1f6',outline='#94b9c9')
  for ring in poly[1:]:d.polygon([xy(q) for q in ring],fill='white',outline='#94b9c9')
 for p in ps:
  color='#007aaf' if p['directionId']=='0' else '#278153'
  for s in p['segments']:
   d.line([xy(q) for q in s['path']],fill=color,width=3)
   for interval in s['water']['outsideIntervals']:d.line([xy(q) for q in interval['endpoints']],fill='#d67626',width=5)
   if len(s['path'])>2:
    u,v=map(xy,s['path'][len(s['path'])//2-1:len(s['path'])//2+1]);ang=math.atan2(v[1]-u[1],v[0]-u[0]);end=((u[0]+v[0])/2,(u[1]+v[1])/2)
    d.line([(end[0]-10*math.cos(ang-.5),end[1]-10*math.sin(ang-.5)),end,(end[0]-10*math.cos(ang+.5),end[1]-10*math.sin(ang+.5))],fill=color,width=3)
 seen=set()
 for p in ps:
  for q in p['calls']:
   if q[4] in seen:continue
   seen.add(q[4]);x,y=xy(q);d.ellipse((x-4,y-4,x+4,y+4),fill='#17324a')
   label=q[2].replace(' (See)','').replace(' (Bodensee)','');d.text((min(max(x0+18,x+8),x0+560),y-22),label,font=font(17),fill='#17324a')
 box=(x0+8,y0+50,x0+762,y0+461);crop=layer.crop(box);canvas.paste(crop,box[:2],crop);draw=ImageDraw.Draw(canvas)
 counts=[sum(p['days'].get(date,0) for p in ps) for date in ['2026-09-04','2026-09-06']]
 draw.text((x0+18,y0+468),f'{counts[0]} Friday / {counts[1]} Sunday · full original dock chains',font=font(18),fill='#354f64')
draw.text((25,1170),'Shipping geometry © swisstopo · shoreline © FOEN, swisstopo (2007 reference) · acquired 8 September 2026',font=font(19),fill='#354f64')
draw.text((25,1204),'Generalized source-path inference with ≤150 m dock zones. No shipping-lane, navigation or operational-direction certification.',font=font(18),fill='#354f64')
canvas.save('docs/assets/thurgau-boat-review.png')
# Inspect every admitted dock at a fixed local scale, including all discrepancies.
docks={q[4]:q for p in accepted for q in p['calls']}
canvas=Image.new('RGB',(1600,1300),'#f7fafc');draw=ImageDraw.Draw(canvas)
draw.text((24,18),'Thurgau · all admitted dock attachments',font=font(30),fill='#17324a')
draw.text((24,60),'Circle = 150 m dock zone · orange = outside the 2007 shoreline polygon',font=font(19),fill='#354f64')
for panel,q in enumerate(docks.values()):
 x0=15+(panel%4)*398;y0=100+(panel//4)*375
 draw.rounded_rectangle((x0,y0,x0+382,y0+358),radius=10,fill='white',outline='#cdd8e0')
 title=q[2].replace(' (See)','').replace(' (Bodensee)','');draw.text((x0+12,y0+10),title,font=font(20),fill='#17324a')
 scale=.65;c=math.cos(math.radians(q[1]));center=(x0+191,y0+200)
 def xy(p):return(center[0]+(p[0]-q[0])*c*111320*scale,center[1]-(p[1]-q[1])*111320*scale)
 layer=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(layer)
 for poly in polygons:
  d.polygon([xy(p) for p in poly[0]],fill='#e5f1f6',outline='#94b9c9')
  for ring in poly[1:]:d.polygon([xy(p) for p in ring],fill='white',outline='#94b9c9')
 for p in accepted:
  for i,s in enumerate(p['segments']):
   if q[4] not in [p['calls'][i][4],p['calls'][i+1][4]]:continue
   d.line([xy(v) for v in s['path']],fill='#007aaf',width=2)
   for interval in s['water']['outsideIntervals']:d.line([xy(v) for v in interval['endpoints']],fill='#d67626',width=4)
 x,y=center;r=150*scale;d.ellipse((x-r,y-r,x+r,y+r),outline='#7c728a',width=2);d.ellipse((x-4,y-4,x+4,y+4),fill='#17324a')
 box=(x0+7,y0+43,x0+375,y0+350);crop=layer.crop(box);canvas.paste(crop,box[:2],crop);draw=ImageDraw.Draw(canvas)
draw.text((24,1245),'© swisstopo / FOEN · exact original GTFS coordinates · dock-area source discrepancies remain disclosed, not certified access.',font=font(19),fill='#354f64')
canvas.save('docs/assets/thurgau-boat-dock-review.png')
