"""Extract the exact Brugg 368 relation and all referenced way nodes from OSM XML."""
import argparse,hashlib,json,pathlib,xml.etree.ElementTree as E
p=argparse.ArgumentParser();p.add_argument('--osm',required=True);p.add_argument('--output',required=True);a=p.parse_args()
nodes={};ways={};relation=None;base=None
for _,e in E.iterparse(a.osm,events=['end']):
 if e.tag=='meta':base=e.attrib.get('osm_base')
 elif e.tag=='node':
  nodes[e.attrib['id']]={'point':[float(e.attrib['lon']),float(e.attrib['lat'])],'tags':{c.attrib['k']:c.attrib['v']for c in e.findall('tag')}};e.clear()
 elif e.tag=='way':
  ways[e.attrib['id']]={'id':e.attrib['id'],'nodes':[c.attrib['ref']for c in e.findall('nd')],'tags':{c.attrib['k']:c.attrib['v']for c in e.findall('tag')}};e.clear()
 elif e.tag=='relation':
  if e.attrib['id']=='10832272':relation={'id':e.attrib['id'],'tags':{c.attrib['k']:c.attrib['v']for c in e.findall('tag')},'members':[dict(c.attrib)for c in e.findall('member')]}
  e.clear()
assert relation and relation['tags']['gtfs:route_id']=='96-160-2-j26-1'
selected=[ways[m['ref']]for m in relation['members']if m['type']=='way'and m['role']=='']
refs={n for w in selected for n in w['nodes']}|{m['ref']for m in relation['members']if m['type']=='node'}
result={'schemaVersion':1,'source':{'publisher':'OpenStreetMap contributors','license':'ODbL-1.0','osmBase':base,'retrievedOn':'2026-09-08','osmSha256':hashlib.sha256(pathlib.Path(a.osm).read_bytes()).hexdigest(),'url':'https://www.openstreetmap.org/relation/10832272','note':'Complete ordered outbound relation; relation GTFS tags reference 2025-12-18. Compare with the full pinned 20260902 stop pattern; not certified actual running lanes.'},'relation':relation,'ways':selected,'nodes':{n:nodes[n]for n in sorted(refs)}}
pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(result['source'])
