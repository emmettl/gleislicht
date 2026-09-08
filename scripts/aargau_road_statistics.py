"""Import pinned AGIS survey statistics, without constructing hourly observations."""
import argparse
from collections import Counter
import csv
from datetime import datetime
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'data/regional-road-expansion-sources/2026-09-08'
METRICS = {
    'DTV': {'basis': 'annualized-daily-mean', 'unit': 'vehicles/day'},
    'DTV24': {'basis': 'survey-period-daily-mean', 'unit': 'vehicles/day'},
    'DWV24': {'basis': 'survey-period-weekday-daily-mean', 'unit': 'vehicles/day'},
    'DTVt': {'basis': 'survey-period-daytime-mean', 'unit': 'vehicles/06:00-22:00'},
    'DTVn': {'basis': 'survey-period-nighttime-mean', 'unit': 'vehicles/22:00-06:00'},
    'MSPW': {'basis': 'average-weekday-morning-peak', 'unit': 'vehicles/07:00-08:00'},
    'ASPW': {'basis': 'average-weekday-evening-peak', 'unit': 'vehicles/17:00-18:00'},
}
DIRECTIONS = {'beide Richtungen': 'both', 'Richtung 1': '1', 'Richtung 2': '2'}


def number(text):
    if text == '':
        return None
    value = float(text)
    if not math.isfinite(value) or value < 0:
        raise ValueError(f'Invalid nonnegative statistic: {text!r}')
    return value


def local_time(text):
    return datetime.strptime(text, '%d.%m.%Y %H:%M:%S').isoformat() if text else None


def point(row, east, north):
    values = [number(row[east]), number(row[north])]
    if all(value is None for value in values):
        return None
    if any(value is None for value in values):
        raise ValueError('Incomplete coordinate pair')
    if not (2400000 <= values[0] <= 2900000 and 1000000 <= values[1] <= 1400000):
        raise ValueError('Coordinate outside expected LV95 bounds')
    return values


def normalize(row, source_row, reviews):
    if row['ZSTART'] != 'MIV':
        raise ValueError('Non-MIV record passed to motor-traffic importer')
    if not row['ZSTID'] or row['R'] not in DIRECTIONS or row['AKTUELLP'] not in ('ja', 'nein'):
        raise ValueError('Unknown station, direction or latest-plausible flag')
    start, end = local_time(row['VON']), local_time(row['BIS'])
    issues = []
    if start is None and end is None:
        period_status = 'missing'
    elif start is None or end is None or start >= end:
        period_status = 'invalid'
        issues.append('invalid-survey-period')
    else:
        period_status = 'available'
    review = reviews.get(row['DBLATT'])
    if review and (row['ZSTID'] != review['stationId'] or start != review['startLocal'] or end != review['endExclusiveLocal']):
        raise ValueError('Report review does not match station and period')
    if review:
        issues.extend(review['issues'])
    canonical = json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()
    return {
        'id': 'agis:' + hashlib.sha256(canonical).hexdigest(),
        'sourceRow': source_row,
        'stationId': row['ZSTID'], 'owner': row['EIGNER'], 'name': row['ZSTNAME'],
        'municipality': row['GDENAME'], 'road': row['KSNR'],
        'coordinates': {'crs': 'EPSG:2056', 'counter': point(row, 'ZST_E', 'ZST_N'),
                        'measurement': point(row, 'MESS_E', 'MESS_N')},
        'direction': {'scope': DIRECTIONS[row['R']], 'destination': row['Richtung'] or None,
                      'geometryReviewed': False},
        'referenceYear': int(row['JAHR']),
        'period': {'startLocal': start, 'endExclusiveLocal': end,
                   'timezone': 'Europe/Zurich', 'status': period_status},
        'latestPlausible': row['AKTUELLP'] == 'ja',
        'equipment': {'type': row['GERAETTYP'] or None, 'classScheme': row['GERAETKLASS'] or None},
        'metrics': {field: number(row[field]) for field in METRICS},
        'report': {'filename': row['DBLATT'] or None, 'listingUrl': row['LINK'] or None,
                   'reviewId': review['id'] if review else None},
        'quality': {'status': 'report-reviewed-with-substitution' if review else 'report-unreviewed',
                    'issues': issues},
        # Preserve class fields and every source value without silently remapping units or schemes.
        'sourceFields': row,
    }


