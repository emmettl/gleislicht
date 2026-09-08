#!/usr/bin/env python3
"""Read-only public source probes; HTTP success alone is not geometry validation.

Usage: python3 scripts/probe-transit-sources.py SOURCES.json REPORT.json CACHE_DIR
Optional fourth argument: comma-separated source IDs (merge into an existing report).
Use ALL as the fourth argument and --inspect-cache as the fifth to re-inspect pinned
responses without network access (requires an existing report with matching hashes).
Uses curl for host TLS/network compatibility; no credentials, cookies or API keys.
"""
import concurrent.futures
import datetime
import hashlib
import io
import json
import pathlib
import re
import sqlite3
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile


def inspect_body(body):
    result = {}
    try:
        value = json.loads(body)
        result['bodyKind'] = 'json'
        if isinstance(value, dict):
            result['topLevelKeys'] = list(value)[:30]
            if 'error' in value:
                result['serviceError'] = value['error']
            if value.get('type') == 'FeatureCollection':
                features = value.get('features', [])
                result.update(bodyKind='geojson', featureCount=len(features),
                              geometryTypes=sorted({(f.get('geometry') or {}).get('type', 'null') for f in features}),
                              sampleProperties=[f.get('properties', {}) for f in features[:2]])
                result['propertyNames'] = sorted({k for f in features for k in (f.get('properties') or {})})
            for key in ['count', 'numberMatched', 'numberReturned', 'exceededTransferLimit', 'geometryType', 'copyrightText', 'description', 'documentInfo', 'spatialReference', 'fields', 'layers', 'capabilities', 'supportedQueryFormats']:
                if key in value:
                    result[key] = value[key]
            if 'collections' in value:
                result['collections'] = [{'id': c.get('id'), 'title': c.get('title')} for c in value['collections']]
            if 'assets' in value:
                result['assets'] = value['assets']
            if 'links' in value:
                result['links'] = value['links']
        return result
    except (ValueError, UnicodeDecodeError):
        pass
    if body.startswith(b'PK'):
        result['bodyKind'] = 'zip'
        try:
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                result['entries'] = [{'name': f.filename, 'bytes': f.file_size} for f in archive.infolist()]
                result['dbfTables'] = []
                result['geoPackages'] = []
                for name in archive.namelist():
                    if name.lower().endswith('.gpkg'):
                        with tempfile.TemporaryDirectory() as scratch:
                            gpkg_path = pathlib.Path(scratch) / 'source.gpkg'
                            gpkg_path.write_bytes(archive.read(name))
                            connection = sqlite3.connect('file:' + str(gpkg_path) + '?mode=ro', uri=True)
                            quote = lambda value: '"' + value.replace('"', '""') + '"'
                            tables = []
                            for table, data_type, srs_id, min_x, min_y, max_x, max_y in connection.execute('SELECT table_name,data_type,srs_id,min_x,min_y,max_x,max_y FROM gpkg_contents'):
                                fields = connection.execute('PRAGMA table_info(' + quote(table) + ')').fetchall()
                                geometries = connection.execute('SELECT column_name,geometry_type_name,srs_id,z,m FROM gpkg_geometry_columns WHERE table_name=?', (table,)).fetchall()
                                geom_names = {g[0] for g in geometries}
                                properties = [f[1] for f in fields if f[1] not in geom_names]
                                samples = connection.execute('SELECT ' + ','.join(map(quote, properties)) + ' FROM ' + quote(table) + ' LIMIT 2').fetchall() if properties else []
                                tables.append({'name': table, 'dataType': data_type, 'srsId': srs_id,
                                               'bounds': [min_x, min_y, max_x, max_y],
                                               'recordCount': connection.execute('SELECT COUNT(*) FROM ' + quote(table)).fetchone()[0],
                                               'fields': [{'name': f[1], 'type': f[2]} for f in fields],
                                               'geometryColumns': geometries,
                                               'sampleProperties': [dict(zip(properties, row)) for row in samples]})
                            connection.close()
                            result['geoPackages'].append({'name': name, 'tables': tables})
                    if not name.lower().endswith('.dbf'):
                        continue
                    data = archive.read(name)
                    fields = []
                    header_length = int.from_bytes(data[8:10], 'little')
                    for i in range(32, header_length - 1, 32):
                        part = data[i:i + 32]
                        if len(part) < 32 or part[0] == 13:
                            break
                        fields.append({'name': part[:11].split(b'\0')[0].decode('latin1'), 'type': chr(part[11]), 'length': part[16]})
                    count = int.from_bytes(data[4:8], 'little')
                    record_length = int.from_bytes(data[10:12], 'little')
                    samples = []
                    for index in range(min(count, 2)):
                        offset = header_length + index * record_length + 1
                        sample = {}
                        for field in fields:
                            sample[field['name']] = data[offset:offset + field['length']].decode('utf-8', errors='replace').strip()
                            offset += field['length']
                        samples.append(sample)
                    result['dbfTables'].append({'name': name, 'recordCount': count, 'fields': fields, 'sampleProperties': samples,
                                               'limits': 'DBF properties only; shapefile coordinates are not decoded.'})
        except (zipfile.BadZipFile, ValueError) as error:
            result['parseError'] = str(error)
        return result
    if body.startswith(b'PAR1'):
        return {'bodyKind': 'parquet', 'footerMagicValid': body.endswith(b'PAR1'), 'limits': 'Binary signatures only; decode separately.'}
    if body.startswith(b'%PDF'):
        return {'bodyKind': 'pdf', 'limits': 'File signature only; text/layout not inspected by this probe.'}
    decoded = body.decode('utf-8', errors='replace')
    try:
        root = ET.fromstring(body)
        if root.tag.rsplit('}', 1)[-1].lower() == 'html':
            return {'bodyKind': 'html', 'title': next((e.text for e in root.iter() if e.tag.rsplit('}', 1)[-1] == 'title'), None)}
        result.update(bodyKind='xml', rootElement=root.tag)
        local = lambda element: element.tag.rsplit('}', 1)[-1]
        result['serviceExceptions'] = [e.text for e in root.iter() if local(e) in ('ExceptionText', 'ServiceException')]
        if 'Capabilities' in root.tag:
            result['serviceMetadata'] = [{'key': local(e), 'value': e.text} for e in root.iter() if local(e) in ('Fees', 'AccessConstraints')]
            result['layers'] = []
            for element in root.iter():
                if local(element) not in ('FeatureType', 'Layer'):
                    continue
                entry = {local(c): c.text for c in element if local(c) in ('Name', 'Title', 'Abstract', 'DefaultCRS', 'DefaultSRS')}
                if 'Name' in entry:
                    result['layers'].append(entry)
            result['layerCount'] = len(result['layers'])
        if 'FeatureCollection' in root.tag:
            result['collectionAttributes'] = root.attrib
            result['sampleElements'] = sorted({local(e) for e in root.iter()})[:100]
        return result
    except ET.ParseError:
        pass
    result['bodyKind'] = 'html' if re.search(r'<(?:!doctype html|html)', decoded, re.I) else 'text'
    title = re.search(r'<title[^>]*>(.*?)</title>', decoded, re.I | re.S)
    if title:
        result['title'] = re.sub(r'\s+', ' ', title.group(1)).strip()
    return result


