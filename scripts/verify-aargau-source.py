#!/usr/bin/env python3
"""Independent CSV/zip verification of the Aargau civil-day extraction.
Usage: python3 scripts/verify-aargau-source.py ARCHIVE INVENTORY_DIRECTORY
Recounts all active source trips with a canton call, not merely exported IDs.
"""
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import zipfile


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024*1024), b''): h.update(block)
    return h.hexdigest()


def time(value):
    h, m, s = map(int, value.split(':'))
    assert 0 <= m < 60 and 0 <= s < 60
    return h*3600+m*60+s


def main():
    archive, directory = sys.argv[1:]
    directory = Path(directory)
    inventory = json.loads((directory/'inventory.json').read_text())
    assert sha(archive) == inventory['metadata']['archiveSha256']
    inside = set(inventory['cantonStopIds'])
    dates = inventory['metadata']['dates']
    contexts = [(i, dt.date.fromisoformat(date)+dt.timedelta(days=delta), delta*86400) for i, date in enumerate(dates) for delta in (-1, 0)]
    snapshots = [json.loads(gzip.decompress((directory/(date+'-timetable.json.gz')).read_bytes())) for date in dates]
    actual = [{t['id']: t for t in snap['trains']} for snap in snapshots]
    assert all(len(by_id) == len(snap['trains']) for by_id, snap in zip(actual, snapshots))
    seen = [set() for _ in dates]
    counts = [dict(date=date, journeys=0, calls=0, precedingServiceDayJourneys=0, frequencyJourneys=0) for date in dates]
    with zipfile.ZipFile(archive) as z:
        def rows(name):
            if name not in z.namelist(): return iter(())
            return csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8-sig', newline=''))
        calendars = list(rows('calendar.txt')); exceptions = list(rows('calendar_dates.txt'))
        active = []
        for _, date, _ in contexts:
            compact = date.strftime('%Y%m%d'); weekday = date.strftime('%A').lower()
            services = {r['service_id'] for r in calendars if r[weekday] == '1' and r['start_date'] <= compact <= r['end_date']}
            for r in exceptions:
                if r['date'] == compact:
                    if r['exception_type'] == '1': services.add(r['service_id'])
                    else: services.discard(r['service_id'])
            active.append(services)
        routes = {r['route_id']: r for r in rows('routes.txt')}
        platforms = {r['stop_id']: r for r in rows('stops.txt')}
        for snap in snapshots:
            for stop in snap['stops']:
                r = platforms[stop[4]]
                assert stop == [float(r['stop_lon']),float(r['stop_lat']),r['stop_name'],r.get('platform_code',''),r['stop_id']]
        trips = {}
        for r in rows('trips.txt'):
            uses = [i for i, services in enumerate(active) if r['service_id'] in services]
            if uses: trips[r['trip_id']] = (r, uses)
        frequency = {}
        for r in rows('frequencies.txt'):
            if r['trip_id'] in trips: frequency.setdefault(r['trip_id'], []).append(r)
        def check(trip_id, calls):
            if not calls or not any(c[0] in inside for c in calls): return
            meta, uses = trips[trip_id]
            calls.sort(key=lambda c: c[5])
            assert len(calls) >= 2
            for k, call in enumerate(calls):
                assert call[2] >= call[1] and (not k or call[1] >= calls[k-1][2])
            for use in uses:
                day, source_date, offset = contexts[use]
                instances = [(trip_id, 0)]
                if trip_id in frequency:
                    instances = []
                    for interval in frequency[trip_id]:
                        headway = int(interval['headway_secs']); assert headway > 0
                        # URL encoding matches encodeURIComponent in the Node importer.
                        from urllib.parse import quote
                        encoded = quote(trip_id, safe="~()*!.'-_")
                        for departure in range(time(interval['start_time']),time(interval['end_time']),headway):
                            instances.append(('frequency:'+encoded+':'+str(departure), departure-calls[0][2]))
                for instance, delta in instances:
                    start, end = calls[0][2]+offset+delta, calls[-1][1]+offset+delta
                    if start >= 86400 or end <= 0: continue
                    ident = source_date.isoformat()+':'+instance
                    assert ident in actual[day], 'Missing canton journey: '+ident
                    assert ident not in seen[day], 'Duplicate source instance'
                    seen[day].add(ident)
                    train = actual[day][ident]
                    assert train['sourceTripId'] == trip_id and train['sourceServiceDate'] == source_date.isoformat()
                    assert train['routeId'] == meta['route_id'] and train['directionId'] == meta.get('direction_id','')
                    assert train['agencyId'] == routes[meta['route_id']]['agency_id']
                    assert train['headsign'] == meta.get('trip_headsign','') and train['shortName'] == meta.get('trip_short_name','')
                    assert train['start'] == start and train['end'] == end
                    assert train['calls'] == [[c[0],c[1]+offset+delta,c[2]+offset+delta,c[3],c[4]] for c in calls], 'Changed or clipped stop chain: '+ident
                    counts[day]['journeys'] += 1
                    counts[day]['calls'] += len(calls)
                    counts[day]['precedingServiceDayJourneys'] += bool(offset)
                    counts[day]['frequencyJourneys'] += trip_id in frequency
        current, calls, scanned = None, [], 0
        for r in rows('stop_times.txt'):
            if r['trip_id'] != current:
                if current in trips: check(current, calls)
                current, calls = r['trip_id'], []
            if current in trips:
                calls.append([r['stop_id'],time(r['arrival_time'] or r['departure_time']),time(r['departure_time'] or r['arrival_time']),r.get('pickup_type','') or '0',r.get('drop_off_type','') or '0',int(r['stop_sequence'])])
            scanned += 1
            if scanned % 10000000 == 0: print('Verified scan:',scanned,flush=True)
        if current in trips: check(current,calls)
    for day in range(len(dates)): assert seen[day] == set(actual[day]), 'Unexpected extracted journeys'
    report = {'schemaVersion':1,'archiveSha256':sha(archive),'inventorySha256':sha(directory/'inventory.json'),'fixtures':{date+'-timetable.json.gz':sha(directory/(date+'-timetable.json.gz')) for date in dates},'method':'Independent Python csv/zip calendar and exception expansion across all national routes. Exact full source platform coordinates, names, identity, ordered calls, boarding rules and shifted times; selected and preceding service dates; missing and unexpected journey set equality. Membership uses the pinned canton stop inventory.','sourceStopTimeRows':scanned,'days':counts,'passed':True}
    (directory/'source-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == '__main__': main()
