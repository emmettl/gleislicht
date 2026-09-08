"""Audit hourly counter-to-axis joins; geometry proximity never establishes vehicle direction."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote
import xml.etree.ElementTree as ET

from regional_road_counts import CLASSES, SWISS, TimeIssue, count, day_hours, normalize, swiss_instant

RADIUS = 100
MAX_DISTANCE = 35
AMBIGUITY_MARGIN = 10
CELL = 100


def wgs84_to_lv95(point):
    lon, lat = point
    x, y = (lat*3600-169028.66)/10000, (lon*3600-26782.5)/10000
    return [2600072.37+211455.93*y-10938.51*y*x-.36*y*x*x-44.54*y*y*y,
            1200147.07+308807.95*x+3745.25*y*y+76.63*x*x-194.56*y*y*x+119.79*x*x*x]


def road_name(value):
    text = unicodedata.normalize('NFKD', value or '').encode('ascii', 'ignore').decode().lower()
    text = text.replace('str.', 'strasse')
    return re.sub(r'[^a-z0-9]', '', text)


def verified_sources(directory):
    body = (directory/'manifest.json').read_bytes()
    manifest = json.loads(body)
    if manifest.get('purpose') != 'regional-road-geometry' or not manifest.get('complete') or manifest.get('schemaVersion') != 1:
        raise ValueError('Incomplete or unsupported geometry snapshot')
    result = {}
    for entry in manifest['files']:
        path = directory/entry['path']
        if path.resolve().parent != directory.resolve() or entry['id'] in result:
            raise ValueError('Invalid or duplicate geometry source path/identity')
        raw = gzip.decompress(path.read_bytes())
        if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
            raise ValueError('Geometry source hash mismatch: '+entry['id'])
        result[entry['id']] = json.loads(raw) if entry['format'] == 'json' else ET.fromstring(raw)
    for name in ('thurgau-roads', 'zurich-roads', 'zurich-stations', 'zurich-road-modes', 'zurich-road-directions'):
        hits = result[name+'-hits'].attrib
        expected = int(hits.get('numberMatched', hits.get('numberOfFeatures', '-1')))
        data = result[name]
        if data.get('type') != 'FeatureCollection' or len(data['features']) != expected or expected <= 0:
            raise ValueError('Incomplete WFS source: '+name)
        if data.get('crs', {}).get('properties', {}).get('name') != 'urn:ogc:def:crs:EPSG::2056':
            raise ValueError('Expected explicit LV95 source: '+name)
    if len(result['basel-roads']) != result['basel-roads-count']['total_count']:
        raise ValueError('Incomplete Basel road export')
    return manifest, result, hashlib.sha256(body).hexdigest()


def valid_point(p):
    return (isinstance(p, list) and len(p) >= 2 and
            all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in p[:2]) and
            2400000 < p[0] < 2900000 and 1000000 < p[1] < 1400000)


def parse_roads(data):
    paths = []

    def add(source, identity, geometry, properties, *, geographic=False):
        if not identity or geometry.get('type') not in ('LineString', 'MultiLineString'):
            raise ValueError('Invalid road identity or geometry')
        parts = [geometry['coordinates']] if geometry['type'] == 'LineString' else geometry['coordinates']
        for index, part in enumerate(parts):
            points = [wgs84_to_lv95(p[:2]) for p in part] if geographic else [p[:2] for p in part]
            if len(points) < 2 or not all(valid_point(p) for p in points):
                raise ValueError('Road coordinates outside declared CRS')
            length = sum(math.dist(a, b) for a, b in zip(points, points[1:]))
            if length == 0:
                raise ValueError('Degenerate road path')
            paths.append({'id': f'{source}:{identity}:{index}', 'source': source, 'points': points,
                          'lengthMetres': length, **properties})

    for row in data['basel-roads']:
        add('basel', row['id_strasse_weg'], row['geo_shape']['geometry'], {
            'roadKey': str(row.get('strassennummer') or row['strassenname'] or row['id_strasse_weg']),
            'name': row['strassenname'], 'roadClass': row['strassennetzhierarchie_code'],
            'eligibleClass': row['strassennetzhierarchie_code'] in ('HVS', 'HSS', 'QSS', 'ES'),
            'sourceProperties': row}, geographic=True)
    for feature in data['thurgau-roads']['features']:
        p = feature['properties']
        add('thurgau', p['objectid'], feature['geometry'], {
            'roadKey': p['name'], 'name': p['name_long'], 'roadClass': p['axis_symbol'],
            'eligibleClass': p['owner'] == 'TG' and p['axis_symbol'] in ('1', '2') and p['pos_code'] == '=',
            'sourceProperties': p})
    for feature in data['zurich-roads']['features']:
        p = feature['properties']
        add('zurich-city', p['vas_id'], feature['geometry'], {
            'roadKey': p['lokalisationnummer'], 'name': p['lokalisationsname'], 'roadClass': p['status_txt'],
            'eligibleClass': p['status_txt'] == 'real', 'chainageStart': p['messwert_von'],
            'chainageEnd': p['messwert_bis'], 'sourceProperties': p})
    if len({p['id'] for p in paths}) != len(paths):
        raise ValueError('Duplicate road path identity')
    return paths


class RoadIndex:
    def __init__(self, paths):
        self.paths = {p['id']: p for p in paths}
        self.grid = defaultdict(list)
        for path in paths:
            offset = 0
            for index, (a, b) in enumerate(zip(path['points'], path['points'][1:])):
                length = math.dist(a, b)
                if length == 0:
                    continue
                edge = (path['id'], index, a, b, length, offset)
                for x in range(math.floor(min(a[0], b[0])/CELL), math.floor(max(a[0], b[0])/CELL)+1):
                    for y in range(math.floor(min(a[1], b[1])/CELL), math.floor(max(a[1], b[1])/CELL)+1):
                        self.grid[(path['source'], x, y)].append(edge)
                offset += length

    def candidates(self, source, point):
        edges = {}
        for x in range(math.floor((point[0]-RADIUS)/CELL), math.floor((point[0]+RADIUS)/CELL)+1):
            for y in range(math.floor((point[1]-RADIUS)/CELL), math.floor((point[1]+RADIUS)/CELL)+1):
                for edge in self.grid[(source, x, y)]:
                    edges[edge[:2]] = edge
        candidates = []
        for path_id, index, a, b, length, offset in edges.values():
            t = max(0, min(1, sum((point[i]-a[i])*(b[i]-a[i]) for i in (0, 1))/length**2))
            projected = [a[i]+(b[i]-a[i])*t for i in (0, 1)]
            distance = math.dist(point, projected)
            if distance <= RADIUS:
                candidates.append({'pathId': path_id, 'distanceMetres': distance, 'projectedLv95': projected,
                                   'offsetMetres': offset+length*t, 'edgeIndex': index,
                                   'roadKey': self.paths[path_id]['roadKey'], 'name': self.paths[path_id]['name']})
        # Adjacent segments at the same point are one local alignment. Parallel paths,
        # crossing roads and distant bends of the same path remain competitors.
        selected = []
        for candidate in sorted(candidates, key=lambda c: (c['distanceMetres'], c['pathId'], c['edgeIndex'])):
            if any(candidate['pathId'] == prev['pathId'] and
                   abs(candidate['offsetMetres']-prev['offsetMetres']) < 2 for prev in selected):
                continue
            selected.append(candidate)
        return selected


def independent_competitors(best, candidates, paths):
    road = paths[best['pathId']]
    competitors = []
    for candidate in candidates[1:]:
        if candidate['distanceMetres'] > best['distanceMetres']+AMBIGUITY_MARGIN:
            continue
        other = paths[candidate['pathId']]
        # Two pieces of the same road meeting at a shared endpoint may be equivalent.
        endpoints = all(min(c['offsetMetres'], paths[c['pathId']]['lengthMetres']-c['offsetMetres']) < 1
                        for c in (best, candidate))
        def inward_tangent(path, projection):
            points = path['points']
            origin, neighbours = (points[0], points[1:]) if projection['offsetMetres'] < 1 else (points[-1], reversed(points[:-1]))
            for point in neighbours:
                length = math.dist(point, origin)
                if length > 0:
                    return [(point[i]-origin[i])/length for i in (0, 1)]
            raise ValueError('Degenerate endpoint tangent')
        continuation = False
        if endpoints:
            a, b = inward_tangent(road, best), inward_tangent(other, candidate)
            continuation = sum(a[i]*b[i] for i in (0, 1)) < -math.cos(math.radians(20))
        if (road['roadKey'] == other['roadKey'] and road['roadClass'] == other['roadClass'] and continuation and
                math.dist(best['projectedLv95'], candidate['projectedLv95']) < 1):
            continue
        # A curve's neighbouring edges are not alternative roads if they lie within
        # 20 m along the same path. A hairpin returning near the counter still competes.
        if best['pathId'] == candidate['pathId'] and abs(best['offsetMetres']-candidate['offsetMetres']) < 20:
            continue
        competitors.append(candidate)
    return competitors


def local_events(path, candidate, modes, directions):
    start, end = path['chainageStart'], path['chainageEnd']
    length = path['lengthMetres']
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (start, end)) or end <= start or abs(end-start-length) > max(2, length*.01):
        return {'status': 'invalid-chainage', 'motorTraffic': None, 'oneWay': []}
    chainage = start+(end-start)*candidate['offsetMetres']/length
    def covers(p):
        return p['messwert_von']-1 <= chainage <= p['messwert_bis']+1
    mode_rows = [p for p in modes.get(path['roadKey'], []) if covers(p)]
    mode_values = {p['miv_vorhanden'] for p in mode_rows}
    direction_rows = [p for p in directions.get(road_name(path['name']), []) if covers(p)]
    return {'status': 'resolved' if len(mode_values) == 1 else 'missing-or-conflicting-mode',
            'chainageMetres': round(chainage, 3), 'motorTraffic': next(iter(mode_values)) if len(mode_values) == 1 else None,
            'modeEvidence': mode_rows, 'oneWay': direction_rows,
            'directionEvidenceStatus': 'name-and-chainage-candidates-only'}


def match_counter(detector, point, index, modes, directions):
    if point is None:
        return {'status': 'missing-coordinate', 'candidates': []}
    candidates = index.candidates(detector['source'], point)
    if not candidates:
        return {'status': 'no-axis-within-100m', 'candidates': []}
    best = candidates[0]
    path = index.paths[best['pathId']]
    competitors = independent_competitors(best, candidates, index.paths)
    result = {'status': 'axis-candidate', 'best': best, 'candidates': candidates[:5],
              'competingAlignments': len(competitors), 'directionStatus': 'unresolved'}
    if detector['source'] == 'zurich-city':
        result['events'] = local_events(path, best, modes, directions)
    if detector['scope'] != 'unreviewed':
        result['status'] = 'excluded-counter-scope'
    elif best['distanceMetres'] > MAX_DISTANCE:
        result['status'] = 'axis-too-distant'
    elif not path['eligibleClass']:
        result['status'] = 'excluded-axis-class'
    elif competitors:
        result['status'] = 'ambiguous-axis'
    else:
        if detector['source'] == 'thurgau':
            label_matches = detector['details']['road'] == path['roadKey']
        elif detector['source'] == 'zurich-city':
            label_matches = road_name(detector['details']['road']) == road_name(path['name'])
        else:
            names = [detector['name'], (detector.get('inventory') or {}).get('name')]
            label_matches = len(road_name(path['name'])) >= 6 and any(road_name(path['name']) in road_name(name) for name in names)
        if not label_matches:
            result['status'] = 'road-label-conflict-or-missing'
        elif detector['source'] == 'zurich-city' and result['events']['motorTraffic'] != 'ja':
            result['status'] = 'motor-traffic-unconfirmed'
    return result


def join_thurgau_classes(data, observations, dates, acquisition_year):
    totals = {(o['detectorId'], o['start']): o for o in observations if o['detectorId'].startswith('thurgau:')}
    records, seen, detectors = [], set(), {}
    for day in dates:
        key = 'thurgau-classes-'+day
        rows = data[key]
        if len(rows) != data[key+'-count']['total_count']:
            raise ValueError('Incomplete Thurgau class slice')
        for index, row in enumerate(rows):
            if row['datum'] != day:
                raise ValueError('Class row outside requested date')
            identity = ':'.join(quote(str(row[k]), safe='') for k in ('code', 'richtung', 'spur_code'))
            issues = []
            try:
                instant = swiss_instant(day+'T'+row['zeit_von'])
                start = instant.isoformat()
                if instant.minute != 0 or instant.second != 0 or instant.microsecond != 0:
                    raise TimeIssue('non-hourly-class-time')
                if (instant+timedelta(hours=1)).astimezone(SWISS).strftime('%H:%M') != row['zeit_bis'][:5]:
                    raise TimeIssue('inconsistent-class-hour-end')
            except (ValueError, TimeIssue) as error:
                issues.append(str(error))
                start = None
            total_id = 'thurgau:'+identity
            detector_id = 'thurgau-classes:'+identity
            class_values = {k: count(row[k]) for k in CLASSES if k != 'andere'}
            if any(v is None for v in class_values.values()):
                issues.append('invalid-or-missing-class-count')
            class_sum = sum(class_values.values()) if all(v is not None for v in class_values.values()) else None
            total = totals.get((total_id, start)) if start else None
            if total is not None and not issues and class_sum != total['count']:
                issues.append('class-total-mismatch')
            pair = (detector_id, start)
            if start and pair in seen:
                raise ValueError('Duplicate Thurgau class observation')
            seen.add(pair)
            detector, normalized = normalize('thurgau', {**row, 'anzahl': class_sum}, acquisition_year=acquisition_year)
            detector['id'] = detector_id
            detector['details']['family'] = 'dbu-tba-1-class-counts'
            scope_text = f"{detector['name']} {detector['details'].get('address') or ''}".lower()
            detector['scope'] = 'parking-access-candidate' if any(term in scope_text for term in ('parkhaus', 'parkplatz', 'parkhauseinfahrt')) else 'unreviewed'
            issues = sorted(set(issues + normalized['issues']))
            if detector_id in detectors and detectors[detector_id] != detector:
                raise ValueError('Thurgau class station metadata drift')
            detectors[detector_id] = detector
            records.append({'detectorId': detector_id, 'start': start, 'serviceDate': day, 'classes': class_values,
                'classSum': class_sum, 'countBasis': 'sum-of-published-classes', 'quality': normalized['quality'],
                'sourceRow': {'sourceId': key, 'index': index}, 'totalSourceRow': total['sourceRow'] if total else None,
                'joinStatus': 'joined' if total else 'not-in-total-product',
                'issues': issues})
    for detector in detectors.values():
        detector['days'] = []
        for day in dates:
            rows = [r for r in records if r['detectorId'] == detector['id'] and r['serviceDate'] == day]
            detector['days'].append({'date': day, 'expectedHours': len(day_hours(day)),
                'usableMeasuredHours': len({r['start'] for r in rows if r['start'] is not None and not r['issues']})})
    return {'rows': len(records), 'joinedRows': sum(r['totalSourceRow'] is not None for r in records),
            'standaloneRows': sum(r['totalSourceRow'] is None for r in records),
            'matchingTotals': sum(r['totalSourceRow'] is not None and not r['issues'] for r in records),
            'series': len({r['detectorId'] for r in records}),
            'stations': len({d['stationId'] for d in detectors.values()}),
            'issues': dict(Counter(issue for r in records for issue in r['issues']))}, records, list(detectors.values())


def build_geometry(snapshot, counter_audit, counts):
    manifest, data, source_hash = verified_sources(snapshot)
    if manifest['dates'] != counter_audit['metadata']['dates'] or counts['metadata'] != counter_audit['metadata']:
        raise ValueError('Incompatible hourly-count inputs')
    class_years = {int(e['acquiredAt'][:4]) for e in manifest['files'] if e['id'].startswith('thurgau-classes-')}
    if len(class_years) != 1:
        raise ValueError('Thurgau class acquisition crosses a year boundary; review validation vintage')
    class_summary, class_records, class_detectors = join_thurgau_classes(data, counts['observations'], manifest['dates'], class_years.pop())
    paths = parse_roads(data)
    index = RoadIndex(paths)
    modes, directions = defaultdict(list), defaultdict(list)
    for f in data['zurich-road-modes']['features']:
        p = f['properties']; modes[p['lokalisationnummer']].append(p)
    for f in data['zurich-road-directions']['features']:
        p = f['properties']; directions[road_name(p['lokalisationsname'])].append(p)
    stations = {}
    for feature in data['zurich-stations']['features']:
        p = feature['properties']
        if p['zsid'] in stations or feature['geometry']['type'] != 'Point' or not valid_point(feature['geometry']['coordinates']):
            raise ValueError('Duplicate or invalid municipal station geometry')
        stations[p['zsid']] = feature
    results = []
    used = set()
    for detector in counter_audit['detectors'] + class_detectors:
        if detector['source'] == 'zurich-city':
            point = detector['details']['sourceLv95']
            if not valid_point(point):
                point = None
        else:
            point = wgs84_to_lv95(detector['coordinate']) if detector['coordinate'] else None
        inventory = None
        if detector['source'] == 'zurich-city':
            feature = stations.get(detector['stationId'].split(':')[1])
            inventory = {'status': 'missing-in-current-inventory'}
            if feature:
                shift = math.dist(point, feature['geometry']['coordinates']) if point else None
                inventory = {'status': 'joined' if shift is not None and shift <= 50 else 'coordinate-conflict',
                    'featureId': feature['id'], 'sourceStatus': feature['properties']['status'],
                    'coordinateDeltaMetres': round(shift, 3) if shift is not None else None,
                    'coordinateLv95': feature['geometry']['coordinates']}
                if feature['properties']['status'] != 'aktiv':
                    inventory['status'] = 'not-active-in-current-inventory'
        match = match_counter(detector, point, index, modes, directions)
        if inventory and inventory['status'] != 'joined' and match['status'] == 'axis-candidate':
            match['status'] = 'station-inventory-review'
        results.append({'detectorId': detector['id'], 'stationId': detector['stationId'], 'source': detector['source'],
            'name': detector['name'], 'directionLabel': detector['directionLabel'],
            'measurementBasis': 'sum-of-published-classes' if detector['id'].startswith('thurgau-classes:') else 'reported-total',
            'coordinateLv95': point, 'inventoryJoin': inventory, 'match': match,
            'completeMeasuredBothDays': all(d['usableMeasuredHours'] == d['expectedHours'] for d in detector['days']),
            'playbackEligible': False})
        used.update(c['pathId'] for c in match['candidates'])
    summaries = []
    for source in ('basel', 'thurgau', 'zurich-city'):
        rows = [r for r in results if r['source'] == source]
        summaries.append({'source': source, 'series': len(rows),
            'status': dict(sorted(Counter(r['match']['status'] for r in rows).items())),
            'completeMeasuredAxisCandidates': sum(r['match']['status'] == 'axis-candidate' and r['completeMeasuredBothDays'] for r in rows),
            'playbackEligible': 0})
    source_credits = {}
    for source, source_id in (('basel', 'basel-roads-metadata'), ('thurgau', 'thurgau-roads-metadata'),
                              ('thurgau-classes', 'thurgau-classes-metadata')):
        p = data[source_id]['metas']['default']
        source_credits[source] = {'publisher': p['publisher'], 'title': p['title'], 'license': p['license'],
            'licenseUrl': p.get('license_url'), 'catalogueModified': p['modified'],
            'metadataUrl': next(e['url'] for e in manifest['files'] if e['id'] == source_id)}
    p = data['zurich-roads-metadata']['result']
    source_credits['zurich-city'] = {'publisher': p['organization']['title'], 'title': p['title'],
        'license': p['license_title'], 'licenseUrl': p['license_url'], 'catalogueModified': p['metadata_modified'],
        'metadataUrl': next(e['url'] for e in manifest['files'] if e['id'] == 'zurich-roads-metadata')}
    metadata = {'schemaVersion': 1, 'geometryManifestSha256': source_hash, 'sources': source_credits,
        'countSnapshotManifestSha256': counter_audit['metadata']['snapshotManifestSha256'],
        'dates': manifest['dates'], 'model': 'Official road-axis candidates; no directional playback admission',
        'sourcePathCounts': dict(Counter(p['source'] for p in paths)),
        'coordinateModel': 'LV95; WGS84 inputs transformed using the existing swisstopo polynomial approximation',
        'thresholds': {'searchRadiusMetres': RADIUS, 'maxDistanceMetres': MAX_DISTANCE, 'ambiguityMarginMetres': AMBIGUITY_MARGIN,
                       'municipalInventoryShiftMetres': 50},
        'directionPolicy': 'Source direction labels retained by detector ID. VAS one-way events are name/chainage review evidence, not detector orientation.',
        'classPolicy': 'Separate Thurgau class family; class sums are explicit. Join to totals only by exact code, direction, lane and UTC hour; never add them together.'}
    audit = {'metadata': metadata, 'summary': summaries, 'thurgauClasses': class_summary,
             'municipalInventory': {'features': len(stations),
                'status': dict(Counter(r['inventoryJoin']['status'] for r in results if r['inventoryJoin']))},
             'counters': results}
    artifact = {'metadata': metadata, 'paths': [{k: v for k, v in p.items() if k != 'sourceProperties'} for p in paths if p['id'] in used],
                'thurgauClassObservations': class_records}
    return artifact, audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--counter-audit', type=Path, default=Path('data/regional-road-count-audit.json'))
    parser.add_argument('--counts', type=Path, default=Path('data/regional-road-counts.json.gz'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--audit', type=Path, required=True)
    args = parser.parse_args()
    artifact, audit = build_geometry(args.snapshot, json.loads(args.counter_audit.read_bytes()), json.loads(gzip.decompress(args.counts.read_bytes())))
    for path in (args.output, args.audit):
        path.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(json.dumps(artifact, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'summary': audit['summary'], 'thurgauClasses': audit['thurgauClasses'], 'municipalInventory': audit['municipalInventory']}, ensure_ascii=False, indent=2))
