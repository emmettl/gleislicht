import json,gzip,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
r=json.loads(Path('data/thurgau-wittenbach-sources/path-review.json').read_text());osm=json.loads(gzip.decompress(Path('data/thurgau-wittenbach-sources/osm.json.gz').read_bytes()))
e={(a['type'],a['id']):a for a in osm['elements']};font=lambda n:ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',n)
im=Image.new('RGB',(1500,950),'#f7fafc');d=ImageDraw.Draw(im)
d.text((28,20),'Wittenbach Zentrum · scoped turnaround inference',font=font(30),fill='#17324a')
d.text((28,66),'37 Friday journeys · four full 200/207 patterns · original platforms and all subsequent matcher paths retained',font=font(20),fill='#354f64')
colors=['#007d9c','#a65193','#479041','#cb7624']
for panel in range(2):
 x0=22+740*panel;y0=110;d.rounded_rectangle((x0,y0,x0+716,y0+735),radius=12,fill='white',outline='#cdd8e0')
 title='224 m mapped road + bounded platform access' if panel==0 else 'All four complete original stop chains'
 d.text((x0+16,y0+16),title,font=font(23),fill='#17324a')
 pts=r['turn']['path'] if panel==0 else [q for p in r['patterns'] for path in p['paths'] for q in path]
 c=math.cos(math.radians(47.46));xs=[p[0]*c for p in pts];ys=[p[1] for p in pts];bx,by=min(xs),min(ys);w=max(xs)-bx;h=max(ys)-by;factor=min(625/w,600/h)
 def xy(p):return(x0+358+(p[0]*c-bx-w/2)*factor,y0+390-(p[1]-by-h/2)*factor)
 layer=Image.new('RGBA',im.size);ld=ImageDraw.Draw(layer)
 if panel==0:
  for key,obj in e.items():
   if key[0]=='way' and obj.get('tags',{}).get('highway') in ['secondary','residential','tertiary']:
    points=[[e['node',n]['lon'],e['node',n]['lat']] for n in obj['nodes']];ld.line([xy(q) for q in points],fill='#d8e0e4',width=7)
  path=r['turn']['path'];ld.line([xy(q) for q in path],fill=colors[0],width=4)
  for i in [4,10,18,26,34]:
   a,b=map(xy,path[i:i+2]);ang=math.atan2(b[1]-a[1],b[0]-a[0]);m=((a[0]+b[0])/2,(a[1]+b[1])/2)
   ld.line([(m[0]-13*math.cos(ang-.45),m[1]-13*math.sin(ang-.45)),m,(m[0]-13*math.cos(ang+.45),m[1]-13*math.sin(ang+.45))],fill='#165467',width=3)
  for q,title in [(r['from'],'Platform 2 · start'),(r['to'],'Platform 1 · end')]:
   x,y=xy(q);ld.ellipse((x-6,y-6,x+6,y+6),fill='#17324a');ld.text((min(x+10,x0+540),y-27 if q==r['from'] else y+12),title,font=font(18),fill='#17324a')
 else:
  for p,col in zip(r['patterns'],colors):
   for path in p['paths']:ld.line([xy(q) for q in path],fill=col,width=2)
   for q in p['stops']:
    x,y=xy(q);ld.ellipse((x-2,y-2,x+2,y+2),fill=col)
  for q in [r['patterns'][0]['stops'][0],r['patterns'][0]['stops'][-1]]:
   x,y=xy(q);ld.text((min(x+10,x0+520),y-24),q[2],font=font(18),fill='#17324a')
 box=(x0+10,y0+57,x0+706,y0+710);crop=layer.crop(box);im.paste(crop,box[:2],crop);d=ImageDraw.Draw(im)
d.text((28,875),'© OpenStreetMap contributors · ODbL 1.0 · historical state 2 September 2026 · acquired 8 September 2026',font=font(20),fill='#354f64')
d.text((28,912),'Approach / full roundabout / return follow source vertices. Platform connectors: 6.72 m and 4.08 m. Operator routing remains unverified.',font=font(18),fill='#354f64')
im.save('docs/assets/thurgau-wittenbach-turn-review.png')
