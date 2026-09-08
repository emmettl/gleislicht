"""Optional fresh official Arosa context acquisition; inspect receipts before repinning."""
import urllib.request,pathlib,gzip,hashlib,json,datetime
out=pathlib.Path('data/graubuenden-cableway-sources');rows=[]
for name,url in {'arosa-hours':'https://arosalenzerheide.swiss/en/Arosa/Summer/Mountain-railways/Operating-hours-summer','arosa-lifts':'https://arosalenzerheide.swiss/de/Skigebiet/Bergbahnen/Betriebszeiten'}.items():
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Gleislicht source review'}),timeout=35) as r:
  body=r.read();b=gzip.compress(body,mtime=0);file=name+'.html.gz';(out/file).write_bytes(b)
  rows.append({'url':url,'effectiveUrl':r.url,'status':r.status,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':file,'sha256':hashlib.sha256(b).hexdigest(),'bodySha256':hashlib.sha256(body).hexdigest()})
(out/'arosa-evidence.json').write_text(json.dumps({'purpose':'Official seasonal and section context only. Preserve source timetable times and FOT geometry; no live-service or exact-departure certification.','responses':rows},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'responses':len(rows)}))
