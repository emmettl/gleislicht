"""Acquire and losslessly decode Thurgau WFS layers and a cantonal boundary snapshot.

Run once with --download --boundary PATH, then reproduce offline without either.
The source has no geometry vintage: retrieval/metadata timestamps are kept separate.
"""
import argparse
import base64
from datetime import datetime, timezone
import gzip
import importlib.util
import json
import math
from pathlib import Path
import sqlite3
import subprocess
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('bern_sources', Path(__file__).with_name('prepare-bern-sources.py'))
bern = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bern)
features, rows, sha = bern.features, bern.rows, bern.sha

BASE = 'https://ows.geo.tg.ch/geofy_access_proxy/oev'
LAYERS = ['buslinie', 'bahnlinie_takt', 'buslinie_takt', 'bushalte', 'sammeltaxi']
NS = {'wfs': 'http://www.opengis.net/wfs/2.0', 'gml': 'http://www.opengis.net/gml/3.2'}


def decode_gml(data):
    root = ET.fromstring(data)
    assert root.tag == '{%s}FeatureCollection' % NS['wfs']
    members = root.findall('wfs:member', NS)
    assert int(root.attrib['numberMatched']) == int(root.attrib['numberReturned']) == len(members), 'Truncated WFS export'
    result = []
    for member in members:
        feature, = member
        props = {child.tag.split('}')[-1]: child.text for child in feature
                 if child.tag.startswith('{http://mapserver.gis.umn.edu/mapserver}') and not list(child)}
        geometry = feature.find('{http://mapserver.gis.umn.edu/mapserver}msGeometry')
        assert geometry is not None and len(geometry) == 1
        element = geometry[0]
        assert element.attrib.get('srsName') == 'urn:ogc:def:crs:EPSG::2056', 'Unexpected GML CRS/axis order'

        def points(element):
            assert element.attrib.get('srsDimension', '2') == '2'
            values = list(map(float, element.text.split()))
            assert len(values) % 2 == 0 and all(math.isfinite(v) for v in values)
            xy = [values[i:i + 2] for i in range(0, len(values), 2)]
            assert all(2600000 < x < 2800000 and 1200000 < y < 1350000 for x, y in xy), 'Swapped/out-of-area LV95 axes'
            return xy

        kind = element.tag.split('}')[-1]
        if kind == 'LineString':
            coordinates = points(element.find('gml:posList', NS))
            assert len(coordinates) >= 2
        elif kind == 'Point':
            coordinates, = points(element.find('gml:pos', NS))
        elif kind in ('MultiSurface', 'Polygon'):
            polygons = [element] if kind == 'Polygon' else element.findall('.//gml:Polygon', NS)
            coordinates = [[points(r) for r in p.findall('.//gml:posList', NS)] for p in polygons]
            assert coordinates and all(r[0] == r[-1] for p in coordinates for r in p)
            kind = 'MultiPolygon'
        else:
            raise AssertionError('Unsupported GML geometry ' + kind)
        result.append({'type': 'Feature', 'id': feature.attrib['{%s}id' % NS['gml']],
                       'properties': props, 'geometry': {'type': kind, 'coordinates': coordinates}})
    assert len({f['id'] for f in result}) == len(result), 'Duplicate feature IDs'
    return result, root.attrib


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--boundary')
    parser.add_argument('--output', default='data/thurgau-sources')
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    urls = {f'{layer}.gml': f'{BASE}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms%3A{layer}&SRSNAME=EPSG%3A2056' for layer in LAYERS}
    urls.update({'capabilities.xml': BASE + '?Request=GetCapabilities&Service=WFS&Version=2.0.0',
                 'layer-metadata.xml': BASE + '?request=GetMetadata&layer=buslinie',
                 'catalogue.json': 'https://data.tg.ch/api/explore/v2.1/catalog/datasets/netz-des-offentlichen-verkehrs',
                 'terms.pdf': 'https://shop.geo.tg.ch/sites/default/files/pdf/Nutzungsbedingungen_Geodaten.pdf'})
    receipt = out / 'requests.json'
    if args.download:
        requests = []
        for name, url in urls.items():
            target = out / name
            subprocess.run(['curl', '--silent', '--show-error', '--fail', '--location', '--max-time', '60', url, '-o', str(target)], check=True)
            body = target.read_bytes()
            requests.append({'file': name + '.gz', 'url': url, 'acquiredAt': datetime.now(timezone.utc).isoformat(),
                             'sha256': sha(body), 'bytes': len(body)})
            (out / (name + '.gz')).write_bytes(gzip.compress(body, mtime=0))
            target.unlink()
        receipt.write_text(json.dumps(requests, indent=2) + '\n')
    requests = json.loads(receipt.read_text())
    bodies = {}
    for request in requests:
        body = gzip.decompress((out / request['file']).read_bytes())
        assert sha(body) == request['sha256'] and len(body) == request['bytes']
        bodies[request['file'][:-3]] = body
    boundary_path = out / 'boundary-rows.json.gz'
    if args.boundary:
        with sqlite3.connect(args.boundary) as connection:
            canton = rows(connection, 'tlm_kantonsgebiet', 'kantonsnummer=20')
            districts = rows(connection, 'tlm_bezirksgebiet', 'kantonsnummer=20')
        assert len(canton) == 1 and len(districts) == 5
        pack = lambda records: [{**r, 'geom': base64.b64encode(r['geom']).decode()} for r in records]
        boundary = {'sourceSha256': sha(Path(args.boundary).read_bytes()), 'edition': '2026-01', 'canton': pack(canton), 'districts': pack(districts)}
        boundary_path.write_bytes(gzip.compress(json.dumps(boundary).encode(), mtime=0))
    boundary = json.loads(gzip.decompress(boundary_path.read_bytes()))
    unpack = lambda records: [{**r, 'geom': base64.b64decode(r['geom'])} for r in records]
    layers, layer_inventory = {}, []
    for layer in LAYERS:
        layers[layer], header = decode_gml(bodies[layer + '.gml'])
        layer_inventory.append({'layer': layer, 'count': len(layers[layer]), 'responseTimestamp': header['timeStamp'],
                                'fields': sorted({k for f in layers[layer] for k in f['properties']})})
    assert len(layers['buslinie']) == 337, 'Review changed source release'
    catalogue = json.loads(bodies['catalogue.json'])['metas']
    assert catalogue['default']['license'] == 'CC By 4.0', 'Review changed dataset terms'
    metadata = {'schemaVersion': 1, 'sourceCrs': 'EPSG:2056', 'sourceUrl': BASE,
                'metadataUrl': 'https://data.tg.ch/explore/dataset/netz-des-offentlichen-verkehrs/information/',
                'attribution': '© Kanton Thurgau, Abteilung Öffentlicher Verkehr; Amt für Geoinformation',
                'license': 'CC BY 4.0, explicitly declared in the cantonal dataset catalogue',
                'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
                'termsFiles': ['terms.pdf', 'catalogue.json'], 'dataUpdated': None,
                'catalogueModified': catalogue['default']['modified'], 'catalogueCreated': catalogue['dcat']['created'],
                'vintageCaveat': 'No geometry effective date declared. Catalogue creation 2000-01-01, modified timestamp and WFS response time are not verified timetable vintages.',
                'coordinateModel': 'Original LV95 east/north, no simplification or inferred joining edges',
                'requests': requests, 'layers': layer_inventory,
                'boundary': {'edition': boundary['edition'], 'sourceSha256': boundary['sourceSha256'], 'snapshotSha256': sha(boundary_path.read_bytes()),
                             'attribution': '© swisstopo', 'sourceUrl': 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip',
                             'termsUrl': 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices'}}
    result = {'metadata': metadata, 'layers': layers, 'lines': layers['buslinie'] + layers['bahnlinie_takt'],
              'canton': features(unpack(boundary['canton']), 'geom'), 'districts': features(unpack(boundary['districts']), 'geom')}
    (out / 'decoded.json.gz').write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    (out / 'sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(layer_inventory))


if __name__ == '__main__':
    main()
