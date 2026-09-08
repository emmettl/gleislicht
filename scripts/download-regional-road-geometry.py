"""Acquire official regional road axes, municipal station points and TG class counts."""
import argparse
from datetime import date, datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode
import xml.etree.ElementTree as ET


def acquire(directory, dates, resume=False):
    if resume:
        manifest = json.loads((directory/'manifest.json').read_bytes())
        if manifest.get('purpose') != 'regional-road-geometry' or manifest.get('dates') != dates or manifest.get('complete'):
            raise ValueError('Resume requires a matching incomplete geometry snapshot')
    else:
        directory.mkdir(parents=True, exist_ok=False)
        manifest = {'schemaVersion': 1, 'purpose': 'regional-road-geometry', 'complete': False,
                    'dates': dates, 'files': []}

    def get(name, url, source, format='json'):
        previous = [e for e in manifest['files'] if e['id'] == name]
        if previous:
            entry = previous[0]
            path = directory/entry['path']
            if len(previous) != 1 or entry['url'] != url or path.resolve().parent != directory.resolve():
                raise ValueError('Resume source definition changed')
            body = gzip.decompress(path.read_bytes())
            if len(body) != entry['bytes'] or hashlib.sha256(body).hexdigest() != entry['sha256']:
                raise ValueError('Resume source hash mismatch')
            return json.loads(body) if format == 'json' else ET.fromstring(body)
        body = subprocess.check_output(['curl', '--fail', '--silent', '--show-error', '--max-time', '120',
                                        '--retry', '2', '--retry-delay', '1', url])
        result = json.loads(body) if format == 'json' else ET.fromstring(body)
        if format == 'json' and isinstance(result, dict) and result.get('success') is False:
            raise ValueError(f'Publisher rejected {name}')
        path = f'{name}.{format}.gz'
        (directory/path).write_bytes(gzip.compress(body, mtime=0))
        manifest['files'].append({'id': name, 'source': source, 'path': path, 'format': format,
            'url': url, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
            'acquiredAt': datetime.now(timezone.utc).isoformat()})
        (directory/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        return result

    def wfs(name, source, base, layer, version, output):
        params = {'SERVICE': 'WFS', 'VERSION': version, 'REQUEST': 'GetFeature',
                  'TYPENAMES' if version == '2.0.0' else 'TYPENAME': layer, 'SRSNAME': 'EPSG:2056'}
        hits = get(name+'-hits', base+'?'+urlencode({**params, 'RESULTTYPE': 'hits'}), source, 'xml')
        expected = int(hits.attrib.get('numberMatched', hits.attrib.get('numberOfFeatures', '-1')))
        data = get(name, base+'?'+urlencode({**params, 'OUTPUTFORMAT': output,
            'COUNT' if version == '2.0.0' else 'MAXFEATURES': 100000}), source)
        if expected <= 0 or data.get('type') != 'FeatureCollection' or len(data['features']) != expected:
            raise ValueError(f'{name}: incomplete or empty WFS response')
        print(f'{name}: {expected} features', flush=True)

    bs = 'https://data.bs.ch/api/explore/v2.1/catalog/datasets/100250'
    get('basel-roads-metadata', bs, 'basel')
    count = get('basel-roads-count', bs+'/records?limit=0', 'basel')['total_count']
    roads = get('basel-roads', bs+'/exports/json', 'basel')
    if not roads or len(roads) != count:
        raise ValueError('Basel road export is incomplete')
    print(f'basel-roads: {count} records', flush=True)
    get('thurgau-roads-metadata', 'https://data.tg.ch/api/explore/v2.1/catalog/datasets/kantonsstrassenachsen', 'thurgau')
    wfs('thurgau-roads', 'thurgau', 'https://ows.geo.tg.ch/geofy_access_proxy/kantonsstrassen',
        'ms:kantonsstrassenachsen', '2.0.0', 'GEOJSON')

    zh = 'https://data.stadt-zuerich.ch/api/3/action/package_show?'
    get('zurich-roads-metadata', zh+urlencode({'id': 'geo_verkehrsachsensystem_stadt_zuerich'}), 'zurich-city')
    get('zurich-stations-metadata', zh+urlencode({'id': 'geo_standorte_der_verkehrszaehlungen_miv'}), 'zurich-city')
    base = 'https://www.ogd.stadt-zuerich.ch/wfs/geoportal/'
    for name, service, layer in [
        ('zurich-stations', 'Standorte_der_Verkehrszaehlungen_MIV', 'tbl_standort_zaehlung_miv_p'),
        ('zurich-roads', 'Verkehrsachsensystem_Stadt_Zuerich', 'vas_basis'),
        ('zurich-road-modes', 'Verkehrsachsensystem_Stadt_Zuerich', 'vas_e_verkehrstraeger'),
        ('zurich-road-directions', 'Verkehrsachsensystem_Stadt_Zuerich', 'vas_e_einbahn_ist'),
    ]:
        wfs(name, 'zurich-city', base+service, layer, '1.1.0', 'application/vnd.geo+json')

    tg = 'https://data.tg.ch/api/explore/v2.1/catalog/datasets/dbu-tba-1'
    get('thurgau-classes-metadata', tg, 'thurgau')
    for day in dates:
        query = urlencode({'where': f"datum = date'{day}'"})
        expected = get(f'thurgau-classes-{day}-count', tg+'/records?'+query+'&limit=0', 'thurgau')['total_count']
        rows = get(f'thurgau-classes-{day}', tg+'/exports/json?'+query, 'thurgau')
        if len(rows) != expected:
            raise ValueError('Thurgau class export incomplete')
        print(f'thurgau-classes-{day}: {expected} records', flush=True)
    manifest['complete'] = True
    (directory/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--dates', required=True)
    parser.add_argument('--resume', action='store_true', help='Resume only a matching incomplete snapshot; verify cached hashes')
    args = parser.parse_args()
    dates = sorted(set(args.dates.split(',')))
    for day in dates:
        if date.fromisoformat(day).isoformat() != day:
            parser.error('Dates must be YYYY-MM-DD')
    acquire(args.output, dates, args.resume)
