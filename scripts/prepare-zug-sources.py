"""Preserve and decode Zug Buslinien; reconcile every WFS feature in LV95.

Stdlib only. The ZIP stays authoritative; WFS equality does not prove vintage.
Run once with --acquire (survey cache and downloaded responses), then offline.
"""
import argparse
import base64
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import xml.etree.ElementTree as ET
import zipfile

spec = importlib.util.spec_from_file_location('bern_source', Path(__file__).with_name('prepare-bern-sources.py'))
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
sha = shared.sha


def wgs84(point):
    # swisstopo approximate LV95 -> WGS84 polynomial, full floating precision.
    y, x = (point[0] - 2600000) / 1000000, (point[1] - 1200000) / 1000000
    return [(2.6779094 + 4.728982*y + .791484*y*x + .1306*y*x*x - .0436*y*y*y)*100/36,
            (16.9023892 + 3.238272*x - .270978*y*y - .002528*x*x - .0447*y*y*x - .014*x*x*x)*100/36]


def transform(coordinates):
    return wgs84(coordinates) if isinstance(coordinates[0], (int, float)) else [transform(c) for c in coordinates]


def reconcile(features, xml, hits):
    root = ET.fromstring(xml)
    members = root.findall('{http://www.opengis.net/gml}featureMember')
    assert len(members) == int(ET.fromstring(hits).attrib['numberOfFeatures']) == len(features), 'Truncated WFS'
    expected = {str(f['properties']['t_id']): f for f in features}
    assert len(expected) == len(features), 'Duplicate archive t_id'
    seen, ids, maximum = set(), set(), 0
    for member in members:
        f = member[0]
        fid = f.attrib['{http://www.opengis.net/gml}id']
        tid = f.find('{http://www.qgis.org/gml}t_id').text
        assert tid not in seen and fid not in ids, 'Duplicate WFS identity'
        seen.add(tid); ids.add(fid)
        original = expected[tid]
        assert f.find('{http://www.qgis.org/gml}liniennummer').text == original['properties']['liniennummer'], 'Changed line membership'
        line = f.find('.//{http://www.opengis.net/gml}LineString')
        assert line.attrib['srsName'] == 'EPSG:2056'
        pos = line.find('{http://www.opengis.net/gml}posList')
        assert pos.attrib['srsDimension'] == '2'
        values = list(map(float, pos.text.split()))
        points = original['geometry']['coordinates']
        assert len(values) == len(points) * 2, 'Changed vertex count'
        delta = max(abs(a-b) for a,b in zip(values, [v for point in points for v in point]))
        assert delta <= .001, 'WFS/archive coordinate change exceeds one millimetre'
        maximum = max(maximum, delta)
    assert seen == set(expected), 'Missing WFS identity'
    return {'archiveFeatures': len(features), 'wfsFeatures': len(members), 'equalWithinOneMillimetre': True,
            'maximumCoordinateDeltaMetres': maximum,
            'comparison': 'Every t_id, exact comma-separated line label, ordered vertex count and each LV95 ordinate, with 1 mm tolerance for export precision. WFS feature IDs differ from GeoPackage IDs.',
            'vintageConclusion': 'Current WFS repeats the archive geometry within export precision. Neither a 2026 alignment date nor current diversions are established.'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', default='data/zug-sources')
    p.add_argument('--acquire', action='store_true')
    p.add_argument('--survey', default='/private/tmp/gleislicht-national-survey')
    p.add_argument('--responses', default='/private/tmp')
    p.add_argument('--municipalities', default='/private/tmp/swissboundaries3d-2026/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg')
    args = p.parse_args()
    out, cache, responses = Path(args.output), Path(args.survey), Path(args.responses)
    out.mkdir(parents=True, exist_ok=True)
    if args.acquire:
        probes = {r['id']: r for r in json.loads(Path('data/swiss-transit-source-probes.json').read_text())['probes']}
        sources = []
        for source, file in [('zg-download', 'buslinien.zip'), ('zg-wfs', 'capabilities.xml'), ('zg-terms', 'terms.html'), ('zg-catalogue', 'catalogue.html')]:
            content = (cache / f'{source}.body').read_bytes()
            assert sha(content) == probes[source]['sha256']
            (out / file).write_bytes(content)
            sources.append({**probes[source], 'file': file})
        urls = {
            'wfs.gml': 'https://services.geo.zg.ch/ows/buslinien?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=zg_buslinien_tooltip&SRSNAME=EPSG:2056',
            'wfs-hits.xml': 'https://services.geo.zg.ch/ows/buslinien?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=zg_buslinien_tooltip&RESULTTYPE=hits',
            'zvb-2026.html': 'https://www.zvb.ch/fahrplan/fahrplan-zvb-2026/',
            'boundary.json': 'https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/9?sr=4326&geometryFormat=geojson',
        }
        for file, url in urls.items():
            source = responses / f'zug-{file}'
            content = source.read_bytes()
            (out / file).write_bytes(content)
            sources.append({'file': file, 'url': url, 'retrievedAt': datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).isoformat(), 'sha256': sha(content), 'bytes': len(content)})
        with sqlite3.connect(args.municipalities) as c:
            rows = shared.rows(c, 'tlm_hoheitsgebiet', "kantonsnummer=9 AND objektart='Gemeindegebiet'")
        assert len(rows) == 11
        snapshot = {'edition': '2026-01', 'sourceSha256': sha(Path(args.municipalities).read_bytes()),
                    'rows': [{**r, 'geom': base64.b64encode(r['geom']).decode()} for r in rows]}
        content = gzip.compress(json.dumps(snapshot).encode(), mtime=0)
        (out / 'municipality-rows.json.gz').write_bytes(content)
        sources.append({'file': 'municipality-rows.json.gz', 'sha256': sha(content), 'bytes': len(content), 'vintage': '2026-01', 'attribution': '© swisstopo', 'url': 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip'})
        (out / 'acquisition.json').write_text(json.dumps({'sources': sources}, indent=2) + '\n')
    catalogue = json.loads((out / 'acquisition.json').read_text())
    for s in catalogue['sources']:
        assert sha((out / s['file']).read_bytes()) == s['sha256'], f"Changed {s['file']}"
    archive = (out / 'buslinien.zip').read_bytes()
    assert sha(archive) == 'bcc43b676a4459a6cfa6b330fbe24dd7d66a84238aee4dd9e72a9b95628337a5'
    with zipfile.ZipFile(out / 'buslinien.zip') as z, tempfile.TemporaryDirectory() as temp:
        db = Path(temp) / 'bus.gpkg'
        db.write_bytes(z.read('geopackage/Buslinien.gpkg'))
        with sqlite3.connect(db) as c:
            features = shared.features(shared.rows(c, 'Buslinien'), 'geom')
            modified = c.execute('SELECT last_change FROM gpkg_contents').fetchone()[0]
    comparison = reconcile(features, (out / 'wfs.gml').read_bytes(), (out / 'wfs-hits.xml').read_bytes())
    municipalities = json.loads(gzip.decompress((out / 'municipality-rows.json.gz').read_bytes()))
    municipal_features = shared.features([{**r, 'geom': base64.b64decode(r['geom'])} for r in municipalities['rows']], 'geom')
    for name, items in [('bus.geojson', features), ('municipalities.geojson', municipal_features)]:
        for f in items:
            f['geometry']['coordinates'] = transform(f['geometry']['coordinates'])
        content = json.dumps({'type': 'FeatureCollection', 'features': items}, ensure_ascii=False, separators=(',', ':')).encode()
        (out / name).write_bytes(content)
        catalogue['sources'].append({'file': name, 'sha256': sha(content), 'bytes': len(content), 'derivedFrom': 'buslinien.zip' if name == 'bus.geojson' else 'municipality-rows.json.gz'})
    catalogue.update({'schemaVersion': 1, 'archiveLastModified': '2025-09-18T12:11:55Z', 'geopackageLastChange': modified,
                      'attribution': 'Quelle: GIS Kanton Zug', 'license': 'Free commercial/noncommercial use with mandatory source credit; no CC licence assigned',
                      'sourceCrs': 'EPSG:2056', 'outputCrs': 'EPSG:4326', 'transformation': 'swisstopo approximate polynomial; no simplification; full floating precision, graph vertex identity rounded to 7 decimal places',
                      'comparison': comparison})
    (out / 'sources.json').write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(comparison, indent=2))


if __name__ == '__main__':
    main()
