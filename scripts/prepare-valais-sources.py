"""Preserve and decode complete 2026-01 Valais canton/district boundary rows."""
import argparse
import base64
import gzip
import json
from pathlib import Path
import sqlite3
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('boundary_decoder', Path(__file__).with_name('prepare-bern-sources.py'))
decoder = module_from_spec(spec)
spec.loader.exec_module(decoder)

def prepare(boundary=None, output='data/valais-sources'):
    out = Path(output); out.mkdir(parents=True, exist_ok=True)
    snapshot = out/'boundary-rows.json.gz'
    if boundary:
        raw = Path(boundary).read_bytes()
        assert decoder.sha(raw) == '1f122cb7a06f2d312a84b7c0a91116348ba907054d487f0a70b9d2302984e6fc', 'Unreviewed boundary release'
        with sqlite3.connect(boundary) as db:
            canton = decoder.rows(db, 'tlm_kantonsgebiet', 'kantonsnummer=23')
            districts = decoder.rows(db, 'tlm_bezirksgebiet', 'kantonsnummer=23')
        assert len(canton) == 1 and len(districts) == 13
        pack = lambda rows: [{k: base64.b64encode(v).decode() if isinstance(v, bytes) else v for k,v in row.items()} for row in rows]
        snapshot.write_bytes(gzip.compress(json.dumps(dict(sourceSha256=decoder.sha(raw), edition='2026-01', canton=pack(canton), districts=pack(districts))).encode(), mtime=0))
    rows = json.loads(gzip.decompress(snapshot.read_bytes()))
    unpack = lambda records: [{**r, 'geom': base64.b64decode(r['geom'])} for r in records]
    result = dict(canton=decoder.features(unpack(rows['canton']), 'geom'), districts=decoder.features(unpack(rows['districts']), 'geom'), metadata=dict(
        publisher='swisstopo', attribution='© swisstopo', edition=rows['edition'], sourceSha256=rows['sourceSha256'], snapshotSha256=decoder.sha(snapshot.read_bytes()),
        sourceUrl='https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip',
        termsUrl='https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices', transformation='Original LV95 polygon vertices and holes; no simplification. GTFS membership uses approximate swisstopo WGS84 to LV95 conversion with 10 m boundary sensitivity audit.'))
    assert result['canton'][0]['properties']['kantonsnummer'] == 23 and len(result['districts']) == 13
    (out/'decoded.json.gz').write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print('Decoded full Valais canton and all 13 districts')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--boundary'); p.add_argument('--output',default='data/valais-sources')
    a=p.parse_args(); prepare(a.boundary,a.output)
