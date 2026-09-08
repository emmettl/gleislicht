"""Extract complete Glion stop families and touching transfer rules from pinned GTFS."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

ARCHIVE_SHA = 'd325fd0954a91ac50005ad53db1976b8e528ebb1c388e4e8fd5a4415e4139a1e'
ROOT = Path(__file__).resolve().parents[1]


def extract(archive):
    with open(archive, 'rb') as stream:
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
        if digest.hexdigest() != ARCHIVE_SHA:
            raise ValueError('GTFS archive changed; review the interchange again')
    result = dict(archiveSha256=ARCHIVE_SHA, feedVersion='20260902',
                  serviceDate='2026-09-04', files={})
    with zipfile.ZipFile(archive) as source:
        result['pathwaysPresent'] = 'pathways.txt' in source.namelist()
        stop_bytes = source.read('stops.txt')
        stops = list(csv.DictReader(io.StringIO(stop_bytes.decode('utf-8-sig'))))
        family = {'ch:1:sloid:1370', 'ch:1:sloid:30031'}
        # Traverse parents and children, rather than guessing IDs from prefixes.
        while True:
            expanded = family | {r['parent_station'] for r in stops if r['stop_id'] in family and r['parent_station']} | {r['stop_id'] for r in stops if r['parent_station'] in family}
            if expanded == family:
                break
            family = expanded
        for name in ['stops.txt', 'transfers.txt']:
            raw = stop_bytes if name == 'stops.txt' else source.read(name)
            count, selected = 0, []
            for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
                count += 1
                if row.get('stop_id') in family or row.get('from_stop_id') in family or row.get('to_stop_id') in family:
                    selected.append(row)
            result['files'][name] = dict(sha256=hashlib.sha256(raw).hexdigest(), totalRows=count, rows=selected)
    for study in ['territet', 'rochers']:
        result[study + 'SourceSha256'] = hashlib.sha256((ROOT / f'data/{study}-journey-source.json').read_bytes()).hexdigest()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/glion-transfer-source.json')
    args = parser.parse_args()
    args.output.write_text(json.dumps(extract(args.archive), indent=2) + '\n')
