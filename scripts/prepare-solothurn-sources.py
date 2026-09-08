"""Preserve and decode the surveyed Solothurn network and 2026 canton boundaries.

Uses cached, hash-verified survey responses; never treats aktuell as immutable.
Python stdlib only. Retains every original LV95 vertex and all ten districts.
"""
import argparse
import base64
import gzip
import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path
import importlib.util
_spec = importlib.util.spec_from_file_location('bern_sources', Path(__file__).with_name('prepare-bern-sources.py'))
_decoder = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_decoder)
sha, rows, features = _decoder.sha, _decoder.rows, _decoder.features


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='/private/tmp/gleislicht-national-survey')
    p.add_argument('--boundary', help='Original swissBOUNDARIES3D 2026-01 GeoPackage (first run only)')
    p.add_argument('--output', default='data/solothurn-sources')
    args = p.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    probes = json.loads(Path('data/swiss-transit-source-probes.json').read_text())['probes']
    records = []
    for key, filename in [('so-lines', 'ch.so.avt.oev.gpkg.zip'), ('so-metadata', 'metadata.html'),
                          ('so-terms', 'terms.html'), ('so-publications', 'publications.json')]:
        record = next(r for r in probes if r['id'] == key)
        path = out / filename
        data = path.read_bytes() if path.exists() else (Path(args.cache) / (key + '.body')).read_bytes()
        assert sha(data) == record['sha256'], f'Unreviewed source bytes: {key}'
        path.write_bytes(data)
        records.append({'file': filename, 'url': record['url'], 'sha256': sha(data), 'bytes': len(data), 'acquiredAt': record['checkedAt']})
    with zipfile.ZipFile(out / 'ch.so.avt.oev.gpkg.zip') as z, tempfile.TemporaryDirectory() as tmp:
        data = z.read('ch.so.avt.oev.gpkg')
        db = Path(tmp) / 'source.gpkg'
        db.write_bytes(data)
        with sqlite3.connect(db) as c:
            lines = features(rows(c, 'netz'), 'geometrie')
            stops = features(rows(c, 'haltestelle'), 'geometrie')
            assert not rows(c, 'linestructure')
        (out / 'validation.log').write_bytes(z.read('validation.log'))
    assert len(lines) == 3951 and len(stops) == 775
    boundary_path = out / 'boundary-rows.json.gz'
    if args.boundary:
        with sqlite3.connect(args.boundary) as c:
            canton = rows(c, 'tlm_kantonsgebiet', 'kantonsnummer=11')
            districts = rows(c, 'tlm_bezirksgebiet', 'kantonsnummer=11')
        assert len(canton) == 1 and len(districts) == 10
        pack = lambda rr: [{**r, 'geom': base64.b64encode(r['geom']).decode()} for r in rr]
        boundary = {'sourceSha256': sha(Path(args.boundary).read_bytes()), 'edition': '2026-01', 'canton': pack(canton), 'districts': pack(districts)}
        boundary_path.write_bytes(gzip.compress(json.dumps(boundary).encode(), mtime=0))
    boundary = json.loads(gzip.decompress(boundary_path.read_bytes()))
    unpack = lambda rr: [{**r, 'geom': base64.b64decode(r['geom'])} for r in rr]
    publication = next(r for r in json.loads((out / 'publications.json').read_bytes()) if r['identifier'] == 'ch.so.avt.oev')
    assert publication['lastPublishingDate'] == '2025-12-17'
    metadata = {'schemaVersion': 1, 'sourceCrs': 'EPSG:2056', 'records': records,
                'packagePublished': publication['lastPublishingDate'], 'geometrySurveyDate': None,
                'vintageNote': 'Publication date is not a survey date; no per-edge survey date supplied.',
                'archiveSha256': records[0]['sha256'], 'geopackageSha256': sha(data),
                'attribution': 'Öffentlicher Verkehr — Amt für Verkehr und Tiefbau / Amt für Geoinformation, Kanton Solothurn',
                'metadataUrl': records[1]['url'], 'termsUrl': records[2]['url'],
                'license': 'Free commercial and noncommercial use; attribution recommended. No Creative Commons licence assigned.',
                'sourceExclusion': 'Night services explicitly excluded by publisher.',
                'boundary': {'edition': boundary['edition'], 'sourceSha256': boundary['sourceSha256'],
                             'snapshotSha256': sha(boundary_path.read_bytes()), 'attribution': '© swisstopo',
                             'sourceUrl': 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip',
                             'termsUrl': 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices'}}
    result = {'metadata': metadata, 'lines': lines, 'stops': stops,
              'canton': features(unpack(boundary['canton']), 'geom'), 'districts': features(unpack(boundary['districts']), 'geom')}
    (out / 'decoded.json.gz').write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    (out / 'sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(f'Decoded {len(lines)} network records, {len(stops)} source stops, {len(result["districts"])} districts')


if __name__ == '__main__':
    main()
