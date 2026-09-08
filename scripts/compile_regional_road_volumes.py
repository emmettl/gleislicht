"""Compile counter-local hourly volume files; never reconstruct corridor movement."""
import argparse
from collections import Counter
from datetime import datetime, timedelta
import gzip
import hashlib
import json
import math
from pathlib import Path

from regional_road_counts import SWISS, UTC, day_hours, lv95_to_wgs84

INPUTS = {
    'counts': 'data/regional-road-counts.json.gz',
    'geometry': 'data/regional-road-geometry.json.gz',
    'axes': 'data/regional-road-geometry-audit.json',
    'directions': 'data/regional-road-direction-audit.json',
    'junctions': 'data/regional-road-junction-audit.json',
}
BASES = {'reported-total', 'sum-of-published-classes'}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n').encode()


def valid_count(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def make_hours(day, observations):
    slots = day_hours(day)
    by_start = {}
    for observation in observations:
        instant = datetime.fromisoformat(observation['start'])
        if instant.tzinfo is None:
            raise ValueError('Naive observation instant')
        start = instant.astimezone(UTC).isoformat()
        if start not in slots or observation['serviceDate'] != day:
            raise ValueError('Observation outside Swiss civil date')
        if start in by_start:
            raise ValueError('Duplicate counter hour')
        if observation.get('intervalSeconds', 3600) != 3600:
            raise ValueError('Non-hourly observation')
        if 'end' in observation and datetime.fromisoformat(observation['end']) != instant + timedelta(hours=1):
            raise ValueError('Unexpected observation interval end')
        by_start[start] = observation
    hours = []
    for start in slots:
        row = by_start.get(start)
        if row is None:
            hours.append({'value': None, 'reportedValue': None, 'quality': {'status': 'absent', 'validation': 'not-available', 'sourceFlags': {}}, 'issues': [], 'sourceRow': None})
            continue
        value = row['classSum'] if row.get('countBasis') == 'sum-of-published-classes' else row['count']
        if value is not None and not valid_count(value):
            raise ValueError('Invalid normalized count')
        usable = value is not None and row['quality']['status'] == 'measured' and not row['issues']
        hours.append({'value': value if usable else None, 'reportedValue': value,
                      'quality': row['quality'], 'issues': row['issues'], 'sourceRow': row['sourceRow']})
    measured = [h['value'] for h in hours if h['value'] is not None]
    return {'hours': hours, 'coverage': {'expectedHours': len(hours), 'measuredHours': len(measured),
            'quality': dict(sorted(Counter(h['quality']['status'] for h in hours).items())),
            'issueHours': sum(bool(h['issues']) for h in hours)},
            'measuredSubtotal': sum(measured) if measured else None,
            'dayTotal': sum(measured) if len(measured) == len(hours) else None}


def compile_volumes(counts, geometry, axes, directions, junctions):
    dates = counts['metadata']['dates']
    if axes['metadata']['dates'] != dates or geometry['metadata']['dates'] != dates:
        raise ValueError('Input dates differ')
    counters = {c['detectorId']: c for c in axes['counters']}
    oriented = {d['detectorId']: d for d in directions['directions']}
    paths = {p['id']: p for p in geometry['paths']}
    if len(counters) != len(axes['counters']) or len(oriented) != len(directions['directions']) or set(counters) != set(oriented):
        raise ValueError('Direction/counter identities differ')
    if any(c['source'] not in ('basel', 'thurgau', 'zurich-city') for c in counters.values()):
        raise ValueError('Unknown regional source')
    grouped = {}
    for row in counts['observations'] + geometry['thurgauClassObservations']:
        detector = counters.get(row['detectorId'])
        if detector is None or row['serviceDate'] not in dates:
            raise ValueError('Unknown observation identity or date')
        basis = detector['measurementBasis']
        if basis not in BASES or (basis == 'sum-of-published-classes') != (row.get('countBasis') == 'sum-of-published-classes'):
            raise ValueError('Observation measurement basis differs')
        if basis == 'sum-of-published-classes' and row.get('joinStatus') != 'not-in-total-product':
            raise ValueError('Class family requires overlap review')
        grouped.setdefault((row['detectorId'], row['serviceDate']), []).append(row)
    series = []
    for detector_id, counter in counters.items():
        direction = oriented[detector_id]
        orientation = None
        if direction['status'] == 'validated':
            best = counter['match']['best']
            if counter['match']['status'] != 'axis-candidate' or best['pathId'] != direction['pathId']:
                raise ValueError('Resolved direction has changed axis')
            points = paths[best['pathId']]['points']
            a, b = points[best['edgeIndex']:best['edgeIndex']+2]
            bearing = math.degrees(math.atan2(b[0]-a[0], b[1]-a[1]))
            if direction['direction'] not in ('positive', 'negative'):
                raise ValueError('Invalid reviewed direction')
            bearing = (bearing + (180 if direction['direction'] == 'negative' else 0)) % 360
            orientation = {'bearingDegrees': round(bearing, 2), 'method': direction['method'],
                           'evidence': 'source-inferred-local-direction', 'pathId': direction['pathId']}
        series.append({'id': detector_id, 'stationId': counter['stationId'], 'source': counter['source'],
                       'name': counter['name'], 'directionLabel': counter['directionLabel'],
                       'coordinate': lv95_to_wgs84(*counter['coordinateLv95']),
                       'measurementBasis': counter['measurementBasis'],
                       'geometryStatus': counter['match']['status'], 'orientation': orientation,
                       'directionStatus': direction['status']})
    files = {}
    for source in ('basel', 'thurgau', 'zurich-city'):
        for day in dates:
            slots = [{'start': start, 'end': (datetime.fromisoformat(start)+timedelta(hours=1)).isoformat(),
                      'localStart': datetime.fromisoformat(start).astimezone(SWISS).isoformat()}
                     for start in day_hours(day)]
            rows = [{'detectorId': s['id'], **make_hours(day, grouped.get((s['id'], day), []))}
                    for s in series if s['source'] == source]
            files[f'{source}/{day}.json'] = {'metadata': {'schemaVersion': 1, 'source': source,
                    'serviceDate': day, 'measurementKind': 'historical-hourly-counter-volumes',
                    'timeZone': 'Europe/Zurich', 'unit': 'vehicles-per-hour', 'playbackEligible': False},
                    'slots': slots, 'series': rows}
    sources = dict(counts['metadata']['sources'])
    sources['thurgau-classes'] = geometry['metadata']['sources']['thurgau-classes']
    index = {'metadata': {'schemaVersion': 1, 'dates': dates, 'sources': sources,
             'measurementKind': 'historical-hourly-counter-volumes', 'timeZone': 'Europe/Zurich',
             'scope': 'All imported counter series, including unresolved geometry and excluded road scopes; not a road-network total.',
             'displayPolicy': 'Values are measured counts without row issues. Edited, imputed, missing and absent hours have null values; source reports and quality remain explicit. No interpolation.',
             'aggregationPolicy': 'Daily total only for complete measured days. Never add different counters, directions, total products or class-sum products as a network total.',
             'orientationPolicy': 'Counter-local inferred bearings only. Unresolved directions have no arrow. No speed or motion along roads.',
             'playbackEligible': False, 'junctionReviewCount': len(junctions['reviewed'])},
             'series': series, 'files': []}
    return index, files


def build(root, output):
    policy_file = root/'data/regional-road-volume-policy.json'
    policy = json.loads(policy_file.read_bytes())
    if policy['schemaVersion'] != 1:
        raise ValueError('Unknown volume policy')
    inputs = {}
    for name, file in INPUTS.items():
        body = (root/file).read_bytes()
        if hashlib.sha256(body).hexdigest() != policy['inputs'][file]:
            raise ValueError('Pinned volume input changed: '+file)
        inputs[name] = json.loads(gzip.decompress(body) if file.endswith('.gz') else body)
    if inputs['junctions']['metadata']['directionAuditSha256'] != policy['inputs'][INPUTS['directions']]:
        raise ValueError('Junction and direction reviews differ')
    index, files = compile_volumes(**inputs)
    index['metadata']['inputSha256'] = policy['inputs']
    index['metadata']['policySha256'] = hashlib.sha256(policy_file.read_bytes()).hexdigest()
    for file, value in files.items():
        body = encoded(value)
        target = output/file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        index['files'].append({'source': value['metadata']['source'], 'serviceDate': value['metadata']['serviceDate'],
                               'path': file, 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
                               'series': len(value['series']), 'completeDays': sum(s['dayTotal'] is not None for s in value['series'])})
    (output/'index.json').write_bytes(encoded(index))
    return index


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('public/data/regional-road-volumes'))
    args = parser.parse_args()
    result = build(Path('.'), args.output)
    print(json.dumps({'series': len(result['series']), 'files': result['files']}, indent=2))