def probe(source, directory):
    source_id = source['id']
    assert re.fullmatch(r'[a-z0-9-]+', source_id), source_id
    assert source['url'].startswith('https://'), source_id
    path = directory / (source_id + '.body')
    headers = directory / (source_id + '.headers')
    # A failed repeat request must not inherit the previous response's bytes.
    path.unlink(missing_ok=True)
    headers.unlink(missing_ok=True)
    response = subprocess.run(['curl', '--silent', '--show-error', '--location', '--max-time', '35',
                               '--proto', '=https', '--proto-redir', '=https',
                               '--max-filesize', '60000000', '--dump-header', str(headers),
                               '--output', str(path), '--write-out', '%{json}', source['url']],
                              capture_output=True, text=True)
    try:
        transfer = json.loads(response.stdout)
    except ValueError:
        transfer = {}
    result = {'id': source_id, 'url': source['url'],
              'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'curlExitCode': response.returncode, 'httpStatus': transfer.get('http_code'),
              'resolvedUrl': transfer.get('url_effective'), 'contentType': transfer.get('content_type')}
    if response.stderr:
        result['error'] = response.stderr.strip()
    if path.exists():
        body = path.read_bytes()
        result.update(bytes=len(body), sha256=hashlib.sha256(body).hexdigest(), **inspect_body(body))
    if headers.exists():
        result['responseHeaders'] = [line.strip() for line in headers.read_text(errors='replace').splitlines()
                                     if line.lower().startswith(('last-modified:', 'etag:', 'content-disposition:'))]
    expected = source.get('expectedKinds', [])
    result['expectedBodyReceived'] = (response.returncode == 0 and result.get('httpStatus') == 200
                                      and (not expected or result.get('bodyKind') in expected)
                                      and not result.get('serviceError') and not result.get('serviceExceptions'))
    return result


def main():
    source_path, report_path, cache_path = map(pathlib.Path, sys.argv[1:4])
    config = json.loads(source_path.read_text())
    sources = config['sources']
    assert len({s['id'] for s in sources}) == len(sources), 'Duplicate source IDs'
    selected = set(sys.argv[4].split(',')) if len(sys.argv) > 4 and sys.argv[4] != 'ALL' else None
    cache_only = '--inspect-cache' in sys.argv
    if selected:
        assert selected <= {s['id'] for s in sources}, 'Unknown source ID'
        sources = [s for s in sources if s['id'] in selected]
    cache_path.mkdir(parents=True, exist_ok=True)
    previous = json.loads(report_path.read_text())['probes'] if (selected or cache_only) and report_path.exists() else []
    results = {r['id']: r for r in previous}
    if cache_only:
        for source in sources:
            original = results[source['id']]
            body_path = cache_path / (source['id'] + '.body')
            if not body_path.exists():
                assert original.get('bytes') is None
                continue
            body = body_path.read_bytes()
            assert hashlib.sha256(body).hexdigest() == original['sha256'], source['id']
            assert original['url'] == source['url'], source['id']
            original.update(inspect_body(body))
            original['expectedBodyReceived'] = (original['curlExitCode'] == 0 and original['httpStatus'] == 200
                                                and original['bodyKind'] in source['expectedKinds']
                                                and not original.get('serviceError') and not original.get('serviceExceptions'))
        report = json.loads(report_path.read_text())
        report['sourcesSha256'] = hashlib.sha256(source_path.read_bytes()).hexdigest()
        report['probes'] = [results[s['id']] for s in config['sources']]
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print('Re-inspected', len(sources), 'pinned responses')
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(lambda source: probe(source, cache_path), sources):
            results[result['id']] = result
            print(result['id'], result['httpStatus'], result.get('bodyKind'), result['expectedBodyReceived'], flush=True)
    report = {'schemaVersion': 1, 'method': 'Unauthenticated public HTTPS GET, four concurrent requests maximum; response hashes identify bytes; no timetable/geometry join or redistribution-rights inference.',
              'sourcesSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
              'probes': [results[s['id']] for s in config['sources'] if s['id'] in results]}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
