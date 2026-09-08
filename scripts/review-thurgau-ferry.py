"""Review both full ferry directions and both dock approaches against original sources."""
import gzip,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
report=json.loads(Path('data/thurgau-ferry-sources/path-review.json').read_text())
patterns=report['patterns'][:2]
lake=json.loads(gzip.decompress(Path('data/thurgau-boat-sources/lakes.json.gz').read_bytes()))['results']
polygons=next(f for f in lake if f['id']==124)['geometry']['coordinates']
font=lambda n:ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',n)
canvas=Image.new('RGB',(1600,1000),'#f7fafc');draw=ImageDraw.Draw(canvas)
draw.text((25,20),'Thurgau · Romanshorn–Friedrichshafen ferry',font=font(30),fill='#17324a')
draw.text((25,67),'32 Friday / 28 Sunday journeys · two operators × two directions · original GTFS calls and times',font=font(20),fill='#354f64')
panels=[('Full 13.018 km crossing',(20,115,790,900),None,0),('Romanshorn Autoquai',(810,115,1580,492),patterns[0]['calls'][0],.8),('Friedrichshafen Fähre',(810,512,1580,900),patterns[0]['calls'][1],1.2)]
for title,box,dock,scale in panels:
 x0,y0,x1,y1=box;draw.rounded_rectangle(box,radius=12,fill='white',outline='#cdd8e0')
 draw.text((x0+18,y0+12),title,font=font(23),fill='#17324a')
 clip=(x0+8,y0+50,x1-8,y1-38)
 cx=(x0+x1)/2;cy=(y0+y1)/2+15
 if dock:
  lon,lat=dock[:2];c=math.cos(math.radians(lat));factor=111320*scale
 else:
  pts=patterns[0]['path'];lon=(min(p[0] for p in pts)+max(p[0] for p in pts))/2;lat=(min(p[1] for p in pts)+max(p[1] for p in pts))/2;c=math.cos(math.radians(lat));factor=min((x1-x0-130)/((max(p[0] for p in pts)-min(p[0] for p in pts))*c),(y1-y0-160)/(max(p[1] for p in pts)-min(p[1] for p in pts)))
 def xy(p):return(cx+(p[0]-lon)*c*factor,cy-(p[1]-lat)*factor)
 layer=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(layer)
 for poly in polygons:
  d.polygon([xy(q) for q in poly[0]],fill='#e5f1f6',outline='#94b9c9')
  for ring in poly[1:]:d.polygon([xy(q) for q in ring],fill='white',outline='#94b9c9')
 d.line([xy(q) for q in patterns[0]['previousRejectedPath']],fill='#ca6666',width=3)
 for i,p in enumerate(patterns):
  color='#007aaf' if not i else '#278153'
  d.line([xy(q) for q in p['path']],fill=color,width=2)
  # Distinct arrows show both directions without offsetting either source path.
  k=14 if not i else 10;a,b=map(xy,p['path'][k:k+2]);angle=math.atan2(b[1]-a[1],b[0]-a[0]);end=((a[0]+b[0])/2,(a[1]+b[1])/2)
  d.line([(end[0]-12*math.cos(angle-.55),end[1]-12*math.sin(angle-.55)),end,(end[0]-12*math.cos(angle+.55),end[1]-12*math.sin(angle+.55))],fill=color,width=4)
  for interval in p['water']['outsideIntervals']:d.line([xy(q) for q in interval['endpoints']],fill='#e38921',width=5)
 for q in patterns[0]['calls']:
  x,y=xy(q);d.ellipse((x-4,y-4,x+4,y+4),fill='#17324a')
  if not dock:d.text((max(x0+14,min(x+10,x1-245)),y-24),q[2],font=font(19),fill='#17324a')
 if dock:
  radius=10*scale;d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline='#7c728a',width=2)
 crop=layer.crop(clip);canvas.paste(crop,clip[:2],crop);draw=ImageDraw.Draw(canvas)
 note='Green / blue: OSM ferry · red: rejected generalized shipping' if not dock else 'Circle: 10 m dock zone · orange: shoreline discrepancy'
 draw.text((x0+18,y1-29),note,font=font(17),fill='#354f64')
draw.text((25,924),'OSM way 26255860 v25 (5 November 2025) · historical state 2 September 2026 · attachments ≤4.34 m',font=font(19),fill='#354f64')
draw.text((25,957),'© OpenStreetMap contributors (ODbL) · shoreline © FOEN, swisstopo (2007) · inferred route, no navigational certification',font=font(18),fill='#354f64')
canvas.save('docs/assets/thurgau-ferry-review.png')
