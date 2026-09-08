import urllib.request,pathlib,gzip,hashlib,json,datetime
out=pathlib.Path('data/graubuenden-cableway-sources');rows=[]
urls={
 'samnaun-modernisation':'https://bergbahnen-samnaun.ch/neuheiten-skiarena/',
 'samnaun-summer':'https://bergbahnen-samnaun.ch/sommer/betriebszeiten-sommer/',
 'chur-summer':'https://www.churbergbahnen.ch/en/cableway/opening-hours-and-rates',
 'heidbuel-summer':'https://arosalenzerheide.swiss/en/Lenzerheide/Summer/Resort-Lifts/Operating-hours-summer',
 'marguns-summer':'https://www.mountains.ch/de/anlagen/grossrevision-sommer-2026/'}
for name,url in urls.items():
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Gleislicht source review'}),timeout=35) as r:
  body=r.read();file=name+'.html.gz';b=gzip.compress(body,mtime=0);(out/file).write_bytes(b)
  rows.append({'url':url,'effectiveUrl':r.url,'status':r.status,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':file,'sha256':hashlib.sha256(b).hexdigest(),'bodySha256':hashlib.sha256(body).hexdigest()})
(out/'expansion-evidence.json').write_text(json.dumps({'purpose':'Official operator context; no timetable substitution or geometry tracing. Samnaun L1 refurbishment/L2 summer operation blocks the exact-number candidate despite its small endpoint gaps.','responses':rows},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'responses':len(rows),'bytes':sum((out/r['file']).stat().st_size for r in rows)}))
