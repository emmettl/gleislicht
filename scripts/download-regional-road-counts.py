"""Snapshot bounded public hourly-count queries; keep original HTTP bytes and hashes."""
import argparse
from datetime import date, datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

SOURCES = {
    'basel': 'https://data.bs.ch/api/explore/v2.1/catalog/datasets/100006',
    'thurgau': 'https://data.tg.ch/api/explore/v2.1/catalog/datasets/dbu-tba-2',
    'zurich-city': 'https://data.stadt-zuerich.ch/api/3/action/package_show?id=sid_dav_verkehrszaehlung_miv_od2031',
}


def acquire(output, dates):
    output.mkdir(parents=True, exist_ok=False)
    manifest = {'schemaVersion': 1, 'complete': False, 'dates': dates, 'files': []}

    def get(name, url, source, role, service_date=None):
        body = subprocess.check_output(['curl', '--fail', '--silent', '--show-error',
                                        '--max-time', '120', url])
        value = json.loads(body)
        if isinstance(value, dict) and value.get('success') is False:
            raise ValueError(f'Publisher rejected {name}: {value.get("error")}')
        filename = name + '.json.gz'
        (output / filename).write_bytes(gzip.compress(body, mtime=0))
        manifest['files'].append({
            'path': filename, 'source': source, 'role': role, 'serviceDate': service_date,
            'url': url, 'acquiredAt': datetime.now(timezone.utc).isoformat(),
            'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
        })
        (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        return value

    for source, base in SOURCES.items():
        metadata = get(source + '-metadata', base, source, 'metadata')
        resource = None
        if source == 'zurich-city':
            resources = metadata['result']['resources']
            resource = {}
            for year in {d[:4] for d in dates}:
                matches = [r for r in resources if r['name'].lower().endswith(f'_{year}.csv')
                           and r.get('datastore_active')]
                if len(matches) != 1:
                    raise ValueError(f'No unique queryable Zürich CSV for {year}')
                resource[year] = matches[0]['id']
        if source == 'basel':
            station_base = 'https://data.bs.ch/api/explore/v2.1/catalog/datasets/100038'
            get('basel-stations-metadata', station_base, source, 'station-metadata')
            get('basel-stations', station_base + '/exports/json', source, 'stations')

        for day in dates:
            start = datetime.combine(date.fromisoformat(day), datetime.min.time(), ZoneInfo('Europe/Zurich'))
            end = start + timedelta(days=1)
            if source in ('basel', 'thurgau'):
                where = (f'datetimefrom >= "{start.isoformat()}" AND datetimefrom < "{end.isoformat()}"'
                         if source == 'basel' else f"datum = date'{day}'")
                count = get(f'{source}-{day}-count', base + '/records?' + urlencode({'where': where, 'limit': 0}),
                            source, 'count', day)['total_count']
                rows = get(f'{source}-{day}', base + '/exports/json?' + urlencode({'where': where}),
                           source, 'observations', day)
                if not isinstance(rows, list) or len(rows) != count or count == 0:
                    raise ValueError(f'{source} {day}: incomplete/empty export, expected {count}')
            else:
                # Explicit columns avoid duplicating CKAN's generated full-text index.
                fields = ['_id', 'MSID', 'MSName', 'ZSID', 'ZSName', 'Achse', 'HNr', 'Hoehe',
                          'EKoord', 'NKoord', 'Richtung', 'Knummer', 'Kname', 'AnzDetektoren',
                          'D1ID', 'D2ID', 'D3ID', 'D4ID', 'MessungDatZeit', 'LieferDat',
                          'AnzFahrzeuge', 'AnzFahrzeugeStatus']
                table = resource[day[:4]]
                predicate = (f'FROM "{table}" WHERE "MessungDatZeit" >= \'{day}T00:00:00\' '
                             f'AND "MessungDatZeit" < \'{end.date()}T00:00:00\'')
                endpoint = 'https://data.stadt-zuerich.ch/api/3/action/datastore_search_sql?'
                count = int(get(f'{source}-{day}-count', endpoint + urlencode({'sql': 'SELECT count(*) AS n ' + predicate}),
                                source, 'count', day)['result']['records'][0]['n'])
                offset = 0
                ids = set()
                while offset < count:
                    sql = ('SELECT ' + ','.join(f'"{f}"' for f in fields) + ' ' + predicate +
                           f' ORDER BY "_id" LIMIT 5000 OFFSET {offset}')
                    rows = get(f'{source}-{day}-{offset}', endpoint + urlencode({'sql': sql}),
                               source, 'observations', day)['result']['records']
                    if not rows or any(r['_id'] in ids for r in rows):
                        raise ValueError('Incomplete or unstable Zürich pagination')
                    ids.update(r['_id'] for r in rows)
                    offset += len(rows)
                if offset != count or count == 0:
                    raise ValueError(f'Zürich {day}: incomplete/empty export')
            print(f'{source} {day}: {count} records', flush=True)
    manifest['complete'] = True
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dates', required=True, help='Comma-separated Swiss civil dates')
    parser.add_argument('--output', required=True, type=Path, help='New snapshot directory (never overwritten)')
    args = parser.parse_args()
    days = sorted(set(args.dates.split(',')))
    for day in days:
        if date.fromisoformat(day).isoformat() != day:
            parser.error('Dates must use YYYY-MM-DD')
    acquire(args.output, days)
