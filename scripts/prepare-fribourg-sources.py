"""Acquire complete Fribourg line records and decode the pinned canton/district boundary.

Uses curl for public HTTPS and the shared lossless GeoPackage decoder. Raw
responses and retrieval hashes are retained; acquisition is not data vintage.
"""
import argparse
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
from urllib.parse import urlencode
spec = importlib.util.spec_from_file_location('bern_sources', Path(__file__).with_name('prepare-bern-sources.py'))
decoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(decoder)
features, rows, sha = decoder.features, decoder.rows, decoder.sha

LAYER = 'https://map.geo.fr.ch/arcgis/rest/services/PortailCarto/Theme_mobilite/MapServer/2'
OGD_SERVICE = 'https://maps.fr.ch/ags/rest/services/OpenData/Lignes_de_transport_public/FeatureServer'
OGD_ITEM = '518a09fdd5874b76b6eacfb0fe2bb8ec'
OGD_ITEM_URL = f'https://maps.fr.ch/portal/sharing/rest/content/items/{OGD_ITEM}?f=pjson'
OGD_LICENSE = 'Les géodonnées sont mises à disposition sous forme d’Open Government Data (OGD). Elles peuvent être utilisées, partagées et réutilisées gratuitement. Lors de l’utilisation, il faut en indiquer la source : « Source : Etat de Fribourg » ou « © Etat de Fribourg ».'


def validate_reuse(item, service, page, lines):
    """Bind explicit terms to every original geometry and adapter identity field."""
    assert item['id'] == service['serviceItemId'] == OGD_ITEM
    assert item['url'] == OGD_SERVICE and item['access'] == 'public'
    assert item['licenseInfo'] == OGD_LICENSE, 'Changed OGD terms require review'
    assert any(l['id'] == 1 and l['geometryType'] == 'esriGeometryPolyline' for l in service['layers'])
    validate_page(page, [f['properties']['OBJECTID'] for f in lines])
    ogd = {f['attributes']['OBJECTID']: f for f in page['features']}
    for line in lines:
        match = ogd[line['properties']['OBJECTID']]
        assert match['geometry']['paths'] == line['geometry']['coordinates'], 'Different licensed geometry'
        assert all(match['attributes'].get(k) == v for k, v in line['properties'].items()), 'Different licensed identity'
        assert set(match['attributes']) - set(line['properties']) == {'TYPE_LIGNE'}
    return {'matchedFeatures': len(lines), 'exactOriginalCoordinates': True,
            'exactOriginalAttributes': True, 'additionalOgdFields': ['TYPE_LIGNE']}


