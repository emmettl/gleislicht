"""Archive official review evidence; never approves changed geometry or policy."""
import datetime, gzip, hashlib, json, pathlib, urllib.parse, urllib.request, urllib.error
root = pathlib.Path('data/graubuenden-rail-review')
root.mkdir(parents=True, exist_ok=True)
queries = {
 'rhb-sagliains': 'https://www.rhb.ch/de/aktuelles/blog/sichere-wege-fuer-die-kleinsten/',
 'rhb-landwasser-station': 'https://www.rhb.ch/de/informationen/bahnhoefe/schmitten-gr-landwasserviadukt/',
 'rhb-landwasser-opening': 'https://www.rhb.ch/it/medien/medienmitteilungen/viaduktshuttle-auf-dem-landwasserviadukt/',
 'rhb-viaduktshuttle': 'https://www.rhb.ch/de/ausfluege/viaduktshuttle/',
 'sbb-bern-platforms': 'https://www.sbb.ch/de/reiseinformationen/bahnhoefe/bahnhof-finden/bahnhof-bern/bahnhofsbeschrieb.html',
}
for name in ['Sagliains', 'Schmitten']:
 queries['sbb-'+name.lower()] = 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie-mit-polygon/records?' + urllib.parse.urlencode({'where': 'search("'+name+'")', 'limit': 100})
files=[]
for name,url in queries.items():
 try:
  response=urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Gleislicht source review'}), timeout=60)
 except urllib.error.HTTPError as e:
  response=e
 with response as r:
  data=r.read();filename=name+'.response.gz';(root/filename).write_bytes(gzip.compress(data,mtime=0))
  files.append({'file':filename,'url':url,'effectiveUrl':r.url,'status':r.status,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(data).hexdigest(),'compressedSha256':hashlib.sha256((root/filename).read_bytes()).hexdigest()})
  print(name,r.status,len(data),flush=True)
(root/'sources.json').write_text(json.dumps({'purpose':'Official supporting evidence and rejected alternative geometry. Operator pages establish station/service identity; geometry remains the pinned FOT source. No operator page or SBB geometry is incorporated in the public path database.','files':files},indent=2,ensure_ascii=False)+'\n')
