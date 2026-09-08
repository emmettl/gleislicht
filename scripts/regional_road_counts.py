"""Normalize pinned hourly road counts and audit readiness without admitting playback."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

SWISS = ZoneInfo('Europe/Zurich')
UTC = timezone.utc
CLASSES = ('mr', 'pw', 'pw0', 'lief', 'lief0', 'lief_aufl', 'lw', 'lw0', 'sattelzug', 'bus', 'andere')


class TimeIssue(ValueError):
    pass


def swiss_instant(text):
    """Do not infer fold order from an unordered API or CSV."""
    local = datetime.fromisoformat(text)
    if local.tzinfo is not None:
        raise TimeIssue('unexpected-offset-in-local-time')
    candidates = {local.replace(tzinfo=SWISS, fold=fold).astimezone(UTC) for fold in (0, 1)
                  if local.replace(tzinfo=SWISS, fold=fold).astimezone(UTC).astimezone(SWISS).replace(tzinfo=None) == local}
    if len(candidates) != 1:
        raise TimeIssue('ambiguous-local-hour' if candidates else 'nonexistent-local-hour')
    return candidates.pop()


def day_hours(day):
    start = swiss_instant(day + 'T00:00:00')
    following = (datetime.fromisoformat(day) + timedelta(days=1)).date().isoformat()
    end = swiss_instant(following + 'T00:00:00')
    return [(start + timedelta(hours=i)).isoformat() for i in range(int((end-start).total_seconds()/3600))]


def number(value):
    if isinstance(value, bool):
        return None
    if value is None or str(value).strip() in ('', 'NA', 'NaN', 'Unbekannt'):
        return None
    try:
        result = float(value)
    except (ValueError, TypeError):
        return None
    return result if math.isfinite(result) else None


def count(value):
    result = number(value)
    return int(result) if result is not None and result >= 0 and result.is_integer() else None


def lv95_to_wgs84(east, north):
    # Same swisstopo approximation as ingest-national-road-topology.mjs.
    y, x = (east-2600000)/1000000, (north-1200000)/1000000
    lon = 2.6779094 + 4.728982*y + .791484*y*x + .1306*y*x*x - .0436*y*y*y
    lat = 16.9023892 + 3.238272*x - .270978*y*y - .002528*x*x - .0447*y*y*x - .014*x*x*x
    return [round(lon*100/36, 7), round(lat*100/36, 7)]


def coordinate(point):
    if point is None:
        return None
    lon, lat = point
    if lon is None or lat is None or not (5 <= lon <= 11 and 45 <= lat <= 49):
        return None
    return point


def required(row, *fields):
    for field in fields:
        if field not in row:
            raise ValueError(f'Missing source field {field}')


def normalize(source, row, *, acquisition_year):
    issues = []
    classes = None
    if source == 'basel':
        required(row, 'sitecode', 'zst_id', 'directionname', 'lanecode', 'datetimefrom', 'datetimeto',
                 'total', 'valuesapproved', 'valuesedited', *CLASSES)
        station = str(row['zst_id'])
        lane_key = f"code:{row['lanecode']}" if row['lanecode'] is not None else f"name:{row.get('lanename') or ''}"
        if lane_key == 'name:':
            raise ValueError('Missing lane code and lane name')
        identity = [str(row['sitecode']), str(row['directionname']), lane_key]
        direction, lane, name = row['directionname'], row['lanecode'], row['sitename']
        raw_time, raw_count = row['datetimefrom'], row['total']
        point = row.get('geo_point_2d') or {}
        point = coordinate([number(point.get('lon')), number(point.get('lat'))])
        status = 'edited' if row['valuesedited'] == 1 else 'measured'
        if row['valuesapproved'] not in (0, 1) or row['valuesedited'] not in (0, 1):
            status = 'unknown'
            issues.append('unknown-source-quality')
        quality = {'status': status, 'validation': 'approved' if row['valuesapproved'] == 1 else 'unapproved',
                   'sourceFlags': {k: row[k] for k in ('valuesapproved', 'valuesedited')}}
        classes = {k: count(row[k]) for k in CLASSES}
        if any(classes[k] is None and row[k] is not None for k in CLASSES):
            issues.append('invalid-vehicle-class')
        elif sum(v for v in classes.values() if v is not None) != count(raw_count):
            issues.append('vehicle-class-total-mismatch')
        details = {'sitecode': row['sitecode'], 'laneName': row.get('lanename'), 'trafficType': row.get('traffictype'),
                   'laneIdentityBasis': 'code' if row['lanecode'] is not None else 'name',
                   'family': '100006-mixed-class-counts', 'road': None}
    elif source == 'thurgau':
        required(row, 'code', 'spur_code', 'richtung', 'datum', 'zeit_von', 'zeit_bis', 'anzahl')
        station = str(row['code'])
        identity = [station, str(row['richtung']), str(row['spur_code'])]
        direction, lane, name = row['richtung'], row['spur_code'], row['name']
        raw_time, raw_count = row['datum'] + 'T' + row['zeit_von'], row['anzahl']
        point = row.get('koordinaten') or {}
        point = coordinate([number(point.get('lon')), number(point.get('lat'))])
        quality = {'status': 'measured', 'validation': 'raw-current-year' if int(row['datum'][:4]) >= acquisition_year else 'completed-year-publisher-validated',
                   'sourceFlags': {}}
        details = {'road': row.get('strasse'), 'address': row.get('adresse'), 'municipality': row.get('gemeinde'),
                   'regularBus': row.get('reg_bus'), 'family': 'dbu-tba-2-total'}
    elif source == 'zurich-city':
        required(row, 'MSID', 'ZSID', 'Richtung', 'MessungDatZeit', 'AnzFahrzeuge', 'AnzFahrzeugeStatus')
        station, identity = row['ZSID'], [row['MSID']]
        direction, lane, name = row['Richtung'], None, row['ZSName']
        raw_time, raw_count = row['MessungDatZeit'], row['AnzFahrzeuge']
        east, north = number(row.get('EKoord')), number(row.get('NKoord'))
        point = coordinate(lv95_to_wgs84(east, north)) if east is not None and north is not None else None
        status = {'Gemessen': 'measured', 'Imputiert': 'imputed', 'Fehlend': 'missing'}.get(row['AnzFahrzeugeStatus'], 'unknown')
        quality = {'status': status, 'validation': 'not-specified', 'sourceFlags': {'AnzFahrzeugeStatus': row['AnzFahrzeugeStatus']}}
        details = {'road': row.get('Achse'), 'family': 'municipal-measurement-site-aggregate',
                   'sourceLv95': [east, north], 'detectorCount': row.get('AnzDetektoren'),
                   'sourceDetectorIds': [row.get(f'D{i}ID') for i in range(1, 5)],
                   'signalId': row.get('Knummer')}
        if status == 'unknown':
            issues.append('unknown-source-quality')
    else:
        raise ValueError(f'Unsupported source {source}')
    if not station or any(not part or part == 'None' for part in identity):
        raise ValueError('Missing counter identity')
    detector_id = source + ':' + ':'.join(quote(part, safe='') for part in identity)
    if not point:
        issues.append('invalid-coordinate')
    if not direction or direction == 'Unbekannt':
        issues.append('missing-direction-label')
    value = count(raw_count)
    if quality['status'] == 'missing':
        if value is not None:
            issues.append('missing-status-with-numeric-value')
        value = None
    elif value is None:
        issues.append('missing-or-invalid-count')
    start = end = None
    try:
        if source == 'basel':
            # Python 3.9's ISO parser needs an explicit offset for the UTC Z suffix.
            start = datetime.fromisoformat(raw_time.removesuffix('Z') + ('+00:00' if raw_time.endswith('Z') else ''))
            raw_end = row['datetimeto']
            end = datetime.fromisoformat(raw_end.removesuffix('Z') + ('+00:00' if raw_end.endswith('Z') else ''))
            if start.tzinfo is None or end.tzinfo is None:
                raise TimeIssue('missing-UTC-offset')
            start, end = start.astimezone(UTC), end.astimezone(UTC)
        else:
            start = swiss_instant(raw_time)
            end = start + timedelta(hours=1)
            if source == 'thurgau' and end.astimezone(SWISS).strftime('%H:%M') != row['zeit_bis'][:5]:
                raise TimeIssue('inconsistent-hour-end')
        if (end-start).total_seconds() != 3600 or start.minute != 0 or start.second != 0 or start.microsecond != 0:
            raise TimeIssue('non-hourly-interval')
    except TimeIssue as error:
        issues.append(str(error))
        start = end = None
    except ValueError:
        issues.append('invalid-timestamp')
        start = end = None
    detector = {'id': detector_id, 'stationId': source + ':' + station, 'source': source,
                'name': name, 'directionLabel': direction, 'lane': lane, 'coordinate': point,
                'geometryStatus': 'unmatched', 'details': details}
    observation = {'detectorId': detector_id, 'localStart': raw_time, 'start': start.isoformat() if start else None,
                   'end': end.isoformat() if end else None, 'intervalSeconds': 3600 if start else None,
                   'count': value, 'quality': quality, 'classes': classes, 'issues': issues}
    return detector, observation


def read_snapshot(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('schemaVersion') != 1 or manifest.get('complete') is not True:
        raise ValueError('Snapshot acquisition is incomplete or unsupported')
    files = []
    for entry in manifest['files']:
        path = directory / entry['path']
        if path.resolve().parent != directory.resolve():
            raise ValueError('Snapshot path must stay in its directory')
        body = gzip.decompress(path.read_bytes())
        if len(body) != entry['bytes'] or hashlib.sha256(body).hexdigest() != entry['sha256']:
            raise ValueError(f'Source hash mismatch: {path}')
        files.append((entry, json.loads(body)))
    return manifest, files


def distance_metres(a, b):
    radians = math.pi / 180
    lat1, lat2 = a[1]*radians, b[1]*radians
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((b[0]-a[0])*radians/2)**2
    return 6371000*2*math.asin(min(1, math.sqrt(h)))


def compile_snapshot(directory, references=()):
    manifest, files = read_snapshot(directory)
    expected_counts, actual_counts = {}, Counter()
    for entry, data in files:
        key = (entry['source'], entry['serviceDate'])
        if entry['role'] == 'count':
            expected_counts[key] = int(data['result']['records'][0]['n']) if entry['source'] == 'zurich-city' else data['total_count']
        elif entry['role'] == 'observations':
            actual_counts[key] += len(data['result']['records']) if entry['source'] == 'zurich-city' else len(data)
    expected_keys = {(source, day) for source in ('basel', 'thurgau', 'zurich-city') for day in manifest['dates']}
    if set(expected_counts) != expected_keys or dict(actual_counts) != expected_counts or any(n <= 0 for n in expected_counts.values()):
        raise ValueError('Snapshot counts do not reconcile for every source/date')
    detectors, observations, rejected, seen = {}, [], [], {}
    duplicates = 0
    metadata = {}
    basel_stations = {}
    for entry, data in files:
        if entry['role'] == 'metadata':
            if entry['source'] == 'zurich-city':
                p = data['result']
                metadata[entry['source']] = {'publisher': 'Stadt Zürich, Dienstabteilung Verkehr',
                    'license': p['license_title'], 'licenseUrl': p['license_url'], 'sourceUrl': entry['url']}
            else:
                p = data['metas']['default']
                metadata[entry['source']] = {k: p[k] for k in ('publisher', 'license')}
                metadata[entry['source']].update(licenseUrl=p['license_url'], sourceUrl=entry['url'])
        if entry['role'] == 'stations':
            basel_stations = {str(row['id_zst']): row for row in data}
    for entry, data in files:
        if entry['role'] != 'observations':
            continue
        rows = data['result']['records'] if entry['source'] == 'zurich-city' else data
        for index, row in enumerate(rows):
            detector, obs = normalize(entry['source'], row, acquisition_year=int(entry['acquiredAt'][:4]))
            obs['sourceRow'] = {'file': entry['path'], 'index': index}
            detector_id = detector['id']
            if detector_id in detectors and detectors[detector_id] != detector:
                raise ValueError(f'Counter metadata drift: {detector_id}')
            detectors[detector_id] = detector
            obs['serviceDate'] = entry['serviceDate']
            if obs['start'] is None:
                rejected.append(obs)
                continue
            if datetime.fromisoformat(obs['start']).astimezone(SWISS).date().isoformat() != entry['serviceDate']:
                raise ValueError('Observation outside requested Swiss civil date')
            key = (detector_id, obs['start'])
            comparable = {k: v for k, v in obs.items() if k != 'sourceRow'}
            if key in seen:
                if seen[key] != comparable:
                    raise ValueError(f'Conflicting duplicate observation: {key}')
                duplicates += 1
                continue
            seen[key] = comparable
            observations.append(obs)
    if set(metadata) != {'basel', 'thurgau', 'zurich-city'}:
        raise ValueError('Missing source metadata')
    by_detector = defaultdict(list)
    for obs in observations:
        by_detector[obs['detectorId']].append(obs)
    baseline = {}
    reference_hashes = []
    for path in references:
        body = path.read_bytes()
        data = json.loads(body)
        reference_hashes.append({'path': str(path), 'sha256': hashlib.sha256(body).hexdigest()})
        for site in data.get('sites', data.get('detectors', [])):
            if site.get('coordinate'):
                baseline[(site['stationId'], tuple(site['coordinate']))] = site
    for detector in detectors.values():
        if detector['source'] == 'basel':
            inventory = basel_stations.get(detector['stationId'].split(':', 1)[1])
            detector['inventory'] = inventory
            detector['scope'] = ('motorway' if inventory and 'Hochleistungs' in (inventory.get('strtyp') or '')
                                 else 'unreviewed')
        else:
            text = ' '.join(str(v) for v in [detector['name'], detector['details'].get('address')]).lower()
            detector['scope'] = 'parking-access-candidate' if any(term in text for term in ('parkhaus', 'parkplatz', 'parkhauseinfahrt')) else 'unreviewed'
        detector['playbackEligible'] = False
        detector['nearbyExistingStations'] = sorted([
            {'stationId': station_id, 'distanceMetres': round(distance_metres(detector['coordinate'], point))}
            for station_id, point in baseline
            if detector['coordinate'] and distance_metres(detector['coordinate'], point) <= 1500
        ], key=lambda candidate: (candidate['distanceMetres'], candidate['stationId']))
        detector['days'] = []
        for day in manifest['dates']:
            rows = [o for o in by_detector[detector['id']] if o['serviceDate'] == day]
            expected = day_hours(day)
            present = {o['start'] for o in rows}
            detector['days'].append({'date': day, 'expectedHours': len(expected), 'presentHours': len(present),
                'absentHours': [hour for hour in expected if hour not in present],
                'quality': dict(sorted(Counter(o['quality']['status'] for o in rows).items())),
                'usableMeasuredHours': sum(o['count'] is not None and o['quality']['status'] == 'measured' and not o['issues'] for o in rows)})
    daily = []
    for source in sorted(metadata):
        source_detectors = [d for d in detectors.values() if d['source'] == source]
        for day in manifest['dates']:
            rows = [o for o in observations if detectors[o['detectorId']]['source'] == source and o['serviceDate'] == day]
            summaries = [s for d in source_detectors for s in d['days'] if s['date'] == day]
            daily.append({'source': source, 'date': day, 'stations': len({d['stationId'] for d in source_detectors}),
                'detectorsInDateUnion': len(source_detectors), 'rows': len(rows),
                'absentHoursInUnion': sum(len(s['absentHours']) for s in summaries),
                'completeMeasuredDetectors': sum(s['usableMeasuredHours'] == s['expectedHours'] for s in summaries),
                'quality': dict(sorted(Counter(o['quality']['status'] for o in rows).items())),
                'validation': dict(sorted(Counter(o['quality']['validation'] for o in rows).items())),
                'issues': dict(sorted(Counter(issue for o in rows for issue in o['issues']).items()))})
    common = {'schemaVersion': 1, 'dates': manifest['dates'], 'sources': metadata,
        'snapshotManifestSha256': hashlib.sha256((directory / 'manifest.json').read_bytes()).hexdigest(),
        'measurementKind': 'historical-hourly-counts', 'geometryStatus': 'unmatched', 'playbackEligible': False,
        'intervalPolicy': 'Europe/Zurich civil dates; ambiguous local folds quarantined; no minute interpolation or speed inference',
        'coveragePolicy': 'Expected hours use the union of observed detectors across requested dates; not a census of all active stations',
        'overlapPolicy': '1500 m candidate search against coarse existing coordinates; proximity is not duplicate identity',
        'coordinateModel': 'WGS84 source points; Zürich LV95 converted with existing swisstopo polynomial approximation',
        'referenceFiles': reference_hashes}
    audit = {'metadata': common, 'daily': daily, 'identicalDuplicateRows': duplicates,
             'quarantinedRows': rejected, 'detectors': sorted(detectors.values(), key=lambda d: d['id'])}
    artifact = {'metadata': common, 'observations': sorted(observations, key=lambda o: (o['detectorId'], o['start']))}
    return artifact, audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--audit', required=True, type=Path)
    parser.add_argument('--reference', action='append', default=[], type=Path)
    args = parser.parse_args()
    artifact, audit = compile_snapshot(args.snapshot, args.reference)
    for path in (args.output, args.audit):
        path.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(json.dumps(artifact, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(audit['daily'], ensure_ascii=False, indent=2))
