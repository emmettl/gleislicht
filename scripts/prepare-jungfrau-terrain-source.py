"""Bounded extraction of pinned swissTLM3D PolyLineZ railway records; stdlib only."""
import io,urllib.request,zipfile,json
URL='https://data.geo.admin.ch/ch.swisstopo.swisstlm3d/swisstlm3d_2026-02/swisstlm3d_2026-02_2056_5728.shp.zip'
class Remote(io.RawIOBase):
 def __init__(self):
  r=urllib.request.urlopen(urllib.request.Request(URL,method='HEAD')); self.size=int(r.headers['Content-Length']);self.etag=r.headers['ETag'];self.pos=0
  if r.headers.get('x-amz-meta-sha256')!='75086b5aa7e721f5ad2ea080e14e9e3f42d5e0afdee31c2e3c162f412fab4114':raise ValueError('Source archive changed; review required')
 def seekable(self):return True
 def readable(self):return True
 def tell(self):return self.pos
 def seek(self,n,w=0):self.pos=n if w==0 else self.pos+n if w==1 else self.size+n;return self.pos
 def read(self,n=-1):
  if n<0:n=self.size-self.pos
  if n==0:return b''
  if n>200_000_000:raise ValueError('Unexpected oversized range')
  req=urllib.request.Request(URL,headers={'Range':f'bytes={self.pos}-{self.pos+n-1}','If-Match':self.etag})
  with urllib.request.urlopen(req) as r:
   if r.status!=206: raise ValueError('Server ignored range request')
   b=r.read(n+1)
  if len(b)!=n:raise ValueError('Incomplete range')
  self.pos+=n;return b

import argparse,struct,hashlib
from pathlib import Path
argsParser=argparse.ArgumentParser()
argsParser.add_argument('--cache',default='/private/tmp/jungfrau-tlm')
argsParser.add_argument('--output',default='data/jungfrau-terrain-source.json')
argsParser.add_argument('--bounds',type=float,nargs=4,default=[2630000,1153000,2647000,1174000],metavar=('MIN_E','MIN_N','MAX_E','MAX_N'))
args=argsParser.parse_args()
if args.bounds[0]>=args.bounds[2] or args.bounds[1]>=args.bounds[3]:raise ValueError('Invalid extraction bounds')
p=Path(args.cache);p.mkdir(parents=True,exist_ok=True)
if not all((p/('swissTLM3D_TLM_EISENBAHN'+ext)).exists() for ext in ['.shp','.dbf','.prj','.shx']):
 z=zipfile.ZipFile(Remote())
 for f in z.infolist():
  if 'EISENBAHN' in f.filename.upper() and f.filename.endswith(('.shp','.shx','.dbf','.prj')):
   (p/f.filename.split(chr(92))[-1]).write_bytes(z.read(f))
dbf=(p/'swissTLM3D_TLM_EISENBAHN.dbf').read_bytes();shp=(p/'swissTLM3D_TLM_EISENBAHN.shp').read_bytes()
expected={'.dbf': '8961ca8542ff99bafa57024ab265ae00c68c16bf7fe8d6fc674c7a1e5c04bf17', '.shp': '512a3d3300337e34f28be40e06ce0f049e32d31709c8de56e458dd48eb0eec07', '.prj': 'f160fd6f149ff8288abd2a59f56556d034e87a0fda3dbf463761faf4210c30f5', '.shx': '7aa46361d75ba26bb97615d06ee8b164328f8b6a9d97c54dee36d7e817ece78e'}
for ext,checksum in expected.items():
 if hashlib.sha256((p/('swissTLM3D_TLM_EISENBAHN'+ext)).read_bytes()).hexdigest()!=checksum:raise ValueError('Cached railway source changed')
n=struct.unpack_from('<I',dbf,4)[0];hl,rl=struct.unpack_from('<HH',dbf,8);fields=[];pos=32
while dbf[pos]!=13:
 d=dbf[pos:pos+32];fields.append((d[:11].split(b'\0')[0].decode(),chr(d[11]),d[16]));pos+=32

features=[];pos=100;i=0
while pos<len(shp):
 rid,length=struct.unpack_from('>II',shp,pos);pos+=8;b=shp[pos:pos+length*2];pos+=length*2
 typ=struct.unpack_from('<I',b)[0];r=dbf[hl+i*rl:hl+(i+1)*rl];i+=1
 if typ==0:continue
 if typ!=13:raise ValueError(typ)
 box=struct.unpack_from('<4d',b,4)
 if box[0]>args.bounds[2] or box[2]<args.bounds[0] or box[1]>args.bounds[3] or box[3]<args.bounds[1]:continue
 props={};off=1
 for name,t,l in fields:
  value=r[off:off+l].decode('utf-8').strip();off+=l
  props[name]=float(value) if value and t in 'NF' else value
 np,ns=struct.unpack_from('<II',b,36);parts=list(struct.unpack_from('<'+'I'*np,b,44))+[ns];xy=struct.unpack_from('<'+'d'*(2*ns),b,44+4*np);z=struct.unpack_from('<'+'d'*ns,b,44+4*np+ns*16+16)
 points=[[round(xy[j*2],3),round(xy[j*2+1],3),round(z[j],3)] for j in range(ns)]
 features.append({'id':props['UUID'],'properties':props,'paths':[points[parts[j]:parts[j+1]] for j in range(np)]})
result={'source':'swissTLM3D 2026-02','sourceCrs':'EPSG:2056 / LN02','sourceUrl':URL,'productUrl':'https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d','catalogueUrl':'https://www.swisstopo.admin.ch/dam/de/sd-web/A3kQ2dAgenqG/2025-03','archiveSha256':'75086b5aa7e721f5ad2ea080e14e9e3f42d5e0afdee31c2e3c162f412fab4114','bounds':args.bounds,'sha256':{k.name:hashlib.sha256(k.read_bytes()).hexdigest() for k in p.glob('*')},'features':features}
Path(args.output).write_text(json.dumps(result,separators=(',',':'))+'\n')
print(f'Wrote {len(features)} railway features in the requested audit bounds.')