def verified_body(name, manifest):
    entry = next(source for source in manifest['sources'] if source['path'] == name)
    body = (SOURCE_DIR / entry['storedPath']).read_bytes()
    if entry['encoding'] == 'gzip':
        body = gzip.decompress(body)
    if len(body) != entry['bytes'] or hashlib.sha256(body).hexdigest() != entry['sha256']:
        raise ValueError(f'Source integrity failure: {name}')
    return body, entry['sha256']


def build(output):
    manifest = json.loads((SOURCE_DIR / 'manifest.json').read_text())
    archive_body, archive_hash = verified_body('aargau-export.zip', manifest)
    reviews = json.loads((ROOT / 'data/aargau-road-statistics-reviews.json').read_text())['reports']
    for review in reviews.values():
        _, digest = verified_body(review['pinnedSource'], manifest)
        if digest != review['sha256']:
            raise ValueError('Report review hash mismatch')
    with zipfile.ZipFile(io.BytesIO(archive_body)) as archive:
        names = [name for name in archive.namelist() if name.endswith('.csv')]
        if len(names) != 1:
            raise ValueError('Expected exactly one CSV member')
        raw = list(csv.DictReader(io.StringIO(archive.read(names[0]).decode('utf-8-sig')), delimiter=';'))
    records = [normalize(row, index, reviews) for index, row in enumerate(raw, start=2) if row['ZSTART'] == 'MIV']
    if len({record['id'] for record in records}) != len(records):
        raise ValueError('Duplicate source records; review before importing')
    unknown = {row['ZSTART'] for row in raw} - {'MIV', 'Velo'}
    if unknown:
        raise ValueError(f'Unknown survey types: {unknown}')
    if set(reviews) - {record['report']['filename'] for record in records}:
        raise ValueError('Orphaned report review')
    records.sort(key=lambda record: (record['stationId'], record['referenceYear'], record['id']))
    metadata = {
        'schemaVersion': 1, 'source': 'AGIS.avk_vkzsmeas', 'acquiredDate': manifest['checkedDate'],
        'archiveSha256': archive_hash, 'csvMember': names[0],
        'attribution': 'Daten des Kantons Aargau',
        'sourceManifest': 'data/regional-road-expansion-sources/2026-09-08/manifest.json',
        'reportReviews': 'data/aargau-road-statistics-reviews.json',
        'productType': 'road-survey-statistics', 'playbackEligible': False, 'publicDisplayAdmitted': False,
        'metricDefinitions': METRICS,
        'classMetricsStatus': 'Retained as original source fields; no cross-scheme aggregation admitted.',
        'aggregationPolicy': 'Do not add both-direction records to their component directions or combine survey periods.',
    }
    audit = {
        'metadata': metadata, 'sourceRows': len(raw), 'importedMivRows': len(records),
        'excludedCycleRows': sum(row['ZSTART'] == 'Velo' for row in raw),
        'stations': len({record['stationId'] for record in records}),
        'periodStatus': dict(sorted(Counter(record['period']['status'] for record in records).items())),
        'qualityStatus': dict(sorted(Counter(record['quality']['status'] for record in records).items())),
        'missingMetrics': {key: sum(record['metrics'][key] is None for record in records) for key in METRICS},
        'flaggedRecords': [{'id': record['id'], 'stationId': record['stationId'], 'sourceRow': record['sourceRow'],
                            'issues': record['quality']['issues']} for record in records if record['quality']['issues']],
    }
    output.mkdir(parents=True, exist_ok=True)
    body = (json.dumps({'metadata': metadata, 'records': records}, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    (output / 'aargau-road-statistics.json.gz').write_bytes(gzip.compress(body, mtime=0))
    (output / 'aargau-road-statistics-audit.json').write_text(json.dumps(audit, indent=2, ensure_ascii=False) + '\n')
    return audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data')
    args = parser.parse_args()
    result = build(args.output)
    print(json.dumps({key: result[key] for key in ('importedMivRows', 'stations', 'periodStatus', 'qualityStatus')}))