def validate_page(page, ids):
    assert not page.get('error') and not page.get('exceededTransferLimit'), 'Incomplete/error response'
    assert page['spatialReference']['wkid'] == 2056
    actual = [f['attributes']['OBJECTID'] for f in page['features']]
    assert sorted(actual) == sorted(ids) and len(set(actual)) == len(actual), 'Missing/duplicate IDs'
    for f in page['features']:
        assert f['geometry']['paths']
        for path in f['geometry']['paths']:
            assert len(path) >= 2
            assert all(len(p) == 2 and 2400000 < p[0] < 2900000 and 1000000 < p[1] < 1400000 for p in path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boundary', default='/private/tmp/swissboundaries3d-2026/swissBOUNDARIES3D_1_5_LV95_LN02.gpkg')
    parser.add_argument('--output', default='data/fribourg-sources')
    parser.add_argument('--offline', action='store_true', help='Validate/redecode saved bytes without network')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    previous = json.loads((output / 'acquisition.json').read_text()) if args.offline else None
    records = previous['sources'] if previous else []

    def save(name, url):
        path = output / name
        if args.offline:
            record = next(r for r in records if r['file'] == name)
            assert record['url'] == url and sha(path.read_bytes()) == record['sha256']
        else:
            subprocess.run(['curl', '-fLsS', '--max-time', '60', url, '-o', str(path)], check=True)
            records.append({'file': name, 'url': url, 'retrievedAt': datetime.now(timezone.utc).isoformat(),
                            'sha256': sha(path.read_bytes()), 'bytes': path.stat().st_size})
        return path.read_bytes()

    save('layer.json', LAYER + '?f=pjson')
    save('metadata.xml', LAYER + '/metadata')
    save('portal-terms.html', 'https://map.geo.fr.ch/help/fr/conditions_utilisation.htm')
    save('geoinformation-ordinance.pdf', 'https://bdlf.fr.ch/api/fr/versions/8468/pdf_file_with_annexes')
    for field in ['10.213', '10.216', '10.217', '254']:
        save(f'timetable-{field}.pdf', f'https://widgets.oev-info.ch/publikation/jahresfpl/{field}.pdf')
    ids_url = LAYER + '/query?' + urlencode({'where': '1=1', 'returnIdsOnly': 'true', 'f': 'json'})
    ids = sorted(json.loads(save('ids.json', ids_url))['objectIds'])
    count = json.loads(save('count.json', LAYER + '/query?' + urlencode({'where': '1=1', 'returnCountOnly': 'true', 'f': 'json'})))['count']
    assert len(ids) == len(set(ids)) == count and count > 0
    lines = []
    for start in range(0, len(ids), 50):
        selected = ids[start:start + 50]
        url = LAYER + '/query?' + urlencode({'objectIds': ','.join(map(str, selected)), 'outFields': '*', 'outSR': 2056, 'returnGeometry': 'true', 'f': 'json'})
        page = json.loads(save(f'lines-page-{start // 50}.json', url))
        validate_page(page, selected)
        lines.extend({'type': 'Feature', 'properties': f['attributes'], 'geometry': {'type': 'MultiLineString', 'coordinates': f['geometry']['paths']}} for f in page['features'])
    assert sorted(json.loads(save('ids-after.json', ids_url))['objectIds']) == ids, 'Source IDs changed during acquisition'
    item = json.loads(save('ogd-catalogue-item.json', OGD_ITEM_URL))
    service = json.loads(save('ogd-service.json', OGD_SERVICE + '?f=pjson'))
    save('ogd-layer.json', OGD_SERVICE + '/1?f=pjson')
    ogd_page = json.loads(save('ogd-lines.json', OGD_SERVICE + '/1/query?where=1%3D1&outFields=*&outSR=2056&f=json'))
    save('ogd-metadata.xml', OGD_SERVICE + '/1/metadata')
    equivalence = validate_reuse(item, service, ogd_page, lines)
    boundary_path = output / 'boundary.json.gz'
    if args.offline:
        assert sha(boundary_path.read_bytes()) == previous['derivedHashes']['boundary.json.gz'], 'Changed boundary snapshot'
    if not args.offline:
        assert sha(Path(args.boundary).read_bytes()) == '1f122cb7a06f2d312a84b7c0a91116348ba907054d487f0a70b9d2302984e6fc', 'Unreviewed boundary edition'
        with sqlite3.connect(args.boundary) as connection:
            canton = features(rows(connection, 'tlm_kantonsgebiet', 'kantonsnummer=10'), 'geom')
            districts = features(rows(connection, 'tlm_bezirksgebiet', 'kantonsnummer=10'), 'geom')
        assert len(canton) == 1 and len(districts) == 7
        boundary = {'edition': '2026-01', 'sourceSha256': sha(Path(args.boundary).read_bytes()), 'canton': canton, 'districts': districts}
        boundary_path.write_bytes(gzip.compress(json.dumps(boundary, ensure_ascii=False).encode(), mtime=0))
    boundary = json.loads(gzip.decompress(boundary_path.read_bytes()))
    result = {'lines': lines, 'canton': boundary['canton'], 'districts': boundary['districts']}
    (output / 'decoded.json.gz').write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    acquisition = {'schemaVersion': 1, 'sources': records, 'lineCount': len(lines), 'sourceCrs': 'EPSG:2056',
                   'boundary': {k: v for k, v in boundary.items() if k not in ['canton', 'districts']},
                   'derivedHashes': {name: sha((output / name).read_bytes()) for name in ['decoded.json.gz', 'boundary.json.gz']}}
    if args.offline:
        assert acquisition == previous, 'Decoded data differ from the reviewed acquisition'
    (output / 'acquisition.json').write_text(json.dumps(acquisition, ensure_ascii=False, indent=2) + '\n')
    metadata = {
        'schemaVersion': 1, 'publisher': 'Etat de Fribourg / Service de la mobilité / SIT',
        'sourceUrl': LAYER, 'metadataUrl': LAYER + '/metadata', 'attribution': 'Source: Etat de Fribourg',
        'sourceCrs': 'EPSG:2056', 'dataUpdated': None, 'metadataCreated': '2022-07-14',
        'vintageNote': 'The embedded Esri CreaDate and catalogue created/modified timestamps date metadata only. No geometry update date is declared. PDF timetable dates do not date line geometry.',
        'acquiredAt': next(r['retrievedAt'] for r in records if r['file'] == 'layer.json'),
        'sourceSnapshotSha256': acquisition['derivedHashes']['decoded.json.gz'],
        'acquisition': acquisition,
        'termsFiles': ['portal-terms.html', 'geoinformation-ordinance.pdf', 'metadata.xml', 'ogd-catalogue-item.json', 'ogd-service.json', 'ogd-layer.json', 'ogd-metadata.xml'],
        'license': 'Fribourg OGD: free use, sharing and reuse with Source: Etat de Fribourg attribution; no Creative Commons licence assigned',
        'publicRedistributionCleared': True,
        'reuseEvidence': {
            'catalogueItemUrl': OGD_ITEM_URL,
            'featureServiceUrl': OGD_SERVICE + '/1',
            'catalogueCreated': datetime.fromtimestamp(item['created'] / 1000, timezone.utc).isoformat(),
            'catalogueModified': datetime.fromtimestamp(item['modified'] / 1000, timezone.utc).isoformat(),
            'licenseInfo': OGD_LICENSE,
            'equivalence': equivalence,
            'geocatUrl': 'https://www.geocat.ch/geonetwork/srv/fre/catalog.search#/metadata/d578f90c-348f-41de-80be-4385a57605b9',
            'geocatAccessNote': 'XML requests on 2026-09-08 returned HTTP 403/500 or a login page; no geometry vintage established from that linked record.',
            'portalTerms': 'https://map.geo.fr.ch/help/fr/conditions_utilisation.htm',
            'ordinanceUrl': 'https://bdlf.fr.ch/api/fr/versions/8468/pdf_file_with_annexes',
            'ordinanceEffective': '2024-03-01',
            'assessment': 'Explicit dataset OGD terms permit attributed vector sharing/reuse. The catalogue title incorrectly says stops, but its URL and serviceItemId identify the service containing polyline layer 1. All 128 original line geometries and all original attributes match exactly; OGD adds TYPE_LIGNE. Reuse is resolved independently of the ordinance product mapping. Geometry vintage and physical direction remain unverified; retain an archival study release.',
        },
        'boundary': {**acquisition['boundary'], 'snapshotSha256': acquisition['derivedHashes']['boundary.json.gz'],
                     'attribution': '© swisstopo',
                     'sourceUrl': 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip',
                     'termsUrl': 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices'},
    }
    (output / 'sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(f'Validated {len(lines)} line features and all seven Fribourg districts')


if __name__ == '__main__':
    main()
