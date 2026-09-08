"""Produce bounded browser assets for the Aargau statistical explorer."""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def build(output):
    source = json.loads(gzip.decompress((ROOT / 'data/aargau-road-statistics.json.gz').read_bytes()))
    reviews = json.loads((ROOT / 'data/aargau-road-statistics-reviews.json').read_text())['reports']
    groups = defaultdict(list)
    for record in source['records']:
        review = reviews.get(record['report']['filename'])
        groups[record['stationId']].append({
            'id': record['id'], 'year': record['referenceYear'], 'period': record['period'],
            'direction': record['direction'], 'latestPlausible': record['latestPlausible'],
            'metrics': record['metrics'], 'quality': record['quality']['status'],
            'reportUrl': record['report']['listingUrl'],
            'substitution': {'date': review['substitutedDate'], 'replacement': review['replacementDate']} if review else None,
        })
    stations, buckets = [], defaultdict(dict)
    for station_id, records in sorted(groups.items()):
        # Catalogue names may change historically; select a deterministic recent source row.
        candidates = [r for r in source['records'] if r['stationId'] == station_id]
        latest = max(candidates, key=lambda r: (r['referenceYear'], r['period']['startLocal'] or '', r['id']))
        shard = hashlib.sha256(station_id.encode()).hexdigest()[0]
        stations.append({'id': station_id, 'name': latest['name'], 'municipality': latest['municipality'],
                         'owner': latest['owner'], 'road': latest['road'], 'shard': shard, 'records': len(records)})
        buckets[shard][station_id] = sorted(records, key=lambda r: (-r['year'], r['period']['startLocal'] or '', r['direction']['scope'], r['id']))
    output.mkdir(parents=True, exist_ok=True)
    files = {}
    for shard, records in sorted(buckets.items()):
        body = encoded({'schemaVersion': 1, 'shard': shard, 'stations': records})
        (output / f'{shard}.json').write_bytes(body)
        files[shard] = {'path': f'{shard}.json', 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    index = {'schemaVersion': 1, 'productType': 'road-survey-statistics', 'playbackEligible': False,
             'acquiredDate': source['metadata']['acquiredDate'], 'attribution': source['metadata']['attribution'],
             'sourceUrl': 'https://www.ag.ch/de/themen/mobilitaet-verkehr/verkehrsdaten/verkehrserhebungen',
             'archiveSha256': source['metadata']['archiveSha256'], 'stations': stations, 'files': files}
    (output / 'index.json').write_bytes(encoded(index))
    return index


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/aargau-road-statistics')
    args = parser.parse_args()
    index = build(args.output)
    print(f"Compiled {len(index['stations'])} stations in {len(index['files'])} bounded files")
