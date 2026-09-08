"""Optional fresh source acquisition. Review receipts before repinning policy."""
import urllib.request,pathlib,gzip,hashlib,json,datetime
out=pathlib.Path('data/graubuenden-cableway-sources');rows=[]
urls={
 'schatzalp-funicular':'https://www.schatzalp.ch/funicular/',
 'muottas-funicular':'https://www.muottasmuragl.ch/de/anlagen/',
 'parsenn-funicular':'https://www.davosklostersmountains.ch/de/mountains/sommer/live-info/aktuelle-betriebsinfos/sommerbetriebszeiten'}
for name,url in urls.items():
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Gleislicht source review'}),timeout=35) as r:
  body=r.read();file=name+'.html.gz';b=gzip.compress(body,mtime=0);(out/file).write_bytes(b)
  rows.append({'url':url,'effectiveUrl':r.url,'status':r.status,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':file,'sha256':hashlib.sha256(b).hexdigest(),'bodySha256':hashlib.sha256(body).hexdigest()})
(out/'funicular-evidence.json').write_text(json.dumps({'purpose':'Official funicular identity and summer operating context. Pinned GTFS remains authoritative for this dated study; source pages do not replace times or certify running tracks.','responses':rows},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'responses':len(rows)}))
