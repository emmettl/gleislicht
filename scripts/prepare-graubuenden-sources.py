"""Preserve official source discovery responses, including HTTP-200 backend errors.
No local linework enters the motion feed without a dated identity/reuse review.
"""
import datetime, gzip, hashlib, json, subprocess
from pathlib import Path

ROOT = Path('data/graubuenden-sources')
URLS = {
    'boundary': 'https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/18?sr=4326&geometryFormat=geojson',
    'catalogue': 'https://katalog.geo.gr.ch/',
    'geodata': 'https://geo.gr.ch/geodaten',
    'geogr-current': 'https://geogr.ch/geodaten',
    'map': 'https://map.geo.gr.ch/',
    'map-dynamic': 'https://map.geo.gr.ch/dynamic.json',
    'service-catalogue': 'https://geo.gr.ch/geodienste/katalog',
    'service-catalogue-inner': 'https://katalog.geo.gr.ch/gis-tools/gdds/inventar/geodateninventar.php?doku_typ_list=6,17&header=false&doku_typ_id=6',
    'wfs-guidance': 'https://geo.gr.ch/geodienste/wfs-nutzung',
    'geogr': 'https://www.geogr.ch/links.html',
    'network': 'https://www.gr.ch/DE/institutionen/verwaltung/diem/aev/oev/angebote/liniennetz/Seiten/liniennetz.aspx',
    'search-services': 'https://ws.geo.gr.ch/reports/v1/search-list/pdf?job_ref=false&reverse=false',
    'oev-wms-probe': 'https://wms.geo.gr.ch/oev?SERVICE=WMS&REQUEST=GetCapabilities',
    'oev-wfs-probe': 'https://wfs.geo.gr.ch/oev?SERVICE=WFS&REQUEST=GetCapabilities',
}

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    records = []
    for name, url in URLS.items():
        target = ROOT / (name + '.response')
        p = subprocess.run(['curl', '-LsS', '--max-time', '45', '-w', '%{http_code}\n%{url_effective}', url, '-o', str(target)], capture_output=True, text=True)
        body = target.read_bytes() if target.exists() else b''
        if name == 'boundary':
            assert p.returncode == 0 and json.loads(body)['feature']['properties']['ak'] == 'GR', 'Invalid canton boundary'
            (ROOT/'boundary.json').write_bytes(body)
        lower = body.lower()
        metadata = p.stdout.splitlines()
        record = dict(id=name, url=url, retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), status=metadata[0] if metadata else None,
            effectiveUrl=metadata[-1] if metadata else None, bytes=len(body), sha256=hashlib.sha256(body).hexdigest(),
            backendError=any(token in lower for token in [b'ora-', b'oci_connect', b'serviceexception', b'exceptionreport']),
            wmsCapabilities=b'<WMS_Capabilities' in body or b'<WMT_MS_Capabilities' in body,
            wfsCapabilities=b'WFS_Capabilities' in body, transportError=p.stderr.strip() or None,
            file=name+'.response.gz')
        (ROOT/record['file']).write_bytes(gzip.compress(body, mtime=0))
        target.unlink(missing_ok=True)
        records.append(record)
        print(name, record['status'], record['bytes'], record['backendError'], flush=True)
    (ROOT/'probes.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__': main()
