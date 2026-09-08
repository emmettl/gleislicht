"""Reproducible public source investigation; retain exact responses and receipts."""
from pathlib import Path
import subprocess,json,hashlib,datetime
out=Path('data/valais-sources/research');out.mkdir(parents=True,exist_ok=True)
urls={
 'geoservices.html':'https://geo.vs.ch/geoservices',
 'inventory.pdf':'https://www.vs.ch/documents/17311/17591/Inventaire%2Bdes%2Bg%C3%A9odonn%C3%A9es%2B-%2BInventar%2Bder%2BGeodaten/2fd849d0-ab9f-4bfc-965a-3920ebd18a08',
 'internet-geodata.pdf':'https://geo.vs.ch/documents/17311/40640865/Listing_Geodata_Internet.pdf/207b4e10-6b0b-7643-d820-28e1690d8e89?t=1778672921609&v=2.0',
 'route-service.json':'https://sit.vs.ch/arcgis/rest/services/Route/MapServer?f=pjson',
 'planning-mobility.json':'https://services1.arcgis.com/rMlsWo8szOzlrpCq/arcgis/rest/services/PDc_mobilite/FeatureServer?f=pjson',
 'service-areas.json':'https://services1.arcgis.com/rMlsWo8szOzlrpCq/arcgis/rest/services/zones_dessertes/FeatureServer?f=pjson',
 'rail-catalogue.json':'https://data.geo.admin.ch/api/stac/v1/collections/ch.bav.schienennetz/items/schienennetz',
 'timetable-terms.html':'https://opentransportdata.swiss/en/terms-of-use/',
 'osm-terms.html':'https://www.openstreetmap.org/copyright',
}
urls.update({f'arcgis-page-{i+1}.json':f'https://www.arcgis.com/sharing/rest/search?f=json&q=owner%3ACC_GEO_Publisher&num=100&start={start}' for i,start in enumerate([1,101,201])})
receipts=[]
for name,url in urls.items():
 r=subprocess.run(['curl','-LsS','--max-time','60','-w','%{http_code}',url,'-o',str(out/name)],capture_output=True,text=True)
 b=(out/name).read_bytes() if (out/name).exists() else b''
 receipts.append(dict(file=name,url=url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),httpStatus=r.stdout,exitCode=r.returncode,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),error=r.stderr or None))
 print(name,r.stdout,len(b),flush=True)
(out/'requests.json').write_text(json.dumps(receipts,indent=2)+'\n')
