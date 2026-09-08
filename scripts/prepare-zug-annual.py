#!/usr/bin/env python3
"""Preserve complete annual Zug GTFS rows from the already pinned national ZIP.

Two national stop-time passes deliberately avoid assumptions about row grouping.
The first selects every trip calling at a frozen canton stop, across all routes;
the second retains every original call of those trips, including foreign termini.
"""
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): result.update(block)
    return result.hexdigest()


def extract(archive, destination):
    fixture_path = Path('data/zug-timetable.json.gz')
    fixture = json.loads(gzip.decompress(fixture_path.read_bytes()))
    assert digest(archive) == fixture['sourceHashes']['archive'], 'Wrong national archive'
    canton = {s['stop_id'] for s in fixture['cantonStops']}
    scoped, called, services = set(), set(), set()
    destination.mkdir(parents=True, exist_ok=True)
    files = []
    with zipfile.ZipFile(archive) as source:
        def rows(name):
            stream = io.TextIOWrapper(source.open(name), encoding='utf-8-sig', newline='')
            reader = csv.reader(stream)
            return stream, reader, next(reader)

        stream, reader, header = rows('stop_times.txt')
        trip_index, stop_index = header.index('trip_id'), header.index('stop_id')
        total = 0
        with stream:
            for row in reader:
                total += 1
                if row[stop_index] in canton:
                    scoped.add(row[trip_index]); called.add(row[stop_index])
        assert total == fixture['scope']['annualStopTimeRows']
        assert len(scoped) == fixture['scope']['annualScopedTripRecords']
        assert len(called) == fixture['scope']['calledCantonStopRecords']
        print(f'Census: {total} national rows; {len(scoped)} whole annual trips', flush=True)

        def retain(name, predicate):
            stream, reader, header = rows(name)
            path = destination / (name + '.gz')
            count = national = 0
            # Re-encode CSV fields losslessly; gzip has no filename or wall-clock time.
            with stream, path.open('wb') as output, gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0) as compressed:
                with io.TextIOWrapper(compressed, encoding='utf-8', newline='') as text:
                    writer = csv.writer(text, lineterminator='\n'); writer.writerow(header)
                    for values in reader:
                        national += 1
                        if predicate(dict(zip(header, values))):
                            writer.writerow(values); count += 1
            files.append({'file': path.name, 'sha256': digest(path), 'rows': count,
                          'nationalRows': national, 'archiveEntry': name,
                          'archiveEntryBytes': source.getinfo(name).file_size,
                          'archiveEntryCrc32': f'{source.getinfo(name).CRC:08x}'})
            print(f'{name}: retained {count}/{national}', flush=True)

        def trip(row):
            if row['trip_id'] not in scoped: return False
            services.add(row['service_id']); return True
        retain('trips.txt', trip)
        retain('stop_times.txt', lambda row: row['trip_id'] in scoped)
        retain('calendar.txt', lambda row: row['service_id'] in services)
        retain('calendar_dates.txt', lambda row: row['service_id'] in services)
        retain('frequencies.txt', lambda row: row['trip_id'] in scoped)
        for name in ['stops.txt', 'routes.txt', 'agency.txt', 'feed_info.txt']:
            retain(name, lambda row: True)
    catalogue = {
        'schemaVersion': 1, 'prepared': '2026-09-09',
        'archiveUrl': 'https://data.opentransportdata.swiss/dataset/3d2c18f9-9ef1-463f-a249-5c67604efd74/resource/c09aba2a-41e9-4117-88af-3fdfe589d64a/download/gtfs_fp2026_20260902.zip',
        'archiveSha256': fixture['sourceHashes']['archive'], 'fixtureSha256': digest(fixture_path),
        'boundarySha256': fixture['sourceHashes']['boundary'],
        'feed': fixture['feed'], 'scope': fixture['scope'],
        'attribution': 'SBB / opentransportdata.swiss',
        'termsUrl': 'https://opentransportdata.swiss/en/terms-of-use/',
        'method': 'Full national stop-time census without route or operator whitelist; retain complete scoped trips and all their calendar/exception/frequency rows. Preserve all national stop, route and agency records. CSV fields are re-encoded without value changes; no geometry or extra feed dates are admitted.',
        'files': files,
    }
    (destination / 'sources.json').write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Usage: prepare-zug-annual.py PINNED_ARCHIVE OUTPUT_DIRECTORY'
    extract(Path(sys.argv[1]), Path(sys.argv[2]))
