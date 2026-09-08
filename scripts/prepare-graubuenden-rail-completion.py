"""Archive bounded official-source probes for the Bern/Basel completion review."""
import datetime,gzip,hashlib,json,subprocess
from pathlib import Path
ROOT=Path('data/graubuenden-rail-completion')
URLS={
 'sbb-bern-description':'https://www.sbb.ch/de/reiseinformationen/bahnhoefe/bahnhof-finden/bahnhof-bern/bahnhofsbeschrieb.html',
 'db-switzerland':'https://www.dbinfrago.com/web/schienennetz/europa/strecken_in_der_schweiz-11156934',
 'db-basel-inb-2026':'https://www.dbinfrago.com/resource/blob/13174882/51e2dc5224da35667f1d133ecdaae239/Ril-302-5004-INB-2026-data.pdf',
 'geogr-shop':'https://geoshop.geogr.ch/de/welcome',
}
ROOT.mkdir(exist_ok=True);files=[]
for name,url in URLS.items():
 target=ROOT/(name+'.response');p=subprocess.run(['curl','-LsS','--max-time','40','-w','%{http_code}\n%{url_effective}',url,'-o',str(target)],capture_output=True,text=True)
 body=target.read_bytes() if target.exists() else b'';data=gzip.compress(body,mtime=0);file=name+'.response.gz';(ROOT/file).write_bytes(data);target.unlink(missing_ok=True)
 result={'file':file,'url':url,'status':p.stdout.splitlines()[0] if p.stdout else None,'effectiveUrl':p.stdout.splitlines()[-1] if p.stdout else None,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(body).hexdigest(),'compressedSha256':hashlib.sha256(data).hexdigest(),'bytes':len(body),'transportError':p.stderr.strip() or None};files.append(result);print(name,result['status'],len(body),flush=True)
(ROOT/'probes.json').write_text(json.dumps(files,ensure_ascii=False,indent=2)+'\n')
